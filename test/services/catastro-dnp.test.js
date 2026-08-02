/* -------------------------------------------------------------------------- *
 * test/services/catastro-dnp.test.js — F09 · T2.3                              *
 * LOS DATOS ALFANUMÉRICOS de la parcela (`Consulta_DNPRC`) y su alta en el      *
 * cliente público.                                                             *
 *                                                                              *
 * Cubre las DOS piezas de la tarea porque son una sola frontera: el lector      *
 * (`services/_catastro-dnp.js`) y la operación que lo usa                       *
 * (`services/catastro.js#descriptivosPorRefcat`). Separarlas en dos ficheros    *
 * habría duplicado el arnés y los fixtures sin comprobar nada más.              *
 *                                                                              *
 * ── NO TOCA LA RED NI UNA VEZ ───────────────────────────────────────────────  *
 * El `fetch` entra doblado (`_doble-fetch.js`) y los cuerpos son los ficheros   *
 * capturados con `curl` el 2026-08-02, con su SHA-256 en `PROCEDENCIA.md`. La   *
 * política de uso del Catastro sanciona el uso automático con ~10 días de       *
 * denegación (override O8): «probarlo contra el servicio» no es una             *
 * alternativa disponible, y por eso no la hay.                                  *
 *                                                                              *
 * ── DE DÓNDE SALE CADA COSA, QUE ES LA MITAD DEL TRABAJO ────────────────────  *
 * Tres procedencias, y la distinción NO es cosmética:                           *
 *                                                                              *
 *   · **FIXTURE REAL** (`test/fixtures/catastro/ovc-dnprc-*.json`) — verdad     *
 *     externa. Manda sobre nuestro criterio (regla de oro 8). De aquí salen     *
 *     los valores esperados, leídos con `JSON.parse` y rutas explícitas: un     *
 *     ORÁCULO INDEPENDIENTE del módulo bajo prueba, que camina el árbol con su  *
 *     propio código. Ni un «MADRID» tecleado en este fichero.                   *
 *   · **FIXTURE DERIVADO** (`test/fixtures/catastro/derivados/`) — sintético,   *
 *     con su receta en su propio `PROCEDENCIA.md`. Existe porque el caso de la  *
 *     discrepancia entre inmuebles **no aparece en ninguna captura real**: los  *
 *     18 inmuebles de la parcela de referencia dicen todos `MADRID`.            *
 *   · **CUERPO FABRICADO AQUÍ** — objetos mínimos, escritos en el test y        *
 *     rotulados como tales. Se usan SOLO para los caminos que no tienen ni      *
 *     pueden tener captura: dos ramas a la vez, lista vacía, `cn` que           *
 *     contradice al subárbol… Ninguno afirma nada sobre cómo contesta el        *
 *     Catastro; afirman cómo se comporta el lector ante una forma dada.         *
 *                                                                              *
 * ── LAS CINCO TRAMPAS QUE ESTE FICHERO EXISTE PARA CLAVAR ───────────────────  *
 *   1. El parámetro se llama **`RefCat`**, no `RC`. La URL se compara byte a    *
 *      byte con la MEDIDA, leída de `PROCEDENCIA.md`.                           *
 *   2. El envoltorio es **`consulta_dnprcResult`, en minúsculas**. Se prueba    *
 *      además que la variante con la caja del nombre de la operación —la que    *
 *      saldría de `${op}Result`— NO se acepta.                                  *
 *   3. La parcela de referencia del proyecto cae en la rama **`lrcdnp`**, no en *
 *      `bico`. Se afirma leyendo el fichero, para que quede escrito que el      *
 *      caso «raro» es el normal aquí.                                           *
 *   4. El `cod:"17"` es un fallo NUESTRO y **jamás** sale como `NO_ENCONTRADO`. *
 *      Hay un guardián que barre varias respuestas y exige que ese motivo no    *
 *      aparezca ni una vez por esta operación.                                  *
 *   5. Una discrepancia entre inmuebles **no se resuelve eligiendo el primero**:*
 *      el campo se queda en `null` y el aviso sale por el canal.                *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): ni DOM, ni Leaflet, ni IndexedDB. *
 * -------------------------------------------------------------------------- */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  CAMPOS_DESCRIPTIVOS,
  CATASTRO_OVC_DNPRC_JSON,
  CLASE_PARCELA,
  CLASE_POR_CN,
  CLASE_POR_SUBARBOL,
  CLAVE_ENVOLTORIO_DNPRC,
  COD_DNPRC_MEDIDOS,
  PARAM_DNPRC,
  RAMA_DNPRC,
  TIPO_DNPRC,
  leerDnprc,
  urlDnprc,
} from '../../services/_catastro-dnp.js'
import { LONGITUD_REFCAT_PARCELA } from '../../services/_catastro-ovc.js'
import { crearTransporte } from '../../services/_red.js'
import { MOTIVO_CATASTRO, ORIGEN, crearClienteCatastro } from '../../services/catastro.js'
import { crearDobleDormir, crearDobleFetch } from './_doble-fetch.js'

// ── Verdad externa ────────────────────────────────────────────────────────────

const DIR = fileURLToPath(new URL('../fixtures/catastro/', import.meta.url))
const leer = (rel) => readFileSync(`${DIR}${rel}`, 'utf8')

const PROCEDENCIA = leer('PROCEDENCIA.md')
const URBANA = leer('ovc-dnprc-urbana-9398516VK3799G.json')
const RUSTICA = leer('ovc-dnprc-rustica-13005A10900005.json')
const COD17 = leer('ovc-dnprc-cod17.json')
const DISCORDANTE = leer('derivados/ovc-dnprc-municipios-discordantes.json')

/**
 * La URL con la que se capturó un fixture, leída de SU ficha en `PROCEDENCIA.md`.
 * Es la petición REAL, la única comprobada contra el servicio: atar el doble de
 * `fetch` a ella es lo que convierte cada test en una comprobación de que el
 * cliente pide EXACTAMENTE lo que se midió. Copiado en espíritu de
 * `test/services/catastro.test.js`, que es donde nació.
 *
 * @param {string} fichero
 * @returns {string}
 */
