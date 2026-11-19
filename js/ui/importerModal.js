/**
 * Modal de Importación y Previsualización/Validación obligatoria de preguntas (Sec. 5).
 * Permite cargar .docx, .pdf, .xlsx, .txt o pegar texto, revisar preguntas,
 * corregir respuestas faltantes (sin adivinar) o descartar preguntas mal interpretadas.
 */

import { parseDocumentFile } from '../library/fileParsers.js';
import { normalizeAndValidateQuestions, validateSingleQuestion } from '../library/questionValidator.js';
import { libraryManager } from '../library/libraryManager.js';
import { escapeHtml } from './libraryView.js';

export function openImporterModal({ app, subject, replaceDocument = null, onSaved }) {
  let docName = replaceDocument ? replaceDocument.name : '';
  let fileType = replaceDocument ? replaceDocument.fileType : 'txt';
  let rawContent = '';
  let questions = [];
  let parseError = null;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const renderModal = () => {
    const validCount = questions.filter((q) => q.status === 'valid').length;
    const reviewCount = questions.length - validCount;

    backdrop.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <h3 class="section-title" style="font-size:1.08rem;">
              ${replaceDocument ? `Reemplazar Documento: ${escapeHtml(replaceDocument.name)}` : `Importar Documentos a ${escapeHtml(subject.name)}`}
            </h3>
            <p class="muted" style="margin:0.15rem 0 0; font-size:0.8rem;">
              Formatos compatibles: <strong>.docx, .pdf, .xlsx, .txt</strong>. Revisa y valida las preguntas antes de guardar.
            </p>
          </div>
          <button class="btn btn-sm" id="imp-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="grid-2" style="margin-bottom:0.85rem;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Seleccionar archivo (.docx, .pdf, .xlsx, .txt)</label>
              <input type="file" id="imp-file" accept=".docx,.pdf,.xlsx,.txt" class="input" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Nombre del documento en Proba</label>
              <input type="text" id="imp-doc-name" class="input" value="${escapeHtml(docName)}" placeholder="Ej. Parcial 1 — Neumática" />
            </div>
          </div>

          <details style="margin-bottom:0.85rem;">
            <summary class="muted" style="cursor:pointer; font-weight:600;">O pegar texto directamente / ver formato esperado</summary>
            <div style="margin-top:0.5rem;">
              <textarea id="imp-raw-text" class="textarea" rows="5" placeholder="1. ¿Cuál es la unidad de presión en el SI?&#10;A) Watt&#10;B) Pascal&#10;C) Newton&#10;D) Joule&#10;Respuesta: B">${escapeHtml(rawContent)}</textarea>
              <div style="margin-top:0.4rem; display:flex; justify-content:flex-end;">
                <button class="btn btn-sm btn-arcane" id="imp-parse-text">Analizar texto pegado</button>
              </div>
            </div>
          </details>

          ${parseError ? `
            <div style="padding:0.75rem; border-radius:var(--radius-md); background:var(--crimson-dim); border:1px solid var(--crimson); color:var(--crimson-bright); margin-bottom:0.85rem;">
              ${escapeHtml(parseError)}
            </div>
          ` : ''}

          ${questions.length > 0 ? `
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem; padding:0.6rem 0.8rem; background:var(--bg-obsidian); border-radius:var(--radius-md);">
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <span class="badge">Detectadas: ${questions.length}</span>
                <span class="badge badge-arcane">Válidas: ${validCount}</span>
                ${reviewCount > 0 ? `<span class="badge badge-danger">Requieren revisión: ${reviewCount}</span>` : ''}
              </div>
              <button class="btn btn-sm" id="imp-add-manual">+ Añadir pregunta manual</button>
            </div>

            <div id="imp-questions-list">
              ${questions.map((q, idx) => `
                <div class="review-item ${q.status === 'valid' ? 'valid' : 'invalid'}" data-q-idx="${idx}">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                    <strong>Pregunta #${idx + 1}</strong>
                    <div style="display:flex; gap:0.4rem; align-items:center;">
                      <span class="badge ${q.status === 'valid' ? 'badge-arcane' : 'badge-danger'}">
                        ${q.status === 'valid' ? 'Válida' : 'Incompleta / Revisar'}
                      </span>
                      <button class="btn btn-sm btn-danger" data-discard-q="${idx}">Descartar</button>
                    </div>
                  </div>

                  ${q.issues.length > 0 ? `
                    <div style="font-size:0.8rem; color:var(--crimson-bright); margin-bottom:0.5rem;">
                      ${q.issues.map((iss) => `• ${escapeHtml(iss)}`).join('<br>')}
                    </div>
                  ` : ''}

                  <div class="form-group" style="margin-bottom:0.5rem;">
                    <label class="form-label">Enunciado</label>
                    <input type="text" class="input" data-edit-stmt="${idx}" value="${escapeHtml(q.statement)}" />
                  </div>

                  <div style="display:flex; flex-direction:column; gap:0.35rem; margin-bottom:0.5rem;">
                    <span class="form-label">Opciones (marca el círculo de la respuesta correcta):</span>
                    ${q.options.map((opt, oIdx) => `
                      <div style="display:flex; align-items:center; gap:0.45rem;">
                        <input type="radio" name="correct_${idx}" value="${opt.id}" ${q.correctOptionId === opt.id ? 'checked' : ''} data-set-correct="${idx}" title="Marcar como respuesta correcta" style="accent-color:var(--arcane); width:17px; height:17px;" />
                        <span class="badge">${opt.id}</span>
                        <input type="text" class="input" data-edit-opt="${idx}:${oIdx}" value="${escapeHtml(opt.text)}" style="padding:0.32rem 0.55rem;" />
                        ${q.options.length > 2 ? `<button class="btn btn-sm btn-danger" data-del-opt="${idx}:${oIdx}" title="Quitar opción">×</button>` : ''}
                      </div>
                    `).join('')}
                    <div>
                      <button class="btn btn-sm" data-add-opt="${idx}">+ Opción</button>
                    </div>
                  </div>

                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Explicación (opcional)</label>
                    <input type="text" class="input" data-edit-exp="${idx}" value="${escapeHtml(q.explanation || '')}" placeholder="Justificación opcional para modo Estudio" style="padding:0.32rem 0.55rem;" />
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="padding:1.25rem; text-align:center; border:1px dashed var(--border-subtle); border-radius:var(--radius-md);">
              <p class="muted" style="margin:0;">Sube un archivo (.docx, .pdf, .xlsx, .txt) o pega texto arriba para previsualizar y validar las preguntas detectadas.</p>
            </div>
          `}
        </div>

        <div class="modal-footer">
          <button class="btn" id="imp-cancel">Cancelar</button>
          <button class="btn btn-primary" id="imp-save" ${validCount === 0 ? 'disabled' : ''}>
            Guardar ${validCount} pregunta(s) válida(s)
          </button>
        </div>
      </div>
    `;

    bindModalEvents();
  };

  const revalidateAll = () => {
    questions = questions.map((q, i) => validateSingleQuestion(q, replaceDocument?.id || 'preview', i));
  };

  const bindModalEvents = () => {
    backdrop.querySelector('#imp-close')?.addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#imp-cancel')?.addEventListener('click', () => backdrop.remove());

    backdrop.querySelector('#imp-doc-name')?.addEventListener('input', (e) => {
      docName = e.target.value;
    });

    backdrop.querySelector('#imp-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      parseError = null;
      try {
        const parsed = await parseDocumentFile(file);
        fileType = parsed.fileType;
        rawContent = parsed.rawText;
        if (!docName) docName = file.name;
        questions = normalizeAndValidateQuestions(parsed, replaceDocument?.id || 'preview');
        if (questions.length === 0) {
          parseError = 'No se detectaron preguntas estructuradas en el documento. Puedes añadir preguntas manualmente o revisar el formato.';
        }
      } catch (err) {
        parseError = err.message || 'Error al procesar el archivo.';
        questions = [];
      }
      renderModal();
    });

    backdrop.querySelector('#imp-parse-text')?.addEventListener('click', () => {
      const txt = backdrop.querySelector('#imp-raw-text')?.value || '';
      rawContent = txt;
      fileType = 'txt';
      if (!docName) docName = 'Banco importado.txt';
      parseError = null;
      questions = normalizeAndValidateQuestions({ rawText: txt, structuredRows: null }, replaceDocument?.id || 'preview');
      if (questions.length === 0) {
        parseError = 'No se detectaron preguntas válidas en el texto introducido.';
      }
      renderModal();
    });

    backdrop.querySelector('#imp-add-manual')?.addEventListener('click', () => {
      questions.push(validateSingleQuestion({
        statement: '',
        options: [
          { id: 'A', text: '' },
          { id: 'B', text: '' },
          { id: 'C', text: '' },
          { id: 'D', text: '' }
        ],
        correctOptionId: null,
        explanation: null
      }, 'preview', questions.length));
      renderModal();
    });

    backdrop.querySelectorAll('[data-discard-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.discardQ);
        questions.splice(idx, 1);
        revalidateAll();
        renderModal();
      });
    });

    backdrop.querySelectorAll('[data-edit-stmt]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.dataset.editStmt);
        questions[idx].statement = inp.value;
        revalidateAll();
        renderModal();
      });
    });

    backdrop.querySelectorAll('[data-set-correct]').forEach((rad) => {
      rad.addEventListener('change', () => {
        const idx = Number(rad.dataset.setCorrect);
        questions[idx].correctOptionId = rad.value;
        revalidateAll();
        renderModal();
      });
    });

    backdrop.querySelectorAll('[data-edit-opt]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const [qIdx, oIdx] = inp.dataset.editOpt.split(':').map(Number);
        questions[qIdx].options[oIdx].text = inp.value;
        revalidateAll();
        renderModal();
      });
    });

    backdrop.querySelectorAll('[data-del-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [qIdx, oIdx] = btn.dataset.delOpt.split(':').map(Number);
        questions[qIdx].options.splice(oIdx, 1);
        // Re-etiquetar letras A, B, C...
        questions[qIdx].options.forEach((o, i) => {
          o.id = String.fromCharCode(65 + i);
        });
        revalidateAll();
        renderModal();
      });
    });

    backdrop.querySelectorAll('[data-add-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.addOpt);
        const nextId = String.fromCharCode(65 + questions[qIdx].options.length);
        questions[qIdx].options.push({ id: nextId, text: '' });
        revalidateAll();
        renderModal();
      });
    });

    backdrop.querySelectorAll('[data-edit-exp]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.dataset.editExp);
        questions[idx].explanation = inp.value || null;
      });
    });

    backdrop.querySelector('#imp-save')?.addEventListener('click', async () => {
      try {
        const saved = await libraryManager.saveImportedDocument({
          subjectId: subject.id,
          folderId: replaceDocument?.folderId || null,
          name: docName || 'Documento sin título',
          fileType,
          rawContent,
          validatedQuestions: questions,
          replaceDocumentId: replaceDocument?.id || null
        });
        app.showToast(`Guardadas ${saved.questions.length} pregunta(s) válida(s) en "${saved.document.name}".`, 'arcane');
        backdrop.remove();
        if (onSaved) onSaved(saved.document);
      } catch (err) {
        app.showToast(err.message, 'danger');
      }
    });
  };

  document.body.appendChild(backdrop);
  renderModal();
}
