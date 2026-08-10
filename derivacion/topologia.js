// derivacion/topologia.js — F17 · La RESTA de dos regiones (único fichero de
// F17 con Turf).
//
// Contrato:
//   · `restar(recintosA, recintosB) → {piezas, saltados, detecciones}`
//
// Es el ÚNICO módulo de la capa `derivacion/` que importa Turf, igual que
// `diagnostico/topologia.js` lo es de la suya y `validation/reglas-topologia.js`
// de la de validación, y por el mismo motivo (regla de oro 6: de Turf, SOLO lo
// topológico, y por SUBPAQUETE —`@turf/difference`—, nunca el meta-paquete).
// Concentrar la dependencia en un fichero es lo que permite que el guardián de la
// capa sea una línea de regex en vez de una lista de excepciones.
//
// ⚠️ **NO ENTRA EN NINGÚN BARREL**, igual que su hermano de F07. Quien quiera
// restar polígonos pasa por `derivacion/cesion.js`, que es quien sabe qué
// significa el resultado; exportar la primitiva por `index.js` invitaría a
// llamarla desde la interfaz y a repartir por ahí la interpretación.
//
// ── LA REGLA DE ORO 5 SE CUMPLE AQUÍ IGUAL QUE EN F07 ───────────────────────
// `turf.area` está prohibida en todo el proyecto: mide sobre una ESFERA
// interpretando las coordenadas como grados, y aquí son metros UTM. Este módulo
// no mide NADA: devuelve geometría traducida al modelo
// (`geo/poligono.js#recintosDeGeometriaTurf`) y quien la mide es `geo/area.js` y
// `geo/grosor.js`. La razón de fondo la explica largo la cabecera de
// `diagnostico/topologia.js`, y vale palabra por palabra: un número plausible y
// equivocado es peor que una excepción, porque la excepción se arregla y el número
// se firma.
//
// ── `MultiPolygon` ES EL CASO NORMAL, Y AQUÍ MÁS QUE EN NINGÚN SITIO ────────
// El sobrante de una parcela editada casi nunca es una sola pieza: mover dos
// linderos opuestos hacia dentro deja dos trozos que no se tocan, y una parcela en
// esquina que cede a dos calles, otros dos. Turf lo materializa como
// `MultiPolygon` y `recintosDeGeometriaTurf` ya lo parte en piezas disjuntas —con
// `recintos[0]` EXTERIOR y los huecos detrás—, que es exactamente la forma que
// necesita `cesion.js` para convertir **cada componente en UNA parcela**.
//
// ── ⛔ `[]` NO PUEDE SIGNIFICAR DOS COSAS ────────────────────────────────────
// Ésta es la decisión de diseño de este módulo. Una lista vacía de piezas puede
// venir de dos sitios opuestos:
//
//     · NO HAY SOBRANTE      — la parcela editada coincide con la oficial. La
//                              respuesta correcta, y tranquilizadora.
//     · NO SE PUDO MEDIR     — la región venía degenerada, o el motor booleano
//                              lanzó. Aquí no hay sobrante MEDIDO; hay una
//                              medición que no se hizo.
//
// Devolver `[]` en los dos casos sería el error silencioso peor de todos, **porque
// el 0 tranquiliza**: el usuario leería «no hay que ceder nada» donde lo cierto es
// «no lo sabemos». Por eso el retorno lleva `saltados` con su sitio, su número de
// vértices y su motivo, clonando el contrato que `diagnostico/topologia.js` fijó en
// F07 por esta misma razón — allí está el precedente y aquí la segunda aplicación.
//
// ── EL `try/catch` ALREDEDOR DE TURF, QUE EN F07 NO HACÍA FALTA ─────────────
// F07 se guarda de los recintos degenerados **por conteo estructural** y sin
// `try/catch`, porque la condición se conoce antes de llamar. Aquí se hace lo mismo
// —`coordsRegion` cuenta vértices antes de construir— **y ADEMÁS se envuelve la
// llamada**, y la diferencia está medida en el plan: `@turf/difference` corre sobre
// `polyclip-ts`, un motor de barrido que puede lanzar con anillos que pasan el
// conteo pero se cruzan consigo mismos. Un fallo suyo tiene que salir por
// `saltados`, NUNCA por la consola —donde no mira nadie— ni como excepción hasta la
// interfaz. El `catch` es estrecho a propósito: no tapa nada más, porque lo demás
// de esta función es aritmética propia que si falla es un bug.
//
// Módulo PURO: sin DOM, sin Leaflet, sin estado, sin reloj.

import difference from '@turf/difference'
import { featureCollection, polygon } from '@turf/helpers'
import union from '@turf/union'

