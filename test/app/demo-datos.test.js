/* -------------------------------------------------------------------------- *
 * test/app/demo-datos.test.js — F03 · Fase 5 · datasets de demostración        *
 *                                                                              *
 * Cierra el hueco que dejó la Fase 4: la tarea 4B.2 declaró sus criterios de    *
 * «Hecho» (15 vértices; `recintos[0].tipo === 'EXTERIOR'`; anillo abierto; dos  *
 * llamadas ⇒ objetos distintos; `superficie(recintos)` ≈ 1536 m², que es lo     *
 * que demuestra que las coordenadas se copiaron bien) y los comprobó a mano     *
 * una vez, sin dejar prueba que los sostenga.                                   *
 *                                                                              *
 * Lo que de verdad vigila este fichero es una COPIA A MANO. `app/demo-datos.js` *
 * lleva los 15 vértices de la parcela real 9398516VK3799G escritos como         *
 * literales, a propósito: el bundle de producción no puede depender de          *
 * `test/fixtures/`. El precio de esa decisión es que la copia puede derivar de  *
 * su fuente sin que nada avise — y ese es justo el trabajo de aquí: cotejar la  *
 * copia contra el fixture, que ES la fuente de verdad (así lo dice el módulo).  *
 * El fixture se lee DESDE EL TEST, que sí puede tocar disco.                    *
 *                                                                              *
 * Proyecto Vitest `node`: POJOs y geometría, sin DOM ni Leaflet.                *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import {
  AVISO_DEMO_HUECO_SINTETICO,
  REFCAT_DEMO,
  SRS_DEMO,
  parcelaDemo,
  parcelaDemoConHueco,
} from '../../app/demo-datos.js'
import { superficie } from '../../geo/area.js'
import { SRS_VALIDOS, TIPO_RECINTO, ORIGEN_PARCELA } from '../../model/parcela.js'

// `import.meta.dirname`, no `new URL('../../', import.meta.url)`: bajo jsdom la
// segunda no resuelve contra la base dada (trampa anotada en la Fase 4). Aquí el
// entorno es `node`, pero se mantiene la misma forma en todo el proyecto.
const RAIZ = join(import.meta.dirname, '..', '..')
const fixture = JSON.parse(
  readFileSync(join(RAIZ, 'test', 'fixtures', 'geo', 'parcela-ring.json'), 'utf8'),
)

describe('app/demo-datos · SRS del dataset', () => {
  it('es uno de los SRS que el modelo admite (Península + Baleares)', () => {
    // Derivado de `model/parcela.js#SRS_VALIDOS`, no un literal comparado con
    // otro literal: si el proyecto ampliara o recortara husos, esto lo sigue.
    expect(SRS_VALIDOS).toContain(SRS_DEMO)
  })

  it('es el huso 30, que es el de las coordenadas literales del módulo', () => {
    expect(SRS_DEMO).toBe('EPSG:25830')
  })
})

describe('app/demo-datos · parcelaDemo() — la parcela REAL del Catastro', () => {
  it('tiene 15 vértices en un único recinto EXTERIOR', () => {
    const { recintos } = parcelaDemo()
    expect(recintos).toHaveLength(1)
    expect(recintos[0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(recintos[0].vertices).toHaveLength(15)
  })

  it('lleva su referencia catastral y declara su origen REAL (WFS)', () => {
    const parcela = parcelaDemo()
    expect(parcela.refcat).toBe(REFCAT_DEMO)
    expect(REFCAT_DEMO).toBe('9398516VK3799G')
    // El origen es parte de la honestidad del dato: este anillo viene del
    // servicio, no de un fichero tecleado.
    expect(parcela.origen).toBe(ORIGEN_PARCELA.WFS)
  })

  it('el anillo está ABIERTO: el último vértice NO repite al primero', () => {
    const { vertices } = parcelaDemo().recintos[0]
    expect(vertices.at(-1)).not.toEqual(vertices[0])
  })

  // ── El corazón de este fichero ────────────────────────────────────────────
  it('sus 15 vértices COINCIDEN con el fixture, que es la fuente de verdad', () => {
    // Si esto falla, no se «arregla» el test: se corrige la copia literal de
    // `app/demo-datos.js` contra `test/fixtures/geo/parcela-ring.json`, tal
    // como manda la cabecera de ese módulo.
    expect(parcelaDemo().recintos[0].vertices).toEqual(fixture.anilloExterior)
  })

  it('la superficie cuadra al milímetro con la que el fixture dejó VERIFICADA', () => {
    // Esta es la prueba que de verdad demuestra que las coordenadas se copiaron
    // bien: un solo dígito mal movería la cifra mucho más que un milímetro
    // cuadrado. Se coteja contra `_verificado.areaFirmada` (en valor absoluto:
    // el signo es la ORIENTACIÓN, horaria en el exterior por el override O1, y
    // `superficie` devuelve magnitud), que es la cifra derivada de estas 15
    // coordenadas exactas — NO contra `areaValue`, que es otra cosa (ver abajo).
    const medida = superficie(parcelaDemo().recintos)
    expect(medida).toBeCloseTo(Math.abs(fixture._verificado.areaFirmada), 6)
  })

  it('y encaja con el `areaValue` DECLARADO por el Catastro dentro de ±0,5 m²', () => {
    // `areaValue` es el entero que el Catastro publica en el GML (1536 m²); la
    // superficie calculada sobre el anillo es 1535,87. La diferencia (0,13 m²)
    // NO es un error de copia: es el redondeo del propio Catastro, y cae dentro
    // de la tolerancia catastral urbana de ±0,5 m que el proyecto ya maneja.
    // Se afirma para que quede escrito que la discrepancia es esperada y cuánta.
    const medida = superficie(parcelaDemo().recintos)
    expect(Math.abs(medida - fixture.areaValue)).toBeLessThan(0.5)
    expect(Math.round(medida)).toBe(fixture.areaValue)
  })

  it('cada llamada devuelve un POJO NUEVO: dos vistas no se pisan el estado', () => {
    const a = parcelaDemo()
    const b = parcelaDemo()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.recintos).not.toBe(b.recintos)
    expect(a.recintos[0].vertices).not.toBe(b.recintos[0].vertices)
    // Y la independencia es REAL, no de primer nivel: mutar una no toca la otra.
    a.recintos[0].vertices[0][0] = 999999
    expect(b.recintos[0].vertices[0][0]).toBe(fixture.anilloExterior[0][0])
  })

  it('`geometriaOficial` no comparte referencia con `recintos` (editar no reescribe el original)', () => {
    // Es el estado de una parcela recién cargada: exterior actual === oficial en
    // VALOR. Si compartieran objeto, el primer arrastre de F06 destruiría la
    // referencia contra la que se diagnostica el encaje.
    const parcela = parcelaDemo()
    expect(parcela.geometriaOficial[0].vertices).toEqual(parcela.recintos[0].vertices)
    expect(parcela.geometriaOficial[0].vertices).not.toBe(parcela.recintos[0].vertices)

    parcela.recintos[0].vertices[3][1] = 0
    expect(parcela.geometriaOficial[0].vertices[3][1]).toBe(fixture.anilloExterior[3][1])
  })

  it('no arrastra nada de `test/` al bundle: el módulo no importa fixtures', () => {
    // La razón de ser de la copia a mano. Se comprueba sobre el TEXTO del
    // módulo porque el import sería estático y no dejaría rastro en el POJO.
    const fuente = readFileSync(join(RAIZ, 'app', 'demo-datos.js'), 'utf8')
    const importaDeTest = fuente
      .split('\n')
      .filter((linea) => /^\s*(import|export)\b[^\n]*['"][^'"]*\btest\//.test(linea))
    expect(importaDeTest).toEqual([])
  })
})

describe('app/demo-datos · parcelaDemoConHueco() — dataset SINTÉTICO', () => {
  it('tiene un EXTERIOR y un HUECO, en ese orden', () => {
    const { recintos } = parcelaDemoConHueco()
    expect(recintos).toHaveLength(2)
    expect(recintos.map((r) => r.tipo)).toEqual([TIPO_RECINTO.EXTERIOR, TIPO_RECINTO.HUECO])
  })

  it('NO es la parcela real con un patio añadido encima', () => {
    // Presentar un dato inventado como si fuera del Catastro es exactamente lo
    // que el proyecto rechaza. Se comprueba a tres niveles, porque cualquiera de
    // los tres bastaría para que alguien lo leyera como oficial.
    const sintetica = parcelaDemoConHueco()
    expect(sintetica.refcat).toBeNull()
    expect(sintetica.origen).toBe(ORIGEN_PARCELA.LIST)
    expect(sintetica.recintos[0].vertices).not.toEqual(fixture.anilloExterior)
  })

  it('el aviso que la acompaña dice que NO procede del Catastro', () => {
    // `app/main.js` lo publica en el panel además del eyebrow. Si el texto
    // dejara de decirlo, el dataset pasaría por real en la única superficie
    // que queda escrita en pantalla.
    expect(AVISO_DEMO_HUECO_SINTETICO).toMatch(/SINTÉTICA/)
    expect(AVISO_DEMO_HUECO_SINTETICO).toMatch(/no procede del Catastro/i)
  })

  it('el hueco está REALMENTE contenido en el exterior (si no, el recorte no se ve)', () => {
    const [exterior, hueco] = parcelaDemoConHueco().recintos
    const limites = (vertices) => ({
      minX: Math.min(...vertices.map((v) => v[0])),
      maxX: Math.max(...vertices.map((v) => v[0])),
      minY: Math.min(...vertices.map((v) => v[1])),
      maxY: Math.max(...vertices.map((v) => v[1])),
    })
    const fuera = limites(exterior.vertices)
    const dentro = limites(hueco.vertices)
    expect(dentro.minX).toBeGreaterThan(fuera.minX)
    expect(dentro.maxX).toBeLessThan(fuera.maxX)
    expect(dentro.minY).toBeGreaterThan(fuera.minY)
    expect(dentro.maxY).toBeLessThan(fuera.maxY)
  })

  it('la superficie DESCUENTA el hueco (exterior 24×16 menos hueco 6×6)', () => {
    // El dataset existe para ver el recorte de anillos anidados; si la cifra no
    // descontara, el visor estaría pintando un hueco que el modelo no tiene.
    expect(superficie(parcelaDemoConHueco().recintos)).toBeCloseTo(24 * 16 - 6 * 6, 6)
  })

  it('no se solapa con la parcela real (son dos parcelas distintas, no una encima de otra)', () => {
    const xSintetica = parcelaDemoConHueco().recintos[0].vertices.map((v) => v[0])
    const xReal = fixture.anilloExterior.map((v) => v[0])
    expect(Math.min(...xSintetica)).toBeGreaterThan(Math.max(...xReal))
  })

  it('cada llamada devuelve un POJO NUEVO', () => {
    const a = parcelaDemoConHueco()
    const b = parcelaDemoConHueco()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.recintos[1].vertices).not.toBe(b.recintos[1].vertices)
  })
})
