// edificio/entrada.js — F11 · T2.1. Las TRES fábricas de entrada de la rama EDIFICIO.
//
// Contrato **D** del plan de F11. Es la única capa del proyecto que convierte lo
// que trae un fichero (DXF, LIST, TXT), un GML de edificio ajeno o la respuesta
// del `wfsBU` en el `Edificio` de `model/edificio.js`. Todo lo que hay antes
// —`parsers/importar.js` y `gml/parse-bu.js`— devuelve el dato CRUDO a propósito;
// todo lo que hay después —`app/`, `viewer/`— consume ya el modelo.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ AQUÍ, Y SOLO AQUÍ, SE DECIDEN CUATRO COSAS                               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//   1. El {@link ORIGEN_PARTE} de cada parte — la procedencia de su geometría.
//   2. El nombre genérico de cada parte (`edificio/_comun.js#nombreParteGenerico`).
//   3. El mapeo INSPIRE → vocabulario del modelo: `functional → FUNCIONAL`,
//      `currentUse → usoDominante`, `grossFloorArea → superficieConstruida`.
//   4. Qué NO llega al modelo, y decirlo (regla de oro 1). Ver «lo que se tira».
//
// ── LAS DOS VÍAS DE GML COMPARTEN LA MISMA TRADUCCIÓN, Y ESE ES EL AHORRO ────
// `entradaDesdeGmlBu` y `entradaDesdeWfsBu` llaman las dos a {@link traducirBu}:
// el `wfsBU` devuelve EXACTAMENTE el mismo dialecto que el fichero que el técnico
// se descarga de la Sede —medido sobre cinco documentos reales en la fase 0—, así
// que una segunda traducción sería una copia condenada a divergir. Lo único que
// las distingue es de dónde viene el documento, y eso viaja en `resumen.via` y en
// el `origen` de cada parte. ⚠️ MEDIDO: los dos `Edificio` NO salen bit a bit
// idénticos, y **deben** diferir en `partes[].origen`
// (`GML_EXISTENTE` ≠ `WFS`): esa es la única diferencia, y está atada con un test
// que la calcula en vez de darla por buena.
//
// ── `entradaDesdeTexto` DESCARTA LA `parcela` DE `importar`, A PROPÓSITO ─────
// `parsers/importar.js` devuelve `{parcela, anillos, capas, detecciones, resumen}`
// y de ahí se consumen los CUATRO últimos. La `parcela` se tira porque su reparto
// —`recintos[0]` EXTERIOR y todo lo demás HUECO— es una regla de la OTRA rama:
// para un edificio **cada anillo es su propio exterior** (vivienda, porche y
// piscina son tres huellas, no una con dos agujeros). Delegando así se reutilizan
// sin duplicar los detectores de cierre, de X/Y invertidas, de grados pegados y
// de huso, que son 500 líneas probadas desde F01.
//
// ⛔⛔ Y de ahí sale la trampa más cara de esta tarea, MEDIDA el 2026-08-03:
// `importar()` emite CINCO bloqueos, no tres. Los dos nuevos de T1.1
// —`ANILLOS_EN_VARIAS_CAPAS` y `SUPERFICIE_NO_POSITIVA`— son el arreglo de un
// defecto DE PARCELA (la superficie negativa silenciosa), y hablan del reparto
// «uno exterior + N huecos», no del fichero. El fixture real de esta fase
// —`edificio_consulta_masiva_3515508VF0831N.dxf`, 7 anillos en «Construccion» y 1
// en «Parcela»— dispara **los dos**: reenviarlos a ciegas dejaría la rama EDIFICIO
// bloqueada en su caso NORMAL, porque un DXF de edificio viene por definición de
// varias capas. Por eso `resumen.bloqueos` se filtra con `BLOQUEOS_SOLO_PARCELA`,
// que `parsers/importar.js` publica ya agrupado justo para esto.
//
// ── LO QUE SE TIRA, Y DÓNDE SE DICE ─────────────────────────────────────────
// F11 declara por alcance que toda parte nace `PRINCIPAL` con las plantas a
// `null` (desviación 5 del plan: el tipo y las plantas son F12). Pero el lector
// SÍ trae esos datos, así que tirarlos en silencio sería la regla de oro 1 rota:
//   · Las plantas de las trece partes    → {@link TIPO_EDIFICIO}.PLANTAS_DESCARTADAS
//   · La piscina entrando como PRINCIPAL → {@link TIPO_EDIFICIO}.TIPO_PARTE_FORZADO
//   · La parte SOLO bajo rasante         → {@link TIPO_EDIFICIO}.PARTE_BAJO_RASANTE
//   · La envolvente del `Building`       → {@link TIPO_EDIFICIO}.PATCHES_MULTIPLES
//   · Los atributos que no caben         → {@link TIPO_EDIFICIO}.ATRIBUTO_NO_MAPEADO
//   · Las capas del DXF no elegidas      → {@link TIPO_EDIFICIO}.CAPA_DXF_DESCARTADA
//
// ⚠️ **`PATCHES_MULTIPLES` se usa para tres hechos distintos, y no es un descuido.**
// El léxico `TIPO_EDIFICIO` está CERRADO y es fichero de otra tarea (T1.3): no se
// amplía desde aquí. No tiene ningún código para «esta geometría del documento no
// ha llegado al modelo», que es lo que pasa con la envolvente del `Building`, con
// los `gml:interior` de una parte y con los patches de más. El más cercano es
// `PATCHES_MULTIPLES`, cuya propia ficha dice «se dice cuántos venían y **qué se
// ha hecho con ellos**». Se distinguen por `datos.destino`. Es el mismo apaño, con
// el mismo razonamiento escrito, que `gml/parse-bu.js#valorNumero` hace con
// `AREA_DECLARADA_DISCREPANTE`. **Deuda anotada para F12: un
// `GEOMETRIA_DESCARTADA` propio en `edificio/_comun.js`.**
//
// ── LA ENVOLVENTE DEL `Building` NO ENTRA COMO PARTE. POR QUÉ ────────────────
// En INSPIRE, la geometría del `bu-ext2d:Building` es la huella del edificio
// ENTERO: la unión de sus partes. El modelo de este proyecto la declara DERIVADA
// y no la guarda (`model/edificio.js:22-24`, y es el criterio de aceptación 4 de
// la ficha). Meterla como una parte más sería (a) guardar la envolvente con otro
// nombre, y (b) contar su superficie DOS veces, una en la envolvente y otra en
// las partes que la componen. Así que se descarta **diciéndolo**, con el número de
// caras y de vértices que se quedan fuera. Consecuencia medida y aceptada: un
// documento que solo trae el `Building` —`bu_building_9398516VK3799G.gml`, o la
// respuesta de `GetAllConstructionByParcel` sobre una rústica— sale con CERO
// partes y bloqueo `SIN_CONSTRUCCION`, porque las partes vienen de la otra
// consulta (`GetBuildingPartByParcel`). El mensaje lo dice con ese nombre.
//
// ── `puntoDeReferencia` NO ES EL CENTROIDE ───────────────────────────────────
// Ver su JSDoc: `app/cableado-catastro.js:133-141` tiene MEDIDO y escrito que el
// centroide aritmético de una figura en L cae FUERA del polígono, y que entonces
// el Catastro devuelve la referencia de la parcela VECINA, en silencio.
//
// Puro: sin DOM, sin red, sin reloj, sin Leaflet. Proyecto Vitest `node`.

