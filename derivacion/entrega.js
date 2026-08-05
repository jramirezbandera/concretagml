// derivacion/entrega.js — F17 · tarea 3.1 · EL EXPEDIENTE ENTERO: qué se entrega,
// si vale, y qué acto jurídico dice ser.
//
// Es el orquestador de la fase. No mide nada por su cuenta: encadena lo que ya
// existe y **se para en cuanto algo no cuadra**, que es todo su trabajo.
//
//     derivar  → `derivacion/cesion.js`      (el sobrante, medido y ordenado)
//     validar  → `validation/parcela.js`     CADA pieza, entera
//     cerrar   → `comprobacion/conjunto.js`  las tres afirmaciones
//     nombrar  → `derivacion/identidad.js`   la pareja localId ↔ namespace
//     declarar → `derivacion/operacion.js`   el «Tipo de operación» propuesto
//     escribir → `gml/serialize-cp.js`       UN fichero con N gml:featureMember
//
// Módulo PURO: sin DOM, sin Leaflet, sin red, sin estado y sin reloj.
//
// ── ⚠️ NO DESCARGA, Y ES DELIBERADO (desviación del plan, escrita) ──────────
// El plan de F17 decía «→ un solo fichero por `descargarTexto`». Aquí no se llama:
// `gml/descargar.js` necesita `Blob`, `URL.createObjectURL` y un `<a download>`, y
// meterlo en esta capa la sacaría del barrel raíz —que carga el proyecto Vitest
// `node`, sin DOM— y rompería la suite entera en el import. Es exactamente la misma
// asimetría que `report/`: **el impuro es el CONSUMIDOR del puro**, no al revés.
// Por lo mismo esta función tampoco compone el NOMBRE del fichero: quien lo hace es
// `gml/descargar.js#nombreFicheroGml`, y para llamarlo basta con `refcat` y
// `nMiembros`, que salen aquí.
//
// El motivo por el que existía el ZIP —el navegador **bloquea la segunda descarga
// automática y eso NO se puede detectar desde JavaScript**, sin callback y sin
// excepción— queda satisfecho igual, y por diseño: una sola descarga no tiene
// segunda que bloquear.
//
// ── ⛔ CADA PIEZA PASA LA VALIDACIÓN ENTERA, NO UNA VERSIÓN LIGERA ───────────
// La tentación es validar solo la parcela propia «porque las cesiones las ha
// calculado el programa». Justo al revés: una pieza del sobrante es geometría que
// NADIE ha mirado —sale de un motor booleano sobre dos contornos del usuario— y
// puede traer vértices duplicados por el redondeo, o un anillo de tres puntos
// casi colineales. Si eso llega al fichero, lo caza la Sede y no aquí.
//
// ── ⛔ UNA PIEZA EXCLUIDA SE DICE SIEMPRE ───────────────────────────────────
// El usuario puede dejar fuera un trozo del sobrante, y es legítimo: quizá ese
// trozo no se cede. Lo que no es legítimo es que el expediente salga sin decirlo.
// Cada exclusión emite su detección con la superficie que se queda fuera, y si lo
// excluido rompe el cierre, `comprobarConjunto` lo dice con las tres afirmaciones y
// **la entrega se bloquea**. Un expediente que no cierra vuelve con IVG negativo:
// dejarlo salir «porque el usuario lo ha pedido» sería el error silencioso más caro
// de la aplicación.
//
// ── EL NOMBRE QUE EL USUARIO LE PONE A UNA PIEZA **NO** VA AL `.gml` ────────
// ⚠️ Otra desviación del plan, y ésta importa. El plan mandaba que «el nombre
// escrito llegue al `localId` del fichero». No puede: el `localId` de una cesión
// está MEDIDO (override O19, IVG positivo del 2026-08-03) y es la referencia del
// padre con el ordinal detrás —`7136910UF1473N.1`—. Meter ahí un texto libre
// cambiaría el único identificador de finca que este proyecto ha visto aceptar. Y
// `cp:label` tampoco vale: significa el número de orden de la parcela dentro del
// polígono, no un apodo.
//
// Así que el nombre viaja al INFORME y a la pantalla, que es donde le sirve a una
// persona, y el fichero lleva el identificador que la Sede reconoce. Queda anotado
// en la ficha de F17 para que el guion 16 no busque en el `.gml` algo que por
// decisión no está ahí.

import { validarParcela } from '../validation/parcela.js'
import { comprobarConjunto } from '../comprobacion/conjunto.js'
import { serializarExpedienteCp } from '../gml/serialize-cp.js'

