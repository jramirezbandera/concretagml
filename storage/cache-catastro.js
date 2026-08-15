// storage/cache-catastro.js — F05 · T2B. La CACHÉ del Catastro sobre IndexedDB.
//
// Implementa el puerto `CacheCatastro` que declara `services/catastro.js` —dos
// operaciones y ninguna más, `leer(clave)` y `guardar(clave, valor, {guardadoEn})`—
// sobre los almacenes que abre `storage/bd.js`. **El puerto lo declara el
// CONSUMIDOR y aquí no se negocia**: si esta implementación y aquella declaración
// divergieran, el cliente ni siquiera se construiría (`crearClienteCatastro` hace
// duck typing sobre `leer` y `guardar` y lanza), y su test lo comprueba DERIVANDO
// las claves de `CACHE_NULA` en vez de listarlas a mano.
//
// Es la mayor medida anti-bloqueo del cliente (spec F05: «consultar la caché
// antes de cada `getParcelByRefcat`», y el override O8: el anti-bloqueo real es
// caché + cola + backoff, porque la denegación del Catastro dura ~10 días). Y es
// a la vez el módulo que más fácil sería convertir en una fábrica de fallos
// silenciosos: una caché que sirve datos viejos sin decirlo, o que convierte un
// problema de almacenamiento en un error de consulta, hace más daño que no
// existir. Las seis decisiones de abajo están escritas para que ninguna de esas
// dos cosas pueda pasar.
//
// ── 1 · SE GUARDA EL TEXTO CRUDO DEL GML, NO EL RESULTADO DEL PARSEO ─────────
// La política de esta caché es que lo que viaja aquí dentro sean **los bytes tal
// y como los mandó el Catastro**, no el POJO que sale de `gml/parse.js`. Tres
// motivos, y el tercero es el que desarma la objeción obvia:
//
//   (a) **Los bytes son la verdad externa** (regla de oro 8: «el GML real del WFS
//       manda sobre la documentación y sobre el criterio»). Guardar el parseo es
//       guardar una INTERPRETACIÓN de la verdad externa, y esa interpretación la
//       hace código nuestro que todavía está cambiando.
//   (b) **Una corrección futura en `gml/parse.js` arregla retroactivamente TODO
//       lo ya cacheado.** Con el texto guardado, el día que el parser aprenda a
//       leer un agujero interior que hoy pierde, las parcelas que ya están en la
//       caché del usuario se leen bien desde el primer arranque. Con objetos
//       parseados, cada registro queda CONGELADO con los fallos del parser del
//       día en que se guardó, y no hay forma de saber cuál se guardó con qué
//       versión: el usuario arrastraría datos malos durante días sin enterarse
//       —exactamente el fallo silencioso que persigue la regla de oro 1— y la
//       única salida sería tirar la caché entera en cada versión.
//   (c) **El coste es irrelevante.** El GML de la parcela del fixture ocupa 2,8 kB
//       y uno con colindantes ronda los 12 kB. Reparsear en cada acierto cuesta
//       milisegundos, y se declara aquí para que nadie lo descubra como sorpresa:
//       un acierto de caché no es «gratis», es «mil veces más barato que la red».
//
// Consecuencia de diseño, y es lo que hace que la política salga barata: **este
// módulo NO INTERPRETA `valor`**. Lo guarda y lo devuelve verbatim (el puerto lo
// tipa como `*`), así que la política no vive en un `if` de aquí sino en lo que
// el llamante decide meter. Lo que este módulo GARANTIZA —y su test comprueba con
// un GML real de `test/fixtures/`, acentos y CRLF incluidos— es que un texto que
// entra sale IDÉNTICO carácter a carácter.
//
// ✅ Estado de hoy (corregido el 2026-07-28): `services/catastro.js` guarda el
// **cuerpo crudo**, tanto en `parcelaPorRefcat` como en `parcelaYColindantes`, y
// lo relee con `leerColeccionDeCache`. Durante un rato guardó el POJO ya
// parseado; se corrigió al detectarlo, y hay un guardián en
// `test/services/catastro.test.js` («lo que se GUARDA en la caché es el CUERPO
// CRUDO») que impide que vuelva.
//
// Que este fichero no tuviera que cambiar ni una línea con aquella corrección es
// exactamente la ventaja de no interpretar el valor, y por eso se deja escrito.
//
// ── 2 · EL TTL SON 7 DÍAS, Y ES UNA ELECCIÓN OPERATIVA, NO UN DATO ──────────
// **Nadie publica la cadencia con la que el Catastro actualiza su cartografía.**
// No está en la documentación del WFS INSPIRE, no está en `PROCEDENCIA.md` —que
// es el fichero que manda sobre lo medido— y no se puede deducir observando el
// servicio sin llevar meses mirándolo. Así que {@link MS_TTL} **es una decisión de
// producto, no un hecho**, y esta cabecera lo dice antes de que alguien la cite
// como si fuera una medida. Quien quiera cambiarla, que la cambie: no hay nada
// que romper, porque no hay ningún dato del que se haya derivado.
//
// Lo que de verdad hace inocuo el TTL —y por eso siete días no es temerario— es
// que **la UI enseña SIEMPRE la edad del dato**: `services/catastro.js` devuelve
// `procedencia.origen === 'CACHE'` y `procedencia.edadMs` justamente para poder
// decir «del Catastro, guardado hace 6 días» en vez de enseñar un dato viejo como
// si acabara de llegar. El usuario de esta herramienta es un colegiado que firma:
// no necesita que el programa decida por él si seis días son muchos, necesita
// saber que son seis. Un TTL sin edad visible sería una caché que miente por
// omisión; con la edad delante, el TTL solo decide cuándo dejamos de ofrecer el
// atajo.
//
// El límite se compara con `>`, no con `>=`: un registro de EXACTAMENTE 7 días
// todavía acierta. El límite es el último valor admitido, no el primero
// rechazado — misma regla que `services/catastro.js#MAX_AREA_BBOX_M2`.
//
// ── 3 · UN FALLO DE ESCRITURA NO PUEDE CAMBIAR EL RESULTADO DE UNA CARGA ────
// **Es la regla más importante de este módulo.** Cuando `put` rechaza —el caso
// real es `QuotaExceededError`, y también el desalojo del navegador o unos datos
// del sitio bloqueados—, {@link crearCacheCatastro}·`guardar` **avisa por el canal
// `Avisar` con `NIVEL.AVISO` y resuelve normalmente**. No relanza.
//
// El porqué está escrito en la trampa 6 de `services/catastro.js`: la caché es una
// optimización. Que se llene no puede convertir una parcela traída con éxito en un
// error, porque el usuario no ha hecho nada mal y el dato que quería está en la
// mano. Lo mismo, por simetría, con `leer`: un fallo de lectura se comporta como
// «no estaba» y la consulta se va a la red, que es más lenta pero da el mismo
// dato. **De este módulo no sale nunca un rechazo por causa del ALMACENAMIENTO.**
//
// La otra mitad de la regla es que tampoco puede pasar en silencio: los dos casos
// avisan cada vez, con la causa dentro. Se avisa en CADA fallo y no una sola vez
// —al contrario que el caso 6— porque un fallo de escritura es un SUCESO (esta
// operación no se guardó) y no un estado permanente de la sesión.
//
// Frontera, la de siempre en este repo (precedente literal: `gml/descargar.js` y
// `storage/bd.js`): **el entorno degrada, el programador revienta.** Una clave que
// no es una cadena, o cuyo prefijo no está en la tabla de rutas, o un `guardadoEn`
// que no es un número, es un contrato roto por quien escribe el código y sale como
// excepción (que el cliente convertirá en aviso, porque su `try` está para eso).
//
// ── 4 · EL TTL SE DECIDE CON EL `ahora` INYECTADO, JAMÁS CON `Date.now()` ───
// Igual que `services/_red.js`, `gml/_comun.js#dateTimeCatastro` y el propio
// cliente del Catastro. El repo tiene CERO `vi.useFakeTimers` y su precedente es
// la inyección, por dos razones que aquí se ven muy bien: (a) un test de caducidad
// que dependiera del reloj del sistema tendría que esperar siete días o falsear el
// tiempo global —y falsear el tiempo global rompe `fake-indexeddb`, que lo usa
// para sus propias transacciones—; y (b) la marca de tiempo que se escribe y la
// que se compara salen de la MISMA función, así que no pueden desincronizarse
// entre sí. `guardar` usa el `guardadoEn` que le pasa el llamante (que es el reloj
// del cliente) y solo cae en el suyo si no le pasan ninguno.
//
// ── 5 · CADUCAR NO ES BORRAR ────────────────────────────────────────────────
// Un registro pasado de TTL **se comporta como ausente** (`leer` devuelve `null`)
// y **se queda donde está**. No se borra al leerlo, y es deliberado:
//
//   · Borrar dentro de una lectura es una ESCRITURA ESCONDIDA. Puede fallar, puede
//     tardar, y convierte `leer` en una operación que muta — justo lo que hace
//     imposible razonar sobre una caché.
//   · El registro caducado no estorba: la siguiente consulta de esa misma clave lo
//     PISA con `put`, así que ni se duplica ni crece sin control.
//   · Y sobre todo: **la purga por antigüedad y la gestión de cuota eran de F10**
//     (`navigator.storage.persist()` / `estimate()`, desalojo, y la UI con la que
//     preguntarle al usuario antes de tirarle nada).
//
// ✅ **F10 · T3.4 (2026-08-03): la purga ya está aquí, y sigue sin borrar al leer.**
// Es {@link crearCacheCatastro}·`purgarCaducados`, una operación EXPLÍCITA que solo
// corre cuando alguien la llama —el cableado, al chocarse con `QuotaExceededError`—.
// `leer` no ha cambiado ni una línea: sigue sin mutar nada.
//
// ── 5bis · LA PURGA ES POR ANTIGÜEDAD, JAMÁS A LO BRUTO ─────────────────────
// Y no es escrúpulo: **esta caché es la mitigación anti-bloqueo del régimen O8**.
// `MEJORES_PRACTICAS_GML.md` §2.4 lo dice con todas las letras —«consultar IndexedDB
// antes de cada `getParcelByRefcat` es el mayor factor anti-bloqueo del cliente»— y
// el bloqueo del Catastro dura ~10 días. Vaciar la caché entera para hacer sitio
// cambiaría unos megabytes de disco por diez días sin servicio, que es un trato
// pésimo y que además nadie relacionaría con la purga cuando ocurriera.
//
// Así que solo se van los registros que **ya no puede servir nadie**: los pasados de
// TTL —que `leer` ya trata como ausentes— y los que tienen una marca de tiempo
// inservible o FUTURA (reloj retrocedido, S3), que nunca podrán acertar. Un registro fresco no se toca aunque el disco
// esté lleno. Si después de purgar sigue sin caber, **se dice**; no se sigue borrando.
//
// El contador `caducados` de `estado()` sigue siendo el gancho informativo con el que
// decidir si merece la pena llamar.
//
// ── 6 · SIN BASE DISPONIBLE, ESTO ES `CACHE_NULA` ──────────────────────────
// `storage/bd.js#abrirBd` no lanza cuando no puede: devuelve
// `{disponible: false, motivo, mensaje}` — Node sin `indexedDB`, ventana privada,
// datos del sitio bloqueados, `<iframe>` de tercera parte. En ese caso esta caché
// **no acierta nunca, no lanza nunca y no guarda nada**: es exactamente el
// comportamiento de `services/catastro.js#CACHE_NULA`, y su test lo afirma
// derivando las claves del puerto de aquel objeto.
//
// Pero **lo dice**, una sola vez por caché, en vez de callárselo. Y sí: `abrirBd`
// ya avisó de que no hay almacén. No es la misma frase ni la misma información —
// aquella dice qué le pasa al navegador, esta dice qué deja de funcionar para el
// usuario (cada consulta irá al servicio, y será más lenta)—, así que no es una
// repetición. **Una vez y no más**, porque «no hay base» no es un suceso sino un
// estado permanente de la sesión: repetirlo en cada consulta sería ruido puro que
// enterraría los avisos que sí traen información nueva.
//
// ── LA RUTA: QUÉ PREFIJO VA A QUÉ ALMACÉN ──────────────────────────────────
// El puerto es genérico a propósito (un almacén de clave → valor y punto), pero
// `storage/bd.js` tiene DOS almacenes con dos `keyPath` distintos. Quien decide
// cuál es cuál es {@link ALMACEN_POR_PREFIJO}, leyendo el prefijo de la clave que
// compone el cliente (`parcela:<srs>:<refcat>`, `revgeo:<srs>:<x>:<y>`).
//
// Una clave cuyo prefijo NO está en la tabla **lanza**, y eso es una decisión.
// Enviarla a un almacén por defecto «para que funcione» sería el fallo silencioso
// perfecto: seguiría funcionando —se lee y se escribe en el mismo sitio, así que
// nada se rompe— y la caché acabaría archivando cosas en el almacén equivocado sin
// que nadie lo notara nunca. Con el `throw`, añadir una clase de clave nueva (F06,
// F07) obliga a decidir explícitamente en qué almacén vive.
//
// **El redondeo al metro de `revgeo` NO se decide aquí.** `storage/bd.js` anticipó
// que viviría en este fichero, y al final lo aplica `services/catastro.js#clavePunto`
// al componer la clave. No se duplica: dos redondeos son dos políticas que pueden
// divergir, y la clave dejaría de ser canónica en el momento en que lo hicieran. Lo
// que vive aquí es la RUTA; la política de cuánto se parece un clic al de al lado
// vive con quien compone la clave. (Su test lo comprueba DERIVANDO las claves del
// cliente real, no escribiéndolas a mano.)
//
// ── EL CAMPO CLAVE SE DERIVA, Y EN PARCELAS GUARDA LA CLAVE ENTERA ─────────
// El registro es `{[campoClave]: clave, valor, guardadoEn}`, y `campoClave` sale de
// `ESQUEMA_ALMACENES[almacen].keyPath` — **en este fichero no se escriben las
// cadenas `'refcat'` ni `'clave'` ni una sola vez**. Es la razón por la que
// `storage/bd.js` declara el `keyPath` de cada almacén: «para que la caché y la
// base no puedan discrepar». Si mañana una migración moviera un `keyPath`, este
// módulo la sigue sin que nadie lo toque.
//
// ⚠️ Consecuencia que conviene leer dos veces: **en el almacén de parcelas, el
// campo `refcat` guarda LA CLAVE COMPLETA** (`parcela:EPSG:25830:9398516VK3799G`),
// no los catorce caracteres de la referencia catastral. Se decidió así porque la
// alternativa —quedarse solo con la referencia, que es lo que el nombre del campo
// sugiere— **borraría el SRS de la clave**, y la geometría de una parcela depende
// del huso en que se pidió: la misma parcela consultada en 25829 y en 25830
// colisionaría, y la segunda consulta serviría la geometría de la primera. Un
// campo cuyo nombre se queda corto se lee raro una vez y se explica; servir la
// geometría equivocada no se nota nunca. El nombre del campo es historia de la
// base (no se reescribe hacia atrás) y esta nota es su traducción.
//
// ── LO QUE ESTE MÓDULO NO HACE ─────────────────────────────────────────────
//   · **No abre la base.** La recibe hecha, porque IndexedDB tiene un solo número
//     de versión por base y `storage/bd.js` es LA puerta de apertura (su cabecera
//     explica qué pasa cuando dos módulos abren por su cuenta: almacenes que no se
//     crean nunca, sin un solo error).
//   · **No gestiona la cuota.** Purga cuando se lo piden (decisión 5bis), pero quién
//     mide el espacio y quién decide que hay que purgar son de `storage/cuota.js` y
//     del cableado. Esta caché no sabe cuánto sitio queda y no tiene por qué.
//   · **No compone claves ni redondea coordenadas.** Eso es de quien consulta.
//   · **No sabe qué es una parcela.** Guarda valores clonables; que uno sea un GML
//     y otro una lista de candidatos del OVC le da exactamente igual.
//
// Su test es `test/storage/cache-catastro.test.js`, **sin sufijo `.dom`**:
// `fake-indexeddb` es JavaScript puro y no necesita `window` ni jsdom, así que va
// al proyecto `node`, que además es el bucle rápido.

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { ALMACENES, ESQUEMA_ALMACENES } from './bd.js'

