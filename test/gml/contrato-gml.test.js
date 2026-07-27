/* -------------------------------------------------------------------------- *
 * test/gml/contrato-gml.test.js — F04 · Los GUARDIANES de la capa `gml/`      *
 *                                                                             *
 * Los tests hermanos de este directorio comprueban lo que cada módulo HACE.   *
 * Este comprueba lo que la capa entera NO PUEDE HACER, que es una clase de    *
 * invariante distinta: nada de lo que hay aquí abajo se rompe con un fallo    *
 * visible. Se rompe EN VERDE, y el precio se paga semanas después —un         *
 * snapshot que cambia solo, un bundle que engorda, una suite `node` que       *
 * revienta al importar el barrel— cuando ya nadie relaciona causa y efecto.   *
 *                                                                             *
 * Sigue el patrón de `test/contrato.test.js`: RECORRIDO POR DISCO (la verdad  *
 * terreno es lo que hay en `gml/`, nunca una lista a mano), DETECTOR POR      *
 * REGEX sobre el texto, y —esto es lo que lo hace valer algo— la MITAD        *
 * ANTI-VACUIDAD de cada guardián: se comprueba también que el detector SÍ     *
 * dispara sobre un caso conocido. Un guardián que no puede fallar nunca no    *
 * es un guardián: es un test verde de adorno, y este repo ya tuvo uno (el     *
 * plugin `gmlSinProj4` de `vite.config.js`, que no disparaba y pasó por       *
 * bueno; se descubrió provocando el fallo a propósito).                       *
 *                                                                             *
 * LOS SEIS INVARIANTES:                                                       *
 *   1. `gml/` no lee el reloj → el GML es función pura de su entrada.         *
 *   2. De Turf, solo lo topológico y por subpaquete (regla de oro 6).         *
 *   3. `@turf/boolean-clockwise` es ORÁCULO DE TEST, jamás producción.        *
 *   4. El barrel expone las dos funciones y NO la entrega al usuario.         *
 *   5. `gml/` no arrastra DOM ni Leaflet: el barrel raíz carga en `node`.     *
 *   6. `gml/` es capa de DOMINIO: no importa de `test/`, `viewer/`,           *
 *      `services/` ni `app/`.                                                 *
 *                                                                             *
 * Proyecto Vitest `node`: se lee disco y se importa el barrel raíz, sin DOM.  *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import * as barrel from '../../index.js'

// ── Verdad-terreno: lo que hay EN DISCO ──────────────────────────────────────
// `import.meta.dirname`, no `new URL(...)` (convención del repo). La lista de
// módulos se DERIVA del directorio: si mañana aparece `gml/serialize-bu.js`,
// entra sola en todos los guardianes de abajo sin que nadie se acuerde de
// añadirla — que es justo lo que no ocurre con una lista escrita a mano.

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_GML = join(RAIZ, 'gml')

const MODULOS = readdirSync(DIR_GML, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.js'))
  .map((e) => e.name)
  .sort()

const FUENTE = Object.fromEntries(MODULOS.map((n) => [n, readFileSync(join(DIR_GML, n), 'utf8')]))

/** Lee un fichero cualquiera del repo por su ruta POSIX relativa. */
const fuenteDe = (rel) => readFileSync(join(RAIZ, ...rel.split('/')), 'utf8')

const PAQUETE = JSON.parse(fuenteDe('package.json'))

// ── Herramientas de los detectores ───────────────────────────────────────────

/**
 * Devuelve el fichero SIN sus líneas de comentario.
 *
 * Es la lección que dejó escrita `test/contrato.test.js` con proj4 y que aquí se
 * repite tres veces: las cabeceras de `gml/` MENCIONAN por su nombre justo lo
 * que está prohibido —`@turf/boolean-clockwise` en `gml/anillos.js`, `Blob` y
 * `document` en la cabecera de `gml/index.js`— precisamente para explicar por
 * qué no se usa. Un `includes('…')` sobre el texto entero daría falso positivo
 * en todos esos sitios, así que el análisis se hace sobre el CÓDIGO.
 *
 * @param {string} fuente
 * @returns {string}
 */
function codigoDe(fuente) {
  return fuente
    .split('\n')
    .filter((linea) => !/^\s*(?:\/\/|\/\*|\*)/.test(linea))
    .join('\n')
}

