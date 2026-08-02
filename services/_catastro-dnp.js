// services/_catastro-dnp.js — F09 · T2.3 · LOS DATOS ALFANUMÉRICOS de la parcela
// (OVC Callejero, operación `Consulta_DNPRC`): de una referencia catastral al
// municipio, la provincia, el paraje y el polígono/parcela que el informe de
// contraste imprime en su encabezado.
//
// Módulo INTERNO de `services/` (de ahí el guion bajo, como `_red.js`,
// `_catastro-wfs.js` y `_catastro-ovc.js`). **No toca la red**: recibe TEXTO y
// devuelve ESTRUCTURA. Quien pide es el transporte (`services/_red.js`); quien
// traduce lo de aquí al vocabulario público del proyecto (`MOTIVO_CATASTRO`) es
// `services/catastro.js`. Este módulo devuelve un `tipo` PROPIO —{@link
// TIPO_DNPRC}— y deja traducir a la capa de arriba.
//
// ── POR QUÉ ES UN FICHERO APARTE Y NO UN CAPÍTULO DE `_catastro-ovc.js` ──────
//
// La pregunta es legítima: el hermano se llama `_catastro-**ovc**.js`, y el OVC
// es la misma casa. Se separa por cuatro razones MEDIDAS, no por gusto:
//
//   1. **No es el mismo servicio.** El hermano habla con
//      `…/OVCWcfCallejero/COVC**Coordenadas**.svc`; este, con
//      `…/OVCWcfCallejero/COVC**Callejero**.svc`. Son dos `.svc` distintos, con
//      dos WSDL distintos, y por tanto dos contratos que pueden cambiar por
//      separado. Meterlos en un fichero llamado «ovc» invitaría a suponer que lo
//      que vale para uno vale para el otro — y el punto 2 demuestra que no.
//   2. **No comparten ni la convención del envoltorio.** Allí
//      `Consulta_RCCOORResult`; aquí `consulta_dnprcResult`, **todo en
//      minúsculas**. Un solo módulo con las dos claves dentro sugiere una regla
//      («la clave es el nombre de la operación + Result») que **es falsa** y que
//      cualquiera derivaría al leerlas juntas.
//   3. **La cabecera del hermano es la narración de UNA trampa** (los dos
//      endpoints de geocodificación y sus tres defensas). Este módulo tiene las
//      suyas, distintas, y mezclar las dos historias hace que no se lea ninguna.
//   4. **Tamaño.** El hermano ya son ~700 líneas. Duplicarlas no ayuda a nadie.
//
// Lo único que se comparte de verdad —la longitud de una referencia catastral de
// parcela— se IMPORTA de allí en vez de escribirse otra vez: dos constantes con
// el mismo 14 son dos constantes que pueden divergir. Es el mismo criterio que ya
// aplica `services/catastro.js`.
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ LA TRAMPA: EL PARÁMETRO SE LLAMA `RefCat`, **NO** `RC`.                      ║
// ║                                                                              ║
// ║ Con `…&RC=9398516VK3799G` el servicio contesta **HTTP 200** con              ║
// ║                                                                              ║
// ║   {"consulta_dnprcResult":{"control":{"cuerr":1},                            ║
// ║     "lerr":[{"cod":"17","des":"LA REFERENCIA CATASTRAL ES OBLIGATORIA"}]}}   ║
// ║                                                                              ║
// ║ …«ES OBLIGATORIA», **de una referencia catastral que iba en la petición**.   ║
// ║ Es el TERCER caso del patrón que este repo ya conoce (`cod:16` y `cod:76`    ║
// ║ del hermano): **el servicio informa de un fallo NUESTRO con el vocabulario   ║
// ║ de un dato que falta**. Un lector ingenuo lo traduce a «esa referencia no    ║
// ║ existe» o «el usuario no ha escrito nada»; la verdad es que el parámetro     ║
// ║ está mal escrito y **falla el 100 % de las peticiones**.                     ║
// ║                                                                              ║
// ║ El nombre bueno no se adivinó: se leyó del esquema del propio servicio       ║
// ║ (`COVCCallejero.svc?singleWsdl`), donde `Consulta_DNPRC_In` declara tres     ║
// ║ partes: `Municipio`, `Provincia` y **`RefCat`**.                             ║
// ║ Medido: `test/fixtures/catastro/ovc-dnprc-cod17.json`.                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ── LAS TRES DEFENSAS DE ESTE MÓDULO ─────────────────────────────────────────
//
//   1. **La referencia se valida ANTES de emitir la petición.** {@link urlDnprc}
//      exige una referencia de parcela con la forma medida
//      ({@link LONGITUD_REFCAT_PARCELA} caracteres del alfabeto `[0-9A-Z]`), así
//      que **la petición sin referencia —la que provoca el `cod:17`— no puede
//      salir de aquí**. Es mejor que saber interpretar el error: el error no
//      llega a existir.
//   2. **NO hay tabla de códigos que signifiquen «no hay datos», y su ausencia es
//      la decisión.** El hermano tiene `COD_OVC_SIN_REFERENCIA` porque midió el
//      `cod:16`. Aquí **nadie ha medido qué contesta `Consulta_DNPRC` a una
//      referencia inexistente** (hueco declarado en `PROCEDENCIA.md`), así que no
//      hay ni un código que se pueda traducir a «esa parcela no está». Escribir
//      la tabla vacía «para tenerla» sería un detector de una señal que nadie ha
//      visto: o código muerto que TRANQUILIZA, o un disparo en falso (trampa 7 de
//      `services/catastro.js`). Lo que sí hay es {@link COD_DNPRC_MEDIDOS}, que
//      es un **diccionario de lo que SÍ se ha visto**, y hoy tiene una entrada.
//   3. **Todo `lerr` es {@link TIPO_DNPRC.RESPUESTA_ILEGIBLE}**, con el `cod` y
//      el `des` LITERALES del servicio dentro del mensaje. Y el mensaje **no
//      afirma de quién es la culpa cuando no se sabe**: dice que el código es
//      desconocido, que puede significar «la referencia no existe» o «la petición
//      está mal construida», y que **nadie lo ha medido**. Sonar seguro de eso
//      sería inventarse la respuesta del Catastro.
//
// ── LO QUE HAY QUE SABER DEL CUERPO DE LA RESPUESTA ──────────────────────────
// Todo MEDIDO contra el servicio real el 2026-08-02 y documentado en
// `test/fixtures/catastro/PROCEDENCIA.md`, que MANDA (regla de oro 8):
//
//   · **El envoltorio se llama `consulta_dnprcResult`, TODO EN MINÚSCULAS**,
//     mientras el hermano usa `Consulta_RCCOORResult`. Misma casa, misma máquina,
//     misma tanda de medición, y **no siguen la misma convención**. Cualquier
//     código que derive la clave del nombre de la operación funciona con uno y
//     falla con el otro. Aquí está escrita a mano, y a propósito.
//   · **HAY DOS RAMAS Y NO TIENEN LA MISMA FORMA**: `bico.bi` (UN inmueble,
//     objeto) y `lrcdnp.rcdnp[]` (VARIOS, array). No son la misma estructura con
//     distinta cardinalidad: traen campos distintos.
//   · **LA PARCELA DE REFERENCIA DE ESTE PROYECTO CAE EN LA RAMA LISTA**, con 18
//     inmuebles. O sea: `bico` —que parece el caso normal— **no lo es** en la
//     parcela que recorre toda la suite. Quien lea `…Result.bico.bi.dt.nm` para
//     sacar el municipio obtiene `undefined` justo ahí.
//   · **En la rama `lrcdnp` NO existen `ldt` ni `cn`**: ni domicilio ya montado
//     ni forma directa de saber si la parcela es urbana o rústica. Y la
//     referencia catastral cuelga **un nivel más arriba** (`rcdnp.rc` frente a
//     `bico.bi.idbi.rc`).
//   · **El subárbol rústico es `locs.lors`, y contiene `lorus` Y `lourb`.** El
//     urbano es `locs.lous`. Quien busque la dirección en `locs.lous.lourb` —la
//     ruta que funciona en la urbana— no la encuentra en la rústica **aunque
//     `lourb` exista**: allí cuelga de `lors`.
//   · **Los códigos vienen SIN CEROS A LA IZQUIERDA** (`loine.cm:"5"` para el INE
//     005; `cpp.cpa:"5"` mientras la referencia catastral lleva `00005`), y hay
//     **dos códigos de municipio distintos**: `loine.cm` (INE) y `cmc` (DGC) —
//     para Madrid, `"79"` y `"900"`. Este módulo **no expone ninguno de los dos**
//     ni los rellena: el informe imprime NOMBRES, y rellenar un código es
//     inventarse un dato que el servicio no ha mandado.
//   · **`debi.cpt` trae COMA decimal DENTRO de la cadena** (`"8,200000"`, o sea
//     `NaN` con `Number()`), al revés que el hermano, que daba `"439242.88"` con
//     punto. Este módulo **no lee ni un número**: los siete campos del contrato
//     son cadenas o `null`, y por eso la coma decimal no le puede morder. Queda
//     escrito aquí para quien venga a añadir superficies.
//   · **El error llega con HTTP 200**, igual que el acierto. `response.ok` no
//     clasifica nada en este servicio: la clasificación se hace leyendo el cuerpo,
//     que es justo lo que hace {@link leerDnprc}.
//
// ── LAS TRES DECISIONES DE LECTURA, ESCRITAS PARA QUE NO SE REABRAN ──────────
//
//   A. **En la rama `lrcdnp` cada campo se lee de TODOS los inmuebles y solo se
//      da por bueno si TODOS coinciden.** Si no coinciden, el campo sale `null`
//      **y la discrepancia se declara** ({@link ResultadoDnprc}`.discrepancias`):
//      quedarse con el primero sería elegir en silencio entre dos datos del
//      Catastro. Medido: en el fixture de 18 inmuebles los 18 dan
//      `MADRID`/`MADRID`, así que el camino normal está cubierto por verdad
//      externa; el de la discrepancia se prueba con un fixture **derivado**, y
//      como tal se declara (ver `test/fixtures/catastro/PROCEDENCIA.md`).
//   B. **`clase` se deduce del SUBÁRBOL presente** (`lors` → rústica, `lous` →
//      urbana) y **si no es concluyente, es `null`**. No se puede leer de `cn`
//      —que sería lo natural— porque `cn` **no existe en la rama lista**. Cuando
//      `cn` SÍ está (rama `bico`) se usa como CONTRASTE: si contradice al
//      subárbol, `clase` sale `null` y se dice. ⚠️ **Hueco declarado: nadie ha
//      medido la diagonal «rama lista + rústica»**, o sea si en una rústica con
//      varios inmuebles aparece `lors`. Las dos capturas dan `lrcdnp`+urbana y
//      `bico`+rústica: las dos diagonales contrarias.
//   C. **`domicilio` es el `ldt` del servicio, LITERAL, o `null`. NO se compone.**
//      En la rama `lrcdnp` no hay `ldt` ni una vez en 6,8 kB, y montarlo desde
//      `dir` (`tv`+`nv`+`pnp`+`plp`) exigiría decidir qué partes entran, qué
//      separadores y qué se hace con los 18 `loint` distintos (planta y puerta de
//      cada inmueble, que no son de la parcela). Eso es redactar un dato, no
//      leerlo. **`null` significa «el servicio no lo trae», y el informe lo
//      imprime como “No consta”** — que es exactamente lo que el contrato D
//      manda, y no un fallo.
//
// ⏱️ **LATENCIA MEDIDA: 0,966 s** en la consulta de 18 inmuebles y 0,339 s en la
// rústica. Sigue en pie el hecho 3 de `PROCEDENCIA.md`: el rango de este endpoint
// **no está acotado en décimas** (una llamada del hermano llegó a 2,9 s). Fijar el
// timeout no es cosa de este módulo (es de `services/_red.js`); queda anotado para
// que nadie lo baje pensando que 0,2 s es lo normal.
//
// 🔒 **Override O8 (denegación ~10 días por uso abusivo).** Este módulo no pide
// nada, pero su forma condiciona el gasto: la operación es **una petición por
// parcela y por informe**, y `services/catastro.js` la pasa por la caché ANTES de
// tocar la red. Por eso {@link urlDnprc} no admite `Provincia`/`Municipio`: la
// única petición medida los manda VACÍOS, y ofrecer variantes multiplicaría las
// claves de caché —y por tanto las peticiones— sin que ninguna esté respaldada.
//
// Contrato de errores (SPEC §2, regla 1), la misma frontera que en todo el
// proyecto: **contrato roto por el PROGRAMADOR** (referencia que no es una
// referencia, `texto` que no es texto) → `throw TypeError`/`RangeError`;
// **respuesta rara del SERVICIO** → objeto de estado, jamás una excepción.

