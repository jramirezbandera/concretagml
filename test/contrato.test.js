import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import configVitest from '../vitest.config.js'
import {
  crearExpediente,
  crearParcela,
  crearRecinto,
} from '../model/parcela.js'
import { crearEdificio, crearParteConstruccion } from '../model/edificio.js'
import * as area from '../geo/area.js'
import * as cierre from '../geo/cierre.js'
import * as utm from '../geo/utm.js'
import * as huso from '../geo/huso.js'
import * as barrel from '../index.js'
import fixture from './fixtures/geo/parcela-ring.json' with { type: 'json' }

// ── Test-guardián del contrato transversal de F00 (criterio de aceptación 5) ──
// "Ninguna función de model/ ni de geo/area · geo/cierre acepta o devuelve lat/lon."
// La frontera de proyección (geo/utm, geo/huso) SÍ expone lat/lon por diseño: se
// verifica aquí como frontera explícita, no como fuga.

const CLAVE_GEOGRAFICA = /^(lat|lon|latitud|longitud|latitude|longitude)$/i

/** Recorre en profundidad un POJO y devuelve las rutas cuyas claves parecen geográficas. */
function clavesGeograficas(valor, ruta = '$', acc = []) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => clavesGeograficas(v, `${ruta}[${i}]`, acc))
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVE_GEOGRAFICA.test(k)) acc.push(`${ruta}.${k}`)
      clavesGeograficas(v, `${ruta}.${k}`, acc)
    }
  }
  return acc
}

/** Comprueba que todo par de coordenadas es [x,y] de números finitos. */
function esParUTM(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
}

const anillo = fixture.anilloExterior

describe('contrato F00 · el modelo y la geometría pura viven en UTM (criterio 5)', () => {
  it('un Expediente de parcela completo no contiene claves lat/lon', () => {
    const recintos = [crearRecinto(anillo, 'EXTERIOR')]
    const parcela = crearParcela({
      idLocal: 'p1',
      refcat: fixture.refCatastral,
      recintos,
      geometriaOficial: recintos,
      superficieRegistral: 1500,
      origen: 'WFS',
    })
    const expediente = crearExpediente({
      tipo: 'PARCELA',
      srs: fixture.srs,
      autor: 'test',
      idDocumento: 'd1',
      parcela,
    })
    expect(clavesGeograficas(expediente)).toEqual([])
    // y sus vértices son pares UTM
    expect(expediente.parcela.recintos[0].vertices.every(esParUTM)).toBe(true)
  })

  it('un Edificio con partes no contiene claves lat/lon', () => {
    const recinto = crearRecinto(anillo, 'EXTERIOR')
    const parte = crearParteConstruccion({
      nombre: 'cuerpo principal',
      tipo: 'PRINCIPAL',
      recinto,
      plantasSobreRasante: 2,
      plantasBajoRasante: 1,
      origen: 'DIBUJADA',
    })
    const edificio = crearEdificio({
      refcat: fixture.refCatastral,
      modelo: 'COMPLETO',
      partes: [parte],
    })
    expect(clavesGeograficas(edificio)).toEqual([])
  })

  it('geo/area no devuelve lat/lon y opera en UTM', () => {
    expect(typeof area.area(anillo)).toBe('number')
    expect(typeof area.areaFirmada(anillo)).toBe('number')
    expect([-1, 1]).toContain(area.orientacion(anillo))
  })

  it('geo/cierre devuelve un anillo UTM abierto, sin lat/lon', () => {
    const cerrado = [...anillo, anillo[0]] // recierra artificialmente
    const { anillo: compensado } = cierre.compensarCierre(cerrado)
    expect(clavesGeograficas({ compensado })).toEqual([])
    expect(compensado.every(esParUTM)).toBe(true)
  })
})

describe('contrato F00 · frontera de proyección (utm/huso) — lat/lon permitido y esperado', () => {
  it('utm.inverse ES la frontera: devuelve lat/lon', () => {
    const r = utm.inverse(439250.35, 4479664.55, 30)
    expect(r).toHaveProperty('lat')
    expect(r).toHaveProperty('lon')
    expect(Number.isFinite(r.lat) && Number.isFinite(r.lon)).toBe(true)
  })

  it('huso.detectarHuso reporta el punto de caída (lon/lat) — frontera, no fuga', () => {
    const r = huso.detectarHuso(fixture.referencePoint)
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    expect(r).toHaveProperty('lon')
    expect(r).toHaveProperty('lat')
  })
})

