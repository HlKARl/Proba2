/**
 * Configuración por defecto y parámetros configurables de Proba.
 * Las reglas firmes de la especificación se respetan estrictamente;
 * los puntos marcados como POR CONFIRMAR / PENDIENTE se exponen como
 * parámetros configurables sin inventar reglas ocultas.
 */

export const SCHEMA_VERSION = 1;

export const CONFIRMED_RULES = Object.freeze({
  ORDINARY_MIN_QUESTIONS: 5,
  ORDINARY_MAX_QUESTIONS: 15,
  CHECKPOINT_INTERVAL: 5,
  FRENZY_THRESHOLD_SECONDS: 150,
  REWARD_CORRECT_QUESTION: 1000,
  REWARD_CHECKPOINT: 5000,
  REWARD_VICTORY_NORMAL: 10000,
  REWARD_VICTORY_BERSERKER: 50000,
  BERSERKER_DEFEAT_GLOBAL_PENALTY_RATE: 0.10,
  INITIAL_GLOBAL_GOLD: 1000
});

export const DEFAULT_SETTINGS = {
  id: 'global',
  schemaVersion: SCHEMA_VERSION,
  sessionDefaults: {
    ordinaryQuestionCount: 10, // Rango válido: 5 a 15
    defaultMode: 'estudio',    // 'estudio' | 'concurso' | 'campana'
    questionOrder: 'aleatorio', // 'aleatorio' | 'por_orden' | 'falladas'
    doubleTapConfirm: true,
    doubleTapMinDelayMs: 220   // Protección contra doble clic accidental
  },
  campaignConfig: {
    // POR CONFIRMAR (Sec. 6.2 & 16): Duración configurable, 30 registrada en versión previa
    campaignQuestionCount: 30,
    // Nodos de niveles fantasma configurables (Sec. 7.2 & 16: no inventar costes obligatorios)
    ghostNodes: {
      ghost_1_2: { label: 'Nivel Fantasma I → II', conditionType: 'none', targetValue: 0, description: 'Paso de progresión configurable' },
      ghost_2_3: { label: 'Nivel Fantasma II → III', conditionType: 'none', targetValue: 0, description: 'Paso de progresión configurable' },
      ghost_3_4: { label: 'Nivel Fantasma III → IV', conditionType: 'none', targetValue: 0, description: 'Paso de progresión configurable' },
      ghost_4_5: { label: 'Nivel Fantasma IV → V', conditionType: 'none', targetValue: 0, description: 'Paso de progresión configurable' }
    }
  },
  frenzyConfig: {
    // Regla firme: < 150 segundos activa Frenesí automáticamente; >= 150s no penaliza
    thresholdSeconds: 150,
    // POR CONFIRMAR (Sec. 7.3 & 16): Efecto y duración configurables
    effectType: 'unlimited_wildcards', // 'unlimited_wildcards' | 'gold_bonus_50' | 'visual_only'
    durationMode: 'seconds',           // 'seconds' | 'questions'
    durationSeconds: 90,
    durationQuestions: 3
  },
  wildcardConfig: {
    // POR CONFIRMAR (Sec. 2 & 16): Catálogo y cantidad inicial configurables
    initialCount: 3,
    catalog: [
      {
        id: 'fifty_fifty',
        name: 'Comodín 50/50',
        description: 'Elimina hasta la mitad de las alternativas incorrectas disponibles.',
        enabled: true
      },
      {
        id: 'reveal_hint',
        name: 'Visión Arcana (Pista)',
        description: 'Muestra la explicación o descarta una opción errónea adicional.',
        enabled: true
      },
      {
        id: 'reroll_question',
        name: 'Cambio de Pergamino',
        description: 'Sustituye la pregunta actual por otra del banco seleccionado sin perder progreso.',
        enabled: true
      }
    ]
  },
  economyConfig: {
    initialGlobalGold: 1000,
    // Sec. 8.4: Si el usuario no tiene oro general suficiente, no puede iniciar campaña con Berserker
    berserkerMinGlobalGold: 1000,
    // Sec. 16: Validar si el bono de 50.000 se multiplica o se suma aparte (por defecto se suma aparte)
    multiplyBerserkerVictoryBonus: false
  },
  shopConfig: {
    // Sec. 9.5 & 16: Catálogo pendiente de confirmación; no inventar artículos ficticios
    catalogConfirmed: false,
    customItems: []
  }
};

export const DEFAULT_PLAYER_PROFILE = {
  id: 'player',
  globalGold: CONFIRMED_RULES.INITIAL_GLOBAL_GOLD,
  createdAt: new Date().toISOString(),
  ownedShopItems: [],
  aggregateStats: {
    totalRuns: 0,
    campaignsWon: 0,
    campaignsFailed: 0,
    campaignsRetreated: 0,
    totalQuestionsAnswered: 0,
    totalCorrect: 0
  }
};

export const DEFAULT_STATISTICS = {
  id: 'global_stats',
  perSubject: {},
  perDocument: {},
  accuracy: 0,
  attempts: 0,
  correctCount: 0,
  wrongQuestionIds: []
};

export function formatGold(amount) {
  const num = Math.floor(Number(amount) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
