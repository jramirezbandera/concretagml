// app/tarjeta-bienvenida.js — LA PRIMERA VISITA.
//
// ── QUÉ CIERRA ESTE FICHERO ─────────────────────────────────────────────────
// Desde el 2026-08-07 la aplicación **arranca vacía**: sin parcela, con el mapa
// mirando a España entera (`app/main.js#VISTA_SIN_PARCELA`) y con el eyebrow
// diciendo «Sin parcela». Es el arranque correcto y es el que ve el 100 % de los
// usuarios nuevos. Lo que no tenía era **una sola línea que dijera qué es esto**.
//
// Y tenía algo peor: el camino más rápido para empezar —pinchar el mapa, que
// rellena la referencia catastral— **no tiene ningún control que lo anuncie**. No
// hay botón que pulsar ni nada que se encienda. El comentario de `index.html:609`
// ya lo dice con todas las letras desde el 2026-08-11: *«un camino que solo conoce
// quien escribió el código no es un camino: es un secreto»*. Hasta hoy vivía en la
// segunda frase del apunte de una vía, que es mejor que nada y menos que suficiente.
//
// ── ⛔ POR QUÉ NO ES UN <dialog>, QUE ES LO QUE PEDÍA EL PLAN ────────────────
// Ésta es LA decisión del fichero y por eso va arriba del todo.
//
// El plan original pedía un `<dialog>` con `showModal()`, como los seis diálogos
// que este repositorio ya tiene. La revisión de diseño del 2026-08-18 lo tumbó con
// un argumento que no tiene vuelta: **`showModal()` pinta un `::backdrop` que se
// traga todos los clics**. Esta tarjeta existe para enseñar «pincha el mapa», y su
// propio fondo oscuro habría sido lo único que lo impide. Quien acaba de leer una
// instrucción la prueba en el acto; no habría aprendido el gesto, habría aprendido
// que no funciona.
//
// Y hay un segundo motivo que resultó ser el principal. `app/cableado-catastro.js`
// manda la coordenada del clic al Catastro **sin mirar el zoom**
// (`#deducirEn`, :1829). La vista de arranque es zoom 6, España entera: ~1,5 km por
// píxel. Ahí no hay ninguna parcela que señalar todavía. Lo primero que el usuario
// tiene que hacer **no es pinchar, es acercarse** — y con la tarjeta no modal el
// mapa se arrastra y hace zoom mientras se lee.
//
// El precio está pagado a mano y está aquí: sin `showModal()` no hay trampa de
// foco, ni `Escape`, ni `::backdrop` gratis. Lo que este módulo NO hace es robar el
// foco (§ `abrir`), y el motivo está escrito allí.
//
// ── DÓNDE VIVE EN LA REJILLA, Y POR QUÉ NO DENTRO DEL MAPA ──────────────────
// La tarjeta es hija de `<body class="gml-app">` y declara `grid-area: mapa`, o
// sea que **comparte celda con `<main id="mapa">`** sin estar dentro de él.
//
// ⛔ Meterla dentro de `.gml-mapa` habría sido lo obvio (ese nodo ya es
// `position:relative`) y habría estado MAL: `.gml-mapa` y `.leaflet-container` son
// el mismo elemento, así que un clic en el botón «Empezar» lo habría recogido
// Leaflet como un clic en el mapa — y con él `alPulsarMapa`, o sea una consulta al
// Catastro por pulsar un botón de una tarjeta de bienvenida. La alternativa era
// importar Leaflet aquí para `DomEvent.disableClickPropagation`, y eso convierte
// un módulo de `app/` en solo-navegador y lo saca de jsdom. Compartir celda de
// rejilla no cuesta nada, no toca Leaflet y deja el módulo probable.
//
// El sitio dentro de la celda es el **borde izquierdo, centrado en vertical**, y es
// la única esquina libre: arriba a la izquierda está la barra de edición, abajo a la
// izquierda el cajón del diagnóstico, arriba a la derecha el control de capas y
// abajo a la derecha la opacidad y la atribución (ver `index.html:1455-1466`). En el
// arranque vacío ninguno de esos cuatro está en pantalla, pero el sitio se elige
// para que no lo esté nunca.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//   · **No decide cuándo abrirse.** La condición —llave ausente Y los dos stores
//     vacíos— la evalúa `app/main.js`, que es quien ve los dos stores. Aquí solo
//     está {@link TarjetaBienvenida.yaVista}, que lee la llave y nada más.
//   · **No escucha al mapa ni al store.** Los dos cierres automáticos (el primer
//     clic en el mapa y la entrada de una parcela) los cablea `app/main.js`
//     llamando a `cerrar()`. Sin esto el módulo necesitaría el `L.Map` y el store,
//     y dejaría de poder probarse con un `document` pelado.
//   · **No toca ningún store.** Ni lo lee.

