/* -------------------------------------------------------------------------- *
 * test/app/main-medicion.dom.test.js — F18 · T4 · La costura del paso 17      *
 *                                                                            *
 * Guardianes de FUENTE sobre `app/main.js`. Lo que se comprueba aquí no lo    *
 * puede ver una prueba de comportamiento, porque son afirmaciones sobre       *
 * cómo está montado el ensamblaje y no sobre lo que hace:                     *
 *                                                                            *
 *   1. que el rechazo de F11 (`MENSAJE_DIBUJO_EN_PARCELA`) **no vuelve**;    *
 *   2. que el `.dxf`/`.txt` tiene DOS destinos y los elige la rama;          *
 *   3. que la lista de extensiones tiene UN dueño y no dos copias.            *
 *                                                                            *
 * El comportamiento —que un DXF soltado con la rama PARCELA entre como        *
 * medición— lo mide `test/app/main-edificio.dom.test.js` sobre la app viva,   *
 * y el recorrido completo `test/app/cableado-medicion.dom.test.js`.           *
 *                                                                            *
 * ⚠️ Va al proyecto `dom` aunque sea lectura de TEXTO, y no es un descuido:    *
 * importa `app/cableado-edificio.js` para leer su lista de extensiones de la   *
 * fuente de la verdad —no de una copia—, y ese módulo arrastra Leaflet, que    *
 * revienta sin `window`. Medido: `ReferenceError: window is not defined` en    *
 * `leaflet/src/core/Util.js`. La alternativa era afirmar la lista con una      *
 * expresión regular sobre el texto, que es exactamente la segunda copia que    *
 * esta prueba existe para impedir.                                             *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { EXTENSIONES as EXTENSIONES_EDIFICIO } from '../../app/cableado-edificio.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const fuente = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')

const MAIN = fuente('app', 'main.js')
const MEDICION = fuente('app', 'cableado-medicion.js')

/**
 * La fuente SIN comentarios. Hace falta de verdad: `app/main.js` conserva a
 * propósito el texto del mensaje borrado —documenta una decisión de F11 que fue
 * correcta en su momento— y un guardián ingenuo se acusaría a sí mismo por esas
 * líneas, que es la trampa que F17 ya pagó con tres guardianes que acusaban por la
 * forma del texto en vez de por el código.
 */
const sinComentarios = (texto) =>
  texto
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')

const MAIN_CODIGO = sinComentarios(MAIN)

describe('main · paso 17 · el rechazo de F11 no vuelve', () => {
  it('⛔ `MENSAJE_DIBUJO_EN_PARCELA` no existe como código', () => {
    // Mientras ese identificador viva, hay una rama que rechaza lo que la otra
    // acepta — y el botón «Elegir un fichero de medición…» de la pantalla de
    // Entrada vuelve a ser un cartel sin puerta detrás.
    expect(MAIN_CODIGO).not.toContain('MENSAJE_DIBUJO_EN_PARCELA')
  })

  it('⚠️ y el guardián NO es vacuo: el texto SÍ sigue en el fichero, como comentario', () => {
    // Anti-vacuidad. Si mañana alguien borra el comentario entero, esta prueba se
    // pone roja y avisa de que se ha perdido el porqué — que es justo lo que este
    // proyecto no borra: se conserva citado al lado de lo nuevo.
    expect(MAIN).toContain('MENSAJE_DIBUJO_EN_PARCELA')
    expect(MAIN).toMatch(/PARTES DE UN EDIFICIO/)
  })
})

describe('main · paso 17 · el dibujo tiene DOS destinos', () => {
  it('el paso 17 se monta con `cablearMedicion`', () => {
    expect(MAIN_CODIGO).toContain("from './cableado-medicion.js'")
    expect(MAIN_CODIGO).toMatch(/cablearMedicion\(\{/)
    expect(MAIN).toMatch(/──\s*17\s*·/) // la sección numerada, en su orden
  })

  it('⭐ el destino se resuelve por la RAMA y no se congela en el montaje', () => {
    // La referencia se declara adelantada y se lee DENTRO del `alFichero`: si se
    // capturara en el montaje, el paso 9 corre antes del 17 y sería siempre `null`.
    expect(MAIN_CODIGO).toMatch(/let medicionCableada = null/)
    expect(MAIN_CODIGO).toMatch(/ramaEnPantalla === RAMA\.EDIFICIO/)
    expect(MAIN_CODIGO).toMatch(/edificioCableado\s*:\s*medicionCableada/)
  })

  it('cada rama que no monta dice CUÁL, porque la otra sigue sirviendo', () => {
    expect(MAIN_CODIGO).toContain('MENSAJE_SIN_EDIFICIO_CABLEADO')
    expect(MAIN_CODIGO).toContain('MENSAJE_SIN_MEDICION_CABLEADA')
  })
})

describe('main · paso 17 · la lista de extensiones tiene UN dueño', () => {
  it('las dos ramas comparten `.dxf` y `.txt`', () => {
    expect([...EXTENSIONES_EDIFICIO]).toEqual(['.dxf', '.txt'])
  })

  it('⚠️ `cableado-medicion.js` NO declara su propia lista: dos listas divergen', () => {
    // La publica `cableado-edificio.js` desde F11 y allí se queda. `app/main.js` la
    // importa con el alias `EXTENSIONES_DIBUJO` porque desde F18 ya no describe un
    // destino: describe qué clase de fichero es.
    expect(MEDICION).not.toMatch(/export const EXTENSIONES\b/)
    expect(MAIN_CODIGO).toContain('EXTENSIONES as EXTENSIONES_DIBUJO')
    expect(MAIN_CODIGO).toContain('extensiones: EXTENSIONES_DIBUJO')
  })
})
