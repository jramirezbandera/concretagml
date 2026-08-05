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
//   2. **Que el diagnóstico esté en la COLUMNA y no encima del mapa**:
//      `getBoundingClientRect` real del contenedor contra el del panel y contra el
//      del lienzo, más el tamaño del mapa ANTES y DESPUÉS de abrir.
//
//      ⛔ HASTA EL 2026-08-05 ESTE PUNTO DECÍA LO CONTRARIO —«que el cajón no tape
//      el mapa ni empuje nada», medido exigiendo que estuviera DENTRO del lienzo—
//      y era correcto mientras el diagnóstico fue un control flotante de Leaflet.
//      El autor pidió lo otro: las cifras en la columna izquierda, sustituyendo a
//      la tabla de vértices, porque una ventana flotante tapaba justo las manchas
//      y la cota que esas cifras señalan. Ahora se exige lo simétrico: dentro del
//      panel Y ni un píxel sobre el mapa.
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
//      suyo de diagnóstico) puede volver a comérsela».
//
//      ⛔ Y ACABÓ ENTRANDO, el 2026-08-05, después de que el rework (T6) partiera
//      el panel por pasos: en Diagnóstico ya no hay tabla de vértices que comerse.
//      Así que la comparación «abrir el cajón no le quita NADA a la caja» dejó de
//      ser medible —el antes y el después son pantallas distintas— y la sustituye
//      el presupuesto que de verdad importaba: **el panel no desborda (ni a lo
//      alto ni a lo ancho) y su pie cabe entero**. Es el mismo riesgo con otra
//      cara: `.gml-panel` es `overflow:hidden`, así que lo que no cabe no
//      scrollea, se recorta y no avisa.
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

const abierto = getComputedStyle(cajonEl).display !== 'none'
if (!abierto) problemas.push('Pulsar el CTA no ha abierto el cajón.')

