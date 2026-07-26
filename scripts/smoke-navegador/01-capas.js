// scripts/smoke-navegador/01-capas.js — F03 · Fase 4, Tarea 4D.1.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// CRITERIO DE ACEPTACIÓN 1 de F03: «las cinco capas base conmutan; la
// superpuesta regula opacidad». Conmuta las CINCO bases por la UI real (el
// `<input type="radio">` de cada `<label>` del control de capas de Leaflet) y,
// por cada una, mide: si quedó marcada, cuántas capas base hay de verdad en el
// mapa, si el mapa siguió PINTANDO y si la superpuesta sobrevivió al cambio.
// Después ejercita el deslizador de opacidad y su habilitación/deshabilitación.
//
// ── QUÉ **NO** PUEDE MEDIR ──────────────────────────────────────────────────
//   · Que la imagen sea la CORRECTA. Este guion comprueba que hay píxeles
//     descargados y decodificados (`naturalWidth > 0`), no que la ortofoto sea
//     de la parcela ni que la cartografía case con ella. Eso es ojo humano
//     (checklist de la fase 5) y ya está verificado a mano en 4C.
//   · Errores de consola: el buffer de consola vive en el demonio de `browse`,
//     no en la página. Lo mide `$B console --errors` (ver `GUION.md`).
//   · El gesto de RATÓN sobre el radio. Aquí se dispara `input.click()`
//     SINTÉTICO (ver «Por qué click sintético» más abajo). El equivalente con
//     evento *trusted* de Playwright lo hace el runbook con `$B click` sobre el
//     `selectorTrusted` que este guion devuelve por capa.
//
// ── POR QUÉ CLICK SINTÉTICO Y NO `$B click` PARA EL BARRIDO ─────────────────
// La regla de la tarea es preferir `$B click` (evento *trusted*) cuando un
// selector CSS baste. Aquí NO basta de forma robusta: los cinco radios del
// control de Leaflet son idénticos entre sí y solo se distinguen por su
// POSICIÓN (`label:nth-of-type(N)`), que es precisamente lo que este guion
// quiere COMPROBAR, no dar por supuesto. Además el barrido necesita medir el
// estado justo después de cada conmutación, y eso son 5 comandos externos
// intercalados con 5 lecturas: seis veredictos en prosa en vez de uno
// serializable. Así que el barrido va con `input.click()` (Leaflet no comprueba
// `isTrusted`: `L.Control.Layers` engancha `_onInputClick` con `addEventListener`
// y un click sintético lo dispara igual) y este guion:
//   1. VALIDA que el orden de las etiquetas en el DOM coincide con el orden de
//      `CAPAS_BASE` de `viewer/capas.js` — lo que legitima los selectores
//      `nth-of-type` del runbook;
//   2. devuelve, por capa, el `selectorTrusted` exacto para que el runbook haga
//      la comprobación cruzada con `$B click` (evento real de Playwright).
//
// ── HOOKS SEMÁNTICOS QUE USA (y por qué son estables) ───────────────────────
//   · `.leaflet-control-layers-base label` → el texto de cada `<label>` ES el
//     `nombre` del descriptor de `viewer/capas.js`. Se compara por IDENTIDAD
//     contra la lista de abajo: si alguien renombra una capa, el smoke lo dice
//     en vez de pasar por casualidad.
//   · `img.leaflet-image-layer[alt="Cartografía catastral del encuadre actual"]`
//     → las instancias del WMS del Catastro. El `alt` lo pone
//     `viewer/wms-catastro.js` (`options.alt`) y es el único hook que identifica
//     una instancia WMS **antes** de que haya cargado su primera imagen (hasta
//     entonces su `src` es el GIF 1×1 de `L.Util.emptyImageUrl`).
//   · `.gml-capa-blanca` → el `className` de la capa «Blanco» (`viewer/capas.js`).
//     Sus «teselas» son `<div>`, no `<img>`: cero red por diseño.
//   · `.gml-control-opacidad-rango` → el `<input type="range">` del control de
//     opacidad (`viewer/capas.js#ControlOpacidad`).
// Ninguno depende del orden del DOM ni de clases de presentación.
//
// ── ESTADO EN QUE DEJA LA APP ───────────────────────────────────────────────
// Restaura la configuración de arranque de `app/main.js`: base «Ortofoto PNOA»
// (`BASE_POR_DEFECTO`), superpuesta ACTIVA y opacidad al 60 %
// (`OPACIDAD_SUPERPUESTA`). Así el orden del runbook no depende de qué guion se
// ejecutó antes.
//
// ── NOTAS DE EJECUCIÓN ──────────────────────────────────────────────────────
//   · Este fichero se ejecuta con `$B eval scripts/smoke-navegador/01-capas.js`.
//     `browse` lo envuelve en `(async()=>{ … })()` PORQUE contiene un `await`
//     real; de ahí que el `return` de nivel superior sea legal. Si algún día se
//     quitaran todos los `await`, el fichero dejaría de envolverse y el `return`
//     sería un SyntaxError: no los quites.
//   · No hay `import`: `page.evaluate` no resuelve módulos. Los helpers están
//     duplicados entre guiones A PROPÓSITO.
//   · Presupuesto de tiempo: `$B` corta cualquier comando a los **30 s** (límite
//     del CLI, no configurable). El barrido lleva tope por capa y tope total, y
//     si se agota lo DICE (`abortadoPorTiempo`) en vez de devolver medidas a
//     medias sin avisar.