describe('contrato F02 · la validación sale por el barrel y no expone lat/lon', () => {
  it('el barrel expone el espacio de nombres `validacion` con validarParcela y NIVEL', () => {
    expect(typeof barrel.validacion.validarParcela).toBe('function')
    expect(barrel.validacion.NIVEL).toEqual({ ERROR: 'ERROR', AVISO: 'AVISO' })
  })

  it('validarParcela devuelve {errores, avisos, puedeGenerar} en UTM, sin claves lat/lon', () => {
    const recintos = [crearRecinto(anillo, 'EXTERIOR')]
    const r = barrel.validacion.validarParcela(recintos, { srs: fixture.srs })
    expect(Array.isArray(r.errores)).toBe(true)
    expect(Array.isArray(r.avisos)).toBe(true)
    expect(typeof r.puedeGenerar).toBe('boolean')
    // Errores y avisos son listas SEPARADAS (criterio 3): no hay recuento mezclado.
    expect(r).not.toHaveProperty('total')
    expect(clavesGeograficas(r)).toEqual([])
  })
})

// ── Test-guardián del barrel raíz frente al visor (F03, hallazgo C1/T10) ──────
// `viewer/index.js` y `services/*` importan Leaflet, que exige `window`. Este
// fichero corre en el proyecto Vitest `node` (sin DOM), así que en la práctica el
// invariante ya se autoprotege: si el visor entrara en el barrel, ESTE import
// reventaría con `ReferenceError: document is not defined`. Pero la cabecera de
// `viewer/index.js` afirma por escrito que «el invariante lo vigila
// test/contrato.test.js», y una afirmación escrita tiene que ser cierta: aquí
// está la aserción explícita, que además nombra el motivo en el mensaje del test
// para quien la haga fallar. Momento de riesgo previsto: la Fase 4 (index.html +
// demo), cuando alguien quiera exportar el visor por el barrel «para que la demo
// lo importe bonito». La vía correcta sigue siendo importar `viewer/index.js`
// DIRECTAMENTE.
describe('contrato F03 · el visor NO sale por el barrel raíz (Leaflet exige window)', () => {
  it('el barrel raíz NO expone viewer ni services (Leaflet exige window)', () => {
    expect(Object.keys(barrel)).not.toContain('viewer')
    expect(Object.keys(barrel)).not.toContain('services')
  })
})

