/* -------------------------------------------------------------------------- *
 * test/app/contraste.test.js — Rework de UI · T9 · la pantalla de contraste     *
 *                                                                              *
 * Proyecto `node`, SIN DOM, y es la mitad del argumento del módulo: si          *
 * `app/contraste.js` necesitara un documento para probarse, es que habría       *
 * dejado de ser un aplicador y habría empezado a pintar. Aquí se comprueban     *
 * las dos cosas de las que es dueño:                                            *
 *                                                                              *
 *   1. **Qué cajón permite cada paso**, que es una función pura y es el corazón *
 *      de T9: la exclusión mutua de la esquina `bottomleft` deja de ser un      *
 *      acuerdo entre dos módulos y pasa a derivarse del estado.                 *
 *   2. **La procedencia declarada**, compuesta de `parcela.origen` (el modelo)  *
 *      y del modo (la navegación). También pura.                                *
 *                                                                              *
 * Y el comportamiento del cable, con la navegación DE VERDAD y no un doble —la  *
 * misma doctrina que el resto de `test/app/`: lo que se prueba es el CABLE—.    *
 * Los cajones sí son dobles, porque son de Leaflet y viven en `viewer/`.        *
 * -------------------------------------------------------------------------- */

import { describe, expect, it, vi } from 'vitest'

import {
  CAJON,
  COLA_EN_COMPROBACION,
  COLA_TOMADA,
  PROCEDENCIA,
  cablearContraste,
  cajonDe,
  mensajeOrigenDesconocido,
  textoProcedencia,
} from '../../app/contraste.js'
import { MODO, PASO, PASOS, RAMA, crearNavegacion } from '../../app/navegacion.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'
import { crearEstadoVista } from '../../viewer/_comun.js'

/** Hechos con los que los cinco pasos de la rama PARCELA se sostienen. */
const TODO = Object.freeze({ geometria: true, oficial: true, diagnostico: true })

/** Los tres espías que el aplicador recibe, con la cuenta de cada uno. */
function acciones() {
  return {
    abrirDiagnostico: vi.fn(),
    cerrarDiagnostico: vi.fn(),
    cerrarComprobacion: vi.fn(),
  }
}

/** La navegación de verdad, con dato suficiente para llegar a cualquier paso. */
const navegacionCompleta = (paso = PASO.ENTRADA) =>
  crearNavegacion({ rama: RAMA.PARCELA, paso, hechos: { [RAMA.PARCELA]: TODO } })

/** Los espías de arriba MÁS los dos de la procedencia y la puerta. */
function accionesConTextos() {
  return { ...acciones(), declararProcedencia: vi.fn(), mostrarPuerta: vi.fn() }
}

/**
 * Un store de verdad con una parcela mínima. **No se usa `crearParcela`**: este
 * módulo solo lee `origen`, y construir una parcela válida entera aquí ataría la
 * prueba a invariantes de geometría que no tienen nada que ver con lo que mide.
 */
const storeCon = (origen) => crearEstadoVista({ origen })