/** Tope de espera por capa hasta ver evidencia de pintado. */
const TOPE_ESPERA_CAPA_MS = 2500

/** Presupuesto total del barrido (el comando entero muere a los 30 s). */
const TOPE_TOTAL_MS = 20000

/**
 * Las cinco bases, en el ORDEN en que `viewer/capas.js#CAPAS_BASE` las ofrece.
 * Copia deliberada (este guion no puede importar el módulo): si divergen, el
 * smoke debe FALLAR y decir qué se ha renombrado.
 *   · `pintaCon` = mecanismo con el que esa capa demuestra que pinta:
 *     'wms' (una imagen por encuadre), 'teselas' (`<img>` WMTS/OSM) o
 *     'divs' («Blanco»: `<div>` blancos, cero red).
 */
const BASES_ESPERADAS = [
  { id: 'catastro', nombre: 'Catastro', pintaCon: 'wms' },
  { id: 'pnoa-ma', nombre: 'Ortofoto PNOA', pintaCon: 'teselas' },
  { id: 'mapa-raster', nombre: 'Topográfico IGN (MTN)', pintaCon: 'teselas' },
  { id: 'osm', nombre: 'OpenStreetMap', pintaCon: 'teselas' },
  { id: 'blanco', nombre: 'Blanco', pintaCon: 'divs' },
]

/** `alt` de las instancias del WMS del Catastro (viewer/wms-catastro.js). */
const ALT_WMS = 'Cartografía catastral del encuadre actual'

/** Base con la que arranca `app/main.js` y a la que se restaura al final. */
const BASE_INICIAL = 'Ortofoto PNOA'

/** Opacidad de arranque de la superpuesta, en pasos del `<input type="range">`. */
const PASOS_OPACIDAD_INICIAL = 60

const t0 = performance.now()
/** @type {string[]} */
const problemas = []

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

/**
 * Espera hasta que `condicion()` sea cierta o se agote `topeMs`.
 * @returns {{cumplido: boolean, ms: number}}
 */
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
if (contenedor === null) {
  return {
    guion: '01-capas',
    criterio: 1,
    ok: false,
    problemas: ['No hay ningún `.leaflet-container`: el visor no ha montado (¿error de arranque?).'],
  }
}

const controlBase = document.querySelector('.leaflet-control-layers-base')
if (controlBase === null) {
  return {
    guion: '01-capas',
    criterio: 1,
    ok: false,
    problemas: [
      'No hay `.leaflet-control-layers-base`: el control de capas no está montado, ' +
        'así que las cinco bases no son conmutables desde la UI.',
    ],
  }
}

