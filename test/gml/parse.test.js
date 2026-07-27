/* -------------------------------------------------------------------------- *
 * test/gml/parse.test.js — F04 · Lectura de un GML de parcela (T3.1)           *
 *                                                                              *
 * `gml/parse.js` es la puerta por la que entra un fichero que NO ha escrito     *
 * este proyecto, así que casi todo lo que puede ir mal aquí va mal EN VERDE: un *
 * campo que se lee de otro sitio, un anillo que se cierra solo, una detección   *
 * que no se emite. Por eso este fichero no comprueba «que parse devuelve lo que *
 * devuelve»: monta un ORÁCULO INDEPENDIENTE con jsdom sobre los mismos GML      *
 * reales de `test/fixtures/gml/` y coteja campo por campo. Cada número que se   *
 * afirma —15 vértices, 1536 m², 16 pares en el `posList`— sale de LEER el       *
 * fichero, nunca del enunciado de la tarea (regla de oro 8).                    *
 *                                                                              *
 * Los casos que ningún fixture cubre (varias parcelas, SRS incoherente, anillo  *
 * sin cerrar, `posList` con letras…) tampoco se teclean a mano: se fabrican     *
 * MUTANDO el texto del GML real, para que sigan siendo ficheros del Catastro    *
 * con un defecto concreto y no maquetas que podrían no parecerse a nada.        *
 *                                                                              *
 * LA TRAMPA Nº 1 DE ESTA TAREA, con test propio: `crearRecinto` escupe un       *
 * `console.warn` por CADA anillo cerrado que recibe, y en GML todos los anillos *
 * vienen cerrados. Un parse que delegara el cierre en el modelo llenaría la     *
 * consola en cada fichero legítimo. Aquí se espía `console.warn` durante el     *
 * parseo de los cuatro fixtures (cero llamadas) y se demuestra que el espía NO  *
 * es vacuo: el mismo anillo, cerrado y pasado a `crearRecinto`, sí avisa.       *
 *                                                                              *
 * Proyecto Vitest `node`: XML, POJOs y geometría, sin DOM de aplicación.        *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { JSDOM } from 'jsdom'

import { parsearGml, MAX_ERRORES_XML } from '../../gml/parse.js'
import {
  DIALECTO,
  ELEMENTOS_PROSCRITOS_CP40,
  NS,
  ORDEN_CADASTRAL_PARCEL,
  SEVERIDAD,
  SRS_SOPORTADOS,
  TIPO_GML,
  clasificarDialecto,
  srsNameUri,
} from '../../gml/_comun.js'
import { areaFirmada } from '../../geo/area.js'
import {
  ORIGEN_PARCELA,
  TIPO_RECINTO,
  crearParcela,
  crearRecinto,
} from '../../model/parcela.js'

// ── Arnés: los fixtures del disco y un oráculo independiente ─────────────────
// `import.meta.dirname`, no `new URL(..., import.meta.url)` (convención del repo).

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')

/**
 * Lee un GML decodificándolo con el encoding que el propio fichero DECLARA. Es
 * el trabajo que `gml/parse.js` NO hace (recibe texto ya decodificado) y que
 * alguien tiene que hacer: los GML del WFS vienen declarados en ISO-8859-1.
 */
function leerGml(nombre) {
  const bytes = readFileSync(join(DIR_FIXTURES, nombre))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  const encoding = m ? m[1] : 'utf-8'
  return { encoding, texto: new TextDecoder(encoding).decode(bytes) }
}

/** Oráculo: el mismo documento visto por jsdom, que no es el parser bajo prueba. */
function analizar(nombre) {
  const { encoding, texto } = leerGml(nombre)
  const doc = new JSDOM(texto, { contentType: 'text/xml' }).window.document
  const raiz = doc.documentElement
  const contenedor = raiz.firstElementChild
  const feature = contenedor?.firstElementChild ?? null
  return { nombre, encoding, texto, doc, raiz, contenedor, feature }
}

/** Todos los elementos del documento del oráculo. */
const todos = (a) => [...a.doc.querySelectorAll('*')]

/** Primer elemento con ese `localName`, o `null`. */
const porLocal = (a, local) => todos(a).find((e) => e.localName === local) ?? null

/** Texto (recortado) del primer elemento con ese `localName`, o `null`. */
const textoDe = (a, local) => porLocal(a, local)?.textContent.trim() ?? null

/** El dialecto que `gml/_comun.js` asigna al fixture. Ya lo ata `comun.test.js`. */
const dialectoDe = (a) =>
  clasificarDialecto({
    ns: a.raiz.namespaceURI,
    local: a.raiz.localName,
    featureNs: a.feature?.namespaceURI ?? null,
  })

// Verdad-terreno: lo que HAY en el disco, recorrido con readdirSync. Nada de
// enumerar ficheros a mano — si mañana entra un fixture nuevo (rústica, con
// islas), estas comprobaciones lo incluyen solas.
const FIXTURES = readdirSync(DIR_FIXTURES)
  .filter((n) => n.toLowerCase().endsWith('.gml'))
  .sort()
const ANALISIS = FIXTURES.map(analizar)

const CP40 = ANALISIS.find((a) => a.nombre === 'cp_parcela_9398516VK3799G.gml')
const CP30 = ANALISIS.find((a) => a.nombre === 'UTM_1.gml')

/** Resultado de parsear un fixture ya analizado. */
const parsear = (a, opciones) => parsearGml(a.texto, opciones)

/** Los tipos de detección emitidos, en orden. */
const tipos = (r) => r.detecciones.map((d) => d.tipo)

/** Las detecciones de un tipo concreto. */
const deTipo = (r, tipo) => r.detecciones.filter((d) => d.tipo === tipo)

// ── Fábrica de ficheros DEFECTUOSOS a partir del GML real ───────────────────
// Ninguno se teclea: todos son el fixture del WFS con una mutación quirúrgica.

/** El bloque `<member>…</member>` completo del GML 4.0. */
const BLOQUE_MEMBER = CP40.texto.match(/<member>[\s\S]*<\/member>/)[0]

/** Los tokens del `gml:posList` del GML 4.0, leídos del fichero. */
const TOKENS_POSLIST = CP40.texto
  .match(/<gml:posList[^>]*>([^<]*)<\/gml:posList>/)[1]
  .trim()
  .split(/\s+/)

/** El `srsName` (URI OGC) que trae el 4.0 y la URN que trae el 3.0. */
const SRSNAME_URI = CP40.raiz.querySelector('*[srsName]').getAttribute('srsName')
const SRSNAME_URN = CP30.raiz.querySelector('*[srsName]').getAttribute('srsName')

/** Reescribe el `gml:posList` con otros tokens (y, si se quiere, otros atributos). */
function conPosList(tokens, atributos) {
  const atr = atributos ?? `srsDimension="2" count="${tokens.length / 2}"`
  return CP40.texto.replace(
    /<gml:posList[^>]*>[^<]*<\/gml:posList>/,
    `<gml:posList ${atr}>${tokens.join(' ')}</gml:posList>`,
  )
}