import {
  SEVERIDAD,
  TIPO_DERIVACION,
  crearDeteccionDerivacion,
  describir,
  exigirOpciones,
  exigirRecintos,
  numero,
  resumirDetecciones,
} from './_comun.js'
import { derivarCesion } from './cesion.js'
import { identidadDeCesion, identidadDeParcela } from './identidad.js'
import { tipoDeOperacion } from './operacion.js'

/** @typedef {import('./_comun.js').DeteccionDerivacion} DeteccionDerivacion */
/** @typedef {import('./identidad.js').IdentidadInspire} IdentidadInspire */
/** @typedef {{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}} Recinto */

/**
 * Un miembro del expediente, ya nombrado y ya validado.
 *
 * @typedef {Object} MiembroEntrega
 * @property {number} orden  `0` la parcela propia; `1…N` las cesiones, en el orden
 *   determinista de `derivacion/cesion.js`.
 * @property {boolean} esCesion
 * @property {string} etiqueta  Cómo se llama en los mensajes y en el informe: el
 *   nombre que le haya puesto el usuario, o su `localId`.
 * @property {string|null} nombre  Lo que escribió el usuario, o `null`. **No va al
 *   `.gml`** (ver la cabecera).
 * @property {IdentidadInspire} identidad
 * @property {Recinto[]} recintos
 * @property {{errores: object[], avisos: object[], puedeGenerar: boolean}} validacion
 */

/**
 * Lo que devuelve {@link prepararEntrega}.
 *
 * @typedef {Object} Entrega
 * @property {boolean} puedeEntregarse  `false` en cuanto hay una detección ERROR.
 *   **Es lo que hay que mirar antes de descargar**, no `xml !== null`.
 * @property {string[]} bloqueos  Tipos de las detecciones ERROR, sin repetir.
 * @property {string|null} xml  El documento con N `gml:featureMember`, o `null` si
 *   algo bloquea.
 * @property {number} nMiembros  Para `gml/descargar.js#nombreFicheroGml`.
 * @property {string|null} refcat  La de la finca de partida, para lo mismo.
 * @property {MiembroEntrega[]} miembros
 * @property {import('./operacion.js').OperacionPropuesta} operacion
 * @property {import('../comprobacion/conjunto.js').ComprobacionConjunto|null} cierre
 * @property {import('./cesion.js').Cesion} cesion  La FOTO de la que sale todo.
 * @property {object|null} resumenGml  El `resumen` de `serializarExpedienteCp`.
 * @property {DeteccionDerivacion[]} detecciones
 * @property {{total: number, porTipo: Object<string,number>,
 *   porSeveridad: Object<string,number>}} resumen
 */

/** Texto de usuario recortado, o `null` si no queda nada. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/**
 * Arma el expediente completo a partir de una parcela editada: deriva el sobrante,
 * valida cada pieza, comprueba que el conjunto CIERRE, propone el tipo de operación
 * y escribe **un** `.gml` con N `gml:featureMember`.
 *
 * ⛔ **Mirar `xml !== null` no basta.** El campo que dice si esto se puede
 * presentar es `puedeEntregarse`: el documento puede salir escrito y el conjunto no
 * cerrar, que es precisamente el caso que el IVG devuelve negativo.
 *
 * @param {object} entrada
 * @param {object} entrada.parcela  La `Parcela` del modelo: se leen `recintos`,
 *   `geometriaOficial`, `refcat` e `idLocal`. No se muta.
 * @param {string} entrada.srs  Forma corta (`'EPSG:25830'`…). Va a la validación de
 *   huso de cada pieza y al serializador.
 * @param {import('./cesion.js').Cesion|null} [entrada.cesion=null]  La FOTO del
 *   sobrante. Se pasa cuando la pantalla ya la tiene —para no derivar dos veces y,
 *   sobre todo, para que lo que se entrega sea EXACTAMENTE lo que el usuario ha
 *   revisado—. `null` = se deriva aquí.
 * @param {number[]|null} [entrada.incluidas=null]  Los `orden` de las piezas que
 *   entran. `null` = **todas**, que es el único defecto honesto: dejar fuera algo
 *   por omisión sería decidir por el usuario.
 * @param {Object<number,string>|null} [entrada.nombres=null]  `{orden: 'texto'}`.
 *   Va al informe y a la pantalla, **nunca al `.gml`** (ver la cabecera).
 * @param {string|string[]|null} [entrada.comentario=null]  Comentario del prólogo.
 * @param {number} [entrada.umbralGrosorM]  Solo se usa si hay que derivar.
 * @returns {Entrega}
 * @throws {TypeError}  Si el contrato del llamante está roto: `entrada` no es un
 *   objeto, `parcela` no lo es, `srs` no es texto, `incluidas` trae un `orden` que
 *   no existe en la cesión (eso es un bug de la pantalla, no una elección).
 */
