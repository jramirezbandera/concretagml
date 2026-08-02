// comprobacion/gml.js — F08 · EL PASO DE COMPROBACIÓN. Qué es este fichero y qué
// le pasa, antes de contrastarlo con nada.
//
// Es el orquestador de una capa nueva y su trabajo es **componer, no calcular**,
// igual que `diagnostico/parcela.js` en F07. Cada cosa la dice el módulo que ya la
// sabe:
//
//   qué es el fichero   → `gml/parse.js#parsearGml`        (dialecto, parcelas, SRS)
//   con qué se leyó     → `gml/decodificar.js`             (llega en `deteccionesPrevias`)
//   superficie medida   → `geo/area.js#superficie`         (shoelace sobre UTM, regla 5)
//   fuera de huso       → `validation/reglas-huso.js`      (modo VERIFICAR, un solo candidato)
//   geometría (F02)     → `validation/parcela.js`          (kinks, duplicados, mínimo)
//   orientación         → `gml/parse.js`, que la devuelve SIN tocar (override O1)
//
// Aquí solo se cruzan esas piezas, se redacta en castellano lo que dicen y se
// decide una única cosa que ninguna de ellas puede decidir: si la aplicación puede
// seguir adelante con este fichero.
//
// ── LAS CUATRO COMPROBACIONES QUE F08 AÑADE ─────────────────────────────────
// `parsearGml` lee el fichero y cuenta lo que ve, pero se niega A PROPÓSITO a
// cotejar nada (su cabecera lo dice con todas las letras, y tiene razón: el
// vocabulario de `TIPO_GML` está cerrado y el cotejo depende de datos que el lector
// no tiene). Lo que F08 añade encima son cuatro cotejos:
//
//   C1 · **La superficie que el fichero declara SOBRE SÍ MISMO.** `cp:areaValue`
//        contra la shoelace de sus propias coordenadas.
//        ⚠️ NO es «la superficie catastral». En la tabla a tres bandas de F07,
//        `superficie.catastral` es lo que declara el **PARCELARIO**; ésta es lo que
//        declara **este fichero** sobre sus propios números. Se llaman
//        `superficieDeclarada` y `superficieMedida` justamente para que no puedan
//        confundirse: llamar «catastral» al número de un tercero sería atribuirle
//        al Catastro algo que no ha dicho.
//        Y **hoy no lo hace nadie**: `AREA_DECLARADA_DISCREPANTE` existe en el
//        vocabulario de `gml/_comun.js` pero `gml/parse.js` solo la emite cuando el
//        valor **no es un número** (línea 917). La comparación real es de aquí.
//   C2 · **Coordenadas fuera del huso que el fichero DECLARA.** Con
//        `reglasHuso(recintos, {srs})` y el `srs` que sale del `srsName` del propio
//        fichero. Esa `srs` es lo que convierte a `geo/huso.js#detectarHuso` en modo
//        VERIFICAR —un solo candidato, 168/168 aciertos en el barrido de F00—; en
//        autodetección «equivale a asumir huso 30», y lo dice su propio fuente. La
//        diferencia entre las dos no es un detalle de implementación: es la
//        diferencia entre una nota cierta y un falso positivo con formato de hecho.
//   C3 · **La geometría entera, con F02.** `validarParcela(recintos, {srs})`:
//        autointersecciones (`kinks`), vértices duplicados, mínimo de puntos.
//        Esto CIERRA un punto que F04 dejó abierto por escrito:
//        «un colapso puede además crear una autointersección que solo `kinks`
//        vería. Ese chequeo es de **F08**» (`spec/feature-04-gml-parcela.md` §5).
//        Y es la razón de que esta capa viva por ENCIMA de `validation/` y no
//        dentro de `gml/`: el lector de ficheros no puede depender del validador.
//   C4 · **La orientación del anillo exterior: INFORMATIVA, jamás un error.**
//        `parsearGml` devuelve `orientacion` tal como venía y aquí solo se rotula.
//        Override O1, matizado el 2026-07-27: el exterior horario es **convención,
//        no requisito**, y la plantilla oficial del Catastro va ANTIHORARIA. Un GML
//        ajeno antihorario **no está mal**, y decirle lo contrario a quien lo trae
//        sería juzgar el trabajo de otro técnico con una regla que no existe.
//
// ── `puedeContinuar` ES CAPACIDAD DE LA APLICACIÓN, NO MÉRITO DE LA PARCELA ──
// La frontera es delicada y se cruza en un solo sentido: `false` significa «yo no
// puedo seguir», nunca «tu parcela está mal». Precedente literal: el gate
// `puedeGenerar` de F02. Vale `false` **solo** cuando no hay geometría con la que
// trabajar — XML irrecuperable, GML de edificio, colección sin parcelas, parcela
// sin contorno legible, o sistema de referencia con el que esta aplicación no sabe
// trabajar. Y entonces `motivoNoContinua` **nunca** es `null` ni cadena vacía.
//
// Lo que **NO** apaga el recorrido, y conviene tenerlo escrito porque la tentación
// es evidente:
//   · Un **CP 3.0**. Sale con `soportado:false` y su `DIALECTO_RECHAZADO` de nivel
//     ERROR, y aun así `parcelas` viene rellena: el valor de esta aplicación con un
//     fichero de 2015 delante es «tu GML es de la versión que la Sede ya no admite,
//     aquí está tu parcela». Apagarlo mataría ese recorrido entero.
//   · Una parcela con **autointersecciones**, con vértices duplicados o **fuera del
//     huso que declara**. El diagnóstico es precisamente lo que hay que enseñarle.
//     (`validarParcela` devuelve `puedeGenerar:false` para varias de esas, y ese
//     booleano **NO se reexpone aquí**: es el gate de F04 para ESCRIBIR un GML, y
//     dejarlo asomar en esta salida sería un segundo semáforo que cualquiera
//     confundiría con `puedeContinuar`.)
//
// ── `bloqueos` NO ES LO CONTRARIO DE `puedeContinuar` ───────────────────────
// MEDIDO, y es la trampa de nombre de este contrato: `bloqueos` es simplemente la
// partición por severidad —las detecciones de nivel ERROR—, y el CP 3.0 es el caso
// real donde hay un ERROR y el recorrido **sigue**. Un ERROR dice «esto está mal en
// el fichero»; `puedeContinuar` dice «la aplicación puede o no puede trabajar con
// él». Fundirlos convertiría el gate en un veredicto sobre la parcela, que es justo
// lo que prohíbe la regla de oro 9.
//
// ── ESTE MÓDULO NO DECIDE QUÉ PARCELA SE COMPRUEBA ──────────────────────────
// Un GML ajeno puede traer varias y **multiparcela está fuera de alcance** (SPEC
// §1): se elige UNA, nunca se unen, y las demás se quedan en el fichero. El índice
// lo manda el llamante (`indiceElegido`), igual que `parsearGml` devuelve TODAS las
// parcelas y no elige. Lo único que se hace aquí es decir cuál se ha cogido.
//
// Módulo PURO: sin DOM, sin Leaflet, sin store, sin red y sin reloj. Turf entra
// solo por debajo, dentro de `validation/reglas-topologia.js`, y esta capa no lo
// importa. Corre en el proyecto Vitest `node`.

