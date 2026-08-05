// comprobacion/_comun.js — F08 · Comprobar un GML existente. Contrato COMPARTIDO
// de esta capa.
//
// Este módulo NO comprueba nada: fija el vocabulario, la factoría de detecciones,
// las guardas de contrato y la traducción «dialecto → castellano presentable» que
// `comprobacion/gml.js` —y el día que llegue F14, `comprobacion/edificio.js`—
// necesitan por igual.
//
// Es el análogo, para la capa `comprobacion/`, de `diagnostico/_comun.js`,
// `validation/_comun.js`, `gml/_comun.js` y `edit/_comun.js` para las suyas: el
// sitio de lo que ningún módulo de esta capa puede permitirse tener por duplicado.
// Y se escribe PRIMERO, con las firmas que congela el plan, por la misma razón que
// lo hizo F07: `edit/_comun.js` nació tarde y sus guardas ya habían DIVERGIDO en la
// redacción entre las dos copias para cuando se pagó la deuda.
//
// ── POR QUÉ ESTA CAPA EXISTE, Y POR QUÉ NO ES UN FICHERO DENTRO DE `gml/` ────
// Porque cruza tres capas que no pueden verse entre sí: lee lo que devuelve
// `gml/parse.js`, lo pasa por `validation/parcela.js` (F02) y mide con `geo/area.js`.
// Meterlo en `gml/` obligaría a `gml/ → validation/`, que es una dependencia al
// revés: el lector de ficheros no puede depender del validador geométrico. De ahí
// una capa PROPIA, por encima de las tres, exactamente igual que `diagnostico/`.
//
// ── LAS TRES COSAS QUE ESTE MÓDULO SÍ APORTA ────────────────────────────────
//   1. {@link TIPO_COMPROBACION} — un catálogo de detecciones PROPIO, con la MISMA
//      forma que `gml/_comun.js#DeteccionGml` y `parsers/_comun.js#Deteccion`. No
//      se amplía el de `gml/`: su JSDoc lo declara «vocabulario COMPLETO» y cerrado
//      (25 tipos), y ninguno de ellos significa «las coordenadas caen fuera del
//      huso que declara el fichero» ni «la superficie declarada no cuadra con la
//      medida» — que es justo lo que F08 añade. `gml/parse.js` se negó a emitirlos
//      por escrito y con motivo; inventarlos en su catálogo sería contradecirle.
//   2. {@link SEVERIDAD}, RE-EXPORTADA de `gml/_comun.js` y no redefinida. No es
//      cosmética: `comprobacion/gml.js` MEZCLA en una sola lista las detecciones de
//      `gml/decodificar.js`, las de `gml/parse.js` y las suyas, y luego las parte en
//      `notas` (INFO/AVISO) y `bloqueos` (ERROR). Dos catálogos de severidad que
//      pudieran divergir romperían esa partición en silencio.
//   3. {@link ETIQUETAS_DIALECTO} — el «qué es este fichero» en castellano de
//      persona. La tabla `gml/_comun.js#DIALECTOS` ya trae un `motivo`, pero está
//      escrito para el programador («SPEC §1», «override O10», nombres de
//      namespace): no se le puede enseñar a un técnico tal cual.
//
// ── LA QUINTA COPIA DE `describir`, DECLARADA ───────────────────────────────
// `describir` existe ya en `validation/_comun.js`, `viewer/_comun.js`,
// `edit/_comun.js` y `diagnostico/_comun.js`, y ésta es la quinta. No es un olvido:
// es la regla que este repo se dio en `edit/_comun.js` («unificar ENTRE capas no es
// el alcance»), y la alternativa —importar la de `diagnostico/`— sería una
// dependencia `comprobacion/ → diagnostico/` para redactar el mensaje de un
// `throw`. La deuda ya está anotada en `spec/feature-07-diagnostico-parcela.md`
// (un `_comun` neutro por debajo de las capas, ~15 líneas movidas); F08 la hereda y
// la deja escrita otra vez en vez de disimularla.
//
// Módulo PURO: sin DOM, sin Leaflet, sin Turf, sin red, sin estado y sin reloj.
// NO entra en el barrel `index.js` — es común INTERNO de esta capa.

