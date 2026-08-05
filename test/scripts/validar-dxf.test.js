/* -------------------------------------------------------------------------- *
 * test/scripts/validar-dxf.test.js — el validador de DXF, probado sin Python   *
 *                                                                              *
 * Proyecto `node`. Aquí NO se llama a ezdxf: eso es lo que hace el propio       *
 * script y lo que la CI corre con `--estricto`. Lo que se prueba aquí es lo     *
 * OTRO, que es justo lo que se rompe en silencio:                              *
 *                                                                              *
 *   · que los casos que se auditan sigan cubriendo las tres formas que el       *
 *     exportador sabe producir —dos capas, una, y con huecos—, porque un caso   *
 *     que se cae de la lista deja un camino sin auditar y nadie lo nota;        *
 *   · que los DXF que genera sean los de VERDAD (los produce `export/dxf.js`,   *
 *     no un fixture guardado), y que se escriban donde se dice;                 *
 *   · y que «no poder medir» sea distinguible de «está bien», que es la lección *
 *     que dejó `validar-xsd.mjs` y el motivo de que exista el código 2.         *
 * -------------------------------------------------------------------------- */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { CASOS, escribirCasos, pythonConEzdxf } from '../../scripts/validar-dxf.mjs'
import { ACADVER, CAPAS } from '../../export/dxf.js'

const directorios = []
const conDirectorio = () => {
  const d = mkdtempSync(join(tmpdir(), 'test-validar-dxf-'))
  directorios.push(d)
  return d
}

afterEach(() => {
  while (directorios.length > 0) rmSync(directorios.pop(), { recursive: true, force: true })
})

describe('scripts/validar-dxf.mjs · los casos que se auditan', () => {
  it('⭐ cubre las TRES formas que el exportador sabe producir', () => {
    // Un caso que se cae de la lista deja un camino del exportador sin auditar y
    // el validador seguiría diciendo «✅ todos abren», que es peor que no tenerlo.
    expect(CASOS.map((c) => c.nombre)).toEqual(['dos-capas', 'una-capa', 'con-huecos'])
  })

  it('cada caso dice QUÉ es, no solo cómo se llama', () => {
    for (const caso of CASOS) {
      expect(typeof caso.queEs, `el caso «${caso.nombre}» no explica qué es`).toBe('string')
      expect(caso.queEs.length).toBeGreaterThan(20)
    }
  })

  it('el caso de una capa NO trae geometría oficial, que es lo que lo hace distinto', () => {
    const una = CASOS.find((c) => c.nombre === 'una-capa')
    expect(una.opciones.recintosOficiales).toBe(null)
    const dos = CASOS.find((c) => c.nombre === 'dos-capas')
    expect(Array.isArray(dos.opciones.recintosOficiales)).toBe(true)
  })

  it('el caso con huecos trae MÁS de un recinto editado', () => {
    const huecos = CASOS.find((c) => c.nombre === 'con-huecos')
    expect(huecos.opciones.recintosEditados.length).toBeGreaterThan(1)
  })
})

describe('scripts/validar-dxf.mjs · lo que escribe', () => {
  it('escribe un fichero por caso, con bytes de verdad', () => {
    const dir = conDirectorio()
    const escritos = escribirCasos(dir)

    expect(escritos).toHaveLength(CASOS.length)
    for (const e of escritos) {
      expect(e.ruta.endsWith(`${e.nombre}.dxf`)).toBe(true)
      expect(e.bytes).toBeGreaterThan(200)
      const contenido = readFileSync(e.ruta, 'latin1')
      expect(contenido.length).toBe(e.bytes)
    }
  })

  it('⭐ lo que audita es lo que el exportador produce HOY, no un fixture', () => {
    // La diferencia importa: un fixture guardado seguiría pasando el día que el
    // exportador se rompa. Se comprueba que los bytes llevan los marcadores de
    // subclase que F10 midió como imprescindibles.
    const dir = conDirectorio()
    const [dosCapas] = escribirCasos(dir)
    const contenido = readFileSync(dosCapas.ruta, 'latin1')

    expect(contenido).toContain('POLYLINE')
    expect(contenido).toContain('SEQEND')
    // La VERSIÓN, que es lo que el validador aprendió a juzgar el 2026-08-05: el
    // fichero que colgó ZWCAD llevaba estas mismas capas y esta misma geometría, y
    // lo que le sobraba era prometer un R2000 que no traía.
    expect(contenido).toContain(ACADVER)
    // Y la tabla de capas, que es la trampa gorda: sin ella el fichero abre, el
    // auditor da 0 y 0, y las capas no existen.
    expect(contenido).toContain('TABLES')
    expect(contenido).toContain(CAPAS.OFICIAL.nombre)
    expect(contenido).toContain(CAPAS.EDITADA.nombre)
  })

  it('declara las capas con su recuento de entidades', () => {
    const dir = conDirectorio()
    const escritos = escribirCasos(dir)
    const una = escritos.find((e) => e.nombre === 'una-capa')
    const oficial = una.capas.find((c) => c.nombre === CAPAS.OFICIAL.nombre)
    // Sin geometría oficial la capa EXISTE y está VACÍA, y las dos cosas importan:
    // que exista es lo que hace que el CAD la enseñe en la lista de capas.
    expect(oficial.entidades).toBe(0)
    expect(una.capas.find((c) => c.nombre === CAPAS.EDITADA.nombre).entidades).toBe(1)
  })

  it('escribir dos veces da lo mismo: el exportador no lleva reloj ni contador global', () => {
    const a = escribirCasos(conDirectorio())
    const b = escribirCasos(conDirectorio())
    for (let i = 0; i < a.length; i += 1) {
      expect(readFileSync(b[i].ruta, 'latin1')).toBe(readFileSync(a[i].ruta, 'latin1'))
    }
  })
})

describe('scripts/validar-dxf.mjs · poder medir o no', () => {
  it('`pythonConEzdxf` devuelve una cadena o `null`, nunca lanza', () => {
    // En una máquina sin Python tiene que devolver `null` y dejar que el script
    // decida qué hacer con eso; reventar aquí convertiría «no puedo medir» en un
    // fallo del script, que es otra cosa.
    let resultado
    expect(() => {
      resultado = pythonConEzdxf()
    }).not.toThrow()
    expect(resultado === null || typeof resultado === 'string').toBe(true)
  })
})
