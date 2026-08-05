// viewer/barra-edicion.js — F06 · La BARRA FLOTANTE de edición, sobre el mapa.
//
// ── QUÉ PROBLEMA RESUELVE ────────────────────────────────────────────────────
// El bloque «Edición» del panel lateral se comía **270 px fijos** y dejaba la
// tabla de vértices en **64 px a 1440×900** — 1,6 renglones para una parcela de
// 15 vértices. Está medido en navegador y anotado como deuda en
// `spec/feature-06-edicion-parcela.md`. La decisión: las herramientas se van a
// una barra flotante sobre el mapa, los números se teclean en DESPLEGABLES que
// se abren desde su herramienta, y los gestos —que hoy no caben en tres
// renglones de 11 px— se cuentan en un PANEL DE AYUDA detrás de un botón «?».
// El bloque del panel desaparece entero y la tabla recupera esos 270 px.
//
// ── LA RESTRICCIÓN QUE GOBIERNA TODO ESTE MÓDULO ────────────────────────────
// `app/main.js#cablearEdicion` localiza sus nodos POR SELECTOR, al llamarla:
//
//     [data-accion="deshacer"]        [data-campo="snap"]              (checkbox)
//     [data-accion="rehacer"]         [data-campo="snap-tolerancia"]   (cm)
//     [data-accion="offset"]          [data-campo="offset-distancia"]  (m)
//     [data-estado="edicion"]         (role="status")
//
// **Este módulo produce EXACTAMENTE esos siete nodos, con esos mismos `data-*` y
// esos mismos tipos de elemento.** Esa es la razón de ser de media cabecera: si
// se cumple, `app/main.js` NO hay que tocarlo —ni él, ni sus pruebas, ni el
// guion de navegador `08-edicion.js`—, y el traslado del panel al mapa es un
// cambio de VISTA puro. Consecuencias que no son negociables:
//
//   · **`[data-campo="snap"]` sigue siendo un `<input type="checkbox">`**, porque
//     `cablearEdicion` lee su `.checked` y escucha su `change`. Se ESTILA como
//     botón de barra (`appearance:none` + su `<label>`), pero no cambia de
//     elemento. Un `<button aria-pressed>` habría sido más «de barra» y habría
//     roto el cableado en silencio.
//   · **Los nodos de los desplegables existen SIEMPRE en el DOM**, ocultos con
//     `hidden` cuando el desplegable está cerrado. NUNCA se crean al abrir: si no
//     existieran al arrancar, el `nodo()` de `app/main.js` lanzaría, y
//     `08-edicion.js` —que hace `campo.value = '300'` + `change` sobre la
//     tolerancia SIN abrir nada— dejaría de funcionar.
//   · Los `data-*` propios de este módulo (`data-desplegable`, `data-panel`, y
//     los valores `ayuda`/`cerrar-ayuda` de `data-accion`) no colisionan con los
//     siete de arriba: los selectores del contrato son de VALOR EXACTO.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// No conoce el modelo, ni el store, ni el historial, ni la interacción de
// `viewer/edicion.js`. Fabrica nodos, los abre y los cierra. Quien los cablea es
// `app/main.js`. Por eso aquí no se importa nada de `edit/` ni de `model/`; la
// única importación que sale del visor es una CONSTANTE (ver más abajo).
//
// ── «PINCHAR FUERA CIERRA» CON EL MAPA DEBAJO ───────────────────────────────
// El problema, que no es obvio: la barra flota SOBRE el mapa, y en el mapa un
// clic **selecciona un lindero** (gesto de F06). Si para cerrar el desplegable se
// interceptara el clic de fuera —`capture` + `preventDefault`/`stopPropagation`,
// que es como se cierra un menú en media web—, el primer clic después de abrir
// se lo comería la barra: el usuario abriría «Desplazar lindero», vería que no
// hay ningún lindero elegido, pincharía uno en el mapa… y no pasaría nada. Habría
// que pinchar dos veces, sin que nada lo explicara.
//
// La solución es no interceptar nada:
//   1. Se escucha `click` en el `document` en fase de BURBUJA (no `capture`).
//   2. **Nunca** se llama a `preventDefault` ni a `stopPropagation`.
//   3. Si el destino está DENTRO del contenedor de la barra, no se hace nada.
// Así un solo clic hace las dos cosas a la vez, que es justo lo que el usuario
// espera: cierra el desplegable y selecciona el lindero. El oyente de Leaflet
// vive en el contenedor del mapa y el nuestro en `document`; son independientes.
//
// Detalle de Leaflet que hay que conocer para que el punto 3 no sobre:
// `L.DomEvent.disableClickPropagation` **NO detiene el evento `click`** — detiene
// `mousedown`, `touchstart`, `dblclick` y `contextmenu`, y marca el contenedor
// con `_leaflet_disable_click` para que el mapa se salte el `click` por su
// cuenta. O sea que un clic en un botón de la barra SÍ llega a `document`: sin la
// comprobación `contenedor.contains(...)`, abrir un desplegable lo cerraría en el
// mismo gesto.
//
// Se cierra con `click` y no con `mousedown` a propósito: `click` es el mismo
// evento con el que el mapa selecciona el lindero, así que las dos cosas van
// siempre en el mismo paso; y un ARRASTRE del mapa no produce `click` ni
// selecciona lindero, luego dejar el desplegable abierto mientras se hace pan es
// coherente, no un olvido.
//
// ── `disableClickPropagation` / `disableScrollPropagation`: OBLIGATORIOS ─────
// Sin ellos, pulsar un botón de la barra **seleccionaría un lindero por debajo** y
// la rueda sobre el desplegable haría zoom al mapa. Es el fallo clásico de un
// control de Leaflet; `viewer/capas.js` ya lo resuelve igual y aquí tiene test.
//
// ── POR QUÉ NO HAY ROVING TABINDEX EN EL `role="toolbar"` ───────────────────
// El patrón ARIA de `toolbar` pide un solo elemento en el orden de tabulación y
// las flechas para moverse dentro. Aquí NO se implementa la primera mitad, y es
// una decisión, no un olvido: el `tabindex` móvil obliga a saber en todo momento
// cuáles de las herramientas están deshabilitadas, y **`disabled` es propiedad de
// `app/main.js`**, que lo enciende y lo apaga cuando cambia la pila del historial
// o la selección del lado, sin avisar a nadie. Un `tabindex` que se quedara sobre
// una herramienta recién deshabilitada dejaría la barra **sin ninguna parada de
// tabulación**: una trampa silenciosa para quien va por teclado, que es la clase
// de fallo que este proyecto no admite (regla de oro 1). Espiar ese `disabled`
// con un `MutationObserver` sería devolverle a la vista un conocimiento que
// acabamos de quitarle.
//
// Así que las seis herramientas conservan su orden de tabulación natural —lo
// mismo que haría un grupo de botones sin nada— y las flechas se añaden ENCIMA
// como acelerador, saltando las deshabilitadas en el momento de la pulsación, que
// es el único instante en el que hace falta saberlo.
//
// ── LAS HERRAMIENTAS SE LLAMAN POR SU NOMBRE, NO POR UN DIBUJO ──────────────
// Rework de UI, 2026-08-05. Hasta hoy las seis herramientas eran iconos SVG de
// 18 px con el nombre escondido en un `<span>` para el lector de pantalla. El
// autor lo rechazó, y la objeción es la de siempre con una barra de iconos: un
// imán en herradura, dos linderos con una flecha y una interrogación son tres
// símbolos que hay que APRENDERSE, y aquí no se usan lo bastante a menudo como
// para aprendérselos. Un `title` no arregla eso: aparece al segundo de pasar el
// ratón, o sea después de haber dudado.
//
// Así que las herramientas llevan su nombre ESCRITO. Consecuencias:
//   · La barra se ensancha (~470 px medidos frente a ~200), y por eso vive
//     centrada abajo, donde hay ancho de sobra — ver la sección siguiente.
//   · **Queda un solo tipo de icono**: la punta de flecha (`ICONOS.CARET`) de las
//     dos herramientas que abren un desplegable, que no nombra nada — dice «esto
//     despliega», que es justo lo que una palabra no dice. Sigue siendo SVG en
//     línea, por el mismo motivo que `viewer/sincronizacion.js` usa `L.divIcon` y
//     no `L.Icon` (hallazgo C8): los assets con URL se rompen entre dev, build y
//     jsdom, y una fuente de iconos añade una descarga que puede fallar para
//     dibujar una flecha.
//   · `crearRotulo` (el `<span>` de 1×1 px) NO desaparece: ahora sirve para
//     COMPLETAR el nombre accesible cuando el texto visible se abrevia — «Ajuste»
//     se lee «Ajuste al parcelario», «Ayuda» se lee «Ayuda sobre los gestos de
//     edición»— y para nombrar la única herramienta que sigue sin texto, la punta
//     de flecha del ajuste.
//
// ── POR QUÉ LA POSICIÓN POR DEFECTO ES `bottomcenter` Y NO UNA ESQUINA ───────
// La barra estaba en `topleft`, donde Leaflet la APILA justo debajo del control
// de zoom: dos cajas de cromo pegadas, la de la app colgando de la del mapa como
// si fuera parte de él. El autor lo rechazó también, y las cuatro esquinas de
// Leaflet no tienen dónde ir: `topleft` es el zoom, `topright` el control de
// capas, `bottomright` el de opacidad **y** la atribución, y `bottomleft` el
// control de escala más los cajones de F07 y F08. Cualquier esquina repite el
// apilamiento en otro sitio.
//
// El sitio libre es el CENTRO del borde inferior, que además es donde la ponen
// los editores. Leaflet no lo ofrece: `map._controlCorners` trae exactamente
// cuatro claves. Se le añade una quinta —ver {@link asegurarEsquinaCentroAbajo}—,
// que es la técnica conocida para esto y la única que no obliga a renunciar a
// `L.Control` (y con él a `getContainer()`, del que depende `app/rama.js`, y a
// `disableClickPropagation`). Es API privada de Leaflet, así que la función lo
// comprueba antes de tocar nada y **avisa y cae a `bottomleft`** si el mapa no la
// expone, en vez de reventar dentro de un `addControl`.
//
// ⚠️ Abajo del todo, los desplegables tienen que abrirse HACIA ARRIBA o la fila
// de herramientas se movería al pulsarla (la esquina está anclada por su borde
// inferior, así que crecer significa subir el techo). No se resuelve aquí: lo
// hace `estilos/app.css` con un `order` sobre la fila dentro de esa esquina, y
// está explicado allí.
//
// ── SOLO-NAVEGADOR ──────────────────────────────────────────────────────────
// Importa Leaflet ⇒ su test lleva sufijo `.dom` y este módulo NUNCA entra por el
// barrel raíz `index.js` (rompería la suite `node`: Leaflet exige `window`). Lo
// vigila `test/contrato.test.js`. Tampoco importa `leaflet.css` ni ninguna hoja
// (lo vigila `test/viewer/contrato-capas.dom.test.js`).
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — Contrato roto por el programador (`mapa` que no es un L.Map,
//     `posicion` que no es una esquina de Leaflet) → `throw`: `TypeError` para la
//     forma, `RangeError` para el dominio, igual que `viewer/capas.js`.
//   · Regla 1 (canal de aviso) — `alAvisar` se acepta y se RESUELVE (y por tanto
//     se valida) aunque hoy no haya nada que avisar: ver {@link crearBarraEdicion}.

import L from 'leaflet'

import { OPERATIVOS } from '../config/operativos.js'
import { DENSIDAD_BASE_PX, NIVEL, resolverAvisar } from './_comun.js'
import { UMBRAL_PUNTERIA_PX } from './edicion.js'

// ── Clases CSS estables ──────────────────────────────────────────────────────

/**
 * Clases CSS de la barra. **Estables**: `estilos/app.css` apunta a estos
 * literales y los tests también, igual que `viewer/edicion.js#CLASE_EDICION` y
 * `viewer/acotaciones.js#CLASE_ACOTACION`. Encajan con la familia de
 * `.gml-control-opacidad` (`viewer/capas.js`): control propio de Leaflet, prefijo
 * `gml-`, un bloque y sus partes.
 *
 * @readonly
 */
export const CLASE_BARRA = Object.freeze({
  /** Contenedor del control (el que Leaflet coloca en la esquina). */
  CONTENEDOR: 'gml-barra-edicion',
  /** Fila de herramientas: es la que lleva `role="toolbar"`. */
  FILA: 'gml-barra-edicion-fila',
  /** Cada herramienta pulsable de la fila (botones y el rótulo de la casilla). */
  HERRAMIENTA: 'gml-barra-herramienta',
  /** Modificador de la herramienta que abre un desplegable (la punta de flecha). */
  HERRAMIENTA_FLECHA: 'gml-barra-herramienta--flecha',
  /** El `<span>` con el nombre VISIBLE de una herramienta. */
  TEXTO: 'gml-barra-texto',
  /** Filete vertical que separa los grupos de herramientas. */
  SEPARADOR: 'gml-barra-separador',
  /** El «botón partido»: la casilla del ajuste + su desplegable. */
  PARTIDO: 'gml-barra-partido',
  /** La casilla del ajuste (`appearance:none` la convierte en botón de barra). */
  CONMUTADOR: 'gml-barra-conmutador',
  /** El `<label for>` de esa casilla: es quien lleva el icono. */
  CONMUTADOR_ROTULO: 'gml-barra-conmutador-rotulo',
  /** El `<svg>` de cada icono. */
  ICONO: 'gml-barra-icono',
  /** Texto accesible visualmente oculto de cada botón. */
  ROTULO: 'gml-barra-rotulo',
  /** Caja de un desplegable (ajuste y desplazamiento). */
  DESPLEGABLE: 'gml-barra-desplegable',
  /** Una línea `etiqueta + campo` dentro de un desplegable. */
  DESPLEGABLE_LINEA: 'gml-barra-desplegable-linea',
  /** `<label>` de un campo del desplegable. */
  ETIQUETA: 'gml-barra-etiqueta',
  /** `<input type="number">` de un desplegable. */
  ENTRADA: 'gml-barra-entrada',
  /** Botón de acción dentro de un desplegable (hoy solo «Desplazar lindero»). */
  ACCION: 'gml-barra-accion',
  /**
   * Texto que explica POR QUÉ una acción del desplegable está apagada. Se muestra
   * solo cuando lo está; ver {@link MOTIVO_SIN_LADO}.
   */
  MOTIVO: 'gml-barra-motivo',
  /** Panel de ayuda (`role="dialog"`). */
  AYUDA: 'gml-barra-ayuda',
  /** Título visible del panel de ayuda. */
  AYUDA_TITULO: 'gml-barra-ayuda-titulo',
  /** Párrafo que explica por qué la barra arranca con casi todo apagado. */
  AYUDA_INTRO: 'gml-barra-ayuda-intro',
  /** Tabla de gestos del panel de ayuda. */
  AYUDA_TABLA: 'gml-barra-ayuda-tabla',
  /** Botón «Cerrar» del panel de ayuda. */
  AYUDA_CERRAR: 'gml-barra-ayuda-cerrar',
  /** Tecla dentro de un rótulo. MISMA clase que el panel lateral, a propósito. */
  TECLA: 'gml-tecla',
  /**
   * Renglón `role="status"`. Lleva ADEMÁS `gml-accion-estado`, que es la clase
   * del panel lateral: de ahí salen gratis el `:empty{display:none}` (vacío no
   * ocupa alto) y el modificador `--error` que `app/main.js` conmuta.
   */
  ESTADO: 'gml-barra-estado',
})

/**
 * La clase del renglón de estado que ya existe en `estilos/app.css` y que
 * `app/main.js` presupone: es la dueña de `:empty{display:none}` y la raíz del
 * modificador `gml-accion-estado--error` que ese módulo conmuta con
 * `classList.toggle`. Se REUTILIZA en vez de inventar una equivalente: dos
 * clases para el mismo papel divergen, y la que se queda vieja es siempre la
 * nueva.
 */
const CLASE_ESTADO_PANEL = 'gml-accion-estado'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * La QUINTA posición, que Leaflet no trae: centrada en el borde inferior del
 * mapa. Es el defecto de la barra desde el rework de 2026-08-05; el porqué está
 * en la cabecera y el cómo en {@link asegurarEsquinaCentroAbajo}.
 */
export const CENTRO_ABAJO = 'bottomcenter'

/**
 * Clase de la esquina que se le añade a Leaflet. Lleva ADEMÁS `leaflet-bottom`,
 * que es de donde saca `position:absolute; bottom:0` y el margen inferior de sus
 * controles; lo único que pone esta clase —en `estilos/app.css`— es el centrado
 * horizontal y el hueco que deja libre la atribución.
 *
 * **Estable**: `estilos/app.css` apunta a este literal, igual que a las de
 * {@link CLASE_BARRA}.
 */
export const CLASE_ESQUINA_CENTRO_ABAJO = 'gml-esquina-centro-abajo'

/**
 * Posiciones válidas: las cuatro esquinas de `map._controlCorners` más
 * {@link CENTRO_ABAJO}, que este módulo fabrica.
 */
const POSICIONES = Object.freeze([
  'topleft',
  'topright',
  'bottomleft',
  'bottomright',
  CENTRO_ABAJO,
])

/**
 * La esquina a la que se cae si el mapa no deja añadir la quinta. Es la menos
 * mala de las cuatro para una barra ancha: comparte sitio con el control de
 * escala, que es bajo y estrecho.
 */
const POSICION_DE_RESERVA = 'bottomleft'

/** Centímetros por metro. La conversión que el campo de tolerancia obliga a hacer. */
const CENTIMETROS_POR_METRO = 100

/**
 * Valor inicial del campo de tolerancia, **en centímetros**, DERIVADO de
 * `config/operativos.json` y no escrito a mano.
 *
 * Esto cierra un cabo que `app/main.js#cablearEdicion` dejaba anotado: el arranque
 * del enganche «lo manda el HTML», y el HTML traía un `20` a mano que TENÍA que
 * coincidir con `OPERATIVOS.snapMetros` (0,2 m) porque el cableado empuja lo que
 * diga el campo hacia el visor. Coincidían por disciplina; ahora coinciden por
 * construcción, y el día que la tolerancia operativa cambie, el campo cambia solo.
 *
 * `toFixed(2)` por la misma razón que en `app/main.js#toleranciaEnCm`: la
 * conversión es una multiplicación en coma flotante y el campo no puede nacer
 * diciendo `20.000000000000004`.
 *
 * ⚠️ La tolerancia se teclea en CENTÍMETROS y el modelo trabaja en METROS. No es
 * un descuido: un técnico dice «veinte centímetros», nunca «cero coma dos
 * metros», y un campo que mostrara `0,2` invita a teclear `20` por inercia —cien
 * veces la tolerancia pedida, sin que nada avise—. La conversión la hace
 * `app/main.js`. NO «arreglar» esto a metros.
 */
const TOLERANCIA_INICIAL_CM = String(
  Number((OPERATIVOS.snapMetros * CENTIMETROS_POR_METRO).toFixed(2)),
)

/**
 * Por qué está apagado «Desplazar lindero».
 *
 * ── Por qué este texto existe, y por qué vive DENTRO del desplegable ─────────
 * El botón de la BARRA («Desplazar lindero») **no se deshabilita nunca**: abre
 * siempre su desplegable. El que se apaga es el `[data-accion="offset"]` de
 * dentro, y lo gobierna `app/main.js` según haya o no lindero seleccionado. Un
 * botón de barra gris y mudo sería un error silencioso de manual: el usuario ve
 * un icono apagado y no tiene dónde leer el motivo. Con el motivo dentro del
 * desplegable, el gesto natural —pulsar la herramienta— ya lo enseña.
 *
 * Y se muestra **sin espiar el `disabled` desde fuera**: el `<p>` es el hermano
 * SIGUIENTE del botón, así que `estilos/app.css` lo resuelve con
 * `[data-accion="offset"]:disabled ~ .gml-barra-motivo`. El DOM lo dice, nadie lo
 * observa, y `app/main.js` sigue siendo el único que toca ese `disabled`. Ese
 * orden de hermanos es un INVARIANTE de este módulo y tiene test.
 */
const MOTIVO_SIN_LADO = 'Elige antes un lindero en el mapa: basta un clic sobre él.'

/**
 * Los ocho gestos de edición, tal y como los fija la tabla «El mapa de gestos» de
 * `spec/feature-06-edicion-parcela.md` (que a su vez recoge lo que implementa
 * `viewer/edicion.js`). **Es la única copia**: el panel de ayuda se genera de
 * aquí, no de una tabla escrita a mano en el marcado.
 *
 * `gesto` es una lista de SEGMENTOS para poder marcar las teclas con `<kbd>` sin
 * inventarse un mini-lenguaje: una cadena es texto, un `{kbd}` es una tecla.
 *
 * El umbral de puntería NO se escribe: se interpola de
 * `viewer/edicion.js#UMBRAL_PUNTERIA_PX`. Es lo único que este módulo importa de
 * la interacción, y es una CONSTANTE — no una llamada. Copiar el número dejaría
 * que la ayuda mintiera el día que alguien lo ajustara, que es el modo de fallo
 * habitual de toda ayuda escrita a mano.
 *
 * @type {ReadonlyArray<{gesto: ReadonlyArray<string|{kbd: string}>, donde: string, hace: string}>}
 */
export const GESTOS = Object.freeze([
  Object.freeze({
    gesto: Object.freeze(['Clic']),
    donde: 'mapa',
    hace:
      `Selecciona el lindero más cercano si cae a ${UMBRAL_PUNTERIA_PX} px o menos del punto ` +
      `pinchado; si no cae ninguno, deselecciona. No escribe nunca en el modelo: cambia un resalte.`,
  }),
  Object.freeze({
    gesto: Object.freeze(['Doble clic']),
    donde: 'mapa',
    hace:
      'Inserta un vértice en el lindero más cercano, proyectado sobre el lado y no en el punto ' +
      'crudo del clic. Único gesto del mapa que cambia la geometría.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Clic derecho']),
    donde: 'sobre un vértice',
    hace: 'Lo elimina, sin que salga además el menú del navegador.',
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Alt' }, ' sostenida']),
    donde: 'cualquier gesto',
    hace: 'Apaga el ajuste al parcelario mientras dura: el arrastre no engancha a nada.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Arrastrar un vértice']),
    donde: 'mapa',
    hace: 'Lo mueve, con enganche si el ajuste está activo. Se guarda al soltar.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Teclear una coordenada']),
    donde: 'tabla de vértices',
    hace: 'Mueve el vértice a lo tecleado.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Desplazar lindero']),
    donde: 'esta barra',
    hace: 'Desplaza el lado seleccionado la distancia en metros que se teclee.',
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Ctrl+Z' }, ' / ', { kbd: 'Ctrl+Y' }]),
    donde: 'toda la app',
    hace:
      'Deshacer y rehacer. Se callan dentro de un campo de texto: ahí ese atajo es el del ' +
      'navegador sobre lo que se está escribiendo, y las celdas de coordenada son campos.',
  }),
])

