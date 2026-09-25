/* -------------------------------------------------------------------------- *
 * test/pwa/precache.test.js — la aplicación instalable (2026-09-25)            *
 *                                                                              *
 * Dos cosas: la composición de `sw.js` a partir de la plantilla, y lo que la   *
 * plantilla HACE una vez compuesta. Lo segundo se prueba ejecutando el         *
 * `pwa/sw.js` de verdad dentro de un `vm`, con una caché y un `fetch` falsos: *
 * así se afirma el fichero que se publica y no una copia de su lógica.        *
 *                                                                              *
 * Lo que se vigila, por orden de lo caro que sería romperlo:                   *
 *   · que el Catastro, el IGN y OSM NO pasen por el service worker (tienen su  *
 *     caché y su régimen de uso, y una segunda caché aquí sería otra verdad);  *
 *   · que la portada vaya por RED primero (si no, nadie vería una versión      *
 *     nueva) y que sin red abra la última buena;                               *
 *   · que una versión nueva borre la caché de las viejas, y solo las suyas.    *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

import {
  MARCA_PRECACHE,
  MARCA_VERSION,
  PORTADA,
  componerServiceWorker,
  listaPrecache,
  versionDe,
} from '../../pwa/precache.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const PLANTILLA = readFileSync(join(RAIZ, 'pwa', 'sw.js'), 'utf8')
const ALCANCE = 'https://jramirezbandera.github.io/concretagml/'

// ── La composición ───────────────────────────────────────────────────────────

describe('pwa/precache · qué se precachea', () => {
  it('index.html pasa a ser la PORTADA, y se excluyen el propio sw.js y los mapas', () => {
    expect(
      listaPrecache([
        'index.html',
        'assets/index-abc.js',
        'assets/index-abc.js.map',
        'sw.js',
        'iconos/icono-192.png',
        'manifest.webmanifest',
      ]),
    ).toEqual([PORTADA, 'assets/index-abc.js', 'iconos/icono-192.png', 'manifest.webmanifest'])
  })

  it('normaliza barras de Windows y prefijos, y no repite', () => {
    expect(listaPrecache(['assets\\a.js', './assets/a.js', '/assets/a.js'])).toEqual(['assets/a.js'])
  })

  it('contrato roto ⇒ TypeError', () => {
    expect(() => listaPrecache('index.html')).toThrow(TypeError)
    expect(() => listaPrecache([''])).toThrow(TypeError)
  })
})

describe('pwa/precache · la versión sale del CONTENIDO', () => {
  const base = [
    ['index.html', '<html>'],
    ['assets/a.js', 'console.log(1)'],
  ]

  it('es estable: mismos ficheros, misma versión, en cualquier orden', () => {
    expect(versionDe(base)).toMatch(/^[0-9a-f]{12}$/)
    expect(versionDe([...base].reverse())).toBe(versionDe(base))
  })

  it('cambia si cambia un byte, o si un fichero se renombra', () => {
    expect(versionDe([base[0], ['assets/a.js', 'console.log(2)']])).not.toBe(versionDe(base))
    expect(versionDe([base[0], ['assets/b.js', 'console.log(1)']])).not.toBe(versionDe(base))
  })

  it('acepta contenidos binarios (los iconos, las fuentes)', () => {
    expect(versionDe([['iconos/i.png', new Uint8Array([137, 80, 78, 71])]])).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('pwa/precache · componer la plantilla', () => {
  it('la plantilla real trae las dos marcas, y componer las sustituye', () => {
    const sw = componerServiceWorker(PLANTILLA, { precache: ['./', 'assets/a.js'], version: 'abc123' })
    expect(sw).not.toContain(MARCA_PRECACHE)
    expect(sw).not.toContain(MARCA_VERSION)
    expect(sw).toContain('const PRECACHE = ["./","assets/a.js"]')
    expect(sw).toContain('const VERSION = "abc123"')
  })

  it('⛔ una plantilla sin marca REVIENTA: publicarla sería el modo sin conexión muerto en silencio', () => {
    expect(() => componerServiceWorker('// nada', { precache: [], version: 'x' })).toThrow(/@gml-precache/)
    const doble = `${PLANTILLA}\n${MARCA_VERSION}`
    expect(() => componerServiceWorker(doble, { precache: [], version: 'x' })).toThrow(/@gml-version/)
  })
})

// ── Lo que hace el service worker, ejecutado ─────────────────────────────────

/** Respuesta falsa con la forma que usa el script: `ok`, `type` y `clone()`. */
const respuesta = (cuerpo, { ok = true, type = 'basic' } = {}) => ({
  cuerpo,
  ok,
  type,
  clone() {
    return respuesta(cuerpo, { ok, type })
  },
})

