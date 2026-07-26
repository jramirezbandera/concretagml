// scripts/smoke-navegador/02-wms-encuadre.js — F03 · Fase 4, Tarea 4D.1.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// CRITERIO DE ACEPTACIÓN 2 de F03, el que de verdad no se puede probar en jsdom:
// **1 petición `GetMap` por capa WMS del Catastro VISIBLE y por encuadre**, con
// la imagen al TAMAÑO DEL LIENZO y sin rastro de mosaico. Se mide con el
// Resource Timing del propio navegador —no parseando la salida de `$B network`—:
// `performance.clearResourceTimings()` antes de cada acción y
// `performance.getEntriesByType('resource')` filtrado por `ServidorWMS.aspx`
// después. Devuelve el NÚMERO de peticiones y sus URLs COMPLETAS, de donde se
// leen `WIDTH`, `HEIGHT` y `BBOX`.
//
// Cuatro acciones: carga inicial · pan · zoom · «pan nulo».
//
// ── LA EXPECTATIVA SE **DERIVA**, NO ES UN NÚMERO MÁGICO ────────────────────
// El criterio real (cabecera de `viewer/capas.js` y punto 9 de
// `viewer/wms-catastro.js`) es «1 petición por INSTANCIA WMS VISIBLE»:
//   · base PNOA + superpuesta catastral ⇒ **1** por encuadre;
//   · base Catastro + superpuesta       ⇒ **2** por encuadre, y eso es CORRECTO
//     (son dos imágenes distintas: una opaca sin transparencia y otra con
//     `TRANSPARENT=TRUE`). Lo que el criterio prohíbe es el MOSAICO.
// Por eso `esperadas` se calcula contando las instancias WMS que hay en el mapa
// (`img.leaflet-image-layer[alt="…"]`, ver hooks abajo), no escribiendo un 1.
//
// ── QUÉ **NO** PUEDE MEDIR ──────────────────────────────────────────────────
//   · Códigos HTTP y cabeceras CORS: el Resource Timing no los expone. Los da
//     `$B network` (estados) y `$B network --capture` + `--export` (cabeceras).
//     El runbook cruza las dos medidas.
//     ⚠️ Dato ya medido contra el servicio real (2026-07-26): los ERRORES del
//     WMS del Catastro llegan como `ServiceExceptionReport` en `text/xml` **con
//     HTTP 200**, así que «todo 200» NO significa «todo bien»; lo que delata el
//     fallo es el `onerror` del `<img>` (fallo de decodificación) y, en la UI, la
//     tarjeta del panel de avisos.
//   · El techo silencioso de 4000 px por eje del servicio: aquí el tamaño es el
//     del lienzo (1048×900 con el viewport del runbook), muy por debajo. Es F09
//     quien se lo topa (`MAX_PIXELES_WMS`).
//   · El «pan nulo» **con `moveend` de encuadre IDÉNTICO** (la deduplicación por
//     URL de la decisión 3 de `viewer/wms-catastro.js`). Eso necesita
//     `mapa.panBy([0,0])` y `app/main.js` no expone el mapa a propósito (no hay
//     `window.__gml`). Lo que este guion mide es la otra mitad, la que sí es
//     alcanzable desde el DOM: **un gesto que no llega a mover el mapa cuesta 0
//     peticiones**. La deduplicación por URL está cubierta en
//     `test/viewer/wms-catastro.dom.test.js` (jsdom) y en el banco 2D.1.
//   · Un gesto de RATÓN real: el pan va con eventos sintéticos (ver 03).
//
// ── HOOKS SEMÁNTICOS QUE USA (y por qué son estables) ───────────────────────
//   · `img.leaflet-image-layer[alt="Cartografía catastral del encuadre actual"]`
//     → las instancias del WMS. El `alt` lo pone `viewer/wms-catastro.js`
//     (`options.alt`) y es el ÚNICO hook que las identifica antes de su primera
//     imagen (hasta entonces su `src` es el GIF 1×1 `L.Util.emptyImageUrl`).
//   · `#mapa` → `mapa.getSize()` ES `[#mapa.clientWidth, #mapa.clientHeight]`
//     (`Map#getSize` lee el contenedor), tal como documenta `app/main.js`. Así
//     se compara WIDTH/HEIGHT sin necesitar el objeto mapa.
//   · `.leaflet-map-pane` → su `transform` es el desplazamiento del pan: prueba
//     de que el pan sintético movió el mapa DE VERDAD.
//   · `.leaflet-control-zoom-in` → el botón `+` de Leaflet.
//   · `document.body.classList.contains('leaflet-dragging')` → Leaflet la pone
//     en `Draggable._onMove` en cuanto el gesto supera el `clickTolerance`: es la
//     prueba de que el arrastre sintético ENGANCHÓ (y su ausencia distingue «0
//     peticiones porque el pan no movió nada» de «0 peticiones porque hay un
//     bug», que es el falso positivo peligroso de este guion).
//
// ── NOTAS DE EJECUCIÓN ──────────────────────────────────────────────────────
//   · Este guion tiene que correr sobre una página RECIÉN CARGADA (`$B goto` o
//     `$B reload`): la medida «carga inicial» lee las entradas acumuladas desde
//     la carga, y cualquier conmutación de capa previa las contamina. Va PRIMERO
//     en el runbook por eso, y lo comprueba (`cargaInicialContaminada`).
//   · `browse` envuelve el fichero en `(async()=>{ … })()` porque contiene
//     `await` real; de ahí que el `return` de nivel superior sea legal.
//   · `$B` corta cualquier comando a los **30 s**. Hay tope por acción y tope
//     total; si se agota, se dice (`abortadoPorTiempo`).
//   · El buffer de Resource Timing del navegador guarda 250 entradas por
//     defecto; en `npm run dev` la app carga ~100-150 recursos (módulos sin
//     empaquetar + teselas). Se sube a 2000 al empezar y se informa del total
//     para que un desbordamiento no pase por «menos peticiones».

