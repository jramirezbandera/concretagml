// scripts/smoke-navegador/17-medicion-propia.js — F18 · T5.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LA VÍA DE MEDICIÓN PROPIA, andada de una vez sobre la aplicación real:
//
//     soltar un DXF de verdad → elegir la capa → la parcela entra y SE VE
//
// Hasta F18 esa vía **rechazaba el fichero**: la pantalla de Entrada la anuncia
// con su propio botón desde el rework («Elegir un fichero de medición…») y quien
// lo pulsaba se comía un aviso que le mandaba a la otra rama. Un cartel sin
// puerta detrás.
//
// Las 6.339 pruebas de la suite cubren la lógica. Aquí se mide lo otro:
//
//   1. ⭐ **QUE EL `<dialog>` DE REVISIÓN SEA UN MODAL DE VERDAD.** En jsdom
//      `HTMLDialogElement.prototype` tiene EXACTAMENTE `constructor` y `open`:
//      ni `showModal()`, ni `close()`, ni `cancel`, ni `::backdrop`, ni capa
//      superior, ni atrape de foco. El módulo detecta la capacidad y cae al
//      atributo `open`, así que **la suite entera prueba el camino degradado**.
//      Si `showModal()` fallara en un navegador real —o si el diálogo saliera
//      DEBAJO del mapa por un `z-index`—, saldría verde en los 6.339 tests.
//   2. ⭐ **EL COSTE EN PÍXELES.** F17 rompió la racha de «0 px en el panel» y
//      dejó la lección: ⛔ **cuando el panel se pasa de sitio NO DESBORDA — la
//      tabla de vértices ENCOGE EN SILENCIO**. En jsdom no hay maquetación
//      (`getBoundingClientRect()` devuelve ceros), así que un panel que no cabe
//      sale verde. F18 dice que su coste es CERO porque el `<dialog>` flota;
//      esto lo comprueba en vez de prometerlo.
//   3. ⭐ **QUE LA GEOMETRÍA IMPORTADA SE PINTE.** El visor es suscriptor del
//      store, así que escribir en él debería ser pintar. «Debería»: la firma
//      humana de F08 destapó que el mapa **no reencuadraba nunca** y que las
//      colindantes **no las dibujaba nadie** — dos veces el mismo defecto, y
//      ninguna la vio un test. Aquí se cuentan `<path>` de verdad.
//   4. ⭐ **QUE EL LISTADO DE REPLANTEO PROPIO SE RECHACE POR SU NOMBRE.**
//      Medido el 2026-08-06: sin el detector, `importar()` lo lee mal —15
//      vértices salen como 18 pares— y lo rechaza con **`HUSO_NO_RESUELTO`**,
//      que es plausible, es un bloqueo del catálogo y es MENTIRA. Un
//      diagnóstico correcto en la forma y falso en el fondo manda al usuario a
//      arreglar un huso que no está roto. Aquí se comprueba las DOS mitades:
//      que se dice lo que es, y que **no** se dice lo del huso.
//
// ── RÉGIMEN DE RED: NINGUNA ─────────────────────────────────────────────────
// ⭐ Este guion **no toca ni un servicio**, y no es casualidad: toda la vía de
// medición propia es local por definición —el levantamiento lo trae el técnico—.
// Se cuentan las peticiones que salen y se distinguen las del propio servidor
// (los fixtures y los módulos) de las cartográficas, igual que el guion 16.
//
// ⚠️ **Los fixtures se traen por `fetch` del propio servidor**
// (`test/fixtures/parsers/…`), así que **esto solo funciona en DEV**: `vite
// preview` sirve `dist/`, donde los fixtures no están. Lo mismo que los §16 y §19.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · **Que la capa elegida sea la que el técnico quería.** Que `0` sea la
//     buena en `UTM.dxf` está MEDIDO en la suite (coincide vértice a vértice
//     con `PARCELA.txt`); que el reparto **se entienda sin explicación** es
//     juicio humano y va al `CHECKLIST-HUMANO.md` §14.
//   · **La composición sobre una parcela TRAÍDA del Catastro.** Exige red, y
//     este guion no la toca. La cubren 22 pruebas de
//     `test/app/cableado-medicion.dom.test.js`; que el Diagnóstico se abra
//     después, con un expediente real delante, va al §14.
//   · **El arrastre como gesto de ratón** (§0 del GUION): se disparan
//     `dragenter`/`dragover`/`drop` sobre la ventana, que es donde escucha
//     `app/zona-fichero.js`.
//   · **Coordenadas en grados.** `importar()` las detecta y **esta versión no
//     sabe proyectarlas**: se dice y queda como deuda con dueño en la ficha.

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