import { superficie } from '../geo/area.js'
import { detectarHuso, husoPorSrsOpcional } from '../geo/huso.js'
import { LIMITE_MAGNITUD_COORD, puntoInterior } from '../gml/anillos.js'
import { parsearGmlBu } from '../gml/parse-bu.js'
import {
  MODELO_EDIFICIO,
  ORIGEN_PARTE,
  TIPO_PARTE,
  crearEdificio,
  crearParteConstruccion,
} from '../model/edificio.js'
// El vocabulario `{EXTERIOR, HUECO}` que comprueban `geo/area.js#superficie` y
// `gml/anillos.js#validarRecintos`. `model/edificio.js` no importa
// `model/parcela.js` a propósito (las dos ramas del MODELO son independientes),
// pero esta capa no es el modelo: ya depende de `parsers/importar.js`, que importa
// `model/parcela.js`. Usar la constante en vez del literal `'EXTERIOR'` hace que
// un renombrado allí salga en rojo aquí y no en un `throw` de `superficie`.
import { TIPO_RECINTO } from '../model/parcela.js'
import { BLOQUEOS_SOLO_PARCELA, importar, sinDeteccionesDeParcela } from '../parsers/importar.js'
import {
  MOTIVO_ENTRADA,
  SEVERIDAD,
  TIPO_EDIFICIO,
  crearDeteccionEdificio,
  nombreParteGenerico,
  resumirDetecciones,
} from './_comun.js'
import { conAtributos } from './mutaciones.js'

// ── Vocabulario ──────────────────────────────────────────────────────────────

/**
 * Por dónde ha entrado el edificio. Es el `resumen.via` del contrato D, y el
 * espejo de `ResumenImportacion.formato` con las dos vías que la rama parcela no
 * tiene.
 *
 * Sus cinco claves son las mismas de `ORIGEN_PARTE` menos `DIBUJADA`, que es
 * origen pero NO vía: una parte dibujada a mano no entra por ninguna de estas
 * tres fábricas (es F12).
 *
 * @readonly
 */
export const VIA = Object.freeze({
  DXF: 'DXF',
  LIST: 'LIST',
  TXT: 'TXT',
  GML_EXISTENTE: 'GML_EXISTENTE',
  WFS: 'WFS',
})

/**
 * `conditionOfConstruction` de INSPIRE → `ESTADO_CONSERVACION` del modelo.
 *
 * ⚠️ Solo `functional` está **MEDIDO** (es lo que traen los cinco documentos
 * reales de la fase 0, y solo en el `Building`: en las trece partes viene
 * `xsi:nil`). Los otros tres salen de la lista de códigos de INSPIRE
 * `ConditionOfConstructionValue` y se declaran como lo que son: mapeo razonado,
 * no medido. Los que faltan de esa lista —`declined` y `projected`— NO se mapean
 * a ninguno de los cuatro del modelo porque no significan lo mismo, y cuando
 * lleguen se dicen con `ATRIBUTO_NO_MAPEADO` en vez de aproximarse al más
 * parecido: un estado de conservación aproximado es un dato falso con formato de
 * dato bueno.
 *
 * @readonly
 */
export const CONDICION_A_ESTADO = Object.freeze({
  functional: 'FUNCIONAL',
  underConstruction: 'EN_CONSTRUCCION',
  ruin: 'RUINOSO',
  demolished: 'DERRUIDO',
})

/**
 * El `officialAreaReference` que alimenta `superficieConstruida`. Medido: el
 * `Building` de la parcela de referencia trae uno solo, `grossFloorArea`, con
 * `valor: 2513` y `uom: 'm2'`.
 */
export const REFERENCIA_SUPERFICIE_CONSTRUIDA = 'grossFloorArea'

/** `resumen.formato` de `importar` → `ORIGEN_PARTE`. Mismas tres cadenas. */
const ORIGEN_POR_FORMATO = Object.freeze({
  DXF: ORIGEN_PARTE.DXF,
  LIST: ORIGEN_PARTE.LIST,
  TXT: ORIGEN_PARTE.TXT,
})

// ── Typedef del contrato D ───────────────────────────────────────────────────

/**
 * @typedef {Object} ResumenEntrada
 * @property {'DXF'|'LIST'|'TXT'|'GML_EXISTENTE'|'WFS'} via  Ver {@link VIA}.
 * @property {boolean} formatoAutodetectado  `true` cuando la vía DEDUJO el formato
 *   (o el dialecto) del contenido en vez de que se lo dijeran. Falso en `WFS`, que
 *   sabe lo que ha pedido.
 * @property {string} origen  El `ORIGEN_PARTE` con el que han nacido las partes.
 * @property {number} nPartes  Partes creadas. Espejo de `ResumenImportacion.nAnillos`.
 * @property {number[]} nVertices  Vértices de cada parte, en el mismo orden. `0`
 *   si la parte entró sin contorno.
 * @property {string[]|null} capas  Capa LITERAL de cada parte, 1:1 con `nVertices`.
 *   **Solo DXF**; `null` en las otras cuatro vías, que no tienen el concepto y no
 *   se lo inventan.
 * @property {{zona:number, srs:string, lon:number|null, lat:number|null, ambiguo:boolean}|null} huso
 *   Dónde cae el edificio. En las vías de GML el huso NO se deduce: sale del
 *   `srsName` que declara el documento, y `lon`/`lat` son solo el punto de caída.
 * @property {string[]} bloqueos  Por qué `edificio` es `null` (vacío si se
 *   construyó). Valores de {@link MOTIVO_ENTRADA}, **nunca** de
 *   `BLOQUEOS_SOLO_PARCELA`.
 * @property {boolean} construido  Espejo de `ResumenImportacion.construida`.
 * @property {{total:number, porTipo:object, porSeveridad:object}} detecciones  Recuentos.
 */

/**
 * @typedef {Object} EntradaEdificio
 * @property {object|null} edificio  El POJO de `crearEdificio`, o `null` si hay
 *   bloqueos.
 * @property {Array<object>} detecciones  Todo lo que hubo que decidir, en orden.
 *   ⚠️ Es una lista MIXTA: las de aguas arriba llegan tal cual —`Deteccion` de
 *   `parsers/_comun.js` o `DeteccionGml` de `gml/_comun.js`— y las de esta capa
 *   son `DeteccionEdificio`. Los tres catálogos tienen la MISMA forma
 *   `{tipo, mensaje, severidad, datos?}` (es el motivo escrito en la cabecera de
 *   `edificio/_comun.js`), así que la interfaz las pinta con un solo componente y
 *   `resumirDetecciones` las cuenta todas sin adaptador.
 * @property {ResumenEntrada} resumen
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Copia de un anillo como pares nuevos: nada sale compartiendo referencias. */
const copiarAnillo = (anillo) => anillo.map(([x, y]) => [x, y])

/** Texto no vacío, o `null`. Sin recortar ni normalizar: la RC es del documento. */
const opcionalTexto = (v) => (typeof v === 'string' && v.length > 0 ? v : null)

