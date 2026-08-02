/* -------------------------------------------------------------------------- *
 * test/gml/decodificar.test.js — F08 · Bytes → texto (T1.1)                    *
 *                                                                              *
 * Lo que se está probando aquí no es «que la función devuelva lo que            *
 * devuelve»: es una INVERSIÓN de criterio, y hay un fichero real en el repo     *
 * que la justifica. `cp_parcela_9398516VK3799G.gml` —la respuesta del WFS del   *
 * Catastro— declara `encoding="ISO-8859-1"` y sus bytes son UTF-8. Hasta F08,   *
 * el único código que decodificaba un GML se fiaba de esa declaración, y sobre  *
 * ese fichero producía mojibake (`0xC3 0xB3` → `Ã³` en «precisión»). Nadie lo   *
 * notó en dos features porque la única palabra no-ASCII del documento está      *
 * dentro de un comentario XML.                                                  *
 *                                                                              *
 * De ahí la MITAD ANTI-VACUIDAD de este fichero, que es la parte que hace que   *
 * valga algo: no basta con afirmar que sale la detección `ENCODING_DESMENTIDO`  *
 * —eso lo cumpliría una función que emitiera la detección y decodificara mal    *
 * igual—. Hay que afirmar que la palabra «precisión» SE LEE BIEN, y que el      *
 * método viejo, aplicado a los mismos bytes, la rompe. Las dos cosas, juntas.   *
 *                                                                              *
 * Los casos que ningún fichero real cubre (BOM, latin-1 de verdad, bytes que    *
 * no son válidos en ninguna codificación) no se teclean como maquetas: se       *
 * DERIVAN de los GML reales —transcodificándolos, o quitándoles el prólogo—     *
 * para que sigan siendo documentos del Catastro con un defecto concreto. Es el  *
 * mismo criterio que `test/gml/parse.test.js` con sus mutaciones.               *
 *                                                                              *
 * Proyecto Vitest `node`: bytes, cadenas y POJOs, sin DOM.                      *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { decodificarGml } from '../../gml/decodificar.js'
import { SEVERIDAD, TIPO_GML } from '../../gml/_comun.js'

// ── Arnés ────────────────────────────────────────────────────────────────────
// `import.meta.dirname`, no `new URL(..., import.meta.url)` (convención del repo).

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')

const WFS = 'cp_parcela_9398516VK3799G.gml' // declara ISO-8859-1 y es UTF-8
const ENTREGA = 'cp_ejemplo_explicativo.gml' // declara utf-8 y es UTF-8
const EDIFICIO = 'bu_building_9398516VK3799G.gml' // declara ISO-8859-1 y es ASCII puro

/** Los bytes del fixture, SIN decodificar. Es el punto entero de esta tarea. */
const bytesDe = (nombre) => readFileSync(join(DIR_FIXTURES, nombre))

/**
 * La única palabra acentuada de `cp_parcela_9398516VK3799G.gml`, copiada del
 * comentario donde vive. Es el testigo de todo este fichero: `ó` son los bytes
 * `C3 B3`, y leerlos como latin-1 da `Ã³`. Que esté en un comentario XML es
 * justo por lo que la avería pasó dos features desapercibida.
 */
const FRASE_ACENTUADA = 'La precisión es la que corresponde nominalmente'

/**
 * EL MÉTODO VIEJO, reproducido tal cual para poder contrastarlo: leer el
 * `encoding` del prólogo y fiarse. Es lo que hacen hoy los helpers `leerGml` de
 * `parse.test.js` y `comun.test.js`, y lo que este módulo NO debe hacer. Vive
 * aquí para que la comparación sea una medida y no una afirmación.
 */
function comoLoHaciaElHelperViejo(bytes) {
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

/**
 * Transcodifica un texto a bytes latin-1, un carácter por byte. LANZA si algún
 * carácter no cabe: un fixture que se corrompiese al fabricarlo no probaría lo
 * que dice probar, probaría otra cosa parecida.
 */
function aLatin1(texto) {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const c = texto.codePointAt(i)
    if (c > 0xff) {
      throw new Error(`aLatin1: el carácter ${JSON.stringify(texto[i])} (U+${c.toString(16)}) no cabe en un byte`)
    }
    bytes[i] = c
  }
  return bytes
}

/** Bytes de un texto ASCII, para fabricar prólogos. */
const ascii = (texto) => aLatin1(texto)