import { LONGITUD_REFCAT_PARCELA } from './_catastro-ovc.js'

// ── Constantes del servicio ───────────────────────────────────────────────────

/**
 * Endpoint ÚNICO de la consulta de datos alfanuméricos por referencia catastral,
 * en su variante **WCF/JSON** (`.svc/json`). Tercer punto de contingencia CORS
 * del proyecto (regla de oro 7): nadie más debe escribir esta URL — si mañana
 * retiran el `Access-Control-Allow-Origin: *` (hoy medido y presente, y emitido
 * **aun sin cabecera `Origin`** en la petición, luego es fijo y no reflejado) se
 * apunta a un proxy aquí y el resto del código no se entera.
 *
 * ⚠️ Es `COVC**Callejero**.svc`, **no** `COVCCoordenadas.svc`: ese es el del
 * servicio hermano (`_catastro-ovc.js`). Comparten host, carpeta y familia, y no
 * comparten ni el contrato ni la convención del envoltorio.
 *
 * @readonly
 */
export const CATASTRO_OVC_DNPRC_JSON =
  'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC'

/**
 * Los tres nombres de parámetro que declara el WSDL de la operación, en un solo
 * sitio. Existen como constante —y no incrustados en la plantilla de la URL—
 * para que la trampa de la cabecera tenga un lugar físico donde estar escrita y
 * para que el test pueda afirmar sobre ellos.
 *
 * ⛔ **`RC` NO es uno de ellos**, por mucho que sea el nombre que cualquiera
 * escribiría. Con `RC=` el servicio contesta HTTP 200 y `cod:"17"`.
 *
 * @readonly
 */