// ── Política de caducidad ────────────────────────────────────────────────────

/**
 * Cuánto se considera aprovechable un registro: **7 días**, en milisegundos.
 *
 * ⚠️ **ES UNA ELECCIÓN OPERATIVA, NO UN DATO MEDIDO.** Nadie publica cada cuánto
 * actualiza el Catastro su cartografía, así que cualquier cifra aquí es una
 * decisión de producto y no se puede citar como si fuera un hecho (ver la
 * decisión 2 de la cabecera). Lo que hace que la cifra no sea peligrosa es que la
 * UI enseña SIEMPRE la edad del dato: `services/catastro.js` devuelve
 * `procedencia.edadMs` justo para eso.
 *
 * Se compara con `>`: un registro de exactamente 7 días **todavía acierta**.
 *
 * @readonly
 */
export const MS_TTL = 7 * 24 * 60 * 60 * 1000

// ── Rutas: de la clave al almacén ────────────────────────────────────────────

/**
 * Los prefijos con los que `services/catastro.js` compone sus claves. **Son las
 * MISMAS cadenas** que `claveParcela` y `clavePunto` de aquel módulo, que no las
 * exporta; se declaran aquí porque es aquí donde se enrutan.
 *
 * No pueden desincronizarse en silencio: un prefijo que cambiara allí y no aquí
 * caería en el `throw` de {@link rutaDe} —«prefijo desconocido»— en la primera
 * consulta, en vez de archivarse calladamente en el almacén equivocado.
 *
 * @readonly
 */