const etiquetas = [...controlBase.querySelectorAll('label')]
const ordenEnDom = etiquetas.map((etiqueta) => etiqueta.textContent.trim())
const ordenEsperado = BASES_ESPERADAS.map((base) => base.nombre)
const ordenCoincide =
  ordenEnDom.length === ordenEsperado.length &&
  ordenEsperado.every((nombre, i) => nombre === ordenEnDom[i])
if (!ordenCoincide) {
  problemas.push(
    `El control de capas NO ofrece las cinco bases en el orden de ` +
      `viewer/capas.js#CAPAS_BASE. Esperado: ${JSON.stringify(ordenEsperado)}; ` +
      `en el DOM: ${JSON.stringify(ordenEnDom)}.`,
  )
}

const casillaSuperpuesta = document.querySelector(
  '.leaflet-control-layers-overlays input[type="checkbox"]',
)
if (casillaSuperpuesta === null) {
  problemas.push('No hay casilla de capa superpuesta en el control de capas.')
}

/** Cuenta de radios marcados (tiene que ser exactamente 1 siempre). */
function radiosMarcados() {
  return etiquetas.filter((etiqueta) => {
    const radio = etiqueta.querySelector('input[type="radio"]')
    return radio !== null && radio.checked
  }).length
}

/**
 * Evidencia de pintado, leída del DOM del mapa. Todos los contadores se
 * devuelven en el veredicto: si `pintando` sale `false`, se ve POR QUÉ.
 */
function evidencia() {
  const tilePane = contenedor.querySelector('.leaflet-tile-pane')
  const overlayPane = contenedor.querySelector('.leaflet-overlay-pane')
  const teselas = tilePane === null ? [] : [...tilePane.querySelectorAll('img.leaflet-tile')]
  const wmsEnTilePane =
    tilePane === null ? [] : [...tilePane.querySelectorAll(`img.leaflet-image-layer[alt="${ALT_WMS}"]`)]
  const wmsEnOverlayPane =
    overlayPane === null
      ? []
      : [...overlayPane.querySelectorAll(`img.leaflet-image-layer[alt="${ALT_WMS}"]`)]
  const cargada = (img) => img.complete && img.naturalWidth > 0
  // ⚠️ Para las instancias WMS NO basta `naturalWidth > 0`: hasta su primera
  // imagen real, un `L.ImageOverlay` lleva el GIF 1×1 de `L.Util.emptyImageUrl`
  // como `src`, y ese GIF **también** tiene `naturalWidth = 1`. Sin exigir la URL
  // del servicio, «la base Catastro pinta» salía cierto en el primer poll, antes
  // de que hubiera llegado ni un píxel del Catastro (falso positivo detectado al
  // probar este guion en navegador real).
  const cargadaDelWms = (img) => img.src.includes('ServidorWMS.aspx') && cargada(img)
  return {
    // Exactamente UNA capa base en el mapa: contenedor `.leaflet-layer` de las
    // teseladas + `<img>` suelto de la base WMS (un ImageOverlay no lleva
    // contenedor propio: se cuelga directamente del pane).
    capasBaseEnDom:
      tilePane === null
        ? 0
        : tilePane.querySelectorAll(':scope > .leaflet-layer').length +
          tilePane.querySelectorAll(':scope > img.leaflet-image-layer').length,
    teselas: teselas.length,
    teselasCargadas: teselas.filter(cargada).length,
    // `complete` con `naturalWidth === 0` = descarga resuelta SIN imagen: una
    // tesela 404 o un cuerpo no decodificable.
    teselasFallidas: teselas.filter((img) => img.complete && img.naturalWidth === 0).length,
    divsBlanco: contenedor.querySelectorAll('.gml-capa-blanca div.leaflet-tile').length,
    wmsBaseInstancias: wmsEnTilePane.length,
    wmsBaseCargadas: wmsEnTilePane.filter(cargadaDelWms).length,
    wmsSuperpuestasCargadas: wmsEnOverlayPane.filter(cargadaDelWms).length,
    superpuestaEnMapa: wmsEnOverlayPane.length > 0,
  }
}

