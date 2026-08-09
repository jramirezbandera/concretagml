// scripts/smoke-navegador/03-arrastre.js — F03 · Fase 4, Tarea 4D.1.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// CRITERIO DE ACEPTACIÓN 3 de F03: «arrastrar un vértice mueve el dibujo Y la
// tabla». Arrastra el vértice 1 del EXTERIOR y comprueba que cambian, a la vez y
// por el MISMO `estado.set`:
//   1. `input[data-eje="x"]` de `tr[data-recinto="0"][data-indice="0"]` (tabla),
//   2. el atributo `d` del `<path>` del polígono editado (mapa),
//   3. `dd[data-ficha="superficie"]` (la ficha del pie de `app/main.js`, que es
//      el SEGUNDO suscriptor del mismo store).
// Si cambiara solo uno, el criterio 3 estaría roto y hay que reportarlo: por eso
// los tres van en `cambios` y los tres pesan en el `ok`.
//
// Además comprueba lo que hace POSIBLE el arrastre (hallazgo C8): que el render
// es idempotente y NO recrea ni el marcador ni la fila que se está manipulando
// (`marcadorReutilizado`, `filaReutilizada`). Un render que los recreara perdería
// el gesto a mitad.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
// **Esto NO es un gesto de ratón real.** `/browse` no tiene comando `drag`, y la
// vía de escape por CDP está cerrada: su allowlist es *deny-default* y el dominio
// `Input` no aparece en ella, así que `Input.dispatchMouseEvent` es inalcanzable.
// El único camino son EVENTOS SINTÉTICOS, que sí disparan `L.Draggable` porque
// Leaflet no comprueba `isTrusted`.
// Lo que este guion prueba de verdad —y no es poco, porque es justo lo que jsdom
// no puede— es el arrastre **en un navegador real, con layout, CSS y proyección
// reales**: rectángulos de verdad, `getBoundingClientRect` de verdad,
// `translate3d` de verdad, `L.Draggable`/`MarkerDrag` de verdad y la cadena
// completa marcador → store → tabla → polígono → ficha.
// Lo que NO prueba: que el ratón del usuario llegue al marcador (hit-testing,
// `pointer-events`, cursores, z-index efectivo, tamaño del área de agarre). Eso
// es el CHECKLIST HUMANO DE LA FASE 5. Que nadie lea este smoke como «el
// arrastre está probado con ratón».
//
// ── DETALLES QUE HAY QUE ACERTAR O `L.Draggable` IGNORA EL GESTO ────────────
// (verificados leyendo `node_modules/leaflet/dist/leaflet-src.js` 1.9.4)
//   · El marcador se localiza por su `title` (`'EXTERIOR · vértice 1'`, que pone
//     `viewer/sincronizacion.js#crearMarcador` y Leaflet copia al icono en
//     `Marker#_initIcon`): hook SEMÁNTICO y estable, mucho mejor que el orden del
//     DOM (que cambia con el zoom y con cada reconstrucción).
//   · `mousedown` **sobre el icono**: `MarkerDrag.addHooks` hace
//     `new Draggable(icon, icon, true)`, o sea que el `dragStartTarget` ES el
//     icono. Con `button: 0` — Leaflet exige `e.which === 1`, y el `which` de un
//     `MouseEvent` sintético es `button + 1`. `bubbles: true` y `clientX/clientY`
//     en el CENTRO de su `getBoundingClientRect()`.
//   · `mousemove` y `mouseup` los engancha Leaflet EN `document` (`_onDown`), así
//     que basta con que burbujeen. Se disparan sobre **`document.body`, NO sobre
//     `document`**: en el primer movimiento efectivo Leaflet hace
//     `addClass(e.target, 'leaflet-drag-target')`, y con `e.target === document`
//     eso REVIENTA (`document.classList` es `undefined`, así que `addClass` cae a
//     `getClass`, que lee `document.className.baseVal` de un `undefined` →
//     TypeError) y se lleva por delante el arrastre entero. Con `body` como
//     `target` el listener de `document` lo recibe igual por burbujeo.
//   · VARIOS `mousemove` con desplazamiento CRECIENTE: el primero debe superar el
//     `clickTolerance` (3 px, distancia manhattan) o `_onMove` sale sin arrastrar.
//   · No hace falta `stopPropagation`: el `Draggable._dragging` GLOBAL impide que
//     el mapa paneé a la vez (el primero que engancha gana, y aquí engancha el
//     marcador porque su listener está en el icono, más profundo).
//   · Si un gesto anterior se quedó SIN `mouseup`, ese mismo `_dragging` global
//     queda alto y ningún arrastre posterior engancha. De ahí el `mouseup` de
//     saneamiento del principio.
//
// ── ESTADO EN QUE DEJA LA APP ───────────────────────────────────────────────
// El vértice queda MOVIDO (y la superficie cambiada): este guion no restaura la
// geometría a propósito, para que la evidencia quede visible en una captura. Por
// eso `02-wms-encuadre.js` va ANTES en el runbook y una repetición pide
// `$B reload`.
//
// ── NOTAS DE EJECUCIÓN ──────────────────────────────────────────────────────
//   · `browse` envuelve el fichero en `(async()=>{ … })()` porque contiene
//     `await` real; de ahí que el `return` de nivel superior sea legal.
//   · Ejecución: `$B goto …/concretagml/?demo=real#/parcela/edicion` (⚠️ con el
//     hash EN EL `goto`: cambiar solo el hash no recarga el documento) y después
//     `$B eval scripts/smoke-navegador/03-arrastre.js`.
//
// ── ⛔ LA GUARDA DE PASO, Y POR QUÉ LLEVABA MESES HACIENDO FALTA ────────────
// Este guion salía `ok:false` con TRES problemas —«la tabla no refleja el
// gesto», «el `d` del polígono no cambia», «la superficie no cambia»— y los tres
// eran FALSOS: describían un arrastre que la aplicación tenía apagado a
// propósito en la pantalla en la que el guion aterrizaba. La rebanada 3 del
// rework ató los cuatro gestos a la pantalla de Edición y `08-edicion.js` se
// puso su guarda entonces; éste no, y desde entonces acusaba a la aplicación de
// un defecto suyo.
//
// La guarda va AQUÍ y no en una nota del GUION por la lección de T10: las notas
// del GUION no se leen cuando el guion ya está corriendo.

