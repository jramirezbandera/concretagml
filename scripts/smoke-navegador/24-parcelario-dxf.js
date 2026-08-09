// scripts/smoke-navegador/24-parcelario-dxf.js — F22 · T5.1.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// EL DXF DE «CONSULTA MASIVA» DEL CATASTRO, andado de una vez sobre la
// aplicación real y **con el fichero de verdad**:
//
//     soltar la manzana → elegir la capa → ver las OCHO fincas en el mapa →
//     marcar la tuya → cargarla → las otras siete se quedan de parcelario
//
// Hasta F22 ese recorrido moría en «No ha entrado ninguna parcela de ese
// fichero» **después** de haberle pedido al usuario que eligiera una capa que no
// arreglaba nada: se le gastaba la confianza y acababa donde estaba.
//
// ⛔ **Y con el fichero REAL, no con uno montado a mano.** Es la lección que ya
// pagaron los guiones 10 y 15: *el guardián que monta el caso favorable no ve el
// defecto*. Aquí el caso favorable sería un DXF con tres cuadrados; el de verdad
// trae 176 polilíneas en dos capas, 161 textos, ocho referencias catastrales que
// comparten los once primeros caracteres y una finca de 5.165 m² junto a otra de
// 444.
//
// Las 7.325 pruebas de la suite cubren la lógica. Aquí se mide lo otro:
//
//   1. ⭐ **QUE LAS OCHO FINCAS SE VEAN.** Es la decisión 3 de la fase entera:
//      *ocho referencias que comparten once caracteres no se distinguen leyendo,
//      se distinguen viendo*. En jsdom no hay maquetación —`getBoundingClientRect()`
//      devuelve ceros— así que una capa dibujada fuera de la pantalla, o a un
//      zoom donde la manzana mide un píxel, **sale verde en la suite entera**.
//   2. ⭐ **QUE EL RESALTE EXISTA DE VERDAD.** M7 midió que el cajón que el plan
//      dio por reutilizable **no resaltaba nada**. La fase 3 escribió la capa;
//      esto comprueba que en un navegador real marcar en la lista cambia el trazo
//      en el mapa, y que pinchar en el mapa marca en la lista.
//   3. ⭐ **QUE EL `<dialog>` Y EL CAJÓN NO SE PISEN.** En jsdom
//      `HTMLDialogElement.prototype` tiene EXACTAMENTE `constructor` y `open`: ni
//      `showModal()`, ni capa superior, ni `::backdrop`. La suite entera ejercita
//      el camino degradado.
//   4. ⭐ **EL COSTE EN PÍXELES** (criterio 11). La ficha prevé **0 px** porque
//      todo vive en cajón y diálogo, y eso era una PREVISIÓN (M10). ⛔ Y cuando
//      el panel se pasa **no desborda: la tabla de vértices encoge en silencio**
//      (lección de F17, §25).
//   5. ⭐ **QUE LA CABECERA NO MIENTA** (criterio 6). Un DXF de Consulta Masiva es
//      cartografía DEL Catastro, así que decir «Tu medición» sobre él es el error
//      caro de F18 con el signo cambiado — y el criterio que M25 casi vuelve a
//      romper.
//
// ── RÉGIMEN DE RED: NINGUNA ─────────────────────────────────────────────────
// ⭐ Y no es casualidad: **es la mitad menos obvia de la fase**. Ese fichero ES
// el parcelario del entorno, así que el DXF hace sin red lo que hoy solo hace el
// WFS. Si aquí saliera una consulta a un servicio de datos, la fase estaría
// cobrando dos veces por el mismo dato.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
//
//   $B viewport 1280x720
//   $B goto http://localhost:PUERTO/concretagml/        # ⛔ SIN `?demo=`
//   $B wait ".gml-rail-pasos"
//   $B console --clear
//   $B network --clear
//   $B eval scripts/smoke-navegador/24-parcelario-dxf.js
//   $B console --errors
//
// ⛔ **SIN `?demo=`, y el guion ABORTA si lo lleva.** Los veintitrés guiones
// anteriores arrancan con un dataset porque miden lo que pasa DESPUÉS de tener
// una parcela; éste mide la aplicación vacía recibiendo su primer fichero, que es
// la situación del técnico que abre la herramienta con su descarga del Catastro
// delante. Con `?demo=real` habría una parcela en el store, el mapa estaría
// encuadrado en otra provincia y el recuento de colindantes vendría contaminado:
// se estaría midiendo otro caso y saldría verde.
//
// ⚠️ **Los fixtures se traen por `fetch` del propio servidor**
// (`test/fixtures/parsers/…`), así que **esto solo funciona en DEV**: `vite
// preview` sirve `dist/`, donde los fixtures no están. Lo mismo que los §16, §17
// y §19.
//
// ⚠️ **Recarga entre pasadas.** Deja una parcela cargada y siete colindantes
// pintadas. Una segunda corrida sin recargar empezaría desde ahí y abortaría.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · **Que el técnico reconozca SU parcela entre las ocho.** Es el punto
//     bloqueante del `CHECKLIST-HUMANO.md` §20, y es el que justifica la
//     decisión 3. Aquí se mide que se ven y que se distinguen al marcarlas; que
//     se reconozcan es juicio humano.
//   · **Que el siguiente fichero de Consulta Masiva se parezca a éste.** Un solo
//     fichero no es la especificación del formato. Lo que la fase promete es lo
//     que este fichero demuestra.
//   · **El arrastre como gesto de ratón** (§0 del GUION): se disparan
//     `dragenter`/`dragover`/`drop` sobre la ventana, que es donde escucha
//     `app/zona-fichero.js`.
//   · **Las 168 construcciones**, que por la decisión 4 no entran. Se comprueba
//     que se NOMBRAN, no que se lean: eso es deuda declarada con dueño.

