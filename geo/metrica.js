// geo/metrica.js — Medida euclídea sobre UTM: distancias, longitudes de lado y
// perímetros. Módulo PURO (sin DOM, sin Leaflet, sin turf) y hoja del grafo de
// dependencias, igual que `geo/area.js`.
//
// POR QUÉ EXISTE (F06, tarea T1.2). `distancia` vivía en `validation/_comun.js`
// porque F02 fue quien primero la necesitó. La edición (`edit/`, F06) y las
// acotaciones del informe (F09) también miden, y hacer que la capa de edición
// importe de la de validación para calcular una hipotenusa es una dependencia
// al revés. La función baja aquí, a `geo/`, donde vive el resto de la aritmética
// del proyecto, y `validation/_comun.js` la RE-EXPORTA para no romper a sus
// consumidores: **una sola definición en todo el proyecto**.
//
// Convenciones (F00, no negociables):
//   · Regla de oro 6 — `turf.distance` y `turf.length` están PROHIBIDAS: son
//     geodésicas esféricas sobre grados y aquí las coordenadas son metros UTM.
//     La métrica es PLANA sobre la proyección, coherente con `geo/area.js`
//     (shoelace, no área geodésica) y con la definición de superficie que usa el
//     propio Catastro. No se corrige por el factor de escala k.
//   · Regla de oro 4 — Anillos ABIERTOS: [[x,y], …] SIN repetir el vértice de
//     cierre. El lado de cierre es v[n−1] → v[0], que es lo que da el `% n`.
//   · Regla de oro 1 — El invariante de `recintos` (el 0 es el EXTERIOR, el
//     resto HUECOS) lo impone `model/parcela.js`. Si llega roto hasta aquí es un
//     bug del PROGRAMA, no un dato del usuario: se lanza, no se absorbe.
//
// A diferencia de `geo/area.js`, aquí NO hace falta trasladar a origen local:
// `Math.hypot` opera sobre DIFERENCIAS de coordenadas, que ya son pequeñas. La
// cancelación catastrófica del shoelace viene de multiplicar coordenadas
// absolutas (Norte ≈ 4·10⁶) entre sí, y eso no pasa en una distancia.

/**
 * Distancia euclídea entre dos vértices UTM, en metros.
 *
 * `Math.hypot` y no `Math.sqrt(dx*dx + dy*dy)`: hypot no desborda ni pierde el
 * resultado por under/overflow del cuadrado intermedio.
 *
 * @param {[number,number]} a  Vértice [x,y] en UTM.
 * @param {[number,number]} b  Vértice [x,y] en UTM.
 * @returns {number}  Distancia en metros, ≥ 0.
 */
export const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Longitudes de los n lados de un anillo ABIERTO, en el orden de sus vértices:
 * el lado `i` va de `v[i]` a `v[(i+1) % n]`, así que el ÚLTIMO elemento del
 * array es el lado de cierre `v[n−1] → v[0]`. El resultado tiene por tanto
 * tantas entradas como vértices, no una menos.
 *
 * **Anillos de menos de 3 vértices: `[]`.** Es una decisión, y esta es la razón.
 * Con n = 2 el `% n` recorrería el mismo segmento dos veces (ida y vuelta) y
 * devolvería `[d, d]`, un «perímetro» del doble de la longitud real: un número
 * plausible y falso, del tipo que nadie revisa. Y con n = 2 no hay anillo que
 * medir —un segmento no encierra nada, igual que `geo/area.js#areaFirmada`
 * devuelve 0 para n < 3—, así que la respuesta honesta es la lista vacía y no
 * un doble conteo silencioso. Señalar la degeneración (anillo con vértices
 * insuficientes) es trabajo de la validación (F02), no de esta función pura.
 *
 * @param {Array<[number,number]>} anillo  Anillo ABIERTO en UTM [[x,y], …].
 * @returns {number[]}  n longitudes en metros (lado i = v[i]→v[(i+1)%n]); `[]` si n < 3.
 */
export function longitudesDeLados(anillo) {
  const n = anillo.length
  if (n < 3) return []

  const lados = new Array(n)
  for (let i = 0; i < n; i++) {
    lados[i] = distancia(anillo[i], anillo[(i + 1) % n])
  }
  return lados
}

/**
 * Perímetro de un anillo ABIERTO: la suma de {@link longitudesDeLados}, con el
 * lado de cierre incluido.
 *
 * @param {Array<[number,number]>} anillo  Anillo ABIERTO en UTM.
 * @returns {number}  Perímetro en metros; 0 si el anillo tiene menos de 3 vértices.
 */
export function perimetroAnillo(anillo) {
  let suma = 0
  for (const l of longitudesDeLados(anillo)) suma += l
  return suma
}

/**
 * Perímetros de un conjunto de recintos, DESGLOSADOS.
 *
 * **Devuelve un objeto y no un número a propósito.** Con huecos, «el perímetro»
 * es una pregunta ambigua: ¿solo el lindero exterior, que es lo que se pisa y lo
 * que se describe en una escritura? ¿o toda la longitud de línea dibujada,
 * huecos incluidos? La tolerancia oficial de identidad del Catastro (**±0,50 m
 * urbana / ±2,00 m rústica**, SPEC §3) se refiere al EXTERIOR. Devolver un solo
 * número obligaría a esta función a elegir en silencio por el llamante y a
 * acertar la mitad de las veces; devolviendo los tres, la decisión la toma quien
 * sabe para qué la quiere y el dato nunca miente. Nótese que `total` es una
 * SUMA, no una resta: a diferencia de la superficie neta
 * (`geo/area.js#superficie` = exterior − huecos), un hueco añade lindero, no lo
 * quita.
 *
 * Invariante (regla de oro 1, mismo criterio que `geo/area.js#superficie`):
 * `recintos[0]` es el EXTERIOR y el resto son HUECOS. Lo impone
 * `model/parcela.js`; si llega roto hasta aquí es un bug del programa y debe
 * sonar, no absorberse.
 *
 * @param {Array<{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}>} recintos
 * @returns {{exterior: number, huecos: number, total: number}}  Metros.
 *   `exterior`: perímetro del lindero exterior. `huecos`: suma de los
 *   perímetros de los huecos. `total`: `exterior + huecos`, la longitud de línea
 *   realmente dibujada.
 * @throws {TypeError} Si `recintos[0]` no es EXTERIOR o algún `recintos[i≥1]` no es HUECO.
 */
export function perimetro(recintos) {
  if (!recintos || recintos.length === 0) return { exterior: 0, huecos: 0, total: 0 }

  if (recintos[0].tipo !== 'EXTERIOR') {
    throw new TypeError(
      `perimetro: recintos[0] debe ser el EXTERIOR; recibido tipo='${recintos[0].tipo}'.`,
    )
  }

  const exterior = perimetroAnillo(recintos[0].vertices)
  let huecos = 0
  for (let i = 1; i < recintos.length; i++) {
    if (recintos[i].tipo !== 'HUECO') {
      throw new TypeError(
        `perimetro: recintos[${i}] debe ser HUECO; recibido tipo='${recintos[i].tipo}'. ` +
          `(El invariante lo impone model/parcela.js — regla de oro 1.)`,
      )
    }
    huecos += perimetroAnillo(recintos[i].vertices)
  }
  return { exterior, huecos, total: exterior + huecos }
}
