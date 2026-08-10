/* -------------------------------------------------------------------------- *
 * test/app/empezar-de-nuevo.dom.test.js — «Vaciarlo», el pie de Entrada        *
 *                                                            (2026-08-09)     *
 *                                                                              *
 * Petición del autor: *«un botón para poder eliminar la geometría actual y      *
 * empezar desde el principio»*. `app/empezar-de-nuevo.js` no vacía nada —el     *
 * acto lo pone `app/main.js`, que es quien tiene delante los dieciocho          *
 * cableados—: lo que hace es decidir **cuándo se ofrece** y **pedirlo dos       *
 * veces**. Esas dos cosas son las que se miden aquí.                            *
 *                                                                              *
 * ── LOS TRES FALLOS MUDOS QUE VIGILA ──                                        *
 *                                                                              *
 *   1. **Que el renglón se vea con la app vacía.** No rompe nada: solo ofrece   *
 *      tirar lo que no existe, y es la quinta cosa que un recién llegado tiene  *
 *      que descartar antes de poder empezar.                                    *
 *   2. **Que un armado sobreviva a un vaciado por otra vía.** Si el usuario     *
 *      pulsa «Vaciarlo» una vez y acto seguido abre un expediente, el armado    *
 *      invisible haría que el siguiente «Vaciarlo» vaciara **a la primera**,    *
 *      sin haber preguntado.                                                    *
 *   3. ⭐ **Que alguien le declare un `display` al renglón en el CSS.** Es la    *
 *      trampa que el guion 19 midió en `.gml-barra-herramienta`: el `hidden`    *
 *      deja de ocultar y el botón aparece siempre. jsdom no aplica hojas, así   *
 *      que no se puede medir el píxel — lo que sí se puede es exigir que la     *
 *      regla no exista, que es donde vive el defecto.                           *
 *                                                                              *
 * La cáscara se lee de `index.html` **real** y no se copia, igual que en        *
 * `pantalla.dom.test.js`: un marcado copiado deja de comprobar el contrato el   *
 * día que el fichero de verdad cambia.                                          *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  MENSAJE_ARMADO,
  MS_CONFIRMAR,
  SELECTOR_BOTON,
  SELECTOR_ESTADO,
  SELECTOR_FILA,
  cablearEmpezarDeNuevo,
} from '../../app/empezar-de-nuevo.js'
import { crearEstadoVista } from '../../viewer/_comun.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const CSS = readFileSync(join(RAIZ, 'estilos', 'app.css'), 'utf8')

const CUERPO = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/empezar-de-nuevo.dom.test.js: no se ha encontrado el <body> de index.html.',
    )
  }
  return encontrado[1]
})()

// ── El banco de pruebas ──────────────────────────────────────────────────────

/** Un documento cualquiera que sirva de parcela para el store. No se le mira dentro. */
const UNA_PARCELA = Object.freeze({ idLocal: 'p-1', refcat: '6346726UF8664N', recintos: [] })
/** Y uno que haga de edificio. */
const UN_EDIFICIO = Object.freeze({ idLocal: 'e-1', partes: [] })

let vivo = null
/** El reloj inyectado, en ms de época. Se mueve a mano: aquí no hay `useFakeTimers`. */
let reloj = 1_000_000

/**
 * Monta la cáscara real y cablea. Devuelve todo lo que las pruebas tocan.
 *
 * @param {{parcela?: object|null, edificio?: object|null}} [inicial]
 */
function montar({ parcela = null, edificio = null } = {}) {
  document.body.innerHTML = CUERPO
  const estado = crearEstadoVista(parcela)
  const estadoEdificio = crearEstadoVista(edificio)
  const alVaciar = vi.fn()
  vivo = cablearEmpezarDeNuevo({
    documento,
    estado,
    estadoEdificio,
    alVaciar,
    ahora: () => new Date(reloj),
  })
  return {
    estado,
    estadoEdificio,
    alVaciar,
    cable: vivo,
    fila: document.querySelector(SELECTOR_FILA),
    boton: document.querySelector(SELECTOR_BOTON),
    renglon: document.querySelector(SELECTOR_ESTADO),
  }
}

