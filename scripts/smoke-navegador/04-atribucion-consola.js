// scripts/smoke-navegador/04-atribucion-consola.js — F03 · Fase 4, Tarea 4D.1.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// CRITERIO DE ACEPTACIÓN 5 de F03 (atribución obligatoria, que es una obligación
// LEGAL de licencia, no un detalle cosmético) y CRITERIO 4 (canvas limpio, el que
// habilita el plano a 300 ppp de F09), más la parte de la «consola limpia» que sí
// es observable desde la página.
//
//   1. **Atribución por identidad.** Los textos que muestra
//      `.leaflet-control-attribution` se comparan uno a uno, por IDENTIDAD
//      (`===`), contra los cuatro literales de `viewer/atribucion.js`. NO se usa
//      «contiene»: una paráfrasis («© Instituto Geográfico Nacional») pasaría un
//      `toContain` y sería un incumplimiento de licencia. La lista de literales de
//      abajo es una COPIA deliberada: este guion no puede importar el módulo, así
//      que si el módulo y esta copia divergen, el smoke FALLA — que es justo lo
//      que se quiere de un texto legal.
//      Se recorren las CINCO bases: cada una tiene su conjunto esperado, y con eso
//      los cuatro literales quedan cubiertos (PNOA, IGN, OSM y CATASTRO), incluida
//      la comprobación de que «Blanco» NO aporta atribución (su `atribucion` es la
//      cadena vacía a propósito: no hay datos de terceros que citar, y
//      `L.Control.Attribution` ignora las cadenas vacías).
//   2. **Visible y no tapada.** Que el texto EXISTA no basta (jsdom ya lo prueba y
//      no calcula layout). Aquí se mide su rectángulo real, sus estilos calculados
//      y, sobre todo, que `document.elementFromPoint` en tres puntos de su caja
//      devuelva el propio control: eso descarta que algo lo cubra. Y se compara su
//      rectángulo con el del control de opacidad (`.gml-control-opacidad`), que
//      comparte esquina (`bottomright`), para detectar solape.
//   3. **Canvas limpio.** Se dibuja en un `<canvas>` una imagen del WMS YA cargada
//      y se llama a `toDataURL()` + `getImageData()`. Si no lanzan `SecurityError`,
//      el canvas no está contaminado y la receta del plano a 300 ppp de F09 es
//      viable. Se repite con una tesela del IGN.
//   4. **El canal de avisos LLEGA A LA UI.** Se cuentan las imágenes que
//      resolvieron sin píxeles (`complete && naturalWidth === 0`: una tesela 404 o
//      un cuerpo no decodificable) y las tarjetas del panel `#avisos`. Si hay
//      imágenes fallidas y NINGUNA tarjeta, ESO SÍ es un fallo: significaría que
//      el canal `alAvisar` no llega a la UI y la regla de oro 1 está rota en
//      producción.
//
// ── QUÉ **NO** PUEDE MEDIR ──────────────────────────────────────────────────
//   · **La consola.** El buffer de consola vive en el demonio de `browse`, no en
//     la página, y no hay forma de leer retroactivamente desde el DOM las
//     excepciones ya emitidas. El recuento de errores de consola lo da
//     `$B console --errors`, y `GUION.md` define con precisión qué cuenta como
//     «consola limpia». Lo que este guion aporta es el ESPEJO en la UI de ese
//     mismo canal (punto 4), que es la parte que de verdad importa al usuario.
//   · Las imágenes fallidas de una capa YA RETIRADA del mapa: al conmutar de base,
//     Leaflet borra sus `<img>` del DOM y con ellas la evidencia. Por eso el
//     recuento del punto 4 es un mínimo, no un total, y `$B console` sigue siendo
//     la fuente para el histórico completo de la sesión.
//   · Si la atribución es LEGIBLE (contraste, tamaño): eso es ojo humano, fase 5.
//
// ── ESTADO EN QUE DEJA LA APP ───────────────────────────────────────────────
// Restaura la base «Ortofoto PNOA» y deja la superpuesta como estaba (activa).
//
// ── NOTAS DE EJECUCIÓN ──────────────────────────────────────────────────────
//   · Va ÚLTIMO en el runbook: el recuento de avisos y de imágenes fallidas es
//     más informativo cuando ya se han ejercitado las capas y el arrastre.
//   · `browse` envuelve el fichero en `(async()=>{ … })()` porque contiene
//     `await` real; de ahí que el `return` de nivel superior sea legal.

