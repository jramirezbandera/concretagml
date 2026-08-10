/* -------------------------------------------------------------------------- *
 * test/comprobacion/conjunto.test.js — F17 · tarea 2.2                         *
 *                                                                              *
 * El CIERRE del conjunto: si las N parcelas del envío cubren exactamente el     *
 * trozo de parcelario que dicen cubrir. Es lo que juzga el IVG, y no se puede   *
 * comprobar mirando una parcela.                                                *
 *                                                                              *
 * Lo que este fichero defiende, por orden de importancia:                       *
 *                                                                              *
 *   1. ⛔ **QUE HAGAN FALTA LAS TRES AFIRMACIONES.** Se construyen los dos       *
 *      casos que lo demuestran: un solape de 20 m² y un hueco de 20 m² que      *
 *      dejan la suma **EXACTA**, y un hueco de 0,32 m² que la suma tampoco ve.  *
 *      Si alguien redujera esto a «Σ áreas == área oficial», los dos tests se   *
 *      pondrían rojos. Ésa es toda la razón de ser del fichero.                 *
 *   2. ⛔ **QUE SE MIDA SOBRE LO REDONDEADO.** El fichero lleva 2 decimales, y   *
 *      verificar en float64 para romperse al redondear es el fallo silencioso   *
 *      de manual.                                                               *
 *   3. ⭐ **LA DISTRIBUCIÓN DE RESIDUOS SOBRE GEOMETRÍA REAL**, que es lo que    *
 *      fija la tolerancia: doce recortes sobre el expediente de oro, con sus    *
 *      cifras. Es la medición que refutó el umbral fijo que este módulo llegó   *
 *      a llevar escrito.                                                        *
 *   4. Que «no se ha podido medir» no se confunda con «cierra»: `cierra` tiene  *
 *      TRES estados.                                                            *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'

import {
  DESPLAZAMIENTO_MAXIMO_COORD_M,
  GROSOR_REDONDEO_M,
  comprobarConjunto,
  toleranciaCierre,
} from '../../comprobacion/conjunto.js'
import { TIPO_COMPROBACION } from '../../comprobacion/_comun.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { derivarCesion } from '../../derivacion/cesion.js'
import { prepararRecintos } from '../../gml/anillos.js'
import { parsearGml } from '../../gml/parse.js'

// ── Arnés ────────────────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

const rect = (x0, y0, x1, y1) => [
  {
    tipo: 'EXTERIOR',
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  },
]

const tipos = (ds) => ds.map((d) => d.tipo)
const errores = (c) => c.detecciones.filter((d) => d.severidad === 'ERROR').map((d) => d.tipo)

/** La geometría OFICIAL del expediente de oro (`SPEC.md` §7.1, IVG positivo). */
const ORO = parsearGml(
  readFileSync(
    join(RAIZ, 'test', 'fixtures', 'gml', 'cp_parcela_7136910UF1473N.gml'),
    'utf8',
  ).replaceAll('\r\n', '\n'),
).parcelas[0].recintos

/**
 * Recorta un anillo por el semiplano `x ≤ lim` (Sutherland-Hodgman). Sirve para
 * simular «mover el lindero este hacia dentro», que es lo que crea los vértices
 * FUERA de la retícula de 2 decimales: el caso feo del redondeo.
 */
const recortar = (anilloAbierto, lim) => {
  const salida = []
  for (let i = 0; i < anilloAbierto.length; i++) {
    const a = anilloAbierto[i]
    const b = anilloAbierto[(i + 1) % anilloAbierto.length]
    const dentroA = a[0] <= lim
    const dentroB = b[0] <= lim
    if (dentroA) salida.push(a)
    if (dentroA !== dentroB) {
      const t = (lim - a[0]) / (b[0] - a[0])
      salida.push([lim, a[1] + t * (b[1] - a[1])])
    }
  }
  return salida
}

const X_MAX = Math.max(...ORO[0].vertices.map((v) => v[0]))

