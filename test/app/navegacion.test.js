/* -------------------------------------------------------------------------- *
 * test/app/navegacion.test.js — Rework de UI · T1 · autoridad de navegación    *
 *                                                                              *
 * `app/navegacion.js` es el dueño único de `{rama, paso, modo}` y **no toca el  *
 * DOM**. Este fichero vive en el proyecto Vitest `node` justamente por eso: si  *
 * el módulo consultara `document` o `window` en algún camino, aquí no habría    *
 * ninguno que consultar y la prueba saldría roja. Es el guardián más barato que *
 * tiene la regla, y por eso el fichero NO se llama `.dom.test.js`.              *
 *                                                                              *
 * Lo que de verdad se vigila aquí son tres cosas, y solo la primera es obvia:   *
 *                                                                              *
 *   1. Que las guardas digan que sí y que no donde toca.                        *
 *   2. **Que ningún paso se apague en silencio.** Se recorren las 32            *
 *      situaciones posibles (2 ramas × 2 modos × 8 combinaciones de hechos) por *
 *      los 5 pasos —160 veredictos— y se exige que TODO bloqueo traiga causa y  *
 *      motivo en español. Es el criterio 3 del plan, y es la mitad del producto *
 *      de este módulo: el rail no es una lista de botones, es una lista de      *
 *      explicaciones.                                                           *
 *   3. **Que una errata en un hecho LANCE.** `geomtria: true` aceptado en       *
 *      silencio dejaría cuatro pasos apagados sin razón visible y la suite en   *
 *      verde, que es exactamente la clase de fallo mudo que este repositorio    *
 *      lleva once fases persiguiendo.                                           *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'

import {
  CAUSA,
  CLAVES_HECHOS,
  HECHOS_VACIOS,
  MENSAJE_SIN_CONVERGER,
  MODO,
  MODOS,
  MOTIVO_DATO,
  MOTIVO_DATO_EDIFICIO,
  MOTIVO_MODO,
  MOTIVO_RAMA,
  MOTIVO_SIN_PUERTA,
  PASO,
  PASOS,
  RAMA,
  RAMAS,
  ROTULO_PASO,
  ROTULO_PUERTA,
  TOPE_RECONCILIACION,
  crearNavegacion,
  evaluarPaso,
  leerRuta,
  mensajeAterrizaje,
  rutaDe,
} from '../../app/navegacion.js'
import { RAMA as RAMA_DESDE_RAMA, RAMAS as RAMAS_DESDE_RAMA } from '../../app/rama.js'

const RAIZ = join(import.meta.dirname, '..', '..')

/** Todas las combinaciones de los tres hechos: 2³ = 8. Escrito así y no a mano
 *  para que añadir un hecho a {@link CLAVES_HECHOS} amplíe la rejilla solo. */
const COMBINACIONES_DE_HECHOS = Array.from({ length: 2 ** CLAVES_HECHOS.length }, (_, mascara) =>
  Object.fromEntries(CLAVES_HECHOS.map((clave, i) => [clave, Boolean(mascara & (1 << i))])),
)

/** Las 32 situaciones posibles. */
const SITUACIONES = RAMAS.flatMap((rama) =>
  MODOS.flatMap((modo) => COMBINACIONES_DE_HECHOS.map((hechos) => ({ rama, modo, hechos }))),
)

/** Una navegación con todo desbloqueado, para las pruebas que no van de guardas.
 *  El avisador va a un sumidero salvo que la prueba pida otro: el canal por
 *  defecto escribe por `console.warn`, y una suite de casi seis mil pruebas no
 *  puede permitirse ensuciar la salida cada vez que un paso se cae. Hay un `it`
 *  aparte que sí comprueba ese canal por defecto. */
const navegacionCompleta = (extra = {}) =>
  crearNavegacion({
    hechos: { geometria: true, oficial: true, diagnostico: true },
    avisar: () => {},
    ...extra,
  })

// ─────────────────────────────────────────────────────────────────────────────