/** ¿Es un par [x,y] de números finitos y publicables? */
const parUtil = (v) =>
  Array.isArray(v) &&
  v.length >= 2 &&
  Number.isFinite(v[0]) &&
  Number.isFinite(v[1]) &&
  Math.abs(v[0]) < LIMITE_MAGNITUD_COORD &&
  Math.abs(v[1]) < LIMITE_MAGNITUD_COORD

/** Recinto EXTERIOR a partir de un anillo abierto, o `null` si no hay vértices. */
const recintoDe = (anillo) =>
  anillo.length === 0 ? null : { vertices: copiarAnillo(anillo), tipo: TIPO_RECINTO.EXTERIOR }

/** Valida `opts.modelo` aquí y no dentro de `crearEdificio`, para nombrar la fábrica. */
function exigirModelo(modelo, fn) {
  const validos = Object.values(MODELO_EDIFICIO)
  if (!validos.includes(modelo)) {
    throw new RangeError(
      `${fn}: 'opts.modelo' inválido: ${JSON.stringify(modelo)}. Válidos: ${validos.join(', ')}.`,
    )
  }
  return modelo
}

/** Media aritmética de los vértices. Solo para deducir dónde cae (regla 3). */
function centroideVertices(anillo) {
  let sx = 0
  let sy = 0
  for (const [x, y] of anillo) {
    sx += x
    sy += y
  }
  return [sx / anillo.length, sy / anillo.length]
}

/**
 * Los vértices utilizables de una parte: `null` si no tiene contorno, si tiene
 * menos de 3 vértices o si alguno no es publicable.
 *
 * El filtro de publicables existe para NO tener que envolver `puntoInterior` en un
 * `try`: esa función redondea, y `gml/anillos.js#redondearCoord` **lanza** con un
 * `NaN` o con una coordenada de magnitud ≥ 1e15. Un `catch` ahí se tragaría
 * también los errores de programación, que es lo contrario de lo que se busca.
 */
function verticesUtiles(parte) {
  const v = parte?.recinto?.vertices
  if (!Array.isArray(v) || v.length < 3) return null
  return v.every(parUtil) ? v : null
}

/**
 * El punto de caída del huso, para el `resumen`. En las vías de GML el huso NO se
 * DEDUCE —lo declara el `srsName` del documento—, así que `detectarHuso` se llama
 * con ese único candidato: verifica, no adivina, y por eso `ambiguo` sale siempre
 * `false`. Si el punto no cae en España, el huso sigue siendo el que dice el
 * fichero y lo que falta es el punto: `lon`/`lat` a `null`, sin inventar nada.
 */
function husoDeSrs(srs, partes) {
  if (typeof srs !== 'string') return null
  const zona = husoPorSrsOpcional(srs)
  if (zona === null) return null
  const conGeometria = partes.map(verticesUtiles).filter((v) => v !== null)
  if (conGeometria.length === 0) return { zona, srs, lon: null, lat: null, ambiguo: false }
  const caida = detectarHuso(centroideVertices(conGeometria[0]), [zona])
  return caida === null
    ? { zona, srs, lon: null, lat: null, ambiguo: false }
    : { zona: caida.zona, srs: caida.srs, lon: caida.lon, lat: caida.lat, ambiguo: caida.ambiguo }
}

/** Arma el `resumen` del contrato D. Único sitio que lo construye, en las 3 vías. */
function armarResumen({
  via,
  formatoAutodetectado,
  origen,
  partes,
  capas,
  huso,
  bloqueos,
  construido,
  detecciones,
}) {
  return {
    via,
    formatoAutodetectado,
    origen,
    nPartes: partes.length,
    nVertices: partes.map((p) => (p.recinto === null ? 0 : p.recinto.vertices.length)),
    capas,
    huso,
    bloqueos,
    construido,
    detecciones: resumirDetecciones(detecciones),
  }
}

/**
 * Aplica los atributos semánticos al edificio recién creado, delegando en
 * `edificio/mutaciones.js#conAtributos`.
 *
 * ⚠️ Es la ÚNICA de las cuatro mutaciones que esta capa usa, y no por gusto: es la
 * que ya sabe decir «este edificio es SIMPLIFICADO y estas siete claves no
 * existen en ese modelo» con la lista de lo que se pierde. Escribir ese mensaje
 * aquí sería tenerlo por duplicado. `conRefcat`, `conModelo` y
 * `conParteRenombrada` no se usan porque los tres valores ya se le pasan a
 * `crearEdificio` de una vez, y reconstruir el edificio tres veces más para
 * obtener el mismo objeto sería trabajo sin dato nuevo.
 *
 * ⚠️ Las cuatro devuelven `{edificio, detecciones}`, **no un `Edificio` pelado**.
 */
function aplicarAtributos(edificio, atributos, detecciones) {
  if (Object.keys(atributos).length === 0) return edificio
  const res = conAtributos(edificio, atributos)
  detecciones.push(...res.detecciones)
  return res.edificio
}

// ── Vía 1 · texto (DXF / LIST / TXT) ─────────────────────────────────────────

/**
 * Emite un {@link TIPO_EDIFICIO}.CAPA_DXF_DESCARTADA por cada capa que el
 * llamante ha dejado fuera con `opts.capa`.
 *
 * El reparto ENTERO no viene en el resultado de `importar` —después de filtrar,
 * `capas` solo trae la capa elegida—, sino dentro de la detección de reparto que
 * ese módulo emite, en `datos.capas`. Leerlo de ahí es leer un contrato publicado
 * (`parsers/importar.js#resolverCapas`), no hurgar en una interioridad.
 *
 * Y si esa detección no estuviera, esto no emite nada y **no se pierde
 * información**: la detección original de `importar` viaja tal cual en la lista,
 * con el reparto en su mensaje. Lo que se añade aquí es la misma verdad dicha en
 * el vocabulario de esta rama, capa a capa, para que la interfaz pueda listarlas
 * sin analizar un texto.
 */
function decirCapasDescartadas(deteccionesImportar, capaElegida, detecciones) {
  const reparto = deteccionesImportar.find(
    (d) => d?.datos?.aplicado === 'FILTRADO' && d?.datos?.capas,
  )
  if (reparto === undefined) return
  const todas = reparto.datos.capas
  const fuera = Object.entries(todas).filter(([nombre]) => nombre !== capaElegida)
  if (fuera.length === 0) return
  const total = fuera.reduce((n, [, cuantos]) => n + cuantos, 0)
  for (const [nombre, cuantos] of fuera) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.CAPA_DXF_DESCARTADA,
        `La capa «${nombre}» aporta ${cuantos} polilínea(s) del dibujo y NO entra como parte: ` +
          `se ha pedido importar solo «${capaElegida}». En total quedan fuera ${total} ` +
          `polilínea(s) de ${fuera.length} capa(s).`,
        SEVERIDAD.INFO,
        { capa: nombre, anillos: cuantos, capaElegida, capasFuera: fuera.length, total },
      ),
    )
  }
}

