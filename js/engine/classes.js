/**
 * Definición de las 4 clases RPG de Proba, sus 5 niveles de habilidad,
 * sacrificios permanentes, nodos de niveles fantasma y Dados del destino (Sec. 7 y 8).
 */

export const CLASSES = {
  ninja: {
    id: 'ninja',
    name: 'Ninja',
    roleTag: 'Agilidad y Evasión',
    summary: 'Acumula saltos mediante rachas de aciertos para omitir preguntas difíciles sin romper su avance.',
    isBerserker: false,
    levels: [
      {
        level: 1,
        name: 'Paso veloz',
        type: 'skill',
        description: 'Después de 3 respuestas correctas consecutivas, obtiene 2 saltos. Un salto permite omitir una pregunta según las reglas de campaña.'
      },
      {
        level: 2,
        name: 'Desapego',
        type: 'sacrifice',
        description: 'Sacrificio: comienza la campaña con 1 comodín menos.'
      },
      {
        level: 3,
        name: 'Reflejos',
        type: 'skill',
        description: 'Después de 2 respuestas correctas consecutivas, obtiene 2 saltos.'
      },
      {
        level: 4,
        name: 'Riesgo calculado',
        type: 'sacrifice',
        description: 'Sacrificio: al responder incorrectamente, pierde todos los saltos acumulados.'
      },
      {
        level: 5,
        name: 'Maestro de sombras',
        type: 'skill',
        description: 'Aumenta la capacidad máxima de acumulación de saltos hasta un máximo de 6.'
      }
    ]
  },

  ladron: {
    id: 'ladron',
    name: 'Ladrón',
    roleTag: 'Sabotaje y Precisión',
    summary: 'Descarta alternativas incorrectas automáticamente en cada pregunta a cambio de sacrificar comodines.',
    isBerserker: false,
    levels: [
      {
        level: 1,
        name: 'Hurto menor',
        type: 'skill',
        description: 'Elimina automáticamente una alternativa incorrecta en cada pregunta sin pulsar ningún botón.'
      },
      {
        level: 2,
        name: 'Codicia',
        type: 'sacrifice',
        description: 'Sacrificio: comienza la campaña con 1 comodín menos.'
      },
      {
        level: 3,
        name: 'Hurto mayor',
        type: 'skill',
        description: 'Una vez por cada bloque de 5 preguntas, permite eliminar una segunda alternativa incorrecta.'
      },
      {
        level: 4,
        name: 'Juego peligroso',
        type: 'sacrifice',
        description: 'Sacrificio: no dispone del comodín 50/50 durante la campaña.'
      },
      {
        level: 5,
        name: 'Maestro del engaño',
        type: 'skill',
        description: 'Elimina automáticamente una segunda alternativa incorrecta en cada pregunta sin consumir usos adicionales.'
      }
    ]
  },

  mago: {
    id: 'mago',
    name: 'Mago',
    roleTag: 'Alteración del Destino',
    summary: 'Invoca los Dados del destino en la pregunta 10 para alterar el oro, las preguntas o los comodines.',
    isBerserker: false,
    levels: [
      {
        level: 1,
        name: 'Dados del destino',
        type: 'skill',
        description: 'En la pregunta 10 se realiza una tirada de dado con 6 resultados especiales.'
      },
      {
        level: 2,
        name: 'Pacto arcano',
        type: 'sacrifice',
        description: 'Sacrificio: comienza la campaña con 1 comodín menos.'
      },
      {
        level: 3,
        name: 'Reescritura del destino',
        type: 'skill',
        description: 'Puede repetir una tirada de dado una vez por campaña antes de aplicar el efecto.'
      },
      {
        level: 4,
        name: 'Expansión arcana',
        type: 'skill',
        description: 'La campaña recibe 5 preguntas adicionales.'
      },
      {
        level: 5,
        name: 'Doble destino',
        type: 'skill',
        description: 'Lanza dos dados y permite elegir cuál de los dos resultados aplicar.'
      }
    ]
  },

  berserker: {
    id: 'berserker',
    name: 'Berserker',
    roleTag: 'Riesgo Extremo y Recompensa',
    summary: 'Multiplica el oro obtenido hasta ×4 y recibe 50.000 al ganar, pero pierde todo al fallar o retirarse más 10% del oro general si falla.',
    isBerserker: true,
    levels: [
      {
        level: 1,
        name: 'Furia creciente',
        type: 'skill',
        description: 'Multiplica por 2 el oro obtenido en campaña.'
      },
      {
        level: 2,
        name: 'Sed de sangre',
        type: 'sacrifice',
        description: 'Sacrificio: comienza la campaña con 1 comodín menos.'
      },
      {
        level: 3,
        name: 'Furia desatada',
        type: 'skill',
        description: 'Multiplica por 3 el oro obtenido en campaña.'
      },
      {
        level: 4,
        name: 'Sin retirada',
        type: 'sacrifice',
        description: 'Sacrificio: si se retira voluntariamente de la campaña, pierde todo el oro acumulado en esa campaña, incluso el asegurado.'
      },
      {
        level: 5,
        name: 'Furia absoluta',
        type: 'skill',
        description: 'Multiplica por 4 el oro obtenido y otorga la recompensa máxima de victoria (50.000 oro).'
      }
    ]
  }
};

export const GHOST_NODE_ORDER = ['ghost_1_2', 'ghost_2_3', 'ghost_3_4', 'ghost_4_5'];

