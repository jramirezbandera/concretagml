// test/app/cableado-informe-edificio.test.js — F14 · fase 4b.
//
// Lo que se prueba es lo que el guion de humo no puede ver desde fuera:
//
//   1. **El criterio de aceptación 4**: el nombre legal del documento cambia
//      según haya habido contraste o no, y el ACUSE lo dice — para saber cuál de
//      los dos bajó sin abrir el PDF.
//   2. **El plano DEGRADA y no cancela**, incluido el caso medido de F09 en el
//      que `toDataURL` devuelve `null` **sin lanzar**.
//   3. **La firma que falta se ANUNCIA.** Es el límite conocido de esta fase —no
//      hay diálogo en esta rama—, y bajar un documento sin firmar sin avisar
//      sería justo el error silencioso que la regla de oro 1 prohíbe.
//   4. Que el contraste se lee TARDE (una función), no al cablear.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SIN_EDIFICIO,
  SIN_FIRMA_RECORDADA,
  YA_COMPONIENDO,
  cablearInformeEdificio,
} from '../../app/cableado-informe-edificio.js'
import { REGISTRO, contrastarEdificio } from '../../diagnostico/edificio.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { envolventeDe } from '../../edificio/envolvente.js'
import {
  NOMBRE_INFORME_EDIFICIO,
  NOMBRE_INFORME_EDIFICIO_CONTRASTE,
} from '../../report/pdf-edificio.js'
import { crearEstadoVista } from '../../viewer/_comun.js'

// ⚠️ `join(import.meta.dirname, …)` y NO `new URL(…, import.meta.url)`: bajo el
// proyecto `dom` esa segunda forma resolvió contra una base equivocada
// (`E:\test\fixtures\…` en vez de `E:\PROGRAMACION\GML\test\fixtures\…`) y las
// once pruebas que leen fixture salieron rojas por el camino. Es la misma forma
// que ya usan los demás `.dom.test.js` de esta carpeta.
const RAIZ = join(import.meta.dirname, '..', '..')
const fixture = (nombre) => readFileSync(join(RAIZ, 'test', 'fixtures', 'gml', nombre), 'utf8')

/** El edificio real de la parcela de referencia: 13 partes, envolvente de dos. */
const edificioReal = () =>
  entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml')).edificio

/** Un contraste de verdad, calculado con el motor. */
const contrasteReal = (edificio) =>
  contrastarEdificio({
    envolvente: envolventeDe(edificio.partes).recintos,
    huellaOficial: envolventeDe(edificio.construccionOficial).recintos,
    registro: REGISTRO.CONSULTADO,
  })

/** Un cajón de mentira: solo se usan `alPreparar` y `estadoInforme`. */
function cajonDoble() {
  const oyentes = new Set()
  return {
    dicho: [],
    estadoInforme(t) {
      this.dicho.push(t)
    },
    alPreparar(fn) {
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },
    pulsar() {
      for (const fn of oyentes) fn()
    },
    ultimo() {
      return this.dicho.at(-1)
    },
  }
}

const panelDoble = () => ({
  avisos: [],
  avisar(m, o) {
    this.avisos.push({ m, o })
  },
})

