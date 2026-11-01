// test/derivacion/entrega-expediente.test.js — F25 · fase 4 · el fichero de las
// parcelas del expediente armado a mano.
//
// Una matriz oficial de 40 × 40 m partida en dos mitades: la matriz editada se queda
// la izquierda y la pieza del sobrante es la derecha. Cierra EXACTO por construcción,
// así que cada prueba estropea una sola cosa y mira que se diga esa.

import { describe, expect, it } from 'vitest'

import { TIPO_DERIVACION } from '../../derivacion/_comun.js'
import { prepararEntregaExpediente } from '../../derivacion/entrega-expediente.js'
import { crearParcela } from '../../model/parcela.js'

const SRS = 'EPSG:25830'
const X0 = 440000
const Y0 = 4470000
const REF = '7136910UF1473N'

const rect = (x0, y0, x1, y1) => ({
  tipo: 'EXTERIOR',
  vertices: [
    [X0 + x0, Y0 + y0],
    [X0 + x1, Y0 + y0],
    [X0 + x1, Y0 + y1],
    [X0 + x0, Y0 + y1],
  ],
})

const matriz = (recinto = rect(0, 0, 20, 40)) =>
  crearParcela({
    idLocal: REF,
    refcat: REF,
    recintos: [recinto],
    geometriaOficial: [rect(0, 0, 40, 40)],
    origen: 'WFS',
  })
const pieza = (recinto = rect(20, 0, 40, 40)) =>
  crearParcela({ idLocal: `${REF}.1`, refcat: null, recintos: [recinto], origen: 'DERIVACION' })

const tipos = (e) => e.detecciones.map((d) => d.tipo)

describe('prepararEntregaExpediente · F25 · fase 4', () => {
  it('⭐ una segregación que CIERRA: sale el fichero con las dos y la forma de O19', () => {
    const m = matriz()
    const e = prepararEntregaExpediente({ parcelas: [m, pieza()], principal: m, srs: SRS })
    expect(e.puedeEntregarse).toBe(true)
    expect(e.nMiembros).toBe(2)
    expect(e.refcat).toBe(REF)
    expect(e.operacion.tipo).toBe('SEGREGACION')
    expect(e.cierre.cierra).toBe(true)
    expect(e.xml).toMatch(/gml:featureMember/)
    // La matriz como finca existente; la pieza con la referencia sufijada, no vacía.
    expect(e.miembros[0].identidad).toMatchObject({ namespaceInspire: 'ES.SDGC.CP', nationalCadastralReference: REF })
    expect(e.miembros[1].identidad).toMatchObject({
      refcat: `${REF}.1`,
      namespaceInspire: 'ES.LOCAL.CP',
      nationalCadastralReference: `${REF}.1`,
    })
    expect(e.xml).toContain(`${REF}.1`)
    expect(tipos(e)).toContain(TIPO_DERIVACION.ENTREGA_LISTA)
  })

  it('⛔ una segregación que NO cierra no se escribe (el IVG la devolvería negativa)', () => {
    const m = matriz()
    const e = prepararEntregaExpediente({ parcelas: [m, pieza(rect(20, 0, 35, 40))], principal: m, srs: SRS })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.xml).toBe(null)
    expect(tipos(e)).toContain(TIPO_DERIVACION.CONJUNTO_NO_CIERRA)
    expect(e.detecciones.find((d) => d.tipo === TIPO_DERIVACION.CONJUNTO_NO_CIERRA).mensaje).toMatch(/Segregación/)
  })

  it('una SUBSANACIÓN (solo oficiales) no exige cerrar: la medición puede no coincidir con el contorno', () => {
    const m = matriz()
    const e = prepararEntregaExpediente({ parcelas: [m], principal: m, srs: SRS })
    expect(e.operacion.tipo).toBe('SUBSANACION')
    expect(e.puedeEntregarse).toBe(true)
    expect(e.xml).not.toBe(null)
  })

  it('⛔ dos parcelas que se PISAN no salen nunca, sea cual sea la operación', () => {
    const m = matriz()
    const e = prepararEntregaExpediente({ parcelas: [m, pieza(rect(15, 0, 40, 40))], principal: m, srs: SRS })
    expect(e.puedeEntregarse).toBe(false)
    expect(tipos(e)).toContain(TIPO_DERIVACION.PARCELAS_SE_PISAN)
    expect(e.detecciones.find((d) => d.tipo === TIPO_DERIVACION.PARCELAS_SE_PISAN).mensaje).toContain(REF)
    // Y no se acusa además de «no cierra»: el solape ya es el motivo.
    expect(tipos(e)).not.toContain(TIPO_DERIVACION.CONJUNTO_NO_CIERRA)
  })

  it('⛔ también sin ninguna oficial: dos dibujadas que se pisan', () => {
    const a = crearParcela({ idLocal: 'a', recintos: [rect(0, 0, 20, 20)], origen: 'DIBUJO' })
    const b = crearParcela({ idLocal: 'b', recintos: [rect(10, 0, 30, 20)], origen: 'DIBUJO' })
    const e = prepararEntregaExpediente({ parcelas: [a, b], srs: SRS })
    expect(tipos(e)).toContain(TIPO_DERIVACION.PARCELAS_SE_PISAN)
    expect(e.cierre).toBe(null) // sin oficial no hay diana que enseñar
  })

  it('⛔ dos que saldrían con el MISMO identificador se dicen, y el fichero no se escribe', () => {
    const m = matriz()
    const otra = crearParcela({ idLocal: 'otra', refcat: REF, recintos: [rect(20, 0, 40, 40)], origen: 'WFS' })
    const e = prepararEntregaExpediente({ parcelas: [m, otra], principal: m, srs: SRS })
    expect(e.puedeEntregarse).toBe(false)
    expect(tipos(e)).toContain(TIPO_DERIVACION.IDENTIDAD_REPETIDA)
  })

  it('⛔ una parcela que no valida bloquea, nombrándola', () => {
    const m = matriz()
    const lazo = {
      tipo: 'EXTERIOR',
      vertices: [
        [X0 + 20, Y0],
        [X0 + 40, Y0 + 40],
        [X0 + 40, Y0],
        [X0 + 20, Y0 + 40],
      ],
    }
    const e = prepararEntregaExpediente({ parcelas: [m, pieza(lazo)], principal: m, srs: SRS })
    expect(e.puedeEntregarse).toBe(false)
    const invalida = e.detecciones.find((d) => d.tipo === TIPO_DERIVACION.PIEZA_INVALIDA)
    expect(invalida.mensaje).toContain(`${REF}.1`)
  })

  it('sin parcelas, o sin srs, es un contrato roto', () => {
    expect(() => prepararEntregaExpediente({ parcelas: [], srs: SRS })).toThrow(RangeError)
    expect(() => prepararEntregaExpediente({ parcelas: [matriz()] })).toThrow(TypeError)
  })
})
