/**
 * Motor centralizado de economía, oro, multiplicadores, puntos de control y tienda (Sec. 9 y 16).
 * Garantiza cálculo único sin duplicaciones ni saldos negativos.
 */

import { db } from '../db/database.js';
import { CONFIRMED_RULES } from '../config/defaults.js';

export class EconomyEngine {
  /**
   * Calcula el multiplicador activo de oro según clase, niveles desbloqueados,
   * efectos de dado del Mago y Frenesí (si está configurado con bono de oro).
   */
  calculateGoldMultiplier({ classId, unlockedLevels = [], activeEffects = {}, frenzyActive = false, settings }) {
    let multiplier = 1;

    // Multiplicadores de Berserker (Sec. 8.4: I -> x2, III -> x3, V -> x4)
    if (classId === 'berserker') {
      const levels = new Set(unlockedLevels);
      if (levels.has(5)) multiplier *= 4;
      else if (levels.has(3)) multiplier *= 3;
      else if (levels.has(1)) multiplier *= 2;
    }

    // Multiplicador del dado del Mago (Sec. 8.3: x4 ganancias futuras)
    if (activeEffects?.x4FutureGold) {
      multiplier *= 4;
    }

    // Parámetro configurable de Frenesí (Sec. 7.3 & 16)
    if (frenzyActive && settings?.frenzyConfig?.effectType === 'gold_bonus_50') {
      multiplier *= 1.5;
    }

    return multiplier;
  }

  /**
   * Calcula oro ganado por responder correctamente una pregunta en campaña.
   */
  computeQuestionGold(context) {
    const mult = this.calculateGoldMultiplier(context);
    return Math.round(CONFIRMED_RULES.REWARD_CORRECT_QUESTION * mult);
  }

  /**
   * Calcula oro ganado al alcanzar un punto de control cada 5 preguntas.
   */
  computeCheckpointGold(context) {
    const mult = this.calculateGoldMultiplier(context);
    return Math.round(CONFIRMED_RULES.REWARD_CHECKPOINT * mult);
  }

  /**
   * Calcula el bono de victoria de campaña (una sola vez).
   */
  computeVictoryBonus({ classId, unlockedLevels = [], activeEffects = {}, settings }) {
    const isBerserker = classId === 'berserker';
    const baseBonus = isBerserker
      ? CONFIRMED_RULES.REWARD_VICTORY_BERSERKER
      : CONFIRMED_RULES.REWARD_VICTORY_NORMAL;

    // Sec. 16: Validar si el bono de 50.000 del Berserker se multiplica o se suma aparte
    if (isBerserker && settings?.economyConfig?.multiplyBerserkerVictoryBonus) {
      const mult = this.calculateGoldMultiplier({ classId, unlockedLevels, activeEffects, settings });
      return Math.round(baseBonus * mult);
    }

    return baseBonus;
  }