function urlMedida(fichero) {
  const lineas = PROCEDENCIA.split('\n')
  const inicio = lineas.findIndex((l) => l.startsWith('## ') && l.includes(fichero))
  if (inicio === -1) throw new Error(`PROCEDENCIA.md no documenta ${fichero}`)
  for (let i = inicio + 1; i < lineas.length && !lineas[i].startsWith('## '); i += 1) {
    const m = /^\|\s*URL\s*\|\s*`([^`]+)`\s*\|/.exec(lineas[i])
    if (m) return m[1]
  }
  throw new Error(`PROCEDENCIA.md no da la URL medida de ${fichero}`)
}

/** El SHA-256 que la ficha de un fixture publica. */
function shaPublicado(fichero) {
  const lineas = PROCEDENCIA.split('\n')
  const inicio = lineas.findIndex((l) => l.startsWith('## ') && l.includes(fichero))
  if (inicio === -1) throw new Error(`PROCEDENCIA.md no documenta ${fichero}`)
  for (let i = inicio + 1; i < lineas.length && !lineas[i].startsWith('## '); i += 1) {
    const m = /^\|\s*SHA-256\s*\|\s*`([0-9a-f]{64})`/.exec(lineas[i])
    if (m) return m[1]
  }
  throw new Error(`PROCEDENCIA.md no da el SHA-256 de ${fichero}`)
}

/** El primer bloque ```json de la ficha de un fixture. */
function cuerpoTranscrito(fichero) {
  const bloque = PROCEDENCIA.split('\n## ').find((s) => s.startsWith(`\`${fichero}\``))
  if (bloque === undefined) throw new Error(`PROCEDENCIA.md no documenta ${fichero}`)
  const m = /```json\n([\s\S]*?)\n```/.exec(bloque)
  if (m === null) throw new Error(`la ficha de ${fichero} no transcribe ningún cuerpo`)
  return m[1]
}

const URL_URBANA = urlMedida('ovc-dnprc-urbana-9398516VK3799G.json')
const URL_RUSTICA = urlMedida('ovc-dnprc-rustica-13005A10900005.json')
const URL_COD17 = urlMedida('ovc-dnprc-cod17.json')

/** Los parámetros de una URL medida, en su orden y con sus valores tal cual. */
const paresDe = (u) => [...new URL(u).searchParams]

/** La referencia catastral con la que se pidió cada fixture, dicha por su URL. */
const RC_URBANA = new URL(URL_URBANA).searchParams.get(PARAM_DNPRC.refcat)
const RC_RUSTICA = new URL(URL_RUSTICA).searchParams.get(PARAM_DNPRC.refcat)

// ── Oráculo INDEPENDIENTE: el árbol, caminado con otro código ────────────────
// No se usa el lector del módulo para sacar la verdad-terreno: sería el mismo
// código que está bajo prueba. Estas rutas están escritas a mano a partir de
// `PROCEDENCIA.md`, que es lo que se está comprobando que el módulo respeta.

const arbolUrbana = JSON.parse(URBANA)[CLAVE_ENVOLTORIO_DNPRC]
const arbolRustica = JSON.parse(RUSTICA)[CLAVE_ENVOLTORIO_DNPRC]
const inmueblesUrbana = arbolUrbana.lrcdnp.rcdnp
const inmuebleRustica = arbolRustica.bico.bi

// ── Cuerpos FABRICADOS: no son capturas y no lo pretenden ────────────────────

/**
 * Un cuerpo mínimo con la forma `bico`, para los caminos que ninguna captura
 * cubre. **No es una respuesta del Catastro**: es el menor objeto que atraviesa
 * la rama que se quiere ejercitar.
 *
 * @param {object} bi  El inmueble.
 * @param {object} [control]
 * @returns {string}
 */
const cuerpoBico = (bi, control = { cudnp: 1 }) =>
  JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { control, bico: { bi } } })

/** Lo mismo para la rama de varios. @returns {string} */
const cuerpoLista = (rcdnp, control = { cudnp: rcdnp.length }) =>
  JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { control, lrcdnp: { rcdnp } } })

/** Un inmueble urbano mínimo, con el municipio y la provincia que se le digan. */
const inmuebleUrbano = (nm, np) => ({ dt: { np, nm, locs: { lous: { lourb: {} } } } })

// ── Arnés del cliente ─────────────────────────────────────────────────────────

/**
 * Lo que el doble de `fetch` contesta a cada URL MEDIDA. Una URL que no esté aquí
 * recibe un 404: **si el cliente construye una URL que difiere en un byte de la
 * medida, el doble contesta 404 y el test cae**.
 */
const RESPUESTAS = new Map([
  [URL_URBANA, URBANA],
  [URL_RUSTICA, RUSTICA],
])

const PLAN_FIXTURES = (url) =>
  RESPUESTAS.has(url) ? { estado: 200, texto: RESPUESTAS.get(url) } : { estado: 404 }

/** Todos los motivos que esta suite ha producido DE VERDAD. Ver el guardián final. */
const MOTIVOS_VISTOS = new Set()

/**
 * Monta transporte + cliente + dobles. `alAvisar` es un espía en los dos, así que
 * ningún test escribe en la consola y el que quiera comprobar un aviso solo tiene
 * que mirar `avisos`.
 */
function montar({ plan = PLAN_FIXTURES, cache } = {}) {
  const red = crearDobleFetch({ plan })
  const esperas = crearDobleDormir({})
  const avisos = []
  const espia = (mensaje, detalle) => avisos.push({ mensaje, detalle })
  const transporte = crearTransporte({
    fetch: red.fetch,
    dormir: esperas.dormir,
    aleatorio: () => 0,
    alAvisar: espia,
  })
  const crudo = crearClienteCatastro({
    transporte,
    ...(cache === undefined ? {} : { cache }),
    alAvisar: espia,
  })
  const cliente = {
    ...crudo,
    descriptivosPorRefcat: async (...args) => {
      const r = await crudo.descriptivosPorRefcat(...args)
      if (typeof r.motivo === 'string') MOTIVOS_VISTOS.add(r.motivo)
      return r
    },
  }
  return { cliente, crudo, red, avisos }
}