import { coordsRegion, recintosDeGeometriaTurf } from '../geo/poligono.js'
import { MOTIVO_RESTA, SEVERIDAD, TIPO_DERIVACION, crearDeteccionDerivacion } from './_comun.js'

/** @typedef {import('../geo/poligono.js').RecintoSaltado} RecintoSaltado */
/** @typedef {{vertices: Array<[number,number]>, tipo: string}} Recinto */

/**
 * La región de unos recintos como polígono de Turf, o `null` con su motivo.
 *
 * El puente lo pone `geo/poligono.js#coordsRegion` —exterior más huecos como
 * anillos interiores, cerrados con copia (regla de oro 2)— y aquí solo se le añade
 * el `polygon(...)`, que es el import de Turf de esta capa.
 *
 * @param {Recinto[]} recintos
 * @param {string} donde
 * @param {RecintoSaltado[]} saltados  Acumulador; se le AÑADE lo que se salte.
 * @returns {object|null}
 */
function poligonoDeRegion(recintos, donde, saltados) {
  const { anillos, saltados: nuevos } = coordsRegion(recintos, donde)
  saltados.push(...nuevos)
  return anillos === null ? null : polygon(anillos)
}

/**
 * **A menos B**: la parte de la región A que NO está en la región B, en piezas
 * disjuntas y ya traducidas al modelo.
 *
 * Es la operación de la que sale el SOBRANTE de F17: con `A` = geometría oficial y
 * `B` = geometría editada, cada pieza del resultado es un trozo que la parcela
 * suelta y que hay que declarar en el expediente.
 *
 * ⛔ **`piezas: []` significa «no hay sobrante» Y NADA MÁS.** Si la resta no se
 * pudo hacer, `saltados` no está vacío y `detecciones` lo dice con su severidad.
 * Comprobar solo `piezas.length === 0` es leer un silencio como un cero; el
 * llamante tiene que mirar las dos cosas, y por eso vienen juntas.
 *
 * ⚠️ **NO decide nada sobre las piezas**: ni las ordena, ni las nombra, ni descarta
 * las estrechas. Todo eso es de `cesion.js`, que es quien sabe que esto es una
 * cesión y no una intersección. Aquí solo se resta.
 *
 * @param {Recinto[]} recintosA  Minuendo (la geometría OFICIAL). Anillos ABIERTOS
 *   en UTM; `recintosA[0]` EXTERIOR y el resto HUECOS. No se muta.
 * @param {Recinto[]} recintosB  Sustraendo (la geometría EDITADA). No se muta.
 * @returns {{piezas: Array<Recinto[]>, saltados: RecintoSaltado[], detecciones: import('./_comun.js').DeteccionDerivacion[]}}
 * @throws {TypeError} Si alguno no es un array (bug del llamante; lo lanza
 *   `coordsRegion`). Un recinto DEGENERADO no lanza: sale por `saltados`.
 */
export function restar(recintosA, recintosB) {
  const saltados = []
  const detecciones = []

  const polA = poligonoDeRegion(recintosA, 'recintosA', saltados)
  const polB = poligonoDeRegion(recintosB, 'recintosB', saltados)

  // Sin minuendo no hay nada que restar, y decirlo con `[]` a secas sería
  // exactamente el silencio que esta función existe para evitar.
  if (polA === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.REGION_NO_APTA,
        'No se ha podido construir la geometría de partida, así que no hay contra qué ' +
          'restar. No es que no haya sobrante: es que no se ha podido medir.',
        SEVERIDAD.ERROR,
        { donde: 'recintosA', saltados: saltados.filter((s) => s.donde === 'recintosA') },
      ),
    )
    return { piezas: [], saltados, detecciones }
  }

  // Sin sustraendo, el sobrante sería la parcela ENTERA. Eso no es una respuesta
  // útil, es una medición fallida disfrazada de resultado catastrófico: se para.
  if (polB === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.REGION_NO_APTA,
        'No se ha podido construir la geometría que se resta. Seguir daría como sobrante ' +
          'la parcela entera, que es una cifra falsa y alarmante en vez de un aviso.',
        SEVERIDAD.ERROR,
        { donde: 'recintosB', saltados: saltados.filter((s) => s.donde === 'recintosB') },
      ),
    )
    return { piezas: [], saltados, detecciones }
  }

  let resultado
  try {
    // La forma de DOS ARGUMENTOS lanza: `difference` quiere un FeatureCollection,
    // igual que `intersect` (ya escrito en `validation/reglas-topologia.js`).
    resultado = difference(featureCollection([polA, polB]))
  } catch (e) {
    // El motor de barrido (`polyclip-ts`) puede lanzar con anillos que pasan el
    // conteo de vértices pero se cruzan consigo mismos. Sale por `saltados`, no por
    // la consola: quien mira la consola no es el usuario que firma el expediente.
    saltados.push({
      donde: 'restar',
      indice: null,
      nVertices: 0,
      motivo: MOTIVO_RESTA.MOTOR_BOOLEANO,
    })
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.RESTA_FALLIDA,
        'El motor geométrico no ha podido restar estas dos geometrías. Suele ser un ' +
          'contorno que se cruza consigo mismo: revisa la parcela en el mapa.',
        SEVERIDAD.ERROR,
        { error: String(e && e.message ? e.message : e) },
      ),
    )
    return { piezas: [], saltados, detecciones }
  }

  // `null` (A está enteramente dentro de B) y `Feature` los digiere igual
  // `recintosDeGeometriaTurf`, que además ya parte el `MultiPolygon` en piezas.
  const piezas = recintosDeGeometriaTurf(resultado)

  if (piezas.length === 0) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.SIN_SOBRANTE,
        'No queda sobrante: la geometría de partida está enteramente dentro de la otra.',
        SEVERIDAD.INFO,
      ),
    )
  }

  return { piezas, saltados, detecciones }
}

