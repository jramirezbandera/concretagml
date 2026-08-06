/* -------------------------------------------------------------------------- *
 * test/scripts/validar-xlsx.test.js — el validador de Excel, probado sin Python *
 *                                                                              *
 * Proyecto `node`. Aquí NO se llama a openpyxl: eso es lo que hace el propio    *
 * script y lo que se corre con `--estricto`. Lo que se prueba aquí es lo OTRO,  *
 * que es justo lo que se rompe en silencio:                                    *
 *                                                                              *
 *   · que los casos que se auditan sigan cubriendo las formas que la maqueta    *
 *     sabe producir, porque un caso que se cae de la lista deja un camino sin   *
 *     auditar y el validador seguiría diciendo «✅ todos abren»;                *
 *   · que los libros que genera sean los de VERDAD (los produce                 *
 *     `export/excel-coordenadas.js`, no un fixture guardado);                   *
 *   · que el manifiesto diga lo que cada libro DEBERÍA contener, porque sin eso *
 *     la comprobación sería solo de coherencia interna — un fichero puede estar *
 *     impecablemente bien formado y decir otra cosa de la que se pidió;         *
 *   · y que «no poder medir» sea distinguible de «está bien», que es la lección *
 *     que dejó `validar-xsd.mjs` y el motivo de que exista el código 2.         *
 *                                                                              *
 * ⭐ **Que el validador NO SEA VACUO está medido, y no aquí**: al escribirlo se  *
 * le pasaron cuatro ficheros averiados a propósito —un CRC corrompido, una cola *
 * de basura tras el EOCD, una pestaña renombrada y un vértice movido— y los     *
 * cuatro salieron en rojo con su motivo, con el control intacto en verde. Eso   *
 * necesita Python, así que vive en la ficha de F20 y no en la suite.            *
 * -------------------------------------------------------------------------- */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { serializarCoordenadasExcel } from '../../export/excel-coordenadas.js'
import { CASOS, buscarPython, escribirCasos } from '../../scripts/validar-xlsx.mjs'

const directorios = []
const conDirectorio = () => {
  const d = mkdtempSync(join(tmpdir(), 'test-validar-xlsx-'))
  directorios.push(d)
  return d
}

afterEach(() => {
  while (directorios.length > 0) rmSync(directorios.pop(), { recursive: true, force: true })
})

describe('scripts/validar-xlsx.mjs · los casos que se auditan', () => {
  it('⭐ cubre las CINCO formas que la maqueta sabe producir', () => {
    // Un caso que se cae de la lista deja un camino sin auditar y el validador
    // seguiría diciendo «✅», que es peor que no tenerlo.
    expect(CASOS.map((c) => c.nombre)).toEqual([
      'una-hoja',
      'con-huecos',
      'sin-geometria',
      'con-avisos',
      'sin-datos',
    ])
  })

  it('cada caso dice QUÉ es, no solo cómo se llama', () => {
    for (const caso of CASOS) {
      expect(typeof caso.queEs, caso.nombre).toBe('string')
      expect(caso.queEs.length, caso.nombre).toBeGreaterThan(20)
    }
  })

  it('⭐ el caso sin geometría existe porque un libro SIN HOJAS no lo abre Excel', () => {
    const sinGeometria = CASOS.find((c) => c.nombre === 'sin-geometria')
    expect(sinGeometria.opciones.recintos).toEqual([])
    expect(sinGeometria.hojas).toHaveLength(1)
  })

  it('el caso con huecos audita de verdad las varias pestañas', () => {
    const conHuecos = CASOS.find((c) => c.nombre === 'con-huecos')
    expect(conHuecos.opciones.recintos.length).toBeGreaterThan(1)
    expect(conHuecos.hojas).toEqual(['Contorno exterior', 'Hueco 1', 'Hueco 2'])
  })

  it('el caso sin datos NO trae referencia catastral ni huso', () => {
    const sinDatos = CASOS.find((c) => c.nombre === 'sin-datos')
    expect(sinDatos.opciones.refcat).toBeUndefined()
    expect(sinDatos.opciones.srs).toBeUndefined()
  })

  it('las coordenadas son UTM de verdad, no de juguete', () => {
    // `redondearCoord` rechaza lo que se sale del rango publicable, así que un caso
    // con coordenadas inventadas no probaría el camino real: lanzaría antes.
    for (const caso of CASOS) {
      for (const r of caso.opciones.recintos ?? []) {
        for (const [x, y] of r.vertices) {
          expect(x, caso.nombre).toBeGreaterThan(100_000)
          expect(y, caso.nombre).toBeGreaterThan(4_000_000)
        }
      }
    }
  })
})

