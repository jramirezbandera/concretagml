// services/catastro.js — F05 · T2A. LA PUERTA PÚBLICA del Catastro.
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ ESTE ES EL ÚNICO MÓDULO DEL CATASTRO QUE EL RESTO DE LA APP PUEDE IMPORTAR.  ║
// ║ Los cuatro de debajo llevan guion bajo por eso: `_red.js` (bytes y códigos   ║
// ║ HTTP), `_catastro-wfs.js` (el dialecto del WFS de parcelas),                 ║
// ║ `_catastro-ovc.js` (la geocodificación inversa del OVC) y `_catastro-dnp.js` ║
// ║ (los datos alfanuméricos de la parcela, F09). Ninguno de ellos habla el      ║
// ║ idioma de la aplicación: cada uno tiene su propio vocabulario (`MOTIVO_RED`, ║
// ║ `TIPO_RESPUESTA_WFS`, `TIPO_RCCOOR`, `TIPO_DNPRC`) y los cuatro dejaron la   ║
// ║ traducción escrita en sus cabeceras como trabajo de este fichero. Aquí es    ║
// ║ donde esos vocabularios se convierten en UNO —{@link MOTIVO_CATASTRO}— y     ║
// ║ donde el resultado deja de ser «lo que contestó un servidor» y pasa a ser    ║
// ║ «lo que le puedo enseñar a un colegiado».                                    ║
// ║                                                                              ║
// ║ Consecuencia práctica de la regla de oro 7 y del override O7: si mañana el   ║
// ║ Catastro retira su `Access-Control-Allow-Origin: *`, la contingencia se      ║
// ║ toca en TRES constantes (`CATASTRO_WFS_CP`, `CATASTRO_OVC_RCCOOR_JSON` y     ║
// ║ `CATASTRO_OVC_DNPRC_JSON`) y ni la UI ni el modelo se enteran, porque nadie  ║
// ║ más que este módulo las ha visto nunca.                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ── LO QUE DEVUELVE, Y POR QUÉ SIEMPRE LO MISMO ──────────────────────────────
// Todas las funciones devuelven un {@link ResultadoCatastro} con **las cinco
// claves siempre presentes**, salga bien o mal. Es la disciplina de
// `gml/descargar.js#ResultadoDescarga` y de `services/_red.js#ResultadoHttp`, y el
// motivo es el mismo: un resultado cuya FORMA depende de si hubo éxito obliga a
// todos sus consumidores a defenderse, y tarde o temprano uno se olvida.
//
// `motivo` es un código estable: **la UI puede decidir con él sin analizar el
// texto de `mensaje`** (misma frase que `gml/descargar.js#MOTIVO_NO_DESCARGADO`,
// y no es casualidad: es la misma regla).
//
// ── `procedencia` NO ES ADORNO ───────────────────────────────────────────────
// Es la quinta clave y la única que no estaba en ningún módulo anterior. Existe
// por dos cosas concretas:
//
//   1. Para que la UI pueda decir **«del Catastro, guardado hace 6 días»** en vez
//      de enseñar un dato viejo como si acabara de llegar. Un cliente con caché
//      que no dice de dónde viene el dato es un cliente que miente por omisión, y
//      la regla de oro 1 lo prohíbe igual que prohíbe tragarse un error.
//   2. Para que «la segunda llamada no tocó la red» sea **afirmable desde el
//      propio resultado** (`procedencia.origen === 'CACHE'`), y no solo desde un
//      espía del `fetch` que vive en el test. Lo que solo se puede comprobar
//      desde fuera no es una garantía del módulo: es una casualidad vigilada.
//
// ── LAS OCHO TRAMPAS QUE ESTE MÓDULO EXISTE PARA NO PISAR ────────────────────
// Todas MEDIDAS contra el servicio real —las siete primeras el 2026-07-27, la
// octava el 2026-08-02— y documentadas en `test/fixtures/catastro/PROCEDENCIA.md`,
// que MANDA (regla de oro 8).
//
// 1) **Se cuentan los `<member>`; JAMÁS los atributos de conteo.** Medido: con
//    `count=10` el cuerpo trae 10 miembros y **tanto `numberMatched` como
//    `numberReturned` declaran 539**. Mienten los dos. Por eso el resultado del
//    BBOX lleva `truncado`, que significa exactamente «llegaron tantos como
//    pedimos: puede haber más, y **el servicio no dice cuántos porque sus
//    atributos mienten**». `declarado` se arrastra tal cual, con un nombre que
//    dice que es lo que el servicio DICE, no lo que hay.
//
// 2) **La propia parcela se separa por `refcat` NORMALIZADO, nunca por posición.**
//    Medido: `GetNeighbourParcel` devuelve **5 miembros para 4 colindantes**, y la
//    propia está en **2.ª posición**. Un `parcelas[0]` daría por «la parcela del
//    usuario» a una vecina, y por colindante a la suya. De ahí el nombre
//    {@link crearClienteCatastro}·`parcelaYColindantes`: dice lo que el servicio
//    hace, no lo que uno esperaría que hiciera.
//
//    ⚠️ **Y el servicio no siempre se incluye a sí misma** (O15 corregido, medido
//    el 2026-08-15): `8081402TF9288S` y `8081403TF9288S` vienen con la propia
//    dentro, `8081401TF9288S` **no**. Así que «ningún miembro casa con lo pedido»
//    significa una cosa distinta en cada consulta, y se tratan distinto:
//      · en `parcelaPorRefcat` (`GetParcel`, se pide UNA) → `RESPUESTA_ILEGIBLE`:
//        se pidió una parcela y llegó la de otro;
//      · en `parcelaYColindantes` (`GetNeighbourParcel`) → **`propia: null` y todos
//        los miembros son colindantes**. Fallar aquí tiraba las vecinas buenas que
//        sí habían llegado y dejaba a esa parcela sin colindantes por sus tres
//        puertas. Ver {@link separarVecindad}.
//    En los dos casos sigue prohibido elegir un candidato a dedo.
//
// 3) **No existe la «colección vacía».** Medido: un BBOX sin parcelas devuelve un
//    `ExceptionReport` con **el mismo `exceptionCode="OperationProcessingFailed"`**
//    que una referencia catastral inexistente. Los dos salen de aquí como
//    {@link MOTIVO_CATASTRO.NO_ENCONTRADO} y **no se distinguen**. El texto del
//    `CDATA` se arrastra íntegro dentro de `mensaje` como detalle y **no se
//    analiza jamás**: es libre, bilingüe y trae una errata del propio servicio
//    («No records *founded*»). `_catastro-wfs.js` ya tiene un guardián que lo
//    impide; aquí no se burla, se hereda.
//
// 4) **Dos fronteras distintas en la misma función, y cada una con su razón.**
//    En `parcelasEnBbox`:
//      · BBOX **degenerado o invertido** → `throw` (delegado en
//        `_catastro-wfs.js#urlBbox`). Es un contrato roto por el PROGRAMADOR:
//        nadie teclea un `{minX, maxX}` al revés, lo construye código. Mismo
//        criterio que `viewer/wms-catastro.js#getMapUrl`, que LANZA al superar el
//        techo de píxeles en vez de recortar en silencio.
//      · BBOX **demasiado grande** → estado {@link MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE}.
//        Aquí la fuente natural del encuadre es el mapa, y el mapa **lo mueve el
//        usuario**: hacer zoom out no es un bug, y no puede reventar la app.
//    Y se comprueba **antes de emitir la petición**, no después: medido, 600 × 600 m
//    devolvieron **539 parcelas y ~1,15 MB**.
//
// 5) **{@link normalizarRefcat} NO comprueba el dígito de control.** Y no es un
//    olvido: el algoritmo de los dos caracteres de control de la referencia
//    catastral no está verificado contra el servicio en este proyecto, y un falso
//    negativo **bloquearía una consulta legítima** — el usuario tendría delante una
//    referencia que el Catastro conoce perfectamente y esta herramienta le diría
//    que está mal escrita. Se normaliza (espacios fuera, mayúsculas) y se comprueba
//    la FORMA (14 caracteres del alfabeto). Queda dicho aquí para que nadie lo
//    añada creyendo que mejora: para añadirlo hace falta primero medirlo.
//
// 6) **Caché antes que red, y es la mayor medida anti-bloqueo del cliente** (spec
//    F05: «consultar la caché antes de cada `getParcelByRefcat`»). Consultarla es
//    lo PRIMERO que hace `parcelaPorRefcat`. Y al revés: un fallo de **escritura**
//    en la caché avisa por el canal pero **no cambia el resultado**. La caché es
//    una optimización; que se llene, que el navegador la desaloje o que el usuario
//    navegue en privado no puede convertir una parcela traída con éxito en un
//    error.
//
// 7) **No se inventa un motivo de bloqueo.** No existe `LIMITE_EXCEDIDO`, ni
//    `BLOQUEADO`, ni `RATE_LIMITED`. Nadie ha medido —ni va a medir— qué contesta
//    el Catastro a un cliente denegado: provocarlo cuesta ~10 días de servicio
//    (override O8), y `PROCEDENCIA.md` lo declara como hueco a propósito. Un
//    detector de una señal que nadie ha visto solo puede acabar de dos maneras: o
//    es código muerto que además TRANQUILIZA (parece que el caso está cubierto), o
//    dispara en falso y le dice al usuario que está bloqueado cuando lo que se le
//    ha caído es el wifi. Por eso el catálogo de motivos de este módulo es corto y
//    **hay un guardián en la suite que exige que TODO motivo del catálogo tenga un
//    caso reproducible**: un motivo que ningún test puede provocar es un motivo que
//    nadie ha visto.
//
// 8) **El parámetro de `Consulta_DNPRC` se llama `RefCat`, NO `RC`** (F09). Con
//    `RC=` el servicio contesta HTTP 200 y `cod:"17"` «LA REFERENCIA CATASTRAL ES
//    OBLIGATORIA» —de una referencia catastral que iba en la petición—. Es el
//    tercer caso del patrón `cod:16`/`cod:76`: **un fallo NUESTRO contado con el
//    vocabulario de un dato ausente**. `_catastro-dnp.js#urlDnprc` lo hace
//    imposible validando la referencia antes de emitir, y `leerDnprc` NO tiene
//    ninguna tabla que traduzca un `cod` a «esa parcela no existe»: nadie ha
//    medido cómo se dice eso en ese endpoint. De ahí que `descriptivosPorRefcat`
//    **no pueda producir `NO_ENCONTRADO`**, y que eso esté escrito y probado en
//    vez de descubierto.
//
// ── EL REPARTO DE NIVELES: TODO ES `AVISO` ───────────────────────────────────
// La regla del proyecto está fijada en `viewer/_comun.js`: **`ERROR` es lo que
// BLOQUEA la generación del GML.** Que el Catastro no conteste no bloquea nada —la
// geometría del usuario está en el modelo y se puede dibujar a mano—, así que
// **los ocho motivos de F05 son `NIVEL.AVISO`**. {@link NIVEL_POR_MOTIVO} deja el
// mapa explícito y TOTAL, y hay un guardián en carga que no deja que un motivo
// nuevo se quede sin nivel.
//
// ── EL CANAL DE AVISO SE RESERVA A LO QUE NO SALE EN EL RESULTADO ────────────
// Decisión deliberada y contraria a la de `_red.js`, así que se razona: **este
// módulo NO avisa por sus resultados**. Cada {@link ResultadoCatastro} ya lleva
// `motivo` + `mensaje` presentable y su destinatario es quien llamó, que es el que
// tiene la pantalla delante. El transporte ya avisó de lo suyo (`_red.js#fallar`),
// y volver a contarlo aquí le diría al usuario **dos veces la misma cosa** en
// cuanto la app cablee el mismo `alAvisar` a los dos, que es el cableado natural.
//
// Lo que sí va por el canal es exactamente lo que **no cabe en el resultado**, y
// hoy son DOS cosas:
//
//   · un fallo de la CACHÉ — la parcela se entrega igual y, sin canal, nadie se
//     enteraría de que el almacenamiento lleva semanas sin funcionar (trampa 6);
//   · las DISCREPANCIAS de un `Consulta_DNPRC` (F09, trampa 8): que los 18
//     inmuebles de una parcela no digan el mismo municipio, o que `control.cudnp`
//     no cuadre con los inmuebles contados. El dato se entrega —con el campo
//     conflictivo en `null`, o sea “No consta”—, así que `ok` es `true` y el
//     invariante del contrato obliga a que `mensaje` sea `null`: **sin este canal
//     la discrepancia se perdería entera**, que es justo lo que prohíbe la regla
//     de oro 1. Es la misma prueba de siempre: si un suceso no tiene por dónde
//     salir, es que falta un sitio por donde sacarlo.
//
// ── LO QUE ESTE MÓDULO NO HACE, Y CONVIENE QUE ESTÉ POR ESCRITO ──────────────
//   · **No deduplica peticiones en vuelo.** Dos llamadas simultáneas a la misma
//     referencia hacen dos peticiones. Compartir una promesa entre dos llamantes
//     suena a ahorro y es una trampa: el primero que cancele se lleva por delante
//     la consulta del otro. La cola de `_red.js` ya limita la concurrencia a 2, que
//     es la pata que de verdad protege.
//   · **No caduca nada.** No hay TTL aquí. La spec pide «TTL largo» y quien sabe
//     cuánto es la implementación de `storage/cache-catastro.js`; este módulo se
//     limita a exponer `procedencia.edadMs` para que la UI diga la edad en vez de
//     que el cliente decida en silencio que un dato ya no vale.
//   · **No proyecta ni reordena ejes.** El BBOX entra ya en metros del SRS pedido
//     (`{minX, minY, maxX, maxY}`, la misma forma que
//     `viewer/wms-catastro.js#BBoxProyectado`). Regla de oro 3.
//   · **No toca IndexedDB.** La caché entra por parámetro y por defecto es
//     {@link CACHE_NULA}: el cliente funciona entero sin almacenamiento, y su suite
//     no abre una base de datos ni una vez.
//
// Su test es `test/services/catastro.test.js`, **sin sufijo `.dom`**: aquí no hay
// DOM, ni Leaflet, ni red (el `fetch` entra doblado por `_red.js`).

