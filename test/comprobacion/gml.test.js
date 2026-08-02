/* -------------------------------------------------------------------------- *
 * test/comprobacion/gml.test.js — F08 · El paso de Comprobación (T2.1)         *
 *                                                                              *
 * `comprobacion/gml.js` es lo primero que ve un fichero que NO ha escrito este  *
 * proyecto, así que casi todo lo que puede ir mal aquí va mal EN VERDE: una     *
 * comprobación que no se ejecuta, una nota que no se emite, un gate que se      *
 * convierte en un veredicto sin que nadie lo note. Por eso este fichero no      *
 * comprueba «que comprobarGml devuelve lo que devuelve»:                        *
 *                                                                              *
 *   · UN CASO POR FICHERO, con nombre en español, sobre los NUEVE `.gml` del    *
 *     repo — cinco reales y cuatro derivados con su `PROCEDENCIA.md`. Cada      *
 *     número que se afirma (15 vértices, 1536 declarados, 1535,865… medidos,    *
 *     huso 29, 3 parcelas) sale de LEER el fichero, no del enunciado.           *
 *   · CADA UNA DE LAS CUATRO COMPROBACIONES QUE F08 AÑADE lleva su prueba de    *
 *     que el hueco existía: se afirma que `parsearGml` NO hace ese cotejo, y    *
 *     que `comprobarGml` sí. Un test de C1 que no demuestre que `parse` no      *
 *     emitía `AREA_DECLARADA_DISCREPANTE` no prueba que C1 sirva para nada.      *
 *   · LOS CASOS QUE NINGÚN FIXTURE CUBRE —autointersección, vértices            *
 *     duplicados, XML roto, colección vacía— se fabrican MUTANDO el texto del   *
 *     GML real, para que sigan siendo ficheros del Catastro con un defecto      *
 *     concreto y no maquetas que podrían no parecerse a nada. Es la misma       *
 *     técnica de `test/gml/parse.test.js`.                                      *
 *   · EL GUARDIÁN DE LA REGLA DE ORO 9 recorre RECURSIVAMENTE el objeto real    *
 *     que se devuelve, no una lista de claves escrita a mano, con               *
 *     `puedeContinuar` nombrada como la ÚNICA excepción y con la prueba de que  *
 *     esa excepción no es decorativa (el patrón prohibido SÍ la caza).          *
 *                                                                              *
 * Proyecto Vitest `node`: POJOs, geometría y texto, sin DOM.                    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { comprobarGml } from '../../comprobacion/gml.js'
import * as comprobacionModulo from '../../comprobacion/gml.js'
import * as comunModulo from '../../comprobacion/_comun.js'
import {
  ETIQUETAS_DIALECTO,
  SEVERIDAD,
  TIPO_COMPROBACION,
  crearDeteccionComprobacion,
  decimalesDe,
  etiquetaDialecto,
  numero,
} from '../../comprobacion/_comun.js'
import { decodificarGml } from '../../gml/decodificar.js'
import { parsearGml } from '../../gml/parse.js'
import { DIALECTO, TIPO_GML } from '../../gml/_comun.js'
import { NIVEL } from '../../validation/_comun.js'
import { reglasHuso } from '../../validation/reglas-huso.js'

// ── Arnés ────────────────────────────────────────────────────────────────────
// `import.meta.dirname`, no `new URL(..., import.meta.url)` (convención del repo).

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR = join(RAIZ, 'test', 'fixtures', 'gml')

const EJEMPLO = 'cp_ejemplo_explicativo.gml'
const WFS = 'cp_parcela_9398516VK3799G.gml'
const TRESCERO = 'UTM_1.gml'
const EDIFICIO = 'bu_building_9398516VK3799G.gml'
const EDIFICIO_PARTES = 'bu_buildingpart_9398516VK3799G.gml'
const MULTI = 'derivados/cp_multiparcela_entrega.gml'
const HUSO_MALO = 'derivados/cp_huso_incoherente.gml'
const SRS_MALO = 'derivados/cp_srs_no_soportado.gml'
const AREA_MALA = 'derivados/cp_area_discrepante.gml'

/** Los nueve, para los invariantes que se afirman sobre TODOS. */
const TODOS = [EJEMPLO, WFS, TRESCERO, EDIFICIO, EDIFICIO_PARTES, MULTI, HUSO_MALO, SRS_MALO, AREA_MALA]

/**
 * Los bytes del fichero. Se decodifican con `gml/decodificar.js`, que es para lo
 * que se hizo: el helper que se fiaba del `encoding` declarado producía mojibake
 * sobre el fixture del WFS, y portarlo aquí habría metido el mismo fallo en la
 * capa que estrena la entrada por fichero.
 */
const bytesDe = (nombre) => readFileSync(join(DIR, nombre))

/** Nombre corto (sin `derivados/`), que es lo que llegaría de un `<input type=file>`. */
const nombreCorto = (nombre) => nombre.split('/').pop()

/** El recorrido completo: bytes → texto → comprobación, tal como lo hará la app. */
function comprobarFixture(nombre, extra = {}) {
  const bytes = bytesDe(nombre)
  const { texto, detecciones, encodingUsado } = decodificarGml(bytes)
  return comprobarGml({
    texto,
    nombreFichero: nombreCorto(nombre),
    bytes: bytes.byteLength,
    deteccionesPrevias: detecciones,
    encodingUsado,
    ...extra,
  })
}

/** El texto ya decodificado de un fixture, para poder MUTARLO. */
const textoDe = (nombre) => decodificarGml(bytesDe(nombre)).texto

/** Comprueba un texto fabricado, sin detecciones previas. */
const comprobarTexto = (texto, nombreFichero = 'fabricado.gml', extra = {}) =>
  comprobarGml({ texto, nombreFichero, ...extra })

/** Todas las detecciones de una comprobación, en una lista. */
const todasLasDetecciones = (c) => [...c.notas, ...c.bloqueos]

/** Las detecciones de un tipo concreto. */
const deTipo = (c, tipo) => todasLasDetecciones(c).filter((d) => d.tipo === tipo)

