/* -------------------------------------------------------------------------- *
 * test/geo/depuracion.test.js — Los dos puntos que el motor devuelve y el      *
 * modelo cuenta como uno.                                                      *
 *                                                                              *
 * `depurarAnillo` existe por el defecto de F23 medido el 2026-09-09: donde la   *
 * geometría medida cruza el lindero de un colindante a una décima de milímetro  *
 * de un vértice suyo, `polyclip-ts` devuelve LOS DOS puntos —correctamente, los *
 * dos existen— y `validation/reglas-geometria.js` los rechazaba como duplicados,*
 * tumbando el expediente entero. El caso completo, de punta a punta, vive en    *
 * `test/derivacion/recorte-submilimetrico.test.js`; aquí se defiende la pieza.  *
 *                                                                              *
 * Lo que este fichero clava, por orden de importancia:                          *
 *                                                                              *
 *   1. ⛔ **QUE EL UMBRAL NO TENGA VALOR POR DEFECTO.** `geo/` es hoja del grafo *
 *      y no lee `config/`: una tolerancia implícita aquí sería una decisión de  *
 *      la capa que no puede tomarla (regla de oro 9).                           *
 *   2. ⛔ **QUE NO PUEDA CREAR UNA DEGENERACIÓN.** Depurar hasta dejar menos de  *
 *      3 vértices haría desaparecer en silencio una pieza que alguien tiene que *
 *      medir y declarar.                                                        *
 *   3. Que NO se derrumbe en cadena y que el PIVOTE no se mueva.                *
 *   4. ⛔ **QUE ESTO NO SE LE HAGA A LA GEOMETRÍA DEL USUARIO.** La prueba que   *
 *      lo separa es «un par a 5 mm»: `depurarAnillo` con el suelo de la retícula *
 *      lo colapsaría y `prepararRecintos` NO lo toca. Si algún día alguien mete  *
 *      la depuración dentro del serializador, esa prueba es la que lo caza.      *
 *                                                                              *
 * Proyecto Vitest `node`: aritmética pura, sin DOM.                             *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { depurarAnillo, depurarRecintos } from '../../geo/poligono.js'
import { DECIMALES_COORD, prepararRecintos } from '../../gml/anillos.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

// ── Utillaje ────────────────────────────────────────────────────────────────

const X0 = 439000
const Y0 = 4479000
const p = (dx, dy) => [X0 + dx, Y0 + dy]

/** El umbral que usa producción: el que pone `derivacion/topologia.js`. */
const MISMO_PUNTO = OPERATIVOS.duplicadoMetros

/**
 * El suelo de la RETÍCULA del fichero (`½·10⁻ᴰ·√2` = 7,0711 mm). No lo usa nadie
 * en producción: se calcula aquí para las pruebas que contrastan los dos
 * criterios. Que viva sólo en el test es a propósito — una constante exportada
 * que no llama nadie es peor que no tenerla.
 */
const RETICULA = 0.5 * 10 ** -DECIMALES_COORD * Math.SQRT2

/**
 * Los desplazamientos X respecto al origen local, redondeados al 0,1 mm.
 *
 * ⚠️ Se redondea a propósito: `439050.01 − 439000` no da `50.01` en float64, y
 * comparar el crudo convertiría una prueba sobre la DEPURACIÓN en una prueba
 * sobre el último bit de la resta.
 */
const desplazamientosX = (vertices) => vertices.map(([x]) => Number((x - X0).toFixed(4)))

// ── El contrato del umbral ──────────────────────────────────────────────────

