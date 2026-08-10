/* -------------------------------------------------------------------------- *
 * test/estilos/cascara.test.js — Topbar · rebanada 1 · T5                      *
 *                                                                              *
 * ⛔ **HASTA HOY `estilos/app.css` NO TENÍA NI UNA PRUEBA, y costó un defecto  *
 * VIVO.** La regla que presentaba el informe a pantalla completa colgaba de    *
 * `.gml-app[data-paso='informe']`; el paso «Informe» se retiró del enum en el  *
 * rework y el selector dejó de poder casar. El diálogo siguió creyéndose «modo *
 * pantalla» por dentro —`show()` en vez de `showModal()`— y salió dibujado     *
 * como una tarjeta de 760×634 durante meses. **7.374 pruebas en verde y nadie  *
 * lo vio**: las de `app/` afirman el MARCADO, y jsdom no aplica esta hoja.     *
 *                                                                              *
 * ── QUÉ PUEDE Y QUÉ NO PUEDE ESTA SUITE ──                                    *
 * Lee la hoja como TEXTO. **No maqueta nada**: no sabe cuánto mide el mapa ni  *
 * si el panel desborda — eso es del guion de humo 14, en un navegador de       *
 * verdad, y no se sustituye. Lo que sí puede, y es justo el hueco que se       *
 * abrió, es afirmar que **la hoja y el código hablan del mismo mundo**: que    *
 * ningún selector cite un paso que ya no existe, que ninguna regla use una     *
 * variable retirada, que ninguna área de la rejilla se quede sin dueño.        *
 *                                                                              *
 * Corre en el proyecto `node` a propósito. Es el bucle rápido, y una hoja que  *
 * miente hay que verla en el primer `npm run test:node`, no en el último.      *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { PASOS } from '../../app/navegacion.js'
import { ATRIBUTO_ESTADO, CLASE, ESTADO } from '../../app/barra.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const RUTA_HOJA = join(RAIZ, 'estilos', 'app.css')

const FUENTE = readFileSync(RUTA_HOJA, 'utf8')

/**
 * La hoja **sin comentarios**, que es la única que el navegador aplica.
 *
 * ⚠️ No es un detalle: este fichero se documenta a base de comentarios largos que
 * CITAN selectores y variables —incluidas las retiradas, para dejar dicho que se
 * retiraron—. Afirmar sobre el texto crudo daría rojo por la propia
 * documentación, que es la peor forma de castigar a quien escribe el porqué.
 */