/** Sustituye la ÚLTIMA aparición de un texto (para tocar solo el `gml:Point`). */
function reemplazarUltimo(texto, busca, pone) {
  const i = texto.lastIndexOf(busca)
  expect(i, `«${busca}» no aparece en el fixture`).toBeGreaterThan(-1)
  return texto.slice(0, i) + pone + texto.slice(i + busca.length)
}

describe('gml/parse · el arnés no miente', () => {
  it('hay al menos los cuatro GML reales en el disco, y los dos que se nombran', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(4)
    expect(CP40, 'falta el GML CP 4.0 del WFS').toBeDefined()
    expect(CP30, 'falta UTM_1.gml, el contraejemplo en CP 3.0').toBeDefined()
  })

  it('el oráculo (jsdom) parsea los cuatro sin error', () => {
    for (const a of ANALISIS) {
      expect(a.doc.querySelector('parsererror'), `${a.nombre} no parsea en jsdom`).toBeNull()
    }
  })

  it('las mutaciones parten de un fichero que SÍ se lee bien (no son sobre ruido)', () => {
    expect(parsearGml(CP40.texto).parcelas).toHaveLength(1)
    expect(BLOQUE_MEMBER.length).toBeGreaterThan(500)
    expect(TOKENS_POSLIST.length % 2).toBe(0)
    expect(SRSNAME_URI).not.toBe(SRSNAME_URN)
  })
})

// ── Contrato de entrada (frontera dato-del-usuario / error-del-programador) ───

describe('gml/parse · contrato de entrada', () => {
  it('un `xml` que no es string → TypeError, y el mensaje explica la frontera', () => {
    for (const malo of [null, undefined, 42, {}, Buffer.from('x')]) {
      expect(() => parsearGml(malo), JSON.stringify(String(malo))).toThrow(TypeError)
    }
    expect(() => parsearGml(null)).toThrow(/detecciones/)
  })

  it('`tolerarPolygon` que no es booleano → TypeError (opción del programador)', () => {
    expect(() => parsearGml('<foo/>', { tolerarPolygon: 'sí' })).toThrow(TypeError)
    expect(() => parsearGml('<foo/>', { tolerarPolygon: 1 })).toThrow(TypeError)
    // …y las formas válidas no lanzan.
    expect(() => parsearGml('<foo/>')).not.toThrow()
    expect(() => parsearGml('<foo/>', {})).not.toThrow()
    expect(() => parsearGml('<foo/>', { tolerarPolygon: false })).not.toThrow()
  })

  it('NINGÚN fixture lanza: un fichero real siempre sale por el valor de retorno', () => {
    for (const a of ANALISIS) expect(() => parsear(a), a.nombre).not.toThrow()
  })

  it('no muta la entrada y es determinista (misma cadena ⇒ mismo resultado)', () => {
    const antes = CP40.texto
    const uno = parsearGml(antes)
    const dos = parsearGml(antes)
    expect(antes).toBe(CP40.texto)
    expect(uno).toEqual(dos)
    // …y no comparte estructura entre llamadas: el llamante puede mutar lo suyo.
    expect(uno.parcelas[0].recintos).not.toBe(dos.parcelas[0].recintos)
  })
})

// ── Definición de hecho 1: los cuatro fixtures, cada uno en su dialecto ───────

describe('gml/parse · clasifica los CUATRO fixtures del disco en su dialecto', () => {
  it('coincide con el dialecto que `clasificarDialecto` asigna a cada fichero', () => {
    // El oráculo del dialecto es `gml/_comun.js` sobre el árbol de jsdom, que ya
    // está atado a los ficheros en `comun.test.js`: aquí se comprueba que el
    // lector llega a la MISMA conclusión leyendo el texto por su cuenta.
    for (const a of ANALISIS) {
      const esperado = dialectoDe(a)
      const r = parsear(a)
      expect(r.dialecto, a.nombre).toBe(esperado.id)
      expect(r.soportado, a.nombre).toBe(esperado.soportado)
      expect(r.resumen.dialecto, a.nombre).toBe(esperado.id)
    }
  })

  it('ninguno cae en DESCONOCIDO ni deja `raiz` sin rellenar', () => {
    for (const a of ANALISIS) {
      const r = parsear(a)
      expect(r.dialecto, a.nombre).not.toBe(DIALECTO.DESCONOCIDO)
      expect(r.resumen.raiz, a.nombre).toEqual({
        ns: a.raiz.namespaceURI,
        local: a.raiz.localName,
      })
    }
  })

  it('exactamente UNO es soportado, y es el único con `bloqueos` vacíos', () => {
    const soportados = ANALISIS.filter((a) => parsear(a).soportado).map((a) => a.nombre)
    const sinBloqueos = ANALISIS.filter((a) => parsear(a).resumen.bloqueos.length === 0).map(
      (a) => a.nombre,
    )
    expect(soportados).toHaveLength(1)
    expect(sinBloqueos).toEqual(soportados)
  })

  it('cuenta los miembros que el oráculo ve en la raíz', () => {
    for (const a of ANALISIS) {
      const esperado = [...a.raiz.children].filter(
        (e) => e.localName === dialectoDe(a).miembro.local,
      ).length
      expect(parsear(a).resumen.nMiembros, a.nombre).toBe(esperado)
    }
  })

  it('el `encodingDeclarado` es el del prólogo, y solo avisa si no es UTF-8', () => {
    for (const a of ANALISIS) {
      const r = parsear(a)
      expect(r.resumen.encodingDeclarado, a.nombre).toBe(a.encoding)
      const avisa = deTipo(r, TIPO_GML.ENCODING_DECLARADO).length > 0
      expect(avisa, a.nombre).toBe(!/^utf-?8$/i.test(a.encoding))
    }
  })
})

// ── Definición de hecho 5: NI UN `console.warn` (la trampa nº 1) ─────────────