/** Concatena tramos de bytes en un solo `Uint8Array`. */
function unir(...tramos) {
  const total = tramos.reduce((n, t) => n + t.length, 0)
  const salida = new Uint8Array(total)
  let i = 0
  for (const t of tramos) {
    salida.set(t, i)
    i += t.length
  }
  return salida
}

/** Los tipos de las detecciones, en orden. */
const tipos = (r) => r.detecciones.map((d) => d.tipo)

/** Las detecciones de una severidad concreta. */
const de = (r, severidad) => r.detecciones.filter((d) => d.severidad === severidad)

/** La (única) detección de un tipo, o `undefined`. */
const una = (r, tipo) => r.detecciones.find((d) => d.tipo === tipo)

// ── El arnés no miente ───────────────────────────────────────────────────────
// Si el fixture cambiara de bytes, o el método viejo dejara de romper nada,
// media docena de aserciones de abajo pasarían sin mirar nada.

describe('gml/decodificar · el arnés de este fichero no es vacuo', () => {
  it('el fixture del WFS sigue declarando ISO-8859-1 y trayendo bytes UTF-8', () => {
    const bytes = bytesDe(WFS)
    // El prólogo, leído del disco y no del enunciado de la tarea (regla de oro 8).
    expect(new TextDecoder('ascii').decode(bytes.subarray(0, 43))).toBe(
      '<?xml version="1.0" encoding="ISO-8859-1"?>',
    )
    // Y los bytes son UTF-8 válido: la prueba, hecha aquí a mano.
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).not.toThrow()
    // Con secuencias multibyte de verdad, que es lo que hace la mentira DEMOSTRABLE.
    const altos = [...bytes].filter((b) => b > 0x7f)
    expect(altos.length, 'el fixture ha perdido sus bytes no-ASCII').toBeGreaterThan(0)
  })

  it('el método viejo SÍ rompe «precisión» sobre ese fichero (por eso se invierte)', () => {
    const roto = comoLoHaciaElHelperViejo(bytesDe(WFS))
    expect(roto).toContain('precisiÃ³n')
    expect(roto).not.toContain('precisión')
  })

  it('`aLatin1` se niega a fabricar un fixture corrupto', () => {
    expect(() => aLatin1('café')).not.toThrow()
    expect(() => aLatin1('€')).toThrow(/no cabe en un byte/)
  })
})

// ── El contrato del programador ──────────────────────────────────────────────

describe('gml/decodificar · recibe BYTES, no texto (frontera SPEC §2.1)', () => {
  it('`decodificarGml("un string")` lanza TypeError', () => {
    // Igual que `parsearGml` lanza si le pasas algo que no es string: un texto
    // aquí significa que alguien ya decodificó y esa decisión se perdió, que es
    // exactamente el fallo que este módulo existe para impedir.
    expect(() => decodificarGml('un string')).toThrow(TypeError)
    expect(() => decodificarGml('un string')).toThrow(/ArrayBuffer o Uint8Array/)
  })

  it('lanza TypeError con null, undefined, número y objeto plano', () => {
    for (const basura of [null, undefined, 42, {}, [], new Map()]) {
      expect(() => decodificarGml(basura), JSON.stringify(String(basura))).toThrow(TypeError)
    }
  })

  it('acepta ArrayBuffer, Uint8Array y el Buffer de readFileSync, con el mismo texto', () => {
    const buffer = bytesDe(ENTREGA) // Buffer: es un Uint8Array con byteOffset
    const copia = Uint8Array.from(buffer)
    const desdeBuffer = decodificarGml(buffer)
    const desdeVista = decodificarGml(copia)
    const desdeArrayBuffer = decodificarGml(copia.buffer)
    expect(desdeVista.texto).toBe(desdeBuffer.texto)
    expect(desdeArrayBuffer.texto).toBe(desdeBuffer.texto)
  })

  it('unos bytes vacíos no lanzan: dan texto vacío y UTF-8', () => {
    // Un fichero de cero bytes es DATO MALO DEL USUARIO, no un bug: lo rechaza
    // `parsearGml` con su mensaje, no una excepción de aquí.
    const r = decodificarGml(new Uint8Array(0))
    expect(r.texto).toBe('')
    expect(r.encodingUsado).toBe('utf-8')
    expect(r.encodingDeclarado).toBeNull()
    expect(r.detecciones).toEqual([])
  })
})

