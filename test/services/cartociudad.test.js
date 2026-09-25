// test/services/cartociudad.test.js — el buscador del mapa, su mitad de red.
//
// Proyecto `node`: el módulo no toca Leaflet ni el DOM. Se prueba con el
// TRANSPORTE REAL de `services/_red.js` sobre el doble de `fetch` del proyecto, y
// con respuestas reales del servicio (`test/fixtures/cartociudad/`, ver su
// PROCEDENCIA.md). Nada de aquí toca la red.
//
// Lo que se vigila:
//   · que no se pregunta nada con menos de MIN_CARACTERES;
//   · que un portal se sitúa SIN segunda petición y una zona con `find`;
//   · que el 0/0 del servicio no se toma por un sitio (está en el golfo de Guinea);
//   · que la referencia catastral de CartoCiudad NO sale del módulo: la del campo
//     la pone el Catastro (ver la cabecera de `services/cartociudad.js`);
//   · que los fallos llegan con motivo y mensaje, nunca como excepción.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

import { crearTransporte, MOTIVO_RED } from '../../services/_red.js'
import {
  CARTOCIUDAD,
  MOTIVO_CARTOCIUDAD,
  ROTULO_TIPO,
  cajaDeWkt,
  crearClienteCartoCiudad,
} from '../../services/cartociudad.js'
import { crearDobleDormir, crearDobleFetch, errorDeRed } from './_doble-fetch.js'

const DIR = fileURLToPath(new URL('../fixtures/cartociudad/', import.meta.url))
const fixture = (nombre) => readFileSync(`${DIR}${nombre}`, 'utf8')

/**
 * Cliente sobre el transporte real. `plan` es el de `crearDobleFetch`: un guion o
 * una función de la URL.
 */
function montar(plan) {
  const doble = crearDobleFetch({ plan })
  const transporte = crearTransporte({
    fetch: doble.fetch,
    dormir: crearDobleDormir().dormir,
    alAvisar: vi.fn(),
  })
  return { doble, cliente: crearClienteCartoCiudad({ transporte }) }
}

describe('el contrato', () => {
  it('exige el transporte de _red.js, y no se inventa uno', () => {
    expect(() => crearClienteCartoCiudad()).toThrow(TypeError)
    expect(() => crearClienteCartoCiudad({ transporte: {} })).toThrow(/pedirTexto/)
  })

  it('la configuración está congelada', () => {
    expect(Object.isFrozen(CARTOCIUDAD)).toBe(true)
    expect(CARTOCIUDAD.BASE).toMatch(/^https:\/\/www\.cartociudad\.es\//)
  })
})

describe('buscar', () => {
  it('con menos de MIN_CARACTERES contesta vacío SIN pedir nada', async () => {
    const { doble, cliente } = montar({ estado: 200, texto: '[]' })
    const r = await cliente.buscar('  ca ')
    expect(r).toEqual({ ok: true, datos: [], motivo: null, mensaje: null })
    expect(doble.total).toBe(0)
  })

  it('pide el texto codificado y con el límite', async () => {
    const { doble, cliente } = montar({ estado: 200, texto: '[]' })
    await cliente.buscar('calle san restituto 72')
    expect(doble.urls()).toEqual([
      `${CARTOCIUDAD.BASE}/candidates?q=calle%20san%20restituto%2072&limit=${CARTOCIUDAD.LIMITE}`,
    ])
  })

  it('un portal llega CON centro y como punto, y sin la referencia de CartoCiudad', async () => {
    const { cliente } = montar({ estado: 200, texto: fixture('candidatos-portal.json') })
    const r = await cliente.buscar('calle san restituto 72 madrid')
    expect(r.ok).toBe(true)
    const [primero] = r.datos
    expect(primero.rotulo).toBe('CALLE SAN RESTITUTO 72 C, Madrid')
    expect(primero.tipo).toBe('portal')
    expect(primero.esPunto).toBe(true)
    expect(primero.centro.lat).toBeCloseTo(40.4653857, 6)
    expect(primero.centro.lng).toBeCloseTo(-3.7166720, 6)
    expect(primero.detalle).toMatch(/^Portal/)
    // ⛔ La referencia del campo la pone el Catastro, no este servicio.
    expect(JSON.stringify(r.datos)).not.toMatch(/9398516VK3799G/)
  })

  it('las zonas llegan SIN centro: el 0/0 del servicio no es un sitio', async () => {
    const { cliente } = montar({ estado: 200, texto: fixture('candidatos-zonas.json') })
    const r = await cliente.buscar('alhaurin')
    expect(r.datos.length).toBeGreaterThan(3)
    for (const lugar of r.datos) {
      expect(lugar.esPunto).toBe(false)
      expect(lugar.centro).toBeNull()
    }
    const municipio = r.datos.find((l) => l.tipo === 'Municipio')
    expect(municipio.detalle).toMatch(new RegExp(`^${ROTULO_TIPO.Municipio}`))
  })

  it('la segunda línea dice DÓNDE cuando la primera no lo dice', async () => {
    const texto = JSON.stringify([
      { id: '1', type: 'callejero', address: 'CALLE MAYOR', muni: 'Alcalá de Henares', province: 'Madrid', lat: 0, lng: 0 },
    ])
    const { cliente } = montar({ estado: 200, texto })
    const r = await cliente.buscar('calle mayor')
    expect(r.datos[0].detalle).toBe('Calle · Alcalá de Henares')
  })

  it('sin coincidencias es una respuesta, no un fallo', async () => {
    const { cliente } = montar({ estado: 200, texto: fixture('candidatos-vacio.json') })
    expect(await cliente.buscar('zzqxwv')).toEqual({ ok: true, datos: [], motivo: null, mensaje: null })
  })

  it('un candidato sin id o sin tipo no se ofrece', async () => {
    const texto = JSON.stringify([{ id: '', type: 'portal' }, { id: '7' }, { id: '8', type: 'portal', lat: 40, lng: -3 }])
    const { cliente } = montar({ estado: 200, texto })
    const r = await cliente.buscar('algo')
    expect(r.datos.map((l) => l.id)).toEqual(['8'])
  })

  it('lo que no es JSON, o no es una lista, sale como RESPUESTA_ILEGIBLE con su motivo', async () => {
    for (const texto of ['<html>mantenimiento</html>', '{"no":"lista"}']) {
      const { cliente } = montar({ estado: 200, texto })
      const r = await cliente.buscar('madrid')
      expect(r.ok).toBe(false)
      expect(r.motivo).toBe(MOTIVO_CARTOCIUDAD.RESPUESTA_ILEGIBLE)
      expect(r.mensaje).toMatch(/CartoCiudad/)
    }
  })

  it('un fallo de red llega con el motivo y el mensaje del transporte, sin lanzar', async () => {
    const { cliente } = montar({ error: errorDeRed() })
    const r = await cliente.buscar('madrid')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_RED.SIN_RED)
    expect(r.mensaje).toMatch(/No se ha podido contactar/)
  })

  it('cancelar es CANCELADA, no un fallo', async () => {
    const { cliente } = montar({ pendiente: true })
    const control = new AbortController()
    const promesa = cliente.buscar('madrid', { senal: control.signal })
    control.abort()
    expect((await promesa).motivo).toBe(MOTIVO_RED.CANCELADA)
  })
})

