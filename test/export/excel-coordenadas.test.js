/* -------------------------------------------------------------------------- *
 * test/export/excel-coordenadas.test.js — F20 · T2.2 · La maqueta del Excel   *
 *                                                                            *
 * `export/excel-coordenadas.js` no calcula geometría ni escribe XML: DECIDE   *
 * qué va en cada celda. Así que aquí se prueba eso, y una cosa más que es la  *
 * razón de ser de la fase:                                                    *
 *                                                                            *
 *   1. La estructura pedida: título, identificador, zona y las tres columnas. *
 *   2. ⭐ **Que los números sean NÚMEROS.** Es media fase: una coordenada      *
 *      convertida a texto no se puede sumar, y esa carencia es la que abre    *
 *      F20. Se comprueba el tipo de la celda, no su apariencia.               *
 *   3. ⭐⭐ **EL GUARDIÁN CRUZADO (criterio 5).** El `.xlsx` y el `.txt` son   *
 *      el mismo listado en dos envases, así que tienen que decir lo mismo:    *
 *      la misma superficie, el mismo perímetro y, vértice a vértice, las      *
 *      mismas coordenadas EN EL MISMO ORDEN. Comparten `prepararListado`, o   *
 *      sea que esto no debería poder romperse — y por eso mismo, si se        *
 *      rompiera, sería una regresión gorda y silenciosa.                      *
 *   4. Una hoja por recinto, y el pie de medidas SOLO en la del exterior.     *
 *   5. Que lo que hubo que decidir esté impreso DENTRO del libro, no solo en  *
 *      el panel de la aplicación (regla de oro 1): quien recibe el fichero    *
 *      por correo no vio nunca esa pantalla.                                  *
 *   6. Que ninguna celda lleve juicio de valor (regla de oro 9).              *
 *                                                                            *
 * Proyecto Vitest `node`.                                                     *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SEVERIDAD, TIPO_EXPORT } from '../../export/_comun.js'
import { serializarCoordenadasTxt } from '../../export/coordenadas.js'
import {
  AVISO_NO_REIMPORTABLE_EXCEL,
  serializarCoordenadasExcel,
} from '../../export/excel-coordenadas.js'
import { ESTILO } from '../../export/xlsx.js'
import { parsearGml } from '../../gml/parse.js'
import { leerLibro, textoDe, valor } from './_leer-xlsx.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'export', 'excel-coordenadas.js'), 'utf8')

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
const FECHA = new Date(Date.UTC(2026, 7, 6, 17, 42, 30))

const opcionesReales = (extra = {}) => ({
  recintos: clon(DEL_WFS.recintos),
  refcat: REF,
  srs: SRS,
  fecha: FECHA,
  ...extra,
})

const excelReal = (extra = {}) => serializarCoordenadasExcel(opcionesReales(extra))
const libroReal = (extra = {}) => leerLibro(excelReal(extra).bytes)

/** Un cuadrado de `lado` metros en UTM 30N realista, anillo ABIERTO. */
const cuadrado = (lado, x = 440123.45, y = 4470987.65) => [
  [x, y],
  [x + lado, y],
  [x + lado, y + lado],
  [x, y + lado],
]

const recinto = (vertices, tipo = 'EXTERIOR') => ({ vertices, tipo })

/** Parcela de juguete con un hueco dentro, para los casos de varias hojas. */
const conHueco = () => [
  recinto(cuadrado(100)),
  recinto(cuadrado(10, 440150, 4471020), 'HUECO'),
]

