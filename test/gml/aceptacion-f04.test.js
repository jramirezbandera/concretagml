/* -------------------------------------------------------------------------- *
 * test/gml/aceptacion-f04.test.js — F04 · T4.1 · SUITE DE ACEPTACIÓN            *
 *                                                                               *
 * La prueba que decide si F04 vale: se lee el GML REAL del WFS del Catastro,    *
 * se pasa por `gml/parse.js`, se vuelve a escribir con `gml/serialize-cp.js` y  *
 * se exige que el resultado sea EL MISMO DOCUMENTO. Todo lo demás de esta       *
 * suite cuelga de ahí.                                                          *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LA REGLA QUE GOBIERNA ESTE FICHERO                                            *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LA COMPARACIÓN NO COMPARTE CÓDIGO CON LO QUE COMPARA. El fixture y nuestra    *
 * salida se parsean con jsdom (`new JSDOM('').window.DOMParser`), NUNCA con     *
 * `gml/xml.js`. Si el lector y el escritor de la casa tuvieran un error de      *
 * concepto simétrico —leen mal y escriben igual de mal—, un round-trip que      *
 * usara `gml/xml.js` en los dos lados saldría VERDE. Es el mismo razonamiento   *
 * por el que `proj4` audita a `geo/utm.js` en                                   *
 * `test/geo/utm-control.factory.test.js`. La normalización vive en              *
 * `test/gml/_canonico.js`, que tampoco importa nada de `gml/`.                  *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS CUATRO ASERCIONES DEL AC1, Y POR QUÉ EL SNAPSHOT VA EL CUARTO             *
 * ════════════════════════════════════════════════════════════════════════════ *
 *   1. La serialización no produce ninguna detección de severidad ERROR.        *
 *   2. `canonico(salida)` toEqual `canonico(fixture)`: la igualdad de verdad.   *
 *   3. Los doce guardianes (abajo).                                             *
 *   4. `toMatchFileSnapshot('__snapshots__/parcela.gml')`.                      *
 *                                                                               *
 * El snapshot va EL CUARTO, no el primero, y no es la aserción del AC1: un      *
 * snapshot solo está a un `-u` de no significar nada, así que no puede sostener *
 * un criterio de aceptación. Lo que aporta es otra cosa y también hace falta:   *
 * cualquier cambio de BYTES —incluidos los que la canonicalización ignora a     *
 * propósito, como el orden de los atributos o los ceros del `posList`— aparece  *
 * como un diff legible en la revisión en vez de pasar callado.                  *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * MAPA DE LOS SEIS CRITERIOS DE ACEPTACIÓN DE `spec/feature-04-gml-parcela.md`  *
 * ════════════════════════════════════════════════════════════════════════════ *
 *   AC1 · ida y vuelta + snapshot ....... § «AC1» (las cuatro aserciones)       *
 *   AC2 · orientación (O1) .............. guardián 5                            *
 *   AC3 · areaValue == |shoelace| ....... guardián 7                            *
 *   AC4 · raíz + srsName + inspireId +                                          *
 *         orden XSD + sin proscritos .... guardianes 1, 2, 3 y 6 JUNTOS.        *
 *         La mitad «inspireId en base 3.3 SIN prefijo `base:`» la cubre la      *
 *         igualdad canónica del AC1: el `<Identifier>` del fixture va sin       *
 *         prefijo y con su `xmlns` propio, y `canonico` compara los nombres     *
 *         cualificados y el conjunto `{prefijo → URI}` de forma EXACTA. Si      *
 *         emitiéramos `base:Identifier`, la aserción 2 caería.                  *
 *   AC5 · gml:id por letra + punto                                              *
 *         dentro ....................... guardianes 4 y 8                       *
 *   AC6 · validación de esquema ......... NO ES DE ESTA SUITE. Lo cubre         *
 *         `npm run validar:xsd` (script aparte, opcional, contra el             *
 *         `CadastralParcels.xsd` de cp 4.0). Aquí no se simula.                 *
 *                                                                               *
 * Los guardianes 9, 10, 11 y 12 no mapean a un AC: salen del checklist de       *
 * ERRORES QUE PRODUCEN RECHAZO de la spec (anillo no cerrado o <4 puntos,       *
 * `count` mal contado, encoding declarado ≠ bytes reales, dialecto 3.0).        *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LOS GUARDIANES: DERIVADOS, Y CON PRUEBA DE QUE DISPARAN                       *
 * ════════════════════════════════════════════════════════════════════════════ *
 * Ninguno afirma un valor escrito a mano: todos salen de leer los ficheros de   *
 * `test/fixtures/gml/` (regla de oro 8). Y cada uno tiene DOS mitades: que      *
 * pasa sobre la salida buena, y que SE PONE ROJO sobre una salida mutada por    *
 * cirugía de string. Sin la segunda mitad un guardián es una promesa, no una    *
 * prueba — y esta suite ya ha visto en F03 lo que es un guardián que nunca      *
 * dispara.                                                                      *
 *                                                                               *
 * Para LEER los doce mensajes de disparo sin tocar una línea de código:         *
 *   F04_VER_DISPAROS=1 npm run test:node -- test/gml/aceptacion-f04.test.js     *
 * Cada uno debe nombrar SU invariante. Si alguno dijera «no pudo parsear», la   *
 * cirugía habría roto el XML y el disparo no probaría nada: hay una aserción en *
 * `seVuelveRojo` que lo impide.                                                 *
 *                                                                               *
 * El GML del Catastro es un caso feliz —convexo, ya horario y SIN huecos—, así  *
 * que la mitad «cada gml:interior va antihorario» del guardián 5 y la resta de  *
 * huecos del 7 no se ejercitarían nunca. Por eso el § 6 vuelve a pasar los once *
 * guardianes de documento sobre una parcela CON HUECO derivada del propio       *
 * fixture (su contorno encogido hacia su punto de referencia).                  *
 *                                                                               *
 * ⚠️ SOBRE EL GUARDIÁN 6 Y EL XSD. Comprobado contra el esquema oficial: el     *
 * XSD **ADMITE** `validFrom`, `validTo` y `zoning` (siguen en la secuencia de   *
 * `CadastralParcelType` con `minOccurs="0"`) y `gml:boundedBy` (heredado de     *
 * `gml:AbstractFeatureType`). Quien los rechaza es el IVG por REGLA DE NEGOCIO, *
 * no el validador de esquema. Por eso ni el nombre del guardián ni sus mensajes *
 * dicen que «invalidan contra el esquema»: sería falso, y despistaría a quien   *
 * ejecute `npm run validar:xsd` y los vea pasar en verde. Por lo mismo,         *
 * `ORDEN_CADASTRAL_PARCEL` es un PREFIJO de la secuencia real de 13 elementos.  *
 *                                                                               *
 * Proyecto Vitest `node`: aquí jsdom es un LECTOR de XML, no el entorno.        *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import booleanClockwise from '@turf/boolean-clockwise'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon } from '@turf/helpers'

import { canonico } from './_canonico.js'
import { parsearGml } from '../../gml/parse.js'
import { serializarParcelaCp } from '../../gml/serialize-cp.js'
import {
  DIALECTO,
  DIALECTOS,
  ELEMENTOS_PROSCRITOS_CP40,
  SEVERIDAD,
  TIPO_GML,
} from '../../gml/_comun.js'
import { areaFirmada } from '../../geo/area.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Lectura de los ficheros y utilidades de DOM (jsdom, jamás gml/xml.js)
// ═════════════════════════════════════════════════════════════════════════════

const DIR_FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'gml')

/** Un solo `window` para todo el fichero: crear uno por documento es carísimo. */
const DOM_PARSER = new JSDOM('').window.DOMParser
const PARSER = new DOM_PARSER()

