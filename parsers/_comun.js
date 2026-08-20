// parsers/_comun.js — F01 · Contrato y utilidades COMPARTIDAS de los parsers.
//
// Este módulo NO parsea ningún formato concreto: fija el vocabulario común
// (tipos de detección), el contrato de resultado y el tokenizador que comparten
// list.js y txt.js. dxf.js reutiliza el contrato de detecciones (y la
// discretización de arcos vive en geo/arco.js, que este módulo NO importa).
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — NINGÚN error silencioso. Toda decisión no trivial (separador
//     decimal elegido, Z descartada, corte por `separador`, entrada inválida)
//     se materializa: o una Deteccion, o un throw. Nada se corrige callado.
//   · Regla 3 — NADA de lat/lon aquí. Sólo números crudos [x, y]; la
//     desproyección/detección de huso es de geo/huso.js, aguas abajo.
//   · Regla 4 — POJO plano. Coords como [x, y]; sin clases ni métodos.
//   · Los parsers NO cierran el anillo, NO lo normalizan, NO proyectan y NO
//     tocan el modelo: entregan `anillos` crudos y el orquestador (otra tarea)
//     hace el saneado (geo/huso.js), el cierre (geo/cierre.js) y el volcado a
//     model/parcela.js. Por eso `anillos` es number[][][] pelado, no Recintos.
//
// Sin dependencias externas (regla 6): cualquier aritmética es propia, nunca turf.

// ── Typedefs del contrato (para las tareas de Fase 2: list/txt/dxf) ───────────

/**
 * Una detección defensiva: algo que el parser decidió o descartó y que el
 * usuario TIENE que poder ver (regla de oro 1). POJO plano.
 *
 * @typedef {Object} Deteccion
 * @property {string} tipo       Una de las claves de {@link TIPO_DETECCION}.
 * @property {string} mensaje    Texto legible (en español) para la UI de F01.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad  Ver {@link SEVERIDAD}.
 * @property {object} [datos]    Datos estructurados opcionales de la detección
 *                               (recuentos, índices, valores…). Sólo presente si
 *                               se aportó: el contrato es `datos?`.
 */

/**
 * Resultado de un parser (list/txt/dxf) ANTES del orquestador.
 *
 * @typedef {Object} ResultadoParse
 * @property {number[][][]} anillos  Lista de anillos. Cada anillo es un array de
 *   vértices `[x, y]` en UTM (Este, Norte), NÚMEROS CRUDOS tal cual venían (la Z
 *   se descarta). El parser NO cierra el anillo, NO quita duplicados, NO ordena,
 *   NO proyecta y NO toca el modelo: eso es del orquestador aguas abajo.
 * @property {Deteccion[]} detecciones  Todo lo no trivial que ocurrió (regla 1).
 * @property {string} origen  Procedencia, uno de `ORIGEN_PARCELA`
 *   (model/parcela.js): 'LIST' | 'TXT' | 'DXF'. Lo fija cada parser concreto.
 */

// ── Vocabulario común ─────────────────────────────────────────────────────────

/**
 * Tipos de detección canónicos. Se declara el vocabulario COMPLETO desde ya
 * (aunque F01 sólo emita algunos) para que orquestador, huso.js, cierre.js y
 * dxf.js hablen el mismo idioma. Nota: huso.js ya emite correcciones con
 * `tipo:'SWAP_XY'` y `tipo:'GRADOS'`, que casan 1:1 con estas claves.
 *
 * @readonly
 */
export const TIPO_DETECCION = Object.freeze({
  // Emitidas por el tokenizador de este módulo (list/txt):
  SEPARADOR_DECIMAL: 'SEPARADOR_DECIMAL', // qué separador decimal se eligió
  Z_DESCARTADA: 'Z_DESCARTADA', // había 3ª coordenada (Z); se ignoró
  SEPARADOR_POLIGONO: 'SEPARADOR_POLIGONO', // corte de anillo por la palabra `separador`
  // Emitida por el tokenizador (líneas con ≥4 números) y por dxf.js (fichero
  // desalineado): la ENTRADA tiene una forma que este parser no interpreta y se
  // dice QUÉ se ha descartado en vez de tragárselo como si fuera otra cosa.
  FORMATO_NO_SOPORTADO: 'FORMATO_NO_SOPORTADO',
  // Emitidas por dxf.js y (los arcos de la LISTA) list.js:
  ARCO_DISCRETIZADO: 'ARCO_DISCRETIZADO', // bulge (42) / Curvatura → polilínea (geo/arco.js)
  ENTIDAD_NO_SOPORTADA: 'ENTIDAD_NO_SOPORTADA', // INSERT/bloque/spline/xref
  VERTICE_EXCLUIDO: 'VERTICE_EXCLUIDO', // VERTEX de marco de control de spline / cara de malla (dxf.js)
  // Las emite el ORQUESTADOR aguas abajo (declaradas aquí para fijar el léxico):
  SWAP_XY: 'SWAP_XY', // X/Y invertidas (geo/huso.js#sanear)
  GRADOS: 'GRADOS', // coordenadas geográficas pegadas (geo/huso.js#sanear)
  CIERRE: 'CIERRE', // el anillo no cierra (geo/cierre.js)
  HUSO_DETECTADO: 'HUSO_DETECTADO', // resultado de detectarHuso: punto de caída (INFO) o fuera de España (AVISO)
  HUSO_AMBIGUO: 'HUSO_AMBIGUO', // detectarHuso devolvió varios husos viables (A1)
  // F18 · el levantamiento de PUNTOS sueltos: se ha propuesto —o aplicado— el
  // anillo que los une. Lleva en `datos` de dónde sale el orden (numeración del
  // fichero o volcado), que es lo que el usuario necesita para poder revisarlo.
  PUNTOS_UNIDOS: 'PUNTOS_UNIDOS',
})

/**
 * Severidades admitidas para una Deteccion.
 * @readonly
 */
export const SEVERIDAD = Object.freeze({
  INFO: 'INFO',
  AVISO: 'AVISO',
  ERROR: 'ERROR',
})

// ── ⭐ F14 · DE QUÉ HABLAN LOS MENSAJES DE ESTA CAPA ─────────────────────────
//
// ⛔ **La deuda que esto paga, medida.** Desde F11 el MISMO `importar()` lee el
// volcado de una parcela y el de una construcción —`edificio/entrada.js` lo llama
// para los `.dxf` y los `.txt` de la rama EDIFICIO—, y sus mensajes seguían
// diciendo «la parcela» con trece partes de un edificio en pantalla. No es un
// detalle de estilo: son avisos sobre fallos REALES del fichero, y contarlos sobre
// el objeto equivocado hace que el técnico busque el problema donde no está. La
// fase 5 de F11 lo dejó anotado con dueño; F14 es la fase que lo cierra.
//
// ── POR QUÉ TRES FORMAS Y NO UNA CADENA ─────────────────────────────────────
// Se probó con un solo `sujeto` —el patrón que T1.5 estrenó en
// `viewer/index.js#encuadrarSobreRecintos`— y no llega, porque las cuatro frases
// tienen formas gramaticales distintas: «**La parcela** cae en el huso 30»,
// «el centroide **de la parcela**», «no son geometría **de parcela**». Con una
// sola cadena habría que concatenar artículos a mano en cada punto de uso, que es
// como se escriben los «de la construcción» sin la preposición.
//
// Y la GUÍA no es una declinación: es un consejo distinto. A una parcela se le
// dice «deja SOLO la polilínea»; a una construcción, no —tiene una por parte, y
// dejar solo una perdería doce—.
//
// ⚠️ Los textos de PARCELA son los literales anteriores **byte a byte**, para que
// esa rama diga exactamente lo que decía. Es la misma disciplina con la que
// `SUJETO_POR_DEFECTO` conservó el de F03.

/**
 * Las tres declinaciones y la guía, por sujeto. Se recorre en las pruebas, así que
 * un sujeto nuevo sin alguna de las cuatro claves sale rojo en vez de imprimir
 * `undefined` en un aviso.
 *
 * @readonly
 */
export const SUJETO = Object.freeze({
  PARCELA: Object.freeze({
    /** Sujeto de la frase: «___ cae en el huso 30». */
    nominativo: 'La parcela',
    /** Complemento con artículo: «el centroide ___». */
    genitivo: 'de la parcela',
    /** Complemento sin artículo: «no son geometría ___». */
    escueto: 'de parcela',
    /** Qué hacer en el CAD para que el fichero entre entero. */
    guia:
      'Deja solo la polilínea de la parcela en la capa 0 y ejecuta LIMPIA (PURGE); ' +
      'no se importan bloques, INSERT, xref ni splines.',
  }),
  CONSTRUCCION: Object.freeze({
    nominativo: 'La construcción',
    genitivo: 'de la construcción',
    escueto: 'de construcción',
    // ⚠️ **No es la de parcela con otro sustantivo**: una construcción tiene UNA
    // POLILÍNEA POR PARTE —trece en el edificio de referencia—, así que «deja solo
    // la polilínea» le haría perder doce. Lo que sí vale igual es el PURGE y la
    // lista de lo que no se importa.
    guia:
      'Deja en la capa las polilíneas de las partes de la construcción —una por parte— y ejecuta ' +
      'LIMPIA (PURGE); no se importan bloques, INSERT, xref ni splines.',
  }),
})

/** Las claves de {@link SUJETO}, para validar y para que los tests las recorran. */
export const SUJETOS = Object.freeze(Object.keys(SUJETO))

/**
 * El sujeto por defecto. **PARCELA**, y es lo correcto: es de lo que hablaban
 * estos mensajes durante trece fases, y quien no pase nada tiene que seguir
 * leyendo exactamente lo mismo.
 */
export const SUJETO_POR_DEFECTO = 'PARCELA'

/**
 * La clave de la construcción, para que `edificio/entrada.js` no la escriba a
 * mano. Un literal mal tecleado allí **no se quejaría** —`declinar` se cae al
 * defecto— y los avisos volverían a decir «la parcela» en silencio. Hay una prueba
 * que exige que esta constante siga estando en {@link SUJETOS}.
 */
export const SUJETO_CONSTRUCCION = 'CONSTRUCCION'

/**
 * Las declinaciones de un sujeto. Un valor desconocido **no lanza**: se cae al
 * defecto. Esta función se llama desde dentro de un parser, en mitad de un
 * fichero que el usuario acaba de soltar, y reventar ahí cambiaría un aviso sobre
 * el dato por un fallo del programa. El tipo del parámetro sí lo valida el
 * llamante público (`importar`), que es donde el error es del programador.
 *
 * @param {string} [clave]
 * @returns {{nominativo: string, genitivo: string, escueto: string, guia: string}}
 */
export const declinar = (clave) => SUJETO[clave] ?? SUJETO[SUJETO_POR_DEFECTO]

// ── Factory de detecciones ────────────────────────────────────────────────────

/**
 * Crea una {@link Deteccion} POJO validando `tipo` y `severidad`. LANZA si
 * cualquiera es inválido (regla de oro 1: no fabricamos detecciones mudas ni con
 * un tipo/severidad que la UI no sepa interpretar).
 *
 * @param {string} tipo  Debe ser una clave/valor de {@link TIPO_DETECCION}.
 * @param {string} mensaje  Texto no vacío para el usuario.
 * @param {'INFO'|'AVISO'|'ERROR'} severidad  Debe ser un valor de {@link SEVERIDAD}.
 * @param {object} [datos]  Datos estructurados opcionales (objeto plano).
 * @returns {Deteccion}  POJO plano `{ tipo, mensaje, severidad[, datos] }`.
 * @throws {RangeError}  Si `tipo` o `severidad` no están en su catálogo.
 * @throws {TypeError}   Si `mensaje` no es string no vacío o `datos` no es objeto plano.
 */
export function crearDeteccion(tipo, mensaje, severidad, datos) {
  const tiposValidos = Object.values(TIPO_DETECCION)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccion: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const sevsValidas = Object.values(SEVERIDAD)
  if (!sevsValidas.includes(severidad)) {
    throw new RangeError(
      `crearDeteccion: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${sevsValidas.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccion: 'mensaje' debe ser un string no vacío; recibido ${JSON.stringify(mensaje)}.`,
    )
  }

  const det = { tipo, mensaje, severidad }
  if (datos !== undefined) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new TypeError(
        `crearDeteccion: 'datos' debe ser un objeto plano o estar ausente; recibido ${JSON.stringify(datos)}.`,
      )
    }
    det.datos = datos
  }
  return det
}