describe('T1 · el vocabulario se declara UNA vez', () => {
  it('`app/rama.js` REEXPORTA `RAMA` y `RAMAS`, no las redefine', () => {
    // No basta con `toEqual`: dos objetos con el mismo contenido son justo lo que
    // este `it` existe para prohibir. Se exige la MISMA referencia.
    expect(RAMA_DESDE_RAMA).toBe(RAMA)
    expect(RAMAS_DESDE_RAMA).toBe(RAMAS)
  })

  it('el fuente de `app/rama.js` ya no declara ninguna de las dos', () => {
    const fuente = readFileSync(join(RAIZ, 'app', 'rama.js'), 'utf8')
    expect(fuente).not.toMatch(/^export const RAMAS? =/m)
    expect(fuente).toMatch(/from '\.\/navegacion\.js'/)
  })

  it('los valores de rama siguen siendo los del `data-rama` del marcado (contrato G)', () => {
    expect(RAMA).toEqual({ PARCELA: 'PARCELA', EDIFICIO: 'EDIFICIO' })
    expect(RAMAS).toEqual(['PARCELA', 'EDIFICIO'])
  })

  it('los pasos van en minúscula porque se escriben en la URL', () => {
    for (const paso of PASOS) expect(paso).toBe(paso.toLowerCase())
    expect(PASOS).toEqual(['entrada', 'validacion', 'edicion', 'diagnostico', 'informe'])
  })

  it('los cinco pasos tienen rótulo, y ninguno sobra', () => {
    expect(Object.keys(ROTULO_PASO).sort()).toEqual([...PASOS].sort())
    for (const paso of PASOS) expect(ROTULO_PASO[paso]).toMatch(/\S/)
  })

  it('el vocabulario está congelado (nadie le añade una rama por la puerta de atrás)', () => {
    for (const congelado of [RAMA, RAMAS, PASO, PASOS, MODO, MODOS, CAUSA, HECHOS_VACIOS]) {
      expect(Object.isFrozen(congelado)).toBe(true)
    }
  })
})