// ── Regla 1 · El BOM manda, y se consume ─────────────────────────────────────

describe('gml/decodificar · el BOM manda sobre el prólogo y no se queda en el texto', () => {
  const DOC = '<?xml version="1.0" encoding="UTF-16"?><a>ñó€</a>'

  /** El documento en UTF-16, byte a byte, con su marca delante. */
  function utf16(texto, { grande }) {
    const bytes = [grande ? 0xfe : 0xff, grande ? 0xff : 0xfe]
    for (const ch of texto) {
      const c = ch.charCodeAt(0)
      bytes.push(grande ? c >> 8 : c & 0xff, grande ? c & 0xff : c >> 8)
    }
    return Uint8Array.from(bytes)
  }

  it('BOM de UTF-8: se consume y el texto sale limpio', () => {
    const doc = '<?xml version="1.0" encoding="utf-8"?><a>ñó€</a>'
    const r = decodificarGml(unir(Uint8Array.from([0xef, 0xbb, 0xbf]), new TextEncoder().encode(doc)))
    expect(r.texto).toBe(doc)
    expect(r.texto.startsWith('﻿'), 'el BOM se ha colado en el texto').toBe(false)
    expect(r.texto.startsWith('<?xml')).toBe(true)
    expect(r.encodingUsado).toBe('utf-8')
    expect(tipos(r)).toContain(TIPO_GML.BOM_PRESENTE)
    expect(una(r, TIPO_GML.BOM_PRESENTE).datos).toMatchObject({ bom: 'UTF-8', longitudBom: 3 })
    expect(una(r, TIPO_GML.BOM_PRESENTE).severidad).toBe(SEVERIDAD.INFO)
  })

  it('BOM de UTF-16LE: se consume y el texto sale limpio', () => {
    const r = decodificarGml(utf16(DOC, { grande: false }))
    expect(r.texto).toBe(DOC)
    expect(r.encodingUsado).toBe('utf-16le')
    expect(una(r, TIPO_GML.BOM_PRESENTE).datos.bom).toBe('UTF-16LE')
  })

  it('BOM de UTF-16BE: se consume y el texto sale limpio', () => {
    const r = decodificarGml(utf16(DOC, { grande: true }))
    expect(r.texto).toBe(DOC)
    expect(r.encodingUsado).toBe('utf-16be')
    expect(una(r, TIPO_GML.BOM_PRESENTE).datos.bom).toBe('UTF-16BE')
  })

  it('en UTF-16 el prólogo se lee con el alfabeto del BOM, no «como ASCII»', () => {
    // Si la cabecera se leyera como ASCII, el `00` entre cada letra daría basura
    // y un fichero que declara su encoding correctamente parecería no declarar
    // nada. `encodingDeclarado` es lo que la UI enseña: tiene que ser cierto.
    for (const grande of [false, true]) {
      expect(decodificarGml(utf16(DOC, { grande })).encodingDeclarado).toBe('UTF-16')
    }
  })

  it('«UTF-16» a secas con BOM NO es un desmentido, sea LE o BE', () => {
    // El estándar canoniza la etiqueta `utf-16` a `utf-16le`; acusar de mentir a
    // un fichero UTF-16BE que declara `UTF-16` —que es lo correcto, porque el
    // BOM es justamente lo que dice cuál de las dos es— sería un falso positivo.
    for (const grande of [false, true]) {
      expect(tipos(decodificarGml(utf16(DOC, { grande })))).not.toContain(
        TIPO_GML.ENCODING_DESMENTIDO,
      )
    }
  })

  it('el BOM gana al prólogo cuando se contradicen, y lo dice', () => {
    // UTF-8 real, con marca de UTF-8, pero declarando latin-1. Manda la marca.
    const doc = '<?xml version="1.0" encoding="ISO-8859-1"?><a>ñó</a>'
    const r = decodificarGml(unir(Uint8Array.from([0xef, 0xbb, 0xbf]), new TextEncoder().encode(doc)))
    expect(r.texto).toBe(doc)
    expect(r.encodingUsado).toBe('utf-8')
    expect(r.encodingDeclarado).toBe('ISO-8859-1')
    expect(tipos(r)).toContain(TIPO_GML.ENCODING_DESMENTIDO)
    expect(una(r, TIPO_GML.ENCODING_DESMENTIDO).mensaje).toMatch(/marca de orden de bytes/)
  })

  it('solo se consume UNA marca: una segunda es un carácter del documento', () => {
    // U+FEFF repetido no es «dos BOM»: el segundo es contenido, y comérselo sería
    // modificar el fichero del usuario en silencio.
    const bom = Uint8Array.from([0xef, 0xbb, 0xbf])
    const r = decodificarGml(unir(bom, bom, ascii('<a/>')))
    expect(r.texto).toBe('﻿<a/>')
  })
})

