/* -------------------------------------------------------------------------- *
 * test/gml/descargar.dom.test.js — F04 · T5.1 · la ENTREGA del GML             *
 *                                                                              *
 * `gml/descargar.js` es el último metro de F04, y es el sitio donde el trabajo  *
 * de toda la feature se puede perder sin que nada salga rojo: un fichero con    *
 * los bytes mal codificados se ve perfecto en el editor de quien lo generó y la *
 * Sede lo rechaza; una URL de objeto sin revocar no se nota hasta la vigésima   *
 * descarga; un nombre con `/` o `..` no llega a existir; y un GML de 0 bytes en *
 * la carpeta de descargas MIENTE — aparenta que la operación salió bien.        *
 *                                                                              *
 * ── LAS TRES DECISIONES DE DISEÑO DE ESTE FICHERO ──                           *
 *                                                                              *
 * 1. LA CODIFICACIÓN SE COMPRUEBA DECODIFICANDO. La spec de F04 pide «Fichero   *
 *    UTF-8 (encoding declarado == bytes reales)». Afirmar eso mirando el        *
 *    `charset=utf-8` del tipo MIME del Blob sería comprobar la ETIQUETA, no el  *
 *    contenido: exactamente el fallo que la spec describe. Aquí se saca el      *
 *    `arrayBuffer()` y se comparan los BYTES con los de un `TextEncoder`, con   *
 *    un XML lleno de acentos, `ñ`, `²` y `€` para que un fallo de codificación  *
 *    tenga dónde manifestarse. Hay además una prueba de NO VACUIDAD (el mismo   *
 *    buffer leído como latin-1 NO da el texto original), porque una comparación *
 *    de bytes sobre ASCII puro pasaría igual estando todo mal.                  *
 *                                                                              *
 * 2. EL OBJETO-URL SE OBSERVA CON UN DOBLE INYECTADO, y hay un hallazgo medido  *
 *    detrás. jsdom por su cuenta (`new JSDOM(...)`) NO implementa               *
 *    `URL.createObjectURL` ni `URL.revokeObjectURL`; bajo el entorno `jsdom` de *
 *    Vitest, en cambio, el `URL` global es el de Node, que SÍ los implementa.   *
 *    Las dos cosas se afirman abajo en vez de darse por supuestas, porque de    *
 *    ellas depende toda la estrategia. Con el global REAL disponible, el camino *
 *    completo se ejercita de verdad (hay una prueba que lo hace, con `vi.spyOn` *
 *    sobre la revocación), pero el grueso de las pruebas usa un `url` inyectado *
 *    por dos razones: es el único sitio desde el que se puede AGARRAR el Blob   *
 *    —que es lo que hay que decodificar— y parchear el `URL` global desde un    *
 *    fichero de test contamina a los demás si un `afterEach` falla.             *
 *    La degradación se prueba aparte y a propósito, afirmando el `motivo`: el   *
 *    módulo no se ha debilitado para el test.                                   *
 *                                                                              *
 * 3. `click()` TAMBIÉN SE ESPÍA, y no por comodidad: el `click()` heredado de   *
 *    jsdom sobre un `<a href="blob:…">` intenta navegar y escupe un             *
 *    «Not implemented: navigation» por consola sin descargar nada. El           *
 *    `documento` inyectado devuelve elementos REALES del DOM (con su `href`,    *
 *    su `download`, su `isConnected` y su `remove()` de verdad) y solo sustituye *
 *    el `click`. Así el anchor que se afirma es el anchor que el módulo usó.    *
 *                                                                              *
 * Nada aquí está escrito a mano dos veces: la referencia catastral se lee del   *
 * NOMBRE del fixture real del WFS, la marca de tiempo se deriva de              *
 * `dateTimeCatastro`, la entrada sucia se construye con la lista de caracteres  *
 * prohibidos que exporta el módulo y los nombres reservados de Windows se       *
 * recorren con `it.each` sobre la constante exportada.                          *
 *                                                                              *
 * Sufijo `.dom` a propósito: hacen falta `document`, `Blob` y `TextDecoder`, y  *
 * el proyecto Vitest `dom` (jsdom) es quien los da. La guarda de partición de   *
 * `test/contrato.test.js` acepta un `*.dom.test.js` dentro de `test/gml/` sin   *
 * tocar nada: enruta por SUFIJO, no por directorio.                             *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  EXTENSION_GML,
  TIPO_MIME_GML,
  SUSTITUTO_NOMBRE,
  SEPARADOR_NOMBRE,
  PREFIJO_NOMBRE,
  MARCA_SIN_REFCAT,
  MARCA_REFCAT_ILEGIBLE,
  LONGITUD_MAXIMA_SEGMENTO,
  CARACTERES_PROHIBIDOS_WINDOWS,
  NOMBRES_RESERVADOS_WINDOWS,
  MOTIVO_NO_DESCARGADO,
  nombreFicheroGml,
  descargarGml,
} from '../../gml/descargar.js'
import { dateTimeCatastro } from '../../gml/_comun.js'

// ── Datos derivados del disco y del propio módulo ────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')

/**
 * Referencia catastral REAL, leída del nombre del fixture 4.0 del WFS
 * (`cp_parcela_9398516VK3799G.gml`) y no tecleada aquí. Da igual para el saneado
 * que sea real o inventada, pero una RC de verdad tiene la propiedad que importa
 * en este fichero: empieza por dígito y mezcla letras y números, que es la forma
 * exacta que el saneado debe dejar INTACTA.
 */