import { superficie } from '../geo/area.js'
import { husoPorSrsOpcional } from '../geo/huso.js'
import { DIALECTO, TIPO_GML } from '../gml/_comun.js'
import { parsearGml } from '../gml/parse.js'
import { NIVEL } from '../validation/_comun.js'
import { validarParcela } from '../validation/parcela.js'
import { reglasHuso } from '../validation/reglas-huso.js'
import {
  SEVERIDAD,
  TIPO_COMPROBACION,
  crearDeteccionComprobacion,
  decimalesDe,
  etiquetaDialecto,
  exigirDetecciones,
  exigirIndice,
  exigirNombreFichero,
  exigirOpciones,
  exigirTamano,
  exigirTexto,
  numero,
} from './_comun.js'

/** @typedef {import('./_comun.js').DeteccionComprobacion} DeteccionComprobacion */
/** @typedef {import('../gml/_comun.js').DeteccionGml} DeteccionGml */
/** @typedef {import('../validation/_comun.js').Hallazgo} Hallazgo */
/** @typedef {import('../gml/parse.js').ParcelaGml} ParcelaGml */

/**
 * El único tipo que emiten LAS DOS capas de lectura, y el choque que F08 tuvo que
 * resolver. Ver {@link componerDetecciones}.
 */
const TIPO_SOLAPADO = TIPO_GML.ENCODING_DECLARADO

// ── Typedefs de la salida ────────────────────────────────────────────────────

/**
 * Una parcela del fichero, resumida para poder ELEGIRLA y para el rótulo.
 *
 * @typedef {Object} MiembroComprobado
 * @property {number} indice  Índice en la lista de parcelas LEÍDAS. Coincide con el
 *   `datos.miembro` de las detecciones de `gml/parse.js` salvo cuando algún
 *   contenedor del documento no traía dentro un `CadastralParcel` (parse lo salta
 *   con su ERROR y no lo mete en `parcelas`).
 * @property {string|null} refcat  `cp:nationalCadastralReference` TAL CUAL: `''` si
 *   el elemento está pero viene vacío —el 3.0 y la plantilla de alta lo dejan así a
 *   propósito— y `null` si no está. Son cosas distintas y no se confunden. **Ni una
 *   ni otra sirve para pedirle el parcelario al Catastro**: sin referencia no hay
 *   nada que pedir, y eso se dice, no se inventa.
 * @property {string|null} localId  `localId` del `inspireId`.
 * @property {string|null} namespaceInspire  `namespace` del `inspireId`
 *   (`'ES.SDGC.CP'` si viene del Catastro, `'ES.LOCAL.CP'` en un alta de particular).
 * @property {string} etiqueta  Rótulo presentable TAL CUAL para la lista de
 *   elección: número, identificación y superficie.
 * @property {number} nVertices  Vértices de TODOS los anillos (exterior + huecos),
 *   sobre el anillo ABIERTO. `0` si no hay geometría — y aquí `0` sí es la verdad:
 *   son cero vértices.
 * @property {number} nHuecos  Recintos de tipo HUECO.
 * @property {number|null} superficieDeclarada  `cp:areaValue`, **el número que el
 *   fichero dice de sí mismo**. `null` = no consta (que NO es 0).
 * @property {number|null} superficieMedida  Shoelace de sus propias coordenadas,
 *   float64 sin redondear. `null` = no hay geometría que medir (que NO es 0 m²).
 * @property {string|null} srs  Forma corta (`'EPSG:25830'`), o `null` si falta, no
 *   está soportado o el fichero se contradice a sí mismo.
 * @property {-1|1|null} orientacionExterior  Signo del área firmada del anillo
 *   exterior TAL COMO VENÍA: −1 horario, +1 antihorario. Informativo (C4).
 */