/** El número de fila en el que aparece un texto en la columna A. */
function filaDe(hoja, texto) {
  for (const [ref, celda] of hoja.celdas) {
    if (ref.startsWith('A') && celda.valor === texto) return Number(ref.slice(1))
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
describe('la estructura que se pidió', () => {
  const hoja = libroReal().hojas[0]

  it('lleva el título de la imagen, y ocupa las tres columnas', () => {
    expect(valor(hoja, 'A1')).toBe('Coordenadas Parcela')
    expect(hoja.combinaciones).toEqual(['A1:C1'])
  })

  it('⚠️ emite B1 y C1 vacías PERO con estilo, o el recuadro saldría abierto', () => {
    // Una celda combinada solo dibuja el borde de las celdas que existen de verdad.
    for (const ref of ['B1', 'C1']) {
      expect(hoja.celdas.has(ref), `${ref} tiene que existir`).toBe(true)
      expect(valor(hoja, ref)).toBe(null)
      expect(hoja.celdas.get(ref).estilo).toBe(Object.keys(ESTILO).indexOf('TITULO'))
    }
  })

  it('lleva el identificador y la zona, con la etiqueta a la izquierda', () => {
    expect(valor(hoja, 'A2')).toBe('Identificador:')
    expect(valor(hoja, 'B2')).toBe(REF)
    expect(valor(hoja, 'A3')).toBe('Zona:')
    expect(valor(hoja, 'B3')).toBe('UTM 30 ETRS89')
  })

  it('lleva las tres columnas con el rótulo de la imagen', () => {
    const f = filaDe(hoja, 'Vértice')
    expect(f).not.toBeNull()
    expect(valor(hoja, `B${f}`)).toBe('Coordenada X')
    expect(valor(hoja, `C${f}`)).toBe('Coordenada Y')
  })

  it('dice de qué recinto es la hoja, cuántos vértices lleva y de cuándo es', () => {
    expect(valor(hoja, 'A4')).toBe('Recinto:')
    expect(valor(hoja, 'B4')).toBe('Contorno exterior')
    expect(filaDe(hoja, 'Vértices:')).not.toBeNull()
    expect(filaDe(hoja, 'Fecha:')).not.toBeNull()
    expect(textoDe(hoja)).toContain('06/08/2026 17:42 (UTC)')
  })

  it('la fila del expediente solo aparece cuando hay expediente', () => {
    expect(filaDe(libroReal().hojas[0], 'Expediente:')).toBeNull()
    const con = libroReal({ nombre: 'Segregación de la 7136910' }).hojas[0]
    const f = filaDe(con, 'Expediente:')
    expect(f).not.toBeNull()
    expect(valor(con, `B${f}`)).toBe('Segregación de la 7136910')
  })

  it('pone anchos a las tres columnas: una coordenada que se ve «#####» no está', () => {
    expect(hoja.xml).toContain('<cols>')
    expect(hoja.xml).toMatch(/<col min="1" max="1" width="\d/)
    expect(hoja.xml).toMatch(/<col min="3" max="3" width="\d/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('⭐ los números son números', () => {
  const hoja = libroReal().hojas[0]
  const primera = filaDe(hoja, 'Vértice') + 1

  it('la coordenada es una celda numérica, no una cadena', () => {
    const x = hoja.celdas.get(`B${primera}`)
    expect(x.esNumero, 'la X tiene que ser un número').toBe(true)
    expect(typeof x.valor).toBe('number')
    const y = hoja.celdas.get(`C${primera}`)
    expect(y.esNumero, 'la Y tiene que ser un número').toBe(true)
  })

  it('y NO lleva la coma decimal metida dentro: la pone Excel al pintarla', () => {
    // Este es el fallo que convertiría la tabla en texto: `"372516,02"` no se suma.
    expect(hoja.xml).not.toMatch(/<v>[\d]+,[\d]+<\/v>/)
  })

  it('el número de vértice también es número, y empieza en 1', () => {
    const n = hoja.celdas.get(`A${primera}`)
    expect(n.esNumero).toBe(true)
    expect(n.valor).toBe(1)
  })

  it('numera hasta el último vértice sin saltos', () => {
    const { nVertices } = excelReal()
    for (let i = 0; i < nVertices; i++) {
      expect(valor(hoja, `A${primera + i}`), `vértice ${i + 1}`).toBe(i + 1)
    }
    expect(hoja.celdas.has(`A${primera + nVertices}`)).toBe(false)
  })

  it('las medidas del pie también son números, con su unidad en el FORMATO', () => {
    const f = filaDe(hoja, 'Superficie')
    const celda = hoja.celdas.get(`B${f}`)
    expect(celda.esNumero).toBe(true)
    expect(celda.estilo).toBe(Object.keys(ESTILO).indexOf('METROS_CUADRADOS'))
    // La unidad NO viaja dentro del valor: si viajara, la celda sería texto.
    expect(String(celda.valor)).not.toContain('m²')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('⭐⭐ el guardián cruzado: el .xlsx y el .txt dicen lo mismo', () => {
  // ⚠️ `useGrouping: true` va EXPLÍCITO, y no es redundante: el defecto es `"auto"`,
  // y en español `"auto"` NO separa los millares hasta las cinco cifras
  // (`minimumGroupingDigits` es 2). Medido al escribir esta prueba: con `"auto"`,
  // 9.900 sale «9900,00» aquí y «9.900,00» en el `.txt`, que sí lo pide explícito
  // (`export/coordenadas.js#nf`). Los dos documentos no divergían: divergía el test.
  const dosDecimales = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  })
  const coordenada = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  })

  const texto = serializarCoordenadasTxt(opcionesReales()).texto
  const hoja = libroReal().hojas[0]

  it('la superficie del Excel, escrita como la escribe el .txt, está en el .txt', () => {
    const s = hoja.celdas.get(`B${filaDe(hoja, 'Superficie')}`).valor
    expect(texto).toContain(`${dosDecimales.format(s)} m²`)
  })

  it('y las tres longitudes, igual', () => {
    for (const rotulo of ['Perímetro exterior', 'Perímetro de los huecos', 'Longitud total de lindero']) {
      const v = hoja.celdas.get(`B${filaDe(hoja, rotulo)}`).valor
      expect(texto, rotulo).toContain(`${dosDecimales.format(v)} m`)
    }
  })

  it('⭐ vértice a vértice, las MISMAS coordenadas y en el MISMO orden', () => {
    // Las filas de la tabla del `.txt`: «  1   372516,02   4084674,06».
    const delTxt = texto
      .split('\n')
      .map((l) => l.trim().match(/^(\d+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)$/))
      .filter((m) => m !== null)
      .map((m) => ({ n: Number(m[1]), x: m[2], y: m[3] }))

    const { nVertices } = excelReal()
    expect(delTxt.length, 'el .txt tiene que listar los mismos vértices').toBe(nVertices)

    const primera = filaDe(hoja, 'Vértice') + 1
    delTxt.forEach((fila, i) => {
      expect(valor(hoja, `A${primera + i}`), `número del vértice ${i + 1}`).toBe(fila.n)
      expect(coordenada.format(valor(hoja, `B${primera + i}`)), `X del vértice ${fila.n}`).toBe(fila.x)
      expect(coordenada.format(valor(hoja, `C${primera + i}`)), `Y del vértice ${fila.n}`).toBe(fila.y)
    })
  })

  it('las dos salidas cuentan los mismos vértices y las mismas detecciones', () => {
    const excel = excelReal()
    const txt = serializarCoordenadasTxt(opcionesReales())
    expect(excel.nVertices).toBe(txt.nVertices)
    expect(excel.detecciones).toEqual(txt.detecciones)
    expect(excel.resumen).toEqual(txt.resumen)
  })

  it('y también sobre una parcela CON hueco, que es donde la superficie es neta', () => {
    const opciones = { recintos: conHueco(), refcat: null, srs: SRS, fecha: FECHA }
    const hojaHueco = leerLibro(serializarCoordenadasExcel(opciones).bytes).hojas[0]
    const textoHueco = serializarCoordenadasTxt(opciones).texto
    const s = hojaHueco.celdas.get(`B${filaDe(hojaHueco, 'Superficie')}`).valor
    expect(s).toBe(100 * 100 - 10 * 10) // exterior menos hueco
    expect(textoHueco).toContain(`${dosDecimales.format(s)} m²`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('una hoja por recinto', () => {
  const libro = leerLibro(
    serializarCoordenadasExcel({ recintos: conHueco(), refcat: REF, srs: SRS, fecha: FECHA }).bytes,
  )

  it('rotula las pestañas como el .txt rotula sus secciones', () => {
    expect(libro.hojas.map((h) => h.nombre)).toEqual(['Contorno exterior', 'Hueco 1'])
  })

  it('cuenta las hojas para quien lo llame', () => {
    expect(
      serializarCoordenadasExcel({ recintos: conHueco(), refcat: null, srs: SRS, fecha: FECHA }).nHojas,
    ).toBe(2)
  })

  it('cada hoja lleva SUS vértices, no los de la parcela entera', () => {
    const exterior = libro.porNombre.get('Contorno exterior')
    const hueco = libro.porNombre.get('Hueco 1')
    expect(valor(exterior, `B${filaDe(exterior, 'Vértices:')}`)).toBe(4)
    expect(valor(hueco, `B${filaDe(hueco, 'Vértices:')}`)).toBe(4)
    // Y el vértice 1 de cada una es el suyo, no el del otro recinto.
    const pE = filaDe(exterior, 'Vértice') + 1
    const pH = filaDe(hueco, 'Vértice') + 1
    expect(valor(exterior, `B${pE}`)).toBe(440123.45)
    expect(valor(hueco, `B${pH}`)).toBe(440150)
  })

  it('⭐ el pie de medidas va SOLO en la del exterior', () => {
    // Repetir la superficie NETA en la pestaña de un hueco afirmaría que es la
    // superficie de ese hueco, y es falso.
    expect(filaDe(libro.porNombre.get('Contorno exterior'), 'Superficie')).not.toBeNull()
    expect(filaDe(libro.porNombre.get('Hueco 1'), 'Superficie')).toBeNull()
  })

  it('pero la hoja del hueco DICE dónde están las medidas, en vez de callarse', () => {
    expect(textoDe(libro.porNombre.get('Hueco 1'))).toContain('están en la primera')
  })

  it('numera los huecos desde 1 aunque sean varios', () => {
    const tres = [recinto(cuadrado(100)), recinto(cuadrado(5, 440130, 4471000), 'HUECO'), recinto(cuadrado(5, 440160, 4471040), 'HUECO')]
    const l = leerLibro(serializarCoordenadasExcel({ recintos: tres, srs: SRS, fecha: FECHA }).bytes)
    expect(l.hojas.map((h) => h.nombre)).toEqual(['Contorno exterior', 'Hueco 1', 'Hueco 2'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('lo que hubo que decidir, IMPRESO en el libro', () => {
  it('un vértice que se funde al redondear sale por detecciones Y en la hoja', () => {
    // Dos vértices a menos de un centímetro caen en el mismo punto al redondear.
    const casi = [
      [440123.45, 4470987.65],
      [440123.451, 4470987.652],
      [440223.45, 4470987.65],
      [440223.45, 4471087.65],
      [440123.45, 4471087.65],
    ]
    const r = serializarCoordenadasExcel({ recintos: [recinto(casi)], srs: SRS, fecha: FECHA })
    expect(r.detecciones.some((d) => d.tipo === TIPO_EXPORT.COLAPSO_POR_REDONDEO)).toBe(true)

    const hoja = leerLibro(r.bytes).hojas[0]
    expect(filaDe(hoja, 'Al preparar esta hoja')).not.toBeNull()
    expect(textoDe(hoja)).toContain(`[${SEVERIDAD.AVISO}]`)
    expect(textoDe(hoja)).toContain('se han fundido')
  })

  it('cuando no hubo nada que decidir, no aparece el bloque', () => {
    expect(filaDe(libroReal().hojas[0], 'Al preparar esta hoja')).toBeNull()
  })

  it('lleva impreso que esta hoja no se puede volver a cargar aquí', () => {
    expect(textoDe(libroReal().hojas[0])).toContain(AVISO_NO_REIMPORTABLE_EXCEL)
  })

  it('⚠️ y su motivo es el SIMPLE —no sabemos abrir Excel—, no el del .txt', () => {
    // El `.txt` no se puede releer porque su primera columna es el número de
    // vértice. Aquí eso también es verdad, pero hay una razón anterior, y dar la
    // complicada deja pensando que quitando una columna se arreglaría.
    expect(AVISO_NO_REIMPORTABLE_EXCEL).toContain('no sabe abrir ficheros de Excel')
    expect(AVISO_NO_REIMPORTABLE_EXCEL).toContain('fichero de proyecto')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('los casos degradados, que NO lanzan', () => {
  it('una parcela sin geometría da un libro con UNA hoja que lo dice', () => {
    // Un libro sin hojas no lo abre Excel, así que aquí no vale devolver cero.
    const r = serializarCoordenadasExcel({ recintos: [], srs: SRS, fecha: FECHA })
    expect(r.nHojas).toBe(1)
    expect(r.nVertices).toBe(0)
    expect(r.detecciones.some((d) => d.tipo === TIPO_EXPORT.CAPA_VACIA)).toBe(true)

    const libro = leerLibro(r.bytes)
    expect(libro.hojas[0].nombre).toBe('Parcela sin geometría')
    expect(textoDe(libro.hojas[0])).toContain('No consta la geometría de la parcela.')
  })

  it('un recinto degenerado se lista igual, y se dice que no forma anillo', () => {
    const r = serializarCoordenadasExcel({
      recintos: [recinto([[440123.45, 4470987.65], [440133.45, 4470987.65]])],
      srs: SRS,
      fecha: FECHA,
    })
    expect(r.detecciones.some((d) => d.tipo === TIPO_EXPORT.ANILLO_DESCARTADO)).toBe(true)
    const hoja = leerLibro(r.bytes).hojas[0]
    // Sus vértices SÍ están: decidir qué hacer con ellos es de quien firma.
    const primera = filaDe(hoja, 'Vértice') + 1
    expect(valor(hoja, `B${primera}`)).toBe(440123.45)
    expect(textoDe(hoja)).toContain('no forma un anillo')
  })

  it('sin superficie medible, el pie dice «No consta» en vez de un cero', () => {
    const r = serializarCoordenadasExcel({
      recintos: [recinto([[440123.45, 4470987.65], [440133.45, 4470987.65]])],
      srs: SRS,
      fecha: FECHA,
    })
    const hoja = leerLibro(r.bytes).hojas[0]
    const celda = hoja.celdas.get(`B${filaDe(hoja, 'Superficie')}`)
    expect(celda.esNumero).toBe(false)
    expect(celda.valor).toBe('No consta')
  })

  it('sin referencia catastral y sin huso, se dice y no se inventa', () => {
    const hoja = leerLibro(
      serializarCoordenadasExcel({ recintos: [recinto(cuadrado(50))], fecha: FECHA }).bytes,
    ).hojas[0]
    expect(valor(hoja, 'B2')).toBe('No consta')
    expect(valor(hoja, 'B3')).toBe('No consta')
  })

  it('un SRS que no conocemos se escribe TAL CUAL, no se traduce a la fuerza', () => {
    const hoja = leerLibro(
      serializarCoordenadasExcel({
        recintos: [recinto(cuadrado(50))],
        srs: 'EPSG:32628',
        fecha: FECHA,
      }).bytes,
    ).hojas[0]
    expect(valor(hoja, 'B3')).toBe('EPSG:32628')
  })

  it('traduce los tres husos peninsulares', () => {
    for (const [srs, zona] of [
      ['EPSG:25829', 'UTM 29 ETRS89'],
      ['EPSG:25830', 'UTM 30 ETRS89'],
      ['EPSG:25831', 'UTM 31 ETRS89'],
    ]) {
      const hoja = leerLibro(
        serializarCoordenadasExcel({ recintos: [recinto(cuadrado(50))], srs, fecha: FECHA }).bytes,
      ).hojas[0]
      expect(valor(hoja, 'B3'), srs).toBe(zona)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('regla de oro 9 — mide, no dictamina', () => {
  const PROHIBIDAS = [
    'correcto',
    'incorrecto',
    'válido',
    'inválido',
    'cumple',
    'no cumple',
    'conforme',
    'aprobado',
    'error de la parcela',
    '✓',
    '✔',
    '❌',
  ]

  it('ninguna celda del libro emite un veredicto', () => {
    const libro = leerLibro(
      serializarCoordenadasExcel({ recintos: conHueco(), refcat: REF, srs: SRS, fecha: FECHA }).bytes,
    )
    const todo = libro.hojas.map(textoDe).join('\n').toLowerCase()
    for (const palabra of PROHIBIDAS) {
      expect(todo, `el libro no puede decir «${palabra}»`).not.toContain(palabra.toLowerCase())
    }
  })

  it('y el guardián no es vacuo: reconoce la palabra si la mete alguien', () => {
    // Sin esto, el test de arriba pasaría igual con la lista de palabras vacía.
    const inventado = 'la parcela es válida y cumple'
    expect(PROHIBIDAS.some((p) => inventado.includes(p))).toBe(true)
  })

  it('dice explícitamente que no juzga', () => {
    expect(textoDe(libroReal().hojas[0])).toContain('Esa lectura es de quien firma.')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('el contrato', () => {
  it('devuelve bytes, y no texto', () => {
    expect(excelReal().bytes).toBeInstanceOf(Uint8Array)
  })

  it('no lee el reloj: su texto fuente no nombra `Date.now` ni construye fechas', () => {
    expect(FUENTE_MODULO).not.toMatch(/Date\.now\(/)
    expect(FUENTE_MODULO).not.toMatch(/new Date\(/)
  })

  it('lanza con opciones que no son un objeto', () => {
    for (const malo of [null, 'x', 42, []]) {
      expect(() => serializarCoordenadasExcel(malo)).toThrow(TypeError)
    }
  })

  it('lanza con recintos que no tienen la forma del modelo', () => {
    for (const malo of ['x', 42, [{}], [{ vertices: 'no' }]]) {
      expect(() => serializarCoordenadasExcel({ recintos: malo, fecha: FECHA })).toThrow(TypeError)
    }
  })

  it('lanza con refcat, srs o nombre que no son texto ni null', () => {
    for (const clave of ['refcat', 'srs', 'nombre']) {
      expect(() =>
        serializarCoordenadasExcel({ recintos: [], fecha: FECHA, [clave]: 42 }),
      ).toThrow(TypeError)
    }
  })

  it('lanza sin fecha, con otra cosa, o con una fecha inválida', () => {
    expect(() => serializarCoordenadasExcel({ recintos: [] })).toThrow(TypeError)
    expect(() => serializarCoordenadasExcel({ recintos: [], fecha: 1_754_000_000_000 })).toThrow(TypeError)
    expect(() => serializarCoordenadasExcel({ recintos: [], fecha: new Date('nada') })).toThrow(RangeError)
  })

  it('es determinista: la misma parcela y la misma fecha dan los mismos bytes', () => {
    expect(Array.from(excelReal().bytes)).toEqual(Array.from(excelReal().bytes))
  })
})
