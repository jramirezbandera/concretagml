// scripts/smoke-navegador/07-catastro-vivo.js — F05 · Tarea T5C.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// F05 ENTERA, contra el Catastro de verdad y en un Chromium de verdad. Es el
// único sitio del proyecto donde se ejercitan las TRES cosas que ni Node ni
// jsdom pueden dar, y por eso existe:
//
//   1. **CORS DE VERDAD.** Ni Node ni jsdom aplican la política de mismo origen:
//      en los dos, un `fetch` cross-origin sale sin que nadie mire la cabecera
//      `Access-Control-Allow-Origin`. La suite de aceptación de F05
//      (`test/services/aceptacion-f05.test.js`) lo declara con todas las letras
//      como NO cubierto por ningún test offline y remite aquí. Lo que se mide es
//      que una página servida desde `http://localhost:PUERTO` obtenga un
//      **cuerpo legible** de `https://ovc.catastro.meh.es` — que es la única
//      forma de comprobarlo, porque `ACAO` **no es una cabecera de respuesta
//      expuesta a script**: el navegador la consume y no la deja leer. Ver
//      «CÓMO SE MIDE CORS SIN PODER LEER LA CABECERA».
//   2. **INDEXEDDB DE VERDAD.** La suite usa `fake-indexeddb`. Aquí se abre la
//      base REAL del navegador (`storage/bd.js#NOMBRE_BD`), se comprueba que la
//      parcela traída se ha GUARDADO y que **la segunda consulta no emite ni una
//      petición** al servicio, contado con Resource Timing (la misma técnica de
//      `02-wms-encuadre.js`). Ese «cero» es el criterio de aceptación 1 de F05
//      («segunda llamada sale de caché (sin red)») medido donde de verdad vale.
//   3. **EL RECORRIDO COMPLETO EN EL NAVEGADOR**: teclear la referencia → pulsar
//      «Traer del Catastro» → ver la parcela dibujada, la ficha rellena y el
//      rótulo de procedencia → volver a pulsar y que salga de la copia local.
//      ⛔ Tenía una segunda mitad —«y, con `?demo=hueco`, "Deducir del mapa" →
//      el campo relleno con la referencia que el Catastro dice que hay bajo la
//      geometría»— y se fue con el botón el 2026-08-16.
//
// ── ⚠️ EL RÉGIMEN DE USO MANDA SOBRE TODO LO DEMÁS ─────────────────────────
// Este guion llama al servicio real. La política del Catastro contempla la
// **denegación de servicio durante ~10 días** ante uso automático (override O8
// de `spec/SPEC.md`), así que:
//
//   · **Una pasada, sin bucles y sin reintentos propios.** El transporte
//     (`services/_red.js`) ya trae cola, plazo y backoff con jitter; este guion
//     no reintenta NADA por su cuenta, ni siquiera cuando algo sale mal. Si algo
//     falla, se dice y se sale.
//   · **Coste medido de una pasada completa: 2 peticiones** a los servicios de
//     datos — una al WFS (pasada de carga) y una al OVC (pasada de deducción).
//     Las segundas pulsaciones de cada pasada valen **cero**, y ese cero es
//     justamente lo que se mide.
//   · **Para depurar, la caché es la amiga.** Repetir el guion sobre la misma
//     base ya calentada cuesta CERO peticiones: el guion lo detecta solo
//     (`cachePartiaCaliente`) y ajusta lo que espera en vez de fallar. Lo que se
//     pierde en esa repetición es la medida de CORS (no hay respuesta nueva que
//     leer), y el veredicto lo DICE (`cors.medidoEnEstaPasada`).
//
// ── CÓMO SE MIDE CORS SIN PODER LEER LA CABECERA ────────────────────────────
// `Access-Control-Allow-Origin` **no se puede leer desde script**: no está en la
// lista blanca de cabeceras de respuesta expuestas, y el navegador la usa para
// decidir y luego la esconde. Así que no se finge leerla
// (`cors.acaoLegibleDesdeScript: false`). Lo que se mide es su EFECTO, por dos
// caminos independientes:
//
//   (a) **El cuerpo cruzó la frontera de origen y es legible.** El texto del GML
//       que el WFS contestó queda GUARDADO EN INDEXEDDB por
//       `services/catastro.js` (que cachea el CUERPO CRUDO, no el POJO), así que
//       este guion lo lee de la base y comprueba que es una `FeatureCollection`
//       con la referencia pedida dentro. Un `fetch` cross-origin bloqueado por
//       CORS **rechaza sin cuerpo**: no habría nada que guardar.
//   (b) **El desenlace en la UI.** Un fallo de CORS es indistinguible de estar
//       sin red (lo dice `services/_red.js#MOTIVO_RED.SIN_RED`, y es verdad: el
//       navegador da el MISMO `TypeError`), así que habría salido por el renglón
//       como «No se ha podido contactar con el Catastro» y por el panel con el
//       mensaje que nombra las cuatro causas. En vez de eso se lee «Cargada la
//       parcela …», con su geometría en la tabla.
//
// Las dos juntas son la comprobación; ninguna de las dos es replicable en Node.
//
// ── LA TRAMPA CENTRAL: EL CATASTRO DEVUELVE SUS ERRORES CON HTTP 200 ────────
// Medido el 2026-07-27 en las 8 respuestas de `test/fixtures/catastro/
// PROCEDENCIA.md`: **las buenas y las malas, todas HTTP 200.** «Todos 200» NO
// significa «todo bien» (y `GUION.md` §6 ya lo dice para el WMS). Por eso aquí
// se cuentan las peticiones **y lo que traían**:
//
//   · `responseStatus` de cada entrada de Resource Timing (es lo único que el
//     navegador expone de una respuesta cross-origin sin `Timing-Allow-Origin`;
//     `transferSize` y `encodedBodySize` vienen a 0 y el veredicto lo dice);
//   · el CUERPO, leído de IndexedDB: `FeatureCollection` sí,
//     `ExceptionReport` no;
//   · y el desenlace en la UI: renglón sin clase de error, ficha rellena,
//     panel de avisos sin crecer.
//
// ── QUÉ SE INTERCEPTA DE LA PÁGINA, Y QUE SE RESTAURA TODO ─────────────────
// **Nada del comportamiento de la app.** Solo dos cosas, las dos declaradas en
// el veredicto y las dos deshechas en un `finally`:
//
//   · Una **conexión propia a IndexedDB**, de solo lectura, que se `close()`
//     siempre (`cache.conexionCerrada`). Una conexión abierta que se olvida
//     bloquearía el `versionchange` de la próxima migración de `storage/bd.js`.
//   · Un **contador** sobre `window.fetch` que llama a la original y no cambia
//     nada (`captura.fetchRestaurado`). No está para interceptar: está para
//     MEDIR, y lo que mide es que **no sirve** — ver justo debajo.
//
// **Por qué NO se envuelve `fetch` para capturar las respuestas**, que sería lo
// obvio viniendo de `06-generar-gml.js`: `app/main.js` crea el transporte al
// arrancar y `services/_red.js#crearTransporte` **captura `globalThis.fetch` en
// ese momento** (`const { fetch: fetchDe = globalThis.fetch } = opciones`).
// Envolver `window.fetch` después es invisible para el transporte. El guion lo
// deja MEDIDO en vez de afirmado (`captura.llamadasVistasPorElEnvoltorio`,
// normalmente 0) para que el siguiente no pierda la tarde en ese callejón, y por
// eso la medida va por Resource Timing + IndexedDB.
//
// ── LAS EXPECTATIVAS SE DERIVAN ────────────────────────────────────────────
// Ni un número mágico, igual que `02` deriva sus `GetMap` de las instancias WMS
// visibles:
//   · **La referencia que se teclea** sale de la ficha del pie
//     (`[data-ficha="refcat"]`), no de una constante. Se teclea **en minúsculas**
//     para ejercitar de paso `normalizarRefcat`, y se comprueba que el campo
//     acaba con la forma CANÓNICA, que es una promesa explícita de
//     `cableado-catastro.js#aplicar`.
//     ⚠️ Con espacios NO se puede probar: `index.html` pone `maxlength="14"` en
//     el campo, así que `9398516 VK3799G` **no es tecleable ni pegable**. La
//     tolerancia a espacios de `normalizarRefcat` es defensa en profundidad,
//     inalcanzable desde esta pantalla. Queda para el checklist humano.
//   · **El SRS** sale de `[data-ficha="srs"]`.
//   · **Cuántas peticiones debe costar la primera consulta** se deriva de si la
//     clave ya estaba en IndexedDB y dentro del TTL: 0 si estaba, 1 si no.
//   · **Qué debe pasar en la deducción** se deriva de lo que el servicio
//     contestó, leído del almacén `revgeo`: con `unico: true` el campo se
//     rellena; con varios candidatos NO se rellena nada y sale la lista con los
//     domicilios (spec §7.3).
//   · **El punto que se consulta** se contrasta contra la geometría LEÍDA DE LA
//     TABLA: tiene que caer estrictamente dentro del recinto exterior y fuera
//     del hueco. Es una segunda implementación de `gml/anillos.js#puntoInterior`,
//     escrita aquí y sin importar nada del proyecto.
//   · **La geometría que llega del Catastro** se compara contra la que había en
//     la tabla ANTES de pulsar (el dataset de demostración, que se derivó del
//     fixture de esa misma parcela). Una diferencia NO tumba el smoke —el
//     Catastro puede haber rectificado la parcela— pero sale como advertencia.
//
// ── QUÉ **NO** PUEDE MEDIR ─────────────────────────────────────────────────
//   · **La cabecera `ACAO` en sí.** Ver arriba. Lo que se afirma es su efecto.
//     Quien quiera VERLA que use `npm run catastro:vivo` (`scripts/
//     sonda-catastro.mjs`, que corre en Node y sí lee cabeceras) — pero ojo: eso
//     no prueba CORS, porque Node no lo aplica. Las dos medidas son
//     complementarias y ninguna sustituye a la otra.
//   · **La red caída de verdad.** `/browse` no tiene modo offline ni
//     interceptación de red, así que `SIN_RED`, `TIEMPO_AGOTADO` y `ESTADO_HTTP`
//     no se pueden provocar sin maltratar el servicio. Van al checklist humano.
//   · **Lo que se ve MIENTRAS la petición está en vuelo.** El guion comprueba
//     que los botones se apagan al pulsar (`bloqueoDuranteLaConsulta`), pero no
//     puede juzgar si la espera se entiende: eso es juicio visual.
//   · **Si el mensaje de un fallo del servicio le sirve a un técnico** que no ha
//     leído el código. Los textos están, se pueden leer; que sean COMPRENSIBLES
//     no lo firma una máquina.
//   · **El bloqueo por abuso.** Nadie ha medido —ni va a medir— qué contesta el
//     Catastro a un cliente denegado (trampa 7 de `services/catastro.js`).
//   · **La consola.** El buffer vive en el demonio de `browse`, no en la página:
//     lo mide `$B console --errors` (`GUION.md` §6).
//   · **El clic en el mapa** como segunda vía de deducción. Necesita un punto
//     del lienzo y una proyección que este guion no puede validar sin importar
//     Leaflet; y consultar por un punto ARBITRARIO del mapa gastaría una
//     petición más para medir el mismo camino (`deducirEn`) que ya mide el
//     botón. Queda en el checklist humano.
//
// ── HOOKS SEMÁNTICOS QUE USA (y por qué son estables) ──────────────────────
//   · Los SEIS selectores del bloque de F05 son los que `app/cableado-catastro.js`
//     EXPORTA (`SELECTOR_CAMPO_REFCAT`, `SELECTOR_BOTON_CARGAR`,
//     `SELECTOR_ESTADO_CATASTRO`,
//     `SELECTOR_PROCEDENCIA`, `SELECTOR_CANDIDATOS`) y contrato con `index.html`,
//     que lo dice en su propia cabecera. Aquí van copiados porque
//     `page.evaluate` no resuelve módulos; si divergen, este guion debe FALLAR.
//   · `[data-ficha="…"]` — ficha del pie, contrato de `index.html`.
//   · `[data-eyebrow]` — el rótulo de procedencia de la cabecera, que
//     `app/main.js` pone en «Parcela del Catastro» cuando el dato ENTRA desde
//     F05. Es la prueba de que el store cambió, no solo la pantalla.
//   · `tbody[data-recinto]` / `tr[data-indice]` / `input[data-eje]` — contrato de
//     `viewer/sincronizacion.js`.
//   · `.gml-aviso` / `.gml-aviso-texto` / `.gml-aviso-veces` — `app/avisos.js`.
//   · `concreta-gml`, `catastroCache`, `revgeo` y los prefijos `parcela:` /
//     `revgeo:` — `storage/bd.js` y `storage/cache-catastro.js`.
//
// ── ESTADO EN QUE DEJA LA APP ──────────────────────────────────────────────
// En la pasada de CARGA: el campo con la referencia canónica, la parcela del
// Catastro en el store (y por tanto en el mapa, la tabla y la ficha), el renglón
// y la procedencia escritos, y una tarjeta más en el panel (el aviso de «esto
// sale de la copia local», que lo produce la SEGUNDA consulta). En la de
// DEDUCCIÓN: el campo con la referencia deducida (o la lista de candidatos
// visible) y el renglón escrito. **Todo eso es la salida NORMAL de haber pulsado
// los botones, no residuo del guion.** La geometría no se toca en ninguna de las
// dos, salvo por lo que el propio Catastro devuelve.
//
// ── NOTAS DE EJECUCIÓN ─────────────────────────────────────────────────────
//   · Dos pasadas, **cada una con la página recién cargada**, igual que `06`:
//     `…/concretagml/` (carga) y `…/concretagml/?demo=hueco` (deducción). El
//     guion **no lee `?demo=`**: elige el recorrido por el ESTADO —si la parcela
//     de arranque trae referencia, no hay nada que deducir—, que es exactamente
//     la condición con la que `cableado-catastro.js#puedeDeducirDe` habilita el
//     botón. Así el guion mide la regla, no el parámetro.
//   · `browse` envuelve el fichero en `(async()=>{ … })()` PORQUE contiene
//     `await` real (IndexedDB y las esperas); de ahí que el `return` de nivel
//     superior sea legal. Si se quitaran todos los `await`, el `return` pasaría a
//     ser un SyntaxError: no los quites.
//   · Presupuesto de tiempo declarado ({@link TOPE_TOTAL_MS}): `/browse` corta
//     cualquier comando a los 30 s, y el OVC ha llegado a tardar **2,9 s** en una
//     sola llamada (medido). Si el presupuesto se agota, el veredicto lo dice en
//     `abortadoPorTiempo` en vez de morir a medias.
//   · No hay `import`: `page.evaluate` no resuelve módulos. Los helpers están
//     duplicados entre guiones A PROPÓSITO.

