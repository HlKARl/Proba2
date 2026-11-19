# PROBA — Aventura de conocimiento

PWA de estudio gamificado, diseñada para funcionar en GitHub Pages y guardar la biblioteca, las preguntas, el oro y el progreso localmente en el dispositivo.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `proba`.
2. Sube **todos los archivos de esta carpeta** a la raíz del repositorio (no subas la carpeta comprimida dentro del repositorio).
3. En el repositorio entra a **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**, elige `main` y la carpeta `/ (root)`, y guarda.
5. Cuando GitHub termine el despliegue, abre la dirección que te muestre Pages. En un repositorio llamado `proba` normalmente será `https://TU-USUARIO.github.io/proba/`.

La aplicación usa rutas relativas, por lo que funciona tanto en un dominio propio como en una página de proyecto de GitHub Pages. Se recomienda abrirla una vez con conexión para que el navegador instale el Service Worker y guarde la aplicación para uso sin conexión.

## Importar preguntas

En **Inicio**, crea una materia y luego importa uno o varios documentos. Puedes organizar, revisar, editar y eliminar bancos dentro de cada materia. En **Aventura**, activa una vez los documentos que quieras usar: Proba recordará esa selección para las siguientes partidas y añadirá automáticamente los nuevos documentos que importes.

Formatos disponibles:

- `.txt` y `.md`: formato de pregunta mostrado en `plantilla-preguntas-proba.txt`.
- `.csv`: primera fila con encabezados `Pregunta,A,B,C,D,Respuesta,Explicación`.
- `.docx`: preguntas escritas en párrafos con el mismo formato de la plantilla.
- `.xlsx`: la primera hoja debe tener encabezados `Pregunta`, `A`, `B`, `C`, `D`, `Respuesta` y, opcionalmente, `Explicación`.
- `.pdf`: debe tener texto seleccionable. El lector PDF se carga desde un CDN la primera vez que se importa un PDF; por eso la primera importación de PDF requiere conexión. Los PDF escaneados no tienen OCR integrado.

Cada pregunta debe incluir opciones y una respuesta correcta (`Respuesta: B`, por ejemplo). La explicación es opcional. En archivos de texto se reconocen los encabezados numerados `Pregunta 1:`, `Pregunta 2:`, etc., aunque el extractor del documento no conserve líneas en blanco entre preguntas. También se admiten bloques separados por líneas en blanco y etiquetas como `Respuesta correcta: B`. Después de importar, revisa el contador de preguntas del documento antes de iniciar una campaña.

## Reglas iniciales del juego

### Campaña

- Tres niveles: 5, 10 y 15 preguntas (30 en total).
- Cada múltiplo de cinco es un punto de control.
- Oro inicial: 1.000.
- Una respuesta correcta otorga 1.000 de oro la primera vez que se domina esa pregunta (el Berserker aplica su multiplicador). Una pregunta ya dominada no vuelve a dar oro, aunque se repita o se importe en otro documento.
- Los bancos activos se deduplican por enunciado y alternativas: una misma pregunta no puede aparecer varias veces en una campaña por estar repetida en varios documentos.
- Los bonos de nivel (5.000, 10.000 y 15.000; con el multiplicador de clase) solo se pagan cuando al menos el 60 % de las preguntas de ese nivel se dominan por primera vez. Este umbral permite que el Ninja obtenga el bono aunque esquive dos preguntas por cada tres aciertos. La bonificación final de victoria (10.000; Berserker 50.000) requiere que al menos el 60 % de la campaña sean preguntas nuevas dominadas.
- Retirarse conserva todo el oro ganado durante la campaña.
- Si una clase normal falla, conserva lo asegurado en puntos de control y pierde lo ganado desde el último punto de control.
- Completar la campaña con al menos el 60 % de preguntas nuevas dominadas concede una bonificación general de 10.000 (Berserker: 50.000).
- Si se completan los niveles I y II en menos de cinco minutos, se activa Frenesí: comodines ilimitados durante 90 segundos en el nivel III.
- Las respuestas se confirman con dos pulsaciones: una para seleccionar y otra sobre la misma opción para confirmar.

### Clases

- **Ninja:** cada tres respuestas correctas permite saltar las dos preguntas siguientes. Las preguntas saltadas cuentan para avanzar por la campaña, pero no dan oro por respuesta.
- **Ladrón:** elimina una alternativa incorrecta en cada pregunta.
- **Mago:** convierte automáticamente el primer error de la campaña en un acierto y revela la respuesta correcta.
- **Berserker:** gana el doble por cada acierto. Necesita tener oro general mayor que cero para entrar. Si pierde, pierde todo el oro de esa campaña —incluido lo que habría quedado asegurado— y además pierde el 10 % de su oro general. Si se retira o gana, conserva el oro de campaña; completar la campaña concede una bonificación especial de 50.000, mayor que la bonificación de las otras clases.

Cada clase tiene su propio árbol de cinco rangos (nivel inicial y cuatro nodos). Los niveles fantasma no conceden una mejora directa, pero deben comprarse para desbloquear la siguiente habilidad. El oro es compartido entre todas las clases. La selección de clase y la compra de sus mejoras se realizan juntas en **Personaje**; ya no existe una pestaña de Tienda separada. Precios iniciales: clases normales 100.000, 400.000, 650.000 y 1.000.000; Berserker 200.000, 700.000, 1.100.000 y 1.800.000. El árbol completo requiere una inversión considerable; los precios del Berserker son mayores porque su potencial de recompensa también lo es.

### Modo Estudio