/**
 * El resultado del paso de Comprobación.
 *
 * @typedef {Object} Comprobacion
 * @property {{nombre: string, bytes: number|null, encodingDeclarado: string|null,
 *   encodingUsado: string|null}} fichero  Para el rótulo. `encodingDeclarado` es la
 *   etiqueta del prólogo TAL CUAL; `encodingUsado` es el decodificador que se empleó
 *   de verdad, y `null` cuando el llamante no lo ha dicho (ver {@link comprobarGml}).
 * @property {{id: string, soportado: boolean, etiqueta: string,
 *   queSignifica: string}} dialecto  Qué es este fichero, en español presentable.
 * @property {MiembroComprobado[]} miembros  Una por parcela leída. Vacía en un GML
 *   de edificio y en cualquier cosa que no traiga parcelas.
 * @property {number|null} elegido  Índice en `miembros` de la que se comprueba;
 *   `null` si no hay ninguna.
 * @property {{recintos: Array<{vertices: Array<[number,number]>, tipo: string}>,
 *   srs: string}|null} geometria  La del elegido, lista para `crearParcela`.
 *   `null` ⟺ `puedeContinuar === false`: sin SRS utilizable la geometría no se
 *   puede meter en el modelo aunque las coordenadas estén ahí.
 * @property {Hallazgo[]|null} hallazgos  Lo que dice `validarParcela` sobre el
 *   elegido (C3), errores primero y avisos después **en una sola lista**: la
 *   separación de F02 no se pierde, viaja en `h.nivel`. `null` = no había geometría
 *   que validar, que no es lo mismo que `[]` (se validó y no hay nada que decir).
 * @property {Array<DeteccionGml|DeteccionComprobacion>} notas  INFO y AVISO, en
 *   orden: primero las de los bytes, luego las del lector de XML, luego las de esta
 *   capa.
 * @property {Array<DeteccionGml|DeteccionComprobacion>} bloqueos  Las de severidad
 *   ERROR. **No es lo contrario de `puedeContinuar`**: ver la cabecera.
 * @property {boolean} puedeContinuar  Capacidad de la APLICACIÓN, no mérito de la
 *   parcela.
 * @property {string|null} motivoNoContinua  En español presentable. **Nunca `null`
 *   ni vacío cuando `puedeContinuar` es `false`**; siempre `null` cuando es `true`.
 */

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Comprueba un GML ya decodificado: dice qué es, qué trae y qué le pasa.
 *
 * NO LANZA por un fichero malo —eso sale por `notas` y `bloqueos`, regla de oro 1—.
 * El `throw` se reserva al contrato roto por el programador (SPEC §2.1).
 *
 * ```js
 * const { texto, encodingUsado, detecciones } = decodificarGml(bytes)
 * const c = comprobarGml({
 *   texto,
 *   nombreFichero: 'cp_parcela_9398516VK3799G.gml',
 *   bytes: bytes.byteLength,
 *   deteccionesPrevias: detecciones,
 *   encodingUsado,
 *   indiceElegido: 0,
 * })
 * ```
 *
 * @param {Object} entrada
 * @param {string} entrada.texto  El documento GML COMPLETO, **ya decodificado**.
 *   Los bytes son cosa de `gml/decodificar.js`, y esa frontera es a propósito.
 * @param {string} entrada.nombreFichero  Nombre con el que se citará el fichero en
 *   el cajón y en el informe. No vacío.
 * @param {number|null} [entrada.bytes=null]  TAMAÑO del fichero, solo para el
 *   rótulo. No es el búfer.
 * @param {Array<{tipo: string, mensaje: string, severidad: string}>}
 *   [entrada.deteccionesPrevias=[]]  Las que ya trae el llamante — hoy, las de
 *   `decodificarGml`. Se conservan íntegras y van las primeras.
 * @param {number} [entrada.indiceElegido=0]  Qué parcela se comprueba, cuando el
 *   fichero trae varias. Entero ≥ 0.
 * @param {string|null} [entrada.encodingUsado=null]  Con qué se decodificó de
 *   verdad (`'utf-8'`, `'windows-1252'`…).
 *
 *   ⛔ **Este parámetro NO estaba en el contrato B del plan y se ha añadido al
 *   medirlo.** El contrato pedía un `fichero.encodingUsado` en la salida y no daba
 *   ninguna entrada de la que sacarlo: el texto ya viene decodificado, así que ese
 *   dato es IRRECUPERABLE desde aquí. En el caso más común —bytes UTF-8 limpios—
 *   `decodificarGml` no emite ninguna detección que lo lleve dentro, de modo que
 *   deducirlo de `deteccionesPrevias` daría `null` justo cuando sí se sabe. Si no se
 *   pasa, se intenta recuperar de las detecciones previas que sí lo llevan
 *   (`BOM_PRESENTE`, `ENCODING_SUPUESTO`, `ENCODING_DESMENTIDO`) y, si tampoco,
 *   queda `null` = «no consta». Nunca se supone.
 * @returns {Comprobacion}
 * @throws {TypeError}  Contrato del programador: `entrada` que no es objeto, `texto`
 *   que no es string, `nombreFichero` vacío, `bytes` que no es un entero ≥ 0 ni
 *   `null`, `indiceElegido` que no es entero ≥ 0, `deteccionesPrevias` malformadas.
 * @throws {RangeError}  Si `indiceElegido` apunta a una parcela que no existe
 *   habiendo parcelas. Los índices salen de esta misma función: pedir uno que no
 *   está es un bug del llamante, no un dato del usuario.
 */