const rectMapa = mapaEl.getBoundingClientRect()
const rectCajon = cajonEl.getBoundingClientRect()
const panelEl = $('.gml-panel')
const rectPanel = panelEl === null ? null : panelEl.getBoundingClientRect()
const cajon = {
  abierto,
  rect: { ancho: Math.round(rectCajon.width), alto: Math.round(rectCajon.height) },
  // ── ⛔ ESTO MEDÍA `dentroDelMapa` HASTA EL 2026-08-05 ──────────────────────
  // Y era el invariante correcto mientras el diagnóstico fue un control flotante
  // de Leaflet. **Ya no lo es**: el autor pidió que el contraste ocupara la
  // columna izquierda en vez de tapar el mapa, así que ahora el contenedor vive
  // en `.gml-bloque--contraste` (ver `viewer/cajon-diagnostico.js#anfitrion`) y
  // exigir que esté dentro del lienzo saldría rojo POR ESTAR BIEN.
  //
  // El invariante que lo sustituye dice lo mismo de la relación que importaba
  // —el diagnóstico y el mapa no se pisan— con los papeles al revés: ahora es el
  // mapa el que no puede llevar nada encima. Se mide con las DOS mitades porque
  // media verdad aquí es indistinguible de un montaje roto: el cajón dentro del
  // panel Y ni un píxel suyo sobre el lienzo.
  enElPanel: rectPanel !== null && panelEl.contains(cajonEl),
  fueraDelMapa: rectCajon.right <= rectMapa.left + 1 || rectCajon.left >= rectMapa.right - 1,
  // Se CALCULA el solape real y no se escribe un 0: un cero constante dentro de un
  // bloque que dice «MEDIDA» es la clase de cifra que sigue diciendo que sí el día
  // que deja de ser verdad. Es la misma cifra que publicaba F07 —cuánto lienzo
  // tapa el diagnóstico—, y lo que ha cambiado es la respuesta, no la pregunta.
  porcentajeDelLienzo: redondear(
    ((Math.max(0, Math.min(rectCajon.right, rectMapa.right) - Math.max(rectCajon.left, rectMapa.left)) *
      Math.max(0, Math.min(rectCajon.bottom, rectMapa.bottom) - Math.max(rectCajon.top, rectMapa.top))) /
      (rectMapa.width * rectMapa.height)) *
      100,
    1,
  ),
  // El mapa NO cambia de tamaño al abrir, y sigue siendo verdad por una razón
  // distinta de la de F07: no es que el cajón flote, es que el panel mide lo
  // mismo en las cinco pantallas. La medida se conserva porque el día que una
  // pantalla reparta el ancho de otra forma, Leaflet dibujaría sobre un tamaño
  // que ya no tiene (teselas descolocadas, clics desplazados, cero errores en
  // consola). Ver `alNavegar` en `app/main.js`.
  mapaIntacto: mapaEl.clientWidth === mapaAntes.ancho && mapaEl.clientHeight === mapaAntes.alto,
  titular: texto('[data-diag="titular"]'),
}
if (!cajon.enElPanel) {
  problemas.push(
    'El diagnóstico no está dentro de `.gml-panel`: desde el 2026-08-05 su sitio es la columna ' +
      'izquierda (`[data-anfitrion="diagnostico"]`), no una esquina del mapa. O el anfitrión no ' +
      'se ha cableado en `app/main.js`, o el paso no es Diagnóstico.',
  )
}
if (!cajon.fueraDelMapa) {
  problemas.push(
    'El diagnóstico pisa el lienzo del mapa: eso es exactamente lo que el traslado a la columna ' +
      'venía a quitar (las manchas del solape y la cota de la desviación se leen MIRANDO el mapa).',
  )
}
if (!cajon.mapaIntacto) {
  problemas.push(
    `Abrir el cajón ha cambiado el tamaño del mapa (${mapaAntes.ancho}×${mapaAntes.alto} → ` +
      `${mapaEl.clientWidth}×${mapaEl.clientHeight}): el panel mide lo mismo en las cinco ` +
      'pantallas, así que cambiar de paso no puede mover el lienzo.',
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
// MEDIDA, no juicio.
//
// ── ⛔ QUÉ MEDÍA ESTE APARTADO HASTA EL 2026-08-05, Y POR QUÉ YA NO ────────
// Medía «abrir el cajón no le roba altura a la caja de vértices», que era LA
// prueba de la Decisión 1 de F07 (el diagnóstico flota sobre el mapa y no entra
// en el panel). Hoy esa comparación es IMPOSIBLE de hacer, y no por un fallo:
// abrir el diagnóstico **navega a la pantalla Diagnóstico**, donde la caja de
// vértices no se enseña (`data-pantalla` en `index.html`). El «antes» y el
// «después» ya no describen la misma pantalla, así que restarlos no significa
// nada — es el mismo motivo por el que la regresión del rework declaró
// inmedibles media docena de invariantes de `10-comprobar-gml`.
//
// Lo que SÍ sigue siendo medible es el presupuesto de verdad, y es el que
// importaba desde 08 §10: **que el panel no desborde y que su pie quepa**. El
// diagnóstico es ahora el estirador de su pantalla (`flex:1 1 auto` con scroll
// propio), así que si algún día no cediera, lo que se saldría por abajo sería la
// ficha del expediente y los dos CTA — en silencio, porque `.gml-panel` es
// `overflow:hidden`. Eso es lo que se vigila.
//
// Las dos cifras del instante de abrir se PUBLICAN igual, sin juicio: son la
// prueba de que la caja de vértices se retira entera al cambiar de pantalla, que
// es lo que se quería.

const filaCualquiera = $('#tabla-vertices tr[data-indice]')
const cabeceraTabla = $('#tabla-vertices thead')
const altoCaja = altoCajaVertices()
const altoFila = filaCualquiera === null ? null : filaCualquiera.getBoundingClientRect().height
const altoCabecera = cabeceraTabla === null ? 0 : cabeceraTabla.getBoundingClientRect().height
const pieEl = $('.gml-panel-pie')
const rectPie = pieEl === null ? null : pieEl.getBoundingClientRect()

const panel = {
  queEs: 'MEDIDA de layout real, sin juicio (regla de oro 9).',
  // El estado FINAL del guion (tras editar, teclear y el zoom de la banda). En
  // Diagnóstico vale 0: la caja de vértices es de OTRA pantalla desde 2026-08-05.
  altoCajaVerticesAlFinalPx: altoCaja,
  altoAntesDeAbrirPx: cajaAntesDeAbrir,
  altoTrasAbrirPx: cajaTrasAbrir,
  renglonCtaCrecioPx,
  // El diagnóstico EN la columna: lo que ocupa y cuánto se queda bajo el pliegue
  // de su propio scroll. Se publica sin umbral —lo accionable va en el bloque
  // anclado, que tiene su propio guardián en la suite— para que el checklist §8
  // pueda juzgarlo con la captura delante.
  altoDiagnosticoEnElPanelPx: Math.round(rectCajon.height),
  bajoElPliegueDelDiagnosticoPx: Math.max(0, cajonEl.scrollHeight - cajonEl.clientHeight),
  renglonesBajoLaCabecera: altoCaja && altoFila ? redondear((altoCaja - altoCabecera) / altoFila, 1) : null,
  tarjetasDeAvisos: tarjetasDeAvisos(),
  altoBloqueEdicionPx: (() => {
    const bloque = $('.gml-bloque--edicion')
    return bloque === null ? null : Math.round(bloque.getBoundingClientRect().height)
  })(),
  // EL presupuesto que sustituye al de F07: el panel no desborda y el diagnóstico
  // llega hasta el suelo sin pasarse.
  desbordePanelPx: panelEl === null ? null : panelEl.scrollHeight - panelEl.clientHeight,
  // ⚠️ El PIE del panel no se mide aquí, y no es un olvido: desde el 2026-08-05
  // no se enseña en esta pantalla (`data-pantalla="validacion edicion informe"`
  // en `index.html`), porque repetía debajo lo que el contraste ya dice arriba y
  // mejor. Un `getBoundingClientRect()` sobre un `display:none` devuelve ceros, y
  // un guardián que compara contra ceros sale VERDE pase lo que pase — que es
  // peor que no tenerlo. Lo que se mide es que siga oculto, y cuánto suelo del
  // panel alcanza el diagnóstico ahora que lo tiene entero para él.
  pieSeVeEnDiagnostico: rectPie !== null && rectPie.height > 0,
  holguraBajoElDiagnosticoPx:
    rectPanel === null ? null : redondear(rectPanel.bottom - rectCajon.bottom, 2),
  // Y el desborde HORIZONTAL, que en este panel es el fallo mudo por excelencia:
  // `.gml-panel` es `overflow:hidden`, así que lo que no cabe a lo ancho se
  // recorta sin scroll y sin aviso. El bloque anclado del diagnóstico se sale a
  // propósito de los rellenos del contenedor (`width: calc(100% + 24px)`), que es
  // justo la clase de cosa que puede pasarse de la raya.
  desbordeHorizontalPanelPx: panelEl === null ? null : panelEl.scrollWidth - panelEl.clientWidth,
  desbordeHorizontalDiagnosticoPx: cajonEl.scrollWidth - cajonEl.clientWidth,
}
if (panel.desbordePanelPx !== null && panel.desbordePanelPx > 1) {
  problemas.push(
    `El panel desborda ${panel.desbordePanelPx} px con el diagnóstico abierto, y ` +
      '`.gml-panel` es `overflow:hidden`: eso se recorta EN SILENCIO. El diagnóstico tiene que ' +
      'ceder altura (es el estirador de su pantalla), no empujar.',
  )
}
if (panel.pieSeVeEnDiagnostico) {
  problemas.push(
    'El pie del panel se ve en Diagnóstico: sus renglones repiten «Superficie», «Superficie ' +
      'catastral», «Δ catastral» y «Colindantes», que el bloque de contraste ya dice arriba y ' +
      'con más contexto. Sobra, y es lo que obligaba a rodar la rueda.',
  )
}
if (panel.holguraBajoElDiagnosticoPx !== null && panel.holguraBajoElDiagnosticoPx < -1) {
  problemas.push(
    `El diagnóstico se sale ${Math.abs(panel.holguraBajoElDiagnosticoPx)} px por debajo del ` +
      'panel: tiene que ceder altura (es el estirador de su pantalla), no empujar.',
  )
}
for (const [que, px] of [
  ['el panel', panel.desbordeHorizontalPanelPx],
  ['el diagnóstico', panel.desbordeHorizontalDiagnosticoPx],
]) {
  if (px !== null && px > 1) {
    problemas.push(
      `Desborde HORIZONTAL de ${px} px en ${que}: en una columna de 392 px con ` +
        '`overflow:hidden` eso no scrollea, se recorta y no avisa.',
    )
  }
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