// ── Tokenizador compartido LIST/TXT ───────────────────────────────────────────

/** Palabra que, sola en su línea, corta un polígono del siguiente. */
const PALABRA_SEPARADOR_DEFECTO = 'separador'

/**
 * Formato español con separador de millar: `439.250,35` / `4.479.664,55` —
 * grupos de EXACTAMENTE 3 dígitos separados por punto y coma decimal presente.
 * Se exige la parte decimal (`,\d+`) para no confundirlo con un número con
 * punto decimal y 3 decimales (`4.479` a secas es ambiguo y NO dispara esto).
 */
const RE_MILES_ES = /(?<![\d.,])-?\d{1,3}(?:\.\d{3})+,\d+(?!\d)/

/**
 * Decide el separador decimal Y el porqué. Es la versión con diagnóstico de
 * {@link autodetectarSeparadorDecimal}: `extraerPares` la usa para poder DECIR
 * en la Deteccion SEPARADOR_DECIMAL cuándo la elección fue un desempate real
 * (regla de oro 1: una heurística que decide algo no trivial lo cuenta).
 *
 * Heurística, por orden:
 *   1. Formato de miles español (`439.250,35 4.479.664,55`) → ','. El recuento
 *      simple del paso 2 lo destrozaba: los puntos de millar «ganaban» y cada
 *      número se partía en pedazos (hallazgo H5 de la auditoría 2026-08-15).
 *   2. Recuento de decimales: `puntos = nº de \d\.\d`, `comas = nº de \d,\d`;
 *      gana el que más veces aparece entre dígitos. Empate o cero → '.'.
 *   3. ⛔ GUARDIA de la coma de columna sobre ENTEROS (`439250,4479664`):
 *      con el recuento a secas la coma «ganaba» (1 a 0), cada línea se fusionaba
 *      en UN número, todas se saltaban y el fichero moría en SIN_GEOMETRIA con
 *      un motivo falso. Si elegir ',' no deja NI UNA línea con un par de números
 *      y elegir '.' deja pares plausibles en metros (|v| ≥ 1000), la coma era de
 *      COLUMNA y gana '.'. La doc antigua de este fichero afirmaba que «'.' es
 *      la elección segura» precisamente para este caso… y el código hacía lo
 *      contrario (elegía ','); esta guardia es la corrección medida.
 *
 * @param {string} texto
 * @returns {{separador: (','|'.'), motivo: 'MILES_ES'|'RECUENTO'|'PARES_SOBRE_COMA'|'DEFECTO'}}
 */