/**
 * Entrada de edificio desde un VOLCADO DE TEXTO: DXF, pegado de LISTA de AutoCAD
 * o TXT de dos columnas. Es la vía principal de la fase (ficha F11 §14.2).
 *
 * Delega ENTERA en `parsers/importar.js#importar` —formato, cierre, X/Y
 * invertidas, grados pegados, huso y reparto por capas— y se queda con
 * `{anillos, capas, detecciones, resumen}`, descartando su `.parcela`. **Una
 * polilínea = una parte**, cada una con su propio contorno exterior.
 *
 * @param {string} texto  El volcado tal cual, ya decodificado.
 * @param {object} [opts]
 * @param {'SIMPLIFICADO'|'COMPLETO'} [opts.modelo='SIMPLIFICADO']  Modelo de
 *   serialización del edificio (ficha F11 §14.1). El defecto es el de
 *   `crearEdificio` y el caso frecuente.
 * @param {string|null} [opts.refcat=null]  Referencia catastral del edificio.
 * @param {object[]|null} [opts.parcelaContexto=null]  Recintos de la parcela que
 *   hubiera en pantalla (desviación 9 del plan). ⚠️ **No se deduce del fichero**:
 *   en el fixture real hay una capa llamada «Parcela», pero T0.2·2 midió que en
 *   `UTM.dxf` la parcela de verdad está en la capa «0» y NO en la llamada
 *   «PARCELA». Elegir por el nombre falla en el único plano real que hay.
 * @param {string} [opts.capa]  Importar SOLO los anillos de esta capa del DXF, con
 *   su nombre LITERAL. Es el mecanismo de la decisión 5 («ofrecer, no imponer»):
 *   la interfaz enseña el reparto y pasa la elección. ⚠️ Elegir capa NO garantiza
 *   nada por sí solo — medido: con `{capa:'PARCELA'}` en `UTM.dxf` quedan tres
 *   anillos disjuntos.
 * @param {...*} [opts.resto]  Todo lo demás se reenvía a `importar` sin tocar:
 *   `formato`, `huso`, `intercambiarXY`, `compensarCierre`, `retirarCierre`,
 *   `toleranciaCierre`, `separadorDecimal`, `flechaMax`…
 * @returns {EntradaEdificio}
 * @throws {TypeError}   Si `texto` no es un string (lo lanza `importar`).
 * @throws {RangeError}  Si `opts.modelo`, `opts.formato`, `opts.huso` u
 *   `opts.capa` son inválidos. Contrato del programador, nunca dato del usuario.
 */
export function entradaDesdeTexto(texto, opts = {}) {
  const modelo = exigirModelo(opts.modelo ?? MODELO_EDIFICIO.SIMPLIFICADO, 'entradaDesdeTexto')

  const res = importar(texto, opts)

  // ⛔ EL FILTRO, Y SON DOS MITADES. La de abajo —los bloqueos— estaba desde T2.1:
  // sin ella el caso NORMAL de la fase sale bloqueado (ver la cabecera). La de
  // aquí es de 2026-08-04 y la destapó el guion de humo 13, no la suite: filtrar
  // el bloqueo y reenviar SU DETECCIÓN dejaba a la rama EDIFICIO diciendo a la vez
  // «Cargadas 7 partes… 62 vértices» y «da −13,32 m²… No se construye la parcela».
  // Las dos ciertas por separado; juntas, una contradicción — y la segunda es la
  // que el usuario LEE.
  //
  // Las dos mitades usan la MISMA lista publicada, y por eso no pueden divergir:
  // ver `parsers/importar.js#sinDeteccionesDeParcela`, que filtra por
  // `datos.bloqueo` y no por tipo (`SEPARADOR_POLIGONO` lo comparte con el mensaje
  // del reparto por capas, que aquí SÍ hace falta) ni por texto.
  const detecciones = sinDeteccionesDeParcela(res.detecciones)
  const bloqueos = res.resumen.bloqueos.filter((b) => !BLOQUEOS_SOLO_PARCELA.includes(b))

  const formato = res.resumen.formato
  const origen = ORIGEN_POR_FORMATO[formato]
  if (origen === undefined) {
    // Inalcanzable: `importar` solo emite LIST/TXT/DXF. Si deja de ser cierto,
    // que se vea aquí y no en un `ORIGEN_PARTE` inválido dentro de una parte.
    throw new RangeError(
      `entradaDesdeTexto: 'importar' ha devuelto el formato ${JSON.stringify(formato)}, ` +
        `que no tiene ORIGEN_PARTE. Conocidos: ${Object.keys(ORIGEN_POR_FORMATO).join(', ')}.`,
    )
  }

  const partes = res.anillos.map((anillo, i) => {
    const recinto = recintoDe(anillo)
    if (recinto === null) {
      detecciones.push(
        crearDeteccionEdificio(
          TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA,
          `La parte ${i + 1} entra sin contorno dibujable: la polilínea nº ${i + 1} del fichero ` +
            'no traía ni un vértice. Se puede renombrar y dibujar más adelante, pero hoy no se ' +
            'pinta en el mapa ni cuenta superficie.',
          SEVERIDAD.AVISO,
          { indice: i },
        ),
      )
    }
    return crearParteConstruccion({
      nombre: nombreParteGenerico(i),
      tipo: TIPO_PARTE.PRINCIPAL, // F11: toda parte nace PRINCIPAL (desviación 5).
      recinto,
      origen,
    })
  })

  if (formato === VIA.DXF && typeof opts.capa === 'string') {
    decirCapasDescartadas(res.detecciones, opts.capa, detecciones)
  }

  const edificio =
    bloqueos.length === 0
      ? crearEdificio({
          refcat: opts.refcat ?? null,
          modelo,
          partes,
          parcelaContexto: opts.parcelaContexto ?? null,
          // Un volcado de CAD es la MEDICIÓN del técnico, no la geometría oficial
          // del Catastro: `construccionOficial` se queda a `null`, igual que
          // `parcela.geometriaOficial` no se rellena al importar un DXF.
          construccionOficial: null,
        })
      : null

  return {
    edificio,
    detecciones,
    resumen: armarResumen({
      via: formato,
      formatoAutodetectado: res.resumen.formatoAutodetectado,
      origen,
      partes,
      // Solo el DXF tiene capas. En LIST y TXT `importar` devuelve `''` para que
      // su array sea 1:1 con los anillos; aquí se dice `null`, que es «esta vía no
      // tiene el concepto» y no «todas las capas se llaman vacío».
      capas: formato === VIA.DXF ? [...res.resumen.capas] : null,
      huso: res.resumen.huso,
      bloqueos,
      construido: edificio !== null,
      detecciones,
    }),
  }
}

// ── Vías 2 y 3 · el dialecto BU (fichero y servicio) ─────────────────────────

/** Rótulo de un feature del BU para los mensajes: el `localId`, o su posición. */
const rotulo = (feature, i, que) =>
  typeof feature.localId === 'string' && feature.localId.length > 0
    ? `«${feature.localId}»`
    : `${que} nº ${i + 1}`

/**
 * Convierte UN feature del BU (una parte o una otra-construcción) en 1..N
 * `ParteConstruccion`: **una por anillo**, porque un `ParteConstruccion` guarda UN
 * recinto y en esta rama cada anillo es su propio exterior.
 *
 * @returns {object[]} Las partes creadas (vacío nunca: sin anillos sale una sin
 *   contorno, que el modelo admite como «pendiente de dibujar»).
 */
