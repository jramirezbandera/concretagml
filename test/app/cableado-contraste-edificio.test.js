// test/app/cableado-contraste-edificio.test.js — F14 · fase 4b.
//
// Dos mitades, y la primera es la que más importa:
//
//   1. **`huellaOficialDe`**, que es la juntura entre `gml/parse-bu.js` y
//      `diagnostico/edificio.js`. Las junturas son donde se pierden los huecos, y
//      aquí hay un caso —varios contornos CON huecos— en el que la respuesta
//      correcta es negarse. Que se niegue **en vez de repartirlos a ojo** es lo
//      que estas pruebas defienden.
//   2. El cableado, con dobles. Lo que se mide es lo que no se ve: que la consulta
//      **no escriba en el modelo**, que un fallo no se convierta en «no consta», y
//      que `[]` y `null` de las vecinas sigan significando cosas distintas.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  CONSULTA_HECHA,
  SIN_BUILDING,
  SIN_CLIENTE,
  SIN_REFCAT,
  YA_ES_OFICIAL,
  cablearContrasteEdificio,
  huecosAmbiguos,
  huellaDelModelo,
  huellaOficialDe,
} from '../../app/cableado-contraste-edificio.js'
import { REGISTRO } from '../../diagnostico/edificio.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import { crearEstadoVista } from '../../viewer/_comun.js'