/** Tope de espera por acción hasta ver las peticiones esperadas. */
const TOPE_ESPERA_MS = 3500

/** Presupuesto total (el comando entero muere a los 30 s). */
const TOPE_TOTAL_MS = 22000

/** Fragmento que identifica un `GetMap` del WMS del Catastro. */
const MARCA_WMS = 'ServidorWMS.aspx'

/** `alt` de las instancias del WMS del Catastro (viewer/wms-catastro.js). */
const ALT_WMS = 'Cartografía catastral del encuadre actual'

/** Desplazamiento del pan sintético, en píxeles CSS. */
const PAN_PX = { dx: -140, dy: 90 }

const t0 = performance.now()
/** @type {string[]} */
const problemas = []

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

async function esperarHasta(condicion, topeMs, pasoMs = 60) {
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
const elMapa = document.getElementById('mapa')
if (contenedor === null || elMapa === null) {
  return {
    guion: '02-wms-encuadre',
    criterio: 2,
    ok: false,
    problemas: ['No hay `#mapa` con un `.leaflet-container`: el visor no ha montado.'],
  }
}

// Subir el buffer NO recupera lo ya descartado, pero evita que se descarte de
// aquí en adelante.
if (typeof performance.setResourceTimingBufferSize === 'function') {
  performance.setResourceTimingBufferSize(2000)
}

/** URLs completas de los `GetMap` que hay ahora mismo en el Resource Timing. */
function urlsWms() {
  return performance
    .getEntriesByType('resource')
    .map((entrada) => entrada.name)
    .filter((nombre) => nombre.includes(MARCA_WMS))
}

/** Nº de recursos en el buffer (para detectar desbordamiento). */
function totalRecursos() {
  return performance.getEntriesByType('resource').length
}

/** Tamaño del lienzo = `mapa.getSize()` (ver hooks de la cabecera). */
function tamanoLienzo() {
  return { ancho: elMapa.clientWidth, alto: elMapa.clientHeight }
}

/**
 * Instancias WMS del Catastro en el mapa. `esperadas` por encuadre = su número:
 * una imagen por instancia visible (base opaca y/o superpuesta translúcida).
 */
function instanciasWms() {
  return [...contenedor.querySelectorAll(`img.leaflet-image-layer[alt="${ALT_WMS}"]`)].map(
    (img) => ({
      pane: img.parentElement === null ? null : String(img.parentElement.className),
      transparente: img.src.includes('TRANSPARENT=TRUE'),
      // ⚠️ `naturalWidth > 0` NO basta por sí solo: hasta su primera imagen real
      // el overlay lleva el GIF 1×1 de `L.Util.emptyImageUrl`, que también mide
      // 1 px. Hay que exigir además que el `src` sea del servicio.
      cargadaConImagenDelWms: img.src.includes(MARCA_WMS) && img.complete && img.naturalWidth > 0,
      tamanoNatural: [img.naturalWidth, img.naturalHeight],
    }),
  )
}

/** Desglose de una URL de `GetMap`: lo que hay que auditar del criterio 2. */
function desglosar(url) {
  const p = new URL(url).searchParams
  return {
    width: Number(p.get('WIDTH')),
    height: Number(p.get('HEIGHT')),
    bbox: p.get('BBOX'),
    srs: p.get('SRS'),
    transparent: p.get('TRANSPARENT'),
    layers: p.get('LAYERS'),
    url,
  }
}

/** Transform del pane del mapa: cambia si el mapa se ha desplazado de verdad. */
function transformMapPane() {
  const pane = contenedor.querySelector('.leaflet-map-pane')
  return pane === null ? null : getComputedStyle(pane).transform
}

/**
 * Arrastre SINTÉTICO (la única vía: `/browse` no tiene comando `drag`, y su
 * allowlist CDP es deny-default sin el dominio `Input`, así que
 * `Input.dispatchMouseEvent` es inalcanzable). Detalles que hay que acertar o
 * `L.Draggable` ignora el gesto — verificados leyendo
 * `node_modules/leaflet/dist/leaflet-src.js` 1.9.4:
 *   · `mousedown` SOBRE el elemento que es `dragStartTarget` (para el pan del
 *     mapa, el contenedor: `new Draggable(map._mapPane, map._container)`), con
 *     `button: 0` — Leaflet exige `e.which === 1`, y `which` de un `MouseEvent`
 *     sintético es `button + 1`.
 *   · `mousemove`/`mouseup` los engancha Leaflet EN `document` (`_onDown`), así
 *     que basta con que burbujeen. Se disparan sobre `document.body` y NO sobre
 *     `document`: Leaflet hace `addClass(e.target, 'leaflet-drag-target')` en el
 *     primer movimiento efectivo, y `addClass(document, …)` REVIENTA
 *     (`document.classList` es `undefined` → `getClass` lee
 *     `document.className.baseVal` de un `undefined` → TypeError) y con ello se
 *     rompe el arrastre entero. Con `body` como `target` (y `bubbles: true`) el
 *     listener de `document` lo recibe igual y no hay crash.
 *   · VARIOS `mousemove` con desplazamiento CRECIENTE: el primero debe superar
 *     el `clickTolerance` (3 px, manhattan) o `_onMove` sale sin arrastrar.
 *   · `pausaFinalMs > 50` antes del último movimiento: apaga la INERCIA del pan
 *     del mapa (`Map.Drag._prunePositions` descarta posiciones de más de 50 ms,
 *     y con menos de 2 posiciones `_onDragEnd` hace `fire('moveend')` en el
 *     acto). Sin eso el mapa sigue deslizándose después del `mouseup` y el
 *     encuadre final es impredecible.
 *
 * @returns {{engancho: boolean, pasos: number}}
 */
async function arrastrarSintetico(objetivo, desde, recorrido, pausaFinalMs) {
  const base = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 }
  // Saneamiento: si un gesto anterior se quedó sin `mouseup`, el
  // `Draggable._dragging` GLOBAL sigue alto y NINGÚN arrastre posterior
  // engancharía. Un `mouseup` suelto es inofensivo si no hay gesto en curso.
  document.body.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }))

  objetivo.dispatchEvent(
    new MouseEvent('mousedown', { ...base, buttons: 1, clientX: desde.x, clientY: desde.y }),
  )

  let engancho = false
  for (const [i, [dx, dy]] of recorrido.entries()) {
    if (i === recorrido.length - 1 && pausaFinalMs > 0) await dormir(pausaFinalMs)
    document.body.dispatchEvent(
      new MouseEvent('mousemove', {
        ...base,
        buttons: 1,
        clientX: desde.x + dx,
        clientY: desde.y + dy,
      }),
    )
    if (document.body.classList.contains('leaflet-dragging')) engancho = true
    await dormir(16)
  }

  const ultimo = recorrido[recorrido.length - 1]
  document.body.dispatchEvent(
    new MouseEvent('mouseup', {
      ...base,
      buttons: 0,
      clientX: desde.x + ultimo[0],
      clientY: desde.y + ultimo[1],
    }),
  )
  return { engancho, pasos: recorrido.length }
}

