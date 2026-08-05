/* -------------------------------------------------------------------------- *
 * test/gml/serialize-expediente.test.js — F17 · tarea 1.3                      *
 *                                                                              *
 * `serializarExpedienteCp` escribe VARIAS parcelas en un solo `.gml`, una por   *
 * `gml:featureMember`. No es una extrapolación: el 2026-08-03 se subió a la     *
 * Sede un fichero así y el IVG devolvió POSITIVO (CSV `XMWPXCN9J8DB9J89`,       *
 * override **O18**, `SPEC.md` §7.1). Hasta entonces el módulo tenía             *
 * `MIEMBROS = 1` como constante, con un JSDoc que ya anticipaba este día.       *
 *                                                                              *
 * Lo que este fichero defiende, por orden de importancia:                       *
 *                                                                              *
 *   1. ⛔ **`xs:ID` ÚNICO EN TODO EL DOCUMENTO.** Es EL riesgo de esta función.  *
 *      `idsDeParcela` compone los identificadores a partir del `refcat`, así    *
 *      que dos miembros con la misma referencia repiten los suyos y el fichero  *
 *      entero queda inválido — un error que ninguna herramienta local enseña y  *
 *      que el IVG rechaza semanas después. Con un miembro la trampa era         *
 *      teórica (`SPEC.md` §3.1); aquí es el modo de fallo principal.            *
 *   2. ⛔ **REGRESIÓN: una parcela sale EXACTAMENTE igual que antes.** El 100 %  *
 *      del uso actual pasa por `serializarParcelaCp`, y esta tarea le reescribe *
 *      la raíz por debajo. Se compara byte a byte contra la salida de la otra   *
 *      función, que es lo mismo que compararla contra F04.                      *
 *   3. Que el sobre sea UNO: perfiles o husos mezclados LANZAN, no se toman del *
 *      primero en silencio.                                                     *
 *   4. Que un expediente incompleto NO se descargue: si un miembro está         *
 *      bloqueado, `xml` es `null`. La Sede valida el conjunto.                   *
 *   5. El caso MEDIDO: matriz `ES.SDGC.CP` + cesión `ES.LOCAL.CP` con la        *
 *      referencia del padre sufijada (override **O19**).                        *
 *                                                                              *
 * Proyecto Vitest `node`: cadenas y funciones puras (jsdom como lector de XML). *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

import { serializarParcelaCp, serializarExpedienteCp } from '../../gml/serialize-cp.js'
import { PERFIL, SEVERIDAD } from '../../gml/_comun.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

// ── Arnés ────────────────────────────────────────────────────────────────────

const SRS = 'EPSG:25830'

/** Rectángulo ANTIHORARIO como `recintos` del modelo (anillo ABIERTO). */
const rect = (x0, y0, x1, y1) => [
  {
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    tipo: TIPO_RECINTO.EXTERIOR,
  },
]

/**
 * El caso MEDIDO, con la identidad que la Sede aceptó: la matriz bajo
 * `ES.SDGC.CP` y la cesión bajo `ES.LOCAL.CP` con la referencia del padre
 * SUFIJADA —no vacía— (override O19).
 */
const MATRIZ = Object.freeze({
  recintos: rect(440000, 4470000, 440020, 4470020),
  srs: SRS,
  refcat: '7136910UF1473N',
  namespaceInspire: 'ES.SDGC.CP',
  nationalCadastralReference: '7136910UF1473N',
})
const CESION = Object.freeze({
  recintos: rect(440020, 4470000, 440022, 4470020),
  srs: SRS,
  refcat: '7136910UF1473N.1',
  namespaceInspire: 'ES.LOCAL.CP',
  nationalCadastralReference: '7136910UF1473N.1',
})

const dom = (xml) => new JSDOM(xml, { contentType: 'text/xml' }).window.document
const todos = (doc, selector) => [...doc.querySelectorAll(selector)]

