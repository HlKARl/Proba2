/**
 * Vista de Configuración Universal de Sesión, Selección de Modo (Estudio, Concurso, Campaña)
 * y Árbol de Clase RPG + Niveles Fantasma (Sec. 6, 7 y 8).
 */

import { db } from '../db/database.js';
import { CONFIRMED_RULES, formatGold } from '../config/defaults.js';
import { libraryManager } from '../library/libraryManager.js';
import { CLASSES, buildClassProgressionTree } from '../engine/classes.js';
import { economyEngine } from '../engine/economyEngine.js';
import { escapeHtml } from './libraryView.js';

export class SessionSetupView {
  constructor(app) {
    this.app = app;
    this.selectedMode = 'estudio';
    this.questionOrder = 'aleatorio';
    this.ordinaryCount = 10;
    this.selectedClassId = 'ninja';
  }

  async render(container, params = {}) {
    const subjectId = params.subjectId;
    const documentIds = params.documentIds || [];

    if (!subjectId || documentIds.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:2rem;">
          <h3 class="section-title">No has seleccionado documentos</h3>
          <p class="muted">Ve a la Biblioteca, selecciona una materia y marca al menos un documento para iniciar.</p>
          <button class="btn btn-primary" id="btn-back-lib">Ir a Biblioteca</button>
        </div>
      `;
      container.querySelector('#btn-back-lib')?.addEventListener('click', () => this.app.navigate('library'));
      return;
    }

    const subject = await db.get('subjects', subjectId);
    const settings = await db.get('settings', 'global');
    const profile = await db.get('playerProfile', 'player');
    const stats = await db.get('statistics', 'global_stats');
    const bankQuestions = await libraryManager.getQuestionsForDocuments(documentIds);

    const wrongSet = new Set(stats?.wrongQuestionIds || []);
    const failedInBankCount = bankQuestions.filter((q) => wrongSet.has(q.id)).length;

    const classProgress = await db.get('classProgress', this.selectedClassId);
    const progressionTree = buildClassProgressionTree(this.selectedClassId, classProgress, settings, profile, stats);
    const berserkerCheck = await economyEngine.canStartCampaignWithClass('berserker');

    const baseCampaignLen = Number(settings?.campaignConfig?.campaignQuestionCount || 30);
    const effectiveCampaignLen = (this.selectedClassId === 'mago' && (classProgress?.unlockedSkillLevels || []).includes(4))
      ? baseCampaignLen + 5
      : baseCampaignLen;

    container.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header">
          <div>
            <h2 class="section-title">Configurar Sesión</h2>
            <p class="muted" style="margin:0.15rem 0 0;">
              Materia: <strong>${escapeHtml(subject?.name || '')}</strong> ·
              ${documentIds.length} documento(s) ·
              <strong>${bankQuestions.length} preguntas disponibles</strong>
            </p>
          </div>
          <button class="btn btn-sm" id="btn-setup-back">← Cambiar documentos</button>
        </div>

        <!-- Selector de Modo (Sec. 6.3) -->
        <div class="form-group">
          <label class="form-label">1. Modalidad de juego</label>
          <div class="grid-3">
            <div class="class-card ${this.selectedMode === 'estudio' ? 'selected' : ''}" data-mode="estudio">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>📖 Modo Estudio</strong>
                <span class="badge">Sin oro</span>
              </div>
              <p class="muted" style="margin:0; font-size:0.82rem;">Repaso centrado en el aprendizaje con explicaciones inmediatas. No genera oro.</p>
            </div>

            <div class="class-card ${this.selectedMode === 'concurso' ? 'selected' : ''}" data-mode="concurso">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>🏆 Modo Concurso</strong>
                <span class="badge badge-arcane">Evaluativo</span>
              </div>
              <p class="muted" style="margin:0; font-size:0.82rem;">Partida evaluativa de 5 a 15 preguntas con puntuación, precisión y resultado final.</p>
            </div>

            <div class="class-card ${this.selectedMode === 'campana' ? 'selected' : ''}" data-mode="campana">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>⚔️ Campaña RPG</strong>
                <span class="badge badge-gold">Oro + Clases</span>
              </div>
              <p class="muted" style="margin:0; font-size:0.82rem;">Elige una clase, supera puntos de control cada 5 preguntas, activa Frenesí y arriesga tu botín.</p>
            </div>
          </div>
        </div>

        <!-- Orden y Cantidad de Preguntas (Sec. 6.2 y 6.4) -->
        <div class="grid-2" style="margin-top:0.85rem;">
          <div class="form-group">
            <label class="form-label">2. Orden de preguntas</label>
            <select class="select" id="sel-order">
              <option value="aleatorio" ${this.questionOrder === 'aleatorio' ? 'selected' : ''}>Aleatorio (mezcla el banco seleccionado)</option>
              <option value="por_orden" ${this.questionOrder === 'por_orden' ? 'selected' : ''}>Por orden (respeta el orden original)</option>
              <option value="falladas" ${this.questionOrder === 'falladas' ? 'selected' : ''}>Falladas (${failedInBankCount} falladas previamente en este banco)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">3. Cantidad de preguntas</label>
            ${this.selectedMode === 'campana' ? `
              <div style="padding:0.5rem 0.75rem; background:var(--bg-obsidian); border:1px solid var(--border-gold); border-radius:var(--radius-sm);">
                <strong>${effectiveCampaignLen} preguntas</strong>
                <span class="muted" style="font-size:0.8rem;">
                  (Duración base configurable: ${baseCampaignLen}${effectiveCampaignLen > baseCampaignLen ? ' + 5 por Expansión arcana' : ''})
                </span>
              </div>
            ` : `
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <input type="range" id="rng-count" min="${CONFIRMED_RULES.ORDINARY_MIN_QUESTIONS}" max="${CONFIRMED_RULES.ORDINARY_MAX_QUESTIONS}" value="${this.ordinaryCount}" style="flex:1; accent-color:var(--gold);" />
                <span class="badge badge-gold" style="font-size:0.9rem;">${this.ordinaryCount} preguntas</span>
              </div>
              <div class="muted" style="font-size:0.78rem; margin-top:0.25rem;">
                Rango confirmado para sesiones ordinarias: 5 a 15 preguntas.
                ${bankQuestions.length < this.ordinaryCount ? `<br><span style="color:var(--frenzy-bright);">Aviso: el banco tiene ${bankQuestions.length} pregunta(s); se usarán todas las disponibles.</span>` : ''}
              </div>
            `}
          </div>
        </div>
      </div>

      ${this.selectedMode === 'campana' ? `
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-header">
            <div>
              <h3 class="section-title" style="font-size:1.08rem;">4. Selección de Clase RPG (1 clase por campaña)</h3>
              <p class="muted" style="margin:0.15rem 0 0;">Las clases son intercambiables antes de iniciar cada campaña. No se pueden combinar habilidades de distintas clases.</p>
            </div>
            <span class="badge badge-gold">Oro general: ${formatGold(profile.globalGold)}</span>
          </div>

          <div class="grid-4" style="margin-bottom:1rem;">
            ${Object.values(CLASSES).map((cls) => {
              const isSelected = this.selectedClassId === cls.id;
              const isBerserkerLocked = cls.id === 'berserker' && !berserkerCheck.allowed;
              return `
                <div class="class-card ${isSelected ? 'selected' : ''} ${isBerserkerLocked ? 'locked' : ''}" data-class-id="${cls.id}">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:1.02rem; color:${cls.id === 'berserker' ? 'var(--crimson-bright)' : 'var(--gold-bright)'};">${cls.name}</strong>
                    <span class="badge">${cls.roleTag}</span>
                  </div>
                  <p class="muted" style="margin:0; font-size:0.8rem;">${cls.summary}</p>
                  ${isBerserkerLocked ? `<div style="font-size:0.75rem; color:var(--crimson-bright);">⚠ ${escapeHtml(berserkerCheck.reason)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Árbol de 5 niveles y Niveles Fantasma obligatorios (Sec. 7.2 y 8) -->
          <div style="border-top:1px solid var(--border-subtle); padding-top:0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem; flex-wrap:wrap; gap:0.5rem;">
              <strong>Progresión de ${CLASSES[this.selectedClassId].name} (5 Niveles + Niveles Fantasma obligatorios)</strong>
              <span class="muted" style="font-size:0.78rem;">Los requisitos de niveles fantasma son configurables en Ajustes.</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.45rem;">
              ${progressionTree.map((node) => {
                if (node.nodeType === 'ghost') {
                  return `
                    <div class="skill-node ghost">
                      <div>
                        <div style="display:flex; align-items:center; gap:0.45rem;">
                          <span class="badge" style="border-color:var(--royal); color:#c4b5fd;">👻 ${escapeHtml(node.name)}</span>
                          ${node.unlocked ? `<span class="badge badge-arcane">Completado</span>` : `<span class="badge">Paso obligatorio</span>`}
                        </div>
                        <div class="muted" style="font-size:0.78rem; margin-top:0.2rem;">${escapeHtml(node.description)} (${escapeHtml(node.conditionText)})</div>
                      </div>
                      ${!node.unlocked ? `
                        <button class="btn btn-sm" data-unlock-ghost="${node.id}" ${node.canUnlock ? '' : 'disabled'} title="${escapeHtml(node.lockReason || '')}">
                          Completar paso
                        </button>
                      ` : ''}
                    </div>
                  `;
                }

                return `
                  <div class="skill-node ${node.unlocked ? 'unlocked' : ''} ${node.skillCategory === 'sacrifice' ? 'sacrifice' : ''}">
                    <div>
                      <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                        <strong>Nivel ${romanNumeral(node.level)}: ${escapeHtml(node.name)}</strong>
                        ${node.skillCategory === 'sacrifice' ? `<span class="badge badge-danger">Sacrificio permanente</span>` : `<span class="badge badge-gold">Habilidad</span>`}
                        ${node.unlocked ? `<span class="badge badge-arcane">Activo</span>` : ''}
                      </div>
                      <div class="muted" style="font-size:0.8rem; margin-top:0.2rem;">${escapeHtml(node.description)}</div>
                    </div>
                    ${!node.unlocked ? `
                      <button class="btn btn-sm btn-primary" data-unlock-skill="${node.level}" ${node.canUnlock ? '' : 'disabled'} title="${escapeHtml(node.lockReason || '')}">
                        Desbloquear Nivel ${romanNumeral(node.level)}
                      </button>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
        <button class="btn btn-primary" id="btn-start-session" ${this.selectedMode === 'campana' && this.selectedClassId === 'berserker' && !berserkerCheck.allowed ? 'disabled' : ''}>
          ${this.selectedMode === 'campana' ? `Iniciar Campaña con ${CLASSES[this.selectedClassId].name} ⚔️` : `Comenzar ${this.selectedMode === 'estudio' ? 'Estudio' : 'Concurso'} →`}
        </button>
      </div>
    `;

    this.bindEvents(container, subjectId, documentIds, settings, profile);
  }

  bindEvents(container, subjectId, documentIds, settings, profile) {
    container.querySelector('#btn-setup-back')?.addEventListener('click', () => this.app.navigate('library'));

    container.querySelectorAll('[data-mode]').forEach((card) => {
      card.addEventListener('click', () => {
        this.selectedMode = card.dataset.mode;
        this.app.refresh();
      });
    });

    container.querySelector('#sel-order')?.addEventListener('change', (e) => {
      this.questionOrder = e.target.value;
      this.app.refresh();
    });

    container.querySelector('#rng-count')?.addEventListener('input', (e) => {
      this.ordinaryCount = Number(e.target.value);
      this.app.refresh();
    });

    container.querySelectorAll('[data-class-id]').forEach((card) => {
      card.addEventListener('click', () => {
        this.selectedClassId = card.dataset.classId;
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-unlock-ghost]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ghostId = btn.dataset.unlockGhost;
        const gCfg = settings?.campaignConfig?.ghostNodes?.[ghostId];
        if (gCfg?.conditionType === 'gold_tribute' && Number(gCfg.targetValue) > 0) {
          await economyEngine.adjustGlobalGold(-Number(gCfg.targetValue));
        }
        const cp = await db.get('classProgress', this.selectedClassId);
        if (!cp.ghostProgress.includes(ghostId)) {
          cp.ghostProgress.push(ghostId);
          await db.put('classProgress', cp);
        }
        this.app.showToast('Nivel fantasma completado.', 'arcane');
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-unlock-skill]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const lvl = Number(btn.dataset.unlockSkill);
        const cp = await db.get('classProgress', this.selectedClassId);
        if (!cp.unlockedSkillLevels.includes(lvl)) {
          cp.unlockedSkillLevels.push(lvl);
          cp.unlockedSkillLevels.sort((a, b) => a - b);
          await db.put('classProgress', cp);
        }
        this.app.showToast(`Nivel ${romanNumeral(lvl)} desbloqueado para ${CLASSES[this.selectedClassId].name}.`, 'arcane');
        this.app.refresh();
      });
    });

    container.querySelector('#btn-start-session')?.addEventListener('click', async () => {
      try {
        if (this.selectedMode === 'campana') {
          await this.app.startCampaignRun({
            subjectId,
            documentIds,
            classId: this.selectedClassId,
            order: this.questionOrder
          });
        } else {
          await this.app.startOrdinaryRun({
            mode: this.selectedMode,
            subjectId,
            documentIds,
            questionCount: this.ordinaryCount,
            order: this.questionOrder
          });
        }
      } catch (err) {
        this.app.showToast(err.message, 'danger');
      }
    });
  }
}

function romanNumeral(n) {
  return ['I', 'II', 'III', 'IV', 'V'][n - 1] || String(n);
}