describe('situar', () => {
  it('un portal que ya trae centro NO cuesta una segunda petición', async () => {
    const { doble, cliente } = montar({ estado: 200, texto: fixture('candidatos-portal.json') })
    const { datos } = await cliente.buscar('calle san restituto 72 madrid')
    const antes = doble.total
    const r = await cliente.situar(datos[0])
    expect(doble.total).toBe(antes)
    expect(r.ok).toBe(true)
    expect(r.datos.caja).toBeNull()
    expect(r.datos.centro).toEqual(datos[0].centro)
  })

  it('una calle se pide con find y trae caja', async () => {
    const lugar = { id: '290070001102', tipo: 'callejero', rotulo: 'CARRETERA ALHAURIN AU3', esPunto: false, centro: null }
    const { doble, cliente } = montar({ estado: 200, texto: fixture('find-callejero.json') })
    const r = await cliente.situar(lugar)
    expect(doble.urls()).toEqual([`${CARTOCIUDAD.BASE}/find?id=290070001102&type=callejero`])
    expect(r.ok).toBe(true)
    const [[sur, oeste], [norte, este]] = r.datos.caja
    expect(sur).toBeLessThan(norte)
    expect(oeste).toBeLessThan(este)
  })

  it('la caja de un municipio contiene su centro', async () => {
    const lugar = { id: '29007', tipo: 'Municipio', rotulo: 'Alhaurín de la Torre', esPunto: false, centro: null }
    const { cliente } = montar({ estado: 200, texto: fixture('find-municipio.json') })
    const { datos } = await cliente.situar(lugar)
    const [[sur, oeste], [norte, este]] = datos.caja
    expect(datos.centro.lat).toBeGreaterThan(sur)
    expect(datos.centro.lat).toBeLessThan(norte)
    expect(datos.centro.lng).toBeGreaterThan(oeste)
    expect(datos.centro.lng).toBeLessThan(este)
  })

  it('el 204 de find (medido) es NO_ENCONTRADO, con el nombre del lugar', async () => {
    const lugar = { id: '999', tipo: 'callejero', rotulo: 'CALLE QUE YA NO ESTÁ', esPunto: false, centro: null }
    const { cliente } = montar({ estado: 204 })
    const r = await cliente.situar(lugar)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CARTOCIUDAD.NO_ENCONTRADO)
    expect(r.mensaje).toMatch(/CALLE QUE YA NO ESTÁ/)
  })

  it('un lugar que no salió de buscar() es un contrato roto', async () => {
    const { cliente } = montar({ estado: 200, texto: '{}' })
    await expect(cliente.situar({ id: 3 })).rejects.toThrow(TypeError)
  })
})

describe('cajaDeWkt', () => {
  it('recorre los pares lng lat y se queda con los extremos', () => {
    expect(cajaDeWkt('MULTIPOLYGON(((-4.5 36.6,-4.4 36.7,-4.6 36.65,-4.5 36.6)))')).toEqual([
      [36.6, -4.6],
      [36.7, -4.4],
    ])
  })

  it('un POINT no tiene caja que encuadrar (medido en los códigos postales)', () => {
    expect(cajaDeWkt('POINT(-3.709 40.46)')).toBeNull()
  })

  it('sin geometría no hay caja', () => {
    for (const wkt of [null, undefined, '', 'GEOMETRYCOLLECTION EMPTY']) expect(cajaDeWkt(wkt)).toBeNull()
  })
})
