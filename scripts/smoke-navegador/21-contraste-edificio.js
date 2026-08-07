// scripts/smoke-navegador/21-contraste-edificio.js — F14 · fase 6.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LOS DOS PELDAÑOS QUE F14 ABRE EN LA RAMA EDIFICIO, andados sobre la aplicación
// real:
//
//     rama Edificio → soltar el GML de las 13 partes → Diagnóstico
//     → ¿QUÉ CAJÓN SE MONTA? → las cifras → Informe → el PDF BAJA
//     → y con un DXF (sin nada oficial) → los cuatro sabores de «no hay»
//
// Las 7.076 pruebas de la suite cubren la lógica. Aquí se mide lo otro, y son
// SEIS cosas que en jsdom salen verdes pase lo que pase:
//
//   1. ⭐ **QUE LA PANTALLA SEA LA DE ESTA RAMA.** Es el defecto que la fase 4a
//      midió en Chrome y que la suite entera aprobaba: con los peldaños recién
//      abiertos, `#/edificio/diagnostico` montaba `.gml-cajon-diagnostico` —el
//      cajón de PARCELA, **367 × 413 px**— encima de una construcción. El peldaño
//      estaba abierto y enseñaba la pantalla equivocada. En jsdom los dos cajones
//      están en el DOM siempre y `display:none` no se calcula.
//   2. ⭐ **QUE HAYA UN SOLO NODO POR SELECTOR.** Los dos cajones se montan a la
//      vez y se turnan por rama, así que un par atributo/valor repetido dejaría a
//      uno de los dos mudo y sin síntoma (trampa M8 de F07, ya pagada dos veces).
//      Se cuenta sobre el documento MONTADO, que es donde la trampa vive.
//   3. ⭐ **QUE LO ACCIONABLE ESTÉ A LA VISTA.** El bloque anclado del cajón
//      existe por una medición: en el hermano, a 1280×720, los dos botones nacían
//      207 y 248 px por debajo del pliegue de un scroll interno que arranca en 0.
//      `getBoundingClientRect()` devuelve ceros en jsdom.
//   4. ⭐ **EL RESALTE POR PARTE, QUE HASTA HOY NO EXISTÍA.** El guion 20 lo
//      declaró «no cubierto porque NO EXISTE» y le puso dueño en §30. F14 lo
//      enchufa: se mide que alguna huella lleve el trazo discontinuo **y que su
//      color sea el mismo que el de las demás** — un rojo ahí sería un dictamen
//      (regla de oro 9) y en jsdom no hay `stroke` calculado que comparar.
//   5. ⭐ **QUE EL PDF BAJE, Y CON EL NOMBRE LEGAL QUE LE TOCA.** Es el criterio
//      de aceptación 4: el documento se llama distinto según haya habido contraste
//      o no. La cadena `Blob → URL.createObjectURL → <a download> → click()` no
//      existe en jsdom.
//   6. ⭐ **QUE LOS CUATRO SABORES DE «NO HAY» SE LEAN DISTINTO.** Es media razón
//      de ser de la fase. Se mide con dos entradas: el GML (trae la construcción
//      oficial ⇒ hay contraste) y un DXF (no la trae ⇒ «sin consultar»), y se
//      exige que el segundo **no diga «no consta ninguna»**, que es la afirmación
//      tranquilizadora y falsa.
//
// ── ⛔ DÓNDE SE MIDE CADA COSA, Y POR QUÉ NO ES UN DETALLE ──────────────────
// **MEDIDO EL 2026-08-06 y pagado con una corrida entera:** en la pantalla de
// Entrada el bloque `.gml-acciones` está en `display: none`, así que el CTA y su
// renglón miden **0 × 0 px** — el guion 20 midió ahí y salió con todas las cajas
// a cero **y en verde**. Aquí cada cosa se mide en la pantalla donde vive: el
// cajón y sus botones en **Diagnóstico**, y las huellas en el mapa, que es común.
//
// ── RÉGIMEN DE RED: NINGUNA A SERVICIOS DE DATOS ────────────────────────────
// Todo entra por fichero, con los fixtures reales traídos por `fetch` del propio
// servidor: **esto solo funciona en DEV**. El botón «Consultar el Catastro» NO se
// pulsa a propósito —iría al `wfsBU`—, y por eso el estado `SIN_CONSTRUCCIONES`
// (la «pantalla honesta» de verdad) queda fuera: ver «lo que NO puede medir».
// Sí se mide el TERCER camino al plano, que sí toca red cartográfica: el WMS del
// informe, que es la misma que ya usa el guion 11.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · **La pantalla honesta de verdad** (`SIN_CONSTRUCCIONES`): hace falta
//     preguntarle al `wfsBU` por una parcela sin nada construido, y este guion no
//     consulta servicios de datos. La suite la cubre con el fixture de colección
//     vacía; que la frase tranquilice de verdad es juicio humano → CHECKLIST §19.
//   · **Si el informe sirve para firmar.** Que el PDF baje y qué trae dentro se
//     mide; que un colegiado lo firme es verdad externa → CHECKLIST §19.
//   · **El arrastre como gesto de ratón** (§0 del GUION).