/** Recinto y vértice que se arrastra (0-based, como `RefVertice`). */
const REF = { recinto: 0, indice: 0 }

/** Rótulo del recinto 0 en `viewer/sincronizacion.js#rotuloRecinto`. */
const ROTULO_RECINTO = 'EXTERIOR'

/** Desplazamiento total del gesto, en píxeles CSS. */
const GESTO_PX = { dx: 64, dy: -38 }

/** Tope de espera hasta que el `dragend` propague por el store. */
const TOPE_ESPERA_MS = 2000

const t0 = performance.now()
/** @type {string[]} */
const problemas = []

const pasoActivo = document.querySelector('[data-paso]')?.dataset.paso ?? null
if (pasoActivo !== null && pasoActivo !== 'edicion') {
  return {
    guion: '03-arrastre',
    feature: 'F03',
    tarea: '4D.1',
    ok: false,
    url: location.href,
    pasoActivo,
    problemas: [
      `Este guion arrastra un vértice y la aplicación está en «${pasoActivo}». Desde la rebanada 3 ` +
        'del rework los gestos de edición del mapa solo viven en la pantalla de Edición, así que ' +
        'aquí no hay nada que medir y los tres fallos que reportaría serían falsos. Relánzalo ' +
        'sobre `#/parcela/edicion` (con el hash en el `goto`: cambiar solo el hash NO recarga).',
    ],
    advertencias: [],
  }
}

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

async function esperarHasta(condicion, topeMs, pasoMs = 40) {
  const inicio = performance.now()
  for (;;) {
    let cumple = false
    try {
      cumple = Boolean(condicion())
    } catch {
      cumple = false
    }
    if (cumple) return { cumplido: true, ms: Math.round(performance.now() - inicio) }
    if (performance.now() - inicio >= topeMs) {
      return { cumplido: false, ms: Math.round(performance.now() - inicio) }
    }
    await dormir(pasoMs)
  }
}

