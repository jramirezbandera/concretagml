// scripts/smoke-navegador/19-partes-plantas.js — F12 · T5.1.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// EL TRABAJO SOBRE UN EDIFICIO, andado de una vez sobre la aplicación real:
//
//     traer 13 partes → elegir una → ponerle plantas → verlas en el mapa
//     → añadir una piscina → dibujarle el recinto a mano → que quepa todo
//
// Las 6.768 pruebas de la suite cubren la lógica. Aquí se mide lo otro, y son
// SEIS cosas que en jsdom salen verdes pase lo que pase:
//
//   1. ⭐ **QUE EL BLOQUE DE PARTE ACTIVA QUEPA, con 13 partes y a 1280×720.**
//      Y —lección de F17 fase 5, que costó una corrida entera— ⛔ **cuando el
//      panel se pasa de sitio NO DESBORDA: la tabla de vértices ENCOGE EN
//      SILENCIO**. En jsdom `getBoundingClientRect()` devuelve ceros, así que un
//      panel que no cabe sale verde en la suite entera. La fase 0 midió que el
//      bloque de origen se comía **397,19 px** y la lista se quedaba en **45,17
//      px = 1 fila**; T4.1 pliega el selector de modelo (**−174,41 px**) y
//      reparte por pantallas. Esto comprueba que el reparto sirvió.
//   2. ⭐ **QUE LOS RÓTULOS ROMANOS SE LEAN.** Son `tooltip` permanentes de
//      Leaflet en el pane 422; en jsdom no hay maquetación, así que «existe el
//      nodo» es todo lo que la suite puede afirmar. Aquí se miden sus cajas y se
//      comprueba que **no los tapa nadie** — que es el modo de fallo real: el
//      pane 422 va DEBAJO de los marcadores de edición a propósito.
//   3. ⭐ **QUE LA ENVOLVENTE SE REPINTE al cambiar las plantas.** Es el
//      criterio 3 de la ficha y el único que se deriva en vivo: poner a `0` las
//      plantas sobre rasante de una parte la SACA de la envolvente (pasa a ser
//      un sótano). La suite lo prueba sobre POJOs; que la línea del mapa cambie
//      de verdad, no.
//   4. ⭐ **DIBUJAR UN RECINTO CON CLICS DE VERDAD.** `viewer/dibujo.js` cuelga
//      de los eventos de Leaflet (`click`, `dblclick`) y del `keydown` del
//      documento, y consume el mismo `ajustar` del enganche. La suite lo prueba
//      con dobles; aquí hay hit-testing, proyección y un mapa que se mueve.
//      ⚠️ Es además donde se estrenó el defecto de integración de la fase 4:
//      `ajustar(punto, null)` **lanzaba**, y los dos módulos pasaban sus pruebas.
//   5. ⭐ **QUE «Dibujar recinto» APAREZCA Y DESAPAREZCA donde toca.** Nace
//      oculto —no apagado—: en la rama PARCELA no hay «parte» que dibujar. Un
//      botón que se enseña de más aquí es una herramienta que no hace nada.
//   6. ⭐ **QUE EL EJE PASO TOQUE A ESTA RAMA.** La medida M2 de la fase 0 lo
//      midió y salió que NO: los dos bloques de edificio medían **314,97 /
//      157,06 px idénticos en los cinco pasos**, o sea cinco peldaños encendidos
//      y una sola pantalla. T4.1 les dio `data-pantalla`. Esto lo remide.
//
// ── ⛔ Y UNA QUE NO ES DE PÍXELES: EL AUTOGUARDADO SOBRE INDEXEDDB DE VERDAD ─
// La suite de T4.3 corre sobre `fake-indexeddb`, que no es una base de datos.
// Aquí se comprueba lo que de verdad importa de aquella tarea: que el borrador
// de EDIFICIO se escribe **en su propia clave** y **no pisa** el de parcela.
// Es la afirmación que sostenía entera la desviación 7 de F11.
//
// ── RÉGIMEN DE RED: NINGUNA A SERVICIOS DE DATOS ────────────────────────────
// Se trabaja con el fixture BU real traído por `fetch` del propio servidor, así
// que **esto solo funciona en DEV**: `vite preview` sirve `dist/`, donde los
// fixtures no están. Lo mismo que los §16, §19, §26 y §27.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · **Si las plantas que trae el fichero son las que el técnico esperaba.**
//     Que las trece las traigan está medido (fase 0, M5); que `Parte 10` sea un
//     sótano de 245,90 m² es un hecho del fixture, no un acierto nuestro.
//   · **Si el reparto del panel se ENTIENDE.** Que quepa se mide aquí; que se
//     lea como una lista con una ficha debajo es juicio humano → §16 del
//     `CHECKLIST-HUMANO.md`.
//   · **El arrastre como gesto de ratón** (§0 del GUION).
//   · **Que la envolvente sea la correcta.** La topología la prueban 30 tests de
//     `test/edificio/envolvente.test.js` con Turf; aquí solo se mira si cambia.

const t0 = performance.now()
const problemas = []
const advertencias = []

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const esperarA = async (pred, ms = 4000, cada = 80) => {
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
    left: redondear(r.left),
    bottom: redondear(r.bottom),
    right: redondear(r.right),
  }
}

const tieneCaja = (el) => {
  const c = caja(el)
  return c !== null && c.alto > 0 && c.ancho > 0
}