/** Etiqueta legible de un elemento (un `<path>` SVG no tiene `className` string). */
function etiquetaDe(el) {
  return `${el.tagName.toLowerCase()}.${el.getAttribute('class') || ''}`
}

/**
 * Punto del lienzo donde se puede pinchar para PANEAR el mapa.
 *
 * Solo se excluyen DOS cosas, y por motivos distintos:
 *   · los VÉRTICES (`.leaflet-marker-icon`): su propio `L.Draggable` está
 *     enganchado en el icono, más profundo, así que se lleva el
 *     `Draggable._dragging` GLOBAL y el arrastre del mapa no engancha (el gesto
 *     movería el vértice, que es lo que mide `03-arrastre.js`, no el encuadre);
 *   · los CONTROLES (`.leaflet-control-container`): llaman a
 *     `L.DomEvent.disableClickPropagation`, así que el mousedown no llega al
 *     contenedor del mapa.
 * El POLÍGONO **no** se excluye: aunque `path.leaflet-interactive` recibe el
 * puntero, Leaflet no corta la propagación del `mousedown` (solo trata especial
 * el `click`), así que el `Draggable` del mapa —que escucha en el contenedor— lo
 * recibe igual y el pan funciona. COMPROBADO en navegador real: con la parcela
 * encuadrada, el polígono cubre TODO el lienzo y no queda ni un punto fuera de
 * él, así que excluirlo dejaba el paso «pan» sin poder ejecutarse.
 */
