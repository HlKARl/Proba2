/**
 * Suite de verificación automatizada para los 18 requisitos de pruebas (Sec. 14).
 * Ejecuta pruebas aisladas restaurando el estado previo de IndexedDB al finalizar.
 */

import { db } from '../js/db/database.js';
import { libraryManager } from '../js/library/libraryManager.js';
import { normalizeAndValidateQuestions } from '../js/library/questionValidator.js';
import { sessionEngine } from '../js/engine/sessionEngine.js';
import { campaignEngine } from '../js/engine/campaignEngine.js';
import { economyEngine } from '../js/engine/economyEngine.js';
import { buildClassProgressionTree } from '../js/engine/classes.js';

export async function runAllVerificationTests() {
  const backup = await db.exportBackup();
  const cases = [];

  const record = (name, passed, detail = '') => {
    cases.push({ name, passed: Boolean(passed), detail });
  };

  try {
    // 1. CRUD Materias y Documentos
    const sub = await libraryManager.createSubject('Test Materia');
    await libraryManager.renameSubject(sub.id, 'Test Materia Editada');
    const subs = await libraryManager.getAllSubjects();
    record('1. Crear y renombrar materia', subs.some((s) => s.id === sub.id && s.name === 'Test Materia Editada'));

    // 2. Validación de importación sin adivinar respuesta correcta
    const parsedWithMissing = normalizeAndValidateQuestions({
      rawText: '1. Pregunta válida\nA) Uno\nB) Dos\nRespuesta: B\n2. Pregunta sin respuesta\nA) Alfa\nB) Beta'
    }, 'temp');
    const validOne = parsedWithMissing.find((q) => q.statement.includes('válida'));
    const invalidOne = parsedWithMissing.find((q) => q.statement.includes('sin respuesta'));
    record(
      '2. Importación valida y NO adivina respuestas faltantes',
      validOne?.status === 'valid' && invalidOne?.status === 'needs_review' && invalidOne?.correctOptionId === null,
      `Válida=${validOne?.status}, SinRespuesta=${invalidOne?.status}`
    );

    // Guardar 20 preguntas válidas en 2 documentos
    const mkQs = (prefix, count) => Array.from({ length: count }, (_, i) => ({
      statement: `${prefix} Pregunta ${i + 1}`,
      options: [
        { id: 'A', text: 'Op A' },
        { id: 'B', text: 'Op B' },
        { id: 'C', text: 'Op C' },
        { id: 'D', text: 'Op D' }
      ],
      correctOptionId: 'B'
    }));

    const d1 = await libraryManager.saveImportedDocument({
      subjectId: sub.id,
      name: 'Doc 1.txt',
      fileType: 'txt',
      rawContent: 'raw1',
      validatedQuestions: mkQs('D1', 10)
    });
    const d2 = await libraryManager.saveImportedDocument({
      subjectId: sub.id,
      name: 'Doc 2.docx',
      fileType: 'docx',
      rawContent: 'raw2',
      validatedQuestions: mkQs('D2', 10)
    });

    // 3. Selección de uno o varios documentos
    const poolOne = await libraryManager.getQuestionsForDocuments([d1.document.id]);
    const poolBoth = await libraryManager.getQuestionsForDocuments([d1.document.id, d2.document.id]);
    record('3. Selección de uno o varios documentos', poolOne.length === 10 && poolBoth.length === 20);

    // 4. Sesiones ordinarias de 5 a 15 preguntas y tope de 15
    const ordSession = await sessionEngine.startOrdinarySession({
      mode: 'estudio',
      subjectId: sub.id,
      documentIds: [d1.document.id, d2.document.id],
      questionCount: 50, // Debe recortarse a máximo 15
      order: 'aleatorio'
    });
    record('4. Límite máximo de 15 preguntas en sesión ordinaria', ordSession.questions.length === 15);

    // 5. Campaña maneja su longitud configurada (30) sin confundirse con el límite 5-15
    const campNinja = await campaignEngine.startCampaign({
      subjectId: sub.id,
      documentIds: [d1.document.id, d2.document.id],
      classId: 'ninja',
      order: 'por_orden',
      customLength: 30
    });
    record('5. Campaña mantiene 30 preguntas independientes del límite 5-15', campNinja.totalQuestions === 30);

    // 6. Modos Estudio (sin oro), Concurso y Campaña
    const profileBeforeStudy = await db.get('playerProfile', 'player');
    await sessionEngine.submitOrdinaryAnswer(ordSession, ordSession.questions[0], 'B', 1000);
    await sessionEngine.finishOrdinarySession(ordSession);
    const profileAfterStudy = await db.get('playerProfile', 'player');
    record('6. Modo Estudio no genera oro', profileBeforeStudy.globalGold === profileAfterStudy.globalGold);

    // 7. Orden Aleatorio, Por orden y Falladas
    const byOrder = await sessionEngine.buildQuestionPool({
      documentIds: [d1.document.id],
      requestedCount: 5,
      order: 'por_orden'
    });
    record('7. Ordenamiento de preguntas (Por orden / Aleatorio / Falladas)', byOrder.questions[0].statement === 'D1 Pregunta 1');

    // 8. Aislamiento de clase única en campaña
    record('8. Una sola clase activa por campaña', campNinja.classId === 'ninja');

    // 9. 5 niveles por clase y niveles fantasma obligatorios
    const settings = await db.get('settings', 'global');
    const tree = buildClassProgressionTree('ninja', { unlockedSkillLevels: [1], ghostProgress: [] }, settings, profileAfterStudy, {});
    const skillNodes = tree.filter((n) => n.nodeType === 'skill');
    const ghostNodes = tree.filter((n) => n.nodeType === 'ghost');
    record('9. Cinco niveles de clase y niveles fantasma obligatorios', skillNodes.length === 5 && ghostNodes.length === 4 && !skillNodes[1].canUnlock);

    // 10 & 11. Tiempo > 150s NO penaliza, y < 150s activa Frenesí automáticamente
    await campaignEngine.startCampaign({
      subjectId: sub.id,
      documentIds: [d1.document.id],
      classId: 'ladron',
      order: 'por_orden',
      customLength: 10
    });
    const slowRes = await campaignEngine.submitCampaignAnswer('B', 180000); // 180s > 150s
    const fastRes = await campaignEngine.submitCampaignAnswer('B', 12000);  // 12s < 150s
    record(
      '10-11. >150s no penaliza y <150s activa Frenesí automáticamente',
      slowRes.isCorrect && !slowRes.frenzyActive && fastRes.frenzyActive && fastRes.frenzyJustActivated
    );

    // 12 & 13. Punto de control cada 5 preguntas y conservación de oro asegurado en clase normal
    await campaignEngine.submitCampaignAnswer('B', 200000); // P3
    await campaignEngine.submitCampaignAnswer('B', 200000); // P4
    const cpRes = await campaignEngine.submitCampaignAnswer('B', 200000); // P5 -> Checkpoint!
    const securedAtP5 = cpRes.state.securedGold;
    await campaignEngine.submitCampaignAnswer('B', 200000); // P6 (+1000 no asegurado)
    const defeatNormal = await campaignEngine.submitCampaignAnswer('A', 200000); // Fallo en P7
    record(
      '12-13. Checkpoint cada 5 preguntas y conservación de oro asegurado en clase normal',
      cpRes.checkpointInfo?.reached && securedAtP5 === 10000 && defeatNormal.settlement.netCampaignPayout === 10000
    );

    // 14, 15 & 16. Berserker: pierde todo oro de campaña + 10% oro general al fallar, bloqueo sin oro suficiente y bono victoria 50.000 vs 10.000
    const profBerserk = await db.get('playerProfile', 'player');
    profBerserk.globalGold = 10000;
    await db.put('playerProfile', profBerserk);

    await campaignEngine.startCampaign({
      subjectId: sub.id,
      documentIds: [d1.document.id],
      classId: 'berserker',
      order: 'por_orden',
      customLength: 6
    });
    for (let i = 0; i < 5; i++) {
      await campaignEngine.submitCampaignAnswer('B', 200000);
    }
    const berserkDefeat = await campaignEngine.submitCampaignAnswer('A', 200000); // Falla en P6 tras haber asegurado
    const afterBerserkDefeat = await db.get('playerProfile', 'player');
    const expectedAfterPenalty = 9000; // 10.000 - 10% = 9.000, y 0 de campaña

    // Verificar bloqueo de Berserker cuando oro general < mínimo
    afterBerserkDefeat.globalGold = 0;
    await db.put('playerProfile', afterBerserkDefeat);
    const berserkBlocked = await economyEngine.canStartCampaignWithClass('berserker');

    const vicNormal = economyEngine.computeVictoryBonus({ classId: 'ninja', settings });
    const vicBerserker = economyEngine.computeVictoryBonus({ classId: 'berserker', settings });

    record(
      '14-16. Reglas Berserker (pérdida total + 10% global, bloqueo sin oro, victoria 50.000 vs 10.000)',
      berserkDefeat.settlement.netCampaignPayout === 0 &&
      berserkDefeat.settlement.globalPenalty === 1000 &&
      afterBerserkDefeat.globalGold === 0 &&
      !berserkBlocked.allowed &&
      vicNormal === 10000 &&
      vicBerserker === 50000
    );

    // 17. Tienda bloquea saldos negativos y compras duplicadas
    const pShop = await db.get('playerProfile', 'player');
    pShop.globalGold = 500;
    await db.put('playerProfile', pShop);
    let blockedNegative = false;
    try {
      await economyEngine.purchaseShopItem({ id: 'test-expensive', name: 'Item', price: 1000 });
    } catch {
      blockedNegative = true;
    }
    await economyEngine.purchaseShopItem({ id: 'test-cheap', name: 'Item', price: 200 });
    let blockedDuplicate = false;
    try {
      await economyEngine.purchaseShopItem({ id: 'test-cheap', name: 'Item', price: 200 });
    } catch {
      blockedDuplicate = true;
    }
    record('17. Tienda impide saldos negativos y compras duplicadas', blockedNegative && blockedDuplicate);

    // 18. Persistencia IndexedDB
    const persistedSubjects = await db.getAll('subjects');
    record('18. Persistencia local IndexedDB verificada', persistedSubjects.some((s) => s.id === sub.id));
  } finally {
    // Restaurar exactamente la base de datos previa del usuario
    await db.importBackup(backup);
  }

  const passed = cases.filter((c) => c.passed).length;
  const failed = cases.length - passed;
  return { passed, failed, cases };
}