import { husoPorSrs } from '../geo/huso.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { TIPO_DNPRC, leerDnprc, urlDnprc } from './_catastro-dnp.js'
import { LONGITUD_REFCAT_PARCELA, TIPO_RCCOOR, leerRccoor, urlRccoor } from './_catastro-ovc.js'
import {
  COUNT_BBOX_DEFECTO,
  TIPO_RESPUESTA_WFS,
  leerColeccion,
  urlBbox,
  urlGetNeighbourParcel,
  urlGetParcel,
} from './_catastro-wfs.js'
import { MOTIVO_RED } from './_red.js'

// ── Vocabulario público ───────────────────────────────────────────────────────

/**
 * Por qué no se ha podido entregar el dato. **Códigos estables: la UI puede
 * decidir con ellos sin analizar el texto de `mensaje`.**
 *
 * Es el vocabulario ÚNICO de F05: los tres módulos de debajo tienen el suyo
 * (`MOTIVO_RED`, `TIPO_RESPUESTA_WFS`, `TIPO_RCCOOR`) y aquí se traducen los tres
 * a este. Fuera de `services/` no debe aparecer ninguno de aquellos.
 *
 * ⛔ **No hay `LIMITE_EXCEDIDO` ni `BLOQUEADO`**, y no es un descuido: ver la
 * trampa 7 de la cabecera. Nadie ha medido qué contesta el Catastro a un cliente
 * denegado, y un detector de una señal que nadie ha visto o es código muerto que
 * tranquiliza, o dispara en falso.
 *
 * @readonly
 */
export const MOTIVO_CATASTRO = Object.freeze({
  /**
   * Lo que se ha pedido no es consultable **tal como está**: una referencia
   * catastral que no tiene la forma de una referencia catastral, o un punto que
   * no cae dentro de España. Es dato del USUARIO (lo teclea o lo pincha en el
   * mapa), así que sale como estado y con un mensaje que dice qué se esperaba —
   * no como excepción.
   */
  ENTRADA_INVALIDA: 'ENTRADA_INVALIDA',
  /**
   * El Catastro no tiene nada que devolver. **Es un estado VÁLIDO, no un fallo**
   * (override C6): hay suelo sin parcela, y el País Vasco y Navarra tienen
   * catastro propio, fuera del alcance de esta herramienta.
   *
   * ⚠️ Cubre a la vez «esa referencia no existe» y «no hay ninguna parcela en esa
   * caja»: **el servicio usa el mismo código para las dos** y no se distinguen
   * (trampa 3). El texto literal del servicio va dentro de `mensaje`.
   */
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  /**
   * El encuadre pedido supera {@link MAX_AREA_BBOX_M2}. **No se emite la
   * petición.** Es estado y no `throw` porque el encuadre lo mueve el usuario con
   * la rueda del ratón (trampa 4).
   */
  BBOX_DEMASIADO_GRANDE: 'BBOX_DEMASIADO_GRANDE',
  /**
   * Hubo respuesta y no se entiende: un XML mal formado, un GML de otro tema, un
   * `exceptionCode` desconocido, un `cod` del OVC fuera de tabla, o una colección
   * en la que no viene la parcela que se pidió. **Apunta a un cambio del servicio
   * o a un fallo de esta aplicación, no a que el dato no exista** — y esa
   * diferencia es justo la que `_catastro-ovc.js` existe para no borrar.
   */
  RESPUESTA_ILEGIBLE: 'RESPUESTA_ILEGIBLE',
  /** Respuesta HTTP no 2xx. Ver `MOTIVO_RED.ESTADO_HTTP`. */
  ESTADO_HTTP: 'ESTADO_HTTP',
  /** Se dejó de esperar. Ver `MOTIVO_RED.TIEMPO_AGOTADO`. */
  TIEMPO_AGOTADO: 'TIEMPO_AGOTADO',
  /** No llegó a haber respuesta: offline, DNS, TLS o CORS. Ver `MOTIVO_RED.SIN_RED`. */
  SIN_RED: 'SIN_RED',
  /** Lo canceló el llamante, o se destruyó el cliente. No es un fallo del servicio. */
  CANCELADA: 'CANCELADA',
})

/**
 * De dónde salió el dato. Va en `procedencia.origen` y es lo que permite a la UI
 * distinguir un dato recién traído de uno guardado hace seis días.
 *
 * @readonly
 */
export const ORIGEN = Object.freeze({
  /** De la caché. `procedencia.edadMs` dice cuánto lleva guardado. */
  CACHE: 'CACHE',
  /** Del servicio, ahora mismo. Hubo `fetch`. */
  RED: 'RED',
  /**
   * De ninguna de las dos: la decisión se tomó AQUÍ sin preguntar a nadie
   * (entrada inválida, encuadre demasiado grande, cliente destruido). Su marca
   * inconfundible es `url === null`: no se pidió nada.
   */
  LOCAL: 'LOCAL',
})

/**
 * Nivel de aviso de cada motivo. **Mapa explícito y TOTAL sobre
 * {@link MOTIVO_CATASTRO}**, no una función con un `default`: un `default` es
 * exactamente lo que hace que un motivo nuevo herede un nivel que nadie ha
 * decidido.
 *
 * **Los ocho son `AVISO` y ninguno es `ERROR`**, por la regla de clasificación de
 * `viewer/_comun.js`: `ERROR` es lo que BLOQUEA la generación del GML. Que el
 * Catastro no conteste, o que no tenga esa parcela, no impide dibujarla a mano y
 * generar el fichero: se pierde una consulta, no un trabajo. Es la misma decisión
 * que ya se tomó para la cartografía de fondo que no carga.
 *
 * @readonly
 * @type {Readonly<Record<string, 'AVISO'|'ERROR'>>}
 */
export const NIVEL_POR_MOTIVO = Object.freeze({
  [MOTIVO_CATASTRO.ENTRADA_INVALIDA]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.NO_ENCONTRADO]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.ESTADO_HTTP]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.TIEMPO_AGOTADO]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.SIN_RED]: NIVEL.AVISO,
  [MOTIVO_CATASTRO.CANCELADA]: NIVEL.AVISO,
})

// ── Constantes de producto ────────────────────────────────────────────────────

/**
 * Sistema de referencia por defecto del cliente: huso 30, que es el que domina la
 * Península.
 *
 * **Se declara AQUÍ y en ningún otro sitio, y eso es una decisión, no una
 * casualidad.** `_catastro-wfs.js#urlGetParcel` y `_catastro-ovc.js#urlRccoor`
 * exigen el `srs` explícito y **sin valor por defecto**, a propósito: poner un
 * defecto allí equivaldría a «asumir huso 30» a espaldas del llamante, y
 * `geo/huso.js#detectarHuso` avisa por escrito de que autodetectar a ciegas es
 * exactamente eso (verificado: en un barrido de 168 puntos peninsulares la
 * autodetección devolvió SIEMPRE huso 30).
 *
 * La diferencia es que esto es una decisión de PRODUCTO —«si el expediente no
 * dice otra cosa, se consulta en 25830»— y aquí sí hay quien la tome: este módulo
 * conoce el expediente. Quien tenga el huso lo pasa (`crearClienteCatastro({srs})`
 * o `opciones.srs` en cada llamada) y este defecto no interviene.
 */
