/* -------------------------------------------------------------------------- *
 * test/pwa/instalacion.test.js — la oferta de instalar (2026-09-25)            *
 *                                                                              *
 * `pwa/instalacion.js` y `pwa/registro.js` por fuera, en el proyecto `node`:   *
 * un `EventTarget` hace de ventana y un doble hace de `navigator.serviceWorker`. *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, vi } from 'vitest'

import { MOTIVO_INSTALACION, crearInstalacion } from '../../pwa/instalacion.js'
import { MOTIVO_REGISTRO, registrarServiceWorker } from '../../pwa/registro.js'

/** Un `beforeinstallprompt` falso: `prompt()` y la elección del usuario. */
function oferta(outcome = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true })
  e.prompt = vi.fn(async () => {})
  e.userChoice = Promise.resolve({ outcome })
  return e
}

describe('pwa/instalacion · la oferta del navegador', () => {
  it('nace NO disponible: sin oferta no hay botón que enseñar', () => {
    const inst = crearInstalacion({ ventana: new EventTarget() })
    expect(inst.estado()).toEqual({ disponible: false, instalada: false })
  })

  it('recoge `beforeinstallprompt`, le quita la barra propia del navegador y avisa', () => {
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    const oyente = vi.fn()
    inst.alCambiar(oyente)

    const e = oferta()
    ventana.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(inst.estado().disponible).toBe(true)
    expect(oyente).toHaveBeenLastCalledWith({ disponible: true, instalada: false })
  })

  it('instalar: enseña el diálogo UNA vez, y aceptado queda instalada y sin oferta', async () => {
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    const e = oferta('accepted')
    ventana.dispatchEvent(e)

    expect(await inst.instalar()).toEqual({ ok: true, motivo: null })
    expect(e.prompt).toHaveBeenCalledTimes(1)
    expect(inst.estado()).toEqual({ disponible: false, instalada: true })
    // La oferta se gasta: una segunda llamada no vuelve a `prompt()` (lanzaría).
    expect(await inst.instalar()).toEqual({ ok: false, motivo: MOTIVO_INSTALACION.NO_DISPONIBLE })
    expect(e.prompt).toHaveBeenCalledTimes(1)
  })

  it('rechazada: no es un error, y la oferta se gasta igual', async () => {
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    ventana.dispatchEvent(oferta('dismissed'))
    expect(await inst.instalar()).toEqual({ ok: false, motivo: MOTIVO_INSTALACION.RECHAZADA })
    expect(inst.estado()).toEqual({ disponible: false, instalada: false })
  })

  it('el botón se esconde en cuanto se pulsa, antes de que el usuario conteste', async () => {
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    ventana.dispatchEvent(oferta())
    const vistos = []
    inst.alCambiar((e) => vistos.push(e.disponible))
    await inst.instalar()
    expect(vistos[0]).toBe(false)
  })

  it('si `prompt()` lanza, lo dice como ERROR y no revienta', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    const e = oferta()
    e.prompt = vi.fn(async () => {
      throw new Error('NotAllowedError')
    })
    ventana.dispatchEvent(e)
    expect(await inst.instalar()).toEqual({ ok: false, motivo: MOTIVO_INSTALACION.ERROR })
    aviso.mockRestore()
  })

  it('`appinstalled` (instalada desde el menú del navegador) retira la oferta', () => {
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    ventana.dispatchEvent(oferta())
    ventana.dispatchEvent(new Event('appinstalled'))
    expect(inst.estado()).toEqual({ disponible: false, instalada: true })
  })

  it('abierta ya como aplicación (ventana propia): instalada, y una oferta no la ofrece', () => {
    const ventana = new EventTarget()
    ventana.matchMedia = (q) => ({ matches: q === '(display-mode: standalone)' })
    const inst = crearInstalacion({ ventana })
    ventana.dispatchEvent(oferta())
    expect(inst.estado()).toEqual({ disponible: false, instalada: true })
  })

  it('un oyente roto no deja sin enterarse a los demás', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    const bueno = vi.fn()
    inst.alCambiar(() => {
      throw new Error('roto')
    })
    inst.alCambiar(bueno)
    ventana.dispatchEvent(oferta())
    expect(bueno).toHaveBeenCalled()
    error.mockRestore()
  })

  it('destruir suelta los eventos y vacía la oferta', () => {
    const ventana = new EventTarget()
    const inst = crearInstalacion({ ventana })
    inst.destruir()
    ventana.dispatchEvent(oferta())
    expect(inst.estado().disponible).toBe(false)
  })

  it('sin ventana (Node pelado): nunca disponible, y no lanza', async () => {
    const inst = crearInstalacion({ ventana: null })
    expect(inst.estado()).toEqual({ disponible: false, instalada: false })
    expect((await inst.instalar()).ok).toBe(false)
  })

  it('contrato roto ⇒ TypeError', () => {
    expect(() => crearInstalacion({ ventana: 42 })).toThrow(TypeError)
    expect(() => crearInstalacion({ ventana: new EventTarget() }).alCambiar('x')).toThrow(TypeError)
  })
})

describe('pwa/registro · registrar el service worker', () => {
  it('registra con la URL que se le da y devuelve el registro', async () => {
    const registro = { scope: '/concretagml/' }
    const contenedor = { register: vi.fn(async () => registro) }
    const r = await registrarServiceWorker({ url: '/concretagml/sw.js', contenedor })
    expect(contenedor.register).toHaveBeenCalledWith('/concretagml/sw.js')
    expect(r).toEqual({ ok: true, motivo: null, mensaje: null, registro })
  })

  it('sin API (http:// que no es localhost, navegador viejo): dato, no excepción', async () => {
    const r = await registrarServiceWorker({ url: 'sw.js', contenedor: null })
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_REGISTRO.SIN_API)
    expect(r.mensaje).toMatch(/no se puede instalar/)
  })

  it('rechazado (ventana privada, política de empresa): dato, no excepción, y a consola', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const contenedor = {
      register: vi.fn(async () => {
        throw new Error('SecurityError')
      }),
    }
    const r = await registrarServiceWorker({ url: 'sw.js', contenedor })
    expect(r.motivo).toBe(MOTIVO_REGISTRO.RECHAZADO)
    expect(aviso).toHaveBeenCalled()
    aviso.mockRestore()
  })

  it('contrato roto ⇒ TypeError', async () => {
    await expect(registrarServiceWorker({ url: '' })).rejects.toThrow(TypeError)
  })
})
