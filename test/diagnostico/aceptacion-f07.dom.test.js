/* -------------------------------------------------------------------------- *
 * test/diagnostico/aceptacion-f07.dom.test.js — F07 · T6.1 · SUITE DE ACEPTACIÓN *
 *                                                                              *
 * La prueba que decide si F07 está hecha. Los CUATRO criterios de              *
 * `spec/feature-07-diagnostico-parcela.md` § «Criterios de aceptación», uno a   *
 * uno y con su texto LITERAL en el nombre del `describe`:                       *
 *                                                                              *
 *   AC1 · «Todas las métricas se calculan sobre fixtures conocidos con el      *
 *         valor esperado (distancias/áreas con helpers propios,                *
 *         `toBeCloseTo`).»                                                     *
 *   AC2 · «La tabla a tres bandas acepta la superficie registral manual y      *
 *         muestra las diferencias cruzadas.»                                   *
 *   AC3 · «Invasión a colindante se detecta como binaria con área y parcela    *
 *         afectada.»                                                           *
 *   AC4 · «Ninguna salida contiene veredicto, semáforo ni umbral configurable  *
 *         (test de que no existe `config/umbrales.json` y de que el texto es   *
 *         descriptivo).»                                                       *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS CUATRO REGLAS QUE GOBIERNAN ESTE FICHERO                                 *
 * ════════════════════════════════════════════════════════════════════════════ *
 * 1. **SOBRE LA PARCELA REAL Y SUS VECINAS REALES.** Toda la suite trabaja     *
 *    sobre 9398516VK3799G y su vecindad del WFS                                *
 *    (`test/fixtures/catastro/wfs-neighbour-9398516VK3799G.xml`, 5 miembros    *
 *    para 4 colindantes con la propia en 2.ª — override O15). El caso editado  *
 *    es el MEDIDO de `test/diagnostico/parcela.test.js`: el vértice 0 movido   *
 *    0,40 m al Este barre un triángulo de 3,124 m² hacia fuera y produce las   *
 *    ocho métricas de §10.1 a la vez, incluidas TRES invasiones de verdad.     *
 * 2. **ORÁCULOS PROPIOS.** La superficie sale de una shoelace de cuatro        *
 *    líneas trasladada a origen local (regla de oro 5) y el centroide de la    *
 *    fórmula del polígono escrita aquí mismo: preguntarle a `geo/` si está de  *
 *    acuerdo consigo mismo no es un oráculo (misma disciplina que              *
 *    `test/edit/aceptacion-f06.dom.test.js`). Donde el oráculo requeriría una  *
 *    segunda implementación topológica (solape sobre contornos que se cruzan), *
 *    se elige un caso cuyo resultado se conoce por GEOMETRÍA (el contorno      *
 *    editado CONTIENE al oficial ⇒ la intersección ES el oficial) o se fija la *
 *    cifra MEDIDA con fecha.                                                   *
 * 3. **LA MITAD INTEGRADA VA POR LA PANTALLA.** AC2, AC3 y AC4 no se afirman   *
 *    llamando a funciones: se monta la cáscara REAL de `index.html`, el cajón, *
 *    la capa de contraste y el cableado de verdad, se pulsa el CTA y se lee lo *
 *    que el DOM dice. Lo único doblado es el transporte de red (jsdom no debe  *
 *    tocar al Catastro jamás; el doble reproduce el `colindantes()` real:      *
 *    publica antes de devolver y cede el turno antes de publicar).             *
 * 4. **NO SE DUPLICAN LAS UNITARIAS.** Cada `it` cita la frase del criterio a  *
 *    la que está atado. Lo que ya afirma un test de módulo se REMITE:          *
 *      · la composición cifra a cifra y el guardián recursivo sobre el objeto  *
 *        que devuelve `diagnosticar()` → `test/diagnostico/parcela.test.js`    *
 *        (§ «NO juzga»); duplicar un guardián es tener dos que se              *
 *        desincronizan (la lección de `test/services/aceptacion-f05.test.js`); *
 *      · el muestreo de la desviación y sus trampas numéricas →                *
 *        `test/diagnostico/desviacion.test.js`;                                *
 *      · las astillas descartadas y la forma de llamada de Turf →              *
 *        `test/diagnostico/topologia.test.js`;                                 *
 *      · el cajón nodo a nodo → `test/viewer/cajon-diagnostico.dom.test.js`;   *
 *      · el dibujo de la diferencia/invasión/cota/banda →                      *
 *        `test/viewer/contraste.dom.test.js`;                                  *
 *      · el CTA, la petición ÚNICA de vecinas, el O15 por el camino real, el   *
 *        expediente y la cadencia → `test/app/diagnostico.dom.test.js`.        *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * EL GUARDIÁN DEL AC4, EN TRES FRENTES MECÁNICOS                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * El criterio 4 es el que más fácil se finge (SPEC §3.1: un guardián que no    *
 * se ejecuta no protege de nada), así que se comprueba de tres formas y        *
 * ninguna puede saltarse a sí misma en silencio:                               *
 *                                                                              *
 *   1/3 · `config/umbrales.json` NO EXISTE — `existsSync` sobre la ruta real,  *
 *         con anti-vacuidad: la misma resolución SÍ encuentra                  *
 *         `config/operativos.json`. Si alguien crea el fichero, esto cae.      *
 *   2/3 · NINGÚN módulo de `diagnostico/` EXPORTA una clave de veredicto —     *
 *         recorrido sobre los exports REALES de los seis módulos               *
 *         (`import * as`), incluidas las claves de los objetos congelados      *
 *         exportados. El recorrido gemelo sobre el objeto que DEVUELVE         *
 *         `diagnosticar()` vive en `parcela.test.js` y aquí no se duplica.     *
 *   3/3 · EL DOM DEL CAJÓN PINTADO, con el diagnóstico más rico que la app     *
 *         produce (editada + vecinas + registral + margen): ni una palabra de  *
 *         veredicto en el texto, ni una clase CSS de mérito en ningún nodo, y  *
 *         el ámbar (#92400E) SOLO dentro de la sección de invasión — que es la *
 *         única excepción que la spec autoriza (§10.4).                        *
 * -------------------------------------------------------------------------- */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import L from 'leaflet'