describe('T1 · el módulo no toca el DOM', () => {
  it('el entorno de este proyecto NO tiene DOM, y aun así la API entera funciona', () => {
    // Si alguna rama del módulo consultara `document`, esto reventaría aquí.
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')

    const nav = navegacionCompleta()
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    expect(nav.navegarAPaso(PASO.DIAGNOSTICO).ok).toBe(true)
    expect(nav.rail()).toHaveLength(PASOS.length)
    expect(nav.ruta()).toBe('#/parcela/diagnostico')
    expect(nav.irARuta('#/parcela/validacion').ok).toBe(true)
    expect(nav.cambiarRama(RAMA.EDIFICIO).ok).toBe(false)
    expect(nav.hechosDe(RAMA.EDIFICIO)).toEqual(HECHOS_VACIOS)
    expect(nav.entrarEnComprobacion().ok).toBe(true)
    expect(nav.abrirPuerta().ok).toBe(true)
    expect(nav.puedeIrA(PASO.EDICION).disponible).toBe(true)
    // Entrada no tiene guardas, así que perder el dato no la tira: `ok` es true.
    expect(nav.actualizarHechos({ geometria: false }).ok).toBe(true)
  })

  it('el fuente no nombra `document`, `window` ni `location` fuera de los comentarios', () => {
    const fuente = readFileSync(join(RAIZ, 'app', 'navegacion.js'), 'utf8')
    const codigo = fuente
      .replace(/\/\*[\s\S]*?\*\//g, '') // bloques y JSDoc
      .replace(/^\s*\/\/.*$/gm, '') // líneas de comentario
    for (const prohibido of ['document', 'window.', 'location', 'localStorage']) {
      expect(codigo).not.toContain(prohibido)
    }
    // Y el guardián no es vacuo: sobre el fichero SIN limpiar, `location` sí está
    // (la cabecera lo menciona), así que el limpiado es lo que hace el trabajo.
    expect(fuente).toContain('location')
  })
})

describe('T1 · las guardas — `evaluarPaso` es la única que decide', () => {
  it('Entrada está disponible SIEMPRE, en las 32 situaciones', () => {
    for (const situacion of SITUACIONES) {
      expect(evaluarPaso(PASO.ENTRADA, situacion)).toEqual({
        disponible: true,
        causa: null,
        motivo: null,
      })
    }
  })

  it('⭐ CERO PASOS APAGADOS EN SILENCIO: los 160 veredictos traen causa y motivo', () => {
    let bloqueos = 0
    for (const situacion of SITUACIONES) {
      for (const paso of PASOS) {
        const veredicto = evaluarPaso(paso, situacion)
        if (veredicto.disponible) {
          expect(veredicto.causa).toBeNull()
          expect(veredicto.motivo).toBeNull()
          continue
        }
        bloqueos += 1
        expect(Object.values(CAUSA)).toContain(veredicto.causa)
        expect(typeof veredicto.motivo).toBe('string')
        expect(veredicto.motivo.trim().length).toBeGreaterThan(0)
      }
    }
    // No es un `expect` decorativo: si un día la tabla se relajara y no bloqueara
    // nada, el bucle de arriba pasaría en verde sin haber comprobado nada.
    expect(bloqueos).toBeGreaterThan(0)
  })

  it('los motivos caben en un rail de 210 px (ninguno pasa de 90 caracteres)', () => {
    // La maqueta midió estos motivos en 14–27 px de alto a 1280×720. El tope no
    // es estético: alargarlos empuja la ficha del pie del rail fuera de pantalla,
    // que es el defecto que este rework viene a arreglar.
    const todos = [
      ...Object.values(MOTIVO_RAMA),
      ...Object.values(MOTIVO_MODO),
      ...Object.values(MOTIVO_DATO),
      ...Object.values(MOTIVO_DATO_EDIFICIO),
    ]
    expect(todos.length).toBeGreaterThan(0)
    for (const motivo of todos) expect(motivo.length).toBeLessThanOrEqual(90)
  })

  it('el orden de las causas es RAMA → MODO → DATO, y se ve con las dos que quedan', () => {
    // ⛔ **Este `it` ha perdido su primer escalón, y hay que decirlo.** Se probaba
    // con DIAGNÓSTICO porque era el paso que aún se apagaba por RAMA; **F14 abre
    // los cinco peldaños en las dos ramas**, así que ya NO HAY ningún paso con el
    // que enseñar la causa RAMA sobre datos reales, y `MOTIVO_RAMA` está vacío.
    //
    // La compuerta sigue en el código y sigue siendo la primera: lo que se prueba
    // aquí es el orden de las dos que quedan vivas, y el de la primera se prueba
    // en `evaluarPaso` con una regla FABRICADA, más abajo. Aflojar esto a «MODO →
    // DATO» sin decir por qué dejaría la impresión de que el orden cambió.
    const todoEnContra = {
      rama: RAMA.PARCELA,
      modo: MODO.COMPROBACION,
      hechos: { ...HECHOS_VACIOS },
    }

    // El escalón del MODO se ve en Edición, que es el paso que lo tiene.
    expect(evaluarPaso(PASO.EDICION, todoEnContra).causa).toBe(CAUSA.MODO)

    // Quitado el modo, manda el dato.
    expect(evaluarPaso(PASO.EDICION, { ...todoEnContra, modo: MODO.NORMAL }).causa).toBe(
      CAUSA.DATO,
    )

    // Y con la rama EDIFICIO —donde ya no hay compuerta de rama— el diagnóstico
    // cae por DATO y no por RAMA, que es justo el cambio de F14.
    expect(
      evaluarPaso(PASO.DIAGNOSTICO, {
        rama: RAMA.EDIFICIO,
        modo: MODO.NORMAL,
        hechos: { ...HECHOS_VACIOS },
      }).causa,
    ).toBe(CAUSA.DATO)
  })

  it('cuando faltan dos hechos se nombra el primero que el usuario puede resolver', () => {
    const veredicto = evaluarPaso(PASO.DIAGNOSTICO, {
      rama: RAMA.PARCELA,
      modo: MODO.NORMAL,
      hechos: { ...HECHOS_VACIOS },
    })
    // Faltan `geometria` Y `oficial`; se dice «trae antes una parcela», no
    // «falta el parcelario», porque sin parcela lo segundo no se puede ni pedir.
    expect(veredicto.motivo).toBe(MOTIVO_DATO.geometria)
  })

  it('Edición NO exige que la validación haya pasado (o el usuario no podría arreglar sus errores)', () => {
    // Hay geometría y nada más: no hay oficial, no hay diagnóstico, y F02 podría
    // estar devolviendo `puedeGenerar: false`. Editar es lo que lo arregla.
    const veredicto = evaluarPaso(PASO.EDICION, {
      rama: RAMA.PARCELA,
      modo: MODO.NORMAL,
      hechos: { ...HECHOS_VACIOS, geometria: true },
    })
    expect(veredicto.disponible).toBe(true)
  })

  it('⭐ F14 · en la rama EDIFICIO están ya LOS CINCO peldaños', () => {
    // ⛔ **Hasta el 2026-08-07 este `it` afirmaba lo contrario**: que Diagnóstico e
    // Informe se apagaban por RAMA, con sus dos motivos. Era verdad, y **F14 es la
    // fase que lo vuelve falso** — trae `diagnostico/edificio.js` y
    // `report/pdf-edificio.js`—. Se reescribe aquí, que es donde está la causa, y
    // no se «arregla» aflojando la aserción.
    const enEdificio = {
      rama: RAMA.EDIFICIO,
      modo: MODO.NORMAL,
      hechos: { geometria: true, oficial: false, diagnostico: false },
    }
    for (const paso of PASOS) {
      expect(evaluarPaso(paso, enEdificio).disponible, `el paso ${paso}`).toBe(true)
    }
  })

  it('⭐ F14 · y el Diagnóstico de EDIFICIO no exige el parcelario, a propósito', () => {
    // La decisión que hace alcanzable la pantalla honesta. En PARCELA el
    // diagnóstico exige `oficial` porque sin parcelario no hay nada que
    // contrastar; en EDIFICIO **no**, porque su caso estrella —la obra nueva, «no
    // consta construcción registrada»— es precisamente aquel en el que no hay
    // huella oficial. Exigirla dejaría esa pantalla escrita, probada y sin forma
    // de llegar a ella: la trampa de `MOTIVO_SIN_EDIFICIO` en F13.
    const soloGeometria = { geometria: true, oficial: false, diagnostico: false }

    expect(
      evaluarPaso(PASO.DIAGNOSTICO, {
        rama: RAMA.EDIFICIO,
        modo: MODO.NORMAL,
        hechos: soloGeometria,
      }).disponible,
    ).toBe(true)

    // Y en PARCELA, con los mismos hechos, sigue exigiéndolo.
    const enParcela = evaluarPaso(PASO.DIAGNOSTICO, {
      rama: RAMA.PARCELA,
      modo: MODO.NORMAL,
      hechos: soloGeometria,
    })
    expect(enParcela.disponible).toBe(false)
    expect(enParcela.causa).toBe(CAUSA.DATO)
  })

  it('⭐ F14 · el Informe de EDIFICIO no exige diagnóstico: sale «solo declarativo»', () => {
    // Ficha §17: «si no [hubo contraste], informe solo declarativo, sin sección de
    // contraste». El informe de construcción se sostiene con la construcción.
    const sinDiagnostico = { geometria: true, oficial: false, diagnostico: false }

    expect(
      evaluarPaso(PASO.INFORME, {
        rama: RAMA.EDIFICIO,
        modo: MODO.NORMAL,
        hechos: sinDiagnostico,
      }).disponible,
    ).toBe(true)

    // En PARCELA el informe firma un diagnóstico, y sin él no hay qué firmar.
    expect(
      evaluarPaso(PASO.INFORME, {
        rama: RAMA.PARCELA,
        modo: MODO.NORMAL,
        hechos: sinDiagnostico,
      }).disponible,
    ).toBe(false)
  })

  it('⛔ F14 · la tabla de motivos de RAMA está VACÍA, y es a propósito', () => {
    // No es un olvido ni una tabla a medio rellenar: **no queda ninguna limitación
    // por rama que declarar**. La compuerta se conserva como mecanismo —el día que
    // haga falta otra vez tiene que estar— pero una FRASE falsa no se conserva.
    // Si alguien la rellena «por simetría», esto se pone rojo y le manda a leer el
    // comentario de `app/navegacion.js`.
    expect(Object.keys(MOTIVO_RAMA)).toEqual([])
  })

  it('⭐ F12 · y EDICIÓN también: esta versión ya edita construcciones', () => {
    // ⛔ **Hasta el 2026-08-06 este paso era de la rama PARCELA y nada más**, con
    // el motivo «esta versión edita parcelas, todavía no construcciones». F12 es
    // la fase que lo deja de ser, y con el peldaño apagado **todo el motor de
    // edición de la parte activa era inalcanzable en producción**: nadie llamaría
    // nunca a `cablearEdificio().edicion(true)`. Lo destapó una prueba de T4.2 al
    // intentar navegar hasta aquí.
    const enEdificio = {
      rama: RAMA.EDIFICIO,
      modo: MODO.NORMAL,
      hechos: { geometria: true, oficial: false, diagnostico: false },
    }
    expect(evaluarPaso(PASO.EDICION, enEdificio).disponible).toBe(true)
    // Y la frase caducada NO se queda a envejecer en el objeto de motivos.
    expect(MOTIVO_RAMA[PASO.EDICION]).toBeUndefined()
  })

  it('⭐ F12 · sin edificio, el motivo habla de un EDIFICIO y no de una parcela', () => {
    // `geometria` en esta rama es «hay edificio», así que el motivo general
    // —«trae antes una parcela»— mandaría a hacer algo que no desbloquea nada.
    const sinNada = {
      rama: RAMA.EDIFICIO,
      modo: MODO.NORMAL,
      hechos: { ...HECHOS_VACIOS },
    }
    const veredicto = evaluarPaso(PASO.EDICION, sinNada)
    expect(veredicto.disponible).toBe(false)
    expect(veredicto.causa).toBe(CAUSA.DATO)
    expect(veredicto.motivo).toBe(MOTIVO_DATO_EDIFICIO.geometria)
    expect(veredicto.motivo).not.toContain('parcela')
    // Y en la rama PARCELA sigue diciendo lo de siempre.
    expect(evaluarPaso(PASO.EDICION, { ...sinNada, rama: RAMA.PARCELA }).motivo).toBe(
      MOTIVO_DATO.geometria,
    )
  })

  it('un paso que no existe LANZA nombrando los que sí', () => {
    const situacion = { rama: RAMA.PARCELA, modo: MODO.NORMAL, hechos: { ...HECHOS_VACIOS } }
    expect(() => evaluarPaso('generar', situacion)).toThrow(RangeError)
    expect(() => evaluarPaso('generar', situacion)).toThrow(/entrada, validacion/)
  })
})

describe('T1 · el store', () => {
  it('`subscribe` NO notifica al suscribirse, y la baja funciona', () => {
    const nav = navegacionCompleta()
    const visto = vi.fn()
    const baja = nav.subscribe(visto)
    expect(visto).not.toHaveBeenCalled()

    nav.navegarAPaso(PASO.VALIDACION)
    expect(visto).toHaveBeenCalledTimes(1)

    baja()
    nav.navegarAPaso(PASO.EDICION)
    expect(visto).toHaveBeenCalledTimes(1)
  })

  it('sin avisador, la caída sale por el canal por defecto de la casa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nav = crearNavegacion({ hechos: { geometria: true } }) // sin `avisar`
    nav.navegarAPaso(PASO.VALIDACION)

    nav.actualizarHechos({ geometria: false })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain(ROTULO_PASO[PASO.VALIDACION])
    warn.mockRestore()
  })

  it('`get()` devuelve un estado congelado: nadie lo muta por debajo', () => {
    const nav = navegacionCompleta()
    const situacion = nav.get()
    expect(Object.isFrozen(situacion)).toBe(true)
    expect(Object.isFrozen(situacion.hechos)).toBe(true)
  })

  it('navegar a donde ya se está NO notifica', () => {
    const nav = navegacionCompleta()
    const visto = vi.fn()
    nav.subscribe(visto)
    const desenlace = nav.navegarAPaso(PASO.ENTRADA)
    expect(desenlace.ok).toBe(true)
    expect(visto).not.toHaveBeenCalled()
  })

  it('un suscriptor que navega DENTRO de la notificación converge', () => {
    // Es el desacuerdo más caro que puede tener este módulo: `crearEstadoVista`
    // actualiza el estado pero no relanza la cascada, así que sin la
    // reconciliación `get()` diría una cosa y el último notificado sería otra.
    const nav = navegacionCompleta()
    const visto = []
    nav.subscribe((situacion) => {
      visto.push(situacion.paso)
      if (situacion.paso === PASO.VALIDACION) nav.navegarAPaso(PASO.EDICION)
    })

    nav.navegarAPaso(PASO.VALIDACION)

    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(visto.at(-1)).toBe(PASO.EDICION)
    expect(visto.length).toBeLessThanOrEqual(TOPE_RECONCILIACION)
  })

  it('un suscriptor en BUCLE se corta y se cuenta, en vez de colgar la pestaña', () => {
    const avisos = []
    const nav = navegacionCompleta({ avisar: (mensaje) => avisos.push(mensaje) })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Conmuta en cada notificación: nunca converge.
    nav.subscribe((situacion) => {
      nav.navegarAPaso(situacion.paso === PASO.VALIDACION ? PASO.EDICION : PASO.VALIDACION)
    })

    nav.navegarAPaso(PASO.VALIDACION)

    expect(avisos).toContain(MENSAJE_SIN_CONVERGER)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('T1 · navegar', () => {
  it('un paso bloqueado NO lanza, no mueve, y devuelve el motivo', () => {
    const nav = crearNavegacion() // sin ningún hecho
    const desenlace = nav.navegarAPaso(PASO.INFORME)
    expect(desenlace.ok).toBe(false)
    expect(desenlace.paso).toBe(PASO.ENTRADA)
    expect(desenlace.causa).toBe(CAUSA.DATO)
    expect(desenlace.motivo).toBe(MOTIVO_DATO.diagnostico)
    expect(nav.get().paso).toBe(PASO.ENTRADA)
  })

  it('un paso que no existe LANZA: eso solo lo escribe quien programa', () => {
    const nav = crearNavegacion()
    expect(() => nav.navegarAPaso('generar')).toThrow(RangeError)
  })

  it('el rail devuelve los CINCO pasos siempre, aunque cuatro estén apagados', () => {
    const nav = crearNavegacion()
    const rail = nav.rail()
    expect(rail.map((p) => p.paso)).toEqual([...PASOS])
    expect(rail.filter((p) => p.disponible)).toHaveLength(1)
    for (const peldano of rail.filter((p) => !p.disponible)) {
      expect(peldano.motivo).toMatch(/\S/)
      expect(peldano.rotulo).toBe(ROTULO_PASO[peldano.paso])
    }
    expect(rail.filter((p) => p.activo)).toHaveLength(1)
  })

  it('el estado inicial se recorta al último paso que se sostiene, y EN SILENCIO', () => {
    const avisos = []
    const nav = crearNavegacion({ paso: PASO.INFORME, avisar: (m) => avisos.push(m) })
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    // Montar la pantalla no es un recorrido del usuario: no se le cuenta nada.
    expect(avisos).toEqual([])
  })

  it('el recorte inicial cae al MÁS AVANZADO que se sostiene, no siempre a Entrada', () => {
    const nav = crearNavegacion({ paso: PASO.INFORME, hechos: { geometria: true, oficial: true } })
    expect(nav.get().paso).toBe(PASO.DIAGNOSTICO)
  })

  it('rama, paso o modo inventados en el constructor LANZAN', () => {
    expect(() => crearNavegacion({ rama: 'SOLAR' })).toThrow(RangeError)
    expect(() => crearNavegacion({ paso: 'generar' })).toThrow(RangeError)
    expect(() => crearNavegacion({ modo: 'LECTURA' })).toThrow(RangeError)
  })
})

describe('T1 · los hechos van POR RAMA', () => {
  it('conmutar de rama reevalúa contra los hechos de la rama de DESTINO', () => {
    const nav = crearNavegacion({
      hechos: { PARCELA: { geometria: true }, EDIFICIO: {} },
    })
    expect(nav.navegarAPaso(PASO.VALIDACION).ok).toBe(true)

    // En EDIFICIO no hay nada cargado: Validación deja de sostenerse y se cae.
    const desenlace = nav.cambiarRama(RAMA.EDIFICIO)
    expect(desenlace.ok).toBe(false)
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    expect(desenlace.motivo).toContain(ROTULO_PASO[PASO.VALIDACION])

    // Y volver la recupera: los hechos de parcela nunca se perdieron.
    expect(nav.cambiarRama(RAMA.PARCELA).ok).toBe(true)
    expect(nav.navegarAPaso(PASO.VALIDACION).ok).toBe(true)
  })

  it('`hechosDe` lee la rama que NO está activa (lo que necesita T7 para avisar)', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true }, EDIFICIO: { geometria: true } } })
    expect(nav.get().rama).toBe(RAMA.PARCELA)
    expect(nav.hechosDe(RAMA.EDIFICIO).geometria).toBe(true)
  })

  it('conmutar NO toca el modo: ir y volver no te saca de la comprobación', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true } } })
    nav.entrarEnComprobacion()
    nav.cambiarRama(RAMA.EDIFICIO)
    nav.cambiarRama(RAMA.PARCELA)
    expect(nav.get().modo).toBe(MODO.COMPROBACION)
  })

  it('conmutar a la rama en la que ya se está no notifica', () => {
    const nav = navegacionCompleta()
    const visto = vi.fn()
    nav.subscribe(visto)
    expect(nav.cambiarRama(RAMA.PARCELA).ok).toBe(true)
    expect(visto).not.toHaveBeenCalled()
  })

  it('⛔ una ERRATA en un hecho LANZA nombrándola', () => {
    const nav = crearNavegacion()
    // Sin esto, `geomtria` se aceptaría, `geometria` seguiría en false, y el
    // usuario vería cuatro pasos apagados sin ninguna razón visible.
    expect(() => nav.actualizarHechos({ geomtria: true })).toThrow(TypeError)
    expect(() => nav.actualizarHechos({ geomtria: true })).toThrow(/geomtria/)
    expect(() => crearNavegacion({ hechos: { superficie: true } })).toThrow(TypeError)
  })

  it('un hecho AUSENTE es `false` y no lanza: lo que no afirmas, no lo tienes', () => {
    const nav = crearNavegacion({ hechos: { geometria: true } })
    expect(nav.get().hechos).toEqual({ geometria: true, oficial: false, diagnostico: false })
  })

  it('perder el dato tira del paso hacia atrás, y lo CUENTA', () => {
    const avisos = []
    const nav = crearNavegacion({
      hechos: { geometria: true, oficial: true, diagnostico: true },
      avisar: (m) => avisos.push(m),
    })
    nav.navegarAPaso(PASO.INFORME)

    const desenlace = nav.actualizarHechos({ diagnostico: false })

    expect(desenlace.ok).toBe(false)
    expect(nav.get().paso).toBe(PASO.DIAGNOSTICO)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain(ROTULO_PASO[PASO.INFORME])
    expect(avisos[0]).toContain(MOTIVO_DATO.diagnostico)
  })

  it('actualizar los hechos de la rama INACTIVA no mueve el paso', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true } } })
    nav.navegarAPaso(PASO.VALIDACION)
    nav.actualizarHechos({ geometria: true }, RAMA.EDIFICIO)
    expect(nav.get().paso).toBe(PASO.VALIDACION)
    expect(nav.hechosDe(RAMA.EDIFICIO).geometria).toBe(true)
  })
})