export const SRS_DEFAULT = 'EPSG:25830'

/**
 * Área máxima de un encuadre que se le pide al WFS, en metros cuadrados: **1 km²**.
 *
 * Procedencia de la cifra, con su honestidad por delante: **1 km² es el límite que
 * la documentación del WFS INSPIRE del Catastro declara para una consulta por
 * caja**. Es un dato DOCUMENTAL, no medido en esta casa — `PROCEDENCIA.md` no lo
 * respalda porque provocar el rechazo habría costado peticiones al servicio.
 *
 * Lo que sí está MEDIDO, y es lo que hace que este tope no sea prudencia sino
 * aritmética: la misma caja de **600 × 600 m (0,36 km², un trozo de Madrid)**
 * pedida sin `count` devolvió **539 parcelas y ~1,15 MB**. O sea que a un TERCIO
 * de este tope ya se descarga un megabyte. Consecuencia que conviene no perder:
 *
 *   · Este tope **no es el que protege de la descarga masiva**. El que protege es
 *     `_catastro-wfs.js#COUNT_BBOX_DEFECTO` (= 10), que limita el número de
 *     parcelas de la respuesta. Este tope es la frontera de lo que el servicio
 *     dice admitir, y sirve para no pedirle algo que va a rechazar.
 *   · Por eso el resultado del BBOX lleva `truncado`: con el `count` puesto, una
 *     caja perfectamente legal puede tener mucho más de lo que se trae.
 *
 * Se compara con `>`, no con `>=`: una caja de exactamente 1 km² **pasa**. El
 * límite es el último valor admitido, no el primero rechazado.
 */
export const MAX_AREA_BBOX_M2 = 1_000_000

// ── El puerto de caché ────────────────────────────────────────────────────────

/**
 * Lo que este cliente necesita de una caché. **El puerto lo declara el CONSUMIDOR**
 * —o sea, este módulo—, porque es quien sabe lo que necesita; la implementación
 * real es otra tarea (`storage/cache-catastro.js`, IndexedDB).
 *
 * Son dos operaciones y ninguna más. Es un almacén de clave → valor y punto: las
 * claves las compone este módulo (`parcela:<srs>:<refcat>`,
 * `revgeo:<srs>:<x>:<y>`), así que un almacén con un solo `object store` sirve
 * para las dos cosas y no hay que negociar un método nuevo cada vez que aparezca
 * algo que cachear.
 *
 * Dos exigencias del contrato, y las dos importan:
 *   · **Las dos son asíncronas** (IndexedDB lo es).
 *   · **`leer` devuelve `null` cuando no hay nada**, no `undefined` ni un objeto
 *     vacío. Y cuando hay algo, devuelve `{valor, guardadoEn}`: sin `guardadoEn`
 *     no se puede decir «guardado hace 6 días», que es medio motivo de que la
 *     caché exista (ver `procedencia`).
 *
 * El `valor` viaja a IndexedDB, así que tiene que ser **clonable por el algoritmo
 * de clonado estructurado**. Lo es: todo lo que este módulo guarda son los POJO de
 * `gml/parse.js` y de `_catastro-ovc.js` (regla de oro 4: sin métodos, sin clases).
 *
 * @typedef {Object} CacheCatastro
 * @property {(clave: string) => Promise<{valor: *, guardadoEn: number}|null>} leer
 *   Lo guardado bajo esa clave, o `null`. `guardadoEn` en milisegundos de época.
 * @property {(clave: string, valor: *, meta: {guardadoEn: number}) => Promise<void>} guardar
 *   Guarda (o reemplaza). Puede rechazar: un fallo de escritura **no cambia el
 *   resultado** de la consulta que lo provocó (trampa 6).
 */

/**
 * Caché que no guarda nada y nunca encuentra nada. **Es el valor por defecto**, y
 * eso significa que el cliente funciona entero sin almacenamiento: la caché es una
 * optimización, no un requisito.
 *
 * Congelada, y con sus dos métodos como no-ops asíncronos de verdad (devuelven
 * promesas) para que el camino sin caché atraviese exactamente el mismo código
 * `await` que el camino con caché. Un defecto que fuera `null` obligaría a un `if`
 * en cada punto de uso, y esos `if` son los que se olvidan.
 *
 * @type {CacheCatastro}
 */
export const CACHE_NULA = Object.freeze({
  leer: async () => null,
  guardar: async () => {},
})

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * De dónde vino el dato y cuánto costó. Va en TODOS los resultados, también en los
 * que fallan: saber que un fallo llegó tras 3 intentos y 12 segundos es
 * información, y perderla obligaría a la UI a adivinar.
 *
 * @typedef {Object} ProcedenciaCatastro
 * @property {'CACHE'|'RED'|'LOCAL'} origen  Clave de {@link ORIGEN}.
 * @property {number|null} edadMs  Milisegundos desde que se guardó, **solo si
 *   `origen === 'CACHE'`**; `null` en los otros dos. Es lo que permite decir «del
 *   Catastro, guardado hace 6 días» en vez de esconder un dato viejo.
 * @property {number} intentos  Peticiones HTTP EMITIDAS de verdad. `0` si no se
 *   llegó a la red (caché, decisión local, cancelación en cola).
 * @property {number} ms  Milisegundos de extremo a extremo de ESTA llamada,
 *   consulta a la caché incluida: es lo que esperó el llamante.
 * @property {string|null} url  La URL pedida, o `null` si no se pidió ninguna.
 *   `url === null` ⟺ `origen !== 'RED'`.
 */

/**
 * Lo que devuelve toda función pública de este módulo. **Las cinco claves siempre
 * presentes**, salga bien o mal.
 *
 * Invariantes que se pueden dar por buenos:
 *   · `ok === true` ⟺ `datos !== null` ⟺ `motivo === null` ⟺ `mensaje === null`.
 *   · `motivo`, cuando lo hay, es SIEMPRE una clave de {@link MOTIVO_CATASTRO}.
 *   · `procedencia` existe siempre y sus cinco claves también.
 *
 * @typedef {Object} ResultadoCatastro
 * @property {boolean} ok  `true` solo si hay dato. Ojo: `ok: false` con
 *   `NO_ENCONTRADO` **no es un fallo** (override C6), es que no hay nada ahí.
 * @property {*} datos  El dato pedido, o `null`. Su forma depende de la función:
 *   {@link ParcelaGml} en `parcelaPorRefcat`, `{propia, colindantes}` en
 *   `parcelaYColindantes`, `{parcelas, nMiembros, truncado, count, declarado}` en
 *   `parcelasEnBbox`, `{candidatos, cuantos, unico}` en `refcatPorCoordenada` y
 *   `{municipio, provincia, paraje, poligono, parcela, domicilio, clase}` —los
 *   siete `string|null` del contrato E— en `descriptivosPorRefcat`.
 * @property {string|null} motivo  Clave de {@link MOTIVO_CATASTRO}; `null` si `ok`.
 * @property {string|null} mensaje  Español presentable tal cual; `null` si `ok`.
 * @property {ProcedenciaCatastro} procedencia
 */

/** @typedef {import('../gml/parse.js').ParcelaGml} ParcelaGml */

// ── Traducción de los tres vocabularios de debajo ─────────────────────────────

/**
 * `MOTIVO_RED` → {@link MOTIVO_CATASTRO}. **Se DERIVA de las claves de
 * `MOTIVO_RED`**, no se escribe a mano: los cuatro motivos del transporte se
 * llaman igual aquí, y derivarlo es lo que hace imposible que se desincronicen.
 * Si `_red.js` añade un motivo y aquí no existe su gemelo, el módulo no carga —
 * ver el guardián de más abajo.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MOTIVO_POR_MOTIVO_RED = Object.freeze(
  Object.fromEntries(Object.keys(MOTIVO_RED).map((clave) => [clave, MOTIVO_CATASTRO[clave]])),
)

/**
 * `TIPO_RESPUESTA_WFS` → {@link MOTIVO_CATASTRO}, para los tipos que NO son una
 * colección legible. `PARCELAS` no está porque no es un fallo.
 *
 * `EXCEPCION` y `NO_SOPORTADO` van los dos a `RESPUESTA_ILEGIBLE` y conviene saber
 * por qué no tienen motivo propio: un `exceptionCode` que no conocemos y un GML de
 * edificio son, desde la UI, la misma situación —«el servicio ha contestado algo
 * que esta aplicación no sabe usar»— y darles dos códigos obligaría a la UI a
 * tratarlos distinto sin tener nada distinto que hacer. El detalle técnico no se
 * pierde: va íntegro en `mensaje`.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MOTIVO_POR_TIPO_WFS = Object.freeze({
  [TIPO_RESPUESTA_WFS.NO_ENCONTRADO]: MOTIVO_CATASTRO.NO_ENCONTRADO,
  [TIPO_RESPUESTA_WFS.EXCEPCION]: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
  [TIPO_RESPUESTA_WFS.NO_SOPORTADO]: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
  [TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE]: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
})

/**
 * `TIPO_RCCOOR` → {@link MOTIVO_CATASTRO}, para los tipos que no traen candidatos.
 *
 * `SIN_REFERENCIA` → `NO_ENCONTRADO` y `RESPUESTA_ILEGIBLE` → `RESPUESTA_ILEGIBLE`,
 * **y esa separación es la razón de ser de `_catastro-ovc.js`**: un `cod` que no
 * está en su tabla (el `"76"` de la URL mal construida) NO puede acabar diciéndole
 * al usuario «aquí no hay parcela». Fundir los dos aquí desharía en una línea la
 * defensa 3 de aquel módulo.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MOTIVO_POR_TIPO_RCCOOR = Object.freeze({
  [TIPO_RCCOOR.SIN_REFERENCIA]: MOTIVO_CATASTRO.NO_ENCONTRADO,
  [TIPO_RCCOOR.RESPUESTA_ILEGIBLE]: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
})

/**
 * `TIPO_DNPRC` → {@link MOTIVO_CATASTRO}, para los tipos que no traen datos.
 *
 * **Tiene UNA sola entrada, y esa escasez es el dato.** `_catastro-dnp.js` solo
 * conoce dos desenlaces —`DESCRIPTIVOS` y `RESPUESTA_ILEGIBLE`— porque **nadie ha
 * medido qué contesta `Consulta_DNPRC` a una referencia que no existe** (hueco
 * declarado en `PROCEDENCIA.md`). Consecuencia directa y comprobada por test:
 * `descriptivosPorRefcat` **no puede devolver `NO_ENCONTRADO`**, ni siquiera
 * cuando el servicio manda un `cod` de error.
 *
 * ⛔ **El día que alguien mida ese caso, la tentación será mapear aquí el `cod`
 * nuevo a `NO_ENCONTRADO` sin más.** No basta: hay que añadir el tipo en
 * `_catastro-dnp.js`, su fixture en `test/fixtures/catastro/` y su ficha en
 * `PROCEDENCIA.md`. Y en ningún caso se mete el `"17"` —que es un fallo NUESTRO—
 * en ese camino: convertiría un bug reproducible en el 100 % de las peticiones en
 * un tranquilizador «esa parcela no existe».
 *
 * @type {Readonly<Record<string, string>>}
 */
