/**
 * Gestión de Materias, Carpetas/Agrupaciones, Documentos y Bancos de Preguntas (Sec. 4 y 5).
 */

import { db } from '../db/database.js';
import { validateSingleQuestion } from './questionValidator.js';

export class LibraryManager {
  async getAllSubjects() {
    const subjects = await db.getAll('subjects');
    return subjects.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async createSubject(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('El nombre de la materia no puede estar vacío.');
    const now = new Date().toISOString();
    const subject = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      createdAt: now,
      updatedAt: now
    };
    await db.put('subjects', subject);
    return subject;
  }

  async renameSubject(subjectId, newName) {
    const trimmed = (newName || '').trim();
    if (!trimmed) throw new Error('El nombre de la materia no puede estar vacío.');
    const subject = await db.get('subjects', subjectId);
    if (!subject) throw new Error('Materia no encontrada.');
    subject.name = trimmed;
    subject.updatedAt = new Date().toISOString();
    await db.put('subjects', subject);
    return subject;
  }

  async deleteSubject(subjectId) {
    const docs = await db.getByIndex('documents', 'subjectId', subjectId);
    for (const doc of docs) {
      await this.deleteDocument(doc.id);
    }
    const folders = await db.getByIndex('folders', 'subjectId', subjectId);
    for (const folder of folders) {
      await db.delete('folders', folder.id);
    }
    await db.delete('subjects', subjectId);
  }

  // Carpetas / agrupaciones visuales dentro de una materia (Sec. 4.2)
  async getFoldersBySubject(subjectId) {
    const folders = await db.getByIndex('folders', 'subjectId', subjectId);
    return folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async createFolder(subjectId, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('El nombre de la carpeta no puede estar vacío.');
    const folder = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subjectId,
      name: trimmed,
      createdAt: new Date().toISOString()
    };
    await db.put('folders', folder);
    return folder;
  }

  async deleteFolder(folderId) {
    const docs = await db.getAll('documents');
    for (const doc of docs) {
      if (doc.folderId === folderId) {
        doc.folderId = null;
        await db.put('documents', doc);
      }
    }
    await db.delete('folders', folderId);
  }

  async assignDocumentFolder(documentId, folderId) {
    const doc = await db.get('documents', documentId);
    if (!doc) return;
    doc.folderId = folderId || null;
    await db.put('documents', doc);
  }

  async getDocumentsBySubject(subjectId) {
    const docs = await db.getByIndex('documents', 'subjectId', subjectId);
    const allQuestions = await db.getByIndex('questions', 'subjectId', subjectId);

    return docs
      .map((doc) => {
        const docQuestions = allQuestions.filter((q) => q.documentId === doc.id);
        const validCount = docQuestions.filter((q) => q.status === 'valid').length;
        return {
          ...doc,
          totalQuestions: docQuestions.length,
          validQuestions: validCount
        };
      })
      .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
  }