// ── Contrato con la cáscara (copias de `app/cableado-catastro.js`) ──────────

/** Copia de `SELECTOR_CAMPO_REFCAT`. */
const SELECTOR_CAMPO = '[data-campo="refcat"]'

/** Copia de `SELECTOR_BOTON_CARGAR`. */
const SELECTOR_BOTON_CARGAR = '[data-accion="cargar-catastro"]'

// ⛔ AQUÍ ESTABA LA COPIA DE `SELECTOR_BOTON_DEDUCIR`
// (`[data-accion="deducir-refcat"]`). El botón «Deducir del mapa» se retiró el
// 2026-08-16 y el nodo ya no existe en `index.html`. Ver el tramo del recorrido 2.

/** Copia de `SELECTOR_ESTADO_CATASTRO`. */
const SELECTOR_RENGLON = '[data-estado="cargar-catastro"]'

/** Copia de `SELECTOR_PROCEDENCIA`. */
const SELECTOR_PROCEDENCIA = '[data-procedencia="parcela"]'

/** Copia de `SELECTOR_CANDIDATOS`. */
const SELECTOR_CANDIDATOS = '[data-candidatos="refcat"]'

/** Modificador de error del renglón (`cableado-catastro.js#CLASE_ESTADO_ERROR`). */
const CLASE_ERROR = 'gml-accion-estado--error'