/** ¿Ocupa sitio de verdad? Un nodo en el DOM puede medir 0×0 y no ser nada. */
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
  return {
    existe: true,
    caja: c,
    dentroDeLaVentana: dentro,
    esElDeArriba: encima === nodo || nodo.contains(encima),
    tapadoPor: encima && !nodo.contains(encima) ? (encima.className || encima.tagName) : null,
  }
}

/**
 * El gesto. `dragenter` → `dragover` → `drop` sobre la VENTANA, que es donde
 * escucha `app/zona-fichero.js`. **No es un arrastre de ratón** (§0 del GUION).
 */
function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

/**
 * Un `File` con los BYTES REALES del fixture. `arrayBuffer()` y no `text()`: la
 * decisión del encoding es de `gml/decodificar.js` y `text()` la tomaría por él.
 */
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
  DIALOGO: '.gml-dialogo-importacion',
  OPCION_CAPA: '.gml-dialogo-importacion input[data-campo="capa"]',
  IMPORTAR: '.gml-dialogo-importacion [data-accion="importar-medicion"]',
  ESTADO: '.gml-dialogo-importacion [data-estado="dialogo-importacion"]',
  TABLA_VERTICES: '#tabla-vertices',
  PROCEDENCIA: '[data-procedencia="parcela"]',
  AVISOS: '#avisos',
  BOTON_MEDICION: '[data-accion="abrir-medicion"]',
  MAPA: '.leaflet-container',
}

const altoVertices = () => caja($(SEL.TABLA_VERTICES))?.alto ?? null

/**
 * ⛔ **NO es `.leaflet-overlay-pane path`, y la primera corrida lo midió.** El
 * visor de este proyecto pinta en PANES PROPIOS —`parcelaEditada`, `vertices`,
 * `colindantes`, `piezas`…, quince en total—, no en el pane genérico de Leaflet.
 * Con el selector de manual el guion acusaba «no hay ni un `<path>` en el mapa»
 * teniendo la parcela delante, en pantalla y dibujada. Se cuenta el mapa ENTERO.
 */
const pathsDelMapa = () => $$('.leaflet-container path').length

/**
 * Los avisos como LISTA de textos, no como un churro.
 *
 * ⛔ La primera corrida los diffeaba con `textoAvisos().replace(antes, '')`, y eso
 * **acusó en falso**: en cuanto el panel reordena o recorta una tarjeta, `antes`
 * deja de ser subcadena, el `replace` no hace nada y el «delta» pasa a ser el panel
 * entero — con lo que un aviso viejo («Huso ambiguo…», legítimo, de la importación
 * anterior) se leyó como si lo hubiera emitido el fichero recién soltado. Un
 * guardián que compara texto acumulado acusa a quien no ha sido.
 */
const avisosComoLista = () =>
  $$(`${SEL.AVISOS} li, ${SEL.AVISOS} .gml-aviso`).map((n) => n.textContent.trim())

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
  pathsAntes: pathsDelMapa(),
  hayBotonMedicion: tieneCaja($(SEL.BOTON_MEDICION)),
  hayMapa: tieneCaja($(SEL.MAPA)),
}

if (!linea.hayMapa) problemas.push('No hay mapa: la aplicación no ha arrancado.')

