import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* -------------------------------------------------------------------------- *
 * test/estilos/tokens-definidos.test.js — F15                                  *
 *                                                                              *
 * ⛔ POR QUÉ EXISTE, Y QUÉ ENCONTRÓ EL DÍA QUE SE ESCRIBIÓ                      *
 *                                                                              *
 * `var(--lo-que-sea, fallback)` NO SE QUEJA si la propiedad no existe: usa el   *
 * fallback y sigue. Es una API diseñada para degradar en silencio, o sea la     *
 * forma exacta del fallo que este proyecto lleva doce fases persiguiendo — con  *
 * el agravante de que el comentario de al lado suele estar describiendo el      *
 * color que el usuario NO está viendo.                                          *
 *                                                                              *
 * Barrido del 2026-08-11 sobre las cinco hojas: **72 propiedades definidas, 67  *
 * usadas y TRES huérfanas**, las tres vivas desde hacía meses:                  *
 *                                                                              *
 *   · `--color-aviso` ×2 (`.gml-dialogo-importacion-bloqueo` de F18 y           *
 *     `.gml-dialogo-pegado-motivo` de F19). Sus comentarios prometían «el color *
 *     de aviso y NO rojo»; se pintaba el gris del borde. El real es             *
 *     `--color-state-warn`.                                                     *
 *   · `--color-state-error` ×1, y éste era el caro: `.gml-barra-menu-opcion--   *
 *     riesgo` es **«Vaciarlo»**, la única acción irreversible del menú de        *
 *     expediente. Se pintaba del color del texto normal, tipográficamente       *
 *     indistinguible de la opción de encima. El real es `--color-state-fail`.   *
 *                                                                              *
 * Los tres los destapó F15 al ir a REUTILIZAR el patrón para el bloque de       *
 * corrección del diccionario. Ninguno lo habría visto un test de componente:    *
 * jsdom no resuelve `var()`, y el navegador tampoco se queja.                    *
 *                                                                              *
 * Proyecto Vitest `node`: se lee disco y se cotejan cadenas. Ni jsdom ni CSSOM. *
 * -------------------------------------------------------------------------- */

const RAIZ = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Las hojas que se cargan juntas en producción. Es la unidad correcta de
 * análisis: `estilos/app.css` importa los tokens, así que una propiedad definida
 * en `tokens/colors.css` y usada en `app.css` está perfectamente definida.
 */
const HOJAS = Object.freeze([
  'estilos/app.css',
  'estilos/tokens/colors.css',
  'estilos/tokens/spacing.css',
  'estilos/tokens/typography.css',
  'estilos/tokens/motion.css',
])

const leer = (rel) => readFileSync(join(RAIZ, ...rel.split('/')), 'utf8')

/**
 * Quita los comentarios `/* … *\/`.
 *
 * ⚠️ No es cosmético: en este repositorio la hoja es también el registro de
 * diseño, y los comentarios CITAN nombres de propiedades constantemente —
 * incluidos, a propósito, los tres nombres huérfanos que este fichero documenta
 * arriba. Sin esta limpieza el guardián se acusaría a sí mismo por su propia
 * cabecera, que es la forma más tonta de morir.
 */
const sinComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Todo el CSS de producción, ya sin comentarios. */
const CSS = sinComentarios(HOJAS.map(leer).join('\n'))

/** `--algo:` → definida. */
const definidas = () => new Set([...CSS.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]))

/** `var(--algo` → usada. Incluye las que llevan fallback, que son el caso peligroso. */
const usadas = () => new Set([...CSS.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]))

describe('estilos · ninguna propiedad se usa sin estar definida', () => {
  it('el barrido no es vacuo: encuentra propiedades de verdad en las cinco hojas', () => {
    // Sin esto, un `HOJAS` mal escrito o una regex rota dejarían el guardián
    // dando verde sobre el vacío — que es exactamente cómo `validar:xsd` pasó
    // meses sin ejecutarse ni una vez.
    expect(HOJAS).toHaveLength(5)
    expect(definidas().size).toBeGreaterThan(50)
    expect(usadas().size).toBeGreaterThan(50)
    for (const hoja of HOJAS) expect(leer(hoja).length, hoja).toBeGreaterThan(0)
  })

  it('`sinComentarios` no se come el código y sí se come la prosa', () => {
    expect(sinComentarios('/* var(--inventada) */ a{color:var(--real)}')).not.toContain('inventada')
    expect(sinComentarios('/* nota */ a{color:var(--real)}')).toContain('var(--real)')
  })

  it('⛔ CERO propiedades huérfanas: `var()` con fallback degrada EN SILENCIO', () => {
    const def = definidas()
    const huerfanas = [...usadas()].filter((u) => !def.has(u)).sort()
    expect(
      huerfanas,
      'Estas propiedades se usan en el CSS y no las define nadie, así que lo que se pinta es su ' +
        'fallback —o `unset`— sin que nada avise. Comprueba el nombre contra estilos/tokens/: los ' +
        'tres casos históricos fueron erratas de nombre (`--color-aviso` por `--color-state-warn`, ' +
        '`--color-state-error` por `--color-state-fail`), no tokens que faltaran.',
    ).toEqual([])
  })

  it('los tres nombres que fueron erratas NO vuelven a aparecer', () => {
    // Nombrados uno a uno: la regla de arriba los cubre, pero cuando alguien
    // vuelva a teclear `--color-state-error` de memoria, este test le dice cuál
    // era el bueno en vez de solo señalar que sobra.
    for (const [malo, bueno] of [
      ['--color-aviso', '--color-state-warn'],
      ['--color-exito', '--color-state-ok'],
      ['--color-state-error', '--color-state-fail'],
    ]) {
      expect(CSS, `«${malo}» no existe: el token del sistema es «${bueno}»`).not.toContain(
        `var(${malo}`,
      )
    }
  })

  it('los tres tokens de estado que el sistema SÍ define siguen ahí', () => {
    const def = definidas()
    for (const t of ['--color-state-ok', '--color-state-warn', '--color-state-fail']) {
      expect(def.has(t), `falta el token ${t}`).toBe(true)
    }
  })
})