// ── Regla 2 y 3 · EL FICHERO REAL QUE MIENTE ─────────────────────────────────

describe('gml/decodificar · el GML del WFS declara ISO-8859-1 y sus bytes son UTF-8', () => {
  const r = decodificarGml(bytesDe(WFS))

  it('(a) `encodingDeclarado` es lo que pone el fichero: ISO-8859-1', () => {
    expect(r.encodingDeclarado).toBe('ISO-8859-1')
  })

  it('(b) `encodingUsado` es utf-8: mandan los bytes, no la etiqueta', () => {
    expect(r.encodingUsado).toBe('utf-8')
  })

  it('(c) sale la detección ENCODING_DESMENTIDO, con las DOS formas en `datos`', () => {
    const d = una(r, TIPO_GML.ENCODING_DESMENTIDO)
    expect(d, 'no se ha reportado la discrepancia (regla de oro 1)').toBeDefined()
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos.encodingDeclarado).toBe('ISO-8859-1')
    expect(d.datos.encodingUsado).toBe('utf-8')
    expect(d.mensaje).toContain('ISO-8859-1')
  })

  it('(d) y la palabra «precisión» aparece BIEN ESCRITA en el texto', () => {
    // Sin esta aserción el test no demuestra nada: una implementación que
    // emitiera la detección y decodificara mal igual pasaría las tres de arriba.
    expect(r.texto).toContain(FRASE_ACENTUADA)
    expect(r.texto).not.toContain('Ã')
    expect(r.texto).not.toContain('�')
  })

  it('y el texto es EXACTAMENTE el que da UTF-8 estricto sobre esos bytes', () => {
    const bytes = bytesDe(WFS)
    expect(r.texto).toBe(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    // …y NO el que daba el método viejo. Aquí se cierra la inversión.
    expect(r.texto).not.toBe(comoLoHaciaElHelperViejo(bytes))
  })

  it('también sale ENCODING_DECLARADO como INFO: no se pierde lo que dice el prólogo', () => {
    const d = una(r, TIPO_GML.ENCODING_DECLARADO)
    expect(d).toBeDefined()
    expect(d.severidad).toBe(SEVERIDAD.INFO)
    expect(d.datos.encodingDeclarado).toBe('ISO-8859-1')
  })
})

// ── Los fixtures honestos no se acusan de nada ───────────────────────────────

describe('gml/decodificar · un fichero que dice la verdad no genera avisos', () => {
  it('cp_ejemplo_explicativo.gml (utf-8 declarado, UTF-8 real) no produce ningún aviso', () => {
    const r = decodificarGml(bytesDe(ENTREGA))
    expect(r.encodingDeclarado).toBe('utf-8')
    expect(r.encodingUsado).toBe('utf-8')
    expect(de(r, SEVERIDAD.AVISO)).toEqual([])
    expect(de(r, SEVERIDAD.ERROR)).toEqual([])
    expect(tipos(r)).toEqual([TIPO_GML.ENCODING_DECLARADO])
    // Y el texto es correcto: el fixture trae acentos de verdad fuera de comentarios.
    expect(r.texto).not.toContain('�')
    expect(r.texto).toBe(new TextDecoder('utf-8', { fatal: true }).decode(bytesDe(ENTREGA)))
  })

  it('un GML íntegramente ASCII no se acusa de mentir, declare lo que declare', () => {
    // MEDIDO, y es la razón de que el desmentido exija PRUEBA: los dos `bu_*.gml`
    // reales declaran ISO-8859-1 y no tienen ni un byte por encima de 0x7F, así
    // que los dos decodificadores dan el MISMO texto. No hay mentira demostrable
    // y marcarlos sería una acusación que no se sostiene.
    const bytes = bytesDe(EDIFICIO)
    expect([...bytes].every((b) => b < 0x80), 'el fixture ha dejado de ser ASCII puro').toBe(true)
    const r = decodificarGml(bytes)
    expect(r.encodingDeclarado).toBe('ISO-8859-1')
    expect(r.encodingUsado).toBe('utf-8')
    expect(de(r, SEVERIDAD.AVISO)).toEqual([])
    // Y la mitad anti-vacuidad: sobre el fixture que SÍ tiene bytes altos, avisa.
    expect(tipos(decodificarGml(bytesDe(WFS)))).toContain(TIPO_GML.ENCODING_DESMENTIDO)
  })

  it('los alias del mismo decodificador tampoco son un desmentido', () => {
    // `ISO-8859-1`, `latin1` y `windows-1252` son la MISMA cosa para el estándar
    // Encoding: `new TextDecoder('ISO-8859-1').encoding` devuelve 'windows-1252'.
    for (const alias of ['ISO-8859-1', 'latin1', 'windows-1252', 'iso-8859-1']) {
      const bytes = unir(ascii(`<?xml version="1.0" encoding="${alias}"?><a>`), Uint8Array.from([0xf1]), ascii('</a>'))
      const r = decodificarGml(bytes)
      expect(r.encodingUsado, alias).toBe('windows-1252')
      expect(tipos(r), alias).not.toContain(TIPO_GML.ENCODING_DESMENTIDO)
    }
  })
})

