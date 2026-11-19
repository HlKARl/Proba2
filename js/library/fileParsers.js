/**
 * Motores de lectura offline-first para .txt, .docx, .xlsx y .pdf.
 * No requiere servidores externos ni conexión a internet.
 */

export async function parseDocumentFile(file) {
  const fileName = file.name || 'documento.txt';
  const ext = fileName.split('.').pop().toLowerCase();
  const buffer = await file.arrayBuffer();

  if (ext === 'txt') {
    const text = decodeTextBuffer(buffer);
    return { fileType: 'txt', rawText: text, structuredRows: null };
  }

  if (ext === 'docx') {
    const text = await parseDocxBuffer(buffer);
    return { fileType: 'docx', rawText: text, structuredRows: null };
  }

  if (ext === 'xlsx') {
    const { rawText, structuredRows } = await parseXlsxBuffer(buffer);
    return { fileType: 'xlsx', rawText, structuredRows };
  }

  if (ext === 'pdf') {
    const text = await parsePdfBuffer(buffer);
    return { fileType: 'pdf', rawText: text, structuredRows: null };
  }

  throw new Error(`Formato no compatible (.${ext}). Formatos permitidos: .docx, .pdf, .xlsx, .txt`);
}

function decodeTextBuffer(buffer) {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('iso-8859-1').decode(buffer);
  }
}

/**
 * Lector ZIP minimalista basado en el Central Directory (EOCD) + DecompressionStream
 */
async function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // Buscar firma End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('El archivo ZIP/Office está dañado o no tiene una estructura válida.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const entries = new Map();
  let ptr = cdOffset;
  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) break;
    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const name = decoder.decode(bytes.slice(ptr + 46, ptr + 46 + fileNameLen));
    ptr += 46 + fileNameLen + extraLen + commentLen;

    // Leer cabecera local para obtener el inicio exacto de los datos
    if (localHeaderOffset + 30 <= bytes.length) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedData = bytes.slice(dataStart, dataStart + compressedSize);

      entries.set(name, async () => {
        if (compressionMethod === 0) {
          return compressedData;
        }
        if (compressionMethod === 8) {
          return await inflateRaw(compressedData);
        }
        throw new Error(`Método de compresión ZIP no soportado: ${compressionMethod}`);
      });
    }
  }

  return entries;
}

async function inflateRaw(uint8Data) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no soporta DecompressionStream para archivos comprimidos.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(uint8Data);
  writer.close();
  const out = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(out);
}

async function inflateZlib(uint8Data) {
  if (typeof DecompressionStream === 'undefined') return null;
  for (const format of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      writer.write(uint8Data);
      writer.close();
      const out = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(out);
    } catch {
      // Intentar siguiente formato
    }
  }
  return null;
}

/**
 * Extrae texto estructurado por párrafos de Microsoft Word (.docx)
 */
export async function parseDocxBuffer(buffer) {
  const entries = await readZipEntries(buffer);
  const docLoader = entries.get('word/document.xml');
  if (!docLoader) {
    throw new Error('No se encontró word/document.xml dentro del archivo .docx.');
  }
  const xmlBytes = await docLoader();
  const xmlText = new TextDecoder('utf-8').decode(xmlBytes);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const paragraphs = xmlDoc.getElementsByTagNameNS('*', 'p');
  const lines = [];

  for (const p of paragraphs) {
    const texts = p.getElementsByTagNameNS('*', 't');
    let line = '';
    for (const t of texts) {
      line += t.textContent || '';
    }
    const trimmed = line.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
  }

  return lines.join('\n');
}

/**
 * Extrae filas de Microsoft Excel (.xlsx)
 */
