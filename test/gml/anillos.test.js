import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import booleanClockwise from '@turf/boolean-clockwise'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import { polygon } from '@turf/helpers'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import {
  DECIMALES_COORD,
  LIMITE_MAGNITUD_COORD,
  ORIENTACION_ESPERADA,
  ORIGEN_PUNTO,
  redondearCoord,
  redondearAnillo,
  invertirAnillo,
  cerrarAnillo,
  prepararRecintos,
  puntoInterior,
} from '../../gml/anillos.js'
import { TIPO_GML, SEVERIDAD } from '../../gml/_comun.js'
import { areaFirmada, orientacion, superficie } from '../../geo/area.js'
import { TIPO_RECINTO, crearRecinto } from '../../model/parcela.js'
import { reglasGeometria } from '../../validation/reglas-geometria.js'
import { NIVEL } from '../../validation/_comun.js'

// F04 · T2.1 — gml/anillos.js, el corazón numérico del serializador.
//
// La verdad numérica de este fichero es `test/fixtures/geo/parcela-ring.json`,
// extraído del GML real del WFS (`cp_parcela_9398516VK3799G.gml`): regla de oro 8.
// Todo lo que se puede derivar de él se deriva; los polígonos sintéticos (L,
// cuadrado con hueco, triángulo colapsado) existen porque el fixture real es un
// caso feliz —convexo, ya horario, ya redondeado— y las trampas que este módulo
// desactiva no aparecen en él. Van en coordenadas UTM plausibles, no en 0..10, a
// propósito: la mitad de los bugs de precisión solo se ven con Norte ≈ 4,5·10⁶.
//
// `@turf/boolean-clockwise` se usa aquí como ORÁCULO EXTERNO del signo, nunca
// como implementación (es devDependency; en producción manda `geo/area.js`).

// ── Datos derivados del fixture ──────────────────────────────────────────────

const EXTERIOR = ring.anilloExterior
const RECINTOS_REALES = [{ vertices: EXTERIOR, tipo: TIPO_RECINTO.EXTERIOR }]

// ── Polígonos sintéticos en UTM (huso 30, junto a la parcela del fixture) ────

const X0 = 439000
const Y0 = 4479000
/** Traslada un par en «metros desde la esquina» a UTM plausible. */
const utm = ([dx, dy]) => [X0 + dx, Y0 + dy]

/** Parcela en L (cóncava): el centro del bbox cae FUERA. */
const EN_L = [
  [0, 0],
  [10, 0],
  [10, 4],
  [4, 4],
  [4, 10],
  [0, 10],
].map(utm)

/** Cuadrado 10×10. */
const CUADRADO = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
].map(utm)

/** Hueco 4×4 centrado: el centro del bbox del exterior cae DENTRO del hueco. */
const HUECO_CENTRAL = [
  [3, 3],
  [7, 3],
  [7, 7],
  [3, 7],
].map(utm)

/** Polígono Turf (cerrado) de un conjunto de anillos abiertos. */
const poligonoDe = (...anillos) => polygon(anillos.map((a) => [...a, a[0]]))

/** Recintos a partir de anillos: el primero exterior, el resto huecos. */
const recintosDe = (...anillos) =>
  anillos.map((vertices, i) => ({
    vertices,
    tipo: i === 0 ? TIPO_RECINTO.EXTERIOR : TIPO_RECINTO.HUECO,
  }))

const tiposDe = (detecciones) => detecciones.map((d) => d.tipo)
const soloTipo = (detecciones, tipo) => detecciones.filter((d) => d.tipo === tipo)