// ── El único icono que queda (SVG en línea; ver la cabecera) ─────────────────

const NS_SVG = 'http://www.w3.org/2000/svg'

/**
 * Trazos del icono, en un lienzo de 24×24 y solo con `<path>`: un único tipo de
 * nodo hace que {@link crearIcono} no tenga ramas.
 *
 * Aquí había seis iconos hasta el 2026-08-05 —deshacer, rehacer, imán, offset,
 * interrogación y punta de flecha—. Los cinco primeros los sustituye el NOMBRE
 * escrito de su herramienta (ver la cabecera). Sobrevive la punta de flecha
 * porque no nombra nada: es la señal de «esto despliega», y esa sí es más clara
 * dibujada que escrita.
 */
const ICONOS = Object.freeze({
  /** Punta de flecha hacia abajo: «esto abre algo». */
  CARET: Object.freeze(['M7 10l5 5 5-5']),
})

// ── Fábricas de DOM ──────────────────────────────────────────────────────────

/**
 * `document.createElement` + clase + padre. Gemela de `L.DomUtil.create`, pero
 * contra el `Document` que se le pase: el del contenedor del mapa, no el global
 * (mismo criterio que `viewer/edicion.js`, que deriva su `doc` de
 * `mapa.getContainer().ownerDocument`).
 *
 * @param {Document} doc
 * @param {string} etiqueta
 * @param {string} [clase]
 * @param {Element} [padre]
 * @returns {HTMLElement}
 */
