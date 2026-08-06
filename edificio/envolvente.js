// edificio/envolvente.js — F12 · T1.3. LA ENVOLVENTE DEL EDIFICIO, DERIVADA.
//
// En INSPIRE, la geometría del `bu-ext2d:Building` es la huella del edificio
// ENTERO: la unión de sus partes. Este proyecto la declara **derivada y no la
// guarda** desde F00 (`model/edificio.js:22-26`), y ése es el criterio de
// aceptación 3 de la ficha: se recalcula al cambiar las partes y **no es
// editable como dato**. Aquí se calcula; nadie la almacena.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ VIVE AQUÍ Y NO EN `model/edificio.js`, QUE ES LO QUE DICE LA FICHA
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ **Desviación declarada respecto de `spec/feature-12-edificio-partes.md`**,
// que la lista en «Ficheros» como «envolvente derivada en `model/edificio.js`».
// Dos motivos, y el segundo es el que decide:
//
//   1. `model/` no importa Turf en ninguna de sus dos ramas. Meterlo ahí le
//      colgaría el motor booleano al MODELO, que hoy es aritmética y validación
//      de dominio, y lo cargaría en cualquiera que solo quiera `crearParcela`.
//   2. **El modelo es el sitio de lo que SE GUARDA**, y esto es justo lo que no
//      se guarda. Una función que calcula la envolvente viviendo en el fichero
//      cuya cabecera dice «la envolvente NO se almacena» es una invitación
//      permanente a almacenarla — y guardarla es lo que rompe el criterio 3 y
//      cuenta la superficie dos veces (`edificio/entrada.js` ya lo razona al
//      descartar el `Building` del GML).
//
// ═════════════════════════════════════════════════════════════════════════════
// SOBRE RASANTE, Y LO QUE ESO DESCARTA — MEDIDO, NO SUPUESTO
// ═════════════════════════════════════════════════════════════════════════════
// La ficha dice «una línea que rodea todas las partes **sobre rasante**», y eso
// hay que aplicarlo al pie de la letra aunque el resultado sorprenda:
//
// ⛔ En el fixture real `bu_buildingpart_9398516VK3799G.gml` (13 partes,
// medido en la fase 0 de F12) **`Parte 10` es la MAYOR con diferencia — 245,90 m²
// contra 126,87 la siguiente— y tiene 0 plantas sobre rasante y 1 bajo**: es un
// sótano. Su superficie es el 43 % de la suma de las trece. O sea que **la
// envolvente de ese edificio EXCLUYE su parte más grande**, y no es un fallo: un
// sótano no tiene huella sobre el terreno. Quien pinte esto tiene que poder
// decírselo al técnico, y por eso {@link envolventeDe} devuelve `excluidas`
// **con nombre y motivo**, y no una lista de anillos a secas.
//
// El criterio es explícito, y por eso no puede degradar en silencio:
//   · `plantasSobreRasante > 0`   → entra.
//   · `plantasSobreRasante === 0` → NO entra, motivo `SOLO_BAJO_RASANTE`.
//   · `plantasSobreRasante === null` (no se sabe todavía) → **ENTRA**, motivo
//     `SIN_PLANTAS_DECLARADAS` en `incluidasPorDefecto`. Es la decisión menos
//     mala de las dos: al cargar un DXF **ninguna** parte trae plantas (F11 las
//     deja a `null` y F12 se las pide al técnico), así que tratar `null` como
//     «bajo rasante» dejaría la envolvente VACÍA justo en el caso más común, y
//     una envolvente vacía se lee como «no hay edificio». Entra, y se dice que
//     ha entrado por defecto y no por dato.
//   · Tipo `OTRA` (piscina y similares) → NO entra, motivo `NO_ES_PRINCIPAL`.
//     Una piscina no es volumen edificado: sus plantas son `null` por convenio
//     (override O11) y meterla en la envolvente del edificio sería declarar como
//     construido el hueco de la piscina.
//
// ── `[]` NO PUEDE SIGNIFICAR DOS COSAS ──────────────────────────────────────
// Es la misma regla que `derivacion/topologia.js` se impuso en F17.
// `recintos: []` significa **«no hay envolvente que dibujar»** y nada más; si la
// unión no se pudo hacer, `saltados` no está vacío y dice por qué. Comprobar
// solo `recintos.length === 0` es leer un silencio como un cero.
//
// Módulo PURO: sin DOM, sin Leaflet, sin estado, sin reloj. Proyecto Vitest `node`.

import { featureCollection, polygon } from '@turf/helpers'
import union from '@turf/union'

import { coordsRegion, recintosDeGeometriaTurf } from '../geo/poligono.js'
import { TIPO_PARTE } from '../model/edificio.js'

/**
 * Por qué una parte se ha quedado fuera de la envolvente. **Cerrado**: la
 * interfaz decide el texto mirando esta clave y no el mensaje (regla de oro 1).
 *
 * @readonly
 */
export const MOTIVO_FUERA = Object.freeze({
  /** Tipo `OTRA`: piscina y similares. No es volumen edificado. */
  NO_ES_PRINCIPAL: 'NO_ES_PRINCIPAL',
  /** `plantasSobreRasante === 0`. Un sótano no tiene huella sobre el terreno. */
  SOLO_BAJO_RASANTE: 'SOLO_BAJO_RASANTE',
  /** Sin contorno todavía: está pendiente de dibujar el recinto. */
  SIN_CONTORNO: 'SIN_CONTORNO',
  /** Tenía contorno, pero no es una región medible (lo dice `saltados`). */
  CONTORNO_NO_APTO: 'CONTORNO_NO_APTO',
})

/** Motivo con el que el motor booleano se rinde. */
export const MOTIVO_ENVOLVENTE = Object.freeze({
  MOTOR_BOOLEANO: 'MOTOR_BOOLEANO',
})

