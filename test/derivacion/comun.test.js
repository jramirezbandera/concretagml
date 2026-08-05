/* -------------------------------------------------------------------------- *
 * test/derivacion/comun.test.js — F17 · tarea 1.2                              *
 *                                                                              *
 * El vocabulario de la capa. Lo que comparte con las otras cuatro —la forma de  *
 * la detección, la escala de severidad, el rechazo ante entrada mala— lo ata el *
 * bloque «contrato D» de `test/contrato.test.js`, que compara las CINCO         *
 * fábricas entre sí. Aquí va lo que es PROPIO de `derivacion/`: que su léxico   *
 * cubra los casos de la fase y que el barrel exponga lo que dice exponer.       *
 *                                                                              *
 * Proyecto Vitest `node`.                                                        *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  MOTIVO_RESTA,
  SEVERIDAD,
  TIPO_DERIVACION,
  crearDeteccionDerivacion,
  resumirDetecciones,
} from '../../derivacion/_comun.js'
import * as barrel from '../../derivacion/index.js'
import * as raiz from '../../index.js'

describe('derivacion/_comun · el léxico de la capa', () => {
  it('cubre los seis casos de la fase, y las claves valen su propio nombre', () => {
    // Vocabulario COMPLETO desde ya, aunque la tarea 1.2 solo emita tres: `cesion.js`
    // y `entrega.js` hablan este mismo idioma, como hicieron los cuatro léxicos
    // anteriores. Clave === valor para que una detección se lea sola en un volcado.
    expect(Object.keys(TIPO_DERIVACION).sort()).toEqual([
      'CRECE_FUERA',
      'PIEZA_ESTRECHA',
      'REGION_NO_APTA',
      'RESTA_FALLIDA',
      'SIN_GEOMETRIA_OFICIAL',
      'SIN_SOBRANTE',
    ])
    for (const [k, v] of Object.entries(TIPO_DERIVACION)) expect(v).toBe(k)
    expect(Object.isFrozen(TIPO_DERIVACION)).toBe(true)
  })

  it('⭐ `SIN_SOBRANTE` existe como TIPO, y ése es medio contrato de la capa', () => {
    // «No hay sobrante» tiene que ser una respuesta CON NOMBRE, no una lista vacía:
    // si no, se confunde con «no se ha podido medir», y el 0 tranquiliza.
    const d = crearDeteccionDerivacion(TIPO_DERIVACION.SIN_SOBRANTE, 'No queda nada', SEVERIDAD.INFO)
    expect(d.severidad).toBe(SEVERIDAD.INFO)
    expect(TIPO_DERIVACION.REGION_NO_APTA).not.toBe(TIPO_DERIVACION.SIN_SOBRANTE)
  })

  it('`MOTIVO_RESTA` añade lo suyo sin renombrar lo de `geo/`', () => {
    // Los motivos de construcción de región vienen tal cual de `MOTIVO_REGION`: son
    // el mismo hecho y traducirlos daría dos vocabularios para una sola cosa.
    expect(MOTIVO_RESTA).toEqual({ MOTOR_BOOLEANO: 'MOTOR_BOOLEANO' })
    expect(Object.isFrozen(MOTIVO_RESTA)).toBe(true)
  })

  it('`resumirDetecciones` cuenta por tipo y por severidad', () => {
    expect(
      resumirDetecciones([
        crearDeteccionDerivacion(TIPO_DERIVACION.SIN_SOBRANTE, 'a', SEVERIDAD.INFO),
        crearDeteccionDerivacion(TIPO_DERIVACION.RESTA_FALLIDA, 'b', SEVERIDAD.ERROR),
        crearDeteccionDerivacion(TIPO_DERIVACION.RESTA_FALLIDA, 'c', SEVERIDAD.ERROR),
      ]),
    ).toEqual({
      total: 3,
      porTipo: { SIN_SOBRANTE: 1, RESTA_FALLIDA: 2 },
      porSeveridad: { INFO: 1, ERROR: 2 },
    })
    expect(resumirDetecciones([])).toEqual({ total: 0, porTipo: {}, porSeveridad: {} })
  })
})

describe('derivacion/index · el barrel expone el vocabulario y NADA de geometría', () => {
  it('saca las cinco cosas del léxico y ninguna más', () => {
    expect(Object.keys(barrel).sort()).toEqual([
      'MOTIVO_RESTA',
      'SEVERIDAD',
      'TIPO_DERIVACION',
      'crearDeteccionDerivacion',
      'resumirDetecciones',
    ])
  })

  it('⛔ `restar` NO sale por ninguna vía, tampoco por el barrel raíz', () => {
    // Lo mismo que `diagnostico/topologia.js` con el suyo: la primitiva devuelve
    // geometría sin interpretar, y quien sabe qué significa es `cesion.js`.
    expect(barrel.restar).toBeUndefined()
    expect(raiz.derivacion).toBeDefined()
    expect(raiz.derivacion.restar).toBeUndefined()
    expect(raiz.derivacion.TIPO_DERIVACION).toBe(TIPO_DERIVACION)
  })

  it('la capa entra en el barrel RAÍZ, que carga el proyecto `node` sin `window`', () => {
    // Es la condición para estar ahí: todo lo que sale de `derivacion/` es puro.
    // Que este propio fichero importe `../../index.js` y no reviente ya lo prueba.
    expect(typeof raiz.derivacion.crearDeteccionDerivacion).toBe('function')
  })
})
