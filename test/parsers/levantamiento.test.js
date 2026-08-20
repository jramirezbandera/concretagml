// test/parsers/levantamiento.test.js — F18 · el orden en que se unen los puntos.
//
// Proyecto `node`: el módulo es PURO (no toca DOM, ni red, ni Leaflet).
//
// Lo que se blinda aquí, y por qué importa cada cosa:
//   · que la NUMERACIÓN gana al orden del fichero, porque es la que da el linde
//     que el técnico caminó;
//   · que la capa de COTAS no se confunda con la de números — ordenar el linde
//     por altura es un contorno absurdo y absolutamente silencioso;
//   · que la procedencia del orden VIAJE con la propuesta: quien la enseñe tiene
//     que poder decir si va por número o por orden de volcado.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseDXF } from '../../parsers/dxf.js'
import {
  MINIMO_VERTICES,
  ORDEN,
  SIN_PROPUESTA,
  propuestaDePuntos,
} from '../../parsers/levantamiento.js'

const fixture = (n) => join(process.cwd(), 'test', 'fixtures', 'parsers', n)

// ── Datos ────────────────────────────────────────────────────────────────────

/** Cuatro puntos en una capa, volcados DESORDENADOS respecto a su número. */
const CUATRO = [
  { capa: 'P', x: 440000, y: 4480000 },
  { capa: 'P', x: 440010, y: 4480010 },
  { capa: 'P', x: 440010, y: 4480000 },
  { capa: 'P', x: 440000, y: 4480010 },
]

/** Sus números: el orden bueno es 1→3→2→4 de la lista de arriba. */
const NUMEROS = [
  { capa: 'N', texto: '1' },
  { capa: 'N', texto: '3' },
  { capa: 'N', texto: '2' },
  { capa: 'N', texto: '4' },
]

describe('parsers/levantamiento · la numeración manda', () => {
  it('⭐ ordena los puntos por su número, no por el orden del fichero', () => {
    const p = propuestaDePuntos({ puntos: CUATRO, rotulos: NUMEROS })
    expect(p.orden).toBe(ORDEN.NUMERACION)
    expect(p.capaNumeros).toBe('N')
    expect(p.numeros).toEqual([1, 2, 3, 4])
    // 1 → 2 (el TERCERO del fichero) → 3 (el segundo) → 4.
    expect(p.anillo).toEqual([
      [440000, 4480000],
      [440010, 4480000],
      [440010, 4480010],
      [440000, 4480010],
    ])
  })

  it('⛔ la capa de COTAS no se confunde con la de números', () => {
    // Las dos son numéricas y las dos casan 1:1 con los puntos. Aceptar decimales
    // ordenaría el linde por ALTURA: un contorno absurdo, y en silencio.
    const cotas = [
      { capa: 'COTAS', texto: '404.301' },
      { capa: 'COTAS', texto: '404.212' },
      { capa: 'COTAS', texto: '404.173' },
      { capa: 'COTAS', texto: '404.500' },
    ]
    const p = propuestaDePuntos({ puntos: CUATRO, rotulos: cotas })
    expect(p.orden).toBe(ORDEN.FICHERO)
    expect(p.capaNumeros).toBeNull()
    expect(p.numeros).toBeNull()
    // Y el anillo es el orden del fichero, tal cual.
    expect(p.anillo).toEqual(CUATRO.map((q) => [q.x, q.y]))
  })

  it('⛔ números REPETIDOS no dan un orden: se declina al del fichero', () => {
    // Dos puntos con el 7 dan dos órdenes distintos, y cuál sale depende de cómo
    // esté implementada la ordenación. Eso es un resultado arbitrario.
    const repes = [
      { capa: 'N', texto: '1' },
      { capa: 'N', texto: '7' },
      { capa: 'N', texto: '7' },
      { capa: 'N', texto: '4' },
    ]
    const p = propuestaDePuntos({ puntos: CUATRO, rotulos: repes })
    expect(p.orden).toBe(ORDEN.FICHERO)
    expect(p.anillo).toEqual(CUATRO.map((q) => [q.x, q.y]))
  })

  it('una capa de rótulos que NO casa 1:1 en recuento no sirve de numeración', () => {
    // El hallazgo que hace utilizable la numeración es justamente el 1:1 por
    // orden. Sin él no hay a qué punto pertenece cada número.
    const tres = NUMEROS.slice(0, 3)
    const p = propuestaDePuntos({ puntos: CUATRO, rotulos: tres })
    expect(p.orden).toBe(ORDEN.FICHERO)
    expect(p.capaNumeros).toBeNull()
  })

  it('los números viajan YA EN EL ORDEN del anillo, para poder decir «del 1 al N»', () => {
    const p = propuestaDePuntos({ puntos: CUATRO, rotulos: NUMEROS })
    expect(p.numeros).toEqual([...p.numeros].sort((a, b) => a - b))
    expect(p.numeros).toHaveLength(p.anillo.length)
  })
})