describe('gml/parse · NINGÚN console.warn al leer un GML legítimo', () => {
  it('los cuatro fixtures se parsean sin una sola llamada a console.warn', () => {
    const espia = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (const a of ANALISIS) parsear(a)
      expect(
        espia.mock.calls.map((c) => String(c[0])),
        'parse ha avisado por consola leyendo un GML legítimo: casi seguro que ha ' +
          'delegado el cierre del anillo en model/parcela.js#crearRecinto',
      ).toEqual([])
    } finally {
      espia.mockRestore()
    }
  })

  it('…y el espía NO es vacuo: el MISMO anillo, cerrado, sí hace avisar al modelo', () => {
    // Esta es la mitad que impide que el test de arriba pase en verde por accidente
    // (p. ej. si `console.warn` dejara de existir o el espía no estuviera activo).
    // Los pares se toman del `posList` del fichero: 16 pares, el último repite al
    // primero, que es la forma en que TODO GML entrega un anillo.
    const cerrado = []
    for (let i = 0; i < TOKENS_POSLIST.length; i += 2) {
      cerrado.push([Number(TOKENS_POSLIST[i]), Number(TOKENS_POSLIST[i + 1])])
    }
    expect(cerrado[0]).toEqual(cerrado[cerrado.length - 1])

    const espia = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      crearRecinto(cerrado, TIPO_RECINTO.EXTERIOR)
      expect(espia).toHaveBeenCalledTimes(1)
      expect(String(espia.mock.calls[0][0])).toMatch(/CERRADO/)
    } finally {
      espia.mockRestore()
    }
  })

  it('los recintos que devuelve parse pasan por `crearParcela` SIN avisar', () => {
    // El motivo de que parse devuelva `recintos` y no una `Parcela`: `idLocal` y
    // `origen` son decisiones del llamante. Lo que sí garantiza parse es que sus
    // recintos entran en el modelo sin ruido, porque ya vienen abiertos.
    const { parcelas } = parsearGml(CP40.texto)
    const espia = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const parcela = crearParcela({
        idLocal: 'expediente-de-prueba',
        refcat: parcelas[0].refcat,
        recintos: parcelas[0].recintos,
        origen: ORIGEN_PARCELA.GML_EXISTENTE,
      })
      expect(espia.mock.calls).toEqual([])
      expect(parcela.recintos[0].vertices).toEqual(parcelas[0].recintos[0].vertices)
    } finally {
      espia.mockRestore()
    }
  })

  it('parse NO devuelve una Parcela del modelo (sin `idLocal` ni `origen`)', () => {
    const parcela = parsearGml(CP40.texto).parcelas[0]
    expect(parcela).not.toHaveProperty('idLocal')
    expect(parcela).not.toHaveProperty('origen')
    expect(parcela).not.toHaveProperty('geometriaOficial')
  })
})

// ── Definición de hecho 2: el GML 4.0 del WFS, campo por campo ───────────────

describe('gml/parse · cp_parcela_9398516VK3799G.gml (CP 4.0) — cotejado con jsdom', () => {
  const resultado = parsearGml(CP40.texto)
  const parcela = resultado.parcelas[0]

  it('es CP_4_0, soportado, con UNA parcela y sin bloqueos', () => {
    expect(resultado.dialecto).toBe(DIALECTO.CP_4_0)
    expect(resultado.soportado).toBe(true)
    expect(resultado.parcelas).toHaveLength(1)
    expect(resultado.resumen.bloqueos).toEqual([])
  })

  it('el anillo sale ABIERTO: un vértice menos que pares trae el `posList`', () => {
    const pares = TOKENS_POSLIST.length / 2
    const count = Number(porLocal(CP40, 'posList').getAttribute('count'))
    // El fichero declara su propio recuento y coincide con lo que hay: si el
    // Catastro cambiara el fixture, esta línea cae antes que ninguna otra.
    expect(count).toBe(pares)
    expect(parcela.recintos).toHaveLength(1)
    expect(parcela.recintos[0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(parcela.recintos[0].vertices).toHaveLength(pares - 1)
  })

  it('…y el vértice retirado es EXACTAMENTE el de cierre, con su detección INFO', () => {
    const vertices = parcela.recintos[0].vertices
    const primero = [Number(TOKENS_POSLIST[0]), Number(TOKENS_POSLIST[1])]
    const ultimoDelFichero = [
      Number(TOKENS_POSLIST[TOKENS_POSLIST.length - 2]),
      Number(TOKENS_POSLIST[TOKENS_POSLIST.length - 1]),
    ]
    expect(primero).toEqual(ultimoDelFichero) // el fichero venía cerrado
    expect(vertices[0]).toEqual(primero)
    expect(vertices[vertices.length - 1]).not.toEqual(primero)

    const cierres = deTipo(resultado, TIPO_GML.CIERRE_RETIRADO)
    expect(cierres).toHaveLength(1)
    expect(cierres[0].severidad).toBe(SEVERIDAD.INFO)
    expect(cierres[0].datos).toMatchObject({
      antes: TOKENS_POSLIST.length / 2,
      despues: TOKENS_POSLIST.length / 2 - 1,
    })
  })

  it('todos los vértices son pares UTM de números finitos, en el orden del fichero', () => {
    const esperados = []
    for (let i = 0; i < TOKENS_POSLIST.length - 2; i += 2) {
      esperados.push([Number(TOKENS_POSLIST[i]), Number(TOKENS_POSLIST[i + 1])])
    }
    expect(parcela.recintos[0].vertices).toEqual(esperados)
    for (const [x, y] of parcela.recintos[0].vertices) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    }
  })

  it('`areaValue` es el DECLARADO en el fichero, no una superficie recalculada', () => {
    const declarado = Number(textoDe(CP40, 'areaValue'))
    expect(parcela.areaValue).toBe(declarado)
    // Y la prueba de que NO se recalcula: la shoelace de las coordenadas leídas no
    // da exactamente ese entero (el Catastro publica la superficie redondeada).
    const calculada = Math.abs(areaFirmada(parcela.recintos[0].vertices))
    expect(calculada).not.toBe(declarado)
    expect(calculada).toBeCloseTo(declarado, 0)
  })

  it('identificación: refcat, localId, namespace, label y gml:id salen del fichero', () => {
    expect(parcela.refcat).toBe(textoDe(CP40, 'nationalCadastralReference'))
    expect(parcela.localId).toBe(textoDe(CP40, 'localId'))
    expect(parcela.namespaceInspire).toBe(textoDe(CP40, 'namespace'))
    expect(parcela.label).toBe(textoDe(CP40, 'label'))
    expect(parcela.gmlId).toBe(CP40.feature.getAttributeNS(NS.gml, 'id'))
    // El `gml:id` NO es la referencia catastral desnuda (regla de oro 10): el
    // fichero real la lleva prefijada, y parse lo conserva tal cual.
    expect(parcela.gmlId).not.toBe(parcela.refcat)
    expect(parcela.gmlId).toContain(parcela.refcat)
  })

  it('`beginLifespanVersion` va tal cual; el `endLifespanVersion` nulo no se cuela', () => {
    expect(parcela.beginLifespanVersion).toBe(textoDe(CP40, 'beginLifespanVersion'))
    expect(parcela.beginLifespanVersion).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    // `cp:endLifespanVersion` viene con xsi:nil="true": es AUSENCIA declarada y no
    // se confunde con el `beginLifespanVersion`.
    expect(porLocal(CP40, 'endLifespanVersion').getAttributeNS(NS.xsi, 'nil')).toBe('true')
  })

  it('`puntoReferencia` es el `gml:pos` del `cp:referencePoint`, en UTM', () => {
    const esperado = textoDe(CP40, 'pos').split(/\s+/).map(Number)
    expect(parcela.puntoReferencia).toEqual(esperado)
    expect(parcela.puntoReferencia).toHaveLength(2)
  })

  it('`srs` es la forma corta y `srsName` el análisis de la URI OGC del fichero', () => {
    expect(parcela.srsName.valor).toBe(SRSNAME_URI)
    expect(parcela.srsName.coherente).toBe(true)
    expect(SRS_SOPORTADOS).toContain(parcela.srs)
    // La ida y vuelta: la forma corta que devuelve parse regenera el srsName real.
    expect(srsNameUri(parcela.srs)).toBe(SRSNAME_URI)
  })

  it('`orientacion` conserva el signo del fichero: el exterior viene HORARIO (O1)', () => {
    // Hecho VERIFICADO del dossier (override O1): el área firmada del GML real es
    // negativa. Se recomprueba aquí desde las coordenadas leídas, no se afirma.
    expect(areaFirmada(parcela.recintos[0].vertices)).toBeLessThan(0)
    expect(parcela.orientacion).toEqual([-1])
    expect(parcela.orientacion).toHaveLength(parcela.recintos.length)
  })

  it('`nSurfaceMembers` cuenta lo que ve el oráculo', () => {
    const esperado = todos(CP40).filter((e) => e.localName === 'surfaceMember').length
    expect(parcela.nSurfaceMembers).toBe(esperado)
  })

  it('el resumen conserva lo que el serializador necesitará en la ida y vuelta', () => {
    expect(resultado.resumen.wfs).toEqual({
      timeStamp: CP40.raiz.getAttribute('timeStamp'),
      numberMatched: CP40.raiz.getAttribute('numberMatched'),
      numberReturned: CP40.raiz.getAttribute('numberReturned'),
    })
    // Sin convertir a número: `numberMatched` admite el valor 'unknown' y el
    // `timeStamp` se le pasa TAL CUAL al serializador de T4.1.
    expect(typeof resultado.resumen.wfs.timeStamp).toBe('string')
    expect(typeof resultado.resumen.wfs.numberMatched).toBe('string')
  })

  it('`nsDeclarados` son los siete namespaces del 4.0 (los mismos que `NS`)', () => {
    // Oráculo independiente: `gml/_comun.js#NS`, que `comun.test.js` ata a las
    // declaraciones REALES de este fichero.
    expect(new Set(resultado.resumen.nsDeclarados)).toEqual(new Set(Object.values(NS)))
  })

  it('no emite ni un ERROR: un GML del Catastro es un GML bueno', () => {
    expect(resultado.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR)).toEqual([])
    expect(tipos(resultado)).not.toContain(TIPO_GML.ELEMENTO_PROSCRITO)
    expect(tipos(resultado)).not.toContain(TIPO_GML.ORDEN_INESPERADO)
    expect(tipos(resultado)).not.toContain(TIPO_GML.INSPIREID_CON_PREFIJO)
    expect(tipos(resultado)).not.toContain(TIPO_GML.SRS_FORMA_INESPERADA)
  })
})