/** Un `CacheStorage` en memoria. Las claves son URL absolutas. */
function crearCaches(red) {
  const almacenes = new Map()
  const clave = (p) => (typeof p === 'string' ? p : p.url)
  return {
    almacenes,
    async open(nombre) {
      if (!almacenes.has(nombre)) almacenes.set(nombre, new Map())
      const m = almacenes.get(nombre)
      return {
        async addAll(urls) {
          for (const u of urls) {
            const r = await red(u)
            if (!r.ok) throw new TypeError(`addAll: ${u} no ha dado 200`)
            m.set(u, r)
          }
        },
        async put(p, r) {
          m.set(clave(p), r)
        },
      }
    },
    async keys() {
      return [...almacenes.keys()]
    },
    async delete(nombre) {
      return almacenes.delete(nombre)
    },
    async match(p) {
      for (const m of almacenes.values()) {
        const r = m.get(clave(p))
        if (r) return r
      }
      return undefined
    },
  }
}

/**
 * Ejecuta el service worker en un `vm` y devuelve lo necesario para dispararle
 * eventos. `red` es el `fetch`: recibe una URL o una petición.
 */
function montarServiceWorker({ precache = ['./', 'assets/a.js'], version = 'v2', red } = {}) {
  const fetch = vi.fn(async (p) => red(typeof p === 'string' ? p : p.url))
  const caches = crearCaches((u) => fetch(u))
  const oyentes = {}
  const self = {
    registration: { scope: ALCANCE },
    addEventListener: (tipo, fn) => {
      oyentes[tipo] = fn
    },
  }
  const codigo = componerServiceWorker(PLANTILLA, { precache, version })
  vm.runInNewContext(codigo, { self, caches, fetch, URL, Promise, console })

  const conEspera = () => {
    const e = { promesa: null, waitUntil: (p) => (e.promesa = p) }
    return e
  }
  return {
    caches,
    fetch,
    async instalar() {
      const e = conEspera()
      oyentes.install(e)
      await e.promesa
    },
    async activar() {
      const e = conEspera()
      oyentes.activate(e)
      await e.promesa
    },
    /** Dispara un `fetch`. Devuelve la respuesta, o `null` si el SW no contestó. */
    async pedir(url, { method = 'GET', mode = 'no-cors' } = {}) {
      const e = { request: { url, method, mode }, respuesta: null, respondWith: (p) => (e.respuesta = p) }
      oyentes.fetch(e)
      return e.respuesta === null ? null : await e.respuesta
    },
  }
}

describe('pwa/sw · instalar y activar', () => {
  it('instalar precachea CADA ruta, resuelta contra el alcance, en la caché de su versión', async () => {
    const sw = montarServiceWorker({ red: (u) => respuesta(`red:${u}`) })
    await sw.instalar()
    const cache = sw.caches.almacenes.get('concreta-gml-v2')
    expect([...cache.keys()]).toEqual([ALCANCE, `${ALCANCE}assets/a.js`])
  })

  it('activar borra las cachés de OTRAS versiones suyas, y no toca las ajenas', async () => {
    const sw = montarServiceWorker({ red: (u) => respuesta(u) })
    await sw.caches.open('concreta-gml-v1')
    await sw.caches.open('otra-cosa')
    await sw.instalar()
    await sw.activar()
    expect([...sw.caches.almacenes.keys()].sort()).toEqual(['concreta-gml-v2', 'otra-cosa'])
  })

  it('la plantilla SIN componer también corre: no precachea nada y se llama «dev»', async () => {
    const oyentes = {}
    const caches = crearCaches(async () => respuesta(''))
    vm.runInNewContext(PLANTILLA, {
      self: { registration: { scope: ALCANCE }, addEventListener: (t, fn) => (oyentes[t] = fn) },
      caches,
      fetch: vi.fn(),
      URL,
      Promise,
      console,
    })
    const e = { waitUntil: (p) => (e.p = p) }
    oyentes.install(e)
    await e.p
    expect([...caches.almacenes.get('concreta-gml-dev').keys()]).toEqual([])
  })
})

