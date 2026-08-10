// viewer/cajon-diagnostico.js — F07 · El diagnóstico: sobre el mapa o EN EL PANEL.
//
// ── ⛔ DÓNDE VIVE ESTO, Y POR QUÉ HA CAMBIADO (2026-08-05) ──────────────────
// Este fichero se llama «cajón» porque durante F07–F11 lo fue: una ventanita
// flotante en la esquina inferior izquierda del mapa. **Desde el 2026-08-05 ya no
// lo es en la aplicación**: en la pantalla de Diagnóstico el mismo contenedor se
// cuelga de la COLUMNA IZQUIERDA, donde sustituye a la tabla de vértices. Quien lo
// muda de sitio es {@link anfitrion}, y ahí está el porqué largo. Sigue siendo un
// cajón para quien monte el visor a pelo, que es el defecto.
//
// ── LO QUE DECÍA AQUÍ, Y QUÉ PARTE SIGUE SIENDO VERDAD ──────────────────────
// Decía: «la spec de F07 insinuaba un bloque más en el panel lateral; no cabe, y
// está MEDIDO — el panel reparte una altura FIJA entre bloques fijos, y el bloque
// «Edición» de F06 (270 px) dejó la caja de vértices en 64 px a 1440×900». Era
// cierto y ya no aplica: **el rework de UI (T6) partió el panel por pasos**, así
// que en Diagnóstico no hay ni tabla de vértices ni bloque de Entrada con los que
// competir. La altura ya no se reparte entre bloques fijos: la absorbe el único
// bloque de esa pantalla.
//
// Lo que sí sobrevive de aquel razonamiento —y hay que conservarlo— es la otra
// mitad: **un diagnóstico se lee MIRANDO EL MAPA**. Las manchas del solape, la cota
// de la desviación máxima y el lindero invadido los pinta `viewer/contraste.js`
// sobre el dibujo. Por eso el cambio de sitio no es cosmético: flotando, este
// contenedor TAPABA justo lo que sus cifras señalan.
//
// Lo que se pierde es la **anchura** que el mapa le daba. La tabla a tres bandas
// (§10.2) son cinco columnas, y en los ~344 px útiles del panel van más justas que
// en los 420 del cajón. Se acepta a cambio de ver el mapa entero, y por eso las
// cifras siguen en `tabular-nums` (`estilos/app.css`): sin alineación de comas esa
// tabla no se compararía de un vistazo en ningún ancho.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. **No conoce el modelo, ni el
// store, ni la red, ni `diagnostico/parcela.js`.** Recibe el POJO del diagnóstico y
// lo pinta; quien lo calcula y quien lo cablea es `app/cableado-diagnostico.js`. Por
// eso aquí no se importa nada de `diagnostico/` salvo **una constante** —la etiqueta
// del margen— y ni una línea de `model/` o `edit/`. Es la misma doctrina, y por las
// mismas razones, que `viewer/barra-edicion.js`.
//
// ── F08 · POR QUÉ «DESCARGAR INFORME DE CONTRASTE» VIVE AQUÍ Y NO EN EL PIE ──
// El pie de `index.html` ya tiene dos CTA —«Generar GML» (F04) y «Diagnosticar
// encaje» (F07)— y el sitio natural de un tercero parecería ser ese. No lo es, y
// las tres razones son las que el plan de F08 fijó, en este orden:
//
//   1. **Es la acción que CONSUME el diagnóstico, y el diagnóstico se lee AQUÍ.**
//      El informe no es otra cosa que las cifras de este cajón puestas en un
//      fichero. Poner el botón en el panel, a un palmo de distancia de las cifras
//      que descarga, obligaría a recordar qué se estaba mirando para saber qué se
//      está bajando.
//   2. **El cajón tiene ANCHURA y el pie no.** Los CTA del pie van a lo ancho y
//      uno DEBAJO de otro —el razonamiento está escrito en `index.html`, junto al
//      de F07: «secundario y debajo del primario, no al lado»—, así que un tercero
//      cuesta ~36 px MEDIDOS de altura del panel, y esos píxeles salen de la caja
//      de vértices, que es justo la que lleva sin sitio desde F06. Aquí cuesta
//      **0 px de panel**, igual que costó traerse el diagnóstico al mapa.
//   3. **Sirve igual de bien a las DOS vías de entrada.** Quien llegó por
//      referencia catastral (F05) y quien llegó soltando un GML ajeno (F08)
//      quieren el mismo informe. El cajón es común a las dos, así que no hay que
//      ramificar la interfaz por procedencia — y `report/contraste-texto.js` acepta
//      `comprobacion: null` precisamente para eso.
//
// ⚠️ **DE LAS TRES, LA 2 CADUCÓ EL 2026-08-05** y las otras dos salieron
// reforzadas. La 2 decía «aquí cuesta 0 px de panel»: ya no es cierto —este
// contenedor ES el panel en su pantalla— y da igual, porque el presupuesto que
// protegía (una altura fija repartida entre bloques fijos) desapareció con el
// rework. La 1 («la acción que CONSUME el diagnóstico va donde el diagnóstico se
// lee») y la 3 («sirve igual a las dos vías de entrada») valen palabra por palabra,
// y ahora además sin obligar a leer a un palmo de distancia. Ver {@link anfitrion}.
//
// Lo que este módulo NO sabe es qué se escribe dentro del informe ni cómo baja:
// solo enciende el botón, lo apaga y avisa de que lo han pulsado. Componer el
// texto es de `report/contraste-texto.js` y entregarlo de
// `gml/descargar.js#descargarTexto`; a los dos los llama
// `app/cableado-diagnostico.js`, que es quien conoce el store y el reloj.
//
// ── F09 · «PREPARAR INFORME (PDF)», Y POR QUÉ ES EL PRIMARIO DE LOS DOS ─────
// El pie tiene desde F09 DOS botones, y cuál va primero no es aseo: es lo único
// que dice cuál de los dos documentos es el entregable.
//
//   · **«Preparar informe (PDF)»** — el PRIMARIO. Es el documento firmable de
//     F09: plano de situación a 300 ppp, descripción literaria del lindero y pie
//     de firma. Es a lo que se viene.
//   · **«Descargar informe de contraste»** — el secundario, y no se jubila
//     porque sigue sirviendo para lo que el otro no puede: es texto plano, se
//     compone SIN RED —no pide una sola tesela al WMS— y baja igual el día que
//     el plano no se pueda armar. Degradar no es quitar.
//
// Los dos se encienden y se apagan JUNTOS, con el MISMO gate y contra la misma
// condición —«el cajón está enseñando un diagnóstico»—, y comparten el renglón
// del motivo: es un solo hecho el que los apaga, y dos renglones diciendo lo
// mismo se desincronizan solos (y el segundo, además, tendría que ser único en
// todo el documento — ver M8 en {@link SELECTOR}).
//
// Y sigue costando **0 px del panel izquierdo**, que era la razón 2 de F08: el
// segundo botón va en la MISMA fila que el primero, así que el cajón no crece ni
// un píxel y la caja de vértices conserva los 267,4 px medidos desde F07.
//
// Lo que este módulo tampoco sabe, otra vez, es qué lleva el PDF ni cómo se
// compone: solo enciende, apaga y avisa. Armarlo es de `report/pdf-parcela.js` y
// pedir el pie de firma, del diálogo de `app/dialogo-informe.js`; a los dos los
// llama el cableado.
//
// ── LA REGLA DE ORO 9 ES EL REQUISITO PRINCIPAL DE ESTE FICHERO ─────────────
// «La aplicación mide; el colegiado interpreta y firma.» En un cajón lleno de cifras
// eso se traduce en tres prohibiciones concretas, y las tres tienen guardián:
//
//   1. **Ninguna cifra lleva color de mérito.** Todas en el gris del cromo del
//      visor. Nada de verde para «poco» y rojo para «mucho»: el umbral depende del
//      expediente, del municipio y del criterio de quien firma. La ÚNICA excepción
//      autorizada por la spec es la **invasión a colindante** (§10.4), que es un
//      hecho topológico binario con consecuencia fija — y ahí va ámbar.
//   2. **Ningún texto dictamina.** El titular es descriptivo («Contraste con el
//      parcelario — Medición de X m² frente a los Y m² del parcelario vigente»), no
//      «apta para presentar». No hay semáforo, ni «válido», ni «dentro de
//      tolerancia».
//   3. **El margen de identidad se ENUNCIA con su etiqueta**, nunca como veredicto.
//      La etiqueta viaja dentro del propio diagnóstico precisamente para que no se
//      pueda pintar la cifra sin ella.
//
// ── «NO HAY» Y «NO SE SABE» SE ESCRIBEN DISTINTO ────────────────────────────
// Es media razón de ser de F07 y el cajón es donde se ve. Una sección omitida dice
// **por qué** (el `motivo` que trae el diagnóstico, en español, ya redactado); la
// invasión sin consultar dice «no se ha consultado» y **nunca** «no hay invasión»,
// que es la afirmación tranquilizadora y falsa. Un `—` a secas no vale: no
// distingue las dos cosas.
//
// ── EL CLIC DE FUERA NO SE INTERCEPTA ───────────────────────────────────────
// Mismo problema y misma solución que `viewer/barra-edicion.js`, y conviene no
// «arreglarlo»: el cajón flota sobre el mapa, y en el mapa un clic **selecciona un
// lindero** (gesto de F06, que sigue vivo con el diagnóstico abierto). Si para
// cerrar se interceptara el clic de fuera con `capture` + `preventDefault`, el
// primer clic después de abrir se lo comería el cajón. Así que: se escucha `click`
// en el `document` en fase de BURBUJA, **nunca** se llama a `preventDefault` ni a
// `stopPropagation`, y si el destino está dentro del contenedor no se hace nada.
//
// Y el detalle de Leaflet que hace imprescindible esa última comprobación:
// `L.DomEvent.disableClickPropagation` **NO detiene el `click`** —detiene
// `mousedown`, `touchstart`, `dblclick` y `contextmenu`—, así que un clic en un
// botón del cajón SÍ llega a `document`.
//
// ── `disableClickPropagation` / `disableScrollPropagation`: OBLIGATORIOS ────
// Sin ellos, pulsar dentro del cajón seleccionaría un lindero por debajo y la rueda
// sobre la tabla haría zoom al mapa. Es el fallo clásico de un control de Leaflet;
// `viewer/capas.js` y `viewer/barra-edicion.js` ya lo resuelven igual.

import L from 'leaflet'

import { ETIQUETA as ETIQUETA_MARGEN } from '../diagnostico/margen.js'
import { resolverAvisar } from './_comun.js'

/** Esquinas válidas de un `L.Control`: las claves de `map._controlCorners`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/**
 * Clases CSS del cajón. El cromo fino lo viste `estilos/app.css` (tarea T4.2); aquí
 * solo van los estilos MÍNIMOS en línea que hacen el cajón legible sin ninguna hoja
 * —mismo criterio que `viewer/capas.js` y `viewer/barra-edicion.js`—, porque este
 * módulo no importa CSS: el CSS es responsabilidad de la entrada de la aplicación.
 */
/**
 * El tope de altura del cajón cuando es **un cajón**: una esquina del mapa que se
 * abre y se descarta. Es el valor de F07 y no se toca.
 */
export const ALTO_COMO_CAJON = '52vh'

/**
 * Y el tope cuando es **la pantalla** (rework de UI · rebanada 4). Los 112 px
 * están MEDIDOS en Chrome, no elegidos: el cajón vive en `bottomleft` y su borde
 * inferior queda a 31 px del suelo de la ventana, así que restar 112 le deja el
 * techo a 81 px — 9 px por debajo del control de zoom, que termina en 72. Con más
 * altura se pisarían, y un cajón que tapa el zoom deja el mapa sin manejar.
 *
 * Rinde 608 px de los 650 que mide el contenido a 1280×720 (el suelo declarado en
 * D5) y los 650 enteros a 1440×900. Lo que queda fuera en el caso peor es
 * DESCRIPTIVO: lo accionable y lo que habla van en el bloque anclado.
 */
export const ALTO_COMO_PANTALLA = 'calc(100vh - 112px)'