const VIVO = FUENTE.replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Los tokens, que también declaran variables que esta hoja usa. */
const TOKENS = ['colors', 'fonts', 'motion', 'spacing', 'typography']
  .map((n) => readFileSync(join(RAIZ, 'estilos', 'tokens', `${n}.css`), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Todo lo que casa un patrón, sin repetidos. @param {RegExp} re @param {string} texto */
const todos = (re, texto = VIVO) => [...new Set([...texto.matchAll(re)].map((m) => m[1]))]

// ═════════════════════════════════════════════════════════════════════════════

describe('T5 · el eje PASO: la hoja no puede citar un paso que no existe', () => {
  it('⭐ los `data-paso` del CSS son EXACTAMENTE los `PASOS` del código', () => {
    // ⛔ ÉSTE es el guardián que faltaba. Con él puesto, las tres reglas muertas
    // de la rebanada 0 —dos en el eje PASO y la del diálogo del informe— habrían
    // salido rojas el día que `PASO.VALIDACION` y `PASO.INFORME` dejaron el enum,
    // en vez de sobrevivir meses pintando (o dejando de pintar) en silencio.
    const citados = todos(/\[data-paso=['"]([a-z-]+)['"]\]/g).sort()
    expect(citados).toEqual([...PASOS].sort())
  })

  it('y hay una regla de ocultación por cada paso, ni una más ni una menos', () => {
    // CSS no puede comparar el atributo de un ancestro con el de un descendiente,
    // así que el eje PASO es una regla mecánica por paso. Que sean tantas como
    // pasos es lo que impide que se olvide una al añadir el cuarto.
    const reglas = [
      ...VIVO.matchAll(
        /\.gml-app\[data-paso=['"]([a-z-]+)['"]\]\s+\[data-pantalla\]:not\(\[data-pantalla~=['"]([a-z-]+)['"]\]\)/g,
      ),
    ]
    expect(reglas).toHaveLength(PASOS.length)
    // Y cada una habla de SU paso: un copiar-pegar con el `:not()` sin cambiar
    // ocultaría la pantalla equivocada, y a simple vista no se ve.
    for (const [, enElAncestro, enElHijo] of reglas) {
      expect(enElHijo, `la regla de «${enElAncestro}» excluye «${enElHijo}»`).toBe(enElAncestro)
    }
  })
})

describe('T5 · la rejilla de la cáscara', () => {
  /** El bloque de declaraciones de un selector, o `null`. @param {string} sel */
  const bloqueDe = (sel) => {
    const i = VIVO.indexOf(sel + ' {')
    if (i === -1) return null
    return VIVO.slice(i, VIVO.indexOf('}', i))
  }

  it('`.gml-app` es una rejilla con áreas, no un flex', () => {
    // La cáscara fue `display:flex` de tres columnas hasta el 2026-08-10. Se
    // afirma la forma NUEVA para que volver a la vieja sin querer sea rojo: los
    // tres hijos declaran `grid-area` y en un flex esa declaración no hace nada.
    const bloque = bloqueDe('.gml-app')
    expect(bloque).not.toBeNull()
    expect(bloque).toMatch(/display:\s*grid/)
    expect(bloque).toMatch(/grid-template-areas:/)
  })

  it('⭐ cada área declarada tiene dueño, y cada dueño un área declarada', () => {
    // Los dos lados del mismo fallo, y ninguno lanza:
    //   · un área sin dueño es una franja de pantalla en blanco;
    //   · un `grid-area` que no existe en la plantilla NO es un error de CSS: el
    //     hijo se coloca por AUTO-PLACEMENT y se inventa una fila implícita, así
    //     que la cáscara crece por abajo y el mapa se va fuera de la ventana.
    const plantilla = /grid-template-areas:\s*([^;]+);/.exec(VIVO)
    expect(plantilla).not.toBeNull()
    const declaradas = new Set(
      [...plantilla[1].matchAll(/'([^']+)'/g)].flatMap((m) => m[1].trim().split(/\s+/)),
    )
    const asignadas = new Set(todos(/grid-area:\s*([a-z-]+)\s*;/g))

    expect([...asignadas].sort()).toEqual([...declaradas].sort())
  })

  it('⛔ `--gml-rail-ancho` está RETIRADA: ninguna regla viva la usa', () => {
    // Era el ancho de la columna del rail. La cáscara ya no tiene esa columna, y
    // una variable de columna sin columna es exactamente lo que mantuvo viva
    // durante meses la regla muerta del diálogo del informe. Se comprueba sobre
    // `VIVO` para que los comentarios SÍ puedan seguir nombrándola: dejar dicho
    // que algo se retiró es la mitad del valor de retirarlo.
    expect(VIVO).not.toContain('--gml-rail-ancho')
  })
})

describe('T5 · las variables locales: usadas y declaradas, sin huérfanas', () => {
  const declaradas = new Set(todos(/(--gml-[a-z0-9-]+)\s*:/g))
  const usadas = new Set(todos(/var\((--gml-[a-z0-9-]+)/g))
  const enTokens = new Set(todos(/(--gml-[a-z0-9-]+)\s*:/g, TOKENS))

  it('toda `var(--gml-…)` que se usa está declarada en alguna parte', () => {
    // Una `var()` sin declarar no lanza: la propiedad se queda en su valor
    // inicial y el navegador sigue. Un `width: var(--gml-que-no-existe)` es un
    // `width: auto`, y eso puede tardar semanas en verse.
    for (const v of usadas) {
      expect(declaradas.has(v) || enTokens.has(v), `«${v}» se usa y no se declara`).toBe(true)
    }
  })

  it('y no queda ninguna declarada que ya no use nadie (salvo las de JavaScript)', () => {
    // Las que lee `app/` o `viewer/` con `getComputedStyle` no aparecen en ningún
    // `var()` de la hoja, y son legítimas. Se nombran una a una: la lista corta y
    // explícita es lo que hace que la próxima huérfana de verdad se vea.
    const LEIDAS_DESDE_JS = new Set(['--gml-color-usuario'])
    const huerfanas = [...declaradas].filter((v) => !usadas.has(v) && !LEIDAS_DESDE_JS.has(v))
    expect(huerfanas).toEqual([])
  })
})

describe('T5 · el contrato de clases con `app/barra.js`', () => {
  it('⭐ toda clase que exporta `CLASE` tiene reglas en la hoja', () => {
    // El comentario del bloque de la barra dice que estas cadenas «se CITAN, no
    // se copian de oído: si un nombre cambia allí, estas reglas quedan muertas y
    // no lo dice nadie». Hasta hoy el único que lo decía era el guion de humo 14,
    // que hay que lanzar a mano en un navegador. Ahora lo dice `npm test`.
    for (const clase of Object.values(CLASE)) {
      // ⚠️ Con frontera, y lo destapó una prueba de mutación: `toContain('.gml-rail-renglon')`
      // daba VERDE sobre una hoja donde la clase se había renombrado a
      // `.gml-rail-renglonX` — es decir, sobre el fallo exacto que este `it`
      // existe para cazar. Un guardián que se traga su propia mutación no es un
      // guardián.
      const conFrontera = new RegExp(`\\.${clase}(?![\\w-])`)
      expect(VIVO, `«.${clase}» no tiene ni una regla`).toMatch(conFrontera)
    }
  })

  it('y los tres estados se pintan desde `data-rail-estado` y de ningún otro sitio', () => {
    // La regla dura de la casa: UN atributo, un dueño. Se comprueba que los tres
    // valores estén escritos y que el aspecto NO se cuelgue de `aria-current`,
    // que es la segunda fuente por la que este proyecto ya ha pasado.
    for (const estado of Object.values(ESTADO)) {
      expect(VIVO, `falta el estado «${estado}»`).toContain(`[${ATRIBUTO_ESTADO}='${estado}']`)
    }
    // ⚠️ La prohibición es DE ESTE COMPONENTE, no de la hoja. `aria-current` sí
    // se usa —y bien— en `.gml-tabla-vertices .gml-fila-vertice`, donde el propio
    // bloque razona por qué allí es el atributo correcto. Afirmarlo sobre la hoja
    // entera puso rojo un uso legítimo en la primera pasada de esta suite.
    const reglasDeLaBarra = [...VIVO.matchAll(/\.gml-rail[a-z-]*[^{;}]*\{/g)].map((m) => m[0])
    expect(reglasDeLaBarra.length).toBeGreaterThan(0)
    for (const regla of reglasDeLaBarra) {
      expect(regla, 'la barra no puede pintarse desde `aria-current`').not.toContain('aria-current')
    }
  })
})

describe('T5 · las dos reglas duras de la hoja', () => {
  it('⛔ cero declaraciones con la palabra clave de prioridad de CSS', () => {
    // «Cuando hace falta ganar una cascada se sube la especificidad, nunca se
    // fuerza el peso» — cabecera de `estilos/app.css`. Llevaba doce fases
    // cumpliéndose sin que nada lo vigilara.
    expect(VIVO).not.toMatch(/!\s*important/i)
  })

  it('la hoja importa los cinco ficheros de tokens y ninguna hoja de fuera', () => {
    const importados = todos(/@import\s+'([^']+)'/g, VIVO)
    expect(importados.sort()).toEqual([
      './tokens/colors.css',
      './tokens/fonts.css',
      './tokens/motion.css',
      './tokens/spacing.css',
      './tokens/typography.css',
    ])
    // ⚠️ Se afirma sobre la LISTA de `@import`, no sobre la palabra «leaflet»: la
    // hoja está llena de reglas `.leaflet-*` legítimas —el cromo del mapa— y la
    // primera pasada de esta suite las puso rojas a todas. Lo que no puede pasar
    // es que `leaflet.css` se importe DESDE AQUÍ: lo importa `app/main.js`, que es
    // la entrada de la aplicación, y cambiarlo alteraría el orden de la cascada
    // que razona el comentario de `index.html`.
    for (const ruta of importados) expect(ruta).not.toMatch(/leaflet/i)
  })
})
