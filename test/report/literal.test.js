/* -------------------------------------------------------------------------- *
 * test/report/literal.test.js — F09 · T2.2 · Descripción literaria del lindero *
 *                                                                            *
 * `report/literal.js` produce el texto que un colegiado firma y que puede     *
 * acabar copiado en una escritura. Así que aquí no basta con que las cifras   *
 * salgan: hay que demostrar que el recorrido es EL que dice ser, que cada     *
 * lado se atribuye A QUIEN TOCA, y que el texto no afirma nada que no se      *
 * sepa.                                                                       *
 *                                                                            *
 *   1. Los tramos sobre la parcela REAL con sus CUATRO colindantes reales,    *
 *      producidos desde los fixtures (`parsearGml`), nunca con POJOs a mano.  *
 *      La suma de longitudes se contrasta contra un cálculo INDEPENDIENTE     *
 *      (`geo/metrica.js#perimetroAnillo`), que no es el que usa el módulo.    *
 *   2. Que arranca en el vértice más al noroeste y recorre en sentido         *
 *      HORARIO — y que sale el MISMO TEXTO tanto si el anillo venía horario   *
 *      como antihorario. Ésa es la prueba que atrapa el bug del sentido: un   *
 *      lindero descrito al revés nombra los cardinales opuestos y se lee      *
 *      igual de bien.                                                        *
 *   3. Que `vecinas: null` («no se ha mirado») y `vecinas: []` («se ha        *
 *      mirado y no hay») producen textos DISTINTOS.                          *
 *   4. Un guardián de vocabulario de mérito (regla de oro 9), con su mitad    *
 *      anti-vacuidad, como el de `test/report/contraste-texto.test.js`.       *
 *   5. El vértice duplicado: acaba en `saltados` con su motivo y NO como un   *
 *      rumbo Norte falso — que sería un rumbo legítimo y una mentira que      *
 *      nadie detectaría.                                                     *
 *   6. La ÚNICA propuesta del módulo —«presumiblemente con vía pública»—      *
 *      con sus tres candados: solo URBANA, solo si se ha mirado de verdad, y  *
 *      con la marca de no verificada viajando en el DATO y no solo en la      *
 *      prosa. El guardián de vocabulario NO se relaja para dejarla pasar: la  *
 *      NOMBRA y la acota a los tramos que la llevan.                         *
 *                                                                            *
 * Proyecto Vitest `node`: geometría y texto, sin DOM.                         *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { OPERATIVOS } from '../../config/operativos.js'
import { diagnosticar } from '../../diagnostico/parcela.js'
import { areaFirmada, orientacion } from '../../geo/area.js'
import { bbox } from '../../geo/bbox.js'
import { distancia, longitudesDeLados, perimetroAnillo } from '../../geo/metrica.js'
import { azimut, cuadrante, nombreCardinal } from '../../geo/rumbo.js'
import { parsearGml } from '../../gml/parse.js'
import { informeContrasteTexto } from '../../report/contraste-texto.js'
import {
  CLASE_CONOCIDA,
  MOTIVO_SALTADO,
  PRESUNCION,
  describirLindero,
} from '../../report/literal.js'
import { CLASE_PARCELA } from '../../services/_catastro-dnp.js'

const RAIZ = join(import.meta.dirname, '..', '..')

/** Clon profundo por JSON: vale porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

// ── Los fixtures REALES ─────────────────────────────────────────────────────

const REF = '9398516VK3799G'

/**
 * La parcela y sus colindantes, del WFS. ⚠️ El fichero trae **5 miembros para 4
 * colindantes**: la propia parcela viaja dentro, en SEGUNDA posición (override
 * O15). Se separa por referencia catastral y jamás por posición, que es lo que
 * hace `services/catastro.js#separarPropia`.
 */
const VECINDARIO = parsearGml(
  readFileSync(join(RAIZ, 'test/fixtures/catastro/wfs-neighbour-9398516VK3799G.xml'), 'utf8'),
)

/** `ParcelaGml` → la `VecinaLiteral` que come este módulo (refcat + label + recintos). */
const aVecinas = (parcelas) =>
  parcelas.map((p) => ({ refcat: p.refcat, label: p.label, recintos: p.recintos }))

const TODAS = aVecinas(VECINDARIO.parcelas)
const VECINAS = TODAS.filter((v) => v.refcat !== REF)