  /**
   * Verifica si el usuario puede iniciar campaña con la clase elegida (Sec. 8.4 Berserker).
   */
  async canStartCampaignWithClass(classId) {
    if (classId !== 'berserker') {
      return { allowed: true, reason: null };
    }
    const profile = await db.get('playerProfile', 'player');
    const settings = await db.get('settings', 'global');
    const minRequired = Number(settings?.economyConfig?.berserkerMinGlobalGold ?? CONFIRMED_RULES.INITIAL_GLOBAL_GOLD);
    const currentGold = Number(profile?.globalGold ?? 0);

    if (currentGold < minRequired || currentGold <= 0) {
      return {
        allowed: false,
        reason: `El Berserker requiere al menos ${minRequired.toLocaleString('es-ES')} de oro general para asumir el riesgo de derrota (tienes ${currentGold.toLocaleString('es-ES')}).`
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * Liquida el oro al finalizar una campaña (victoria, derrota o retirada voluntaria).
   * Reglas firmes (Sec. 8.4, 9.2, 9.3, 9.4):
   * - Clases normales:
   *   * Victoria: gana todo campaignGold + bono victoria (10.000).
   *   * Derrota: pierde oro no asegurado, conserva securedGold.
   *   * Retirada: pierde oro no asegurado, conserva securedGold.
   * - Berserker:
   *   * Victoria: gana todo campaignGold + bono victoria (50.000).
   *   * Derrota: pierde TODO el oro de campaña (incluso asegurado) Y pierde 10% del oro general.
   *   * Retirada: pierde TODO el oro de campaña (incluso asegurado), sin penalizar oro general.
   */
  async settleCampaignEnd({ outcome, classId, campaignGold, securedGold, unlockedLevels = [], activeEffects = {} }) {
    const profile = await db.get('playerProfile', 'player');
    const settings = await db.get('settings', 'global');
    const prevGlobal = Number(profile.globalGold || 0);

    let netCampaignPayout = 0;
    let victoryBonus = 0;
    let globalPenalty = 0;

    if (outcome === 'victory') {
      victoryBonus = this.computeVictoryBonus({ classId, unlockedLevels, activeEffects, settings });
      netCampaignPayout = Number(campaignGold || 0) + victoryBonus;
      profile.aggregateStats.campaignsWon = (profile.aggregateStats.campaignsWon || 0) + 1;
    } else if (outcome === 'defeat') {
      profile.aggregateStats.campaignsFailed = (profile.aggregateStats.campaignsFailed || 0) + 1;
      if (classId === 'berserker') {
        netCampaignPayout = 0;
        globalPenalty = Math.floor(prevGlobal * CONFIRMED_RULES.BERSERKER_DEFEAT_GLOBAL_PENALTY_RATE);
      } else {
        netCampaignPayout = Number(securedGold || 0);
      }
    } else if (outcome === 'retreat') {
      profile.aggregateStats.campaignsRetreated = (profile.aggregateStats.campaignsRetreated || 0) + 1;
      if (classId === 'berserker') {
        // Sec. 8.4 & 9.3: Berserker pierde todo el oro acumulado en campaña al retirarse, incluso el asegurado
        netCampaignPayout = 0;
      } else {
        netCampaignPayout = Number(securedGold || 0);
      }
    }

    const newGlobalGold = Math.max(0, prevGlobal + netCampaignPayout - globalPenalty);
    profile.globalGold = newGlobalGold;
    profile.aggregateStats.totalRuns = (profile.aggregateStats.totalRuns || 0) + 1;

    await db.put('playerProfile', profile);

    return {
      outcome,
      classId,
      previousGlobalGold: prevGlobal,
      campaignGoldEarned: Number(campaignGold || 0),
      securedGoldProtected: Number(securedGold || 0),
      victoryBonus,
      netCampaignPayout,
      globalPenalty,
      newGlobalGold
    };
  }

  /**
   * Ajusta oro general directamente (ej. tributo de nivel fantasma configurable o ajustes).
   */
  async adjustGlobalGold(delta) {
    const profile = await db.get('playerProfile', 'player');
    const next = Math.max(0, Number(profile.globalGold || 0) + Number(delta || 0));
    profile.globalGold = next;
    await db.put('playerProfile', profile);
    return next;
  }

  /**
   * Compra segura en tienda (Sec. 9.5 y 14: impide saldos negativos y compras duplicadas).
   */
  async purchaseShopItem(item) {
    if (!item || !item.id || typeof item.price !== 'number' || item.price < 0) {
      throw new Error('Artículo de tienda inválido.');
    }
    const profile = await db.get('playerProfile', 'player');
    const owned = new Set(profile.ownedShopItems || []);

    if (owned.has(item.id)) {
      throw new Error('Este artículo ya fue adquirido (compra duplicada bloqueada).');
    }

    if (profile.globalGold < item.price) {
      throw new Error('Oro general insuficiente para realizar esta compra.');
    }

    profile.globalGold -= item.price;
    owned.add(item.id);
    profile.ownedShopItems = [...owned];
    await db.put('playerProfile', profile);

    return {
      purchasedItemId: item.id,
      remainingGold: profile.globalGold
    };
  }
}

export const economyEngine = new EconomyEngine();