// ── Guarda transversal de F03/Fase 4 · (a) el descubrimiento de tests es una ──
// partición exacta de lo que hay en disco, y (b) proj4 no entra en la fuente.
//
// (a) `vitest.config.js` conserva `passWithNoTests: true` en el proyecto `dom`, y
// es NECESARIO: sin él, un run filtrado por nombre (`npm test -- celda`, que solo
// casa en `node`) fallaría por el proyecto `dom` vacío. Su contrapartida, anotada
// en el propio config, es que si el `include` del `dom` se rompiera los tests dom
// DESAPARECERÍAN EN VERDE. Esta guarda la cierra, y por eso vive aquí y no en un
// fichero `*.dom.test.js`: una guarda alojada en el proyecto `dom` deja de
// ejecutarse justo cuando el `include` del `dom` se rompe, que es el único caso
// que le importa. `test/contrato.test.js` corre en `node`, luego sobrevive.
// Tampoco es `expect(ficheros.length).toBe(N)`: eso es una lista a mano con otro
// nombre y nadie la actualizaría. Se DERIVA todo: se leen los `include`/`exclude`
// REALES del config (`defineConfig` es la identidad, así que el objeto se puede
// inspeccionar), se recorre el disco con `node:fs` como verdad-terreno y se
// comprueba que los dos proyectos PARTICIONAN ese conjunto: sin huérfanos, sin
// solapes y sin lados vacíos. Lo único que se mantiene a mano es la CONVENCIÓN DE
// NOMBRES que el propio config declara por escrito (`*.dom.test.js` → `dom`, el
// resto → `node`); si alguien la cambia, cambia las dos cosas a la vez y a
// sabiendas.
//
// (b) `proj4` es devDependency y su único uso legítimo es la fábrica de vectores
// de control `test/geo/utm-control.factory.test.js`, que contrasta el motor UTM
// PROPIO (`geo/utm.js`) contra un oráculo externo. La regla de oro 7 dice que
// jamás entra en el bundle. `vite.config.js` lo impide en el build; esto es la
// mitad ESTÁTICA, y no es redundante: el plugin de build, tal como se especificó
// al principio, NO DISPARABA (Vite resolvía `proj4` antes de llamarlo) y solo se
// descubrió provocando el fallo a propósito. Un grep no puede engañarse así.
//
// Momentos de riesgo previstos: (a) que alguien toque los globs del config —
// renombrar el sufijo, «simplificar» el `exclude` del `node`, mover tests a otro
// directorio— y lo dé por bueno porque la suite sigue verde; (b) que alguien
// resuelva una conversión de coordenadas «tirando de proj4, que ya está
// instalado», con el build en verde porque el import no cuelga de la entrada
// (p. ej. un módulo aún no cableado en `index.html`).
describe('guarda transversal Fase 4 · partición de tests derivada y fuente sin proj4', () => {
  const RAIZ = fileURLToPath(new URL('..', import.meta.url))

  /**
   * Recorre el árbol del repo desde la raíz y devuelve rutas POSIX RELATIVAS
   * (`test/geo/utm.test.js`), que es el formato en el que están escritos los
   * globs del config. Se usan relativas a propósito: así el casing de la letra
   * de unidad en Windows (ver cabecera de `vitest.config.js`) es irrelevante.
   *
   * @param {Set<string>} saltaDirs nombres de directorio que no se recorren
   * @param {(rel: string) => boolean} acepta filtro de fichero
   * @returns {string[]} rutas ordenadas
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

  // ── Traductor glob → RegExp ────────────────────────────────────────────────
  // SUBCONJUNTO SOPORTADO, deliberadamente mínimo (es el que usa el config):
  //   `**/`  → cero o más segmentos de directorio completos. El "cero" importa:
  //            es lo que hace que `test/**/*.test.js` case `test/smoke.test.js`
  //            además de `test/geo/utm.test.js`, igual que picomatch.
  //   `**`   → (al final) cualquier cosa, barras incluidas: `**/node_modules/**`.
  //   `*`    → cualquier cosa DENTRO de un segmento; NO cruza `/`.
  //   resto  → literal (se escapan los metacaracteres de RegExp).
  // NO SOPORTADO: `?`, llaves `{a,b}`, clases `[a-z]`, extglobs `!(x)`/`+(x)`/`@(x)`.
  // No se traducen mal en silencio: `globARegExp` REVIENTA si los ve, para que
  // quien los introduzca en el config amplíe antes este traductor.
  const GLOB_NO_SOPORTADO = /[?{}()[\]!+@]/

  /** Traduce un glob del subconjunto soportado a RegExp anclado. */
  function globARegExp(glob) {
    if (GLOB_NO_SOPORTADO.test(glob)) {
      throw new Error(
        `traductor glob→RegExp de test/contrato.test.js: el patrón «${glob}» usa ` +
          `sintaxis fuera del subconjunto soportado (solo «*» y «**»). Amplía el ` +
          `traductor antes de introducir ?, {a,b}, [clases] o extglobs en vitest.config.js.`,
      )
    }
    let re = '^'
    let i = 0
    while (i < glob.length) {
      const c = glob[i]
      if (c === '*') {
        if (glob[i + 1] === '*') {
          if (glob[i + 2] === '/') {
            re += '(?:[^/]+/)*' // `**/` → cero o más segmentos
            i += 3
            continue
          }
          re += '.*' // `**` final
          i += 2
          continue
        }
        re += '[^/]*' // `*` dentro de un segmento
        i += 1
        continue
      }
      re += '.^$\\|'.includes(c) ? `\\${c}` : c
      i += 1
    }
    return new RegExp(`${re}$`)
  }

  /** Normaliza `test.projects` del config a `{nombre, include, exclude}`. */
  function proyectosDelConfig() {
    const crudos = configVitest.test?.projects
    expect(Array.isArray(crudos), 'vitest.config.js debe declarar test.projects').toBe(true)
    return crudos.map((p) => {
      // Vitest admite strings (rutas a configs anidados); este repo usa objetos
      // en línea. Si algún día se anidan, esta guarda ya no ve los globs y hay
      // que reescribirla, así que aquí se para en seco en vez de mentir.
      if (typeof p === 'string') {
        throw new Error(
          `guarda de partición: vitest.config.js declara el proyecto «${p}» por ruta y ` +
            `esta guarda solo sabe inspeccionar proyectos en línea. Actualízala.`,
        )
      }
      const t = p.test ?? p
      return { nombre: t.name, include: t.include ?? [], exclude: t.exclude ?? [] }
    })
  }

  /** ¿Este proyecto ejecutaría esta ruta? (include ∧ ¬exclude, como Vitest.) */
  function captura(proyecto, ruta) {
    const incluido = proyecto.include.some((g) => globARegExp(g).test(ruta))
    const excluido = proyecto.exclude.some((g) => globARegExp(g).test(ruta))
    return incluido && !excluido
  }

  // Verdad-terreno: todos los `*.test.js` que EXISTEN en disco. Se recorre el
  // repo entero (no solo `test/`) a propósito: un test escrito fuera de `test/`
  // no lo ejecuta nadie y debe salir como huérfano, no pasar desapercibido.
  const EN_DISCO = recorrer(new Set(['node_modules', 'dist', '.git']), (rel) =>
    rel.endsWith('.test.js'),
  )
  const PROYECTOS = proyectosDelConfig()
  const porProyecto = Object.fromEntries(
    PROYECTOS.map((p) => [p.nombre, EN_DISCO.filter((f) => captura(p, f))]),
  )

  it('el traductor glob→RegExp casa lo que picomatch casaría (auto-test)', () => {
    const node = globARegExp('test/**/*.test.js')
    expect(node.test('test/smoke.test.js')).toBe(true) // `**/` con CERO segmentos
    expect(node.test('test/geo/utm.test.js')).toBe(true)
    expect(node.test('test/viewer/a/b/c.test.js')).toBe(true)
    expect(node.test('otro/a.test.js')).toBe(false)
    expect(node.test('test/geo/utm.testxjs')).toBe(false) // el `.` no es comodín

    const dom = globARegExp('test/**/*.dom.test.js')
    expect(dom.test('test/viewer/mapa.dom.test.js')).toBe(true)
    expect(dom.test('test/viewer/celda.test.js')).toBe(false)

    const nm = globARegExp('**/node_modules/**')
    expect(nm.test('node_modules/x/y.test.js')).toBe(true)
    expect(nm.test('a/b/node_modules/y.test.js')).toBe(true)
    expect(nm.test('test/geo/utm.test.js')).toBe(false)

    expect(() => globARegExp('test/**/*.{test,spec}.js')).toThrow(/subconjunto soportado/)
  })

  it('vitest.config.js declara exactamente los proyectos `node` y `dom`', () => {
    expect(PROYECTOS.map((p) => p.nombre).sort()).toEqual(['dom', 'node'])
  })

  it('ningún fichero de test queda HUÉRFANO (nadie lo ejecutaría)', () => {
    const huerfanos = EN_DISCO.filter((f) => !PROYECTOS.some((p) => captura(p, f)))
    // Si se rompe el `include` del proyecto `dom`, sus ficheros dejan de estar
    // capturados por `dom` y siguen excluidos de `node`: aparecen aquí, con
    // nombre y apellidos, en vez de evaporarse en verde por `passWithNoTests`.
    expect(
      huerfanos,
      'ficheros de test que NINGÚN proyecto de vitest.config.js ejecutaría',
    ).toEqual([])
  })

  it('ningún fichero de test lo capturan LOS DOS proyectos (sin solapes)', () => {
    const solapes = EN_DISCO.filter((f) => PROYECTOS.filter((p) => captura(p, f)).length > 1)
    // Un `*.dom.test.js` corriendo también en `node` reventaría por falta de
    // `window`; el día que alguien quite el `exclude` del `node`, conviene
    // enterarse por este mensaje y no por treinta fallos raros de jsdom.
    expect(solapes, 'ficheros capturados por más de un proyecto a la vez').toEqual([])
  })

  it('ninguno de los dos proyectos descubre CERO ficheros', () => {
    // Formulación honesta de «`passWithNoTests` no está tapando un
    // descubrimiento vacío»: no se afirma un número (eso caducaría), se afirma
    // que ninguno de los dos lados de la partición está vacío.
    for (const p of PROYECTOS) {
      expect(porProyecto[p.nombre].length, `el proyecto «${p.nombre}» no descubre ningún test`)
        .toBeGreaterThan(0)
    }
  })

  it('la partición coincide con la CONVENCIÓN DE NOMBRES del config', () => {
    // Lo único mantenido a mano, y es la convención que `vitest.config.js`
    // declara en su comentario: `*.dom.test.js` → `dom`, todo lo demás → `node`.
    const esDom = (f) => f.endsWith('.dom.test.js')
    expect(porProyecto.dom, 'el proyecto `dom` debe capturar exactamente los *.dom.test.js').toEqual(
      EN_DISCO.filter(esDom),
    )
    expect(porProyecto.node, 'el proyecto `node` debe capturar exactamente el resto').toEqual(
      EN_DISCO.filter((f) => !esDom(f)),
    )
  })

  // ── Mitad estática de la regla de oro 7 ───────────────────────────────────
  // Directorios que NO son fuente de producción. Lista corta y explícita a
  // propósito: `test` es el único sitio donde proj4 es legítimo, y el resto son
  // artefactos, documentación o andamiaje.
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
  // Casa el IMPORT, no la palabra: la cadena «proj4js» aparece en COMENTARIOS de
  // `geo/utm.js`, `parsers/importar.js` y `viewer/atribucion.js` —donde dicen que
  // el proyecto NO lo usa—, así que un `includes('proj4')` daría falso positivo.
  // Se exige `import`/`export` al principio de línea (módulos ESM estáticos) o la
  // forma llamada `import(...)`/`require(...)`, y se cubren los subpaths
  // (`proj4/dist/...`), igual que el plugin de `vite.config.js`.
  const IMPORTA_PROJ4 =
    /(?:^|\n)[ \t]*(?:import|export)[^\n]*['"]proj4(?:\/[^'"]*)?['"]|(?:import|require)\([ \t]*['"]proj4(?:\/[^'"]*)?['"][ \t]*\)/
  const FUENTES = recorrer(DIRS_NO_FUENTE, (rel) => /\.(?:js|mjs|html)$/.test(rel))

  it('ninguna fuente de producción importa proj4 (regla de oro 7)', () => {
    const infractores = FUENTES.filter((f) => IMPORTA_PROJ4.test(readFileSync(join(RAIZ, f), 'utf8')))
    expect(
      infractores,
      'fuentes que importan proj4: es devDependency y JAMÁS entra en el bundle; ' +
        'el motor UTM del proyecto es propio (geo/utm.js), y geo/huso.js da el huso',
    ).toEqual([])
    expect(FUENTES.length, 'el recorrido de fuentes no ha encontrado nada que mirar').toBeGreaterThan(
      0,
    )
  })

  it('el detector de imports de proj4 no es vacuo: distingue mención de import', () => {
    // Media docena de fuentes MENCIONAN proj4/proj4js en comentarios. Que las
    // haya es justo lo que hace inservible un `includes('proj4')`, así que se
    // afirma que existen (si dejaran de existir, la comprobación de arriba se
    // volvería trivial sin que nadie se enterase)…
    const mencionan = FUENTES.filter((f) => readFileSync(join(RAIZ, f), 'utf8').includes('proj4'))
    expect(mencionan.length, 'ninguna fuente menciona proj4: revisa el recorrido').toBeGreaterThan(0)
    // …y que el detector SÍ dispara sobre el único uso legítimo, que está fuera
    // del recorrido de fuentes (es la fábrica de vectores de control).
    const fabrica = 'test/geo/utm-control.factory.test.js'
    expect(EN_DISCO).toContain(fabrica)
    expect(IMPORTA_PROJ4.test(readFileSync(join(RAIZ, fabrica), 'utf8'))).toBe(true)
    expect(FUENTES).not.toContain(fabrica)
  })
})
