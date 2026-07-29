import { describe, it, expect } from 'vitest'
import { centroideAnillo, centroide } from '../../geo/centroide.js'

// F07 · geo/centroide.js (tarea T1.2) — centroide del ÁREA, no promedio de
// vértices. Valores calculados A MANO (por descomposición en rectángulos o
// por simetría), nunca copiados de la propia implementación: si la fórmula
// tuviera un error, un valor "calculado" ejecutando el propio código no lo
// detectaría.

describe('centroideAnillo — polígonos sintéticos con centroide conocido', () => {
  it('cuadrado 10×10 en el origen → su centro exacto (5,5)', () => {
    const cuadrado = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const c = centroideAnillo(cuadrado)
    expect(c[0]).toBeCloseTo(5, 9)
    expect(c[1]).toBeCloseTo(5, 9)
  })

  it('triángulo rectángulo (catetos 6 y 4): centroide a 1/3 de los catetos, no en el centro del rectángulo que lo contiene', () => {
    // Ángulo recto en el origen; catetos sobre los ejes. Para un TRIÁNGULO
    // (y solo para un triángulo) el centroide coincide con la media de sus
    // tres vértices: ((0+6+0)/3, (0+0+4)/3) = (2, 4/3).
    const triangulo = [
      [0, 0],
      [6, 0],
      [0, 4],
    ]
    const c = centroideAnillo(triangulo)
    expect(c[0]).toBeCloseTo(2, 9)
    expect(c[1]).toBeCloseTo(4 / 3, 9)
    // El rectángulo que lo contiene es [0,6]×[0,4]; su centro es (3,2), muy
    // distinto del centroide real: si la fórmula devolviera el centro de la
    // envolvente estaría midiendo el rectángulo, no el triángulo.
    expect(c[0]).not.toBeCloseTo(3, 1)
    expect(c[1]).not.toBeCloseTo(2, 1)
  })

  it('L cóncava: el centroide cae en la ESCOTADURA, fuera del material del polígono', () => {
    // L formada por dos barras: horizontal [0,10]×[0,1] (área 10, centro
    // (5, 0.5)) y vertical [0,1]×[1,10] (área 9, centro (0.5, 5.5)), unidas
    // en la esquina. Centroide ponderado por área (calculado a mano):
    //   Cx = Cy = (10·5 + 9·0.5) / (10+9) = (50+4.5)/19 = 54.5/19
    const ele = [
      [0, 0],
      [10, 0],
      [10, 1],
      [1, 1],
      [1, 10],
      [0, 10],
    ]
    const c = centroideAnillo(ele)
    const esperado = 54.5 / 19
    expect(c[0]).toBeCloseTo(esperado, 9)
    expect(c[1]).toBeCloseTo(esperado, 9)
    // Y el punto (≈2.868, 2.868) no pertenece a NINGUNA de las dos barras: no
    // está en la horizontal (y > 1) ni en la vertical (x > 1). El centroide
    // de una figura cóncava puede caer fuera de su propio material — no basta
    // con mirar "el centro de la envolvente" para saber dónde cae.
    expect(c[0]).toBeGreaterThan(1)
    expect(c[1]).toBeGreaterThan(1)
  })

  it('el caso que justifica el módulo: muchos vértices de paso en un lado NO desplazan el centroide del área, pero SÍ desplazarían el promedio de vértices', () => {
    // Cuadrado 10×10 con 20 puntos de paso repartidos en el lado inferior
    // (entre (0,0) y (10,0)): geométricamente sigue siendo el MISMO cuadrado
    // — el centroide del área tiene que seguir siendo (5,5), porque no
    // depende de cómo se muestrea un lado recto, solo del contorno trazado.
    const pasos = Array.from({ length: 20 }, (_, i) => [(10 * (i + 1)) / 21, 0])
    const cuadradoConPasos = [[0, 0], ...pasos, [10, 0], [10, 10], [0, 10]]
    expect(cuadradoConPasos).toHaveLength(24) // 4 esquinas + 20 pasos

    const c = centroideAnillo(cuadradoConPasos)
    expect(c[0]).toBeCloseTo(5, 6)
    expect(c[1]).toBeCloseTo(5, 6)

    // El promedio de vértices, en cambio, SÍ se arrastra hacia el lado
    // sobrecargado: 21 de los 24 vértices están a y=0 (la esquina (0,0), la
    // (10,0) y los 20 pasos), así que la media de "y" se hunde muy por
    // debajo de 5. Calculado a mano: Σx = 0+100+10+10+0 = 120 (media 5, por
    // simetría izquierda-derecha) pero Σy = 0+0+0+10+10 = 20 (media 20/24).
    const promedioVertices = cuadradoConPasos
      .reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
      .map((s) => s / cuadradoConPasos.length)
    expect(promedioVertices[0]).toBeCloseTo(5, 9) // en x coincide, por simetría
    expect(promedioVertices[1]).toBeCloseTo(20 / 24, 9) // en y NO coincide con 5
    expect(promedioVertices[1]).not.toBeCloseTo(5, 1)
    // Las dos afirmaciones a la vez: la función da el centro real...
    expect(c[1]).toBeCloseTo(5, 6)
    // ...y el promedio de vértices habría dado otra cosa (por eso existe el módulo).
    expect(c[1]).not.toBeCloseTo(promedioVertices[1], 1)
  })

  it('invariancia a la traslación: el mismo cuadrado en coordenadas UTM reales da el mismo centroide relativo (regla de oro 5)', () => {
    // Cuadrado 10×10 desplazado a Este≈373.000, Norte≈4.070.000. Sin la
    // traslación a origen local antes de multiplicar, los productos cruzados
    // de la fórmula (x_i·y_j) mezclarían términos de orden 10¹² y perderían
    // los metros de precisión: este test es el que falla si se quita esa
    // traslación.
    const ox = 373000
    const oy = 4070000
    const cuadradoUTM = [
      [ox + 0, oy + 0],
      [ox + 10, oy + 0],
      [ox + 10, oy + 10],
      [ox + 0, oy + 10],
    ]
    const c = centroideAnillo(cuadradoUTM)
    expect(c[0]).toBeCloseTo(ox + 5, 6)
    expect(c[1]).toBeCloseTo(oy + 5, 6)
  })

  it('invariancia al sentido: el anillo y su reverse() dan el mismo centroide', () => {
    const triangulo = [
      [0, 0],
      [6, 0],
      [0, 4],
    ]
    const invertido = [...triangulo].reverse()
    const cDirecto = centroideAnillo(triangulo)
    const cInvertido = centroideAnillo(invertido)
    expect(cInvertido[0]).toBeCloseTo(cDirecto[0], 9)
    expect(cInvertido[1]).toBeCloseTo(cDirecto[1], 9)
    expect(cDirecto[0]).toBeCloseTo(2, 9)
    expect(cDirecto[1]).toBeCloseTo(4 / 3, 9)
  })

  it('no muta el anillo de entrada', () => {
    const anillo = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const copia = anillo.map((v) => [...v])
    centroideAnillo(anillo)
    expect(anillo).toEqual(copia)
  })
})