function crear(doc, etiqueta, clase, padre) {
  const nodo = doc.createElement(etiqueta)
  if (clase) nodo.className = clase
  if (padre) padre.appendChild(nodo)
  return nodo
}

/**
 * Un icono SVG en línea. `aria-hidden` porque el nombre accesible del botón lo
 * pone su `<span>` de texto: un icono anunciado además sería el rótulo dicho dos
 * veces.
 *
 * @param {Document} doc
 * @param {ReadonlyArray<string>} trazos  Atributos `d` de los `<path>`.
 * @returns {SVGElement}
 */
function crearIcono(doc, trazos) {
  const svg = doc.createElementNS(NS_SVG, 'svg')
  svg.setAttribute('class', CLASE_BARRA.ICONO)
  svg.setAttribute('viewBox', '0 0 24 24')
  // 14 px, y el tamaño se fija AQUÍ y no en la hoja: queda un solo icono —la
  // punta de flecha— y tiene que verse igual de pequeña al lado de una palabra
  // aunque `estilos/app.css` no llegue. Eran 18 cuando cada herramienta era un
  // dibujo y el dibujo era todo lo que había que ver.
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('fill', 'none')
  // `currentColor` para que el icono herede el color del botón y no haya que
  // repintarlo en cada estado (hover, deshabilitado, foco).
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  // Un `<svg>` es focusable por defecto en algún navegador heredado; esto lo saca
  // del orden de tabulación sin depender de CSS.
  svg.setAttribute('focusable', 'false')
  for (const d of trazos) {
    const trazo = doc.createElementNS(NS_SVG, 'path')
    trazo.setAttribute('d', d)
    svg.appendChild(trazo)
  }
  return svg
}