/** El `document` global de jsdom, nombrado para que las llamadas se lean. */
const documento = globalThis.document

afterEach(() => {
  vivo?.destruir()
  vivo = null
  reloj = 1_000_000
  document.body.innerHTML = ''
})

// ── El contrato con index.html ───────────────────────────────────────────────

describe('el marcado de index.html', () => {
  it('trae los tres nodos del contrato, y la fila nace `hidden`', () => {
    document.body.innerHTML = CUERPO
    const fila = document.querySelector(SELECTOR_FILA)
    expect(fila).not.toBeNull()
    expect(document.querySelector(SELECTOR_BOTON)).not.toBeNull()
    expect(document.querySelector(SELECTOR_ESTADO)).not.toBeNull()
    // Nace escondido EN EL MARCADO y no solo por JavaScript: entre que se sirve el
    // HTML y que corre `app/main.js` hay un fotograma, y en él se vería el renglón.
    expect(fila.hidden).toBe(true)
  })

  it('⭐ el botón vive en el MENÚ DE EXPEDIENTE de la barra, no en una pantalla', () => {
    document.body.innerHTML = CUERPO
    const fila = document.querySelector(SELECTOR_FILA)

    // ⛔ **ESTE `it` DECÍA LO CONTRARIO HASTA EL 2026-08-10**, y decía esto:
    //
    //     const seccion = fila.closest('[data-pantalla]')
    //     expect(seccion.getAttribute('data-pantalla')).toContain('entrada')
    //
    // Era la decisión del autor del 2026-08-09 —«Entrada **es** el principio»— y
    // aguantó un día. Lo que la tumbó no es un capricho: **«Vaciarlo» solo existía
    // en Entrada**, así que quien estaba en Edición no tenía forma de vaciar sin
    // volver atrás; y desde que hay barra, volver atrás es un clic que no tendría
    // por qué existir. Se muda al menú de expediente, que se ve en los tres pasos.
    //
    // Lo que se afirma ahora es lo que de verdad protege: que **NO** cuelgue de
    // ninguna pantalla. Si un día vuelve a hacerlo, deja de verse en dos de los
    // tres pasos y el eje PASO lo esconde sin que nada se queje.
    expect(fila.closest('[data-pantalla]')).toBeNull()
    expect(fila.closest('[data-menu="expediente"]')).not.toBeNull()
  })

  it('el renglón del armado es `role="status"`', () => {
    document.body.innerHTML = CUERPO
    // Sin esto, el aviso de «vuelve a pulsar» no lo oye quien no ve la pantalla, y el
    // segundo clic sería un misterio. `status` lo anuncia SIN robar el foco, que es
    // lo que hace falta: el usuario tiene que poder volver a pulsar el mismo botón.
    expect(document.querySelector(SELECTOR_ESTADO).getAttribute('role')).toBe('status')
  })
})

// ── El CSS, que es donde vive el fallo mudo nº 3 ────────────────────────────

