/* -------------------------------------------------------------------------- *
 * test/export/dxf.test.js — F10 · T2.2 · el DXF para el CAD                   *
 *                                                                            *
 * ⚠️ LO PRIMERO, PORQUE CAMBIA CÓMO HAY QUE LEER ESTE FICHERO:                *
 * **Nuestro propio parser NO es el oráculo de este módulo.** Se midió en la   *
 * fase 0 de F10: un DXF escrito exactamente como manda el override O12 —sin   *
 * los marcadores de subclase— hace que `ezdxf` lance `DXFStructureError` y no *
 * abra el fichero, y `parsers/dxf.js` lo lee tan feliz, con la ida y vuelta   *
 * exacta y cero detecciones. Una suite que solo se preguntara a sí misma      *
 * habría dado por bueno un fichero que no abre en ninguna parte.              *
 *                                                                            *
 * De ahí el reparto de este fichero:                                          *
 *   · el ORÁCULO EXTERNO es `ezdxf` (1.4.4), y corre FUERA de la suite —es    *
 *     Python—: su veredicto está anotado en el plan de la fase y se repite    *
 *     a mano cuando se toca el escritor. Aquí, en su lugar, se afirma lo que  *
 *     ezdxf necesita, comprobándolo sobre los BYTES emitidos: los dos `100`,  *
 *     el handle de la cabecera de la tabla, y —sobre todo— que las capas      *
 *     ESTÁN EN LA TABLA;                                                      *
 *   · `parsers/dxf.js` entra como SEGUNDO oráculo, para la ida y vuelta de la *
 *     geometría, que es lo que sí sabe juzgar.                                *
 *                                                                            *
 * ⭐ La prueba más importante del fichero es «las capas existen en la TABLA».  *
 * Sin la sección TABLES, ezdxf abre el fichero, ve las polilíneas y audita    *
 * 0 errores y 0 arreglos — y las capas no existen. El criterio 3 entero       *
 * («abre en CAD con las dos capas separadas») fallaría mudo.                  *
 *                                                                            *
 * ── ⛔ 2026-08-05: EL ORÁCULO EXTERNO TAMPOCO BASTABA ──                      *
 * Un usuario abrió en ZWCAD 2023 el DXF que esta suite daba por bueno y el    *
 * programa se quedó en blanco y bloqueado: declarábamos `AC1015` (R2000) sin  *
 * emitir NADA de lo que R2000 exige. **ezdxf daba verde** porque rellena por  *
 * su cuenta las tablas que faltan al cargar, así que jamás se entera. La      *
 * salida es ahora R12, que es la versión que este módulo puede cumplir        *
 * entera, y de aquel agujero queda aquí una prueba: «la versión declarada es  *
 * la que el fichero CUMPLE». No se sostiene sola —esto lo destapó una         *
 * persona, no una máquina—, pero impide que vuelva a colarse en silencio.     *
 *                                                                            *
 * ── LA SNAPSHOT VA EN CRLF, Y ESO NO ES GRATIS ──                            *
 * El escritor emite CRLF por fidelidad a los tres DXF reales del repo. Para   *
 * que un clon limpio en otra plataforma no reciba la snapshot con LF —y la    *
 * prueba se ponga roja sin que nadie haya tocado nada, que es el defecto que  *
 * F09 encontró en `cp_parcela_9398516VK3799G.gml`—, `.gitattributes` fija     *
 * `test/export/__snapshots__/*.dxf text eol=crlf`. Hay una prueba que lo      *
 * comprueba leyendo el propio `.gitattributes`.                               *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { DECIMALES_COORD } from '../../gml/anillos.js'
import { SEVERIDAD, TIPO_EXPORT } from '../../export/_comun.js'
import { ACADVER, CAPAS, NL, serializarParcelaDxf } from '../../export/dxf.js'
import { parseDXF } from '../../parsers/dxf.js'

// ── Utillaje ────────────────────────────────────────────────────────────────

/** Un cuadrado de `lado` metros en UTM 30N realista, anillo ABIERTO. */
const cuadrado = (lado, dx = 0, dy = 0) => [
  [440123.45 + dx, 4470987.65 + dy],
  [440123.45 + dx + lado, 4470987.65 + dy],
  [440123.45 + dx + lado, 4470987.65 + dy + lado],
  [440123.45 + dx, 4470987.65 + dy + lado],
]

