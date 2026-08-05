// scripts/smoke-navegador/16-derivar-cesion.js — F17 · 5.1.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// EL RECORRIDO ENTERO DEL SOBRANTE, andado de una vez sobre la aplicación real:
//
//     mover un lindero hacia dentro → derivar → revisar y nombrar
//                                   → descargar el expediente
//
// Y sobre todo **EL PRECIO EN PÍXELES**, que es lo único de F17 que ninguna de
// las 6.278 pruebas puede ver. F17 rompe A PROPÓSITO la racha de «coste 0 px en
// el panel» que el proyecto llevaba cinco fases defendiendo: la lista del
// sobrante vive en la columna izquierda, en Validación, y le quita altura a la
// tabla de vértices. La revisión de diseño lo midió sobre una maqueta (96,63 px
// vacía + 31,00 por fila); **aquí se mide sobre el producto**.
//
// ⛔ Y el modo de fallo es el peor de todos: **el panel NO DESBORDA cuando esto
// crece — la tabla de vértices ENCOGE EN SILENCIO**. Está medido: desborde 0 en
// los seis casos de la revisión. O sea que pasarse de sitio **no tiene síntoma
// visible**, y este guion es el único guardián posible. En jsdom no hay
// maquetación: `getBoundingClientRect()` devuelve ceros y un panel que no cabe
// sale VERDE en la suite entera.
//
// ── ⚠️ ESTE GUION CAMBIA UN CRITERIO DEL PLAN, Y ESTÁ ESCRITO POR QUÉ ───────
// El plan de F17 le mandaba comprobar que **«el nombre escrito llega al `localId`
// del fichero»**. ⛔ **No puede, y no porque falte trabajo: porque sería un
// defecto** (medición M14 de la ficha). El `localId` de una cesión está MEDIDO
// —override O19, el único envío de este proyecto con IVG positivo— y es la
// referencia catastral del padre con el ordinal detrás: meter ahí texto libre
// cambiaría el único identificador de finca que la Sede ha aceptado.
//
// Así que este guion comprueba **lo contrario, y las dos mitades**:
//   · que el nombre escrito SE QUEDA en la pantalla (es donde le sirve a una
//     persona) y **NO aparece en los bytes del `.gml`**;
//   · que lo que sí llega al fichero es el `localId` de O19 (`…N.1`).
// Un criterio que exigiera lo contrario habría rechazado el único expediente que
// se sabe que vale.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · **Que la Sede acepte el fichero.** Ningún XSD expresa las reglas del IVG.
//     Es el criterio 4 de la fase y la única verificación que la cierra: va al
//     `CHECKLIST-HUMANO.md` §13.
//   · **Que «se propone, no se crea» se entienda sin explicación.** Toda la
//     decisión D7 se apoya en eso, y eso no lo firma un test.
//   · **Si el sobrante es geométricamente CORRECTO.** Eso es de la suite (155
//     pruebas entre `cesion`, `conjunto` y `entrega`): aquí se mide el recorrido
//     y la maquetación.
//   · **El arrastre como gesto de ratón** (§0 del GUION). El lindero se mueve
//     TECLEANDO en la celda de coordenada, que es el otro camino de F03 y entra
//     por el mismo `estado.set`. Es además el camino que M12 midió como el bueno:
//     mover un vértice existente cierra EXACTO, sin cuñas de redondeo.
//   · **Que el fichero aterrice en el disco.** El Blob se intercepta EN LA
//     PÁGINA, igual que en el guion 06.
//
// ── RÉGIMEN DE RED: NINGUNA ─────────────────────────────────────────────────
// ⭐ Este guion **no toca ni un servicio**, y es la afirmación de diseño de F17:
// los dos minuendos —la geometría oficial y la editada— ya están en memoria. La
// parcela de demostración trae `geometriaOficial` (es el estado de una parcela
// recién traída), así que el recorrido entero se anda sin red.
//
// ⚠️ NECESITA `npm run dev` como los demás, y el base `/concretagml/`.

// ── Umbrales, con su motivo ─────────────────────────────────────────────────

/**
 * La referencia histórica de la caja de vértices a 1440×900, sin avisos: los
 * **267,44 px** que el proyecto defiende desde F07. F17 la baja A PROPÓSITO, así
 * que aquí no se exige — se MIDE y se publica. Lo que sí se exige es lo de abajo.
 */
const REFERENCIA_VERTICES_PX = 267.44

/**
 * El suelo que sí se exige a la caja de vértices con el bloque puesto: **la
 * cabecera pegajosa, la fila del recinto y TRES vértices de los quince**.
 *
 * ⛔ No es un número elegido. Se DERIVA de lo que mide la tabla, medido en Chrome
 * a 1280×720 el 2026-08-05 con este mismo guion:
 *
 *     cabecera pegajosa (`thead`) ........................ 24,00 px
 *     fila del recinto («EXTERIOR») ...................... 26,50 px
 *     tres filas de vértice × 24,69 ...................... 74,07 px
 *     TOTAL ............................................. 124,57 px
 *
 * La primera versión decía **120** y me lo inventé. El punto de comparación que sí
 * significa algo es F06: allí el bloque de edición dejó la tabla en **64 px** —
 * cabecera y 1,6 renglones—, y ése fue el defecto que costó mudar la edición al
 * mapa. Por debajo de tres vértices el bloque ha dejado de ser un añadido y es un
 * sustituto.
 */