const REFCAT = (() => {
  const fichero = readdirSync(DIR_FIXTURES).find((f) => /^cp_parcela_.+\.gml$/.test(f))
  if (fichero === undefined) {
    throw new Error(
      `test/gml/descargar.dom.test.js: no hay ningún fixture «cp_parcela_*.gml» en ${DIR_FIXTURES}; ` +
        'de ahí se lee la referencia catastral con la que se prueba el nombre de fichero.',
    )
  }
  return fichero.replace(/^cp_parcela_/, '').replace(/\.gml$/, '')
})()

/**
 * Instante fijo. El módulo NO consulta el reloj (hay una prueba al final que lo
 * comprueba sobre su texto), así que el nombre de fichero es reproducible y este
 * fichero puede afirmar cosas exactas sobre él.
 */
const FECHA = new Date(Date.UTC(2026, 6, 27, 11, 45, 30))

/** La marca de tiempo del nombre, DERIVADA del formato que va dentro del GML. */
const MARCA_TIEMPO = dateTimeCatastro(FECHA).split(':').join(SUSTITUTO_NOMBRE)

/**
 * GML de mentira, pero con la carga útil que importa: prólogo que DECLARA UTF-8
 * y texto con acentos, `ñ`, superíndice y un símbolo de tres bytes. Si la
 * codificación se estropeara en cualquier punto, se vería aquí.
 */
const XML_ACENTUADO =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<cp:CadastralParcel>\n' +
  '  <cp:label>Peña del Cañón — Añón de Moncayo</cp:label>\n' +
  '  <!-- superficie 1.535,87 m² · ÁÉÍÓÚ · coste 0 € -->\n' +
  '</cp:CadastralParcel>\n'

// ── Ayudas de lectura del nombre ─────────────────────────────────────────────

/** El nombre sin extensión: es lo que Windows compara con sus reservados. */
const baseDe = (nombre) => nombre.slice(0, -EXTENSION_GML.length)

/**
 * Las partes del nombre. Se puede partir por {@link SEPARADOR_NOMBRE} sin
 * ambigüedad porque ese carácter NO pertenece al repertorio de un segmento: el
 * módulo lo eligió justamente por eso.
 */
const partesDe = (nombre) => baseDe(nombre).split(SEPARADOR_NOMBRE)

/**
 * ¿Queda algún carácter de control (C0 o DEL) en la cadena? Se comprueba por
 * PUNTO DE CÓDIGO y no con una expresión regular a propósito: escribir esos
 * caracteres en el fuente —aunque sea dentro de una clase— deja el fichero con
 * bytes invisibles que ningún revisor puede ver en un diff.
 */
const tieneControl = (s) =>
  [...s].some((c) => {
    const punto = c.codePointAt(0)
    return punto < 0x20 || punto === 0x7f
  })

// ── Dobles del entorno ───────────────────────────────────────────────────────

/**
 * Un `url` que sí sabe crear y revocar objetos-URL, con memoria de todo lo que
 * pasó por él. Inyectarlo (en vez de parchear el `URL` global) evita contaminar
 * a los demás ficheros de test y hace imposible olvidarse de restaurarlo.
 */
function crearUrlEspia() {
  const creados = []
  const revocados = []
  return {
    creados,
    revocados,
    url: {
      createObjectURL(blob) {
        const href = `blob:https://concreta.test/${creados.length}`
        creados.push({ blob, href })
        return href
      },
      revokeObjectURL(href) {
        revocados.push(href)
      },
    },
  }
}