/** El GML de UNA parcela: el fichero que el usuario suelta en la ventana. */
const FICHERO = parsearGml(
  readFileSync(join(RAIZ, 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'), 'utf8'),
)

/** Los recintos de la parcela, clonados en cada uso (regla de oro 2). */
const recintos = () => clon(FICHERO.parcelas[0].recintos)
const vecinas = () => clon(VECINAS)

const ANILLO = FICHERO.parcelas[0].recintos[0].vertices
const N_VERTICES = ANILLO.length

/** El caso completo: la parcela real contra sus cuatro colindantes reales. */
const caso = (extra = {}) => describirLindero({ recintos: recintos(), vecinas: vecinas(), ...extra })

// ═════════════════════════════════════════════════════════════════════════════
// 0 · El material, antes de afirmar nada sobre él
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · el fixture es el que se cree que es', () => {
  it('la parcela real trae 15 vértices y su exterior viene HORARIO', () => {
    // Si esto cambiara, las cifras de todo el fichero dejarían de significar lo
    // que dicen sus comentarios. El sentido horario es el del WFS (override O1).
    expect(N_VERTICES).toBe(15)
    expect(orientacion(ANILLO)).toBe(-1)
    expect(perimetroAnillo(ANILLO)).toBeCloseTo(163.1176, 3)
  })

  it('el vecindario trae 5 miembros y la propia parcela va dentro, en 2.ª posición', () => {
    // Override O15, escrito como test: quien filtre por posición se lleva una
    // colindante de menos y la parcela de más.
    expect(TODAS).toHaveLength(5)
    expect(TODAS[1].refcat).toBe(REF)
    expect(VECINAS.map((v) => v.refcat)).toEqual([
      '9398501VK3799G',
      '9398518VK3799G',
      '9398517VK3799G',
      '9398515VK3799G',
    ])
  })

  it('el primer lindero del fichero (vértices 0→1) da 227,50° = Sudoeste', () => {
    // Contraste externo verificado a mano sobre esta parcela. Es el ancla de todo
    // lo demás: si `geo/rumbo.js` midiera desde el eje X en vez de desde el Norte,
    // este número saldría a 90° de distancia.
    const az = azimut(ANILLO[0], ANILLO[1])
    expect(az).toBeCloseTo(227.4985, 3)
    expect(nombreCardinal(cuadrante(az))).toBe('Sudoeste')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Los tramos sobre la parcela real: cada lado, a quien toca
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · los tramos de la parcela real y sus cuatro colindantes', () => {
  const r = caso()

  it('salen CUATRO tramos, uno por frente, con su colindante y su rótulo', () => {
    // Es la descripción que un técnico escribiría a mano de esta parcela: tres
    // colindantes catastrales y el frente que no linda con ninguna de las cuatro
    // parcelas traídas (da a vía pública, que el WFS de colindantes no devuelve).
    expect(
      r.tramos.map((t) => ({
        cardinal: t.cardinal,
        refcat: t.refcat,
        label: t.label,
        nLados: t.nLados,
        longitud: Number(t.longitud.toFixed(2)),
      })),
    ).toEqual([
      { cardinal: 'Este', refcat: '9398517VK3799G', label: '17', nLados: 1, longitud: 26.5 },
      { cardinal: 'Sudeste', refcat: '9398518VK3799G', label: '18', nLados: 2, longitud: 39.4 },
      { cardinal: 'Sudoeste', refcat: '9398515VK3799G', label: '15', nLados: 3, longitud: 50 },
      { cardinal: 'Noroeste', refcat: null, label: null, nLados: 9, longitud: 47.21 },
    ])
  })

  it('la atribución NO es vacua: con la normal hacia dentro no habría ni un refcat', () => {
    // El signo de «hacia fuera» (`edit/offset.js` §1) es la pieza que se suele
    // equivocar, y su fallo es TOTAL, no un sesgo: con el signo cambiado la sonda
    // cae dentro de la propia parcela y ningún lado encuentra colindante. Que tres
    // de los cuatro tramos lleven referencia catastral es, por tanto, la prueba de
    // que el signo está bien.
    expect(r.tramos.filter((t) => t.refcat !== null)).toHaveLength(3)
  })

  it('se consultaron CUATRO colindantes y solo tres salen: consultar no es atribuir', () => {
    // `9398501VK3799G` está en la respuesta del WFS y no toca ningún lado de esta
    // parcela. No se la nombra por estar en la lista: se la nombra si linda.
    expect(r.vecinasConsultadas).toBe(true)
    expect(VECINAS).toHaveLength(4)
    expect(r.tramos.map((t) => t.refcat)).not.toContain('9398501VK3799G')
    expect(r.texto).not.toContain('9398501VK3799G')
  })

  it('los tramos CUBREN el anillo entero: 15 lados repartidos y encadenados', () => {
    expect(r.tramos.reduce((s, t) => s + t.nLados, 0)).toBe(N_VERTICES)
    // Y encadenan: donde acaba uno empieza el siguiente, y el último cierra sobre
    // el primero. Un tramo que se saltara un lado pasaría el recuento de arriba
    // solo si otro contara de más, pero no pasaría esto.
    for (let i = 0; i < r.tramos.length; i++) {
      const siguiente = r.tramos[(i + 1) % r.tramos.length]
      expect(r.tramos[i].indiceFin).toBe(siguiente.indiceInicio)
    }
    expect(r.saltados).toEqual([])
  })

  it('la suma de las longitudes ES el perímetro (contraste independiente)', () => {
    // `perimetroAnillo` no es lo que usa el módulo (que suma lado a lado los de
    // `longitudesDeLados`), así que esto contrasta dos caminos distintos hasta la
    // misma cifra. Si un lado se perdiera o se contara dos veces, aquí se ve.
    const suma = r.tramos.reduce((s, t) => s + t.longitud, 0)
    expect(suma).toBeCloseTo(perimetroAnillo(ANILLO), 9)
  })

  it('cada tramo mide lo que suman SUS lados, no la cuerda', () => {
    // Un tramo agrupado es una quebrada: su longitud es la suma de los lados. La
    // cuerda es más corta, y usarla haría que la descripción declarase menos metros
    // de lindero de los que hay.
    const lados = longitudesDeLados(ANILLO)
    for (const t of r.tramos) {
      // Recorrido horario sobre un anillo horario ⇒ los lados van en el orden de
      // los índices desde `indiceInicio`.
      let suma = 0
      for (let k = 0; k < t.nLados; k++) suma += lados[(t.indiceInicio + k) % N_VERTICES]
      expect(suma).toBeCloseTo(t.longitud, 9)
      if (t.nLados > 1) {
        const cuerda = distancia(ANILLO[t.indiceInicio], ANILLO[t.indiceFin])
        expect(cuerda).toBeLessThan(t.longitud)
      }
    }
  })

  it('el rumbo de un tramo agrupado es el de su CUERDA, y su cardinal lo sigue', () => {
    // Contraste independiente: se recalcula con `geo/rumbo.js` desde los vértices
    // del fixture, sin pasar por el módulo.
    for (const t of r.tramos) {
      const esperado = azimut(ANILLO[t.indiceInicio], ANILLO[t.indiceFin])
      expect(t.azimut).toBeCloseTo(esperado, 9)
      expect(t.cardinal).toBe(nombreCardinal(cuadrante(esperado)))
    }
  })

  it('ningún lado del tramo agrupado se aleja del suyo más que la tolerancia', () => {
    // La agrupación compara contra el PRIMER lado del tramo, no contra el anterior:
    // así la apertura total está acotada por `rumboSimilarGrados` en vez de
    // acumularse en cadena (mil lados de un grado no pueden dar la vuelta entera).
    const separacion = (a, b) => {
      const d = Math.abs(a - b) % 360
      return d > 180 ? 360 - d : d
    }
    for (const t of r.tramos) {
      const primero = azimut(ANILLO[t.indiceInicio], ANILLO[(t.indiceInicio + 1) % N_VERTICES])
      for (let k = 0; k < t.nLados; k++) {
        const i = (t.indiceInicio + k) % N_VERTICES
        const az = azimut(ANILLO[i], ANILLO[(i + 1) % N_VERTICES])
        expect(separacion(primero, az)).toBeLessThanOrEqual(OPERATIVOS.rumboSimilarGrados)
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El recorrido: dónde arranca y hacia dónde va
// ═════════════════════════════════════════════════════════════════════════════

/**
 * El recorrido COMPLETO, lado a lado: con la tolerancia de rumbo al mínimo no se
 * funde ningún par de lados, así que `tramos` es la lista de lados en el orden en
 * que se recorren. Es el modo de mirar por dentro sin exponer API de más.
 */
const recorridoDe = (entrada) =>
  describirLindero({ ...entrada, opciones: { rumboSimilarGrados: 1e-9 } }).tramos

describe('report/literal · el recorrido arranca en el noroeste y va en sentido horario', () => {
  it('arranca en el vértice más cercano a la esquina NO de la caja (derivado, no escrito)', () => {
    // El criterio se recalcula aquí desde `geo/bbox.js` para no copiar el número:
    // si alguien cambiara «más al noroeste» por «el de mayor Y», esto se rompe.
    const caja = bbox(recintos())
    const esquina = [caja.minX, caja.maxY]
    let esperado = 0
    for (let i = 1; i < N_VERTICES; i++) {
      if (distancia(ANILLO[i], esquina) < distancia(ANILLO[esperado], esquina)) esperado = i
    }
    expect(esperado).toBe(12)
    expect(caso().tramos[0].indiceInicio).toBe(esperado)
  })

  it('el recorrido pasa por los 15 vértices, una vez cada uno', () => {
    const orden = recorridoDe({ recintos: recintos(), vecinas: vecinas() }).map((t) => t.indiceInicio)
    expect(orden).toHaveLength(N_VERTICES)
    expect(new Set(orden).size).toBe(N_VERTICES)
    expect(orden[0]).toBe(12)
  })

  it('el recorrido es HORARIO, medido sobre el anillo tal como se recorre', () => {
    // Contraste independiente con `geo/area.js#areaFirmada`: se reconstruye el
    // anillo en el orden del recorrido y su área firmada tiene que ser NEGATIVA.
    const orden = recorridoDe({ recintos: recintos(), vecinas: vecinas() }).map((t) => t.indiceInicio)
    const recorrido = orden.map((i) => ANILLO[i])
    expect(areaFirmada(recorrido)).toBeLessThan(0)
    expect(orientacion(recorrido)).toBe(-1)
  })

  it('y sigue siendo horario cuando el anillo llega ANTIHORARIO', () => {
    const alReves = recintos()
    alReves[0].vertices.reverse()
    expect(orientacion(alReves[0].vertices)).toBe(1)

    const orden = recorridoDe({ recintos: alReves, vecinas: vecinas() }).map((t) => t.indiceInicio)
    const recorrido = orden.map((i) => alReves[0].vertices[i])
    expect(orientacion(recorrido)).toBe(-1)
  })

  it('EL MISMO TEXTO con el anillo horario y con el anillo antihorario', () => {
    // La prueba que atrapa el bug del sentido. Dar por hecha la orientación —en vez
    // de medirla con `geo/area.js#orientacion`— describiría este lindero con los
    // cardinales OPUESTOS (azimut + 180°) sin que nada se rompiera: el documento se
    // leería perfectamente bien y sería falso de cabo a rabo.
    const alReves = recintos()
    alReves[0].vertices.reverse()

    const derecho = caso()
    const invertido = describirLindero({ recintos: alReves, vecinas: vecinas() })

    expect(invertido.texto).toBe(derecho.texto)
    // Y los tramos son los mismos salvo los ÍNDICES, que son índices en la lista
    // que llegó y por tanto tienen que cambiar.
    const sinIndices = ({ indiceInicio, indiceFin, ...resto }) => resto
    expect(invertido.tramos.map(sinIndices)).toEqual(derecho.tramos.map(sinIndices))
    expect(invertido.tramos[0].indiceInicio).not.toBe(derecho.tramos[0].indiceInicio)
  })

  it('el texto nombra el arranque por sus COORDENADAS, no por su número de orden', () => {
    // Es lo que hace posible la igualdad de arriba: el número de orden depende de
    // por dónde empiece la lista del fichero; la coordenada, no. Y es la que se
    // puede replantear sobre el terreno.
    expect(caso().texto).toContain('desde el vértice más al noroeste (X 439222,47 · Y 4479678,13)')
    expect(ANILLO[12]).toEqual([439222.47, 4479678.13])
  })

  it('el empate exacto de distancia a la esquina NO lo rompe el índice MENOR', () => {
    // Un rombo simétrico respecto de la esquina NO de su caja: dos vértices a la
    // misma distancia exacta. Sin criterio de desempate, el arranque dependería del
    // orden en que llegaran los vértices; con él, es el índice menor.
    const rombo = [
      { tipo: 'EXTERIOR', vertices: [[5, 10], [10, 5], [5, 0], [0, 5]] },
    ]
    const caja = bbox(rombo)
    expect(distancia(rombo[0].vertices[0], [caja.minX, caja.maxY])).toBeCloseTo(
      distancia(rombo[0].vertices[3], [caja.minX, caja.maxY]),
      12,
    )
    expect(describirLindero({ recintos: rombo }).tramos[0].indiceInicio).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 bis · El documento: el lindero delante, el método al pie
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · el lindero abre el documento y el método va al pie', () => {
  const r = caso()

  it('el texto EMPIEZA en «Linda al …», que es lo que se copia a una escritura', () => {
    // Un preámbulo metodológico delante se cuela en el portapapeles de quien solo
    // quería los linderos, y obliga a saltárselo en cada lectura.
    expect(r.texto.startsWith('Linda al Este, en línea recta de 26,50 m,')).toBe(true)
    expect(r.lindero).toHaveLength(4)
    for (const p of r.lindero) expect(p.startsWith('Linda al ')).toBe(true)
  })

  it('`texto` es EXACTAMENTE `lindero` + `notaTecnica`, sin nada por el camino', () => {
    // La identidad se afirma porque las tres vistas son del MISMO documento: dos
    // que pudieran discrepar serían dos documentos. Y T3.2 compone la nota en
    // cuerpo menor a partir de `notaTecnica`, así que no puede faltarle un párrafo
    // que sí esté en `texto`.
    expect(r.texto).toBe([...r.lindero, ...r.notaTecnica].join('\n\n'))
  })

  it('la nota técnica abre con su rótulo y NO se queda ni una palabra por el camino', () => {
    const nota = r.notaTecnica.join('\n\n')
    expect(r.notaTecnica[0].startsWith('Nota técnica.')).toBe(true)
    // Las cinco piezas metodológicas que estaban en el preámbulo, una por una:
    // recolocadas, no perdidas.
    expect(nota).toContain('se recorre en sentido horario desde el vértice más al noroeste')
    expect(nota).toContain('X 439222,47 · Y 4479678,13')
    expect(nota).toContain('Norte de cuadrícula')
    expect(nota).toContain('se reparte en 4 tramos y suma 163,12 m')
    expect(nota).toContain(
      'Que un tramo no lleve referencia catastral no significa que no haya nada al otro lado',
    )
  })

  it('y el lindero NO arrastra nada metodológico', () => {
    // La mitad complementaria: si algo de lo de arriba siguiera colgado de las
    // frases de lindero, el reparto sería cosmético.
    const lindero = r.lindero.join('\n\n')
    for (const metodologico of [
      /sentido horario/,
      /Norte de cuadrícula/,
      /perímetro/,
      /Nota técnica/,
      /X 439222,47/,
    ]) {
      expect(metodologico.test(lindero), `esto es método y está en el lindero: ${metodologico}`).toBe(
        false,
      )
    }
  })

  it('sin lindero que describir no hay nota técnica huérfana', () => {
    // Un epígrafe «Nota técnica.» seguido de nada es un hueco con nombre.
    const r2 = describirLindero({ recintos: [{ tipo: 'EXTERIOR', vertices: [[0, 0], [1, 1]] }] })
    expect(r2.notaTecnica).toEqual([])
    expect(r2.lindero).toHaveLength(1)
    expect(r2.texto).toBe(r2.lindero[0])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · `null` no es `[]`: no haber mirado no es no haber encontrado
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · «no se ha consultado» y «se consultó y no hay» son textos distintos', () => {
  const sinConsultar = describirLindero({ recintos: recintos() })
  const consultadasVacias = describirLindero({ recintos: recintos(), vecinas: [] })

  it('`vecinas: null` ⇒ `vecinasConsultadas: false` y el texto dice que no se ha mirado', () => {
    expect(sinConsultar.vecinasConsultadas).toBe(false)
    expect(sinConsultar.texto).toContain('no se han consultado las parcelas colindantes')
    expect(sinConsultar.texto).toContain(
      'No se han consultado las parcelas colindantes, así que esta descripción no dice',
    )
  })

  it('`vecinas: []` ⇒ `vecinasConsultadas: true` y el texto dice que se miró', () => {
    expect(consultadasVacias.vecinasConsultadas).toBe(true)
    expect(consultadasVacias.texto).toContain(
      'ninguna de las colindantes consultadas pone referencia catastral a este lindero',
    )
    expect(consultadasVacias.texto).toContain('No se ha aportado ninguna parcela colindante')
  })

  it('los dos textos son DISTINTOS aunque la geometría sea la misma', () => {
    // Es el fondo del asunto: los dos casos tienen `refcat: null` en todos los
    // tramos, y aun así no afirman lo mismo. Este repo ya se ha peleado tres veces
    // con esta confusión (`hallazgos`, `vecinas`, `invasion.consultado`).
    expect(sinConsultar.texto).not.toBe(consultadasVacias.texto)
    const sinIndices = (t) => ({ ...t })
    expect(sinConsultar.tramos.map(sinIndices)).toEqual(consultadasVacias.tramos.map(sinIndices))
  })

  it('ninguno de los dos dice «con nadie», que suena a que no hay nada al otro lado', () => {
    // Siempre hay algo al otro lado de un lindero: una calle, un camino, un cauce,
    // una parcela que no se ha traído. Lo que la app puede afirmar es que no sabe
    // cuál, y eso es lo que se escribe.
    for (const texto of [sinConsultar.texto, consultadasVacias.texto, caso().texto]) {
      expect(texto).not.toMatch(/con nadie/i)
      expect(texto).not.toMatch(/no linda/i)
      expect(texto).not.toMatch(/sin colindante\b/i)
    }
  })

  it('`undefined` no se admite como sinónimo de `[]`: se pasa `null` o una lista', () => {
    // `vecinas: undefined` toma el defecto documentado (`null` = no consultado), y
    // cualquier otra cosa lanza. Lo que no puede pasar es que un `undefined` de un
    // cableado a medio hacer se lea como «se consultó y no hay».
    expect(describirLindero({ recintos: recintos(), vecinas: undefined }).vecinasConsultadas).toBe(
      false,
    )
    expect(() => describirLindero({ recintos: recintos(), vecinas: {} })).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · El vértice duplicado: `saltados`, y jamás un Norte falso
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · un lado sin rumbo se salta y se dice, no se inventa', () => {
  /** La parcela real con el vértice 3 REPETIDO: el lado 3→4 mide cero. */
  function conDuplicado() {
    const r = recintos()
    const v = r[0].vertices
    r[0].vertices = v.flatMap((p, i) => (i === 3 ? [p, [...p]] : [p]))
    return r
  }

  const duplicado = describirLindero({ recintos: conDuplicado(), vecinas: vecinas() })

  it('`azimut` de dos puntos coincidentes es `null`, que es de donde viene todo', () => {
    // La causa, afirmada aparte: si algún día `geo/rumbo.js` devolviera 0 ahí, este
    // módulo escribiría «linda al Norte» donde no hay lindero — y 0 es el Norte, un
    // rumbo perfectamente legítimo, así que nada sonaría.
    expect(azimut([1, 2], [1, 2])).toBe(null)
  })

  it('el lado degenerado acaba en `saltados`, con su índice y su motivo', () => {
    expect(duplicado.saltados).toEqual([{ indice: 3, motivo: MOTIVO_SALTADO.LADO_SIN_RUMBO }])
    expect(MOTIVO_SALTADO.LADO_SIN_RUMBO).toBe('LADO_SIN_RUMBO')
  })

  it('y NO aparece como un tramo al Norte: los tramos son los mismos que sin duplicar', () => {
    // La afirmación fuerte: meter un vértice repetido no cambia la descripción del
    // lindero, solo añade una línea a lo que no se ha descrito.
    const limpio = caso()
    const sinIndices = ({ indiceInicio, indiceFin, ...resto }) => resto
    expect(duplicado.tramos.map(sinIndices)).toEqual(limpio.tramos.map(sinIndices))
    expect(duplicado.tramos.some((t) => t.cardinal === 'Norte')).toBe(false)
  })

  it('la suma de longitudes sigue siendo el perímetro (el lado saltado mide 0)', () => {
    const suma = duplicado.tramos.reduce((s, t) => s + t.longitud, 0)
    expect(suma).toBeCloseTo(perimetroAnillo(conDuplicado()[0].vertices), 9)
  })

  it('el texto cuenta el lado que se ha quedado sin describir, y por qué', () => {
    // Regla de oro 1: nada desaparece en silencio, tampoco de un texto que se firma.
    expect(duplicado.texto).toContain('1 lado del contorno se ha quedado sin describir')
    expect(duplicado.texto).toContain('sus dos extremos son el mismo punto')
    expect(duplicado.texto).toContain('el vértice 4')
  })

  it('un contorno de menos de 3 vértices no lanza: lo dice', () => {
    // Dato posible del usuario, no bug del programador (mismo criterio que
    // `geo/metrica.js#longitudesDeLados`, que devuelve `[]`). `geo/bbox.js` sí
    // lanzaría, así que el caso se resuelve antes de llamarla.
    const r = describirLindero({ recintos: [{ tipo: 'EXTERIOR', vertices: [[0, 0], [1, 1]] }] })
    expect(r.tramos).toEqual([])
    expect(r.saltados).toEqual([])
    expect(r.texto).toContain('No hay lindero que describir')
    expect(r.texto).toContain('no llega a formar anillo')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 bis · La ÚNICA propuesta del módulo: «presumiblemente, vía pública»
// ═════════════════════════════════════════════════════════════════════════════

/** Las tres marcas de la presunción. Van las tres o no va ninguna. */
const MARCAS_PRESUNCION = Object.freeze([
  'presumiblemente',
  'dato NO verificado',
  'confirme antes de firmar',
])

describe('report/literal · vía pública: solo en urbana, y marcada como no verificada', () => {
  const urbana = caso({ clase: 'URBANA' })
  const rustica = caso({ clase: 'RUSTICA' })
  const sinClase = caso()

  it('en URBANA, el frente sin colindante se propone como vía pública', () => {
    // El caso real: los viales urbanos NO tienen referencia catastral
    // (`MEJORES_PRACTICAS_GML.md` §5.2, punto 3), así que este frente de 9 lados y
    // 47,21 m —casi un tercio del perímetro— no puede encontrar colindante por
    // muchas vecinas que se traigan. Es el texto que aprobó el colegiado.
    expect(urbana.lindero[3]).toBe(
      'Linda al Noroeste, en línea quebrada de 9 lados que suman 47,21 m, presumiblemente ' +
        'con vía pública (ninguna parcela catastral colindante alcanza este lindero; dato NO ' +
        'verificado, confirme antes de firmar).',
    )
  })

  it('la marca viaja en el DATO, no solo en la prosa', () => {
    // Para que el diálogo de edición pueda resaltar ese renglón y el PDF sepa que
    // lleva advertencia. Una advertencia que solo existiera en una cadena de texto
    // se pierde en el primer `replace` de quien maquete.
    expect(urbana.tramos.map((t) => t.presuncionNoVerificada)).toEqual([
      null,
      null,
      null,
      PRESUNCION.VIA_PUBLICA,
    ])
    expect(PRESUNCION.VIA_PUBLICA).toBe('VIA_PUBLICA')
  })

  it('con `clase: null` (defecto) y con `RUSTICA`, el texto es EXACTAMENTE el de siempre', () => {
    // El candado 1. En rústica, un lindero sin parcela catastral puede ser un
    // camino, un cauce, un monte público o una finca no catastrada: proponer «vía
    // pública» ahí sería temerario.
    expect(sinClase.lindero).toEqual(rustica.lindero)
    expect(sinClase.lindero[3]).toContain('con parcela sin identificar')
    expect(sinClase.tramos.every((t) => t.presuncionNoVerificada === null)).toBe(true)
    expect(rustica.tramos.every((t) => t.presuncionNoVerificada === null)).toBe(true)
  })

  it('en RÚSTICA la nota técnica DICE por qué no se propone nada', () => {
    // La mitad honrada del candado 1: el criterio se explica en el documento, no
    // solo en el código, para que el técnico sepa que la ausencia es deliberada.
    const nota = rustica.notaTecnica.join('\n\n')
    expect(nota).toContain('La parcela consta como RÚSTICA')
    expect(nota).toContain('un camino, un cauce, un monte público o una finca no catastrada')
    // Y con `clase: null` no se dice nada de la clase: no consta, no se comenta.
    expect(sinClase.notaTecnica.join('\n\n')).not.toContain('RÚSTICA')
  })

  it('URBANA sin haber consultado colindantes NO propone nada (candado 2)', () => {
    // Sin haber mirado no hay «ninguna parcela alcanza este lindero» que sostenga
    // la presunción. Es exactamente la distinción `null` ≠ `[]` otra vez.
    const r = describirLindero({ recintos: recintos(), vecinas: null, clase: 'URBANA' })
    expect(r.tramos.every((t) => t.presuncionNoVerificada === null)).toBe(true)
    expect(r.texto).not.toContain('vía pública')
  })

  it('URBANA con la lista de colindantes VACÍA tampoco propone nada (candado 3)', () => {
    // Con la lista vacía no se ha contrastado contra nada: proponer «vía pública»
    // en los cuatro frentes de la parcela sería un disparate con formato de dato.
    const r = describirLindero({ recintos: recintos(), vecinas: [], clase: 'URBANA' })
    expect(r.tramos.every((t) => t.presuncionNoVerificada === null)).toBe(true)
    expect(r.texto).not.toContain('vía pública')
  })

  it('un tramo CON colindante nunca lleva presunción, ni en urbana', () => {
    // El cuarto candado, el de tramo: la presunción es la lectura de una AUSENCIA.
    for (const t of urbana.tramos.filter((x) => x.refcat !== null)) {
      expect(t.presuncionNoVerificada).toBe(null)
    }
  })

  it('la nota técnica explica la presunción ADEMÁS de la frase, no en su lugar', () => {
    // Quien solo copie los párrafos de lindero se lleva la advertencia igualmente
    // (los tres avisos están en la frase); quien lea la nota se entera del porqué.
    const nota = urbana.notaTecnica.join('\n\n')
    expect(nota).toContain('1 tramo se describe como vía pública POR PRESUNCIÓN y no por medición')
    expect(nota).toContain('no ha consultado el callejero')
    for (const marca of MARCAS_PRESUNCION) expect(urbana.lindero[3]).toContain(marca)
  })

  it('`clase` fuera del vocabulario LANZA en vez de degradar a «no consta»', () => {
    // Degradar sería la avería más difícil de ver: el texto seguiría siendo
    // correcto, solo que peor, y nadie lo notaría. Ni minúsculas, ni el `'UR'` del
    // servicio, ni herencia de `Object.prototype`.
    expect(() => caso({ clase: 'urbana' })).toThrow(TypeError)
    expect(() => caso({ clase: 'UR' })).toThrow(/CLASE_PARCELA/)
    expect(() => caso({ clase: 'constructor' })).toThrow(TypeError)
    expect(() => caso({ clase: 3 })).toThrow(/'clase'/)
  })

  it('`CLASE_CONOCIDA` es ESPEJO de `services/_catastro-dnp.js#CLASE_PARCELA`', () => {
    // Test-guarda, no disciplina: `report/` no importa de `services/` (sería un
    // módulo puro colgando de la capa que habla con el Catastro), así que el
    // vocabulario está declarado dos veces y esto es lo que impide que diverjan.
    // Misma fórmula que `OMISION_CONOCIDA` en `report/contraste-texto.js`.
    expect(CLASE_CONOCIDA).toEqual(CLASE_PARCELA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Guardián de la regla de oro 9 — y su mitad anti-vacuidad
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Vocabulario de VEREDICTO, el MISMO que vigila `report/contraste-texto.js`
 * (`test/report/contraste-texto.test.js`). Aquí pesa todavía más: esto describe la
 * finca de alguien en un papel que se presenta ante notario o registrador, y una
 * sola palabra de mérito lo convierte en un dictamen que la aplicación no puede
 * emitir. «La aplicación mide; el colegiado interpreta y firma» (SPEC §2).
 */
const VEREDICTO = Object.freeze([
  /\bválid[oa]s?\b/i,
  /\binválid[oa]s?\b/i,
  /\bcorrect[oa]s?\b/i,
  /\bincorrect[oa]s?\b/i,
  /\bcorrectamente\b/i,
  /\bapt[oa]s?\b/i,
  /\bcumple[n]?\b/i,
  /\bincumple[n]?\b/i,
  /\bconforme[s]?\b/i,
  /\bse ajusta[n]?\b/i,
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

describe('report/literal · guardián de la regla de oro 9', () => {
  it('no hay una sola palabra de mérito en ninguno de los textos que produce', () => {
    const textos = [
      caso().texto,
      describirLindero({ recintos: recintos() }).texto,
      describirLindero({ recintos: recintos(), vecinas: [] }).texto,
      describirLindero({ recintos: [{ tipo: 'EXTERIOR', vertices: [[0, 0], [1, 1]] }] }).texto,
    ]
    for (const texto of textos) {
      expect(
        veredictosEn(texto),
        'la aplicación mide y el colegiado firma: la descripción del lindero no valora nada',
      ).toEqual([])
    }
  })

  it('LA EXCEPCIÓN, NOMBRADA: la presunción de vía pública y ninguna otra cosa', () => {
    // El guardián no se relaja para dejar pasar la única propuesta del módulo: la
    // acota. Las marcas de presunción solo pueden aparecer en los tramos que la
    // llevan, y solo cuando la clase es URBANA. Mismo criterio con el que
    // `report/contraste-texto.js` trata la invasión a colindante —la única
    // excepción que su guardián admite— en vez de borrar la palabra de la lista.
    const urbana = caso({ clase: 'URBANA' })

    // 1 · Donde NO hay presunción, no hay ni una marca. En ningún texto, nunca.
    for (const limpio of [caso(), caso({ clase: 'RUSTICA' })]) {
      for (const marca of MARCAS_PRESUNCION) expect(limpio.texto).not.toContain(marca)
      expect(limpio.texto).not.toContain('vía pública')
    }

    // 2 · Donde SÍ la hay, aparece tantas veces como tramos la llevan — ni una más:
    // una marca suelta en un párrafo que no la necesita sería una advertencia
    // decorativa, y las advertencias decorativas se dejan de leer.
    const conPresuncion = urbana.tramos.filter((t) => t.presuncionNoVerificada !== null)
    expect(conPresuncion).toHaveLength(1)
    const enLindero = urbana.lindero.join('\n\n')
    for (const marca of MARCAS_PRESUNCION) {
      expect(enLindero.split(marca)).toHaveLength(conPresuncion.length + 1)
    }

    // 3 · Y las tres viajan JUNTAS: una presunción con «presumiblemente» pero sin
    // «confirme antes de firmar» sería una sugerencia con aspecto de dato.
    for (const parrafo of urbana.lindero) {
      const cuantas = MARCAS_PRESUNCION.filter((m) => parrafo.includes(m)).length
      expect(cuantas === 0 || cuantas === MARCAS_PRESUNCION.length).toBe(true)
    }
  })

  it('y la presunción no se cuela como afirmación: siempre en condicional', () => {
    // La frase PROPONE. En cuanto se le quitara el «presumiblemente» pasaría a
    // afirmar que el lindero da a la calle, que es un dato que nadie ha consultado.
    const texto = caso({ clase: 'URBANA' }).texto
    expect(texto).toContain('presumiblemente con vía pública')
    expect(texto).not.toMatch(/\blinda con vía pública\b/i)
    expect(texto).not.toMatch(/\bes vía pública\b/i)
    expect(texto).not.toMatch(/\bda a la calle\b/i)
  })

  it('tampoco hay conclusiones encubiertas sobre el encaje o la superficie', () => {
    // El texto describe la finca. No dice si encaja con el parcelario (eso es F07),
    // ni si la superficie coincide con nada, ni qué habría que hacer.
    //
    // ⛔ CORREGIDO EN F11 · T5.3 (2026-08-04): `/\bdeberá\b/i` ESTABA MUERTA, y al
    // revés de como se lee. `\b` se define sobre `\w = [A-Za-z0-9_]`, así que la
    // frontera de la DERECHA cae detrás de una `á`, que no es `\w`: para casar,
    // ahí tendría que venir un carácter que SÍ lo fuera. O sea que el patrón
    // rechazaba «deberán» y dejaba pasar «deberá» — justo la forma que se quiere
    // prohibir. Medido sobre los 72 patrones con `\b` del repo: era el ÚNICO roto
    // (`válido`, `semáforo`, `erróneo`, `vía pública` tienen fronteras ASCII).
    // **No tapaba nada**: `report/literal.js` no emite «deberá» en ningún sitio,
    // y la entrada sigue verde ahora que de verdad mira. La frontera buena para
    // una palabra acentuada es `(?<!\p{L})…(?!\p{L})` con bandera `u`.
    const texto = caso().texto
    for (const prohibido of [
      /\bencaj/i,
      /\bdiscrepanci/i,
      /(?<!\p{L})deberá(?!\p{L})/iu,
      /\bhay que\b/i,
      /\berror\b/i,
    ]) {
      expect(prohibido.test(texto), `el texto está concluyendo: ${prohibido}`).toBe(false)
    }
  })

  it('el guardián DISPARA si alguien mete una palabra de veredicto', () => {
    // La mitad anti-vacuidad: un guardián que nunca puede fallar no protege nada.
    expect(veredictosEn(`${caso().texto}\n\nEl lindero es correcto.`)).not.toEqual([])
    expect(veredictosEn('el lindero se ajusta al parcelario')).not.toEqual([])
    // Y cada regex de la lista caza algo: una entrada muerta deja de vigilar sin
    // que nadie se entere.
    const cebos = [
      'válido',
      'inválido',
      'correcto',
      'incorrecto',
      'correctamente',
      'apto',
      'cumple',
      'incumple',
      'conforme',
      'se ajusta',
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

  it('no lee el reloj ni depende del entorno para formatear', () => {
    // Mismo guardián que `report/contraste-texto.js`: un texto que se firma tiene
    // que valer lo mismo dentro de un año y salir igual en CI que en el equipo de
    // quien firma.
    const fuente = readFileSync(join(RAIZ, 'report', 'literal.js'), 'utf8')
    expect(/\bnew\s+Date\b/.test(fuente), 'instancia una fecha propia').toBe(false)
    expect(/\bDate\s*\.\s*now\b/.test(fuente), 'consulta el reloj').toBe(false)
    expect(/toLocale(Date|Time|)String\b/.test(fuente)).toBe(false)
    // Y es función pura de su entrada: dos llamadas idénticas, mismo texto.
    expect(caso().texto).toBe(caso().texto)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Lo que el texto NO puede afirmar
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · el texto no finge saber más de lo que sabe', () => {
  const texto = caso().texto

  it('NO escribe «la parcela 98 del polígono 8»: ese dato no se tiene de un colindante', () => {
    // El ejemplo de la spec lo dice así, y no se puede: polígono y parcela salen de
    // `Consulta_DNPRC`, que se consulta POR referencia catastral — hacerlo para los
    // cuatro vecinos serían cinco peticiones por informe contra el régimen de uso
    // del servicio (override O8: denegación ~10 días por abuso).
    expect(texto).not.toMatch(/pol[íi]gono/i)
    expect(texto).not.toMatch(/\bla parcela \d+\b/i)
    expect(texto).not.toMatch(/\bparaje\b/i)
    expect(texto).not.toMatch(/\bmunicipio\b/i)
  })

  it('nombra a los colindantes por su referencia catastral y su `cp:label`, atribuido', () => {
    // El rótulo va entrecomillado y con la fuente delante: es lo que el parcelario
    // pone, no un número de parcela que nosotros afirmemos.
    expect(texto).toContain(
      'con la parcela de referencia catastral 9398517VK3799G, rotulada «17» en el parcelario catastral',
    )
  })

  it('dice que los rumbos son de Norte de CUADRÍCULA', () => {
    // No se aplica la convergencia de meridianos (`geo/rumbo.js` razona por qué),
    // así que quien firma tiene derecho a saber contra qué norte está escrito esto.
    expect(texto).toContain('Norte de cuadrícula')
    expect(texto).toContain('no de Norte geográfico')
  })

  it('«en línea recta» solo cuando el tramo es UN lado; si no, «en línea quebrada»', () => {
    // Llamar «línea recta de 47,21 m» a una quebrada de nueve lados sería una medida
    // que no se puede replantear sobre el terreno.
    expect(texto).toContain('en línea recta de 26,50 m')
    expect(texto).toContain('en línea quebrada de 9 lados que suman 47,21 m')
    const rectas = texto.match(/en línea recta/g) ?? []
    expect(rectas).toHaveLength(caso().tramos.filter((t) => t.nLados === 1).length)
  })

  it('describe SOLO el lindero exterior, y dice que hay huecos cuando los hay', () => {
    const conHueco = recintos()
    conHueco.push({
      tipo: 'HUECO',
      vertices: [
        [439240, 4479660],
        [439245, 4479660],
        [439245, 4479665],
      ],
    })
    const r = describirLindero({ recintos: conHueco, vecinas: vecinas() })
    expect(r.texto).toContain('1 hueco interior')
    expect(r.texto).toContain('aquí se describe el lindero exterior')
    // Y el lindero descrito es exactamente el mismo que sin el hueco.
    expect(r.tramos).toEqual(caso().tramos)
  })

  it('los párrafos van SIN envolver: los saltos de línea los pone quien maqueta', () => {
    // El destino es un PDF que rompe líneas por su cuenta y un cuadro de edición
    // donde el usuario reescribe (la spec pide que sea editable antes de exportar).
    // Unos saltos duros metidos aquí se arrastrarían hasta la escritura.
    const parrafos = texto.split('\n\n')
    expect(parrafos.length).toBeGreaterThan(1)
    for (const p of parrafos) expect(p).not.toContain('\n')
    expect(texto.endsWith('\n')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Los números, en español y con el mismo criterio que el resto del informe
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · el formato de número es el del informe de contraste', () => {
  const texto = caso().texto

  it('coma decimal y dos decimales en las longitudes', () => {
    expect(texto).toContain('163,12 m')
    expect(texto).not.toContain('163.12')
    expect(texto).not.toMatch(/\d\.\d{2} m/)
  })

  it('las coordenadas van SIN separador de millar (439222,47, no 439.222,47)', () => {
    // Misma divergencia deliberada que `report/contraste-texto.js`: en un listado
    // topográfico, un punto de millar y una coma decimal en la misma cifra son la
    // lectura equivocada más fácil de cometer.
    expect(texto).toContain('X 439222,47')
    expect(texto).not.toContain('439.222,47')
  })

  it('la MISMA longitud sale igual escrita aquí y en el informe de contraste', () => {
    // El riesgo real: que el mismo documento escriba «12.45 m» en un sitio y
    // «12,45 m» en otro. Se contrasta contra el otro módulo de `report/`, con el
    // mismo perímetro medido sobre la misma geometría.
    const informe = informeContrasteTexto({
      diagnostico: diagnosticar({ recintos: recintos() }),
      parcela: { refcat: REF, srs: 'EPSG:25830', recintos: recintos(), origen: 'GML_EXISTENTE' },
      fecha: new Date(Date.UTC(2026, 7, 2, 9, 0, 0)),
    })
    expect(informe).toContain('163,12 m')
    expect(texto).toContain('163,12 m')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Las dos tolerancias, y lo que cambian
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · las tolerancias operativas de F09', () => {
  it('viven en `config/operativos.json` y valen 0,30 m y 22,5°', () => {
    // Son tolerancias de INGENIERÍA, no umbrales-veredicto: una dice dónde se
    // pincha para preguntar quién hay al otro lado y la otra cuándo dos lados se
    // cuentan como un tramo. `config/umbrales.json` sigue prohibido.
    expect(OPERATIVOS.epsilonColindanteMetros).toBe(0.3)
    expect(OPERATIVOS.rumboSimilarGrados).toBe(22.5)
  })

  it('`epsilonColindanteMetros` está por encima de la precisión de captura del Catastro', () => {
    // <25 cm, 85 % ≤20 cm (SPEC §3): por debajo de eso la sonda puede caer en la
    // tira de tierra de nadie que separa las dos versiones del mismo lindero —la de
    // esta parcela y la de su vecina— y volver «sin colindante» teniéndolo pegado.
    expect(OPERATIVOS.epsilonColindanteMetros).toBeGreaterThan(0.25)
    expect(OPERATIVOS.epsilonColindanteMetros).toBeLessThan(OPERATIVOS.snapMetros * 10)
  })

  it('`rumboSimilarGrados` es el SEMISECTOR cardinal (45° / 2)', () => {
    // Los ocho cuadrantes de `geo/rumbo.js#cuadrante` miden 45° y están centrados
    // en el rumbo que nombran: 22,5° es la distancia del centro de un sector a su
    // borde. Por encima, un tramo agrupado llevaría el nombre de un cuadrante que
    // uno de sus lados no toca ni de lejos.
    expect(OPERATIVOS.rumboSimilarGrados).toBe(45 / 2)
  })

  it('bajar `rumboSimilarGrados` parte tramos, y la suma sigue siendo el perímetro', () => {
    const estrecho = caso({ opciones: { rumboSimilarGrados: 10 } })
    expect(estrecho.tramos.length).toBeGreaterThan(caso().tramos.length)
    expect(estrecho.tramos.reduce((s, t) => s + t.longitud, 0)).toBeCloseTo(
      perimetroAnillo(ANILLO),
      9,
    )
    // Dos tramos consecutivos con el MISMO cardinal se escriben en una sola frase,
    // encadenados con «; y», que es como se redacta un lindero.
    expect(estrecho.texto).toMatch(/Linda al Noroeste, [^\n]*; y en línea quebrada/)
  })

  it('la agrupación NO deriva en cadena: un polígono de 36 lados no es un solo tramo', () => {
    // La trampa: comparar cada lado con el ANTERIOR en vez de con el PRIMERO del
    // tramo. Sobre la parcela real las dos reglas dan lo mismo (el frente que da a
    // la calle solo abre 15°), así que hace falta una figura que derive de verdad.
    //
    // Un polígono regular de 36 lados gira 10° en cada vértice: con la regla en
    // cadena, cada lado está a 10° del anterior y los TREINTA Y SEIS se funden en
    // un único «tramo» que ha dado la vuelta entera — una frase que diría «linda al
    // Norte, en línea quebrada de 36 lados que suman 300 m» describiendo un
    // círculo. Comparando contra el primer lado, la apertura de cada tramo queda
    // acotada por la tolerancia: 3 lados (0°, 10°, 20°) y a por el siguiente.
    const R = 50
    const vertices = Array.from({ length: 36 }, (_, k) => {
      const t = (k * 10 * Math.PI) / 180
      return [439000 + R * Math.cos(t), 4479000 + R * Math.sin(t)]
    })
    const { tramos } = describirLindero({ recintos: [{ tipo: 'EXTERIOR', vertices }] })

    expect(tramos).toHaveLength(12)
    expect(tramos.every((t) => t.nLados === 3)).toBe(true)
    // Y ningún tramo abre más que la tolerancia entre su primer lado y su último.
    const n = vertices.length
    const azLado = (i) => azimut(vertices[i], vertices[(i + 1) % n])
    for (const t of tramos) {
      const desde = azLado(t.indiceInicio)
      const hasta = azLado((t.indiceInicio + t.nLados - 1) % n)
      const d = Math.abs(desde - hasta) % 360
      expect(Math.min(d, 360 - d)).toBeLessThanOrEqual(OPERATIVOS.rumboSimilarGrados)
    }
  })

  it('la sonda se usa de verdad: con un ε absurdo la atribución se cae', () => {
    // Mitad anti-vacuidad de la atribución: si `epsilonMetros` no llegara al
    // cálculo, este caso saldría idéntico al normal.
    const lejos = caso({ opciones: { epsilonMetros: 200 } })
    expect(lejos.tramos.every((t) => t.refcat === null)).toBe(true)
  })

  it('las tolerancias fuera de dominio LANZAN, con el nombre del argumento', () => {
    expect(() => caso({ opciones: { epsilonMetros: 0 } })).toThrow(RangeError)
    expect(() => caso({ opciones: { epsilonMetros: -1 } })).toThrow(/epsilonMetros/)
    expect(() => caso({ opciones: { epsilonMetros: '0,3' } })).toThrow(TypeError)
    expect(() => caso({ opciones: { rumboSimilarGrados: 0 } })).toThrow(RangeError)
    expect(() => caso({ opciones: { rumboSimilarGrados: 181 } })).toThrow(/rumboSimilarGrados/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Colindantes raras: las que el parcelario real acaba devolviendo
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · colindantes que no vienen como el manual', () => {
  it('una vecina SIN geometría no rompe nada y se cuenta en el texto', () => {
    // Es lo que produce el cableado cuando el Catastro devuelve una vecina sin
    // recintos (`app/cableado-diagnostico.js#aVecinas` no la filtra a propósito).
    // No puede contener a ninguna sonda, pero tampoco puede desaparecer.
    const conVacia = [{ refcat: 'X0000000X0000X', label: null, recintos: [] }, ...vecinas()]
    const r = describirLindero({ recintos: recintos(), vecinas: conVacia })
    expect(r.texto).toContain('1 parcela colindante aportada no trae geometría')
    expect(r.tramos.map((t) => t.refcat)).toEqual(caso().tramos.map((t) => t.refcat))
  })

  it('una vecina con `cp:label` y sin referencia catastral se nombra por el rótulo', () => {
    // `refcat: null` es un caso REAL (la plantilla oficial trae el elemento vacío).
    // Se dice lo que consta y se dice lo que no, sin dejar el hueco en la frase.
    const anonima = vecinas().map((v) =>
      v.refcat === '9398515VK3799G' ? { ...v, refcat: null } : v,
    )
    const r = describirLindero({ recintos: recintos(), vecinas: anonima })
    const so = r.tramos.find((t) => t.cardinal === 'Sudoeste')
    expect(so.refcat).toBe(null)
    expect(so.label).toBe('15')
    expect(r.texto).toContain(
      'con la parcela rotulada «15» en el parcelario catastral, de la que no consta referencia catastral',
    )
  })

  it('si dos colindantes se solapan gana la PRIMERA de la lista, y está declarado', () => {
    // Que dos parcelas del parcelario se pisen es una anomalía que señala el
    // diagnóstico de invasión (F07), no esta descripción. Aquí solo se fija un
    // criterio reproducible en vez de dejarlo al orden de iteración.
    const gemela = { ...clon(VECINAS.find((v) => v.refcat === '9398515VK3799G')), refcat: 'GEMELA' }
    const r = describirLindero({ recintos: recintos(), vecinas: [gemela, ...vecinas()] })
    expect(r.tramos.find((t) => t.cardinal === 'Sudoeste').refcat).toBe('GEMELA')
  })

  it('una vecina que no es un objeto LANZA nombrando su posición', () => {
    expect(() => describirLindero({ recintos: recintos(), vecinas: [null] })).toThrow(
      /vecinas\[0\]/,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Contrato: qué lanza (bug del programador) y qué no (dato del usuario)
// ═════════════════════════════════════════════════════════════════════════════

describe('report/literal · contrato del llamante', () => {
  it('lo que no es del contrato LANZA, nombrando el argumento y lo recibido', () => {
    expect(() => describirLindero()).toThrow(TypeError)
    expect(() => describirLindero(null)).toThrow(/se espera un objeto/)
    expect(() => describirLindero({ recintos: 'nada' })).toThrow(/'recintos'/)
    expect(() => describirLindero({ recintos: [] })).toThrow(RangeError)
    expect(() => describirLindero({ recintos: recintos(), opciones: [] })).toThrow(/'opciones'/)
  })

  it('el mensaje de `vecinas` EXPLICA por qué `null` y `[]` no son lo mismo', () => {
    // Un mensaje de error es el sitio donde se aprende un contrato: si solo dijera
    // «debe ser un array o null», el siguiente pasaría `[]` por comodidad.
    expect(() => describirLindero({ recintos: recintos(), vecinas: 3 })).toThrow(
      /no se han consultado/,
    )
  })

  it('no muta lo que recibe (regla de oro 2)', () => {
    const entrada = recintos()
    const antes = clon(entrada)
    describirLindero({ recintos: entrada, vecinas: vecinas() })
    expect(entrada).toEqual(antes)
  })

  it('devuelve las seis claves del contrato C, y solo esas', () => {
    const r = caso()
    expect(Object.keys(r).sort()).toEqual([
      'lindero',
      'notaTecnica',
      'saltados',
      'texto',
      'tramos',
      'vecinasConsultadas',
    ])
    expect(Object.keys(r.tramos[0]).sort()).toEqual([
      'azimut',
      'cardinal',
      'indiceFin',
      'indiceInicio',
      'label',
      'longitud',
      'nLados',
      'presuncionNoVerificada',
      'refcat',
    ])
  })
})