const t0 = performance.now()
const problemas = []
const advertencias = []

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const esperarA = async (pred, ms = 8000, cada = 90) => {
  const limite = performance.now() + ms
  while (performance.now() < limite) {
    let v = null
    try {
      v = pred()
    } catch {
      v = null
    }
    if (v) return v
    await dormir(cada)
  }
  return null
}

function caja(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    alto: redondear(r.height),
    ancho: redondear(r.width),
    top: redondear(r.top),
    bottom: redondear(r.bottom),
  }
}

const seVe = (el) => {
  if (!el) return false
  const c = caja(el)
  return c.alto > 0 && c.ancho > 0 && getComputedStyle(el).display !== 'none'
}

/** El gesto de soltar. `dragenter` → `dragover` → `drop` sobre la VENTANA. */
function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

/** Un `File` con los BYTES REALES del fixture. */
async function traerFixture(ruta, nombre, tipo = '') {
  const url = new URL(ruta, document.baseURI).href
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) return { file: null, url, estado: respuesta.status }
    const bytes = await respuesta.arrayBuffer()
    return { file: new File([bytes], nombre, { type: tipo }), url, bytes: bytes.byteLength }
  } catch (error) {
    return { file: null, url, error: `${error.name}: ${error.message}` }
  }
}

// ── Selectores del contrato ─────────────────────────────────────────────────

const SEL = {
  APP: '.gml-app',
  PANEL: '.gml-panel',
  TITULO: '[data-titulo="pantalla"]',
  IR_A_EDIFICIO: '[data-ir-a-rama="EDIFICIO"]',
  IR_A_PARCELA: '[data-ir-a-rama="PARCELA"]',
  IR_A_PASO: (p) => `[data-ir-a-paso="${p}"]`,
  AVISO_TEXTO: '.gml-aviso-texto',

  // Los DOS cajones de la esquina `bottomleft`, que se turnan por RAMA.
  CAJON_PARCELA: '.gml-cajon-diagnostico',
  CAJON_EDIFICIO: '.gml-cajon-contraste-edificio',

  // El contrato de `viewer/cajon-contraste-edificio.js#SELECTOR`.
  TITULAR: '[data-contraste="titular"]',
  REGISTRO: '[data-contraste="registro"]',
  MEDIDA: '[data-contraste="huella-medida"]',
  OFICIAL: '[data-contraste="huella-oficial"]',
  DIF_HUELLA: '[data-contraste="huella-diferencia"]',
  SOLAPE: '[data-contraste="solape"]',
  CENTROIDES: '[data-contraste="centroides"]',
  EN_PARCELA: '[data-contraste="en-parcela"]',
  INVASION: '[data-contraste="invasion"]',
  ESTADO: '[data-estado="cajon-contraste-edificio"]',
  ESTADO_INFORME: '[data-estado="informe-edificio"]',
  PREPARAR: '[data-accion="preparar-informe-edificio"]',
  CONSULTAR: '[data-accion="consultar-construccion"]',
  CERRAR: '[data-accion="cerrar-contraste-edificio"]',

  // El mapa
  HUELLA: '.gml-huella',
  SENALADA: '.gml-huella--senalada',
  FILA_PARTE: '.gml-parte',
}

