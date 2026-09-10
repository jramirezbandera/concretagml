/* -------------------------------------------------------------------------- *
 * test/derivacion/recorte-submilimetrico.test.js — El expediente que se caía   *
 * por una décima de milímetro.                                                 *
 *                                                                              *
 * ── EL DEFECTO, MEDIDO (2026-09-09, expediente 18111A00400806) ─────────────  *
 * El usuario trae su parcela del Catastro, se descarga las colindantes y mueve *
 * un vértice para probar «Rehacer el parcelario». La propuesta sale entera —3   *
 * parcelas, las cifras cuadran al céntimo— y la descarga se bloquea con «una de *
 * las parcelas del expediente no se puede escribir en el fichero».              *
 *                                                                              *
 * La causa: donde la geometría medida cruza el lindero del vecino a menos de    *
 * 1 mm de un vértice suyo, `polyclip-ts` devuelve LOS DOS puntos, y             *
 * `validation/reglas-geometria.js` rechaza ese par como «vértices consecutivos  *
 * duplicados». O sea que una parcela que la aplicación ha calculado ella misma  *
 * la tumbaba una regla escrita para la geometría que dibuja el usuario — y el   *
 * mensaje, encima, le pedía que corrigiera la parcela de OTRO titular.          *
 *                                                                              *
 * La ventana era estrecha y por eso nadie la había visto:                       *
 *                                                                              *
 *     corte a −1,0 mm del vértice del vecino → 6 vértices, válido               *
 *     corte a −0,8 … −0,1 mm                 → 6 vértices, ERROR bloqueante     *
 *     corte a  0,0 mm                        → 4 vértices, válido               *
 *                                                                              *
 * ⚠️ **Este fichero barre la ventana entera, no un punto de ella.** Comprobar   *
 * un solo desplazamiento habría dejado pasar el arreglo que sólo tapa un borde. *
 *                                                                              *
 * Proyecto Vitest `node`: aritmética y Turf, sin DOM.                           *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { derivarCesion } from '../../derivacion/cesion.js'
import { recortarVecinos } from '../../derivacion/vecino.js'
import { prepararEntrega } from '../../derivacion/entrega.js'
import { restar } from '../../derivacion/topologia.js'
import { TIPO_DERIVACION } from '../../derivacion/_comun.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { validarParcela } from '../../validation/parcela.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

// ── El escenario ────────────────────────────────────────────────────────────

const SRS = 'EPSG:25830'
const X0 = 439000
const Y0 = 4479000
const p = (dx, dy) => [X0 + dx, Y0 + dy]
const ext = (vertices) => [{ vertices, tipo: TIPO_RECINTO.EXTERIOR }]

/** Contorno oficial de la parcela del usuario. */
const OFICIAL = ext([p(0, 0), p(100, 0), p(100, 80), p(0, 80)])

/**
 * La colindante, en L, con esquinas REALES en (50,120) y (0,120). Las esquinas
 * tienen que ser de verdad —cambio de dirección— porque si fueran colineales el
 * motor las absorbería y el defecto no aparecería: era la trampa del primer
 * intento de reproducirlo.
 */
const VECINA = ext([p(0, 80), p(100, 80), p(100, 160), p(50, 160), p(50, 120), p(0, 120)])

/** La medición del usuario: su parcela con el lindero norte empujado hasta `y`. */
const medicionHasta = (y) => ext([p(0, 0), p(100, 0), p(100, y), p(0, y)])

/** Toda la cadena, desde la medición hasta el expediente compuesto. */
function expedienteCon(y) {
  const recintos = medicionHasta(y)
  const cesion = derivarCesion({ recintos, geometriaOficial: OFICIAL })
  const recorte = recortarVecinos({
    recintos,
    vecinas: [{ refcat: '18111A00400277', recintos: VECINA }],
    fuera: cesion.puerta.piezas,
  })
  const entrega = prepararEntrega({
    parcela: {
      refcat: '18111A00400806',
      idLocal: '18111A00400806',
      recintos,
      geometriaOficial: OFICIAL,
    },
    srs: SRS,
    cesion: { ...cesion, recorte },
    recorte,
  })
  return { cesion, recorte, entrega }
}

/**
 * Los desplazamientos del corte que barren la ventana, en metros. El vértice del
 * vecino está en `y = 120`; los negativos cortan por debajo (que es donde estaba
 * el fallo) y los positivos por encima.
 */
