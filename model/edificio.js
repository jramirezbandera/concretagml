// model/edificio.js — Modelo de datos de la rama EDIFICIO (F00 · Cimientos).
//
// Modela el esquema INSPIRE Buildings 2D extendido del Catastro (plan §4.2).
// Es de DOS niveles: las partes (`ParteConstruccion`, que el usuario dibuja y
// etiqueta) y el edificio (`Edificio`).
//
// Reglas de oro aplicables (SPEC §2):
//   · #1  Ningún error silencioso: los valores de dominio (modelo, tipo, origen,
//         estadoConservacion) se VALIDAN y lanzan si no son válidos. Un typo en
//         `modelo` NO puede degradar en silencio a SIMPLIFICADO (auditoría A4).
//   · #2  La geometría oficial (`construccionOficial`) se conserva INTACTA:
//         copia independiente + congelación profunda (como `geometriaOficial`
//         en model/parcela.js). Intacta LITERAL: se copia sin renormalizar.
//   · #3  Modelo en UTM siempre: coords `[x, y]`, nunca lat/lon.
//   · #4  Modelo = POJO plano: sin métodos, sin clases; sobrevive a
//         `structuredClone` (undo/redo) porque no hay funciones ni prototipos.
//   · #11 Precisión float64 completa en el modelo; el redondeo es de salida.
//
// Override O11 (SPEC §3): una parte por volumen de altura homogénea, cada una
// con huella propia + plantas sobre/bajo rasante independientes.
//
// IMPORTANTE (alcance F00): esto es SOLO el shape/factories + invariantes. La
// ENVOLVENTE DERIVADA del edificio (unión de contornos sobre rasante) se calcula
// en F12 y NO se almacena como geometría propia: guardarla rompería el modelo.
// El `Recinto` se trata como objeto plano recibido (o `null`); NO se importa
// `model/parcela.js` (las ramas del modelo se mantienen independientes).

/** Modelo de serialización del edificio (plan §14.1). */
export const MODELO_EDIFICIO = Object.freeze({
  SIMPLIFICADO: 'SIMPLIFICADO', // ICUC: solo geometría, RC y estado.
  COMPLETO: 'COMPLETO', // Incluye los atributos semánticos del edificio.
})

/** Tipo de parte de construcción. `OTRA` = piscina y similares (sin plantas). */
export const TIPO_PARTE = Object.freeze({
  PRINCIPAL: 'PRINCIPAL',
  OTRA: 'OTRA',
})

/** Estado de conservación del edificio (solo modelo COMPLETO). */
export const ESTADO_CONSERVACION = Object.freeze({
  FUNCIONAL: 'FUNCIONAL',
  EN_CONSTRUCCION: 'EN_CONSTRUCCION',
  RUINOSO: 'RUINOSO',
  DERRUIDO: 'DERRUIDO',
})

/** Procedencia de la geometría de una parte. */
export const ORIGEN_PARTE = Object.freeze({
  DXF: 'DXF',
  LIST: 'LIST',
  TXT: 'TXT',
  GML_EXISTENTE: 'GML_EXISTENTE',
  WFS: 'WFS',
  DIBUJADA: 'DIBUJADA',
})

// Claves de los atributos semánticos que SOLO existen en modelo COMPLETO.
// En SIMPLIFICADO ni se piden ni se serializan (plan §4.2, convenios).
const ATRIBUTOS_COMPLETO = [
  'usoDominante',
  'estadoConservacion',
  'anioConstruccion',
  'anioReforma',
  'numeroInmuebles',
  'numeroViviendas',
  'superficieConstruida',
]

// ── Helpers internos ─────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

const esNumeroFinitoONull = (n) => n === null || esNumeroFinito(n)

/**
 * Congela en profundidad (duplicado deliberado del helper de model/parcela.js:
 * las ramas del modelo no se importan entre sí). En modo estricto cualquier
 * intento de mutación lanza TypeError: "construccionOficial NUNCA se muta"
 * pasa de promesa a barrera comprobable (regla 2, auditoría A4).
 */
