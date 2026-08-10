// derivacion/_comun.js — F17 · El vocabulario de la capa que DERIVA geometría.
//
// Contrato **D** del proyecto, quinta copia: `{tipo, mensaje, severidad, datos?}`,
// exactamente la misma forma que `parsers/_comun.js`, `gml/_comun.js`,
// `export/_comun.js` y `edificio/_comun.js`. La interfaz pinta las cinco con el
// mismo componente y sin adaptador.
//
// ── POR QUÉ UNA QUINTA COPIA Y NO UN MÓDULO COMPARTIDO ──────────────────────
// La pregunta se hizo al planear F17 y la respuesta sigue siendo la de F01: el
// léxico de TIPOS es lo que impide que una detección de una capa se cuele en otra.
// `crearDeteccionDerivacion('HUECO_EXPORTADO', …)` es un `RangeError` hoy, y con un
// `TIPO_DETECCION` común sería un mensaje que la interfaz no sabe interpretar
// —mudo, que es lo que prohíbe la regla de oro 1—.
//
// Lo que SÍ se duplica sin ganancia es `SEVERIDAD` y la validación de la fábrica.
// F17 no las extrae, y la razón está medida en el plan: sacar el contrato común
// metería `parsers/`, `gml/`, `export/` y `edificio/` —con sus cuatro suites— en un
// diff que va de restar polígonos. **Lo que sí entra es el guardián**: un test que
// ata las cinco copias (mismos `SEVERIDAD`, mismo rechazo ante entrada mala), que
// compra la protección sin el refactor. Hasta hoy había cuatro fábricas copiadas a
// mano y nada que las comparase.
//
// Módulo PURO: sin DOM, sin Leaflet, sin turf, sin estado y sin reloj.

// ── Severidad ────────────────────────────────────────────────────────────────

/**
 * Severidad de una detección. Misma escala que las otras cuatro capas: `INFO` no
 * cambia nada, `AVISO` pide mirar, `ERROR` bloquea. La duplicación está razonada
 * en la cabecera y la vigila `test/contrato.test.js`.
 *
 * @readonly
 */
export const SEVERIDAD = Object.freeze({
  INFO: 'INFO',
  AVISO: 'AVISO',
  ERROR: 'ERROR',
})

// ── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Tipos de detección de la capa de DERIVACIÓN. Vocabulario completo desde ya,
 * aunque la tarea 1.2 solo emita los tres primeros: `cesion.js` (2.1) y
 * `entrega.js` (3.1) hablan este mismo idioma, igual que hicieron los cuatro
 * léxicos anteriores.
 *
 * @readonly
 */
