/* -------------------------------------------------------------------------- *
 * test/edificio/aceptacion-f11.test.js — F11 · T5.1 · SUITE DE ACEPTACIÓN      *
 *                                                                              *
 * La prueba que decide si F11 está hecha. Los CUATRO criterios de              *
 * `spec/feature-11-edificio-entrada.md` § «Criterios de aceptación», uno a uno  *
 * y con su texto LITERAL en el nombre del `describe`:                          *
 *                                                                              *
 *   AC1 · «El selector oculta los atributos semánticos en modo                 *
 *         simplificado.» ................ ⚠️ **NO SE MIDE AQUÍ**: es DOM, y    *
 *         vive entero en `test/edificio/aceptacion-f11.dom.test.js`. El § 4 de *
 *         este fichero comprueba que ese hermano sigue existiendo y que sigue  *
 *         llevando el criterio, para que no desaparezca en verde.              *
 *   AC2 · «Un DXF con N polilíneas produce N partes nombradas genéricamente,   *
 *         pendientes de plantas/tipo.» ......................... § 1           *
 *   AC3 · «La RC se deduce del centroide de la huella y es editable.»          *
 *         .......................... § 2 — **PARTIDO**: la mitad «se deduce»   *
 *         se mide aquí; «y es editable» es un campo de un formulario y se mide *
 *         en el hermano `.dom`. Queda dicho en los dos sitios.                 *
 *   AC4 · «El modelo respeta los convenios (piscina con plantas `null`;        *
 *         envolvente no almacenada).» .......................... § 3           *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * ⭐ EL AC4 NO LO CUMPLE F11: LO CUMPLE F00, Y ESO SE DICE CON FICHERO Y LÍNEA *
 * ════════════════════════════════════════════════════════════════════════════ *
 * `model/edificio.js:161-169` fuerza las plantas a `null` en las partes `OTRA` *
 * «aunque se pasen valores», y en `crearEdificio` no existe ningún campo de    *
 * envolvente. Las dos cosas tienen su `it` desde F00 en                        *
 * `test/model/edificio.test.js:72` (la piscina) y `:177` (la envolvente).      *
 * **F11 no ha escrito una línea para ese criterio** (desviación 1 del plan, y  *
 * desviación 2: `model/edificio.js` no se toca).                               *
 *                                                                              *
 * Lo que F11 le debe, y es lo que hace el § 3, es **re-atestarlo por las       *
 * CUATRO vías de entrada nuevas**: que un edificio venido de un DXF, de un     *
 * LIST/TXT, de un GML BU y del `wfsBU` sigue respetando los dos convenios.     *
 * Un invariante del modelo que solo se comprueba sobre POJOs escritos a mano   *
 * no dice nada de lo que produce la aplicación.                                *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * ⛔ DOS COSAS QUE LA FICHA DICE Y EL CÓDIGO **NO HACE**, A PROPÓSITO          *
 * ════════════════════════════════════════════════════════════════════════════ *
 * Un criterio de aceptación que se firma sin leerlo es un criterio que nadie   *
 * ha comprobado. Estos dos se cumplen en su INTENCIÓN y no en su letra, y las  *
 * dos desviaciones están declaradas en el plan **desde antes de escribir       *
 * código** (3 y la nota del AC3):                                              *
 *                                                                              *
 *   · **AC2 · «cada polilínea entra como una parte» no se aplica a la letra**  *
 *     (desviación 3). Medido: `UTM.dxf` da **25 partes**, dieciséis de ellas   *
 *     cajetín, marco y leyenda; y el propio fixture de edificio da **8**, una  *
 *     de ellas la parcela. Se lee la CAPA del dibujo y se OFRECE el reparto.   *
 *     El criterio se atesta **sobre la capa elegida**: 7 polilíneas en         *
 *     `Construccion` ⇒ 7 partes. Los dos números están medidos en el § 1.      *
 *   · **AC3 · la RC NO se deduce del centroide** (`edificio/entrada.js`,       *
 *     `puntoDeReferencia`). El motivo está MEDIDO y escrito en                 *
 *     `app/cableado-catastro.js:133-141`: el centroide aritmético de una       *
 *     figura en L cae **fuera** del polígono y el Catastro contesta entonces   *
 *     con la referencia de la parcela VECINA, en silencio. Y no es un caso de  *
 *     laboratorio: ⭐ **la parte más grande del fixture real de trece partes    *
 *     tiene su centroide aritmético FUERA de su propio contorno** (§ 2.1).     *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS CUATRO REGLAS QUE GOBIERNAN ESTE FICHERO                                 *
 * ════════════════════════════════════════════════════════════════════════════ *
 * 1. **SOBRE FICHEROS REALES.** El DXF es una descarga de Consulta Masiva      *
 *    (`test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf`, con *
 *    su ficha en `test/fixtures/parsers/PROCEDENCIA.md`), el GML y el WFS son  *
 *    de la parcela 9398516VK3799G y su piscina real. **No se fabrica un DXF**: *
 *    un fichero escrito por nosotros demuestra que sabemos leer lo que sabemos *
 *    escribir. La única geometría inventada de este fichero es la L del § 2.2, *
 *    y se declara como tal ahí mismo.                                          *
 * 2. **ORÁCULOS PROPIOS.** Las polilíneas por capa se cuentan con un lector de *
 *    pares de este fichero, ajeno a `parsers/dxf.js`; las superficies con una  *
 *    shoelace de cuatro líneas, ajena a `geo/area.js`; y «dentro del polígono» *
 *    con Turf, ajeno a `gml/anillos.js#puntoInterior`, que es justo la función *
 *    que se está juzgando. Preguntarle a un módulo si está de acuerdo consigo  *
 *    mismo no es un oráculo.                                                   *
 * 3. **NO SE DUPLICAN LAS UNITARIAS.** Cada `it` cita la frase del criterio a  *
 *    la que está atado. Lo que ya afirma un test de módulo se REMITE:          *
 *      · las tres fábricas caso a caso, el filtro `BLOQUEOS_SOLO_PARCELA` y    *
 *        los modos de fallo → `test/edificio/entrada.test.js`;                 *
 *      · el catálogo de detecciones y `nombreParteGenerico` →                  *
 *        `test/edificio/comun.test.js`;                                        *
 *      · las cuatro mutaciones del documento (`conModelo`, `conRefcat`,        *
 *        `conParteRenombrada`, `conAtributos`) →                               *
 *        `test/edificio/mutaciones.test.js`;                                   *
 *      · el modelo y sus invariantes → `test/model/edificio.test.js`;          *
 *      · el lector del dialecto BU → `test/gml/parse-bu.test.js`;              *
 *      · el panel nodo a nodo → `test/app/panel-edificio.dom.test.js`;         *
 *      · el cable de las cinco vías → `test/app/edificio.dom.test.js`.         *
 * 4. **CADA GUARDIÁN, CON SU MITAD ANTI-VACUIDAD.** Un `expect` que pasaría    *
 *    igual con el módulo roto no protege de nada (SPEC §3.1). Aquí se          *
 *    demuestra que el centroide falla de verdad ANTES de exigir que            *
 *    `puntoDeReferencia` acierte, y que el `Building` traía una huella de 52   *
 *    vértices ANTES de exigir que no esté guardada.                            *
 *                                                                              *
 * Proyecto Vitest `node`: ficheros, texto y POJOs. Ni DOM, ni red, ni reloj.   *
 * -------------------------------------------------------------------------- */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