function deepFreeze(valor) {
  if (Array.isArray(valor)) {
    for (const el of valor) deepFreeze(el)
    return Object.freeze(valor)
  }
  if (valor && typeof valor === 'object') {
    for (const k of Object.keys(valor)) deepFreeze(valor[k])
    return Object.freeze(valor)
  }
  return valor
}

/** Valida (ligero) que un recinto recibido sea `{vertices: Array}` o null. */
function validarRecintoPlano(recinto, contexto) {
  if (recinto === null) return null
  if (!recinto || typeof recinto !== 'object' || !Array.isArray(recinto.vertices)) {
    throw new TypeError(
      `${contexto}: 'recinto' debe ser null o un objeto plano {vertices:[[x,y],...], tipo}; ` +
        `recibido ${JSON.stringify(recinto)}.`,
    )
  }
  // Copia defensiva (POJO plano): el modelo no comparte referencias con la entrada.
  return structuredClone(recinto)
}

// ── Factories ────────────────────────────────────────────────────────────────

/**
 * Crea una ParteConstruccion (POJO plano).
 *
 * Invariante O11 / plan §4.2: las partes de tipo `OTRA` (piscinas) NO llevan
 * plantas — sus campos de plantas quedan en `null`, nunca `0`, aunque se pasen.
 * Las plantas van POR PARTE, nunca por edificio.
 *
 * Validación (regla 1, auditoría A4): `tipo` y `origen` se comprueban contra
 * sus constantes y LANZAN si no son válidos — un `tipo` desconocido no se trata
 * en silencio como PRINCIPAL.
 *
 * @param {object} args
 * @param {string} args.nombre                          Rótulo editable ("cuerpo principal", "porche"...).
 * @param {'PRINCIPAL'|'OTRA'} [args.tipo='PRINCIPAL']
 * @param {object|null} [args.recinto=null]             Recinto `{vertices,tipo}` o `null` (pendiente de dibujar).
 * @param {number|null} [args.plantasSobreRasante=null]
 * @param {number|null} [args.plantasBajoRasante=null]
 * @param {'DXF'|'LIST'|'TXT'|'GML_EXISTENTE'|'WFS'|'DIBUJADA'} args.origen
 * @returns {object} ParteConstruccion
 */
export function crearParteConstruccion({
  nombre,
  tipo = TIPO_PARTE.PRINCIPAL,
  recinto = null,
  plantasSobreRasante = null,
  plantasBajoRasante = null,
  origen,
} = {}) {
  if (typeof nombre !== 'string' || nombre.length === 0) {
    throw new TypeError(
      `crearParteConstruccion: 'nombre' es obligatorio (string no vacío); recibido ${JSON.stringify(nombre)}.`,
    )
  }
  const tiposValidos = Object.values(TIPO_PARTE)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearParteConstruccion: 'tipo' inválido: ${JSON.stringify(tipo)}. Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const origenesValidos = Object.values(ORIGEN_PARTE)
  if (!origenesValidos.includes(origen)) {
    throw new RangeError(
      `crearParteConstruccion: 'origen' inválido: ${JSON.stringify(origen)}. Válidos: ${origenesValidos.join(', ')}.`,
    )
  }
  if (!esNumeroFinitoONull(plantasSobreRasante) || !esNumeroFinitoONull(plantasBajoRasante)) {
    throw new TypeError(
      `crearParteConstruccion: las plantas deben ser número finito o null; recibido ` +
        `sobre=${JSON.stringify(plantasSobreRasante)}, bajo=${JSON.stringify(plantasBajoRasante)}.`,
    )
  }

  const esOtra = tipo === TIPO_PARTE.OTRA
  return {
    nombre,
    tipo,
    recinto: validarRecintoPlano(recinto, 'crearParteConstruccion'),
    // Piscina y similares: sin plantas (null, nunca 0), aunque se pasen valores.
    plantasSobreRasante: esOtra ? null : plantasSobreRasante,
    plantasBajoRasante: esOtra ? null : plantasBajoRasante,
    origen,
  }
}