function puntoLibre() {
  const rect = elMapa.getBoundingClientRect()
  const candidatos = [
    [0.5, 0.82],
    [0.2, 0.55],
    [0.8, 0.45],
    [0.5, 0.18],
    [0.3, 0.75],
    [0.7, 0.25],
  ]
  for (const [fx, fy] of candidatos) {
    const x = Math.round(rect.left + rect.width * fx)
    const y = Math.round(rect.top + rect.height * fy)
    const el = document.elementFromPoint(x, y)
    if (el === null) continue
    if (el.closest('.leaflet-control-container') !== null) continue
    if (el.closest('.leaflet-marker-icon') !== null) continue
    if (el.closest('.leaflet-container') === null) continue
    return { x, y, sobre: etiquetaDe(el) }
  }
  return null
}

/**
 * Ejecuta una acción y devuelve las peticiones `GetMap` que provocó.
 * @param {string} paso
 * @param {number} esperadas
 * @param {() => Promise<Record<string, *>>} accion
 */
async function medir(paso, esperadas, accion) {
  performance.clearResourceTimings()
  const antesTransform = transformMapPane()
  const detalle = await accion()
  const espera = await esperarHasta(() => urlsWms().length >= esperadas, TOPE_ESPERA_MS)
  // Colchón: si esperábamos 0, hay que dar tiempo a que APAREZCA una petición
  // indebida; si no, «0 peticiones» sería solo «todavía no ha llegado».
  if (esperadas === 0) await dormir(1200)
  const urls = urlsWms()
  return {
    paso,
    esperadas,
    peticiones: urls.length,
    coincide: urls.length === esperadas,
    msHastaCompletar: espera.ms,
    transformCambio: transformMapPane() !== antesTransform,
    detalles: urls.map(desglosar),
    ...detalle,
  }
}

/** Auditoría común de un lote de URLs contra el lienzo (criterio 2). */
function auditar(medida, lienzo) {
  const anchos = medida.detalles.map((d) => d.width)
  const altos = medida.detalles.map((d) => d.height)
  medida.hayWidth256 = medida.detalles.some((d) => d.width === 256 || d.height === 256)
  medida.tamanoCoincideConLienzo = medida.detalles.every(
    (d) => d.width === lienzo.ancho && d.height === lienzo.alto,
  )
  medida.bboxDistintos = new Set(medida.detalles.map((d) => d.bbox)).size
  if (!medida.coincide) {
    problemas.push(
      `Paso '${medida.paso}': ${medida.peticiones} peticiones GetMap, esperadas ` +
        `${medida.esperadas} (1 por instancia WMS visible).`,
    )
  }
  if (medida.hayWidth256) {
    problemas.push(
      `Paso '${medida.paso}': hay una URL con WIDTH/HEIGHT = 256. Eso es un MOSAICO de ` +
        `teselas: el mayor riesgo de bloqueo del proyecto (dossier §2.3/§2.5).`,
    )
  }
  if (medida.detalles.length > 0 && !medida.tamanoCoincideConLienzo) {
    problemas.push(
      `Paso '${medida.paso}': WIDTH/HEIGHT no coinciden con el lienzo ` +
        `(${lienzo.ancho}×${lienzo.alto}); medidos: ${JSON.stringify(anchos)}×${JSON.stringify(altos)}.`,
    )
  }
  return medida
}