export const TIPO_DERIVACION = Object.freeze({
  /** El motor booleano LANZÓ con una geometría que no pudo digerir. */
  RESTA_FALLIDA: 'RESTA_FALLIDA',
  /** Una región no se pudo construir: faltaba exterior o venía degenerada. */
  REGION_NO_APTA: 'REGION_NO_APTA',
  /** La resta salió vacía: no hay sobrante. NO es un error, es una respuesta. */
  SIN_SOBRANTE: 'SIN_SOBRANTE',
  /** Una pieza cae por debajo del umbral de grosor: se LISTA, no se descarta sola. */
  PIEZA_ESTRECHA: 'PIEZA_ESTRECHA',
  /**
   * Una pieza NO SOBREVIVE al fichero: escrita con 2 decimales deja de encerrar
   * superficie, así que no puede ser una parcela.
   *
   * ⛔ **No es lo mismo que `PIEZA_ESTRECHA` y por eso no lo reutiliza.** «Estrecha»
   * es un juicio con umbral —quien firma decide si esa franja es finca o ruido— y
   * `cesion.js` la lista a propósito para que decida. Esto de aquí no es un juicio:
   * es que el `cp:referencePoint` no existe, y sin él la Sede rechaza el fichero.
   * Mezclarlos habría dejado al usuario «decidiendo» sobre algo que no se puede
   * hacer.
   */
  PIEZA_NO_EMITIBLE: 'PIEZA_NO_EMITIBLE',
  /** La parcela editada NO está contenida en la oficial: la puerta de la fase 1. */
  CRECE_FUERA: 'CRECE_FUERA',
  /** No hay `geometriaOficial` contra la que restar (dibujo a mano, DXF, TXT). */
  SIN_GEOMETRIA_OFICIAL: 'SIN_GEOMETRIA_OFICIAL',
  // ── Los de la ENTREGA (fase 3), que la fase 2 no podía prever ─────────────
  // ⚠️ El JSDoc de arriba decía «vocabulario COMPLETO desde ya», y lo era para lo
  // que la fase 1 sabía: los seis de arriba son los de MEDIR el sobrante. Estos
  // cuatro son de ARMAR el expediente, que es una pregunta distinta —qué entra en
  // el fichero, si cierra, y si cada pieza pasa la validación—, y no se podían
  // nombrar antes de que existiera `entrega.js`. Se añaden en vez de reinterpretar
  // los de arriba: `REGION_NO_APTA` significa «no se pudo construir la geometría»
  // y estirarlo a «la pieza no valida» dejaría a la interfaz sin poder distinguir
  // un fallo del motor de un lindero que se cruza consigo mismo.
  /** El expediente sale: se ha mirado todo y no hay nada que impida entregarlo. */
  ENTREGA_LISTA: 'ENTREGA_LISTA',
  /** Una pieza incluida NO pasa `validation/parcela.js`: no puede ir al fichero. */
  PIEZA_INVALIDA: 'PIEZA_INVALIDA',
  /** El usuario ha dejado fuera una pieza del sobrante. Se dice SIEMPRE. */
  PIEZA_EXCLUIDA: 'PIEZA_EXCLUIDA',
  /** Lo que se va a entregar NO cubre el contorno oficial: el IVG saldría negativo. */
  CONJUNTO_NO_CIERRA: 'CONJUNTO_NO_CIERRA',
  // ── Los del COLINDANTE RECORTADO (F23), que las fases 2 y 3 no podían prever ──
  // Nacen con `derivacion/vecino.js` y son de una pregunta nueva: no «qué suelta mi
  // parcela» ni «qué entra en el fichero», sino **a quién le quita terreno la
  // medición**. Reinterpretar `CRECE_FUERA` para esto sería perder la distinción
  // que hace útil al aviso: aquél dice que la parcela se sale, y éstos dicen de
  // quién y cuánto.
  /** No se han traído las colindantes: no se puede afirmar a quién se le quita. */
  VECINAS_SIN_CONSULTAR: 'VECINAS_SIN_CONSULTAR',
  /** El motor no pudo recortar a un colindante concreto. Falta una medición. */
  RECORTE_FALLIDO: 'RECORTE_FALLIDO',
  /** La medición corta a un colindante en piezas disjuntas: la mayor se queda la RC. */
  VECINO_PARTIDO: 'VECINO_PARTIDO',
  /** Exceso que no solapa NINGUNA colindante: vial o dominio público. Se declara. */
  FUERA_SOBRE_NADIE: 'FUERA_SOBRE_NADIE',
  /** Se ha asignado un trozo del sobrante a un vecino con el que NO linda. */
  ASIGNACION_IMPOSIBLE: 'ASIGNACION_IMPOSIBLE',
  /**
   * A un colindante solo se le quita una franja más fina que el redondeo del
   * fichero: **no se le recorta y NO entra en el expediente**, pero se dice.
   *
   * El parcelario del Catastro no es topológicamente limpio (medido: hasta 5 mm de
   * solape entre vecinas oficiales), así que enganchar un lindero deja franjas de
   * milímetros contra parcelas que nadie ha tocado. Meterlas en el expediente sería
   * **modificar la finca de un tercero por el ruido del redondeo**, que es
   * exactamente lo que no se le puede mandar a la Sede.
   */
  VECINO_SOLO_REDONDEO: 'VECINO_SOLO_REDONDEO',
})