/**
 * Crea un Edificio (POJO plano).
 *
 * En modelo `SIMPLIFICADO` se OMITEN (quedan `undefined`, sin clave) los
 * atributos semánticos del edificio; solo aparecen en `COMPLETO`. La envolvente
 * del edificio NO se guarda: es derivada (F12).
 *
 * ── `idLocal`: LA IDENTIDAD, Y POR QUÉ AQUÍ ADMITE `null` Y EN PARCELA NO ────
 * F12 · T1.1. Sin identidad un `Edificio` no se puede archivar ni autoguardar:
 * `crearExpediente` (`model/parcela.js`) ya admite `tipo:'EDIFICIO'` desde F00,
 * y el borrador de `storage/expedientes.js` es un registro de clave reservada.
 * Esto levanta a propósito la desviación 2 de F11 («`model/edificio.js` no se
 * toca»), y se levanta por su nombre.
 *
 * ⚠️ **Y es asimétrico con `crearParcela`, que lo exige.** Aquí puede ser
 * `null`, y la asimetría es la respuesta honrada a un hecho: una parcela entra
 * siempre desde una procedencia que trae con qué nombrarla (el `localId` del
 * GML, la referencia catastral, el nombre del fichero), pero un edificio puede
 * empezar **vacío**, con el técnico añadiendo partes a mano antes de que exista
 * ningún documento del que sacar un nombre. Exigirlo obligaría a **inventarlo**,
 * que es justo lo que la regla de oro 9 prohíbe; un identificador inventado que
 * acierta a veces es peor que no tenerlo, porque nadie vuelve a revisarlo.
 *
 * `null` significa **«todavía no se puede archivar»**, y quien lo consuma tiene
 * que decirlo en vez de callarlo. Lo que NO puede pasar es que valga `''` o un
 * puñado de espacios: eso sí sería una identidad falsa con aspecto de identidad,
 * y por eso LANZA.
 *
 * Validación (regla 1, auditoría A4): `modelo` se comprueba contra
 * MODELO_EDIFICIO y LANZA si no es válido — un typo no puede degradar en
 * silencio al comportamiento SIMPLIFICADO (que omite atributos).
 *
 * Copias (regla 2/4, auditoría A4):
 *   · `partes` se re-crean vía crearParteConstruccion (validación + copia).
 *   · `parcelaContexto` se copia en profundidad (structuredClone).
 *   · `construccionOficial` se copia en profundidad y se CONGELA (deepFreeze):
 *     intacta literal, sin renormalizar (es el término de comparación, regla 2).
 *
 * @param {object} [args]
 * @param {string|null} [args.idLocal=null]                   Identidad local, o `null`
 *   («todavía no se puede archivar»). Nunca `''` ni solo espacios: eso LANZA.
 * @param {string|null} [args.refcat=null]
 * @param {'SIMPLIFICADO'|'COMPLETO'} [args.modelo='SIMPLIFICADO']
 * @param {object[]} [args.partes=[]]
 * @param {object[]|null} [args.parcelaContexto=null]        Recinto[] de la parcela (WFS).
 * @param {object[]|null} [args.construccionOficial=null]    Copia congelada (regla 2).
 * @param {string} [args.usoDominante]                       Solo COMPLETO.
 * @param {'FUNCIONAL'|'EN_CONSTRUCCION'|'RUINOSO'|'DERRUIDO'} [args.estadoConservacion] Solo COMPLETO.
 * @param {number} [args.anioConstruccion]                   Solo COMPLETO.
 * @param {number|null} [args.anioReforma]                   Solo COMPLETO.
 * @param {number} [args.numeroInmuebles]                    Solo COMPLETO.
 * @param {number} [args.numeroViviendas]                    Solo COMPLETO.
 * @param {number} [args.superficieConstruida]               Solo COMPLETO.
 * @returns {object} Edificio
 */