export const PREFIJO = Object.freeze({
  /** Una parcela del WFS. Clave completa: `parcela:<srs>:<refcat>`. */
  PARCELA: 'parcela:',
  /** Una geocodificación inversa del OVC. Clave: `revgeo:<srs>:<x>:<y>`. */
  REVGEO: 'revgeo:',
})

/**
 * Prefijo de la clave → almacén de `storage/bd.js` en el que vive. Es TODA la
 * lógica de enrutado del módulo, en un objeto congelado y no en una cadena de
 * `if`: una tabla se lee de un vistazo y se amplía sin tocar código.
 *
 * Añadir una clase de clave nueva (F06, F07) es añadir una entrada aquí — y, si
 * necesita almacén propio, un almacén en `storage/bd.js` con su migración. Lo que
 * no se puede es no decidirlo: ver {@link rutaDe}.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const ALMACEN_POR_PREFIJO = Object.freeze({
  [PREFIJO.PARCELA]: ALMACENES.PARCELAS,
  [PREFIJO.REVGEO]: ALMACENES.REVGEO,
})

/**
 * Invariantes de la tabla de rutas, comprobados AL CARGAR EL MÓDULO y no en un
 * test, por el mismo motivo que `storage/bd.js#comprobarInvariantes`: una ruta
 * rota manda datos a un almacén que no existe, y eso se manifiesta como un
 * `NotFoundError` en la primera escritura de un usuario, lejos de la causa.
 *
 * Se comprueba una sola dirección —toda ruta apunta a un almacén declarado— y NO
 * la contraria: `storage/bd.js` tendrá almacenes que no son caché (los
 * expedientes de F10) y exigirles ruta impediría que el módulo cargara.
 *
 * @throws {Error}  Nombrando exactamente lo que falta.
 */