/**
 * Un `documento` que delega en el DOM REAL de jsdom y solo sustituye el `click()`
 * de los anchors que crea (ver la decisión 3 de la cabecera). Todo lo demás del
 * elemento —`href`, `download`, `hidden`, `isConnected`, `remove()`— es de verdad,
 * así que lo que se afirme sobre el anchor vale para el navegador.
 *
 * @param {(anchor: HTMLAnchorElement) => void} [alHacerClick]
 */
function crearDocumentoEspia(alHacerClick = () => {}) {
  const anclas = []
  return {
    anclas,
    documento: {
      body: document.body,
      createElement(etiqueta) {
        const el = document.createElement(etiqueta)
        if (etiqueta === 'a') {
          anclas.push(el)
          el.click = () => alHacerClick(el)
        }
        return el
      },
    },
  }
}

/**
 * Prepara una descarga con los dos dobles enchufados y devuelve `ejecutar` SIN
 * llamarla, para que las pruebas que esperan una excepción puedan pasársela a
 * `expect(...).toThrow()` tal cual.
 */
function prepararDescarga(xml, { refcat = null, alHacerClick } = {}) {
  const espiaUrl = crearUrlEspia()
  const espiaDoc = crearDocumentoEspia(alHacerClick)
  return {
    creados: espiaUrl.creados,
    revocados: espiaUrl.revocados,
    anclas: espiaDoc.anclas,
    ejecutar: () =>
      descargarGml(xml, {
        refcat,
        fecha: FECHA,
        documento: espiaDoc.documento,
        url: espiaUrl.url,
      }),
  }
}

/** Entorno válido y mudo, para las pruebas de guardas. */
const entornoValido = () => ({
  documento: crearDocumentoEspia().documento,
  url: crearUrlEspia().url,
})

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── nombreFicheroGml · función pura ──────────────────────────────────────────