  /**
   * Guarda un documento validado y sus preguntas sin reemplazar el contenido original (Sec. 5.3 y 17).
   */
  async saveImportedDocument({ subjectId, folderId = null, name, fileType, rawContent, validatedQuestions, replaceDocumentId = null }) {
    const validQuestions = validatedQuestions
      .map((q, idx) => validateSingleQuestion(q, replaceDocumentId || 'temp', idx))
      .filter((q) => q.status === 'valid');

    if (validQuestions.length === 0) {
      throw new Error('El documento no contiene preguntas válidas. No se guardará un banco vacío.');
    }

    const docId = replaceDocumentId || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Si es reemplazo, eliminar preguntas anteriores de ese documento
    if (replaceDocumentId) {
      const oldQs = await db.getByIndex('questions', 'documentId', replaceDocumentId);
      for (const oq of oldQs) {
        await db.delete('questions', oq.id);
      }
    }

    const docRecord = {
      id: docId,
      subjectId,
      folderId: folderId || null,
      name: (name || 'Documento sin título').trim(),
      fileType: fileType || 'txt',
      importedAt: new Date().toISOString(),
      rawContent: rawContent || '', // Conserva el texto original separado del banco procesado
      metadata: {
        validQuestionCount: validQuestions.length
      }
    };

    const questionRecords = validQuestions.map((q, idx) => ({
      ...q,
      id: q.id.startsWith('q-') ? q.id : `q-${docId}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      documentId: docId,
      subjectId,
      sourceDocumentId: docId,
      orderIndex: idx,
      status: 'valid'
    }));

    await db.put('documents', docRecord);
    await db.putMany('questions', questionRecords);

    return { document: docRecord, questions: questionRecords };
  }

  async renameDocument(documentId, newName) {
    const trimmed = (newName || '').trim();
    if (!trimmed) throw new Error('El nombre del documento no puede estar vacío.');
    const doc = await db.get('documents', documentId);
    if (!doc) throw new Error('Documento no encontrado.');
    doc.name = trimmed;
    await db.put('documents', doc);
    return doc;
  }

  async deleteDocument(documentId) {
    const qs = await db.getByIndex('questions', 'documentId', documentId);
    for (const q of qs) {
      await db.delete('questions', q.id);
    }
    await db.delete('documents', documentId);
  }

  /**
   * Obtiene el banco de preguntas válidas a partir de uno o varios documentos seleccionados (Sec. 4.3).
   */
  async getQuestionsForDocuments(documentIds) {
    const selectedSet = new Set(documentIds);
    const allQuestions = await db.getAll('questions');
    return allQuestions
      .filter((q) => selectedSet.has(q.documentId) && q.status === 'valid')
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }

  /**
   * Carga una materia y banco de ejemplo para probar la app inmediatamente si el usuario lo desea.
   */
  async seedSampleAcademicBank() {
    const sub = await this.createSubject('Control Industrial (Ejemplo)');
    const folder = await this.createFolder(sub.id, 'Parciales 2026');

    const sampleQuestions = [
      {
        statement: '¿Qué acción de control en un controlador PID elimina el error en estado estacionario ante una entrada escalón?',
        options: [
          { id: 'A', text: 'Acción Proporcional (P)' },
          { id: 'B', text: 'Acción Integral (I)' },
          { id: 'C', text: 'Acción Derivativa (D)' },
          { id: 'D', text: 'Ganancia estática directa' }
        ],
        correctOptionId: 'B',
        explanation: 'La acción integral acumula el error en el tiempo hasta llevar el error en estado estacionario a cero.'
      },
      {
        statement: 'En un lazo de control realimentado, ¿cuál es la función principal del transductor o sensor?',
        options: [
          { id: 'A', text: 'Ejecutar la acción correctiva sobre la válvula' },
          { id: 'B', text: 'Convertir la variable física medida en una señal normalizada' },
          { id: 'C', text: 'Calcular la transformada de Laplace de la planta' },
          { id: 'D', text: 'Aislar galvánicamente la fuente de alimentación' }
        ],
        correctOptionId: 'B',
        explanation: 'El sensor/transductor mide la variable del proceso y la convierte en una señal estándar (ej. 4-20 mA).'
      },
      {
        statement: 'Según el criterio de estabilidad de Routh-Hurwitz, un sistema lineal invariante en el tiempo es estable si:',
        options: [
          { id: 'A', text: 'Todos los coeficientes de la primera columna de la tabla tienen el mismo signo y no son cero' },
          { id: 'B', text: 'Al menos un polo está en el semiplano derecho' },
          { id: 'C', text: 'La ganancia proporcional es infinita' },
          { id: 'D', text: 'El polinomio característico tiene raíces imaginarias puras' }
        ],
        correctOptionId: 'A',
        explanation: 'La ausencia de cambios de signo en la primera columna garantiza que no hay raíces con parte real positiva.'
      },
      {
        statement: '¿Cuál es el rango estándar de corriente analógica más utilizado en instrumentación industrial por su inmunidad al ruido?',
        options: [
          { id: 'A', text: '0 a 5 mA' },
          { id: 'B', text: '4 a 20 mA' },
          { id: 'C', text: '-10 a +10 A' },
          { id: 'D', text: '0 a 100 mA' }
        ],
        correctOptionId: 'B',
        explanation: 'El cero vivo de 4 mA permite distinguir entre el valor mínimo de escala y una línea abierta (0 mA).'
      },
      {
        statement: 'En programación de PLC según IEC 61131-3, ¿qué lenguaje es gráfico y se basa en contactos y bobinas?',
        options: [
          { id: 'A', text: 'Texto Estructurado (ST)' },
          { id: 'B', text: 'Lista de Instrucciones (IL)' },
          { id: 'C', text: 'Diagrama de Escalera (LD / Ladder)' },
          { id: 'D', text: 'C++ embebido' }
        ],
        correctOptionId: 'C',
        explanation: 'Ladder Diagram (LD) emula los esquemas eléctricos de relés mediante contactos y bobinas.'
      },
      {
        statement: '¿Qué efecto produce aumentar excesivamente la ganancia proporcional Kp en un sistema de segundo orden?',
        options: [
          { id: 'A', text: 'Aumenta el sobreimpulso y puede llevar el sistema a la oscilación o inestabilidad' },
          { id: 'B', text: 'Aumenta siempre el tiempo de subida' },
          { id: 'C', text: 'Elimina completamente las oscilaciones' },
          { id: 'D', text: 'Reduce el ancho de banda a cero' }
        ],
        correctOptionId: 'A',
        explanation: 'Una Kp elevada reduce el amortiguamiento relativo, incrementando el sobreimpulso.'
      },
      {
        statement: '¿Qué significa que un actuador neumático sea "Fallo Cerrado" (FC / Air-to-Open)?',
        options: [
          { id: 'A', text: 'Ante pérdida de aire de instrumentación, el resorte cierra la válvula' },
          { id: 'B', text: 'La válvula permanece totalmente abierta sin energía' },
          { id: 'C', text: 'No utiliza diafragma ni resorte' },
          { id: 'D', text: 'Solo funciona con señales digitales Modbus' }
        ],
        correctOptionId: 'A',
        explanation: 'Por seguridad de proceso, el muelle lleva la válvula a posición cerrada si falla el suministro neumático.'
      },
      {
        statement: 'En un diagrama de Bode, el margen de fase se mide en la frecuencia donde:',
        options: [
          { id: 'A', text: 'La fase es exactamente 0 grados' },
          { id: 'B', text: 'La magnitud de la función de transferencia en lazo abierto es 0 dB (ganancia unitaria)' },
          { id: 'C', text: 'La frecuencia tiende a infinito' },
          { id: 'D', text: 'El error en estado estacionario es máximo' }
        ],
        correctOptionId: 'B',
        explanation: 'El margen de fase indica cuánto retraso de fase adicional tolera el sistema en la frecuencia de cruce de ganancia (0 dB).'
      },
      {
        statement: '¿Cuál de los siguientes sensores mide temperatura mediante el efecto Seebeck?',
        options: [
          { id: 'A', text: 'RTD Pt100' },
          { id: 'B', text: 'Termopar (Termocupla)' },
          { id: 'C', text: 'Termistor NTC' },
          { id: 'D', text: 'Galga extensiométrica' }
        ],
        correctOptionId: 'B',
        explanation: 'La unión de dos metales distintos genera una fuerza electromotriz proporcional al gradiente térmico (efecto Seebeck).'
      },
      {
        statement: 'En un sistema SCADA, ¿qué componente realiza la adquisición directa de señales en campo?',
        options: [
          { id: 'A', text: 'RTU / PLC' },
          { id: 'B', text: 'Navegador web del cliente' },
          { id: 'C', text: 'Servidor DNS' },
          { id: 'D', text: 'Impresora térmica' }
        ],
        correctOptionId: 'A',
        explanation: 'Las Unidades Terminales Remotas (RTU) y los PLC interactúan directamente con sensores y actuadores.'
      },
      {
        statement: '¿Qué fenómeno ocurre en un controlador PID cuando el actuador alcanza su límite físico y el término integral sigue acumulando error?',
        options: [
          { id: 'A', text: 'Saturación integral (Integral Windup)' },
          { id: 'B', text: 'Resonancia armónica' },
          { id: 'C', text: 'Histéresis magnética' },
          { id: 'D', text: 'Aliasing de muestreo' }
        ],
        correctOptionId: 'A',
        explanation: 'El Integral Windup provoca grandes sobreimpulsos cuando el error cambia de signo; se mitiga con técnicas anti-windup.'
      },
      {
        statement: 'Según el teorema de muestreo de Nyquist-Shannon, la frecuencia de muestreo debe ser:',
        options: [
          { id: 'A', text: 'Menor que la frecuencia fundamental' },
          { id: 'B', text: 'Estrictamente mayor que el doble de la frecuencia máxima de la señal' },
          { id: 'C', text: 'Igual a la mitad del periodo de establecimiento' },
          { id: 'D', text: 'Independiente del ancho de banda' }
        ],
        correctOptionId: 'B',
        explanation: 'Muestrear a fs > 2·fmax evita el solapamiento espectral (aliasing).'
      },
      {
        statement: '¿Qué protocolo industrial utiliza comunicación diferencial RS-485 con arquitectura maestro-esclavo (cliente-servidor)?',
        options: [
          { id: 'A', text: 'Modbus RTU' },
          { id: 'B', text: 'HDMI 2.1' },
          { id: 'C', text: 'Bluetooth Low Energy' },
          { id: 'D', text: 'DisplayPort' }
        ],
        correctOptionId: 'A',
        explanation: 'Modbus RTU opera comúnmente sobre capa física RS-485 en topología bus.'
      },
      {
        statement: 'La acción derivativa en un controlador PID responde principalmente a:',
        options: [
          { id: 'A', text: 'La velocidad o tasa de cambio del error' },
          { id: 'B', text: 'El promedio histórico del error' },
          { id: 'C', text: 'El valor absoluto del setpoint' },
          { id: 'D', text: 'La resistencia de aislamiento' }
        ],
        correctOptionId: 'A',
        explanation: 'El término derivativo anticipa la tendencia del error proporcionalmente a de(t)/dt.'
      },
      {
        statement: '¿Qué parámetro caracteriza la sensibilidad de una RTD Pt100?',
        options: [
          { id: 'A', text: '100 ohmios a 0 °C con coeficiente aproximado de 0,385 Ω/°C' },
          { id: 'B', text: '100 voltios a 25 °C' },
          { id: 'C', text: 'Resistencia decreciente exponencialmente con la temperatura' },
          { id: 'D', text: 'Salida de frecuencia variable en kHz' }
        ],
        correctOptionId: 'A',
        explanation: 'Pt100 significa Platino con resistencia nominal de 100 Ω a 0 °C.'
      },
      {
        statement: 'En control secuencial con GRAFCET, una transición se franquea cuando:',
        options: [
          { id: 'A', text: 'Todas las etapas inmediatamente anteriores están activas y se cumple su receptividad' },
          { id: 'B', text: 'Se apaga el PLC' },
          { id: 'C', text: 'Todas las etapas del diagrama están inactivas' },
          { id: 'D', text: 'El temporizador llega a negativo' }
        ],
        correctOptionId: 'A',
        explanation: 'Para franquear una transición se requiere que esté validada (etapas previas activas) y su receptividad sea verdadera.'
      }
    ];

    await this.saveImportedDocument({
      subjectId: sub.id,
      folderId: folder.id,
      name: 'Parcial 1 — Fundamentos de Control.docx',
      fileType: 'docx',
      rawContent: 'Banco de ejemplo cargado desde Proba.',
      validatedQuestions: sampleQuestions
    });

    return sub;
  }
}

export const libraryManager = new LibraryManager();