// ⚠️ El botón de la vía tiene que VERSE. Es lo que el rework añadió en T6 y lo que
// da sentido a esta fase: sin él, la vía vuelve a ser un secreto.
//
// ⛔ **Pero solo se puede exigir EN ENTRADA, y la primera corrida lo aprendió.** El
// botón vive en el panel de Entrada, y ese panel deja de mostrarse en cuanto el
// rail avanza. Si el guion se lanza dos veces seguidas sobre la misma pestaña, la
// segunda arranca en Validación y la exigencia acusaba a un botón que está donde
// tiene que estar. Es el mismo error de método que el `replace` de los avisos: dar
// por hecho un estado inicial en vez de comprobarlo.
if (linea.paso === 'entrada') {
  if (!linea.hayBotonMedicion) {
    problemas.push(
      'El botón «Elegir un fichero de medición…» no se ve en Entrada. Sin él la vía solo la ' +
        'conoce quien escribió el código.',
    )
  }
  if ($(SEL.BOTON_MEDICION)?.disabled) {
    problemas.push('El botón de medición propia está APAGADO en el arranque.')
  }
} else {
  advertencias.push(
    `La pestaña no arrancaba en «entrada» sino en «${linea.paso}», así que el botón de la vía ` +
      'no se ha podido medir. Recarga la página antes de correr este guion.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ Soltar un DXF real con la rama PARCELA: el diálogo tiene que abrirse
// ═════════════════════════════════════════════════════════════════════════════

const utm = await traerFixture('test/fixtures/parsers/UTM.dxf', 'UTM.dxf')
if (!utm.file) {
  problemas.push(
    `No se ha podido traer el fixture UTM.dxf (${utm.estado ?? utm.error}). ` +
      'Este guion EXIGE `npm run dev`: `vite preview` sirve dist/, sin fixtures.',
  )
}

let modal = null
let capas = []

if (utm.file) {
  soltar(utm.file)
  const dialogo = await esperarA(() => {
    const d = $(SEL.DIALOGO)
    return d && (d.open || d.hasAttribute('open')) ? d : null
  })

  if (!dialogo) {
    problemas.push(
      'Soltar UTM.dxf con la rama PARCELA no abre la revisión. Es exactamente el defecto ' +
        'que F18 viene a cerrar: la pantalla de Entrada anuncia la vía y el fichero no entra.',
    )
  } else {
    capas = $$(SEL.OPCION_CAPA).map((i) => i.value)

    // ── 1.1 · ⭐ ¿Es un modal DE VERDAD? ─────────────────────────────────────
    // Lo que la suite NO puede ver: en jsdom no hay `showModal`.
    const visible = seVeDeVerdad(dialogo)
    const estilo = getComputedStyle(dialogo)
    modal = {
      abiertoPorLaPropiedad: dialogo.open === true, // `showModal()` la pone; el fallback NO
      visible,
      zIndex: estilo.zIndex,
      position: estilo.position,
      // El fondo inerte solo existe si es un modal de verdad.
      hayBackdrop: (() => {
        try {
          return getComputedStyle(dialogo, '::backdrop').backgroundColor !== ''
        } catch {
          return null
        }
      })(),
      capas,
    }

    if (!visible.dentroDeLaVentana) {
      problemas.push(
        `La revisión NO cabe en la ventana (${JSON.stringify(visible.caja)} en ` +
          `${innerWidth}×${innerHeight}): hay decisiones fuera de la pantalla.`,
      )
    }
    if (!visible.esElDeArriba) {
      problemas.push(
        `La revisión está TAPADA por «${visible.tapadoPor}». Un modal por debajo del mapa ` +
          'es un modal que no se puede contestar, y la suite no lo ve.',
      )
    }
    if (!dialogo.open) {
      advertencias.push(
        'El diálogo está abierto por el ATRIBUTO y no por `showModal()`: es el camino ' +
          'degradado que se escribió para jsdom, y en un navegador real no debería usarse.',
      )
    }

    // ── 1.2 · Las cinco capas de UTM.dxf, con la parcela en la «0» ─────────
    if (capas.length !== 5) {
      problemas.push(`La revisión ofrece ${capas.length} capas y UTM.dxf tiene 5: ${capas}.`)
    }
    if (!capas.includes('0')) {
      problemas.push(
        'La capa «0» no está entre las ofrecidas, y es donde está la parcela de verdad ' +
          `de este plano (medido en F11). Ofrecidas: ${capas}.`,
      )
    }

    // ── 1.3 · El botón nace apagado CON su motivo escrito ─────────────────
    const boton = $(SEL.IMPORTAR)
    const motivo = $(SEL.ESTADO)?.textContent?.trim() ?? ''
    if (!boton?.disabled) {
      problemas.push('«Importar» nace ENCENDIDO sin haber elegido capa.')
    }
    if (motivo === '') {
      problemas.push('«Importar» está apagado y MUDO: regla de oro 1.')
    }
    modal.motivoInicial = motivo
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ Elegir la capa «0»: la parcela entra, se ve, y no cuesta un píxel
// ═════════════════════════════════════════════════════════════════════════════

let importado = null

if (modal && capas.includes('0')) {
  const radio = $$(SEL.OPCION_CAPA).find((i) => i.value === '0')
  radio.click()
  await dormir(60)

  const boton = $(SEL.IMPORTAR)
  const seEnciende = boton && !boton.disabled
  if (!seEnciende) problemas.push('Marcar una capa NO enciende «Importar».')

  boton?.click()

  // Que el diálogo se cierre de verdad y no quede un modal fantasma tapando todo.
  const cerrado = await esperarA(() => {
    const d = $(SEL.DIALOGO)
    return !d || (!d.open && !d.hasAttribute('open'))
  })
  if (!cerrado) problemas.push('La revisión no se cierra al importar: queda un modal encima.')

  await dormir(400) // que el visor pinte y el rail se refresque

  const paths = pathsDelMapa()
  const procedencia = $(SEL.PROCEDENCIA)
  const textoProc = procedencia?.textContent?.trim() ?? ''

  const eyebrow = $('[data-eyebrow]')

  importado = {
    paths,
    ganadosRespectoAlArranque: paths - linea.pathsAntes,
    verticesPx: altoVertices(),
    deltaVerticesPx: redondear((altoVertices() ?? 0) - (linea.verticesPx ?? 0)),
    paso: $(SEL.APP)?.dataset.paso ?? null,
    procedencia: textoProc,
    // El renglón vive en el panel de ENTRADA, y tras importar se aterriza en
    // Validación, así que aquí mide 0 px por diseño de la cáscara: lo que se exige
    // es su CONTENIDO. Quien tiene que verse siempre es el eyebrow (ver abajo).
    procedenciaSeVe: tieneCaja(procedencia),
    eyebrow: eyebrow?.textContent?.trim() ?? null,
    eyebrowSeVe: tieneCaja(eyebrow),
    filasEnLaTabla: $$(`${SEL.TABLA_VERTICES} tbody tr`).length,
  }

  // ── 2.0 · ⛔ EL RÓTULO DE PROCEDENCIA DE LA CABECERA ─────────────────────
  // **Este guardián existe porque la primera corrida encontró el defecto.** La
  // cabecera decía «Parcela del Catastro» después de importar el levantamiento del
  // propio técnico: la aplicación afirmando que una geometría venía de la Sede
  // cuando la había dibujado el usuario. Es el error caro que toda la maquinaria de
  // procedencia existe para impedir, y **no lo vio ninguna de las 6.339 pruebas**,
  // porque hasta F18 «no es la demo» implicaba «la trajo el Catastro».
  // ⚠️ **Se acusa por la AFIRMACIÓN, no por la palabra.** El primer intento de este
  // guardián fue `/catastro/i`, y salió rojo sobre el rótulo ya corregido —«Tu
  // medición · **no del Catastro**»— porque la palabra estaba ahí, negada. Un
  // guardián que casa por la forma del texto acusa a la frase que lo arregla: es la
  // misma trampa que F17 pagó tres veces.
  const eyebrowTexto = importado.eyebrow ?? ''
  const afirmaCatastro = /parcela del catastro/i.test(eyebrowTexto)
  const dicequeEsTuya = /medici[óo]n/i.test(eyebrowTexto)
  if (afirmaCatastro || !dicequeEsTuya) {
    problemas.push(
      `⛔ La cabecera dice «${eyebrowTexto}» sobre una medición del propio técnico. Tiene que ` +
        'decir que la geometría es suya: hacerla pasar por oficial es el error caro de la app.',
    )
  }
  if (!importado.eyebrowSeVe) {
    problemas.push('El rótulo de procedencia de la cabecera no se ve.')
  }

  // ── 2.1 · ⭐ La geometría SE PINTA ───────────────────────────────────────
  if (paths === 0) {
    problemas.push(
      'Tras importar no hay ni un `<path>` en el mapa. Es el defecto que la firma humana ' +
        'de F08 destapó dos veces: el store escrito y el mapa sin enterarse.',
    )
  }
  if (importado.filasEnLaTabla === 0) {
    problemas.push('La tabla de vértices está vacía después de importar.')
  }

  // ── 2.2 · ⭐ EL COSTE EN PÍXELES ─────────────────────────────────────────
  // La ficha promete que el `<dialog>` cuesta 0 px del panel. Aquí se mide.
  // ⛔ Un panel que se pasa NO desborda: la tabla encoge en silencio (F17).
  if (importado.deltaVerticesPx < -1) {
    problemas.push(
      `La tabla de vértices ha ENCOGIDO ${Math.abs(importado.deltaVerticesPx)} px al importar ` +
        `(${linea.verticesPx} → ${importado.verticesPx}). F18 dice costar 0 px.`,
    )
  }

  // ── 2.3 · La procedencia dice las tres cosas ─────────────────────────────
  // ⚠️ Se exige el CONTENIDO y no que se vea: ese renglón vive en el panel de
  // Entrada y tras importar se aterriza en Validación, así que mide 0 px por
  // diseño de la cáscara —no por un defecto de F18—. Lo que tiene que verse
  // siempre es el eyebrow, y eso se exige arriba. Se anota la medida igualmente.
  if (!importado.procedenciaSeVe && importado.paso === 'entrada') {
    problemas.push('El renglón de procedencia no se ve estando en Entrada.')
  }
  for (const [que, patron] of [
    ['el nombre del fichero', /UTM\.dxf/],
    ['que NO es del Catastro', /NO del Catastro/i],
    ['la capa elegida', /capa «0»/],
    ['dónde cae la parcela', /huso\s+30/i],
  ]) {
    if (!patron.test(textoProc)) {
      problemas.push(`La procedencia no dice ${que}. Dice: «${textoProc}».`)
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ Nuestro propio listado de replanteo se rechaza POR SU NOMBRE
// ═════════════════════════════════════════════════════════════════════════════
//
// Las dos mitades. Sin el detector, `importar()` lo lee mal y lo rechaza con
// «no se ha podido resolver el huso»: correcto en la forma, falso en el fondo.

let listado = null

{
  const antesPaths = pathsDelMapa()
  const antesFilas = $$(`${SEL.TABLA_VERTICES} tbody tr`).length

  // Se genera con el módulo real de la app: un listado escrito a mano aquí sería
  // una segunda copia, y las segundas copias divergen.
  const mod = await import(new URL('export/coordenadas.js', document.baseURI).href).catch(
    () => null,
  )
  if (!mod) {
    advertencias.push(
      'No se ha podido importar `export/coordenadas.js` desde la página: el rechazo del ' +
        'listado propio queda SIN medir aquí (lo cubre la suite).',
    )
  } else {
    const { texto } = mod.serializarCoordenadasTxt({
      recintos: [
        {
          tipo: 'EXTERIOR',
          vertices: [
            [440123.45, 4470987.65],
            [440133.45, 4470987.65],
            [440133.45, 4470997.65],
            [440123.45, 4470997.65],
          ],
        },
      ],
      refcat: '9398516VK3799G',
      srs: 'EPSG:25830',
      fecha: new Date(Date.UTC(2026, 7, 6)),
    })

    // ⚠️ Se diffea la LISTA, no el churro de texto. Ver `avisosComoLista`: la
    // primera corrida acusó en falso a este fichero por un «Huso ambiguo…» que
    // había emitido la importación ANTERIOR.
    const antesAvisos = avisosComoLista()
    soltar(new File([new TextEncoder().encode(texto)], 'coordenadas.txt', { type: 'text/plain' }))
    await dormir(500)

    const cuenta = new Map()
    for (const a of antesAvisos) cuenta.set(a, (cuenta.get(a) ?? 0) + 1)
    const nuevosItems = avisosComoLista().filter((a) => {
      const quedan = cuenta.get(a) ?? 0
      if (quedan > 0) {
        cuenta.set(a, quedan - 1)
        return false
      }
      return true
    })
    const nuevos = nuevosItems.join(' · ')

    listado = {
      avisosNuevos: nuevosItems.length,
      diceQueEsElNuestro: /listado de coordenadas que genera esta misma aplicación/i.test(nuevos),
      diceLoDelHuso: /huso/i.test(nuevos),
      abrioRevision: !!$(SEL.DIALOGO)?.open,
      pathsIgual: pathsDelMapa() === antesPaths,
      filasIgual: $$(`${SEL.TABLA_VERTICES} tbody tr`).length === antesFilas,
      aviso: nuevos.trim().slice(0, 240),
    }

    if (!listado.diceQueEsElNuestro) {
      problemas.push(
        'Soltar nuestro propio listado de replanteo NO se rechaza por su nombre. ' +
          `Se dijo: «${listado.aviso}».`,
      )
    }
    if (listado.diceLoDelHuso) {
      problemas.push(
        '⛔ Se ha emitido el diagnóstico FALSO del huso sobre nuestro propio listado. Es el ' +
          'defecto exacto que el detector existe para tapar: no hay ningún huso que arreglar.',
      )
    }
    if (!listado.pathsIgual || !listado.filasIgual) {
      problemas.push('El listado de replanteo ha CAMBIADO la geometría en pantalla.')
    }
    if (listado.abrioRevision) {
      problemas.push('El listado de replanteo abre la revisión: se reconoce ANTES de importar.')
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · La red: ninguna
// ═════════════════════════════════════════════════════════════════════════════

const propias = peticiones.filter((u) => /\/test\/fixtures\/|\.js(\?|$)|\.css/.test(u))
const cartograficas = peticiones.filter(
  (u) => /ServidorWMS|Cartografia|ign\.es|wmts|WMTS|ovc\.catastro/i.test(u),
)
const red = {
  total: peticiones.length,
  delPropioServidor: propias.length,
  cartograficas: cartograficas.length,
  aServiciosDeDatos: peticiones.filter((u) => /ovc\.catastro|wfs|wfsBU/i.test(u)).length,
}
if (red.aServiciosDeDatos > 0) {
  problemas.push(
    `La vía de medición propia ha consultado ${red.aServiciosDeDatos} servicio(s) de datos. ` +
      'Es local por definición: el levantamiento lo trae el técnico.',
  )
}

window.fetch = fetchOriginal

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '17-medicion-propia',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'QUE EL REPARTO POR CAPAS SE ENTIENDA SIN EXPLICACIÓN. Que «0» sea la buena en UTM.dxf está medido en la suite; que se comprenda es juicio humano y va al CHECKLIST-HUMANO §14.',
    'LA COMPOSICIÓN SOBRE UNA PARCELA TRAÍDA DEL CATASTRO: exige red. La cubren 22 pruebas de cableado-medicion.dom.test.js; el Diagnóstico abierto sobre un expediente real va al §14.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): se disparan dragenter/dragover/drop sobre la ventana.',
    'COORDENADAS EN GRADOS: importar() las detecta y esta versión NO sabe proyectarlas. Deuda con dueño en la ficha.',
  ],
  linea,
  modal,
  importado,
  listado,
  red,
}