const fixture = (nombre) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/gml/${nombre}`, import.meta.url)), 'utf8')

/** Un anillo cuadrado de lado `l` con la esquina inferior izquierda en (x, y). */
const anillo = (x, y, l) => [
  [x, y],
  [x + l, y],
  [x + l, y + l],
  [x, y + l],
]

// ── 1 · `huellaOficialDe`: la juntura ────────────────────────────────────────

describe('F14 · huellaOficialDe — de los anillos sueltos del GML a las PIEZAS', () => {
  it('un solo contorno: los huecos son suyos, sin ambigüedad', () => {
    const { piezas, motivo } = huellaOficialDe({
      anillos: [anillo(0, 0, 10)],
      huecos: [anillo(2, 2, 2), anillo(6, 6, 2)],
    })
    expect(motivo).toBeNull()
    expect(piezas).toHaveLength(1)
    // Un EXTERIOR y sus dos HUECOS, en esa pieza y no repartidos.
    expect(piezas[0].map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO', 'HUECO'])
  })

  it('varios contornos y ningún hueco: una pieza por contorno', () => {
    const { piezas, motivo } = huellaOficialDe({
      anillos: [anillo(0, 0, 10), anillo(100, 100, 5)],
      huecos: [],
    })
    expect(motivo).toBeNull()
    expect(piezas).toHaveLength(2)
    expect(piezas.every((p) => p.length === 1 && p[0].tipo === 'EXTERIOR')).toBe(true)
  })

  it('⛔ varios contornos CON huecos: NO se contrasta, y se dice por qué', () => {
    const { piezas, motivo } = huellaOficialDe({
      anillos: [anillo(0, 0, 10), anillo(100, 100, 5)],
      huecos: [anillo(2, 2, 2)],
    })
    // Lo que se defiende es la NEGATIVA. Repartir el hueco a la primera pieza
    // daría una superficie oficial equivocada y en silencio, que es justo lo que
    // `gml/parse-bu.js` declara fuera de alcance.
    expect(piezas).toBeNull()
    expect(motivo).toBe(huecosAmbiguos(2, 1))
    // Y el motivo dice las DOS cifras, no un «no se puede» a secas.
    expect(motivo).toContain('2 contornos')
    expect(motivo).toContain('1 hueco')
  })

  it('sin `Building` —o con anillos degenerados— dice que no hay huella de conjunto', () => {
    expect(huellaOficialDe(null).motivo).toBe(SIN_BUILDING)
    expect(huellaOficialDe({ anillos: [], huecos: [] }).motivo).toBe(SIN_BUILDING)
    // Dos vértices no encierran nada: se descarta el anillo, y si no queda ninguno
    // el resultado es el mismo que no traer ninguno.
    expect(huellaOficialDe({ anillos: [[[0, 0], [1, 1]]], huecos: [] }).motivo).toBe(SIN_BUILDING)
  })

  it('⭐ con el `Building` REAL del Catastro da las DOS piezas medidas', () => {
    const { edificio } = parsearGmlBu(fixture('bu_building_9398516VK3799G.gml'))
    const { piezas, motivo } = huellaOficialDe(edificio)
    expect(motivo).toBeNull()
    // 2 anillos y 0 huecos, que es lo que la fase 0 midió en la parcela de
    // referencia. Si el fixture cambiara, esta prueba lo dice antes que nadie.
    expect(piezas).toHaveLength(2)
  })
})

// ── 2 · `huellaDelModelo`: envolvente contra envolvente ──────────────────────

describe('F14 · huellaDelModelo — la referencia que ya venía en casa', () => {
  it('sin construcción oficial devuelve null', () => {
    expect(huellaDelModelo(null)).toBeNull()
    expect(huellaDelModelo({ construccionOficial: null })).toBeNull()
    expect(huellaDelModelo({ construccionOficial: [] })).toBeNull()
  })

  it('⭐ deriva la ENVOLVENTE de las partes oficiales, no las partes', () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    const piezas = huellaDelModelo(edificio)
    // Las 13 partes oficiales dan DOS piezas, no trece: eso es exactamente lo que
    // distingue derivar la envolvente de cruzar las partes una a una. Si aquí
    // salieran 13, el solape contaría dos veces cada metro compartido entre partes
    // y la cifra se iría hacia arriba sin que nada avisara.
    expect(piezas).toHaveLength(2)
    expect(edificio.construccionOficial).toHaveLength(13)
  })
})

// ── 3 · El cableado ──────────────────────────────────────────────────────────

/** Un cajón de mentira que apunta todo lo que le dicen. */
function cajonDoble() {
  const oyentes = { consultar: new Set(), cerrar: new Set() }
  return {
    pintado: [],
    estados: [],
    abiertoAhora: true,
    consultandoAhora: [],
    pintar(c) {
      this.pintado.push(c)
    },
    abrir() {
      this.abiertoAhora = true
    },
    cerrar() {
      this.abiertoAhora = false
    },
    abierto() {
      return this.abiertoAhora
    },
    estado(t) {
      this.estados.push(t)
    },
    consultando(v) {
      this.consultandoAhora.push(v)
      return v
    },
    alConsultar(fn) {
      oyentes.consultar.add(fn)
      return () => oyentes.consultar.delete(fn)
    },
    alCerrar(fn) {
      oyentes.cerrar.add(fn)
      return () => oyentes.cerrar.delete(fn)
    },
    pulsarConsultar() {
      for (const fn of oyentes.consultar) fn()
    },
    /** Lo último que se pintó. `undefined` si no se ha pintado nada. */
    ultimo() {
      return this.pintado.at(-1)
    },
  }
}

const panelDoble = () => ({ avisos: [], avisar(m, o) { this.avisos.push({ m, o }) } })

describe('F14 · cablearContrasteEdificio', () => {
  let cajon
  let panel
  let estadoEdificio

  beforeEach(() => {
    cajon = cajonDoble()
    panel = panelDoble()
    estadoEdificio = crearEstadoVista(null)
  })

  const cablear = (extra = {}) =>
    cablearContrasteEdificio({
      cajon,
      estadoEdificio,
      panel,
      srs: 'EPSG:25830',
      ...extra,
    })

  it('sin construcción en el store no hay nada que contrastar, y lo dice', () => {
    const c = cablear()
    c.recalcular()
    expect(cajon.ultimo()).toBeNull()
    expect(cajon.estados.at(-1)).toBe('No hay construcción que contrastar.')
    expect(c.ultimoContraste()).toBeNull()
  })

  it('con construcción y sin consulta, el registro es NO_CONSULTADO', () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    // Se le quita la procedencia oficial para que el caso sea el de una medición
    // propia: si se dejara, la referencia saldría del modelo y el registro sería
    // CONSULTADO — que es el otro caso, el de más abajo.
    estadoEdificio.set({ ...edificio, construccionOficial: null })
    const c = cablear()
    c.recalcular()
    expect(c.ultimoContraste().registro.clave).toBe(REGISTRO.NO_CONSULTADO)
    // ⚠️ Y lo que NO puede pasar: que un «no se ha mirado» se lea como «no hay».
    expect(c.ultimoContraste().registro.motivo).toContain('Todavía no se ha consultado')
  })

  it('⭐ con la construcción oficial en el modelo, el contraste sale a CERO', () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set(edificio)
    const c = cablear()
    c.recalcular()
    const contraste = c.ultimoContraste()
    expect(contraste.registro.clave).toBe(REGISTRO.CONSULTADO)
    // La diana de oro de F13, vista desde el otro lado: la envolvente derivada de
    // las 13 partes y la derivada de las MISMAS 13 partes oficiales son la misma
    // superficie. Cero exacto, no «casi cero»: es el mismo cálculo dos veces.
    expect(contraste.huella.diferencia).toBe(0)
    expect(contraste.diferencia.area).toBeLessThan(1e-6)
  })

  it('⛔ la consulta NO reemplaza el modelo (regla de oro 2)', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    const sinOficial = { ...edificio, construccionOficial: null, refcat: '9398516VK3799G' }
    estadoEdificio.set(sinOficial)
    const antes = estadoEdificio.get()

    const { edificio: building } = parsearGmlBu(fixture('bu_building_9398516VK3799G.gml'))
    const cliente = {
      edificioPorRefcat: vi.fn(async () => ({
        ok: true,
        datos: { srs: 'EPSG:25830', edificio: building, sinConstrucciones: false },
      })),
    }
    const c = cablear({ cliente })
    const desenlace = await c.consultar()

    expect(desenlace.clave).toBe(REGISTRO.CONSULTADO)
    // **La comprobación que da nombre a la prueba**: el POJO del store es el MISMO
    // objeto y sigue sin construcción oficial. Escribir ahí el término de
    // comparación confundiría procedencia con referencia, que es lo que la barrera
    // congelada de `model/edificio.js` existe para impedir.
    expect(estadoEdificio.get()).toBe(antes)
    expect(estadoEdificio.get().construccionOficial).toBeNull()
    // Y aun así el contraste tiene con qué comparar.
    expect(c.ultimoContraste().huella.oficial).toBeGreaterThan(0)
    expect(c.huellaOficial()).toHaveLength(2)
    expect(cajon.estados).toContain(CONSULTA_HECHA)
  })

  it('⭐ la PANTALLA HONESTA: se consultó y no consta ninguna', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set({ ...edificio, construccionOficial: null, refcat: '9398516VK3799G' })
    const cliente = {
      edificioPorRefcat: async () => ({
        ok: true,
        datos: { srs: null, edificio: null, sinConstrucciones: true },
      }),
    }
    const c = cablear({ cliente })
    await c.consultar()
    const contraste = c.ultimoContraste()
    expect(contraste.registro.clave).toBe(REGISTRO.SIN_CONSTRUCCIONES)
    // La frase que tranquiliza va DENTRO del motivo, y es la mitad del valor de
    // esta pantalla: quien lee «no consta» en una herramienta de expediente teme
    // haber hecho algo mal.
    expect(contraste.registro.motivo).toContain('plenamente válido')
  })

  it('⛔ un fallo de la consulta NO se convierte en «no consta»', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set({ ...edificio, construccionOficial: null, refcat: '9398516VK3799G' })
    const cliente = { edificioPorRefcat: async () => ({ ok: false, mensaje: 'se cayó la red' }) }
    const c = cablear({ cliente })
    await c.consultar()
    // Son los dos sabores que esta fase existe para separar. `SIN_CONSTRUCCIONES`
    // aquí sería una afirmación sobre el Catastro que nadie ha comprobado.
    expect(c.ultimoContraste().registro.clave).toBe(REGISTRO.NO_SE_HA_PODIDO)
    expect(c.ultimoContraste().registro.motivo).toContain('No se sabe si hay alguna o no')
  })

  it('un SRS distinto no se contrasta, y se dice en vez de dar cifras enormes', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set({ ...edificio, construccionOficial: null, refcat: '9398516VK3799G' })
    const { edificio: building } = parsearGmlBu(fixture('bu_building_9398516VK3799G.gml'))
    const cliente = {
      edificioPorRefcat: async () => ({
        ok: true,
        datos: { srs: 'EPSG:25829', edificio: building, sinConstrucciones: false },
      }),
    }
    const c = cablear({ cliente })
    const { clave, motivo } = await c.consultar()
    expect(clave).toBe(REGISTRO.NO_SE_HA_PODIDO)
    expect(motivo).toContain('EPSG:25829')
    expect(c.huellaOficial()).toBeNull()
  })

  it('sin cliente y sin referencia se dice qué falta, y no se pide nada', async () => {
    const c = cablear()
    estadoEdificio.set({ partes: [], refcat: '9398516VK3799G', construccionOficial: null })
    expect((await c.consultar()).motivo).toBe(SIN_CLIENTE)

    const cliente = { edificioPorRefcat: vi.fn() }
    const d = cablear({ cliente })
    estadoEdificio.set({ partes: [], refcat: null, construccionOficial: null })
    expect((await d.consultar()).motivo).toBe(SIN_REFCAT)
    expect(cliente.edificioPorRefcat).not.toHaveBeenCalled()
  })

  it('si la huella ya vino con el edificio, no se vuelve a pedir', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set(edificio)
    const cliente = { edificioPorRefcat: vi.fn() }
    const c = cablear({ cliente })
    const { motivo } = await c.consultar()
    expect(motivo).toBe(YA_ES_OFICIAL)
    // Una petición para traerse lo que ya está en casa es una petición de más, y
    // la política de uso del Catastro las cuenta (override O8).
    expect(cliente.edificioPorRefcat).not.toHaveBeenCalled()
  })

  it('⛔ `null` y `[]` en las vecinas siguen significando cosas distintas', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set(edificio)

    // Sin cliente de parcelas: no se ha consultado.
    const sinVecinas = cablear()
    await sinVecinas.abrir()
    expect(sinVecinas.ultimoContraste().invasion.consultado).toBe(false)

    // Con cliente que responde y no hay ninguna: se consultó, y no hay.
    const catastro = { colindantes: async () => ({ ok: true, datos: { colindantes: [] } }) }
    const conVecinas = cablear({ catastro })
    await conVecinas.abrir()
    expect(conVecinas.ultimoContraste().invasion.consultado).toBe(true)
    expect(conVecinas.ultimoContraste().invasion.invasiones).toEqual([])
  })

  it('una consulta de vecinas que falla deja `null`, no `[]`', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    estadoEdificio.set(edificio)
    const catastro = { colindantes: async () => ({ ok: false, datos: null }) }
    const c = cablear({ catastro })
    await c.abrir()
    // Si esto saliera `true`, el cajón escribiría «invasión: ninguna» sobre una
    // consulta que no llegó a saberse. Es la afirmación tranquilizadora y falsa.
    expect(c.ultimoContraste().invasion.consultado).toBe(false)
  })

  it('cambiar de edificio olvida la consulta y las vecinas', async () => {
    const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
    const sinOficial = { ...edificio, construccionOficial: null, refcat: '9398516VK3799G' }
    estadoEdificio.set(sinOficial)
    const { edificio: building } = parsearGmlBu(fixture('bu_building_9398516VK3799G.gml'))
    const c = cablear({
      cliente: {
        edificioPorRefcat: async () => ({
          ok: true,
          datos: { srs: 'EPSG:25830', edificio: building, sinConstrucciones: false },
        }),
      },
    })
    await c.consultar()
    expect(c.huellaOficial()).toHaveLength(2)

    // Otro expediente: otra parcela y otra construcción registrada. Conservar la
    // anterior enseñaría la huella oficial de una parcela junto a la envolvente de
    // otra, que es el peor contraste posible.
    estadoEdificio.set({ ...sinOficial, refcat: '0000001VK0000A' })
    expect(c.huellaOficial()).toBeNull()
    expect(c.ultimoContraste().registro.clave).toBe(REGISTRO.NO_CONSULTADO)
  })

  it('`destruir` es idempotente y deja de escuchar al cajón', async () => {
    const cliente = { edificioPorRefcat: vi.fn() }
    const c = cablear({ cliente })
    c.destruir()
    c.destruir()
    cajon.pulsarConsultar()
    await Promise.resolve()
    expect(cliente.edificioPorRefcat).not.toHaveBeenCalled()
  })
})