describe('parsers/levantamiento · la capa de puntos', () => {
  it('⛔ elige UNA capa: el software escribe cada punto dos veces (2D y 3D)', () => {
    // Unir «todos los puntos» daría cada vértice repetido y el doble de lados.
    const dobles = [
      ...CUATRO,
      ...CUATRO.map((p) => ({ ...p, capa: 'P3D', z: 404 })),
      { capa: 'P3D', x: 440020, y: 4480020, z: 404 },
    ]
    const p = propuestaDePuntos({ puntos: dobles, rotulos: [] })
    // Gana la más poblada, que aquí es la 3D (cinco contra cuatro).
    expect(p.capa).toBe('P3D')
    expect(p.anillo).toHaveLength(5)
    expect(p.capasCandidatas).toEqual([
      { capa: 'P3D', puntos: 5 },
      { capa: 'P', puntos: 4 },
    ])
  })

  it('se puede FORZAR la capa, que es lo que contesta el usuario', () => {
    const dobles = [...CUATRO, ...CUATRO.map((q) => ({ ...q, capa: 'P3D' }))]
    const p = propuestaDePuntos({ puntos: dobles, rotulos: [], capa: 'P' })
    expect(p.capa).toBe('P')
    expect(p.anillo).toHaveLength(4)
  })

  it('⛔ una capa pedida que no existe NO se corrige a otra en silencio', () => {
    const p = propuestaDePuntos({ puntos: CUATRO, rotulos: [], capa: 'NO_ESTA' })
    expect(p.anillo).toBeNull()
    expect(p.motivo).toBe(SIN_PROPUESTA.SIN_PUNTOS)
    expect(p.capa).toBe('NO_ESTA')
    // Y se dice cuáles SÍ hay —con su recuento—, para poder volver a preguntar
    // sin reparsear y sin enseñar un nombre de capa a secas.
    expect(p.capasCandidatas).toEqual([{ capa: 'P', puntos: 4 }])
  })
})

describe('parsers/levantamiento · lo que no llega a ser un anillo', () => {
  it('sin puntos no hay propuesta, y lo dice', () => {
    const p = propuestaDePuntos({ puntos: [], rotulos: [] })
    expect(p.anillo).toBeNull()
    expect(p.motivo).toBe(SIN_PROPUESTA.SIN_PUNTOS)
  })

  it(`con menos de ${MINIMO_VERTICES} vértices tampoco, y con OTRO motivo`, () => {
    // Los dos casos se distinguen porque se cuentan distinto al usuario: «este
    // fichero no trae puntos» no es «trae dos, y con dos no hay recinto».
    const p = propuestaDePuntos({ puntos: CUATRO.slice(0, 2), rotulos: [] })
    expect(p.anillo).toBeNull()
    expect(p.motivo).toBe(SIN_PROPUESTA.POCOS_PUNTOS)
  })

  it('los puntos sin coordenada finita no cuentan', () => {
    const rotos = [...CUATRO, { capa: 'P', x: Number.NaN, y: 4480000 }, { capa: 'P' }]
    const p = propuestaDePuntos({ puntos: rotos, rotulos: [] })
    expect(p.anillo).toHaveLength(4)
  })

  it('⛔ el vértice de CIERRE repetido se quita: el modelo guarda anillos ABIERTOS', () => {
    // Muchos aparatos vuelcan el primer punto otra vez al final. Dejarlo daría un
    // lado de longitud cero y un vértice duplicado en la tabla de coordenadas.
    const conCierre = [...CUATRO, { capa: 'P', x: 440000, y: 4480000 }]
    const p = propuestaDePuntos({ puntos: conCierre, rotulos: [] })
    expect(p.anillo).toHaveLength(4)
    expect(p.descartados).toBe(1)
  })

  it('los repetidos CONSECUTIVOS se descartan y se CUENTAN', () => {
    const dobles = [CUATRO[0], CUATRO[0], CUATRO[1], CUATRO[2], CUATRO[3]]
    const p = propuestaDePuntos({ puntos: dobles, rotulos: [] })
    expect(p.anillo).toHaveLength(4)
    expect(p.descartados).toBe(1)
  })

  it('no muta la entrada ni comparte sus arrays', () => {
    const puntos = CUATRO.map((p) => ({ ...p }))
    const copia = JSON.parse(JSON.stringify(puntos))
    const p = propuestaDePuntos({ puntos, rotulos: NUMEROS })
    expect(puntos).toEqual(copia)
    p.anillo[0][0] = 0
    expect(puntos[0].x).toBe(440000)
  })

  it('exige arrays: adivinar aquí sería decir «no hay propuesta» sobre un fichero que sí la tiene', () => {
    expect(() => propuestaDePuntos({ puntos: 'x' })).toThrow(TypeError)
    expect(() => propuestaDePuntos({ puntos: [], rotulos: 'x' })).toThrow(TypeError)
    expect(() => propuestaDePuntos({ puntos: [], rotulos: [], capa: 7 })).toThrow(TypeError)
    // Sin argumentos NO lanza: es «no me has dado nada», no un contrato roto.
    expect(() => propuestaDePuntos()).not.toThrow()
  })
})

// ── Sobre el fichero de verdad ───────────────────────────────────────────────

describe('parsers/levantamiento · sobre el levantamiento real', () => {
  const r = parseDXF(readFileSync(fixture('puntos_levantamiento.dxf'), 'latin1'))

  it('⭐ el DXF que salía VACÍO ya propone su recinto, y por NUMERACIÓN', () => {
    // El caso entero de esta fase, de punta a punta: `anillos: []` y aun así hay
    // un contorno que ofrecer.
    expect(r.anillos).toEqual([])
    const p = propuestaDePuntos({ puntos: r.puntos, rotulos: r.rotulos })
    expect(p.anillo).toHaveLength(3)
    expect(p.orden).toBe(ORDEN.NUMERACION)
    expect(p.capaNumeros).toBe('VER_NOPTO')
    expect(p.numeros).toEqual([1, 2, 3])
  })

  it('y elige UNA de las dos capas de puntos, no las dos', () => {
    const p = propuestaDePuntos({ puntos: r.puntos, rotulos: r.rotulos })
    expect(p.capasCandidatas.map((c) => c.capa)).toEqual(
      expect.arrayContaining(['VER_P2D', 'VER_P3D']),
    )
    expect(p.capasCandidatas.every((c) => c.puntos === 3)).toBe(true)
    expect(p.anillo).toHaveLength(3) // no 6
  })
})
