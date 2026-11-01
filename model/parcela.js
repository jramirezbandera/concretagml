// model/parcela.js — Modelo de datos de la rama PARCELA (F00 · Cimientos, tarea 2.4).
//
// Todo lo que este módulo produce es un POJO plano: objetos y arrays de
// primitivos, SIN métodos ni instancias de clase. Es un requisito duro del
// modelo (SPEC §2 regla de oro 4): el estado completo se clona con
// `structuredClone` para el undo/redo de `edit/historial.js`, y structuredClone
// no clona funciones ni prototipos.
//
// Convenios que este módulo garantiza (SPEC §2, PLAN §4.1/§4.3):
//   - Coordenadas SIEMPRE en UTM `[x, y]` (Este, Norte). El modelo nunca acepta
//     ni devuelve lat/lon (regla 3). Los detectores de X/Y invertidas o de
//     "geográficas pegadas" viven en `geo/huso.js`, no aquí.
//   - Los anillos se guardan ABIERTOS (sin repetir el vértice de cierre). El
//     cierre se añade sólo al serializar (regla 4, §4.3). Si llega un anillo
//     cerrado se normaliza quitando el duplicado, pero NUNCA en silencio.
//   - `recintos[0]` es SIEMPRE el EXTERIOR; el resto son HUECOS (§4.3).
//   - `geometriaOficial` (la del WFS) se guarda como copia INDEPENDIENTE e
//     intacta y se congela para que NUNCA se mute (regla 2): es el término de
//     comparación del diagnóstico.
//   - `puntosLevantamiento` (los POINT sueltos de un DXF de campo) recibe el
//     MISMO trato —copia independiente y congelada— y por el mismo motivo: nada
//     los edita. No son geometría de la parcela: no se miden, no se serializan y
//     no se diagnostican. Sirven de enganche para dibujar encima, y una parcela
//     puede tenerlos con CERO recintos.

// ── Constantes de dominio ────────────────────────────────────────────────────

/** SRS admitidos: Península + Baleares (husos 29/30/31). Canarias diferido. */
export const SRS_VALIDOS = Object.freeze(['EPSG:25829', 'EPSG:25830', 'EPSG:25831'])

/** Rama del expediente. */
export const TIPO_EXPEDIENTE = Object.freeze({ PARCELA: 'PARCELA', EDIFICIO: 'EDIFICIO' })

/** Tipo de recinto (anillo). `recintos[0]` es EXTERIOR; los huecos van después. */
export const TIPO_RECINTO = Object.freeze({ EXTERIOR: 'EXTERIOR', HUECO: 'HUECO' })

/** Procedencia de la geometría de la parcela. */
export const ORIGEN_PARCELA = Object.freeze({
  WFS: 'WFS',
  LIST: 'LIST',
  TXT: 'TXT',
  DXF: 'DXF',
  GML_EXISTENTE: 'GML_EXISTENTE',
})

// ── Helpers internos ─────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Congela en profundidad un array de recintos (recinto → vertices → par [x,y]).
 * En modo estricto (todo módulo ESM lo es) cualquier intento de mutación lanza
 * TypeError: así "geometriaOficial NUNCA se muta" deja de ser una promesa y pasa
 * a ser una barrera comprobable.
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

/**
 * Valida la invariante estructural: si hay recintos, `recintos[0]` es EXTERIOR y
 * todos los demás son HUECO. Lanza —de forma NO silenciosa— si detecta algo raro
 * (regla 1).
 *
 * ⚠️ Decía «(multiparcela está fuera de alcance)» y **eso caducó el 2026-08-03**
 * (override O18: la Sede acepta un `.gml` con N `gml:featureMember`). El
 * invariante NO cambia y el motivo sí: una `Parcela` es UN exterior con huecos, y
 * varias piezas que no se tocan son varias `Parcela`, cada una con su `idLocal`.
 * El cuerpo de la función ya lo decía bien; esta línea se había quedado atrás.
 */