// ── Textos de la pantalla ────────────────────────────────────────────────────

const TITULO = 'Concreta GML'

/**
 * La línea de qué es esto. Sale del `README.md`, recortada a lo que cabe en una
 * frase: generar el GML y el informe. Se nombran los dos porque el informe es la
 * mitad del producto y quien llega buscando «el GML del Catastro» no sabe que está.
 */
const APUNTE =
  'Genera el GML INSPIRE que pide la Sede del Catastro y el informe de contraste ' +
  'firmable que va con él.'

/**
 * ⭐ **EL BLOQUE DESTACADO, Y VA EL SEGUNDO A PROPÓSITO.**
 *
 * Por delante de «cómo empezar», y el motivo es de REPARTO: las tres vías **ya
 * están en pantalla**, en el panel de la izquierda, detrás de esta tarjeta — para
 * eso se eligió que no fuera modal. El clic del mapa no está en ningún sitio. Se
 * destaca lo invisible y se nombra lo visible.
 *
 * ⛔ **«Busca tu parcela y pínchala», no «pincha cualquier parcela».** El gesto se
 * cuenta en DOS TIEMPOS porque a zoom 6 el primero es obligatorio: sin acercarse no
 * hay ninguna parcela que señalar, y `deducirEn` consultaría igual y devolvería la
 * referencia de una finca que el usuario no ha visto nunca. La frase larga es la
 * honrada.
 *
 * ⛔ **«Se rellena el campo», JAMÁS «trae la parcela».** El clic rellena y nada
 * más. La referencia no entra en el expediente hasta que se pulsa «Traer del
 * Catastro», que es lo que hace que `parcela.refcat` signifique siempre «esto lo
 * afirma quien firma». El apunte de `index.html:630` ya lo dice así y aquí no puede
 * decir otra cosa.
 */
const GESTO_TITULAR = 'Busca tu parcela en el mapa y pínchala.'
const GESTO_CUERPO =
  'Su referencia catastral se rellena sola en el campo de la izquierda, y la revisas ' +
  'antes de traerla.'

/**
 * El motivo del estado APAGADO del bloque de arriba, para cuando la tarjeta se
 * reabre con una parcela que ya tiene referencia.
 *
 * `app/cableado-catastro.js#puedeDeducirClicando` devuelve `false` en ese caso **a
 * propósito**: con una referencia en el modelo, el clic es como se deselecciona, se
 * centra o se falla un arrastre, y sustituirla en silencio sería el error mudo de
 * siempre. Enseñar aquí el gesto sin decir que está en pausa sería enseñar algo
 * apagado y mudo, o sea la regla de oro 1 rota por el texto que existe para
 * explicarla. **Se apaga y dice por qué** (DESIGN.md §8).
 *
 * El motivo no se inventa: es el que aquella función ya tiene escrito en su JSDoc.
 */
const GESTO_EN_PAUSA =
  'Ahora mismo en pausa: ya hay una referencia en el expediente y el clic no la ' +
  'sustituye sin que se lo pidas.'

/**
 * ⚠️ **El arrastre se nombra AQUÍ, y no dentro de una vía** (2026-08-18). Estuvo
 * en la de medición —«pega la LISTA de AutoCAD o suelta un DXF»— y era falso por
 * omisión: `crearZonaFichero` engancha el arrastre en la VENTANA ENTERA y la
 * misma zona acepta `.dxf`, `.txt`, `.gml`, `.xml` y `.json` (`app/main.js`,
 * `entradasExtra`). Decirlo solo en una de las tres vías hacía leer que el GML hay
 * que abrirlo por su botón, que es justo lo que NO pasa.
 *
 * Va en la entradilla porque es lo único que se dice de las tres a la vez, y así
 * no cuesta ni una línea más: la tarjeta volvió a tres líneas el 2026-08-18 y no
 * se infla para arreglar un texto.
 */