const SUELO_VERTICES_PX = 124.57

/**
 * Desborde tolerado del panel, **en los DOS ejes**. Cero, y con 1 px de holgura
 * por el redondeo subpíxel del navegador. El horizontal importa tanto como el
 * vertical: `.gml-panel` es `overflow:hidden`, así que una fila demasiado ancha
 * no desborda — se RECORTA en silencio.
 */
const DESBORDE_TOLERADO_PX = 1

/**
 * Lo que medía el pie del panel con DOS botones (2026-08-04). F17 mete el
 * tercero, y la revisión de diseño avisó de que había que comprobar que no lo
 * empuja. Aquí no se exige el número —crecer un botón cuesta lo que cuesta—: se
 * exige que el pie QUEPA, y se publica cuánto ha subido.
 */
const PIE_CON_DOS_BOTONES_PX = 209.47

/** Cuántas filas se ven sin scroll, según `viewer/lista-sobrante.js`. */
const FILAS_VISIBLES = 4

/**
 * El alto por fila que declara `viewer/lista-sobrante.js#ALTO_FILA_PX`. ⛔ **Eran
 * 31 —el número de la MAQUETA de la revisión de diseño— hasta que la primera
 * corrida de este guion midió 26 sobre el componente de verdad**, y el tope
 * enseñaba 4,77 filas en vez de 4: no un defecto, pero 20 px de panel cobrados de
 * más en la pantalla donde F17 está gastando a propósito. Corregido el
 * 2026-08-05, y esto es exactamente para lo que existe este gate.
 */
const ALTO_FILA_MAQUETA_PX = 26

/** Cuánto se le mueve el lindero. 3 m: se ve, y da piezas de decenas de m². */
const MENGUA_M = 3

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (sel) => $(sel)?.textContent?.trim() ?? ''

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

const alto = (sel) => {
  const c = caja($(sel))
  return c === null ? null : c.alto
}

/** Tiene caja. **No es «se ve»**: para eso está {@link seVeDeVerdad}. */
const tieneCaja = (el) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

/**
 * Las tres patas que el guion 15 dejó escritas, y que aquí hacen falta por lo
 * mismo: «tiene caja» no es «se ve». Un botón dentro de un contenedor que
 * scrollea puede tener 30 px de alto y estar 200 px por debajo del borde.
 */
