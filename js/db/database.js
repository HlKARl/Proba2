/**
 * Capa de persistencia IndexedDB con soporte de migraciones de esquema.
 * Entidades (Sec. 12):
 * subjects, folders, documents, questions, settings, runs, answers,
 * playerProfile, classProgress, campaignState, statistics
 */

import {
  SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  DEFAULT_PLAYER_PROFILE,
  DEFAULT_STATISTICS
} from '../config/defaults.js';

const DB_NAME = 'ProbaDB';

const STORES = [
  { name: 'subjects', keyPath: 'id', indexes: [{ name: 'name', keyPath: 'name', unique: false }] },
  { name: 'folders', keyPath: 'id', indexes: [{ name: 'subjectId', keyPath: 'subjectId', unique: false }] },
  { name: 'documents', keyPath: 'id', indexes: [{ name: 'subjectId', keyPath: 'subjectId', unique: false }] },
  {
    name: 'questions',
    keyPath: 'id',
    indexes: [
      { name: 'documentId', keyPath: 'documentId', unique: false },
      { name: 'subjectId', keyPath: 'subjectId', unique: false }
    ]
  },
  { name: 'settings', keyPath: 'id', indexes: [] },
  { name: 'runs', keyPath: 'id', indexes: [{ name: 'subjectId', keyPath: 'subjectId', unique: false }] },
  { name: 'answers', keyPath: 'id', indexes: [{ name: 'runId', keyPath: 'runId', unique: false }] },
  { name: 'playerProfile', keyPath: 'id', indexes: [] },
  { name: 'classProgress', keyPath: 'classId', indexes: [] },
  { name: 'campaignState', keyPath: 'id', indexes: [] },
  { name: 'statistics', keyPath: 'id', indexes: [] }
];

class ProbaDatabase {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion || 0;

        for (const storeDef of STORES) {
          let store;
          if (!db.objectStoreNames.contains(storeDef.name)) {
            store = db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });
          } else {
            store = event.target.transaction.objectStore(storeDef.name);
          }

          for (const idx of storeDef.indexes) {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
            }
          }
        }

        // Future schema migrations hook
        if (oldVersion < 1) {
          // Initial v1 schema established cleanly
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await this.ensureSeedRecords();
    return this.db;
  }

  async ensureSeedRecords() {
    const existingSettings = await this.get('settings', 'global');
    if (!existingSettings) {
      await this.put('settings', structuredClone(DEFAULT_SETTINGS));
    } else {
      // Merge newly added configurable keys without overwriting user customizations
      const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), existingSettings);
      merged.schemaVersion = SCHEMA_VERSION;
      await this.put('settings', merged);
    }

    const profile = await this.get('playerProfile', 'player');
    if (!profile) {
      await this.put('playerProfile', structuredClone(DEFAULT_PLAYER_PROFILE));
    }

    const stats = await this.get('statistics', 'global_stats');
    if (!stats) {
      await this.put('statistics', structuredClone(DEFAULT_STATISTICS));
    }

    const classIds = ['ninja', 'ladron', 'mago', 'berserker'];
    for (const classId of classIds) {
      const cp = await this.get('classProgress', classId);
      if (!cp) {
        await this.put('classProgress', {
          classId,
          unlockedSkillLevels: [1], // Nivel I disponible inicialmente; progresión configurable
          ghostProgress: []
        });
      }
    }
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, record) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  async putMany(storeName, records) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve(records);
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async exportBackup() {
    await this.init();
    const dump = {
      app: 'Proba',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      stores: {}
    };
    for (const s of STORES) {
      dump.stores[s.name] = await this.getAll(s.name);
    }
    return dump;
  }

  async importBackup(dump) {
    if (!dump || dump.app !== 'Proba' || !dump.stores) {
      throw new Error('Archivo de respaldo inválido o incompatible.');
    }
    await this.init();
    for (const s of STORES) {
      if (Array.isArray(dump.stores[s.name])) {
        await this.clearStore(s.name);
        await this.putMany(s.name, dump.stores[s.name]);
      }
    }
    await this.ensureSeedRecords();
  }
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      target[key] = deepMerge({ ...target[key] }, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export const db = new ProbaDatabase();
