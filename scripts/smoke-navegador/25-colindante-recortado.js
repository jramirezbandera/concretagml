// scripts/smoke-navegador/25-colindante-recortado.js — F23 · fase 7.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// EL CASO MIXTO ANDADO ENTERO sobre la aplicación real:
//
//   mover unos vértices hacia DENTRO y uno hacia FUERA   (la parcela suelta Y invade)
//     → derivar          → ¿se ven LAS DOS mitades, o vuelve a esconderse una?
//     → traer colindantes → ¿aparece a quién le quitamos y el destino de cada trozo?
//     → derivar otra vez  → ¿se ABRE la descarga del expediente?
//
// Es el recorrido que el defecto original hacía imposible: hasta el 2026-08-10, en
// cuanto la geometría se salía por un sitio, `app/cableado-derivacion.js` escondía
// el bloque entero y tiraba un sobrante ya medido. La suite lo defiende ahora con
// 7.4xx pruebas, **y ninguna puede ver esto**:
//
//   1. **Que el bloque se VEA.** En jsdom `getBoundingClientRect()` devuelve ceros:
//      un bloque presente en el DOM y con 0 px de alto sale VERDE en la suite. El
//      defecto de F17 que el guion 16 cazó (la tabla a 119 px, muda) fue exactamente
//      eso.
//   2. **El precio en píxeles de la sección nueva.** F23 añade la sección «Fuera del
//      contorno oficial» y un `<select>` por fila. La columna mide ~344 px útiles y
//      **el panel NO desborda cuando esto crece: la tabla de vértices ENCOGE EN
//      SILENCIO**. Sin síntoma visible, este guion es el único guardián.
//   3. **Que las dos capas se pinten a la vez.** Cian el sobrante, ÁMBAR lo que se
//      sale. Son dos `crearCapaPiezas` sobre el mismo mapa y sobre el mismo pane:
//      que una tape a la otra, o que la segunda no llegue a montarse, no lo ve
//      ningún test de jsdom porque allí no hay Leaflet pintando de verdad.
//   4. **Que el Catastro conteste de verdad.** El registro de colindantes se puebla
//      por `alColindantes`, y la suite lo prueba con un doble. Aquí se pulsa el
//      botón y se espera al servicio real.
//
// ── ⚠️ GASTA UNA PETICIÓN AL CATASTRO, Y ES A PROPÓSITO ────────────────────
// «Traer colindantes» es UNA llamada a `GetNeighbourParcel` sobre la parcela de
// `?demo=real`. El override O8 avisa de denegación de servicio por uso abusivo, así
// que este guion **no se corre en bucle** y no entra en CI (ver GUION.md §1: la
// sonda tampoco, y por la misma razón). Una corrida = una petición, que es
// exactamente lo que hace un usuario al abrir el diagnóstico.
//
// ── ⛔ LO QUE ESTE GUION **NO** PUEDE DECIR ────────────────────────────────
// **Si la Sede acepta el fichero.** Ningún XSD expresa las reglas del IVG, y este
// expediente estrena una forma que O20 no midió: dos miembros `ES.SDGC.CP` de OTRO
// TITULAR más un alta. Que valide contra `cp/4.0` no garantiza nada — la red es
// asimétrica. Va al CHECKLIST-HUMANO.
//
// ⚠️ NECESITA `npm run dev` y el base `/concretagml/`, con `?demo=real`.

// ── Umbrales, con su motivo ─────────────────────────────────────────────────

/**
 * El suelo de la caja de vértices, heredado del guion 16 y **medido allí**, no
 * elegido: cabecera pegajosa (24,00) + fila del recinto (26,50) + tres vértices
 * (74,07) = 124,57 px. Por debajo de tres vértices el bloque ha dejado de ser un
 * añadido y es un sustituto — que fue el defecto que costó mudar la edición de F06
 * al mapa.
 *
 * F23 añade sección Y desplegables sobre lo que F17 ya gastaba, así que este suelo
 * es justo el que está en riesgo.
 */
const SUELO_VERTICES_PX = 124.57

/** Desborde tolerado del panel, en los DOS ejes. `.gml-panel` es `overflow:hidden`,
 *  así que una fila demasiado ancha no desborda: se RECORTA en silencio. */
