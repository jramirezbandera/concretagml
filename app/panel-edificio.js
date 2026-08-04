// app/panel-edificio.js — F11 · T2.5. El PANEL de la rama EDIFICIO.
//
// Once fases después, esta aplicación solo sabía de parcelas. F11 le añade una
// segunda rama, y esto es su panel entero: el selector de modelo, la referencia
// catastral, la lista de partes y **dos `<dialog>`** —el reparto por capas de un
// DXF y los siete atributos semánticos del edificio—.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ───────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. **No sabe qué es un DXF, ni
// qué es el WFS del Catastro, ni cómo se muta un `Edificio`.** Recibe POJOs y
// emite intenciones (`alAccion`); quien encadene eso es `app/cableado-edificio.js`
// (T3.2), que es el que tiene las mutaciones de `edificio/mutaciones.js` y el
// store. Mismo reparto que `app/dialogo-expediente.js` con `app/cableado-expediente.js`.
//
// Corolario: **no sale por el barrel raíz** `index.js`. Toca `document`, y el
// barrel lo carga el proyecto Vitest `node`, que no tiene DOM. Lo vigila
// `test/contrato.test.js`, que lo nombra por su fichero (T3.1).
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ POR QUÉ LOS SIETE ATRIBUTOS SEMÁNTICOS NO ESTÁN EN EL PANEL (desviación 12)
// ═════════════════════════════════════════════════════════════════════════════
// Porque no caben, y está MEDIDO (T0.3·1, 2026-08-03, Chrome 1440×900):
//
//     los siete apilados ................................ 370,56 px
//     los siete en su forma más densa todavía editable ... 150,00 px
//     presupuesto del panel, con la ficha del pie a 4 pares 80,00 px
//     presupuesto del panel, con la ficha de hoy ..........  4,00 px
//
// No entran en ninguna maqueta. Y con la maqueta apilada el desastre tiene DOS
// víctimas en vez de una: `#avisos` se queda en **0 px de contenido aunque lleve
// 12 tarjetas dentro** — el desastre de F06 repetido, cuando el bloque «Edición»
// dejó la caja de vértices en 64 px.
//
// Salen a un `<dialog>`, con los tres precedentes de la casa: F06 sacó la edición
// a una barra flotante, F07 el diagnóstico a un cajón sobre el mapa, F09 el
// informe a un modal. El botón que lo abre es un `.gml-boton--menudo` en el
// `.gml-rotulo-fila`, que es el hueco de **coste 0 px** que estrenó F08 con
// «Abrir un GML…» y repitió F10 con «Expediente».
//
// ⭐ **Y el criterio de aceptación 1 se cumple igual, y mejor.** La ficha pide que
// «el selector oculte los atributos semánticos en modo simplificado». Aquí, en
// SIMPLIFICADO, **no existen ni el bloque ni el botón que lo abre**: no están
// ocultos, no están. Se puede señalar con el dedo, y hay un `it` que lo hace.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ POR QUÉ TODOS LOS `data-*` LLEVAN APELLIDO (`refcat-edificio`, no `refcat`)
// ═════════════════════════════════════════════════════════════════════════════
// **MEDIDO (T0.3·6):** con las dos ramas en el DOM,
// `document.querySelector('[data-campo="refcat"]')` devuelve **siempre el nodo de
// parcela**, también **cuando la sección de parcela está `hidden`**, porque manda
// el orden del documento y `index.html` va primero. El cableado de edificio
// leería y escribiría en un campo invisible de la otra rama, y la referencia
// catastral recién traída del Catastro acabaría en un sitio que el usuario no ve.
//
// Regla dura del contrato K.1, y este módulo la cumple entera: **ningún
// `data-campo`, `data-accion`, `data-estado`, `data-ficha` ni `data-procedencia`
// de aquí puede repetirse con los de `index.html`.** Hay un test que recorre
// `index.html` de verdad, no que lo supone.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ JAMÁS `replaceChildren` — Y AQUÍ SE CUMPLE A LA LETRA
// ═════════════════════════════════════════════════════════════════════════════
// Riesgo 1 de la fase, y ya no es un argumento: es una medición (T0.3·5). Con
// `hidden` el nodo sigue conectado, conserva su valor y **sus oyentes siguen
// disparando**. Con `replaceChildren` la referencia queda **huérfana, escribible
// y MUDA**: `isConnected:false`, escribir en ella **no lanza**, sus oyentes
// **siguen disparando**, y el dato acaba fuera del documento mientras el usuario
// ve el campo vacío. Hay **30 nodos de `app/` resueltos una sola vez** con
// `nodo(...)` en el montaje.
//
// Este módulo no llama a `replaceChildren` ni una vez —ver {@link vaciar}—, y su
// invariante es más fuerte que eso: **los nodos de {@link SELECTOR} se fabrican
// UNA vez y no se sustituyen nunca** mientras el módulo viva. Los únicos nodos
// que nacen y mueren son las filas de las dos listas, que por eso están fuera de
// `SELECTOR` (ver {@link selectorParte} y {@link selectorCapa}) — mismo reparto
// que `selectorFila` en el diálogo de F10.
//
// La única excepción, y es la que el criterio 1 exige, son los nodos de
// {@link SELECTOR_COMPLETO}: el botón «Atributos» y el `<dialog>` que abre nacen
// y mueren con el modelo. **Están declarados aparte justo para que el cableado
// sepa que a ésos no puede agarrarse en el montaje.**
//
// ═════════════════════════════════════════════════════════════════════════════
// EL DIÁLOGO DE CAPAS: SE OFRECE EL REPARTO, NO SE IMPONE (decisión 5)
// ═════════════════════════════════════════════════════════════════════════════
// «Cada polilínea entra como una parte independiente» al pie de la letra produce
// **25 partes** con `UTM.dxf`, dieciséis de ellas cajetín, marco y leyenda. Y hay
// un dato que remata el argumento (T0.2·2): **en `UTM.dxf` la parcela de verdad
// está en la capa `0`, NO en la capa llamada `PARCELA`** — el anillo de la capa
// `0` comparte 12 de 12 vértices con `PARCELA.txt`, la verdad externa de F01.
// **Elegir la capa por su nombre falla en el único plano real que tiene este
// proyecto.** Por eso:
//
//   · los nombres de capa se enseñan **LITERALES**, sin bajar a minúsculas y en
//     monoespaciada: el usuario los coteja contra lo que ve en su CAD;
//   · **no se marca ninguna por omisión**, y «Aplicar» nace apagado **con el
//     motivo escrito al lado** (regla de oro 1). Marcar «la que parece» sería
//     justo la adivinanza que este diálogo existe para no hacer.
//
// ═════════════════════════════════════════════════════════════════════════════
// EL STORE NACE VACÍO, ASÍ QUE EL PANEL TIENE QUE DECIR QUÉ HACER
// ═════════════════════════════════════════════════════════════════════════════
// El segundo store nace en `null` a propósito (contrato H): **no se inventa un
// edificio de demostración**, misma regla por la que `demo-datos.js` no le añade
// un patio a la parcela real. Pero entonces lo primero que se ve de esta rama es
// una lista de partes vacía, y una lista vacía se lee como «esto no ha cargado».
// De ahí {@link SIN_PARTES}: enumera **las cinco vías de entrada** en el mismo
// renglón en el que dice que todavía no hay nada. Es la misma decisión que
// `.gml-avisos-vacio` en la rama de parcela.
//
// ═════════════════════════════════════════════════════════════════════════════
// NI UNA REGLA DE CSS, NI DESDE JS (regla de oro 9 incluida)
// ═════════════════════════════════════════════════════════════════════════════
// Todo el cromo es de `estilos/app.css`, sección «Edificio: la segunda rama de la
// aplicación (F11 · T1.6)», escrita **en paralelo con este fichero y sin verlo**,
// contra el contrato K. Aquí no se escribe ni un `style` en línea: la lección
// MEDIDA de F08 (guion 10) es que un estilo en línea GANA a la hoja, así que un
// `font: 'inherit'` de conveniencia deja muertas las reglas del fichero sin que
// nada se queje, y en jsdom no hay cascada que lo delate. Hay un `it` que lo
// afirma sobre TODOS los nodos de este módulo.
//
// Y ninguna clase de {@link CLASE} lleva juicio: no hay `--ok`, ni `--error`, ni
// `--exito`. Es la regla de oro 9 aplicada al gancho de CSS, igual que en los dos
// diálogos anteriores. Tampoco lo llevan los TEXTOS, y eso también tiene su `it`.
//
// ⚠️ Los cuatro rótulos de {@link ROTULO_ESTADO_CONSERVACION} —«Funcional»,
// «En construcción», «Ruinoso», «Derruido»— NO son una excepción a la regla 9:
// son el vocabulario declarado de `ESTADO_CONSERVACION` (que es el
// `conditionOfConstruction` de INSPIRE), o sea el VALOR de un campo que el
// usuario elige, no una calificación que la aplicación emita sobre nada.

import {
  ATRIBUTOS_COMPLETO,
  ESTADO_CONSERVACION,
  MODELO_EDIFICIO,
} from '../model/edificio.js'
import { ROTULO_ATRIBUTO } from '../edificio/mutaciones.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── El contrato de marcado con `estilos/app.css` y con el cableado ───────────

/**
 * Clases CSS que pone este módulo. **Congeladas y son contrato**: la sección
 * «Edificio: la segunda rama de la aplicación» de `estilos/app.css` se escribió
 * contra estos literales, sin ver este fichero.
 *
 * ⚠️ Las del diálogo de reparto se llaman `gml-dialogo-capas-*` y **no
 * `gml-capa-*`**: en este proyecto «capa» ya significa otra cosa —`viewer/capas.js`
 * fabrica `.gml-capa-blanca` para un pane de Leaflet—, y dos familias que empiezan
 * igual y hablan de cosas distintas se acaban confundiendo en un
 * `querySelectorAll`. Aquí «capa» es la del código de grupo 8 de un DXF.
 *
 * @readonly
 */