/** Deriva el expediente completo de un recorte de `d` metros sobre el oro. */
function expedienteRecortado(d) {
  const editada = [{ tipo: 'EXTERIOR', vertices: recortar(ORO[0].vertices, X_MAX - d) }]
  const cesion = derivarCesion({ recintos: editada, geometriaOficial: ORO })
  return {
    editada,
    cesion,
    miembros: [
      { etiqueta: 'matriz', recintos: editada },
      ...cesion.piezas.map((p) => ({ etiqueta: `cesión ${p.orden}`, recintos: p.recintos })),
    ],
  }
}

// ── 1 · ⛔ Por qué son TRES afirmaciones y no una ────────────────────────────

describe('comprobarConjunto · la suma sola NO basta, y aquí está el porqué', () => {
  it('⛔⭐ un solape de 20 m² y un hueco de 20 m² dejan la suma EXACTA', () => {
    // El caso de manual, construido para que el residuo sea CERO: 120 + 80 = 200,
    // que es justo el contorno oficial. Y el parcelario está roto por los dos
    // lados a la vez. Con `Σ áreas == área oficial` como única afirmación, esto
    // saldría verde.
    const c = comprobarConjunto({
      geometriaOficial: rect(0, 0, 20, 10),
      miembros: [
        { etiqueta: 'A', recintos: rect(0, 0, 12, 10) },
        { etiqueta: 'B', recintos: rect(10, 0, 18, 10) },
      ],
    })
    expect(c.suma.residuo).toBe(0)
    expect(c.suma.cumple).toBe(true) // ← la afirmación (a) pasa

    expect(c.solapes.cumple).toBe(false)
    expect(c.solapes.pares).toHaveLength(1)
    expect(c.solapes.pares[0]).toMatchObject({ a: 'A', b: 'B' })
    expect(c.solapes.pares[0].area).toBeCloseTo(20, 9)

    expect(c.cobertura.cumple).toBe(false)
    expect(c.cobertura.area).toBeCloseTo(20, 9)

    expect(c.cierra).toBe(false)
    expect(errores(c).sort()).toEqual([
      TIPO_COMPROBACION.COBERTURA_INCOMPLETA,
      TIPO_COMPROBACION.MIEMBROS_SOLAPADOS,
    ])
  })

  it('⛔⭐ un hueco pequeño sobre geometría REAL que la suma tampoco ve', () => {
    // La cesión derivada del oro, desplazada 2 cm hacia dentro: deja una tira de
    // 0,32 m² sin dueño. El residuo de la suma se queda en 0,04 m², muy por debajo
    // de la tolerancia, así que (a) da verde. Lo caza (c).
    const { cesion, editada } = expedienteRecortado(3)
    const desplazada = cesion.piezas[0].recintos.map((r) => ({
      tipo: r.tipo,
      vertices: r.vertices.map(([x, y]) => [x + 0.02, y]),
    }))
    const c = comprobarConjunto({
      geometriaOficial: ORO,
      miembros: [
        { etiqueta: 'matriz', recintos: editada },
        { etiqueta: 'cesión 1', recintos: desplazada },
      ],
    })
    expect(c.suma.cumple).toBe(true) // ← (a) no lo ve
    expect(Math.abs(c.suma.residuo)).toBeLessThan(c.suma.toleranciaM2)
    expect(c.cobertura.cumple).toBe(false) // ← (c) sí
    expect(c.cobertura.area).toBeGreaterThan(0.3)
    expect(c.cobertura.huecos[0].grosor).toBeGreaterThan(GROSOR_REDONDEO_M)
    expect(c.cierra).toBe(false)
    expect(errores(c)).toEqual([TIPO_COMPROBACION.COBERTURA_INCOMPLETA])
  })

  it('falta un miembro entero: fallan (a) y (c), que es lo esperable', () => {
    const { editada, cesion } = expedienteRecortado(3)
    const c = comprobarConjunto({
      geometriaOficial: ORO,
      miembros: [{ etiqueta: 'matriz', recintos: editada }],
    })
    expect(c.cierra).toBe(false)
    expect(c.suma.residuo).toBeCloseTo(-cesion.piezas[0].area, 1)
    expect(c.cobertura.area).toBeCloseTo(cesion.piezas[0].area, 1)
    expect(errores(c).sort()).toEqual([
      TIPO_COMPROBACION.COBERTURA_INCOMPLETA,
      TIPO_COMPROBACION.SUMA_DISCREPANTE,
    ])
  })

  it('el conjunto CORRECTO da las tres en verde, cada una con su tipo', () => {
    const { miembros } = expedienteRecortado(3)
    const c = comprobarConjunto({ geometriaOficial: ORO, miembros })
    expect(c.cierra).toBe(true)
    expect(tipos(c.detecciones)).toEqual([
      TIPO_COMPROBACION.SUMA_COTEJADA,
      TIPO_COMPROBACION.SIN_SOLAPE,
      TIPO_COMPROBACION.COBERTURA_VERIFICADA,
    ])
    // ⛔ Las tres hablan aunque no haya nada que decir: una comprobación que sólo
    // habla cuando falla no se distingue de una que no se ha ejecutado.
    expect(c.detecciones.every((d) => d.severidad === 'INFO')).toBe(true)
  })

  it('un expediente de UNA parcela también se comprueba (es una Subsanación)', () => {
    const misma = rect(0, 0, 20, 10)
    const c = comprobarConjunto({ geometriaOficial: misma, miembros: [{ recintos: misma }] })
    expect(c.cierra).toBe(true)
    expect(c.miembros[0].etiqueta).toBe('miembro 1') // nunca «undefined»
    expect(c.detecciones[1].mensaje).toMatch(/Solo hay una parcela/)
  })
})