/**
 * Por qué una resta no se pudo medir. Los valores de `saltados[i].motivo` que
 * añade ESTA capa; los de construcción de región vienen tal cual de
 * `geo/poligono.js#MOTIVO_REGION` y no se renombran, porque son el mismo hecho.
 *
 * @readonly
 */
export const MOTIVO_RESTA = Object.freeze({
  /** `@turf/difference` lanzó. Sale por aquí, NUNCA por la consola. */
  MOTOR_BOOLEANO: 'MOTOR_BOOLEANO',
})

// ── Detección ────────────────────────────────────────────────────────────────

/**
 * Una detección de la capa de derivación. POJO plano, misma forma que las de
 * `parsers/`, `gml/`, `export/` y `edificio/`.
 *
 * @typedef {Object} DeteccionDerivacion
 * @property {string} tipo  Una de las claves de {@link TIPO_DERIVACION}.
 * @property {string} mensaje  Texto legible en español, para la interfaz.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad  Ver {@link SEVERIDAD}.
 * @property {object} [datos]  Datos estructurados opcionales (objeto plano).
 */

/**
 * Crea una {@link DeteccionDerivacion} validando `tipo` y `severidad`. **LANZA**
 * si cualquiera es inválido: una detección con un tipo que la interfaz no sabe
 * interpretar es una detección muda.
 *
 * @param {string} tipo  Una de las claves/valores de {@link TIPO_DERIVACION}.
 * @param {string} mensaje  Texto no vacío, en español.
 * @param {'INFO'|'AVISO'|'ERROR'} severidad
 * @param {object} [datos]  Objeto plano con el detalle estructurado.
 * @returns {DeteccionDerivacion}
 * @throws {RangeError}  Si `tipo` o `severidad` no están en su catálogo.
 * @throws {TypeError}   Si `mensaje` no es texto no vacío o `datos` no es objeto plano.
 */
export function crearDeteccionDerivacion(tipo, mensaje, severidad, datos) {
  const tiposValidos = Object.values(TIPO_DERIVACION)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccionDerivacion: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const sevsValidas = Object.values(SEVERIDAD)
  if (!sevsValidas.includes(severidad)) {
    throw new RangeError(
      `crearDeteccionDerivacion: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${sevsValidas.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccionDerivacion: 'mensaje' debe ser un texto no vacío; recibido ${JSON.stringify(mensaje)}.`,
    )
  }
  const d = { tipo, mensaje, severidad }
  if (datos !== undefined) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new TypeError(
        `crearDeteccionDerivacion: 'datos' debe ser un objeto plano o estar ausente; ` +
          `recibido ${JSON.stringify(datos)}.`,
      )
    }
    d.datos = datos
  }
  return d
}

/**
 * Recuento de detecciones por tipo y por severidad. **Misma forma y misma
 * implementación** que las otras cuatro capas, para que la interfaz no tenga cinco
 * maneras de contar lo mismo. Copiada y no importada, por el motivo de la
 * cabecera; el guardián de `test/contrato.test.js` comprueba que las cinco dan
 * exactamente el mismo objeto ante la misma entrada.
 *
 * @param {DeteccionDerivacion[]} detecciones
 * @returns {{total: number, porTipo: Record<string, number>, porSeveridad: Record<string, number>}}
 */
export function resumirDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = {}
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1
    porSeveridad[d.severidad] = (porSeveridad[d.severidad] ?? 0) + 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

// ── Presentación de números (SALIDA, no modelo) ──────────────────────────────

/**
 * Un número para un MENSAJE, en castellano: coma decimal y `decimales` como mucho,
 * sin ceros de relleno ni separador de millares.
 *
 * ⚠️ **Segunda copia declarada**, gemela de `comprobacion/_comun.js#numero` y con
 * el mismo cuerpo. Importarla sería una dependencia `derivacion/ → comprobacion/`
 * para redactar un mensaje, y encima al revés: es `comprobacion/conjunto.js` quien
 * consume esta capa, no al contrario. Las dos copias son EL par que pagaría la
 * deuda del `_comun` neutro anotada más abajo.
 *
 * Redondear aquí no contradice la regla de oro 11 («el modelo en float64 completo;
 * redondear solo al SALIR»): esto es exactamente una salida. El valor sin tocar
 * viaja siempre en `datos` de la detección y en los campos numéricos del resultado,
 * que es lo que consumen el comprobador de conjunto y el informe.
 *
 * No se usa `Intl.NumberFormat`: el resultado dependería de los datos de locale
 * instalados, y un mensaje que cambia de una máquina a otra no se puede afirmar en
 * un test.
 *
 * @param {number} n
 * @param {number} [decimales=2]
 * @returns {string}
 */