describe('scripts/validar-xlsx.mjs · lo que escribe', () => {
  it('escribe un fichero por caso, con bytes de verdad y firma de ZIP', () => {
    const dir = conDirectorio()
    const escritos = escribirCasos(dir)
    expect(escritos).toHaveLength(CASOS.length)
    for (const e of escritos) {
      const bytes = readFileSync(e.ruta)
      expect(bytes.length, e.nombre).toBe(e.bytes)
      expect(Array.from(bytes.subarray(0, 4)), e.nombre).toEqual([0x50, 0x4b, 0x03, 0x04])
    }
  })

  it('⭐ lo que audita es lo que el exportador produce HOY, no un fixture', () => {
    // Se regenera el mismo caso llamando al exportador a mano: si el script hubiera
    // guardado un fichero en algún sitio, los bytes no coincidirían.
    const dir = conDirectorio()
    const caso = CASOS[0]
    const [escrito] = escribirCasos(dir, [caso])
    const { bytes } = serializarCoordenadasExcel({
      ...caso.opciones,
      fecha: new Date(Date.UTC(2026, 7, 6, 12, 0, 0)),
    })
    expect(Array.from(readFileSync(escrito.ruta))).toEqual(Array.from(bytes))
  })

  it('escribir dos veces da lo mismo: ni el script ni el exportador leen el reloj', () => {
    const a = escribirCasos(conDirectorio())
    const b = escribirCasos(conDirectorio())
    for (let i = 0; i < a.length; i++) {
      expect(Array.from(readFileSync(a[i].ruta)), a[i].nombre).toEqual(
        Array.from(readFileSync(b[i].ruta)),
      )
    }
  })

  it('⭐ el manifiesto dice lo que cada libro DEBERÍA contener, no solo dónde está', () => {
    // Sin esto la comprobación sería de coherencia interna: un paquete impecable
    // puede decir algo distinto de lo que se le pidió.
    const escritos = escribirCasos(conDirectorio())
    for (const e of escritos) {
      expect(Array.isArray(e.hojas), e.nombre).toBe(true)
      expect(e.hojas.length, e.nombre).toBeGreaterThan(0)
      expect(e.nHojas, e.nombre).toBe(e.hojas.length)
      expect(typeof e.nVertices, e.nombre).toBe('number')
    }
  })

  it('el manifiesto es serializable a JSON, que es como viaja a Python', () => {
    const escritos = escribirCasos(conDirectorio())
    expect(() => JSON.stringify(escritos)).not.toThrow()
    expect(JSON.parse(JSON.stringify(escritos))).toHaveLength(CASOS.length)
  })

  it('⭐ la fila del primer vértice se CALCULA, no se fija', () => {
    // El caso con expediente lleva una fila más de cabecera. Fijar el número a mano
    // dejaría el validador comprobando la celda equivocada en cuanto la maqueta
    // moviera un renglón — y comprobando una celda vacía es como se sale verde.
    const escritos = escribirCasos(conDirectorio())
    const conNombre = escritos.find((e) => e.nombre === 'una-hoja')
    const sinNombre = escritos.find((e) => e.nombre === 'sin-datos')
    expect(conNombre.primerVertice.fila).toBe(sinNombre.primerVertice.fila + 1)
  })

  it('el caso «con-avisos» no fija primer vértice, porque el redondeo funde uno', () => {
    const escritos = escribirCasos(conDirectorio())
    expect(escritos.find((e) => e.nombre === 'con-avisos').primerVertice).toBeNull()
    expect(escritos.find((e) => e.nombre === 'con-avisos').detecciones).toBeGreaterThan(0)
  })
})

describe('scripts/validar-xlsx.mjs · poder medir o no', () => {
  it('`buscarPython` devuelve la forma esperada o `null`, y nunca lanza', () => {
    let r
    expect(() => {
      r = buscarPython()
    }).not.toThrow()
    if (r !== null) {
      expect(typeof r.cmd).toBe('string')
      expect(typeof r.conOpenpyxl).toBe('boolean')
    }
  })

  it('⭐ NO exige openpyxl para elegir intérprete, al revés que el de DXF', () => {
    // La pasada estructural —la que atrapa lo que un lector tolerante perdona— corre
    // con la biblioteca estándar. Descartar un Python pelado sería tirar la medición
    // buena por no tener la cómoda.
    const fuente = readFileSync(
      join(import.meta.dirname, '..', '..', 'scripts', 'validar-xlsx.mjs'),
      'utf8',
    )
    expect(fuente).toContain("disponible(cmd, ['-c', 'import sys'])")
  })

  it('el validador de Python declara los cuatro códigos de salida', () => {
    const py = readFileSync(
      join(import.meta.dirname, '..', '..', 'scripts', 'validar-xlsx.py'),
      'utf8',
    )
    for (const codigo of ['0 →', '1 →', '2 →', '3 →']) expect(py).toContain(codigo)
  })

  it('⭐ y el script dice que esto NO sustituye a abrir el fichero en Excel', () => {
    // Es la lección de ZWCAD: el validador daba verde a un fichero que colgaba el CAD.
    const fuente = readFileSync(
      join(import.meta.dirname, '..', '..', 'scripts', 'validar-xlsx.mjs'),
      'utf8',
    )
    expect(fuente).toMatch(/NO es Excel/)
  })
})
