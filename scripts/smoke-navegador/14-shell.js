// scripts/smoke-navegador/14-shell.js — Rework de UI · T4.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LA MAQUETACIÓN. Los 5.802 tests de este repositorio corren en `node` y en
// jsdom, y **jsdom no calcula maquetación**: `getBoundingClientRect()` devuelve
// ceros, `getComputedStyle` no resuelve `flex`, y un panel que se sale de la
// pantalla por abajo sale VERDE. Los cuatro criterios del plan de pruebas del
// rework que no son verificables ahí son exactamente éstos:
//
//   1. **El contenedor del mapa tiene altura > 0.** Si queda a 0,
//      `viewer/wms-catastro.js` corta el encuadre **sin petición, sin aviso y sin
//      error**: la pantalla se queda en blanco y nada lo dice.
//   2. **El panel no desborda por abajo.** `.gml-panel` es `overflow: hidden`, o
//      sea que lo que no cabe **se recorta en silencio**. Es el defecto que
//      destapó el guion 13 en la rama Edificio y el que abrió este rework.
//   3. **Los avisos no se cortan a media frase.** Con varios hallazgos a la vez,
//      que es el caso real de un diagnóstico.
//   4. **Cuánto cuesta el rail, en píxeles, medido y anotado** (T10).
//
// ── ⚠️ ESTE GUION NACE ANTES QUE LA CÁSCARA QUE MIDE, A PROPÓSITO ──────────
// El rail de tres columnas llega en T5. Este guion se escribe ANTES para que la
// rebanada 2 tenga contra qué compararse: **una medición hecha después del
// cambio no distingue lo que mejoró de lo que ya estaba bien**. Se detecta solo
// en cuál de los dos mundos está y lo declara en `modo`:
//
//   · `LINEA_BASE` — no hay rail. Publica el reparto de hoy: dos columnas, panel
//     de ancho fijo, siete controles flotando sobre el mapa.
//   · `SHELL` — hay rail. Publica el reparto nuevo **y el coste del rail**, que
//     es la cifra que T10 va anotando rebanada a rebanada.
//
// Los umbrales son los mismos en los dos mundos: el suelo no cambia porque
// cambie la cáscara. Si la línea base ya los incumple, **este guion nace en rojo
// y eso es lo correcto**: está midiendo el defecto que el rework existe para
// arreglar. La primera vez que dé `ok:true` con `modo:'SHELL'` es el día que la
// rebanada esté bien de verdad.
//
// ── ⚠️ SE LANZA DOS VECES, Y LA PRIMERA ES LA QUE MANDA (decisión D5) ──────
// **Viewport mínimo declarado: 1280×720.** Todas las mediciones históricas de
// este repositorio están hechas a 1440×900 —267,44 px de la caja de vértices,
// 12 px de holgura del pie, 947 px del panel de Edificio— y 1440×900 es una
// pantalla cómoda: un colegiado con un portátil de 14" no la tiene. **Un defecto
// a 1280×720 es un defecto.** Este guion mide en el viewport en el que se lance
// y lo DECLARA; hay que lanzarlo en los dos y comparar.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Con `npm run dev` levantado y la página recién cargada:
//
//   $B viewport 1280x720                              # el SUELO declarado
//   $B goto http://localhost:PUERTO/concretagml/      # ⚠️ el base, no la raíz
//   $B wait ".gml-tabla-vertices"
//   $B console --clear
//   $B eval scripts/smoke-navegador/14-shell.js
//   $B viewport 1440x900                              # y la segunda pasada
//   $B reload
//   $B wait ".gml-tabla-vertices"
//   $B eval scripts/smoke-navegador/14-shell.js
//   $B console --errors                               # → (no console errors)
//
// ⚠️ **Página recién cargada, y no es formalismo.** Este guion PROVOCA avisos
// para medir el bloque de avisos, y una tarjeta cuesta ~52 px del sitio más caro
// del panel. Si arranca con avisos ya puestos, lo dice y ATRIBUYE la pérdida en
// vez de acusar a la cáscara — la lección que ya pagaron el guion 09 (midió
// demasiado tarde) y el 11 (midió demasiado pronto).
//
// ⚠️ **Estado final.** Deja la aplicación con las tarjetas de aviso que él mismo
// ha provocado y **nada más**: no carga ficheros, no toca el Catastro, no conmuta
// de rama y no edita. Para volver al punto de partida: `$B reload`.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//   · **NO es un gesto de ratón** (§0 del GUION): los sucesos van despachados a
//     mano. Que el rail se pueda pulsar con el dedo y que sus objetivos sean
//     cómodos es del checklist humano.
//   · **NO juzga si la pantalla es BONITA.** Publica anchos, altos y desbordes.
//     Que el reparto se lea como un producto y no como un formulario de 2010 es
//     precisamente lo que no tiene número, y es de los ojos del autor.
//   · **NO sustituye al colegiado.** El criterio que abrió este rework es «solo
//     mi incomodidad»: nadie que no escribiera el código ha abierto nunca esta
//     aplicación. Ningún guion arregla eso.
//   · **NO mide con el mapa cargado del todo.** Las teselas del WMS tardan, y
//     este guion mide CAJAS, no píxeles pintados. Que la cartografía se vea es
//     del guion 02.
//
// ⚠️ NO envuelvas este fichero en una IIFE: `browse` ya lo envuelve ÉL en
// `(async()=>{ … })()` — por eso los `await` y el `return` de nivel superior son
// legales. Con una IIFE propia, el `eval` devuelve una promesa que nadie espera y
// **el veredicto se pierde EN SILENCIO**. Consecuencia normal y esperada:
// `node --check` sobre este fichero falla con «Illegal return statement».

