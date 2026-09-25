/* -------------------------------------------------------------------------- *
 * test/storage/fichero-disco.test.js — el expediente en un fichero del disco   *
 *                                          (2026-09-25)                        *
 *                                                                              *
 * `storage/fichero-disco.js` por fuera. La File System Access API no existe   *
 * en Node ni en jsdom, así que la ventana, el fichero (`FileSystemFileHandle`)  *
 * y la base son dobles: lo que se prueba es la TRADUCCIÓN —qué excepción del   *
 * navegador es qué motivo— y que nada de esto lance por causas del entorno.   *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, vi } from 'vitest'

import { ALMACENES } from '../../storage/bd.js'
import {
  CLAVE_VINCULO,
  MOTIVO_DISCO,
  crearFicheroDisco,
  mensajeDisco,
} from '../../storage/fichero-disco.js'

/** Un error con el `name` que usa el navegador. */
const errorDe = (nombre) => Object.assign(new Error(nombre), { name: nombre })

/** Un `FileSystemFileHandle` de mentira que apunta lo que se escribe. */
function asaFalsa(nombre = 'proyecto.json') {
  const asa = {
    name: nombre,
    escrito: [],
    abortados: 0,
    fallo: null,
    permiso: 'granted',
    async createWritable() {
      if (asa.fallo) throw errorDe(asa.fallo)
      let buffer = ''
      return {
        async write(t) {
          buffer += t
        },
        async close() {
          asa.escrito.push(buffer)
        },
        async abort() {
          asa.abortados += 1
        },
      }
    },
    async queryPermission() {
      return asa.permiso
    },
    async requestPermission() {
      return asa.permiso
    },
    async getFile() {
      if (asa.fallo) throw errorDe(asa.fallo)
      return { name: nombre, text: async () => asa.escrito.at(-1) ?? '' }
    },
  }
  return asa
}

/** Una base en memoria con la forma de `idb`. */
function baseFalsa() {
  const datos = new Map()
  return {
    datos,
    async get(almacen, clave) {
      return datos.get(`${almacen}/${clave}`)
    },
    async put(almacen, registro) {
      datos.set(`${almacen}/${registro.id}`, registro)
    },
    async delete(almacen, clave) {
      datos.delete(`${almacen}/${clave}`)
    },
  }
}

describe('storage/fichero-disco · disponible solo donde hay API', () => {
  it('sin `showSaveFilePicker` (Firefox, Safari, jsdom) no está disponible y no lanza', async () => {
    const disco = crearFicheroDisco({ ventana: {} })
    expect(disco.disponible).toBe(false)
    expect(await disco.elegirDestino('x.json')).toMatchObject({ ok: false, motivo: MOTIVO_DISCO.SIN_API })
  })

  it('con la API está disponible', () => {
    expect(crearFicheroDisco({ ventana: { showSaveFilePicker: async () => asaFalsa() } }).disponible).toBe(true)
  })
})

describe('storage/fichero-disco · elegir destino', () => {
  it('pide un .json, con el nombre sugerido y un `id` para recordar la carpeta', async () => {
    const asa = asaFalsa('proyecto_9398516VK3799G.json')
    const showSaveFilePicker = vi.fn(async () => asa)
    const disco = crearFicheroDisco({ ventana: { showSaveFilePicker } })
    const r = await disco.elegirDestino('proyecto_9398516VK3799G_2026.json')
    expect(r).toEqual({ ok: true, asa, nombre: 'proyecto_9398516VK3799G.json', motivo: null })
    const [opciones] = showSaveFilePicker.mock.calls[0]
    expect(opciones.suggestedName).toBe('proyecto_9398516VK3799G_2026.json')
    expect(opciones.types[0].accept['application/json']).toEqual(['.json'])
    expect(opciones.id).toMatch(/^[\w-]+$/)
  })

  it('cerrar el selector es CANCELADO, no un fallo', async () => {
    const disco = crearFicheroDisco({
      ventana: {
        showSaveFilePicker: async () => {
          throw errorDe('AbortError')
        },
      },
    })
    expect((await disco.elegirDestino('x.json')).motivo).toBe(MOTIVO_DISCO.CANCELADO)
  })
})

describe('storage/fichero-disco · escribir', () => {
  const disco = crearFicheroDisco({ ventana: {} })

  it('escribe el texto entero y cierra', async () => {
    const asa = asaFalsa()
    expect(await disco.escribir(asa, '{"a":1}')).toEqual({ ok: true, motivo: null, causa: null })
    expect(asa.escrito).toEqual(['{"a":1}'])
  })

  it.each([
    ['NotAllowedError', MOTIVO_DISCO.SIN_PERMISO],
    ['SecurityError', MOTIVO_DISCO.SIN_PERMISO],
    ['NotFoundError', MOTIVO_DISCO.NO_ENCONTRADO],
    ['NoModificationAllowedError', MOTIVO_DISCO.BLOQUEADO],
    ['InvalidStateError', MOTIVO_DISCO.BLOQUEADO],
    ['QuotaExceededError', MOTIVO_DISCO.ERROR],
  ])('%s ⇒ %s, sin lanzar', async (nombre, motivo) => {
    const asa = asaFalsa()
    asa.fallo = nombre
    const r = await disco.escribir(asa, 'x')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(motivo)
  })

  it('un fallo A MITAD aborta el escritor: el original no se queda con un temporal al lado', async () => {
    const asa = asaFalsa()
    asa.createWritable = async () => ({
      write: async () => {
        throw errorDe('NoModificationAllowedError')
      },
      close: async () => {},
      abort: async () => {
        asa.abortados += 1
      },
    })
    expect((await disco.escribir(asa, 'x')).motivo).toBe(MOTIVO_DISCO.BLOQUEADO)
    expect(asa.abortados).toBe(1)
  })

  it('algo que no es un fichero no lanza', async () => {
    expect((await disco.escribir(null, 'x')).ok).toBe(false)
  })

  it('cada motivo tiene su frase, y todas nombran el fichero', () => {
    for (const m of [MOTIVO_DISCO.SIN_PERMISO, MOTIVO_DISCO.NO_ENCONTRADO, MOTIVO_DISCO.BLOQUEADO, MOTIVO_DISCO.ERROR]) {
      expect(mensajeDisco(m, 'p.json')).toContain('«p.json»')
    }
  })
})