/**
 * Texto accesible VISUALMENTE OCULTO. Desde que las herramientas llevan su
 * nombre escrito tiene dos usos, y los dos siguen siendo necesarios:
 *
 *   1. **Completar un nombre que se abrevia en pantalla.** «Ajuste» cabe en la
 *      barra; «Ajuste al parcelario» es lo que hay que oír. El trozo que falta va
 *      aquí, detrás del texto visible, y el nombre accesible sale de la suma.
 *   2. **Nombrar lo que sigue sin texto**: la punta de flecha del ajuste, que es
 *      un botón entero («Tolerancia del ajuste») dibujado con 14 px de flecha.
 *
 * Se oculta con estilo EN LÍNEA, no solo con la clase, por la misma razón que
 * `viewer/capas.js` inlinea el mínimo de su control: este módulo no importa
 * ninguna hoja de estilo y tiene que ser correcto por sí mismo. Un rótulo que
 * dependiera de que `estilos/app.css` esté cargada sería una barra llena de
 * palabras repetidas el día que la hoja no llegue.
 *
 * Es la técnica estándar (1×1 px + `clip-path`), NO `display:none` ni
 * `visibility:hidden`: esas dos lo esconden también del lector de pantalla, que
 * es justo a quien va dirigido.
 *
 * @param {Document} doc
 * @param {string} texto
 * @returns {HTMLElement}
 */
function crearRotulo(doc, texto) {
  const rotulo = crear(doc, 'span', CLASE_BARRA.ROTULO)
  rotulo.textContent = texto
  rotulo.style.position = 'absolute'
  rotulo.style.width = '1px'
  rotulo.style.height = '1px'
  rotulo.style.margin = '-1px'
  rotulo.style.padding = '0'
  rotulo.style.overflow = 'hidden'
  rotulo.style.clipPath = 'inset(50%)'
  rotulo.style.whiteSpace = 'nowrap'
  rotulo.style.border = '0'
  return rotulo
}

/**
 * Botón de la barra. `type="button"` SIEMPRE (un `<button>` sin tipo envía
 * formularios; aquí no hay ninguno, pero el día que la barra viva dentro de uno
 * sería un recargue de página sin explicación).
 *
 * El nombre accesible se compone en el ORDEN en que se cuelgan los hijos:
 * `texto` visible + `resto` oculto. Por eso «Ayuda» + «&nbsp;sobre los gestos de
 * edición» se lee entero y se ve corto, sin `aria-label` — que además habría
 * PISADO el texto visible en vez de completarlo, y dejaría a la vista una palabra
 * que el lector de pantalla no dice (el fallo clásico del rótulo doble).
 *
 * @param {Document} doc
 * @param {object} opciones
 * @param {Element} opciones.padre
 * @param {string} [opciones.texto]   Nombre VISIBLE. Sin él, el botón es solo icono.
 * @param {string} [opciones.resto]   Cola del nombre accesible, oculta a la vista.
 * @param {string} [opciones.titulo]  `title`. Solo donde el texto visible no basta.
 * @param {boolean} [opciones.caret]  Añade la punta de flecha de «esto despliega».
 * @param {string} [opciones.clase]
 * @returns {HTMLButtonElement}
 */
function crearBoton(doc, { padre, texto, resto, titulo, caret = false, clase = CLASE_BARRA.HERRAMIENTA }) {
  const boton = /** @type {HTMLButtonElement} */ (crear(doc, 'button', clase, padre))
  boton.type = 'button'
  if (titulo) boton.title = titulo
  if (texto) {
    const etiqueta = crear(doc, 'span', CLASE_BARRA.TEXTO, boton)
    etiqueta.textContent = texto
  }
  if (resto) boton.appendChild(crearRotulo(doc, resto))
  if (caret) boton.appendChild(crearIcono(doc, ICONOS.CARET))
  return boton
}

/**
 * Filete vertical entre grupos de herramientas. Es `role="separator"` de verdad
 * y no un borde en el vecino: dentro de un `role="toolbar"` el separador está en
 * el vocabulario ARIA, y así el agrupamiento que se ve —historial · ajuste ·
 * desplazamiento · ayuda— es el mismo que se oye.
 *
 * No entra en `_herramientas`: no es focusable y las flechas del teclado lo
 * saltan sin tener que saber nada de él.
 *
 * @param {Document} doc
 * @param {Element} padre
 * @returns {HTMLElement}
 */
function crearSeparador(doc, padre) {
  const separador = crear(doc, 'span', CLASE_BARRA.SEPARADOR, padre)
  separador.setAttribute('role', 'separator')
  separador.setAttribute('aria-orientation', 'vertical')
  return separador
}

/**
 * Campo numérico con su `<label for>` REAL (no un `aria-label`: la etiqueta
 * visible tiene que existir y además ampliar el área de pulsación).
 *
 * @param {Document} doc
 * @param {object} opciones
 * @param {Element} opciones.padre
 * @param {string} opciones.id
 * @param {string} opciones.etiqueta
 * @param {string} opciones.campo   Valor del `data-campo` (contrato de main.js).
 * @param {Record<string, string>} opciones.atributos  `value`, `min`, `step`, …
 * @returns {HTMLInputElement}
 */
function crearCampoNumero(doc, { padre, id, etiqueta, campo, atributos }) {
  const linea = crear(doc, 'div', CLASE_BARRA.DESPLEGABLE_LINEA, padre)
  const rotulo = crear(doc, 'label', CLASE_BARRA.ETIQUETA, linea)
  rotulo.setAttribute('for', id)
  rotulo.textContent = etiqueta

  const entrada = /** @type {HTMLInputElement} */ (
    crear(doc, 'input', CLASE_BARRA.ENTRADA, linea)
  )
  entrada.type = 'number'
  entrada.id = id
  entrada.dataset.campo = campo
  for (const [nombre, valor] of Object.entries(atributos)) entrada.setAttribute(nombre, valor)
  return entrada
}

// ── Contratos del programador ────────────────────────────────────────────────

/**
 * ¿Sirve como mapa de Leaflet? DUCK TYPING deliberado, no `instanceof L.Map`, por
 * la misma razón que `viewer/capas.js#esMapa` y `viewer/mapa.js#esElementoDOM`:
 * se comprueba lo que de verdad se necesita. Está duplicado y no importado porque
 * el de `capas.js` es privado de aquel módulo y sacarlo a `_comun.js` obligaría a
 * tocar un fichero que no es de esta tarea.
 *
 * @param {*} mapa
 * @returns {boolean}
 */
