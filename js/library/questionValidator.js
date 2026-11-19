/**
 * Normalizador y validador estricto de preguntas (Sec. 5.2 y 5.3).
 * Regla clave: NUNCA adivina la respuesta correcta si el documento no la indica.
 */

export function normalizeAndValidateQuestions(parsedData, sourceDocumentId) {
  let rawQuestions = [];

  if (parsedData.structuredRows && Array.isArray(parsedData.structuredRows)) {
    rawQuestions = extractFromSpreadsheetRows(parsedData.structuredRows);
  }

  if (rawQuestions.length === 0 && parsedData.rawText) {
    rawQuestions = extractFromPlainText(parsedData.rawText);
  }

  return rawQuestions.map((q, idx) => validateSingleQuestion(q, sourceDocumentId, idx));
}

export function validateSingleQuestion(q, sourceDocumentId, orderIndex = 0) {
  const issues = [];
  const statement = (q.statement || '').trim();

  if (!statement) {
    issues.push('Falta el enunciado de la pregunta.');
  }

  // Normalizar opciones y asignar letras A, B, C, D...
  const cleanOptions = [];
  const seenIds = new Set();

  (q.options || []).forEach((opt, i) => {
    const id = (opt.id || String.fromCharCode(65 + i)).toUpperCase().trim();
    const text = (opt.text || '').trim();
    if (!text) return;
    if (seenIds.has(id)) {
      issues.push(`Opción duplicada detectada (${id}).`);
    }
    seenIds.add(id);
    cleanOptions.push({ id, text });
  });

  if (cleanOptions.length < 2) {
    issues.push('Se requieren al menos 2 opciones de respuesta válidas.');
  }

  let correctOptionId = q.correctOptionId ? String(q.correctOptionId).toUpperCase().trim() : null;
  if (correctOptionId && !cleanOptions.some((o) => o.id === correctOptionId)) {
    issues.push(`La respuesta indicada (${correctOptionId}) no coincide con ninguna opción disponible.`);
    correctOptionId = null;
  }

  if (!correctOptionId) {
    issues.push('No se indicó la respuesta correcta en el documento (requiere selección manual).');
  }

  const status = issues.length === 0 ? 'valid' : 'needs_review';

  return {
    id: q.id || `q-${Date.now()}-${orderIndex}-${Math.random().toString(36).slice(2, 7)}`,
    statement,
    options: cleanOptions,
    correctOptionId,
    explanation: q.explanation ? String(q.explanation).trim() : null,
    sourceDocumentId,
    orderIndex,
    status,
    issues
  };
}

/**
 * Extrae preguntas desde filas de Excel (.xlsx).
 * Soporta tabla con encabezados (Pregunta | Opcion A | Opcion B | ... | Correcta | Explicacion)
 * o formato sin encabezado donde col 0 es enunciado, cols 1..N-1 opciones y última col letra correcta.
 */
function extractFromSpreadsheetRows(rows) {
  if (!rows || rows.length === 0) return [];
  const results = [];

  // Detectar fila de encabezados
  let startRow = 0;
  let colMap = null;

  const firstRowLower = rows[0].map((c) => (c || '').toLowerCase());
  const stmtCol = firstRowLower.findIndex((c) => /pregunta|enunciado|question|item/.test(c));
  const ansCol = firstRowLower.findIndex((c) => /correcta|respuesta|answer|solucion|clave/.test(c));

  if (stmtCol !== -1) {
    startRow = 1;
    const expCol = firstRowLower.findIndex((c) => /explicacion|justificacion|explanation|nota/.test(c));
    const optCols = [];
    firstRowLower.forEach((c, idx) => {
      if (idx !== stmtCol && idx !== ansCol && idx !== expCol) {
        if (/opcion|option|alternativa|^[a-f]$/.test(c) || optCols.length < 6) {
          optCols.push(idx);
        }
      }
    });
    colMap = { stmtCol, optCols, ansCol, expCol };
  }

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.filter(Boolean).length < 2) continue;

    if (colMap) {
      const statement = row[colMap.stmtCol] || '';
      const options = [];
      colMap.optCols.forEach((cIdx, i) => {
        if (row[cIdx]) {
          options.push({ id: String.fromCharCode(65 + i), text: row[cIdx] });
        }
      });
      const rawAns = colMap.ansCol !== -1 ? (row[colMap.ansCol] || '').trim() : '';
      const correctOptionId = parseAnswerToken(rawAns, options);
      const explanation = colMap.expCol !== -1 ? (row[colMap.expCol] || null) : null;

      if (statement || options.length > 0) {
        results.push({ statement, options, correctOptionId, explanation });
      }
    } else {
      // Sin encabezados: Col 0 = pregunta, cols intermedias = opciones, última col si es letra A-F = correcta
      const statement = row[0] || '';
      const lastCell = (row[row.length - 1] || '').trim();
      const hasLetterLast = /^[A-Fa-f]$/.test(lastCell);
      const optEnd = hasLetterLast ? row.length - 1 : row.length;
      const options = [];
      for (let c = 1; c < optEnd; c++) {
        if (row[c]) {
          options.push({ id: String.fromCharCode(65 + options.length), text: row[c] });
        }
      }
      const correctOptionId = hasLetterLast ? lastCell.toUpperCase() : null;
      results.push({ statement, options, correctOptionId, explanation: null });
    }
  }

  return results;
}