function decidirSeparadorDecimal(texto) {
  if (RE_MILES_ES.test(texto)) return { separador: ',', motivo: 'MILES_ES' }

  const puntos = (texto.match(/\d\.\d/g) || []).length
  const comas = (texto.match(/\d,\d/g) || []).length
  if (comas > puntos) {
    let paresConComa = 0
    let paresPlausiblesConPunto = 0
    for (const linea of texto.split(/\r?\n/)) {
      if (tokensNumericos(linea, ',').length >= 2) paresConComa++
      const conPunto = tokensNumericos(linea, '.')
      if (conPunto.length >= 2 && Math.abs(conPunto[0]) >= 1000 && Math.abs(conPunto[1]) >= 1000) {
        paresPlausiblesConPunto++
      }
    }
    if (paresConComa === 0 && paresPlausiblesConPunto > 0) {
      return { separador: '.', motivo: 'PARES_SOBRE_COMA' }
    }
    return { separador: ',', motivo: 'RECUENTO' }
  }
  return { separador: '.', motivo: puntos === 0 && comas === 0 ? 'DEFECTO' : 'RECUENTO' }
}

/**
 * Autodetecta el separador DECIMAL de un volcado de coordenadas, distinguiendo
 * la coma usada como decimal (`439250,35`) de la coma usada como separador de
 * columnas (`439250.35, 4479664.55` **y también** `439250,4479664`, enteros).
 * La heurística completa —recuento, miles español, y la guardia de la coma de
 * columna sobre enteros— está documentada en {@link decidirSeparadorDecimal}.
 *
 * Por qué funciona el caso peliagudo `439250.35, 4479664.55` (punto decimal +
 * coma de columna con espacio): la coma va seguida de espacio, no de dígito, así
 * que NO cuenta como `\d,\d`; los puntos sí → gana '.'. Y `439250.35,4479664.55`
 * (sin espacio): la coma cuenta 1 vez, pero los puntos cuentan 2 (uno por número)
 * → siguen ganando.
 *
 * @param {string} texto  Texto completo (una o varias líneas) del volcado.
 * @returns {','|'.'}  El separador decimal elegido.
 * @throws {TypeError}  Si `texto` no es un string.
 */
