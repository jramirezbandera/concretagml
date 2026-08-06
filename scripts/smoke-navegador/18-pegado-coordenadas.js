// scripts/smoke-navegador/18-pegado-coordenadas.js — F19 · T4.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LAS TRES DEUDAS QUE F18 DEJÓ CON DUEÑO, andadas sobre la aplicación real:
//
//     pegar la LISTA de AutoCAD → la parcela entra y SE VE
//     pegar unas coordenadas EN GRADOS → se ofrece proyectarlas → entran en metros
//     soltar el GML de otro técnico → la cabecera lo DICE → cruzar la puerta
//
// La primera es «la vía principal» de `feature-01` y llevaba doce fases sin un
// solo manejador de `paste` en producción. Las otras dos son los dos números que
// F18 midió al pasar y dejó escritos sin tocar.
//
// La suite (6.389 pruebas) cubre la lógica. Aquí se mide lo otro:
//
//   1. ⭐ **QUE EL `<dialog>` DE PEGADO SEA UN MODAL DE VERDAD.** En jsdom
//      `HTMLDialogElement.prototype` tiene EXACTAMENTE `constructor` y `open`:
//      ni `showModal()`, ni capa superior, ni `::backdrop`. Toda la suite del
//      diálogo ejercita **el camino degradado**. Si el modal saliera DEBAJO del
//      mapa por un `z-index`, las 6.389 seguirían verdes.
//   2. ⭐ **QUE `Ctrl+V` DE VERDAD ESCRIBA EN EL CAMPO.** La suite dispara
//      `input` a mano. Aquí se pega con un `ClipboardEvent` real y se comprueba
//      que la vista previa reacciona: si el campo estuviera tapado, en
//      `readonly`, o el foco no fuera suyo, el gesto se perdería en silencio.
//   3. ⭐ **QUE LAS DOS CIFRAS DE SUPERFICIE SE LEAN.** Están en el DOM en un
//      test; que se VEAN —caja con alto, no tapadas, dentro de la ventana— solo
//      se puede medir aquí. Es el dato que `importar()` calcula desde F01 y que
//      nadie leía.
//   4. ⭐ **EL COSTE EN PÍXELES.** En jsdom no hay maquetación, así que un panel
//      que no cabe sale verde. F17 dejó la lección: ⛔ **cuando el panel se pasa
//      NO DESBORDA — la tabla de vértices ENCOGE EN SILENCIO**.
//   5. ⭐ **QUE LA GEOMETRÍA PEGADA SE PINTE.** Se cuentan `<path>` de verdad, y
//      en el MAPA ENTERO: el visor pinta en quince panes propios, no en
//      `.leaflet-overlay-pane` (lección medida en el guion 17).
//
// ── RÉGIMEN DE RED: NINGUNA ─────────────────────────────────────────────────
// Pegar coordenadas es local por definición. Se cuenta lo que sale.
//
// ⚠️ **Los fixtures se traen por `fetch` del propio servidor**, así que esto solo
// funciona en DEV: `vite preview` sirve `dist/`, donde los fixtures no están.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · **Que el usuario entienda por qué se le pregunta antes de proyectar.** Es
//     juicio humano y va al `CHECKLIST-HUMANO.md` §15.
//   · **El portapapeles del sistema.** Se sintetiza un `ClipboardEvent` con su
//     `DataTransfer`; leer el portapapeles real exige permiso del usuario.
//   · **Canarias.** No hay fixture y no se inventa uno: lo cubren la suite y la
//     ficha.

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
 * ⛔ **Las TRES patas, y hacen falta las tres** (lección del guion 15): un nodo
 * puede estar en el DOM, medir bien, y estar TAPADO por otro o FUERA de la
 * ventana. «Existe» no es «se ve».
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

/**
 * Pegar DE VERDAD: un `ClipboardEvent` con su `DataTransfer`, sobre el campo
 * enfocado. **No se escribe `.value` a mano**, que es lo que hace la suite: eso
 * daría por bueno un campo tapado, en `readonly` o sin el foco.
 *
 * El navegador aplica el pegado por su cuenta si el evento no se cancela; se
 * comprueba después si el texto llegó, y solo si NO llegó se escribe a mano y se
 * deja constancia en `advertencias` (que es un dato, no un aprobado).
 */