function esMapa(mapa) {
  return (
    !!mapa &&
    typeof mapa === 'object' &&
    typeof mapa.addControl === 'function' &&
    typeof mapa.removeControl === 'function' &&
    typeof mapa.getContainer === 'function'
  )
}

// ── La quinta esquina ────────────────────────────────────────────────────────

/**
 * Le añade a Leaflet la esquina {@link CENTRO_ABAJO}, si no la tiene ya.
 *
 * ── QUÉ ES `_controlCorners` Y POR QUÉ SE TOCA ──────────────────────────────
 * `L.Map#_initControlPos` crea CUATRO `<div>` dentro del contenedor de controles
 * —`topleft`, `topright`, `bottomleft`, `bottomright`— y los indexa en
 * `map._controlCorners`. `L.Control#addTo` busca ahí, POR NOMBRE, la esquina de
 * su `options.position`. O sea que añadir una quinta clave a ese objeto es todo
 * lo que hace falta para tener una posición nueva, y es la técnica conocida para
 * esto. El guion bajo dice que es privada, con lo que eso implica:
 *
 *   · **Se comprueba antes de tocar.** Si el mapa no expone `_controlCorners` y
 *     `_controlContainer` (un doble de test, o un Leaflet futuro que los
 *     renombre), esta función devuelve `false` y el llamante cae a una esquina de
 *     las de verdad AVISANDO. Nunca se revienta dentro de un `addControl`.
 *   · **No hay que limpiarla.** `L.Map#_clearControlPos` recorre este mismo
 *     objeto para quitar los `<div>` al destruir el mapa, así que la quinta se va
 *     con las otras cuatro sin que este módulo tenga que acordarse.
 *   · **Es idempotente y por mapa.** Cada `L.Map` tiene su propio
 *     `_controlCorners`, así que dos mapas en la misma página no se pisan; y
 *     montar dos barras sobre el mismo mapa reutiliza la esquina ya creada.
 *
 * La clase `leaflet-bottom` no es decorativa: de ella salen el `position:absolute`,
 * el `bottom:0`, el `z-index` y el `margin-bottom` de los controles que caiga
 * dentro. Y `L.Control#addTo` mira `position.indexOf('bottom')` para decidir si
 * inserta al principio o al final del `<div>`, así que el nombre `bottomcenter`
 * —con «bottom» dentro— también le dice a Leaflet lo que tiene que hacer.
 *
 * @param {import('leaflet').Map} mapa
 * @returns {boolean}  `true` si la esquina existe al volver.
 */
function asegurarEsquinaCentroAbajo(mapa) {
  const esquinas = mapa._controlCorners
  const contenedor = mapa._controlContainer
  if (!esquinas || typeof esquinas !== 'object') return false
  if (!contenedor || typeof contenedor.appendChild !== 'function') return false
  if (!esquinas[CENTRO_ABAJO]) {
    esquinas[CENTRO_ABAJO] = L.DomUtil.create(
      'div',
      `leaflet-bottom ${CLASE_ESQUINA_CENTRO_ABAJO}`,
      contenedor,
    )
  }
  return true
}

// ── El control ───────────────────────────────────────────────────────────────

/**
 * Control propio de Leaflet con la barra de edición.
 *
 * **Por qué un `L.Control` y no un `<div>` suelto sobre el mapa**, con el mismo
 * razonamiento que `viewer/capas.js#ControlOpacidad`: (1) se posiciona con el
 * sistema de esquinas de Leaflet, así que convive con el control de capas y el de
 * zoom sin cálculos de posición; (2) vive dentro del contenedor del mapa y se
 * desmonta con él; (3) `disableClickPropagation` es una función pensada
 * exactamente para este caso.
 */