function seVeDeVerdad(nodo) {
  if (!tieneCaja(nodo)) return { seVe: false, motivo: 'no tiene caja' }
  const r = nodo.getBoundingClientRect()
  const dentroDeLaVentana = r.top >= 0 && r.bottom <= window.innerHeight
  const centro = { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  const enElPunto =
    centro.y >= 0 && centro.y < window.innerHeight
      ? document.elementFromPoint(centro.x, centro.y)
      : null
  const nadieLoTapa = enElPunto !== null && (enElPunto === nodo || nodo.contains(enElPunto))
  return {
    seVe: dentroDeLaVentana && nadieLoTapa,
    dentroDeLaVentana,
    nadieLoTapa,
    loQueHayEnSuCentro: enElPunto
      ? `${enElPunto.tagName}[${enElPunto.dataset.accion || enElPunto.className}]`
      : 'FUERA DE LA VENTANA',
    caja: caja(nodo),
  }
}

/** Teclea en un campo y dispara `change`, que es lo que la app escucha. */
function teclear(input, valor) {
  if (!input) return false
  input.value = String(valor)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

const esperarA = async (pred, ms, cada = 80) => {
  const t0 = performance.now()
  while (performance.now() - t0 < ms) {
    if (pred()) return redondear(performance.now() - t0, 0)
    await dormir(cada)
  }
  return null
}

const SEL = {
  APP: '[data-paso]',
  PANEL: '.gml-panel',
  PIE: '.gml-panel-pie',
  ACCIONES: '.gml-acciones',
  VERTICES: '#tabla-vertices',
  ANFITRION: '[data-anfitrion="sobrante"]',
  BLOQUE: '[data-sobrante="bloque"]',
  LISTA: '[data-sobrante="lista"]',
  FILA: '[data-sobrante="fila"]',
  INCLUIR: '[data-sobrante="incluir"]',
  NOMBRE: '[data-sobrante="nombre"]',
  CONTADOR: '[data-sobrante="contador"]',
  NOTA: '[data-sobrante="nota"]',
  DERIVAR: '[data-accion="derivar-sobrante"]',
  ESTADO_DERIVAR: '[data-estado="derivar-sobrante"]',
  ENTREGAR: '[data-accion="entregar-expediente"]',
  ESTADO_ENTREGA: '[data-estado="entregar-expediente"]',
  NUMERO_MAPA: '.gml-pieza-numero',
  MANCHA: '.gml-pieza',
}

const app = () => $(SEL.APP) ?? document.body
const paso = () => app().dataset.paso ?? null
const filas = () => $$(SEL.FILA)
const bloqueVisible = () => tieneCaja($(SEL.BLOQUE))

/** El desborde del panel en los DOS ejes. */
function desbordeDelPanel() {
  const panel = $(SEL.PANEL)
  if (!panel) return null
  return {
    vertical: redondear(Math.max(0, panel.scrollHeight - panel.clientHeight)),
    horizontal: redondear(Math.max(0, panel.scrollWidth - panel.clientWidth)),
  }
}

/** ¿Cabe el pie DENTRO del panel? Tres patas, como la puerta del guion 15. */
function pieCabe() {
  const pie = $(SEL.PIE)
  const panel = $(SEL.PANEL)
  if (!pie || !panel) return null
  const rp = pie.getBoundingClientRect()
  const rc = panel.getBoundingClientRect()
  return {
    alto: redondear(rp.height),
    dentroDelPanel: rp.bottom <= rc.bottom + DESBORDE_TOLERADO_PX,
    pxPorDebajo: redondear(Math.max(0, rp.bottom - rc.bottom)),
    ultimoBoton: seVeDeVerdad($(SEL.DERIVAR)),
  }
}

/** Los vértices del recinto 0, leídos de la tabla. */
function verticesDeLaTabla() {
  return $$('tbody[data-recinto="0"] tr[data-indice]').map((tr) => ({
    indice: Number(tr.dataset.indice),
    x: Number($('input[data-eje="x"]', tr)?.value),
    y: Number($('input[data-eje="y"]', tr)?.value),
  }))
}

/** El centro aritmético de los vértices. No es el centroide del ÁREA y da igual:
 *  aquí solo hace falta un punto INTERIOR hacia el que tirar. */
function centroDeLaTabla() {
  const v = verticesDeLaTabla()
  return {
    x: v.reduce((s, p) => s + p.x, 0) / v.length,
    y: v.reduce((s, p) => s + p.y, 0) / v.length,
  }
}

/**
 * Mueve el vértice `indice` `metros` a lo largo de la recta que lo une con el
 * centro: negativo = HACIA DENTRO, positivo = hacia fuera.
 *
 * ⛔ **No vale mover solo la X**, que es lo que hacía la primera versión de este
 * guion y por lo que salió `ok:false` en la primera corrida: «hacia dentro» no es
 * una dirección del eje, depende de en qué lado del polígono esté el vértice — y
 * la parcela de demostración es CÓNCAVA (cuatro vértices reflejos medidos). Se
 * eligen además los vértices MÁS LEJANOS al centro, que son convexos por
 * construcción: para un vértice reflejo, tirar hacia el centro empuja el lindero
 * hacia FUERA.
 *
 * Se reescriben las DOS celdas y se relee la tabla entre medias: cada `change`
 * hace `estado.set` y `viewer/sincronizacion.js` REHACE las filas, así que una
 * referencia guardada de antes apunta a un `<input>` que ya no está en el DOM.
 */
async function moverVertice(indice, metros) {
  const centro = centroDeLaTabla()
  const v = verticesDeLaTabla().find((p) => p.indice === indice)
  if (!v) return null
  const dx = v.x - centro.x
  const dy = v.y - centro.y
  const d = Math.hypot(dx, dy)
  if (d === 0) return null
  const destino = { x: v.x + (dx / d) * metros, y: v.y + (dy / d) * metros }

  const fila = () => $(`tbody[data-recinto="0"] tr[data-indice="${indice}"]`)
  teclear($('input[data-eje="x"]', fila()), redondear(destino.x, 2))
  await dormir(100)
  teclear($('input[data-eje="y"]', fila()), redondear(destino.y, 2))
  await dormir(100)
  return destino
}

/** Los vértices ordenados de más lejano a más cercano al centro. */
function porLejania() {
  const centro = centroDeLaTabla()
  return verticesDeLaTabla()
    .map((v) => ({ ...v, d: Math.hypot(v.x - centro.x, v.y - centro.y) }))
    .sort((a, b) => b.d - a.d)
}

// ── 0 · Arranque ────────────────────────────────────────────────────────────

const problemas = []
const advertencias = []
const t0 = performance.now()

const tarjetasAlArrancar = $$('#avisos .gml-aviso').length
if (tarjetasAlArrancar > 0) {
  advertencias.push(
    `La aplicación arranca con ${tarjetasAlArrancar} tarjeta(s) de aviso ya puestas: le comen ` +
      'altura al panel y las cifras de esta corrida NO son comparables con las de referencia. ' +
      'Borra IndexedDB y recarga (§22 del GUION).',
  )
}

// El recorrido de F17 vive en VALIDACIÓN. Se llega por la ruta, no pulsando el
// rail: lo que se mide aquí es el sobrante, no la navegación (eso es del 14).
location.hash = '#/parcela/validacion'
await esperarA(() => paso() === 'validacion', 3000)
if (paso() !== 'validacion') {
  return {
    guion: '16-derivar-cesion',
    ok: false,
    problemas: [`No se llega a Validación por la ruta: el paso activo es «${paso()}».`],
  }
}
await dormir(120)

// ⭐ LA LÍNEA BASE: el panel de Validación SIN bloque de sobrante. Es contra
// esto contra lo que se mide el precio, y por eso se toma AQUÍ y no al final:
// una medición hecha después del cambio no distingue lo que costó de lo que ya
// estaba.
const linea = {
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
  tarjetasDeAviso: tarjetasAlArrancar,
  cajaVerticesPx: alto(SEL.VERTICES),
  pie: pieCabe(),
  desborde: desbordeDelPanel(),
  bloqueVisible: bloqueVisible(),
  ctaHabilitado: $(SEL.DERIVAR) !== null && !$(SEL.DERIVAR).disabled,
  renglonCta: texto(SEL.ESTADO_DERIVAR),
}

if ($(SEL.DERIVAR) === null) {
  return {
    guion: '16-derivar-cesion',
    ok: false,
    problemas: [
      'No existe «Derivar sobrante» en el pie del panel. Sin él, F17 no tiene entrada en la ' +
        'aplicación y no hay nada que medir.',
    ],
  }
}
// ⚠️ **PÁGINA RECIÉN CARGADA, Y NO ES FORMALISMO.** Este guion deja la parcela
// editada, un sobrante derivado y un expediente autoguardado; lanzarlo dos veces
// seguidas sin recargar mide otra cosa. Se distingue el descuido del defecto por
// las FILAS: un bloque visible CON filas es una corrida anterior, y uno visible
// SIN ellas sí es la decisión D2 rota. Confundirlos sería acusar al producto de
// lo que hizo el guion, que es lo que le pasó a la corrida 2 del 2026-08-05.
if (linea.bloqueVisible && filas().length > 0) {
  return {
    guion: '16-derivar-cesion',
    ok: false,
    problemas: [
      `La aplicación arranca con el bloque del sobrante PUESTO y ${filas().length} pieza(s) ` +
        'dentro: es el estado que dejó una corrida anterior de este mismo guion, no un defecto. ' +
        'Recarga la página (y borra IndexedDB si hay tarjeta de autoguardado) y vuelve a ' +
        'lanzarlo — ver §25 del GUION.',
    ],
    linea,
  }
}
if (linea.bloqueVisible) {
  problemas.push(
    'El bloque del sobrante se ve ANTES de derivar nada. La decisión de diseño D2 dice que ' +
      'aparece SOLO cuando hay sobrante: vacío cuesta 96,63 px medidos en el 100 % de las ' +
      'sesiones, y esos píxeles salen del margen que hace que la tabla de vértices siga entera.',
  )
}
// La parcela de demostración TRAE `geometriaOficial` (es el estado de una recién
// traída), así que el CTA nace encendido y mudo.
if (!linea.ctaHabilitado) {
  problemas.push(
    `«Derivar sobrante» nace apagado con motivo ${JSON.stringify(linea.renglonCta)}, y la ` +
      'parcela de demostración SÍ trae contorno oficial: o el cableado no está montado o el ' +
      'predicado se rompió.',
  )
}

// ── 1 · Encoger de verdad: VARIOS lados hacia dentro ⇒ VARIAS piezas ────────

if (verticesDeLaTabla().length < 4) {
  return {
    guion: '16-derivar-cesion',
    ok: false,
    problemas: ['La tabla de vértices no trae vértices suficientes: no hay lindero que mover.'],
  }
}

// VARIOS vértices hacia dentro, repartidos por el anillo ⇒ varias piezas.
// Con una sola no se podrían medir ni la concordancia del contador ni el tope de
// filas. ⚠️ La separación se pide en ÍNDICES del anillo y no en distancia: dos
// muescas en vértices consecutivos se funden en una pieza sola (medido en la
// primera corrida de este guion, que sacó 1 pieza de 58,09 m² moviendo dos).
const total = verticesDeLaTabla().length
const separacion = Math.max(2, Math.floor(total / 4))
const candidatos = porLejania()
const elegidos = []
for (const v of candidatos) {
  if (elegidos.length >= 3) break
  if (elegidos.every((e) => Math.abs(e.indice - v.indice) >= separacion)) elegidos.push(v)
}
for (const v of elegidos) await moverVertice(v.indice, -MENGUA_M)
await dormir(200)

const cajaVerticesAntesDeDerivar = alto(SEL.VERTICES)
$(SEL.DERIVAR).click()
const msDerivar = await esperarA(() => bloqueVisible(), 6000)
await dormir(200)

if (msDerivar === null) {
  return {
    guion: '16-derivar-cesion',
    ok: false,
    problemas: [
      ...problemas,
      'Tras encoger el lindero y pulsar «Derivar sobrante», el bloque no aparece. Renglón: ' +
        `${JSON.stringify(texto(SEL.ESTADO_DERIVAR))}.`,
    ],
    linea,
  }
}

const nPiezas = filas().length
const derivado = {
  ms: msDerivar,
  piezas: nPiezas,
  contador: texto(SEL.CONTADOR),
  nota: texto(SEL.NOTA),
  renglonCta: texto(SEL.ESTADO_DERIVAR),
  numerosEnElMapa: $$(SEL.NUMERO_MAPA).map((n) => n.textContent.trim()),
  manchasEnElMapa: $$(SEL.MANCHA).length,
  numerosEnLaFila: filas().map((f) => f.dataset.orden),
  botonEntrega: {
    existe: $(SEL.ENTREGAR) !== null,
    apagado: $(SEL.ENTREGAR)?.disabled ?? null,
    alcance: seVeDeVerdad($(SEL.ENTREGAR)),
  },
}

if (nPiezas === 0) {
  problemas.push('El bloque aparece sin ninguna pieza: encoger el lindero no ha producido sobrante.')
}
// ⭐ LA CORRESPONDENCIA FILA↔MANCHA, que es media razón de ser de la pantalla.
if (derivado.manchasEnElMapa !== nPiezas) {
  problemas.push(
    `Hay ${nPiezas} fila(s) en la lista y ${derivado.manchasEnElMapa} mancha(s) en el mapa. ` +
      'Revisar sin poder decir qué mancha estás nombrando es teatro.',
  )
}
if (derivado.numerosEnElMapa.join(',') !== derivado.numerosEnLaFila.join(',')) {
  problemas.push(
    `Los números del mapa (${derivado.numerosEnElMapa.join(', ')}) no son los de las filas ` +
      `(${derivado.numerosEnLaFila.join(', ')}).`,
  )
}
if (!new RegExp(`de ${nPiezas} pieza`).test(derivado.contador)) {
  problemas.push(`El contador no cuenta las ${nPiezas} piezas: «${derivado.contador}».`)
}
if (derivado.botonEntrega.apagado !== false) {
  problemas.push('«Descargar expediente» nace apagado con todas las piezas marcadas.')
}
if (!derivado.botonEntrega.alcance.seVe) {
  problemas.push(
    '⛔ «Descargar expediente» NO SE VE, y es la única acción que el bloque ofrece. ' +
      `${JSON.stringify(derivado.botonEntrega.alcance)}. Es el mismo defecto que el guion 15 ` +
      'encontró con la puerta de D4: «tiene caja» no es «se ve».',
  )
}

// ── 2 · ⭐ EL PRECIO EN PÍXELES, que es lo único que solo se puede medir aquí ─

const cajaVerticesConBloque = alto(SEL.VERTICES)
const filaEl = filas()[0] ?? null
const listaEl = $(SEL.LISTA)
const precio = {
  cajaVerticesLineaBase: linea.cajaVerticesPx,
  cajaVerticesAntesDeDerivar: cajaVerticesAntesDeDerivar,
  cajaVerticesConBloque,
  // El coste ATRIBUIBLE al bloque: contra la medida de justo antes de derivar,
  // no contra la línea base. Entre las dos hay dos ediciones de coordenada, y
  // atribuirle al bloque lo que costaron sería la trampa que ya pagó el guion 09.
  costeDelBloquePx: redondear((cajaVerticesAntesDeDerivar ?? 0) - (cajaVerticesConBloque ?? 0)),
  contraReferenciaHistoricaPx: redondear((cajaVerticesConBloque ?? 0) - REFERENCIA_VERTICES_PX),
  bloque: caja($(SEL.BLOQUE)),
  seccionAnfitriona: caja($(SEL.ANFITRION)),
  altoDeUnaFilaPx: filaEl === null ? null : redondear(filaEl.getBoundingClientRect().height),
  // ⚠️ El TOPE se lee del estilo calculado y NO del alto pintado: con dos filas
  // puestas, `getBoundingClientRect()` devuelve lo que ocupan las dos, no el
  // techo. La primera corrida de este guion midió 26 px de «tope» y calculó que
  // cabía UNA fila.
  topeDeLaListaPx:
    listaEl === null ? null : redondear(parseFloat(getComputedStyle(listaEl).maxHeight)),
  altoPintadoDeLaListaPx: listaEl === null ? null : redondear(listaEl.getBoundingClientRect().height),
  listaScrollea: listaEl === null ? null : listaEl.scrollHeight > listaEl.clientHeight + 1,
  desborde: desbordeDelPanel(),
  pie: pieCabe(),
  // Dos restas, y hacen falta las dos. Contra el número histórico está el coste
  // del TERCER BOTÓN; contra la línea base de ESTA corrida está lo que el pie ha
  // crecido después, que es de los renglones de estado que se ponen a hablar —
  // atribuírselo al botón sería la trampa que ya pagó el guion 09.
  pieContraDosBotonesPx: redondear((linea.pie?.alto ?? 0) - PIE_CON_DOS_BOTONES_PX),
  pieContraLaLineaBasePx: redondear((pieCabe()?.alto ?? 0) - (linea.pie?.alto ?? 0)),
}

// ⛔ EL INVARIANTE QUE SÍ SE EXIGE. No es «no cuestes nada» —F17 cuesta y está
// declarado—, es «no sustituyas a la tabla».
if (precio.cajaVerticesConBloque !== null && precio.cajaVerticesConBloque < SUELO_VERTICES_PX) {
  problemas.push(
    `⛔ Con ${nPiezas} pieza(s) la caja de vértices baja a ${precio.cajaVerticesConBloque} px ` +
      `(suelo ${SUELO_VERTICES_PX}, referencia histórica ${REFERENCIA_VERTICES_PX}). El bloque ` +
      'ha dejado de ser un añadido y es un sustituto — y el panel NO desborda, así que nadie se ' +
      'entera: la tabla encoge en silencio.',
  )
}
if (precio.desborde && precio.desborde.vertical > DESBORDE_TOLERADO_PX) {
  problemas.push(`El panel DESBORDA ${precio.desborde.vertical} px por abajo con el bloque puesto.`)
}
if (precio.desborde && precio.desborde.horizontal > DESBORDE_TOLERADO_PX) {
  problemas.push(
    `El panel desborda ${precio.desborde.horizontal} px de ANCHO. `.concat(
      '`.gml-panel` es `overflow:hidden`: una fila demasiado ancha no desborda, se RECORTA en ' +
        'silencio.',
    ),
  )
}
if (precio.pie && !precio.pie.dentroDelPanel) {
  problemas.push(
    `El pie del panel se sale ${precio.pie.pxPorDebajo} px con el TERCER botón puesto ` +
      `(medía ${PIE_CON_DOS_BOTONES_PX} px con dos).`,
  )
}
if (precio.pie && !precio.pie.ultimoBoton.seVe) {
  problemas.push(
    `⛔ «Derivar sobrante» —el tercer botón del pie— NO SE VE: ` +
      `${JSON.stringify(precio.pie.ultimoBoton)}.`,
  )
}
// El tope de las 4 filas: se comprueba la ARITMÉTICA sobre la fila real, no el
// número de la maqueta. Si una fila mide más de lo previsto, el tope enseña menos
// de cuatro y el contador es lo único que lo dice.
if (precio.altoDeUnaFilaPx !== null) {
  const filasQueCaben = precio.topeDeLaListaPx / precio.altoDeUnaFilaPx
  precio.filasQueCabenDeVerdad = redondear(filasQueCaben)
  if (Math.abs(precio.altoDeUnaFilaPx - ALTO_FILA_MAQUETA_PX) > 2) {
    advertencias.push(
      `Una fila mide ${precio.altoDeUnaFilaPx} px y la maqueta de la revisión de diseño midió ` +
        `${ALTO_FILA_MAQUETA_PX}. El tope de la lista está calculado con el número de la ` +
        `maqueta (${FILAS_VISIBLES} × ${ALTO_FILA_MAQUETA_PX} = ${precio.topeDeLaListaPx} px), ` +
        `así que se ven ${redondear(filasQueCaben)} filas y no ${FILAS_VISIBLES}. No es un ` +
        'defecto —el contador dice cuántas hay y ninguna desaparece—, pero el número hay que ' +
        'rehacerlo con éste.',
    )
  }
}

// ── 2 bis · El resaltado RECÍPROCO ──────────────────────────────────────────────

const primeraFila = filas()[0] ?? null
primeraFila?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
await dormir(80)
const trasSenalarLaFila = {
  filaResaltada: primeraFila?.dataset.resaltada ?? null,
  numeroResaltado: $$(SEL.NUMERO_MAPA)[0]?.dataset.resaltada ?? null,
}
primeraFila?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }))
await dormir(80)