// ── Regla 4 · Un latin-1 de verdad ───────────────────────────────────────────

describe('gml/decodificar · cuando los bytes NO son UTF-8, se usa el declarado', () => {
  it('un `ñ` en 0xF1 con prólogo ISO-8859-1: UTF-8 estricto falla y se decodifica bien', () => {
    // Se arma byte a byte para que el 0xF1 esté donde dice el nombre del test:
    // un `ñ` en latin-1 es UN byte, y en UTF-8 serían dos (`C3 B1`).
    const doc = unir(
      ascii('<?xml version="1.0" encoding="ISO-8859-1"?><a>Pe'),
      Uint8Array.from([0xf1]),
      ascii('a</a>'),
    )
    expect(doc).toContain(0xf1)
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(doc)).toThrow()

    const r = decodificarGml(doc)
    expect(r.texto).toBe('<?xml version="1.0" encoding="ISO-8859-1"?><a>Peña</a>')
    expect(r.encodingDeclarado).toBe('ISO-8859-1')
    // MEDIDO: el estándar WHATWG Encoding no tiene decodificador `iso-8859-1`;
    // esa etiqueta mapea a windows-1252, que es su superconjunto. `encodingUsado`
    // dice lo que se usó DE VERDAD, no la etiqueta que puso el fichero.
    expect(r.encodingUsado).toBe('windows-1252')
    expect(tipos(r)).not.toContain(TIPO_GML.ENCODING_SUPUESTO)
    expect(tipos(r)).not.toContain(TIPO_GML.ENCODING_DESMENTIDO)
    expect(r.texto).not.toContain('�')
  })

  it('el GML real del WFS transcodificado a latin-1 de verdad se lee sin romperse', () => {
    // El espejo del caso de arriba, y sobre un documento del Catastro entero: los
    // mismos caracteres, escritos como los escribiría una herramienta que sí
    // respetara su propia declaración.
    const original = new TextDecoder('utf-8', { fatal: true }).decode(bytesDe(WFS))
    const bytes = aLatin1(original)
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toThrow()

    const r = decodificarGml(bytes)
    expect(r.encodingDeclarado).toBe('ISO-8859-1')
    expect(r.encodingUsado).toBe('windows-1252')
    expect(r.texto).toBe(original)
    expect(r.texto).toContain(FRASE_ACENTUADA)
    expect(de(r, SEVERIDAD.AVISO)).toEqual([])
  })

  it('un encoding declarado exótico pero RECONOCIDO se respeta (no se supone nada)', () => {
    const doc = unir(
      ascii('<?xml version="1.0" encoding="ISO-8859-15"?><a>'),
      Uint8Array.from([0xa4]), // el símbolo del euro en latin-9
      ascii('</a>'),
    )
    const r = decodificarGml(doc)
    expect(r.encodingUsado).toBe('iso-8859-15')
    expect(r.texto).toContain('<a>€</a>')
    expect(tipos(r)).not.toContain(TIPO_GML.ENCODING_SUPUESTO)
  })
})

