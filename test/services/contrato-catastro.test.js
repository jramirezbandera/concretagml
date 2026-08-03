/* -------------------------------------------------------------------------- *
 * test/services/contrato-catastro.test.js — F05 · T5A                          *
 * LOS GUARDIANES TRANSVERSALES: lo que ninguna tarea de F05 podía escribir      *
 *                                                                              *
 * Los tests hermanos comprueban lo que cada módulo HACE. Este comprueba lo que  *
 * F05 ENTERA no puede hacer, y son invariantes que CRUZAN módulos: ninguno      *
 * cabía dentro de una sola tarea, porque ninguna tarea ve a la vez `services/`, *
 * `storage/`, `app/` y el `index.html`.                                        *
 *                                                                              *
 * Nada de lo que hay aquí abajo se rompe con un fallo visible. Se rompe EN      *
 * VERDE, y el precio se paga semanas después: un motivo que nadie ha visto      *
 * nunca tranquilizando a quien lee el enum, una cabecera que provoca un         *
 * *preflight* que jamás se midió, un `TextDecoder` que convierte bytes buenos   *
 * en texto roto, una segunda base de servicio que nadie sabe que existe, un     *
 * `import` que invierte una capa, o un `data-*` que desaparece del HTML y deja  *
 * un botón muerto que ningún test de módulo ve.                                *
 *                                                                              *
 * ── LA DISCIPLINA, HEREDADA DE `test/contrato.test.js` Y DE `contrato-gml` ──  *
 *   · RECORRIDO POR DISCO: la verdad-terreno es lo que hay en el árbol, nunca   *
 *     una lista escrita a mano. Un módulo nuevo entra solo en los guardianes.   *
 *   · DETECTOR POR REGEX sobre el TEXTO, no importando el módulo: `app/` y      *
 *     `viewer/wms-catastro.js` importan Leaflet y este fichero corre en el      *
 *     proyecto `node`, sin `window`. Poder analizarlos SIN cargarlos es parte   *
 *     de lo que se está afirmando.                                             *
 *   · MITAD ANTI-VACUIDAD: **cada detector se ejecuta también contra una        *
 *     fuente sintética que SÍ infringe la regla**, y se afirma que dispara.     *
 *     Un guardián que no puede fallar nunca no es un guardián: es un test verde *
 *     de adorno. Este repo ya tuvo dos —el plugin `gmlSinProj4` de              *
 *     `vite.config.js`, que no disparaba, y `npm run validar:xsd`, que salía    *
 *     `SALTADO` con código 0 y no llegó a ejecutarse ni una vez (SPEC §3.1)—.   *
 *   · Y una lección propia de este fichero, que se repite cuatro veces: **las   *
 *     cabeceras de `services/` HABLAN de lo que está prohibido** (`User-Agent`, *
 *     `TextDecoder`, `'latin1'`, `services/catastro.js`) precisamente para      *
 *     explicar por qué no se toca. Un detector que leyera el fichero entero     *
 *     confundiría la explicación con la infracción. Se mira el CÓDIGO, y se     *
 *     comprueba que el filtro de comentarios no se ha comido el código.         *
 *                                                                              *
 * ── LOS SEIS GUARDIANES ─────────────────────────────────────────────────────  *
 *   G13 · Ningún motivo sin caso.        Todo `MOTIVO_CATASTRO` es producible.  *
 *   G9  · La app no toca cabeceras.      Ni `User-Agent`, ni opción `headers`.  *
 *   G8  · Encoding.                      Ni `TextDecoder`, ni `latin1`.         *
 *   G14 · Una sola base por servicio.    `https://ovc.catastro.meh.es`.         *
 *   G15 · Fronteras de capa.             Quién puede importar a quién.          *
 *   G16 · El marcado es contrato.        Todo `SELECTOR_*` casa UNA vez.        *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): se lee disco, se ejecuta el       *
 * catálogo de casos con el `fetch` doblado y se parsea `index.html` con jsdom   *
 * COMO LIBRERÍA (no como entorno). Ni red, ni `window` global, ni IndexedDB.    *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'

import { MOTIVO_CATASTRO, SRS_DEFAULT } from '../../services/catastro.js'
import { CASOS, FIXTURE, FUENTE, SRS_MEDIDO, leerFixture } from './_casos-catastro.js'

// ── Herramientas comunes ─────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

/** Lee un fichero del repo por su ruta POSIX relativa. */
const fuenteDe = (rel) => readFileSync(join(RAIZ, ...rel.split('/')), 'utf8')

/**
 * Recorre el árbol desde `RAIZ` y devuelve rutas POSIX RELATIVAS. Relativas a
 * propósito: así el casing de la letra de unidad en Windows (ver la cabecera de
 * `vitest.config.js`) es irrelevante. Copiado en espíritu de
 * `test/contrato.test.js`, que es donde nació.
 *
 * @param {Set<string>} saltaDirs  Directorios que no se recorren.
 * @param {(rel: string) => boolean} acepta  Filtro de fichero.
 * @returns {string[]}  Rutas ordenadas.
 */
function recorrer(saltaDirs, acepta) {
  const encontrados = []
  const pila = ['']
  while (pila.length > 0) {
    const rel = pila.pop()
    for (const entrada of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
      const hijo = rel === '' ? entrada.name : `${rel}/${entrada.name}`
      if (entrada.isDirectory()) {
        if (!saltaDirs.has(entrada.name)) pila.push(hijo)
      } else if (entrada.isFile() && acepta(hijo)) {
        encontrados.push(hijo)
      }
    }
  }
  return encontrados.sort()
}

/**
 * Devuelve el fichero SIN sus comentarios: se borran los bloques de comentario
 * (incluidos los JSDoc) y las líneas que son ÍNTEGRAMENTE comentario de línea.
 * Es el mismo filtro que `test/services/catastro.test.js` usa para el guardián
 * del CDATA, y por el mismo motivo.
 *
 * ⚠️ EL ORDEN DE LOS DOS PASOS NO ES INDIFERENTE, y costó un rojo descubrirlo:
 * **primero las líneas de comentario, después los bloques**. Al revés,
 * `storage/bd.js` se queda en NADA. El motivo es que sus cabeceras de línea
 * citan globs del proyecto —`viewer/*`, `app/**`, `services/*`— y esa barra con
 * asterisco ABRE un bloque de comentario para una RegExp que no sabe que va
 * dentro de un `//`. El bloque falso se traga desde ahí hasta el primer cierre
 * de bloque de verdad, cien líneas más abajo: los `import` desaparecen y los
 * guardianes de importación pasan mirando una lista vacía. Exactamente el fallo
 * EN VERDE que este fichero persigue, dentro de su propia herramienta.
 *
 * ⚠️ Un comentario al final de una línea de código SOBREVIVE. No es un descuido:
 * ampliar el filtro para quitarlos exigiría entender cadenas y expresiones
 * regulares (un `//` puede vivir dentro de `'https://…'`), y el remedio sería
 * peor. Cada guardián de abajo comprueba que lo que busca no aparece en ninguno.
 *
 * @param {string} fuente
 * @returns {string}
 */