const primeraMancha = $$(SEL.MANCHA)[0] ?? null
primeraMancha?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
await dormir(80)
const trasSenalarLaMancha = {
  filaResaltada: filas()[0]?.dataset.resaltada ?? null,
  numeroResaltado: $$(SEL.NUMERO_MAPA)[0]?.dataset.resaltada ?? null,
}
primeraMancha?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
await dormir(80)

if (trasSenalarLaFila.numeroResaltado !== 'si') {
  problemas.push('Señalar la FILA no resalta su mancha en el mapa.')
}
if (trasSenalarLaMancha.filaResaltada !== 'si') {
  problemas.push('Señalar la MANCHA no resalta su fila en la lista.')
}

// ── 2 ter · Nombrar y DESCARGAR, con los bytes interceptados ────────────────────

const NOMBRE_ESCRITO = 'Cesion al camino de servicio'
const campoNombre = $$(SEL.NOMBRE)[0] ?? null
teclear(campoNombre, NOMBRE_ESCRITO)
await dormir(100)

const crearUrlOriginal = URL.createObjectURL
const revocarUrlOriginal = URL.revokeObjectURL
const crearElementoOriginal = document.createElement
const blobs = []
const hrefsCreados = []
const hrefsRevocados = []
const anclas = []

URL.createObjectURL = function (objeto) {
  const href = crearUrlOriginal.call(URL, objeto)
  blobs.push(objeto)
  hrefsCreados.push(href)
  return href
}
URL.revokeObjectURL = function (href) {
  hrefsRevocados.push(href)
  return revocarUrlOriginal.call(URL, href)
}
document.createElement = function (etiqueta, ...resto) {
  const el = crearElementoOriginal.call(document, etiqueta, ...resto)
  if (String(etiqueta).toLowerCase() === 'a') anclas.push(el)
  return el
}