/** Caché doble: un `Map` con contadores. No hay IndexedDB en este fichero. */
function crearCacheDoble() {
  const almacen = new Map()
  const llamadas = { leer: 0, guardar: 0 }
  return {
    almacen,
    llamadas,
    puerto: {
      async leer(clave) {
        llamadas.leer += 1
        return almacen.get(clave) ?? null
      },
      async guardar(clave, valor, meta) {
        llamadas.guardar += 1
        almacen.set(clave, { valor, guardadoEn: meta.guardadoEn })
      },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('catastro-dnp · el arnés lee verdad externa (anti-vacuidad)', () => {
  it('los tres fixtures reales existen, son JSON y traen lo que su ficha dice', () => {
    expect(typeof arbolUrbana).toBe('object')
    expect(typeof arbolRustica).toBe('object')
    expect(JSON.parse(COD17)[CLAVE_ENVOLTORIO_DNPRC].lerr[0].cod).toBe('17')
    // La referencia se lee de la URL medida, no se teclea.
    expect(RC_URBANA).toMatch(new RegExp(`^[0-9A-Z]{${LONGITUD_REFCAT_PARCELA}}$`))
    expect(RC_RUSTICA).toMatch(new RegExp(`^[0-9A-Z]{${LONGITUD_REFCAT_PARCELA}}$`))
    expect(RC_RUSTICA).not.toBe(RC_URBANA)
  })

  it('el fixture del `cod:17` es BYTE A BYTE lo que PROCEDENCIA.md transcribe', () => {
    // Este fichero no se recapturó: se escribió DESDE la transcripción literal de
    // la ficha. Que el cuerpo y el SHA-256 publicado cuadren es lo que convierte
    // esa copia en verdad externa — si se hubiera perdido un byte, el hash no
    // cuadraría y este test lo diría.
    expect(COD17).toBe(cuerpoTranscrito('ovc-dnprc-cod17.json'))
    expect(createHash('sha256').update(COD17, 'utf8').digest('hex')).toBe(
      shaPublicado('ovc-dnprc-cod17.json'),
    )
    expect(Buffer.byteLength(COD17, 'utf8')).toBe(117)
  })

  it('los dos fixtures de datos siguen teniendo el SHA-256 que publica su ficha', () => {
    for (const [fichero, texto] of [
      ['ovc-dnprc-urbana-9398516VK3799G.json', URBANA],
      ['ovc-dnprc-rustica-13005A10900005.json', RUSTICA],
    ]) {
      expect(createHash('sha256').update(texto, 'utf8').digest('hex'), fichero).toBe(
        shaPublicado(fichero),
      )
    }
  })

  it('LA PARCELA DE REFERENCIA DEL PROYECTO NO TRAE `bico`: trae `lrcdnp` con 18', () => {
    // La trampa 3, afirmada sobre el fichero. `bico` parece el caso normal y no lo
    // es aquí: quien lea `…Result.bico.bi.dt.nm` obtiene `undefined` justo en la
    // parcela que recorre toda la suite.
    expect(Object.keys(arbolUrbana)).not.toContain(RAMA_DNPRC.UNO)
    expect(Object.keys(arbolUrbana)).toContain(RAMA_DNPRC.VARIOS)
    expect(Array.isArray(inmueblesUrbana)).toBe(true)
    expect(inmueblesUrbana.length).toBeGreaterThan(1)
    // Y la rústica, al revés: un inmueble por la rama `bico`.
    expect(Object.keys(arbolRustica)).toContain(RAMA_DNPRC.UNO)
    expect(Object.keys(arbolRustica)).not.toContain(RAMA_DNPRC.VARIOS)
  })

  it('en la rama `lrcdnp` NO hay ni `ldt` ni `cn` (por eso el domicilio y la clase)', () => {
    // Es la razón medida de las decisiones B y C del módulo, y se comprueba sobre
    // el fichero para que no dependa de que alguien se acuerde.
    expect(URBANA.includes('"ldt"')).toBe(false)
    expect(URBANA.includes('"cn"')).toBe(false)
    // Y en la rama `bico` sí están las dos cosas.
    expect(typeof inmuebleRustica.ldt).toBe('string')
    expect(typeof inmuebleRustica.idbi.cn).toBe('string')
  })

  it('el fixture DERIVADO es el original con un solo municipio cambiado', () => {
    const derivado = JSON.parse(DISCORDANTE)
    // Barrera 2: el aviso viaja dentro del propio fichero.
    expect(typeof derivado._AVISO_FIXTURE_SINTETICO).toBe('string')
    expect(derivado._AVISO_FIXTURE_SINTETICO).toMatch(/SINTETICO/)
    const lista = derivado[CLAVE_ENVOLTORIO_DNPRC].lrcdnp.rcdnp
    expect(lista).toHaveLength(inmueblesUrbana.length)
    const distintos = lista.filter((r, i) => r.dt.nm !== inmueblesUrbana[i].dt.nm)
    expect(distintos, 'la mutación tenía que tocar exactamente un inmueble').toHaveLength(1)
    // Y la provincia sigue intacta en los 18: es la mitad anti-vacuidad del caso.
    expect(lista.every((r, i) => r.dt.np === inmueblesUrbana[i].dt.np)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LA URL — trampa 1: el parámetro se llama `RefCat`
// ─────────────────────────────────────────────────────────────────────────────

describe('urlDnprc · la petición es EXACTAMENTE la medida', () => {
  it('reproduce byte a byte la URL con la que se capturó cada fixture', () => {
    expect(urlDnprc(RC_URBANA)).toBe(URL_URBANA)
    expect(urlDnprc(RC_RUSTICA)).toBe(URL_RUSTICA)
  })

  it('el parámetro de la referencia se llama `RefCat` y NO `RC`', () => {
    const nombres = paresDe(urlDnprc(RC_URBANA)).map(([n]) => n)
    expect(nombres).toContain(PARAM_DNPRC.refcat)
    expect(PARAM_DNPRC.refcat).toBe('RefCat')
    expect(nombres).not.toContain('RC')
    // Y la URL medida del `cod:17` —la que SÍ lleva `RC`— es otra: es la prueba de
    // que este test no es vacuo. Ese nombre existe, se probó, y contestó un error.
    expect(paresDe(URL_COD17).map(([n]) => n)).toContain('RC')
    expect(urlDnprc(RC_URBANA)).not.toBe(URL_COD17)
  })

  it('`Provincia` y `Municipio` van vacíos, en el orden medido, y no se pueden llenar', () => {
    expect(paresDe(urlDnprc(RC_URBANA))).toEqual([
      [PARAM_DNPRC.provincia, ''],
      [PARAM_DNPRC.municipio, ''],
      [PARAM_DNPRC.refcat, RC_URBANA],
    ])
    // La firma solo admite la referencia: no hay por dónde meter una provincia.
    expect(urlDnprc.length).toBe(1)
  })

  it('la base es la constante exportada (punto único de contingencia CORS)', () => {
    expect(urlDnprc(RC_URBANA).startsWith(`${CATASTRO_OVC_DNPRC_JSON}?`)).toBe(true)
    // Y es el `.svc` del CALLEJERO, no el de coordenadas del módulo hermano.
    expect(CATASTRO_OVC_DNPRC_JSON).toContain('COVCCallejero.svc')
  })

  it('valida ANTES de emitir: sin referencia utilizable no hay petición', () => {
    // Defensa 1. La respuesta `cod:17` («LA REFERENCIA CATASTRAL ES OBLIGATORIA»)
    // es lo que el servicio contesta cuando no le llega referencia, y suena a dato
    // que falta. Que no se pueda construir esa petición es mejor que saber leerla.
    expect(() => urlDnprc(undefined)).toThrow(TypeError)
    expect(() => urlDnprc(null)).toThrow(TypeError)
    expect(() => urlDnprc(9398516)).toThrow(TypeError)
    expect(() => urlDnprc('')).toThrow(RangeError)
    expect(() => urlDnprc(RC_URBANA.slice(0, -1))).toThrow(RangeError)
    expect(() => urlDnprc(`${RC_URBANA}0001XX`)).toThrow(RangeError)
    // NO normaliza: una referencia en minúsculas o con espacios se RECHAZA en vez
    // de arreglarse. Normalizar aquí sería una segunda verdad sobre qué es una
    // referencia catastral, y ya hay una en `services/catastro.js`.
    expect(() => urlDnprc(RC_URBANA.toLowerCase())).toThrow(RangeError)
    expect(() => urlDnprc(` ${RC_URBANA} `)).toThrow(RangeError)
  })

  it('el mensaje del rechazo nombra el `cod:17` y dice a quién llamar', () => {
    expect(() => urlDnprc('')).toThrow(/17/)
    expect(() => urlDnprc('')).toThrow(/normalizarRefcat/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL LECTOR — el camino de los datos
// ─────────────────────────────────────────────────────────────────────────────

describe('leerDnprc · la parcela urbana de referencia (rama `lrcdnp`, 18 inmuebles)', () => {
  const r = leerDnprc(URBANA)

  it('la lee, cuenta los inmuebles y dice por qué rama vino', () => {
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
    expect(r.rama).toBe(RAMA_DNPRC.VARIOS)
    // CONTADOS, no leídos del contador del servicio (aquí coinciden, y se dice).
    expect(r.inmuebles).toBe(inmueblesUrbana.length)
    expect(r.declarados).toBe(arbolUrbana.control.cudnp)
  })

  it('municipio y provincia salen de `dt.nm`/`dt.np`, iguales en los 18', () => {
    expect(r.datos.municipio).toBe(inmueblesUrbana[0].dt.nm)
    expect(r.datos.provincia).toBe(inmueblesUrbana[0].dt.np)
    // Anti-vacuidad de la decisión A: aquí NO hay discrepancia porque los 18
    // coinciden de verdad, y eso se comprueba con el oráculo independiente.
    expect(new Set(inmueblesUrbana.map((i) => i.dt.nm)).size).toBe(1)
    expect(r.discrepancias).toEqual([])
  })

  it('NO hay paraje, ni polígono, ni parcela, ni domicilio — y eso no es un fallo', () => {
    // Es urbana (no hay subárbol rústico) y viene por la rama lista (no hay `ldt`).
    // El informe imprimirá «No consta» en los cuatro. Está MEDIDO, no supuesto.
    expect(r.datos.paraje).toBeNull()
    expect(r.datos.poligono).toBeNull()
    expect(r.datos.parcela).toBeNull()
    expect(r.datos.domicilio).toBeNull()
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
  })

  it('la clase se deduce del subárbol `lous`, porque `cn` no existe en esta rama', () => {
    expect(inmueblesUrbana[0].dt.locs.lous).toBeTruthy()
    expect(inmueblesUrbana[0].idbi).toBeUndefined()
    expect(r.datos.clase).toBe(CLASE_PARCELA.URBANA)
  })

  it('el domicilio NO se compone desde `dir`, aunque la calle esté en el fichero', () => {
    // Decisión C. La calle está ahí —`SAN RESTITUTO`— y aun así `domicilio` es
    // `null`: montarlo exigiría decidir qué partes entran y qué se hace con los 18
    // `loint` distintos, que son de cada inmueble y no de la parcela. Eso es
    // redactar el dato, no leerlo.
    const nv = inmueblesUrbana[0].dt.locs.lous.lourb.dir.nv
    expect(typeof nv).toBe('string')
    expect(r.datos.domicilio).toBeNull()
    expect(r.mensaje).not.toContain(nv)
  })
})

describe('leerDnprc · la parcela rústica (rama `bico`): aquí sí viven paraje y polígono', () => {
  const r = leerDnprc(RUSTICA)
  const lorus = inmuebleRustica.dt.locs.lors.lorus

  it('la lee por la rama de un inmueble', () => {
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
    expect(r.rama).toBe(RAMA_DNPRC.UNO)
    expect(r.inmuebles).toBe(1)
  })

  it('los siete campos salen de las rutas que documenta PROCEDENCIA.md', () => {
    expect(r.datos).toEqual({
      municipio: inmuebleRustica.dt.nm,
      provincia: inmuebleRustica.dt.np,
      paraje: lorus.npa,
      poligono: lorus.cpp.cpo,
      parcela: lorus.cpp.cpa,
      domicilio: inmuebleRustica.ldt,
      clase: CLASE_PARCELA.RUSTICA,
    })
  })

  it('el subárbol rústico es `lors`, y trae `lourb` dentro sin volverla urbana', () => {
    // `lors` contiene `lorus` Y `lourb`: que haya un bloque de dirección con forma
    // urbana no convierte la parcela en urbana.
    expect(inmuebleRustica.dt.locs.lors.lourb).toBeTruthy()
    expect(inmuebleRustica.dt.locs.lous).toBeUndefined()
    expect(r.datos.clase).toBe(CLASE_PARCELA.RUSTICA)
  })

  it('los códigos llegan SIN ceros a la izquierda y se entregan tal cual', () => {
    // `cpa` vale «5» mientras la referencia catastral lleva «00005». Se entrega el
    // del servicio: componerlo desde la referencia daría otra cadena para el mismo
    // dato. Se comprueba contra la referencia REAL, leída de la URL medida.
    expect(RC_RUSTICA).toContain(`0000${r.datos.parcela}`)
    expect(r.datos.parcela).not.toBe(`0000${r.datos.parcela}`)
  })

  it('el domicilio es el `ldt` LITERAL, con sus dos espacios y todo', () => {
    expect(r.datos.domicilio).toBe(inmuebleRustica.ldt)
    expect(r.datos.domicilio).toContain('  ')
  })

  it('el nombre del municipio llega sin tilde y NO se «arregla»', () => {
    // Medido: `ALCAZAR DE SAN JUAN`, y no es un problema de codificación —en el
    // mismo fichero hay `Polígono` y `LABRADÍO` en UTF-8 correcto—. Es la
    // convención del dato, y un informe que la corrija se inventa la ortografía.
    expect(RUSTICA).toContain('Polígono')
    expect(r.datos.municipio).toBe(inmuebleRustica.dt.nm)
    expect(r.datos.municipio.normalize('NFD')).toBe(r.datos.municipio)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL LECTOR — los caminos que no se entienden
// ─────────────────────────────────────────────────────────────────────────────

describe('leerDnprc · trampa 2: el envoltorio va en MINÚSCULAS', () => {
  it('la clave es `consulta_dnprcResult`, no la que saldría del nombre de la operación', () => {
    expect(CLAVE_ENVOLTORIO_DNPRC).toBe('consulta_dnprcResult')
    expect(URBANA.startsWith(`{"${CLAVE_ENVOLTORIO_DNPRC}"`)).toBe(true)
  })

  it('la variante `Consulta_DNPRCResult` NO se acepta (y el mensaje avisa del porqué)', () => {
    // La que produciría `${operacion}Result`, que es exactamente lo que funciona
    // con el servicio hermano y falla con este.
    const camel = URBANA.replace(CLAVE_ENVOLTORIO_DNPRC, 'Consulta_DNPRCResult')
    const r = leerDnprc(camel)
    expect(r.tipo).toBe(TIPO_DNPRC.RESPUESTA_ILEGIBLE)
    expect(r.datos).toBeNull()
    expect(r.mensaje).toContain('MINÚSCULAS')
  })
})

describe('leerDnprc · trampa 4: un error del servicio no es «esa parcela no existe»', () => {
  const r = leerDnprc(COD17)

  it('el `cod:17` sale como RESPUESTA_ILEGIBLE, con el código y la descripción literales', () => {
    expect(r.tipo).toBe(TIPO_DNPRC.RESPUESTA_ILEGIBLE)
    expect(r.datos).toBeNull()
    const lerr = JSON.parse(COD17)[CLAVE_ENVOLTORIO_DNPRC].lerr[0]
    expect(r.cod).toBe(lerr.cod)
    expect(r.des).toBe(lerr.des)
    expect(r.mensaje).toContain(lerr.des)
  })

  it('el mensaje dice que el fallo es NUESTRO y nombra el parámetro bueno', () => {
    expect(r.mensaje).toContain(COD_DNPRC_MEDIDOS['17'].deQuienEs)
    expect(r.mensaje).toContain(PARAM_DNPRC.refcat)
  })

  it('y dice explícitamente que NO se traduce a «no existe», porque nadie lo ha medido', () => {
    expect(r.mensaje).toContain('nadie ha medido')
    expect(r.mensaje).toContain('PROCEDENCIA.md')
  })

  it('NO existe ninguna tabla de códigos que signifiquen «no hay datos»', () => {
    // La defensa 2, afirmada por su ausencia. `COD_DNPRC_MEDIDOS` es un
    // DICCIONARIO de lo que se ha visto, no una tabla de clasificación: se
    // comprueba que su única entrada declara de quién es el fallo, y que el módulo
    // no exporta ningún «SIN_DATOS» ni nada que se le parezca.
    expect(Object.keys(COD_DNPRC_MEDIDOS)).toEqual(['17'])
    expect(COD_DNPRC_MEDIDOS['17'].deQuienEs).toContain('NUESTRO')
    expect(Object.values(TIPO_DNPRC)).toEqual([
      TIPO_DNPRC.DESCRIPTIVOS,
      TIPO_DNPRC.RESPUESTA_ILEGIBLE,
    ])
  })

  it('un `cod` desconocido dice que no se sabe qué significa, en vez de suponerlo', () => {
    const otro = COD17.replace('"17"', '"99"')
    const r99 = leerDnprc(otro)
    expect(r99.tipo).toBe(TIPO_DNPRC.RESPUESTA_ILEGIBLE)
    expect(r99.cod).toBe('99')
    expect(r99.mensaje).toContain('no se sabe qué significa')
  })
})

describe('leerDnprc · cuerpos que no se entienden (fabricados, no capturados)', () => {
  const ilegibles = [
    ['no es JSON', 'esto no es json'],
    ['no trae el envoltorio', JSON.stringify({ otraCosa: {} })],
    ['el envoltorio no es un objeto', JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: 'texto' })],
    ['no trae ninguna rama', JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { control: {} } })],
    [
      'trae LAS DOS ramas a la vez (son excluyentes)',
      JSON.stringify({
        [CLAVE_ENVOLTORIO_DNPRC]: { bico: { bi: {} }, lrcdnp: { rcdnp: [{}] } },
      }),
    ],
    ['`bico` sin `bi` dentro', JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { bico: {} } })],
    [
      '`rcdnp` que no es un array',
      JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { lrcdnp: { rcdnp: {} } } }),
    ],
    ['`rcdnp` VACÍO (caso no medido)', cuerpoLista([])],
    ['un inmueble que no es un objeto', cuerpoLista([inmuebleUrbano('X', 'Y'), 7])],
    [
      '`lerr` que no es un array',
      JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { control: { cuerr: 1 }, lerr: {} } }),
    ],
    [
      '`cuerr` sin `lerr` que lo enumere',
      JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { control: { cuerr: 1 } } }),
    ],
    [
      'un `lerr` sin `cod`',
      JSON.stringify({ [CLAVE_ENVOLTORIO_DNPRC]: { control: { cuerr: 1 }, lerr: [{ des: 'X' }] } }),
    ],
  ]

  it.each(ilegibles)('«%s» → RESPUESTA_ILEGIBLE con su porqué', (_titulo, cuerpo) => {
    const r = leerDnprc(cuerpo)
    expect(r.tipo).toBe(TIPO_DNPRC.RESPUESTA_ILEGIBLE)
    expect(r.datos).toBeNull()
    expect(r.rama).toBeNull()
    expect(r.mensaje.length).toBeGreaterThan(80)
    // La coletilla que impide el error silencioso, en TODOS.
    expect(r.mensaje).toContain('nadie ha medido')
  })

  it('la forma del resultado es la MISMA salga bien o mal', () => {
    const bien = leerDnprc(URBANA)
    const mal = leerDnprc('{}')
    expect(Object.keys(mal).sort()).toEqual(Object.keys(bien).sort())
  })

  it('lanza TypeError si el llamante no pasa texto (contrato del programador)', () => {
    // La otra mitad de la frontera: una respuesta rara del SERVICIO es un estado;
    // un `texto` que no es texto lo construye código, y eso sí revienta.
    expect(() => leerDnprc(undefined)).toThrow(TypeError)
    expect(() => leerDnprc(JSON.parse(URBANA))).toThrow(TypeError)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL LECTOR — decisión A (discrepancias) y decisión B (clase)
// ─────────────────────────────────────────────────────────────────────────────

describe('leerDnprc · decisión A: si los inmuebles no coinciden, NO se elige el primero', () => {
  const r = leerDnprc(DISCORDANTE)

  it('el campo discordante se queda en `null` y la discrepancia se declara', () => {
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
    expect(r.datos.municipio).toBeNull()
    expect(r.discrepancias).toHaveLength(1)
    expect(r.discrepancias[0].campo).toBe('municipio')
  })

  it('la discrepancia es DATO: qué valores hay y cuántos inmuebles traen cada uno', () => {
    // Regla de oro 9: no dice cuál es el bueno, porque no se sabe.
    const cuenta = new Map()
    for (const i of JSON.parse(DISCORDANTE)[CLAVE_ENVOLTORIO_DNPRC].lrcdnp.rcdnp) {
      cuenta.set(i.dt.nm, (cuenta.get(i.dt.nm) ?? 0) + 1)
    }
    expect(r.discrepancias[0].valores).toEqual(
      [...cuenta].map(([valor, inmuebles]) => ({ valor, inmuebles })),
    )
    expect(r.discrepancias[0].valores.length).toBeGreaterThan(1)
  })

  it('un lector que se quedara con el primero daría MADRID y no se enteraría', () => {
    // La mitad que explica por qué el fixture derivado cambia el ÚLTIMO inmueble.
    const primero = JSON.parse(DISCORDANTE)[CLAVE_ENVOLTORIO_DNPRC].lrcdnp.rcdnp[0].dt.nm
    expect(typeof primero).toBe('string')
    expect(r.datos.municipio).not.toBe(primero)
  })

  it('los campos en los que SÍ coinciden los 18 se entregan igual (anti-vacuidad)', () => {
    expect(r.datos.provincia).toBe(inmueblesUrbana[0].dt.np)
    expect(r.datos.clase).toBe(CLASE_PARCELA.URBANA)
  })

  it('la discrepancia sale también por `avisos`, que es lo que el cliente propaga', () => {
    expect(r.avisos.some((a) => a.includes('municipio'))).toBe(true)
  })

  it('la clave sintética `_AVISO_FIXTURE_SINTETICO` no estorba al lector', () => {
    // Barrera 2 del fixture derivado: el aviso vive en una clave de primer nivel y
    // el lector solo mira `consulta_dnprcResult`. Si algún día se volviera estricto
    // con las claves de primer nivel, este test cae y la barrera se rediseña — en
    // vez de descubrirse rota.
    expect(DISCORDANTE).toContain('_AVISO_FIXTURE_SINTETICO')
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
  })
})

describe('leerDnprc · decisión B: la clase se deduce del subárbol y, si no, es `null`', () => {
  it('sin `lous` ni `lors` la clase es `null`: no se adivina', () => {
    const r = leerDnprc(cuerpoBico({ dt: { nm: 'X', np: 'Y' } }))
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
    expect(r.datos.municipio).toBe('X')
    expect(r.datos.clase).toBeNull()
  })

  it('el hueco declarado «rama lista + rústica» sale `null`, no «urbana por defecto»', () => {
    // Nadie ha medido si una rústica con varios inmuebles trae `lors`. Lo que este
    // test fija es la conducta ANTE ESE HUECO: sin subárbol reconocible, `null`.
    // No es una captura y no pretende serlo (ver el `PROCEDENCIA.md` de derivados).
    const r = leerDnprc(cuerpoLista([{ dt: { nm: 'X', np: 'Y', locs: {} } }]))
    expect(r.datos.clase).toBeNull()
  })

  it('con los DOS subárboles a la vez no se elige: `null` y aviso', () => {
    const r = leerDnprc(
      cuerpoBico({ dt: { locs: { lous: { lourb: {} }, lors: { lorus: {} } } } }),
    )
    expect(r.datos.clase).toBeNull()
    expect(r.avisos.join(' ')).toContain('excluyentes')
  })

  it('`cn` decide solo cuando el subárbol no ha podido (y solo existe en `bico`)', () => {
    for (const [cn, clase] of Object.entries(CLASE_POR_CN)) {
      const r = leerDnprc(cuerpoBico({ idbi: { cn }, dt: { nm: 'X' } }))
      expect(r.datos.clase, `cn=${cn}`).toBe(clase)
    }
  })

  it('si `cn` CONTRADICE al subárbol, tampoco se elige: `null` y aviso', () => {
    const r = leerDnprc(cuerpoBico({ idbi: { cn: 'RU' }, dt: { locs: { lous: { lourb: {} } } } }))
    expect(r.datos.clase).toBeNull()
    expect(r.avisos.join(' ')).toContain('sin determinar')
  })

  it('un `cn` que no es ninguno de los medidos se ignora y se dice', () => {
    const r = leerDnprc(cuerpoBico({ idbi: { cn: 'ZZ' }, dt: { locs: { lous: { lourb: {} } } } }))
    expect(r.datos.clase).toBe(CLASE_PARCELA.URBANA)
    expect(r.avisos.join(' ')).toContain('ZZ')
  })

  it('la tabla de subárboles cubre las dos clases y ninguna más', () => {
    expect(Object.values(CLASE_POR_SUBARBOL).sort()).toEqual(Object.values(CLASE_PARCELA).sort())
    expect(Object.keys(CLASE_POR_SUBARBOL).sort()).toEqual(['lors', 'lous'])
  })
})

describe('leerDnprc · lo que se dice sin cambiar el desenlace', () => {
  it('un contador que no cuadra se avisa, y mandan los inmuebles CONTADOS', () => {
    const r = leerDnprc(cuerpoLista([inmuebleUrbano('X', 'Y'), inmuebleUrbano('X', 'Y')], {
      cudnp: 9,
    }))
    expect(r.inmuebles).toBe(2)
    expect(r.declarados).toBe(9)
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
    expect(r.avisos.join(' ')).toContain('539')
  })

  it('un inmueble sin `dt` no rompe la lectura, pero se dice', () => {
    const r = leerDnprc(cuerpoLista([inmuebleUrbano('X', 'Y'), {}]))
    expect(r.tipo).toBe(TIPO_DNPRC.DESCRIPTIVOS)
    expect(r.avisos.join(' ')).toContain('`dt`')
    // Y como uno trae municipio y el otro no, los dos no coinciden: `null`.
    expect(r.datos.municipio).toBeNull()
  })

  it('una cadena VACÍA es `null`, no un dato vacío haciéndose pasar por dato', () => {
    const r = leerDnprc(cuerpoBico({ dt: { nm: '   ', np: 'CIUDAD REAL' } }))
    expect(r.datos.municipio).toBeNull()
    expect(r.datos.provincia).toBe('CIUDAD REAL')
  })

  it('los SIETE campos están siempre, valgan lo que valgan', () => {
    for (const cuerpo of [URBANA, RUSTICA, DISCORDANTE, cuerpoBico({})]) {
      const { datos } = leerDnprc(cuerpo)
      expect(Object.keys(datos).sort()).toEqual([...CAMPOS_DESCRIPTIVOS].sort())
      for (const campo of CAMPOS_DESCRIPTIVOS) {
        expect(datos[campo] === null || typeof datos[campo] === 'string', campo).toBe(true)
        expect(datos[campo], `${campo} no puede ser cadena vacía`).not.toBe('')
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL CLIENTE PÚBLICO — contrato E
// ─────────────────────────────────────────────────────────────────────────────

describe('catastro.descriptivosPorRefcat · el contrato E, de punta a punta', () => {
  it('pide la URL medida y devuelve los siete campos del contrato', async () => {
    const { cliente, red } = montar()
    const r = await cliente.descriptivosPorRefcat(RC_RUSTICA)
    expect(r.ok).toBe(true)
    expect(red.urls()).toEqual([URL_RUSTICA])
    expect(Object.keys(r.datos).sort()).toEqual([...CAMPOS_DESCRIPTIVOS].sort())
    expect(r.datos).toEqual(leerDnprc(RUSTICA).datos)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(r.procedencia.url).toBe(URL_RUSTICA)
  })

  it('en la parcela de referencia da municipio y provincia, y «No consta» lo demás', async () => {
    // La consecuencia del plan de F09, comprobada: es urbana y viene por la rama
    // lista, así que no hay paraje, ni polígono, ni parcela, ni domicilio. **No es
    // un fallo**: `ok` sigue siendo `true`.
    const { cliente } = montar()
    const r = await cliente.descriptivosPorRefcat(RC_URBANA)
    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.datos.municipio).toBe(inmueblesUrbana[0].dt.nm)
    expect(r.datos.provincia).toBe(inmueblesUrbana[0].dt.np)
    expect([r.datos.paraje, r.datos.poligono, r.datos.parcela, r.datos.domicilio]).toEqual([
      null,
      null,
      null,
      null,
    ])
  })

  it('acepta la referencia de INMUEBLE (20) y consulta la de su parcela', async () => {
    const { cliente, red } = montar()
    const r = await cliente.descriptivosPorRefcat(`${RC_URBANA}0001AY`)
    expect(r.ok).toBe(true)
    expect(red.urls()).toEqual([URL_URBANA])
  })

  it('una referencia mal escrita NO lanza y NO toca la red: es dato del usuario', async () => {
    const { cliente, red } = montar()
    const r = await cliente.descriptivosPorRefcat('esto no es una referencia')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(red.total).toBe(0)
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
    expect(r.procedencia.url).toBeNull()
    // Y el mensaje explica la trampa: sin referencia el servicio dice que «es
    // obligatoria», que suena a dato que falta y es una petición mal construida.
    expect(r.mensaje).toContain('OBLIGATORIA')
  })

  it('un `srs` LANZA: esta consulta no lleva sistema de referencia', async () => {
    // Ignorarlo en silencio le haría creer a quien lo escribió que ha pedido algo
    // que no ha pedido. La petición medida tiene tres parámetros y ninguno es SRS.
    const { cliente } = montar()
    await expect(cliente.descriptivosPorRefcat(RC_URBANA, { srs: 'EPSG:25830' })).rejects.toThrow(
      TypeError,
    )
    await expect(cliente.descriptivosPorRefcat(RC_URBANA, null)).rejects.toThrow(TypeError)
  })

  it('la segunda consulta sale de la CACHÉ y no toca la red (override O8)', async () => {
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    const primera = await cliente.descriptivosPorRefcat(RC_RUSTICA)
    const segunda = await cliente.descriptivosPorRefcat(RC_RUSTICA)

    expect(primera.procedencia.origen).toBe(ORIGEN.RED)
    expect(segunda.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(segunda.datos).toEqual(primera.datos)
    expect(red.total, 'la segunda consulta ha vuelto a pedir').toBe(1)
    expect(segunda.procedencia.url).toBeNull()
    expect(segunda.procedencia.edadMs).not.toBeNull()
  })

  it('se cachea EL TEXTO del servicio, no el objeto ya leído', async () => {
    // Misma disciplina que la colección del WFS: una corrección futura del lector
    // arregla retroactivamente lo ya guardado, los bytes son la verdad externa y la
    // forma del POJO es interna.
    const cache = crearCacheDoble()
    const { cliente } = montar({ cache: cache.puerto })
    await cliente.descriptivosPorRefcat(RC_RUSTICA)
    const guardados = [...cache.almacen.values()].map((e) => e.valor)
    expect(guardados).toEqual([RUSTICA])
  })

  it('la clave de caché NO lleva SRS, porque la consulta tampoco', async () => {
    const cache = crearCacheDoble()
    const { cliente } = montar({ cache: cache.puerto })
    await cliente.descriptivosPorRefcat(RC_RUSTICA)
    const [clave] = [...cache.almacen.keys()]
    expect(clave).toContain(RC_RUSTICA)
    expect(clave).not.toContain('EPSG')
    // Y empieza por un prefijo que `storage/cache-catastro.js` ya conoce: un
    // prefijo nuevo exigiría tocar `storage/` y probablemente una migración.
    expect(clave.startsWith('parcela:')).toBe(true)
  })

  it('un cuerpo cacheado que ya no se puede leer se ignora y se va a la red', async () => {
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    await cliente.descriptivosPorRefcat(RC_RUSTICA)
    const [clave] = [...cache.almacen.keys()]
    cache.almacen.set(clave, { valor: 'ya no es JSON', guardadoEn: 0 })
    const r = await cliente.descriptivosPorRefcat(RC_RUSTICA)
    expect(r.ok).toBe(true)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(red.total).toBe(2)
  })

  it('la discrepancia entre inmuebles sale por el CANAL, no por el resultado', async () => {
    // El dato se entrega —con el campo conflictivo en `null`—, así que `ok` es
    // `true` y el invariante del contrato obliga a `mensaje: null`. Sin canal, la
    // discrepancia se perdería entera.
    const { cliente, avisos } = montar({ plan: { estado: 200, texto: DISCORDANTE } })
    const r = await cliente.descriptivosPorRefcat(RC_URBANA)
    expect(r.ok).toBe(true)
    expect(r.mensaje).toBeNull()
    expect(r.datos.municipio).toBeNull()
    const suyos = avisos.filter((a) => a.mensaje.includes('municipio'))
    expect(suyos).toHaveLength(1)
    expect(suyos[0].mensaje).toContain('No consta')
  })

  it('sin discrepancias no se avisa de nada: el canal no se usa de adorno', async () => {
    const { cliente, avisos } = montar()
    await cliente.descriptivosPorRefcat(RC_RUSTICA)
    expect(avisos).toEqual([])
  })

  it('un error HTTP sale con su motivo de transporte', async () => {
    const { cliente } = montar({ plan: { estado: 404 } })
    const r = await cliente.descriptivosPorRefcat(RC_URBANA)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
  })

  it('sobre un cliente destruido devuelve CANCELADA sin tocar nada', async () => {
    const { cliente, red } = montar()
    cliente.destruir()
    const r = await cliente.descriptivosPorRefcat(RC_URBANA)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(red.total).toBe(0)
  })

  it('todos los resultados cumplen los invariantes del ResultadoCatastro', async () => {
    const { cliente } = montar({
      plan: (url) =>
        url === URL_URBANA ? { estado: 200, texto: URBANA } : { estado: 200, texto: COD17 },
    })
    const resultados = [
      await cliente.descriptivosPorRefcat(RC_URBANA),
      await cliente.descriptivosPorRefcat(RC_RUSTICA),
      await cliente.descriptivosPorRefcat('nada'),
    ]
    const claves = Object.keys(resultados[0]).sort()
    for (const r of resultados) {
      expect(Object.keys(r).sort()).toEqual(claves)
      expect(r.ok).toBe(r.datos !== null)
      expect(r.ok).toBe(r.motivo === null)
      expect(r.ok).toBe(r.mensaje === null)
      if (r.motivo !== null) expect(Object.values(MOTIVO_CATASTRO)).toContain(r.motivo)
      expect(r.procedencia.url !== null).toBe(r.procedencia.origen === ORIGEN.RED)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL GUARDIÁN. Va el último a propósito: dentro de un fichero, Vitest ejecuta los
// tests en orden de declaración, así que para cuando esto corre ya se ha producido
// todo lo que esta suite es capaz de producir.
// ─────────────────────────────────────────────────────────────────────────────

describe('descriptivosPorRefcat · guardián: NO_ENCONTRADO no es alcanzable', () => {
  it('ni un solo cuerpo de error produce NO_ENCONTRADO por esta operación', async () => {
    // Trampa 4, y es el guardián que impide que alguien «arregle» el `cod:17`
    // metiéndolo en un camino de «no encontrado». Nadie ha medido qué contesta este
    // endpoint a una referencia inexistente (hueco declarado en PROCEDENCIA.md),
    // así que traducir cualquier código a «esa parcela no está» sería inventarse la
    // respuesta del Catastro.
    const cuerpos = [COD17, COD17.replace('"17"', '"99"'), '{}', 'no soy json']
    for (const texto of cuerpos) {
      const { cliente } = montar({ plan: { estado: 200, texto } })
      const r = await cliente.descriptivosPorRefcat(RC_URBANA)
      expect(r.ok).toBe(false)
      expect(r.motivo, `cuerpo: ${texto.slice(0, 40)}`).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
    }
    expect(MOTIVOS_VISTOS.has(MOTIVO_CATASTRO.NO_ENCONTRADO)).toBe(false)
  })

  it('el guardián no es vacuo: esta suite SÍ ha producido otros motivos', async () => {
    // Prueba negativa del instrumento. Si `MOTIVOS_VISTOS` no se llenara, la
    // afirmación de arriba sería verdad por casualidad.
    expect(MOTIVOS_VISTOS.size).toBeGreaterThan(2)
    expect(MOTIVOS_VISTOS.has(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)).toBe(true)
    expect(MOTIVOS_VISTOS.has(MOTIVO_CATASTRO.ENTRADA_INVALIDA)).toBe(true)
  })
})
