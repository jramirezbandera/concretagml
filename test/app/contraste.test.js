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
 *      (el modelo). También pura.                                              *
 *                                                                              *
 * Y el comportamiento del cable, con la navegación DE VERDAD y no un doble —la  *
 * misma doctrina que el resto de `test/app/`: lo que se prueba es el CABLE—.    *
 * Los cajones sí son dobles, porque son de Leaflet y viven en `viewer/`.        *
 * -------------------------------------------------------------------------- */

import { describe, expect, it, vi } from 'vitest'

import {
  CAJON,
  COLA_GML_EXISTENTE,
  PROCEDENCIA,
  cablearContraste,
  cajonDe,
  mensajeOrigenDesconocido,
  textoProcedencia,
} from '../../app/contraste.js'
import { PASO, PASOS, RAMA, crearNavegacion } from '../../app/navegacion.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'
import { crearEstadoVista } from '../../viewer/_comun.js'

/** Hechos con los que los cinco pasos de la rama PARCELA se sostienen. */
const TODO = Object.freeze({ geometria: true, oficial: true })

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

/** Los espías de arriba MÁS el de la procedencia. */
function accionesConTextos() {
  return { ...acciones(), declararProcedencia: vi.fn() }
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
    expect(cajonDe(PASO.EDICION)).toBe(CAJON.NINGUNO)
    expect(cajonDe(PASO.EDICION)).toBe(CAJON.NINGUNO)
    expect(cajonDe(PASO.INFORME)).toBe(CAJON.NINGUNO)
  })

  it('⭐ TODOS los pasos del modelo tienen respuesta: se recorre `PASOS`, no una lista a mano', () => {
    // Un paso nuevo en `app/navegacion.js` sin decidir qué hace con la esquina
    // saldría aquí, y no en producción con un cajón que se queda como estaba.
    // ⭐ Decía CINCO y dice TRES desde el 2026-08-08: el rail perdió «Validación»
    // e «Informe». La cifra se afirma igualmente —y no se sustituye por
    // `PASOS.length`— porque su trabajo es que un paso nuevo obligue a pasar por
    // aquí a decidir qué hace con la esquina del mapa.
    expect(PASOS).toHaveLength(3)
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

  // ── ⭐ F14 · el segundo eje ────────────────────────────────────────────────

  it('⭐ F14 · en la rama EDIFICIO, Diagnóstico trae el cajón de CONTRASTE', () => {
    // El defecto que esto cierra está MEDIDO en Chrome (fase 4a): con los peldaños
    // recién abiertos, `#/edificio/diagnostico` montaba `.gml-cajon-diagnostico`
    // —el de PARCELA, 367 × 413 px— encima de una construcción. El peldaño estaba
    // abierto y enseñaba la pantalla equivocada.
    expect(cajonDe(PASO.DIAGNOSTICO, RAMA.EDIFICIO)).toBe(CAJON.CONTRASTE_EDIFICIO)
    expect(cajonDe(PASO.DIAGNOSTICO, RAMA.PARCELA)).toBe(CAJON.DIAGNOSTICO)
  })

  it('⛔ F14 · la COMPROBACIÓN es de parcela, y en la rama EDIFICIO no aparece', () => {
    // Se entra soltando un `.gml` de parcela en Entrada, y
    // `viewer/cajon-comprobacion.js` lee `ParcelaGml`. En la otra rama esa esquina
    // se queda vacía, que es la verdad y no un hueco.
    expect(cajonDe(PASO.ENTRADA, RAMA.EDIFICIO)).toBe(CAJON.NINGUNO)
    expect(cajonDe(PASO.ENTRADA, RAMA.PARCELA)).toBe(CAJON.COMPROBACION)
  })

  it('sin rama se comporta como PARCELA: es el defecto de la aplicación', () => {
    for (const paso of PASOS) expect(cajonDe(paso)).toBe(cajonDe(paso, RAMA.PARCELA))
    // Y una rama inventada tampoco lanza, por lo mismo que un paso inventado.
    expect(() => cajonDe(PASO.DIAGNOSTICO, 'INVENTADA')).not.toThrow()
    expect(cajonDe(PASO.DIAGNOSTICO, 'INVENTADA')).toBe(CAJON.DIAGNOSTICO)
  })

  it('⭐ los CINCO pasos por las DOS ramas tienen respuesta, y sale del modelo', () => {
    // El mismo guardián anti-caducidad de arriba, ahora sobre el producto de los
    // dos ejes: una rama nueva —o un paso nuevo— sin decidir qué hace con la
    // esquina sale aquí y no en producción.
    const ramas = Object.values(RAMA)
    expect(ramas.length).toBeGreaterThan(1)
    for (const rama of ramas) {
      for (const paso of PASOS) {
        expect(
          Object.values(CAJON),
          `«${paso}» en la rama «${rama}» no tiene cajón decidido`,
        ).toContain(cajonDe(paso, rama))
      }
      // Y en cada rama, como mucho UN paso abre cada cajón: la exclusión de la
      // esquina no puede depender de que dos módulos se pongan de acuerdo.
      for (const cual of Object.values(CAJON)) {
        if (cual === CAJON.NINGUNO) continue
        expect(PASOS.filter((p) => cajonDe(p, rama) === cual).length).toBeLessThanOrEqual(1)
      }
    }
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

  it('⭐ un GML importado arrastra su cola: no es del Catastro y el fichero no se toca', () => {
    const texto = textoProcedencia({ origen: ORIGEN_PARCELA.GML_EXISTENTE })
    expect(texto).toContain(PROCEDENCIA[ORIGEN_PARCELA.GML_EXISTENTE])
    expect(texto).toContain(COLA_GML_EXISTENTE)
    // Las dos afirmaciones que la cola existe para hacer.
    expect(texto).toContain('Catastro')
    expect(texto).toContain('no se modifica')
  })

  it('⛔ y NO dice de quién es el fichero, que es lo que esta aplicación no sabe', () => {
    // Hasta el 2026-08-07 decía «del GML de otro técnico», y era una afirmación
    // sobre la autoría que no hay forma de comprobar: el fichero que se abre es,
    // la mayoría de las veces, el que generó aquí el propio usuario.
    const texto = textoProcedencia({ origen: ORIGEN_PARCELA.GML_EXISTENTE })
    expect(texto).not.toContain('otro técnico')
    expect(texto).not.toContain('ajeno')
  })

  it('una geometría de cualquier otro origen no arrastra ninguna cola', () => {
    for (const origen of Object.values(ORIGEN_PARCELA)) {
      if (origen === ORIGEN_PARCELA.GML_EXISTENTE) continue
      const texto = textoProcedencia({ origen })
      expect(texto).toBe(PROCEDENCIA[origen])
      expect(texto).not.toContain(COLA_GML_EXISTENTE)
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
      COLA_GML_EXISTENTE,
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

    nav.navegarAPaso(PASO.EDICION)
    nav.navegarAPaso(PASO.DIAGNOSTICO)
    expect(a.abrirDiagnostico).toHaveBeenCalledTimes(2)
    c.destruir()
  })

  it('`destruir()` da de baja y es IDEMPOTENTE', () => {
    const a = acciones()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, ...a })
    a.cerrarDiagnostico.mockClear()

    c.destruir()
    nav.navegarAPaso(PASO.EDICION)
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
describe('T9 · 4 · la procedencia, cableada', () => {
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

  /* ⛔ **AQUÍ VIVÍAN LAS TRES PRUEBAS DE LA PUERTA, Y SE FUERON CON ELLA EL
   * 2026-08-07.** Probaban que «Tomar esta geometría y editarla» se enseñaba solo
   * en modo comprobación y con geometría delante, que pulsarla cruzaba el modo de
   * verdad y que `destruir()` daba de baja su oyente. **Las tres pasaban.** Lo que
   * ninguna podía ver es que el botón vivía en el cajón de Diagnóstico, y que en el
   * caso corriente ese paso estaba apagado por falta de parcelario: el CTA existía,
   * respondía y no había forma de llegar a él. Ver la cabecera de
   * `app/navegacion.js`. */

  it('`destruir()` se da de baja de las DOS: navegación y store', () => {
    const a = accionesConTextos()
    const store = storeCon(ORIGEN_PARCELA.WFS)
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({ navegacion: nav, estado: store, ...a })

    c.destruir()
    a.declararProcedencia.mockClear()
    store.set({ origen: ORIGEN_PARCELA.DXF })
    nav.navegarAPaso(PASO.EDICION)

    expect(a.declararProcedencia).not.toHaveBeenCalled()
  })

  it('sin store no lanza y declara vacío: montar sin parcela es un montaje válido', () => {
    const a = accionesConTextos()
    const c = cablearContraste({ navegacion: navegacionCompleta(PASO.DIAGNOSTICO), ...a })
    expect(c.procedencia()).toBe('')
    expect(a.declararProcedencia).toHaveBeenLastCalledWith('')
    c.destruir()
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Rework de UI · rebanada 4 · EL CAJÓN DE DIAGNÓSTICO ES LA PANTALLA
//
// ⛔ EL DEFECTO QUE ESTAS PRUEBAS CIERRAN, MEDIDO EN CHROME EL 2026-08-05:
// llegar a Diagnóstico por el peldaño del rail dejaba la pantalla VACÍA. El cajón
// se abría y su propio guardián de clic-fuera lo cerraba en el mismo gesto,
// porque el clic del rail no es el evento de apertura —la navegación no lleva
// eventos de DOM, y no debe—. Sin error, sin aviso y sin forma de recuperarlo
// desde el rail: navegar al paso en el que ya estás no publica nada.
//
// La corrección tiene DOS mitades y las dos se prueban aquí, porque las dos son
// del cable: QUÉ se le dice al cajón, y CUÁNDO.
// ───────────────────────────────────────────────────────────────────────────────
describe('app/contraste.js · el cajón de diagnóstico es la PANTALLA (rebanada 4)', () => {
  it('declara pantalla al entrar en Diagnóstico y cajón al salir', () => {
    const a = accionesConTextos()
    const fijar = vi.fn()
    const nav = navegacionCompleta(PASO.EDICION)
    const c = cablearContraste({
      navegacion: nav,
      ...a,
      fijarDiagnosticoComoPantalla: fijar,
    })

    // El arranque ya lo declara: aterrizar por hash en Diagnóstico no pasa por
    // ninguna transición, y sin esto el primer clic en el mapa borraría la pantalla.
    expect(fijar).toHaveBeenLastCalledWith(false)

    nav.navegarAPaso(PASO.DIAGNOSTICO)
    expect(fijar).toHaveBeenLastCalledWith(true)

    nav.navegarAPaso(PASO.EDICION)
    expect(fijar).toHaveBeenLastCalledWith(false)
    c.destruir()
  })

  it('⛔ lo declara ANTES de abrirlo, que es lo único que evita el defecto', () => {
    // El orden es la corrección entera. Si se abriera primero, el cajón quedaría
    // descartable exactamente durante el gesto que lo abrió —el clic del rail, que
    // sigue burbujeando hacia el `document`— y se cerraría solo.
    const orden = []
    const nav = navegacionCompleta(PASO.EDICION)
    const c = cablearContraste({
      navegacion: nav,
      declararProcedencia: vi.fn(),
      cerrarDiagnostico: () => orden.push('cerrar'),
      cerrarComprobacion: vi.fn(),
      abrirDiagnostico: () => orden.push('abrir'),
      fijarDiagnosticoComoPantalla: (v) => orden.push(`pantalla:${v}`),
    })
    orden.length = 0

    nav.navegarAPaso(PASO.DIAGNOSTICO)

    expect(orden).toEqual(['pantalla:true', 'abrir'])
    expect(orden.indexOf('pantalla:true')).toBeLessThan(orden.indexOf('abrir'))
    c.destruir()
  })

  it('el cajón de COMPROBACIÓN se queda como estaba: Entrada no declara pantalla', () => {
    // No es una omisión: aquél SÍ es un cajón —la respuesta pasajera a soltar un
    // `.gml` en Entrada— y descartarlo tocando fuera es lo correcto.
    const a = accionesConTextos()
    const fijar = vi.fn()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({
      navegacion: nav,
      ...a,
      fijarDiagnosticoComoPantalla: fijar,
    })
    expect(fijar).toHaveBeenLastCalledWith(true)

    nav.navegarAPaso(PASO.ENTRADA)

    expect(cajonDe(PASO.ENTRADA)).toBe(CAJON.COMPROBACION)
    expect(fijar).toHaveBeenLastCalledWith(false)
    c.destruir()
  })

  it('el ✕ en modo pantalla SALE a Validación en vez de dejar la pantalla vacía', () => {
    let alSalir = null
    const a = accionesConTextos()
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({
      navegacion: nav,
      ...a,
      suscribirSalida: (fn) => {
        alSalir = fn
        return () => {
          alSalir = null
        }
      },
    })
    expect(nav.get().paso).toBe(PASO.DIAGNOSTICO)

    alSalir()

    expect(nav.get().paso).toBe(PASO.EDICION)
    // Y el cajón se cierra por el camino de siempre, el de la transición.
    expect(a.cerrarDiagnostico).toHaveBeenCalled()
    c.destruir()
  })

  // ⚠️ AQUÍ HUBO UNA PRUEBA QUE PASABA POR EL MOTIVO EQUIVOCADO, Y SE ANOTA.
  // Intentaba ejercitar el respaldo («si Validación no se sostiene, se sale a
  // Entrada») quitándole los hechos a la navegación. Pasaba en verde, y la
  // aserción anti-vacuidad destapó por qué: **quitar los hechos ya mueve el paso a
  // Entrada por su cuenta**, así que el respaldo no llegaba a correr y la prueba
  // afirmaba el trabajo de otro. La sustituye ésta, que dice la verdad: con la
  // autoridad de verdad ese camino NO SE PUEDE andar, y lo que se prueba es
  // exactamente el invariante que lo hace inalcanzable.
  it('desde Diagnóstico, Validación SIEMPRE se sostiene: el respaldo es inalcanzable', () => {
    // Se recorren todos los conjuntos de hechos con los que Diagnóstico se aguanta
    // —sin escribir la lista: sale del modelo— y en todos tiene que poderse volver.
    const combinaciones = [
      { geometria: true, oficial: true },
      { geometria: true, oficial: true },
    ]
    let probadas = 0
    for (const hechos of combinaciones) {
      const nav = crearNavegacion({
        rama: RAMA.PARCELA,
        paso: PASO.ENTRADA,
        hechos: { [RAMA.PARCELA]: hechos },
      })
      if (!nav.navegarAPaso(PASO.DIAGNOSTICO).ok) continue
      probadas += 1
      expect(
        nav.puedeIrA(PASO.EDICION).disponible,
        `estando en Diagnóstico con ${JSON.stringify(hechos)} hay que poder volver a Validación`,
      ).toBe(true)
    }
    // ANTI-VACUIDAD: si ninguna combinación llegara a Diagnóstico, el bucle no
    // afirmaría nada y esta prueba sería un adorno.
    expect(
      probadas,
      'ninguna combinación llegó a Diagnóstico: la prueba no medía nada',
    ).toBeGreaterThan(0)
  })

  it('`destruir()` también se da de baja de la salida', () => {
    let alSalir = null
    let dadoDeBaja = false
    const nav = navegacionCompleta(PASO.DIAGNOSTICO)
    const c = cablearContraste({
      navegacion: nav,
      ...accionesConTextos(),
      suscribirSalida: (fn) => {
        alSalir = fn
        return () => {
          dadoDeBaja = true
        }
      },
    })

    c.destruir()
    alSalir()

    expect(dadoDeBaja).toBe(true)
    expect(nav.get().paso).toBe(PASO.DIAGNOSTICO)
  })

  it('sin los dos cables nuevos no lanza: montar sin ellos es un montaje válido', () => {
    // `viewer/` puede quedarse atrás y esto no puede reventar la aplicación entera.
    const nav = navegacionCompleta(PASO.EDICION)
    const c = cablearContraste({ navegacion: nav, ...accionesConTextos() })
    expect(() => nav.navegarAPaso(PASO.DIAGNOSTICO)).not.toThrow()
    c.destruir()
  })
})