let excepcionAlDescargar = null
try {
  $(SEL.ENTREGAR).click()
} catch (error) {
  excepcionAlDescargar = `${error.name}: ${error.message}`
} finally {
  URL.createObjectURL = crearUrlOriginal
  URL.revokeObjectURL = revocarUrlOriginal
  document.createElement = crearElementoOriginal
}
await dormir(200)

const ancla = anclas.find((a) => typeof a.download === 'string' && a.download.length > 0) ?? null
const xml = blobs.length > 0 ? new TextDecoder('utf-8', { fatal: true }).decode(await blobs[0].arrayBuffer()) : null

const entrega = {
  excepcionAlDescargar,
  blobsCapturados: blobs.length,
  urlsRevocadas: hrefsRevocados.length,
  revocaLaQueCreo:
    hrefsCreados.length === hrefsRevocados.length &&
    hrefsCreados.every((h, i) => h === hrefsRevocados[i]),
  nombreDelFichero: ancla?.download ?? null,
  bytes: xml === null ? null : new Blob([xml]).size,
  miembros: xml === null ? null : (xml.match(/<gml:featureMember>/g) || []).length,
  localIds: xml === null ? [] : (xml.match(/<base:localId>([^<]*)<\/base:localId>/g) || []).map((m) => m.replace(/<[^>]+>/g, '')),
  namespaces: xml === null ? [] : [...new Set((xml.match(/<base:namespace>([^<]*)<\/base:namespace>/g) || []).map((m) => m.replace(/<[^>]+>/g, '')))],
  // ⭐ LA MITAD QUE CAMBIA EL CRITERIO DEL PLAN (M14): el nombre NO viaja al `.gml`.
  nombreEnElFichero: xml === null ? null : xml.includes(NOMBRE_ESCRITO),
  nombreEnLaPantalla: ($$(SEL.NOMBRE)[0]?.value ?? '') === NOMBRE_ESCRITO,
  acuse: texto(SEL.ESTADO_ENTREGA),
  acuseSeVe: seVeDeVerdad($(SEL.ESTADO_ENTREGA)),
  bloqueSigueVisible: bloqueVisible(),
}

