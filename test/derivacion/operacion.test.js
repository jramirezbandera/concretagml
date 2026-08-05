/* -------------------------------------------------------------------------- *
 * test/derivacion/operacion.test.js — F17 · tarea 3.x                          *
 *                                                                              *
 * «Tipo de operación» es **el único dato del expediente con redundancia cero**: *
 * no viaja en el `.gml`, no lo comprueba la Sede —cuando se elige, ya validó—   *
 * y el informe de F09 no lo nombraba. Un valor equivocado produce un IVG        *
 * POSITIVO con la etiqueta mal puesta, firmado y con su CSV.                    *
 *                                                                              *
 * Lo que este fichero defiende:                                                 *
 *                                                                              *
 *   1. Las DOS formas MEDIDAS, cada una con su fecha de verificación.           *
 *   2. ⛔ **QUE `propuesto` NO PUEDA VALER OTRA COSA.** La aplicación no decide  *
 *      qué acto jurídico es esto (regla de oro 9): sabe qué FORMA tiene el       *
 *      fichero, que es otra cosa.                                               *
 *   3. ⛔ **QUE UNA FORMA NO MEDIDA NO SE DISFRACE DE PROPUESTA.** `formaMedida` *
 *      la distingue, y cuando ni se parece, `tipo` sale `null` en vez de        *
 *      inventarse la etiqueta más consecuente del expediente.                   *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  AVISO_DECLARATIVO,
  ROTULO_OPERACION,
  TIPO_OPERACION,
  tipoDeOperacion,
} from '../../derivacion/operacion.js'
import { NAMESPACE_CATASTRO, NAMESPACE_LOCAL } from '../../derivacion/identidad.js'

const inscrita = { namespaceInspire: NAMESPACE_CATASTRO }
const alta = { namespaceInspire: NAMESPACE_LOCAL }

describe('tipoDeOperacion · las dos formas MEDIDAS', () => {
  it('⭐ UNA parcela inscrita ⇒ Subsanación (verificada el 2026-07-27)', () => {
    const o = tipoDeOperacion([inscrita])
    expect(o.tipo).toBe(TIPO_OPERACION.SUBSANACION)
    expect(o.formaMedida).toBe(true)
    expect(o.miembros).toBe(1)
    expect(o.altas).toBe(0)
    expect(o.porQue).toMatch(/27 de julio de 2026/)
  })

  it('⭐ DOS o más con al menos un alta ⇒ Segregación (verificada el 2026-08-03)', () => {
    const o = tipoDeOperacion([inscrita, alta])
    expect(o.tipo).toBe(TIPO_OPERACION.SEGREGACION)
    expect(o.formaMedida).toBe(true)
    expect(o.miembros).toBe(2)
    expect(o.altas).toBe(1)
    expect(o.porQue).toMatch(/3 de agosto de 2026/)
  })

  it('⛔ y el flujo F06→F07→F09 —una sola parcela— TIENE nombre desde hoy', () => {
    // Era el hueco de SPEC §7.2: todo lo que hace esta aplicación en su caso de uso
    // más frecuente es una Subsanación, y la palabra no aparecía en ninguna capa.
    expect(tipoDeOperacion([inscrita]).tipo).toBe(TIPO_OPERACION.SUBSANACION)
    expect(ROTULO_OPERACION[TIPO_OPERACION.SUBSANACION]).toBe('Subsanación')
    expect(ROTULO_OPERACION[TIPO_OPERACION.SEGREGACION]).toBe('Segregación')
  })

  it('el catálogo tiene EXACTAMENTE dos, como el desplegable de la Sede', () => {
    // Está medido (O20): no hay agrupación, ni división, ni rectificación de
    // linderos. Cerrarlo a dos es lo que hace que no haya un tercer caso sin probar.
    expect(Object.keys(TIPO_OPERACION).sort()).toEqual(['SEGREGACION', 'SUBSANACION'])
    expect(Object.keys(ROTULO_OPERACION).sort()).toEqual(['SEGREGACION', 'SUBSANACION'])
    expect(Object.isFrozen(TIPO_OPERACION)).toBe(true)
  })
})

describe('tipoDeOperacion · lo que NO está medido se dice, no se disimula', () => {
  it('una sola parcela que es un ALTA: se propone Subsanación pero con la marca', () => {
    // Con un miembro la Sede solo ofrece Subsanación, así que la propuesta es la
    // única posible; lo que NO se puede es decir que esa combinación se ha
    // presentado, porque no se ha presentado.
    const o = tipoDeOperacion([alta])
    expect(o.tipo).toBe(TIPO_OPERACION.SUBSANACION)
    expect(o.formaMedida).toBe(false)
    expect(o.porQue).toMatch(/NO se ha presentado nunca/)
  })

  it('⛔ dos o más y NINGUNA de alta: `tipo` es `null`, no una suposición', () => {
    // Ni es la Segregación medida —que lleva al menos una finca nueva— ni cabe en
    // Subsanación, que es de una sola. Proponer aquí sería inventarse la etiqueta
    // más consecuente del expediente a partir de un caso que nadie ha probado.
    const o = tipoDeOperacion([inscrita, inscrita])
    expect(o.tipo).toBeNull()
    expect(o.formaMedida).toBe(false)
    expect(o.porQue).toMatch(/Elíjala usted/)
  })

  it('⛔ `propuesto` es SIEMPRE `true`, en todos los caminos', () => {
    // Regla de oro 9 escrita como invariante: esta función no sabe qué acto
    // jurídico está haciendo el colegiado, sabe qué forma tiene el fichero.
    const casos = [[inscrita], [alta], [inscrita, alta], [inscrita, inscrita], [alta, alta, alta]]
    for (const c of casos) expect(tipoDeOperacion(c).propuesto).toBe(true)
  })

  it('el aviso declarativo lleva los tres candados de F09 dentro de la frase', () => {
    // «Dato NO verificado» + quién responde + «confírmelo antes». Van DENTRO porque
    // es la frase que el lector copia, y una nota al pie se queda atrás al recortar.
    expect(AVISO_DECLARATIVO).toMatch(/DECLARATIVO/)
    expect(AVISO_DECLARATIVO).toMatch(/no lo caza nadie/)
    expect(AVISO_DECLARATIVO).toMatch(/Confírmelo en la Sede/)
  })
})

describe('tipoDeOperacion · contrato', () => {
  it('⛔ lanza con una lista vacía: un fichero sin parcelas no declara nada', () => {
    expect(() => tipoDeOperacion([])).toThrow(TypeError)
    expect(() => tipoDeOperacion()).toThrow(/NO vacío/)
    expect(() => tipoDeOperacion('7136910UF1473N')).toThrow(TypeError)
  })

  it('un namespace desconocido no cuenta ni como alta ni como inscrita', () => {
    // Ni se ignora en silencio ni se trata como una de las dos: la forma deja de
    // corresponderse con ninguna medida, que es exactamente lo que ha pasado.
    const o = tipoDeOperacion([inscrita, { namespaceInspire: 'ES.OTRA.CP' }])
    expect(o.altas).toBe(0)
    expect(o.tipo).toBeNull()
  })
})