/**
 * ⛔ **Las TRES patas, y hacen falta las tres.** La lección es del guion 15: con
 * una sola —«el nodo existe»— el defecto salía verde. Un elemento puede estar en
 * el DOM, medir bien, y estar **tapado** por otro o **fuera** de la ventana.
 */
function seVeDeVerdad(nodo) {
  if (!nodo) return { existe: false }
  const c = caja(nodo)
  const dentro =
    c !== null && c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight && c.right <= innerWidth
  const cx = Math.round(c.left + c.ancho / 2)
  const cy = Math.round(c.top + c.alto / 2)
  const encima = document.elementFromPoint(cx, cy)

  // ⛔ **`pointer-events: none` rompe la tercera pata, y la primera corrida acusó
  // en falso por eso.** `elementFromPoint` devuelve lo que RECIBE EL PUNTERO, no
  // lo que se ve encima; un rótulo que a propósito no intercepta el ratón —los
  // `tooltip` de Leaflet lo son— nunca puede salir de ahí, y el guardián lo leía
  // como «tapado». Medido: el rótulo de plantas está en el índice 2 de su pane y
  // el SVG de las huellas en el 0, o sea que **pinta encima**; lo que devolvía
  // `elementFromPoint` era el `<path>` de debajo.
  //
  // Para esos nodos la pregunta se contesta por ORDEN DE PINTADO dentro del
  // mismo padre, que es lo que de verdad decide quién se ve.
  const transparenteAlPuntero = getComputedStyle(nodo).pointerEvents === 'none'
  const hermanos = nodo.parentElement ? [...nodo.parentElement.children] : []
  const miIndice = hermanos.indexOf(nodo)
  const indiceDelDeAbajo =
    encima === null ? -1 : hermanos.findIndex((h) => h === encima || h.contains(encima))
  const pintaEncima = transparenteAlPuntero && miIndice > indiceDelDeAbajo

  return {
    existe: true,
    caja: c,
    dentroDeLaVentana: dentro,
    transparenteAlPuntero,
    esElDeArriba:
      encima === nodo || nodo.contains(encima) || (encima && encima.contains(nodo)) || pintaEncima,
    tapadoPor:
      !pintaEncima && encima && !nodo.contains(encima) && !encima.contains(nodo)
        ? nombreDe(encima)
        : null,
  }
}

/**
 * Cómo se llama un nodo en un mensaje.
 *
 * ⛔ **`className` NO es un string en SVG**, y la primera corrida lo escupió tal
 * cual: en un elemento SVG es un `SVGAnimatedString`, así que el guion acusaba
 * «tapado por [object SVGAnimatedString]» —que no nombra a nadie— justo en el
 * único sitio donde todo es SVG, que es el mapa.
 */
function nombreDe(nodo) {
  const clase = nodo.className
  const texto = typeof clase === 'string' ? clase : (clase?.baseVal ?? '')
  return texto.trim() !== '' ? texto.trim() : nodo.tagName
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

/** Un clic de verdad, con coordenadas de ventana: hit-testing incluido. */
function clicEn(x, y, tipo = 'click', detalle = 1) {
  const diana = document.elementFromPoint(x, y)
  if (!diana) return null
  diana.dispatchEvent(
    new MouseEvent(tipo, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      detail: detalle,
      view: window,
    }),
  )
  return diana
}

const teclear = (key) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