const DESBORDE_TOLERADO_PX = 1

/** Cuánto se mueve cada vértice. 3 m: se ve, y da piezas de decenas de m². */
const PASO_M = 3

/** Lo que se espera al Catastro. Es red real: generoso, y con su aviso si se agota. */
const ESPERA_CATASTRO_MS = 20000

/** El ámbar de la invasión (`viewer/piezas.js#COLOR_FUERA`). */
const COLOR_FUERA = '#d97706'

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (sel) => $(sel)?.textContent?.trim() ?? ''

const SEL = {
  APP: '.gml-app',
  PANEL: '.gml-panel',
  TABLA: '.gml-tabla-vertices',
  ANFITRION: '[data-anfitrion="sobrante"]',
  BLOQUE: '[data-sobrante="bloque"]',
  FILA: '[data-sobrante="fila"]',
  DESTINO: '[data-sobrante="destino"]',
  FUERA: '[data-sobrante="fuera"]',
  FUERA_FILA: '[data-sobrante="fuera-fila"]',
  FUERA_ROTULO: '[data-sobrante="fuera-rotulo"]',
  FUERA_SOBRE: '[data-sobrante="fuera-sobre"]',
  DERIVAR: '[data-accion="derivar-sobrante"]',
  ESTADO_DERIVAR: '[data-estado="derivar-sobrante"]',
  ENTREGAR: '[data-accion="entregar-expediente"]',
  ESTADO_ENTREGA: '[data-estado="entregar-expediente"]',
  COLINDANTES: '[data-accion="traer-colindantes"]',
  MANCHA: '.gml-pieza',
  MANCHA_FUERA: '.gml-pieza--fuera',
  // La astilla del enganche (2026-08-10).
  NO_EMITIBLE: '[data-sobrante="no-emitible"]',
  INCLUIR: '[data-sobrante="incluir"]',
  CONTADOR: '[data-sobrante="contador"]',
  NOTA: '[data-sobrante="nota"]',
}

const app = () => $(SEL.APP) ?? document.body
const paso = () => app().dataset.paso ?? null

function caja(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { ancho: redondear(r.width), alto: redondear(r.height) }
}
const tieneCaja = (el) => {
  const c = caja(el)
  return c !== null && c.ancho > 0 && c.alto > 0
}

async function esperarA(cond, ms = 3000, paso = 50) {
  const fin = performance.now() + ms
  while (performance.now() < fin) {
    if (cond()) return true
    await dormir(paso)
  }
  return cond()
}

