// test/viewer/comun.dom.test.js — F03 · Tarea 1.2 (contratos compartidos del visor)
// + smoke del tooling de la Tarea 1.1 (Leaflet importa bajo jsdom).
//
// Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí.
import { describe, it, expect, vi } from 'vitest'
import {
  vertUTMaLatLng,
  recintoALatLng,
  latLngAUTM,
  crearEstadoVista,
  NIVEL,
  PANES,
  PANE,
  COLOR_USUARIO,
  avisoPorDefecto,
  resolverAvisar,
} from '../../viewer/_comun.js'
import { NIVEL as NIVEL_VALIDACION } from '../../validation/_comun.js'

describe('viewer/_comun · frontera de vista (proyección UTM ↔ lat/lon)', () => {
  // Coordenadas plausibles por huso (Península + Baleares). El round-trip es
  // matemático: forward(inverse(x,y,z),z) recupera (x,y) a nivel sub-mm.
  const casos = [
    { zona: 29, xy: [550000, 4750000] }, // Galicia/oeste
    { zona: 30, xy: [439250.35, 4479664.55] }, // parcela real (fixture F00)
    { zona: 31, xy: [450000, 4600000] }, // este/Baleares
  ]

  it.each(casos)('ida y vuelta ≈ identidad (huso $zona)', ({ zona, xy }) => {
    const latlng = vertUTMaLatLng(xy, zona)
    expect(latlng).toHaveLength(2)
    const [x, y] = latLngAUTM({ lat: latlng[0], lng: latlng[1] }, zona)
    expect(x).toBeCloseTo(xy[0], 3) // < 1 mm
    expect(y).toBeCloseTo(xy[1], 3)
  })

  it('acepta latlng como array [lat,lng] o como {lat,lng}', () => {
    const xy = [439250.35, 4479664.55]
    const [lat, lng] = vertUTMaLatLng(xy, 30)
    const comoArray = latLngAUTM([lat, lng], 30)
    const comoObjeto = latLngAUTM({ lat, lng }, 30)
    expect(comoArray[0]).toBeCloseTo(comoObjeto[0], 6)
    expect(comoArray[1]).toBeCloseTo(comoObjeto[1], 6)
  })

  it('recintoALatLng proyecta el anillo entero conservando el nº de vértices', () => {
    const recinto = { vertices: [[439250, 4479660], [439260, 4479660], [439260, 4479670]] }
    const anillo = recintoALatLng(recinto, 30)
    expect(anillo).toHaveLength(3)
    anillo.forEach((p) => expect(p).toHaveLength(2))
  })

  it('lanza (no corrige callado) ante entrada rota del programador', () => {
    expect(() => vertUTMaLatLng(null, 30)).toThrow(TypeError)
    expect(() => recintoALatLng({}, 30)).toThrow(TypeError)
    expect(() => latLngAUTM('nope', 30)).toThrow(TypeError)
  })
})