const t0 = performance.now()
const TOPE_TOTAL_MS = 20000

const problemas = []
const advertencias = []
const noCubierto = []

// ── Los umbrales, con su motivo ─────────────────────────────────────────────

/**
 * Alto mínimo del contenedor del mapa, en píxeles. **No es «mayor que cero»**:
 * a 0 el WMS se cae en silencio, pero a 80 px la cartografía no sirve para
 * contrastar nada y el defecto sigue siendo real. 200 px es el suelo por debajo
 * del cual la parcela y su entorno no caben juntos a ninguna escala útil.
 */
const SUELO_ALTO_MAPA = 200

/** Ancho mínimo del mapa. La maqueta medida a 1280×720 le dejaba **680 px**. */
const SUELO_ANCHO_MAPA = 400

/**
 * Cuánto se le tolera al panel salirse por abajo. **Cero**, y no por purismo:
 * `.gml-panel` es `overflow: hidden`, así que cada píxel de más es contenido que
 * el usuario no puede alcanzar de ninguna manera —ni con la rueda—. Se admite
 * un píxel de redondeo subpíxel del navegador y ni uno más.
 */
const DESBORDE_TOLERADO = 1

/** Cuántos avisos distintos se provocan. Cinco es el caso real de un diagnóstico
 *  con varios hallazgos, que es el que el autor describió como «los avisos se
 *  recortan y pelean con las coordenadas». */
const AVISOS_A_PROVOCAR = 5

/** Ancho del rail en la maqueta medida (`designs/entrada-rail-20260804/`). Solo
 *  se compara cuando `modo === 'SHELL'`. */
const RAIL_ANCHO_MAQUETA = 210

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)

/** La caja de un elemento, redondeada, o `null` si no está. */
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

/** Cuánto se sale un elemento de su propia caja, por abajo. */
const desborde = (el) => (el ? redondear(el.scrollHeight - el.clientHeight, 2) : null)