export function comprobarGml(entrada) {
  exigirOpciones(entrada, 'comprobarGml', 'un objeto de entrada {texto, nombreFichero, …}')

  const {
    texto,
    nombreFichero,
    bytes = null,
    deteccionesPrevias = [],
    indiceElegido = 0,
    encodingUsado = null,
  } = entrada

  exigirTexto(texto, 'comprobarGml')
  exigirNombreFichero(nombreFichero, 'comprobarGml')
  exigirTamano(bytes, 'comprobarGml')
  exigirDetecciones(deteccionesPrevias, 'comprobarGml')
  exigirIndice(indiceElegido, 'comprobarGml')
  if (encodingUsado !== null && typeof encodingUsado !== 'string') {
    throw new TypeError(
      `comprobarGml: 'encodingUsado' debe ser un string o null; recibido ${typeof encodingUsado}.`,
    )
  }

  const resultado = parsearGml(texto)
  const { parcelas } = resultado

  if (parcelas.length > 0 && indiceElegido >= parcelas.length) {
    throw new RangeError(
      `comprobarGml: 'indiceElegido' ${indiceElegido} no existe: el fichero trae ` +
        `${parcelas.length} parcela(s), así que el índice va de 0 a ${parcelas.length - 1}. ` +
        'Los índices los produce esta misma función en `miembros[].indice`.',
    )
  }

  const miembros = parcelas.map((p, i) => resumirMiembro(p, i, parcelas.length))
  const elegido = parcelas.length === 0 ? null : indiceElegido
  const parcela = elegido === null ? null : parcelas[elegido]

  // Las cuatro comprobaciones, sobre la elegida y solo si trae coordenadas. Se
  // hacen aunque el recorrido no vaya a poder continuar (un 4326 no se puede
  // situar, pero su superficie y su geometría sí se pueden mirar): el usuario tiene
  // derecho al diagnóstico de su fichero aunque la aplicación se pare después.
  const hayGeometria = parcela !== null && parcela.recintos.length > 0
  const hallazgos = hayGeometria ? validarGeometria(parcela) : null
  const propias = hayGeometria ? comprobar(parcela, miembros[elegido], hallazgos) : []

  const { notas, bloqueos } = componerDetecciones(deteccionesPrevias, resultado.detecciones, [
    ...eleccion(miembros, elegido),
    ...propias,
  ])

  const frontera = decidirFrontera(resultado, parcela, elegido)

  return {
    fichero: {
      nombre: nombreFichero,
      bytes,
      // El del prólogo, medido por el lector de XML sobre el MISMO texto que se
      // está comprobando. Coincide con el que leyó `decodificarGml` sobre los
      // bytes, y se toma de aquí para que no dependa de que el llamante lo pase.
      encodingDeclarado: resultado.resumen.encodingDeclarado,
      encodingUsado: encodingUsado ?? encodingDeLasDetecciones(deteccionesPrevias),
    },
    dialecto: {
      id: resultado.dialecto,
      soportado: resultado.soportado,
      ...etiquetaDialecto(resultado.dialecto),
    },
    miembros,
    elegido,
    geometria: frontera.puedeContinuar ? { recintos: parcela.recintos, srs: parcela.srs } : null,
    hallazgos,
    notas,
    bloqueos,
    puedeContinuar: frontera.puedeContinuar,
    motivoNoContinua: frontera.motivoNoContinua,
  }
}

// ── Los miembros ─────────────────────────────────────────────────────────────

/**
 * Resume una parcela leída para la lista de elección.
 *
 * @param {ParcelaGml} p
 * @param {number} indice
 * @param {number} total
 * @returns {MiembroComprobado}
 */
function resumirMiembro(p, indice, total) {
  const nVertices = p.recintos.reduce((n, r) => n + r.vertices.length, 0)
  const nHuecos = p.recintos.filter((r) => r.tipo === 'HUECO').length
  // `null` y no 0: «no hay geometría que medir» y «mide cero metros» son dos
  // afirmaciones distintas, y la segunda tranquiliza. Es la misma disciplina que
  // sostiene media F07.
  const superficieMedida = p.recintos.length === 0 ? null : superficie(p.recintos)

  return {
    indice,
    refcat: p.refcat,
    localId: p.localId,
    namespaceInspire: p.namespaceInspire,
    etiqueta: rotularMiembro(p, indice, total, superficieMedida),
    nVertices,
    nHuecos,
    superficieDeclarada: p.areaValue,
    superficieMedida,
    srs: p.srs,
    orientacionExterior: p.orientacion.length === 0 ? null : p.orientacion[0],
  }
}

/**
 * El rótulo de una parcela en la lista: número, identificación y superficie.
 *
 * La superficie que se enseña es la DECLARADA cuando la hay, y va rotulada como
 * tal; si no la hay se enseña la medida, rotulada como medida. Un número a secas
 * dejaría al lector sin saber cuál de las dos está viendo, que es exactamente la
 * confusión que C1 existe para deshacer.
 */
function rotularMiembro(p, indice, total, superficieMedida) {
  const identificacion =
    p.refcat !== null && p.refcat !== ''
      ? p.refcat
      : p.localId !== null && p.localId !== ''
        ? `identificador local ${p.localId}`
        : 'sin identificación'

  const cuanto =
    p.areaValue !== null
      ? `${numero(p.areaValue)} m² declarados`
      : superficieMedida !== null
        ? `${numero(superficieMedida)} m² medidos`
        : 'sin geometría'

  return `Parcela ${indice + 1} de ${total} · ${identificacion} · ${cuanto}`
}

// ── C3 · la geometría, con F02 entera ────────────────────────────────────────

/**
 * `validarParcela` sobre la elegida, con el `srs` del PROPIO fichero.
 *
 * Se devuelve una sola lista con los errores delante y los avisos detrás. La
 * separación que F02 defiende («categorías SEPARADAS: nunca "2 avisos" cuando uno
 * es bloqueante») no se pierde: cada hallazgo lleva su `nivel` y quien cuente,
 * cuenta por nivel. Lo que **no** se reexpone es `puedeGenerar`: ver la cabecera.
 *
 * @param {ParcelaGml} parcela
 * @returns {Hallazgo[]}
 */