describe('centroideAnillo — degenerados → null (mismo criterio que geo/area.js#orientacion)', () => {
  it('menos de 3 vértices → null', () => {
    expect(centroideAnillo([])).toBeNull()
    expect(centroideAnillo([[5, 5]])).toBeNull()
    expect(centroideAnillo([[0, 0], [10, 10]])).toBeNull()
  })

  it('3 vértices colineales → null (área firmada exactamente 0)', () => {
    expect(centroideAnillo([[0, 0], [5, 5], [10, 10]])).toBeNull()
  })
})

describe('centroide(recintos) — región con huecos, ponderada por área', () => {
  const exterior = {
    tipo: 'EXTERIOR',
    vertices: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
  } // área 100, centro (5,5)

  it('hueco DESCENTRADO: el centroide se desplaza en dirección CONTRARIA al hueco', () => {
    // Hueco 2×2 en [6,6]-[8,8]: área 4, centro (7,7) — hacia la esquina
    // superior-derecha del exterior. Calculado a mano:
    //   C = (100·(5,5) − 4·(7,7)) / (100−4) = (500−28, 500−28) / 96 = (472,472)/96 = 59/12
    const hueco = {
      tipo: 'HUECO',
      vertices: [
        [6, 6],
        [8, 6],
        [8, 8],
        [6, 8],
      ],
    }
    const c = centroide([exterior, hueco])
    const esperado = 59 / 12
    expect(c[0]).toBeCloseTo(esperado, 9)
    expect(c[1]).toBeCloseTo(esperado, 9)
    // El hueco tira hacia (7,7); quitarle masa a esa zona empuja el centro
    // combinado hacia el lado OPUESTO: por debajo del centro del exterior (5,5).
    expect(c[0]).toBeLessThan(5)
    expect(c[1]).toBeLessThan(5)
  })

  it('hueco CONCÉNTRICO: el centroide no se mueve (sigue en el centro)', () => {
    const huecoConcentrico = {
      tipo: 'HUECO',
      vertices: [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
      ],
    } // área 4, centro (5,5) — el mismo centro que el exterior
    const c = centroide([exterior, huecoConcentrico])
    expect(c[0]).toBeCloseTo(5, 9)
    expect(c[1]).toBeCloseTo(5, 9)
  })

  it('recintos vacíos o nulos → null', () => {
    expect(centroide([])).toBeNull()
    expect(centroide(null)).toBeNull()
    expect(centroide(undefined)).toBeNull()
  })

  it('LANZA TypeError si recintos[0] no es el EXTERIOR (regla de oro 1, igual que geo/area.js#superficie)', () => {
    const hueco = { tipo: 'HUECO', vertices: [[0, 0], [1, 0], [1, 1]] }
    expect(() => centroide([hueco])).toThrow(TypeError)
    expect(() => centroide([hueco])).toThrow(/recintos\[0\] debe ser el EXTERIOR/)
  })

  it('LANZA TypeError si algún recinto posterior no es HUECO', () => {
    const otro = { tipo: 'OTRO', vertices: [[1, 1], [2, 1], [2, 2]] }
    const segundoExterior = { tipo: 'EXTERIOR', vertices: [[1, 1], [2, 1], [2, 2]] }
    expect(() => centroide([exterior, otro])).toThrow(TypeError)
    expect(() => centroide([exterior, otro])).toThrow(/recintos\[1\] debe ser HUECO/)
    expect(() => centroide([exterior, segundoExterior])).toThrow(TypeError)
  })

  it('no muta recintos ni sus vértices', () => {
    const hueco = {
      tipo: 'HUECO',
      vertices: [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
      ],
    }
    const recintos = [exterior, hueco]
    const copia = recintos.map((r) => ({ tipo: r.tipo, vertices: r.vertices.map((v) => [...v]) }))
    centroide(recintos)
    expect(recintos).toEqual(copia)
  })
})