function validarInvarianteExterior(recintos, contexto) {
  if (recintos.length === 0) return
  if (recintos[0].tipo !== TIPO_RECINTO.EXTERIOR) {
    throw new Error(
      `${contexto}: recintos[0] debe ser el EXTERIOR (regla del modelo §4.3); ` +
        `recibido tipo='${recintos[0].tipo}'.`,
    )
  }
  // Una Parcela del modelo es UN exterior con huecos, y eso NO va a cambiar aunque la
  // entrega multiparcela sí exista (override O18): un sobre con N parcelas son N objetos
  // como éste, no un objeto con N exteriores. Dos trozos que no se tocan son dos fincas
  // distintas, y cada una necesita su propio `idLocal`. Por eso el mensaje ya no dice
  // «multiparcela está fuera de alcance» —era cierto en F00 y dejó de serlo el
  // 2026-08-03—: dice qué hacer en su lugar.
  for (let i = 1; i < recintos.length; i++) {
    if (recintos[i].tipo !== TIPO_RECINTO.HUECO) {
      throw new Error(
        `${contexto}: recintos[${i}] debe ser HUECO (sólo recintos[0] es EXTERIOR). ` +
          `Si lo que tienes son varias piezas que NO se tocan, no son una parcela con ` +
          `varios exteriores: son varias parcelas, y cada una se construye con su propia ` +
          `llamada a crearParcela y su propio idLocal. Recibido tipo='${recintos[i].tipo}'.`,
      )
    }
  }
}

// ── Factories ────────────────────────────────────────────────────────────────

/**
 * Crea un Recinto (anillo) a partir de sus vértices UTM.
 *
 * - Copia DEFENSIVA de `vertices` como `[[x, y], ...]`: el objeto devuelto no
 *   comparte referencias con la entrada.
 * - Si el anillo llega CERRADO (primer vértice repetido al final), se normaliza
 *   a anillo abierto quitando el duplicado, avisando por `console.warn`
 *   (regla 1: ningún error silencioso).
 *
 * @param {Array<[number, number]>} vertices - Pares UTM `[x, y]` (Este, Norte).
 * @param {'EXTERIOR'|'HUECO'} [tipo='EXTERIOR']
 * @returns {{ vertices: [number, number][], tipo: string }}
 */