/**
 * COPIA LITERAL de `viewer/atribucion.js#ATRIBUCION`. No reformular: la
 * comparación es por identidad y una divergencia con el módulo debe hacer FALLAR
 * el smoke (es el único modo de que un texto legal no se degrade en silencio).
 */
const ATRIBUCION = {
  PNOA: 'PNOA cedido por © Instituto Geográfico Nacional de España',
  IGN: '© Instituto Geográfico Nacional de España',
  CATASTRO: '© Dirección General del Catastro',
  OSM: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
}

/**
 * Conjunto de literales que debe mostrar cada base **con la superpuesta
 * catastral ACTIVA**. Derivado de `viewer/capas.js` (qué `atribucion` declara
 * cada descriptor) y de `services/ign.js` (`pnoa-ma` → PNOA, `mapa-raster` → IGN).
 * «Blanco» aporta la cadena vacía a propósito: su conjunto es solo CATASTRO.
 * Con la base «Catastro» hay DOS capas con el MISMO texto y Leaflet lo muestra
 * UNA vez (deduplica): el conjunto sigue siendo solo CATASTRO.
 */
const ESPERADO_POR_BASE = [
  { nombre: 'Catastro', claves: ['CATASTRO'] },
  { nombre: 'Ortofoto PNOA', claves: ['PNOA', 'CATASTRO'] },
  { nombre: 'Topográfico IGN (MTN)', claves: ['IGN', 'CATASTRO'] },
  { nombre: 'OpenStreetMap', claves: ['OSM', 'CATASTRO'] },
  { nombre: 'Blanco', claves: ['CATASTRO'] },
]

/** Base a la que se restaura al terminar (`viewer/capas.js#BASE_POR_DEFECTO`). */
const BASE_INICIAL = 'Ortofoto PNOA'

/** `alt` de las instancias del WMS del Catastro (viewer/wms-catastro.js). */
const ALT_WMS = 'Cartografía catastral del encuadre actual'

const t0 = performance.now()
/** @type {string[]} */
const problemas = []

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

/** HTML → texto renderizado (para comparar el literal del OSM, que lleva `<a>`). */
function aTexto(html) {
  const caja = document.createElement('div')
  caja.innerHTML = html
  return caja.textContent
}

const control = document.querySelector('.leaflet-control-attribution')
const contenedor = document.querySelector('.leaflet-container')
if (control === null || contenedor === null) {
  return {
    guion: '04-atribucion-consola',
    criterios: [4, 5],
    ok: false,
    problemas: [
      'No hay `.leaflet-control-attribution` en la página: el criterio 5 (atribución ' +
        'obligatoria por licencia) NO se cumple.',
    ],
  }
}

/**
 * Lee el control de atribución y lo parte en items.
 * `L.Control.Attribution#_update` compone
 * `prefijo <span aria-hidden="true">|</span> a, b, c`, así que el separador de la
 * lista es `', '` y ninguno de los cuatro literales lleva coma.
 */
function leerAtribucion() {
  const html = control.innerHTML
  const trozos = html.split(/<span[^>]*>\s*\|\s*<\/span>/).map((t) => t.trim())
  const esPrefijoLeaflet = (t) => t.includes('leafletjs.com')
  const prefijo = trozos.find(esPrefijoLeaflet) || null
  const lista = trozos.filter((t) => !esPrefijoLeaflet(t) && t !== '').join(', ')
  const itemsHtml = lista === '' ? [] : lista.split(', ')
  return {
    html,
    texto: control.textContent,
    prefijoLeaflet: prefijo,
    itemsHtml,
    itemsTexto: itemsHtml.map(aTexto),
  }
}

// ── 1 · Atribución por identidad, base a base ───────────────────────────────

const etiquetas = [...document.querySelectorAll('.leaflet-control-layers-base label')]
const casillaSuperpuesta = document.querySelector(
  '.leaflet-control-layers-overlays input[type="checkbox"]',
)
const superpuestaActiva = casillaSuperpuesta !== null && casillaSuperpuesta.checked
if (!superpuestaActiva) {
  problemas.push(
    'La capa superpuesta está APAGADA: los conjuntos esperados de este guion suponen la ' +
      'superpuesta activa (es el estado de arranque de `app/main.js`). Reactívala y repite.',
  )
}

