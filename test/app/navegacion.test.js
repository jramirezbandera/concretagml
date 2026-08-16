/* -------------------------------------------------------------------------- *
 * test/app/navegacion.test.js — Rework de UI · T1 · autoridad de navegación    *
 *                                                                              *
 * `app/navegacion.js` es el dueño único de `{rama, paso}` y **no toca el DOM**. *
 * Este fichero vive en el proyecto Vitest `node` justamente por eso: si el     *
 * módulo consultara `document` o `window` en algún camino, aquí no habría      *
 * ninguno que consultar y la prueba saldría roja. Es el guardián más barato que *
 * tiene la regla, y por eso el fichero NO se llama `.dom.test.js`.              *
 *                                                                              *
 * Lo que de verdad se vigila aquí son tres cosas, y solo la primera es obvia:   *
 *                                                                              *
 *   1. Que las guardas digan que sí y que no donde toca.                        *
 *   2. **Que ningún paso se apague en silencio.** Se recorren las 16            *
 *      situaciones posibles (2 ramas × 8 combinaciones de hechos) por los 5      *
 *      pasos —80 veredictos— y se exige que TODO bloqueo traiga causa y         *
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
  INSTRUCCION_PARCELARIO,
  MENSAJE_SIN_CONVERGER,
  MOTIVO_DATO,
  MOTIVO_BREVE,
  MOTIVO_BREVE_EDIFICIO,
  MOTIVO_DATO_EDIFICIO,
  MOTIVO_RAMA,
  TOPE_MOTIVO_BREVE,
  PASO,
  PASOS,
  RAMA,
  RAMAS,
  ROTULO_PASO,
  RUTA_RETIRADA,
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

/** Las 16 situaciones posibles. Eran 32 hasta el 2026-08-07, cuando el eje MODO
 *  se retiró: ver la cabecera de `app/navegacion.js`. */
const SITUACIONES = RAMAS.flatMap((rama) =>
  COMBINACIONES_DE_HECHOS.map((hechos) => ({ rama, hechos })),
)

/** Una navegación con todo desbloqueado, para las pruebas que no van de guardas.
 *  El avisador va a un sumidero salvo que la prueba pida otro: el canal por
 *  defecto escribe por `console.warn`, y una suite de casi seis mil pruebas no
 *  puede permitirse ensuciar la salida cada vez que un paso se cae. Hay un `it`
 *  aparte que sí comprueba ese canal por defecto. */