// ── Definición de hecho 3: el 3.0 se RECHAZA y aun así se LEE ────────────────

describe('gml/parse · UTM_1.gml (CP 3.0) — rechazado, pero con su parcela dentro', () => {
  const resultado = parsearGml(CP30.texto)

  it('dialecto CP_3_0, `soportado:false` y DIALECTO_RECHAZADO de severidad ERROR', () => {
    expect(resultado.dialecto).toBe(DIALECTO.CP_3_0)
    expect(resultado.soportado).toBe(false)
    const rechazos = deTipo(resultado, TIPO_GML.DIALECTO_RECHAZADO)
    expect(rechazos).toHaveLength(1)
    expect(rechazos[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(rechazos[0].mensaje).toMatch(/3\.0/)
    expect(resultado.resumen.bloqueos).toContain(TIPO_GML.DIALECTO_RECHAZADO)
  })

  it('`parcelas` NO viene vacía: F08 tiene que poder enseñarla y reescribirla', () => {
    // Si esto se rompiera, el recorrido «tu GML es de 2015, aquí está tu parcela,
    // te la paso a 4.0» dejaría de existir. Es el motivo entero de la decisión.
    expect(resultado.parcelas).toHaveLength(1)
    expect(resultado.parcelas[0].recintos).toHaveLength(1)
  })

  it('el anillo del 3.0 también sale abierto, con su CIERRE_RETIRADO', () => {
    const tokens = CP30.texto
      .match(/<gml:posList[^>]*>([^<]*)<\/gml:posList>/)[1]
      .trim()
      .split(/\s+/)
    expect(resultado.parcelas[0].recintos[0].vertices).toHaveLength(tokens.length / 2 - 1)
    expect(deTipo(resultado, TIPO_GML.CIERRE_RETIRADO)).toHaveLength(1)
  })

  it('emite INSPIREID_CON_PREFIJO: el `base:Identifier` es de base 3.2 (O4)', () => {
    const avisos = deTipo(resultado, TIPO_GML.INSPIREID_CON_PREFIJO)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].datos.prefijo).toBe(porLocal(CP30, 'Identifier').prefix)
    expect(avisos[0].datos.esperado).toBe(NS.base33)
  })

  it('…y aun así lee `localId` y `namespace`, que van con prefijo `base:`', () => {
    expect(resultado.parcelas[0].localId).toBe(textoDe(CP30, 'localId'))
    expect(resultado.parcelas[0].namespaceInspire).toBe(textoDe(CP30, 'namespace'))
  })

  it('el `srsName` en URN se aprovecha (da huso) y NO se avisa de la forma: es su forma nativa', () => {
    expect(resultado.parcelas[0].srsName.valor).toBe(SRSNAME_URN)
    expect(resultado.parcelas[0].srsName.coherente).toBe(false)
    expect(resultado.parcelas[0].srs).toBe(`EPSG:${resultado.parcelas[0].srsName.codigo}`)
    // La URN es la forma del 3.0 y del edificio (O10): avisar aquí sería ruido
    // sobre un fichero que ya se ha señalado entero con DIALECTO_RECHAZADO.
    expect(tipos(resultado)).not.toContain(TIPO_GML.SRS_FORMA_INESPERADA)
  })

  it('distingue «elemento vacío» de «elemento ausente»', () => {
    // El 3.0 deja `cp:label` y `cp:nationalCadastralReference` VACÍOS a propósito
    // (la parcela aún no está de alta): eso es '' y no `null`, que significaría
    // que el elemento no está. Y `beginLifespanVersion` viene con xsi:nil.
    expect(porLocal(CP30, 'label').textContent).toBe('')
    expect(resultado.parcelas[0].label).toBe('')
    expect(resultado.parcelas[0].refcat).toBe('')
    expect(porLocal(CP30, 'beginLifespanVersion').getAttributeNS(NS.xsi, 'nil')).toBe('true')
    expect(resultado.parcelas[0].beginLifespanVersion).toBeNull()
    // Y lo que de verdad NO está, sale null.
    expect(porLocal(CP30, 'referencePoint')).toBeNull()
    expect(resultado.parcelas[0].puntoReferencia).toBeNull()
  })
})

// ── Definición de hecho 4: el edificio es OTRO TEMA ─────────────────────────