/** Copia de `cableado-catastro.js#ROTULO_DEDUCIDA`. Si diverge, este guion falla. */
const ROTULO_DEDUCIDA = 'Parcela deducida de la ubicación · puedes corregirla'

/** Lo que `app/main.js` escribe en el eyebrow cuando el dato viene de F05. */
const EYEBROW_CATASTRO = 'Parcela del Catastro'

/** Lo que la ficha pone cuando la parcela del store no tiene referencia. */
const SIN_REFCAT = 'Sin referencia'

// ── Contrato con el almacenamiento (copias de `storage/`) ──────────────────

/** Copia de `storage/bd.js#NOMBRE_BD`. */
const NOMBRE_BD = 'concreta-gml'

/** Copia de `storage/bd.js#ALMACENES`. */
const ALMACENES = { PARCELAS: 'catastroCache', REVGEO: 'revgeo' }

/** Copia de `storage/bd.js#ESQUEMA_ALMACENES` (el `keyPath` de cada almacén). */
const CAMPO_CLAVE = { [ALMACENES.PARCELAS]: 'refcat', [ALMACENES.REVGEO]: 'clave' }

/** Copia de `storage/cache-catastro.js#PREFIJO`. */
const PREFIJO = { PARCELA: 'parcela:', REVGEO: 'revgeo:' }

/**
 * Copia de `storage/cache-catastro.js#MS_TTL` (7 días). Solo se usa para DERIVAR
 * cuántas peticiones debe costar la primera consulta: un registro caducado es,
 * para el cliente, un registro que no está.
 */
const MS_TTL = 7 * 24 * 60 * 60 * 1000

// ── Los tres caminos de red del Catastro, y cuál NO se cuenta ──────────────

/** Host de los tres servicios. Los tres viven en la MISMA máquina. */
const HOST_CATASTRO = 'ovc.catastro.meh.es'

/** `GetParcel` / `GetNeighbourParcel` / BBOX — `services/_catastro-wfs.js`. */
const MARCA_WFS = 'wfsCP.aspx'

/** Geocodificación inversa — `services/_catastro-ovc.js`. */
const MARCA_OVC = 'Consulta_RCCOOR'

/**
 * ⚠️ El WMS vive en el MISMO host que los servicios de datos
 * (`ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx`), así que contar «las
 * peticiones al Catastro» por host mezclaría la cartografía de fondo —que pide
 * una imagen por encuadre y no tiene nada que ver con F05— con las consultas de
 * datos. Se cuenta por RUTA, y esta marca se excluye explícitamente.
 */
const MARCA_WMS = 'ServidorWMS.aspx'

/** Forma de una referencia catastral de parcela (`services/catastro.js`). */
const RE_REFCAT = /^[0-9A-Z]{14}$/

// ── Presupuestos de tiempo ────────────────────────────────────────────────

/**
 * Espera máxima de una consulta que SALE A LA RED. El plazo del transporte es de
 * 15 s (`services/_red.js#MS_TIMEOUT`) y el OVC ha llegado a tardar 2,9 s en una
 * sola llamada; 13 s deja margen para una respuesta lenta sin llegar al corte de
 * 30 s de `/browse`.
 */
const TOPE_RED_MS = 13000

/** Espera máxima de una consulta que debe salir de la CACHÉ. */
const TOPE_CACHE_MS = 4000

/** Margen para que el renglón, el panel y la tabla hayan pintado. */
const MS_PINTADO = 180

/** Presupuesto total del guion (el comando entero muere a los 30 s). */
const TOPE_TOTAL_MS = 24000

/** Cuánto puede llevar guardado un registro para considerarlo de ESTA pasada. */
const MS_RECIEN_GUARDADO = 120000

const t0 = performance.now()

/** Lo que TUMBA el smoke. */
const problemas = []

/** Lo que hay que saber pero NO tumba el smoke (limitaciones de la medida). */
const advertencias = []

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

const redondear = (v, n = 2) => (Number.isFinite(v) ? Number(v.toFixed(n)) : null)

/** Espera activa con tope. Copiada de `02-wms-encuadre.js`. */
async function esperarHasta(condicion, topeMs, pasoMs = 60) {
  const inicio = performance.now()
  for (;;) {
    let cumple = false
    try {
      cumple = Boolean(condicion())
    } catch {
      cumple = false
    }
    if (cumple) return { cumplido: true, ms: Math.round(performance.now() - inicio) }
    if (performance.now() - inicio >= topeMs) {
      return { cumplido: false, ms: Math.round(performance.now() - inicio) }
    }
    await dormir(pasoMs)
  }
}

// ── Localización de la UI ──────────────────────────────────────────────────

const campo = document.querySelector(SELECTOR_CAMPO)
const botonCargar = document.querySelector(SELECTOR_BOTON_CARGAR)
const renglon = document.querySelector(SELECTOR_RENGLON)
const procedencia = document.querySelector(SELECTOR_PROCEDENCIA)
const candidatos = document.querySelector(SELECTOR_CANDIDATOS)

const faltan = [
  [SELECTOR_CAMPO, campo],
  [SELECTOR_BOTON_CARGAR, botonCargar],
  [SELECTOR_RENGLON, renglon],
  [SELECTOR_PROCEDENCIA, procedencia],
  [SELECTOR_CANDIDATOS, candidatos],
].filter(([, nodo]) => nodo === null)

if (faltan.length > 0) {
  return {
    guion: '07-catastro-vivo',
    feature: 'F05',
    tarea: 'T5C',
    ok: false,
    problemas: [
      `La cáscara no tiene ${faltan.map(([s]) => s).join(', ')}. Los cinco nodos del bloque ` +
        '«Parcela del Catastro» son contrato de app/cableado-catastro.js con index.html: sin ' +
        'ellos el módulo ni siquiera habría cableado, y no hay nada que medir.',
    ],
    ms: Math.round(performance.now() - t0),
  }
}

// ── Lecturas de la pantalla ────────────────────────────────────────────────