describe('F14 · cablearInformeEdificio', () => {
  let cajon
  let panel
  let estadoEdificio
  let bajado

  beforeEach(() => {
    cajon = cajonDoble()
    panel = panelDoble()
    estadoEdificio = crearEstadoVista(null)
    bajado = []
  })

  const cablear = (extra = {}) =>
    cablearInformeEdificio({
      cajon,
      estadoEdificio,
      panel,
      contraste: () => null,
      srs: 'EPSG:25830',
      // Un reloj FIJO, y un `Date` y no un timestamp: `componerIdDocumento` LANZA
      // con un número, y esta prueba lo destapó a la primera corrida. Un test que
      // lee el reloj del sistema, además, no es reproducible.
      ahora: () => new Date('2026-08-07T10:00:00Z'),
      // Sin red. El plano se prueba aparte, y aquí solo estorbaría.
      plano: async () => null,
      descargar: (bytes, opciones) => {
        bajado.push({ bytes, ...opciones })
        return { descargado: true, mensaje: 'ok' }
      },
      ...extra,
    })

  it('sin construcción no compone nada, y lo dice', async () => {
    const c = cablear()
    expect(await c.componer()).toBeNull()
    expect(cajon.ultimo()).toBe(SIN_EDIFICIO)
    expect(bajado).toHaveLength(0)
  })

  it('⭐ CRITERIO 4 · sin contraste, el documento se llama «Informe de construcción»', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear()
    const entrega = await c.componer()
    expect(entrega.descargado).toBe(true)
    // El acuse lleva el nombre legal para poder saber cuál bajó sin abrir el PDF.
    expect(cajon.ultimo()).toContain(NOMBRE_INFORME_EDIFICIO)
    expect(cajon.ultimo()).not.toContain(NOMBRE_INFORME_EDIFICIO_CONTRASTE)
    expect(bajado).toHaveLength(1)
    expect(bajado[0].nombreFichero).toMatch(/\.pdf$/)
  })

  it('⭐ CRITERIO 4 · con contraste, se llama «Informe de contraste con la construcción catastral»', async () => {
    const edificio = edificioReal()
    estadoEdificio.set(edificio)
    const c = cablear({ contraste: () => contrasteReal(edificio) })
    await c.componer()
    expect(cajon.ultimo()).toContain(NOMBRE_INFORME_EDIFICIO_CONTRASTE)
  })

  it('⛔ el contraste se lee TARDE: una función, no un valor congelado', async () => {
    const edificio = edificioReal()
    estadoEdificio.set(edificio)
    let hay = null
    const c = cablear({ contraste: () => hay })
    // Al cablear no había contraste; al componer, sí. Un valor capturado en el
    // montaje habría sido `null` para siempre y el informe saldría declarativo aun
    // habiéndose contrastado.
    hay = contrasteReal(edificio)
    await c.componer()
    expect(cajon.ultimo()).toContain(NOMBRE_INFORME_EDIFICIO_CONTRASTE)
  })

  it('un `contraste` que no sea función es contrato roto del programador', () => {
    expect(() =>
      cablearInformeEdificio({
        cajon,
        estadoEdificio,
        panel,
        contraste: null,
        srs: 'EPSG:25830',
      }),
    ).toThrow(TypeError)
  })

  it('⭐ la firma que FALTA se anuncia por los dos canales', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear()
    await c.componer()
    // Sin `pieFirma` el informe sale con los cuatro campos en «No consta», que
    // `report/pdf-edificio.js` documenta como correcto. Lo que no puede pasar es
    // que baje sin avisar.
    expect(cajon.ultimo()).toContain(SIN_FIRMA_RECORDADA)
    expect(panel.avisos.some((a) => a.m === SIN_FIRMA_RECORDADA)).toBe(true)
    // Y el aviso dice CÓMO conseguirla, no solo que falta.
    expect(SIN_FIRMA_RECORDADA).toContain('Recordar mis datos')
  })

  it('con firma recordada no se avisa de nada', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear({
      pieFirma: {
        recuperar: async () => ({
          firma: { nombre: 'J. R.', numeroColegiado: '1234', colegio: 'COA', contacto: 'x@y.z' },
          recordado: true,
        }),
      },
    })
    await c.componer()
    expect(cajon.ultimo()).not.toContain(SIN_FIRMA_RECORDADA)
    expect(panel.avisos.some((a) => a.m === SIN_FIRMA_RECORDADA)).toBe(false)
  })

  it('un almacén que revienta no tumba el informe: sale sin firma y lo dice', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear({
      pieFirma: {
        recuperar: async () => {
          throw new Error('IndexedDB cerrada')
        },
      },
    })
    const entrega = await c.componer()
    expect(entrega.descargado).toBe(true)
    expect(cajon.ultimo()).toContain(SIN_FIRMA_RECORDADA)
  })

  it('⛔ el plano DEGRADA y no cancela: `null` SIN excepción (el caso de jsdom)', async () => {
    estadoEdificio.set(edificioReal())
    // En jsdom `toDataURL()` devuelve `null` **sin lanzar** (medido en F09), así
    // que quien decide si hay plano es el VALOR y no la ausencia de `throw`.
    const c = cablear({ plano: async () => null })
    const entrega = await c.componer()
    expect(entrega.descargado).toBe(true)
    expect(cajon.ultimo()).toContain('SIN plano')
  })

  it('y también cuando el plano LANZA', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear({
      plano: async () => {
        throw new Error('el WMS no contesta')
      },
    })
    const entrega = await c.componer()
    expect(entrega.descargado).toBe(true)
    expect(panel.avisos.some((a) => a.m.includes('plano de situación'))).toBe(true)
  })

  it('una entrega que no baja NO se anuncia como descargada', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear({
      descargar: () => ({ descargado: false, mensaje: 'el navegador ha bloqueado la descarga' }),
    })
    const entrega = await c.componer()
    expect(entrega.descargado).toBe(false)
    expect(cajon.ultimo()).toBe('el navegador ha bloqueado la descarga')
    // Y sobre todo: NO se dice «Descargado …».
    expect(cajon.dicho.some((t) => t.startsWith('Descargado'))).toBe(false)
  })

  it('pulsar el botón compone: el canal está enchufado, y `destruir` lo desenchufa', async () => {
    estadoEdificio.set(edificioReal())
    const c = cablear()
    cajon.pulsar()
    // El oyente es síncrono pero `componer` es asíncrono: se espera a que la cola
    // de microtareas se vacíe, que es lo que hace el navegador de verdad.
    await vi.waitFor(() => expect(bajado).toHaveLength(1))

    c.destruir()
    c.destruir()
    cajon.pulsar()
    await new Promise((r) => setTimeout(r, 0))
    expect(bajado).toHaveLength(1)
  })

  it('dos pulsaciones a la vez no componen dos documentos', async () => {
    estadoEdificio.set(edificioReal())
    // El resolver se captura ANTES de cablear: montarlo dentro del ejecutor de la
    // promesa y usarlo abajo dependía de que el plano ya hubiera empezado, y la
    // primera corrida falló con «soltar is not a function» por eso mismo.
    let soltar = () => {}
    const enVuelo = new Promise((r) => {
      soltar = () => r(null)
    })
    const c = cablear({ plano: () => enVuelo })
    const primera = c.componer()
    const segunda = await c.componer()
    expect(segunda).toBeNull()
    expect(cajon.dicho).toContain(YA_COMPONIENDO)
    soltar()
    await primera
    expect(bajado).toHaveLength(1)
  })

  it('⛔ EL ENCUADRE recibe las PIEZAS, no la lista aplanada', async () => {
    // La corrida que destapó el defecto: `encuadrar` impone el invariante
    // EXTERIOR/HUECO, así que una envolvente de DOS cuerpos aplanada le llega con
    // `recintos[1].tipo === 'EXTERIOR'` y LANZA. Y el fallo era mudo por la vía
    // peor: el `catch` del plano lo degradaba, así que **todo edificio de más de un
    // cuerpo habría salido siempre sin plano** y el informe lo declararía como si
    // fuera cosa de la red.
    //
    // Se mide sobre el edificio REAL, que da 2 piezas, y con un doble del plano que
    // apunta lo que recibe: si alguien vuelve a aplanar, esto sale rojo.
    const edificio = edificioReal()
    estadoEdificio.set(edificio)
    expect(envolventeDe(edificio.partes).recintos).toHaveLength(2)

    const visto = []
    const c = cablear({
      plano: async (entrada) => {
        visto.push(entrada)
        return { pagina: 'de mentira' }
      },
    })
    await c.componer()

    // El plano se compuso: no hubo excepción por el camino.
    expect(visto).toHaveLength(1)
    expect(cajon.ultimo()).not.toContain('SIN plano')
    // Y le llegan los DOS anillos, aplanados, que es como `componerPlano` los
    // quiere (dibuja con `fill('evenodd')`).
    expect(visto[0].recintos).toHaveLength(2)
    expect(visto[0].recintos.every((r) => r.tipo === 'EXTERIOR')).toBe(true)
  })
})