/**
 * ⭐ **EL CROMO DEL CONTENEDOR EN CADA UNO DE SUS DOS SITIOS** (2026-08-05).
 *
 * Hasta hoy este contenedor solo vivía en una esquina del mapa, así que sus
 * estilos se escribían de una vez en `onAdd` y no se volvían a tocar. Desde que la
 * pantalla de Diagnóstico lo aloja en el PANEL IZQUIERDO (ver {@link anfitrion}),
 * el mismo nodo tiene que saber vestirse de las dos maneras — y las dos listas
 * tienen que llevar **las mismas claves**, porque `estilar` asigna propiedad a
 * propiedad y lo que una ponga y la otra no mencione se quedaría pegado al cambiar
 * de sitio. Hay una prueba que compara los dos juegos de claves justo por eso.
 *
 * Sobre el mapa: una ventanita blanca con sombra que flota sobre la ortofoto.
 */
export const ESTILO_SOBRE_EL_MAPA = Object.freeze({
  background: '#fff',
  padding: '10px 12px',
  borderRadius: '6px',
  boxShadow: '0 2px 10px rgba(15,23,42,.25)',
  maxWidth: 'min(420px,42vw)',
  maxHeight: ALTO_COMO_CAJON,
  flex: '',
  minHeight: '',
})

/**
 * Y en el panel: **ni ventana ni sombra**. Ahí no flota sobre nada — es el
 * contenido de la columna, como la tabla de vértices lo es en Validación—, así que
 * el fondo, el radio y la sombra sobrarían: dibujarían una tarjeta dentro de un
 * panel que ya es una tarjeta.
 *
 * Las tres decisiones que no se leen solas:
 *
 *   · **`padding: '0 12px 10px'`**, con los mismos 12 px horizontales y los mismos
 *     10 px de abajo que sobre el mapa. NO es descuido dejarlos: el bloque anclado
 *     del pie se sale de ellos con `margin: -12px` y `width: calc(100% + 24px)`
 *     para que su fondo llegue a los bordes, y cambiar el relleno aquí descuadraría
 *     esa compensación sin que nada avisara (el pie se saldría 12 px por cada lado
 *     y 10 px por abajo, y ese último se lo comería el recorte del scroll). Lo
 *     único que se quita es el relleno de ARRIBA, que ya lo pone la sección
 *     anfitriona. Los 12 px que quedan más los 12 de `.gml-bloque--contraste` en
 *     `estilos/app.css` suman los 24 (`--space-6`) que gastan los demás bloques del
 *     panel.
 *   · **`maxHeight: 'none'` + `flex: '1 1 auto'` + `minHeight: '0'`**: en el panel
 *     la altura no se declara, se REPARTE. La sección anfitriona es un
 *     `display:flex` en columna (lo hereda de `.gml-bloque`), así que el cajón
 *     absorbe lo que sobra entre la cabecera y el pie del panel y scrollea por
 *     dentro — exactamente como hacía la caja de vértices, a la que sustituye.
 *     Un `max-height` en vh aquí volvería a medir contra la ventana en vez de
 *     contra el hueco, que es el error que se lleva arrastrando desde F07.
 *   · **`background: 'transparent'`** y no `#fff`: el panel ya tiene su fondo, y
 *     fijarlo aquí sería el único sitio de la aplicación que se salta el token.
 */
export const ESTILO_EN_EL_PANEL = Object.freeze({
  background: 'transparent',
  padding: '0 12px 10px',
  borderRadius: '0',
  boxShadow: 'none',
  maxWidth: 'none',
  maxHeight: 'none',
  flex: '1 1 auto',
  minHeight: '0',
})

/**
 * ── LA ESCALA TIPOGRÁFICA DEL CAJÓN (2026-08-10) ───────────────────────────
 *
 * **Vive AQUÍ y no en `estilos/app.css` porque este módulo viste en línea**, y un
 * estilo en línea gana a cualquier selector: mientras estos números estén
 * escritos a mano en cada nodo, la hoja no gobierna nada de lo que se lee en este
 * cajón. Es el mismo acuerdo que `viewer/capas.js` (el cajón tiene que leerse
 * sobre una ortofoto aunque la hoja no cargue), así que no se «arregla» moviendo
 * los tamaños al CSS: se arregla teniéndolos en UN sitio, que es esto.
 *
 * ── QUÉ MEDÍA ANTES, Y POR QUÉ SE CAMBIÓ ────────────────────────────────────
 * `/plan-design-review` del 2026-08-10 contó las declaraciones de tamaño de toda
 * la aplicación: **92 de 105 valían 10, 11 o 12 px**. Aquí eso se traducía en que
 * la superficie medida —la cifra por la que existe la pantalla— se leía
 * exactamente igual de fuerte que el descargo de tres líneas que hay encima, y
 * que varias filas ni siquiera declaraban tamaño: heredaban el 12 px que pone
 * Leaflet sobre el mapa y otro distinto dentro del panel, así que **el mismo
 * cajón se veía de dos tamaños según dónde estuviera**.
 *
 * Cinco pasos, y cada uno tiene un trabajo. No hay un sexto «título de pantalla»
 * porque este cajón no tiene título de pantalla: su `<h2>` es la frase de
 * entrada, y va en CUERPO con peso 600.
 *
 * ⚠️ `DATO_XL` es SOLO para la superficie medida, y solo cuando hay una cifra:
 * «No consta» a 30 px grita una ausencia. Lo conmuta `pintar` (ver
 * `destacarMedida`), no se pega aquí de una vez.
 */
export const ESCALA = Object.freeze({
  /** El dato titular: la superficie medida, y nada más. */
  DATO_XL: '30px',
  /** Toda cifra de la ficha (superficies, solape, centroides, desviación). */
  DATO: '15px',
  /** Prosa y etiquetas de dato. Sube desde el 11-12 px heredado. */
  CUERPO: '13px',
  /** Notas al pie: procedencia, margen, renglón de estado, tabla de cruces. */
  APUNTE: '12px',
  /** Rótulo de grupo, en versalitas. */
  ROTULO: '10px',
})

export const CLASE = Object.freeze({
  CONTENEDOR: 'gml-cajon-diagnostico',
  TITULAR: 'gml-cajon-titular',
  SECCION: 'gml-cajon-seccion',
  /**
   * Rótulo de grupo («Superficie», «Encaje»). Nace con la revisión de diseño del
   * 2026-08-10, que midió que el cajón era una columna indiferenciada: seis
   * bloques distintos sin una sola pista de dónde acaba uno y empieza el
   * siguiente.
   *
   * ⛔ **La invasión NO lleva uno**, y es a propósito: esa sección se anuncia
   * ella misma con tres textos DISTINTOS («…: no se ha consultado», «…:
   * ninguna», y el título a secas cuando las hay), y esa diferencia es media
   * razón de ser de F07. Un rótulo fijo encima aplanaría las tres en una y
   * duplicaría la palabra.
   */
  ROTULO: 'gml-cajon-rotulo',
  CIFRA: 'gml-cajon-cifra',
  TABLA: 'gml-cajon-tabla',
  // No hay `OMISION`. La había, y no la llevaba ningún nodo: los motivos de
  // omisión se escriben DENTRO de la cifra que falta (`textoOmitido`), que es lo
  // que hace que se lean en su sitio y no en una nota al pie. Una clase que nadie
  // pone es un gancho de CSS que no engancha nada — y peor, invita a escribir la
  // regla y a creer que se aplica.
  INVASION: 'gml-cajon-invasion',
  MARGEN: 'gml-cajon-margen',
})

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con
 * `app/cableado-diagnostico.js`**, que localiza los nodos POR SELECTOR y lanza si
 * falta alguno — igual que `app/main.js` con los del pie y con los de la barra de
 * edición. Renombrar un valor aquí rompe ese módulo, no este fichero.
 *
 * Están exportados para que el cableado y sus tests no los escriban a mano: un
 * literal mal escrito en un `querySelector` devuelve `null` sin quejarse.
 *
 * ⚠️ `ESTADO` vale `cajon-diagnostico` y NO `diagnostico`, que es lo que pedía el
 * plan de F07. El motivo es una colisión real: el pie de `index.html` tiene su
 * PROPIO renglón de estado para el CTA «Diagnosticar», y la convención de la app
 * es que ese renglón lleve el mismo valor que su acción (`generar-gml`/
 * `generar-gml`, `cargar-catastro`/`cargar-catastro`) — o sea `diagnosticar`. Dos
 * cadenas que se diferencian en dos letras y que `querySelector` resuelve
 * quedándose con la PRIMERA del documento son un fallo esperando: el `<aside>` va
 * antes que el `<main>`, así que el renglón del cajón habría quedado inalcanzable
 * y mudo sin que nada lo dijera. Es exactamente la trampa que `index.html` ya
 * documenta con la barra de edición. Aquí se nombra por el componente, que además
 * es lo que este renglón es.
 *
 * ⚠️ Y lo mismo, otra vez, con el pie de F08: el renglón del informe vale
 * `informe-contraste` y **no** `descargar-informe`, que es el valor de su
 * `data-accion`. La convención del PIE de la app (`generar-gml`/`generar-gml`)
 * empareja acción y estado porque allí solo hay un nodo de cada; dentro del mapa
 * ya se ha visto lo que cuesta —M8 de F07—, así que aquí se nombra por el
 * COMPONENTE («el renglón del informe de contraste») y no por la acción. Que hoy
 * las dos cadenas no colisionen no basta: `descargar-informe` es exactamente el
 * nombre que le pondría el siguiente que añada un botón «Descargar informe» en
 * el pie, y `querySelector` se quedaría con el PRIMERO del documento —el
 * `<aside>` va antes que el `<main>`— dejando uno de los dos mudo y sin síntoma.
 * Hay un test que afirma que ningún otro nodo del documento lleva este valor.
 */
export const SELECTOR = Object.freeze({
  CERRAR: '[data-accion="cerrar-diagnostico"]',
  // ── Rework de UI · T9 ────────────────────────────────────────────────────
  // `contraste` y no `parcela`: `index.html` ya tiene un
  // `[data-procedencia="parcela"]` —el renglón de la vía del Catastro, dentro de
  // la pantalla Entrada— y el contrato K.1 prohíbe repetir el par atributo/valor
  // en el documento montado. Dicen además cosas distintas: aquél cuenta de qué
  // consulta salió el dato y su antigüedad; éste, **de quién es la geometría**.
  PROCEDENCIA: '[data-procedencia="contraste"]',
  REGISTRAL: '[data-campo="superficie-registral"]',
  CLASE_PARCELA: '[data-campo="clase-parcela"]',
  ESTADO: '[data-estado="cajon-diagnostico"]',
  PREPARAR: '[data-accion="preparar-informe"]',
  DESCARGAR: '[data-accion="descargar-informe"]',
  ESTADO_INFORME: '[data-estado="informe-contraste"]',
  TITULAR: '[data-diag="titular"]',
  MEDIDA: '[data-diag="superficie-medida"]',
  CATASTRAL: '[data-diag="superficie-catastral"]',
  CRUCES: '[data-diag="cruces"]',
  SOLAPE: '[data-diag="solape"]',
  CENTROIDES: '[data-diag="centroides"]',
  DESVIACION: '[data-diag="desviacion"]',
  INVASION: '[data-diag="invasion"]',
  MARGEN: '[data-diag="margen"]',
})

/** Rótulo humano de cada banda, para la tabla de cruces. */
const ROTULO_BANDA = Object.freeze({
  medida: 'Medición',
  catastral: 'Catastro',
  registral: 'Registro',
})

/**
 * Lo que se escribe cuando un número no consta. **No es un `—` a secas**: «no
 * consta» dice que el dato falta, mientras un guion se lee como «cero» o como
 * «nada que reseñar». Es la misma distinción que `app/main.js` ya hace en la ficha
 * del pie.
 */
const NO_CONSTA = 'No consta'

