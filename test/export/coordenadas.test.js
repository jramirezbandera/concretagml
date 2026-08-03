/* -------------------------------------------------------------------------- *
 * test/export/coordenadas.test.js — F10 · T3.1 · El listado de coordenadas    *
 *                                                                            *
 * `export/coordenadas.js` no calcula geometría: FORMATEA y suma. Así que lo   *
 * que hay que probar no es aritmética nueva, sino que el documento DICE lo    *
 * que tiene que decir, que NO dice lo que tiene prohibido decir, y que las    *
 * dos cosas medidas en la fase 0 siguen siendo verdad.                        *
 *                                                                            *
 *   1. El listado completo sobre la parcela REAL del WFS, con sus 15          *
 *      vértices. Nada de geometría de juguete para la prueba principal: un    *
 *      listado montado sobre un cuadrado demuestra que el formateador         *
 *      compila, no que sirva para replantear.                                 *
 *   2. ⭐ **Que nuestro propio lector NO puede releer este fichero**, con los  *
 *      valores exactos que devuelve. Es el hallazgo de T3.1 y aquí queda      *
 *      fijado: el día que alguien enseñe a `parsers/txt.js` a saltarse        *
 *      comentarios, esta prueba se pone roja y le trae hasta la nota.         *
 *      Y su otra mitad: que el destrozo NO pasaría en silencio, porque        *
 *      `geo/huso.js` lo caza en la puerta.                                    *
 *   3. Que las medidas del pie salen de las coordenadas IMPRESAS y no de las  *
 *      del modelo — comprobado con la diferencia real entre las dos, para     *
 *      que la afirmación no sea vacua.                                        *
 *   4. Que ninguna cifra lleva juicio de valor (SPEC §2, regla 9), con un     *
 *      guardián de vocabulario que además se prueba a sí mismo.               *
 *   5. Que el módulo no lee el reloj, con un grep sobre su TEXTO fuente.      *
 *                                                                            *
 * El SNAPSHOT va al final y es la última aserción, no la primera: un snapshot *
 * está a un `-u` de no significar nada.                                       *
 *                                                                            *
 * Proyecto Vitest `node`: texto y aritmética, sin DOM.                        *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SEVERIDAD, TIPO_EXPORT } from '../../export/_comun.js'
import { AVISO_NO_REIMPORTABLE, serializarCoordenadasTxt } from '../../export/coordenadas.js'
import { superficie } from '../../geo/area.js'
import { detectarHuso, sanear } from '../../geo/huso.js'
import { DECIMALES_COORD, redondearAnillo } from '../../gml/anillos.js'
import { parsearGml } from '../../gml/parse.js'
import { parseTXT } from '../../parsers/txt.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'export', 'coordenadas.js'), 'utf8')

// ── El fixture REAL ─────────────────────────────────────────────────────────

const REF = '9398516VK3799G'
const SRS = 'EPSG:25830'

/** La parcela tal cual la sirve el WFS del Catastro. Sin tocar un vértice. */
const DEL_WFS = parsearGml(
  readFileSync(join(RAIZ, 'test', 'fixtures', 'gml', `cp_parcela_${REF}.gml`), 'utf8'),
).parcelas[0]

/** Clon profundo por JSON: vale porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

/** Instante fijo. El módulo no lee el reloj: la fecha entra por parámetro. */
const FECHA = new Date(Date.UTC(2026, 7, 3, 9, 45, 12))

const listadoReal = (extra = {}) =>
  serializarCoordenadasTxt({
    recintos: clon(DEL_WFS.recintos),
    refcat: REF,
    srs: SRS,
    fecha: FECHA,
    ...extra,
  })

/** Un cuadrado de `lado` metros en UTM 30N realista, anillo ABIERTO. */
const cuadrado = (lado, x = 440123.45, y = 4470987.65) => [
  [x, y],
  [x + lado, y],
  [x + lado, y + lado],
  [x, y + lado],
]

const recinto = (vertices, tipo = 'EXTERIOR') => ({ vertices, tipo })

/**
 * El texto con los espacios en blanco colapsados. Las frases largas del listado van
 * ENVUELTAS al ancho del papel, así que buscarlas literales con `toContain` falla por
 * el salto de línea que hay en medio y no porque la frase no esté. Se normaliza aquí
 * en vez de trocear cada frase en fragmentos cortos, que sería afirmar menos.
 */