const recinto = (vertices, tipo = 'EXTERIOR') => ({ vertices, tipo })

/**
 * Lector mínimo de pares (código, valor). NO se usa `parsers/dxf.js` para esto a
 * propósito: aquel solo mira la sección ENTITIES, y justo lo que hay que auditar
 * aquí es lo que él NO mira.
 */
function pares(dxf) {
  const lineas = dxf.split(/\r\n/)
  const out = []
  for (let i = 0; i + 1 < lineas.length; i += 2) out.push([lineas[i].trim(), lineas[i + 1]])
  return out
}

/** Los nombres de capa declarados en la TABLA LAYER (no los que nombran las entidades). */
function capasDeLaTabla(dxf) {
  const p = pares(dxf)
  const nombres = []
  let enTabla = false
  let enRegistro = false
  for (const [c, v] of p) {
    const val = (v ?? '').trim()
    if (c === '2' && val === 'LAYER' && !enTabla) enTabla = true
    else if (c === '0' && val === 'ENDTAB') enTabla = false
    else if (enTabla && c === '0') enRegistro = val === 'LAYER'
    else if (enTabla && enRegistro && c === '2') {
      nombres.push(val)
      enRegistro = false
    }
  }
  return nombres
}

/** Todas las capas que NOMBRAN las entidades de ENTITIES. */
function capasDeLasEntidades(dxf) {
  const p = pares(dxf)
  const usadas = new Set()
  let enEntidades = false
  for (const [c, v] of p) {
    const val = (v ?? '').trim()
    if (c === '2' && val === 'ENTITIES') enEntidades = true
    else if (c === '0' && val === 'ENDSEC') enEntidades = false
    else if (enEntidades && c === '8') usadas.add(val)
  }
  return usadas
}

/**
 * Las entidades de la sección ENTITIES, en orden, con sus group codes.
 *
 * Hace falta desde que la salida es R12: un contorno ya no es UNA entidad, son
 * `POLYLINE` + N `VERTEX` + `SEQEND`, y lo que hay que auditar es justo la
 * secuencia.
 */
function entidades(dxf) {
  const p = pares(dxf)
  const out = []
  let dentro = false
  for (const [c, v] of p) {
    const val = (v ?? '').trim()
    if (c === '2' && val === 'ENTITIES') dentro = true
    else if (c === '0' && val === 'ENDSEC') dentro = false
    else if (dentro && c === '0') out.push({ tipo: val, grupos: [] })
    else if (dentro && out.length > 0) out[out.length - 1].grupos.push([c, val])
  }
  return out
}

/** Los tipos de línea declarados en la TABLA LTYPE. */
function ltypesDeLaTabla(dxf) {
  const p = pares(dxf)
  const nombres = []
  let enTabla = false
  let enRegistro = false
  for (const [c, v] of p) {
    const val = (v ?? '').trim()
    if (c === '2' && val === 'LTYPE' && !enTabla) enTabla = true
    else if (c === '0' && val === 'ENDTAB') enTabla = false
    else if (enTabla && c === '0') enRegistro = val === 'LTYPE'
    else if (enTabla && enRegistro && c === '2') {
      nombres.push(val)
      enRegistro = false
    }
  }
  return nombres
}

/** Las secciones del fichero, en orden. */
function secciones(dxf) {
  const p = pares(dxf)
  const out = []
  for (let i = 0; i < p.length; i++) {
    if (p[i][0] === '0' && p[i][1].trim() === 'SECTION' && p[i + 1]?.[0] === '2') {
      out.push(p[i + 1][1].trim())
    }
  }
  return out
}

/** El DXF de referencia del fichero: dos capas, un contorno en cada una. */
const dosCapas = () =>
  serializarParcelaDxf({
    recintosEditados: [recinto(cuadrado(40, 1.67))],
    recintosOficiales: [recinto(cuadrado(40))],
  })

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ Lo que el override O12 no decía, y sin lo cual el fichero no abre
// ═════════════════════════════════════════════════════════════════════════════