/**
 * Por qué están apagados **los dos botones del informe**. Se escribe en el renglón
 * del pie **en el mismo instante** en que se apagan —al nacer y en cada
 * `pintar(null)`—, porque un botón gris y mudo es un error silencioso (regla de
 * oro 1): desde fuera no se distingue de uno roto.
 *
 * Es UNO para los dos, y no dos constantes, porque el hecho que los apaga es uno
 * solo: no hay diagnóstico. Los NOMBRA a los dos con todas las letras para que
 * quien lo oiga por `aria-describedby` —los dos botones apuntan al mismo renglón—
 * sepa de cuál le están hablando.
 *
 * Dice las dos cosas que hacen falta: qué falta y qué hay que hacer para tenerlo.
 * Se exporta para que el cableado y los tests lo afirmen sin copiar el literal,
 * igual que {@link MOTIVO_SIN_OFICIAL} de `app/cableado-diagnostico.js`.
 *
 * @readonly
 */
export const MOTIVO_INFORME_SIN_DIAGNOSTICO =
  '«Preparar informe (PDF)» y «Descargar informe de contraste» están apagados: los dos ' +
  'recogen las medidas de este diagnóstico y todavía no hay ninguna calculada. Se encienden ' +
  'en cuanto el cajón muestra un diagnóstico.'

/**
 * Las vestimentas de los dos botones del informe, que viajan SIEMPRE con su
 * `disabled` (ver `gateInforme`). Un botón que parece pulsable y no lo es no se
 * distingue de uno roto; uno apagado que parece encendido, tampoco. Existen porque
 * un estilo EN LÍNEA no puede expresar `:disabled` y este módulo no escribe reglas.
 *
 * Son DOS pares porque los botones no son iguales: el PRIMARIO —«Preparar informe
 * (PDF)», el documento firmable de F09— va en el fondo oscuro del cromo, y el
 * SECUNDARIO —el de texto— en contorno. La jerarquía es lo único que dice cuál de
 * los dos es el entregable, y dos fondos oscuros lado a lado no dicen nada.
 *
 * El apagado va en el GRIS del cromo y **nunca en rojo**: lo que se comunica es
 * «esto no se puede pulsar ahora», no «esto está mal» (regla de oro 9). El porqué
 * se escribe con palabras en el renglón de al lado, que es donde se lee. El par
 * primario es el MISMO que usa `viewer/cajon-comprobacion.js`, y el secundario
 * viste como su «Descartar», para que los dos cajones —que comparten esquina y se
 * turnan— no parezcan dos apps.
 */
const BOTON_INFORME = Object.freeze({
  PRIMARIO: Object.freeze({
    // ⭐ `#0F172A` (casi negro) hasta la revisión de diseño del 2026-08-10. El
    // encargo del autor pide que «la acción principal de cada bloque lleve un solo
    // botón relleno con COLOR DE ACENTO», y el acento de la aplicación es el azul
    // del design system: `#0369A1` es `--color-btn-primary-bg`, el MISMO relleno que
    // usa `.gml-boton--primario` en el panel. Antes el pie de este cajón era la
    // única acción principal de la aplicación que no se veía como las demás.
    // ⚠️ Y NO es `#0284C7` (`--color-accent`): el design system separa a propósito
    // el acento de ENLACE del relleno de BOTÓN porque blanco sobre sky-600 no llega
    // a AA (4,10:1). Sobre `#0369A1` da 5,93:1.
    // ⚠️ Literal y no `var(--color-btn-primary-bg)` A PROPÓSITO: este módulo tiene
    // que verse bien SIN la hoja cargada (se monta en jsdom y sobre un mapa pelado),
    // y una variable sin declarar deja la propiedad en su valor inicial. Quien
    // cambie el acento tiene que cambiarlo aquí también; el guardián es el ojo y el
    // guion de humo, no la cascada.
    ENCENDIDO: Object.freeze({ background: '#0369A1', color: '#fff', cursor: 'pointer' }),
    APAGADO: Object.freeze({ background: '#E2E8F0', color: '#64748B', cursor: 'default' }),
  }),
  SECUNDARIO: Object.freeze({
    // ⭐ Era `transparent` + filo `#CBD5E1`. La misma revisión bajó el peso óptico
    // del secundario en el panel (`.gml-boton--secundario` pasó de blanco con
    // borde firme a fondo gris muy claro con filo suave) porque un contorno fuerte
    // pesa casi lo mismo que un relleno y los dos botones «gritaban por igual».
    // Se replica aquí con los literales equivalentes a `--color-bg-elevated`,
    // `--color-text-primary` y `--color-border-sub`, por lo mismo que arriba.
    ENCENDIDO: Object.freeze({
      background: '#F1F5F9',
      color: '#0F172A',
      border: '1px solid #E2E8F0',
      cursor: 'pointer',
    }),
    APAGADO: Object.freeze({
      background: 'transparent',
      color: '#94A3B8',
      border: '1px solid #E2E8F0',
      cursor: 'default',
    }),
  }),
})

const nf = (decimales) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

/** Superficies y longitudes: 2 decimales, que es lo que la app sabe medir. */
const FORMATO_2 = nf(2)
/** La superficie DECLARADA por el Catastro es un ENTERO (override O6). */
const FORMATO_0 = nf(0)

const m2 = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v)} m²`)
const m2Entero = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_0.format(v)} m²`)
const metros = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v)} m`)

/**
 * Un `relativo` (FRACCIÓN, 0,05 = 5 %) como porcentaje presentable. **El × 100 vive
 * aquí**, en la capa de presentación, y no en `diagnostico/`: es la confusión clásica
 * de este campo y por eso el modelo devuelve fracción y solo la vista multiplica.
 */
const porcentaje = (v) =>
  v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v * 100)} %`

/** Con signo explícito: `+` cuando es positivo. El signo es información. */
function conSigno(v, formatear) {
  if (v === null || v === undefined) return NO_CONSTA
  const texto = formatear(Math.abs(v))
  if (v > 0) return `+${texto}`
  if (v < 0) return `−${texto}`
  return texto
}