// ── Espías de red y de descarga ─────────────────────────────────────────────

const peticiones = []
const fetchOriginal = window.fetch
window.fetch = (entrada, opciones) => {
  peticiones.push(typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '')
  return fetchOriginal(entrada, opciones)
}

/**
 * Se intercepta el `click()` del ancla, que es el ÚNICO punto por el que baja un
 * fichero en esta aplicación. Se anota el `download` y los bytes del Blob, y **no
 * se deja continuar**: en un Chromium sin carpeta de descargas configurada el
 * click abriría un diálogo que colgaría el guion.
 */
const descargas = []
const clickOriginal = HTMLAnchorElement.prototype.click
const blobsPorUrl = new Map()
const crearUrlOriginal = URL.createObjectURL
URL.createObjectURL = function (blob) {
  const url = crearUrlOriginal.call(URL, blob)
  blobsPorUrl.set(url, blob)
  return url
}
HTMLAnchorElement.prototype.click = function () {
  if (this.hasAttribute('download')) {
    const blob = blobsPorUrl.get(this.href) ?? null
    descargas.push({
      nombre: this.getAttribute('download'),
      bytes: blob === null ? null : blob.size,
      tipo: blob === null ? null : blob.type,
    })
    return
  }
  return clickOriginal.call(this)
}

// ── Navegación ──────────────────────────────────────────────────────────────

async function irAPaso(paso) {
  const peldano = $(SEL.IR_A_PASO(paso))
  if (!peldano || peldano.disabled) return false
  peldano.click()
  await dormir(300)
  return document.body.getAttribute('data-paso') === paso
}

async function irARama(rama) {
  $(rama === 'EDIFICIO' ? SEL.IR_A_EDIFICIO : SEL.IR_A_PARCELA)?.click()
  await dormir(250)
  return document.body.getAttribute('data-rama') === rama
}