function validarGeometria(parcela) {
  const { errores, avisos } = validarParcela(parcela.recintos, { srs: parcela.srs })
  return [...errores, ...avisos]
}

// ── Las cuatro comprobaciones ────────────────────────────────────────────────

/**
 * C1 + C2 + C3 + C4 sobre la parcela elegida, en ese orden.
 *
 * @param {ParcelaGml} parcela
 * @param {MiembroComprobado} miembro
 * @param {Hallazgo[]} hallazgos
 * @returns {DeteccionComprobacion[]}
 */
function comprobar(parcela, miembro, hallazgos) {
  return [
    comprobarSuperficie(miembro),
    comprobarHuso(parcela, miembro),
    comprobarGeometria(hallazgos),
    comprobarOrientacion(miembro),
  ]
}

/**
 * C1 · lo que el fichero DECLARA contra lo que sus coordenadas DAN.
 *
 * ── POR QUÉ AQUÍ NO HAY NINGUNA TOLERANCIA, Y NO HACÍA FALTA INVENTARLA ─────
 * La parcela real del WFS declara **1536** y sus coordenadas dan **1535,865…**:
 * 0,13 m² de diferencia. Marcar eso como discrepancia sería acusar al Catastro de
 * no cuadrar con su propio fichero por un redondeo; no marcarlo obligaría a elegir
 * una tolerancia, y elegir una tolerancia es exactamente el `config/umbrales.json`
 * que la regla de oro 9 prohíbe.
 *
 * La salida está en el propio dato y no cuesta ningún parámetro libre: el
 * `cp:areaValue` del Catastro es un **ENTERO** (override O6, medido: 1535,87 →
 * 1536), así que lo honrado es comparar **a la precisión con la que el fichero
 * declara**. Se cuentan los decimales del valor declarado y se redondean los dos
 * números a esa misma precisión. Cero decimales para 1536; dos para un fichero de
 * terceros que declare 1535,87. La precisión la pone el fichero, no nosotros.
 *
 * Medido sobre los cuatro ficheros con parcela: la plantilla oficial (236 vs
 * 236,0456), la descarga real del WFS (1536 vs 1535,865) y el CP 3.0 (61 vs 61,045)
 * **cuadran los tres**; el único que discrepa es el derivado sintético que se
 * fabricó para eso (1576 vs 1535,865).
 *
 * `relativo` es una **FRACCIÓN** (0,05 = 5 %) y su denominador es la superficie
 * **DECLARADA**, que es el término de referencia del par. Es la misma convención
 * que `diagnostico/bandas.js#cruce` (`absoluto / valores[b]`), y se dice porque el
 * mismo dato admite otra: `derivados/PROCEDENCIA.md` cita «+2,61 %» para este
 * fichero dividiendo por la MEDIDA, y aquí sale 2,55 % dividiendo por la declarada.
 * Ninguna de las dos está mal; lo que estaría mal es que el proyecto usara las dos.
 */
function comprobarSuperficie(miembro) {
  const { superficieDeclarada: declarada, superficieMedida: medida } = miembro

  if (declarada === null) {
    return crearDeteccionComprobacion(
      TIPO_COMPROBACION.SUPERFICIE_NO_DECLARADA,
      `El fichero no declara superficie («cp:areaValue»), así que no hay dos números que ` +
        `cotejar. Sus coordenadas dan ${numero(medida)} m², medidos por la fórmula del ` +
        'polígono sobre las mismas coordenadas que trae el fichero.',
      SEVERIDAD.INFO,
      { superficieDeclarada: null, superficieMedida: medida },
    )
  }

  const decimales = decimalesDe(declarada)
  const cuadra = Number(medida.toFixed(decimales)) === Number(declarada.toFixed(decimales))
  const diferencia = medida - declarada
  const relativo = declarada === 0 ? null : diferencia / declarada
  const datos = {
    superficieDeclarada: declarada,
    superficieMedida: medida,
    diferencia,
    relativo,
    decimalesDeclarados: decimales,
  }

  if (cuadra) {
    const conQuePrecision =
      decimales === 0
        ? 'el fichero la declara en metros cuadrados enteros'
        : `el fichero la declara con ${decimales} decimales`
    return crearDeteccionComprobacion(
      TIPO_COMPROBACION.SUPERFICIE_COTEJADA,
      `El fichero declara ${numero(declarada)} m² y sus propias coordenadas dan ` +
        `${numero(medida)} m²: cuadran a la precisión con la que se declara la superficie ` +
        `(${conQuePrecision}). Ojo con qué número es éste: es lo que el fichero dice de SÍ ` +
        'MISMO, no lo que declara el parcelario del Catastro.',
      SEVERIDAD.INFO,
      datos,
    )
  }

  return crearDeteccionComprobacion(
    TIPO_COMPROBACION.SUPERFICIE_DISCREPANTE,
    `El fichero declara ${numero(declarada)} m² y sus propias coordenadas dan ` +
      `${numero(medida)} m²: ${numero(Math.abs(diferencia))} m² de diferencia` +
      (relativo === null ? '' : ` (${numero(Math.abs(relativo) * 100)} %)`) +
      '. Los dos números salen del MISMO fichero, así que esto no es una discrepancia con ' +
      'el Catastro: es que el fichero no se cuadra consigo mismo. Qué significa la ' +
      'diferencia lo dice quien firma.',
    SEVERIDAD.AVISO,
    datos,
  )
}