const plano = (texto) => texto.replace(/\s+/g, ' ')

// ═════════════════════════════════════════════════════════════════════════════
// 1 · El listado sobre la parcela real
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · la parcela real del WFS', () => {
  it('la cabecera identifica la parcela: referencia, huso y fecha', () => {
    const { texto } = listadoReal()
    expect(texto).toContain('LISTADO DE COORDENADAS DE VÉRTICES')
    expect(texto).toContain(REF)
    expect(texto).toContain(SRS)
    expect(texto).toContain('03/08/2026 09:45 (UTC)')
  })

  it('el sistema de referencia se escribe SIEMPRE, y cuando falta se dice', () => {
    // Un listado de coordenadas sin huso es el fichero contra el que existe todo
    // `geo/huso.js`: números que hay que adivinar. Que falte es legítimo; que no se
    // note, no.
    const { texto } = listadoReal({ srs: null, refcat: null })
    expect(texto).toContain('Sistema de referencia')
    expect(texto).toContain('No consta')
    expect(texto).not.toContain(SRS)
  })

  it('lista los 15 vértices, numerados desde 1 y con sus coordenadas', () => {
    const { texto, nVertices } = listadoReal()
    const esperados = redondearAnillo(DEL_WFS.recintos[0].vertices)
    expect(nVertices).toBe(esperados.length)
    expect(esperados.length).toBeGreaterThan(10) // anti-vacuidad: hay tabla que mirar

    const filas = texto
      .split('\n')
      .map((l) => l.trim().match(/^(\d+)\s+(\d[\d.]*,\d{2})\s+(\d[\d.]*,\d{2})$/))
      .filter(Boolean)

    expect(filas.length).toBe(esperados.length)
    filas.forEach((f, i) => {
      expect(Number(f[1])).toBe(i + 1) // numerados 1, 2, 3… sin saltos
      expect(Number(f[2].replace(',', '.'))).toBeCloseTo(esperados[i][0], 2)
      expect(Number(f[3].replace(',', '.'))).toBeCloseTo(esperados[i][1], 2)
    })
  })

  it('el anillo va ABIERTO: el último vértice no repite el primero, y lo dice', () => {
    const { texto } = listadoReal()
    const filas = texto
      .split('\n')
      .map((l) => l.trim().match(/^\d+\s+(\d[\d.]*,\d{2})\s+(\d[\d.]*,\d{2})$/))
      .filter(Boolean)
      .map((f) => `${f[1]}|${f[2]}`)
    expect(filas[0]).not.toBe(filas[filas.length - 1])
    expect(new Set(filas).size).toBe(filas.length) // ni un par repetido
    expect(texto).toContain('ABIERTOS')
  })

  it('las coordenadas van SIN separador de millar y las magnitudes CON él', () => {
    // Divergencia deliberada, la misma que `report/contraste-texto.js`: en una tabla
    // de vértices un punto de millar y una coma decimal comparten columna y se
    // confunden; en el pie, las magnitudes se leen mejor agrupadas.
    const { texto } = listadoReal()
    expect(texto).toMatch(/^\s+\d+\s+4392\d\d,\d\d\s+44796\d\d,\d\d$/m) // 439xxx, sin punto
    expect(texto).not.toMatch(/^\s+\d+\s+\d{1,3}\.\d{3},\d\d/m)
    expect(texto).toMatch(/Superficie\s+\.+\s+1\.5\d\d,\d\d m²/) // 1.535,87 m², agrupada
  })

  it('sin detecciones que declarar, no aparece la sección «AL PREPARAR»', () => {
    const { texto, detecciones } = listadoReal()
    expect(detecciones).toEqual([])
    expect(texto).not.toContain('AL PREPARAR ESTE LISTADO')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ Lo medido: este fichero no lo puede releer nuestro propio lector
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · la asimetría, medida y fijada', () => {
  it('⭐ `parseTXT` NO devuelve los anillos de vuelta: los lee mal, y así de mal', () => {
    // Medido el 2026-08-03. Se fija aquí con los VALORES EXACTOS —y no con un
    // `not.toEqual` genérico— para que la prueba diga QUÉ pasa y no solo que algo
    // pasa. La parcela tiene 15 vértices y de aquí salen 18, por cuatro averías:
    const { texto } = listadoReal()
    const { anillos } = parseTXT(texto)
    const leidos = anillos.flat()
    const esperados = redondearAnillo(DEL_WFS.recintos[0].vertices)

    expect(anillos.length).toBe(1)
    expect(leidos.length).toBe(esperados.length + 3)

    expect(leidos[0]).toEqual([3, 8]) // 1 · la FECHA, `03/08/2026 09:45 (UTC)`
    expect(leidos[1]).toEqual([9398516, 3799]) // 2 · la referencia catastral
    // 3 · cada vértice, con su NÚMERO como X y su X como Y — la Y se pierde entera.
    esperados.forEach((v, i) => {
      expect(leidos[i + 2]).toEqual([i + 1, v[0]])
    })
    // 4 · el separador de millar del pie: `1.535,87 m²` → `1` y `535,87`.
    expect(leidos[leidos.length - 1]).toEqual([1, 535.87])

    // Y ni un solo par bueno por ninguna parte.
    for (const v of esperados) expect(leidos).not.toContainEqual([v[0], v[1]])
  })

  it('anteponer `#` NO salvaría la cabecera: el tokenizador no conoce comentarios', () => {
    // Está comprobado porque es la «solución» obvia, y no lo es: `extraerPares` mira
    // cuántos números hay en la línea, no cómo empieza.
    expect(parseTXT(`# Referencia catastral: ${REF}\n1000,00 2000,00`).anillos).toEqual([
      [
        [9398516, 3799],
        [1000, 2000],
      ],
    ])
  })

  it('⭐ pero el destrozo NO pasaría en silencio: `geo/huso.js` lo caza en la puerta', () => {
    // Es lo que permite declarar la asimetría en vez de doblar el formato para que
    // encaje con nuestro parser. Si un día alguien suelta este TXT en la ventana, no
    // sale una parcela plausible y falsa: sale un fichero rechazado.
    for (const par of [
      [1, 439250.35],
      [2, 439263.44],
      [9398516, 3799],
      [1, 535.87],
    ]) {
      expect(detectarHuso(par)).toBeNull()
    }
    // Y en dos de ellos `sanear` además grita.
    expect(sanear([9398516, 3799]).correcciones[0].tipo).toBe('SWAP_XY')
    expect(sanear([1, 535.87]).correcciones[0].tipo).toBe('GRADOS')
    // Anti-vacuidad: con una coordenada de verdad, `detectarHuso` sí resuelve.
    expect(detectarHuso([439250.35, 4479664.55])?.zona).toBe(30)
  })

  it('el fichero lo dice de sí mismo, con la frase exportada', () => {
    const { texto } = listadoReal()
    expect(plano(texto)).toContain(AVISO_NO_REIMPORTABLE)
    expect(AVISO_NO_REIMPORTABLE).toMatch(/no se puede volver a cargar/i)
    expect(AVISO_NO_REIMPORTABLE).toMatch(/fichero de proyecto/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Las medidas del pie salen de las coordenadas IMPRESAS
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · el pie mide lo que la tabla enseña', () => {
  /** La superficie que el listado ESCRIBE, leída de vuelta como número. */
  const superficieEscrita = (texto) =>
    Number(
      texto
        .match(/Superficie\s+\.+\s+([\d.]+,\d\d) m²/)[1]
        .replace(/\./g, '')
        .replace(',', '.'),
    )

  it('con la parcela del WFS las dos medidas COINCIDEN, y no por casualidad', () => {
    // Medido: el Catastro publica sus coordenadas ya con dos decimales, así que
    // redondear no mueve un vértice y las dos cifras son la misma. Se afirma para que
    // nadie use esta parcela como prueba de la decisión —no lo es— y para que se note
    // si algún día el WFS empieza a servir más decimales.
    const recintos = clon(DEL_WFS.recintos)
    const delModelo = superficie(recintos)
    const delPapel = superficie(
      recintos.map((r) => ({ vertices: redondearAnillo(r.vertices), tipo: r.tipo })),
    )
    expect(delPapel).toBe(delModelo)
    expect(superficieEscrita(listadoReal().texto)).toBeCloseTo(delPapel, 2)
  })

  it('⭐ con más decimales que los del papel, se escribe la del PAPEL', () => {
    // Éste es el caso que decide, y es el normal: cualquier geometría que venga de un
    // levantamiento o que haya pasado por el editor de F06 tiene más de dos decimales.
    // Un cuadrado de 40,004 m: el modelo mide 1600,32 m² y el papel, 1600,00.
    const recintos = [recinto(cuadrado(40.004))]
    const delModelo = superficie(recintos)
    const delPapel = superficie([{ vertices: redondearAnillo(recintos[0].vertices), tipo: 'EXTERIOR' }])

    // ANTI-VACUIDAD: si las dos cifras fueran iguales, la prueba no afirmaría nada.
    expect(delPapel).not.toBe(delModelo)
    expect(Math.abs(delPapel - delModelo)).toBeGreaterThan(0.3)

    const escrita = superficieEscrita(
      serializarCoordenadasTxt({ recintos, srs: SRS, fecha: FECHA }).texto,
    )
    expect(escrita).toBeCloseTo(delPapel, 2)
    expect(escrita).not.toBeCloseTo(delModelo, 2)
  })

  it('los perímetros van DESGLOSADOS, y el total SUMA los huecos en vez de restarlos', () => {
    // `geo/metrica.js` devuelve los tres a propósito: «el perímetro» con huecos es una
    // pregunta ambigua. Aquí se escriben los tres para no elegir por el lector, y el
    // texto explica que la superficie resta y la longitud suma.
    const { texto } = serializarCoordenadasTxt({
      recintos: [recinto(cuadrado(40)), recinto(cuadrado(10, 440133.45, 4470997.65), 'HUECO')],
      refcat: null,
      srs: SRS,
      fecha: FECHA,
    })
    expect(texto).toMatch(/Perímetro exterior\s+\.+\s+160,00 m/)
    expect(texto).toMatch(/Perímetro de los huecos\s+\.+\s+40,00 m/)
    expect(texto).toMatch(/Longitud total de lindero\s+\.+\s+200,00 m/)
    expect(texto).toMatch(/Superficie\s+\.+\s+1\.500,00 m²/) // 1600 − 100
    expect(plano(texto)).toContain('un hueco añade lindero, no lo quita')
  })

  it('sin geometría medible las medidas son «No consta», nunca 0,00', () => {
    // Un «0,00 m²» donde falta la superficie afirma que la parcela mide cero.
    const { texto } = serializarCoordenadasTxt({ recintos: [], fecha: FECHA })
    expect(texto).toMatch(/Superficie\s+\.+\s+No consta/)
    expect(texto).not.toContain('0,00 m²')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Lo que hubo que decidir se declara (regla de oro 1)
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · detecciones', () => {
  it('dos vértices que se funden al redondear salen como COLAPSO_POR_REDONDEO', () => {
    const [a, b, c, d] = cuadrado(40)
    const { texto, detecciones, nVertices } = serializarCoordenadasTxt({
      recintos: [recinto([a, [a[0] + 0.001, a[1] + 0.001], b, c, d])],
      fecha: FECHA,
    })
    const colapso = detecciones.find((x) => x.tipo === TIPO_EXPORT.COLAPSO_POR_REDONDEO)
    expect(colapso).toBeDefined()
    expect(colapso.severidad).toBe(SEVERIDAD.AVISO)
    expect(colapso.datos).toMatchObject({ recinto: 0, colapsados: 1 })
    expect(nVertices).toBe(4) // el fundido no se lista dos veces
    // Y se escribe DENTRO del fichero, no solo en el objeto: quien lo abre en el
    // campo no tiene la consola delante.
    expect(texto).toContain('AL PREPARAR ESTE LISTADO')
    expect(plano(texto)).toContain('dos estacas en el mismo sitio')
  })

  it('un anillo que no llega a 3 vértices se declara, pero sus vértices se listan', () => {
    const { texto, detecciones } = serializarCoordenadasTxt({
      recintos: [recinto(cuadrado(40)), recinto([[440200, 4471000], [440201, 4471001]], 'HUECO')],
      fecha: FECHA,
    })
    const descartado = detecciones.find((x) => x.tipo === TIPO_EXPORT.ANILLO_DESCARTADO)
    expect(descartado).toBeDefined()
    expect(descartado.datos).toMatchObject({ recinto: 1, vertices: 2 })
    // Los vértices SIGUEN en el papel: decidir qué hacer con ellos es de quien firma.
    expect(texto).toContain('440200,00')
    expect(texto).toContain('440201,00')
    // Y no han estropeado la medida del exterior.
    expect(texto).toMatch(/Superficie\s+\.+\s+1\.600,00 m²/)
  })

  it('una parcela sin geometría sale como CAPA_VACIA, no como excepción', () => {
    const { texto, detecciones, nVertices } = serializarCoordenadasTxt({ recintos: [], fecha: FECHA })
    expect(detecciones.map((d) => d.tipo)).toEqual([TIPO_EXPORT.CAPA_VACIA])
    expect(nVertices).toBe(0)
    expect(texto).toContain('No consta la geometría de la parcela.')
  })

  it('un exterior degenerado no revienta el invariante de geo/area.js', () => {
    // `superficie` y `perimetro` LANZAN si recintos[0] no es el EXTERIOR. Filtrar los
    // degenerados sin más dejaría un HUECO en la posición 0 y el módulo reventaría
    // con una excepción de otra capa, lejos de la causa.
    const { texto, detecciones } = serializarCoordenadasTxt({
      recintos: [recinto([[440100, 4471000]]), recinto(cuadrado(10), 'HUECO')],
      fecha: FECHA,
    })
    expect(detecciones.some((d) => d.tipo === TIPO_EXPORT.ANILLO_DESCARTADO)).toBe(true)
    expect(texto).toMatch(/Superficie\s+\.+\s+No consta/)
  })

  it('el resumen cuenta lo mismo que la lista de detecciones', () => {
    const { detecciones, resumen } = serializarCoordenadasTxt({ recintos: [], fecha: FECHA })
    expect(resumen.total).toBe(detecciones.length)
    expect(resumen.porTipo[TIPO_EXPORT.CAPA_VACIA]).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Regla de oro 9: la aplicación mide, el colegiado interpreta
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Palabras que convertirían una cifra en un veredicto. Mismo guardián, y casi el
 * mismo léxico, que `report/contraste-texto.js`.
 */
const VOCABULARIO_PROHIBIDO = [
  /\bcorrect[oa]s?\b/i,
  /\bapt[oa]s?\b/i,
  /\bcumple\b/i,
  /\bconforme\b/i,
  /\bválid[oa]s?\b/i,
  /\bdentro de tolerancia\b/i,
  /\berr[oó]neo\b/i,
  /[✓✔⚠]/,
]

describe('export/coordenadas · ni una cifra con juicio de valor', () => {
  it('el listado no usa una sola palabra de mérito', () => {
    const { texto } = listadoReal()
    for (const prohibida of VOCABULARIO_PROHIBIDO) {
      expect(texto).not.toMatch(prohibida)
    }
  })

  it('⚠️ el guardián de vocabulario se prueba a sí mismo', () => {
    // Un guardián que no puede fallar no protege de nada; este repo ya tiene escrito
    // lo que opina de las comprobaciones que ningún cambio pone en rojo.
    const impostor = 'La superficie es correcta ✓ y la parcela cumple.'
    expect(VOCABULARIO_PROHIBIDO.some((p) => p.test(impostor))).toBe(true)
    expect(VOCABULARIO_PROHIBIDO.filter((p) => p.test(impostor)).length).toBeGreaterThanOrEqual(3)
  })

  it('el listado dice, con todas las letras, que no concluye nada', () => {
    const { texto } = listadoReal()
    expect(texto).toContain('Esa lectura es de quien firma.')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Guardianes sobre el TEXTO del fuente
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · guardianes de fuente', () => {
  it('el módulo NO consulta el reloj ni un formateador dependiente del entorno', () => {
    // Mismo grep que F08 puso sobre `report/contraste-texto.js`, y por lo mismo: un
    // fichero descargado es un snapshot y su prueba tiene que valer dentro de un año.
    // Se mira el fuente entero, comentarios incluidos, para que la llamada no se
    // pueda colar «documentada».
    expect(FUENTE_MODULO).not.toMatch(/Date\.now\(\)/)
    expect(FUENTE_MODULO).not.toMatch(/new Date\(\)/)
    expect(FUENTE_MODULO).not.toMatch(/toLocale(?:Date|Time)?String/)
  })

  it('no importa nada de `viewer/`, `services/` ni `storage/`: `export/` es puro', () => {
    // Si esto se rompe, el barrel raíz se lleva Leaflet a la suite `node`.
    const imports = [...FUENTE_MODULO.matchAll(/^import .* from '(.+)'$/gm)].map((m) => m[1])
    expect(imports.length).toBeGreaterThan(0)
    for (const ruta of imports) {
      expect(ruta).not.toMatch(/\/(viewer|services|storage|app)\//)
      expect(ruta).not.toBe('leaflet')
    }
  })

  it('⚠️ `viewer/acotaciones.js` sigue formateando los metros igual que aquí', () => {
    // No se importa `textoDeLongitud` porque aquel módulo importa Leaflet en su
    // primera línea y este vive en el proyecto `node` y sale por el barrel. Lo que se
    // duplica son tres líneas de `Intl.NumberFormat`; lo que impide que las dos
    // diverjan es esta lectura del TEXTO —sin importar el módulo, que es la gracia—.
    const acotaciones = readFileSync(join(RAIZ, 'viewer', 'acotaciones.js'), 'utf8')
    expect(acotaciones).toMatch(/new Intl\.NumberFormat\('es-ES'/)
    expect(acotaciones).toMatch(/DECIMALES_LONGITUD\s*=\s*2/)
    expect(FUENTE_MODULO).toMatch(/new Intl\.NumberFormat\('es-ES'/)
    expect(DECIMALES_COORD).toBe(2)
  })

  it('⚠️ `.gitattributes` fija el final de línea de la snapshot', () => {
    // El escritor emite LF. Con `core.autocrlf=true`, un clon en Windows recibiría la
    // snapshot con CRLF y la comparación byte a byte se pondría roja sin que nadie
    // hubiera tocado nada: el defecto (1) del propio `.gitattributes`.
    const atributos = readFileSync(join(RAIZ, '.gitattributes'), 'utf8')
    expect(atributos).toMatch(/test\/export\/__snapshots__\/\*\.txt\s+text\s+eol=lf/)
  })

  it('el terminador es LF en todo el fichero, sin un solo CR', () => {
    const { texto } = listadoReal()
    expect(texto).not.toContain('\r')
    expect(texto.split('\n').length).toBeGreaterThan(30)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · La frontera: el entorno degrada, el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · contrato roto por el programador', () => {
  it('unos recintos con forma imposible lanzan TypeError', () => {
    expect(() => serializarCoordenadasTxt({ recintos: 'nada', fecha: FECHA })).toThrow(TypeError)
    expect(() => serializarCoordenadasTxt({ recintos: [{ vertices: 'no' }], fecha: FECHA })).toThrow(
      TypeError,
    )
    expect(() => serializarCoordenadasTxt(null)).toThrow(TypeError)
    expect(() => serializarCoordenadasTxt([])).toThrow(TypeError)
  })

  it('sin fecha, o con una fecha inservible, no se compone un listado sin fechar', () => {
    expect(() => serializarCoordenadasTxt({ recintos: [] })).toThrow(TypeError)
    expect(() => serializarCoordenadasTxt({ recintos: [], fecha: '2026-08-03' })).toThrow(TypeError)
    expect(() => serializarCoordenadasTxt({ recintos: [], fecha: new Date('nada') })).toThrow(
      RangeError,
    )
  })

  it('un `refcat` o un `srs` que no son texto lanzan, en vez de imprimirse como `[object Object]`', () => {
    expect(() => serializarCoordenadasTxt({ recintos: [], fecha: FECHA, refcat: 42 })).toThrow(TypeError)
    expect(() => serializarCoordenadasTxt({ recintos: [], fecha: FECHA, srs: {} })).toThrow(TypeError)
    expect(() => serializarCoordenadasTxt({ recintos: [], fecha: FECHA, nombre: [] })).toThrow(TypeError)
  })

  it('una coordenada fuera del rango publicable la rechaza `redondearCoord`, con su motivo', () => {
    expect(() =>
      serializarCoordenadasTxt({ recintos: [recinto([[1e16, 0], [1, 1], [2, 2]])], fecha: FECHA }),
    ).toThrow(RangeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · El snapshot, al final
// ═════════════════════════════════════════════════════════════════════════════

describe('export/coordenadas · snapshot de bytes', () => {
  it('el listado de la parcela real, byte a byte', async () => {
    const { texto } = listadoReal({ nombre: 'Parcela de prueba' })
    await expect(texto).toMatchFileSnapshot('./__snapshots__/coordenadas-parcela-real.txt')
  })
})