const contenedor = document.querySelector('.leaflet-container')
if (contenedor === null) {
  return {
    guion: '03-arrastre',
    criterio: 3,
    ok: false,
    problemas: ['No hay `.leaflet-container`: el visor no ha montado.'],
  }
}

// ── Localización de las tres vistas ─────────────────────────────────────────

const tituloEsperado = `${ROTULO_RECINTO} · vértice ${REF.indice + 1}`
const iconos = [...document.querySelectorAll('.leaflet-marker-icon[title]')]
const icono =
  iconos.find((el) => el.title === tituloEsperado) ||
  iconos.find(
    (el) => el.title.startsWith(ROTULO_RECINTO) && el.title.endsWith(`vértice ${REF.indice + 1}`),
  ) ||
  null

const selectorFila = `tr[data-recinto="${REF.recinto}"][data-indice="${REF.indice}"]`
const fila = document.querySelector(`#tabla-vertices ${selectorFila}`)
const inputX = fila === null ? null : fila.querySelector('input[data-eje="x"]')
const inputY = fila === null ? null : fila.querySelector('input[data-eje="y"]')
// Pane `parcelaEditada` de `viewer/_comun.js#PANE`; Leaflet nombra su div
// `leaflet-<nombre sin 'Pane'>-pane`, y las clases del DOM distinguen mayúsculas.
const camino = document.querySelector('.leaflet-parcelaEditada-pane path')
const fichaSuperficie = document.querySelector('dd[data-ficha="superficie"]')
const fichaVertices = document.querySelector('dd[data-ficha="vertices"]')

if (icono === null) {
  problemas.push(
    `No se ha encontrado el marcador '${tituloEsperado}'. Títulos presentes: ` +
      `${JSON.stringify(iconos.map((el) => el.title).slice(0, 8))}` +
      `${iconos.length > 8 ? ` …y ${iconos.length - 8} más` : ''}.`,
  )
}
if (inputX === null) problemas.push(`No hay \`${selectorFila} input[data-eje="x"]\` en la tabla.`)
if (camino === null) {
  problemas.push(
    'No hay `<path>` en `.leaflet-parcelaEditada-pane`: el polígono editado no está pintado.',
  )
}
if (fichaSuperficie === null) problemas.push('No hay `dd[data-ficha="superficie"]` en el pie.')

if (icono === null || inputX === null || camino === null || fichaSuperficie === null) {
  return {
    guion: '03-arrastre',
    criterio: 3,
    ok: false,
    tituloBuscado: tituloEsperado,
    problemas,
    ms: Math.round(performance.now() - t0),
  }
}

// ── Medida ANTES ────────────────────────────────────────────────────────────

const rectAntes = icono.getBoundingClientRect()
const antes = {
  x: inputX.value,
  y: inputY === null ? null : inputY.value,
  d: camino.getAttribute('d'),
  superficie: fichaSuperficie.textContent,
  vertices: fichaVertices === null ? null : fichaVertices.textContent,
  transformIcono: icono.style.transform,
  centroIcono: { x: Math.round(rectAntes.x + rectAntes.width / 2), y: Math.round(rectAntes.y + rectAntes.height / 2) },
  ladoIconoPx: [Math.round(rectAntes.width), Math.round(rectAntes.height)],
  marcadoresEnMapa: document.querySelectorAll('.leaflet-marker-icon').length,
  filasEnTabla: document.querySelectorAll('#tabla-vertices tr[data-indice]').length,
}

// ── El arrastre sintético ───────────────────────────────────────────────────

const base = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 }
const desde = antes.centroIcono

// Saneamiento: un `mouseup` suelto fuerza el `finishDrag` de un gesto anterior
// que se hubiera quedado a medias (si no hay ninguno, es inofensivo: `_onUp` solo
// está enganchado en `document` MIENTRAS se arrastra).
document.body.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }))

