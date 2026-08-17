/* -------------------------------------------------------------------------- *
 * test/viewer/acotar-viewport.test.js — La cuenta que impide perder el panel    *
 *                                                                              *
 * ⛔ **ESTE FICHERO EXISTE PORQUE EL SITIO NATURAL DE ESTA PRUEBA ERA UNA       *
 * MENTIRA.** Lo natural sería medir el acotado sobre el panel montado, en el    *
 * proyecto `dom`. Pero jsdom no maqueta: `getBoundingClientRect()` devuelve     *
 * ceros, así que un test de «la barra no se sale» allí compararía 0 contra 0 y  *
 * saldría verde con la aritmética borrada. No es una hipótesis — pasó, y está   *
 * escrito en `test/viewer/cajon-diagnostico.dom.test.js:1059`: cuatro pruebas   *
 * en verde mientras el botón era inalcanzable en producción.                    *
 *                                                                              *
 * Así que la cuenta se saca a una función pura y se prueba con NÚMEROS, en el   *
 * proyecto `node`. Lo que aquí no se puede afirmar —que el panel de verdad      *
 * aplique la cuenta tras un `resize` de Chromium— es del guion de humo 16.      *
 *                                                                              *
 * La promesa que defienden los ocho casos es UNA: **la barra de título nunca    *
 * queda fuera de la ventana.** No es cosmética. La barra lleva el asidero del   *
 * arrastre, el `[–]` y el `[×]`; fuera del viewport, el panel no se puede ni    *
 * mover, ni plegar, ni cerrar, y la única salida es recargar la página —con lo  *
 * que se lleva por delante los nombres que el usuario acababa de escribir.      *
 *                                                                              *
 * Proyecto Vitest `node`: sin DOM, sin Leaflet, sin ventana.                    *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { acotarAlViewport } from '../../viewer/acotar-viewport.js'

/** Una ventana de sobremesa cualquiera. */
const VENTANA = Object.freeze({ ancho: 1280, alto: 720 })

/**
 * La barra de título del panel: tan ancha como él, y BAJA.
 *
 * ⚠️ Los 28 px son lo que importa de este objeto. El panel entero mide cientos;
 * la barra, una fila. Toda la doctrina de este fichero está en que lo que se
 * acota es esto y no aquéllo.
 */
const BARRA = Object.freeze({ x: 0, y: 0, ancho: 320, alto: 28 })

/** La misma barra, movida. */
const en = (x, y) => ({ ...BARRA, x, y })