export const MAGE_DICE_OUTCOMES = [
  {
    id: 'x4_future_gold',
    face: 1,
    title: 'Alquimia Suprema (×4 Oro)',
    description: 'Multiplica por cuatro (×4) las ganancias futuras de oro en esta campaña.'
  },
  {
    id: 'skip_10',
    face: 2,
    title: 'Salto Dimensional (+10 Preguntas)',
    description: 'Avanza 10 preguntas directamente hacia el final de la campaña.'
  },
  {
    id: 'halve_remaining',
    face: 3,
    title: 'Compresión Temporal (Mitad Restante)',
    description: 'Reduce a la mitad las preguntas restantes de la campaña.'
  },
  {
    id: 'return_q1_keep_gold',
    face: 4,
    title: 'Bucle Cronológico (Volver a P1)',
    description: 'Vuelve a la pregunta 1 conservando todo el oro obtenido y asegurado.'
  },
  {
    id: 'add_5_questions',
    face: 5,
    title: 'Fisura de Conocimiento (+5 Preguntas)',
    description: 'Añade 5 preguntas adicionales a la campaña actual.'
  },
  {
    id: 'draw_2_wildcards',
    face: 6,
    title: 'Reserva Arcana (+2 Comodines)',
    description: 'Otorga 2 comodines adicionales inmediatamente.'
  }
];

/**
 * Evalúa si un nodo fantasma puede completarse bajo la configuración actual.
 */
export function evaluateGhostNodeEligibility(ghostConfig, profile, stats) {
  if (!ghostConfig || ghostConfig.conditionType === 'none' || !ghostConfig.targetValue) {
    return { eligible: true, reason: 'Paso de progresión listo para completar (sin coste configurado).' };
  }
  const val = Number(ghostConfig.targetValue) || 0;
  if (ghostConfig.conditionType === 'questions_answered') {
    const current = stats?.attempts || 0;
    return {
      eligible: current >= val,
      reason: `Requiere ${val} preguntas respondidas (actual: ${current}).`
    };
  }
  if (ghostConfig.conditionType === 'campaigns_completed') {
    const current = profile?.aggregateStats?.campaignsWon || 0;
    return {
      eligible: current >= val,
      reason: `Requiere ${val} campañas ganadas (actual: ${current}).`
    };
  }
  if (ghostConfig.conditionType === 'gold_tribute') {
    const current = profile?.globalGold || 0;
    return {
      eligible: current >= val,
      reason: `Requiere tributo de ${val} oro general (disponible: ${current}).`
    };
  }
  return { eligible: true, reason: 'Paso configurable disponible.' };
}

/**
 * Construye la secuencia lineal de 9 nodos (5 niveles de clase intercalados con 4 niveles fantasma).
 */
export function buildClassProgressionTree(classId, classProgress, settings, profile, stats) {
  const cls = CLASSES[classId];
  if (!cls) throw new Error(`Clase desconocida: ${classId}`);

  const unlockedLevels = new Set(classProgress?.unlockedSkillLevels || [1]);
  const completedGhosts = new Set(classProgress?.ghostProgress || []);
  const ghostConfigs = settings?.campaignConfig?.ghostNodes || {};

  const nodes = [];
  for (let lvl = 1; lvl <= 5; lvl++) {
    const skillDef = cls.levels[lvl - 1];
    const isUnlocked = unlockedLevels.has(lvl);
    const prevGhostId = lvl > 1 ? `ghost_${lvl - 1}_${lvl}` : null;
    const canUnlock = !isUnlocked && lvl > 1 && unlockedLevels.has(lvl - 1) && completedGhosts.has(prevGhostId);

    nodes.push({
      nodeType: 'skill',
      id: `skill_${lvl}`,
      level: lvl,
      name: skillDef.name,
      skillCategory: skillDef.type,
      description: skillDef.description,
      unlocked: isUnlocked,
      canUnlock,
      lockReason: !isUnlocked && !canUnlock
        ? `Debes completar primero el Nivel Fantasma ${lvl - 1} → ${lvl}.`
        : null
    });

    if (lvl < 5) {
      const ghostId = `ghost_${lvl}_${lvl + 1}`;
      const gCfg = ghostConfigs[ghostId] || { label: `Nivel Fantasma ${lvl} → ${lvl + 1}`, conditionType: 'none', targetValue: 0 };
      const isGhostDone = completedGhosts.has(ghostId);
      const elig = evaluateGhostNodeEligibility(gCfg, profile, stats);
      const canCompleteGhost = !isGhostDone && isUnlocked && elig.eligible;

      nodes.push({
        nodeType: 'ghost',
        id: ghostId,
        fromLevel: lvl,
        toLevel: lvl + 1,
        name: gCfg.label || `Nivel Fantasma ${lvl} → ${lvl + 1}`,
        description: 'Nivel fantasma obligatorio: no entrega habilidad directa, pero desbloquea el siguiente nivel de clase.',
        conditionText: elig.reason,
        conditionType: gCfg.conditionType,
        targetValue: Number(gCfg.targetValue) || 0,
        unlocked: isGhostDone,
        canUnlock: canCompleteGhost,
        lockReason: !isUnlocked
          ? `Desbloquea primero el Nivel ${lvl}.`
          : (!elig.eligible ? elig.reason : null)
      });
    }
  }

  return nodes;
}