/** Todos los `gml:id` del documento, en orden. */
const idsDe = (xml) =>
  [...dom(xml).querySelectorAll('*')]
    .map((e) => e.getAttribute('gml:id'))
    .filter((v) => v !== null)

// ── 1 · ⛔ La regresión: una parcela no se mueve ni un byte ───────────────────

describe('serializarExpedienteCp · una sola parcela sale como siempre', () => {
  it('⛔ con UN miembro produce EXACTAMENTE lo mismo que `serializarParcelaCp`', () => {
    // Esta tarea reescribe la raíz del documento por debajo del camino que usa el
    // 100 % de la aplicación. La comparación es de cadena completa a propósito: un
    // atributo de más o un salto de línea distinto ya sería un fichero distinto.
    const una = serializarParcelaCp(MATRIZ)
    const expediente = serializarExpedienteCp({ parcelas: [MATRIZ] })
    expect(expediente.xml).toBe(una.xml)
    expect(expediente.resumen.emitido).toBe(true)
  })

  it('y el resumen del miembro es el MISMO objeto de siempre, dentro de `porMiembro`', () => {
    const una = serializarParcelaCp(MATRIZ)
    const expediente = serializarExpedienteCp({ parcelas: [MATRIZ] })
    expect(expediente.resumen.porMiembro).toHaveLength(1)
    expect(expediente.resumen.porMiembro[0]).toEqual(una.resumen)
  })
})

// ── 2 · Dos miembros: el caso que la Sede aceptó ─────────────────────────────

describe('serializarExpedienteCp · el expediente de DOS parcelas (override O18)', () => {
  const { xml, resumen } = serializarExpedienteCp({ parcelas: [MATRIZ, CESION] })

  it('sale UN documento con DOS `gml:featureMember`', () => {
    expect(resumen.emitido).toBe(true)
    const doc = dom(xml)
    expect(doc.documentElement.localName).toBe('FeatureCollection')
    expect(todos(doc, 'featureMember')).toHaveLength(2)
    expect(todos(doc, 'CadastralParcel')).toHaveLength(2)
  })

  it('⭐ N parcelas producen N·3 + 1 `gml:id` y NINGUNO se repite', () => {
    // Por miembro: el `CadastralParcel`, su `MultiSurface` y su `Surface`. Más el
    // de la COLECCIÓN, que es uno para todo el documento. El `referencePoint` no
    // entra: el perfil ENTREGA no lo emite.
    const ids = idsDe(xml)
    expect(ids).toHaveLength(2 * 3 + 1)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el `gml:id` de la COLECCIÓN es uno solo, aunque los namespaces difieran', () => {
    // Es el caso medido: la matriz va bajo `ES.SDGC.CP` y la cesión bajo
    // `ES.LOCAL.CP`, y el documento aceptado llevaba un único id de colección.
    expect(dom(xml).documentElement.getAttribute('gml:id')).toBe('ES.SDGC.CP')
    expect(resumen.namespaces).toEqual(['ES.SDGC.CP', 'ES.LOCAL.CP'])
  })

  it('cada miembro conserva SU identidad: los dos `localId` y sus namespaces', () => {
    const doc = dom(xml)
    expect(todos(doc, 'localId').map((e) => e.textContent.trim())).toEqual([
      '7136910UF1473N',
      '7136910UF1473N.1',
    ])
    expect(todos(doc, 'namespace').map((e) => e.textContent.trim())).toEqual([
      'ES.SDGC.CP',
      'ES.LOCAL.CP',
    ])
    expect(resumen.localIds).toEqual(['7136910UF1473N', '7136910UF1473N.1'])
  })

  it('⭐ la referencia de la cesión va SUFIJADA, no vacía (override O19)', () => {
    // Lo que el IVG aceptó fue la referencia del padre con `.1`, y esto lo deja
    // fijado: `nationalCadastralReference` vacío es el patrón del ALTA, no el de
    // una segregación. ⚠️ Sabemos que la forma con sufijo VALE, no que la vacía
    // falle: no se ha medido.
    const refs = todos(dom(xml), 'nationalCadastralReference').map((e) => e.textContent.trim())
    expect(refs).toEqual(['7136910UF1473N', '7136910UF1473N.1'])
  })

  it('el resumen agrega sobre lo REDONDEADO, que es lo que va escrito', () => {
    // Regla de oro 11. Sumar el float64 del modelo daría otra cifra, y sería la
    // que no se puede comprobar abriendo el fichero.
    expect(resumen.nMiembros).toBe(2)
    const escritos = todos(dom(xml), 'areaValue').map((e) => Number(e.textContent))
    expect(resumen.areaValueTotal).toBe(escritos[0] + escritos[1])
    expect(resumen.porMiembro.map((m) => m.areaValue)).toEqual(escritos)
  })
})