export const PARAM_DNPRC = Object.freeze({
  /** Provincia por nombre. Se manda **vacía**: ver {@link urlDnprc}. */
  provincia: 'Provincia',
  /** Municipio por nombre. Se manda **vacío**: ver {@link urlDnprc}. */
  municipio: 'Municipio',
  /** La referencia catastral de 14. **No se llama `RC`.** */
  refcat: 'RefCat',
})

/**
 * Clave del envoltorio: en la respuesta de este endpoint **todo** cuelga de aquí,
 * tanto en el camino de éxito como en el de error.
 *
 * ⚠️ **VA EN MINÚSCULAS**, mientras el servicio hermano usa
 * `Consulta_RCCOORResult` con la caja del nombre de la operación. La operación se
 * PIDE como `Consulta_DNPRC` y CONTESTA en minúsculas. Está escrita a mano y no
 * derivada del nombre de la operación a propósito: derivarla es exactamente el
 * error que este comentario existe para impedir.
 *
 * @readonly
 */
export const CLAVE_ENVOLTORIO_DNPRC = 'consulta_dnprcResult'

/**
 * Las dos ramas EXCLUYENTES del cuerpo, por la clave que las distingue. No es un
 * `switch` sobre un campo: **se distinguen por qué clave existe**.
 *
 * | Rama | Cuándo | Dónde está cada inmueble |
 * |---|---|---|
 * | `bico` | UN inmueble | `…Result.bico.bi` (objeto) |
 * | `lrcdnp` | VARIOS | `…Result.lrcdnp.rcdnp[i]` (array) |
 *
 * @readonly
 */
export const RAMA_DNPRC = Object.freeze({
  /** Un solo inmueble. Trae `idbi`, `dt`, `ldt` y `debi`. */
  UNO: 'bico',
  /** Varios inmuebles. Trae `rc`, `dt` y `debi`. **Sin `ldt` ni `cn`.** */
  VARIOS: 'lrcdnp',
})

/**
 * Los dos valores admitidos de `datos.clase`. Vocabulario del PROYECTO (español,
 * en mayúsculas), no el del servicio: el servicio dice `'UR'`/`'RU'` en un campo
 * que **solo existe en una de las dos ramas**.
 *
 * @readonly
 */
export const CLASE_PARCELA = Object.freeze({
  URBANA: 'URBANA',
  RUSTICA: 'RUSTICA',
})

/**
 * Subárbol de `dt.locs` → clase de la parcela. **Es la vía PRINCIPAL** de la
 * decisión B de la cabecera, porque es la única que existe en las dos ramas.
 *
 * ⚠️ `lors` (rústica) contiene `lorus` **y** `lourb`: que haya un bloque de
 * dirección con forma urbana dentro NO convierte la parcela en urbana. Lo que
 * decide es de cuál de los dos cuelga.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const CLASE_POR_SUBARBOL = Object.freeze({
  lous: CLASE_PARCELA.URBANA,
  lors: CLASE_PARCELA.RUSTICA,
})

/**
 * `idbi.cn` → clase. **Solo sirve en la rama `bico`**: en `lrcdnp` este campo no
 * existe (medido: cero apariciones en el fixture de 18 inmuebles). Se usa como
 * CONTRASTE de {@link CLASE_POR_SUBARBOL}, nunca como única fuente — si fuera la
 * única, la parcela de referencia del proyecto se quedaría sin clase.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const CLASE_POR_CN = Object.freeze({
  UR: CLASE_PARCELA.URBANA,
  RU: CLASE_PARCELA.RUSTICA,
})

/**
 * Diccionario de los `cod` de error que **se han visto de verdad** en este
 * endpoint. No es una tabla de clasificación —ver la defensa 2 de la cabecera—:
 * es un diccionario de procedencia, y sirve para una sola cosa, que **enriquece
 * el mensaje** cuando el código que llega es uno conocido.
 *
 * ⛔ **Nada de lo que hay aquí convierte una respuesta en «no hay datos».** El
 * `'17'` en particular es un fallo NUESTRO (parámetro mal escrito) y meterlo en
 * cualquier tabla de «no encontrado» haría que un bug reproducible en el 100 % de
 * las peticiones se le enseñara al usuario como «esa parcela no existe». Hay un
 * test que lo deja por escrito.
 *
 * @readonly
 * @type {Readonly<Record<string, Readonly<{cod: string, des: string, deQuienEs: string}>>>}
 */