describe('export/dxf · lo imprescindible, medido con ezdxf y con un CAD de verdad', () => {
  it('cada contorno sale como POLYLINE → VERTEX… → SEQEND, con la capa en las TRES', () => {
    // R12 no tiene LWPOLYLINE. `66=1` («detrás vienen VERTEX») es obligatorio: sin
    // él la cabecera queda huérfana y los VERTEX pasan a ser entidades sueltas.
    // Y la capa se repite en cada VERTEX y en el SEQEND porque así la etiquetan los
    // ficheros del Catastro y así la lee `parsers/dxf.js` (ver su cabecera).
    const { dxf } = dosCapas()
    const ents = entidades(dxf)
    const lado = 4 // vértices de `cuadrado()`

    expect(ents.map((e) => e.tipo)).toEqual([
      'POLYLINE', ...Array(lado).fill('VERTEX'), 'SEQEND',
      'POLYLINE', ...Array(lado).fill('VERTEX'), 'SEQEND',
    ])

    const cabeceras = ents.filter((e) => e.tipo === 'POLYLINE')
    expect(cabeceras).toHaveLength(2) // anti-vacuidad: sin esto lo de abajo no prueba nada
    for (const cab of cabeceras) {
      const g = cab.grupos.map(([c, v]) => `${c}=${v}`)
      expect(g, 'sin 66=1 los VERTEX se sueltan de su polilínea').toContain('66=1')
      expect(g, 'sin 70=1 el contorno sale abierto').toContain('70=1')
    }

    // Cada tramo POLYLINE…SEQEND habla de una sola capa.
    let capaEnCurso = null
    for (const e of ents) {
      const capa = e.grupos.find(([c]) => c === '8')?.[1]
      if (e.tipo === 'POLYLINE') capaEnCurso = capa
      expect(capa, `la entidad ${e.tipo} va sin capa`).toBe(capaEnCurso)
    }
  })

  it('⚠️ no queda ni un marcador de subclase `100`: eso es vocabulario de R2000', () => {
    // Emitir `100=AcDbEntity` en un fichero que dice ser R12 es la misma mentira que
    // nos colgó ZWCAD, del revés. Los `100` fueron imprescindibles mientras la salida
    // era AC1015; ahora sobran, y dejarlos «por si acaso» sería contradecir la
    // versión que el fichero declara.
    const { dxf } = dosCapas()
    expect(pares(dxf).some(([c]) => c === '100')).toBe(false)
    expect(dxf).not.toContain('LWPOLYLINE')
  })

  it('⭐ las dos capas ESTÁN EN LA TABLA, no solo nombradas por las entidades', () => {
    // LA prueba del criterio 3. Sin la sección TABLES, ezdxf lee el fichero, ve las
    // polilíneas y el auditor da 0 errores y 0 arreglos — y las capas no existen.
    // Comprobar que las entidades las NOMBRAN no distingue los dos casos.
    const { dxf } = dosCapas()

    expect(capasDeLaTabla(dxf)).toEqual(['0', CAPAS.OFICIAL.nombre, CAPAS.EDITADA.nombre])
    expect(capasDeLasEntidades(dxf)).toEqual(new Set([CAPAS.OFICIAL.nombre, CAPAS.EDITADA.nombre]))

    // Y toda capa que una entidad nombre tiene que estar declarada. Es el
    // invariante, no la coincidencia de este caso.
    for (const usada of capasDeLasEntidades(dxf)) {
      expect(capasDeLaTabla(dxf)).toContain(usada)
    }
  })

  it('la capa oficial se declara AUNQUE esté vacía: una capa ausente se lee como un olvido', () => {
    const { dxf, capas } = serializarParcelaDxf({ recintosEditados: [recinto(cuadrado(40))] })
    expect(capasDeLaTabla(dxf)).toContain(CAPAS.OFICIAL.nombre)
    expect(capas.find((c) => c.nombre === CAPAS.OFICIAL.nombre).entidades).toBe(0)
  })

  it('⭐ ninguna referencia apunta fuera del fichero, tampoco POR NOMBRE', () => {
    // La regla que este módulo se impuso en F10 era «ningún handle colgando», y aun
    // así dejaba colgar `6=CONTINUOUS`, confiando en que el CAD lo trajera. Después
    // de que un hueco estructural bloqueara ZWCAD, «esto lo traerá el lector» dejó
    // de valer: el tipo de línea se declara en su tabla.
    const { dxf } = dosCapas()
    const p = pares(dxf)

    const usados = p.filter(([c]) => c === '6').map(([, v]) => v.trim())
    expect(usados.length).toBeGreaterThan(0) // anti-vacuidad
    for (const nombre of usados) expect(ltypesDeLaTabla(dxf)).toContain(nombre)
  })

  it('R12 no tiene handles, y eso borra una CLASE de defecto en vez de vigilarla', () => {
    // Sin `5`, sin `330` y sin `390` no hay grafo de propietarios que pueda quedar
    // roto, ni `$HANDSEED` que pueda ir por detrás de los handles usados. Es la
    // mitad de la razón por la que se eligió R12 sobre el R2000 completo: la otra
    // mitad es que un R2000 correcto son ~18 kB que ningún oráculo nuestro juzga.
    const { dxf } = dosCapas()
    const p = pares(dxf)
    for (const codigo of ['5', '330', '390']) {
      expect(p.some(([c]) => c === codigo), `sobra el código de grupo ${codigo}`).toBe(false)
    }
    expect(dxf).not.toContain('$HANDSEED')
  })

  it('las secciones van en el orden del formato y el fichero acaba en EOF', () => {
    const { dxf } = dosCapas()
    expect(secciones(dxf)).toEqual(['HEADER', 'TABLES', 'ENTITIES'])
    expect(dxf.endsWith(`0${NL}EOF${NL}`)).toBe(true)
  })

  it('⭐ la versión que se DECLARA es la que el fichero CUMPLE', () => {
    // ⛔ LA PRUEBA DEL DEFECTO DE ZWCAD. Emitíamos `AC1015` (R2000) con la estructura
    // de un R12, y R2000 exige un esqueleto entero: `CLASSES`, la tabla
    // `BLOCK_RECORD`, `BLOCKS` con `*Model_Space` —quien POSEE a las entidades— y
    // `OBJECTS` con el diccionario raíz. Un lector estricto aplica las reglas de la
    // versión declarada y se queda sin suelo: ZWCAD 2023 se quedó en blanco y
    // bloqueado. ezdxf no lo veía porque rellena por su cuenta lo que falta.
    //
    // Esto no se afirma como «la versión es AC1009», que sería fijar una constante:
    // se afirma la REGLA, así que subir la versión sin traer el esqueleto pone la
    // prueba en rojo, que es exactamente lo que no pasó en su día.
    const { dxf } = dosCapas()
    expect(dxf).toContain(`9${NL}$ACADVER${NL}1${NL}${ACADVER}`)

    const numero = Number.parseInt(ACADVER.slice(2), 10)
    const PRIMERA_CON_ESQUELETO = 1012 // R13: es donde nacen los handles y OBJECTS
    if (numero >= PRIMERA_CON_ESQUELETO) {
      expect(secciones(dxf), `${ACADVER} exige CLASSES/BLOCKS/OBJECTS`).toEqual(
        expect.arrayContaining(['CLASSES', 'BLOCKS', 'OBJECTS']),
      )
      expect(dxf).toContain('BLOCK_RECORD')
      expect(dxf.toUpperCase()).toContain('*MODEL_SPACE')
    } else {
      // Y al revés: si somos R12, no se emite vocabulario de R2000 que prometa lo
      // que no hay. `$INSUNITS` («metros») es de R2000 y desaparece con él; las
      // coordenadas son UTM absolutas, así que no queda ninguna escala ambigua.
      expect(secciones(dxf)).toEqual(['HEADER', 'TABLES', 'ENTITIES'])
      expect(dxf).not.toContain('$INSUNITS')
    }
  })

  it('⭐ la cabecera declara las extents, o la parcela abre fuera de la pantalla', () => {
    // El SEGUNDO problema del caso de ZWCAD, independiente del primero: sin
    // `$EXTMIN`/`$EXTMAX` la vista abre en el 0,0 y una parcela en UTM está a 4,4
    // millones de unidades de ahí. El fichero está sano y la pantalla, en blanco.
    const { dxf } = dosCapas()
    const p = pares(dxf)
    const valorTras = (nombre) => {
      const i = p.findIndex(([, v]) => (v ?? '').trim() === nombre)
      expect(i, `falta ${nombre} en la cabecera`).toBeGreaterThan(-1)
      return [Number.parseFloat(p[i + 1][1]), Number.parseFloat(p[i + 2][1])]
    }
    const [minX, minY] = valorTras('$EXTMIN')
    const [maxX, maxY] = valorTras('$EXTMAX')

    // Y describen la geometría EMITIDA, no una caja cualquiera. Los vértices se
    // sacan por `entidades()` y NO filtrando los códigos 10/20 del fichero entero:
    // la propia cabecera usa esos mismos códigos y se colaría en el mínimo.
    const vertices = entidades(dxf)
      .filter((e) => e.tipo === 'VERTEX')
      .map((e) => [
        Number.parseFloat(e.grupos.find(([c]) => c === '10')[1]),
        Number.parseFloat(e.grupos.find(([c]) => c === '20')[1]),
      ])
    expect(vertices.length).toBeGreaterThan(0) // anti-vacuidad

    expect(minX).toBe(Math.min(...vertices.map((v) => v[0])))
    expect(maxX).toBe(Math.max(...vertices.map((v) => v[0])))
    expect(minY).toBe(Math.min(...vertices.map((v) => v[1])))
    expect(maxY).toBe(Math.max(...vertices.map((v) => v[1])))
    expect(maxX).toBeGreaterThan(minX) // una caja de área cero pasaría lo de arriba
  })

  it('sin geometría NO se inventan extents: mandarían la vista a un sitio vacío', () => {
    const { dxf } = serializarParcelaDxf({ recintosEditados: [], recintosOficiales: [] })
    expect(dxf).not.toContain('$EXTMIN')
    expect(dxf).not.toContain('$EXTMAX')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · La ida y vuelta contra `parsers/dxf.js` — el segundo oráculo
// ═════════════════════════════════════════════════════════════════════════════

describe('export/dxf · ida y vuelta contra el lector de F01', () => {
  it('lo que se escribe se relee con las MISMAS coordenadas y sin detecciones', () => {
    const editada = cuadrado(40, 1.67)
    const oficial = cuadrado(40)
    const { dxf } = serializarParcelaDxf({
      recintosEditados: [recinto(editada)],
      recintosOficiales: [recinto(oficial)],
    })

    const leido = parseDXF(dxf)
    expect(leido.anillos).toHaveLength(2)
    expect(leido.detecciones).toEqual([]) // ni un arco, ni una Z, ni una entidad rara
    // El orden de ENTITIES es oficial → editada.
    expect(leido.anillos[0]).toEqual(oficial)
    expect(leido.anillos[1]).toEqual(editada)
  })

  it('el lector estrena por fin un fichero que no ha escrito AutoCAD', () => {
    // `parsers/dxf.js` es de F01 y sigue sin llamante en producción. Esta prueba es,
    // hasta que F01 se cablee, el único sitio del proyecto donde el lector y el
    // escritor se miran a la cara.
    const { dxf } = dosCapas()
    expect(() => parseDXF(dxf)).not.toThrow()
    expect(parseDXF(dxf).origen).toBe('DXF')
  })

  it('un hueco vuelve como un anillo más: el formato no distingue, y por eso se declara', () => {
    const { dxf, detecciones } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40)), recinto(cuadrado(10, 10, 10), 'HUECO')],
      recintosOficiales: [recinto(cuadrado(40))],
    })
    expect(parseDXF(dxf).anillos).toHaveLength(3) // 1 oficial + exterior + hueco
    const hueco = detecciones.find((d) => d.tipo === TIPO_EXPORT.HUECO_EXPORTADO)
    expect(hueco).toBeDefined()
    expect(hueco.severidad).toBe(SEVERIDAD.AVISO)
    expect(hueco.mensaje).toMatch(/no tiene el concepto de hueco/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Las coordenadas: UTM crudo, y el MISMO redondeo que el GML
// ═════════════════════════════════════════════════════════════════════════════

describe('export/dxf · coordenadas', () => {
  it('van en UTM sin transformar y con la precisión del GML, no con la del modelo', () => {
    // Es lo que hace que la superficie que el perito mide en el CAD sea la misma que
    // la que la Sede recibe. Con la precisión completa del modelo, las dos cifras se
    // separarían y la diferencia la descubriría el usuario.
    const { dxf } = serializarParcelaDxf({
      recintosEditados: [recinto([[440123.456789, 4470987.654321], [440163.456789, 4470987.654321], [440163.456789, 4471027.654321]])],
    })
    expect(dxf).toContain(`10${NL}440123.46`)
    expect(dxf).toContain(`20${NL}4470987.65`)
    expect(dxf).not.toContain('440123.456789')
    expect(DECIMALES_COORD).toBe(2) // si esto cambiara, lo de arriba lo diría
  })

  it('dos vértices que se funden al redondear se declaran y no se emiten dos veces', () => {
    const { dxf, detecciones, capas } = serializarParcelaDxf({
      recintosEditados: [
        recinto([
          [440123.450, 4470987.650],
          [440123.451, 4470987.650], // se funde con el anterior a 2 decimales
          [440163.450, 4470987.650],
          [440163.450, 4471027.650],
        ]),
      ],
    })
    const colapso = detecciones.find((d) => d.tipo === TIPO_EXPORT.COLAPSO_POR_REDONDEO)
    expect(colapso).toBeDefined()
    expect(colapso.datos.colapsados).toBe(1)
    expect(entidades(dxf).filter((e) => e.tipo === 'VERTEX')).toHaveLength(3) // 4 → 3
    expect(capas.find((c) => c.nombre === CAPAS.EDITADA.nombre).entidades).toBe(1)
  })

  it('un anillo que se queda con menos de 3 vértices no se emite, y se dice', () => {
    const { dxf, detecciones } = serializarParcelaDxf({
      recintosEditados: [recinto([[440123.45, 4470987.65], [440123.451, 4470987.65]])],
    })
    const d = detecciones.find((x) => x.tipo === TIPO_EXPORT.ANILLO_DESCARTADO)
    expect(d).toBeDefined()
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    // ⚠️ Se afirma sobre las ENTIDADES, no sobre la cadena 'POLYLINE': esa aparece
    // igual dentro de 'LWPOLYLINE', y la versión anterior de esta prueba —heredada
    // de cuando la salida era R2000— se quedó pasando por casualidad al cambiar el
    // formato, sin comprobar ya nada.
    expect(entidades(dxf)).toEqual([])
  })

  it('la polilínea sale CERRADA por bandera, sin repetir el primer vértice', () => {
    // Los DXF reales de AutoCAD del repo hacen lo contrario (`70=0` y vértice
    // repetido). La bandera dice lo mismo sin depender de que dos coordenadas
    // coincidan hasta el último decimal, y encaja con el modelo, que guarda el
    // anillo ABIERTO (regla de oro 4).
    const anillo = cuadrado(40)
    const { dxf } = serializarParcelaDxf({ recintosEditados: [recinto(anillo)] })
    expect(dxf).toContain(`70${NL}1`)
    expect(entidades(dxf).filter((e) => e.tipo === 'VERTEX')).toHaveLength(anillo.length)

    // ⚠️ Se comparan PARES (x,y), no la X suelta: en un cuadrado, el primer y el
    // último vértice comparten la X, así que contar apariciones de la X daría 2 y
    // acusaría al escritor de repetir el cierre cuando no lo repite.
    //
    // ⚠️ Y se leen por `entidades()`, no filtrando los códigos 10/20 del fichero:
    // así estaba escrita y se puso roja al llegar las extents, que usan esos mismos
    // códigos en la cabecera. Contaba 6 vértices en un cuadrado de 4.
    const emitidos = entidades(dxf)
      .filter((e) => e.tipo === 'VERTEX')
      .map((e) => `${e.grupos.find(([c]) => c === '10')[1]},${e.grupos.find(([c]) => c === '20')[1]}`)

    expect(emitidos).toHaveLength(anillo.length)
    expect(new Set(emitidos).size).toBe(anillo.length) // ni uno repetido
    expect(emitidos[emitidos.length - 1]).not.toBe(emitidos[0]) // el cierre no se escribe
  })

  it('una coordenada imposible LANZA con el motivo de `gml/anillos.js`, no la cuela', () => {
    expect(() => serializarParcelaDxf({ recintosEditados: [recinto([[NaN, 0], [1, 1], [2, 2]])] })).toThrow(RangeError)
    expect(() => serializarParcelaDxf({ recintosEditados: [recinto([[1e20, 0], [1, 1], [2, 2]])] })).toThrow(/rango publicable/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Sin geometría oficial: una capa, y se dice
// ═════════════════════════════════════════════════════════════════════════════

describe('export/dxf · la parcela que nunca se contrastó con el Catastro', () => {
  it('sale con una capa dibujada, la otra declarada y vacía, y un aviso que explica por qué', () => {
    const { dxf, detecciones, capas } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40))],
      recintosOficiales: null,
    })
    const d = detecciones.find((x) => x.tipo === TIPO_EXPORT.SIN_GEOMETRIA_OFICIAL)
    expect(d).toBeDefined()
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.mensaje).toMatch(/trae la parcela del catastro/i) // dice qué hacer
    expect(capas).toEqual([
      { nombre: CAPAS.OFICIAL.nombre, entidades: 0 },
      { nombre: CAPAS.EDITADA.nombre, entidades: 1 },
    ])
    // No se duplica el aviso: falta la oficial, no está «vacía por sorpresa».
    expect(detecciones.filter((x) => x.tipo === TIPO_EXPORT.CAPA_VACIA)).toHaveLength(0)
    expect(capasDeLaTabla(dxf)).toContain(CAPAS.OFICIAL.nombre)
  })

  it('sin ninguna geometría sale un DXF VÁLIDO y vacío, no un null que interpretar', () => {
    const { dxf, detecciones } = serializarParcelaDxf({ recintosEditados: [], recintosOficiales: [] })
    expect(typeof dxf).toBe('string')
    expect(dxf).toContain(ACADVER)
    expect(parseDXF(dxf).anillos).toEqual([])
    expect(detecciones.filter((d) => d.tipo === TIPO_EXPORT.CAPA_VACIA)).toHaveLength(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Bytes: la snapshot y el final de línea
// ═════════════════════════════════════════════════════════════════════════════

describe('export/dxf · los bytes', () => {
  it('el fichero completo, byte a byte (criterio 3)', async () => {
    const { dxf } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40, 1.67))],
      recintosOficiales: [recinto(cuadrado(40))],
    })
    await expect(dxf).toMatchFileSnapshot('./__snapshots__/parcela-dos-capas.dxf')
  })

  it('el terminador es CRLF en TODAS las líneas, como los DXF reales del repo', () => {
    const { dxf } = dosCapas()
    expect(dxf).toContain('\r\n')
    // Ni un solo LF suelto: un fichero medio convertido es peor que uno en LF entero.
    expect(dxf.replace(/\r\n/g, '')).not.toContain('\n')
    expect(dxf.endsWith(NL)).toBe(true)
  })

  it('⚠️ `.gitattributes` fija el final de línea de la snapshot', () => {
    // Sin esta línea, un clon limpio en Linux recibe la snapshot con LF, el escritor
    // sigue emitiendo CRLF, y la prueba de arriba se pone roja sin que nadie haya
    // tocado nada. Es literalmente el defecto que F09 encontró en
    // `cp_parcela_9398516VK3799G.gml`, y aquí se impide antes de que ocurra.
    const atributos = readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8')
    expect(atributos).toMatch(/test\/export\/__snapshots__\/\*\.dxf\s+text\s+eol=crlf/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · La frontera: el entorno degrada, el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('export/dxf · contrato roto por el programador', () => {
  it('unos recintos con forma imposible lanzan TypeError', () => {
    expect(() => serializarParcelaDxf({ recintosEditados: 'nada' })).toThrow(TypeError)
    expect(() => serializarParcelaDxf({ recintosEditados: [{ vertices: 'no' }] })).toThrow(TypeError)
    expect(() => serializarParcelaDxf({ recintosEditados: [], recintosOficiales: 42 })).toThrow(TypeError)
    expect(() => serializarParcelaDxf(null)).toThrow(TypeError)
    expect(() => serializarParcelaDxf([])).toThrow(TypeError)
  })

  it('sin argumentos sale el fichero vacío, no una excepción', () => {
    // `recintosEditados` tiene defecto: exportar «lo que hay» cuando no hay nada es
    // una pregunta legítima, no un error de programación.
    expect(() => serializarParcelaDxf()).not.toThrow()
  })

  it('el resumen cuenta las detecciones por tipo y por severidad', () => {
    const { detecciones, resumen } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40)), recinto(cuadrado(10, 10, 10), 'HUECO')],
      recintosOficiales: null,
    })
    expect(resumen.total).toBe(detecciones.length)
    expect(resumen.porTipo[TIPO_EXPORT.HUECO_EXPORTADO]).toBe(1)
    expect(resumen.porSeveridad[SEVERIDAD.AVISO]).toBeGreaterThan(0)
  })
})
