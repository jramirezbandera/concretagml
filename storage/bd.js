// storage/bd.js — F05 · Tarea T1D. LA ÚNICA PUERTA DE APERTURA de la base local.
//
// Estrena `storage/` y estrena el almacenamiento persistente del proyecto: hasta
// ahora no había ni una línea de `indexedDB` ni de `localStorage` en el código.
// No hay patrón previo que copiar, así que esta cabecera deja escrito el porqué
// de cada decisión — que es justo lo que se echa de menos cuando dentro de seis
// meses alguien viene a añadir un almacén.
//
// Este módulo NO guarda nada ni lee nada. Solo abre la base y deja los almacenes
// creados. Quien guarda es la capa de encima: `storage/cache-catastro.js` (F05),
// `storage/pie-firma.js` (F09) y los expedientes de F10.
//
// ── POR QUÉ LA APERTURA VA SEPARADA DE LA CACHÉ ──────────────────────────────
// **IndexedDB tiene UN SOLO número de versión por base**, y el `upgrade` que se
// ejecuta es el de quien la abre. Si F10 abriera la base por su cuenta para
// crear `expedientes`, pasaría una de estas dos cosas, las dos malas:
//
//   · con una versión DISTINTA a la que usa F05, la segunda apertura muere con
//     `VersionError` (o fuerza un `versionchange` que cierra la primera);
//   · con la MISMA versión y otro `upgrade`, el navegador no vuelve a llamar a
//     `upgradeneeded` —la versión ya está instalada— y los almacenes del otro
//     módulo **no se crean nunca**. Sin error, sin excepción, sin nada: las
//     escrituras posteriores fallan con `NotFoundError` en otro sitio y en otro
//     momento. Es exactamente el fallo silencioso que persigue la regla de oro 1.
//
// Y hay un tercer motivo, menos evidente: `blocked` y `blocking` son eventos POR
// CONEXIÓN. Dos conexiones a la misma base desde la misma pestaña son justo lo
// que los dispara — una se bloquea a sí misma —, así que «cada módulo abre lo
// suyo» no es solo redundante: fabrica el problema que esos eventos denuncian.
//
// De ahí el diseño: **UNA puerta de apertura** ({@link abrirBd}, memoizada: una
// sola conexión por proceso) y **UNA escalera de migraciones**
// ({@link MIGRACIONES}). Quien necesite un almacén nuevo no tiene que tocar nada
// más de aquí: le basta con añadirlo a {@link ALMACENES} + {@link ESQUEMA_ALMACENES}
// y poner un `{version: N, aplicar}` al final del array. Los tres pasos van juntos
// o el módulo no carga (ver «invariantes» más abajo).
//
// ✅ **Comprobado en F09** (2026-08-02), que estrenó el peldaño 2 con el almacén
// del pie de firma: tres líneas en tres sitios de este fichero y ni una línea de
// `abrirBd`, ni de `cache-catastro.js`, ni del test de F05 tuvo que cambiar. La
// versión subió sola. Se deja escrito porque un diseño que dice «el día de mañana
// esto será fácil» solo vale cuando llega ese día y se puede contar cómo fue.
//
// ── LA ESCALERA SE APLICA CON `<`, NUNCA CON `===` ───────────────────────────
// `aplicarMigraciones` ejecuta TODA migración cuya `version` sea mayor que la
// versión que el navegador tenía (`oldVersion`), en orden. Un navegador que llega
// con la versión 0 —base nueva, que es el caso del 100 % de los usuarios nuevos—
// tiene que pasar por TODAS las migraciones; uno que llega con la 1 solo por las
// posteriores. Con `===` (en cualquiera de sus variantes: `oldVersion === m.version`,
// `oldVersion === m.version - 1`, `nuevaVersion === m.version`) el salto 0 → N
// aplicaría una migración o ninguna, la base quedaría A MEDIAS y —de nuevo— sin
// un solo error: los almacenes que faltan no se notan hasta la primera escritura.
// Por eso `aplicarMigraciones` se exporta y se prueba con una escalera SINTÉTICA
// de varios peldaños. Cuando se escribió, la escalera real tenía UN peldaño y
// ninguna prueba podía distinguir `<` de `===`; desde F09 tiene dos y el salto
// 0 → 2 ya es observable con la real, pero la sintética se conserva: es la única
// forma de ejercitar saltos que la escalera de hoy todavía no permite (1 → 3,
// 2 → 4) sin esperar a que existan.
//
// ── `VERSION_BD` ES DERIVADA, NUNCA ESCRITA A MANO ───────────────────────────
// `VERSION_BD = MIGRACIONES.length`. Así nadie puede subir la versión sin
// escribir la migración, ni escribir la migración sin subir la versión: no son
// dos ajustes que haya que acordarse de hacer a la vez, son el mismo hecho dicho
// una vez. Es la clase de guardián que este repo prefiere —estructural, no un
// comentario pidiendo por favor—, la misma idea que `NOMBRES_RESERVADOS_WINDOWS`
// en `gml/descargar.js` (derivado, no copiado).
//
// ── EL keyPath ES `refcat`, NO `refCatastral` ────────────────────────────────
// El dossier del proyecto y `spec/feature-05-catastro-vivo.md` escriben
// `refCatastral`; **el vocabulario del código es `refcat`** desde F00:
// `model/parcela.js#crearParcela` devuelve `{idLocal, refcat, …}` y el
// `ParcelaGml` de `gml/parse.js` también. Un almacén cuyo `keyPath` fuera
// `refCatastral` NO extraería clave ninguna de un POJO de parcela: `put` fallaría
// con `DataError`, o —peor— alguien «arreglaría» el problema copiando el campo
// con otro nombre al guardar, y entonces habría dos nombres para la misma cosa
// viajando por el proyecto. Dos nombres para lo mismo es la divergencia
// silenciosa que este repo persigue; aquí manda el CÓDIGO, y queda escrito.
// (`test/storage/bd.test.js` lo comprueba DERIVÁNDOLO del modelo real, no
// comparando con la cadena `'refcat'` escrita a mano por segunda vez.)
//
// ── UNA PESTAÑA VIEJA QUE BLOQUEA LA MIGRACIÓN TIENE QUE VERSE ───────────────
// Los tres sucesos del ciclo multipestaña van al canal `Avisar` de
// `viewer/_comun.js` con `NIVEL.AVISO`, nunca a un `console.log` a secas y nunca
// en silencio:
//   · `blocked`   — no podemos abrir porque otra pestaña tiene la versión vieja;
//   · `blocking`  — somos NOSOTROS los que impedimos a otra pestaña actualizar;
//   · `terminated`— el navegador ha cerrado la conexión por su cuenta.
// Es la regla de oro 1 aplicada a un caso que, si se calla, se le manifiesta al
// usuario como «la aplicación no guarda nada y no dice por qué».
//
// `NIVEL.AVISO` y no `NIVEL.ERROR`, derivado de la regla de clasificación escrita
// en `viewer/_comun.js`: **ERROR es lo que impide generar el GML; AVISO lo que
// no.** El almacén local es caché y comodidad — la geometría del usuario está en
// el modelo, en memoria, y el GML se genera igual con la base cerrada. Mismo
// criterio con el que la cartografía de fondo que no carga es AVISO. Sigue siendo
// cierto con el pie de firma de F09: sin base hay que volver a teclearlo, que es
// una molestia, no un impedimento.
//
// ── UN ENTORNO SIN IndexedDB NO PUEDE REVENTAR LA APP ────────────────────────
// Node no tiene `indexedDB` (medido: `typeof indexedDB === 'undefined'` en la
// v22 con la que corre la suite), y en el navegador tampoco es un derecho
// adquirido: el modo privado de algunos navegadores lo capa, y un `<iframe>` de
// tercera parte con cookies bloqueadas también. Siguiendo el precedente de
// `gml/descargar.js`, se distingue:
//   · «el programador me ha pasado basura» (`indexedDB: 42`) → `throw`;
//   · «este entorno no puede» (no hay `indexedDB`, o lo que hay no sabe `open`)
//     → ESTADO devuelto, con `motivo` y un `mensaje` presentable, más su aviso.
// La comprobación es DUCK TYPING (`typeof fabrica.open === 'function'`) y no
// `instanceof IDBFactory`, igual que `esDocumentoUtil` allí: `instanceof` obliga
// a que exista el constructor global —que en Node no existe— y le impide a un
// doble de test hacer de fábrica sin fingir una jerarquía entera.
//
// ── POR QUÉ NO SE USA `openDB()` DE `idb`, USÁNDOSE `idb` ────────────────────
// Se usa `idb` (Jake Archibald), pero por su primitiva `wrap`, no por su
// `openDB`. Motivo MEDIDO, no estético: `openDB` llama a `indexedDB.open(…)`
// leyendo el GLOBAL, y no admite que se le pase la fábrica. Con `openDB`, el
// parámetro `indexedDB` de {@link abrirBd} sería decorativo — inyectarías una
// fábrica y el módulo abriría otra base, la global, sin decir nada. Un parámetro
// que no hace lo que su nombre dice es una mentira silenciosa, y además la suite
// `node` se quedaría sin forma de aislar cada prueba en su propia base.
// Así que aquí se repiten las quince líneas de `openDB` sobre la fábrica que se
// recibe y se delega en `wrap`, que es DONDE ESTÁ EL VALOR de `idb`: el proxy que
// convierte peticiones en promesas y da `bd.get/put`, `tx.done` y
// `getAllFromIndex` a quien construya encima (F05 y F10).
//
// ── QUÉ NO ENTRA EN EL BARREL RAÍZ ──────────────────────────────────────────
// `storage/bd.js` NO se re-exporta desde `index.js`, por la misma decisión ya
// escrita en `gml/index.js` para `gml/descargar.js`: el barrel raíz es la
// superficie de DOMINIO (modelo, geometría, parsers, GML), y esto es un
// ADAPTADOR DE ENTORNO, que depende de una capacidad del navegador. Quien lo
// necesite lo importa directamente, que es lo que ya hace `app/main.js` con
// `viewer/index.js`:
//
//   import { abrirBd, ALMACENES } from '../storage/bd.js'
//
// (Matiz honesto, para que nadie lo lea como una prohibición técnica: este
// módulo SÍ se puede importar bajo el proyecto Vitest `node` —`globalThis.indexedDB`
// se lee en el momento de la LLAMADA, como valor por defecto de un parámetro, no
// en el de la carga—, al contrario que `viewer/mapa.js`, que revienta al
// importarse porque Leaflet exige `window`. La razón de dejarlo fuera del barrel
// es de capas, no de que explote.)
//
// ── DEPENDENCIA DE `viewer/_comun.js`, Y POR QUÉ NO SE COPIA ─────────────────
// El canal `Avisar` (`resolverAvisar`, `avisoPorDefecto`, `NIVEL`) vive hoy en
// `viewer/_comun.js` aunque sea un contrato de TODO el proyecto: `services/ign.js`,
// `services/osm.js` y `viewer/*` lo importan de ahí. Reimplementarlo aquí para no
// «depender del visor» crearía un SEGUNDO canal con su propia idea de qué es un
// AVISO, que es peor que la dependencia. `viewer/_comun.js` no importa Leaflet
// (lo declara su cabecera y lo comprueba la suite `node`), así que el import es
// seguro desde aquí. Si algún día el canal se muda a un módulo neutro, este
// import se muda con él.