function partesDeFeature(feature, indiceFeature, que, origen, siguienteIndice, detecciones) {
  const quien = rotulo(feature, indiceFeature, que)
  const anillos = Array.isArray(feature.anillos) ? feature.anillos : []
  const huecos = Array.isArray(feature.huecos) ? feature.huecos : []

  if (anillos.length === 0) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA,
        `${quien} entra sin contorno dibujable: el documento no traía ninguna geometría ` +
          'utilizable para esta construcción. Se puede renombrar y dibujar más adelante; hoy no ' +
          'se pinta en el mapa ni cuenta superficie.',
        SEVERIDAD.AVISO,
        { localId: feature.localId ?? null, miembro: indiceFeature },
      ),
    )
    return [
      crearParteConstruccion({
        nombre: nombreParteGenerico(siguienteIndice),
        tipo: TIPO_PARTE.PRINCIPAL,
        recinto: null,
        origen,
      }),
    ]
  }

  if (anillos.length > 1) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.PATCHES_MULTIPLES,
        `${quien} traía ${anillos.length} caras (${anillos.map((a) => a.length).join(' + ')} ` +
          `vértices) dentro de una sola geometría, y entra como ${anillos.length} partes ` +
          'independientes: una parte del modelo guarda UN contorno, así que quedarse con la ' +
          'primera dejaría el resto fuera sin decirlo.',
        SEVERIDAD.INFO,
        {
          localId: feature.localId ?? null,
          caras: anillos.length,
          vertices: anillos.map((a) => a.length),
          destino: 'UNA_PARTE_POR_CARA',
        },
      ),
    )
  }

  if (huecos.length > 0) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.PATCHES_MULTIPLES,
        `${quien} traía ${huecos.length} hueco(s) («gml:interior») que NO llegan al modelo: en ` +
          'esta rama una parte es un contorno macizo (ficha F11 §Modelo: «sin huecos en ' +
          'partes»). Los vértices están en el fichero, sin tocar; si esa parte tiene de verdad ' +
          'un patio, hay que repartirla en varias partes.',
        SEVERIDAD.AVISO,
        {
          localId: feature.localId ?? null,
          huecos: huecos.length,
          vertices: huecos.map((a) => a.length),
          destino: 'HUECOS_DESCARTADOS',
        },
      ),
    )
  }

  return anillos.map((anillo, j) =>
    crearParteConstruccion({
      nombre: nombreParteGenerico(siguienteIndice + j),
      tipo: TIPO_PARTE.PRINCIPAL, // F11: siempre PRINCIPAL (desviación 5).
      recinto: recintoDe(anillo),
      // Las plantas van a `null` por ALCANCE, no porque no vengan: ver
      // `PLANTAS_DESCARTADAS` más abajo.
      plantasSobreRasante: null,
      plantasBajoRasante: null,
      origen,
    }),
  )
}

/** Las plantas de las partes que el documento SÍ traía y aquí se tiran. */
function decirPlantasDescartadas(partesBu, detecciones) {
  const conPlantas = partesBu
    .map((p, i) => ({
      localId: p.localId ?? null,
      indice: i,
      arriba: p.numberOfFloorsAboveGround ?? null,
      abajo: p.numberOfFloorsBelowGround ?? null,
    }))
    .filter((p) => p.arriba !== null || p.abajo !== null)
  if (conPlantas.length === 0) return

  detecciones.push(
    crearDeteccionEdificio(
      TIPO_EDIFICIO.PLANTAS_DESCARTADAS,
      `El documento trae las plantas de ${conPlantas.length} de las ${partesBu.length} partes ` +
        `(sobre rasante ${conPlantas.map((p) => p.arriba ?? '—').join(', ')}; bajo rasante ` +
        `${conPlantas.map((p) => p.abajo ?? '—').join(', ')}) y esta versión NO las guarda: en ` +
        'F11 toda parte entra con las plantas sin asignar, y se asignan una a una en la fase ' +
        'siguiente. El dato sigue en el fichero, sin tocar.',
      SEVERIDAD.AVISO,
      { partes: conPlantas, total: partesBu.length },
    ),
  )
}

/**
 * ⛔ La parte SOLO bajo rasante. **Entra marcada, no se descarta**, y estas son
 * las cuatro razones, porque el plan pedía decidir y escribir el porqué
 * (desviación 10):
 *
 *   1. **Manda el dato** (regla de oro 8). El fichero dice que esa construcción
 *      existe y trae sus 35 vértices; tirarla sería que la aplicación decidiera
 *      por el técnico qué partes de su edificio son reales.
 *   2. **Es la geometría OFICIAL.** Va también a `construccionOficial`, que es el
 *      término de comparación del contraste de F14: contrastar contra 12 de 13
 *      partes daría una diferencia inventada por nosotros.
 *   3. **El convenio de la ficha es de SALIDA, no de entrada.** «Solo partes con
 *      volumen sobre rasante» describe lo que se GENERA, y F11 no genera nada
 *      (el GML de edificio es F13).
 *   4. **F12 es quien puede resolverlo bien**: allí se asignan plantas y tipo por
 *      parte, con el técnico delante. Descartarla aquí le quitaría la decisión y,
 *      además, en silencio: al llegar a F12 no habría rastro de que faltaba una.
 */
function decirBajoRasante(partesBu, detecciones) {
  const bajo = []
  partesBu.forEach((p, i) => {
    if (p.numberOfFloorsAboveGround === 0 && typeof p.numberOfFloorsBelowGround === 'number' &&
        p.numberOfFloorsBelowGround > 0) {
      bajo.push({ localId: p.localId ?? null, indice: i, abajo: p.numberOfFloorsBelowGround })
    }
  })
  if (bajo.length === 0) return

  detecciones.push(
    crearDeteccionEdificio(
      TIPO_EDIFICIO.PARTE_BAJO_RASANTE,
      `${bajo.length === 1 ? 'Una parte declara' : `${bajo.length} partes declaran`} 0 plantas ` +
        `sobre rasante y ${bajo.map((p) => p.abajo).join(', ')} bajo rasante ` +
        `(${bajo.map((p) => p.localId ?? `nº ${p.indice + 1}`).join(', ')}): es volumen ` +
        'enterrado. Entra igual, con su contorno, porque el documento la trae y porque es la ' +
        'geometría oficial contra la que se contrasta; el convenio de «solo partes sobre ' +
        'rasante» se aplica al generar el GML, no al leerlo. Revísala al asignar las plantas.',
      SEVERIDAD.AVISO,
      { partes: bajo },
    ),
  )
}

/** La envolvente del `Building`: NO entra como parte. Ver la cabecera. */
function decirEnvolvente(edificioBu, detecciones) {
  const anillos = Array.isArray(edificioBu?.anillos) ? edificioBu.anillos : []
  if (anillos.length === 0) return
  detecciones.push(
    crearDeteccionEdificio(
      TIPO_EDIFICIO.PATCHES_MULTIPLES,
      `El «Building» del documento trae su propia huella (${anillos.length} cara(s), ` +
        `${anillos.map((a) => a.length).join(' + ')} vértices) y NO entra como parte: en INSPIRE ` +
        'esa huella es la envolvente del edificio entero, o sea la unión de sus partes, y este ' +
        'modelo la DERIVA en vez de guardarla. Guardarla contaría su superficie dos veces. De ' +
        'ese miembro se aprovechan la referencia catastral y los atributos.',
      SEVERIDAD.INFO,
      {
        localId: edificioBu.localId ?? null,
        caras: anillos.length,
        vertices: anillos.map((a) => a.length),
        destino: 'DESCARTADA_ENVOLVENTE',
      },
    ),
  )
}