describe('gml/descargar · nombreFicheroGml, la parte que no necesita DOM', () => {
  it('con referencia: prefijo, la RC entera y la marca de tiempo, en ese orden', () => {
    const nombre = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA })
    expect(nombre.endsWith(EXTENSION_GML)).toBe(true)
    expect(partesDe(nombre)).toEqual([PREFIJO_NOMBRE, REFCAT, MARCA_TIEMPO])
  })

  it('la marca de tiempo es la MISMA que va dentro del fichero, sin los «:» (Windows)', () => {
    // El emparejamiento fichero ↔ contenido depende de que sean la misma cadena:
    // si algún día el nombre usara otro formato de fecha, esta prueba lo dice.
    const dentroDelGml = dateTimeCatastro(FECHA)
    expect(dentroDelGml).toContain(':') // el de dentro SÍ los lleva…
    const nombre = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA })
    expect(nombre).not.toContain(':') // …y el de fuera no puede llevarlos
    expect(nombre).toContain(dentroDelGml.split(':').join(SUSTITUTO_NOMBRE))
  })

  it.each([
    ['null (alta nueva)', null],
    ['ausente', undefined],
    ['cadena vacía', ''],
    ['solo espacios', '   \t\n'],
  ])('sin referencia (%s) ⇒ marca honesta, no una RC inventada', (_caso, refcat) => {
    const nombre = nombreFicheroGml({ refcat, fecha: FECHA })
    expect(partesDe(nombre)).toEqual([PREFIJO_NOMBRE, MARCA_SIN_REFCAT, MARCA_TIEMPO])
  })

  it.each([
    ['solo barras', '///'],
    ['solo puntos', '..'],
    ['solo signos prohibidos', CARACTERES_PROHIBIDOS_WINDOWS],
  ])(
    'una referencia de la que no sobrevive nada (%s) NO se confunde con no haberla dado',
    (_caso, refcat) => {
      // Decir «sin referencia» de una parcela cuyo usuario SÍ escribió algo sería
      // mentir sobre lo que él hizo: son dos marcas distintas a propósito.
      expect(MARCA_REFCAT_ILEGIBLE).not.toBe(MARCA_SIN_REFCAT)
      const nombre = nombreFicheroGml({ refcat, fecha: FECHA })
      expect(partesDe(nombre)).toEqual([PREFIJO_NOMBRE, MARCA_REFCAT_ILEGIBLE, MARCA_TIEMPO])
    },
  )

  it('una referencia SUCIA queda saneada y el dato útil sobrevive', () => {
    // La entrada se construye con la lista que exporta el módulo, más las dos
    // formas de ruta relativa y espacios en blanco de todo tipo.
    const sucia = ` ..${CARACTERES_PROHIBIDOS_WINDOWS}../..\t${REFCAT} \n`
    const nombre = nombreFicheroGml({ refcat: sucia, fecha: FECHA })

    for (const caracter of CARACTERES_PROHIBIDOS_WINDOWS) {
      expect(nombre, `sobrevivió el carácter prohibido «${caracter}»`).not.toContain(caracter)
    }
    expect(nombre, 'un «..» convierte el nombre en una ruta relativa').not.toContain('..')
    expect(nombre, 'espacios en un nombre de fichero').not.toMatch(/\s/)
    expect(tieneControl(nombre), 'caracteres de control').toBe(false)
    // …y con todo, la referencia sigue ahí y el nombre sigue teniendo tres partes.
    expect(nombre).toContain(REFCAT)
    expect(partesDe(nombre)).toEqual([PREFIJO_NOMBRE, REFCAT, MARCA_TIEMPO])
  })

  it('la entrada sucia de la prueba anterior NO es vacua: lleva todo lo prohibido', () => {
    // Si `CARACTERES_PROHIBIDOS_WINDOWS` se vaciara, la prueba de arriba pasaría
    // sin comprobar nada. Aquí se afirma que hay lista y que ninguno de sus
    // caracteres está en el repertorio que un nombre saneado admite.
    expect(CARACTERES_PROHIBIDOS_WINDOWS.length).toBeGreaterThan(0)
    for (const caracter of CARACTERES_PROHIBIDOS_WINDOWS) {
      expect(/[A-Za-z0-9]/.test(caracter)).toBe(false)
    }
  })

  it.each(NOMBRES_RESERVADOS_WINDOWS)(
    'la referencia «%s» es un nombre reservado de Windows y queda neutralizada',
    (reservado) => {
      for (const variante of [reservado, reservado.toLowerCase()]) {
        const nombre = nombreFicheroGml({ refcat: variante, fecha: FECHA })
        // La reserva de Windows se aplica al componente COMPLETO de la ruta e
        // ignora mayúsculas; también sigue viva con extensión (`CON.gml`).
        expect(NOMBRES_RESERVADOS_WINDOWS).not.toContain(baseDe(nombre).toUpperCase())
        for (const parte of partesDe(nombre)) {
          expect(NOMBRES_RESERVADOS_WINDOWS, `la parte «${parte}» sigue reservada`).not.toContain(
            parte.toUpperCase(),
          )
        }
        // Neutralizar no es borrar: lo que el usuario escribió sigue reconocible.
        expect(nombre.toUpperCase()).toContain(reservado.toUpperCase())
      }
    },
  )

  it('la lista de reservados cubre las dos familias numeradas y no está vacía', () => {
    // No vacua: si la lista se quedara corta, el `it.each` de arriba recorrería
    // menos casos sin que nada se pusiera rojo.
    expect(NOMBRES_RESERVADOS_WINDOWS.length).toBeGreaterThan(0)
    for (const familia of ['COM', 'LPT']) {
      const numerados = NOMBRES_RESERVADOS_WINDOWS.filter((n) => n.startsWith(familia))
      expect(numerados.map((n) => n.slice(familia.length)).sort()).toEqual(
        Array.from({ length: 10 }, (_, i) => String(i)).sort(),
      )
    }
  })

  it('una referencia absurdamente larga se recorta: un nombre no es un campo libre', () => {
    const larga = 'A'.repeat(LONGITUD_MAXIMA_SEGMENTO * 5)
    const nombre = nombreFicheroGml({ refcat: larga, fecha: FECHA })
    for (const parte of partesDe(nombre)) {
      expect(parte.length).toBeLessThanOrEqual(LONGITUD_MAXIMA_SEGMENTO)
    }
    expect(nombre).not.toContain(larga)
    // 255 es el límite de un componente de ruta en prácticamente todo (NTFS,
    // ext4, APFS): pasarse le llega al usuario como una descarga que no ocurre.
    expect(nombre.length).toBeLessThan(255)
  })

  it('es PURA: misma entrada, mismo nombre; fechas distintas, nombres distintos', () => {
    const args = { refcat: REFCAT, fecha: FECHA }
    expect(nombreFicheroGml(args)).toBe(nombreFicheroGml(args))
    const unSegundoDespues = new Date(FECHA.getTime() + 1000)
    expect(nombreFicheroGml({ refcat: REFCAT, fecha: unSegundoDespues })).not.toBe(
      nombreFicheroGml(args),
    )
  })
})