if (excepcionAlDescargar !== null) {
  problemas.push(`Pulsar «Descargar expediente» ha LANZADO: ${excepcionAlDescargar}.`)
}
if (entrega.blobsCapturados === 0) {
  problemas.push('No ha bajado ningún fichero: no se ha creado ni un Blob.')
} else {
  if (!entrega.revocaLaQueCreo) {
    problemas.push('La URL del objeto no se revoca, o se revoca otra: fuga de memoria por descarga.')
  }
  if (entrega.miembros !== 1 + nPiezas) {
    problemas.push(
      `El fichero lleva ${entrega.miembros} <gml:featureMember> y tendría que llevar ` +
        `${1 + nPiezas} (la matriz más ${nPiezas} cesión/es).`,
    )
  }
  if (!/^expediente[_-]/.test(entrega.nombreDelFichero ?? '')) {
    problemas.push(
      `El fichero baja como «${entrega.nombreDelFichero}». Con más de una parcela dentro el ` +
        'prefijo tiene que ser «expediente»: llamar «parcela» a un fichero con tres es ' +
        'exactamente lo que ese primitivo existe para impedir.',
    )
  }
  // ⛔ EL CRITERIO CAMBIADO, y sus dos mitades.
  if (entrega.nombreEnElFichero === true) {
    problemas.push(
      '⛔ EL NOMBRE ESCRITO HA VIAJADO AL `.gml`. El `localId` de una cesión está MEDIDO ' +
        '(override O19, el único envío con IVG positivo): texto libre ahí cambia el único ' +
        'identificador de finca que la Sede ha aceptado.',
    )
  }
  if (!entrega.nombreEnLaPantalla) {
    problemas.push('El nombre escrito se ha perdido de la pantalla, que es donde le sirve a alguien.')
  }
  if (!entrega.namespaces.includes('ES.LOCAL.CP')) {
    problemas.push(
      `Ninguna cesión va bajo «ES.LOCAL.CP» (namespaces: ${entrega.namespaces.join(', ')}). ` +
        'Es la mitad de la afirmación de O19: la pareja localId↔namespace es UNA sola cosa.',
    )
  }
  if (!entrega.localIds.some((id) => /\.\d+$/.test(id))) {
    problemas.push(
      `Ningún localId lleva el ordinal de O19 (${entrega.localIds.join(', ')}): la cesión ` +
        'tiene que ser la referencia del padre sufijada.',
    )
  }
}
// ⚠️ Regresión conocida de F08 M18: el `click()` del `<a download>` burbujeaba y
// cerraba el cajón, y con él el acuse. Aquí el bloque no se cierra por un clic,
// pero el acuse tiene que seguir a la vista.
if (entrega.acuse === '') {
  problemas.push('La descarga no ha dejado acuse: no hay forma de saber que ha pasado algo.')
} else if (!entrega.acuseSeVe.seVe) {
  problemas.push(`El acuse de la descarga NO se ve: ${JSON.stringify(entrega.acuseSeVe)}.`)
}
if (!entrega.bloqueSigueVisible) {
  problemas.push('El bloque del sobrante ha desaparecido al descargar (regresión de F08 M18).')
}

