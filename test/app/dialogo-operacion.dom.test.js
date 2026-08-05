/* -------------------------------------------------------------------------- *
 * test/app/dialogo-operacion.dom.test.js — F17 · T12 (override O20)            *
 *                                                                              *
 * «Tipo de operación» es el único dato del expediente con REDUNDANCIA CERO: la  *
 * Sede lo exige en un desplegable antes de emitir el IVG, **no lo comprueba     *
 * nadie** —cuando se elige, la validación geométrica ya ha ocurrido—, no viaja  *
 * dentro del `.gml` y hasta hoy el informe no lo nombraba. Un valor equivocado  *
 * produce un IVG POSITIVO con la etiqueta mal puesta, firmado y con su CSV.     *
 *                                                                              *
 * Este diálogo es el único sitio de la aplicación donde el usuario revisa lo    *
 * que se va a imprimir antes de imprimirlo, así que es donde va.                *
 *                                                                              *
 * Lo que este fichero defiende:                                                 *
 *                                                                              *
 *   1. Que se PROPONGA y se deje cambiar (regla de oro 9), y que el informe     *
 *      pueda distinguir «lo propuso la aplicación» de «lo eligió quien firma».  *
 *   2. ⛔ **QUE SIN PROPUESTA NO SE COMPONGA**, con el motivo escrito. Imprimir  *
 *      «SIN DECLARAR» habría sido lo cómodo: el hueco se descubriría delante    *
 *      del desplegable de la Sede, con el papel ya firmado.                     *
 *   3. Que las opciones sean DOS y las de la Sede, ni una más.                  *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom).                                                *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, afterEach } from 'vitest'

import { crearDialogoInforme, MOTIVO_OPERACION_SIN_ELEGIR, SELECTOR } from '../../app/dialogo-informe.js'
import { NAMESPACE_CATASTRO, NAMESPACE_LOCAL } from '../../derivacion/identidad.js'
import { TIPO_OPERACION, tipoDeOperacion } from '../../derivacion/operacion.js'
import { componerEncabezado } from '../../report/firma.js'

const FECHA = new Date(Date.UTC(2026, 7, 5, 10, 0, 0))
const pendientes = []

afterEach(() => {
  while (pendientes.length > 0) pendientes.pop().destruir()
  document.body.innerHTML = ''
})

const ENCABEZADO = () =>
  componerEncabezado({ refcat: '7136910UF1473N', srs: 'EPSG:25830', fecha: FECHA })

const LINDERO = () => ({ texto: 'Linda al Norte con la parcela X.', tramos: [] })

function montar(operacion) {
  document.body.className = 'gml-app'
  const dialogo = crearDialogoInforme({ documento: document })
  pendientes.push(dialogo)
  dialogo.fijar({
    encabezado: ENCABEZADO(),
    lindero: LINDERO(),
    ...(operacion === undefined ? {} : { operacion }),
  })
  const raiz = dialogo.nodo
  return {
    dialogo,
    raiz,
    grupo: raiz.querySelector(SELECTOR.OPERACION),
    select: raiz.querySelector(SELECTOR.OPERACION_TIPO),
    porque: raiz.querySelector(SELECTOR.OPERACION_PORQUE),
    boton: raiz.querySelector(SELECTOR.COMPONER),
    estado: raiz.querySelector(SELECTOR.ESTADO),
  }
}

/** Cambia el desplegable como lo haría una persona: valor + `change`. */
function elegir(select, valor) {
  select.value = valor
  select.dispatchEvent(new window.Event('change', { bubbles: true }))
}

const inscrita = { namespaceInspire: NAMESPACE_CATASTRO }
const alta = { namespaceInspire: NAMESPACE_LOCAL }

// ── 1 · Propone, y deja cambiar ─────────────────────────────────────────────

describe('dialogo-informe · el tipo de operación se PROPONE', () => {
  it('⭐ la Subsanación de una sola parcela llega preseleccionada', () => {
    // El flujo F06→F07→F09 ES una Subsanación, y la aplicación no lo nombraba en
    // ninguna capa (SPEC §7.2). Desde aquí lo dice, y lo dice antes de imprimir.
    const { grupo, select, porque } = montar(tipoDeOperacion([inscrita]))
    expect(grupo.hidden).toBe(false)
    expect(select.value).toBe(TIPO_OPERACION.SUBSANACION)
    expect(porque.textContent).toMatch(/27 de julio de 2026/)
  })

  it('la Segregación de dos miembros también, con su porqué a la vista', () => {
    const { select, porque } = montar(tipoDeOperacion([inscrita, alta]))
    expect(select.value).toBe(TIPO_OPERACION.SEGREGACION)
    expect(porque.textContent).toMatch(/alta que el Catastro todavía no tiene/)
  })

  it('⛔ las opciones son DOS y son las de la Sede, ni una más', () => {
    // Está medido (O20): el desplegable no es una taxonomía de alteraciones
    // catastrales. Añadir una tercera «por completitud» ofrecería algo que la Sede
    // no acepta, y el usuario la elegiría de buena fe.
    const { select } = montar(tipoDeOperacion([inscrita]))
    expect([...select.options].map((o) => o.value)).toEqual([
      TIPO_OPERACION.SUBSANACION,
      TIPO_OPERACION.SEGREGACION,
    ])
    expect([...select.options].map((o) => o.textContent)).toEqual(['Subsanación', 'Segregación'])
  })

  it('⭐ cambiarlo se NOTA: el informe distingue propuesta de elección', () => {
    // Y se nota aunque el usuario elija exactamente lo que se le proponía: eso ya
    // no es una propuesta de la aplicación, es una decisión de quien firma, y el
    // papel imprime esa diferencia.
    const { dialogo, select } = montar(tipoDeOperacion([inscrita]))
    expect(dialogo.valores().operacionPropuesta).toBe(true)

    elegir(select, TIPO_OPERACION.SEGREGACION)
    expect(dialogo.valores().tipoOperacion).toBe(TIPO_OPERACION.SEGREGACION)
    expect(dialogo.valores().operacionPropuesta).toBe(false)

    elegir(select, TIPO_OPERACION.SUBSANACION) // vuelve a lo propuesto…
    expect(dialogo.valores().tipoOperacion).toBe(TIPO_OPERACION.SUBSANACION)
    expect(dialogo.valores().operacionPropuesta).toBe(false) // …y sigue siendo suya
  })
})