import { DIALECTO } from '../gml/_comun.js'

/**
 * Severidad de una detección. **Re-exportada de `gml/_comun.js`, no redefinida
 * aquí**: ver el punto 2 de la cabecera. Un solo objeto congelado en memoria para
 * las tres capas que aportan detecciones a la misma lista.
 */
export { SEVERIDAD } from '../gml/_comun.js'

// ── Vocabulario propio ───────────────────────────────────────────────────────

/**
 * Tipos de detección que AÑADE la capa de comprobación. Catálogo cerrado, igual
 * que el de `gml/`, y separado del suyo a propósito: un `TIPO_GML` no cuela en
 * {@link crearDeteccionComprobacion} ni al revés.
 *
 * Están agrupados por la comprobación que los emite (C1–C4 del plan de F08), y en
 * cada grupo hay un tipo para «se ha mirado y no hay nada que decir». Eso es
 * deliberado y es la regla de oro 1 leída al derecho: una comprobación que solo
 * habla cuando encuentra algo no se distingue de una que no se ha ejecutado, y el
 * usuario no puede saber si el silencio significa «bien» o «no lo miré».
 *
 * @readonly
 */
export const TIPO_COMPROBACION = Object.freeze({
  // ── C1 · la superficie que el fichero declara SOBRE SÍ MISMO ──
  // OJO al nombre: NO es «la superficie catastral». Esa, en el diagnóstico de
  // F07, es la que declara el PARCELARIO; ésta es la que declara ESTE fichero
  // sobre sus propias coordenadas. Confundirlas sería atribuir al Catastro el
  // número de un tercero.
  SUPERFICIE_COTEJADA: 'SUPERFICIE_COTEJADA', // declarada y medida cuadran a la precisión del fichero
  SUPERFICIE_DISCREPANTE: 'SUPERFICIE_DISCREPANTE', // no cuadran, y por cuánto
  SUPERFICIE_NO_DECLARADA: 'SUPERFICIE_NO_DECLARADA', // no hay `areaValue` con el que cotejar
  // ── C2 · el huso que el fichero declara, verificado sobre sus coordenadas ──
  HUSO_VERIFICADO: 'HUSO_VERIFICADO', // todos los vértices caen donde dice el `srsName`
  HUSO_FUERA_DE_RANGO: 'HUSO_FUERA_DE_RANGO', // alguno no
  HUSO_NO_COTEJABLE: 'HUSO_NO_COTEJABLE', // sin SRS utilizable no hay contra qué comparar
  // ── C3 · geometría completa (F02: kinks, duplicados, mínimo de puntos) ──
  GEOMETRIA_REVISADA: 'GEOMETRIA_REVISADA', // pasada por `validarParcela` sin hallazgos
  GEOMETRIA_CON_HALLAZGOS: 'GEOMETRIA_CON_HALLAZGOS', // cuántos, y de qué nivel
  // ── C4 · orientación del anillo exterior: INFORMATIVA, jamás un error (O1) ──
  ORIENTACION_EXTERIOR: 'ORIENTACION_EXTERIOR',
  // ── La elección, cuando el fichero trae más de una parcela ──
  PARCELA_ELEGIDA: 'PARCELA_ELEGIDA',
  // ── Higiene de las listas: dos capas que informan del mismo hecho ──
  DETECCION_SOLAPADA: 'DETECCION_SOLAPADA',
  // ── C5 · el CIERRE DEL CONJUNTO (F17) ────────────────────────────────────
  // El catálogo se AMPLÍA, y hay que decir por qué eso no contradice al «cerrado»
  // de arriba: cerrado significa que ninguna otra capa mete tipos suyos aquí, no
  // que esta capa no pueda crecer. C5 es una comprobación NUEVA de la misma capa
  // —`comprobacion/conjunto.js`—, con la misma disciplina: un tipo positivo por
  // afirmación, para que «se ha mirado y cuadra» no se confunda con «no se ha
  // mirado».
  //
  // ⛔ Y son TRES afirmaciones y no una, que es la decisión de fondo de esta
  // comprobación: **un solape y un hueco se compensan en área**, así que la suma
  // sola cuadra sobre un parcelario roto.
  SUMA_COTEJADA: 'SUMA_COTEJADA', // Σ de lo emitido == lo oficial, dentro de la tolerancia
  SUMA_DISCREPANTE: 'SUMA_DISCREPANTE', // no cuadra, y por cuánto
  SIN_SOLAPE: 'SIN_SOLAPE', // ningún par de miembros comparte superficie
  MIEMBROS_SOLAPADOS: 'MIEMBROS_SOLAPADOS', // dos miembros se pisan: qué par y cuánto
  COBERTURA_VERIFICADA: 'COBERTURA_VERIFICADA', // los miembros cubren el contorno oficial
  COBERTURA_INCOMPLETA: 'COBERTURA_INCOMPLETA', // queda superficie oficial sin cubrir: el hueco
  CONJUNTO_NO_COTEJABLE: 'CONJUNTO_NO_COTEJABLE', // no se ha podido medir, que NO es «cuadra»
})