export function autodetectarSeparadorDecimal(texto) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `autodetectarSeparadorDecimal: se esperaba un string; recibido ${typeof texto}.`,
    )
  }
  return decidirSeparadorDecimal(texto).separador
}

/**
 * Normaliza la entrada de {@link extraerPares} a un array de líneas (strings).
 * Acepta un string (se parte por saltos de línea) o un array de strings.
 *
 * @param {string|string[]} lineas
 * @returns {string[]}
 * @throws {TypeError}  Si no es string ni array de strings.
 */
function normalizarLineas(lineas) {
  if (typeof lineas === 'string') return lineas.split(/\r?\n/)
  if (Array.isArray(lineas)) {
    lineas.forEach((l, i) => {
      if (typeof l !== 'string') {
        throw new TypeError(
          `extraerPares: la línea ${i} no es un string: ${JSON.stringify(l)}.`,
        )
      }
    })
    return lineas
  }
  throw new TypeError(
    `extraerPares: 'lineas' debe ser un string o un array de strings; recibido ${typeof lineas}.`,
  )
}

/**
 * Patrón (fuente de RegExp, sin flags) de UN número según el separador decimal.
 * Compartido por {@link tokensNumericos} y por las capturas `X=`/`Y=`/`Z=` del
 * modo LIST de {@link extraerPares}: un solo sitio, dos usos, cero divergencia.
 *
 *   · Con ',': admite el formato de miles español (`439.250,35`) —grupos de
 *     EXACTAMENTE 3 dígitos— además del número llano (`439250,35`).
 *   · Ambos: admite notación científica (`4.3925e5`), que antes se partía en
 *     dos números (`4.3925` y `5`) en silencio (hallazgo H6, 2026-08-15).
 *
 * @param {','|'.'} sepDecimal
 * @returns {string}
 */
