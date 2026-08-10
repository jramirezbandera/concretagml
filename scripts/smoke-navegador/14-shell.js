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
//      que es el caso real de un diagnóstico. ⚠️ **Desde el 2026-08-07 la lista
//      vive en un `<dialog>`** y este criterio se mide EN DOS TIEMPOS: cerrado
//      (las tarjetas siguen en el DOM y la columna no paga nada por ellas) y
//      abierto (los textos se leen enteros y «Cerrar» se alcanza). El porqué de
//      los dos tiempos —y el verde falso que se evitó— está en la §5.
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
// de rama y no edita. Abre el diálogo de avisos para medirlo por dentro y **lo
// vuelve a cerrar** antes de seguir. Para volver al punto de partida: `$B reload`.
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

/**
 * ⭐ **LA CÁSCARA DE REFERENCIA, MEDIDA LAS DOS VECES A 1280×720.**
 *
 * El rail dejó de ser una COLUMNA el 2026-08-10 y pasó a ser una BARRA de arriba
 * (topbar · rebanada 1). Este guion conserva las dos cifras porque su trabajo es
 * atribuir píxeles: sin la de antes, una pérdida futura no se puede achacar a
 * nadie. Todas están MEDIDAS en Chrome con `?demo=real`, no calculadas.
 */
const REFERENCIA = Object.freeze({
  // Antes: rail vertical. El mapa pagaba 210 px de ANCHO.
  columna: Object.freeze({ railAncho: 210, mapa: '678×720', verticesPx: 225.08 }),
  // Después: barra horizontal. El mapa recupera el ancho y paga el ALTO de la
  // barra; el panel paga lo mismo sin ganar nada, y se lo come su único estirador.
  //
  // ⚠️ **53 y no 72, desde el 2026-08-10.** La barra nació con un renglón de
  // mensajes debajo que cobraba 19 px de alto a la ventana entera; se retiró por
  // repetir lo que ya decían el `title` del peldaño y el acuse del pie. Los 19 px
  // volvieron al mapa y al panel, así que las cifras de esta fila son las de
  // después de esa devolución.
  barra: Object.freeze({ barraAlto: 53, mapa: '888×667', verticesPx: 172.08 }),
})

/** Alto de la barra de recorrido. Es `--gml-cabecera-alto` de `estilos/app.css`. */
const BARRA_ALTO_ESPERADO = REFERENCIA.barra.barraAlto

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
/** ¿Está el rail ARRIBA (barra) o a la IZQUIERDA (columna)? Se deduce de su caja,
 *  no de una bandera: lo que importa es lo que se ve, no lo que se cree. */
const orientacion =
  railNodo === null
    ? null
    : railNodo.getBoundingClientRect().width > railNodo.getBoundingClientRect().height
      ? 'BARRA'
      : 'COLUMNA'

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
      : orientacion === 'BARRA'
        ? 'Hay barra de recorrido ARRIBA (topbar · rebanada 1, 2026-08-10): esta pasada mide la ' +
          'cáscara de rejilla y publica lo que cuesta en ALTO.'
        : 'Hay rail en COLUMNA: la cáscara anterior al 2026-08-10. Publica su coste en ANCHO.',
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
  dpr: window.devicePixelRatio,
  url: location.href,
  tarjetasDeAvisos: tarjetas().length,
  rama: app.getAttribute('data-rama'),
  orientacionDelRail: orientacion,
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
  costeDelRailPx: cajaRail && orientacion === 'COLUMNA' ? cajaRail.ancho : 0,
  /** ⭐ Y lo que cuesta la BARRA, que se paga en ALTO y no en ancho. Desde el
   *  2026-08-10 ésta es la cifra viva; la de arriba se queda en 0 y eso es
   *  correcto: la columna ya no existe. */
  costeDeLaBarraPx: cajaRail && orientacion === 'BARRA' ? cajaRail.alto : 0,
  orientacion,
}

if (modo === 'SHELL' && cajaRail) {
  columnas.contraLaReferencia =
    orientacion === 'BARRA'
      ? {
          barraAltoMedido: cajaRail.alto,
          barraAltoEsperado: BARRA_ALTO_ESPERADO,
          diferencia: redondear(cajaRail.alto - BARRA_ALTO_ESPERADO),
          antes: REFERENCIA.columna,
          ahora: REFERENCIA.barra,
        }
      : {
          railAnchoMedido: cajaRail.ancho,
          railAnchoEsperado: REFERENCIA.columna.railAncho,
          diferencia: redondear(cajaRail.ancho - REFERENCIA.columna.railAncho),
          aviso:
            'Esta pasada ve un rail en COLUMNA. La cáscara pasó a barra horizontal el 2026-08-10: ' +
            'o se está midiendo una versión anterior, o la rejilla de `.gml-app` no se ha aplicado.',
        }

  // ⚠️ La barra dejó de ser `overflow:hidden` el 2026-08-10 (rompía sus propios
  // menús), así que lo que no le quepa ya no se recorta: **se desborda encima del
  // panel y del mapa**. Sigue midiéndose, y sigue siendo un problema; lo que ha
  // cambiado es el síntoma, de mudo a feo.
  if (orientacion === 'BARRA') {
    const desbordeBarra = {
      x: railNodo.scrollWidth - railNodo.clientWidth,
      y: railNodo.scrollHeight - railNodo.clientHeight,
    }
    columnas.barraDesbordaPx = desbordeBarra
    if (desbordeBarra.x > DESBORDE_TOLERADO || desbordeBarra.y > DESBORDE_TOLERADO) {
      problemas.push(
        `La barra de recorrido se sobresuscribe ${desbordeBarra.x} px en horizontal y ` +
          `${desbordeBarra.y} en vertical: la marca, los peldaños o la entrega se salen de su ` +
          `caja y se pintan encima del panel y del mapa.`,
      )
    }
  }
}