const t0 = performance.now()
const problemas = []
const advertencias = []

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const esperarA = async (pred, ms = 5000, cada = 80) => {
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
 * ⛔ **Las TRES patas, y hacen falta las tres** (lección del guion 15): un nodo
 * puede estar en el DOM, medir bien, y estar TAPADO por otro o FUERA de la
 * ventana.
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
    tapadoPor: encima && !nodo.contains(encima) ? encima.className || encima.tagName : null,
  }
}

/** ¿Se solapan dos cajas? Para el guardián de «el cajón no tapa los controles». */
const seSolapan = (a, b) =>
  a !== null && b !== null && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** El gesto de soltar. Sobre la VENTANA, que es donde escucha `app/zona-fichero.js`. */
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
async function traerFixture(ruta, nombre) {
  const url = new URL(ruta, document.baseURI).href
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) return { file: null, url, estado: respuesta.status }
    const bytes = await respuesta.arrayBuffer()
    return { file: new File([bytes], nombre), url, bytes: bytes.byteLength }
  } catch (error) {
    return { file: null, url, error: `${error.name}: ${error.message}` }
  }
}

// ── Selectores del contrato ─────────────────────────────────────────────────

const SEL = {
  APP: '.gml-app',
  MAPA: '.leaflet-container',
  RAIL: '.gml-rail-pasos',
  // El `<dialog>` de reparto por capas (F11).
  // ⚠️ **NUNCA `document.querySelector('dialog')`**: la aplicación monta SIETE y
  // el primero del documento es el de avisos (M27 de F22, y la misma trampa que
  // la lección M8 de F07 dejó escrita para los `data-estado`).
  DIALOGO: '.gml-dialogo-importacion',
  OPCION_CAPA: '.gml-dialogo-importacion input[data-campo="capa"]',
  IMPORTAR: '.gml-dialogo-importacion [data-accion="importar-medicion"]',
  ESTADO_DIALOGO: '.gml-dialogo-importacion [data-estado="dialogo-importacion"]',
  // El cajón de F22 (`viewer/cajon-parcelas.js`).
  CAJON: '.gml-cajon-parcelas',
  CAJON_FICHERO: '.gml-cajon-parcelas [data-comp="fichero"]',
  CANDIDATA: '.gml-cajon-parcelas [data-comp="candidata"]',
  CONFIRMAR: '[data-accion="cargar-parcela-elegida"]',
  DESCARTAR: '[data-accion="descartar-parcelas"]',
  ESTADO_CAJON: '[data-estado="cajon-parcelas"]',
  // La capa de F22 (`viewer/candidatas.js`).
  DIBUJADA: '[data-candidata]',
  RESALTADA: '.gml-candidata--resaltada',
  // El pane de contexto, que es donde acaban las otras siete.
  PANE_COLINDANTES: '.leaflet-colindantes-pane path',
  // Panel y ficha.
  TABLA_VERTICES: '#tabla-vertices',
  FILAS: '.gml-fila-vertice',
  EYEBROW: '[data-eyebrow]',
  PROCEDENCIA: '[data-procedencia="parcela"]',
  FICHA_REFCAT: '[data-ficha="refcat"]',
  FICHA_SUPERFICIE: '[data-ficha="superficie"]',
  FICHA_COLINDANTES: '[data-ficha="colindantes"]',
  AVISOS: '#avisos',
}

const texto = (sel, raiz = document) => ($(sel, raiz)?.textContent ?? '').trim()
const altoVertices = () => caja($(SEL.TABLA_VERTICES))?.alto ?? null

/**
 * ⛔ **NO es `.leaflet-overlay-pane path`.** Este visor pinta en QUINCE panes
 * propios, no en el genérico de Leaflet: con el selector de manual el guion 17
 * acusó «no hay ni un path en el mapa» teniendo la parcela delante.
 */
const pathsDelMapa = () => $$('.leaflet-container path').length

/** Los avisos como LISTA de textos, no como un churro (lección del §26). */
const avisosComoLista = () =>
  $$(`${SEL.AVISOS} li, ${SEL.AVISOS} .gml-aviso`).map((n) => n.textContent.trim())

const algunAvisoDice = (patron) => avisosComoLista().some((a) => patron.test(a))

// ── Red: se cuenta lo que sale ──────────────────────────────────────────────
//
// ⛔ **`performance.getEntriesByType('resource')` y NO un envoltorio de `fetch`,
// y lo aprendió este mismo guion.** La primera versión envolvía `window.fetch` al
// arrancar el guion —o sea DESPUÉS de que los módulos de la aplicación ya
// hubieran capturado su referencia— así que contaba **una** petición mientras el
// navegador hacía tres. Un contador de red instalado tarde no cuenta la red: mide
// su propio envoltorio. Es la lección del §23, que ya lo hacía bien.
const peticiones = () => performance.getEntriesByType('resource').map((r) => r.name)

const cerrar = (extra) => ({
  guion: '24-parcelario-dxf',
  msTotal: redondear(performance.now() - t0, 0),
  ...extra,
})

// ═════════════════════════════════════════════════════════════════════════════
// 0 · ¿Estamos midiendo lo que creemos?
// ═════════════════════════════════════════════════════════════════════════════

const contexto = {
  url: location.href,
  demo: /[?&]demo=([^&]*)/.exec(location.search)?.[1] ?? null,
  viewport: { ancho: innerWidth, alto: innerHeight },
  paso: $(SEL.APP)?.dataset.paso ?? document.body.dataset.paso ?? null,
  rama: $(SEL.APP)?.dataset.rama ?? document.body.dataset.rama ?? null,
  filas: $$(SEL.FILAS).length,
  pathsAntes: pathsDelMapa(),
  verticesPx: altoVertices(),
  hayMapa: tieneCaja($(SEL.MAPA)),
}