/** ¿La capa `pintaCon` demuestra píxeles en pantalla? */
function pintando(pintaCon, ev) {
  if (pintaCon === 'wms') return ev.wmsBaseCargadas > 0
  if (pintaCon === 'divs') return ev.divsBlanco > 0
  return ev.teselasCargadas > 0
}

// ── Barrido de las cinco bases ──────────────────────────────────────────────

const bases = []
let abortadoPorTiempo = false

for (const [i, esperada] of BASES_ESPERADAS.entries()) {
  if (performance.now() - t0 > TOPE_TOTAL_MS) {
    abortadoPorTiempo = true
    problemas.push(
      `Presupuesto de tiempo agotado (${TOPE_TOTAL_MS} ms) antes de conmutar ` +
        `'${esperada.nombre}': el barrido queda INCOMPLETO.`,
    )
    break
  }

  const selectorTrusted = `.leaflet-control-layers-base label:nth-of-type(${i + 1}) input[type="radio"]`
  const etiqueta = etiquetas.find((el) => el.textContent.trim() === esperada.nombre) || null
  const radio = etiqueta === null ? null : etiqueta.querySelector('input[type="radio"]')

  if (radio === null) {
    problemas.push(
      `No se ha encontrado el radio de la base '${esperada.nombre}' en el control de capas.`,
    )
    bases.push({ ...esperada, selectorTrusted, encontrada: false })
    continue
  }

  // Click SINTÉTICO en el radio (ver cabecera). Leaflet lo trata igual que el
  // del usuario: `_onInputClick` no comprueba `isTrusted`.
  radio.click()

  const espera = await esperarHasta(
    () => pintando(esperada.pintaCon, evidencia()),
    TOPE_ESPERA_CAPA_MS,
  )
  const ev = evidencia()
  const marcados = radiosMarcados()

  const fila = {
    ...esperada,
    selectorTrusted,
    encontrada: true,
    metodo: 'input.click() sintético',
    marcada: radio.checked,
    radiosMarcados: marcados,
    capasBaseEnDom: ev.capasBaseEnDom,
    pintando: pintando(esperada.pintaCon, ev),
    msHastaPintar: espera.ms,
    superpuestaSigueActiva: casillaSuperpuesta !== null && casillaSuperpuesta.checked,
    superpuestaEnMapa: ev.superpuestaEnMapa,
    contadores: ev,
  }
  bases.push(fila)

  if (!fila.marcada) problemas.push(`La base '${esperada.nombre}' no quedó marcada tras el click.`)
  if (marcados !== 1) {
    problemas.push(
      `Con '${esperada.nombre}' activa hay ${marcados} radios marcados (debe haber exactamente 1).`,
    )
  }
  if (fila.capasBaseEnDom !== 1) {
    problemas.push(
      `Con '${esperada.nombre}' activa hay ${fila.capasBaseEnDom} capas base en el mapa ` +
        `(debe haber exactamente 1: 'activarBase' deja UNA sola).`,
    )
  }
  if (!fila.pintando) {
    problemas.push(
      `La base '${esperada.nombre}' no ha llegado a pintar en ${TOPE_ESPERA_CAPA_MS} ms ` +
        `(contadores: ${JSON.stringify(ev)}).`,
    )
  }
  if (!fila.superpuestaSigueActiva) {
    problemas.push(
      `Al conmutar a '${esperada.nombre}' se ha perdido la capa superpuesta: conmutar la ` +
        `base NO debe apagar la cartografía catastral.`,
    )
  }
}

// ── La superpuesta REGULA OPACIDAD (segunda mitad del criterio 1) ───────────

const rango = document.querySelector('.gml-control-opacidad-rango')
/** @type {Record<string, *>} */
const opacidad = { rangoPresente: rango !== null }