// ── Estado de partida ───────────────────────────────────────────────────────

const lienzo = tamanoLienzo()
const instancias = instanciasWms()
const esperadasPorEncuadre = instancias.length
const baseActiva = (() => {
  const etiqueta = [...document.querySelectorAll('.leaflet-control-layers-base label')].find(
    (el) => {
      const radio = el.querySelector('input[type="radio"]')
      return radio !== null && radio.checked
    },
  )
  return etiqueta === undefined ? null : etiqueta.textContent.trim()
})()

if (esperadasPorEncuadre === 0) {
  problemas.push(
    'No hay ninguna instancia del WMS del Catastro en el mapa: el criterio 2 no es medible ' +
      '(¿se ha apagado la superpuesta y la base no es «Catastro»?).',
  )
}
if (lienzo.alto === 0 || lienzo.ancho === 0) {
  problemas.push(
    `El lienzo mide ${lienzo.ancho}×${lienzo.alto}: con alto 0 el visor no pide imagen ` +
      'ninguna (riesgo nº 1 de la fase).',
  )
}

// ── Acción 1: carga inicial (lo acumulado desde que cargó la página) ────────

const urlsIniciales = urlsWms()
// Total de recursos ANTES del primer `clearResourceTimings()`: es el único
// momento en que se puede juzgar si el buffer del navegador (250 entradas por
// defecto) pudo haber descartado alguna entrada de la carga inicial.
const recursosAlEmpezar = totalRecursos()
const cargaInicial = auditar(
  {
    paso: 'carga-inicial',
    esperadas: esperadasPorEncuadre,
    peticiones: urlsIniciales.length,
    coincide: urlsIniciales.length === esperadasPorEncuadre,
    detalles: urlsIniciales.map(desglosar),
    msHastaCompletar: 0,
    transformCambio: false,
    nota:
      'Cuenta acumulada desde la carga de la página, NO desde el arranque de este guion: ' +
      'exige página recién cargada.',
  },
  lienzo,
)
cargaInicial.cargaInicialContaminada = urlsIniciales.length > esperadasPorEncuadre
if (cargaInicial.cargaInicialContaminada) {
  problemas.push(
    'Hay más GetMap de los que corresponden a un solo encuadre: la página NO estaba recién ' +
      'cargada (¿se ejecutó 01-capas antes?). Repite con `$B reload` y vuelve a lanzar este guion.',
  )
}

// ── Acción 2: pan ───────────────────────────────────────────────────────────

const punto = puntoLibre()
if (punto === null) {
  problemas.push(
    'No se ha encontrado ningún punto del lienzo libre de marcadores, controles y polígono ' +
      'para pinchar: el pan sintético no se puede lanzar.',
  )
}

const pan =
  punto === null
    ? { paso: 'pan', esperadas: esperadasPorEncuadre, peticiones: null, coincide: false, detalles: [] }
    : auditar(
        await medir('pan', esperadasPorEncuadre, async () => {
          const recorrido = [
            [Math.sign(PAN_PX.dx) * 6, Math.sign(PAN_PX.dy) * 4],
            [PAN_PX.dx * 0.35, PAN_PX.dy * 0.35],
            [PAN_PX.dx * 0.7, PAN_PX.dy * 0.7],
            [PAN_PX.dx, PAN_PX.dy],
          ].map(([dx, dy]) => [Math.round(dx), Math.round(dy)])
          // 80 ms antes del último movimiento ⇒ sin inercia (ver el JSDoc de
          // `arrastrarSintetico`), así el encuadre final es el del `mouseup`.
          const gesto = await arrastrarSintetico(contenedor, punto, recorrido, 80)
          return { pinchadoEn: punto, arrastreEngancho: gesto.engancho, desplazamiento: PAN_PX }
        }),
        lienzo,
      )

