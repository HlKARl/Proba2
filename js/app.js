/**
 * Controlador principal de Proba PWA.
 * Gestiona navegación, estado global, detección offline, instalación PWA,
 * recuperación de campaña en curso y diálogos modales accesibles.
 */

import { db } from './db/database.js';
import { formatGold } from './config/defaults.js';
import { sessionEngine } from './engine/sessionEngine.js';
import { campaignEngine } from './engine/campaignEngine.js';
import { LibraryView, escapeHtml } from './ui/libraryView.js';
import { SessionSetupView } from './ui/sessionSetupView.js';
import { ArenaView } from './ui/arenaView.js';
import { ShopView } from './ui/shopView.js';
import { StatsView } from './ui/statsView.js';
import { SettingsView } from './ui/settingsView.js';

class ProbaApp {
  constructor() {
    this.currentTab = 'library';
    this.routeParams = {};
    this.deferredInstallPrompt = null;

    this.views = {
      library: new LibraryView(this),
      setup: new SessionSetupView(this),
      arena: new ArenaView(this),
      shop: new ShopView(this),
      stats: new StatsView(this),
      settings: new SettingsView(this)
    };
  }

  async init() {
    await db.init();
    this.registerServiceWorker();
    this.bindGlobalEvents();
    await this.updateTopbarGold();
    this.updateConnectivityBadge();

    // Si existe una campaña activa en IndexedDB al abrir/reabrir la app, ofrecer/reanudarla
    const activeCampaign = await campaignEngine.getActiveCampaign();
    if (activeCampaign) {
      this.views.arena.startCampaign(activeCampaign);
      this.currentTab = 'arena';
      this.showToast('Campaña en progreso restaurada desde almacenamiento local.', 'arcane');
    }

    await this.refresh();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('Service Worker no pudo registrarse:', err);
        });
      });
    }
  }

  bindGlobalEvents() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (this.currentTab === 'arena' && target !== 'arena') {
          this.views.arena.cleanup();
        }
        this.navigate(target);
      });
    });

    document.querySelector('#brand-home')?.addEventListener('click', () => {
      if (this.currentTab === 'arena') this.views.arena.cleanup();
      this.navigate('library');
    });

    window.addEventListener('online', () => this.updateConnectivityBadge());
    window.addEventListener('offline', () => this.updateConnectivityBadge());

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const installBtn = document.querySelector('#btn-install-pwa');
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    document.querySelector('#btn-install-pwa')?.addEventListener('click', async () => {
      if (!this.deferredInstallPrompt) return;
      this.deferredInstallPrompt.prompt();
      await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      document.querySelector('#btn-install-pwa').style.display = 'none';
    });
  }

  updateConnectivityBadge() {
    const badge = document.querySelector('#connectivity-badge');
    if (!badge) return;
    if (navigator.onLine) {
      badge.textContent = '● En línea (Offline listo)';
      badge.classList.remove('is-offline');
    } else {
      badge.textContent = '● Modo Sin Conexión';
      badge.classList.add('is-offline');
    }
  }

  async updateTopbarGold() {
    const profile = await db.get('playerProfile', 'player');
    const goldEl = document.querySelector('#topbar-gold-amount');
    if (goldEl && profile) {
      goldEl.textContent = formatGold(profile.globalGold);
    }
  }

  navigate(tab, params = {}) {
    this.currentTab = tab;
    this.routeParams = params;
    this.refresh();
  }

  async refresh() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === this.currentTab);
    });

    const mainEl = document.querySelector('#app-main');
    const view = this.views[this.currentTab];
    if (mainEl && view) {
      await view.render(mainEl, this.routeParams);
    }
  }

  async startOrdinaryRun(config) {
    const session = await sessionEngine.startOrdinarySession(config);
    if (session.notice) {
      this.showToast(session.notice, 'frenzy');
    }
    this.views.arena.startOrdinary(session);
    this.navigate('arena');
  }

  async startCampaignRun(config) {
    const state = await campaignEngine.startCampaign(config);
    this.views.arena.startCampaign(state);
    this.navigate('arena');
  }

  showToast(message, variant = 'default') {
    const container = document.querySelector('#toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${variant}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 200ms ease';
      setTimeout(() => toast.remove(), 220);
    }, 3600);
  }

  confirmDialog(title, message) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-box" style="max-width:440px;">
          <div class="modal-header">
            <h3 class="section-title" style="font-size:1.05rem;">${escapeHtml(title)}</h3>
          </div>
          <div class="modal-body">
            <p style="margin:0;">${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button class="btn" id="dlg-cancel">Cancelar</button>
            <button class="btn btn-danger" id="dlg-ok">Confirmar</button>
          </div>
        </div>
      `;
      const close = (val) => {
        backdrop.remove();
        resolve(val);
      };
      backdrop.querySelector('#dlg-cancel').addEventListener('click', () => close(false));
      backdrop.querySelector('#dlg-ok').addEventListener('click', () => close(true));
      document.body.appendChild(backdrop);
    });
  }

  promptDialog(title, label, defaultValue = '') {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-box" style="max-width:440px;">
          <div class="modal-header">
            <h3 class="section-title" style="font-size:1.05rem;">${escapeHtml(title)}</h3>
          </div>
          <div class="modal-body">
            <label class="form-label">${escapeHtml(label)}</label>
            <input type="text" id="dlg-input" class="input" value="${escapeHtml(defaultValue)}" />
          </div>
          <div class="modal-footer">
            <button class="btn" id="dlg-cancel">Cancelar</button>
            <button class="btn btn-primary" id="dlg-ok">Aceptar</button>
          </div>
        </div>
      `;
      const input = backdrop.querySelector('#dlg-input');
      const close = (val) => {
        backdrop.remove();
        resolve(val);
      };
      backdrop.querySelector('#dlg-cancel').addEventListener('click', () => close(null));
      backdrop.querySelector('#dlg-ok').addEventListener('click', () => close(input.value.trim() || null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(input.value.trim() || null);
      });
      document.body.appendChild(backdrop);
      input.focus();
    });
  }
}

const app = new ProbaApp();
app.init();