/**
 * Una detección de la capa de comprobación. **Misma FORMA** que
 * `gml/_comun.js#DeteccionGml` y `parsers/_comun.js#Deteccion` —las mismas cuatro
 * claves, con `datos` opcional— para que la vista pinte las tres con el mismo
 * componente y sin adaptador. Lo que cambia es el catálogo de `tipo`.
 *
 * @typedef {Object} DeteccionComprobacion
 * @property {string} tipo      Una de las claves de {@link TIPO_COMPROBACION}.
 * @property {string} mensaje   Texto legible (en español) para la UI.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad
 * @property {object} [datos]   Datos estructurados opcionales.
 */

/**
 * Crea una {@link DeteccionComprobacion} validando `tipo` y `severidad`. LANZA si
 * cualquiera de los dos es inválido: no se fabrican detecciones mudas ni con un
 * tipo que la vista no sepa interpretar. Gemela de `gml/#crearDeteccionGml`, y
 * escrita aparte por lo dicho en el punto 1 de la cabecera.
 *
 * @param {string} tipo  Valor de {@link TIPO_COMPROBACION}.
 * @param {string} mensaje  Texto no vacío, en español, presentable tal cual.
 * @param {'INFO'|'AVISO'|'ERROR'} severidad
 * @param {object} [datos]  Objeto plano.
 * @returns {DeteccionComprobacion}
 * @throws {RangeError}  Si `tipo` o `severidad` no están en su catálogo.
 * @throws {TypeError}   Si `mensaje` no es string no vacío o `datos` no es objeto plano.
 */