/** Texto de un `[data-ficha="…"]`, sin adornos. */
function ficha(clave) {
  const el = document.querySelector(`[data-ficha="${clave}"]`)
  return el === null ? null : el.textContent.trim()
}

/** «1.535,87 m²» → 1535.87. Copiada de `06-generar-gml.js`. */
function numeroDeFicha(clave) {
  const texto = ficha(clave)
  if (texto === null) return null
  const crudo = texto.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(crudo)
  return Number.isFinite(n) ? n : null
}

/** Peso del panel de avisos: tarjetas + repeticiones. Copiada de `06`. */
function pesoAvisos() {
  const tarjetas = [...document.querySelectorAll('#avisos .gml-aviso')]
  return {
    tarjetas: tarjetas.length,
    peso: tarjetas.reduce((total, tarjeta) => {
      const veces = tarjeta.querySelector('.gml-aviso-veces')
      const n = veces === null ? 1 : Number(veces.textContent.replace(/\D/g, '')) || 1
      return total + n
    }, 0),
    textos: tarjetas.map((tarjeta) => {
      const texto = tarjeta.querySelector('.gml-aviso-texto')
      return texto === null ? null : texto.textContent.slice(0, 110)
    }),
  }
}

/**
 * La geometría TAL COMO LA VE EL USUARIO: leída de las celdas de la tabla, que
 * es el contrato de `viewer/sincronizacion.js`. No se lee del store (la app no
 * lo expone, y a propósito: no hay `window.__gml`).
 *
 * @returns {Array<{recinto: number, vertices: Array<[number, number]>}>}
 */
function geometriaDeLaTabla() {
  return [...document.querySelectorAll('#tabla-vertices tbody[data-recinto]')].map((cuerpo) => ({
    recinto: Number(cuerpo.dataset.recinto),
    vertices: [...cuerpo.querySelectorAll('tr[data-indice]')].map((fila) => {
      const x = fila.querySelector('input[data-eje="x"]')
      const y = fila.querySelector('input[data-eje="y"]')
      return [x === null ? NaN : Number(x.value), y === null ? NaN : Number(y.value)]
    }),
  }))
}

/** Resumen serializable de una geometría (las coordenadas completas no caben). */
function resumirGeometria(geo) {
  return {
    recintos: geo.length,
    verticesPorRecinto: geo.map((r) => r.vertices.length),
    primerVertice: geo.length > 0 && geo[0].vertices.length > 0 ? geo[0].vertices[0] : null,
  }
}

/**
 * Compara dos geometrías vértice a vértice. Devuelve la desviación máxima en
 * metros, o `null` si ni siquiera tienen la misma forma.
 */
function compararGeometrias(a, b) {
  if (a.length !== b.length) return { mismaForma: false, desviacionMaximaM: null }
  let maxima = 0
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].vertices.length !== b[i].vertices.length) {
      return { mismaForma: false, desviacionMaximaM: null }
    }
    for (let j = 0; j < a[i].vertices.length; j += 1) {
      maxima = Math.max(
        maxima,
        Math.abs(a[i].vertices[j][0] - b[i].vertices[j][0]),
        Math.abs(a[i].vertices[j][1] - b[i].vertices[j][1]),
      )
    }
  }
  return { mismaForma: true, desviacionMaximaM: redondear(maxima, 3) }
}

/**
 * ¿Cae el punto dentro del anillo? Lanzamiento de rayo sobre un anillo ABIERTO
 * (el de la tabla lo es). Segunda implementación, independiente de
 * `gml/anillos.js`: si las dos discreparan, el smoke lo dice.
 *
 * @param {[number, number]} punto
 * @param {Array<[number, number]>} anillo
 * @returns {boolean}
 */
function dentroDelAnillo(punto, anillo) {
  const [px, py] = punto
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i, i += 1) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    const cruza = yi > py !== yj > py
    if (cruza && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

// ── La caché real del navegador ────────────────────────────────────────────

/**
 * Abre la base REAL de la app, **sin versión y solo si ya existe**.
 *
 * Lo de «solo si ya existe» no es cautela decorativa: `indexedDB.open(nombre)`
 * sobre una base que no está la CREA con versión 1 y dispara `upgradeneeded`, y
 * eso dejaría una base vacía sin los almacenes que `storage/bd.js` instala en su
 * escalera de migraciones — o sea, el guion habría roto la app que venía a
 * medir. Por eso se consulta antes `indexedDB.databases()`.
 *
 * @returns {Promise<{apiDisponible: boolean, existe: boolean, version: number|null,
 *                    bd: IDBDatabase|null, error: string|null}>}
 */
async function abrirBaseSiExiste() {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
    return { apiDisponible: false, existe: false, version: null, bd: null, error: null }
  }
  let fichas
  try {
    fichas = await indexedDB.databases()
  } catch (error) {
    return { apiDisponible: true, existe: false, version: null, bd: null, error: String(error) }
  }
  const ficha = fichas.find((b) => b.name === NOMBRE_BD)
  if (ficha === undefined) {
    return { apiDisponible: true, existe: false, version: null, bd: null, error: null }
  }
  try {
    const bd = await new Promise((resolver, rechazar) => {
      const peticion = indexedDB.open(NOMBRE_BD)
      peticion.onsuccess = () => resolver(peticion.result)
      peticion.onerror = () => rechazar(peticion.error)
      peticion.onblocked = () => rechazar(new Error('la apertura quedó bloqueada'))
    })
    return { apiDisponible: true, existe: true, version: bd.version, bd, error: null }
  } catch (error) {
    return { apiDisponible: true, existe: true, version: ficha.version, bd: null, error: String(error) }
  }
}

/** Todos los registros de un almacén, o `[]` si no existe. */
async function leerAlmacen(bd, nombre) {
  if (bd === null || ![...bd.objectStoreNames].includes(nombre)) return []
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(nombre, 'readonly')
    const peticion = tx.objectStore(nombre).getAll()
    peticion.onsuccess = () => resolver(peticion.result || [])
    peticion.onerror = () => rechazar(peticion.error)
  })
}

/**
 * Fotografía de la caché: las claves de cada almacén con su edad. **No se
 * devuelve el `valor`** (un GML de 3 kB por registro no cabe en un veredicto);
 * de él se devuelven las señas que importan.
 */
async function fotoDeLaCache(bd, ahora) {
  const foto = {}
  for (const [rotulo, almacen] of Object.entries(ALMACENES)) {
    const registros = await leerAlmacen(bd, almacen)
    foto[almacen] = registros.map((registro) => {
      const clave = registro[CAMPO_CLAVE[almacen]]
      const valor = registro.valor
      const edadMs = Number.isFinite(registro.guardadoEn) ? ahora - registro.guardadoEn : null
      return {
        rotulo,
        clave,
        guardadoEn: registro.guardadoEn ?? null,
        edadMs,
        // Un registro caducado es, para `storage/cache-catastro.js`, un registro
        // que no está: por eso la expectativa de peticiones se deriva de ESTO y
        // no de la mera presencia.
        vigente: Number.isFinite(edadMs) && edadMs <= MS_TTL,
        tipoValor: typeof valor,
        bytes: typeof valor === 'string' ? valor.length : null,
        // El cuerpo CRUDO del servicio, que es lo que `services/catastro.js`
        // cachea a propósito. Estas tres banderas son la lectura del punto (a) de
        // CORS y, a la vez, la respuesta a «cuenta también qué traían».
        esColeccionWfs: typeof valor === 'string' && valor.includes('FeatureCollection'),
        esExcepcionWfs: typeof valor === 'string' && valor.includes('ExceptionReport'),
        // Del `revgeo` sí cabe el POJO entero: son dos números y una lista corta.
        pojo:
          valor !== null && typeof valor === 'object'
            ? {
                cuantos: valor.cuantos ?? null,
                unico: valor.unico ?? null,
                candidatos: Array.isArray(valor.candidatos)
                  ? valor.candidatos.map((c) => ({ refcat: c.refcat, domicilio: c.domicilio }))
                  : null,
              }
            : null,
      }
    })
  }
  return foto
}