/**
 * C2 · ¿las coordenadas caen donde dice el `srsName` del fichero?
 *
 * `reglasHuso` se llama aquí **además** de dentro de `validarParcela` (C3), y son
 * unas cuantas desproyecciones repetidas. Se paga a sabiendas: la alternativa sería
 * esconderle el `srs` a `validarParcela` para que su regla del huso no dispare y no
 * duplicase el hallazgo — o sea, apagar una regla de validación en silencio, que es
 * peor que recalcular. Las dos salidas dicen lo mismo a públicos distintos: el
 * hallazgo señala QUÉ vértices, la nota dice CON QUÉ huso se ha juzgado y sale
 * también cuando no hay nada que objetar.
 *
 * Y sale también —esto es nuevo— cuando **no se puede juzgar**: `reglasHuso`
 * devuelve `[]` tanto si todo cae dentro como si no hay `srs` con el que comparar,
 * y su propio fuente dice que en ese segundo caso «no se emite ningún hallazgo». Un
 * silencio que significa dos cosas opuestas es un error silencioso; desde aquí, que
 * sí sabe cuál de las dos es, se dice.
 */
function comprobarHuso(parcela, miembro) {
  const { srs, nVertices } = miembro

  if (srs === null) {
    return crearDeteccionComprobacion(
      TIPO_COMPROBACION.HUSO_NO_COTEJABLE,
      'No se ha podido comprobar si las coordenadas caen donde deberían: el fichero no ' +
        'declara un sistema de referencia con el que esta aplicación pueda trabajar, y sin ' +
        'huso no hay contra qué compararlas. Los números están ahí, pero no se sabe qué ' +
        'sitio del mundo describen.',
      SEVERIDAD.AVISO,
      { srs: null, nVertices },
    )
  }

  const huso = husoPorSrsOpcional(srs)
  const hallazgos = reglasHuso(parcela.recintos, { srs })
  const fuera = hallazgos.reduce((n, h) => n + h.verticesAfectados.length, 0)

  if (fuera === 0) {
    return crearDeteccionComprobacion(
      TIPO_COMPROBACION.HUSO_VERIFICADO,
      `Los ${nVertices} vértices caen dentro del huso ${huso} (${srs}) que declara el propio ` +
        'fichero. Se ha comprobado contra ESE huso y no contra uno deducido: deducirlo de las ' +
        'coordenadas equivale a suponer el huso 30, y una nota construida sobre una suposición ' +
        'no es una medición.',
      SEVERIDAD.INFO,
      { srs, huso, nVertices, nFuera: 0 },
    )
  }

  return crearDeteccionComprobacion(
    TIPO_COMPROBACION.HUSO_FUERA_DE_RANGO,
    `${fuera} de los ${nVertices} vértices caen FUERA del huso ${huso} (${srs}) que declara el ` +
      'fichero: desproyectados con ese huso, salen de España. O las coordenadas son de otro ' +
      'huso, o el «srsName» está mal escrito. Es una nota, no un fallo: el recorrido sigue y ' +
      'la parcela se puede ver, pero conviene resolverlo antes de presentar nada.',
    SEVERIDAD.AVISO,
    { srs, huso, nVertices, nFuera: fuera },
  )
}

/**
 * C3 · el recuento de lo que ha dicho la validación de F02.
 *
 * La nota cuenta; el detalle —qué vértice, qué anillo, qué corrección— viaja en
 * `hallazgos`, que es donde la vista de avisos sabe leerlo desde F02.
 */
function comprobarGeometria(hallazgos) {
  const nErrores = hallazgos.filter((h) => h.nivel === NIVEL.ERROR).length
  const nAvisos = hallazgos.length - nErrores
  const datos = { nErrores, nAvisos }

  if (hallazgos.length === 0) {
    return crearDeteccionComprobacion(
      TIPO_COMPROBACION.GEOMETRIA_REVISADA,
      'La geometría se ha pasado por la validación completa —autointersecciones, vértices ' +
        'duplicados, número mínimo de puntos y rango del huso— y no ha salido nada que ' +
        'contar.',
      SEVERIDAD.INFO,
      datos,
    )
  }

  // Se nombra solo lo que hay: «0 problemas y 2 avisos» obliga a leer un cero para
  // enterarse de que no hay ninguno, y de paso deja una frase que no concuerda.
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
  const partes = []
  if (nErrores > 0) partes.push(plural(nErrores, 'problema', 'problemas'))
  if (nAvisos > 0) partes.push(plural(nAvisos, 'aviso', 'avisos'))

  return crearDeteccionComprobacion(
    TIPO_COMPROBACION.GEOMETRIA_CON_HALLAZGOS,
    'La geometría se ha pasado por la validación completa —autointersecciones, vértices ' +
      `duplicados, número mínimo de puntos y rango del huso— y ha dado ${partes.join(' y ')}, ` +
      'con el detalle vértice a vértice en la lista de hallazgos. Nada de esto impide seguir: ' +
      'verlo es justamente para lo que se carga el fichero.',
    SEVERIDAD.AVISO,
    datos,
  )
}

/**
 * C4 · la orientación del anillo exterior. INFORMATIVA SIEMPRE.
 *
 * Override O1, matizado el 2026-07-27: el exterior horario es lo que emite el WFS
 * del Catastro, pero **la plantilla oficial del propio Catastro va ANTIHORARIA** y
 * es el fichero que ellos publican como ejemplo. O sea que no es un requisito, es
 * una convención — y llamarle error a un GML antihorario sería inventarse una norma
 * y usarla para corregir el trabajo de otro técnico. Por eso esto no es un AVISO ni
 * puede llegar a serlo: se dice qué sentido trae y de qué lado está cada uno.
 */