// ── Regla 4 (cont.) · Nunca en silencio: ENCODING_SUPUESTO ───────────────────

describe('gml/decodificar · sin nada en que apoyarse se supone, y SE DICE', () => {
  it('bytes que no son UTF-8 válido y sin prólogo: windows-1252 y ENCODING_SUPUESTO', () => {
    // Derivado del fichero real: se transcodifica a latin-1 y se le quita la
    // declaración entera, que es lo que hace media herramienta de escritorio.
    const original = new TextDecoder('utf-8', { fatal: true }).decode(bytesDe(WFS))
    const sinPrologo = original.replace(/^<\?xml[^?]*\?>\s*/, '')
    const bytes = aLatin1(sinPrologo)
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toThrow()

    const r = decodificarGml(bytes)
    expect(r.encodingDeclarado).toBeNull()
    expect(r.encodingUsado).toBe('windows-1252')
    expect(r.texto).toBe(sinPrologo)
    expect(r.texto).toContain(FRASE_ACENTUADA)

    const d = una(r, TIPO_GML.ENCODING_SUPUESTO)
    expect(d, 'se ha decodificado a ojo y sin decirlo (regla de oro 1)').toBeDefined()
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos).toMatchObject({ encodingDeclarado: null, encodingUsado: 'windows-1252' })
    expect(d.mensaje).toMatch(/no declara ninguna codificación/)
    expect(d.mensaje).toMatch(/windows-1252/)
  })

  it('un encoding declarado que el estándar no reconoce: se supone, con su motivo', () => {
    const doc = unir(
      ascii('<?xml version="1.0" encoding="cp-de-la-casa"?><a>'),
      Uint8Array.from([0xf1]),
      ascii('</a>'),
    )
    // El nombre no existe de verdad: si algún día lo reconociera, este test
    // dejaría de probar el caso que dice probar.
    expect(() => new TextDecoder('cp-de-la-casa')).toThrow(RangeError)

    const r = decodificarGml(doc)
    expect(r.encodingDeclarado).toBe('cp-de-la-casa')
    expect(r.encodingUsado).toBe('windows-1252')
    expect(r.texto).toContain('<a>ñ</a>')
    expect(una(r, TIPO_GML.ENCODING_SUPUESTO).mensaje).toMatch(/no reconoce/)
  })

  it('declara UTF-8 y no lo es: NO se reintenta UTF-8, que sembraría U+FFFD', () => {
    // El caso más traicionero: volver a decodificar con lo declarado —ya sin
    // `fatal`— cambiaría cada byte inválido por U+FFFD sin una sola queja, y el
    // dato entraría corrupto en el expediente. Se supone la reserva y se avisa.
    const doc = unir(
      ascii('<?xml version="1.0" encoding="UTF-8"?><a>'),
      Uint8Array.from([0xf1]),
      ascii('</a>'),
    )
    const r = decodificarGml(doc)
    expect(r.encodingDeclarado).toBe('UTF-8')
    expect(r.encodingUsado).toBe('windows-1252')
    expect(r.texto).toContain('<a>ñ</a>')
    expect(r.texto).not.toContain('�')
    expect(una(r, TIPO_GML.ENCODING_SUPUESTO).mensaje).toMatch(/declara UTF-8/)
    // Y NO se duplica el mensaje: el desmentido diría lo mismo con otras palabras.
    expect(tipos(r)).not.toContain(TIPO_GML.ENCODING_DESMENTIDO)
  })
})

// ── Regla 5 · El prólogo, y solo el prólogo ──────────────────────────────────

