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
// ── LAS HERRAMIENTAS CON ESTADO: TRES, Y VAN JUNTAS ─────────────────────────
// ⛔ **AQUÍ PONÍA «EL MODO BORRAR ES LA ÚNICA HERRAMIENTA CON ESTADO» y llevaba
// mintiendo desde el 2026-08-18**, que es cuando entró «Insertar vértices» con su
// propio `aria-pressed`. Hoy son TRES —insertar, borrar y dibujar—, son
// EXCLUYENTES entre sí (lo decide `viewer/edicion.js`) y desde T4 viven dentro de
// un `role="group"` que lo enseña sin una palabra: ver {@link CLASE_BARRA.MANDO}.
// Lo que sigue vale para las tres; se redacta sobre «Borrar» porque fue la primera
// y porque es la que además destruye.
//
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
// capas **y, desde el 2026-08-19, el de opacidad apilado debajo**, `bottomright`
// la atribución, y `bottomleft` el control de escala más los cajones de F07 y
// F08. Cualquier esquina repite el apilamiento en otro sitio.
//
// ⭐ **La mudanza del control de opacidad a `topright` del 2026-08-19 es POR ESTA
// BARRA**, y el porqué medido está en `viewer/capas.js#ControlOpacidad`: con las
// nueve herramientas visibles esta barra pasa de 285 a 326 px + los ~30 de
// «Quitar puntos», y contra los 27,6 px de holgura que había eso era un solape de
// ~8 px que YA existía en la pantalla del levantamiento. Ahora `bottomright` solo
// tiene la atribución, que cruza 196,1 px en horizontal y **0 en vertical**.
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
import { DENSIDAD_BASE_PX, NIVEL, UMBRAL_PUNTERIA_PX, resolverAvisar } from './_comun.js'

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
   * El MANDO de los modos (2026-08-20, tarea T4): el `role="group"` que encierra
   * las tres herramientas que ARMAN un modo —insertar, borrar y dibujar— y las
   * presenta como un solo control segmentado.
   *
   * ⛔ **`role="group"` y NO `radiogroup`**, y la diferencia no es de gusto:
   *   · el estado normal de esta barra es **ningún modo armado**, y un radiogroup
   *     no sabe expresar «ninguno elegido» sin inventarse una opción vacía;
   *   · un `radiogroup` de verdad se recorre con las FLECHAS, y las flechas de
   *     esta barra ya son suyas desde el 2026-08-10: recorren las nueve
   *     herramientas de la fila entera ({@link BarraEdicion#_alTeclaEnBarra}).
   *     Meter aquí un widget que se queda las mismas teclas para otra cosa
   *     rompería la única forma de teclado que la barra anuncia.
   * Lo que sí se conserva es lo que ya decía el DOM: tres `aria-pressed`, uno por
   * segmento, que es exactamente «tres conmutadores excluyentes» y se anuncia así.
   */
  MANDO: 'gml-barra-mando',
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
  /**
   * El RENGLÓN DE SITUACIÓN (2026-08-19, tarea T2). **No confundir con
   * {@link CLASE_BARRA.ESTADO}**, que es el `role="status"`: son dos canales con
   * dos oficios y dos visibilidades, y ésa es toda la razón de que sean dos nodos.
   *
   * | | qué cuenta | ¿se ve? | ¿lo anuncia el lector? |
   * |---|---|---|---|
   * | `ESTADO` (`role="status"`) | el DESENLACE de una acción | no, salvo error | sí |
   * | `SITUACION` (esta) | en qué ESTADO estás | **sí** | no (`aria-hidden`) |
   */
  SITUACION: 'gml-barra-situacion',
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

/**
 * Los dos nombres de «Insertar vértices» (2026-08-18), por el mismo criterio que
 * {@link PISTA_BORRAR} y con la misma trampa que evitar: el icono promete una
 * acción y lo que hace es ARMAR un modo, así que el texto del estado apagado tiene
 * que contar el gesto entero («…y pincha»).
 *
 * ⚠️ El texto encendido nombra `Escape` **y no dice nada del doble clic**, aunque
 * el doble clic siga insertando: la pista de un botón cuenta lo que ese botón hace,
 * y el gesto alternativo vive en la tabla de la ayuda, que es donde se busca.
 */
const PISTA_INSERTAR = Object.freeze({
  apagado: 'Insertar vértices: enciende el modo y pincha en el lindero',
  encendido: 'Salir del modo insertar (Escape)',
})

/** Los dos nombres de «Dibujar recinto», por el mismo criterio (F12). */
const PISTA_DIBUJAR = Object.freeze({
  parado: 'Dibujar el recinto de la parte activa, vértice a vértice',
  dibujando: 'Cancelar el dibujo en curso (Escape)',
})

/**
 * ── EL TEXTO DEL RENGLÓN DE SITUACIÓN (T2, 2026-08-19) ──────────────────────
 *
 * ⛔ **Estas frases NO son las de `app/main.js`, y no se pueden reutilizar.** Allí
 * hay seis constantes —`MENSAJE_CON_LADO`, `MENSAJE_BORRAR_ARMADO`,
 * `MENSAJE_BORRAR_APAGADO`…— que están redactadas como **TRANSICIONES**, porque
 * ése es su oficio: se dicen una vez, al lector de pantalla, en el instante en que
 * algo cambia. «Modo borrar **apagado**: el clic vuelve a seleccionar linderos» es
 * una frase perfecta para oírla al desarmar y **absurda dejada en pantalla**: al
 * cabo de un minuto sigue anunciando algo que pasó hace un minuto.
 *
 * Esto es lo contrario: un renglón que **se queda**, así que sus frases están en
 * PRESENTE y describen el estado, no el cambio. El estado «no hay modo» no tiene
 * frase: se queda vacío, que es lo que dice que no pasa nada.
 *
 * ⚠️ **El orden de los trozos es FIJO —selección primero, modo después— y no es
 * indiferente.** Un renglón que reordena sus partes según lo que haya activo
 * obliga a releerlo entero cada vez; con las posiciones quietas, el ojo va al
 * trozo que le interesa. Es el mismo criterio que ordena la tabla de {@link GESTOS}
 * como la barra.
 */
const SITUACION = Object.freeze({
  LADO: 'Lindero seleccionado',
  INSERTAR: 'Modo insertar: pincha en un lindero',
  BORRAR: 'Modo borrar: pincha los vértices que sobren',
  DIBUJAR: 'Dibujando un recinto: pincha cada esquina',
  /** Lo que une los dos trozos cuando hay selección Y modo a la vez. */
  UNION: ' · ',
})

/**
 * El nombre de «Quitar los puntos», que lleva la CUENTA dentro (2026-08-19).
 *
 * ⭐ **No es un adorno: es la única cifra que el usuario tiene.** Un levantamiento
 * real trae 55, 88 o 178 puntos, y sobre el mapa —a 3 px de radio y superpuestos—
 * no hay forma de contarlos. Si el botón dijera «Quitar los puntos» a secas, lo
 * que se va no tendría tamaño hasta después de pulsarlo.
 *
 * ⚠️ Y dice **«se puede deshacer»** ANTES del clic, no después. Es la única
 * herramienta de esta barra que se lleva por delante algo que vino de un fichero
 * que el usuario puede no tener a mano; la red existe (`Ctrl+Z`, porque la
 * operación pasa por el historial como cualquier otra edición) y una red que no se
 * anuncia no evita la duda, que es lo que frena la mano.
 *
 * Es {@link BarraEdicion#puntosVisible} quien lo escribe, en la misma llamada que
 * decide si el botón se ve: una sola fuente para la cuenta y para la presencia.
 *
 * @param {number} cuantos
 * @returns {string}
 */
function pistaQuitarPuntos(cuantos) {
  // El `0` es el nombre de NACIMIENTO, y no dice «los 0 puntos»: el botón nace
  // escondido y sin cuenta que dar, y un rótulo con un cero es lo que leería el
  // guardián de accesibilidad —que mira el marcado, no lo que se ve— y lo que oiría
  // quien recorra la barra con el lector antes de que llegue ningún fichero.
  const sujeto =
    cuantos === 0 ? 'los puntos sueltos'
    : cuantos === 1 ? 'el punto suelto'
    : `los ${cuantos} puntos sueltos`
  return `Quitar ${sujeto} del levantamiento (se puede deshacer)`
}

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
 * Los CINCO llevan `donde: 'dibujando un recinto'`, que es lo que los distingue
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
 * `viewer/_comun.js#UMBRAL_PUNTERIA_PX` — vivía en `viewer/edicion.js` hasta el
 * 2026-08-19, cuando el cierre por clic de `viewer/dibujo.js` lo estrenó como
 * tercer llamante. Es una CONSTANTE, no una llamada. Copiar el número dejaría que
 * la ayuda mintiera el día que alguien lo ajustara, que es el modo de fallo
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
      'crudo del clic. Es la vía rápida, y sigue funcionando: la herramienta «Insertar vértices» ' +
      'de esta barra hace exactamente lo mismo con un clic, y las dos escriben por el mismo sitio.',
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

  // ── Los tres del modo insertar, que solo valen con la herramienta armada ────
  // Van ANTES de los del modo borrar y en el mismo orden que los botones de la
  // barra: la ayuda se lee mirando la barra, y dos ordenaciones distintas para las
  // mismas seis filas obligan a buscar dos veces.
  Object.freeze({
    gesto: Object.freeze(['Insertar vértices']),
    donde: 'esta barra',
    hace:
      'ARMA el modo insertar y se queda pulsada: no inserta nada por sí misma. Armarla apaga el ' +
      'modo borrar si estaba puesto, porque los dos se llevan el clic y no puede haber dos.',
  }),
  Object.freeze({
    gesto: Object.freeze(['Clic']),
    donde: 'en modo insertar',
    hace:
      `Inserta un vértice en el lindero que esté a ${UMBRAL_PUNTERIA_PX} px o menos del punto ` +
      `pinchado, uno por clic y sin salir del modo. Mientras el modo dura, el clic no selecciona ` +
      `linderos.`,
  }),
  Object.freeze({
    gesto: Object.freeze([{ kbd: 'Escape' }]),
    donde: 'en modo insertar',
    hace:
      'Sale del modo. También se sale al cambiar de pantalla, igual que en el modo borrar: un ' +
      'modo que escribe en la geometría no sobrevive a irse y volver.',
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

  // ── F12 · los CINCO del dibujo, que solo valen con un trazo abierto ───────
  Object.freeze({
    gesto: Object.freeze(['Clic']),
    donde: 'dibujando un recinto',
    hace:
      'Añade una esquina, enganchada al parcelario, a los puntos de tu levantamiento y a las ' +
      'esquinas que ya has puesto. Mientras hay un trazo abierto el clic NO selecciona linderos: ' +
      'dibuja.',
  }),
  // ⭐ (2026-08-19) El quinto. Entra el mismo día que el gesto, y por lo mismo que
  // los otros cuatro: un gesto que la ayuda no cuenta no lo descubre nadie.
  Object.freeze({
    gesto: Object.freeze(['Clic en la PRIMERA esquina']),
    donde: 'dibujando un recinto',
    hace:
      `Cierra el recinto. La primera esquina se agranda en cuanto hay tres puestas, y se rellena ` +
      `al acercarle el puntero: ese clic cierra. Vale con acertarle a ${UMBRAL_PUNTERIA_PX} px.`,
  }),
  Object.freeze({
    gesto: Object.freeze(['Doble clic o ', { kbd: 'Enter' }]),
    donde: 'dibujando un recinto',
    hace:
      'Cierran también, desde donde estés. Con menos de tres esquinas no cierra y lo dice: dos ' +
      'puntos no encierran superficie.',
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
   * El lindero SÓLIDO arriba, su destino DISCONTINUO abajo, y una flecha de UNA
   * punta entre los dos (2026-08-20).
   *
   * ⛔ **ANTES ERAN DOS LÍNEAS SÓLIDAS CON UNA FLECHA DE DOBLE PUNTA EN MEDIO, y
   * ése es exactamente el glifo de ACOTAR de cualquier CAD**: dos líneas de
   * referencia y una cota con puntas a los dos lados. Dice «la distancia ENTRE
   * estas dos», no «mueve ÉSTA». En una aplicación cuyo oficio entero es medir
   * parcelas, tener una herramienta que parece la de acotar es la peor confusión
   * posible — y estaba en el botón que más veces se abre sin usarse.
   *
   * Las tres piezas dicen las tres mitades del contrato, y ninguna sobra:
   *   · **la sólida** es el lindero que hay;
   *   · **la discontinua** es donde va a quedar (la línea de trazos es lo que
   *     todo editor usa para «resultado previsto», y esta herramienta previsualiza);
   *   · **la flecha de una punta** es la DIRECCIÓN. Con dos puntas no habría
   *     dirección, habría distancia, que es de lo que se venía.
   *
   * ⚠️ La discontinua son TRES trazos y no un `stroke-dasharray`: {@link crearIcono}
   * pone los atributos de trazo en el `<svg>`, así que un guion por `path` obligaría
   * a cambiar la fábrica para un solo icono. Tres segmentos cuestan lo mismo y no
   * tocan a nadie más.
   */
  OFFSET: Object.freeze(['M3 6h18', 'M4 18h3', 'M10.5 18h3', 'M17 18h3', 'M12 9v5', 'M10 12 12 14l2-2']),
  /**
   * Un lindero abajo y un signo «+» grande encima: insertar un vértice en un lado
   * que ya existe (2026-08-18).
   *
   * NO un punto suelto, y no es un matiz: la herramienta no crea puntos en el
   * vacío —`insertarEn` proyecta el clic sobre el lado más cercano y rechaza el que
   * cae a más de {@link UMBRAL_PUNTERIA_PX} px—, así que un icono de punto suelto
   * prometería dibujar donde uno quisiera. El lindero dentro del icono es la mitad
   * del mensaje: se añade **a esto**.
   *
   * El «+» va SEPARADO de la línea y no cruzándola: cruzándola se lee como cortar,
   * que es lo contrario de lo que hace, y el vecino de al lado ya es la papelera.
   */
  INSERTAR: Object.freeze(['M3 20h18', 'M12 3v8', 'M8 7h8']),
  /** Papelera: borrar vértices. */
  BORRAR: Object.freeze([
    'M4 7h16',
    'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
    'M10 11v6',
    'M14 11v6',
  ]),
  /**
   * Un recinto de cinco lados **ABIERTO por el último** (2026-08-20): falta el
   * lado que volvería al primer vértice, que es justo el que cierra el usuario.
   *
   * ⛔ **ANTES ESTABA CERRADO, y un polígono cerrado a secas dice «una forma», no
   * «dibuja una».** Y en ESTA aplicación dice algo peor: un polígono **es la
   * parcela** —es lo que pintan `viewer/dibujo.js`, la leyenda y el diagnóstico—,
   * así que el botón podía leerse como «enséñame el recinto» en vez de como la
   * herramienta que lo traza. El hueco es toda la diferencia: un contorno sin
   * cerrar solo puede significar que se está trazando.
   *
   * ⚠️ Y sigue sin ser un LÁPIZ, por el argumento de siempre: un lápiz querría
   * decir «dibujar» y también «editar», que es lo que hacen las otras cinco
   * herramientas de esta barra.
   *
   * ⚠️ El hueco va abajo a la izquierda y no arriba: probado en el navegador a los
   * 18 px reales del botón, con el hueco arriba el pentágono se lee como una forma
   * MORDIDA —un desperfecto— y no como un trazado a medias.
   */
  DIBUJAR: Object.freeze(['M4 9 L12 3 L20 9 L17 19 L7 19']),
  /**
   * Un campo de seis puntos sueltos y una raya que lo tacha: quitar el levantamiento.
   *
   * NO una papelera, y la vecina de dos botones más allá es exactamente por qué:
   * la papelera de esta barra ARMA un modo y borra vértices DE LA GEOMETRIA de uno
   * en uno. Ésta se pulsa una vez y se lleva una nube entera que no es geometría.
   * Dos cosas distintas con el mismo dibujo se confunden justo el día que hay
   * prisa.
   *
   * Los puntos son `h.01` con el remate redondo —el mismo truco que el punto de la
   * interrogación de {@link ICONOS.AYUDA}—, así que miden **2 px de los 24 del
   * `viewBox`**: a los 18 px reales del botón eso es un punto y medio. Por eso son
   * SEIS y no cuatro, medido en el navegador el 2026-08-19: con cuatro el icono se
   * leía como una raya diagonal con dos motas al lado, y la mota es justo lo que
   * tiene que leerse como «los puntos».
   *
   * Tres a cada lado de la diagonal, y **ninguno encima**: la raya mide 2 px de
   * grueso y se traga cualquier punto a menos de ~3 px de ella, así que un punto
   * mal colocado no se ve mal — desaparece, y el icono queda descompensado sin que
   * nadie sepa por qué. Los seis están a 4,9 px o más de la línea `x + y = 24`.
   */
  QUITAR_PUNTOS: Object.freeze([
    'M6 6h.01',
    'M11 6h.01',
    'M6 11h.01',
    'M18 13h.01',
    'M13 18h.01',
    'M18 18h.01',
    'M4 20L20 4',
  ]),
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

    // ── EL MANDO DE LOS MODOS (T4, 2026-08-20) ───────────────────────────────
    // Las tres herramientas que ARMAN un modo —insertar, borrar y dibujar— dejan
    // de ser tres botones sueltos en la fila y pasan a un solo control segmentado.
    //
    // ⭐ **QUÉ ARREGLA, que es lo único que justifica un nodo más.** Las tres son
    // EXCLUYENTES: armar una desarma las otras dos, y eso lo decide
    // `viewer/edicion.js`, no el usuario. Hasta hoy esa exclusión solo existía en
    // el comportamiento —pulsas una y otra se apaga sin que nada lo hubiera
    // anunciado— y en la fila se veían igual que la papelera, que la ayuda o que
    // el desplazamiento, que NO son modos y NO se excluyen con nada. Un marco
    // compartido y un filete entre medias dicen «de estos tres, como mucho uno», y
    // lo dicen antes de pulsar. Es la misma información que el `aria-pressed` ya
    // daba por el canal del lector de pantalla, puesta por fin en el visual.
    //
    // ⚠️ **El redondeo de los extremos NO se hace aquí ni con `overflow:hidden`.**
    // Recortar el contenido recortaría también el anillo de foco global
    // (`.gml-app :focus-visible`, con `outline-offset: 2px`), que es la trampa que
    // `.gml-barra-partido` ya se encontró y dejó escrita en `estilos/app.css`. Los
    // extremos los redondea la hoja, y el extremo DERECHO lo elige con `:has()`
    // porque el último segmento —«Dibujar recinto»— es justo el que se esconde:
    // un `:last-child` a secas le daría el borde final a un botón invisible.
    const mando = crear(doc, 'div', CLASE_BARRA.MANDO, fila)
    mando.setAttribute('role', 'group')
    // El `aria-label` es la ÚNICA forma de nombrar este grupo: no hay texto
    // visible que pudiera hacer de `aria-labelledby`, porque los tres segmentos
    // son iconos y sus nombres están en sus propios `<span>` ocultos. Sin nombre,
    // un lector de pantalla anuncia «grupo» y no dice de qué, que es peor que no
    // agrupar: añade un nivel al recorrido sin añadir información.
    mando.setAttribute('aria-label', 'Modos de edición de la geometría')

    // ── Insertar vértices (2026-08-18) ───────────────────────────────────────
    // La mitad que faltaba. Hasta hoy la barra tenía un modo para BORRAR un vértice
    // y ninguno para AÑADIRLO: el gesto que lo añade —doble clic sobre el lindero—
    // estaba solo en la tabla de {@link GESTOS}, detrás del botón «?», descrito allí
    // como «único gesto del mapa que cambia la geometría». O sea que la capacidad
    // más importante del editor era la única sin representar en una barra donde
    // todo lo demás sí lo está.
    //
    // ⚠️ **ES EL PRIMER SEGMENTO DEL MANDO**, y va antes que la papelera porque el
    // orden —crear antes que destruir— es el de la frase que el usuario ya tiene en
    // la cabeza. Hasta T4 lo que decía que insertar y borrar eran pareja era la
    // AUSENCIA de separador entre las dos; ahora lo dice el marco que las encierra,
    // que además alcanza al dibujo. La razón de fondo no cambia: son el mismo
    // trabajo en sus tres formas, comparten el modo-armado como manera de
    // funcionar y son excluyentes entre sí en `viewer/edicion.js`.
    //
    // ⚠️ NO lleva `HERRAMIENTA_DESTRUCTIVA`: no destruye. Es el único rasgo visual
    // que lo separa de su gemela, y es exactamente el que tiene que separarlos.
    //
    // `aria-pressed` desde el arranque y en `'false'`, por el mismo motivo escrito
    // en la papelera aquí abajo.
    this._botonInsertar = crearBoton(doc, {
      padre: mando,
      icono: ICONOS.INSERTAR,
      nombre: PISTA_INSERTAR.apagado,
    })
    this._botonInsertar.dataset.accion = 'insertar-vertice'
    this._botonInsertar.setAttribute('aria-pressed', 'false')

    // ── Borrar vértices (2026-08-10) ─────────────────────────────────────────
    // El modo destructivo, y el segmento CENTRAL del mando.
    //
    // ⛔ **CONSERVA `HERRAMIENTA_DESTRUCTIVA` dentro del mando** (decisión de T4).
    // La tentación era quitárselo: si el relleno macizo es lo que dice qué segmento
    // está armado, dos rellenos distintos podrían leerse como dos estados distintos.
    // Pero es al revés — armar «Borrar» y armar «Insertar» NO son el mismo suceso:
    // uno añade geometría al primer clic y el otro la destruye. El color es lo
    // único que se lee sin mirar qué icono es, y dentro de un mando donde los tres
    // se parecen más que nunca hace MÁS falta, no menos.
    //
    // ⚠️ `aria-pressed` desde el arranque, y en `'false'`, no ausente: un
    // conmutador que solo estrena el atributo al pulsarse por primera vez se
    // anuncia como un botón normal hasta entonces, y quien va por lector de
    // pantalla no puede saber que va a ARMAR algo en vez de ejecutarlo.
    this._botonBorrar = crearBoton(doc, {
      padre: mando,
      icono: ICONOS.BORRAR,
      nombre: PISTA_BORRAR.apagado,
      clase: `${CLASE_BARRA.HERRAMIENTA} ${CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA}`,
    })
    this._botonBorrar.dataset.accion = 'borrar'
    this._botonBorrar.setAttribute('aria-pressed', 'false')

    // ── Dibujar recinto (F12; también en PARCELA desde F18) ──────────────────
    // La herramienta con la que se declara un porche o una piscina que no estaban
    // en ningún fichero —el caso COMÚN de la rama EDIFICIO— y, desde F18, con la
    // que se traza el contorno de una parcela sobre los puntos de un levantamiento
    // importado.
    //
    // ⚠️ **Nace OCULTO**, no apagado, y sigue siendo la única herramienta de esta
    // barra que se esconde: hay pantallas y ramas donde no hay nada que dibujar
    // —la rama EDIFICIO sin parte elegida, cualquier paso que no sea Edición— y un
    // botón permanentemente gris con un motivo que habla de otro sitio sería peor
    // que su ausencia. Lo enseña `dibujoVisible(true)`.
    //
    // ⛔ **Y desde F18 lo llaman DOS cableados, uno por rama** —`cablearEdificio`
    // y `cablearEdicion`—, así que este módulo no puede suponer de quién es la
    // orden: pinta lo que le digan y no sabe qué rama manda. Quién decide, y en qué
    // orden se le pregunta a cada uno, está escrito en `app/main.js#aplicarEdicion`,
    // que es el único sitio que conoce a la vez el paso y la rama.
    this._botonDibujar = crearBoton(doc, {
      padre: mando,
      icono: ICONOS.DIBUJAR,
      nombre: PISTA_DIBUJAR.parado,
    })
    this._botonDibujar.dataset.accion = 'dibujar-recinto'
    this._botonDibujar.hidden = true
    // ⛔ **ESTE `aria-pressed` FALTABA DESDE F12, y lo ha destapado T4.** Sus dos
    // hermanos de mando lo estrenan en el montaje y con el motivo escrito —«un
    // conmutador que solo estrena el atributo al pulsarse por primera vez se
    // anuncia como un botón normal hasta entonces»—, y éste solo lo recibía dentro
    // de {@link BarraEdicion#dibujoEnCurso}, o sea la primera vez que alguien
    // dibujaba. Hasta hoy era una incoherencia que no se veía porque los tres
    // botones estaban sueltos en la fila; desde que son los tres segmentos de un
    // control cuyo significado entero es «esto conmuta», uno de ellos anunciándose
    // como botón corriente es el grupo diciendo una cosa y su contenido otra.
    this._botonDibujar.setAttribute('aria-pressed', 'false')

    // ⬆️ Aquí se cierra el mando. El separador que hasta T4 iba entre «Borrar» y
    // «Dibujar» no se ha borrado: se ha MUDADO aquí abajo. Separaba dos grupos de
    // herramientas y sigue haciéndolo; lo que ha cambiado es cuáles son los grupos,
    // porque el dibujo se ha pasado al de los modos.
    crearSeparador(doc, fila)

    // ── Quitar los puntos del levantamiento (F24, 2026-08-19) ───────────────
    // Un DXF de levantamiento entra con 55, 88 o 178 puntos sueltos, y en cuanto
    // el contorno está dibujado encima **dejan de servir para nada y no se van
    // solos**: viven en el modelo, así que se guardan con el expediente, viajan en
    // el fichero de proyecto y vuelven a pintarse cada vez que se recupera. Hasta
    // hoy la única forma de perderlos era no importarlos.
    //
    // ⛔ **HASTA T4 IBA PEGADO A «Dibujar recinto», SIN SEPARADOR ENTRE MEDIAS.**
    // Esa adyacencia era de F24 y decía algo cierto —se dibuja SOBRE los puntos y
    // se quitan CUANDO ya se ha dibujado, o sea el mismo trabajo en sus dos
    // tiempos—, pero se ha perdido a propósito, y conviene saber qué se cambió por
    // qué: el dibujo se ha ido al MANDO, y este botón **no puede entrar ahí**. El
    // mando significa exactamente una cosa —«de estos tres, como mucho uno está
    // armado»— y quitar los puntos NO ARMA NADA: se pulsa y sucede. Un cuarto
    // segmento que se ejecuta al primer clic dentro de un control cuyo mensaje
    // entero es «esto conmuta» sería la peor mentira que esta barra podría contar,
    // y además la que más caro se paga: es la única herramienta que borra de golpe
    // algo que vino de fuera.
    //
    // Así que queda FUERA, al otro lado del filete, que es lo que era antes de
    // llegar el dibujo: una acción suelta entre las herramientas y la ayuda.
    //
    // ⚠️ **Nace OCULTO**: sin puntos no hay nada que quitar, y un botón gris
    // permanente con un motivo que habla de un fichero que nadie ha soltado sería
    // peor que su ausencia. Lo enseña {@link BarraEdicion#puntosVisible}, y desde
    // T4 el separador de después es SUYO y de nadie más
    // ({@link BarraEdicion#_refrescarSeparadorPuntos}).
    //
    // ⚠️ Lleva `HERRAMIENTA_DESTRUCTIVA` —el rojo de la papelera— y lo lleva con
    // razón: es la única herramienta de esta barra que borra de una vez algo que
    // vino de fuera. Que se pueda deshacer no lo hace inocuo; lo hace reversible,
    // y eso se dice en el nombre (ver {@link pistaQuitarPuntos}).
    this._botonQuitarPuntos = crearBoton(doc, {
      padre: fila,
      icono: ICONOS.QUITAR_PUNTOS,
      nombre: pistaQuitarPuntos(0),
      clase: `${CLASE_BARRA.HERRAMIENTA} ${CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA}`,
    })
    this._botonQuitarPuntos.dataset.accion = 'quitar-puntos'
    this._botonQuitarPuntos.hidden = true

    // La bandera del escondite. Nace en `false` porque el botón nace oculto: un
    // `undefined` aquí dejaría el separador visible en la primera pasada, que es
    // un filete suelto entre la papelera y la ayuda.
    //
    // ⛔ **ERAN DOS HASTA T4** —`_verDibujo` y ésta—, porque el dibujo y los puntos
    // compartían este filete y había que mirar a los dos lados. Desde que el dibujo
    // se ha ido al mando, el único vecino escondible que le queda a este separador
    // es «Quitar puntos», así que la condición vuelve a ser de uno. `_verDibujo`
    // se ha BORRADO en vez de dejarse puesto: un estado que ya no decide nada es
    // un estado que el día de mañana alguien consulta creyendo que sí.
    this._verQuitarPuntos = false

    this._separadorPuntos = crearSeparador(doc, fila)
    this._separadorPuntos.hidden = true

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
      this._botonInsertar,
      this._botonBorrar,
      this._botonDibujar,
      this._botonQuitarPuntos,
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

    // ── El renglón de SITUACIÓN (T2, 2026-08-19) ─────────────────────────────
    //
    // ⭐ **POR QUÉ ES UN NODO NUEVO Y NO EL `role="status"` QUE YA HABÍA.** El
    // renglón de estado de esta barra **no se ve**: `app/main.js` le aplica
    // `RENGLON_OCULTO` —`position:absolute; width:1px; clipPath:inset(50%)`, el
    // patrón *visually-hidden* de manual— a todo lo que no sea un error, por
    // decisión del autor del 2026-08-18. Su motivo sigue siendo bueno: por allí
    // pasan quince DESENLACES de acciones que el usuario acaba de hacer con las
    // manos sobre el mapa, y contarlos otra vez a 400 px de donde está mirando es
    // decir dos veces lo mismo.
    //
    // Pero la SITUACIÓN no es un desenlace. «Estás en modo borrar» no se ve en
    // ninguna otra parte, no lo acabas de hacer, y sigue siendo verdad dentro de un
    // minuto. Meterla en aquel nodo obligaba a inventar reglas de quién pisa a
    // quién y cuándo vuelve el otro — y había un caso sin salida: `Ctrl+Z` deja un
    // desenlace, el usuario no vuelve a tocar el mapa, y la situación no reaparece
    // nunca. **Dos nodos hacen que esa clase entera de fallo no exista**, y dejan
    // los dieciséis mensajes y sus pruebas intactos.
    //
    // ⚠️ **`aria-hidden="true"`, y es obligatorio.** Los mismos hechos ya se
    // anuncian por el `role="status"` (`MENSAJE_CON_LADO`, `MENSAJE_BORRAR_ARMADO`
    // y compañía, desde `app/main.js`). Sin esta línea, quien va por lector de
    // pantalla oiría la selección DOS VECES por cada clic. Esto es un espejo para
    // los ojos, no un segundo canal.
    //
    // ⚠️ **COMPARTE SLOT CON LA PISTA, Y POR ESO SON EXCLUYENTES.** Las dos se
    // dibujan en `bottom: calc(100% + 6px)`. Podría haber ido debajo de la fila o
    // dentro de ella, y las dos opciones eran peores: la barra está anclada por su
    // borde inferior, así que **cualquier cosa que ocupe alto EMPUJA LA FILA hacia
    // arriba** — o sea que los botones se moverían bajo el cursor cada vez que
    // eliges un lindero. Es el mismo motivo por el que la pista es `absolute` y no
    // un renglón más, escrito veinte líneas más arriba. Con el slot compartido la
    // fila **no se mueve nunca**, y no se pierde nada: mientras señalas una
    // herramienta te interesa qué hace ESA, no dónde estabas.
    const situacion = crear(doc, 'p', CLASE_BARRA.SITUACION, fila)
    situacion.setAttribute('aria-hidden', 'true')
    situacion.hidden = true
    this._situacion = situacion
    // Vacío = no hay nada que contar. Nace así y vuelve aquí en cuanto se desarma
    // todo: es lo que protege el invariante de que **el arranque no planta un
    // cartel sobre el mapa** (`test/app/main-edicion.dom.test.js`, «el arranque no
    // planta un cartel»), que sigue valiendo palabra por palabra para este nodo.
    this._sitLado = false
    // En línea por lo mismo que la pista y que el fondo del contenedor: esto tiene
    // que ser legible sobre una ortofoto aunque `estilos/app.css` no llegue. Lo que
    // NO va aquí es refinamiento tipográfico: eso sería de la hoja, y la hoja está
    // clavada en su techo de presupuesto.
    situacion.style.position = 'absolute'
    situacion.style.zIndex = '1'
    situacion.style.bottom = 'calc(100% + 6px)'
    situacion.style.left = '0'
    situacion.style.margin = '0'
    situacion.style.maxWidth = '100%'
    situacion.style.whiteSpace = 'nowrap'
    situacion.style.overflow = 'hidden'
    situacion.style.textOverflow = 'ellipsis'
    situacion.style.pointerEvents = 'none'
    // Claro y no oscuro como la pista, a propósito: la pista es un globo que
    // interrumpe, esto es un rótulo que acompaña. Mismo fondo que el contenedor de
    // la barra para que se lea como parte de ella.
    situacion.style.background = 'rgba(255,255,255,0.94)'
    situacion.style.color = '#0f172a'
    situacion.style.padding = '3px 7px'
    situacion.style.borderRadius = '6px'

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
   * hace: hay sitios donde no hay NADA que dibujar —la rama EDIFICIO sin parte
   * elegida, cualquier paso que no sea Edición—, y ahí un botón gris permanente
   * con un motivo que habla de otro sitio diría menos que su ausencia. Las que sí
   * se apagan con motivo —«Deshacer», «Desplazar lindero»— describen algo que
   * *aquí* se puede hacer y ahora mismo no.
   *
   * ── ⭐ LO QUE ESTE MÉTODO CUESTA EN PÍXELES (F18 · paso 12) ────────────────
   * **Medido en Chromium el 2026-08-19**, no calculado: la barra flota SOBRE el
   * mapa, así que lo que ocupa se lo quita a la ortofoto que el usuario está
   * calcando, y hasta F18 estos píxeles solo se pagaban en la rama EDIFICIO.
   * Ahora se pagan también en la de PARCELA, que es la pantalla donde más se
   * trabaja — por eso se remide en vez de suponer que «un botón más da igual».
   *
   *   · **La fila pasa de 275 a 316 px, y la barra de 285 a 326.** El delta son
   *     **41 px** exactos, en TODOS los viewports probados (1440×900, 1366×768,
   *     1280×800, 1152×864 y 1024×768): 28 del botón, 2 del `gap` que lo precede,
   *     1 del filete, 8 de sus dos márgenes (`--space-1`) y 2 más de `gap`. La
   *     cuenta del CSS y la medida coinciden al píxel porque la barra es de
   *     ICONOS: ningún ancho depende de la fuente ni del texto.
   *   · **La barra NO se estrecha con la ventana** —es contenido, no rejilla—, así
   *     que lo que cambia con el viewport es cuánto mapa tapa: **31,1 % del ancho
   *     del mapa a 1440×900** (722 px libres) y **51,6 % a 1024×768** (306 px).
   *   · **El punto en que dejaría de caber son ~718 px de ventana**, con el panel
   *     lateral llevándose sus ~392: por debajo, el mapa mide menos que la barra.
   *     Queda muy lejos del objetivo de este producto —un perito con un plano—,
   *     así que no se estrecha nada por ahora; queda escrito para que quien mueva
   *     el panel sepa cuánto margen está gastando.
   *
   * ⚠️ La medida de layout REAL —no esta nota— la vuelve a tomar y a VIGILAR
   * `scripts/smoke-navegador/08-edicion.js` §10, porque jsdom no hace layout y
   * ningún test de la suite puede ver un píxel.
   *
   * ⚠️ **ESTE MÉTODO YA NO GOBIERNA NINGÚN SEPARADOR** (T4, 2026-08-20). Desde que
   * el dibujo es el tercer segmento del mando, esconderlo no deja ningún filete
   * suelto: el mando nunca se queda vacío —insertar y borrar no se esconden jamás—
   * y el separador que va después sigue separando lo mismo. Lo único que hace
   * ahora este método es enseñar y esconder el botón. El filete que hay más allá
   * es de «Quitar puntos» y lo decide {@link BarraEdicion#_refrescarSeparadorPuntos}.
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
    // ⛔ **ESCONDERLO LO DESARMA, Y ES UN ARREGLO DE T10 (2026-08-20).**
    //
    // Sin esta línea la barra se quedaba afirmando un modo que el usuario **no
    // puede abandonar**: el botón es el único sitio donde se cancela un dibujo con
    // el ratón, así que un `aria-pressed="true"` sobre un botón invisible no es un
    // estado, es una trampa. Y salía a la luz al VOLVER: `dibujoVisible(true)`
    // devolvía el botón **relleno de azul** y el renglón de situación diciendo
    // «Dibujando un recinto: pincha cada esquina» sin que nadie estuviera dibujando.
    //
    // El camino es real y está en el repositorio: `app/cableado-edificio.js:2529`
    // esconde el botón al desmontar la parte activa **sin pasar por
    // `dibujoEnCurso(false)`** —y hace bien, porque a esas alturas ya ha destruido
    // el motor del dibujo—. Hasta hoy lo que salvaba a la barra era que sus DOS
    // cableados llaman siempre a los dos métodos seguidos y en ese orden. O sea que
    // la coherencia de este módulo dependía de la disciplina de quien lo llama, que
    // es exactamente la clase de acuerdo que se rompe en la tercera llamada.
    //
    // Se delega en {@link BarraEdicion#dibujoEnCurso} en vez de escribir el atributo
    // aquí: desarmar es también devolverle el NOMBRE al botón, y ese texto tiene un
    // solo dueño.
    if (!visible) this.dibujoEnCurso(false)
    return visible
  },

  /**
   * Enseña «Quitar los puntos» con su CUENTA, o lo esconde (F24, 2026-08-19).
   *
   * ⭐ **Un solo argumento para las dos cosas**, y es la decisión de este método:
   * `0` esconde, `n > 0` enseña Y renombra. Una API con `visible` y `cuantos` por
   * separado tendría un estado imposible —visible con cero— y ese estado es
   * exactamente el defecto que se quiere evitar: un botón ofreciendo quitar una
   * nube que ya no está.
   *
   * ⚠️ **No pregunta nada al modelo.** Quién cuenta los puntos es
   * `app/main.js#repintarPuntosLevantamiento`, que es el ÚNICO suscriptor del store
   * que sabe de ellos y el que ya empuja las otras dos salidas (la capa que los
   * pinta y las dianas que los enganchan). Tres salidas, un solo sitio que las
   * escribe: separarlas es la forma de que un día haya un botón para quitar unos
   * puntos que ya nadie ve.
   *
   * ⚠️ Y refresca la PISTA si el globo está abierto justo sobre este botón, igual
   * que {@link borrarMotivo}: sin esto, quitar puntos con el ratón encima dejaría
   * el globo diciendo una cuenta vieja.
   *
   * @param {number} [cuantos]  Sin argumento, LEE si está visible.
   * @returns {boolean}  Si ha quedado visible.
   */
  puntosVisible(cuantos) {
    if (cuantos === undefined) {
      return this._botonQuitarPuntos ? !this._botonQuitarPuntos.hidden : false
    }
    if (typeof cuantos !== 'number' || !Number.isInteger(cuantos) || cuantos < 0) {
      throw new TypeError(
        `puntosVisible: 'cuantos' debe ser un entero >= 0 (o nada, para leer); ` +
          `recibido ${JSON.stringify(cuantos)}.`,
      )
    }
    const visible = cuantos > 0
    if (this._botonQuitarPuntos) {
      this._botonQuitarPuntos.hidden = !visible
      if (visible) this._renombrar(this._botonQuitarPuntos, pistaQuitarPuntos(cuantos))
      if (this._pista && !this._pista.hidden && this._pistaDe === this._botonQuitarPuntos) {
        this._pista.textContent = this._botonQuitarPuntos.dataset.pista
      }
    }
    this._verQuitarPuntos = visible
    this._refrescarSeparadorPuntos()
    return visible
  },

  /**
   * El filete que hay entre «Quitar puntos» y la ayuda se va con él.
   *
   * ⛔ **ESTE SEPARADOR HA CAMBIADO DE DUEÑO DOS VECES, y las dos por el mismo
   * motivo: un filete que no separa nada es una raya suelta.**
   *   · Hasta F24 era propiedad de {@link BarraEdicion#dibujoVisible} y se escondía
   *     con el dibujo. Al llegar un segundo vecino escondible eso dejó de valer: en
   *     la rama EDIFICIO sin parte elegida el dibujo se esconde, y si la parcela
   *     traía puntos el botón de quitarlos se quedaba solo detrás de un filete
   *     invisible, pegado a la ayuda.
   *   · Desde T4 (2026-08-20) el dibujo se ha ido al MANDO, que está al otro lado y
   *     no se esconde nunca. O sea que a este filete le queda **un solo vecino
   *     escondible**, y la condición vuelve a tener un término.
   *
   * ⚠️ Sigue siendo una función y no un `hidden` suelto dentro de
   * {@link BarraEdicion#puntosVisible} justamente por esa historia: es el sitio
   * donde está escrito a qué mira, y la próxima herramienta escondible que aparezca
   * por aquí tiene que pasar por él.
   *
   * @returns {void}
   */
  _refrescarSeparadorPuntos() {
    if (!this._separadorPuntos) return
    this._separadorPuntos.hidden = !this._verQuitarPuntos
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
    this._pintarSituacion()
  },

  /**
   * Pone «Insertar vértices» en armado o lo devuelve a su estado normal
   * (2026-08-18).
   *
   * ⚠️ **Esto NO enciende el modo: lo REFLEJA**, igual que {@link borrarActivo}.
   * Quien manda es `viewer/edicion.js#modoInsertar` y quien empuja es el cableado,
   * suscrito a `alCambiarModoInsertar`.
   *
   * ⭐ Y aquí la suscripción hace un trabajo que en la papelera no hacía: los dos
   * modos son EXCLUYENTES, así que armar el de borrar apaga éste **sin que este
   * botón haya recibido ningún clic**. Un botón que sondeara el booleano al pulsarse
   * se quedaría pulsado y mintiendo; empujado por la suscripción, se apaga solo.
   *
   * @param {boolean} activo
   * @returns {void}
   */
  insertarActivo(activo) {
    if (!this._botonInsertar) return
    this._renombrar(this._botonInsertar, activo ? PISTA_INSERTAR.encendido : PISTA_INSERTAR.apagado)
    this._botonInsertar.setAttribute('aria-pressed', activo ? 'true' : 'false')
    if (this._pista && !this._pista.hidden && this._pistaDe === this._botonInsertar) {
      this._pista.textContent = this._botonInsertar.dataset.pista
    }
    this._pintarSituacion()
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
    this._pintarSituacion()
  },

  /**
   * ⭐ **Refleja si hay un lindero elegido en el mapa (T2, 2026-08-19).**
   *
   * Mismo contrato que {@link borrarActivo} y {@link insertarActivo}, y por el
   * mismo motivo: **esto NO selecciona nada, lo REFLEJA**. Quien manda es
   * `viewer/edicion.js`, y quien empuja es `app/main.js#cablearEdicion`, suscrito a
   * `alCambiarSeleccion`. Llamar a esto sin que la selección haya cambiado deja el
   * renglón mintiendo.
   *
   * ⚠️ **Es el ÚNICO empujón que T2 necesitó**, y merece decirse por qué: los otros
   * tres trozos de la situación —insertar, borrar y dibujar— **la barra ya los
   * sabía**, porque el cableado se los venía reflejando desde F12 y desde el
   * 2026-08-10 para pintar los botones. La selección era el único hecho del que
   * esta vista no tenía copia. De ahí que «Dibujar recinto» entre en el renglón sin
   * cableado nuevo: `dibujoEnCurso` ya lo llaman **las dos ramas**
   * (`app/main.js` y `app/cableado-edificio.js`), cada una con su dueño.
   *
   * @param {boolean} hay  `true` si hay un lindero seleccionado.
   * @returns {void}
   */
  ladoSeleccionado(hay) {
    this._sitLado = hay === true
    this._pintarSituacion()
  },

  /**
   * Recompone el renglón de situación con lo que la barra sabe AHORA, y lo esconde
   * si no hay nada que contar.
   *
   * ── De dónde sale cada trozo, y por qué de ahí ──────────────────────────────
   * El modo NO se guarda en un campo propio: se lee del `aria-pressed` de los tres
   * botones, que es donde ya vive. Guardarlo aparte sería **dos verdades del mismo
   * booleano**, que es exactamente lo que el JSDoc de {@link borrarActivo} prohíbe
   * unas líneas más arriba — y la que se quedaría vieja sería siempre ésta, porque
   * los modos se apagan por caminos que esta vista no ve (`Escape`, salir de
   * Edición, armar el otro modo). Leyendo del DOM no puede divergir: el mismo
   * `setAttribute` que pinta el botón alimenta el renglón.
   *
   * ⚠️ **Se esconde con un desplegable abierto**, por lo mismo que la pista: los
   * tres paneles se abren justo donde esto se dibuja, y quien tiene un panel
   * abierto está leyendo, no explorando.
   */
  _pintarSituacion() {
    if (!this._situacion) return
    // La pista manda mientras está a la vista: comparten slot y es transitoria.
    const pistaALaVista = this._pista !== null && this._pista !== undefined && !this._pista.hidden
    if (pistaALaVista || this._abierto !== null) {
      this._situacion.hidden = true
      return
    }
    const armado = (boton) => boton && !boton.hidden && boton.getAttribute('aria-pressed') === 'true'
    const trozos = []
    if (this._sitLado) trozos.push(SITUACION.LADO)
    // Excluyentes entre sí en `viewer/edicion.js`, así que como mucho entra uno —
    // pero se comprueban los tres por orden en vez de suponerlo: si algún día
    // dejaran de serlo, esto diría la verdad en vez de esconder la mitad.
    if (armado(this._botonInsertar)) trozos.push(SITUACION.INSERTAR)
    else if (armado(this._botonBorrar)) trozos.push(SITUACION.BORRAR)
    else if (armado(this._botonDibujar)) trozos.push(SITUACION.DIBUJAR)

    this._situacion.textContent = trozos.join(SITUACION.UNION)
    this._situacion.hidden = trozos.length === 0
  },

  /**
   * Cambia el nombre de una herramienta en LOS DOS SITIOS a la vez: el `<span>`
   * oculto que la nombra y el `data-pista` del globo. Es la mitad de escritura de
   * {@link nombrar}, y existe por lo mismo: que no puedan divergir.
   *
   * @param {HTMLElement} boton
   * @param {string} nombre
   */
  /**
   * ⛔ **Apaga «Borrar vértices» CON SU MOTIVO, o lo devuelve a la vida
   * (2026-08-19).**
   *
   * Nace de un defecto reportado con captura: un recinto de tres vértices, la
   * papelera armada y «no me deja borrar por más que pincho». La aplicación tenía
   * razón —quitar un vértice de tres deja un segmento, y `edit/vertices.js` lo
   * rechaza siempre— y lo estaba diciendo, pero **después del gesto** y en una
   * tarjeta del panel plegado, agrupada como «×6». O sea: el mando prometía algo
   * que no podía cumplir NI UNA VEZ, y solo lo confesaba a quien insistiera.
   *
   * Es la regla de oro 1 aplicada tal cual: un botón apagado lleva su motivo al
   * lado. Aquí «al lado» es **la pista propia de la barra** —el globo que ya
   * sustituyó al `title` nativo el 2026-08-10—, que es donde el usuario mira
   * cuando un icono no responde. No hay renglón que gastar ni desplegable que
   * abrir, y el motivo viaja además al nombre accesible: quien va por lector de
   * pantalla oye «Borrar vértices · No hay ningún vértice que se pueda borrar…»
   * en vez de un botón deshabilitado y mudo.
   *
   * ⚠️ **No toca `aria-pressed`, ni el modo, ni `disabled`.** Escribe TEXTO y
   * nada más, y eso es una decisión que costó una mutación superviviente: el
   * apagado lo escribía a la vez el cableado, así que quitarle allí la línea
   * dejaba la suite verde —la otra escritura tapaba el agujero—. Dos dueños del
   * mismo booleano es justo lo que el JSDoc de {@link borrarActivo} prohíbe unas
   * líneas más arriba. Manda `app/main.js#cablearEdicion`, que es quien conoce la
   * geometría; esto pone las palabras.
   *
   * @param {string} motivo  Vacío = se puede borrar, el botón vuelve a su nombre.
   * @returns {void}
   */
  borrarMotivo(motivo) {
    if (!this._botonBorrar) return
    const apagado = typeof motivo === 'string' && motivo !== ''
    this._renombrar(
      this._botonBorrar,
      apagado ? `${PISTA_BORRAR.apagado} · ${motivo}` : PISTA_BORRAR.apagado,
    )
    if (this._pista && !this._pista.hidden && this._pistaDe === this._botonBorrar) {
      this._pista.textContent = this._botonBorrar.dataset.pista
    }
  },

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
      // Comparten slot: mientras el globo está a la vista, la situación se aparta.
      this._pintarSituacion()
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
    // El slot queda libre: si hay algo que contar, la situación vuelve.
    this._pintarSituacion()
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
    // El panel deja libre el slot: la situación puede volver. VA DESPUÉS de poner
    // `_abierto` a null, porque {@link _pintarSituacion} lo consulta.
    this._pintarSituacion()
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
    // ⚠️ AQUÍ Y NO ANTES. `_ocultarPista()` de arriba ya repinta la situación, pero
    // lo hace con `_abierto` todavía en `null` —se pone tres líneas más abajo—, así
    // que la dejaría VISIBLE justo debajo del panel que se acaba de abrir. Este
    // segundo repintado es el que la aparta.
    this._pintarSituacion()
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
     * F24. Enseña «Quitar los puntos» CON SU CUENTA, o lo esconde con un `0`.
     *
     * Un solo argumento para las dos cosas, a propósito: ver
     * {@link BarraEdicion#puntosVisible} para el porqué.
     *
     * @param {number} [cuantos]
     * @returns {boolean}
     */
    puntosVisible: (cuantos) => control.puntosVisible(cuantos),

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
     * Apaga «Borrar vértices» con el motivo escrito, o lo devuelve a la vida con
     * la cadena vacía. Ver {@link ControlBarraEdicion.borrarMotivo}.
     */
    borrarMotivo: (motivo) => control.borrarMotivo(motivo),

    /**
     * REFLEJA el modo insertar en su botón (2026-08-18). Gemela de
     * {@link borrarActivo} y con el mismo contrato: no enciende nada, el dueño del
     * modo es `viewer/edicion.js#modoInsertar` y quien empuja es el cableado.
     *
     * @param {boolean} activo
     * @returns {void}
     */
    insertarActivo: (activo) => control.insertarActivo(activo),

    /**
     * ⭐ **Refleja si hay un lindero elegido (T2, 2026-08-19).** Alimenta el
     * renglón de SITUACIÓN —el visible—, no el `role="status"`, que sigue siendo
     * de los desenlaces y sigue oculto salvo error. Mismo contrato que
     * {@link borrarActivo}: no selecciona, refleja.
     *
     * Es el único empujón nuevo de T2: los otros tres trozos del renglón
     * —insertar, borrar y dibujar— la barra ya los recibía por
     * {@link insertarActivo}, {@link borrarActivo} y {@link dibujoEnCurso}.
     *
     * @param {boolean} hay
     * @returns {void}
     */
    ladoSeleccionado: (hay) => control.ladoSeleccionado(hay),

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