import { MOTIVO_ENTRADA, TIPO_EDIFICIO, nombreParteGenerico } from '../../edificio/_comun.js'
import {
  VIA,
  entradaDesdeGmlBu,
  entradaDesdeTexto,
  entradaDesdeWfsBu,
  puntoDeReferencia,
} from '../../edificio/entrada.js'
import { conRefcat } from '../../edificio/mutaciones.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import {
  ATRIBUTOS_COMPLETO,
  MODELO_EDIFICIO,
  ORIGEN_PARTE,
  TIPO_PARTE,
  crearEdificio,
  crearParteConstruccion,
} from '../../model/edificio.js'

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Los ficheros reales y los tres oráculos propios
// ═════════════════════════════════════════════════════════════════════════════

const RAIZ = join(import.meta.dirname, '..', '..')

/** Un DXF del repo. Los DXF de este proyecto son ASCII de 8 bits (latin1). */
const leerDxf = (rel) => readFileSync(join(RAIZ, ...rel.split('/')), 'latin1')

/** Un XML del repo, decodificado con el encoding que él mismo declara. */
function leerXml(rel) {
  const bytes = readFileSync(join(RAIZ, ...rel.split('/')))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

/** La descarga real de Consulta Masiva. Ficha en `test/fixtures/parsers/PROCEDENCIA.md`. */
const DXF_EDIFICIO = leerDxf('test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf')
/** El plano de trabajo de F01: 25 polilíneas en 5 capas (medido en T0.2·3). */
const DXF_UTM = leerDxf('test/fixtures/parsers/UTM.dxf')
const TXT_LIST = leerDxf('test/fixtures/parsers/LIST.txt')
const TXT_COLUMNAS = leerDxf('test/fixtures/parsers/PARCELA.txt')

/** Las TRECE partes registradas de 9398516VK3799G. */
const GML_PARTES = leerXml('test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml')
/** El `Building` A SOLAS: su huella es la ENVOLVENTE INSPIRE (ver el § 3.5). */
const GML_BUILDING = leerXml('test/fixtures/gml/bu_building_9398516VK3799G.gml')
/** `GetAllConstructionByParcel`: el `Building` **y la piscina real**. */
const WFS_TODO = leerXml('test/fixtures/catastro/wfsbu-allconstruction-9398516VK3799G.xml')

/**
 * ORÁCULO 1 — cuántas polilíneas hay en cada capa del DXF, leído del código de
 * grupo 8 de cada `LWPOLYLINE`/`POLYLINE`. **Ajeno a `parsers/dxf.js`**: si el
 * parser se dejara una entidad, este oráculo la seguiría contando.
 *
 * ⚠️ Acotado a la sección `ENTITIES`. Sin acotar, `UTM.dxf` da 40 en vez de 25,
 * porque la sección `BLOCKS` trae las polilíneas del cajetín. Un oráculo más
 * generoso que el módulo al que vigila no vigila nada.
 */
function polilineasPorCapa(dxf) {
  const lineas = dxf.split(/\r?\n/).map((l) => l.trim())
  let ini = -1
  for (let i = 0; i + 3 < lineas.length; i += 1) {
    if (
      lineas[i] === '0' &&
      lineas[i + 1] === 'SECTION' &&
      lineas[i + 2] === '2' &&
      lineas[i + 3] === 'ENTITIES'
    ) {
      ini = i + 4
      break
    }
  }
  if (ini < 0) throw new Error('polilineasPorCapa: el fichero no tiene sección ENTITIES.')
  let fin = lineas.length
  for (let i = ini; i + 1 < lineas.length; i += 1) {
    if (lineas[i] === '0' && lineas[i + 1] === 'ENDSEC') {
      fin = i
      break
    }
  }

  const reparto = {}
  const cuerpo = lineas.slice(ini, fin)
  for (let i = 0; i + 1 < cuerpo.length; i += 1) {
    if (cuerpo[i] !== '0') continue
    if (cuerpo[i + 1] !== 'LWPOLYLINE' && cuerpo[i + 1] !== 'POLYLINE') continue
    for (let j = i + 2; j + 1 < cuerpo.length && cuerpo[j] !== '0'; j += 2) {
      if (cuerpo[j] === '8') {
        reparto[cuerpo[j + 1]] = (reparto[cuerpo[j + 1]] ?? 0) + 1
        break
      }
    }
  }
  return reparto
}

/**
 * ORÁCULO 2 — superficie de un anillo por la fórmula del cordón de zapato.
 * **Ajena a `geo/area.js`**, que es de quien depende `puntoDeReferencia` para
 * elegir la parte mayor. Cuatro líneas: el error de una y el de la otra no
 * pueden ser el mismo.
 */
function areaShoelace(vertices) {
  let doble = 0
  for (let i = 0; i < vertices.length; i += 1) {
    const [x1, y1] = vertices[i]
    const [x2, y2] = vertices[(i + 1) % vertices.length]
    doble += x1 * y2 - x2 * y1
  }
  return Math.abs(doble) / 2
}

/** ORÁCULO 3 — media aritmética de los vértices: el centroide que NO se usa. */
function centroideAritmetico(vertices) {
  let sx = 0
  let sy = 0
  for (const [x, y] of vertices) {
    sx += x
    sy += y
  }
  return [sx / vertices.length, sy / vertices.length]
}

/** Un anillo abierto como polígono de Turf (que los quiere cerrados). */
const poligono = (vertices) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] },
})