function comprobarOrientacion(miembro) {
  const horario = miembro.orientacionExterior === -1
  return crearDeteccionComprobacion(
    TIPO_COMPROBACION.ORIENTACION_EXTERIOR,
    horario
      ? 'El contorno exterior va en sentido HORARIO, que es como lo emite el servicio de ' +
          'descarga del Catastro. Es un dato, no un requisito: el sentido del anillo es una ' +
          'convención y las dos se presentan sin problema.'
      : 'El contorno exterior va en sentido ANTIHORARIO, que es como viene la plantilla ' +
          'oficial de la Dirección General del Catastro. No está mal: el sentido del anillo es ' +
          'una convención y no un requisito, y al generar el GML se emite en el que toque sin ' +
          'que haya que tocar nada.',
    SEVERIDAD.INFO,
    { orientacionExterior: miembro.orientacionExterior, sentido: horario ? 'HORARIO' : 'ANTIHORARIO' },
  )
}

// ── La elección, cuando hay más de una parcela ───────────────────────────────

/**
 * Dice cuál se ha cogido, y solo cuando había de dónde elegir. Con una sola parcela
 * la frase sobra y un aviso que sale siempre es un aviso que ya no se lee.
 *
 * @param {MiembroComprobado[]} miembros
 * @param {number|null} elegido
 * @returns {DeteccionComprobacion[]}
 */
function eleccion(miembros, elegido) {
  if (elegido === null || miembros.length <= 1) return []
  const otras = miembros.length - 1
  return [
    crearDeteccionComprobacion(
      TIPO_COMPROBACION.PARCELA_ELEGIDA,
      `El fichero trae ${miembros.length} parcelas y se está comprobando la ` +
        `${elegido + 1}ª — ${miembros[elegido].etiqueta}. ` +
        `${otras === 1 ? 'La otra se queda' : `Las otras ${otras} se quedan`} en el fichero: ` +
        'un expediente lleva UNA parcela, y unirlas no es algo que esta aplicación haga. Si ' +
        'querías otra, elígela en la lista.',
      SEVERIDAD.INFO,
      { elegido, total: miembros.length },
    ),
  ]
}

// ── Composición de las listas ────────────────────────────────────────────────

/**
 * Junta las detecciones de las tres capas y las parte por severidad.
 *
 * ── EL CHOQUE QUE HUBO QUE RESOLVER AQUÍ, Y CON QUÉ CRITERIO ────────────────
 * MEDIDO sobre `test/fixtures/gml/cp_parcela_9398516VK3799G.gml` (la descarga real
 * del WFS, que declara `ISO-8859-1` y trae bytes UTF-8): el tipo
 * `ENCODING_DECLARADO` llega **dos veces y con severidad distinta**.
 *
 *   · `gml/decodificar.js` lo emite como **INFO**, y **siempre** que hay prólogo:
 *     para él «con qué se leyó este fichero» es información del expediente, no una
 *     queja. Y es la única capa que ha visto los bytes: si había algo que objetar,
 *     ya lo ha dicho aparte con pruebas (`ENCODING_DESMENTIDO`, `ENCODING_SUPUESTO`).
 *   · `gml/parse.js` lo emite como **AVISO**, y solo cuando el prólogo no dice
 *     UTF-8. Su mensaje lo explica solo: «se ha leído con el texto que se le ha
 *     pasado a este módulo, que NO transcodifica nada… compruébalo si ves acentos
 *     rotos». Es una advertencia sobre un riesgo que la capa de abajo **ya ha
 *     resuelto y demostrado**, dirigida a un llamante que decodificó a ciegas.
 *
 * No es un bug de ninguno de los dos: son dos capas mirando el mismo hecho desde
 * distinta distancia, y cada severidad es la correcta en su sitio. Pero al
 * componerlas, el usuario vería el mismo dato dos veces con dos tonos, y el tono
 * malo es el del que menos sabe.
 *
 * **Criterio: manda quien MIDIÓ el hecho.** Si `deteccionesPrevias` ya trae un
 * `ENCODING_DECLARADO`, se descarta el de `parsearGml`. El hecho no se pierde —la
 * detección conservada lleva el mismo `encodingDeclarado` dentro— y además el
 * descarte **se cuenta**, con una nota propia: nada se tira en silencio (regla de
 * oro 1). Si el llamante NO usó `decodificarGml` (texto que viene de otro sitio), no
 * hay previa que mande y la de `parsearGml` sobrevive intacta, que es lo correcto:
 * entonces es la única que habla del prólogo.
 *
 * La regla es **estrecha a propósito** y solo alcanza a ese tipo. Generalizarla a
 * «cualquier tipo repetido» se cargaría casos legítimos: los tres `CIERRE_RETIRADO`
 * del fichero multiparcela son tres hechos distintos, uno por parcela.
 *
 * @returns {{notas: Array, bloqueos: Array}}
 */
