// test/diagnostico/edificio.test.js — F14 · fase 1 · el contraste de la construcción.
//
// Las cifras de aquí NO están escritas a ojo: salen del edificio REAL de
// `9398516VK3799G` (13 partes, envolvente de DOS cuerpos) y de la huella que el
// propio Catastro publica para él, las dos leídas de los fixtures versionados. Es
// la «diana de oro» que F13 midió, ahora usada desde el otro lado.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  MOTIVO_CENTROIDE_DEGENERADO,
  MOTIVO_HUELLA_OFICIAL_NO_MEDIBLE,
  MOTIVO_NO_CONSULTADO,
  MOTIVO_NO_SE_HA_PODIDO,
  MOTIVO_SIN_CONSTRUCCIONES,
  MOTIVO_SIN_HUELLA_PROPIA,
  MOTIVO_SIN_PARCELA,
  OMISION_EDIFICIO,
  REGISTRO,
  contrastarEdificio,
} from '../../diagnostico/edificio.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { envolventeDe } from '../../edificio/envolvente.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import { superficie } from '../../geo/area.js'

// ── Los datos reales ─────────────────────────────────────────────────────────

const fixture = (nombre) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/gml/${nombre}`, import.meta.url)), 'utf8')

/** Las 13 partes reales → su envolvente derivada. DOS piezas, medido. */
function envolventeReal() {
  const { edificio } = entradaDesdeGmlBu(fixture('bu_buildingpart_9398516VK3799G.gml'))
  return envolventeDe(edificio.partes).recintos
}

/**
 * La huella que el Catastro PUBLICA para el mismo edificio.
 *
 * ⚠️ Se lee con `gml/parse-bu.js` y **no** con `edificio/entrada.js`, y es la
 * medida M1 de la fase 0: aquel módulo descarta la envolvente del `Building` a
 * propósito (detección `PATCHES_MULTIPLES`) porque su oficio es construir un
 * MODELO, y el modelo declara la envolvente derivada. Devuelve `edificio: null`.
 */
function huellaPublicada() {
  const { edificio } = parsearGmlBu(fixture('bu_building_9398516VK3799G.gml'))
  return edificio.anillos.map((anillo) => [{ vertices: anillo, tipo: 'EXTERIOR' }])
}

/** Un cuadrado de lado `l` con la esquina inferior izquierda en (x, y). */
const cuadrado = (x, y, l) => [
  {
    vertices: [
      [x, y],
      [x + l, y],
      [x + l, y + l],
      [x, y + l],
    ],
    tipo: 'EXTERIOR',
  },
]

// ── Las cifras de oro ────────────────────────────────────────────────────────
//
// ⛔ **La primera versión de estas constantes estaba MAL, y la corrida las tumbó.**
// Se habían transcrito de un `toFixed(4)` de la fase 0 —«5,2003»— en vez de
// medirse: `5.200287499999976` era un número inventado con aspecto de medido, y
// falló por 1,25·10⁻⁵. Éstas salen de imprimir el `float64` entero.
//
// ⭐ Y al medirlas de verdad apareció algo mejor de lo que F13 registró: la
// envolvente DERIVADA de las 13 partes y la huella PUBLICADA por el Catastro no
// coinciden «vértice a vértice» y ya está — **coinciden a 1,7·10⁻¹³ m²**, o sea a
// trece cifras significativas. Es el mismo número en coma flotante salvo el último
// bit del orden de la suma.
const AREA_PIEZA_1 = 5.200300000132109
const AREA_PIEZA_2 = 316.9279499971397
const AREA_TOTAL = 322.12824999727184
/** Lo que se separan la derivada y la publicada, MEDIDO. Es el techo de la diana. */
const RUIDO_DIANA = 1e-12

describe('diagnostico/edificio · los datos de partida son los reales', () => {
  it('la envolvente derivada son DOS cuerpos que suman 322,13 m²', () => {
    const piezas = envolventeReal()
    expect(piezas).toHaveLength(2)
    expect(superficie(piezas[0])).toBeCloseTo(AREA_PIEZA_1, 9)
    expect(superficie(piezas[1])).toBeCloseTo(AREA_PIEZA_2, 9)
  })

  it('la huella publicada por el Catastro son DOS caras que suman lo mismo', () => {
    const caras = huellaPublicada()
    expect(caras).toHaveLength(2)
    expect(caras.reduce((s, c) => s + superficie(c), 0)).toBeCloseTo(AREA_TOTAL, 9)
  })

  it('⭐ derivada y publicada coinciden a 1,7·10⁻¹³ m², no «aproximadamente»', () => {
    // Es la diana de oro de F13 medida desde el otro lado, y con su número. Si
    // algún día `envolventeDe` cambia de fórmula, esta prueba lo dice antes de que
    // lo diga la Sede.
    const derivada = envolventeReal().map(superficie)
    const publicada = huellaPublicada().map(superficie)
    expect(derivada).toHaveLength(publicada.length)
    derivada.forEach((area, i) => {
      expect(Math.abs(area - publicada[i])).toBeLessThan(RUIDO_DIANA)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// ⛔ LA PROPIEDAD QUE SOSTIENE EL MÓDULO ENTERO: PIEZA A PIEZA
// ═════════════════════════════════════════════════════════════════════════════

describe('diagnostico/edificio · la envolvente NO se aplana', () => {
  // La fase 0 midió que aplanar produce un error SILENCIOSO de 316,93 m² (el
  // 98,4 %), porque `coordsRegion` mira la posición y no el `tipo` y toma el
  // segundo cuerpo por un hueco del primero. Estas tres pruebas afirman que este
  // módulo NO pasa por ahí — y la tercera reproduce el defecto para que quede
  // escrito qué se está evitando, no solo que se evita.

  it('la huella medida es la SUMA de las piezas, no la primera ni la resta', () => {
    const c = contrastarEdificio({ envolvente: envolventeReal() })
    expect(c.huella.medida).toBeCloseTo(AREA_TOTAL, 9)
    expect(c.huella.nPiezasMedida).toBe(2)
    // Los dos resultados que daría un aplanado, descartados con su número:
    expect(c.huella.medida).not.toBeCloseTo(AREA_PIEZA_1, 2) // «me quedo con la 1.ª»
    expect(c.huella.medida).not.toBeCloseTo(AREA_PIEZA_2 - AREA_PIEZA_1, 2) // «la 2.ª es un hueco»
  })

  it('el solape del edificio real consigo mismo es su superficie ENTERA', () => {
    // Es la prueba que un aplanado suspende: daría 5,20 m² en vez de 322,13.
    const piezas = envolventeReal()
    const c = contrastarEdificio({
      envolvente: piezas,
      huellaOficial: piezas,
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.solape.area).toBeCloseTo(AREA_TOTAL, 4)
    expect(c.solape.relativo).toBeCloseTo(1, 6)
    expect(c.diferencia.area).toBeCloseTo(0, 4)
  })

  it('pasar un Recinto[] donde van PIEZAS lanza, en vez de medir otra cosa', () => {
    // El error real que esta guarda caza: `envolventeDe(...).recintos` es
    // `Array<Recinto[]>`, y quien escriba `.recintos.flat()` o pase la geometría de
    // una parcela se lleva un mensaje que nombra la causa, no un número raro.
    const recintosSueltos = cuadrado(0, 0, 10) // Recinto[], no Pieza[]
    expect(() => contrastarEdificio({ envolvente: recintosSueltos })).toThrow(
      /'envolvente\[0\]' debe ser un array de recintos/,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LA DIANA DE ORO
// ═════════════════════════════════════════════════════════════════════════════

describe('diagnostico/edificio · la envolvente derivada contra la publicada', () => {
  it('coinciden: diferencia 0,00 m² y solape del 100 %', () => {
    const c = contrastarEdificio({
      envolvente: envolventeReal(),
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.huella.medida).toBeCloseTo(AREA_TOTAL, 9)
    expect(c.huella.oficial).toBeCloseTo(AREA_TOTAL, 9)
    expect(c.huella.diferencia).toBeCloseTo(0, 9)
    expect(c.huella.nCarasOficial).toBe(2)
    expect(c.solape.relativo).toBeCloseTo(1, 5)
    expect(c.diferencia.area).toBeCloseTo(0, 3)
    expect(c.centroides.distancia).toBeCloseTo(0, 6)
    // ⚠️ `omisiones` NO está vacío, y está bien que no lo esté: esta llamada no
    // trae parcela, así que «cuánto cae dentro» no se ha podido medir y el módulo
    // lo dice. Lo que se afirma es que **ninguna sección del CONTRASTE** se ha
    // quedado sin medir — que es lo que esta prueba viene a comprobar.
    expect(c.omisiones.map((o) => o.que)).toEqual([OMISION_EDIFICIO.EN_PARCELA])
  })

  it('el perímetro también se suma por piezas, y separa exterior de huecos', () => {
    const c = contrastarEdificio({ envolvente: envolventeReal() })
    expect(c.huella.perimetroMedido.total).toBeGreaterThan(0)
    expect(c.huella.perimetroMedido.huecos).toBe(0) // el edificio real no tiene patios
    expect(c.huella.perimetroMedido.exterior).toBeCloseTo(c.huella.perimetroMedido.total, 9)
  })
})

describe('diagnostico/edificio · una construcción que NO coincide', () => {
  // Dos cuadrados de 10 m solapados en la mitad: la aritmética se puede comprobar
  // a mano, que es lo que hace útil un caso sintético al lado de uno real.
  const medida = [cuadrado(0, 0, 10)] // 100 m²
  const oficial = [cuadrado(5, 0, 10)] // 100 m², desplazado 5 m en X

  it('mide el solape, la diferencia simétrica y el desplazamiento', () => {
    const c = contrastarEdificio({
      envolvente: medida,
      huellaOficial: oficial,
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.huella.medida).toBeCloseTo(100, 9)
    expect(c.huella.oficial).toBeCloseTo(100, 9)
    expect(c.huella.diferencia).toBeCloseTo(0, 9) // misma superficie, distinto sitio
    expect(c.solape.area).toBeCloseTo(50, 9) // 5 m × 10 m
    expect(c.solape.relativo).toBeCloseTo(0.5, 9)
    expect(c.diferencia.area).toBeCloseTo(100, 9) // 100 + 100 − 2·50
    expect(c.centroides.distancia).toBeCloseTo(5, 9)
  })

  // ── Las tres propiedades que una mutación VERDE destapó ───────────────────
  //
  // Las tres estaban implementadas y ninguna prueba las distinguía de su versión
  // rota, porque todos los casos de arriba son simétricos: mismas superficies,
  // mismas piezas y en el mismo orden. Una prueba que no puede fallar no protege.

  it('⭐ el solape relativo se mide sobre la MAYOR de las dos huellas', () => {
    // Con las dos iguales, «sobre la mayor» y «sobre la medida» dan lo mismo y la
    // diferencia es invisible. Aquí lo oficial es cuatro veces lo medido.
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10)], // 100 m², enteramente dentro
      huellaOficial: [cuadrado(0, 0, 20)], // 400 m²
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.solape.area).toBeCloseTo(100, 9)
    expect(c.solape.relativo).toBeCloseTo(0.25, 9) // 100 / 400, no 100 / 100
  })

  it('⭐ el centroide del conjunto se pondera por ÁREA, no es la media de los centros', () => {
    // Dos cuerpos muy desiguales: 100 m² en (5,5) y 400 m² en (110,10).
    //   ponderado   = ((100·5 + 400·110)/500, (100·5 + 400·10)/500) = (89, 9)
    //   sin ponderar= ((5 + 110)/2, (5 + 10)/2)                     = (57,5 ; 7,5)
    // La huella oficial es UN cuadrado centrado justo en el ponderado, así que la
    // distancia sale 0 si se pondera y ~31,5 m si no.
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10), cuadrado(100, 0, 20)],
      huellaOficial: [cuadrado(88, 8, 2)], // centro exacto (89, 9)
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.centroides.medido[0]).toBeCloseTo(89, 9)
    expect(c.centroides.medido[1]).toBeCloseTo(9, 9)
    expect(c.centroides.distancia).toBeCloseTo(0, 9)
  })

  it('⭐ el solape cruza TODAS las piezas con TODAS las caras, no por índice', () => {
    // Los dos cuerpos están en el mismo sitio en las dos listas, pero en ORDEN
    // INVERSO. Emparejar por índice daría 0 m² de solape sobre dos huellas que
    // coinciden al 100 %, y sería un error mudo: el orden de los `PolygonPatch`
    // del Catastro no tiene por qué ser el de nuestra derivación.
    const a = cuadrado(0, 0, 10)
    const b = cuadrado(100, 0, 10)
    const c = contrastarEdificio({
      envolvente: [a, b],
      huellaOficial: [b, a], // las mismas, al revés
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.solape.area).toBeCloseTo(200, 9)
    expect(c.solape.relativo).toBeCloseTo(1, 9)
    expect(c.diferencia.area).toBeCloseTo(0, 9)
  })

  it('la diferencia de superficie lleva el signo: positivo = medimos MÁS', () => {
    const grande = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 12)], // 144
      huellaOficial: oficial,
      registro: REGISTRO.CONSULTADO,
    })
    expect(grande.huella.diferencia).toBeCloseTo(44, 9)

    const pequena = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 8)], // 64
      huellaOficial: oficial,
      registro: REGISTRO.CONSULTADO,
    })
    expect(pequena.huella.diferencia).toBeCloseTo(-36, 9)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LOS CUATRO SABORES DE «NO HAY»
// ═════════════════════════════════════════════════════════════════════════════

describe('diagnostico/edificio · los cuatro sabores de «no hay»', () => {
  const soloMedida = { envolvente: [cuadrado(0, 0, 10)] }

  it('SIN_CONSTRUCCIONES · la pantalla honesta dice que no invalida nada', () => {
    const c = contrastarEdificio({ ...soloMedida, registro: REGISTRO.SIN_CONSTRUCCIONES })

    expect(c.registro.clave).toBe(REGISTRO.SIN_CONSTRUCCIONES)
    expect(c.registro.motivo).toBe(MOTIVO_SIN_CONSTRUCCIONES)
    // Las dos mitades que la ficha pide, comprobadas por lo que AFIRMAN y no por
    // la forma del texto: que no consta, y que eso no invalida el GML.
    expect(c.registro.motivo).toMatch(/no consta construcción registrada/i)
    expect(c.registro.motivo).toMatch(/plenamente válido/i)

    // ⭐ Y NO se inventa geometría de referencia: criterio de aceptación 1.
    expect(c.huella.oficial).toBeNull()
    expect(c.huella.nCarasOficial).toBeNull()
    expect(c.solape).toBeNull()
    expect(c.diferencia).toBeNull()
    expect(c.centroides).toBeNull()
    // Pero lo PROPIO sí se mide: el técnico ve su construcción aunque no haya con
    // qué compararla.
    expect(c.huella.medida).toBeCloseTo(100, 9)
  })

  it('NO_CONSULTADO · «no se ha mirado» no se escribe como «no hay»', () => {
    const c = contrastarEdificio({ ...soloMedida, registro: REGISTRO.NO_CONSULTADO })
    expect(c.registro.motivo).toBe(MOTIVO_NO_CONSULTADO)
    expect(c.registro.motivo).not.toBe(MOTIVO_SIN_CONSTRUCCIONES)
    // La frase dice explícitamente que no es lo mismo.
    expect(c.registro.motivo).toMatch(/no es lo mismo que no haber nada/i)
  })

  it('NO_SE_HA_PODIDO · un fallo de red no se presenta como «no consta»', () => {
    const c = contrastarEdificio({ ...soloMedida, registro: REGISTRO.NO_SE_HA_PODIDO })
    expect(c.registro.motivo).toBe(MOTIVO_NO_SE_HA_PODIDO)
    expect(c.registro.motivo).toMatch(/no se sabe si hay alguna o no/i)
  })

  it('los tres estados sin huella dan motivos DISTINTOS en las omisiones', () => {
    const motivos = [
      REGISTRO.NO_CONSULTADO,
      REGISTRO.SIN_CONSTRUCCIONES,
      REGISTRO.NO_SE_HA_PODIDO,
    ].map((registro) => {
      const c = contrastarEdificio({ ...soloMedida, registro })
      return c.omisiones.find((o) => o.que === OMISION_EDIFICIO.SOLAPE).motivo
    })
    // Tres motivos, tres textos: si dos coincidieran, dos hechos distintos se
    // estarían contando igual y la distinción sería decorativa.
    expect(new Set(motivos).size).toBe(3)
  })

  it('CONSULTADO sin huella LANZA: sería prometer un contraste imposible', () => {
    expect(() =>
      contrastarEdificio({ ...soloMedida, registro: REGISTRO.CONSULTADO }),
    ).toThrow(/'registro' es CONSULTADO pero 'huellaOficial' es null/)
  })

  it('un registro desconocido LANZA y enumera los cuatro', () => {
    expect(() => contrastarEdificio({ ...soloMedida, registro: 'QUIZAS' })).toThrow(
      /registro' desconocido.*NO_CONSULTADO, SIN_CONSTRUCCIONES, NO_SE_HA_PODIDO, CONSULTADO/s,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LA PARCELA Y LAS COLINDANTES
// ═════════════════════════════════════════════════════════════════════════════

describe('diagnostico/edificio · cuánto cae dentro de la parcela', () => {
  it('mide la superficie de dentro y la de fuera, y suman la huella', () => {
    // Construcción de 10×10 con la mitad fuera de una parcela de 5×10.
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10)],
      parcelaContexto: [{ vertices: [[0, 0], [5, 0], [5, 10], [0, 10]], tipo: 'EXTERIOR' }],
    })
    expect(c.enParcela.superficieDentro).toBeCloseTo(50, 9)
    expect(c.enParcela.superficieFuera).toBeCloseTo(50, 9)
    expect(c.enParcela.relativo).toBeCloseTo(0.5, 9)
    // El invariante que impide que las dos cifras se separen por redondeo.
    expect(c.enParcela.superficieDentro + c.enParcela.superficieFuera).toBeCloseTo(
      c.huella.medida,
      9,
    )
  })

  it('sin parcela la sección va a null CON su motivo, no a cero', () => {
    const c = contrastarEdificio({ envolvente: [cuadrado(0, 0, 10)] })
    expect(c.enParcela).toBeNull()
    expect(c.omisiones).toContainEqual({
      que: OMISION_EDIFICIO.EN_PARCELA,
      motivo: MOTIVO_SIN_PARCELA,
    })
  })

  it('una construcción entera dentro da 0 m² fuera, y eso SÍ es un cero', () => {
    const c = contrastarEdificio({
      envolvente: [cuadrado(2, 2, 5)],
      parcelaContexto: [{ vertices: [[0, 0], [20, 0], [20, 20], [0, 20]], tipo: 'EXTERIOR' }],
    })
    expect(c.enParcela.superficieFuera).toBeCloseTo(0, 9)
    expect(c.enParcela.relativo).toBeCloseTo(1, 9)
  })
})

describe('diagnostico/edificio · invasión a colindantes', () => {
  const vecina = (refcat, x) => ({
    refcat,
    recintos: [{ vertices: [[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]], tipo: 'EXTERIOR' }],
  })

  it('null y [] NO se representan igual', () => {
    const sinConsultar = contrastarEdificio({ envolvente: [cuadrado(0, 0, 10)] })
    expect(sinConsultar.invasion.consultado).toBe(false)
    expect(sinConsultar.invasion.invasiones).toEqual([])

    const consultado = contrastarEdificio({ envolvente: [cuadrado(0, 0, 10)], vecinas: [] })
    expect(consultado.invasion.consultado).toBe(true)
    expect(consultado.invasion.invasiones).toEqual([])
  })

  it('la invasión sale con su superficie y su referencia catastral', () => {
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10)],
      vecinas: [vecina('1111111AA1111A', 6)], // pisa 4 m × 10 m
    })
    expect(c.invasion.invasiones).toHaveLength(1)
    expect(c.invasion.invasiones[0].refcat).toBe('1111111AA1111A')
    expect(c.invasion.invasiones[0].area).toBeCloseTo(40, 9)
  })

  it('⭐ dos cuerpos que pisan la MISMA vecina son UNA invasión con la suma', () => {
    // Sin acumular por vecina, la lista traería dos entradas de la misma parcela y
    // quien la lea tendría que sumarlas de cabeza para saber cuánto la invade.
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10), cuadrado(0, 20, 10)],
      vecinas: [
        {
          refcat: '2222222BB2222B',
          recintos: [{ vertices: [[6, 0], [16, 0], [16, 30], [6, 30]], tipo: 'EXTERIOR' }],
        },
      ],
    })
    expect(c.invasion.invasiones).toHaveLength(1)
    expect(c.invasion.invasiones[0].area).toBeCloseTo(80, 9) // 40 + 40
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// LA REGLA DE ORO 9
// ═════════════════════════════════════════════════════════════════════════════

describe('diagnostico/edificio · la regla de oro 9, sobre el objeto REAL', () => {
  // Misma lista y mismo método que el guardián de F07: se recorre el objeto
  // recursivamente en vez de comprobar una lista de claves escrita a mano, que se
  // quedaría corta en cuanto el contrato crezca.
  const PROHIBIDAS =
    /^(ok|valido|válido|apto|aprobado|aceptable|dentro|cumple|supera|excede|semaforo|semáforo|umbral|tolerancia|nivel|color|estado|veredicto|correcto|conforme)/i

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

  it('ninguna clave del resultado, a ninguna profundidad, es de veredicto', () => {
    const c = contrastarEdificio({
      envolvente: envolventeReal(),
      huellaOficial: huellaPublicada(),
      registro: REGISTRO.CONSULTADO,
      parcelaContexto: [
        { vertices: [[439200, 4479600], [439300, 4479600], [439300, 4479700], [439200, 4479700]], tipo: 'EXTERIOR' },
      ],
      vecinas: [
        {
          refcat: '3333333CC3333C',
          recintos: [{ vertices: [[439300, 4479600], [439400, 4479600], [439400, 4479700], [439300, 4479700]], tipo: 'EXTERIOR' }],
        },
      ],
    })

    const claves = clavesProfundas(c)
    expect(claves.length).toBeGreaterThan(25) // el guardián mira algo, no un objeto vacío
    for (const clave of claves) {
      expect(clave, `la clave '${clave}' parece un veredicto`).not.toMatch(PROHIBIDAS)
    }
  })

  it('un desfase minúsculo y uno enorme dan la MISMA forma de resultado', () => {
    // Que la función no distinga «poco» de «mucho» es la propiedad, no una carencia:
    // interpretar es del colegiado que firma.
    const forma = (c) => JSON.stringify(Object.keys(c).sort())
    const casi = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10)],
      huellaOficial: [cuadrado(0.001, 0, 10)],
      registro: REGISTRO.CONSULTADO,
    })
    const lejos = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10)],
      huellaOficial: [cuadrado(500, 0, 10)],
      registro: REGISTRO.CONSULTADO,
    })
    expect(forma(casi)).toBe(forma(lejos))
    // Y el caso disjunto no se calla: mide 0 de solape, que es un dato.
    expect(lejos.solape.area).toBeCloseTo(0, 9)
    expect(lejos.diferencia.area).toBeCloseTo(200, 9)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CASOS LÍMITE Y CONTRATO
// ═════════════════════════════════════════════════════════════════════════════

describe('diagnostico/edificio · casos límite', () => {
  it('una construcción SIN huella sobre rasante lo dice, y no da 0 m² a secas', () => {
    const c = contrastarEdificio({
      envolvente: [],
      huellaOficial: [cuadrado(0, 0, 10)],
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.huella.medida).toBe(0)
    expect(c.huella.nPiezasMedida).toBe(0)
    expect(c.solape).toBeNull()
    expect(c.omisiones).toContainEqual({
      que: OMISION_EDIFICIO.SOLAPE,
      motivo: MOTIVO_SIN_HUELLA_PROPIA,
    })
  })

  it('una pieza degenerada no cuenta ni arrastra el centroide', () => {
    const conAstilla = [cuadrado(0, 0, 10), cuadrado(1000, 1000, 0.0001)]
    const c = contrastarEdificio({
      envolvente: conAstilla,
      huellaOficial: [cuadrado(0, 0, 10)],
      registro: REGISTRO.CONSULTADO,
    })
    expect(c.huella.nPiezasMedida).toBe(1) // la astilla no llega a pieza
    expect(c.centroides.distancia).toBeCloseTo(0, 6) // y no tira del centroide a (1000,1000)
  })

  it('dos huellas sin superficie no solapan «el 0 %»: la pregunta no tiene respuesta', () => {
    const c = contrastarEdificio({
      envolvente: [],
      huellaOficial: [],
      registro: REGISTRO.CONSULTADO,
    })
    // `huellaOficial: []` es una lista vacía, no `null`: se consultó, había
    // colección, y no quedó ninguna cara medible.
    expect(c.huella.oficial).toBeNull()
    expect(c.solape).toBeNull()
  })

  it('el centroide degenerado se distingue de «no hay oficial»', () => {
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10)],
      huellaOficial: [[{ vertices: [[0, 0], [1, 0], [2, 0]], tipo: 'EXTERIOR' }]],
      registro: REGISTRO.CONSULTADO,
    })
    // Tres puntos alineados: no encierran área, así que no hay cara medible.
    const centro = c.omisiones.find((o) => o.que === OMISION_EDIFICIO.CENTROIDES)
    expect(centro).toBeDefined()
    // ⭐ Y desde la auditoría del 2026-08-16 la distinción que este `it` promete
    // es de verdad: antes, una huella CONSULTADA pero sin cara medible caía en
    // `MOTIVO_NO_CONSULTADO` —«Todavía no se ha consultado al Catastro…»—, que era
    // FALSO y mandaba al técnico a repetir una consulta ya hecha. Ahora tiene
    // motivo propio, así que se afirma ese y no «uno de estos dos».
    expect(centro.motivo).toBe(MOTIVO_HUELLA_OFICIAL_NO_MEDIBLE)
    expect(centro.motivo).not.toBe(MOTIVO_NO_CONSULTADO)
  })

  it('los saltados se deduplican: N×M cruces no son N×M copias del mismo aviso', () => {
    const c = contrastarEdificio({
      envolvente: [cuadrado(0, 0, 10), cuadrado(20, 0, 10)],
      huellaOficial: [cuadrado(0, 0, 10), cuadrado(20, 0, 10)],
      registro: REGISTRO.CONSULTADO,
    })
    const claves = c.saltados.map((s) => `${s.donde}|${s.indice}|${s.motivo}`)
    expect(new Set(claves).size).toBe(claves.length)
  })
})

describe('diagnostico/edificio · contrato del programador', () => {
  it('sin objeto de entrada, lanza nombrando lo que se espera', () => {
    expect(() => contrastarEdificio()).toThrow(/un objeto de entrada \{envolvente/)
    expect(() => contrastarEdificio(null)).toThrow(/un objeto de entrada/)
    expect(() => contrastarEdificio([])).toThrow(/un objeto de entrada/)
  })

  it('una pieza vacía lanza diciendo qué es una pieza', () => {
    expect(() => contrastarEdificio({ envolvente: [[]] })).toThrow(
      /'envolvente\[0\]' está vacía/,
    )
  })

  it("'vecinas' mal formadas lanzan, y el mensaje distingue null de []", () => {
    expect(() =>
      contrastarEdificio({ envolvente: [cuadrado(0, 0, 10)], vecinas: 'ninguna' }),
    ).toThrow(/null = no se ha consultado, \[\] = se consultó y no hay ninguna/)
  })

  it('el invariante EXTERIOR/HUECO roto SUBE, y es la guarda que caza el aplanado', () => {
    // Exactamente el error de la fase 0: dos cuerpos metidos en una sola pieza.
    const aplanada = [[...cuadrado(0, 0, 10), ...cuadrado(20, 0, 10)]]
    expect(() => contrastarEdificio({ envolvente: aplanada })).toThrow(
      /recintos\[1\] debe ser HUECO/,
    )
  })
})
