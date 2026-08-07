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
//
// ═════════════════════════════════════════════════════════════════════════════
// ═══ F12 · T4.1 · LA TERCERA SECCIÓN: LA PARTE ACTIVA ════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
// F11 dejó la lista de partes en modo LECTURA: se podían mirar y renombrar, y
// nada más. F12 la hace trabajar, y para eso hacen falta cuatro cosas que no
// caben en una fila: el tipo, las plantas, la superficie en vivo y **la tabla de
// coordenadas de la parte que se está editando**.
//
// ── POR QUÉ UNA `<section>` PROPIA Y NO UN BLOQUE DENTRO DE «Partes» ─────────
// Porque la tabla de coordenadas es un ESTIRADOR, y en esta rama ya hay uno:
// `.gml-bloque--partes`. Dos estiradores en el mismo panel descosen el reparto
// —está escrito en `estilos/app.css` y costó una fase medirlo en la otra rama—.
// Con secciones separadas cada una declara su `data-pantalla` y el problema se
// disuelve: la lista se ve en tres pantallas y la tabla **solo en «Edición»**,
// que es exactamente lo que `.gml-bloque--vertices` hace en la rama de parcela.
//
// ⚠️ **Y el `data-pantalla` lo escribe ESTE módulo, no el cableado.** Es una
// desviación consciente del reparto de F11, donde `data-rama-panel` lo sella
// `app/cableado-edificio.js` porque `app/rama.js` lo DESCUBRE. Aquí es al revés:
// a qué pantallas pertenece una sección es una propiedad de LO QUE LA SECCIÓN
// ES, y `index.html` lo declara en línea en cada una de las suyas. Quien fabrica
// la sección declara sus pantallas; si no, este módulo tendría secciones que se
// ven en las cinco pantallas hasta que alguien, en otro fichero, se acuerde.
// **Eso era exactamente el defecto M2 que la fase 0 midió** (2026-08-06): los
// dos bloques de edificio medían 314,97 / 157,06 px IDÉNTICOS en los cinco
// pasos, o sea cinco peldaños encendidos sobre una sola pantalla.
//
// ── EL BLOQUE NO ENSEÑA CONTADORES DE PLANTAS EN UNA PISCINA ────────────────
// ⭐ Criterio de aceptación 1, y con la MISMA forma comprobable que F11 estrenó
// con los siete atributos: en una parte de tipo «Otra» los dos campos de plantas
// **no están ocultos: NO ESTÁN** (ver {@link SELECTOR_PRINCIPAL} y
// {@link montarPlantas}). Un «0» sería mentira —`conPlantas` lo dice con estas
// palabras: «en ésas las plantas no son cero: no aplican»— y un campo vacío
// invitaría a rellenarlo. La ayuda de rasante se va con ellos: explica unos
// campos que no existen.
//
// ── LA CONVERSIÓN DE LAS PLANTAS SE PARTE EN DOS, Y CADA MITAD EN SU CAPA ────
// Esta vista convierte lo que **es** un número y no juzga si es un número de
// PLANTAS: la regla «entero de cero para arriba» vive en
// `edificio/mutaciones.js`, que es la capa que sabe qué es una planta, y allí
// está escrito por qué. Así que de aquí sale:
//   · `''`            → `null`, que significa «aún no se sabe»;
//   · `'2'`           → `2`;
//   · `'2,5'`, `'-1'` → el número, que la mutación rechaza NOMBRÁNDOLO;
//   · `'dos'`         → **la cadena tal cual**, para que el aviso pueda citar lo
//     que se tecleó en vez de un `NaN` que no significa nada para nadie.
// Es distinto de {@link leerAtributos}, que sí retiene lo ilegible: allí
// `crearEdificio` LANZARÍA con un `NaN`, y aquí `conPlantas` **no lanza nunca**
// porque las plantas vienen de un teclado. Dos asimetrías, dos motivos escritos.
//
// ── EL SELECTOR DE MODELO SE PLIEGA CUANDO ENTRA UN EDIFICIO ────────────────
// **MEDIDO (F12 · M1, 1280×720):** el bloque de origen mide 397,19 px y de ésos
// **174,41 px son el selector de modelo permanente**, con lo que la lista de
// partes se quedaba en 45,17 px = UNA fila. Plegado a un renglón con «Cambiar»,
// esos 174,41 px vuelven al panel.
//
// ⛔ **Y se pliega al entrar un edificio, NO al pulsar el radio.** Es la
// diferencia que importa: el apunte de la opción elegida dice qué se PIERDE al
// elegirla —«se borran los siete atributos»— y tiene que seguir a la vista
// **justo después de elegir**, que es cuando importa (ver {@link pintarModelo},
// donde ya está razonado para el otro apunte). Plegar en el `change` haría
// desaparecer esa frase bajo el propio cursor que la provocó. Cuando entra un
// edificio la pregunta ya está contestada y el panel pasa de elegir a trabajar.
//
// ── ⛔ LA TABLA DE COORDENADAS ES UNA CAJA VACÍA, Y NO ES NEGOCIABLE ────────
// `viewer/sincronizacion.js` hace `tablaEl.replaceChildren()` en CADA repintado,
// así que cualquier cosa que este módulo meta dentro de {@link tablaParteActiva}
// se borra al primer `set` del store — sin avisar. Es la misma nota que lleva
// `index.html` sobre `#tabla-vertices`, y aquí vale palabra por palabra: **el
// rótulo va FUERA de la caja**. Este módulo fabrica el `<div>` y no vuelve a
// tocarlo jamás; lo publica para que el cableado (T4.2) se lo pase a
// `sincronizar`, que es su único dueño.