/** Dispara `change` como lo haría una persona: el valor primero, el evento después. */
function fijarCampo(nodo, valor) {
  if (!nodo) return false
  nodo.value = String(valor)
  nodo.dispatchEvent(new Event('input', { bubbles: true }))
  nodo.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

// ── Selectores del contrato ─────────────────────────────────────────────────

const SEL = {
  APP: '.gml-app',
  MAPA: '.leaflet-container',
  TABLA_VERTICES: '#tabla-vertices',
  AVISOS: '#avisos',
  IR_A_EDIFICIO: '[data-ir-a-rama="EDIFICIO"]',
  IR_A_PARCELA: '[data-ir-a-rama="PARCELA"]',
  IR_A_PASO: (p) => `[data-ir-a-paso="${p}"]`,

  // Panel de edificio (app/panel-edificio.js#SELECTOR)
  MODELO: '[data-campo="modelo-edificio"]',
  DESPLEGAR_MODELO: '[data-accion="desplegar-modelo"]',
  LISTA_PARTES: '[data-lista="partes"]',
  FILA_PARTE: '.gml-parte',
  NOMBRE_PARTE: '.gml-parte-nombre',
  PARTE_ACTIVA: '.gml-parte--activa',
  ANADIR_PARTE: '[data-accion="anadir-parte"]',
  ELIMINAR_PARTE: '[data-accion="eliminar-parte"]',
  TIPO_PARTE: '[data-campo="tipo-parte"]',
  PLANTAS_SOBRE: '[data-campo="plantas-sobre"]',
  PLANTAS_BAJO: '[data-campo="plantas-bajo"]',
  SUPERFICIE_ACTIVA: '[data-campo="superficie-parte"]',
  ESTADO_ACTIVA: '[data-estado="parte-activa"]',
  HUELLA_TOTAL: '[data-campo="huella-edificio"]',
  TABLA_ACTIVA: '[data-tabla="parte-activa"]',
  ESTADO_EDIFICIO: '[data-estado="edificio"]',
  PROCEDENCIA: '[data-procedencia="edificio"]',

  // Barra de edición y mapa (viewer/)
  DIBUJAR: '[data-accion="dibujar-recinto"]',
  AYUDA: '[data-accion="ayuda"]',
  HUELLA: '.gml-huella',
  ROTULO_PLANTAS: '.gml-huella-plantas',
  ENVOLVENTE: '.gml-envolvente',
}

const altoVertices = () => caja($(SEL.TABLA_VERTICES))?.alto ?? null
const filasParte = () => $$(SEL.FILA_PARTE)
const pathsDelMapa = () => $$('.leaflet-container path').length

/** Los avisos como LISTA de textos, no como un churro (lección del guion 17). */
const avisosComoLista = () =>
  $$(`${SEL.AVISOS} li, ${SEL.AVISOS} .gml-aviso`).map((n) => n.textContent.trim())

/** Las secciones del panel de edificio, con el paso al que dicen pertenecer. */
const seccionesDeEdificio = () =>
  $$('[data-rama-panel="EDIFICIO"]').map((s) => ({
    pantalla: s.getAttribute('data-pantalla'),
    oculta: s.hidden,
    alto: caja(s)?.alto ?? null,
  }))

// ── Red: se cuenta lo que sale ──────────────────────────────────────────────

const peticiones = []
const fetchOriginal = window.fetch
window.fetch = function (recurso, ...resto) {
  peticiones.push(typeof recurso === 'string' ? recurso : (recurso?.url ?? String(recurso)))
  return fetchOriginal.call(this, recurso, ...resto)
}

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Línea base
// ═════════════════════════════════════════════════════════════════════════════

const linea = {
  viewport: { w: innerWidth, h: innerHeight },
  paso: $(SEL.APP)?.dataset.paso ?? null,
  rama: $(SEL.APP)?.dataset.rama ?? null,
  verticesPx: altoVertices(),
  hayMapa: tieneCaja($(SEL.MAPA)),
  hayConmutador: tieneCaja($(SEL.IR_A_EDIFICIO)),
}

if (!linea.hayMapa) problemas.push('No hay mapa: la aplicación no ha arrancado.')
if (!linea.hayConmutador) {
  problemas.push('No se ve el botón de la rama EDIFICIO: sin él no hay nada que medir aquí.')
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · A la rama EDIFICIO, y el fixture real de 13 partes
// ═════════════════════════════════════════════════════════════════════════════

$(SEL.IR_A_EDIFICIO)?.click()
await dormir(150)

const enEdificioVacio = {
  rama: $(SEL.APP)?.dataset.rama ?? null,
  paso: $(SEL.APP)?.dataset.paso ?? null,
  // ⚠️ El botón de dibujar NACE OCULTO. Aquí no hay ni edificio ni parte activa.
  dibujarVisible: tieneCaja($(SEL.DIBUJAR)),
  secciones: seccionesDeEdificio(),
}

if (enEdificioVacio.rama !== 'EDIFICIO') {
  problemas.push(
    `Pulsar el conmutador no ha llevado a la rama EDIFICIO: sigue en «${enEdificioVacio.rama}».`,
  )
}
if (enEdificioVacio.dibujarVisible) {
  problemas.push(
    '⛔ «Dibujar recinto» se ve sin edificio y sin parte elegida. Nace OCULTO a propósito: una ' +
      'herramienta visible que no puede hacer nada es peor que no tenerla.',
  )
}

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
  await esperarA(() => filasParte().length > 0, 6000)
}

const cargado = {
  filas: filasParte().length,
  paths: pathsDelMapa(),
  huellas: $$(SEL.HUELLA).length,
  estado: $(SEL.ESTADO_EDIFICIO)?.textContent.trim() ?? null,
  procedencia: $(SEL.PROCEDENCIA)?.textContent.trim() ?? null,
  huellaTotal: $(SEL.HUELLA_TOTAL)?.textContent.trim() ?? null,
}

if (cargado.filas === 0) {
  problemas.push('El fichero BU no ha cargado ni una parte: el resto del guion no mide nada.')
}
if (cargado.filas > 0 && cargado.huellas === 0) {
  problemas.push(
    `Se han cargado ${cargado.filas} partes y NO hay ni una huella dibujada en el mapa. La lista ` +
      'del panel y el mapa dicen cosas distintas sobre el mismo documento.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ EL PLIEGUE DEL SELECTOR DE MODELO (−174,41 px medidos en la fase 0)
// ═════════════════════════════════════════════════════════════════════════════
//
// La fase 0 midió que el selector se comía 174,41 px PERMANENTES en un panel al
// que le faltaba sitio. T4.1 lo pliega en cuanto entra un edificio —el modelo se
// elige ANTES de cargar, así que después estorba— y deja una puerta para volver
// a abrirlo. Las dos mitades importan: plegar sin poder desplegar sería esconder.

const pliegue = (() => {
  const selector = $(SEL.MODELO)
  const puerta = $(SEL.DESPLEGAR_MODELO)
  const visibleAntes = tieneCaja(selector)
  const hayPuerta = tieneCaja(puerta)
  if (!hayPuerta) return { plegado: !visibleAntes, hayPuerta, sePuedeDesplegar: null }
  puerta.click()
  const visibleDespues = tieneCaja($(SEL.MODELO))
  return {
    plegado: !visibleAntes,
    hayPuerta,
    sePuedeDesplegar: visibleDespues,
    altoDelSelectorPx: caja($(SEL.MODELO))?.alto ?? null,
  }
})()

if (cargado.filas > 0 && !pliegue.plegado) {
  advertencias.push(
    'El selector de modelo sigue desplegado con un edificio cargado. La fase 0 midió que cuesta ' +
      '174,41 px permanentes; plegarlo era el grueso del presupuesto de T4.1.',
  )
}
if (pliegue.hayPuerta && pliegue.sePuedeDesplegar === false) {
  problemas.push(
    '⛔ El selector de modelo está plegado y su puerta NO lo despliega. Plegar sin poder abrir es ' +
      'esconder un control, no ahorrar sitio.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ EL EJE PASO EN ESTA RAMA (medida M2 de la fase 0, remedida)
// ═════════════════════════════════════════════════════════════════════════════
//
// M2 midió que el eje PASO **no tocaba** al panel de edificio: sus dos bloques
// medían 314,97 / 157,06 px idénticos en los cinco pasos. Cinco peldaños
// encendidos y una sola pantalla. T4.1 les puso `data-pantalla`.

const porPantalla = {}
for (const paso of ['entrada', 'validacion', 'edicion']) {
  const boton = $(SEL.IR_A_PASO(paso))
  if (!boton || boton.disabled) {
    porPantalla[paso] = { alcanzable: false, motivo: boton ? 'apagado' : 'no existe' }
    continue
  }
  boton.click()
  await dormir(180)
  porPantalla[paso] = {
    alcanzable: true,
    paso: $(SEL.APP)?.dataset.paso ?? null,
    secciones: seccionesDeEdificio().map((s) => ({ pantalla: s.pantalla, alto: s.alto })),
    verticesPx: altoVertices(),
  }
}

const alturasPorPaso = Object.entries(porPantalla)
  .filter(([, v]) => v.alcanzable)
  .map(([paso, v]) => [paso, v.secciones.map((s) => s.alto).join('/')])
const ejePasoMueveAlgo = new Set(alturasPorPaso.map(([, firma]) => firma)).size > 1

if (alturasPorPaso.length > 1 && !ejePasoMueveAlgo) {
  problemas.push(
    '⛔ El eje PASO sigue sin tocar al panel de EDIFICIO: las secciones miden lo mismo en todos ' +
      `los pasos alcanzados (${alturasPorPaso.map(([p, f]) => `${p}: ${f}`).join(' · ')}). Es la ` +
      'medida M2 de la fase 0 sin corregir: varios peldaños encendidos y una sola pantalla.',
  )
}

// Que «Edición» sea alcanzable en esta rama es la mitad que hacía inalcanzable a
// F12 entera: hasta la fase 4 el peldaño estaba apagado con un motivo caducado.
if (porPantalla.edicion && !porPantalla.edicion.alcanzable) {
  problemas.push(
    `⛔ El peldaño «Edición» NO es alcanzable en la rama EDIFICIO (${porPantalla.edicion.motivo}). ` +
      'Sin él, nada de F12 se puede usar: el motor de edición existe y nadie lo enciende.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ⭐ ELEGIR UNA PARTE, PONERLE PLANTAS Y VERLAS EN EL MAPA
// ═════════════════════════════════════════════════════════════════════════════

// Se trabaja en Edición, que es donde vive el bloque de parte activa.
$(SEL.IR_A_PASO('edicion'))?.click()
await dormir(200)

const elegirParte = (i) => {
  const fila = filasParte()[i]
  const boton = fila?.querySelector(SEL.NOMBRE_PARTE)
  boton?.click()
  return boton !== null && boton !== undefined
}

elegirParte(0)
await dormir(150)

const activa = {
  filasMarcadas: $$(SEL.PARTE_ACTIVA).length,
  hayBloque: tieneCaja($(SEL.SUPERFICIE_ACTIVA)) || tieneCaja($(SEL.TIPO_PARTE)),
  tipo: $(SEL.TIPO_PARTE)?.value ?? null,
  plantasSobreVisible: tieneCaja($(SEL.PLANTAS_SOBRE)),
  plantasBajoVisible: tieneCaja($(SEL.PLANTAS_BAJO)),
  superficie: $(SEL.SUPERFICIE_ACTIVA)?.textContent.trim() ?? null,
  filasTablaActiva: $$(`${SEL.TABLA_ACTIVA} tbody tr`).length,
}

if (cargado.filas > 0 && activa.filasMarcadas !== 1) {
  problemas.push(
    `Elegir una parte deja ${activa.filasMarcadas} fila(s) marcada(s) como activa. Tiene que ser ` +
      'exactamente una: si no, el bloque de abajo no dice de qué parte habla.',
  )
}
if (cargado.filas > 0 && !activa.hayBloque) {
  problemas.push('Con una parte elegida no se ve el bloque de parte activa.')
}
if (cargado.filas > 0 && !activa.plantasSobreVisible) {
  problemas.push(
    'La parte elegida es PRINCIPAL y no se ven los contadores de plantas. Son el dato que ' +
      'distingue un volumen de otro en el modelo INSPIRE (override O11).',
  )
}

// ⭐ Los rótulos romanos. La parte 1 del fixture trae plantas, así que tiene que
// haber al menos uno; y tiene que VERSE, que es otra cosa.
//
// ⛔ **Se espera al desvanecido y se cuentan solo los OPACOS**, y las dos cosas
// las aprendió la primera corrida: elegir una parte repinta la capa, y
// `L.Tooltip.onRemove` **deja el nodo viejo 200 ms en el DOM con `opacity: 0`**
// cuando el mapa tiene `fadeAnimation` (que es el defecto de Leaflet). Medido:
// 26 rótulos para 13 partes justo después de elegir, y 13 un segundo después.
// Contar nodos en mitad de una transición es contar fantasmas — y habría acusado
// de una fuga de memoria que no existe.
await dormir(400)
const rotulos = (() => {
  const todos = $$(SEL.ROTULO_PLANTAS)
  const nodos = todos.filter((n) => Number.parseFloat(getComputedStyle(n).opacity) > 0.05)
  const primeros = nodos.slice(0, 3).map((n) => ({
    texto: n.textContent.trim(),
    ...seVeDeVerdad(n),
  }))
  return {
    cuantos: nodos.length,
    enElDom: todos.length,
    textos: nodos.map((n) => n.textContent.trim()),
    primeros,
  }
})()

// Y el guardián de la fuga, que sigue haciendo falta: si los que se van dejaran
// de irse, `enElDom` crecería sin parar y `cuantos` no lo vería.
if (rotulos.enElDom > rotulos.cuantos + 1) {
  advertencias.push(
    `Hay ${rotulos.enElDom} rótulos en el DOM y solo ${rotulos.cuantos} visibles. Si la diferencia ` +
      'crece con el uso, la capa no está retirando los que sustituye.',
  )
}

if (cargado.filas > 0 && rotulos.cuantos === 0) {
  problemas.push(
    '⛔ Ninguna huella lleva rótulo de plantas en el mapa, y las 13 partes del fixture las traen ' +
      '(medido en la fase 0, M5). El dato está en el modelo y no llega al plano.',
  )
}
// ⚠️ **La forma del rótulo la fija `viewer/partes.js#rotuloPlantas`, y son TRES**,
// no una: el romano solo (`VII`), el romano con sus sótanos entre paréntesis
// (`VII (−1)`) y —una parte que solo tiene sótano— los sótanos solos (`(−1)`).
//
// ⛔ La primera corrida de este guion exigía `/^[IVXLCDM]+$/` y **acusó en falso**
// al fixture real: sus partes traen sótanos, así que el rótulo bueno es
// `VII (−1)`. Un guardián escrito desde la ficha y no desde el código acusa al
// producto de cumplir lo que el código dice.
const FORMA_ROTULO = /^(?:[IVXLCDM]+(?: \(−\d+\))?|\(−\d+\))$/
const romanoMalo = rotulos.textos.find((t) => t !== '' && !FORMA_ROTULO.test(t))
if (romanoMalo !== undefined) {
  problemas.push(
    `Un rótulo de plantas no tiene la forma que fija rotuloPlantas: ${JSON.stringify(romanoMalo)}. ` +
      'Se esperaba un romano («II»), un romano con sus sótanos («II (−1)») o solo sótanos («(−1)»).',
  )
}
const rotuloTapado = rotulos.primeros.find((r) => r.existe && r.tapadoPor !== null)
if (rotuloTapado) {
  problemas.push(
    `Un rótulo de plantas está TAPADO por «${rotuloTapado.tapadoPor}»: se pinta debajo de otra ` +
      'cosa, así que el dato está en el plano y no se lee. Es el criterio de F12 que dice que las ' +
      'plantas se vean sobre cada parte.',
  )
}
const rotuloFuera = rotulos.primeros.find((r) => r.existe && !r.dentroDeLaVentana)
if (rotuloFuera) {
  advertencias.push(
    'Algún rótulo de plantas cae fuera de la ventana. Con 13 partes y el encuadre automático ' +
      'puede ser legítimo (una parte en el borde); míralo en el §16.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · ⭐ LA ENVOLVENTE SE REPINTA AL CAMBIAR LAS PLANTAS (criterio 3)
// ═════════════════════════════════════════════════════════════════════════════
//
// Poner a 0 las plantas sobre rasante de una parte la convierte en un SÓTANO, y
// `edificio/envolvente.js` la deja fuera. Lo que se mide es que la línea del
// mapa cambie: la topología ya la prueban 30 tests con Turf.

const geometriaEnvolvente = () => {
  const nodo = $(SEL.ENVOLVENTE)
  return nodo === null ? null : (nodo.getAttribute('d') ?? '').length
}

const envolvente = { antes: geometriaEnvolvente(), hayLinea: $(SEL.ENVOLVENTE) !== null }

if (envolvente.hayLinea && activa.plantasSobreVisible) {
  fijarCampo($(SEL.PLANTAS_SOBRE), 0)
  await dormir(300)
  envolvente.despuesDeCero = geometriaEnvolvente()
  envolvente.cambia = envolvente.antes !== envolvente.despuesDeCero

  // Y se devuelve a como estaba, para no dejar el documento tocado para el resto.
  fijarCampo($(SEL.PLANTAS_SOBRE), 2)
  await dormir(300)
  envolvente.alVolver = geometriaEnvolvente()
  envolvente.vuelve = envolvente.alVolver === envolvente.antes
}

if (envolvente.hayLinea && envolvente.cambia === false) {
  problemas.push(
    '⛔ Poner a 0 las plantas sobre rasante de una parte NO cambia la envolvente dibujada. Esa ' +
      'parte pasa a ser un sótano y la envolvente es de lo que hay SOBRE rasante: es el criterio ' +
      '3 de la ficha, y se está derivando de un dato que ya no vale.',
  )
}
if (!envolvente.hayLinea) {
  advertencias.push(
    'No hay línea de envolvente en el mapa. Puede ser legítimo (una sola parte sobre rasante no ' +
      'necesita unión), pero entonces el criterio 3 se queda sin medir aquí.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · ⭐ AÑADIR UNA PISCINA: LAS PARTES «OTRA» NO ENSEÑAN CONTADORES
// ═════════════════════════════════════════════════════════════════════════════
//
// Criterio de aceptación 1 de la ficha, en su forma comprobable: los contadores
// de plantas **no están**, no están vacíos ni apagados. Es la misma forma que
// F11 estrenó con los siete atributos del modelo COMPLETO.

const antesDeAnadir = filasParte().length
$(SEL.ANADIR_PARTE)?.click()
await dormir(200)

const anadida = {
  filas: filasParte().length,
  crecio: filasParte().length === antesDeAnadir + 1,
  quedaElegida: $$(SEL.PARTE_ACTIVA).length === 1,
  estado: $(SEL.ESTADO_ACTIVA)?.textContent.trim() ?? null,
  superficie: $(SEL.SUPERFICIE_ACTIVA)?.textContent.trim() ?? null,
}

if (!anadida.crecio) {
  problemas.push(
    `«Añadir parte» no ha añadido nada: la lista sigue en ${anadida.filas}. Es la vía por la que ` +
      'se declara el porche o la piscina que no venían en ningún fichero, que es el encargo real.',
  )
}
if (anadida.crecio && !anadida.quedaElegida) {
  problemas.push(
    'La parte recién añadida no queda elegida. Quien añade una parte lo hace para dibujarla, y ' +
      'obligarle a pulsarla después es un paso que no aporta nada.',
  )
}

// Y ahora se pasa a «Otra»: una piscina.
const piscina = (() => {
  const select = $(SEL.TIPO_PARTE)
  if (!select) return { hayCampoTipo: false }
  const opciones = [...select.options].map((o) => o.value)
  fijarCampo(select, 'OTRA')
  return {
    hayCampoTipo: true,
    opciones,
    tipoTrasCambiar: $(SEL.TIPO_PARTE)?.value ?? null,
    // ⭐ El criterio 1: NO ESTÁN. `querySelector` devolviendo `null` es la
    // afirmación; un nodo oculto o apagado NO valdría.
    plantasSobreEnElDom: $(SEL.PLANTAS_SOBRE) !== null,
    plantasBajoEnElDom: $(SEL.PLANTAS_BAJO) !== null,
  }
})()

await dormir(150)
piscina.plantasSobreTrasEsperar = $(SEL.PLANTAS_SOBRE) !== null
piscina.plantasBajoTrasEsperar = $(SEL.PLANTAS_BAJO) !== null

if (piscina.hayCampoTipo && (piscina.plantasSobreTrasEsperar || piscina.plantasBajoTrasEsperar)) {
  problemas.push(
    '⛔ CRITERIO 1: una parte de tipo «Otra» —una piscina— sigue enseñando contadores de plantas. ' +
      'Tienen que NO ESTAR, no estar vacíos ni apagados: una piscina no tiene plantas, y un campo ' +
      'en blanco invita a rellenarlo.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 7 · ⭐ DIBUJARLE EL RECINTO A MANO, CON CLICS DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════

const dibujo = { botonVisible: tieneCaja($(SEL.DIBUJAR)) }

if (!dibujo.botonVisible) {
  problemas.push(
    '⛔ Con una parte elegida y en Edición, «Dibujar recinto» NO se ve. Es la herramienta con la ' +
      'que se declara lo que no estaba en ningún fichero: sin ella, F12 no resuelve su caso común.',
  )
} else {
  const rotuloAntes = $(SEL.DIBUJAR)?.textContent.trim() ?? null
  $(SEL.DIBUJAR).click()
  await dormir(150)
  dibujo.rotuloAntes = rotuloAntes
  dibujo.rotuloDibujando = $(SEL.DIBUJAR)?.textContent.trim() ?? null
  dibujo.cambiaElRotulo = dibujo.rotuloAntes !== dibujo.rotuloDibujando

  // Cuatro esquinas dentro del mapa, lejos de los bordes y de la barra de abajo.
  const c = caja($(SEL.MAPA))
  const px = (fx, fy) => [Math.round(c.left + c.ancho * fx), Math.round(c.top + c.alto * fy)]
  const esquinas = [px(0.35, 0.35), px(0.55, 0.35), px(0.55, 0.5), px(0.35, 0.5)]

  const pathsAntesDeDibujar = pathsDelMapa()
  for (const [x, y] of esquinas) {
    clicEn(x, y)
    await dormir(90)
  }
  dibujo.esquinasPuestas = esquinas.length

  // Cerrar con Enter, que es el camino de teclado y no depende del doble clic.
  teclear('Enter')
  await dormir(350)

  dibujo.filasTablaActivaTrasCerrar = $$(`${SEL.TABLA_ACTIVA} tbody tr`).length
  dibujo.superficieTrasCerrar = $(SEL.SUPERFICIE_ACTIVA)?.textContent.trim() ?? null
  dibujo.estadoTrasCerrar = $(SEL.ESTADO_ACTIVA)?.textContent.trim() ?? null
  dibujo.pathsAntes = pathsAntesDeDibujar
  dibujo.pathsDespues = pathsDelMapa()
  dibujo.rotuloTrasCerrar = $(SEL.DIBUJAR)?.textContent.trim() ?? null

  if (!dibujo.cambiaElRotulo) {
    problemas.push(
      'Pulsar «Dibujar recinto» no cambia el rótulo del botón. Mientras dura el trazo hay que ' +
        'poder salir, y el mismo botón es la salida: si no lo dice, no hay ninguna.',
    )
  }
  if (dibujo.filasTablaActivaTrasCerrar < 4) {
    problemas.push(
      `Se han pinchado 4 esquinas y la tabla de la parte activa tiene ` +
        `${dibujo.filasTablaActivaTrasCerrar} fila(s). El recinto dibujado no ha entrado en el ` +
        'modelo, o no ha llegado a la tabla que lo enseña.',
    )
  }
  if (dibujo.rotuloTrasCerrar !== null && dibujo.rotuloTrasCerrar === dibujo.rotuloDibujando) {
    problemas.push(
      'El botón se ha quedado en «cancelar dibujo» después de cerrar el recinto: la herramienta ' +
        'dice que sigue dibujando cuando ya no.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8 · ⭐ EL PRESUPUESTO DE ALTURA, CON 14 PARTES Y A LA VENTANA QUE HAYA
// ═════════════════════════════════════════════════════════════════════════════
//
// ⛔ **La lección de F17 fase 5**: cuando el panel se pasa de sitio NO DESBORDA.
// La tabla de vértices ENCOGE en silencio, y un guardián que solo mirara
// `scrollHeight > clientHeight` aprobaría una pantalla rota. Por eso se miden
// las DOS cosas: el desborde Y el invariante de la caja de vértices.

const reparto = (() => {
  const panel = $('[data-rama-panel="EDIFICIO"]')?.closest('.gml-panel, aside, [class*="panel"]')
  const lista = $(SEL.LISTA_PARTES)
  const cajaLista = caja(lista)
  const filaPx = filasParte()[0] ? caja(filasParte()[0]).alto : null
  const secciones = seccionesDeEdificio()
  return {
    viewport: { w: innerWidth, h: innerHeight },
    partes: filasParte().length,
    altoListaPx: cajaLista?.alto ?? null,
    altoDeUnaFilaPx: filaPx,
    filasEnterasQueCaben: filaPx && cajaLista ? Math.floor(cajaLista.alto / filaPx) : null,
    listaDesborda: lista ? lista.scrollHeight > lista.clientHeight + 1 : null,
    secciones,
    // El bloque de parte activa: si no cabe, F12 no se puede usar.
    bloqueActivaPx: secciones.find((s) => (s.pantalla ?? '').includes('edicion'))?.alto ?? null,
    verticesPx: altoVertices(),
    // ⛔ El invariante que cinco fases llevan defendiendo.
    verticesEnLinea: linea.verticesPx,
  }
})()

const SUELO_VERTICES = 220

if (reparto.filasEnterasQueCaben !== null && reparto.filasEnterasQueCaben < 3) {
  problemas.push(
    `La lista de partes deja ver ${reparto.filasEnterasQueCaben} fila(s) entera(s) con ` +
      `${reparto.partes} partes cargadas (${reparto.altoListaPx} px, fila de ` +
      `${reparto.altoDeUnaFilaPx} px). Con menos de tres, elegir una parte es desplazarse a ` +
      'ciegas: la fase 0 midió UNA y ése era el déficit que T4.1 tenía que cerrar.',
  )
}
if (reparto.verticesPx !== null && reparto.verticesPx > 0 && reparto.verticesPx < SUELO_VERTICES) {
  problemas.push(
    `⛔ La caja de vértices ha bajado a ${reparto.verticesPx} px, por debajo del suelo de ` +
      `${SUELO_VERTICES} que este proyecto lleva cinco fases defendiendo. Es el síntoma MUDO de ` +
      'F17: el panel no desborda, encoge lo de al lado.',
  )
}
if (reparto.bloqueActivaPx !== null && reparto.bloqueActivaPx < 60) {
  problemas.push(
    `El bloque de parte activa mide ${reparto.bloqueActivaPx} px: no cabe. Es donde viven las ` +
      'plantas, la superficie y la tabla de coordenadas de la parte que se está editando.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 9 · ⭐ EL AUTOGUARDADO DE LA RAMA, SOBRE INDEXEDDB DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════
//
// La suite de T4.3 corre sobre `fake-indexeddb`, que no es una base de datos. Lo
// que se comprueba aquí es la afirmación que sostenía entera la desviación 7 de
// F11: que el borrador de EDIFICIO **no pisa** el de parcela.

const CLAVE_PARCELA = 'EXP-borrador-en-curso'
const CLAVE_EDIFICIO = 'EXP-borrador-edificio-en-curso'

const leerBorradores = () =>
  new Promise((resolver) => {
    const peticion = indexedDB.open('concreta-gml')
    peticion.onerror = () => resolver({ error: 'no se ha podido abrir la base' })
    peticion.onsuccess = () => {
      const db = peticion.result
      if (!db.objectStoreNames.contains('expedientes')) {
        db.close()
        resolver({ error: 'no hay almacén de expedientes' })
        return
      }
      const tx = db.transaction('expedientes', 'readonly')
      const almacen = tx.objectStore('expedientes')
      const salida = {}
      const pedir = (clave, nombre) => {
        const p = almacen.get(clave)
        p.onsuccess = () => {
          const r = p.result
          salida[nombre] =
            r === undefined
              ? null
              : {
                  tipo: r.expediente?.tipo ?? null,
                  idLocal:
                    r.expediente?.edificio?.idLocal ?? r.expediente?.parcela?.idLocal ?? null,
                  partes: r.expediente?.edificio?.partes?.length ?? null,
                  recintos: r.expediente?.parcela?.recintos?.length ?? null,
                }
        }
      }
      pedir(CLAVE_PARCELA, 'parcela')
      pedir(CLAVE_EDIFICIO, 'edificio')
      tx.oncomplete = () => {
        db.close()
        resolver(salida)
      }
      tx.onerror = () => {
        db.close()
        resolver({ error: 'la transacción ha fallado' })
      }
    }
  })

// El debounce son 2 s (`storage/autoguardado.js#MS_AUTOGUARDADO`). Se espera a
// que escriba solo: forzarlo desde aquí mediría el atajo y no el mecanismo.
await dormir(2600)
const borradores = await leerBorradores()

if (borradores.error) {
  advertencias.push(`No se han podido leer los borradores de IndexedDB: ${borradores.error}.`)
} else {
  if (borradores.edificio === null) {
    problemas.push(
      '⛔ Se ha trabajado sobre un edificio y NO hay borrador de edificio en IndexedDB después de ' +
        'los 2 s del debounce. Es lo que T4.3 existe para arreglar: cerrar la pestaña se lo lleva.',
    )
  }
  if (borradores.edificio !== null && borradores.edificio.tipo !== 'EDIFICIO') {
    problemas.push(
      `La clave reservada del edificio guarda un expediente de tipo ` +
        `«${borradores.edificio.tipo}». Las dos claves se están pisando, que es exactamente lo ` +
        'que el reparto por rama existe para impedir.',
    )
  }
  if (borradores.parcela !== null && borradores.parcela.tipo !== 'PARCELA') {
    problemas.push(
      `La clave reservada de la parcela guarda un expediente de tipo ` +
        `«${borradores.parcela.tipo}»: el edificio ha pisado el borrador de la otra rama.`,
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Volver a la rama PARCELA: la herramienta de dibujo se esconde
// ═════════════════════════════════════════════════════════════════════════════

$(SEL.IR_A_PARCELA)?.click()
await dormir(250)

const alVolver = {
  rama: $(SEL.APP)?.dataset.rama ?? null,
  dibujarVisible: tieneCaja($(SEL.DIBUJAR)),
  huellasEnElMapa: $$(SEL.HUELLA).length,
  verticesPx: altoVertices(),
}

if (alVolver.dibujarVisible) {
  problemas.push(
    '⛔ «Dibujar recinto» sigue visible en la rama PARCELA. Ahí no hay ninguna «parte» que ' +
      'dibujar: es una herramienta de la otra rama enseñándose donde no sirve.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 11 · La ayuda nombra los gestos del dibujo (F12 · T3.5)
// ═════════════════════════════════════════════════════════════════════════════

const ayuda = (() => {
  const boton = $(SEL.AYUDA)
  if (!boton) return { hayBoton: false }
  boton.click()
  const panel = $('[data-panel="ayuda"]')
  const texto = panel?.textContent ?? ''
  const filas = $$('[data-panel="ayuda"] tbody tr').length
  boton.click()
  return {
    hayBoton: true,
    filas,
    nombraElDibujo: /dibujando un recinto/i.test(texto),
  }
})()

if (ayuda.hayBoton && !ayuda.nombraElDibujo) {
  problemas.push(
    'La ayuda de gestos no dice ni una palabra de dibujar un recinto. F12 estrena cuatro gestos ' +
      'sobre el mapa y quien abra la ayuda MIENTRAS dibuja verá ocho que no son el suyo.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 12 · La red
// ═════════════════════════════════════════════════════════════════════════════

const red = {
  total: peticiones.length,
  delPropioServidor: peticiones.filter((u) => /\/test\/fixtures\/|\.js(\?|$)|\.css/.test(u)).length,
  cartograficas: peticiones.filter((u) =>
    /ServidorWMS|Cartografia|ign\.es|wmts|WMTS/i.test(u),
  ).length,
  aServiciosDeDatos: peticiones.filter((u) => /ovc\.catastro|wfs|wfsBU/i.test(u)).length,
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
  guion: '19-partes-plantas',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'SI LAS PLANTAS DEL FICHERO SON LAS QUE EL TÉCNICO ESPERABA: es un hecho del fixture, no un acierto nuestro. Juicio humano → CHECKLIST-HUMANO §16.',
    'SI EL REPARTO DEL PANEL SE ENTIENDE: que quepa se mide aquí; que se lea como una lista con su ficha debajo es juicio humano → §16.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0 del GUION): se disparan dragenter/dragover/drop sobre la ventana.',
    'QUE LA ENVOLVENTE SEA LA CORRECTA: la topología la prueban 30 tests con Turf; aquí solo se mira si CAMBIA.',
  ],
  linea,
  enEdificioVacio,
  cargado,
  pliegue,
  porPantalla,
  activa,
  rotulos,
  envolvente,
  anadida,
  piscina,
  dibujo,
  reparto,
  borradores,
  alVolver,
  ayuda,
  red,
}