function codigoDe(fuente) {
  return fuente
    .split('\n')
    .filter((linea) => !/^\s*\/\//.test(linea))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/**
 * Especificadores de módulo de un fichero. Tres formas, y las tres hacen falta:
 *   · `import`/`export … from '…'` — se casa por `from` y NO por el principio de
 *     línea, porque hay imports multilínea cuya ruta vive en una línea que
 *     empieza por `}` (los hay en `services/catastro.js` y en `app/main.js`), y
 *     un detector anclado al `import` se los saltaría enteros, en silencio.
 *   · `import(…)` / `require(…)` — las formas llamadas.
 *   · **`import '…'` a secas** — el import POR EFECTO, sin `from`. No es
 *     hipotético: `app/main.js` trae así el CSS de Leaflet
 *     (`import 'leaflet/dist/leaflet.css'`), y sin esta tercera forma el
 *     guardián de Leaflet de G15 se quedaba sin su caso de control.
 *
 * @param {string} fuente
 * @returns {string[]}
 */
function especificadoresDe(fuente) {
  const RE =
    /\bfrom\s*['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]|(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g
  return [...codigoDe(fuente).matchAll(RE)].map((m) => m[1] ?? m[2] ?? m[3])
}

/**
 * Constantes exportadas con valor de CADENA LITERAL, leídas del texto:
 * `export const NOMBRE = 'valor'`. Contempla la forma partida en dos líneas
 * (`export const X =\n  'valor'`), que es como está escrita
 * `CATASTRO_OVC_RCCOOR_JSON` — un detector anclado a una sola línea se la
 * saltaría, y esa constante es justo una de las que G14 vigila.
 *
 * El valor se lee hasta su comilla de CIERRE, no hasta la primera comilla de
 * cualquier clase: los selectores de `app/` son `'[data-campo="refcat"]'`, o sea
 * comillas dobles DENTRO de comillas simples, y un `[^'"]*` los cortaba a la
 * mitad y devolvía cadena vacía. Sin esto, G16 no leía ni un selector.
 *
 * No se importan los módulos para preguntárselo: `viewer/wms-catastro.js` y
 * `app/main.js` importan Leaflet, que exige `window`, y este fichero corre sin
 * DOM. Es la misma decisión que toma `test/gml/contrato-gml.test.js`.
 *
 * @param {string} fuente
 * @returns {Map<string, string>}
 */
function exportacionesConValor(fuente) {
  const RE = /^export\s+const\s+([\w$]+)\s*=\s*(['"])((?:\\.|(?!\2).)*)\2/gm
  return new Map([...codigoDe(fuente).matchAll(RE)].map((m) => [m[1], m[3]]))
}

// ── Anti-vacuidad de las herramientas ────────────────────────────────────────
// Van primero: si estas tres mienten, los seis guardianes de abajo pasan sin
// mirar nada. Se prueban contra fuentes sintéticas Y contra el disco.

describe('contrato F05 · las herramientas de este fichero no son vacuas', () => {
  it('`codigoDe` quita los comentarios y NO se come el código', () => {
    expect(codigoDe("// import x from 'prohibido'\n")).not.toContain('prohibido')
    expect(codigoDe("/** ver `import x from 'prohibido'` */\n")).not.toContain('prohibido')
    expect(codigoDe("/**\n * ni `TextDecoder`, ni `'latin1'`\n */\n")).not.toContain('latin1')
    expect(codigoDe('const a = 1 // esto sobrevive\n')).toContain('const a = 1')
    // Y sobre el disco, que es donde importa: el código sigue estando.
    for (const [rel, marca] of [
      ['services/_red.js', 'export function crearTransporte'],
      ['services/catastro.js', 'export function crearClienteCatastro'],
      ['services/_catastro-wfs.js', 'export function leerColeccion'],
      ['storage/cache-catastro.js', 'export function crearCacheCatastro'],
      ['app/cableado-catastro.js', 'export function cablearCatastro'],
    ]) {
      expect(codigoDe(fuenteDe(rel)), `el filtro de comentarios se ha comido ${rel}`).toContain(
        marca,
      )
    }
  })

  it('`codigoDe` no se traga el fichero por un glob dentro de un comentario de línea', () => {
    // La trampa que costó un rojo, y que sigue viva en el disco: una cabecera de
    // línea que cita `viewer/*` abre un bloque de comentario para una RegExp
    // ingenua, y el bloque falso se come los `import` que vienen después.
    expect(codigoDe("// ver viewer/*\nimport { wrap } from 'idb'\n")).toContain("from 'idb'")
    // Sobre el disco: los dos ficheros que tienen el glob de verdad conservan
    // sus imports. Si dejaran de citarlo, esta prueba dejaría de proteger nada,
    // así que se afirma también que el glob sigue ahí.
    for (const [rel, glob, marca] of [
      ['storage/bd.js', 'viewer/*', "from 'idb'"],
      ['app/demo-datos.js', 'app/**', 'from '],
    ]) {
      expect(fuenteDe(rel), `${rel} ya no cita ${glob}: busca otro caso de control`).toContain(glob)
      expect(codigoDe(fuenteDe(rel)), `el filtro se ha comido los imports de ${rel}`).toContain(
        marca,
      )
    }
  })

  it('`especificadoresDe` lee los imports reales: multilínea, llamados y por EFECTO', () => {
    expect(especificadoresDe("import {\n  A,\n  B,\n} from './x.js'\n")).toEqual(['./x.js'])
    expect(especificadoresDe("const m = await import('./y.js')\n")).toEqual(['./y.js'])
    expect(especificadoresDe("import 'solo-efecto.css'\n")).toEqual(['solo-efecto.css'])
    expect(especificadoresDe("// import x from 'prohibido'\n")).toEqual([])
    // Sobre el disco: el import multilínea de `services/catastro.js` se ve, y
    // también el import por efecto de `app/main.js` (el CSS de Leaflet), que es
    // el caso de control del guardián de Leaflet de G15.
    expect(especificadoresDe(fuenteDe('services/catastro.js'))).toContain('./_catastro-wfs.js')
    expect(
      especificadoresDe(fuenteDe('app/main.js')).some((s) => s.startsWith('leaflet')),
      'sin la forma `import "…"` a secas, el import por efecto se pierde',
    ).toBe(true)
  })

  it('`exportacionesConValor` lee el valor entero, con comillas dobles dentro', () => {
    expect(exportacionesConValor("export const A = 'uno'\n").get('A')).toBe('uno')
    // La forma partida en dos líneas: `CATASTRO_OVC_RCCOOR_JSON` está escrita así.
    expect(exportacionesConValor("export const B =\n  'dos'\n").get('B')).toBe('dos')
    // Y la que rompía G16: comillas dobles DENTRO de las simples.
    expect(exportacionesConValor('export const C = \'[data-x="y"]\'\n').get('C')).toBe(
      '[data-x="y"]',
    )
    // No confunde una constante privada con una exportada.
    expect(exportacionesConValor("const D = 'cuatro'\n").has('D')).toBe(false)
    // Sobre el disco, con las dos constantes REALES de cada forma.
    expect(
      exportacionesConValor(fuenteDe('services/_catastro-ovc.js')).get('CATASTRO_OVC_RCCOOR_JSON'),
    ).toMatch(/^https:\/\//)
    expect(exportacionesConValor(fuenteDe('app/cableado-catastro.js')).get(
      'SELECTOR_CAMPO_REFCAT',
    )).toContain('"')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// G13 · NINGÚN MOTIVO SIN CASO
// ─────────────────────────────────────────────────────────────────────────────
// Es el guardián más importante de F05, y es el guardián de una decisión de
// HONESTIDAD, no de una regla técnica.
//
// **No existe ningún motivo de «bloqueado» ni de «límite excedido».** No hay
// `LIMITE_EXCEDIDO`, ni `BLOQUEADO`, ni `RATE_LIMITED`. Nadie ha medido —ni va a
// medir— qué contesta el Catastro a un cliente denegado, porque provocarlo
// cuesta ~10 días de servicio (override O8), y `PROCEDENCIA.md` lo declara como
// hueco A PROPÓSITO en su sección «Huecos declarados».
//
// Un detector de una señal que nadie ha visto solo puede acabar de dos maneras:
// o es CÓDIGO MUERTO QUE ADEMÁS TRANQUILIZA —quien lee el enum da el caso por
// cubierto y no lo está—, o DISPARA EN FALSO y le dice al usuario que está
// bloqueado cuando lo que se le ha caído es el wifi. Las dos son peores que no
// tener el motivo.
//
// Este guardián hace que **añadir un motivo sin un caso que lo produzca ponga la
// suite en rojo, nombrando el motivo huérfano**. Es la formulación comprobable
// de «no rellenar huecos con plausibilidad»: un motivo solo puede existir si en
// `_casos-catastro.js` hay una situación que lo produce de verdad.
//
// La igualdad se afirma en LOS DOS SENTIDOS, no como inclusión: sobra un caso
// que produzca algo fuera del catálogo (sería un motivo indocumentado llegando a
// la UI) y falta un motivo sin caso.
//
// Diferencia con el guardián que ya vive en `test/services/catastro.test.js`:
// aquel recoge los motivos que su propia suite produjo DE PASO, y depende de que
// esa suite siga teniendo los tests que los producen. Este parte de un CATÁLOGO
// EXPLÍCITO y legible, que es a la vez documentación («¿y esto cuándo le pasa a
// un usuario?») y prueba. Los dos son baratos y ninguno sustituye al otro.

/** @type {{caso: object, resultado: object, peticiones: number, avisos: object[]}[]} */
let EJECUCIONES = []

beforeAll(async () => {
  // Se ejecuta el catálogo ENTERO una sola vez. Cada caso monta su propio
  // cliente con su propio `fetch` doblado, así que no comparten nada y el orden
  // da igual. La suite NO llama al Catastro: ver la cabecera de `_casos-catastro.js`.
  EJECUCIONES = await Promise.all(
    CASOS.map(async (caso) => ({ caso, ...(await caso.ejecutar()) })),
  )
})

describe('G13 · todo motivo de MOTIVO_CATASTRO tiene un caso REPRODUCIBLE', () => {
  it('cada caso del catálogo produce EXACTAMENTE el motivo que declara', () => {
    for (const { caso, resultado, peticiones } of EJECUCIONES) {
      expect(resultado.motivo, `caso «${caso.nombre}»`).toBe(caso.motivo)
      // Y de paso, los invariantes del contrato: un caso que produjera el motivo
      // bueno con un resultado deforme seguiría siendo un caso malo.
      expect(resultado.ok, `caso «${caso.nombre}»`).toBe(false)
      expect(resultado.datos, `caso «${caso.nombre}»`).toBeNull()
      expect(typeof resultado.mensaje, `caso «${caso.nombre}» sin mensaje presentable`).toBe(
        'string',
      )
      // «No se emite la petición» es afirmable, no un deseo: los casos LOCAL
      // tienen que costar CERO peticiones al Catastro.
      expect(peticiones, `caso «${caso.nombre}»: peticiones emitidas`).toBe(caso.peticiones)
      if (caso.fuente === FUENTE.LOCAL) expect(peticiones, `caso «${caso.nombre}»`).toBe(0)
    }
  })

  it('el conjunto de motivos producidos es IGUAL al catálogo (en los dos sentidos)', () => {
    const declarados = Object.values(MOTIVO_CATASTRO)
    const producidos = new Set(EJECUCIONES.map((e) => e.resultado.motivo))

    const huerfanos = declarados.filter((m) => !producidos.has(m))
    expect(
      huerfanos,
      'motivos de MOTIVO_CATASTRO que NINGÚN caso de test/services/_casos-catastro.js ' +
        'produce. Un motivo que nadie puede provocar o es código muerto que además ' +
        'TRANQUILIZA, o dispara en falso y le dice al usuario que está bloqueado cuando se ' +
        'le ha caído el wifi. Si el motivo es real, añade el caso que lo produce; si no ' +
        'puedes producirlo, el motivo no debería existir',
    ).toEqual([])

    const intrusos = [...producidos].filter((m) => !declarados.includes(m))
    expect(
      intrusos,
      'motivos producidos que NO están en MOTIVO_CATASTRO: llegarían a la UI sin nivel ' +
        'asignado y sin que nadie los haya decidido',
    ).toEqual([])
  })

  it('el catálogo NO es vacuo: quitar un caso deja el motivo HUÉRFANO, con nombre', () => {
    // Prueba negativa del instrumento. Se simula la retirada de cada motivo del
    // catálogo —descartando TODOS sus casos— y se comprueba que la comparación
    // de arriba lo detectaría y lo NOMBRARÍA. Sin esto, la igualdad podría ser
    // cierta por casualidad y nadie se enteraría el día que dejara de serlo.
    const declarados = Object.values(MOTIVO_CATASTRO)
    expect(declarados.length, 'MOTIVO_CATASTRO está vacío').toBeGreaterThan(0)

    for (const motivo of declarados) {
      const sinEseCaso = EJECUCIONES.filter((e) => e.resultado.motivo !== motivo)
      const producidos = new Set(sinEseCaso.map((e) => e.resultado.motivo))
      const huerfanos = declarados.filter((m) => !producidos.has(m))
      expect(huerfanos, `retirar los casos de ${motivo} debe dejarlo huérfano`).toEqual([motivo])
    }
  })

  it('el catálogo no se llena solo: un motivo inventado no aparece', () => {
    const producidos = new Set(EJECUCIONES.map((e) => e.resultado.motivo))
    // Los dos nombres que la cabecera de `services/catastro.js` promete que NO
    // existen. Si algún día aparecieran aquí sería porque alguien los ha añadido
    // al enum, y entonces el test de arriba exigiría su caso.
    expect(producidos.has('LIMITE_EXCEDIDO')).toBe(false)
    expect(producidos.has('BLOQUEADO')).toBe(false)
    expect(producidos.size).toBe(Object.keys(MOTIVO_CATASTRO).length)
  })

  it('los casos que dicen apoyarse en verdad externa nombran un fichero que EXISTE', () => {
    // Un catálogo que declara `FIXTURE` y apunta a un fichero que no está sería
    // justo la tranquilidad falsa que este guardián persigue. Y se comprueba lo
    // contrario también: un caso `DOBLE` o `LOCAL` no puede reclamar fixture.
    const conFixture = EJECUCIONES.filter(({ caso }) => caso.fuente === FUENTE.FIXTURE)
    expect(conFixture.length, 'ningún caso se apoya en un fixture: revisa el catálogo')
      .toBeGreaterThan(0)
    for (const { caso } of conFixture) {
      expect(Object.values(FIXTURE), `«${caso.nombre}» declara un fixture fuera de FIXTURE`)
        .toContain(caso.fixture)
      expect(leerFixture(caso.fixture).length, `${caso.fixture} está vacío`).toBeGreaterThan(0)
    }
    for (const { caso } of EJECUCIONES.filter((e) => e.caso.fuente !== FUENTE.FIXTURE)) {
      expect(caso.fixture, `«${caso.nombre}» no es FIXTURE y declara uno`).toBeNull()
    }
    // Los tres casos sin fixture posible (5xx, timeout, sin red) están DECLARADOS
    // como fabricados: `PROCEDENCIA.md` dice que no hay captura de servicio caído
    // y que eso no es verdad externa. Que existan y estén marcados es el punto.
    expect(EJECUCIONES.filter((e) => e.caso.fuente === FUENTE.DOBLE).length).toBeGreaterThan(0)
  })

  it('los fixtures se midieron con el SRS por defecto del cliente', () => {
    // Anclaje del catálogo: si el defecto de producto cambiara de huso, los
    // cuerpos medidos dejarían de corresponder con lo que el cliente pide.
    expect(SRS_MEDIDO, 'el SRS lo dice el propio fixture del OVC').toBe(SRS_DEFAULT)
  })
})

// ── Fuentes de `services/` y de `app/`, leídas una vez ───────────────────────

const MODULOS_SERVICES = readdirSync(join(RAIZ, 'services'), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.js'))
  .map((e) => `services/${e.name}`)
  .sort()

/** `app/cableado-catastro.js` es el único de `app/` que habla con `services/`. */
const CABLEADO = 'app/cableado-catastro.js'

const FUENTE_DE = new Map(
  [...MODULOS_SERVICES, CABLEADO, 'app/main.js'].map((rel) => [rel, fuenteDe(rel)]),
)
const CODIGO_DE = new Map([...FUENTE_DE].map(([rel, texto]) => [rel, codigoDe(texto)]))

// ─────────────────────────────────────────────────────────────────────────────
// G9 · LA APP NO TOCA CABECERAS
// ─────────────────────────────────────────────────────────────────────────────
// **Este guardián SUSTITUYE al criterio de aceptación 5 de la spec de F05**, que
// dice «el User-Agent no se rota». Ese criterio es INCOMPROBABLE E IRRELEVANTE,
// y las dos cosas por separado:
//
//   · **Incomprobable** porque `User-Agent` es un *forbidden header name*: un
//     navegador NO PUEDE fijarla ni queriendo — la especificación de Fetch obliga
//     al agente de usuario a descartarla. No hay nada que medir en la app.
//   · **Irrelevante** porque además está MEDIDO que el servicio contesta 200 sin
//     ninguna cabecera nuestra: las 8 capturas de `PROCEDENCIA.md` salieron con
//     el `User-Agent` por defecto de `curl` y las 8 contestaron con cuerpo
//     válido (hecho transversal 6). La afirmación de la spec de que «sin él el
//     servicio da error» quedó SIN RESPALDO MEDIDO.
//
// Lo único comprobable es que NO LO INTENTAMOS, y eso es lo que se comprueba
// aquí. Hay además una razón positiva para no tocar cabeceras, medida y anotada
// en `PROCEDENCIA.md` (hecho transversal 2): el `Access-Control-Allow-Origin: *`
// del Catastro es la ÚNICA cabecera CORS que manda —no hay
// `Access-Control-Allow-Headers` ni `-Methods`—, así que solo está respaldada por
// medición la PETICIÓN SIMPLE. Añadir una cabecera propia forzaría un *preflight*
// `OPTIONS` del que no tenemos ni una medición, y el modo de fallo sería un
// `SIN_RED` indistinguible de estar sin wifi.
//
// ⚠️ La trampa: `services/_red.js` HABLA de `User-Agent` cuatro veces en su
// cabecera, y de `headers`, para explicar por qué no se tocan. Un detector que
// leyera el fichero entero confundiría la advertencia con la infracción. Se mira
// el CÓDIGO. Y la opción `headers:` se distingue de la PROPIEDAD `.headers`, que
// sí se lee —`respuesta.headers.get('content-type')`—: leer las cabeceras de la
// respuesta es legítimo; fijar las de la petición, no.

describe('G9 · ni `User-Agent` ni opción `headers` en services/ ni en el cableado', () => {
  const MENCIONA_UA = /user-agent/i
  // `headers` como CLAVE de objeto. La mirada atrás descarta `respuesta.headers`
  // y cualquier `x.headers`; se admite la forma entrecomillada `'headers':`.
  const OPCION_HEADERS = /(?<![.\w$])(?:headers|['"`]headers['"`])\s*:/

  const VIGILADOS = [...MODULOS_SERVICES, CABLEADO]

  it('el recorrido no es vacuo y sigue cubriendo el cableado de la app', () => {
    expect(MODULOS_SERVICES.length, 'el recorrido de services/ no ha encontrado módulos')
      .toBeGreaterThan(1)
    expect(MODULOS_SERVICES).toContain('services/catastro.js')
    expect(MODULOS_SERVICES).toContain('services/_red.js')
    expect(FUENTE_DE.get(CABLEADO).length, `${CABLEADO} no existe o está vacío`)
      .toBeGreaterThan(0)
    // Y hay una llamada al `fetch` inyectado que vigilar: si desapareciera, este
    // guardián pasaría a no proteger de nada.
    expect(
      CODIGO_DE.get('services/_red.js'),
      'services/_red.js ya no llama al fetch inyectado: ¿dónde vive ahora la petición?',
    ).toMatch(/fetch[A-Za-z]*\s*\(\s*url\s*,/)
  })

  it('ningún módulo vigilado nombra `User-Agent` en su CÓDIGO', () => {
    const infractores = VIGILADOS.filter((rel) => MENCIONA_UA.test(CODIGO_DE.get(rel)))
    expect(
      infractores,
      '`User-Agent` es *forbidden header name*: el navegador no la deja fijar. Escribirla ' +
        'sería código muerto que además sugiere que la app rota algo, que es justo lo que el ' +
        'Catastro sanciona con ~10 días de denegación (override O8)',
    ).toEqual([])
  })

  it('ningún módulo vigilado pasa una opción `headers`', () => {
    const infractores = VIGILADOS.filter((rel) => OPCION_HEADERS.test(CODIGO_DE.get(rel)))
    expect(
      infractores,
      'cabeceras propias en una petición al Catastro: forzarían un *preflight* OPTIONS del ' +
        'que no hay NI UNA medición (el servicio solo manda `Access-Control-Allow-Origin: *`, ' +
        'sin `-Headers` ni `-Methods`). Medido: contesta 200 sin ninguna cabecera nuestra',
    ).toEqual([])
  })

  it('los detectores NO son vacuos: disparan sobre fuente sintética', () => {
    // Se han VISTO fallar. Estas cuatro líneas son la infracción escrita a
    // propósito, y el guardián la caza.
    expect(MENCIONA_UA.test("fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })")).toBe(true)
    expect(OPCION_HEADERS.test("fetch(url, { headers: { accept: 'text/xml' } })")).toBe(true)
    expect(OPCION_HEADERS.test("fetch(url, { 'headers': {} })")).toBe(true)
    expect(OPCION_HEADERS.test('const o = { headers }')).toBe(false) // sin `:` no es la opción

    // Y distinguen la MENCIÓN de la INFRACCIÓN, que es lo que hace falta aquí:
    // `services/_red.js` habla de las dos cosas en su cabecera.
    expect(
      MENCIONA_UA.test(FUENTE_DE.get('services/_red.js')),
      'services/_red.js ha dejado de explicar por qué NO toca el User-Agent',
    ).toBe(true)
    expect(MENCIONA_UA.test(CODIGO_DE.get('services/_red.js'))).toBe(false)

    // La distinción que hace útil a `OPCION_HEADERS`: la PROPIEDAD `.headers` de
    // la respuesta SÍ se lee, y tiene que seguir sin disparar. Si esa línea
    // desapareciera, el detector dejaría de estar distinguiendo nada.
    expect(
      CODIGO_DE.get('services/_red.js'),
      'services/_red.js ya no lee `respuesta.headers`: el detector deja de distinguir',
    ).toContain('respuesta.headers')
    expect(OPCION_HEADERS.test('const cabeceras = respuesta.headers')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// G8 · ENCODING: NO SE DECODIFICA A MANO
// ─────────────────────────────────────────────────────────────────────────────
// Las respuestas del WFS del Catastro **declaran `ISO-8859-1` en su prólogo XML y
// sus bytes son UTF-8**. Está MEDIDO en las cinco capturas `.xml` de
// `PROCEDENCIA.md` (hecho transversal 4) y es la misma incoherencia que ya
// documenta `test/fixtures/gml/PROCEDENCIA.md` para el GML de la parcela: el
// fichero miente sobre sí mismo.
//
// Lo que salva a la aplicación es que `response.text()` **decodifica SIEMPRE
// UTF-8 por especificación** —obedeciendo además al `Content-Type:
// charset=utf-8` que sí manda el servidor— e ignora la declaración del prólogo.
// O sea: no hacer nada es lo correcto.
//
// Decodificar a mano (`new TextDecoder('iso-8859-1')`, `'latin1'`) haría TEXTO
// ROTO A PARTIR DE BYTES CORRECTOS: los acentos de un nombre de calle saldrían
// como mojibake, y el fallo viajaría hasta un GML que se sube a la Sede. No
// reventaría: saldría mal, en verde.
//
// ⚠️ Dos trampas, y las dos son reales en este repo:
//   · `services/_red.js` nombra `TextDecoder` y `'latin1'` —entrecomillado— en su
//     cabecera, para prohibirlos. Un `includes` sobre el texto entero los cazaría.
//   · `services/_catastro-wfs.js` escribe `ISO-8859-1` DENTRO DE UN MENSAJE DE
//     ERROR, o sea en código de verdad, no en un comentario. Por eso el detector
//     casa la CADENA LITERAL `'iso-8859-1'` (comilla pegada al token, que es como
//     se le pasaría a un `TextDecoder`) y no la aparición del texto suelto.

describe('G8 · `services/` no decodifica bytes a mano', () => {
  const DECODIFICA_A_MANO = /\bTextDecoder\b|['"`]\s*(?:iso-8859-1|latin1)\s*['"`]/i

  it('ningún módulo de services/ usa TextDecoder ni nombra una codificación', () => {
    const infractores = MODULOS_SERVICES.filter((rel) => DECODIFICA_A_MANO.test(CODIGO_DE.get(rel)))
    expect(
      infractores,
      'decodificación manual en services/: los cuerpos del Catastro DECLARAN ISO-8859-1 y sus ' +
        'bytes son UTF-8 (medido). `response.text()` decodifica UTF-8 por especificación y ' +
        'acierta; decodificar a mano haría texto roto a partir de bytes correctos, y saldría ' +
        'mal EN VERDE',
    ).toEqual([])
  })

  it('el detector NO es vacuo: dispara sobre fuente sintética', () => {
    expect(DECODIFICA_A_MANO.test("new TextDecoder('iso-8859-1').decode(bytes)")).toBe(true)
    expect(DECODIFICA_A_MANO.test("const enc = 'latin1'")).toBe(true)
    expect(DECODIFICA_A_MANO.test('const d = new TextDecoder()')).toBe(true)
  })

  it('el detector distingue MENCIÓN de USO (por eso no vale un `includes`)', () => {
    // Trampa 1: la cabecera de `_red.js` los nombra para prohibirlos.
    const red = FUENTE_DE.get('services/_red.js')
    expect(
      DECODIFICA_A_MANO.test(red),
      'services/_red.js ha dejado de explicar por qué NO decodifica a mano',
    ).toBe(true)
    expect(DECODIFICA_A_MANO.test(CODIGO_DE.get('services/_red.js'))).toBe(false)

    // Trampa 2, la más fina: `_catastro-wfs.js` escribe «ISO-8859-1» dentro de un
    // mensaje de error, que es CÓDIGO. Sobrevive al filtro de comentarios y el
    // detector tiene que dejarlo pasar igualmente.
    const wfs = CODIGO_DE.get('services/_catastro-wfs.js')
    expect(
      wfs,
      'services/_catastro-wfs.js ya no advierte del encoding en su mensaje de error: el ' +
        'detector deja de estar distinguiendo nada',
    ).toContain('ISO-8859-1')
    expect(DECODIFICA_A_MANO.test(wfs)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// G14 · UNA SOLA BASE POR SERVICIO
// ─────────────────────────────────────────────────────────────────────────────
// Todo lo que este proyecto le pide al Catastro sale de `ovc.catastro.meh.es`, y
// cada fichero que nombra ese dominio tiene que EXPORTAR su base como constante.
// Dos cosas, y las dos importan:
//
//   · **Exportada**, para que exista un único sitio donde tocarla. La cabecera de
//     `services/catastro.js` lo dice como consecuencia práctica del override O7:
//     si mañana el Catastro retira su `Access-Control-Allow-Origin: *`, la
//     contingencia se toca en DOS constantes y ni la UI ni el modelo se enteran.
//     Una URL incrustada en medio de una función es una tercera verdad que nadie
//     encuentra el día que hay que moverla.
//   · **`https://ovc.…`**, sin variantes. El proyecto tiene tres bases y las tres
//     cuelgan del mismo host: el WFS INSPIRE, el OVC de callejero y el WMS de
//     cartografía. Una cuarta escrita a mano en otro host, o la misma con `http`,
//     es la clase de divergencia que se descubre en producción.
//
// **Se DERIVA del recorrido de ficheros, no de una lista de tres.** Un módulo
// nuevo que hable con el Catastro entra solo. Y el recorrido tiene que encontrar
// MÁS DE CERO ficheros, o la afirmación es vacua: hoy son tres.

describe('G14 · todo fichero que nombra el Catastro exporta su base', () => {
  const HOST = 'catastro.meh.es'
  const BASE = 'https://ovc.catastro.meh.es'

  // Los mismos directorios que `test/contrato.test.js` considera «no fuente».
  const DIRS_NO_FUENTE = new Set([
    'node_modules',
    'dist',
    'test',
    'spec',
    'scripts',
    'prototipo',
    'estilos',
    '.git',
    '.gstack',
    '.claude',
  ])

  // Solo módulos: una CONSTANTE EXPORTADA solo puede vivir en un `.js`. Un HTML
  // que nombrara el host (un `preconnect`, por ejemplo) no podría cumplir esta
  // regla ni tendría por qué.
  const FUENTES = recorrer(DIRS_NO_FUENTE, (rel) => /\.(?:js|mjs)$/.test(rel))
  const NOMBRAN_EL_HOST = FUENTES.filter((rel) => fuenteDe(rel).includes(HOST))

  /** ¿Este fichero exporta alguna base buena? @returns {string[]} las que exporta. */
  const basesDe = (texto) =>
    [...exportacionesConValor(texto)].filter(([, valor]) => valor.startsWith(BASE)).map(([n]) => n)

  it('el recorrido encuentra ficheros de producción que nombran el Catastro', () => {
    expect(FUENTES.length, 'el recorrido de fuentes no ha encontrado nada que mirar')
      .toBeGreaterThan(0)
    expect(
      NOMBRAN_EL_HOST.length,
      'ningún fichero de producción nombra catastro.meh.es: el guardián no está mirando nada',
    ).toBeGreaterThan(0)
    // Los dos dialectos y el WMS. No se afirma el NÚMERO —eso caducaría— sino que
    // los tres sitios que se conocen siguen ahí; si aparece un cuarto, entra solo.
    expect(NOMBRAN_EL_HOST).toEqual(
      expect.arrayContaining([
        'services/_catastro-wfs.js',
        'services/_catastro-ovc.js',
        'viewer/wms-catastro.js',
      ]),
    )
  })

  it('cada uno de ellos exporta una constante que empieza por la base única', () => {
    const infractores = NOMBRAN_EL_HOST.filter((rel) => basesDe(fuenteDe(rel)).length === 0)
    expect(
      infractores,
      `ficheros que nombran ${HOST} sin exportar una constante que empiece por ${BASE}. La base ` +
        'se exporta para que exista UN sitio donde tocarla: si el Catastro retira su ' +
        '`Access-Control-Allow-Origin: *`, la contingencia se toca ahí y nadie más se entera. ' +
        'Una URL incrustada en una función es una tercera verdad que nadie encuentra',
    ).toEqual([])
  })

  it('el detector NO es vacuo: dispara sobre fuente sintética', () => {
    // Se ha VISTO fallar. Tres infracciones distintas, y las tres se cazan:
    // la base sin exportar, el host equivocado y el esquema equivocado.
    expect(basesDe("const base = 'https://ovc.catastro.meh.es/x'\n")).toEqual([])
    expect(basesDe("export const B = 'https://www1.sedecatastro.gob.es/x'\n")).toEqual([])
    expect(basesDe("export const B = 'http://ovc.catastro.meh.es/x'\n")).toEqual([])
    // Y no dispara sobre las buenas, incluida la partida en dos líneas.
    expect(basesDe("export const B = 'https://ovc.catastro.meh.es/x'\n")).toEqual(['B'])
    expect(basesDe("export const B =\n  'https://ovc.catastro.meh.es/x'\n")).toEqual(['B'])
    // Sobre el disco: las tres bases reales se leen y empiezan por la base única.
    for (const rel of NOMBRAN_EL_HOST) {
      expect(basesDe(fuenteDe(rel)).length, `${rel} no exporta ninguna base`).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// G15 · FRONTERAS DE CAPA
// ─────────────────────────────────────────────────────────────────────────────
// Cuatro reglas de quién puede importar a quién. Ninguna se rompe con un fallo
// visible: se rompe con un bundle que engorda, una capa que ya no se puede
// reutilizar y una suite `node` que revienta al importar algo que arrastra
// `window`.
//
//   1. `services/` no importa `model/`. La capa de servicio habla de CUERPOS y
//      de códigos; quien convierte un `ParcelaGml` en un `Expediente` es
//      `app/cableado-catastro.js`. Si `services/` conociera el modelo, cambiar
//      el modelo obligaría a tocar el cliente del Catastro.
//   2. `services/` no importa `storage/`. La caché entra POR PUERTO
//      (`CacheCatastro`, declarado por el consumidor) y su defecto es
//      `CACHE_NULA`: el cliente funciona entero sin almacenamiento y su suite no
//      abre una base de datos ni una vez. Un import directo ataría el cliente a
//      IndexedDB y haría imposible ese defecto.
//   3. `storage/` no importa `services/` EN TIEMPO DE EJECUCIÓN. Es la otra
//      mitad: si las dos capas se importaran, habría un ciclo. `storage/` no
//      sabe qué guarda; solo sabe guardar.
//   4. `app/cableado-catastro.js` no importa Leaflet. Habla con el mapa por DUCK
//      TYPING, y por eso su test no lleva sufijo `.dom`.
//
// ⚠️ EXCEPCIÓN CONOCIDA Y DOCUMENTADA, y este guardián la ANCLA en vez de
// callarla: `services/ign.js` y `services/osm.js` SÍ importan Leaflet. Son las
// fábricas de capas base de F03 (`crearCapaWMTS`/`crearCapaOSM`), su cabecera lo
// declara por escrito («Este módulo importa Leaflet … y por tanto es
// SOLO-navegador: su test lleva sufijo `.dom.test.js` y el módulo NO entra por
// el barrel raíz»), y `test/contrato.test.js` ya lo da por hecho al vigilar que
// `services` no salga por el barrel. La excepción se declara con su motivo y se
// comprueba que los dos ficheros siguen existiendo Y siguen importando Leaflet:
// si dejaran de hacerlo, la excepción sobra y hay que quitarla. Cualquier módulo
// NUEVO de `services/` que importe Leaflet sale rojo aquí.

describe('G15 · fronteras de capa entre services/, storage/, model/ y app/', () => {
  const capa = (nombre) => new RegExp(`^(?:\\.{1,2}/)+${nombre}/`)
  const IMPORTA_MODEL = capa('model')
  const IMPORTA_STORAGE = capa('storage')
  const IMPORTA_SERVICES = capa('services')
  const ES_LEAFLET = (s) => s === 'leaflet' || s.startsWith('leaflet/')

  /**
   * Los dos módulos de `services/` que importan Leaflet A PROPÓSITO, con su
   * motivo. Es lo único mantenido a mano de este bloque —dos nombres, no un
   * inventario— y se comprueba abajo que los dos siguen existiendo y siguen
   * infringiendo, o la excepción estaría tapando algo que ya no pasa.
   */
  const CAPAS_BASE_CON_LEAFLET = new Map([
    ['services/ign.js', 'fábrica de capas WMTS del IGN (F03): devuelve un L.TileLayer'],
    ['services/osm.js', 'fábrica de la capa OSM (F03): devuelve un L.TileLayer'],
  ])

  const MODULOS_STORAGE = readdirSync(join(RAIZ, 'storage'), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => `storage/${e.name}`)
    .sort()

  const importsDe = (rel) => especificadoresDe(fuenteDe(rel))

  /**
   * Los módulos que legítimamente NO importan nada, con su motivo. Misma técnica que
   * {@link CAPAS_BASE_CON_LEAFLET} y por lo mismo: la excepción se declara y se
   * comprueba en los DOS sentidos, así que el día que uno de estos empiece a importar
   * algo, la excepción sobra y esta prueba lo dice.
   *
   * Que un módulo no importe nada es una propiedad, no un descuido: `autoguardado.js`
   * recibe por parámetro el reloj, los temporizadores y la función de guardar, así que
   * no tiene de qué depender. Es la misma decisión que el «CERO IMPORTS» de
   * `report/contraste-texto.js`.
   */
  const SIN_IMPORTS = new Map([
    [
      'storage/autoguardado.js',
      'debounce puro (F10 · T3.3): reloj, temporizadores y destino se inyectan, así que no ' +
        'depende de nada',
    ],
  ])

  it('los recorridos no son vacuos', () => {
    expect(MODULOS_SERVICES.length).toBeGreaterThan(1)
    expect(MODULOS_STORAGE.length, 'el recorrido de storage/ no ha encontrado módulos')
      .toBeGreaterThan(0)
    expect(MODULOS_STORAGE).toContain('storage/cache-catastro.js')
    // Y todos los módulos importan algo —salvo los declarados—: si el extractor se
    // rompiera, las cuatro reglas de abajo pasarían mirando listas vacías.
    for (const rel of [...MODULOS_SERVICES, ...MODULOS_STORAGE, CABLEADO]) {
      if (SIN_IMPORTS.has(rel)) continue
      expect(importsDe(rel).length, `${rel} no importa nada: revisa el extractor`)
        .toBeGreaterThan(0)
    }
  })

  it('las excepciones «no importa nada» siguen siendo ciertas', () => {
    // Si una deja de serlo, la exención de arriba estaría tapando un extractor roto.
    for (const [rel, motivo] of SIN_IMPORTS) {
      expect(MODULOS_STORAGE, `${rel} ya no existe: quita la excepción`).toContain(rel)
      expect(importsDe(rel), `${rel} ya importa algo (${motivo}): la excepción sobra`).toEqual([])
      // Y no es que el fichero esté vacío: eso también dejaría la lista a cero.
      expect(fuenteDe(rel).length).toBeGreaterThan(1000)
    }
  })

  it('`services/` no importa `model/`', () => {
    const infractores = MODULOS_SERVICES.flatMap((rel) =>
      importsDe(rel).filter((s) => IMPORTA_MODEL.test(s)).map((s) => `${rel} → ${s}`),
    )
    expect(
      infractores,
      'services/ habla de cuerpos y de códigos HTTP, no de expedientes. Quien convierte una ' +
        'ParcelaGml en un modelo es app/cableado-catastro.js; si services/ conociera el ' +
        'modelo, cambiar el modelo obligaría a tocar el cliente del Catastro',
    ).toEqual([])
  })

  it('`services/` no importa `storage/` (la caché entra por PUERTO)', () => {
    const infractores = MODULOS_SERVICES.flatMap((rel) =>
      importsDe(rel).filter((s) => IMPORTA_STORAGE.test(s)).map((s) => `${rel} → ${s}`),
    )
    expect(
      infractores,
      'la caché entra por el puerto CacheCatastro, que declara el CONSUMIDOR, y su defecto es ' +
        'CACHE_NULA: el cliente funciona entero sin almacenamiento y su suite no abre una base ' +
        'de datos ni una vez. Un import directo ataría services/ a IndexedDB',
    ).toEqual([])
  })

  it('`storage/` no importa `services/` en tiempo de ejecución', () => {
    const infractores = MODULOS_STORAGE.flatMap((rel) =>
      importsDe(rel).filter((s) => IMPORTA_SERVICES.test(s)).map((s) => `${rel} → ${s}`),
    )
    expect(
      infractores,
      'storage/ no sabe qué guarda: solo sabe guardar. Importar services/ desde aquí cierra un ' +
        'ciclo entre las dos capas',
    ).toEqual([])
  })

  it('el detector de `storage/ → services/` distingue MENCIÓN de IMPORT', () => {
    // Caso REAL y perfecto para esto: `storage/cache-catastro.js` escribe
    // `import { crearClienteCatastro } from './services/catastro.js'` en un
    // EJEMPLO de su JSDoc, para enseñar cómo se cablea. Un detector que leyera el
    // fichero entero lo señalaría como infractor. Es la misma trampa que las
    // menciones de proj4 en `test/contrato.test.js`.
    const cache = fuenteDe('storage/cache-catastro.js')
    expect(
      cache.includes('services/catastro.js'),
      'storage/cache-catastro.js ha dejado de enseñar el cableado en su JSDoc: el detector ya ' +
        'no está distinguiendo nada',
    ).toBe(true)
    expect(especificadoresDe(cache).some((s) => IMPORTA_SERVICES.test(s))).toBe(false)
    // Y sobre fuente sintética: el import de verdad SÍ se caza.
    expect(
      especificadoresDe("import { x } from '../services/catastro.js'\n").some((s) =>
        IMPORTA_SERVICES.test(s),
      ),
    ).toBe(true)
  })

  it('de `services/`, solo las capas base de F03 importan Leaflet (excepción anclada)', () => {
    const conLeaflet = MODULOS_SERVICES.filter((rel) => importsDe(rel).some(ES_LEAFLET))
    // La excepción no puede pudrirse: los dos ficheros tienen que seguir estando
    // y seguir importando Leaflet. Si uno dejara de hacerlo, sobra de la lista.
    for (const [rel, motivo] of CAPAS_BASE_CON_LEAFLET) {
      expect(MODULOS_SERVICES, `${rel} ya no existe: revisa la lista de excepciones`).toContain(rel)
      expect(conLeaflet, `${rel} ya no importa Leaflet (${motivo}): quita la excepción`).toContain(
        rel,
      )
    }
    const inesperados = conLeaflet.filter((rel) => !CAPAS_BASE_CON_LEAFLET.has(rel))
    expect(
      inesperados,
      'módulos de services/ que importan Leaflet fuera de las capas base de F03. Leaflet exige ' +
        '`window`: un módulo así no entra por el barrel raíz, no corre en el proyecto Vitest ' +
        '`node` y arrastra la UI a la capa de servicio. Los cuatro módulos del Catastro (F05) ' +
        'no lo importan y no deben',
    ).toEqual([])
  })

  it('`app/cableado-catastro.js` no importa Leaflet (habla con el mapa por duck typing)', () => {
    const infractores = importsDe(CABLEADO).filter(ES_LEAFLET)
    expect(
      infractores,
      'el cableado del Catastro habla con el mapa por DUCK TYPING —pide exactamente lo que usa ' +
        'y nada más—, y por eso su test no lleva sufijo `.dom`. Importar Leaflet aquí lo ' +
        'convertiría en código solo-navegador',
    ).toEqual([])
  })

  it('el detector de Leaflet NO es vacuo: dispara sobre `app/main.js` y sobre sintético', () => {
    // Caso conocido: `app/main.js` importa el CSS de Leaflet. Es correcto AHÍ
    // —es la entrada de la aplicación— y sería un fallo en el cableado.
    expect(
      importsDe('app/main.js').some(ES_LEAFLET),
      'app/main.js ha dejado de importar Leaflet: busca otro caso de control',
    ).toBe(true)
    expect(ES_LEAFLET('leaflet')).toBe(true)
    expect(ES_LEAFLET('leaflet/dist/leaflet.css')).toBe(true)
    expect(ES_LEAFLET('leaflet-fake'), 'el detector casa el paquete, no el prefijo').toBe(false)
    // Y los detectores de capa, sobre fuente sintética.
    expect(IMPORTA_MODEL.test('../model/parcela.js')).toBe(true)
    expect(IMPORTA_MODEL.test('../../model/edificio.js')).toBe(true)
    expect(IMPORTA_STORAGE.test('../storage/cache-catastro.js')).toBe(true)
    expect(IMPORTA_SERVICES.test('./services/catastro.js')).toBe(true)
    // …y no confunden un vecino legítimo con una capa prohibida.
    expect(IMPORTA_MODEL.test('../geo/huso.js')).toBe(false)
    expect(IMPORTA_STORAGE.test('./_catastro-wfs.js')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// G16 · EL MARCADO ES CONTRATO
// ─────────────────────────────────────────────────────────────────────────────
// `app/` exporta sus selectores (`SELECTOR_*`) para que los tests y los guiones
// de humo apunten al MISMO literal que el módulo, en vez de a una copia que
// puede divergir. Este guardián cierra el otro extremo del cable: que cada
// selector tenga **exactamente un** nodo vivo, y en UNA sola fuente.
//
// Ni cero ni dos, y las dos mitades importan:
//   · **Cero** es un botón que no existe: el módulo lanza al cablearse, o —peor—
//     el `nodo(...)` devuelve `null` y la función se cablea a la nada. Es el modo
//     de fallo que ningún test de módulo ve, porque los tests de `app/` montan su
//     propio DOM de mentira y ahí el nodo siempre está.
//   · **Dos** es peor que cero: el cableado agarra el primero y el segundo queda
//     muerto en pantalla, con el mismo aspecto que el vivo.
//
// **Derivado de los exports de `app/`, no de una lista.** Un selector nuevo entra
// solo. Y retro-cubre de paso el `SELECTOR_BOTON_GML` de F04, que hasta ahora no
// tenía quien comprobara que su `data-accion` seguía en el HTML.
//
// ── EL CONTRATO SE PARTIÓ EN DOS FUENTES (F06) ──────────────────────────────
// Las herramientas de edición se mudaron del panel lateral a una BARRA FLOTANTE
// sobre el mapa: el bloque `<section class="gml-bloque--edicion">` ya no existe
// en `index.html` y sus siete nodos los fabrica ahora `viewer/barra-edicion.js`,
// que monta `viewer/index.js#crearVisor`. El contrato no ha desaparecido: tiene
// dos extremos, y un `SELECTOR_*` de `app/` casa exactamente un nodo **de la
// cáscara** *o* viene **de la barra**. Lo que se sigue garantizando aquí:
//
//   1. Un selector que no case en `index.html` **y** no esté declarado «de la
//      barra» sigue siendo un fallo: el cableado a la nada de siempre.
//   2. Un selector declarado «de la barra» que SÍ aparezca en `index.html` es un
//      fallo NUEVO y peor, y se exige a CERO. Es el duplicado que el traslado
//      acaba de quitar —el bloque viejo y la barra fabricando los mismos siete
//      `data-*` a la vez—, y **este guardián es quien lo cazó**: volver a
//      declararlos ahí los resucitaría en silencio, con el segundo nodo muerto en
//      pantalla y con el mismo aspecto que el vivo.
//   3. La partición es EXHAUSTIVA y SIN SOLAPES, y no es una lista escrita a mano
//      en este fichero —que es justo lo que se pudre—: se DERIVA de la tabla
//      `CONTRATO` de `test/viewer/barra-edicion.dom.test.js`, el test hermano que
//      prueba la otra mitad (monta la barra y afirma que cada uno de esos siete
//      casa EXACTAMENTE un nodo, leyendo los valores de la fuente de
//      `app/main.js` en vez de copiarlos). De ahí salen tres consecuencias, que
//      son el punto entero:
//        · un `SELECTOR_*` nuevo cae POR DEFECTO del lado de la cáscara, así que
//          si nadie lo pone en `index.html` sale rojo aquí, nombrándolo;
//        · para pasarlo al lado de la barra hay que declararlo en ese fichero, y
//          declararlo ahí **es** someterlo a la prueba de que la barra lo produce
//          exactamente una vez. No queda rendija por la que colarse sin que
//          alguno de los dos guardianes lo mire;
//        · y si la lectura de esa tabla se rompiera, la partición no se afloja:
//          todo caería del lado de la cáscara y este guardián se volvería MÁS
//          estricto, no menos. El modo de fallo del instrumento es hacia el rojo.
//
// jsdom se usa aquí COMO LIBRERÍA, no como entorno: este fichero corre en el
// proyecto `node` y no puede importar `app/main.js` ni `viewer/barra-edicion.js`
// (los dos arrastran Leaflet, que exige `window`). Los selectores se leen del
// TEXTO y el HTML se parsea aparte.

describe('G16 · todo `SELECTOR_*` de app/ casa exactamente un nodo, y de UNA sola fuente', () => {
  const MODULOS_APP = readdirSync(join(RAIZ, 'app'), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => `app/${e.name}`)
    .sort()

  /** `{modulo, nombre, selector}` de cada export `SELECTOR_*` de `app/`. */
  const SELECTORES = MODULOS_APP.flatMap((rel) =>
    [...exportacionesConValor(fuenteDe(rel))]
      .filter(([nombre]) => nombre.startsWith('SELECTOR_'))
      .map(([nombre, selector]) => ({ modulo: rel, nombre, selector })),
  )

  const HTML = fuenteDe('index.html')
  const documento = new JSDOM(HTML).window.document

  /** Cuántos nodos casan. Aparte para poder probarla contra HTML sintético. */
  const cuantosCasan = (doc, selector) => doc.querySelectorAll(selector).length

  // ── La otra mitad del contrato: los selectores que fabrica la BARRA ────────

  /**
   * El test hermano que prueba la mitad «de la barra». Se nombra UNA vez y se
   * usa para las dos cosas: para derivar la partición y para remitir a él en los
   * mensajes de fallo, que es donde hace falta saber dónde vive la otra mitad.
   */
  const TEST_BARRA = 'test/viewer/barra-edicion.dom.test.js'

  const FUENTE_BARRA = (() => {
    try {
      return fuenteDe(TEST_BARRA)
    } catch (causa) {
      throw new Error(
        `contrato-catastro.test.js (G16): ${TEST_BARRA} ha desaparecido. De su tabla CONTRATO ` +
          `sale la partición de los SELECTOR_* de app/ entre «los que trae index.html» y «los ` +
          `que fabrica viewer/barra-edicion.js», y es además el test que prueba esa segunda ` +
          `mitad. Si la barra ya no existe, los siete selectores tienen que volver a index.html ` +
          `y este bloque sobra; si solo se ha movido el fichero, actualiza esta ruta.`,
        { cause: causa },
      )
    }
  })()

  /**
   * Los nombres de constante `SELECTOR_*` que {@link TEST_BARRA} declara en su
   * tabla `CONTRATO` (`{ constante: 'SELECTOR_…', etiqueta: 'BUTTON' }`).
   *
   * Se leen del TEXTO, como todo en este fichero: ese test importa Leaflet.
   * Función aparte —y no una constante— para poder probarla contra fuente
   * sintética más abajo: es el instrumento del que depende toda la partición.
   *
   * @param {string} fuente
   * @returns {string[]}
   */
  const declaradosEnLaBarra = (fuente) =>
    [...codigoDe(fuente).matchAll(/\bconstante:\s*'(SELECTOR_[\w$]+)'/g)].map((m) => m[1])

  const NOMBRES_BARRA = new Set(declaradosEnLaBarra(FUENTE_BARRA))

  /** Los que fabrica la barra… */
  const DE_LA_BARRA = SELECTORES.filter(({ nombre }) => NOMBRES_BARRA.has(nombre))
  /** …y todos los demás, que tienen que estar en la cáscara. */
  const DE_LA_CASCARA = SELECTORES.filter(({ nombre }) => !NOMBRES_BARRA.has(nombre))

  /**
   * Los selectores de `lista` cuyo recuento en `doc` NO es el esperado, ya
   * formateados para que el fallo diga QUIÉN y CUÁNTOS. Una sola función para las
   * dos mitades: la de la cáscara espera 1 y la de la barra espera 0.
   *
   * @param {Document} doc
   * @param {{modulo: string, nombre: string, selector: string}[]} lista
   * @param {number} esperado
   */
  const desviados = (doc, lista, esperado) =>
    lista
      .map(({ modulo, nombre, selector }) => ({
        quien: `${modulo}#${nombre} (${selector})`,
        casan: cuantosCasan(doc, selector),
      }))
      .filter((s) => s.casan !== esperado)

  it('el recorrido de selectores no es vacuo y cubre los dos módulos con contrato', () => {
    expect(SELECTORES.length, 'no se ha leído ni un SELECTOR_* de app/').toBeGreaterThan(0)
    const nombres = SELECTORES.map((s) => s.nombre)
    // El de F04, que es lo que este guardián retro-cubre.
    expect(nombres, 'SELECTOR_BOTON_GML (F04) ha desaparecido de app/').toContain(
      'SELECTOR_BOTON_GML',
    )
    // Y los de F05: el guardián tiene que estar mirando más de un módulo.
    expect(new Set(SELECTORES.map((s) => s.modulo)).size).toBeGreaterThan(1)
    expect(SELECTORES.some((s) => s.modulo === CABLEADO)).toBe(true)
    // Todos son selectores de atributo `data-*`, que es la convención del HTML.
    for (const { nombre, selector } of SELECTORES) {
      expect(selector, `${nombre} no parece un selector de atributo data-*`).toMatch(
        /^\[data-[\w-]+="[^"]+"\]$/,
      )
    }
  })

  it('index.html se ha parseado de verdad (y no es un documento vacío)', () => {
    expect(HTML.length).toBeGreaterThan(0)
    expect(documento.querySelectorAll('[data-accion]').length).toBeGreaterThan(0)
  })

  it('la partición es EXHAUSTIVA y SIN SOLAPES: ningún selector se cuela por la rendija', () => {
    // Las dos mitades cubren el todo y no se pisan. No se afirma NINGÚN número:
    // eso sería la lista escrita a mano otra vez, con otro nombre.
    expect([...DE_LA_CASCARA, ...DE_LA_BARRA].map((s) => s.nombre).sort()).toEqual(
      SELECTORES.map((s) => s.nombre).sort(),
    )
    expect(DE_LA_CASCARA.filter((s) => NOMBRES_BARRA.has(s.nombre))).toEqual([])
    // Y ninguna de las dos está vacía: con una vacía, la mitad correspondiente de
    // este guardián no estaría mirando nada.
    expect(DE_LA_CASCARA.length, 'ningún selector viene ya de index.html').toBeGreaterThan(0)
    expect(
      DE_LA_BARRA.length,
      `${TEST_BARRA} ya no declara ningún SELECTOR_* de app/ en su tabla CONTRATO: o la barra ` +
        `dejó de fabricarlos (y entonces vuelven a index.html) o el lector de esa tabla se ha ` +
        `roto y la partición ha dejado de existir`,
    ).toBeGreaterThan(0)
    // Un nombre declarado «de la barra» que app/ no exporta es una entrada podrida
    // en esa tabla: no rompe nada, y por eso hay que verlo.
    const nombresDeApp = new Set(SELECTORES.map((s) => s.nombre))
    expect(
      [...NOMBRES_BARRA].filter((nombre) => !nombresDeApp.has(nombre)),
      `constantes declaradas en el CONTRATO de ${TEST_BARRA} que app/ ya no exporta`,
    ).toEqual([])
  })

  it('cada selector DE LA CÁSCARA casa EXACTAMENTE un nodo de index.html', () => {
    expect(
      desviados(documento, DE_LA_CASCARA, 1),
      'selectores exportados por app/ que NO casan exactamente un nodo de index.html. Cero es ' +
        'un cableado a la nada; dos es peor, porque el módulo agarra el primero y el segundo ' +
        'queda muerto en pantalla con el mismo aspecto que el vivo. Los tests de app/ no lo ' +
        'ven: montan su propio DOM y ahí el nodo siempre está. Si el selector es de los que ' +
        `fabrica viewer/barra-edicion.js, su sitio es la tabla CONTRATO de ${TEST_BARRA}`,
    ).toEqual([])
  })

  it('⚠️ ningún selector DE LA BARRA vuelve a estar declarado en index.html', () => {
    expect(
      desviados(documento, DE_LA_BARRA, 0),
      'selectores que fabrica viewer/barra-edicion.js y que ADEMÁS aparecen en index.html. Es ' +
        'el duplicado que el traslado del bloque «Edición» al mapa acabó de quitar, y es peor ' +
        'que la ausencia: `cablearEdicion` agarraría el de la cáscara —el primero del ' +
        'documento— y el de la barra quedaría muerto sobre el mapa, con el mismo aspecto que ' +
        `el vivo. Estos siete nodos tienen un solo dueño; quien los prueba es ${TEST_BARRA}`,
    ).toEqual([])
  })

  it(`la otra mitad la prueba ${TEST_BARRA}, y sigue haciéndolo`, () => {
    // Este fichero corre en el proyecto `node` y NO puede montar la barra (Leaflet
    // exige `window`), así que la mitad de arriba se apoya en el test hermano. Lo
    // que se puede comprobar desde aquí es que ese apoyo sigue existiendo, y es lo
    // que se comprueba: si algo de esto cambia, sale rojo pidiendo que se mire a
    // mano si la otra mitad sigue afirmando lo que este guardián da por hecho.
    //
    // 1 · Corre de verdad: el sufijo `.dom.test.js` lo enruta al proyecto `dom`
    //     (ver `vitest.config.js`), y SPEC §6 exige los DOS proyectos en verde.
    expect(TEST_BARRA.endsWith('.dom.test.js')).toBe(true)
    // 2 · No copia los literales: lee los valores de la fuente de `app/main.js`.
    //     Si los copiara, sus siete selectores podrían divergir de los de verdad y
    //     estaría probando otra cosa.
    //     ⚠️ Sobre el CÓDIGO, no sobre el texto, y por quinta vez en este fichero:
    //     ese test NOMBRA `[data-accion="offset"]` en un comentario, para explicar
    //     de qué regla de `estilos/app.css` depende el orden de dos hermanos. Un
    //     `includes` sobre el fichero entero confundiría la explicación con la
    //     copia. Se comprueba abajo que la distinción sigue haciendo falta.
    expect(
      FUENTE_BARRA,
      `${TEST_BARRA} ya no lee los selectores de app/main.js`,
    ).toMatch(/readFileSync\([^\n]{0,80}'main\.js'/)
    const codigoBarra = codigoDe(FUENTE_BARRA)
    for (const { nombre, selector } of DE_LA_BARRA) {
      expect(
        codigoBarra,
        `${TEST_BARRA} ha copiado a mano el literal de ${nombre}: tiene que leerlo de app/main.js`,
      ).not.toContain(selector)
    }
    // La trampa, anclada: si ese comentario desapareciera, mirar el CÓDIGO y no el
    // texto dejaría de estar distinguiendo nada y esta cautela sobraría.
    const mencionados = DE_LA_BARRA.filter(({ selector }) => FUENTE_BARRA.includes(selector))
    expect(
      mencionados.length,
      `${TEST_BARRA} ya no nombra ningún selector en un comentario: el filtro de comentarios de ` +
        `esta comprobación deja de distinguir MENCIÓN de COPIA`,
    ).toBeGreaterThan(0)
    // 3 · Y afirma que cada uno casa EXACTAMENTE un nodo, que es la mitad del
    //     contrato que aquí se exige a CERO en `index.html`.
    expect(
      FUENTE_BARRA,
      `${TEST_BARRA} ya no afirma que cada selector case exactamente un nodo: sin eso, exigir ` +
        `aquí que valgan CERO en index.html dejaría a esos siete sin nadie que los cuente`,
    ).toMatch(/querySelectorAll\(selector\)\.length[\s\S]{0,400}?\)\.toBe\(1\)/)
  })

  it('el detector NO es vacuo: cuenta cero y cuenta dos sobre HTML sintético', () => {
    // Se ha VISTO fallar. Las dos formas de romper el contrato, escritas a
    // propósito, con el PRIMER selector real de la cáscara para que la prueba no
    // dependa de ningún literal escrito aquí.
    const { selector } = DE_LA_CASCARA[0]
    const atributo = selector.slice(1, -1) // `data-x="y"`
    const vacio = new JSDOM('<main></main>').window.document
    expect(cuantosCasan(vacio, selector), 'un documento sin el nodo debe dar 0').toBe(0)
    const duplicado = new JSDOM(`<main><p ${atributo}></p><p ${atributo}></p></main>`).window
      .document
    expect(cuantosCasan(duplicado, selector), 'un documento con el nodo dos veces debe dar 2')
      .toBe(2)
    // Y el HTML real da 1 para ese mismo selector: si diera otra cosa, el test de
    // arriba ya habría caído, pero aquí queda dicho que la herramienta MIDE.
    expect(cuantosCasan(documento, selector)).toBe(1)
  })

  it('la mitad NUEVA tampoco es vacua: un `data-*` de la barra en el HTML se caza', () => {
    // La prueba negativa del guardián que acaba de cazar el duplicado de verdad.
    // Se reconstruye el estado intermedio del traslado —una cáscara que todavía
    // declara uno de los nodos que ahora fabrica la barra— y se comprueba que la
    // comparación de arriba lo detecta y lo NOMBRA, uno por uno. Sin esto, «vale
    // cero» podría ser cierto por casualidad para siempre.
    //
    // Sobre HTML SINTÉTICO y no sobre `index.html`: un instrumento que se mide a
    // sí mismo contra el sujeto vigilado deja de decir nada el día que el sujeto
    // está roto —fallaría por el mismo motivo que el guardián, tapándolo—.
    for (const { nombre, selector } of DE_LA_BARRA) {
      const atributo = selector.slice(1, -1) // `data-x="y"`
      const resucitado = new JSDOM(`<main><p ${atributo}></p></main>`).window.document
      const cazados = desviados(resucitado, DE_LA_BARRA, 0)
      expect(cazados.map((c) => c.casan), `${nombre} resucitado en la cáscara`).toEqual([1])
      expect(cazados[0].quien).toContain(nombre)
    }
    // Y sobre el HTML real la misma llamada no caza nada, que es justo lo que
    // afirma el guardián: aquí queda dicho que la herramienta MIDE.
    expect(desviados(documento, DE_LA_BARRA, 0)).toEqual([])
  })

  it('el lector de la tabla CONTRATO no es vacuo, y falla hacia el ROJO', () => {
    // El instrumento del que depende la partición entera, probado contra fuente
    // sintética. Lee la forma real de la tabla…
    expect(declaradosEnLaBarra("{ constante: 'SELECTOR_X', etiqueta: 'BUTTON' },\n")).toEqual([
      'SELECTOR_X',
    ])
    // …no se inventa nada donde no hay tabla…
    expect(declaradosEnLaBarra('const CONTRATO = []\n')).toEqual([])
    // …y no cuenta lo que solo está NOMBRADO en un comentario, que es como está
    // escrita media cabecera de ese fichero.
    expect(declaradosEnLaBarra("// { constante: 'SELECTOR_FANTASMA' }\n")).toEqual([])
    // La consecuencia, que es lo que hace segura la partición: con la tabla
    // ilegible, la mitad «de la barra» queda VACÍA, todos los selectores caen del
    // lado de la cáscara y a los siete de la barra se les exige un nodo que
    // `index.html` ya no tiene. O sea, el fallo del instrumento pone la suite en
    // rojo en vez de aflojarla, que es la única dirección admisible.
    const conTablaIlegible = new Set(declaradosEnLaBarra(''))
    expect(SELECTORES.filter(({ nombre }) => conTablaIlegible.has(nombre))).toEqual([])
    expect(desviados(documento, SELECTORES, 1).length).toBeGreaterThan(0)
  })

  it('los `data-*` del HTML no se cuelan desde un COMENTARIO', () => {
    // `index.html` documenta el contrato en comentarios que NOMBRAN `data-campo`,
    // `data-accion`, `data-estado`… Un guardián por RegExp sobre el texto los
    // contaría como nodos; jsdom los parsea como comentarios y no casan. Queda
    // afirmado para que quien sustituya jsdom por un `match()` sepa lo que pierde.
    expect(HTML).toMatch(/<!--[\s\S]*data-accion[\s\S]*?-->/)
    const soloComentario = new JSDOM('<main><!-- data-accion="generar-gml" --></main>').window
      .document
    expect(cuantosCasan(soloComentario, '[data-accion="generar-gml"]')).toBe(0)
  })
})
