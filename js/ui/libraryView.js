/**
 * Vista principal de Biblioteca Académica: Materias, Carpetas/Agrupaciones y Documentos (Sec. 4).
 */

import { libraryManager } from '../library/libraryManager.js';
import { openImporterModal } from './importerModal.js';

export class LibraryView {
  constructor(app) {
    this.app = app;
    this.selectedSubjectId = null;
    this.selectedFolderFilter = 'all';
    this.selectedDocumentIds = new Set();
  }

  async render(container) {
    const subjects = await libraryManager.getAllSubjects();

    if (subjects.length > 0 && (!this.selectedSubjectId || !subjects.some((s) => s.id === this.selectedSubjectId))) {
      this.selectedSubjectId = subjects[0].id;
      this.selectedDocumentIds.clear();
    }
    if (subjects.length === 0) {
      this.selectedSubjectId = null;
      this.selectedDocumentIds.clear();
    }

    const activeSubject = subjects.find((s) => s.id === this.selectedSubjectId) || null;
    const folders = activeSubject ? await libraryManager.getFoldersBySubject(activeSubject.id) : [];
    const documents = activeSubject ? await libraryManager.getDocumentsBySubject(activeSubject.id) : [];

    // Limpiar IDs seleccionados que ya no existan
    const validDocIds = new Set(documents.map((d) => d.id));
    for (const id of [...this.selectedDocumentIds]) {
      if (!validDocIds.has(id)) this.selectedDocumentIds.delete(id);
    }

    const filteredDocs = documents.filter((doc) => {
      if (this.selectedFolderFilter === 'all') return true;
      if (this.selectedFolderFilter === 'unassigned') return !doc.folderId;
      return doc.folderId === this.selectedFolderFilter;
    });

    const selectedDocsArray = documents.filter((d) => this.selectedDocumentIds.has(d.id));
    const totalSelectedQuestions = selectedDocsArray.reduce((acc, d) => acc + d.validQuestions, 0);

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1rem;">
        <div class="card-header">
          <div>
            <h2 class="section-title">Biblioteca de Materias</h2>
            <p class="muted" style="margin: 0.2rem 0 0;">Organiza tus asignaturas, importa bancos propios (.docx, .pdf, .xlsx, .txt) y selecciona documentos para jugar.</p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${subjects.length === 0 ? `<button class="btn btn-arcane" id="btn-seed-sample">Cargar banco de ejemplo</button>` : ''}
            <button class="btn btn-primary" id="btn-new-subject">+ Nueva Materia</button>
          </div>
        </div>

        ${subjects.length === 0 ? `
          <div style="padding: 1.5rem; text-align: center; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
            <p style="margin: 0 0 0.75rem;">Aún no tienes materias registradas.</p>
            <p class="muted" style="margin: 0;">Crea una materia nueva o carga el banco de ejemplo de Control Industrial para probar todos los modos al instante.</p>
          </div>
        ` : `
          <div class="grid-3">
            ${subjects.map((sub) => `
              <div class="card subject-card ${sub.id === this.selectedSubjectId ? 'selected' : ''}" data-subject-id="${sub.id}" style="padding: 0.85rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <strong style="font-size: 1rem;">${escapeHtml(sub.name)}</strong>
                  <div style="display:flex; gap:0.25rem;" onclick="event.stopPropagation()">
                    <button class="btn btn-sm" data-rename-subject="${sub.id}" title="Renombrar materia">✎</button>
                    <button class="btn btn-sm btn-danger" data-delete-subject="${sub.id}" title="Eliminar materia">✕</button>
                  </div>
                </div>
                <div class="muted" style="font-size:0.78rem; margin-top:0.35rem;">
                  Creada: ${new Date(sub.createdAt).toLocaleDateString('es-ES')}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      ${activeSubject ? `
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap;">
            <div>
              <h3 class="section-title" style="font-size:1.08rem;">Documentos de ${escapeHtml(activeSubject.name)}</h3>
              <p class="muted" style="margin: 0.15rem 0 0;">Marca uno, varios o todos los documentos para alimentar el banco de tu próxima sesión.</p>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="btn btn-sm" id="btn-new-folder">+ Carpeta / Agrupación</button>
              <button class="btn btn-primary" id="btn-import-doc">+ Importar Documentos</button>
            </div>
          </div>

          <!-- Filtros de Carpetas / Agrupaciones visuales (Sec. 4.2) -->
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.85rem; padding-bottom:0.65rem; border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap; align-items:center;">
              <span class="muted" style="font-size:0.8rem;">Agrupación:</span>
              <button class="btn btn-sm ${this.selectedFolderFilter === 'all' ? 'btn-arcane' : ''}" data-folder-filter="all">Todos (${documents.length})</button>
              <button class="btn btn-sm ${this.selectedFolderFilter === 'unassigned' ? 'btn-arcane' : ''}" data-folder-filter="unassigned">Sin carpeta</button>
              ${folders.map((f) => `
                <span style="display:inline-flex; align-items:center; gap:2px;">
                  <button class="btn btn-sm ${this.selectedFolderFilter === f.id ? 'btn-arcane' : ''}" data-folder-filter="${f.id}">📁 ${escapeHtml(f.name)}</button>
                  <button class="btn btn-sm btn-danger" data-delete-folder="${f.id}" title="Eliminar agrupación" style="padding:0.25rem 0.4rem;">×</button>
                </span>
              `).join('')}
            </div>

            ${documents.length > 0 ? `
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-sm" id="btn-select-all-docs">Seleccionar todos</button>
                <button class="btn btn-sm" id="btn-clear-docs">Limpiar selección</button>
              </div>
            ` : ''}
          </div>

          ${filteredDocs.length === 0 ? `
            <div style="padding:1.25rem; text-align:center; border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
              <p class="muted" style="margin:0 0 0.65rem;">No hay documentos en esta vista.</p>
              <button class="btn btn-primary btn-sm" id="btn-import-doc-empty">Importar archivo (.docx, .pdf, .xlsx, .txt)</button>
            </div>
          ` : `
            <div>
              ${filteredDocs.map((doc) => {
                const isChecked = this.selectedDocumentIds.has(doc.id);
                return `
                  <div class="doc-row ${isChecked ? 'checked' : ''}">
                    <label style="display:flex; align-items:center; gap:0.75rem; flex:1; cursor:pointer; min-width:0;">
                      <input type="checkbox" data-doc-check="${doc.id}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--arcane);" />
                      <div style="min-width:0; flex:1;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                          <strong style="word-break:break-word;">${escapeHtml(doc.name)}</strong>
                          <span class="badge">${escapeHtml(doc.fileType.toUpperCase())}</span>
                          <span class="badge badge-arcane">${doc.validQuestions} pregunta(s) válida(s)</span>
                        </div>
                        <div class="muted" style="font-size:0.78rem; margin-top:0.2rem;">
                          Importado: ${new Date(doc.importedAt).toLocaleString('es-ES')}
                        </div>
                      </div>
                    </label>

                    <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                      ${folders.length > 0 ? `
                        <select class="select" data-assign-folder="${doc.id}" style="width:auto; padding:0.28rem 0.5rem; font-size:0.8rem;" title="Asignar carpeta">
                          <option value="">Sin carpeta</option>
                          ${folders.map((f) => `<option value="${f.id}" ${doc.folderId === f.id ? 'selected' : ''}>📁 ${escapeHtml(f.name)}</option>`).join('')}
                        </select>
                      ` : ''}
                      <button class="btn btn-sm" data-rename-doc="${doc.id}" title="Renombrar documento">Renombrar</button>
                      <button class="btn btn-sm" data-replace-doc="${doc.id}" title="Reemplazar contenido del documento">Reemplazar</button>
                      <button class="btn btn-sm btn-danger" data-delete-doc="${doc.id}" title="Eliminar documento">Eliminar</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          <!-- Barra de lanzamiento de sesión -->
          <div style="margin-top:1rem; padding-top:0.9rem; border-top:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <strong>Selección actual:</strong>
              <span class="badge badge-gold">${this.selectedDocumentIds.size} documento(s)</span>
              <span class="badge badge-arcane">${totalSelectedQuestions} preguntas en banco</span>
            </div>
            <button class="btn btn-primary" id="btn-launch-setup" ${totalSelectedQuestions === 0 ? 'disabled' : ''}>
              Configurar Partida / Campaña →
            </button>
          </div>
        </div>
      ` : ''}
    `;

    this.bindEvents(container, activeSubject, documents);
  }

  bindEvents(container, activeSubject, documents) {
    container.querySelector('#btn-seed-sample')?.addEventListener('click', async () => {
      const sub = await libraryManager.seedSampleAcademicBank();
      this.selectedSubjectId = sub.id;
      const docs = await libraryManager.getDocumentsBySubject(sub.id);
      if (docs[0]) this.selectedDocumentIds.add(docs[0].id);
      this.app.showToast('Banco de ejemplo de Control Industrial cargado.', 'arcane');
      this.app.refresh();
    });

    container.querySelector('#btn-new-subject')?.addEventListener('click', async () => {
      const name = await this.app.promptDialog('Nueva Materia', 'Nombre de la materia (ej. Control Industrial):');
      if (!name) return;
      const sub = await libraryManager.createSubject(name);
      this.selectedSubjectId = sub.id;
      this.selectedDocumentIds.clear();
      this.app.showToast(`Materia "${sub.name}" creada.`, 'arcane');
      this.app.refresh();
    });

    container.querySelectorAll('[data-subject-id]').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectedSubjectId = el.dataset.subjectId;
        this.selectedFolderFilter = 'all';
        this.selectedDocumentIds.clear();
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-rename-subject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const subId = btn.dataset.renameSubject;
        const newName = await this.app.promptDialog('Renombrar Materia', 'Nuevo nombre para la materia:');
        if (!newName) return;
        await libraryManager.renameSubject(subId, newName);
        this.app.showToast('Materia renombrada.');
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-delete-subject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const subId = btn.dataset.deleteSubject;
        const confirmed = await this.app.confirmDialog(
          'Eliminar Materia',
          '¿Seguro que deseas eliminar esta materia junto con todos sus documentos y preguntas? Esta acción no se puede deshacer.'
        );
        if (!confirmed) return;
        await libraryManager.deleteSubject(subId);
        if (this.selectedSubjectId === subId) this.selectedSubjectId = null;
        this.app.showToast('Materia eliminada.', 'danger');
        this.app.refresh();
      });
    });

    container.querySelector('#btn-new-folder')?.addEventListener('click', async () => {
      if (!activeSubject) return;
      const name = await this.app.promptDialog('Nueva Carpeta / Agrupación', 'Nombre de la agrupación (ej. Primer Parcial):');
      if (!name) return;
      await libraryManager.createFolder(activeSubject.id, name);
      this.app.showToast(`Carpeta "${name}" creada.`, 'arcane');
      this.app.refresh();
    });

    container.querySelectorAll('[data-folder-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedFolderFilter = btn.dataset.folderFilter;
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-delete-folder]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmed = await this.app.confirmDialog(
          'Eliminar Carpeta',
          'Los documentos conservarán su vínculo con la materia y pasarán a "Sin carpeta". ¿Continuar?'
        );
        if (!confirmed) return;
        await libraryManager.deleteFolder(btn.dataset.deleteFolder);
        this.selectedFolderFilter = 'all';
        this.app.refresh();
      });
    });

    const openImport = (replaceDoc = null) => {
      if (!activeSubject) return;
      openImporterModal({
        app: this.app,
        subject: activeSubject,
        replaceDocument: replaceDoc,
        onSaved: (savedDoc) => {
          this.selectedDocumentIds.add(savedDoc.id);
          this.app.refresh();
        }
      });
    };

    container.querySelector('#btn-import-doc')?.addEventListener('click', () => openImport(null));
    container.querySelector('#btn-import-doc-empty')?.addEventListener('click', () => openImport(null));

    container.querySelectorAll('[data-doc-check]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.docCheck;
        if (chk.checked) this.selectedDocumentIds.add(id);
        else this.selectedDocumentIds.delete(id);
        this.app.refresh();
      });
    });

    container.querySelector('#btn-select-all-docs')?.addEventListener('click', () => {
      for (const d of documents) this.selectedDocumentIds.add(d.id);
      this.app.refresh();
    });

    container.querySelector('#btn-clear-docs')?.addEventListener('click', () => {
      this.selectedDocumentIds.clear();
      this.app.refresh();
    });

    container.querySelectorAll('[data-assign-folder]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        await libraryManager.assignDocumentFolder(sel.dataset.assignFolder, sel.value || null);
        this.app.showToast('Agrupación actualizada.');
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-rename-doc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const docId = btn.dataset.renameDoc;
        const newName = await this.app.promptDialog('Renombrar Documento', 'Nuevo nombre del documento:');
        if (!newName) return;
        await libraryManager.renameDocument(docId, newName);
        this.app.showToast('Documento renombrado.');
        this.app.refresh();
      });
    });

    container.querySelectorAll('[data-replace-doc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const doc = documents.find((d) => d.id === btn.dataset.replaceDoc);
        if (doc) openImport(doc);
      });
    });

    container.querySelectorAll('[data-delete-doc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const docId = btn.dataset.deleteDoc;
        const confirmed = await this.app.confirmDialog(
          'Eliminar Documento',
          '¿Seguro que deseas eliminar este documento y todas sus preguntas asociadas?'
        );
        if (!confirmed) return;
        await libraryManager.deleteDocument(docId);
        this.selectedDocumentIds.delete(docId);
        this.app.showToast('Documento eliminado.', 'danger');
        this.app.refresh();
      });
    });

    container.querySelector('#btn-launch-setup')?.addEventListener('click', () => {
      if (!activeSubject || this.selectedDocumentIds.size === 0) return;
      this.app.navigate('setup', {
        subjectId: activeSubject.id,
        documentIds: [...this.selectedDocumentIds]
      });
    });
  }
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
