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
  it('cubre los casos de MEDIR el sobrante y los de ARMAR el expediente', () => {
    // ⚠️ La tarea 1.2 escribió «vocabulario COMPLETO desde ya» y lo era para lo que
    // entonces se sabía: los seis primeros son de MEDIR. Los cuatro de la fase 3 son
    // de ARMAR —qué entra en el fichero, si cierra, si cada pieza valida—, que es
    // otra pregunta y no se podía nombrar antes de que existiera `entrega.js`. Se
    // añadieron en vez de estirar los otros: `REGION_NO_APTA` significa «no se pudo
    // construir la geometría», y usarlo para «la pieza no valida» dejaría a la
    // interfaz sin distinguir un fallo del motor de un lindero que se cruza solo.
    // Clave === valor para que una detección se lea sola en un volcado.
    expect(Object.keys(TIPO_DERIVACION).sort()).toEqual([
      'CONJUNTO_NO_CIERRA',
      'CRECE_FUERA',
      'ENTREGA_LISTA',
      'PIEZA_ESTRECHA',
      'PIEZA_EXCLUIDA',
      'PIEZA_INVALIDA',
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
  it('saca el léxico entero, la derivación y la identidad — y nada más', () => {
    // ⚠️ Lista CERRADA a propósito, y crece con la capa: la fase 2 le añadió
    // `derivarCesion` y las cinco cosas de `identidad.js`, y la 3 el orquestador y
    // el acto jurídico. Lo que este test defiende no es el tamaño de la lista, es
    // que nada entre aquí sin que alguien lo escriba.
    expect(Object.keys(barrel).sort()).toEqual([
      'AVISO_DECLARATIVO',
      'MOTIVO_RESTA',
      'NAMESPACE_CATASTRO',
      'NAMESPACE_LOCAL',
      'ROTULO_OPERACION',
      'SEPARADOR_SEGREGADA',
      'SEVERIDAD',
      'TIPO_DERIVACION',
      'TIPO_OPERACION',
      'crearDeteccionDerivacion',
      'derivarCesion',
      'identidadDeCesion',
      'identidadDeParcela',
      'prepararEntrega',
      'resumirDetecciones',
      'tipoDeOperacion',
    ])
  })

  it('⛔ las guardas de `_comun.js` NO salen: son herramientas internas', () => {
    // Sacarlas daría dos caminos hasta la misma comprobación, y el día que uno
    // cambie de promesa el otro seguirá diciendo la de antes.
    for (const interno of ['describir', 'exigirOpciones', 'exigirRecintos', 'numero']) {
      expect(Object.keys(barrel), `el barrel no puede exponer '${interno}'`).not.toContain(interno)
    }
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