describe('acotarAlViewport · la barra de título nunca se sale', () => {
  it('si cabe entera y está dentro, no se toca', () => {
    // El caso masivo: el usuario suelta el panel en mitad de la pantalla. Acotar
    // no es recolocar — un panel que salta al soltarlo se siente roto.
    expect(acotarAlViewport(en(400, 300), VENTANA)).toEqual({ x: 400, y: 300 })
  })

  it('se sale por la DERECHA: vuelve justo hasta pegar el canto', () => {
    // 1280 − 320 = 960 es la última x en la que la barra entra entera. Se
    // comprueba el valor exacto y no un `toBeLessThan`: «vuelve un poco» y
    // «vuelve lo justo» se distinguen aquí y no en el navegador.
    expect(acotarAlViewport(en(1200, 100), VENTANA)).toEqual({ x: 960, y: 100 })
  })

  it('se sale por ABAJO: vuelve justo hasta pegar el canto', () => {
    expect(acotarAlViewport(en(100, 715), VENTANA)).toEqual({ x: 100, y: 692 })
  })

  it('con `x` NEGATIVA vuelve a 0, y el eje que estaba bien no se mueve', () => {
    // Arrastrar hacia la izquierda más allá del borde es el gesto más fácil de
    // hacer sin querer, porque el ratón sigue existiendo fuera de la ventana.
    expect(acotarAlViewport(en(-240, 300), VENTANA)).toEqual({ x: 0, y: 300 })
  })

  it('⛔ el CUERPO del panel sí puede salirse por abajo: se acota la BARRA', () => {
    // La prueba que da sentido al fichero entero. El panel mide 520 px de alto y
    // se suelta a 600 px del techo: se sale 400 px por abajo. Eso se PERMITE
    // —incómodo, no roto: se lee peor y se arrastra hacia arriba—, y la barra se
    // queda dentro, que es lo único innegociable.
    const PANEL_ALTO = 520
    const soltado = { x: 100, y: 600, ancho: 320, alto: 28 }

    const acotado = acotarAlViewport(soltado, VENTANA)

    expect(acotado, 'la barra cabe a 600, así que no se toca').toEqual({ x: 100, y: 600 })
    expect(
      acotado.y + PANEL_ALTO,
      'y el cuerpo se sale por abajo, que es exactamente lo permitido',
    ).toBeGreaterThan(VENTANA.alto)
  })

  it('la VENTANA MÁS PEQUEÑA que el panel no deja hueco contra el borde', () => {
    // Un navegador partido en dos, o un móvil apaisado: la barra de 320 no cabe
    // en 240. Entonces las posiciones legítimas son las que la hacen cubrir el
    // ancho entero, `[-80, 0]`, y ni una más.
    const estrecha = { ancho: 240, alto: 400 }

    expect(acotarAlViewport(en(50, 10), estrecha), 'pegada a la izquierda').toEqual({
      x: 0,
      y: 10,
    })
    expect(acotarAlViewport(en(-500, 10), estrecha), 'pegada a la derecha').toEqual({
      x: -80,
      y: 10,
    })
    expect(
      acotarAlViewport(en(-40, 10), estrecha),
      '⚠️ y una posición intermedia que YA cubre el ancho se respeta: acotar no es recolocar',
    ).toEqual({ x: -40, y: 10 })
  })

  it('una ventana de 0×0 devuelve números y NO lanza', () => {
    // Pasa de verdad: una pestaña de fondo, un `iframe` sin maquetar y jsdom
    // miden 0. Lanzar aquí convertiría un estado transitorio y normal en una
    // excepción en consola.
    const cero = { ancho: 0, alto: 0 }
    let acotado
    expect(() => {
      acotado = acotarAlViewport(en(120, 90), cero)
    }).not.toThrow()
    expect(Number.isFinite(acotado.x) && Number.isFinite(acotado.y)).toBe(true)
  })

  it('es IDEMPOTENTE: acotar lo acotado no mueve nada', () => {
    // Es lo que permite llamarla en cada `resize` y en cada paso del arrastre sin
    // que el panel derive hacia una esquina a fuerza de correcciones.
    const primera = acotarAlViewport(en(9000, -9000), VENTANA)
    const segunda = acotarAlViewport({ ...BARRA, ...primera }, VENTANA)
    expect(segunda).toEqual(primera)
  })
})

describe('acotarAlViewport · el contrato se caza en el borde', () => {
  // Un `NaN` que se deja entrar sale por el otro lado como `style.left='NaNpx'`,
  // que el navegador ignora EN SILENCIO: el panel se queda quieto y no hay
  // síntoma. Por eso el contrato lanza en vez de redondear a 0.
  it('un rectángulo que no es objeto lanza diciendo qué llegó', () => {
    expect(() => acotarAlViewport(null, VENTANA)).toThrow(/'barra'.*null/s)
    expect(() => acotarAlViewport(BARRA, undefined)).toThrow(/'ventana'.*undefined/s)
  })

  it('un número que no es finito lanza NOMBRANDO la clave', () => {
    expect(() => acotarAlViewport({ ...BARRA, x: NaN }, VENTANA)).toThrow(/'barra\.x'/)
    expect(() => acotarAlViewport({ ...BARRA, alto: Infinity }, VENTANA)).toThrow(/'barra\.alto'/)
    expect(() => acotarAlViewport(BARRA, { ancho: 800 })).toThrow(/'ventana\.alto'/)
  })
})