export function crearDeteccionComprobacion(tipo, mensaje, severidad, datos) {
  const tipos = Object.values(TIPO_COMPROBACION)
  if (!tipos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccionComprobacion: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tipos.join(', ')}. (Los de gml/ tienen su propia factoría.)`,
    )
  }
  const severidades = ['INFO', 'AVISO', 'ERROR']
  if (!severidades.includes(severidad)) {
    throw new RangeError(
      `crearDeteccionComprobacion: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${severidades.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccionComprobacion: 'mensaje' debe ser un string no vacío; ` +
        `recibido ${describir(mensaje)}.`,
    )
  }
  const det = { tipo, mensaje, severidad }
  if (datos !== undefined) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new TypeError(
        `crearDeteccionComprobacion: 'datos' debe ser un objeto plano o estar ausente; ` +
          `recibido ${describir(datos)}.`,
      )
    }
    det.datos = datos
  }
  return det
}

// ── «Qué es este fichero», en castellano de persona ──────────────────────────

/**
 * Rótulo y explicación de cada dialecto, PRESENTABLES TAL CUAL.
 *
 * `etiqueta` es el titular corto del cajón; `queSignifica` es la frase que le dice
 * al técnico qué puede hacer con ese fichero. Ninguna de las dos afirma que el
 * fichero esté bien o mal: dicen qué es y qué se puede hacer con él (regla de oro 9).
 *
 * La tabla se escribe aquí y no se deriva de `DIALECTOS[].motivo` porque ese texto
 * está redactado para el programador —cita namespaces, «override O10» y «SPEC §1»—
 * y enseñárselo a un técnico sería un error de producto. Un test afirma que esta
 * tabla cubre TODAS las claves de `gml/_comun.js#DIALECTO`, incluida
 * `DESCONOCIDO`, para que añadir un dialecto sexto no deje el cajón mudo.
 *
 * @readonly
 * @type {Readonly<Record<string, {etiqueta: string, queSignifica: string}>>}
 */
export const ETIQUETAS_DIALECTO = Object.freeze({
  [DIALECTO.CP_4_0_ENTREGA]: Object.freeze({
    etiqueta: 'Parcela catastral · formato 4.0, sobre de entrega',
    queSignifica:
      'Es el formato que la Sede Electrónica admite para subir, y en el sobre que ella ' +
      'espera: el mismo que produce la plantilla oficial de la Dirección General del ' +
      'Catastro.',
  }),
  [DIALECTO.CP_4_0_WFS]: Object.freeze({
    etiqueta: 'Parcela catastral · formato 4.0, descarga del servicio',
    queSignifica:
      'Es lo que devuelve el servicio de descarga del Catastro. Se lee sin problema, pero ' +
      'tal cual NO se puede presentar en la Sede: su validador no reconoce esta envoltura y ' +
      'el fichero muere en la primera línea. Si hay que presentarlo, vuelve a generarlo ' +
      'desde aquí.',
  }),
  [DIALECTO.CP_3_0]: Object.freeze({
    etiqueta: 'Parcela catastral · formato 3.0, el de 2015',
    queSignifica:
      'Es la versión anterior del formato y la Sede ya no la admite. La parcela se lee ' +
      'igual: puedes verla, contrastarla con el parcelario y volver a generarla en 4.0.',
  }),
  [DIALECTO.BU]: Object.freeze({
    etiqueta: 'GML de edificio (construcción)',
    queSignifica:
      'No es un fichero equivocado: habla de la CONSTRUCCIÓN, no del lindero de la parcela. ' +
      'El contraste de edificio todavía no existe en esta aplicación, así que aquí no hay ' +
      'parcela que comprobar y no se encamina a ninguna parte.',
  }),
  [DIALECTO.DESCONOCIDO]: Object.freeze({
    etiqueta: 'Formato no reconocido',
    queSignifica:
      'El fichero no es un GML de parcela ni de edificio de los que esta aplicación ' +
      'reconoce. Puede que no sea XML, o que sea XML de otra cosa. Abajo está, literalmente, ' +
      'lo que se ha encontrado al abrirlo.',
  }),
})

/**
 * El par `{etiqueta, queSignifica}` de un dialecto, con reserva EXPLÍCITA para el
 * caso imposible: si alguien añade un dialecto a `gml/_comun.js#DIALECTO` y olvida
 * esta tabla, el cajón dice que no sabe describirlo en vez de quedarse en blanco
 * (regla de oro 1). El test que ata las dos tablas hace que ese texto no llegue a
 * verse nunca; existe para que el día que se vea, se entienda.
 *
 * @param {string} id  Clave de `gml/_comun.js#DIALECTO`.
 * @returns {{etiqueta: string, queSignifica: string}}
 */
export function etiquetaDialecto(id) {
  return (
    ETIQUETAS_DIALECTO[id] ?? {
      etiqueta: `Dialecto «${id}», sin descripción`,
      queSignifica:
        `El lector de GML clasifica este fichero como «${id}», pero la capa de comprobación ` +
        'no tiene escrito qué significa eso. Es un fallo del programa, no del fichero.',
    }
  )
}

// ── Presentación de números (salida, no modelo) ──────────────────────────────

/**
 * Un número para un MENSAJE, en castellano: coma decimal y dos decimales como
 * mucho, sin ceros de relleno ni separador de millares.
 *
 * Redondear aquí no contradice la regla de oro 11 («el modelo en float64 completo;
 * redondear solo al SALIR»): esto es exactamente una salida. El valor sin tocar
 * viaja siempre en `datos` de la detección y en los campos numéricos de la
 * comprobación, que es lo que consumen el diagnóstico y el informe.
 *
 * No se usa `Intl.NumberFormat`: el resultado dependería de los datos de locale
 * instalados, y un mensaje que cambia de una máquina a otra no se puede afirmar en
 * un test. Aquí el formato es el mismo en todas partes, siempre.
 *
 * @param {number} n
 * @param {number} [decimales=2]
 * @returns {string}
 */
export function numero(n, decimales = 2) {
  if (!Number.isFinite(n)) return String(n)
  const fijo = n.toFixed(decimales)
  // Quita los ceros de relleno del final (y la coma si se queda sola): «236,00»
  // se lee peor que «236», y «1535,87» tiene que conservar sus dos cifras.
  const limpio = decimales > 0 ? fijo.replace(/\.?0+$/, '') : fijo
  return (limpio === '' || limpio === '-' ? fijo : limpio).replace('.', ',')
}

/**
 * Cuántos decimales trae ESCRITO un número. Es la precisión con la que el fichero
 * declara su superficie, y de ahí sale el cotejo de C1 sin inventarse ninguna
 * tolerancia: ver `comprobacion/gml.js`.
 *
 * @param {number} n
 * @returns {number}
 */
export function decimalesDe(n) {
  if (!Number.isFinite(n)) return 0
  const s = String(n)
  // Notación exponencial («1e-7»): no es un caso que produzca `cp:areaValue`, y
  // contar caracteres tras el punto daría 0 cuando la verdad es «muchos». Se
  // devuelve el máximo que se compara más abajo en vez de mentir por defecto.
  if (s.includes('e') || s.includes('E')) return 15
  const punto = s.indexOf('.')
  return punto === -1 ? 0 : s.length - punto - 1
}

// ── Guardas de contrato (el `throw` es del PROGRAMADOR, SPEC §2.1) ───────────

/** Describe un valor para el mensaje de un `throw`: tipo + valor si es serializable. */
export function describir(valor) {
  if (valor === undefined) return 'undefined'
  if (typeof valor === 'function') return 'function'
  try {
    const json = JSON.stringify(valor)
    return json === undefined ? String(valor) : `${typeof valor} ${json}`
  } catch {
    return `${typeof valor} (no serializable)`
  }
}

/**
 * Contrato del llamante: `opciones` es un objeto llano.
 *
 * Existe por el mismo motivo que su gemela de `diagnostico/_comun.js`: sin esta
 * guarda, un `comprobarGml(texto)` con el string suelto desestructuraría la cadena,
 * `texto` saldría `undefined` y la comprobación entera se iría al camino de «esto
 * no es XML» — en verde y culpando al fichero del usuario de un bug del programa.
 *
 * @param {unknown} opciones
 * @param {string} fn
 * @param {string} [forma='un objeto de opciones']
 */
export function exigirOpciones(opciones, fn, forma = 'un objeto de opciones') {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(`${fn}: se esperaba ${forma}; recibido ${describir(opciones)}.`)
  }
}

/**
 * Contrato del llamante: `texto` es un string. Un GML ilegible NO es esto —eso son
 * detecciones—; esto es haberse dejado el `await`, o pasar los bytes sin
 * decodificar. Que es justo el error que `gml/decodificar.js` existe para impedir.
 *
 * @param {unknown} texto
 * @param {string} fn
 */
export function exigirTexto(texto, fn) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `${fn}: 'texto' debe ser el documento GML como string YA DECODIFICADO; recibido ` +
        `${describir(texto)}. Si tienes los bytes, pásalos antes por ` +
        '`gml/decodificar.js#decodificarGml`: decidir el encoding es suyo, no de aquí.',
    )
  }
}