const VIAS_ENTRADILLA = 'Y hay tres formas de empezar, en el panel — o suelta el fichero aquí:'

/**
 * Las tres vías, NOMBRADAS y no explicadas: cada una tiene su propio apunte a tres
 * centímetros de aquí, en el panel que se ve detrás de la tarjeta. Repetirlo entero
 * sería el «happy talk» que Krug manda borrar.
 *
 * ⚠️ **La tercera cambia con la rama.** En EDIFICIO un GML de construcción es una
 * entrada legítima y decir «el tuyo o el de otro» se quedaría corto — es el mismo
 * criterio por el que `index.html:857` avisa de que un GML de construcción CONMUTA
 * la rama.
 */
const VIAS = Object.freeze({
  parcela: Object.freeze([
    ['Referencia catastral', 'trae el recinto oficial y edítalo sobre la ortofoto.'],
    ['Medición propia', 'pega la LISTA de AutoCAD o trae tu .dxf o .txt.'],
    ['Abrir un GML', 'el tuyo o el de otro, para comprobarlo.'],
  ]),
  edificio: Object.freeze([
    ['Origen del edificio', 'trae la construcción oficial y edítala sobre la ortofoto.'],
    ['Medición propia', 'pega la LISTA de AutoCAD o trae tu .dxf o .txt.'],
    ['Abrir un GML', 'de parcela o de construcción.'],
  ]),
})

const BOTON_EMPEZAR = 'Empezar'
const ROTULO_CERRAR = 'Cerrar'

// ── Clases CSS, contrato con `estilos/app.css` ───────────────────────────────

const CLASE = Object.freeze({
  TARJETA: 'gml-bienvenida',
  TITULO: 'gml-bienvenida-titulo',
  APUNTE: 'gml-bienvenida-apunte',
  GESTO: 'gml-bienvenida-gesto',
  GESTO_TITULAR: 'gml-bienvenida-gesto-titular',
  GESTO_CUERPO: 'gml-bienvenida-gesto-cuerpo',
  VIAS: 'gml-bienvenida-vias',
  VIA: 'gml-bienvenida-via',
  VIA_NOMBRE: 'gml-bienvenida-via-nombre',
  CERRAR: 'gml-bienvenida-cerrar',
})

const ACCION = Object.freeze({
  EMPEZAR: 'empezar-bienvenida',
  CERRAR: 'cerrar-bienvenida',
})

/**
 * El `menuitem` de la barra que vuelve a abrir esta tarjeta. **Es contrato de
 * `index.html`** y casa exactamente un nodo, igual que
 * `dialogo-diccionario.js#SELECTOR_ABRIR_DICCIONARIO`.
 *
 * ⛔ **No es opcional que exista.** DESIGN.md §8 prohíbe retirar cosas de la
 * pantalla: *«se apaga y dice por qué; jamás retirado»*. Una ayuda que solo se ve
 * una vez en la vida repetiría exactamente el defecto que esta tarjeta viene a
 * arreglar — un camino que solo conoce quien lo vio una vez es un secreto.
 */
export const SELECTOR_ABRIR_BIENVENIDA = '[data-accion="como-funciona"]'

/**
 * La llave. **Versionada con el número de la versión del TEXTO**, no con la de la
 * aplicación: si algún día la tarjeta cuenta algo materialmente distinto, subir
 * esto la vuelve a enseñar a todo el mundo; un retoque de redacción no.
 */
export const LLAVE = 'gml.bienvenida.vista'
const VERSION_TEXTO = '1'

/** El mismo duck typing del resto de la casa. */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.appendChild === 'function' &&
    typeof el.setAttribute === 'function'
  )
}