export function numero(n, decimales = 2) {
  if (!Number.isFinite(n)) return String(n)
  const fijo = n.toFixed(decimales)
  const limpio = decimales > 0 ? fijo.replace(/\.?0+$/, '') : fijo
  return (limpio === '' || limpio === '-' ? fijo : limpio).replace('.', ',')
}

// ── Guardas de contrato (el `throw` es del PROGRAMADOR, SPEC §2.1) ───────────
//
// La frontera es la de siempre y aquí importa más que en ninguna otra capa: un
// dato MALO del usuario —una parcela con un anillo degenerado, un sobrante que no
// se puede medir— sale por `detecciones` y por `saltados`; un CONTRATO ROTO —el
// llamante pasa un string donde va una lista de recintos— LANZA. Confundirlos
// convertiría un bug del programa en una detección que culpa a la geometría del
// usuario, en verde y con toda la confianza.
//
// ── LA SEXTA COPIA DE `describir`, DECLARADA ────────────────────────────────
// Existe ya en `validation/_comun.js`, `viewer/_comun.js`, `edit/_comun.js`,
// `diagnostico/_comun.js` y `comprobacion/_comun.js`. No es un olvido: es la regla
// que este repo se dio en `edit/_comun.js` («unificar ENTRE capas no es el
// alcance»), y la alternativa —importar la de `diagnostico/`— sería una dependencia
// `derivacion/ → diagnostico/` para redactar el mensaje de un `throw`, que es
// exactamente la dependencia al revés que obligó a bajar `distancia` a
// `geo/metrica.js` en F06 y `anilloCerrado` a `geo/poligono.js` en F07. La deuda
// está anotada desde entonces en `spec/feature-07-diagnostico-parcela.md` (un
// `_comun` neutro por debajo de las capas, ~15 líneas movidas y ningún consumidor
// que lo pida); F17 la hereda y la vuelve a escribir en vez de disimularla.

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
 * Sin esta guarda, un `derivarCesion(parcela.recintos)` —el error natural, porque
 * el nombre invita— desestructuraría el array, `recintos` saldría `undefined` y la
 * derivación se iría entera por el camino de «esta parcela no tiene geometría»: en
 * verde, y culpando al expediente del usuario de un bug del programa.
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
 * Contrato del llamante: `recintos` es un array. Que los anillos sean aptos NO se
 * comprueba aquí —eso sale por `saltados`, con su motivo y su sitio—: aquí solo se
 * exige la forma.
 *
 * @param {unknown} recintos
 * @param {string} fn
 * @param {string} [nombre='recintos']
 */
export function exigirRecintos(recintos, fn, nombre = 'recintos') {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `${fn}: '${nombre}' debe ser un array de recintos del modelo (anillos ABIERTOS en ` +
        `UTM, recintos[0] EXTERIOR); recibido ${describir(recintos)}.`,
    )
  }
}

/**
 * Contrato del llamante: un texto no vacío ni en blanco. `porQue` explica para qué
 * sirve el campo, porque un «debe ser un string» a secas no dice qué poner.
 *
 * @param {unknown} valor
 * @param {string} fn
 * @param {string} nombre
 * @param {string} [porQue='']
 */
export function exigirTextoNoVacio(valor, fn, nombre, porQue = '') {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw new TypeError(
      `${fn}: '${nombre}' debe ser un texto no vacío; recibido ${describir(valor)}.` +
        (porQue === '' ? '' : ` ${porQue}`),
    )
  }
}