const MOTIVO_POR_TIPO_DNPRC = Object.freeze({
  [TIPO_DNPRC.RESPUESTA_ILEGIBLE]: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
})

/**
 * Guardián de carga: los cinco mapas de arriba tienen que ser TOTALES sobre su
 * dominio. Si `_red.js`, `_catastro-wfs.js`, `_catastro-ovc.js` o
 * `_catastro-dnp.js` añaden un caso y aquí no se traduce, el módulo **no se
 * carga** en vez de traducirlo a `undefined` y meter un `motivo: undefined` en un
 * resultado que la UI daría por bueno.
 *
 * Es ruidoso a propósito. Un módulo que no carga se arregla en cinco minutos; un
 * `motivo` indefinido viaja hasta la pantalla.
 */
for (const [nombre, dominio, mapa] of [
  ['MOTIVO_RED', Object.keys(MOTIVO_RED), MOTIVO_POR_MOTIVO_RED],
  [
    'TIPO_RESPUESTA_WFS',
    Object.values(TIPO_RESPUESTA_WFS).filter((t) => t !== TIPO_RESPUESTA_WFS.PARCELAS),
    MOTIVO_POR_TIPO_WFS,
  ],
  [
    'TIPO_RCCOOR',
    Object.values(TIPO_RCCOOR).filter((t) => t !== TIPO_RCCOOR.CANDIDATOS),
    MOTIVO_POR_TIPO_RCCOOR,
  ],
  [
    'TIPO_DNPRC',
    Object.values(TIPO_DNPRC).filter((t) => t !== TIPO_DNPRC.DESCRIPTIVOS),
    MOTIVO_POR_TIPO_DNPRC,
  ],
  ['MOTIVO_CATASTRO', Object.values(MOTIVO_CATASTRO), NIVEL_POR_MOTIVO],
]) {
  for (const clave of dominio) {
    /* c8 ignore next 6 -- solo se alcanza si un módulo de debajo crece y este no */
    if (mapa[clave] === undefined) {
      throw new Error(
        `services/catastro: falta la traducción de ${nombre}.${clave}. Un caso nuevo en un ` +
          `módulo de debajo tiene que llegar al vocabulario público con un motivo Y un nivel ` +
          `decididos por alguien, no heredar 'undefined'.`,
      )
    }
  }
}

// ── Referencia catastral ──────────────────────────────────────────────────────

/**
 * Alfabeto y longitud de una referencia catastral de PARCELA. La longitud se
 * IMPORTA de `_catastro-ovc.js` (donde sale de que el OVC la parte en `pc1` + `pc2`,
 * 7 + 7) en vez de escribirse otra vez: dos constantes con el mismo 14 son dos
 * constantes que pueden divergir.
 */
const RE_REFCAT = new RegExp(`^[0-9A-Z]{${LONGITUD_REFCAT_PARCELA}}$`)

/**
 * Longitud de la referencia catastral de un **INMUEBLE**: los 14 de la parcela
 * más 4 del número fijo y 2 de control. Es la que aparece en los recibos del IBI
 * y en casi todo lo que la Sede imprime, así que es la que la gente tiene a mano
 * y la que pega en el campo.
 */
const LONGITUD_REFCAT_INMUEBLE = 20

const RE_REFCAT_INMUEBLE = new RegExp(`^[0-9A-Z]{${LONGITUD_REFCAT_INMUEBLE}}$`)

/**
 * Normaliza una referencia catastral tecleada por una persona y comprueba su
 * FORMA. Devuelve la referencia normalizada, o `null` si no tiene forma de
 * referencia catastral de parcela.
 *
 * Qué normaliza, y por qué cada cosa:
 *   · **Quita TODOS los espacios**, no solo los de los extremos. La Sede muestra
 *     las referencias agrupadas y la gente las copia con espacios dentro
 *     (`9398516 VK3799 G`); un espacio nunca forma parte de una referencia, así
 *     que quitarlos no puede convertir un dato en otro.
 *   · **Mayúsculas.** El servicio las escribe así y las acepta así.
 *   · **Acepta la referencia de INMUEBLE (20 caracteres) y se queda con sus 14
 *     primeros**, que SON la referencia de la parcela por construcción: los 6
 *     que sobran son el número fijo del inmueble y su control. No es una
 *     adivinanza, es la estructura del identificador. Se hace porque es la
 *     referencia que la gente tiene a mano —la de los recibos del IBI y la que
 *     imprime la Sede—, y porque F05 consulta parcelas: pedir la de 14 cuando el
 *     usuario tiene delante la de 20 es hacerle recortar a él una cadena que
 *     nosotros sabemos recortar.
 *
 * ⚠️ Esto último **NO es una comodidad nueva**: es lo que la app ya hacía, pero
 * por accidente. El campo del formulario llevaba `maxlength="14"` y truncaba la
 * de 20 antes de que llegara aquí. Ese truncado se ha quitado (2026-07-28)
 * porque era un **fallo silencioso**: también recortaba `9398516 VK3799G` —una
 * referencia con espacio, que esta función tolera a propósito— dejándola en
 * `9398516 VK3799`, o sea 13 caracteres útiles, y el usuario recibía «no tiene
 * forma de referencia catastral» por algo que había escrito bien. Un campo que
 * altera en silencio lo que se pega es exactamente lo que prohíbe la regla de
 * oro 1. Lo detectó el guion de humo `07`.
 *
 * ⛔ **NO comprueba el dígito de control, y es deliberado.** Ver la trampa 5 de la
 * cabecera: el algoritmo de los dos caracteres de control no está verificado
 * contra el servicio en este proyecto, y un falso negativo **bloquearía una
 * consulta legítima** — el usuario tendría delante una referencia que el Catastro
 * conoce y esta herramienta le diría que está mal escrita. Una referencia con la
 * forma correcta y el control mal produce una URL legítima a la que el servicio
 * contesta `NO_ENCONTRADO` (medido con `0000000XX0000X`), que es una respuesta
 * honesta y presentable. **Quien quiera añadir la comprobación, que la mida
 * antes.**
 *
 * No lanza nunca: su entrada es dato del usuario, y un `null` de un campo vacío no
 * es un bug del programador. Cualquier cosa que no sea un string da `null`.
 *
 * @param {*} crudo  Lo que haya escrito el usuario. Cualquier valor.
 * @returns {string|null}  La referencia de 14 caracteres normalizada, o `null`.
 */
export function normalizarRefcat(crudo) {
  if (typeof crudo !== 'string') return null
  const limpio = crudo.replace(/\s+/g, '').toUpperCase()
  if (RE_REFCAT.test(limpio)) return limpio
  // La de inmueble se recorta a su parcela. El orden importa: primero se prueba
  // la de 14, para que una referencia de parcela nunca pase por este camino.
  if (RE_REFCAT_INMUEBLE.test(limpio)) return limpio.slice(0, LONGITUD_REFCAT_PARCELA)
  return null
}

// ── Mensajes ──────────────────────────────────────────────────────────────────

/**
 * Cola que llevan los mensajes de `NO_ENCONTRADO`. Se escribe UNA vez porque es la
 * frase que impide que el usuario lea «no encontrado» como «esta herramienta ha
 * fallado» (override C6), y porque dice explícitamente lo que el servicio NO
 * distingue (trampa 3).
 */
const COLA_NO_ENCONTRADO =
  'No encontrar nada es un estado válido, no un fallo de la herramienta: hay suelo sin parcela, ' +
  'y el País Vasco y Navarra tienen catastro propio (fuera del alcance de esta herramienta).'

/**
 * Mensaje presentable de una respuesta del WFS que no es una colección de parcelas.
 *
 * El texto del servicio se arrastra **íntegro y entre comillas**, y no se analiza
 * jamás (trampa 3): es texto libre, bilingüe y con una errata del propio Catastro.
 * Se enseña para que el usuario sepa cuál de los dos casos era; no se lee para
 * decidir nada.
 *
 * @param {import('./_catastro-wfs.js').RespuestaWfs} wfs
 * @returns {string}
 */
function mensajeWfs(wfs) {
  if (wfs.tipo === TIPO_RESPUESTA_WFS.NO_ENCONTRADO) {
    return (
      `El Catastro no ha encontrado nada para esta consulta. Dice, literalmente: ` +
      `«${wfs.detalle}». Aviso importante: el servicio usa EL MISMO código de error para ` +
      `«esa referencia catastral no existe» y para «no hay ninguna parcela en esa zona», así ` +
      `que esta herramienta no puede distinguir entre las dos cosas. ${COLA_NO_ENCONTRADO}`
    )
  }
  if (wfs.tipo === TIPO_RESPUESTA_WFS.EXCEPCION) {
    return (
      `El Catastro ha respondido con un error que esta aplicación no sabe interpretar ` +
      `(código ${JSON.stringify(wfs.codigo)}). Dice, literalmente: «${wfs.detalle}». ` +
      `Eso apunta a un cambio del servicio o a un fallo de esta aplicación, NO a que el dato ` +
      `no exista.`
    )
  }
  return `No se ha podido leer la respuesta del Catastro. ${wfs.motivo}`
}

// ── Cliente ───────────────────────────────────────────────────────────────────

/** ¿Sirve como transporte? Duck typing sobre lo que este módulo usa, y nada más. */
function esTransporte(t) {
  return (
    !!t &&
    typeof t === 'object' &&
    typeof t.pedirTexto === 'function' &&
    typeof t.estado === 'function' &&
    typeof t.destruir === 'function'
  )
}

/** ¿Sirve como caché? Las dos operaciones del puerto {@link CacheCatastro}. */
function esCache(c) {
  return !!c && typeof c === 'object' && typeof c.leer === 'function' && typeof c.guardar === 'function'
}