// ── 2 · ⛔ Sobre lo REDONDEADO, que es lo que va al fichero ──────────────────

describe('comprobarConjunto · mide el polígono que se entrega, no el del modelo', () => {
  it('las superficies son las de `prepararRecintos`, la misma del serializador', () => {
    const { miembros } = expedienteRecortado(3)
    const c = comprobarConjunto({ geometriaOficial: ORO, miembros })
    expect(c.suma.areaOficial).toBe(prepararRecintos(ORO).superficieRedondeada)
    miembros.forEach((m, i) => {
      const p = prepararRecintos(m.recintos)
      expect(c.miembros[i].superficieRedondeada).toBe(p.superficieRedondeada)
      // Y `areaValue` es EXACTAMENTE el entero que iría al `cp:areaValue`.
      expect(c.miembros[i].areaValue).toBe(p.areaValue)
    })
  })

  it('la superficie del modelo se conserva al lado, para ver qué costó redondear', () => {
    const { miembros } = expedienteRecortado(3)
    const c = comprobarConjunto({ geometriaOficial: ORO, miembros })
    const matriz = c.miembros[0]
    expect(matriz.superficieModelo).not.toBe(matriz.superficieRedondeada)
    expect(Math.abs(matriz.superficieModelo - matriz.superficieRedondeada)).toBeLessThan(0.1)
  })
})

// ── 3 · ⭐ La distribución de residuos sobre geometría REAL ──────────────────