describe('T1 · la puerta (D4: comprobación es una puerta, no una cárcel)', () => {
  it('en comprobación Edición se apaga con un motivo que NOMBRA la salida', () => {
    const nav = crearNavegacion({ hechos: { geometria: true } })
    nav.entrarEnComprobacion()

    const veredicto = nav.puedeIrA(PASO.EDICION)
    expect(veredicto.disponible).toBe(false)
    expect(veredicto.causa).toBe(CAUSA.MODO)
    expect(veredicto.motivo).toBe(MOTIVO_MODO[PASO.EDICION])
    // El motivo y el botón dicen la MISMA cadena, o el usuario busca un botón
    // que no existe con ese nombre.
    expect(veredicto.motivo).toContain(ROTULO_PUERTA)
  })

  it('comprobar NO apaga el diagnóstico ni el informe: ése es el recorrido entero', () => {
    const nav = crearNavegacion({ hechos: { geometria: true, oficial: true, diagnostico: true } })
    nav.entrarEnComprobacion()
    expect(nav.puedeIrA(PASO.DIAGNOSTICO).disponible).toBe(true)
    expect(nav.puedeIrA(PASO.INFORME).disponible).toBe(true)
  })

  it('cruzar la puerta completa el rail sin mover al usuario de sitio', () => {
    const nav = crearNavegacion({ hechos: { geometria: true, oficial: true, diagnostico: true } })
    nav.entrarEnComprobacion()
    nav.navegarAPaso(PASO.DIAGNOSTICO)

    const desenlace = nav.abrirPuerta()

    expect(desenlace.ok).toBe(true)
    expect(nav.get().modo).toBe(MODO.NORMAL)
    expect(nav.get().paso).toBe(PASO.DIAGNOSTICO) // no le teletransporta
    expect(nav.rail().every((p) => p.disponible)).toBe(true)
  })

  it('entrar en comprobación fuerza la rama PARCELA (no se comprueba el GML de un edificio)', () => {
    const nav = crearNavegacion({ rama: RAMA.EDIFICIO })
    nav.entrarEnComprobacion()
    expect(nav.get().rama).toBe(RAMA.PARCELA)
  })

  it('cruzar una puerta que no está abierta no lanza: lo dice', () => {
    const nav = navegacionCompleta()
    const desenlace = nav.abrirPuerta()
    expect(desenlace.ok).toBe(false)
    expect(desenlace.motivo).toBe(MOTIVO_SIN_PUERTA)
    expect(nav.get().modo).toBe(MODO.NORMAL)
  })
})