if (contexto.demo !== null) {
  return cerrar({
    ok: false,
    abortado: true,
    problemas: [
      `Este guion se lanza SIN \`?demo=\` y se ha lanzado con \`${contexto.demo}\`. Mide la ` +
        'aplicación VACÍA recibiendo su primer fichero, que es la situación del técnico que abre ' +
        'la herramienta con su descarga del Catastro delante. Con un dataset habría una parcela ' +
        'en el store, el mapa estaría encuadrado en otra provincia y el recuento de colindantes ' +
        'vendría contaminado: se estaría midiendo otro caso y saldría verde.',
    ],
    contexto,
  })
}

if (!contexto.hayMapa) {
  return cerrar({
    ok: false,
    abortado: true,
    problemas: ['No hay mapa: la aplicación no ha arrancado.'],
    contexto,
  })
}

if (contexto.filas > 0) {
  return cerrar({
    ok: false,
    abortado: true,
    problemas: [
      `Ya hay ${contexto.filas} vértice(s) en la tabla antes de empezar. Este guion mide qué pasa ` +
        'al soltar el PRIMER fichero sobre una aplicación vacía; con una parcela ya cargada se ' +
        'mediría otra cosa. Recarga la página.',
    ],
    contexto,
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Soltar la manzana de verdad: el reparto por capas
// ═════════════════════════════════════════════════════════════════════════════

const manzana = await traerFixture(
  'test/fixtures/parsers/manzana_consulta_masiva_6346726UF8664N.dxf',
  'ConsultaMasiva_ (90).dxf',
)

if (!manzana.file) {
  return cerrar({
    ok: false,
    abortado: true,
    problemas: [
      `No se ha podido traer el fixture de la manzana (${manzana.estado ?? manzana.error}). ` +
        'Este guion EXIGE `npm run dev`: `vite preview` sirve dist/, sin fixtures.',
    ],
    contexto,
  })
}

soltar(manzana.file)

const dialogo = await esperarA(() => {
  const d = $(SEL.DIALOGO)
  return d && (d.open || d.hasAttribute('open')) ? d : null
})

let reparto = null

if (!dialogo) {
  problemas.push(
    'Soltar el DXF de Consulta Masiva no abre la revisión por capas. El fichero trae DOS capas ' +
      'con polilíneas («Construccion» con 168 y «Parcela» con 8), así que el reparto de F11 ' +
      'tiene que preguntar antes de nada.',
  )
} else {
  const visible = seVeDeVerdad(dialogo)
  const capas = $$(SEL.OPCION_CAPA).map((i) => i.value)
  const boton = $(SEL.IMPORTAR)
  reparto = {
    bytesDelFichero: manzana.bytes,
    capas,
    abiertoPorLaPropiedad: dialogo.open === true, // `showModal()` la pone; el fallback NO
    visible,
    motivoInicial: texto(SEL.ESTADO_DIALOGO),
    // El texto completo de la ventana, para el guardián de abajo.
    dice: (dialogo.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }

  if (!visible.dentroDeLaVentana) {
    problemas.push(
      `La revisión NO cabe en la ventana (${JSON.stringify(visible.caja)} en ` +
        `${innerWidth}×${innerHeight}): hay decisiones fuera de la pantalla.`,
    )
  }
  if (!visible.esElDeArriba) {
    problemas.push(
      `La revisión está TAPADA por «${visible.tapadoPor}». Un modal por debajo del mapa es un ` +
        'modal que no se puede contestar, y la suite no lo ve.',
    )
  }
  if (!dialogo.open) {
    advertencias.push(
      'El diálogo está abierto por el ATRIBUTO y no por `showModal()`: es el camino degradado ' +
        'que se escribió para jsdom, y en un navegador real no debería usarse.',
    )
  }
  if (capas.length !== 2 || !capas.includes('Parcela') || !capas.includes('Construccion')) {
    problemas.push(
      `La revisión ofrece ${capas.length} capa(s) y este fichero tiene DOS con polilíneas ` +
        `(«Construccion» y «Parcela»). Ofrecidas: ${JSON.stringify(capas)}.`,
    )
  }
  if (!boton?.disabled) problemas.push('«Importar» nace ENCENDIDO sin haber elegido capa.')
  if (reparto.motivoInicial === '') {
    problemas.push('«Importar» está apagado y MUDO: regla de oro 1.')
  }

  // ── 1.1 · ⛔ Que la ventana no niegue lo que la fase ha construido ──────
  // El bloqueo `VARIOS_RECINTOS_DISJUNTOS` llegó con un texto DECLARADO
  // provisional en la fase 1 —«todavía no se puede elegir cuál desde aquí»— y las
  // fases 3 y 4 construyeron justo eso. Se acusa por la AFIRMACIÓN y no por la
  // palabra: lo prohibido es negar la elección, no nombrarla.
  reparto.niegaLaEleccion = /todav[íi]a no se puede elegir|no se puede elegir cu[áa]l/i.test(
    reparto.dice,
  )
  if (reparto.niegaLaEleccion) {
    problemas.push(
      '⛔ La ventana de revisión dice que TODAVÍA no se puede elegir cuál de las fincas es la ' +
        'tuya, y la aplicación acaba de aprender a hacerlo. Es un texto provisional con fecha de ' +
        'caducidad declarada al que nadie volvió.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Elegir «Parcela»: el cajón se abre con las OCHO
// ═════════════════════════════════════════════════════════════════════════════

let eleccion = null
let dibujadas = []

if (reparto && reparto.capas.includes('Parcela')) {
  $$(SEL.OPCION_CAPA)
    .find((i) => i.value === 'Parcela')
    .click()
  await dormir(80)

  const boton = $(SEL.IMPORTAR)
  if (boton?.disabled) problemas.push('Marcar la capa «Parcela» NO enciende «Importar».')
  boton?.click()

  const cerrado = await esperarA(() => {
    const d = $(SEL.DIALOGO)
    return !d || (!d.open && !d.hasAttribute('open'))
  })
  if (!cerrado) {
    problemas.push(
      'La revisión no se cierra al importar: queda un modal encima del cajón que hay que ' +
        'contestar debajo.',
    )
  }

  const cajon = await esperarA(() => {
    const c = $(SEL.CAJON)
    return c && tieneCaja(c) ? c : null
  })
  await dormir(300)

  dibujadas = $$(SEL.DIBUJADA)
  const radios = $$(SEL.CANDIDATA)
  const rotulos = radios.map((r) => (r.labels?.[0]?.textContent ?? '').trim())
  const visible = seVeDeVerdad(cajon)

  eleccion = {
    hayCajon: cajon !== null,
    visible,
    candidatas: radios.length,
    rotulos,
    // ⭐ La referencia catastral de cada finca, sacada del rótulo. Es lo que M5
    // dice que el fichero trae dentro y que hasta F22 se tiraba como «anotación».
    conReferencia: rotulos.filter((t) => /^\d{7}[A-Z]{2}\d{4}[A-Z]\b/.test(t)).length,
    marcadasAlNacer: radios.filter((r) => r.checked).length,
    primarioApagado: $(SEL.CONFIRMAR)?.disabled ?? null,
    motivo: texto(SEL.ESTADO_CAJON),
    renglonFichero: texto(SEL.CAJON_FICHERO),
    dibujadasEnElMapa: dibujadas.length,
    // El store sigue vacío: preguntar NO es cargar.
    filas: $$(SEL.FILAS).length,
    verticesPx: altoVertices(),
    deltaVerticesPx: redondear((altoVertices() ?? 0) - (contexto.verticesPx ?? 0)),
  }

  if (!eleccion.hayCajon) {
    return cerrar({
      ok: false,
      abortado: true,
      problemas: [
        ...problemas,
        '⛔ Elegida la capa «Parcela», NO se abre el cajón de elección de finca. Es todo el ' +
          'defecto de F22: hasta esta fase el recorrido acababa aquí, en «No ha entrado ninguna ' +
          'parcela de ese fichero», DESPUÉS de haber pedido y obtenido una decisión que no ' +
          'arreglaba nada.',
      ],
      contexto,
      reparto,
      eleccion,
    })
  }

  // ── 2.1 · Las ocho, con su referencia ──────────────────────────────────
  if (eleccion.candidatas !== 8) {
    problemas.push(
      `El cajón ofrece ${eleccion.candidatas} finca(s) y la capa «Parcela» de este fichero tiene ` +
        'OCHO (medido: 548,05 · 444,11 · 655,70 · 1.098,85 · 862,78 · 5.165,36 · 645,85 · 541,79 m²).',
    )
  }
  if (eleccion.conReferencia !== eleccion.candidatas) {
    problemas.push(
      `Solo ${eleccion.conReferencia} de ${eleccion.candidatas} fincas se ofrecen con su ` +
        'referencia catastral. El fichero las trae dentro, en la capa «RefCatastral», y hasta ' +
        'F22 se tiraban como «anotación»: sin ellas, la lista son ocho superficies anónimas.',
    )
  }
  if (!/RefCatastral/.test(eleccion.renglonFichero)) {
    problemas.push(
      `El renglón del cajón no dice de qué capa salen los nombres: «${eleccion.renglonFichero}». ` +
        'Es lo que separa «la aplicación lo ha medido» de «la aplicación se lo ha inventado».',
    )
  }

  // ── 2.2 · ⭐ NACE SIN NADA MARCADO (M20) ────────────────────────────────
  if (eleccion.marcadasAlNacer !== 0) {
    problemas.push(
      `El cajón nace con ${eleccion.marcadasAlNacer} finca(s) ya marcada(s). Marcar una por ` +
        'defecto es elegir por el usuario en la única pantalla que existe porque la aplicación ' +
        'NO puede elegir: un descuido y se firma la finca del vecino.',
    )
  }
  if (eleccion.primarioApagado !== true) {
    problemas.push('«Cargar la finca elegida» nace ENCENDIDO sin haber marcado ninguna.')
  }
  if (eleccion.motivo === '') {
    problemas.push('«Cargar la finca elegida» está apagado y MUDO: regla de oro 1.')
  }

  // ── 2.3 · El cajón se ve y no lo tapa nada ─────────────────────────────
  if (!visible.dentroDeLaVentana) {
    problemas.push(
      `El cajón de elección NO cabe en la ventana (${JSON.stringify(visible.caja)} en ` +
        `${innerWidth}×${innerHeight}): la decisión está fuera de la pantalla.`,
    )
  }
  if (!visible.esElDeArriba) {
    problemas.push(`El cajón de elección está TAPADO por «${visible.tapadoPor}».`)
  }

  // ── 2.4 · Y NO tapa los controles del mapa (guardián del §16 de F08) ───
  const controles = {
    zoom: caja($('.leaflet-control-zoom')),
    capas: caja($('.leaflet-control-layers')),
    atribucion: caja($('.leaflet-control-attribution')),
    escala: caja($('.leaflet-control-scale')),
  }
  eleccion.tapa = Object.entries(controles)
    .filter(([, c]) => seSolapan(visible.caja, c))
    .map(([nombre]) => nombre)
  if (eleccion.tapa.length > 0) {
    problemas.push(
      `El cajón de elección tapa ${eleccion.tapa.length} control(es) del mapa: ` +
        `${eleccion.tapa.join(', ')}. Son cuatro cajones compartiendo esquina y el sitio hay que ` +
        'medirlo, no suponerlo.',
    )
  }

  // ── 2.5 · Preguntar NO es cargar ────────────────────────────────────────
  if (eleccion.filas > 0) {
    problemas.push(
      `Con la pregunta puesta y sin contestar ya hay ${eleccion.filas} vértice(s) en la tabla. ` +
        'La aplicación ha elegido por el usuario.',
    )
  }

  // ── 2.6 · ⭐ EL COSTE EN PÍXELES (criterio 11) ──────────────────────────
  // ⛔ Un panel que se pasa NO desborda: la tabla encoge en silencio (§25).
  if (eleccion.deltaVerticesPx < -1) {
    problemas.push(
      `La caja de vértices ha ENCOGIDO ${Math.abs(eleccion.deltaVerticesPx)} px al abrir el ` +
        `cajón (${contexto.verticesPx} → ${eleccion.verticesPx}). F22 dice costar 0 px porque ` +
        'todo vive en cajón y diálogo.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ QUE LAS OCHO SE VEAN, que es la decisión 3 de la fase
// ═════════════════════════════════════════════════════════════════════════════
//
// Ocho referencias que comparten los once primeros caracteres NO se distinguen
// leyendo: se distinguen viendo. Si las fincas caen fuera del encuadre —o a un
// zoom donde la manzana entera mide un píxel— el cajón está pidiendo una decisión
// imposible, y **la suite entera sale verde**: en jsdom no hay maquetación.

let sobreElMapa = null

if (eleccion?.hayCajon) {
  const mapa = caja($(SEL.MAPA))
  const cajas = dibujadas.map((el, i) => ({ i: el.dataset.candidata ?? String(i), ...caja(el) }))
  const dentroDelMapa = cajas.filter((c) => seSolapan(c, mapa))
  // 6 px de lado es el mínimo para que se pueda señalar con el ratón sin pelearse.
  const senalables = cajas.filter((c) => c.ancho >= 6 && c.alto >= 6)
  const mayor = cajas.reduce((m, c) => Math.max(m, c.ancho, c.alto), 0)

  sobreElMapa = {
    dibujadas: cajas.length,
    dentroDelMapa: dentroDelMapa.length,
    senalables: senalables.length,
    ladoMayorPx: redondear(mayor),
    // ⚠️ **La escala y no el zoom.** El nivel de zoom de Leaflet no está en el DOM
    // —la primera versión lo sacaba de la URL de una tesela y devolvía `null`
    // siempre, que es un dato que no dice nada dicho con aplomo—. Lo que sí está
    // es lo que el usuario lee: la barra de escala.
    escala: texto('.leaflet-control-scale-line') || null,
    cajas: cajas.map((c) => ({ i: c.i, ancho: c.ancho, alto: c.alto })),
  }

  if (cajas.length !== eleccion.candidatas) {
    problemas.push(
      `El cajón enumera ${eleccion.candidatas} fincas y en el mapa hay ${cajas.length} dibujadas. ` +
        'Dibujar menos de las que se enumeran es el desajuste que nadie nota hasta que elige mal.',
    )
  }
  if (dentroDelMapa.length !== cajas.length) {
    problemas.push(
      `⛔ Solo ${dentroDelMapa.length} de ${cajas.length} fincas caen dentro del mapa visible. El ` +
        'cajón está pidiendo que se elija sobre una cartografía donde las opciones no están.',
    )
  }
  if (senalables.length !== cajas.length) {
    problemas.push(
      `⛔ Solo ${senalables.length} de ${cajas.length} fincas miden más de 6 px de lado (la mayor ` +
        `mide ${sobreElMapa.ladoMayorPx} px). LA DECISIÓN 3 DE LA FASE ES QUE SE ELIGE VIENDO, y ` +
        'ocho manchas de un píxel no se distinguen. En jsdom esto sale verde: no hay maquetación.',
    )
  }

  // ── 3.1 · ⛔ Y QUE EL CAJÓN NO SE PONGA ENCIMA DE LO QUE HAY QUE ELEGIR ──
  // La segunda mitad, y la que la primera corrida destapó: con las ocho DENTRO
  // del mapa, el cajón tapaba CINCO al 100 %. Se pide elegir entre ocho con
  // cinco debajo del panel que hace la pregunta.
  const cajonCaja = eleccion.visible.caja
  const tapadas = cajas
    .map((c) => {
      if (!seSolapan(c, cajonCaja) || c.ancho === 0 || c.alto === 0) return { i: c.i, pct: 0 }
      const ancho = Math.min(c.right, cajonCaja.right) - Math.max(c.left, cajonCaja.left)
      const alto = Math.min(c.bottom, cajonCaja.bottom) - Math.max(c.top, cajonCaja.top)
      return { i: c.i, pct: Math.round((100 * (ancho * alto)) / (c.ancho * c.alto)) }
    })
    .filter((t) => t.pct >= 50)
  sobreElMapa.tapadasPorElCajon = tapadas
  if (tapadas.length > 0) {
    problemas.push(
      `⛔ El cajón tapa más de la mitad de ${tapadas.length} finca(s): ` +
        `${tapadas.map((t) => `${Number(t.i) + 1} (${t.pct} %)`).join(', ')}. Están dentro del ` +
        'mapa y debajo del panel que pide elegirlas: la pregunta se hace a ciegas.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ⭐ EL RESALTE, que es lo que M7 dijo que NO existía
// ═════════════════════════════════════════════════════════════════════════════

let resalte = null

if (eleccion?.hayCajon && eleccion.candidatas >= 3) {
  const radios = $$(SEL.CANDIDATA)
  const objetivo = 2 // la tercera de la lista
  radios[objetivo].click()
  await dormir(200)

  const resaltada = $(SEL.RESALTADA)
  const nodo = $(`[data-candidata="${objetivo}"]`)
  const otro = $('[data-candidata="0"]')
  const estilo = (el) => (el ? getComputedStyle(el) : null)

  resalte = {
    // ⚠️ Por el ATRIBUTO y NO por posición: `resaltar` llama a `bringToFront`, que
    // REORDENA el DOM, así que desde el primer resalte «el tercer <path>» y «la
    // tercera finca» dejan de ser lo mismo (M21).
    cualLleva: resaltada?.dataset.candidata ?? null,
    cuantasResaltadas: $$(SEL.RESALTADA).length,
    grosorMarcada: estilo(nodo)?.strokeWidth ?? null,
    grosorOtra: estilo(otro)?.strokeWidth ?? null,
    colorMarcada: estilo(nodo)?.stroke ?? null,
    colorOtra: estilo(otro)?.stroke ?? null,
    // Al frente: en una manzana TODAS comparten lindero.
    esLaUltimaDelDom: $$(SEL.DIBUJADA).at(-1)?.dataset.candidata ?? null,
    primarioEncendido: $(SEL.CONFIRMAR)?.disabled === false,
    motivoTrasMarcar: texto(SEL.ESTADO_CAJON),
  }

  if (resalte.cualLleva !== String(objetivo) || resalte.cuantasResaltadas !== 1) {
    problemas.push(
      `Marcar la finca ${objetivo + 1} en la lista deja ${resalte.cuantasResaltadas} resaltada(s) ` +
        `en el mapa (la «${resalte.cualLleva}»). El resalte es la mitad que la decisión 3 compró ` +
        'y que M7 midió que NO existía en el cajón que el plan dio por reutilizable.',
    )
  }
  if (resalte.colorMarcada === resalte.colorOtra && resalte.grosorMarcada === resalte.grosorOtra) {
    problemas.push(
      `La finca marcada se pinta exactamente igual que las demás (trazo ${resalte.colorMarcada}, ` +
        `${resalte.grosorMarcada}). En el navegador el resalte no se ve, aunque el estilo esté ` +
        'puesto en el objeto de Leaflet.',
    )
  }
  if (resalte.esLaUltimaDelDom !== String(objetivo)) {
    problemas.push(
      'La finca resaltada NO está al frente del SVG. En una manzana todas comparten lindero, así ' +
        'que su trazo grueso queda por debajo justo en el borde que hay que comparar.',
    )
  }
  if (!resalte.primarioEncendido) {
    problemas.push('Marcar una finca NO enciende «Cargar la finca elegida».')
  }

  // ── 4.1 · ⭐ Y el camino INVERSO: pinchar en el mapa marca en la lista ──
  const otroIndice = 5
  const otraFinca = $(`[data-candidata="${otroIndice}"]`)
  if (otraFinca) {
    const c = caja(otraFinca)
    otraFinca.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(c.left + c.ancho / 2),
        clientY: Math.round(c.top + c.alto / 2),
      }),
    )
    await dormir(200)
    resalte.trasPinchar = {
      radioMarcado: $$(SEL.CANDIDATA).findIndex((r) => r.checked),
      resaltada: $(SEL.RESALTADA)?.dataset.candidata ?? null,
    }
    if (resalte.trasPinchar.radioMarcado !== otroIndice) {
      problemas.push(
        `Pinchar la finca ${otroIndice + 1} en el mapa deja marcado el radio ` +
          `${resalte.trasPinchar.radioMarcado + 1} en la lista. La pantalla estaría diciendo dos ` +
          'cosas distintas a la vez sobre cuál se va a cargar.',
      )
    }
  } else {
    advertencias.push(
      `No se ha podido pinchar la finca ${otroIndice + 1} en el mapa: no hay nodo con ` +
        `\`data-candidata="${otroIndice}"\`. El camino mapa → lista queda SIN medir aquí.`,
    )
  }

  // Se deja marcada la PRIMERA, que es la del expediente de este fichero
  // (6346726UF8664N, la que da nombre al fixture y la que se midió en M2).
  $$(SEL.CANDIDATA)[0].click()
  await dormir(150)
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Cargar la finca elegida: entra una y las otras siete se quedan
// ═════════════════════════════════════════════════════════════════════════════

let cargada = null

if (eleccion?.hayCajon) {
  const antesAvisos = avisosComoLista().length
  $(SEL.CONFIRMAR)?.click()
  await dormir(700)

  cargada = {
    filas: $$(SEL.FILAS).length,
    paths: pathsDelMapa(),
    ganados: pathsDelMapa() - contexto.pathsAntes,
    refcat: texto(SEL.FICHA_REFCAT),
    superficie: texto(SEL.FICHA_SUPERFICIE),
    colindantes: texto(SEL.FICHA_COLINDANTES),
    eyebrow: texto(SEL.EYEBROW),
    procedencia: texto(SEL.PROCEDENCIA),
    cajonCerrado: !tieneCaja($(SEL.CAJON)),
    candidatasSueltas: $$(SEL.DIBUJADA).length,
    vecinasDibujadas: $$(SEL.PANE_COLINDANTES).length,
    verticesPx: altoVertices(),
    deltaVerticesPx: redondear((altoVertices() ?? 0) - (contexto.verticesPx ?? 0)),
    avisosNuevos: avisosComoLista().length - antesAvisos,
    paso: $(SEL.APP)?.dataset.paso ?? document.body.dataset.paso ?? null,
  }

  // ── 5.1 · La parcela ENTRA (criterio 1) ────────────────────────────────
  if (cargada.filas === 0) {
    problemas.push(
      'Tras pulsar «Cargar la finca elegida» la tabla de vértices sigue vacía: no ha entrado ' +
        'ninguna parcela. Es el criterio 1 de la fase.',
    )
  }
  if (cargada.paths === 0) {
    problemas.push(
      'Tras cargar la finca no hay ni un `<path>` en el mapa. Es el defecto que la firma humana ' +
        'de F08 destapó dos veces: el store escrito y el mapa sin enterarse.',
    )
  }
  if (!/^6346726UF8664N/.test(cargada.refcat)) {
    problemas.push(
      `La ficha dice que la referencia catastral es «${cargada.refcat}» y la finca elegida es la ` +
        '6346726UF8664N, que el fichero trae escrita dentro. La referencia no viene de una ' +
        'consulta: viene del dibujo.',
    )
  }
  // 548,05 m² medidos con el shoelace de `geo/area.js` (M2).
  if (!/548[,.]0/.test(cargada.superficie)) {
    problemas.push(
      `La ficha dice que la superficie es «${cargada.superficie}» y la finca 6346726UF8664N mide ` +
        '548,05 m² (medido con el shoelace del proyecto sobre este mismo fichero).',
    )
  }

  // ── 5.2 · ⭐ LA CABECERA NO MIENTE (criterio 6) ─────────────────────────
  // Un DXF de Consulta Masiva es cartografía DEL Catastro: decir «Tu medición»
  // sobre él es el error caro de F18 con el signo cambiado. Y decir «Parcela del
  // Catastro» a secas tampoco vale: no se ha consultado ningún servicio.
  // ⚠️ Se acusa por la AFIRMACIÓN y no por la palabra: «Tu medición · no del
  // Catastro» contiene «Catastro» y es lo contrario de lo que se busca.
  cargada.diceQueEsTuMedicion = /tu medici[óo]n/i.test(cargada.eyebrow)
  cargada.diceDeDondeSale = /del dibujo/i.test(cargada.eyebrow)
  if (cargada.diceQueEsTuMedicion) {
    problemas.push(
      `⛔ La cabecera dice «${cargada.eyebrow}» sobre cartografía que el técnico ha DESCARGADO ` +
        'del Catastro, no medido. Es el error caro de F18 con el signo cambiado: atribuirle al ' +
        'usuario una geometría que no es suya.',
    )
  }
  if (!cargada.diceDeDondeSale) {
    problemas.push(
      `La cabecera dice «${cargada.eyebrow}» y no cuenta que la geometría sale del DIBUJO. Que ` +
        'venga del Catastro y que venga de una consulta al Catastro son dos afirmaciones ' +
        'distintas, y solo una es verdad aquí.',
    )
  }

  // ── 5.2 bis · ⛔ Y LOS DOS RENGLONES TIENEN QUE DECIR LO MISMO ─────────
  // El guion encontró a la aplicación afirmando dos cosas contrarias sobre la
  // misma geometría con dos centímetros de separación: la cabecera decía
  // «Cartografía del Catastro» y el renglón de debajo «medida por ti — NO del
  // Catastro». Una cabecera correcta con un pie que la desmiente no es media
  // verdad: es la misma mentira, y la que se lee al firmar es la de abajo.
  cargada.procedenciaNiegaElCatastro = /medida por ti|NO del Catastro/i.test(cargada.procedencia)
  if (cargada.procedenciaNiegaElCatastro) {
    problemas.push(
      `⛔ La cabecera dice «${cargada.eyebrow}» y el renglón de procedencia dice ` +
        `«${cargada.procedencia.slice(0, 120)}…». Las dos frases hablan de la MISMA geometría y ` +
        'no pueden ser verdad a la vez.',
    )
  }
  if (!/6346726UF8664N/.test(cargada.procedencia)) {
    problemas.push(
      'El renglón de procedencia no dice de dónde sale la referencia catastral. Viene escrita en ' +
        `el propio dibujo, y eso es lo que la separa de una consulta: «${cargada.procedencia}».`,
    )
  }

  // ── 5.3 · Las otras SIETE se quedan (criterio 5, la decisión 1) ────────
  if (cargada.vecinasDibujadas < 7) {
    problemas.push(
      `Solo hay ${cargada.vecinasDibujadas} vecina(s) dibujada(s) en el pane de contexto y el ` +
        'dibujo traía SIETE además de la elegida. La decisión 1 de la fase es lo que convierte ' +
        'un arreglo en una vía nueva: el DXF hace sin red lo que hoy solo hace el WFS.',
    )
  }
  if (!/^7\b/.test(cargada.colindantes)) {
    problemas.push(
      `La ficha cuenta «${cargada.colindantes}» colindantes con siete dibujadas en el mapa. Es el ` +
        'defecto de orden que la fase 4 encontró con un test en rojo (M26): `alCargarParcela` ' +
        'significa «documento nuevo» y resetea el recuento.',
    )
  }
  if (!/del dibujo/i.test(cargada.colindantes)) {
    problemas.push(
      `La ficha dice «${cargada.colindantes}» a secas. Ese renglón cuenta las parcelas que trae ` +
        'el WFS, y éstas vienen del fichero: sin el matiz, la ficha atribuye al Catastro una ' +
        'consulta que nadie ha hecho.',
    )
  }

  // ── 5.3 bis · ⛔ Y NO se aterriza en Diagnóstico ────────────────────────
  // Una finca de este fichero entra con `recintos === geometriaOficial`, así que
  // el encaje vale CERO **por construcción** —la propia ficha de F22 avisa de que
  // nadie lea ese cero como una verificación— y aterrizar ahí enseña un dictamen
  // tautológico como si fuera un resultado. Y tenía una segunda mitad, peor: abrir
  // el Diagnóstico dispara la consulta de vecinas, que se llevaba por delante las
  // siete del dibujo.
  if (cargada.paso === 'diagnostico') {
    problemas.push(
      '⛔ Tras cargar la finca se aterriza en DIAGNÓSTICO. Con `recintos === geometriaOficial` ' +
        'el encaje vale cero por construcción, así que ese cero no es una verificación de nada; ' +
        'y abrir esa pantalla pide las colindantes al Catastro, que sustituyen a las del dibujo.',
    )
  }

  // ── 5.4 · El cajón se suelta ────────────────────────────────────────────
  if (!cargada.cajonCerrado) {
    problemas.push('El cajón de elección sigue abierto después de cargar la finca.')
  }
  if (cargada.candidatasSueltas !== 0) {
    problemas.push(
      `Quedan ${cargada.candidatasSueltas} candidata(s) dibujadas después de elegir. La pregunta ` +
        'ya está contestada y su geometría sigue encima de la respuesta.',
    )
  }

  // ── 5.5 · El coste en píxeles, ya con datos ────────────────────────────
  if (cargada.deltaVerticesPx < -1 && contexto.verticesPx > 0) {
    problemas.push(
      `La caja de vértices ha ENCOGIDO ${Math.abs(cargada.deltaVerticesPx)} px respecto al ` +
        'arranque. F22 dice costar 0 px del panel.',
    )
  }

  // ── 5.6 · Lo que se ha contado por el panel ─────────────────────────────
  cargada.dijoLoDeLasConstrucciones = algunAvisoDice(/168 polil[íi]nea\(s\) en la capa «Construccion»/)
  cargada.dijoDeDondeVienenLasVecinas = algunAvisoDice(/no una consulta al Catastro/i)
  if (!cargada.dijoLoDeLasConstrucciones) {
    problemas.push(
      'El panel no ha dicho nada de las 168 polilíneas de «Construccion» que el usuario ve en su ' +
        'CAD y que no entran. Ignorarlas en silencio son 168 motivos para desconfiar de lo que ' +
        'sí ha entrado (decisión 4).',
    )
  }
  if (!cargada.dijoDeDondeVienenLasVecinas) {
    advertencias.push(
      'El panel no ha dicho que las otras fincas salen del fichero y no de una consulta al ' +
        'Catastro. No es un fallo de geometría, pero es la frase que impide leer el parcelario ' +
        'del dibujo como una consulta al servicio.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · La red: ninguna, y es la mitad menos obvia de la fase
// ═════════════════════════════════════════════════════════════════════════════

const salidas = peticiones()
// ⚠️ **La cartografía de fondo NO cuenta y los datos SÍ**, y viven en el mismo
// dominio: `…/Cartografia/WMS/ServidorWMS.aspx` es la ortofoto que el mapa pinta
// siempre, y `…/INSPIRE/wfsCP.aspx` o `Consulta_RCCOOR` son preguntas por el DATO
// de esta parcela. Filtrar por `ovc.catastro` a secas mezclaría las dos.
// ⚠️ Y **solo lo que sale de este origen**: `services/_catastro-wfs.js` es un
// módulo de la propia aplicación servido por Vite, y casaba con el patrón. Un
// contador de red que acusa a un `import` es un contador que hay que arreglar
// antes de creerle nada.
const aServicios = salidas.filter(
  (u) => !u.startsWith(location.origin) && /wfs|Consulta_RCC|INSPIRE|Consulta_DNPRC/i.test(u),
)
const red = {
  total: salidas.length,
  delPropioServidor: salidas.filter((u) => u.startsWith(location.origin)).length,
  cartograficas: salidas.filter((u) => /ServidorWMS|Cartografia|ign\.es|wmts|WMTS/i.test(u)).length,
  aServiciosDeDatos: aServicios.length,
  cuales: aServicios.map((u) => u.slice(0, 120)),
}
if (red.aServiciosDeDatos > 0) {
  problemas.push(
    `Se han consultado ${red.aServiciosDeDatos} servicio(s) de datos del Catastro. Este fichero ` +
      'ES el parcelario del entorno: si además hay que preguntarlo, la fase está cobrando dos ' +
      'veces por el mismo dato — y lo que conteste el servicio SUSTITUYE a lo que traía el ' +
      `dibujo. ${JSON.stringify(red.cuales)}`,
  )
}

// ⛔ **Y la caché puede tapar esto, así que se dice.** F05 guarda las respuestas en
// IndexedDB, y una consulta servida desde la caché no deja ni una entrada de red:
// este guion salió VERDE en su primera corrida por eso mismo, con la aplicación
// pidiendo las colindantes y machacando las del dibujo. Un contador de red no
// distingue «no se ha preguntado» de «ya lo teníamos apuntado».
if (red.aServiciosDeDatos === 0 && cargada !== null && cargada.vecinasDibujadas < 7) {
  advertencias.push(
    'No consta ninguna consulta de datos y aun así faltan vecinas del dibujo. Puede ser la caché ' +
      'de F05 (IndexedDB) sirviendo una respuesta guardada: bórrala y vuelve a lanzar antes de ' +
      'dar por buena la ausencia de red.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Contrato K.1: ni un `data-accion` repetido
// ═════════════════════════════════════════════════════════════════════════════
//
// Con el cajón nuevo montado a la vez que los otros tres de la esquina, un
// `data-accion` duplicado haría que los clics de uno acabaran en el otro —y
// `querySelector` se queda con el primero aunque esté oculto.

const todas = $$('[data-accion]').map((b) => b.dataset.accion)
const repetidos = [...new Set(todas.filter((a, i) => todas.indexOf(a) !== i))]
if (repetidos.length > 0) {
  problemas.push(`Hay \`data-accion\` REPETIDOS en el documento: ${repetidos.join(', ')}. Contrato K.1.`)
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return cerrar({
  ok: problemas.length === 0,
  problemas,
  advertencias,
  noCubierto: [
    'QUE EL TÉCNICO RECONOZCA SU PARCELA ENTRE LAS OCHO. Es el punto BLOQUEANTE del CHECKLIST-HUMANO §20 y lo que justifica la decisión 3. Aquí se mide que se ven y que se distinguen al marcarlas.',
    'QUE EL SIGUIENTE FICHERO DE CONSULTA MASIVA SE PAREZCA A ÉSTE. Un solo fichero no es la especificación del formato.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): se disparan dragenter/dragover/drop sobre la ventana.',
    'LAS 168 CONSTRUCCIONES: por la decisión 4 no entran. Se comprueba que se NOMBRAN, no que se lean; leerlas es deuda declarada con dueño.',
  ],
  contexto,
  reparto,
  eleccion,
  sobreElMapa,
  resalte,
  cargada,
  red,
  repetidos,
})