const BarraEdicion = L.Control.extend({
  options: {
    // ⚠️ El defecto de la CLASE es una esquina de las de Leaflet, no
    // {@link CENTRO_ABAJO}, y es a propósito: quien construya esta clase a pelo no
    // ha pasado por `crearBarraEdicion` y por tanto NADIE le ha creado la quinta
    // esquina, así que `addTo` buscaría un `_controlCorners['bottomcenter']` que
    // no existe y reventaría dentro de Leaflet. El defecto de VERDAD —el que ve
    // quien usa el módulo— lo pone `crearBarraEdicion`, que sí la fabrica antes.
    position: 'topleft',
    etiqueta: 'Herramientas de edición de la parcela',
  },

  /**
   * Los dos oyentes del `document` se LIGAN aquí, una vez por instancia, y se
   * guardan como campos propios.
   *
   * No es ceremonia: `addEventListener` y `removeEventListener` tienen que
   * recibir **la misma referencia de función**, y un `this._metodo.bind(this)`
   * escrito en el `add` y otro en el `remove` son dos funciones distintas — el
   * oyente se quedaría vivo para siempre, sobre un control ya destruido, y
   * `destruir()` mentiría. Los oyentes que van por `L.DomEvent.on/off` no
   * necesitan esto (Leaflet los indexa por función + contexto).
   *
   * @param {object} [opciones]
   */
  initialize(opciones) {
    L.setOptions(this, opciones)
    this._alClicFuera = (evento) => this._cerrarPorClicFuera(evento)
    this._alEscape = (evento) => this._cerrarPorEscape(evento)
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    // El sello de Leaflet da ids únicos aunque se monten dos barras (dos mapas en
    // la misma página). Mismo recurso que `ControlOpacidad`.
    const sello = L.Util.stamp(this)
    const ID = {
      snap: `gml-barra-snap-${sello}`,
      tolerancia: `gml-barra-tolerancia-${sello}`,
      offset: `gml-barra-offset-${sello}`,
      despSnap: `gml-barra-desp-snap-${sello}`,
      despOffset: `gml-barra-desp-offset-${sello}`,
      ayuda: `gml-barra-ayuda-${sello}`,
    }

    const contenedor = crear(doc, 'div', CLASE_BARRA.CONTENEDOR)
    this._contenedor = contenedor
    // ── Rework de UI · rebanada 3 (Edición), 2026-08-04 ──────────────────────
    // Esta barra es de la pantalla de Edición y de ninguna otra. Se DECLARA aquí,
    // con el mismo atributo que usa `index.html`, y la ocultan las cinco reglas
    // de `estilos/app.css` — que son de descendencia desde `.gml-app`, así que
    // alcanzan también a lo que Leaflet cuelga dentro del mapa.
    //
    // ⚠️ Declarar a qué pantalla PERTENECE no es mutar estado de navegación: el
    // criterio 1 del plan prohíbe lo segundo («ningún módulo de `viewer/` muta
    // estado de navegación») y esto es un dato estático, el mismo que el marcado
    // escribe a mano en el HTML. Quién está en qué paso lo sigue decidiendo
    // `app/navegacion.js`, y este módulo no lo pregunta ni lo sabe.
    //
    // Medido antes de ponerlo: la barra se veía en las CUATRO pantallas, con
    // «Deshacer», «Rehacer» y «Desplazar lindero» apagados en las cuatro.
    contenedor.dataset.pantalla = 'edicion'
    // Estilos MÍNIMOS en línea, mismo criterio que `viewer/capas.js`: este módulo
    // no importa ninguna hoja, así que la barra tiene que ser legible por sí
    // misma sobre cualquier cartografía. El resto lo viste `estilos/app.css`.
    contenedor.style.background = 'rgba(255,255,255,0.94)'
    contenedor.style.padding = '4px'
    contenedor.style.borderRadius = '4px'
    contenedor.style.font = `${DENSIDAD_BASE_PX}px system-ui, sans-serif`

    // ── La fila de herramientas ──────────────────────────────────────────────
    const fila = crear(doc, 'div', CLASE_BARRA.FILA, contenedor)
    fila.setAttribute('role', 'toolbar')
    fila.setAttribute('aria-label', this.options.etiqueta)

    // Deshacer y rehacer. ⚠️ Llevan MARCADO dentro (el `<span>` del nombre y el
    // `<kbd>` del atajo): quien los cablea enciende y apaga su `disabled`, y NUNCA
    // les reescribe el `textContent` — se llevaría por delante las dos cosas. Lo
    // decía `index.html` junto a ellos y sigue valiendo aquí.
    this._botonDeshacer = this._crearBotonHistorial(doc, fila, {
      accion: 'deshacer',
      texto: 'Deshacer',
      tecla: 'Ctrl+Z',
      // `aria-keyshortcuts` usa los nombres de tecla de UI Events, no el rótulo.
      atajo: 'Control+Z',
    })
    this._botonRehacer = this._crearBotonHistorial(doc, fila, {
      accion: 'rehacer',
      texto: 'Rehacer',
      tecla: 'Ctrl+Y',
      atajo: 'Control+Y',
    })

    crearSeparador(doc, fila)

    // ── Botón partido del ajuste: la casilla conmuta, la flecha despliega ─────
    const partido = crear(doc, 'span', CLASE_BARRA.PARTIDO, fila)
    // `role="group"` es la forma ARIA de decir que estos dos controles son UNA
    // herramienta partida dentro de la barra, y no dos sueltas.
    partido.setAttribute('role', 'group')
    partido.setAttribute('aria-label', 'Ajuste al parcelario')

    const casilla = /** @type {HTMLInputElement} */ (
      crear(doc, 'input', CLASE_BARRA.CONMUTADOR, partido)
    )
    casilla.type = 'checkbox'
    casilla.id = ID.snap
    casilla.dataset.campo = 'snap'
    // ⚠️ NACE MARCADA, y es lo que protege del error más caro de esta app: dejar
    // un hueco de milímetros entre dos parcelas que en el terreno son la misma
    // línea. El estado inicial tiene que ser el que protege. `app/main.js` empuja
    // este `.checked` al visor en el arranque.
    //
    // Se marca por `defaultChecked` (o sea, por el ATRIBUTO) y no solo por la
    // propiedad: `checked` no refleja al atributo, así que un `.checked = true`
    // suelto deja el marcado diciendo lo contrario que la pantalla y ensucia
    // además la bandera «dirty» del campo. `defaultChecked` es lo que un
    // `checked` escrito en el HTML habría hecho.
    casilla.defaultChecked = true

    // El `<label>` es la PIEL del conmutador y por tanto quien lleva su nombre.
    // Visible dice «Ajuste» —que es lo que cabe en una barra—; el nombre accesible
    // completo sale de sumarle el `<span>` oculto de detrás.
    const rotuloCasilla = crear(doc, 'label', CLASE_BARRA.CONMUTADOR_ROTULO, partido)
    rotuloCasilla.setAttribute('for', ID.snap)
    rotuloCasilla.title = 'Ajustar al parcelario'
    const textoAjuste = crear(doc, 'span', CLASE_BARRA.TEXTO, rotuloCasilla)
    textoAjuste.textContent = 'Ajuste'
    rotuloCasilla.appendChild(crearRotulo(doc, ' al parcelario'))

    // La única herramienta que sigue SIN texto: es la mitad estrecha de un botón
    // partido y una palabra ahí duplicaría el ancho del ajuste entero. Su nombre
    // va oculto, y además en el `title` porque es lo que el ratón encuentra.
    this._dispSnap = crearBoton(doc, {
      padre: partido,
      resto: 'Tolerancia del ajuste',
      titulo: 'Tolerancia del ajuste',
      caret: true,
      clase: `${CLASE_BARRA.HERRAMIENTA} ${CLASE_BARRA.HERRAMIENTA_FLECHA}`,
    })
    this._dispSnap.dataset.desplegable = 'snap'

    crearSeparador(doc, fila)

    // ── Desplazar lindero ────────────────────────────────────────────────────
    // ⚠️ Este botón NO se deshabilita NUNCA: abre siempre su desplegable. Ver
    // {@link MOTIVO_SIN_LADO}.
    this._dispOffset = crearBoton(doc, {
      padre: fila,
      texto: 'Desplazar lindero',
      caret: true,
    })
    this._dispOffset.dataset.desplegable = 'offset'

    crearSeparador(doc, fila)

    // ── Ayuda ────────────────────────────────────────────────────────────────
    // «Ayuda» a la vista, «Ayuda sobre los gestos de edición» al oído: la palabra
    // sola no dice ayuda DE QUÉ, y en una app con cuatro pantallas eso importa.
    this._botonAyuda = crearBoton(doc, {
      padre: fila,
      texto: 'Ayuda',
      resto: ' sobre los gestos de edición',
    })
    this._botonAyuda.dataset.accion = 'ayuda'

    // ── Desplegable del ajuste ───────────────────────────────────────────────
    const despSnap = crear(doc, 'div', CLASE_BARRA.DESPLEGABLE, contenedor)
    despSnap.id = ID.despSnap
    despSnap.dataset.panel = 'snap'
    despSnap.hidden = true
    this._campoTolerancia = crearCampoNumero(doc, {
      padre: despSnap,
      id: ID.tolerancia,
      etiqueta: 'Tolerancia (cm)',
      campo: 'snap-tolerancia',
      atributos: { value: TOLERANCIA_INICIAL_CM, min: '0', step: '1' },
    })
    const ayudaTolerancia = crear(doc, 'p', CLASE_BARRA.MOTIVO, despSnap)
    ayudaTolerancia.textContent = 'Un 0 apaga el enganche sin desactivar el ajuste.'

    // ── Desplegable del desplazamiento ───────────────────────────────────────
    const despOffset = crear(doc, 'div', CLASE_BARRA.DESPLEGABLE, contenedor)
    despOffset.id = ID.despOffset
    despOffset.dataset.panel = 'offset'
    despOffset.hidden = true
    this._campoOffset = crearCampoNumero(doc, {
      padre: despOffset,
      id: ID.offset,
      etiqueta: 'Distancia (m)',
      campo: 'offset-distancia',
      // En METROS, a diferencia de la tolerancia: un lindero se desplaza «medio
      // metro» o «tres metros», y el `step` de 0,01 ya da el centímetro.
      atributos: { step: '0.01', placeholder: '0,00' },
    })
    this._botonOffset = /** @type {HTMLButtonElement} */ (
      crear(doc, 'button', CLASE_BARRA.ACCION, despOffset)
    )
    this._botonOffset.type = 'button'
    this._botonOffset.dataset.accion = 'offset'
    this._botonOffset.textContent = 'Desplazar lindero'
    // Nace apagado: sin lado seleccionado no hay nada que mover. A partir de aquí
    // manda `app/main.js`, que lo sigue con `edicion.alCambiarSeleccion`.
    this._botonOffset.disabled = true
    // ⚠️ HERMANO SIGUIENTE del botón, y ese orden es INVARIANTE: es lo que permite
    // que `estilos/app.css` lo enseñe solo cuando el botón está apagado, con
    // `[data-accion="offset"]:disabled ~ .gml-barra-motivo`, sin que nadie observe
    // ese `disabled`.
    this._motivoOffset = crear(doc, 'p', CLASE_BARRA.MOTIVO, despOffset)
    this._motivoOffset.dataset.motivo = 'offset'
    this._motivoOffset.textContent = MOTIVO_SIN_LADO

    // ── Panel de ayuda ───────────────────────────────────────────────────────
    const ayuda = crear(doc, 'div', CLASE_BARRA.AYUDA, contenedor)
    ayuda.id = ID.ayuda
    ayuda.dataset.panel = 'ayuda'
    ayuda.hidden = true
    ayuda.setAttribute('role', 'dialog')
    ayuda.setAttribute('aria-label', 'Gestos de edición sobre el mapa')
    // Para poder llevarle el foco al abrir sin meterlo en el orden de tabulación.
    ayuda.tabIndex = -1
    this._panelAyuda = ayuda
    this._pintarAyuda(doc, ayuda)

    // ── El renglón `role="status"` ───────────────────────────────────────────
    // Caja VACÍA: el desenlace de deshacer, rehacer, insertar, eliminar y
    // desplazar, anunciado por el lector de pantalla SIN robar el foco (el usuario
    // sigue con las manos en el mapa). Vacío no ocupa alto, por la clase del panel.
    const renglon = crear(doc, 'p', `${CLASE_ESTADO_PANEL} ${CLASE_BARRA.ESTADO}`, contenedor)
    renglon.dataset.estado = 'edicion'
    renglon.setAttribute('role', 'status')
    this._renglon = renglon

    // ── Estado de apertura ───────────────────────────────────────────────────
    /** @type {Record<string, {panel: HTMLElement, disparador: HTMLElement, foco: HTMLElement}>} */
    this._registro = {
      snap: { panel: despSnap, disparador: this._dispSnap, foco: this._campoTolerancia },
      offset: { panel: despOffset, disparador: this._dispOffset, foco: this._campoOffset },
      ayuda: { panel: ayuda, disparador: this._botonAyuda, foco: ayuda },
    }
    for (const { panel, disparador } of Object.values(this._registro)) {
      // El par del patrón «disclosure»: quién abre (`aria-expanded`) y qué abre
      // (`aria-controls`). No se les pone `role` a las cajas: un desplegable no es
      // un `menu` ni un `dialog`, y ponérselo prometería una navegación por
      // teclado que no tienen.
      disparador.setAttribute('aria-controls', panel.id)
      disparador.setAttribute('aria-expanded', 'false')
    }
    this._abierto = null

    /** Las herramientas de la fila, en orden, para las flechas del teclado. */
    this._herramientas = [
      this._botonDeshacer,
      this._botonRehacer,
      casilla,
      this._dispSnap,
      this._dispOffset,
      this._botonAyuda,
    ]

    // ── Oyentes ──────────────────────────────────────────────────────────────
    // Sin esto, pulsar un botón de la barra SELECCIONARÍA UN LINDERO por debajo
    // (el contenedor del control vive dentro del contenedor del mapa) y la rueda
    // sobre el desplegable haría zoom. Ver la cabecera.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    L.DomEvent.on(this._dispSnap, 'click', this._alPulsarSnap, this)
    L.DomEvent.on(this._dispOffset, 'click', this._alPulsarOffset, this)
    L.DomEvent.on(this._botonAyuda, 'click', this._alPulsarAyuda, this)
    L.DomEvent.on(this._botonCerrarAyuda, 'click', this._alPulsarCerrarAyuda, this)
    L.DomEvent.on(contenedor, 'keydown', this._alTeclaEnBarra, this)

    // En el DOCUMENTO, no en el contenedor: `Escape` tiene que cerrar aunque el
    // foco esté en el mapa, y el clic de fuera ocurre por definición fuera.
    doc.addEventListener('click', this._alClicFuera)
    doc.addEventListener('keydown', this._alEscape)

    return contenedor
  },

  onRemove() {
    L.DomEvent.off(this._dispSnap, 'click', this._alPulsarSnap, this)
    L.DomEvent.off(this._dispOffset, 'click', this._alPulsarOffset, this)
    L.DomEvent.off(this._botonAyuda, 'click', this._alPulsarAyuda, this)
    L.DomEvent.off(this._botonCerrarAyuda, 'click', this._alPulsarCerrarAyuda, this)
    L.DomEvent.off(this._contenedor, 'keydown', this._alTeclaEnBarra, this)
    if (this._doc) {
      this._doc.removeEventListener('click', this._alClicFuera)
      this._doc.removeEventListener('keydown', this._alEscape)
    }
    this._abierto = null
  },

  // ── Construcción de piezas ─────────────────────────────────────────────────

  /**
   * Un botón del historial: su nombre + el `<kbd>` VISIBLE del atajo. El `<kbd>`
   * no es decoración y no va en un `title`: un atajo que solo aparece al pasar el
   * ratón no lo descubre quien va por teclado. Y `aria-keyshortcuts` lo dice
   * además en el árbol de accesibilidad, que es donde un lector de pantalla lo
   * busca.
   *
   * Sin `title`, a diferencia de los demás: el nombre y el atajo ya están los dos
   * escritos en el propio botón, y un tooltip que repita lo que se está leyendo
   * es ruido que además tapa la parcela al segundo de pasar por encima.
   */
  _crearBotonHistorial(doc, padre, { accion, texto, tecla, atajo }) {
    const boton = crearBoton(doc, { padre, texto })
    boton.dataset.accion = accion
    boton.setAttribute('aria-keyshortcuts', atajo)
    const kbd = crear(doc, 'kbd', CLASE_BARRA.TECLA, boton)
    kbd.textContent = tecla
    // Nacen apagados: con la pila vacía no hay nada que deshacer ni que rehacer.
    // A partir de aquí manda `app/main.js#refrescar`.
    boton.disabled = true
    return boton
  },

  /** La tabla de {@link GESTOS} y el botón de cierre del panel de ayuda. */
  _pintarAyuda(doc, ayuda) {
    const titulo = crear(doc, 'p', CLASE_BARRA.AYUDA_TITULO, ayuda)
    titulo.textContent = 'Gestos de edición'

    // Por qué la barra arranca con casi todo apagado. La regla de oro 1 exige que
    // quien deja un botón gris diga el motivo, y este es su sitio: `app/main.js`
    // lo escribía en el renglón de estado, pero desde que la barra flota SOBRE EL
    // MAPA ese texto era un cartel de tres líneas plantado sobre la ortofoto que
    // no se iba hasta la primera edición (comprobado en navegador el 2026-07-29).
    // Aquí lo lee quien pregunta, y no estorba a quien no.
    const intro = crear(doc, 'p', CLASE_BARRA.AYUDA_INTRO, ayuda)
    intro.textContent =
      'Al abrir no hay nada que deshacer ni ningún lindero elegido, así que casi ' +
      'toda la barra nace apagada: «Deshacer» y «Rehacer» se encienden con la ' +
      'primera edición, y «Desplazar lindero» en cuanto pinches un lindero del mapa.'

    const tabla = crear(doc, 'table', CLASE_BARRA.AYUDA_TABLA, ayuda)
    const cabecera = crear(doc, 'thead', undefined, tabla)
    const filaCabecera = crear(doc, 'tr', undefined, cabecera)
    for (const texto of ['Gesto', 'Dónde', 'Qué hace']) {
      const celda = crear(doc, 'th', undefined, filaCabecera)
      celda.scope = 'col'
      celda.textContent = texto
    }

    const cuerpo = crear(doc, 'tbody', undefined, tabla)
    for (const { gesto, donde, hace } of GESTOS) {
      const fila = crear(doc, 'tr', undefined, cuerpo)
      const celdaGesto = crear(doc, 'th', undefined, fila)
      celdaGesto.scope = 'row'
      for (const segmento of gesto) {
        if (typeof segmento === 'string') {
          celdaGesto.appendChild(doc.createTextNode(segmento))
        } else {
          const kbd = crear(doc, 'kbd', CLASE_BARRA.TECLA, celdaGesto)
          kbd.textContent = segmento.kbd
        }
      }
      crear(doc, 'td', undefined, fila).textContent = donde
      crear(doc, 'td', undefined, fila).textContent = hace
    }

    // Un `role="dialog"` que solo se cierre con `Escape` es un callejón para quien
    // usa ratón: el botón es la salida visible.
    this._botonCerrarAyuda = /** @type {HTMLButtonElement} */ (
      crear(doc, 'button', CLASE_BARRA.AYUDA_CERRAR, ayuda)
    )
    this._botonCerrarAyuda.type = 'button'
    this._botonCerrarAyuda.textContent = 'Cerrar'
  },

  // ── Apertura y cierre ──────────────────────────────────────────────────────

  /**
   * Cierra lo que haya abierto. **Un solo desplegable o panel a la vez**: dos
   * cajas abiertas sobre el mapa taparían justo la geometría que se está editando.
   *
   * @param {boolean} [devolverFoco=false]  Devuelve el foco a la herramienta que
   *   lo abrió. Se hace con `Escape` y con «Cerrar», no al pinchar fuera: ahí el
   *   usuario ya ha decidido dónde quiere el foco.
   */
  _cerrar(devolverFoco = false) {
    if (this._abierto === null) return
    const { panel, disparador } = this._registro[this._abierto]
    panel.hidden = true
    disparador.setAttribute('aria-expanded', 'false')
    this._abierto = null
    if (devolverFoco) disparador.focus()
  },

  /** @param {'snap'|'offset'|'ayuda'} nombre */
  _abrir(nombre) {
    if (this._abierto === nombre) {
      this._cerrar(true)
      return
    }
    this._cerrar()
    const { panel, disparador, foco } = this._registro[nombre]
    // Se DESOCULTA antes de mover el foco: un elemento `hidden` no lo admite.
    panel.hidden = false
    disparador.setAttribute('aria-expanded', 'true')
    this._abierto = nombre
    if (foco) foco.focus()
  },

  _alPulsarSnap() {
    this._abrir('snap')
  },

  _alPulsarOffset() {
    this._abrir('offset')
  },

  _alPulsarAyuda() {
    this._abrir('ayuda')
  },

  _alPulsarCerrarAyuda() {
    this._cerrar(true)
  },

  // ── Oyentes del documento ──────────────────────────────────────────────────

  /**
   * Pinchar FUERA de la barra cierra. Se invoca desde el campo `_alClicFuera` que
   * liga {@link initialize} (ahí está el porqué de esa indirección).
   *
   * ⚠️ NI `preventDefault` NI `stopPropagation`, y es lo que hace que un clic en
   * el mapa cierre el desplegable **y además** seleccione el lindero. La razón
   * completa, en la cabecera del módulo.
   */
  _cerrarPorClicFuera(evento) {
    if (this._abierto === null) return
    const destino = evento && evento.target
    // `disableClickPropagation` NO detiene el `click` (solo `mousedown`,
    // `touchstart`, `dblclick` y `contextmenu`), así que los clics de DENTRO
    // también llegan aquí: sin esta guarda, abrir un desplegable lo cerraría en el
    // mismo gesto.
    if (destino && this._contenedor && this._contenedor.contains(destino)) return
    this._cerrar()
  },

  /** `Escape` cierra y devuelve el foco a la herramienta que abrió. */
  _cerrarPorEscape(evento) {
    if (this._abierto === null) return
    if (!evento || evento.key !== 'Escape') return
    // Se consume solo cuando de verdad hemos cerrado algo (arriba hay dos
    // salidas): así `Escape` sigue siendo del navegador cuando la barra no tiene
    // nada abierto.
    evento.preventDefault()
    this._cerrar(true)
  },

  /**
   * Flechas dentro de la barra: mueven el foco entre las herramientas HABILITADAS.
   * `Home`/`End` van a la primera y a la última. Ver en la cabecera por qué NO hay
   * `tabindex` móvil.
   */
  _alTeclaEnBarra(evento) {
    if (!evento) return
    const desde = this._herramientas.indexOf(evento.target)
    // Un `-1` es lo normal: significa que se está tecleando en un campo del
    // desplegable, donde las flechas son del `<input type="number">`.
    if (desde === -1) return

    let destino = null
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      destino = this._vecinaHabilitada(desde, 1)
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      destino = this._vecinaHabilitada(desde, -1)
    } else if (evento.key === 'Home') {
      destino = this._vecinaHabilitada(-1, 1)
    } else if (evento.key === 'End') {
      destino = this._vecinaHabilitada(this._herramientas.length, -1)
    } else {
      return
    }

    if (destino === null) return
    // La flecha deja de desplazar la página mientras el foco está en la barra.
    evento.preventDefault()
    destino.focus()
  },

  /**
   * La siguiente herramienta HABILITADA en el sentido `paso`, con vuelta al
   * principio. `null` si no hay ninguna (todas apagadas): entonces no se mueve el
   * foco, en vez de tirarlo a un botón que no responde.
   *
   * El `disabled` se consulta AQUÍ, en el instante de la pulsación, y no se
   * cachea: lo gobierna `app/main.js` y cambia sin avisar (ver la cabecera).
   *
   * @param {number} desde  Índice de partida (puede estar fuera del array: así
   *   `Home` y `End` reutilizan esta misma función).
   * @param {1|-1} paso
   * @returns {HTMLElement|null}
   */
  _vecinaHabilitada(desde, paso) {
    const total = this._herramientas.length
    let i = desde
    for (let k = 0; k < total; k += 1) {
      i = (((i + paso) % total) + total) % total
      const candidata = this._herramientas[i]
      if (!candidata.disabled) return candidata
    }
    return null
  },
})

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BarraMontada
 * @property {import('leaflet').Control} control  El control de Leaflet, ya
 *   añadido al mapa. Se devuelve para poder reposicionarlo (`setPosition`) sin
 *   volver a construirlo.
 * @property {() => void} destruir  Quita el control del mapa y retira los oyentes
 *   del documento. IDEMPOTENTE.
 */