// ══════════════════════════════════════════════════════════════════════════════
describe('T9 · 1 · qué cajón permite cada paso', () => {
  it('Diagnóstico trae el suyo, Entrada el de comprobación y los demás ninguno', () => {
    expect(cajonDe(PASO.DIAGNOSTICO)).toBe(CAJON.DIAGNOSTICO)
    expect(cajonDe(PASO.ENTRADA)).toBe(CAJON.COMPROBACION)
    expect(cajonDe(PASO.VALIDACION)).toBe(CAJON.NINGUNO)
    expect(cajonDe(PASO.EDICION)).toBe(CAJON.NINGUNO)
    expect(cajonDe(PASO.INFORME)).toBe(CAJON.NINGUNO)
  })

  it('⭐ los CINCO pasos del modelo tienen respuesta: se recorre `PASOS`, no una lista a mano', () => {
    // Un paso nuevo en `app/navegacion.js` sin decidir qué hace con la esquina
    // saldría aquí, y no en producción con un cajón que se queda como estaba.
    expect(PASOS).toHaveLength(5)
    for (const paso of PASOS) {
      expect(Object.values(CAJON), `el paso «${paso}» no tiene cajón decidido`).toContain(
        cajonDe(paso),
      )
    }
  })

  it('⛔ un paso desconocido devuelve NINGUNO y NO lanza: se llama desde un suscriptor', () => {
    // Reventar dentro de un suscriptor dejaría la esquina en el estado anterior y
    // sin nadie que lo contara. Quien valida los pasos es `app/navegacion.js`.
    expect(() => cajonDe('inventado')).not.toThrow()
    expect(cajonDe('inventado')).toBe(CAJON.NINGUNO)
    expect(cajonDe(undefined)).toBe(CAJON.NINGUNO)
    expect(cajonDe(null)).toBe(CAJON.NINGUNO)
  })

  it('exactamente UN paso abre cada cajón: la exclusión no depende de nadie más', () => {
    const cuenta = (cual) => PASOS.filter((p) => cajonDe(p) === cual).length
    expect(cuenta(CAJON.DIAGNOSTICO)).toBe(1)
    expect(cuenta(CAJON.COMPROBACION)).toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('T9 · 2 · la procedencia, declarada', () => {
  it('⭐ hay un texto por cada `ORIGEN_PARCELA`, recorriendo el MODELO', () => {
    // El guardián anti-caducidad de este módulo. Un origen nuevo en
    // `model/parcela.js` sin texto aquí saldría en pantalla como un renglón
    // vacío, que es la clase de silencio que T9 viene a quitar.
    const origenes = Object.values(ORIGEN_PARCELA)
    expect(origenes.length).toBeGreaterThan(0)
    for (const origen of origenes) {
      expect(PROCEDENCIA[origen], `falta el texto de procedencia de «${origen}»`).toEqual(
        expect.any(String),
      )
      expect(PROCEDENCIA[origen].length).toBeGreaterThan(10)
    }
    // Y ni uno de más: un texto huérfano es un origen que ya no existe.
    expect(Object.keys(PROCEDENCIA).sort()).toEqual([...origenes].sort())
  })

  it('los cinco textos son DISTINTOS: si dos coincidieran, la pantalla no distinguiría nada', () => {
    expect(new Set(Object.values(PROCEDENCIA)).size).toBe(Object.keys(PROCEDENCIA).length)
  })

  it('⛔ en modo COMPROBACIÓN dice que no es tuyo, y nombra la puerta con las palabras del botón', () => {
    const texto = textoProcedencia({ origen: ORIGEN_PARCELA.GML_EXISTENTE, modo: MODO.COMPROBACION })
    expect(texto).toContain(PROCEDENCIA[ORIGEN_PARCELA.GML_EXISTENTE])
    expect(texto).toContain(COLA_EN_COMPROBACION)
    // El nombre de la acción es el MISMO en los tres sitios donde aparece.
    expect(texto).toContain('Tomar esta geometría y editarla')
  })

  it('⭐ y DESPUÉS de cruzar la puerta no reescribe la historia: sigue diciendo de dónde salió', () => {
    // El origen no cambia al cruzar la puerta, y es lo correcto: el dibujo vino de
    // un fichero ajeno y eso no deja de ser verdad porque lo hayas tomado.
    const texto = textoProcedencia({ origen: ORIGEN_PARCELA.GML_EXISTENTE, modo: MODO.NORMAL })
    expect(texto).toContain(PROCEDENCIA[ORIGEN_PARCELA.GML_EXISTENTE])
    expect(texto).toContain(COLA_TOMADA)
    expect(texto).not.toContain(COLA_EN_COMPROBACION)
  })

  it('una geometría propia en modo normal no arrastra ninguna cola', () => {
    const texto = textoProcedencia({ origen: ORIGEN_PARCELA.WFS })
    expect(texto).toBe(PROCEDENCIA[ORIGEN_PARCELA.WFS])
    expect(texto).not.toContain(COLA_TOMADA)
    expect(texto).not.toContain(COLA_EN_COMPROBACION)
  })

  it('…pero comprobar una geometría de CUALQUIER origen lo dice igual', () => {
    // El modo manda sobre el origen: se puede entrar en comprobación con una
    // parcela que vino del Catastro, y callarlo sería peor que repetirlo.
    for (const origen of Object.values(ORIGEN_PARCELA)) {
      expect(textoProcedencia({ origen, modo: MODO.COMPROBACION })).toContain(COLA_EN_COMPROBACION)
    }
  })

  it('⛔ un origen fuera de la tabla NOMBRA el valor en vez de quedarse en blanco', () => {
    const texto = textoProcedencia({ origen: 'CATASTRO_MARCIANO' })
    expect(texto).toBe(mensajeOrigenDesconocido('CATASTRO_MARCIANO'))
    expect(texto).toContain('CATASTRO_MARCIANO')
    expect(texto).not.toContain('undefined')
    // Y sin origen ninguno tampoco devuelve `undefined` ni cadena vacía.
    expect(textoProcedencia({}).length).toBeGreaterThan(10)
    expect(textoProcedencia().length).toBeGreaterThan(10)
  })

  it('⭐ regla de oro 9: ni una palabra de mérito en lo que este módulo escribe', () => {
    const prohibidas = /\b(correcta|correcto|perfecto|válida|válido|aprobado|conforme|apto)\b/i
    const textos = [
      ...Object.values(PROCEDENCIA),
      COLA_EN_COMPROBACION,
      COLA_TOMADA,
      mensajeOrigenDesconocido('X'),
    ].join('\n')
    expect(textos).not.toMatch(prohibidas)
    // Ni Markdown crudo: el panel y el cajón pintan `textContent`.
    expect(textos).not.toContain('**')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('T9 · 3 · el cable con la navegación', () => {
  it('al montar aplica el paso que ya hay: aterrizar en `#/parcela/diagnostico` abre el cajón', () => {
    const a = acciones()
    const c = cablearContraste({ navegacion: navegacionCompleta(PASO.DIAGNOSTICO), ...a })

    expect(a.abrirDiagnostico).toHaveBeenCalledTimes(1)
    expect(a.cerrarComprobacion).toHaveBeenCalledTimes(1)
    expect(c.get()).toBe(CAJON.DIAGNOSTICO)
    c.destruir()
  })

  it('…y arrancando en Entrada no abre nada: el cajón de comprobación lo abre el fichero', () => {
    const a = acciones()
    const c = cablearContraste({ navegacion: navegacionCompleta(), ...a })

    expect(a.abrirDiagnostico).not.toHaveBeenCalled()
    // No se cierra el de comprobación: en Entrada es donde puede estar abierto.
    expect(a.cerrarComprobacion).not.toHaveBeenCalled()
    expect(c.get()).toBe(CAJON.COMPROBACION)
    c.destruir()
  })

  it('⛔ navegar a Diagnóstico abre el suyo y CIERRA el de comprobación, en ese orden', () => {
    const orden = []
    const nav = navegacionCompleta()
    const c = cablearContraste({
      navegacion: nav,
      abrirDiagnostico: () => orden.push('abrir-diagnostico'),
      cerrarDiagnostico: () => orden.push('cerrar-diagnostico'),
      cerrarComprobacion: () => orden.push('cerrar-comprobacion'),
    })
    orden.length = 0

    expect(nav.navegarAPaso(PASO.DIAGNOSTICO).ok).toBe(true)
    // Cerrar va ANTES de abrir: los dos comparten esquina y abrir primero los
    // apilaría en vertical durante un fotograma.
    expect(orden).toEqual(['cerrar-comprobacion', 'abrir-diagnostico'])
    c.destruir()
  })

  it('salir de Diagnóstico cierra su cajón', () => {
    const a = acciones()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, ...a })
    a.cerrarDiagnostico.mockClear()

    nav.navegarAPaso(PASO.EDICION)
    expect(a.cerrarDiagnostico).toHaveBeenCalledTimes(1)
    expect(c.get()).toBe(CAJON.NINGUNO)
    c.destruir()
  })

  it('⭐ NO reabre el cajón en notificaciones del mismo paso: `abrir` pide vecinas por RED', () => {
    // El defecto que esta prueba impide: `abrirDiagnostico` llama a `pedirVecinas`,
    // así que reaccionar a cada aviso del store —y el store avisa en cada tecla de
    // la edición— dispararía una petición al Catastro por pulsación.
    const a = acciones()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, ...a })
    expect(a.abrirDiagnostico).toHaveBeenCalledTimes(1)

    // Tres avisos que NO cambian el paso: hechos nuevos y una navegación redundante.
    nav.actualizarHechos({ geometria: true })
    nav.actualizarHechos({ oficial: true })
    nav.navegarAPaso(PASO.DIAGNOSTICO)

    expect(a.abrirDiagnostico).toHaveBeenCalledTimes(1)
    c.destruir()
  })

  it('…y volver a Diagnóstico después de salir SÍ lo reabre', () => {
    // La otra mitad: si la guarda de arriba fuera «abrir una sola vez en la vida»,
    // el usuario que vuelve encontraría la esquina vacía.
    const a = acciones()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, ...a })

    nav.navegarAPaso(PASO.VALIDACION)
    nav.navegarAPaso(PASO.DIAGNOSTICO)
    expect(a.abrirDiagnostico).toHaveBeenCalledTimes(2)
    c.destruir()
  })

  it('cruzar la puerta no toca la esquina: el modo no mueve el paso', () => {
    const a = acciones()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    nav.entrarEnComprobacion()
    const c = cablearContraste({ navegacion: nav, ...a })
    a.abrirDiagnostico.mockClear()

    expect(nav.abrirPuerta().ok).toBe(true)
    expect(a.abrirDiagnostico).not.toHaveBeenCalled()
    expect(c.get()).toBe(CAJON.DIAGNOSTICO)
    c.destruir()
  })

  it('`destruir()` da de baja y es IDEMPOTENTE', () => {
    const a = acciones()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, ...a })
    a.cerrarDiagnostico.mockClear()

    c.destruir()
    nav.navegarAPaso(PASO.VALIDACION)
    expect(a.cerrarDiagnostico).not.toHaveBeenCalled()
    expect(() => c.destruir()).not.toThrow()
  })

  it('sin `navegacion` revienta AL CABLEAR, nombrando lo que espera', () => {
    expect(() => cablearContraste()).toThrow(/navegacion/)
    expect(() => cablearContraste({ navegacion: {} })).toThrow(/navegacion/)
  })

  it('las acciones son todas opcionales: una pantalla sin cajones sigue navegando', () => {
    const nav = navegacionCompleta()
    const c = cablearContraste({ navegacion: nav })
    expect(() => nav.navegarAPaso(PASO.DIAGNOSTICO)).not.toThrow()
    expect(c.get()).toBe(CAJON.DIAGNOSTICO)
    c.destruir()
  })

  it('un `estado` que no es un store revienta AL CABLEAR', () => {
    expect(() => cablearContraste({ navegacion: navegacionCompleta(), estado: {} })).toThrow(
      /estado/,
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('T9 · 4 · la procedencia y la puerta, cableadas', () => {
  it('⛔ declara de quién es la geometría en cuanto se monta', () => {
    const a = accionesConTextos()
    const c = cablearContraste({
      navegacion: navegacionCompleta(PASO.DIAGNOSTICO),
      estado: storeCon(ORIGEN_PARCELA.WFS),
      ...a,
    })
    expect(a.declararProcedencia).toHaveBeenCalledWith(PROCEDENCIA[ORIGEN_PARCELA.WFS])
    expect(c.procedencia()).toBe(PROCEDENCIA[ORIGEN_PARCELA.WFS])
    c.destruir()
  })

  it('⭐ y la REESCRIBE cuando entra otra parcela: sin esto hablaría de la anterior', () => {
    // El defecto concreto: contrastar el GML de otro mete una parcela nueva en el
    // MISMO store, y sin escuchar al store el renglón seguiría diciendo «traído del
    // Catastro» sobre la geometría de un desconocido.
    const a = accionesConTextos()
    const store = storeCon(ORIGEN_PARCELA.WFS)
    const c = cablearContraste({
      navegacion: navegacionCompleta(PASO.DIAGNOSTICO),
      estado: store,
      ...a,
    })

    store.set({ origen: ORIGEN_PARCELA.GML_EXISTENTE })
    expect(c.procedencia()).toContain(PROCEDENCIA[ORIGEN_PARCELA.GML_EXISTENTE])
    c.destruir()
  })

  it('sin parcela en el store el renglón se VACÍA: no se habla de lo que no está', () => {
    const a = accionesConTextos()
    const store = storeCon(ORIGEN_PARCELA.WFS)
    const c = cablearContraste({
      navegacion: navegacionCompleta(PASO.DIAGNOSTICO),
      estado: store,
      ...a,
    })

    store.set(null)
    expect(c.procedencia()).toBe('')
    c.destruir()
  })

  it('⛔ la puerta SOLO se enseña en modo comprobación y con geometría delante', () => {
    const a = accionesConTextos()
    const store = storeCon(ORIGEN_PARCELA.GML_EXISTENTE)
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, estado: store, ...a })

    // Modo normal: no aplica, y no se apaga — se esconde.
    expect(a.mostrarPuerta).toHaveBeenLastCalledWith(false)

    nav.entrarEnComprobacion()
    expect(a.mostrarPuerta).toHaveBeenLastCalledWith(true)

    // Sin geometría no hay nada que tomar, aunque el modo lo pida.
    store.set(null)
    expect(a.mostrarPuerta).toHaveBeenLastCalledWith(false)
    c.destruir()
  })

  it('⭐ pulsar la puerta cruza el modo de verdad, y el renglón lo dice al instante', () => {
    let alPulsar = null
    const a = accionesConTextos()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    nav.entrarEnComprobacion()
    const c = cablearContraste({
      navegacion: nav,
      estado: storeCon(ORIGEN_PARCELA.GML_EXISTENTE),
      ...a,
      suscribirPuerta: (fn) => {
        alPulsar = fn
        return () => {
          alPulsar = null
        }
      },
    })
    expect(c.procedencia()).toContain(COLA_EN_COMPROBACION)

    alPulsar()

    expect(nav.get().modo).toBe(MODO.NORMAL)
    // Y no se queda diciendo lo de antes: el renglón es de `role="status"` y lo
    // que anuncia tiene que ser lo que acaba de pasar.
    expect(c.procedencia()).toContain(COLA_TOMADA)
    expect(c.procedencia()).not.toContain(COLA_EN_COMPROBACION)
    expect(a.mostrarPuerta).toHaveBeenLastCalledWith(false)
    c.destruir()
  })

  it('`destruir()` se da de baja de las TRES: navegación, store y puerta', () => {
    let alPulsar = null
    let dadoDeBaja = false
    const a = accionesConTextos()
    const store = storeCon(ORIGEN_PARCELA.WFS)
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({
      navegacion: nav,
      estado: store,
      ...a,
      suscribirPuerta: (fn) => {
        alPulsar = fn
        return () => {
          dadoDeBaja = true
        }
      },
    })

    c.destruir()
    a.declararProcedencia.mockClear()
    store.set({ origen: ORIGEN_PARCELA.DXF })
    nav.navegarAPaso(PASO.VALIDACION)

    expect(a.declararProcedencia).not.toHaveBeenCalled()
    expect(dadoDeBaja).toBe(true)
    // Y el manejador de la puerta, si llegara tarde, no mueve nada.
    nav.entrarEnComprobacion()
    alPulsar()
    expect(nav.get().modo).toBe(MODO.COMPROBACION)
  })

  it('sin store no lanza y declara vacío: montar sin parcela es un montaje válido', () => {
    const a = accionesConTextos()
    const c = cablearContraste({ navegacion: navegacionCompleta(PASO.DIAGNOSTICO), ...a })
    expect(c.procedencia()).toBe('')
    expect(a.mostrarPuerta).toHaveBeenLastCalledWith(false)
    c.destruir()
  })
})