/**
 * **A unida con B**: una sola región con todo lo que cubren las dos.
 *
 * Es la operación que estrena el REPARTO del sobrante (F23): cuando el usuario
 * decide que un trozo que su parcela suelta se lo queda un colindante, la parcela
 * nueva de ese colindante es `(V_of − P_new) ∪ trozo`. Sin esto habría que
 * modelarlo como dos fincas pegadas, que es exactamente lo que no es.
 *
 * ⚠️ **`@turf/union` NO añade un byte al paquete**: ya entró con
 * `edificio/envolvente.js` (F11) y corre sobre el mismo `polyclip-ts` que
 * `difference`. Medido el 2026-08-10 antes de escribir esto, porque la alternativa
 * —encadenar restas para simular una unión— habría sido peor código por un ahorro
 * que no existía.
 *
 * ⛔ **Puede devolver VARIAS piezas, y eso significa algo.** Si A y B no se tocan,
 * la unión es un `MultiPolygon` y aquí salen dos piezas. Quien la llame tiene que
 * mirarlo: dos piezas al unir un trozo con un vecino significa que ese trozo **no
 * linda con él**, y asignárselo crearía una finca en dos pedazos separados.
 *
 * @param {Recinto[]} recintosA  No se muta.
 * @param {Recinto[]} recintosB  No se muta.
 * @returns {{piezas: Array<Recinto[]>, saltados: RecintoSaltado[], detecciones: import('./_comun.js').DeteccionDerivacion[]}}
 * @throws {TypeError} Si alguno no es un array (bug del llamante).
 */
export function unir(recintosA, recintosB) {
  const saltados = []
  const detecciones = []

  const polA = poligonoDeRegion(recintosA, 'recintosA', saltados)
  const polB = poligonoDeRegion(recintosB, 'recintosB', saltados)

  // Aquí, al revés que en `restar`, una región que falta NO es fatal: unir algo con
  // nada da ese algo. Pero se DICE, porque si el llamante creía estar uniendo dos
  // cosas y solo se ha unido una, el resultado es correcto y la expectativa no.
  if (polA === null && polB === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.REGION_NO_APTA,
        'No se ha podido construir ninguna de las dos geometrías que había que unir, así que ' +
          'no hay unión. No es que el resultado esté vacío: es que no se ha podido calcular.',
        SEVERIDAD.ERROR,
        { saltados },
      ),
    )
    return { piezas: [], saltados, detecciones }
  }
  if (polA === null || polB === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.REGION_NO_APTA,
        'Una de las dos geometrías que había que unir no se ha podido construir, así que la ' +
          'unión es solo la otra. Revisa el resultado antes de darlo por bueno.',
        SEVERIDAD.AVISO,
        { donde: polA === null ? 'recintosA' : 'recintosB', saltados },
      ),
    )
    return {
      piezas: recintosDeGeometriaTurf(polA === null ? polB : polA),
      saltados,
      detecciones,
    }
  }

  let resultado
  try {
    resultado = union(featureCollection([polA, polB]))
  } catch (e) {
    saltados.push({
      donde: 'unir',
      indice: null,
      nVertices: 0,
      motivo: MOTIVO_RESTA.MOTOR_BOOLEANO,
    })
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.RESTA_FALLIDA,
        'El motor geométrico no ha podido unir estas dos geometrías. Suele ser un contorno que ' +
          'se cruza consigo mismo: revisa la parcela en el mapa.',
        SEVERIDAD.ERROR,
        { error: String(e && e.message ? e.message : e) },
      ),
    )
    return { piezas: [], saltados, detecciones }
  }

  return { piezas: recintosDeGeometriaTurf(resultado), saltados, detecciones }
}
