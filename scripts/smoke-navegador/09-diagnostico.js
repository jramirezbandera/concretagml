// scripts/smoke-navegador/09-diagnostico.js — F07 · Tarea T6.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// El DIAGNÓSTICO DE ENCAJE de F07 en un navegador de verdad, y solo lo que ahí
// se puede medir. La suite ya cubre las métricas (test/diagnostico/), la vista
// (test/viewer/cajon-diagnostico.dom.test.js, test/viewer/contraste.dom.test.js),
// el cableado (test/app/diagnostico.dom.test.js) y los cuatro criterios
// (test/diagnostico/aceptacion-f07.dom.test.js); **aquí no se vuelve a medir nada
// de eso**. Se miden las cinco cosas que jsdom no puede dar:
//
//   1. **Que la diferencia simétrica SE VEA.** El sombreado sale del
//      `fillRule: 'evenodd'` por defecto de Leaflet sobre UN solo
//      `L.polygon([anillos medidos, anillos oficiales])` (verificado en el fuente,
//      `leaflet-src.js:8159`). Aquí se comprueba sobre el SVG REAL que el
//      renderizador produce: el `<path>` de la diferencia existe, lleva
//      `fill-rule="evenodd"` aplicado, contiene los DOS anillos como subtrazados
//      (dos comandos `M` en su `d`) y tiene relleno con opacidad > 0. Lo que un
//      humano confirma encima —que la mancha se LEE como «la diferencia»— es del
//      checklist (§8); la captura final queda para eso.
//   2. **Que el cajón no tape el mapa ni empuje nada**: `getBoundingClientRect`
//      real del cajón contra el del mapa, y el tamaño del mapa ANTES y DESPUÉS de
//      abrir (un control de Leaflet flota; si el mapa cambiara de tamaño, algo se
//      habría empujado). Y cuánto lienzo tapa, como número sin juicio.
//   3. **Que la banda del margen mantenga su anchura en METROS al cambiar el
//      zoom**: el trazo se recalcula en `zoomend` (ancho px = metros × escala), y
//      eso solo significa algo con una proyección real. Se mide el `stroke-width`
//      a dos escalas MEDIDAS y se exige que px/escala (o sea, los metros) se
//      conserve.
//   4. **Cuánto tarda el recálculo completo por operación** sobre la parcela real
//      CON sus vecinas: intersección contra el oficial y contra cada colindante
//      más ~570 muestras de desviación. El recálculo corre SÍNCRONO dentro del
//      `set` del store (app/cableado-diagnostico.js: por `subscribe`, nunca por
//      `alPrevisualizar`), así que el tiempo se mide alrededor del gesto que lo
//      dispara. Es MEDIDA, no aceptación: se publica sin umbral.
//   5. **El presupuesto de altura del panel, HEREDADO de `08-edicion.js` (§10)**:
//      aquel apartado dejó escrito que «el siguiente bloque que entre (F07 mete el
//      suyo de diagnóstico) puede volver a comérsela». F07 decidió NO meter ningún
//      bloque (Decisión 1: cajón flotante sobre el mapa) y este guion lo demuestra
//      en DOS medidas: la caja arranca en ~267 px con los avisos vacíos —los ~36 px
//      que faltan hasta los 303 de F06 son el CTA del pie, el único coste de F07
//      en el panel y deliberado (index.html lo razona)— y **abrir el cajón no le
//      quita NADA** (medido: 172 → 172 px en el tick del clic).
//
// Y de propina, la regla de oro 9 con el DOM de verdad: el texto completo del
// cajón pintado se escanea contra las palabras de veredicto, igual que hace la
// suite de aceptación, pero sobre lo que el navegador realmente muestra.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//
//   · **NO muestrea píxeles del relleno.** El renderizador es SVG: no hay
//     `getImageData` sobre un `<path>`, y las capas van `interactive: false`
//     (adrede: no roban clics a los vértices de F06), así que tampoco
//     `elementFromPoint` puede palparlas. Se afirma el MECANISMO completo
//     (path + fill-rule + subtrazados + opacidad) y la lectura visual queda en
//     la captura y en el checklist §8.
//   · **NO decide si once filas bastan, ni si el cajón estorba sobre la
//     ortofoto, ni si la sombra se ENTIENDE sin leyenda.** Publica números
//     (regla de oro 9); el juicio es del checklist §8.
//   · **NO mide gestos de ratón.** Los clics son `el.click()` y la edición se
//     teclea en la celda (gesto de F06, un `set` por `change`): eventos
//     sintéticos, como en `03` y `08` (§0 del GUION).
//   · **NO mide la consola.** `$B console --errors` al terminar (§6).
//   · **NO fija las invasiones esperadas a tres refcats concretas.** Contra el
//     servicio VIVO los datos pueden cambiar (la suite las fija sobre fixtures
//     congelados: 0,23 / 0,25 / 2,64 m² el 2026-07-29). Aquí se exige la FORMA:
//     tras barrer el triángulo hacia fuera hay ≥ 1 invasión, cada una nombra una
//     referencia de 14 caracteres y da sus m², y el ámbar aparece SOLO ahí.
//
// ── RÉGIMEN DE RED: COMO `07`, PORQUE TOCA EL SERVICIO REAL ─────────────────
// UNA pasada, SIN bucles, y como mucho DOS peticiones de datos (override O8):
//
//   · «Traer del Catastro» (GetParcel) — 0 si la caché de IndexedDB de una
//     corrida anterior sigue dentro del TTL, 1 si no.
//   · La apertura del cajón pide colindantes (GetNeighbourParcel) — UNA vez
//     (una pulsación, una petición). Si ya las trajo `07` u otro gesto en esta
//     misma página, CERO.
//
// Las dos se CUENTAN por Resource Timing y salen en el veredicto. Si la red
// falla, el guion lo dice (`red.servicioRespondio: false`), NO reintenta, y las
// métricas que no dependen de ella se miden igual — que es exactamente lo que
// hace la app. Léete `GUION.md` §13 antes de lanzarlo.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Página recién cargada (el guion lo comprueba), `$B eval` desde la raíz:
//
//   $B viewport 1440x900
//   $B goto http://localhost:PUERTO/concretagml/
//   $B wait ".gml-tabla-vertices"
//   $B console --clear
//   $B eval scripts/smoke-navegador/09-diagnostico.js
//   $B console --errors
//   $B screenshot .gstack/smoke-f07.png     # la evidencia visual del §8
//
// ⚠️ Deja la geometría MODIFICADA (el vértice 1 del exterior, 0,40 m al Este) y
// el cajón ABIERTO a propósito, para que la captura enseñe la sombra, el ámbar y
// la cota. No lo encadenes antes de `02` (zoom) ni de `06` (areaValue).
// Para repetirlo: `$B reload && $B wait ".gml-tabla-vertices"`.
//
// ⚠️ NO envuelvas este fichero en una IIFE: `browse` ya lo envuelve ÉL en
// `(async()=>{ … })()` — por eso los `await` y el `return` de nivel superior son
// legales (igual que en `07-catastro-vivo.js`, que lo documenta). Con una IIFE
// propia, el `eval` devuelve una promesa que nadie espera y el veredicto se
// pierde EN SILENCIO mientras los efectos (clics, peticiones) sí ocurren —
// medido: es exactamente lo que pasó en la primera corrida de este guion.
// Consecuencia: `node --check` falla con «Illegal return statement», y es normal.