/**
 * Traduce los atributos semánticos del `Building` al vocabulario del modelo,
 * diciendo lo que no tiene equivalente.
 *
 * @returns {Record<string, unknown>} Subconjunto de `ATRIBUTOS_COMPLETO`.
 */
function atributosDeBu(edificioBu, detecciones) {
  const atributos = {}
  if (edificioBu === null || edificioBu === undefined) return atributos

  // currentUse → usoDominante. El VALOR se conserva CRUDO (`'1_residential'`):
  // `model/edificio.js` no tiene vocabulario cerrado para el uso, así que
  // traducirlo a una etiqueta nuestra sería inventar un dominio que nadie más
  // conoce. Lo que se traduce es el NOMBRE del campo.
  if (typeof edificioBu.currentUse === 'string' && edificioBu.currentUse.length > 0) {
    atributos.usoDominante = edificioBu.currentUse
  }

  const condicion = edificioBu.conditionOfConstruction
  if (typeof condicion === 'string' && condicion.length > 0) {
    const estado = CONDICION_A_ESTADO[condicion]
    if (estado === undefined) {
      detecciones.push(
        crearDeteccionEdificio(
          TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO,
          `El documento declara un estado de conservación «${condicion}», que no tiene ` +
            `equivalente en el vocabulario de esta aplicación ` +
            `(${Object.keys(CONDICION_A_ESTADO).join(', ')}). El estado se deja sin fijar en vez ` +
            'de aproximarlo al más parecido; el valor original sigue en el fichero.',
          SEVERIDAD.AVISO,
          { atributo: 'estadoConservacion', valorInspire: condicion },
        ),
      )
    } else {
      atributos.estadoConservacion = estado
    }
  }

  if (Number.isFinite(edificioBu.numberOfBuildingUnits)) {
    atributos.numeroInmuebles = edificioBu.numberOfBuildingUnits
  }
  if (Number.isFinite(edificioBu.numberOfDwellings)) {
    atributos.numeroViviendas = edificioBu.numberOfDwellings
  }

  // dateOfConstruction. Medido: el Catastro lo refiere al 1 de enero y trae el
  // MISMO valor en `beginning` y en `end` ('1997-01-01T00:00:00'). Solo el año
  // llega al modelo, que es lo que `anioConstruccion` guarda.
  const fecha = edificioBu.dateOfConstruction
  const anioDe = (t) => {
    const m = typeof t === 'string' ? /^(\d{4})/.exec(t) : null
    return m === null ? null : Number(m[1])
  }
  if (fecha) {
    const anio = anioDe(fecha.beginning) ?? anioDe(fecha.end)
    if (anio !== null) atributos.anioConstruccion = anio
    const fin = anioDe(fecha.end)
    if (fin !== null && anio !== null && fin !== anio) {
      // `end` NO es el año de reforma: en INSPIRE es el fin del periodo de obra.
      // Meterlo en `anioReforma` sería inventarse una reforma que nadie declara.
      detecciones.push(
        crearDeteccionEdificio(
          TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO,
          `La fecha de construcción del documento abarca de ${anio} a ${fin}. Se guarda ${anio} ` +
            'como año de construcción y el otro extremo NO se guarda: en INSPIRE es el fin del ' +
            'periodo de obra, no un año de reforma, y ponerlo ahí sería declarar una reforma que ' +
            'el fichero no declara. Rellena el año de reforma a mano si procede.',
          SEVERIDAD.AVISO,
          { atributo: 'anioReforma', beginning: fecha.beginning, end: fecha.end },
        ),
      )
    }
  }

  // officialArea → superficieConstruida, solo la referencia `grossFloorArea`.
  const areas = Array.isArray(edificioBu.officialArea) ? edificioBu.officialArea : []
  const bruta = areas.find((a) => a?.referencia === REFERENCIA_SUPERFICIE_CONSTRUIDA)
  if (bruta !== undefined && Number.isFinite(bruta.valor)) {
    atributos.superficieConstruida = bruta.valor
  }
  const otras = areas.filter((a) => a?.referencia !== REFERENCIA_SUPERFICIE_CONSTRUIDA)
  if (otras.length > 0) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO,
        `El documento declara ${otras.length} superficie(s) oficial(es) que este modelo no ` +
          `guarda (${otras.map((a) => `«${a.referencia}»`).join(', ')}): la única que tiene ` +
          `sitio es «${REFERENCIA_SUPERFICIE_CONSTRUIDA}», que es la superficie construida. Las ` +
          'demás siguen en el fichero.',
        SEVERIDAD.AVISO,
        { atributo: 'superficieConstruida', referencias: otras.map((a) => a.referencia) },
      ),
    )
  }

  return atributos
}

/**
 * ⭐ **La traducción compartida por las vías 2 y 3.** El `wfsBU` devuelve el mismo
 * dialecto que el fichero, así que una segunda copia de esto sería una copia
 * condenada a divergir. Ver la cabecera.
 *
 * @param {object} res  Un resultado de `gml/parse-bu.js#parsearGmlBu` (contrato C).
 * @param {object} cfg  `{via, origen, formatoAutodetectado, modelo, refcat,
 *   parcelaContexto, fn}`.
 * @returns {EntradaEdificio}
 */