/**
 * Contrato del llamante: `nombreFichero` es un string no vacío. Se exige porque es
 * lo ÚNICO que identifica al fichero en el cajón y en el informe: una comprobación
 * anónima no se puede citar en un expediente.
 *
 * @param {unknown} nombre
 * @param {string} fn
 */
export function exigirNombreFichero(nombre, fn) {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    throw new TypeError(
      `${fn}: 'nombreFichero' debe ser un string no vacío; recibido ${describir(nombre)}. ` +
        'Es lo único que identifica al fichero en el cajón y en el informe de contraste.',
    )
  }
}

/**
 * Contrato del llamante: `bytes` es el TAMAÑO (entero ≥ 0) o `null`.
 *
 * El mensaje nombra el error probable —pasar el búfer en vez de su longitud—
 * porque el nombre del parámetro invita a cometerlo.
 *
 * @param {unknown} bytes
 * @param {string} fn
 */
export function exigirTamano(bytes, fn) {
  if (bytes === null) return
  if (!Number.isInteger(bytes) || bytes < 0) {
    throw new TypeError(
      `${fn}: 'bytes' debe ser el TAMAÑO del fichero (entero ≥ 0) o null; recibido ` +
        `${describir(bytes)}. Si lo que tienes es el búfer, pasa su '.byteLength': aquí ` +
        'el dato solo se usa para el rótulo.',
    )
  }
}