function comprobarRutas() {
  const declarados = Object.values(ALMACENES)
  for (const [prefijo, almacen] of Object.entries(ALMACEN_POR_PREFIJO)) {
    /* c8 ignore next 7 -- solo se alcanza si alguien rompe la tabla o bd.js */
    if (!declarados.includes(almacen) || ESQUEMA_ALMACENES[almacen] === undefined) {
      throw new Error(
        `storage/cache-catastro.js: la ruta «${prefijo}» apunta a «${almacen}», que no es un ` +
          `almacén de storage/bd.js (ALMACENES: ${declarados.join(', ')}). Una ruta a un almacén ` +
          'inexistente falla con NotFoundError en la primera escritura, lejos de aquí.',
      )
    }
  }
  const prefijos = Object.keys(ALMACEN_POR_PREFIJO)
  for (const a of prefijos) {
    for (const b of prefijos) {
      /* c8 ignore next 7 -- solo se alcanza con dos prefijos anidados */
      if (a !== b && b.startsWith(a)) {
        throw new Error(
          `storage/cache-catastro.js: el prefijo «${a}» es prefijo de «${b}», así que el ` +
            'enrutado dependería del orden en que se recorre la tabla. Dos prefijos anidados ' +
            'mandan la misma clave a dos almacenes distintos según quién mire primero.',
        )
      }
    }
  }
}

comprobarRutas()

/**
 * Dónde vive una clave: su almacén y el nombre del campo en el que la base espera
 * encontrarla. **El campo se DERIVA de `ESQUEMA_ALMACENES`**, nunca se escribe
 * (ver la cabecera).
 *
 * @param {string} clave
 * @returns {{almacen: string, campoClave: string}}
 * @throws {TypeError}  Si ningún prefijo conocido casa. Es contrato roto por el
 *   programador: enviarla a un almacén por defecto sería archivar en silencio.
 */
function rutaDe(clave) {
  for (const [prefijo, almacen] of Object.entries(ALMACEN_POR_PREFIJO)) {
    if (clave.startsWith(prefijo)) {
      return { almacen, campoClave: ESQUEMA_ALMACENES[almacen].keyPath }
    }
  }
  throw new TypeError(
    `cacheCatastro: la clave «${clave}» no empieza por ninguno de los prefijos conocidos ` +
      `(${Object.keys(ALMACEN_POR_PREFIJO).join(', ')}), así que no hay almacén en el que ` +
      'guardarla. No se elige uno por defecto a propósito: seguiría funcionando —se leería y se ' +
      'escribiría en el mismo sitio— y la caché acabaría archivando en el almacén equivocado sin ' +
      'que nadie lo notara. Añade la ruta en ALMACEN_POR_PREFIJO.',
  )
}

/**
 * Los almacenes que esta caché usa, **derivados de la tabla de rutas** y sin
 * repetidos. Aquí no se escribe `'parcelas'` ni `'revgeo'`: añadir una clase de clave
 * a {@link ALMACEN_POR_PREFIJO} la mete en la purga sin tocar una línea de
 * `purgarCaducados`, y —lo que importa más— **una purga no puede alcanzar nunca un
 * almacén que esta caché no enrute**. Los expedientes de F10 y el pie de firma viven
 * en la misma base y no son caché: que no salgan de aquí es lo que garantiza que una
 * purga por espacio no se lleve por delante el trabajo del usuario.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const ALMACENES_DE_CACHE = Object.freeze([...new Set(Object.values(ALMACEN_POR_PREFIJO))])

/**
 * Por qué una purga no ha podido ser. Códigos estables, para que quien llame decida
 * sin leerle el texto al `mensaje` (mismo criterio que `MOTIVO_EXPEDIENTES`).
 *
 * @readonly
 */
export const MOTIVO_PURGA = Object.freeze({
  /** No hay almacén local utilizable. No es un fallo: no había nada que purgar. */
  SIN_BD: 'SIN_BD',
  /**
   * La base cableada sabe `leer` y `guardar` —cumple el puerto— pero no sabe listar ni
   * borrar. Le pasa a un doble mínimo de test, no a `idb`. Se dice en vez de reventar
   * con un `TypeError` sobre `undefined` a cien líneas de aquí.
   */
  SIN_SOPORTE: 'SIN_SOPORTE',
  /** La lectura o el borrado reventaron en IndexedDB. Lo purgado hasta ahí, purgado. */
  ERROR: 'ERROR',
})

// ── Contrato ─────────────────────────────────────────────────────────────────

/** El puerto que este módulo implementa. Lo declara el consumidor, no nosotros. */
/** @typedef {import('../services/catastro.js').CacheCatastro} CacheCatastro */

/**
 * Lo que devuelve `storage/bd.js#abrirBd`.
 *
 * @typedef {import('./bd.js').ResultadoApertura} ResultadoApertura
 */

/**
 * Contadores acumulados de una caché. Fotografía nueva en cada llamada a
 * `estado()`; nunca se reinician, porque un contador que se borra miente sobre lo
 * que pasó (misma disciplina que `services/_red.js` y `services/catastro.js`).
 *
 * @typedef {Object} EstadoCache
 * @property {boolean|null} disponible  `true` si hay base utilizable, `false` si
 *   se ha resuelto que no la hay, `null` si todavía no se ha mirado (la base se
 *   resuelve de forma perezosa, en la primera operación).
 * @property {number} aciertos  Lecturas que devolvieron dato fresco.
 * @property {number} fallos    Lecturas sin registro (nunca se guardó, o se pisó).
 * @property {number} caducados  Lecturas con registro pasado de {@link MS_TTL}, o
 *   con una marca de tiempo inservible. **Es el gancho de F10** para decidir si
 *   merece la pena purgar; aquí no se purga nada (decisión 5).
 * @property {number} escrituras  `guardar` que llegaron a la base.
 * @property {number} fallosLectura   Lecturas que reventaron en IndexedDB.
 * @property {number} fallosEscritura  Escrituras que reventaron en IndexedDB
 *   (`QuotaExceededError` y compañía). **No cambiaron ningún resultado.**
 * @property {number} purgas    Veces que se ha llamado a `purgarCaducados`.
 * @property {number} purgados  Registros borrados, sumando todas las purgas.
 */