/**
 * @typedef {Object} ParteFuera
 * @property {number} indice   Índice 0-based en `edificio.partes`.
 * @property {string} nombre   El rótulo de la parte, para poder nombrarla.
 * @property {string} motivo   Una clave de {@link MOTIVO_FUERA}.
 */

/**
 * @typedef {Object} Envolvente
 * @property {Array<Array<object>>} recintos  Las piezas de la envolvente, cada
 *   una un array de recintos del modelo (`recintos[0]` EXTERIOR, el resto
 *   huecos). Normalmente UNA; son varias cuando las partes no se tocan entre sí
 *   —dos cuerpos separados en la misma parcela—, que es un caso REAL y no un
 *   error. `[]` significa «no hay envolvente que dibujar».
 * @property {ParteFuera[]} excluidas  Las partes que no han entrado, con su
 *   motivo. Es la mitad del resultado que hace que la cifra se pueda explicar.
 * @property {ParteFuera[]} incluidasPorDefecto  Las que han entrado **sin que
 *   nadie haya declarado sus plantas**. No es un aviso de error: es lo que hay
 *   que poder decir para que nadie dé por confirmado lo que no lo está.
 * @property {number} nIncluidas  Cuántas partes componen la envolvente.
 * @property {Array<object>} saltados  Lo que `coordsRegion` no pudo convertir,
 *   más el fallo del motor booleano si lo hubo. Ver `geo/poligono.js#RecintoSaltado`.
 */

/**
 * La envolvente de un edificio: el contorno que rodea a todas sus partes sobre
 * rasante.
 *
 * ⚠️ **Recibe las PARTES, no el `Edificio`.** Así se puede pedir la envolvente de
 * un subconjunto —lo que se está a punto de aplicar, lo que quedaría si se
 * quitara una— sin fabricar un edificio de mentira para preguntarlo. El llamante
 * escribe `envolventeDe(edificio.partes)`.
 *
 * @param {Array<object>} partes  `ParteConstruccion[]` del modelo. No se muta.
 * @returns {Envolvente}
 * @throws {TypeError} Si `partes` no es un array (bug del llamante).
 */
export function envolventeDe(partes) {
  if (!Array.isArray(partes)) {
    throw new TypeError(
      `envolventeDe: 'partes' debe ser un array de ParteConstruccion; ` +
        `recibido ${JSON.stringify(partes)}.`,
    )
  }

  const saltados = []
  const excluidas = []
  const incluidasPorDefecto = []
  const poligonos = []

  partes.forEach((parte, indice) => {
    const nombre = typeof parte?.nombre === 'string' ? parte.nombre : `Parte ${indice + 1}`
    const fuera = (motivo) => excluidas.push({ indice, nombre, motivo })

    if (parte?.tipo === TIPO_PARTE.OTRA) return fuera(MOTIVO_FUERA.NO_ES_PRINCIPAL)
    if (parte?.plantasSobreRasante === 0) return fuera(MOTIVO_FUERA.SOLO_BAJO_RASANTE)
    if (!Array.isArray(parte?.recinto?.vertices)) return fuera(MOTIVO_FUERA.SIN_CONTORNO)

    // Una parte del modelo es UN anillo exterior (las partes no admiten huecos:
    // criterio de aceptación 4 de la ficha), pero se pasa por `coordsRegion` y no
    // por `coordsPoligono` para no dar por hecho aquí una regla que defiende otro:
    // el día que una parte traiga un `gml:interior` de un fichero ajeno, esto lo
    // trata como región y no lo mide de más.
    const { anillos, saltados: nuevos } = coordsRegion([parte.recinto], `partes[${indice}].recinto`)
    saltados.push(...nuevos)
    if (anillos === null) return fuera(MOTIVO_FUERA.CONTORNO_NO_APTO)

    if (parte.plantasSobreRasante === null || parte.plantasSobreRasante === undefined) {
      incluidasPorDefecto.push({
        indice,
        nombre,
        motivo: 'SIN_PLANTAS_DECLARADAS',
      })
    }
    poligonos.push(polygon(anillos))
  })

  const nIncluidas = poligonos.length
  const vacia = { recintos: [], excluidas, incluidasPorDefecto, nIncluidas, saltados }

  if (nIncluidas === 0) return vacia
  // Con una sola parte la envolvente ES esa parte. No se llama a `union` con un
  // solo polígono: no hay nada que unir, y el viaje de ida y vuelta por el motor
  // booleano puede reordenar vértices sin que nadie gane nada.
  if (nIncluidas === 1) {
    return { ...vacia, recintos: recintosDeGeometriaTurf(poligonos[0]) }
  }

  let resultado
  try {
    resultado = union(featureCollection(poligonos))
  } catch (e) {
    // El motor de barrido (`polyclip-ts`) puede rendirse con anillos que pasan el
    // conteo de vértices y se cruzan consigo mismos. Sale por `saltados`, no por
    // la consola: quien mira la consola no es el técnico que firma el expediente.
    // Mismo trato, y por el mismo motivo, que `derivacion/topologia.js#restar`.
    saltados.push({
      donde: 'envolvente',
      indice: null,
      nVertices: 0,
      motivo: MOTIVO_ENVOLVENTE.MOTOR_BOOLEANO,
      error: String(e && e.message ? e.message : e),
    })
    return vacia
  }

  // `recintosDeGeometriaTurf` digiere `null`, `Feature` y `MultiPolygon` igual, y
  // ya parte el multipolígono en piezas: dos cuerpos que no se tocan salen como
  // dos entradas, que es exactamente lo que hay que dibujar.
  return { ...vacia, recintos: recintosDeGeometriaTurf(resultado) }
}
