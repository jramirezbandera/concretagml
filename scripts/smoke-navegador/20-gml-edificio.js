// scripts/smoke-navegador/20-gml-edificio.js — F13 · T4.3.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LA SALIDA DE LA RAMA EDIFICIO, andada de una vez sobre la aplicación real:
//
//     rama vacía (botón apagado con su motivo) → traer 13 partes
//     → el botón se enciende → pulsarlo → el fichero BAJA
//     → romperlo a propósito → conmutar de rama y volver
//
// Las 6.899 pruebas de la suite cubren la lógica. Aquí se mide lo otro, y son
// CINCO cosas que en jsdom salen verdes pase lo que pase:
//
//   1. ⭐ **QUE EL FICHERO BAJE DE VERDAD, Y CON SU NOMBRE.** La cadena
//      `Blob → URL.createObjectURL → <a download> → click()` no existe en jsdom.
//      Y aquí hay un defecto concreto que vigilar: hasta la fase 3 este cableado
//      llamaba a `descargarGml`, que **compone el nombre por su cuenta**, así que
//      el fichero del ICUC habría bajado como `parcela_…` **en silencio**. Lo que
//      se mide son los BYTES y el `download` del ancla.
//   2. ⭐ **QUE EL BOTÓN TENGA DOS DUEÑOS Y NO SE PISEN.** Desde F13 hay dos
//      cableados vivos sobre el MISMO `[data-accion="generar-gml"]`: el de
//      parcela y el de edificio. `app/main.js` los reparte con `mando()` y los
//      repinta a los dos en cada conmutación. El modo de fallo es exacto y mudo:
//      si solo se repintara el que ENTRA, el botón se quedaría como lo dejó la
//      rama que se acaba de abandonar — y quien lo pulsara descargaría el fichero
//      de la otra cosa, o no podría pulsarlo sin motivo. En jsdom no hay
//      conmutador que pulsar. Se mide **con el edificio ROTO a propósito**, que es
//      la única forma de que las dos ramas discrepen y la medida discrimine.
//   3. ⭐ **QUE EL MOTIVO SE LEA, Y QUEPA.** Un renglón de 30 px con un párrafo
//      dentro cabe perfectamente en jsdom, donde `getBoundingClientRect()`
//      devuelve ceros. Aquí se mide su caja y si se recorta.
//      ⚠️ Y hay una razón fuerte para medirlo en el renglón y no en el panel:
//      **un botón `disabled` no emite `click`**, así que con errores el usuario
//      NO llega al panel de avisos por esa vía. Lo único que lee es el renglón.
//   4. ⭐ **QUE LOS DOS MENSAJES RETIRADOS NO VUELVAN.** F13 retira dos motivos
//      honrados de `app/rama.js` («…y todavía no con una construcción»). Están en
//      el historial de seis fases y en la cabeza de cualquiera que lea el módulo;
//      que no reaparezcan en pantalla es lo que hace verdad a esta fase.
//   5. ⭐ **QUE LO QUE NO SE HA PODIDO COMPROBAR SE DIGA — Y SOLO ENTONCES.** Es
//      la medida M3 de la fase 0 y se comprueba en los DOS sentidos: sin parcela
//      con la que comparar, el panel tiene que decir que «dentro de la parcela» y
//      «a menos de 100 m» **no se han comprobado** (regla de oro 1); y con una
//      parcela en pantalla, ese aviso **no puede aparecer**, porque entonces sí se
//      ha comprobado y decirlo sería ruido que enseña a ignorar el panel.
//
// ── ⛔ DÓNDE VIVE EL BOTÓN, Y POR QUÉ ESTO NO ES UN DETALLE ─────────────────
// **MEDIDO EL 2026-08-06:** en la pantalla de **Entrada** el bloque `.gml-acciones`
// está en `display: none`, así que el CTA y su renglón miden **0 × 0 px**. La
// primera corrida de este guion midió ahí y salió con todas las cajas a cero: el
// botón estaba encendido, el motivo escrito… y **nadie podía ver ninguna de las
// dos cosas**. Un guion que mide un nodo invisible no mide nada y además lo
// aprueba. Por eso todo lo de aquí se hace en **Validación**, que es donde el pie
// de acciones existe (218 × 343 px medidos), y hay un guardián de que se vea.
//
// ── RÉGIMEN DE RED: NINGUNA A SERVICIOS DE DATOS ────────────────────────────
// Se trabaja con el fixture real traído por `fetch` del propio servidor, así que
// **esto solo funciona en DEV**: `vite preview` sirve `dist/`, donde los fixtures
// no están. Lo mismo que los §16, §19, §26, §27 y §28.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · ⛔ **EL RESALTE POR PARTE, porque NO EXISTE.** La ficha §16.1 pide que «el
//     resalte del aviso rodea la parte que se sale, no otra», y la fase 1
//     construyó `porParte` para eso. **Medido el 2026-08-06: `porParte` no tiene
//     ni un llamante fuera de su propio módulo y sus pruebas.** No es un fallo de
//     este guion: es trabajo que no está entregado, y tiene dueño escrito en §30.
//   · **Si el GML lo acepta el ICUC.** Esto mide que el fichero baja y qué trae
//     dentro. Que la Sede lo admita es verdad externa y no la firma ninguna
//     máquina de esta carpeta → `CHECKLIST-HUMANO.md` §18.
//   · **El arrastre como gesto de ratón** (§0 del GUION).
//   · **Que valide contra el XSD**: eso lo hace `npm run validar:xsd`, contra el
//     espejo del Catastro (la URL que declaran los ficheros da 200 + HTML).
//     ⛔ **Y no basta**: el fichero que la Sede rechazó el 2026-08-06 validaba
//     contra ese mismo esquema. Le faltaba `xmlns:xlink`, que este guion SÍ mide.