describe('comprobarConjunto · lo medido sobre el expediente de oro', () => {
  const RECORTES = [0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 12]

  it('⭐ los doce recortes CIERRAN, y el peor residuo queda diez veces por debajo', () => {
    // Ésta es la medición que fija la tolerancia, y la que refutó el umbral FIJO de
    // 0,01 m² que este módulo llegó a llevar escrito: con él, la mitad de estos
    // doce habría dado falso positivo sobre un expediente perfectamente cerrado.
    let peorResiduo = 0
    let toleranciaMinima = Infinity
    for (const d of RECORTES) {
      const c = comprobarConjunto({ geometriaOficial: ORO, miembros: expedienteRecortado(d).miembros })
      expect(c.cierra, `el recorte de ${d} m no cierra`).toBe(true)
      peorResiduo = Math.max(peorResiduo, Math.abs(c.suma.residuo))
      toleranciaMinima = Math.min(toleranciaMinima, c.suma.toleranciaM2)
    }
    // Distribución medida el 2026-08-05: el peor residuo es 0,1008 m².
    expect(peorResiduo).toBeGreaterThan(0.09)
    expect(peorResiduo).toBeLessThan(0.11)
    // ⛔ Y es MAYOR QUE CERO en todos los casos útiles: eso es lo que descarta el `==`.
    expect(peorResiduo).toBeGreaterThan(0)
    expect(toleranciaMinima / peorResiduo).toBeGreaterThan(10)
  })

  it('⭐ arrastrar un vértice existente da residuo CERO exacto, y ninguna cuña', () => {
    // El caso que de verdad hace F17. No crea ningún vértice nuevo, así que no hay
    // nada que redondear fuera de sitio: el cierre es exacto. Saberlo importa,
    // porque explica por qué el caso feo es el del corte y no el del arrastre.
    const movida = ORO[0].vertices.map((v, i) => (i === 3 ? [v[0] - 2, v[1] - 2] : v))
    const editada = [{ tipo: 'EXTERIOR', vertices: movida }]
    const cesion = derivarCesion({ recintos: editada, geometriaOficial: ORO })
    const c = comprobarConjunto({
      geometriaOficial: ORO,
      miembros: [
        { etiqueta: 'matriz', recintos: editada },
        ...cesion.piezas.map((p) => ({ etiqueta: `cesión ${p.orden}`, recintos: p.recintos })),
      ],
    })
    expect(c.suma.residuo).toBe(0)
    expect(c.cobertura.area).toBe(0)
    expect(c.cobertura.descartados).toEqual([])
    expect(c.cierra).toBe(true)
  })

  it('las cuñas del redondeo se quedan SIEMPRE por debajo del umbral derivado', () => {
    // El umbral no está ajustado a estos datos: sale de la aritmética del formato
    // (`½·10⁻ᴰ·√2`). Los datos sólo confirman que la aritmética iba bien — la cuña
    // más gruesa medida fue de 2,49 mm frente a los 7,07 mm del umbral.
    let peorCuna = 0
    for (const d of RECORTES) {
      const c = comprobarConjunto({
        geometriaOficial: ORO,
        miembros: expedienteRecortado(d).miembros,
        umbralGrosorM: 0, // sin filtro: se quiere VER la cuña, no descartarla
        toleranciaM2: 100,
      })
      const grosores = [
        ...c.cobertura.huecos.map((h) => h.grosor),
        ...c.solapes.pares.flatMap((p) => p.piezas.map((x) => x.grosor)),
      ]
      peorCuna = Math.max(peorCuna, 0, ...grosores)
    }
    expect(peorCuna).toBeGreaterThan(0) // anti-vacuidad: las cuñas existen
    expect(peorCuna).toBeLessThan(GROSOR_REDONDEO_M)
    expect(peorCuna).toBeCloseTo(0.00249, 4)
  })
})

// ── 4 · Los dos números, DERIVADOS y no elegidos ────────────────────────────