import { crearDialogoAvisos } from '../../app/dialogo-avisos.js'
import { SELECTOR_BOTON_DIAGNOSTICAR, cablearDiagnostico } from '../../app/cableado-diagnostico.js'
import * as comun from '../../diagnostico/_comun.js'
import * as bandasModulo from '../../diagnostico/bandas.js'
import * as desviacionModulo from '../../diagnostico/desviacion.js'
import * as margenModulo from '../../diagnostico/margen.js'
import * as parcelaModulo from '../../diagnostico/parcela.js'
import * as topologiaModulo from '../../diagnostico/topologia.js'
import { diagnosticar } from '../../diagnostico/parcela.js'
import { ETIQUETA } from '../../diagnostico/margen.js'
import { metricas } from '../../edit/metricas.js'
import { parsearGml } from '../../gml/parse.js'
import { ORIGEN_PARCELA, crearParcela } from '../../model/parcela.js'
import { PANE, crearEstadoVista } from '../../viewer/_comun.js'
import { SELECTOR as SELECTOR_CAJON, crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La verdad-terreno: la parcela real, su vecindad real y la cáscara real
// ═════════════════════════════════════════════════════════════════════════════

const RAIZ = join(import.meta.dirname, '..', '..')
const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')

/** La cáscara REAL: el marcado es contrato y una copia a mano se quedaría vieja. */
const CUERPO_INDEX = (() => {
  const html = leer('index.html')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'aceptacion-f07: no se ha encontrado el <body> de index.html. La cáscara se ' +
        'lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

/** `GetParcel` de la parcela real (la que la app trae al pulsar «Traer del Catastro»). */
const PARCELA_FIXTURE = parsearGml(
  leer('test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml'),
).parcelas[0]
/** `GetNeighbourParcel`: 5 miembros para 4 colindantes, con la propia en 2.ª (O15). */
const VECINDAD_FIXTURE = parsearGml(
  leer('test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
).parcelas

const REFCAT = PARCELA_FIXTURE.refcat
const AREA_DECLARADA = PARCELA_FIXTURE.areaValue
/** Las vecinas como las entrega el cableado: `{refcat, recintos}`, sin la propia. */
const VECINAS = VECINDAD_FIXTURE.filter((p) => p.refcat !== REFCAT).map((p) => ({
  refcat: p.refcat,
  recintos: p.recintos,
}))

const HUSO = 30

// ── Oráculos propios, que NO comparten código con lo que se prueba ───────────

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])

/**
 * Área firmada por la fórmula del cordón de zapato, TRASLADADA a origen local
 * (regla de oro 5): sobre UTM absolutas (Norte ≈ 4,5·10⁶) la misma suma pierde
 * ~4·10⁻⁵ m² por cancelación en float64. Es el oráculo de aceptación de F04 y
 * F06, reescrito aquí para no compartir ni una línea con `geo/area.js`.
 */
function shoelace(anillo) {
  const [ox, oy] = anillo[0]
  let suma = 0
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i]
    const b = anillo[(i + 1) % anillo.length]
    suma += (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy)
  }
  return suma / 2
}

const areaDe = (anillo) => Math.abs(shoelace(anillo))

/**
 * Centroide del polígono (ponderado por área, no promedio de vértices), también
 * trasladado a origen local y devuelto a UTM. Cuatro líneas de fórmula clásica:
 * el oráculo del «desplazamiento de centroides» de §10.1.
 */