import { wrap } from 'idb'

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── Identidad de la base ─────────────────────────────────────────────────────

/**
 * Nombre de la base. UNO para toda la aplicación: la caché del Catastro (F05) y
 * los expedientes (F10) son almacenes DE LA MISMA base, no bases distintas (ver
 * la cabecera: un número de versión por base).
 *
 * Se exporta porque el nombre es un hecho observable del sitio —hay que poder
 * borrarla (`indexedDB.deleteDatabase(NOMBRE_BD)`) desde una herramienta de
 * diagnóstico o desde el guion de humo en navegador— y porque escribirlo a mano
 * en otro fichero sería la primera forma de acabar con dos bases.
 *
 * @readonly
 */
export const NOMBRE_BD = 'concreta-gml'

// ── Almacenes ────────────────────────────────────────────────────────────────

/**
 * Los almacenes de la base, por su nombre en IndexedDB. El valor ES la cadena que
 * espera cualquier API de `idb` (`bd.get(ALMACENES.PARCELAS, refcat)`), a
 * propósito: un descriptor obligaría a escribir `ALMACENES.PARCELAS.nombre` en
 * cada llamada y nadie lo haría dos veces seguidas sin equivocarse.
 *
 * Nombres heredados de `spec/feature-05-catastro-vivo.md` (`catastroCache`,
 * `revgeo`) y conservados tal cual: cambiarlos ahora costaría una migración de
 * verdad —copiar registros— para no ganar nada.
 *
 * @readonly
 */
