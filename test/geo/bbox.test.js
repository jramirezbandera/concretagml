import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { bboxAnillo, bbox, bboxConMargen, bboxAlRatio } from '../../geo/bbox.js'
import { parsearGml } from '../../gml/parse.js'

// F09 · geo/bbox.js (tarea T1.1) — la caja que encuadra el plano del informe.
// Todos los valores de control están calculados A MANO (leyendo el `posList` del
// fixture, o por aritmética de rectángulos con números redondos), nunca copiados
// de la propia implementación: un valor «calculado» ejecutando el código que se
// quiere probar confirma cualquier error en vez de detectarlo.
//
// LA ASERCIÓN QUE IMPORTA es `esperarContencion`: dice que la caja de entrada
// cabe entera en la de salida. Es la que atrapa un recorte, y un recorte es
// lindero que desaparece de un documento firmable sin que salte nada.

// ── Arnés: la parcela real del WFS, leída del fichero ────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

/** Lee un GML decodificándolo con el encoding que el propio fichero DECLARA. */
function leerGml(nombre) {
  const bytes = readFileSync(join(RAIZ, 'test', 'fixtures', 'gml', nombre))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

const PARSEADO = parsearGml(leerGml('cp_parcela_9398516VK3799G.gml'))
const PARCELA = PARSEADO.parcelas[0]

// Control leído A MANO del `posList` de ese fichero (15 vértices, anillo abierto):
//   X mínima 439222.47 (vértice 13 del listado)  ·  X máxima 439283.23 (el 1.º)
//   Y mínima 4479637.48 (el 4.º)                 ·  Y máxima 4479687.38 (el 14.º)
// Ninguno de los cuatro extremos es «el primero» ni «el último» a la vez, así que
// una implementación que se quedara con los extremos del array no pasaría.
const CAJA_REAL = { minX: 439222.47, minY: 4479637.48, maxX: 439283.23, maxY: 4479687.38 }
const ANCHO_REAL = 60.76 // 439283.23 − 439222.47
const ALTO_REAL = 49.9 //  4479687.38 − 4479637.48

// El papel del informe (spec F09, Receta A): 180×130 mm a 300 ppp.
const W_PX = Math.round((180 / 25.4) * 300) // 2126
const H_PX = Math.round((130 / 25.4) * 300) // 1535
const RATIO_PAPEL = W_PX / H_PX // ≈ 1,3850

/** La caja `dentro` cabe entera en `fuera`: nada se ha recortado. */
function esperarContencion(fuera, dentro) {
  expect(fuera.minX, 'minX ha crecido: se ha recortado por el oeste').toBeLessThanOrEqual(dentro.minX)
  expect(fuera.minY, 'minY ha crecido: se ha recortado por el sur').toBeLessThanOrEqual(dentro.minY)
  expect(fuera.maxX, 'maxX ha menguado: se ha recortado por el este').toBeGreaterThanOrEqual(dentro.maxX)
  expect(fuera.maxY, 'maxY ha menguado: se ha recortado por el norte').toBeGreaterThanOrEqual(dentro.maxY)
}

// ── bboxAnillo ───────────────────────────────────────────────────────────────

describe('geo/bbox.js · bboxAnillo — la caja de un anillo abierto', () => {
  it('cuadrado 10×10 en el origen → su propia caja', () => {
    expect(
      bboxAnillo([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
  })

  it('triángulo: la caja es la del RECTÁNGULO que lo contiene, no la del triángulo', () => {
    // Catetos 6 y 4 sobre los ejes: el triángulo ocupa la mitad del rectángulo
    // [0,6]×[0,4], pero encuadrarlo exige el rectángulo entero.
    expect(
      bboxAnillo([
        [0, 0],
        [6, 0],
        [0, 4],
      ]),
    ).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 4 })
  })

  it('los cuatro extremos pueden estar en cualquier posición del array', () => {
    // Hexágono irregular con los extremos repartidos a propósito: la X máxima la
    // pone el vértice 2, la Y máxima el 4, la X mínima el 3 y la Y mínima el 5.
    // El primero y el último no son extremos de nada.
    const anillo = [
      [10, 10],
      [12, 8],
      [30, 12], // X máxima
      [-7, 15], // X mínima
      [4, 41], // Y máxima
      [6, -9], // Y mínima
    ]
    expect(bboxAnillo(anillo)).toEqual({ minX: -7, minY: -9, maxX: 30, maxY: 41 })
  })

  it('vértices de paso en un lado recto no cambian la caja', () => {
    // El mismo cuadrado 10×10 muestreado con 20 puntos intermedios en el lado
    // inferior: geométricamente es la MISMA figura y la caja es la misma.
    const pasos = Array.from({ length: 20 }, (_, i) => [(10 * (i + 1)) / 21, 0])
    const cuadrado = [[0, 0], ...pasos, [10, 0], [10, 10], [0, 10]]
    expect(cuadrado).toHaveLength(24)
    expect(bboxAnillo(cuadrado)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
  })

  it('un anillo de 3 vértices (la frontera) SÍ vale', () => {
    expect(
      bboxAnillo([
        [1, 2],
        [3, 2],
        [3, 7],
      ]),
    ).toEqual({ minX: 1, minY: 2, maxX: 3, maxY: 7 })
  })

  it('no muta el anillo de entrada', () => {
    const anillo = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const copia = anillo.map((v) => [...v])
    bboxAnillo(anillo)
    expect(anillo).toEqual(copia)
  })
})

describe('geo/bbox.js · bboxAnillo — contratos rotos: se lanza, no se absorbe', () => {
  it('null, undefined o algo que no es array → TypeError diciendo qué se esperaba', () => {
    expect(() => bboxAnillo(null)).toThrow(TypeError)
    expect(() => bboxAnillo(null)).toThrow(/se esperaba un anillo ABIERTO Array<\[x,y\]> en UTM/)
    expect(() => bboxAnillo(undefined)).toThrow(TypeError)
    expect(() => bboxAnillo('439222.47 4479637.48')).toThrow(TypeError)
    expect(() => bboxAnillo({ minX: 0 })).toThrow(TypeError)
  })

  it('menos de 3 vértices → RangeError: un segmento no es un anillo', () => {
    // Y su caja sería PERFECTAMENTE plausible —un rectángulo de 3×4— sobre algo
    // que no encierra nada. Aquí no se devuelve el 0 que sí devuelven area() y
    // perimetroAnillo(): una medida degenerada es cierta, una caja degenerada no
    // se distingue de una buena.
    expect(() => bboxAnillo([])).toThrow(RangeError)
    expect(() => bboxAnillo([[5, 5]])).toThrow(RangeError)
    expect(() =>
      bboxAnillo([
        [0, 0],
        [3, 4],
      ]),
    ).toThrow(/se esperaban al menos 3 vértices y han llegado 2/)
  })

  it('un vértice con NaN o Infinity → TypeError (Math.min lo propagaría en silencio)', () => {
    const conNaN = [
      [0, 0],
      [Number.NaN, 5],
      [10, 10],
    ]
    expect(() => bboxAnillo(conNaN)).toThrow(TypeError)
    expect(() => bboxAnillo(conNaN)).toThrow(/el vértice 1 debe ser un par \[x,y\] de números FINITOS/)
    // Y se demuestra por qué: hecho a mano con Math.min, el NaN sale sin ruido.
    expect(Math.min(0, Number.NaN, 10)).toBeNaN()

    expect(() =>
      bboxAnillo([
        [0, 0],
        [10, 0],
        [10, Number.POSITIVE_INFINITY],
      ]),
    ).toThrow(/el vértice 2 debe ser un par/)
  })

  it('un vértice que no es un par → TypeError nombrando el índice', () => {
    expect(() => bboxAnillo([[0, 0], [10, 0], null])).toThrow(/el vértice 2 debe ser un par/)
    expect(() => bboxAnillo([[0, 0], [10, 0], [10]])).toThrow(/el vértice 2 debe ser un par/)
    expect(() => bboxAnillo([[0, 0], 7, [10, 10]])).toThrow(/el vértice 1 debe ser un par/)
  })
})

// ── bbox(recintos) ───────────────────────────────────────────────────────────

describe('geo/bbox.js · bbox(recintos) — la unión de todos los anillos', () => {
  const exterior = {
    tipo: 'EXTERIOR',
    vertices: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
  }

  it('solo exterior: la misma caja que bboxAnillo sobre su anillo', () => {
    expect(bbox([exterior])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    expect(bbox([exterior])).toEqual(bboxAnillo(exterior.vertices))
  })

  it('con el hueco DENTRO (el caso normal), la unión da EXACTAMENTE la caja del exterior', () => {
    // Un anillo contenido no puede ampliar la envolvente: mirarlo no cuesta nada
    // y el resultado es idéntico al de fiarse del exterior.
    const hueco = {
      tipo: 'HUECO',
      vertices: [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
      ],
    }
    expect(bbox([exterior, hueco])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    expect(bbox([exterior, hueco])).toEqual(bbox([exterior]))
  })

  it('con un hueco que SE SALE (GML ajeno defectuoso), la caja lo incluye en vez de dejarlo fuera del plano', () => {
    // Esta es la decisión documentada del módulo. Fiarse del exterior encuadraría
    // [0,10]×[0,10] y el trozo del hueco que asoma hasta x=14 no aparecería en el
    // plano — sin aviso y con la escala perfectamente rotulada.
    const huecoDesbordado = {
      tipo: 'HUECO',
      vertices: [
        [8, 8],
        [14, 8],
        [14, 12],
        [8, 12],
      ],
    }
    const caja = bbox([exterior, huecoDesbordado])
    expect(caja).toEqual({ minX: 0, minY: 0, maxX: 14, maxY: 12 })
    // Y no la del exterior a secas, que es lo que devolvería la implementación
    // «obvia» y la que dejaría geometría fuera.
    expect(caja).not.toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    esperarContencion(caja, bboxAnillo(huecoDesbordado.vertices))
    esperarContencion(caja, bboxAnillo(exterior.vertices))
  })

  it('varios huecos se acumulan en la unión', () => {
    const a = { tipo: 'HUECO', vertices: [[-3, 1], [-1, 1], [-1, 3]] }
    const b = { tipo: 'HUECO', vertices: [[2, 2], [4, 2], [4, 20]] }
    expect(bbox([exterior, a, b])).toEqual({ minX: -3, minY: 0, maxX: 10, maxY: 20 })
  })

  it('LANZA TypeError si recintos[0] no es el EXTERIOR (mismo texto que geo/area.js#superficie)', () => {
    const hueco = { tipo: 'HUECO', vertices: [[0, 0], [1, 0], [1, 1]] }
    expect(() => bbox([hueco])).toThrow(TypeError)
    expect(() => bbox([hueco])).toThrow(/recintos\[0\] debe ser el EXTERIOR/)
  })

  it('LANZA TypeError si algún recinto posterior no es HUECO, nombrando el índice', () => {
    const otro = { tipo: 'OTRO', vertices: [[1, 1], [2, 1], [2, 2]] }
    expect(() => bbox([exterior, otro])).toThrow(/recintos\[1\] debe ser HUECO/)
    expect(() => bbox([exterior, exterior])).toThrow(TypeError)
    const hueco = { tipo: 'HUECO', vertices: [[0, 0], [1, 0], [1, 1]] }
    expect(() => bbox([exterior, hueco, exterior])).toThrow(/recintos\[2\] debe ser HUECO/)
  })

  it('LANZA si un recinto no es un objeto, o si su anillo está roto (con la ruta en el mensaje)', () => {
    expect(() => bbox([exterior, null])).toThrow(/recintos\[1\] debe ser un objeto \{vertices, tipo\}/)
    const sinVertices = { tipo: 'HUECO', vertices: undefined }
    expect(() => bbox([exterior, sinVertices])).toThrow(
      /bbox → recintos\[1\]\.vertices: se esperaba un anillo ABIERTO/,
    )
    const corto = { tipo: 'HUECO', vertices: [[0, 0], [1, 1]] }
    expect(() => bbox([exterior, corto])).toThrow(RangeError)
  })

  it('vacío o no-array → LANZA, en vez del valor neutro de superficie()/perimetro()', () => {
    // La diferencia con sus hermanas es deliberada: 0 m² es una medida cierta de
    // una figura vacía; «la caja de nada» no existe, y lo que se devolviera se
    // acabaría dividiendo para sacar la escala del plano.
    expect(() => bbox([])).toThrow(RangeError)
    expect(() => bbox([])).toThrow(/se esperaba al menos un recinto/)
    expect(() => bbox(null)).toThrow(TypeError)
    expect(() => bbox(undefined)).toThrow(TypeError)
    expect(() => bbox({ tipo: 'EXTERIOR', vertices: [] })).toThrow(TypeError)
  })

  it('no muta recintos ni sus vértices', () => {
    const hueco = { tipo: 'HUECO', vertices: [[4, 4], [6, 4], [6, 6], [4, 6]] }
    const recintos = [exterior, hueco]
    const copia = recintos.map((r) => ({ tipo: r.tipo, vertices: r.vertices.map((v) => [...v]) }))
    bbox(recintos)
    expect(recintos).toEqual(copia)
  })
})

// ── bboxConMargen ────────────────────────────────────────────────────────────

describe('geo/bbox.js · bboxConMargen — aire por los cuatro lados', () => {
  const caja = { minX: 100, minY: 200, maxX: 140, maxY: 230 } // 40 × 30

  it('crece por los CUATRO lados, no por dos: 40×30 con 5 m de margen → 50×40', () => {
    const conMargen = bboxConMargen(caja, 5)
    expect(conMargen).toEqual({ minX: 95, minY: 195, maxX: 145, maxY: 235 })
    expect(conMargen.maxX - conMargen.minX).toBe(50) // 40 + 5 + 5
    expect(conMargen.maxY - conMargen.minY).toBe(40) // 30 + 5 + 5
  })

  it('la caja original queda contenida, y el margen no cambia el centro', () => {
    const conMargen = bboxConMargen(caja, 12.5)
    esperarContencion(conMargen, caja)
    expect((conMargen.minX + conMargen.maxX) / 2).toBeCloseTo((caja.minX + caja.maxX) / 2, 9)
    expect((conMargen.minY + conMargen.maxY) / 2).toBeCloseTo((caja.minY + caja.maxY) / 2, 9)
  })

  it('margen 0 devuelve una caja igual (y una caja NUEVA: no se toca la de entrada)', () => {
    const conMargen = bboxConMargen(caja, 0)
    expect(conMargen).toEqual(caja)
    expect(conMargen).not.toBe(caja)
    expect(caja).toEqual({ minX: 100, minY: 200, maxX: 140, maxY: 230 })
  })

  it('margen NEGATIVO → RangeError: es un recorte con otro nombre', () => {
    expect(() => bboxConMargen(caja, -5)).toThrow(RangeError)
    expect(() => bboxConMargen(caja, -0.01)).toThrow(/no puede ser negativo/)
  })

  it('margen que no es número → TypeError; NaN o Infinity → RangeError', () => {
    expect(() => bboxConMargen(caja, '5')).toThrow(TypeError)
    expect(() => bboxConMargen(caja, null)).toThrow(TypeError)
    expect(() => bboxConMargen(caja, undefined)).toThrow(TypeError)
    expect(() => bboxConMargen(caja, Number.NaN)).toThrow(RangeError)
    expect(() => bboxConMargen(caja, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('caja que no es caja, o que viene invertida → LANZA', () => {
    expect(() => bboxConMargen(null, 5)).toThrow(TypeError)
    expect(() => bboxConMargen({ minX: 0, minY: 0, maxX: 10 }, 5)).toThrow(/'bbox.maxY'/)
    expect(() => bboxConMargen({ minX: 0, minY: 0, maxX: 10, maxY: Number.NaN }, 5)).toThrow(TypeError)
    expect(() => bboxConMargen({ minX: 10, minY: 0, maxX: 0, maxY: 10 }, 5)).toThrow(
      /INVERTIDA en X/,
    )
    expect(() => bboxConMargen({ minX: 0, minY: 10, maxX: 10, maxY: 0 }, 5)).toThrow(
      /INVERTIDA en Y/,
    )
  })
})

// ── bboxAlRatio ──────────────────────────────────────────────────────────────

describe('geo/bbox.js · bboxAlRatio — al ratio del papel CRECIENDO, nunca recortando', () => {
  it('caja MÁS ANCHA que el ratio pedido: crece el ALTO y el ancho no se toca', () => {
    // 100 × 50 (ratio 2) llevada a ratio 1: el alto tiene que pasar a 100, y se
    // reparte a partes iguales (25 arriba, 25 abajo). Calculado a mano.
    const caja = { minX: 0, minY: 0, maxX: 100, maxY: 50 }
    const r = bboxAlRatio(caja, 1)
    expect(r).toEqual({ minX: 0, minY: -25, maxX: 100, maxY: 75 })
    expect(r.maxX - r.minX).toBe(100) // el ancho NO se ha tocado
    expect(r.maxY - r.minY).toBe(100)
    esperarContencion(r, caja)
    // La alternativa prohibida sería recortar el ancho a 50 (caja 50×50): también
    // daría ratio 1, y se habría comido la mitad de la parcela.
    expect(r.maxX - r.minX).not.toBe(50)
  })

  it('caja MÁS ALTA que el ratio pedido: crece el ANCHO y el alto no se toca', () => {
    // 50 × 100 (ratio 0,5) llevada a ratio 1: el ancho pasa a 100 (25 por cada
    // lado). El sentido contrario del caso anterior, y no lo cubre el mismo if.
    const caja = { minX: 0, minY: 0, maxX: 50, maxY: 100 }
    const r = bboxAlRatio(caja, 1)
    expect(r).toEqual({ minX: -25, minY: 0, maxX: 75, maxY: 100 })
    expect(r.maxY - r.minY).toBe(100) // el alto NO se ha tocado
    expect(r.maxX - r.minX).toBe(100)
    esperarContencion(r, caja)
    expect(r.maxY - r.minY).not.toBe(50)
  })

  it('caja que YA tiene el ratio: se devuelve igual (ni un ulp de recorte en la frontera)', () => {
    const caja = { minX: 10, minY: 20, maxX: 110, maxY: 70 } // 100 × 50, ratio 2
    const r = bboxAlRatio(caja, 2)
    expect(r).toEqual(caja)
    esperarContencion(r, caja)
  })

  it('un ratio no redondo, en los dos sentidos: contención y ratio exacto', () => {
    const ancha = { minX: 0, minY: 0, maxX: 120, maxY: 30 } // ratio 4
    const rA = bboxAlRatio(ancha, RATIO_PAPEL)
    expect(rA.maxX - rA.minX).toBeCloseTo(120, 9) // crece el alto
    expect(rA.maxY - rA.minY).toBeCloseTo(120 / RATIO_PAPEL, 9)
    expect((rA.maxX - rA.minX) / (rA.maxY - rA.minY)).toBeCloseTo(RATIO_PAPEL, 9)
    esperarContencion(rA, ancha)

    const alta = { minX: 0, minY: 0, maxX: 30, maxY: 120 } // ratio 0,25
    const rB = bboxAlRatio(alta, RATIO_PAPEL)
    expect(rB.maxY - rB.minY).toBeCloseTo(120, 9) // crece el ancho
    expect(rB.maxX - rB.minX).toBeCloseTo(120 * RATIO_PAPEL, 9)
    expect((rB.maxX - rB.minX) / (rB.maxY - rB.minY)).toBeCloseTo(RATIO_PAPEL, 9)
    esperarContencion(rB, alta)
  })

  it('el resultado NUNCA es más pequeño que la entrada: el área de la caja solo puede subir', () => {
    const casos = [
      { minX: 0, minY: 0, maxX: 100, maxY: 50 },
      { minX: 0, minY: 0, maxX: 50, maxY: 100 },
      { minX: -12.5, minY: 3.25, maxX: 7.5, maxY: 90 },
      CAJA_REAL,
    ]
    for (const ratio of [0.25, 1, RATIO_PAPEL, 4]) {
      for (const caja of casos) {
        const r = bboxAlRatio(caja, ratio)
        esperarContencion(r, caja)
        const areaEntrada = (caja.maxX - caja.minX) * (caja.maxY - caja.minY)
        const areaSalida = (r.maxX - r.minX) * (r.maxY - r.minY)
        expect(areaSalida).toBeGreaterThanOrEqual(areaEntrada)
        expect((r.maxX - r.minX) / (r.maxY - r.minY)).toBeCloseTo(ratio, 6)
      }
    }
  })

  it('está CENTRADO sobre la caja de entrada (crece lo mismo por los dos lados)', () => {
    const caja = { minX: -12.5, minY: 3.25, maxX: 7.5, maxY: 90 }
    const r = bboxAlRatio(caja, 2)
    expect(r.minX - caja.minX).toBeCloseTo(caja.maxX - r.maxX, 9)
    expect(r.minY - caja.minY).toBeCloseTo(caja.maxY - r.maxY, 9)
  })

  it('una caja SIN ALTO (parcela degenerada en una línea) sí se resuelve: crece el lado nulo', () => {
    const linea = { minX: 0, minY: 40, maxX: 100, maxY: 40 }
    const r = bboxAlRatio(linea, 2)
    expect(r).toEqual({ minX: 0, minY: 15, maxX: 100, maxY: 65 }) // alto 50 = 100/2
    esperarContencion(r, linea)

    const columna = { minX: 7, minY: 0, maxX: 7, maxY: 100 }
    const rC = bboxAlRatio(columna, 2)
    expect(rC).toEqual({ minX: -93, minY: 0, maxX: 107, maxY: 100 }) // ancho 200 = 100·2
    esperarContencion(rC, columna)
  })

  it('una caja que es un PUNTO → RangeError: no hay lado del que deducir el otro', () => {
    const punto = { minX: 5, minY: 5, maxX: 5, maxY: 5 }
    expect(() => bboxAlRatio(punto, 2)).toThrow(RangeError)
    expect(() => bboxAlRatio(punto, 2)).toThrow(/no tiene ancho NI alto/)
  })

  it('ratio que no es número → TypeError; ratio 0, negativo, NaN o Infinity → RangeError', () => {
    const caja = { minX: 0, minY: 0, maxX: 100, maxY: 50 }
    expect(() => bboxAlRatio(caja, '2')).toThrow(TypeError)
    expect(() => bboxAlRatio(caja, null)).toThrow(TypeError)
    expect(() => bboxAlRatio(caja, 0)).toThrow(RangeError)
    expect(() => bboxAlRatio(caja, -2)).toThrow(RangeError)
    expect(() => bboxAlRatio(caja, Number.NaN)).toThrow(RangeError)
    expect(() => bboxAlRatio(caja, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('caja que no es caja, o invertida → LANZA', () => {
    expect(() => bboxAlRatio(null, 2)).toThrow(TypeError)
    expect(() => bboxAlRatio('0,0,10,10', 2)).toThrow(TypeError)
    expect(() => bboxAlRatio({ minX: 10, minY: 0, maxX: 0, maxY: 10 }, 2)).toThrow(RangeError)
  })

  it('no muta la caja de entrada', () => {
    const caja = { minX: 0, minY: 0, maxX: 100, maxY: 50 }
    bboxAlRatio(caja, 1)
    expect(caja).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 })
  })
})

// ── La geometría real ────────────────────────────────────────────────────────

describe('geo/bbox.js · la parcela REAL del WFS (cp_parcela_9398516VK3799G.gml)', () => {
  it('el fixture se lee y trae los 15 vértices del anillo exterior', () => {
    // Sin esto, un fallo del parseo dejaría los tests de abajo pasando sobre nada.
    expect(PARSEADO.parcelas).toHaveLength(1)
    expect(PARCELA.refcat).toBe('9398516VK3799G')
    expect(PARCELA.srs).toBe('EPSG:25830')
    expect(PARCELA.recintos).toHaveLength(1)
    expect(PARCELA.recintos[0].tipo).toBe('EXTERIOR')
    expect(PARCELA.recintos[0].vertices).toHaveLength(15) // abierto: el GML trae 16
  })

  it('la caja es la que se lee A MANO en el posList del fichero', () => {
    expect(bboxAnillo(PARCELA.recintos[0].vertices)).toEqual(CAJA_REAL)
    expect(bbox(PARCELA.recintos)).toEqual(CAJA_REAL)
    // 60,76 × 49,90 m para una parcela de ~1.536 m²: la caja es mayor que la
    // superficie (3.032 m² frente a 1.536), como debe ser en un polígono que no
    // es un rectángulo.
    // Precisión 6 y no 9: restar dos coordenadas de magnitud 4,4·10⁶ en float64
    // deja un residuo de ~10⁻¹⁰ m que no es del cálculo, es del formato (la misma
    // observación que hace test/geo/metrica.test.js sobre `distancia`).
    expect(CAJA_REAL.maxX - CAJA_REAL.minX).toBeCloseTo(ANCHO_REAL, 6)
    expect(CAJA_REAL.maxY - CAJA_REAL.minY).toBeCloseTo(ALTO_REAL, 6)
    expect(ANCHO_REAL * ALTO_REAL).toBeGreaterThan(PARCELA.areaValue)
  })

  it('el punto de referencia que declara el mismo fichero cae dentro de la caja', () => {
    // Dato INDEPENDIENTE del posList (viene de `cp:referencePoint`): si la caja
    // estuviera desplazada, el punto que el Catastro publica como interior de la
    // parcela se quedaría fuera.
    const [px, py] = PARCELA.puntoReferencia
    expect([px, py]).toEqual([439250.35, 4479664.55])
    expect(px).toBeGreaterThan(CAJA_REAL.minX)
    expect(px).toBeLessThan(CAJA_REAL.maxX)
    expect(py).toBeGreaterThan(CAJA_REAL.minY)
    expect(py).toBeLessThan(CAJA_REAL.maxY)
  })

  it('todos los vértices reales caen dentro de la caja, y cada borde toca alguno', () => {
    const caja = bbox(PARCELA.recintos)
    for (const [x, y] of PARCELA.recintos[0].vertices) {
      expect(x).toBeGreaterThanOrEqual(caja.minX)
      expect(x).toBeLessThanOrEqual(caja.maxX)
      expect(y).toBeGreaterThanOrEqual(caja.minY)
      expect(y).toBeLessThanOrEqual(caja.maxY)
    }
    // Ajustada, no solo válida: una caja el doble de grande también contendría
    // los vértices y sería inútil para encuadrar.
    const xs = PARCELA.recintos[0].vertices.map((v) => v[0])
    const ys = PARCELA.recintos[0].vertices.map((v) => v[1])
    expect(xs).toContain(caja.minX)
    expect(xs).toContain(caja.maxX)
    expect(ys).toContain(caja.minY)
    expect(ys).toContain(caja.maxY)
  })

  it('la cadena de F09 (caja → margen → ratio del papel) no pierde ni un centímetro de parcela', () => {
    // Exactamente lo que hará el compositor del plano: la caja de la parcela, 10 m
    // de aire alrededor, y el encuadre al ratio de 180×130 mm a 300 ppp.
    const caja = bbox(PARCELA.recintos)
    const conMargen = bboxConMargen(caja, 10)
    const encuadre = bboxAlRatio(conMargen, RATIO_PAPEL)

    // Margen a mano: 60,76 + 20 = 80,76 de ancho; 49,90 + 20 = 69,90 de alto.
    expect(conMargen.maxX - conMargen.minX).toBeCloseTo(80.76, 6)
    expect(conMargen.maxY - conMargen.minY).toBeCloseTo(69.9, 6)

    // 80,76/69,90 = 1,1554 < 1,3850: la caja es más ALTA que el papel, así que
    // crece el ancho hasta 69,90 · (2126/1535) y el alto se queda en 69,90.
    expect(encuadre.maxY - encuadre.minY).toBeCloseTo(69.9, 6)
    expect(encuadre.maxX - encuadre.minX).toBeCloseTo(69.9 * RATIO_PAPEL, 6)
    expect((encuadre.maxX - encuadre.minX) / (encuadre.maxY - encuadre.minY)).toBeCloseTo(
      RATIO_PAPEL,
      9,
    )

    // Lo que no puede pasar bajo ningún concepto: perder parcela por el camino.
    esperarContencion(conMargen, caja)
    esperarContencion(encuadre, conMargen)
    esperarContencion(encuadre, caja)
    for (const [x, y] of PARCELA.recintos[0].vertices) {
      expect(x).toBeGreaterThan(encuadre.minX)
      expect(x).toBeLessThan(encuadre.maxX)
      expect(y).toBeGreaterThan(encuadre.minY)
      expect(y).toBeLessThan(encuadre.maxY)
    }
    // Y el margen sigue siendo margen: los 10 m de aire no se los ha comido nadie.
    expect(caja.minX - encuadre.minX).toBeGreaterThanOrEqual(10)
    expect(encuadre.maxX - caja.maxX).toBeGreaterThanOrEqual(10)
    expect(caja.minY - encuadre.minY).toBeCloseTo(10, 6)
    expect(encuadre.maxY - caja.maxY).toBeCloseTo(10, 6)
  })

  it('la precisión aguanta el Norte ≈ 4,48·10⁶ sin trasladar a origen local', () => {
    // La caja solo compara y suma longitudes a coordenadas; no multiplica
    // coordenadas absolutas entre sí, que es lo que obliga a geo/area.js a
    // trasladar. Control: la misma parcela llevada al origen da exactamente los
    // mismos anchos y altos.
    const { minX, minY } = CAJA_REAL
    const local = PARCELA.recintos[0].vertices.map(([x, y]) => [x - minX, y - minY])
    const cajaLocal = bboxAnillo(local)
    const caja = bboxAnillo(PARCELA.recintos[0].vertices)
    expect(cajaLocal.maxX - cajaLocal.minX).toBeCloseTo(caja.maxX - caja.minX, 6)
    expect(cajaLocal.maxY - cajaLocal.minY).toBeCloseTo(caja.maxY - caja.minY, 6)

    // Y el reparto del crecimiento conserva la contención EXACTA a esa magnitud
    // (por eso no se recentra sobre el punto medio: `cx − ancho/2` puede quedar
    // unos ulp por encima de minX y recortar).
    const r = bboxAlRatio(caja, RATIO_PAPEL)
    expect(r.minX <= caja.minX).toBe(true)
    expect(r.minY <= caja.minY).toBe(true)
    expect(r.maxX >= caja.maxX).toBe(true)
    expect(r.maxY >= caja.maxY).toBe(true)
  })
})