/**
 * Monta la barra flotante de edición sobre un mapa YA creado.
 *
 * Al volver, los SIETE nodos del contrato de `app/main.js#cablearEdicion` ya
 * están en el documento y son localizables con `document.querySelector`: el
 * montaje del control de Leaflet es síncrono. Ese es el orden que hay que
 * respetar en la entrada de la app —barra primero, cableado después—, igual que
 * hoy `index.html` está en el documento antes de que corra `app/main.js`.
 *
 * @param {object} opciones
 * @param {import('leaflet').Map} opciones.mapa  Mapa de `viewer/mapa.js#crearMapa`.
 * @param {string} [opciones.posicion='bottomcenter']  Dónde flota. Además de las
 *   cuatro esquinas de Leaflet admite {@link CENTRO_ABAJO}, que es el DEFECTO y la
 *   única posición donde la barra no se apila debajo de otro control del mapa
 *   (ver la cabecera). Si el mapa no deja añadir esa quinta esquina, se cae a
 *   `bottomleft` **avisando por `alAvisar`**.
 * @param {import('./_comun.js').Avisar} [opciones.alAvisar]  Canal de aviso del
 *   visor. Tiene UN suceso que contar —y solo uno—: que la barra no ha podido
 *   centrarse abajo. Todo lo demás de este módulo es fabricar nodos, abrirlos y
 *   cerrarlos, que no le interesa a nadie de fuera. Se resuelve SIEMPRE, haya
 *   algo que avisar o no, para que quien pase basura donde va el canal se entere
 *   aquí y no tres módulos más allá: es el patrón obligatorio del visor.
 * @returns {BarraMontada}
 * @throws {TypeError}   Si `mapa` no es un mapa de Leaflet, si `posicion` no es
 *   una cadena, o si `alAvisar` no es una función.
 * @throws {RangeError}  Si `posicion` no es una posición conocida.
 */