const navegacionCompleta = (extra = {}) =>
  crearNavegacion({
    hechos: { geometria: true, oficial: true },
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
    expect(PASOS).toEqual(['entrada', 'edicion', 'diagnostico'])
  })

  it('los tres pasos tienen rótulo, y ninguno sobra', () => {
    expect(Object.keys(ROTULO_PASO).sort()).toEqual([...PASOS].sort())
    for (const paso of PASOS) expect(ROTULO_PASO[paso]).toMatch(/\S/)
  })

  it('el vocabulario está congelado (nadie le añade una rama por la puerta de atrás)', () => {
    for (const congelado of [RAMA, RAMAS, PASO, PASOS, CAUSA, HECHOS_VACIOS]) {
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
    // De vuelta a PARCELA, que es donde esta navegación tiene los hechos: la línea
    // de arriba dejó la rama en EDIFICIO (el paso se cayó, pero la rama cambió).
    expect(nav.cambiarRama(RAMA.PARCELA).ok).toBe(true)
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
        // ⭐ `breve` desde el topbar (2026-08-10). Se afirma con `toEqual` y no
        // con `toMatchObject` A PROPÓSITO: un campo nuevo en el veredicto tiene
        // que romper este `it`, porque quien lo añada tiene que decidir aquí qué
        // vale cuando el paso SÍ está disponible.
        breve: null,
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
          expect(veredicto.breve).toBeNull()
          continue
        }
        bloqueos += 1
        expect(Object.values(CAUSA)).toContain(veredicto.causa)
        expect(typeof veredicto.motivo).toBe('string')
        expect(veredicto.motivo.trim().length).toBeGreaterThan(0)
        // ⭐ **Y LA FORMA BREVE TAMPOCO PUEDE FALTAR (2026-08-10).** Es la que se
        // pega al peldaño en la barra horizontal, o sea la ÚNICA que el usuario ve
        // sin hacer nada. Un `breve` vacío sería un paso apagado en silencio con
        // el motivo largo escondido en un renglón que puede estar ocupado por otro.
        expect(typeof veredicto.breve).toBe('string')
        expect(veredicto.breve.trim().length).toBeGreaterThan(0)
      }
    }
    // No es un `expect` decorativo: si un día la tabla se relajara y no bloqueara
    // nada, el bucle de arriba pasaría en verde sin haber comprobado nada.
    expect(bloqueos).toBeGreaterThan(0)
  })

  it('los motivos caben en el renglón de la barra (ninguno pasa de 90 caracteres)', () => {
    // ⭐ **EL PORQUÉ DE ESTE TOPE CAMBIÓ EL 2026-08-10, aunque el número no.**
    // Decía «caben en un rail de 210 px»: el motivo vivía en una columna estrecha
    // y alargarlo empujaba la ficha del pie fuera de la pantalla. Girada la barra,
    // el motivo largo vive en el RENGLÓN, que es de ancho completo y de **UNA
    // línea de alto fija** — o sea que el fallo cambió de forma: ya no empuja
    // nada, se recorta. Un motivo recortado a media frase es peor que uno que
    // desborda, porque no se ve que falte.
    const todos = [
      ...Object.values(MOTIVO_RAMA),
      ...Object.values(MOTIVO_DATO),
      ...Object.values(MOTIVO_DATO_EDIFICIO),
    ]
    expect(todos.length).toBeGreaterThan(0)
    for (const motivo of todos) expect(motivo.length).toBeLessThanOrEqual(90)
  })

  it('⭐ y la forma BREVE cabe pegada al peldaño (tope propio, 22 caracteres)', () => {
    // El de arriba protege el renglón; éste protege el peldaño, que es otro hueco
    // y mucho más pequeño: tres peldaños con punto, rótulo y breve tienen que
    // caber en la barra junto a la marca, el grupo y —desde las rebanadas 2 y 3—
    // el expediente y la entrega.
    const breves = [...Object.values(MOTIVO_BREVE), ...Object.values(MOTIVO_BREVE_EDIFICIO)]
    expect(breves.length).toBeGreaterThan(0)
    for (const breve of breves) {
      expect(breve.length, `«${breve}» no cabe en un peldaño`).toBeLessThanOrEqual(
        TOPE_MOTIVO_BREVE,
      )
    }
  })

  it('⛔ cada hecho que tiene motivo largo tiene también su forma breve', () => {
    // Sin esto, añadir un hecho nuevo a `MOTIVO_DATO` y olvidarse del breve NO
    // daría rojo: `evaluarPaso` cae al largo, y el largo entra igual en el
    // peldaño… recortado por el CSS y sin que nadie se entere. El respaldo existe
    // para que un motivo nuevo se VEA, no para que se pueda no escribirlo.
    for (const hecho of Object.keys(MOTIVO_DATO)) {
      expect(MOTIVO_BREVE[hecho], `falta la forma breve de «${hecho}»`).toBeTypeOf('string')
    }
    for (const hecho of Object.keys(MOTIVO_DATO_EDIFICIO)) {
      expect(
        MOTIVO_BREVE_EDIFICIO[hecho],
        `falta la forma breve de «${hecho}» en la rama EDIFICIO`,
      ).toBeTypeOf('string')
    }
  })

  it('⛔ y por eso `INSTRUCCION_PARCELARIO` tiene un tope propio, dicho aquí', () => {
    // El de arriba se pone rojo si alguien alarga la instrucción compartida, pero
    // señalando `MOTIVO_DATO.oficial` — que no es donde está el cambio. La frase la
    // comparten CUATRO sitios y tres de ellos tienen todo el ancho del panel; quien
    // la alargue estará mirando esos tres. Esto dice, en el sitio donde se busca,
    // que el cuarto es un chip de 210 px.
    const enunciado = MOTIVO_DATO.oficial.replace(INSTRUCCION_PARCELARIO, '')
    expect(MOTIVO_DATO.oficial).toContain(INSTRUCCION_PARCELARIO)
    expect(
      INSTRUCCION_PARCELARIO.length,
      `la instrucción no cabe en el rail: ${enunciado.length} del enunciado + ` +
        `${INSTRUCCION_PARCELARIO.length} de la instrucción pasan de 90`,
    ).toBeLessThanOrEqual(90 - enunciado.length)
  })

  it('⛔ y NINGUNO de los cuatro manda ya a Entrada (era el empujón a la trampa)', () => {
    // Hasta el 2026-08-08 los cuatro textos que hablan del parcelario decían, cada
    // uno a su manera, «tráelo del Catastro» — y hacerlo BORRABA la medición del
    // usuario. El rail era el más directo: «tráelo desde Entrada», que es la
    // pantalla donde el único botón que había era el que la borra.
    expect(MOTIVO_DATO.oficial).not.toMatch(/desde Entrada/i)
    expect(INSTRUCCION_PARCELARIO).toContain('Traer el parcelario de fondo')
  })

  it('⛔ el orden de las causas es RAMA → DATO, y hoy solo se ve el segundo escalón', () => {
    // ⛔ **Este `it` ha perdido sus dos primeros escalones, y hay que decirlo.**
    // Se probaba con DIAGNÓSTICO porque era el paso que aún se apagaba por RAMA;
    // **F14 abre los cinco peldaños en las dos ramas**, así que ya NO HAY ningún
    // paso con el que enseñar la causa RAMA sobre datos reales, y `MOTIVO_RAMA`
    // está vacío. Y el 2026-08-07 se retiró el eje MODO entero, que era el
    // segundo escalón (ver la cabecera de `app/navegacion.js`).
    //
    // La compuerta de RAMA sigue en el código y sigue siendo la primera: se
    // prueba en `evaluarPaso` con una regla FABRICADA, más abajo. Lo que queda
    // aquí es que sin ella manda el DATO.
    const todoEnContra = { rama: RAMA.PARCELA, hechos: { ...HECHOS_VACIOS } }

    expect(evaluarPaso(PASO.EDICION, todoEnContra).causa).toBe(CAUSA.DATO)

    // Y con la rama EDIFICIO —donde ya no hay compuerta de rama— el diagnóstico
    // cae por DATO y no por RAMA, que es justo el cambio de F14.
    expect(
      evaluarPaso(PASO.DIAGNOSTICO, {
        rama: RAMA.EDIFICIO,
        hechos: { ...HECHOS_VACIOS },
      }).causa,
    ).toBe(CAUSA.DATO)
  })

  it('cuando faltan dos hechos se nombra el primero que el usuario puede resolver', () => {
    const veredicto = evaluarPaso(PASO.DIAGNOSTICO, {
      rama: RAMA.PARCELA,
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
      hechos: { geometria: true, oficial: false },
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
    const soloGeometria = { geometria: true, oficial: false }

    expect(
      evaluarPaso(PASO.DIAGNOSTICO, {
        rama: RAMA.EDIFICIO,
        hechos: soloGeometria,
      }).disponible,
    ).toBe(true)

    // Y en PARCELA, con los mismos hechos, sigue exigiéndolo.
    const enParcela = evaluarPaso(PASO.DIAGNOSTICO, {
      rama: RAMA.PARCELA,
      hechos: soloGeometria,
    })
    expect(enParcela.disponible).toBe(false)
    expect(enParcela.causa).toBe(CAUSA.DATO)
  })

  it('⭐ F14 · el Diagnóstico de EDIFICIO no exige huella oficial: la obra nueva no la tiene', () => {
    // Ficha §17: «si no [hubo contraste], informe solo declarativo, sin sección de
    // contraste». El caso estrella de esta rama —la obra nueva— es precisamente
    // aquel en el que el Catastro NO publica huella.
    //
    // ⭐ Esta prueba miraba `PASO.INFORME` hasta el 2026-08-08. Retirado aquel
    // peldaño, lo que queda de F14 en la tabla de guardas es esto: que llegar a
    // contrastar una construcción no exija tener con qué contrastarla.
    const sinDiagnostico = { geometria: true, oficial: false }

    expect(
      evaluarPaso(PASO.DIAGNOSTICO, {
        rama: RAMA.EDIFICIO,
        hechos: sinDiagnostico,
      }).disponible,
    ).toBe(true)

    // Y en PARCELA el MISMO paso sí la exige: sin contorno del Catastro no hay
    // encaje que diagnosticar. Es la asimetría que `requiere` como mapa por rama
    // existe para poder declarar.
    expect(
      evaluarPaso(PASO.DIAGNOSTICO, {
        rama: RAMA.PARCELA,
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
      hechos: { geometria: true, oficial: false },
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
    const situacion = { rama: RAMA.PARCELA, hechos: { ...HECHOS_VACIOS } }
    expect(() => evaluarPaso('generar', situacion)).toThrow(RangeError)
    expect(() => evaluarPaso('generar', situacion)).toThrow(/entrada, edicion/)
  })
})

describe('T1 · el store', () => {
  it('`subscribe` NO notifica al suscribirse, y la baja funciona', () => {
    const nav = navegacionCompleta()
    const visto = vi.fn()
    const baja = nav.subscribe(visto)
    expect(visto).not.toHaveBeenCalled()

    nav.navegarAPaso(PASO.EDICION)
    expect(visto).toHaveBeenCalledTimes(1)

    baja()
    nav.navegarAPaso(PASO.EDICION)
    expect(visto).toHaveBeenCalledTimes(1)
  })

  it('sin avisador, la caída sale por el canal por defecto de la casa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nav = crearNavegacion({ hechos: { geometria: true } }) // sin `avisar`
    nav.navegarAPaso(PASO.EDICION)

    nav.actualizarHechos({ geometria: false })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain(ROTULO_PASO[PASO.EDICION])
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
      if (situacion.paso === PASO.EDICION) nav.navegarAPaso(PASO.EDICION)
    })

    nav.navegarAPaso(PASO.EDICION)

    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(visto.at(-1)).toBe(PASO.EDICION)
    expect(visto.length).toBeLessThanOrEqual(TOPE_RECONCILIACION)
  })

  it('un suscriptor en BUCLE se corta y se cuenta, en vez de colgar la pestaña', () => {
    const avisos = []
    const nav = navegacionCompleta({ avisar: (mensaje) => avisos.push(mensaje) })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Conmuta en cada notificación: nunca converge. ⚠️ Los DOS pasos tienen que
    // ser distintos y los dos alcanzables con los hechos de `navegacionCompleta`;
    // si no, el bucle converge a la primera y esta prueba pasa sin probar nada.
    nav.subscribe((situacion) => {
      nav.navegarAPaso(situacion.paso === PASO.EDICION ? PASO.DIAGNOSTICO : PASO.EDICION)
    })

    nav.navegarAPaso(PASO.EDICION)

    expect(avisos).toContain(MENSAJE_SIN_CONVERGER)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('T1 · navegar', () => {
  it('un paso bloqueado NO lanza, no mueve, y devuelve el motivo', () => {
    const nav = crearNavegacion() // sin ningún hecho
    const desenlace = nav.navegarAPaso(PASO.DIAGNOSTICO)
    expect(desenlace.ok).toBe(false)
    expect(desenlace.paso).toBe(PASO.ENTRADA)
    expect(desenlace.causa).toBe(CAUSA.DATO)
    // El PRIMERO de los que faltan, que es el que el usuario puede resolver
    // antes: sin parcela no tiene sentido pedirle el parcelario.
    expect(desenlace.motivo).toBe(MOTIVO_DATO.geometria)
    expect(nav.get().paso).toBe(PASO.ENTRADA)
  })

  it('un paso que no existe LANZA: eso solo lo escribe quien programa', () => {
    const nav = crearNavegacion()
    expect(() => nav.navegarAPaso('generar')).toThrow(RangeError)
  })

  it('el rail devuelve los TRES pasos siempre, aunque dos estén apagados', () => {
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
    const nav = crearNavegacion({ paso: PASO.DIAGNOSTICO, avisar: (m) => avisos.push(m) })
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    // Montar la pantalla no es un recorrido del usuario: no se le cuenta nada.
    expect(avisos).toEqual([])
  })

  it('el recorte inicial cae al MÁS AVANZADO que se sostiene, no siempre a Entrada', () => {
    // Se pide Diagnóstico con geometría pero SIN parcelario: no se sostiene, y el
    // recorte no cae a Entrada sino a Edición, que es el más avanzado que sí.
    const nav = crearNavegacion({ paso: PASO.DIAGNOSTICO, hechos: { geometria: true } })
    expect(nav.get().paso).toBe(PASO.EDICION)
  })

  it('rama o paso inventados en el constructor LANZAN', () => {
    expect(() => crearNavegacion({ rama: 'SOLAR' })).toThrow(RangeError)
    expect(() => crearNavegacion({ paso: 'generar' })).toThrow(RangeError)
  })
})

describe('T1 · los hechos van POR RAMA', () => {
  it('conmutar de rama reevalúa contra los hechos de la rama de DESTINO', () => {
    const nav = crearNavegacion({
      hechos: { PARCELA: { geometria: true }, EDIFICIO: {} },
    })
    expect(nav.navegarAPaso(PASO.EDICION).ok).toBe(true)

    // En EDIFICIO no hay nada cargado: Validación deja de sostenerse y se cae.
    const desenlace = nav.cambiarRama(RAMA.EDIFICIO)
    expect(desenlace.ok).toBe(false)
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    expect(desenlace.motivo).toContain(ROTULO_PASO[PASO.EDICION])

    // Y volver la recupera: los hechos de parcela nunca se perdieron.
    expect(nav.cambiarRama(RAMA.PARCELA).ok).toBe(true)
    expect(nav.navegarAPaso(PASO.EDICION).ok).toBe(true)
  })

  it('`hechosDe` lee la rama que NO está activa (lo que necesita T7 para avisar)', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true }, EDIFICIO: { geometria: true } } })
    expect(nav.get().rama).toBe(RAMA.PARCELA)
    expect(nav.hechosDe(RAMA.EDIFICIO).geometria).toBe(true)
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
    expect(nav.get().hechos).toEqual({ geometria: true, oficial: false })
  })

  it('perder el dato tira del paso hacia atrás, y lo CUENTA', () => {
    const avisos = []
    const nav = crearNavegacion({
      hechos: { geometria: true, oficial: true },
      avisar: (m) => avisos.push(m),
    })
    nav.navegarAPaso(PASO.DIAGNOSTICO)

    // Se pierde el parcelario del Catastro estando ya en Diagnóstico: ahí no queda
    // nada contra lo que contrastar, así que el paso no se sostiene.
    const desenlace = nav.actualizarHechos({ oficial: false })

    expect(desenlace.ok).toBe(false)
    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain(ROTULO_PASO[PASO.DIAGNOSTICO])
    expect(avisos[0]).toContain(MOTIVO_DATO.oficial)
  })

  it('actualizar los hechos de la rama INACTIVA no mueve el paso', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true } } })
    nav.navegarAPaso(PASO.EDICION)
    nav.actualizarHechos({ geometria: true }, RAMA.EDIFICIO)
    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(nav.hechosDe(RAMA.EDIFICIO).geometria).toBe(true)
  })

  it('⛔ actualizar los hechos SIN cambiar ninguno NO notifica (auditoría B4)', () => {
    // ⭐ **El invariante en el que se apoya `app/barra.js` (decisión A1) y que
    // `app/main.js#refrescarHechos` afirma por escrito: «solo notifica si el paso
    // activo deja de sostenerse».** Era falso: `actualizarHechos` llamaba SIEMPRE a
    // `asentar` → `publicar` → `store.set(objeto nuevo)`, y `crearEstadoVista.set`
    // notifica sin comparar. Medido: `refrescarHechos()` producía 2 notificaciones
    // completas aunque no cambiara ni un hecho —una por rama— más el
    // `barra.repintar()` explícito, o sea **3 pintadas enteras del rail por cada
    // vértice arrastrado**, con sus 3 pasadas de contraste, pantalla y ruta.
    const nav = crearNavegacion({ hechos: { geometria: true, oficial: true }, avisar: () => {} })
    nav.navegarAPaso(PASO.DIAGNOSTICO)
    const visto = vi.fn()
    nav.subscribe(visto)

    // Los mismos hechos, de las tres formas en que llegan: el registro entero (lo
    // que hace `refrescarHechos`), una sola clave, y ninguna.
    expect(nav.actualizarHechos({ geometria: true, oficial: true }).ok).toBe(true)
    nav.actualizarHechos({ oficial: true })
    nav.actualizarHechos({})
    // Y los de la rama INACTIVA, que tampoco cambian.
    nav.actualizarHechos({ geometria: false }, RAMA.EDIFICIO)
    expect(visto, 'nada ha cambiado: nadie tiene que repintar').not.toHaveBeenCalled()

    // ⚠️ La otra mitad, sin la cual la guarda podría no publicar NUNCA y este test
    // seguiría verde: lo que SÍ cambia sigue notificando, y sigue tirando del paso.
    expect(nav.actualizarHechos({ oficial: false }).ok).toBe(false)
    expect(visto).toHaveBeenCalledTimes(1)
    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(nav.get().hechos).toEqual({ geometria: true, oficial: false })
  })

  it('y el hecho de la rama inactiva que SÍ cambia se guarda igual', () => {
    // Anti-vacuidad de la guarda por el otro lado: no publicar no puede significar
    // no guardar. Es lo que sostiene el conmutador de rama.
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true } } })
    nav.actualizarHechos({ geometria: true, oficial: true }, RAMA.EDIFICIO)
    expect(nav.hechosDe(RAMA.EDIFICIO)).toEqual({ geometria: true, oficial: true })
    expect(nav.cambiarRama(RAMA.EDIFICIO).ok).toBe(true)
    expect(nav.get().hechos).toEqual({ geometria: true, oficial: true })
  })
})