// ── 1 bis · ⭐ LOS MENÚS DE LA BARRA NO PUEDEN QUEDAR RECORTADOS ───────
//
// ⛔ **Esta sección sustituye a la del renglón de motivo, retirado el 2026-08-10,
// y la sustituye por lo que aquel `overflow:hidden` de la barra rompía.** El menú
// del expediente mide más que la barra de la que cuelga; con la barra recortando,
// «Vaciarlo» se pintaba y era inalcanzable, y peor: el `focus()` de la primera
// opción hacía scroll de la propia barra (`scrollTop: 37` medido) y se llevaba la
// marca, el recorrido y «Generar GML» fuera de la pantalla.
//
// Las dos cosas son invisibles para jsdom, que no compone cajas. Por eso se miden
// aquí y no en la suite: aquello estuvo VERDE en 7.397 pruebas.

const disparador = $('[data-menu-disparador]')
const menus = { disparadorExiste: disparador !== null }

if (disparador !== null) {
  disparador.click()
  const panel = $('[data-menu]')
  const rBarra = railNodo?.getBoundingClientRect() ?? null
  menus.panelExiste = panel !== null
  menus.railScrollTop = railNodo?.scrollTop ?? null
  menus.opciones =
    panel === null
      ? []
      : [...panel.querySelectorAll('[role="menuitem"]')].map((n) => {
          const r = n.getBoundingClientRect()
          return {
            texto: n.textContent.trim(),
            alto: Math.round(r.height * 100) / 100,
            dentroDeLaVentana: r.top >= 0 && r.bottom <= innerHeight,
            dentroDeLaBarra: rBarra === null ? null : r.bottom <= rBarra.bottom,
          }
        })

  if (panel === null) {
    problemas.push(
      'El disparador del menú del expediente no tiene panel `[data-menu]`. Es la única vía a ' +
        'los expedientes guardados y a «Vaciarlo» desde que el pie de Entrada se mudó a la barra.',
    )
  }
  // ⛔ El fallo de verdad: la barra NO puede haberse movido al abrir el menú.
  if (menus.railScrollTop > 0) {
    problemas.push(
      `Abrir el menú ha hecho scroll de la barra (\`scrollTop: ${menus.railScrollTop}\`). Eso se ` +
        'lleva la marca, el recorrido y «Generar GML» fuera de la pantalla. La causa conocida es ' +
        '`overflow` distinto de `visible` en `.gml-rail`: el `focus()` de la primera opción ' +
        'arrastra el contenedor recortante.',
    )
  }
  for (const op of menus.opciones) {
    if (op.dentroDeLaVentana !== true) {
      problemas.push(
        `La opción «${op.texto}» del menú del expediente se sale de la ventana. Se pinta y no se ` +
          'puede pulsar, que es la peor de las dos maneras de faltar.',
      )
    }
  }
  disparador.click()
}