describe('gml/parse · bu_*.gml (edificio) — otro tema, no un fichero equivocado', () => {
  const EDIFICIOS = ANALISIS.filter((a) => dialectoDe(a).id === DIALECTO.BU)

  it('el disco trae GML de edificio con los que probarlo', () => {
    expect(EDIFICIOS.length).toBeGreaterThan(0)
  })

  it('salen como BU, con `parcelas:[]` y sin excepción', () => {
    for (const a of EDIFICIOS) {
      const r = parsear(a)
      expect(r.dialecto, a.nombre).toBe(DIALECTO.BU)
      expect(r.soportado, a.nombre).toBe(false)
      expect(r.parcelas, a.nombre).toEqual([])
    }
  })

  it('emiten DIALECTO_OTRO_TEMA/ERROR y NUNCA DIALECTO_RECHAZADO', () => {
    for (const a of EDIFICIOS) {
      const r = parsear(a)
      const otro = deTipo(r, TIPO_GML.DIALECTO_OTRO_TEMA)
      expect(otro, a.nombre).toHaveLength(1)
      expect(otro[0].severidad).toBe(SEVERIDAD.ERROR)
      expect(otro[0].mensaje).toMatch(/EDIFICIO/)
      // No es «una parcela mal hecha»: el mensaje y el tipo son otros.
      expect(tipos(r), a.nombre).not.toContain(TIPO_GML.DIALECTO_RECHAZADO)
      expect(tipos(r), a.nombre).not.toContain(TIPO_GML.RAIZ_INESPERADA)
    }
  })

  it('no se inventa geometría de un Building aunque el fichero tenga posList', () => {
    for (const a of EDIFICIOS) {
      expect(todos(a).some((e) => e.localName === 'posList'), a.nombre).toBe(true)
      expect(parsear(a).parcelas, a.nombre).toEqual([])
    }
  })
})

// ── Definición de hecho 6: ficheros rotos → detecciones, nunca excepción ─────

describe('gml/parse · un fichero malo produce DETECCIONES, jamás una excepción', () => {
  it('XML vacío', () => {
    const r = parsearGml('')
    expect(r.dialecto).toBe(DIALECTO.DESCONOCIDO)
    expect(r.parcelas).toEqual([])
    expect(tipos(r)).toContain(TIPO_GML.XML_MAL_FORMADO)
    expect(r.resumen.raiz).toBeNull()
  })

  it('XML mal formado (etiquetas que no casan), con línea y columna', () => {
    const r = parsearGml('<a><b></a>')
    const errores = deTipo(r, TIPO_GML.XML_MAL_FORMADO)
    expect(errores.length).toBeGreaterThan(0)
    expect(errores[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(errores[0].datos.linea).toBe(1)
    expect(typeof errores[0].datos.columna).toBe('number')
    expect(errores[0].mensaje).toMatch(/Línea 1, columna/)
  })

  it('`<foo/>`: raíz ajena → RAIZ_INESPERADA con el (ns, local) observado', () => {
    const r = parsearGml('<foo/>')
    expect(r.dialecto).toBe(DIALECTO.DESCONOCIDO)
    expect(r.soportado).toBe(false)
    expect(r.parcelas).toEqual([])
    const raices = deTipo(r, TIPO_GML.RAIZ_INESPERADA)
    expect(raices).toHaveLength(1)
    expect(raices[0].datos).toMatchObject({ ns: '', local: 'foo' })
    expect(r.resumen.raiz).toEqual({ ns: '', local: 'foo' })
  })

  it('un DOCTYPE se rechaza a propósito (defensa de gml/xml.js) y sale como detección', () => {
    const r = parsearGml(`<!DOCTYPE foo>${CP40.texto}`)
    expect(deTipo(r, TIPO_GML.XML_MAL_FORMADO).length).toBeGreaterThan(0)
    expect(r.parcelas).toEqual([])
  })

  it('un fichero con MUCHOS errores no sepulta el informe: se topan y se dice', () => {
    const r = parsearGml(`<a>${'&'.repeat(MAX_ERRORES_XML + 5)}</a>`)
    const errores = deTipo(r, TIPO_GML.XML_MAL_FORMADO)
    expect(errores).toHaveLength(MAX_ERRORES_XML + 1)
    expect(errores[errores.length - 1].datos).toMatchObject({ detallados: MAX_ERRORES_XML })
    expect(errores[errores.length - 1].mensaje).toMatch(/no se detallan/)
  })

  it('basura que ni es XML tampoco lanza', () => {
    for (const malo of ['no soy xml', '{"json":true}', '<<<', ' ']) {
      expect(() => parsearGml(malo), JSON.stringify(malo)).not.toThrow()
      expect(parsearGml(malo).parcelas, JSON.stringify(malo)).toEqual([])
    }
  })
})

// ── Estructura: miembros, caras y elementos que hacen rechazar ───────────────

describe('gml/parse · miembros: cero, uno, varios', () => {
  it('una FeatureCollection sin miembros → SIN_MIEMBROS/ERROR', () => {
    const r = parsearGml(CP40.texto.replace(BLOQUE_MEMBER, ''))
    expect(r.dialecto).toBe(DIALECTO.CP_4_0)
    expect(r.parcelas).toEqual([])
    expect(r.resumen.nMiembros).toBe(0)
    expect(deTipo(r, TIPO_GML.SIN_MIEMBROS)).toHaveLength(1)
  })

  it('varias parcelas: se devuelven TODAS y se avisa — el llamante elige', () => {
    const r = parsearGml(CP40.texto.replace(BLOQUE_MEMBER, `${BLOQUE_MEMBER}\n${BLOQUE_MEMBER}`))
    expect(r.resumen.nMiembros).toBe(2)
    expect(r.parcelas).toHaveLength(2)
    expect(r.parcelas[0]).toEqual(r.parcelas[1])
    const avisos = deTipo(r, TIPO_GML.VARIOS_MIEMBROS)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(avisos[0].datos.miembros).toBe(2)
    // AVISO y no ERROR: varias parcelas no bloquean nada, solo hay que elegir.
    expect(r.resumen.bloqueos).not.toContain(TIPO_GML.VARIOS_MIEMBROS)
  })

  it('las detecciones de cada parcela llevan su índice de miembro', () => {
    const r = parsearGml(CP40.texto.replace(BLOQUE_MEMBER, `${BLOQUE_MEMBER}\n${BLOQUE_MEMBER}`))
    const cierres = deTipo(r, TIPO_GML.CIERRE_RETIRADO)
    expect(cierres.map((d) => d.datos.miembro)).toEqual([0, 1])
  })

  it('un `member` que no lleva un CadastralParcel dentro se señala y se salta', () => {
    const r = parsearGml(CP40.texto.replaceAll('cp:CadastralParcel', 'cp:CadastralZoning'))
    expect(r.parcelas).toEqual([])
    const raices = deTipo(r, TIPO_GML.RAIZ_INESPERADA)
    expect(raices).toHaveLength(1)
    expect(raices[0].datos.local).toBe('CadastralZoning')
  })
})

describe('gml/parse · una parcela es UNA cara con sus huecos', () => {
  it('dos `gml:surfaceMember` → MULTIPLES_CARAS/ERROR, y se lee el primero', () => {
    const sm = CP40.texto.match(/<gml:surfaceMember>[\s\S]*?<\/gml:surfaceMember>/)[0]
    const r = parsearGml(CP40.texto.replace(sm, `${sm}\n${sm}`))
    const caras = deTipo(r, TIPO_GML.MULTIPLES_CARAS)
    expect(caras).toHaveLength(1)
    expect(caras[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(r.parcelas[0].nSurfaceMembers).toBe(2)
    expect(r.parcelas[0].recintos).toHaveLength(1)
  })

  it('dos `cp:geometry` → MULTIPLES_CARAS: no se elige una por el usuario', () => {
    const geo = CP40.texto.match(/<cp:geometry>[\s\S]*?<\/cp:geometry>/)[0]
    const r = parsearGml(CP40.texto.replace(geo, `${geo}\n${geo}`))
    expect(deTipo(r, TIPO_GML.MULTIPLES_CARAS)).toHaveLength(1)
    expect(r.parcelas[0].recintos).toEqual([])
    expect(r.parcelas[0].orientacion).toEqual([])
  })

  it('sin `cp:geometry` no hay coordenadas, y se dice', () => {
    const geo = CP40.texto.match(/<cp:geometry>[\s\S]*?<\/cp:geometry>/)[0]
    const r = parsearGml(CP40.texto.replace(geo, ''))
    expect(deTipo(r, TIPO_GML.POSLIST_INVALIDA)).toHaveLength(1)
    expect(r.parcelas[0].recintos).toEqual([])
    // El resto de campos se leen igual: un fichero roto sigue siendo informativo.
    expect(r.parcelas[0].refcat).toBe(textoDe(CP40, 'nationalCadastralReference'))
  })

  it('un hueco (`gml:interior`) entra como recinto HUECO detrás del exterior', () => {
    const exterior = CP40.texto.match(/<gml:exterior>[\s\S]*?<\/gml:exterior>/)[0]
    const interior = exterior.replace('gml:exterior', 'gml:interior').replace(
      '</gml:exterior>',
      '</gml:interior>',
    )
    const r = parsearGml(CP40.texto.replace(exterior, `${exterior}\n${interior}`))
    expect(r.parcelas[0].recintos.map((x) => x.tipo)).toEqual([
      TIPO_RECINTO.EXTERIOR,
      TIPO_RECINTO.HUECO,
    ])
    expect(r.parcelas[0].orientacion).toHaveLength(2)
    expect(deTipo(r, TIPO_GML.CIERRE_RETIRADO)).toHaveLength(2)
  })
})

describe('gml/parse · lo que hace RECHAZAR un GML ajeno (F08)', () => {
  it('un elemento proscrito se señala, y el mensaje NO miente sobre el XSD', () => {
    const proscrito = ELEMENTOS_PROSCRITOS_CP40[0].local
    const r = parsearGml(
      CP40.texto.replace('<cp:areaValue', `<gml:${proscrito}/><cp:areaValue`),
    )
    const avisos = deTipo(r, TIPO_GML.ELEMENTO_PROSCRITO)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].datos.local).toBe(proscrito)
    // El dato MEDIDO contra el XSD oficial: el esquema los ADMITE; quien los
    // rechaza es el checklist del IVG. Si el mensaje dijera «invalida contra el
    // XSD», quien ejecutara `npm run validar:xsd` lo vería pasar y concluiría que
    // el guardián está roto.
    expect(avisos[0].mensaje).toMatch(/ADMITE/)
    expect(avisos[0].mensaje).toMatch(/IVG/)
  })

  it('los hijos fuera del orden XSD se señalan (override O5)', () => {
    const label = CP40.texto.match(/<cp:label>[^<]*<\/cp:label>\s*/)[0]
    const r = parsearGml(CP40.texto.replace(label, '').replace('<cp:areaValue', `${label}<cp:areaValue`))
    const avisos = deTipo(r, TIPO_GML.ORDEN_INESPERADO)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].datos.observado[0]).toBe('label')
    expect(avisos[0].datos.esperado).toEqual(
      ORDEN_CADASTRAL_PARCEL.filter((l) => avisos[0].datos.observado.includes(l)),
    )
  })

  it('un elemento AJENO al orden conocido no cuenta como desorden', () => {
    // `ORDEN_CADASTRAL_PARCEL` es un PREFIJO de la secuencia real de trece
    // elementos: un fichero con `validFrom` no está mal ordenado por traerlo, y
    // afirmarlo sería un falso positivo en la cara del técnico.
    const fuera = 'cp:basicPropertyUnit'
    expect(ORDEN_CADASTRAL_PARCEL).not.toContain('basicPropertyUnit')
    const r = parsearGml(CP40.texto.replace('<cp:areaValue', `<${fuera}/><cp:areaValue`))
    expect(tipos(r)).not.toContain(TIPO_GML.ORDEN_INESPERADO)
  })
})