export const ALMACENES = Object.freeze({
  /** Parcelas traídas del WFS del Catastro. Clave: la referencia catastral. */
  PARCELAS: 'catastroCache',
  /** Geocodificación inversa: punto redondeado → referencia catastral. */
  REVGEO: 'revgeo',
  /**
   * F09 · El pie de firma del informe, para recordarlo entre sesiones (la casilla
   * «Recordar» del diálogo de informe). **Un solo registro, siempre el mismo**:
   * no es un historial. Quién escribe aquí, qué guarda exactamente y cómo se
   * borra está en `storage/pie-firma.js`, que es su único dueño.
   *
   * ⚠️ Es el PRIMER almacén de la base con datos personales de quien usa la
   * aplicación (los dos de arriba son cartografía pública). Esa diferencia manda
   * en su política y por eso vive en un almacén aparte y no colgado de la caché:
   * un almacén propio se borra entero de una vez.
   */
  PIE_FIRMA: 'pieFirma',
})

/**
 * El esquema de cada almacén **tal y como es HOY**, indexado por su nombre. Es lo
 * que el código que lee y escribe puede dar por cierto.
 *
 * No confundir con {@link MIGRACIONES}, que es HISTORIA (cómo se llegó hasta
 * aquí). Los dos hablan de lo mismo desde extremos opuestos, y esa duplicación es
 * deliberada: el test abre la base ejecutando la escalera de verdad y compara el
 * resultado REAL contra esta declaración. Si alguien cambiara un `keyPath` aquí
 * sin escribir la migración que lo mueve, la comparación se pone roja nombrando
 * la discrepancia — que es justo el fallo que en producción no daría la cara
 * hasta el primer `put` de un usuario con la base ya creada.
 *
 * Las claves se computan desde {@link ALMACENES}: el nombre de un almacén se
 * escribe UNA vez en este fichero.
 *
 * @readonly
 * @type {Readonly<Record<string, Readonly<{keyPath: string}>>>}
 */
