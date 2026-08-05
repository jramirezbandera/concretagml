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
  TIPO_MIME_TEXTO,
  SUSTITUTO_NOMBRE,
  SEPARADOR_NOMBRE,
  PREFIJO_NOMBRE,
  MARCA_SIN_REFCAT,
  MARCA_REFCAT_ILEGIBLE,
  LONGITUD_MAXIMA_SEGMENTO,
  CARACTERES_PROHIBIDOS_WINDOWS,
  NOMBRES_RESERVADOS_WINDOWS,
  MOTIVO_NO_DESCARGADO,
  PREFIJO_NOMBRE_EXPEDIENTE,
  nombreFicheroGml,
  descargarGml,
  descargarTexto,
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

  // ── F17 · el fichero de VARIAS parcelas estrena prefijo ────────────────────

  it('⛔ REGRESIÓN: pedir 1 miembro da el MISMO nombre que no pedir ninguno', () => {
    // Es el camino del 100 % del uso actual. `miembros` entró con F17 y su valor
    // por defecto no puede mover ni un byte del nombre que la aplicación lleva
    // generando desde F04 — hay tres exportaciones más (DXF, TXT, JSON) que se
    // DERIVAN de esta cadena cortándola por la longitud del prefijo.
    const deSiempre = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA })
    expect(nombreFicheroGml({ refcat: REFCAT, fecha: FECHA, miembros: 1 })).toBe(deSiempre)
    expect(deSiempre.startsWith(`${PREFIJO_NOMBRE}${SEPARADOR_NOMBRE}`)).toBe(true)
    // Y también sin referencia, que es el otro camino vivo (alta nueva).
    const sinRc = nombreFicheroGml({ refcat: null, fecha: FECHA })
    expect(nombreFicheroGml({ refcat: null, fecha: FECHA, miembros: 1 })).toBe(sinRc)
  })

  it('con varias parcelas el prefijo dice «expediente», y solo cambia eso', () => {
    // «parcela», en singular, sería mentira en el sitio más visible de toda la
    // operación: la barra de descargas. Lo que NO cambia es el resto — la
    // referencia sigue siendo la de la matriz y la marca de tiempo sigue siendo la
    // misma que va dentro del fichero—, así que el nombre se sigue partiendo en
    // tres por `_`.
    const uno = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA, miembros: 1 })
    const dos = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA, miembros: 2 })
    expect(partesDe(dos)).toEqual([PREFIJO_NOMBRE_EXPEDIENTE, REFCAT, MARCA_TIEMPO])
    expect(dos).not.toBe(uno)
    // Lo único distinto es el primer segmento.
    expect(partesDe(dos).slice(1)).toEqual(partesDe(uno).slice(1))
    // Y da igual cuántas sean a partir de dos: el nombre dice QUÉ es el fichero,
    // no cuántas lleva. Contarlas es trabajo del propio GML, que las trae dentro.
    expect(nombreFicheroGml({ refcat: REFCAT, fecha: FECHA, miembros: 9 })).toBe(dos)
  })

  it('⛔ LANZA con un número de miembros que no puede ser cierto', () => {
    // Regla de oro 1: un 0 o un 1,5 aquí significan que quien llama no sabe cuántas
    // parcelas está escribiendo. Redondear por lo bajo daría el nombre de siempre
    // para un fichero que ya no es de siempre, que es el fallo mudo que este
    // parámetro existe para evitar.
    for (const malo of [0, -1, 1.5, '2', null, NaN]) {
      expect(() => nombreFicheroGml({ refcat: REFCAT, fecha: FECHA, miembros: malo })).toThrow(
        TypeError,
      )
    }
    expect(() => nombreFicheroGml({ refcat: REFCAT, fecha: FECHA, miembros: 0 })).toThrow(
      /entero >= 1/,
    )
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

/* -------------------------------------------------------------------------- *
 * F08 · T1.3 · `descargarTexto`, el primitivo de la entrega                    *
 *                                                                              *
 * Todo lo de arriba se escribió para `descargarGml` en F04 y NO SE HA TOCADO   *
 * ni una línea: eso es exactamente lo que se está afirmando aquí abajo. F08    *
 * necesita bajar un informe de contraste en TEXTO, y la mecánica —Blob →       *
 * createObjectURL → <a download> → click → revoke, con su comprobación de      *
 * capacidad y su limpieza en `finally` anidados— se EXTRAJO a `descargarTexto` *
 * en vez de copiarse. Si hubiera hecho falta reescribir una prueba de las de   *
 * arriba, no habría sido una extracción sino un rediseño.                      *
 *                                                                              *
 * Cuatro cosas se comprueban, y las cuatro tienen su motivo:                   *
 *                                                                              *
 * 1. LOS BYTES, otra vez y sobre el texto. El informe lleva `ñ`, acentos y     *
 *    `²`; se afirma que la `ñ` viaja como `0xC3 0xB1` y que el `0xF1` de       *
 *    latin-1 NO aparece en ningún sitio del buffer. Mirar la cadena de vuelta  *
 *    no valdría: `blob.text()` vuelve a decodificar y taparía un round-trip    *
 *    simétricamente roto.                                                      *
 * 2. EL MIME Y EL NOMBRE LOS PONE QUIEN LLAMA. El primitivo no inventa         *
 *    ninguno de los dos, así que se comprueba que llegan tal cual al Blob y al *
 *    atributo `download` — y que el MIME de texto NO es el del GML, porque si  *
 *    lo fuera la prueba pasaría sin comprobar nada.                            *
 * 3. LA REVOCACIÓN, también cuando el click lanza. La fuga de memoria no       *
 *    distingue de qué llamante viene el Blob.                                  *
 * 4. AUSENTE ≠ EQUIVOCADO. Sin `document` en el entorno sale un MOTIVO, no una *
 *    excepción: es una limitación del entorno, como un `Blob` que no está. Un  *
 *    `documento: null` explícito sigue LANZANDO, que es un contrato roto por   *
 *    el programador. Las dos mitades se prueban juntas o la línea no existe.   *
 *                                                                              *
 * Y hay un guardián mecánico de la NO DUPLICACIÓN al final: la mecánica        *
 * aparece UNA sola vez en el código del módulo. Es la única forma de que       *
 * «extraer, no copiar» siga siendo cierto dentro de seis meses.                *
 * -------------------------------------------------------------------------- */

/**
 * El informe de contraste de F08, en pequeño: acentos, `ñ`, superíndice y una
 * raya. Si la codificación se estropeara en el camino, se vería aquí.
 */
const INFORME_ACENTUADO =
  'Informe de contraste con el parcelario catastral\n' +
  'Parcela: Peña del Cañón — Añón de Moncayo\n' +
  'Superficie medida: 1.535,87 m²\n' +
  'Desviación máxima por lado: 0,12 m\n' +
  'Versión provisional en texto; sin plano y sin pie de firma.\n'

/**
 * Nombre del fichero del informe. Se DERIVA de las mismas piezas que el nombre
 * del GML (la RC leída del fixture y la marca de tiempo de `dateTimeCatastro`)
 * en vez de escribirse a mano, para que no pueda quedarse desincronizado.
 */
const NOMBRE_INFORME = ['contraste', REFCAT, MARCA_TIEMPO].join(SEPARADOR_NOMBRE) + '.txt'

/** ¿Aparece esta secuencia de bytes dentro del buffer? Búsqueda literal. */
function contieneBytes(bytes, secuencia) {
  return [...bytes].some((_b, i) => secuencia.every((s, j) => bytes[i + j] === s))
}

/**
 * Gemela de {@link prepararDescarga} para el primitivo: mismos dos dobles, misma
 * forma de devolver `ejecutar` sin llamarla.
 */
function prepararDescargaTexto(
  texto,
  { nombreFichero = NOMBRE_INFORME, mime = TIPO_MIME_TEXTO, alHacerClick } = {},
) {
  const espiaUrl = crearUrlEspia()
  const espiaDoc = crearDocumentoEspia(alHacerClick)
  return {
    creados: espiaUrl.creados,
    revocados: espiaUrl.revocados,
    anclas: espiaDoc.anclas,
    ejecutar: () =>
      descargarTexto(texto, {
        nombreFichero,
        mime,
        documento: espiaDoc.documento,
        url: espiaUrl.url,
      }),
  }
}

describe('gml/descargar · descargarTexto entrega un texto cualquiera', () => {
  it('crea el objeto-URL, pincha el anchor, revoca y devuelve el nombre que le dieron', () => {
    const { ejecutar, creados, revocados, anclas } = prepararDescargaTexto(INFORME_ACENTUADO)
    const resultado = ejecutar()

    expect(resultado).toEqual({
      descargado: true,
      nombre: NOMBRE_INFORME,
      motivo: null,
      mensaje: null,
    })
    expect(creados).toHaveLength(1)
    expect(anclas).toHaveLength(1)
    expect(revocados, 'el objeto-URL se ha quedado vivo: fuga por cada informe').toEqual([
      creados[0].href,
    ])
    expect(anclas[0].isConnected).toBe(false)
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('el Blob lleva los BYTES UTF-8 exactos del texto (la ñ es 0xC3 0xB1, no 0xF1)', async () => {
    const { ejecutar, creados } = prepararDescargaTexto(INFORME_ACENTUADO)
    ejecutar()

    const buffer = await creados[0].blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const esperados = new TextEncoder().encode(INFORME_ACENTUADO)

    // Vistas tipadas de realms distintos: se comparan como arrays normales (el
    // mismo hallazgo que la prueba hermana del GML).
    expect(Array.from(bytes)).toEqual(Array.from(esperados))
    expect(creados[0].blob.size).toBe(esperados.length)

    // La afirmación sobre los BYTES, que es la que pide la tarea: la `ñ` de
    // «Cañón» viaja como la pareja UTF-8, y el byte suelto de latin-1 no está en
    // ningún sitio del fichero. Con un texto sin caracteres de 4 bytes, 0xF1 solo
    // puede aparecer si alguien codificó en latin-1.
    expect(INFORME_ACENTUADO, 'el texto de prueba ya no lleva ñ: la prueba sería vacua').toContain(
      'ñ',
    )
    expect(contieneBytes(bytes, [0xc3, 0xb1]), 'la ñ no está codificada en UTF-8').toBe(true)
    expect(contieneBytes(bytes, [0xf1]), 'hay un 0xF1: el texto se codificó en latin-1').toBe(false)

    // `fatal: true`: una secuencia que no sea UTF-8 válido lanza en vez de colar
    // un U+FFFD que después se compararía como diferencia de texto.
    expect(new TextDecoder('utf-8', { fatal: true }).decode(buffer)).toBe(INFORME_ACENTUADO)
  })

  it('la comprobación de bytes NO es vacua: hay multibyte y latin-1 no lo lee igual', async () => {
    const { ejecutar, creados } = prepararDescargaTexto(INFORME_ACENTUADO)
    ejecutar()

    const buffer = await creados[0].blob.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(INFORME_ACENTUADO.length)
    expect(new TextDecoder('iso-8859-1').decode(buffer)).not.toBe(INFORME_ACENTUADO)
    // Y el detector de bytes distingue algo: sobre el buffer real encuentra la
    // pareja de la ñ y no encuentra una secuencia que no está.
    const bytes = new Uint8Array(buffer)
    expect(contieneBytes(bytes, [0x00, 0x00])).toBe(false)
  })

  it('no se antepone BOM: el fichero empieza donde empieza el texto', async () => {
    const { ejecutar, creados } = prepararDescargaTexto(INFORME_ACENTUADO)
    ejecutar()
    const bytes = new Uint8Array(await creados[0].blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf])
    expect(String.fromCharCode(bytes[0])).toBe(INFORME_ACENTUADO[0])
  })

  it('el MIME y el nombre son los que le pasan: el primitivo no inventa ninguno', () => {
    const durante = {}
    const { ejecutar, creados } = prepararDescargaTexto(INFORME_ACENTUADO, {
      alHacerClick: (anchor) => {
        durante.download = anchor.getAttribute('download')
        durante.href = anchor.getAttribute('href')
        durante.conectado = anchor.isConnected
      },
    })
    const resultado = ejecutar()

    expect(creados[0].blob.type).toBe(TIPO_MIME_TEXTO)
    expect(durante.download).toBe(NOMBRE_INFORME)
    expect(durante.href).toBe(creados[0].href)
    expect(durante.conectado, 'el anchor tiene que estar montado DURANTE el click').toBe(true)
    expect(resultado.nombre).toBe(NOMBRE_INFORME)

    // No vacuo: si el módulo se hubiera quedado con el MIME del GML —o si las dos
    // constantes fueran la misma cadena— esta prueba pasaría sin mirar nada.
    expect(TIPO_MIME_TEXTO).not.toBe(TIPO_MIME_GML)
    expect(TIPO_MIME_TEXTO).toContain('charset=utf-8')
    expect(NOMBRE_INFORME.endsWith(EXTENSION_GML)).toBe(false)
  })

  it('un MIME cualquiera del llamante llega intacto al Blob', () => {
    // El primitivo sirve a F08 hoy y a lo que venga después: el MIME es un
    // parámetro de verdad, no una elección entre dos constantes conocidas.
    const inventado = 'text/markdown;charset=utf-8'
    const { ejecutar, creados } = prepararDescargaTexto(INFORME_ACENTUADO, { mime: inventado })
    ejecutar()
    expect(creados[0].blob.type).toBe(inventado)
  })

  it('revoca aunque el click LANCE, deja el DOM limpio y propaga la excepción', () => {
    const fallo = new Error('una extensión ha roto el click')
    const { ejecutar, creados, revocados, anclas } = prepararDescargaTexto(INFORME_ACENTUADO, {
      alHacerClick: () => {
        throw fallo
      },
    })

    expect(ejecutar).toThrow(fallo)
    expect(creados).toHaveLength(1)
    expect(revocados, 'el objeto-URL se ha quedado vivo: fuga por cada informe').toEqual([
      creados[0].href,
    ])
    expect(anclas[0].isConnected).toBe(false)
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('dos informes seguidos: dos objetos-URL, dos revocaciones y cero anchors residuales', () => {
    const primero = prepararDescargaTexto(INFORME_ACENTUADO)
    const segundo = prepararDescargaTexto(INFORME_ACENTUADO)
    primero.ejecutar()
    segundo.ejecutar()

    for (const { creados, revocados, anclas } of [primero, segundo]) {
      expect(revocados).toEqual([creados[0].href])
      expect(anclas[0].isConnected).toBe(false)
    }
    expect(document.body.childNodes).toHaveLength(0)
  })
})

describe('gml/descargar · descargarTexto sin texto y sin entorno: motivo, nunca silencio', () => {
  it.each([
    ['null (no se generó informe)', null],
    ['la cadena vacía', ''],
  ])('texto = %s ⇒ no descarga NADA y devuelve el motivo', (_caso, texto) => {
    const { ejecutar, creados, revocados, anclas } = prepararDescargaTexto(texto)
    const resultado = ejecutar()

    expect(resultado.descargado).toBe(false)
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_CONTENIDO)
    expect(resultado.nombre).toBeNull()
    expect(typeof resultado.mensaje).toBe('string')
    expect(resultado.mensaje.length).toBeGreaterThan(0)

    // Ni Blob, ni URL, ni anchor: no se ha rozado el DOM.
    expect(creados).toEqual([])
    expect(revocados).toEqual([])
    expect(anclas).toEqual([])
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('SIN `document` en el ENTORNO: motivo presentable, NO una excepción', () => {
    // El caso de la tarea. `descargarTexto` puede acabar llamándose desde código
    // que no siempre corre en un navegador; reventar con «cannot read properties
    // of undefined» no le diría nada a nadie, y devolver `false` a secas sería un
    // fallo silencioso (regla de oro 1). Sale el motivo, con el nombre de lo que
    // falta escrito en el mensaje.
    const { url } = crearUrlEspia()
    vi.stubGlobal('document', undefined)

    let resultado
    expect(() => {
      resultado = descargarTexto(INFORME_ACENTUADO, {
        nombreFichero: NOMBRE_INFORME,
        mime: TIPO_MIME_TEXTO,
        url,
        // `documento` sin inyectar: cae al global, que aquí no existe.
      })
    }, 'sin document el primitivo ha LANZADO en vez de degradar').not.toThrow()

    expect(resultado.descargado).toBe(false)
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR)
    expect(resultado.nombre).toBeNull()
    expect(resultado.mensaje, 'el mensaje no NOMBRA lo que falta').toContain('document')
  })

  it('el caso anterior NO es vacuo: con el `document` del entorno la descarga ocurre', () => {
    // Contrapartida obligada: sin esto, un módulo que degradara SIEMPRE pasaría.
    expect(typeof globalThis.document, 'el entorno de este test debe tener DOM').toBe('object')
    const { ejecutar } = prepararDescargaTexto(INFORME_ACENTUADO)
    expect(ejecutar().descargado).toBe(true)
  })

  it('AUSENTE ≠ EQUIVOCADO: un `documento` presente pero inservible LANZA', () => {
    // La otra mitad de la línea. Que el global no exista es el entorno hablando;
    // pasar `null` o un número es haberse equivocado de argumento, y eso no se
    // convierte en un `motivo` porque aplanaría un error de programación a una
    // etiqueta de texto.
    for (const documento of [null, 7, 'document', { body: {} }]) {
      expect(() =>
        descargarTexto(INFORME_ACENTUADO, {
          nombreFichero: NOMBRE_INFORME,
          mime: TIPO_MIME_TEXTO,
          documento,
          url: crearUrlEspia().url,
        }),
      ).toThrow(/'documento'/)
    }
  })

  it.each([
    ['sin ninguna de las dos', {}, 'createObjectURL'],
    ['sin revokeObjectURL', { createObjectURL: () => 'blob:x' }, 'revokeObjectURL'],
    ['sin createObjectURL', { revokeObjectURL: () => {} }, 'createObjectURL'],
  ])('un `url` con forma pero %s degrada con motivo, no lanza', (_caso, url, ausente) => {
    const espiaDoc = crearDocumentoEspia()
    const resultado = descargarTexto(INFORME_ACENTUADO, {
      nombreFichero: NOMBRE_INFORME,
      mime: TIPO_MIME_TEXTO,
      documento: espiaDoc.documento,
      url,
    })

    expect(resultado.descargado).toBe(false)
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR)
    expect(resultado.mensaje).toContain(ausente)
    // Degrada ANTES de tocar el DOM: ni un anchor huérfano.
    expect(espiaDoc.anclas).toEqual([])
    expect(document.body.childNodes).toHaveLength(0)
  })

  it('sin `Blob` en el entorno tampoco se inventa nada', () => {
    vi.stubGlobal('Blob', undefined)
    const { ejecutar, creados } = prepararDescargaTexto(INFORME_ACENTUADO)
    const resultado = ejecutar()
    expect(resultado.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR)
    expect(resultado.mensaje).toContain('Blob')
    expect(creados).toEqual([])
  })

  it('los dos desenlaces de «no ha bajado nada» siguen usando motivos DISTINTOS', () => {
    const sinContenido = prepararDescargaTexto(null).ejecutar()
    const sinSoporte = descargarTexto(INFORME_ACENTUADO, {
      nombreFichero: NOMBRE_INFORME,
      mime: TIPO_MIME_TEXTO,
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

describe('gml/descargar · descargarTexto, guardas de contrato', () => {
  const entorno = () => ({
    documento: crearDocumentoEspia().documento,
    url: crearUrlEspia().url,
  })

  it.each([
    ['ausente', undefined],
    ['null', null],
    ['la cadena vacía', ''],
    ['solo espacios', '   '],
    ['un número', 42],
  ])("nombreFichero = %s ⇒ TypeError que NOMBRA 'nombreFichero'", (_caso, nombreFichero) => {
    // Un fichero sin nombre no es un fichero: el navegador le pondría uno suyo
    // («download») y el usuario acabaría con un informe que no sabe de qué es.
    const opciones = { nombreFichero, mime: TIPO_MIME_TEXTO, ...entorno() }
    expect(() => descargarTexto(INFORME_ACENTUADO, opciones)).toThrow(TypeError)
    expect(() => descargarTexto(INFORME_ACENTUADO, opciones)).toThrow(/'nombreFichero'/)
  })

  it.each([
    ['ausente', undefined],
    ['null', null],
    ['la cadena vacía', ''],
    ['un objeto', {}],
  ])("mime = %s ⇒ TypeError que NOMBRA 'mime'", (_caso, mime) => {
    // Sin valor por defecto a propósito: un `text/plain` supuesto deja al
    // navegador ADIVINAR la codificación, y el informe lleva acentos.
    const opciones = { nombreFichero: NOMBRE_INFORME, mime, ...entorno() }
    expect(() => descargarTexto(INFORME_ACENTUADO, opciones)).toThrow(TypeError)
    expect(() => descargarTexto(INFORME_ACENTUADO, opciones)).toThrow(/'mime'/)
  })

  it.each([
    ['undefined (argumento olvidado)', undefined],
    ['un número', 42],
    ['un objeto', {}],
    ['un array', []],
  ])("texto = %s ⇒ TypeError que NOMBRA 'texto'", (_caso, texto) => {
    const opciones = { nombreFichero: NOMBRE_INFORME, mime: TIPO_MIME_TEXTO, ...entorno() }
    expect(() => descargarTexto(texto, opciones)).toThrow(TypeError)
    expect(() => descargarTexto(texto, opciones)).toThrow(/'texto'/)
  })

  it.each([
    ['null', null],
    ['un número', 7],
    ['una cadena', 'URL'],
  ])("url = %s ⇒ TypeError que NOMBRA 'url'", (_caso, url) => {
    const opciones = {
      nombreFichero: NOMBRE_INFORME,
      mime: TIPO_MIME_TEXTO,
      documento: crearDocumentoEspia().documento,
      url,
    }
    expect(() => descargarTexto(INFORME_ACENTUADO, opciones)).toThrow(TypeError)
    expect(() => descargarTexto(INFORME_ACENTUADO, opciones)).toThrow(/'url'/)
  })

  it('sin opciones ⇒ TypeError por el nombre, no un «cannot destructure»', () => {
    expect(() => descargarTexto(INFORME_ACENTUADO)).toThrow(TypeError)
    expect(() => descargarTexto(INFORME_ACENTUADO)).toThrow(/'nombreFichero'/)
  })
})

// ── La extracción: la mecánica está COMPARTIDA, no copiada ───────────────────

describe('gml/descargar · descargarGml es un LLAMANTE de descargarTexto', () => {
  it('con los mismos argumentos, las dos vías dan el MISMO resultado y los MISMOS bytes', async () => {
    // Prueba de COMPORTAMIENTO de la extracción: si `descargarGml` conservara su
    // propia copia de la mecánica, bastaría con que una de las dos divergiera
    // —el tipo del Blob, el nombre, la forma del POJO— para que esto cayera.
    const nombre = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA })

    const porGml = prepararDescarga(XML_ACENTUADO, { refcat: REFCAT })
    const resultadoGml = porGml.ejecutar()
    const porTexto = prepararDescargaTexto(XML_ACENTUADO, {
      nombreFichero: nombre,
      mime: TIPO_MIME_GML,
    })
    const resultadoTexto = porTexto.ejecutar()

    expect(resultadoGml).toEqual(resultadoTexto)
    expect(resultadoGml.nombre).toBe(nombre)
    expect(porGml.creados[0].blob.type).toBe(porTexto.creados[0].blob.type)
    expect(await porGml.creados[0].blob.text()).toBe(await porTexto.creados[0].blob.text())
  })

  it('la degradación por entorno sale del MISMO sitio: mensaje idéntico por las dos vías', () => {
    // Un mensaje distinto querría decir que hay dos textos que mantener, que es
    // el primer síntoma del duplicado.
    const nombre = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA })
    const porGml = descargarGml(XML_ACENTUADO, {
      refcat: REFCAT,
      fecha: FECHA,
      documento: crearDocumentoEspia().documento,
      url: {},
    })
    const porTexto = descargarTexto(XML_ACENTUADO, {
      nombreFichero: nombre,
      mime: TIPO_MIME_GML,
      documento: crearDocumentoEspia().documento,
      url: {},
    })
    expect(porGml).toEqual(porTexto)
    expect(porGml.motivo).toBe(MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR)
  })

  it('«sin contenido» SÍ habla distinto en cada capa, y es a propósito', () => {
    // Lo único que `descargarGml` no delega. El motivo es el mismo código estable
    // —la UI decide con él—, pero el mensaje del GML nombra la causa real («no se
    // ha generado GML, revisa los errores del expediente»), que es lo que hace
    // útil a la regla de oro 1. Un texto genérico ahí sería una degradación.
    const porGml = prepararDescarga(null, { refcat: REFCAT }).ejecutar()
    const porTexto = prepararDescargaTexto(null).ejecutar()
    expect(porGml.motivo).toBe(porTexto.motivo)
    expect(porGml.mensaje).not.toBe(porTexto.mensaje)
    expect(porGml.mensaje).toContain('GML')
  })

  it('GUARDIÁN: la mecánica del navegador aparece UNA sola vez en el código', () => {
    // Un guardián mecánico, no una convención: el día que alguien «arregle» algo
    // pegando otra vez las veinte líneas, esto se pone rojo. Este repo ya arrastra
    // la deuda declarada de cuatro copias de `describir` (edit/_comun.js:42-46) y
    // no necesita una segunda familia.
    const fuente = readFileSync(join(RAIZ, 'gml', 'descargar.js'), 'utf8')
    // Solo CÓDIGO: la cabecera nombra `createObjectURL` y `click()` varias veces
    // justamente para explicar por qué se hacen así.
    const codigo = fuente
      .split('\n')
      .filter((linea) => !/^\s*(?:\/\/|\/\*|\*)/.test(linea))
      .join('\n')
    const cuantas = (re) => (codigo.match(re) ?? []).length

    const PASOS = [
      ['creación del objeto-URL', /\.createObjectURL\s*\(/g],
      ['revocación del objeto-URL', /\.revokeObjectURL\s*\(/g],
      ['construcción del Blob', /new\s+ConstructorBlob\s*\(/g],
      ['click sobre el anchor', /\.click\s*\(\s*\)/g],
      ['atributo download', /\.download\s*=/g],
      ['montaje del anchor', /appendChild\s*\(/g],
    ]
    for (const [paso, re] of PASOS) {
      expect(cuantas(re), `«${paso}» aparece más de una vez: la mecánica se ha duplicado`).toBe(1)
    }

    // Mitad anti-vacuidad: el contador cuenta de verdad y el filtro de comentarios
    // no se ha comido el código.
    const control = 'a.click()\nb.click()\n'.match(/\.click\s*\(\s*\)/g) ?? []
    expect(control.length, 'el contador no cuenta: los seis pasos de arriba serían vacuos').toBe(2)
    expect(codigo).toContain('export function descargarTexto')
    expect(codigo).toContain('export function descargarGml')
    expect(codigo, 'descargarGml ya no llama a descargarTexto').toContain('return descargarTexto(')
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

// ── El clic del enlace no puede salir del módulo ─────────────────────────────
//
// Defecto REAL, medido en navegador por `scripts/smoke-navegador/10-comprobar-gml.js`
// el 2026-07-30: `anchor.click()` burbujeaba hasta `document`, el guardián de
// clic-fuera de `viewer/cajon-diagnostico.js` lo recogía, hacía `contains()` sobre
// un `<a>` que cuelga del `<body>` —así que no está en el cajón— y CERRABA el cajón
// justo al descargar. El acuse de recibo se escribía entonces en un `role="status"`
// ya en `display:none`: invisible y fuera del árbol de accesibilidad. Regla de oro 1
// rota en el último gesto del recorrido de F08.
//
// El arreglo vive en `gml/descargar.js` y no en el cajón: este clic no es un gesto
// del usuario, es fontanería de la descarga, y que un detalle de implementación sea
// observable por el resto de la aplicación es el defecto. Parchear a cada oyente
// para que aprendiera a ignorarlo repartiría el arreglo entre todos los que algún
// día escuchen en `document`.

describe('gml/descargar · el clic sintético no se escapa a `document`', () => {
  /** Cuenta los clics que llegan a `document` mientras corre `accion()`. */
  function clicsQueLlegan(accion) {
    let vistos = 0
    const espia = () => { vistos += 1 }
    document.addEventListener('click', espia)
    try {
      accion()
    } finally {
      document.removeEventListener('click', espia)
    }
    return vistos
  }

  it('descargarTexto entrega el fichero sin que `document` vea ni un clic', () => {
    let devuelto = null
    const vistos = clicsQueLlegan(() => {
      devuelto = descargarTexto('contenido del informe', {
        nombreFichero: 'contraste_prueba.txt',
        mime: TIPO_MIME_TEXTO,
      })
    })

    expect(devuelto?.descargado, 'la descarga tiene que seguir ocurriendo').toBe(true)
    expect(vistos, 'el clic del <a download> ha burbujeado hasta document').toBe(0)
  })

  it('descargarGml tampoco lo deja escapar: es el mismo camino de código', () => {
    let devuelto = null
    const vistos = clicsQueLlegan(() => {
      devuelto = descargarGml('<gml/>', { refcat: '9398516VK3799G', fecha: new Date(0) })
    })

    expect(devuelto?.descargado).toBe(true)
    expect(vistos).toBe(0)
  })

  it('el espía SÍ ve un clic normal — sin esto las dos pruebas de arriba serían vacuas', () => {
    // La mitad anti-vacuidad. Un `document.addEventListener('click')` que no
    // funcionara daría cero en los tres casos y las dos pruebas anteriores pasarían
    // sin significar nada.
    const boton = document.createElement('button')
    document.body.appendChild(boton)
    try {
      expect(clicsQueLlegan(() => boton.click())).toBe(1)
    } finally {
      boton.remove()
    }
  })
})