// ── Resource Timing: las peticiones a los servicios de DATOS ───────────────

/**
 * URLs de las peticiones a los servicios de datos del Catastro que hay ahora
 * mismo en el Resource Timing. **El WMS se excluye** (ver {@link MARCA_WMS}).
 */
function entradasCatastro() {
  return performance
    .getEntriesByType('resource')
    .filter(
      (entrada) =>
        entrada.name.includes(HOST_CATASTRO) &&
        !entrada.name.includes(MARCA_WMS) &&
        (entrada.name.includes(MARCA_WFS) || entrada.name.includes(MARCA_OVC)),
    )
    .map((entrada) => ({
      servicio: entrada.name.includes(MARCA_WFS) ? 'WFS' : 'OVC',
      url: entrada.name,
      // Lo ÚNICO que el navegador expone del estado de una respuesta
      // cross-origin. Ver la trampa: 200 no significa «bien».
      responseStatus: entrada.responseStatus ?? null,
      ms: Math.round(entrada.duration),
      // Vienen a 0 sin `Timing-Allow-Origin`, que el Catastro no manda. Se
      // devuelven igual para que nadie los lea como «respuesta vacía».
      transferSize: entrada.transferSize,
      encodedBodySize: entrada.encodedBodySize,
    }))
}

/** Solo el `GetMap` de la cartografía, para poder decir que se ha excluido. */
function peticionesWms() {
  return performance.getEntriesByType('resource').filter((e) => e.name.includes(MARCA_WMS)).length
}

// ── El gesto: pulsar y esperar a que la consulta termine ───────────────────

/**
 * Pulsa un botón del bloque y espera a que la consulta termine.
 *
 * **Cómo se sabe que ha terminado, sin poder ver la promesa**: los dos botones
 * se apagan mientras hay algo en vuelo y se vuelven a encender al acabar
 * (`cableado-catastro.js#refrescar`, llamado dentro de `operar` antes del primer
 * `await` y en su `finally`). Así que el `disabled` del botón de cargar ES el
 * indicador de «en vuelo», y su vuelta a `false` es el desenlace. Como efecto
 * secundario se MIDE esa cortesía: `bloqueoDuranteLaConsulta`.
 *
 * @param {HTMLButtonElement} boton
 * @param {number} topeMs
 */
async function pulsarYEsperar(boton, topeMs) {
  performance.clearResourceTimings()
  const inicio = performance.now()

  boton.click()
  // Se lee SIN await: nada asíncrono ha podido correr todavía, así que esto es
  // el estado que dejó el manejador de forma síncrona.
  const bloqueoDuranteLaConsulta = botonCargar.disabled === true

  const espera = await esperarHasta(() => botonCargar.disabled === false, topeMs)
  await dormir(MS_PINTADO)

  return {
    bloqueoDuranteLaConsulta,
    termino: espera.cumplido,
    ms: Math.round(performance.now() - inicio),
    peticiones: entradasCatastro(),
    // Se informa aparte para que quede claro que NO se están contando: cargar
    // una parcela reencuadra el mapa y eso cuesta sus `GetMap`, que no son F05.
    getMapDeCartografiaNoContados: peticionesWms(),
  }
}

/** Lo que la pantalla dice AHORA, en una sola lectura. */
function fotoDeLaPantalla() {
  const botonesCandidatos = [...candidatos.querySelectorAll('button[data-refcat]')]
  return {
    campo: campo.value,
    renglon: renglon.textContent,
    renglonEnError: renglon.classList.contains(CLASE_ERROR),
    procedencia: procedencia.textContent,
    eyebrow: (() => {
      const el = document.querySelector('[data-eyebrow]')
      return el === null ? null : el.textContent.trim()
    })(),
    fichaRefcat: ficha('refcat'),
    fichaVertices: ficha('vertices'),
    fichaSuperficie: numeroDeFicha('superficie'),
    fichaSuperficieCatastral: ficha('superficie-catastral'),
    filasDeLaTabla: document.querySelectorAll('#tabla-vertices tr[data-indice]').length,
    candidatosOcultos: candidatos.hidden,
    candidatos: botonesCandidatos.map((b) => ({
      refcat: b.dataset.refcat,
      texto: b.textContent.trim().slice(0, 90),
      // El domicilio es lo ÚNICO que permite a una persona distinguir entre
      // candidatos (`services/_catastro-ovc.js`), así que una lista sin él sería
      // una lista de códigos indistinguibles.
      declaraDomicilio: !b.textContent.includes('no ha dado el domicilio'),
    })),
    botonCargarDeshabilitado: botonCargar.disabled,
  }
}

// ── Estado de partida ──────────────────────────────────────────────────────

const srs = ficha('srs')
const refcatDeArranque = ficha('refcat')
const hayReferencia = refcatDeArranque !== null && refcatDeArranque !== SIN_REFCAT
const geometriaDeArranque = geometriaDeLaTabla()
const avisosAntes = pesoAvisos()
const pantallaAlEmpezar = fotoDeLaPantalla()

/**
 * El RECORRIDO se elige por el ESTADO, no por `?demo=`: si la parcela de
 * arranque trae referencia se anda el de CARGA, y si no lo trae no hay nada que
 * andar desde el 2026-08-16 — ver el tramo del recorrido 2, que quedó sin gesto
 * que pulsar cuando se retiró «Deducir del mapa».
 */
const recorrido = hayReferencia ? 'carga' : 'deduccion'

if (srs === null || !/^EPSG:\d+$/.test(srs)) {
  problemas.push(
    `La ficha del pie no dice un SRS utilizable (${JSON.stringify(srs)}), y de ahí sale la ` +
      'clave con la que se busca en la caché y el SRS con el que se contrasta la URL consultada.',
  )
}

// ── Envoltorio-testigo sobre `fetch` (ver la cabecera: NO sirve, y eso mide) ─

const fetchOriginal = window.fetch
let llamadasVistasPorElEnvoltorio = 0
window.fetch = function (...argumentos) {
  llamadasVistasPorElEnvoltorio += 1
  return fetchOriginal.apply(this, argumentos)
}

const base = await abrirBaseSiExiste()

/**
 * ¿Se ha llegado a ejecutar el `close()`? Se MIDE con una bandera y no se afirma
 * en el veredicto: `IDBDatabase` no expone si está cerrada, así que lo único
 * honesto es publicar que el `finally` pasó por ahí. Si no había conexión que
 * cerrar, ya nace en `true`.
 */
let conexionCerrada = base.bd === null

let veredicto = null