// Desplazamiento CRECIENTE. El primer paso (6 px en x) ya supera el
// `clickTolerance` de 3 px; los siguientes llevan el vértice al destino.
const recorrido = [
  [6, -2],
  [Math.round(GESTO_PX.dx * 0.35), Math.round(GESTO_PX.dy * 0.35)],
  [Math.round(GESTO_PX.dx * 0.7), Math.round(GESTO_PX.dy * 0.7)],
  [GESTO_PX.dx, GESTO_PX.dy],
]

icono.dispatchEvent(
  new MouseEvent('mousedown', { ...base, buttons: 1, clientX: desde.x, clientY: desde.y }),
)

const engancho = { dragging: false, dragTarget: false, porPaso: [] }
for (const [dx, dy] of recorrido) {
  document.body.dispatchEvent(
    new MouseEvent('mousemove', { ...base, buttons: 1, clientX: desde.x + dx, clientY: desde.y + dy }),
  )
  const arrastrando = document.body.classList.contains('leaflet-dragging')
  const objetivo = document.body.classList.contains('leaflet-drag-target')
  if (arrastrando) engancho.dragging = true
  if (objetivo) engancho.dragTarget = true
  engancho.porPaso.push({ dx, dy, dragging: arrastrando, transform: icono.style.transform })
  await dormir(24)
}

const transformEnVuelo = icono.style.transform
const valorXEnVuelo = inputX.value

document.body.dispatchEvent(
  new MouseEvent('mouseup', {
    ...base,
    buttons: 0,
    clientX: desde.x + GESTO_PX.dx,
    clientY: desde.y + GESTO_PX.dy,
  }),
)

// `dragend` → `aplicarVertice` → `estado.set` → los DOS suscriptores (el visor y
// la ficha del pie). Se espera por la SUPERFICIE y no por el input de la tabla:
// la tabla se actualiza también EN VUELO (en cada `drag`, sin pasar por el
// store), así que su cambio no distingue «el gesto pintó» de «el gesto se
// commiteó». La superficie solo la reescribe el suscriptor del store, así que su
// cambio ES la prueba del `estado.set` del `dragend`.
const espera = await esperarHasta(
  () => fichaSuperficie.textContent !== antes.superficie,
  TOPE_ESPERA_MS,
)

// ── Medida DESPUÉS ──────────────────────────────────────────────────────────

const iconoDespues = [...document.querySelectorAll('.leaflet-marker-icon[title]')].find(
  (el) => el.title === icono.title,
)
const filaDespues = document.querySelector(`#tabla-vertices ${selectorFila}`)
const inputXDespues = filaDespues === null ? null : filaDespues.querySelector('input[data-eje="x"]')
const caminoDespues = document.querySelector('.leaflet-parcelaEditada-pane path')
const rectDespues = icono.getBoundingClientRect()

const despues = {
  x: inputX.value,
  y: inputY === null ? null : inputY.value,
  d: caminoDespues === null ? null : caminoDespues.getAttribute('d'),
  superficie: fichaSuperficie.textContent,
  vertices: fichaVertices === null ? null : fichaVertices.textContent,
  transformIcono: icono.style.transform,
  centroIcono: {
    x: Math.round(rectDespues.x + rectDespues.width / 2),
    y: Math.round(rectDespues.y + rectDespues.height / 2),
  },
  marcadoresEnMapa: document.querySelectorAll('.leaflet-marker-icon').length,
  filasEnTabla: document.querySelectorAll('#tabla-vertices tr[data-indice]').length,
}

const cambios = {
  x: antes.x !== despues.x,
  y: antes.y !== despues.y,
  d: antes.d !== despues.d,
  superficie: antes.superficie !== despues.superficie,
  transformIcono: antes.transformIcono !== despues.transformIcono,
  // El nº de vértices NO debe cambiar: arrastrar mueve, no añade (eso es F06).
  numeroDeVertices: antes.vertices !== despues.vertices,
}

// Idempotencia del render (hallazgo C8): ni el marcador ni la fila se recrean.
const marcadorReutilizado = iconoDespues === icono && document.contains(icono)
const filaReutilizada = inputXDespues === inputX && document.contains(inputX)

