// scripts/smoke-navegador/15-contraste.js — Rework de UI · T9.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LA RUTA CRÍTICA 2 ENTERA, andada de una vez sobre la aplicación real:
//
//     soltar el GML de otro → contrastarlo → cruzar la puerta y quedártelo
//
// Hasta T9 ese recorrido NO SE PODÍA ANDAR: nada navegaba solo, y «Contrastar
// con el parcelario» te dejaba en Entrada mirando las tres vías. T9 lo cerró y
// lo cubrió con siete pruebas en jsdom… que **defendieron en verde un defecto
// grave**, y de ahí nace este guion.
//
// ── ⛔ EL DEFECTO QUE OBLIGÓ A ESCRIBIRLO (2026-08-04) ──────────────────────
// La puerta de D4 —«Tomar esta geometría y editarla», el botón que es toda la
// razón de ser del modo comprobación— nacía DENTRO del `<footer>` del cajón, al
// final. Medido en Chrome:
//
//     1280×720   el cajón enseña 372 px de 686 → la puerta cae 314 px por debajo
//     1440×900   el cajón enseña 466 px de 744 → la puerta cae 267 px por debajo
//
// Con el scroll interno en 0 y sin nada que dijera que estaba ahí abajo. El
// renglón de procedencia llegaba a NOMBRARLA («pulsa «Tomar esta geometría y
// editarla»») señalando a algo invisible, que es peor que no tener botón.
//
// Las siete pruebas de la ruta 2 lo daban por visible porque **jsdom no calcula
// maquetación**: `getBoundingClientRect()` devuelve ceros y `overflow` no
// existe. Un `display` distinto de `none` les basta para decir «se ve». Aquí no.
//
// ⚠️ Y una trampa que este guion documenta porque casi cae en ella: **«tiene
// caja» no es «se ve»**. La primera sonda daba la puerta por visible (ancho 394,
// alto 30,84) mientras estaba 280 px por debajo del borde de la ventana. La
// comprobación que vale es la de tres patas: dentro del cajón, dentro de la
// ventana, y que `elementFromPoint` sobre su centro devuelva LA PUERTA — o sea
// que además nadie la esté tapando.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · Si el diagnóstico es CORRECTO. Eso es del guion 09 y de la suite: aquí se
//     mide el recorrido y la maquetación, no la geometría.
//   · Si el texto de procedencia es el que un colegiado querría leer. Se
//     comprueba que dice de quién es la geometría y que cambia al cruzar la
//     puerta; que se entienda es del checklist humano.
//   · El arrastre como gesto de ratón (§0 del GUION): el fichero entra con un
//     `DataTransfer` fabricado y eventos despachados a mano.
//
// ── RÉGIMEN DE RED — léete el §13 antes de lanzarlo ─────────────────────────
// Toca el servicio REAL: una pasada, sin bucles, **como mucho dos peticiones de
// datos** (la apertura del cajón consulta las colindantes). Si el servicio no
// contesta, se dice y no se reintenta.
//
// ⚠️ NECESITA `npm run dev`, no `vite preview`: el fixture se trae por `fetch`
// de `test/fixtures/gml/`, y `preview` sirve `dist/`, donde no está.
//
// ⚠️ ESTE GUION DEJA ESTADO EN INDEXEDDB. Al terminar la ruta hay un expediente
// autoguardado, y la corrida SIGUIENTE arranca con una tarjeta de aviso más
// («hay trabajo autoguardado de una sesión anterior sin recuperar») que le come
// 73,14 px a la caja de vértices. Costó una falsa regresión el 2026-08-04: la
// caja pasó de 228,33 a 155,19 px y pareció culpa del arreglo. **`$B reload` NO
// basta: hay que borrar IndexedDB** (ver §22 del GUION).

// ── Umbrales, con su motivo ─────────────────────────────────────────────────

/** Lo que se le tolera a la puerta salirse del cajón. Cero: el cajón es
 *  `overflow-y: auto`, así que cada píxel de más hay que buscarlo scrolleando. */
const DESBORDE_TOLERADO = 1

/** Cuánto se espera a que el servicio conteste antes de rendirse. Sin bucles. */
const ESPERA_CONTRASTE = 20000

/** El fixture: el GML de parcela que la Sede acepta, el mismo del guion 10. */
const FIXTURE = 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)