// ── 2 quater · Excluirlas TODAS: apagado con motivo, nunca mudo ────────────────────

for (const casilla of $$(SEL.INCLUIR)) {
  casilla.checked = false
  casilla.dispatchEvent(new Event('change', { bubbles: true }))
}
await dormir(120)

const sinNinguna = {
  botonApagado: $(SEL.ENTREGAR)?.disabled ?? null,
  motivo: texto(SEL.ESTADO_ENTREGA),
  contador: texto(SEL.CONTADOR),
  filasSiguenPuestas: filas().length,
}
if (sinNinguna.botonApagado !== true) {
  problemas.push('Con las N piezas excluidas, «Descargar expediente» sigue encendido.')
}
if (sinNinguna.motivo === '') {
  problemas.push('⛔ El botón se ha apagado SIN motivo: gris y mudo no se distingue de roto.')
} else if (!/Generar GML/.test(sinNinguna.motivo)) {
  advertencias.push(
    'El motivo no remite a «Generar GML», que es lo que hay que usar cuando lo que se entrega ' +
      `es solo la parcela: «${sinNinguna.motivo}».`,
  )
}
if (sinNinguna.filasSiguenPuestas !== nPiezas) {
  problemas.push('Excluir una pieza la ha borrado de la lista: excluir no es descartar.')
}