try {
  const cacheAntes = await fotoDeLaCache(base.bd, Date.now())

  if (recorrido === 'carga') {
    // ── Recorrido 1 · «Traer del Catastro» ───────────────────────────────────

    const claveParcela = `${PREFIJO.PARCELA}${srs}:${refcatDeArranque}`
    const registroPrevio = (cacheAntes[ALMACENES.PARCELAS] || []).find(
      (r) => r.clave === claveParcela,
    )
    // EXPECTATIVA DERIVADA: si la clave ya está en la base y dentro del TTL, el
    // cliente no sale a la red ni la primera vez. Repetir el guion sin borrar la
    // base es un caso legítimo (y el recomendado para depurar), no un fallo.
    const cachePartiaCaliente = registroPrevio !== undefined && registroPrevio.vigente === true
    const esperadasPrimeraConsulta = cachePartiaCaliente ? 0 : 1

    // Se teclea en MINÚSCULAS: `normalizarRefcat` las admite y `aplicar` promete
    // devolver el campo a la forma canónica. Con espacios no se puede probar
    // (`maxlength="14"`); ver la cabecera.
    const tecleado = refcatDeArranque.toLowerCase()
    campo.value = tecleado
    campo.dispatchEvent(new Event('input', { bubbles: true }))
    campo.dispatchEvent(new Event('change', { bubbles: true }))

    const consulta1 = await pulsarYEsperar(botonCargar, TOPE_RED_MS)
    const pantalla1 = fotoDeLaPantalla()
    const geometria1 = geometriaDeLaTabla()
    const avisosTrasLa1 = pesoAvisos()
    const cacheTrasLa1 = await fotoDeLaCache(base.bd, Date.now())
    const registroTrasLa1 = (cacheTrasLa1[ALMACENES.PARCELAS] || []).find(
      (r) => r.clave === claveParcela,
    )

    if (!consulta1.bloqueoDuranteLaConsulta) {
      problemas.push(
        'Al pulsar «Traer del Catastro» el botón NO se ha quedado deshabilitado: la cortesía de ' +
          '`refrescar` no está funcionando y un segundo clic entraría encima del primero. (No es ' +
          'la garantía —esa son el token y el abortador— pero su ausencia sí es un defecto.)',
      )
    }
    if (!consulta1.termino) {
      problemas.push(
        `La primera consulta no había terminado a los ${TOPE_RED_MS} ms (el botón seguía ` +
          'deshabilitado). O el servicio va muy lento, o la consulta se ha quedado colgada; en ' +
          'cualquier caso lo que sigue no es medida fiable.',
      )
    }
    if (consulta1.peticiones.length !== esperadasPrimeraConsulta) {
      problemas.push(
        `La primera consulta ha costado ${consulta1.peticiones.length} petición(es) a los ` +
          `servicios de datos y se esperaban ${esperadasPrimeraConsulta} (derivado de que la ` +
          `clave «${claveParcela}» ${cachePartiaCaliente ? 'YA estaba' : 'NO estaba'} vigente en ` +
          'IndexedDB al empezar). Más de una significaría reintentos del backoff sobre un ' +
          'servicio que no debe recibirlos.',
      )
    }
    for (const peticion of consulta1.peticiones) {
      if (peticion.servicio !== 'WFS') {
        problemas.push(
          `«Traer del Catastro» ha llamado al ${peticion.servicio} y solo debe llamar al WFS: ` +
            `${peticion.url.slice(0, 140)}.`,
        )
      }
      if (peticion.responseStatus !== null && !(peticion.responseStatus >= 200 && peticion.responseStatus < 300)) {
        problemas.push(
          `El WFS ha respondido con HTTP ${peticion.responseStatus}. (Recuérdese lo contrario: ` +
            'un 200 tampoco garantiza nada en este servicio, que devuelve sus errores con 200.)',
        )
      }
    }

    // ── Segunda consulta: la que NO debe tocar la red ───────────────────────
    const consulta2 = await pulsarYEsperar(botonCargar, TOPE_CACHE_MS)
    const pantalla2 = fotoDeLaPantalla()
    const avisosTrasLa2 = pesoAvisos()

    if (!consulta2.termino) {
      problemas.push(
        `La segunda consulta no había terminado a los ${TOPE_CACHE_MS} ms, y debía salir de la ` +
          'copia local sin tocar la red.',
      )
    }
    if (consulta2.peticiones.length !== 0) {
      problemas.push(
        `La SEGUNDA consulta de la misma referencia ha emitido ${consulta2.peticiones.length} ` +
          'petición(es) al Catastro, y debía emitir CERO: la parcela estaba guardada en ' +
          'IndexedDB. Es el criterio de aceptación 1 de F05 («segunda llamada sale de caché, sin ' +
          'red») y, además, la mayor medida anti-bloqueo del cliente.',
      )
    }
    if (!/copia local/i.test(pantalla2.procedencia)) {
      problemas.push(
        'Tras la segunda consulta, el renglón de procedencia no dice que el dato salga de la ' +
          `copia local: dice ${JSON.stringify(pantalla2.procedencia)}. Sin eso, un dato guardado ` +
          'hace días se presenta como recién traído de la Sede.',
      )
    }
    if (avisosTrasLa2.peso <= avisosTrasLa1.peso) {
      problemas.push(
        'La consulta servida desde la copia local NO ha dejado ninguna tarjeta en el panel de ' +
          `avisos (peso ${avisosTrasLa1.peso} → ${avisosTrasLa2.peso}). El renglón de ` +
          'procedencia es gris de 11 px; trabajar sobre una copia local tiene que saltar a la ' +
          'vista (`cableado-catastro.js#aplicar`).',
      )
    }

    // ── El desenlace en la pantalla ────────────────────────────────────────
    if (pantalla1.renglonEnError) {
      problemas.push(
        `El renglón ha quedado en ERROR tras traer la parcela: ${JSON.stringify(pantalla1.renglon)}.`,
      )
    }
    if (!pantalla1.renglon.includes(refcatDeArranque)) {
      problemas.push(
        `El renglón de estado no nombra la referencia cargada (${refcatDeArranque}): dice ` +
          `${JSON.stringify(pantalla1.renglon)}.`,
      )
    }
    if (pantalla1.campo !== refcatDeArranque) {
      problemas.push(
        `Se tecleó «${tecleado}» y el campo ha quedado en ${JSON.stringify(pantalla1.campo)} en ` +
          `vez de en la forma canónica «${refcatDeArranque}». Dejar en pantalla una forma ` +
          'distinta de la que hay en el modelo invita a dudar de cuál se ha cargado ' +
          '(`cableado-catastro.js#aplicar`).',
      )
    }
    if (pantalla1.eyebrow !== EYEBROW_CATASTRO) {
      problemas.push(
        `El eyebrow de la cabecera dice ${JSON.stringify(pantalla1.eyebrow)} y debería decir ` +
          `«${EYEBROW_CATASTRO}»: es la prueba de que la parcela ha ENTRADO en el store desde ` +
          'F05, no solo de que la pantalla se ha escrito.',
      )
    }
    if (pantalla1.fichaRefcat !== refcatDeArranque) {
      problemas.push(
        `La ficha del pie dice refcat ${JSON.stringify(pantalla1.fichaRefcat)} y se cargó ` +
          `${refcatDeArranque}.`,
      )
    }
    if (Number(pantalla1.fichaVertices) !== pantalla1.filasDeLaTabla) {
      problemas.push(
        `La ficha dice ${pantalla1.fichaVertices} vértices y la tabla tiene ` +
          `${pantalla1.filasDeLaTabla} filas: los dos suscriptores del store no están viendo lo ` +
          'mismo.',
      )
    }
    if (pantalla1.filasDeLaTabla === 0) {
      problemas.push('La tabla se ha quedado sin vértices: la parcela traída no se ha dibujado.')
    }
    // ── La caché: que el dato esté guardado DE VERDAD ──────────────────────
    if (!base.apiDisponible) {
      advertencias.push(
        'Este navegador no expone `indexedDB.databases()`, así que no se ha podido abrir la base ' +
          'sin arriesgarse a crearla vacía. Todo lo que este veredicto dice de la caché sale del ' +
          'recuento de peticiones, no de haber mirado dentro.',
      )
    } else if (registroTrasLa1 === undefined) {
      problemas.push(
        `Tras traer la parcela, IndexedDB NO tiene la clave «${claveParcela}» en el almacén ` +
          `«${ALMACENES.PARCELAS}». Sin ese registro no hay caché, y cada consulta futura ` +
          'volvería al servicio.',
      )
    } else {
      if (registroTrasLa1.tipoValor !== 'string') {
        problemas.push(
          `El registro cacheado no guarda una cadena sino un ${registroTrasLa1.tipoValor}. ` +
            '`services/catastro.js` cachea el CUERPO CRUDO a propósito: guardar el POJO ' +
            'congelaría cada entrada con los fallos que tuviera el parser el día que se guardó.',
        )
      }
      if (!registroTrasLa1.esColeccionWfs) {
        problemas.push(
          'El cuerpo guardado en la caché no contiene «FeatureCollection»: lo que cruzó la ' +
            'frontera de origen no es la colección de parcelas del WFS.',
        )
      }
      if (registroTrasLa1.esExcepcionWfs) {
        problemas.push(
          'El cuerpo guardado en la caché es un `ExceptionReport` del Catastro y aun así la app ' +
            'lo ha dado por bueno. Es EXACTAMENTE la trampa del servicio: el error llega con ' +
            'HTTP 200.',
        )
      }
      if (!cachePartiaCaliente && (registroTrasLa1.edadMs === null || registroTrasLa1.edadMs > MS_RECIEN_GUARDADO)) {
        problemas.push(
          `El registro de la parcela dice haberse guardado hace ${registroTrasLa1.edadMs} ms, y ` +
            'esta pasada lo acaba de traer de la red: la marca de tiempo de la caché no es de ' +
            'fiar, y de ella sale la edad que se le enseña al usuario.',
        )
      }
    }

    // ── La geometría que llegó, contra la que había ────────────────────────
    const comparacion = compararGeometrias(geometriaDeArranque, geometria1)
    if (!comparacion.mismaForma) {
      advertencias.push(
        'La geometría que ha traído el Catastro NO tiene la misma forma que la del dataset de ' +
          `demostración (${JSON.stringify(resumirGeometria(geometriaDeArranque))} → ` +
          `${JSON.stringify(resumirGeometria(geometria1))}). El dataset se derivó del fixture de ` +
          'ESTA misma parcela, así que o el Catastro la ha rectificado, o `app/demo-datos.js` ha ' +
          'divergido del fixture. No tumba el smoke: es verdad externa, y la verdad externa ' +
          'cambia.',
      )
    } else if (comparacion.desviacionMaximaM > 0) {
      advertencias.push(
        `La geometría del Catastro difiere de la del dataset de demostración en hasta ` +
          `${comparacion.desviacionMaximaM} m. Misma lectura que arriba: informa, no tumba.`,
      )
    }

    veredicto = {
      recorrido: 'carga',
      queEjercita:
        'teclear la referencia → «Traer del Catastro» → parcela dibujada y ficha rellena → ' +
        'segunda pulsación servida desde IndexedDB sin tocar la red',
      referenciaPedida: refcatDeArranque,
      tecleado,
      claveDeCache: claveParcela,
      cachePartiaCaliente,
      esperadasPrimeraConsulta,
      consultas: [
        { orden: 1, esperadas: esperadasPrimeraConsulta, ...consulta1 },
        { orden: 2, esperadas: 0, ...consulta2 },
      ],
      pantallaTrasLa1: pantalla1,
      pantallaTrasLa2: pantalla2,
      geometria: {
        antes: resumirGeometria(geometriaDeArranque),
        despues: resumirGeometria(geometria1),
        ...comparacion,
      },
      avisos: {
        pesoAlEmpezar: avisosAntes.peso,
        pesoTrasLa1: avisosTrasLa1.peso,
        pesoTrasLa2: avisosTrasLa2.peso,
        textos: avisosTrasLa2.textos,
      },
      registroEnCache:
        registroTrasLa1 === undefined
          ? null
          : {
              clave: registroTrasLa1.clave,
              bytes: registroTrasLa1.bytes,
              edadMs: registroTrasLa1.edadMs,
              esColeccionWfs: registroTrasLa1.esColeccionWfs,
              esExcepcionWfs: registroTrasLa1.esExcepcionWfs,
            },
      corsMedidoAqui: consulta1.peticiones.length > 0 && registroTrasLa1 !== undefined,
    }
  } else {
    // ── ⛔ AQUÍ ESTUVO EL RECORRIDO 2 · «Deducir del mapa» ───────────────────
    //
    // **Y SE RETIRÓ EL 2026-08-16, CON SU BOTÓN.** Este tramo pulsaba
    // `[data-accion="deducir-refcat"]` con `?demo=hueco` y medía, sobre la red
    // real, el camino entero: punto interior de la geometría → OVC → campo
    // relleno (o lista de candidatos con su domicilio) → segunda pulsación
    // servida desde IndexedDB sin tocar la red. Medía además, con un lanzamiento
    // de rayo escrito aquí —segunda implementación, independiente de
    // `gml/anillos.js#puntoInterior`—, que el punto consultado cayera DENTRO del
    // recinto exterior y fuera de los huecos: la trampa del centroide de una
    // parcela en L, que se sale del polígono y hace que el Catastro conteste tan
    // tranquilo con la referencia de la vecina.
    //
    // ── POR QUÉ NO SE REESCRIBE CONTRA EL CLIC EN EL MAPA ──
    // El gesto que sobrevive es el clic sobre la cartografía, y **no sirve para
    // medir lo mismo**: el punto ya no lo calcula la aplicación a partir de la
    // geometría, lo trae el dedo del usuario. Comprobar que «cae dentro» sería
    // comprobar dónde pinchó este guion, que es circular; y para pinchar sobre
    // la parcela desde `page.evaluate` haría falta la proyección del `L.Map`,
    // que no está expuesta. Un tramo que consulta al servicio real y no puede
    // afirmar nada que no sepamos ya no se queda: gasta una petición del cupo
    // (override O8) a cambio de un dato que no decide nada.
    //
    // ── DÓNDE SE MIDE HOY LO QUE ESTE TRAMO MEDÍA ──
    //   · el camino OVC entero (clic → `deducirEn` → campo relleno o lista de
    //     candidatos, y la caché del punto) → `test/app/catastro.dom.test.js`,
    //     sección «deducir con un clic en el mapa», con el cliente REAL sobre el
    //     fixture `ovc-rccoor-ok.json`;
    //   · que el punto sea interior y no el centroide → el mismo fichero,
    //     mutación M6 anotada en su cabecera;
    //   · la deducción automática al importar un dibujo sin referencia, que es
    //     hoy el llamante más frecuente de `deducir()` → `main-refcat-deducida`.
    // Lo que ya no se mide en NAVEGADOR y contra el servicio VIVO es la latencia
    // del OVC y su CORS por esta vía. La carga por referencia (recorrido 1) sí
    // sigue midiéndolos, y es el mismo host.
    advertencias.push(
      'El recorrido de DEDUCCIÓN no se ha medido: el botón «Deducir del mapa» se retiró el ' +
        '2026-08-16 y el gesto que queda —pinchar la cartografía— no se puede dirigir desde este ' +
        'guion sin la proyección del mapa. La parcela de arranque no trae referencia catastral, ' +
        'así que tampoco había recorrido de CARGA que andar: esta pasada no ha ejercitado el ' +
        'servicio. Para medir F05 en vivo, abre la app SIN `?demo=hueco`.',
    )

    veredicto = {
      recorrido: 'deduccion',
      queEjercita: null,
      noMedible:
        'el botón «Deducir del mapa» ya no existe (retirado el 2026-08-16) y el clic en el mapa ' +
        'no se puede dirigir desde `page.evaluate`',
      dondeSeMideAhora: [
        'test/app/catastro.dom.test.js · «deducir con un clic en el mapa»',
        'test/app/main-refcat-deducida.dom.test.js · la deducción automática al importar',
      ],
      geometriaDeArranque: resumirGeometria(geometriaDeArranque),
      pantallaAlEmpezar,
      avisos: { pesoAlEmpezar: avisosAntes.peso, textos: avisosAntes.textos },
      corsMedidoAqui: false,
    }
  }
} catch (error) {
  // No se deja morir el comando: un veredicto con la excepción dentro dice mucho
  // más que un `page.evaluate` que revienta y no devuelve nada. La excepción se
  // NOMBRA y tumba el smoke, como debe.
  problemas.push(
    `El guion ha LANZADO a mitad del recorrido: ${error && error.name}: ${error && error.message}. ` +
      'Lo medido hasta ese punto está abajo; lo que falte, no se ha llegado a mirar.',
  )
} finally {
  // Las DOS restauraciones, pase lo que pase. Un guion que deja la página
  // parcheada —o una conexión a IndexedDB abierta— convierte en mentira todo lo
  // que se mida después de él.
  window.fetch = fetchOriginal
  if (base.bd !== null) {
    base.bd.close()
    conexionCerrada = true
  }
}