function caja(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    ancho: redondear(r.width),
    alto: redondear(r.height),
    x: redondear(r.left),
    y: redondear(r.top),
    abajo: redondear(r.bottom),
  }
}

/** Tiene caja. **No confundir con «se ve»**: ver `alcance()`. */
const tieneCaja = (el) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

const esperarA = async (pred, ms, cada = 100) => {
  const t0 = performance.now()
  while (performance.now() - t0 < ms) {
    if (pred()) return redondear(performance.now() - t0, 0)
    await new Promise((r) => setTimeout(r, cada))
  }
  return null
}

const SEL = {
  CAJON_COMP: '.gml-cajon-comprobacion',
  CAJON_DIAG: '.gml-cajon-diagnostico',
  CONTRASTAR: '[data-accion="contrastar-parcelario"]',
  PROCEDENCIA: '[data-procedencia="contraste"]',
  PUERTA: '[data-accion="tomar-geometria"]',
  VERTICES: '#tabla-vertices',
  RAIL: '[data-rail="pasos"]',
}

const app = () => $('[data-paso]') ?? document.body
const paso = () => app().dataset.paso ?? null

/** Los peldaños del rail con su estado y, si está apagado, su motivo. */
const peldanos = () =>
  Array.from(document.querySelectorAll(`${SEL.RAIL} button`)).map((b) => ({
    rotulo: (b.querySelector('[data-rail="rotulo"]') ?? b).textContent.trim().replace(/\s+/g, ' '),
    apagado: b.disabled === true,
  }))

/**
 * ⭐ LA MEDICIÓN QUE JUSTIFICA ESTE GUION: ¿se VE la puerta?
 *
 * Tres patas, y hacen falta las tres. Con una sola («tiene caja») el defecto del
 * 2026-08-04 salía verde.
 */
function alcance(nodo, contenedor) {
  if (!nodo || !contenedor) return null
  const rn = nodo.getBoundingClientRect()
  if (rn.height === 0) return { conCaja: false, seVe: false, motivo: 'no tiene caja' }
  const rc = contenedor.getBoundingClientRect()
  const centro = { x: rn.x + rn.width / 2, y: rn.y + rn.height / 2 }
  const dentroDeLaVentana = rn.top >= 0 && rn.bottom <= window.innerHeight
  const enElPunto =
    centro.y >= 0 && centro.y < window.innerHeight ? document.elementFromPoint(centro.x, centro.y) : null
  const dentroDelContenedor =
    rn.top >= rc.top - DESBORDE_TOLERADO && rn.bottom <= rc.bottom + DESBORDE_TOLERADO
  return {
    conCaja: true,
    dentroDelContenedor,
    dentroDeLaVentana,
    loQueHayEnSuCentro: enElPunto
      ? `${enElPunto.tagName}[${enElPunto.dataset.accion || enElPunto.className}]`
      : 'FUERA DE LA VENTANA',
    nadieLaTapa: enElPunto !== null && (enElPunto === nodo || nodo.contains(enElPunto)),
    seVe: dentroDelContenedor && dentroDeLaVentana && enElPunto !== null && (enElPunto === nodo || nodo.contains(enElPunto)),
    pxPorDebajoDelContenedor: redondear(rn.bottom - rc.bottom),
    caja: caja(nodo),
    contenedorScroll: {
      arriba: contenedor.scrollTop,
      contenido: contenedor.scrollHeight,
      visible: contenedor.clientHeight,
      scrollea: contenedor.scrollHeight > contenedor.clientHeight,
    },
  }
}

/** Una foto del estado observable en un instante del recorrido. */
const foto = (etiqueta) => ({
  etiqueta,
  paso: paso(),
  hash: location.hash,
  peldanos: peldanos(),
  cajonComprobacion: tieneCaja($(SEL.CAJON_COMP)),
  cajonDiagnostico: tieneCaja($(SEL.CAJON_DIAG)),
  procedencia: {
    seVe: tieneCaja($(SEL.PROCEDENCIA)),
    texto: $(SEL.PROCEDENCIA)?.textContent?.trim() ?? null,
    caja: caja($(SEL.PROCEDENCIA)),
  },
  puertaConCaja: tieneCaja($(SEL.PUERTA)),
  cajaVertices: caja($(SEL.VERTICES)),
})