/** La única detección de un tipo; falla si no hay exactamente una. */
function unica(c, tipo) {
  const encontradas = deTipo(c, tipo)
  expect(encontradas, `se esperaba exactamente una detección «${tipo}»`).toHaveLength(1)
  return encontradas[0]
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · UN CASO POR FICHERO
// ═════════════════════════════════════════════════════════════════════════════

describe('comprobacion/gml.js · un caso por fichero', () => {
  it('la plantilla oficial del Catastro: parcela de ENTREGA, 236 m² declarados y exterior ANTIHORARIO', () => {
    const c = comprobarFixture(EJEMPLO)

    expect(c.fichero.nombre).toBe(EJEMPLO)
    expect(c.fichero.encodingDeclarado).toBe('utf-8')
    expect(c.fichero.encodingUsado).toBe('utf-8')

    expect(c.dialecto.id).toBe(DIALECTO.CP_4_0_ENTREGA)
    expect(c.dialecto.soportado).toBe(true)
    expect(c.dialecto.etiqueta).toMatch(/sobre de entrega/i)
    expect(c.dialecto.queSignifica.length).toBeGreaterThan(40)

    expect(c.miembros).toHaveLength(1)
    const m = c.miembros[0]
    // La plantilla es un ALTA: deja `label` y la referencia catastral VACÍOS a
    // propósito, y lo que identifica a la parcela es el `localId`. `''` (está y
    // viene vacío) y `null` (no está) son cosas distintas y no se confunden.
    expect(m.refcat).toBe('')
    expect(m.localId).toBe('1A')
    expect(m.namespaceInspire).toBe('ES.LOCAL.CP')
    expect(m.etiqueta).toBe('Parcela 1 de 1 · identificador local 1A · 236 m² declarados')
    expect(m.nVertices).toBe(8)
    expect(m.nHuecos).toBe(0)
    expect(m.superficieDeclarada).toBe(236)
    expect(m.superficieMedida).toBeCloseTo(236.0456, 4)
    expect(m.srs).toBe('EPSG:25830')
    // Override O1 matizado: la plantilla OFICIAL va antihoraria, y no está mal.
    expect(m.orientacionExterior).toBe(1)

    expect(c.elegido).toBe(0)
    expect(c.puedeContinuar).toBe(true)
    expect(c.motivoNoContinua).toBeNull()
    expect(c.geometria.srs).toBe('EPSG:25830')
    expect(c.geometria.recintos).toHaveLength(1)
    expect(c.bloqueos).toHaveLength(0)
  })

  it('la descarga real del WFS: 15 vértices en MADRID, 1536 declarados y 1535,865… medidos', () => {
    const c = comprobarFixture(WFS)

    expect(c.dialecto.id).toBe(DIALECTO.CP_4_0_WFS)
    expect(c.dialecto.queSignifica).toMatch(/no se puede presentar en la Sede/i)

    const m = c.miembros[0]
    expect(m.refcat).toBe('9398516VK3799G')
    expect(m.namespaceInspire).toBe('ES.SDGC.CP')
    expect(m.nVertices).toBe(15)
    expect(m.superficieDeclarada).toBe(1536)
    // Float64 completo, sin redondear (regla de oro 11): el redondeo es de salida.
    expect(m.superficieMedida).toBeCloseTo(1535.865149996761, 9)
    // El WFS emite el exterior HORARIO (override O1, medido: área firmada −1536).
    expect(m.orientacionExterior).toBe(-1)
    expect(m.etiqueta).toBe('Parcela 1 de 1 · 9398516VK3799G · 1536 m² declarados')

    expect(c.puedeContinuar).toBe(true)
    expect(c.bloqueos).toHaveLength(0)
    // El fichero MIENTE sobre su encoding y eso llega hasta aquí desde los bytes.
    expect(c.fichero.encodingDeclarado).toBe('ISO-8859-1')
    expect(c.fichero.encodingUsado).toBe('utf-8')
  })

  it('UTM_1.gml, un CP 3.0 de un tercero: la Sede ya no lo admite y aun así el recorrido CONTINÚA', () => {
    const c = comprobarFixture(TRESCERO)

    expect(c.dialecto.id).toBe(DIALECTO.CP_3_0)
    expect(c.dialecto.soportado).toBe(false)
    expect(c.dialecto.queSignifica).toMatch(/volver a generarla en 4\.0/i)

    // `soportado:false` y `parcelas` RELLENA no es una contradicción: es la
    // decisión (2) de `gml/parse.js` («tu GML es de 2015, aquí está tu parcela»).
    expect(c.miembros).toHaveLength(1)
    expect(c.miembros[0].localId).toBe('8703362TF9980S0001SH')
    expect(c.miembros[0].superficieDeclarada).toBe(61)
    expect(c.puedeContinuar).toBe(true)
    expect(c.motivoNoContinua).toBeNull()
    expect(c.geometria).not.toBeNull()

    // Y AQUÍ ESTÁ LA TRAMPA DE NOMBRE DEL CONTRATO, con su caso real: hay un
    // BLOQUEO de nivel ERROR y el recorrido sigue igual. `bloqueos` es la
    // partición por severidad, no lo contrario de `puedeContinuar`.
    expect(c.bloqueos.map((d) => d.tipo)).toContain(TIPO_GML.DIALECTO_RECHAZADO)
    expect(c.bloqueos.every((d) => d.severidad === SEVERIDAD.ERROR)).toBe(true)

    // Alta de particular: no trae referencia catastral, así que no hay parcelario
    // que pedirle al Catastro. No se inventa ninguna.
    expect(c.miembros[0].refcat).toBe('')
    expect(c.miembros[0].namespaceInspire).toBe('ES.LOCAL.CP')
  })

  it('bu_building: un GML de EDIFICIO se detiene con motivo, y no trae ni una parcela', () => {
    const c = comprobarFixture(EDIFICIO)

    expect(c.dialecto.id).toBe(DIALECTO.BU)
    expect(c.dialecto.etiqueta).toMatch(/edificio/i)
    expect(c.miembros).toHaveLength(0)
    expect(c.elegido).toBeNull()
    expect(c.geometria).toBeNull()
    // `null` (no había geometría que validar) y `[]` (se validó y no hay nada que
    // decir) son afirmaciones distintas y no se representan igual.
    expect(c.hallazgos).toBeNull()

    expect(c.puedeContinuar).toBe(false)
    expect(c.motivoNoContinua).toMatch(/CONSTRUCCIÓN/)
    expect(c.motivoNoContinua).toMatch(/no hay lindero que contrastar/i)
    // La mitad comprobable hoy del criterio 4: NO se encamina al contraste de
    // lindero. La otra mitad (encaminarlo a F14) no existe y no se finge.
    expect(c.bloqueos.map((d) => d.tipo)).toContain(TIPO_GML.DIALECTO_OTRO_TEMA)
  })

  it('bu_buildingpart: trece contenedores de edificio, y ninguno de ellos es una parcela', () => {
    const c = comprobarFixture(EDIFICIO_PARTES)

    // El documento tiene 13 `featureMember` (una BuildingPart por volumen de
    // altura homogénea, override O11) y aun así CERO parcelas: no se cuenta lo
    // que hay, se cuenta lo que se ha podido leer como parcela.
    expect(parsearGml(textoDe(EDIFICIO_PARTES)).resumen.nMiembros).toBe(13)
    expect(c.miembros).toHaveLength(0)
    expect(c.puedeContinuar).toBe(false)
    expect(c.motivoNoContinua).toBe(comprobarFixture(EDIFICIO).motivoNoContinua)
  })

  it('el multiparcela de entrega: tres parcelas, y el índice lo manda el llamante', () => {
    const c = comprobarFixture(MULTI)

    expect(c.miembros).toHaveLength(3)
    expect(c.miembros.map((m) => m.localId)).toEqual(['1A', '2B', '3C'])
    expect(c.miembros.map((m) => m.indice)).toEqual([0, 1, 2])
    expect(c.miembros[0].etiqueta).toBe(
      'Parcela 1 de 3 · identificador local 1A · 236 m² declarados',
    )

    // Por defecto, la primera.
    expect(c.elegido).toBe(0)

    // Y el llamante manda: SOLO entra la elegida, nunca la unión de las tres
    // (multiparcela está fuera de alcance, SPEC §1).
    const segunda = comprobarFixture(MULTI, { indiceElegido: 1 })
    expect(segunda.elegido).toBe(1)
    expect(segunda.geometria.recintos).toHaveLength(1)
    expect(segunda.geometria.recintos[0].vertices[0][0]).toBeCloseTo(269248.83, 2)
    expect(c.geometria.recintos[0].vertices[0][0]).toBeCloseTo(269218.83, 2)

    // Y se DICE cuál se ha cogido y qué pasa con las demás.
    const nota = unica(segunda, TIPO_COMPROBACION.PARCELA_ELEGIDA)
    expect(nota.severidad).toBe(SEVERIDAD.INFO)
    expect(nota.mensaje).toMatch(/se está comprobando la 2ª/)
    expect(nota.mensaje).toMatch(/se quedan en el fichero/)
    expect(nota.datos).toEqual({ elegido: 1, total: 3 })
  })

  it('cp_huso_incoherente: declara el huso 29 sobre coordenadas del 30, y los 15 vértices salen fuera', () => {
    const c = comprobarFixture(HUSO_MALO)

    expect(c.miembros[0].srs).toBe('EPSG:25829')
    expect(c.miembros[0].nVertices).toBe(15)

    const nota = unica(c, TIPO_COMPROBACION.HUSO_FUERA_DE_RANGO)
    expect(nota.severidad).toBe(SEVERIDAD.AVISO)
    expect(nota.datos).toEqual({ srs: 'EPSG:25829', huso: 29, nVertices: 15, nFuera: 15 })
    expect(nota.mensaje).toMatch(/Es una nota, no un fallo/)

    // Criterio 2 de la spec: sale como NOTA y el recorrido CONTINÚA.
    expect(c.puedeContinuar).toBe(true)
    expect(c.geometria.srs).toBe('EPSG:25829')
  })

  it('cp_srs_no_soportado: un 4326 con el que la aplicación no puede seguir, y lo dice con todas las letras', () => {
    const c = comprobarFixture(SRS_MALO)

    // La parcela SE LEE —15 vértices, 1536 declarados—; lo que no se acepta es su
    // sistema de referencia.
    expect(c.miembros).toHaveLength(1)
    expect(c.miembros[0].nVertices).toBe(15)
    expect(c.miembros[0].srs).toBeNull()

    expect(c.puedeContinuar).toBe(false)
    expect(c.motivoNoContinua).toMatch(/EPSG:25829, 25830 o 25831/)
    expect(c.motivoNoContinua).toMatch(/Reproyéctalo a ETRS89\/UTM/)
    expect(c.geometria).toBeNull()
    expect(c.bloqueos.map((d) => d.tipo)).toContain(TIPO_GML.SRS_NO_SOPORTADO)

    // Pero el diagnóstico del fichero se da IGUAL: la superficie se cotejó y la
    // geometría se validó, aunque el recorrido se pare después.
    expect(c.hallazgos).not.toBeNull()
    expect(deTipo(c, TIPO_COMPROBACION.SUPERFICIE_COTEJADA)).toHaveLength(1)
  })

  it('cp_area_discrepante: el fichero declara 1576 m² y sus propias coordenadas dan 1535,87', () => {
    const c = comprobarFixture(AREA_MALA)

    expect(c.miembros[0].superficieDeclarada).toBe(1576)
    expect(c.miembros[0].superficieMedida).toBeCloseTo(1535.865149996761, 9)

    const nota = unica(c, TIPO_COMPROBACION.SUPERFICIE_DISCREPANTE)
    expect(nota.severidad).toBe(SEVERIDAD.AVISO)
    expect(nota.datos.diferencia).toBeCloseTo(-40.13485, 4)
    expect(nota.datos.relativo).toBeCloseTo(-0.025466, 6)
    expect(nota.mensaje).toMatch(/el fichero no se cuadra consigo mismo/)
    // Y no se dictamina: se dice el número y se remite a quien firma (regla 9).
    expect(nota.mensaje).toMatch(/lo dice quien firma/)

    expect(c.puedeContinuar).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · C1 · LA SUPERFICIE QUE EL FICHERO DECLARA SOBRE SÍ MISMO
// ═════════════════════════════════════════════════════════════════════════════

describe('C1 · `areaValue` declarado contra la shoelace del propio fichero', () => {
  it('el hueco existía: `parsearGml` NO cotejaba la superficie declarada con la medida', () => {
    // La mitad anti-vacuidad de C1. `AREA_DECLARADA_DISCREPANTE` está en el
    // vocabulario de `gml/_comun.js` desde F04, pero hoy solo se emite cuando el
    // valor NO ES UN NÚMERO. Sobre el fichero fabricado para tener exactamente
    // esa discrepancia, `parsearGml` no dice ni una palabra.
    const r = parsearGml(textoDe(AREA_MALA))
    expect(r.parcelas[0].areaValue).toBe(1576)
    expect(r.detecciones.map((d) => d.tipo)).not.toContain(TIPO_GML.AREA_DECLARADA_DISCREPANTE)

    // Y `comprobarGml`, sobre el mismo texto, sí.
    expect(deTipo(comprobarFixture(AREA_MALA), TIPO_COMPROBACION.SUPERFICIE_DISCREPANTE)).toHaveLength(1)
  })

  it('los 0,13 m² de redondeo del Catastro NO son una discrepancia, y no hace falta ninguna tolerancia para saberlo', () => {
    // La parcela real declara 1536 y mide 1535,865. Marcarlo sería acusar al
    // Catastro de no cuadrar con su propio fichero por un redondeo; no marcarlo
    // con un umbral sería inventarse el `config/umbrales.json` que la regla de
    // oro 9 prohíbe. La salida está en el dato: el `areaValue` del Catastro es un
    // ENTERO (override O6), así que se compara A LA PRECISIÓN CON LA QUE EL
    // FICHERO DECLARA. Cero parámetros libres.
    const nota = unica(comprobarFixture(WFS), TIPO_COMPROBACION.SUPERFICIE_COTEJADA)
    expect(nota.severidad).toBe(SEVERIDAD.INFO)
    expect(nota.datos.decimalesDeclarados).toBe(0)
    expect(nota.datos.diferencia).toBeCloseTo(-0.13485, 4)
    expect(nota.mensaje).toMatch(/en metros cuadrados enteros/)
    // Y el aviso que impide confundir este número con el del parcelario.
    expect(nota.mensaje).toMatch(/lo que el fichero dice de SÍ MISMO/)
    expect(nota.mensaje).not.toMatch(/superficie catastral/i)
  })

  it('la precisión la pone el fichero: declarar 1535,87 cuadra y declarar 1535,86 no', () => {
    // Que el criterio NO es una tolerancia se demuestra moviéndolo: el mismo
    // fichero, con dos decimales declarados, se juzga con dos decimales. Si esto
    // fuera un umbral fijo, los dos casos darían lo mismo.
    const original = textoDe(WFS)
    const con = (valor) =>
      comprobarTexto(original.replace('>1536<', `>${valor}<`), 'precision.gml')

    expect(con('1536').miembros[0].superficieDeclarada).toBe(1536)

    const bien = con('1535.87')
    expect(bien.miembros[0].superficieDeclarada).toBe(1535.87)
    expect(deTipo(bien, TIPO_COMPROBACION.SUPERFICIE_COTEJADA)).toHaveLength(1)
    expect(unica(bien, TIPO_COMPROBACION.SUPERFICIE_COTEJADA).datos.decimalesDeclarados).toBe(2)

    const mal = con('1535.86')
    expect(deTipo(mal, TIPO_COMPROBACION.SUPERFICIE_DISCREPANTE)).toHaveLength(1)
    expect(unica(mal, TIPO_COMPROBACION.SUPERFICIE_DISCREPANTE).datos.diferencia).toBeCloseTo(
      0.00515,
      5,
    )
  })

  it('sin `areaValue` no hay dos números que cotejar, y eso también se dice', () => {
    const sinArea = textoDe(WFS).replace(/<cp:areaValue[^>]*>[^<]*<\/cp:areaValue>/, '')
    expect(sinArea).not.toMatch(/areaValue/)

    const c = comprobarTexto(sinArea, 'sin-area.gml')
    expect(c.miembros[0].superficieDeclarada).toBeNull()
    const nota = unica(c, TIPO_COMPROBACION.SUPERFICIE_NO_DECLARADA)
    expect(nota.severidad).toBe(SEVERIDAD.INFO)
    expect(nota.datos.superficieMedida).toBeCloseTo(1535.865149996761, 9)
    // Y la etiqueta del miembro no enseña un número a secas: dice que es MEDIDO.
    expect(c.miembros[0].etiqueta).toMatch(/1535,87 m² medidos$/)
  })

  it('la superficie medida es `null` —no 0— cuando no hay geometría que medir', () => {
    const sinGeometria = textoDe(WFS).replace(/<cp:geometry>[\s\S]*?<\/cp:geometry>/, '')
    const c = comprobarTexto(sinGeometria, 'sin-geometria.gml')
    expect(c.miembros[0].superficieMedida).toBeNull()
    // `nVertices` sí es 0, y ahí 0 es la verdad: son cero vértices. La asimetría
    // es deliberada — «no hay superficie que medir» y «mide cero m²» son dos
    // afirmaciones distintas, y la segunda tranquiliza.
    expect(c.miembros[0].nVertices).toBe(0)
    // El rótulo sigue enseñando lo DECLARADO, que es lo único que queda del
    // fichero, y dice que es declarado.
    expect(c.miembros[0].etiqueta).toMatch(/1536 m² declarados$/)

    // Y sin geometría NI superficie declarada, el rótulo no se inventa un número.
    const pelada = comprobarTexto(
      sinGeometria.replace(/<cp:areaValue[^>]*>[^<]*<\/cp:areaValue>/, ''),
      'pelada.gml',
    )
    expect(pelada.miembros[0].etiqueta).toMatch(/sin geometría$/)
    expect(pelada.miembros[0].superficieDeclarada).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · C2 · COORDENADAS FUERA DEL HUSO **DECLARADO**
// ═════════════════════════════════════════════════════════════════════════════

describe('C2 · el huso se VERIFICA contra el que declara el fichero, nunca contra uno deducido', () => {
  it('el hueco existía: `parsearGml` no dice ni una palabra sobre el huso, y lo hace a propósito', () => {
    const r = parsearGml(textoDe(HUSO_MALO))
    expect(r.parcelas[0].srs).toBe('EPSG:25829')
    expect(r.detecciones.some((d) => /HUSO/i.test(d.tipo))).toBe(false)
    // La razón está escrita en su cabecera: `detectarHuso` en autodetección
    // «equivale a asumir huso 30», y una nota construida sobre eso sería un falso
    // positivo disfrazado de hecho.
  })

  it('con el huso declarado como ÚNICO candidato, las mismas coordenadas dan dos respuestas distintas', () => {
    // Ésta es la prueba de que se verifica y no se adivina: las coordenadas son
    // las mismas en los dos ficheros —el derivado no tocó ni un número— y lo
    // único que cambia es el `srsName`. Leídas como 25830 caen dentro; leídas
    // como 25829 caen fuera.
    const bueno = comprobarFixture(WFS)
    const malo = comprobarFixture(HUSO_MALO)
    expect(bueno.geometria.recintos[0].vertices).toEqual(malo.geometria.recintos[0].vertices)

    expect(unica(bueno, TIPO_COMPROBACION.HUSO_VERIFICADO).datos).toEqual({
      srs: 'EPSG:25830',
      huso: 30,
      nVertices: 15,
      nFuera: 0,
    })
    expect(unica(malo, TIPO_COMPROBACION.HUSO_FUERA_DE_RANGO).datos.nFuera).toBe(15)

    // Y contra el huso 30, esas mismas coordenadas del fichero «incoherente» no
    // dan ni un hallazgo: lo que está fuera de sitio es el `srsName`, no ellas.
    expect(reglasHuso(malo.geometria.recintos, { srs: 'EPSG:25830' })).toHaveLength(0)
  })

  it('«no hay nada fuera» y «no he podido mirarlo» dejan de ser el mismo silencio', () => {
    // `reglasHuso` devuelve `[]` en los dos casos —su propio fuente dice que sin
    // `srs` «no se emite ningún hallazgo»— y ese silencio significa dos cosas
    // opuestas. Aquí está la ambigüedad, medida sobre las MISMAS coordenadas:
    const recintos = comprobarFixture(WFS).geometria.recintos
    expect(reglasHuso(recintos, { srs: 'EPSG:25830' }), 'todo dentro').toHaveLength(0)
    expect(reglasHuso(recintos, {}), 'no se ha podido mirar').toHaveLength(0)

    // Desde esta capa, que sí sabe cuál de los dos casos es, se distinguen.
    const sinSrs = comprobarFixture(SRS_MALO)
    const nota = unica(sinSrs, TIPO_COMPROBACION.HUSO_NO_COTEJABLE)
    expect(nota.severidad).toBe(SEVERIDAD.AVISO)
    expect(nota.datos).toEqual({ srs: null, nVertices: 15 })
    expect(deTipo(sinSrs, TIPO_COMPROBACION.HUSO_VERIFICADO)).toHaveLength(0)

    // El otro lado del mismo par: con SRS sí se afirma haberlo mirado.
    expect(deTipo(comprobarFixture(WFS), TIPO_COMPROBACION.HUSO_NO_COTEJABLE)).toHaveLength(0)
  })

  it('cada fichero con geometría emite exactamente UNA nota de huso, de las tres posibles', () => {
    const TIPOS_HUSO = [
      TIPO_COMPROBACION.HUSO_VERIFICADO,
      TIPO_COMPROBACION.HUSO_FUERA_DE_RANGO,
      TIPO_COMPROBACION.HUSO_NO_COTEJABLE,
    ]
    let conGeometria = 0
    for (const nombre of TODOS) {
      const c = comprobarFixture(nombre)
      const cuantas = todasLasDetecciones(c).filter((d) => TIPOS_HUSO.includes(d.tipo)).length
      if (c.hallazgos === null) {
        expect(cuantas, `${nombre}: sin geometría no hay huso que comprobar`).toBe(0)
      } else {
        conGeometria += 1
        expect(cuantas, `${nombre}: una y solo una nota de huso`).toBe(1)
      }
    }
    expect(conGeometria).toBe(7) // los nueve menos los dos de edificio
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · C3 · LA GEOMETRÍA ENTERA (F02) — EL PUNTO QUE F04 DEJÓ ABIERTO POR ESCRITO
// ═════════════════════════════════════════════════════════════════════════════

describe('C3 · la geometría pasa por `validarParcela`, que es lo que F04 dejó pendiente para F08', () => {
  /**
   * El fichero real con dos pares del `posList` intercambiados: el contorno se
   * cruza consigo mismo. No existe ningún GML real con una autointersección —y
   * mejor así—, y fabricar la mutación sobre el fichero del Catastro deja un
   * documento que sigue siendo suyo con un defecto concreto.
   */
  const CRUZADO = (() => {
    const A = '439246.37 4479637.48'
    const B = '439222.47 4479678.13'
    const texto = textoDe(WFS).replace(A, '@@@').replace(B, A).replace('@@@', B)
    return texto
  })()

  it('la mutación es una mutación: el texto cambia y no quedan marcas del intercambio', () => {
    expect(CRUZADO).not.toBe(textoDe(WFS))
    expect(CRUZADO).not.toContain('@@@')
    expect(CRUZADO.match(/439246\.37 4479637\.48/g)).toHaveLength(1)
  })

  it('una autointersección solo la ve `kinks`, y `parsearGml` la deja pasar en verde', () => {
    // La cita literal de `spec/feature-04-gml-parcela.md` §5: «un colapso puede
    // además crear una autointersección que solo `kinks` vería. Ese chequeo es de
    // F08». Aquí está el antes.
    const r = parsearGml(CRUZADO)
    expect(r.parcelas[0].recintos[0].vertices).toHaveLength(15)
    expect(r.detecciones.some((d) => /intersec/i.test(d.mensaje))).toBe(false)
  })

  it('…y aquí el después: `comprobarGml` la nombra, y el recorrido CONTINÚA igualmente', () => {
    const c = comprobarTexto(CRUZADO, 'cruzado.gml')
    const cruce = c.hallazgos.find((h) => /Autointersección/.test(h.mensaje))
    expect(cruce, 'el hallazgo de autointersección tiene que estar').toBeDefined()
    expect(cruce.nivel).toBe(NIVEL.ERROR)
    expect(cruce.verticesAfectados.length).toBeGreaterThan(0)

    // Una parcela con autointersecciones CONTINÚA: el diagnóstico es precisamente
    // lo que hay que enseñarle. `puedeContinuar` es capacidad, no mérito.
    expect(c.puedeContinuar).toBe(true)
    expect(c.geometria).not.toBeNull()

    const nota = unica(c, TIPO_COMPROBACION.GEOMETRIA_CON_HALLAZGOS)
    expect(nota.severidad).toBe(SEVERIDAD.AVISO)
    expect(nota.datos.nErrores).toBe(1)
    expect(nota.mensaje).toMatch(/Nada de esto impide seguir/)
  })

  it('los vértices duplicados también salen, y con su verbo de corrección', () => {
    const par = '439268.76 4479658.01'
    const dup = textoDe(WFS).replace(par, `${par} ${par}`)
    const c = comprobarTexto(dup, 'duplicado.gml')

    const duplicado = c.hallazgos.find((h) => /duplicados/.test(h.mensaje))
    expect(duplicado).toBeDefined()
    expect(duplicado.nivel).toBe(NIVEL.ERROR)
    expect(duplicado.correccion).toBe('Eliminar vértice duplicado')
    expect(c.puedeContinuar).toBe(true)
  })

  it('los hallazgos van en UNA lista con los errores delante, y `puedeGenerar` NO se reexpone', () => {
    const c = comprobarFixture(HUSO_MALO)
    expect(c.hallazgos.map((h) => h.nivel)).toEqual(['ERROR', 'AVISO', 'AVISO', 'AVISO'])
    // La separación de F02 no se pierde: viaja en `h.nivel`. Lo que no viaja es
    // `puedeGenerar` —el gate de F04 para ESCRIBIR un GML—, porque un segundo
    // booleano en esta salida se confundiría con `puedeContinuar`.
    expect(Object.keys(c)).not.toContain('puedeGenerar')
    expect(JSON.stringify(c)).not.toContain('puedeGenerar')
  })

  it('`null` y `[]` no son lo mismo: sin geometría no se validó, con geometría limpia sí', () => {
    expect(comprobarFixture(EDIFICIO).hallazgos).toBeNull()
    expect(comprobarFixture(TRESCERO).hallazgos).toEqual([])
    const nota = unica(comprobarFixture(TRESCERO), TIPO_COMPROBACION.GEOMETRIA_REVISADA)
    expect(nota.severidad).toBe(SEVERIDAD.INFO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · C4 · LA ORIENTACIÓN DEL EXTERIOR: INFORMATIVA, JAMÁS UN ERROR (O1)
// ═════════════════════════════════════════════════════════════════════════════

describe('C4 · la orientación del exterior es una nota informativa y nunca puede ser otra cosa', () => {
  it('la plantilla OFICIAL va antihoraria, y el texto dice que no está mal', () => {
    const nota = unica(comprobarFixture(EJEMPLO), TIPO_COMPROBACION.ORIENTACION_EXTERIOR)
    expect(nota.severidad).toBe(SEVERIDAD.INFO)
    expect(nota.datos).toEqual({ orientacionExterior: 1, sentido: 'ANTIHORARIO' })
    expect(nota.mensaje).toMatch(/plantilla oficial/i)
    expect(nota.mensaje).toMatch(/No está mal/)
    expect(nota.mensaje).toMatch(/convención y no un requisito/)
  })

  it('la descarga del WFS va horaria, y también es un dato y no un requisito', () => {
    const nota = unica(comprobarFixture(WFS), TIPO_COMPROBACION.ORIENTACION_EXTERIOR)
    expect(nota.severidad).toBe(SEVERIDAD.INFO)
    expect(nota.datos).toEqual({ orientacionExterior: -1, sentido: 'HORARIO' })
    expect(nota.mensaje).toMatch(/Es un dato, no un requisito/)
  })

  it('en NINGÚN fichero la orientación llega a AVISO ni a ERROR, y el guardián ve los dos sentidos', () => {
    const sentidos = new Set()
    for (const nombre of TODOS) {
      const c = comprobarFixture(nombre)
      for (const d of todasLasDetecciones(c)) {
        if (d.tipo !== TIPO_COMPROBACION.ORIENTACION_EXTERIOR) continue
        expect(d.severidad, `${nombre}: la orientación no puede ser ${d.severidad}`).toBe(
          SEVERIDAD.INFO,
        )
        sentidos.add(d.datos.sentido)
      }
      expect(
        c.bloqueos.some((d) => d.tipo === TIPO_COMPROBACION.ORIENTACION_EXTERIOR),
        `${nombre}: la orientación no puede bloquear nada`,
      ).toBe(false)
    }
    // Anti-vacuidad: si todos los fixtures fueran del mismo sentido, este test no
    // estaría comprobando que el informativo se sostiene en los dos lados.
    expect([...sentidos].sort()).toEqual(['ANTIHORARIO', 'HORARIO'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · `puedeContinuar` — CAPACIDAD DE LA APLICACIÓN, NO MÉRITO DE LA PARCELA
// ═════════════════════════════════════════════════════════════════════════════

describe('`puedeContinuar` es capacidad, no veredicto', () => {
  /** Los cinco caminos a `false`, fabricados o reales. */
  const NO_CONTINUAN = () => [
    ['GML de edificio', comprobarFixture(EDIFICIO)],
    ['SRS no soportado (4326)', comprobarFixture(SRS_MALO)],
    ['no es XML en absoluto', comprobarTexto('esto no es un GML, es la lista de la compra')],
    ['XML de otra cosa', comprobarTexto('<?xml version="1.0"?><catalogo><libro/></catalogo>')],
    ['colección sin parcelas', comprobarTexto(textoDe(WFS).replace(/<member>[\s\S]*<\/member>/, ''))],
    [
      'parcela sin geometría legible',
      comprobarTexto(textoDe(WFS).replace(/<cp:geometry>[\s\S]*?<\/cp:geometry>/, '')),
    ],
    ['sin `srsName`', comprobarTexto(textoDe(WFS).replaceAll(/\s*srsName="[^"]*"/g, ''))],
  ]

  it('cuando vale `false`, el motivo NUNCA es null ni cadena vacía, y además hay bloqueo que lo respalde', () => {
    const casos = NO_CONTINUAN()
    expect(casos.length).toBeGreaterThan(4) // el guardián mira algo
    for (const [nombre, c] of casos) {
      expect(c.puedeContinuar, `${nombre}: debería pararse`).toBe(false)
      expect(typeof c.motivoNoContinua, `${nombre}: motivo`).toBe('string')
      expect(c.motivoNoContinua.trim().length, `${nombre}: motivo vacío`).toBeGreaterThan(20)
      expect(c.geometria, `${nombre}: sin poder seguir no se entrega geometría`).toBeNull()
      // MEDIDO: todos los caminos a `false` traen además su ERROR de
      // `gml/parse.js`, así que la lista de bloqueos nunca se queda muda cuando el
      // recorrido se para. Si algún día deja de ser cierto, este test lo dirá.
      expect(c.bloqueos.length, `${nombre}: bloqueos`).toBeGreaterThan(0)
    }
  })

  it('cada motivo es DISTINTO y nombra su caso: no hay un «no se puede continuar» genérico', () => {
    const motivos = NO_CONTINUAN().map(([, c]) => c.motivoNoContinua)
    // El GML de edificio y el resto no pueden compartir frase: son cinco
    // situaciones distintas y un mensaje único obligaría al usuario a adivinar.
    expect(new Set(motivos).size).toBeGreaterThanOrEqual(5)
    expect(motivos[0]).toMatch(/CONSTRUCCIÓN/)
    expect(motivos[2]).toMatch(/no se ha podido leer como XML/)
    expect(motivos[3]).toMatch(/su elemento raíz \(«catalogo»\)/)
    expect(motivos[4]).toMatch(/no trae ninguna parcela dentro/)
    expect(motivos[5]).toMatch(/no trae geometría legible/)
  })

  it('cuando vale `true`, el motivo es null y la geometría sale lista para `crearParcela`', () => {
    const siguen = [EJEMPLO, WFS, TRESCERO, MULTI, HUSO_MALO, AREA_MALA]
    for (const nombre of siguen) {
      const c = comprobarFixture(nombre)
      expect(c.puedeContinuar, nombre).toBe(true)
      expect(c.motivoNoContinua, nombre).toBeNull()
      expect(c.geometria, nombre).not.toBeNull()
      expect(typeof c.geometria.srs, nombre).toBe('string')
      expect(c.geometria.recintos.length, nombre).toBeGreaterThan(0)
      expect(c.geometria.recintos[0].tipo, nombre).toBe('EXTERIOR')
    }
  })

  it('lo que NO apaga el recorrido: un 3.0, un huso incoherente, una superficie que no cuadra y una autointersección', () => {
    // Los cuatro son cosas «malas» del fichero, y ninguna de las cuatro es
    // asunto de este gate. Si alguna vez uno de estos cuatro sale `false`,
    // `puedeContinuar` se habrá convertido en un veredicto.
    expect(comprobarFixture(TRESCERO).puedeContinuar).toBe(true)
    expect(comprobarFixture(HUSO_MALO).puedeContinuar).toBe(true)
    expect(comprobarFixture(AREA_MALA).puedeContinuar).toBe(true)
    const par = '439268.76 4479658.01'
    expect(comprobarTexto(textoDe(WFS).replace(par, `${par} ${par}`)).puedeContinuar).toBe(true)
  })

  it('`geometria !== null` ⟺ `puedeContinuar`, en los nueve ficheros y en las siete mutaciones', () => {
    const todas = [...TODOS.map((n) => [n, comprobarFixture(n)]), ...NO_CONTINUAN()]
    for (const [nombre, c] of todas) {
      expect(c.geometria === null, `${nombre}`).toBe(!c.puedeContinuar)
    }
    expect(todas.length).toBe(16)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · EL CHOQUE DE `ENCODING_DECLARADO` — DOS CAPAS, EL MISMO HECHO
// ═════════════════════════════════════════════════════════════════════════════

describe('el choque de `ENCODING_DECLARADO`: manda quien midió el hecho', () => {
  it('el choque es REAL: las dos capas emiten el mismo tipo con severidad distinta', () => {
    // La mitad anti-vacuidad. Si esto dejara de ser cierto, la regla de
    // desduplicación sobraría y este test lo diría en vez de dejarla ahí sin uso.
    const bytes = bytesDe(WFS)
    const { texto, detecciones } = decodificarGml(bytes)

    const deLosBytes = detecciones.filter((d) => d.tipo === TIPO_GML.ENCODING_DECLARADO)
    expect(deLosBytes).toHaveLength(1)
    expect(deLosBytes[0].severidad).toBe(SEVERIDAD.INFO)

    const delXml = parsearGml(texto).detecciones.filter(
      (d) => d.tipo === TIPO_GML.ENCODING_DECLARADO,
    )
    expect(delXml).toHaveLength(1)
    expect(delXml[0].severidad).toBe(SEVERIDAD.AVISO)
  })

  it('compuestas, queda UNA sola —la del lector de bytes— y el descarte se cuenta', () => {
    const c = comprobarFixture(WFS)
    const encoding = deTipo(c, TIPO_GML.ENCODING_DECLARADO)
    expect(encoding).toHaveLength(1)
    // Se conserva la INFO: es la de la capa que vio los bytes y que ya ha dicho
    // aparte, con pruebas, lo que había que objetar (`ENCODING_DESMENTIDO`).
    expect(encoding[0].severidad).toBe(SEVERIDAD.INFO)
    expect(deTipo(c, TIPO_GML.ENCODING_DESMENTIDO)).toHaveLength(1)

    // Y nada se tira en silencio (regla de oro 1).
    const aviso = unica(c, TIPO_COMPROBACION.DETECCION_SOLAPADA)
    expect(aviso.severidad).toBe(SEVERIDAD.INFO)
    expect(aviso.datos).toEqual({
      tipo: TIPO_GML.ENCODING_DECLARADO,
      omitidas: 1,
      severidadOmitida: SEVERIDAD.AVISO,
    })
  })

  it('sin detecciones previas no hay a quién ceder el paso: la del lector de XML sobrevive intacta', () => {
    // El caso del llamante que NO usó `decodificarGml` (texto que viene de otro
    // sitio). Entonces la de `parsearGml` es la única que habla del prólogo y
    // desdupliCARLA sería perder el dato.
    const c = comprobarTexto(textoDe(WFS), 'sin-previas.gml')
    const encoding = deTipo(c, TIPO_GML.ENCODING_DECLARADO)
    expect(encoding).toHaveLength(1)
    expect(encoding[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(deTipo(c, TIPO_COMPROBACION.DETECCION_SOLAPADA)).toHaveLength(0)
  })

  it('la regla es ESTRECHA: los tres `CIERRE_RETIRADO` del multiparcela son tres hechos y siguen siendo tres', () => {
    // Generalizar la desduplicación a «cualquier tipo repetido» se cargaría casos
    // legítimos. Éste es el que lo demuestra.
    const c = comprobarFixture(MULTI)
    expect(deTipo(c, TIPO_GML.CIERRE_RETIRADO)).toHaveLength(3)
  })

  it('un fichero honesto en UTF-8 no dispara ninguna desduplicación', () => {
    // `parsearGml` solo emite `ENCODING_DECLARADO` cuando el prólogo NO dice
    // UTF-8, así que aquí no hay choque que resolver.
    const c = comprobarFixture(EJEMPLO)
    expect(deTipo(c, TIPO_GML.ENCODING_DECLARADO)).toHaveLength(1)
    expect(deTipo(c, TIPO_GML.ENCODING_DECLARADO)[0].severidad).toBe(SEVERIDAD.INFO)
    expect(deTipo(c, TIPO_COMPROBACION.DETECCION_SOLAPADA)).toHaveLength(0)
  })

  it('el `encodingUsado` no se supone: si nadie lo dice y ninguna detección lo lleva, es `null`', () => {
    const c = comprobarTexto(textoDe(WFS), 'anonimo.gml')
    expect(c.fichero.encodingUsado).toBeNull()
    // Pero el DECLARADO sí se mide sobre el propio texto, siempre.
    expect(c.fichero.encodingDeclarado).toBe('ISO-8859-1')

    // Y si viene dentro de una detección previa, se rescata sin que el llamante
    // tenga que pasarlo aparte.
    const conBom = comprobarGml({
      texto: textoDe(WFS),
      nombreFichero: 'con-bom.gml',
      deteccionesPrevias: decodificarGml(
        new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('<a/>')]),
      ).detecciones,
    })
    expect(conBom.fichero.encodingUsado).toBe('utf-8')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · LA FRONTERA ERROR-DE-DATO / ERROR-DE-PROGRAMADOR (SPEC §2.1)
// ═════════════════════════════════════════════════════════════════════════════

describe('un fichero malo produce detecciones; el `throw` se reserva al contrato roto', () => {
  it('ni el XML roto, ni los bytes basura, ni la cadena vacía lanzan nada', () => {
    for (const texto of ['', '   ', 'no soy XML', '<gml:FeatureCollection', ' ']) {
      expect(() => comprobarTexto(texto), JSON.stringify(texto)).not.toThrow()
      expect(comprobarTexto(texto).puedeContinuar).toBe(false)
    }
  })

  it('la entrada que no es un objeto lanza, y el mensaje dice qué se esperaba', () => {
    expect(() => comprobarGml('<gml/>')).toThrow(/se esperaba un objeto de entrada/)
    expect(() => comprobarGml(null)).toThrow(TypeError)
    expect(() => comprobarGml([])).toThrow(TypeError)
  })

  it('pasar los BYTES en vez del texto lanza, que es justo lo que `gml/decodificar.js` existe para impedir', () => {
    expect(() => comprobarGml({ texto: bytesDe(WFS), nombreFichero: 'a.gml' })).toThrow(
      /YA DECODIFICADO/,
    )
    expect(() => comprobarGml({ texto: bytesDe(WFS), nombreFichero: 'a.gml' })).toThrow(
      /decodificarGml/,
    )
  })

  it('un nombre de fichero vacío lanza: una comprobación anónima no se puede citar en un expediente', () => {
    expect(() => comprobarGml({ texto: '<a/>', nombreFichero: '' })).toThrow(/no vacío/)
    expect(() => comprobarGml({ texto: '<a/>', nombreFichero: '   ' })).toThrow(TypeError)
    expect(() => comprobarGml({ texto: '<a/>' })).toThrow(TypeError)
  })

  it('`bytes` es el TAMAÑO, no el búfer, y el mensaje lo dice', () => {
    const bytes = bytesDe(WFS)
    expect(() => comprobarGml({ texto: '<a/>', nombreFichero: 'a.gml', bytes })).toThrow(
      /byteLength/,
    )
    expect(() => comprobarGml({ texto: '<a/>', nombreFichero: 'a.gml', bytes: -1 })).toThrow(
      TypeError,
    )
    expect(() =>
      comprobarGml({ texto: '<a/>', nombreFichero: 'a.gml', bytes: bytes.byteLength }),
    ).not.toThrow()
  })

  it('un `indiceElegido` que no existe habiendo parcelas es un bug del llamante, y suena', () => {
    // Los índices los produce esta misma función en `miembros[].indice`: pedir uno
    // que no está no es un dato del usuario.
    expect(() => comprobarFixture(MULTI, { indiceElegido: 3 })).toThrow(RangeError)
    expect(() => comprobarFixture(MULTI, { indiceElegido: 3 })).toThrow(/va de 0 a 2/)
    expect(() => comprobarFixture(MULTI, { indiceElegido: 2 })).not.toThrow()
    expect(() => comprobarFixture(WFS, { indiceElegido: 1.5 })).toThrow(/entero ≥ 0/)
    expect(() => comprobarFixture(WFS, { indiceElegido: -1 })).toThrow(TypeError)
    // Pero el índice 0 por defecto sobre un fichero SIN parcelas no lanza: es el
    // caso normal del GML de edificio.
    expect(() => comprobarFixture(EDIFICIO)).not.toThrow()
    expect(comprobarFixture(EDIFICIO).elegido).toBeNull()
  })

  it('unas detecciones previas malformadas lanzan, nombrando cuál', () => {
    const mal = (deteccionesPrevias) =>
      comprobarGml({ texto: '<a/>', nombreFichero: 'a.gml', deteccionesPrevias })
    expect(() => mal('no soy un array')).toThrow(/debe ser un array/)
    expect(() => mal([{ tipo: 'X', mensaje: 'y' }])).toThrow(/deteccionesPrevias\[0\]/)
    expect(() => mal([{ tipo: 'X', mensaje: 'y', severidad: 'GRAVE' }])).toThrow(TypeError)
    // Y una detección de OTRO catálogo (los parsers de CAD, cuando F01 se
    // enchufe) pasa sin problema: se comprueba la forma, no el vocabulario.
    expect(() =>
      mal([{ tipo: 'ARCO_DISCRETIZADO', mensaje: 'un arco', severidad: 'INFO' }]),
    ).not.toThrow()
  })

  it('las detecciones previas se conservan íntegras y van las primeras', () => {
    const ajena = { tipo: 'ARCO_DISCRETIZADO', mensaje: 'un arco', severidad: 'INFO' }
    const c = comprobarGml({
      texto: textoDe(EJEMPLO),
      nombreFichero: 'con-previas.gml',
      deteccionesPrevias: [ajena],
    })
    expect(c.notas[0]).toBe(ajena)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · EL GUARDIÁN DE LA REGLA DE ORO 9
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Claves que serían un veredicto. Es la lista del plan de F08 con dos añadidos
 * deliberados:
 *
 *   · las variantes ACENTUADAS, porque un `válido` con tilde no puede colarse por
 *     haberse escrito el patrón sin ella;
 *   · **`puede`**, y esto no es cosmético: sin él, `puedeContinuar` no casaría con
 *     el patrón y la «única excepción» que el plan manda nombrar sería decorativa —
 *     un comentario sobre algo que el guardián nunca iba a mirar. Con él, la
 *     excepción es real y de paso queda cazado cualquier `puedeGenerar`,
 *     `puedeSubir` o `puedePresentarse` que intente entrar por la puerta de atrás.
 */
const CLAVE_DE_VEREDICTO =
  /^(ok|valido|válido|apto|apta|aprobado|dentro|cumple|semaforo|semáforo|umbral|tolerancia|veredicto|puede)/i

/**
 * La ÚNICA excepción, y por qué: `puedeContinuar` es capacidad de la APLICACIÓN
 * («yo no puedo seguir con este fichero»), no mérito de la parcela («tu parcela
 * está mal»). Precedente literal: el gate `puedeGenerar` de F02. Vale `false`
 * únicamente cuando no hay geometría con la que trabajar, nunca porque la parcela
 * tenga autointersecciones, esté fuera de huso o declare una superficie que no
 * cuadra — los cuatro casos tienen su test arriba, y en los cuatro vale `true`.
 */
const EXCEPCION = 'puedeContinuar'

/** Todas las claves del objeto, a cualquier profundidad. */
function clavesProfundas(valor, acc = []) {
  if (Array.isArray(valor)) {
    for (const v of valor) clavesProfundas(v, acc)
  } else if (valor !== null && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      acc.push(k)
      clavesProfundas(v, acc)
    }
  }
  return acc
}

/** Las claves prohibidas que encuentra el guardián (sin contar la excepción). */
const clavesProhibidas = (objeto) =>
  clavesProfundas(objeto).filter((k) => k !== EXCEPCION && CLAVE_DE_VEREDICTO.test(k))

describe('regla de oro 9 · `comprobacion/` mide y no dictamina', () => {
  it('el patrón NO es decorativo: caza la excepción y caza a sus parientes', () => {
    // Si esto fallara, el guardián de abajo estaría pasando en verde sobre un
    // objeto que nunca podría suspender.
    expect(CLAVE_DE_VEREDICTO.test(EXCEPCION)).toBe(true)
    for (const clave of ['ok', 'valido', 'válido', 'apto', 'umbral', 'puedeGenerar', 'cumple']) {
      expect(CLAVE_DE_VEREDICTO.test(clave), clave).toBe(true)
    }
    // Y no caza por parecido, que es como un guardián demasiado ancho acaba
    // desactivado: `superficieDeclarada` y `superficieMedida` son las dos claves
    // que este módulo estrena, y ninguna es un juicio.
    for (const clave of ['superficieDeclarada', 'superficieMedida', 'orientacionExterior', 'notas']) {
      expect(CLAVE_DE_VEREDICTO.test(clave), clave).toBe(false)
    }
  })

  it('ninguna clave del resultado, a ninguna profundidad y en ninguno de los nueve ficheros, es un veredicto', () => {
    let miradas = 0
    for (const nombre of TODOS) {
      const c = comprobarFixture(nombre)
      const claves = clavesProfundas(c)
      miradas += claves.length
      for (const clave of claves) {
        if (clave === EXCEPCION) continue
        expect(clave, `${nombre}: la clave '${clave}' parece un veredicto`).not.toMatch(
          CLAVE_DE_VEREDICTO,
        )
      }
      // Y la excepción está SIEMPRE, para que nadie la borre y deje el comentario.
      expect(claves, nombre).toContain(EXCEPCION)
    }
    expect(miradas, 'el guardián mira algo, no un objeto vacío').toBeGreaterThan(400)
  })

  it('…y el recorrido DISPARA cuando se le mete un veredicto, que es la mitad que suele faltar', () => {
    const c = comprobarFixture(WFS)
    expect(clavesProhibidas(c)).toEqual([])
    // Uno en la raíz y otro enterrado dentro de un array, que es donde se colaría
    // de verdad: un `ok` por miembro es más fácil de escribir que uno arriba.
    const contaminado = {
      ...c,
      aprobado: true,
      miembros: c.miembros.map((m) => ({ ...m, dentroDeMargen: false })),
    }
    expect(clavesProhibidas(contaminado).sort()).toEqual(['aprobado', 'dentroDeMargen'])
  })

  it('ningún módulo de `comprobacion/` EXPORTA una clave de veredicto', () => {
    const MODULOS = { 'gml.js': comprobacionModulo, '_comun.js': comunModulo }
    let miradas = 0
    for (const [fichero, modulo] of Object.entries(MODULOS)) {
      for (const [nombre, valor] of Object.entries(modulo)) {
        miradas += 1
        expect(nombre, `comprobacion/${fichero} exporta '${nombre}'`).not.toMatch(
          CLAVE_DE_VEREDICTO,
        )
        // Y las claves de los objetos congelados que se exportan: un
        // `TIPO_COMPROBACION.OK` sería un veredicto con otro sombrero.
        if (valor !== null && typeof valor === 'object') {
          for (const clave of Object.keys(valor)) {
            miradas += 1
            expect(clave, `comprobacion/${fichero} → ${nombre}.${clave}`).not.toMatch(
              CLAVE_DE_VEREDICTO,
            )
          }
        }
      }
    }
    expect(miradas).toBeGreaterThan(20)
  })

  it('no existe `config/umbrales.json`, y esta capa tampoco lo estrena', () => {
    // El mismo frente que dejó escrito F07. Se repite aquí porque F08 es la
    // primera fase que compara dos números del mismo fichero, que es exactamente
    // la ocasión de inventarse una tolerancia.
    expect(JSON.stringify(comprobarFixture(AREA_MALA))).not.toMatch(/umbral|tolerancia/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · `comprobacion/_comun.js` — EL VOCABULARIO Y SUS ATADURAS
// ═════════════════════════════════════════════════════════════════════════════

describe('comprobacion/_comun.js · el vocabulario no puede quedarse corto en silencio', () => {
  it('la tabla de dialectos cubre EXACTAMENTE los que conoce `gml/_comun.js`', () => {
    // Si mañana entra un dialecto sexto en `gml/`, el cajón se quedaría mudo sobre
    // él. Este test lo impide en el momento de añadirlo.
    expect(Object.keys(ETIQUETAS_DIALECTO).sort()).toEqual(Object.values(DIALECTO).sort())
    for (const [id, { etiqueta, queSignifica }] of Object.entries(ETIQUETAS_DIALECTO)) {
      expect(etiqueta.length, id).toBeGreaterThan(10)
      expect(queSignifica.length, id).toBeGreaterThan(40)
      // Nada de jerga de programador en un texto que se enseña tal cual.
      expect(queSignifica, id).not.toMatch(/SPEC §|override O\d|namespace|featureNs/i)
    }
  })

  it('un dialecto desconocido no deja el cajón en blanco: hay reserva y dice que es un fallo del programa', () => {
    const reserva = etiquetaDialecto('CP_5_0_DEL_FUTURO')
    expect(reserva.etiqueta).toMatch(/CP_5_0_DEL_FUTURO/)
    expect(reserva.queSignifica).toMatch(/fallo del programa, no del fichero/)
  })

  it('la factoría de detecciones no fabrica mudas ni con un tipo de otro catálogo', () => {
    expect(() =>
      crearDeteccionComprobacion('ENCODING_DECLARADO', 'x', SEVERIDAD.INFO),
    ).toThrow(RangeError)
    expect(() =>
      crearDeteccionComprobacion(TIPO_COMPROBACION.HUSO_VERIFICADO, '', SEVERIDAD.INFO),
    ).toThrow(TypeError)
    expect(() =>
      crearDeteccionComprobacion(TIPO_COMPROBACION.HUSO_VERIFICADO, 'x', 'GRAVE'),
    ).toThrow(RangeError)
    expect(() =>
      crearDeteccionComprobacion(TIPO_COMPROBACION.HUSO_VERIFICADO, 'x', SEVERIDAD.INFO, [1]),
    ).toThrow(TypeError)
    // `datos` ausente NO es `datos: undefined`: el contrato es `datos?`.
    expect(crearDeteccionComprobacion(TIPO_COMPROBACION.HUSO_VERIFICADO, 'x', SEVERIDAD.INFO)).toEqual(
      { tipo: 'HUSO_VERIFICADO', mensaje: 'x', severidad: 'INFO' },
    )
  })

  it('los números de los mensajes salen en castellano y sin depender del locale de la máquina', () => {
    expect(numero(1535.865149996761)).toBe('1535,87')
    expect(numero(1536)).toBe('1536')
    expect(numero(236.0455999971792)).toBe('236,05')
    expect(numero(10.1)).toBe('10,1')
    expect(numero(0)).toBe('0')
    expect(numero(2.5465 * 100, 2)).toBe('254,65')
  })

  it('los decimales se cuentan sobre lo que el fichero ESCRIBE, que es de donde sale el criterio de C1', () => {
    expect(decimalesDe(1536)).toBe(0)
    expect(decimalesDe(1535.87)).toBe(2)
    expect(decimalesDe(1535.8)).toBe(1)
    // Notación exponencial: no la produce un `cp:areaValue`, y devolver 0 sería
    // mentir por defecto.
    expect(decimalesDe(1e-7)).toBe(15)
  })

  it('`SEVERIDAD` es EL MISMO objeto que el de `gml/_comun.js`, no una copia', () => {
    // Las tres capas vuelcan sus detecciones en la misma lista y se parten por
    // severidad: dos catálogos que pudieran divergir romperían esa partición sin
    // que nadie se enterase.
    expect(SEVERIDAD).toBe(comunModulo.SEVERIDAD)
    expect(Object.values(SEVERIDAD)).toEqual(['INFO', 'AVISO', 'ERROR'])
  })
})