/**
 * Texto → elemento raíz, con jsdom. LANZA si el XML no está bien formado, en
 * vez de devolver el `<parsererror>` de jsdom y dejar que la comparación falle
 * cien líneas más abajo diciendo otra cosa.
 *
 * @param {string} texto
 * @param {string} que  De quién es el documento, para el mensaje.
 * @returns {Element}
 */
function domDe(texto, que) {
  const doc = PARSER.parseFromString(texto, 'application/xml')
  const raiz = doc.documentElement
  if (raiz === null) throw new Error(`${que}: el documento no tiene raíz.`)
  const error = [raiz, ...doc.querySelectorAll('*')].find((e) => e.localName === 'parsererror')
  if (error !== undefined) {
    throw new Error(`${que}: jsdom no pudo parsear el XML — ${error.textContent.trim()}`)
  }
  return raiz
}

/** El elemento y TODOS sus descendientes, en orden de documento. */
const elementos = (raiz) => [raiz, ...raiz.querySelectorAll('*')]

/** Los elementos con ese nombre LOCAL, sea cual sea su prefijo o namespace. */
const porLocal = (raiz, local) => elementos(raiz).filter((e) => e.localName === local)

/** El ÚNICO elemento con ese nombre local. Lanza si hay cero o más de uno. */
function unico(raiz, local) {
  const encontrados = porLocal(raiz, local)
  if (encontrados.length !== 1) {
    throw new Error(`se esperaba UN <${local}> y hay ${encontrados.length}.`)
  }
  return encontrados[0]
}

/** `{ns, local}` de un elemento: su identidad real en XML (el prefijo no lo es). */
const identidad = (el) => ({ ns: el.namespaceURI, local: el.localName })

/** Pares `[x, y]` de un texto de `posList`/`pos`. */
function paresDe(texto) {
  const numeros = texto.trim().split(/\s+/).map(Number)
  if (numeros.length === 0 || numeros.length % 2 !== 0) {
    throw new Error(`lista de coordenadas con ${numeros.length} valores: no son pares X Y.`)
  }
  const salida = []
  for (let i = 0; i < numeros.length; i += 2) salida.push([numeros[i], numeros[i + 1]])
  return salida
}

/** El anillo CERRADO que lleva dentro un `gml:exterior`/`gml:interior`. */
const anilloDe = (contorno) => paresDe(unico(contorno, 'posList').textContent)

/** Un anillo cerrado → abierto, que es como vive en el modelo (regla de oro 4). */
const abrir = (cerrado) => cerrado.slice(0, -1)

/** La declaración XML del prólogo, como objeto. `null` si no la hay. */
function declaracionDe(texto) {
  const m = /^<\?xml\s([^?]*)\?>/.exec(texto)
  if (m === null) return null
  const atributos = {}
  for (const a of m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) atributos[a[1]] = a[2]
  return atributos
}

// ── Cirugía de string, siempre comprobando que CORTÓ ─────────────────────────
//
// Un `replace` que no encuentra su patrón devuelve la cadena intacta y el
// guardián sigue verde: se leería como «el guardián no dispara» cuando lo que
// pasa es que no se ha mutado nada. Por eso toda mutación comprueba que el texto
// CAMBIÓ antes de dárselo a nadie.

/** Sustituye la PRIMERA aparición y exige que haya habido sustitución. */
function mutar(xml, de, a) {
  const salida = xml.replace(de, () => a)
  expect(salida, `la cirugía de string no cambió nada (patrón: ${de})`).not.toBe(xml)
  return salida
}

/** Sustituye TODAS las apariciones (literal) y exige que haya habido alguna. */
function mutarTodo(xml, de, a) {
  const salida = xml.split(de).join(a)
  expect(salida, `la cirugía de string no cambió nada (literal: ${de})`).not.toBe(xml)
  return salida
}

/** El bloque `<nombre …>…</nombre>` completo, con su nombre CUALIFICADO. */
function bloque(xml, nombre) {
  const abre = xml.indexOf(`<${nombre}`)
  const cierra = xml.indexOf(`</${nombre}>`)
  expect(abre, `no se encontró <${nombre}> en el documento`).toBeGreaterThan(-1)
  expect(cierra, `no se encontró </${nombre}>`).toBeGreaterThan(abre)
  return xml.slice(abre, cierra + nombre.length + 3)
}

/** Intercambia dos bloques hermanos. El marcador evita que la 2ª pise a la 1ª. */
function permutar(xml, a, b) {
  const bloqueA = bloque(xml, a)
  const bloqueB = bloque(xml, b)
  // El marcador tiene que ser algo que NO pueda aparecer en un GML: con un
  // espacio, el tercer `replace` sustituiría el primer espacio del documento.
  const MARCA = '@@MARCA-DE-PERMUTACION@@'
  const salida = xml
    .replace(bloqueA, () => MARCA)
    .replace(bloqueB, () => bloqueA)
    .replace(MARCA, () => bloqueB)
  expect(salida, `la permutación de <${a}> y <${b}> no cambió nada`).not.toBe(xml)
  return salida
}

// ── Ejecutar un guardián y saber si pasó ─────────────────────────────────────

/**
 * Corre un guardián y dice si quedó VERDE. Es lo que permite probar cada
 * invariante en los dos sentidos: la mitad de arriba lo llama directamente (y
 * un guardián roto sale ahí, con su mensaje), y la de abajo lo llama por aquí
 * para exigir que la mutación lo ponga ROJO.
 *
 * @param {(entrada: string) => void} guardian
 * @param {string} entrada  XML (o el texto que mire ese guardián).
 * @returns {{verde: boolean, error: string|null}}
 */
function correr(guardian, entrada) {
  try {
    guardian(entrada)
    return { verde: true, error: null }
  } catch (e) {
    return { verde: false, error: e.message }
  }
}