describe('storage/fichero-disco · permiso y lectura', () => {
  const disco = crearFicheroDisco({ ventana: {} })

  it('`permiso` pregunta sin pedir; `pedirPermiso` pide; los dos en readwrite', async () => {
    const asa = asaFalsa()
    asa.queryPermission = vi.fn(async () => 'prompt')
    asa.requestPermission = vi.fn(async () => 'granted')
    expect(await disco.permiso(asa)).toBe('prompt')
    expect(await disco.pedirPermiso(asa)).toBe('granted')
    expect(asa.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    expect(asa.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('si pedir el permiso lanza, es `denied`', async () => {
    const asa = asaFalsa()
    asa.requestPermission = async () => {
      throw errorDe('SecurityError')
    }
    expect(await disco.pedirPermiso(asa)).toBe('denied')
  })

  it('leer devuelve el fichero, o el motivo si ya no está', async () => {
    const asa = asaFalsa()
    await disco.escribir(asa, 'contenido')
    const r = await disco.leer(asa)
    expect(r.ok).toBe(true)
    expect(await r.fichero.text()).toBe('contenido')
    asa.fallo = 'NotFoundError'
    expect(await disco.leer(asa)).toMatchObject({ ok: false, motivo: MOTIVO_DISCO.NO_ENCONTRADO })
  })
})

describe('storage/fichero-disco · recordar el último fichero', () => {
  it('recuerda UN registro, con la clave fija, y lo devuelve', async () => {
    const bd = baseFalsa()
    const disco = crearFicheroDisco({ ventana: {}, bd, ahora: () => 1234 })
    const asa = asaFalsa('encargo.json')
    expect(await disco.recordar(asa)).toEqual({ ok: true, motivo: null })
    expect([...bd.datos.keys()]).toEqual([`${ALMACENES.VINCULOS}/${CLAVE_VINCULO}`])
    expect(await disco.ultimo()).toEqual({ recordado: true, asa, nombre: 'encargo.json' })

    // Un segundo fichero PISA al primero: no es un historial.
    await disco.recordar(asaFalsa('otro.json'))
    expect(bd.datos.size).toBe(1)
    expect((await disco.ultimo()).nombre).toBe('otro.json')
  })

  it('olvidar lo borra, y olvidar lo que no estaba no es un fallo', async () => {
    const bd = baseFalsa()
    const disco = crearFicheroDisco({ ventana: {}, bd })
    await disco.recordar(asaFalsa())
    expect(await disco.olvidar()).toEqual({ ok: true })
    expect((await disco.ultimo()).recordado).toBe(false)
    expect(await disco.olvidar()).toEqual({ ok: true })
  })

  it('un registro sin forma de fichero no se ofrece', async () => {
    const bd = baseFalsa()
    await bd.put(ALMACENES.VINCULOS, { id: CLAVE_VINCULO, asa: { name: 'roto' } })
    expect((await crearFicheroDisco({ ventana: {}, bd }).ultimo()).recordado).toBe(false)
  })

  it('sin base: se escribe igual, pero no se recuerda (y se dice por el motivo)', async () => {
    const disco = crearFicheroDisco({ ventana: {}, bd: null })
    expect(await disco.recordar(asaFalsa())).toEqual({ ok: false, motivo: MOTIVO_DISCO.SIN_BD })
    expect((await disco.ultimo()).recordado).toBe(false)
  })

  it('acepta la base como `ResultadoApertura` de `abrirBd`', async () => {
    const bd = baseFalsa()
    const disco = crearFicheroDisco({ ventana: {}, bd: Promise.resolve({ disponible: true, bd }) })
    await disco.recordar(asaFalsa('a.json'))
    expect((await disco.ultimo()).nombre).toBe('a.json')
  })

  it('si recordar falla lo AVISA (lo pidió el usuario) y no lanza', async () => {
    const bd = baseFalsa()
    bd.put = async () => {
      throw errorDe('QuotaExceededError')
    }
    const alAvisar = vi.fn()
    const disco = crearFicheroDisco({ ventana: {}, bd, alAvisar })
    expect((await disco.recordar(asaFalsa('a.json'))).ok).toBe(false)
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toMatch(/«a\.json»/)
  })
})