function centroideDe(anillo) {
  const [ox, oy] = anillo[0]
  const A = shoelace(anillo)
  let cx = 0
  let cy = 0
  for (let i = 0; i < anillo.length; i++) {
    const [ax, ay] = [anillo[i][0] - ox, anillo[i][1] - oy]
    const j = (i + 1) % anillo.length
    const [bx, by] = [anillo[j][0] - ox, anillo[j][1] - oy]
    const cruz = ax * by - bx * ay
    cx += (ax + bx) * cruz
    cy += (ay + by) * cruz
  }
  return [cx / (6 * A) + ox, cy / (6 * A) + oy]
}

// ── El caso completo: el vértice 0 movido 0,40 m al ESTE ─────────────────────
//
// Es el caso MEDIDO de `test/diagnostico/parcela.test.js` (2026-07-29): ese
// vértice tiene los dos lados contiguos largos, así que 0,40 m barren un
// triángulo de 3,124 m² hacia FUERA del contorno oficial, y el triángulo cruza
// TRES linderos. Produce todas las métricas a la vez, con invasiones de verdad.

const ANILLO_OFICIAL = PARCELA_FIXTURE.recintos[0].vertices
const ANILLO_EDITADO = ANILLO_OFICIAL.map((v, i) => (i === 0 ? [v[0] + 0.4, v[1]] : v))

const AREA_OFICIAL = areaDe(ANILLO_OFICIAL)
const AREA_EDITADA = areaDe(ANILLO_EDITADO)

/** Las tres invasiones MEDIDAS el 2026-07-29 (mismas cifras que parcela.test.js). */
const INVASIONES_MEDIDAS = [
  { refcat: '9398501VK3799G', area: 0.230839 },
  { refcat: '9398518VK3799G', area: 0.252273 },
  { refcat: '9398515VK3799G', area: 2.641388 },
]

// ── Los formatos de la vista, reconstruidos aquí (es-ES, 2 decimales) ─────────
//
// Para afirmar el TEXTO pintado sin copiarlo de la propia pantalla: el valor
// esperado se construye desde el oráculo con un `Intl.NumberFormat` propio.

const F2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const F0 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const MENOS = '−' // el signo menos tipográfico que usa la vista, no el guion

const m2 = (v) => `${F2.format(v)} m²`
const conSigno = (v, fmt) => (v < 0 ? `${MENOS}${fmt(Math.abs(v))}` : v > 0 ? `+${fmt(v)}` : fmt(v))

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El banco integrado: la cáscara de index.html + cajón + contraste + cableado
// ═════════════════════════════════════════════════════════════════════════════

const pendientes = []

beforeEach(() => {
  document.body.innerHTML = CUERPO_INDEX
})

afterEach(() => {
  while (pendientes.length) {
    const limpiar = pendientes.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
  document.body.innerHTML = ''
})

/** La parcela como la deja «Traer del Catastro»: medida y oficial nacen iguales. */
const parcelaDelCatastro = () =>
  crearParcela({
    idLocal: REFCAT,
    refcat: REFCAT,
    recintos: PARCELA_FIXTURE.recintos,
    geometriaOficial: PARCELA_FIXTURE.recintos,
    superficieCatastral: AREA_DECLARADA,
    origen: ORIGEN_PARCELA.WFS,
  })

/** La misma parcela con el vértice 0 movido 0,40 m al Este (el caso completo). */
const parcelaEditada = () => {
  const base = parcelaDelCatastro()
  return crearParcela({
    idLocal: base.idLocal,
    refcat: base.refcat,
    recintos: [{ vertices: ANILLO_EDITADO, tipo: base.recintos[0].tipo }],
    geometriaOficial: base.geometriaOficial,
    superficieCatastral: base.superficieCatastral,
    origen: base.origen,
  })
}

/**
 * Doble LIGERO del cableado de F05, calcado del de `test/app/diagnostico.dom.test.js`
 * y con sus dos propiedades de comportamiento: publica ANTES de devolver y cede el
 * turno antes de publicar (el `colindantes()` real pasa por la caché asíncrona).
 * jsdom no toca al Catastro jamás.
 */
function crearCatastroDoble() {
  const suscriptores = new Set()
  return {
    async colindantes() {
      await Promise.resolve()
      const resultado = {
        ok: true,
        datos: { propia: null, colindantes: VECINDAD_FIXTURE.filter((p) => p.refcat !== REFCAT) },
        motivo: null,
        mensaje: null,
        procedencia: {},
      }
      for (const fn of suscriptores) fn(resultado)
      return resultado
    },
    alColindantes(fn) {
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
  }
}

function montar({ parcelaInicial = parcelaDelCatastro() } = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: 19 })
  crearPanes(mapa)

  const estado = crearEstadoVista(parcelaInicial)
  const panel = crearDialogoAvisos({ documento: document })
  const cajon = crearCajonDiagnostico({ mapa })
  const contraste = crearContraste({ mapa, zona: HUSO })
  const cableado = cablearDiagnostico({ estado, cajon, contraste, panel, catastro: crearCatastroDoble() })

  pendientes.push(() => {
    cableado.destruir()
    contraste.destruir()
    cajon.destruir()
    destruirMapa()
  })

  return {
    mapa,
    estado,
    cajon,
    raizCajon: cajon.control.getContainer(),
    boton: document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR),
  }
}