// ── 0 · Arranque ────────────────────────────────────────────────────────────

const problemas = []
const advertencias = []
const t0 = performance.now()

const tarjetasAlArrancar = document.querySelectorAll('#avisos .gml-aviso').length
if (tarjetasAlArrancar > 0) {
  advertencias.push(
    `La aplicación arranca con ${tarjetasAlArrancar} tarjeta(s) de aviso ya puestas. Si una de ` +
      'ellas es la del autoguardado, este guion la dejó en la corrida anterior y le come ~73 px a ' +
      'la caja de vértices: las cifras del panel NO son comparables con las de referencia. Borra ' +
      'IndexedDB y recarga (§22 del GUION).',
  )
}
if (paso() !== 'entrada') {
  advertencias.push(
    `Este guion empieza en Entrada y la aplicación está en «${paso()}». Se lanza igual, pero el ` +
      'recorrido no arranca donde arranca un usuario.',
  )
}

const partida = foto('0 · antes de soltar nada')

// ── 1 · Soltar el GML de otro técnico, con BYTES REALES ─────────────────────

const url = new URL(FIXTURE, document.baseURI).href
const respuesta = await fetch(url)
if (!respuesta.ok) {
  return {
    guion: '15-contraste',
    ok: false,
    problemas: [
      `El fixture no se sirve (HTTP ${respuesta.status}). Este guion necesita \`npm run dev\`: ` +
        '`vite preview` sirve `dist/`, donde los fixtures no están.',
    ],
    url,
  }
}
const bytes = await respuesta.arrayBuffer()
const file = new File([bytes], 'cp_parcela_9398516VK3799G.gml', { type: 'application/gml+xml' })
const dt = new DataTransfer()
dt.items.add(file)
for (const tipo of ['dragenter', 'dragover', 'drop']) {
  window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
}
const msSoltar = await esperarA(() => tieneCaja($(SEL.CAJON_COMP)), 8000)
const trasSoltar = foto('1 · tras soltar el .gml')

if (msSoltar === null) problemas.push('Tras soltar el .gml no aparece el cajón de comprobación.')
if (trasSoltar.paso !== 'entrada') {
  problemas.push(
    `Traer un fichero es empezar otro expediente, así que el rail tiene que volver a Entrada. ` +
      `Está en «${trasSoltar.paso}».`,
  )
}
if (trasSoltar.cajonDiagnostico) {
  problemas.push('Los dos cajones se ven a la vez: comparten esquina y se taparían.')
}

// ── 2 · Contrastar con el parcelario (UNA pulsación, UNA petición) ──────────

const cta = $(SEL.CONTRASTAR)
if (cta === null) problemas.push('No existe «Contrastar con el parcelario» en el cajón de comprobación.')
else if (cta.disabled) problemas.push('«Contrastar con el parcelario» nace apagado.')
cta?.click()

const msContraste = await esperarA(() => tieneCaja($(SEL.CAJON_DIAG)), ESPERA_CONTRASTE)
const trasContrastar = foto('2 · tras contrastar')
const alcanceDeLaPuerta = alcance($(SEL.PUERTA), $(SEL.CAJON_DIAG))