export const ESQUEMA_ALMACENES = Object.freeze({
  /**
   * `keyPath: 'refcat'` — la referencia catastral, con el nombre que el modelo le
   * da desde F00 (`model/parcela.js`), NO `refCatastral` (ver la cabecera). El
   * registro guardado es un POJO que la lleva dentro; IndexedDB la extrae solo.
   */
  [ALMACENES.PARCELAS]: Object.freeze({ keyPath: 'refcat' }),
  /**
   * `keyPath: 'clave'` — clave COMPUESTA por el llamante: `x,y,srs` con las
   * coordenadas ya redondeadas (`spec/feature-05-catastro-vivo.md`: «`round(x),
   * round(y),srs → refcat`»). El registro es `{clave, refcat, …}`.
   *
   * El redondeo NO se decide aquí: cuántos metros de rejilla comparten respuesta
   * es una política de caché —cuánto se parece un clic al de al lado—, y vive con
   * la caché (`storage/cache-catastro.js`). Este módulo solo fija el CAMPO en el
   * que la clave se guarda, para que la caché y la base no puedan discrepar.
   *
   * Se usa un campo de texto ya compuesto, y no una clave de array
   * (`keyPath: ['x','y','srs']`, que IndexedDB admite), porque con un array la
   * política de redondeo quedaría implícita en los valores guardados: dos
   * registros «iguales» con distinto redondeo convivirían sin que nada lo
   * denuncie. Con una cadena canónica, la clave ES la política.
   */
  [ALMACENES.REVGEO]: Object.freeze({ keyPath: 'clave' }),
  /**
   * `keyPath: 'id'` — y la clave la escribe el llamante, que siempre pone LA
   * MISMA (`storage/pie-firma.js#CLAVE_PIE_FIRMA`). Es deliberado: con una clave
   * fija, `put` PISA, así que en este almacén no puede haber más de un registro
   * ni, por tanto, un historial de firmas que nadie pidió guardar. La alternativa
   * —una clave por fecha, o autoincremental— acumularía versiones antiguas del
   * nombre y el contacto de una persona sin que nada las borrara.
   *
   * El campo se llama `id` y no `clave` para no darle a entender a nadie que este
   * almacén se enruta por la tabla de prefijos de la caché: no es caché, no tiene
   * TTL y no se purga.
   */
  [ALMACENES.PIE_FIRMA]: Object.freeze({ keyPath: 'id' }),
})

// ── Escalera de migraciones ──────────────────────────────────────────────────

/**
 * Un peldaño de la escalera de migraciones.
 *
 * @typedef {Object} Migracion
 * @property {number} version  Versión de la base que este peldaño DEJA instalada.
 *   Consecutiva empezando en 1 (lo comprueba {@link comprobarInvariantes}).
 * @property {(bd: *, tx: *) => void} aplicar  Cambios de esquema. `bd` es la base
 *   envuelta por `idb` dentro del `upgradeneeded`; `tx` es la transacción
 *   `versionchange` en curso, por si una migración futura necesita LEER datos
 *   para transformarlos (F10). Síncrona: dentro de `upgradeneeded` no se puede
 *   ceder el turno al bucle de eventos sin que la transacción se cierre sola.
 */

/**
 * LA ESCALERA. Es HISTORIA, no configuración: cada peldaño describe un cambio que
 * ya está aplicado en la base de alguien y por eso **no se edita nunca hacia
 * atrás** — se añade uno nuevo al final.
 *
 * De ahí que cada peldaño escriba los nombres y los `keyPath` LITERALES en vez de
 * recorrer {@link ESQUEMA_ALMACENES}: derivarlos del esquema de hoy los
 * convertiría en migraciones que cambian con el tiempo. **Y ya no es hipotético:**
 * con `pieFirma` en el esquema (F09), una migración 1 «derivada» lo crearía
 * TAMBIÉN en las bases nuevas y luego la migración 2 volvería a crearlo →
 * `ConstraintError` en cada usuario nuevo, mientras que a los usuarios antiguos
 * les llegaría por la vía correcta y no se enteraría nadie hasta leer los informes
 * de error. La historia se escribe literal; la coincidencia entre lo que la
 * escalera produce y lo que {@link ESQUEMA_ALMACENES} declara la vigila el test.
 *
 * Tampoco se comprueba `if (!bd.objectStoreNames.contains(…))` antes de crear:
 * con la escalera aplicada por `oldVersion < version` un almacén no puede crearse
 * dos veces, y esa comprobación solo serviría para TAPAR en silencio el día en
 * que sí pudiera. Que reviente con `ConstraintError` y con nombre y apellidos.
 *
 * @readonly
 * @type {readonly Migracion[]}
 */