describe('comprobarConjunto · la tolerancia es una COTA, no un ajuste', () => {
  it('sale de `DECIMALES_COORD`, no de una constante escrita a mano', () => {
    // Media unidad del último decimal en cada eje, o sea la diagonal.
    expect(DESPLAZAMIENTO_MAXIMO_COORD_M).toBeCloseTo(0.005 * Math.SQRT2, 15)
    expect(GROSOR_REDONDEO_M).toBe(DESPLAZAMIENTO_MAXIMO_COORD_M)
    expect(toleranciaCierre(100)).toBeCloseTo(0.7071, 4)
    expect(toleranciaCierre(0)).toBe(0)
  })

  it('⛔ y F07 acabó midiendo LO MISMO: era el mismo fenómeno', () => {
    // Este test decía «es SIETE veces el umbral de F07, por un motivo escrito»: allí
    // las dos fronteras vendrían ya en la retícula y su discrepancia sería de décimas
    // de milímetro. Medido el 2026-08-10 sobre 554 parcelas oficiales, era falso —
    // cuando la vecina subdivide el lindero con un vértice que la propia no tiene, ese
    // vértice es «un punto sobre un lado, redondeado», que es este caso exacto—, y por
    // eso `grosorInvasionMinimoM` subió de 1 mm a este mismo número.
    //
    // El test se queda, invertido: el día que alguien vuelva a separarlos, que sea a
    // propósito y aquí.
    // Redondeado hacia ARRIBA en el JSON (0,0071 frente a 0,0070711): un número que
    // una persona puede teclear, y por el lado que no reabre el defecto.
    expect(OPERATIVOS.grosorInvasionMinimoM).toBeGreaterThanOrEqual(GROSOR_REDONDEO_M)
    expect(OPERATIVOS.grosorInvasionMinimoM).toBeCloseTo(GROSOR_REDONDEO_M, 4)
  })

  it('la tolerancia usada y su perímetro salen en el resultado, para auditarla', () => {
    const { miembros } = expedienteRecortado(3)
    const c = comprobarConjunto({ geometriaOficial: ORO, miembros })
    expect(c.suma.toleranciaM2).toBeCloseTo(
      DESPLAZAMIENTO_MAXIMO_COORD_M * c.suma.perimetroTotal,
      12,
    )
    expect(c.suma.perimetroTotal).toBeGreaterThan(87) // el perímetro del oro, y más
    expect(c.detecciones[0].datos.toleranciaM2).toBe(c.suma.toleranciaM2)
  })

  it('se puede APRETAR desde fuera, y entonces el número que manda es ése', () => {
    const { miembros } = expedienteRecortado(3)
    const c = comprobarConjunto({ geometriaOficial: ORO, miembros, toleranciaM2: 0.001 })
    expect(c.suma.toleranciaM2).toBe(0.001)
    expect(c.suma.cumple).toBe(false)
    expect(c.cierra).toBe(false)
  })
})

// ── 5 · Los tres estados de `cierra` ────────────────────────────────────────

describe('comprobarConjunto · «no se ha podido medir» NO es «cierra»', () => {
  it('⛔ un miembro degenerado NO se cuela como «cierra»: las tres quedan sin medir', () => {
    // ⚠️ Este test empezó afirmando otra cosa, y la MEDICIÓN lo corrigió: con la
    // primera versión del módulo, un miembro de dos vértices daba `cierra: true`.
    // Y por un motivo que hay que dejar escrito: su superficie sale 0, así que no
    // rompe la suma; no se pisa con nadie; y como otro miembro ya cubría el
    // contorno, la cobertura también salía bien. **Verde por ausencia de datos.**
    const c = comprobarConjunto({
      geometriaOficial: rect(0, 0, 20, 10),
      miembros: [
        { etiqueta: 'A', recintos: rect(0, 0, 20, 10) },
        { etiqueta: 'degenerada', recintos: [{ tipo: 'EXTERIOR', vertices: [[0, 0], [1, 1]] }] },
      ],
    })
    expect(c.cierra).toBeNull()
    expect([c.suma.cumple, c.solapes.cumple, c.cobertura.cumple]).toEqual([null, null, null])
    expect(errores(c)).toEqual([TIPO_COMPROBACION.CONJUNTO_NO_COTEJABLE])
    expect(c.detecciones[0].mensaje).toMatch(/«degenerada»/)
    expect(c.detecciones[0].mensaje).toMatch(/no se sabe/)
    expect(c.saltados.length).toBeGreaterThan(0)
    // Las superficies medibles SÍ salen: son hechos, y el veredicto ya dice que no
    // se puede concluir con ellos.
    expect(c.miembros).toHaveLength(2)
  })

  it('⛔ pero una afirmación MEDIDA que falla manda sobre una sin medir', async () => {
    // Si la suma no cuadra, el conjunto no cierra, sepamos o no lo de la cobertura.
    // `null` es «no lo sabemos», no «hay un problema en alguna parte». Se dobla el
    // motor para que la cobertura no se pueda medir sin degenerar ninguna geometría.
    vi.resetModules()
    vi.doMock('@turf/difference', () => ({
      default: () => {
        throw new Error('Unable to complete output ring')
      },
    }))
    const { comprobarConjunto: comprobar } = await import('../../comprobacion/conjunto.js')

    const c = comprobar({
      geometriaOficial: rect(0, 0, 20, 10),
      miembros: [{ etiqueta: 'A', recintos: rect(0, 0, 5, 10) }],
    })
    expect(c.suma.cumple).toBe(false)
    expect(c.cobertura.cumple).toBeNull()
    expect(c.cierra).toBe(false)

    vi.doUnmock('@turf/difference')
    vi.resetModules()
  })

  it('⛔ y con TODO lo medido en verde, una cobertura sin medir deja `null`', async () => {
    // El caso complementario: aquí `null` sí gana, porque no hay ninguna afirmación
    // medida que lo contradiga. Verde en dos de tres no es verde.
    vi.resetModules()
    vi.doMock('@turf/difference', () => ({
      default: () => {
        throw new Error('Unable to complete output ring')
      },
    }))
    const { comprobarConjunto: comprobar } = await import('../../comprobacion/conjunto.js')

    const misma = rect(0, 0, 20, 10)
    const c = comprobar({ geometriaOficial: misma, miembros: [{ etiqueta: 'A', recintos: misma }] })
    expect(c.suma.cumple).toBe(true)
    expect(c.solapes.cumple).toBe(true)
    expect(c.cobertura.cumple).toBeNull()
    expect(c.cierra).toBeNull()

    vi.doUnmock('@turf/difference')
    vi.resetModules()
  })

  it('lo descartado por astilla no se pierde: sale con su área y su grosor', () => {
    const { miembros } = expedienteRecortado(1)
    const c = comprobarConjunto({ geometriaOficial: ORO, miembros })
    const sinSolape = c.detecciones.find((d) => d.tipo === TIPO_COMPROBACION.SIN_SOLAPE)
    expect(sinSolape.datos.descartados).toHaveLength(1)
    expect(sinSolape.datos.descartados[0].area).toBeGreaterThan(0)
    expect(sinSolape.datos.descartados[0].grosor).toBeLessThan(GROSOR_REDONDEO_M)
  })
})