/** ¿Está el texto de este elemento recortado? Por alto o por ancho. */
function recortado(el) {
  if (!el) return null
  return {
    porAlto: el.scrollHeight - el.clientHeight > 1,
    porAncho: el.scrollWidth - el.clientWidth > 1,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/** El gesto de soltar un fichero sobre la ventana, donde escucha `app/zona-fichero.js`. */
function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

const tarjetas = () => $$('#avisos .gml-aviso')
const textosDeAvisos = () => $$('#avisos .gml-aviso-texto')

// ── 0 · Arranque: dónde estamos y con qué ───────────────────────────────────

const app = $('.gml-app') ?? document.body
const railNodo = $('.gml-rail, [data-rail], [data-navegacion="rail"]')
const modo = railNodo === null ? 'LINEA_BASE' : 'SHELL'

const panelNodo = $('.gml-panel')
const mapaNodo = $('#mapa') ?? $('.gml-mapa') ?? $('.leaflet-container')
const avisosNodo = $('#avisos') ?? $('.gml-avisos')
const cajaVerticesNodo = $('.gml-bloque--vertices') ?? $('.gml-tabla-vertices')

const arranque = {
  modo,
  queSignifica:
    modo === 'LINEA_BASE'
      ? 'No hay rail: esta pasada mide la cáscara de HOY, para que la rebanada 2 tenga contra qué ' +
        'compararse. Los umbrales son los mismos que se le exigirán al shell.'
      : 'Hay rail: esta pasada mide el shell de tres columnas y publica su coste en píxeles.',
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
  dpr: window.devicePixelRatio,
  url: location.href,
  tarjetasDeAvisos: tarjetas().length,
  rama: app.getAttribute('data-rama'),
  nodosEncontrados: {
    // ⚠️ `.gml-app` **ES el `<body>`**, así que aquí no vale comparar contra
    // `document.body`: la primera versión de este guion publicaba `app:false`
    // sobre una página perfectamente montada.
    app: $('.gml-app') !== null,
    rail: railNodo !== null,
    panel: panelNodo !== null,
    mapa: mapaNodo !== null,
    avisos: avisosNodo !== null,
    cajaVertices: cajaVerticesNodo !== null,
  },
}

// El contrato mínimo del guion: sin panel y sin mapa no hay nada que medir, y
// callarlo sería devolver un `ok:true` que no significa nada.
for (const [nombre, presente] of Object.entries(arranque.nodosEncontrados)) {
  if (!presente && nombre !== 'rail' && nombre !== 'app') {
    problemas.push(
      `No se encuentra «${nombre}» en la página. Es parte del contrato de marcado que este guion ` +
        `mide; sin él, cualquier veredicto de aquí sería falso.`,
    )
  }
}

if (arranque.tarjetasDeAvisos > 0) {
  advertencias.push(
    `La página arranca con ${arranque.tarjetasDeAvisos} tarjeta(s) de aviso, y una cuesta ~52 px ` +
      `del sitio más caro del panel. Las cifras de altura de esta pasada están MEDIDAS con ellas ` +
      `puestas: para la cifra limpia, recarga (\`$B reload\`) y vuelve a lanzar.`,
  )
}

if (window.innerWidth > 1280 && window.innerHeight > 720) {
  advertencias.push(
    `Esta pasada es a ${window.innerWidth}×${window.innerHeight}, que está por ENCIMA del suelo ` +
      `declarado (1280×720). Una pasada cómoda no sustituye a la del suelo: hay que lanzar las ` +
      `dos y comparar (decisión D5).`,
  )
}

// ── 1 · El reparto horizontal: quién se lleva el ancho ──────────────────────

const anchoTotal = window.innerWidth
const cajaRail = caja(railNodo)
const cajaPanel = caja(panelNodo)
const cajaMapa = caja(mapaNodo)

const columnas = {
  viewportAncho: anchoTotal,
  rail: cajaRail,
  panel: cajaPanel,
  mapa: cajaMapa,
  reparto: {
    railPct: cajaRail ? redondear((cajaRail.ancho / anchoTotal) * 100, 1) : 0,
    panelPct: cajaPanel ? redondear((cajaPanel.ancho / anchoTotal) * 100, 1) : null,
    mapaPct: cajaMapa ? redondear((cajaMapa.ancho / anchoTotal) * 100, 1) : null,
  },
  /**
   * ⭐ **EL COSTE DEL RAIL, que es la cifra de T10.** En la línea base es 0
   * porque el rail no existe: eso NO significa que hoy sea gratis, significa que
   * el precio lo está pagando otro —siete controles flotando sobre el mapa y un
   * panel de altura fija sin holgura—, y eso no se mide en píxeles de ancho.
   */
  costeDelRailPx: cajaRail ? cajaRail.ancho : 0,
}

if (modo === 'SHELL' && cajaRail) {
  columnas.railContraMaqueta = {
    medido: cajaRail.ancho,
    maqueta: RAIL_ANCHO_MAQUETA,
    diferencia: redondear(cajaRail.ancho - RAIL_ANCHO_MAQUETA),
  }
}

// ── 2 · El mapa: el fallo más silencioso que tiene esta aplicación ─────────

const mapa = {
  caja: cajaMapa,
  overflow: mapaNodo ? getComputedStyle(mapaNodo).overflow : null,
  /** Los `<img>` de tesela que Leaflet haya llegado a montar. Informativo: este
   *  guion mide cajas, no píxeles pintados (ver «qué no puede medir»). */
  teselasMontadas: $$('.leaflet-tile').length,
  panesMontados: $$('.leaflet-pane').length,
}

if (cajaMapa && cajaMapa.alto < SUELO_ALTO_MAPA) {
  problemas.push(
    `El contenedor del mapa mide ${cajaMapa.alto} px de alto, por debajo del suelo de ` +
      `${SUELO_ALTO_MAPA}. Con altura 0, \`viewer/wms-catastro.js\` corta el encuadre sin ` +
      `petición, sin aviso y sin error: la pantalla se queda en blanco y nada lo dice.`,
  )
}
if (cajaMapa && cajaMapa.ancho < SUELO_ANCHO_MAPA) {
  problemas.push(
    `El mapa se queda en ${cajaMapa.ancho} px de ancho (suelo: ${SUELO_ANCHO_MAPA}). La maqueta ` +
      `medida del shell le dejaba 680 px a 1280×720.`,
  )
}

// ── 3 · El panel: lo que no cabe, se recorta en silencio ───────────────────

const bloquesDelPanel = panelNodo
  ? $$(':scope > *', panelNodo).map((el) => ({
      clase: el.className || el.tagName.toLowerCase(),
      alto: redondear(el.getBoundingClientRect().height),
      oculto: el.hidden === true,
    }))
  : []

const panel = {
  caja: cajaPanel,
  overflow: panelNodo ? getComputedStyle(panelNodo).overflow : null,
  desbordePx: desborde(panelNodo),
  /** Cuánto sitio le sobra al panel por debajo del viewport. Negativo = se sale. */
  holguraHastaElBordePx: cajaPanel ? redondear(window.innerHeight - cajaPanel.abajo) : null,
  bloques: bloquesDelPanel,
  sumaDeBloques: redondear(bloquesDelPanel.reduce((n, b) => n + (b.oculto ? 0 : b.alto), 0)),
}

if (panel.desbordePx !== null && panel.desbordePx > DESBORDE_TOLERADO) {
  problemas.push(
    `El panel se sobresuscribe ${panel.desbordePx} px: su contenido mide ` +
      `${panelNodo.scrollHeight} px y su caja ${panelNodo.clientHeight}. Con ` +
      `\`overflow: ${panel.overflow}\`, eso es contenido que el usuario NO PUEDE alcanzar de ` +
      `ninguna manera. A ${window.innerWidth}×${window.innerHeight}.`,
  )
}
if (panel.holguraHastaElBordePx !== null && panel.holguraHastaElBordePx < -DESBORDE_TOLERADO) {
  problemas.push(
    `El panel llega ${redondear(-panel.holguraHastaElBordePx)} px POR DEBAJO del borde inferior ` +
      `de la ventana, así que su pie no se ve y no hay forma de llegar a él.`,
  )
}

// ── 3 bis · LA PANTALLA DE ENTRADA Y SUS TRES VÍAS (criterio 7, T6) ────────
//
// «La Entrada presenta las tres vías como opciones NOMBRADAS Y SEPARADAS, no como
// botones sueltos compitiendo en una fila del rótulo.» Aquí se convierte en una
// medición: **las tres tienen que verse ENTERAS sin scrollear**, porque una vía
// que hay que buscar no es una opción, es un secreto — que es exactamente lo que
// le pasaba a la medición propia antes de T6.
//
// Solo mide si la aplicación está EN Entrada. En cualquier otra pantalla no hay
// vías, y contar cero sería un falso verde.

const pasoActivo = app.getAttribute('data-paso')
const seccionEntrada = $('.gml-bloque--catastro')
const vias = $$('.gml-via')

const entrada = {
  pasoActivo,
  seMide: pasoActivo === 'entrada',
  cuantasVias: vias.length,
  rotulos: vias.map((v) => v.querySelector('h2')?.textContent.trim() ?? '(sin rótulo)'),
  separadores: $$('.gml-obien').length,
  seccion: caja(seccionEntrada),
  seccionDesbordaPx: desborde(seccionEntrada),
  /** Cuántas vías caben ENTERAS dentro de la caja visible de su sección. */
  viasCompletas: null,
  /** La cuarta vía (abrir un expediente): informativa, va en voz baja a propósito. */
  cuartaViaVisible: null,
  botonDeMedicion: $('[data-accion="abrir-medicion"]') !== null,
}

if (entrada.seMide && seccionEntrada !== null && vias.length > 0) {
  const limite = seccionEntrada.getBoundingClientRect().bottom + 0.5
  entrada.viasCompletas = vias.filter((v) => v.getBoundingClientRect().bottom <= limite).length
  const pieCuarta = $('.gml-entrada-pie')
  entrada.cuartaViaVisible =
    pieCuarta === null ? null : pieCuarta.getBoundingClientRect().bottom <= limite

  if (entrada.cuantasVias < 3) {
    problemas.push(
      `La pantalla de Entrada enseña ${entrada.cuantasVias} vía(s) y el criterio 7 pide TRES ` +
        `nombradas y separadas (referencia catastral, medición propia, comprobar un GML).`,
    )
  }
  if (entrada.viasCompletas < entrada.cuantasVias) {
    problemas.push(
      `Solo ${entrada.viasCompletas} de las ${entrada.cuantasVias} vías de Entrada se ven ENTERAS ` +
        `a ${window.innerWidth}×${window.innerHeight}: quedan ${entrada.seccionDesbordaPx} px ` +
        `detrás del scroll. Una vía que hay que buscar no es una opción.`,
    )
  }
  if (!entrada.botonDeMedicion) {
    problemas.push(
      'La vía de MEDICIÓN PROPIA no tiene control visible. Hasta T6 la única forma de meter un ' +
        'DXF era arrastrarlo sobre la ventana, y eso no se ve: ése era el defecto.',
    )
  }
} else if (!entrada.seMide) {
  advertencias.push(
    `Esta pasada mide la pantalla «${pasoActivo}», así que el criterio 7 (las tres vías de ` +
      `Entrada) NO se ha comprobado. Para medirlo, recarga en \`#/parcela/entrada\`.`,
  )
}

// ── 3 ter · ⭐ EL MARCADO Y LOS PÍXELES DICEN LO MISMO (rebanada 2) ─────────
//
// El eje PASO se declara en `index.html` con `data-pantalla` y lo aplica el CSS
// con cinco reglas de `display:none`. Eso parte la verificación en dos mitades
// que ninguna de las dos cubre sola:
//
//   · `test/app/pantalla.dom.test.js` afirma el MARCADO —que cada valor sea un
//     paso que existe, que `<dt>` y `<dd>` se oculten juntos, que las acciones
//     sean de Validación—, pero **jsdom no aplica `estilos/app.css`**: allí todo
//     esto sería verde aunque las cinco reglas no existieran.
//   · Aquí se afirma lo contrario y es lo único que puede hacerlo: que lo que se
//     VE en pantalla es exactamente lo que el marcado declara para este paso.
//
// No hay lista escrita a mano de qué va en cada pantalla —sería una segunda
// lista y divergiría—: se leen los `data-pantalla` del documento y se contrasta
// con la caja real de cada nodo.
const nodosDePantalla = $$('[data-pantalla]').map((n) => {
  const declaradas = (n.getAttribute('data-pantalla') ?? '').split(/\s+/).filter(Boolean)
  const r = n.getBoundingClientRect()
  return {
    nodo: `${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).split(/\s+/)[0] : ''}`,
    ficha: n.dataset.ficha ?? null,
    declaradas,
    tocaEnEstePaso: declaradas.includes(pasoActivo),
    seVe: r.width > 0 && r.height > 0,
    alto: redondear(r.height),
  }
})

// Un nodo puede estar oculto por un ANCESTRO marcado aunque él toque en este
// paso; lo contrario —que se vea sin tocarle— no tiene excusa posible.
const seVenSinTocarles = nodosDePantalla.filter((x) => x.seVe && !x.tocaEnEstePaso)
if (seVenSinTocarles.length > 0) {
  problemas.push(
    `${seVenSinTocarles.length} nodo(s) se ven en «${pasoActivo}» sin declararlo en su ` +
      `\`data-pantalla\`: ${JSON.stringify(seVenSinTocarles.map((x) => x.ficha ?? x.nodo))}. ` +
      'El marcado dice una cosa y la pantalla otra, y el marcado es el contrato.',
  )
}

const pantalla = {
  paso: pasoActivo,
  queEsEsto:
    'La mitad que jsdom NO puede verificar: que las cinco reglas de `display:none` de ' +
    '`estilos/app.css` cumplen lo que `index.html` declara con `data-pantalla`. La otra mitad ' +
    '—que el marcado sea coherente— la afirma `test/app/pantalla.dom.test.js`.',
  marcados: nodosDePantalla.length,
  seVenSinTocarles: seVenSinTocarles.map((x) => x.ficha ?? x.nodo),
  // El pie, que es lo que la rebanada 2 reparte. Antes eran 266,28 px FIJOS en
  // las cuatro pantallas; ahora cada una paga lo suyo.
  pie: (() => {
    const pieEl = $('.gml-panel-pie')
    const fichaEl = $('.gml-ficha')
    const accionesEl = $('.gml-acciones')
    return {
      alto: caja(pieEl)?.alto ?? null,
      fichaAlto: caja(fichaEl)?.alto ?? null,
      accionesAlto: accionesEl === null ? null : redondear(accionesEl.getBoundingClientRect().height),
      camposVisibles: $$('.gml-ficha [data-ficha]').filter(
        (n) => n.getBoundingClientRect().height > 0,
      ).length,
      camposTotales: $$('.gml-ficha [data-ficha]').length,
    }
  })(),
  referencia: {
    queEs:
      'Medido a 1280×720 ANTES de la rebanada 2 (2026-08-04): el pie valía 266,28 px fijos en ' +
      'las cuatro pantallas, con sus 8 campos y sus 2 acciones, y la tabla de vértices 228,33 px. ' +
      'Después: Validación 209,47 / 277,98 · Edición 122,69 / 353,84 · Diagnóstico 179,50 / 304,19.',
    pieAntesPx: 266.28,
    tablaVerticesAntesPx: 228.33,
  },
}

// ── 4 · La caja de vértices: el invariante que atribuye las pérdidas ───────
//
// Desde F07 mide 267,44 px a 1440×900 en la rama PARCELA, y seis fases seguidas
// la han dejado igual. No es un umbral —a 1280×720 será otra cifra— sino la
// referencia que permite decir DE DÓNDE salió un píxel perdido.

const cajaVertices = {
  /** El BLOQUE entero: rótulo + tabla. Es lo que compite por la altura del panel. */
  bloque: caja(cajaVerticesNodo),
  /**
   * ⚠️ **Y la TABLA sola, que es lo que miden los guiones 06–13.** La primera
   * pasada de este guion publicó 323,38 px a 1440×900 contra una referencia
   * histórica de 267,44 y pareció una regresión de 56 px: no lo era, es que
   * estaba midiendo el bloque —que incluye el `<h2>`— contra una cifra tomada
   * sobre la tabla. Se publican las dos y se dice cuál es cuál.
   */
  tabla: caja($('.gml-tabla-vertices')),
  /**
   * ⭐ **LA CIFRA COMPARABLE, Y ES OTRO NODO.** Los guiones 06–13 miden
   * `#tabla-vertices` —el CONTENEDOR con scroll de la tabla, no la tabla ni el
   * bloque— y ése es el que vale 267,44 px a 1440×900 desde F07. Se mide con su
   * selector exacto para que la comparación sea legítima; publicar los otros dos
   * al lado es lo que evita el susto de la primera pasada, que leyó 323,38 px del
   * BLOQUE contra los 267,44 del contenedor y pareció una regresión de 56 px.
   */
  contenedorConScroll: caja($('#tabla-vertices')),
  referenciaHistorica1440x900: 267.44,
  queEsEsaReferencia:
    'El alto de `#tabla-vertices` (el contenedor con scroll) a 1440×900 en la rama PARCELA, ' +
    'invariante desde F07 y sostenido por seis fases seguidas a coste 0 px. Se compara con ' +
    '`contenedorConScroll`, NUNCA con `bloque` (que le suma el <h2>) ni con `tabla` (que es el ' +
    'alto natural del contenido y no depende del viewport).',
  filasVisibles: $$('.gml-tabla-vertices tbody tr').length,
}

// ── 5 · Los avisos: que no se corten a media frase ─────────────────────────

const avisosAntes = tarjetas().length
const altoAvisosAntes = avisosNodo ? redondear(avisosNodo.getBoundingClientRect().height) : null
const nodoTablaConScroll = $('#tabla-vertices')
const altoVerticesAntes = nodoTablaConScroll
  ? redondear(nodoTablaConScroll.getBoundingClientRect().height)
  : null

// Cinco extensiones distintas ⇒ cinco mensajes distintos ⇒ cinco tarjetas. El
// panel de avisos colapsa los repetidos con un contador `.gml-aviso-veces`, así
// que soltar cinco veces lo MISMO daría una tarjeta y un «×5», que no mide nada.
const EXTENSIONES = ['.zip', '.png', '.docx', '.csv', '.kml']
for (const ext of EXTENSIONES.slice(0, AVISOS_A_PROVOCAR)) {
  if (performance.now() - t0 > TOPE_TOTAL_MS) break
  soltar(new File(['x'], `no-vale${ext}`, { type: '' }))
  await esperar(60)
}
await esperar(250)

const tarjetasAhora = tarjetas()
const cortadas = textosDeAvisos()
  .map((t, i) => ({ i, ...recortado(t), texto: t.textContent.trim().slice(0, 60) }))
  .filter((r) => r.porAlto || r.porAncho)

/**
 * ⭐ **LO QUE CUESTA UNA TARJETA, Y CUÁNTAS CABEN.** Medir solo si el TEXTO de
 * cada tarjeta está recortado no basta, y lo destapó la primera pasada de este
 * guion: a 1280×720 con cinco avisos, ningún texto salía recortado —salen
 * enteros, dentro de su tarjeta— pero **el bloque que las contiene medía 34,22 px
 * y escondía 394 detrás de un scroll**, o sea que en pantalla no había ni una
 * tarjeta completa. El texto estaba bien; lo que estaba cortado era la lista.
 */
const altoDeUnaTarjeta = tarjetasAhora.length > 0 ? redondear(tarjetasAhora[0].getBoundingClientRect().height) : null
const altoDelBloque = avisosNodo ? redondear(avisosNodo.getBoundingClientRect().height) : null
const tarjetasQueCaben =
  altoDeUnaTarjeta && altoDelBloque ? redondear(altoDelBloque / altoDeUnaTarjeta, 2) : null

const avisos = {
  provocados: AVISOS_A_PROVOCAR,
  tarjetasAntes: avisosAntes,
  tarjetasDespues: tarjetasAhora.length,
  /** ⚠️ Si esto no sube, el resto de la sección no ha medido nada. */
  tarjetasNuevas: tarjetasAhora.length - avisosAntes,
  altoDelBloqueAntes: altoAvisosAntes,
  altoDelBloqueDespues: altoDelBloque,
  bloqueDesbordaPx: desborde(avisosNodo),
  bloqueOverflow: avisosNodo ? getComputedStyle(avisosNodo).overflow : null,
  /** ⭐ Las tres cifras que de verdad describen «los avisos se recortan». */
  altoDeUnaTarjetaPx: altoDeUnaTarjeta,
  tarjetasQueCabenEnPantalla: tarjetasQueCaben,
  /** Tarjetas cuyo TEXTO está recortado dentro de su propia tarjeta. */
  textosCortados: cortadas,
  /**
   * ⭐ **QUÉ LE CUESTAN LOS AVISOS A LA CAJA DE VÉRTICES.** Ésta es la pelea que
   * el autor describió con estas palabras: «los avisos se recortan y pelean con
   * las coordenadas». Medida sobre `#tabla-vertices`, que es la cifra que llevan
   * seis fases vigilando.
   */
  costeEnLaCajaDeVertices:
    altoVerticesAntes !== null && nodoTablaConScroll
      ? redondear(altoVerticesAntes - nodoTablaConScroll.getBoundingClientRect().height)
      : null,
  cajaVerticesAntesPx: altoVerticesAntes,
  cajaVerticesDespuesPx: nodoTablaConScroll
    ? redondear(nodoTablaConScroll.getBoundingClientRect().height)
    : null,
  panelDesbordaAhoraPx: desborde(panelNodo),
}

if (avisos.tarjetasNuevas <= 0) {
  advertencias.push(
    `Soltar ${AVISOS_A_PROVOCAR} ficheros no ha producido ninguna tarjeta de aviso nueva, así que ` +
      `la sección de avisos de esta pasada NO ha medido nada. Puede que la vía de rechazo por ` +
      `extensión haya cambiado; revísala antes de leer \`textosCortados\` como un verde.`,
  )
} else {
  if (avisos.textosCortados.length > 0) {
    problemas.push(
      `${avisos.textosCortados.length} aviso(s) se leen CORTADOS dentro de su tarjeta con ` +
        `${avisos.tarjetasDespues} en pantalla a ${window.innerWidth}×${window.innerHeight}. Un ` +
        `aviso a medias es peor que ninguno: el usuario sabe que algo pasa y no sabe qué.`,
    )
  }
  // ⭐ El umbral que la primera pasada obligó a añadir: no basta con que el TEXTO
  // quepa en su tarjeta si la LISTA no enseña ni una tarjeta entera.
  if (tarjetasQueCaben !== null && tarjetasQueCaben < 1) {
    problemas.push(
      `Con ${avisos.tarjetasDespues} avisos, el bloque que los contiene mide ${altoDelBloque} px y ` +
        `una tarjeta mide ${altoDeUnaTarjeta}: en pantalla no cabe NI UNA entera ` +
        `(${tarjetasQueCaben} tarjetas). Quedan ${avisos.bloqueDesbordaPx} px detrás de un scroll ` +
        `de ${avisos.bloqueOverflow}. A ${window.innerWidth}×${window.innerHeight}.`,
    )
  }
}
if (avisos.panelDesbordaAhoraPx !== null && avisos.panelDesbordaAhoraPx > DESBORDE_TOLERADO) {
  problemas.push(
    `Con ${avisos.tarjetasDespues} avisos en pantalla, el panel se sobresuscribe ` +
      `${avisos.panelDesbordaAhoraPx} px y recorta por abajo. Éste es el caso real de un ` +
      `diagnóstico con varios hallazgos, no un caso de laboratorio.`,
  )
}

// ── 6 · Lo que flota sobre el mapa (criterio 5 del plan) ──────────────────
//
// El plan cambió «7 → ≤3 overlays» por una REGLA: cada superviviente sobre el
// mapa lleva su razón MEDIDA escrita al lado, y el que no la tenga baja al panel
// de su paso. Aquí no se juzga: se CUENTAN y se nombran, para que la cuenta de
// antes y la de después existan.

const sobreElMapa = mapaNodo
  ? $$(':scope > *', mapaNodo)
      .filter((el) => {
        const cs = getComputedStyle(el)
        return cs.position === 'absolute' || cs.position === 'fixed' || el.className.includes('control')
      })
      .map((el) => ({
        clase: (el.className || el.tagName.toLowerCase()).toString().slice(0, 60),
        caja: caja(el),
        visible: el.offsetParent !== null && !el.hidden,
      }))
  : []

const controlesLeaflet = $$('.leaflet-control').map((el) => ({
  clase: el.className.toString().slice(0, 60),
  caja: caja(el),
  visible: el.offsetParent !== null && !el.hidden,
}))

// ── Lo que este guion NO cubre ────────────────────────────────────────────

noCubierto.push(
  'SI LA PANTALLA ES BONITA. Este guion publica anchos, altos y desbordes. Que el reparto se lea ' +
    'como un producto y no como un formulario de 2010 no tiene número, y es lo único que el autor ' +
    'dio como motivo del rework («solo mi incomodidad»).',
  'QUE UN COLEGIADO SEPA POR DÓNDE EMPEZAR. Nadie que no escribiera este código ha abierto nunca ' +
    'la aplicación. La asignación de office-hours sigue abierta: sentar a uno delante con una ' +
    'referencia catastral y callarse cinco minutos.',
  'QUE EL RAIL SE PUEDA PULSAR CON EL DEDO. Los sucesos de aquí van despachados a mano (§0 del ' +
    'GUION); el tamaño cómodo de los objetivos es del checklist humano.',
  'QUE LA CARTOGRAFÍA SE VEA. Aquí se miden CAJAS, no píxeles pintados: un mapa de 700 px de alto ' +
    'con el WMS caído da las mismas cifras que uno bueno. Eso es del guion 02.',
  'EL EJE PASO. Mientras `modo` sea `LINEA_BASE` no hay rail ni pasos que recorrer: esta pasada ' +
    'mide la cáscara de dos columnas de hoy. La comparación de verdad es entre las dos pasadas.',
)

return {
  guion: '14-shell',
  ok: problemas.length === 0,
  modo,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto,
  arranque,
  columnas,
  mapa,
  panel,
  pantalla,
  entrada,
  cajaVertices,
  avisos,
  sobreElMapa: {
    cuantos: sobreElMapa.length + controlesLeaflet.length,
    hijosAbsolutosDelMapa: sobreElMapa,
    controlesLeaflet,
    nota:
      'Se cuentan y se nombran, no se juzgan. La regla del plan es que cada superviviente sobre el ' +
      'mapa lleve su razón MEDIDA escrita al lado (la barra de edición la tiene: 270 px que ' +
      'dejaban la tabla de vértices en 64 px), y que el que no la tenga baje al panel de su paso.',
  },
  estadoFinal: {
    queDeja:
      `La aplicación con ${tarjetas().length} tarjeta(s) de aviso provocadas por este guion y nada ` +
      `más: no carga ficheros, no consulta al Catastro, no conmuta de rama y no edita. Para ` +
      `volver al punto de partida: \`$B reload\`.`,
    viewport: { ancho: window.innerWidth, alto: window.innerHeight },
    rama: app.getAttribute('data-rama'),
    tarjetasDeAvisos: tarjetas().length,
  },
}
