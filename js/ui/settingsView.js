/**
 * Vista de Configuración y Parámetros Configurables (Sec. 1, 7.2, 7.3, 14 y 16).
 * Expone los parámetros marcados como POR CONFIRMAR / PENDIENTE DE PARAMETRIZACIÓN
 * sin inventar reglas ocultas, además de respaldo JSON y suite de pruebas automatizadas.
 */

import { db } from '../db/database.js';
import { DEFAULT_SETTINGS, CONFIRMED_RULES } from '../config/defaults.js';
import { runAllVerificationTests } from '../../tests/verificationSuite.js';
import { escapeHtml } from './libraryView.js';

export class SettingsView {
  constructor(app) {
    this.app = app;
    this.testResults = null;
  }

  async render(container) {
    const settings = await db.get('settings', 'global');
    const ghostNodes = settings.campaignConfig.ghostNodes;

    container.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header">
          <div>
            <h2 class="section-title">Parámetros Configurables y Reglas del Sistema</h2>
            <p class="muted" style="margin:0.15rem 0 0;">
              Configura los parámetros pendientes de confirmación (Sec. 16) sin alterar las reglas firmes de Proba.
            </p>
          </div>
          <button class="btn btn-sm" id="btn-reset-settings">Restaurar valores por defecto</button>
        </div>

        <div class="grid-2">
          <!-- Duración de Campaña & Economía -->
          <div class="card" style="background:var(--bg-elevated);">
            <h3 class="section-title" style="font-size:1rem; margin-bottom:0.75rem;">Campaña y Economía</h3>

            <div class="form-group">
              <label class="form-label">Duración base de Campaña (preguntas — Por confirmar, 30 previas)</label>
              <input type="number" id="cfg-camp-len" class="input" min="5" max="200" value="${settings.campaignConfig.campaignQuestionCount}" />
            </div>

            <div class="form-group">
              <label class="form-label">Oro general mínimo requerido para Berserker</label>
              <input type="number" id="cfg-berserker-min" class="input" min="0" step="500" value="${settings.economyConfig.berserkerMinGlobalGold}" />
            </div>

            <div class="form-group">
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                <input type="checkbox" id="cfg-berserker-mult-vic" ${settings.economyConfig.multiplyBerserkerVictoryBonus ? 'checked' : ''} />
                <span>Aplicar multiplicador de Furia también al bono de victoria de 50.000</span>
              </label>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label">Cantidad inicial de Comodines (antes de sacrificios -1)</label>
              <input type="number" id="cfg-wildcards-init" class="input" min="0" max="10" value="${settings.wildcardConfig.initialCount}" />
            </div>
          </div>

          <!-- Frenesí -->
          <div class="card" style="background:var(--bg-elevated);">
            <h3 class="section-title" style="font-size:1rem; margin-bottom:0.75rem;">Estado Frenesí</h3>

            <div class="form-group">
              <label class="form-label">Umbral de activación automática (Regla firme: &lt; 150 segundos)</label>
              <input type="number" class="input" value="${CONFIRMED_RULES.FRENZY_THRESHOLD_SECONDS}" disabled />
              <span class="muted" style="font-size:0.76rem;">No existe límite global ni penalización por superar este tiempo.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Efecto de Frenesí (Por confirmar)</label>
              <select id="cfg-frenzy-effect" class="select">
                <option value="unlimited_wildcards" ${settings.frenzyConfig.effectType === 'unlimited_wildcards' ? 'selected' : ''}>Comodines ilimitados (propuesta previa)</option>
                <option value="gold_bonus_50" ${settings.frenzyConfig.effectType === 'gold_bonus_50' ? 'selected' : ''}>Bonificación +50% oro durante Frenesí</option>
                <option value="visual_only" ${settings.frenzyConfig.effectType === 'visual_only' ? 'selected' : ''}>Solo activación de estado (pendiente de efecto final)</option>
              </select>
            </div>

            <div class="grid-2">
              <div class="form-group" style="margin:0;">
                <label class="form-label">Modo de duración</label>
                <select id="cfg-frenzy-dur-mode" class="select">
                  <option value="seconds" ${settings.frenzyConfig.durationMode === 'seconds' ? 'selected' : ''}>Segundos</option>
                  <option value="questions" ${settings.frenzyConfig.durationMode === 'questions' ? 'selected' : ''}>Preguntas</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label">Valor de duración (90s / 3 preg.)</label>
                <input type="number" id="cfg-frenzy-dur-val" class="input" min="1" max="600" value="${settings.frenzyConfig.durationMode === 'seconds' ? settings.frenzyConfig.durationSeconds : settings.frenzyConfig.durationQuestions}" />
              </div>
            </div>
          </div>
        </div>

        <!-- Nodos de Niveles Fantasma Configurables (Sec. 7.2 y 16) -->
        <div class="card" style="background:var(--bg-elevated); margin-top:1rem;">
          <h3 class="section-title" style="font-size:1rem; margin-bottom:0.35rem;">Nodos de Niveles Fantasma (Parametrización)</h3>
          <p class="muted" style="margin:0 0 0.75rem; font-size:0.82rem;">
            Configura las condiciones de cada paso fantasma obligatorio entre niveles de clase. Por defecto no tienen coste inventado.
          </p>
          <div class="grid-2">
            ${Object.entries(ghostNodes).map(([gId, gCfg]) => `
              <div style="padding:0.65rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
                <strong>${escapeHtml(gCfg.label)}</strong>
                <div class="grid-2" style="margin-top:0.45rem;">
                  <select class="select" data-ghost-type="${gId}">
                    <option value="none" ${gCfg.conditionType === 'none' ? 'selected' : ''}>Sin requisito (libre)</option>
                    <option value="questions_answered" ${gCfg.conditionType === 'questions_answered' ? 'selected' : ''}>Preguntas respondidas</option>
                    <option value="campaigns_completed" ${gCfg.conditionType === 'campaigns_completed' ? 'selected' : ''}>Campañas ganadas</option>
                    <option value="gold_tribute" ${gCfg.conditionType === 'gold_tribute' ? 'selected' : ''}>Tributo de oro general</option>
                  </select>
                  <input type="number" class="input" min="0" data-ghost-val="${gId}" value="${gCfg.targetValue || 0}" placeholder="Valor" />
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
          <button class="btn btn-primary" id="btn-save-settings">Guardar Configuración</button>
        </div>
      </div>

      <!-- Respaldo Offline y Suite de Verificación (Sec. 14) -->
      <div class="grid-2">
        <div class="card">
          <h3 class="section-title" style="font-size:1rem; margin-bottom:0.4rem;">Respaldo Local (IndexedDB JSON)</h3>
          <p class="muted" style="font-size:0.82rem;">Exporta o restaura tus materias, bancos de preguntas, oro y progreso de clase sin depender de servidores.</p>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem;">
            <button class="btn btn-arcane" id="btn-export-backup">Exportar Respaldo (.json)</button>
            <label class="btn" style="cursor:pointer;">
              Importar Respaldo (.json)
              <input type="file" id="inp-import-backup" accept=".json" style="display:none;" />
            </label>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title" style="font-size:1rem; margin-bottom:0.4rem;">Diagnóstico y Requisitos de Pruebas (Sec. 14)</h3>
          <p class="muted" style="font-size:0.82rem;">Verifica automáticamente las 18 reglas críticas del motor de importación, sesiones, clases y economía.</p>
          <button class="btn btn-primary" id="btn-run-tests" style="margin-top:0.5rem;">Ejecutar Suite de Verificación</button>

          ${this.testResults ? `
            <div style="margin-top:0.85rem; max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:0.35rem;">
              <div class="badge ${this.testResults.failed === 0 ? 'badge-arcane' : 'badge-danger'}">
                Resultado: ${this.testResults.passed} pasaron / ${this.testResults.failed} fallaron
              </div>
              ${this.testResults.cases.map((tc) => `
                <div style="font-size:0.8rem; padding:0.35rem 0.55rem; border-radius:4px; background:var(--bg-elevated); border-left:3px solid ${tc.passed ? 'var(--arcane)' : 'var(--crimson)'};">
                  <strong>${tc.passed ? '✓' : '✕'} ${escapeHtml(tc.name)}</strong>
                  ${tc.detail ? `<div class="muted" style="font-size:0.74rem;">${escapeHtml(tc.detail)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.bindEvents(container, settings);
  }

  bindEvents(container, settings) {
    container.querySelector('#btn-save-settings')?.addEventListener('click', async () => {
      settings.campaignConfig.campaignQuestionCount = Math.max(5, Number(container.querySelector('#cfg-camp-len').value) || 30);
      settings.economyConfig.berserkerMinGlobalGold = Math.max(0, Number(container.querySelector('#cfg-berserker-min').value) || 0);
      settings.economyConfig.multiplyBerserkerVictoryBonus = container.querySelector('#cfg-berserker-mult-vic').checked;
      settings.wildcardConfig.initialCount = Math.max(0, Number(container.querySelector('#cfg-wildcards-init').value) || 0);

      settings.frenzyConfig.effectType = container.querySelector('#cfg-frenzy-effect').value;
      const durMode = container.querySelector('#cfg-frenzy-dur-mode').value;
      const durVal = Math.max(1, Number(container.querySelector('#cfg-frenzy-dur-val').value) || 90);
      settings.frenzyConfig.durationMode = durMode;
      if (durMode === 'seconds') settings.frenzyConfig.durationSeconds = durVal;
      else settings.frenzyConfig.durationQuestions = durVal;

      container.querySelectorAll('[data-ghost-type]').forEach((sel) => {
        const gId = sel.dataset.ghostType;
        settings.campaignConfig.ghostNodes[gId].conditionType = sel.value;
      });
      container.querySelectorAll('[data-ghost-val]').forEach((inp) => {
        const gId = inp.dataset.ghostVal;
        settings.campaignConfig.ghostNodes[gId].targetValue = Math.max(0, Number(inp.value) || 0);
      });

      await db.put('settings', settings);
      this.app.showToast('Parámetros guardados correctamente.', 'arcane');
      this.app.refresh();
    });

    container.querySelector('#btn-reset-settings')?.addEventListener('click', async () => {
      await db.put('settings', structuredClone(DEFAULT_SETTINGS));
      this.app.showToast('Configuración restaurada por defecto.');
      this.app.refresh();
    });

    container.querySelector('#btn-export-backup')?.addEventListener('click', async () => {
      const dump = await db.exportBackup();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proba-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.app.showToast('Respaldo JSON descargado.', 'arcane');
    });

    container.querySelector('#inp-import-backup')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const dump = JSON.parse(text);
        await db.importBackup(dump);
        await this.app.updateTopbarGold();
        this.app.showToast('Respaldo restaurado exitosamente.', 'arcane');
        this.app.refresh();
      } catch (err) {
        this.app.showToast(err.message, 'danger');
      }
    });

    container.querySelector('#btn-run-tests')?.addEventListener('click', async () => {
      this.testResults = await runAllVerificationTests();
      await this.app.updateTopbarGold();
      this.app.showToast(`Suite ejecutada: ${this.testResults.passed} pruebas exitosas.`, this.testResults.failed === 0 ? 'arcane' : 'danger');
      this.app.refresh();
    });
  }
}