function traducirBu(res, cfg) {
  const detecciones = [...res.detecciones]
  const partesBu = Array.isArray(res.partes) ? res.partes : []
  const otrasBu = Array.isArray(res.otras) ? res.otras : []
  const bloqueos = []

  // ── 1 · ¿Es siquiera un GML de edificio? ──────────────────────────────────
  // `parsearGmlBu` ya ha emitido el ERROR con su explicación (DIALECTO_OTRO_TEMA
  // si es un GML de parcela, RAIZ_INESPERADA / XML_MAL_FORMADO si no es ni eso);
  // aquí solo se le pone el código estable que la interfaz sabe leer. ⚠️ Se
  // pregunta por `ok`, NUNCA por `soportado`: `DIALECTO.BU.soportado` vale `false`
  // en `gml/_comun.js` —es cierto desde la rama de PARCELA, donde la Sede no
  // admite un GML de edificio— y leerlo aquí marcaría el fichero bueno como no
  // soportado. Por eso `parsearGmlBu` devuelve `ok` y no reexpone aquello.
  if (res.ok !== true) {
    bloqueos.push(MOTIVO_ENTRADA.DIALECTO_NO_BU)
  } else {
    // ── 2 · ¿Hay algo que cargar? ───────────────────────────────────────────
    // Medido (T0.1·5): el `wfsBU` contesta 200 OK con la colección VACÍA cuando la
    // parcela no tiene construcciones, y en obra nueva ése es el punto de partida,
    // no una avería. Es bloqueo de ESTA entrada —no hay nada que cargar— y la
    // interfaz tiene que leerlo así: el usuario dibuja o suelta su DXF, no
    // reintenta.
    if (partesBu.length === 0 && otrasBu.length === 0) {
      bloqueos.push(MOTIVO_ENTRADA.SIN_CONSTRUCCION)
      detecciones.push(
        crearDeteccionEdificio(
          TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA,
          res.nMiembros === 0
            ? 'El documento está bien formado y dice que en esa parcela no hay ninguna ' +
              'construcción registrada. No es un fallo: en obra nueva es exactamente el punto ' +
              'de partida — dibuja las partes o carga el DXF del proyecto.'
            : `El documento trae ${res.nMiembros} miembro(s) pero ninguna parte de construcción ` +
              '(«BuildingPart») ni otra construcción («OtherConstruction»): solo el «Building», ' +
              'cuya huella es la envolvente y no se guarda. Las partes vienen de la consulta ' +
              '«GetBuildingPartByParcel»; con este documento solo no hay geometría que cargar.',
          SEVERIDAD.AVISO,
          { miembros: res.nMiembros, partes: 0, otras: 0 },
        ),
      )
    }
    // ── 3 · ¿Se sabe en qué sistema están las coordenadas? ──────────────────
    // `parsearGmlBu` deja `srs` a `null` cuando falta el `srsName`, cuando el
    // documento se contradice o cuando no es un EPSG soportado, y en los tres casos
    // ya ha emitido su ERROR. Sin SRS no hay huso, y sin huso la geometría no se
    // puede situar: el código estable es el mismo que usa la rama de parcela.
    if (res.srs === null && (partesBu.length > 0 || otrasBu.length > 0)) {
      bloqueos.push(MOTIVO_ENTRADA.HUSO_NO_RESUELTO)
    }
  }

  // ── 4 · Las partes ────────────────────────────────────────────────────────
  const partes = []
  partesBu.forEach((p, i) => {
    partes.push(
      ...partesDeFeature(p, i, 'La parte', cfg.origen, partes.length, detecciones),
    )
  })
  const desdeOtras = partes.length
  otrasBu.forEach((o, i) => {
    partes.push(
      ...partesDeFeature(o, i, 'La construcción', cfg.origen, partes.length, detecciones),
    )
  })

  // ⚠️ La piscina entra como PRINCIPAL porque en F11 `TIPO_PARTE.OTRA` está fuera
  // de alcance (desviación 5), y eso es un dato FALSO: se dice. Tirarla sería
  // peor —es una construcción real de la parcela, y el enunciado literal de la
  // ficha §14.2 es «vivienda + porche + piscina»—. El tipo bueno se asigna en F12.
  if (otrasBu.length > 0) {
    const naturalezas = otrasBu.map((o) => o.constructionNature ?? 'sin declarar')
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.TIPO_PARTE_FORZADO,
        `${otrasBu.length === 1 ? 'Una construcción' : `${otrasBu.length} construcciones`} del ` +
          `documento no ${otrasBu.length === 1 ? 'es' : 'son'} un cuerpo de edificio ` +
          `(${naturalezas.map((n) => `«${n}»`).join(', ')}) y entra${otrasBu.length === 1 ? '' : 'n'} ` +
          `como parte${otrasBu.length === 1 ? '' : 's'} PRINCIPAL. Esta versión solo maneja ese ` +
          'tipo; el que le corresponde («otra construcción», sin plantas) se asigna en la fase ' +
          `siguiente. ${otrasBu.length === 1 ? 'Es la parte' : 'Son las partes'} ` +
          `${otrasBu.map((_, i) => desdeOtras + i + 1).join(', ')} de la lista.`,
        SEVERIDAD.AVISO,
        {
          construcciones: otrasBu.map((o, i) => ({
            localId: o.localId ?? null,
            constructionNature: o.constructionNature ?? null,
            parte: desdeOtras + i,
          })),
        },
      ),
    )
  }

  decirPlantasDescartadas(partesBu, detecciones)
  decirBajoRasante(partesBu, detecciones)
  decirEnvolvente(res.edificio, detecciones)

  // ── 5 · Identidad y atributos ─────────────────────────────────────────────
  // ⛔ La RC NO está en las partes ni en la piscina como declaración propia:
  // `bu-core2d:reference` solo existe en el `Building`. En los otros dos tipos sale
  // del `refcat=` del `xlink:href` de `bu-core2d:cadastralParcels`, que sí llevan
  // los tres — y por eso el lector la devuelve en los tres. Lo que NO se puede
  // hacer, y está medido, es cortar el `localId` por longitud: vale
  // `'…_part10'` en una parte y `'…_PI.1'` en la piscina.
  const refcat =
    opcionalTexto(cfg.refcat) ??
    opcionalTexto(res.edificio?.refcat) ??
    opcionalTexto(partesBu.find((p) => opcionalTexto(p.refcat) !== null)?.refcat) ??
    opcionalTexto(otrasBu.find((o) => opcionalTexto(o.refcat) !== null)?.refcat)

  let edificio = null
  if (bloqueos.length === 0) {
    edificio = crearEdificio({
      refcat,
      modelo: cfg.modelo,
      partes,
      parcelaContexto: cfg.parcelaContexto,
      // ⭐ La geometría que viene del Catastro —por fichero o por servicio— ES la
      // oficial, y `model/edificio.js` la copia y la CONGELA (regla de oro 2),
      // exactamente como `parcela.geometriaOficial`. Si no se guardara aquí no la
      // guardaría nadie, y el contraste de F14 tendría que volver a pedirla.
      construccionOficial: partes,
    })
    edificio = aplicarAtributos(edificio, atributosDeBu(res.edificio, detecciones), detecciones)
  } else {
    // Sin edificio, los atributos tampoco llegan a ninguna parte: se dice igual,
    // para que la lista de detecciones no cambie de contenido según el desenlace.
    atributosDeBu(res.edificio, detecciones)
  }

  return {
    edificio,
    detecciones,
    resumen: armarResumen({
      via: cfg.via,
      formatoAutodetectado: cfg.formatoAutodetectado,
      origen: cfg.origen,
      partes,
      capas: null, // Un GML no tiene capas, y no se le inventan.
      huso: husoDeSrs(res.srs, partes),
      bloqueos,
      construido: edificio !== null,
      detecciones,
    }),
  }
}

/**
 * Entrada de edificio desde un **GML de edificio existente** (dialecto
 * `DIALECTO.BU`): el fichero que el técnico se ha descargado de la Sede.
 *
 * Lee con `gml/parse-bu.js#parsearGmlBu` y traduce con {@link traducirBu}, la
 * MISMA función que usa la vía del `wfsBU`.
 *
 * **No lanza por el contenido**: un XML roto, un GML de parcela o un fichero de
 * otro tema salen por `resumen.bloqueos` con el código `DIALECTO_NO_BU` y con las
 * detecciones que el lector haya emitido.
 *
 * @param {string} xml  El documento GML COMPLETO, **ya decodificado** a string.
 *   ⚠️ Los cinco ficheros BU reales declaran `ISO-8859-1` en su prólogo:
 *   decodificar es de quien lee el fichero, no de esta capa.
 * @param {object} [opts]  Mismo `modelo`/`refcat`/`parcelaContexto` que
 *   {@link entradaDesdeTexto}. `opts.refcat`, si se da, MANDA sobre la del
 *   documento.
 * @returns {EntradaEdificio}
 * @throws {TypeError}   Si `xml` no es un string (lo lanza `parsearGmlBu`).
 * @throws {RangeError}  Si `opts.modelo` no está en `MODELO_EDIFICIO`.
 */