// ── 3 · ⛔ La FOTO caduca (3C): editar invalida, y se DICE ──────────────────

await moverVertice(porLejania()[0].indice, -0.5)
await dormir(200)

const trasEditar = {
  filas: filas().length,
  manchas: $$(SEL.MANCHA).length,
  nota: texto(SEL.NOTA),
  bloqueVisible: bloqueVisible(),
}
if (trasEditar.filas !== 0 || trasEditar.manchas !== 0) {
  problemas.push(
    `Editar la parcela no ha invalidado el sobrante (${trasEditar.filas} fila(s), ` +
      `${trasEditar.manchas} mancha(s)). El `.concat(
        '`orden` de una pieza vale solo dentro de SU derivación: un nombre pegado a la pieza ' +
          'equivocada es una finca mal nombrada en un papel que se firma.',
      ),
  )
}
if (!/perdido|cambiado|otra parcela/i.test(trasEditar.nota)) {
  problemas.push(
    `La lista se ha vaciado SIN decir por qué: «${trasEditar.nota}». Esconder la lista y la ` +
      'explicación a la vez es la definición de fallo silencioso.',
  )
}
if (!trasEditar.bloqueVisible) {
  problemas.push(
    'El bloque ha desaparecido junto con la lista, así que el mensaje de invalidación no se lee.',
  )
}

// ── 4 · ⛔ LA PUERTA: se CRECE, y tiene que decir que no ────────────────────
//
// Es el modo de fallo que el plan llamó por su nombre: con la parcela creciendo,
// el sobrante sale VACÍO mientras hay vecinos afectados, y la aplicación
// exportaría un expediente incompleto con total confianza. Un botón gris y mudo
// aquí sería peor que no tener botón.
//
// ⚠️ **VA EL ÚLTIMO, y en la primera versión iba el PRIMERO.** El motivo es una
// medición: la puerta manda su porqué al panel de AVISOS, y una tarjeta de aviso
// cuesta ~79 px del panel. Con la puerta delante, el precio del bloque se medía
// sobre un panel que ya llevaba esos 79 px encima y el guion acusaba a F17 de
// ellos — exactamente la trampa que el guion 09 documenta («midió demasiado
// tarde»). Aquí el precio se mide con CERO avisos, que es el estado de una sesión
// normal, y la puerta se ejerce después.

// Hacia FUERA: la parcela crece por ese lado y la puerta tiene que decir que no.
await moverVertice(porLejania()[0].indice, +MENGUA_M * 2)

$(SEL.DERIVAR).click()
await dormir(250)

const alCrecer = {
  bloqueVisible: bloqueVisible(),
  renglon: texto(SEL.ESTADO_DERIVAR),
  renglonEsError: $(SEL.ESTADO_DERIVAR)?.classList.contains('gml-accion-estado--error') ?? false,
  filas: filas().length,
}

if (alCrecer.bloqueVisible || alCrecer.filas > 0) {
  problemas.push(
    '⛔ Con la parcela CRECIENDO se ha derivado sobrante igual. El sobrante de una parcela que ' +
      'se sale del contorno oficial no es una cesión: es terreno de alguien, y repartirlo es un ' +
      'acto jurídico que esta versión no cubre.',
  )
}
if (alCrecer.renglon === '') {
  problemas.push(
    '⛔ La puerta ha dicho que no y el renglón está VACÍO: un botón que no hace nada y no dice ' +
      'por qué es indistinguible de uno roto (regla de oro 1).',
  )
} else if (!/SE SALE|se sale/.test(alCrecer.renglon) || !/m²/.test(alCrecer.renglon)) {
  problemas.push(
    `La puerta explica sin CIFRAS: «${alCrecer.renglon}». El plan exige que explique con ellas, ` +
      'porque «no se puede» sin número no se puede corregir.',
  )
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '16-derivar-cesion',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'QUE LA SEDE ACEPTE EL FICHERO. Ningún XSD expresa las reglas del IVG: es el criterio 4 y va al CHECKLIST-HUMANO §13.',
    'QUE «SE PROPONE, NO SE CREA» SE ENTIENDA SIN EXPLICACIÓN. Toda la decisión D7 se apoya en eso y no lo firma un test.',
    'SI EL SOBRANTE ES GEOMÉTRICAMENTE CORRECTO. Eso es de la suite; aquí se mide el recorrido y la maquetación.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): el lindero se mueve TECLEANDO en la celda de coordenada.',
    'QUE EL FICHERO ATERRICE EN EL DISCO: el Blob se intercepta en la página, como en el guion 06.',
  ],
  linea,
  alCrecer,
  derivado,
  precio,
  resaltado: { trasSenalarLaFila, trasSenalarLaMancha },
  entrega,
  sinNinguna,
  trasEditar,
}