export const COD_DNPRC_MEDIDOS = Object.freeze({
  '17': Object.freeze({
    cod: '17',
    des: 'LA REFERENCIA CATASTRAL ES OBLIGATORIA',
    deQuienEs:
      'Es NUESTRO: la petición no llevaba el parámetro `RefCat` (se probó con `RC`, que es ' +
      'el nombre que cualquiera escribiría, y el servicio contestó esto con la referencia ' +
      'catastral delante). No significa que la referencia no exista ni que el usuario no ' +
      'haya escrito nada. Medido: `test/fixtures/catastro/ovc-dnprc-cod17.json`.',
  }),
})

/**
 * Los SIETE campos del contrato E, en el orden en que se declaran. Existe como
 * constante para que el objeto `datos` se construya recorriéndola —y no campo a
 * campo en tres sitios distintos— y para que el test pueda afirmar que la forma
 * es TOTAL: los siete están siempre, aunque valgan `null`.
 *
 * @readonly
 * @type {ReadonlyArray<string>}
 */
export const CAMPOS_DESCRIPTIVOS = Object.freeze([
  'municipio',
  'provincia',
  'paraje',
  'poligono',
  'parcela',
  'domicilio',
  'clase',
])

/**
 * Forma de una referencia catastral de PARCELA, tal como la valida la defensa 1.
 * La longitud se IMPORTA de `_catastro-ovc.js`; el alfabeto es el mismo que usa
 * `services/catastro.js#normalizarRefcat`.
 */
const RE_REFCAT = new RegExp(`^[0-9A-Z]{${LONGITUD_REFCAT_PARCELA}}$`)

// ── Vocabulario del resultado ─────────────────────────────────────────────────

/**
 * Los DOS desenlaces posibles de una lectura. Vocabulario PROPIO de este módulo:
 * `services/catastro.js` los traduce a su `MOTIVO_CATASTRO`.
 *
 * **Son dos y no tres, y esa ausencia es la decisión.** El hermano tiene un
 * `SIN_REFERENCIA` porque midió el código con el que el servicio dice «aquí no
 * hay parcela». Aquí **nadie ha medido qué contesta `Consulta_DNPRC` a una
 * referencia inexistente** (hueco declarado en `PROCEDENCIA.md`), así que un
 * tercer tipo `SIN_DATOS` sería un estado que ningún caso puede producir: código
 * muerto que además tranquiliza. El día que alguien lo mida, añade el tipo, su
 * traducción en `services/catastro.js` y su fixture — los tres a la vez.
 *
 * @readonly
 */
export const TIPO_DNPRC = Object.freeze({
  /**
   * El servicio ha devuelto los datos alfanuméricos. **Que un campo valga `null`
   * NO cambia el tipo**: «el servicio no trae paraje» es un desenlace normal —en
   * una parcela urbana no hay paraje— y se imprime como “No consta”.
   */
  DESCRIPTIVOS: 'DESCRIPTIVOS',
  /**
   * No se entiende la respuesta: un `lerr` con cualquier `cod`, un cuerpo que no
   * tiene ninguna de las dos ramas medidas, las dos ramas a la vez, o algo que ni
   * siquiera es JSON. **No se traduce a «esa parcela no existe»**: nadie ha
   * medido cómo se dice eso en este endpoint, y decirlo sin haberlo medido sería
   * inventarse la respuesta del Catastro.
   */
  RESPUESTA_ILEGIBLE: 'RESPUESTA_ILEGIBLE',
})

/**
 * Los datos alfanuméricos de la parcela: **el `datos` del contrato E**, tal cual.
 * POJO plano (regla de oro 4), con los SIETE campos SIEMPRE presentes.
 *
 * ⚠️ **Todos son `string|null`, y `null` significa «el servicio no lo trae».** No
 * es «vale cero», no es «está vacío» y no es «no se ha podido leer»: es que el
 * Catastro no manda ese dato para esa parcela. El informe lo imprime como
 * “No consta”. **Nunca se inventa un valor y nunca se deja una cadena vacía
 * haciéndose pasar por dato**: una cadena vacía se lee como `null`.
 *
 * @typedef {Object} Descriptivos
 * @property {string|null} municipio  `dt.nm`. Medido: llega en MAYÚSCULAS y **sin
 *   tildes** (`"ALCAZAR DE SAN JUAN"`), y no es un problema de codificación —en el
 *   mismo fichero, y en UTF-8 correcto, hay `Polígono` y `LABRADÍO`—. Se imprime
 *   tal cual: «arreglarlo» sería inventarse la ortografía del dato.
 * @property {string|null} provincia  `dt.np`. Mismas mayúsculas y mismo criterio.
 * @property {string|null} paraje  `dt.locs.lors.lorus.npa`. **Solo en rústica.**
 *   Puede no ser un topónimo legible (`"C.BOLSA"`, abreviado y con punto): se
 *   imprime tal cual o no se imprime.
 * @property {string|null} poligono  `dt.locs.lors.lorus.cpp.cpo`. **Sin ceros a la
 *   izquierda** (`"109"`).
 * @property {string|null} parcela  `dt.locs.lors.lorus.cpp.cpa`. **Sin ceros a la
 *   izquierda**: `"5"`, mientras la referencia catastral `13005A109`**`00005`** sí
 *   los lleva. Componer «Polígono 109 Parcela 5» desde aquí y desde la referencia
 *   da dos cadenas distintas para el mismo dato; la buena es esta, que es la que
 *   el servicio publica como número.
 * @property {string|null} domicilio  El `ldt` del servicio, LITERAL. **Solo existe
 *   en la rama `bico`**; en la rama lista es `null` y no se compone (decisión C).
 * @property {'URBANA'|'RUSTICA'|null} clase  Deducida del subárbol (decisión B).
 *   `null` cuando no es concluyente.
 */

/**
 * Una discrepancia entre los inmuebles de una misma parcela: el mismo campo con
 * valores distintos según a qué inmueble se le pregunte.
 *
 * Es DATO, no juicio (regla de oro 9): dice qué valores hay y cuántos inmuebles
 * traen cada uno, y no dice cuál es el bueno — porque no se sabe.
 *
 * @typedef {Object} DiscrepanciaDnprc
 * @property {string} campo  Uno de {@link CAMPOS_DESCRIPTIVOS}.
 * @property {{valor: string|null, inmuebles: number}[]} valores  Los distintos,
 *   con su recuento. Siempre dos o más entradas.
 */

