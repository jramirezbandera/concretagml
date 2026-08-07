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
  // Emitidas por dxf.js:
  ARCO_DISCRETIZADO: 'ARCO_DISCRETIZADO', // bulge (42) → polilínea (geo/arco.js)
  ENTIDAD_NO_SOPORTADA: 'ENTIDAD_NO_SOPORTADA', // INSERT/bloque/spline/xref
  // Las emite el ORQUESTADOR aguas abajo (declaradas aquí para fijar el léxico):
  SWAP_XY: 'SWAP_XY', // X/Y invertidas (geo/huso.js#sanear)
  GRADOS: 'GRADOS', // coordenadas geográficas pegadas (geo/huso.js#sanear)
  CIERRE: 'CIERRE', // el anillo no cierra (geo/cierre.js)
  HUSO_DETECTADO: 'HUSO_DETECTADO', // resultado de detectarHuso: punto de caída (INFO) o fuera de España (AVISO)
  HUSO_AMBIGUO: 'HUSO_AMBIGUO', // detectarHuso devolvió varios husos viables (A1)
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
 * Autodetecta el separador DECIMAL de un volcado de coordenadas, distinguiendo
 * la coma usada como decimal (`439250,35`) de la coma usada como separador de
 * columnas (`439250.35, 4479664.55`).
 *
 * Heurística (robusta para volcados de CAD/topografía, que NO agrupan miles):
 *   1. Cuenta cuántas veces cada carácter aparece ENTRE dígitos —el único sitio
 *      donde puede ser un decimal—: `puntos = nº de \d\.\d`, `comas = nº de \d,\d`.
 *   2. Gana el que más veces sea decimal: si `comas > puntos` → ','; si no → '.'.
 *   3. Empate o ausencia de decimales (coords enteras) → '.' por defecto. Es la
 *      elección SEGURA: con '.', una coma sólo puede ser delimitador de columnas
 *      (`439250,4479664` → dos enteros); con ',', se fusionarían mal.
 *
 * Por qué funciona el caso peliagudo `439250.35, 4479664.55` (punto decimal +
 * coma de columna con espacio): la coma va seguida de espacio, no de dígito, así
 * que NO cuenta como `\d,\d`; los puntos sí → gana '.'. Y `439250.35,4479664.55`
 * (sin espacio): la coma cuenta 1 vez, pero los puntos cuentan 2 (uno por número)
 * → siguen ganando. Limitación: no se contemplan separadores de millar.
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
  const puntos = (texto.match(/\d\.\d/g) || []).length
  const comas = (texto.match(/\d,\d/g) || []).length
  return comas > puntos ? ',' : '.'
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
 * Extrae los tokens numéricos de una línea respetando el separador decimal.
 * Con ',' como decimal, los puntos y otros caracteres son delimitadores; con
 * '.' como decimal, las comas lo son. Devuelve números finitos, en orden.
 *
 * @param {string} linea
 * @param {','|'.'} sepDecimal
 * @returns {number[]}
 */
function tokensNumericos(linea, sepDecimal) {
  // Nota: se admite signo `-` inicial (coords locales/deltas), pero las UTM
  // peninsulares son positivas. El separador NO-decimal jamás entra en el token.
  const re = sepDecimal === ',' ? /-?\d+(?:,\d+)?/g : /-?\d+(?:\.\d+)?/g
  const out = []
  for (const m of linea.matchAll(re)) {
    const crudo = sepDecimal === ',' ? m[0].replace(',', '.') : m[0]
    const n = Number(crudo)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/**
 * Tokeniza un volcado LIST/TXT en anillos de vértices `[x, y]` crudos.
 *
 * Reglas (regla de oro 1: cada decisión no trivial queda registrada):
 *   · Elige el separador decimal (autodetectado o `opts.separadorDecimal`) y
 *     emite UNA Deteccion `SEPARADOR_DECIMAL` indicando cuál.
 *   · Parte en varios anillos cada vez que una línea, recortada, es EXACTAMENTE
 *     la palabra `separador` (case-insensitive) → emite UNA Deteccion
 *     `SEPARADOR_POLIGONO` por cada corte.
 *   · En cada línea de datos toma los DOS primeros números como `[x, y]` y
 *     DESCARTA el 3º como Z; si hubo alguna Z, emite UNA Deteccion `Z_DESCARTADA`.
 *   · Ignora cabeceras/etiquetas: líneas con menos de 2 números se saltan sin
 *     romper (p. ej. `LWPOLYLINE Layer: "0"`, `X=`, líneas en blanco).
 *
 * NO cierra ni normaliza los anillos ni proyecta: eso es del orquestador.
 * Presupone filas «coordenada primero» (LIST usa `X= Y= Z=`; TXT dos columnas):
 * no interpreta columnas de índice de vértice ni metadatos multi-número.
 *
 * @param {string|string[]} lineas  Texto completo o array de líneas.
 * @param {object} [opts]
 * @param {','|'.'} [opts.separadorDecimal]  Fuerza el separador (si se omite, se autodetecta).
 * @param {string} [opts.palabraSeparador='separador']  Palabra de corte de polígono.
 * @returns {{ anillos: number[][][], detecciones: Deteccion[] }}
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
  const sepDecimal = separadorForzado ?? autodetectarSeparadorDecimal(arr.join('\n'))
  const palabra = (opts.palabraSeparador ?? PALABRA_SEPARADOR_DEFECTO).toLowerCase()

  const detecciones = []
  detecciones.push(
    crearDeteccion(
      TIPO_DETECCION.SEPARADOR_DECIMAL,
      `Separador decimal ${separadorForzado === undefined ? 'autodetectado' : 'indicado'}: ` +
        `'${sepDecimal}'.`,
      SEVERIDAD.INFO,
      { separador: sepDecimal, autodetectado: separadorForzado === undefined },
    ),
  )

  const anillos = []
  let anilloActual = []
  let zCount = 0

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

    const nums = tokensNumericos(t, sepDecimal)
    if (nums.length < 2) continue // cabecera/etiqueta/línea en blanco → se salta

    if (nums.length >= 3) zCount++ // había 3ª coordenada (Z): se descarta
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

  return { anillos, detecciones }
}
