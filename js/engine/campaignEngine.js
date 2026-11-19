/**
 * Motor central de Campaña RPG (Sec. 7, 8, 9, 13 y 15).
 * Centraliza clases, habilidades de 5 niveles, sacrificios, saltos del Ninja,
 * eliminaciones automáticas del Ladrón, Dados del destino del Mago,
 * multiplicadores/riesgo del Berserker, puntos de control cada 5 preguntas y Frenesí.
 */

import { db } from '../db/database.js';
import { CONFIRMED_RULES } from '../config/defaults.js';
import { CLASSES, MAGE_DICE_OUTCOMES } from './classes.js';
import { economyEngine } from './economyEngine.js';
import { sessionEngine, recordQuestionStatistics, shuffleArray } from './sessionEngine.js';

export class CampaignEngine {
  /**
   * Inicia una nueva campaña RPG con exactamente UNA clase seleccionada.
   */
  async startCampaign({ subjectId, documentIds, classId, order = 'aleatorio', customLength = null }) {
    if (!CLASSES[classId]) {
      throw new Error(`Clase inválida: ${classId}`);
    }

    const eligibility = await economyEngine.canStartCampaignWithClass(classId);
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason);
    }

    const settings = await db.get('settings', 'global');
    const classProgress = await db.get('classProgress', classId);
    const unlockedLevels = [...new Set(classProgress?.unlockedSkillLevels || [1])];
    const hasLevel = (lvl) => unlockedLevels.includes(lvl);

    // Duración configurable de campaña (Sec. 6.2 & 16)
    let totalQuestions = Number(customLength || settings?.campaignConfig?.campaignQuestionCount || 30);
    // Mago Nivel IV: Expansión arcana (+5 preguntas adicionales)
    if (classId === 'mago' && hasLevel(4)) {
      totalQuestions += 5;
    }

    const { bankPool } = await sessionEngine.buildQuestionPool({
      documentIds,
      requestedCount: totalQuestions,
      order,
      isCampaign: true
    });

    // Construir cola de preguntas (si el banco tiene menos que totalQuestions, recicla ordenadamente)
    const questionQueue = buildExpandedQueue(bankPool, totalQuestions, order);

    // Comodines iniciales configurables menos sacrificio de Nivel II (-1 comodín en las 4 clases)
    const baseWildcards = Number(settings?.wildcardConfig?.initialCount ?? 3);
    const startingWildcards = Math.max(0, baseWildcards - (hasLevel(2) ? 1 : 0));

    // Ladrón Nivel IV (Juego peligroso): no dispone del comodín 50/50
    const disabledWildcards = (classId === 'ladron' && hasLevel(4)) ? ['fifty_fifty'] : [];

    const run = {
      id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: 'campana',
      subjectId,
      classId,
      selectedDocumentIds: [...documentIds],
      questionIds: questionQueue.map((q) => q.id),
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'in_progress'
    };

    const state = {
      id: 'active_campaign',
      runId: run.id,
      subjectId,
      selectedDocumentIds: [...documentIds],
      classId,
      unlockedLevels,
      order,
      questionQueue,
      bankPool,
      currentQuestionIndex: 0,
      answeredCount: 0,
      totalQuestions,
      campaignGold: 0,
      securedGold: 0,
      checkpointsReached: 0,
      consecutiveCorrect: 0,
      saltos: 0,
      hurtoMayorUsedBlocks: [],
      mageDiceTriggered: false,
      mageRerollUsed: false,
      pendingDiceRoll: null, // { dice: [outcome1, outcome2?], applied: false }
      activeEffects: {
        x4FutureGold: false
      },
      frenzy: {
        active: false,
        activatedAt: null,
        expiresAt: null,
        remainingQuestions: 0
      },
      wildcardsRemaining: startingWildcards,
      disabledWildcards,
      currentQuestionMeta: null,
      status: 'in_progress',
      eventsLog: []
    };

    this.prepareCurrentQuestionMeta(state);

    await db.put('runs', run);
    await db.put('campaignState', state);
    return state;
  }

  async getActiveCampaign() {
    const state = await db.get('campaignState', 'active_campaign');
    if (!state || state.status !== 'in_progress') return null;
    return state;
  }

  /**
   * Prepara habilidades automáticas al cargar cada pregunta (ej. Ladrón I y V, Mago P10).
   */
  prepareCurrentQuestionMeta(state) {
    const q = state.questionQueue[state.currentQuestionIndex];
    if (!q) {
      state.currentQuestionMeta = null;
      return;
    }

    const eliminatedOptionIds = [];
    const logs = [];
    const hasLevel = (lvl) => state.unlockedLevels.includes(lvl);

    // Ladrón Nivel I (Hurto menor): elimina automáticamente 1 incorrecta en cada pregunta
    if (state.classId === 'ladron' && hasLevel(1)) {
      const wrongOpts = q.options.filter((o) => o.id !== q.correctOptionId);
      if (wrongOpts.length >= 2) {
        const picked = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
        eliminatedOptionIds.push(picked.id);
        logs.push(`Hurto menor eliminó automáticamente la opción ${picked.id}.`);
      }
    }

    // Ladrón Nivel V (Maestro del engaño): elimina automáticamente una 2da incorrecta en cada pregunta
    if (state.classId === 'ladron' && hasLevel(5)) {
      const remainingWrong = q.options.filter(
        (o) => o.id !== q.correctOptionId && !eliminatedOptionIds.includes(o.id)
      );
      if (remainingWrong.length >= 2) {
        const picked2 = remainingWrong[Math.floor(Math.random() * remainingWrong.length)];
        eliminatedOptionIds.push(picked2.id);
        logs.push(`Maestro del engaño eliminó una segunda opción (${picked2.id}).`);
      }
    }

    // Mago Nivel I: En la pregunta 10 (índice 9) se realiza tirada de Dados del destino
    const questionNumber = state.currentQuestionIndex + 1;
    if (state.classId === 'mago' && hasLevel(1) && questionNumber === 10 && !state.mageDiceTriggered) {
      state.mageDiceTriggered = true;
      state.pendingDiceRoll = this.rollMageDice(state);
      logs.push('¡Has alcanzado la pregunta 10! Los Dados del destino están listos.');
    }

    state.currentQuestionMeta = {
      questionId: q.id,
      eliminatedOptionIds,
      hintRevealed: false,
      autoLogs: logs
    };
  }

  /**
   * Ladrón Nivel III (Hurto mayor): Una vez por cada bloque de 5 preguntas, elimina una 2da incorrecta.
   */
  async useThiefGreaterSteal() {
    const state = await this.getActiveCampaign();
    if (!state) throw new Error('No hay campaña activa.');
    if (state.classId !== 'ladron' || !state.unlockedLevels.includes(3)) {
      throw new Error('Hurto mayor no está disponible.');
    }
    const blockIdx = Math.floor(state.currentQuestionIndex / 5);
    if (state.hurtoMayorUsedBlocks.includes(blockIdx)) {
      throw new Error('Ya usaste Hurto mayor en este bloque de 5 preguntas.');
    }

    const q = state.questionQueue[state.currentQuestionIndex];
    const elim = state.currentQuestionMeta.eliminatedOptionIds;
    const candidates = q.options.filter((o) => o.id !== q.correctOptionId && !elim.includes(o.id));
    if (candidates.length < 2) {
      throw new Error('No quedan suficientes alternativas incorrectas para eliminar.');
    }

    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    elim.push(victim.id);
    state.hurtoMayorUsedBlocks.push(blockIdx);
    state.eventsLog.push(`Hurto mayor (bloque ${blockIdx + 1}): opción ${victim.id} descartada.`);

    await db.put('campaignState', state);
    return { state, eliminatedId: victim.id };
  }

  /**
   * Ninja: Usar un Salto acumulado para omitir la pregunta actual sin fallar.
   */
  async useNinjaSkip() {
    const state = await this.getActiveCampaign();
    if (!state) throw new Error('No hay campaña activa.');
    if (state.classId !== 'ninja' || state.saltos <= 0) {
      throw new Error('No tienes saltos disponibles.');
    }

    state.saltos -= 1;
    state.answeredCount += 1;
    state.eventsLog.push(`Salto Ninja utilizado en P${state.currentQuestionIndex + 1}. Saltos restantes: ${state.saltos}.`);

    const checkpointInfo = await this.checkAndApplyCheckpoint(state);
    state.currentQuestionIndex += 1;

    if (state.currentQuestionIndex >= state.totalQuestions) {
      return await this.resolveCampaignEnd(state, 'victory', checkpointInfo);
    }

    this.prepareCurrentQuestionMeta(state);
    await db.put('campaignState', state);
    return { action: 'skipped', state, checkpointInfo };
  }

  /**
   * Uso de comodines durante la campaña (respeta Frenesí con comodines ilimitados si está configurado).
   */
  async useWildcard(wildcardId) {
    const state = await this.getActiveCampaign();
    if (!state) throw new Error('No hay campaña activa.');
    const settings = await db.get('settings', 'global');

    if (state.disabledWildcards.includes(wildcardId)) {
      throw new Error('Este comodín está bloqueado por un sacrificio de tu clase.');
    }

    const frenzyActive = this.isFrenzyCurrentlyActive(state, settings);
    const unlimitedByFrenzy = frenzyActive && settings?.frenzyConfig?.effectType === 'unlimited_wildcards';

    if (!unlimitedByFrenzy && state.wildcardsRemaining <= 0) {
      throw new Error('No te quedan comodines disponibles.');
    }

    const q = state.questionQueue[state.currentQuestionIndex];
    const elim = state.currentQuestionMeta.eliminatedOptionIds;
    let detailMessage = '';

    if (wildcardId === 'fifty_fifty') {
      const remainingWrong = q.options.filter((o) => o.id !== q.correctOptionId && !elim.includes(o.id));
      if (remainingWrong.length < 2) {
        throw new Error('Ya se han eliminado todas las opciones descartables.');
      }
      const removeCount = Math.max(1, Math.floor(remainingWrong.length / 2));
      const shuffledWrong = shuffleArray(remainingWrong).slice(0, removeCount);
      for (const w of shuffledWrong) elim.push(w.id);
      detailMessage = `Comodín 50/50 eliminó: ${shuffledWrong.map((w) => w.id).join(', ')}.`;
    } else if (wildcardId === 'reveal_hint') {
      state.currentQuestionMeta.hintRevealed = true;
      if (q.explanation) {
        detailMessage = `Visión Arcana: ${q.explanation}`;
      } else {
        const remainingWrong = q.options.filter((o) => o.id !== q.correctOptionId && !elim.includes(o.id));
        if (remainingWrong.length >= 2) {
          const w = remainingWrong[0];
          elim.push(w.id);
          detailMessage = `Visión Arcana descartó la opción ${w.id}.`;
        } else {
          detailMessage = 'Visión Arcana: analiza cuidadosamente las opciones restantes.';
        }
      }
    } else if (wildcardId === 'reroll_question') {
      const usedIds = new Set(state.questionQueue.map((item) => item.id));
      const alternative = state.bankPool.find((item) => !usedIds.has(item.id)) ||
        state.bankPool[Math.floor(Math.random() * state.bankPool.length)];
      if (alternative) {
        state.questionQueue[state.currentQuestionIndex] = alternative;
        this.prepareCurrentQuestionMeta(state);
        detailMessage = 'Cambio de Pergamino: pregunta sustituida.';
      }
    } else {
      throw new Error('Comodín desconocido.');
    }

    if (!unlimitedByFrenzy) {
      state.wildcardsRemaining -= 1;
    } else {
      detailMessage += ' (Gratis por estado Frenesí)';
    }

    state.eventsLog.push(detailMessage);
    await db.put('campaignState', state);
    return { state, detailMessage };
  }

  /**
   * Mago: Tirada de dado(s) del destino.
   */
  rollMageDice(state) {
    const count = state.unlockedLevels.includes(5) ? 2 : 1; // Nivel V: Doble destino
    const dice = [];
    for (let i = 0; i < count; i++) {
      const pick = MAGE_DICE_OUTCOMES[Math.floor(Math.random() * MAGE_DICE_OUTCOMES.length)];
      dice.push(pick);
    }
    return { dice, applied: false };
  }

  /**
   * Mago Nivel III (Reescritura del destino): Repite tirada una sola vez antes de aplicar efecto.
   */
  async rerollMageDice() {
    const state = await this.getActiveCampaign();
    if (!state || !state.pendingDiceRoll || state.pendingDiceRoll.applied) {
      throw new Error('No hay una tirada pendiente para repetir.');
    }
    if (!state.unlockedLevels.includes(3)) {
      throw new Error('Reescritura del destino no está desbloqueada.');
    }
    if (state.mageRerollUsed) {
      throw new Error('Ya utilizaste Reescritura del destino en esta campaña.');
    }

    state.mageRerollUsed = true;
    state.pendingDiceRoll = this.rollMageDice(state);
    state.eventsLog.push('Mago utilizó Reescritura del destino para repetir la tirada.');
    await db.put('campaignState', state);
    return state;
  }

  /**
   * Mago: Aplica exactamente UNO de los resultados del dado de forma discreta y sin duplicación.
   */
  async applyMageDiceOutcome(outcomeId) {
    const state = await this.getActiveCampaign();
    if (!state || !state.pendingDiceRoll || state.pendingDiceRoll.applied) {
      throw new Error('No hay tirada de dado válida pendiente.');
    }

    const chosen = state.pendingDiceRoll.dice.find((d) => d.id === outcomeId);
    if (!chosen) {
      throw new Error('Resultado de dado no válido para esta tirada.');
    }

    state.pendingDiceRoll.applied = true;
    state.pendingDiceRoll = null;

    let effectSummary = '';

    switch (chosen.id) {
      case 'x4_future_gold':
        state.activeEffects.x4FutureGold = true;
        effectSummary = 'Dado del destino: ¡Ganancias futuras de oro multiplicadas por ×4!';
        break;

      case 'skip_10': {
        const targetIdx = Math.min(state.totalQuestions, state.currentQuestionIndex + 10);
        const skipped = targetIdx - state.currentQuestionIndex;
        state.currentQuestionIndex = targetIdx;
        state.answeredCount += skipped;
        effectSummary = `Dado del destino: ¡Avanzas ${skipped} preguntas!`;
        if (state.currentQuestionIndex >= state.totalQuestions) {
          return await this.resolveCampaignEnd(state, 'victory', null, effectSummary);
        }
        this.prepareCurrentQuestionMeta(state);
        break;
      }

      case 'halve_remaining': {
        const remaining = state.totalQuestions - state.currentQuestionIndex;
        const newRemaining = Math.max(1, Math.ceil(remaining / 2));
        state.totalQuestions = state.currentQuestionIndex + newRemaining;
        state.questionQueue = state.questionQueue.slice(0, state.totalQuestions);
        effectSummary = `Dado del destino: Preguntas restantes reducidas a la mitad (${newRemaining} restantes).`;
        break;
      }

      case 'return_q1_keep_gold': {
        state.currentQuestionIndex = 0;
        const refreshed = buildExpandedQueue(state.bankPool, state.totalQuestions, state.order);
        state.questionQueue = refreshed;
        this.prepareCurrentQuestionMeta(state);
        effectSummary = `Dado del destino: Vuelves a la Pregunta 1 conservando tus ${state.campaignGold.toLocaleString('es-ES')} de oro.`;
        break;
      }

      case 'add_5_questions': {
        state.totalQuestions += 5;
        const extra = buildExpandedQueue(state.bankPool, 5, state.order);
        state.questionQueue.push(...extra);
        effectSummary = `Dado del destino: Se añadieron 5 preguntas adicionales (Total: ${state.totalQuestions}).`;
        break;
      }

      case 'draw_2_wildcards':
        state.wildcardsRemaining += 2;
        effectSummary = 'Dado del destino: ¡Robas +2 comodines!';
        break;
    }

    state.eventsLog.push(effectSummary);
    await db.put('campaignState', state);
    return { action: 'dice_applied', state, effectSummary };
  }

  /**
   * Evalúa si el estado Frenesí sigue vigente en este instante.
   */
  isFrenzyCurrentlyActive(state, settings) {
    if (!state?.frenzy?.active) return false;
    const mode = settings?.frenzyConfig?.durationMode || 'seconds';
    if (mode === 'seconds') {
      return Date.now() < (state.frenzy.expiresAt || 0);
    }
    return (state.frenzy.remainingQuestions || 0) > 0;
  }

  /**
   * Procesa la respuesta del jugador en Campaña (Sec. 7.3, 8, 9 y 13).
   */
  async submitCampaignAnswer(selectedOptionId, elapsedMs) {
    const state = await this.getActiveCampaign();
    if (!state) throw new Error('No hay campaña activa.');
    if (state.pendingDiceRoll && !state.pendingDiceRoll.applied) {
      throw new Error('Debes resolver primero los Dados del destino.');
    }

    const settings = await db.get('settings', 'global');
    const q = state.questionQueue[state.currentQuestionIndex];
    const isCorrect = selectedOptionId === q.correctOptionId;
    const safeElapsed = Math.max(0, Number(elapsedMs) || 0);

    // Registrar respuesta y estadísticas
    await db.put('answers', {
      id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runId: state.runId,
      questionId: q.id,
      selectedOptionId,
      correct: isCorrect,
      elapsedMs: safeElapsed,
      timestamp: new Date().toISOString()
    });

    await recordQuestionStatistics({
      subjectId: state.subjectId,
      documentId: q.documentId,
      questionId: q.id,
      isCorrect
    });

    // Regla firme de Frenesí (Sec. 7.3 & 15):
    // Responder antes de 150 segundos activa Frenesí automáticamente.
    // Tardar >= 150 segundos NO penaliza ni provoca derrota.
    const thresholdMs = Number(settings?.frenzyConfig?.thresholdSeconds ?? CONFIRMED_RULES.FRENZY_THRESHOLD_SECONDS) * 1000;
    let frenzyJustActivated = false;

    if (isCorrect && safeElapsed < thresholdMs) {
      frenzyJustActivated = !this.isFrenzyCurrentlyActive(state, settings);
      const durSec = Number(settings?.frenzyConfig?.durationSeconds ?? 90);
      const durQ = Number(settings?.frenzyConfig?.durationQuestions ?? 3);
      state.frenzy = {
        active: true,
        activatedAt: Date.now(),
        expiresAt: Date.now() + durSec * 1000,
        remainingQuestions: durQ
      };
    } else if (state.frenzy.active) {
      if (settings?.frenzyConfig?.durationMode === 'questions') {
        state.frenzy.remainingQuestions = Math.max(0, (state.frenzy.remainingQuestions || 0) - 1);
        if (state.frenzy.remainingQuestions === 0) state.frenzy.active = false;
      } else if (Date.now() >= (state.frenzy.expiresAt || 0)) {
        state.frenzy.active = false;
      }
    }

    const frenzyNowActive = this.isFrenzyCurrentlyActive(state, settings);

    if (!isCorrect) {
      // Ninja Nivel IV (Riesgo calculado): pierde los saltos acumulados al fallar
      if (state.classId === 'ninja' && state.unlockedLevels.includes(4)) {
        state.saltos = 0;
      }
      state.consecutiveCorrect = 0;
      return await this.resolveCampaignEnd(state, 'defeat', null, null, q);
    }

    // --- RESPUESTA CORRECTA ---
    state.answeredCount += 1;
    state.consecutiveCorrect += 1;

    // 1. Oro por pregunta correcta
    const goldGained = economyEngine.computeQuestionGold({
      classId: state.classId,
      unlockedLevels: state.unlockedLevels,
      activeEffects: state.activeEffects,
      frenzyActive: frenzyNowActive,
      settings
    });
    state.campaignGold += goldGained;

    // 2. Habilidad de Ninja (Saltos por racha)
    let ninjaSaltosGained = 0;
    if (state.classId === 'ninja') {
      const hasLv3 = state.unlockedLevels.includes(3);
      const streakNeeded = hasLv3 ? 2 : 3;
      const maxSaltos = state.unlockedLevels.includes(5) ? 6 : 4;
      if (state.consecutiveCorrect > 0 && state.consecutiveCorrect % streakNeeded === 0) {
        const before = state.saltos;
        state.saltos = Math.min(maxSaltos, state.saltos + 2);
        ninjaSaltosGained = state.saltos - before;
      }
    }

    // 3. Punto de control cada 5 preguntas (Sec. 9.2 y 9.3)
    const checkpointInfo = await this.checkAndApplyCheckpoint(state, frenzyNowActive, settings);

    // 4. Avanzar pregunta o completar campaña con victoria
    state.currentQuestionIndex += 1;

    if (state.currentQuestionIndex >= state.totalQuestions) {
      return await this.resolveCampaignEnd(state, 'victory', checkpointInfo, null, q, {
        goldGained,
        frenzyJustActivated,
        ninjaSaltosGained
      });
    }

    this.prepareCurrentQuestionMeta(state);
    await db.put('campaignState', state);

    return {
      action: 'answered_correct',
      isCorrect: true,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
      goldGained,
      frenzyJustActivated,
      frenzyActive: frenzyNowActive,
      ninjaSaltosGained,
      checkpointInfo,
      state
    };
  }

  async checkAndApplyCheckpoint(state, frenzyActive = false, settings = null) {
    if (state.answeredCount > 0 && state.answeredCount % CONFIRMED_RULES.CHECKPOINT_INTERVAL === 0) {
      if (!settings) settings = await db.get('settings', 'global');
      const cpBonus = economyEngine.computeCheckpointGold({
        classId: state.classId,
        unlockedLevels: state.unlockedLevels,
        activeEffects: state.activeEffects,
        frenzyActive,
        settings
      });
      state.campaignGold += cpBonus;
      state.securedGold = state.campaignGold;
      state.checkpointsReached += 1;
      state.eventsLog.push(`Punto de control #${state.checkpointsReached} alcanzado: +${cpBonus.toLocaleString('es-ES')} oro. Oro asegurado: ${state.securedGold.toLocaleString('es-ES')}.`);
      return {
        reached: true,
        checkpointNumber: state.checkpointsReached,
        bonusGold: cpBonus,
        securedGold: state.securedGold
      };
    }
    return { reached: false };
  }

  /**
   * Retirada voluntaria de la campaña (Sec. 8.4 y 9.3).
   */
  async retreatCampaign() {
    const state = await this.getActiveCampaign();
    if (!state) throw new Error('No hay campaña activa.');
    return await this.resolveCampaignEnd(state, 'retreat');
  }

  async resolveCampaignEnd(state, outcome, checkpointInfo = null, extraMessage = null, lastQuestion = null, turnMeta = {}) {
    state.status = outcome;
    const settlement = await economyEngine.settleCampaignEnd({
      outcome,
      classId: state.classId,
      campaignGold: state.campaignGold,
      securedGold: state.securedGold,
      unlockedLevels: state.unlockedLevels,
      activeEffects: state.activeEffects
    });

    const run = await db.get('runs', state.runId);
    if (run) {
      run.endedAt = new Date().toISOString();
      run.status = outcome;
      run.summary = settlement;
      await db.put('runs', run);
    }

    await db.put('campaignState', state);

    return {
      action: 'campaign_ended',
      outcome,
      isCorrect: outcome !== 'defeat',
      correctOptionId: lastQuestion?.correctOptionId || null,
      explanation: lastQuestion?.explanation || null,
      checkpointInfo,
      extraMessage,
      settlement,
      state,
      ...turnMeta
    };
  }
}

function buildExpandedQueue(bankPool, count, order) {
  const result = [];
  while (result.length < count) {
    const batch = order === 'aleatorio' ? shuffleArray(bankPool) : [...bankPool];
    result.push(...batch);
  }
  return result.slice(0, count);
}

export const campaignEngine = new CampaignEngine();