describe('T1 · la URL (D3: hash, y el dato manda sobre la URL)', () => {
  it('ida y vuelta para las diez combinaciones de rama × paso', () => {
    for (const rama of RAMAS) {
      for (const paso of PASOS) {
        const hash = rutaDe({ rama, paso })
        expect(hash).toBe(`#/${rama.toLowerCase()}/${paso}`)
        expect(leerRuta(hash)).toEqual({ rama, paso })
      }
    }
  })

  it('lee lo que un humano puede pegar mal', () => {
    const esperado = { rama: RAMA.PARCELA, paso: PASO.VALIDACION }
    for (const variante of [
      '#/parcela/validacion',
      '/parcela/validacion',
      'parcela/validacion',
      '#parcela/validacion',
      '  #/PARCELA/Validacion/  ',
      '#//parcela/validacion//',
    ]) {
      expect(leerRuta(variante)).toEqual(esperado)
    }
  })

  it('un hash que no es nuestro devuelve `null`, que no es lo mismo que un error', () => {
    for (const ajeno of ['', '#', '#seccion', '#/parcela', '#/parcela/validacion/extra', '#/solar/entrada', '#/parcela/generar', null, 42]) {
      expect(leerRuta(ajeno)).toBeNull()
    }
  })

  it('el modo NO viaja en la URL: un enlace no puede llevar el fichero de otro', () => {
    const nav = crearNavegacion({ hechos: { geometria: true } })
    nav.entrarEnComprobacion()
    expect(nav.ruta()).toBe('#/parcela/entrada')
    expect(nav.ruta()).not.toContain('comprob')
  })

  it('⭐ el DATO manda: un enlace a un paso sin dato aterriza donde se sostiene y lo DICE', () => {
    const avisos = []
    const nav = crearNavegacion({ avisar: (m) => avisos.push(m) })

    const desenlace = nav.irARuta('#/parcela/informe')

    expect(desenlace.ok).toBe(false)
    expect(desenlace.paso).toBe(PASO.ENTRADA)
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    // El mensaje de ATERRIZAJE, no el de caída: aquí nadie ha perdido nada, es
    // que un enlace lleva el paso y no el expediente.
    expect(desenlace.motivo).toBe(mensajeAterrizaje(PASO.INFORME, PASO.ENTRADA))
    expect(avisos).toEqual([desenlace.motivo])
    expect(desenlace.motivo).toContain(ROTULO_PASO[PASO.INFORME])
    expect(desenlace.motivo).toContain(ROTULO_PASO[PASO.ENTRADA])
  })

  it('un enlace que SÍ se sostiene entra sin decir nada', () => {
    const avisos = []
    const nav = crearNavegacion({ hechos: { geometria: true }, avisar: (m) => avisos.push(m) })
    expect(nav.irARuta('#/parcela/validacion').ok).toBe(true)
    expect(nav.get().paso).toBe(PASO.VALIDACION)
    expect(avisos).toEqual([])
  })

  it('un enlace también cambia de RAMA, y reevalúa con los hechos de aquélla', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true }, EDIFICIO: { geometria: true } } })
    expect(nav.irARuta('#/edificio/validacion').ok).toBe(true)
    expect(nav.get().rama).toBe(RAMA.EDIFICIO)
    expect(nav.get().paso).toBe(PASO.VALIDACION)
  })

  it('un hash ajeno no mueve nada y no cuenta nada', () => {
    const avisos = []
    const nav = crearNavegacion({ hechos: { geometria: true }, avisar: (m) => avisos.push(m) })
    nav.navegarAPaso(PASO.VALIDACION)
    const desenlace = nav.irARuta('#seccion-cualquiera')
    expect(desenlace.ok).toBe(false)
    expect(desenlace.motivo).toBeNull()
    expect(nav.get().paso).toBe(PASO.VALIDACION)
    expect(avisos).toEqual([])
  })
})