/* ⛔ **AQUÍ VIVÍA `describe('T1 · la puerta (D4…)')`, CON SUS CINCO PRUEBAS, Y SE
 * RETIRÓ EL 2026-08-07 CON EL EJE QUE PROBABA.**
 *
 * Probaban que en modo COMPROBACIÓN Edición se apagaba nombrando la salida, que el
 * diagnóstico y el informe seguían abiertos, y que `abrirPuerta()` completaba el
 * rail sin mover al usuario de sitio. **Las cinco pasaban**, y la aplicación
 * estaba rota igualmente: el botón que llamaba a `abrirPuerta()` vivía en el cajón
 * de Diagnóstico, y en el caso corriente —un GML sin referencia catastral— ese paso
 * estaba apagado por falta de parcelario. Este módulo no toca el DOM y no sabe
 * dónde se pinta su CTA, así que ninguna prueba de aquí podía verlo.
 *
 * Es la lección que se queda escrita: **una API de navegación en verde no dice que
 * el recorrido se pueda andar.** Lo que lo dice es un guion de humo en el
 * navegador, y el 15 lo daba por bueno porque montaba el caso CON parcelario.
 */

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
    const esperado = { rama: RAMA.PARCELA, paso: PASO.EDICION }
    for (const variante of [
      '#/parcela/edicion',
      '/parcela/edicion',
      'parcela/edicion',
      '#parcela/edicion',
      '  #/PARCELA/Edicion/  ',
      '#//parcela/edicion//',
    ]) {
      expect(leerRuta(variante)).toEqual(esperado)
    }
  })

  it('⭐ una ruta RETIRADA no es un hash ajeno: lleva al peldaño que se quedó su contenido', () => {
    // 2026-08-08. Un marcador guardado, un enlace en un correo o el botón «atrás»
    // pueden traer todavía los dos pasos que el rail perdió. Devolver `null` los
    // trataría como «esto no es nuestro» y el usuario aterrizaría donde tocara sin
    // enterarse. Cada uno va a donde se fue su contenido.
    expect(RUTA_RETIRADA).toEqual({ validacion: PASO.EDICION, informe: PASO.DIAGNOSTICO })
    expect(leerRuta('#/parcela/validacion')).toEqual({ rama: RAMA.PARCELA, paso: PASO.EDICION })
    expect(leerRuta('#/parcela/informe')).toEqual({ rama: RAMA.PARCELA, paso: PASO.DIAGNOSTICO })
    // Y en la otra rama igual: la traducción es del PASO, no del recorrido.
    expect(leerRuta('#/edificio/informe')).toEqual({ rama: RAMA.EDIFICIO, paso: PASO.DIAGNOSTICO })
    // ⛔ Pero `rutaDe` NO las vuelve a escribir: son historia, no un estado.
    expect(rutaDe({ rama: RAMA.PARCELA, paso: PASO.EDICION })).toBe('#/parcela/edicion')
  })

  it('un hash que no es nuestro devuelve `null`, que no es lo mismo que un error', () => {
    for (const ajeno of ['', '#', '#seccion', '#/parcela', '#/parcela/validacion/extra', '#/solar/entrada', '#/parcela/generar', null, 42]) {
      expect(leerRuta(ajeno)).toBeNull()
    }
  })

  it('⭐ el DATO manda: un enlace a un paso sin dato aterriza donde se sostiene y lo DICE', () => {
    const avisos = []
    const nav = crearNavegacion({ avisar: (m) => avisos.push(m) })

    const desenlace = nav.irARuta('#/parcela/diagnostico')

    expect(desenlace.ok).toBe(false)
    expect(desenlace.paso).toBe(PASO.ENTRADA)
    expect(nav.get().paso).toBe(PASO.ENTRADA)
    // El mensaje de ATERRIZAJE, no el de caída: aquí nadie ha perdido nada, es
    // que un enlace lleva el paso y no el expediente.
    expect(desenlace.motivo).toBe(mensajeAterrizaje(PASO.DIAGNOSTICO, PASO.ENTRADA))
    expect(avisos).toEqual([desenlace.motivo])
    expect(desenlace.motivo).toContain(ROTULO_PASO[PASO.DIAGNOSTICO])
    expect(desenlace.motivo).toContain(ROTULO_PASO[PASO.ENTRADA])
  })

  it('un enlace que SÍ se sostiene entra sin decir nada', () => {
    const avisos = []
    const nav = crearNavegacion({ hechos: { geometria: true }, avisar: (m) => avisos.push(m) })
    expect(nav.irARuta('#/parcela/validacion').ok).toBe(true)
    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(avisos).toEqual([])
  })

  it('un enlace también cambia de RAMA, y reevalúa con los hechos de aquélla', () => {
    const nav = crearNavegacion({ hechos: { PARCELA: { geometria: true }, EDIFICIO: { geometria: true } } })
    expect(nav.irARuta('#/edificio/validacion').ok).toBe(true)
    expect(nav.get().rama).toBe(RAMA.EDIFICIO)
    expect(nav.get().paso).toBe(PASO.EDICION)
  })

  it('un hash ajeno no mueve nada y no cuenta nada', () => {
    const avisos = []
    const nav = crearNavegacion({ hechos: { geometria: true }, avisar: (m) => avisos.push(m) })
    nav.navegarAPaso(PASO.EDICION)
    const desenlace = nav.irARuta('#seccion-cualquiera')
    expect(desenlace.ok).toBe(false)
    expect(desenlace.motivo).toBeNull()
    expect(nav.get().paso).toBe(PASO.EDICION)
    expect(avisos).toEqual([])
  })
})