/**
 * Crea el cliente del Catastro: la puerta pública de F05.
 *
 * Es una factory (`crearX`), nunca una clase (convención del proyecto). Todo el
 * estado vive en el cierre, así que dos clientes no comparten ni contadores ni
 * caché — cómodo de verdad en los tests, donde cada caso monta el suyo y no hay
 * nada que reiniciar entre ellos.
 *
 * ```js
 * const red = crearTransporte({ alAvisar })
 * const catastro = crearClienteCatastro({ transporte: red, cache, alAvisar })
 *
 * const r = await catastro.parcelaPorRefcat(loQueEscribioElUsuario)
 * if (r.ok) pintar(r.datos, r.procedencia)   // ← `procedencia` dice si es de hoy
 * else mostrar(r.mensaje, NIVEL_POR_MOTIVO[r.motivo])
 * ```
 *
 * @param {object} opciones
 * @param {{pedirTexto: Function, estado: Function, destruir: Function}} opciones.transporte
 *   El de `services/_red.js#crearTransporte`. **Obligatorio y sin defecto**: este
 *   módulo no crea transportes, porque crear uno aquí significaría decidir por el
 *   llamante el `fetch`, el reloj y el canal de aviso — y en un test, tocar la red
 *   de verdad.
 * @param {CacheCatastro} [opciones.cache=CACHE_NULA]  Ver el puerto. Por defecto,
 *   sin almacenamiento.
 * @param {string} [opciones.srs=SRS_DEFAULT]  SRS por defecto de las consultas, en
 *   forma corta (`'EPSG:25830'`). Se valida al crear el cliente, no en la primera
 *   consulta: un huso mal escrito se descubre al cablear, no media hora después.
 * @param {() => number} [opciones.ahora=() => Date.now()]  Reloj. Se inyecta por el
 *   mismo motivo que en `_red.js` y en `gml/_comun.js#dateTimeCatastro`: un módulo
 *   que lee el reloj del sistema no es reproducible — y aquí además se usa para
 *   calcular la EDAD de lo cacheado, que es un dato que sale por pantalla.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 *   Canal de aviso. **Solo se usa para los fallos de la CACHÉ**: ver la cabecera.
 * @returns {{parcelaPorRefcat: Function, parcelaYColindantes: Function,
 *            parcelasEnBbox: Function, refcatPorCoordenada: Function,
 *            descriptivosPorRefcat: Function, estado: Function, destruir: Function}}
 * @throws {TypeError|RangeError}  Contrato roto por el programador.
 */