/**
 * Resultado de {@link leerDnprc}. **Forma ÚNICA para los dos desenlaces**: todos
 * los campos existen siempre, así que el llamante puede leer `inmuebles` o `cod`
 * sin comprobar antes el `tipo`. Misma disciplina que
 * `_catastro-ovc.js#ResultadoRccoor`.
 *
 * @typedef {Object} ResultadoDnprc
 * @property {'DESCRIPTIVOS'|'RESPUESTA_ILEGIBLE'} tipo  Ver {@link TIPO_DNPRC}.
 * @property {string} mensaje  Español listo para la UI: qué ha pasado y —en el
 *   caso ilegible— qué se sabe y qué no de la causa.
 * @property {Descriptivos|null} datos  Los siete campos. `null` salvo en
 *   `DESCRIPTIVOS`.
 * @property {'bico'|'lrcdnp'|null} rama  Cuál de las dos ramas trajo el dato.
 * @property {number} inmuebles  Inmuebles leídos, **CONTADOS**, nunca tomados de
 *   un contador del servicio (lección del WFS: su `numberReturned` declara 539
 *   cuando manda 10).
 * @property {number|null} declarados  El `control.cudnp` del servicio, tal cual, o
 *   `null`. Se expone para poder contrastarlo con `inmuebles`; el que manda es
 *   `inmuebles`.
 * @property {DiscrepanciaDnprc[]} discrepancias  Campos en los que los inmuebles
 *   no se ponen de acuerdo. Vacío es lo normal.
 * @property {string[]} avisos  Lo que hay que decir y no cabe en los campos: un
 *   contador que no cuadra, un `cn` que contradice al subárbol, inmuebles sin
 *   `dt`. **No cambia el `tipo`**: son datos entregados con una nota, no fallos.
 * @property {string|null} cod  `cod` del servicio (`lerr[i].cod`), **literal**,
 *   sin normalizar, para que quien reporte el fallo copie lo que dijo el Catastro
 *   y no una versión nuestra. `null` si no hubo error.
 * @property {string|null} des  `des` del servicio, literal y sin traducir. Está en
 *   mayúsculas porque así viene.
 */

// ── Construcción de la URL — DEFENSA 1: validar antes de emitir ──────────────

/**
 * URL de la consulta `Consulta_DNPRC` para una referencia catastral de parcela,
 * **validando la referencia ANTES de que la petición exista**.
 *
 * Es la defensa 1 de la cabecera, y aquí no es cortesía: la respuesta `cod:17`
 * («LA REFERENCIA CATASTRAL ES OBLIGATORIA») es lo que el servicio contesta
 * cuando no le llega referencia, y **esa respuesta habla como si el dato faltara
 * cuando lo que falla es la petición**. Exigiendo aquí una referencia con la forma
 * medida, esa respuesta no se puede provocar desde la aplicación.
 *
 * ⚠️ **NO normaliza.** Una referencia en minúsculas o con espacios se RECHAZA en
 * vez de arreglarse: normalizar aquí sería una segunda verdad sobre qué es una
 * referencia catastral, y ya hay una —`services/catastro.js#normalizarRefcat`—
 * que además tiene canal para avisar al usuario. Este módulo recibe lo que aquella
 * ya ha limpiado.
 *
 * ⚠️ **`Provincia` y `Municipio` van SIEMPRE VACÍOS y no se pueden rellenar.** Es
 * la única petición medida: con la referencia completa de 14 el servicio no los
 * necesita y los tres son `minOccurs="0"` en el WSDL. Ofrecerlos como parámetros
 * abriría un camino que nadie ha medido (hueco declarado en `PROCEDENCIA.md`) y
 * multiplicaría las claves de caché —y por tanto las peticiones— contra un
 * servicio que sanciona el uso abusivo con ~10 días (override O8). El orden de los
 * tres es el de la petición medida, byte a byte.
 *
 * @param {string} refcat  Referencia catastral de PARCELA, ya normalizada:
 *   {@link LONGITUD_REFCAT_PARCELA} caracteres de `[0-9A-Z]`.
 * @returns {string}  URL absoluta, lista para el transporte.
 * @throws {TypeError}   Si `refcat` no es un string.
 * @throws {RangeError}  Si no tiene la forma de una referencia de parcela.
 */
export function urlDnprc(refcat) {
  if (typeof refcat !== 'string') {
    throw new TypeError(
      `urlDnprc: 'refcat' debe ser un string con la referencia catastral de la parcela; ` +
        `recibido ${JSON.stringify(refcat)}.`,
    )
  }
  if (!RE_REFCAT.test(refcat)) {
    throw new RangeError(
      `urlDnprc: ${JSON.stringify(refcat)} no tiene forma de referencia catastral de parcela ` +
        `(${LONGITUD_REFCAT_PARCELA} caracteres, solo cifras y letras mayúsculas). No se emite ` +
        `la petición: sin referencia utilizable el Catastro contesta HTTP 200 con el código ` +
        `"17" («LA REFERENCIA CATASTRAL ES OBLIGATORIA»), que suena a dato que falta y es un ` +
        `fallo de la petición. Normaliza antes con services/catastro.js#normalizarRefcat.`,
    )
  }

  const consulta = [
    `${PARAM_DNPRC.provincia}=`,
    `${PARAM_DNPRC.municipio}=`,
    `${PARAM_DNPRC.refcat}=${encodeURIComponent(refcat)}`,
  ].join('&')
  return `${CATASTRO_OVC_DNPRC_JSON}?${consulta}`
}

// ── Lectura de la respuesta — DEFENSAS 2 y 3 ─────────────────────────────────

/** ¿Objeto plano (ni null, ni array)? */
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * El objeto que cuelga de una clave, o `null`. Se escribe una vez porque este
 * módulo camina árboles de cinco niveles y un `?.` encadenado no distingue «no
 * está» de «está y no es un objeto» — y esa diferencia es la que avisa de un
 * cambio de forma del servicio.
 *
 * @param {*} padre
 * @param {string} clave
 * @returns {Object|null}
 */
function rama(padre, clave) {
  if (padre === null) return null
  const hijo = padre[clave]
  return esObjeto(hijo) ? hijo : null
}