describe('pwa/sw · qué contesta, y qué NO toca', () => {
  it('⛔ otro ORIGEN no pasa por aquí: el Catastro, el IGN y OSM van directos', async () => {
    const sw = montarServiceWorker({ red: (u) => respuesta(u) })
    for (const url of [
      'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=X',
      'https://www.ign.es/wmts/pnoa-ma?x=1',
      'https://tile.openstreetmap.org/6/31/24.png',
    ]) {
      expect(await sw.pedir(url), url).toBeNull()
    }
    expect(sw.fetch).not.toHaveBeenCalled()
  })

  it('lo que no es GET, tampoco', async () => {
    const sw = montarServiceWorker({ red: (u) => respuesta(u) })
    expect(await sw.pedir(`${ALCANCE}algo`, { method: 'POST' })).toBeNull()
  })

  it('la PORTADA va por red primero, y se guarda para abrir sin conexión', async () => {
    let enLinea = true
    let publicada = 'portada v2'
    const sw = montarServiceWorker({
      red: (u) => {
        if (!enLinea) throw new TypeError('Failed to fetch')
        return respuesta(u === ALCANCE || u.startsWith(`${ALCANCE}?`) ? publicada : u)
      },
    })
    await sw.instalar()

    // Con red: lo publicado HOY, aunque la caché tenga otra cosa.
    publicada = 'portada v3'
    expect((await sw.pedir(`${ALCANCE}?demo=real`, { mode: 'navigate' })).cuerpo).toBe('portada v3')

    // Sin red: la última buena, llegue con la consulta que llegue.
    enLinea = false
    expect((await sw.pedir(`${ALCANCE}?otra=cosa`, { mode: 'navigate' })).cuerpo).toBe('portada v3')
  })

  it('una portada que no es 200 no pisa la buena', async () => {
    let estado = { ok: true, cuerpo: 'buena' }
    let enLinea = true
    const sw = montarServiceWorker({
      precache: [],
      red: () => {
        if (!enLinea) throw new TypeError('Failed to fetch')
        return respuesta(estado.cuerpo, { ok: estado.ok })
      },
    })
    await sw.pedir(ALCANCE, { mode: 'navigate' })
    estado = { ok: false, cuerpo: '404' }
    await sw.pedir(ALCANCE, { mode: 'navigate' })
    enLinea = false
    expect((await sw.pedir(ALCANCE, { mode: 'navigate' })).cuerpo).toBe('buena')
  })

  it('sin red y sin nada guardado, el fallo se propaga (no se inventa una respuesta)', async () => {
    const sw = montarServiceWorker({
      precache: [],
      red: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(sw.pedir(ALCANCE, { mode: 'navigate' })).rejects.toThrow('Failed to fetch')
  })

  it('lo demás del sitio, caché primero: lo precacheado no vuelve a pedirse', async () => {
    const sw = montarServiceWorker({ red: (u) => respuesta(`red:${u}`) })
    await sw.instalar()
    sw.fetch.mockClear()
    expect((await sw.pedir(`${ALCANCE}assets/a.js`)).cuerpo).toBe(`red:${ALCANCE}assets/a.js`)
    expect(sw.fetch).not.toHaveBeenCalled()
  })

  it('lo que no estaba se pide y se queda para la próxima', async () => {
    const sw = montarServiceWorker({ precache: [], red: (u) => respuesta(`red:${u}`) })
    const url = `${ALCANCE}assets/tarde.js`
    await sw.pedir(url)
    await sw.pedir(url)
    expect(sw.fetch).toHaveBeenCalledTimes(1)
  })
})