export const MIGRACIONES = Object.freeze([
  Object.freeze({
    version: 1,
    // F05 · los dos almacenes de la caché del Catastro.
    aplicar(bd) {
      bd.createObjectStore('catastroCache', { keyPath: 'refcat' })
      bd.createObjectStore('revgeo', { keyPath: 'clave' })
    },
  }),
  Object.freeze({
    version: 2,
    // F09 · el pie de firma del informe, recordado entre sesiones.
    //
    // Primer peldaño que se sube de verdad: hasta aquí `VERSION_BD` valía 1 y
    // ninguna base había necesitado nunca un ascenso. A partir de este commit, un
    // usuario que ya tenía la base entra por `oldVersion === 1` y ejecuta SOLO
    // esta migración, mientras que uno nuevo entra por `oldVersion === 0` y
    // ejecuta las dos — que es exactamente lo que la condición `<` de
    // `aplicarMigraciones` sostiene y lo que un `===` habría roto en silencio.
    aplicar(bd) {
      bd.createObjectStore('pieFirma', { keyPath: 'id' })
    },
  }),
])

/**
 * Versión de la base. **DERIVADA de la escalera, jamás escrita a mano** (ver la
 * cabecera): es el número de peldaños, así que subir la versión y escribir la
 * migración son el mismo acto.
 *
 * @readonly
 */
export const VERSION_BD = MIGRACIONES.length

/**
 * Aplica los peldaños que le faltan a una base que viene en la versión
 * `versionAnterior`, EN ORDEN.
 *
 * La condición es `versionAnterior < m.version` y no `===`; el porqué está en la
 * cabecera y no es un detalle de estilo: con `===` una base nueva (versión 0) se
 * quedaría a medias sin dar error.
 *
 * Se exporta por dos motivos, los dos prácticos: (a) es la única forma de probar
 * la escalera con VARIOS peldaños hoy, que es cuando `<` y `===` dejan de dar el
 * mismo resultado — con la escalera real, de un solo peldaño, un test no puede
 * distinguirlos; y (b) F10 puede ejercitar su migración contra una base falsa sin
 * abrir nada.
 *
 * @param {*} bd  Base envuelta por `idb` dentro del `upgradeneeded`. No se valida
 *   su forma: quien la pasa es {@link abrirBd} o un test, y cada `aplicar` fallará
 *   por su cuenta si recibe algo que no sabe crear almacenes.
 * @param {number} versionAnterior  `event.oldVersion`. **0 = base nueva.**
 * @param {object} [opciones]
 * @param {*} [opciones.tx=null]  Transacción `versionchange` en curso.
 * @param {readonly Migracion[]} [opciones.migraciones=MIGRACIONES]  La escalera.
 *   Se inyecta SOLO en pruebas; en producción siempre es la real.
 * @returns {number[]}  Las versiones aplicadas, en el orden en que se aplicaron.
 *   Devolverlas —en vez de no devolver nada— permite afirmar el ORDEN y la
 *   COMPLETITUD del salto sin espiar la base.
 * @throws {TypeError}  Si `versionAnterior` no es un entero ≥ 0 (contrato roto
 *   por el programador: `oldVersion` siempre lo es).
 */
export function aplicarMigraciones(bd, versionAnterior, { tx = null, migraciones = MIGRACIONES } = {}) {
  if (!Number.isInteger(versionAnterior) || versionAnterior < 0) {
    throw new TypeError(
      `aplicarMigraciones: 'versionAnterior' debe ser un entero ≥ 0 (0 = base nueva); ` +
        `recibido ${JSON.stringify(versionAnterior)}.`,
    )
  }
  const aplicadas = []
  for (const migracion of migraciones) {
    if (versionAnterior < migracion.version) {
      migracion.aplicar(bd, tx)
      aplicadas.push(migracion.version)
    }
  }
  return aplicadas
}

/**
 * Invariantes que se comprueban AL CARGAR EL MÓDULO, no en un test: si esto está
 * mal, la base de un usuario se queda a medias, y quiero que rompa en el primer
 * `import` —en el arranque de la app y en la primera prueba que la toque— y no
 * cuando alguien acierte a ejecutar la suite completa.
 *
 * Son los tres pares que pueden separarse al añadir un almacén (F10):
 * nombre ↔ esquema, esquema ↔ nombre, y peldaño ↔ versión.
 *
 * @throws {Error}  Nombrando exactamente lo que falta.
 */