describe('viewer/_comun · constantes de dominio', () => {
  it('PANES tiene zIndex creciente oficial < editada < acotaciones < diagnostico < vertices', () => {
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(z[PANE.PARCELA_OFICIAL]).toBeLessThan(z[PANE.PARCELA_EDITADA])
    // Las acotaciones (F06, T3.2) van SOBRE la geometría editada —un rótulo
    // debajo del relleno no se lee— y BAJO los vértices —el vértice es lo que se
    // agarra, y una etiqueta encima invitaría a apuntar al sitio equivocado—.
    expect(z[PANE.PARCELA_EDITADA]).toBeLessThan(z[PANE.ACOTACIONES])
    // El diagnóstico (F07, T1.3) va SOBRE las acotaciones —también es una
    // anotación que EXPLICA la geometría, no la geometría en sí— y sigue BAJO
    // los vértices por el mismo motivo que las acotaciones: F06 sigue activo
    // con el diagnóstico abierto (diagnosticar → corregir el lindero → volver a
    // diagnosticar) y el vértice tiene que seguir siendo lo que se agarra.
    expect(z[PANE.ACOTACIONES]).toBeLessThan(z[PANE.DIAGNOSTICO])
    expect(z[PANE.DIAGNOSTICO]).toBeLessThan(z[PANE.VERTICES])
    // Entre overlayPane (400) y markerPane (600) de Leaflet.
    for (const p of PANES) {
      expect(p.zIndex).toBeGreaterThan(400)
      expect(p.zIndex).toBeLessThan(600)
    }
    // El orden del array ES el zIndex creciente: `viewer/mapa.js` lo itera tal
    // cual, así que una entrada nueva mal colocada rompería el apilado. Se exige
    // ESTRICTAMENTE creciente (no solo no-decreciente): dos panes con el mismo
    // zIndex dejarían el apilado entre ellos a merced del orden de inserción en
    // el DOM, no de una decisión explícita.
    const zIndices = PANES.map((p) => p.zIndex)
    const estrictamenteCreciente = zIndices.every(
      (v, i) => i === 0 || v > zIndices[i - 1],
    )
    expect(estrictamenteCreciente).toBe(true)
  })

  it('PANE.DIAGNOSTICO existe y su zIndex (428) cae entre acotaciones (425) y vertices (430)', () => {
    // F07, T1.3: el pane nuevo del diagnóstico de encaje. 428 y no, por ejemplo,
    // 426 o 429: cualquier valor estrictamente entre 425 y 430 cumple el
    // contrato de apilado; lo que este test fija es el HUECO, no el dígito
    // exacto — pero comprueba también la cifra real para que un cambio
    // accidental (p. ej. escribir 425 dos veces) no pase desapercibido.
    expect(PANE.DIAGNOSTICO).toBe('diagnostico')
    const entrada = PANES.find((p) => p.nombre === PANE.DIAGNOSTICO)
    expect(entrada).toBeDefined()
    expect(entrada.zIndex).toBe(428)
    expect(entrada.zIndex).toBeGreaterThan(425)
    expect(entrada.zIndex).toBeLessThan(430)
  })

  it('PANE.PARTES existe y su zIndex (422) cae entre la parcela editada (420) y los vértices (430)', () => {
    // F11, T1.5: el pane nuevo de las HUELLAS de las partes de construcción, que
    // pinta `viewer/partes.js`. Lo que este test fija es EL HUECO —el rango en el
    // que el apilado es correcto— y de paso la cifra real, para que un cambio
    // accidental no pase desapercibido.
    expect(PANE.PARTES).toBe('partes')
    const entrada = PANES.find((p) => p.nombre === PANE.PARTES)
    expect(entrada).toBeDefined()
    expect(entrada.zIndex).toBe(422)

    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    // Por ENCIMA de la parcela editada: en la rama EDIFICIO el asunto es el
    // edificio y la parcela es CONTEXTO. Y la huella se RELLENA, así que por
    // debajo de 420 el relleno amarillo de la parcela la taparía entera.
    expect(entrada.zIndex).toBeGreaterThan(z[PANE.PARCELA_EDITADA])
    // Por DEBAJO de los vértices, que es lo que se agarra (y lo que F12 agarrará
    // sobre la propia parte).
    expect(entrada.zIndex).toBeLessThan(z[PANE.VERTICES])
    // Y por debajo de las dos capas de ANOTACIÓN: una cota o la sombra del
    // diagnóstico bajo el relleno del polígono que explican no se leerían.
    expect(entrada.zIndex).toBeLessThan(z[PANE.ACOTACIONES])
    expect(entrada.zIndex).toBeLessThan(z[PANE.DIAGNOSTICO])
  })

  it('la geometría del usuario es amarillo #FFD600 (revisión visual de la Fase 5)', () => {
    // Guardián de identidad a propósito: este color NO es una preferencia
    // suelta, es una decisión con tres restricciones detrás (no colisionar con
    // el rojo catastral, el azul de la hidrografía ni el verde de la
    // vegetación). Si alguien lo cambia, que sea leyendo el porqué en
    // `viewer/_comun.js#COLOR_USUARIO` y actualizando también el spec.
    expect(COLOR_USUARIO).toBe('#FFD600')
  })

  it('NO se usa sobre fondo blanco: la tabla tiene su propio ámbar legible', () => {
    // El amarillo del mapa da ~1,4:1 sobre blanco (ilegible). El nº de vértice
    // de la tabla usa `--gml-color-usuario-sobre-claro` en `estilos/app.css`, y
    // esta prueba existe para que el día que alguien "unifique" ambos valores se
    // encuentre con el motivo escrito en vez de con una columna ilegible.
    const canal = (hex, i) => {
      const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminancia = (hex) =>
      0.2126 * canal(hex, 0) + 0.7152 * canal(hex, 1) + 0.0722 * canal(hex, 2)
    const contrasteSobreBlanco = 1.05 / (luminancia(COLOR_USUARIO) + 0.05)
    expect(contrasteSobreBlanco).toBeLessThan(3)
  })

  it('NIVEL es EL MISMO objeto que el de validation/_comun.js (re-exportado, no copiado)', () => {
    // Hallazgo 2.4 de la auditoría de coherencia: F02 declaraba NIVEL "para que
    // la UI (F03) lo consuma" y el visor no lo consumía (seis literales sueltos
    // repartidos por services/ign.js, wms-catastro.js y sincronizacion.js). Aquí
    // se comprueba la vía elegida: RE-EXPORTACIÓN directa, no una copia
    // congelada — identidad (`toBe`), que es más fuerte que igualdad profunda:
    // no hay dos objetos que puedan divergir.
    expect(NIVEL).toBe(NIVEL_VALIDACION)
    expect(NIVEL).toEqual({ ERROR: 'ERROR', AVISO: 'AVISO' })
    expect(Object.isFrozen(NIVEL)).toBe(true)
  })
})

describe('viewer/_comun · crearEstadoVista (store, sin feedback loop)', () => {
  it('get devuelve el estado inicial y set lo reemplaza', () => {
    const estado = crearEstadoVista({ idLocal: 'A' })
    expect(estado.get()).toEqual({ idLocal: 'A' })
    estado.set({ idLocal: 'B' })
    expect(estado.get()).toEqual({ idLocal: 'B' })
  })

  it('notifica a los suscriptores UNA vez por set, con el nuevo estado', () => {
    const estado = crearEstadoVista(null)
    const spy = vi.fn()
    estado.subscribe(spy)
    estado.set({ v: 1 })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ v: 1 })
    estado.set({ v: 2 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sin bucle: un suscriptor que hace set NO dispara cascada infinita', () => {
    const estado = crearEstadoVista(null)
    let entradas = 0
    // Suscriptor "malo" que reacciona escribiendo (simula tabla↔mapa).
    estado.subscribe((s) => {
      entradas++
      if (s && s.n < 3) estado.set({ n: s.n + 1 }) // reentrada
    })
    expect(() => estado.set({ n: 0 })).not.toThrow() // no desborda la pila
    // El estado sí avanza a la última reentrada, pero la notificación no cascadea.
    expect(estado.get()).toEqual({ n: 1 })
    expect(entradas).toBe(1)
  })

  it('unsubscribe deja de notificar', () => {
    const estado = crearEstadoVista(null)
    const spy = vi.fn()
    const baja = estado.subscribe(spy)
    estado.set({ v: 1 })
    baja()
    estado.set({ v: 2 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('subscribe exige una función', () => {
    const estado = crearEstadoVista(null)
    expect(() => estado.subscribe(42)).toThrow(TypeError)
  })

  // ── F11: DOS instancias vivas a la vez (parcela y edificio) ────────────────
  // El plan de F11 da por hecho que `crearEstadoVista` sirve como SEGUNDO store
  // «sin tocarlo», porque es un closure. Eso es cierto, pero hasta ahora era una
  // suposición leída del código y no un hecho atestado: nunca hubo dos stores
  // vivos en la misma página. Estas tres pruebas lo convierten en contrato, y son
  // la red de la decisión 2 de la fase entera (los ONCE suscriptores de la rama
  // parcela no se tocan ni una línea). Si alguien "optimizara" esto a un módulo
  // con estado a nivel de fichero, salen en rojo aquí y no en producción.

  it('dos stores NO comparten estado: escribir en uno deja el otro intacto', () => {
    const parcela = crearEstadoVista({ idLocal: 'parcela-1' })
    const edificio = crearEstadoVista(null)

    expect(edificio.get()).toBeNull()
    edificio.set({ refcat: 'EDIF-1' })

    expect(edificio.get()).toEqual({ refcat: 'EDIF-1' })
    expect(parcela.get()).toEqual({ idLocal: 'parcela-1' })

    parcela.set({ idLocal: 'parcela-2' })
    expect(edificio.get()).toEqual({ refcat: 'EDIF-1' })
  })

  it('dos stores NO comparten suscriptores: cada set notifica solo a los suyos', () => {
    const parcela = crearEstadoVista(null)
    const edificio = crearEstadoVista(null)
    const espiaParcela = vi.fn()
    const espiaEdificio = vi.fn()
    parcela.subscribe(espiaParcela)
    edificio.subscribe(espiaEdificio)

    edificio.set({ refcat: 'EDIF-1' })
    expect(espiaEdificio).toHaveBeenCalledTimes(1)
    expect(espiaEdificio).toHaveBeenCalledWith({ refcat: 'EDIF-1' })
    expect(espiaParcela).not.toHaveBeenCalled()

    parcela.set({ idLocal: 'P' })
    expect(espiaParcela).toHaveBeenCalledTimes(1)
    expect(espiaParcela).toHaveBeenCalledWith({ idLocal: 'P' })
    expect(espiaEdificio).toHaveBeenCalledTimes(1)

    // Y darse de baja en uno no da de baja en el otro.
    const baja = edificio.subscribe(() => {})
    baja()
    edificio.set({ refcat: 'EDIF-2' })
    expect(espiaEdificio).toHaveBeenCalledTimes(2)
  })

  it('la guarda anti-reentrada es POR INSTANCIA: un set cruzado sí notifica', () => {
    // El caso real de F11: un suscriptor de la rama edificio que, al recibir un
    // documento nuevo, escribe en el store de PARCELA (p. ej. para dejarla como
    // contexto). Si la bandera `notificando` fuera compartida —un módulo con
    // estado de fichero, o un singleton— ese segundo `set` se tragaría su
    // notificación EN SILENCIO y la parcela dejaría de repintarse sin que nada
    // avisara. Es exactamente el fallo que la regla de oro 1 prohíbe.
    const parcela = crearEstadoVista(null)
    const edificio = crearEstadoVista(null)
    const espiaParcela = vi.fn()
    parcela.subscribe(espiaParcela)
    edificio.subscribe(() => parcela.set({ idLocal: 'contexto' }))

    edificio.set({ refcat: 'EDIF-1' })

    expect(espiaParcela).toHaveBeenCalledTimes(1)
    expect(espiaParcela).toHaveBeenCalledWith({ idLocal: 'contexto' })
    expect(parcela.get()).toEqual({ idLocal: 'contexto' })
  })
})

describe('viewer/_comun · canal de aviso (avisoPorDefecto / resolverAvisar)', () => {
  it('avisoPorDefecto escribe el mensaje del usuario en console.warn, sin tragárselo', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      avisoPorDefecto('No se ha podido cargar la tesela del IGN.')
      expect(spy).toHaveBeenCalledTimes(1)
      const [primerArg] = spy.mock.calls[0]
      expect(primerArg).toContain('No se ha podido cargar la tesela del IGN.')
    } finally {
      spy.mockRestore()
    }
  })

  it('avisoPorDefecto no lanza con detalle ausente, null o con causa Error', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => avisoPorDefecto('mensaje sin detalle')).not.toThrow()
      expect(() => avisoPorDefecto('mensaje con detalle null', null)).not.toThrow()
      expect(() =>
        avisoPorDefecto('mensaje con causa', { causa: new Error('fallo de red') }),
      ).not.toThrow()
      expect(spy).toHaveBeenCalledTimes(3)
    } finally {
      spy.mockRestore()
    }
  })

  it('resolverAvisar devuelve exactamente la función recibida', () => {
    const fn = () => {}
    expect(resolverAvisar(fn)).toBe(fn)
  })

  it('resolverAvisar(null) y resolverAvisar(undefined) devuelven avisoPorDefecto', () => {
    expect(resolverAvisar(null)).toBe(avisoPorDefecto)
    expect(resolverAvisar(undefined)).toBe(avisoPorDefecto)
  })

  it('resolverAvisar lanza TypeError si le pasan basura donde iba una función', () => {
    expect(() => resolverAvisar('texto')).toThrow(TypeError)
    expect(() => resolverAvisar(42)).toThrow(TypeError)
    expect(() => resolverAvisar({})).toThrow(TypeError)
  })

  it("el nivel por defecto es 'AVISO' y se puede forzar 'ERROR'", () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      avisoPorDefecto('sin nivel explícito')
      avisoPorDefecto('nivel forzado a ERROR', { nivel: 'ERROR' })
      expect(spy.mock.calls[0][0]).toContain('AVISO')
      expect(spy.mock.calls[1][0]).toContain('ERROR')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('tooling F03 (Tarea 1.1): Leaflet importa bajo jsdom', () => {
  it('import leaflet resuelve y expone version (window existe en jsdom)', async () => {
    const mod = await import('leaflet')
    const L = mod.default || mod
    expect(typeof L.version).toBe('string')
    expect(typeof L.map).toBe('function')
  })
})
