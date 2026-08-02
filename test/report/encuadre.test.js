/* -------------------------------------------------------------------------- *
 * test/report/encuadre.test.js — F09 · T2.1 · El encuadre del plano            *
 *                                                                            *
 * `report/encuadre.js` decide QUÉ trozo de mundo sale en el plano del informe *
 * y a QUÉ escala, así que lo que aquí se afirma no es que compile, sino que   *
 * las cuatro cosas que cuelgan del encuadre —el `BBOX=` del WMS, el mapeo     *
 * UTM→px, la barra gráfica y la escala rotulada— digan lo mismo.              *
 *                                                                            *
 * Cómo se eligen los valores de control (lo mismo que en                      *
 * `test/geo/bbox.test.js`, y por el mismo motivo):                            *
 *                                                                            *
 *   · **Los puntos de control del mapeo están calculados A MANO** sobre un    *
 *     caso construido para que TODOS los números sean exactos: un cuadrado de *
 *     100×100 m en 100×50 mm a 254 ppp da 1000×500 px, 5 px/m redondos y      *
 *     esquinas en píxeles enteros. Un valor «calculado» ejecutando el código  *
 *     que se quiere probar confirma cualquier error en vez de detectarlo.     *
 *   · **La escala se contrasta sobre la parcela real** del expediente         *
 *     (`cp_parcela_9398516VK3799G.gml`), leída con `parsearGml`: aquí no se   *
 *     inventan POJOs de geometría catastral. Control externo: 1:538.          *
 *   · **El troceado se prueba a fondo**, que es donde esto se rompe, y con    *
 *     igualdad EXACTA de coma flotante en las costuras. El criterio está      *
 *     justificado en el bloque 6, con la evidencia de que no es vacuo.        *
 *                                                                            *
 * Proyecto Vitest `node`: aritmética pura, sin DOM.                           *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parsearGml } from '../../gml/parse.js'
import {
  MARGEN_DEFECTO_M,
  MAX_PIXELES_TESELA,
  MM_POR_PULGADA,
  PPP_INFORME,
  encuadrar,
  pxDesdeMm,
} from '../../report/encuadre.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'report', 'encuadre.js'), 'utf8')

// ── El arnés: la parcela real, leída del fichero ─────────────────────────────

/** Lee un GML decodificándolo con el encoding que el propio fichero DECLARA. */
function leerGml(nombre) {
  const bytes = readFileSync(join(RAIZ, 'test', 'fixtures', 'gml', nombre))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

const PARCELA = parsearGml(leerGml('cp_parcela_9398516VK3799G.gml')).parcelas[0]

// Control leído A MANO del `posList` del fichero (los mismos cuatro extremos que
// fija `test/geo/bbox.test.js`): 60,76 × 49,90 m.
const CAJA_REAL = { minX: 439222.47, minY: 4479637.48, maxX: 439283.23, maxY: 4479687.38 }

/** El papel de la Receta A: 180×130 mm a 300 ppp → 2126×1535 px. */
const A_MEDIA_HOJA = { anchoMm: 180, altoMm: 130 }

// ── El caso sintético de números redondos ────────────────────────────────────
//
// Un cuadrado de 100×100 m con el vértice inferior izquierdo en el origen. En
// 100×50 mm a 254 ppp el papel mide 1000×500 px EXACTOS (254 ppp son justo 10
// px/mm), el ratio es 2, y sin margen la caja crece solo en X: de [0,100] pasa a
// [−50,150]. Resultado: 200 m sobre 1000 px = **5 px/m clavados en los dos ejes**
// y las cinco esquinas en píxeles enteros. Todo lo que se afirma sobre este caso
// se puede comprobar con lápiz.
const CUADRADO = [
  {
    tipo: 'EXTERIOR',
    vertices: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
  },
]
const REDONDO = { recintos: CUADRADO, anchoMm: 100, altoMm: 50, ppp: 254, margenM: 0 }

/** La caja `dentro` cabe entera en `fuera`: no se ha recortado nada. */
function esperarContencion(fuera, dentro) {
  expect(fuera.minX, 'minX ha crecido: se ha recortado por el oeste').toBeLessThanOrEqual(dentro.minX)
  expect(fuera.minY, 'minY ha crecido: se ha recortado por el sur').toBeLessThanOrEqual(dentro.minY)
  expect(fuera.maxX, 'maxX ha menguado: se ha recortado por el este').toBeGreaterThanOrEqual(dentro.maxX)
  expect(fuera.maxY, 'maxY ha menguado: se ha recortado por el norte').toBeGreaterThanOrEqual(dentro.maxY)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · pxDesdeMm — el paso 2 de la Receta A
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · pxDesdeMm', () => {
  it('254 ppp son 10 px/mm exactos (el caso sin redondeo)', () => {
    // 254 = 10 · 25,4: la única resolución de la tabla donde la conversión es
    // exacta. Sirve de control de que la fórmula es `mm/25,4 · ppp` y no otra.
    expect(pxDesdeMm(100, 254)).toBe(1000)
    expect(pxDesdeMm(50, 254)).toBe(500)
    expect(pxDesdeMm(1, 254)).toBe(10)
  })

  it('los tamaños del informe a 300 ppp, redondeados al entero', () => {
    // 180/25,4·300 = 2125,98… → 2126   ·   130/25,4·300 = 1535,43… → 1535
    expect(pxDesdeMm(180, 300)).toBe(2126)
    expect(pxDesdeMm(130, 300)).toBe(1535)
    // A3 apaisado: 420/25,4·300 = 4960,63… → 4961   ·   297 mm → 3507,87… → 3508
    expect(pxDesdeMm(420, 300)).toBe(4961)
    expect(pxDesdeMm(297, 300)).toBe(3508)
  })

  it('el valor por defecto de ppp es el del informe', () => {
    expect(PPP_INFORME).toBe(300)
    expect(pxDesdeMm(180)).toBe(pxDesdeMm(180, 300))
  })

  it('un papel que no llega a un píxel no se acepta en silencio', () => {
    // Redondearía a 0 y el WMS recibiría `WIDTH=0`. Es un valor imposible, no un
    // tipo equivocado: RangeError.
    expect(() => pxDesdeMm(0.01, 1)).toThrow(RangeError)
    expect(() => pxDesdeMm(0.01, 1)).toThrow(/0 píxeles/)
  })

  it('contrato roto: tipo → TypeError, valor imposible → RangeError', () => {
    expect(() => pxDesdeMm('180', 300)).toThrow(TypeError)
    expect(() => pxDesdeMm(null, 300)).toThrow(/recibido null/)
    expect(() => pxDesdeMm(180, '300')).toThrow(TypeError)
    expect(() => pxDesdeMm(0, 300)).toThrow(RangeError)
    expect(() => pxDesdeMm(-180, 300)).toThrow(RangeError)
    expect(() => pxDesdeMm(Number.NaN, 300)).toThrow(RangeError)
    expect(() => pxDesdeMm(180, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El papel: píxeles, ecos y resolución realmente conseguida
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · el papel', () => {
  const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })

  it('180×130 mm a 300 ppp son 2126×1535 px', () => {
    expect(e.anchoPx).toBe(2126)
    expect(e.altoPx).toBe(1535)
  })

  it('devuelve el tamaño físico y la resolución PEDIDA sin tocarlos', () => {
    expect(e.anchoMm).toBe(180)
    expect(e.altoMm).toBe(130)
    expect(e.ppp).toBe(300)
  })

  it('y la resolución CONSEGUIDA, que no es la misma (regla de oro 1)', () => {
    // El redondeo a píxeles enteros no se puede evitar (WMS y canvas los exigen)
    // pero tampoco se calla: 2126 px sobre 180 mm son 300,002 ppp y 1535 sobre
    // 130 mm son 299,915. Quien rotula el PDF lo tiene delante.
    expect(e.pppReal.x).toBeCloseTo(2126 / (180 / MM_POR_PULGADA), 9)
    expect(e.pppReal.x).toBeCloseTo(300.0022, 4)
    expect(e.pppReal.y).toBeCloseTo(299.9154, 4)
    expect(e.pppReal.x).not.toBe(e.pppReal.y)
  })

  it('el caso de números redondos consigue los 254 ppp exactos en los dos ejes', () => {
    const r = encuadrar(REDONDO)
    expect(r.anchoPx).toBe(1000)
    expect(r.altoPx).toBe(500)
    expect(r.pppReal).toEqual({ x: 254, y: 254 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · La caja: contención, ratio y margen
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · la caja del plano', () => {
  it('la caja de números redondos sale donde dice el lápiz', () => {
    // Cuadrado [0,100]², ratio 2, sin margen: el alto manda (100 m), el ancho
    // tiene que ser 200 m y crece 50 m por cada lado.
    expect(encuadrar(REDONDO).bbox).toEqual({ minX: -50, minY: 0, maxX: 150, maxY: 100 })
  })

  it('sobre la parcela real: margen de 10 m y ratio 2126/1535 → 96,81 × 69,90 m', () => {
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA, margenM: 10 })
    const alto = e.bbox.maxY - e.bbox.minY
    const ancho = e.bbox.maxX - e.bbox.minX
    // Alto: 49,90 m de parcela + 10 m por arriba y otros 10 por abajo.
    expect(alto).toBeCloseTo(CAJA_REAL.maxY - CAJA_REAL.minY + 20, 6)
    expect(alto).toBeCloseTo(69.9, 6)
    // Ancho: el alto ya ajustado, por el ratio del papel. 80,76 m no llegaban.
    expect(ancho).toBeCloseTo(69.9 * (2126 / 1535), 6)
    expect(ancho).toBeCloseTo(96.81, 2)
  })

  it('el margen por defecto son 10 m, y el 0 es legítimo', () => {
    expect(MARGEN_DEFECTO_M).toBe(10)
    const conDefecto = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    const explicito = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA, margenM: 10 })
    expect(conDefecto.bbox).toEqual(explicito.bbox)

    const sinMargen = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA, margenM: 0 })
    expect(sinMargen.bbox.maxY - sinMargen.bbox.minY).toBeCloseTo(49.9, 6)
    // Sin margen la caja sigue conteniendo la parcela, pero pegada al lindero.
    esperarContencion(sinMargen.bbox, CAJA_REAL)
  })

  it('el ratio de la caja es el del papel, y NO deforma', () => {
    for (const papel of [
      { anchoMm: 180, altoMm: 130 },
      { anchoMm: 130, altoMm: 180 }, // vertical: ahora manda el ancho
      { anchoMm: 100, altoMm: 100 }, // cuadrado
      { anchoMm: 420, altoMm: 297 },
    ]) {
      const e = encuadrar({ recintos: PARCELA.recintos, ...papel })
      const ratioCaja = (e.bbox.maxX - e.bbox.minX) / (e.bbox.maxY - e.bbox.minY)
      expect(ratioCaja, `ratio deformado en ${papel.anchoMm}×${papel.altoMm}`).toBeCloseTo(
        e.anchoPx / e.altoPx,
        10,
      )
    }
  })

  it('la caja de la parcela queda CONTENIDA tras el margen y el ajuste', () => {
    // La aserción que importa: si algún día `bboxAlRatio` recortara en vez de
    // crecer, un lindero desaparecería de un documento que se firma.
    for (const papel of [
      { anchoMm: 180, altoMm: 130 },
      { anchoMm: 130, altoMm: 180 },
      { anchoMm: 60, altoMm: 200 },
    ]) {
      const e = encuadrar({ recintos: PARCELA.recintos, ...papel })
      esperarContencion(e.bbox, CAJA_REAL)
    }
  })

  it('`otrosRecintos` mete en el plano la geometría que también hay que dibujar', () => {
    // El plano lleva al menos dos geometrías (la medición y el contorno oficial).
    // Un vecino a 200 m al este cae FUERA si no se declara…
    const lejos = [
      {
        tipo: 'EXTERIOR',
        vertices: [
          [200, 0],
          [300, 0],
          [300, 100],
        ],
      },
    ]
    const solo = encuadrar(REDONDO)
    expect(solo.bbox.maxX).toBe(150)

    // …y dentro si se declara: la caja pasa a ser la unión, [0,300]×[0,100], que
    // al ratio 2 crece en Y hasta [−25,125].
    const con = encuadrar({ ...REDONDO, otrosRecintos: [lejos] })
    expect(con.bbox).toEqual({ minX: 0, minY: -25, maxX: 300, maxY: 125 })
    esperarContencion(con.bbox, { minX: 0, minY: 0, maxX: 300, maxY: 100 })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · toPx — puntos de control calculados a mano
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · toPx (UTM → píxel, y invertida)', () => {
  const e = encuadrar(REDONDO) // bbox [−50,150]×[0,100] sobre 1000×500 px → 5 px/m

  it('5 px/m clavados en los dos ejes', () => {
    expect(e.sx).toBe(5)
    expect(e.sy).toBe(5)
  })

  it('las cuatro esquinas van a las cuatro esquinas del lienzo', () => {
    // El NORTE ARRIBA: la esquina de máximo Y es la fila 0, no la última. Si
    // alguien quitara la inversión, estas cuatro aserciones cambiarían de pareja
    // dos a dos y el plano saldría del revés.
    expect(e.toPx([-50, 100]), 'NO → (0,0)').toEqual([0, 0])
    expect(e.toPx([150, 100]), 'NE → (ancho,0)').toEqual([1000, 0])
    expect(e.toPx([-50, 0]), 'SO → (0,alto)').toEqual([0, 500])
    expect(e.toPx([150, 0]), 'SE → (ancho,alto)').toEqual([1000, 500])
  })

  it('el centro de la caja es el centro del lienzo', () => {
    expect(e.toPx([50, 50])).toEqual([500, 250])
  })

  it('los vértices del cuadrado caen donde los pone el lápiz', () => {
    // (0,0) está 50 m al este del borde oeste → 250 px; y en el borde sur → 500.
    expect(e.toPx([0, 0])).toEqual([250, 500])
    expect(e.toPx([100, 100])).toEqual([750, 0])
    expect(e.toPx([100, 0])).toEqual([750, 500])
    expect(e.toPx([0, 100])).toEqual([250, 0])
  })

  it('un punto fuera del encuadre devuelve píxeles fuera del lienzo, no recortados', () => {
    // Recortar al lienzo escondería que algo se ha quedado fuera del plano; que
    // salga por −250 es la respuesta correcta y además se ve al dibujar.
    expect(e.toPx([-100, 150])).toEqual([-250, -250])
    expect(e.toPx([200, -50])).toEqual([1250, 750])
  })

  it('no redondea: el subpíxel se conserva', () => {
    // A 300 ppp, medio píxel son 42 µm de papel; redondear aquí tiraría el
    // antialias del trazo. 0,1 m · 5 px/m = 0,5 px.
    expect(e.toPx([0.1, 0])[0]).toBeCloseTo(250.5, 12)
  })

  it('sobre la parcela real, el mapeo es el inverso de la escala', () => {
    const real = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    const [px, py] = real.toPx([real.bbox.minX, real.bbox.maxY])
    expect(px).toBeCloseTo(0, 9)
    expect(py).toBeCloseTo(0, 9)
    const [px2, py2] = real.toPx([real.bbox.maxX, real.bbox.minY])
    expect(px2).toBeCloseTo(real.anchoPx, 6)
    expect(py2).toBeCloseTo(real.altoPx, 6)
  })

  it('un par que no son dos números finitos LANZA en vez de propagar NaN', () => {
    // Un NaN no lanza nada: se propaga a `ctx.lineTo` y produce un trazo que
    // simplemente no aparece. Error silencioso de manual (regla de oro 1).
    expect(() => e.toPx([Number.NaN, 0])).toThrow(TypeError)
    expect(() => e.toPx([0, undefined])).toThrow(TypeError)
    expect(() => e.toPx(null)).toThrow(TypeError)
    expect(() => e.toPx('439222.47,4479637.48')).toThrow(TypeError)
    expect(() => e.toPx([0, 0, 0])).not.toThrow() // un tercer valor se ignora
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · La escala
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · la escala numérica', () => {
  it('la parcela real en 180×130 mm sale a 1:538', () => {
    // Control externo del enunciado de la tarea. A mano: la caja mide
    // 69,90 · 2126/1535 = 96,8126 m de ancho; 96,8126 · 1000 / 180 = 537,85 → 538.
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA, margenM: 10 })
    expect(e.escalaDenominador).toBe(538)
    expect(e.escalaExacta).toBeCloseTo(537.848, 3)
  })

  it('el caso redondo sale a 1:2000 exacto', () => {
    // 200 m de caja en 100 mm de papel: 200·1000/100 = 2000, sin redondeo.
    const e = encuadrar(REDONDO)
    expect(e.escalaExacta).toBe(2000)
    expect(e.escalaDenominador).toBe(2000)
  })

  it('el denominador es un ENTERO y dice de qué se ha redondeado', () => {
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    expect(Number.isInteger(e.escalaDenominador)).toBe(true)
    expect(e.escalaDenominador).toBe(Math.round(e.escalaExacta))
    expect(e.escalaExacta).not.toBe(e.escalaDenominador)
  })

  it('la escala rotulada es la del ancho, y la del alto difiere un 0,03 %', () => {
    // Es el residuo que el redondeo a píxeles enteros empuja al PAPEL, y no se
    // esconde: se puede leer del propio resultado. 0,029 % sobre 180 mm son
    // 0,05 mm, por debajo de lo que imprime ningún equipo.
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    const escalaY = ((e.bbox.maxY - e.bbox.minY) * 1000) / e.altoMm
    expect(e.escalaExacta).toBeCloseTo(537.848, 3)
    expect(escalaY).toBeCloseTo(537.692, 3)
    expect(Math.abs(e.escalaExacta - escalaY) / e.escalaExacta).toBeLessThan(0.0005)
    // Las dos rotularían el mismo entero, que es lo que hace inofensivo el residuo.
    expect(Math.round(escalaY)).toBe(e.escalaDenominador)
  })

  it('una escala que saldría 1:0 no se devuelve: no es una escala', () => {
    const microscopica = [
      { tipo: 'EXTERIOR', vertices: [[0, 0], [0.02, 0], [0.02, 0.01]] },
    ]
    expect(() =>
      encuadrar({ recintos: microscopica, anchoMm: 100, altoMm: 50, margenM: 0 }),
    ).toThrow(RangeError)
    expect(() =>
      encuadrar({ recintos: microscopica, anchoMm: 100, altoMm: 50, margenM: 0 }),
    ).toThrow(/1:0/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · El residuo entre sx y sy — la decisión, medida
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · sx y sy tras el ajuste al ratio', () => {
  it('son el mismo número real, y en float64 difieren en menos de 1e-9 relativo', () => {
    // Con la caja ya al ratio `anchoPx/altoPx`, `anchoUtm/altoUtm` ES
    // `anchoPx/altoPx`, luego sx = sy en aritmética exacta. Lo que queda es el ulp
    // de restar coordenadas UTM de magnitud 4,4·10⁶ (~10⁻⁹ m), no la
    // multiplicación por el ratio.
    for (const papel of [
      { anchoMm: 180, altoMm: 130 },
      { anchoMm: 130, altoMm: 180 },
      { anchoMm: 420, altoMm: 297 },
      { anchoMm: 100, altoMm: 100 },
    ]) {
      const e = encuadrar({ recintos: PARCELA.recintos, ...papel })
      const relativo = Math.abs(e.sx - e.sy) / e.sx
      expect(relativo, `sx y sy divergen en ${papel.anchoMm}×${papel.altoMm}`).toBeLessThan(1e-9)
    }
  })

  it('el residuo medido sobre la parcela real vale ~4e-13, o sea 1e-9 px de plano', () => {
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    const relativo = Math.abs(e.sx - e.sy) / e.sx
    expect(relativo).toBeGreaterThan(0) // no son el mismo double: el residuo existe
    expect(relativo).toBeLessThan(1e-12)
    // Traducido a lo único que se ve: píxeles a lo ancho del plano.
    expect(relativo * e.anchoPx).toBeLessThan(1e-8)
  })

  it('no se promedian: cada eje conserva la escala con la que el WMS rasteriza', () => {
    // El servicio estira el BBOX sobre WIDTH×HEIGHT con una escala por eje. `sx` y
    // `sy` son EXACTAMENTE esas dos, y por eso el vector registra con la imagen.
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    expect(e.sx).toBe(e.anchoPx / (e.bbox.maxX - e.bbox.minX))
    expect(e.sy).toBe(e.altoPx / (e.bbox.maxY - e.bbox.minY))
  })

  it('`sx` es el que necesita la barra de escala gráfica', () => {
    // `barra_px = N · sx` (dossier §4.4). Sale del encuadre para que nadie lo
    // recalcule por su cuenta: una segunda aritmética es una segunda verdad.
    const e = encuadrar(REDONDO)
    expect(20 * e.sx).toBe(100) // una barra de 20 m mide 100 px a 5 px/m
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · El troceado
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Todas las invariantes de la rejilla, en un sitio: es lo que se le exige a
 * CUALQUIER encuadre, trocee o no. Devuelve las teselas por filas para que quien
 * llame pueda seguir afirmando cosas concretas encima.
 */
function verificarRejilla(e, maxPx, etiqueta) {
  const { columnas, filas } = e.rejilla
  expect(e.teselas.length, `${etiqueta}: nº de teselas`).toBe(columnas * filas)

  const porFilas = []
  for (let f = 0; f < filas; f++) porFilas.push(e.teselas.slice(f * columnas, (f + 1) * columnas))

  // (a) Ninguna tesela cruza el techo del servicio. Es LA razón de ser del troceado.
  for (const t of e.teselas) {
    expect(t.anchoPx, `${etiqueta}: tesela de ${t.anchoPx} px de ancho`).toBeLessThanOrEqual(maxPx)
    expect(t.altoPx, `${etiqueta}: tesela de ${t.altoPx} px de alto`).toBeLessThanOrEqual(maxPx)
    expect(t.anchoPx).toBeGreaterThan(0)
    expect(t.altoPx).toBeGreaterThan(0)
  }

  // (b) Los anchos de una fila suman el ancho del lienzo, EXACTO (son enteros).
  for (const fila of porFilas) {
    expect(fila.reduce((s, t) => s + t.anchoPx, 0), `${etiqueta}: suma de anchos`).toBe(e.anchoPx)
  }
  for (let c = 0; c < columnas; c++) {
    const columna = porFilas.map((fila) => fila[c])
    expect(columna.reduce((s, t) => s + t.altoPx, 0), `${etiqueta}: suma de altos`).toBe(e.altoPx)
  }

  // (c) Los offsets encadenan sin hueco ni solape en el lienzo.
  for (const fila of porFilas) {
    expect(fila[0].offsetX).toBe(0)
    for (let c = 1; c < columnas; c++) {
      expect(fila[c].offsetX, `${etiqueta}: offsetX de la columna ${c}`).toBe(
        fila[c - 1].offsetX + fila[c - 1].anchoPx,
      )
    }
  }
  for (let c = 0; c < columnas; c++) {
    expect(porFilas[0][c].offsetY).toBe(0)
    for (let f = 1; f < filas; f++) {
      expect(porFilas[f][c].offsetY, `${etiqueta}: offsetY de la fila ${f}`).toBe(
        porFilas[f - 1][c].offsetY + porFilas[f - 1][c].altoPx,
      )
    }
  }

  // (d) LAS COSTURAS, por IGUALDAD EXACTA de coma flotante. El criterio está
  //     razonado en la cabecera del módulo y su no-vacuidad se demuestra abajo:
  //     los dos bordes salen del MISMO elemento del array de cortes, así que la
  //     igualdad es estructural. Con `toBeCloseTo` esta aserción daría verde con
  //     cualquier implementación, incluida una que calculara cada borde aparte.
  for (const fila of porFilas) {
    for (let c = 1; c < columnas; c++) {
      expect(fila[c].bbox.minX, `${etiqueta}: costura vertical ${c}`).toBe(fila[c - 1].bbox.maxX)
    }
  }
  for (let c = 0; c < columnas; c++) {
    for (let f = 1; f < filas; f++) {
      // La fila de ABAJO tiene menos Norte: su maxY es el minY de la de arriba.
      expect(porFilas[f][c].bbox.maxY, `${etiqueta}: costura horizontal ${f}`).toBe(
        porFilas[f - 1][c].bbox.minY,
      )
    }
  }

  // (e) La unión de los bbox reconstruye el bbox completo, bit a bit. Con
  //     `reduce` y no con `Math.min(...)`: una rejilla fina desborda la pila de
  //     argumentos y el test moriría por el andamio, no por el módulo.
  const menor = (clave) => e.teselas.reduce((m, t) => Math.min(m, t.bbox[clave]), Infinity)
  const mayor = (clave) => e.teselas.reduce((m, t) => Math.max(m, t.bbox[clave]), -Infinity)
  expect(menor('minX'), `${etiqueta}: unión minX`).toBe(e.bbox.minX)
  expect(menor('minY'), `${etiqueta}: unión minY`).toBe(e.bbox.minY)
  expect(mayor('maxX'), `${etiqueta}: unión maxX`).toBe(e.bbox.maxX)
  expect(mayor('maxY'), `${etiqueta}: unión maxY`).toBe(e.bbox.maxY)

  // (f) Cada tesela se pide a la MISMA escala que el plano. Si una difiriera, su
  //     trozo de cartografía entraría en el lienzo con otro tamaño de terreno por
  //     píxel y la costura casaría en píxeles pero no en el mundo.
  for (const t of e.teselas) {
    const sxT = t.anchoPx / (t.bbox.maxX - t.bbox.minX)
    const syT = t.altoPx / (t.bbox.maxY - t.bbox.minY)
    expect(Math.abs(sxT - e.sx) / e.sx, `${etiqueta}: escala X de una tesela`).toBeLessThan(1e-9)
    expect(Math.abs(syT - e.sy) / e.sy, `${etiqueta}: escala Y de una tesela`).toBeLessThan(1e-9)
  }

  return porFilas
}

describe('report/encuadre · el troceado', () => {
  it('la ruta NORMAL del informe es una sola GetMap', () => {
    // 2126×1535 px caben de sobra bajo los 4000 medidos. El troceado existe por
    // el criterio 3 de la spec, no porque el caso por defecto lo necesite.
    const e = encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    expect(e.rejilla).toEqual({ columnas: 1, filas: 1 })
    expect(e.teselas).toHaveLength(1)
    expect(e.teselas[0]).toEqual({
      bbox: e.bbox,
      anchoPx: 2126,
      altoPx: 1535,
      offsetX: 0,
      offsetY: 0,
    })
    verificarRejilla(e, MAX_PIXELES_TESELA, 'una sola tesela')
  })

  it('A3 apaisado a 300 ppp (4961×3508) se parte en DOS columnas', () => {
    // El caso realista que dispara el troceado de verdad: 420 mm → 4961 px, por
    // encima de los 4000 que sirve el WMS. 4961 = 2480 + 2481.
    const e = encuadrar({ recintos: PARCELA.recintos, anchoMm: 420, altoMm: 297 })
    expect([e.anchoPx, e.altoPx]).toEqual([4961, 3508])
    expect(e.rejilla).toEqual({ columnas: 2, filas: 1 })
    expect(e.teselas.map((t) => t.anchoPx)).toEqual([2480, 2481])
    expect(e.teselas.map((t) => t.altoPx)).toEqual([3508, 3508])
    expect(e.teselas.map((t) => t.offsetX)).toEqual([0, 2480])
    expect(e.teselas.map((t) => t.offsetY)).toEqual([0, 0])
    verificarRejilla(e, MAX_PIXELES_TESELA, 'A3 apaisado')

    // Y las dos peticiones son legales contra el servicio real (4000 por eje).
    for (const t of e.teselas) {
      expect(Math.max(t.anchoPx, t.altoPx)).toBeLessThanOrEqual(4000)
    }
  })

  it('un papel grande en los dos ejes da una rejilla 2×2', () => {
    const e = encuadrar({ recintos: PARCELA.recintos, anchoMm: 420, altoMm: 420 })
    expect([e.anchoPx, e.altoPx]).toEqual([4961, 4961])
    expect(e.rejilla).toEqual({ columnas: 2, filas: 2 })
    const filas = verificarRejilla(e, MAX_PIXELES_TESELA, 'rejilla 2×2')
    // La fila de arriba es la del NORTE: su maxY es el del plano.
    expect(filas[0][0].bbox.maxY).toBe(e.bbox.maxY)
    expect(filas[1][0].bbox.minY).toBe(e.bbox.minY)
    expect(filas[0][0].bbox.minX).toBe(e.bbox.minX)
    expect(filas[0][1].bbox.maxX).toBe(e.bbox.maxX)
  })

  it('la rejilla 4×2 de números redondos sale donde dice el lápiz', () => {
    // 1000×500 px con techo 300 → 4 columnas de 250 px y 2 filas de 250. Sobre la
    // caja [−50,150]×[0,100], los cortes caen en −50/0/50/100/150 y 100/50/0:
    // todos exactos, así que aquí se pueden escribir a mano.
    const e = encuadrar({ ...REDONDO, maxPx: 300 })
    expect(e.rejilla).toEqual({ columnas: 4, filas: 2 })
    const filas = verificarRejilla(e, 300, 'rejilla 4×2 redonda')

    expect(filas[0].map((t) => t.bbox)).toEqual([
      { minX: -50, minY: 50, maxX: 0, maxY: 100 },
      { minX: 0, minY: 50, maxX: 50, maxY: 100 },
      { minX: 50, minY: 50, maxX: 100, maxY: 100 },
      { minX: 100, minY: 50, maxX: 150, maxY: 100 },
    ])
    expect(filas[1].map((t) => t.bbox)).toEqual([
      { minX: -50, minY: 0, maxX: 0, maxY: 50 },
      { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      { minX: 50, minY: 0, maxX: 100, maxY: 50 },
      { minX: 100, minY: 0, maxX: 150, maxY: 50 },
    ])
    expect(e.teselas.map((t) => [t.offsetX, t.offsetY])).toEqual([
      [0, 0], [250, 0], [500, 0], [750, 0],
      [0, 250], [250, 250], [500, 250], [750, 250],
    ])
  })

  it('el reparto de píxeles no acumula error: 1001 px en 3 → 333+334+334', () => {
    // `floor(i·total/n)` reparte el resto entre tramos distintos en vez de
    // dejárselo entero al último, que es como se cuela una tesela por encima del
    // techo cuando el total es un múltiplo justo por encima.
    const e = encuadrar({ ...REDONDO, anchoMm: 100.1, maxPx: 400 })
    expect(e.anchoPx).toBe(1001)
    expect(e.rejilla.columnas).toBe(3)
    expect(e.teselas.slice(0, 3).map((t) => t.anchoPx)).toEqual([333, 334, 334])
  })

  it('barrido: 90 papeles distintos y ninguna tesela se pasa del techo', () => {
    // La invariante que de verdad protege del modo de fallo medido (pedir 4200 y
    // recibir 4000×2000 sin aviso) no se comprueba con un caso, se comprueba con
    // todos los que quepan.
    let troceados = 0
    for (const anchoMm of [200, 297, 420, 594, 700, 841, 1000]) {
      for (const altoMm of [150, 210, 297, 400, 594]) {
        for (const ppp of [300, 400, 600]) {
          const e = encuadrar({ recintos: PARCELA.recintos, anchoMm, altoMm, ppp })
          verificarRejilla(e, MAX_PIXELES_TESELA, `${anchoMm}×${altoMm} @ ${ppp}`)
          if (e.teselas.length > 1) troceados++
        }
      }
    }
    expect(troceados, 'el barrido no ha llegado a trocear nada: no prueba nada').toBeGreaterThan(50)
  })

  it('barrido con techos pequeños: la rejilla aguanta cualquier `maxPx`', () => {
    // Con y sin resto, justo por encima y justo por debajo de cada dimensión: son
    // las fronteras donde `ceil` cambia de valor y donde el reparto deja resto.
    for (const maxPx of [63, 250, 333, 499, 500, 501, 999, 1000, 1001]) {
      const e = encuadrar({ ...REDONDO, maxPx })
      verificarRejilla(e, maxPx, `maxPx=${maxPx}`)
      expect(e.rejilla.columnas).toBe(Math.ceil(1000 / maxPx))
      expect(e.rejilla.filas).toBe(Math.ceil(500 / maxPx))
    }
  })

  it('la igualdad EXACTA de las costuras no es vacua: hay una alternativa que falla', () => {
    // Si cualquier forma razonable de calcular el corte diera el mismo double, la
    // aserción (d) de `verificarRejilla` no distinguiría nada y sería una
    // tolerancia disfrazada. No es el caso: barriendo los mismos 90 papeles, la
    // variante `minX + offset/sx` —la que sale sola si cada tesela deduce su
    // borde de su propio offset— se separa del corte compartido en al menos uno.
    // La diferencia es de un ulp de coordenada UTM (~6·10⁻¹¹ m) y no rompería
    // ningún plano; lo que rompería es la posibilidad de AFIRMAR la contigüidad.
    const divergentes = []
    for (const anchoMm of [200, 297, 420, 594, 700, 841, 1000]) {
      for (const altoMm of [150, 210, 297, 400, 594]) {
        for (const ppp of [300, 400, 600]) {
          const e = encuadrar({ recintos: PARCELA.recintos, anchoMm, altoMm, ppp })
          for (let c = 1; c < e.rejilla.columnas; c++) {
            const t = e.teselas[c]
            if (e.bbox.minX + t.offsetX / e.sx !== t.bbox.minX) {
              divergentes.push(`${anchoMm}×${altoMm} @ ${ppp} ppp, corte ${c}`)
            }
          }
        }
      }
    }
    expect(
      divergentes.length,
      'ninguna alternativa razonable difiere del corte compartido: revisa si la ' +
        'igualdad exacta de las costuras sigue afirmando algo',
    ).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Contratos rotos por el programador
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · contrato roto', () => {
  it('la entrada tiene que ser un objeto', () => {
    expect(() => encuadrar(null)).toThrow(TypeError)
    expect(() => encuadrar(null)).toThrow(/recibido null/)
    expect(() => encuadrar([PARCELA.recintos])).toThrow(TypeError)
    expect(() => encuadrar()).toThrow(TypeError)
  })

  it('las medidas del papel: TypeError por tipo, RangeError por valor', () => {
    const base = { recintos: CUADRADO, anchoMm: 100, altoMm: 50 }
    expect(() => encuadrar({ ...base, anchoMm: '100' })).toThrow(TypeError)
    expect(() => encuadrar({ ...base, anchoMm: '100' })).toThrow(/'anchoMm'/)
    expect(() => encuadrar({ ...base, altoMm: null })).toThrow(TypeError)
    expect(() => encuadrar({ ...base, altoMm: null })).toThrow(/'altoMm'/)
    expect(() => encuadrar({ ...base, anchoMm: 0 })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, altoMm: -50 })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, ppp: 0 })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, ppp: Number.NaN })).toThrow(RangeError)
  })

  it('`maxPx` tiene que ser un entero de píxeles', () => {
    const base = { recintos: CUADRADO, anchoMm: 100, altoMm: 50 }
    expect(() => encuadrar({ ...base, maxPx: '4000' })).toThrow(TypeError)
    expect(() => encuadrar({ ...base, maxPx: 0 })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, maxPx: -1 })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, maxPx: 3.5 })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, maxPx: 3.5 })).toThrow(/ENTERO/)
  })

  it('`otrosRecintos` tiene que ser un array de conjuntos de recintos', () => {
    const base = { recintos: CUADRADO, anchoMm: 100, altoMm: 50 }
    expect(() => encuadrar({ ...base, otrosRecintos: CUADRADO[0] })).toThrow(TypeError)
    expect(() => encuadrar({ ...base, otrosRecintos: 'oficial' })).toThrow(TypeError)
    // Un conjunto mal formado lo caza `geo/bbox.js`, con su mensaje.
    expect(() => encuadrar({ ...base, otrosRecintos: [CUADRADO[0]] })).toThrow(TypeError)
    expect(() => encuadrar({ ...base, otrosRecintos: [] })).not.toThrow()
  })

  it('los recintos los valida geo/bbox.js y su mensaje se deja pasar tal cual', () => {
    // Envolverlo aquí perdería el «recintos[1].vertices» que dice QUÉ anillo viene
    // roto, que es lo único útil del mensaje.
    const base = { anchoMm: 100, altoMm: 50 }
    expect(() => encuadrar({ ...base, recintos: [] })).toThrow(RangeError)
    expect(() => encuadrar({ ...base, recintos: [] })).toThrow(/^bbox:/)
    expect(() => encuadrar({ ...base, recintos: 'una parcela' })).toThrow(TypeError)
    expect(() => encuadrar({ ...base, recintos: [{ tipo: 'HUECO', vertices: [] }] })).toThrow(
      /recintos\[0\] debe ser el EXTERIOR/,
    )
  })

  it('el margen negativo lo rechaza `bboxConMargen`: un recorte con otro nombre', () => {
    expect(() =>
      encuadrar({ recintos: CUADRADO, anchoMm: 100, altoMm: 50, margenM: -1 }),
    ).toThrow(RangeError)
    expect(() =>
      encuadrar({ recintos: CUADRADO, anchoMm: 100, altoMm: 50, margenM: -1 }),
    ).toThrow(/^bboxConMargen:/)
  })

  it('una geometría degenerada en un punto no se encuadra', () => {
    // No hay lado del que deducir el otro: darle tamaño sería inventarse la escala.
    const punto = [{ tipo: 'EXTERIOR', vertices: [[5, 5], [5, 5], [5, 5]] }]
    expect(() => encuadrar({ recintos: punto, anchoMm: 100, altoMm: 50, margenM: 0 })).toThrow(
      RangeError,
    )
  })

  it('no muta los recintos que recibe (regla de oro 2)', () => {
    const antes = JSON.stringify(PARCELA.recintos)
    encuadrar({ recintos: PARCELA.recintos, ...A_MEDIA_HOJA })
    expect(JSON.stringify(PARCELA.recintos)).toBe(antes)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Pureza: sin reloj, sin DOM, sin red
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · es una función pura', () => {
  // Mismo guardián, con las mismas palabras, que `report/contraste-texto.js`: un
  // informe descargado es un SNAPSHOT y tiene que valer lo mismo dentro de un año.
  const INSTANCIA_FECHA = /\bnew\s+Date\b/
  const RELOJ = /\bDate\s*\.\s*now\b/
  const NAVEGADOR = /\b(?:document|window|globalThis|navigator)\s*\./
  const RED = /\bfetch\s*\(|\bXMLHttpRequest\b/
  const IMPORTA_PESADO = /(?:^|\n)[ \t]*import[^\n]*['"](?:leaflet|@turf\/|proj4)/

  it('no instancia una fecha propia ni consulta la marca de tiempo', () => {
    expect(INSTANCIA_FECHA.test(FUENTE_MODULO), 'instancia una fecha propia').toBe(false)
    expect(RELOJ.test(FUENTE_MODULO), 'consulta el reloj del sistema').toBe(false)
  })

  it('no toca el navegador ni la red', () => {
    expect(NAVEGADOR.test(FUENTE_MODULO), 'usa una API del navegador').toBe(false)
    expect(RED.test(FUENTE_MODULO), 'lanza una petición').toBe(false)
  })

  it('no arrastra Leaflet, Turf ni proj4 a un módulo de aritmética', () => {
    expect(IMPORTA_PESADO.test(FUENTE_MODULO)).toBe(false)
  })

  it('los detectores no son vacuos', () => {
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date . now()')).toBe(true)
    expect(NAVEGADOR.test('document.createElement("canvas")')).toBe(true)
    expect(RED.test('await fetch(url)')).toBe(true)
    expect(IMPORTA_PESADO.test("import L from 'leaflet'")).toBe(true)
    expect(IMPORTA_PESADO.test("import kinks from '@turf/kinks'")).toBe(true)
    // Y no confunden la MENCIÓN en un comentario con el uso: la cabecera de este
    // módulo nombra Leaflet y la ventana del navegador para explicar por qué NO
    // los usa, y esas frases no pueden hacer saltar el guardián.
    expect(NAVEGADOR.test('ese módulo importa Leaflet, que exige `window`.')).toBe(false)
    expect(IMPORTA_PESADO.test('// no se importa leaflet a propósito')).toBe(false)
  })

  it('la misma entrada da el mismo resultado, dos veces seguidas', () => {
    const sinFuncion = (e) => JSON.stringify({ ...e, toPx: undefined })
    const entrada = { recintos: PARCELA.recintos, anchoMm: 420, altoMm: 297 }
    expect(sinFuncion(encuadrar(entrada))).toBe(sinFuncion(encuadrar(entrada)))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · El techo del WMS, duplicado a propósito y guardado
// ═════════════════════════════════════════════════════════════════════════════

describe('report/encuadre · MAX_PIXELES_TESELA no puede divergir del WMS', () => {
  // `viewer/wms-catastro.js` importa Leaflet, que exige una ventana de navegador,
  // así que este módulo NO puede importar su constante y la declara otra vez. Lo
  // que impide que las dos diverjan es este test-guarda ESTÁTICO —lee el texto
  // fuente del otro fichero, sin ejecutarlo—, la misma fórmula con la que
  // `report/contraste-texto.js#OMISION_CONOCIDA` convive con `diagnostico/`.
  const FUENTE_WMS = readFileSync(join(RAIZ, 'viewer', 'wms-catastro.js'), 'utf8')

  it('vale exactamente lo mismo que `viewer/wms-catastro.js#MAX_PIXELES_WMS`', () => {
    const m = /export const MAX_PIXELES_WMS = (\d+)/.exec(FUENTE_WMS)
    expect(m, 'no se ha encontrado MAX_PIXELES_WMS: el guardián se ha quedado ciego').not.toBe(null)
    expect(Number(m[1])).toBe(MAX_PIXELES_TESELA)
  })

  it('es el techo MEDIDO del servicio: 4000 px por dimensión', () => {
    // 4000×100 se sirve exacto; 4200×100 y 5000×100 devuelven 4000×2000
    // SUSTITUYENDO ambas dimensiones, con HTTP 200 y sin una palabra de aviso.
    expect(MAX_PIXELES_TESELA).toBe(4000)
  })

  it('la conversión de pulgadas es la de la Receta A', () => {
    expect(MM_POR_PULGADA).toBe(25.4)
  })
})