function comprobarInvariantes() {
  const nombres = Object.values(ALMACENES)
  if (new Set(nombres).size !== nombres.length) {
    throw new Error(
      `storage/bd.js: ALMACENES tiene nombres repetidos (${nombres.join(', ')}). ` +
        'Dos claves apuntando al mismo almacén hacen creer que hay dos.',
    )
  }
  const conEsquema = Object.keys(ESQUEMA_ALMACENES)
  const sinEsquema = nombres.filter((n) => !conEsquema.includes(n))
  if (sinEsquema.length > 0) {
    throw new Error(
      `storage/bd.js: hay almacenes en ALMACENES sin entrada en ESQUEMA_ALMACENES ` +
        `(${sinEsquema.join(', ')}). Un almacén sin keyPath declarado no se puede ni crear ni comprobar.`,
    )
  }
  const sinAlmacen = conEsquema.filter((n) => !nombres.includes(n))
  if (sinAlmacen.length > 0) {
    throw new Error(
      `storage/bd.js: ESQUEMA_ALMACENES declara almacenes que no están en ALMACENES ` +
        `(${sinAlmacen.join(', ')}). Nadie podría nombrarlos para leerlos.`,
    )
  }
  MIGRACIONES.forEach((migracion, i) => {
    if (migracion.version !== i + 1) {
      throw new Error(
        `storage/bd.js: MIGRACIONES[${i}] declara la versión ${migracion.version} y debería ` +
          `ser ${i + 1}. Las versiones son CONSECUTIVAS desde 1 porque VERSION_BD se deriva de ` +
          'la longitud del array: un hueco dejaría la base en una versión que nadie migra.',
      )
    }
    if (typeof migracion.aplicar !== 'function') {
      throw new Error(`storage/bd.js: MIGRACIONES[${i}] no tiene función 'aplicar'.`)
    }
  })
}

comprobarInvariantes()

// ── Degradación: qué se devuelve cuando no hay base ──────────────────────────

/**
 * Por qué no hay base. Códigos estables, para que la UI decida sin leerle el
 * texto al `mensaje` (mismo criterio que `MOTIVO_NO_DESCARGADO` en
 * `gml/descargar.js`).
 *
 * @readonly
 */
export const MOTIVO_SIN_BD = Object.freeze({
  /** El entorno no tiene IndexedDB, o lo que hay no sabe `open`. Node, modo privado. */
  SIN_INDEXEDDB: 'SIN_INDEXEDDB',
  /** Hay IndexedDB, pero la apertura falló (cuota, `VersionError`, permisos…). */
  ERROR_APERTURA: 'ERROR_APERTURA',
})

/**
 * Lo que resuelve {@link abrirBd}. POJO plano con las CUATRO claves siempre
 * presentes: quien lo reciba las lee sin comprobar antes si existen.
 *
 * No se devuelve la base «a secas» ni se lanza cuando no la hay, a propósito: sin
 * IndexedDB la aplicación tiene que seguir funcionando (se consultará el Catastro
 * cada vez, que es lento pero correcto), y un `null` pelado obligaría a quien
 * llama a inventarse el porqué. Precedente literal: `ResultadoDescarga` de
 * `gml/descargar.js`.
 *
 * @typedef {Object} ResultadoApertura
 * @property {boolean} disponible  `true` solo si `bd` es utilizable.
 * @property {*|null} bd  La base envuelta por `idb` (`IDBPDatabase`), o `null`.
 * @property {string|null} motivo  `null` si `disponible`; si no, clave de
 *   {@link MOTIVO_SIN_BD}.
 * @property {string|null} mensaje  `null` si `disponible`; si no, texto en
 *   castellano directamente presentable al usuario (regla de oro 1).
 */

/** Resultado de una apertura que ha salido bien. */
const conBase = (bd) => ({ disponible: true, bd, motivo: null, mensaje: null })

/** Resultado de una apertura que no ha podido ser. */
const sinBase = (motivo, mensaje) => ({ disponible: false, bd: null, motivo, mensaje })

// ── Apertura ─────────────────────────────────────────────────────────────────

/**
 * La conexión memoizada: la MISMA promesa para todo el proceso. Se guarda la
 * promesa y no la base para que dos llamadas simultáneas durante la apertura
 * compartan la misma —abrir dos veces en paralelo es una de las formas de
 * dispararse `blocked` a uno mismo—.
 *
 * Solo se memoiza el ÉXITO: un fallo de apertura se olvida (ver {@link abrirBd}).
 *
 * @type {Promise<ResultadoApertura>|null}
 */
let conexion = null

/**
 * La fábrica con la que se abrió {@link conexion}. Solo para detectar que alguien
 * llama luego con otra distinta y creerá estar abriendo otra base.
 *
 * @type {*|null}
 */
let fabricaEnUso = null

/**
 * ¿Tiene la FORMA de un objeto? Se admite `function` porque una fábrica podría
 * ser una clase invocable; el criterio es el mismo que `esObjetoUrl` en
 * `gml/descargar.js`. La distinción importa: que no sea un objeto es un argumento
 * equivocado (lanza); que sea un objeto sin `open` es un entorno que no puede
 * (se degrada con motivo).
 *
 * @param {*} v
 * @returns {boolean}
 */
