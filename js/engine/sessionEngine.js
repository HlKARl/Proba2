/**
 * Motor de sesiones ordinarias: Modo Estudio y Modo Concurso (Sec. 6).
 * - Límite confirmado: entre 5 y 15 preguntas.
 * - Si el banco tiene menos preguntas que las solicitadas, usa todas las disponibles y lo comunica.
 * - Modo Estudio no entrega oro.
 */

import { db } from '../db/database.js';
import { CONFIRMED_RULES } from '../config/defaults.js';
import { libraryManager } from '../library/libraryManager.js';

export class SessionEngine {
  /**
   * Prepara la selección de preguntas según cantidad y orden (Aleatorio, Por orden, Falladas).
   */
  async buildQuestionPool({ documentIds, requestedCount, order = 'aleatorio', isCampaign = false }) {
    const allValid = await libraryManager.getQuestionsForDocuments(documentIds);
    if (allValid.length === 0) {
      throw new Error('Los documentos seleccionados no contienen preguntas válidas.');
    }

    let targetCount = Number(requestedCount) || 10;
    if (!isCampaign) {
      targetCount = Math.max(
        CONFIRMED_RULES.ORDINARY_MIN_QUESTIONS,
        Math.min(CONFIRMED_RULES.ORDINARY_MAX_QUESTIONS, targetCount)
      );
    }

    let ordered = [...allValid];

    if (order === 'aleatorio') {
      ordered = shuffleArray(ordered);
    } else if (order === 'falladas') {
      const stats = await db.get('statistics', 'global_stats');
      const wrongSet = new Set(stats?.wrongQuestionIds || []);
      const failedFirst = shuffleArray(ordered.filter((q) => wrongSet.has(q.id)));
      const rest = shuffleArray(ordered.filter((q) => !wrongSet.has(q.id)));
      ordered = [...failedFirst, ...rest];
    } else {
      // 'por_orden': respeta orden original por documento e índice
      ordered.sort((a, b) => {
        if (a.documentId !== b.documentId) return a.documentId.localeCompare(b.documentId);
        return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
      });
    }

    let notice = null;
    let selected = ordered.slice(0, targetCount);

    if (!isCampaign && ordered.length < targetCount) {
      notice = `El banco seleccionado tiene ${ordered.length} pregunta(s) disponible(s) (menor a las ${targetCount} solicitadas). Se utilizarán todas las disponibles.`;
    }

    return {
      questions: selected,
      bankPool: ordered,
      notice
    };
  }

  /**
   * Crea una nueva partida ordinaria ('estudio' o 'concurso').
   */
  async startOrdinarySession({ mode, subjectId, documentIds, questionCount, order }) {
    if (mode !== 'estudio' && mode !== 'concurso') {
      throw new Error(`Modo ordinario inválido: ${mode}`);
    }

    const { questions, notice } = await this.buildQuestionPool({
      documentIds,
      requestedCount: questionCount,
      order,
      isCampaign: false
    });

    const run = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode,
      subjectId,
      selectedDocumentIds: [...documentIds],
      questionIds: questions.map((q) => q.id),
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'in_progress'
    };

    await db.put('runs', run);

    return {
      run,
      questions,
      currentIndex: 0,
      answers: [],
      notice,
      goldEarned: 0 // Regla firme: Estudio (y sesiones ordinarias) no generan oro de campaña
    };
  }

  /**
   * Registra la respuesta de una pregunta en modo Estudio/Concurso y actualiza estadísticas.
   */
  async submitOrdinaryAnswer(session, question, selectedOptionId, elapsedMs) {
    const isCorrect = selectedOptionId === question.correctOptionId;

    const answerRecord = {
      id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runId: session.run.id,
      questionId: question.id,
      selectedOptionId,
      correct: isCorrect,
      elapsedMs: Number(elapsedMs) || 0,
      timestamp: new Date().toISOString()
    };

    await db.put('answers', answerRecord);
    await recordQuestionStatistics({
      subjectId: session.run.subjectId,
      documentId: question.documentId,
      questionId: question.id,
      isCorrect
    });

    session.answers.push(answerRecord);
    return {
      isCorrect,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation
    };
  }

  async finishOrdinarySession(session) {
    session.run.endedAt = new Date().toISOString();
    session.run.status = 'completed';
    await db.put('runs', session.run);

    const profile = await db.get('playerProfile', 'player');
    profile.aggregateStats.totalRuns = (profile.aggregateStats.totalRuns || 0) + 1;
    await db.put('playerProfile', profile);

    const correctCount = session.answers.filter((a) => a.correct).length;
    const total = session.questions.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return {
      mode: session.run.mode,
      total,
      correctCount,
      wrongCount: total - correctCount,
      accuracy,
      goldEarned: 0
    };
  }
}

export async function recordQuestionStatistics({ subjectId, documentId, questionId, isCorrect }) {
  const stats = await db.get('statistics', 'global_stats');
  stats.attempts = (stats.attempts || 0) + 1;
  if (isCorrect) {
    stats.correctCount = (stats.correctCount || 0) + 1;
  }
  stats.accuracy = stats.attempts > 0 ? Math.round((stats.correctCount / stats.attempts) * 100) : 0;

  // Per subject
  if (subjectId) {
    if (!stats.perSubject[subjectId]) {
      stats.perSubject[subjectId] = { attempts: 0, correct: 0 };
    }
    stats.perSubject[subjectId].attempts += 1;
    if (isCorrect) stats.perSubject[subjectId].correct += 1;
  }

  // Per document
  if (documentId) {
    if (!stats.perDocument[documentId]) {
      stats.perDocument[documentId] = { attempts: 0, correct: 0 };
    }
    stats.perDocument[documentId].attempts += 1;
    if (isCorrect) stats.perDocument[documentId].correct += 1;
  }

  // Wrong question IDs list
  const wrongSet = new Set(stats.wrongQuestionIds || []);
  if (!isCorrect) {
    wrongSet.add(questionId);
  } else {
    wrongSet.delete(questionId);
  }
  stats.wrongQuestionIds = [...wrongSet];

  await db.put('statistics', stats);

  const profile = await db.get('playerProfile', 'player');
  profile.aggregateStats.totalQuestionsAnswered = (profile.aggregateStats.totalQuestionsAnswered || 0) + 1;
  if (isCorrect) {
    profile.aggregateStats.totalCorrect = (profile.aggregateStats.totalCorrect || 0) + 1;
  }
  await db.put('playerProfile', profile);
}

export function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const sessionEngine = new SessionEngine();