// ═════════════════════════════════════════════════════════════════════════════
// 1 · redondearCoord — por qué toFixed y NUNCA Math.round(v*100)/100
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · redondearCoord', () => {
  // El valor no es de laboratorio: es la PRIMERA ABSCISA del anillo real
  // (439283.23) más medio centímetro. Justo el borde donde las dos fórmulas
  // dejan de coincidir, y con la magnitud UTM que tiene el dato de verdad.
  const AMBIGUA = 439283.235

  it('toFixed y Math.round(v*100)/100 DIVERGEN en una abscisa real: 439283.235', () => {
    expect(redondearCoord(AMBIGUA)).toBe(439283.23)
    expect(Math.round(AMBIGUA * 100) / 100).toBe(439283.24)
    expect(redondearCoord(AMBIGUA)).not.toBe(Math.round(AMBIGUA * 100) / 100)
    // Y el valor al que baja `toFixed` es exactamente la abscisa que trae el GML.
    expect(redondearCoord(AMBIGUA)).toBe(EXTERIOR[0][0])
    // El culpable, para que quede escrito: el producto ya no es representable.
    expect(AMBIGUA * 100).toBe(43928323.5)
  })

  it('solo toFixed garantiza «el número que se calcula es el que se escribe»', () => {
    // Esta es LA propiedad (regla de oro 11): el área se mide sobre el mismo
    // número que acaba en el posList. Se comprueba sobre TODAS las coordenadas
    // del anillo real más el caso ambiguo, sin lista escrita a mano.
    const valores = [...EXTERIOR.flat(), AMBIGUA, -AMBIGUA, 4479671.275, 0.125]
    for (const v of valores) {
      expect(redondearCoord(v).toFixed(DECIMALES_COORD), `v=${v}`).toBe(v.toFixed(DECIMALES_COORD))
    }
    // …y la fórmula prohibida NO la cumple, con ese mismo valor.
    const conMathRound = Math.round(AMBIGUA * 100) / 100
    expect(conMathRound.toFixed(DECIMALES_COORD)).not.toBe(AMBIGUA.toFixed(DECIMALES_COORD))
  })

  it('es idempotente: redondear lo ya redondeado no lo mueve', () => {
    for (const v of EXTERIOR.flat()) {
      expect(redondearCoord(redondearCoord(v))).toBe(redondearCoord(v))
      expect(redondearCoord(v)).toBe(v) // el fixture ya viene a 2 decimales
    }
  })

  it('normaliza el CERO NEGATIVO que fabrica toFixed', () => {
    // El peligro es real y está aquí escrito: sin normalizar, el valor arrastra
    // el signo (y `toEqual` de Vitest distingue -0 de 0, así que un round-trip
    // fallaría con un diff incomprensible).
    expect((-0.001).toFixed(DECIMALES_COORD)).toBe('-0.00')
    expect(Object.is(Number((-0.001).toFixed(DECIMALES_COORD)), -0)).toBe(true)
    expect(Object.is(redondearCoord(-0.001), 0)).toBe(true)
    expect(Object.is(redondearCoord(-0), 0)).toBe(true)
    expect(Object.is(redondearCoord(0), 0)).toBe(true)
  })

  it('LANZA por encima del límite: ahí toFixed acaba en notación exponencial', () => {
    // La razón de ser del límite, demostrada: un posList con esto dentro no es GML.
    expect((1e21).toFixed(DECIMALES_COORD)).toBe('1e+21')
    expect(() => redondearCoord(1e21)).toThrow(RangeError)
    expect(() => redondearCoord(LIMITE_MAGNITUD_COORD)).toThrow(RangeError)
    expect(() => redondearCoord(-LIMITE_MAGNITUD_COORD)).toThrow(RangeError)
    // Justo por debajo del límite sí pasa (el límite no está de adorno bajo).
    expect(redondearCoord(LIMITE_MAGNITUD_COORD / 10)).toBe(LIMITE_MAGNITUD_COORD / 10)
    // Y las coordenadas UTM reales están a diez órdenes de magnitud de rozarlo.
    for (const v of EXTERIOR.flat()) expect(Math.abs(v)).toBeLessThan(LIMITE_MAGNITUD_COORD)
  })

  it('no finito → RangeError; no numérico → TypeError (contrato del programador)', () => {
    expect(() => redondearCoord(NaN)).toThrow(RangeError)
    expect(() => redondearCoord(Infinity)).toThrow(RangeError)
    expect(() => redondearCoord(-Infinity)).toThrow(RangeError)
    expect(() => redondearCoord('439283.23')).toThrow(TypeError)
    expect(() => redondearCoord(null)).toThrow(TypeError)
    expect(() => redondearCoord(undefined)).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · redondearAnillo
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · redondearAnillo', () => {
  it('sobre el anillo real es la identidad EN VALOR pero una copia nueva', () => {
    const r = redondearAnillo(EXTERIOR)
    expect(r).toEqual(EXTERIOR)
    expect(r).not.toBe(EXTERIOR)
    r.forEach((v, i) => expect(v).not.toBe(EXTERIOR[i]))
  })

  it('lleva cada vértice a 2 decimales', () => {
    const crudo = EXTERIOR.map(([x, y]) => [x + 0.004, y - 0.0049])
    expect(redondearAnillo(crudo)).toEqual(EXTERIOR)
  })

  it('rechaza lo que no es un array de pares', () => {
    expect(() => redondearAnillo(null)).toThrow(TypeError)
    expect(() => redondearAnillo('x')).toThrow(TypeError)
    expect(() => redondearAnillo([[1, 2], [3]])).toThrow(TypeError)
    expect(() => redondearAnillo([[1, 2], 3])).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · invertirAnillo — el pivote no se mueve, y eso se NOTA en el último bit
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · invertirAnillo', () => {
  const invertido = invertirAnillo(EXTERIOR)
  const planoReverse = [...EXTERIOR].reverse()

  it('conserva el primer vértice y da la vuelta al resto', () => {
    expect(invertido[0]).toEqual(EXTERIOR[0])
    expect(invertido.slice(1)).toEqual(EXTERIOR.slice(1).reverse())
    expect(invertido).toHaveLength(EXTERIOR.length)
    // El `.reverse()` plano SÍ mueve el pivote: es lo que no queremos.
    expect(planoReverse[0]).not.toEqual(EXTERIOR[0])
  })

  it('invierte el signo del área firmada (que es para lo que existe)', () => {
    expect(orientacion(invertido)).toBe(-orientacion(EXTERIOR))
    expect(Math.sign(areaFirmada(invertido))).toBe(-Math.sign(areaFirmada(EXTERIOR)))
  })

  it('con el pivote intacto |área| es BIT-IDÉNTICA; con reverse plano NO', () => {
    // Medido sobre el anillo real: −1535.865149996761 → +1535.8651499967611.
    // `geo/area.js` traslada al PRIMER vértice antes del shoelace (regla 5), así
    // que cambiar el pivote cambia el origen local y con él el último bit.
    const referencia = Math.abs(areaFirmada(EXTERIOR))
    expect(Object.is(Math.abs(areaFirmada(invertido)), referencia)).toBe(true)
    expect(Object.is(Math.abs(areaFirmada(planoReverse)), referencia)).toBe(false)
    // Y sin embargo son «el mismo» número a efectos humanos: la diferencia vive
    // en el último bit, que es exactamente lo que la hace peligrosa.
    expect(Math.abs(areaFirmada(planoReverse))).toBeCloseTo(referencia, 9)
    expect(Math.round(Math.abs(areaFirmada(planoReverse)))).toBe(ring.areaValue)
  })

  it('es una INVOLUCIÓN: aplicarla dos veces devuelve el anillo original', () => {
    expect(invertirAnillo(invertido)).toEqual(EXTERIOR)
  })

  it('tolera el anillo vacío y rechaza lo que no es array', () => {
    expect(invertirAnillo([])).toEqual([])
    expect(() => invertirAnillo(null)).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · cerrarAnillo — el modelo vive abierto (regla de oro 4)
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · cerrarAnillo', () => {
  it('el anillo real abierto (15) se cierra en 16 repitiendo el primero', () => {
    const cerrado = cerrarAnillo(EXTERIOR)
    expect(cerrado).toHaveLength(16)
    expect(cerrado).toHaveLength(EXTERIOR.length + 1)
    expect(cerrado.at(-1)).toEqual(cerrado[0])
    expect(cerrado.at(-1)).toEqual(EXTERIOR[0])
    expect(cerrado.slice(0, -1)).toEqual(EXTERIOR)
  })

  it('no toca la entrada', () => {
    const copia = structuredClone(EXTERIOR)
    cerrarAnillo(EXTERIOR)
    expect(EXTERIOR).toEqual(copia)
  })

  it('el ORÁCULO externo confirma el sentido horario del anillo real cerrado', () => {
    // @turf/boolean-clockwise es devDependency: oráculo de test, jamás producción.
    // OJO (medido): Turf necesita el anillo CERRADO — sobre el abierto responde
    // lo contrario, porque le falta el segmento de vuelta.
    expect(booleanClockwise(cerrarAnillo(EXTERIOR))).toBe(true)
    expect(booleanClockwise(cerrarAnillo(invertirAnillo(EXTERIOR)))).toBe(false)
    // Y coincide con `geo/area.js`, que es quien manda en producción.
    expect(orientacion(EXTERIOR)).toBe(ORIENTACION_ESPERADA.EXTERIOR)
  })

  it('anillo vacío o no-array → TypeError (contrato del programador)', () => {
    expect(() => cerrarAnillo([])).toThrow(TypeError)
    expect(() => cerrarAnillo(null)).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · prepararRecintos sobre la PARCELA REAL (definición de hecho nº 1)
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · prepararRecintos con el anillo real del Catastro', () => {
  const r = prepararRecintos(RECINTOS_REALES)

  it('el exterior YA es horario: no hay que invertir nada', () => {
    expect(r.orientacionOriginal).toEqual([ring._verificado.orientacion])
    expect(r.orientacionOriginal[0]).toBe(ORIENTACION_ESPERADA.EXTERIOR)
    expect(r.invertidos).toEqual([false])
    expect(r.recintos[0].vertices).toEqual(EXTERIOR)
  })

  it('areaValue = |shoelace| redondeada = 1536 = el areaValue del GML real', () => {
    expect(r.areaValue).toBe(1536)
    expect(r.areaValue).toBe(ring.areaValue)
    expect(r.areaValue).toBe(Math.round(Math.abs(ring._verificado.areaFirmada)))
  })

  it('la superficie publicada sale de las coordenadas publicadas (regla 11)', () => {
    // El fixture ya viene a 2 decimales, así que el redondeo es la identidad y
    // las dos superficies coinciden BIT A BIT. Que coincidan es la prueba de que
    // no se ha colado ninguna transformación por el camino.
    expect(r.superficieRedondeada).toBe(Math.abs(ring._verificado.areaFirmada))
    expect(Object.is(r.superficieRedondeada, r.superficieModelo)).toBe(true)
    expect(r.superficieRedondeada).toBe(superficie(r.recintos))
    expect(r.areaValue).toBe(Math.round(r.superficieRedondeada))
  })

  it('15 vértices abiertos → 16 posiciones en el posList', () => {
    expect(r.nVertices).toBe(EXTERIOR.length)
    expect(r.nVertices).toBe(15)
    expect(cerrarAnillo(r.recintos[0].vertices)).toHaveLength(16)
  })

  it('no decide nada, luego no dice nada: cero detecciones', () => {
    expect(r.detecciones).toEqual([])
  })

  it('devuelve copias: la entrada queda intacta', () => {
    const antes = structuredClone(RECINTOS_REALES)
    prepararRecintos(RECINTOS_REALES)
    expect(RECINTOS_REALES).toEqual(antes)
    expect(r.recintos[0].vertices).not.toBe(EXTERIOR)
  })

  it('el oráculo de Turf valida la salida cerrada como HORARIA (criterio F04.2)', () => {
    expect(booleanClockwise(cerrarAnillo(r.recintos[0].vertices))).toBe(true)
  })

  it('acepta lo que fabrica model/parcela.js#crearRecinto', () => {
    const delModelo = prepararRecintos([crearRecinto(EXTERIOR, TIPO_RECINTO.EXTERIOR)])
    expect(delModelo.areaValue).toBe(ring.areaValue)
    expect(delModelo.recintos[0].vertices).toEqual(r.recintos[0].vertices)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Orientación (override O1): exterior HORARIO, huecos antihorario
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · prepararRecintos normaliza la orientación (O1)', () => {
  // Las CUATRO combinaciones de sentido de partida, generadas (no listadas) y
  // etiquetadas por el propio `orientacion()`, para que el nombre del caso no
  // pueda mentir sobre lo que contiene. La expectativa tampoco se escribe: se
  // deriva de ORIENTACION_ESPERADA.
  const sentido = (a) => (orientacion(a) === -1 ? 'CW' : 'CCW')
  const escenarios = [CUADRADO, invertirAnillo(CUADRADO)].flatMap((ext) =>
    [HUECO_CENTRAL, invertirAnillo(HUECO_CENTRAL)].map((hueco) => ({
      nombre: `exterior ${sentido(ext)} + hueco ${sentido(hueco)}`,
      anillos: [ext, hueco],
    })),
  )

  it('los cuatro escenarios cubren de verdad las dos orientaciones', () => {
    expect([...new Set(escenarios.map((e) => e.nombre))]).toHaveLength(4)
  })

  it.each(escenarios)('$nombre → exterior horario y hueco antihorario', ({ anillos }) => {
    const r = prepararRecintos(recintosDe(...anillos))
    for (const recinto of r.recintos) {
      expect(orientacion(recinto.vertices), recinto.tipo).toBe(ORIENTACION_ESPERADA[recinto.tipo])
    }
    // …y el oráculo externo dice lo mismo sobre los anillos ya cerrados.
    expect(booleanClockwise(cerrarAnillo(r.recintos[0].vertices))).toBe(true)
    expect(booleanClockwise(cerrarAnillo(r.recintos[1].vertices))).toBe(false)
  })

  it.each(escenarios)('$nombre → una detección INFO por cada inversión, y solo por esas', ({ anillos }) => {
    const r = prepararRecintos(recintosDe(...anillos))
    const normalizaciones = soloTipo(r.detecciones, TIPO_GML.ORIENTACION_NORMALIZADA)
    expect(normalizaciones).toHaveLength(r.invertidos.filter(Boolean).length)
    expect(normalizaciones.map((d) => d.datos.recinto)).toEqual(
      r.invertidos.flatMap((inv, i) => (inv ? [i] : [])),
    )
    for (const d of normalizaciones) {
      expect(d.severidad).toBe(SEVERIDAD.INFO)
      expect(d.datos.orientacionDespues).toBe(ORIENTACION_ESPERADA[d.datos.tipo])
      expect(d.datos.orientacionAntes).toBe(-d.datos.orientacionDespues)
    }
  })

  it('al invertir NO se mueve el primer vértice del posList', () => {
    // Premisa explícita: este anillo va al revés de lo que quiere el Catastro.
    expect(orientacion(CUADRADO)).not.toBe(ORIENTACION_ESPERADA.EXTERIOR)
    const r = prepararRecintos(recintosDe(CUADRADO))
    expect(r.invertidos).toEqual([true])
    expect(r.recintos[0].vertices[0]).toEqual(CUADRADO[0])
    expect(r.recintos[0].vertices).toEqual(invertirAnillo(CUADRADO))
  })

  it('REGLA 11: el areaValue sale de las coordenadas REDONDEADAS, no del modelo', () => {
    // Parcela construida a propósito para que las dos lecturas den enteros
    // DISTINTOS: 100,004 m de lado. Al redondear a 2 decimales cada lado pierde
    // 4 mm, y la superficie cae 0,80 m² — justo lo bastante para cruzar el
    // entero. Si alguien midiera el área sobre el modelo sin redondear, el
    // `cp:areaValue` publicado sería 10001 y las coordenadas del posList
    // describirían 10000: exactamente la incoherencia que rechaza el IVG.
    const LADO = 100.004
    const GRANDE = [
      [0, 0],
      [LADO, 0],
      [LADO, LADO],
      [0, LADO],
    ].map(utm)
    const r = prepararRecintos(recintosDe(GRANDE))

    expect(Math.round(r.superficieModelo)).toBe(10001)
    expect(Math.round(r.superficieRedondeada)).toBe(10000)
    expect(Math.round(r.superficieModelo)).not.toBe(Math.round(r.superficieRedondeada))

    expect(r.areaValue).toBe(Math.round(r.superficieRedondeada))
    expect(r.areaValue).toBe(10000)
    // Recalculado desde cero sobre lo que se va a escribir: tiene que cuadrar.
    expect(r.areaValue).toBe(Math.round(superficie(r.recintos)))
    expect(r.recintos[0].vertices.flat().every((v) => v === redondearCoord(v))).toBe(true)
  })

  it('la superficie NETA descuenta los huecos y el areaValue es entero (O6)', () => {
    const r = prepararRecintos(recintosDe(CUADRADO, HUECO_CENTRAL))
    expect(r.superficieRedondeada).toBeCloseTo(10 * 10 - 4 * 4, 9)
    expect(r.areaValue).toBe(84)
    expect(Number.isInteger(r.areaValue)).toBe(true)
  })

  it('el orden 2-antes-que-3 es INOCUO gracias al pivote (y por eso es gratis)', () => {
    // La cabecera afirma que invertir con el pivote intacto deja `|área|`
    // BIT-IDÉNTICA. Si eso deja de ser cierto, el orden de los pasos pasa a
    // importar de verdad y este test cae antes que el round-trip.
    const conHueco = recintosDe(CUADRADO, HUECO_CENTRAL)
    const r = prepararRecintos(conHueco)
    expect(r.invertidos.some(Boolean), 'el escenario debe invertir algo').toBe(true)
    const soloRedondeados = conHueco.map((rec) => ({
      vertices: redondearAnillo(rec.vertices),
      tipo: rec.tipo,
    }))
    expect(Object.is(r.superficieRedondeada, superficie(soloRedondeados))).toBe(true)
  })

  it('el signo se mide sobre el anillo YA REDONDEADO, no sobre el modelo crudo', () => {
    // Mismo anillo, con un ruido de décimas de milímetro que el redondeo borra:
    // la orientación reportada tiene que ser la de lo que se PUBLICA.
    const conRuido = CUADRADO.map(([x, y]) => [x + 0.0004, y - 0.0004])
    const limpio = prepararRecintos(recintosDe(CUADRADO))
    const r = prepararRecintos(recintosDe(conRuido))
    expect(r.recintos[0].vertices).toEqual(limpio.recintos[0].vertices)
    expect(r.orientacionOriginal).toEqual(limpio.orientacionOriginal)
    expect(r.invertidos).toEqual(limpio.invertidos)
    expect(r.areaValue).toBe(limpio.areaValue)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · COLAPSO_POR_REDONDEO — el punto ciego que F02 no puede ver
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · COLAPSO_POR_REDONDEO', () => {
  // Cuadrado con un vértice de más a 4 mm del anterior: legal para F02
  // (duplicadoMetros = 1 mm) y MORTAL al pasar a 2 decimales.
  const CUATRO_MM = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
    [10.004, 0],
  ].map(utm)

  it('F02 no lo ve — y esa es toda la razón de que esta regla viva aquí', () => {
    const hallazgos = reglasGeometria(recintosDe(CUATRO_MM))
    const errores = hallazgos.filter((h) => h.nivel === NIVEL.ERROR)
    expect(errores, 'F02 no debería encontrar NINGÚN error: 4 mm > 1 mm').toEqual([])
    // La distancia es real y está por encima del umbral de duplicado de F02…
    const d = Math.hypot(CUATRO_MM[4][0] - CUATRO_MM[3][0], CUATRO_MM[4][1] - CUATRO_MM[3][1])
    expect(d).toBeCloseTo(0.004, 9)
    expect(d).toBeGreaterThan(0.001) // duplicadoMetros de config/operativos.json
    // …y aun así los dos vértices son el MISMO punto en el fichero.
    expect(redondearAnillo(CUATRO_MM)[4]).toEqual(redondearAnillo(CUATRO_MM)[3])
  })

  it('lo detecta, nombra los dos vértices y mide la separación en el modelo', () => {
    const r = prepararRecintos(recintosDe(CUATRO_MM))
    const colapsos = soloTipo(r.detecciones, TIPO_GML.COLAPSO_POR_REDONDEO)
    expect(colapsos).toHaveLength(1)
    const [d] = colapsos
    expect(d.datos.vertices).toEqual([3, 4])
    expect(d.datos.recinto).toBe(0)
    expect(d.datos.tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(d.datos.separacionMetros).toBe(
      Math.hypot(CUATRO_MM[4][0] - CUATRO_MM[3][0], CUATRO_MM[4][1] - CUATRO_MM[3][1]),
    )
    expect(d.datos.separacionMetros).toBeCloseTo(0.004, 9)
    expect(d.datos.despues).toEqual(redondearAnillo(CUATRO_MM)[3])
    expect(d.mensaje).toMatch(/4[.,]0 mm/)
  })

  it('AVISO mientras el anillo cerrado siga teniendo 4 posiciones o más', () => {
    const r = prepararRecintos(recintosDe(CUATRO_MM))
    const [d] = soloTipo(r.detecciones, TIPO_GML.COLAPSO_POR_REDONDEO)
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos.posicionesAlCerrar).toBe(5) // 4 vértices distintos + el cierre
    expect(d.datos.posicionesAlCerrar).toBeGreaterThanOrEqual(4)
  })

  it('ERROR cuando el colapso deja el anillo cerrado por debajo de 4 posiciones', () => {
    // Triángulo cuyo tercer vértice está a ~4 mm del primero: al redondear se
    // funden y lo que queda no llega a ser un gml:LinearRing.
    const TRIANGULO = [
      [0, 0],
      [10, 0],
      [0.004, 0.001],
    ].map(utm)
    const r = prepararRecintos(recintosDe(TRIANGULO))
    const colapsos = soloTipo(r.detecciones, TIPO_GML.COLAPSO_POR_REDONDEO)
    expect(colapsos).toHaveLength(1)
    expect(colapsos[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(colapsos[0].datos.vertices).toEqual([2, 0]) // el par de CIERRE del ciclo
    expect(colapsos[0].datos.posicionesAlCerrar).toBe(3)
    expect(colapsos[0].mensaje).toMatch(/LinearRing/)
  })

  it('NO reclama los duplicados que ya venían duplicados: esos son de F02', () => {
    const YA_DUPLICADO = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 10],
      [10, 0],
    ].map(utm)
    const r = prepararRecintos(recintosDe(YA_DUPLICADO))
    expect(soloTipo(r.detecciones, TIPO_GML.COLAPSO_POR_REDONDEO)).toEqual([])
    // Y se comprueba que el reparto es real: F02 sí lo denuncia como ERROR.
    const errores = reglasGeometria(recintosDe(YA_DUPLICADO)).filter((h) => h.nivel === NIVEL.ERROR)
    expect(errores.length).toBeGreaterThan(0)
  })

  it('el anillo real del Catastro no colapsa (control negativo)', () => {
    expect(tiposDe(prepararRecintos(RECINTOS_REALES).detecciones)).not.toContain(
      TIPO_GML.COLAPSO_POR_REDONDEO,
    )
  })

  it('detecta el colapso también dentro de un HUECO, con su índice', () => {
    const huecoRoto = [...HUECO_CENTRAL, [HUECO_CENTRAL[0][0] + 0.004, HUECO_CENTRAL[0][1]]]
    const r = prepararRecintos(recintosDe(CUADRADO, huecoRoto))
    const [d] = soloTipo(r.detecciones, TIPO_GML.COLAPSO_POR_REDONDEO)
    expect(d.datos.recinto).toBe(1)
    expect(d.datos.tipo).toBe(TIPO_RECINTO.HUECO)
    expect(d.mensaje).toMatch(/hueco nº 1/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · puntoInterior — pointOnFeature NO basta
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · puntoInterior — por qué hace falta la cascada', () => {
  it('DEMOSTRACIÓN: en la parcela en L, pointOnFeature se queda en el BORDE', () => {
    const pol = poligonoDe(EN_L)
    const deTurf = pointOnFeature(pol).geometry.coordinates
    // Turf devuelve el centro del bbox si cae dentro; aquí cae fuera (es una L),
    // así que devuelve el VÉRTICE más próximo, que está sobre la línea.
    expect(EN_L.some((v) => v[0] === deTurf[0] && v[1] === deTurf[1])).toBe(true)
    expect(booleanPointInPolygon(deTurf, pol, { ignoreBoundary: true })).toBe(false)
    expect(booleanPointInPolygon(deTurf, pol)).toBe(true) // está justo EN el borde
  })

  it('DEMOSTRACIÓN: con un hueco céntrico, pointOnFeature también falla', () => {
    const pol = poligonoDe(CUADRADO, HUECO_CENTRAL)
    const deTurf = pointOnFeature(pol).geometry.coordinates
    expect(booleanPointInPolygon(deTurf, pol, { ignoreBoundary: true })).toBe(false)
  })

  it('parcela en L → barrido propio, y el punto cae DENTRO (ignoreBoundary)', () => {
    const r = puntoInterior(recintosDe(EN_L))
    expect(r.origen).toBe(ORIGEN_PUNTO.BARRIDO_PROPIO)
    expect(booleanPointInPolygon(r.punto, poligonoDe(EN_L), { ignoreBoundary: true })).toBe(true)
    expect(r.punto).toEqual(redondearAnillo([r.punto])[0]) // ya viene redondeado
    const [d] = soloTipo(r.detecciones, TIPO_GML.PUNTO_REFERENCIA_RECALCULADO)
    expect(d.severidad).toBe(SEVERIDAD.INFO)
  })

  it('parcela con hueco → barrido propio, y el punto no cae en el hueco', () => {
    const recintos = recintosDe(CUADRADO, HUECO_CENTRAL)
    const r = puntoInterior(recintos)
    expect(r.origen).toBe(ORIGEN_PUNTO.BARRIDO_PROPIO)
    expect(booleanPointInPolygon(r.punto, poligonoDe(CUADRADO, HUECO_CENTRAL), {
      ignoreBoundary: true,
    })).toBe(true)
    // Explícitamente fuera del hueco (que es el fallo que se está evitando).
    expect(booleanPointInPolygon(r.punto, poligonoDe(HUECO_CENTRAL))).toBe(false)
  })

  it('la orientación de los anillos le da igual (el punto es el mismo)', () => {
    const directo = puntoInterior(recintosDe(CUADRADO, HUECO_CENTRAL))
    const alReves = puntoInterior(
      recintosDe(invertirAnillo(CUADRADO), invertirAnillo(HUECO_CENTRAL)),
    )
    expect(alReves.punto).toEqual(directo.punto)
  })

  it('parcela convexa → basta pointOnFeature, sin detecciones', () => {
    const r = puntoInterior(recintosDe(CUADRADO))
    expect(r.origen).toBe(ORIGEN_PUNTO.POINT_ON_FEATURE)
    expect(r.detecciones).toEqual([])
    expect(booleanPointInPolygon(r.punto, poligonoDe(CUADRADO), { ignoreBoundary: true })).toBe(true)
  })

  it('el referencePoint REAL del Catastro se verifica y se acepta tal cual', () => {
    const r = puntoInterior(RECINTOS_REALES, { aportado: ring.referencePoint })
    expect(r.origen).toBe(ORIGEN_PUNTO.APORTADO)
    expect(r.punto).toEqual(ring.referencePoint)
    expect(r.detecciones).toEqual([])
  })

  it('y sin aportar nada, la parcela real también obtiene un punto interior', () => {
    const r = puntoInterior(RECINTOS_REALES)
    expect(r.punto).not.toBeNull()
    expect(booleanPointInPolygon(r.punto, poligonoDe(EXTERIOR), { ignoreBoundary: true })).toBe(true)
  })

  it('un punto aportado que cae FUERA se descarta con AVISO y se recalcula', () => {
    const fuera = [X0 - 5, Y0 - 5]
    const r = puntoInterior(recintosDe(CUADRADO), { aportado: fuera })
    expect(r.origen).not.toBe(ORIGEN_PUNTO.APORTADO)
    expect(booleanPointInPolygon(r.punto, poligonoDe(CUADRADO), { ignoreBoundary: true })).toBe(true)
    const [d] = soloTipo(r.detecciones, TIPO_GML.PUNTO_REFERENCIA_RECALCULADO)
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos.descartado).toEqual(fuera)
  })

  it('la verificación corre DESPUÉS de redondear: 3 mm dentro puede ser fuera', () => {
    // Este punto está estrictamente dentro… hasta que pasa a 2 decimales y
    // aterriza EN el borde. Verificar antes del redondeo sería verificar otra cosa.
    const pol = poligonoDe(CUADRADO)
    const casiDentro = [X0 + 0.003, Y0 + 5]
    expect(booleanPointInPolygon(casiDentro, pol, { ignoreBoundary: true })).toBe(true)
    expect(booleanPointInPolygon(redondearAnillo([casiDentro])[0], pol, { ignoreBoundary: true }))
      .toBe(false)

    const r = puntoInterior(recintosDe(CUADRADO), { aportado: casiDentro })
    expect(r.origen).not.toBe(ORIGEN_PUNTO.APORTADO)
    expect(tiposDe(r.detecciones)).toContain(TIPO_GML.PUNTO_REFERENCIA_RECALCULADO)
    expect(booleanPointInPolygon(r.punto, pol, { ignoreBoundary: true })).toBe(true)
  })

  it('geometría degenerada → punto null y detección de severidad ERROR', () => {
    const casos = [
      { nombre: 'anillo de 2 vértices', anillos: [[utm([0, 0]), utm([10, 0])]] },
      {
        nombre: 'tres vértices colineales (área nula)',
        anillos: [[utm([0, 0]), utm([5, 0]), utm([10, 0])]],
      },
    ]
    for (const { nombre, anillos } of casos) {
      const r = puntoInterior(recintosDe(...anillos))
      expect(r.punto, nombre).toBeNull()
      expect(r.origen, nombre).toBeNull()
      const errores = r.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR)
      expect(errores.map((d) => d.tipo), nombre).toEqual([TIPO_GML.PUNTO_REFERENCIA_RECALCULADO])
    }
  })

  it('no toca la entrada y valida el contrato estructural', () => {
    const recintos = recintosDe(CUADRADO, HUECO_CENTRAL)
    const antes = structuredClone(recintos)
    puntoInterior(recintos)
    expect(recintos).toEqual(antes)
    expect(() => puntoInterior([])).toThrow(TypeError)
    expect(() => puntoInterior(recintosDe(CUADRADO), { aportado: [1] })).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Contrato estructural de prepararRecintos
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · contrato estructural (lanza solo por bug del programador)', () => {
  it('recintos vacío, no-array o mal tipado → TypeError', () => {
    expect(() => prepararRecintos([])).toThrow(TypeError)
    expect(() => prepararRecintos(null)).toThrow(TypeError)
    expect(() => prepararRecintos([{ vertices: CUADRADO, tipo: TIPO_RECINTO.HUECO }])).toThrow(
      TypeError,
    )
    expect(() =>
      prepararRecintos([
        { vertices: CUADRADO, tipo: TIPO_RECINTO.EXTERIOR },
        { vertices: HUECO_CENTRAL, tipo: TIPO_RECINTO.EXTERIOR },
      ]),
    ).toThrow(TypeError)
    expect(() => prepararRecintos([{ vertices: 'x', tipo: TIPO_RECINTO.EXTERIOR }])).toThrow(
      TypeError,
    )
  })

  it('una coordenada impublicable no se escribe: RangeError antes del fichero', () => {
    const absurdo = [utm([0, 0]), utm([10, 0]), [1e21, 4479000]]
    expect(() => prepararRecintos(recintosDe(absurdo))).toThrow(RangeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Guardas del módulo
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/anillos · guardas', () => {
  const RAIZ = join(import.meta.dirname, '..', '..')
  const FUENTE = readFileSync(join(RAIZ, 'gml', 'anillos.js'), 'utf8')

  it('no lee el reloj del sistema: el GML generado es función pura de su entrada', () => {
    // Mismo criterio que `gml/_comun.js`: se comprueba sobre el TEXTO, así que
    // las llamadas no deben aparecer ni siquiera dentro de un comentario.
    expect(/\bnew\s+Date\b/.test(FUENTE), 'gml/anillos.js instancia una fecha propia').toBe(false)
    expect(/\bDate\s*\.\s*now\b/.test(FUENTE), 'gml/anillos.js consulta el reloj').toBe(false)
    // El detector no es vacuo: dispara sobre un texto que sí las lleva.
    expect(/\bnew\s+Date\b/.test('const x = new Date()')).toBe(true)
  })

  it('el signo lo da geo/area.js: @turf/boolean-clockwise NO entra en producción', () => {
    // Es devDependency y su sitio es este fichero de test, como oráculo externo.
    const IMPORTA = /(?:^|\n)[ \t]*import[^\n]*['"]@turf\/boolean-clockwise['"]/
    expect(IMPORTA.test(FUENTE), 'gml/anillos.js importa el oráculo de test').toBe(false)
    expect(IMPORTA.test(readFileSync(import.meta.filename, 'utf8'))).toBe(true)
    expect(/from '\.\.\/geo\/area\.js'/.test(FUENTE)).toBe(true)
  })

  it('solo redondea con toFixed: la fórmula prohibida no está en el CÓDIGO', () => {
    const PROHIBIDA = /Math\s*\.\s*round\s*\([^\n)]*\*\s*100/
    // La cabecera SÍ la escribe (para explicar por qué está prohibida), así que
    // un grep sobre el texto entero daría falso positivo: se filtran antes las
    // líneas de comentario, y se comprueba que el filtro no es vacuo.
    expect(PROHIBIDA.test(FUENTE), 'la cabecera debe seguir explicando la fórmula prohibida').toBe(
      true,
    )
    const codigo = FUENTE.split('\n').filter((l) => !/^\s*(?:\/\/|\/\*|\*)/.test(l))
    expect(codigo.filter((l) => PROHIBIDA.test(l))).toEqual([])
    expect(codigo.some((l) => /toFixed\(DECIMALES_COORD\)/.test(l))).toBe(true)
  })

  it('ORIENTACION_ESPERADA no diverge de model/parcela.js#TIPO_RECINTO', () => {
    // Duplicado deliberado (gml/ no importa el modelo, ver cabecera): el guarda
    // deriva las dos listas y las compara, sin escribirlas a mano.
    expect(Object.keys(ORIENTACION_ESPERADA).sort()).toEqual(Object.values(TIPO_RECINTO).sort())
    expect(Object.isFrozen(ORIENTACION_ESPERADA)).toBe(true)
    expect(Object.isFrozen(ORIGEN_PUNTO)).toBe(true)
  })

  it('ORIENTACION_ESPERADA.EXTERIOR = −1 está atado al GML REAL (override O1)', () => {
    expect(ORIENTACION_ESPERADA.EXTERIOR).toBe(ring._verificado.orientacion)
    expect(ORIENTACION_ESPERADA.EXTERIOR).toBe(orientacion(EXTERIOR))
    expect(ORIENTACION_ESPERADA.HUECO).toBe(-ORIENTACION_ESPERADA.EXTERIOR)
  })

  it('todas las detecciones que emite son tipos válidos de TIPO_GML', () => {
    const emitidas = [
      ...prepararRecintos(recintosDe(invertirAnillo(CUADRADO))).detecciones,
      ...prepararRecintos(recintosDe([...CUADRADO, [CUADRADO[3][0] + 0.004, CUADRADO[3][1]]]))
        .detecciones,
      ...puntoInterior(recintosDe(EN_L)).detecciones,
      ...puntoInterior(recintosDe(CUADRADO), { aportado: [0, 0] }).detecciones,
      ...puntoInterior(recintosDe([utm([0, 0]), utm([10, 0])])).detecciones,
    ]
    expect(emitidas.length).toBeGreaterThan(0)
    for (const d of emitidas) {
      expect(Object.values(TIPO_GML)).toContain(d.tipo)
      expect(Object.values(SEVERIDAD)).toContain(d.severidad)
      expect(d.mensaje.length).toBeGreaterThan(0)
    }
    // Y el módulo solo usa las tres que le tocan de todo el catálogo.
    expect([...new Set(emitidas.map((d) => d.tipo))].sort()).toEqual(
      [
        TIPO_GML.COLAPSO_POR_REDONDEO,
        TIPO_GML.ORIENTACION_NORMALIZADA,
        TIPO_GML.PUNTO_REFERENCIA_RECALCULADO,
      ].sort(),
    )
  })
})

// ── Guardián de la PROSA de los mensajes ─────────────────────────────────────
//
// Estos mensajes los lee una persona en el panel de avisos: son la superficie
// donde vive la regla de oro 1. Se componen por interpolación —`de ${nombre}`,
// `${n} tiene`— y ese es justo el patrón que produce castellano roto sin que
// nada avise: la suite entera pasaba en verde con «se ha invertido el sentido
// DE EL contorno exterior», y así se quedó hasta que apareció leyendo el panel
// en el guion de humo del navegador. Ninguna prueba miraba el texto compuesto.
//
// El guardián NO comprueba los tres mensajes de hoy: comprueba la CLASE de
// error sobre todos los que el módulo sepa producir. Un mensaje nuevo con la
// misma errata cae solo, sin que nadie se acuerde de venir aquí.
describe('gml/anillos · los mensajes están escritos en castellano correcto', () => {
  /**
   * Todos los mensajes que este módulo sabe emitir, RECOGIDOS ejecutándolo (no
   * copiados): un recinto que se invierte, uno que colapsa al redondear, y uno
   * degenerado que impide calcular el punto de referencia. Se cubren el
   * exterior y un hueco, porque `nombreRecinto` ramifica por índice y la
   * contracción solo falla en una de las dos ramas.
   */
  const MENSAJES = (() => {
    const recogidos = []
    const anota = (dets) => recogidos.push(...dets.map((d) => d.mensaje))

    // `CUADRADO` es antihorario y el exterior tiene que quedar HORARIO; el hueco
    // invertido queda horario y tiene que quedar ANTIHORARIO. Se invierten los
    // DOS a propósito, para recorrer las dos ramas de `nombreRecinto`: las dos
    // devuelven texto que empieza por «el» («el contorno exterior», «el hueco
    // nº N»), así que la contracción falla en las dos — comprobado mutando la
    // corrección, que hace caer este guardián con los tres mensajes nombrados.
    anota(prepararRecintos(recintosDe(CUADRADO, [...HUECO_CENTRAL].reverse())).detecciones)

    // Colapso por redondeo: dos vértices a 4 mm, que F02 da por buenos y el
    // redondeo funde. Exterior y hueco, por el mismo motivo de arriba.
    const conColapso = (anillo) => [
      anillo[0],
      [anillo[0][0] + 0.004, anillo[0][1]],
      ...anillo.slice(1),
    ]
    anota(
      prepararRecintos(recintosDe(conColapso(CUADRADO), conColapso(HUECO_CENTRAL))).detecciones,
    )

    // Recinto degenerado ⇒ no hay punto de referencia posible.
    anota(puntoInterior(recintosDe(CUADRADO.slice(0, 2))).detecciones)

    return recogidos
  })()

  it('el recorrido NO es vacuo: hay mensajes de los tres tipos que se pueden emitir', () => {
    // Sin esto, un cambio que dejara de emitir detecciones convertiría todas
    // las comprobaciones de abajo en bucles vacíos pasando en verde.
    expect(MENSAJES.length).toBeGreaterThanOrEqual(4)
    for (const m of MENSAJES) expect(typeof m).toBe('string')
  })

  it.each([
    ['«de el» en vez de «del»', /\bde el\b/i],
    ['«a el» en vez de «al»', /\ba el\b/i],
  ])('ningún mensaje lleva %s', (_caso, patron) => {
    const infractores = MENSAJES.filter((m) => patron.test(m))
    expect(infractores, `mensajes con la contracción sin hacer: ${infractores.join(' | ')}`).toEqual(
      [],
    )
  })

  it('el detector de la contracción NO es vacuo (dispara sobre un texto de control)', () => {
    // Si el patrón dejara de casar, las dos pruebas de arriba pasarían siempre.
    expect(/\bde el\b/i.test('se ha invertido el sentido de el contorno exterior')).toBe(true)
    expect(/\bde el\b/i.test('se ha invertido el sentido del contorno exterior')).toBe(false)
  })

  it('todos empiezan por mayúscula y terminan en punto', () => {
    for (const m of MENSAJES) {
      expect(m[0], `no empieza por mayúscula: «${m}»`).toBe(m[0].toUpperCase())
      expect(m.endsWith('.'), `no termina en punto: «${m}»`).toBe(true)
    }
  })
})
