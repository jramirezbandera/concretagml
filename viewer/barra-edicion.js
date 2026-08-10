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
//     [data-accion="borrar"]          (conmutador del modo borrar, 2026-08-10)
//     [data-estado="edicion"]         (role="status")
//
// **Este módulo produce EXACTAMENTE esos ocho nodos, con esos mismos `data-*` y
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
//     ocho de arriba: los selectores del contrato son de VALOR EXACTO.
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
// Así que las herramientas conservan su orden de tabulación natural —lo
// mismo que haría un grupo de botones sin nada— y las flechas se añaden ENCIMA
// como acelerador, saltando las deshabilitadas en el momento de la pulsación, que
// es el único instante en el que hace falta saberlo.
//
// ── ICONOS CON PISTA PROPIA (y por qué esto no repite el error de 2026-08-05) ─
// Esta barra ha tenido las dos formas, y la historia importa para no volver atrás
// por tercera vez:
//
//   · **Hasta el 2026-08-05**: seis iconos SVG de 18 px con el nombre escondido en
//     un `<span>` para el lector de pantalla, y `title` nativo para el ratón. El
//     autor lo RECHAZÓ, y la objeción no era «no me gustan los iconos»: era que un
//     imán en herradura, dos linderos con una flecha y una interrogación son
//     símbolos que hay que aprenderse, y **`title` no los enseña porque aparece al
//     segundo de pasar el ratón, o sea después de haber dudado**.
//   · **Del 2026-08-05 al 2026-08-10**: cada herramienta con su nombre ESCRITO.
//     Arreglaba la duda y trajo su propia factura: la fila medía ~530 px, y el
//     panel de ayuda —460 px— quedaba más estrecho que ella, dejando **~70 px de
//     blanco muerto a su derecha** que el autor leyó como un margen roto (lo era:
//     una caja de 460 alineada a la izquierda dentro de otra de 530).
//   · **Desde el 2026-08-10 (esto)**: iconos otra vez, **pero la objeción de
//     entonces se ataca de frente en vez de ignorarse**. La barra NO usa `title`:
//     lleva una PISTA propia ({@link CLASE_BARRA.PISTA}) que aparece a los
//     {@link RETARDO_PISTA_MS} ms del ratón —una quinta parte de lo que tarda el
//     nativo— y **al instante** con el foco del teclado. Un icono con respuesta a
//     120 ms se explora; con respuesta a 600 ms se sufre. Esa es toda la
//     diferencia entre las dos versiones, y es la que decide si esto vuelve a
//     rechazarse.
//
// Consecuencias de la forma de hoy:
//   · La fila mide ~200 px en vez de ~530, así que el panel de ayuda pasa a ser el
//     hijo MÁS ANCHO de la barra y el blanco muerto desaparece por construcción.
//     (`estilos/app.css` lo remata centrando los hijos: sin eso, la fila estrecha
//     se quedaría pegada a la izquierda de un panel abierto de 460 px.)
//   · Los iconos son SVG EN LÍNEA, por el mismo motivo que `viewer/sincronizacion.js`
//     usa `L.divIcon` y no `L.Icon` (hallazgo C8): los assets con URL se rompen
//     entre dev, build y jsdom, y una fuente de iconos añade una descarga que puede
//     fallar para dibujar una papelera.
//   · `crearRotulo` (el `<span>` de 1×1 px) es ahora quien pone el NOMBRE ACCESIBLE
//     ENTERO de cada herramienta —«Deshacer», «Ajuste al parcelario», «Borrar
//     vértices»—, que es lo que oye un lector de pantalla. La pista visual dice ese
//     mismo texto: **una sola fuente, dos salidas**, para que no puedan divergir.
//   · Los `<kbd>` VISIBLES de deshacer y rehacer se van con las palabras. El atajo
//     no se pierde: se dice en la pista y sigue en `aria-keyshortcuts`.
//
// ── EL MODO BORRAR ES LA ÚNICA HERRAMIENTA CON ESTADO ───────────────────────
// «Borrar vértices» (`[data-accion="borrar"]`) no ejecuta: ARMA. Queda pulsada y
// cada clic del mapa borra un vértice hasta que se apaga. Eso obliga a tres cosas
// que las demás herramientas no necesitan, y las tres están aquí y no en el CSS:
//   1. **`aria-pressed`**, porque es un conmutador y no un disparador. Lo conmuta
//      {@link BarraEdicion#borrarActivo}, al que llama el cableado.
//   2. **La pista CAMBIA con el estado** («Borrar vértices» ↔ «Salir del modo
//      borrar»): un botón que hace una cosa distinta tiene que decirlo, igual que
//      «Dibujar recinto» pasa a «Cancelar dibujo».
//   3. **El botón NO se apaga solo.** Quien manda es `viewer/edicion.js`, que
//      apaga el modo por tres caminos que este módulo no ve (`Escape`, salir de
//      Edición, `destruir`). Por eso el cableado se suscribe a `alCambiarModoBorrar`
//      y empuja el estado hacia aquí, en vez de que la barra lleve su propia copia
//      — dos verdades del mismo booleano divergen, y la que se queda vieja es
//      siempre la de la UI.
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
  /**
   * Modificador de la herramienta DESTRUCTIVA (hoy solo «Borrar vértices»). Lo que
   * cuelga de ella en la hoja es el rojo de su estado pulsado: un modo que borra
   * geometría al primer clic no puede verse igual que el que la dibuja.
   */
  HERRAMIENTA_DESTRUCTIVA: 'gml-barra-herramienta--destructiva',
  /**
   * La PISTA: el globo con el nombre de la herramienta señalada. Sustituye al
   * `title` nativo por la razón que abre la cabecera (aparece a 120 ms, no a 600).
   */
  PISTA: 'gml-barra-pista',
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
 * Lo que tarda la PISTA en aparecer con el ratón, en milisegundos.
 *
 * ── Por qué 120, y por qué este número es la tarea entera ───────────────────
 * El `title` nativo tarda entre 500 y 1.000 ms según el navegador, y ese retardo
 * es exactamente lo que hizo que el autor rechazara la barra de iconos el
 * 2026-08-05: la ayuda llegaba después de la duda, así que no ayudaba. 120 ms es
 * el orden del retardo de los tooltips de un editor de escritorio: lo bastante
 * corto para que pasar el ratón por la fila SIRVA para aprendérsela, y lo bastante
 * largo para que cruzar la barra de camino al mapa no encienda seis globos.
 *
 * Con el TECLADO no hay retardo (ver {@link BarraEdicion#_mostrarPista}): quien
 * tabula ya ha decidido pararse en ese botón, así que no hay ninguna intención que
 * adivinar, y esperar sería castigar el camino accesible.
 */
export const RETARDO_PISTA_MS = 120

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
 * Los dos nombres de «Borrar vértices», según esté armado o no.
 *
 * Un conmutador tiene que decir **qué va a pasar si lo pulsas**, no cómo se llama
 * la herramienta: encendido, pulsarlo SALE del modo. Es el mismo criterio —y el
 * mismo par de textos— que {@link PISTA_DIBUJAR} tiene desde F12.
 *
 * Y el texto del estado apagado explica el gesto completo («…y pincha»), porque un
 * icono de papelera en una barra promete «borra lo seleccionado» y aquí lo que
 * hace es ARMAR. Esa diferencia, sin escribirla, se descubre borrando algo que no
 * se quería.
 */
const PISTA_BORRAR = Object.freeze({
  apagado: 'Borrar vértices: enciende el modo y pincha los que sobren',
  encendido: 'Salir del modo borrar (Escape)',
})

/** Los dos nombres de «Dibujar recinto», por el mismo criterio (F12). */
const PISTA_DIBUJAR = Object.freeze({
  parado: 'Dibujar el recinto de la parte activa, vértice a vértice',
  dibujando: 'Cancelar el dibujo en curso (Escape)',
})

/**
 * Los gestos de edición, tal y como los fija la tabla «El mapa de gestos» de
 * `spec/feature-06-edicion-parcela.md` (que a su vez recoge lo que implementa
 * `viewer/edicion.js`). **Es la única copia**: el panel de ayuda se genera de
 * aquí, no de una tabla escrita a mano en el marcado.
 *
 * ⛔ **F12 · fase 5 · eran OCHO y ahora son DOCE**, y los cuatro nuevos son la
 * mitad de T3.5 que se había quedado sin hacer. `viewer/dibujo.js` estrenó cuatro
 * gestos sobre el mapa —clic, doble clic, `Enter`, `Retroceso`, `Escape`— y la
 * ayuda no decía ni uno: quien la abriera **mientras dibuja** vería ocho gestos y
 * ninguno sería el que está usando. Que `MENSAJE_DIBUJANDO` los cuente en el
 * renglón no lo arregla — ese renglón se va en cuanto el dibujo acaba, y la ayuda
 * es justo el sitio al que se vuelve cuando uno ya no se acuerda.
 *
 * Los cuatro llevan `donde: 'dibujando un recinto'`, que es lo que los distingue
 * de los de arriba: **el mismo clic hace dos cosas distintas** según si hay un
 * trazo abierto o no, y la tabla tiene que poder decirlo sin ambigüedad.
 *
 * **2026-08-10 · son DIECISÉIS**, por la misma razón y con el mismo criterio: el
 * modo borrar añade una TERCERA lectura del clic (`donde: 'en modo borrar'`), y la
 * × de la tabla de vértices añade una vía de borrado que no está en el mapa. Con
 * tres significados vivos del mismo gesto, la columna «Dónde» deja de ser un
 * adorno y pasa a ser lo único que distingue una fila de otra.
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
    gesto: Object.freeze(['Borrar la fila']),
    donde: 'tabla de vértices',
    hace:
      'La × del final de cada fila elimina ese vértice. Es la vía sin puntería: la de usar cuando ' +
      'el que sobra está encima de otro y no hay dónde pinchar.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Desplazar lindero']),
    donde: 'esta barra',
    hace: 'Desplaza el lado seleccionado la distancia en metros que se teclee.',
  }),

  // ── Los tres del modo borrar, que solo valen con la herramienta armada ──────
  Object.freeze({
    gesto: Object.freeze(['Borrar vértices']),
    donde: 'esta barra',
    hace:
      'ARMA el modo borrar y se queda pulsada: no borra nada por sí misma. Mientras está armada, ' +
      'el resto de la barra sigue funcionando igual.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Clic']),
    donde: 'en modo borrar',
    hace:
      `Elimina el vértice que esté a ${UMBRAL_PUNTERIA_PX} px o menos del punto pinchado, uno por ` +
      `clic y sin salir del modo. Ni selecciona linderos ni el doble clic inserta: mientras el ` +
      `modo dura, el clic solo borra.`,
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Escape' }]),
    donde: 'en modo borrar',
    hace:
      'Sale del modo. También se sale al cambiar de pantalla: un modo que borra no sobrevive a ' +
      'irse y volver.',
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Ctrl+Z' }, ' / ', { kbd: 'Ctrl+Y' }]),
    donde: 'toda la app',
    hace:
      'Deshacer y rehacer. Se callan dentro de un campo de texto: ahí ese atajo es el del ' +
      'navegador sobre lo que se está escribiendo, y las celdas de coordenada son campos.',
  }),

  // ── F12 · los cuatro del dibujo, que solo valen con un trazo abierto ───────
  Object.freeze({
    gesto: Object.freeze(['Clic']),
    donde: 'dibujando un recinto',
    hace:
      'Añade una esquina, enganchada al parcelario igual que un arrastre. Mientras hay un trazo ' +
      'abierto el clic NO selecciona linderos: dibuja.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Doble clic o ', { kbd: 'Enter' }]),
    donde: 'dibujando un recinto',
    hace:
      'Cierra el recinto y se lo asigna a la parte elegida. Con menos de tres esquinas no cierra ' +
      'y lo dice: dos puntos no encierran superficie.',
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Retroceso' }, ' / ', { kbd: 'Supr' }]),
    donde: 'dibujando un recinto',
    hace: 'Quita la última esquina puesta. No sale del dibujo: se sigue trazando.',
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Escape' }]),
    donde: 'dibujando un recinto',
    hace:
      'Cancela el trazo entero sin escribir nada. Lo que hubiera dibujado la parte antes del ' +
      'trazo se queda como estaba.',
  }),
])

// ── El único icono que queda (SVG en línea; ver la cabecera) ─────────────────

const NS_SVG = 'http://www.w3.org/2000/svg'

/** Lado del icono de una herramienta, en píxeles. Ver {@link ICONOS}. */
const LADO_ICONO_PX = 16

/**
 * Lado de la punta de flecha del botón partido. Más pequeña que las demás **a
 * propósito**: no es una herramienta, es el apéndice de la que tiene al lado, y su
 * tamaño es lo que lo dice sin escribirlo.
 */
const LADO_CARET_PX = 12

/**
 * Trazos de cada icono, en un lienzo de 24×24 y solo con `<path>`: un único tipo
 * de nodo hace que {@link crearIcono} no tenga ramas.
 *
 * **Todos son de TRAZO, ninguno de relleno** (`fill:none` + `stroke:currentColor`,
 * ver {@link crearIcono}), y eso no es un capricho de estilo: así heredan el color
 * del botón y los cuatro estados —normal, señalado, pulsado, apagado— salen gratis
 * de una sola declaración de `color` en la hoja, sin repintar ninguna forma.
 *
 * Se dibujan a 16 px sobre un botón de 28: los trazos de 2 unidades del lienzo de
 * 24 caen en ~1,33 px reales, que es lo que hace que se lean como cromo de mapa y
 * no como clipart.
 */
const ICONOS = Object.freeze({
  /** Flecha que vuelve sobre sus pasos hacia la izquierda. */
  DESHACER: Object.freeze(['M9 14l-4-4 4-4', 'M5 10h9a5 5 0 0 1 0 10h-4']),
  /** La misma, espejada: es la pareja obvia y se lee como tal. */
  REHACER: Object.freeze(['M15 14l4-4-4-4', 'M19 10h-9a5 5 0 0 0 0 10h4']),
  /**
   * Imán en herradura: el ajuste al parcelario. Es el símbolo universal del
   * «snap» en todo editor de dibujo, así que aquí sí hay convención que
   * aprovechar — y por eso este es el único de los seis que no se inventa nada.
   */
  IMAN: Object.freeze(['M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0Z', 'M5 10h4', 'M15 10h4']),
  /**
   * Dos linderos paralelos y una flecha de doble punta entre ellos: desplazar un
   * lado en paralelo a sí mismo, que es literalmente lo que hace la herramienta.
   */
  OFFSET: Object.freeze(['M3 5h18', 'M3 19h18', 'M12 8v8', 'M9.5 10.5 12 8l2.5 2.5', 'M9.5 13.5 12 16l2.5-2.5']),
  /** Papelera: borrar vértices. */
  BORRAR: Object.freeze([
    'M4 7h16',
    'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
    'M10 11v6',
    'M14 11v6',
  ]),
  /**
   * Un recinto cerrado de cinco lados. NO un lápiz: un lápiz querría decir
   * «dibujar» y también «editar», que es justo lo que hacen las otras cinco
   * herramientas de esta barra (el mismo argumento que ya estaba escrito cuando
   * este botón llevaba palabras).
   */
  DIBUJAR: Object.freeze(['M12 3l8 6-3 10H7L4 9Z']),
  /** Interrogación: la ayuda. */
  AYUDA: Object.freeze(['M9.2 9a2.8 2.8 0 1 1 3.3 2.75c-.9.2-1.5.9-1.5 1.8v.45', 'M12 17.5h.01']),
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
 * @param {number} [lado=LADO_ICONO_PX]  Píxeles del `<svg>`.
 * @returns {SVGElement}
 */
function crearIcono(doc, trazos, lado = LADO_ICONO_PX) {
  const svg = doc.createElementNS(NS_SVG, 'svg')
  svg.setAttribute('class', CLASE_BARRA.ICONO)
  svg.setAttribute('viewBox', '0 0 24 24')
  // El tamaño se fija AQUÍ y no en la hoja, por lo mismo que el fondo del
  // contenedor: este módulo no importa ninguna hoja y un icono sin medidas
  // colapsaría a 0×0 (o al tamaño por defecto del navegador, que son 300×150)
  // el día que `estilos/app.css` no llegue. Y ahora que la barra es SOLO
  // iconos, eso no sería un desperfecto: sería una barra invisible.
  svg.setAttribute('width', String(lado))
  svg.setAttribute('height', String(lado))
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
 * Texto accesible VISUALMENTE OCULTO: el NOMBRE de una herramienta que solo se ve
 * como dibujo. Desde que la barra volvió a los iconos (2026-08-10) es quien pone
 * el nombre accesible de LAS SIETE, y por tanto lo único que un lector de pantalla
 * tiene para distinguirlas.
 *
 * **El mismo texto alimenta la PISTA visual** ({@link BarraEdicion#_mostrarPista}),
 * y eso es deliberado: una sola fuente para las dos salidas. Un `aria-label` por un
 * lado y un `title` por otro son dos textos del mismo botón que acaban diciendo
 * cosas distintas — el modo de fallo clásico del icono rotulado dos veces.
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
 * Pone el NOMBRE de una herramienta: el `<span>` oculto que la nombra para el
 * lector de pantalla y el `data-pista` del que sale el globo visual.
 *
 * ⚠️ **Un solo argumento para los dos sitios**, y por eso esto es una función y no
 * dos líneas escritas siete veces: el día que alguien renombre una herramienta,
 * renombra las dos salidas o ninguna. La pista puede llevar ADEMÁS el atajo
 * (`pista`), que es información del ratón; el nombre accesible no lo repite porque
 * `aria-keyshortcuts` ya lo dice por el canal que corresponde.
 *
 * ⛔ **Aquí NO se pone `title`.** Tenerlo además de la pista propia significa dos
 * globos sobre el mismo botón: el nuestro a los 120 ms y el del navegador medio
 * segundo después, encima y con otro estilo. Es el fallo que se ve en media web
 * que se fabrica un tooltip y se olvida de quitar el nativo.
 *
 * @param {Document} doc
 * @param {HTMLElement} boton
 * @param {string} nombre  Nombre accesible, y base de la pista.
 * @param {string} [pista=nombre]  Texto de la pista, si difiere (p. ej. con atajo).
 * @returns {void}
 */
function nombrar(doc, boton, nombre, pista = nombre) {
  boton.appendChild(crearRotulo(doc, nombre))
  boton.dataset.pista = pista
}

/**
 * Botón de la barra: un icono, su nombre oculto y su pista. `type="button"`
 * SIEMPRE (un `<button>` sin tipo envía formularios; aquí no hay ninguno, pero el
 * día que la barra viva dentro de uno sería un recargue de página sin explicación).
 *
 * `icono` es opcional por un solo caso —la punta de flecha del botón partido, que
 * es `caret` y nada más—, no porque haya botones mudos: sin icono y sin caret el
 * botón no se vería, y eso lo detecta la primera mirada.
 *
 * @param {Document} doc
 * @param {object} opciones
 * @param {Element} opciones.padre
 * @param {ReadonlyArray<string>} [opciones.icono]  Trazos de {@link ICONOS}.
 * @param {string} opciones.nombre    Nombre accesible (oculto a la vista).
 * @param {string} [opciones.pista]   Texto del globo, si difiere del nombre.
 * @param {boolean} [opciones.caret]  Añade la punta de flecha de «esto despliega».
 * @param {string} [opciones.clase]
 * @returns {HTMLButtonElement}
 */
function crearBoton(doc, { padre, icono, nombre, pista, caret = false, clase = CLASE_BARRA.HERRAMIENTA }) {
  const boton = /** @type {HTMLButtonElement} */ (crear(doc, 'button', clase, padre))
  boton.type = 'button'
  if (icono) boton.appendChild(crearIcono(doc, icono))
  if (caret) boton.appendChild(crearIcono(doc, ICONOS.CARET, LADO_CARET_PX))
  nombrar(doc, boton, nombre, pista)
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
    // con el mismo atributo que usa `index.html`, y la ocultan las tres reglas
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
    contenedor.style.borderRadius = '6px'
    contenedor.style.font = `${DENSIDAD_BASE_PX}px system-ui, sans-serif`

    // ── La fila de herramientas ──────────────────────────────────────────────
    const fila = crear(doc, 'div', CLASE_BARRA.FILA, contenedor)
    fila.setAttribute('role', 'toolbar')
    fila.setAttribute('aria-label', this.options.etiqueta)

    // Deshacer y rehacer. ⚠️ Llevan MARCADO dentro (el `<svg>` del icono y el
    // `<span>` del nombre accesible): quien los cablea enciende y apaga su
    // `disabled`, y NUNCA les reescribe el `textContent` — se llevaría por delante
    // las dos cosas. Lo decía `index.html` junto a ellos y sigue valiendo aquí.
    this._botonDeshacer = this._crearBotonHistorial(doc, fila, {
      accion: 'deshacer',
      icono: ICONOS.DESHACER,
      nombre: 'Deshacer',
      tecla: 'Ctrl+Z',
      // `aria-keyshortcuts` usa los nombres de tecla de UI Events, no el rótulo.
      atajo: 'Control+Z',
    })
    this._botonRehacer = this._crearBotonHistorial(doc, fila, {
      accion: 'rehacer',
      icono: ICONOS.REHACER,
      nombre: 'Rehacer',
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

    // El `<label>` es la PIEL del conmutador y por tanto quien lleva su icono y su
    // nombre. Es el único rótulo de la barra que no es un `<button>`, así que la
    // pista se le pone a mano: {@link nombrar} sirve igual, porque lo único que
    // hace es colgar un `<span>` y escribir un `data-pista`.
    const rotuloCasilla = crear(doc, 'label', CLASE_BARRA.CONMUTADOR_ROTULO, partido)
    rotuloCasilla.setAttribute('for', ID.snap)
    rotuloCasilla.appendChild(crearIcono(doc, ICONOS.IMAN))
    nombrar(doc, rotuloCasilla, 'Ajuste al parcelario')

    // La mitad estrecha del botón partido: no es una herramienta, es su apéndice.
    this._dispSnap = crearBoton(doc, {
      padre: partido,
      nombre: 'Tolerancia del ajuste',
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
      icono: ICONOS.OFFSET,
      nombre: 'Desplazar lindero',
      caret: true,
    })
    this._dispOffset.dataset.desplegable = 'offset'

    // ── Borrar vértices (2026-08-10) ─────────────────────────────────────────
    // El modo destructivo. Va JUNTO a «Desplazar lindero» y no al lado de la
    // ayuda porque las dos son lo mismo —herramientas que cambian la geometría del
    // recinto— y el separador de después las agrupa como tales.
    //
    // ⚠️ `aria-pressed` desde el arranque, y en `'false'`, no ausente: un
    // conmutador que solo estrena el atributo al pulsarse por primera vez se
    // anuncia como un botón normal hasta entonces, y quien va por lector de
    // pantalla no puede saber que va a ARMAR algo en vez de ejecutarlo.
    this._botonBorrar = crearBoton(doc, {
      padre: fila,
      icono: ICONOS.BORRAR,
      nombre: PISTA_BORRAR.apagado,
      clase: `${CLASE_BARRA.HERRAMIENTA} ${CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA}`,
    })
    this._botonBorrar.dataset.accion = 'borrar'
    this._botonBorrar.setAttribute('aria-pressed', 'false')

    crearSeparador(doc, fila)

    // ── Dibujar recinto (F12) ────────────────────────────────────────────────
    // La herramienta con la que se declara un porche o una piscina que no estaban
    // en ningún fichero, que es el caso COMÚN de la rama EDIFICIO.
    //
    // ⚠️ **Nace OCULTO**, no apagado: en la rama PARCELA no existe una «parte» que
    // dibujar, y un botón permanentemente gris con un motivo que habla de otra
    // rama sería peor que no tenerlo. Lo enseña `dibujoVisible(true)`, que llama
    // el cableado del edificio. Es la única herramienta de esta barra que se
    // esconde, y por eso se dice aquí en vez de dejarlo al `display` de la hoja.
    this._botonDibujar = crearBoton(doc, {
      padre: fila,
      icono: ICONOS.DIBUJAR,
      nombre: PISTA_DIBUJAR.parado,
    })
    this._botonDibujar.dataset.accion = 'dibujar-recinto'
    this._botonDibujar.hidden = true
    this._separadorDibujar = crearSeparador(doc, fila)
    this._separadorDibujar.hidden = true

    // ── Ayuda ────────────────────────────────────────────────────────────────
    // «Ayuda sobre los gestos de edición», entero: una interrogación sola no dice
    // ayuda DE QUÉ, y en una app con tres pantallas eso importa.
    this._botonAyuda = crearBoton(doc, {
      padre: fila,
      icono: ICONOS.AYUDA,
      nombre: 'Ayuda sobre los gestos de edición',
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

    /**
     * Las herramientas de la fila, EN ORDEN VISUAL, para las flechas del teclado.
     *
     * ⛔ **Aquí faltaban «Dibujar recinto» desde F12 y el rótulo del ajuste desde
     * siempre**, y no era inofensivo: las flechas los SALTABAN, así que la barra
     * tenía dos herramientas alcanzables con `Tab` y no con las flechas que la
     * propia barra anuncia al ponerse `role="toolbar"`. Se arregla al pasar por
     * aquí, y {@link BarraEdicion#_vecinaHabilitada} aprende a la vez a saltar lo
     * OCULTO además de lo apagado — sin eso, añadir «Dibujar recinto» a esta lista
     * habría mandado el foco a un botón invisible en la rama PARCELA, que es un
     * error peor que el que se estaba corrigiendo.
     *
     * La casilla y su `<label>` cuentan como UNA parada: el `<label>` es la piel
     * del conmutador y no es focusable, así que quien entra en la lista es la
     * casilla.
     */
    this._herramientas = [
      this._botonDeshacer,
      this._botonRehacer,
      casilla,
      this._dispSnap,
      this._dispOffset,
      this._botonBorrar,
      this._botonDibujar,
      this._botonAyuda,
    ]

    // ── La PISTA ─────────────────────────────────────────────────────────────
    // Un solo globo para las ocho herramientas, creado UNA vez y movido: ocho
    // nodos vivos serían ocho sitios donde equivocarse de texto, y crearlo al
    // señalar metería un reflow en el gesto que tiene que ser instantáneo.
    //
    // `role="tooltip"` + `aria-hidden`: los dos, y no es contradictorio. El `role`
    // dice QUÉ es para quien inspeccione el árbol; el `aria-hidden` impide que se
    // ANUNCIE, porque el nombre accesible del botón ya dice exactamente lo mismo
    // (ver {@link nombrar}) y anunciarlo otra vez sería el rótulo dicho dos veces.
    const pista = crear(doc, 'div', CLASE_BARRA.PISTA, fila)
    pista.setAttribute('role', 'tooltip')
    pista.setAttribute('aria-hidden', 'true')
    pista.hidden = true
    this._pista = pista
    this._temporizadorPista = null
    // Los estilos que la hacen FLOTAR van en línea, no en la hoja, por lo mismo
    // que el fondo del contenedor: sin ellos la pista no sería un globo, sería un
    // renglón metido en la fila que empujaría las ocho herramientas a un lado cada
    // vez que el ratón pasa por encima. Eso no es «se ve peor», es «la barra se
    // mueve sola». Lo que sí es del CSS —tipografía, color, sombra— se queda allí.
    fila.style.position = 'relative'
    pista.style.position = 'absolute'
    pista.style.zIndex = '1'
    // Arriba si la barra está abajo (el caso normal), y abajo si está en una
    // esquina superior de Leaflet: pegada al techo del mapa, un globo por encima
    // quedaría recortado por el contenedor.
    if (String(this.options.position).startsWith('top')) pista.style.top = 'calc(100% + 6px)'
    else pista.style.bottom = 'calc(100% + 6px)'
    pista.style.whiteSpace = 'nowrap'
    // No captura el ratón: si lo hiciera, el globo que aparece bajo el cursor
    // dispararía el `mouseout` del botón y la pista parpadearía sin fin.
    pista.style.pointerEvents = 'none'
    pista.style.background = 'rgba(15,23,42,0.94)'
    pista.style.color = '#fff'
    pista.style.padding = '3px 7px'
    pista.style.borderRadius = '6px'

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

    // La pista, por DELEGACIÓN en la fila: cuatro oyentes en total en vez de
    // cuatro por herramienta, y —lo que de verdad importa— siguen valiendo si
    // algún día nace una herramienta más, sin que nadie tenga que acordarse.
    // `mouseover`/`mouseout` y no `mouseenter`/`mouseleave` porque solo los
    // primeros BURBUJEAN, que es lo que hace posible la delegación.
    L.DomEvent.on(fila, 'mouseover', this._alSenalar, this)
    L.DomEvent.on(fila, 'mouseout', this._alDejarDeSenalar, this)
    L.DomEvent.on(fila, 'focusin', this._alEnfocarHerramienta, this)
    L.DomEvent.on(fila, 'focusout', this._alDejarDeSenalar, this)
    this._fila = fila

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
    if (this._fila) {
      L.DomEvent.off(this._fila, 'mouseover', this._alSenalar, this)
      L.DomEvent.off(this._fila, 'mouseout', this._alDejarDeSenalar, this)
      L.DomEvent.off(this._fila, 'focusin', this._alEnfocarHerramienta, this)
      L.DomEvent.off(this._fila, 'focusout', this._alDejarDeSenalar, this)
    }
    if (this._doc) {
      this._doc.removeEventListener('click', this._alClicFuera)
      this._doc.removeEventListener('keydown', this._alEscape)
    }
    // El temporizador de la pista SOBREVIVE al desmontaje si no se cancela, y su
    // callback escribiría en un nodo que ya no está en el documento. Es el mismo
    // fallo que los oyentes sin baja, con la diferencia de que este no se ve.
    this._ocultarPista()
    this._abierto = null
  },

  // ── F12 · «Dibujar recinto» ────────────────────────────────────────────────

  /**
   * Enseña o esconde «Dibujar recinto» **y su separador**.
   *
   * ⚠️ Se ESCONDE, no se apaga, y es la única herramienta de esta barra que lo
   * hace: en la rama PARCELA no hay ninguna «parte» que dibujar, así que un botón
   * gris permanente con un motivo que habla de otra rama diría menos que su
   * ausencia. Las que sí se apagan con motivo —«Deshacer», «Desplazar lindero»—
   * describen algo que *aquí* se puede hacer y ahora mismo no.
   *
   * El separador va con él por la misma razón por la que existe: separa dos grupos
   * de herramientas, y un separador que no separa nada es una raya suelta.
   *
   * @param {boolean} visible
   * @returns {boolean}  Lo que ha quedado.
   */
  dibujoVisible(visible) {
    if (visible === undefined) return this._botonDibujar ? !this._botonDibujar.hidden : false
    if (typeof visible !== 'boolean') {
      throw new TypeError(
        `dibujoVisible: 'visible' debe ser un booleano (o nada, para leer); ` +
          `recibido ${typeof visible}.`,
      )
    }
    if (this._botonDibujar) this._botonDibujar.hidden = !visible
    if (this._separadorDibujar) this._separadorDibujar.hidden = !visible
    return visible
  },

  /**
   * Pone el botón en «dibujando» o lo devuelve a su estado normal.
   *
   * Cambia el NOMBRE, no solo un color: mientras se dibuja, lo que hace el botón
   * es *cancelar*, y un botón que hace una cosa distinta tiene que decirlo con
   * palabras. `aria-pressed` lo dice además en el árbol de accesibilidad.
   *
   * @param {boolean} dibujando
   * @returns {void}
   */
  dibujoEnCurso(dibujando) {
    if (!this._botonDibujar) return
    this._renombrar(this._botonDibujar, dibujando ? PISTA_DIBUJAR.dibujando : PISTA_DIBUJAR.parado)
    this._botonDibujar.setAttribute('aria-pressed', dibujando ? 'true' : 'false')
  },

  /**
   * Pone «Borrar vértices» en armado o lo devuelve a su estado normal.
   *
   * ⚠️ **Esto NO enciende el modo: lo REFLEJA.** Quien manda es
   * `viewer/edicion.js#modoBorrar`, y el cableado empuja hacia aquí lo que aquél
   * diga (ver la sección del modo borrar en la cabecera). Llamar a esto sin haber
   * cambiado el modo deja el botón mintiendo, que es exactamente el estado que la
   * suscripción a `alCambiarModoBorrar` existe para hacer imposible.
   *
   * @param {boolean} activo
   * @returns {void}
   */
  borrarActivo(activo) {
    if (!this._botonBorrar) return
    this._renombrar(this._botonBorrar, activo ? PISTA_BORRAR.encendido : PISTA_BORRAR.apagado)
    this._botonBorrar.setAttribute('aria-pressed', activo ? 'true' : 'false')
    // Si la pista de ESE botón está a la vista, se reescribe en el acto: apagar el
    // modo con el ratón encima dejaba si no el globo diciendo «Salir del modo
    // borrar» sobre un botón que ya no está en ese modo.
    if (this._pista && !this._pista.hidden && this._pistaDe === this._botonBorrar) {
      this._pista.textContent = this._botonBorrar.dataset.pista
    }
  },

  /**
   * Cambia el nombre de una herramienta en LOS DOS SITIOS a la vez: el `<span>`
   * oculto que la nombra y el `data-pista` del globo. Es la mitad de escritura de
   * {@link nombrar}, y existe por lo mismo: que no puedan divergir.
   *
   * @param {HTMLElement} boton
   * @param {string} nombre
   */
  _renombrar(boton, nombre) {
    const rotulo = boton.querySelector(`.${CLASE_BARRA.ROTULO}`)
    if (rotulo) rotulo.textContent = nombre
    boton.dataset.pista = nombre
  },

  // ── Construcción de piezas ─────────────────────────────────────────────────

  /**
   * Un botón del historial: su icono, su nombre y su atajo.
   *
   * El atajo va en TRES sitios y ninguno sobra: en la PISTA (`Deshacer · Ctrl+Z`),
   * que es como lo descubre quien usa el ratón; en `aria-keyshortcuts`, que es
   * donde lo busca un lector de pantalla; y en la tabla del panel de ayuda, que es
   * donde se vuelve cuando ya no se acuerda uno. Lo que ya NO hay es un `<kbd>`
   * visible dentro del botón: con la barra en iconos no cabe, y las otras dos
   * salidas cubren a los dos públicos que aquella tenía.
   */
  _crearBotonHistorial(doc, padre, { accion, icono, nombre, tecla, atajo }) {
    const boton = crearBoton(doc, { padre, icono, nombre, pista: `${nombre} · ${tecla}` })
    boton.dataset.accion = accion
    boton.setAttribute('aria-keyshortcuts', atajo)
    // Nacen apagados: con la pila vacía no hay nada que deshacer ni que rehacer.
    // A partir de aquí manda `app/main.js#refrescar`.
    boton.disabled = true
    return boton
  },

  // ── La pista ───────────────────────────────────────────────────────────────

  /**
   * La herramienta a la que pertenece un evento delegado, o `null`. Sube por los
   * ancestros porque el destino real suele ser el `<svg>` o un `<path>` de dentro,
   * y se para en la fila para no salirse de la barra.
   *
   * Vale también para el `<label>` del ajuste, que no es un `<button>`: lo que
   * define a una «herramienta» aquí es tener `data-pista`, no ser de un elemento
   * concreto.
   */
  _herramientaDe(destino) {
    let nodo = destino
    while (nodo && nodo !== this._fila) {
      if (nodo.dataset && typeof nodo.dataset.pista === 'string') return nodo
      nodo = nodo.parentNode
    }
    return null
  },

  /**
   * Enseña la pista de una herramienta.
   *
   * @param {HTMLElement} boton
   * @param {boolean} [inmediata=false]  Sin retardo. Lo usa el TECLADO: ver
   *   {@link RETARDO_PISTA_MS}.
   */
  _mostrarPista(boton, inmediata = false) {
    if (!this._pista || !boton) return
    // Con un desplegable abierto NO hay pista, y no es un descuido: los tres
    // paneles se abren justo donde la pista se dibuja (encima de la fila), así que
    // el globo caería sobre el panel. Y quien tiene un panel abierto ya no está
    // explorando la barra: está leyendo.
    if (this._abierto !== null) return
    this._cancelarTemporizador()
    const pintar = () => {
      this._temporizadorPista = null
      this._pista.textContent = boton.dataset.pista || ''
      this._pistaDe = boton
      this._pista.hidden = false
      this._colocarPista(boton)
    }
    // Sin espera en dos casos: con el teclado (ver {@link RETARDO_PISTA_MS}) y
    // cuando ya hay una pista a la vista. Lo segundo es la «ventana caliente» de
    // toda barra de herramientas: recorriéndolas con el ratón, el globo SIGUE al
    // cursor en vez de apagarse y volver 120 ms después por cada icono. Y no es
    // solo comodidad: sin ello el globo se quedaría 120 ms enseñando el nombre de
    // la herramienta ANTERIOR, o sea mintiendo sobre la que está debajo del ratón.
    if (inmediata || this._pista.hidden === false) {
      pintar()
      return
    }
    const ventana = this._doc && this._doc.defaultView
    this._temporizadorPista = (ventana || globalThis).setTimeout(pintar, RETARDO_PISTA_MS)
  },

  /**
   * Centra la pista sobre su herramienta, sin dejar que se salga de la fila por
   * ninguno de los dos lados.
   *
   * Todo en coordenadas de OFFSET (relativas a la fila, que es `position:relative`)
   * y no con `getBoundingClientRect`: así no hay que descontar el desplazamiento
   * del mapa ni el de la página, que son justo las dos cosas que se olvidan y
   * hacen que un tooltip aparezca a diez píxeles de donde debía.
   */
  _colocarPista(boton) {
    const anchoFila = this._fila ? this._fila.offsetWidth : 0
    const anchoPista = this._pista.offsetWidth
    const centro = boton.offsetLeft + boton.offsetWidth / 2
    let izquierda = centro - anchoPista / 2
    // El tope por la derecha se aplica ANTES que el de la izquierda: con una pista
    // más ancha que la fila entera —que pasa, «Borrar vértices: enciende el modo y
    // pincha los que sobren» mide más que la barra— el orden inverso la dejaría
    // colgando por la derecha en vez de alineada a la izquierda.
    if (izquierda + anchoPista > anchoFila) izquierda = anchoFila - anchoPista
    if (izquierda < 0) izquierda = 0
    this._pista.style.left = `${Math.round(izquierda)}px`
  },

  _cancelarTemporizador() {
    if (this._temporizadorPista === null) return
    const ventana = this._doc && this._doc.defaultView
    ;(ventana || globalThis).clearTimeout(this._temporizadorPista)
    this._temporizadorPista = null
  },

  /** Esconde la pista y cancela la que estuviera a punto de salir. IDEMPOTENTE. */
  _ocultarPista() {
    this._cancelarTemporizador()
    if (!this._pista) return
    this._pista.hidden = true
    this._pistaDe = null
  },

  _alSenalar(evento) {
    const boton = this._herramientaDe(evento && evento.target)
    if (boton === null) return
    this._mostrarPista(boton)
  },

  _alEnfocarHerramienta(evento) {
    const boton = this._herramientaDe(evento && evento.target)
    if (boton === null) return
    this._mostrarPista(boton, true)
  },

  /**
   * Sale el ratón (o el foco) de una herramienta.
   *
   * ⚠️ Se comprueba a DÓNDE va: `mouseout` salta también al pasar del `<svg>` al
   * `<button>` que lo contiene —son dos nodos distintos— y sin esta guarda la
   * pista parpadearía al mover el ratón un píxel dentro del mismo botón.
   */
  _alDejarDeSenalar(evento) {
    const hacia = evento && (evento.relatedTarget || evento.toElement)
    if (hacia && this._herramientaDe(hacia) !== null) return
    this._ocultarPista()
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
    // El panel se abre justo donde vive la pista, así que la pista se va: ver la
    // guarda de `_mostrarPista`. Se apaga aquí ADEMÁS de allí porque el ratón puede
    // estar quieto sobre el botón que acaba de abrir el panel, y entonces no habrá
    // ningún `mouseout` que lo cuente.
    this._ocultarPista()
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
   * La siguiente herramienta ALCANZABLE en el sentido `paso`, con vuelta al
   * principio. `null` si no hay ninguna: entonces no se mueve el foco, en vez de
   * tirarlo a un botón que no responde.
   *
   * «Alcanzable» son DOS condiciones y las dos se consultan AQUÍ, en el instante
   * de la pulsación, sin cachear nada:
   *   · **no `disabled`** — lo gobierna `app/main.js`, que lo enciende y lo apaga
   *     con la pila del historial y con la selección de lado, sin avisar (ver la
   *     cabecera);
   *   · **no `hidden`** — lo gobierna `dibujoVisible`, y sin esta mitad las
   *     flechas mandarían el foco a «Dibujar recinto» en la rama PARCELA, donde el
   *     botón no se ve. Un foco invisible es peor que una parada que falta: el
   *     usuario pulsa `Enter` y no sabe qué acaba de hacer.
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
      if (!candidata.disabled && !candidata.hidden) return candidata
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
 * Al volver, los OCHO nodos del contrato de `app/main.js#cablearEdicion` ya
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
     * F12. Enseña o esconde «Dibujar recinto». Se delega en el control para que el
     * llamante no tenga que conocer sus interioridades — el mismo trato que ya
     * tienen `activa()` en `viewer/edicion.js` y `comoPantalla()` en el cajón.
     *
     * @param {boolean} [visible]
     * @returns {boolean}
     */
    dibujoVisible: (visible) => control.dibujoVisible(visible),

    /**
     * F12. Pone el botón en «dibujando» (nombre «Cancelar dibujo») o lo devuelve.
     *
     * @param {boolean} dibujando
     * @returns {void}
     */
    dibujoEnCurso: (dibujando) => control.dibujoEnCurso(dibujando),

    /**
     * REFLEJA el modo borrar en su botón (`aria-pressed` + el nombre y la pista).
     * No enciende nada: el dueño del modo es `viewer/edicion.js#modoBorrar` y quien
     * empuja es el cableado, suscrito a `alCambiarModoBorrar`. Ver la sección del
     * modo borrar en la cabecera.
     *
     * @param {boolean} activo
     * @returns {void}
     */
    borrarActivo: (activo) => control.borrarActivo(activo),

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