function esObjeto(v) {
  return !!v && (typeof v === 'object' || typeof v === 'function')
}

/**
 * ¿Sirve como fábrica de IndexedDB? DUCK TYPING deliberado, no
 * `instanceof IDBFactory`: el constructor global no existe en Node, y un doble de
 * test no debería tener que fingir la jerarquía entera para hacer de fábrica. Se
 * pide exactamente lo que este módulo usa —`open`— y nada más.
 *
 * @param {*} f
 * @returns {boolean}
 */
function esFabricaIndexedDb(f) {
  return esObjeto(f) && typeof f.open === 'function'
}

/**
 * Abre la base con la fábrica dada y engancha la escalera y los tres avisos del
 * ciclo multipestaña. Es la parte de `idb#openDB` que aquí se reescribe para
 * poder inyectar la fábrica (ver la cabecera).
 *
 * @param {*} fabrica  Fábrica ya validada.
 * @param {import('../viewer/_comun.js').Avisar} avisar
 * @returns {Promise<*>}  Promesa de la base envuelta por `idb`; rechaza con lo que
 *   rechace la petición de apertura.
 */
function abrirConEscalera(fabrica, avisar) {
  const peticion = fabrica.open(NOMBRE_BD, VERSION_BD)
  const promesa = wrap(peticion)

  peticion.addEventListener('upgradeneeded', (evento) => {
    // `evento.oldVersion` es 0 en una base nueva. La escalera hace el resto.
    aplicarMigraciones(wrap(peticion.result), evento.oldVersion, {
      tx: wrap(peticion.transaction),
    })
  })

  // OTRA PESTAÑA NOS BLOQUEA: tiene abierta una versión anterior y no la suelta.
  // La apertura NO falla — se queda esperando indefinidamente a que esa pestaña
  // cierre. Sin este aviso, el síntoma es «la aplicación se ha quedado pensando».
  peticion.addEventListener('blocked', (evento) => {
    avisar(
      'No se ha podido preparar el almacén local: hay otra pestaña de esta aplicación ' +
        `abierta con una versión anterior (${evento.oldVersion} → ${evento.newVersion}). ` +
        'Cierra las demás pestañas y vuelve a cargar esta. Mientras tanto puedes trabajar y ' +
        'generar el GML con normalidad, pero no se guardará nada en la caché.',
      { nivel: NIVEL.AVISO, causa: evento },
    )
  })

  promesa.then(
    (bd) => {
      // SOMOS NOSOTROS LOS QUE BLOQUEAMOS a otra pestaña que quiere actualizar.
      //
      // DECISIÓN: NO se cierra la conexión aquí, aunque cerrarla desbloquearía a
      // la otra pestaña al instante. Cerrarla dejaría a ESTA pestaña con una base
      // muerta cuyos fallos aparecerían después y en otro sitio
      // (`InvalidStateError` en la primera lectura de caché), que es peor que el
      // bloqueo: el usuario no relacionaría una cosa con la otra. Se le cuenta lo
      // que pasa y se le da la acción —recargar—, y la decisión de cerrar queda
      // para la capa que tiene UI con la que preguntar (F10).
      bd.addEventListener('versionchange', (evento) => {
        avisar(
          'Otra pestaña de esta aplicación necesita actualizar el almacén local ' +
            `(versión ${evento.oldVersion} → ${evento.newVersion}) y esta se lo está impidiendo. ` +
            'Recarga esta página para que pueda continuar.',
          { nivel: NIVEL.AVISO, causa: evento },
        )
      })

      // TERMINACIÓN ANORMAL: el navegador ha cerrado la conexión por su cuenta
      // (se ha quedado sin espacio, o el usuario ha borrado los datos del sitio).
      // Este evento NO se dispara cuando la cierra uno mismo con `close()`.
      bd.addEventListener('close', () => {
        avisar(
          'El navegador ha cerrado el almacén local de esta aplicación (falta de espacio, o se ' +
            'han borrado los datos del sitio). Puedes seguir trabajando y generar el GML, pero ' +
            'no se guardará ni se leerá nada en caché hasta que recargues la página.',
          { nivel: NIVEL.AVISO },
        )
      })
    },
    () => {
      // El fallo lo trata quien llamó (abrirBd): aquí solo se evita que esta rama
      // cuente como rechazo no gestionado. No se traga nada.
    },
  )

  return promesa
}