export async function parseXlsxBuffer(buffer) {
  const entries = await readZipEntries(buffer);
  const parser = new DOMParser();

  // 1. Leer sharedStrings.xml si existe
  const sharedStrings = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const ssBytes = await entries.get('xl/sharedStrings.xml')();
    const ssXml = parser.parseFromString(new TextDecoder('utf-8').decode(ssBytes), 'application/xml');
    const siNodes = ssXml.getElementsByTagNameNS('*', 'si');
    for (const si of siNodes) {
      const tNodes = si.getElementsByTagNameNS('*', 't');
      let str = '';
      for (const t of tNodes) str += t.textContent || '';
      sharedStrings.push(str.trim());
    }
  }

  // 2. Leer hojas xl/worksheets/sheet*.xml
  const sheetNames = [...entries.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort();

  if (sheetNames.length === 0) {
    throw new Error('No se encontraron hojas de cálculo en el archivo .xlsx.');
  }

  const allRows = [];
  for (const sheetName of sheetNames) {
    const sheetBytes = await entries.get(sheetName)();
    const sheetXml = parser.parseFromString(new TextDecoder('utf-8').decode(sheetBytes), 'application/xml');
    const rowNodes = sheetXml.getElementsByTagNameNS('*', 'row');

    for (const rowNode of rowNodes) {
      const cells = [];
      const cNodes = rowNode.getElementsByTagNameNS('*', 'c');
      for (const c of cNodes) {
        const ref = c.getAttribute('r') || '';
        const colIdx = colLettersToIndex(ref.replace(/[0-9]/g, ''));
        const type = c.getAttribute('t');
        let val = '';

        if (type === 'inlineStr') {
          const tNode = c.getElementsByTagNameNS('*', 't')[0];
          val = tNode ? tNode.textContent || '' : '';
        } else {
          const vNode = c.getElementsByTagNameNS('*', 'v')[0];
          const rawVal = vNode ? vNode.textContent || '' : '';
          if (type === 's') {
            const idx = parseInt(rawVal, 10);
            val = sharedStrings[idx] !== undefined ? sharedStrings[idx] : rawVal;
          } else {
            val = rawVal;
          }
        }

        if (colIdx >= 0) {
          cells[colIdx] = String(val).trim();
        }
      }
      if (cells.some((c) => c && c.length > 0)) {
        allRows.push(cells);
      }
    }
  }

  const rawText = allRows.map((r) => r.filter(Boolean).join(' | ')).join('\n');
  return { rawText, structuredRows: allRows };
}

function colLettersToIndex(letters) {
  if (!letters) return -1;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

/**
 * Extrae texto de archivos PDF (.pdf) descomprimiendo flujos FlateDecode
 * y analizando operadores de texto BT...ET (Tj / TJ).
 */
export async function parsePdfBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const latinText = new TextDecoder('iso-8859-1').decode(bytes);
  const extractedChunks = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(latinText)) !== null) {
    const startIdx = match.index + match[0].indexOf(match[1]);
    const endIdx = startIdx + match[1].length;
    const rawSlice = bytes.slice(startIdx, endIdx);

    // Verificar cabecera del diccionario del objeto previo
    const dictHeader = latinText.slice(Math.max(0, match.index - 220), match.index);
    let contentBytes = rawSlice;

    if (/\/FlateDecode/.test(dictHeader)) {
      const inflated = await inflateZlib(rawSlice);
      if (inflated) {
        contentBytes = inflated;
      }
    }

    const streamStr = new TextDecoder('iso-8859-1').decode(contentBytes);
    const textFromOperators = extractPdfTextOperators(streamStr);
    if (textFromOperators.trim()) {
      extractedChunks.push(textFromOperators);
    }
  }

  // Respaldo si el PDF almacena texto sin compresión fuera de streams típicos
  if (extractedChunks.length === 0) {
    const fallback = extractPdfTextOperators(latinText);
    if (fallback.trim()) extractedChunks.push(fallback);
  }

  return extractedChunks.join('\n');
}

function extractPdfTextOperators(content) {
  const lines = [];
  const btBlocks = content.match(/BT[\s\S]*?ET/g) || [];

  for (const block of btBlocks) {
    let currentLine = '';

    // Extraer cadenas entre paréntesis (...) seguidas de Tj, ' o "
    const tokenRegex = /\((?:\\.|[^\\()])*\)|\[(?:[^\[\]])*\]\s*TJ|T\*|Td|TD|Tm/g;
    let tok;
    while ((tok = tokenRegex.exec(block)) !== null) {
      const val = tok[0];
      if (val === 'T*' || val === 'Td' || val === 'TD' || val === 'Tm') {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
      } else if (val.startsWith('[')) {
        // Array TJ: [(Hola ) -20 (mundo)] TJ
        const parts = val.match(/\((?:\\.|[^\\()])*\)/g) || [];
        for (const p of parts) {
          currentLine += unescapePdfString(p.slice(1, -1));
        }
      } else if (val.startsWith('(')) {
        currentLine += unescapePdfString(val.slice(1, -1));
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }

  return lines.join('\n');
}

function unescapePdfString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}