export function crearClienteCatastro(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(
      `crearClienteCatastro: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const {
    transporte,
    cache = CACHE_NULA,
    srs: srsCliente = SRS_DEFAULT,
    ahora = () => Date.now(),
    alAvisar = null,
  } = opciones

  if (!esTransporte(transporte)) {
    throw new TypeError(
      `crearClienteCatastro: 'transporte' debe ser el de services/_red.js#crearTransporte ` +
        `(con pedirTexto, estado y destruir); recibido ${typeof transporte}. No se crea uno por ` +
        `defecto a propósito: eso decidiría por ti el fetch, el reloj y el canal de aviso, y en ` +
        `un test tocaría la red de verdad.`,
    )
  }
  if (!esCache(cache)) {
    throw new TypeError(
      `crearClienteCatastro: 'cache' debe cumplir el puerto CacheCatastro (leer y guardar, las ` +
        `dos asíncronas); recibido ${typeof cache}. Usa CACHE_NULA si no quieres almacenamiento.`,
    )
  }
  if (typeof ahora !== 'function') {
    throw new TypeError(`crearClienteCatastro: 'ahora' debe ser una función; recibido ${typeof ahora}.`)
  }
  // Delegado: `husoPorSrs` es el único sitio del proyecto que sabe qué husos están
  // implementados y cuál está diferido (Canarias, override O13). Lanza solo.
  husoPorSrs(srsCliente)

  const avisar = resolverAvisar(alAvisar)

  /** Contadores acumulados. Nunca se reinician: un contador que se borra miente. */
  const cuenta = { consultas: 0, deCache: 0, deRed: 0, fallosCache: 0 }
  let destruido = false

  // ── Resultados: fábrica única ───────────────────────────────────────────────

  /**
   * ÚNICA fábrica de {@link ResultadoCatastro} del módulo. Por aquí pasan TODOS
   * los caminos de salida, y por eso las cinco claves están siempre y en el mismo
   * orden. Escribir el objeto a mano en cada `return` es exactamente cómo
   * aparecen los resultados a los que les falta una clave.
   *
   * @param {object} campos
   * @returns {ResultadoCatastro}
   */
  function crearResultado({
    ok,
    datos = null,
    motivo = null,
    mensaje = null,
    origen,
    edadMs = null,
    intentos = 0,
    inicio,
    url = null,
  }) {
    return {
      ok,
      datos,
      motivo,
      mensaje,
      procedencia: { origen, edadMs, intentos, ms: Math.max(0, ahora() - inicio), url },
    }
  }

  /** Decisión tomada aquí, sin preguntar a nadie: `origen: LOCAL`, `url: null`. */
  const local = (motivo, mensaje, inicio) =>
    crearResultado({ ok: false, motivo, mensaje, origen: ORIGEN.LOCAL, inicio })

  /** Fallo con la red de por medio: conserva los intentos y la URL que se pidió. */
  const fallar = (motivo, mensaje, inicio, { intentos, url }) =>
    crearResultado({ ok: false, motivo, mensaje, origen: ORIGEN.RED, intentos, inicio, url })

  /**
   * El cliente está destruido. Se devuelve resultado en vez de lanzar por la misma
   * razón que `_red.js#destruir`: «pedir sobre un cliente ya destruido» no es un
   * bug, es la carrera normal entre una pantalla que se cierra y un manejador que
   * ya estaba en marcha. Lanzar ahí obligaría a envolver cada llamada en un `try`.
   */
  const cancelado = (inicio) =>
    local(
      MOTIVO_CATASTRO.CANCELADA,
      'La consulta al Catastro se ha cancelado: la pantalla que la pidió ya no está activa.',
      inicio,
    )

  // ── Caché ───────────────────────────────────────────────────────────────────

  /** Clave de una parcela. El SRS entra en la clave: la geometría depende de él. */
  const claveParcela = (refcat, srs) => `parcela:${srs}:${refcat}`

  /**
   * Clave de una vecindad (`GetNeighbourParcel`). **Distinta de la de la parcela
   * suelta a propósito**: el servicio devuelve dos cuerpos distintos para la
   * misma referencia —uno con 5 miembros y otro con 1— y compartir clave
   * serviría lo uno por lo otro.
   */
  const claveVecindad = (refcat, srs) => `parcela:${srs}:${refcat}:vecindad`

  /**
   * Clave de una geocodificación inversa. El punto se redondea al metro (spec F05:
   * «`revgeo` (`round(x),round(y),srs → refcat`)»), que es la resolución a la que
   * dos clics del usuario son la misma pregunta. Sin redondear, la caché no
   * acertaría NUNCA: un clic en el mapa no cae dos veces en el mismo float.
   */
  const clavePunto = (x, y, srs) => `revgeo:${srs}:${Math.round(x)}:${Math.round(y)}`

  /**
   * Clave de los datos alfanuméricos de una parcela (`Consulta_DNPRC`, F09).
   *
   * **SIN SRS, y no es un olvido**: la petición medida tiene tres parámetros
   * —`Provincia`, `Municipio` y `RefCat`— y **ninguno es un sistema de
   * referencia**. Meter el SRS en la clave partiría la caché en tres para un dato
   * que no depende de él, o sea que multiplicaría por tres las peticiones a un
   * servicio que sanciona el uso abusivo con ~10 días de denegación (override O8).
   *
   * **Reutiliza el prefijo `parcela:`, y eso es deliberado**: `storage/
   * cache-catastro.js#ALMACEN_POR_PREFIJO` LANZA con una clave cuyo prefijo no
   * conoce, así que un prefijo nuevo exigiría tocar `storage/` (y probablemente
   * una migración). Con el sufijo `:descriptivos` la entrada es inconfundible y no
   * pisa a nadie — es el mismo recurso que ya usa {@link claveVecindad}. Si algún
   * día estos datos merecen almacén propio, se añade allí la entrada; hasta
   * entonces, viven al lado de la parcela a la que describen.
   */
  const claveDescriptivos = (refcat) => `parcela:${refcat}:descriptivos`

  /**
   * Consulta la caché. **Nunca lanza y nunca cambia el curso de la consulta**: si
   * falla, avisa y devuelve `null`, o sea «no estaba», y se va a la red. Un fallo
   * de lectura de la caché no puede impedir traer el dato.
   *
   * @param {string} clave
   * @returns {Promise<{valor: *, edadMs: number|null}|null>}
   */
  async function leerDeCache(clave) {
    let entrada
    try {
      entrada = await cache.leer(clave)
    } catch (error) {
      cuenta.fallosCache += 1
      avisar(
        `No se ha podido leer la caché local del Catastro (${clave}). Se consulta al servicio, ` +
          `que es más lento pero da el mismo dato.`,
        { nivel: NIVEL.AVISO, causa: error },
      )
      return null
    }
    if (entrada === null || entrada === undefined) return null
    if (typeof entrada !== 'object' || entrada.valor === undefined) {
      // Una caché que devuelve algo con otra forma es un fallo de cableado, y
      // callarlo sería servir `undefined` como si fuera una parcela.
      cuenta.fallosCache += 1
      avisar(
        `La caché local del Catastro ha devuelto para ${clave} algo que no tiene la forma ` +
          `{valor, guardadoEn}. Se ignora y se consulta al servicio.`,
        { nivel: NIVEL.AVISO },
      )
      return null
    }
    cuenta.deCache += 1
    return {
      valor: entrada.valor,
      // Sin `guardadoEn` utilizable no se inventa una edad: `null` significa «no
      // sé cuándo se guardó», que es distinto de «se guardó hace 0 ms».
      edadMs: Number.isFinite(entrada.guardadoEn)
        ? Math.max(0, ahora() - entrada.guardadoEn)
        : null,
    }
  }

  /**
   * Guarda en la caché. **Un fallo aquí NO cambia el resultado** (trampa 6): la
   * parcela ya se ha traído con éxito, y que el almacenamiento esté lleno o
   * bloqueado (navegación privada, cuota agotada) no puede convertir un acierto en
   * un error. Avisa, eso sí: si no, sería el único suceso silencioso del módulo.
   *
   * @param {string} clave
   * @param {*} valor
   * @returns {Promise<void>}
   */
  async function guardarEnCache(clave, valor) {
    try {
      await cache.guardar(clave, valor, { guardadoEn: ahora() })
    } catch (error) {
      cuenta.fallosCache += 1
      avisar(
        `El dato del Catastro se ha traído bien, pero no se ha podido guardar en la caché ` +
          `local (${clave}). La consulta ha funcionado; la próxima vez volverá a ir al ` +
          `servicio, que es más lento.`,
        { nivel: NIVEL.AVISO, causa: error },
      )
    }
  }

  // ── Opciones comunes de las consultas ───────────────────────────────────────

  /**
   * Lee `{srs, senal}` de las opciones de una consulta y valida el SRS. El `srs`
   * por llamada existe porque un expediente puede estar en otro huso que el
   * defecto del cliente, y obligar a crear un cliente nuevo por eso sería absurdo.
   *
   * @param {*} opciones
   * @param {string} quien
   * @returns {{srs: string, senal: AbortSignal|null}}
   * @throws {TypeError|RangeError}
   */
  function leerOpciones(opciones, quien) {
    if (opciones === null || typeof opciones !== 'object') {
      throw new TypeError(`${quien}: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
    }
    const srs = opciones.srs === undefined ? srsCliente : opciones.srs
    husoPorSrs(srs)
    return { srs, senal: opciones.senal === undefined ? null : opciones.senal }
  }

  // ── Una consulta al WFS ─────────────────────────────────────────────────────

  /**
   * Pide una URL del WFS y clasifica su cuerpo. Devuelve `{wfs, proc}` si el
   * cuerpo era una colección de parcelas, o `{fallo}` con el
   * {@link ResultadoCatastro} ya construido si no.
   *
   * Recuérdese la frontera que fija `_red.js`: **`ok` es HTTP, no «hay parcela»**.
   * El `ExceptionReport` del Catastro llega con **HTTP 200** y por tanto con
   * `ok: true`; quien clasifica es `leerColeccion`, leyendo el cuerpo.
   *
   * @param {string} url
   * @param {AbortSignal|null} senal
   * @param {number} inicio
   * @returns {Promise<{wfs: object, proc: {intentos: number, url: string}}|{fallo: ResultadoCatastro}>}
   */
  async function traerColeccion(url, senal, inicio) {
    const http = await transporte.pedirTexto(url, { senal })
    const proc = { intentos: http.intentos, url }
    cuenta.deRed += 1

    if (!http.ok) {
      return { fallo: fallar(MOTIVO_POR_MOTIVO_RED[http.motivo], http.mensaje, inicio, proc) }
    }
    if (typeof http.texto !== 'string') {
      return {
        fallo: fallar(
          MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
          'El servicio del Catastro ha respondido correctamente pero sin cuerpo: no hay nada ' +
            'que leer.',
          inicio,
          proc,
        ),
      }
    }

    const wfs = leerColeccion(http.texto)
    if (wfs.tipo !== TIPO_RESPUESTA_WFS.PARCELAS) {
      return { fallo: fallar(MOTIVO_POR_TIPO_WFS[wfs.tipo], mensajeWfs(wfs), inicio, proc) }
    }
    // `texto` se devuelve además del árbol ya leído porque es LO QUE SE CACHEA
    // (ver {@link leerColeccionDeCache}). El cuerpo es el dato; el árbol es una
    // interpretación de hoy.
    return { wfs, proc, texto: http.texto }
  }

  /**
   * Relee de la caché un cuerpo de colección **crudo**.
   *
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ SE CACHEA EL TEXTO DEL GML, NO EL POJO YA PARSEADO. La diferencia no es ║
   * ║ de estilo, y este proyecto ya pagó por ella una vez.                   ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Tres motivos, en orden de peso:
   *
   *  1. **Una corrección futura en `gml/parse.js` arregla retroactivamente todo
   *     lo ya cacheado.** Guardar el POJO congela cada entrada con los fallos
   *     que tuviera el parser el día que se guardó, y los sirve durante el TTL
   *     entero sin que nada avise. No es hipotético: el 2026-07-27 la Sede
   *     rechazó un GML por un fallo de esta capa (SPEC §3.1) y se corrigió el
   *     mismo día. Con POJOs cacheados, quien hubiera consultado esa mañana
   *     habría seguido viendo el dato mal una semana.
   *  2. **Los bytes son la verdad externa** (regla de oro 8). El árbol parseado
   *     es nuestra lectura de ellos, y la lectura puede cambiar; los bytes no.
   *  3. **El formato del POJO es interno.** Si `ParcelaGml` gana o renombra un
   *     campo, las entradas viejas se quedan sin él en silencio. Un GML de hace
   *     seis días se relee hoy con el código de hoy.
   *
   * El coste es reparsear en cada acierto: milisegundos sobre un cuerpo de
   * pocos kB, a cambio de no servir nunca una interpretación caducada.
   *
   * **Un cuerpo cacheado que ya no se puede leer NO es un error**: se trata
   * como si no estuviera y se va a la red, que es exactamente lo que hace un
   * fallo de caché en el resto del módulo. Así, un cambio futuro que dejara de
   * aceptar cuerpos viejos degrada a «más lento», nunca a «roto».
   *
   * @param {{valor: *, edadMs: number|null}} enCache
   * @returns {{parcelas: ParcelaGml[], nMiembros: number}|null}
   */
  function leerColeccionDeCache(enCache) {
    if (typeof enCache.valor !== 'string') return null
    const wfs = leerColeccion(enCache.valor)
    if (wfs.tipo !== TIPO_RESPUESTA_WFS.PARCELAS) return null
    return wfs
  }

  /**
   * Separa la parcela PEDIDA del resto de miembros, **por referencia catastral
   * normalizada y jamás por posición** (trampa 2).
   *
   * @param {ParcelaGml[]} parcelas
   * @param {string} refcat  Ya normalizada.
   * @returns {{propia: ParcelaGml, colindantes: ParcelaGml[]}|null}  `null` si
   *   ningún miembro es la parcela pedida.
   */
  function separarPropia(parcelas, refcat) {
    const i = parcelas.findIndex((p) => normalizarRefcat(p.refcat) === refcat)
    if (i === -1) return null
    return { propia: parcelas[i], colindantes: parcelas.filter((_, j) => j !== i) }
  }

  /**
   * Lo mismo que {@link separarPropia}, pero para `GetNeighbourParcel`, donde que
   * la propia NO venga **no es una respuesta ilegible: es el servicio**.
   *
   * ── POR QUÉ ESTA FUNCIÓN EXISTE (override O15, corregido) ──
   * El override O15 se midió sobre una parcela que sí se incluía a sí misma, y de
   * ahí salió la regla «devuelve 5 miembros para 4 colindantes, la propia en 2.ª
   * posición». **La regla no es universal.** Medido el 2026-08-15 sobre tres
   * parcelas contiguas del mismo polígono:
   *
   *   · `8081402TF9288S` → 3 miembros, **se incluye a sí misma**;
   *   · `8081403TF9288S` → 3 miembros, **se incluye a sí misma**;
   *   · `8081401TF9288S` → 1 miembro (`8081402TF9288S`), y **ella NO está**.
   *
   * O sea: el servicio a veces omite la parcela consultada. Tratar esa omisión
   * como `RESPUESTA_ILEGIBLE` tiraba la respuesta ENTERA —incluida la colindante
   * buena que sí había llegado— y dejaba a esa parcela sin vecinas por CUALQUIERA
   * de sus tres puertas: «Traer colindantes», el cajón de diagnóstico y el informe.
   * Un fallo que además se contaba como avería de red, que es mentir sobre de quién
   * es el problema.
   *
   * Aquí se separa lo que se puede y **no se inventa nada**:
   *   · si la propia viene, `propia` es ella y `colindantes` el resto (O15 clásico);
   *   · si no viene, `propia` es `null` y **todos** los miembros son colindantes.
   *
   * `propia: null` es honesto y no le duele a nadie: ningún consumidor de
   * `parcelaYColindantes` lee `datos.propia` —la geometría oficial la trae
   * `parcelaPorRefcat`, que es otra consulta—; los tres oyentes de `alColindantes`
   * (dianas del snap, cajón de diagnóstico, informe) leen `datos.colindantes` y
   * nada más. Lo que sigue sin poder pasar es elegir una propia **a dedo**: un
   * `parcelas[0]` daría por parcela del usuario a una vecina, y eso es justo lo que
   * la trampa 2 prohíbe. Por eso `propia` se queda en `null` y no en «la primera».
   *
   * @param {ParcelaGml[]} parcelas
   * @param {string} refcat  Ya normalizada.
   * @returns {{propia: ParcelaGml|null, colindantes: ParcelaGml[]}}
   */
  function separarVecindad(parcelas, refcat) {
    return separarPropia(parcelas, refcat) ?? { propia: null, colindantes: parcelas }
  }

  /** Mensaje del caso «vino una colección y la parcela pedida no está en ella». */
  const mensajeSinPropia = (refcat, parcelas) =>
    `El Catastro ha devuelto ${parcelas.length} parcela(s), pero ninguna de ellas es la ` +
    `${refcat} que se pidió (llegaron: ${parcelas.map((p) => p.refcat ?? '(sin referencia)').join(', ')}). ` +
    `No se elige una al azar: la parcela buena se identifica por su referencia catastral, ` +
    `nunca por su posición en la respuesta — el servicio devuelve la propia parcela en 2.ª ` +
    `posición en la consulta de colindantes, así que fiarse del orden es equivocarse.`

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * La parcela oficial de una referencia catastral. **Consulta la caché primero**
   * (trampa 6): es la mayor medida anti-bloqueo del cliente.
   *
   * @param {*} refcatCrudo  Lo que haya escrito el usuario; se normaliza aquí.
   * @param {object} [opciones]
   * @param {string} [opciones.srs]  SRS de esta consulta. Por defecto, el del cliente.
   * @param {AbortSignal|null} [opciones.senal]
   * @returns {Promise<ResultadoCatastro>}  `datos` es una {@link ParcelaGml}.
   * @throws {TypeError|RangeError}  Contrato roto por el programador (`opciones` que
   *   no es objeto, `srs` que no es un huso soportado). **Una referencia mal
   *   escrita NO lanza**: es dato del usuario y sale como `ENTRADA_INVALIDA`.
   */
  async function parcelaPorRefcat(refcatCrudo, opciones = {}) {
    const inicio = ahora()
    const { srs, senal } = leerOpciones(opciones, 'parcelaPorRefcat')
    cuenta.consultas += 1
    if (destruido) return cancelado(inicio)

    const refcat = normalizarRefcat(refcatCrudo)
    if (refcat === null) {
      return local(
        MOTIVO_CATASTRO.ENTRADA_INVALIDA,
        `«${String(refcatCrudo)}» no tiene forma de referencia catastral de parcela: se ` +
          `esperan ${LONGITUD_REFCAT_PARCELA} caracteres, solo letras y números (por ejemplo, ` +
          `9398516VK3799G). Los espacios sobran y las minúsculas valen. No se comprueba el ` +
          `dígito de control: si la referencia existe, el Catastro la encontrará.`,
        inicio,
      )
    }

    const clave = claveParcela(refcat, srs)
    const enCache = await leerDeCache(clave)
    if (enCache !== null) {
      const wfs = leerColeccionDeCache(enCache)
      const deCache = wfs === null ? null : separarPropia(wfs.parcelas, refcat)
      if (deCache !== null) {
        return crearResultado({
          ok: true,
          datos: deCache.propia,
          origen: ORIGEN.CACHE,
          edadMs: enCache.edadMs,
          inicio,
        })
      }
      // Cuerpo cacheado ilegible con el código de hoy: se ignora y se va a la
      // red. No se avisa al usuario porque no le ha pasado nada — obtendrá su
      // parcela igual, solo que por el camino lento.
    }

    const url = urlGetParcel(refcat, srs)
    const traida = await traerColeccion(url, senal, inicio)
    if (traida.fallo !== undefined) return traida.fallo

    const separada = separarPropia(traida.wfs.parcelas, refcat)
    if (separada === null) {
      return fallar(
        MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
        mensajeSinPropia(refcat, traida.wfs.parcelas),
        inicio,
        traida.proc,
      )
    }

    await guardarEnCache(clave, traida.texto)
    return crearResultado({
      ok: true,
      datos: separada.propia,
      origen: ORIGEN.RED,
      intentos: traida.proc.intentos,
      inicio,
      url,
    })
  }

  /**
   * La parcela y sus COLINDANTES (*stored query* `GetNeighbourParcel`).
   *
   * ⚠️ El nombre dice lo que el servicio hace: **suele devolver también la propia
   * parcela**, y no la primera. Medido: 5 miembros para 4 colindantes, con la
   * propia en 2.ª posición. Aquí se separa por referencia catastral normalizada
   * (trampa 2), así que `colindantes` son los colindantes de verdad.
   *
   * ⚠️ **Pero «suele» no es «siempre»**, y por eso `propia` puede venir `null`: hay
   * parcelas para las que el servicio se omite a sí misma (medido el 2026-08-15 en
   * `8081401TF9288S`). Eso **ya no es `RESPUESTA_ILEGIBLE`**: se aprovechan los
   * miembros que hayan llegado y se deja `propia: null`. Lo que sigue prohibido es
   * elegir una propia a dedo con `parcelas[0]`. Ver {@link separarVecindad}.
   *
   * **No usa la caché.** La consulta de vecindad se hace una vez por expediente,
   * al cargar; cachearla obligaría a decidir qué pasa cuando la caché tiene la
   * parcela pero no sus vecinas, y esa complicación no compra nada.
   *
   * @param {*} refcatCrudo
   * @param {object} [opciones]  Como en {@link parcelaPorRefcat}.
   * @returns {Promise<ResultadoCatastro>}  `datos` es `{propia, colindantes}`.
   * @throws {TypeError|RangeError}
   */
  async function parcelaYColindantes(refcatCrudo, opciones = {}) {
    const inicio = ahora()
    const { srs, senal } = leerOpciones(opciones, 'parcelaYColindantes')
    cuenta.consultas += 1
    if (destruido) return cancelado(inicio)

    const refcat = normalizarRefcat(refcatCrudo)
    if (refcat === null) {
      return local(
        MOTIVO_CATASTRO.ENTRADA_INVALIDA,
        `«${String(refcatCrudo)}» no tiene forma de referencia catastral de parcela: se ` +
          `esperan ${LONGITUD_REFCAT_PARCELA} caracteres, solo letras y números.`,
        inicio,
      )
    }

    // La vecindad se cachea con clave PROPIA, no reutiliza la de `parcela:`.
    // Los dos cuerpos son distintos —este trae 5 miembros y 11,7 kB medidos, el
    // otro 1 y 2,9 kB— y confundirlos serviría una parcela sin sus colindantes,
    // o al revés. Y cachear esta consulta importa más que la otra: es la más
    // pesada de F05, y F06/F07 la van a pedir en cada diagnóstico.
    const clave = claveVecindad(refcat, srs)
    const enCache = await leerDeCache(clave)
    if (enCache !== null) {
      const wfs = leerColeccionDeCache(enCache)
      const deCache = wfs === null ? null : separarVecindad(wfs.parcelas, refcat)
      if (deCache !== null) {
        return crearResultado({
          ok: true,
          datos: deCache,
          origen: ORIGEN.CACHE,
          edadMs: enCache.edadMs,
          inicio,
        })
      }
    }

    const url = urlGetNeighbourParcel(refcat, srs)
    const traida = await traerColeccion(url, senal, inicio)
    if (traida.fallo !== undefined) return traida.fallo

    // Que la propia no venga NO es un fallo: es el servicio (ver `separarVecindad`).
    // Lo que llegue se aprovecha; lo que falte se queda en `propia: null`.
    const separada = separarVecindad(traida.wfs.parcelas, refcat)

    await guardarEnCache(clave, traida.texto)
    return crearResultado({
      ok: true,
      datos: separada,
      origen: ORIGEN.RED,
      intentos: traida.proc.intentos,
      inicio,
      url,
    })
  }

  /**
   * Las parcelas de un encuadre. **No es una *stored query***: el BBOX se hace con
   * un `GetFeature` estándar, porque `GetParcelsByBBox` **no existe** (el catálogo
   * del propio servicio lo demuestra).
   *
   * Las dos fronteras de la trampa 4 conviven aquí:
   *   · caja degenerada o invertida → **`throw`** (contrato del programador);
   *   · caja demasiado grande → **estado** `BBOX_DEMASIADO_GRANDE`, sin emitir nada.
   *
   * El orden del código no es casual: la URL se construye ANTES de comprobar el
   * área **a propósito**. Construirla es lo que VALIDA la caja —delegado en
   * `_catastro-wfs.js#urlBbox`, para no crear aquí una segunda verdad sobre qué es
   * una caja válida— y construir una cadena no emite ninguna petición. Lo que se
   * comprueba antes de EMITIR es el área, que es lo que importa.
   *
   * @param {import('./_catastro-wfs.js').BBoxProyectado} bbox  En metros del SRS.
   * @param {object} [opciones]
   * @param {string} [opciones.srs]
   * @param {number} [opciones.count=COUNT_BBOX_DEFECTO]  Tope de parcelas.
   * @param {AbortSignal|null} [opciones.senal]
   * @returns {Promise<ResultadoCatastro>}  `datos` es
   *   `{parcelas, nMiembros, truncado, count, declarado}`.
   * @throws {TypeError|RangeError}
   */
  async function parcelasEnBbox(bbox, opciones = {}) {
    const inicio = ahora()
    const { srs, senal } = leerOpciones(opciones, 'parcelasEnBbox')
    const count = opciones.count === undefined ? COUNT_BBOX_DEFECTO : opciones.count
    cuenta.consultas += 1
    if (destruido) return cancelado(inicio)

    // Valida la caja y el count (lanza si están mal). No emite nada: es una cadena.
    const url = urlBbox(bbox, srs, { count })

    const ancho = bbox.maxX - bbox.minX
    const alto = bbox.maxY - bbox.minY
    const area = ancho * alto
    if (area > MAX_AREA_BBOX_M2) {
      return local(
        MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE,
        `El encuadre pedido mide ${Math.round(ancho)} × ${Math.round(alto)} m ` +
          `(${(area / 1e6).toFixed(2)} km²) y el servicio del Catastro admite como mucho ` +
          `${MAX_AREA_BBOX_M2 / 1e6} km² por consulta. Acerca el mapa y vuelve a intentarlo. ` +
          `No se ha llegado a consultar al Catastro.`,
        inicio,
      )
    }

    const traida = await traerColeccion(url, senal, inicio)
    if (traida.fallo !== undefined) return traida.fallo

    return crearResultado({
      ok: true,
      datos: {
        parcelas: traida.wfs.parcelas,
        // CONTADOS, no declarados (trampa 1).
        nMiembros: traida.wfs.nMiembros,
        /**
         * «Llegaron tantas como pedimos: puede haber más, y **el servicio no dice
         * cuántas porque sus atributos de conteo mienten**» (medido: 10 miembros,
         * 539 declarados en los DOS atributos). Se compara con `>=` y no con `===`
         * por si algún día el servicio devolviera de más: eso también sería
         * truncado, y el lado seguro es decir que puede haber más.
         */
        truncado: traida.wfs.nMiembros >= count,
        count,
        // Lo que el servicio DICE. Se arrastra por transparencia; no se cuenta ni
        // se pagina con ello.
        declarado: traida.wfs.declarado,
      },
      origen: ORIGEN.RED,
      intentos: traida.proc.intentos,
      inicio,
      url,
    })
  }

  /**
   * Geocodificación inversa: de un punto UTM a la(s) referencia(s) catastral(es)
   * que lo contienen (OVC `Consulta_RCCOOR`).
   *
   * Es lo que sostiene la «deducción automática de RC» de la spec: la geometría
   * entra por DXF/LIST/TXT sin parcela, se calcula el centroide y se pregunta qué
   * hay ahí. Por eso `datos` lleva `cuantos` y `unico`: **con más de un candidato
   * la spec prohíbe rellenar nada a ciegas**, hay que enseñar los domicilios y
   * dejar elegir.
   *
   * Frontera propia, y es la misma de la trampa 4 aplicada a un clic: un punto
   * fuera de España sale como `ENTRADA_INVALIDA`, **no como excepción**. El punto
   * lo pincha el usuario en el mapa, y el mapa llega hasta Marruecos: hacer clic
   * en el sitio equivocado no puede reventar la app. Una coordenada que no es un
   * número finito sí lanza: eso lo construye código.
   *
   * @param {number} x  Este, en metros del SRS.
   * @param {number} y  Norte, en metros.
   * @param {object} [opciones]  Como en {@link parcelaPorRefcat}.
   * @returns {Promise<ResultadoCatastro>}  `datos` es `{candidatos, cuantos, unico}`.
   * @throws {TypeError|RangeError}
   */
  async function refcatPorCoordenada(x, y, opciones = {}) {
    const inicio = ahora()
    const { srs, senal } = leerOpciones(opciones, 'refcatPorCoordenada')
    cuenta.consultas += 1
    if (destruido) return cancelado(inicio)

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError(
        `refcatPorCoordenada: coordenada no finita [${x}, ${y}]. Se esperaban metros UTM ` +
          `(x=Este, y=Norte) en ${srs}.`,
      )
    }

    let url
    try {
      url = urlRccoor(x, y, srs)
    } catch (error) {
      // `urlRccoor` lanza RangeError cuando el punto no cae en España con el huso
      // dado. Aquí eso NO es un bug: es un clic en el mapa. El TypeError (que
      // sería una coordenada no finita) ya está descartado arriba, y cualquier
      // otra cosa se deja subir sin tocar: tapar un error desconocido sería
      // exactamente el error silencioso que la regla de oro 1 prohíbe.
      /* c8 ignore next */
      if (!(error instanceof RangeError)) throw error
      return local(MOTIVO_CATASTRO.ENTRADA_INVALIDA, error.message, inicio)
    }

    const clave = clavePunto(x, y, srs)
    const enCache = await leerDeCache(clave)
    if (enCache !== null) {
      return crearResultado({
        ok: true,
        datos: enCache.valor,
        origen: ORIGEN.CACHE,
        edadMs: enCache.edadMs,
        inicio,
      })
    }

    const http = await transporte.pedirTexto(url, { senal })
    const proc = { intentos: http.intentos, url }
    cuenta.deRed += 1

    if (!http.ok) return fallar(MOTIVO_POR_MOTIVO_RED[http.motivo], http.mensaje, inicio, proc)
    if (typeof http.texto !== 'string') {
      return fallar(
        MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
        'El servicio de geocodificación del Catastro ha respondido sin cuerpo: no hay nada ' +
          'que leer.',
        inicio,
        proc,
      )
    }

    const ovc = leerRccoor(http.texto)
    if (ovc.tipo !== TIPO_RCCOOR.CANDIDATOS) {
      // El mensaje de `_catastro-ovc.js` ya está en español y ya dice de quién es
      // el problema (esa es su defensa 3). No se reescribe.
      const mensaje =
        ovc.tipo === TIPO_RCCOOR.SIN_REFERENCIA ? `${ovc.mensaje} ${COLA_NO_ENCONTRADO}` : ovc.mensaje
      return fallar(MOTIVO_POR_TIPO_RCCOOR[ovc.tipo], mensaje, inicio, proc)
    }

    const datos = { candidatos: ovc.candidatos, cuantos: ovc.cuantos, unico: ovc.unico }
    await guardarEnCache(clave, datos)
    return crearResultado({
      ok: true,
      datos,
      origen: ORIGEN.RED,
      intentos: proc.intentos,
      inicio,
      url,
    })
  }

  /**
   * Los DATOS ALFANUMÉRICOS de una parcela: municipio, provincia, paraje,
   * polígono/parcela, domicilio y clase (OVC Callejero, `Consulta_DNPRC`). Es el
   * **contrato E de F09**: lo que el encabezado del informe de contraste imprime
   * y que la geometría del WFS no trae.
   *
   * ```js
   * const r = await catastro.descriptivosPorRefcat(refcat)
   * if (r.ok) encabezado(r.datos)   // los SIETE campos, string|null cada uno
   * ```
   *
   * ⚠️ **`null` en un campo NO es un fallo: es «el servicio no lo trae», y el
   * informe lo imprime como “No consta”.** En la parcela urbana de referencia del
   * proyecto llegan municipio y provincia y **no** llegan paraje, polígono,
   * parcela ni domicilio — porque es urbana y porque su respuesta viene por la
   * rama de varios inmuebles, que no trae `ldt`. Eso está MEDIDO, no supuesto.
   *
   * ⛔ **NO acepta `srs`, y no por descuido**: esta operación **no lleva sistema
   * de referencia** (la petición medida tiene tres parámetros y ninguno lo es).
   * Pasarlo lanza en vez de ignorarse en silencio: un `srs` aceptado y tirado a la
   * basura le haría creer a quien lo escribió que ha pedido algo que no ha pedido.
   *
   * ⛔ **NO puede devolver `NO_ENCONTRADO`** (trampa 8): nadie ha medido qué
   * contesta este endpoint a una referencia inexistente, así que ningún `cod` se
   * traduce a «esa parcela no está». Un error del servicio sale como
   * `RESPUESTA_ILEGIBLE` con el `cod` y el `des` literales dentro del mensaje.
   *
   * **Caché primero, igual que `parcelaPorRefcat`** y por el mismo motivo (trampa
   * 6): es una petición por parcela y por informe, y es la mayor medida
   * anti-bloqueo que tiene el cliente. Se cachea **el texto crudo**, no el objeto
   * ya leído, por las tres razones de {@link leerColeccionDeCache}: una corrección
   * futura del lector arregla retroactivamente lo ya guardado, los bytes son la
   * verdad externa y la forma del POJO es interna.
   *
   * Las discrepancias entre inmuebles y los contadores que no cuadran **salen por
   * el canal de aviso**, no por el resultado: el dato se entrega igual (con el
   * campo conflictivo en `null`) y el invariante del contrato obliga a que un
   * resultado con `ok: true` lleve `mensaje: null`. Sin canal se perderían.
   *
   * @param {*} refcatCrudo  Lo que haya escrito el usuario; se normaliza aquí.
   * @param {object} [opciones]
   * @param {AbortSignal|null} [opciones.senal]
   * @returns {Promise<ResultadoCatastro>}  `datos` es un
   *   {@link import('./_catastro-dnp.js').Descriptivos}.
   * @throws {TypeError}  Contrato roto por el programador (`opciones` que no es
   *   objeto, o un `srs` que esta operación no tiene). **Una referencia mal
   *   escrita NO lanza**: es dato del usuario y sale como `ENTRADA_INVALIDA`.
   */
  async function descriptivosPorRefcat(refcatCrudo, opciones = {}) {
    const inicio = ahora()
    if (opciones === null || typeof opciones !== 'object') {
      throw new TypeError(
        `descriptivosPorRefcat: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
      )
    }
    if (opciones.srs !== undefined) {
      throw new TypeError(
        `descriptivosPorRefcat: esta consulta NO lleva sistema de referencia y se ha recibido ` +
          `srs=${JSON.stringify(opciones.srs)}. La petición medida (Consulta_DNPRC) tiene tres ` +
          `parámetros —Provincia, Municipio y RefCat— y ninguno es un SRS: son datos ` +
          `alfanuméricos, no geometría. Se lanza en vez de ignorarlo para que nadie crea que ` +
          `ha pedido algo que no ha pedido.`,
      )
    }
    const senal = opciones.senal === undefined ? null : opciones.senal
    cuenta.consultas += 1
    if (destruido) return cancelado(inicio)

    const refcat = normalizarRefcat(refcatCrudo)
    if (refcat === null) {
      return local(
        MOTIVO_CATASTRO.ENTRADA_INVALIDA,
        `«${String(refcatCrudo)}» no tiene forma de referencia catastral de parcela: se ` +
          `esperan ${LONGITUD_REFCAT_PARCELA} caracteres, solo letras y números (por ejemplo, ` +
          `9398516VK3799G). No se consulta al Catastro: sin una referencia utilizable el ` +
          `servicio contesta que «LA REFERENCIA CATASTRAL ES OBLIGATORIA», que suena a dato ` +
          `que falta y en realidad es una petición mal construida.`,
        inicio,
      )
    }

    /** Convierte un {@link ResultadoDnprc} ya leído en el resultado público. */
    const entregar = (dnp, procedencia) => {
      if (dnp.tipo !== TIPO_DNPRC.DESCRIPTIVOS) {
        return procedencia.origen === ORIGEN.RED
          ? fallar(MOTIVO_POR_TIPO_DNPRC[dnp.tipo], dnp.mensaje, inicio, procedencia)
          : null
      }
      // Lo que no cabe en el resultado sale por el canal. Una sola llamada, con
      // todas las notas juntas: el usuario no necesita cuatro avisos seguidos.
      if (dnp.avisos.length > 0) {
        avisar(
          `El Catastro ha devuelto los datos de la parcela ${refcat}, pero no son del todo ` +
            `consistentes: ${dnp.avisos.join(' ')} Los campos afectados se quedan sin ` +
            `determinar y el informe los imprimirá como «No consta».`,
          { nivel: NIVEL.AVISO },
        )
      }
      return crearResultado({
        ok: true,
        datos: dnp.datos,
        origen: procedencia.origen,
        edadMs: procedencia.edadMs ?? null,
        intentos: procedencia.intentos ?? 0,
        inicio,
        url: procedencia.url ?? null,
      })
    }

    const clave = claveDescriptivos(refcat)
    const enCache = await leerDeCache(clave)
    if (enCache !== null && typeof enCache.valor === 'string') {
      const deCache = entregar(leerDnprc(enCache.valor), {
        origen: ORIGEN.CACHE,
        edadMs: enCache.edadMs,
      })
      // Un cuerpo cacheado que ya no se puede leer NO es un error: se trata como
      // si no estuviera y se va a la red (misma regla que `leerColeccionDeCache`).
      if (deCache !== null) return deCache
    }

    const url = urlDnprc(refcat)
    const http = await transporte.pedirTexto(url, { senal })
    const proc = { origen: ORIGEN.RED, intentos: http.intentos, url }
    cuenta.deRed += 1

    if (!http.ok) return fallar(MOTIVO_POR_MOTIVO_RED[http.motivo], http.mensaje, inicio, proc)
    if (typeof http.texto !== 'string') {
      return fallar(
        MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
        'El servicio de datos alfanuméricos del Catastro ha respondido sin cuerpo: no hay nada ' +
          'que leer.',
        inicio,
        proc,
      )
    }

    const dnp = leerDnprc(http.texto)
    const entregado = entregar(dnp, proc)
    if (dnp.tipo === TIPO_DNPRC.DESCRIPTIVOS) await guardarEnCache(clave, http.texto)
    return entregado
  }

  // ── Estado y cierre ─────────────────────────────────────────────────────────

  /**
   * Fotografía de los contadores. Objeto nuevo en cada llamada: quien lo guarde
   * conserva la foto, no una referencia que cambia sola.
   *
   * Los del transporte van anidados bajo `red` y no aplanados a propósito: son
   * otra unidad (una *consulta* de este módulo puede costar entre 0 y
   * `BACKOFF.intentos` *peticiones* del transporte) y mezclarlos invitaría a
   * sumarlos.
   *
   * @returns {{red: object, consultas: number, deCache: number, deRed: number,
   *            fallosCache: number}}
   */
  function estado() {
    return { red: transporte.estado(), ...cuenta }
  }

  /**
   * Deja el cliente inerte: las llamadas posteriores devuelven `CANCELADA` sin
   * tocar ni la caché ni la red, y **destruye también el transporte inyectado**,
   * que aborta lo que estuviera en vuelo.
   *
   * Destruir el transporte es deliberado: la forma prevista de cablear esto es un
   * transporte por cliente, y lo que la app quiere al cerrar una pantalla es que
   * se pare TODO. Si algún día hiciera falta compartir un transporte entre dos
   * clientes, esto habría que revisarlo — y por eso está escrito aquí.
   *
   * Idempotente. Los contadores acumulados NO se borran.
   */
  function destruir() {
    destruido = true
    transporte.destruir()
  }

  return {
    parcelaPorRefcat,
    parcelaYColindantes,
    parcelasEnBbox,
    refcatPorCoordenada,
    descriptivosPorRefcat,
    estado,
    destruir,
  }
}