/** Cede el turno al bucle de microtareas (para que lleguen las vecinas del doble). */
async function cederTurno(veces = 30) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

const textoDe = (raiz, selector) => raiz.querySelector(selector).textContent

/** Teclea (o borra) la superficie registral como lo haría el usuario. */
function teclearRegistral(raizCajon, texto) {
  const input = raizCajon.querySelector(SELECTOR_CAJON.REGISTRAL)
  input.value = texto
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * El banco ABIERTO y con el diagnóstico más rico que la app produce: parcela
 * editada, vecinas llegadas, registral tecleada y margen deducido de la
 * referencia. Es el estado sobre el que se lee la pantalla en AC2/AC3/AC4.
 */
async function abrirCasoCompleto() {
  const banco = montar()
  banco.boton.click()
  await cederTurno()
  banco.estado.set(parcelaEditada())
  teclearRegistral(banco.raizCajon, '1500')
  return banco
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Anti-vacuidad: los fixtures traen exactamente los casos que hacen falta
// ═════════════════════════════════════════════════════════════════════════════

describe('F07 · aceptación · los fixtures sobre los que se acepta son los REALES', () => {
  it('la parcela del WFS: 15 vértices, un solo recinto, y la MEDIDA no es la DECLARADA', () => {
    expect(PARCELA_FIXTURE.recintos).toHaveLength(1)
    expect(ANILLO_OFICIAL).toHaveLength(15)
    expect(AREA_DECLARADA, 'el Catastro declara un entero de m² (override O6)').toBe(1536)
    // El oráculo propio contra la cifra MEDIDA y escrita el 2026-07-29: que las dos
    // superficies del parcelario no coincidan ES el dato (app/main.js:422).
    expect(AREA_OFICIAL).toBeCloseTo(1535.865149996761, 9)
    expect(AREA_OFICIAL).not.toBe(AREA_DECLARADA)
  })

  it('la vecindad trae 5 miembros con la PROPIA en 2.ª posición (override O15)', () => {
    // Sin esto, el AC3 podría pasar contra una lista ya limpia y no probaría nada.
    expect(VECINDAD_FIXTURE).toHaveLength(5)
    expect(VECINDAD_FIXTURE[1].refcat).toBe(REFCAT)
    expect(VECINAS).toHaveLength(4)
  })

  it('el caso editado barre 3,124 m² hacia FUERA: produce las ocho métricas a la vez', () => {
    // El contorno editado CONTIENE al oficial (el vértice se movió hacia fuera), y
    // de esa contención salen dos oráculos gratis: |A∩B| = |oficial| y
    // |diferencia| = |editada| − |oficial|. Los usan los tests del AC1.
    expect(AREA_EDITADA - AREA_OFICIAL).toBeCloseTo(3.124, 3)
    expect(AREA_EDITADA).toBeGreaterThan(AREA_OFICIAL)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · AC1 · «Todas las métricas se calculan sobre fixtures conocidos con el
//           valor esperado (distancias/áreas con helpers propios, toBeCloseTo).»
// ═════════════════════════════════════════════════════════════════════════════
//
// Las ocho métricas de §10.1, sobre el caso completo y contra ORÁCULOS PROPIOS
// (regla 2 de la cabecera). La composición cifra a cifra («cada valor es el del
// módulo que ya lo sabe, al último bit») es de `test/diagnostico/parcela.test.js`
// y aquí no se repite.

describe('F07 · AC1 · todas las métricas se calculan sobre fixtures conocidos con el valor esperado', () => {
  const d = diagnosticar({
    recintos: [{ vertices: ANILLO_EDITADO, tipo: 'EXTERIOR' }],
    geometriaOficial: [{ vertices: ANILLO_OFICIAL, tipo: 'EXTERIOR' }],
    superficieCatastral: AREA_DECLARADA,
    superficieRegistral: 1500,
    vecinas: VECINAS,
    refcat: REFCAT,
  })

  it('superficie medida y catastral: la shoelace propia y el areaValue, sin confundirse', () => {
    expect(d.superficie.medida).toBeCloseTo(AREA_EDITADA, 9)
    expect(d.superficie.catastral).toBe(AREA_DECLARADA)
    // Y la shoelace del CONTORNO oficial es la tercera cifra, distinta de las dos.
    expect(d.superficie.oficial).toBeCloseTo(AREA_OFICIAL, 9)
    expect(d.superficie.catastral).not.toBe(d.superficie.oficial)
  })

  it('diferencia absoluta (m²) y relativa (%), con signo: el cruce medida − catastral', () => {
    const cruce = d.bandas.cruces.find((c) => c.a === 'medida' && c.b === 'catastral')
    expect(cruce).toBeDefined()
    expect(cruce.absoluto).toBeCloseTo(AREA_EDITADA - AREA_DECLARADA, 9)
    expect(cruce.relativo).toBeCloseTo((AREA_EDITADA - AREA_DECLARADA) / AREA_DECLARADA, 12)
    // El signo es información: aquí medimos MÁS de lo declarado.
    expect(cruce.absoluto).toBeGreaterThan(0)
  })

  it('solape y % de solape sobre la MAYOR: la contención hace el oráculo exacto', () => {
    // El editado contiene al oficial ⇒ la intersección ES el oficial entero, sin
    // que haga falta una segunda implementación topológica para saberlo.
    expect(d.solape.area).toBeCloseTo(AREA_OFICIAL, 6)
    expect(d.solape.relativo).toBeCloseTo(AREA_OFICIAL / AREA_EDITADA, 9)
    // Sobre la MAYOR (spec §10.1): por eso no da 1,00 aun conteniendo al oficial.
    expect(d.solape.relativo).toBeLessThan(1)
  })

  it('desplazamiento de centroides: la distancia euclídea entre los centroides propios', () => {
    const esperado = dist(centroideDe(ANILLO_EDITADO), centroideDe(ANILLO_OFICIAL))
    expect(d.centroides.distancia).toBeCloseTo(esperado, 9)
    // Y es una cifra pequeña pero no nula: mover un vértice mueve el centroide.
    expect(d.centroides.distancia).toBeGreaterThan(0)
    expect(d.centroides.distancia).toBeLessThan(0.4)
  })

  it('desviación máxima de lindero: 0,40 m, y ATRIBUIDA al lado que se movió', () => {
    // El punto oficial más cercano al vértice movido es su posición original, a
    // 0,40 m exactos (medido: ningún lado oficial pasa más cerca). Y §10.5 exige
    // resaltar UN lindero, así que equivocar el lado sería peor que equivocar la
    // cifra: el lado 0 es el que arranca en el vértice movido.
    expect(d.desviacion.maxima.maxima).toBeCloseTo(0.4, 9)
    expect(d.desviacion.maxima.recinto).toBe(0)
    expect(d.desviacion.maxima.indice).toBe(0)
  })

  it('invasión a colindantes: las TRES vecinas reales, con sus m² medidos', () => {
    expect(d.invasion.consultado).toBe(true)
    expect(d.invasion.invasiones.map((h) => h.refcat)).toEqual(
      INVASIONES_MEDIDAS.map((h) => h.refcat),
    )
    for (const [i, esperada] of INVASIONES_MEDIDAS.entries()) {
      expect(d.invasion.invasiones[i].area).toBeCloseTo(esperada.area, 5)
    }
    // Y la suma de lo invadido está acotada por el triángulo barrido MÁS las
    // astillas preexistentes de los linderos compartidos: sin editar, esas
    // astillas (≈ 5 cm² en total) van a `descartadas` por finas; al barrer hacia
    // fuera quedan ABSORBIDAS dentro de las piezas que sí cuentan (es el
    // comportamiento que documenta parcela.test.js), así que la suma las incluye.
    // La cota se DERIVA del caso sin editar, no se escribe a mano.
    const sinEditar = diagnosticar({
      recintos: [{ vertices: ANILLO_OFICIAL, tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: ANILLO_OFICIAL, tipo: 'EXTERIOR' }],
      vecinas: VECINAS,
    })
    const astillas = sinEditar.invasion.descartadas.reduce((s, x) => s + x.area, 0)
    expect(astillas, 'la cota no es vacua: las astillas existen').toBeGreaterThan(0)
    const total = d.invasion.invasiones.reduce((s, h) => s + h.area, 0)
    expect(total).toBeLessThanOrEqual(AREA_EDITADA - AREA_OFICIAL + astillas + 1e-9)
  })

  it('la cifra del cajón y la de la ficha del pie son la MISMA medición (promesa de la fase 5)', () => {
    // La ficha mide con `edit/metricas.js` y el cajón con `diagnostico/parcela.js`;
    // que las dos superficies coincidan AL ÚLTIMO BIT es el invariante que impide
    // que la app enseñe dos verdades. Aquí `toBe`, no `toBeCloseTo`, a propósito.
    const deLaFicha = metricas([{ vertices: ANILLO_EDITADO, tipo: 'EXTERIOR' }], {
      superficieCatastral: AREA_DECLARADA,
    })
    expect(deLaFicha.superficie).toBe(d.superficie.medida)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · AC2 · «La tabla a tres bandas acepta la superficie registral manual y
//           muestra las diferencias cruzadas.»
// ═════════════════════════════════════════════════════════════════════════════
//
// Por la PANTALLA: se teclea en el `<input>` del cajón real y se lee la tabla
// pintada. Que teclear RECALCULA y que el valor viaja como número lo afirma
// `test/app/diagnostico.dom.test.js` (§6); aquí se afirma lo que el criterio
// dice: que la tabla lo ACEPTA y que las diferencias cruzadas SE MUESTRAN.

describe('F07 · AC2 · la tabla a tres bandas acepta la superficie registral manual y muestra las diferencias cruzadas', () => {
  it('teclear 1.500 pinta los TRES cruces, en su orden y con su signo', async () => {
    const banco = montar()
    banco.boton.click()
    await cederTurno()

    teclearRegistral(banco.raizCajon, '1500')

    const tabla = banco.raizCajon.querySelector(SELECTOR_CAJON.CRUCES)
    const filas = [...tabla.querySelectorAll('tbody tr')]
    expect(filas, 'tres bandas = tres pares, siempre').toHaveLength(3)
    expect(filas.map((tr) => tr.cells[0].textContent)).toEqual([
      `Medición ${MENOS} Catastro`,
      `Medición ${MENOS} Registro`,
      `Catastro ${MENOS} Registro`,
    ])

    // Los valores, construidos desde el ORÁCULO con el formato de la casa: la
    // parcela sin editar mide MENOS que lo declarado (−0,13 m²) y MÁS que lo
    // inscrito (+35,87 m²). El signo es el dato: los dos sentidos aparecen.
    expect(filas[0].textContent).toContain(conSigno(AREA_OFICIAL - AREA_DECLARADA, m2))
    expect(filas[1].textContent).toContain(conSigno(AREA_OFICIAL - 1500, m2))
    expect(filas[2].textContent).toContain(conSigno(AREA_DECLARADA - 1500, m2))
  })

  it('borrar la registral devuelve sus cruces a «No consta», NO a 0', async () => {
    const banco = montar()
    banco.boton.click()
    await cederTurno()
    teclearRegistral(banco.raizCajon, '1500')

    teclearRegistral(banco.raizCajon, '')

    const filas = [...banco.raizCajon.querySelectorAll(`${SELECTOR_CAJON.CRUCES} tbody tr`)]
    // Los pares con la registral ya no tienen con qué comparar, y lo dicen; un
    // «0,00 m²» diría «no hay discrepancia con el Registro», que es otra cosa
    // (la doctrina null ≠ 0 de edit/metricas.js, heredada por bandas.js).
    expect(filas[1].textContent).toContain('No consta')
    expect(filas[2].textContent).toContain('No consta')
    expect(filas[1].textContent).not.toContain('0,00 m²')
    // Y el par que no depende de ella sigue con su número.
    expect(filas[0].textContent).toContain(conSigno(AREA_OFICIAL - AREA_DECLARADA, m2))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · AC3 · «Invasión a colindante se detecta como binaria con área y parcela
//           afectada.»
// ═════════════════════════════════════════════════════════════════════════════

describe('F07 · AC3 · invasión a colindante se detecta como binaria con área y parcela afectada', () => {
  it('con invasión real: nombra las TRES parcelas afectadas, cada una con sus m²', async () => {
    const banco = await abrirCasoCompleto()

    const invasion = textoDe(banco.raizCajon, SELECTOR_CAJON.INVASION)
    for (const { refcat, area } of INVASIONES_MEDIDAS) {
      expect(invasion, `falta la parcela afectada ${refcat}`).toContain(refcat)
      expect(invasion, `falta el área de ${refcat}`).toContain(m2(area))
    }
  })

  it('es BINARIA: deshacer la edición la hace desaparecer, sin medias tintas', async () => {
    const banco = await abrirCasoCompleto()
    expect(textoDe(banco.raizCajon, SELECTOR_CAJON.INVASION)).toContain(
      INVASIONES_MEDIDAS[0].refcat,
    )

    banco.estado.set(parcelaDelCatastro())

    const invasion = textoDe(banco.raizCajon, SELECTOR_CAJON.INVASION)
    expect(invasion).toContain('ninguna')
    for (const { refcat } of INVASIONES_MEDIDAS) expect(invasion).not.toContain(refcat)
  })

  it('sin consultar dice «no se ha consultado», JAMÁS «ninguna»', () => {
    // Las dos afirmaciones son opuestas y la segunda tranquiliza. El régimen de la
    // petición única y el fallo de red los cubre test/app/diagnostico.dom.test.js.
    const banco = montar()
    banco.boton.click() // sin ceder el turno: las vecinas aún no han llegado

    const invasion = textoDe(banco.raizCajon, SELECTOR_CAJON.INVASION)
    expect(invasion).toContain('no se ha consultado')
    expect(invasion).not.toContain('ninguna')
  })

  it('lo resaltado en el mapa no roba clics: todo el pane de diagnóstico es interactive:false', async () => {
    // La mitad «resaltada» del criterio la miden test/viewer/contraste.dom.test.js
    // (piezas, ámbar) y el guion 09 (píxeles). Lo que la aceptación afirma es la
    // condición para que F06 siga vivo con el cajón abierto: ninguna anotación se
    // interpone entre el ratón y los vértices.
    const banco = await abrirCasoCompleto()

    const capas = []
    banco.mapa.eachLayer((capa) => {
      if (capa instanceof L.Renderer) return
      if (capa.options && capa.options.pane === PANE.DIAGNOSTICO) capas.push(capa)
    })
    expect(capas.length, 'el contraste tiene que haber dibujado algo').toBeGreaterThan(0)
    for (const capa of capas) expect(capa.options.interactive).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · AC4 · «Ninguna salida contiene veredicto, semáforo ni umbral configurable
//           (test de que no existe config/umbrales.json y de que el texto es
//           descriptivo).» — EL GUARDIÁN, EN TRES FRENTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Claves de export que serían un veredicto. La lista del plan de F07, ampliada
 * con las variantes acentuadas: un `válido` con tilde no puede pasar porque el
 * regex se escribió sin ella.
 */
const EXPORT_PROHIBIDO =
  /^(ok|valido|válido|apto|apta|aprobado|dentro|cumple|semaforo|semáforo|umbral|tolerancia|nivel|color|veredicto)/i

/**
 * Palabras que convertirían el texto del cajón en un dictamen. Se buscan sobre el
 * `textContent` COMPLETO del cajón pintado, así que también cazan un rótulo que
 * alguien añada en `index.html` o un mensaje nuevo de la vista.
 */
const PALABRA_VEREDICTO =
  /\b(apt[oa]s?|correct[oa]s?|v[áa]lid[oa]s?|aprobad[oa]s?|cumple|supera|admisible|semáforo|semaforo|umbral|toleranci\w*|dentro del margen)\b/i

/** Clases CSS de mérito: el modificador BEM que pintaría un semáforo. */
const CLASE_MERITO = /--(ok|exito|éxito|error|valido|válido|apto|bien|mal)\b/i

describe('F07 · AC4 · ninguna salida contiene veredicto, semáforo ni umbral configurable', () => {
  it('1/3 · config/umbrales.json NO existe — y este test caza a quien lo cree', () => {
    const umbrales = join(RAIZ, 'config', 'umbrales.json')
    // Anti-vacuidad: la MISMA resolución de ruta sí encuentra el fichero hermano.
    // Sin esto, un test movido de sitio «pasaría» mirando un directorio vacío.
    expect(existsSync(join(RAIZ, 'config', 'operativos.json'))).toBe(true)
    expect(
      existsSync(umbrales),
      `${umbrales} existe: alguien ha creado el fichero de umbrales que la spec ` +
        'prohíbe (regla de oro 9). No hay umbral bueno: bórralo y lee la spec de F07.',
    ).toBe(false)
  })

  it('2/3 · ningún módulo de diagnostico/ exporta una clave de veredicto', () => {
    const MODULOS = {
      '_comun.js': comun,
      'bandas.js': bandasModulo,
      'desviacion.js': desviacionModulo,
      'margen.js': margenModulo,
      'parcela.js': parcelaModulo,
      'topologia.js': topologiaModulo,
    }

    let miradas = 0
    for (const [fichero, modulo] of Object.entries(MODULOS)) {
      for (const [nombre, valor] of Object.entries(modulo)) {
        miradas += 1
        expect(nombre, `diagnostico/${fichero} exporta '${nombre}'`).not.toMatch(EXPORT_PROHIBIDO)
        // Y las claves de los objetos congelados exportados (OMISION, CLASE,
        // CLAVE_BANDA…): un `OMISION.OK` sería un veredicto con otro sombrero.
        if (valor !== null && typeof valor === 'object') {
          for (const clave of Object.keys(valor)) {
            miradas += 1
            expect(clave, `diagnostico/${fichero} → ${nombre}.${clave}`).not.toMatch(
              EXPORT_PROHIBIDO,
            )
          }
        }
      }
    }
    // El guardián mira algo: si un refactor vaciara los imports, esto lo diría.
    expect(miradas).toBeGreaterThan(20)
    // El recorrido gemelo —recursivo, sobre el objeto que DEVUELVE `diagnosticar()`
    // con el caso real— vive en test/diagnostico/parcela.test.js § «NO juzga».
    // No se duplica aquí: dos guardianes del mismo invariante se desincronizan.
  })

  it('3/3 · el DOM del cajón pintado: ni palabra, ni clase, ni color de mérito fuera de la invasión', async () => {
    const banco = await abrirCasoCompleto()
    const raiz = banco.raizCajon

    // (a) El texto completo, con el diagnóstico más rico que la app produce. La
    // anti-vacuidad es doble: hay texto de sobra y el titular es el descriptivo.
    const texto = raiz.textContent
    expect(texto.length).toBeGreaterThan(200)
    expect(textoDe(raiz, SELECTOR_CAJON.TITULAR)).toMatch(/^Contraste con el parcelario — Medición de /)
    expect(texto).not.toMatch(PALABRA_VEREDICTO)

    // (b) Ninguna clase CSS de mérito en ningún nodo del cajón.
    for (const el of raiz.querySelectorAll('*')) {
      expect(String(el.className), `clase de mérito en <${el.tagName.toLowerCase()}>`).not.toMatch(
        CLASE_MERITO,
      )
    }

    // (c) El ámbar (#92400E) SOLO dentro de la sección de invasión. Se recorre
    // todo color puesto en línea; la anti-vacuidad exige que el detector VEA el
    // ámbar de las invasiones reales (si no viera ninguno, no vigilaría nada).
    const AMBAR = /(#92400e|rgb\(\s*146\s*,\s*64\s*,\s*14\s*\))/i
    let ambares = 0
    for (const el of raiz.querySelectorAll('*')) {
      const color = el.style ? el.style.color : ''
      if (!color || !AMBAR.test(color)) continue
      ambares += 1
      expect(
        el.closest(SELECTOR_CAJON.INVASION),
        'hay ámbar fuera de la sección de invasión (la única excepción de la regla 9)',
      ).not.toBeNull()
    }
    expect(ambares, 'con tres invasiones pintadas, el ámbar tiene que estar').toBeGreaterThan(0)
  })

  it('…y el único mando del cajón es el EXPEDIENTE: no hay ningún control de umbral', async () => {
    // «Ni umbral configurable, ni siquiera uno que elija el usuario» (spec §
    // «Cómo se presenta»). Los dos únicos controles son datos del expediente: la
    // superficie de la escritura y la clase de suelo. Un tercer control numérico
    // sería el umbral entrando por la puerta de atrás.
    const banco = await abrirCasoCompleto()
    const controles = [...banco.raizCajon.querySelectorAll('input, select')]
    expect(controles).toHaveLength(2)
    expect(controles.map((el) => el.dataset.campo).sort()).toEqual([
      'clase-parcela',
      'superficie-registral',
    ])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · El override del dossier: el margen se ENUNCIA con su etiqueta, jamás compara
// ═════════════════════════════════════════════════════════════════════════════

describe('F07 · override · el margen de identidad es una capa informativa etiquetada, no un veredicto', () => {
  it('deducido de la referencia: viaja con la etiqueta del BOE y DICE que es una propuesta', async () => {
    const banco = await abrirCasoCompleto()

    const margen = textoDe(banco.raizCajon, SELECTOR_CAJON.MARGEN)
    expect(margen).toContain(ETIQUETA) // «margen de identidad del Catastro»
    expect(margen).toContain('0,50 m') // urbana (la referencia real lo es)
    expect(margen).toContain('5,00 %')
    // La clase la propuso la app, no una persona, y se dice con todas las letras.
    expect(margen).toContain('Clase propuesta por la aplicación')
  })

  it('elegido por el usuario: cambia la cifra (±2 m rústica) y desaparece el rótulo de propuesta', async () => {
    const banco = await abrirCasoCompleto()
    const selector = banco.raizCajon.querySelector(SELECTOR_CAJON.CLASE_PARCELA)
    selector.value = 'RUSTICA'
    selector.dispatchEvent(new Event('change', { bubbles: true }))

    const margen = textoDe(banco.raizCajon, SELECTOR_CAJON.MARGEN)
    expect(margen).toContain(ETIQUETA)
    expect(margen).toContain('2,00 m')
    expect(margen).not.toContain('propuesta')
  })
})

/* -------------------------------------------------------------------------- *
 * ⛔ LO QUE ESTA SUITE **NO** PUEDE CUBRIR, DICHO CON TODAS LAS LETRAS         *
 *                                                                              *
 * jsdom no tiene motor de layout ni rasterizador, así que nada de lo que sigue *
 * se puede afirmar aquí sin mentir. Lo mide `scripts/smoke-navegador/          *
 * 09-diagnostico.js` en un navegador real, y lo que ni él firma queda en la    *
 * sección 8 de `scripts/smoke-navegador/CHECKLIST-HUMANO.md`:                  *
 *                                                                              *
 *   (h1) **Que la diferencia simétrica SE VEA.** El sombreado sale del         *
 *        `fillRule: 'evenodd'` por defecto de Leaflet sobre                    *
 *        `L.polygon([anilloMedido, anilloOficial])`; comprobar que la paridad  *
 *        rellena la diferencia (y NO la zona común) exige píxeles de verdad.   *
 *   (h2) **El ancho de la banda del margen en METROS al cambiar el zoom.** El  *
 *        trazo se recalcula en `zoomend` a partir de la escala; sin proyección *
 *        real no hay escala real.                                              *
 *   (h3) **Que el cajón no tape el mapa ni empuje nada**, y que ABRIRLO no le  *
 *        quite altura a la caja de vértices del panel (la Decisión 1 de F07).  *
 *        Son medidas de `getBoundingClientRect` con layout.                    *
 *   (h4) **Cuánto tarda el recálculo completo** sobre la parcela real con sus  *
 *        vecinas: el tiempo solo significa algo con el motor real.             *
 *   (h5) **Si alguna cifra o color SE LEE como un veredicto** aunque el texto  *
 *        no lo diga: eso no lo firma ninguna máquina — es el punto BLOQUEANTE  *
 *        del checklist humano §8.                                              *
 * -------------------------------------------------------------------------- */
