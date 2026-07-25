import { describe, it, expect } from 'vitest'
import {
  crearExpediente,
  crearParcela,
  crearRecinto,
} from '../model/parcela.js'
import { crearEdificio, crearParteConstruccion } from '../model/edificio.js'
import * as area from '../geo/area.js'
import * as cierre from '../geo/cierre.js'
import * as utm from '../geo/utm.js'
import * as huso from '../geo/huso.js'
import * as barrel from '../index.js'
import fixture from './fixtures/geo/parcela-ring.json' with { type: 'json' }

// ── Test-guardián del contrato transversal de F00 (criterio de aceptación 5) ──
// "Ninguna función de model/ ni de geo/area · geo/cierre acepta o devuelve lat/lon."
// La frontera de proyección (geo/utm, geo/huso) SÍ expone lat/lon por diseño: se
// verifica aquí como frontera explícita, no como fuga.

const CLAVE_GEOGRAFICA = /^(lat|lon|latitud|longitud|latitude|longitude)$/i

/** Recorre en profundidad un POJO y devuelve las rutas cuyas claves parecen geográficas. */
function clavesGeograficas(valor, ruta = '$', acc = []) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => clavesGeograficas(v, `${ruta}[${i}]`, acc))
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVE_GEOGRAFICA.test(k)) acc.push(`${ruta}.${k}`)
      clavesGeograficas(v, `${ruta}.${k}`, acc)
    }
  }
  return acc
}

/** Comprueba que todo par de coordenadas es [x,y] de números finitos. */
function esParUTM(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
}

const anillo = fixture.anilloExterior

describe('contrato F00 · el modelo y la geometría pura viven en UTM (criterio 5)', () => {
  it('un Expediente de parcela completo no contiene claves lat/lon', () => {
    const recintos = [crearRecinto(anillo, 'EXTERIOR')]
    const parcela = crearParcela({
      idLocal: 'p1',
      refcat: fixture.refCatastral,
      recintos,
      geometriaOficial: recintos,
      superficieRegistral: 1500,
      origen: 'WFS',
    })
    const expediente = crearExpediente({
      tipo: 'PARCELA',
      srs: fixture.srs,
      autor: 'test',
      idDocumento: 'd1',
      parcela,
    })
    expect(clavesGeograficas(expediente)).toEqual([])
    // y sus vértices son pares UTM
    expect(expediente.parcela.recintos[0].vertices.every(esParUTM)).toBe(true)
  })

  it('un Edificio con partes no contiene claves lat/lon', () => {
    const recinto = crearRecinto(anillo, 'EXTERIOR')
    const parte = crearParteConstruccion({
      nombre: 'cuerpo principal',
      tipo: 'PRINCIPAL',
      recinto,
      plantasSobreRasante: 2,
      plantasBajoRasante: 1,
      origen: 'DIBUJADA',
    })
    const edificio = crearEdificio({
      refcat: fixture.refCatastral,
      modelo: 'COMPLETO',
      partes: [parte],
    })
    expect(clavesGeograficas(edificio)).toEqual([])
  })

  it('geo/area no devuelve lat/lon y opera en UTM', () => {
    expect(typeof area.area(anillo)).toBe('number')
    expect(typeof area.areaFirmada(anillo)).toBe('number')
    expect([-1, 1]).toContain(area.orientacion(anillo))
  })

  it('geo/cierre devuelve un anillo UTM abierto, sin lat/lon', () => {
    const cerrado = [...anillo, anillo[0]] // recierra artificialmente
    const { anillo: compensado } = cierre.compensarCierre(cerrado)
    expect(clavesGeograficas({ compensado })).toEqual([])
    expect(compensado.every(esParUTM)).toBe(true)
  })
})

describe('contrato F00 · frontera de proyección (utm/huso) — lat/lon permitido y esperado', () => {
  it('utm.inverse ES la frontera: devuelve lat/lon', () => {
    const r = utm.inverse(439250.35, 4479664.55, 30)
    expect(r).toHaveProperty('lat')
    expect(r).toHaveProperty('lon')
    expect(Number.isFinite(r.lat) && Number.isFinite(r.lon)).toBe(true)
  })

  it('huso.detectarHuso reporta el punto de caída (lon/lat) — frontera, no fuga', () => {
    const r = huso.detectarHuso(fixture.referencePoint)
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    expect(r).toHaveProperty('lon')
    expect(r).toHaveProperty('lat')
  })
})

describe('contrato F02 · la validación sale por el barrel y no expone lat/lon', () => {
  it('el barrel expone el espacio de nombres `validacion` con validarParcela y NIVEL', () => {
    expect(typeof barrel.validacion.validarParcela).toBe('function')
    expect(barrel.validacion.NIVEL).toEqual({ ERROR: 'ERROR', AVISO: 'AVISO' })
  })

  it('validarParcela devuelve {errores, avisos, puedeGenerar} en UTM, sin claves lat/lon', () => {
    const recintos = [crearRecinto(anillo, 'EXTERIOR')]
    const r = barrel.validacion.validarParcela(recintos, { srs: fixture.srs })
    expect(Array.isArray(r.errores)).toBe(true)
    expect(Array.isArray(r.avisos)).toBe(true)
    expect(typeof r.puedeGenerar).toBe('boolean')
    // Errores y avisos son listas SEPARADAS (criterio 3): no hay recuento mezclado.
    expect(r).not.toHaveProperty('total')
    expect(clavesGeograficas(r)).toEqual([])
  })
})