describe('gml/decodificar · el prólogo se lee sobre los primeros 256 bytes', () => {
  it('acepta comillas simples, que XML permite igual', () => {
    const doc = unir(ascii("<?xml version='1.0' encoding='ISO-8859-1'?><a>"), Uint8Array.from([0xf1]), ascii('</a>'))
    const r = decodificarGml(doc)
    expect(r.encodingDeclarado).toBe('ISO-8859-1')
    expect(r.encodingUsado).toBe('windows-1252')
  })

  it('un prólogo que no cabe en los primeros 256 bytes NO es un prólogo', () => {
    const relleno = ' '.repeat(300)
    const r = decodificarGml(ascii(`${relleno}<?xml version="1.0" encoding="ISO-8859-1"?><a/>`))
    expect(r.encodingDeclarado).toBeNull()
    // Mitad anti-vacuidad: con un relleno corto SÍ lo encuentra.
    const cerca = decodificarGml(ascii(`${' '.repeat(10)}<?xml version="1.0" encoding="ISO-8859-1"?><a/>`))
    expect(cerca.encodingDeclarado).toBe('ISO-8859-1')
  })

  it('una declaración cortada por el límite tampoco cuenta', () => {
    // Empieza dentro de los 256 bytes y termina fuera: no hay `?>` que leer.
    const declaracion = '<?xml version="1.0" encoding="ISO-8859-1"?>'
    const relleno = ' '.repeat(256 - declaracion.length + 5)
    expect(decodificarGml(ascii(relleno + declaracion + '<a/>')).encodingDeclarado).toBeNull()
  })

  it('un `encoding="…"` que NO está en la declaración no se toma por el prólogo', () => {
    // Un comentario o un atributo cualquiera puede llevar ese texto. Solo cuenta
    // lo que hay dentro del `<?xml … ?>`, que en XML es lo primero del documento.
    const r = decodificarGml(ascii('<a xmlns:x="urn:x" encoding="ISO-8859-1"><b/></a>'))
    expect(r.encodingDeclarado).toBeNull()
    expect(r.encodingUsado).toBe('utf-8')
    expect(r.detecciones).toEqual([])
  })

  it('un fichero sin prólogo y con bytes UTF-8 no dice nada: XML ya asume UTF-8', () => {
    const r = decodificarGml(new TextEncoder().encode('<a>ñó€</a>'))
    expect(r.texto).toBe('<a>ñó€</a>')
    expect(r.encodingDeclarado).toBeNull()
    expect(r.encodingUsado).toBe('utf-8')
    expect(r.detecciones).toEqual([])
  })
})

// ── La forma de lo que se devuelve ───────────────────────────────────────────

describe('gml/decodificar · el contrato de salida se cumple en todos los fixtures', () => {
  const FIXTURES = [
    WFS,
    ENTREGA,
    EDIFICIO,
    'bu_buildingpart_9398516VK3799G.gml',
    'UTM_1.gml',
  ]

  it('devuelve las cuatro claves, con los tipos declarados', () => {
    for (const nombre of FIXTURES) {
      const r = decodificarGml(bytesDe(nombre))
      expect(Object.keys(r).sort(), nombre).toEqual([
        'detecciones',
        'encodingDeclarado',
        'encodingUsado',
        'texto',
      ])
      expect(typeof r.texto, nombre).toBe('string')
      expect(typeof r.encodingUsado, nombre).toBe('string')
      expect(Array.isArray(r.detecciones), nombre).toBe(true)
    }
  })

  it('toda detección es del vocabulario de TIPO_GML y tiene mensaje en castellano', () => {
    const tiposValidos = Object.values(TIPO_GML)
    const sevsValidas = Object.values(SEVERIDAD)
    for (const nombre of FIXTURES) {
      for (const d of decodificarGml(bytesDe(nombre)).detecciones) {
        expect(tiposValidos, `${nombre} → ${d.tipo}`).toContain(d.tipo)
        expect(sevsValidas, `${nombre} → ${d.severidad}`).toContain(d.severidad)
        expect(d.mensaje.length, `${nombre} → ${d.tipo} sin mensaje`).toBeGreaterThan(0)
      }
    }
  })

  it('ninguno de los cinco fixtures reales sale con una detección de ERROR', () => {
    // Son ficheros legítimos: el módulo no tiene nada que reprocharles a nivel de
    // bytes. Si esto se pone rojo, o el módulo se ha vuelto quisquilloso o ha
    // entrado un fixture que no es lo que dice ser.
    for (const nombre of FIXTURES) {
      expect(de(decodificarGml(bytesDe(nombre)), SEVERIDAD.ERROR), nombre).toEqual([])
    }
  })

  it('los tres tipos nuevos existen en TIPO_GML y valen su propio nombre', () => {
    expect(TIPO_GML.BOM_PRESENTE).toBe('BOM_PRESENTE')
    expect(TIPO_GML.ENCODING_DESMENTIDO).toBe('ENCODING_DESMENTIDO')
    expect(TIPO_GML.ENCODING_SUPUESTO).toBe('ENCODING_SUPUESTO')
  })
})