describe('gml/descargar · nombreFicheroGml, guardas de contrato', () => {
  it.each([
    ['un número', 42],
    ['un objeto', {}],
    ['un array', []],
    ['un booleano', true],
  ])("refcat = %s ⇒ TypeError que NOMBRA 'refcat'", (_caso, refcat) => {
    expect(() => nombreFicheroGml({ refcat, fecha: FECHA })).toThrow(TypeError)
    expect(() => nombreFicheroGml({ refcat, fecha: FECHA })).toThrow(/'refcat'/)
  })

  it.each([
    ['ausente', undefined],
    ['null', null],
    ['un número (epoch)', 0],
    ['una cadena ISO', '2026-07-27T11:45:30'],
  ])("fecha = %s ⇒ TypeError que NOMBRA 'fecha'", (_caso, fecha) => {
    expect(() => nombreFicheroGml({ refcat: REFCAT, fecha })).toThrow(TypeError)
    expect(() => nombreFicheroGml({ refcat: REFCAT, fecha })).toThrow(/'fecha'/)
  })

  it('una fecha inválida ⇒ RangeError (es del dominio, no del tipo)', () => {
    expect(() => nombreFicheroGml({ refcat: REFCAT, fecha: new Date('vaya') })).toThrow(RangeError)
  })

  it('sin argumento alguno ⇒ TypeError, no un «cannot destructure»', () => {
    expect(() => nombreFicheroGml()).toThrow(TypeError)
    expect(() => nombreFicheroGml()).toThrow(/'fecha'/)
  })
})

// ── descargarGml · el camino feliz ───────────────────────────────────────────