/**
 * ⛔ **`localStorage` LANZA, y hay que tratarlo en las DOS direcciones.** En modo
 * privado de Safari, con las cookies de terceros bloqueadas o con el almacenamiento
 * lleno, tanto leer como escribir tiran una excepción. Este proyecto no tenía ni una
 * línea de `localStorage` antes de hoy (lo único persistente era IndexedDB, por
 * `storage/bd.js`), así que la doctrina se escribe aquí:
 *
 *   · **leer que falla → `false`**, o sea «no la ha visto», o sea se enseña. Lo
 *     caro de equivocarse hacia ese lado es una tarjeta de más; hacia el otro, un
 *     usuario nuevo sin ninguna ayuda y sin saber por qué.
 *   · **escribir que falla → se traga.** El usuario acaba de cerrar la tarjeta y ya
 *     tiene lo que quería; abrirle un aviso de que no se ha podido guardar una
 *     preferencia sería ruido sobre un fallo que no puede corregir.
 *
 * Lo que NUNCA puede pasar es que esto rompa el arranque, que es de lo que avisa
 * `app/main.js:1449` a cuenta de un `TypeError` en el paso 1 que dejó la aplicación
 * sin vestir y **con la consola muda**.
 */
function crearLlavero(almacen) {
  return {
    leida() {
      try {
        return almacen?.getItem?.(LLAVE) === VERSION_TEXTO
      } catch {
        return false
      }
    },
    marcar() {
      try {
        almacen?.setItem?.(LLAVE, VERSION_TEXTO)
      } catch {
        /* Silencio deliberado; ver la cabecera de esta función. */
      }
    },
  }
}

/**
 * @typedef {object} TarjetaBienvenida
 * @property {HTMLElement} nodo  La `<section>`.
 * @property {(opciones?: {rama?: string, puedeDeducir?: boolean}) => void} abrir
 * @property {(opciones?: {marcar?: boolean}) => void} cerrar  IDEMPOTENTE.
 * @property {() => boolean} estaAbierta
 * @property {() => boolean} yaVista  Si la llave dice que ya se enseñó.
 * @property {() => void} destruir  IDEMPOTENTE.
 */

/**
 * Fabrica la tarjeta de bienvenida y cablea el `menuitem` que la reabre.
 *
 * Fabrica su propio DOM —como los seis diálogos— y lo cuelga de la rejilla de la
 * cáscara, **delante de `<main id="mapa">`**: el sitio en pantalla lo decide
 * `grid-area`, así que el orden en el DOM queda libre para lo único que gobierna,
 * que es el orden de tabulación. Puesta delante del mapa, el recorrido es panel →
 * tarjeta → cromo de Leaflet, y no hay que atravesar los controles del mapa para
 * llegar a un botón que acaba de aparecer.
 *
 * ```js
 * const bienvenida = crearTarjetaBienvenida({ documento: document })
 * if (!bienvenida.yaVista() && estado.get() === null && estadoEdificio.get() === null) {
 *   bienvenida.abrir({ rama: 'parcela', puedeDeducir: true })
 * }
 * ```
 *
 * @param {object} [opciones]
 * @param {Document} [opciones.documento=document]
 * @param {HTMLElement} [opciones.contenedor]  La rejilla. Por defecto `body`.
 * @param {HTMLElement} [opciones.disparador]  El `menuitem` que la reabre. Si no
 *   llega se busca por {@link SELECTOR_ABRIR_BIENVENIDA}.
 * @param {Storage} [opciones.almacen]  Por defecto `window.localStorage`.
 *   Parámetro para las pruebas, y también la puerta por la que se prueba el caso
 *   «el almacén lanza».
 * @returns {TarjetaBienvenida}
 * @throws {TypeError}  Si falta el documento o el disparador. Un disparador que
 *   falta es una ayuda irrecuperable, y se dice al montar y no el día que alguien
 *   se pregunte por qué el menú tiene una opción menos.
 */