const t0 = performance.now()
const problemas = []
const advertencias = []

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const esperarA = async (pred, ms = 6000, cada = 80) => {
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

const tieneCaja = (el) => {
  const c = caja(el)
  return c !== null && c.alto > 0 && c.ancho > 0
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
  MAPA: '.leaflet-container',
  TABLA_VERTICES: '#tabla-vertices',
  VERTICE: '#tabla-vertices tr[data-indice]',
  AVISOS: '#avisos',
  AVISO: '.gml-aviso',
  AVISO_TEXTO: '.gml-aviso-texto',
  AVISO_VECES: '.gml-aviso-veces',
  IR_A_EDIFICIO: '[data-ir-a-rama="EDIFICIO"]',
  IR_A_PARCELA: '[data-ir-a-rama="PARCELA"]',
  IR_A_PASO: (p) => `[data-ir-a-paso="${p}"]`,

  // El pie de acciones y el CTA compartido por los DOS cableados
  // (app/cableado-edificio-gml.js#SELECTOR_BOTON / #SELECTOR_ESTADO).
  ACCIONES: '.gml-acciones',
  BOTON: '[data-accion="generar-gml"]',
  RENGLON: '[data-estado="generar-gml"]',
  DIAGNOSTICAR: '[data-accion="diagnosticar"]',

  // Panel de edificio
  FILA_PARTE: '.gml-parte',
  ANADIR_PARTE: '[data-accion="anadir-parte"]',
  HUELLA_TOTAL: '[data-campo="huella-edificio"]',
  HUELLA: '.gml-huella',
}

const filasParte = () => $$(SEL.FILA_PARTE)
const verticesEnTabla = () => $$(SEL.VERTICE).length

/** A la pantalla donde el pie de acciones EXISTE. Ver la cabecera. */
async function irAValidacion() {
  const peldano = $(SEL.IR_A_PASO('edicion'))
  if (!peldano || peldano.disabled) return false
  peldano.click()
  await dormir(280)
  return $(SEL.APP)?.dataset.paso === 'edicion'
}

/**
 * El estado del CTA tal cual lo ve una persona: si se ve, si está encendido y qué
 * pone debajo. Es la unidad de medida de este guion entero.
 */
function estadoDelCta() {
  const boton = $(SEL.BOTON)
  const renglon = $(SEL.RENGLON)
  const texto = renglon?.textContent.trim() ?? null
  return {
    hayBoton: boton !== null,
    seVe: tieneCaja(boton),
    encendido: boton === null ? null : !boton.disabled,
    motivo: texto === '' ? null : texto,
    motivoLargo: texto === null ? 0 : texto.length,
    enError: renglon?.classList.contains('gml-accion-estado--error') ?? null,
    cajaBoton: caja(boton),
    cajaRenglon: caja(renglon),
    // ⛔ El síntoma MUDO: un renglón que no cabe no desborda, se recorta. Se
    // compara el alto de contenido con el de caja, que es la única forma de
    // enterarse (lección de F17 fase 5 y del guion 19).
    recortado:
      renglon === null || renglon.clientHeight === 0
        ? null
        : renglon.scrollHeight > renglon.clientHeight + 1,
  }
}

/** Los avisos del panel como lista de textos, con sus repeticiones. */
const avisosDelPanel = () =>
  $$(`${SEL.AVISOS} ${SEL.AVISO}`).map((n) => ({
    nivel: n.dataset.nivel ?? null,
    texto: $(SEL.AVISO_TEXTO, n)?.textContent.trim() ?? '',
    veces: Number.parseInt(($(SEL.AVISO_VECES, n)?.textContent ?? '×1').slice(1), 10) || 1,
  }))

const hayAviso = (patron) => avisosDelPanel().some((a) => patron.test(a.texto))

// ── Red: se cuenta lo que sale ──────────────────────────────────────────────

const peticiones = []
const fetchOriginal = window.fetch
window.fetch = function (recurso, ...resto) {
  peticiones.push(typeof recurso === 'string' ? recurso : (recurso?.url ?? String(recurso)))
  return fetchOriginal.call(this, recurso, ...resto)
}

// ── La captura de la descarga (misma técnica que el guion 06) ───────────────

const crearUrlOriginal = URL.createObjectURL
const revocarUrlOriginal = URL.revokeObjectURL
const crearElementoOriginal = document.createElement
const teniaCreateElementPropio = Object.prototype.hasOwnProperty.call(document, 'createElement')

/**
 * Pulsa el CTA con los envoltorios puestos y devuelve TODO lo que pasó: el Blob,
 * las URLs creadas y revocadas, el ancla con su `download` y los bytes.
 *
 * Los envoltorios se ponen y se quitan **en cada pulsación**: dejarlos puestos
 * parchearía la página para el resto del guion y cualquier medida posterior sería
 * sospechosa.
 */
async function pulsarYCapturar() {
  const blobs = []
  const creadas = []
  const revocadas = []
  const anclas = []

  URL.createObjectURL = function (objeto) {
    const href = crearUrlOriginal.call(URL, objeto)
    blobs.push(objeto)
    creadas.push(href)
    return href
  }
  URL.revokeObjectURL = function (href) {
    revocadas.push(href)
    return revocarUrlOriginal.call(URL, href)
  }
  document.createElement = function (etiqueta, ...resto) {
    const el = crearElementoOriginal.call(document, etiqueta, ...resto)
    if (String(etiqueta).toLowerCase() === 'a') anclas.push(el)
    return el
  }

  let excepcion = null
  try {
    $(SEL.BOTON)?.click()
  } catch (error) {
    excepcion = `${error.name}: ${error.message}`
  } finally {
    URL.createObjectURL = crearUrlOriginal
    URL.revokeObjectURL = revocarUrlOriginal
    if (teniaCreateElementPropio) document.createElement = crearElementoOriginal
    else delete document.createElement
  }

  await dormir(200)

  const ancla = anclas.find((a) => typeof a.download === 'string' && a.download.length > 0) ?? null
  const texto = blobs.length > 0 ? await blobs[0].text() : null

  return {
    excepcion,
    restaurado:
      URL.createObjectURL === crearUrlOriginal && URL.revokeObjectURL === revocarUrlOriginal,
    blobs: blobs.length,
    tipoMime: blobs.length > 0 ? blobs[0].type : null,
    bytes: blobs.length > 0 ? blobs[0].size : null,
    urlsCreadas: creadas.length,
    urlsRevocadas: revocadas.length,
    revocaLaQueCreo:
      creadas.length === revocadas.length && creadas.every((h, i) => h === revocadas[i]),
    nombre: ancla === null ? null : ancla.download,
    anclaFueraDelDom: ancla === null ? null : !document.body.contains(ancla),
    texto,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Línea base, y de qué parcela se parte
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **La aplicación arranca CON UNA PARCELA** (la de demostración). Eso no es
// ruido: es el contexto con el que se va a comparar el edificio, y decide en qué
// sentido se comprueba la medida M3 más abajo. Se anota, no se supone.

const linea = {
  viewport: { w: innerWidth, h: innerHeight },
  rama: $(SEL.APP)?.dataset.rama ?? null,
  paso: $(SEL.APP)?.dataset.paso ?? null,
  hayMapa: tieneCaja($(SEL.MAPA)),
  hayConmutador: tieneCaja($(SEL.IR_A_EDIFICIO)),
  verticesDeParcela: verticesEnTabla(),
  avisosAlEmpezar: avisosDelPanel().length,
}
linea.hayParcelaDePartida = linea.verticesDeParcela > 0

if (!linea.hayMapa) problemas.push('No hay mapa: la aplicación no ha arrancado.')
if (!$(SEL.BOTON)) {
  problemas.push(
    `No existe «${SEL.BOTON}» en la cáscara. Es el contrato con index.html de los DOS cableados; ` +
      'sin él no hay nada que medir aquí.',
  )
}
if (!linea.hayConmutador) {
  problemas.push('No se ve el conmutador de rama: sin él no se puede llegar a EDIFICIO.')
}

// ⛔ Los DOS mensajes que F13 retira de `app/rama.js`. Si alguno vuelve a
// aparecer en pantalla, esta fase ha dejado mintiendo al producto.
const RETIRADOS = [
  /todav[ií]a no con una construcci[oó]n/i,
  /est[aá]n apagados en la rama Edificio/i,
]
const buscarRetirados = (texto, donde) => {
  for (const retirado of RETIRADOS) {
    if (typeof texto === 'string' && retirado.test(texto)) {
      problemas.push(
        `⛔ Ha vuelto un mensaje RETIRADO por F13 (${retirado}) en ${donde}: ` +
          `${JSON.stringify(texto)}. Decía que esta versión no sabe generar el GML de una ` +
          'construcción, y desde F13 sí sabe.',
      )
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La rama EDIFICIO vacía: el botón APAGADO, y con su motivo
// ═════════════════════════════════════════════════════════════════════════════

$(SEL.IR_A_EDIFICIO)?.click()
await dormir(220)
const enValidacionVacio = await irAValidacion()

const vacio = {
  rama: $(SEL.APP)?.dataset.rama ?? null,
  paso: $(SEL.APP)?.dataset.paso ?? null,
  llegoAValidacion: enValidacionVacio,
  partes: filasParte().length,
  cta: estadoDelCta(),
}

if (vacio.rama !== 'EDIFICIO') {
  problemas.push(`Pulsar el conmutador no lleva a EDIFICIO: sigue en «${vacio.rama}».`)
}
// ⛔ **MEDIDO EL 2026-08-06, y es un hallazgo de esta fase, no un fallo del guion:
// con la rama EDIFICIO VACÍA, TODOS los peldaños salvo «Entrada» están apagados**
// (`validacion`, `edicion`, `diagnostico` e `informe`: `disabled === true`, y sin
// `title` que lo explique). Como el pie de acciones solo existe en Validación, la
// consecuencia exacta es ésta:
//
//     `MOTIVO_SIN_EDIFICIO` está escrito, probado… y NO HAY FORMA DE LEERLO.
//
// No es una mentira —el botón está apagado y tiene motivo— pero es un motivo al
// que ningún usuario llega. No se acusa a F13 por ello: la puerta la cierra el eje
// PASO del rework, que es anterior. Se anota, con su dueño, en §30.
vacio.pasosAlcanzables = ['entrada', 'edicion', 'diagnostico'].filter(
  (p) => {
    const b = $(SEL.IR_A_PASO(p))
    return b !== null && !b.disabled
  },
)

if (!vacio.llegoAValidacion && vacio.partes === 0) {
  advertencias.push(
    '⚠️ Con la rama EDIFICIO vacía no se puede llegar a Validación —los peldaños posteriores a ' +
      `Entrada están apagados (alcanzables: ${JSON.stringify(vacio.pasosAlcanzables)})— y el pie ` +
      'de acciones solo existe allí. Consecuencia medida: el motivo «no hay ninguna construcción ' +
      'cargada» está en el DOM y NADIE puede leerlo. No es de F13 (la puerta la cierra el eje ' +
      'PASO), pero deja sin destinatario a un mensaje de la fase 3. Ver §30.',
  )
}
if (!vacio.llegoAValidacion && vacio.partes > 0) {
  problemas.push(
    '⛔ Con partes cargadas NO se puede llegar a la pantalla de Validación en la rama EDIFICIO, y ' +
      'es la ÚNICA donde existe el pie de acciones (medido: en Entrada `.gml-acciones` va en ' +
      '`display:none`). El botón que F13 enciende no se puede ni ver ni pulsar.',
  )
}
// El motivo se mide igual —está escrito, aunque hoy no se vea—, para que si algún
// día la puerta se abre esté ya comprobado, y para que los mensajes retirados no
// puedan volver por esta rendija.
if (vacio.cta.encendido) {
  problemas.push(
    '⛔ «Generar GML» está ENCENDIDO en la rama EDIFICIO sin ninguna construcción cargada. ' +
      'Pulsarlo no puede producir nada: es la regla de oro 1 al revés.',
  )
}
if (vacio.cta.motivo === null) {
  problemas.push(
    '⛔ El botón está apagado y el renglón está VACÍO. Un control apagado sin motivo al lado es ' +
      'exactamente lo que la regla de oro 1 prohíbe.',
  )
} else if (!/construcci[oó]n/i.test(vacio.cta.motivo)) {
  problemas.push(
    `El motivo del botón apagado en EDIFICIO no habla de la construcción: ` +
      `${JSON.stringify(vacio.cta.motivo)}.`,
  )
}
buscarRetirados(vacio.cta.motivo, 'el renglón del CTA en EDIFICIO vacío')

// ⚠️ «Diagnosticar encaje» SIGUE apagado en esta rama, y es correcto: es F14. Lo
// que F13 tenía que hacer es dejarle motivo PROPIO, no compartir el que hablaba
// de los dos botones en una sola frase.
const diagnosticar = (() => {
  const boton = $(SEL.DIAGNOSTICAR)
  if (boton === null) return { existe: false }
  return {
    existe: true,
    apagado: boton.disabled,
    seVe: tieneCaja(boton),
    titulo: boton.title || null,
  }
})()
buscarRetirados(diagnosticar.titulo, 'el título de «Diagnosticar encaje»')
if (diagnosticar.existe && diagnosticar.apagado === false) {
  advertencias.push(
    '«Diagnosticar encaje» está ENCENDIDO en la rama EDIFICIO. F13 no lo entrega —es F14—, así ' +
      'que o alguien lo ha adelantado o se ha quedado encendido sin cableado detrás.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Traer las 13 partes reales: el botón se enciende
// ═════════════════════════════════════════════════════════════════════════════

const bu = await traerFixture(
  'test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml',
  'bu_partes.gml',
)
if (!bu.file) {
  problemas.push(
    `No se ha podido traer el fixture BU (${bu.estado ?? bu.error}). Este guion EXIGE ` +
      '`npm run dev`: `vite preview` sirve dist/, sin fixtures.',
  )
}

if (bu.file) {
  soltar(bu.file)
  await esperarA(() => filasParte().length > 0)
  await dormir(400)
  // Traer un fichero empieza otro expediente y devuelve a Entrada: hay que
  // volver a la pantalla donde el pie existe.
  await irAValidacion()
}

const cargado = {
  paso: $(SEL.APP)?.dataset.paso ?? null,
  rama: $(SEL.APP)?.dataset.rama ?? null,
  partes: filasParte().length,
  huellas: $$(SEL.HUELLA).length,
  huellaTotal: $(SEL.HUELLA_TOTAL)?.textContent.trim() ?? null,
  cta: estadoDelCta(),
}

if (cargado.partes === 0) {
  problemas.push('El fichero BU no ha cargado ni una parte: el resto del guion no mide nada.')
}
// ⭐ Las TRES patas del botón, y aquí SÍ son exigibles: con un edificio dentro,
// el CTA tiene que existir, verse y medir algo. Un CTA invisible no está
// entregado, y todas las medidas de este guion sobre él serían verdes por
// vacuidad — que es justo lo que le pasó a la primera corrida.
if (cargado.partes > 0 && !cargado.cta.seVe) {
  problemas.push(
    `⛔ Con ${cargado.partes} partes cargadas, «Generar GML» mide 0 px: existe en el DOM y no se ` +
      `ve (pantalla «${cargado.paso}»). El botón que enciende F13 no lo puede pulsar nadie.`,
  )
}
if (cargado.partes > 0 && cargado.cta.encendido === false) {
  problemas.push(
    `⛔ Con ${cargado.partes} partes cargadas y sin un solo error, «Generar GML» sigue APAGADO en ` +
      `la rama EDIFICIO. Motivo que da: ${JSON.stringify(cargado.cta.motivo)}.`,
  )
}
if (cargado.partes > 0 && cargado.cta.encendido && cargado.cta.motivo !== null) {
  advertencias.push(
    `El botón está encendido y el renglón dice algo: ${JSON.stringify(cargado.cta.motivo)}. Con el ` +
      'camino despejado el renglón se vacía; si dice algo, o sobra o el botón no debería estarlo.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ PULSAR: EL FICHERO BAJA DE VERDAD, Y CON SU NOMBRE
// ═════════════════════════════════════════════════════════════════════════════

const descarga = cargado.cta.encendido ? await pulsarYCapturar() : null

if (descarga !== null && descarga.excepcion !== null) {
  problemas.push(`Pulsar «Generar GML» en la rama EDIFICIO ha LANZADO: ${descarga.excepcion}.`)
}
if (descarga !== null && !descarga.restaurado) {
  problemas.push(
    'El guion NO ha restaurado los envoltorios de URL.createObjectURL / revokeObjectURL: la ' +
      'página queda parcheada y cualquier medida posterior es sospechosa.',
  )
}
if (descarga !== null && descarga.blobs !== 1) {
  problemas.push(
    `Se esperaba EXACTAMENTE 1 Blob al pulsar y ha habido ${descarga.blobs}. ` +
      `Renglón: ${JSON.stringify($(SEL.RENGLON)?.textContent ?? null)}.`,
  )
}
if (descarga !== null && descarga.blobs > 0 && !descarga.revocaLaQueCreo) {
  problemas.push(
    '`gml/descargar.js` promete revocar SIEMPRE la URL que crea, y aquí no ha cuadrado: ' +
      `creadas ${descarga.urlsCreadas}, revocadas ${descarga.urlsRevocadas}.`,
  )
}

// ⭐ EL NOMBRE. Éste es el defecto que la fase 3 cazó al escribirse: llamando a
// `descargarGml` el fichero del ICUC habría bajado como `parcela_…` en silencio.
if (descarga !== null && descarga.nombre !== null) {
  if (!/^edificio[_.]/.test(descarga.nombre)) {
    problemas.push(
      `⛔ El fichero de EDIFICIO baja con el nombre ${JSON.stringify(descarga.nombre)}. Tiene que ` +
        'empezar por «edificio»: quien lo suba al ICUC lo elige de su carpeta de descargas por el ' +
        'nombre, y un «parcela_…» con un Building dentro es un fichero mal etiquetado.',
    )
  }
  if (/^parcela[_.]/.test(descarga.nombre)) {
    problemas.push(
      '⛔ El fichero de EDIFICIO baja como «parcela_…»: ha vuelto el defecto de la fase 3 ' +
        '(`descargarGml` compone el nombre por su cuenta y se come el que se le pasa).',
    )
  }
}

// ⭐ LOS BYTES. Lo que se sube al ICUC.
const bytes = (() => {
  const texto = descarga?.texto ?? null
  if (texto === null) return { hay: false }
  const doc = new DOMParser().parseFromString(texto, 'application/xml')
  const errorDeParseo = doc.querySelector('parsererror')
  const localId = /<base:localId>([^<]*)<\/base:localId>/.exec(texto)?.[1] ?? null
  return {
    hay: true,
    longitud: texto.length,
    bienFormado: errorDeParseo === null,
    errorDeParseo: errorDeParseo === null ? null : errorDeParseo.textContent.trim().slice(0, 200),
    raizGml: /<gml:FeatureCollection/.test(texto),
    raizWfs: /<wfs:FeatureCollection/.test(texto),
    hayBuilding: /<bu-ext2d:Building\b/.test(texto),
    // ⛔ El ICUC no procesa `BuildingPart` (su ayuda oficial), así que no se emite.
    hayBuildingPart: /BuildingPart/.test(texto),
    footPrint: /horizontalGeometryReference>footPrint</.test(texto),
    srsUrn: /srsName="urn:ogc:def:crs:EPSG::\d+"/.test(texto),
    srsUri: /srsName="http/.test(texto),
    // ⛔ El PDF oficial escribe «funtional». Nosotros no.
    faltaDeOrtografia: /funtional/.test(texto),
    localId,
    // ⛔ `base:localId` es un `xs:string`, NO un `xs:ID`: va DESNUDO. Sanearlo le
    // cambia la identidad al objeto declarado (defecto real de la fase 2).
    localIdSaneado: localId !== null && localId.startsWith('_'),
    posLists: (texto.match(/<gml:posList/g) ?? []).length,
    declaraUtf8: /encoding="UTF-8"/.test(texto),
    // ⛔ MEDIDO CONTRA EL ICUC REAL EL 2026-08-06: sin `xmlns:xlink` en la raíz,
    // la Sede rechaza el fichero con «no se han cargado al no ser válidos» y sin
    // más detalle — incluido el suyo propio si se le quita. No lo usa ningún
    // elemento, el XSD no lo exige y la ayuda oficial no lo menciona.
    declaraXlink: /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/.test(texto),
    usaXlink: /xlink:[A-Za-z]/.test(texto),
  }
})()

if (bytes.hay) {
  if (!bytes.bienFormado) {
    problemas.push(`El GML de edificio descargado NO está bien formado: ${bytes.errorDeParseo}.`)
  }
  if (!bytes.raizGml || bytes.raizWfs) {
    problemas.push(
      '⛔ La raíz del fichero de edificio no es `gml:FeatureCollection` (override O10). Es el ' +
        'mismo fallo por el que la Sede rechazó el GML de parcela el 2026-07-27.',
    )
  }
  if (!bytes.hayBuilding) problemas.push('El fichero descargado no lleva ni un `bu-ext2d:Building`.')
  if (bytes.hayBuildingPart) {
    problemas.push(
      '⛔ El fichero lleva `BuildingPart`, y el ICUC NO los procesa (decisión 1 del plan): son ' +
        'afirmaciones que nadie valida metidas en un documento que se firma.',
    )
  }
  if (!bytes.footPrint) {
    problemas.push('Falta `horizontalGeometryReference=footPrint`: sin él el ICUC no lo procesa.')
  }
  if (!bytes.srsUrn || bytes.srsUri) {
    problemas.push(
      '⛔ El `srsName` no va en URN. En edificio es URN y en parcela URI (override O2): es el ' +
        'error más fácil de cometer copiando de `serialize-cp.js`.',
    )
  }
  if (bytes.faltaDeOrtografia) {
    problemas.push('El fichero copia la falta del PDF oficial: «funtional» en vez de «functional».')
  }
  if (bytes.localIdSaneado) {
    problemas.push(
      `⛔ El \`base:localId\` sale saneado (${JSON.stringify(bytes.localId)}). No es un \`xs:ID\`: ` +
        'es la identidad del edificio, y el fichero del Catastro la trae desnuda.',
    )
  }
  if (bytes.posLists === 0) {
    problemas.push('El fichero no lleva ni una `gml:posList`: no hay geometría.')
  }
  if (!bytes.declaraXlink) {
    problemas.push(
      '⛔ El fichero NO declara `xmlns:xlink` en la raíz, y el ICUC lo RECHAZA sin él. Medido ' +
        'contra el servicio real el 2026-08-06, bisecando en cuatro rondas: es la única diferencia ' +
        'que separa un fichero que carga de uno que no. Ningún elemento lo usa, el XSD no lo exige ' +
        'y la ayuda oficial no lo menciona — por eso hay que vigilarlo desde aquí.',
    )
  }
  if (bytes.usaXlink) {
    advertencias.push(
      'Algún elemento usa el prefijo `xlink`. La declaración dejó de ser «superflua», así que el ' +
        'guardián de arriba ya no protege lo que decía proteger: vuelve a mirarlo.',
    )
  }
}

const trasDescargar = estadoDelCta()
if (descarga !== null && descarga.blobs === 1) {
  if (!/descargad/i.test(trasDescargar.motivo ?? '')) {
    problemas.push(
      `Después de descargar, el renglón no dice que se haya descargado: ` +
        `${JSON.stringify(trasDescargar.motivo)}.`,
    )
  }
  if (descarga.nombre !== null && !(trasDescargar.motivo ?? '').includes(descarga.nombre)) {
    advertencias.push(
      'El renglón no NOMBRA el fichero descargado. Con la carpeta de descargas llena, saber cuál ' +
        'es el suyo se lo dice esta línea o nadie.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ⭐ LO QUE NO SE HA PODIDO COMPROBAR, DICHO — Y SOLO ENTONCES (M3)
// ═════════════════════════════════════════════════════════════════════════════
//
// Se comprueba en los DOS sentidos, porque las dos mitades pueden fallar por
// separado: sin parcela con la que comparar, el aviso TIENE que estar (regla de
// oro 1); con una parcela en pantalla, el aviso NO puede estar, porque entonces
// la comprobación sí se ha hecho y repetirla como «no comprobada» enseña a
// ignorar el panel.

const PATRON_NO_COMPROBADO = /no se ha comprobado si las construcciones caen dentro/i
const m3 = {
  habiaParcela: linea.hayParcelaDePartida,
  verticesDeParcela: linea.verticesDeParcela,
  loDice: hayAviso(PATRON_NO_COMPROBADO),
  avisos: avisosDelPanel().map((a) => `${a.nivel}: ${a.texto.slice(0, 80)}`),
}

if (descarga !== null && descarga.blobs === 1) {
  if (!m3.habiaParcela && !m3.loDice) {
    problemas.push(
      '⛔ Se ha generado el GML de una construcción SIN ninguna parcela con la que compararla, y el ' +
        'panel no lo dice. Dos de las comprobaciones del ICUC —dentro de la parcela y a menos de ' +
        '100 m— no se han podido hacer, y el usuario se ha llevado el fichero creyendo que sí.',
    )
  }
  if (m3.habiaParcela && m3.loDice) {
    problemas.push(
      `⛔ Hay una parcela en pantalla (${m3.verticesDeParcela} vértices) y el panel dice que NO ha ` +
        'podido comprobar si las construcciones caen dentro. O el `parcelaContexto` no le está ' +
        'llegando a la validación, o el aviso se emite sin mirar. Las dos cosas enseñan a ignorar ' +
        'el panel.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · ⭐ ROMPERLO A PROPÓSITO: EL MOTIVO SE LEE, Y CABE
// ═════════════════════════════════════════════════════════════════════════════
//
// Añadir una parte la deja SIN recinto (está pendiente de dibujar), y eso es un
// error bloqueante. Lo que se mide es lo que ve una persona: el botón apagado, el
// recuento delante y el motivo dentro de su caja.
//
// ⚠️ Y por qué se mide en el RENGLÓN y no en el panel: **un botón `disabled` no
// emite `click`**, así que por esta vía el usuario NUNCA llega al panel de avisos.
// El renglón es lo único que lee.

const roto = {
  partesAntes: filasParte().length,
  hayBotonAnadir: tieneCaja($(SEL.ANADIR_PARTE)),
}

if (roto.hayBotonAnadir) {
  $(SEL.ANADIR_PARTE)?.click()
  await dormir(450)
  roto.partesDespues = filasParte().length
  roto.cta = estadoDelCta()
  roto.diceRecuento = /error(es)? bloquea/i.test(roto.cta.motivo ?? '')
  roto.nombraElRecinto = /recinto/i.test(roto.cta.motivo ?? '')
  buscarRetirados(roto.cta.motivo, 'el renglón con el edificio roto')

  if (roto.partesDespues <= roto.partesAntes) {
    advertencias.push(
      'Pulsar «Añadir parte» no ha añadido ninguna: la prueba de romperlo a propósito no mide nada.',
    )
  } else {
    if (roto.cta.encendido) {
      problemas.push(
        '⛔ Se ha añadido una parte SIN recinto —está pendiente de dibujar— y «Generar GML» sigue ' +
          'encendido. Ese GML declararía una construcción sin geometría.',
      )
    }
    if (roto.cta.motivo === null) {
      problemas.push('El botón se ha apagado por un error y el renglón no dice cuál.')
    }
    if (roto.cta.motivo !== null && !roto.diceRecuento) {
      advertencias.push(
        `El renglón no lleva delante el recuento de errores: ${JSON.stringify(roto.cta.motivo)}. El ` +
          'recuento va SIEMPRE delante para que dos motivos no parezcan todos los que hay.',
      )
    }
    if (roto.cta.motivo !== null && !roto.nombraElRecinto) {
      advertencias.push(
        `El motivo no nombra el recinto que falta: ${JSON.stringify(roto.cta.motivo)}. La parte ` +
          'recién añadida no tiene otro problema que ése.',
      )
    }
    if (roto.cta.recortado === true) {
      problemas.push(
        `⛔ El motivo del botón apagado NO CABE en su renglón y se recorta en silencio ` +
          `(caja ${roto.cta.cajaRenglon?.alto} px para ${roto.cta.motivoLargo} caracteres). Es el ` +
          'síntoma mudo de F17 fase 5: el usuario ve media frase y no sabe que falta la otra media.',
      )
    }
    if (roto.cta.cajaRenglon && roto.cta.cajaRenglon.bottom > innerHeight) {
      problemas.push(
        `El renglón del motivo se sale por debajo de la ventana ` +
          `(bottom ${roto.cta.cajaRenglon.bottom} px de ${innerHeight}).`,
      )
    }
  }
} else {
  advertencias.push(
    'No se ve «Añadir parte» en esta pantalla: la prueba de romperlo a propósito se queda sin ' +
      'medir, y con ella el encaje del motivo largo.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · ⭐ EL BOTÓN TIENE DOS DUEÑOS: CONMUTAR DE RAMA CON EL EDIFICIO ROTO
// ═════════════════════════════════════════════════════════════════════════════
//
// Con el edificio ROTO (botón apagado) y la parcela sana, las dos ramas dicen
// cosas distintas del mismo botón. Ésa es la única situación en la que la medida
// discrimina: si `app/main.js` repintara solo el cableado que ENTRA, el botón se
// quedaría en la rama PARCELA tal y como lo dejó EDIFICIO —apagado y con un
// motivo que habla de construcciones—, y al volver se quedaría encendido por la
// parcela cuando el edificio sigue roto.

const edificioRoto = roto.cta?.encendido === false

$(SEL.IR_A_PARCELA)?.click()
await dormir(280)
await irAValidacion()

const enParcela = {
  rama: $(SEL.APP)?.dataset.rama ?? null,
  vertices: verticesEnTabla(),
  cta: estadoDelCta(),
}
buscarRetirados(enParcela.cta.motivo, 'el renglón del CTA en la rama PARCELA')

if (enParcela.rama === 'PARCELA' && enParcela.cta.motivo !== null) {
  if (/construcci[oó]n/i.test(enParcela.cta.motivo)) {
    problemas.push(
      `⛔ En la rama PARCELA el renglón da un motivo de EDIFICIO: ` +
        `${JSON.stringify(enParcela.cta.motivo)}. Los dos dueños del botón se están pisando.`,
    )
  }
}
if (edificioRoto && enParcela.rama === 'PARCELA' && enParcela.vertices > 0) {
  if (enParcela.cta.encendido === false && /recinto/i.test(enParcela.cta.motivo ?? '')) {
    problemas.push(
      '⛔ Con una parcela sana en pantalla, el botón sigue APAGADO por el error del EDIFICIO ' +
        `(${JSON.stringify(enParcela.cta.motivo)}). El cableado de la rama que se ha abandonado ` +
        'sigue mandando: es exactamente lo que `mando()` existe para impedir.',
    )
  }
}

$(SEL.IR_A_EDIFICIO)?.click()
await dormir(280)
await irAValidacion()

const alVolver = {
  rama: $(SEL.APP)?.dataset.rama ?? null,
  partes: filasParte().length,
  cta: estadoDelCta(),
}
buscarRetirados(alVolver.cta.motivo, 'el renglón del CTA al volver a EDIFICIO')

if (edificioRoto && alVolver.rama === 'EDIFICIO' && alVolver.cta.encendido) {
  problemas.push(
    '⛔ Al volver a EDIFICIO con una parte sin recinto, el botón está ENCENDIDO: lo ha dejado así ' +
      'el cableado de PARCELA y nadie lo ha vuelto a evaluar. Quien lo pulse se lleva un fichero ' +
      'de la otra rama, o ninguno y sin explicación.',
  )
}
if (edificioRoto && alVolver.rama === 'EDIFICIO' && alVolver.cta.motivo === null) {
  problemas.push(
    'Al volver a EDIFICIO el botón está apagado y el renglón VACÍO: el motivo se ha quedado en la ' +
      'otra rama.',
  )
}

// ⛔ El resalte por parte, que es lo que NO se puede medir: se comprueba que
// sigue sin existir para que el día que aparezca este guion lo sepa.
const resalte = {
  huellas: $$(SEL.HUELLA).length,
  conMarcaDeHallazgo: $$('.gml-huella--aviso, .gml-huella--error, [data-hallazgos]').length,
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
      'ninguno: todo lo que mide entra por fichero.',
  )
}

window.fetch = fetchOriginal

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '20-gml-edificio',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    '⛔ EL RESALTE POR PARTE (ficha §16.1): `porParte` se construyó en la fase 1 y NO tiene llamante fuera de su módulo. No es que este guion no lo mida: es que no existe. Dueño en §30 del GUION.',
    'SI EL ICUC ACEPTA EL FICHERO: verdad externa que no firma ninguna máquina de esta carpeta → CHECKLIST-HUMANO §18.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0 del GUION): se disparan dragenter/dragover/drop sobre la ventana.',
    'QUE VALIDE CONTRA EL XSD: lo hace `npm run validar:xsd` (espejo del Catastro). ⛔ Y no basta: el fichero que la Sede rechazó el 2026-08-06 validaba contra él — le faltaba `xmlns:xlink`, que aquí sí se mide.',
  ],
  linea,
  vacio,
  diagnosticar,
  cargado,
  descarga:
    descarga === null
      ? null
      : { ...descarga, texto: descarga.texto === null ? null : `${descarga.texto.length} bytes` },
  bytes,
  trasDescargar,
  m3,
  roto,
  enParcela,
  alVolver,
  resalte,
  red,
}