/**
 * Cadena no vacía, recortada; `null` en cualquier otro caso.
 *
 * **La cadena vacía se convierte en `null` a propósito**: `''` en un informe se
 * imprimiría como un hueco mudo, y un hueco mudo es indistinguible de un fallo de
 * maquetación. `null` se imprime “No consta”, que es una afirmación.
 *
 * (El hermano tiene una función igual y privada. No se comparte: exportar
 * ayudantes de tres líneas para no repetirlos acopla dos módulos que hoy pueden
 * evolucionar por separado, y `scripts/sonda-catastro.mjs` ya hace lo mismo con su
 * propio `objeto`.)
 *
 * @param {*} crudo
 * @returns {string|null}
 */
function textoDnp(crudo) {
  if (typeof crudo !== 'string') return null
  const texto = crudo.trim()
  return texto === '' ? null : texto
}

/** Base común del resultado: todos los campos existen siempre. */
function resultadoBase(tipo, mensaje) {
  return {
    tipo,
    mensaje,
    datos: null,
    rama: null,
    inmuebles: 0,
    declarados: null,
    discrepancias: [],
    avisos: [],
    cod: null,
    des: null,
  }
}

/**
 * Construye el resultado ilegible. Toda respuesta que no se entienda pasa por
 * aquí, y por eso la coletilla —«no se traduce a que la parcela no exista, porque
 * nadie ha medido cómo se dice eso»— se escribe UNA vez: es la frase que impide el
 * error silencioso y no puede depender de que cada rama se acuerde.
 *
 * @param {string} porque  Qué se ha encontrado, con los datos literales.
 * @param {{cod?: string|null, des?: string|null}} [datos]
 * @returns {ResultadoDnprc}
 */
function ilegible(porque, { cod = null, des = null } = {}) {
  const r = resultadoBase(
    TIPO_DNPRC.RESPUESTA_ILEGIBLE,
    `No se entiende la respuesta del Catastro (datos alfanuméricos de la parcela): ${porque} ` +
      `Esto NO se traduce a «esa parcela no existe»: nadie ha medido qué contesta esta ` +
      `operación a una referencia inexistente (hueco declarado en ` +
      `test/fixtures/catastro/PROCEDENCIA.md), así que decirlo sería inventarse la respuesta ` +
      `del servicio. Apunta a un cambio del servicio o a un fallo de esta aplicación.`,
  )
  r.cod = cod
  r.des = des
  return r
}

/**
 * La clase de la parcela: subárbol de `locs` como vía principal, `cn` como
 * contraste. Decisión B de la cabecera.
 *
 * @param {Object|null} locs  El `dt.locs` del inmueble.
 * @param {*} cn  El `idbi.cn`, si la rama lo trae (solo `bico`).
 * @returns {{clase: string|null, avisos: string[]}}
 */
function claseDeInmueble(locs, cn) {
  const avisos = []
  const presentes = Object.keys(CLASE_POR_SUBARBOL).filter((sub) => rama(locs, sub) !== null)

  let porSubarbol = null
  if (presentes.length === 1) {
    porSubarbol = CLASE_POR_SUBARBOL[presentes[0]]
  } else if (presentes.length > 1) {
    // Medido: son EXCLUYENTES (`lors` incluso contiene su propio `lourb`, así que
    // no hace falta `lous` para tener dirección). Si algún día llegan los dos, no
    // se elige: se dice.
    avisos.push(
      `El inmueble trae a la vez los subárboles ${presentes.join(' y ')} de \`dt.locs\`, que en ` +
        `lo medido son excluyentes. La clase de la parcela queda sin determinar.`,
    )
  }

  const porCn = typeof cn === 'string' ? (CLASE_POR_CN[cn.trim().toUpperCase()] ?? null) : null
  if (typeof cn === 'string' && cn.trim() !== '' && porCn === null) {
    avisos.push(
      `El campo \`idbi.cn\` vale ${JSON.stringify(cn)}, que no es ninguno de los valores ` +
        `medidos (${Object.keys(CLASE_POR_CN).join(', ')}). No se usa.`,
    )
  }

  if (porSubarbol !== null && porCn !== null && porSubarbol !== porCn) {
    avisos.push(
      `El subárbol de \`dt.locs\` dice que la parcela es ${porSubarbol} y el campo \`idbi.cn\` ` +
        `(${JSON.stringify(cn)}) dice que es ${porCn}. No se elige entre los dos: la clase ` +
        `queda sin determinar.`,
    )
    return { clase: null, avisos }
  }
  // `cn` solo decide cuando el subárbol no ha podido: es la rama `bico`, la única
  // en la que existe. En `lrcdnp` este `??` nunca llega a tener segundo operando.
  return { clase: porSubarbol ?? porCn, avisos }
}

/**
 * Lee UN inmueble —un `bico.bi` o un `lrcdnp.rcdnp[i]`— y saca sus siete campos.
 *
 * Las dos ramas se leen con esta misma función a propósito: los campos que solo
 * existen en una (`ldt`, `idbi.cn`) salen `null` en la otra sin ningún `if`, que
 * es exactamente lo que significan.
 *
 * @param {*} crudo
 * @returns {{descriptivos: Descriptivos, avisos: string[]}|{fallo: string}}
 */
function leerInmueble(crudo) {
  if (!esObjeto(crudo)) {
    return { fallo: `no es un objeto (es ${JSON.stringify(crudo)})` }
  }
  const avisos = []
  const dt = rama(crudo, 'dt')
  if (dt === null) {
    // No es ilegible: es un inmueble sin territorio declarado. Sale con los campos
    // a `null` —o sea, “No consta”— y con la nota puesta, porque un dato que se
    // cae sin decir nada es justo lo que la regla de oro 1 prohíbe.
    avisos.push(
      'Un inmueble de la parcela ha llegado sin el bloque `dt` (territorio): de él no sale ' +
        'ni municipio ni provincia.',
    )
  }
  const locs = rama(dt, 'locs')
  const lorus = rama(rama(locs, 'lors'), 'lorus')
  const cpp = rama(lorus, 'cpp')
  const clase = claseDeInmueble(locs, rama(crudo, 'idbi')?.cn)

  return {
    avisos: [...avisos, ...clase.avisos],
    descriptivos: {
      municipio: textoDnp(dt?.nm),
      provincia: textoDnp(dt?.np),
      paraje: textoDnp(lorus?.npa),
      poligono: textoDnp(cpp?.cpo),
      parcela: textoDnp(cpp?.cpa),
      // `ldt` solo existe en `bico`. En `lrcdnp` no se compone desde `dir`
      // (decisión C de la cabecera): sería redactar el dato, no leerlo.
      domicilio: textoDnp(crudo.ldt),
      clase: clase.clase,
    },
  }
}