/**
 * Abre —una sola vez por proceso— la base local de la aplicación, con sus
 * almacenes ya creados, y devuelve la promesa MEMOIZADA del resultado.
 *
 * Nunca rechaza y nunca lanza por causas del entorno: si no hay IndexedDB o la
 * apertura falla, resuelve un {@link ResultadoApertura} con `disponible: false`,
 * su `motivo` y un `mensaje` presentable, **y lo cuenta por el canal `alAvisar`**
 * (regla de oro 1). Lanzar queda para el contrato roto por el programador.
 *
 * MEMOIZACIÓN: la segunda llamada devuelve LA MISMA promesa, no una equivalente.
 * Como consecuencia, `alAvisar` e `indexedDB` los fija la PRIMERA llamada —así
 * que la aplicación debe cablear su avisador al arrancar, antes de que nadie
 * consulte la caché—. Solo se memoiza el éxito: si la apertura falla, el memo se
 * olvida para que una llamada posterior pueda reintentar (la causa típica —otra
 * pestaña, o cuota momentánea— se resuelve sola con el tiempo, y memoizar un
 * fracaso lo volvería permanente).
 *
 * @param {object} [opciones]
 * @param {*} [opciones.indexedDB=globalThis.indexedDB]  Fábrica de IndexedDB. Se
 *   inyecta en las pruebas (`new IDBFactory()` de `fake-indexeddb` da una base
 *   aislada por prueba) y podría inyectarse en un `<iframe>`. `null`/`undefined`
 *   significan «este entorno no la tiene», que es un estado legítimo, no un error.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 *   Canal de avisos. `null` ⇒ `avisoPorDefecto` de `viewer/_comun.js`
 *   (`console.warn`), que es el suelo mínimo de la regla 1; nunca el silencio.
 * @returns {Promise<ResultadoApertura>}
 * @throws {TypeError}  Si `alAvisar` no es función ni nulo (lo lanza
 *   `resolverAvisar`); si `indexedDB` no es ni objeto ni función ni nulo; o si se
 *   vuelve a llamar con una fábrica DISTINTA de aquella con la que la base ya
 *   está abierta — devolver calladamente la conexión de otra base sería mentirle
 *   a quien llama, y este módulo solo sabe tener una.
 */
export function abrirBd({ indexedDB = globalThis.indexedDB, alAvisar = null } = {}) {
  // Se resuelve SIEMPRE, también en la llamada memoizada: un `alAvisar` con
  // basura es un contrato roto por el programador y debe reventar la primera vez
  // que se escribe, no la primera vez que algo va mal.
  const avisar = resolverAvisar(alAvisar)

  if (conexion !== null) {
    if (indexedDB !== fabricaEnUso) {
      throw new TypeError(
        'abrirBd: la base ya está abierta con otra implementación de IndexedDB. Este módulo ' +
          'mantiene UNA sola conexión por proceso (ver la cabecera: una base, un número de ' +
          'versión), así que la fábrica que pasas ahora se ignoraría y creerías estar ' +
          'trabajando contra otra base. Aísla las pruebas con una fábrica por proceso/módulo.',
      )
    }
    return conexion
  }

  if (indexedDB !== null && indexedDB !== undefined && !esObjeto(indexedDB)) {
    throw new TypeError(
      `abrirBd: 'indexedDB' debe ser una fábrica de IndexedDB (algo con 'open'), o ` +
        `null/undefined si este entorno no la tiene; recibido un ${typeof indexedDB}.`,
    )
  }

  if (!esFabricaIndexedDb(indexedDB)) {
    const mensaje =
      'Este navegador o entorno no permite el almacenamiento local (IndexedDB): puede que ' +
      'estés en una ventana privada o que el sitio tenga los datos bloqueados. La aplicación ' +
      'funciona igual, pero no recordará nada al cerrar la pestaña y consultará al Catastro ' +
      'cada vez en lugar de reutilizar lo ya descargado.'
    avisar(mensaje, { nivel: NIVEL.AVISO })
    // NO se memoiza: no hay conexión que reutilizar, y una llamada posterior con
    // una fábrica explícita (un `<iframe>`, una prueba) debe poder abrirla.
    return Promise.resolve(sinBase(MOTIVO_SIN_BD.SIN_INDEXEDDB, mensaje))
  }

  const promesa = abrirConEscalera(indexedDB, avisar).then(
    (bd) => conBase(bd),
    (error) => {
      // Se olvida el memo para permitir reintentos (ver arriba). Se compara la
      // identidad por si otra llamada ya hubiera instalado una conexión buena.
      if (conexion === promesa) {
        conexion = null
        fabricaEnUso = null
      }
      const detalle = error && error.name ? `${error.name}: ${error.message}` : String(error)
      const mensaje =
        `No se ha podido abrir el almacén local de la aplicación (${detalle}). Puedes seguir ` +
        'trabajando y generar el GML con normalidad; lo que no habrá es caché ni guardado ' +
        'entre sesiones. Si el problema persiste, cierra las demás pestañas de la aplicación ' +
        'y vuelve a cargarla.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return sinBase(MOTIVO_SIN_BD.ERROR_APERTURA, mensaje)
    },
  )

  conexion = promesa
  fabricaEnUso = indexedDB
  return promesa
}