const crear = (doc, etiqueta, clase, texto) => {
  const el = doc.createElement(etiqueta)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Aplica estilos en línea propiedad a propiedad.
 *
 * **No se usa `style.cssText`, y no es una preferencia.** La guarda transversal del
 * punto 12 (`test/viewer/contrato-capas.dom.test.js`) prohíbe la subcadena `.css` en
 * el código de `viewer/` —es lo que garantiza que el visor sea consumible como
 * LIBRERÍA por F05/F06/F08, con los estilos en la entrada de la app—, y `.cssText`
 * la contiene. Se podría haber refinado el guardián para excluirla; no se hace,
 * porque debilitar el guardián que protege la mayor regla arquitectónica del visor
 * para ahorrarse un helper de tres líneas es un mal cambio. Y asignar propiedades
 * una a una es además lo que hace el resto de la capa (`barra-edicion.js`,
 * `capas.js`): `cssText` PISA cualquier estilo previo, propiedad a propiedad no.
 *
 * @param {HTMLElement} el
 * @param {Record<string, string>} estilos  Propiedades en camelCase.
 * @returns {HTMLElement}  El mismo elemento, para poder encadenar.
 */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

/**
 * Un rótulo de grupo del cajón. Ver {@link CLASE.ROTULO} para por qué existen y
 * por qué la invasión no lleva.
 *
 * **Se EXPORTA, al contrario que `estilar` o `enDialogo`, que el cajón de
 * edificio duplica.** La diferencia es qué son: aquellas son utilidades
 * genéricas de tres líneas, y duplicarlas no puede desalinear nada; esto fabrica
 * un nodo con una clase, un tamaño, un interletraje y un gris CONCRETOS que los
 * dos cajones hermanos tienen que compartir. Duplicarlo sería sembrar
 * exactamente la deriva que la escala viene a cerrar — y ya pasó una vez: hasta
 * el 2026-08-10 los dos módulos escribían sus tamaños a mano y acabaron con
 * ficheros distintos para las mismas filas.
 *
 * Es `<h3>` y no `<p>`: la cabecera del cajón es un `<h2>`, así que estos son sus
 * hijos en el esquema del documento y un lector de pantalla puede saltar de grupo
 * en grupo. Un `<p>` en versalitas se vería igual y no navegaría.
 *
 * El gris es `#475569` y no el `#64748B` del cromo menudo: a 10 px, `#64748B`
 * sobre blanco da 4,55:1 —pasa AA por los pelos y sin margen—, y este rótulo es
 * justo el texto más pequeño del cajón. `#475569` da ~7,5:1.
 *
 * @param {Document} doc
 * @param {string} texto
 * @returns {HTMLElement}
 */
export function rotuloDeGrupo(doc, texto) {
  return estilar(crear(doc, 'h3', CLASE.ROTULO, texto), {
    margin: '12px 0 4px',
    fontSize: ESCALA.ROTULO,
    fontWeight: '500',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#475569',
  })
}

const esMapa = (m) =>
  !!m &&
  typeof m.addControl === 'function' &&
  typeof m.removeControl === 'function' &&
  typeof m.getContainer === 'function'

/**
 * ¿El gesto ha ocurrido dentro de un `<dialog>`?
 *
 * Se pregunta por el ELEMENTO y no por el atributo `open`, y es deliberado: en un
 * `keydown` de `Escape` el propio diálogo ya se ha cerrado —su oyente está más
 * adentro y corre primero— cuando el evento llega burbujeando hasta el
 * `document`, así que un `dialog[open]` daría `null` justo en el caso que hay que
 * atrapar. Un gesto cuyo destino cuelga de un `<dialog>` es un gesto dirigido al
 * diálogo, esté abierto o cerrado, y en ningún caso un gesto sobre el mapa.
 *
 * `closest` se comprueba antes de llamarlo: el destino de un evento puede ser un
 * nodo de texto o el propio `document`, que no lo tienen.
 *
 * @param {EventTarget|null} objetivo
 * @returns {boolean}
 */
const enDialogo = (objetivo) =>
  !!objetivo &&
  typeof objetivo.closest === 'function' &&
  objetivo.closest('dialog') !== null

// ── El control ───────────────────────────────────────────────────────────────

const CajonDiagnostico = L.Control.extend({
  options: {
    position: 'bottomleft',
    etiqueta: 'Diagnóstico de encaje con el parcelario',
  },

  /**
   * Los oyentes del `document` se LIGAN aquí, una vez por instancia, y se guardan
   * como campos propios. No es ceremonia: `addEventListener` y
   * `removeEventListener` tienen que recibir **la misma referencia**, y un
   * `bind(this)` escrito en el `add` y otro en el `remove` son dos funciones
   * distintas — el oyente quedaría vivo para siempre sobre un control ya destruido
   * y `destruir()` mentiría. Es la lección que `viewer/barra-edicion.js` dejó
   * escrita.
   */
  initialize(opciones) {
    L.setOptions(this, opciones)
    this._alClicFuera = (evento) => this._cerrarPorClicFuera(evento)
    this._alEscape = (evento) => this._cerrarPorEscape(evento)
    this._abierto = false
    this._eventoApertura = null
    // Rework de UI · rebanada 4. Nace en `false` —o sea, exactamente el cajón de
    // F07— para que un visor montado sin aplicador (los tests, un mapa pelado) se
    // comporte como antes. Quien lo conmuta es `app/contraste.js`, que es el único
    // que sabe qué paso hay. Ver {@link crearCajonDiagnostico}#comoPantalla.
    this._comoPantalla = false
    // Dónde vive el contenedor cuando ES la pantalla. `null` = en la esquina del
    // mapa, que es lo de F07 y lo que ve un visor montado a pelo. Quien lo fija es
    // `app/main.js`, que es el único que conoce la cáscara. Ver {@link anfitrion}.
    this._anfitrion = null
    // La esquina de Leaflet a la que hay que devolverlo. La rellena
    // `crearCajonDiagnostico` justo después de `addControl`, que es cuando Leaflet
    // ya ha colgado el contenedor de su sitio (en `onAdd` todavía no tiene padre).
    this._esquina = null
    this._oyentes = {
      cerrar: new Set(),
      // Rework de UI · rebanada 4. «Han pulsado el ✕ y este cajón NO se cierra
      // porque es la pantalla»: quien decide a dónde se sale es la autoridad de
      // navegación, y esta vista no sabe qué es un paso.
      salir: new Set(),
      cambiar: new Set(),
      descargar: new Set(),
      preparar: new Set(),
    }
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    // El sello de Leaflet da ids únicos aunque se monten dos cajones (dos mapas en
    // la misma página). Mismo recurso que `barra-edicion.js` y `capas.js`.
    const sello = L.Util.stamp(this)

    const contenedor = crear(doc, 'section', CLASE.CONTENEDOR)
    this._contenedor = contenedor
    contenedor.setAttribute('aria-label', this.options.etiqueta)
    // Estilos MÍNIMOS en línea: este módulo no importa ninguna hoja, así que el
    // cajón tiene que ser legible por sí solo (en `npm run dev` sin CSS, y en
    // jsdom). El cromo fino es de `estilos/app.css`.
    estilar(contenedor, {
      font: '13px/1.45 system-ui,sans-serif',
      color: '#334155',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      display: 'none',
    })
    // Nace como CAJÓN SOBRE EL MAPA. Lo muda de sitio {@link _reubicar}, y solo
    // cuando alguien le da un anfitrión y le dice que es la pantalla: este módulo
    // no sabe en qué paso está la aplicación ni qué es un panel.
    estilar(contenedor, ESTILO_SOBRE_EL_MAPA)

    // ── Cabecera: titular descriptivo + cerrar ──────────────────────────────
    const cabecera = crear(doc, 'header')
    estilar(cabecera, {
      display: 'flex',
      alignItems: 'start',
      gap: '8px',
      justifyContent: 'space-between',
    })
    const titular = crear(doc, 'h2', CLASE.TITULAR)
    titular.dataset.diag = 'titular'
    estilar(titular, {
      margin: '0',
      fontSize: ESCALA.CUERPO,
      fontWeight: '600',
      color: '#0F172A',
    })
    this._titular = titular

    const cerrar = crear(doc, 'button', null, '✕')
    cerrar.type = 'button'
    cerrar.dataset.accion = 'cerrar-diagnostico'
    cerrar.setAttribute('aria-label', 'Cerrar el diagnóstico')
    estilar(cerrar, {
      flex: 'none',
      border: '0',
      background: 'transparent',
      cursor: 'pointer',
      fontSize: '14px',
      lineHeight: '1',
      padding: '2px 4px',
      color: '#64748B',
    })
    this._botonCerrar = cerrar

    cabecera.append(titular, cerrar)

    // ── Rework de UI · T9 · LA PROCEDENCIA, DECLARADA ──────────────────────
    // De quién es la geometría que se está contrastando. Va ARRIBA del todo, y no
    // en una nota al pie, porque cambia cómo se lee todo lo que hay debajo: las
    // mismas cifras significan una cosa sobre tu levantamiento y otra sobre el
    // GML de otro técnico.
    //
    // ⛔ **El defecto que esto cierra, medido:** hasta el 2026-08-04 lo único que
    // decía la procedencia era `[data-procedencia="parcela"]` de `index.html`, y
    // T6 lo dejó DENTRO de la pantalla Entrada — así que en cuanto se navegaba a
    // cualquier otra, desaparecía. Se contrastaba la geometría de un desconocido
    // en una pantalla idéntica a la de la propia.
    //
    // El TEXTO no se compone aquí: llega hecho desde `app/contraste.js`, porque
    // sale de `parcela.origen` y este módulo no importa `model/` (ver la
    // cabecera). Aquí solo se pinta.
    //
    // Nace VACÍO y por lo tanto oculto: un renglón en blanco cuesta ~17 px de un
    // cajón que declara `maxHeight: 52vh`, y no decir nada tiene que costar cero.
    const procedencia = crear(doc, 'p')
    procedencia.dataset.procedencia = 'contraste'
    // `role="status"`, igual que los otros dos renglones del cajón: cambiar de
    // parcela lo reescribe, y un lector de pantalla tiene que enterarse sin que le
    // roben el foco de donde lo tenga.
    procedencia.setAttribute('role', 'status')
    estilar(procedencia, {
      margin: '6px 0 0',
      fontSize: ESCALA.APUNTE,
      color: '#475569',
      display: 'none',
    })
    this._procedencia = procedencia

    // ── Las tres bandas ────────────────────────────────────────────────────
    const bandas = crear(doc, 'div', CLASE.SECCION)
    const idRegistral = `gml-diag-registral-${sello}`
    const idClase = `gml-diag-clase-${sello}`
    const idInforme = `gml-diag-informe-${sello}`

    const medida = crear(doc, 'dd', CLASE.CIFRA)
    medida.dataset.diag = 'superficie-medida'
    const catastral = crear(doc, 'dd', CLASE.CIFRA)
    catastral.dataset.diag = 'superficie-catastral'
    // Las cifras declaran su tamaño; el `dl` de abajo declara el de las etiquetas.
    // Antes ninguno de los dos lo hacía y las cuatro celdas heredaban lo que
    // pusiera el anfitrión: 12 px de Leaflet sobre el mapa, otro dentro del panel.
    // `medida` lo vuelve a escribir `pintar` cuando hay cifra (ver `destacarMedida`).
    estilar(medida, { fontSize: ESCALA.DATO })
    estilar(catastral, { fontSize: ESCALA.DATO })
    this._medida = medida
    this._catastral = catastral

    const lista = crear(doc, 'dl')
    estilar(lista, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '8px 0 0',
      fontSize: ESCALA.CUERPO,
    })
    lista.append(
      crear(doc, 'dt', null, 'Medición'),
      medida,
      crear(doc, 'dt', null, 'Parcelario vigente'),
      catastral,
    )

    // El campo de la superficie REGISTRAL: es un dato de una escritura, no algo que
    // se mida, así que lo teclea el usuario y nace vacío. `type="number"` con
    // `step` de céntimo: es una superficie en m².
    const etiquetaRegistral = crear(doc, 'label', null, 'Superficie registral (m²)')
    etiquetaRegistral.htmlFor = idRegistral
    const registral = crear(doc, 'input')
    registral.id = idRegistral
    registral.type = 'number'
    registral.step = '0.01'
    registral.min = '0'
    registral.inputMode = 'decimal'
    registral.dataset.campo = 'superficie-registral'
    registral.placeholder = 'de la escritura'
    estilar(registral, {
      width: '9em',
      padding: '3px 6px',
      border: '1px solid #CBD5E1',
      borderRadius: '6px',
    })
    this._registral = registral

    const filaRegistral = crear(doc, 'div')
    estilar(filaRegistral, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '8px',
    })
    filaRegistral.append(etiquetaRegistral, registral)

    // La tabla de diferencias cruzadas. Caja VACÍA: la rellena `pintar`.
    const cruces = crear(doc, 'table', CLASE.TABLA)
    cruces.dataset.diag = 'cruces'
    estilar(cruces, {
      borderCollapse: 'collapse',
      marginTop: '8px',
      width: '100%',
      fontSize: ESCALA.APUNTE,
    })
    this._cruces = cruces

    bandas.append(lista, filaRegistral, cruces)

    // ── Las métricas de encaje ─────────────────────────────────────────────
    const metricas = crear(doc, 'dl', CLASE.SECCION)
    estilar(metricas, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '10px 0 0',
      fontSize: ESCALA.CUERPO,
    })
    this._solape = crear(doc, 'dd', CLASE.CIFRA)
    this._solape.dataset.diag = 'solape'
    this._centroides = crear(doc, 'dd', CLASE.CIFRA)
    this._centroides.dataset.diag = 'centroides'
    this._desviacion = crear(doc, 'dd', CLASE.CIFRA)
    this._desviacion.dataset.diag = 'desviacion'
    // Las tres pueden traer una CIFRA o el motivo de su omisión, que es prosa y a
    // veces larga. 15 px sirve a las dos: es el salto sobre la etiqueta de 13 que
    // hace que la vista caiga en el número, y no tanto como para que un motivo de
    // dos líneas se coma el cajón. Por eso el tamaño grande de verdad (`DATO_XL`)
    // se reserva a `medida`, que nunca lleva prosa.
    for (const dd of [this._solape, this._centroides, this._desviacion]) {
      estilar(dd, { fontSize: ESCALA.DATO })
    }
    metricas.append(
      crear(doc, 'dt', null, 'Solape'),
      this._solape,
      crear(doc, 'dt', null, 'Desplazamiento de centroides'),
      this._centroides,
      crear(doc, 'dt', null, 'Desviación máxima de lindero'),
      this._desviacion,
    )

    // ── Invasión: la única sección que puede llevar ámbar ──────────────────
    const invasion = crear(doc, 'div', CLASE.INVASION)
    invasion.dataset.diag = 'invasion'
    invasion.style.marginTop = '10px'
    invasion.style.fontSize = ESCALA.CUERPO
    this._invasion = invasion

    // ── Margen de identidad, con su selector de clase ──────────────────────
    const etiquetaClase = crear(doc, 'label', null, 'Clase de suelo')
    etiquetaClase.htmlFor = idClase
    const selectorClase = crear(doc, 'select')
    selectorClase.id = idClase
    selectorClase.dataset.campo = 'clase-parcela'
    estilar(selectorClase, {
      padding: '3px 6px',
      border: '1px solid #CBD5E1',
      borderRadius: '6px',
    })
    for (const [valor, texto] of [
      ['', '(elegir)'],
      ['URBANA', 'Urbana'],
      ['RUSTICA', 'Rústica'],
    ]) {
      const opcion = crear(doc, 'option', null, texto)
      opcion.value = valor
      selectorClase.append(opcion)
    }
    this._clase = selectorClase

    const margen = crear(doc, 'p', CLASE.MARGEN)
    margen.dataset.diag = 'margen'
    estilar(margen, {
      margin: '6px 0 0',
      fontSize: ESCALA.APUNTE,
      color: '#64748B',
    })
    this._margen = margen

    const bloqueMargen = crear(doc, 'div', CLASE.SECCION)
    bloqueMargen.style.marginTop = '10px'
    const filaClase = crear(doc, 'div')
    estilar(filaClase, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    })
    filaClase.append(etiquetaClase, selectorClase)
    bloqueMargen.append(filaClase, margen)

    // ── El renglón de estado ───────────────────────────────────────────────
    // `role="status"` para que el lector de pantalla lo anuncie SIN robar el foco,
    // igual que el de «Generar GML» y el de la barra de edición: el usuario sigue
    // con las manos donde estaba.
    const estado = crear(doc, 'p')
    // `cajon-diagnostico`, no `diagnostico`: ver el aviso de {@link SELECTOR}.
    estado.dataset.estado = 'cajon-diagnostico'
    estado.setAttribute('role', 'status')
    estilar(estado, {
      margin: '8px 0 0',
      fontSize: ESCALA.APUNTE,
      color: '#64748B',
      minHeight: '1em',
    })
    this._estado = estado

    // ── El PIE: las acciones que consumen el diagnóstico (F08 y F09) ───────
    // Por qué viven aquí y no en el pie de la app: ver la cabecera del módulo.
    // `<footer>` de verdad, hermano del `<header>` de la cabecera; no lleva clase
    // porque `estilos/app.css` no necesita engancharse a él, y una clase que nadie
    // viste es un gancho que invita a escribir la regla y a creer que se aplica
    // (ver la nota de `OMISION` en {@link CLASE}).
    const pie = crear(doc, 'footer')
    estilar(pie, { marginTop: '12px' })

    // Los dos botones en UNA fila, y el primario primero. Que compartan fila es lo
    // que hace que el segundo cueste **0 px** de alto: el cajón no crece, y por lo
    // tanto tampoco empuja nada del panel (ver la cabecera). `flexWrap` para que en
    // un cajón estrecho el segundo caiga debajo en vez de desbordarse.
    const acciones = crear(doc, 'div')
    estilar(acciones, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      alignItems: 'center',
    })

    // El PRIMARIO de F09: el documento firmable. Va antes que el de texto porque el
    // orden es lo único que dice cuál de los dos es el entregable.
    const preparar = crear(doc, 'button', null, 'Preparar informe (PDF)')
    preparar.type = 'button'
    preparar.dataset.accion = 'preparar-informe'
    // El MISMO renglón que el secundario: los dos se apagan por el mismo hecho y el
    // motivo es uno solo. Ver {@link MOTIVO_INFORME_SIN_DIAGNOSTICO}.
    preparar.setAttribute('aria-describedby', idInforme)
    // NACE APAGADO, igual que el de texto y por lo mismo: sin diagnóstico calculado
    // no hay medidas que llevar al documento. A partir de aquí lo gobierna `pintar`.
    preparar.disabled = true
    // ⚠️ NI `font: 'inherit'` NI NINGUNA `fontFamily`, exactamente por lo que se
    // explica un poco más abajo para el secundario (defecto REAL medido en el
    // guion 10 el 2026-07-30): el estilo en línea gana a la hoja y dejaría muerta
    // la regla `.gml-cajon-diagnostico button` de `estilos/app.css`.
    estilar(preparar, {
      border: '0',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...BOTON_INFORME.PRIMARIO.APAGADO,
    })
    this._preparar = preparar

    const descargar = crear(doc, 'button', null, 'Descargar informe de contraste')
    descargar.type = 'button'
    descargar.dataset.accion = 'descargar-informe'
    // El renglón de debajo es donde se escribe POR QUÉ está apagado, así que se
    // ENLAZA: un lector de pantalla que anuncie el botón anuncia también el
    // motivo, sin que el usuario tenga que ir a buscarlo. Mismo recurso que el
    // primario de `viewer/cajon-comprobacion.js`.
    descargar.setAttribute('aria-describedby', idInforme)
    // NACE APAGADO: sin diagnóstico calculado no hay cifras que llevarse. A partir
    // de aquí lo gobierna `pintar`, y NUNCA sin escribir el motivo (regla 1).
    descargar.disabled = true
    // ⚠️ NI `font: 'inherit'` NI NINGUNA `fontFamily` AQUÍ, y es deliberado
    // (2026-07-30, corregido tras medirlo en el guion 10). El atajo
    // `font: 'inherit'` hereda el `font` EN LÍNEA del contenedor —`system-ui`— y,
    // por ser inline, **gana a la hoja**: la regla `.gml-cajon-diagnostico button`
    // de `estilos/app.css` quedaba muerta y el botón salía en `system-ui` mientras
    // el resto del cajón iba en Geist. El módulo fija tamaño y grosor (legible sin
    // hoja); **la FAMILIA la pone la hoja**. Mismo reparto que en
    // `viewer/cajon-comprobacion.js`, y por eso los dos cajones se arreglan juntos.
    estilar(descargar, {
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...BOTON_INFORME.SECUNDARIO.APAGADO,
    })
    this._descargar = descargar

    const estadoInforme = crear(doc, 'p')
    estadoInforme.id = idInforme
    // `informe-contraste`, no `descargar-informe`: ver el aviso de {@link SELECTOR}.
    estadoInforme.dataset.estado = 'informe-contraste'
    estadoInforme.setAttribute('role', 'status')
    estilar(estadoInforme, {
      margin: '6px 0 0',
      fontSize: '12px',
      color: '#64748B',
      minHeight: '1em',
    })
    // El motivo se escribe YA, no al primer repintado: el cajón puede abrirse sin
    // que nadie haya llamado a `pintar` todavía, y ese es justo el instante en que
    // los dos botones están grises.
    estadoInforme.textContent = MOTIVO_INFORME_SIN_DIAGNOSTICO
    this._estadoInforme = estadoInforme

    // ── ⛔ AQUÍ VIVÍA «LA PUERTA» (D4), Y SE RETIRÓ EL 2026-08-07 ───────────
    // Este cajón tenía un tercer botón —«Tomar esta geometría y editarla»— que
    // levantaba el bloqueo del modo COMPROBACIÓN. El eje entero se ha ido; el
    // porqué está en la cabecera de `app/navegacion.js`.
    //
    // ⭐ **La medición que costó vale para el resto del cajón y por eso se queda
    // escrita**: aquel botón nacía 314 px por debajo del pliegue a 1280×720 y 267
    // a 1440×900, o sea fuera de la vista, y de ahí salió la receta del bloque
    // anclado de abajo. El defecto de fondo era peor y es la lección: **el botón
    // que era toda la razón de ser de un modo vivía en una pantalla a la que ese
    // mismo modo impedía llegar**, y ninguna de las pruebas de jsdom podía verlo
    // porque en jsdom no hay maquetación ni hay rail.

    acciones.append(preparar, descargar)
    pie.append(acciones, estadoInforme)

    // ── ⛔ EL BLOQUE ANCLADO (rework de UI · rebanada 4, 2026-08-05) ──────────
    // MEDIDO en Chrome a 1280×720, con el cajón recién abierto en su pantalla:
    //
    //     contenido 650 px en un cajón de 374,39 → 278 px (42,77 %) BAJO EL PLIEGUE
    //     «Preparar informe (PDF)» ............ 207,53 px por debajo del borde
    //     «Descargar informe de contraste» .... 248,38 px por debajo
    //     el renglón de estado (role=status) .. 164,69 px por debajo
    //     la invasión a colindantes ...........  15,73 px por debajo
    //
    // O sea: **la pantalla enseñaba el titular y las bandas, y escondía todo lo
    // accionable y el canal por el que el cajón habla.** Es el mismo defecto que
    // T9 le encontró a la desaparecida puerta de D4 el 2026-08-04 —y por el que
    // aquélla se pegó abajo—, solo que a los otros tres nadie los midió entonces.
    //
    // La corrección es la MISMA receta, aplicada al grupo entero en vez de a un
    // botón: un bloque `sticky` pegado abajo, **hijo directo del contenedor** (que
    // es el que scrollea), con márgenes negativos y su relleno para que el fondo
    // llegue a los bordes del cajón y el contenido no se vea pasar por debajo. Lo
    // que se ancla es exactamente lo que no puede esconderse: lo que HABLA (los
    // dos renglones de estado) y lo que se PULSA (los dos botones del informe).
    const anclado = crear(doc, 'div')
    anclado.dataset.diag = 'anclado'
    estilar(anclado, {
      position: 'sticky',
      bottom: '0',
      zIndex: '1',
      marginTop: '12px',
      marginLeft: '-12px',
      marginRight: '-12px',
      marginBottom: '-10px',
      padding: '8px 12px 10px',
      borderTop: '1px solid #E2E8F0',
      background: '#fff',
      boxSizing: 'border-box',
      width: 'calc(100% + 24px)',
    })
    this._anclado = anclado
    // El pie ya no pone su propio margen superior: lo pone el bloque.
    estilar(pie, { marginTop: '0' })
    anclado.append(estado, pie)

    // Los DOS rótulos de grupo (2026-08-10). Sin ellos esto son seis bloques
    // seguidos sin una sola pista de dónde acaba uno y empieza el siguiente: la
    // revisión de diseño lo llamó «una columna indiferenciada» y tenía razón.
    // Por qué la invasión no lleva el suyo, en {@link CLASE.ROTULO}; el bloque del
    // margen tampoco, porque es un campo que se rellena y su nota, no una ficha de
    // cifras, y rotularlo lo ascendería a sección que no es.
    contenedor.append(
      cabecera,
      procedencia,
      rotuloDeGrupo(doc, 'Superficie'),
      bandas,
      rotuloDeGrupo(doc, 'Encaje'),
      metricas,
      invasion,
      bloqueMargen,
      anclado,
    )

    // OBLIGATORIOS: sin ellos, pulsar dentro seleccionaría un lindero por debajo y
    // la rueda sobre la tabla haría zoom al mapa.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    L.DomEvent.on(cerrar, 'click', this._alPulsarCerrar, this)
    L.DomEvent.on(preparar, 'click', this._alPulsarPreparar, this)
    L.DomEvent.on(descargar, 'click', this._alPulsarDescargar, this)
    L.DomEvent.on(registral, 'change', this._alCambiar, this)
    L.DomEvent.on(registral, 'input', this._alCambiar, this)
    L.DomEvent.on(selectorClase, 'change', this._alCambiar, this)
    doc.addEventListener('click', this._alClicFuera)
    doc.addEventListener('keydown', this._alEscape)

    return contenedor
  },

  onRemove() {
    L.DomEvent.off(this._botonCerrar, 'click', this._alPulsarCerrar, this)
    L.DomEvent.off(this._preparar, 'click', this._alPulsarPreparar, this)
    L.DomEvent.off(this._descargar, 'click', this._alPulsarDescargar, this)
    L.DomEvent.off(this._registral, 'change', this._alCambiar, this)
    L.DomEvent.off(this._registral, 'input', this._alCambiar, this)
    L.DomEvent.off(this._clase, 'change', this._alCambiar, this)
    if (this._doc) {
      this._doc.removeEventListener('click', this._alClicFuera)
      this._doc.removeEventListener('keydown', this._alEscape)
    }
    this._abierto = false
  },

  // ── Dónde vive el contenedor ──────────────────────────────────────────────

  /**
   * ⭐ **MUEVE EL CONTENEDOR AL SITIO QUE LE TOCA Y LO VISTE PARA ESE SITIO.**
   *
   * Hay exactamente DOS sitios, y cuál toca es una sola pregunta con dos mitades:
   * `¿es la pantalla?` **y** `¿alguien ha dicho dónde?`.
   *
   *   · **En el panel** — `comoPantalla(true)` y hay anfitrión. Es lo que ve el
   *     usuario de la aplicación desde el 2026-08-05.
   *   · **En la esquina del mapa** — todo lo demás. Es lo de F07, y sigue siendo lo
   *     que ve quien monte el visor a pelo (los tests, un mapa sin cáscara). Ahí
   *     `comoPantalla` solo cambia el tope de alto, como venía haciendo.
   *
   * ── ⚠️ POR QUÉ SE MUEVE EL NODO Y NO SE FABRICA OTRO ────────────────────────
   * Un segundo contenedor sería un segundo `[data-diag="titular"]`, un segundo
   * `[data-campo="superficie-registral"]` y un segundo `[data-accion=
   * "preparar-informe"]` en el mismo documento — y `querySelector` se queda con el
   * PRIMERO. `app/cableado-diagnostico.js` y `app/cableado-informe.js` resuelven
   * esos nodos UNA vez, al montar, así que el segundo juego nacería mudo y sin un
   * solo síntoma. Es la trampa que `index.html` lleva documentando desde F06, y la
   * razón por la que aquí se muda el nodo entero con sus oyentes puestos: `append`
   * lo reengancha en el sitio nuevo sin desatar nada.
   *
   * `control.remove()` de Leaflet sigue funcionando esté donde esté: hace
   * `DomUtil.remove(this._container)`, que le pregunta al nodo por su padre real.
   *
   * IDEMPOTENTE y barata: si ya está donde toca, `append` no hace nada.
   */
  _reubicar() {
    const contenedor = this._contenedor
    if (!contenedor) return
    const enPanel = this._comoPantalla === true && this._anfitrion !== null
    const destino = enPanel ? this._anfitrion : this._esquina
    if (destino && contenedor.parentNode !== destino) destino.append(contenedor)
    if (enPanel) {
      estilar(contenedor, ESTILO_EN_EL_PANEL)
      return
    }
    estilar(contenedor, ESTILO_SOBRE_EL_MAPA)
    // El tope de alto sobre el mapa depende de si además es la pantalla, y por eso
    // se escribe DESPUÉS del juego base: son 52vh de cajón descartable contra el
    // `calc(100vh - 112px)` medido de la pantalla. Ver {@link ALTO_COMO_PANTALLA}.
    contenedor.style.maxHeight = this._comoPantalla ? ALTO_COMO_PANTALLA : ALTO_COMO_CAJON
  },

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  _fijarAbierto(abierto, evento = null) {
    if (this._abierto === abierto) return
    this._abierto = abierto
    // El evento que ABRE el cajón, para que el guardián del clic fuera no lo cuente
    // como un clic fuera. Ver {@link _cerrarPorClicFuera}.
    this._eventoApertura = abierto ? evento : null
    if (this._contenedor) this._contenedor.style.display = abierto ? '' : 'none'
    if (!abierto) for (const fn of this._oyentes.cerrar) fn()
  },

  /**
   * El ✕.
   *
   * ── ⛔ CUANDO EL CAJÓN ES LA PANTALLA, CERRARLO ES SALIRSE ────────────────
   * Rework de UI · rebanada 4. Si el cajón no se puede descartar pero el ✕ sigue
   * ahí, el botón se queda mintiendo: pulsarlo no haría nada, y eso es peor que no
   * tenerlo (regla de oro 1). Y esconderlo tampoco vale, porque «salir del
   * diagnóstico» es una cosa que el usuario quiere poder hacer.
   *
   * Así que el ✕ conserva su significado —«quítame esto de delante»— y lo cumple
   * de la única forma que tiene sentido en una pantalla: **avisando de que quieren
   * salir**. A dónde se sale lo decide `app/contraste.js`, que es quien conoce la
   * autoridad de navegación; esta vista no sabe qué es un paso y no va a empezar.
   */
  _alPulsarCerrar(evento) {
    L.DomEvent.stop(evento)
    if (this._comoPantalla) {
      for (const fn of this._oyentes.salir) fn(evento)
      return
    }
    this._fijarAbierto(false)
  },

  /**
   * Cierra al pulsar fuera. **Sin `capture` y sin `preventDefault`**: ver la
   * cabecera. Un clic en el mapa cierra el cajón Y selecciona el lindero, en el
   * mismo gesto, que es lo que el usuario espera.
   *
   * ── ⚠️ EL CLIC QUE ABRE EL CAJÓN NO ES UN CLIC FUERA ────────────────────────
   * El CTA «Diagnosticar» del pie está FUERA del cajón, y su manejador corre en la
   * fase de destino — o sea ANTES de que el mismo evento llegue burbujeando hasta
   * este oyente del `document`. Sin esta guarda la secuencia era: abrir, y cerrar
   * cuatro microsegundos después, en el mismo gesto. El cajón parpadeaba y no se
   * abría nunca, y desde fuera parecía que el botón no hacía nada.
   *
   * Se compara la IDENTIDAD del evento y no una bandera de «recién abierto»: una
   * bandera se tragaría también el primer clic fuera cuando el cajón se abre por
   * código (sin ningún evento de por medio), y ese clic sí tiene que cerrarlo.
   *
   * Lo que NO se hace es que el llamante pare la propagación de su clic: eso
   * dejaría sordo a cualquier otro oyente del documento —hoy, el panel de ayuda de
   * la barra de edición— por un problema que es de este componente.
   *
   * ── ⚠️ UN GESTO DENTRO DE UN `<dialog>` NO ES UN GESTO EN EL MAPA (F09) ─────
   * Ver {@link enDialogo}. Apareció al cablear F09 y es el mismo modo de fallo que
   * la mina del `<a download>` de F08: el clic sobre «Componer PDF» —que vive
   * dentro del diálogo «Preparar informe», o sea colgando del `<body>` y fuera de
   * este contenedor— burbujeaba hasta aquí, este guardián lo contaba como un clic
   * FUERA y cerraba el cajón **por debajo del modal**. El usuario no veía nada
   * raro hasta cerrar el diálogo: para entonces el cajón había desaparecido, el
   * contraste del mapa estaba borrado y el acuse de recibo del PDF se había
   * escrito en un `role="status"` que acababa de quedar en `display:none`.
   */
  _cerrarPorClicFuera(evento) {
    if (!this._abierto || !this._contenedor) return
    // ── ⛔ UNA PANTALLA NO SE CIERRA AL TOCAR EL MAPA (rebanada 4) ──────────
    // Medido en Chrome el 2026-08-05: **UN clic en el mapa cerraba el
    // diagnóstico**, y mirar el mapa es literalmente lo que se hace en esa
    // pantalla. Peor: una vez cerrado, el peldaño del rail no lo devolvía
    // —navegar al paso en el que ya estás no publica nada—, así que el rail
    // seguía marcando «Diagnóstico», el <h1> seguía diciendo «Diagnóstico de
    // encaje» y no había diagnóstico en ninguna parte.
    //
    // Y el mismo guardián se comía la APERTURA: llegar por el peldaño del rail
    // abría el cajón y este oyente lo cerraba en el mismo gesto, porque el clic
    // del rail no es el evento de apertura (la navegación no lleva eventos de
    // DOM, y no debe: criterio 1). Resultado medido: **el peldaño «Diagnóstico»
    // llevaba a una pantalla vacía, sin error y sin aviso.**
    //
    // Esta guarda no «arregla» el guardián: lo pone en su sitio. Cerrar al pulsar
    // fuera es comportamiento de cajón flotante, y sigue siendo lo correcto
    // mientras el cajón lo sea.
    if (this._comoPantalla) return
    if (evento === this._eventoApertura) {
      // Se consume: el SIGUIENTE clic fuera sí cierra.
      this._eventoApertura = null
      return
    }
    if (this._contenedor.contains(evento.target)) return
    if (enDialogo(evento.target)) return
    this._fijarAbierto(false)
  },

  /**
   * Cierra con `Escape`.
   *
   * La misma excepción del diálogo, y aquí es todavía más necesaria: `Escape` es
   * LA tecla de cerrar un modal, así que sin esta guarda cancelar el diálogo
   * «Preparar informe» cerraría además el cajón de debajo — dos cierres por una
   * tecla, y el segundo sin que nadie lo hubiera pedido.
   */
  _cerrarPorEscape(evento) {
    if (!this._abierto) return
    // Rebanada 4, y por lo mismo que el clic de fuera: Escape descarta un cajón
    // flotante, no una pantalla. Dejarlo vivo aquí dejaba la aplicación diciendo
    // «Diagnóstico» con la pantalla en blanco y sin forma de volver desde el rail.
    if (this._comoPantalla) return
    if (evento.key !== 'Escape') return
    if (enDialogo(evento.target)) return
    this._fijarAbierto(false)
  },

  _alCambiar() {
    for (const fn of this._oyentes.cambiar) fn()
  },

  /**
   * Pulsación de «Descargar informe de contraste».
   *
   * ⚠️ **No se llama a `L.DomEvent.stop`**, a diferencia del botón de cerrar, y es
   * la misma decisión que tomó `viewer/cajon-comprobacion.js`: parar la propagación
   * de este clic dejaría sordo a cualquier otro oyente del `document` —hoy, el
   * panel de ayuda de la barra de edición— por un problema que ni siquiera existe.
   * No existe porque el clic pasa igualmente por {@link
   * CajonDiagnostico._cerrarPorClicFuera}, que lo ve DENTRO del contenedor y no
   * cierra nada: `disableClickPropagation` no detiene el `click`, pero la
   * comprobación `contains` sí lo distingue.
   */
  _alPulsarDescargar(evento) {
    for (const fn of this._oyentes.descargar) fn(evento)
  },

  /**
   * Pulsación de «Preparar informe (PDF)». **Tampoco se llama a `L.DomEvent.stop`**,
   * y por lo mismo que en {@link CajonDiagnostico._alPulsarDescargar}: parar la
   * propagación dejaría sordo a cualquier otro oyente del `document` por un problema
   * que no existe, porque el guardián de clic-fuera ve el clic DENTRO del contenedor.
   *
   * El evento se pasa al oyente porque quien escucha va a abrir un diálogo con él, y
   * un diálogo abierto por un clic quiere saber cuál fue.
   */
  _alPulsarPreparar(evento) {
    for (const fn of this._oyentes.preparar) fn(evento)
  },
})