const t0 = performance.now()
const TOPE_TOTAL_MS = 120000
const agotado = () => performance.now() - t0 > TOPE_TOTAL_MS

const problemas = []
const advertencias = []

// El búfer de Resource Timing nace en 250 entradas y las teselas lo llenan:
// desbordado, la cuenta de peticiones de datos saldría corta SIN síntoma (la
// misma trampa que `07` declara con `bufferQuizaDesbordado`). Se amplía ANTES
// de contar nada, y si ya venía lleno se dice.
if (performance.getEntriesByType('resource').length >= 250) {
  advertencias.push(
    'El búfer de Resource Timing ya estaba lleno al empezar: la cuenta de peticiones de datos ' +
      'puede quedarse corta. Repite con la página recién cargada.',
  )
}
performance.setResourceTimingBufferSize(2000)

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const redondear = (v, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d)
const texto = (sel) => ($(sel) === null ? null : $(sel).textContent.trim())

/** «1.535,87 m²» → 1535.87. Devuelve null si no hay número que leer. */
const leerNumero = (t) => {
  if (!t) return null
  const m = /-?[\d.]+(?:,\d+)?/.exec(t.replace('−', '-'))
  return m === null ? null : Number(m[0].replace(/\./g, '').replace(',', '.'))
}

/** Espera activa hasta que `condicion()` sea verdad o venza el plazo. */
async function esperar(condicion, ms, etiqueta) {
  const limite = performance.now() + ms
  while (performance.now() < limite) {
    if (condicion()) return true
    await new Promise((r) => setTimeout(r, 120))
  }
  advertencias.push(`Plazo agotado (${ms} ms) esperando: ${etiqueta}.`)
  return false
}

