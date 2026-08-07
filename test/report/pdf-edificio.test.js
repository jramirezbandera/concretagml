// test/report/pdf-edificio.test.js — F14 · fase 3 · el informe de construcción.
//
// El PDF se comprueba por su TEXTO extraído, igual que `pdf-parcela.test.js`: lo
// que importa de un documento firmable es lo que alguien lee en él, no cómo se
// codificó. El edificio de las pruebas es el REAL de `9398516VK3799G`, con sus 13
// partes, su piscina y su sótano.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  AVISO_NO_OFICIAL,
  AVISO_REGLA_9,
  NOMBRE_INFORME_EDIFICIO,
  NOMBRE_INFORME_EDIFICIO_CONTRASTE,
  NOTA_ENVOLVENTE,
  NO_APLICA,
  hayContrasteReal,
  informePdfEdificio,
  nombreDelInforme,
} from '../../report/pdf-edificio.js'
import { componerEncabezado } from '../../report/firma.js'
import { REGISTRO, contrastarEdificio } from '../../diagnostico/edificio.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { envolventeDe } from '../../edificio/envolvente.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import { crearEdificio, crearParteConstruccion } from '../../model/edificio.js'

// ── Utilidades ───────────────────────────────────────────────────────────────

const fixture = (nombre) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/gml/${nombre}`, import.meta.url)), 'utf8')

/** Fecha FIJA: un informe es un snapshot y su prueba tiene que valer en un año. */
const FECHA = new Date(Date.UTC(2026, 7, 7, 9, 30, 0))

const encabezado = (extra = {}) =>
  componerEncabezado({
    refcat: '9398516VK3799G',
    srs: 'EPSG:25830',
    fecha: FECHA,
    idDocumento: 'CGML-20260807-EDIF01',
    ...extra,
  })

/**
 * El texto legible del PDF. Los flujos de contenido van SIN comprimir (decisión de
 * `report/pdf.js`), así que los literales se pueden sacar del byte a byte.
 *
 * ⚠️ **Se decodifica CP1252, no latin1**, y la diferencia importa: el documento se
 * escribe en WinAnsi y ahí el guion largo «—» es el byte `0x97`, que en latin1 es
 * un carácter de control. La primera versión de este extractor leía latin1 y la
 * prueba del «—» de las piscinas suspendía **acusando al informe de un defecto del
 * test**. Los ocho bytes del rango 0x80–0x9F que sí son letras en CP1252 se
 * traducen a mano; el resto coincide con latin1.
 */
const CP1252_ALTO = Object.freeze({
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x99: '™',
})

function textoDelPdf(bytes) {
  const crudo = Buffer.from(bytes).toString('latin1')
  // Los `(…) Tj` del flujo de contenido, con los escapes del PDF deshechos.
  const trozos = [...crudo.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)].map((m) =>
    m[1].replace(/\\([()\\])/g, '$1'),
  )
  return trozos
    .join('\n')
    .replace(/[-]/g, (c) => CP1252_ALTO[c.charCodeAt(0)] ?? c)
}

/**
 * El mismo texto con los saltos de línea colapsados a espacios.
 *
 * ⚠️ Sirve para afirmar FRASES: el maquetador envuelve al ancho útil, así que una
 * frase de la fuente aparece partida en dos renglones del papel. Buscarla entera
 * en el texto con saltos falla **sobre un documento correcto**, que es la clase de
 * prueba que acusa al producto de cumplir.
 */
const frases = (bytes) => textoDelPdf(bytes).replace(/\s+/g, ' ')

/** El edificio real: 13 partes con sus plantas. */
function edificioReal() {
  return entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml')).edificio
}

/** La huella publicada por el Catastro para ese mismo edificio. */
function huellaPublicada() {
  const { edificio } = parsearGmlBu(fixture('bu_building_9398516VK3799G.gml'))
  return edificio.anillos.map((anillo) => [{ vertices: anillo, tipo: 'EXTERIOR' }])
}

/** Un edificio mínimo, para los casos que no necesitan las 13 partes. */
const edificioMinimo = (partes = []) =>
  crearEdificio({ refcat: '9398516VK3799G', partes })

const parte = (nombre, opciones = {}) =>
  crearParteConstruccion({
    nombre,
    origen: 'DIBUJADA',
    recinto: {
      vertices: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      tipo: 'EXTERIOR',
    },
    ...opciones,
  })

// ═════════════════════════════════════════════════════════════════════════════
// CRITERIO 4 · EL NOMBRE CAMBIA SEGÚN SE HAYA CONTRASTADO
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-edificio · el nombre legal del documento', () => {
  const edificio = edificioReal()

  it('sin contraste se llama «Informe de construcción para la Sede Electrónica»', () => {
    const r = informePdfEdificio({ edificio, encabezado: encabezado() })
    expect(r.titulo).toBe(NOMBRE_INFORME_EDIFICIO)
    expect(textoDelPdf(r.bytes)).toContain(NOMBRE_INFORME_EDIFICIO.toUpperCase())
  })

  it('con contraste REAL se llama «Informe de contraste con la construcción catastral»', () => {
    const contraste = contrastarEdificio({
      envolvente: envolventeDe(edificio.partes).recintos,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    const r = informePdfEdificio({ edificio, encabezado: encabezado(), contraste })
    expect(r.titulo).toBe(NOMBRE_INFORME_EDIFICIO_CONTRASTE)
    expect(textoDelPdf(r.bytes)).toContain(NOMBRE_INFORME_EDIFICIO_CONTRASTE.toUpperCase())
  })

  it('⭐ «no consta construcción registrada» NO titula el papel «de contraste»', () => {
    // La decisión fina de la fase. El objeto del contraste EXISTE en este caso
    // —hay una sección que contar y se cuenta— pero no se ha contrastado nada, así
    // que titularlo «de contraste» prometería una comprobación que no se ha hecho.
    const contraste = contrastarEdificio({
      envolvente: envolventeDe(edificio.partes).recintos,
      registro: REGISTRO.SIN_CONSTRUCCIONES,
    })
    expect(hayContrasteReal(contraste)).toBe(false)
    const r = informePdfEdificio({ edificio, encabezado: encabezado(), contraste })
    expect(r.titulo).toBe(NOMBRE_INFORME_EDIFICIO)
    // Y aun así la sección se imprime, con su motivo entero:
    expect(textoDelPdf(r.bytes)).toContain('NO CONSTA CONSTRUCCIÓN REGISTRADA')
  })

  it('los otros dos estados sin huella tampoco lo titulan «de contraste»', () => {
    for (const registro of [REGISTRO.NO_CONSULTADO, REGISTRO.NO_SE_HA_PODIDO]) {
      const contraste = contrastarEdificio({
        envolvente: envolventeDe(edificio.partes).recintos,
        registro,
      })
      expect(nombreDelInforme(contraste)).toBe(NOMBRE_INFORME_EDIFICIO)
    }
  })

  it('el pie de página y el nombre del fichero llevan el nombre que toca', () => {
    const contraste = contrastarEdificio({
      envolvente: envolventeDe(edificio.partes).recintos,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    const r = informePdfEdificio({ edificio, encabezado: encabezado(), contraste })
    // El pie repite el nombre en TODAS las páginas: si el título cambiara y el pie
    // no, el documento diría dos cosas.
    const texto = textoDelPdf(r.bytes)
    expect(texto).toContain(`${NOMBRE_INFORME_EDIFICIO_CONTRASTE} · CGML-20260807-EDIF01`)
    expect(r.nombreFichero).toBe('informe-construccion-CGML-20260807-EDIF01.pdf')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CRITERIO 3 · LA FICHA DE PARTES
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-edificio · la ficha de partes', () => {
  it('lleva una fila por parte, con las 13 del edificio real', () => {
    const edificio = edificioReal()
    expect(edificio.partes).toHaveLength(13)
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado() }).bytes)
    expect(texto).toContain('RELACIÓN DE PARTES DE LA CONSTRUCCIÓN')
    // Las cabeceras de la ficha que pide §17.
    for (const cabecera of ['Nombre', 'Tipo', 'Superficie', 'Sobre', 'Bajo']) {
      expect(texto).toContain(cabecera)
    }
    // Y los trece números de fila.
    for (let i = 1; i <= 13; i++) expect(texto).toContain(String(i))
  })

  it('⭐ una parte «Otra» lleva «—» en las plantas, NUNCA «0»', () => {
    // Criterio de aceptación 3. El modelo ya fuerza las plantas a null en las de
    // tipo OTRA aunque se pasen valores; aquí se comprueba que el papel lo respeta
    // y que no las imprime como un cero declarado.
    const piscina = parte('Piscina', {
      tipo: 'OTRA',
      plantasSobreRasante: 1, // se pasan a propósito: el modelo las ignora
      plantasBajoRasante: 1,
    })
    expect(piscina.plantasSobreRasante).toBeNull()

    const r = informePdfEdificio({
      edificio: edificioMinimo([piscina]),
      encabezado: encabezado(),
    })
    const texto = textoDelPdf(r.bytes)
    expect(texto).toContain('Otra (piscina y similares)')
    expect(texto).toContain(NO_APLICA)
  })

  it('una parte PRINCIPAL con 0 plantas sí imprime «0»: es un dato declarado', () => {
    // El contraste del caso anterior. Un sótano DECLARA cero plantas sobre rasante,
    // y eso es una afirmación del técnico, no una ausencia.
    const sotano = parte('Sótano', { plantasSobreRasante: 0, plantasBajoRasante: 1 })
    const texto = textoDelPdf(
      informePdfEdificio({ edificio: edificioMinimo([sotano]), encabezado: encabezado() }).bytes,
    )
    expect(texto).toContain('0')
    expect(texto).toContain('Construcción')
  })

  it('dice si cada parte ENTRA en la huella, que es lo que descuadra la suma', () => {
    const texto = textoDelPdf(
      informePdfEdificio({
        edificio: edificioMinimo([
          parte('Sobre rasante', { plantasSobreRasante: 2 }),
          parte('Sótano', { plantasSobreRasante: 0, plantasBajoRasante: 1 }),
        ]),
        encabezado: encabezado(),
      }).bytes,
    )
    expect(texto).toContain('En huella')
    expect(texto).toContain('Sí')
    expect(texto).toContain('No')
  })

  it('una parte SIN recinto sale igual, con «No consta» en su superficie', () => {
    const sinDibujar = crearParteConstruccion({
      nombre: 'Pendiente de dibujar',
      origen: 'DIBUJADA',
      plantasSobreRasante: 1,
    })
    const texto = textoDelPdf(
      informePdfEdificio({ edificio: edificioMinimo([sinDibujar]), encabezado: encabezado() })
        .bytes,
    )
    expect(texto).toContain('Pendiente de dibujar')
    expect(texto).toContain('No consta')
  })

  it('un edificio SIN partes lo dice, en vez de imprimir una tabla vacía', () => {
    const texto = textoDelPdf(
      informePdfEdificio({ edificio: edificioMinimo([]), encabezado: encabezado() }).bytes,
    )
    expect(texto).toContain('no tiene ninguna parte declarada')
  })

  it('la nota al pie de la envolvente sale, palabra por palabra', () => {
    // Criterio de aceptación 3, segunda mitad.
    // ⚠️ Por `frases` y no por `textoDelPdf`: el maquetador envuelve al ancho útil
    // y la nota sale partida en dos renglones. Buscarla entera con los saltos
    // suspendía sobre un documento correcto.
    const texto = frases(
      informePdfEdificio({ edificio: edificioReal(), encabezado: encabezado() }).bytes,
    )
    expect(NOTA_ENVOLVENTE).toMatch(/se deriva de las partes con volumen sobre rasante/)
    expect(texto).toContain('se excluyen voladizos, terrazas y balcones')
    expect(texto).toContain('no se dibuja')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LOS ATRIBUTOS GENERALES
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-edificio · los atributos generales', () => {
  it('en modelo COMPLETO se imprimen, con sus rótulos', () => {
    const edificio = crearEdificio({
      refcat: '9398516VK3799G',
      modelo: 'COMPLETO',
      partes: [parte('Principal', { plantasSobreRasante: 3 })],
      usoDominante: 'Residencial',
      estadoConservacion: 'FUNCIONAL',
      anioConstruccion: 1997,
      numeroInmuebles: 18,
      numeroViviendas: 17,
    })
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado() }).bytes)
    expect(texto).toContain('ATRIBUTOS GENERALES DEL EDIFICIO')
    expect(texto).toContain('Uso dominante')
    expect(texto).toContain('Funcional') // el rótulo humano, no la clave FUNCIONAL
    expect(texto).toContain('1997')
    expect(texto).toContain('18')
  })

  it('en modelo SIMPLIFICADO la sección NO existe, y no deja hueco en la numeración', () => {
    // El modelo ni siquiera crea las claves en SIMPLIFICADO: no hay nada que
    // esconder, no están.
    const edificio = edificioMinimo([parte('Principal', { plantasSobreRasante: 1 })])
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado() }).bytes)
    expect(texto).not.toContain('ATRIBUTOS GENERALES DEL EDIFICIO')
    // La numeración es correlativa: sin la 4, la de vértices ocupa su sitio.
    expect(texto).toMatch(/4\.\s+RELACIÓN DE VÉRTICES/)
  })

  it('un atributo COMPLETO sin declarar dice «No consta», no queda en blanco', () => {
    const edificio = crearEdificio({
      refcat: '9398516VK3799G',
      modelo: 'COMPLETO',
      partes: [parte('Principal', { plantasSobreRasante: 1 })],
      usoDominante: 'Residencial',
    })
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado() }).bytes)
    expect(texto).toContain('Año de construcción')
    expect(texto).toContain('No consta')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// EL CONTRASTE DENTRO DEL PAPEL
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-edificio · la sección de contraste', () => {
  const edificio = edificioReal()
  const envolvente = envolventeDe(edificio.partes).recintos

  it('sin contraste la sección NO se imprime: es el informe declarativo', () => {
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado() }).bytes)
    expect(texto).not.toContain('CONTRASTE CON LA CONSTRUCCIÓN REGISTRADA')
    expect(texto).not.toContain('NO CONSTA CONSTRUCCIÓN REGISTRADA')
  })

  it('con contraste salen las cifras, y ninguna lleva veredicto', () => {
    const contraste = contrastarEdificio({
      envolvente,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado(), contraste }).bytes)
    expect(texto).toContain('Huella medida')
    expect(texto).toContain('Huella registrada en el Catastro')
    expect(texto).toContain('322,13 m²') // la diana de oro, redondeada a la salida
    expect(texto).toContain('Superficie común')
    expect(texto).toContain('100,00 %')
  })

  it('«no se ha consultado» y «no hay invasión» se escriben DISTINTO', () => {
    const sinConsultar = contrastarEdificio({
      envolvente,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    const t1 = frases(
      informePdfEdificio({ edificio, encabezado: encabezado(), contraste: sinConsultar }).bytes,
    )
    expect(t1).toContain('afirma que no se ha mirado')

    const consultado = contrastarEdificio({
      envolvente,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
      vecinas: [],
    })
    const t2 = frases(
      informePdfEdificio({ edificio, encabezado: encabezado(), contraste: consultado }).bytes,
    )
    expect(t2).toContain('no comparte superficie con ninguna')
    expect(t2).not.toContain('afirma que no se ha mirado')
  })

  it('lo que no se ha podido medir se dice en el papel', () => {
    const contraste = contrastarEdificio({
      envolvente,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    // Sin parcela, «cuánto cae dentro» no se ha podido medir.
    expect(contraste.omisiones.length).toBeGreaterThan(0)
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado(), contraste }).bytes)
    expect(texto).toContain('no ha podido medir')
    expect(texto).toContain('No hay ninguna parcela cargada')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LO QUE EL DOCUMENTO GARANTIZA
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-edificio · lo que el papel garantiza', () => {
  const edificio = edificioReal()

  it('⛔ ni una sigla de los documentos oficiales del Catastro', () => {
    // Mismo guardián que el informe de parcela, y por el mismo motivo: este papel
    // se firma y se archiva, y una sigla impresa —aunque sea dentro de una
    // negación— acaba siendo la que alguien lee por encima en la portada.
    const contraste = contrastarEdificio({
      envolvente: envolventeDe(edificio.partes).recintos,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado(), contraste }).bytes)
    for (const sigla of ['ICUC', 'IVG', 'VGA', 'CSV']) {
      expect(texto, `el papel no puede nombrar «${sigla}»`).not.toMatch(
        new RegExp(`\\b${sigla}\\b`),
      )
    }
  })

  it('la portada dice lo que el documento NO es, antes de la primera cifra', () => {
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado() }).bytes)
    expect(AVISO_NO_OFICIAL).toMatch(/no tiene carácter oficial/)
    expect(AVISO_REGLA_9).toMatch(/MEDIDAS, no valoraciones/)
    expect(texto).toContain('no tiene carácter oficial')
    expect(texto).toContain('Interpretar lo medido y asumir su consecuencia corresponde a quien')
  })

  it('⛔ ni una palabra de veredicto en todo el papel (regla de oro 9)', () => {
    const contraste = contrastarEdificio({
      envolvente: envolventeDe(edificio.partes).recintos,
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
      vecinas: [],
    })
    const texto = textoDelPdf(informePdfEdificio({ edificio, encabezado: encabezado(), contraste }).bytes)
    // Las mismas prohibidas que vigila `report/contraste-texto.js`. Se excluyen a
    // propósito las que aparecen DENTRO de la advertencia de la regla 9, que existe
    // justamente para negarlas.
    const sinAvisos = texto
      .split('\n')
      .filter((l) => !AVISO_REGLA_9.includes(l.trim()) && l.trim() !== '')
      .join('\n')
    for (const palabra of ['válido', 'apto', 'cumple', 'conforme', 'dentro de tolerancia']) {
      expect(sinAvisos.toLowerCase(), `«${palabra}» es un veredicto`).not.toContain(palabra)
    }
  })

  it('el pie numera «Página N de M» en todas las páginas', () => {
    const r = informePdfEdificio({ edificio, encabezado: encabezado() })
    expect(r.nPaginas).toBeGreaterThan(1)
    for (let p = 1; p <= r.nPaginas; p++) {
      expect(textoDelPdf(r.bytes)).toContain(`Página ${p} de ${r.nPaginas}`)
    }
  })

  it('sin plano, el informe sale igual y LO DICE', () => {
    const texto = textoDelPdf(
      informePdfEdificio({ edificio, encabezado: encabezado(), plano: null }).bytes,
    )
    expect(texto).toContain('No se ha podido componer el plano')
  })

  it('sin firma, los campos salen con «No consta» y no como huecos', () => {
    const texto = textoDelPdf(
      informePdfEdificio({ edificio, encabezado: encabezado(), firma: null }).bytes,
    )
    expect(texto).toContain('No consta')
    expect(texto).toContain('Firma')
  })

  it('NO lee el reloj: el mismo encabezado produce los mismos bytes', () => {
    // Un informe firmado es un snapshot. Si algo aquí consultara `Date.now()`, dos
    // composiciones consecutivas del mismo expediente diferirían.
    const a = informePdfEdificio({ edificio, encabezado: encabezado() }).bytes
    const b = informePdfEdificio({ edificio, encabezado: encabezado() }).bytes
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('el texto fuente no nombra el reloj, igual que sus hermanos', () => {
    const fuente = readFileSync(
      fileURLToPath(new URL('../../report/pdf-edificio.js', import.meta.url)),
      'utf8',
    )
    // Se mira el CÓDIGO, no los comentarios: un `Date.now()` dentro de una
    // explicación no es una lectura del reloj.
    const codigo = fuente
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    expect(codigo).not.toMatch(/Date\.now\(\)/)
    expect(codigo).not.toMatch(/new Date\(\)/)
  })
})

describe('report/pdf-edificio · contrato del programador', () => {
  const edificio = edificioReal()

  it('sin edificio, lanza nombrando el modelo', () => {
    expect(() => informePdfEdificio({ encabezado: encabezado() })).toThrow(
      /'edificio' debe ser el POJO de model\/edificio\.js/,
    )
  })

  it('sin encabezado, lanza diciendo que de ahí sale la fecha', () => {
    expect(() => informePdfEdificio({ edificio })).toThrow(
      /informePdfEdificio: 'encabezado' debe ser el objeto/,
    )
  })

  it('⭐ el mensaje de error nombra a ESTA función, no a la de parcela', () => {
    // Es lo que se parametrizó al extraer el maquetador: una guarda compartida que
    // dijera «informePdfParcela:» mandaría a quien depura al fichero equivocado.
    expect(() => informePdfEdificio({ edificio, encabezado: null })).toThrow(/^informePdfEdificio:/)
    expect(() => informePdfEdificio({ edificio, encabezado: encabezado(), plano: 42 })).toThrow(
      /^informePdfEdificio:/,
    )
  })

  it("un 'contraste' que no es objeto lanza, y dice que null es normal", () => {
    expect(() =>
      informePdfEdificio({ edificio, encabezado: encabezado(), contraste: 'sí' }),
    ).toThrow(/null = no se ha contrastado, que es un caso normal/)
  })
})