if (pan.arrastreEngancho === false) {
  problemas.push(
    'El pan sintético NO enganchó (`document.body` nunca tuvo la clase `leaflet-dragging`): ' +
      'la medida de este paso no vale, no la leas como «0 peticiones, todo bien».',
  )
}
if (pan.arrastreEngancho === true && pan.transformCambio === false) {
  problemas.push('El pan enganchó pero el `.leaflet-map-pane` no se movió: el mapa no ha paneado.')
}

// ── Acción 3: zoom (mismo selector que usa `$B click` en el runbook) ────────

const botonZoom = document.querySelector('.leaflet-control-zoom-in')
if (botonZoom === null) problemas.push('No hay `.leaflet-control-zoom-in`: no se puede hacer zoom.')

const zoom =
  botonZoom === null
    ? { paso: 'zoom', esperadas: esperadasPorEncuadre, peticiones: null, coincide: false, detalles: [] }
    : auditar(
        await medir('zoom', esperadasPorEncuadre, async () => {
          // Click SINTÉTICO en el MISMO selector con el que el runbook hace la
          // comprobación cruzada *trusted* (`$B click .leaflet-control-zoom-in`).
          // Leaflet engancha el `click` del `<a>` con `addEventListener` y no
          // comprueba `isTrusted`.
          botonZoom.click()
          return { selectorTrusted: '.leaflet-control-zoom-in', metodo: 'HTMLElement.click()' }
        }),
        lienzo,
      )

// ── Acción 4: «pan nulo» — un gesto que NO mueve el mapa ────────────────────
// Por debajo del `clickTolerance` (3 px manhattan) `Draggable._onMove` sale sin
// arrastrar: ni `dragstart`, ni `moveend`, ni petición. Lo que NO cubre es la
// deduplicación por URL de un `moveend` con encuadre idéntico (ver cabecera).

const panNulo =
  punto === null
    ? { paso: 'pan-nulo', esperadas: 0, peticiones: null, coincide: false, detalles: [] }
    : auditar(
        await medir('pan-nulo', 0, async () => {
          const gesto = await arrastrarSintetico(
            contenedor,
            punto,
            [
              [1, 0],
              [1, 1],
              [2, 0],
            ],
            0,
          )
          return {
            pinchadoEn: punto,
            arrastreEngancho: gesto.engancho,
            nota:
              'Gesto por debajo del clickTolerance (3 px). `arrastreEngancho` DEBE ser false: ' +
              'si fuera true, el gesto habría movido el mapa y el paso no probaría nada.',
          }
        }),
        lienzo,
      )

if (panNulo.arrastreEngancho === true) {
  problemas.push(
    'El «pan nulo» ha enganchado el arrastre (movió el mapa): el paso no mide lo que dice.',
  )
}

const pasos = [cargaInicial, pan, zoom, panNulo]
const bboxTodos = pasos.flatMap((p) => (p.detalles || []).map((d) => d.bbox))
const abortadoPorTiempo = performance.now() - t0 > TOPE_TOTAL_MS

return {
  guion: '02-wms-encuadre',
  criterio: 2,
  ok: problemas.length === 0,
  lienzo,
  tamanoEsperadoEnUrls: `WIDTH/HEIGHT deben ser ${lienzo.ancho}×${lienzo.alto}`,
  baseActiva,
  instanciasWmsVisibles: esperadasPorEncuadre,
  instancias,
  esperadasPorEncuadre,
  pasos,
  // TRES encuadres distintos (carga, pan, zoom) ⇒ 3 BBOX distintos; el «pan
  // nulo» no aporta ninguno. Con 2 instancias WMS visibles hay 2 URLs por
  // encuadre pero el BBOX de las dos es el MISMO, así que el recuento de BBOX
  // distintos sigue siendo 3. Si salieran menos, alguna acción no movió el mapa.
  bboxDistintosEnTotal: new Set(bboxTodos).size,
  bboxTodos,
  recursosAlEmpezar,
  bufferQuizaDesbordado: recursosAlEmpezar >= 250,
  abortadoPorTiempo,
  problemas,
  ms: Math.round(performance.now() - t0),
}