// Los motivos breves de los peldaños siguen midiéndose: el tope está en
// `app/navegacion.js#TOPE_MOTIVO_BREVE` y la frase se acorta allí, no aquí.
for (const nodo of $$('.gml-rail-motivo')) {
  if (nodo.getBoundingClientRect().height > 0 && nodo.scrollWidth - nodo.clientWidth > 1) {
    problemas.push(
      `El motivo breve «${nodo.textContent}» no cabe en su peldaño y se recorta. El tope está en ` +
        '`app/navegacion.js#TOPE_MOTIVO_BREVE`: la frase se acorta allí, no aquí.',
    )
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
  // ── Rebanada 3: ¿se puede EDITAR desde esta pantalla? ────────────────────
  //
  // Lo que se ve es una cosa y lo que se puede hacer es otra, y esta es la
  // segunda. Hasta el 2026-08-04 los cuatro gestos de edición del mapa estaban
  // vivos en las CUATRO pantallas: 15 de 15 marcadores arrastrables en
  // Validación, los mismos que en Edición. El peldaño «Edición» del rail no
  // cambiaba nada de lo que se podía hacer.
  //
  // Se mide por la clase que Leaflet pone y quita él —`leaflet-marker-draggable`,
  // que sigue a `marker.dragging.enable()/disable()`— y no por nuestro propio
  // estado: preguntarle a la aplicación si cree que ha apagado el arrastre no
  // prueba que lo haya apagado.
  edicion: (() => {
    const marcadores = $$('.leaflet-marker-icon')
    const arrastrables = marcadores.filter((n) => n.classList.contains('leaflet-marker-draggable'))
    const barraEl = $('.gml-barra-edicion')
    return {
      marcadores: marcadores.length,
      arrastrables: arrastrables.length,
      sePuedeEditarAqui: arrastrables.length > 0,
      barraSeVe: barraEl !== null && barraEl.getBoundingClientRect().height > 0,
      barraDeclara: barraEl === null ? null : barraEl.getAttribute('data-pantalla'),
      referencia:
        'Antes de la rebanada 3, 1280×720: 15 arrastrables y barra visible en las CUATRO ' +
        'pantallas. Después: solo en «edicion».',
    }
  })(),
}

// Los dos ejes tienen que decir lo mismo: si la barra de herramientas no está,
// tampoco puede estar el gesto — y al revés. Que se separen es exactamente el
// medio arreglo que se quiso evitar (esconder el «deshacer» dejando vivo el
// gesto que lo necesita).
if (pantalla.edicion.sePuedeEditarAqui && pasoActivo !== 'edicion') {
  problemas.push(
    `Se puede editar la geometría desde «${pasoActivo}»: ${pantalla.edicion.arrastrables} de ` +
      `${pantalla.edicion.marcadores} marcadores son arrastrables. Los cuatro gestos del mapa son ` +
      'de la pantalla de Edición; en las demás la geometría se mira.',
  )
}
if (pantalla.edicion.barraSeVe !== (pasoActivo === 'edicion')) {
  problemas.push(
    `La barra de edición ${pantalla.edicion.barraSeVe ? 'SE VE' : 'no se ve'} en «${pasoActivo}», ` +
      `y declara pertenecer a «${pantalla.edicion.barraDeclara}».`,
  )
}
if (pantalla.edicion.barraSeVe !== pantalla.edicion.sePuedeEditarAqui) {
  problemas.push(
    'La barra de edición y los gestos del mapa no dicen lo mismo (barra visible: ' +
      `${pantalla.edicion.barraSeVe}; se puede editar: ${pantalla.edicion.sePuedeEditarAqui}). ` +
      'Esconder el «deshacer» dejando vivo el gesto que lo necesita es peor que no esconder nada.',
  )
}

// ── Rebanada 4: ¿el DIAGNÓSTICO es una pantalla o un cajón que se cierra solo? ─
//
// ⛔ MEDIDO EL 2026-08-05, antes de la corrección, a 1280×720:
//
//   · llegar a Diagnóstico por el PELDAÑO DEL RAIL dejaba la pantalla vacía: el
//     cajón se abría y su propio guardián de clic-fuera lo cerraba en el mismo
//     gesto (el clic del rail no es el evento de apertura). Por hash y por el CTA
//     del pie sí quedaba abierto — o sea que el camino que el rework promete era
//     justo el único que no funcionaba;
//   · UN clic en el mapa lo cerraba, y el mapa es lo que se mira en esa pantalla;
//   · una vez cerrado, pulsar otra vez el peldaño NO lo devolvía;
//   · y con el cajón abierto, 278 px de 650 (42,77 %) nacían bajo el pliegue:
//     «Preparar informe (PDF)» a 207,53 px por debajo del borde, «Descargar
//     informe de contraste» a 248,38 px y el renglón de estado a 164,69 px.
//
// Nada de eso lo puede ver jsdom: los tres primeros necesitan el guardián del
// `document` corriendo de verdad, y el cuarto necesita maquetación.
const diagnostico = (() => {
  const cajonEl = $('.gml-cajon-diagnostico')
  if (cajonEl === null) {
    return {
      hayCajon: false,
      queSignifica: 'No hay cajón de diagnóstico montado en esta página.',
    }
  }
  const abierto = () => getComputedStyle(cajonEl).display !== 'none'
  const rc = () => cajonEl.getBoundingClientRect()

  /** ¿Se ve este nodo DENTRO del cajón y sin que nadie lo tape? */
  const seVeDentro = (sel) => {
    const nodo = cajonEl.querySelector(sel)
    if (nodo === null) return { existe: false }
    const r = nodo.getBoundingClientRect()
    const caja = rc()
    if (r.width === 0 || r.height === 0) return { existe: true, seVe: false, oculto: true }
    const cx = Math.round(r.left + r.width / 2)
    const cy = Math.round(r.top + r.height / 2)
    const enElPunto = document.elementFromPoint(cx, cy)
    return {
      existe: true,
      oculto: false,
      pxPorDebajoDelCajon: redondear(Math.max(0, r.bottom - caja.bottom)),
      seVe:
        r.top >= caja.top - 1 &&
        r.bottom <= caja.bottom + 1 &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        enElPunto !== null &&
        (enElPunto === nodo || nodo.contains(enElPunto)),
    }
  }

  return {
    hayCajon: true,
    abierto: abierto(),
    caja: caja(cajonEl),
    escondidoPx: cajonEl.scrollHeight - cajonEl.clientHeight,
    escondidoPct:
      cajonEl.scrollHeight > 0
        ? redondear(((cajonEl.scrollHeight - cajonEl.clientHeight) / cajonEl.scrollHeight) * 100)
        : null,
    // Lo que NO puede esconderse: lo que se pulsa y lo que habla.
    prepararInforme: seVeDentro('[data-accion="preparar-informe"]'),
    descargarInforme: seVeDentro('[data-accion="descargar-informe"]'),
    renglonDeEstado: seVeDentro('[data-estado="cajon-diagnostico"]'),
    referencia:
      'Antes de la rebanada 4, 1280×720: cajón 420×374,39 con 650 px de contenido → 278 px ' +
      '(42,77 %) bajo el pliegue; preparar-informe a 207,53 px por debajo del borde, ' +
      'descargar-informe a 248,38 px y el renglón de estado a 164,69 px.',
  }
})()

pantalla.diagnostico = diagnostico

// 1 · El cajón está abierto exactamente en su pantalla, y en ninguna otra.
if (diagnostico.hayCajon && diagnostico.abierto !== (pasoActivo === 'diagnostico')) {
  problemas.push(
    `El cajón de diagnóstico ${diagnostico.abierto ? 'está ABIERTO' : 'está CERRADO'} en ` +
      `«${pasoActivo}». Tiene que estar abierto en «diagnostico» y solo ahí: es el contenido ` +
      'de esa pantalla, no un cajón que se abre y se descarta.',
  )
}

// 2 · Estando en su pantalla, un clic en el mapa no puede borrarla.
if (diagnostico.hayCajon && pasoActivo === 'diagnostico' && diagnostico.abierto) {
  const mapaEl = $('#mapa') ?? $('.leaflet-container')
  const r = mapaEl.getBoundingClientRect()
  // Un punto del mapa a la DERECHA del cajón, para que el clic caiga fuera de él.
  const px = Math.round(r.right - 60)
  const py = Math.round(r.top + r.height * 0.3)
  const destino = document.elementFromPoint(px, py)
  const fueraDelCajon = destino !== null && !$('.gml-cajon-diagnostico').contains(destino)
  if (destino !== null && fueraDelCajon) {
    for (const tipo of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      destino.dispatchEvent(
        new MouseEvent(tipo, {
          bubbles: true,
          cancelable: true,
          clientX: px,
          clientY: py,
          view: window,
        }),
      )
    }
    const sigueAbierto = getComputedStyle($('.gml-cajon-diagnostico')).display !== 'none'
    pantalla.diagnostico.sobreviveAlClicEnElMapa = sigueAbierto
    if (!sigueAbierto) {
      problemas.push(
        'UN clic en el mapa ha cerrado el diagnóstico, y mirar el mapa es lo que se hace en esa ' +
          'pantalla. Peor: el peldaño del rail no lo devuelve, porque navegar al paso en el que ' +
          'ya estás no publica nada — el rail sigue marcando «Diagnóstico» y no hay diagnóstico.',
      )
    }
    // Y Escape, que es la otra forma de perder la pantalla sin querer.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    const trasEscape = getComputedStyle($('.gml-cajon-diagnostico')).display !== 'none'
    pantalla.diagnostico.sobreviveAEscape = trasEscape
    if (!trasEscape) {
      problemas.push('`Escape` ha cerrado el diagnóstico: descarta un cajón, no una pantalla.')
    }
  } else {
    noCubierto.push(
      'No se ha encontrado un punto del mapa fuera del cajón donde soltar el clic: la prueba de ' +
        'que un clic en el mapa no borra el diagnóstico NO se ha hecho en esta corrida.',
    )
  }
}

// 3 · Y lo accionable no puede nacer bajo el pliegue.
if (diagnostico.hayCajon && diagnostico.abierto) {
  for (const [nombre, quePasa] of [
    ['«Preparar informe (PDF)»', diagnostico.prepararInforme],
    ['«Descargar informe de contraste»', diagnostico.descargarInforme],
    ['el renglón de estado del cajón', diagnostico.renglonDeEstado],
  ]) {
    if (quePasa.existe && quePasa.oculto !== true && quePasa.seVe !== true) {
      problemas.push(
        `${nombre} no se ve con el cajón recién abierto` +
          (quePasa.pxPorDebajoDelCajon > 0
            ? `: cae ${quePasa.pxPorDebajoDelCajon} px por debajo del borde visible.`
            : '.') +
          ' Lo que se pulsa y lo que habla van anclados; esconderlos es el defecto que la ' +
          'rebanada 4 midió y cerró.',
      )
    }
  }
}

// ── Rebanada 5: ¿el paso «Informe» produce el informe? ──────────────────────
//
// ⛔ MEDIDO EL 2026-08-05, antes de la corrección, a 1280×720:
//
//   · la pantalla «Informe» no tenía NADA del informe: el panel enseñaba lo mismo
//     que Validación y de las tres acciones del informe no se veía ninguna —dos
//     viven en el cajón de diagnóstico, cerrado ahí, y la tercera en el <dialog>—;
//   · el PDF se sacaba desde Diagnóstico, con el rail marcando otra cosa;
//   · y el formulario escondía 704 px de 1.336 (52,7 %), con «Componer PDF» y
//     «Cancelar» entre lo escondido.
//
// jsdom no ve nada de esto: lo primero necesita saber qué CAJA tiene cada cosa y
// lo segundo, maquetación.
const informe = (() => {
  const dlg = $('.gml-dialogo-informe')
  if (dlg === null) {
    return { hayDialogo: false, queSignifica: 'No hay diálogo de informe en esta página.' }
  }
  const abierto = dlg.open === true || dlg.hasAttribute('open')
  const rc = dlg.getBoundingClientRect()

  const seVeDentro = (sel) => {
    const nodo = dlg.querySelector(sel)
    if (nodo === null) return { existe: false }
    const r = nodo.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return { existe: true, seVe: false, oculto: true }
    const cx = Math.round(r.left + r.width / 2)
    const cy = Math.round(r.top + r.height / 2)
    const enElPunto = document.elementFromPoint(cx, cy)
    return {
      existe: true,
      oculto: false,
      pxPorDebajoDelDialogo: redondear(Math.max(0, r.bottom - rc.bottom)),
      seVe:
        r.top >= rc.top - 1 &&
        r.bottom <= rc.bottom + 1 &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        enElPunto !== null &&
        (enElPunto === nodo || nodo.contains(enElPunto)),
    }
  }

  // ¿Sigue vivo el rail con el informe delante? Con `showModal()` estaría inerte,
  // y la pantalla sería una ratonera de la que solo se sale por Escape.
  const botonRail = $('.gml-rail-paso[data-paso="edicion"] .gml-rail-boton')
  let railAlcanzable = null
  if (botonRail !== null) {
    const r = botonRail.getBoundingClientRect()
    const p = document.elementFromPoint(
      Math.round(r.left + r.width / 2),
      Math.round(r.top + r.height / 2),
    )
    railAlcanzable = p !== null && (p === botonRail || botonRail.contains(p))
  }

  return {
    hayDialogo: true,
    abierto,
    ariaModal: dlg.getAttribute('aria-modal'),
    caja: caja(dlg),
    escondidoPx: dlg.scrollHeight - dlg.clientHeight,
    escondidoPct:
      dlg.scrollHeight > 0
        ? redondear(((dlg.scrollHeight - dlg.clientHeight) / dlg.scrollHeight) * 100)
        : null,
    componerPdf: seVeDentro('[data-accion="componer-pdf"]'),
    renglonDeEstado: seVeDentro('[data-estado="dialogo-informe"]'),
    railAlcanzable,
    referencia:
      'Antes de la rebanada 5, 1280×720: diálogo 760×633,59 centrado, 704 px de 1.336 (52,7 %) ' +
      'bajo el pliegue, «Componer PDF» a 379,53 px por debajo del borde, y el paso «Informe» sin ' +
      'una sola acción del informe a la vista.',
  }
})()

pantalla.informe = informe

// 1 · ⭐ 2026-08-08 · EL INFORME YA NO TIENE PANTALLA PROPIA, y esta comprobación
// cambia de forma con él. Antes exigía «abierto si y solo si `pasoActivo` es
// "informe"». Retirado aquel peldaño, lo que queda por exigir es que **no se abra
// solo**: el informe se abre pulsando «Preparar informe (PDF)» dentro del cajón de
// diagnóstico, y este guion no lo pulsa. Un informe abierto aquí sería un diálogo
// que se enseña sin que nadie lo haya pedido.
if (informe.hayDialogo && informe.abierto) {
  problemas.push(
    `El informe ESTÁ ABIERTO en «${pasoActivo}» sin que nadie lo haya pedido. La única puerta es ` +
      '«Preparar informe (PDF)», dentro del cajón de diagnóstico, y este guion no la pulsa.',
  )
}

// 2 · Y si estuviera abierto, no puede ser modal: dejaría inerte el rail, o sea la
// navegación. Se conserva porque la presentación a pantalla completa NO se ha
// tocado: lo que se retiró es el peldaño, no el `comoPantalla`.
if (informe.hayDialogo && informe.abierto) {
  if (informe.ariaModal !== 'false') {
    problemas.push(
      `El informe se presenta con \`aria-modal="${informe.ariaModal}"\` siendo la pantalla. Un ` +
        'modal deja fuera de juego todo lo de detrás, y detrás está el RAIL: la pantalla se ' +
        'convierte en una ratonera de la que solo se sale por Escape.',
    )
  }
  if (informe.railAlcanzable === false) {
    problemas.push(
      'Con el informe delante, el rail no se puede pulsar: `elementFromPoint` sobre el peldaño ' +
        '«Validación» no lo devuelve. La navegación de la aplicación no puede quedar tapada por ' +
        'una de sus pantallas.',
    )
  }
  // 3 · Y lo accionable no puede nacer bajo el pliegue.
  for (const [nombre, quePasa] of [
    ['«Componer PDF»', informe.componerPdf],
    ['el renglón de estado del informe', informe.renglonDeEstado],
  ]) {
    if (quePasa.existe && quePasa.oculto !== true && quePasa.seVe !== true) {
      problemas.push(
        `${nombre} no se ve con el informe recién abierto` +
          (quePasa.pxPorDebajoDelDialogo > 0
            ? `: cae ${quePasa.pxPorDebajoDelDialogo} px por debajo del borde visible.`
            : '.') +
          ' Es el botón que produce el entregable de F09; esconderlo es el defecto que la ' +
          'rebanada 5 midió y cerró.',
      )
    }
  }
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
//
// ══ ⭐⭐ REESCRITA EL 2026-08-07, Y HAY QUE LEER POR QUÉ ANTES DE CITARLA ═════
//
// Esta sección medía **el bloque de avisos dentro del panel**: cuánto medía, si
// cabía una tarjeta entera, y cuánta altura le robaba a la caja de vértices. Ese
// bloque YA NO EXISTE — la lista se mudó a un `<dialog>` (`app/dialogo-avisos.js`)
// justamente porque la respuesta a todas aquellas preguntas era «mal».
//
// ⛔ **Y si esta sección se hubiera dejado como estaba, habría dado VERDE
// MINTIENDO.** No es una hipótesis: `#avisos` sigue existiendo y `$('#avisos')`
// lo sigue encontrando, pero dentro de un `<dialog>` cerrado, o sea con
// `display:none`. Todas sus medidas valen 0: alto 0, desborde 0, `scrollWidth ===
// clientWidth` ⇒ **cero textos cortados** y **cero desborde**, que es exactamente
// la forma de un verde perfecto. El guion habría certificado que los avisos se
// leen de maravilla sin haber mirado ni uno.
//
// Lo que se mide ahora son las DOS mitades de la mudanza, y las dos hacen falta:
//
//   A · **Lo que se ganó**, con el diálogo CERRADO: las cinco tarjetas siguen en
//       el DOM (de eso viven los otros doce guiones), los chips las cuentan, y la
//       caja de vértices **ya no paga nada** por ellas. Ese coste era la queja
//       original del autor —«los avisos se recortan y pelean con las
//       coordenadas»— y aquí es donde se comprueba que dejó de existir.
//   B · **Lo que no se puede haber roto**, con el diálogo ABIERTO: los textos se
//       leen enteros, cabe más de una tarjeta, y el pie con «Cerrar» se alcanza
//       sin scroll. Un modal del que no se puede salir es peor que el bloque.

const avisosAntes = tarjetas().length
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

// ── A · Con el diálogo CERRADO ────────────────────────────────────────────

const dialogoNodo = $('.gml-dialogo-avisos')
const chipAvisoNodo = $('.gml-chip[data-contador="AVISO"]')
const chipErrorNodo = $('.gml-chip[data-contador="ERROR"]')

const tarjetasCerrado = tarjetas().length
const cajaVerticesDespues = nodoTablaConScroll
  ? redondear(nodoTablaConScroll.getBoundingClientRect().height)
  : null

const enReposo = {
  dialogoExiste: dialogoNodo !== null,
  dialogoAbierto: dialogoNodo ? dialogoNodo.hasAttribute('open') : null,
  /** ⭐ Las tarjetas EN EL DOM con el diálogo cerrado. Si esto cae a 0, los doce
   *  guiones que cuentan `#avisos .gml-aviso` empiezan a mentir todos a la vez. */
  tarjetasEnElDom: tarjetasCerrado,
  /** Los chips son ahora el ÚNICO rastro visible. Se leen tal cual. */
  chipError: chipErrorNodo ? chipErrorNodo.textContent.trim() : null,
  chipAviso: chipAvisoNodo ? chipAvisoNodo.textContent.trim() : null,
  chipsSonBotones:
    chipErrorNodo?.tagName === 'BUTTON' && chipAvisoNodo?.tagName === 'BUTTON' ? true : false,
  /** El alto que la lista ocupa EN LA COLUMNA. Tiene que ser 0: ya no está ahí. */
  altoEnLaColumna: avisosNodo ? redondear(avisosNodo.getBoundingClientRect().height) : null,
  panelDesbordaPx: desborde(panelNodo),
}

const avisos = {
  provocados: AVISOS_A_PROVOCAR,
  tarjetasAntes: avisosAntes,
  tarjetasDespues: tarjetasCerrado,
  /** ⚠️ Si esto no sube, el resto de la sección no ha medido nada. */
  tarjetasNuevas: tarjetasCerrado - avisosAntes,
  enReposo,
  /**
   * ⭐⭐ **QUÉ LE CUESTAN LOS AVISOS A LA CAJA DE VÉRTICES.** Ésta es la pelea
   * que el autor describió con estas palabras: «los avisos se recortan y pelean
   * con las coordenadas», y la cifra por la que se hizo la mudanza. Antes del
   * 2026-08-07 esto era un número POSITIVO y grande; desde la mudanza tiene que
   * ser 0 — y si vuelve a subir, es que la lista ha vuelto a la columna.
   */
  costeEnLaCajaDeVertices:
    altoVerticesAntes !== null && cajaVerticesDespues !== null
      ? redondear(altoVerticesAntes - cajaVerticesDespues)
      : null,
  cajaVerticesAntesPx: altoVerticesAntes,
  cajaVerticesDespuesPx: cajaVerticesDespues,
  panelDesbordaAhoraPx: enReposo.panelDesbordaPx,
}

if (avisos.tarjetasNuevas <= 0) {
  advertencias.push(
    `Soltar ${AVISOS_A_PROVOCAR} ficheros no ha producido ninguna tarjeta de aviso nueva, así que ` +
      `la sección de avisos de esta pasada NO ha medido nada. Puede que la vía de rechazo por ` +
      `extensión haya cambiado; revísala antes de leer nada de aquí como un verde.`,
  )
}

if (!enReposo.dialogoExiste) {
  problemas.push(
    'No hay ningún `.gml-dialogo-avisos` en la página. Desde el 2026-08-07 la lista de avisos vive ' +
      'ahí y los chips son su única puerta: sin diálogo, el detalle de los errores es INALCANZABLE ' +
      'para el usuario aunque los contadores digan un número.',
  )
}

if (!enReposo.chipsSonBotones) {
  problemas.push(
    'Los contadores de la cabecera no son `<button>`. Son la ÚNICA forma de abrir la lista de ' +
      'avisos desde que se fue del panel: si vuelven a ser `<span>`, el detalle de un error ' +
      'bloqueante deja de ser alcanzable con el ratón y con el teclado a la vez.',
  )
}

// ⭐ El guardián de la mudanza. La lista NO puede volver a ocupar sitio en la
// columna: es lo que este cambio vino a quitar. Se tolera el mismo píxel de
// redondeo subpíxel que el resto del guion.
if (enReposo.altoEnLaColumna !== null && enReposo.altoEnLaColumna > DESBORDE_TOLERADO) {
  problemas.push(
    `Con ${avisos.tarjetasDespues} avisos y el diálogo CERRADO, la lista ocupa ` +
      `${enReposo.altoEnLaColumna} px de la columna. Tendría que ocupar 0: se mudó a un ` +
      `<dialog> precisamente porque esos píxeles se los quitaba a la tabla de vértices y al pie.`,
  )
}

if (avisos.costeEnLaCajaDeVertices !== null && avisos.costeEnLaCajaDeVertices > DESBORDE_TOLERADO) {
  problemas.push(
    `Los ${avisos.tarjetasDespues} avisos le han costado ${avisos.costeEnLaCajaDeVertices} px a la ` +
      `caja de vértices (de ${altoVerticesAntes} a ${cajaVerticesDespues}). Desde la mudanza del ` +
      `2026-08-07 tendrían que costarle CERO. Si esto sube, la lista ha vuelto a la columna por ` +
      `algún sitio.`,
  )
}

if (avisos.panelDesbordaAhoraPx !== null && avisos.panelDesbordaAhoraPx > DESBORDE_TOLERADO) {
  problemas.push(
    `Con ${avisos.tarjetasDespues} avisos en pantalla, el panel se sobresuscribe ` +
      `${avisos.panelDesbordaAhoraPx} px y recorta por abajo. Éste es el caso real de un ` +
      `diagnóstico con varios hallazgos, no un caso de laboratorio.`,
  )
}

// ── B · Con el diálogo ABIERTO ────────────────────────────────────────────
//
// Aquí es donde de verdad se comprueba el criterio 3 del plan («los avisos no se
// cortan a media frase»): es el único momento en que las tarjetas tienen caja.

if (chipAvisoNodo !== null && dialogoNodo !== null) {
  chipAvisoNodo.click()
  await esperar(200)
}

const abierto = dialogoNodo !== null && dialogoNodo.hasAttribute('open')
const listaAbierta = abierto ? $('#avisos') : null
const tarjetasAbierto = abierto ? tarjetas() : []
const pieDialogo = abierto ? $('.gml-dialogo-avisos-pie') : null

const cortadas = abierto
  ? textosDeAvisos()
      .map((t, i) => ({ i, ...recortado(t), texto: t.textContent.trim().slice(0, 60) }))
      .filter((r) => r.porAlto || r.porAncho)
  : []

/**
 * ⭐ **LO QUE CUESTA UNA TARJETA, Y CUÁNTAS CABEN.** Medir solo si el TEXTO de
 * cada tarjeta está recortado no basta, y lo destapó la primera pasada de este
 * guion en 2026-08: a 1280×720 con cinco avisos, ningún texto salía recortado
 * —salen enteros, dentro de su tarjeta— pero **el bloque que las contenía medía
 * 34,22 px y escondía 394 detrás de un scroll**, o sea que en pantalla no había
 * ni una tarjeta completa. El texto estaba bien; lo que estaba cortado era la
 * lista. La comprobación se conserva palabra por palabra, solo que ahora se hace
 * contra la caja del diálogo, que es donde la lista vive.
 */
const altoDeUnaTarjeta =
  tarjetasAbierto.length > 0 ? redondear(tarjetasAbierto[0].getBoundingClientRect().height) : null
const altoDeLaLista = listaAbierta ? redondear(listaAbierta.getBoundingClientRect().height) : null
const tarjetasQueCaben =
  altoDeUnaTarjeta && altoDeLaLista ? redondear(altoDeLaLista / altoDeUnaTarjeta, 2) : null

/** ¿Se alcanza «Cerrar» sin scrollear? Un modal del que no se sale es peor que
 *  el bloque que este cambio vino a quitar. */
const pieDentro =
  pieDialogo && dialogoNodo
    ? redondear(
        dialogoNodo.getBoundingClientRect().bottom - pieDialogo.getBoundingClientRect().bottom,
      )
    : null

const avisosAbierto = {
  seAbrePinchandoElChip: abierto,
  tarjetasVisibles: tarjetasAbierto.length,
  altoDeLaListaPx: altoDeLaLista,
  altoDeUnaTarjetaPx: altoDeUnaTarjeta,
  tarjetasQueCabenEnPantalla: tarjetasQueCaben,
  listaDesbordaPx: desborde(listaAbierta),
  listaOverflow: listaAbierta ? getComputedStyle(listaAbierta).overflowY : null,
  /** Tarjetas cuyo TEXTO está recortado dentro de su propia tarjeta. */
  textosCortados: cortadas,
  /** Positivo = el pie está dentro de la caja. Negativo = «Cerrar» se sale. */
  holguraDelPiePx: pieDentro,
  cajaDelDialogo: caja(dialogoNodo),
  /** Los rótulos de las tres pestañas, tal cual se leen. */
  pestanas: $$('.gml-filtro-avisos').map((b) => b.textContent.trim()),
}
avisos.abierto = avisosAbierto

if (avisos.tarjetasNuevas > 0) {
  if (!abierto) {
    problemas.push(
      'Pinchar el contador de avisos NO ha abierto el diálogo. Es la única puerta al detalle de ' +
        'los errores desde que la lista se fue del panel: con esto roto, los contadores dan un ' +
        'número que no lleva a ninguna parte.',
    )
  } else {
    if (avisosAbierto.textosCortados.length > 0) {
      problemas.push(
        `${avisosAbierto.textosCortados.length} aviso(s) se leen CORTADOS dentro de su tarjeta con ` +
          `${avisosAbierto.tarjetasVisibles} en pantalla a ${window.innerWidth}×${window.innerHeight}. ` +
          `Un aviso a medias es peor que ninguno: el usuario sabe que algo pasa y no sabe qué.`,
      )
    }
    if (tarjetasQueCaben !== null && tarjetasQueCaben < 1) {
      problemas.push(
        `Con ${avisosAbierto.tarjetasVisibles} avisos, la lista dentro del diálogo mide ` +
          `${altoDeLaLista} px y una tarjeta mide ${altoDeUnaTarjeta}: no cabe NI UNA entera ` +
          `(${tarjetasQueCaben} tarjetas). Quedan ${avisosAbierto.listaDesbordaPx} px detrás de un ` +
          `scroll de ${avisosAbierto.listaOverflow}. A ${window.innerWidth}×${window.innerHeight}.`,
      )
    }
    if (pieDentro !== null && pieDentro < 0) {
      problemas.push(
        `El pie del diálogo —donde está «Cerrar»— se sale ${Math.abs(pieDentro)} px de la caja a ` +
          `${window.innerWidth}×${window.innerHeight}. Un modal del que hay que buscar la salida ` +
          `es peor que el bloque que esta mudanza vino a quitar.`,
      )
    }
  }
}

// Se cierra: el resto del guion mide la cáscara, y un modal abierto encima le
// cambiaría el foco y le taparía el mapa.
if (abierto) {
  const cerrarNodo = $('.gml-dialogo-avisos-pie [data-accion="cerrar-avisos"]')
  if (cerrarNodo) cerrarNodo.click()
  await esperar(150)
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
  menus,
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