/** Escribe en un `<input>` y dispara los eventos que la app escucha. */
function teclear(input, valor) {
  if (!input) return
  input.value = String(valor)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const verticesDeLaTabla = () =>
  $$('tbody[data-recinto="0"] tr[data-indice]').map((tr) => ({
    indice: Number(tr.dataset.indice),
    x: Number($('input[data-eje="x"]', tr)?.value),
    y: Number($('input[data-eje="y"]', tr)?.value),
  }))

function centroDeLaTabla() {
  const v = verticesDeLaTabla()
  return {
    x: v.reduce((s, p) => s + p.x, 0) / v.length,
    y: v.reduce((s, p) => s + p.y, 0) / v.length,
  }
}

/**
 * Mueve el vértice `indice` a lo largo de la recta que lo une con el centro.
 * Negativo = HACIA DENTRO, positivo = hacia fuera.
 *
 * ⛔ Copiado del guion 16 y por su misma razón medida: **no vale mover solo la X**.
 * «Hacia dentro» no es una dirección del eje —depende de en qué lado del polígono
 * caiga el vértice— y la parcela de `?demo=real` es CÓNCAVA (cuatro vértices
 * reflejos medidos). Se eligen los MÁS LEJANOS al centro, que son convexos por
 * construcción.
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
  await dormir(80)
  teclear($('input[data-eje="y"]', fila()), redondear(destino.y, 2))
  await dormir(80)
  return destino
}

/**
 * Lo mismo que {@link moverVertice} pero **SIN redondear a 2 decimales**, que es
 * justo lo que hace falta aquí: el defecto del 2026-08-10 nace de mover un lindero
 * MEDIO MILÍMETRO, y `redondear(x, 2)` se lo comería antes de llegar al modelo.
 *
 * No es una licencia del guion: la tabla de vértices acepta los decimales que le
 * escribas —la captura del autor traía `386115,941`— porque el enganche a linderos
 * los produce. El redondeo a 2 decimales es del FICHERO, no del modelo, y ésa es
 * exactamente la distinción que este caso pone a prueba.
 */
async function moverVerticeFino(indice, metros) {
  const centro = centroDeLaTabla()
  const v = verticesDeLaTabla().find((p) => p.indice === indice)
  if (!v) return null
  const dx = v.x - centro.x
  const dy = v.y - centro.y
  const d = Math.hypot(dx, dy)
  if (d === 0) return null
  const destino = { x: v.x + (dx / d) * metros, y: v.y + (dy / d) * metros }
  const fila = () => $(`tbody[data-recinto="0"] tr[data-indice="${indice}"]`)
  teclear($('input[data-eje="x"]', fila()), destino.x.toFixed(4))
  await dormir(80)
  teclear($('input[data-eje="y"]', fila()), destino.y.toFixed(4))
  await dormir(80)
  return destino
}

const porLejania = () => {
  const c = centroDeLaTabla()
  return verticesDeLaTabla()
    .map((v) => ({ ...v, d: Math.hypot(v.x - c.x, v.y - c.y) }))
    .sort((a, b) => b.d - a.d)
}

// ── 0 · Arranque ────────────────────────────────────────────────────────────

const problemas = []
const advertencias = []
const t0 = performance.now()

if ($$('#avisos .gml-aviso').length > 0) {
  advertencias.push(
    'La aplicación arranca con tarjetas de aviso ya puestas: le comen altura al panel y las ' +
      'cifras de píxeles de esta corrida NO son comparables. Borra IndexedDB y recarga.',
  )
}

// ⛔ **ESTE GUION EXIGE PÁGINA RECIÉN CARGADA, y lo COMPRUEBA.**
//
// Su primera mitad mide el estado «sin colindantes consultadas», y las colindantes
// **se quedan traídas** en el registro de `app/colindantes.js` mientras la página
// viva. Correrlo dos veces seguidas sin recargar hacía que la segunda corrida
// afirmara dos defectos que no existen: «la entrega está encendida sin consultar» y
// «hay desplegables sin consultar». Los dos eran verdad sobre el DOM y falsos sobre
// la aplicación — que es exactamente la clase de verde (o de rojo) que no sirve.
//
// Medido en la primera corrida del 2026-08-10, sobre esta misma página.
const yaHabiaColindantes = $$(SEL.DESTINO).length > 0 || $$(SEL.FUERA_SOBRE).length > 0
if (yaHabiaColindantes) {
  advertencias.push(
    '⚠️ La página YA traía colindantes consultadas: este guion se ha corrido antes sin recargar. ' +
      'La mitad «sin colindantes» NO se ha medido en esta corrida. Recarga con ' +
      '`$B goto …/concretagml/?demo=real` y vuelve a lanzarlo.',
  )
}

location.hash = '#/parcela/edicion'
await esperarA(() => paso() === 'edicion', 3000)
if (paso() !== 'edicion') {
  problemas.push(`No se ha llegado a Edición: data-paso = ${JSON.stringify(paso())}.`)
}

const verticesAlEmpezar = verticesDeLaTabla().length
const tablaLimpia = caja($(SEL.TABLA))

// ── 1 · EL CASO MIXTO: se retranquea por un lado y se sale por otro ─────────
// Es lo que el defecto original hacía invisible, y lo que el autor reportó con una
// captura: rectificar un lindero NO es menguar, es menguar por un sitio y crecer
// por otro.

const lejanos = porLejania()
for (const v of lejanos.slice(0, 3)) await moverVertice(v.indice, -PASO_M)
// Y UNO hacia fuera: aquí es donde la aplicación se rendía.
const elQueSeSale = lejanos[lejanos.length - 1]
await moverVertice(elQueSeSale.indice, +PASO_M * 2)
await dormir(300)

// ── 2 · Derivar SIN colindantes ────────────────────────────────────────────

$(SEL.DERIVAR)?.click()
await esperarA(() => tieneCaja($(SEL.BLOQUE)) || texto(SEL.ESTADO_DERIVAR) !== '', 3000)
await dormir(250)

const sinVecinas = {
  bloqueVisible: tieneCaja($(SEL.BLOQUE)),
  filasSobrante: $$(SEL.FILA).length,
  seccionFuera: tieneCaja($(SEL.FUERA)),
  filasFuera: $$(SEL.FUERA_FILA).length,
  rotuloFuera: texto(SEL.FUERA_ROTULO),
  manchas: $$(SEL.MANCHA).length,
  manchasFuera: $$(SEL.MANCHA_FUERA).length,
  entregaApagada: $(SEL.ENTREGAR)?.disabled ?? null,
  motivoEntrega: texto(SEL.ESTADO_ENTREGA),
  renglonPie: texto(SEL.ESTADO_DERIVAR),
  hayDestino: $$(SEL.DESTINO).length,
}

// ⭐ EL DEFECTO ORIGINAL, EN UNA AFIRMACIÓN. Hasta el 2026-08-10 esto era 0/0/false.
if (!sinVecinas.bloqueVisible) {
  problemas.push(
    '⛔ EL DEFECTO ORIGINAL SIGUE VIVO: con la geometría saliéndose por un sitio, el bloque del ' +
      'sobrante NO se ve. Es exactamente lo que se vino a arreglar — el sobrante está medido y ' +
      'se está tirando antes de enseñarlo.',
  )
}
if (sinVecinas.filasSobrante === 0) {
  problemas.push(
    '⛔ El sobrante no lista ninguna pieza pese a haber movido tres vértices hacia dentro. ' +
      'O no se ha derivado, o se ha vuelto a esconder.',
  )
}
if (!sinVecinas.seccionFuera || sinVecinas.filasFuera === 0) {
  problemas.push(
    '⛔ La sección «Fuera del contorno oficial» no se ve o está vacía, y un vértice se ha movido ' +
      'hacia fuera a propósito. Sin ella el usuario ve un botón apagado y no sabe por qué.',
  )
}
if (sinVecinas.manchasFuera === 0) {
  problemas.push(
    '⛔ Ninguna mancha ÁMBAR en el mapa: la segunda capa (`variante: FUERA`) no está pintando. ' +
      'Las cifras del panel no se pueden localizar sobre el terreno.',
  )
}
if (!yaHabiaColindantes && sinVecinas.entregaApagada !== true) {
  problemas.push(
    '⛔ «Descargar expediente» está ENCENDIDO sin haber consultado las colindantes. No se sabe a ' +
      'quién se le quita el terreno: ese fichero volvería con IVG negativo.',
  )
}
if (!yaHabiaColindantes && sinVecinas.entregaApagada === true && !/colindantes/i.test(sinVecinas.motivoEntrega)) {
  problemas.push(
    `El botón está apagado y su motivo no dice qué hacer: «${sinVecinas.motivoEntrega}». Un botón ` +
      'gris con un motivo que no es accionable es medio error silencioso.',
  )
}
if (!yaHabiaColindantes && sinVecinas.hayDestino > 0) {
  problemas.push(
    'Hay desplegables de destino SIN colindantes consultadas: se estaría ofreciendo dárselo a ' +
      'alguien de quien no se sabe si existe.',
  )
}

// ── 3 · El precio en píxeles, con el bloque puesto ─────────────────────────

const panel = $(SEL.PANEL)
const precio = {
  tablaLimpiaPx: tablaLimpia?.alto ?? null,
  tablaConBloquePx: caja($(SEL.TABLA))?.alto ?? null,
  bloquePx: caja($(SEL.BLOQUE))?.alto ?? null,
  seccionFueraPx: caja($(SEL.FUERA))?.alto ?? null,
  desborde: panel
    ? {
        vertical: redondear(Math.max(0, panel.scrollHeight - panel.clientHeight)),
        horizontal: redondear(Math.max(0, panel.scrollWidth - panel.clientWidth)),
      }
    : null,
}
if (precio.tablaConBloquePx !== null && precio.tablaConBloquePx < SUELO_VERTICES_PX) {
  problemas.push(
    `La tabla de vértices ha quedado en ${precio.tablaConBloquePx} px, por debajo del suelo de ` +
      `${SUELO_VERTICES_PX} px (cabecera + recinto + TRES vértices). El bloque ha dejado de ser ` +
      'un añadido y es un sustituto.',
  )
}
for (const eje of ['vertical', 'horizontal']) {
  const d = precio.desborde?.[eje]
  if (d !== null && d !== undefined && d > DESBORDE_TOLERADO_PX) {
    problemas.push(
      `El panel desborda ${d} px en ${eje}. Es `.concat(
        eje === 'horizontal'
          ? '`overflow:hidden`, así que lo que sobra se RECORTA sin síntoma.'
          : 'altura que nadie ve.',
      ),
    )
  }
}

// ── 4 · Traer las colindantes (RED REAL: una petición) ─────────────────────

const botonColindantes = $(SEL.COLINDANTES)
let seTrajeron = false
if (!botonColindantes) {
  advertencias.push(
    'No hay botón «Traer colindantes» en esta pantalla: el resto del guion (reparto y apertura ' +
      'de la entrega) NO se ha podido medir.',
  )
} else if (botonColindantes.disabled) {
  advertencias.push('«Traer colindantes» está apagado: no se ha podido completar el recorrido.')
} else {
  botonColindantes.click()
  seTrajeron = await esperarA(
    () => /colindante/i.test(document.body.textContent ?? ''),
    ESPERA_CATASTRO_MS,
    200,
  )
  await dormir(600)
  if (!seTrajeron) {
    advertencias.push(
      `El Catastro no ha contestado en ${ESPERA_CATASTRO_MS} ms. NO es un fallo de la ` +
        'aplicación —puede ser la red, o el servicio— pero deja sin medir el tramo que importa.',
    )
  }
}

// ── 5 · Derivar OTRA VEZ: ahora tiene que abrirse ──────────────────────────

let conVecinas = null
if (seTrajeron) {
  $(SEL.DERIVAR)?.click()
  await dormir(700)

  conVecinas = {
    filasSobrante: $$(SEL.FILA).length,
    filasFuera: $$(SEL.FUERA_FILA).length,
    // ⭐ El renglón que dice a QUIÉN le estamos quitando terreno.
    sobreQuien: $$(SEL.FUERA_SOBRE).map((e) => e.textContent.trim()),
    // ⭐ El desplegable del reparto, que solo sale si el trozo LINDA con alguien.
    destinos: $$(SEL.DESTINO).map((s) => ({
      orden: s.dataset.orden,
      opciones: Array.from(s.options).map((o) => o.textContent.trim()),
    })),
    entregaApagada: $(SEL.ENTREGAR)?.disabled ?? null,
    motivoEntrega: texto(SEL.ESTADO_ENTREGA),
    renglonPie: texto(SEL.ESTADO_DERIVAR),
    tablaPx: caja($(SEL.TABLA))?.alto ?? null,
  }

  if (conVecinas.sobreQuien.length === 0) {
    problemas.push(
      '⛔ Con las colindantes traídas, los trozos de fuera siguen sin decir sobre quién caen. Es ' +
        'el dato que convierte «te sales 25 m²» en algo accionable.',
    )
  }
  if (conVecinas.entregaApagada !== false) {
    problemas.push(
      '⛔ «Descargar expediente» SIGUE apagado con las colindantes traídas: ' +
        `«${conVecinas.motivoEntrega}». El exceso ya está atribuido y el expediente debería ` +
        'cerrar — es la fase 3 entera lo que no estaría llegando a la pantalla.',
    )
  }
  if (conVecinas.tablaPx !== null && conVecinas.tablaPx < SUELO_VERTICES_PX) {
    problemas.push(
      `Con el reparto puesto la tabla cae a ${conVecinas.tablaPx} px, bajo el suelo de ` +
        `${SUELO_VERTICES_PX} px. Los desplegables han costado más de lo que hay.`,
    )
  }
}

// ── 5b · ⭐ LA ASTILLA DEL ENGANCHE, que tumbaba el fichero entero ──────────
//
// EL DEFECTO tal como llegó (2026-08-10, `6346726UF8664N`): al enganchar la
// medición a los linderos oficiales queda entre las dos líneas una astilla de
// milímetros. La aplicación la ofrecía MARCADA como una finca cualquiera, y el
// escritor de GML —que no le encuentra punto de referencia— se negaba a emitir el
// documento ENTERO. La pantalla lo contaba como «el expediente NO cierra sobre el
// contorno oficial» con el conjunto CERRANDO, y el autor concluyó que la
// aplicación había perdido la función.
//
// ⛔ **Esto no lo puede medir la suite**, y por dos razones distintas:
//   · el gesto es teclear un vértice con CUATRO decimales, y sólo la aplicación
//     real encadena tabla → modelo → derivación → serializador;
//   · la fila nueva trae una marca de texto larga («no se puede emitir») en un
//     flex que ya lleva número, campo de nombre y dos cifras, y el panel mide
//     ~344 px útiles. En jsdom no hay maquetación: una fila que no cabe sale VERDE.
let astilla = null
{
  // Medio milímetro HACIA DENTRO, y en un vértice que este guion **no haya movido
  // ya**: los tres primeros de `lejanos` y `elQueSeSale` están desplazados METROS,
  // así que su lindero ya no coincide con el oficial y moverlos otro medio milímetro
  // no deja astilla — solo agranda una pieza que ya existe. La astilla nace donde la
  // medición TOCA el lindero oficial, que es lo que hace el enganche.
  //
  // Se prueban varios porque la forma de la parcela decide cuál deja astilla: un
  // vértice reflejo o casi colineal puede no dejar ninguna. Bucle ACOTADO y sin
  // red: cada vuelta es teclear y volver a derivar en local.
  const tocados = new Set([...lejanos.slice(0, 3).map((v) => v.indice), elQueSeSale.indice])
  const intactos = porLejania().filter((v) => !tocados.has(v.indice))
  let movido = null
  let filasNoEmitibles = []
  const probados = []
  for (const objetivo of intactos.slice(0, 4)) {
    movido = await moverVerticeFino(objetivo.indice, -0.0005)
    await dormir(150)
    $(SEL.DERIVAR)?.click()
    await esperarA(() => $$(SEL.FILA).length > 0, 3000)
    await dormir(200)
    filasNoEmitibles = $$(SEL.FILA).filter((f) => f.querySelector(SEL.NO_EMITIBLE) !== null)
    probados.push({ indice: objetivo.indice, salioAstilla: filasNoEmitibles.length > 0 })
    if (filasNoEmitibles.length > 0) break
  }
  astilla = {
    movido: movido === null ? null : { x: redondear(movido.x, 4), y: redondear(movido.y, 4) },
    probados,
    filas: $$(SEL.FILA).length,
    conMarca: filasNoEmitibles.length,
    marcaVisible: filasNoEmitibles.length > 0 && tieneCaja(filasNoEmitibles[0].querySelector(SEL.NO_EMITIBLE)),
    // ⛔ La casilla de una fila no emitible tiene que nacer DESMARCADA.
    marcadas: filasNoEmitibles.map((f) => f.querySelector(SEL.INCLUIR)?.checked ?? null),
    contador: texto(SEL.CONTADOR),
    nota: texto(SEL.NOTA),
    entregaApagada: $(SEL.ENTREGAR)?.disabled ?? null,
    motivoEntrega: texto(SEL.ESTADO_ENTREGA),
    // El precio en píxeles: la fila más alta del bloque y lo que le queda a la tabla.
    altoFilaMax: Math.max(0, ...$$(SEL.FILA).map((f) => caja(f)?.alto ?? 0)),
    tablaPx: caja($(SEL.TABLA))?.alto ?? null,
    desbordeX: (() => {
      const p = $(SEL.PANEL)
      return p === null ? null : redondear(p.scrollWidth - p.clientWidth)
    })(),
  }

  if (astilla.conMarca === 0) {
    // No es un fallo del código con seguridad: puede que ese vértice concreto no
    // produzca astilla en esta parcela. Se dice como ADVERTENCIA para no acusar
    // de un defecto que no se ha visto (regla de oro 9).
    advertencias.push(
      'No ha salido ninguna pieza con la marca «no se puede emitir» tras mover el vértice medio ' +
        'milímetro hacia dentro, así que ese caso NO se ha ejercitado en esta corrida. Puede que ' +
        'el vértice elegido no deje astilla en esta parcela; no es prueba de que la marca falle.',
    )
  } else {
    if (astilla.marcadas.some((m) => m !== false)) {
      problemas.push(
        '⛔ Una pieza que NO se puede escribir en el fichero nace MARCADA: ' +
          `${JSON.stringify(astilla.marcadas)}. Es el defecto original —el fichero entero se cae ` +
          'por una astilla que nadie pidió declarar.',
      )
    }
    if (!astilla.marcaVisible) {
      problemas.push(
        '⛔ La marca «no se puede emitir» está en el DOM pero NO tiene caja: el usuario ve una ' +
          'casilla apagada sin explicación, que es un control gris y mudo (regla de oro 1).',
      )
    }
    if (!/no se puede emitir|no se pueden emitir/.test(astilla.nota)) {
      problemas.push(
        `⛔ La nota del bloque no explica la pieza no emitible: «${astilla.nota}». La marca de la ` +
          'fila es de una palabra; el porqué vive en la nota.',
      )
    }
    if (astilla.entregaApagada === true && /NO cierra sobre el contorno oficial/.test(astilla.motivoEntrega)) {
      problemas.push(
        '⛔ El renglón vuelve a decir «no cierra» por una astilla: ' +
          `«${astilla.motivoEntrega}». Ése es el mensaje falso que mandó al autor a buscar un ` +
          'problema de cierre inexistente.',
      )
    }
  }
  if (astilla.tablaPx !== null && astilla.tablaPx < SUELO_VERTICES_PX) {
    problemas.push(
      `Con la fila de la astilla la tabla cae a ${astilla.tablaPx} px, bajo el suelo de ` +
        `${SUELO_VERTICES_PX} px. La marca nueva ha costado más de lo que hay.`,
    )
  }
  if (astilla.desbordeX !== null && astilla.desbordeX > 0) {
    problemas.push(
      `⛔ El panel desborda ${astilla.desbordeX} px en horizontal con la marca nueva. El panel es ` +
        '`overflow:hidden`, así que eso se RECORTA EN SILENCIO.',
    )
  }
}

// ── 6 · El color del ámbar, leído del DOM y no del código ──────────────────
// Que la constante valga `#D97706` lo dice la suite. Lo que aquí se comprueba es
// que ESO llegue al SVG: un `className` mal puesto o un pane equivocado dejan la
// mancha pintada del color de la otra capa, y el ámbar es el único color con carga
// semántica del proyecto (la invasión a colindante).
const ambar = $$(SEL.MANCHA_FUERA).map((p) => (p.getAttribute('fill') ?? '').toLowerCase())
if (ambar.length > 0 && !ambar.every((c) => c === COLOR_FUERA)) {
  problemas.push(
    `Las manchas de FUERA no salen en ámbar ${COLOR_FUERA}: ${JSON.stringify(ambar)}. Ese color ` +
      'es la única excepción autorizada a la regla de oro 9 y significa invasión a colindante.',
  )
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '25-colindante-recortado',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'QUE LA SEDE ACEPTE EL FICHERO. Ningún XSD expresa las reglas del IVG, y este expediente estrena una forma que O20 no midió: dos miembros ES.SDGC.CP de OTRO TITULAR más un alta. → CHECKLIST-HUMANO.',
    'QUE MODIFICAR LA PARCELA DE UN TERCERO SEA ADMISIBLE. Es jurídico, no geométrico.',
    'EL ARRASTRE COMO GESTO DE RATÓN: el lindero se mueve TECLEANDO en la celda, como en el guion 16.',
    'QUE EL FICHERO ATERRICE EN EL DISCO: aquí no se llega a descargar, solo se comprueba que la descarga se ABRE.',
  ],
  verticesAlEmpezar,
  sinVecinas,
  precio,
  seTrajeron,
  conVecinas,
  astilla,
}