const porBase = []
for (const esperado of ESPERADO_POR_BASE) {
  const etiqueta = etiquetas.find((el) => el.textContent.trim() === esperado.nombre) || null
  const radio = etiqueta === null ? null : etiqueta.querySelector('input[type="radio"]')
  if (radio === null) {
    problemas.push(`No hay radio para la base '${esperado.nombre}': no se puede medir su atribución.`)
    porBase.push({ base: esperado.nombre, encontrada: false })
    continue
  }
  // Click sintético: aquí solo interesa el TEXTO legal, no el gesto (el barrido
  // de conmutación con evidencia de pintado es de `01-capas.js`).
  radio.click()
  await dormir(150)

  const leido = leerAtribucion()
  const esperadosTexto = esperado.claves.map((clave) => aTexto(ATRIBUCION[clave]))
  const ordenados = (lista) => [...lista].sort()
  // Comparación por IDENTIDAD, como CONJUNTO: el orden lo decide el orden de
  // inserción de `L.Control.Attribution#_attributions` (que cambia al conmutar),
  // no el proyecto, así que exigir orden sería exigir un detalle de Leaflet.
  const coincide =
    leido.itemsTexto.length === esperadosTexto.length &&
    ordenados(leido.itemsTexto).every((texto, i) => texto === ordenados(esperadosTexto)[i])

  porBase.push({
    base: esperado.nombre,
    encontrada: true,
    clavesEsperadas: esperado.claves,
    esperadosTexto,
    mostradosTexto: leido.itemsTexto,
    mostradosHtml: leido.itemsHtml,
    coincidePorIdentidad: coincide,
    // Informativo: el HTML del literal del OSM (con su enlace a la ODbL, que la
    // licencia EXIGE) debe llegar tal cual, no solo su texto.
    enlaceOsmPresente:
      !esperado.claves.includes('OSM') ||
      leido.itemsHtml.some((html) => html === ATRIBUCION.OSM),
    prefijoLeaflet: leido.prefijoLeaflet !== null,
  })

  if (!coincide) {
    problemas.push(
      `Con la base '${esperado.nombre}' la atribución NO coincide por identidad. Esperado ` +
        `${JSON.stringify(esperadosTexto)}; mostrado ${JSON.stringify(leido.itemsTexto)}.`,
    )
  }
  if (esperado.claves.includes('OSM') && !porBase[porBase.length - 1].enlaceOsmPresente) {
    problemas.push(
      'El literal de OpenStreetMap ha llegado SIN su enlace a la licencia ODbL (la licencia ' +
        `exige el enlace). HTML mostrado: ${JSON.stringify(leido.itemsHtml)}.`,
    )
  }
}

// Restauración de la base de arranque antes de las medidas de layout y canvas.
const etiquetaInicial = etiquetas.find((el) => el.textContent.trim() === BASE_INICIAL) || null
if (etiquetaInicial !== null) {
  const radio = etiquetaInicial.querySelector('input[type="radio"]')
  if (radio !== null) radio.click()
}
// Margen para que la ortofoto y la imagen del WMS estén cargadas antes de la
// prueba de canvas (que necesita `naturalWidth > 0`).
await dormir(900)

// ── 2 · Visible y no tapada ─────────────────────────────────────────────────

const rect = control.getBoundingClientRect()
const estilo = getComputedStyle(control)
const visible =
  rect.width > 0 &&
  rect.height > 0 &&
  estilo.display !== 'none' &&
  estilo.visibility !== 'hidden' &&
  Number(estilo.opacity) > 0.05 &&
  control.offsetParent !== null

/** ¿El punto (x,y) devuelve el propio control (o algo dentro de él)? */
function loDevuelvePunto(x, y) {
  const el = document.elementFromPoint(Math.round(x), Math.round(y))
  return {
    punto: [Math.round(x), Math.round(y)],
    // `getAttribute('class')` y no `className`: en un elemento SVG (el polígono,
    // la bandera del prefijo de Leaflet) `className` es un `SVGAnimatedString` y
    // se serializaría como «[object SVGAnimatedString]».
    devuelve: el === null ? null : `${el.tagName.toLowerCase()}.${el.getAttribute('class') || ''}`,
    esElControl: el !== null && (el === control || control.contains(el)),
  }
}