if (msContraste === null) {
  problemas.push(
    'Tras contrastar no se abre el cajón de diagnóstico. Si el servicio del Catastro no ha ' +
      'contestado, esto NO es un defecto de la aplicación: mira la red antes de acusar.',
  )
} else {
  if (trasContrastar.paso !== 'diagnostico') {
    problemas.push(
      `Contrastar tiene que LLEVARTE a Diagnóstico (era la ruta que no se podía andar). El paso ` +
        `activo es «${trasContrastar.paso}».`,
    )
  }
  if (trasContrastar.cajonComprobacion) {
    problemas.push('El cajón de comprobación sigue puesto con el de diagnóstico abierto.')
  }
  if (!trasContrastar.procedencia.seVe) {
    problemas.push(
      'El renglón de procedencia no se ve: es lo único que dice de quién es la geometría que ' +
        'estás mirando, y T6 ya lo escondió sin querer una vez.',
    )
  }
  const texto = trasContrastar.procedencia.texto ?? ''
  if (!texto.includes('otro técnico')) {
    problemas.push(`La procedencia no dice que la geometría es de otro: «${texto}».`)
  }
  if (!texto.includes('Tomar esta geometría y editarla')) {
    problemas.push('La procedencia no nombra la puerta, que es lo que le dice al usuario qué hacer.')
  }
  // ⭐ EL CRITERIO POR EL QUE EXISTE ESTE GUION
  if (alcanceDeLaPuerta === null || !alcanceDeLaPuerta.conCaja) {
    problemas.push('La puerta no está en pantalla estando en modo comprobación.')
  } else if (!alcanceDeLaPuerta.seVe) {
    problemas.push(
      `LA PUERTA NO SE VE, y la procedencia la está nombrando. Dentro del cajón: ` +
        `${alcanceDeLaPuerta.dentroDelContenedor}; dentro de la ventana: ` +
        `${alcanceDeLaPuerta.dentroDeLaVentana}; en su centro hay ` +
        `«${alcanceDeLaPuerta.loQueHayEnSuCentro}». Se sale ` +
        `${alcanceDeLaPuerta.pxPorDebajoDelContenedor} px por debajo del cajón, que enseña ` +
        `${alcanceDeLaPuerta.contenedorScroll.visible} px de ` +
        `${alcanceDeLaPuerta.contenedorScroll.contenido}.`,
    )
  }
  const edicion = trasContrastar.peldanos.find((p) => p.rotulo.startsWith('Edición'))
  if (edicion && !edicion.apagado) {
    problemas.push('Edición está encendida sin haber cruzado la puerta: la comprobación es de solo lectura.')
  }
}

// ── 3 · Cruzar la puerta ────────────────────────────────────────────────────

const puerta = $(SEL.PUERTA)
puerta?.click()
const msPuerta = await esperarA(() => !tieneCaja($(SEL.PUERTA)), 5000)
const trasPuerta = foto('3 · tras cruzar la puerta')

if (puerta !== null) {
  if (trasPuerta.puertaConCaja) {
    problemas.push('La puerta sigue puesta después de cruzarla: ya no aplica y no tiene motivo que escribir.')
  }
  const edicion = trasPuerta.peldanos.find((p) => p.rotulo.startsWith('Edición'))
  if (edicion && edicion.apagado) {
    problemas.push('Cruzar la puerta no ha encendido Edición: la puerta no abre nada.')
  }
  const texto = trasPuerta.procedencia.texto ?? ''
  if (!texto.includes('tomado como tuyo')) {
    problemas.push(`Tras cruzar la puerta la procedencia no ha cambiado: «${texto}».`)
  }
  if (!texto.includes('no se modifica')) {
    advertencias.push(
      'La procedencia ya no promete que el fichero de origen queda intacto. Es la única frase que ' +
        'lo dice, y es la duda que tiene cualquiera al pulsar.',
    )
  }
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '15-contraste',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'SI EL DIAGNÓSTICO ES CORRECTO. Aquí se mide el recorrido y la maquetación; la geometría es del guion 09 y de la suite.',
    'SI EL TEXTO DE PROCEDENCIA SE ENTIENDE. Se comprueba que dice de quién es la geometría y que cambia al cruzar la puerta; que se lea bien es del checklist humano.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): el fichero entra con un `DataTransfer` fabricado.',
    'QUE ALGUIEN ENCUENTRE LA PUERTA SIN QUE SE LA SEÑALEN. Este guion mide que se VE; que se entienda como el siguiente paso es de la firma humana.',
  ],
  arranque: {
    viewport: { ancho: window.innerWidth, alto: window.innerHeight },
    url: location.href,
    tarjetasDeAvisos: tarjetasAlArrancar,
    bytesDelFixture: bytes.byteLength,
  },
  tiempos: { msSoltar, msContraste, msPuerta },
  puerta: alcanceDeLaPuerta,
  fotos: [partida, trasSoltar, trasContrastar, trasPuerta],
  estadoFinal: {
    queDeja:
      'La geometría de otro técnico TOMADA como propia, el cajón de diagnóstico abierto y un ' +
      'expediente autoguardado en IndexedDB. Para volver al punto de partida NO basta `$B reload`: ' +
      'hay que borrar IndexedDB (§22 del GUION).',
    paso: paso(),
    tarjetasDeAvisos: document.querySelectorAll('#avisos .gml-aviso').length,
  },
}