import {
  ATRIBUTOS_COMPLETO,
  ESTADO_CONSERVACION,
  MODELO_EDIFICIO,
  TIPO_PARTE,
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
  BLOQUE_ACTIVA: 'gml-bloque--parte-activa',
  /**
   * F14 · La anfitriona del contraste, VACÍA: su contenido se muda aquí desde la
   * esquina del mapa con `cajon.anfitrion(...)`, con sus oyentes puestos. Se llama
   * `--contraste-edificio` y no `--contraste` a secas porque `index.html` ya usa
   * ese nombre para la de la otra rama, y dos secciones con la misma clase
   * confundirían a `querySelector` y a la hoja de estilos.
   */
  BLOQUE_CONTRASTE: 'gml-bloque--contraste-edificio',

  OPCIONES: 'gml-opciones',
  OPCION: 'gml-opcion',
  OPCION_APUNTE: 'gml-opcion-apunte',
  MODELO_PLEGADO: 'gml-modelo-plegado',
  MODELO_PLEGADO_VALOR: 'gml-modelo-plegado-valor',

  PARTES: 'gml-partes',
  PARTE: 'gml-parte',
  // ⚠️ `--activa` NO es un juicio de valor: dice CUÁL de las trece se está
  // editando, que es un hecho de la interfaz. Y es lo mismo que `viewer/partes.js`
  // distingue en el mapa con el doble grosor.
  PARTE_ACTIVA: 'gml-parte--activa',
  PARTE_NOMBRE: 'gml-parte-nombre',
  PARTE_DATO: 'gml-parte-dato',
  PARTES_VACIO: 'gml-partes-vacio',

  ACTIVA_ROTULO: 'gml-parte-activa-rotulo',
  ACTIVA_PLANTAS: 'gml-parte-activa-plantas',
  ACTIVA_AYUDA: 'gml-parte-activa-ayuda',
  ACTIVA_MEDIDA: 'gml-parte-activa-medida',

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
  // F12 · T4.1. La caja con `overflow:auto` contra la que scrollea la cabecera
  // pegajosa de la tabla de vértices. Es LA MISMA clase que `#tabla-vertices` de
  // `index.html`, y a propósito: las dos ramas enseñan la misma tabla, la fabrica
  // el mismo `viewer/sincronizacion.js` y un segundo cromo para lo mismo sería
  // una segunda manera de que se descuadre.
  'gml-tabla-caja',
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

  // ── F12 · T4.1 ────────────────────────────────────────────────────────────
  SELECCIONAR_PARTE: 'seleccionar-parte',
  ANADIR_PARTE: 'anadir-parte',
  ELIMINAR_PARTE: 'eliminar-parte',
  /** Sale del `change` del `<select>` de tipo, como {@link ACCION}.CAMBIAR_MODELO. */
  CAMBIAR_TIPO_PARTE: 'cambiar-tipo-parte',
  /** Sale del `change` de los dos campos de plantas. */
  CAMBIAR_PLANTAS: 'cambiar-plantas',
  /**
   * ⚠️ **NO se emite: se atiende aquí y se acaba.** Desplegar el selector de
   * modelo no cambia ningún dato —solo deshace un pliegue de la vista—, y
   * mandárselo al cableado sería pedirle que devolviera una orden que no tiene
   * nada que decidir. Se declara igual porque necesita su `data-accion` para que
   * el oyente delegado lo reconozca, exactamente como {@link ACCION}.ABRIR_ATRIBUTOS.
   */
  DESPLEGAR_MODELO: 'desplegar-modelo',
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

  // ── F12 · T4.1 ────────────────────────────────────────────────────────────
  DESPLEGAR_MODELO: `[data-accion="${ACCION.DESPLEGAR_MODELO}"]`,
  ANADIR_PARTE: `[data-accion="${ACCION.ANADIR_PARTE}"]`,
  ELIMINAR_PARTE: `[data-accion="${ACCION.ELIMINAR_PARTE}"]`,
  TIPO_PARTE: '[data-campo="tipo-parte"]',
  HUELLA: '[data-campo="huella-edificio"]',
  SUPERFICIE_ACTIVA: '[data-campo="superficie-parte"]',
  ESTADO_ACTIVA: '[data-estado="parte-activa"]',
  /**
   * ⛔ La caja de la tabla de coordenadas de la parte activa. **Vacía siempre**:
   * su dueño es `viewer/sincronizacion.js`, que la vacía en cada repintado. Ver
   * la cabecera y {@link tablaParteActiva}.
   */
  TABLA_ACTIVA: '[data-tabla="parte-activa"]',
})

/**
 * Los `data-*` de las plantas, que **solo existen cuando la parte activa es de
 * tipo PRINCIPAL**. En una parte «Otra» —una piscina— no están ocultos: **no
 * están**.
 *
 * ⭐ Ésta es la segunda mitad comprobable del **criterio de aceptación 1** («las
 * piscinas no muestran contadores»), y está separada de {@link SELECTOR} por lo
 * mismo que {@link SELECTOR_COMPLETO}: para que el cableado sepa, leyendo esta
 * constante, que a estos nodos **no puede agarrarse en el montaje**. Hay
 * {@link plantasDisponibles} para preguntarlo sin espiar el DOM.
 *
 * @readonly
 */