const puntos = [
  loDevuelvePunto(rect.left + 3, rect.top + rect.height / 2),
  loDevuelvePunto(rect.left + rect.width / 2, rect.top + rect.height / 2),
  loDevuelvePunto(rect.right - 3, rect.top + rect.height / 2),
]
const tapada = puntos.some((p) => !p.esElControl)

const controlOpacidad = document.querySelector('.gml-control-opacidad')
const rectOpacidad = controlOpacidad === null ? null : controlOpacidad.getBoundingClientRect()
const solape =
  rectOpacidad === null
    ? null
    : (() => {
        const ancho = Math.min(rect.right, rectOpacidad.right) - Math.max(rect.left, rectOpacidad.left)
        const alto = Math.min(rect.bottom, rectOpacidad.bottom) - Math.max(rect.top, rectOpacidad.top)
        const area = ancho > 0 && alto > 0 ? Math.round(ancho * alto) : 0
        return { anchoSolapado: Math.round(ancho), altoSolapado: Math.round(alto), area }
      })()

if (!visible) {
  problemas.push(
    `La atribución NO es visible (rect ${Math.round(rect.width)}×${Math.round(rect.height)}, ` +
      `display ${estilo.display}, visibility ${estilo.visibility}, opacity ${estilo.opacity}). ` +
      'El criterio 5 es una obligación legal: si no se ve, no se cumple.',
  )
}
if (tapada) {
  problemas.push(
    `Algo TAPA la atribución: ${JSON.stringify(puntos.filter((p) => !p.esElControl))}.`,
  )
}
if (solape !== null && solape.area > 0) {
  problemas.push(
    `El control de opacidad SOLAPA la atribución (${solape.area} px²): comparten la esquina ` +
      '`bottomright` y se están pisando.',
  )
}

// ── 3 · Canvas limpio (criterio 4 / override O7 / receta de F09) ────────────

/**
 * Dibuja `img` en un canvas y prueba `toDataURL` + `getImageData`. Si la imagen
 * contaminara el canvas, las dos lanzarían `SecurityError`.
 */
function probarCanvas(img, etiquetaImagen) {
  const resultado = {
    imagen: etiquetaImagen,
    src: img === null ? null : img.src.slice(0, 140),
    crossOrigin: img === null ? null : img.crossOrigin,
    tamanoNatural: img === null ? null : [img.naturalWidth, img.naturalHeight],
    dibujada: false,
    toDataURLOk: false,
    getImageDataOk: false,
    error: null,
  }
  if (img === null || !img.complete || img.naturalWidth === 0) {
    resultado.error = 'no hay imagen cargada con la que probar'
    return resultado
  }
  const lienzo = document.createElement('canvas')
  lienzo.width = 32
  lienzo.height = 32
  const ctx = lienzo.getContext('2d')
  try {
    ctx.drawImage(img, 0, 0)
    resultado.dibujada = true
  } catch (error) {
    resultado.error = `drawImage: ${error.name}: ${error.message}`
    return resultado
  }
  try {
    resultado.toDataURLOk = lienzo.toDataURL('image/png').startsWith('data:image/png')
  } catch (error) {
    resultado.error = `toDataURL: ${error.name}: ${error.message}`
  }
  try {
    ctx.getImageData(0, 0, 4, 4)
    resultado.getImageDataOk = true
  } catch (error) {
    resultado.error = `${resultado.error === null ? '' : resultado.error + ' | '}getImageData: ${error.name}: ${error.message}`
  }
  return resultado
}

const imgWms =
  [...contenedor.querySelectorAll(`img.leaflet-image-layer[alt="${ALT_WMS}"]`)].find(
    (img) => img.complete && img.naturalWidth > 0,
  ) || null
const imgTesela =
  [...contenedor.querySelectorAll('img.leaflet-tile')].find(
    (img) => img.complete && img.naturalWidth > 0,
  ) || null

const canvas = {
  wmsCatastro: probarCanvas(imgWms, 'WMS del Catastro (la que necesita F09)'),
  teselaBase: probarCanvas(imgTesela, 'tesela de la base activa'),
}