export const CLASE = Object.freeze({
  BLOQUE: 'gml-bloque--edificio',
  BLOQUE_PARTES: 'gml-bloque--partes',

  OPCIONES: 'gml-opciones',
  OPCION: 'gml-opcion',
  OPCION_APUNTE: 'gml-opcion-apunte',

  PARTES: 'gml-partes',
  PARTE: 'gml-parte',
  PARTE_NOMBRE: 'gml-parte-nombre',
  PARTE_DATO: 'gml-parte-dato',
  PARTES_VACIO: 'gml-partes-vacio',

  DIALOGO_CAPAS: 'gml-dialogo-capas',
  CAPAS_CUERPO: 'gml-dialogo-capas-cuerpo',
  CAPAS_TITULO: 'gml-dialogo-capas-titulo',
  CAPAS_INTRO: 'gml-dialogo-capas-intro',
  CAPAS_FILA: 'gml-dialogo-capas-fila',
  CAPAS_NOMBRE: 'gml-dialogo-capas-nombre',
  CAPAS_CUENTA: 'gml-dialogo-capas-cuenta',
  CAPAS_PIE: 'gml-dialogo-capas-pie',
  CAPAS_ESTADO: 'gml-dialogo-capas-estado',

  DIALOGO_ATRIBUTOS: 'gml-dialogo-atributos',
  ATRIBUTOS_CUERPO: 'gml-dialogo-atributos-cuerpo',
  ATRIBUTOS_TITULO: 'gml-dialogo-atributos-titulo',
  ATRIBUTOS_INTRO: 'gml-dialogo-atributos-intro',
  ATRIBUTOS_REJILLA: 'gml-dialogo-atributos-rejilla',
  ATRIBUTOS_PIE: 'gml-dialogo-atributos-pie',
  ATRIBUTOS_ESTADO: 'gml-dialogo-atributos-estado',
})

/**
 * Clases de la aplicación que este módulo REUTILIZA en vez de inventar
 * equivalentes. Se declaran —y el guardián de clases las cuenta— porque si no, un
 * test que exigiera «solo las de {@link CLASE}» saldría rojo y la reacción natural
 * sería duplicar el cromo, que es justo lo que no se quiere. Mismo criterio, y
 * casi la misma lista, que `app/dialogo-expediente.js#CLASE_REUTILIZADA`.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLASE_REUTILIZADA = Object.freeze([
  'gml-bloque',
  'gml-rotulo',
  'gml-rotulo-fila',
  'gml-rotulo-acciones',
  'gml-campo',
  'gml-campo-etiqueta',
  'gml-campo-fila',
  'gml-entrada',
  'gml-mono',
  'gml-boton',
  'gml-boton--primario',
  'gml-boton--secundario',
  'gml-boton--menudo',
  'gml-accion-estado',
  'gml-procedencia',
])

/**
 * Las intenciones que este panel emite. **Son el vocabulario con el que habla con
 * el cableado (T3.2)**, y casi todas valen además como `data-accion` en el
 * marcado: una sola cadena por concepto, así que un botón no puede quedar
 * enganchado a una acción que nadie atiende.
 *
 * ⚠️ {@link ACCION}.CAMBIAR_MODELO es la única que **no tiene botón**: sale del
 * `change` de los radios `[data-campo="modelo-edificio"]`. Se declara aquí igual
 * porque para el cableado es una intención más, y tener dos vocabularios (uno de
 * botones y otro de intenciones) sería tener dos sitios donde olvidarse de una.
 *
 * @readonly
 */
export const ACCION = Object.freeze({
  CAMBIAR_MODELO: 'cambiar-modelo',
  CARGAR_CATASTRO: 'cargar-catastro-edificio',
  ABRIR_ATRIBUTOS: 'abrir-atributos-edificio',
  APLICAR_ATRIBUTOS: 'aplicar-atributos',
  CANCELAR_ATRIBUTOS: 'cancelar-atributos',
  RENOMBRAR_PARTE: 'renombrar-parte',
  APLICAR_CAPAS: 'aplicar-capas',
  CANCELAR_CAPAS: 'cancelar-capas',
})

/**
 * Los `data-*` que este módulo produce **y que existen SIEMPRE**, desde el primer
 * momento y pase lo que pase con el modelo. Son el CONTRATO con el cableado de
 * T3.2, que localiza los nodos por selector en el montaje y lanza si falta alguno.
 *
 * ⛔ **Todos llevan apellido de rama.** Ver la cabecera: `querySelector` se queda
 * con el nodo de parcela **aunque esté oculto**, así que un `[data-campo="refcat"]`
 * a secas aquí dejaría muerta a una de las dos ramas, en silencio.
 *
 * ⚠️ Los dos renglones de estado se nombran **por el COMPONENTE y no por la
 * acción** (`dialogo-capas`, `dialogo-atributos`): es la lección M8 de F07, que ya
 * costó dos veces.
 *
 * @readonly
 */
export const SELECTOR = Object.freeze({
  MODELO: '[data-campo="modelo-edificio"]',
  REFCAT: '[data-campo="refcat-edificio"]',
  CARGAR_CATASTRO: `[data-accion="${ACCION.CARGAR_CATASTRO}"]`,
  LISTA_PARTES: '[data-lista="partes"]',
  ESTADO: '[data-estado="edificio"]',
  PROCEDENCIA: '[data-procedencia="edificio"]',

  LISTA_CAPAS: '[data-lista="capas"]',
  APLICAR_CAPAS: `[data-accion="${ACCION.APLICAR_CAPAS}"]`,
  CANCELAR_CAPAS: `[data-accion="${ACCION.CANCELAR_CAPAS}"]`,
  ESTADO_CAPAS: '[data-estado="dialogo-capas"]',
})

/**
 * Los `data-*` que **solo existen en modelo COMPLETO**, y que en SIMPLIFICADO no
 * están ocultos: **no están**.
 *
 * ⭐ Ésta es la forma comprobable del **criterio de aceptación 1** de la ficha, y
 * está separada de {@link SELECTOR} para que se pueda señalar con el dedo: el
 * cableado sabe, leyendo esta constante, que a estos nodos **no puede agarrarse en
 * el montaje** — hay que resolverlos en cada uso, o preguntar por
 * `atributosDisponibles()`.
 *
 * @readonly
 */
export const SELECTOR_COMPLETO = Object.freeze({
  ABRIR_ATRIBUTOS: `[data-accion="${ACCION.ABRIR_ATRIBUTOS}"]`,
  BLOQUE_ATRIBUTOS: '[data-bloque="atributos-edificio"]',
  APLICAR_ATRIBUTOS: `[data-accion="${ACCION.APLICAR_ATRIBUTOS}"]`,
  CANCELAR_ATRIBUTOS: `[data-accion="${ACCION.CANCELAR_ATRIBUTOS}"]`,
  ESTADO_ATRIBUTOS: '[data-estado="dialogo-atributos"]',
})

/**
 * El `data-campo` de cada uno de los siete atributos semánticos, **en el orden de
 * `ATRIBUTOS_COMPLETO`** (`model/edificio.js:60-67`), que es el que el contrato
 * K.2 congela. Se deriva de aquella constante en vez de copiarse: si alguien
 * añade un octavo atributo al modelo, aquí sale un `data-campo` nuevo y no un
 * hueco silencioso.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const CAMPO_ATRIBUTO = Object.freeze(
  Object.fromEntries(
    ATRIBUTOS_COMPLETO.map((clave) => [clave, clave.replace(/([A-Z])/g, '-$1').toLowerCase()]),
  ),
)

/**
 * El selector de una fila de la lista de partes. **Fuera de {@link SELECTOR} a
 * propósito**, igual que `selectorFila` en el diálogo de F10: los de allí existen
 * siempre y éstos dependen de cuántas partes haya.
 *
 * @param {number} i  Índice 0-based en `edificio.partes`.
 * @returns {string}
 */
export const selectorParte = (i) => `[data-parte-indice="${Number(i)}"]`

/**
 * El selector del renglón de una capa del DXF. Fuera de {@link SELECTOR} por lo
 * mismo que {@link selectorParte}: depende de qué traiga el fichero.
 *
 * @param {string} nombre  El nombre LITERAL de la capa (código de grupo 8).
 * @returns {string}
 */
export const selectorCapa = (nombre) => `[data-capa="${escaparAtributo(nombre)}"]`

/**
 * Escapa un valor para meterlo en un selector de atributo. `CSS.escape` no existe
 * en jsdom ni en Node, así que se entrecomilla y se escapan las comillas: un
 * `[data-capa="…"]` con comillas dentro es un selector inválido y `querySelector`
 * **LANZA**. Y un nombre de capa viene de un fichero ajeno, así que puede traer
 * cualquier cosa. Mismo recurso, y mismo motivo, que en el diálogo de F10.
 *
 * @param {string} valor
 * @returns {string}
 */