/**
 * Especificadores de módulo de un fichero: `import`/`export … from '…'` y las
 * formas llamadas `import(…)`/`require(…)`.
 *
 * Se casa por `from` y no por el principio de línea a propósito: en `gml/` hay
 * imports multilínea (`import {\n  A,\n  B,\n} from './x.js'`) cuya ruta vive en
 * una línea que empieza por `}`, y un detector anclado al `import` se los
 * saltaría enteros — en silencio, que es el modo de fallo que este fichero
 * persigue.
 *
 * @param {string} fuente
 * @returns {string[]}
 */
function especificadoresDe(fuente) {
  const RE = /\bfrom\s*['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g
  return [...codigoDe(fuente).matchAll(RE)].map((m) => m[1] ?? m[2])
}

/**
 * Nombres que un módulo exporta, leídos del TEXTO (`export const|function|class`).
 * No se importan los módulos para preguntárselo: `gml/descargar.js` es código de
 * navegador y este fichero corre en el proyecto `node` — poder analizarlo SIN
 * cargarlo es parte de lo que se está afirmando.
 *
 * @param {string} fuente
 * @returns {string[]}
 */
function exportacionesDe(fuente) {
  const RE = /^export\s+(?:const|let|var|async\s+function\*?|function\*?|class)\s+([\w$]+)/gm
  return [...fuente.matchAll(RE)].map((m) => m[1])
}

const IMPORTS = Object.fromEntries(MODULOS.map((n) => [n, especificadoresDe(FUENTE[n])]))
const EXPORTS = Object.fromEntries(MODULOS.map((n) => [n, exportacionesDe(FUENTE[n])]))

describe('contrato F04 · el recorrido de `gml/` no es vacuo', () => {
  it('encuentra los módulos en disco, incluidos el barrel y la descarga', () => {
    // Si este recorrido se quedara a cero (directorio renombrado, filtro roto),
    // los seis guardianes de abajo pasarían todos sin mirar nada.
    expect(MODULOS.length, 'el recorrido de gml/ no ha encontrado módulos').toBeGreaterThan(1)
    expect(MODULOS).toContain('index.js')
    expect(MODULOS).toContain('descargar.js')
    expect(MODULOS.every((n) => FUENTE[n].length > 0)).toBe(true)
  })

  it('los extractores de imports y exports leen lo que hay, no lo que se comenta', () => {
    // Auto-test de las dos herramientas, con el caso multilínea real de `gml/`.
    const multilinea = "import {\n  A,\n  B,\n} from './x.js'\n"
    expect(especificadoresDe(multilinea)).toEqual(['./x.js'])
    expect(especificadoresDe("// import x from 'prohibido'\n")).toEqual([])
    expect(especificadoresDe(" * ver `import x from 'prohibido'`\n")).toEqual([])
    expect(especificadoresDe("const m = await import('./y.js')\n")).toEqual(['./y.js'])
    expect(exportacionesDe('export const A = 1\nexport function b() {}\n')).toEqual(['A', 'b'])
    // Y sobre el disco: todo módulo de `gml/` importa o exporta algo.
    expect(IMPORTS['serialize-cp.js'].length).toBeGreaterThan(0)
    expect(EXPORTS['parse.js']).toContain('parsearGml')
  })
})

// ── 1 · El reloj ─────────────────────────────────────────────────────────────
// Si un módulo de `gml/` consultara la marca de tiempo del sistema, el GML que
// produce dejaría de ser función pura de su entrada: el snapshot del test de ida
// y vuelta (T4.1) cambiaría en CADA ejecución y ese test dejaría de afirmar
// nada. No fallaría —seguiría en verde tras actualizar el snapshot—, que es
// exactamente por qué hace falta un guardián y no basta con la convención.
//
// «Ahora» entra por parámetro: la capa de aplicación lo formatea con
// `dateTimeCatastro(…)` —que sale por el barrel justo por esto— y lo pasa hacia
// abajo como `beginLifespanVersion`. El detector mira el TEXTO ENTERO, no solo
// el código, para que las llamadas no aparezcan ni siquiera dentro de un
// comentario: es la regla que las cabeceras de `gml/` ya declaran por escrito.

describe('contrato F04 · `gml/` no lee el reloj del sistema', () => {
  const LEE_EL_RELOJ = /\bnew\s+Date\b|\bDate\s*\.\s*now\b/

  it('ningún módulo de gml/ instancia una fecha ni consulta Date.now', () => {
    const infractores = MODULOS.filter((n) => LEE_EL_RELOJ.test(FUENTE[n]))
    expect(
      infractores,
      'módulos de gml/ que leen el reloj: el GML dejaría de ser función pura de su ' +
        'entrada y el snapshot del round-trip cambiaría en cada ejecución. La fecha entra ' +
        'por parámetro (`beginLifespanVersion`), formateada con `dateTimeCatastro`',
    ).toEqual([])
  })

  it('el detector del reloj NO es vacuo: dispara sobre model/parcela.js', () => {
    // `crearExpediente` sella la fecha de creación del expediente con
    // `new Date().toISOString()`, y hace bien: ahí el reloj es el dato. Sirve de
    // caso conocido para probar que este detector distingue algo.
    expect(
      LEE_EL_RELOJ.test(fuenteDe('model/parcela.js')),
      'model/parcela.js ha dejado de usar new Date(): busca otro caso de control',
    ).toBe(true)
    expect(LEE_EL_RELOJ.test('const t = Date . now()')).toBe(true)
    expect(LEE_EL_RELOJ.test('if (fecha instanceof Date) return')).toBe(false)
  })
})

// ── 2 · Turf: solo lo topológico, y por subpaquete ───────────────────────────
// Regla de oro 6. Las funciones métricas de Turf (`area`, `distance`, `length`,
// `buffer`…) son GEODÉSICAS y esperan grados: sobre coordenadas UTM devuelven un
// número, no un error — un número absurdo, con la misma pinta que el bueno. Es
// el fallo silencioso más caro que puede tener este proyecto, porque la cifra
// acaba en un GML que se sube a la Sede.
//
// La lista de prohibidas NO se escribe aquí: se DERIVA de `spec/SPEC.md`, que es
// donde vive la regla. Mismo criterio que la guarda de partición de
// `test/contrato.test.js`, que lee los globs reales de `vitest.config.js` en vez
// de copiarlos. Si la regla se reescribe, este guardián la sigue; si se reescribe
// de forma que ya no se pueda leer, REVIENTA con mensaje en vez de quedarse
// mirando una lista vacía.
//
// La lista de SEGURAS no se deriva, a propósito y con su motivo: el spec las
// escribe comprimidas (`booleanContains/Within/Intersects`) y expandirlas a
// nombres de subpaquete sería adivinar. Lo que sí se comprueba es que todo
// `@turf/*` que use `gml/` esté declarado en `dependencies`.

describe('contrato F04 · de Turf, solo lo topológico y por subpaquete (regla 6)', () => {
  const META_PAQUETE = '@turf/turf'

  /** `nearestPointOnLine` → `@turf/nearest-point-on-line` (convención de npm). */
  const aSubpaquete = (nombre) =>
    `@turf/${nombre.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

  /** Las funciones que la regla de oro 6 prohíbe, leídas del spec. */
  function prohibidasDelSpec() {
    const MARCA = '**Prohibidas:**'
    const linea = fuenteDe('spec/SPEC.md')
      .split('\n')
      .find((l) => l.startsWith('6. ') && l.includes(MARCA))
    if (linea === undefined) {
      throw new Error(
        'contrato-gml: no se encuentra la regla de oro 6 en spec/SPEC.md (línea que ' +
          `empieza por «6. » y contiene «${MARCA}»). Este guardián DERIVA de ahí la lista ` +
          'de funciones métricas prohibidas de Turf; si la regla se ha reescrito, ' +
          'actualiza este lector ANTES de dar la lista por buena — una lista vacía ' +
          'dejaría el guardián en verde sin mirar nada.',
      )
    }
    const tramo = linea.slice(linea.indexOf(MARCA)).split('→')[0]
    const nombres = [...tramo.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/g)].map((m) => m[1])
    if (nombres.length < 4) {
      throw new Error(
        `contrato-gml: la regla de oro 6 solo ha dado ${nombres.length} nombre(s) ` +
          'prohibido(s). El formato de spec/SPEC.md ha cambiado: revisa el lector.',
      )
    }
    return nombres
  }

  const PROHIBIDOS = prohibidasDelSpec().map(aSubpaquete)
  const TURF_EN_GML = MODULOS.flatMap((n) => IMPORTS[n]).filter((s) => s.startsWith('@turf/'))

  it('la lectura del spec da los subpaquetes métricos que se esperan', () => {
    // Auto-test del traductor y ancla de la derivación: si `spec/SPEC.md` dejara
    // de nombrar estos cuatro, la lista se habría vaciado sin avisar.
    expect(aSubpaquete('area')).toBe('@turf/area')
    expect(aSubpaquete('nearestPointOnLine')).toBe('@turf/nearest-point-on-line')
    expect(PROHIBIDOS).toEqual(
      expect.arrayContaining(['@turf/area', '@turf/distance', '@turf/length', '@turf/buffer']),
    )
  })

  it('ningún módulo de gml/ importa el meta-paquete @turf/turf', () => {
    const infractores = MODULOS.filter((n) => IMPORTS[n].includes(META_PAQUETE))
    expect(
      infractores,
      'el meta-paquete arrastra TODO Turf al bundle (incluidas las métricas ' +
        'prohibidas): se importa por subpaquete, `@turf/kinks`',
    ).toEqual([])
  })

  it('ningún módulo de gml/ importa una función MÉTRICA de Turf', () => {
    const infractores = MODULOS.flatMap((n) =>
      IMPORTS[n].filter((s) => PROHIBIDOS.includes(s)).map((s) => `${n} → ${s}`),
    )
    expect(
      infractores,
      'imports de Turf geodésico: esas funciones esperan GRADOS y sobre UTM devuelven ' +
        'un número absurdo sin quejarse. La superficie es shoelace sobre UTM ' +
        '(geo/area.js) y las distancias, helpers euclídeos propios',
    ).toEqual([])
  })

  it('el detector de Turf prohibido NO es vacuo: dispara sobre imports de control', () => {
    const control =
      "import * as turf from '@turf/turf'\nimport area from '@turf/area'\n" +
      "import nearest from '@turf/nearest-point-on-line'\n"
    const vistos = especificadoresDe(control)
    expect(vistos).toContain(META_PAQUETE)
    expect(vistos.filter((s) => PROHIBIDOS.includes(s))).toEqual([
      '@turf/area',
      '@turf/nearest-point-on-line',
    ])
    // …y sobre lo que gml/ SÍ usa no dispara (si no, sería un detector que
    // prohíbe todo Turf, y eso no es la regla 6).
    expect(TURF_EN_GML.length, 'gml/ ha dejado de usar Turf: revisa el recorrido').toBeGreaterThan(
      0,
    )
    expect(TURF_EN_GML.filter((s) => PROHIBIDOS.includes(s) || s === META_PAQUETE)).toEqual([])
  })

  it('todo @turf que usa gml/ está declarado en `dependencies`, no en dev', () => {
    // Un subpaquete usado en producción pero declarado como devDependency
    // funciona en local y revienta en una instalación limpia con `--omit=dev`.
    for (const paquete of new Set(TURF_EN_GML)) {
      expect(PAQUETE.dependencies, `${paquete} no está en dependencies`).toHaveProperty(paquete)
      expect(PAQUETE.devDependencies ?? {}).not.toHaveProperty(paquete)
    }
  })
})

// ── 3 · El oráculo del signo no entra en producción ──────────────────────────
// `@turf/boolean-clockwise` es devDependency A PROPÓSITO: su sitio es
// `test/gml/anillos.test.js` y `test/gml/serialize-cp.test.js`, donde hace de
// ORÁCULO EXTERNO del sentido de giro, igual que proj4 lo hace del motor UTM.
//
// En producción el signo lo da `orientacion()` de `geo/area.js`, que TRASLADA A
// ORIGEN LOCAL antes del shoelace (regla de oro 5) porque con Norte ≈ 4·10⁶ la
// cancelación en float64 se come los dígitos que importan; turf opera sobre las
// coordenadas crudas. Dos fuentes para el mismo signo es la divergencia
// silenciosa que este repo entero persigue: el día que discrepen en un anillo
// casi degenerado, el GML sale con el exterior antihorario y lo rechaza el IVG.

describe('contrato F04 · @turf/boolean-clockwise es oráculo de test, no producción', () => {
  const ORACULO = '@turf/boolean-clockwise'

  it('ningún módulo de gml/ lo importa', () => {
    const infractores = MODULOS.filter((n) => IMPORTS[n].includes(ORACULO))
    expect(
      infractores,
      `${ORACULO} es el oráculo EXTERNO del signo en los tests. En producción el signo lo ` +
        'da orientacion() de geo/area.js, que traslada a origen local (regla 5); tener las ' +
        'dos fuentes es garantizar que algún día discrepen',
    ).toEqual([])
  })

  it('sigue siendo devDependency y no dependency', () => {
    expect(PAQUETE.devDependencies).toHaveProperty(ORACULO)
    expect(PAQUETE.dependencies ?? {}).not.toHaveProperty(ORACULO)
  })

  it('el detector NO es vacuo: dispara sobre el test que sí lo usa', () => {
    expect(especificadoresDe(fuenteDe('test/gml/anillos.test.js'))).toContain(ORACULO)
  })

  it('el detector distingue MENCIÓN de IMPORT (por eso no vale un `includes`)', () => {
    // `gml/anillos.js` nombra el oráculo en su cabecera para explicar POR QUÉ no
    // lo usa. Un `includes('@turf/boolean-clockwise')` sobre el texto entero lo
    // señalaría como infractor: misma trampa que las menciones de proj4 en
    // `test/contrato.test.js`.
    expect(
      FUENTE['anillos.js'].includes(ORACULO),
      'gml/anillos.js ha dejado de explicar por qué NO usa el oráculo',
    ).toBe(true)
    expect(IMPORTS['anillos.js']).not.toContain(ORACULO)
  })
})

// ── 4 · La superficie pública ────────────────────────────────────────────────
// El barrel raíz es lo que el resto del proyecto ve. Este guardián ata las dos
// mitades de la decisión escrita en la cabecera de `gml/index.js`: qué sale
// (las dos funciones y el vocabulario) y qué NO sale (la entrega al usuario y la
// fontanería XML).

describe('contrato F04 · el barrel raíz expone `gml` con la superficie curada', () => {
  const CLAVES = Object.keys(barrel.gml)

  // Los dos módulos que NO aportan nada al barrel, con su motivo. Es lo único
  // mantenido a mano de este bloque —dos nombres, no una lista de inventario— y
  // se comprueba abajo que los dos siguen existiendo en disco.
  const FUERA_DEL_BARREL = new Map([
    ['descargar.js', 'código de navegador: Blob, URL.createObjectURL y document'],
    ['xml.js', 'fontanería XML sin dominio, con nombres genéricos (texto, hijo, elem…)'],
  ])

  it('el barrel raíz expone el espacio de nombres `gml`', () => {
    expect(Object.keys(barrel)).toContain('gml')
    expect(CLAVES.length, 'el espacio de nombres `gml` está vacío').toBeGreaterThan(0)
  })

  it('parsearGml y serializarParcelaCp son funciones', () => {
    expect(typeof barrel.gml.parsearGml).toBe('function')
    expect(typeof barrel.gml.serializarParcelaCp).toBe('function')
  })

  it('NO expone la entrega al usuario (descargarGml, nombreFicheroGml)', () => {
    // `gml/descargar.js` necesita Blob, URL.createObjectURL y document. El
    // barrel raíz lo carga el proyecto Vitest `node` (lo importa
    // `test/contrato.test.js`), así que meterlo aquí es el mismo fallo que ya
    // tiene documentado el visor. Se importa DIRECTAMENTE desde `app/`.
    expect(CLAVES).not.toContain('descargarGml')
    expect(CLAVES).not.toContain('nombreFicheroGml')
    // Y NINGUNA otra clave suya, no solo esas dos.
    const deLaDescarga = EXPORTS['descargar.js']
    expect(CLAVES.filter((k) => deLaDescarga.includes(k))).toEqual([])
  })

  it('el guardián de la descarga NO es vacuo: descargar.js sí exporta esos nombres', () => {
    expect(EXPORTS['descargar.js']).toContain('descargarGml')
    expect(EXPORTS['descargar.js']).toContain('nombreFicheroGml')
    expect(EXPORTS['descargar.js'].length).toBeGreaterThan(2)
  })

  it('NO expone la fontanería XML: ninguna clave de gml/xml.js sale por aquí', () => {
    const delXml = EXPORTS['xml.js']
    expect(delXml, 'gml/xml.js ha dejado de exportar sus helpers genéricos').toEqual(
      expect.arrayContaining(['texto', 'hijo', 'elem', 'render']),
    )
    expect(
      CLAVES.filter((k) => delXml.includes(k)),
      'nombres genéricos de gml/xml.js publicados como API del proyecto',
    ).toEqual([])
  })

  it('toda clave del barrel es un export REAL de algún módulo de gml/', () => {
    // Cierra el riesgo propio de una superficie curada: un nombre que se cree
    // aquí y no corresponda a nada, o que sobreviva a la desaparición del
    // símbolo original.
    const union = new Set(MODULOS.flatMap((n) => EXPORTS[n]))
    expect(CLAVES.filter((k) => !union.has(k))).toEqual([])
  })

  it('todo módulo de gml/ aporta algo al barrel, salvo los dos que no deben', () => {
    // Si mañana aparece `gml/serialize-bu.js` y nadie decide si es público, este
    // test lo dice. La alternativa —no comprobarlo— es un módulo nuevo que no
    // sale por ningún sitio y que nadie echa de menos.
    for (const fichero of FUERA_DEL_BARREL.keys()) {
      expect(MODULOS, `${fichero} ya no existe: revisa la lista de excepciones`).toContain(fichero)
      expect(
        CLAVES.filter((k) => EXPORTS[fichero].includes(k)),
        `${fichero} no debe salir por el barrel (${FUERA_DEL_BARREL.get(fichero)})`,
      ).toEqual([])
    }
    const mudos = MODULOS.filter(
      (n) =>
        n !== 'index.js' &&
        !FUERA_DEL_BARREL.has(n) &&
        !EXPORTS[n].some((k) => CLAVES.includes(k)),
    )
    expect(
      mudos,
      'módulos de gml/ que no aportan ni un nombre al barrel: decide si son públicos ' +
        '(re-expórtalos en gml/index.js) o privados (añádelos a FUERA_DEL_BARREL con su motivo)',
    ).toEqual([])
  })
})

// ── 5 · Ni DOM ni Leaflet ────────────────────────────────────────────────────
// Este bloque se autoprueba en parte: el `import * as barrel` de arriba corre en
// el proyecto Vitest `node`, que no tiene `window`, así que si `gml/` arrastrara
// DOM o Leaflet ESTE fichero reventaría al cargarse. Pero la cabecera de
// `gml/index.js` afirma por escrito que la capa no arrastra ninguna de las dos
// cosas, y una afirmación escrita tiene que ser cierta: aquí está la aserción
// explícita, con el motivo en el mensaje para quien la haga fallar. Es el mismo
// razonamiento que `test/contrato.test.js` aplica al visor.

describe('contrato F04 · `gml/` no arrastra DOM ni Leaflet (el barrel carga en `node`)', () => {
  const GLOBAL_DE_NAVEGADOR = /\b(?:document|window|Blob|createObjectURL|localStorage)\b/
  const ES_LEAFLET = (s) => s === 'leaflet' || s.startsWith('leaflet/')

  it('importar el barrel raíz en el proyecto `node` no revienta', () => {
    // Si `gml/` metiera DOM o Leaflet, el import de la cabecera habría lanzado
    // `ReferenceError: document is not defined` y no se llegaría hasta aquí.
    expect(typeof barrel.gml).toBe('object')
    expect(typeof globalThis.document, 'este test debe correr SIN DOM').toBe('undefined')
  })

  it('ningún módulo del barrel nombra un global de navegador en su CÓDIGO', () => {
    const infractores = MODULOS.filter(
      (n) => n !== 'descargar.js' && GLOBAL_DE_NAVEGADOR.test(codigoDe(FUENTE[n])),
    )
    expect(
      infractores,
      'módulos de gml/ alcanzables desde el barrel que usan globales del DOM: el barrel ' +
        'raíz lo carga el proyecto Vitest `node`, que corre sin window. Si el módulo ' +
        'necesita el navegador, va FUERA del barrel, como gml/descargar.js',
    ).toEqual([])
  })

  it('el detector de DOM NO es vacuo: dispara sobre gml/descargar.js', () => {
    // Es la razón entera por la que ese módulo se queda fuera del barrel, y aquí
    // queda medida en lugar de solo escrita.
    expect(
      GLOBAL_DE_NAVEGADOR.test(codigoDe(FUENTE['descargar.js'])),
      'gml/descargar.js ha dejado de usar el DOM: quizá ya pueda entrar en el barrel',
    ).toBe(true)
    // Y no dispara por una MENCIÓN en comentario: la cabecera de gml/index.js
    // nombra Blob y document para explicar por qué no están.
    expect(GLOBAL_DE_NAVEGADOR.test(FUENTE['index.js'])).toBe(true)
    expect(GLOBAL_DE_NAVEGADOR.test(codigoDe(FUENTE['index.js']))).toBe(false)
  })

  it('ningún módulo de gml/ importa Leaflet', () => {
    const infractores = MODULOS.filter((n) => IMPORTS[n].some(ES_LEAFLET))
    expect(infractores, 'Leaflet exige window: es de viewer/, no de la capa de dominio').toEqual([])
  })

  it('el detector de Leaflet NO es vacuo: dispara sobre viewer/mapa.js', () => {
    expect(especificadoresDe(fuenteDe('viewer/mapa.js')).some(ES_LEAFLET)).toBe(true)
    expect(ES_LEAFLET('leaflet/dist/leaflet.css')).toBe(true)
    expect(ES_LEAFLET('leaflet-fake'), 'el detector casa el paquete, no el prefijo').toBe(false)
  })
})

// ── 6 · `gml/` es capa de DOMINIO ────────────────────────────────────────────
// Mismo criterio que `app/demo-datos.js` con `test/`: un import de `test/` en
// código de producción mete fixtures en el bundle, y un import de `viewer/`,
// `services/` o `app/` invierte la dependencia — la capa que genera el fichero
// pasaría a depender de la pantalla que lo enseña, y a partir de ahí ya no se
// puede reutilizar `gml/` desde ningún otro sitio (F08, F09) sin arrastrar la UI.

describe('contrato F04 · `gml/` no depende de la UI ni de los tests', () => {
  // Anclado a segmento de ruta a propósito: `vitest/config` CONTIENE «test/» y
  // un detector ingenuo lo señalaría. Hay un caso real en `vitest.config.js`.
  const CAPA_PROHIBIDA = /^(?:\.{1,2}\/)+(test|viewer|services|app)\//
  const VECINOS_PERMITIDOS = /^\.\/|^(?:\.\.\/)(?:geo|model)\//

  it('ningún módulo de gml/ importa de test/, viewer/, services/ ni app/', () => {
    const infractores = MODULOS.flatMap((n) =>
      IMPORTS[n].filter((s) => CAPA_PROHIBIDA.test(s)).map((s) => `${n} → ${s}`),
    )
    expect(
      infractores,
      'gml/ es capa de DOMINIO: importar de test/ mete fixtures en el bundle, e importar ' +
        'de viewer/, services/ o app/ invierte la dependencia y hace inservible gml/ ' +
        'fuera de esta pantalla',
    ).toEqual([])
  })

  it('los imports RELATIVOS de gml/ solo alcanzan gml/, geo/ y model/', () => {
    // Lista blanca, más fuerte que la lista negra de arriba: un directorio nuevo
    // de UI (`ui/`, `paneles/`…) no estaría en la negra y sí lo caza esta.
    const relativos = MODULOS.flatMap((n) =>
      IMPORTS[n].filter((s) => s.startsWith('.')).map((s) => `${n} → ${s}`),
    )
    expect(relativos.length, 'ningún import relativo: revisa el extractor').toBeGreaterThan(0)
    const fuera = MODULOS.flatMap((n) =>
      IMPORTS[n].filter((s) => s.startsWith('.') && !VECINOS_PERMITIDOS.test(s)).map(
        (s) => `${n} → ${s}`,
      ),
    )
    expect(fuera, 'vecinos de gml/ fuera de la lista blanca (gml/, geo/, model/)').toEqual([])
  })

  it('el detector de capas NO es vacuo, y no confunde `vitest/config` con `test/`', () => {
    // Caso real: `app/main.js` importa el visor. Es correcto AHÍ y sería un fallo
    // en `gml/`; el detector tiene que verlo.
    const deLaApp = especificadoresDe(fuenteDe('app/main.js'))
    expect(deLaApp.some((s) => CAPA_PROHIBIDA.test(s))).toBe(true)
    expect(CAPA_PROHIBIDA.test('../test/fixtures/gml/cp_parcela.gml')).toBe(true)
    expect(CAPA_PROHIBIDA.test('../../services/ign.js')).toBe(true)
    // La trampa: el paquete `vitest/config` lleva «test/» dentro y NO es una capa.
    expect(CAPA_PROHIBIDA.test('vitest/config')).toBe(false)
    expect(CAPA_PROHIBIDA.test('../geo/area.js')).toBe(false)
    expect(VECINOS_PERMITIDOS.test('../model/parcela.js')).toBe(true)
    expect(VECINOS_PERMITIDOS.test('../viewer/index.js')).toBe(false)
  })
})