function parseAnswerToken(token, options) {
  if (!token) return null;
  const clean = token.trim();
  if (/^[A-Fa-f]$/.test(clean)) return clean.toUpperCase();
  const matchLetter = clean.match(/^(?:opcion|opción|alternativa)?\s*([A-Fa-f])[).:\s]*$/i);
  if (matchLetter) return matchLetter[1].toUpperCase();
  // Coincidencia exacta con texto de opción
  const byText = options.find((o) => o.text.toLowerCase() === clean.toLowerCase());
  return byText ? byText.id : null;
}

/**
 * Extrae preguntas de texto plano (.txt, .docx, .pdf).
 * Reconoce numeración (1., 1), P1:), opciones (A), a., (A), *A)) y claves explícitas
 * (Respuesta: B, Correcta: B, [correcta], *).
 */
function extractFromPlainText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Detectar bloque final de respuestas tipo "Clave de respuestas: 1. B, 2. A..."
  const answerKeyMap = new Map();
  const filteredLines = [];

  for (const line of lines) {
    // Patrón de clave en bloque final: "1. B" o "1) C" o "1 - A"
    const keyPairMatch = line.match(/^(\d{1,3})\s*[).:\-]\s*([A-Fa-f])$/);
    if (keyPairMatch) {
      answerKeyMap.set(parseInt(keyPairMatch[1], 10), keyPairMatch[2].toUpperCase());
      continue;
    }
    filteredLines.push(line);
  }

  const questions = [];
  let current = null;
  let qCounter = 0;

  const startNewQuestion = (stmt, explicitNum = null) => {
    if (current) questions.push(current);
    qCounter = explicitNum !== null ? explicitNum : qCounter + 1;
    current = {
      number: qCounter,
      statement: stmt,
      options: [],
      correctOptionId: null,
      explanation: null
    };
  };

  for (const line of filteredLines) {
    // ¿Es línea de respuesta explícita? Ej: "Respuesta: B", "Correcta: C", "Sol: A"
    const ansLineMatch = line.match(/^(?:respuesta|correcta|rta|soluci[oó]n|sol|answer)\s*[:\-]\s*([A-Fa-f])(?:[).:\s]|$)/i);
    if (ansLineMatch && current) {
      current.correctOptionId = ansLineMatch[1].toUpperCase();
      continue;
    }

    // ¿Es línea de explicación?
    const expLineMatch = line.match(/^(?:explicaci[oó]n|justificaci[oó]n|nota|explanation)\s*[:\-]\s*(.+)$/i);
    if (expLineMatch && current) {
      current.explanation = expLineMatch[1].trim();
      continue;
    }

    // ¿Es una o varias opciones en la misma línea? Ej: "A) Uno   B) Dos   C) Tres"
    const inlineOpts = splitInlineOptions(line);
    if (inlineOpts.length > 0) {
      if (!current) startNewQuestion('');
      for (const opt of inlineOpts) {
        current.options.push({ id: opt.id, text: opt.text });
        if (opt.isCorrect) current.correctOptionId = opt.id;
      }
      continue;
    }

    // ¿Es inicio de nueva pregunta numerada? Ej: "1. ¿Qué es...?" o "Pregunta 2: ..."
    const qStartMatch = line.match(/^(?:pregunta\s+)?(\d{1,3})\s*[).:\-]\s*(.+)$/i);
    if (qStartMatch) {
      startNewQuestion(qStartMatch[2].trim(), parseInt(qStartMatch[1], 10));
      continue;
    }

    // Si aún no hay pregunta activa o la pregunta actual ya tiene opciones y llega texto nuevo (ej: "¿...?")
    if (!current) {
      startNewQuestion(line);
    } else if (current.options.length > 0 && /^[¿¡A-ZÁÉÍÓÚÑ]/.test(line) && line.endsWith('?')) {
      startNewQuestion(line);
    } else if (current.options.length === 0) {
      // Continuación de enunciado multilínea
      current.statement = (current.statement + ' ' + line).trim();
    } else {
      // Continuación de la última opción
      const lastOpt = current.options[current.options.length - 1];
      lastOpt.text = (lastOpt.text + ' ' + line).trim();
    }
  }

  if (current) questions.push(current);

  // Aplicar claves finales si existían
  for (const q of questions) {
    if (!q.correctOptionId && answerKeyMap.has(q.number)) {
      q.correctOptionId = answerKeyMap.get(q.number);
    }
  }

  return questions;
}

function splitInlineOptions(line) {
  // Detectar si la línea inicia con marcador de opción: "*A)", "A)", "a.", "(A)", "[A]", "- A)"
  const firstOptRegex = /^(?:[-•]\s*)?(\*?)\s*[(\[]?([A-Fa-f])[)\].:]\s*(.+)$/;
  const m = line.match(firstOptRegex);
  if (!m) return [];

  // Separar múltiples opciones en una sola línea si aparecen separadas por 2+ espacios o tabulador
  const parts = line.split(/\s{2,}(?=(?:\*?)\s*[(\[]?[A-Fa-f][)\].:]\s+)/);
  const parsed = [];

  for (const part of parts) {
    const pm = part.trim().match(firstOptRegex);
    if (!pm) continue;
    let isCorrect = pm[1] === '*';
    const id = pm[2].toUpperCase();
    let text = pm[3].trim();

    if (/\*$/.test(text) || /\[(?:correcta|correct|x)\]|\((?:correcta|correct)\)|✓|✔/i.test(text)) {
      isCorrect = true;
      text = text
        .replace(/\*$/, '')
        .replace(/\[(?:correcta|correct|x)\]|\((?:correcta|correct)\)|✓|✔/gi, '')
        .trim();
    }

    parsed.push({ id, text, isCorrect });
  }

  return parsed;
}