export function crearRecinto(vertices, tipo = TIPO_RECINTO.EXTERIOR) {
  if (!Array.isArray(vertices)) {
    throw new TypeError(
      `crearRecinto: 'vertices' debe ser un array de pares [x,y]; recibido ${typeof vertices}.`,
    )
  }
  const tiposValidos = Object.values(TIPO_RECINTO)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearRecinto: 'tipo' inválido: ${JSON.stringify(tipo)}. Válidos: ${tiposValidos.join(', ')}.`,
    )
  }

  const copia = vertices.map((v, i) => {
    if (!Array.isArray(v) || v.length < 2 || !esNumeroFinito(v[0]) || !esNumeroFinito(v[1])) {
      throw new TypeError(
        `crearRecinto: el vértice ${i} no es un par UTM [x,y] de números finitos: ${JSON.stringify(v)}.`,
      )
    }
    return [v[0], v[1]]
  })

  // Normalizar anillo cerrado → abierto, NUNCA en silencio (regla 4 + regla 1).
  if (copia.length >= 2) {
    const primero = copia[0]
    const ultimo = copia[copia.length - 1]
    if (primero[0] === ultimo[0] && primero[1] === ultimo[1]) {
      copia.pop()
      console.warn(
        `crearRecinto: anillo recibido CERRADO (vértice de cierre repetido); ` +
          `normalizado a anillo abierto (regla de oro 4): ${copia.length + 1} → ${copia.length} vértices.`,
      )
    }
  }

  return { vertices: copia, tipo }
}

/**
 * Crea una Parcela (POJO plano).
 *
 * @param {object} args
 * @param {string} args.idLocal - Identificador local (obligatorio).
 * @param {string|null} [args.refcat=null] - Referencia catastral.
 * @param {Array} [args.recintos=[]] - `recintos[0]` debe ser el EXTERIOR.
 * @param {Array|null} [args.geometriaOficial=null] - La del WFS; se guarda intacta.
 * @param {number|null} [args.superficieRegistral=null]
 * @param {number|null} [args.superficieCatastral=null] - La superficie que el
 *        Catastro **DECLARA** (`cp:areaValue` del GML del WFS). NO es una
 *        superficie medida por nosotros, y ahí está todo el valor del campo:
 *          · Es un **entero** en m² (override O6, SPEC §3): el Catastro publica
 *            `<cp:areaValue uom="m2">1536</cp:areaValue>`.
 *          · La superficie **medida** se calcula aparte, con `geo/area.js`
 *            (`area`/`superficie`, shoelace) sobre los vértices del modelo, y
 *            las dos cifras **no tienen por qué coincidir**: en la parcela real
 *            9398516VK3799G el Catastro declara 1536 mientras el shoelace de
 *            las coordenadas que él mismo emite da 1535,87 m². La diferencia ES
 *            el dato. Si aquí se guardara lo calculado, el diagnóstico de
 *            encaje (F07) compararía una cifra consigo misma y lo llamaría
 *            diagnóstico.
 *          · `null` significa «no lo sabemos» (parcela que no viene del
 *            Catastro: DXF, TXT, GML ajeno, dibujada…), NUNCA «cero».
 *        Se valida como `superficieRegistral` —número finito o null—, sin
 *        forzar el entero: aquí se guarda lo que el servicio declaró tal cual
 *        (regla de oro 11: el modelo no redondea; el redondeo es de salida).
 * @param {Array<[number,number]>} [args.puntosLevantamiento=[]] - Los PUNTOS
 *        SUELTOS del levantamiento importado, en UTM y como pares.
 *          · Es el fichero real de un topógrafo: cinco levantamientos del autor
 *            medidos el 2026-08-18 dan entre 26 y 88 `POINT` y **cero** anillos.
 *            El técnico une esos puntos dibujando encima, así que son **dato del
 *            expediente** y no un residuo del parseo: si no se guardaran aquí,
 *            recargar la página o recuperar el expediente obligaría a reimportar
 *            el DXF para poder seguir dibujando.
 *          · **No son geometría de la parcela.** No entran en el GML, no se
 *            miden y no participan en el diagnóstico: sirven de ENGANCHE
 *            (`edit/snap.js#dianasDe` los pone los primeros del catálogo) y de
 *            referencia visual. Por eso viven en su propio campo y no en
 *            `recintos`, donde cualquier consumidor los tomaría por un contorno.
 *          · Una parcela puede tener puntos y **cero recintos**: es justo el
 *            estado en el que se aterriza tras importar un levantamiento sin
 *            unir, y lo que abre el peldaño Edición (`app/navegacion.js`, hecho
 *            `puntos`).
 *          · Se guardan **CONGELADOS**, el mismo trato que `geometriaOficial`:
 *            son el registro de lo que traía el fichero y nada los edita.
 * @param {string} args.origen - Uno de ORIGEN_PARCELA (obligatorio).
 * @returns {object} Parcela
 */
export function crearParcela({
  idLocal,
  refcat = null,
  recintos = [],
  geometriaOficial = null,
  superficieRegistral = null,
  superficieCatastral = null,
  puntosLevantamiento = [],
  origen,
} = {}) {
  if (typeof idLocal !== 'string' || idLocal.length === 0) {
    throw new TypeError(
      `crearParcela: 'idLocal' es obligatorio (string no vacío); recibido ${JSON.stringify(idLocal)}.`,
    )
  }
  const origenesValidos = Object.values(ORIGEN_PARCELA)
  if (!origenesValidos.includes(origen)) {
    throw new RangeError(
      `crearParcela: 'origen' inválido: ${JSON.stringify(origen)}. Válidos: ${origenesValidos.join(', ')}.`,
    )
  }
  if (refcat !== null && typeof refcat !== 'string') {
    throw new TypeError(`crearParcela: 'refcat' debe ser string o null; recibido ${typeof refcat}.`)
  }
  if (superficieRegistral !== null && !esNumeroFinito(superficieRegistral)) {
    throw new TypeError(
      `crearParcela: 'superficieRegistral' debe ser número finito o null; recibido ${JSON.stringify(superficieRegistral)}.`,
    )
  }
  if (superficieCatastral !== null && !esNumeroFinito(superficieCatastral)) {
    throw new TypeError(
      `crearParcela: 'superficieCatastral' debe ser número finito o null; recibido ${JSON.stringify(superficieCatastral)}.`,
    )
  }
  if (!Array.isArray(recintos)) {
    throw new TypeError(`crearParcela: 'recintos' debe ser un array; recibido ${typeof recintos}.`)
  }

  // Copia defensiva + normalización de cada recinto.
  const recintosCopia = recintos.map((r) => crearRecinto(r.vertices, r.tipo))
  validarInvarianteExterior(recintosCopia, 'crearParcela.recintos')

  // geometriaOficial: copia INDEPENDIENTE (no comparte referencias con recintos
  // aunque se pase el mismo array) e intacta; se congela para blindar regla 2.
  let geoOficial = null
  if (geometriaOficial !== null) {
    if (!Array.isArray(geometriaOficial)) {
      throw new TypeError(
        `crearParcela: 'geometriaOficial' debe ser un array de recintos o null; recibido ${typeof geometriaOficial}.`,
      )
    }
    geoOficial = geometriaOficial.map((r) => crearRecinto(r.vertices, r.tipo))
    validarInvarianteExterior(geoOficial, 'crearParcela.geometriaOficial')
    deepFreeze(geoOficial)
  }

  // puntosLevantamiento: copia INDEPENDIENTE y CONGELADA, mismo trato que
  // `geometriaOficial` y por el mismo motivo (nada los edita; son el registro de
  // lo que traía el fichero).
  //
  // La FORMA se exige entera —un array— porque equivocarse ahí se lleva la nube
  // completa; y un par suelto mal formado **también lanza**, al revés que en
  // `edit/snap.js#dianasDe`. No es una incoherencia: allí el catálogo se
  // reconstruye en cada gesto y descartar un par malo cuesta una diana, mientras
  // que aquí el dato se GUARDA y reaparece en un expediente recuperado meses
  // después. La regla del modelo es la de `crearRecinto`: el par malo se nombra
  // por su índice y se lanza.
  let puntosCopia = []
  if (puntosLevantamiento !== null && puntosLevantamiento !== undefined) {
    if (!Array.isArray(puntosLevantamiento)) {
      throw new TypeError(
        `crearParcela: 'puntosLevantamiento' debe ser un array de pares UTM [x,y]; ` +
          `recibido ${typeof puntosLevantamiento}.`,
      )
    }
    puntosCopia = puntosLevantamiento.map((p, i) => {
      if (!Array.isArray(p) || p.length < 2 || !esNumeroFinito(p[0]) || !esNumeroFinito(p[1])) {
        throw new TypeError(
          `crearParcela: el punto de levantamiento ${i} no es un par UTM [x,y] de números ` +
            `finitos: ${JSON.stringify(p)}.`,
        )
      }
      return [p[0], p[1]]
    })
    deepFreeze(puntosCopia)
  }

  return {
    idLocal,
    refcat,
    recintos: recintosCopia,
    geometriaOficial: geoOficial,
    superficieRegistral,
    superficieCatastral,
    puntosLevantamiento: puntosCopia,
    origen,
  }
}

/**
 * Las parcelas de un expediente a partir de las dos formas de entrada, ya copiadas
 * por `crearParcela` y con sus dos invariantes comprobados (F25 · fase 1).
 *
 * ── LAS DOS FORMAS, Y POR QUÉ LA CORTA SIGUE EXISTIENDO ──
 * `{parcelas, activa}` es la forma del expediente desde F25: N parcelas y la que
 * está en edición. `{parcela}` es la de antes, y se sigue admitiendo **solo de
 * entrada** porque es exactamente lo que escriben los ficheros de proyecto de la
 * versión 1, los registros que ya hay en IndexedDB y los compositores de `app/`
 * que arman un expediente de una sola parcela. La SALIDA tiene una forma y no dos: un
 * expediente con `parcela` y `parcelas` a la vez serían dos representaciones del
 * mismo dato, y la que se desincroniza es la que nadie mira.
 *
 * Pasar las dos a la vez LANZA: no hay forma honrada de decidir cuál manda.
 *
 * @param {object|null} parcela
 * @param {Array<object>|undefined} parcelas
 * @param {string|null|undefined} activa
 * @returns {{parcelas: object[], activa: string|null}}
 */
function parcelasDeExpediente(parcela, parcelas, activa) {
  if (parcelas !== undefined && parcela !== null) {
    throw new Error(
      `crearExpediente: se han pasado 'parcela' y 'parcelas' a la vez. 'parcela' es la forma ` +
        `corta de un expediente de UNA parcela; con varias, todas van en 'parcelas' y la que ` +
        `está en edición se nombra en 'activa'.`,
    )
  }
  if (parcelas === undefined) {
    if (activa !== undefined && activa !== null) {
      throw new Error(
        `crearExpediente: 'activa' solo tiene sentido con 'parcelas'; con la forma corta, la ` +
          `parcela en edición es la única que hay. Recibido activa=${JSON.stringify(activa)}.`,
      )
    }
    if (parcela === null) return { parcelas: [], activa: null }
    const copia = crearParcela(parcela)
    return { parcelas: [copia], activa: copia.idLocal }
  }
  if (!Array.isArray(parcelas)) {
    throw new TypeError(`crearExpediente: 'parcelas' debe ser un array; recibido ${typeof parcelas}.`)
  }

  const copias = parcelas.map((p) => crearParcela(p))
  // `idLocal` ÚNICO entre parcelas. No es higiene: el `gml:id` del sobre de N
  // miembros es `xs:ID` en TODO el documento (override O18), y la identidad del
  // miembro en edición —la que distingue «he editado ésta» de «he cambiado a otra»—
  // sale de aquí. Dos iguales harían que activar una abriera la otra.
  const vistos = new Set()
  for (const p of copias) {
    if (vistos.has(p.idLocal)) {
      throw new Error(
        `crearExpediente: dos parcelas del expediente comparten el idLocal ` +
          `${JSON.stringify(p.idLocal)}. Cada parcela necesita el suyo: es lo que la identifica ` +
          `dentro del expediente y en el gml:id del fichero.`,
      )
    }
    vistos.add(p.idLocal)
  }

  if (copias.length === 0) {
    if (activa !== undefined && activa !== null) {
      throw new Error(
        `crearExpediente: 'activa' es ${JSON.stringify(activa)} y el expediente no tiene ninguna ` +
          `parcela.`,
      )
    }
    return { parcelas: [], activa: null }
  }
  // Con una sola, la que está en edición no admite duda y se rellena. Con varias,
  // rellenarla sería ELEGIR por el usuario cuál estaba editando (regla 1).
  if ((activa === undefined || activa === null) && copias.length === 1) {
    return { parcelas: copias, activa: copias[0].idLocal }
  }
  if (typeof activa !== 'string' || !vistos.has(activa)) {
    throw new Error(
      `crearExpediente: 'activa' debe ser el idLocal de una de sus ${copias.length} parcelas ` +
        `(${copias.map((p) => JSON.stringify(p.idLocal)).join(', ')}); recibido ` +
        `${JSON.stringify(activa)}.`,
    )
  }
  return { parcelas: copias, activa }
}

/**
 * Crea un Expediente (POJO plano) — la raíz del modelo. Porta UNA rama según
 * `tipo`: `parcelas` (PARCELA) o `edificio` (EDIFICIO); mezclar ramas LANZA
 * (regla 1; auditoría A5: antes el tipo EDIFICIO era un cascarón sin rama).
 *
 * ⭐ **Desde F25 la rama PARCELA lleva N parcelas** (`parcelas`) y nombra la que
 * está en edición (`activa`, su `idLocal`). Hasta entonces era UNA (`parcela`).
 * Para leer la que se está editando, {@link parcelaActiva}; la que da nombre al
 * expediente, {@link parcelaPrincipal}. Ver {@link parcelasDeExpediente} para las
 * dos formas de entrada.
 *
 * @param {object} [args]
 * @param {'PARCELA'|'EDIFICIO'} [args.tipo='PARCELA']
 * @param {string} [args.srs='EPSG:25830'] - Uno de SRS_VALIDOS.
 * @param {string} [args.autor='']
 * @param {string} [args.idDocumento='']
 * @param {object} [args.metadatos] - `{ creado, modificado, autor, idDocumento }`;
 *        cada campo ausente se completa (autor/idDocumento desde sus params;
 *        creado/modificado con la marca de tiempo actual).
 * @param {object|null} [args.parcela=null] - Forma CORTA, solo de entrada: un
 *        expediente de una parcela. Excluyente con `parcelas`.
 * @param {Array<object>} [args.parcelas] - Solo tipo PARCELA. Cada una se copia vía
 *        crearParcela; sus `idLocal` no pueden repetirse.
 * @param {string|null} [args.activa] - El `idLocal` de la parcela en edición.
 *        Obligatorio con dos o más; con una se rellena solo.
 * @param {object|null} [args.edificio=null] - Solo tipo EDIFICIO. Construido con
 *        `model/edificio.js#crearEdificio` (dueño de su validación; las ramas del
 *        modelo no se importan entre sí): aquí solo copia estructural profunda.
 * @returns {object} Expediente `{tipo, srs, metadatos, parcelas, activa, edificio}`
 */
export function crearExpediente({
  tipo = TIPO_EXPEDIENTE.PARCELA,
  srs = 'EPSG:25830',
  autor = '',
  idDocumento = '',
  metadatos = null,
  parcela = null,
  parcelas = undefined,
  activa = undefined,
  edificio = null,
} = {}) {
  const tiposValidos = Object.values(TIPO_EXPEDIENTE)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearExpediente: 'tipo' inválido: ${JSON.stringify(tipo)}. Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  if (!SRS_VALIDOS.includes(srs)) {
    throw new RangeError(
      `crearExpediente: 'srs' inválido: ${JSON.stringify(srs)}. Válidos: ${SRS_VALIDOS.join(', ')}.`,
    )
  }
  // Exclusividad de rama por tipo (regla 1: nada de estados incoherentes mudos).
  if (tipo === TIPO_EXPEDIENTE.PARCELA && edificio !== null) {
    throw new Error(`crearExpediente: un expediente de tipo PARCELA no puede llevar rama 'edificio'.`)
  }
  const rama = parcelasDeExpediente(parcela, parcelas, activa)
  if (tipo === TIPO_EXPEDIENTE.EDIFICIO && rama.parcelas.length > 0) {
    throw new Error(`crearExpediente: un expediente de tipo EDIFICIO no puede llevar rama 'parcelas'.`)
  }
  if (edificio !== null) {
    // Chequeo estructural ligero; la validación de dominio vive en crearEdificio.
    if (typeof edificio !== 'object' || !Array.isArray(edificio.partes) || typeof edificio.modelo !== 'string') {
      throw new TypeError(
        `crearExpediente: 'edificio' debe ser un Edificio de crearEdificio ` +
          `({modelo, partes[], ...}) o null; recibido ${JSON.stringify(edificio)}.`,
      )
    }
  }

  const meta = metadatos ?? {}
  const ahora = new Date().toISOString()
  const metadatosOut = {
    creado: meta.creado ?? ahora,
    modificado: meta.modificado ?? ahora,
    autor: meta.autor ?? autor,
    idDocumento: meta.idDocumento ?? idDocumento,
  }

  // Copia profunda independiente de la rama edificio. structuredClone NO
  // preserva Object.freeze, así que se RE-congela `construccionOficial` para
  // mantener la barrera de la regla 2 también en la copia del expediente.
  let edificioCopia = null
  if (edificio !== null) {
    edificioCopia = structuredClone(edificio)
    if (edificioCopia.construccionOficial != null) deepFreeze(edificioCopia.construccionOficial)
  }

  return {
    tipo,
    srs,
    metadatos: metadatosOut,
    parcelas: rama.parcelas,
    activa: rama.activa,
    edificio: edificioCopia,
  }
}

/**
 * Comprueba que llega un Expediente ya normalizado, o lanza diciendo qué ha llegado.
 * El mensaje nombra la forma vieja porque es el error más probable: un objeto
 * `{parcela}` de antes de F25 que no ha pasado por `crearExpediente`.
 */
function exigirExpediente(expediente, fn) {
  if (expediente === null || typeof expediente !== 'object' || !Array.isArray(expediente.parcelas)) {
    throw new TypeError(
      `${fn}: se esperaba un Expediente de crearExpediente (con 'parcelas'); recibido ` +
        `${expediente === null ? 'null' : typeof expediente}` +
        (expediente && typeof expediente === 'object' && 'parcela' in expediente
          ? ` con la forma anterior a F25 ('parcela'). Pásalo antes por normalizarExpediente.`
          : '.'),
    )
  }
}

/**
 * La parcela que está EN EDICIÓN —la que va al store—, o `null` si el expediente no
 * tiene ninguna (uno vacío, o uno de EDIFICIO). Devuelve el objeto del expediente,
 * no una copia: quien lo vaya a mutar lo copia, como con cualquier otra rama.
 *
 * @param {object} expediente  Un Expediente de {@link crearExpediente}.
 * @returns {object|null}
 * @throws {TypeError}  Si no es un Expediente normalizado.
 */
export function parcelaActiva(expediente) {
  exigirExpediente(expediente, 'parcelaActiva')
  return expediente.parcelas.find((p) => p.idLocal === expediente.activa) ?? null
}

/**
 * La parcela que DA NOMBRE al expediente: la primera. Es la que rotula el registro
 * guardado y la que indexa su referencia catastral, y no tiene por qué ser la que se
 * está editando: en una segregación se edita una pieza nueva y el expediente sigue
 * siendo el de la matriz. Que sea la primera no es una convención arbitraria: es la
 * que entró al abrir el expediente, y las demás se AÑADEN detrás.
 *
 * @param {object} expediente  Un Expediente de {@link crearExpediente}.
 * @returns {object|null}
 * @throws {TypeError}  Si no es un Expediente normalizado.
 */
export function parcelaPrincipal(expediente) {
  exigirExpediente(expediente, 'parcelaPrincipal')
  return expediente.parcelas[0] ?? null
}

/**
 * Vuelve a pasar por {@link crearExpediente} un expediente que llega de FUERA —un
 * registro de IndexedDB, un fichero de proyecto, el borrador—, en cualquiera de sus
 * dos formas: la de F25 (`parcelas` + `activa`) o la anterior (`parcela`).
 *
 * Existe porque esta misma llamada, campo a campo, estaba escrita **cinco veces**
 * (`storage/expedientes.js` ×3, `export/proyecto.js` ×2), y F25 tenía que tocar las
 * cinco igual. Cinco copias que hay que cambiar a la vez son cinco ocasiones de que
 * una se quede atrás —la auditoría de F25 midió justo eso en las tres copias de
 * `claveDeExpediente` (H4)—, y la que se queda atrás aquí PIERDE parcelas al guardar.
 *
 * No es tolerante: lo que `crearExpediente` rechaza, lanza. Quien lee un fichero ajeno
 * captura y lo cuenta (`export/proyecto.js#deProyecto`).
 *
 * @param {object|null|undefined} valor
 * @returns {object} Expediente
 */
export function normalizarExpediente(valor) {
  return crearExpediente({
    tipo: valor?.tipo,
    srs: valor?.srs,
    metadatos: valor?.metadatos ?? undefined,
    parcela: valor?.parcela ?? null,
    parcelas: valor?.parcelas,
    activa: valor?.activa,
    edificio: valor?.edificio ?? null,
  })
}