if (!canvas.wmsCatastro.toDataURLOk || !canvas.wmsCatastro.getImageDataOk) {
  problemas.push(
    'El canvas NO queda limpio con la imagen del WMS del Catastro: ' +
      `${JSON.stringify(canvas.wmsCatastro)}. Sin esto, la receta del plano a 300 ppp de F09 no ` +
      'es viable (override O7).',
  )
}
if (imgWms !== null && imgWms.crossOrigin !== 'anonymous') {
  problemas.push(
    `La imagen del WMS no lleva \`crossOrigin="anonymous"\` (lleva ${JSON.stringify(imgWms.crossOrigin)}): ` +
      'contaminaría el canvas aunque el servidor emita ACAO.',
  )
}

// ── 4 · El canal de avisos llega a la UI ────────────────────────────────────

const panel = document.getElementById('avisos')
const tarjetas =
  panel === null
    ? []
    : [...panel.querySelectorAll('.gml-aviso')].map((tarjeta) => {
        const veces = tarjeta.querySelector('.gml-aviso-veces')
        const texto = tarjeta.querySelector('.gml-aviso-texto')
        return {
          nivel: tarjeta.dataset.nivel,
          veces: veces === null ? 1 : veces.textContent,
          texto: texto === null ? null : texto.textContent,
        }
      })
const chips = [...document.querySelectorAll('.gml-chip[data-contador]')].map((chip) => ({
  contador: chip.dataset.contador,
  texto: chip.textContent,
  clases: chip.className,
}))

const imagenes = [...contenedor.querySelectorAll('img')]
const fallidas = imagenes
  .filter((img) => img.complete && img.naturalWidth === 0 && img.src !== '' && !img.src.startsWith('data:'))
  .map((img) => img.src.slice(0, 140))

const avisos = {
  panelPresente: panel !== null,
  vacio: panel !== null && panel.querySelector('.gml-avisos-vacio') !== null,
  tarjetas,
  chips,
  imagenesEnDom: imagenes.length,
  imagenesFallidasEnDom: fallidas.length,
  ejemplosFallidas: fallidas.slice(0, 4),
  // La regla de oro 1 en producción: si algo falló, TIENE que verse en el panel.
  canalLlegaALaUI: fallidas.length === 0 || tarjetas.length > 0,
}

if (!avisos.canalLlegaALaUI) {
  problemas.push(
    `Hay ${fallidas.length} imágenes que resolvieron sin píxeles y el panel #avisos no muestra ` +
      'NINGUNA tarjeta: el canal `alAvisar` no está llegando a la UI y la regla de oro 1 está ' +
      'rota en producción.',
  )
}

return {
  guion: '04-atribucion-consola',
  criterios: [4, 5],
  ok: problemas.length === 0,
  atribucion: {
    superpuestaActivaAlEmpezar: superpuestaActiva,
    literalesComprobados: Object.keys(ATRIBUCION),
    porBase,
    // Los cuatro literales quedan cubiertos si todas las bases coinciden.
    cuatroLiteralesCubiertos: porBase.every((fila) => fila.coincidePorIdentidad === true),
    estadoFinal: leerAtribucion(),
  },
  presentacion: {
    visible,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      ancho: Math.round(rect.width),
      alto: Math.round(rect.height),
    },
    estilos: {
      display: estilo.display,
      visibility: estilo.visibility,
      opacity: estilo.opacity,
      fontSize: estilo.fontSize,
      zIndex: estilo.zIndex,
    },
    puntosComprobados: puntos,
    tapada,
    controlOpacidad:
      rectOpacidad === null
        ? null
        : {
            rect: {
              x: Math.round(rectOpacidad.x),
              y: Math.round(rectOpacidad.y),
              ancho: Math.round(rectOpacidad.width),
              alto: Math.round(rectOpacidad.height),
            },
            solape,
          },
  },
  canvas,
  avisos,
  consola: {
    medidaAqui: false,
    comoSeMide: '$B console --errors (el buffer vive en el demonio de browse, no en la página)',
    reglaEnGuion: 'GUION.md · §«Qué cuenta como consola limpia»',
  },
  problemas,
  ms: Math.round(performance.now() - t0),
}
