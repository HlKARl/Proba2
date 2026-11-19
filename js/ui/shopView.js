/**
 * Sección de Tienda separada de la lógica de campaña (Sec. 9.5 y 16).
 * No inventa artículos ni precios ficticios pendientes de confirmación;
 * protege contra saldos negativos y compras duplicadas.
 */

import { db } from '../db/database.js';
import { formatGold } from '../config/defaults.js';
import { economyEngine } from '../engine/economyEngine.js';
import { escapeHtml } from './libraryView.js';

export class ShopView {
  constructor(app) {
    this.app = app;
  }

  async render(container) {
    const profile = await db.get('playerProfile', 'player');
    const settings = await db.get('settings', 'global');
    const customItems = settings?.shopConfig?.customItems || [];
    const owned = new Set(profile.ownedShopItems || []);

    container.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header">
          <div>
            <h2 class="section-title">Tienda del Gremio</h2>
            <p class="muted" style="margin:0.15rem 0 0;">Sección separada del motor de campaña que opera exclusivamente con tu Oro General compartido.</p>
          </div>
          <span class="gold-pill">🪙 Oro General: ${formatGold(profile.globalGold)}</span>
        </div>

        <div style="padding:1rem; border-radius:var(--radius-md); background:var(--gold-dim); border:1px solid var(--border-gold); margin-bottom:1rem;">
          <strong>Estado del Catálogo Oficial: Pendiente de definición (Sec. 9.5)</strong>
          <p class="muted" style="margin:0.35rem 0 0; color:var(--text-primary);">
            Conforme a la especificación técnica, Proba no inventa precios ni artículos que alteren las habilidades de clase hasta que el catálogo oficial sea confirmado.
            La arquitectura económica garantiza protección contra saldos negativos y compras duplicadas.
          </p>
        </div>

        ${customItems.length > 0 ? `
          <h3 class="section-title" style="font-size:1rem; margin-bottom:0.65rem;">Artículos Configurados</h3>
          <div class="grid-3">
            ${customItems.map((item) => {
              const isOwned = owned.has(item.id);
              const canAfford = profile.globalGold >= item.price;
              return `
                <div class="card" style="background:var(--bg-elevated);">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="badge badge-gold">${formatGold(item.price)} oro</span>
                  </div>
                  <p class="muted" style="font-size:0.82rem;">${escapeHtml(item.description || '')}</p>
                  <button class="btn btn-sm ${isOwned ? 'btn-arcane' : 'btn-primary'}" data-buy-item="${item.id}" ${isOwned || !canAfford ? 'disabled' : ''}>
                    ${isOwned ? 'Adquirido' : (!canAfford ? 'Oro insuficiente' : 'Adquirir')}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="text-align:center; padding:1.25rem; border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
            <p class="muted" style="margin:0;">No hay artículos cargados actualmente en el catálogo.</p>
          </div>
        `}
      </div>
    `;

    container.querySelectorAll('[data-buy-item]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = customItems.find((i) => i.id === btn.dataset.buyItem);
        if (!item) return;
        try {
          await economyEngine.purchaseShopItem(item);
          await this.app.updateTopbarGold();
          this.app.showToast(`Artículo "${item.name}" adquirido.`, 'arcane');
          this.app.refresh();
        } catch (err) {
          this.app.showToast(err.message, 'danger');
        }
      });
    });
  }
}