Práctica sin temporizador ni penalizaciones. Una respuesta correcta otorga oro solamente la primera vez que se domina una pregunta nueva; repetir preguntas ya dominadas no genera oro. Se muestra una sola pregunta a la vez. Después de acertar o revisar un error, se utiliza el botón `Siguiente pregunta` para avanzar. Al responder mal, muestra la respuesta correcta y la explicación si fue importada; los errores quedan guardados para repasarlos desde el resultado y el Registro.

## Almacenamiento y respaldo

- La biblioteca y el progreso se guardan en IndexedDB (con alternativa a localStorage).
- Los datos no se sincronizan con una cuenta ni se suben a un servidor.
- Desde el engranaje de **Configuración** puedes exportar una copia JSON o restaurarla en otro dispositivo.
- Borrar los datos del navegador sin una copia puede eliminar el progreso.

## Personalización inicial

Los valores iniciales de recompensa, precios, mejoras de clase y duración de Frenesí se encuentran al inicio de `app.js`, en `DEFAULT_STATE`, `SKILLS` y `LEVELS`.

## Cambios de la versión 3.1

- La selección de documentos queda guardada y se reutiliza en las próximas partidas; los documentos recién importados se añaden automáticamente a las fuentes activas.
- Se eliminó la pestaña Tienda: selección de clase, árbol de habilidades y compras están reunidos en Personaje. La clase activa se recuerda.
- La partida usa una composición de pantalla fija que adapta la distribución según orientación y tamaño; los controles se reorganizan en vez de reducir toda la interfaz o exigir desplazamiento vertical.
- Se elevaron nuevamente los precios de los cuatro nodos de cada clase: 100.000 / 400.000 / 650.000 / 1.000.000 para Ninja, Ladrón y Mago; 200.000 / 700.000 / 1.100.000 / 1.800.000 para Berserker.
- Se renovó la caché del Service Worker a `proba-v3.1`.

## Cambios de la versión 3.2

- La pantalla de juego mantiene la pregunta, las cuatro alternativas y el feedback en una posición estable antes y después de responder. En móvil deja de esconder el encabezado o las opciones no seleccionadas y reorganiza los controles sin pedir desplazamiento de página.
- El oro se concede una sola vez por pregunta dominada. La huella de conocimiento usa el enunciado y las alternativas normalizadas, así que importar de nuevo un banco o repetir una pregunta no vuelve a generar oro.
- Las preguntas duplicadas entre documentos se deduplican al contar el banco y al formar la campaña.
- Los bonos de nivel se otorgan cuando al menos el 60 % de las preguntas del nivel son nuevas y se dominan por primera vez. La bonificación final requiere que al menos el 60 % de la campaña sean preguntas nuevas dominadas; así la habilidad de saltos del Ninja no elimina por completo sus recompensas de nivel.
- Modo Estudio también puede recompensar el primer dominio de una pregunta, sin temporizador ni penalizaciones; los aciertos repetidos no pagan.
- Configuración incorpora `Restablecer oro y personaje`: devuelve 1.000 de oro, bloquea las mejoras y limpia el historial, pero conserva la biblioteca y el registro de preguntas ya dominadas para impedir volver a farmear el mismo contenido.
- Se renueva la caché del Service Worker a `proba-v3.2`.

## Correcciones de la versión 2

- La lectura de preguntas numeradas ya no depende de líneas en blanco; esto evita fusionar preguntas al extraer texto de PDF/DOCX.
- Se añadió avance explícito con el botón `Siguiente pregunta` en Estudio y tras acertar en Campaña.
- Se añadió un bloqueo de respuesta para evitar que una misma pregunta se contabilice dos veces.
- El saldo inicial es de 1.000 de oro. Los perfiles de la versión anterior que tenían el saldo inicial de 0 reciben el saldo inicial durante la migración.
- La interfaz limita el desbordamiento horizontal y adapta la vista de partida a pantallas estrechas y de poca altura.
- Se renovó la caché del Service Worker para que GitHub Pages descargue los archivos corregidos.

## Cambios de la versión 3.3

- **Mago (Dados del destino):** al llegar a la pregunta 10 lanza un dado con 6 efectos especiales: multiplicar por ×4 el oro en adelante, saltar 10 preguntas, reducir a la mitad las preguntas restantes (saltando una de cada dos), regresar a la pregunta 1 conservando el oro acumulado, añadir 5 preguntas adicionales o robar 2 comodines extra.
- **Progresión de 5 niveles con sacrificios y maestrías:** las cuatro clases (Ninja, Ladrón, Mago y Berserker) cuentan con Nivel I (Inicial), Nivel II (Sacrificio), Nivel III (Mejora), Nivel IV (Sacrificio) y Nivel V (Maestría).
- **Frenesí ajustado:** se activa al completar los dos primeros niveles en menos de 150 segundos (2 min y medio) y otorga comodines ilimitados durante 45 segundos en el Nivel III.
- **Comodín Hint y balance de combinaciones:** el comodín de pista pasa a llamarse **Hint**. Solo se permite 1 comodín por pregunta y siempre permanecen al menos 2 alternativas activas (evitando combinaciones automáticas como 50/50 + Reintentar o Ladrón + 50/50 que dejaban 1 sola respuesta).
- **Desplazamiento vertical dentro de la pantalla única:** la tarjeta de pregunta y respuestas admite desplazamiento vertical suave cuando los enunciados o alternativas son extensos, manteniendo fijos la cabecera, el progreso y el panel lateral.
- **Caché actualizada:** Service Worker renovado a `proba-v3.3`.
