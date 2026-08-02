/* -------------------------------------------------------------------------- *
 * test/report/contraste-texto.test.js — F08 · T2.2 · El informe de texto      *
 *                                                                            *
 * `report/contraste-texto.js` no calcula nada: FORMATEA. Así que lo que hay   *
 * que probar no es aritmética, sino que el documento DICE lo que tiene que    *
 * decir y —sobre todo— que NO dice lo que tiene prohibido decir:              *
 *                                                                            *
 *   1. Que el informe completo sobre la parcela REAL sale entero, con las     *
 *      once secciones de `diagnosticar()` rotuladas y sus cifras en formato   *
 *      español. El `diagnostico` se construye llamando a `diagnosticar()` de  *
 *      VERDAD sobre los fixtures del WFS, nunca con un objeto inventado a     *
 *      mano: un informe montado sobre datos de juguete demuestra que el       *
 *      formateador compila, no que el documento sirva.                        *
 *   2. Que los tres sabores de «no hay» no se confunden: «no se ha            *
 *      consultado» ≠ «ninguna», y «No consta» ≠ «0,00 m²».                    *
 *   3. Que ninguna cifra lleva juicio de valor (SPEC §2, regla 9), afirmado   *
 *      con un guardián de vocabulario que además se prueba a sí mismo.        *
 *   4. Que el módulo no lee el reloj, con un grep sobre su TEXTO fuente.      *
 *                                                                            *
 * El SNAPSHOT va al final y es la última aserción, no la primera: un snapshot *
 * está a un `-u` de no significar nada, así que antes van las afirmaciones    *
 * por contenido, que sí sobreviven a una actualización distraída.             *
 *                                                                            *
 * ⚠️ La `Comprobacion` se FABRICA aquí, no se importa. `comprobacion/gml.js`  *
 * (tarea T2.1) se está escribiendo en paralelo; este fichero se programa      *
 * contra el CONTRATO B del plan de F08 y no contra un módulo que puede no     *
 * existir todavía. Los NÚMEROS de esa comprobación fabricada sí se derivan de *
 * los ficheros reales (`parsearGml` + `geo/area.js`), para que el informe de  *
 * prueba no contenga una sola cifra inventada.                                *
 *                                                                            *
 * Proyecto Vitest `node`: texto y aritmética, sin DOM.                        *
 * -------------------------------------------------------------------------- */

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { OMISION, diagnosticar } from '../../diagnostico/parcela.js'
import { superficie } from '../../geo/area.js'
import { parsearGml } from '../../gml/parse.js'
import { OMISION_CONOCIDA, informeContrasteTexto } from '../../report/contraste-texto.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'report', 'contraste-texto.js'), 'utf8')