/**
 * Exige que un guardián se ponga ROJO ante una entrada mutada, Y POR SU MOTIVO.
 *
 * La segunda mitad no es adorno: si la cirugía de string dejara el documento mal
 * formado, `domDe` reventaría y el guardián se pondría rojo igual — pero por una
 * razón que no tiene nada que ver con el invariante que dice vigilar, y la
 * prueba de disparo sería falsa.
 */
function seVuelveRojo(guardian, entrada, mutacion) {
  const r = correr(guardian, entrada)
  expect(r.verde, `el guardián NO se puso rojo con la mutación: ${mutacion}`).toBe(false)
  expect(
    r.error,
    `el guardián se puso rojo porque el XML quedó mal formado, no por el invariante ` +
      `(mutación: ${mutacion})`,
  ).not.toMatch(/no pudo parsear/)
  if (process.env.F04_VER_DISPAROS === '1') console.log(`[disparo] ${mutacion}\n  ${r.error}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Los fixtures del disco, descubiertos y clasificados por lo que SON
// ═════════════════════════════════════════════════════════════════════════════
//
// El directorio se RECORRE (nada de una lista de nombres escrita a mano) y el
// papel de cada fichero —dato oficial 4.0, contraejemplo 3.0, edificio— se
// asigna por su DIALECTO, no por cómo se llame. Si mañana el Catastro entrega
// otro GML y se versiona aquí, entra solo.

/** @type {Array<{nombre: string, texto: string, leido: object}>} */
const FIXTURES = readdirSync(DIR_FIXTURES)
  .filter((n) => n.toLowerCase().endsWith('.gml'))
  .sort()
  .map((nombre) => {
    // utf8 A PROPÓSITO, no latin1: el GML del WFS declara ISO-8859-1 y sus BYTES
    // son UTF-8 (medido). Leerlo por lo que declara rompería sus acentos; esa
    // mentira del fichero es justo lo que prueba el guardián 11.
    const texto = readFileSync(join(DIR_FIXTURES, nombre), 'utf8')
    return { nombre, texto, leido: parsearGml(texto) }
  })

const deDialecto = (id) => FIXTURES.filter((f) => f.leido.dialecto === id)

/** El único fixture de cada dialecto de parcela. Lanza si no hay exactamente uno. */
function unicoDeDialecto(id) {
  const encontrados = deDialecto(id)
  if (encontrados.length !== 1) {
    throw new Error(
      `test/fixtures/gml/ debe traer UN fichero de dialecto ${id} y trae ` +
        `${encontrados.length}: ${JSON.stringify(encontrados.map((f) => f.nombre))}.`,
    )
  }
  return encontrados[0]
}

/** El dato OFICIAL: la parcela 4.0 del WFS. Es la verdad-terreno de todo esto. */
const CP40 = unicoDeDialecto(DIALECTO.CP_4_0)
/** El CONTRAEJEMPLO: alta de particular en CP 3.0, de otro generador. */
const UTM1 = unicoDeDialecto(DIALECTO.CP_3_0)
/** Los GML de EDIFICIO: aportan el caso donde `boundedBy` SÍ existe de verdad. */
const EDIFICIOS = deDialecto(DIALECTO.BU)

const DOM_CP40 = domDe(CP40.texto, `fixture ${CP40.nombre}`)
const DOM_UTM1 = domDe(UTM1.texto, `fixture ${UTM1.nombre}`)

// ── Verdad-terreno leída del GML real (jsdom, no gml/xml.js) ─────────────────

/** Namespace de GML 3.2, tomado del propio fichero del Catastro. */
const NS_GML = unico(DOM_CP40, 'MultiSurface').namespaceURI

/** Raíz y contenedor de miembro que el 4.0 exige (override O3). */
const RAIZ_CP40 = identidad(DOM_CP40)
const MIEMBRO_CP40 = identidad(DOM_CP40.children[0])

/** Orden XSD de los hijos de `cp:CadastralParcel` (override O5), del fichero. */
const ORDEN_FIXTURE = [...unico(DOM_CP40, 'CadastralParcel').children].map((c) => c.localName)

/** La URI OGC del `srsName` (override O2) y en cuántos sitios aparece. */
const SRSNAME_URI = unico(DOM_CP40, 'MultiSurface').getAttribute('srsName')
const N_SRSNAME = elementos(DOM_CP40).filter((e) => e.hasAttribute('srsName')).length

/** La URN del 3.0: la forma que la salida NO puede contener jamás. */
const SRSNAME_URN = unico(DOM_UTM1, 'MultiSurface').getAttribute('srsName')

/** Raíz y miembro del 3.0: los nombres PROHIBIDOS. Los aporta el contraejemplo. */
const PROHIBIDOS_3_0 = [identidad(DOM_UTM1), identidad(DOM_UTM1.children[0])]

/**
 * Los GML de edificio donde `boundedBy` EXISTE de verdad, con el elemento en la
 * mano. Se buscan (no se supone cuál de los dos lo trae) porque de aquí sale la
 * anti-vacuidad del guardián 6 y el nombre cualificado que se le inyecta.
 */
const EDIFICIOS_CON_BOUNDEDBY = EDIFICIOS.map((f) => ({
  nombre: f.nombre,
  boundedBy: porLocal(domDe(f.texto, f.nombre), 'boundedBy')[0] ?? null,
})).filter((e) => e.boundedBy !== null)

/** Nombres CUALIFICADOS que necesitan las cirugías de string. Todos derivados. */
const Q = {
  raizSalida: DOM_CP40.nodeName,
  miembroSalida: DOM_CP40.children[0].nodeName,
  raiz30: DOM_UTM1.nodeName,
  miembro30: DOM_UTM1.children[0].nodeName,
  parcela: unico(DOM_CP40, 'CadastralParcel').nodeName,
  label: unico(DOM_CP40, 'label').nodeName,
  inspireId: unico(DOM_CP40, 'inspireId').nodeName,
  boundedBy: EDIFICIOS_CON_BOUNDEDBY[0]?.boundedBy.nodeName,
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El round-trip: parse(fixture) → serialize
// ═════════════════════════════════════════════════════════════════════════════

const LEIDO = CP40.leido
const PARCELA = LEIDO.parcelas[0]

/**
 * Nuestro comentario del prólogo. El fixture trae los dos del WFS y nosotros
 * ponemos el nuestro: `canonico` descarta los comentarios justo por eso. Lleva
 * acentos A PROPÓSITO — sin un solo carácter fuera de ASCII, el guardián 11 no
 * podría distinguir UTF-8 de ISO-8859-1 y no diría nada.
 */
const COMENTARIO =
  'Reserialización del GML del Catastro por la suite de aceptación de F04 (ida y vuelta).'

/**
 * Todo lo que se le pasa al serializador SALE DE LO LEÍDO. Dos matices:
 *   · `refcat` es la IDENTIDAD y se toma del `<localId>` del `inspireId`, que es
 *     de donde `gml/ids.js` compone los cuatro `gml:id`.
 *   · `nationalCadastralReference` es la AFIRMACIÓN de inscripción y se toma de
 *     `parcela.refcat`, que es lo que `gml/parse.js` leyó de ese elemento. En
 *     este fichero coinciden, y hay una guarda abajo que lo comprueba en vez de
 *     darlo por hecho.
 */
const SALIDA = serializarParcelaCp({
  recintos: PARCELA.recintos,
  srs: PARCELA.srs,
  refcat: PARCELA.localId,
  namespaceInspire: PARCELA.namespaceInspire,
  label: PARCELA.label,
  nationalCadastralReference: PARCELA.refcat,
  beginLifespanVersion: PARCELA.beginLifespanVersion,
  puntoReferencia: PARCELA.puntoReferencia,
  timeStamp: LEIDO.resumen.wfs.timeStamp,
  comentario: COMENTARIO,
})

if (SALIDA.xml === null) {
  // Se para aquí y con nombre: sin documento, los treinta `it` de abajo fallarían
  // todos diciendo cosas raras sobre `null`.
  throw new Error(
    `el round-trip no emitió documento. Bloqueos: ${JSON.stringify(SALIDA.resumen.bloqueos)}`,
  )
}

/** El GML que produce el proyecto a partir del GML del Catastro. */
const XML = SALIDA.xml

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Anti-vacuidad: los ficheros dicen lo que esta suite da por sabido
// ═════════════════════════════════════════════════════════════════════════════

describe('F04 · la verdad-terreno se ha leído de verdad', () => {
  it('el directorio de fixtures trae los tres papeles que esta suite necesita', () => {
    expect(FIXTURES.length, 'test/fixtures/gml/ está vacío').toBeGreaterThan(0)
    expect(EDIFICIOS.length, 'ningún GML de edificio: el guardián 6 sería vacuo')
      .toBeGreaterThan(0)
    expect(CP40.nombre).not.toBe(UTM1.nombre)
  })

  it('el GML del Catastro trae los datos que el round-trip le pide', () => {
    expect(LEIDO.soportado, 'el fixture 4.0 debería ser un dialecto soportado').toBe(true)
    expect(LEIDO.parcelas, 'el fixture debe traer UNA parcela').toHaveLength(1)
    expect(PARCELA.recintos.length, 'sin recintos no hay geometría').toBeGreaterThan(0)
    expect(PARCELA.localId, 'sin localId no hay identidad').toMatch(/^\S+$/)
    expect(PARCELA.namespaceInspire).toMatch(/^\S+$/)
    expect(PARCELA.beginLifespanVersion).toMatch(/^\S+$/)
    expect(PARCELA.puntoReferencia, 'sin referencePoint el guardián 8 no mide nada')
      .toHaveLength(2)
    expect(LEIDO.resumen.wfs.timeStamp, 'sin timeStamp la raíz no se reproduce')
      .toMatch(/^\S+$/)
    // El dato oficial ya está inscrito: identidad y referencia coinciden. Si un
    // día no coincidieran, el round-trip de arriba estaría mezclando dos cosas.
    expect(PARCELA.refcat, 'en el dato oficial localId == nationalCadastralReference')
      .toBe(PARCELA.localId)
  })

  it('leer el fixture NO produce ningún ERROR (si no, el modelo sería basura)', () => {
    const errores = LEIDO.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR)
    expect(errores.map((d) => d.tipo), 'parse del GML real con errores').toEqual([])
  })

  it('la verdad-terreno derivada del fichero no está vacía', () => {
    expect(ORDEN_FIXTURE.length, 'cp:CadastralParcel sin hijos').toBeGreaterThan(0)
    expect(SRSNAME_URI, 'el srsName del fixture 4.0 debe ser la URI OGC').toMatch(/^https?:\/\//)
    expect(SRSNAME_URN, 'el srsName de UTM_1.gml debe ser la URN').toMatch(/^urn:/)
    expect(N_SRSNAME, 'el srsName va repetido en tres sitios').toBeGreaterThan(1)
    expect(PROHIBIDOS_3_0).toHaveLength(2)
    expect(Q.boundedBy, 'el GML de edificio debe traer un boundedBy cualificado')
      .toMatch(/boundedBy$/)
    expect(Object.values(Q).every((v) => typeof v === 'string' && v.length > 0)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · AC1 · IDA Y VUELTA (aserciones 1 y 2 de las cuatro)
// ═════════════════════════════════════════════════════════════════════════════

describe('F04 · AC1 · ida y vuelta contra el GML real del Catastro', () => {
  it('1ª · serializar lo leído no produce ninguna detección de severidad ERROR', () => {
    const errores = SALIDA.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR)
    expect(errores.map((d) => d.tipo)).toEqual([])
    expect(SALIDA.resumen.bloqueos).toEqual([])
    expect(SALIDA.resumen.emitido).toBe(true)
  })

  it('2ª · el árbol canónico de la salida ES el del fixture', () => {
    // La igualdad de verdad del AC1: mismos vértices, mismo cierre, misma RC,
    // mismo CRS y misma estructura, «ignorando espacios». Todo lo que NO está en
    // las siete filas de `_canonico.js` se compara exacto.
    expect(canonico(domDe(XML, 'salida del round-trip'))).toEqual(canonico(DOM_CP40))
  })

  it('2ª bis · la declaración XML se compara APARTE, y ahí sí difieren', () => {
    // Está fuera del árbol, y es la única diferencia de contenido buscada: el
    // fixture MIENTE sobre sí mismo (declara ISO-8859-1 con bytes UTF-8) y
    // nosotros declaramos lo que escribimos. Ver el guardián 11.
    const nuestra = declaracionDe(XML)
    const suya = declaracionDe(CP40.texto)
    expect(nuestra.version).toBe(suya.version)
    expect(nuestra.encoding.toLowerCase()).toBe('utf-8')
    expect(suya.encoding.toLowerCase(), 'el fixture ya no declararía ISO-8859-1')
      .not.toBe('utf-8')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · LOS DOCE GUARDIANES (3ª aserción del AC1)
// ═════════════════════════════════════════════════════════════════════════════

// ── 1 · Orden XSD de cp:CadastralParcel (override O5 · AC4) ──────────────────

/** El orden de los hijos del feature es el del GML real, elemento a elemento. */
function g1Orden(xml) {
  const raiz = domDe(xml, 'salida')
  const hijos = [...unico(raiz, 'CadastralParcel').children].map((c) => c.localName)
  expect(hijos, 'los hijos de cp:CadastralParcel no van en el orden del fixture')
    .toEqual(ORDEN_FIXTURE)
}

describe('F04 · guardián 1 · orden XSD de los hijos (O5)', () => {
  it('la salida coloca los hijos en el mismo orden que el GML del Catastro', () => {
    g1Orden(XML)
  })

  it('DISPARA: permutar label ↔ inspireId lo pone rojo', () => {
    const mutado = permutar(XML, Q.inspireId, Q.label)
    seVuelveRojo(g1Orden, mutado, `<${Q.label}> antes de <${Q.inspireId}>`)
  })
})

// ── 2 · srsName en los TRES sitios, y en URI (override O2 · AC4) ─────────────

/** Los tres `srsName` son la URI OGC del fixture, y la URN del 3.0 no aparece. */
function g2SrsName(xml) {
  const raiz = domDe(xml, 'salida')
  const conSrs = elementos(raiz).filter((e) => e.hasAttribute('srsName'))
  expect(
    conSrs.map((e) => e.localName),
    'el srsName debe ir repetido en MultiSurface, Surface y Point',
  ).toHaveLength(N_SRSNAME)
  for (const e of conSrs) {
    expect(e.getAttribute('srsName'), `srsName de <${e.localName}>`).toBe(SRSNAME_URI)
  }
  expect(xml.includes(SRSNAME_URN), `la URN del CP 3.0 (${SRSNAME_URN}) aparece en la salida`)
    .toBe(false)
}

describe('F04 · guardián 2 · srsName = URI OGC en los tres sitios (O2)', () => {
  it('los tres srsName son la URI del fixture, y la URN de UTM_1 no está', () => {
    g2SrsName(XML)
  })

  it('DISPARA: cambiar la URI por la URN del contraejemplo lo pone rojo', () => {
    const mutado = mutarTodo(XML, SRSNAME_URI, SRSNAME_URN)
    seVuelveRojo(g2SrsName, mutado, 'srsName en URN en vez de URI')
  })
})

// ── 3 · Raíz WFS 2.0 + member, nunca la del 3.0 (override O3 · AC4) ──────────

/** La raíz y el contenedor son los del 4.0; y ningún elemento es de los del 3.0. */
function g3Raiz(xml) {
  const raiz = domDe(xml, 'salida')
  expect(identidad(raiz), 'la raíz no es la FeatureCollection de WFS 2.0').toEqual(RAIZ_CP40)

  const miembros = [...raiz.children]
  expect(miembros.length, 'la FeatureCollection no lleva ningún miembro').toBeGreaterThan(0)
  for (const m of miembros) expect(identidad(m)).toEqual(MIEMBRO_CP40)

  for (const e of elementos(raiz)) {
    for (const prohibido of PROHIBIDOS_3_0) {
      expect(
        identidad(e),
        `<${e.nodeName}> es del dialecto 3.0, que la Sede rechaza desde 2025`,
      ).not.toEqual(prohibido)
    }
  }
}

describe('F04 · guardián 3 · raíz WFS 2.0 con <member> (O3)', () => {
  it('la raíz y el miembro son los del GML real, y ninguno es del 3.0', () => {
    g3Raiz(XML)
  })

  it('el modelo de UTM_1.gml (CP 3.0) sale en 4.0: su raíz NO se conserva', () => {
    // El contraejemplo entero, de punta a punta: se lee un GML 3.0 y se vuelve a
    // escribir. La raíz `gml:FeatureCollection` y el `gml:featureMember` del
    // original tienen que haber DESAPARECIDO. `beginLifespanVersion` viene nil en
    // ese fichero y el serializador lo exige, así que se le presta el único
    // dateTime real que hay en los fixtures: el del GML del Catastro.
    const suya = UTM1.leido.parcelas[0]
    const { xml } = serializarParcelaCp({
      recintos: suya.recintos,
      srs: suya.srs,
      refcat: suya.localId,
      namespaceInspire: suya.namespaceInspire,
      beginLifespanVersion: PARCELA.beginLifespanVersion,
    })
    expect(xml, 'el alta de particular debería serializarse sin bloqueos').not.toBeNull()
    g3Raiz(xml)
  })

  it('DISPARA: devolverle a la salida la raíz del 3.0 la pone roja', () => {
    const mutado = mutarTodo(
      mutar(
        mutar(XML, `<${Q.raizSalida} `, `<${Q.raiz30} `),
        `</${Q.raizSalida}>`,
        `</${Q.raiz30}>`,
      ),
      `<${Q.miembroSalida}>`,
      `<${Q.miembro30}>`,
    )
    const conCierre = mutarTodo(mutado, `</${Q.miembroSalida}>`, `</${Q.miembro30}>`)
    seVuelveRojo(g3Raiz, conCierre, `raíz ${Q.raiz30} con ${Q.miembro30}`)
  })
})

// ── 4 · gml:id empieza por letra y no se repite (AC5) ────────────────────────

/** Todos los `gml:id` del documento empiezan por letra y son únicos. */
function g4Ids(xml) {
  const raiz = domDe(xml, 'salida')
  const ids = elementos(raiz)
    .filter((e) => e.hasAttributeNS(NS_GML, 'id'))
    .map((e) => e.getAttributeNS(NS_GML, 'id'))

  // Anti-vacuidad del recorrido: sin esto, un documento SIN ids pasaría en verde.
  expect(ids.length, 'la salida no lleva ni un gml:id: el recorrido sería vacuo')
    .toBeGreaterThan(0)
  for (const id of ids) {
    expect(id, `el gml:id ${JSON.stringify(id)} no empieza por letra (regla de oro 10)`)
      .toMatch(/^[A-Za-z]/)
  }
  expect(new Set(ids).size, `gml:id repetido (xsd:ID es único en el documento): ${ids}`)
    .toBe(ids.length)
}

describe('F04 · guardián 4 · gml:id por letra y sin repetir (AC5)', () => {
  it('los gml:id de la salida empiezan por letra y ninguno se repite', () => {
    g4Ids(XML)
  })

  it('DISPARA: sin namespace INSPIRE la RC queda desnuda y el id empieza por dígito', () => {
    // El serializador NO lo deja pasar: prefija con `_` y lo DICE (`ID_SANEADO`).
    // Ese `_` no es una letra, así que el guardián se pone rojo — que es
    // exactamente lo que debe hacer si alguien intentara publicar así.
    const { xml, detecciones } = serializarParcelaCp({
      recintos: PARCELA.recintos,
      srs: PARCELA.srs,
      refcat: PARCELA.localId,
      namespaceInspire: '',
      beginLifespanVersion: PARCELA.beginLifespanVersion,
    })
    expect(detecciones.map((d) => d.tipo)).toContain(TIPO_GML.ID_SANEADO)
    seVuelveRojo(g4Ids, xml, 'namespaceInspire vacío → gml:id con la RC desnuda')
  })
})

// ── 5 · AC2 · orientación: exterior HORARIO, huecos al revés (O1) ────────────

/**
 * El oráculo del signo es `@turf/boolean-clockwise` (devDependency), NO
 * `geo/area.js`: si el signo lo dictara el mismo módulo que orienta los anillos,
 * un error de convenio pasaría desapercibido.
 *
 * ⚠️ `booleanClockwise` EXIGE el anillo CERRADO. Sobre el abierto responde lo
 * contrario (medido en T2.1). El `posList` emitido va cerrado, que es justo lo
 * que se le pasa aquí — y por eso este guardián depende del 9.
 */
function g5Orientacion(xml) {
  const raiz = domDe(xml, 'salida')
  const exteriores = porLocal(raiz, 'exterior')
  expect(exteriores.length, 'sin gml:exterior no hay orientación que juzgar')
    .toBeGreaterThan(0)
  for (const ext of exteriores) {
    expect(booleanClockwise(anilloDe(ext)), 'el contorno exterior debe ser HORARIO (O1)')
      .toBe(true)
  }
  for (const hueco of porLocal(raiz, 'interior')) {
    expect(booleanClockwise(anilloDe(hueco)), 'los huecos van ANTIHORARIOS (O1)').toBe(false)
  }
}

describe('F04 · guardián 5 · AC2 · orientación de los anillos (O1)', () => {
  it('el exterior emitido es horario según @turf/boolean-clockwise', () => {
    g5Orientacion(XML)
  })

  it('DISPARA: invertir el posList emitido lo pone rojo', () => {
    const listaOriginal = unico(domDe(XML, 'salida'), 'posList').textContent
    const invertida = [...paresDe(listaOriginal)]
      .reverse()
      .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ')
    seVuelveRojo(g5Orientacion, mutar(XML, listaOriginal, invertida), 'exterior antihorario')
  })

  it('DISPARA al revés: un exterior ANTIHORARIO de entrada se normaliza, y se dice', () => {
    const alReves = [...PARCELA.recintos[0].vertices].reverse()
    const resultado = serializarParcelaCp({
      recintos: [{ vertices: alReves, tipo: TIPO_RECINTO.EXTERIOR }],
      srs: PARCELA.srs,
      refcat: PARCELA.localId,
      namespaceInspire: PARCELA.namespaceInspire,
      beginLifespanVersion: PARCELA.beginLifespanVersion,
    })
    g5Orientacion(resultado.xml) // la SALIDA sigue siendo horaria
    expect(resultado.resumen.invertidos, 'el resumen debe declarar el anillo invertido')
      .toEqual([true])
    expect(resultado.detecciones.map((d) => d.tipo))
      .toContain(TIPO_GML.ORIENTACION_NORMALIZADA)
  })
})

// ── 6 · Sin boundedBy / Envelope / validFrom / validTo / zoning ──────────────

/**
 * Ninguno de los {@link ELEMENTOS_PROSCRITOS_CP40} aparece en la salida.
 *
 * Que no aparezcan NO es cosa del XSD —que los admite— sino del checklist de
 * rechazos del IVG y del hecho de que el WFS del Catastro no los emite. Ver la
 * advertencia de la cabecera.
 */
function g6Proscritos(xml) {
  const locales = elementos(domDe(xml, 'salida')).map((e) => e.localName)
  expect(ELEMENTOS_PROSCRITOS_CP40.length, 'la lista de proscritos está vacía')
    .toBeGreaterThan(0)
  for (const { local } of ELEMENTOS_PROSCRITOS_CP40) {
    expect(
      locales.includes(local),
      `<${local}> aparece en la salida: está en el checklist de rechazos del IVG`,
    ).toBe(false)
  }
}

describe('F04 · guardián 6 · elementos proscritos en CP 4.0', () => {
  it('la salida no lleva ninguno de los elementos proscritos', () => {
    g6Proscritos(XML)
  })

  it('la comprobación no es vacua: en el GML de edificio boundedBy SÍ existe', () => {
    // Es la mitad que hace que este guardián valga algo: el detector se prueba
    // contra un fichero real donde el elemento ESTÁ, no contra la nada.
    expect(
      EDIFICIOS_CON_BOUNDEDBY.map((e) => e.nombre),
      'ningún GML de edificio trae boundedBy: el guardián 6 no estaría probado',
    ).not.toEqual([])
  })

  it('DISPARA: inyectar un <gml:boundedBy/> lo pone rojo', () => {
    const abre = new RegExp(`<${Q.parcela}[^>]*>`)
    const mutado = XML.replace(abre, (etiqueta) => `${etiqueta}<${Q.boundedBy}/>`)
    expect(mutado, 'la inyección no cambió nada').not.toBe(XML)
    seVuelveRojo(g6Proscritos, mutado, `<${Q.boundedBy}/> dentro del feature`)
  })
})

// ── 7 · AC3 · areaValue == |shoelace| de las coordenadas PUBLICADAS ──────────

/**
 * El `areaValue` de la salida cuadra con la superficie que sale de las
 * coordenadas de la salida.
 *
 * Las dos mitades se releen DEL DOCUMENTO —el `posList` emitido y el
 * `cp:areaValue` emitido—, no del modelo ni del `resumen`: así el bucle se
 * cierra A TRAVÉS DE LOS BYTES DEL FICHERO, que es lo que pide la regla de oro
 * 11 («la superficie publicada se calcula desde las coordenadas publicadas»).
 * Comprobarlo contra `resumen.areaValue` sería preguntarle al serializador si
 * está de acuerdo consigo mismo.
 */
function g7Area(xml) {
  const raiz = domDe(xml, 'salida')
  const declarada = Number(unico(raiz, 'areaValue').textContent.trim())
  expect(Number.isInteger(declarada), `areaValue no es entero: ${declarada}`).toBe(true)

  const superficieDe = (contornos) =>
    contornos.reduce((suma, c) => suma + Math.abs(areaFirmada(abrir(anilloDe(c)))), 0)
  const exterior = superficieDe(porLocal(raiz, 'exterior'))
  const huecos = superficieDe(porLocal(raiz, 'interior'))
  expect(exterior, 'superficie exterior nula: no habría nada que comparar').toBeGreaterThan(0)

  expect(
    Math.round(exterior - huecos),
    'el areaValue publicado no es el shoelace de las coordenadas publicadas',
  ).toBe(declarada)
}

describe('F04 · guardián 7 · AC3 · areaValue == |shoelace| de lo publicado', () => {
  it('la superficie declarada sale de las coordenadas del propio fichero', () => {
    g7Area(XML)
  })

  it('DISPARA: restarle 1 m² al areaValue lo pone rojo', () => {
    const declarada = Number(unico(domDe(XML, 'salida'), 'areaValue').textContent.trim())
    const mutado = mutar(XML, `>${declarada}<`, `>${declarada - 1}<`)
    seVuelveRojo(g7Area, mutado, `areaValue ${declarada} → ${declarada - 1}`)
  })
})

// ── 8 · AC5 · el referencePoint cae DENTRO del polígono ─────────────────────

/** Oráculo externo: `@turf/boolean-point-in-polygon`, sobre lo EMITIDO. */
function g8PuntoDentro(xml) {
  const raiz = domDe(xml, 'salida')
  const pos = paresDe(unico(raiz, 'pos').textContent)
  expect(pos, 'el gml:pos debe traer UN punto').toHaveLength(1)

  const anillos = [...porLocal(raiz, 'exterior'), ...porLocal(raiz, 'interior')].map(anilloDe)
  expect(anillos.length, 'sin anillos no hay dentro ni fuera').toBeGreaterThan(0)

  // `ignoreBoundary: true`: un punto SOBRE la línea no está dentro, y el
  // Catastro lo rechaza. Es el caso real que `gml/anillos.js` documenta.
  expect(
    booleanPointInPolygon(point(pos[0]), polygon(anillos), { ignoreBoundary: true }),
    `el referencePoint ${JSON.stringify(pos[0])} no cae dentro de la parcela`,
  ).toBe(true)
}

describe('F04 · guardián 8 · AC5 · referencePoint dentro del polígono', () => {
  it('el punto emitido cae dentro, verificado con turf', () => {
    g8PuntoDentro(XML)
  })

  it('DISPARA: poner el punto sobre un vértice del anillo lo pone rojo', () => {
    const raiz = domDe(XML, 'salida')
    const vertice = anilloDe(porLocal(raiz, 'exterior')[0])[0]
    const posOriginal = unico(raiz, 'pos').textContent
    const mutado = mutar(XML, posOriginal, `${vertice[0].toFixed(2)} ${vertice[1].toFixed(2)}`)
    seVuelveRojo(g8PuntoDentro, mutado, 'referencePoint sobre un vértice (en el borde)')
  })
})

// ── 9 · Anillo cerrado y con al menos 4 posiciones ──────────────────────────

/** Todo `posList` de la salida está cerrado y no baja de 4 posiciones. */
function g9Cierre(xml) {
  const listas = porLocal(domDe(xml, 'salida'), 'posList')
  expect(listas.length, 'la salida no lleva ni un posList').toBeGreaterThan(0)
  for (const lista of listas) {
    const pares = paresDe(lista.textContent)
    expect(pares.length, 'un gml:LinearRing necesita 4 posiciones como mínimo')
      .toBeGreaterThanOrEqual(4)
    expect(pares.at(-1), 'el anillo no está cerrado: el último par no es el primero')
      .toEqual(pares[0])
  }
}

describe('F04 · guardián 9 · anillo cerrado y ≥ 4 puntos', () => {
  it('todos los posList emitidos repiten el primer par al final', () => {
    g9Cierre(XML)
  })

  it('DISPARA: quitarle el último par al posList lo pone rojo', () => {
    const lista = unico(domDe(XML, 'salida'), 'posList').textContent
    const sinCierre = paresDe(lista)
      .slice(0, -1)
      .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ')
    seVuelveRojo(g9Cierre, mutar(XML, lista, sinCierre), 'posList sin el par de cierre')
  })
})

// ── 10 · count == PARES, no valores ─────────────────────────────────────────

/**
 * El `count` del `posList` es el número de PARES. Confundirlo con el de valores
 * es el error más fácil de cometer aquí y es rechazo directo.
 */
function g10Count(xml) {
  const listas = porLocal(domDe(xml, 'salida'), 'posList')
  expect(listas.length, 'la salida no lleva ni un posList').toBeGreaterThan(0)
  for (const lista of listas) {
    const count = lista.getAttribute('count')
    expect(count, 'un gml:posList sin atributo count').not.toBeNull()
    expect(Number(count), 'el count debe ser el nº de PARES, no el de valores')
      .toBe(paresDe(lista.textContent).length)
  }
}

describe('F04 · guardián 10 · count = número de pares', () => {
  it('cada posList declara tantos pares como lleva', () => {
    g10Count(XML)
  })

  it('DISPARA: un count inventado lo pone rojo', () => {
    const listaEl = unico(domDe(XML, 'salida'), 'posList')
    const count = listaEl.getAttribute('count')
    const falso = String(Number(count) + 83)
    seVuelveRojo(g10Count, mutar(XML, `count="${count}"`, `count="${falso}"`), `count=${falso}`)
  })
})

// ── 11 · Encoding declarado == bytes reales ─────────────────────────────────

/**
 * El documento declara UTF-8 y su texto es UTF-8 sin pérdida.
 *
 * La exigencia de que haya al menos un carácter fuera de ASCII no es celo: en
 * un documento 100 % ASCII, UTF-8 e ISO-8859-1 producen LOS MISMOS BYTES y el
 * invariante no distinguiría nada. Con acentos dentro, sí.
 */
function g11Encoding(texto) {
  const declaracion = declaracionDe(texto)
  expect(declaracion, 'el documento no lleva declaración XML').not.toBeNull()
  expect(String(declaracion.encoding).toLowerCase(), 'el encoding declarado').toBe('utf-8')
  const hayNoAscii = [...texto].some((c) => c.codePointAt(0) > 127)
  expect(
    hayNoAscii,
    'documento sin un solo carácter no-ASCII: el invariante no diría nada, porque en ' +
      'ASCII puro todos los encodings producen los mismos bytes',
  ).toBe(true)
  expect(Buffer.from(texto, 'utf8').toString('utf8'), 'el texto no sobrevive a UTF-8')
    .toBe(texto)
}

describe('F04 · guardián 11 · encoding declarado == bytes reales', () => {
  it('la salida declara UTF-8, lleva acentos y es UTF-8 de verdad', () => {
    g11Encoding(XML)
  })

  it('DISPARA: el propio fixture del Catastro INCUMPLE este invariante', () => {
    // El disparo no hay que fabricarlo: existe. El fichero real declara
    // ISO-8859-1 y sus bytes son UTF-8 — miente sobre sí mismo. Que el guardián
    // se ponga rojo sobre un caso REAL de fallo es más de lo que puede decir un
    // contraejemplo inventado.
    seVuelveRojo(g11Encoding, CP40.texto, `${CP40.nombre} declara ISO-8859-1 con bytes UTF-8`)

    const bytes = readFileSync(join(DIR_FIXTURES, CP40.nombre))
    expect(declaracionDe(CP40.texto).encoding.toLowerCase()).not.toBe('utf-8')
    // …y sin embargo los bytes SON UTF-8: decodificarlos como tal es sin pérdida.
    expect(Buffer.compare(Buffer.from(CP40.texto, 'utf8'), bytes), 'los bytes no son UTF-8')
      .toBe(0)
    expect(CP40.texto.includes('�'), 'leído como UTF-8 no aparece ni un U+FFFD')
      .toBe(false)
    // Leerlo por lo que DECLARA da otro texto: ahí está la mentira, medida.
    expect(bytes.toString('latin1')).not.toBe(CP40.texto)
  })
})

// ── 12 · La tabla de dialectos, contrastada contra los ficheros del disco ────

/** El documento cae en alguna entrada de {@link DIALECTOS}, no en DESCONOCIDO. */
function g12Dialecto(texto) {
  const { dialecto } = parsearGml(texto)
  expect(
    DIALECTOS.map((d) => d.id),
    `el documento se clasificó como ${dialecto}`,
  ).toContain(dialecto)
}

describe('F04 · guardián 12 · tabla de dialectos frente a los GML del disco', () => {
  it('todos los fixtures del directorio caen en una entrada de la tabla', () => {
    expect(FIXTURES.length, 'sin ficheros el recorrido sería vacuo').toBeGreaterThan(0)
    for (const f of FIXTURES) {
      expect(() => g12Dialecto(f.texto), `${f.nombre} no se clasifica`).not.toThrow()
    }
  })

  it('cada entrada de la tabla tiene al menos un fichero que la ejerce', () => {
    const vistos = new Set(FIXTURES.map((f) => f.leido.dialecto))
    for (const d of DIALECTOS) {
      expect(vistos.has(d.id), `ningún fixture ejerce el dialecto ${d.id}`).toBe(true)
    }
  })

  it('solo el CP 4.0 está soportado: los demás se leen para poder rechazarlos', () => {
    for (const f of FIXTURES) {
      expect(f.leido.soportado, `${f.nombre} (${f.leido.dialecto})`)
        .toBe(f.leido.dialecto === DIALECTO.CP_4_0)
    }
  })

  it('DISPARA: un XML con una raíz inventada cae en DESCONOCIDO', () => {
    const ajeno = '<?xml version="1.0" encoding="UTF-8"?>\n<Catalogo xmlns="urn:ejemplo:nada"/>\n'
    seVuelveRojo(g12Dialecto, ajeno, 'raíz que no es ninguna FeatureCollection conocida')

    const leido = parsearGml(ajeno)
    expect(leido.dialecto).toBe(DIALECTO.DESCONOCIDO)
    expect(leido.detecciones.map((d) => d.tipo)).toContain(TIPO_GML.RAIZ_INESPERADA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Los guardianes sobre una parcela CON HUECO, derivada del propio fixture
// ═════════════════════════════════════════════════════════════════════════════
//
// El GML del Catastro es un caso feliz: convexo, ya horario y SIN huecos. Con él
// solo, la mitad «cada gml:interior va antihorario» del guardián 5 y la resta de
// huecos del 7 no se ejercitan nunca — serían dos bucles vacíos pasando en
// verde. El hueco no se inventa: es el propio contorno del fixture ENCOGIDO
// hacia su punto de referencia, que es la misma técnica que usa el test de
// unidad del serializador.

/** Anillo encogido hacia un centro. Con factor < 1 queda estrictamente dentro. */
const encoger = (anillo, [cx, cy], factor) =>
  anillo.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor])

const RECINTOS_CON_HUECO = [
  PARCELA.recintos[0],
  {
    vertices: encoger(PARCELA.recintos[0].vertices, PARCELA.puntoReferencia, 0.5),
    tipo: TIPO_RECINTO.HUECO,
  },
]

const CON_HUECO = serializarParcelaCp({
  recintos: RECINTOS_CON_HUECO,
  srs: PARCELA.srs,
  refcat: PARCELA.localId,
  namespaceInspire: PARCELA.namespaceInspire,
  label: PARCELA.label,
  nationalCadastralReference: PARCELA.refcat,
  beginLifespanVersion: PARCELA.beginLifespanVersion,
  timeStamp: LEIDO.resumen.wfs.timeStamp,
})

describe('F04 · los guardianes sobre una parcela con hueco derivada del fixture', () => {
  it('el hueco derivado está de verdad dentro del contorno (si no, no probaría nada)', () => {
    expect(CON_HUECO.xml, `bloqueos: ${JSON.stringify(CON_HUECO.resumen.bloqueos)}`)
      .not.toBeNull()
    const raiz = domDe(CON_HUECO.xml, 'salida con hueco')
    expect(porLocal(raiz, 'interior'), 'sin gml:interior no hay hueco que juzgar')
      .toHaveLength(1)
    const contorno = polygon([anilloDe(porLocal(raiz, 'exterior')[0])])
    for (const v of abrir(anilloDe(porLocal(raiz, 'interior')[0]))) {
      expect(booleanPointInPolygon(point(v), contorno), `vértice ${v} fuera del contorno`)
        .toBe(true)
    }
    // Y la superficie publicada es MENOR que la del fixture: el hueco se descuenta.
    expect(CON_HUECO.resumen.areaValue).toBeLessThan(SALIDA.resumen.areaValue)
  })

  it('los once guardianes de documento siguen verdes con el hueco dentro', () => {
    for (const guardian of [
      g1Orden,
      g2SrsName,
      g3Raiz,
      g4Ids,
      g5Orientacion, // aquí la mitad «gml:interior antihorario» SÍ se ejercita
      g6Proscritos,
      g7Area, // aquí la resta de huecos SÍ se ejercita
      g8PuntoDentro,
      g9Cierre,
      g10Count,
    ]) {
      guardian(CON_HUECO.xml)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · AC1 · LA CUARTA ASERCIÓN: el snapshot
// ═════════════════════════════════════════════════════════════════════════════
//
// Va la última a propósito (ver la cabecera): no sostiene el AC1 —para eso está
// la igualdad canónica—, sino que hace visible en la revisión CUALQUIER cambio
// de bytes, incluidos los que la canonicalización ignora adrede. Las tres únicas
// diferencias esperadas frente al fixture están documentadas en la cabecera de
// `gml/serialize-cp.js`: la declaración UTF-8, el `toFixed(2)` que no recorta
// ceros, y el `endLifespanVersion` autocerrado.

describe('F04 · AC1 · 4ª · el documento completo, byte a byte', () => {
  it('coincide con __snapshots__/parcela.gml', async () => {
    await expect(XML).toMatchFileSnapshot('__snapshots__/parcela.gml')
  })
})