/**
 * Lo que devuelve una purga. **Siempre lleva `mensaje`, también cuando sale bien**, al
 * revés que el resto del módulo: el objeto entero de esta operación es un PARTE de lo
 * que se ha tirado, y devolver `null` donde va la frase obligaría a quien llama a
 * redactarla por su cuenta a partir de los números — que es como acaban existiendo dos
 * versiones de la misma frase.
 *
 * @typedef {Object} ResultadoPurga
 * @property {boolean} ok
 * @property {number} purgados   Cuántos registros se han borrado.
 * @property {number} revisados  Cuántos se han mirado. `revisados - purgados` son los
 *   que siguen sirviendo y por eso no se tocan (decisión 5bis).
 * @property {number} sinFecha   De los purgados, cuántos no tenían marca utilizable.
 *   Se cuenta aparte porque no es lo mismo «viejo» que «roto», y un número que sube
 *   aquí señala a quien esté escribiendo mal en la caché.
 * @property {number} bytesAprox  **Estimación por exceso**, ver `purgarCaducados`.
 * @property {Record<string, number>} porAlmacen  Cuántos por almacén.
 * @property {string|null} motivo   Clave de {@link MOTIVO_PURGA}, o `null`.
 * @property {string} mensaje  En castellano, listo para enseñar.
 */

// ── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Texto corto de un fallo, para meterlo dentro de un mensaje presentable. Misma
 * forma que `storage/bd.js`: `name: message` si lo hay, y si no, lo que sea.
 *
 * @param {*} error
 * @returns {string}
 */
function detalleDe(error) {
  return error && error.name ? `${error.name}: ${error.message}` : String(error)
}

/**
 * ¿Es esto una base de `idb` utilizable? DUCK TYPING sobre lo que este módulo usa
 * —`get` y `put`— y nada más, por el mismo motivo que `storage/bd.js` no usa
 * `instanceof IDBFactory`: el constructor global no existe en Node, y un doble de
 * test no debería tener que fingir una jerarquía entera para hacer de base. Es
 * además lo que permite envolver la base real con un `put` que rechaza, que es
 * como se simula la cuota agotada en el test.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esBase(v) {
  return !!v && typeof v === 'object' && typeof v.get === 'function' && typeof v.put === 'function'
}

// ── La caché ─────────────────────────────────────────────────────────────────

/**
 * Crea la caché del Catastro sobre IndexedDB. **Implementa el puerto
 * {@link CacheCatastro} de `services/catastro.js`**, así que se enchufa tal cual:
 *
 * ```js
 * import { abrirBd } from './storage/bd.js'
 * import { crearCacheCatastro } from './storage/cache-catastro.js'
 * import { crearClienteCatastro } from './services/catastro.js'
 *
 * // `abrirBd` devuelve una PROMESA y aquí se pasa sin esperarla: la caché la
 * // resuelve sola en su primera operación, así que el arranque no se bloquea
 * // esperando a IndexedDB para pintar el mapa.
 * const cache = crearCacheCatastro({ bd: abrirBd({ alAvisar }), alAvisar })
 * const catastro = crearClienteCatastro({ transporte, cache, alAvisar })
 * ```
 *
 * Es una factory (`crearX`), nunca una clase. Todo el estado —la base resuelta,
 * los contadores, el «ya avisé de que no hay base»— vive en el cierre, así que dos
 * cachés no comparten nada y cada prueba monta la suya sin reiniciar nada.
 *
 * @param {object} [opciones]
 * @param {Promise<ResultadoApertura>|ResultadoApertura|*|null} [opciones.bd=null]
 *   La base. Se admiten tres formas, y las tres son legítimas:
 *     · **la promesa de `abrirBd`** (el cableado natural: no obliga a esperar);
 *     · **un {@link ResultadoApertura} ya resuelto** (`{disponible, bd, …}`);
 *     · **la base envuelta por `idb` directamente** (quien ya la tiene en la mano).
 *   `null`/`undefined` significan «no hay almacén local», que es un estado
 *   legítimo y no un error: la caché se comporta entonces como `CACHE_NULA`.
 * @param {() => number} [opciones.ahora=() => Date.now()]  Reloj, en milisegundos
 *   de época. **Con él se decide el TTL** (decisión 4): un módulo que lee el reloj
 *   del sistema no es reproducible, y aquí además el test de caducidad tendría que
 *   esperar siete días.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 *   Canal de aviso. `null` ⇒ `console.warn`, que es el suelo mínimo de la regla de
 *   oro 1; nunca el silencio.
 * @returns {CacheCatastro & {estado: () => EstadoCache, purgarCaducados: (opciones?: {ttlMs?: number}) => Promise<ResultadoPurga>}}
 *   El puerto —`leer` y `guardar`, y nada más de lo que el consumidor conoce—, más
 *   dos operaciones que **no forman parte de él**: `estado()` con los contadores y
 *   `purgarCaducados()`. Que sobren claves no rompe el duck typing de
 *   `crearClienteCatastro`, que exige las del puerto y no prohíbe las demás; el
 *   cliente del Catastro seguirá sin saber que esto se puede purgar, que es lo
 *   correcto: quién purga y cuándo es del cableado.
 * @throws {TypeError}  Contrato roto por el programador: `opciones` que no es un
 *   objeto, `ahora` que no es función, `alAvisar` que no es función ni nulo, o un
 *   `bd` que no es ni objeto ni nulo.
 */