/**
 * Funde los descriptivos de los N inmuebles en UNO. Decisión A de la cabecera.
 *
 * La regla, por campo: **si todos los inmuebles dicen lo mismo, eso; si no, `null`
 * y la discrepancia declarada.** Con un solo inmueble es la identidad, así que la
 * rama `bico` atraviesa exactamente el mismo código que la rama lista y no hay dos
 * caminos que puedan divergir.
 *
 * Nótese que quedarse con el primero cuando no coinciden sería «elegir en
 * silencio» entre dos datos del Catastro, que es lo que esta función existe para
 * no hacer.
 *
 * @param {Descriptivos[]} porInmueble  Al menos uno.
 * @returns {{datos: Descriptivos, discrepancias: DiscrepanciaDnprc[]}}
 */
function fundir(porInmueble) {
  const datos = {}
  const discrepancias = []
  for (const campo of CAMPOS_DESCRIPTIVOS) {
    const cuenta = new Map()
    for (const d of porInmueble) cuenta.set(d[campo], (cuenta.get(d[campo]) ?? 0) + 1)
    if (cuenta.size === 1) {
      datos[campo] = porInmueble[0][campo]
      continue
    }
    datos[campo] = null
    discrepancias.push({
      campo,
      valores: [...cuenta].map(([valor, inmuebles]) => ({ valor, inmuebles })),
    })
  }
  return { datos, discrepancias }
}

/**
 * El mensaje del camino de éxito. Dice lo que hay y lo que no hay, y nombra la
 * rama y el número de inmuebles: es la información que permite entender por qué
 * faltan campos sin tener que abrir el JSON.
 *
 * @param {Descriptivos} datos
 * @param {string} laRama
 * @param {number} inmuebles
 * @returns {string}
 */
function mensajeDescriptivos(datos, laRama, inmuebles) {
  const presentes = CAMPOS_DESCRIPTIVOS.filter((c) => datos[c] !== null)
  const ausentes = CAMPOS_DESCRIPTIVOS.filter((c) => datos[c] === null)
  const lista = presentes.map((c) => `${c} «${datos[c]}»`).join(', ')
  return (
    `El Catastro ha devuelto los datos alfanuméricos de la parcela por la rama \`${laRama}\` ` +
    `(${inmuebles} ${inmuebles === 1 ? 'inmueble' : 'inmuebles'}). ` +
    (presentes.length === 0 ? 'No trae ni uno de los siete campos. ' : `Trae: ${lista}. `) +
    (ausentes.length === 0
      ? 'No falta ninguno.'
      : `No constan: ${ausentes.join(', ')} — el servicio no los manda para esta parcela, que ` +
        `es un desenlace normal y no un fallo.`)
  )
}

/**
 * Localiza la rama del cuerpo y devuelve la LISTA de inmuebles que trae, sea una
 * o sean dieciocho.
 *
 * Las dos ramas son excluyentes en lo medido, así que traerlas a la vez —o no
 * traer ninguna— es un cambio de forma del servicio y sale como ilegible.
 *
 * @param {Object} res  El contenido del envoltorio.
 * @returns {{rama: string, lista: *[]}|{fallo: string}}
 */
function localizarRama(res) {
  const bico = res[RAMA_DNPRC.UNO]
  const lista = res[RAMA_DNPRC.VARIOS]
  const hayBico = bico !== undefined
  const hayLista = lista !== undefined

  if (hayBico && hayLista) {
    return {
      fallo:
        `el cuerpo trae a la vez \`${RAMA_DNPRC.UNO}\` (un inmueble) y \`${RAMA_DNPRC.VARIOS}\` ` +
        `(varios), y esas dos ramas son excluyentes en las respuestas medidas.`,
    }
  }
  if (!hayBico && !hayLista) {
    return {
      fallo:
        `el envoltorio \`${CLAVE_ENVOLTORIO_DNPRC}\` no trae ni \`${RAMA_DNPRC.UNO}\` ni ` +
        `\`${RAMA_DNPRC.VARIOS}\` ni \`lerr\`; sus claves son ${JSON.stringify(Object.keys(res))}.`,
    }
  }

  if (hayBico) {
    const bi = rama(esObjeto(bico) ? bico : null, 'bi')
    if (bi === null) {
      return {
        fallo:
          `\`${RAMA_DNPRC.UNO}\` no trae dentro el objeto \`bi\` con el inmueble ` +
          `(es ${JSON.stringify(bico)}).`,
      }
    }
    return { rama: RAMA_DNPRC.UNO, lista: [bi] }
  }

  const rcdnp = esObjeto(lista) ? lista.rcdnp : undefined
  if (!Array.isArray(rcdnp)) {
    return {
      fallo:
        `\`${RAMA_DNPRC.VARIOS}.rcdnp\` debería ser un array de inmuebles y es ` +
        `${JSON.stringify(rcdnp)}.`,
    }
  }
  if (rcdnp.length === 0) {
    // HUECO DECLARADO: no se ha medido ninguna respuesta con la lista vacía.
    // Podría ser la forma de decir «esa referencia no existe» o podría ser otra
    // cosa. Hasta que alguien lo capture, esto es «no lo sé», que es el lado
    // seguro.
    return {
      fallo:
        `\`${RAMA_DNPRC.VARIOS}.rcdnp\` es un array VACÍO. Ese caso no está medido contra el ` +
        `servicio real.`,
    }
  }
  return { rama: RAMA_DNPRC.VARIOS, lista: rcdnp }
}

