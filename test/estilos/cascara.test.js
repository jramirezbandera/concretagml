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

import { readFileSync, readdirSync } from 'node:fs'
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

describe('los tokens del sistema de diseño: ninguno declarado sin llamante', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ⛔ **ÉSTE ES EL GUARDIÁN QUE FALTABA, Y SU AUSENCIA COSTÓ 71 VARIABLES.**
  // ═══════════════════════════════════════════════════════════════════════════
  // El bloque de arriba vigila las huérfanas `--gml-*`, o sea las que escribe este
  // proyecto. **Los tokens de `estilos/tokens/` no los vigilaba nadie**, y esa
  // asimetría es exactamente el agujero por el que `estilos/tokens/` se pasó
  // dieciséis fases siendo el sistema de color de una calculadora de hormigón: de
  // sus 120 variables, 71 no tenían un solo `var()` en todo el producto — catorce
  // de armaduras y tensiones, trece de estratos geotécnicos, cuatro de casos de
  // carga, las ocho dimensiones de una cáscara que esta app no tiene, y los
  // diecinueve alias cortos de un sitio de marketing que no existe.
  //
  // Se podaron el 2026-08-11 (ver la cabecera de `estilos/tokens/colors.css` y el
  // asiento de esa fecha en `scripts/presupuesto-css.mjs`), y esta prueba es la
  // parte que impide que vuelva a pasar. **La deuda no se cierra borrando: se
  // cierra borrando y poniendo quien avise.**
  //
  // ⚠️ Y no basta con mirar `app.css`: hay tokens que se leen desde JavaScript
  // —`--color-btn-primary-bg` lo usan los cuatro cajones de `viewer/`, que se
  // visten EN LÍNEA porque no pueden importar CSS—, así que el barrido tiene que
  // pasar por el código. Mirar solo la hoja daría cuatro falsos positivos y la
  // primera reacción de quien los viera sería añadir una lista de excepciones.
  const FUENTES_JS = ['app', 'viewer', 'edificio', 'edit', 'report', 'export', 'config']

  /** Todo el texto donde una `var(--token)` puede aparecer. */
  const CONSUMIDORES = (() => {
    const trozos = [VIVO, TOKENS, readFileSync(join(RAIZ, 'index.html'), 'utf8')]
    for (const dir of FUENTES_JS) {
      for (const rel of readdirSync(join(RAIZ, dir), { recursive: true })) {
        const nombre = String(rel)
        if (nombre.endsWith('.js')) trozos.push(readFileSync(join(RAIZ, dir, nombre), 'utf8'))
      }
    }
    return trozos.join('\n')
  })()

  const declarados = todos(/^\s*(--[a-z0-9-]+)\s*:/gim, TOKENS)

  it('⭐ cada variable de `estilos/tokens/` tiene al menos un `var()` que la use', () => {
    // Anti-vacuidad: si el barrido dejara de encontrar declaraciones, el `for` de
    // abajo pasaría sobre una lista vacía y la prueba sería verde y muda.
    expect(declarados.length).toBeGreaterThan(40)

    const huerfanos = declarados.filter((v) => !CONSUMIDORES.includes(`var(${v})`))
    expect(
      huerfanos,
      `tokens declarados que nadie usa: si son producto que llega mañana, el sitio para ` +
        `dejarlo escrito es el comentario de su bloque, no este fichero`,
    ).toEqual([])
  })

  it('⛔ y el tema oscuro sigue RETIRADO: `data-theme` no vuelve sin cablearse', () => {
    // El bloque `html[data-theme="dark"]` estaba completo y muerto: ~45 tokens y
    // `data-theme` sin aparecer en ningún `.js`, `.html` ni en `app.css`. Se retiró
    // el 2026-08-11 con el motivo medido (la app tiene ~150 hex literales en
    // `viewer/`, `report/` y `export/`, que ningún tema alcanza), y `DESIGN.md`
    // declara esta aplicación como de tema CLARO.
    //
    // ⚠️ Lo que esta prueba prohíbe **no es el tema oscuro**: es que vuelva a
    // aparecer una hoja de tema que nadie enciende. Si algún día se cablea de
    // verdad, `data-theme` estará en el código y esta aserción hay que cambiarla
    // conscientemente — que es justo lo que se quiere que pase.
    expect(TOKENS).not.toContain('data-theme')
    expect(VIVO).not.toContain('data-theme')

    // Y la declaración que SÍ se queda, porque no es un resto: sin ella un sistema
    // en modo oscuro pinta los `<input>` oscuros dentro de un panel blanco.
    expect(TOKENS).toMatch(/color-scheme:\s*light/)
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

// ═════════════════════════════════════════════════════════════════════════════
// T6 · LOS DOS «ENCENDIDOS» DE LA BARRA DE EDICIÓN NO SE PINTAN IGUAL
// ═════════════════════════════════════════════════════════════════════════════
//
// ⛔ **EL DEFECTO QUE ESTE BLOQUE CIERRA ESTUVO VIVO Y MEDIDO.** El 2026-08-20, en
// Chrome, con el ajuste puesto y «Insertar vértices» armado, los dos daban
// `rgb(3, 105, 161)`: mismo fondo, mismo color de icono, píxel por píxel. Y no son
// la misma cosa —
//
//   · **el ajuste al parcelario** es un AJUSTE PERSISTENTE: nace puesto, sigue
//     puesto expediente tras expediente y no cambia lo que hace el clic siguiente,
//     cambia dónde CAE;
//   · **insertar / borrar / dibujar** son MODOS ARMADOS: duran lo que duran, son
//     excluyentes y sí cambian lo que hace el clic siguiente.
//
// Pintar los dos contratos con el mismo bloque azul no era coherencia: era una
// homonimia, y se veía uno al lado del otro. Ninguna prueba de `test/viewer/`
// podía cazarlo —jsdom no aplica esta hoja— y ninguna captura en reposo tampoco,
// porque hace falta tener un modo armado a la vez. Por eso el guardián vive aquí,
// sobre el TEXTO de la hoja, que es lo único que hay antes del navegador.
describe('T6 · el ajuste encendido y un modo armado son dos cosas distintas', () => {
  /**
   * El cuerpo de una regla, buscándola por su selector EXACTO en la hoja viva.
   * Lanza si no la encuentra: un guardián que no localiza a su sujeto pasa en
   * verde sin vigilar nada, que es exactamente lo que no queremos.
   */
  const cuerpo = (selector) => {
    const i = VIVO.indexOf(selector)
    if (i === -1) throw new Error(`test/estilos/cascara.test.js: la hoja ya no tiene «${selector}»`)
    const abre = VIVO.indexOf('{', i)
    const cierra = VIVO.indexOf('}', abre)
    return VIVO.slice(abre + 1, cierra)
  }

  const CHIP = ".gml-app .gml-barra-conmutador:checked + .gml-barra-conmutador-rotulo"
  const ARMADO = ".gml-app .gml-barra-herramienta[aria-pressed='true']"

  it('⭐ el MODO ARMADO se queda el bloque macizo', () => {
    // Es el estado transitorio y el que cambia lo que hace el clic siguiente, así
    // que es el que tiene derecho al registro fuerte. Y el token es del sistema
    // (`--color-btn-primary-bg`, ≈5,7:1 con su `fg`), no un color inventado aquí.
    expect(cuerpo(ARMADO)).toMatch(/background:\s*var\(--color-btn-primary-bg\)/)
  })

  it('⛔ y el AJUSTE ENCENDIDO ya no puede usar ese mismo fondo', () => {
    // Ésta es la regresión exacta: hasta T6 esta regla decía
    // `background: var(--color-btn-primary-bg)`, igual que la de arriba.
    expect(cuerpo(CHIP)).not.toMatch(/var\(--color-btn-primary-bg\)/)
    // Lo que usa es el acento MEZCLADO, que es la receta que ya tienen
    // `.gml-via-marca` y `::selection`: en este sistema no hay token de «acento
    // suave» y no se inventa un hexadecimal.
    expect(cuerpo(CHIP)).toMatch(/background:\s*color-mix\(in srgb, var\(--color-accent\)/)
  })

  it('⭐ el encendido del ajuste se dice con TRES señales, y ninguna es un bloque', () => {
    // El tinte solo da 1,23:1 contra el blanco de la barra —medido—, o sea que
    // como única señal sería un matiz, y éste es el estado más consultado de la
    // barra. Las tres juntas se leen de un vistazo: fondo, tinta del icono y filo.
    // Es la misma receta del peldaño activo del topbar, que ya dice en esta app
    // que un filo de acento significa «éste está puesto».
    const regla = cuerpo(CHIP)
    expect(regla, 'falta el tinte').toMatch(/background:\s*color-mix/)
    expect(regla, 'falta la tinta del icono').toMatch(/color:\s*var\(--color-accent-hover\)/)
    expect(regla, 'falta el filo de 2 px').toMatch(/box-shadow:\s*inset 0 -2px 0 var\(--color-accent\)/)
  })

  it('⛔ el ajuste sigue siendo un `<input type="checkbox">` de verdad', () => {
    // Constraint del diseño: T6 es RE-VESTIR, no re-tipar. `app/main.js` lee
    // `.checked` y escucha `change`, y toda esta apariencia cuelga de `:checked`,
    // que solo existe si el nodo sigue siendo una casilla. Si alguien la
    // convirtiera en un `<button aria-pressed>`, estas reglas dejarían de casar
    // **en silencio** y el chip se quedaría apagado para siempre.
    expect(VIVO).toContain('.gml-barra-conmutador:checked')
    expect(cuerpo('.gml-app .gml-barra-conmutador')).toMatch(/appearance:\s*none/)
  })
})