/**
 * El cajón del diagnóstico como control de Leaflet.
 *
 * ```js
 * const cajon = crearCajonDiagnostico({ mapa })
 * cajon.abrir()
 * cajon.pintar(diagnostico)
 * cajon.alCambiar(() => recalcular(cajon.registral(), cajon.clase()))
 * cajon.alDescargar(() => bajarInforme())    // el secundario del pie (F08)
 * cajon.alPreparar(() => abrirDialogo())     // el primario del pie (F09)
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa  El mapa del visor.
 * @param {string} [opciones.posicion='bottomleft']  Esquina de Leaflet. El defecto
 *   NO es arbitrario: `topleft` la ocupa el control de zoom —y hasta el 2026-08-05
 *   también la barra de edición de F06, que hoy vive centrada en el borde inferior,
 *   en una quinta esquina que `viewer/barra-edicion.js` le añade a Leaflet—,
 *   `topright` el control de capas y `bottomright` el de opacidad **y** la
 *   atribución. `bottomleft` es la única esquina libre del visor.
 * @param {((mensaje: string, detalle?: object) => void)|null} [opciones.alAvisar]
 *   Canal de aviso (regla de oro 1). Se resuelve y valida aunque no se use, que es
 *   el patrón obligatorio del visor.
 * @returns {{control: object, pintar: Function, abrir: Function, cerrar: Function,
 *   abierto: Function, registral: Function, clase: Function,
 *   reiniciarExpediente: Function, estado: Function, estadoInforme: Function,
 *   alCambiar: Function, alDescargar: Function, alPreparar: Function,
 *   alCerrar: Function, comoPantalla: Function, anfitrion: Function,
 *   alSalir: Function, destruir: Function}}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCajonDiagnostico({ mapa, posicion = 'bottomleft', alAvisar } = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearCajonDiagnostico: 'mapa' debe ser un mapa de Leaflet (con addControl/` +
        `removeControl/getContainer); recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearCajonDiagnostico: 'posicion' debe ser una cadena con una esquina de ` +
        `Leaflet; recibido ${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearCajonDiagnostico: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) aunque no se use.
  resolverAvisar(alAvisar)

  const control = new CajonDiagnostico({ position: posicion })
  mapa.addControl(control)
  // La esquina a la que hay que devolverlo si algún día deja de ser la pantalla.
  // Se lee AQUÍ y no en `onAdd` porque Leaflet cuelga el contenedor DESPUÉS de que
  // aquél devuelva, así que dentro todavía no tiene padre. Guardarla —en vez de
  // recalcularla con `map._controlCorners[posicion]`— evita depender de un campo
  // privado de Leaflet. Ver {@link CajonDiagnostico._reubicar}.
  control._esquina = control._contenedor === undefined ? null : control._contenedor.parentNode

  let destruido = false

  /**
   * Conmuta el tamaño de la superficie medida entre {@link ESCALA.DATO_XL} y
   * {@link ESCALA.DATO}.
   *
   * Existe porque el dato titular no puede ser incondicional: `_medida` recibe o
   * bien una cifra («40,04 m²») o bien `NO_CONSTA`, y **«No consta» a 30 px grita
   * una ausencia**. Un cajón que no tiene nada que decir no debe decirlo más alto
   * que uno que sí.
   *
   * ⚠️ No conmuta color, peso ni texto: solo el tamaño. Destacar la cifra por la
   * que existe la pantalla es JERARQUÍA, no juicio — la regla de oro 9 prohíbe
   * decir si el encaje es bueno, no prohíbe que el número más importante se lea
   * primero.
   *
   * @param {boolean} hayCifra
   */
  function destacarMedida(hayCifra) {
    control._medida.style.fontSize = hayCifra ? ESCALA.DATO_XL : ESCALA.DATO
  }

  /** Escribe el titular DESCRIPTIVO de §10.5. Ni «apta» ni «correcta». */
  function pintarTitular(d) {
    const medida = m2(d.superficie.medida)
    if (d.superficie.catastral === null) {
      control._titular.textContent = `Contraste con el parcelario — Medición de ${medida}.`
      return
    }
    control._titular.textContent =
      `Contraste con el parcelario — Medición de ${medida} frente a los ` +
      `${m2Entero(d.superficie.catastral)} del parcelario vigente.`
  }

  /** La tabla de los tres pares cruzados. */
  function pintarCruces(d) {
    const doc = control._doc
    const tabla = control._cruces
    tabla.replaceChildren()

    const thead = crear(doc, 'thead')
    const filaCabecera = crear(doc, 'tr')
    for (const texto of ['', 'Diferencia', 'Relativa']) {
      const th = crear(doc, 'th', null, texto)
      estilar(th, {
        textAlign: 'right',
        padding: '2px 4px',
        fontWeight: '600',
        color: '#64748B',
      })
      if (texto === '') th.style.textAlign = 'left'
      filaCabecera.append(th)
    }
    thead.append(filaCabecera)

    const tbody = crear(doc, 'tbody')
    for (const cruce of d.bandas.cruces) {
      const tr = crear(doc, 'tr')
      const rotulo = crear(
        doc,
        'td',
        null,
        `${ROTULO_BANDA[cruce.a]} − ${ROTULO_BANDA[cruce.b]}`,
      )
      estilar(rotulo, {
        padding: '2px 4px',
      })
      const absoluto = crear(doc, 'td', null, conSigno(cruce.absoluto, m2))
      const relativo = crear(doc, 'td', null, conSigno(cruce.relativo, porcentaje))
      for (const td of [absoluto, relativo]) {
        // SIN color de mérito: el mismo gris del resto del cromo. Un Δ en verde
        // cuando es pequeño y en rojo cuando es grande estaría dictaminando si la
        // discrepancia es tolerable, que es la decisión que no nos toca.
        estilar(td, {
          textAlign: 'right',
          padding: '2px 4px',
          fontVariantNumeric: 'tabular-nums',
        })
        tr.append(td)
      }
      tr.prepend(rotulo)
      tbody.append(tr)
    }

    tabla.append(thead, tbody)
  }

  /**
   * Una sección omitida. Escribe **el motivo que trae el diagnóstico**, ya redactado
   * en español: la vista no tiene su propia tabla de traducciones, que es lo que se
   * queda corto en silencio cuando el modelo añade un caso.
   */
  function textoOmitido(d, que) {
    const omision = d.omisiones.find((o) => o.que === que)
    return omision ? omision.motivo : NO_CONSTA
  }

  function pintarMetricas(d) {
    control._solape.textContent =
      d.solape === null
        ? textoOmitido(d, 'solape')
        : `${m2(d.solape.area)} · ${porcentaje(d.solape.relativo)} de la mayor`

    control._centroides.textContent =
      d.centroides === null ? textoOmitido(d, 'centroides') : metros(d.centroides.distancia)

    if (d.desviacion === null || d.desviacion.maxima === null) {
      control._desviacion.textContent = textoOmitido(d, 'desviacion')
    } else {
      const max = d.desviacion.maxima
      control._desviacion.textContent =
        `${metros(max.maxima)} · lindero ${max.indice + 1}` +
        (max.recinto > 0 ? ` del hueco ${max.recinto}` : '')
    }
  }

  /**
   * La invasión. **La única sección con ámbar** (spec §10.4), y la única donde «no se
   * ha consultado» y «no hay» tienen que escribirse distinto.
   */
  function pintarInvasion(d) {
    const doc = control._doc
    const caja = control._invasion
    caja.replaceChildren()

    const { consultado, invasiones, descartadas } = d.invasion

    if (!consultado) {
      // ⛔ NUNCA «no hay invasión». Son afirmaciones opuestas y la segunda
      // tranquiliza: es el error silencioso más caro que podría cometer esta vista.
      caja.append(
        crear(
          doc,
          'p',
          null,
          'Invasión a colindantes: no se ha consultado. Hay que traer las parcelas vecinas del Catastro.',
        ),
      )
      estilar(caja.firstChild, {
        margin: '0',
        fontSize: '12px',
        color: '#64748B',
      })
      return
    }

    if (invasiones.length === 0) {
      const p = crear(doc, 'p', null, 'Invasión a colindantes: ninguna.')
      estilar(p, {
        margin: '0',
        fontSize: '12px',
        color: '#64748B',
      })
      caja.append(p)
    } else {
      const titulo = crear(doc, 'p', null, 'Invasión a colindantes')
      estilar(titulo, {
        margin: '0 0 4px',
        fontWeight: '600',
        color: '#92400E',
      })
      caja.append(titulo)

      const ul = crear(doc, 'ul')
      estilar(ul, {
        margin: '0',
        paddingLeft: '18px',
      })
      for (const h of invasiones) {
        const li = crear(
          doc,
          'li',
          null,
          `${h.refcat === null ? 'Parcela sin referencia' : h.refcat}: ${m2(h.area)}`,
        )
        // El ámbar, aquí y en ningún otro sitio del cajón.
        li.style.color = '#92400E'
        ul.append(li)
      }
      caja.append(ul)
    }

    if (descartadas.length > 0) {
      // Regla de oro 1: lo descartado se puede ver. Son astillas de redondeo en
      // linderos compartidos —sobre la parcela real hay dos— y quien desconfíe del
      // criterio tiene el área y el grosor delante.
      const total = descartadas.reduce((s, x) => s + x.area, 0)
      const p = crear(
        doc,
        'p',
        null,
        `Se han descartado ${descartadas.length} solape(s) de ${m2(total)} por caber dentro ` +
          `del redondeo al centímetro con el que el Catastro publica sus coordenadas: son el ` +
          `mismo lindero escrito dos veces, no superficie.`,
      )
      estilar(p, {
        margin: '4px 0 0',
        // Era 11 px suelto y lo cazó el guardián de la escala (2026-08-10). Sube a
        // APUNTE: es una nota al pie, del mismo rango que la del margen de
        // identidad, y no había ninguna razón para que midiera un píxel menos.
        fontSize: ESCALA.APUNTE,
        // Era `#94A3B8`: **2,6:1 sobre blanco**, o sea que no pasa AA por bastante.
        // Que la nota esté deliberadamente apagada no autoriza a hacerla ilegible —
        // y menos ésta, que existe por la regla de oro 1 (lo descartado se puede
        // ver). `#64748B` da 4,55:1 y sigue leyéndose como apunte menudo.
        color: '#64748B',
      })
      caja.append(p)
    }
  }

  /**
   * El margen, SIEMPRE con su etiqueta, y la clase rotulada si es deducida.
   *
   * ── ⚠️ ESTA FUNCIÓN NO ESCRIBE EN EL `<select>` ────────────────────────────
   * Lo hacía —`control._clase.value = d.margen.clase`— y era un LAVADO: el
   * `<select>` significa «esto lo ha elegido una persona», y volcar en él la clase
   * DEDUCIDA la convertía en elegida al primer repintado. La siguiente vuelta,
   * `clase()` devolvía «RUSTICA» como si alguien la hubiera marcado, `diagnosticar`
   * la recibía por `clase` y no por `refcat`, y el rótulo «Clase propuesta por la
   * aplicación» desaparecía solo. La propuesta se quedaba en el expediente sin que
   * nadie la hubiera aceptado.
   *
   * Es exactamente la doctrina de `app/cableado-catastro.js#deducir()`, que rellena
   * el campo de la referencia pero NO la mete en el modelo: «así `parcela.refcat`
   * significa SIEMPRE "esto lo afirma el usuario" y nunca "esto lo adivinó un
   * servicio"». La propuesta se dice, con todas las letras, en el renglón de abajo.
   *
   * Quien sí puede tocar esos dos campos es {@link reiniciarExpediente}, y solo
   * cuando entra una parcela distinta.
   */
  function pintarMargen(d) {
    if (d.margen === null) {
      control._margen.textContent = textoOmitido(d, 'margen')
      return
    }

    const cifras =
      `${ETIQUETA_MARGEN}: ±${metros(d.margen.perimetroM)} de perímetro y ` +
      `${porcentaje(d.margen.superficieRelativo)} de superficie.`
    // Si la clase la propuso la app y no una persona, se DICE. Presentar una
    // deducción como un dato sería colar un criterio nuestro en el expediente.
    control._margen.textContent = d.margen.deducida
      ? `${cifras} Clase propuesta por la aplicación: ${d.margen.criterio}`
      : cifras
  }

  /**
   * El `disabled` de LOS DOS botones del informe, sus vestimentas y su renglón: las
   * tres cosas en una sola función, para que no puedan divergir. Es el mismo recurso
   * —y por lo mismo— que `apagarPrimario` en `viewer/cajon-comprobacion.js`.
   *
   * La regla es una sola línea: **el informe se puede componer ⟺ el cajón está
   * enseñando un diagnóstico**. No hace falta que nadie se la cuente al cajón
   * desde fuera; la sabe él, porque es quien recibe el POJO en `pintar`.
   *
   * ── POR QUÉ LOS DOS BOTONES PASAN POR AQUÍ Y NO POR DOS GATES ───────────────
   * Porque la condición es LA MISMA —y el motivo también—, y dos gates paralelos
   * son dos oportunidades de que uno se quede encendido con el otro apagado, sin
   * síntoma: un botón encendido que compone un informe de cifras que ya no están
   * es exactamente el error silencioso que este gate existe para impedir. El PDF
   * lleva ADEMÁS un plano y un pie de firma, pero eso no cambia la condición: sin
   * medidas no hay nada que maquetar.
   *
   * ── POR QUÉ AL ENCENDER SOLO SE BORRA EL MOTIVO, Y NO EL RENGLÓN ────────────
   * `pintar` corre en CADA operación acabada —o sea, en cada vértice que F06 mueva
   * con el cajón abierto—. Vaciar el renglón sin condición se llevaría por delante
   * el «Descargado «contraste_….txt».» que el cableado acaba de escribir, un
   * instante después de haberlo puesto. Es exactamente la regla que
   * `app/cableado-diagnostico.js#refrescarBoton` ya defiende para el renglón del
   * CTA, y aquí se aplica al revés: se reconoce el motivo por su texto y se borra
   * solo él.
   *
   * Al APAGAR sí se pisa lo que hubiera: un desenlace anterior habla de un
   * diagnóstico que ya no está, y dejarlo escrito junto a un botón gris haría creer
   * que basta con volver a pulsarlo.
   *
   * @param {boolean} hayDiagnostico
   */
  function gateInforme(hayDiagnostico) {
    if (!control._descargar || !control._preparar || !control._estadoInforme) return
    control._preparar.disabled = !hayDiagnostico
    control._descargar.disabled = !hayDiagnostico
    estilar(
      control._preparar,
      hayDiagnostico ? BOTON_INFORME.PRIMARIO.ENCENDIDO : BOTON_INFORME.PRIMARIO.APAGADO,
    )
    estilar(
      control._descargar,
      hayDiagnostico ? BOTON_INFORME.SECUNDARIO.ENCENDIDO : BOTON_INFORME.SECUNDARIO.APAGADO,
    )
    if (!hayDiagnostico) {
      control._estadoInforme.textContent = MOTIVO_INFORME_SIN_DIAGNOSTICO
      return
    }
    if (control._estadoInforme.textContent === MOTIVO_INFORME_SIN_DIAGNOSTICO) {
      control._estadoInforme.textContent = ''
    }
  }

  return {
    control,

    /**
     * Pinta el diagnóstico. `null` deja el cajón en blanco (sin cerrarlo).
     *
     * @param {object|null} d  Lo que devuelve `diagnostico/parcela.js#diagnosticar`.
     */
    pintar(d) {
      if (destruido || !control._contenedor) return
      if (d === null || d === undefined) {
        control._titular.textContent = 'Sin diagnóstico.'
        destacarMedida(false)
        for (const el of [control._medida, control._catastral, control._solape,
          control._centroides, control._desviacion]) {
          el.textContent = NO_CONSTA
        }
        control._cruces.replaceChildren()
        control._invasion.replaceChildren()
        control._margen.textContent = ''
        // Sin cifras no hay informe que componer, y el botón lo dice.
        gateInforme(false)
        return
      }

      pintarTitular(d)
      destacarMedida(d.superficie.medida !== null && d.superficie.medida !== undefined)
      control._medida.textContent = m2(d.superficie.medida)
      control._catastral.textContent = m2Entero(d.superficie.catastral)
      // El campo de la registral NO se sobrescribe si el usuario está escribiendo en
      // él: pisar lo que alguien teclea es la forma más rápida de que no vuelva a
      // usarse un formulario. Solo se rellena cuando está vacío y el dato existe.
      if (control._registral.value === '' && d.superficie.registral !== null) {
        control._registral.value = String(d.superficie.registral)
      }
      pintarCruces(d)
      pintarMetricas(d)
      pintarInvasion(d)
      pintarMargen(d)
      // Hay diagnóstico enseñándose: el informe ya se puede llevar.
      gateInforme(true)
    },

    /**
     * Abre el cajón.
     *
     * @param {Event|null} [evento=null]  El evento de DOM que lo está abriendo, si
     *   lo hay. Se pasa para que el guardián del clic fuera no cuente como «clic
     *   fuera» el mismo clic que ha abierto el cajón — el CTA vive en el pie, o sea
     *   fuera. Ver {@link CajonDiagnostico._cerrarPorClicFuera}. Abrir por código
     *   (sin evento) es igual de válido: entonces no hay nada que ignorar.
     */
    abrir(evento = null) {
      if (!destruido) control._fijarAbierto(true, evento)
    },

    cerrar() {
      if (!destruido) control._fijarAbierto(false)
    },

    abierto() {
      return !destruido && control._abierto === true
    },

    /**
     * ⭐ **EL INTERRUPTOR DE LA REBANADA 4: ¿esto es un cajón o es la pantalla?**
     *
     * Sin argumento, LEE. Con un booleano, ESCRIBE y devuelve el valor aplicado.
     *
     * Cambia tres cosas a la vez porque las tres son la misma pregunta:
     *
     *   1. **Ya no se descarta.** Ni al pulsar fuera, ni con Escape. Ver
     *      {@link CajonDiagnostico._cerrarPorClicFuera}, donde está medido lo que
     *      pasaba: un clic en el mapa borraba el diagnóstico, y el peldaño del
     *      rail llevaba a una pantalla vacía porque el guardián se comía la
     *      apertura.
     *   2. **El ✕ pasa a pedir la SALIDA** en vez de vaciar la pantalla
     *      ({@link CajonDiagnostico._alPulsarCerrar} y {@link alSalir}).
     *   3. **Deja de caber en 52vh.** Medido a 1280×720: el contenido son 650 px
     *      y el cajón enseñaba 372, o sea **278 px (42,77 %) bajo el pliegue**,
     *      con los dos botones del informe 207 y 248 px por debajo del borde. Un
     *      cajón que tapa una esquina del mapa puede permitirse esconder; una
     *      pantalla, no. El tope nuevo es {@link ALTO_COMO_PANTALLA}, y ese
     *      número está MEDIDO.
     *
     * ⚠️ **NO conoce la navegación**, igual que `viewer/edicion.js#activa`: nace
     * en `false` y quien lo conmuta es `app/contraste.js`. Un visor montado a
     * pelo se comporta exactamente como el cajón de F07.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    comoPantalla(valor) {
      if (destruido) return false
      if (valor === undefined) return control._comoPantalla === true
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `comoPantalla: 'valor' debe ser booleano; recibido ${typeof valor}. Sin argumento LEE.`,
        )
      }
      if (valor === control._comoPantalla) return control._comoPantalla
      control._comoPantalla = valor
      // Y con eso puede cambiar de SITIO, no solo de tamaño: si hay anfitrión, ser
      // la pantalla significa vivir en el panel. Ver {@link _reubicar}.
      control._reubicar()
      // El rótulo del ✕ deja de mentir a quien no ve la pantalla: en modo pantalla
      // ese botón se sale del diagnóstico, no cierra un cajón.
      if (control._botonCerrar) {
        control._botonCerrar.setAttribute(
          'aria-label',
          valor ? 'Salir del diagnóstico' : 'Cerrar el diagnóstico',
        )
      }
      return control._comoPantalla
    },

    /**
     * ⭐ **DÓNDE VIVE EL DIAGNÓSTICO CUANDO ES LA PANTALLA** (2026-08-05).
     *
     * Sin argumento, LEE. Con un elemento, lo adopta como anfitrión; con `null`,
     * devuelve el cajón a la esquina del mapa. Devuelve el anfitrión aplicado.
     *
     * ── QUÉ CAMBIA, Y POR QUÉ SE CAMBIA ────────────────────────────────────
     * La cabecera de este fichero explica —con las cifras de F07— por qué el
     * diagnóstico no entró en el panel: allí se repartía una altura FIJA entre
     * bloques fijos que se enseñaban TODOS A LA VEZ, así que un bloque más dejaba
     * la caja de vértices en 64 px. **Esa razón caducó con el rework de UI**: desde
     * T6 el panel enseña UNA pantalla cada vez, y en la de Diagnóstico ni la tabla
     * de vértices ni las tres vías de Entrada compiten por el sitio — el panel
     * entero está libre.
     *
     * Lo que quedaba en pie era una ventana flotante que TAPABA el mapa justo en la
     * pantalla que se lee mirando el mapa: las manchas del solape, la cota de la
     * desviación máxima y el lindero invadido son la mitad del diagnóstico, y el
     * cajón se ponía encima de ellos. En el panel se leen las cifras Y se ve lo que
     * señalan, que era el objetivo desde el principio.
     *
     * ── LO QUE **NO** CAMBIA, Y ES LA MITAD DEL VALOR DE ESTA API ───────────
     * Este módulo sigue sin saber qué es un panel, ni un paso, ni la cáscara: le
     * dan un nodo y se cuelga de él. Nace en `null`, así que un visor montado a
     * pelo —los tests, `npm run dev` sobre un mapa suelto— se comporta EXACTAMENTE
     * como el cajón de F07. Es la misma doctrina que {@link comoPantalla} y que
     * `viewer/edicion.js#activa`.
     *
     * ⚠️ **No abre ni cierra nada.** Mudar de sitio y estar abierto son cosas
     * distintas: quien decide lo segundo sigue siendo `app/cableado-diagnostico.js`
     * por el CTA y `app/contraste.js` por el paso.
     *
     * @param {HTMLElement|null} [nodo]
     * @returns {HTMLElement|null}
     * @throws {TypeError}  Contrato del programador: cualquier cosa que no sea un
     *   elemento del DOM ni `null`. Un `undefined` colado aquí sería una LECTURA
     *   silenciosa, y la pantalla se quedaría sobre el mapa sin que nada lo dijera.
     */
    anfitrion(nodo) {
      if (destruido) return null
      if (nodo === undefined) return control._anfitrion
      if (nodo !== null && !(nodo && typeof nodo === 'object' && nodo.nodeType === 1)) {
        throw new TypeError(
          `anfitrion: 'nodo' debe ser un elemento del DOM (donde colgar el diagnóstico cuando ` +
            `es la pantalla) o null para devolverlo a la esquina del mapa; recibido ` +
            `${typeof nodo}. Sin argumento LEE.`,
        )
      }
      control._anfitrion = nodo
      control._reubicar()
      return control._anfitrion
    },

    /**
     * Avisa de que han pulsado el ✕ **estando en modo pantalla**, o sea de que
     * quieren SALIRSE del diagnóstico. En modo cajón este canal no dispara nunca:
     * allí el ✕ cierra, que es lo que dice, y quien quiera enterarse tiene
     * {@link alCerrar}.
     *
     * @param {Function} fn
     * @returns {() => void}  Baja.
     */
    alSalir(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alSalir: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.salir.add(fn)
      return () => control._oyentes.salir.delete(fn)
    },

    /**
     * La superficie registral tecleada, o `null` si el campo está vacío o no es un
     * número. **`null` y no 0**: un campo vacío significa «no consta», y un 0 diría
     * que la escritura declara cero metros.
     */
    registral() {
      if (destruido || !control._registral) return null
      const texto = control._registral.value.trim()
      if (texto === '') return null
      const valor = Number(texto.replace(',', '.'))
      return Number.isFinite(valor) ? valor : null
    },

    /** La clase de suelo elegida, o `null` si nadie ha elegido. */
    clase() {
      if (destruido || !control._clase) return null
      return control._clase.value === '' ? null : control._clase.value
    },

    /**
     * Vacía los DOS campos del expediente (registral y clase). **El único camino
     * por el que estos dos nodos se escriben desde código**, y existe para un solo
     * caso: ha entrado una parcela DISTINTA.
     *
     * No se hace en `pintar` porque `pintar` corre en cada operación de edición, y
     * borrar ahí la superficie de la escritura cada vez que se mueve un vértice
     * sería insufrible. Y no se hace solo dentro de este módulo porque el cajón no
     * sabe qué parcela hay: eso lo sabe `app/cableado-diagnostico.js`, que es quien
     * escucha al store.
     *
     * No dispara `alCambiar`: no lo ha cambiado el usuario, y avisar provocaría un
     * recálculo redundante justo antes del que va a hacer el llamante de todas
     * formas.
     */
    reiniciarExpediente() {
      if (destruido) return
      if (control._registral) control._registral.value = ''
      if (control._clase) control._clase.value = ''
    },

    /** Escribe el renglón de estado (`role="status"`). */
    estado(texto) {
      if (!destruido && control._estado) control._estado.textContent = texto
    },

    /**
     * Escribe el renglón de PROCEDENCIA: de quién es la geometría que se está
     * contrastando (rework de UI · T9).
     *
     * ⚠️ **El texto llega HECHO.** Se compone en `app/contraste.js#textoProcedencia`
     * a partir de `parcela.origen` y del modo de la navegación, porque los dos son
     * del dominio y esta vista no importa `model/` — la misma doctrina por la que
     * `Comprobacion.dialecto` viaja con su etiqueta ya redactada.
     *
     * Una cadena vacía (o `null`) **oculta el renglón**, no lo deja en blanco: no
     * tener nada que decir tiene que costar 0 px en un cajón que declara
     * `maxHeight: 52vh`.
     *
     * @param {string|null} texto
     */
    procedencia(texto) {
      if (destruido || !control._procedencia) return
      const limpio = typeof texto === 'string' ? texto.trim() : ''
      control._procedencia.textContent = limpio
      control._procedencia.style.display = limpio === '' ? 'none' : ''
    },

    /**
     * Escribe el renglón del PIE del informe (`role="status"`), que es un nodo
     * DISTINTO del de arriba: aquel cuenta lo que le pasa a lo que se está
     * enseñando (las vecinas que no llegaron, un fallo del cálculo) y este, el
     * desenlace de pulsar cualquiera de los dos botones del informe —el de texto o
     * el del PDF—, que comparten renglón por lo mismo que comparten gate: los apaga
     * y los enciende el mismo hecho. Se llaman distinto
     * (`cajon-diagnostico` / `informe-contraste`) por la misma razón por la que
     * ninguno se llama `diagnostico`: ver el aviso de {@link SELECTOR}.
     *
     * @param {string} texto
     */
    estadoInforme(texto) {
      if (!destruido && control._estadoInforme) control._estadoInforme.textContent = texto
    },

    /**
     * Se suscribe a los cambios del usuario en la registral o en la clase. Devuelve
     * la BAJA. Varios oyentes, como `alColindantes` de F05: un `= fn` desengancharía
     * al primero en silencio.
     */
    alCambiar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alCambiar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.cambiar.add(fn)
      return () => control._oyentes.cambiar.delete(fn)
    },

    /**
     * Se suscribe a la pulsación de «Descargar informe de contraste». Devuelve la
     * BAJA. Varios oyentes, igual que {@link alCambiar}: un `= fn` desengancharía
     * al primero en silencio.
     *
     * El cajón **no compone ni entrega nada**: solo avisa. Quien escucha es
     * `app/cableado-diagnostico.js`, que sabe qué diagnóstico se está enseñando,
     * qué parcela hay en el store, qué hora es y cómo se baja un fichero.
     */
    alDescargar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alDescargar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.descargar.add(fn)
      return () => control._oyentes.descargar.delete(fn)
    },

    /**
     * Se suscribe a la pulsación de «Preparar informe (PDF)» —el primario del pie—.
     * Devuelve la BAJA. Varios oyentes, igual que {@link alDescargar}.
     *
     * El cajón **no compone, no maqueta y no baja nada**: solo avisa, exactamente
     * igual que con el de texto. El PDF lo arma `report/pdf-parcela.js` con el plano
     * de `report/canvas.js` y el pie de firma que recoge el diálogo de
     * `app/dialogo-informe.js`; quien los orquesta es el cableado, que sabe qué
     * diagnóstico se está enseñando, qué parcela hay en el store y qué hora es.
     */
    alPreparar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alPreparar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.preparar.add(fn)
      return () => control._oyentes.preparar.delete(fn)
    },

    /** Se suscribe al cierre (botón, clic fuera o Escape). Devuelve la BAJA. */
    alCerrar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alCerrar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.cerrar.add(fn)
      return () => control._oyentes.cerrar.delete(fn)
    },

    /**
     * Quita el control del mapa —lo que dispara `onRemove` y con él la retirada de
     * los oyentes del `document`— y deja el módulo inerte. IDEMPOTENTE.
     */
    destruir() {
      if (destruido) return
      destruido = true
      control._oyentes.cerrar.clear()
      control._oyentes.cambiar.clear()
      control._oyentes.descargar.clear()
      control._oyentes.preparar.clear()
      control._oyentes.salir.clear()
      control.remove()
    },
  }
}