export function crearEdificio({
  idLocal = null,
  refcat = null,
  modelo = MODELO_EDIFICIO.SIMPLIFICADO,
  partes = [],
  parcelaContexto = null,
  construccionOficial = null,
  usoDominante,
  estadoConservacion,
  anioConstruccion,
  anioReforma,
  numeroInmuebles,
  numeroViviendas,
  superficieConstruida,
} = {}) {
  const modelosValidos = Object.values(MODELO_EDIFICIO)
  if (!modelosValidos.includes(modelo)) {
    throw new RangeError(
      `crearEdificio: 'modelo' inválido: ${JSON.stringify(modelo)}. Válidos: ${modelosValidos.join(', ')}.`,
    )
  }
  if (refcat !== null && typeof refcat !== 'string') {
    throw new TypeError(`crearEdificio: 'refcat' debe ser string o null; recibido ${typeof refcat}.`)
  }
  // `null` es un estado legítimo («aún no se puede archivar»); un texto vacío o
  // en blanco NO lo es: sería una identidad falsa con aspecto de identidad, y el
  // día que se archivara pisaría a otro registro sin decir nada.
  if (idLocal !== null && (typeof idLocal !== 'string' || idLocal.trim().length === 0)) {
    throw new TypeError(
      `crearEdificio: 'idLocal' debe ser un texto no vacío o null (todavía sin identidad); ` +
        `recibido ${JSON.stringify(idLocal)}.`,
    )
  }
  if (!Array.isArray(partes)) {
    throw new TypeError(`crearEdificio: 'partes' debe ser un array; recibido ${typeof partes}.`)
  }
  if (parcelaContexto !== null && !Array.isArray(parcelaContexto)) {
    throw new TypeError(
      `crearEdificio: 'parcelaContexto' debe ser un array de recintos o null; recibido ${typeof parcelaContexto}.`,
    )
  }
  if (construccionOficial !== null && !Array.isArray(construccionOficial)) {
    throw new TypeError(
      `crearEdificio: 'construccionOficial' debe ser un array de partes o null; recibido ${typeof construccionOficial}.`,
    )
  }

  const edificio = {
    idLocal,
    refcat,
    modelo,
    // Copia defensiva + validación de cada parte (simétrico a crearParcela).
    partes: partes.map((p) => crearParteConstruccion(p)),
    parcelaContexto: parcelaContexto === null ? null : structuredClone(parcelaContexto),
    // Intacta LITERAL (sin renormalizar) + congelada: barrera de la regla 2.
    construccionOficial:
      construccionOficial === null ? null : deepFreeze(structuredClone(construccionOficial)),
  }

  // Los atributos semánticos SOLO existen en modelo COMPLETO. En SIMPLIFICADO
  // no se añaden las claves (quedan `undefined`). Los no aportados se fijan a
  // `null` ("aún no conocido") para que el shape COMPLETO sea estable.
  if (modelo === MODELO_EDIFICIO.COMPLETO) {
    if (usoDominante !== undefined && usoDominante !== null && typeof usoDominante !== 'string') {
      throw new TypeError(
        `crearEdificio: 'usoDominante' debe ser string o null; recibido ${typeof usoDominante}.`,
      )
    }
    const estadosValidos = Object.values(ESTADO_CONSERVACION)
    if (
      estadoConservacion !== undefined &&
      estadoConservacion !== null &&
      !estadosValidos.includes(estadoConservacion)
    ) {
      throw new RangeError(
        `crearEdificio: 'estadoConservacion' inválido: ${JSON.stringify(estadoConservacion)}. ` +
          `Válidos: ${estadosValidos.join(', ')}.`,
      )
    }
    for (const [clave, valor] of Object.entries({
      anioConstruccion,
      anioReforma,
      numeroInmuebles,
      numeroViviendas,
      superficieConstruida,
    })) {
      if (valor !== undefined && !esNumeroFinitoONull(valor)) {
        throw new TypeError(
          `crearEdificio: '${clave}' debe ser número finito o null; recibido ${JSON.stringify(valor)}.`,
        )
      }
    }

    edificio.usoDominante = usoDominante ?? null
    edificio.estadoConservacion = estadoConservacion ?? null
    edificio.anioConstruccion = anioConstruccion ?? null
    edificio.anioReforma = anioReforma ?? null
    edificio.numeroInmuebles = numeroInmuebles ?? null
    edificio.numeroViviendas = numeroViviendas ?? null
    edificio.superficieConstruida = superficieConstruida ?? null
  }

  return edificio
}

// Exportado para tests/validación: las claves semánticas exclusivas de COMPLETO.
export { ATRIBUTOS_COMPLETO }