/** ¿Cae el punto estrictamente dentro del anillo? Lo decide Turf, no nosotros. */
const dentroDe = (punto, vertices) => booleanPointInPolygon(punto, poligono(vertices))

/** Los tipos de detección de una entrada. */
const tipos = (entrada) => entrada.detecciones.map((d) => d.tipo)

/** Las detecciones de un tipo concreto. */
const de = (entrada, tipo) => entrada.detecciones.filter((d) => d.tipo === tipo)

// ══════════════════════════════════════════════════════════════════════════════
// § 1 · AC2
// ══════════════════════════════════════════════════════════════════════════════
describe('AC2 · «Un DXF con N polilíneas produce N partes nombradas genéricamente, pendientes de plantas/tipo.»', () => {
  const REPARTO = polilineasPorCapa(DXF_EDIFICIO)
  const entrada = entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' })

  it('⭐ las N polilíneas de la capa elegida son N partes, y la N la cuenta el FICHERO', () => {
    // El oráculo lee el código de grupo 8 del DXF crudo; el módulo no interviene.
    // La ficha del fixture (`test/fixtures/parsers/PROCEDENCIA.md`) publica el
    // mismo reparto: `Construccion` 7 · `Parcela` 1.
    expect(REPARTO).toEqual({ Construccion: 7, Parcela: 1 })

    expect(entrada.edificio).not.toBeNull()
    expect(entrada.resumen.via).toBe(VIA.DXF)
    expect(entrada.resumen.nPartes).toBe(REPARTO.Construccion)
    expect(entrada.edificio.partes).toHaveLength(REPARTO.Construccion)
    // Y son 1:1 con las polilíneas: una parte por anillo, cada una con su capa.
    expect(entrada.resumen.capas).toEqual(Array(REPARTO.Construccion).fill('Construccion'))
    expect(entrada.resumen.nVertices).toHaveLength(REPARTO.Construccion)
  })

  it('cada parte trae SU contorno, y ninguna entra vacía', () => {
    // Anti-vacuidad de lo anterior: siete partes sin geometría también serían
    // «siete partes». Los vértices son los del fichero menos el cierre (regla de
    // oro 4: el modelo guarda los anillos ABIERTOS), o sea la tabla de la ficha
    // del fixture (25·5·5·9·7·13·5) con uno menos cada una.
    expect(entrada.resumen.nVertices).toEqual([24, 4, 4, 8, 6, 12, 4])
    for (const [i, parte] of entrada.edificio.partes.entries()) {
      expect(parte.recinto, `la parte ${i + 1} ha entrado sin contorno`).not.toBeNull()
      expect(parte.recinto.vertices.length).toBeGreaterThanOrEqual(3)
      expect(areaShoelace(parte.recinto.vertices)).toBeGreaterThan(0)
    }
    expect(de(entrada, TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA)).toHaveLength(0)
  })

  it('⭐ «nombradas genéricamente»: los nombres los pone `nombreParteGenerico`, no el dibujo', () => {
    const nombres = entrada.edificio.partes.map((p) => p.nombre)
    expect(nombres).toEqual(entrada.edificio.partes.map((_, i) => nombreParteGenerico(i)))
    expect(nombres).toEqual(['Parte 1', 'Parte 2', 'Parte 3', 'Parte 4', 'Parte 5', 'Parte 6', 'Parte 7'])
    // Sin repetidos: dos «Parte 1» en la misma lista son dos filas que el usuario
    // no puede distinguir al renombrar.
    expect(new Set(nombres).size).toBe(nombres.length)
    // Y NEUTROS: ni el nombre de la capa ni un uso adivinado. Un rótulo inventado
    // que acierta a veces se queda sin revisar (regla de oro 9).
    for (const nombre of nombres) {
      expect(nombre).toMatch(/^Parte \d+$/)
      expect(nombre.toLowerCase()).not.toContain('construccion')
    }
  })

  it('⭐ «pendientes de plantas/tipo»: el dibujo SÍ trae las plantas y F11 no las asigna', () => {
    // La mitad que hace del «pendientes» una decisión y no una carencia: el
    // fichero trae los rótulos de plantas en su capa `txtConstru` —`I`, `III`,
    // `III`, `II`, `I`, `P` (porche) e `I`, publicados en la ficha del fixture— y
    // esta fase NO los lee: las plantas y el tipo son F12 (desviación 5).
    expect(DXF_EDIFICIO).toContain('txtConstru')
    // Y no se pierden en silencio: el lector dice cuántas anotaciones ha ignorado.
    const anotaciones = entrada.detecciones.filter((d) => d.tipo === 'ENTIDAD_NO_SOPORTADA')
    expect(anotaciones).toHaveLength(1)
    expect(anotaciones[0].mensaje).toMatch(/TEXT/)

    for (const parte of entrada.edificio.partes) {
      expect(parte.plantasSobreRasante).toBeNull()
      expect(parte.plantasBajoRasante).toBeNull()
      expect(parte.tipo).toBe(TIPO_PARTE.PRINCIPAL)
      expect(parte.origen).toBe(ORIGEN_PARTE.DXF)
    }
  })

  it('⛔ aplicado A LA LETRA, el mismo fichero da 8 partes y `UTM.dxf` da 25 (desviación 3)', () => {
    // Es el motivo de que el criterio se atieste sobre la capa ELEGIDA. Sin
    // elegir, la parcela de contexto entra como si fuera un cuerpo del edificio;
    // y en un plano de trabajo de verdad entra el cajetín.
    const todoElFichero = entradaDesdeTexto(DXF_EDIFICIO)
    const totalPolilineas = Object.values(REPARTO).reduce((n, c) => n + c, 0)
    expect(todoElFichero.resumen.nPartes).toBe(totalPolilineas)
    expect(todoElFichero.resumen.nPartes).toBe(8)

    const plano = entradaDesdeTexto(DXF_UTM)
    expect(plano.resumen.nPartes).toBe(25)
    const repartoUtm = polilineasPorCapa(DXF_UTM)
    expect(repartoUtm).toEqual({ '0': 1, PARCELA: 3, LINDE: 4, BLANCO: 1, FINO: 16 })
    // Dieciséis de las veinticinco son cajetín, marco y leyenda (T0.2·3).
    expect(repartoUtm.FINO).toBe(16)
  })

  it('⭐ lo que se queda fuera se DICE, con el nombre LITERAL de la capa y su recuento', () => {
    // La otra mitad de la desviación 3: elegir capa descarta polilíneas, y un
    // descarte callado es un recuento de partes mal en silencio (regla de oro 1).
    const descartes = de(entrada, TIPO_EDIFICIO.CAPA_DXF_DESCARTADA)
    expect(descartes).toHaveLength(1)
    expect(descartes[0].mensaje).toContain('«Parcela»')
    expect(descartes[0].datos).toMatchObject({
      capa: 'Parcela',
      anillos: REPARTO.Parcela,
      capaElegida: 'Construccion',
      total: REPARTO.Parcela,
    })
    // El nombre viaja LITERAL, sin normalizar: es lo que el usuario ve en su CAD.
    expect(Object.keys(REPARTO)).toContain(descartes[0].datos.capa)
  })

  it('un DXF de edificio NO sale bloqueado, que es lo que hace posible todo lo anterior', () => {
    // El caso normal de esta rama —vivienda + porche + piscina— viene por
    // definición de varias capas y con superficie neta negativa si se lee como
    // parcela. El filtro que lo permite, y su mitad anti-vacuidad (que `importar`
    // SÍ lo bloquea), están en `test/edificio/entrada.test.js:211`.
    expect(entrada.resumen.bloqueos).toEqual([])
    expect(entrada.resumen.construido).toBe(true)
    for (const bloqueo of entrada.resumen.bloqueos) {
      expect(Object.values(MOTIVO_ENTRADA)).toContain(bloqueo)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 2 · AC3 — PARTIDO (ver la cabecera): aquí «se deduce»; «es editable» en el `.dom`
// ══════════════════════════════════════════════════════════════════════════════
describe('AC3 · «La RC se deduce del centroide de la huella y es editable.»', () => {
  const trecePartes = entradaDesdeGmlBu(GML_PARTES)

  it('⭐ ⛔ en el fixture REAL, el centroide de la huella mayor cae FUERA de ella', () => {
    // 2.1 · La medición que justifica no usar el centroide, y no es un caso de
    // laboratorio: es `9398516VK3799G_part10`, la parte de MAYOR superficie de
    // las trece que el Catastro tiene registradas en esta parcela.
    const areas = trecePartes.edificio.partes.map((p) => areaShoelace(p.recinto.vertices))
    const mayor = areas.indexOf(Math.max(...areas))
    const huella = trecePartes.edificio.partes[mayor].recinto.vertices

    expect(mayor).toBe(9)
    expect(huella).toHaveLength(35)
    expect(areas[mayor]).toBeCloseTo(245.9, 1)

    // MITAD ANTI-VACUIDAD: el centroide falla de verdad. Si esto dejara de ser
    // cierto, lo de abajo pasaría con cualquier implementación y no diría nada.
    expect(dentroDe(centroideAritmetico(huella), huella)).toBe(false)

    // Y lo que sí devuelve la aplicación cae DENTRO de esa misma huella.
    const punto = puntoDeReferencia(trecePartes.edificio)
    expect(punto).not.toBeNull()
    expect(dentroDe(punto, huella)).toBe(true)
  })

  it('⛔ con una parte en L, el centroide cae dentro de la VECINA: ése es el fallo silencioso', () => {
    // 2.2 · La única geometría inventada de este fichero, y se declara: una L de
    // 500 m² en UTM 30N y, ocupando su escotadura, la parcela de al lado (400 m²).
    // Es lo que `app/cableado-catastro.js:133-141` dejó MEDIDO para la rama de
    // parcela: el Catastro no tiene forma de saber que el punto no es del
    // edificio y contesta con la referencia de la vecina, tan tranquilo.
    const enL = [
      [440000, 4100000],
      [440030, 4100000],
      [440030, 4100010],
      [440010, 4100010],
      [440010, 4100030],
      [440000, 4100030],
    ]
    const laVecina = [
      [440010, 4100010],
      [440030, 4100010],
      [440030, 4100030],
      [440010, 4100030],
    ]
    expect(areaShoelace(enL)).toBe(500)
    expect(areaShoelace(laVecina)).toBe(400)

    const centroide = centroideAritmetico(enL)
    expect(dentroDe(centroide, enL)).toBe(false)
    // Lo que convierte el error en un dato malo con formato de dato bueno:
    expect(dentroDe(centroide, laVecina)).toBe(true)

    const edificio = crearEdificio({
      partes: [
        crearParteConstruccion({
          nombre: 'cuerpo en L',
          recinto: { vertices: enL, tipo: 'EXTERIOR' },
          origen: ORIGEN_PARTE.DIBUJADA,
        }),
      ],
    })
    const punto = puntoDeReferencia(edificio)
    expect(dentroDe(punto, enL)).toBe(true)
    expect(dentroDe(punto, laVecina)).toBe(false)
  })

  it('se deduce de LA HUELLA, y de la de mayor superficie: en el DXF real es la de 76,3 m²', () => {
    // «La RC se deduce del centroide de la huella» — la huella, no la primera
    // polilínea del fichero. La primera parte de un documento puede ser un
    // cobertizo de 4,6 m² pegado al lindero.
    const entrada = entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' })
    const areas = entrada.edificio.partes.map((p) => areaShoelace(p.recinto.vertices))
    const mayor = areas.indexOf(Math.max(...areas))
    expect(mayor).toBe(0)
    expect(areas[mayor]).toBeCloseTo(76.34, 2)
    expect(Math.min(...areas)).toBeCloseTo(4.56, 2)

    const punto = puntoDeReferencia(entrada.edificio)
    expect(dentroDe(punto, entrada.edificio.partes[mayor].recinto.vertices)).toBe(true)
    // Y no cae en ninguna de las pequeñas, que es de lo que se trata.
    const otras = entrada.edificio.partes.filter((_, i) => i !== mayor)
    expect(otras.some((p) => dentroDe(punto, p.recinto.vertices))).toBe(false)
  })

  it('sin huella no se inventa un punto: devuelve `null` y que decida el llamante', () => {
    // La deducción es opcional, y su ausencia tiene que ser distinguible de un
    // acierto. Los casos degenerados uno a uno están en
    // `test/edificio/entrada.test.js:886`.
    expect(puntoDeReferencia(crearEdificio({ partes: [] }))).toBeNull()
  })

  it('«y es editable» — la mitad del MODELO: `conRefcat` construye uno nuevo, sin normalizar', () => {
    // La mitad del FORMULARIO (`[data-campo="refcat-edificio"]`) se mide en
    // `test/edificio/aceptacion-f11.dom.test.js`; ésta es la del modelo, y es la
    // que garantiza que lo tecleado llega sin que nadie lo «arregle» por el
    // camino: corregir de oficio lo que el usuario escribe es la regla de oro 1
    // del revés.
    const deducida = crearEdificio({ refcat: '9398516VK3799G' })
    const { edificio, detecciones } = conRefcat(deducida, '3515508VF0831N ')

    expect(edificio).not.toBe(deducida)
    expect(edificio.refcat).toBe('3515508VF0831N ') // con su espacio: sin recortar
    expect(deducida.refcat).toBe('9398516VK3799G') // el anterior, intacto
    expect(detecciones).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 3 · AC4 — lo cumple F00; F11 lo re-atesta por las CUATRO vías (ver la cabecera)
// ══════════════════════════════════════════════════════════════════════════════
describe('AC4 · «El modelo respeta los convenios (piscina con plantas `null`; envolvente no almacenada).»', () => {
  /** Las claves que un `Edificio` SIMPLIFICADO tiene, y son todas las que tiene. */
  // `idLocal` la añade F12 · T1.1: sin identidad un Edificio no se puede
  // archivar ni autoguardar. Sigue siendo una lista EXHAUSTIVA, que es lo que
  // este guardián defiende: una clave nueva tiene que aparecer aquí a mano.
  const CLAVES_SIMPLIFICADO = [
    'idLocal',
    'refcat',
    'modelo',
    'partes',
    'parcelaContexto',
    'construccionOficial',
  ]

  /** Nombres con los que se podría colar una envolvente guardada. */
  const NOMBRES_DE_ENVOLVENTE = [
    'envolvente',
    'envelope',
    'geometria',
    'geometry',
    'contorno',
    'huella',
    'exterior',
    'union',
  ]

  /** Las CUATRO vías de entrada nuevas de F11, cada una sobre su fichero real. */
  const VIAS = () => [
    ['DXF', entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' }), ORIGEN_PARTE.DXF],
    ['LIST', entradaDesdeTexto(TXT_LIST), ORIGEN_PARTE.LIST],
    ['TXT', entradaDesdeTexto(TXT_COLUMNAS), ORIGEN_PARTE.TXT],
    ['GML_EXISTENTE', entradaDesdeGmlBu(GML_PARTES), ORIGEN_PARTE.GML_EXISTENTE],
    ['WFS', entradaDesdeWfsBu(parsearGmlBu(WFS_TODO)), ORIGEN_PARTE.WFS],
  ]

  it('el criterio lo cumple F00, y sigue cumpliéndolo: los DOS convenios, sobre el modelo', () => {
    // 3.1 · Re-atestación directa de lo que `model/edificio.js:161-169` promete y
    // `test/model/edificio.test.js:72` y `:177` ya comprueban desde F00. Se repite
    // aquí, y solo aquí, porque un criterio de aceptación que se remite entero a
    // otro fichero es un criterio que esta suite no ha comprobado.
    const piscina = crearParteConstruccion({
      nombre: 'piscina',
      tipo: TIPO_PARTE.OTRA,
      recinto: { vertices: [[440000, 4100000], [440008, 4100000], [440008, 4100004]], tipo: 'EXTERIOR' },
      // Aunque se pasen plantas —y aquí se pasan a propósito—:
      plantasSobreRasante: 1,
      plantasBajoRasante: 0,
      origen: ORIGEN_PARTE.DIBUJADA,
    })
    expect(piscina.plantasSobreRasante).toBeNull()
    expect(piscina.plantasBajoRasante).toBeNull()
    expect(piscina.plantasBajoRasante).not.toBe(0) // `null`, nunca `0`

    const edificio = crearEdificio({ modelo: MODELO_EDIFICIO.COMPLETO, partes: [piscina] })
    for (const prohibida of NOMBRES_DE_ENVOLVENTE) expect(prohibida in edificio).toBe(false)
    // Las plantas van por PARTE, nunca por edificio (mismo convenio, otra cara).
    expect('plantasSobreRasante' in edificio).toBe(false)
    expect('plantasBajoRasante' in edificio).toBe(false)
  })

  it('⭐ las CUATRO vías producen un Edificio con las claves del modelo y ni una más', () => {
    // 3.2 · Lo que F11 le debe al criterio: que lo que la aplicación FABRICA
    // respete los convenios, y no solo lo que se escribe a mano en un test.
    for (const [quien, entrada, origen] of VIAS()) {
      expect(entrada.edificio, `la vía ${quien} no ha construido edificio`).not.toBeNull()
      expect(Object.keys(entrada.edificio).sort(), `claves de la vía ${quien}`).toEqual(
        [...CLAVES_SIMPLIFICADO].sort(),
      )
      for (const prohibida of NOMBRES_DE_ENVOLVENTE) {
        expect(prohibida in entrada.edificio, `la vía ${quien} guarda '${prohibida}'`).toBe(false)
      }
      // ⛔ **F12 · fase 5: las plantas ya no son `null` en las cinco vías.** Esto
      // exigía `null` en todas y era cierto en F11, que las tiraba por alcance. Lo
      // que se puede exigir ahora es lo que de verdad promete el modelo: que el
      // campo EXISTA y sea `null` o un entero no negativo. Los DXF/LIST/TXT no
      // traen plantas —un volcado de CAD no las declara— y siguen entrando a
      // `null`; el dialecto BU las trae y ahora entran.
      //
      // ⚠️ **La vía WFS tampoco las trae, y MEDIRLO corrigió esta prueba.** Su
      // fixture (`wfsbu-allconstruction-…`) tiene **cero `BuildingPart` y una
      // `OtherConstruction`**: es la PISCINA, y una piscina no declara
      // `numberOfFloors*` ni debe. Dar por hecho que las dos vías del BU traen
      // plantas era una inferencia; el fichero real dice otra cosa.
      const traeLasPlantas = quien === 'GML_EXISTENTE'
      for (const parte of entrada.edificio.partes) {
        expect(parte.origen, `origen de la vía ${quien}`).toBe(origen)
        for (const campo of ['plantasSobreRasante', 'plantasBajoRasante']) {
          const v = parte[campo]
          expect(
            v === null || (Number.isInteger(v) && v >= 0),
            `${campo} de la vía ${quien}: ${JSON.stringify(v)}`,
          ).toBe(true)
        }
        if (!traeLasPlantas) {
          expect(parte.plantasSobreRasante, `plantas de la vía ${quien}`).toBeNull()
          expect(parte.plantasBajoRasante, `plantas de la vía ${quien}`).toBeNull()
        }
        // Y ninguna parte guarda una envolvente propia por la puerta de atrás.
        expect(Object.keys(parte).sort()).toEqual(
          ['nombre', 'tipo', 'recinto', 'plantasSobreRasante', 'plantasBajoRasante', 'origen'].sort(),
        )
      }
      // ⭐ MITAD ANTI-VACUIDAD: si el lector dejara de traerlas, la comprobación de
      // arriba pasaría igual (`null` es válido). Las dos vías del BU tienen que
      // traer alguna de verdad.
      if (traeLasPlantas) {
        expect(
          entrada.edificio.partes.some((p) => p.plantasSobreRasante !== null),
          `la vía ${quien} no ha traído ni una planta`,
        ).toBe(true)
      }
    }
  })

  it('⭐ la PISCINA real entra por el WFS, con plantas `null`, y se dice que su tipo es forzado', () => {
    // 3.3 · El ejemplar real del convenio: `OtherConstruction` con
    // `constructionNature = openAirPool`, en la parcela de referencia. En F11
    // toda parte nace `PRINCIPAL` (desviación 5), lo cual para una piscina es un
    // dato que se sabe provisional: entra, porque tirarla sería peor, y LO DICE.
    const entrada = entradaDesdeWfsBu(parsearGmlBu(WFS_TODO))
    expect(entrada.resumen.via).toBe(VIA.WFS)
    expect(entrada.edificio.partes).toHaveLength(1)

    const piscina = entrada.edificio.partes[0]
    expect(piscina.plantasSobreRasante).toBeNull()
    expect(piscina.plantasBajoRasante).toBeNull()
    expect(piscina.recinto.vertices).toHaveLength(18)

    const forzados = de(entrada, TIPO_EDIFICIO.TIPO_PARTE_FORZADO)
    expect(forzados).toHaveLength(1)
    expect(forzados[0].mensaje).toContain('openAirPool')
    expect(forzados[0].datos.construcciones[0]).toMatchObject({
      constructionNature: 'openAirPool',
      parte: 0,
    })

    // Y cuando F12 le ponga su tipo, el convenio sigue sujetando: `OTRA` anula
    // las plantas aunque se le pasen. Es el mismo invariante de F00, aplicado a
    // la geometría que de verdad ha entrado por el servicio.
    const conTipo = crearParteConstruccion({
      ...piscina,
      tipo: TIPO_PARTE.OTRA,
      plantasSobreRasante: 1,
      plantasBajoRasante: 1,
    })
    expect(conTipo.plantasSobreRasante).toBeNull()
    expect(conTipo.plantasBajoRasante).toBeNull()
  })

  it('⭐ la ENVOLVENTE del `Building` NO se guarda: ni como parte, ni como oficial, y se dice', () => {
    // 3.4 · La otra mitad del convenio, sobre el documento que trae las dos cosas
    // a la vez. Guardar la huella del `Building` sería guardar la envolvente con
    // otro nombre y contar su superficie DOS veces: en INSPIRE esa huella es la
    // unión de las partes.
    const entrada = entradaDesdeWfsBu(parsearGmlBu(WFS_TODO))

    // MITAD ANTI-VACUIDAD: el documento SÍ traía esa huella, y grande. Se lee del
    // XML crudo, sin pasar por `gml/parse-bu.js`, que es el módulo que decide
    // descartarla: 2 `posList` de 5 y 53 pares (cerrados) en el `Building`.
    const posLists = [...WFS_TODO.matchAll(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/g)].map(
      (m) => m[1].trim().split(/\s+/).filter(Boolean).length / 2,
    )
    expect(posLists).toEqual([5, 53, 19])

    // Y lo que se ha guardado son 18 vértices: solo la piscina.
    const guardados = entrada.edificio.partes.map((p) => p.recinto.vertices.length)
    expect(guardados).toEqual([18])
    expect(guardados).not.toContain(52)
    expect(entrada.edificio.construccionOficial).toHaveLength(1)
    expect(entrada.edificio.construccionOficial[0].recinto.vertices).toHaveLength(18)

    // Descartarla no es callarla (regla de oro 1): se dice qué se ha dejado fuera
    // y por qué, nombrando la envolvente.
    const dicho = de(entrada, TIPO_EDIFICIO.PATCHES_MULTIPLES)
    expect(dicho.length).toBeGreaterThan(0)
    expect(dicho.some((d) => d.mensaje.toLowerCase().includes('envolvente'))).toBe(true)
  })

  it('⭐ ⛔ el `Building` A SOLAS no produce ni una parte: bloquea y nombra qué falta', () => {
    // 3.5 · El mismo convenio, en su forma más visible: un documento cuya ÚNICA
    // geometría es la envolvente no da edificio. Es el comportamiento correcto
    // —guardarla rompería el criterio— y por eso este `it` está en el AC4 y no
    // en el catálogo de bloqueos.
    const entrada = entradaDesdeGmlBu(GML_BUILDING)
    expect(entrada.edificio).toBeNull()
    expect(entrada.resumen.nPartes).toBe(0)
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.SIN_CONSTRUCCION])
    expect(entrada.resumen.construido).toBe(false)
    // Y el bloqueo no deja al usuario a oscuras: dice qué consulta trae lo que
    // falta (la lección de F08: un fichero ajeno nunca lanza, se explica).
    expect(entrada.detecciones.map((d) => d.mensaje).join(' ')).toContain(
      'GetBuildingPartByParcel',
    )
  })

  it('⛔ una parte SOLO bajo rasante contradice el convenio de la ficha, y entra DICHA', () => {
    // 3.6 · Regla de oro 8, manda el dato: `9398516VK3799G_part10` declara 0
    // plantas sobre rasante y 1 bajo (desviación 10 del plan). La ficha escribe
    // «solo partes con volumen sobre rasante»; el fichero REAL del Catastro trae
    // una que no lo cumple. Entra con su contorno —es la geometría oficial contra
    // la que luego se contrasta— y la excepción se declara en voz alta.
    const entrada = entradaDesdeGmlBu(GML_PARTES)
    const avisos = de(entrada, TIPO_EDIFICIO.PARTE_BAJO_RASANTE)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].datos.partes[0]).toMatchObject({ localId: '9398516VK3799G_part10', indice: 9 })
    expect(entrada.edificio.partes[9].recinto.vertices).toHaveLength(35)
    expect(tipos(entrada)).toContain(TIPO_EDIFICIO.PLANTAS_DESCARTADAS)
    // ⛔ **F12 · fase 5: esto exigía `null` y ahora exige el dato.** En F11 las
    // plantas se tiraban por alcance y este `null` lo atestaba; ahora entran, y lo
    // que hay que poder afirmar es que **la parte que el fichero declara sótano se
    // guarda COMO SÓTANO** —0 arriba, 1 abajo— y no corregida a algo plausible.
    // Es además la parte MAYOR del edificio (245,90 m² de 568,03), así que de este
    // par de números depende que la envolvente derivada sea la buena.
    expect(entrada.edificio.partes[9].plantasSobreRasante).toBe(0)
    expect(entrada.edificio.partes[9].plantasBajoRasante).toBe(1)
  })

  it('en SIMPLIFICADO los siete atributos semánticos ni existen ni se serializan', () => {
    // 3.7 · El convenio que sostiene además el AC1: en el modelo del ICUC esas
    // claves NO están (no están a `null`: no están), así que «ocultarlas» en la
    // interfaz no es maquillaje. La cara de DOM de esto es el `.dom` hermano.
    for (const [quien, entrada] of VIAS()) {
      expect(entrada.edificio.modelo, `modelo de la vía ${quien}`).toBe(
        MODELO_EDIFICIO.SIMPLIFICADO,
      )
      for (const clave of ATRIBUTOS_COMPLETO) {
        expect(clave in entrada.edificio, `la vía ${quien} guarda '${clave}'`).toBe(false)
      }
    }
    // Anti-vacuidad: la lista de atributos no está vacía.
    expect(ATRIBUTOS_COMPLETO.length).toBe(7)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 4 · AC1 — TRASLADADO al `.dom`, no dado por bueno
// ══════════════════════════════════════════════════════════════════════════════
describe('AC1 · «El selector oculta los atributos semánticos en modo simplificado.»', () => {
  const HERMANO = join(RAIZ, 'test', 'edificio', 'aceptacion-f11.dom.test.js')

  it('⛔ se mide en el `.dom` hermano, y este `it` comprueba que ese fichero sigue ahí', () => {
    // No mide el criterio: mide que el criterio tenga dónde medirse. La partición
    // `node`/`dom` la decide SOLO el sufijo del nombre del fichero, así que un
    // renombrado descuidado dejaría el AC1 sin ninguna prueba **y la suite en
    // verde**. Mismo recurso que el AC3 de F10 con su checklist humano.
    expect(existsSync(HERMANO)).toBe(true)
    const fuente = readFileSync(HERMANO, 'utf8')
    expect(fuente).toContain(
      'El selector oculta los atributos semánticos en modo simplificado.',
    )
    expect(fuente).toContain('SELECTOR_COMPLETO')
  })
})