// ── 2 · ⛔ Sin propuesta no se compone ───────────────────────────────────────

describe('dialogo-informe · cuando la aplicación NO puede proponer', () => {
  const sinForma = () => tipoDeOperacion([inscrita, inscrita])

  it('no preselecciona nada, y ofrece «(elija una)» delante', () => {
    const { select } = montar(sinForma())
    expect(select.value).toBe('')
    expect(select.options[0].textContent).toBe('(elija una)')
    expect(select.options).toHaveLength(3)
  })

  it('⛔ «Componer PDF» nace APAGADO, y el renglón dice por qué', () => {
    // Nunca un botón gris y mudo: el usuario ve apagado lo único que la pantalla le
    // ofrece hacer y tiene que poder saber qué falta.
    const { boton, estado } = montar(sinForma())
    expect(boton.disabled).toBe(true)
    expect(estado.textContent).toBe(MOTIVO_OPERACION_SIN_ELEGIR)
    expect(estado.textContent).toMatch(/no lo comprueba nadie|no comprueba nadie|sale positivo/)
  })

  it('en cuanto se elige, se enciende y el renglón se vacía', () => {
    const { select, boton, estado, dialogo } = montar(sinForma())
    elegir(select, TIPO_OPERACION.SEGREGACION)
    expect(boton.disabled).toBe(false)
    expect(estado.textContent).toBe('')
    expect(dialogo.valores().tipoOperacion).toBe(TIPO_OPERACION.SEGREGACION)
  })

  it('⚠️ y avisa de que esa forma de fichero no se ha presentado nunca', () => {
    expect(montar(sinForma()).porque.textContent).toMatch(/NO se ha presentado nunca/)
  })

  it('una sola parcela que es un ALTA sí se propone, pero con la advertencia', () => {
    const { select, porque } = montar(tipoDeOperacion([alta]))
    expect(select.value).toBe(TIPO_OPERACION.SUBSANACION)
    expect(porque.textContent).toMatch(/NO se ha presentado nunca/)
  })
})

// ── 3 · Sin operación, el grupo no existe ───────────────────────────────────

describe('dialogo-informe · sin operación declarada', () => {
  it('⚠️ el grupo se esconde y `tipoOperacion` es `null`, sin bloquear nada', () => {
    // Es la forma de decir «nadie ha dicho qué acto jurídico es esto», y entonces el
    // informe no imprime la sección. Imprimir «Subsanación» por defecto declararía
    // un acto jurídico que nadie ha elegido, que es lo que O20 prohíbe.
    const { grupo, boton, dialogo } = montar()
    expect(grupo.hidden).toBe(true)
    expect(boton.disabled).toBe(false)
    expect(dialogo.valores().tipoOperacion).toBeNull()
    expect(dialogo.valores().operacionPropuesta).toBe(false)
  })

  it('⛔ `fijar` lanza si `operacion` no es ni un objeto ni `null`', () => {
    const dialogo = crearDialogoInforme({ documento: document })
    pendientes.push(dialogo)
    expect(() =>
      dialogo.fijar({ encabezado: ENCABEZADO(), lindero: LINDERO(), operacion: 'SEGREGACION' }),
    ).toThrow(TypeError)
  })

  it('`fijar(null)` vacía el desplegable y esconde el grupo otra vez', () => {
    const { dialogo, grupo, select } = montar(tipoDeOperacion([inscrita, alta]))
    expect(grupo.hidden).toBe(false)
    dialogo.fijar(null)
    expect(grupo.hidden).toBe(true)
    expect(select.options).toHaveLength(0)
    expect(dialogo.valores()).toBeNull()
  })

  it('un `fijar` nuevo REEMPLAZA la propuesta y olvida que se había tocado', () => {
    // Es un documento nuevo, no un refresco: arrastrar el «lo eligió el usuario» del
    // anterior imprimiría en este papel una decisión que nadie tomó sobre él.
    const { dialogo, select } = montar(tipoDeOperacion([inscrita]))
    elegir(select, TIPO_OPERACION.SEGREGACION)
    expect(dialogo.valores().operacionPropuesta).toBe(false)

    dialogo.fijar({
      encabezado: ENCABEZADO(),
      lindero: LINDERO(),
      operacion: tipoDeOperacion([inscrita, alta]),
    })
    expect(dialogo.valores().tipoOperacion).toBe(TIPO_OPERACION.SEGREGACION)
    expect(dialogo.valores().operacionPropuesta).toBe(true)
  })
})