function escaparAtributo(valor) {
  return String(valor).replace(/(["\\])/g, '\\$1')
}

// ── Vocabulario ──────────────────────────────────────────────────────────────

/** Lo que rotula el bloque que sustituye a «Origen de la parcela». */
export const TITULO_ORIGEN = 'Origen del edificio'

/** Lo que rotula el bloque que sustituye a la caja de vértices. */
export const TITULO_PARTES = 'Partes'

/**
 * La pregunta del selector de modelo. Literal de la ficha, §14.1: «Selector *¿Qué
 * necesitas generar?* con una línea por opción».
 */
export const PREGUNTA_MODELO = '¿Qué necesitas generar?'

/**
 * Rótulo humano de cada modelo. El `value` del radio es el valor de
 * `MODELO_EDIFICIO` **sin traducir** (contrato K.2); lo que se lee es esto.
 *
 * @readonly
 */
export const ROTULO_MODELO = Object.freeze({
  [MODELO_EDIFICIO.SIMPLIFICADO]: 'Simplificado — solo las huellas',
  [MODELO_EDIFICIO.COMPLETO]: 'Completo — huellas y atributos del edificio',
})

/** Los siete atributos enumerados con las MISMAS palabras que usa `conModelo`. */
const LOS_SIETE = ATRIBUTOS_COMPLETO.map((c) => ROTULO_ATRIBUTO[c]).join(', ')

/**
 * Qué implica elegir cada modelo — y, en el caso de SIMPLIFICADO, **qué se
 * pierde**: es la regla de oro 1 aplicada a un radio, y dice lo mismo que la
 * detección `MODELO_CAMBIADO` de `edificio/mutaciones.js` porque enumera los siete
 * atributos con `ROTULO_ATRIBUTO`, no con una segunda redacción.
 *
 * @readonly
 */
export const APUNTE_MODELO = Object.freeze({
  [MODELO_EDIFICIO.SIMPLIFICADO]:
    'Geometría de las partes, referencia catastral y estado. Es el modelo que admite el ICUC ' +
    'y es el caso más frecuente. Al elegirlo se borran los siete atributos del edificio, si los ' +
    'hubiera: volver a «Completo» los repone vacíos, no con los valores de antes.',
  [MODELO_EDIFICIO.COMPLETO]:
    `Añade siete atributos del edificio en su conjunto (${LOS_SIETE}), que se rellenan en una ` +
    'ventana aparte, con el botón «Atributos» de aquí arriba. Las plantas no van ahí: van por ' +
    'parte, y esta versión todavía no las pide.',
})

/**
 * Lo que se lee en la lista de partes cuando no hay ninguna, que es **lo primero
 * que ve el usuario de esta rama**: el store nace vacío a propósito. Enumera las
 * cinco vías de entrada en el mismo renglón, para que no se lea como «esto no ha
 * cargado».
 */
export const SIN_PARTES =
  'Todavía no hay ninguna parte. Hay cinco maneras de traer las huellas: soltar un DXF (cada ' +
  'polilínea del dibujo se ofrece como una parte), pegar un listado LIST, cargar un fichero de ' +
  'coordenadas .txt, soltar un GML de edificio ya existente, o escribir aquí arriba la ' +
  'referencia catastral y pulsar «Traer del Catastro».'

/** Lo que dice el renglón de procedencia mientras no se ha traído nada. */
export const SIN_PROCEDENCIA = ''

/**
 * Rótulo humano de cada estado de conservación. ⚠️ Son el vocabulario declarado de
 * `ESTADO_CONSERVACION` —el `conditionOfConstruction` de INSPIRE—, o sea el VALOR
 * de un campo que el usuario elige; no una calificación que emita la aplicación.
 * El `value` de cada opción es el de `ESTADO_CONSERVACION`, sin traducir.
 *
 * @readonly
 */
export const ROTULO_ESTADO_CONSERVACION = Object.freeze({
  [ESTADO_CONSERVACION.FUNCIONAL]: 'Funcional',
  [ESTADO_CONSERVACION.EN_CONSTRUCCION]: 'En construcción',
  [ESTADO_CONSERVACION.RUINOSO]: 'Ruinoso',
  [ESTADO_CONSERVACION.DERRUIDO]: 'Derruido',
})

/** Lo que se elige cuando un atributo todavía no se conoce. `null`, no un valor. */
export const SIN_INDICAR = 'Sin indicar'

/** Título del diálogo de reparto por capas. */
export const TITULO_CAPAS = 'Qué capas del dibujo entran como partes'

/**
 * Qué es el diálogo de capas. Dice el porqué **con el dato medido**, no con una
 * recomendación: en `UTM.dxf` la parcela está en la capa `0` y no en la que se
 * llama `PARCELA`, así que la aplicación no puede elegir por el nombre.
 */
export const INTRO_CAPAS =
  'El fichero trae sus polilíneas repartidas en capas. Cada polilínea de las capas que se ' +
  'marquen entrará como una parte independiente. Los nombres se muestran tal cual vienen en el ' +
  'fichero, para poder cotejarlos con el dibujo: la aplicación no elige por el nombre, porque en ' +
  'los planos reales la capa que se llama «PARCELA» no siempre es la que lleva la parcela.'

/** Título del diálogo de los siete atributos. */
export const TITULO_ATRIBUTOS = 'Atributos del edificio'

/** Qué es el diálogo de atributos, y las dos convenciones de sus campos. */
export const INTRO_ATRIBUTOS =
  'Son del edificio en su conjunto, no de cada parte, y solo se guardan en modelo Completo. Los ' +
  'años van en cuatro cifras y el de construcción se refiere al 1 de enero; la superficie ' +
  'construida va en metros cuadrados. Lo que se deje en blanco queda sin indicar, que no es lo ' +
  'mismo que cero.'

/** Lo que dice el renglón de estado del panel al nacer y tras `fijar(null)`. */
export const SIN_DATOS = 'Todavía no se ha cargado ningún edificio.'

/**
 * Por qué está apagado «Aplicar» en el diálogo de capas. Regla de oro 1: el botón
 * se apaga y el porqué se escribe **en el mismo paso**, nunca en dos.
 */
export const MOTIVO_SIN_CAPAS =
  'El botón «Cargar las partes» está apagado: no hay ninguna capa marcada, así que no entraría ' +
  'ninguna parte. Ninguna viene marcada de fábrica a propósito — elegir por el nombre de la capa ' +
  'falla en los planos reales.'

/** Por qué está apagado «Traer del Catastro» cuando no hay nada escrito. */
export const MOTIVO_SIN_REFCAT =
  'El botón «Traer del Catastro» está apagado: hace falta una referencia catastral en el campo ' +
  'de arriba, o una huella cargada de la que deducirla.'

/** La ayuda que aparece al abrir el editor del nombre de una parte. */
export const AYUDA_RENOMBRAR =
  'Escribe el nombre de la parte y pulsa Intro, o el botón «Guardar nombre». Con Escape se queda ' +
  'como estaba.'

/**
 * Qué se dice cuando un atributo numérico no se puede leer. **No se convierte a
 * `NaN` ni se manda al modelo**: `crearEdificio` lanzaría, y lanzaría dentro de un
 * `click`. Se nombra el campo y se deja el diálogo abierto (regla de oro 1).
 *
 * @param {readonly string[]} rotulos
 * @returns {string}
 */
export const motivoNoNumerico = (rotulos) =>
  `No se ha guardado nada: ${rotulos.length === 1 ? 'este campo no lleva' : 'estos campos no llevan'} ` +
  `un número (${rotulos.join(', ')}). Escríbelo solo con cifras, o déjalo en blanco para dejarlo ` +
  'sin indicar.'

/**
 * Lo que se le dice al usuario cuando revienta un oyente suyo. Gemelo de
 * `app/dialogo-expediente.js#MENSAJE_OYENTE_ROTO`, y por el mismo motivo MEDIDO:
 * **una excepción lanzada dentro de un oyente del DOM no sale por `dispatchEvent`**,
 * ni en jsdom ni en el navegador, así que dejarla propagar es un error silencioso
 * de manual — la pantalla se queda como estaba y el único rastro está en una
 * consola que nadie abre.
 */
export const MENSAJE_OYENTE_ROTO =
  'La orden ha llegado bien, pero lo que la aplicación tenía que hacer con ella se ha ' +
  'interrumpido por un fallo interno; no se ha cambiado nada. El detalle técnico está en la ' +
  'consola del navegador.'

/**
 * Motivos con los que se cierra un diálogo. Mismo vocabulario, y mismo reparto,
 * que `app/dialogo-informe.js` y `app/dialogo-expediente.js`.
 *
 * @readonly
 */
export const MOTIVO_CIERRE = Object.freeze({
  BOTON: 'BOTON',
  ESCAPE: 'ESCAPE',
  NATIVO: 'NATIVO',
  PROGRAMATICO: 'PROGRAMATICO',
})

/** Cuál de los dos diálogos. Viaja en el aviso de {@link MOTIVO_CIERRE}. */
export const DIALOGO = Object.freeze({
  CAPAS: 'capas',
  ATRIBUTOS: 'atributos',
})

// ── Utilidades ───────────────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para el mensaje de un `throw`, sin reventar con los cíclicos. */
function describir(valor) {
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

/**
 * ¿Sirve como documento? DUCK TYPING deliberado, no `instanceof Document` — mismo
 * criterio (y mismo motivo) que en los dos diálogos anteriores: un documento de
 * otro realm no pasa el `instanceof`, y `Document` ni siquiera existe como global
 * bajo el proyecto Vitest `node`.
 *
 * @param {*} d
 * @returns {boolean}
 */
function esDocumento(d) {
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.createElement === 'function' &&
    typeof d.createTextNode === 'function' &&
    !!d.body
  )
}

/**
 * Vacía un nodo. **Deliberadamente NO es `replaceChildren`**: la prohibición del
 * riesgo 1 de F11 se cumple así a la letra y ningún lector tiene que pararse a
 * decidir si este `<ul>` cuenta o no. El efecto es el mismo y el nodo vaciado
 * —nunca una `<section>`, nunca un nodo de {@link SELECTOR}— sigue conectado.
 *
 * @param {Node} nodo
 */
function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild)
}

/** Un texto utilizable, o `null`. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/**
 * Sello incremental para los `id` del marcado y para el `name` de los radios. Dos
 * paneles en el mismo documento compartirían los `id` de sus `<label for>` —y, lo
 * que es peor, el `name` de sus radios, que los haría excluyentes entre sí—.
 * Mismo recurso que en los diálogos de F09 y F10.
 */
let sello = 0

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * Una fila de la lista de partes. Es lo mínimo que hace falta para pintarla; el
 * `ParteConstruccion` entero se le puede pasar tal cual y esta vista solo mira
 * `nombre` y `recinto`.
 *
 * @typedef {Object} FilaParte
 * @property {string} nombre
 * @property {{vertices: Array}|null} [recinto]
 */

/**
 * Un renglón del diálogo de reparto por capas.
 *
 * @typedef {Object} FilaCapa
 * @property {string} nombre  El literal del código de grupo 8. `''` es una capa
 *   real: es lo que devuelve `parseDXF` para una entidad sin código 8.
 * @property {number} anillos  Cuántas polilíneas trae.
 */

/**
 * Lo que emite {@link crearPanelEdificio}.alAccion.
 *
 * @typedef {Object} AccionEdificio
 * @property {string} accion  Una de {@link ACCION}.
 * @property {number|null} indice  La parte sobre la que se actúa, o `null`.
 * @property {string|null} nombre  El nombre nuevo, solo en `RENOMBRAR_PARTE`.
 * @property {string[]|null} capas  Las capas marcadas, solo en `APLICAR_CAPAS`.
 * @property {object|null} atributos  Los siete ya convertidos, solo en
 *   `APLICAR_ATRIBUTOS`. Los que quedaron en blanco viajan como `null`.
 * @property {{modelo: string, refcat: string|null}} valores  Lo que hubiera en el
 *   panel al actuar. Viaja con la acción para que el cableado no tenga que
 *   acordarse de leerlo.
 */

// ── La vista ─────────────────────────────────────────────────────────────────

/**
 * El panel de la rama EDIFICIO.
 *
 * ```js
 * const panel = crearPanelEdificio({ documento: document, alAvisar: avisos.avisar })
 * panel.montar({ trasOrigen: bloqueCatastro, trasPartes: bloqueVertices })
 * panel.fijar({ edificio })
 * panel.alAccion(({ accion, indice, nombre }) => cableado.atender(accion, indice, nombre))
 * ```
 *
 * ⚠️ **`montar` no lo llama nadie por ti, y el ORDEN importa**: la sección de
 * partes es el estirador de esta rama (`flex: 1 1 auto`), así que tiene que ir
 * **después** del bloque de avisos, exactamente donde va la caja de vértices en la
 * rama de parcela. Ver {@link montar}.
 *
 * Contrato roto por el PROGRAMADOR (falta `documento`, un `alAlgo` que no recibe
 * función, un `fijar` con la forma equivocada) → `TypeError`. Un dato malo del
 * USUARIO —un nombre en blanco, un año con letras, un fichero sin capas— **nunca
 * lanza**.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento  Se inyecta —en vez de tomar el global—
 *   para que el test pueda medirlo y para que el panel funcione dentro de un iframe.
 * @param {import('../viewer/_comun.js').Avisar} [opciones.alAvisar]
 * @returns {object}
 * @throws {TypeError}
 */
export function crearPanelEdificio({ documento, alAvisar } = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `crearPanelEdificio: 'documento' debe ser un Document (o un objeto con createElement, ` +
        `createTextNode y body); recibido ${describir(documento)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  const doc = documento
  const marca = (sello += 1)
  const id = (sufijo) => `gml-panel-edificio-${marca}-${sufijo}`

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── Estado ────────────────────────────────────────────────────────────────

  let destruido = false
  /** Lo último que se pasó a `fijar`, ya normalizado. `null` = nada cargado. */
  let datos = null
  /** El modelo que se está enseñando. Nace SIMPLIFICADO, como `crearEdificio`. */
  let modeloActual = MODELO_EDIFICIO.SIMPLIFICADO
  /** El reparto por capas que se está enseñando. `null` = nada mirado todavía. */
  let capas = null
  /** Qué parte tiene el editor de nombre abierto. `null` = ninguna. */
  let renombrando = null
  /** Qué diálogos están abiertos, y a quién devolverle el foco. */
  const abierto = { capas: false, atributos: false }
  const focoPrevio = { capas: null, atributos: null }

  const oyentes = { accion: new Set(), cerrar: new Set() }

  /** Registro de escuchadores: cero fugas por construcción. */
  const escuchados = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    escuchados.push({ diana, tipo, fn })
  }

  // ══ Sección 1 · «Origen del edificio» ═════════════════════════════════════

  const seccionOrigen = crear('section', `gml-bloque ${CLASE.BLOQUE}`)

  const filaRotulo = crear('div', 'gml-rotulo-fila')
  const rotuloOrigen = crear('h2', 'gml-rotulo', TITULO_ORIGEN)
  rotuloOrigen.id = id('rotulo')
  filaRotulo.append(rotuloOrigen)
  seccionOrigen.append(filaRotulo)

  // El botón «Atributos» y su envoltorio se fabrican y se retiran con el modelo:
  // en SIMPLIFICADO NO EXISTEN. Ver `SELECTOR_COMPLETO` y el criterio 1.
  /** @type {HTMLElement|null} */
  let accionesRotulo = null
  /** @type {HTMLElement|null} */
  let botonAtributos = null

  // ── El selector de modelo ─────────────────────────────────────────────────
  // `role="radiogroup"` sobre un `<div>` y no un `<fieldset>`: un `<fieldset>` sin
  // reseteo de CSS trae borde y `padding` de la hoja del navegador, y en este
  // módulo NO se escribe ni una regla — la sección de F11 de `estilos/app.css` no
  // declara ninguna para él. Con `aria-labelledby` el grupo se anuncia igual.
  const campoModelo = crear('div', 'gml-campo')
  const preguntaModelo = crear('p', 'gml-campo-etiqueta', PREGUNTA_MODELO)
  preguntaModelo.id = id('pregunta-modelo')
  const opciones = crear('div', CLASE.OPCIONES)
  opciones.setAttribute('role', 'radiogroup')
  opciones.setAttribute('aria-labelledby', preguntaModelo.id)

  /** @type {Map<string, HTMLInputElement>} */
  const radios = new Map()
  /** El apunte de cada opción, para poder enseñar solo el del modelo elegido. */
  const apuntes = new Map()
  for (const valor of Object.values(MODELO_EDIFICIO)) {
    // `<label>` envolviendo al radio: el objetivo de pulsación es la línea entera
    // y no el círculo de 13 px.
    const opcion = crear('label', CLASE.OPCION)
    const radio = doc.createElement('input')
    radio.type = 'radio'
    // El `name` lleva el sello: dos paneles en el mismo documento con el mismo
    // `name` serían UN grupo de radios, y elegir en uno desmarcaría el otro.
    radio.name = id('modelo')
    radio.value = valor // ⛔ SIN TRADUCIR: es el valor de MODELO_EDIFICIO.
    radio.dataset.campo = 'modelo-edificio'
    radio.checked = valor === modeloActual
    const rotulo = crear('span', null, ROTULO_MODELO[valor])
    const apunte = crear('span', CLASE.OPCION_APUNTE, APUNTE_MODELO[valor])
    opcion.append(radio, rotulo, apunte)
    opciones.append(opcion)
    radios.set(valor, radio)
    // ⛔ El apunte de la opción NO elegida se oculta: ver {@link pintarModelo}.
    // Se fija ya aquí, en el montaje, y no solo en el primer `pintarModelo`: un
    // panel recién construido y todavía sin `fijar` enseñaría los dos.
    apunte.hidden = valor !== modeloActual
    apuntes.set(valor, apunte)
  }
  campoModelo.append(preguntaModelo, opciones)
  seccionOrigen.append(campoModelo)

  // ── La referencia catastral ───────────────────────────────────────────────
  // Misma disciplina que `[data-campo="refcat"]` de `index.html:199-210`, y por lo
  // mismo: monoespaciada porque son caracteres que se cotejan UNO A UNO contra un
  // papel, sin autocompletado ni corrector —no tienen nada que aportar sobre un
  // código y solo estorban— y ⛔ SIN `maxlength`, que allí fue un FALLO SILENCIOSO
  // medido: recortaba lo pegado antes de que nadie lo mirase, así que quien pegaba
  // «9398516 VK3799G» —con el espacio con el que la Sede imprime las referencias—
  // perdía el último carácter y recibía «no tiene forma de referencia catastral»
  // por una referencia correcta.
  const campoRefcat = crear('div', 'gml-campo')
  const etiquetaRefcat = crear('label', 'gml-campo-etiqueta', 'Referencia catastral')
  etiquetaRefcat.htmlFor = id('refcat')
  const filaRefcat = crear('div', 'gml-campo-fila')
  const entradaRefcat = doc.createElement('input')
  entradaRefcat.type = 'text'
  entradaRefcat.id = id('refcat')
  entradaRefcat.className = 'gml-entrada gml-mono'
  entradaRefcat.dataset.campo = 'refcat-edificio'
  entradaRefcat.setAttribute('autocomplete', 'off')
  entradaRefcat.setAttribute('spellcheck', 'false')
  entradaRefcat.setAttribute('placeholder', '9398516VK3799G')
  const botonCatastro = crear('button', 'gml-boton gml-boton--primario', 'Traer del Catastro')
  botonCatastro.type = 'button'
  botonCatastro.dataset.accion = ACCION.CARGAR_CATASTRO
  botonCatastro.setAttribute('aria-describedby', id('estado'))
  filaRefcat.append(entradaRefcat, botonCatastro)
  campoRefcat.append(etiquetaRefcat, filaRefcat)
  seccionOrigen.append(campoRefcat)

  // El desenlace de la acción. `role="status"` para que el lector de pantalla lo
  // anuncie SIN robar el foco, igual que su gemelo de la rama de parcela.
  const estadoNodo = crear('p', 'gml-accion-estado', SIN_DATOS)
  estadoNodo.id = id('estado')
  estadoNodo.dataset.estado = 'edificio'
  estadoNodo.setAttribute('role', 'status')
  seccionOrigen.append(estadoNodo)

  // De dónde salió el dato y su antigüedad. Hermano de `[data-procedencia="parcela"]`,
  // y por eso coste 0 px: reutiliza el patrón entero.
  const procedenciaNodo = crear('p', 'gml-procedencia', SIN_PROCEDENCIA)
  procedenciaNodo.dataset.procedencia = 'edificio'
  seccionOrigen.append(procedenciaNodo)

  // ══ Sección 2 · «Partes» — el nuevo estirador del panel ═══════════════════

  const seccionPartes = crear('section', `gml-bloque ${CLASE.BLOQUE_PARTES}`)
  const filaRotuloPartes = crear('div', 'gml-rotulo-fila')
  filaRotuloPartes.append(crear('h2', 'gml-rotulo', TITULO_PARTES))
  // Segundo hijo de la fila, sin clase: hereda 11 px y gris, igual que el «X · Y
  // (m)» de la fila de «Vértices».
  const cuentaPartes = crear('span', null, '0 partes')
  filaRotuloPartes.append(cuentaPartes)
  seccionPartes.append(filaRotuloPartes)

  const listaPartes = crear('ul', CLASE.PARTES)
  listaPartes.dataset.lista = 'partes'
  seccionPartes.append(listaPartes)

  // ══ El `<dialog>` de reparto por capas ════════════════════════════════════

  const dialogoCapas = crear('dialog', CLASE.DIALOGO_CAPAS)
  dialogoCapas.setAttribute('aria-labelledby', id('capas-titulo'))
  dialogoCapas.setAttribute('aria-modal', 'true')
  // Suelo del foco: sin un control enfocable, `abrir()` dejaría el foco fuera y
  // `Escape` no llegaría nunca.
  dialogoCapas.tabIndex = -1

  const cuerpoCapas = crear('div', CLASE.CAPAS_CUERPO)
  const tituloCapas = crear('h2', CLASE.CAPAS_TITULO, TITULO_CAPAS)
  tituloCapas.id = id('capas-titulo')
  const introCapas = crear('p', CLASE.CAPAS_INTRO, INTRO_CAPAS)
  const listaCapas = crear('ul', null)
  listaCapas.dataset.lista = 'capas'
  const pieCapas = crear('div', CLASE.CAPAS_PIE)
  const aplicarCapas = crear('button', 'gml-boton gml-boton--primario', 'Cargar las partes')
  aplicarCapas.type = 'button'
  aplicarCapas.dataset.accion = ACCION.APLICAR_CAPAS
  aplicarCapas.setAttribute('aria-describedby', id('capas-estado'))
  // NACE APAGADO: sin ninguna capa marcada no entraría ninguna parte. A partir de
  // aquí lo gobierna `repintarGateCapas`, y nunca sin escribir el motivo.
  aplicarCapas.disabled = true
  const cancelarCapas = crear('button', 'gml-boton gml-boton--secundario', 'Cancelar')
  cancelarCapas.type = 'button'
  cancelarCapas.dataset.accion = ACCION.CANCELAR_CAPAS
  pieCapas.append(aplicarCapas, cancelarCapas)
  const estadoCapas = crear('p', CLASE.CAPAS_ESTADO, MOTIVO_SIN_CAPAS)
  estadoCapas.id = id('capas-estado')
  estadoCapas.dataset.estado = 'dialogo-capas'
  estadoCapas.setAttribute('role', 'status')
  cuerpoCapas.append(tituloCapas, introCapas, listaCapas, pieCapas, estadoCapas)
  dialogoCapas.append(cuerpoCapas)
  doc.body.appendChild(dialogoCapas)

  // ══ El `<dialog>` de los siete atributos (solo en COMPLETO) ═══════════════
  //
  // No nace con el módulo: nace y muere con el modelo. En SIMPLIFICADO **no
  // existe**, que es la forma comprobable del criterio de aceptación 1.

  /** @type {HTMLElement|null} */
  let dialogoAtributos = null
  /** @type {HTMLElement|null} */
  let estadoAtributos = null
  /** @type {Map<string, HTMLElement>} */
  const camposAtributo = new Map()

  /** Un campo del diálogo de atributos: etiqueta + control, reutilizando cromo. */
  function campoAtributo(clave, sufijo) {
    const caja = crear('div', 'gml-campo')
    const etiqueta = crear('label', 'gml-campo-etiqueta', ROTULO_ATRIBUTO[clave])
    etiqueta.htmlFor = id(`atr-${sufijo}`)
    let control
    if (clave === 'estadoConservacion') {
      control = doc.createElement('select')
      const vacia = doc.createElement('option')
      vacia.value = ''
      vacia.textContent = SIN_INDICAR
      control.append(vacia)
      for (const valor of Object.values(ESTADO_CONSERVACION)) {
        const opcion = doc.createElement('option')
        opcion.value = valor // ⛔ SIN TRADUCIR: es el valor de ESTADO_CONSERVACION.
        opcion.textContent = ROTULO_ESTADO_CONSERVACION[valor]
        control.append(opcion)
      }
    } else {
      control = doc.createElement('input')
      // ⚠️ `type="text"` con `inputmode="numeric"` y NO `type="number"`, a
      // propósito: con `number` el navegador vacía `.value` ante lo que no sabe
      // leer, así que «mil novecientos» llegaría aquí como cadena vacía y se
      // guardaría como «sin indicar» EN SILENCIO. Con `text` el texto llega
      // entero, esta vista lo mira y **dice** que no lleva un número (regla 1).
      control.type = 'text'
      control.setAttribute('inputmode', clave === 'usoDominante' ? 'text' : 'numeric')
      control.setAttribute('autocomplete', 'off')
    }
    control.id = id(`atr-${sufijo}`)
    control.className = 'gml-entrada'
    control.dataset.campo = sufijo
    caja.append(etiqueta, control)
    camposAtributo.set(clave, control)
    return caja
  }

  /** Fabrica el `<dialog>` de atributos y el botón que lo abre. */
  function montarAtributos() {
    if (dialogoAtributos !== null) return

    accionesRotulo = crear('div', 'gml-rotulo-acciones')
    botonAtributos = crear('button', 'gml-boton gml-boton--menudo', 'Atributos')
    botonAtributos.type = 'button'
    botonAtributos.dataset.accion = ACCION.ABRIR_ATRIBUTOS
    accionesRotulo.append(botonAtributos)
    filaRotulo.append(accionesRotulo)

    dialogoAtributos = crear('dialog', CLASE.DIALOGO_ATRIBUTOS)
    dialogoAtributos.setAttribute('aria-labelledby', id('atributos-titulo'))
    dialogoAtributos.setAttribute('aria-modal', 'true')
    dialogoAtributos.tabIndex = -1

    const cuerpo = crear('div', CLASE.ATRIBUTOS_CUERPO)
    const titulo = crear('h2', CLASE.ATRIBUTOS_TITULO, TITULO_ATRIBUTOS)
    titulo.id = id('atributos-titulo')
    const intro = crear('p', CLASE.ATRIBUTOS_INTRO, INTRO_ATRIBUTOS)

    // El `[data-bloque]` cuelga de un `<fieldset>` SIN `<legend>` y con
    // `aria-labelledby` al `<h2>` del diálogo: el título ya nombra el grupo, y una
    // segunda cabecera diría las mismas palabras dos veces. El reseteo del
    // `<fieldset>` lo pone `estilos/app.css`, que además evita ahí cualquier
    // `display` — si este atributo hubiera caído en el propio `<dialog>`, un
    // `display` sería la bomba de `dialog:not([open])`.
    const bloque = doc.createElement('fieldset')
    bloque.dataset.bloque = 'atributos-edificio'
    bloque.setAttribute('aria-labelledby', titulo.id)
    const rejilla = crear('div', CLASE.ATRIBUTOS_REJILLA)
    camposAtributo.clear()
    for (const clave of ATRIBUTOS_COMPLETO) {
      rejilla.append(campoAtributo(clave, CAMPO_ATRIBUTO[clave]))
    }
    bloque.append(rejilla)

    const pie = crear('div', CLASE.ATRIBUTOS_PIE)
    const guardar = crear('button', 'gml-boton gml-boton--primario', 'Guardar los atributos')
    guardar.type = 'button'
    guardar.dataset.accion = ACCION.APLICAR_ATRIBUTOS
    const cancelar = crear('button', 'gml-boton gml-boton--secundario', 'Cancelar')
    cancelar.type = 'button'
    cancelar.dataset.accion = ACCION.CANCELAR_ATRIBUTOS
    pie.append(guardar, cancelar)

    estadoAtributos = crear('p', CLASE.ATRIBUTOS_ESTADO, '')
    estadoAtributos.id = id('atributos-estado')
    estadoAtributos.dataset.estado = 'dialogo-atributos'
    estadoAtributos.setAttribute('role', 'status')
    guardar.setAttribute('aria-describedby', estadoAtributos.id)

    cuerpo.append(titulo, intro, bloque, pie, estadoAtributos)
    dialogoAtributos.append(cuerpo)
    doc.body.appendChild(dialogoAtributos)

    escuchar(dialogoAtributos, 'click', alPulsar)
    escuchar(dialogoAtributos, 'keydown', alTeclaAtributos)
    escuchar(dialogoAtributos, 'cancel', alCancelAtributos)
    escuchar(dialogoAtributos, 'close', alCloseAtributos)
  }

  /**
   * Retira el `<dialog>` de atributos y el botón que lo abre.
   *
   * ⚠️ **Esto no borra ningún dato, y es importante que se entienda así.** Los
   * siete atributos viven en el `Edificio` del store, no en estos `<input>`; aquí
   * solo se pintan. Quien los borra de verdad es `conModelo`, y solo cuando el
   * cableado decide aplicarla —después de enseñar su detección `MODELO_CAMBIADO`,
   * que es la regla de oro 1 aplicada a una acción destructiva—. Si el usuario se
   * arrepiente, un `fijar({modelo: 'COMPLETO'})` vuelve a fabricar el diálogo con
   * los valores del store dentro.
   */
  function desmontarAtributos() {
    if (dialogoAtributos === null) return
    cerrarDialogo(DIALOGO.ATRIBUTOS, MOTIVO_CIERRE.PROGRAMATICO, false)

    for (let i = escuchados.length - 1; i >= 0; i -= 1) {
      const { diana, tipo, fn } = escuchados[i]
      if (diana === dialogoAtributos) {
        diana.removeEventListener(tipo, fn)
        escuchados.splice(i, 1)
      }
    }
    if (dialogoAtributos.parentNode) dialogoAtributos.parentNode.removeChild(dialogoAtributos)
    dialogoAtributos = null
    estadoAtributos = null
    camposAtributo.clear()

    if (accionesRotulo?.parentNode) accionesRotulo.parentNode.removeChild(accionesRotulo)
    accionesRotulo = null
    botonAtributos = null
  }

  // ── Pintado ───────────────────────────────────────────────────────────────

  /**
   * Una fila de la lista de partes.
   *
   * El dato de la derecha es el número de vértices y no la superficie: contar
   * vértices es aritmética que esta vista puede hacer sin conocer geometría, y
   * medir superficies es de quien mide (`geo/area.js`). Una vista que calcula
   * áreas es una segunda forma de decir la misma cifra, con su propia manera de
   * redondear.
   *
   * @param {FilaParte} parte
   * @param {number} i
   * @returns {HTMLElement}
   */
  function pintarParte(parte, i) {
    const li = crear('li', CLASE.PARTE)
    li.dataset.parteIndice = String(i)

    if (renombrando === i) {
      const entrada = doc.createElement('input')
      entrada.type = 'text'
      entrada.className = 'gml-entrada'
      entrada.dataset.campo = 'nombre-parte'
      entrada.value = parte.nombre
      entrada.setAttribute('autocomplete', 'off')
      entrada.setAttribute('aria-label', `Nombre de la parte ${i + 1}`)
      li.append(entrada)
    } else {
      li.append(crear('span', CLASE.PARTE_NOMBRE, parte.nombre))
      li.append(crear('span', CLASE.PARTE_DATO, parte.dato))
    }

    // ⚠️ MISMO `data-accion` en los dos estados, y es coherente: «renombrar la
    // parte N» es UNA intención con dos pasos —abrir el editor y confirmarlo—, y
    // dos cadenas para lo mismo serían dos sitios donde equivocarse. Lo que cambia
    // es el rótulo, que es lo que lee quien pulsa.
    const boton = crear(
      'button',
      'gml-boton gml-boton--menudo',
      renombrando === i ? 'Guardar nombre' : 'Renombrar',
    )
    boton.type = 'button'
    boton.dataset.accion = ACCION.RENOMBRAR_PARTE
    li.append(boton)
    return li
  }

  /** La lista entera, y el renglón de «todavía no hay nada» cuando toca. */
  function pintarPartes() {
    vaciar(listaPartes)
    const partes = datos?.partes ?? []
    cuentaPartes.textContent = partes.length === 1 ? '1 parte' : `${partes.length} partes`
    if (partes.length === 0) {
      // Un `<li>` y no un `<p>`: un párrafo suelto dentro de un `<ul>` no es HTML
      // válido, y el cromo de `.gml-partes-vacio` está escrito para vivir dentro
      // de la caja con borde que es `.gml-partes`.
      const vacio = crear('li', CLASE.PARTES_VACIO, SIN_PARTES)
      vacio.dataset.edificio = 'partes-vacio'
      listaPartes.append(vacio)
      return
    }
    partes.forEach((parte, i) => listaPartes.append(pintarParte(parte, i)))
  }

  /**
   * Los radios, desde el modelo que se está enseñando.
   *
   * ⛔ **Y solo se enseña el apunte de la opción ELEGIDA** (2026-08-04; lo destapó
   * el guion de humo 13, no la suite). Los dos apuntes a la vez median **272,03 px
   * medidos** a 1440×900, y con ellos el panel de esta rama se sobresuscribía
   * **47,54 px en vacío** (114,91 con 7 partes): `.gml-panel` recortaba por abajo
   * con su `overflow:hidden` y dejaba el CTA «Diagnosticar encaje» **fuera de la
   * pantalla y sin forma de llegar a él**.
   *
   * Enseñar uno no es recortar honradez, y por eso se eligió antes que tocar
   * ningún texto: **el apunte de la opción que NO has elegido describe una decisión
   * que no has tomado**, y está a un clic de distancia. Lo que sí sería recortarla
   * es esconder lo que se PIERDE al elegir, y eso no se toca: el apunte de
   * SIMPLIFICADO sigue diciendo que se borran los siete atributos, y sigue estando
   * a la vista **justo cuando lo eliges**, que es cuando importa.
   *
   * Se oculta con `hidden` y no se retira del DOM: la regla es la misma que la del
   * intercambio de ramas, y aquí además el nodo tiene que poder volver sin
   * refabricarse. Los que sí se RETIRAN son los siete atributos de COMPLETO, que
   * es otra cosa y es el criterio de aceptación 1 (ver {@link desmontarAtributos}).
   */
  function pintarModelo() {
    for (const [valor, radio] of radios) radio.checked = valor === modeloActual
    for (const [valor, apunte] of apuntes) apunte.hidden = valor !== modeloActual
    if (modeloActual === MODELO_EDIFICIO.COMPLETO) montarAtributos()
    else desmontarAtributos()
  }

  /**
   * El botón primario del panel y su porqué, **SIEMPRE en el mismo paso** (regla
   * de oro 1). Cuando sí se puede consultar, el renglón se vacía: es un
   * repintado, y dejar ahí el motivo anterior sería peor que no decir nada. Quien
   * quiera escribir algo después tiene {@link estado}.
   */
  function repintarGate() {
    const puede = datos === null ? true : datos.puedeConsultarCatastro
    botonCatastro.disabled = !puede
    if (datos === null) estadoNodo.textContent = SIN_DATOS
    else estadoNodo.textContent = puede ? '' : MOTIVO_SIN_REFCAT
  }

  /** Un renglón del diálogo de capas. */
  function pintarCapa(capa) {
    const li = doc.createElement('li')
    li.dataset.capa = capa.nombre
    const fila = crear('label', CLASE.CAPAS_FILA)
    const casilla = doc.createElement('input')
    casilla.type = 'checkbox'
    casilla.dataset.campo = 'capa-elegida'
    casilla.value = capa.nombre
    // ⛔ NINGUNA VIENE MARCADA. Ver `MOTIVO_SIN_CAPAS` y la cabecera: elegir por el
    // nombre de la capa falla en `UTM.dxf`, el único plano real que hay.
    casilla.checked = false
    // El nombre LITERAL. La cadena vacía es una capa real —es lo que devuelve
    // `parseDXF` cuando la entidad no traía código 8— y se dice con palabras, no
    // con un hueco en blanco que parecería un fallo de pintado.
    const nombre = crear(
      'span',
      CLASE.CAPAS_NOMBRE,
      capa.nombre === '' ? 'Sin nombre de capa' : capa.nombre,
    )
    const cuenta = crear(
      'span',
      CLASE.CAPAS_CUENTA,
      capa.anillos === 1 ? '1 polilínea' : `${capa.anillos} polilíneas`,
    )
    fila.append(casilla, nombre, cuenta)
    li.append(fila)
    return li
  }

  /** El reparto entero. */
  function pintarCapas() {
    vaciar(listaCapas)
    for (const capa of capas ?? []) listaCapas.append(pintarCapa(capa))
    repintarGateCapas()
  }

  /** «Aplicar» y su porqué, en el mismo paso. */
  function repintarGateCapas() {
    const elegidas = leerCapasElegidas()
    aplicarCapas.disabled = elegidas.length === 0
    estadoCapas.textContent = elegidas.length === 0 ? MOTIVO_SIN_CAPAS : ''
  }

  /** @returns {string[]} Los nombres LITERALES de las capas marcadas. */
  function leerCapasElegidas() {
    return [...listaCapas.querySelectorAll('[data-campo="capa-elegida"]')]
      .filter((c) => c.checked)
      .map((c) => c.value)
  }

  /** Los siete campos, desde el edificio. Solo si el diálogo existe. */
  function pintarAtributos() {
    if (dialogoAtributos === null) return
    const valores = datos?.atributos ?? {}
    for (const [clave, control] of camposAtributo) {
      const valor = valores[clave]
      control.value = valor === null || valor === undefined ? '' : String(valor)
    }
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  /**
   * Reparte un suceso entre sus oyentes **atrapando lo que revienten**. Ver
   * {@link MENSAJE_OYENTE_ROTO}: una excepción dentro de un oyente del DOM no sale
   * por `dispatchEvent`. El `try` alcanza a CADA oyente por separado: uno roto no
   * puede dejar sin enterarse a los demás.
   *
   * @param {Set<Function>} conjunto
   * @param {*} [carga]
   */
  function repartir(conjunto, carga) {
    for (const fn of conjunto) {
      try {
        fn(carga)
      } catch (causa) {
        avisar(MENSAJE_OYENTE_ROTO, { nivel: NIVEL.ERROR, causa })
        console.error('[panel-edificio] un oyente ha fallado de forma inesperada:', causa)
      }
    }
  }

  /** Alta de un oyente, con su baja. Mismo patrón —y misma guarda— que los cajones. */
  function suscribir(conjunto, fn, quien) {
    if (typeof fn !== 'function') {
      throw new TypeError(`${quien}: 'fn' debe ser una función; recibido ${describir(fn)}.`)
    }
    conjunto.add(fn)
    return () => conjunto.delete(fn)
  }

  /** Lo que hubiera en el panel al actuar, que viaja con toda intención. */
  function instantanea() {
    return { modelo: modeloActual, refcat: textoONulo(entradaRefcat.value) }
  }

  /**
   * @param {string} accion
   * @param {object} [extra]
   */
  function emitir(accion, extra = {}) {
    repartir(oyentes.accion, {
      accion,
      indice: null,
      nombre: null,
      capas: null,
      atributos: null,
      ...extra,
      valores: instantanea(),
    })
  }

  /**
   * Lee los siete campos y los convierte a lo que el modelo acepta.
   *
   * ⚠️ **La conversión es de la interfaz, y está escrito donde toca**:
   * `edificio/mutaciones.js#conAtributos` dice que no valida porque «convertir el
   * texto de un `<input>` a número es de la interfaz». Si llegara `'1998'`,
   * `crearEdificio` lanzaría — y lanzaría dentro de un `click`.
   *
   * @returns {{atributos: object, ilegibles: string[]}}
   */
  function leerAtributos() {
    const atributos = {}
    const ilegibles = []
    for (const [clave, control] of camposAtributo) {
      const bruto = typeof control.value === 'string' ? control.value.trim() : ''
      if (bruto === '') {
        atributos[clave] = null
        continue
      }
      if (clave === 'usoDominante' || clave === 'estadoConservacion') {
        atributos[clave] = bruto
        continue
      }
      // Coma decimal incluida: la superficie construida se teclea como se escribe
      // en España, y rechazarla por el separador sería un fallo de la aplicación
      // disfrazado de dato malo.
      const numero = Number(bruto.replace(',', '.'))
      if (!Number.isFinite(numero)) {
        ilegibles.push(ROTULO_ATRIBUTO[clave])
        continue
      }
      atributos[clave] = numero
    }
    return { atributos, ilegibles }
  }

  /** Abre el editor del nombre de la parte `i` y deja el foco dentro. */
  function abrirRenombre(i) {
    renombrando = i
    pintarPartes()
    const entrada = listaPartes.querySelector('[data-campo="nombre-parte"]')
    if (entrada) {
      entrada.focus()
      if (typeof entrada.select === 'function') entrada.select()
    }
    estadoNodo.textContent = AYUDA_RENOMBRAR
  }

  /** Cierra el editor sin aplicar nada. */
  function cancelarRenombre() {
    if (renombrando === null) return
    renombrando = null
    pintarPartes()
    repintarGate()
  }

  /**
   * Confirma el renombrado. **Un nombre en blanco no lanza y no se descarta
   * aquí**: se emite tal cual y quien decide es `conParteRenombrada`, que ya sabe
   * conservar el anterior y devolver una detección `RENOMBRADO_IGNORADO`. Esta
   * vista no puede tener una segunda opinión sobre eso.
   */
  function confirmarRenombre() {
    if (renombrando === null) return
    const i = renombrando
    const entrada = listaPartes.querySelector('[data-campo="nombre-parte"]')
    const nombre = entrada ? entrada.value : ''
    renombrando = null
    pintarPartes()
    repintarGate()
    emitir(ACCION.RENOMBRAR_PARTE, { indice: i, nombre })
  }

  const ACCIONES = new Set(Object.values(ACCION))

  /**
   * UN solo oyente por raíz, por DELEGACIÓN. Las filas se repintan enteras en cada
   * `fijar`, así que enganchar un oyente por botón obligaría a darlos de baja en
   * cada repintado — y el que se olvide es una fuga que no se ve.
   *
   * @param {Event} evento
   */
  function alPulsar(evento) {
    const boton = evento.target?.closest?.('[data-accion]')
    if (!boton) return
    const accion = boton.dataset.accion
    if (!ACCIONES.has(accion)) return
    // Guarda de cinturón: un `click()` sintético sobre un botón deshabilitado no
    // dispara en el navegador, pero sí podría llegar aquí por otras vías.
    if (boton.disabled) return

    if (accion === ACCION.RENOMBRAR_PARTE) {
      const fila = boton.closest('[data-parte-indice]')
      if (!fila) return
      const i = Number(fila.dataset.parteIndice)
      if (renombrando === i) confirmarRenombre()
      else abrirRenombre(i)
      return
    }
    if (accion === ACCION.ABRIR_ATRIBUTOS) {
      abrirDialogo(DIALOGO.ATRIBUTOS)
      return
    }
    if (accion === ACCION.CANCELAR_ATRIBUTOS) {
      cerrarDialogo(DIALOGO.ATRIBUTOS, MOTIVO_CIERRE.BOTON, true)
      return
    }
    if (accion === ACCION.CANCELAR_CAPAS) {
      cerrarDialogo(DIALOGO.CAPAS, MOTIVO_CIERRE.BOTON, true)
      return
    }
    if (accion === ACCION.APLICAR_CAPAS) {
      emitir(ACCION.APLICAR_CAPAS, { capas: leerCapasElegidas() })
      return
    }
    if (accion === ACCION.APLICAR_ATRIBUTOS) {
      const { atributos, ilegibles } = leerAtributos()
      if (ilegibles.length > 0) {
        // No se emite nada y el diálogo se queda abierto: emitir con los legibles
        // guardaría media pantalla y perdería la otra media sin decirlo.
        if (estadoAtributos) estadoAtributos.textContent = motivoNoNumerico(ilegibles)
        return
      }
      if (estadoAtributos) estadoAtributos.textContent = ''
      emitir(ACCION.APLICAR_ATRIBUTOS, { atributos })
      return
    }
    emitir(accion)
  }

  /** El `change` de los radios de modelo. */
  function alCambiarModelo(evento) {
    const radio = evento.target
    if (!radio?.dataset || radio.dataset.campo !== 'modelo-edificio') return
    const modelo = radio.value
    if (modelo === modeloActual) return
    modeloActual = modelo
    pintarModelo()
    pintarAtributos()
    emitir(ACCION.CAMBIAR_MODELO)
  }

  /** El `change` de las casillas del diálogo de capas. */
  function alCambiarCapa(evento) {
    if (evento.target?.dataset?.campo !== 'capa-elegida') return
    repintarGateCapas()
  }

  /**
   * `Enter` confirma el renombrado, `Escape` lo cancela.
   *
   * ⚠️ **`Escape` aquí no puede confundirse con el de un diálogo**: el editor vive
   * en la sección del panel, que no es ninguno de los dos `<dialog>`, así que los
   * oyentes ni se cruzan.
   */
  function alTeclaPartes(evento) {
    if (renombrando === null) return
    if (evento.target?.dataset?.campo !== 'nombre-parte') return
    if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmarRenombre()
      return
    }
    if (evento.key === 'Escape') {
      // Aquí SÍ se hace `preventDefault`: sin él, un `Escape` dentro de un panel
      // que estuviera dentro de un diálogo cerraría los dos a la vez.
      evento.preventDefault()
      cancelarRenombre()
    }
  }

  /**
   * `Escape` en los diálogos.
   *
   * **No se hace `preventDefault`**: en un navegador de verdad el propio
   * `<dialog>` ya atiende la petición de cierre (evento `cancel`), y cancelar el
   * gesto aquí dejaría esa mitad muerta sin ganar nada. Las dos vías convergen
   * porque {@link cerrarDialogo} es idempotente. En jsdom ésta es la ÚNICA vía:
   * `HTMLDialogElement` allí tiene EXACTAMENTE `constructor` y `open` — ni
   * `showModal()`, ni `close()`, ni `cancel`, ni `::backdrop`.
   */
  function alTeclaCapas(evento) {
    if (evento.key !== 'Escape') return
    cerrarDialogo(DIALOGO.CAPAS, MOTIVO_CIERRE.ESCAPE, true)
  }

  function alTeclaAtributos(evento) {
    if (evento.key !== 'Escape') return
    cerrarDialogo(DIALOGO.ATRIBUTOS, MOTIVO_CIERRE.ESCAPE, true)
  }

  function alCancelCapas() {
    cerrarDialogo(DIALOGO.CAPAS, MOTIVO_CIERRE.ESCAPE, true)
  }

  function alCancelAtributos() {
    cerrarDialogo(DIALOGO.ATRIBUTOS, MOTIVO_CIERRE.ESCAPE, true)
  }

  /**
   * Red de seguridad: el `<dialog>` se ha cerrado sin pasar por aquí. La guarda de
   * `.open` es para un `close` RANCIO: el navegador encola ese evento, así que un
   * `cerrar()` seguido de un `abrir()` en el mismo tick lo entregaría con el
   * diálogo ya reabierto y esto lo volvería a cerrar sin que nadie lo pidiera.
   */
  function alCloseCapas() {
    if (dialogoCapas.open) return
    cerrarDialogo(DIALOGO.CAPAS, MOTIVO_CIERRE.NATIVO, true)
  }

  function alCloseAtributos() {
    if (dialogoAtributos?.open) return
    cerrarDialogo(DIALOGO.ATRIBUTOS, MOTIVO_CIERRE.NATIVO, true)
  }

  escuchar(seccionOrigen, 'click', alPulsar)
  escuchar(seccionOrigen, 'change', alCambiarModelo)
  escuchar(seccionPartes, 'click', alPulsar)
  escuchar(seccionPartes, 'keydown', alTeclaPartes)
  escuchar(dialogoCapas, 'click', alPulsar)
  escuchar(dialogoCapas, 'change', alCambiarCapa)
  escuchar(dialogoCapas, 'keydown', alTeclaCapas)
  escuchar(dialogoCapas, 'cancel', alCancelCapas)
  escuchar(dialogoCapas, 'close', alCloseCapas)

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  /**
   * El primer control al que se puede ir. Se enfoca **un control** y no el
   * diálogo: esto se abre para hacer algo, y aterrizar en el primero es lo que
   * deja empezar.
   *
   * La visibilidad se comprueba por el `hidden` del ancestro y **no** por
   * `offsetParent`, que es la forma habitual y aquí sería una trampa doble: en
   * jsdom vale `null` siempre (no hay maquetado) y en un navegador vale `null`
   * para todo lo que cuelga de un `position: fixed` — que es justo lo que estos
   * diálogos son.
   *
   * @param {HTMLElement} dialogo
   * @returns {HTMLElement}
   */
  function primerFoco(dialogo) {
    for (const el of dialogo.querySelectorAll('input, select, button')) {
      if (!el.disabled && el.closest('[hidden]') === null) return el
    }
    return dialogo
  }

  /** @param {string} cual  Uno de {@link DIALOGO}. */
  function nodoDialogo(cual) {
    return cual === DIALOGO.CAPAS ? dialogoCapas : dialogoAtributos
  }

  function abrirDialogo(cual) {
    const dialogo = nodoDialogo(cual)
    if (destruido || dialogo === null || abierto[cual]) return
    focoPrevio[cual] = doc.activeElement ?? null
    abierto[cual] = true

    // Detección de capacidad, no de navegador: en jsdom `showModal` no existe y
    // llamarlo a pelo lanzaría `TypeError`.
    if (typeof dialogo.showModal === 'function') {
      try {
        dialogo.showModal()
      } catch {
        dialogo.setAttribute('open', '')
      }
    } else {
      dialogo.setAttribute('open', '')
    }

    primerFoco(dialogo).focus()
  }

  /**
   * Cierra y, si toca, avisa. IDEMPOTENTE por construcción: la bandera se baja
   * ANTES de tocar el DOM, así que el `close` que emita el navegador vuelve a
   * entrar aquí y sale por la primera línea.
   *
   * @param {string} cual  Uno de {@link DIALOGO}.
   * @param {string} motivo  Uno de {@link MOTIVO_CIERRE}.
   * @param {boolean} notificar  `false` cuando lo cierra el programa.
   */
  function cerrarDialogo(cual, motivo, notificar) {
    const dialogo = nodoDialogo(cual)
    if (dialogo === null || !abierto[cual]) return
    abierto[cual] = false

    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }

    const previo = focoPrevio[cual]
    focoPrevio[cual] = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()

    if (notificar) repartir(oyentes.cerrar, { dialogo: cual, motivo })
  }

  // Estado inicial coherente: SIMPLIFICADO, sin partes, sin capas.
  pintarModelo()
  pintarPartes()
  pintarCapas()
  repintarGate()

  // ── API pública ───────────────────────────────────────────────────────────

  return {
    /** La sección «Origen del edificio». */
    seccionOrigen,
    /** La sección «Partes», que es el estirador de esta rama. */
    seccionPartes,
    /** El `<dialog>` de reparto por capas. Existe siempre. */
    dialogoCapas,

    /**
     * Todas las raíces que este módulo tiene HOY en el documento: las dos
     * secciones, el diálogo de capas y —solo en COMPLETO— el de atributos. Existe
     * para que un test recorra lo que este módulo escribe **sin suponer** cuántas
     * piezas hay.
     *
     * @returns {HTMLElement[]}
     */
    raices() {
      const lista = [seccionOrigen, seccionPartes, dialogoCapas]
      if (dialogoAtributos !== null) lista.push(dialogoAtributos)
      return lista
    },

    /**
     * Mete las dos secciones en el panel.
     *
     * ⚠️ **El orden es carga útil, no comodidad.** `.gml-bloque--partes` es
     * `flex: 1 1 auto` y hace en esta rama el papel que `.gml-bloque--vertices`
     * hace en la de parcela: es el ÚNICO que se estira. Si se colocara ANTES del
     * bloque de avisos, la lista absorbería la altura por encima de los avisos y
     * el reparto del panel dejaría de parecerse al de la otra rama. Por eso se
     * piden dos anclas y no un contenedor: cada sección va donde va su gemela.
     *
     * @param {Object} donde
     * @param {Node} donde.trasOrigen  Normalmente `.gml-bloque--catastro`.
     * @param {Node} donde.trasPartes  Normalmente `.gml-bloque--vertices`.
     * @throws {TypeError}  Contrato del programador.
     */
    montar({ trasOrigen, trasPartes } = {}) {
      if (destruido) return
      for (const [nombre, nodo] of [
        ['trasOrigen', trasOrigen],
        ['trasPartes', trasPartes],
      ]) {
        if (!nodo || typeof nodo.after !== 'function' || !nodo.parentNode) {
          throw new TypeError(
            `montar: '${nombre}' debe ser un elemento ya insertado en el documento; ` +
              `recibido ${describir(nodo)}.`,
          )
        }
      }
      trasOrigen.after(seccionOrigen)
      trasPartes.after(seccionPartes)
    },

    /**
     * Carga lo que hay que enseñar.
     *
     * `null` deja el panel como recién nacido —sin partes, con el renglón de las
     * cinco vías— **sin tocar el modelo elegido ni lo que haya en el campo de la
     * referencia**: el store nace vacío y elegir el modelo antes de cargar nada es
     * el camino que la ficha describe.
     *
     * @param {Object|null} entrada
     * @param {object|null} [entrada.edificio]  El POJO de `crearEdificio`, o `null`.
     * @param {string} [entrada.modelo]  Fuerza el modelo. Si se omite, se toma el
     *   de `edificio`; si tampoco lo hay, **no se toca**.
     * @param {string} [entrada.refcat]  Qué poner en el campo. **Si se omite, lo
     *   que haya escrito el usuario NO se toca**: un repintado de la lista no puede
     *   borrarle la referencia a medio teclear.
     * @param {boolean} [entrada.puedeConsultarCatastro=true]
     * @throws {TypeError}  Contrato del programador.
     */
    fijar(entrada) {
      if (destruido) return

      if (entrada === null || entrada === undefined) {
        datos = null
        renombrando = null
        pintarPartes()
        pintarAtributos()
        repintarGate()
        return
      }
      if (!esObjeto(entrada)) {
        throw new TypeError(
          `fijar: se espera un objeto {edificio, modelo, refcat, puedeConsultarCatastro} o null; ` +
            `recibido ${describir(entrada)}.`,
        )
      }
      const { edificio = null, modelo, refcat, puedeConsultarCatastro = true } = entrada
      if (edificio !== null && !esObjeto(edificio)) {
        throw new TypeError(
          `fijar: 'edificio' debe ser el POJO de crearEdificio o null; recibido ${describir(edificio)}.`,
        )
      }
      const partes = edificio === null ? [] : edificio.partes
      if (!Array.isArray(partes)) {
        throw new TypeError(
          `fijar: 'edificio.partes' debe ser un array; recibido ${describir(partes)}. ` +
            `¿Se ha pasado un ParteConstruccion o un resumen en vez del Edificio?`,
        )
      }

      // Se normaliza ANTES de tocar un solo nodo: si algo va a lanzar, tiene que
      // lanzar con el panel EXACTAMENTE como estaba.
      const filas = partes.map((p, i) => {
        const nombre = textoONulo(p?.nombre) ?? `Parte ${i + 1}`
        const vertices = Array.isArray(p?.recinto?.vertices) ? p.recinto.vertices.length : null
        return {
          nombre,
          // «sin contorno» es un HECHO —el modelo admite una parte pendiente de
          // dibujar—, no una calificación. Callarlo dejaría al usuario contando
          // partes que no ve en el mapa.
          dato:
            vertices === null
              ? 'sin contorno'
              : vertices === 1
                ? '1 vértice'
                : `${vertices} vértices`,
        }
      })

      const atributos = {}
      for (const clave of ATRIBUTOS_COMPLETO) {
        atributos[clave] = edificio === null ? null : (edificio[clave] ?? null)
      }

      // El modelo se valida ANTES de escribir en `datos`: un `modelo` con un typo
      // no puede dejar el panel con la lista nueva y el selector viejo. Misma
      // barrera que `crearEdificio` y `conModelo` — un typo no degrada en silencio.
      const modeloNuevo = modelo ?? edificio?.modelo ?? null
      if (modeloNuevo !== null && !Object.values(MODELO_EDIFICIO).includes(modeloNuevo)) {
        throw new RangeError(
          `fijar: 'modelo' inválido: ${JSON.stringify(modeloNuevo)}. ` +
            `Válidos: ${Object.values(MODELO_EDIFICIO).join(', ')}.`,
        )
      }

      datos = { partes: filas, atributos, puedeConsultarCatastro: puedeConsultarCatastro === true }
      if (modeloNuevo !== null) modeloActual = modeloNuevo
      if (refcat !== undefined) {
        entradaRefcat.value = typeof refcat === 'string' ? refcat : ''
      }

      renombrando = null
      pintarModelo()
      pintarPartes()
      pintarAtributos()
      repintarGate()
    },

    /**
     * Carga el reparto por capas de un DXF. **No abre el diálogo**: quien decide
     * cuándo se abre es el cableado. `null` lo deja vacío.
     *
     * @param {readonly FilaCapa[]|null} entrada
     * @throws {TypeError}  Contrato del programador.
     */
    fijarCapas(entrada) {
      if (destruido) return
      if (entrada === null || entrada === undefined) {
        capas = null
        pintarCapas()
        return
      }
      if (!Array.isArray(entrada)) {
        throw new TypeError(
          `fijarCapas: se espera un array de {nombre, anillos} o null; recibido ${describir(entrada)}.`,
        )
      }
      capas = entrada.map((c, i) => {
        if (!esObjeto(c) || typeof c.nombre !== 'string') {
          throw new TypeError(
            `fijarCapas: capas[${i}] debe tener un 'nombre' de texto (la cadena vacía vale: es ` +
              `lo que devuelve parseDXF sin código 8); recibido ${describir(c)}.`,
          )
        }
        return { nombre: c.nombre, anillos: Number.isFinite(c.anillos) ? c.anillos : 0 }
      })
      pintarCapas()
    },

    abrirCapas() {
      abrirDialogo(DIALOGO.CAPAS)
    },

    /** Cierra el diálogo de capas **sin borrar lo marcado** y sin avisar. */
    cerrarCapas() {
      cerrarDialogo(DIALOGO.CAPAS, MOTIVO_CIERRE.PROGRAMATICO, false)
    },

    /** @returns {string[]} Los nombres LITERALES de las capas marcadas. */
    capasElegidas() {
      return destruido ? [] : leerCapasElegidas()
    },

    /**
     * Abre el diálogo de los siete atributos. **En SIMPLIFICADO no hace nada**: no
     * hay diálogo que abrir, y fabricarlo aquí al vuelo rompería el criterio 1.
     */
    abrirAtributos() {
      abrirDialogo(DIALOGO.ATRIBUTOS)
    },

    cerrarAtributos() {
      cerrarDialogo(DIALOGO.ATRIBUTOS, MOTIVO_CIERRE.PROGRAMATICO, false)
    },

    /**
     * ¿Existen el bloque de atributos y el botón que lo abre? Es `true` **si y
     * solo si** el modelo es COMPLETO. Se expone para que el cableado y sus
     * pruebas no tengan que espiar el DOM por selector.
     */
    atributosDisponibles() {
      return !destruido && dialogoAtributos !== null
    },

    /** @param {string} cual  Uno de {@link DIALOGO}. */
    abiertoDialogo(cual) {
      return !destruido && abierto[cual] === true
    },

    /**
     * Lo que hay en el panel ahora mismo.
     *
     * @returns {{modelo: string, refcat: string|null, atributos: object|null,
     *   atributosIlegibles: string[]}}
     */
    valores() {
      if (destruido) {
        return { modelo: modeloActual, refcat: null, atributos: null, atributosIlegibles: [] }
      }
      if (dialogoAtributos === null) {
        return { ...instantanea(), atributos: null, atributosIlegibles: [] }
      }
      const { atributos, ilegibles } = leerAtributos()
      return { ...instantanea(), atributos, atributosIlegibles: ilegibles }
    },

    /**
     * Escribe el renglón de estado del panel (`role="status"`).
     *
     * ⚠️ Lo que se escriba aquí vale **hasta el siguiente `fijar`**, que vuelve a
     * escribir ahí el motivo del gate o lo vacía. Es el orden correcto —el motivo
     * de un botón apagado manda sobre el mensaje de la operación anterior— y es el
     * mismo aviso que llevan el cajón de F08 y los diálogos de F09 y F10.
     *
     * @param {string} texto
     */
    estado(texto) {
      if (!destruido) estadoNodo.textContent = typeof texto === 'string' ? texto : ''
    },

    /**
     * Escribe el renglón de procedencia («del Catastro · guardado hace 6 días»).
     * ⚠️ La edad llega REDACTADA desde fuera y no se calcula aquí:
     * `app/cableado-catastro.js#describirEdad` ya sabe decirlo, y una segunda
     * implementación en una vista sería la segunda forma de decir la misma cosa,
     * con sus dos maneras de redondear.
     *
     * @param {string} texto
     */
    procedencia(texto) {
      if (!destruido) {
        procedenciaNodo.textContent = typeof texto === 'string' ? texto : SIN_PROCEDENCIA
      }
    },

    /**
     * Se suscribe a TODAS las intenciones del panel. El oyente recibe
     * {@link AccionEdificio}. Devuelve la BAJA.
     *
     * Un solo punto de suscripción y no ocho: las ocho van al mismo sitio —el
     * cableado— y ocho `alAlgo` serían ocho bajas que dar y ocho oportunidades de
     * olvidar una.
     */
    alAccion(fn) {
      return suscribir(oyentes.accion, fn, 'alAccion')
    },

    /**
     * Se suscribe al cierre de un diálogo POR GESTO DEL USUARIO —«Cancelar» o
     * `Escape`—, nunca al `cerrarCapas()`/`cerrarAtributos()` del programa. El
     * oyente recibe `{dialogo, motivo}`.
     */
    alCerrar(fn) {
      return suscribir(oyentes.cerrar, fn, 'alCerrar')
    },

    /**
     * Retira los escuchadores, saca del documento las secciones y los diálogos, y
     * deja el módulo inerte. **IDEMPOTENTE** y deja el DOM como estaba.
     */
    destruir() {
      if (destruido) return
      cerrarDialogo(DIALOGO.CAPAS, MOTIVO_CIERRE.PROGRAMATICO, false)
      desmontarAtributos()
      destruido = true

      for (const { diana, tipo, fn } of escuchados) diana.removeEventListener(tipo, fn)
      escuchados.length = 0

      oyentes.accion.clear()
      oyentes.cerrar.clear()

      for (const nodo of [seccionOrigen, seccionPartes, dialogoCapas]) {
        if (nodo.parentNode) nodo.parentNode.removeChild(nodo)
      }
    },
  }
}

export default crearPanelEdificio