// ── Sistema de referencia ────────────────────────────────────────────────────

describe('gml/parse · srsName: forma, soporte y coherencia', () => {
  it('la URN en un 4.0 → SRS_FORMA_INESPERADA/AVISO, y el huso se aprovecha igual', () => {
    // La URN se toma del OTRO fichero del disco, no se teclea.
    const r = parsearGml(CP40.texto.replaceAll(SRSNAME_URI, SRSNAME_URN))
    const avisos = deTipo(r, TIPO_GML.SRS_FORMA_INESPERADA)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(r.parcelas[0].srs).toBe(parsearGml(CP40.texto).parcelas[0].srs)
    expect(r.resumen.bloqueos).not.toContain(TIPO_GML.SRS_FORMA_INESPERADA)
  })

  it('la forma corta `EPSG:25830` en un 4.0 también avisa', () => {
    const corto = `EPSG:${SRSNAME_URI.match(/\d+$/)[0]}`
    const r = parsearGml(CP40.texto.replaceAll(SRSNAME_URI, corto))
    expect(deTipo(r, TIPO_GML.SRS_FORMA_INESPERADA)).toHaveLength(1)
    expect(r.parcelas[0].srs).toBe(corto)
  })

  it('EPSG:4326 → SRS_NO_SOPORTADO/ERROR, y el mensaje dice POR QUÉ (ejes invertidos)', () => {
    const r = parsearGml(CP40.texto.replaceAll(SRSNAME_URI, SRSNAME_URI.replace(/\d+$/, '4326')))
    const errores = deTipo(r, TIPO_GML.SRS_NO_SOPORTADO)
    expect(errores).toHaveLength(1)
    expect(errores[0].severidad).toBe(SEVERIDAD.ERROR)
    // El motivo no es «no está en la lista»: es que su `posList` va (lat, lon) y
    // leerlo como [x, y] metería la latitud en el Este del modelo, violando de
    // raíz la regla de oro 3.
    expect(errores[0].mensaje).toMatch(/LATITUD, LONGITUD/)
    expect(errores[0].mensaje).toMatch(/regla de oro 3/)
    expect(r.parcelas[0].srs).toBeNull()
    expect(r.resumen.bloqueos).toContain(TIPO_GML.SRS_NO_SOPORTADO)
  })

  it('EPSG:32628 (Canarias) → SRS_NO_SOPORTADO nombrando que está DIFERIDA (O13)', () => {
    const r = parsearGml(CP40.texto.replaceAll(SRSNAME_URI, SRSNAME_URI.replace(/\d+$/, '32628')))
    const errores = deTipo(r, TIPO_GML.SRS_NO_SOPORTADO)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/DIFERIDA/)
    expect(errores[0].datos.codigo).toBe(32628)
  })

  it('un `srsName` sin código EPSG reconocible → SRS_NO_SOPORTADO, no una excepción', () => {
    const r = parsearGml(CP40.texto.replaceAll(SRSNAME_URI, 'WGS84 a ojo'))
    expect(deTipo(r, TIPO_GML.SRS_NO_SOPORTADO)).toHaveLength(1)
    expect(r.parcelas[0].srs).toBeNull()
    expect(r.parcelas[0].srsName.codigo).toBeNull()
  })

  it('dos `srsName` distintos en la misma parcela → SRS_INCOHERENTE/ERROR y `srs:null`', () => {
    // Se cambia SOLO el último (el del `gml:Point` del referencePoint): sin esta
    // comprobación, parse se quedaría con el primero y F08 diagnosticaría en el
    // huso equivocado sin que nadie se enterase.
    const otro = SRSNAME_URI.replace(/\d+$/, '25831')
    const r = parsearGml(reemplazarUltimo(CP40.texto, SRSNAME_URI, otro))
    const errores = deTipo(r, TIPO_GML.SRS_INCOHERENTE)
    expect(errores).toHaveLength(1)
    expect(errores[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(errores[0].datos.valores).toEqual([SRSNAME_URI, otro])
    expect(r.parcelas[0].srs).toBeNull()
  })

  it('sin ningún `srsName` → SRS_AUSENTE/ERROR (no se supone el huso 30)', () => {
    const r = parsearGml(CP40.texto.replaceAll(` srsName="${SRSNAME_URI}"`, ''))
    expect(deTipo(r, TIPO_GML.SRS_AUSENTE)).toHaveLength(1)
    expect(r.parcelas[0].srs).toBeNull()
    expect(r.parcelas[0].srsName).toBeNull()
    // Y la geometría se lee igual: el anillo está, aunque no se sepa en qué CRS.
    expect(r.parcelas[0].recintos).toHaveLength(1)
  })
})

// ── posList: la lista de coordenadas ────────────────────────────────────────

describe('gml/parse · gml:posList', () => {
  it('un número impar de valores → POSLIST_INVALIDA/ERROR', () => {
    const r = parsearGml(conPosList(TOKENS_POSLIST.slice(0, -1), 'srsDimension="2"'))
    const errores = deTipo(r, TIPO_GML.POSLIST_INVALIDA)
    expect(errores).toHaveLength(1)
    expect(errores[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(r.parcelas[0].recintos).toEqual([])
  })

  it('un token que no es número → POSLIST_INVALIDA, y lo cita', () => {
    const tokens = [...TOKENS_POSLIST]
    tokens[0] = 'cuatrocientos'
    const r = parsearGml(conPosList(tokens))
    const errores = deTipo(r, TIPO_GML.POSLIST_INVALIDA)
    expect(errores).toHaveLength(1)
    expect(errores[0].datos.malos).toContain('cuatrocientos')
  })

  it('formas que `Number` acepta pero GML no (hex, Infinity) NO se cuelan', () => {
    for (const veneno of ['0x1A', 'Infinity', '1_0', 'NaN']) {
      const tokens = [...TOKENS_POSLIST]
      tokens[0] = veneno
      const r = parsearGml(conPosList(tokens))
      expect(deTipo(r, TIPO_GML.POSLIST_INVALIDA), veneno).toHaveLength(1)
      expect(r.parcelas[0].recintos, veneno).toEqual([])
    }
  })

  it('un `count` que no cuadra con los pares → COUNT_DISCREPANTE/AVISO (manda la lista)', () => {
    const pares = TOKENS_POSLIST.length / 2
    const r = parsearGml(conPosList(TOKENS_POSLIST, `srsDimension="2" count="${pares + 7}"`))
    const avisos = deTipo(r, TIPO_GML.COUNT_DISCREPANTE)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(avisos[0].datos).toMatchObject({ count: String(pares + 7), pares })
    // La lista manda: los vértices salen igual (abiertos).
    expect(r.parcelas[0].recintos[0].vertices).toHaveLength(pares - 1)
  })

  it('`srsDimension` distinto de 2 → SRS_DIMENSION_INESPERADA/AVISO', () => {
    const r = parsearGml(conPosList(TOKENS_POSLIST, 'srsDimension="3"'))
    const avisos = deTipo(r, TIPO_GML.SRS_DIMENSION_INESPERADA)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(avisos[0].datos.srsDimension).toBe('3')
  })

  it('un anillo que NO cierra → ANILLO_NO_CERRADO/ERROR, y no se cierra solo', () => {
    const sinCierre = TOKENS_POSLIST.slice(0, -2)
    const r = parsearGml(conPosList(sinCierre))
    const errores = deTipo(r, TIPO_GML.ANILLO_NO_CERRADO)
    expect(errores).toHaveLength(1)
    expect(errores[0].severidad).toBe(SEVERIDAD.ERROR)
    // Los vértices se devuelven TAL CUAL: añadir la arista de cierre sería
    // inventar geometría que el fichero no declara.
    expect(r.parcelas[0].recintos[0].vertices).toHaveLength(sinCierre.length / 2)
    expect(tipos(r)).not.toContain(TIPO_GML.CIERRE_RETIRADO)
  })

  it('un `posList` vacío no revienta: se dice que no forma pares', () => {
    const r = parsearGml(conPosList([], 'srsDimension="2"'))
    expect(deTipo(r, TIPO_GML.POSLIST_INVALIDA)).toHaveLength(1)
    expect(r.parcelas[0].recintos).toEqual([])
  })
})

// ── Orientación: el dato que hace posible el diagnóstico de F08 ──────────────

describe('gml/parse · orientacion — se conserva, NO se normaliza', () => {
  it('invertir el orden de los vértices en el fichero invierte el signo', () => {
    // Si parse reorientara al vuelo (override O1: exterior horario), este test
    // daría el mismo signo en los dos casos… y el diagnóstico «tu exterior está
    // antihorario» de F08 sería imposible de dar, porque el dato ya no estaría.
    const pares = []
    for (let i = 0; i < TOKENS_POSLIST.length; i += 2) {
      pares.push([TOKENS_POSLIST[i], TOKENS_POSLIST[i + 1]])
    }
    const invertidos = [...pares].reverse().flat()
    const original = parsearGml(CP40.texto).parcelas[0]
    const alReves = parsearGml(conPosList(invertidos)).parcelas[0]

    expect(original.orientacion).toEqual([-1])
    expect(alReves.orientacion).toEqual([1])
    // Y es el MISMO polígono: mismos vértices, en orden inverso.
    expect([...alReves.recintos[0].vertices].reverse()).toEqual([
      ...original.recintos[0].vertices.slice(1),
      original.recintos[0].vertices[0],
    ])
  })

  it('`orientacion` tiene un signo por recinto, siempre −1 o +1', () => {
    for (const a of ANALISIS) {
      for (const p of parsear(a).parcelas) {
        expect(p.orientacion, a.nombre).toHaveLength(p.recintos.length)
        for (const s of p.orientacion) expect([-1, 1], a.nombre).toContain(s)
      }
    }
  })
})

// ── tolerarPolygon ──────────────────────────────────────────────────────────

describe('gml/parse · tolerarPolygon', () => {
  /** El mismo fixture con la geometría escrita como `gml:Polygon` directo. */
  const CON_POLYGON = CP40.texto
    .replace('<gml:Surface ', '<gml:Polygon ')
    .replace('</gml:Surface>', '</gml:Polygon>')
    .replace('<gml:patches>', '')
    .replace('</gml:patches>', '')
    .replace('<gml:PolygonPatch>', '')
    .replace('</gml:PolygonPatch>', '')

  it('la mutación es real: el fichero ya no tiene Surface/patches/PolygonPatch', () => {
    expect(CON_POLYGON).toContain('<gml:Polygon ')
    expect(CON_POLYGON).not.toContain('<gml:patches>')
    expect(CON_POLYGON).not.toContain('<gml:PolygonPatch>')
  })

  it('por defecto (true) se acepta y da EXACTAMENTE la misma parcela', () => {
    const conPolygon = parsearGml(CON_POLYGON).parcelas[0]
    const canonico = parsearGml(CP40.texto).parcelas[0]
    expect(conPolygon.recintos).toEqual(canonico.recintos)
    expect(conPolygon.srs).toBe(canonico.srs)
    expect(conPolygon.orientacion).toEqual(canonico.orientacion)
  })

  it('con `tolerarPolygon:false` se rechaza POR ESCRITO, no en silencio', () => {
    const r = parsearGml(CON_POLYGON, { tolerarPolygon: false })
    const errores = deTipo(r, TIPO_GML.POSLIST_INVALIDA)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/tolerarPolygon/)
    expect(r.parcelas[0].recintos).toEqual([])
  })
})

// ── El informe: detecciones, recuentos y bloqueos ────────────────────────────

describe('gml/parse · el informe es coherente consigo mismo', () => {
  const TODOS = [
    ...ANALISIS.map((a) => ({ nombre: a.nombre, r: parsear(a) })),
    { nombre: 'vacío', r: parsearGml('') },
    { nombre: '<foo/>', r: parsearGml('<foo/>') },
    { nombre: 'sin miembros', r: parsearGml(CP40.texto.replace(BLOQUE_MEMBER, '')) },
    { nombre: 'posList impar', r: parsearGml(conPosList(TOKENS_POSLIST.slice(0, -1))) },
    { nombre: '4326', r: parsearGml(CP40.texto.replaceAll(SRSNAME_URI, SRSNAME_URI.replace(/\d+$/, '4326'))) },
  ]

  it('todo `tipo` emitido está en el catálogo TIPO_GML y toda severidad, en SEVERIDAD', () => {
    for (const { nombre, r } of TODOS) {
      for (const d of r.detecciones) {
        expect(Object.values(TIPO_GML), `${nombre}: ${d.tipo}`).toContain(d.tipo)
        expect(Object.values(SEVERIDAD), `${nombre}: ${d.severidad}`).toContain(d.severidad)
        expect(d.mensaje.length, `${nombre}: ${d.tipo} con mensaje corto`).toBeGreaterThan(20)
      }
    }
  })

  it('los recuentos del resumen cuadran con la lista de detecciones', () => {
    for (const { nombre, r } of TODOS) {
      const { total, porTipo, porSeveridad } = r.resumen.detecciones
      expect(total, nombre).toBe(r.detecciones.length)
      for (const [tipo, n] of Object.entries(porTipo)) {
        expect(deTipo(r, tipo).length, `${nombre}/${tipo}`).toBe(n)
      }
      for (const [sev, n] of Object.entries(porSeveridad)) {
        expect(r.detecciones.filter((d) => d.severidad === sev).length, `${nombre}/${sev}`).toBe(n)
      }
    }
  })

  it('`bloqueos` son EXACTAMENTE los tipos de severidad ERROR, sin repetir', () => {
    // Derivados de las propias detecciones y no de una lista a mano: así no puede
    // haber un ERROR que no bloquee ni un bloqueo sin su explicación al lado.
    for (const { nombre, r } of TODOS) {
      const esperado = [
        ...new Set(r.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo)),
      ]
      expect(r.resumen.bloqueos, nombre).toEqual(esperado)
    }
  })

  it('la forma del resultado es siempre la misma, pase lo que pase', () => {
    for (const { nombre, r } of TODOS) {
      expect(Object.keys(r).sort(), nombre).toEqual(
        ['detecciones', 'dialecto', 'parcelas', 'resumen', 'soportado'].sort(),
      )
      expect(Object.keys(r.resumen).sort(), nombre).toEqual(
        [
          'bloqueos',
          'detecciones',
          'dialecto',
          'encodingDeclarado',
          'nMiembros',
          'nsDeclarados',
          'raiz',
          'wfs',
        ].sort(),
      )
      expect(Array.isArray(r.parcelas), nombre).toBe(true)
      expect(typeof r.soportado, nombre).toBe('boolean')
    }
  })

  it('toda ParcelaGml devuelta tiene las mismas claves y es POJO plano', () => {
    const claves = [
      'areaValue',
      'beginLifespanVersion',
      'gmlId',
      'label',
      'localId',
      'nSurfaceMembers',
      'namespaceInspire',
      'orientacion',
      'puntoReferencia',
      'recintos',
      'refcat',
      'srs',
      'srsName',
    ].sort()
    for (const { nombre, r } of TODOS) {
      for (const p of r.parcelas) {
        expect(Object.keys(p).sort(), nombre).toEqual(claves)
        // POJO plano de verdad: sobrevive a structuredClone (undo/redo, regla 4).
        expect(structuredClone(p), nombre).toEqual(p)
        // Y sin lat/lon por ningún lado (regla de oro 3).
        expect(JSON.stringify(p), nombre).not.toMatch(/"(lat|lon|latitud|longitud)"/)
      }
    }
  })
})

// ── Guardián: `gml/parse.js` no lee el reloj ────────────────────────────────

describe('gml/parse · el módulo es función PURA de su entrada', () => {
  it('no instancia fechas propias ni consulta la marca de tiempo del sistema', () => {
    // La reproducibilidad del test de ida y vuelta de F04 (un GML entero contra
    // snapshot) depende de que `gml/` no dependa del momento en que se ejecuta.
    // Se comprueba sobre el TEXTO del módulo, que es donde se ve.
    const fuente = readFileSync(join(RAIZ, 'gml', 'parse.js'), 'utf8')
    const INSTANCIA_FECHA = /\bnew\s+Date\b/
    const RELOJ = /\bDate\s*\.\s*now\b/
    expect(INSTANCIA_FECHA.test(fuente), 'gml/parse.js instancia una fecha propia').toBe(false)
    expect(RELOJ.test(fuente), 'gml/parse.js consulta el reloj del sistema').toBe(false)
    // …y los detectores no son vacuos.
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date.now()')).toBe(true)
  })
})