export function entradaDesdeGmlBu(xml, opts = {}) {
  const modelo = exigirModelo(opts.modelo ?? MODELO_EDIFICIO.SIMPLIFICADO, 'entradaDesdeGmlBu')
  return traducirBu(parsearGmlBu(xml), {
    via: VIA.GML_EXISTENTE,
    origen: ORIGEN_PARTE.GML_EXISTENTE,
    // El dialecto lo ha DEDUCIDO el lector del contenido del fichero: nadie le ha
    // dicho que fuera BU. En la vía del WFS es al revés, y por eso allí es `false`.
    formatoAutodetectado: true,
    modelo,
    refcat: opts.refcat ?? null,
    parcelaContexto: opts.parcelaContexto ?? null,
  })
}

/**
 * Entrada de edificio desde el **servicio `wfsBU` del Catastro**.
 *
 * ⭐ Recibe YA PARSEADO lo que `services/catastro-edificio.js` (T2.2, contrato F)
 * entrega en su `datos`: un resultado de `parsearGmlBu` —posiblemente el de las
 * DOS consultas medidas (`GetAllConstructionByParcel` + `GetBuildingPartByParcel`)
 * fundido en uno—. No recibe texto, no hace red y no conoce ninguna URL: esta capa
 * es pura.
 *
 * Y aquí está el ahorro grande de F11: **usa exactamente la misma traducción que
 * `entradaDesdeGmlBu`**, porque el servicio devuelve exactamente el mismo dialecto
 * que el fichero. Lo único que cambia es la procedencia declarada.
 *
 * @param {object} datos  Resultado de `parsearGmlBu` (contrato C): al menos
 *   `{ok, srs, edificio, partes, otras, nMiembros, detecciones}`.
 * @param {object} [opts]  Igual que en {@link entradaDesdeGmlBu}.
 * @returns {EntradaEdificio}
 * @throws {TypeError}   Si `datos` no tiene forma de resultado de `parsearGmlBu`.
 *   Es contrato del PROGRAMADOR: pasarle aquí el `ResultadoEdificioCatastro`
 *   entero en vez de su `.datos` es el error fácil, y tiene que sonar.
 * @throws {RangeError}  Si `opts.modelo` no está en `MODELO_EDIFICIO`.
 */
export function entradaDesdeWfsBu(datos, opts = {}) {
  const modelo = exigirModelo(opts.modelo ?? MODELO_EDIFICIO.SIMPLIFICADO, 'entradaDesdeWfsBu')
  if (
    datos === null ||
    typeof datos !== 'object' ||
    Array.isArray(datos) ||
    typeof datos.ok !== 'boolean' ||
    !Array.isArray(datos.partes) ||
    !Array.isArray(datos.otras) ||
    !Array.isArray(datos.detecciones)
  ) {
    throw new TypeError(
      "entradaDesdeWfsBu: 'datos' debe ser el resultado de parsearGmlBu (contrato C), con " +
        "{ok, partes[], otras[], detecciones[]}; recibido " +
        `${datos === null || typeof datos !== 'object' ? JSON.stringify(datos) : `un objeto con las claves ${Object.keys(datos).join(', ')}`}. ` +
        'Si vienes de `services/catastro-edificio.js`, lo que hay que pasar es su `.datos`, no ' +
        'el ResultadoEdificioCatastro entero.',
    )
  }
  return traducirBu(datos, {
    via: VIA.WFS,
    origen: ORIGEN_PARTE.WFS,
    // Nadie ha deducido nada: se ha pedido a un servicio que solo habla BU.
    formatoAutodetectado: false,
    modelo,
    refcat: opts.refcat ?? null,
    parcelaContexto: opts.parcelaContexto ?? null,
  })
}

// ── El punto del que se deduce la RC ─────────────────────────────────────────

/**
 * Punto UTM **estrictamente interior** a la parte de MAYOR superficie del
 * edificio. Es lo que `app/` le pasa al Catastro para deducir la referencia
 * catastral (ficha F11 §14.3).
 *
 * ⛔ **NO es el centroide, y eso está MEDIDO.** `app/cableado-catastro.js:133-141`
 * lo dejó escrito para la rama de parcela: el centroide aritmético de una figura
 * en L cae FUERA del polígono, el Catastro no tiene forma de saberlo y contesta
 * tan tranquilo con la referencia de la parcela VECINA. La aplicación rellenaría
 * el campo con un dato malo, en silencio, que es justo lo que prohíbe la regla de
 * oro 1. Se usa `gml/anillos.js#puntoInterior`, que VERIFICA el punto en vez de
 * confiar.
 *
 * Tres decisiones que hay dentro, cada una con su motivo:
 *
 *   · **La parte de MAYOR superficie** (`geo/area.js#superficie`), no la primera:
 *     en el fixture real la primera parte del documento tiene 4 vértices y 12 m²,
 *     y deducir la RC desde un cobertizo que puede caer en la parcela de al lado
 *     es exactamente el fallo que esto evita. Empate ⇒ la de menor índice, para
 *     que dos llamadas den siempre lo mismo.
 *   · **Se le pasa como array de UN recinto.** `gml/anillos.js#validarRecintos`
 *     exige `recintos[0]` EXTERIOR y todo lo demás HUECO, y un edificio de trece
 *     partes son trece exteriores: pasarlo tal cual **lanzaría**. Aquí no hay
 *     huecos que descontar (ficha §Modelo: «sin huecos en partes»).
 *   · **Sus detecciones se DESCARTAN.** Hablan del `cp:referencePoint` y de «lo
 *     que el Catastro rechaza al inscribir», y aquí no se está serializando nada:
 *     republicarlas sería contarle al usuario un problema que no tiene. Es
 *     literalmente lo que ya hace `app/cableado-catastro.js:1146`, con el mismo
 *     razonamiento escrito.
 *
 * @param {object} edificio  El POJO de `crearEdificio`.
 * @returns {[number, number]|null}  El punto, o `null` si ninguna parte tiene un
 *   contorno del que sacarlo (ninguna con recinto, o todas con menos de 3
 *   vértices, o geometría tan degenerada que no hay ningún punto interior). El
 *   llamante decide qué decirle al usuario: esta función no emite detecciones.
 * @throws {TypeError}  Si `edificio` no tiene forma de Edificio (contrato del
 *   programador, igual que en `edificio/mutaciones.js`).
 */
export function puntoDeReferencia(edificio) {
  if (!edificio || typeof edificio !== 'object' || Array.isArray(edificio)) {
    throw new TypeError(
      `puntoDeReferencia: 'edificio' debe ser el POJO de crearEdificio; recibido ${JSON.stringify(edificio)}.`,
    )
  }
  if (!Array.isArray(edificio.partes)) {
    throw new TypeError(
      `puntoDeReferencia: 'edificio.partes' debe ser un array; recibido ${typeof edificio.partes}.`,
    )
  }

  let mejor = null
  edificio.partes.forEach((parte) => {
    const vertices = verticesUtiles(parte)
    if (vertices === null) return
    const area = superficie([{ vertices, tipo: TIPO_RECINTO.EXTERIOR }])
    if (mejor === null || area > mejor.area) mejor = { vertices, area }
  })
  if (mejor === null) return null

  const { punto } = puntoInterior([
    { vertices: copiarAnillo(mejor.vertices), tipo: TIPO_RECINTO.EXTERIOR },
  ])
  return punto
}