const DESPLAZAMIENTOS = [
  -0.005, -0.002, -0.001, -0.0008, -0.0005, -0.0003, -0.0001, 0, 0.0001, 0.0003, 0.0005, 0.0008,
  0.001, 0.002, 0.005,
]

// ── Las pruebas ─────────────────────────────────────────────────────────────

describe('derivacion · el colindante recortado a menos de un milímetro de su vértice', () => {
  it('el barrido NO es vacuo: en todos los desplazamientos hay un vecino que recortar', () => {
    // Sin esto, un cambio que dejara de recortar convertiría las comprobaciones
    // de abajo en bucles vacíos pasando en verde.
    for (const d of DESPLAZAMIENTOS) {
      const { recorte } = expedienteCon(120 + d)
      expect(recorte.vecinos, `d = ${d} m`).toHaveLength(1)
      expect(recorte.vecinos[0].trozos.length, `d = ${d} m`).toBeGreaterThan(0)
    }
  })

  it.each(DESPLAZAMIENTOS)('con el corte a %s m del vértice, el trozo del vecino es válido', (d) => {
    const { recorte } = expedienteCon(120 + d)
    for (const trozo of recorte.vecinos[0].trozos) {
      const validacion = validarParcela(trozo.recintos, { srs: SRS })
      expect(
        validacion.errores.map((e) => e.mensaje),
        'el recorte lo calcula la aplicación: no puede salir inválido',
      ).toEqual([])
    }
  })

  it.each(DESPLAZAMIENTOS)('con el corte a %s m, el expediente se puede entregar', (d) => {
    const { entrega } = expedienteCon(120 + d)
    expect(entrega.bloqueos).toEqual([])
    expect(entrega.puedeEntregarse).toBe(true)
    expect(entrega.xml, 'un expediente entregable TIENE que traer fichero').not.toBeNull()
    expect(entrega.nMiembros).toBe(2)
  })

  it('en concreto, ya no sale PIEZA_INVALIDA por un par de vértices del motor', () => {
    // El bloqueo exacto que veía el usuario. Se nombra para que un fallo futuro
    // se lea como la regresión que es y no como «algo se ha roto».
    for (const d of DESPLAZAMIENTOS) {
      const { entrega } = expedienteCon(120 + d)
      expect(entrega.bloqueos, `d = ${d} m`).not.toContain(TIPO_DERIVACION.PIEZA_INVALIDA)
    }
  })
})

describe('derivacion/topologia · lo que sale del motor viene ya depurado', () => {
  it('ninguna pieza trae dos vértices que el modelo cuente como el mismo punto', () => {
    let pares = 0
    for (const d of DESPLAZAMIENTOS) {
      const { piezas } = restar(VECINA, medicionHasta(120 + d))
      expect(piezas.length, `d = ${d} m`).toBeGreaterThan(0)
      for (const pieza of piezas) {
        for (const recinto of pieza) {
          const n = recinto.vertices.length
          for (let i = 0; i < n; i++) {
            const a = recinto.vertices[i]
            const b = recinto.vertices[(i + 1) % n]
            pares++
            expect(
              Math.hypot(b[0] - a[0], b[1] - a[1]),
              `d = ${d} m, par ${i}`,
            ).toBeGreaterThanOrEqual(OPERATIVOS.duplicadoMetros)
          }
        }
      }
    }
    expect(pares, 'el recorrido tiene que haber mirado pares de verdad').toBeGreaterThan(50)
  })

  it('la depuración no se come el sobrante: A − B sigue midiendo lo que mide', () => {
    // Guarda contra el arreglo perezoso —depurar de más y hacer desaparecer
    // piezas—: el trozo que la medición le quita al vecino son 2.000 m² y tiene
    // que seguir saliendo con esa cifra, no con una redondeada a conveniencia.
    const { recorte } = expedienteCon(120)
    expect(recorte.vecinos[0].pierde).toBeCloseTo(4000, 2)
    expect(recorte.vecinos[0].areaNueva).toBeCloseTo(2000, 2)
  })

  it('no toca la geometría de entrada (regla de oro 2)', () => {
    const antes = JSON.parse(JSON.stringify(VECINA))
    restar(VECINA, medicionHasta(119.9997))
    expect(VECINA).toEqual(antes)
  })
})
