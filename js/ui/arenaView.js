/**
 * Arena de Juego (Sec. 11):
 * - Experiencia contenida en una pantalla (100dvh, sin scroll innecesario).
 * - Confirmación por doble pulsación sobre la opción con protección contra doble clic accidental,
 *   además de botón explícito de confirmación.
 * - Sin límite de tiempo global ni penalización por tardar > 150s; activación automática de Frenesí < 150s.
 * - Modal de Dados del destino para Mago en la pregunta 10.
 */

import { db } from '../db/database.js';
import { CONFIRMED_RULES, formatGold } from '../config/defaults.js';
import { CLASSES } from '../engine/classes.js';
import { sessionEngine } from '../engine/sessionEngine.js';
import { campaignEngine } from '../engine/campaignEngine.js';
import { escapeHtml } from './libraryView.js';

export class ArenaView {
  constructor(app) {
    this.app = app;
    this.ordinarySession = null;
    this.campaignState = null;

    this.selectedOptionId = null;
    this.selectedAtMs = 0;
    this.lockedAnswerResult = null;
    this.questionStartedAt = Date.now();
    this.timerInterval = null;
    this.endSummary = null;
  }

  startOrdinary(session) {
    this.ordinarySession = session;
    this.campaignState = null;
    this.endSummary = null;
    this.resetQuestionState();
  }

  startCampaign(state) {
    this.campaignState = state;
    this.ordinarySession = null;
    this.endSummary = null;
    this.resetQuestionState();
  }

  resetQuestionState() {
    this.selectedOptionId = null;
    this.selectedAtMs = 0;
    this.lockedAnswerResult = null;
    this.questionStartedAt = Date.now();
  }

  cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    document.body.classList.remove('in-arena');
  }

  async render(container) {
    document.body.classList.add('in-arena');

    if (this.endSummary) {
      document.body.classList.remove('in-arena');
      this.renderEndSummary(container);
      return;
    }

    if (this.campaignState) {
      await this.renderCampaignArena(container);
      return;
    }

    if (this.ordinarySession) {
      await this.renderOrdinaryArena(container);
      return;
    }

    document.body.classList.remove('in-arena');
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:2rem;">
        <h3 class="section-title">No hay partida en curso</h3>
        <button class="btn btn-primary" id="btn-arena-go-lib">Volver a Biblioteca</button>
      </div>
    `;
    container.querySelector('#btn-arena-go-lib')?.addEventListener('click', () => this.app.navigate('library'));
  }

  async renderOrdinaryArena(container) {
    const session = this.ordinarySession;
    const q = session.questions[session.currentIndex];
    const isLast = session.currentIndex >= session.questions.length - 1;
    const modeLabel = session.run.mode === 'estudio' ? '📖 Modo Estudio (Sin oro)' : '🏆 Modo Concurso';

    container.innerHTML = `
      <div class="arena-screen">
        <div class="arena-hud">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="badge badge-gold">${modeLabel}</span>
            <span class="badge">Pregunta ${session.currentIndex + 1} / ${session.questions.length}</span>
            ${session.notice ? `<span class="badge badge-frenzy" title="${escapeHtml(session.notice)}">Banco reducido: ${session.questions.length} preg.</span>` : ''}
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="muted" id="arena-elapsed" style="font-variant-numeric:tabular-nums;">⏱ 00:00</span>
            <button class="btn btn-sm btn-danger" id="btn-quit-ordinary">Salir</button>
          </div>
        </div>

        <div class="arena-body">
          <div class="question-box">
            <div class="muted" style="font-size:0.75rem; margin-bottom:0.3rem;">Pregunta ${session.currentIndex + 1} de ${session.questions.length}</div>
            <p class="question-statement">${escapeHtml(q.statement)}</p>
          </div>

          <div class="options-grid">
            ${q.options.map((opt) => this.renderOptionButton(opt)).join('')}
          </div>

          ${this.lockedAnswerResult ? `
            <div style="padding:0.65rem 0.9rem; border-radius:var(--radius-md); background:${this.lockedAnswerResult.isCorrect ? 'var(--arcane-dim)' : 'var(--crimson-dim)'}; border:1px solid ${this.lockedAnswerResult.isCorrect ? 'var(--arcane)' : 'var(--crimson)'};">
              <strong>${this.lockedAnswerResult.isCorrect ? '✓ ¡Respuesta correcta!' : `✕ Incorrecta (Correcta: ${this.lockedAnswerResult.correctOptionId})`}</strong>
              ${this.lockedAnswerResult.explanation ? `<div class="muted" style="margin-top:0.2rem; color:var(--text-primary);">${escapeHtml(this.lockedAnswerResult.explanation)}</div>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="arena-footer">
          <span class="muted" style="font-size:0.8rem;">
            ${this.lockedAnswerResult ? 'Pulsa Siguiente para continuar.' : 'Pulsa una opción para seleccionarla y vuelve a pulsarla (o usa Confirmar) para responder.'}
          </span>
          <div style="display:flex; gap:0.5rem;">
            ${!this.lockedAnswerResult ? `
              <button class="btn btn-primary" id="btn-confirm-answer" ${!this.selectedOptionId ? 'disabled' : ''}>Confirmar respuesta</button>
            ` : `
              <button class="btn btn-primary" id="btn-next-question">${isLast ? 'Finalizar sesión' : 'Siguiente pregunta →'}</button>
            `}
          </div>
        </div>
      </div>
    `;

    this.startElapsedTicker(container, false, 150);
    this.bindOrdinaryEvents(container);
  }

  async renderCampaignArena(container) {
    const state = this.campaignState;
    const settings = await db.get('settings', 'global');
    const cls = CLASSES[state.classId];
    const q = state.questionQueue[state.currentQuestionIndex];
    const meta = state.currentQuestionMeta || { eliminatedOptionIds: [], hintRevealed: false, autoLogs: [] };
    const frenzyActive = campaignEngine.isFrenzyCurrentlyActive(state, settings);
    const thresholdSec = Number(settings?.frenzyConfig?.thresholdSeconds ?? CONFIRMED_RULES.FRENZY_THRESHOLD_SECONDS);

    // Progreso de puntos de control cada 5 preguntas
    const totalSegs = Math.min(state.totalQuestions, 35);
    const segmentsHtml = Array.from({ length: totalSegs }, (_, i) => {
      const qNum = i + 1;
      const filled = i < state.currentQuestionIndex;
      const isCp = qNum % CONFIRMED_RULES.CHECKPOINT_INTERVAL === 0;
      return `<div class="cp-segment ${filled ? 'filled' : ''} ${isCp ? 'checkpoint-node' : ''}" title="P${qNum}${isCp ? ' (Punto de control)' : ''}"></div>`;
    }).join('');

    const blockIdx = Math.floor(state.currentQuestionIndex / 5);
    const canUseHurtoMayor = state.classId === 'ladron' &&
      state.unlockedLevels.includes(3) &&
      !state.hurtoMayorUsedBlocks.includes(blockIdx) &&
      !this.lockedAnswerResult;

    const unlimitedWildcards = frenzyActive && settings?.frenzyConfig?.effectType === 'unlimited_wildcards';

    container.innerHTML = `
      <div class="arena-screen">
        <!-- HUD Superior -->
        <div class="arena-hud">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <span class="badge badge-gold">⚔️ ${cls.name}</span>
            <span class="badge">P${state.currentQuestionIndex + 1} / ${state.totalQuestions}</span>
            <span class="badge badge-gold" title="Oro acumulado en esta campaña">Botín: ${formatGold(state.campaignGold)}</span>
            <span class="badge badge-arcane" title="Oro protegido cada 5 preguntas">Asegurado: ${formatGold(state.securedGold)}</span>
            ${state.classId === 'ninja' ? `<span class="badge" style="border-color:var(--arcane); color:var(--arcane-bright);">Racha: ${state.consecutiveCorrect} | Saltos: ${state.saltos}</span>` : ''}
            ${state.activeEffects.x4FutureGold ? `<span class="badge badge-gold">×4 Oro Activo</span>` : ''}
          </div>

          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            ${frenzyActive ? `<span class="badge badge-frenzy">🔥 FRENESÍ ACTIVO</span>` : ''}
            <span class="badge" id="arena-elapsed" title="Sin límite global. Responder antes de ${thresholdSec}s activa Frenesí automáticamente.">
              ⏱ 00:00 / ${formatSeconds(thresholdSec)}
            </span>
            <button class="btn btn-sm btn-danger" id="btn-retreat-campaign">Retirarse</button>
          </div>
        </div>

        <!-- Cuerpo Central: Enunciado y Opciones -->
        <div class="arena-body">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="muted" style="font-size:0.74rem; white-space:nowrap;">Checkpoints (c/5):</span>
            <div class="checkpoint-track">${segmentsHtml}</div>
          </div>

          ${meta.autoLogs && meta.autoLogs.length > 0 ? `
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
              ${meta.autoLogs.map((l) => `<span class="badge badge-arcane">✦ ${escapeHtml(l)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="question-box">
            <p class="question-statement">${escapeHtml(q.statement)}</p>
            ${meta.hintRevealed && q.explanation ? `
              <div style="margin-top:0.5rem; padding-top:0.45rem; border-top:1px dashed var(--border-arcane); font-size:0.84rem; color:var(--arcane-bright);">
                🔮 Pista: ${escapeHtml(q.explanation)}
              </div>
            ` : ''}
          </div>

          <div class="options-grid">
            ${q.options.map((opt) => this.renderOptionButton(opt, meta.eliminatedOptionIds.includes(opt.id))).join('')}
          </div>

          ${this.lockedAnswerResult ? `
            <div style="padding:0.6rem 0.85rem; border-radius:var(--radius-md); background:var(--arcane-dim); border:1px solid var(--arcane); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <strong>✓ ¡Correcto! +${formatGold(this.lockedAnswerResult.goldGained)} oro</strong>
                ${this.lockedAnswerResult.ninjaSaltosGained > 0 ? `<span class="badge badge-arcane" style="margin-left:0.4rem;">+${this.lockedAnswerResult.ninjaSaltosGained} Salto(s)</span>` : ''}
                ${this.lockedAnswerResult.checkpointInfo?.reached ? `<span class="badge badge-gold" style="margin-left:0.4rem;">🚩 Punto de control: +${formatGold(this.lockedAnswerResult.checkpointInfo.bonusGold)} (Asegurado: ${formatGold(this.lockedAnswerResult.checkpointInfo.securedGold)})</span>` : ''}
              </div>
              <button class="btn btn-primary btn-sm" id="btn-campaign-next">Siguiente →</button>
            </div>
          ` : ''}
        </div>

        <!-- Barra Inferior: Habilidades Activas, Comodines y Confirmación -->
        <div class="arena-footer">
          <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
            <span class="badge ${unlimitedWildcards ? 'badge-frenzy' : 'badge-gold'}">
              Comodines: ${unlimitedWildcards ? '∞ (Frenesí)' : state.wildcardsRemaining}
            </span>

            ${(settings?.wildcardConfig?.catalog || []).filter((w) => w.enabled).map((w) => {
              const isSacrificed = state.disabledWildcards.includes(w.id);
              const disabled = this.lockedAnswerResult || isSacrificed || (!unlimitedWildcards && state.wildcardsRemaining <= 0);
              return `
                <button class="btn btn-sm" data-use-wildcard="${w.id}" ${disabled ? 'disabled' : ''} title="${isSacrificed ? 'Bloqueado por sacrificio de clase' : escapeHtml(w.description)}">
                  ${escapeHtml(w.name)}
                </button>
              `;
            }).join('')}

            ${state.classId === 'ninja' && state.saltos > 0 && !this.lockedAnswerResult ? `
              <button class="btn btn-sm btn-arcane" id="btn-ninja-skip">⚡ Usar Salto (${state.saltos})</button>
            ` : ''}

            ${canUseHurtoMayor ? `
              <button class="btn btn-sm btn-arcane" id="btn-thief-greater">🗡 Hurto mayor (1/5)</button>
            ` : ''}
          </div>

          <div>
            ${!this.lockedAnswerResult ? `
              <button class="btn btn-primary" id="btn-confirm-campaign" ${!this.selectedOptionId ? 'disabled' : ''}>
                Confirmar respuesta
              </button>
            ` : `
              <button class="btn btn-primary" id="btn-campaign-next-footer">Siguiente pregunta →</button>
            `}
          </div>
        </div>
      </div>

      ${state.pendingDiceRoll && !state.pendingDiceRoll.applied ? this.renderMageDiceModal(state) : ''}
    `;

    this.startElapsedTicker(container, true, thresholdSec);
    this.bindCampaignEvents(container);
  }

  renderOptionButton(opt, isEliminated = false) {
    const isSelected = this.selectedOptionId === opt.id;
    let stateClass = '';
    if (isEliminated) {
      stateClass = 'eliminated';
    } else if (this.lockedAnswerResult) {
      stateClass = 'locked';
      if (opt.id === this.lockedAnswerResult.correctOptionId) stateClass += ' correct';
      else if (isSelected && !this.lockedAnswerResult.isCorrect) stateClass += ' wrong';
    } else if (isSelected) {
      stateClass = 'selected';
    }

    return `
      <button class="option-btn ${stateClass}" data-opt-id="${opt.id}" ${isEliminated || this.lockedAnswerResult ? 'disabled' : ''}>
        <span class="option-key">${opt.id}</span>
        <span style="flex:1;">${escapeHtml(opt.text)}</span>
        ${isSelected && !this.lockedAnswerResult && !isEliminated ? `<span class="tap-hint">Pulsa otra vez para confirmar</span>` : ''}
      </button>
    `;
  }

  renderMageDiceModal(state) {
    const dice = state.pendingDiceRoll.dice;
    const canReroll = state.unlockedLevels.includes(3) && !state.mageRerollUsed;
    return `
      <div class="modal-backdrop">
        <div class="modal-box" style="max-width:560px;">
          <div class="modal-header">
            <h3 class="section-title">🎲 Dados del Destino (Pregunta 10)</h3>
          </div>
          <div class="modal-body">
            <p class="muted" style="margin-top:0;">
              ${dice.length > 1
                ? 'Doble destino activo: elige cuál de los dos resultados deseas aplicar.'
                : 'El destino arcano ha dictado su resultado. Aplícalo para continuar la campaña.'}
            </p>
            <div style="display:flex; flex-direction:column; gap:0.65rem;">
              ${dice.map((d) => `
                <div class="card" style="border-color:var(--border-gold); padding:0.9rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                    <strong style="color:var(--gold-bright);">Dado #${d.face}: ${escapeHtml(d.title)}</strong>
                    <button class="btn btn-primary btn-sm" data-apply-dice="${d.id}">Aplicar resultado</button>
                  </div>
                  <p class="muted" style="margin:0; font-size:0.84rem;">${escapeHtml(d.description)}</p>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer" style="justify-content:space-between;">
            ${canReroll ? `
              <button class="btn btn-arcane" id="btn-mage-reroll">🔄 Reescritura del destino (Repetir tirada — 1 uso)</button>
            ` : `<span class="muted" style="font-size:0.78rem;">Cada resultado se aplica una única vez.</span>`}
          </div>
        </div>
      </div>
    `;
  }

  renderEndSummary(container) {
    const s = this.endSummary;
    if (s.isCampaign) {
      const st = s.settlement;
      const cls = CLASSES[st.classId];
      const titleMap = {
        victory: '🏆 ¡Campaña Completada con Victoria!',
        defeat: '💀 Derrota en Campaña',
        retreat: '🏳️ Retirada Voluntaria'
      };
      container.innerHTML = `
        <div class="card" style="max-width:680px; margin:1.5rem auto;">
          <h2 class="section-title" style="margin-bottom:0.35rem;">${titleMap[st.outcome] || 'Campaña Finalizada'}</h2>
          <p class="muted" style="margin-top:0;">Clase utilizada: <strong>${cls.name}</strong></p>

          <div class="grid-2" style="margin:1rem 0;">
            <div class="card" style="background:var(--bg-elevated);">
              <div class="muted">Oro acumulado en campaña</div>
              <strong style="font-size:1.3rem; color:var(--gold-bright);">${formatGold(st.campaignGoldEarned)}</strong>
            </div>
            <div class="card" style="background:var(--bg-elevated);">
              <div class="muted">Oro asegurado en checkpoints</div>
              <strong style="font-size:1.3rem; color:var(--arcane-bright);">${formatGold(st.securedGoldProtected)}</strong>
            </div>
            ${st.victoryBonus > 0 ? `
              <div class="card" style="background:var(--bg-elevated);">
                <div class="muted">Bono de victoria (${cls.name})</div>
                <strong style="font-size:1.3rem; color:var(--gold-bright);">+${formatGold(st.victoryBonus)}</strong>
              </div>
            ` : ''}
            ${st.globalPenalty > 0 ? `
              <div class="card" style="background:var(--crimson-dim); border-color:var(--crimson);">
                <div class="muted">Penalización Berserker (10% oro general)</div>
                <strong style="font-size:1.3rem; color:var(--crimson-bright);">-${formatGold(st.globalPenalty)}</strong>
              </div>
            ` : ''}
          </div>

          <div style="padding:0.85rem; border-radius:var(--radius-md); background:var(--gold-dim); border:1px solid var(--border-gold); margin-bottom:1rem;">
            <div><strong>Ganancia neta transferida:</strong> ${st.netCampaignPayout >= 0 ? '+' : ''}${formatGold(st.netCampaignPayout)} oro</div>
            <div style="margin-top:0.25rem;"><strong>Nuevo saldo de Oro General:</strong> <span style="color:var(--gold-bright); font-weight:700;">${formatGold(st.newGlobalGold)}</span></div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.65rem;">
            <button class="btn" id="btn-end-stats">Ver Estadísticas</button>
            <button class="btn btn-primary" id="btn-end-library">Volver a Biblioteca</button>
          </div>
        </div>
      `;
    } else {
      const mLabel = s.mode === 'estudio' ? 'Modo Estudio' : 'Modo Concurso';
      container.innerHTML = `
        <div class="card" style="max-width:620px; margin:1.5rem auto;">
          <h2 class="section-title" style="margin-bottom:0.35rem;">Resumen de ${mLabel}</h2>
          <div class="grid-3" style="margin:1rem 0;">
            <div class="card" style="background:var(--bg-elevated); text-align:center;">
              <div class="muted">Aciertos</div>
              <strong style="font-size:1.4rem; color:var(--arcane-bright);">${s.correctCount} / ${s.total}</strong>
            </div>
            <div class="card" style="background:var(--bg-elevated); text-align:center;">
              <div class="muted">Precisión</div>
              <strong style="font-size:1.4rem; color:var(--gold-bright);">${s.accuracy}%</strong>
            </div>
            <div class="card" style="background:var(--bg-elevated); text-align:center;">
              <div class="muted">Oro generado</div>
              <strong style="font-size:1.4rem;">0</strong>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.65rem;">
            <button class="btn" id="btn-end-stats">Ver Estadísticas</button>
            <button class="btn btn-primary" id="btn-end-library">Volver a Biblioteca</button>
          </div>
        </div>
      `;
    }

    container.querySelector('#btn-end-library')?.addEventListener('click', () => {
      this.endSummary = null;
      this.app.navigate('library');
    });
    container.querySelector('#btn-end-stats')?.addEventListener('click', () => {
      this.endSummary = null;
      this.app.navigate('stats');
    });
  }

  startElapsedTicker(container, isCampaign, thresholdSec) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const update = () => {
      const el = container.querySelector('#arena-elapsed');
      if (!el) return;
      const elapsedSec = Math.floor((Date.now() - this.questionStartedAt) / 1000);
      if (isCampaign) {
        const eligible = elapsedSec < thresholdSec;
        el.textContent = `⏱ ${formatSeconds(elapsedSec)} ${eligible ? `(< ${formatSeconds(thresholdSec)} Frenesí)` : '(Sin Frenesí)'}`;
        el.style.borderColor = eligible ? 'var(--border-arcane)' : 'var(--border-subtle)';
      } else {
        el.textContent = `⏱ ${formatSeconds(elapsedSec)}`;
      }
    };
    update();
    this.timerInterval = setInterval(update, 500);
  }

  handleOptionClick(optId, onConfirmCallback) {
    if (this.lockedAnswerResult) return;
    const now = Date.now();
    // Doble pulsación sobre la misma opción con protección anti-doble-clic accidental (>= 220ms)
    if (this.selectedOptionId === optId) {
      if (now - this.selectedAtMs >= 220) {
        onConfirmCallback();
      }
      return;
    }
    this.selectedOptionId = optId;
    this.selectedAtMs = now;
    this.app.refresh();
  }

  bindOrdinaryEvents(container) {
    const confirmOrdinary = async () => {
      if (!this.selectedOptionId || this.lockedAnswerResult) return;
      const session = this.ordinarySession;
      const q = session.questions[session.currentIndex];
      const elapsedMs = Date.now() - this.questionStartedAt;
      this.lockedAnswerResult = await sessionEngine.submitOrdinaryAnswer(session, q, this.selectedOptionId, elapsedMs);
      this.app.refresh();
    };

    container.querySelectorAll('[data-opt-id]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleOptionClick(btn.dataset.optId, confirmOrdinary));
    });

    container.querySelector('#btn-confirm-answer')?.addEventListener('click', confirmOrdinary);

    container.querySelector('#btn-next-question')?.addEventListener('click', async () => {
      const session = this.ordinarySession;
      if (session.currentIndex + 1 >= session.questions.length) {
        const summary = await sessionEngine.finishOrdinarySession(session);
        this.ordinarySession = null;
        this.endSummary = { isCampaign: false, ...summary };
        this.cleanup();
        this.app.refresh();
      } else {
        session.currentIndex += 1;
        this.resetQuestionState();
        this.app.refresh();
      }
    });

    container.querySelector('#btn-quit-ordinary')?.addEventListener('click', async () => {
      const ok = await this.app.confirmDialog('Abandonar sesión', '¿Deseas salir de la partida actual?');
      if (!ok) return;
      this.ordinarySession = null;
      this.cleanup();
      this.app.navigate('library');
    });
  }

  bindCampaignEvents(container) {
    const confirmCampaign = async () => {
      if (!this.selectedOptionId || this.lockedAnswerResult) return;
      const elapsedMs = Date.now() - this.questionStartedAt;
      try {
        const res = await campaignEngine.submitCampaignAnswer(this.selectedOptionId, elapsedMs);
        if (res.action === 'campaign_ended') {
          this.campaignState = null;
          this.endSummary = { isCampaign: true, ...res };
          this.cleanup();
          await this.app.updateTopbarGold();
          this.app.refresh();
          return;
        }
        this.campaignState = res.state;
        this.lockedAnswerResult = res;
        if (res.frenzyJustActivated) {
          this.app.showToast('🔥 ¡FRENESÍ ACTIVADO automáticamente (< 150s)!', 'frenzy');
        }
        if (res.checkpointInfo?.reached) {
          this.app.showToast(`🚩 Punto de control: +${formatGold(res.checkpointInfo.bonusGold)} oro asegurado.`, 'arcane');
        }
        this.app.refresh();
      } catch (err) {
        this.app.showToast(err.message, 'danger');
      }
    };

    container.querySelectorAll('[data-opt-id]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleOptionClick(btn.dataset.optId, confirmCampaign));
    });

    container.querySelector('#btn-confirm-campaign')?.addEventListener('click', confirmCampaign);

    const goNext = () => {
      this.resetQuestionState();
      this.app.refresh();
    };
    container.querySelector('#btn-campaign-next')?.addEventListener('click', goNext);
    container.querySelector('#btn-campaign-next-footer')?.addEventListener('click', goNext);

    container.querySelectorAll('[data-use-wildcard]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await campaignEngine.useWildcard(btn.dataset.useWildcard);
          this.campaignState = res.state;
          this.app.showToast(res.detailMessage, 'arcane');
          this.app.refresh();
        } catch (err) {
          this.app.showToast(err.message, 'danger');
        }
      });
    });

    container.querySelector('#btn-ninja-skip')?.addEventListener('click', async () => {
      try {
        const res = await campaignEngine.useNinjaSkip();
        if (res.action === 'campaign_ended') {
          this.campaignState = null;
          this.endSummary = { isCampaign: true, ...res };
          this.cleanup();
          await this.app.updateTopbarGold();
          this.app.refresh();
          return;
        }
        this.campaignState = res.state;
        this.resetQuestionState();
        this.app.showToast('⚡ Salto Ninja ejecutado.', 'arcane');
        this.app.refresh();
      } catch (err) {
        this.app.showToast(err.message, 'danger');
      }
    });

    container.querySelector('#btn-thief-greater')?.addEventListener('click', async () => {
      try {
        const res = await campaignEngine.useThiefGreaterSteal();
        this.campaignState = res.state;
        this.app.showToast(`🗡 Hurto mayor eliminó la opción ${res.eliminatedId}.`, 'arcane');
        this.app.refresh();
      } catch (err) {
        this.app.showToast(err.message, 'danger');
      }
    });

    container.querySelector('#btn-mage-reroll')?.addEventListener('click', async () => {
      try {
        this.campaignState = await campaignEngine.rerollMageDice();
        this.app.showToast('🔄 Tirada repetida con Reescritura del destino.', 'arcane');
        this.app.refresh();
      } catch (err) {
        this.app.showToast(err.message, 'danger');
      }
    });

    container.querySelectorAll('[data-apply-dice]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await campaignEngine.applyMageDiceOutcome(btn.dataset.applyDice);
          if (res.action === 'campaign_ended') {
            this.campaignState = null;
            this.endSummary = { isCampaign: true, ...res };
            this.cleanup();
            await this.app.updateTopbarGold();
            this.app.refresh();
            return;
          }
          this.campaignState = res.state;
          this.resetQuestionState();
          this.app.showToast(res.effectSummary, 'gold');
          this.app.refresh();
        } catch (err) {
          this.app.showToast(err.message, 'danger');
        }
      });
    });

    container.querySelector('#btn-retreat-campaign')?.addEventListener('click', async () => {
      const state = this.campaignState;
      const isBerserker = state.classId === 'berserker';
      const warning = isBerserker
        ? 'ADVERTENCIA BERSERKER: Si te retiras ahora perderás TODO el oro de esta campaña, incluido el oro asegurado.'
        : `Si te retiras ahora conservarás tu oro asegurado (${formatGold(state.securedGold)}) y perderás el oro no asegurado.`;
      const ok = await this.app.confirmDialog('Retirarse de la Campaña', warning);
      if (!ok) return;

      const res = await campaignEngine.retreatCampaign();
      this.campaignState = null;
      this.endSummary = { isCampaign: true, ...res };
      this.cleanup();
      await this.app.updateTopbarGold();
      this.app.refresh();
    });
  }
}

function formatSeconds(totalSec) {
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