export function prepararEntrega(entrada) {
  exigirOpciones(entrada, 'prepararEntrega', 'un objeto {parcela, srs, …}')

  const {
    parcela,
    srs,
    cesion: cesionDada = null,
    incluidas = null,
    nombres = null,
    comentario = null,
    umbralGrosorM,
  } = entrada

  exigirOpciones(parcela, 'prepararEntrega', 'una Parcela del modelo en `parcela`')
  exigirRecintos(parcela.recintos, 'prepararEntrega', 'parcela.recintos')
  if (typeof srs !== 'string' || srs.trim() === '') {
    throw new TypeError(
      `prepararEntrega: 'srs' debe ser la forma corta del SRS (p. ej. 'EPSG:25830'); recibido ` +
        `${describir(srs)}. La validación de huso y el serializador lo necesitan, y adivinarlo ` +
        'sería emitir coordenadas bajo un sistema que nadie ha declarado.',
    )
  }

  /** @type {DeteccionDerivacion[]} */
  const detecciones = []

  // ── 1 · La FOTO del sobrante ──────────────────────────────────────────────
  const cesion =
    cesionDada ??
    derivarCesion({
      recintos: parcela.recintos,
      geometriaOficial: parcela.geometriaOficial ?? null,
      ...(umbralGrosorM === undefined ? {} : { umbralGrosorM }),
    })
  detecciones.push(...cesion.detecciones)

  const cerrar = (extra) => {
    const bloqueos = [
      ...new Set(detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo)),
    ]
    return {
      puedeEntregarse: bloqueos.length === 0,
      bloqueos,
      xml: null,
      nMiembros: 0,
      refcat: textoONulo(parcela.refcat),
      miembros: [],
      operacion: null,
      cierre: null,
      cesion,
      resumenGml: null,
      detecciones,
      resumen: resumirDetecciones(detecciones),
      ...extra,
    }
  }

  // Si la derivación no se pudo hacer, todo lo de abajo mentiría: el cierre se
  // mediría contra un sobrante que no existe y el tipo de operación se deduciría
  // de un fichero que no se va a escribir.
  if (!cesion.puedeEntregarse) return cerrar({})

  // ── 2 · Qué piezas entran ─────────────────────────────────────────────────
  const porOrden = new Map(cesion.piezas.map((p) => [p.orden, p]))
  const pedidas = incluidas === null ? cesion.piezas.map((p) => p.orden) : [...new Set(incluidas)]
  const desconocidas = pedidas.filter((o) => !porOrden.has(o))
  if (desconocidas.length > 0) {
    throw new TypeError(
      `prepararEntrega: 'incluidas' pide las piezas ${desconocidas.join(', ')} y esta cesión ` +
        `solo tiene ${cesion.piezas.length}. Eso no es una elección del usuario: es que la ` +
        'pantalla está mirando una FOTO distinta de la que se va a entregar (decisión 3C: ' +
        'editar la parcela invalida el sobrante entero).',
    )
  }
  const entran = pedidas.slice().sort((a, b) => a - b).map((o) => porOrden.get(o))

  for (const p of cesion.piezas) {
    if (pedidas.includes(p.orden)) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_EXCLUIDA,
        `La pieza nº ${p.orden} (${numero(p.area, 4)} m²) se queda FUERA del expediente. Si esa ` +
          'superficie sigue siendo de la finca, el conjunto no cubrirá el contorno oficial y el ' +
          'informe de validación volverá negativo.',
        SEVERIDAD.AVISO,
        { orden: p.orden, area: p.area, grosor: p.grosor },
      ),
    )
  }

  // ── 3 · Identidad y validación, miembro a miembro ─────────────────────────
  const refcat = textoONulo(parcela.refcat)
  const idLocal = textoONulo(parcela.idLocal)
  const nombreDe = (orden) => (nombres === null ? null : textoONulo(nombres[orden]))

  const miembros = [
    {
      orden: 0,
      esCesion: false,
      nombre: nombreDe(0),
      identidad: identidadDeParcela({ refcat, idLocal }),
      recintos: parcela.recintos,
    },
    ...entran.map((p) => ({
      orden: p.orden,
      esCesion: true,
      nombre: nombreDe(p.orden),
      identidad: identidadDeCesion({ refcatPadre: refcat, idLocalPadre: idLocal, orden: p.orden }),
      recintos: p.recintos,
    })),
  ].map((m) => {
    const validacion = validarParcela(m.recintos, { srs })
    return { ...m, validacion, etiqueta: m.nombre ?? m.identidad.refcat }
  })

  for (const m of miembros) {
    if (m.validacion.puedeGenerar) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        `«${m.etiqueta}» no pasa la validación geométrica: ` +
          `${m.validacion.errores.map((e) => e.mensaje).join(' ')} ` +
          (m.esCesion
            ? 'Es una pieza que ha calculado la aplicación, así que esto es un problema de la ' +
              'geometría de partida: revisa el lindero que has movido.'
            : 'Corrige la parcela antes de entregar.'),
        SEVERIDAD.ERROR,
        { orden: m.orden, esCesion: m.esCesion, errores: m.validacion.errores },
      ),
    )
  }

  const operacion = tipoDeOperacion(miembros.map((m) => m.identidad))

  const salida = { nMiembros: miembros.length, refcat, miembros, operacion, cesion }
  if (detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)) return cerrar(salida)

  // ── 4 · ¿CIERRA el conjunto? ──────────────────────────────────────────────
  // Sobre las coordenadas YA REDONDEADAS, que es lo que juzga el IVG. Se hace
  // ANTES de escribir: un fichero escrito invita a subirlo.
  const cierre =
    parcela.geometriaOficial === null || parcela.geometriaOficial === undefined
      ? null
      : comprobarConjunto({
          geometriaOficial: parcela.geometriaOficial,
          miembros: miembros.map((m) => ({ etiqueta: m.etiqueta, recintos: m.recintos })),
        })

  if (cierre !== null && cierre.cierra !== true) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.CONJUNTO_NO_CIERRA,
        cierre.cierra === null
          ? 'No se ha podido comprobar que las parcelas del expediente cubran el contorno ' +
            'oficial. Eso NO es que cierre: es que no se sabe, y presentarlo así sería firmarlo ' +
            'a ciegas.'
          : 'Las parcelas del expediente no cubren exactamente el contorno oficial: ' +
            cierre.detecciones
              .filter((d) => d.severidad === 'ERROR')
              .map((d) => d.mensaje)
              .join(' '),
        SEVERIDAD.ERROR,
        { cierra: cierre.cierra, suma: cierre.suma, cobertura: { area: cierre.cobertura.area } },
      ),
    )
    return cerrar({ ...salida, cierre })
  }

  // ── 5 · El fichero ────────────────────────────────────────────────────────
  const { xml, detecciones: detGml, resumen: resumenGml } = serializarExpedienteCp({
    parcelas: miembros.map((m) => ({ ...m.identidad, recintos: m.recintos, srs })),
    comentario,
  })
  // ⚠️ Las detecciones del serializador son de OTRO léxico (`gml/_comun.js`) y no
  // se mezclan con las de aquí: tienen sus propios tipos y la interfaz las pinta
  // igual pero las cuenta aparte. Lo que sí sube es el BLOQUEO, traducido.
  if (xml === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        'El escritor de GML no ha podido emitir el fichero: ' +
          resumenGml.bloqueos.join(', ') +
          '. El detalle está en las detecciones del serializador.',
        SEVERIDAD.ERROR,
        { bloqueos: resumenGml.bloqueos },
      ),
    )
    return cerrar({ ...salida, cierre, resumenGml, deteccionesGml: detGml })
  }

  detecciones.push(
    crearDeteccionDerivacion(
      TIPO_DERIVACION.ENTREGA_LISTA,
      `El expediente sale con ${miembros.length} ` +
        `${miembros.length === 1 ? 'parcela' : 'parcelas'}: cada una pasa la validación ` +
        'geométrica' +
        (cierre === null
          ? '.'
          : ` y entre todas cubren los ${numero(cierre.suma.areaOficial)} m² del contorno ` +
            'oficial.'),
      SEVERIDAD.INFO,
      { nMiembros: miembros.length, tipoOperacion: operacion.tipo },
    ),
  )

  return cerrar({ ...salida, cierre, resumenGml, deteccionesGml: detGml, xml })
}