/**
 * Contrato del llamante: `indiceElegido` es un entero ≥ 0. Que APUNTE a una parcela
 * existente se comprueba después, cuando ya se sabe cuántas hay.
 *
 * @param {unknown} indice
 * @param {string} fn
 */
export function exigirIndice(indice, fn) {
  if (!Number.isInteger(indice) || indice < 0) {
    throw new TypeError(
      `${fn}: 'indiceElegido' debe ser un entero ≥ 0; recibido ${describir(indice)}.`,
    )
  }
}

/**
 * Contrato del llamante: `deteccionesPrevias` es un array de detecciones con la
 * forma común (`{tipo, mensaje, severidad}`). Se comprueba la FORMA y no el
 * catálogo, a propósito: aquí llegan las de `gml/decodificar.js` hoy y las de los
 * parsers de CAD el día que F01 se enchufe a esta misma zona de entrada, y sus
 * catálogos son distintos por diseño.
 *
 * @param {unknown} detecciones
 * @param {string} fn
 */
export function exigirDetecciones(detecciones, fn) {
  if (!Array.isArray(detecciones)) {
    throw new TypeError(
      `${fn}: 'deteccionesPrevias' debe ser un array; recibido ${describir(detecciones)}.`,
    )
  }
  detecciones.forEach((d, i) => {
    const bien =
      d !== null &&
      typeof d === 'object' &&
      typeof d.tipo === 'string' &&
      typeof d.mensaje === 'string' &&
      (d.severidad === 'INFO' || d.severidad === 'AVISO' || d.severidad === 'ERROR')
    if (!bien) {
      throw new TypeError(
        `${fn}: deteccionesPrevias[${i}] debe ser {tipo, mensaje, severidad}; ` +
          `recibido ${describir(d)}.`,
      )
    }
  })
}