export const SELECTOR_PRINCIPAL = Object.freeze({
  PLANTAS_SOBRE: '[data-campo="plantas-sobre"]',
  PLANTAS_BAJO: '[data-campo="plantas-bajo"]',
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

// ── F12 · T4.1 · El vocabulario de la parte activa ───────────────────────────

/** Lo que rotula la tercera sección del panel. */
export const TITULO_PARTE_ACTIVA = 'Parte activa'

/** Lo que rotula la caja de coordenadas. Va FUERA de la caja: ver la cabecera. */
export const TITULO_TABLA_ACTIVA = 'Vértices'

/** Lo que se lee en el botón que añade una parte a la lista. */
export const ROTULO_ANADIR = 'Añadir parte'

/** Lo que se lee en el botón que quita la parte activa. */
export const ROTULO_ELIMINAR = 'Eliminar parte'

/** Lo que se lee en el botón que despliega otra vez el selector de modelo. */
export const ROTULO_CAMBIAR_MODELO = 'Cambiar'

/** Con qué se rotula el renglón plegado del modelo. */
export const ETIQUETA_MODELO_PLEGADO = 'Modelo'

/**
 * Rótulo humano de cada tipo de parte. El `value` de la opción es el valor de
 * `TIPO_PARTE` **sin traducir** (contrato K.2); lo que se lee es esto.
 *
 * ⚠️ «Otra construcción» lleva el paréntesis del modelo —`model/edificio.js` dice
 * «`OTRA` = piscina y similares»— porque el rótulo a secas no dice qué cabe
 * dentro, y lo que cabe dentro es justo lo que hay que reconocer para elegirlo.
 *
 * @readonly
 */
export const ROTULO_TIPO_PARTE = Object.freeze({
  [TIPO_PARTE.PRINCIPAL]: 'Principal',
  [TIPO_PARTE.OTRA]: 'Otra construcción (piscina y similares)',
})

/** Rótulo del contador de plantas sobre rasante. */
export const ROTULO_PLANTAS_SOBRE = 'Plantas sobre rasante'

/** Rótulo del contador de plantas bajo rasante. */
export const ROTULO_PLANTAS_BAJO = 'Bajo rasante'

/**
 * La ayuda de los dos contadores. **Literal de la ficha de F12** (§15.1): *«bajo
 * rasante = sótanos; rasante es la línea del terreno»*. Se cita con esas palabras
 * y no con una redacción propia: es la única frase del proyecto que explica qué
 * es la rasante, y dos versiones de ella serían dos definiciones.
 */
export const AYUDA_PLANTAS = 'Bajo rasante = sótanos; rasante es la línea del terreno.'

/**
 * Lo que dice el bloque cuando la parte activa todavía no tiene contorno. Es la
 * versión ACCIONABLE de lo que la fila ya dice con «sin contorno»: aquí hay sitio
 * para decir qué hacer, y el gesto vive en la barra sobre el mapa —donde ocurre—,
 * no en un botón de este panel.
 */
export const PENDIENTE_DE_DIBUJAR =
  'Esta parte todavía no tiene recinto: está pendiente de dibujarlo. Se dibuja sobre el mapa, ' +
  'vértice a vértice, con «Dibujar recinto» de la barra de edición; hasta entonces no se pinta ' +
  'ni suma superficie.'

/**
 * Lo que dice el bloque cuando no hay ninguna parte elegida — que es también el
 * motivo por el que «Eliminar parte» está apagado, y por eso lo dice entero: un
 * botón gris y un renglón vacío obligan a adivinar.
 */
export const SIN_PARTE_ACTIVA =
  'No hay ninguna parte elegida. Pulsa una de la lista de arriba para ver y editar su tipo, sus ' +
  'plantas y sus vértices, o añade una nueva con «Añadir parte».'

/**
 * Lo que se lee en el renglón de la medida mientras no hay nada que medir. Un
 * guion y no un «0 m²»: cero metros cuadrados es una superficie, y aquí no la
 * hay. Misma distinción que las plantas de una piscina.
 */
export const SIN_MEDIDA = '—'

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
 * @property {string|null} tipo  El tipo destino, solo en `CAMBIAR_TIPO_PARTE`.
 * @property {{sobre: *, bajo: *}|null} plantas  Lo que hay en los dos campos,
 *   solo en `CAMBIAR_PLANTAS`, ya convertido a número **cuando es un número** —y
 *   tal cual cuando no lo es, para que el aviso pueda citarlo—. Ver la cabecera.
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
  /** Qué parte se está editando. `null` = ninguna. F12 · T4.1. */
  let activa = null
  /**
   * ¿Está plegado el selector de modelo? Nace DESPLEGADO: mientras no ha entrado
   * ningún edificio, elegir el modelo es lo primero que hay que poder hacer.
   */
  let plegado = false
  /**
   * ¿Lo ha desplegado el usuario con «Cambiar»? Mientras siga habiendo edificio,
   * eso GANA sobre el pliegue automático: un repintado —y hay uno por cada
   * mutación— no puede cerrarle el selector en las manos a quien acaba de
   * abrirlo. Se olvida con `fijar(null)`, que es volver a empezar.
   */
  let desplegadoAMano = false
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

  // ══ El eje PASO de esta rama (F12 · T4.1, defecto M2) ═════════════════════
  //
  // ⛔ **Hasta el 2026-08-06 las secciones de edificio NO declaraban esto**, y
  // medirlo fue el hallazgo M2 de la fase 0: los dos bloques daban 314,97 y
  // 157,06 px **idénticos en los cinco pasos**, o sea que el rail encendía cinco
  // peldaños sobre una sola pantalla. Es el mismo defecto decorativo que la
  // rebanada 3 del rework curó en la rama de parcela.
  //
  // El reparto CALCA al de `index.html`, porque las dos ramas hacen el mismo
  // trabajo con otros objetos:
  //   · «Origen del edificio» → `entrada`, como `.gml-bloque--catastro`.
  //   · «Partes» → `validacion edicion informe`, como `.gml-bloque--vertices`:
  //     es la relación de lo que hay, y se consulta en las tres.
  //   · «Parte activa» → `edicion` **y solo ahí**. Lleva la tabla de coordenadas,
  //     que es un estirador, y dos estiradores a la vez descosen el panel. Fuera
  //     de «Edición» no hay nada que editar.
  //
  // ⭐ **F14 añade la cuarta**: «Contraste», que solo existe en `diagnostico` y es
  // la anfitriona de `viewer/cajon-contraste-edificio.js`. Es el espejo exacto de
  // `.gml-bloque--contraste` de `index.html` en la otra rama, y por el mismo
  // motivo: hasta F14 la rama EDIFICIO no llegaba a esa pantalla y no tenía nada
  // que enseñar en ella.
  const PANTALLA = Object.freeze({
    ORIGEN: 'entrada',
    PARTES: 'validacion edicion informe',
    ACTIVA: 'edicion',
    CONTRASTE: 'diagnostico',
  })

  // ══ Sección 1 · «Origen del edificio» ═════════════════════════════════════

  const seccionOrigen = crear('section', `gml-bloque ${CLASE.BLOQUE}`)
  seccionOrigen.setAttribute('data-pantalla', PANTALLA.ORIGEN)

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

  // ── El renglón que sustituye al selector cuando ya hay edificio ────────────
  // 174,41 px MEDIDOS que vuelven al panel (F12 · M1, 1280×720). Nace `hidden`:
  // es el selector entero quien manda mientras la pregunta siga abierta. El
  // porqué de plegar al ENTRAR un edificio y no al pulsar el radio, en la
  // cabecera.
  const resumenModelo = crear('p', CLASE.MODELO_PLEGADO)
  resumenModelo.append(crear('span', null, `${ETIQUETA_MODELO_PLEGADO}: `))
  const resumenModeloValor = crear('span', CLASE.MODELO_PLEGADO_VALOR, '')
  const botonCambiarModelo = crear('button', 'gml-boton gml-boton--menudo', ROTULO_CAMBIAR_MODELO)
  botonCambiarModelo.type = 'button'
  botonCambiarModelo.dataset.accion = ACCION.DESPLEGAR_MODELO
  // El botón dice «Cambiar» a secas —cabe en el renglón— y el lector de pantalla
  // oye la frase entera: sin esto, «Cambiar» suelto no dice cambiar QUÉ.
  botonCambiarModelo.setAttribute('aria-label', 'Cambiar el modelo del edificio')
  resumenModelo.append(resumenModeloValor, botonCambiarModelo)
  resumenModelo.hidden = true
  seccionOrigen.append(resumenModelo)

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
  seccionPartes.setAttribute('data-pantalla', PANTALLA.PARTES)
  const filaRotuloPartes = crear('div', 'gml-rotulo-fila')
  filaRotuloPartes.append(crear('h2', 'gml-rotulo', TITULO_PARTES))
  // Segundo hijo de la fila, sin clase: hereda 11 px y gris, igual que el «X · Y
  // (m)» de la fila de «Vértices».
  const cuentaPartes = crear('span', null, '0 partes')
  filaRotuloPartes.append(cuentaPartes)
  // La suma de huella sobre rasante (ficha §15.4). Llega REDACTADA desde fuera,
  // como la procedencia y por lo mismo: la envolvente la calcula
  // `edificio/envolvente.js` y la mide `geo/area.js`; una vista que sumara áreas
  // sería una segunda forma de decir la misma cifra, con su propio redondeo.
  const huellaNodo = crear('span', null, '')
  huellaNodo.dataset.campo = 'huella-edificio'
  filaRotuloPartes.append(huellaNodo)
  // «Añadir parte» va en el hueco de COSTE 0 px de la fila del `<h2>` —el que
  // estrenó F08 y midió F11: `.gml-boton--menudo` mide 15,19 px contra los 15,95
  // del renglón del rótulo—, y no en una fila propia, que serían ~36 px salidos
  // de la lista. «Eliminar parte» NO le hace compañía aquí: actúa sobre la parte
  // ACTIVA, así que vive en el bloque que habla de ella, donde se ve sobre qué se
  // está pulsando. Un «Eliminar» a 300 px de la fila seleccionada, en una lista
  // de trece filas que se parecen, es la clase de botón que se pulsa por error.
  const accionesPartes = crear('div', 'gml-rotulo-acciones')
  const botonAnadir = crear('button', 'gml-boton gml-boton--menudo', ROTULO_ANADIR)
  botonAnadir.type = 'button'
  botonAnadir.dataset.accion = ACCION.ANADIR_PARTE
  accionesPartes.append(botonAnadir)
  filaRotuloPartes.append(accionesPartes)
  seccionPartes.append(filaRotuloPartes)

  const listaPartes = crear('ul', CLASE.PARTES)
  listaPartes.dataset.lista = 'partes'
  seccionPartes.append(listaPartes)

  // ══ Sección 3 · «Parte activa» — tipo, plantas, medida y coordenadas ══════
  //
  // Sección propia y no un bloque dentro de «Partes»: la tabla de coordenadas es
  // un estirador y en esta rama ya hay uno. El razonamiento entero, y el
  // `data-pantalla` que lo hace posible, en la cabecera.

  const seccionActiva = crear('section', `gml-bloque ${CLASE.BLOQUE_ACTIVA}`)
  seccionActiva.setAttribute('data-pantalla', PANTALLA.ACTIVA)

  const filaRotuloActiva = crear('div', 'gml-rotulo-fila')
  const rotuloActiva = crear('h2', 'gml-rotulo', TITULO_PARTE_ACTIVA)
  rotuloActiva.id = id('rotulo-activa')
  filaRotuloActiva.append(rotuloActiva)
  const nombreActiva = crear('span', CLASE.ACTIVA_ROTULO, '')
  filaRotuloActiva.append(nombreActiva)
  const accionesActiva = crear('div', 'gml-rotulo-acciones')
  const botonEliminar = crear('button', 'gml-boton gml-boton--menudo', ROTULO_ELIMINAR)
  botonEliminar.type = 'button'
  botonEliminar.dataset.accion = ACCION.ELIMINAR_PARTE
  accionesActiva.append(botonEliminar)
  filaRotuloActiva.append(accionesActiva)
  seccionActiva.append(filaRotuloActiva)

  // El renglón que dice por qué. Va ANTES del cuerpo porque cuando no hay parte
  // elegida es lo ÚNICO que hay, y porque es el motivo del «Eliminar parte»
  // apagado (regla de oro 1: el botón y su porqué, en el mismo paso).
  const estadoActiva = crear('p', 'gml-accion-estado', '')
  estadoActiva.dataset.estado = 'parte-activa'
  estadoActiva.setAttribute('role', 'status')
  seccionActiva.append(estadoActiva)

  // ⛔ EL CUERPO SE OCULTA CON `hidden`, PERO LA `<section>` NO. Y hay motivo
  // medido: `app/rama.js` gobierna el `hidden` de las `<section>` que descubre
  // por `data-rama-panel` —lo ESCRIBE en cada conmutación— así que un `hidden`
  // puesto aquí sobre la sección se lo llevaría por delante la primera vez que
  // alguien tocase el conmutador de rama, y al revés. Dos dueños del mismo
  // atributo es un intercambio que se descuadra solo. El cuerpo es un `<div>`
  // interior y de ése no hay más dueño que este módulo.
  const cuerpoActiva = crear('div', null)
  seccionActiva.append(cuerpoActiva)

  // ── El tipo ───────────────────────────────────────────────────────────────
  // Un `<select>` de dos y no dos radios: los radios de esta rama ya significan
  // otra cosa —el modelo—, y un segundo `radiogroup` a tres renglones de
  // distancia se lee como una continuación del primero. Además el tipo se cambia
  // pocas veces y no necesita ver las dos opciones a la vez.
  const campoTipo = crear('div', 'gml-campo')
  const etiquetaTipo = crear('label', 'gml-campo-etiqueta', 'Tipo')
  etiquetaTipo.htmlFor = id('tipo-parte')
  const selectTipo = doc.createElement('select')
  selectTipo.id = id('tipo-parte')
  selectTipo.className = 'gml-entrada'
  selectTipo.dataset.campo = 'tipo-parte'
  for (const valor of Object.values(TIPO_PARTE)) {
    const opcion = doc.createElement('option')
    opcion.value = valor // ⛔ SIN TRADUCIR: es el valor de TIPO_PARTE.
    opcion.textContent = ROTULO_TIPO_PARTE[valor]
    selectTipo.append(opcion)
  }
  campoTipo.append(etiquetaTipo, selectTipo)
  cuerpoActiva.append(campoTipo)

  // ── Las plantas: NACEN Y MUEREN CON EL TIPO ───────────────────────────────
  // En una parte «Otra» no existen. Ver `SELECTOR_PRINCIPAL` y el criterio 1.
  /** @type {HTMLElement|null} */
  let cajaPlantas = null
  /** @type {HTMLInputElement|null} */
  let entradaSobre = null
  /** @type {HTMLInputElement|null} */
  let entradaBajo = null

  // ── La medida en vivo ─────────────────────────────────────────────────────
  const medidaNodo = crear('p', CLASE.ACTIVA_MEDIDA, SIN_MEDIDA)
  medidaNodo.dataset.campo = 'superficie-parte'
  cuerpoActiva.append(medidaNodo)

  // ── La tabla de coordenadas ───────────────────────────────────────────────
  // ⛔ CAJA VACÍA. El rótulo va FUERA porque `sincronizar` hace
  // `replaceChildren()` dentro en cada repintado; metido dentro desaparecería al
  // primer `set`. Misma disposición, y misma nota, que `#tabla-vertices` en
  // `index.html`.
  const rotuloTabla = crear('p', 'gml-campo-etiqueta', TITULO_TABLA_ACTIVA)
  cuerpoActiva.append(rotuloTabla)
  const tablaActiva = crear('div', 'gml-tabla-caja')
  tablaActiva.dataset.tabla = 'parte-activa'
  cuerpoActiva.append(tablaActiva)

  // ══ Sección 4 · «Contraste» — la anfitriona, VACÍA (F14) ══════════════════
  //
  // Espejo exacto de `.gml-bloque--contraste` de `index.html` en la otra rama, y
  // por los mismos tres motivos, que conviene no volver a discutir:
  //
  //   · **VACÍA, y no se fabrica aquí nada de lo que va dentro.** El contenido lo
  //     muda `viewer/cajon-contraste-edificio.js#anfitrion` desde la esquina del
  //     mapa, con sus oyentes puestos. Duplicar sus nodos pondría un segundo
  //     `[data-contraste="titular"]` y un segundo
  //     `[data-accion="preparar-informe-edificio"]` en el documento, y
  //     `querySelector` se queda con el PRIMERO: uno de los dos juegos nacería
  //     mudo y sin un solo síntoma.
  //   · **`data-pantalla="diagnostico"` y solo ahí.** Es el estirador de esa
  //     pantalla, igual que «Parte activa» lo es de Edición, y por eso no comparte
  //     pantalla con ninguna otra: dos estiradores a la vez descosen el reparto.
  //   · **Sin `data-rama-panel` escrito aquí.** Lo sella `app/cableado-edificio.js`
  //     al montar el panel, que es quien tiene esa responsabilidad desde F11 —
  //     `secciones()` la incluye, así que entra en el intercambio sola, que es
  //     justo lo que T4.1 aprendió cuando la tercera sección se quedó fuera.
  const seccionContraste = crear('section', `gml-bloque ${CLASE.BLOQUE_CONTRASTE}`)
  seccionContraste.setAttribute('data-pantalla', PANTALLA.CONTRASTE)
  seccionContraste.setAttribute('data-anfitrion', 'contraste-edificio')

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

  // ── Las plantas, que solo existen en una parte PRINCIPAL ──────────────────

  /**
   * Fabrica los dos contadores de plantas y su ayuda, justo debajo del tipo.
   *
   * ⭐ Criterio de aceptación 1, segunda mitad: en una parte «Otra» esto no se
   * llama, así que **los campos no están ocultos: no están**. Igual que el
   * `<dialog>` de los siete atributos en modelo SIMPLIFICADO, y por lo mismo — se
   * puede señalar con el dedo, y hay un `it` que lo hace.
   */
  function montarPlantas() {
    if (cajaPlantas !== null) return

    cajaPlantas = crear('div', 'gml-campo')
    const rejilla = crear('div', CLASE.ACTIVA_PLANTAS)

    const par = (sufijo, rotulo) => {
      const etiqueta = crear('label', 'gml-campo-etiqueta', rotulo)
      etiqueta.htmlFor = id(sufijo)
      const entrada = doc.createElement('input')
      // ⚠️ `type="text"` con `inputmode="numeric"` y NO `type="number"`, por el
      // mismo motivo MEDIDO que los años del diálogo de atributos: con `number`
      // el navegador VACÍA `.value` ante lo que no sabe leer, así que «dos»
      // llegaría aquí como cadena vacía y se guardaría como «sin indicar» en
      // silencio. Con `text` el texto llega entero y `conPlantas` puede CITARLO
      // en su aviso.
      entrada.type = 'text'
      entrada.setAttribute('inputmode', 'numeric')
      entrada.setAttribute('autocomplete', 'off')
      entrada.id = id(sufijo)
      entrada.className = 'gml-entrada'
      entrada.dataset.campo = sufijo
      return { etiqueta, entrada }
    }

    const sobre = par('plantas-sobre', ROTULO_PLANTAS_SOBRE)
    const bajo = par('plantas-bajo', ROTULO_PLANTAS_BAJO)
    // Las dos etiquetas y luego los dos campos: con la rejilla de dos columnas de
    // `estilos/app.css` eso deja los rótulos en un renglón y los campos en otro,
    // alineados. En orden etiqueta-campo-etiqueta-campo quedarían escalonados.
    rejilla.append(sobre.etiqueta, bajo.etiqueta, sobre.entrada, bajo.entrada)
    entradaSobre = sobre.entrada
    entradaBajo = bajo.entrada

    cajaPlantas.append(rejilla, crear('p', CLASE.ACTIVA_AYUDA, AYUDA_PLANTAS))
    campoTipo.after(cajaPlantas)
  }

  /**
   * Retira los dos contadores y su ayuda.
   *
   * ⚠️ **Esto no borra ninguna planta**, igual que {@link desmontarAtributos} no
   * borra ningún atributo: las plantas viven en el `ParteConstruccion` del store.
   * Quien las borra de verdad es el modelo, que fuerza a `null` las de una parte
   * `OTRA` —y `conTipoParte` lo anuncia con `PLANTAS_NO_APLICAN` antes de que el
   * cableado lo aplique—. La ayuda se va con los campos porque explica unos
   * campos que ya no existen.
   */
  function desmontarPlantas() {
    if (cajaPlantas === null) return
    if (cajaPlantas.parentNode) cajaPlantas.parentNode.removeChild(cajaPlantas)
    cajaPlantas = null
    entradaSobre = null
    entradaBajo = null
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
    if (activa === i) li.classList.add(CLASE.PARTE_ACTIVA)

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
      // ⚠️ EL NOMBRE ES UN `<button>`, NO UN `<span>` CON UN `click` ENCIMA.
      // Elegir la parte es la acción principal de la fila, y una fila clicable
      // que no es un control no se alcanza con el tabulador, no responde a Intro
      // ni a Espacio, y no se anuncia como algo pulsable. El cromo del navegador
      // lo quita `estilos/app.css` con `.gml-parte-nombre` sobre un botón; aquí
      // no se escribe ni un estilo (ver la cabecera).
      const elegir = crear('button', CLASE.PARTE_NOMBRE, parte.nombre)
      elegir.type = 'button'
      elegir.dataset.accion = ACCION.SELECCIONAR_PARTE
      // `aria-current` y no `aria-pressed`: no es un interruptor que se queda
      // pulsado, es CUÁL de los elementos de una lista es el actual.
      if (activa === i) elegir.setAttribute('aria-current', 'true')
      li.append(elegir)
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
   * El bloque de la parte activa: tipo, plantas, medida, estado y coordenadas.
   *
   * ⚠️ **La medida se devuelve SIEMPRE a {@link SIN_MEDIDA}**, también cuando la
   * parte sí tiene contorno. No es descuido: esta función corre al cambiar de
   * parte, y dejar ahí la superficie de la anterior enseñaría los 245,90 m² de
   * «Parte 10» bajo el nombre de «Parte 11» hasta que alguien llamase a
   * {@link medidas}. Una cifra correcta atribuida al objeto equivocado es peor
   * que un guion. Quien la escribe es el cableado, justo después.
   */
  function pintarParteActiva() {
    const fila = activa === null ? null : (datos?.partes?.[activa] ?? null)

    // ⛔ La `<section>` no se toca: su `hidden` es de `app/rama.js`. Ver el
    // comentario del montaje de `cuerpoActiva`.
    cuerpoActiva.hidden = fila === null
    botonEliminar.disabled = fila === null
    medidaNodo.textContent = SIN_MEDIDA

    if (fila === null) {
      desmontarPlantas()
      nombreActiva.textContent = ''
      estadoActiva.textContent = SIN_PARTE_ACTIVA
      return
    }

    nombreActiva.textContent = fila.nombre
    selectTipo.value = fila.tipo

    if (fila.tipo === TIPO_PARTE.PRINCIPAL) montarPlantas()
    else desmontarPlantas()
    if (entradaSobre) entradaSobre.value = fila.sobre === null ? '' : String(fila.sobre)
    if (entradaBajo) entradaBajo.value = fila.bajo === null ? '' : String(fila.bajo)

    estadoActiva.textContent = fila.tieneRecinto ? '' : PENDIENTE_DE_DIBUJAR
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

    // El pliegue: o el selector entero, o el renglón. Nunca los dos, nunca
    // ninguno. Se ocultan con `hidden` —no se retiran— porque los dos tienen que
    // poder volver sin refabricarse; lo que sí se RETIRA es el diálogo de
    // atributos, que es otra cosa y es el criterio 1.
    campoModelo.hidden = plegado
    resumenModelo.hidden = !plegado
    // El rótulo completo, no una abreviatura: el renglón plegado sustituye a la
    // opción elegida y tiene que decir lo mismo que decía ella.
    resumenModeloValor.textContent = ROTULO_MODELO[modeloActual] ?? modeloActual
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
      tipo: null,
      plantas: null,
      ...extra,
      valores: instantanea(),
    })
  }

  /**
   * Convierte lo tecleado en un contador de plantas.
   *
   * La mitad de la conversión que le toca a la interfaz, y solo ésa: **aquí se
   * decide si es un número, no si es un número de PLANTAS**. La regla «entero de
   * cero para arriba» vive en `edificio/mutaciones.js#conPlantas`, que es la capa
   * que sabe qué es una planta y que además **no lanza nunca** con esto, porque
   * viene de un teclado. Lo ilegible viaja TAL CUAL para que el aviso pueda
   * citarlo: `NaN` no significa nada para quien escribió «dos».
   *
   * @param {HTMLInputElement|null} entrada
   * @returns {number|string|null|undefined}  `undefined` = ese campo no existe,
   *   que en `conPlantas` significa «no tocar».
   */
  function leerPlantas(entrada) {
    if (!entrada) return undefined
    const bruto = typeof entrada.value === 'string' ? entrada.value.trim() : ''
    if (bruto === '') return null
    const numero = Number(bruto.replace(',', '.'))
    return Number.isFinite(numero) ? numero : bruto
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
    if (accion === ACCION.SELECCIONAR_PARTE) {
      const fila = boton.closest('[data-parte-indice]')
      if (!fila) return
      const i = Number(fila.dataset.parteIndice)
      // Se emite también cuando ya era la activa, y es a propósito: el cableado
      // usa esa orden para volver a encuadrar el mapa sobre la parte, que es lo
      // que espera quien pulsa dos veces la misma fila. Filtrarlo aquí sería que
      // el segundo clic no hiciera nada sin decir por qué.
      emitir(ACCION.SELECCIONAR_PARTE, { indice: i })
      return
    }
    if (accion === ACCION.ELIMINAR_PARTE) {
      // El botón nace apagado y solo se enciende con una parte elegida, así que
      // esta guarda no debería alcanzarse; está por lo mismo que la de `disabled`
      // de arriba: un `click()` sintético puede llegar por otras vías, y emitir
      // «elimina la parte null» sería mandarle al cableado una orden imposible.
      if (activa === null) return
      emitir(ACCION.ELIMINAR_PARTE, { indice: activa })
      return
    }
    if (accion === ACCION.DESPLEGAR_MODELO) {
      // ⚠️ NO se emite: no cambia ningún dato. Ver {@link ACCION}.DESPLEGAR_MODELO.
      plegado = false
      desplegadoAMano = true
      pintarModelo()
      // El foco salta al radio de la opción que está puesta: quien ha pulsado
      // «Cambiar» quiere elegir, y el botón que acaba de pulsar ya no está.
      radios.get(modeloActual)?.focus()
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

  /**
   * El `change` del `<select>` de tipo y de los dos contadores de plantas.
   *
   * ⚠️ **`change` y no `input`**: `input` dispara en cada tecla, así que teclear
   * «12» mandaría primero un «1» —que es un número de plantas perfectamente
   * válido— y lo escribiría en el store antes de que el usuario acabase. Con
   * `change` la orden sale al salir del campo o al pulsar Intro, que es cuando
   * el dato está dicho.
   */
  function alCambiarActiva(evento) {
    const campo = evento.target?.dataset?.campo
    if (campo === 'tipo-parte') {
      if (activa === null) return
      emitir(ACCION.CAMBIAR_TIPO_PARTE, { indice: activa, tipo: evento.target.value })
      return
    }
    if (campo === 'plantas-sobre' || campo === 'plantas-bajo') {
      if (activa === null) return
      // Se mandan LOS DOS, no solo el que ha cambiado. `conPlantas` interpreta
      // `undefined` como «no tocar», así que mandar uno solo sería correcto; pero
      // mandar los dos hace que la orden describa el estado completo del
      // formulario, que es lo que el usuario ve, y evita que un campo a medio
      // corregir se quede fuera del envío por no haber salido de él.
      emitir(ACCION.CAMBIAR_PLANTAS, {
        indice: activa,
        plantas: { sobre: leerPlantas(entradaSobre), bajo: leerPlantas(entradaBajo) },
      })
    }
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
  escuchar(seccionActiva, 'click', alPulsar)
  escuchar(seccionActiva, 'change', alCambiarActiva)
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

  // Estado inicial coherente: SIMPLIFICADO, sin partes, sin capas, sin parte
  // activa y con el selector DESPLEGADO — mientras no ha entrado ningún
  // edificio, elegir el modelo es lo primero que hay que poder hacer.
  pintarModelo()
  pintarPartes()
  pintarParteActiva()
  pintarCapas()
  repintarGate()

  // ── API pública ───────────────────────────────────────────────────────────

  return {
    /** La sección «Origen del edificio». */
    seccionOrigen,
    /** La sección «Partes», que es el estirador de esta rama. */
    seccionPartes,
    /** La sección «Parte activa» (F12 · T4.1). Solo se ve en la pantalla «Edición». */
    seccionActiva,
    /**
     * La sección anfitriona del contraste (F14). **VACÍA a propósito**: su
     * contenido se muda aquí desde la esquina del mapa. Solo se ve en la pantalla
     * «Diagnóstico».
     */
    seccionContraste,
    /** El `<dialog>` de reparto por capas. Existe siempre. */
    dialogoCapas,

    /**
     * La caja de la tabla de coordenadas de la parte activa, para pasársela a
     * `viewer/index.js#sincronizar` como su `tablaEl`.
     *
     * ⛔ **Su dueño es `sincronizar`, no este módulo.** Aquella función hace
     * `replaceChildren()` dentro en cada repintado, así que lo que se meta aquí
     * desaparece al primer `set` del store, sin avisar. Este módulo la fabrica
     * una vez y no la vuelve a tocar; el rótulo va FUERA, en la sección.
     *
     * @type {HTMLElement}
     */
    tablaParteActiva: tablaActiva,

    /**
     * Todas las raíces que este módulo tiene HOY en el documento: las CUATRO
     * secciones, el diálogo de capas y —solo en COMPLETO— el de atributos. Existe
     * para que un test recorra lo que este módulo escribe **sin suponer** cuántas
     * piezas hay.
     *
     * @returns {HTMLElement[]}
     */
    raices() {
      const lista = [
        seccionOrigen,
        seccionPartes,
        seccionActiva,
        seccionContraste,
        dialogoCapas,
      ]
      if (dialogoAtributos !== null) lista.push(dialogoAtributos)
      return lista
    },

    /**
     * Las `<section>` que este módulo mete en el panel, en el orden en que
     * quedan. Existe para que el cableado las selle con `data-rama-panel` **sin
     * nombrarlas de una en una**: F11 las selló a mano y añadir la tercera habría
     * dejado una sección de edificio visible sobre la rama de parcela, en
     * silencio, hasta que alguien lo viera con los ojos.
     *
     * ⭐ Y esa lección se cobra hoy: F14 añade la CUARTA («Contraste») y no hay
     * que tocar el cableado — entra en el sellado y en el intercambio sola, por
     * estar aquí.
     *
     * @returns {HTMLElement[]}
     */
    secciones() {
      return [seccionOrigen, seccionPartes, seccionActiva, seccionContraste]
    },

    /**
     * Mete las CUATRO secciones en el panel. Se piden DOS anclas y no cuatro: las
     * de «Parte activa» y «Contraste» van pegadas a la de «Partes» (ver abajo).
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
      // La tercera va PEGADA a la lista, y no pide ancla propia: «la parte
      // activa» solo significa algo debajo de la lista de la que se elige.
      seccionPartes.after(seccionActiva)
      // Y la cuarta detrás de la tercera, así que en Diagnóstico —donde ninguna de
      // las otras se ve— queda ella sola ocupando la columna. Tampoco pide ancla:
      // el contraste se lee después de haber visto las partes, no antes.
      seccionActiva.after(seccionContraste)
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
     * @param {number|null} [entrada.activa]  Qué parte se está editando, por su
     *   índice. **Si se omite se conserva la que hubiera**, y si el índice no
     *   cae dentro de la lista nueva se queda en `null` — que es lo que pasa al
     *   eliminar la parte activa, o sea un uso normal y no un error: por eso no
     *   lanza.
     * @throws {TypeError}  Contrato del programador.
     */
    fijar(entrada) {
      if (destruido) return

      if (entrada === null || entrada === undefined) {
        datos = null
        renombrando = null
        activa = null
        // Vuelve a nacer: sin edificio, la pregunta del modelo se reabre — y se
        // olvida que alguien la hubiera reabierto a mano.
        plegado = false
        desplegadoAMano = false
        pintarModelo()
        pintarPartes()
        pintarParteActiva()
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
      const {
        edificio = null,
        modelo,
        refcat,
        puedeConsultarCatastro = true,
        activa: activaNueva,
      } = entrada
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
          // Lo que necesita el bloque de parte activa. Un `tipo` que no sea de
          // `TIPO_PARTE` se trata como PRINCIPAL **para pintar**, y no lanza: el
          // modelo ya lo impide al construir, así que aquí solo puede llegar por
          // un POJO fabricado a mano en una prueba, y reventar la vista por eso
          // sería castigar al llamante equivocado.
          tipo: p?.tipo === TIPO_PARTE.OTRA ? TIPO_PARTE.OTRA : TIPO_PARTE.PRINCIPAL,
          sobre: Number.isFinite(p?.plantasSobreRasante) ? p.plantasSobreRasante : null,
          bajo: Number.isFinite(p?.plantasBajoRasante) ? p.plantasBajoRasante : null,
          tieneRecinto: vertices !== null,
        }
      })

      // La parte activa se valida ANTES de escribir, como el modelo: un índice
      // fuera de la lista no puede dejar el panel con la lista nueva y el bloque
      // apuntando a una parte que ya no está. **No lanza**: quedarse sin parte
      // activa es lo que pasa cuando se elimina la que estaba, y eso es un uso
      // normal, no un error de programación.
      const activaPedida = activaNueva === undefined ? activa : activaNueva
      const activaFinal =
        Number.isInteger(activaPedida) && activaPedida >= 0 && activaPedida < filas.length
          ? activaPedida
          : null

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
      activa = activaFinal

      // ⛔ EL PLIEGUE, Y SU MOMENTO. Entra un edificio ⇒ la pregunta «¿qué
      // necesitas generar?» ya está contestada y esos 174,41 px medidos vuelven
      // al panel. **No se pliega en el `change` del radio**, que es cuando el
      // apunte de la opción elegida —el que dice qué se pierde— tiene que estar a
      // la vista. El porqué entero, en la cabecera.
      //
      // Y no se cierra solo: si el usuario lo abrió con «Cambiar», un repintado
      // —y hay uno por cada mutación— no puede cerrárselo en las manos.
      if (edificio !== null && !desplegadoAMano) plegado = true

      renombrando = null
      pintarModelo()
      pintarPartes()
      pintarParteActiva()
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

    /**
     * ¿Existen los dos contadores de plantas? Es `true` **si y solo si** hay una
     * parte activa y es de tipo PRINCIPAL. Gemelo de {@link atributosDisponibles},
     * y por lo mismo: en una piscina los contadores no están ocultos, no están
     * (criterio de aceptación 1).
     */
    plantasDisponibles() {
      return !destruido && cajaPlantas !== null
    },

    /**
     * Qué parte se está editando, por su índice, o `null`. Es lo que el panel
     * cree; la verdad está en el store, y las dos se juntan en cada `fijar`.
     *
     * @returns {number|null}
     */
    parteActiva() {
      return destruido ? null : activa
    },

    /** ¿Está plegado el selector de modelo a un renglón? */
    modeloPlegado() {
      return !destruido && plegado
    },

    /**
     * Escribe las dos cifras EN VIVO: la superficie de la parte activa y la suma
     * de huella sobre rasante del edificio (ficha §15.4).
     *
     * ⚠️ **Llegan REDACTADAS desde fuera**, igual que {@link procedencia} y por el
     * mismo motivo escrito allí: quien mide es `geo/area.js` y quien une las
     * huellas es `edificio/envolvente.js`. Una vista que sumara áreas sería una
     * segunda forma de decir la misma cifra, con su propio redondeo — y dos
     * redondeos distintos del mismo número es exactamente lo que un informe
     * firmable no se puede permitir.
     *
     * ⚠️ Y valen **hasta el siguiente `fijar`**, que devuelve la de la parte a
     * {@link SIN_MEDIDA}: ver {@link pintarParteActiva}, donde está el porqué.
     *
     * `undefined` en cualquiera de las dos significa **no tocar ésa**.
     *
     * @param {Object} [cifras]
     * @param {string} [cifras.activa]  La superficie de la parte activa.
     * @param {string} [cifras.huella]  La suma de huella sobre rasante.
     */
    medidas({ activa: textoActiva, huella } = {}) {
      if (destruido) return
      if (textoActiva !== undefined) {
        medidaNodo.textContent = typeof textoActiva === 'string' ? textoActiva : SIN_MEDIDA
      }
      if (huella !== undefined) {
        huellaNodo.textContent = typeof huella === 'string' ? huella : ''
      }
    },

    /**
     * Escribe el renglón de estado del bloque de parte activa.
     *
     * ⚠️ Mismo aviso que {@link estado}: vale hasta el siguiente `fijar`, que
     * vuelve a poner ahí {@link SIN_PARTE_ACTIVA} o {@link PENDIENTE_DE_DIBUJAR}
     * — y ése es el orden correcto, porque «esta parte no tiene recinto» manda
     * sobre el desenlace de la operación anterior.
     *
     * @param {string} texto
     */
    estadoParteActiva(texto) {
      if (!destruido) estadoActiva.textContent = typeof texto === 'string' ? texto : ''
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

      // ⚠️ `seccionContraste` se saca como las demás, y con ella **se va el cajón
      // que tenga dentro**: `viewer/cajon-contraste-edificio.js` cuelga su
      // contenedor de esta sección cuando es la pantalla. No es un problema —el
      // visor se desmonta aparte y `control.remove()` le pregunta al nodo por su
      // padre real, esté donde esté—, pero conviene saberlo: el orden de apagado de
      // esta rama está escrito en la cabecera de `app/cableado-edificio.js`.
      for (const nodo of [
        seccionOrigen,
        seccionPartes,
        seccionActiva,
        seccionContraste,
        dialogoCapas,
      ]) {
        if (nodo.parentNode) nodo.parentNode.removeChild(nodo)
      }
    },
  }
}

export default crearPanelEdificio