/** Clasifica la rama de error del servicio (defensas 2 y 3). */
function clasificarErrores(errores) {
  const leidos = []
  for (const [i, e] of errores.entries()) {
    if (!esObjeto(e)) {
      return ilegible(`\`lerr[${i}]\` no es un objeto (es ${JSON.stringify(e)}).`)
    }
    const cod = typeof e.cod === 'string' ? e.cod.trim() : e.cod
    const des = textoDnp(e.des)
    if (cod === undefined || cod === null || cod === '') {
      return ilegible(`\`lerr[${i}]\` no trae \`cod\` (des: ${JSON.stringify(e.des)}).`, { des })
    }
    leidos.push({ cod, des })
  }

  const primero = leidos[0]
  const conocido =
    typeof primero.cod === 'string' &&
    Object.prototype.hasOwnProperty.call(COD_DNPRC_MEDIDOS, primero.cod)
      ? COD_DNPRC_MEDIDOS[primero.cod]
      : null

  return ilegible(
    `el servicio ha contestado con el código ${JSON.stringify(primero.cod)} ` +
      `(«${primero.des ?? 'sin descripción'}»)` +
      (leidos.length > 1 ? ` y ${leidos.length - 1} más` : '') +
      `. ` +
      (conocido === null
        ? `Ese código no está entre los medidos (${Object.keys(COD_DNPRC_MEDIDOS).join(', ')}), ` +
          `así que no se sabe qué significa. `
        : `De ese código sí se sabe algo, y conviene leerlo antes de culpar al Catastro: ` +
          `${conocido.deQuienEs} `),
    { cod: primero.cod, des: primero.des },
  )
}

/**
 * Lee el cuerpo de una respuesta de `Consulta_DNPRC` y lo CLASIFICA.
 *
 * Este módulo no toca la red: entra el texto que haya devuelto el transporte y
 * sale una estructura. **Nunca lanza por culpa del servicio** —una respuesta rara
 * es un {@link ResultadoDnprc} de tipo `RESPUESTA_ILEGIBLE`—; lanza solo si el
 * llamante rompe el contrato pasando algo que no es texto.
 *
 * Recuérdese que **el error de este servicio llega con HTTP 200** igual que el
 * acierto: el transporte no puede clasificar nada mirando el código de estado, y
 * por eso la clasificación entera vive aquí, en el cuerpo.
 *
 * @param {string} texto  Cuerpo de la respuesta, tal cual (`await res.text()`).
 * @returns {ResultadoDnprc}
 * @throws {TypeError}  Si `texto` no es un string (contrato del programador).
 */
export function leerDnprc(texto) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `leerDnprc: 'texto' debe ser un string con el cuerpo de la respuesta; recibido ` +
        `${JSON.stringify(texto)}. Este módulo no pide nada por su cuenta: el transporte ` +
        `(services/_red.js) le pasa el texto ya descargado.`,
    )
  }

  let cuerpo
  try {
    cuerpo = JSON.parse(texto)
  } catch (err) {
    return ilegible(
      `el cuerpo no es JSON válido (${err.message}). Primeros caracteres: ` +
        `${JSON.stringify(texto.slice(0, 120))}.`,
    )
  }

  // EL ENVOLTORIO, en minúsculas. Todo cuelga de aquí, en las dos ramas y en el
  // error. Derivarlo del nombre de la operación es la trampa 2 de la cabecera.
  const res = esObjeto(cuerpo) ? cuerpo[CLAVE_ENVOLTORIO_DNPRC] : undefined
  if (!esObjeto(res)) {
    const primerNivel = esObjeto(cuerpo) ? Object.keys(cuerpo) : cuerpo
    return ilegible(
      `el cuerpo no trae el envoltorio \`${CLAVE_ENVOLTORIO_DNPRC}\` con un objeto dentro ` +
        `(claves de primer nivel: ${JSON.stringify(primerNivel)}). Ojo: la clave va TODA EN ` +
        `MINÚSCULAS, al revés que la del servicio hermano.`,
    )
  }

  const control = esObjeto(res.control) ? res.control : null
  const cuerr = control === null ? undefined : control.cuerr
  const cudnp = control === null ? undefined : control.cudnp
  const declarados = typeof cudnp === 'number' && Number.isFinite(cudnp) ? cudnp : null

  // Rama de error. `lerr` presente y no-array es incomprensible; presente y vacío
  // no afirma nada y no se toma por una lista de errores.
  if (res.lerr !== undefined && !Array.isArray(res.lerr)) {
    return ilegible(`\`lerr\` debería ser un array de errores y es ${JSON.stringify(res.lerr)}.`)
  }
  const errores = Array.isArray(res.lerr) ? res.lerr : []
  const declaraErrores = typeof cuerr === 'number' && cuerr > 0

  if (declaraErrores && errores.length === 0) {
    return ilegible(
      `\`control.cuerr\` vale ${cuerr} (el servicio dice que hay errores) pero no viene ningún ` +
        `\`lerr\` que los enumere.`,
    )
  }
  if (errores.length > 0) return clasificarErrores(errores)

  // Rama de datos.
  const localizada = localizarRama(res)
  if (localizada.fallo !== undefined) return ilegible(localizada.fallo)

  const avisos = []
  const porInmueble = []
  for (const [i, crudo] of localizada.lista.entries()) {
    const leido = leerInmueble(crudo)
    if (leido.fallo !== undefined) {
      return ilegible(`el inmueble ${i} de la rama \`${localizada.rama}\` ${leido.fallo}.`)
    }
    porInmueble.push(leido.descriptivos)
    avisos.push(...leido.avisos)
  }

  const { datos, discrepancias } = fundir(porInmueble)
  const inmuebles = porInmueble.length

  // Los contadores se CONTRASTAN, nunca se usan. Medido: aquí `cudnp` cuadró en
  // las dos capturas — pero el WFS del mismo organismo declara 539 cuando manda
  // 10, así que un contador que cuadra hoy es un contador que cuadra hoy.
  if (declarados !== null && declarados !== inmuebles) {
    avisos.push(
      `El servicio declara ${declarados} inmueble(s) en \`control.cudnp\` y trae ${inmuebles}. ` +
        `Mandan los contados. (El WFS del mismo organismo declara 539 cuando manda 10.)`,
    )
  }
  for (const d of discrepancias) {
    avisos.push(
      `Los ${inmuebles} inmuebles de esta parcela no dicen lo mismo en «${d.campo}»: ` +
        `${d.valores.map((v) => `${JSON.stringify(v.valor)} (${v.inmuebles})`).join(', ')}. ` +
        `No se elige uno: el campo queda sin determinar.`,
    )
  }

  const r = resultadoBase(
    TIPO_DNPRC.DESCRIPTIVOS,
    mensajeDescriptivos(datos, localizada.rama, inmuebles),
  )
  r.datos = datos
  r.rama = localizada.rama
  r.inmuebles = inmuebles
  r.declarados = declarados
  r.discrepancias = discrepancias
  r.avisos = avisos
  return r
}