export function crearBarraEdicion({ mapa, posicion = CENTRO_ABAJO, alAvisar } = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearBarraEdicion: 'mapa' debe ser un mapa de Leaflet (el de viewer/mapa.js#crearMapa), ` +
        `con addControl/removeControl/getContainer; recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearBarraEdicion: 'posicion' debe ser una cadena con una esquina de Leaflet; recibido ` +
        `${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearBarraEdicion: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) siempre.
  const avisar = resolverAvisar(alAvisar)

  // La quinta esquina se fabrica ANTES del `addControl`: `L.Control#addTo` la
  // busca por nombre en `map._controlCorners` y con `undefined` reventaría dentro
  // de Leaflet, con una traza que no nombraría a este módulo.
  let esquina = posicion
  if (posicion === CENTRO_ABAJO && !asegurarEsquinaCentroAbajo(mapa)) {
    esquina = POSICION_DE_RESERVA
    avisar(
      `La barra de edición no ha podido centrarse en el borde inferior del mapa y se ha puesto ` +
        `en '${POSICION_DE_RESERVA}', donde comparte sitio con el control de escala. Este mapa no ` +
        `expone '_controlCorners'/'_controlContainer', que es de donde Leaflet saca las esquinas ` +
        `de sus controles.`,
      { nivel: NIVEL.AVISO },
    )
  }

  const control = new BarraEdicion({ position: esquina })
  mapa.addControl(control)

  let destruido = false

  return {
    control,

    /**
     * Quita el control del mapa —lo que dispara `onRemove` y con él la retirada de
     * los oyentes del `document`— y deja el módulo inerte. IDEMPOTENTE: la segunda
     * llamada no hace nada. No toca el mapa ni ninguna otra capa: son del llamante.
     */
    destruir() {
      if (destruido) return
      destruido = true
      control.remove()
    },
  }
}