/** Clon profundo por JSON: vale porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

// ── Los fixtures REALES ─────────────────────────────────────────────────────

const REF = '9398516VK3799G'

const RUTA_GML_PARCELA = join(RAIZ, 'test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml')

/** La parcela y sus cuatro colindantes, del WFS, sin tocar un vértice. */
const VECINDARIO = parsearGml(
  readFileSync(
    join(RAIZ, 'test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
    'utf8',
  ),
)
const TODAS = VECINDARIO.parcelas.map((p) => ({ refcat: p.refcat, recintos: p.recintos }))
const PROPIA = TODAS.find((v) => v.refcat === REF)
const VECINAS = TODAS.filter((v) => v.refcat !== REF)

/** El GML de UNA parcela: el fichero que el usuario soltaría en la ventana. */
const FICHERO = parsearGml(readFileSync(RUTA_GML_PARCELA, 'utf8'))
const DEL_FICHERO = FICHERO.parcelas[0]

/** La geometría OFICIAL, intacta. Se clona en cada uso: regla de oro 2. */
const oficial = () => clon(PROPIA.recintos)

/**
 * La geometría EDITADA: la oficial con su primer vértice movido **0,40 m al
 * este**. Es exactamente el caso de `test/diagnostico/parcela.test.js`, elegido
 * porque una sola edición produce las ocho métricas a la vez — incluidas
 * invasiones REALES a tres colindantes.
 */
function editada() {
  const r = clon(PROPIA.recintos)
  r[0].vertices[0] = [r[0].vertices[0][0] + 0.4, r[0].vertices[0][1]]
  return r
}

/** Cifras del expediente real. La DECLARADA es entera (override O6). */
const DECLARADA = DEL_FICHERO.areaValue
const REGISTRAL = 1500

/** Instante FIJO. La fecha entra por parámetro; el módulo no consulta el reloj. */
const FECHA = new Date(Date.UTC(2026, 6, 30, 9, 5, 0))

// ── La `Comprobacion` fabricada (CONTRATO B del plan de F08) ────────────────

/**
 * Una `Comprobacion` con la FORMA del contrato B y los NÚMEROS de los ficheros
 * reales. `notas`, `bloqueos` y `hallazgos` se pueden sustituir por caso.
 *
 * @param {object} [cambios]  Se funde sobre la base (superficial).
 */
function comprobacionDe(cambios = {}) {
  const recintos = editada()
  return {
    fichero: {
      nombre: 'cp_parcela_9398516VK3799G.gml',
      bytes: statSync(RUTA_GML_PARCELA).size,
      encodingDeclarado: FICHERO.resumen.encodingDeclarado,
      encodingUsado: 'utf-8',
    },
    dialecto: {
      id: FICHERO.dialecto,
      soportado: FICHERO.soportado,
      etiqueta: 'Parcela catastral INSPIRE CP 4.0 (descarga del WFS)',
      queSignifica:
        'Es el fichero que devuelve el servicio WFS del Catastro cuando se le pide una parcela.',
    },
    miembros: [
      {
        indice: 0,
        refcat: DEL_FICHERO.refcat,
        localId: DEL_FICHERO.localId,
        namespaceInspire: DEL_FICHERO.namespaceInspire,
        etiqueta: `${DEL_FICHERO.refcat} (cp:label ${DEL_FICHERO.label})`,
        nVertices: recintos[0].vertices.length,
        nHuecos: recintos.length - 1,
        superficieDeclarada: DECLARADA,
        superficieMedida: superficie(recintos),
        srs: DEL_FICHERO.srs,
        orientacionExterior: DEL_FICHERO.orientacion[0],
      },
    ],
    elegido: 0,
    geometria: { recintos, srs: DEL_FICHERO.srs },
    hallazgos: [],
    notas: [
      {
        tipo: 'ENCODING_DESMENTIDO',
        severidad: 'AVISO',
        mensaje:
          'El prólogo declara ISO-8859-1 y los bytes se decodifican como UTF-8: mandan ' +
          'los bytes y el fichero se ha leído como UTF-8.',
      },
    ],
    bloqueos: [],
    puedeContinuar: true,
    motivoNoContinua: null,
    ...cambios,
  }
}

/** La parcela del modelo (POJO plano), con `srs` como lo pasará el cableado. */
function parcelaDe(cambios = {}) {
  return {
    idLocal: 'parcela-1',
    refcat: REF,
    srs: 'EPSG:25830',
    recintos: editada(),
    geometriaOficial: oficial(),
    superficieRegistral: null,
    superficieCatastral: DECLARADA,
    origen: 'GML_EXISTENTE',
    ...cambios,
  }
}

/** El diagnóstico REAL: `diagnosticar()` sobre los fixtures, no un objeto a mano. */
function diagnosticoDe(cambios = {}) {
  return diagnosticar({
    recintos: editada(),
    geometriaOficial: oficial(),
    superficieCatastral: DECLARADA,
    superficieRegistral: null,
    vecinas: VECINAS,
    refcat: REF,
    ...cambios,
  })
}

/** El informe del caso completo, con todo real. */
function informe(entrada = {}) {
  return informeContrasteTexto({
    comprobacion: comprobacionDe(),
    diagnostico: diagnosticoDe(),
    parcela: parcelaDe(),
    fecha: FECHA,
    ...entrada,
  })
}

// ── Utilidades de lectura del informe ───────────────────────────────────────

/** Las líneas que abren una SECCIÓN (`1. IDENTIFICACIÓN`), con su número. */
const seccionesDe = (texto) =>
  texto
    .split('\n')
    .map((l) => /^(\d+)\. (.+)$/.exec(l))
    .filter((m) => m !== null)
    .map((m) => ({ n: Number(m[1]), titulo: m[2] }))

/** Las líneas que abren un APARTADO (`  3.7 Desviación…`), con su número. */
const apartadosDe = (texto) =>
  texto
    .split('\n')
    .map((l) => /^ {2}(\d+)\.(\d+) (.+)$/.exec(l))
    .filter((m) => m !== null)
    .map((m) => ({ seccion: Number(m[1]), n: Number(m[2]), titulo: m[3] }))

/**
 * Parte el informe en bloques por apartado. Lo usa el guardián de la regla 9
 * para poder excluir la sección de invasión, que es la ÚNICA excepción que la
 * spec admite (hecho topológico binario con consecuencia fija).
 */
function bloquesDe(texto) {
  const bloques = []
  let actual = { titulo: '(cabecera)', lineas: [] }
  for (const linea of texto.split('\n')) {
    const m = /^ {2}\d+\.\d+ (.+)$/.exec(linea)
    if (m !== null) {
      bloques.push(actual)
      actual = { titulo: m[1], lineas: [] }
    }
    actual.lineas.push(linea)
  }
  bloques.push(actual)
  return bloques
}

/** El texto de un apartado por su título. */
const apartado = (texto, titulo) =>
  bloquesDe(texto)
    .filter((b) => b.titulo === titulo)
    .map((b) => b.lineas.join('\n'))
    .join('\n')

/** El informe SIN el apartado de invasión. */
const sinInvasion = (texto) =>
  bloquesDe(texto)
    .filter((b) => b.titulo !== 'Invasión a colindantes')
    .map((b) => b.lineas.join('\n'))
    .join('\n')

/** La línea que empieza (tras la sangría) por `inicio`. */
const lineaQueEmpiezaPor = (texto, inicio) =>
  texto.split('\n').find((l) => l.trimStart().startsWith(inicio)) ?? ''

/**
 * El VALOR de un campo `Rótulo ..... valor`, reunido a partir de sus líneas de
 * cuelgue. Hace falta porque el informe envuelve a 78 columnas: buscar la frase
 * entera en una sola línea fallaría por donde el texto se parte, que es un detalle
 * tipográfico y no una afirmación sobre el contenido.
 */
function campoDe(texto, rotulo) {
  const lineas = texto.split('\n')
  const i = lineas.findIndex((l) => l.trimStart().startsWith(`${rotulo} `))
  if (i === -1) return ''
  const m = /^(.*?\.{2,}\s)(.*)$/.exec(lineas[i])
  if (m === null) return lineas[i].trim()
  const columna = m[1].length
  const partes = [m[2]]
  for (let k = i + 1; k < lineas.length; k++) {
    const l = lineas[k]
    if (l.length <= columna || l.slice(0, columna).trim() !== '') break
    partes.push(l.slice(columna))
  }
  return partes.join(' ')
}

/** El texto con los saltos de línea colapsados: para buscar frases envueltas. */
const enUnaLinea = (texto) => texto.replace(/\s+/g, ' ')

/** Las TRES filas de la tabla a tres bandas (no el párrafo que las explica). */
const filasDeBandas = (texto) =>
  apartado(texto, 'Comparación a tres bandas')
    .split('\n')
    .filter((l) => /^ {4}(Medición|Catastro) - (Catastro|Registro) {2,}/.test(l))
    .map((l) => l.trim())

// ═════════════════════════════════════════════════════════════════════════════
// 1 · El informe completo sobre la parcela REAL
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · el informe completo sobre la parcela real', () => {
  const texto = informe()

  it('lleva el nombre LEGAL, y no el que haría creer que ya se ha presentado', () => {
    // §Nombre de `spec/feature-09-informe-parcela.md`: VGA/IVG son procedimiento y
    // documento oficiales del Catastro, con CSV. Un nombre casi homónimo en la
    // cabecera hace creer al cliente que su expediente ya está en la Sede.
    expect(texto.split('\n')[1]).toBe('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    // La expresión prohibida solo puede aparecer para NEGARLA, nunca como título.
    for (const linea of texto.split('\n')) {
      expect(
        /^\s*informe de validación gráfica/i.test(linea),
        `una línea titula el documento como IVG: ${JSON.stringify(linea)}`,
      ).toBe(false)
    }
  })

  it('dice que es PROVISIONAL, que no lleva pie de firma y que el documento es F09', () => {
    expect(texto).toContain('VERSIÓN PROVISIONAL EN TEXTO, SIN PIE DE FIRMA')
    expect(texto).toContain('F09')
    expect(texto).toContain('NO LLEVA PIE DE FIRMA')
    // Y lo dice DOS veces: arriba, antes de que se lea una sola cifra, y abajo, en
    // el sitio donde alguien iría a buscar la firma que no está.
    expect(texto.split('SIN PIE DE FIRMA').length - 1).toBeGreaterThanOrEqual(1)
    expect(texto).toContain('validación gráfica alternativa (VGA)')
  })

  it('identifica el expediente: fecha inyectada, referencia, SRS y las DOS procedencias', () => {
    expect(texto).toContain('30/07/2026 09:05 (UTC)')
    expect(texto).toContain(REF)
    expect(texto).toContain('EPSG:25830')
    // La procedencia es doble y se dice: la geometría es del usuario y el
    // parcelario es del Catastro. Un renglón que dijera «del Catastro» a secas
    // convertiría el fichero de un tercero en un dato oficial.
    expect(campoDe(texto, 'Procedencia de la geometría')).toBe(
      'Fichero GML aportado por el usuario',
    )
    expect(campoDe(texto, 'Procedencia del parcelario')).toBe(
      'Contorno oficial descargado del Catastro, conservado intacto',
    )
    expect(texto).toContain('cp_parcela_9398516VK3799G.gml')
  })

  it('cuenta qué se leyó del fichero: dialecto, codificaciones y la nota con su severidad', () => {
    expect(texto).toContain('QUÉ SE LEYÓ DEL FICHERO')
    expect(texto).toContain('Parcela catastral INSPIRE CP 4.0')
    expect(lineaQueEmpiezaPor(texto, 'Codificación declarada')).toContain('ISO-8859-1')
    expect(lineaQueEmpiezaPor(texto, 'Codificación empleada')).toContain('utf-8')
    // La severidad va DELANTE del mensaje: una nota sin severidad se lee con el
    // tono de quien la lee, no con el de quien la escribió.
    expect(texto).toContain('[AVISO]')
    expect(texto).toContain('mandan los bytes')
    expect(texto).toContain('(ENCODING_DESMENTIDO)')
  })

  it('separa las DOS superficies del FICHERO de las DOS del parcelario (C1 vs F07)', () => {
    // La del fichero: `areaValue` declarado y shoelace sobre SUS coordenadas.
    expect(enUnaLinea(texto)).toContain('Superficie que declara el fichero: 1.536 m²')
    expect(enUnaLinea(texto)).toContain('medida sobre sus propias coordenadas: 1.538,99 m²')
    // Las del parcelario: declarada por el Catastro y medida sobre el contorno
    // oficial. Confundir las cuatro sería atribuir al Catastro un número de un
    // tercero, o atribuirle a él una medición nuestra.
    expect(lineaQueEmpiezaPor(texto, 'Declarada por el Catastro (cp:areaValue)')).toContain(
      '1.536 m²',
    )
    expect(
      lineaQueEmpiezaPor(texto, 'Medida sobre el contorno oficial del Catastro'),
    ).toContain('1.535,87 m²')
    expect(lineaQueEmpiezaPor(texto, 'Medida sobre la geometría de la parcela')).toContain(
      '1.538,99 m²',
    )
  })

  it('rotula las ONCE secciones de diagnosticar(), en orden y sin saltos', () => {
    const enContraste = apartadosDe(texto).filter((a) => a.titulo !== undefined)
    const delContraste = enContraste.filter((a) => a.seccion === 3)
    expect(delContraste.map((a) => a.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(delContraste.map((a) => a.titulo)).toEqual([
      'Superficies',
      'Perímetros',
      'Comparación a tres bandas',
      'Solape con el contorno oficial',
      'Diferencia con el contorno oficial',
      'Desplazamiento de centroides',
      'Desviación de lindero, lado a lado',
      'Invasión a colindantes',
      'Margen oficial de identidad',
      'Lo que no se ha podido medir',
      'Recintos que no se han podido medir',
    ])
  })

  it('saca los TRES pares de la tabla a tres bandas, en el orden fijo del modelo', () => {
    const filas = filasDeBandas(texto)
    expect(filas).toHaveLength(3)
    expect(filas[0].startsWith('Medición - Catastro')).toBe(true)
    expect(filas[1].startsWith('Medición - Registro')).toBe(true)
    expect(filas[2].startsWith('Catastro - Registro')).toBe(true)
    // El signo es información: +2,99 m² dice que se ha medido MÁS que el Catastro.
    expect(filas[0]).toContain('+2,99 m²')
  })

  it('mide el encaje: solape, diferencia, centroides y desviación con el lado señalado', () => {
    expect(apartado(texto, 'Solape con el contorno oficial')).toContain('1.535,87 m²')
    expect(apartado(texto, 'Solape con el contorno oficial')).toContain('99,80 %')
    expect(apartado(texto, 'Diferencia con el contorno oficial')).toContain('3,12 m²')
    expect(apartado(texto, 'Desplazamiento de centroides')).toContain('Distancia entre ambos')

    const desviacion = apartado(texto, 'Desviación de lindero, lado a lado')
    expect(desviacion).toContain('0,40 m')
    // El lado SEÑALADO: sin culpable no hay nada que resaltar ni que corregir.
    expect(desviacion).toContain('lado 1 del exterior')
    expect(desviacion).toContain('<-- máxima')
    // Y los quince lados, uno a uno.
    const filas = desviacion.split('\n').filter((l) => /^\s+Exterior, lado \d+\s/.test(l))
    expect(filas).toHaveLength(15)
  })

  it('lista las invasiones REALES a las tres colindantes, con su referencia', () => {
    const bloque = apartado(texto, 'Invasión a colindantes')
    expect(bloque).toContain('Se ha consultado')
    for (const ref of ['9398501VK3799G', '9398518VK3799G', '9398515VK3799G']) {
      expect(bloque).toContain(ref)
    }
  })

  it('ENUNCIA el margen del BOE con su etiqueta y dice que no lo compara', () => {
    const bloque = apartado(texto, 'Margen oficial de identidad')
    expect(bloque).toContain('Margen de identidad del Catastro')
    expect(bloque).toContain('±0,50 m de perímetro')
    expect(bloque).toContain('5,00 % de superficie')
    expect(bloque).toContain('BOE-A-2020-12111')
    expect(enUnaLinea(bloque)).toContain('no lo enfrenta a las cifras de arriba')
    // La clase es una PROPUESTA de la aplicación mientras nadie elija, y se dice.
    expect(campoDe(bloque, 'Clase de suelo')).toBe(
      'URBANA (propuesta por la aplicación, no elegida por una persona)',
    )
  })

  it('relaciona los quince vértices con sus coordenadas del fixture', () => {
    const seccion = texto.slice(texto.indexOf('4. RELACIÓN DE VÉRTICES'))
    expect(seccion).toContain('Exterior — 15 vértices')
    // Anillos ABIERTOS: se dice, porque el último vértice no repite el primero y
    // quien cuente quince en vez de dieciséis tiene que saber por qué.
    expect(seccion).toContain('ABIERTOS')
    const filas = seccion.split('\n').filter((l) => /^\s+\d+\s+4392\d\d,\d\d\s+44796\d\d,\d\d$/.test(l))
    expect(filas).toHaveLength(15)
    // El primer vértice es el MOVIDO (439283,23 + 0,40).
    expect(filas[0].trim()).toBe('1  439283,63  4479671,27')
  })

  it('escribe los números en español y ninguno con punto decimal', () => {
    expect(texto).toContain('1.535,87 m²')
    expect(texto).not.toContain('1535.87')
    expect(texto).not.toContain('1538.99')
    // Ni un decimal con punto en el CUERPO del documento. Se saltan los rótulos de
    // apartado (`  3.10 …`), que son numeración y no una medida, y se exige que el
    // dígito-punto-dígito no tenga letras ni guiones pegados para no confundirse
    // con `BOE-A-2020-12111` ni con el nombre del fichero.
    const decimalesIngleses = texto
      .split('\n')
      .filter((l) => !/^ {2}\d+\.\d+ /.test(l))
      .flatMap((l) => l.match(/(?<![\w.-])\d+\.\d{2}(?![\w.-])/g) ?? [])
    expect(decimalesIngleses, `decimales con punto: ${decimalesIngleses.join(', ')}`).toEqual([])
  })

  it('cabe en 78 columnas: es texto para monoespaciada, no Markdown', () => {
    const largas = texto.split('\n').filter((l) => l.length > 78)
    expect(largas, `líneas que se salen: ${largas.join(' | ')}`).toEqual([])
    // Y sin tablas de tuberías, que se rompen en cuanto una celda no cabe.
    expect(texto).not.toContain('|')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · «No se ha consultado» NO es «ninguna»
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · invasión no consultada', () => {
  // `vecinas: null` = NO SE HA CONSULTADO (≠ `[]`, que es «se consultó y no hay»).
  const texto = informe({ diagnostico: diagnosticoDe({ vecinas: null }) })
  const bloque = apartado(texto, 'Invasión a colindantes')

  it('dice «no se ha consultado», con todas las letras', () => {
    expect(bloque.toLowerCase()).toContain('no se ha consultado')
    expect(bloque).toContain('hay que traer del Catastro las parcelas')
  })

  it('NO dice «ninguna»: es la afirmación opuesta, y es la que tranquiliza', () => {
    // El error silencioso más caro que este informe podría cometer, porque acaba
    // firmado: «no se ha mirado» presentado como «se ha mirado y no hay nada».
    expect(/ningun[ao]/i.test(bloque), `el bloque dice: ${bloque}`).toBe(false)
    expect(/no hay invasi/i.test(bloque)).toBe(false)
  })

  it('el detector NO es vacuo: con `vecinas: []` sí sale «ninguna»', () => {
    // `[]` = se consultó y no hay. Ahí «ninguna» es la palabra correcta, y que
    // aparezca prueba que la aserción de arriba distingue algo.
    const consultado = apartado(
      informe({ diagnostico: diagnosticoDe({ vecinas: [] }) }),
      'Invasión a colindantes',
    )
    expect(/ningun[ao]/i.test(consultado)).toBe(true)
    expect(consultado).toContain('Se han consultado las parcelas colindantes')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · `null` es «No consta», y nunca 0
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · superficie registral ausente', () => {
  const texto = informe()

  it('escribe «No consta» en las TRES posiciones donde entra la registral', () => {
    const fila = lineaQueEmpiezaPor(texto, 'Registral, de la escritura')
    expect(fila).toContain('No consta')

    const [, medicionRegistro, catastroRegistro] = filasDeBandas(texto)
    // Cada cruce lleva DOS celdas —absoluto y relativo— y las dos son «No consta»:
    // `bandas.js` devuelve `{absoluto: null, relativo: null}` cuando falta un
    // término, porque «no hay con qué comparar» no es «no hay discrepancia».
    expect(medicionRegistro.match(/No consta/g)).toHaveLength(2)
    expect(catastroRegistro.match(/No consta/g)).toHaveLength(2)
  })

  it('NO escribe 0 donde el dato falta: un 0 diría que la escritura declara cero', () => {
    const fila = lineaQueEmpiezaPor(texto, 'Registral, de la escritura')
    expect(fila).not.toContain('0,00 m²')
    const [, medicionRegistro, catastroRegistro] = filasDeBandas(texto)
    expect(medicionRegistro).not.toContain('0,00')
    expect(catastroRegistro).not.toContain('0,00')
    // Ni un «+0,00 %» disfrazado de cociente calculado.
    expect(catastroRegistro).not.toContain('%')
  })

  it('el detector NO es vacuo: con la registral tecleada salen las tres cifras', () => {
    const conRegistral = informe({
      diagnostico: diagnosticoDe({ superficieRegistral: REGISTRAL }),
      parcela: parcelaDe({ superficieRegistral: REGISTRAL }),
    })
    expect(lineaQueEmpiezaPor(conRegistral, 'Registral, de la escritura')).toContain('1.500,00 m²')
    const filas = filasDeBandas(conRegistral)
    expect(filas[1]).toContain('+38,99 m²')
    expect(filas[2]).toContain('+36,00 m²')
    expect(filas.join('\n')).not.toContain('No consta')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Las secciones a `null` salen con su MOTIVO, en su sitio
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · secciones sin medir', () => {
  // Sin geometría oficial se caen cuatro secciones a la vez, cada una con su
  // entrada en `omisiones`. Es el caso de un DXF, un TXT o un GML del que todavía
  // no se ha traído el parcelario.
  const d = diagnosticoDe({ geometriaOficial: null, vecinas: null, refcat: null })
  const texto = informeContrasteTexto({
    comprobacion: comprobacionDe(),
    diagnostico: d,
    parcela: parcelaDe({ geometriaOficial: null }),
    fecha: FECHA,
  })

  it('imprime el MOTIVO en el sitio de la cifra que falta, no en una nota al pie', () => {
    // El motivo lo redacta `diagnostico/parcela.js` en español y se imprime tal
    // cual: la vista no mantiene su propia tabla de traducciones, que es lo que se
    // queda corto en silencio cuando el modelo añade un caso.
    for (const titulo of [
      'Solape con el contorno oficial',
      'Diferencia con el contorno oficial',
      'Desplazamiento de centroides',
      'Desviación de lindero, lado a lado',
    ]) {
      expect(enUnaLinea(apartado(texto, titulo)), `apartado «${titulo}»`).toContain(
        'todavía no se ha traído la parcela del Catastro',
      )
    }
    // El margen tiene su propio motivo, distinto: sin clase de suelo no hay margen
    // que enunciar, y elegir uno en silencio sería inventarse media norma.
    expect(enUnaLinea(apartado(texto, 'Margen oficial de identidad'))).toContain(
      'si la parcela es urbana o rústica',
    )
  })

  it('recuenta las cinco omisiones por su nombre, sin repetir el motivo', () => {
    const bloque = apartado(texto, 'Lo que no se ha podido medir')
    expect(bloque).toContain('Solape con el contorno oficial')
    expect(bloque).toContain('Diferencia con el contorno oficial')
    expect(bloque).toContain('Desplazamiento de centroides')
    expect(bloque).toContain('Desviación de lindero')
    expect(bloque).toContain('Margen oficial de identidad')
    expect(enUnaLinea(bloque)).toContain('El motivo de cada una va escrito')
    // Las cinco de `OMISION`, ni una menos.
    expect(d.omisiones).toHaveLength(5)
  })

  it('la procedencia del parcelario dice que NO se ha traído', () => {
    expect(campoDe(texto, 'Procedencia del parcelario')).toBe(
      'No se ha traído el contorno oficial del Catastro',
    )
  })

  it('el vocabulario de omisiones no ha divergido de `diagnostico/parcela.js#OMISION`', () => {
    // El espejo declarado en la cabecera de `report/contraste-texto.js`: se copia el
    // vocabulario para no arrastrar Turf al grafo de un formateador de texto, y lo
    // que impide que las dos listas se separen es ESTE test, no la disciplina.
    expect(OMISION_CONOCIDA).toEqual(OMISION)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 bis · El fichero del que no se puede seguir (dialecto no soportado)
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · fichero sin parcela que contrastar', () => {
  // El caso del GML de EDIFICIO: se lee, se dice qué es, y el camino se acaba con
  // honradez. Es la mitad del criterio 4 de F08 que hoy se puede comprobar.
  const texto = informeContrasteTexto({
    comprobacion: comprobacionDe({
      dialecto: {
        id: 'BU',
        soportado: false,
        etiqueta: 'GML de edificio (construcción)',
        queSignifica:
          'No es un fichero equivocado: habla de la CONSTRUCCIÓN, no del lindero de la parcela.',
      },
      miembros: [],
      elegido: null,
      geometria: null,
      hallazgos: null,
      bloqueos: [
        {
          tipo: 'DIALECTO_OTRO_TEMA',
          severidad: 'ERROR',
          mensaje: 'Esto es un GML de EDIFICIO, no de parcela.',
        },
      ],
      puedeContinuar: false,
      motivoNoContinua:
        'Este GML describe una CONSTRUCCIÓN, no una parcela: no hay lindero que contrastar.',
    }),
    diagnostico: diagnosticar({ recintos: [], geometriaOficial: null, vecinas: null }),
    parcela: null,
    fecha: FECHA,
  })

  it('el «no soporta» es CAPACIDAD de la aplicación y no arrastra consecuencias', () => {
    // La frase no puede prometer que se enseñará la parcela: un 3.0 no soportado sí
    // la enseña y uno de edificio no. Lo que pasa en cada caso lo cuenta el
    // `queSignifica` que llega redactado desde la comprobación.
    expect(campoDe(texto, 'Soporte de la aplicación')).toBe(
      'La aplicación no soporta este dialecto.',
    )
    expect(enUnaLinea(texto)).toContain('habla de la CONSTRUCCIÓN, no del lindero')
  })

  it('escribe el motivo de que el camino se acabe, y nunca lo deja en blanco', () => {
    expect(campoDe(texto, 'Continuación')).toBe(
      'La aplicación no puede contrastar esta parcela: Este GML describe una ' +
        'CONSTRUCCIÓN, no una parcela: no hay lindero que contrastar.',
    )
    expect(texto).toContain('[ERROR]')
    expect(texto).toContain('El fichero no trae parcelas legibles.')
  })

  it('sin geometría, la relación de vértices lo dice en vez de salir vacía', () => {
    expect(texto).toContain('No consta la geometría de la parcela.')
    // Y el informe sigue siendo un informe: cabecera, provisionalidad y pie.
    expect(texto).toContain('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    expect(texto).toContain('NO LLEVA PIE DE FIRMA')
  })

  it('un hallazgo de F02 sale con SUS vértices y con el verbo de la corrección', () => {
    // `validation/` no nombra los vértices en el mensaje: los manda en
    // `verticesAfectados` para que el visor los resalte. En un informe de texto no
    // hay nada que resaltar, así que si esa lista no se imprime el lector se queda
    // sin saber DÓNDE está el problema — y sin poder ir a corregirlo.
    const conHallazgos = informe({
      comprobacion: comprobacionDe({
        hallazgos: [
          {
            nivel: 'ERROR',
            mensaje: 'Vértices consecutivos duplicados (distancia < 1 mm).',
            verticesAfectados: [
              { recinto: 0, indice: 2 },
              { recinto: 0, indice: 3 },
              { recinto: 1, indice: 0 },
            ],
            correccion: 'Eliminar vértice duplicado',
          },
        ],
      }),
    })
    const linea = enUnaLinea(conHallazgos)
    expect(linea).toContain('Vértices consecutivos duplicados (distancia < 1 mm).')
    // 1-based, que es como se numeran los vértices para el humano en toda la app.
    expect(linea).toContain('exterior, vértices 3, 4')
    expect(linea).toContain('hueco 1, vértice 1')
    expect(linea).toContain('Eliminar vértice duplicado')
  })

  it('no vuelca quinientos números en una línea, pero dice cuántos hay', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({ recinto: 0, indice: i }))
    const texto30 = informe({
      comprobacion: comprobacionDe({
        hallazgos: [{ nivel: 'AVISO', mensaje: 'Vértices casi colineales.', verticesAfectados: muchos }],
      }),
    })
    const linea = enUnaLinea(texto30)
    expect(linea).toContain('vértices 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 y 18 más')
    // Y sigue cabiendo en el papel.
    expect(texto30.split('\n').filter((l) => l.length > 78)).toEqual([])
  })

  it('`hallazgos: null` es «no se ha revisado», que no es «no hay hallazgos»', () => {
    // Tercer sabor de «no hay», en la capa de la comprobación: `null` (no se validó
    // porque no había geometría) frente a `[]` (se validó y no hay nada que decir).
    expect(texto).toContain('No se ha revisado la geometría.')
    expect(informe()).toContain('Sin hallazgos que reseñar.')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Guardián de la regla de oro 9 — y su mitad anti-vacuidad
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Vocabulario de VEREDICTO. Ninguna de estas palabras puede salir del informe:
 * «la aplicación mide; el colegiado interpreta y firma» (SPEC §2, regla 9).
 *
 * No incluye «validación», y es deliberado: el informe nombra la «validación
 * gráfica alternativa (VGA)» y el «informe de validación gráfica (IVG)»
 * precisamente para NEGAR que él lo sea. Son los nombres de un procedimiento y un
 * documento oficiales del Catastro, no un juicio sobre la parcela.
 */
const VEREDICTO = Object.freeze([
  /\bválid[oa]s?\b/i,
  /\binválid[oa]s?\b/i,
  /\bcorrect[oa]s?\b/i,
  /\bincorrect[oa]s?\b/i,
  /\bapt[oa]s?\b/i,
  /\bcumple[n]?\b/i,
  /\bincumple[n]?\b/i,
  /\bconforme[s]?\b/i,
  /\btoleranci[ao]s?\b/i,
  /\bsemáforos?\b/i,
  /\bumbral(es)?\b/i,
  /\baprobad[oa]s?\b/i,
  /\bsuspens[oa]s?\b/i,
  /\bacept(able|ables|ado|ada)\b/i,
])

/** Las palabras de veredicto que aparecen en un texto, con la regex que las cazó. */
const veredictosEn = (texto) =>
  VEREDICTO.flatMap((re) => {
    const m = re.exec(texto)
    return m === null ? [] : [`${m[0]} (${re})`]
  })

describe('report/contraste-texto · guardián de la regla de oro 9', () => {
  const texto = informe()

  it('no hay una sola palabra de veredicto fuera de la sección de invasión', () => {
    const fuera = veredictosEn(sinInvasion(texto))
    expect(
      fuera,
      'la aplicación mide y el colegiado firma: ninguna cifra puede llevar juicio de valor',
    ).toEqual([])
  })

  it('hoy tampoco la hay DENTRO de la de invasión, que es la única excepción admitida', () => {
    // La invasión a colindante es el único caso donde la spec permite ámbar (hecho
    // topológico binario con consecuencia fija). Aun así este informe la escribe
    // como superficie y referencia catastral, sin adjetivos: la excepción está
    // disponible y no se está usando. Se afirma para que, si algún día se usa,
    // sea una decisión y no un descuido.
    expect(veredictosEn(apartado(texto, 'Invasión a colindantes'))).toEqual([])
  })

  it('tampoco enfrenta el margen del BOE con ninguna medida', () => {
    const bloque = apartado(texto, 'Margen oficial de identidad')
    expect(bloque).toContain('ENUNCIA')
    for (const prohibido of [
      /dentro de/i,
      /por debajo de/i,
      /supera/i,
      /excede/i,
      /se ajusta/i,
    ]) {
      expect(prohibido.test(bloque), `el margen se está comparando: ${prohibido}`).toBe(false)
    }
  })

  it('el guardián DISPARA si alguien mete una palabra de veredicto', () => {
    // La mitad anti-vacuidad: un guardián que nunca puede fallar no protege nada.
    expect(veredictosEn(`${texto}\n  La geometría es correcta.`)).not.toEqual([])
    expect(veredictosEn('la parcela es válida')).not.toEqual([])
    expect(veredictosEn('la superficie está dentro de la tolerancia admitida')).not.toEqual([])
    // Y cada regex de la lista caza algo: una entrada muerta es una entrada que
    // deja de vigilar sin que nadie se entere.
    const cebos = [
      'válido',
      'inválido',
      'correcto',
      'incorrecto',
      'apto',
      'cumple',
      'incumple',
      'conforme',
      'tolerancia',
      'semáforo',
      'umbral',
      'aprobado',
      'suspenso',
      'aceptable',
    ]
    for (const re of VEREDICTO) {
      expect(
        cebos.some((c) => re.test(c)),
        `la regex ${re} no caza ninguno de los cebos: está muerta`,
      ).toBe(true)
    }
  })

  it('los mensajes de OTRAS capas se copian tal cual, y eso no es una infracción', () => {
    // ⚠️ HECHO MEDIDO (2026-07-30, sobre el recorrido real de F08): el guardián de
    // arriba NO se puede aplicar al texto entero de un informe de producción, y
    // conviene que T6.1 lo sepa antes de escribir el suyo. Dos ejemplos reales, los
    // dos legítimos:
    //   · `gml/decodificar.js`, en `ENCODING_DESMENTIDO`, dice «…una sola secuencia
    //     inválida, cosa que no pasa por casualidad» y «El texto es correcto; lo
    //     que está mal es la etiqueta». Habla de BYTES, no del encaje de la parcela.
    //   · `validation/parcela.js` emite «El primer recinto no es un contorno
    //     EXTERIOR válido.»: un hecho ESTRUCTURAL sobre un anillo roto.
    // Reescribirlos aquí crearía una segunda redacción que puede divergir de la del
    // módulo que la sabe (regla de oro 1), así que se imprimen literales. El
    // guardián vigila el vocabulario que ESTE módulo escribe; el de las demás capas
    // se vigila en su capa.
    const ajeno = 'El primer recinto no es un contorno EXTERIOR válido.'
    const conHallazgo = informe({
      comprobacion: comprobacionDe({ hallazgos: [{ nivel: 'ERROR', mensaje: ajeno }] }),
    })
    expect(conHallazgo).toContain(ajeno)
    expect(conHallazgo).toContain('[ERROR]')
    // Y en cuanto se quita ese pasaje ajeno, el informe vuelve a estar limpio: la
    // frase de veredicto venía del mensaje, no de la plantilla.
    expect(veredictosEn(sinInvasion(conHallazgo.replace(ajeno, '(mensaje ajeno)')))).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Guardián del reloj
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · no lee el reloj del sistema', () => {
  // Mismo guardián, con las mismas palabras, que `gml/` (ver
  // `test/gml/contrato-gml.test.js`). El motivo es el mismo: un informe descargado
  // es un SNAPSHOT y tiene que valer lo mismo dentro de un año; si el módulo
  // consultara la marca de tiempo, el snapshot del final de este fichero cambiaría
  // en cada ejecución y dejaría de afirmar nada. Se mira el TEXTO ENTERO del
  // fuente, comentarios incluidos.
  const INSTANCIA_FECHA = /\bnew\s+Date\b/
  const RELOJ = /\bDate\s*\.\s*now\b/
  const FORMATO_LOCAL = /toLocale(Date|Time)?String\b/

  it('no instancia una fecha propia ni consulta la marca de tiempo', () => {
    expect(INSTANCIA_FECHA.test(FUENTE_MODULO), 'instancia una fecha propia').toBe(false)
    expect(RELOJ.test(FUENTE_MODULO), 'consulta el reloj del sistema').toBe(false)
  })

  it('no usa formateadores de fecha dependientes del entorno', () => {
    // `toLocaleDateString` no lee el reloj, pero su salida depende del ICU de la
    // máquina: el mismo instante daría un texto distinto en CI y en el equipo de
    // quien firma. La fecha se rinde por componentes UTC.
    expect(FORMATO_LOCAL.test(FUENTE_MODULO)).toBe(false)
    expect(FUENTE_MODULO).toContain('getUTCFullYear')
  })

  it('los detectores no son vacuos', () => {
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date . now()')).toBe(true)
    expect(FORMATO_LOCAL.test('f.toLocaleDateString("es-ES")')).toBe(true)
    // Y no confunden una comprobación de tipo con una lectura del reloj.
    expect(INSTANCIA_FECHA.test('if (fecha instanceof Date) return')).toBe(false)
  })

  it('el mismo instante produce el mismo texto, dos veces seguidas', () => {
    expect(informe()).toBe(informe())
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · La parcela que llegó por referencia catastral (`comprobacion: null`)
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · sin fichero de origen', () => {
  const texto = informeContrasteTexto({
    comprobacion: null,
    diagnostico: diagnosticoDe(),
    parcela: parcelaDe({ origen: 'WFS' }),
    fecha: FECHA,
  })

  it('no emite la sección del fichero: no hubo fichero que leer', () => {
    expect(texto).not.toContain('QUÉ SE LEYÓ DEL FICHERO')
    expect(texto).not.toContain('Codificación declarada')
    expect(texto).not.toContain('Parcelas que trae el fichero')
  })

  it('renumera sin dejar hueco: las secciones van 1, 2, 3, 4', () => {
    // Un salto en la numeración se lee como «falta una página». Con fichero son
    // cinco secciones; sin él, cuatro, y las cuatro correlativas.
    expect(seccionesDe(texto).map((s) => s.n)).toEqual([1, 2, 3, 4])
    expect(seccionesDe(texto).map((s) => s.titulo)).toEqual([
      'IDENTIFICACIÓN',
      'CONTRASTE CON EL PARCELARIO',
      'RELACIÓN DE VÉRTICES',
      'NOTA FINAL',
    ])
    expect(seccionesDe(informe()).map((s) => s.n)).toEqual([1, 2, 3, 4, 5])
    // Y los apartados del contraste cuelgan de la sección que toque, no de la 3.
    expect(apartadosDe(texto).every((a) => a.seccion === 2)).toBe(true)
  })

  it('dice, en el sitio del fichero, que la parcela no vino de uno', () => {
    expect(campoDe(texto, 'Fichero de origen')).toBe(
      'La parcela no se ha cargado de un fichero GML.',
    )
    expect(campoDe(texto, 'Procedencia de la geometría')).toBe(
      'Descarga del Catastro (servicio WFS)',
    )
  })

  it('conserva entero el contraste, los vértices y el pie', () => {
    expect(texto).toContain('CONTRASTE CON EL PARCELARIO')
    expect(apartadosDe(texto).filter((a) => a.seccion === 2)).toHaveLength(11)
    expect(texto).toContain('Exterior — 15 vértices')
    expect(texto).toContain('NO LLEVA PIE DE FIRMA')
    expect(veredictosEn(sinInvasion(texto))).toEqual([])
  })

  it('los vértices salen de `comprobacion.geometria` si no hay parcela en el store', () => {
    // Caso del cableado de F08 antes del `estado.set`: hay comprobación y todavía
    // no hay modelo. El informe se emite igual y no se queda sin vértices.
    const sinModelo = informeContrasteTexto({
      comprobacion: comprobacionDe(),
      diagnostico: diagnosticoDe(),
      parcela: null,
      fecha: FECHA,
    })
    expect(sinModelo).toContain('Exterior — 15 vértices')
    expect(sinModelo).toContain('439283,63')
    // Y el SRS se resuelve desde la comprobación, no se deja en blanco.
    expect(sinModelo).toContain('Coordenadas en EPSG:25830')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Contrato del programador
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · contrato', () => {
  const base = { comprobacion: null, diagnostico: diagnosticoDe(), parcela: null, fecha: FECHA }

  it('exige un objeto de entrada', () => {
    expect(() => informeContrasteTexto()).toThrow(TypeError)
    expect(() => informeContrasteTexto(null)).toThrow(TypeError)
    expect(() => informeContrasteTexto([])).toThrow(TypeError)
  })

  it('exige el diagnóstico: sin él no hay informe', () => {
    expect(() => informeContrasteTexto({ ...base, diagnostico: undefined })).toThrow(
      /'diagnostico'/,
    )
    expect(() => informeContrasteTexto({ ...base, diagnostico: null })).toThrow(TypeError)
  })

  it('exige la fecha por PARÁMETRO, y que sea una fecha de verdad', () => {
    expect(() => informeContrasteTexto({ ...base, fecha: undefined })).toThrow(
      /no consulta el reloj/,
    )
    expect(() => informeContrasteTexto({ ...base, fecha: '2026-07-30' })).toThrow(TypeError)
    expect(() => informeContrasteTexto({ ...base, fecha: new Date('vaya') })).toThrow(RangeError)
  })

  it('acepta `comprobacion` y `parcela` a null, y rechaza que sean otra cosa', () => {
    expect(typeof informeContrasteTexto(base)).toBe('string')
    expect(() => informeContrasteTexto({ ...base, comprobacion: 'sí' })).toThrow(/'comprobacion'/)
    expect(() => informeContrasteTexto({ ...base, parcela: 7 })).toThrow(/'parcela'/)
  })

  it('devuelve una cadena, no la descarga: el Blob es de otra capa', () => {
    const texto = informeContrasteTexto(base)
    expect(typeof texto).toBe('string')
    expect(texto.endsWith('\n')).toBe(false)
    expect(texto.length).toBeGreaterThan(2000)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · El SNAPSHOT — la última aserción, nunca la primera
// ═════════════════════════════════════════════════════════════════════════════

describe('report/contraste-texto · snapshot del informe real', () => {
  it('el informe completo de la parcela 9398516VK3799G, letra por letra', async () => {
    // Va a un fichero `.txt` legible y no a un `.snap`: así el diff de una
    // actualización se lee como lo que es —un documento que ha cambiado— y no como
    // una cadena escapada de nueve mil caracteres. Todo lo que este snapshot
    // afirma está afirmado antes por contenido: si alguien lo actualiza con `-u`
    // sin mirar, los describe de arriba siguen defendiendo el documento.
    await expect(informe()).toMatchFileSnapshot('./__snapshots__/informe-contraste-real.txt')
  })
})