function componerDetecciones(previas, deParse, propias) {
  const yaLoDijeronLosBytes = previas.some((d) => d.tipo === TIPO_SOLAPADO)
  const solapadas = []
  const conservadasDeParse = []
  for (const d of deParse) {
    if (yaLoDijeronLosBytes && d.tipo === TIPO_SOLAPADO) solapadas.push(d)
    else conservadasDeParse.push(d)
  }

  const aviso =
    solapadas.length === 0
      ? []
      : [
          crearDeteccionComprobacion(
            TIPO_COMPROBACION.DETECCION_SOLAPADA,
            'Dos capas han informado del mismo dato —la codificación que declara el prólogo—: ' +
              'el lector de bytes, que es el único que ha podido contrastarla con el contenido ' +
              'real del fichero, y el lector de XML, que solo ve el texto ya decodificado. Se ' +
              'conserva la del lector de bytes, que es la que lo sabe, y se omite la otra para ' +
              'no decir dos veces lo mismo con distinto tono. El dato sigue arriba, intacto.',
            SEVERIDAD.INFO,
            {
              tipo: TIPO_SOLAPADO,
              omitidas: solapadas.length,
              severidadOmitida: solapadas[0].severidad,
            },
          ),
        ]

  const todas = [...previas, ...conservadasDeParse, ...aviso, ...propias]
  return {
    notas: todas.filter((d) => d.severidad !== SEVERIDAD.ERROR),
    bloqueos: todas.filter((d) => d.severidad === SEVERIDAD.ERROR),
  }
}

/**
 * Rescata el `encodingUsado` de las detecciones que lo llevan dentro, para cuando
 * el llamante no lo pasa. `BOM_PRESENTE`, `ENCODING_SUPUESTO` y `ENCODING_DESMENTIDO`
 * lo traen en `datos`; el caso corriente —bytes UTF-8 limpios— no emite ninguna de
 * las tres, y entonces esto devuelve `null` = «no consta». No se deduce «pues sería
 * UTF-8»: la deducción sería correcta hoy y falsa el día que `decodificarGml` cambie
 * de reglas, y una suposición callada es justo lo que esa capa existe para evitar.
 */
function encodingDeLasDetecciones(previas) {
  for (const d of previas) {
    const usado = d?.datos?.encodingUsado
    if (typeof usado === 'string' && usado.length > 0) return usado
  }
  return null
}

// ── La frontera: ¿puede la aplicación seguir con este fichero? ───────────────

/**
 * Decide `puedeContinuar` y, si es que no, POR QUÉ.
 *
 * Se construye con {@link noPuede}, que exige el motivo: es imposible salir de aquí
 * con `false` y un motivo vacío, que es la única forma que tendría este gate de
 * convertirse en el botón gris y mudo que la spec prohíbe.
 *
 * MEDIDO sobre los nueve ficheros del repo y sobre siete mutaciones del real (sin
 * geometría, `posList` con letras, sin miembros, sin `srsName`, XML de otra cosa,
 * texto que no es XML, cadena vacía): **todos los caminos a `false` traen además su
 * detección de ERROR de `gml/parse.js`**, así que `bloqueos` nunca se queda mudo
 * cuando el recorrido se para. No se emite un ERROR propio para garantizarlo porque
 * sería repetir la misma frase en dos sitios; lo que hay es un test que afirma el
 * invariante sobre todos esos casos, para que si algún día deja de ser cierto se
 * entere alguien.
 */
function decidirFrontera(resultado, parcela, elegido) {
  const { dialecto, resumen } = resultado

  if (parcela === null) {
    if (dialecto === DIALECTO.BU) {
      return noPuede(
        'Este GML describe una CONSTRUCCIÓN, no una parcela: no hay lindero que contrastar ' +
          'contra el parcelario. El contraste de edificio es otro recorrido y todavía no ' +
          'existe en esta aplicación, así que aquí el camino se acaba. Decírtelo es más ' +
          'honrado que llevarte a una pantalla que no mide lo tuyo.',
      )
    }
    if (dialecto === DIALECTO.DESCONOCIDO) {
      return noPuede(
        resumen.raiz === null
          ? 'El fichero no se ha podido leer como XML, así que no hay ninguna parcela que ' +
              'contrastar. Abajo está el error exacto del lector, con su línea y su columna.'
          : `El fichero es XML, pero su elemento raíz («${resumen.raiz.local}») no es el de ` +
              'ningún GML de parcela ni de edificio que esta aplicación reconozca: no hay ' +
              'parcela que contrastar.',
      )
    }
    return noPuede(
      'El fichero es un GML de parcela, pero no trae ninguna parcela dentro: la colección ' +
        'está vacía. No hay nada que comprobar ni que contrastar.',
    )
  }

  const cual = `La parcela nº ${elegido + 1} del fichero`

  if (parcela.recintos.length === 0) {
    return noPuede(
      `${cual} no trae geometría legible, así que no hay contorno que contrastar con el ` +
        'parcelario. Abajo está el motivo exacto por el que no se ha podido leer.',
    )
  }

  if (parcela.srs === null) {
    return noPuede(
      `${cual} no declara un sistema de referencia con el que esta aplicación pueda trabajar ` +
        '(EPSG:25829, 25830 o 25831). Sin él no se sabe dónde caen sus coordenadas, así que no ' +
        'se pueden situar sobre el parcelario ni contrastar con nada. Abajo está lo que declara ' +
        'el fichero. Reproyéctalo a ETRS89/UTM y vuelve a cargarlo.',
    )
  }

  return { puedeContinuar: true, motivoNoContinua: null }
}

/**
 * `puedeContinuar: false` **con** su motivo. LANZA si el motivo viene vacío: eso
 * sería un bug del programa que se manifestaría como un botón apagado sin
 * explicación, y un control gris y mudo es un error silencioso (regla de oro 1).
 */
function noPuede(motivo) {
  if (typeof motivo !== 'string' || motivo.trim().length === 0) {
    throw new TypeError(
      'comprobarGml: no se puede declarar `puedeContinuar: false` sin motivo. Un botón ' +
        'apagado y mudo es un error silencioso.',
    )
  }
  return { puedeContinuar: false, motivoNoContinua: motivo }
}

export default comprobarGml