/** Lo que se ve de un cajón, con su caja y su tipografía calculada. */
function retratoDeCajon(selector) {
  const el = $(selector)
  if (el === null) return { existe: false }
  const cs = getComputedStyle(el)
  return {
    existe: true,
    seVe: seVe(el),
    display: cs.display,
    ...caja(el),
    familia: cs.fontFamily.split(',')[0].replace(/"/g, ''),
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Punto de partida
// ═════════════════════════════════════════════════════════════════════════════

const ventana = { ancho: window.innerWidth, alto: window.innerHeight }

if (!$(SEL.CAJON_EDIFICIO)) {
  problemas.push(
    'No existe `.gml-cajon-contraste-edificio` en el documento: F14 no está montada en esta ' +
      'página, y todo lo que sigue mediría el vacío.',
  )
}

// ⭐ La trampa M8, medida sobre el documento MONTADO y con los DOS cajones vivos.
const SELECTORES_UNICOS = [
  SEL.TITULAR,
  SEL.REGISTRO,
  SEL.MEDIDA,
  SEL.OFICIAL,
  SEL.DIF_HUELLA,
  SEL.SOLAPE,
  SEL.CENTROIDES,
  SEL.EN_PARCELA,
  SEL.INVASION,
  SEL.ESTADO,
  SEL.ESTADO_INFORME,
  SEL.PREPARAR,
  SEL.CONSULTAR,
  SEL.CERRAR,
  '[data-anfitrion="diagnostico"]',
  '[data-anfitrion="contraste-edificio"]',
]
const duplicados = SELECTORES_UNICOS.map((s) => ({ selector: s, n: $$(s).length })).filter(
  (x) => x.n !== 1,
)
if (duplicados.length > 0) {
  problemas.push(
    `Hay ${duplicados.length} selector(es) del cajón de contraste que NO casan exactamente un ` +
      `nodo: ${duplicados.map((d) => `${d.selector}→${d.n}`).join(', ')}. Con dos, ` +
      '`querySelector` se queda con el primero y el otro nace mudo (trampa M8 de F07).',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La rama EDIFICIO, con el GML de las 13 partes
// ═════════════════════════════════════════════════════════════════════════════

await irARama('EDIFICIO')

const bu = await traerFixture(
  'test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml',
  'bu_partes.gml',
  'application/gml+xml',
)
if (bu.file === null) {
  problemas.push(
    `No se ha podido traer el fixture del GML de partes (${bu.url}): ${bu.estado ?? bu.error}. ` +
      'Este guion solo funciona en DEV (`npm run dev`), donde `test/fixtures/` se sirve.',
  )
}

if (bu.file !== null) {
  soltar(bu.file)
  await esperarA(() => $$(SEL.FILA_PARTE).length > 0, 9000)
}

const cargado = {
  partes: $$(SEL.FILA_PARTE).length,
  huellas: $$(SEL.HUELLA).length,
  rama: document.body.getAttribute('data-rama'),
}
if (cargado.partes === 0) {
  problemas.push('No ha entrado ninguna parte del GML: lo que sigue mediría una pantalla vacía.')
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ Diagnóstico: ¿QUÉ CAJÓN SE MONTA?
// ═════════════════════════════════════════════════════════════════════════════

const enDiagnostico = await irAPaso('diagnostico')
if (!enDiagnostico) {
  problemas.push(
    'No se ha podido entrar en `#/edificio/diagnostico` desde el rail. Es el peldaño que F14 abre ' +
      'y sin él no hay pantalla que medir.',
  )
}

const pantalla = {
  hash: location.hash,
  paso: document.body.getAttribute('data-paso'),
  titulo: $(SEL.TITULO)?.textContent ?? null,
  deEdificio: retratoDeCajon(SEL.CAJON_EDIFICIO),
  deParcela: retratoDeCajon(SEL.CAJON_PARCELA),
}

// ⛔ EL DEFECTO DE LA FASE 4a, con las dos mitades: el de edificio SE VE y el de
// parcela NO. Una sola de las dos comprobaciones dejaría pasar el caso en que se
// apilan los dos, que es lo que de verdad pasaba.
if (!pantalla.deEdificio.seVe) {
  problemas.push(
    'En `#/edificio/diagnostico` el cajón de contraste de EDIFICIO no se ve ' +
      `(${JSON.stringify(pantalla.deEdificio)}). El peldaño estaría abierto sobre una pantalla vacía.`,
  )
}
if (pantalla.deParcela.seVe) {
  problemas.push(
    'En `#/edificio/diagnostico` se está viendo el cajón de PARCELA ' +
      `(${pantalla.deParcela.ancho} × ${pantalla.deParcela.alto} px). Es exactamente el defecto ` +
      'que la fase 4a midió: el peldaño abierto enseñando la pantalla equivocada.',
  )
}
if (pantalla.titulo !== null && /Diagnóstico de encaje/.test(pantalla.titulo)) {
  problemas.push(
    `El <h1> dice «${pantalla.titulo}», que es el título de la rama PARCELA, sobre una ` +
      'construcción. Un título que nombra otra cosa de la que hay debajo es la clase de error que ' +
      'nadie reporta y todo el mundo nota.',
  )
}

// ── Las cifras, tal y como se leen ──────────────────────────────────────────

const cifras = {
  titular: $(SEL.TITULAR)?.textContent ?? null,
  registro: $(SEL.REGISTRO)?.textContent ?? '',
  registroSeVe: seVe($(SEL.REGISTRO)),
  medida: $(SEL.MEDIDA)?.textContent ?? null,
  oficial: $(SEL.OFICIAL)?.textContent ?? null,
  diferencia: $(SEL.DIF_HUELLA)?.textContent ?? null,
  solape: $(SEL.SOLAPE)?.textContent ?? null,
  centroides: $(SEL.CENTROIDES)?.textContent ?? null,
  enParcela: $(SEL.EN_PARCELA)?.textContent ?? null,
  invasion: ($(SEL.INVASION)?.textContent ?? '').trim().slice(0, 120),
}

// ⛔ «No se ha consultado» NUNCA puede leerse como «no hay». Es el error
// silencioso más caro que esta vista podría cometer: el segundo tranquiliza.
if (/no se ha consultado/i.test(cifras.invasion) && /ninguna/i.test(cifras.invasion)) {
  problemas.push(
    `El renglón de invasión dice a la vez «no se ha consultado» y «ninguna»: «${cifras.invasion}».`,
  )
}

// ⛔ Regla de oro 9: ni una palabra de veredicto en la pantalla del contraste.
const textoCajon = ($(SEL.CAJON_EDIFICIO)?.textContent ?? '').toLowerCase()
const veredictos = ['válido', 'valido', 'correcto', 'incorrecto', 'apta', 'apto', 'conforme'].filter(
  (p) => textoCajon.includes(p),
)
if (veredictos.length > 0) {
  problemas.push(
    `El cajón de contraste DICTAMINA: contiene ${veredictos.map((v) => `«${v}»`).join(', ')}. ` +
      'La aplicación mide; el colegiado interpreta y firma (regla de oro 9).',
  )
}

// ── ⭐ El bloque anclado: lo accionable, A LA VISTA ─────────────────────────

const cajonEl = $(SEL.CAJON_EDIFICIO)
const anclado = (() => {
  if (cajonEl === null) return null
  const borde = cajonEl.getBoundingClientRect().bottom
  const ver = (sel) => {
    const el = $(sel)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { bajoElPliegue: redondear(r.bottom - borde), seVe: seVe(el) }
  }
  return {
    scrollInterno: redondear(cajonEl.scrollHeight - cajonEl.clientHeight),
    preparar: ver(SEL.PREPARAR),
    consultar: ver(SEL.CONSULTAR),
    estado: ver(SEL.ESTADO),
    estadoInforme: ver(SEL.ESTADO_INFORME),
  }
})()

for (const [nombre, dato] of Object.entries(anclado ?? {})) {
  if (nombre === 'scrollInterno' || dato === null) continue
  if (dato.bajoElPliegue > 0) {
    problemas.push(
      `«${nombre}» nace ${dato.bajoElPliegue} px POR DEBAJO del borde del cajón: hay que ` +
        'scrollear para verlo, y el scroll interno arranca en 0. Es el defecto que el bloque ' +
        'anclado existe para impedir.',
    )
  }
}

// ── La tipografía, que en jsdom no se calcula ───────────────────────────────

const fuentes = {
  titular: getComputedStyle($(SEL.TITULAR) ?? document.body).fontFamily.split(',')[0].replace(/"/g, ''),
  cifra: getComputedStyle($(SEL.MEDIDA) ?? document.body).fontFamily.split(',')[0].replace(/"/g, ''),
  boton: getComputedStyle($(SEL.PREPARAR) ?? document.body).fontFamily.split(',')[0].replace(/"/g, ''),
}
// El defecto REAL de F09: el estilo en línea le ganaba a la hoja y los botones
// salían en `system-ui` mientras el resto del cajón iba en Geist.
if (/system-ui/i.test(fuentes.boton)) {
  problemas.push(
    'Los botones del cajón salen en `system-ui`: el estilo en línea le está ganando a ' +
      '`estilos/app.css`. Es el defecto que el guion 10 midió el 2026-07-30, repetido.',
  )
}

// ── El panel, ¿desborda? ────────────────────────────────────────────────────

const panelEl = $(SEL.PANEL) ?? document.querySelector('aside')
const panel = {
  ...caja(panelEl),
  desborde: panelEl === null ? null : redondear(panelEl.scrollHeight - panelEl.clientHeight),
}
if (panel.desborde !== null && panel.desborde > 0) {
  problemas.push(
    `La columna izquierda desborda ${panel.desborde} px en la pantalla de contraste de edificio.`,
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ EL RESALTE POR PARTE, que el guion 20 declaró inexistente
// ═════════════════════════════════════════════════════════════════════════════

const senaladasEl = $$(SEL.SENALADA)
const huellasEl = $$(SEL.HUELLA)
const sinSenalar = huellasEl.filter((h) => !h.classList.contains('gml-huella--senalada'))

const resalte = {
  huellas: huellasEl.length,
  senaladas: senaladasEl.length,
  trazo: senaladasEl[0]?.getAttribute('stroke-dasharray') ?? null,
  // ⭐ El COLOR tiene que ser el MISMO: un rojo aquí diría «esta parte está mal».
  mismoColor:
    senaladasEl.length > 0 && sinSenalar.length > 0
      ? senaladasEl[0].getAttribute('stroke') === sinSenalar[0].getAttribute('stroke')
      : null,
}

if (resalte.huellas === 0) {
  problemas.push('No hay ni una huella en el mapa: el resalte por parte no se puede medir.')
} else if (resalte.senaladas === 0) {
  // El edificio real del Catastro produce hallazgos (una parte sin plantas
  // declaradas, la piscina como PRINCIPAL). Cero señaladas con hallazgos en el
  // renglón sería el canal desenchufado otra vez.
  advertencias.push(
    'Ninguna huella lleva el resalte de hallazgo. Puede ser legítimo (ninguna parte tiene ' +
      'hallazgos) o puede ser que `porParte` haya vuelto a quedarse sin llamante. Compruébalo ' +
      'contra el renglón de «Generar GML» en Validación.',
  )
} else {
  if (resalte.trazo === null) {
    problemas.push(
      'Hay huellas con la clase de señalada pero SIN `stroke-dasharray`: la marca no se ve.',
    )
  }
  if (resalte.mismoColor === false) {
    problemas.push(
      'La huella señalada tiene OTRO color que las demás. El resalte se distingue por trazo y no ' +
        'por color: un color de mérito sería un dictamen (regla de oro 9).',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ⭐ EL INFORME: que baje, y con su nombre legal (criterio 4)
// ═════════════════════════════════════════════════════════════════════════════

const prepararEl = $(SEL.PREPARAR)
const informe = { botonApagado: prepararEl?.disabled ?? null, descarga: null, acuse: null }

if (prepararEl !== null && !prepararEl.disabled) {
  prepararEl.click()
  await esperarA(() => descargas.length > 0, 20000)
  informe.descarga = descargas.at(-1) ?? null
  informe.acuse = $(SEL.ESTADO_INFORME)?.textContent ?? null
}

if (informe.botonApagado === true) {
  problemas.push(
    'El botón «Preparar informe (PDF)» está apagado con una construcción de 13 partes cargada. ' +
      `El renglón dice: «${$(SEL.ESTADO_INFORME)?.textContent ?? ''}».`,
  )
} else if (informe.descarga === null) {
  problemas.push(
    'Se ha pulsado «Preparar informe (PDF)» y no ha bajado ningún fichero en 20 s. ' +
      `El renglón dice: «${informe.acuse ?? ''}».`,
  )
} else {
  if (!/\.pdf$/i.test(informe.descarga.nombre ?? '')) {
    problemas.push(`El informe ha bajado como «${informe.descarga.nombre}», que no es un .pdf.`)
  }
  if ((informe.descarga.bytes ?? 0) < 1000) {
    problemas.push(`El PDF del informe pesa ${informe.descarga.bytes} bytes: está vacío o roto.`)
  }
  // ⭐ CRITERIO 4. Aquí SÍ hubo contraste (el GML trae la construcción oficial),
  // así que el nombre legal tiene que ser el de contraste y no el declarativo.
  if (informe.acuse !== null && !/contraste con la construcción catastral/i.test(informe.acuse)) {
    problemas.push(
      'Ha habido contraste y el acuse no nombra el «Informe de contraste con la construcción ' +
        `catastral»: «${informe.acuse}». Es el criterio de aceptación 4.`,
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · ⭐ LOS SABORES DE «NO HAY»: el mismo recorrido con un DXF
// ═════════════════════════════════════════════════════════════════════════════
//
// Un volcado de CAD es la MEDICIÓN del técnico: no trae construcción oficial, así
// que el registro queda en «sin consultar». Lo que se mide es que eso **se lea
// distinto** de «no consta ninguna», que es el otro sabor y el que tranquiliza.

const dxf = await traerFixture('test/fixtures/parsers/UTM.dxf', 'UTM.dxf', '')

// ⚠️ **El testigo del cambio se toma ANTES, y no es ceremonia.** La primera
// corrida de este guion daba `cargado: true` mirando solo si había filas de
// parte… que ya estaban ahí del GML anterior. Con el DXF sin entrar, el cajón
// seguía enseñando «322,13 m² · 2 caras» —las cifras del GML— y el guion las leía
// como si fueran del DXF. Un guion que no distingue «ha entrado otro documento»
// de «no ha pasado nada» aprueba las dos cosas.
const antesDelDxf = {
  partes: $$(SEL.FILA_PARTE).length,
  medida: $(SEL.MEDIDA)?.textContent ?? null,
}
const conDxf = { cargado: false, antes: antesDelDxf }

if (dxf.file !== null) {
  await irAPaso('entrada')
  soltar(dxf.file)
  // ── El diálogo de reparto por capas ─────────────────────────────────────
  //
  // ⛔ **Y hay que ELEGIR una, no darle a «Aplicar» y ya.** La primera corrida
  // pulsaba el botón directamente y no pasaba nada; medido en Chrome, el producto
  // tenía razón y el guion no: «Cargar las partes» nace APAGADO con su motivo
  // escrito —«no hay ninguna capa marcada… Ninguna viene marcada de fábrica a
  // propósito, elegir por el nombre de la capa falla en los planos reales»—, que
  // es la decisión de F11. Un guion que pulsa un botón `disabled` y da por hecho
  // que ha pasado algo mide la pantalla anterior.
  const aplicar = await esperarA(() => {
    const b = $('[data-accion="aplicar-capas"]')
    return b !== null && seVe(b) ? b : null
  }, 4000)
  conDxf.dialogoDeCapas = aplicar !== null
  if (aplicar !== null) {
    const capas = $$('[data-lista="capas"] input')
    conDxf.capas = capas.length
    // La PRIMERA que traiga polilíneas. Cuál sea da igual para lo que se mide
    // aquí —los sabores de «no hay»—; lo que importa es que entre algo.
    if (capas[0]) {
      capas[0].checked = true
      capas[0].dispatchEvent(new Event('change', { bubbles: true }))
      await dormir(200)
    }
    conDxf.aplicarApagado = aplicar.disabled
    if (!aplicar.disabled) {
      aplicar.click()
      await dormir(600)
    }
  }
  await irAPaso('diagnostico')
  // Ha entrado OTRO documento ⟺ la superficie medida ha cambiado. Es el testigo
  // que no se puede fingir: son las cifras que el cajón está enseñando.
  conDxf.medida = $(SEL.MEDIDA)?.textContent ?? null
  conDxf.cargado = conDxf.medida !== null && conDxf.medida !== antesDelDxf.medida
  conDxf.registro = ($(SEL.REGISTRO)?.textContent ?? '').trim()
  conDxf.oficial = $(SEL.OFICIAL)?.textContent ?? null
  conDxf.solape = $(SEL.SOLAPE)?.textContent ?? null
  conDxf.prepararApagado = $(SEL.PREPARAR)?.disabled ?? null

  if (!conDxf.cargado) {
    // No es un fallo del producto: puede ser el reparto por capas, que pide una
    // elección que este guion no sabe tomar. Se dice, y no se mide lo que no se
    // ha llegado a cargar — que es justo lo que hacía la primera corrida.
    advertencias.push(
      'El DXF no ha llegado a sustituir al GML (la superficie medida no ha cambiado: sigue en ' +
        `«${conDxf.medida}»), así que los sabores de «no hay» NO se han medido por esta vía. ` +
        'Los cubre la suite; aquí se dice en vez de aprobar la pantalla anterior.',
    )
  } else {
    // ⛔ Los dos sabores, distinguidos. «No consta ninguna» es una afirmación
    // sobre el Catastro que aquí nadie ha comprobado.
    if (/no consta ninguna/i.test(conDxf.oficial ?? '')) {
      problemas.push(
        `Sin haber consultado, la huella oficial dice «${conDxf.oficial}». Eso afirma que el ` +
          'Catastro no tiene nada registrado, y nadie se lo ha preguntado.',
      )
    }
    if (conDxf.registro === '') {
      problemas.push(
        'Sin construcción oficial, el renglón del registro está VACÍO: no dice por qué las ' +
          'secciones comparativas no tienen cifra (regla de oro 1).',
      )
    }
    // ⭐ Y el informe se puede componer IGUAL: es «solo declarativo» (ficha §17).
    if (conDxf.prepararApagado === true) {
      problemas.push(
        'Sin contraste, «Preparar informe (PDF)» está apagado. El informe de construcción se ' +
          'emite igual sin contrastar: el contraste es un paso OPCIONAL (ficha §17).',
      )
    }
  }
} else {
  advertencias.push(
    `No se ha podido traer test/fixtures/parsers/UTM.dxf: ${dxf.estado ?? dxf.error}.`,
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Volver a la rama PARCELA: nada de esto la ha tocado
// ═════════════════════════════════════════════════════════════════════════════

await irARama('PARCELA')
await irAPaso('diagnostico')

const alVolver = {
  rama: document.body.getAttribute('data-rama'),
  paso: document.body.getAttribute('data-paso'),
  titulo: $(SEL.TITULO)?.textContent ?? null,
  cajonParcelaSeVe: seVe($(SEL.CAJON_PARCELA)),
  cajonEdificioSeVe: seVe($(SEL.CAJON_EDIFICIO)),
}
if (alVolver.paso === 'diagnostico' && !alVolver.cajonParcelaSeVe) {
  problemas.push(
    'De vuelta en la rama PARCELA, el cajón de diagnóstico de siempre ya no se ve. F14 ha roto ' +
      'la pantalla que no tocaba.',
  )
}
if (alVolver.cajonEdificioSeVe) {
  problemas.push('El cajón de EDIFICIO se sigue viendo en la rama PARCELA.')
}

// ═════════════════════════════════════════════════════════════════════════════
// 7 · La red
// ═════════════════════════════════════════════════════════════════════════════

const red = {
  total: peticiones.length,
  aServiciosDeDatos: peticiones.filter((u) => /ovc\.catastro|wfs|wfsBU/i.test(u)).length,
  cartograficas: peticiones.filter((u) => /ServidorWMS|Cartografia|ign\.es|wmts/i.test(u)).length,
}
if (red.aServiciosDeDatos > 0) {
  problemas.push(
    `Este guion ha consultado ${red.aServiciosDeDatos} servicio(s) de datos y no debía consultar ` +
      'ninguno: todo lo que mide entra por fichero, y «Consultar el Catastro» no se pulsa.',
  )
}

// ── Se devuelve lo tomado prestado ──────────────────────────────────────────

window.fetch = fetchOriginal
HTMLAnchorElement.prototype.click = clickOriginal
URL.createObjectURL = crearUrlOriginal

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '21-contraste-edificio',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'LA PANTALLA HONESTA DE VERDAD (`SIN_CONSTRUCCIONES`): hace falta preguntarle al wfsBU por una parcela sin nada construido, y este guion no consulta servicios de datos. La suite la cubre con el fixture de colección vacía; que la frase TRANQUILICE es juicio humano → CHECKLIST-HUMANO §19.',
    'SI EL INFORME SIRVE PARA FIRMAR: que el PDF baje y qué trae dentro se mide aquí; que un colegiado lo firme es verdad externa → CHECKLIST-HUMANO §19.',
    'EL PIE DE FIRMA EN ESTA RAMA: F14 toma el que F09 recuerde y NO tiene diálogo propio (límite declarado). Si no hay ninguno guardado, el informe sale con «No consta» y lo dice.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0 del GUION): se disparan dragenter/dragover/drop sobre la ventana.',
  ],
  ventana,
  duplicados,
  cargado,
  pantalla,
  cifras,
  anclado,
  fuentes,
  panel,
  resalte,
  informe,
  conDxf,
  alVolver,
  red,
}