export function crearTarjetaBienvenida({
  documento = document,
  contenedor,
  disparador,
  almacen,
} = {}) {
  const doc = documento
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearTarjetaBienvenida: 'documento' debe ser un Document; recibido ${typeof doc}.`,
    )
  }

  const raiz = contenedor ?? doc.body
  if (!esElementoDOM(raiz)) {
    throw new TypeError(
      `crearTarjetaBienvenida: 'contenedor' debe ser un elemento (la rejilla ` +
        `'.gml-app'); recibido ${typeof raiz}.`,
    )
  }

  const boton = disparador ?? doc.querySelector(SELECTOR_ABRIR_BIENVENIDA)
  if (!esElementoDOM(boton)) {
    throw new TypeError(
      `crearTarjetaBienvenida: no hay disparador. Se busca por ` +
        `'${SELECTOR_ABRIR_BIENVENIDA}', que es contrato de index.html. Sin él la tarjeta se ` +
        `enseña una vez y queda sin ninguna forma de volver a ella, que es justo lo que ` +
        `DESIGN.md §8 prohíbe.`,
    )
  }

  // El almacén se resuelve con `try`: en algunos navegadores el mero ACCESO a
  // `window.localStorage` lanza (no la llamada, el acceso), y eso ocurriría aquí,
  // en el montaje, o sea otra vez antes de que nadie escuche.
  let almacenReal = almacen
  if (almacenReal === undefined) {
    try {
      almacenReal = typeof localStorage === 'undefined' ? null : localStorage
    } catch {
      almacenReal = null
    }
  }
  const llavero = crearLlavero(almacenReal)

  let destruida = false
  let abierta = false

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── El DOM ────────────────────────────────────────────────────────────────

  const tarjeta = crear('section', CLASE.TARJETA)
  tarjeta.hidden = true
  tarjeta.setAttribute('role', 'dialog')
  // ⛔ `false`, y está ESCRITO en vez de omitido. Omitirlo también vale por
  // defecto, pero esta tarjeta nace de tumbar un `<dialog>` modal y el atributo es
  // el sitio donde esa decisión queda dicha para el lector de mañana: NO es modal,
  // no atrapa el foco, y el mapa de detrás sigue siendo interactivo.
  tarjeta.setAttribute('aria-modal', 'false')
  tarjeta.dataset.bloque = 'bienvenida'

  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = 'gml-bienvenida-titulo'
  tarjeta.setAttribute('aria-labelledby', titulo.id)

  const apunte = crear('p', CLASE.APUNTE, APUNTE)

  // El bloque del gesto. `data-estado` y no una clase modificadora: es el mismo
  // criterio de DESIGN.md §8.3 —el aspecto sale de un `data-*`, no de ARIA— y deja
  // el estado legible desde el guion de humo sin tener que leer la hoja.
  const gesto = crear('div', CLASE.GESTO)
  gesto.dataset.estado = 'activo'
  const gestoTitular = crear('p', CLASE.GESTO_TITULAR, GESTO_TITULAR)
  const gestoCuerpo = crear('p', CLASE.GESTO_CUERPO, GESTO_CUERPO)
  gesto.append(gestoTitular, gestoCuerpo)

  const viasEntradilla = crear('p', CLASE.APUNTE, VIAS_ENTRADILLA)
  const vias = crear('ul', CLASE.VIAS)

  // ⚠️ El botón va SUELTO, sin envoltorio de pie. Los diálogos de la casa envuelven
  // el suyo porque llevan dos o tres botones que hay que alinear; aquí hay UNO, y un
  // `<div class="…-pie">` con `display:flex` para un solo hijo es una regla de hoja
  // que no decide nada. Con el presupuesto a 0 B de holgura eso no es purismo.
  const botonEmpezar = crear('button', 'gml-boton gml-boton--primario', BOTON_EMPEZAR)
  botonEmpezar.type = 'button'
  botonEmpezar.dataset.accion = ACCION.EMPEZAR

  const botonCerrar = crear('button', CLASE.CERRAR, '×')
  botonCerrar.type = 'button'
  botonCerrar.dataset.accion = ACCION.CERRAR
  botonCerrar.setAttribute('aria-label', ROTULO_CERRAR)

  tarjeta.append(botonCerrar, titulo, apunte, gesto, viasEntradilla, vias, botonEmpezar)

  // Delante del mapa: ver el JSDoc de la fábrica. Si el mapa no está (una prueba
  // con un `body` pelado), se añade al final y no pasa nada — el sitio en pantalla
  // lo pone `grid-area`, no el orden.
  const mapaEl = raiz.querySelector?.('.gml-mapa') ?? null
  if (mapaEl !== null && mapaEl.parentNode === raiz) raiz.insertBefore(tarjeta, mapaEl)
  else raiz.appendChild(tarjeta)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /**
   * Reescribe las tres vías con las de la rama que toque.
   *
   * ⚠️ Se normaliza a minúsculas porque el enum de la casa
   * (`app/navegacion.js#RAMA`) vale `'PARCELA'`/`'EDIFICIO'` en VERSALES y aquí las
   * claves son legibles en minúscula. Normalizar en un sitio evita que el llamante
   * tenga que acordarse, y una rama desconocida cae en PARCELA en vez de dejar la
   * lista vacía: una tarjeta de bienvenida sin las vías no ayuda a nadie.
   */
  function pintarVias(rama) {
    const lista = VIAS[String(rama ?? '').toLowerCase()] ?? VIAS.parcela
    vias.replaceChildren()
    for (const [nombre, resto] of lista) {
      const li = crear('li', CLASE.VIA)
      li.append(crear('strong', CLASE.VIA_NOMBRE, nombre), doc.createTextNode(` — ${resto}`))
      vias.append(li)
    }
  }

  /**
   * Enciende o apaga el bloque del gesto. Apagado **dice por qué**, nunca se
   * retira: es la regla de oro 1 aplicada al único texto de esta tarjeta que puede
   * dejar de ser cierto.
   */
  function pintarGesto(puedeDeducir) {
    gesto.dataset.estado = puedeDeducir ? 'activo' : 'pausa'
    gestoCuerpo.textContent = puedeDeducir ? GESTO_CUERPO : GESTO_EN_PAUSA
  }

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  function alClic(evento) {
    const pulsado = evento.target?.closest?.('[data-accion]')
    if (!pulsado || !tarjeta.contains(pulsado)) return
    const accion = pulsado.dataset.accion
    if (accion === ACCION.EMPEZAR || accion === ACCION.CERRAR) cerrar({ marcar: true })
  }

  /**
   * `Escape` cierra, y el oyente va en el `document` y no en la tarjeta: **sin
   * `showModal()` el foco no está aquí dentro** —no se le roba a nadie, ver
   * `abrir`—, así que un `keydown` en la tarjeta no llegaría nunca. Quien pulsa
   * `Escape` con las manos en el campo de la referencia también quiere cerrarla.
   */
  function alTecla(evento) {
    if (evento.key === 'Escape' && abierta) cerrar({ marcar: true })
  }

  /** Reabrir desde el menú NO marca nada: la llave ya está puesta desde la primera vez. */
  function alPulsarDisparador() {
    if (destruida) return
    abrir()
  }

  doc.addEventListener('keydown', alTecla)
  tarjeta.addEventListener('click', alClic)
  boton.addEventListener('click', alPulsarDisparador)

  /**
   * @param {object} [opciones]
   * @param {boolean} [opciones.marcar=false]  Escribir la llave. `true` cuando la
   *   cierra el usuario o cuando el trabajo ya ha empezado de verdad; `false` para
   *   un cierre técnico que no prueba nada.
   */
  function cerrar({ marcar = false } = {}) {
    if (!abierta) return
    abierta = false
    tarjeta.hidden = true
    if (marcar) llavero.marcar()
  }

  function abrir({ rama = 'parcela', puedeDeducir = true } = {}) {
    if (destruida) return
    pintarVias(rama)
    pintarGesto(puedeDeducir)
    tarjeta.hidden = false
    abierta = true
    // ⛔ **NO se roba el foco, y es una decisión.** Con `showModal()` el foco entra
    // solo y está bien, porque el usuario ha PEDIDO abrir esa pantalla. Ésta
    // aparece sin que nadie la pida, en el primer segundo de la aplicación: mover
    // ahí el foco secuestraría un teclado que no ha pedido nada y dejaría a quien
    // navega tabulando en un sitio distinto del que estaba. Se llega a ella
    // tabulando desde el panel, que para eso va delante del mapa en el DOM.
  }

  return {
    nodo: tarjeta,
    abrir,
    cerrar,
    estaAbierta: () => abierta,
    yaVista: () => llavero.leida(),

    destruir() {
      if (destruida) return
      destruida = true
      abierta = false
      doc.removeEventListener('keydown', alTecla)
      tarjeta.removeEventListener('click', alClic)
      boton.removeEventListener('click', alPulsarDisparador)
      tarjeta.remove()
    },
  }
}