if (rango === null) {
  problemas.push(
    'No hay `.gml-control-opacidad-rango`: la superpuesta no tiene deslizador de opacidad.',
  )
} else {
  // Volvemos a la base de arranque ANTES de tocar la opacidad, para medir sobre
  // la vista que el usuario ve de verdad al abrir la app.
  const etiquetaInicial = etiquetas.find((el) => el.textContent.trim() === BASE_INICIAL) || null
  const radioInicial = etiquetaInicial === null ? null : etiquetaInicial.querySelector('input')
  if (radioInicial !== null) radioInicial.click()

  if (casillaSuperpuesta !== null && !casillaSuperpuesta.checked) casillaSuperpuesta.click()
  await dormir(120)

  opacidad.habilitadoConSuperpuesta = !rango.disabled
  if (rango.disabled) {
    problemas.push(
      'Con la superpuesta ACTIVA el deslizador de opacidad está deshabilitado: quien abre la ' +
        'app ve un control gris que no se mueve y lo lee como un fallo.',
    )
  }

  const imagenSuperpuesta = contenedor.querySelector(
    `.leaflet-overlay-pane img.leaflet-image-layer[alt="${ALT_WMS}"]`,
  )
  opacidad.valorInicialRango = rango.value
  opacidad.opacidadImagenInicial = imagenSuperpuesta === null ? null : imagenSuperpuesta.style.opacity

  // Gesto del deslizador: `viewer/capas.js` escucha `input` y `change`.
  rango.value = '20'
  rango.dispatchEvent(new Event('input', { bubbles: true }))
  await dormir(60)
  opacidad.opacidadImagenAl20 = imagenSuperpuesta === null ? null : imagenSuperpuesta.style.opacity
  opacidad.reaccionaAlDeslizador =
    imagenSuperpuesta !== null && Math.abs(Number(imagenSuperpuesta.style.opacity) - 0.2) < 0.005
  if (!opacidad.reaccionaAlDeslizador) {
    problemas.push(
      `Mover el deslizador al 20 % no ha cambiado la opacidad de la imagen superpuesta ` +
        `(leída: ${JSON.stringify(opacidad.opacidadImagenAl20)}).`,
    )
  }

  // Apagar la superpuesta debe DESHABILITAR el control (no mentir sobre algo
  // que no se ve) y volver a encenderla debe rehabilitarlo.
  if (casillaSuperpuesta !== null) {
    casillaSuperpuesta.click()
    await dormir(120)
    opacidad.deshabilitadoSinSuperpuesta = rango.disabled
    if (!rango.disabled) {
      problemas.push(
        'Con la superpuesta APAGADA el deslizador sigue habilitado: regularía la opacidad de ' +
          'una capa que no está en el mapa.',
      )
    }
    casillaSuperpuesta.click()
    await dormir(120)
    opacidad.rehabilitadoAlVolver = !rango.disabled
    if (rango.disabled) {
      problemas.push('Al volver a activar la superpuesta el deslizador no se ha rehabilitado.')
    }
  }

  // Restauración del estado de arranque.
  rango.value = String(PASOS_OPACIDAD_INICIAL)
  rango.dispatchEvent(new Event('input', { bubbles: true }))
  await dormir(60)
  opacidad.valorRestaurado = rango.value
}

const evidenciaFinal = evidencia()
const baseFinal = (() => {
  const marcada = etiquetas.find((el) => {
    const radio = el.querySelector('input[type="radio"]')
    return radio !== null && radio.checked
  })
  return marcada === undefined ? null : marcada.textContent.trim()
})()

return {
  guion: '01-capas',
  criterio: 1,
  ok: problemas.length === 0 && !abortadoPorTiempo,
  ordenEsperado,
  ordenEnDom,
  ordenCoincide,
  bases,
  opacidad,
  estadoFinal: {
    base: baseFinal,
    baseEsperada: BASE_INICIAL,
    superpuestaActiva: casillaSuperpuesta !== null && casillaSuperpuesta.checked,
    opacidadImagen: (() => {
      const img = contenedor.querySelector(
        `.leaflet-overlay-pane img.leaflet-image-layer[alt="${ALT_WMS}"]`,
      )
      return img === null ? null : img.style.opacity
    })(),
    contadores: evidenciaFinal,
  },
  abortadoPorTiempo,
  problemas,
  ms: Math.round(performance.now() - t0),
}