describe('gml/descargar · descargarGml entrega el fichero', () => {
  it('crea el objeto-URL, pincha el anchor, revoca y devuelve el nombre real', () => {
    const { ejecutar, creados, revocados, anclas } = prepararDescarga(XML_ACENTUADO, {
      refcat: REFCAT,
    })
    const resultado = ejecutar()

    expect(resultado).toEqual({
      descargado: true,
      nombre: nombreFicheroGml({ refcat: REFCAT, fecha: FECHA }),
      motivo: null,
      mensaje: null,
    })
    expect(creados).toHaveLength(1)
    expect(anclas).toHaveLength(1)
    expect(revocados).toEqual([creados[0].href])
  })

  it('el Blob lleva los BYTES UTF-8 exactos del xml (decodificados, no la etiqueta)', async () => {
    const { ejecutar, creados } = prepararDescarga(XML_ACENTUADO)
    ejecutar()

    const { blob } = creados[0]
    const buffer = await blob.arrayBuffer()
    const esperados = new TextEncoder().encode(XML_ACENTUADO)

    // Se comparan como arrays normales y no como `Uint8Array`: el buffer sale
    // del Blob del entorno jsdom y el esperado del `TextEncoder` de Node, y
    // `toEqual` sobre dos vistas tipadas de REALMS distintos falla aunque los
    // bytes coincidan («Compared values have no visual difference», medido).
    expect(Array.from(new Uint8Array(buffer))).toEqual(Array.from(esperados))
    expect(blob.size).toBe(esperados.length)
    // `fatal: true`: cualquier secuencia que no sea UTF-8 válido lanza en vez de
    // colar un U+FFFD que después se compararía como diferencia de texto.
    expect(new TextDecoder('utf-8', { fatal: true }).decode(buffer)).toBe(XML_ACENTUADO)
    expect(await blob.text()).toBe(XML_ACENTUADO)
  })

  it('la comprobación de bytes NO es vacua: hay multibyte y latin-1 no lo lee igual', async () => {
    const { ejecutar, creados } = prepararDescarga(XML_ACENTUADO)
    ejecutar()

    const buffer = await creados[0].blob.arrayBuffer()
    // Más bytes que caracteres ⇒ el XML de prueba tiene carga multibyte de verdad.
    expect(buffer.byteLength).toBeGreaterThan(XML_ACENTUADO.length)
    // Y si los bytes fueran los de un latin-1, la prueba anterior no habría podido
    // pasar: aquí se afirma que las dos lecturas SÍ difieren.
    expect(new TextDecoder('iso-8859-1').decode(buffer)).not.toBe(XML_ACENTUADO)
  })

  it('no se antepone BOM: el fichero empieza donde empieza el prólogo XML', async () => {
    const { ejecutar, creados } = prepararDescarga(XML_ACENTUADO)
    ejecutar()

    const bytes = new Uint8Array(await creados[0].blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf])
    expect(String.fromCharCode(bytes[0])).toBe(XML_ACENTUADO[0])
  })

  it('el tipo MIME declara UTF-8 (comprobación SECUNDARIA: la que manda es la de bytes)', () => {
    const { ejecutar, creados } = prepararDescarga(XML_ACENTUADO)
    ejecutar()
    expect(creados[0].blob.type).toBe(TIPO_MIME_GML)
    expect(TIPO_MIME_GML).toContain('charset=utf-8')
  })

  it('el anchor lleva el nombre calculado, está en el DOM DURANTE el click y no queda después', () => {
    const durante = {}
    const { ejecutar, creados, anclas } = prepararDescarga(XML_ACENTUADO, {
      refcat: REFCAT,
      alHacerClick: (anchor) => {
        durante.conectado = anchor.isConnected
        durante.download = anchor.getAttribute('download')
        durante.href = anchor.getAttribute('href')
      },
    })
    const resultado = ejecutar()

    // Durante: montado y con el atributo `download` que fuerza la descarga en vez
    // de la navegación. Sin esta mitad, la de después sería vacua.
    expect(durante.conectado).toBe(true)
    expect(durante.download).toBe(resultado.nombre)
    expect(durante.download).toBe(nombreFicheroGml({ refcat: REFCAT, fecha: FECHA }))
    expect(durante.href).toBe(creados[0].href)

    // Después: ni pegado al documento ni suelto en el `body`.
    expect(anclas[0].isConnected).toBe(false)
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('dos descargas seguidas: dos objetos-URL, dos revocaciones y cero anchors residuales', () => {
    const primera = prepararDescarga(XML_ACENTUADO, { refcat: REFCAT })
    const segunda = prepararDescarga(XML_ACENTUADO, { refcat: REFCAT })
    primera.ejecutar()
    segunda.ejecutar()

    for (const { creados, revocados, anclas } of [primera, segunda]) {
      expect(creados).toHaveLength(1)
      expect(revocados).toEqual([creados[0].href])
      expect(anclas[0].isConnected).toBe(false)
    }
    expect(document.body.childNodes).toHaveLength(0)
  })
})

// ── descargarGml · la limpieza es innegociable ───────────────────────────────

describe('gml/descargar · la URL se revoca SIEMPRE (fuga de memoria)', () => {
  it('revoca aunque el click LANCE, deja el DOM limpio y propaga la excepción', () => {
    // Una extensión que ha parcheado `HTMLAnchorElement`, un DOM manipulado…
    // Si esto se resolviera con un `try/catch` mudo se taparían dos cosas a la
    // vez: el fallo y —peor— el hecho de que no ha bajado ningún fichero.
    const fallo = new Error('una extensión ha roto el click')
    const { ejecutar, creados, revocados, anclas } = prepararDescarga(XML_ACENTUADO, {
      refcat: REFCAT,
      alHacerClick: () => {
        throw fallo
      },
    })

    expect(ejecutar).toThrow(fallo)
    expect(creados).toHaveLength(1)
    expect(revocados, 'el objeto-URL se ha quedado vivo: fuga por cada descarga').toEqual([
      creados[0].href,
    ])
    expect(anclas[0].isConnected).toBe(false)
    expect(document.body.childNodes).toHaveLength(0)
  })
})

// ── descargarGml · lo que NO se descarga, se dice ────────────────────────────

describe('gml/descargar · sin GML no hay fichero, y se dice (regla de oro 1)', () => {
  it.each([
    ['null (el serializador no emitió nada)', null],
    ['la cadena vacía', ''],
  ])('xml = %s ⇒ no descarga NADA y devuelve el motivo', (_caso, xml) => {
    const { ejecutar, creados, revocados, anclas } = prepararDescarga(xml, { refcat: REFCAT })
    const resultado = ejecutar()

    expect(resultado.descargado).toBe(false)
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_CONTENIDO)
    // No se anuncia el nombre de un fichero que no existe.
    expect(resultado.nombre).toBeNull()
    // …y hay un texto presentable, no un `false` a secas.
    expect(typeof resultado.mensaje).toBe('string')
    expect(resultado.mensaje.length).toBeGreaterThan(0)

    // Ni Blob, ni URL, ni anchor: no se ha rozado el DOM.
    expect(creados).toEqual([])
    expect(revocados).toEqual([])
    expect(anclas).toEqual([])
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('con xml = null la `fecha` SIGUE siendo contrato: el cableado roto no espera', () => {
    // Si la validación se saltara cuando no hay nada que descargar, un `fecha`
    // mal cableado se descubriría el día en que el serializador acierta, que es
    // el peor día posible para descubrirlo.
    expect(() => descargarGml(null, { refcat: REFCAT, ...entornoValido() })).toThrow(/'fecha'/)
  })

  it('los dos caminos de «no ha bajado nada» usan motivos DISTINTOS del catálogo', () => {
    // Un solo motivo para «no hay GML» y «el entorno no sabe» le impediría a la
    // UI decir cuál de las dos cosas pasó, que es justo lo que el usuario
    // necesita saber: en un caso revisa su expediente, en el otro su navegador.
    const sinContenido = prepararDescarga(null, { refcat: REFCAT }).ejecutar()
    const sinSoporte = descargarGml(XML_ACENTUADO, {
      refcat: REFCAT,
      fecha: FECHA,
      documento: crearDocumentoEspia().documento,
      url: {},
    })

    const motivos = [sinContenido.motivo, sinSoporte.motivo]
    for (const motivo of motivos) {
      expect(Object.values(MOTIVO_NO_DESCARGADO)).toContain(motivo)
    }
    expect(new Set(motivos).size).toBe(motivos.length)
  })
})

// ── descargarGml · degradación explícita, nunca muda ─────────────────────────

describe('gml/descargar · entorno sin capacidad de descarga', () => {
  it('HALLAZGO medido: aquí el `URL` global SÍ implementa createObjectURL', () => {
    // Contraintuitivo y por eso se escribe: jsdom por su cuenta NO lo implementa
    // (`new JSDOM(...)` deja las dos funciones en `undefined`), pero el entorno
    // `jsdom` de Vitest expone el `URL` de Node, que sí las trae desde Node 16.
    // De este hecho depende toda la estrategia del fichero, así que se afirma en
    // vez de suponerse: el día que cambie, esta prueba lo dirá.
    expect(typeof URL.createObjectURL).toBe('function')
    expect(typeof URL.revokeObjectURL).toBe('function')
  })

  it('con el `URL` REAL del entorno la descarga ocurre de verdad, no solo con el doble', () => {
    // Contrapeso del doble: si el módulo solo funcionara contra el espía, esto
    // caería. Aquí se usa la implementación auténtica de Blob-URL de Node.
    const vistoDurante = {}
    const espiaDoc = crearDocumentoEspia((anchor) => {
      vistoDurante.href = anchor.getAttribute('href')
    })
    const revocar = vi.spyOn(URL, 'revokeObjectURL')

    const resultado = descargarGml(XML_ACENTUADO, {
      refcat: REFCAT,
      fecha: FECHA,
      documento: espiaDoc.documento,
      // `url` sin inyectar: cae al global real.
    })

    expect(resultado.descargado).toBe(true)
    expect(vistoDurante.href.startsWith('blob:')).toBe(true)
    expect(revocar).toHaveBeenCalledWith(vistoDurante.href)
    revocar.mockRestore()
  })

  it.each([
    ['sin ninguna de las dos', {}, 'createObjectURL'],
    ['sin revokeObjectURL', { createObjectURL: () => 'blob:x' }, 'revokeObjectURL'],
    ['sin createObjectURL', { revokeObjectURL: () => {} }, 'createObjectURL'],
  ])('un `url` con forma pero %s degrada con motivo, no lanza', (_caso, url, ausente) => {
    const espiaDoc = crearDocumentoEspia()
    const resultado = descargarGml(XML_ACENTUADO, {
      refcat: REFCAT,
      fecha: FECHA,
      documento: espiaDoc.documento,
      url,
    })

    expect(resultado.descargado).toBe(false)
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR)
    expect(resultado.nombre).toBeNull()
    // El mensaje NOMBRA lo que falta: «no se ha podido» a secas no es respuesta.
    expect(resultado.mensaje).toContain(ausente)
    // Y degrada ANTES de tocar el DOM: ni un anchor huérfano.
    expect(espiaDoc.anclas).toEqual([])
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('sin `Blob` en el entorno tampoco se inventa nada', () => {
    vi.stubGlobal('Blob', undefined)
    const { ejecutar, creados } = prepararDescarga(XML_ACENTUADO, { refcat: REFCAT })
    const resultado = ejecutar()
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR)
    expect(resultado.mensaje).toContain('Blob')
    expect(creados).toEqual([])
  })

  it('la degradación se comprueba contra un entorno que SÍ puede: si no, sería vacua', () => {
    // Contrapartida de las tres anteriores: con el `url` inyectado el mismo XML
    // sí baja. Sin esta prueba, un módulo que degradara siempre pasaría todo.
    const { ejecutar } = prepararDescarga(XML_ACENTUADO, { refcat: REFCAT })
    expect(ejecutar().descargado).toBe(true)
  })
})

// ── descargarGml · guardas de contrato ───────────────────────────────────────

describe('gml/descargar · descargarGml, guardas de contrato', () => {
  it.each([
    ['undefined (argumento olvidado)', undefined],
    ['un número', 42],
    ['un objeto', {}],
    ['un array', []],
    ['un booleano', false],
  ])("xml = %s ⇒ TypeError que NOMBRA 'xml'", (_caso, xml) => {
    const opciones = { refcat: REFCAT, fecha: FECHA, ...entornoValido() }
    expect(() => descargarGml(xml, opciones)).toThrow(TypeError)
    expect(() => descargarGml(xml, opciones)).toThrow(/'xml'/)
  })

  it.each([
    ['null', null],
    ['un número', 7],
    ['una cadena', 'document'],
    ['un objeto sin createElement', { body: {} }],
    ['un objeto sin body', { createElement: () => ({}) }],
  ])("documento = %s ⇒ TypeError que NOMBRA 'documento'", (_caso, documento) => {
    const opciones = { refcat: REFCAT, fecha: FECHA, url: crearUrlEspia().url, documento }
    expect(() => descargarGml(XML_ACENTUADO, opciones)).toThrow(TypeError)
    expect(() => descargarGml(XML_ACENTUADO, opciones)).toThrow(/'documento'/)
  })

  it.each([
    ['null', null],
    ['un número', 7],
    ['una cadena', 'URL'],
  ])("url = %s ⇒ TypeError que NOMBRA 'url'", (_caso, url) => {
    const opciones = { refcat: REFCAT, fecha: FECHA, documento: crearDocumentoEspia().documento, url }
    expect(() => descargarGml(XML_ACENTUADO, opciones)).toThrow(TypeError)
    expect(() => descargarGml(XML_ACENTUADO, opciones)).toThrow(/'url'/)
  })

  it('el `URL` global es una FUNCIÓN y aun así pasa la guarda de forma', () => {
    // `typeof URL === 'function'`: una guarda escrita como `typeof url ===
    // "object"` rechazaría el valor por defecto del propio módulo.
    expect(typeof URL).toBe('function')
    const espiaDoc = crearDocumentoEspia()
    expect(() =>
      descargarGml(XML_ACENTUADO, { fecha: FECHA, documento: espiaDoc.documento, url: URL }),
    ).not.toThrow()
  })

  it('sin opciones ⇒ TypeError por la fecha, no un «cannot destructure»', () => {
    expect(() => descargarGml(XML_ACENTUADO)).toThrow(TypeError)
    expect(() => descargarGml(XML_ACENTUADO)).toThrow(/'fecha'/)
  })

  it('las guardas de nombre se heredan: una refcat con forma imposible LANZA', () => {
    const opciones = { refcat: 42, fecha: FECHA, ...entornoValido() }
    expect(() => descargarGml(XML_ACENTUADO, opciones)).toThrow(/'refcat'/)
  })
})

// ── El reloj ─────────────────────────────────────────────────────────────────

describe('gml/descargar · el módulo no lee el reloj', () => {
  it('gml/descargar.js ni instancia fechas ni pide la marca actual', () => {
    // Misma vigilancia que en `gml/_comun.js` y `gml/ids.js`, y aquí el motivo se
    // toca con la mano: si el nombre del fichero dependiera del reloj, ninguna de
    // las pruebas de saneado de este fichero podría afirmar nada.
    const fuente = readFileSync(join(RAIZ, 'gml', 'descargar.js'), 'utf8')
    const INSTANCIA_FECHA = /\bnew\s+Date\b/
    const RELOJ = /\bDate\s*\.\s*now\b/
    expect(INSTANCIA_FECHA.test(fuente), 'gml/descargar.js instancia una fecha propia').toBe(false)
    expect(RELOJ.test(fuente), 'gml/descargar.js consulta el reloj del sistema').toBe(false)
    // …y los detectores no son vacuos: reconocen las dos formas prohibidas.
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date.now()')).toBe(true)
  })
})