function pegarEn(campo, texto) {
  campo.focus()
  const dt = new DataTransfer()
  dt.setData('text/plain', texto)
  const evento = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt,
  })
  const entregado = campo.dispatchEvent(evento)
  return { entregado, valorTrasPegar: campo.value }
}

/** Escribe en el campo como último recurso, disparando el `input` que oye el módulo. */
function escribirEn(campo, texto) {
  campo.value = texto
  campo.dispatchEvent(new Event('input', { bubbles: true }))
}

function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

async function traerTexto(ruta) {
  const url = new URL(ruta, document.baseURI).href
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) return { texto: null, url, estado: respuesta.status }
    return { texto: await respuesta.text(), url }
  } catch (error) {
    return { texto: null, url, error: `${error.name}: ${error.message}` }
  }
}

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
  BOTON_PEGAR: '[data-accion="abrir-pegado"]',
  DIALOGO: '.gml-dialogo-pegado',
  CAMPO: '.gml-dialogo-pegado [data-campo="pegado"]',
  TITULAR: '.gml-dialogo-pegado [data-titular="pegado"]',
  LECTURA: '.gml-dialogo-pegado [data-lectura="pegado"]',
  MOTIVO: '.gml-dialogo-pegado [data-motivo="pegado"]',
  USAR: '.gml-dialogo-pegado [data-accion="usar-pegado"]',
  CANCELAR: '.gml-dialogo-pegado [data-accion="cancelar-pegado"]',
  REVISION: '.gml-dialogo-importacion',
  OPCION_GRADOS: '.gml-dialogo-importacion input[data-campo="grados"]',
  IMPORTAR: '.gml-dialogo-importacion [data-accion="importar-medicion"]',
  TABLA_VERTICES: '#tabla-vertices',
  PROCEDENCIA: '[data-procedencia="parcela"]',
  EYEBROW: '[data-eyebrow]',
  PUERTA: '[data-accion="tomar-geometria"]',
  CONTRASTAR: '[data-accion="contrastar-parcelario"]',
  MAPA: '.leaflet-container',
}

const altoVertices = () => caja($(SEL.TABLA_VERTICES))?.alto ?? null
const pathsDelMapa = () => $$('.leaflet-container path').length
const eyebrow = () => $(SEL.EYEBROW)?.textContent.trim() ?? null

/**
 * Las filas DE VÉRTICE de la tabla.
 *
 * ⛔ **No es `tbody tr`, y la primera corrida lo midió acusando en falso.** El
 * `<tbody>` lleva **una fila de cabecera por recinto** (`<th colspan="3">EXTERIOR
 * </th>`), así que una parcela de 11 vértices tiene **12 filas** y el guion
 * denunció «no tiene 11 filas, sino 12» sobre una tabla perfectamente correcta.
 * Se cuentan las filas que traen campos, que son las que son un vértice.
 */
const filasDeVertice = () =>
  $$(`${SEL.TABLA_VERTICES} tbody tr`).filter((tr) => tr.querySelector('input'))

/**
 * La coordenada de un vértice.
 *
 * ⛔ **Tampoco es `td.textContent`, y es el segundo acuse en falso de la misma
 * corrida.** La tabla de vértices es EDITABLE desde F06: los números viven en
 * `<input value>` y el texto de la celda está vacío. El guion leyó «» y denunció
 * que la proyección no había entrado, teniendo 373.062,907 delante.
 */
const coordenadasDeFila = (tr) => [...tr.querySelectorAll('input')].map((i) => i.value)

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
  hayBotonPegar: tieneCaja($(SEL.BOTON_PEGAR)),
  hayMapa: tieneCaja($(SEL.MAPA)),
  eyebrow: eyebrow(),
}

if (!linea.hayMapa) problemas.push('No hay mapa: la aplicación no ha arrancado.')