describe('la hoja de estilo', () => {
  // ⛔ **AQUÍ HABÍA DOS `it` SOBRE `.gml-entrada-pie` Y SE VAN CON SU CLASE**
  // (2026-08-10). Vigilaban la regla que juntaba los dos renglones del pie de
  // Entrada y que a aquélla no se le declarara `display` — porque un `display` de
  // clase (0,1,0) posterior habría vencido al `hidden` y el botón «Vaciarlo»
  // saldría visible con la aplicación recién abierta. La trampa es real y ya la
  // pagó `.gml-barra-herramienta` en F12.
  //
  // **La trampa no ha desaparecido, se ha mudado**: el nodo con `hidden` es ahora
  // el envoltorio del menú, y lo que lo oculta sigue siendo `.gml-app [hidden]`.
  // Así que el `it` no se borra, se REESCRIBE contra el sitio nuevo.
  it('⛔ NO hay ningún `display` de clase que pueda vencer al `hidden` de la fila', () => {
    // La fila de «Vaciarlo» no lleva clase propia a propósito (es un `<div
    // role="none">` con solo `data-pie`), justamente para que no exista una regla
    // de clase que pueda pisarle el `hidden`. Se comprueba que sigue siendo así.
    document.body.innerHTML = CUERPO
    const fila = document.querySelector(SELECTOR_FILA)
    expect(fila.className).toBe('')
    expect(fila.hidden).toBe(true)
    // Y que nadie le ha escrito una regla por atributo, que sería el otro camino.
    expect(CSS).not.toMatch(/\[data-pie=['"]empezar-de-nuevo['"]\][^{]*\{[^}]*display/)
  })

  it('la opción del menú tiene reglas propias, y su renglón se colapsa vacío', () => {
    // `:empty{display:none}` es lo que hace que la confirmación no deje un hueco
    // muerto en el menú durante toda la vida de la pantalla.
    expect(CSS).toMatch(/\.gml-barra-menu-opcion/)
    expect(CSS).toMatch(/\.gml-barra-menu-estado:empty\s*\{\s*display:\s*none/)
  })
})

// ── Los contratos del programador (regla de oro 1) ──────────────────────────

describe('cablearEmpezarDeNuevo · contratos', () => {
  it('lanza sin documento', () => {
    expect(() => cablearEmpezarDeNuevo({ estado: crearEstadoVista(null) })).toThrow(TypeError)
  })

  it('lanza si falta uno de los dos stores', () => {
    document.body.innerHTML = CUERPO
    expect(() =>
      cablearEmpezarDeNuevo({
        documento,
        estado: crearEstadoVista(null),
        alVaciar: () => {},
      }),
    ).toThrow(TypeError)
  })

  it('lanza sin `alVaciar`', () => {
    document.body.innerHTML = CUERPO
    expect(() =>
      cablearEmpezarDeNuevo({
        documento,
        estado: crearEstadoVista(null),
        estadoEdificio: crearEstadoVista(null),
      }),
    ).toThrow(TypeError)
  })

  it('lanza si falta el marcado', () => {
    document.body.innerHTML = '<p>una cáscara que no es la nuestra</p>'
    expect(() =>
      cablearEmpezarDeNuevo({
        documento,
        estado: crearEstadoVista(null),
        estadoEdificio: crearEstadoVista(null),
        alVaciar: () => {},
      }),
    ).toThrow(/index\.html/)
  })
})

// ── Cuándo se ofrece ─────────────────────────────────────────────────────────

describe('cuándo se ve el renglón', () => {
  it('con la aplicación VACÍA no se ve, que es el arranque de producción', () => {
    const { fila, cable } = montar()
    expect(cable.hayAlgo()).toBe(false)
    expect(fila.hidden).toBe(true)
  })

  it('sale en cuanto entra una parcela', () => {
    const { estado, fila } = montar()
    estado.set(UNA_PARCELA)
    expect(fila.hidden).toBe(false)
  })

  it('sale también con SOLO edificio: la rama EDIFICIO no lleva parcela', () => {
    const { estadoEdificio, fila } = montar()
    estadoEdificio.set(UN_EDIFICIO)
    expect(fila.hidden).toBe(false)
  })

  it('se monta ya visible si la pantalla arranca con algo (`?demo=`)', () => {
    const { fila } = montar({ parcela: UNA_PARCELA })
    expect(fila.hidden).toBe(false)
  })

  it('se vuelve a esconder cuando el store se queda vacío', () => {
    const { estado, fila } = montar({ parcela: UNA_PARCELA })
    estado.set(null)
    expect(fila.hidden).toBe(true)
  })

  it('sigue visible si se vacía UNA rama y la otra sigue cargada', () => {
    const { estado, estadoEdificio, fila } = montar({
      parcela: UNA_PARCELA,
      edificio: UN_EDIFICIO,
    })
    estado.set(null)
    expect(fila.hidden).toBe(false)
  })
})

// ── Los dos tiempos ──────────────────────────────────────────────────────────

describe('la confirmación en dos tiempos', () => {
  it('el primer clic ARMA y NO vacía', () => {
    const { boton, renglon, alVaciar, cable } = montar({ parcela: UNA_PARCELA })
    boton.click()
    expect(alVaciar).not.toHaveBeenCalled()
    expect(cable.armado()).toBe(true)
    expect(renglon.textContent).toBe(MENSAJE_ARMADO)
  })

  it('el renglón dice que lo autoguardado NO se pierde', () => {
    // Es la decisión del autor (2026-08-09) y la mitad del mensaje: sin esa frase, el
    // usuario cree que el segundo clic destruye la tarde de trabajo, y no pulsa.
    expect(MENSAJE_ARMADO).toMatch(/autoguardado/)
    expect(MENSAJE_ARMADO).toMatch(/Expediente/)
  })

  it('el segundo clic dentro del plazo vacía UNA vez y borra el renglón', () => {
    const { boton, renglon, alVaciar, cable } = montar({ parcela: UNA_PARCELA })
    boton.click()
    reloj += MS_CONFIRMAR - 1
    boton.click()
    expect(alVaciar).toHaveBeenCalledTimes(1)
    expect(cable.armado()).toBe(false)
    expect(renglon.textContent).toBe('')
  })

  it('pasado el plazo, el segundo clic vuelve a ARMAR en vez de vaciar', () => {
    const { boton, renglon, alVaciar } = montar({ parcela: UNA_PARCELA })
    boton.click()
    reloj += MS_CONFIRMAR + 1
    boton.click()
    // Un armado que durase para siempre convertiría el «Vaciarlo» de dentro de diez
    // minutos en un vaciado a la primera, y nada en pantalla lo avisaría.
    expect(alVaciar).not.toHaveBeenCalled()
    expect(renglon.textContent).toBe(MENSAJE_ARMADO)
  })

  it('⭐ esconderse DESARMA: un armado no sobrevive a un vaciado por otra vía', () => {
    const { estado, boton, renglon, alVaciar, cable } = montar({ parcela: UNA_PARCELA })
    boton.click()
    expect(cable.armado()).toBe(true)
    // El usuario abre un expediente, suelta otro fichero, lo que sea: el store se
    // mueve por su cuenta y pasa por vacío.
    estado.set(null)
    expect(cable.armado()).toBe(false)
    expect(renglon.textContent).toBe('')
    estado.set(UNA_PARCELA)
    boton.click()
    expect(alVaciar).not.toHaveBeenCalled()
  })

  it('el clic con la fila escondida no hace nada', () => {
    // `display:none` lo saca del ratón y del tabulador, pero el nodo SIGUE
    // encontrándose y SIGUE oyendo (contrapartida declarada en `app/pantalla.js`),
    // así que se comprueba en vez de suponerlo.
    const { boton, renglon, alVaciar } = montar()
    boton.click()
    boton.click()
    expect(alVaciar).not.toHaveBeenCalled()
    expect(renglon.textContent).toBe('')
  })
})

// ── El apagado ───────────────────────────────────────────────────────────────

describe('destruir', () => {
  it('deja de oír el clic, esconde la fila y borra el renglón', () => {
    const { boton, fila, renglon, alVaciar, cable } = montar({ parcela: UNA_PARCELA })
    boton.click()
    cable.destruir()
    expect(fila.hidden).toBe(true)
    expect(renglon.textContent).toBe('')
    boton.click()
    boton.click()
    expect(alVaciar).not.toHaveBeenCalled()
  })

  it('es idempotente y se da de baja de los DOS stores', () => {
    const { estado, estadoEdificio, fila, cable } = montar()
    cable.destruir()
    expect(() => cable.destruir()).not.toThrow()
    estado.set(UNA_PARCELA)
    estadoEdificio.set(UN_EDIFICIO)
    // Si alguna suscripción siguiera viva, la fila volvería a salir sobre una
    // pantalla que ya no tiene quien la atienda.
    expect(fila.hidden).toBe(true)
  })
})