export function crearCacheCatastro(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(
      `crearCacheCatastro: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const { bd = null, ahora = () => Date.now(), alAvisar = null } = opciones

  if (typeof ahora !== 'function') {
    throw new TypeError(`crearCacheCatastro: 'ahora' debe ser una función; recibido ${typeof ahora}.`)
  }
  // La FORMA se exige aquí; que sepa hacer de base o no es cosa del entorno y se
  // degrada. Es la misma línea que traza `storage/bd.js` con su fábrica: un `42`
  // donde va la base es un error de programación, un objeto que no sirve es un
  // navegador que no puede.
  if (bd !== null && bd !== undefined && typeof bd !== 'object') {
    throw new TypeError(
      `crearCacheCatastro: 'bd' debe ser la promesa de abrirBd, su ResultadoApertura, la base ` +
        `envuelta por idb, o null/undefined si no hay almacén local; recibido un ${typeof bd}.`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  /** @type {EstadoCache} */
  const cuenta = {
    disponible: null,
    aciertos: 0,
    fallos: 0,
    caducados: 0,
    escrituras: 0,
    fallosLectura: 0,
    fallosEscritura: 0,
    purgas: 0,
    purgados: 0,
  }

  /**
   * La base resuelta, memoizada. Se guarda la PROMESA y no la base para que dos
   * operaciones simultáneas durante la resolución compartan la misma —el mismo
   * motivo por el que `abrirBd` memoiza su promesa y no su resultado—.
   *
   * @type {Promise<*|null>|null}
   */
  let resuelta = null

  // ── Resolución de la base ─────────────────────────────────────────────────

  /**
   * Deja constancia de que no hay almacén y devuelve `null`, que es lo que hace
   * que esta caché se comporte como `CACHE_NULA` a partir de aquí.
   *
   * **Avisa UNA sola vez por caché** (decisión 6) y no hace falta ninguna bandera
   * para conseguirlo: aquí solo se llega desde {@link obtenerBase}, que corre como
   * mucho una vez porque {@link base} memoiza su promesa. Se anota porque la
   * bandera «por si acaso» estuvo escrita y se quitó: era código que NINGÚN test
   * podía hacer fallar —se mutó a propósito y la suite siguió verde—, y este repo
   * ya tiene escrito lo que opina de eso (`services/catastro.js`, trampa 7). Si
   * algún día alguien quita el memo, el aviso se repetirá y la prueba «lo dice UNA
   * sola vez» se pondrá roja, que es exactamente donde debe saltar.
   *
   * @param {string} razon  Fragmento que se incrusta en el mensaje.
   * @param {*} causa
   * @returns {null}
   */
  function sinBase(razon, causa) {
    cuenta.disponible = false
    avisar(
      `La caché local del Catastro no está disponible (${razon}). La aplicación funciona igual ` +
        'y el GML se genera con normalidad, pero cada consulta irá al servicio del Catastro en ' +
        'lugar de reutilizar lo que ya se descargó, así que las respuestas tardarán más. Este ' +
        'aviso no se repetirá durante esta sesión.',
      { nivel: NIVEL.AVISO, causa },
    )
    return null
  }

  /**
   * Resuelve `opciones.bd` a una base utilizable o a `null`. **Nunca lanza y
   * nunca rechaza**: no tener almacén es un estado, no un fallo.
   *
   * @returns {Promise<*|null>}
   */
  async function obtenerBase() {
    let abierta
    try {
      // `await` sobre un valor que no es promesa lo devuelve tal cual, así que
      // esta línea cubre las tres formas admitidas sin ramificar.
      abierta = await bd
    } catch (error) {
      // `abrirBd` no rechaza nunca; esto cubre cualquier otra promesa que le
      // pasen, y callarlo sería el error silencioso que la regla 1 prohíbe.
      return sinBase(`la apertura del almacén ha fallado — ${detalleDe(error)}`, error)
    }

    if (abierta === null || abierta === undefined) {
      return sinBase('no se ha cableado ningún almacén local', null)
    }
    // El orden importa: un `ResultadoApertura` no tiene `get` ni `put`, así que
    // esta comprobación no se lo puede tragar por error.
    if (esBase(abierta)) {
      cuenta.disponible = true
      return abierta
    }
    if (abierta.disponible === true && esBase(abierta.bd)) {
      cuenta.disponible = true
      return abierta.bd
    }
    if (abierta.disponible === false) {
      // El `mensaje` de `abrirBd` ya está en español y ya explica el porqué
      // (ventana privada, datos bloqueados, fallo de apertura). Se arrastra como
      // razón en vez de reescribirlo peor.
      return sinBase(abierta.mensaje || `motivo ${abierta.motivo}`, abierta)
    }
    return sinBase(
      'lo que se ha pasado como base no sabe leer ni escribir (le faltan `get` y `put`)',
      abierta,
    )
  }

  /** La base, resolviéndola como mucho una vez. */
  function base() {
    if (resuelta === null) resuelta = obtenerBase()
    return resuelta
  }

  // ── Guardas de contrato ───────────────────────────────────────────────────

  /**
   * Exige una clave utilizable y devuelve su ruta. Contrato roto por el
   * programador: las claves las compone código (`services/catastro.js`), nunca las
   * teclea un usuario.
   *
   * @param {*} clave
   * @param {string} quien
   * @returns {{almacen: string, campoClave: string}}
   * @throws {TypeError}
   */
  function exigirClave(clave, quien) {
    if (typeof clave !== 'string' || clave === '') {
      throw new TypeError(
        `cacheCatastro.${quien}: 'clave' debe ser una cadena no vacía; recibido ` +
          `${typeof clave} (${JSON.stringify(clave)}).`,
      )
    }
    return rutaDe(clave)
  }

  // ── El puerto ─────────────────────────────────────────────────────────────

  /**
   * Lo guardado bajo esa clave, o `null` si no hay nada aprovechable.
   *
   * Devuelve `null` —y no `undefined`, ni un objeto vacío— en los CUATRO casos en
   * que no hay dato, porque para quien llama son el mismo caso («no estaba, ve a
   * la red»): no hay base, no hay registro, el registro pasó de {@link MS_TTL}, o
   * la lectura reventó. Los cuatro se distinguen en `estado()`, que es donde
   * distinguirlos sirve para algo.
   *
   * **No rechaza nunca por causa del almacenamiento** (decisión 3). Sí lanza si la
   * clave está mal formada, que es contrato roto por el programador.
   *
   * @param {string} clave
   * @returns {Promise<{valor: *, guardadoEn: number}|null>}
   * @throws {TypeError}  Clave que no es cadena, o con prefijo desconocido.
   */
  async function leer(clave) {
    const ruta = exigirClave(clave, 'leer')
    const db = await base()
    if (db === null) return null

    let registro
    try {
      registro = await db.get(ruta.almacen, clave)
    } catch (error) {
      cuenta.fallosLectura += 1
      avisar(
        `No se ha podido leer la caché local del Catastro (${clave}). Causa: ${detalleDe(error)}. ` +
          'Se consulta al servicio, que es más lento pero da el mismo dato.',
        { nivel: NIVEL.AVISO, causa: error },
      )
      return null
    }

    if (registro === null || registro === undefined) {
      cuenta.fallos += 1
      return null
    }

    const { valor, guardadoEn } = registro
    // Un registro cuya marca de tiempo no se puede usar NO puede pasar un TTL:
    // aprobarlo sería servir un dato de edad desconocida bajo la promesa de que
    // tiene menos de siete días. Se cuenta como caducado y se va a la red.
    //
    // S3 (2026-08-15): una edad NEGATIVA —`guardadoEn` en el futuro, o sea un
    // reloj del sistema que retrocedió después de guardar— tampoco pasa. Con solo
    // `edad > MS_TTL`, un registro futuro no caducaba NUNCA (su edad baja en vez
    // de subir) y encima el cliente lo presentaba como recién traído (`edadMs`
    // se recorta a 0 en `services/catastro.js#leerDeCache`). No se puede afirmar
    // «tiene menos de siete días» de algo guardado en un tiempo que aún no ha
    // llegado: se trata como caducado y se va a la red, que lo pisará con una
    // marca sana.
    const edad = ahora() - guardadoEn
    if (!Number.isFinite(guardadoEn) || edad < 0 || edad > MS_TTL) {
      cuenta.caducados += 1
      // No se borra: ver la decisión 5. Lo pisará el siguiente `guardar`.
      return null
    }

    cuenta.aciertos += 1
    // Objeto nuevo, con las dos claves del puerto y ninguna más: quien llama no
    // debe poder tocar el registro de la base ni enterarse de cómo se guarda.
    return { valor, guardadoEn }
  }

  /**
   * Guarda (o reemplaza) el valor de una clave.
   *
   * **Un fallo aquí no cambia el resultado de nada** (decisión 3, la regla más
   * importante del módulo): si `put` rechaza —`QuotaExceededError` es el caso
   * real—, se avisa con `NIVEL.AVISO` y esta promesa **resuelve igualmente**. La
   * parcela ya se trajo con éxito y que el almacenamiento esté lleno no puede
   * convertir ese éxito en un error.
   *
   * @param {string} clave
   * @param {*} valor  Cualquier cosa clonable por el algoritmo de clonado
   *   estructurado. **No se interpreta**: entra y sale verbatim (decisión 1).
   * @param {{guardadoEn?: number}} [meta]  `guardadoEn` en milisegundos de época;
   *   por defecto, el `ahora` inyectado. Lo pasa el llamante para que la marca sea
   *   la del momento de la CONSULTA y no la de la escritura.
   * @returns {Promise<void>}
   * @throws {TypeError}  Clave mal formada, `meta` que no es objeto o `guardadoEn`
   *   que no es un número finito. Contrato roto por el programador.
   */
  async function guardar(clave, valor, meta = {}) {
    const ruta = exigirClave(clave, 'guardar')
    if (meta === null || typeof meta !== 'object') {
      throw new TypeError(
        `cacheCatastro.guardar: 'meta' debe ser un objeto {guardadoEn}; recibido ${typeof meta}.`,
      )
    }
    const guardadoEn = meta.guardadoEn === undefined ? ahora() : meta.guardadoEn
    if (!Number.isFinite(guardadoEn)) {
      throw new TypeError(
        `cacheCatastro.guardar: 'meta.guardadoEn' debe ser un número finito de milisegundos de ` +
          `época; recibido ${JSON.stringify(meta.guardadoEn)}. Sin marca de tiempo utilizable el ` +
          'registro no podría caducar nunca, que es peor que no guardarlo.',
      )
    }

    const db = await base()
    if (db === null) return

    try {
      // El campo de la clave se DERIVA del esquema (ver la cabecera): aquí no se
      // escribe ni `refcat` ni `clave`.
      await db.put(ruta.almacen, { [ruta.campoClave]: clave, valor, guardadoEn })
      cuenta.escrituras += 1
    } catch (error) {
      cuenta.fallosEscritura += 1
      avisar(
        `El dato del Catastro se ha traído bien, pero no se ha podido guardar en la caché local ` +
          `(${clave}). Causa: ${detalleDe(error)}. Lo más probable es que el navegador haya ` +
          'agotado el espacio que reserva para este sitio. La consulta ha funcionado y el GML se ' +
          'genera igual; lo único que cambia es que la próxima vez habrá que volver a preguntarle ' +
          'al Catastro, que es más lento.',
        { nivel: NIVEL.AVISO, causa: error },
      )
      // NO se relanza: ver la decisión 3.
    }
  }

  // ── La purga (F10 · T3.4) ─────────────────────────────────────────────────

  /**
   * ¿Puede esta base listar y borrar? {@link esBase} solo exige `get` y `put`, que es
   * lo que pide el PUERTO, y no se amplía a propósito: subirle el listón dejaría fuera
   * a los dobles legítimos que hoy implementan el puerto entero. Así que la capacidad
   * extra se comprueba aquí, donde hace falta, y su ausencia se cuenta como
   * degradación y no como excepción.
   *
   * @param {*} db
   * @returns {boolean}
   */
  function sabePurgar(db) {
    return typeof db.getAll === 'function' && typeof db.delete === 'function'
  }

  /**
   * Tamaño APROXIMADO de un registro, en bytes. Se mide serializándolo a JSON.
   *
   * ⚠️ **Es una estimación POR EXCESO, y el nombre del campo lo dice.** IndexedDB no
   * publica cuánto ocupa un registro concreto —`navigator.storage.estimate()` da el
   * total del origen y nada más—, y en la fase 0 de F10 se midió que la base guarda
   * más compacto que su JSON: un registro cuyo `JSON.stringify` pesaba 1.488 B sumaba
   * **864 B** de `usage` real, o sea que el JSON sobreestima en torno a 1,7×. Se
   * devuelve igualmente porque «se han liberado unos 40 kB» le dice algo a quien mira
   * y «se han borrado 12 registros» no; lo que no se puede es presentarlo como exacto.
   *
   * @param {*} registro
   * @returns {number}
   */
  function bytesAproximados(registro) {
    try {
      return JSON.stringify(registro)?.length ?? 0
    } catch {
      // Un registro con un ciclo no se puede pesar. No pasa con lo que esta caché
      // guarda (texto y POJO clonables), pero devolver 0 es mejor que reventar una
      // purga por no saber contar un byte.
      return 0
    }
  }

  /**
   * Borra los registros que ya no puede servir nadie: los pasados de TTL y los que
   * tienen una marca de tiempo inservible. **Nunca borra un registro fresco**, aunque
   * el disco esté lleno (decisión 5bis: esta caché es la mitigación anti-bloqueo del
   * régimen O8, y vaciarla cuesta ~10 días de servicio).
   *
   * Es una operación EXPLÍCITA: la llama el cableado al chocarse con
   * `QuotaExceededError`, nunca `leer` ni `guardar`. Y **no lanza**: sin base, sin
   * soporte o con la lectura rota devuelve `{ok: false, motivo, mensaje}` — la
   * frontera de siempre.
   *
   * Recorre **solo** {@link ALMACENES_DE_CACHE}, que se deriva de la tabla de rutas:
   * los expedientes del usuario y el pie de firma viven en la misma base y esta purga
   * no puede alcanzarlos ni por error.
   *
   * @param {object} [opciones]
   * @param {number} [opciones.ttlMs=MS_TTL]  Qué se considera caducado. Se deja
   *   ajustable para que el test no tenga que mover el reloj siete días y para que un
   *   día se pueda purgar más agresivamente **decidiéndolo desde fuera**, que es
   *   distinto de que este módulo lo decida solo.
   * @returns {Promise<ResultadoPurga>}
   * @throws {RangeError}  Si `ttlMs` no es un número finito y no negativo. Contrato
   *   roto por el programador: un TTL inservible borraría lo que no toca.
   */
  async function purgarCaducados(opciones = {}) {
    const { ttlMs = MS_TTL } = opciones ?? {}
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new RangeError(
        `cacheCatastro.purgarCaducados: 'ttlMs' debe ser un número finito y no negativo de ` +
          `milisegundos; recibido ${JSON.stringify(ttlMs)}. Un TTL inservible borraría registros ` +
          'que todavía sirven.',
      )
    }

    const vacio = { purgados: 0, revisados: 0, sinFecha: 0, bytesAprox: 0, porAlmacen: {} }

    const db = await base()
    if (db === null) {
      return {
        ok: false,
        ...vacio,
        motivo: MOTIVO_PURGA.SIN_BD,
        mensaje:
          'No hay caché local que purgar en este navegador, así que tampoco hay espacio que ' +
          'liberar por aquí.',
      }
    }
    if (!sabePurgar(db)) {
      return {
        ok: false,
        ...vacio,
        motivo: MOTIVO_PURGA.SIN_SOPORTE,
        mensaje:
          'El almacén local cableado sabe leer y escribir, pero no listar ni borrar, así que la ' +
          'caché no se puede purgar.',
      }
    }

    const t = ahora()
    const porAlmacen = {}
    let purgados = 0
    let revisados = 0
    let sinFecha = 0
    let bytesAprox = 0

    try {
      for (const almacen of ALMACENES_DE_CACHE) {
        const campoClave = ESQUEMA_ALMACENES[almacen].keyPath
        // `getAll` y no un cursor: hace falta el `guardadoEn` de cada registro para
        // decidir, y las claves solas no lo traen. Trae también el valor, que es lo
        // que permite estimar los bytes; el coste es leer la caché entera una vez, y
        // esto corre cuando el disco ya se ha llenado, no en cada consulta.
        const registros = await db.getAll(almacen)
        porAlmacen[almacen] = 0
        for (const registro of registros) {
          revisados += 1
          const marca = registro?.guardadoEn
          const rota = !Number.isFinite(marca)
          const edad = t - marca
          // El MISMO criterio que `leer`, y con el mismo `>`: un registro de
          // exactamente el TTL todavía acierta, así que todavía no se tira. Y una
          // marca FUTURA (edad negativa: reloj retrocedido, S3) se tira también:
          // `leer` ya no la sirve nunca, así que es peso muerto que además no
          // caducaría jamás por antigüedad.
          if (!rota && edad >= 0 && edad <= ttlMs) continue

          await db.delete(almacen, registro[campoClave])
          purgados += 1
          porAlmacen[almacen] += 1
          if (rota) sinFecha += 1
          bytesAprox += bytesAproximados(registro)
        }
      }
    } catch (error) {
      cuenta.purgas += 1
      cuenta.purgados += purgados
      const mensaje =
        `La purga de la caché local se ha interrumpido (${detalleDe(error)}). Se habían borrado ` +
        `${purgados} registro(s) antes del fallo, y esos sí están borrados; el resto sigue donde ` +
        'estaba. La aplicación funciona igual: lo único que cambia es cuánto sitio queda libre.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return { ok: false, purgados, revisados, sinFecha, bytesAprox, porAlmacen, motivo: MOTIVO_PURGA.ERROR, mensaje }
    }

    cuenta.purgas += 1
    cuenta.purgados += purgados

    const kB = Math.round(bytesAprox / 1024)
    const mensaje =
      purgados === 0
        ? `No había nada caducado que purgar: los ${revisados} registro(s) de la caché local ` +
          'todavía sirven. Borrarlos igualmente obligaría a volver a pedírselos al Catastro.'
        : `Se han borrado ${purgados} de los ${revisados} registro(s) de la caché local del ` +
          `Catastro por llevar más de ${Math.round(ttlMs / 86400000)} día(s) guardados` +
          (sinFecha > 0 ? ` (${sinFecha} de ellos sin fecha utilizable)` : '') +
          `, y con ellos unos ${kB} kB. Los datos no se pierden: la próxima consulta de esas ` +
          'parcelas irá al servicio del Catastro, que es más lento pero da lo mismo.'

    // Se avisa SOLO cuando de verdad se ha borrado algo. Una purga que no encuentra
    // nada es un no-suceso, y anunciarlo sería el ruido que entierra los avisos que sí
    // traen información nueva (mismo criterio que la decisión 6).
    if (purgados > 0) avisar(mensaje, { nivel: NIVEL.AVISO })

    return { ok: true, purgados, revisados, sinFecha, bytesAprox, porAlmacen, motivo: null, mensaje }
  }

  /**
   * Fotografía de los contadores. Objeto nuevo en cada llamada: quien la guarde
   * conserva la foto y no una referencia que cambia sola.
   *
   * @returns {EstadoCache}
   */
  function estado() {
    return { ...cuenta }
  }

  return { leer, guardar, purgarCaducados, estado }
}