// ⚠️ Solo se puede exigir EN ENTRADA, y es la lección del guion 17: el botón vive
// en el panel de Entrada y ese panel deja de mostrarse en cuanto el rail avanza.
// Dar por hecho el estado inicial en vez de comprobarlo acusa a quien no ha sido.
if (linea.paso === 'entrada') {
  if (!linea.hayBotonPegar) {
    problemas.push(
      '⛔ El botón «Pegar coordenadas…» no se ve en Entrada. Sin él, la vía que feature-01 llama ' +
        'PRINCIPAL sigue sin existir para el usuario.',
    )
  }
  if ($(SEL.BOTON_PEGAR)?.disabled) {
    problemas.push('El botón de pegado está APAGADO en el arranque.')
  }
} else {
  advertencias.push(
    `La pestaña no arrancaba en «entrada» sino en «${linea.paso}»: recarga antes de correr esto.`,
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ Pegar la LISTA real de AutoCAD
// ═════════════════════════════════════════════════════════════════════════════

const list = await traerTexto('test/fixtures/parsers/LIST.txt')
if (!list.texto) {
  problemas.push(
    `No se ha podido traer LIST.txt (${list.estado ?? list.error}). Este guion EXIGE \`npm run dev\`.`,
  )
}

let modal = null
let previa = null
let pegado = null

if (list.texto && linea.paso === 'entrada') {
  $(SEL.BOTON_PEGAR).click()
  const dialogo = await esperarA(() => {
    const d = $(SEL.DIALOGO)
    return d && (d.open || d.hasAttribute('open')) ? d : null
  })

  if (!dialogo) {
    problemas.push('Pulsar «Pegar coordenadas…» no abre ninguna pantalla.')
  } else {
    // ── 1.1 · ⭐ ¿Es un modal DE VERDAD? ─────────────────────────────────────
    const visible = seVeDeVerdad(dialogo)
    const estilo = getComputedStyle(dialogo)
    const campo = $(SEL.CAMPO)
    modal = {
      abiertoPorLaPropiedad: dialogo.open === true, // `showModal()` la pone; el fallback NO
      visible,
      zIndex: estilo.zIndex,
      position: estilo.position,
      hayBackdrop: (() => {
        try {
          return getComputedStyle(dialogo, '::backdrop').backgroundColor !== ''
        } catch {
          return null
        }
      })(),
      // ⭐ El foco tiene que estar EN EL CAMPO: quien abre esto viene a pegar, y
      // un Ctrl+V con el foco en otro sitio no pega nada y parece que no funciona.
      focoEnElCampo: document.activeElement === campo,
      campoVisible: seVeDeVerdad(campo),
      botonApagadoAlAbrir: $(SEL.USAR)?.disabled === true,
      motivoAlAbrir: $(SEL.MOTIVO)?.textContent.trim() || null,
    }

    if (!modal.abiertoPorLaPropiedad) {
      problemas.push(
        '⛔ El diálogo de pegado NO se ha abierto con `showModal()`: `dialogo.open` es false, así ' +
          'que se ha caído al atributo `open`. En un navegador real eso significa sin capa ' +
          'superior, sin backdrop y sin atrape de foco.',
      )
    }
    if (!visible.dentroDeLaVentana) problemas.push('El diálogo de pegado se sale de la ventana.')
    if (!visible.esElDeArriba) {
      problemas.push(`El diálogo de pegado está TAPADO por «${visible.tapadoPor}».`)
    }
    if (!modal.focoEnElCampo) {
      problemas.push('⛔ El foco NO está en el campo al abrir: un Ctrl+V se perdería.')
    }
    // Regla de oro 1: botón apagado CON el motivo al lado, jamás mudo.
    if (modal.botonApagadoAlAbrir && !modal.motivoAlAbrir) {
      problemas.push('El botón «Usar…» nace apagado y SIN motivo escrito al lado.')
    }

    // ── 1.2 · ⭐ Pegar de verdad, con un ClipboardEvent ──────────────────────
    const resultado = pegarEn(campo, list.texto)
    await dormir(120)
    let comoLlego = 'ClipboardEvent'
    if (!campo.value.includes('Ubicación')) {
      escribirEn(campo, list.texto)
      comoLlego = 'valor escrito a mano'
      advertencias.push(
        'El `ClipboardEvent` sintético no ha escrito en el campo (el navegador puede no aplicar ' +
          'el pegado por defecto de un evento no fiable). Se ha escrito el valor a mano; el ' +
          'gesto REAL con el teclado queda para el checklist humano.',
      )
    }
    await dormir(120)

    // ── 1.3 · ⭐ La vista previa, y que SE VEA ───────────────────────────────
    const titular = $(SEL.TITULAR)?.textContent.trim() ?? ''
    const renglones = $$('.gml-dialogo-pegado-renglon').map((n) => n.textContent.trim())
    const superficie = renglones.find((t) => /superficie/i.test(t)) ?? null
    previa = {
      comoLlego,
      entregado: resultado.entregado,
      titular,
      renglones,
      superficie,
      lecturaVisible: seVeDeVerdad($(SEL.LECTURA)),
      botonEncendido: $(SEL.USAR)?.disabled === false,
    }

    if (!/11 vértices/.test(titular)) {
      problemas.push(`La vista previa no cuenta los 11 vértices del listado real: «${titular}».`)
    }
    if (!/LISTA de AutoCAD/i.test(titular)) {
      problemas.push(`La vista previa no dice qué formato ha leído: «${titular}».`)
    }
    // ⭐ LAS DOS CIFRAS. Es el cotejo que `importar()` calculaba desde F01 sin que
    // nadie lo leyera, y la decisión 4 pide enseñarlo SIEMPRE, coincidan o no.
    if (!superficie) {
      problemas.push(
        '⛔ La vista previa NO enseña el cotejo de superficie. Es el único cotejo gratis que ' +
          'tiene el proyecto y el único momento en el que aún se puede cancelar.',
      )
    } else {
      if (!/61,045/.test(superficie)) {
        problemas.push(`El cotejo no trae las cifras esperadas: «${superficie}».`)
      }
      if (!previa.lecturaVisible.dentroDeLaVentana || !previa.lecturaVisible.esElDeArriba) {
        problemas.push(
          `Las cifras de superficie están en el DOM pero no se ven ` +
            `(tapadas por «${previa.lecturaVisible.tapadoPor}» o fuera de la ventana).`,
        )
      }
    }
    if (!previa.botonEncendido) {
      problemas.push('Con la LISTA real pegada, «Usar estas coordenadas» sigue apagado.')
    }

    // ── 1.4 · Usar, y que la parcela ENTRE y SE VEA ──────────────────────────
    if (previa.botonEncendido) {
      $(SEL.USAR).click()
      await dormir(400)
      const filas = filasDeVertice().length
      pegado = {
        filas,
        primerVertice: coordenadasDeFila(filasDeVertice()[0] ?? document.createElement('tr')),
        pathsDespues: pathsDelMapa(),
        verticesPx: altoVertices(),
        procedencia: $(SEL.PROCEDENCIA)?.textContent.trim() ?? null,
        eyebrow: eyebrow(),
        dialogoCerrado: !$(SEL.DIALOGO)?.open,
      }

      if (filas !== 11) {
        problemas.push(`La tabla de vértices no tiene 11 filas tras pegar, sino ${filas}.`)
      }
      // ⭐ Que se PINTE. El visor pinta en quince panes propios: se cuenta el mapa
      // entero, que es la lección que costó una corrida en falso en el guion 17.
      if (pegado.pathsDespues <= 0) {
        problemas.push('La parcela pegada no ha pintado ni un `<path>` en el mapa.')
      }
      // ⛔ La cabecera NO puede decir que esto viene del Catastro: es el error caro
      // de esta aplicación, y por el pegado entra igual de fácil que por el fichero.
      if (/parcela del catastro/i.test(pegado.eyebrow ?? '')) {
        problemas.push(
          `⛔ La cabecera dice «${pegado.eyebrow}» sobre unas coordenadas que ha pegado el ` +
            'técnico. Es el defecto que el guion 17 destapó en F18, por la otra puerta.',
        )
      }
      if (!/pegad/i.test(pegado.procedencia ?? '')) {
        problemas.push(`La procedencia no dice que se ha pegado: «${pegado.procedencia}».`)
      }
      if (!pegado.dialogoCerrado) problemas.push('El diálogo de pegado no se ha cerrado al usar.')
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ Coordenadas EN GRADOS: se ofrece proyectarlas (la deuda M10 de F18)
// ═════════════════════════════════════════════════════════════════════════════

let grados = null

if ($(SEL.BOTON_PEGAR) && !$(SEL.BOTON_PEGAR).disabled) {
  // Un cuadrado de unos 9 × 11 m en Málaga, escrito en grados como lo suelta un GPS.
  const EN_GRADOS = [
    '-4.421430 36.721300',
    '-4.421330 36.721300',
    '-4.421330 36.721400',
    '-4.421430 36.721400',
  ].join('\n')

  $(SEL.BOTON_PEGAR).click()
  const dialogo = await esperarA(() => {
    const d = $(SEL.DIALOGO)
    return d && (d.open || d.hasAttribute('open')) ? d : null
  })

  if (dialogo) {
    escribirEn($(SEL.CAMPO), EN_GRADOS)
    await dormir(120)
    const puedeSeguir = $(SEL.USAR)?.disabled === false
    if (puedeSeguir) $(SEL.USAR).click()

    const revision = await esperarA(() => {
      const d = $(SEL.REVISION)
      return d && (d.open || d.hasAttribute('open')) ? d : null
    })

    const opciones = $$(SEL.OPCION_GRADOS)
    const textoRevision = revision?.textContent ?? ''
    grados = {
      puedeSeguir,
      abreRevision: revision !== null,
      ofreceProyectar: opciones.length > 0,
      diceDondeCae: /36[.,]72/.test(textoRevision) && /huso 30/i.test(textoRevision),
      // ⛔ El motivo FALSO que F19 corrige: hasta hoy la app decía que un punto de
      // Málaga «no cae en la España peninsular ni Baleares».
      diceElMotivoFalso: /no cae en la España peninsular/i.test(textoRevision),
      marcadoPorDefecto: opciones.find((o) => o.checked)?.value ?? null,
    }

    if (!grados.abreRevision) {
      problemas.push(
        '⛔ Unas coordenadas en grados no abren la revisión: la corrección existe desde F19 y el ' +
          'usuario no puede llegar a ella.',
      )
    }
    if (!grados.ofreceProyectar) {
      problemas.push('⛔ La revisión no OFRECE proyectar unos grados de la Península.')
    }
    if (!grados.diceDondeCae) {
      problemas.push(
        'La revisión no dice DÓNDE cae la parcela antes de proyectar. «Huso 30» a secas no le ' +
          'dice nada a nadie; feature-01 pide enseñar el punto de caída.',
      )
    }
    if (grados.diceElMotivoFalso) {
      problemas.push(
        '⛔ Se está diciendo que un punto de MÁLAGA no cae en la España peninsular. Es el motivo ' +
          'falso que F19 corrige: el bloqueo era correcto y la explicación mentira.',
      )
    }
    if (grados.marcadoPorDefecto !== 'no') {
      problemas.push(
        `La opción marcada de salida es «${grados.marcadoPorDefecto}» y debería ser NO tocar el ` +
          'dato del usuario: ninguna corrección se aplica sola.',
      )
    }

    // Se elige proyectar y se comprueba que entra en METROS.
    const si = opciones.find((o) => o.value === 'si')
    if (si) {
      si.checked = true
      si.dispatchEvent(new Event('change', { bubbles: true }))
      $(SEL.IMPORTAR)?.click()
      await dormir(500)
      const primera = filasDeVertice()[0]
      grados.primerVertice = primera ? coordenadasDeFila(primera) : []
      // 373.062,907 · 4.064.897,582 en el huso 30, que es lo que da `forward()`.
      // Lo que NO puede quedar en la tabla es el −4,42 que se pegó.
      const [x = '', y = ''] = grados.primerVertice
      grados.entroEnMetros = Number(x) > 100000 && Number(y) > 1000000
      if (!grados.entroEnMetros) {
        problemas.push(
          `Tras aceptar la proyección, la tabla no enseña metros UTM sino «${x}, ${y}».`,
        )
      }
    } else if ($(SEL.CANCELAR)) {
      $(SEL.CANCELAR).click()
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ El rótulo del GML AJENO (la tercera deuda de F18)
// ═════════════════════════════════════════════════════════════════════════════

let ajeno = null

const gml = await traerFixture(
  'test/fixtures/gml/cp_parcela_9398516VK3799G.gml',
  'cp_parcela.gml',
  'application/gml+xml',
)

if (!gml.file) {
  problemas.push(`No se ha podido traer el GML de fixture (${gml.estado ?? gml.error}).`)
} else {
  const eyebrowPrevio = eyebrow()
  soltar(gml.file)

  // ⛔ **Soltar el GML NO escribe el store, y la primera corrida lo aprendió aquí.**
  // El `drop` abre el cajón de Comprobación con el fichero dentro; la parcela ajena
  // no entra hasta pulsar «Contrastar con el parcelario» (diseño de F08). Sin este
  // clic, el rótulo seguía diciendo lo de antes y el bloque entero pasaba en verde
  // **sin haber medido nada**.
  const contrastar = await esperarA(() => {
    const b = $(SEL.CONTRASTAR)
    return b && !b.disabled ? b : null
  }, 3000)
  if (contrastar) {
    contrastar.click()
    await dormir(900)
  }

  const antes = eyebrow()
  const puerta = $(SEL.PUERTA)
  const puertaVisible = Boolean(puerta) && puerta.offsetParent !== null
  let despues = antes
  if (puertaVisible) {
    puerta.click()
    await dormir(400)
    despues = eyebrow()
  }
  ajeno = {
    eyebrowPrevio,
    huboContrastar: Boolean(contrastar),
    antes,
    despues,
    puertaVisible,
  }

  // ⛔ **LA ANTI-VACUIDAD, y el primer intento estaba MAL.** Ponía
  // `cargo: antes !== eyebrowPrevio || Boolean(puerta)`, y `Boolean(puerta)` es
  // CIERTO aunque la puerta esté oculta —el nodo vive en `index.html` desde el
  // arranque—, así que el guardián que existía para detectar «no ha pasado nada»
  // decía que sí había pasado. Se exige lo que de verdad prueba que la geometría
  // ajena está en el store: que la PUERTA se vea, que es lo que solo aparece en
  // modo Comprobación.
  if (!puertaVisible) {
    problemas.push(
      '⛔ El GML de otro técnico no ha llegado al store —no se ve la puerta «Tomar esta ' +
        'geometría»—, así que el rótulo del GML ajeno NO SE HA MEDIDO. Un guardián que pasa ' +
        'porque no ha pasado nada es peor que no tenerlo.',
    )
  }
  if (/parcela del catastro/i.test(antes ?? '')) {
    problemas.push(
      `⛔ La cabecera dice «${antes}» sobre el GML de OTRO TÉCNICO. Es la inconsistencia que F18 ` +
        'midió al pasar y dejó dicha: la aplicación afirmando que la Sede respalda un fichero ' +
        'que ha traído alguien.',
    )
  }
  if (!/otro t[eé]cnico/i.test(antes ?? '')) {
    problemas.push(
      `Con el GML ajeno en pantalla la cabecera dice «${antes}» y no nombra de quién es la ` +
        'geometría. Es lo que F19 viene a arreglar.',
    )
  }
  if (puertaVisible && antes === despues) {
    problemas.push(
      'Cruzar la puerta no cambia la cabecera: sigue diciendo que la geometría es de otro cuando ' +
        'ya la has tomado como tuya.',
    )
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · El coste en píxeles
// ═════════════════════════════════════════════════════════════════════════════

const px = {
  verticesAntes: linea.verticesPx,
  verticesDespues: altoVertices(),
  // El `<dialog>` FLOTA: no le quita sitio a nada. Si esto deja de ser cierto, el
  // coste tiene que estar medido y escrito, no descubierto por un usuario.
  costeEnElPanel: null,
}
px.costeEnElPanel =
  Number.isFinite(px.verticesAntes) && Number.isFinite(px.verticesDespues)
    ? redondear(px.verticesAntes - px.verticesDespues)
    : null

// ═════════════════════════════════════════════════════════════════════════════
// 5 · La red: ninguna
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
    `Pegar coordenadas ha consultado ${red.aServiciosDeDatos} servicio(s) de datos. Es local por ` +
      'definición: las coordenadas las trae el técnico.',
  )
}

window.fetch = fetchOriginal

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '18-pegado-coordenadas',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'QUE SE ENTIENDA POR QUÉ SE PREGUNTA ANTES DE PROYECTAR: juicio humano, CHECKLIST-HUMANO §15.',
    'EL PORTAPAPELES DEL SISTEMA: se sintetiza un ClipboardEvent; el Ctrl+V con teclado real va al §15.',
    'CANARIAS EN GRADOS: no hay fixture y no se inventa. Lo cubren la suite y la ficha.',
  ],
  linea,
  modal,
  previa,
  pegado,
  grados,
  ajeno,
  px,
  red,
}
