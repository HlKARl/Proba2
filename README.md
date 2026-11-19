# Proba — PWA de Estudio con Bancos Propios y Campañas RPG

**Proba** es una Aplicación Web Progresiva (PWA) *offline-first* diseñada para funcionar de forma 100% estática en **GitHub Pages**, sin necesidad de servidor propio ni creación de cuentas.

## Características implementadas

1. **Biblioteca Académica (`Materia → Carpetas/Agrupaciones → Documentos → Preguntas`)**:
   - Creación, renombrado y eliminación de materias y documentos con confirmación de seguridad.
   - Agrupación visual por carpetas sin perder el vínculo con la materia.
   - Selección flexible de uno, varios o todos los documentos para alimentar cada partida sin modificar los archivos originales.
2. **Importador Multi-Formato Offline (`.docx`, `.pdf`, `.xlsx`, `.txt`)**:
   - Lectura local directa en el navegador (sin subir tus apuntes a servidores externos).
   - Etapa obligatoria de **previsualización y validación**: detecta preguntas incompletas, nunca adivina respuestas faltantes y permite editar o descartar ítems antes de guardar.
3. **Modos de Sesión**:
   - **Estudio**: repaso con explicaciones inmediatas; no genera oro.
   - **Concurso**: partida evaluativa de 5 a 15 preguntas.
   - **Campaña RPG**: progresión con 4 clases intercambiables (**Ninja**, **Ladrón**, **Mago**, **Berserker**), 5 niveles propios por clase, sacrificios permanentes, niveles fantasma configurables, puntos de control cada 5 preguntas, oro compartido y activación automática de **Frenesí** al responder antes de 150 segundos (sin límite de tiempo global ni penalización por tardar más).
4. **Parámetros Configurables (`Ajustes`)**:
   - Todos los puntos marcados como *Por confirmar* (duración de campaña, efecto/duración de Frenesí, requisitos de niveles fantasma, catálogo inicial de comodines y umbral del Berserker) son configurables desde la interfaz.
   - Incluye respaldo/restauración JSON de IndexedDB y una **Suite de Verificación Automatizada** de 18 pruebas.

---

## Ejecución local

Al utilizar módulos ES (`type="module"`) y Service Worker, sirve la carpeta mediante cualquier servidor HTTP estático local:

```bash
# Opción 1: Python 3
python3 -m http.server 8080

# Opción 2: Node.js (npx serve)
npx serve .
```

Abre `http://localhost:8080` en tu navegador.

---

## Publicación en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo, `proba-pwa`).
2. Sube todo el contenido de esta carpeta a la rama `main` (asegurándote de que `index.html`, `manifest.json` y `sw.js` estén en la raíz del repositorio o de la carpeta `/docs`).
3. En GitHub, ve a **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**, elige la rama `main` y la carpeta `/ (root)`.
5. Guarda los cambios. Todas las rutas de Proba (`./manifest.json`, `./sw.js`, `./assets/...`, `./js/...`) son relativas, por lo que funcionará tanto en `https://<usuario>.github.io/<repositorio>/` como en dominios personalizados, y podrá instalarse como app de escritorio o móvil con soporte completo sin conexión.