if (!engancho.dragging) {
  problemas.push(
    'El arrastre sintético NO enganchó: `document.body` nunca tuvo la clase ' +
      '`leaflet-dragging`. Causas típicas: `button` distinto de 0 (Leaflet exige ' +
      '`which === 1`), primer movimiento por debajo del `clickTolerance` (3 px), o un ' +
      '`Draggable._dragging` global que quedó alto por un gesto anterior sin `mouseup` ' +
      '(recarga la página y repite).',
  )
}
if (!cambios.x) {
  problemas.push(
    `El input X de ${selectorFila} NO ha cambiado tras el arrastre (sigue en ${antes.x}): ` +
      'la tabla no está reflejando el gesto.',
  )
}
if (!cambios.d) {
  problemas.push(
    'El atributo `d` del polígono editado NO ha cambiado: el dibujo no refleja el gesto.',
  )
}
if (!cambios.superficie) {
  problemas.push(
    'La superficie de la ficha del pie NO ha cambiado: el SEGUNDO suscriptor del store no ' +
      'reacciona (o `superficie()` no se recalcula).',
  )
}
if (cambios.numeroDeVertices) {
  problemas.push(
    `El nº de vértices ha cambiado (${antes.vertices} → ${despues.vertices}): arrastrar mueve ` +
      'un vértice, no añade ni quita (insertar es F06).',
  )
}
if (!marcadorReutilizado) {
  problemas.push(
    'El marcador se ha RECREADO durante el gesto (el nodo del icono ya no es el mismo): con eso ' +
      'un arrastre real se perdería a mitad (hallazgo C8, render idempotente).',
  )
}
if (!filaReutilizada) {
  problemas.push(
    'La fila de la tabla se ha RECREADO durante el gesto: se perdería el foco y la selección ' +
      'de texto de la celda en edición (hallazgo C8).',
  )
}
if (antes.marcadoresEnMapa !== despues.marcadoresEnMapa) {
  problemas.push(
    `El nº de marcadores en el mapa ha cambiado (${antes.marcadoresEnMapa} → ` +
      `${despues.marcadoresEnMapa}).`,
  )
}

return {
  guion: '03-arrastre',
  criterio: 3,
  ok: problemas.length === 0,
  esGestoDeRatonReal: false,
  aviso:
    'Arrastre por EVENTOS SINTÉTICOS en navegador real (layout, CSS y proyección reales). ' +
    'NO es un gesto de ratón: /browse no tiene comando `drag` y su allowlist CDP no incluye ' +
    'el dominio `Input`. El gesto humano es del checklist de la fase 5.',
  marcador: {
    tituloBuscado: tituloEsperado,
    tituloEncontrado: icono.title,
    clases: icono.className,
    ladoIconoPx: antes.ladoIconoPx,
    centroAntes: antes.centroIcono,
    centroDespues: despues.centroIcono,
    desplazamientoMedidoPx: {
      dx: despues.centroIcono.x - antes.centroIcono.x,
      dy: despues.centroIcono.y - antes.centroIcono.y,
    },
    desplazamientoPedidoPx: GESTO_PX,
    reutilizado: marcadorReutilizado,
  },
  engancho,
  enVuelo: {
    // Durante el gesto `sincronizacion.js` escribe la fila y repinta el polígono
    // SIN pasar por el store (un `set` por gesto, no por frame): si `valorX` ya
    // había cambiado antes del `mouseup`, es que el camino incremental funciona.
    transformIcono: transformEnVuelo,
    valorX: valorXEnVuelo,
    tablaActualizadaEnVuelo: valorXEnVuelo !== antes.x,
  },
  antes,
  despues,
  cambios,
  filaReutilizada,
  // Tiempo hasta que el `estado.set` del `dragend` llegó al SEGUNDO suscriptor
  // (la ficha del pie). Ver el comentario de la espera.
  msHastaCommit: espera.ms,
  commitAntesDelTope: espera.cumplido,
  problemas,
  ms: Math.round(performance.now() - t0),
}