// ── 3 · ⛔ `xs:ID`: el riesgo de esta función ─────────────────────────────────

describe('serializarExpedienteCp · ⛔ ningún `gml:id` repetido entre miembros', () => {
  it('LANZA si dos parcelas comparten IDENTIDAD, nombrando el id y las dos posiciones', () => {
    // Los ids salen de `namespace + refcat`: dos miembros con la misma identidad
    // los repiten TODOS y el documento entero queda inválido. Se caza antes de
    // renderizar, porque un fichero así sale sin una sola queja local.
    const gemela = { ...CESION, refcat: MATRIZ.refcat, namespaceInspire: MATRIZ.namespaceInspire }
    expect(() => serializarExpedienteCp({ parcelas: [MATRIZ, gemela] })).toThrow(/gml:id/)
    let error = null
    try {
      serializarExpedienteCp({ parcelas: [MATRIZ, gemela] })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain('parcelas[0]')
    expect(error.message).toContain('parcelas[1]')
    expect(error.message).toContain('7136910UF1473N')
  })

  it('⭐ pero la MISMA refcat bajo OTRO namespace no choca, y eso es correcto', () => {
    // Medido al escribir la prueba, y la primera versión de este test lo daba por
    // colisión: la base del id es `namespace + refcat`, así que `ES.SDGC.CP` y
    // `ES.LOCAL.CP` producen ids distintos con la misma referencia.
    //
    // No es un tecnicismo: es exactamente la forma del expediente que la Sede
    // aceptó —la matriz y una cesión que arrastra la referencia del padre—, y si
    // el guardián fuera «mismo refcat ⇒ error» habría rechazado el único caso con
    // IVG positivo que este proyecto tiene.
    const mismaRefOtroNs = { ...CESION, refcat: MATRIZ.refcat }
    const { xml, resumen } = serializarExpedienteCp({ parcelas: [MATRIZ, mismaRefOtroNs] })
    expect(resumen.emitido).toBe(true)
    const ids = idsDe(xml)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('ES.SDGC.CP.7136910UF1473N')
    expect(ids).toContain('ES.LOCAL.CP.7136910UF1473N')
  })

  it('tres parcelas distintas dan 3·3 + 1 ids, todos únicos', () => {
    // ⚠️ Tres o más NO está medido contra la Sede (§7.1 lo dice): lo que esta
    // prueba afirma es que el ESCRITOR aguanta, no que el IVG lo acepte.
    const tercera = { ...CESION, refcat: '7136910UF1473N.2', nationalCadastralReference: '7136910UF1473N.2' }
    const { xml } = serializarExpedienteCp({ parcelas: [MATRIZ, CESION, tercera] })
    const ids = idsDe(xml)
    expect(ids).toHaveLength(3 * 3 + 1)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── 4 · El sobre es UNO: se exige, no se supone ──────────────────────────────

describe('serializarExpedienteCp · un documento tiene UN sobre', () => {
  it('LANZA si los miembros declaran perfiles distintos', () => {
    // Tomar el del primero y callar produciría una raíz que contradice a su
    // contenido, y ese fichero sale sin una queja hasta llegar al IVG.
    expect(() =>
      serializarExpedienteCp({
        parcelas: [MATRIZ, { ...CESION, perfil: PERFIL.WFS, beginLifespanVersion: '2026-08-03T10:00:00' }],
      }),
    ).toThrow(/perfil/)
  })

  it('LANZA si los miembros declaran SRS distintos', () => {
    // Dos husos en el mismo expediente producen parcelas que no encajan entre sí,
    // y el `srsName` se escribe por geometría: nadie lo vería en el fichero.
    expect(() =>
      serializarExpedienteCp({ parcelas: [MATRIZ, { ...CESION, srs: 'EPSG:25829' }] }),
    ).toThrow(/sistema de referencia/)
  })

  it('LANZA con una lista vacía, y el mensaje señala la función directa', () => {
    expect(() => serializarExpedienteCp({ parcelas: [] })).toThrow(/al menos una parcela/)
    expect(() => serializarExpedienteCp({})).toThrow(TypeError)
    expect(() => serializarExpedienteCp({ parcelas: 'dos' })).toThrow(TypeError)
  })

  it('el comentario y la indentación son del DOCUMENTO, no de cada miembro', () => {
    const { xml } = serializarExpedienteCp({
      parcelas: [MATRIZ, CESION],
      comentario: 'Expediente de prueba',
      indentacion: '    ',
    })
    expect(xml.split('\n')[1]).toBe('<!--Expediente de prueba-->')
    // Un solo comentario, no uno por miembro.
    expect(xml.match(/<!--/g)).toHaveLength(1)
    expect(xml).toContain('\n    <gml:featureMember>')
  })

  it('en perfil WFS, `numberMatched` y `numberReturned` dicen CUÁNTAS van', () => {
    // Era la constante `MIEMBROS = 1` del módulo: con dos miembros la raíz habría
    // mentido, y es el atributo que dice de qué habla el documento.
    const wfs = (p) => ({ ...p, perfil: PERFIL.WFS, beginLifespanVersion: '2026-08-03T10:00:00' })
    const { xml } = serializarExpedienteCp({
      parcelas: [wfs(MATRIZ), wfs(CESION)],
      timeStamp: '2026-08-03T10:00:00',
    })
    const raiz = dom(xml).documentElement
    expect(raiz.getAttribute('numberMatched')).toBe('2')
    expect(raiz.getAttribute('numberReturned')).toBe('2')
  })
})

// ── 5 · Un expediente incompleto no se descarga ──────────────────────────────

describe('serializarExpedienteCp · si un miembro está bloqueado, no sale nada', () => {
  it('⛔ `xml` es null y los bloqueos de TODOS los miembros salen juntos', () => {
    // La Sede valida el conjunto: bajar el fichero con una parcela menos sería la
    // invitación a presentarlo así. Misma decisión que `serializarParcelaCp` toma
    // con una sola (decisión 2 de la cabecera del módulo).
    const degenerada = {
      ...CESION,
      recintos: [
        {
          vertices: [
            [440000, 4470000],
            [440000.001, 4470000],
            [440000.002, 4470000],
          ],
          tipo: TIPO_RECINTO.EXTERIOR,
        },
      ],
    }
    const { xml, resumen, detecciones } = serializarExpedienteCp({
      parcelas: [MATRIZ, degenerada],
    })
    expect(resumen.emitido).toBe(false)
    expect(xml).toBeNull()
    expect(resumen.bloqueos.length).toBeGreaterThan(0)
    // Y las detecciones de los dos miembros están, no solo las del que falla: el
    // usuario tiene que ver el expediente entero para saber qué arreglar.
    expect(detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)).toBe(true)
    expect(resumen.porMiembro).toHaveLength(2)
    expect(resumen.porMiembro[0].emitido).toBe(true)
    expect(resumen.porMiembro[1].emitido).toBe(false)
  })
})