// ── CORS: lo que se mide, y lo que no se puede leer ────────────────────────

const cors = {
  queSeMide:
    'que una página de otro origen obtenga un CUERPO LEGIBLE del Catastro. Es lo único que ' +
    'demuestra la política de mismo origen, y solo existe en un navegador: ni Node ni jsdom la ' +
    'aplican.',
  origenDeLaPagina: location.origin,
  origenDelServicio: `https://${HOST_CATASTRO}`,
  esCrossOrigin: !location.origin.includes(HOST_CATASTRO),
  // No se finge leerla: `Access-Control-Allow-Origin` NO está entre las
  // cabeceras de respuesta expuestas a script. El navegador la consume para
  // decidir y luego la esconde.
  acaoLegibleDesdeScript: false,
  porQueNoSeLee:
    'ACAO no es una cabecera de respuesta expuesta: `Response.headers.get()` devuelve null ' +
    'aunque el servidor la mande. Para VERLA hay que salir del navegador (npm run ' +
    'catastro:vivo, que corre en Node) — pero eso no prueba CORS, porque Node no lo aplica.',
  medidoEnEstaPasada: veredicto !== null && veredicto.corsMedidoAqui === true,
  siNoSeMidio:
    'la caché ya estaba caliente y no ha hecho falta salir a la red: no hay respuesta nueva que ' +
    'leer. Para forzar una pasada en frío, borrar la base y recargar (ver GUION.md §13).',
  // Sin `Timing-Allow-Origin` el navegador pone a 0 los tamaños de una entrada
  // cross-origin. Se dice para que nadie lea ese 0 como «respuesta vacía».
  tamanosEnResourceTimingVienenACero: true,
}