/** Teclea un valor en un input y TERMINA la edición (change, como el usuario). */
function teclear(input, valor) {
  input.value = valor
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Escala del mapa en px/m, SIN tocar las tripas de Leaflet: el diámetro en
 * píxeles del anillo (la pareja de marcadores de vértice más separada) entre su
 * diámetro en metros (la pareja de filas de la tabla más separada). Una
 * proyección conforme a escala de parcela es una semejanza, así que la pareja
 * que maximiza una distancia maximiza la otra: no hace falta emparejar marcador
 * con fila. Los marcadores de vértice se distinguen de las cotas (que también
 * son `leaflet-marker-icon`, vía `divIcon`) porque solo ellos llevan `title`.
 */
function escala() {
  const iconos = $$('.leaflet-marker-icon[title]').map((el) => {
    const r = el.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  })
  const filas = $$('#tabla-vertices tr[data-recinto="0"][data-indice]').map((tr) => [
    Number(tr.querySelector('input[data-eje="x"]').value.replace(',', '.')),
    Number(tr.querySelector('input[data-eje="y"]').value.replace(',', '.')),
  ])
  const diametro = (puntos) => {
    let max = 0
    for (let i = 0; i < puntos.length; i++)
      for (let j = i + 1; j < puntos.length; j++)
        max = Math.max(max, Math.hypot(puntos[i][0] - puntos[j][0], puntos[i][1] - puntos[j][1]))
    return max
  }
  const px = diametro(iconos)
  const m = diametro(filas)
  return px > 0 && m > 0 ? px / m : null
}

/** Peticiones a los servicios de DATOS del Catastro vistas por Resource Timing. */
const peticionesDeDatos = () => {
  const entradas = performance.getEntriesByType('resource').map((e) => e.name)
  return {
    getParcel: entradas.filter((u) => u.includes('wfsCP') && !u.includes('Neighbour')).length,
    getNeighbour: entradas.filter((u) => u.includes('GetNeighbourParcel')).length,
  }
}

/** Palabras que convertirían el cajón en un dictamen (regla de oro 9). */
const PALABRA_VEREDICTO =
  /\b(apt[oa]s?|correct[oa]s?|v[áa]lid[oa]s?|aprobad[oa]s?|cumple|supera|admisible|semáforo|semaforo|umbral|toleranci\w*|dentro del margen)\b/i

// ── 1 · Página recién cargada, con la parcela de demostración ───────────────

const filasDeTabla = () => $$('#tabla-vertices tr[data-recinto="0"][data-indice]').length
const superficieFichaArranque = leerNumero(texto('[data-ficha="superficie"]'))

/** Alto de la caja de vértices, la cifra que este guion HEREDA de 08 §10. */
const altoCajaVertices = () => {
  const caja = $('#tabla-vertices')
  return caja === null ? null : Math.round(caja.getBoundingClientRect().height)
}
const tarjetasDeAvisos = () => $$('#avisos .gml-aviso').length

const paginaRecienCargada =
  filasDeTabla() === 15 && superficieFichaArranque !== null && Math.abs(superficieFichaArranque - 1535.87) < 0.02
if (!paginaRecienCargada) {
  problemas.push(
    `La página no está recién cargada sobre la parcela real (${filasDeTabla()} filas, ` +
      `superficie ${JSON.stringify(texto('[data-ficha="superficie"]'))}): las medidas de este ` +
      'guion suponen el dataset de arranque. `$B reload` y vuelve a lanzarlo.',
  )
}

const boton = $('[data-accion="diagnosticar"]')
const renglonCta = $('[data-estado="diagnosticar"]')
const cajonEl = $('.gml-cajon-diagnostico')
if (boton === null || renglonCta === null || cajonEl === null) {
  return {
    guion: '09-diagnostico',
    ok: false,
    problemas: [
      'Falta el CTA `[data-accion="diagnosticar"]`, su renglón o el cajón ' +
        '`.gml-cajon-diagnostico`: F07 no está montada en esta página.',
    ],
  }
}

const arranque = {
  filas: filasDeTabla(),
  superficieFicha: superficieFichaArranque,
  ctaHabilitado: !boton.disabled,
  renglonCta: renglonCta.textContent,
  cajonCerrado: getComputedStyle(cajonEl).display === 'none',
  pxPorMetro: redondear(escala(), 4),
  // La herencia de 08 §10, medida en el MISMO estado que allí (página recién
  // cargada, lista de avisos vacía). F06 dejó la caja en ~303 px; con F07 arranca
  // en ~267 (MEDIDO): los ~36 px son el CTA del pie, no un bloque.
  altoCajaVerticesPx: altoCajaVertices(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
}
// La cifra de referencia YA NO ES 303: es ~267 px (MEDIDO 2026-07-29). Los ~36 px
// de diferencia son el CTA «Diagnosticar encaje» del pie —debajo de «Generar GML»,
// con sus razones en index.html—, que es el único coste de F07 en el panel y es
// deliberado. El guardián no vigila ese precio (lo juzga el checklist §8): vigila
// que no vuelva un BLOQUE de los de 150-270 px, que es lo que dejaría la tabla
// como en el diagnóstico de F06 (64 px).
if (arranque.tarjetasDeAvisos === 0 && arranque.altoCajaVerticesPx !== null && arranque.altoCajaVerticesPx < 220) {
  problemas.push(
    `La caja de vértices arranca en ${arranque.altoCajaVerticesPx} px con la lista de avisos ` +
      'vacía (referencia medida: ~267 px): algo del tamaño de un BLOQUE ha entrado en el panel, ' +
      'y no es el cajón (todavía no se ha abierto).',
  )
}
// La parcela de demostración TRAE `geometriaOficial` (es el estado de una
// parcela recién traída), así que el CTA tiene que estar ya encendido y mudo.
if (!arranque.ctaHabilitado) {
  problemas.push(
    `El CTA nace apagado con motivo ${JSON.stringify(arranque.renglonCta)}, y la parcela de ` +
      'demostración SÍ trae contorno oficial: o el cableado no está montado o la habilitación se rompió.',
  )
}
if (!arranque.cajonCerrado) problemas.push('El cajón está abierto antes de pulsar nada.')

// ── 2 · La parcela REAL del WFS (para que el contraste tenga las dos cifras) ─
//
// La demo no porta `superficieCatastral` (la declarada solo la trae F05), así
// que sin este paso la tabla a tres bandas diría «No consta» en su banda
// central. Es el recorrido del plan: «trae 9398516VK3799G, pulsa Diagnosticar».

const antesDeCargar = peticionesDeDatos()
const refcat = texto('[data-ficha="refcat"]')
teclear($('[data-campo="refcat"]'), refcat)
$('[data-accion="cargar-catastro"]').click()
const parcelaDelWfs = await esperar(
  () => /cargada/i.test(texto('[data-estado="cargar-catastro"]') || ''),
  15000,
  'que «Traer del Catastro» termine (¿hay red?)',
)
const trasCargar = peticionesDeDatos()

const catastralFicha = leerNumero(texto('[data-ficha="superficie-catastral"]'))
if (parcelaDelWfs && catastralFicha === null) {
  problemas.push('La parcela ha cargado pero la ficha no enseña la superficie catastral declarada.')
}
if (!parcelaDelWfs) {
  advertencias.push(
    'Sin parcela del WFS: se sigue con la de demostración. La banda catastral y el titular ' +
      'con las dos cifras quedan sin medir en esta corrida; las métricas geométricas se miden igual.',
  )
}

// ── 3 · Abrir el cajón: flota, no empuja, y habla en descriptivo ────────────

const mapaEl = document.getElementById('mapa')
const mapaAntes = { ancho: mapaEl.clientWidth, alto: mapaEl.clientHeight }
// La otra mitad de la Decisión 1: se mide la caja de vértices JUSTO antes de
// abrir, con los avisos que haya, para compararla después CON EL MISMO estado de
// avisos. La cifra absoluta depende de cuántas tarjetas haya (cargar la parcela
// puede añadir una); la promesa de F07 es el DELTA: abrir el cajón no roba nada.
// ⚠️ Con una excepción LEGÍTIMA que hay que descontar: el renglón de estado del
// CTA nace vacío (`:empty{display:none}`, 0 px) y al abrir HABLA (regla de oro
// 1), así que su altura nueva sale del mismo presupuesto. Lo que se prohíbe es
// perder más que eso.
const cajaAntesDeAbrir = altoCajaVertices()
const renglonCtaAltoAntes = Math.round(renglonCta.getBoundingClientRect().height)

boton.click()
// El invariante se mide AQUÍ, en el mismo tick del clic, antes de ningún otro
// gesto: más adelante la edición hace hablar a OTROS renglones del pie (el de
// «Generar GML», el propio panel de avisos) y el delta dejaría de atribuirse al
// cajón. Medido: el guion llegó a acusar al cajón de 11 px que eran de eso.
const cajaTrasAbrir = altoCajaVertices()
const renglonCtaCrecioPx = Math.max(
  0,
  Math.round(renglonCta.getBoundingClientRect().height) - renglonCtaAltoAntes,
)
const abrirNoRoboAltura =
  cajaTrasAbrir !== null &&
  cajaAntesDeAbrir !== null &&
  cajaAntesDeAbrir - cajaTrasAbrir <= renglonCtaCrecioPx + 2

const abierto = getComputedStyle(cajonEl).display !== 'none'
if (!abierto) problemas.push('Pulsar el CTA no ha abierto el cajón.')

const rectMapa = mapaEl.getBoundingClientRect()
const rectCajon = cajonEl.getBoundingClientRect()
const cajon = {
  abierto,
  rect: { ancho: Math.round(rectCajon.width), alto: Math.round(rectCajon.height) },
  dentroDelMapa:
    rectCajon.left >= rectMapa.left - 1 &&
    rectCajon.right <= rectMapa.right + 1 &&
    rectCajon.top >= rectMapa.top - 1 &&
    rectCajon.bottom <= rectMapa.bottom + 1,
  porcentajeDelLienzo: redondear(((rectCajon.width * rectCajon.height) / (rectMapa.width * rectMapa.height)) * 100, 1),
  mapaIntacto: mapaEl.clientWidth === mapaAntes.ancho && mapaEl.clientHeight === mapaAntes.alto,
  titular: texto('[data-diag="titular"]'),
}
if (!cajon.dentroDelMapa) {
  problemas.push('El cajón se sale del lienzo del mapa: no es un control que FLOTA, está empujando algo.')
}
if (!cajon.mapaIntacto) {
  problemas.push(
    `Abrir el cajón ha cambiado el tamaño del mapa (${mapaAntes.ancho}×${mapaAntes.alto} → ` +
      `${mapaEl.clientWidth}×${mapaEl.clientHeight}): la Decisión 1 era que el mapa no pierde ni un píxel.`,
  )
}
if (!/^Contraste con el parcelario/.test(cajon.titular || '')) {
  problemas.push(
    `El titular no es el descriptivo del contrato: ${JSON.stringify(cajon.titular)} (regla de oro 9).`,
  )
}

// ── 4 · Las colindantes: una pulsación, una petición ────────────────────────

const textoInvasion = () => texto('[data-diag="invasion"]') || ''
const servicioRespondio = await esperar(
  () => !/no se ha consultado/i.test(textoInvasion()),
  12000,
  'las colindantes del WFS (GetNeighbourParcel)',
)
const trasVecinas = peticionesDeDatos()
const red = {
  parcelaDelWfs,
  servicioRespondio,
  peticionesGetParcel: trasCargar.getParcel - antesDeCargar.getParcel,
  peticionesGetNeighbour: trasVecinas.getNeighbour,
  nota:
    'GetParcel puede ser 0 con la caché de IndexedDB dentro del TTL; GetNeighbourParcel debe ser ' +
    '≤ 1 — una pulsación, una petición (override O8).',
}
if (red.peticionesGetNeighbour > 1) {
  problemas.push(
    `${red.peticionesGetNeighbour} peticiones GetNeighbourParcel: el régimen del override O8 es ` +
      'UNA por apertura, y aquí solo se ha abierto una vez.',
  )
}
if (!servicioRespondio && /ninguna/i.test(textoInvasion())) {
  problemas.push(
    'Sin respuesta del servicio, la sección de invasión dice «ninguna»: la afirmación ' +
      'tranquilizadora y falsa que el diseño prohíbe («no se ha consultado» ≠ «no hay»).',
  )
}

// ── 5 · La tabla a tres bandas, tecleando de verdad ─────────────────────────

const registralInput = cajonEl.querySelector('[data-campo="superficie-registral"]')
const filasCruces = () => [...cajonEl.querySelectorAll('[data-diag="cruces"] tbody tr')]

const tRegistral = performance.now()
teclear(registralInput, '1500')
const registralRecalculoMs = redondear(performance.now() - tRegistral, 1)

const cruces = filasCruces().map((tr) => tr.textContent.trim())
const bandas = {
  filas: cruces.length,
  textos: cruces,
  registralRecalculoMs,
  conSigno: cruces.some((t) => t.includes('+')) && (!parcelaDelWfs || cruces.some((t) => t.includes('−'))),
}
if (cruces.length !== 3) {
  problemas.push(`La tabla de cruces tiene ${cruces.length} filas y el contrato son SIEMPRE tres pares.`)
}
if (!bandas.conSigno) {
  problemas.push(
    'Los cruces no enseñan el signo: con la registral en 1.500 la parcela real da diferencias en ' +
      'los dos sentidos, y el signo es el dato.',
  )
}
teclear(registralInput, '')
const noConsta = filasCruces().filter((tr) => tr.textContent.includes('No consta')).length
if (noConsta < 2) {
  problemas.push(
    `Al borrar la registral solo ${noConsta} filas dicen «No consta»: los dos pares que la usan ` +
      'tienen que volver a «no hay con qué comparar», nunca a 0.',
  )
}
teclear(registralInput, '1500') // se queda puesta para la captura

// ── 6 · La edición que enciende TODO el contraste (+0,40 m al Este) ─────────
//
// Teclear en la celda es un gesto de F06 (un `set` por `change`) y es el caso
// MEDIDO de la suite: el vértice 1 del exterior tiene los dos lados contiguos
// largos, así que 0,40 m barren un triángulo hacia fuera que cruza linderos de
// colindantes de verdad. El tiempo alrededor del `dispatch` ES el recálculo
// completo: el suscriptor corre síncrono dentro del `set`.

const celdaX = $('#tabla-vertices tr[data-recinto="0"][data-indice="0"] input[data-eje="x"]')
const xAntes = Number(celdaX.value.replace(',', '.'))
const tEdicion = performance.now()
teclear(celdaX, String(xAntes + 0.4).replace('.', ','))
const recalculoMs = redondear(performance.now() - tEdicion, 1)

const desviacionTexto = texto('[data-diag="desviacion"]')
const contraste = {
  recalculoCompletoMs: recalculoMs,
  desviacion: desviacionTexto,
  desviacionAtribuida: /0,40\s*m/.test(desviacionTexto || '') && /lindero\s*1\b/.test(desviacionTexto || ''),
}
if (!contraste.desviacionAtribuida) {
  problemas.push(
    `La desviación no dice «0,40 m · lindero 1» sino ${JSON.stringify(desviacionTexto)}: o la ` +
      'cifra o la ATRIBUCIÓN al lado movido (lo que §10.5 resalta) se han perdido.',
  )
}

// La invasión, si el servicio respondió: forma, no cifras congeladas (ver cabecera).
const invasion = { texto: textoInvasion(), parcelas: [], ambarSoloEnLaInvasion: true }
if (servicioRespondio) {
  const items = [...cajonEl.querySelectorAll('[data-diag="invasion"] li')].map((li) => li.textContent.trim())
  invasion.parcelas = items
  if (items.length === 0) {
    problemas.push(
      'Tras barrer 0,40 m hacia fuera no aparece NINGUNA invasión: sobre esta parcela el caso ' +
        'medido invade a tres colindantes (0,23 / 0,25 / 2,64 m² el 2026-07-29).',
    )
  }
  for (const item of items) {
    if (!/^[0-9A-Z]{14}: .*m²$/.test(item)) {
      problemas.push(
        `Una invasión sin parcela afectada o sin m²: ${JSON.stringify(item)} (criterio 3: binaria, ` +
          'con área y parcela afectada).',
      )
    }
  }
}

// El ámbar (#92400E → rgb(146, 64, 14)) SOLO dentro de la sección de invasión.
const AMBAR = /rgb\(\s*146\s*,\s*64\s*,\s*14\s*\)|#92400e/i
let ambares = 0
for (const el of cajonEl.querySelectorAll('*')) {
  if (!AMBAR.test(el.style.color || '')) continue
  ambares += 1
  if (el.closest('[data-diag="invasion"]') === null) {
    invasion.ambarSoloEnLaInvasion = false
    problemas.push('Hay ámbar fuera de la sección de invasión: la única excepción de la regla 9 se ha extendido.')
  }
}
if (servicioRespondio && invasion.parcelas.length > 0 && ambares === 0) {
  problemas.push('Con invasiones pintadas no hay ni un nodo ámbar: la única señal autorizada no se ve.')
}

// La regla de oro 9, sobre lo que el navegador REALMENTE muestra.
const textoCajon = cajonEl.textContent
const regla9 = {
  caracteresEscaneados: textoCajon.length,
  palabraDeVeredicto: PALABRA_VEREDICTO.test(textoCajon),
}
if (regla9.palabraDeVeredicto) {
  problemas.push(
    `El cajón contiene una palabra de veredicto: ${JSON.stringify(PALABRA_VEREDICTO.exec(textoCajon)[0])} (regla de oro 9).`,
  )
}

// El SVG de la diferencia simétrica: el mecanismo, medido sobre el DOM real.
const pane = document.querySelector('.leaflet-diagnostico-pane, .leaflet-pane[class*="diagnostico"]')
const pathsPane = pane === null ? [] : [...pane.querySelectorAll('path')]
const pathDiferencia = pathsPane.find(
  (p) => (p.getAttribute('fill-rule') || '').toLowerCase() === 'evenodd' && (p.getAttribute('d') || '').split('M').length - 1 >= 2,
)
const diferencia = {
  pathsEnElPane: pathsPane.length,
  encontrada: pathDiferencia !== undefined,
  subtrazados: pathDiferencia ? (pathDiferencia.getAttribute('d') || '').split('M').length - 1 : 0,
  fillRule: pathDiferencia ? pathDiferencia.getAttribute('fill-rule') : null,
  conRelleno: pathDiferencia ? Number(pathDiferencia.getAttribute('fill-opacity') || '1') > 0 : false,
  interactivas: pathsPane.filter((p) => p.classList.contains('leaflet-interactive')).length,
}
if (!diferencia.encontrada || !diferencia.conRelleno) {
  problemas.push(
    'No hay en el pane del diagnóstico un <path> con fill-rule="evenodd", dos subtrazados y ' +
      'relleno: la diferencia sombreada de §10.5 no se está dibujando por el mecanismo verificado.',
  )
}
if (diferencia.interactivas > 0) {
  problemas.push(
    `${diferencia.interactivas} trazado(s) del diagnóstico son interactivos: robarían el clic a ` +
      'los linderos y el arrastre a los vértices de F06 (todo debe ir interactive:false).',
  )
}

// ── 7 · La banda del margen conserva sus METROS al cambiar el zoom ──────────
//
// Se compara Z contra Z−2 (alejando): al ACERCAR el ancho en px crece hasta el
// tope de seguridad de la capa (40 px) y la invariancia deja de ser lineal a
// propósito; alejando no hay tope que interfiera.

// SIEMPRE consulta FRESCA del DOM: el repintado de `zoomend` LIMPIA las capas y
// crea paths nuevos, así que una lista capturada antes del zoom contiene el path
// VIEJO, desprendido y con el stroke-width de la escala anterior. Medido en la
// primera corrida de este guion: la banda «no cambiaba» porque se estaba midiendo
// el pasado.
const bandaDe = () => (pane === null ? [] : [...pane.querySelectorAll('path')]).find(
  (p) => (p.getAttribute('stroke-dasharray') || '').replace(/\s/g, '') === '2,6' ||
         (p.getAttribute('stroke-dasharray') || '').replace(/\s/g, '') === '26',
)
let banda = { encontrada: false }
const banda0 = bandaDe()
if (banda0 === undefined) {
  advertencias.push(
    'No se ha encontrado el trazo discontinuo de la banda del margen (¿sin clase de suelo ' +
      'deducible?): su invariancia con el zoom queda sin medir en esta corrida.',
  )
} else {
  // UN solo nivel de zoom basta para la invariancia (los metros no saben de
  // niveles), y evita la trampa medida en la primera corrida: un clic sobre el
  // control DURANTE la animación del zoom anterior se pierde sin síntoma. Tras
  // la condición de escala se deja ASENTAR la animación (350 ms > los 250 ms de
  // la transición de Leaflet) para que `zoomend` —y con él el repintado de la
  // banda— haya corrido de verdad antes de medir.
  const e0 = escala()
  const w0 = Number(banda0.getAttribute('stroke-width'))
  $('.leaflet-control-zoom-out').click()
  await esperar(() => escala() !== null && escala() < e0 * 0.7, 4000, 'el zoom out de la banda')
  await new Promise((r) => setTimeout(r, 350))
  const e1 = escala()
  const banda1 = bandaDe()
  const w1 = banda1 === undefined ? null : Number(banda1.getAttribute('stroke-width'))
  const metros0 = w0 / e0
  const metros1 = w1 === null ? null : w1 / e1
  banda = {
    encontrada: true,
    pxEnZ: redondear(w0, 2),
    pxTrasZoomOut: redondear(w1, 2),
    escalaZ: redondear(e0, 3),
    escalaTrasZoomOut: redondear(e1, 3),
    metrosEnZ: redondear(metros0, 3),
    metrosTrasZoomOut: metros1 === null ? null : redondear(metros1, 3),
    anchuraConstanteEnMetros: metros1 !== null && Math.abs(metros1 - metros0) / metros0 < 0.15,
  }
  if (!banda.anchuraConstanteEnMetros) {
    problemas.push(
      `La banda del margen no conserva sus metros al alejar el zoom (${banda.metrosEnZ} → ` +
        `${banda.metrosTrasZoomOut} m): el repintado en zoomend no está funcionando.`,
    )
  }
  // Y se deshace el zoom, que envenenaría cualquier medida posterior.
  $('.leaflet-control-zoom-in').click()
  await esperar(() => escala() !== null && Math.abs(escala() - e0) / e0 < 0.02, 4000, 'volver al zoom de arranque')
  await new Promise((r) => setTimeout(r, 350))
}

// ── 8 · El presupuesto de altura, heredado de 08-edicion.js §10 ─────────────
//
// MEDIDA, no juicio. `08` dejó escrito que el siguiente bloque del panel podía
// volver a comerse la caja de vértices; F07 decidió no meter ninguno, y esto es
// la comprobación: la caja se mide CON el cajón abierto.

const filaCualquiera = $('#tabla-vertices tr[data-indice]')
const cabeceraTabla = $('#tabla-vertices thead')
const altoCaja = altoCajaVertices()
const altoFila = filaCualquiera === null ? null : filaCualquiera.getBoundingClientRect().height
const altoCabecera = cabeceraTabla === null ? 0 : cabeceraTabla.getBoundingClientRect().height

const panel = {
  queEs: 'MEDIDA de layout real, sin juicio (regla de oro 9).',
  // El estado FINAL del guion (tras editar, teclear y el zoom de la banda): la
  // cifra informativa que hereda de 08 §10, con sus tarjetas al lado.
  altoCajaVerticesAlFinalPx: altoCaja,
  // LA prueba de la Decisión 1: los tres números del instante de abrir, con el
  // renglón del CTA descontado si habló. Calculados arriba, en el tick del clic.
  altoAntesDeAbrirPx: cajaAntesDeAbrir,
  altoTrasAbrirPx: cajaTrasAbrir,
  renglonCtaCrecioPx,
  abrirNoRoboAltura,
  renglonesBajoLaCabecera: altoCaja && altoFila ? redondear((altoCaja - altoCabecera) / altoFila, 1) : null,
  tarjetasDeAvisos: tarjetasDeAvisos(),
  altoBloqueEdicionPx: (() => {
    const bloque = $('.gml-bloque--edicion')
    return bloque === null ? null : Math.round(bloque.getBoundingClientRect().height)
  })(),
  bloqueDiagnosticoEnElPanel: $('.gml-bloque--diagnostico') !== null,
}
if (panel.bloqueDiagnosticoEnElPanel) {
  problemas.push(
    'Hay un `.gml-bloque--diagnostico` en el panel: la Decisión 1 de F07 era exactamente que ese ' +
      'bloque NO existiera (el cajón flota sobre el mapa).',
  )
}
if (!panel.abrirNoRoboAltura) {
  problemas.push(
    `Abrir el cajón le ha quitado altura a la caja de vértices (${panel.altoAntesDeAbrirPx} → ` +
      `${panel.altoTrasAbrirPx} px en el mismo tick del clic, y el renglón del CTA solo explica ` +
      `${panel.renglonCtaCrecioPx} px): la Decisión 1 de F07 está incumplida.`,
  )
}

// ── 9 · Cerrar limpia; reabrir para la captura ──────────────────────────────

cajonEl.querySelector('[data-accion="cerrar-diagnostico"]').click()
const cierre = {
  cajonOculto: getComputedStyle(cajonEl).display === 'none',
  paneLimpio: pane === null ? null : pane.querySelectorAll('path').length === 0,
}
if (!cierre.cajonOculto) problemas.push('El botón ✕ no cierra el cajón.')
if (cierre.paneLimpio === false) {
  problemas.push(
    'Cerrar el cajón no limpia el mapa: una anotación sin su explicación al lado no se deja puesta.',
  )
}
boton.click() // reabierto para `$B screenshot`: la petición de vecinas NO se repite (ya están)
const reapertura = peticionesDeDatos()
if (reapertura.getNeighbour > red.peticionesGetNeighbour) {
  problemas.push('Reabrir el cajón ha vuelto a pedir colindantes: tenía que adoptar las que ya llegaron.')
}

if (agotado()) {
  advertencias.push(`Presupuesto de tiempo agotado (${TOPE_TOTAL_MS} ms): repite con la página recién cargada.`)
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '09-diagnostico',
  feature: 'F07',
  tarea: 'T6.2',
  criterios: [1, 2, 3, 4],
  url: location.href,
  ok: problemas.length === 0,
  esGestoDeRatonReal: false,
  aviso:
    'Clics y tecleos SINTÉTICOS en navegador real (layout, CSS, proyección y SVG reales). La ' +
    'lectura visual —si la sombra se ENTIENDE, si el cajón estorba, si algo se lee como un ' +
    'veredicto— es del checklist humano §8; este guion deja la pantalla preparada para la captura.',
  duracionMs: redondear(performance.now() - t0, 0),
  arranque,
  red,
  cajon,
  bandas,
  contraste,
  invasion,
  regla9,
  diferencia,
  banda,
  panel,
  cierre,
  problemas,
  advertencias,
}