describe('geo/poligono · depurarAnillo · el umbral entra por parámetro', () => {
  const ANILLO = [p(0, 0), p(50, 0), p(50, 40), p(0, 40)]

  it.each([
    ['sin pasarlo', undefined],
    ['con null', null],
    ['con NaN', NaN],
    ['con Infinity', Infinity],
    ['negativo', -0.001],
  ])('lanza RangeError %s', (_caso, umbral) => {
    expect(() => depurarAnillo(ANILLO, umbral)).toThrow(RangeError)
  })

  it('el mensaje dice POR QUÉ no hay valor por defecto, no sólo que falta', () => {
    // Regla de oro 1 aplicada al contrato: quien lo rompa tiene que saber que la
    // cifra la elige su capa, no ésta.
    expect(() => depurarAnillo(ANILLO)).toThrow(/geo\/.*no lee.*config\//s)
  })

  it('lanza TypeError con lo que no es un array', () => {
    expect(() => depurarAnillo(null, MISMO_PUNTO)).toThrow(TypeError)
    expect(() => depurarRecintos(null, MISMO_PUNTO)).toThrow(TypeError)
  })

  it('con umbral 0 no quita nada: es la identidad', () => {
    const conRuido = [p(0, 0), p(50, 0), p(50.0003, 0), p(50, 40), p(0, 40)]
    expect(depurarAnillo(conRuido, 0)).toEqual(conRuido)
  })
})

// ── Qué quita y qué no ──────────────────────────────────────────────────────

describe('geo/poligono · depurarAnillo', () => {
  const LIMPIO = [p(0, 0), p(50, 0), p(50, 40), p(0, 40)]

  it('un anillo sin ruido sale igual', () => {
    expect(depurarAnillo(LIMPIO, MISMO_PUNTO)).toEqual(LIMPIO)
  })

  it('quita el vértice que el modelo cuenta como el mismo punto que el anterior', () => {
    const conRuido = [p(0, 0), p(50, 0), p(50.0003, 0.0002), p(50, 40), p(0, 40)]
    const salida = depurarAnillo(conRuido, MISMO_PUNTO)
    expect(salida).toHaveLength(4)
    expect(salida).toEqual(LIMPIO)
  })

  it('quita el ÚLTIMO cuando es el que no se separa del primero: el pivote no se mueve', () => {
    // Es el caso que produce el recorte de un colindante: el motor cierra la
    // pieza a 0,3 mm del vértice con el que empezó.
    const conRuido = [p(0, 0), p(50, 0), p(50, 40), p(0, 40), p(0, 0.0003)]
    const salida = depurarAnillo(conRuido, MISMO_PUNTO)
    expect(salida[0], 'el primer vértice tiene que seguir siendo el mismo').toEqual(p(0, 0))
    expect(salida).toEqual(LIMPIO)
  })

  it('⛔ NO borra lo que el modelo considera DISTINTO: un par a 5 mm se conserva', () => {
    // La diferencia con el suelo de la retícula, que fue el primer intento y se
    // bajó el 2026-09-10: 5 mm está por debajo de 7,07 mm pero muy por encima de
    // «el mismo punto», y el fichero sabe escribir los dos.
    const anillo = [p(0, 0), p(50, 0), p(50.005, 0), p(50, 40), p(0, 40)]
    expect(depurarAnillo(anillo, MISMO_PUNTO)).toHaveLength(5)
    expect(depurarAnillo(anillo, RETICULA), 'el criterio viejo sí lo borraba').toHaveLength(4)
  })

  it('NO se derrumba en cadena: compara contra el último conservado, no contra el vecino', () => {
    // Cinco puntos a 0,6 mm cada uno recorren 3 mm. Comparando contra el vecino
    // inmediato se irían los cuatro; contra el conservado, sobreviven los que
    // hacen falta y ninguno queda a más del umbral de donde había un vértice.
    const tira = [
      p(0, 0),
      p(50, 0),
      p(50.0006, 0),
      p(50.0012, 0),
      p(50.0018, 0),
      p(50.0024, 0),
      p(50, 40),
    ]
    const salida = depurarAnillo(tira, MISMO_PUNTO)
    const xs = desplazamientosX(salida)
    expect(xs).toContain(50)
    expect(xs).toContain(50.0012)
    expect(xs).toContain(50.0024)
    for (let i = 0; i + 1 < salida.length; i++) {
      const d = Math.hypot(salida[i + 1][0] - salida[i][0], salida[i + 1][1] - salida[i][1])
      expect(d, `par ${i} demasiado junto`).toBeGreaterThanOrEqual(MISMO_PUNTO)
    }
  })

  it('NO puede crear una degeneración: si dejara menos de 3 vértices, devuelve la entrada', () => {
    // Una astilla entera más fina que el umbral. Quien tiene que decir que eso no
    // es una parcela es quien la mida, no este paso.
    const astilla = [p(0, 0), p(0.0004, 0), p(0.0004, 0.0004), p(0, 0.0004)]
    expect(depurarAnillo(astilla, MISMO_PUNTO)).toEqual(astilla)
  })

  it('no toca la entrada (regla de oro 2)', () => {
    const entrada = [p(0, 0), p(50, 0), p(50.0003, 0.0002), p(50, 40), p(0, 40)]
    const copia = entrada.map((v) => [...v])
    depurarAnillo(entrada, MISMO_PUNTO)
    expect(entrada).toEqual(copia)
  })

  it('depurarRecintos hace lo mismo con cada anillo, huecos incluidos', () => {
    const recintos = [
      {
        vertices: [p(0, 0), p(50, 0), p(50.0003, 0.0002), p(50, 40), p(0, 40)],
        tipo: TIPO_RECINTO.EXTERIOR,
      },
      {
        vertices: [p(10, 10), p(20, 10), p(20.0002, 10.0001), p(20, 20), p(10, 20)],
        tipo: TIPO_RECINTO.HUECO,
      },
    ]
    const salida = depurarRecintos(recintos, MISMO_PUNTO)
    expect(salida[0].vertices).toHaveLength(4)
    expect(salida[1].vertices).toHaveLength(4)
    expect(salida[0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(salida[1].tipo).toBe(TIPO_RECINTO.HUECO)
    expect(recintos[0].vertices, 'la entrada no se toca').toHaveLength(5)
  })
})

// ── La línea que no se cruza ────────────────────────────────────────────────

describe('⛔ la geometría del USUARIO no se depura', () => {
  it('prepararRecintos conserva un par a 5 mm que cae en DOS centímetros distintos', () => {
    // Esta prueba es la que separa las dos mitades del arreglo. `depurarAnillo`
    // con el suelo de la retícula lo colapsaría; el serializador NO, porque es
    // dato del usuario y los dos puntos se escriben distintos (…50.00 y …50.01).
    const anillo = [p(0, 0), p(50.004, 0), p(50.009, 0), p(50, 40), p(0, 40)]
    expect(depurarAnillo(anillo, RETICULA)).toHaveLength(4)

    const { recintos } = prepararRecintos([{ vertices: anillo, tipo: TIPO_RECINTO.EXTERIOR }])
    expect(recintos[0].vertices).toHaveLength(5)
    const xs = desplazamientosX(recintos[0].vertices)
    expect(xs).toContain(50)
    expect(xs).toContain(50.01)
  })
})