if (cors.esCrossOrigin && !cors.medidoEnEstaPasada) {
  advertencias.push(
    'CORS no se ha medido en esta pasada: no ha salido ninguna petición nueva al servicio (la ' +
      'caché ya estaba caliente) o no se ha podido leer su cuerpo de la base. El resto del ' +
      'veredicto sigue valiendo; lo que no se puede afirmar hoy es que el Catastro siga ' +
      'mandando `Access-Control-Allow-Origin: *`.',
  )
}
if (!cors.esCrossOrigin) {
  advertencias.push(
    'La página y el servicio están en el MISMO origen, así que la política de mismo origen no ' +
      'interviene y esta pasada no dice nada sobre CORS.',
  )
}

const abortadoPorTiempo = performance.now() - t0 > TOPE_TOTAL_MS
if (abortadoPorTiempo) {
  problemas.push(
    `El guion ha superado su presupuesto de ${TOPE_TOTAL_MS} ms; /browse corta cualquier comando ` +
      'a los 30 s. Lo medido hasta aquí vale; lo que falte, no se ha llegado a mirar.',
  )
}

// ── Veredicto ──────────────────────────────────────────────────────────────

return {
  guion: '07-catastro-vivo',
  feature: 'F05',
  tarea: 'T5C',
  url: location.href,
  ok: problemas.length === 0,
  contraElServicioReal: true,
  peticionesGastadas: (veredicto === null ? [] : veredicto.consultas).reduce(
    (total, consulta) => total + consulta.peticiones.length,
    0,
  ),
  srs,
  estadoAlEmpezar: {
    referenciaDeArranque: refcatDeArranque,
    hayReferencia,
    geometria: resumirGeometria(geometriaDeArranque),
    pantalla: pantallaAlEmpezar,
    avisos: avisosAntes,
  },
  ...veredicto,
  cors,
  cache: {
    base: {
      nombre: NOMBRE_BD,
      apiDatabasesDisponible: base.apiDisponible,
      existia: base.existe,
      version: base.version,
      error: base.error,
    },
    esReal: true,
    frenteALaSuite:
      'la suite de F05 usa `fake-indexeddb`; aquí se abre la base del navegador. Solo LECTURA, y ' +
      'nunca se crea si no existe (crearla dejaría una base sin los almacenes de la escalera de ' +
      'migraciones de storage/bd.js).',
    conexionCerrada,
  },
  captura: {
    queSeEnvuelve: 'window.fetch, solo para CONTAR (llama a la original y no cambia nada)',
    llamadasVistasPorElEnvoltorio,
    porQueEsCero:
      'app/main.js crea el transporte al arrancar y services/_red.js captura `globalThis.fetch` ' +
      'en ese momento, así que envolverlo después es invisible para él. Se mide en vez de ' +
      'afirmarse, para que el siguiente no pierda la tarde en ese callejón.',
    fetchRestaurado: window.fetch === fetchOriginal,
  },
  consola: {
    medidaAqui: false,
    comoSeMide: '$B console --errors (el buffer vive en el demonio de browse, no en la página)',
    reglaEnGuion: 'GUION.md · §6 «Qué cuenta como consola limpia»',
  },
  trampaDelHttp200:
    'MEDIDO: el Catastro devuelve sus errores con HTTP 200. «Todos 200» NO significa «todo ' +
    'bien»: por eso aquí se cuentan las peticiones Y se lee el CUERPO que quedó en la caché ' +
    '(FeatureCollection sí, ExceptionReport no) y el desenlace en la UI.',
  esGestoDeRatonReal: false,
  abortadoPorTiempo,
  advertencias,
  problemas,
  ms: Math.round(performance.now() - t0),
}