function patronNumero(sepDecimal) {
  return sepDecimal === ','
    ? '-?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?(?:[eE][+-]?\\d+)?'
    : '-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?'
}

/**
 * Convierte UN token (ya extraído con {@link patronNumero}) a número JS:
 * con ',' se retiran los puntos de millar y la coma pasa a punto decimal.
 *
 * @param {string} token
 * @param {','|'.'} sepDecimal
 * @returns {number}
 */
function aNumero(token, sepDecimal) {
  const crudo = sepDecimal === ',' ? token.replace(/\./g, '').replace(',', '.') : token
  return Number(crudo)
}

/**
 * Extrae los tokens numéricos de una línea respetando el separador decimal.
 * Con ',' como decimal, los puntos sueltos y otros caracteres son delimitadores
 * (los puntos de MILLAR del formato español sí forman parte del token); con
 * '.' como decimal, las comas lo son. Devuelve números finitos, en orden.
 *
 * @param {string} linea
 * @param {','|'.'} sepDecimal
 * @returns {number[]}
 */
export function tokensNumericos(linea, sepDecimal) {
  // Nota: se admite signo `-` inicial (coords locales/deltas), pero las UTM
  // peninsulares son positivas. El separador NO-decimal jamás entra en el token.
  const re = new RegExp(patronNumero(sepDecimal), 'g')
  const out = []
  for (const m of linea.matchAll(re)) {
    const n = aNumero(m[0], sepDecimal)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

// ── ⛔ H1 (auditoría 2026-08-15) · LA SALIDA DE LIST CON ARCOS ────────────────
//
// La LISTA de AutoCAD sobre una polilínea con arcos imprime, POR CADA arco,
// líneas de metadatos del arco además del vértice:
//
//     en el punto, X= 439250.3500  Y= 4479664.5500  Z= 0.0000
//     Curvatura: 0.4142
//     Centro: X= 439252.0000  Y= 4479666.0000  Z= 0.0000
//     Radio: 5.0000
//
// La línea `Centro:` trae 3 números y el tokenizador «todo lo que tenga ≥2
// números es un vértice» se la tragaba como VÉRTICE: parcela construida con
// `bloqueos: []`, cero avisos y EL CENTRO DEL ARCO dentro del anillo. Y la
// `Curvatura` (el bulge) se tiraba sin detección: el arco quedaba sustituido
// por su cuerda en silencio, cuando la vía DXF materializa exactamente eso
// con ARCO_DISCRETIZADO.
//
// El arreglo: cuando el texto es CLARAMENTE salida de LIST (alguna línea trae
// `X= <número>` e `Y= <número>`), solo esas líneas son vértices; las líneas
// `Curvatura`/`Centro`/`Radio` (y `bulge`/`center`/`radius`) se reconocen como
// metadatos del arco. La curvatura NO se tira: se devuelve en `curvaturas[]`
// (bulge + a qué vértice pertenece) para que `parsers/list.js` discretice el
// arco con geo/arco.js —este módulo NO importa geo/arco.js, ver la cabecera—
// y `parsers/txt.js` al menos lo avise. Nada queda en silencio.

/** ¿La línea (recortada) es un metadato de arco de la LISTA y no un vértice? */
const RE_META_ARCO = /^(?:curvatura|bulge|centro|center|radio|radius)\b/i
/** ¿…y en concreto la curvatura (el bulge), que es la que hay que conservar? */
const RE_CURVATURA = /^(?:curvatura|bulge)\b/i

/**
 * Una curvatura (bulge) leída de la LISTA: el arco va DESDE el vértice
 * `vertice` del anillo `anillo` HASTA el siguiente (o hasta V0 si es el último
 * y la polilínea está cerrada). Mismo convenio de signo que el código DXF 42.
 *
 * @typedef {Object} CurvaturaLIST
 * @property {number} anillo   Índice del anillo en `anillos`.
 * @property {number} vertice  Índice del vértice del que SALE el arco.
 * @property {number} b        El bulge, con signo.
 */

/**
 * Tokeniza un volcado LIST/TXT en anillos de vértices `[x, y]` crudos.
 *
 * Reglas (regla de oro 1: cada decisión no trivial queda registrada):
 *   · Elige el separador decimal (autodetectado o `opts.separadorDecimal`) y
 *     emite UNA Deteccion `SEPARADOR_DECIMAL` indicando cuál (y el porqué,
 *     cuando la elección fue un desempate real y no el recuento simple).
 *   · Parte en varios anillos cada vez que una línea, recortada, es EXACTAMENTE
 *     la palabra `separador` (case-insensitive) → emite UNA Deteccion
 *     `SEPARADOR_POLIGONO` por cada corte.
 *   · MODO LIST (alguna línea trae `X= <número>` e `Y= <número>`): SOLO las
 *     líneas con `X=`/`Y=` son vértices; `Curvatura:`/`Centro:`/`Radio:` son
 *     metadatos de arco (la curvatura se devuelve en `curvaturas`, ver arriba)
 *     y el resto de líneas son rótulos («Área:», «Total: 2 vertices»…), que
 *     NUNCA son un vértice aunque traigan dos números.
 *   · Modo TXT (sin `X=`/`Y=`): en cada línea de datos toma los DOS primeros
 *     números como `[x, y]`; con 3 números DESCARTA el 3º como Z (Deteccion
 *     `Z_DESCARTADA` una sola vez); con **4 o más** números la línea NO es el
 *     formato soportado («x1 y1 x2 y2» perdería la mitad de los pares): se
 *     OMITE ENTERA y se emite UNA Deteccion `FORMATO_NO_SOPORTADO` (ERROR) —
 *     antes se tragaba los dos primeros números y lo llamaba «Z descartada».
 *   · Ignora cabeceras/etiquetas: líneas con menos de 2 números se saltan sin
 *     romper (p. ej. `LWPOLYLINE Layer: "0"`, `X=`, líneas en blanco).
 *
 * NO cierra ni normaliza los anillos ni proyecta: eso es del orquestador.
 *
 * @param {string|string[]} lineas  Texto completo o array de líneas.
 * @param {object} [opts]
 * @param {','|'.'} [opts.separadorDecimal]  Fuerza el separador (si se omite, se autodetecta).
 * @param {string} [opts.palabraSeparador='separador']  Palabra de corte de polígono.
 * @returns {{ anillos: number[][][], detecciones: Deteccion[], curvaturas: CurvaturaLIST[] }}
 *   `curvaturas` sólo se puebla en modo LIST; en TXT puro siempre es `[]`.
 * @throws {TypeError}   Si `lineas` no es string ni array de strings.
 * @throws {RangeError}  Si `opts.separadorDecimal` se aporta y no es ',' ni '.'.
 */
export function extraerPares(lineas, opts = {}) {
  const arr = normalizarLineas(lineas)

  const separadorForzado = opts.separadorDecimal
  if (separadorForzado !== undefined && separadorForzado !== ',' && separadorForzado !== '.') {
    throw new RangeError(
      `extraerPares: 'opts.separadorDecimal' debe ser ',' o '.'; recibido ${JSON.stringify(separadorForzado)}.`,
    )
  }
  const eleccion =
    separadorForzado !== undefined
      ? { separador: separadorForzado, motivo: 'FORZADO' }
      : decidirSeparadorDecimal(arr.join('\n'))
  const sepDecimal = eleccion.separador
  const palabra = (opts.palabraSeparador ?? PALABRA_SEPARADOR_DEFECTO).toLowerCase()

  // La elección se cuenta SIEMPRE; el porqué, solo cuando no fue el recuento
  // trivial (los `datos` de siempre no cambian de forma en el caso normal).
  const desempate = eleccion.motivo === 'MILES_ES' || eleccion.motivo === 'PARES_SOBRE_COMA'
  const detecciones = []
  detecciones.push(
    crearDeteccion(
      TIPO_DETECCION.SEPARADOR_DECIMAL,
      `Separador decimal ${separadorForzado === undefined ? 'autodetectado' : 'indicado'}: ` +
        `'${sepDecimal}'.` +
        (eleccion.motivo === 'MILES_ES'
          ? ` Formato español con separador de millar («4.479.664,55»): los puntos agrupan miles.`
          : '') +
        (eleccion.motivo === 'PARES_SOBRE_COMA'
          ? ` La coma aparece entre dígitos pero leerla como decimal fundiría cada línea en UN ` +
            `solo número; leída como separador de columnas quedan pares plausibles en metros.`
          : ''),
      SEVERIDAD.INFO,
      desempate
        ? { separador: sepDecimal, autodetectado: true, motivo: eleccion.motivo }
        : { separador: sepDecimal, autodetectado: separadorForzado === undefined },
    ),
  )

  // Modo LIST: ver el bloque H1 de arriba. La detección del modo excluye las
  // líneas de metadatos de arco (¡`Centro:` también trae `X=`/`Y=`!).
  // `\b` delante de la letra: que un «MAX= 5» no cuente como una X (la X de un
  // vértice de LISTA va precedida de espacio, coma o principio de línea).
  const numSrc = patronNumero(sepDecimal)
  const reX = new RegExp(`\\b[Xx]\\s*=\\s*(${numSrc})`)
  const reY = new RegExp(`\\b[Yy]\\s*=\\s*(${numSrc})`)
  const reZ = new RegExp(`\\b[Zz]\\s*=\\s*(${numSrc})`)
  const modoLIST = arr.some((l) => {
    const t = l.trim()
    return !RE_META_ARCO.test(t) && reX.test(t) && reY.test(t)
  })

  const anillos = []
  const curvaturas = []
  let anilloActual = []
  let zCount = 0
  let lineasMultinum = 0 // modo TXT: líneas con ≥4 números, omitidas (H2)
  let primeraMultinum = null
  let curvaturasHuerfanas = 0 // `Curvatura` sin vértice previo al que atarla

  const cerrarAnillo = () => {
    if (anilloActual.length > 0) {
      anillos.push(anilloActual)
      anilloActual = []
    }
  }

  for (const linea of arr) {
    const t = linea.trim()

    // Corte de polígono: línea cuyo contenido recortado es EXACTAMENTE `separador`.
    if (t.toLowerCase() === palabra) {
      cerrarAnillo()
      detecciones.push(
        crearDeteccion(
          TIPO_DETECCION.SEPARADOR_POLIGONO,
          `Corte de polígono por la palabra '${opts.palabraSeparador ?? PALABRA_SEPARADOR_DEFECTO}': ` +
            `empieza el anillo ${anillos.length + 1}.`,
          SEVERIDAD.INFO,
          { indiceAnilloSiguiente: anillos.length },
        ),
      )
      continue
    }

    if (modoLIST) {
      if (RE_CURVATURA.test(t)) {
        const nums = tokensNumericos(t, sepDecimal)
        if (nums.length >= 1 && anilloActual.length > 0) {
          // El arco SALE del último vértice leído (la LISTA imprime la curvatura
          // justo después del punto inicial del tramo).
          curvaturas.push({ anillo: anillos.length, vertice: anilloActual.length - 1, b: nums[0] })
        } else {
          curvaturasHuerfanas++
        }
        continue
      }
      if (RE_META_ARCO.test(t)) continue // Centro:/Radio: — metadatos del arco, NO vértices (H1)
      const mx = t.match(reX)
      const my = t.match(reY)
      if (mx && my) {
        anilloActual.push([aNumero(mx[1], sepDecimal), aNumero(my[1], sepDecimal)])
        if (reZ.test(t)) zCount++ // había Z=: se descarta (como siempre)
      }
      // Cualquier otra línea de una LISTA es rótulo/cabecera («Área:», «Total: 2
      // vertices»…): no es un vértice aunque traiga dos números.
      continue
    }

    const nums = tokensNumericos(t, sepDecimal)
    if (nums.length < 2) continue // cabecera/etiqueta/línea en blanco → se salta

    if (nums.length >= 4) {
      // H2: «x1 y1 x2 y2» NO es el formato soportado. Tragarse los dos primeros
      // números perdería la mitad de los pares con el mensaje FALSO de «Z
      // descartada». Se omite la línea entera y se dice abajo (ERROR).
      lineasMultinum++
      if (primeraMultinum === null) primeraMultinum = t
      continue
    }
    if (nums.length === 3) zCount++ // había 3ª coordenada (Z): se descarta
    anilloActual.push([nums[0], nums[1]])
  }
  cerrarAnillo()

  if (zCount > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.Z_DESCARTADA,
        `Se descartó la coordenada Z en ${zCount} vértice(s) (el modelo es 2D en UTM).`,
        SEVERIDAD.INFO,
        { vertices: zCount },
      ),
    )
  }

  if (lineasMultinum > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.FORMATO_NO_SOPORTADO,
        `${lineasMultinum} línea(s) con 4 o más números (p. ej. «${primeraMultinum}») — no es el ` +
          `formato soportado de una coordenada por línea (X Y [Z]) y NO se han importado: si el ` +
          `fichero lista varios vértices por línea, vuelve a exportarlo con una coordenada por línea.`,
        SEVERIDAD.ERROR,
        { lineas: lineasMultinum, primeraLinea: primeraMultinum },
      ),
    )
  }

  if (curvaturasHuerfanas > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.FORMATO_NO_SOPORTADO,
        `${curvaturasHuerfanas} línea(s) «Curvatura» sin un vértice anterior al que pertenecer: ` +
          `se ignoran (el arco no se puede situar).`,
        SEVERIDAD.AVISO,
        { curvaturasHuerfanas },
      ),
    )
  }

  return { anillos, detecciones, curvaturas }
}
