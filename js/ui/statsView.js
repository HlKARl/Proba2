/**
 * Vista de Estadísticas de Rendimiento y Repaso de Preguntas Falladas (Sec. 10 y 12).
 */

import { db } from '../db/database.js';
import { formatGold } from '../config/defaults.js';
import { escapeHtml } from './libraryView.js';

export class StatsView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    const profile = await db.get('playerProfile', 'player');
    const stats = await db.get('statistics', 'global_stats');
    const subjects = await db.getAll('subjects');
    const allQuestions = await db.getAll('questions');

    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
    const wrongQuestions = (stats.wrongQuestionIds || [])
      .map((id) => questionMap.get(id))
      .filter(Boolean);

    container.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <h2 class="section-title" style="margin-bottom:0.85rem;">Progreso y Estadísticas</h2>

        <div class="grid-4">
          <div class="card" style="background:var(--bg-elevated); text-align:center;">
            <div class="muted">Oro General</div>
            <strong style="font-size:1.35rem; color:var(--gold-bright);">${formatGold(profile.globalGold)}</strong>
          </div>
          <div class="card" style="background:var(--bg-elevated); text-align:center;">
            <div class="muted">Precisión Global</div>
            <strong style="font-size:1.35rem; color:var(--arcane-bright);">${stats.accuracy || 0}%</strong>
          </div>
          <div class="card" style="background:var(--bg-elevated); text-align:center;">
            <div class="muted">Preguntas Respondidas</div>
            <strong style="font-size:1.35rem;">${stats.attempts || 0}</strong>
          </div>
          <div class="card" style="background:var(--bg-elevated); text-align:center;">
            <div class="muted">Campañas Ganadas</div>
            <strong style="font-size:1.35rem; color:var(--gold-bright);">${profile.aggregateStats?.campaignsWon || 0}</strong>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 class="section-title" style="font-size:1.05rem; margin-bottom:0.75rem;">Rendimiento por Materia</h3>
          ${Object.keys(stats.perSubject || {}).length === 0 ? `
            <p class="muted">Aún no hay actividad registrada por materia.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${Object.entries(stats.perSubject).map(([subId, data]) => {
                const acc = data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0;
                return `
                  <div class="doc-row">
                    <div>
                      <strong>${escapeHtml(subjectMap.get(subId) || 'Materia eliminada')}</strong>
                      <div class="muted" style="font-size:0.78rem;">${data.correct} aciertos de ${data.attempts} intentos</div>
                    </div>
                    <span class="badge badge-arcane">${acc}%</span>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="section-title" style="font-size:1.05rem;">Preguntas Falladas Pendientes (${wrongQuestions.length})</h3>
          </div>
          ${wrongQuestions.length === 0 ? `
            <p class="muted">¡Excelente! No tienes preguntas falladas pendientes de repaso.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:320px; overflow-y:auto;">
              ${wrongQuestions.map((q) => `
                <div style="padding:0.6rem; border-radius:var(--radius-sm); background:var(--bg-elevated); border-left:3px solid var(--crimson);">
                  <div style="font-size:0.86rem; font-weight:600;">${escapeHtml(q.statement)}</div>
                  <div class="muted" style="font-size:0.75rem; margin-top:0.2rem;">Materia: ${escapeHtml(subjectMap.get(q.subjectId) || '')}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }
}