// ── 6 · Contrato ────────────────────────────────────────────────────────────

describe('comprobarConjunto · lo que LANZA es contrato roto', () => {
  it('lanza sin objeto de opciones, sin oficial o sin miembros', () => {
    expect(() => comprobarConjunto()).toThrow(TypeError)
    expect(() => comprobarConjunto({ miembros: [{ recintos: rect(0, 0, 1, 1) }] })).toThrow(
      /geometriaOficial/,
    )
    expect(() => comprobarConjunto({ geometriaOficial: rect(0, 0, 1, 1) })).toThrow(/miembros/)
  })

  it('⛔ lanza con `miembros: []` — un conjunto vacío no cierra ni deja de cerrar', () => {
    // Devolver un veredicto sobre cero parcelas sería inventárselo, y `cierra:true`
    // sobre una lista vacía es verdadero por vacuidad y falso como respuesta.
    expect(() => comprobarConjunto({ geometriaOficial: rect(0, 0, 1, 1), miembros: [] })).toThrow(
      /NO vacío/,
    )
  })

  it('lanza si un miembro no trae `recintos`, nombrando cuál', () => {
    expect(() =>
      comprobarConjunto({
        geometriaOficial: rect(0, 0, 1, 1),
        miembros: [{ recintos: rect(0, 0, 1, 1) }, { etiqueta: 'mala' }],
      }),
    ).toThrow(/miembros\[1\]/)
  })

  it('lanza `RangeError` con umbrales negativos o no finitos', () => {
    const args = { geometriaOficial: rect(0, 0, 1, 1), miembros: [{ recintos: rect(0, 0, 1, 1) }] }
    expect(() => comprobarConjunto({ ...args, toleranciaM2: -1 })).toThrow(RangeError)
    expect(() => comprobarConjunto({ ...args, umbralGrosorM: NaN })).toThrow(RangeError)
  })

  it('⛔ no toca la geometría de entrada (regla de oro 2)', () => {
    const { miembros } = expedienteRecortado(3)
    const antes = JSON.stringify([ORO, miembros])
    comprobarConjunto({ geometriaOficial: ORO, miembros })
    expect(JSON.stringify([ORO, miembros])).toBe(antes)
  })
})
