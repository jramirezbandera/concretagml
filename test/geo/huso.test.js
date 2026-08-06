/* -------------------------------------------------------------------------- *
 * test/geo/huso.test.js — Detección de huso y saneamiento defensivo (F00)     *
 *                                                                            *
 * Verifica el criterio de aceptación 3 de F00:                               *
 *   - meridianoCentral: 29→−9, 30→−3, 31→+3.                                  *
 *   - detectarHuso: coordenadas de prueba de cada huso + fixture real h30.    *
 *   - sanear: X/Y invertidas, geográficas pegadas, UTM normal (sin cambios).  *
 *   - Punto fuera de España → detectarHuso devuelve null.                     *
 *   - Canarias (28/32628) quedó como gancho comentado (no en candidatos).     *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

import {
  meridianoCentral,
  srsPorHuso,
  husoPorSrs,
  husoPorSrsOpcional,
  detectarHuso,
  sanear,
  situarGrados,
  zonaPorLon,
  pareceEnGrados,
  CANDIDATOS_DEFECTO,
  HUSOS_VALIDOS,
  BBOX_ESPANA,
  BBOX_CANARIAS,
  UMBRAL_GRADOS,
} from '../../geo/huso.js'
import { forward } from '../../geo/utm.js'
import { SRS_VALIDOS } from '../../model/parcela.js'
import fixtureRing from '../fixtures/geo/parcela-ring.json' with { type: 'json' }

describe('geo/huso — meridianoCentral', () => {
  it('λ0 = (z−1)·6 − 180 + 3 → 29:−9°, 30:−3°, 31:+3°', () => {
    expect(meridianoCentral(29)).toBe(-9)
    expect(meridianoCentral(30)).toBe(-3)
    expect(meridianoCentral(31)).toBe(3)
  })
})

describe('geo/huso — srsPorHuso', () => {
  it('mapea 29/30/31 → EPSG 25829/25830/25831', () => {
    expect(srsPorHuso(29)).toBe('EPSG:25829')
    expect(srsPorHuso(30)).toBe('EPSG:25830')
    expect(srsPorHuso(31)).toBe('EPSG:25831')
  })
  it('huso no implementado (Canarias 28) lanza RangeError (regla de oro 1)', () => {
    expect(() => srsPorHuso(28)).toThrow(RangeError)
    expect(() => srsPorHuso(27)).toThrow(RangeError)
  })
  it("huso string ('30') lanza TypeError — sin coerción de clave (auditoría A8)", () => {
    expect(() => srsPorHuso('30')).toThrow(TypeError)
    expect(() => srsPorHuso(30.5)).toThrow(TypeError)
  })
})

describe('geo/huso — husoPorSrs (inversa de srsPorHuso)', () => {
  it('mapea EPSG 25829/25830/25831 → 29/30/31', () => {
    expect(husoPorSrs('EPSG:25829')).toBe(29)
    expect(husoPorSrs('EPSG:25830')).toBe(30)
    expect(husoPorSrs('EPSG:25831')).toBe(31)
  })

  it('ida y vuelta: husoPorSrs(srsPorHuso(z)) === z para los 3 husos', () => {
    for (const z of HUSOS_VALIDOS) {
      expect(husoPorSrs(srsPorHuso(z))).toBe(z)
    }
  })

  it("srs no-string lanza TypeError (contrato roto por el llamante)", () => {
    expect(() => husoPorSrs(42)).toThrow(TypeError)
    expect(() => husoPorSrs(undefined)).toThrow(TypeError)
    expect(() => husoPorSrs(null)).toThrow(TypeError)
  })

  it('Canarias (EPSG:32628, DIFERIDO) y un SRS geográfico ajeno lanzan RangeError', () => {
    expect(() => husoPorSrs('EPSG:32628')).toThrow(RangeError)
    expect(() => husoPorSrs('EPSG:4326')).toThrow(RangeError)
  })
})

describe('geo/huso — husoPorSrsOpcional (la variante que NO lanza)', () => {
  // Existe para el único llamante que legítimamente no tiene contrato sobre el
  // `srs` — `validation/reglas-huso.js`, que debe poder decir "no puedo juzgar el
  // rango" sin que eso sea un error. Sustituye al `try/catch` desnudo que esa
  // regla arrastraba de F02.
  it('devuelve el huso para los tres SRS soportados, igual que husoPorSrs', () => {
    for (const z of HUSOS_VALIDOS) {
      expect(husoPorSrsOpcional(srsPorHuso(z))).toBe(z)
      expect(husoPorSrsOpcional(srsPorHuso(z))).toBe(husoPorSrs(srsPorHuso(z)))
    }
  })

  it('devuelve null (NO lanza) donde husoPorSrs lanzaría', () => {
    // Los mismos casos que los dos tests de `husoPorSrs` de arriba: no-string
    // (TypeError allí) y SRS no soportado (RangeError allí).
    for (const malo of [42, undefined, null, {}, 'EPSG:32628', 'EPSG:4326', '']) {
      expect(husoPorSrsOpcional(malo), `srs ${JSON.stringify(malo)}`).toBeNull()
    }
  })
})

describe('geo/huso — HUSOS_VALIDOS no puede divergir de model/parcela.js#SRS_VALIDOS', () => {
  // Mismo dominio visto desde dos capas (geo/ más baja que model/); no se
  // acoplan con un import cruzado, así que este test-guarda es lo que
  // garantiza que las dos listas no se desincronicen (mismo patrón de guarda
  // transversal que test/contrato.test.js).
  it('HUSOS_VALIDOS.map(srsPorHuso) coincide con SRS_VALIDOS', () => {
    expect(HUSOS_VALIDOS.map(srsPorHuso)).toEqual(SRS_VALIDOS)
  })

  it('SRS_VALIDOS.map(husoPorSrs) coincide con HUSOS_VALIDOS', () => {
    expect(SRS_VALIDOS.map(husoPorSrs)).toEqual([...HUSOS_VALIDOS])
  })
})

describe('geo/huso — detectarHuso', () => {
  it('fixture real de huso 30 → prioritario zona 30, srs EPSG:25830', () => {
    const r = detectarHuso(fixtureRing.referencePoint) // [439250.35, 4479664.55]
    expect(r).not.toBeNull()
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    // Cae donde debe: lon ≈ −3.7°, lat ≈ 40.5° (bbox España, ventana CM30 ±3°).
    expect(r.lon).toBeGreaterThan(-6)
    expect(r.lon).toBeLessThan(0)
    expect(r.lat).toBeCloseTo(40.46, 1)
    // La ambigüedad se DECLARA (hallazgo A1): este punto también es viable como
    // h31 (lon aparente ≈ +2.3 ∈ ventana CM31 y bbox); h29 queda fuera del bbox.
    expect(r.ambiguo).toBe(true)
    expect(r.candidatos.map((c) => c.zona)).toEqual([30, 31])
  })

  it('punto generado en huso 30 → zona 30', () => {
    const { x, y } = forward(40, -4, 30) // lon −4 ∈ ventana CM30 ±3° y bbox
    const r = detectarHuso([x, y])
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    expect(r.lon).toBeCloseTo(-4, 6)
    expect(r.lat).toBeCloseTo(40, 6)
  })

  // Huso 29 y 31: como el easting NO identifica el huso, un punto de estos husos
  // desprojectado con los candidatos por defecto [30,29,31] cae en huso 30 (la
  // interpretación h30 también aterriza en España). Con el dato ya "trae huso" se
  // pasa como único candidato para VERIFICAR (dossier §3.2, "úsalo y solo verifica").
  it('punto de huso 29 verificado con candidatos=[29] → zona 29, sin ambigüedad', () => {
    const { x, y } = forward(42, -8, 29) // Galicia: lon −8 ∈ bbox y ventana CM29
    const r = detectarHuso([x, y], [29])
    expect(r.zona).toBe(29)
    expect(r.srs).toBe('EPSG:25829')
    expect(r.lon).toBeCloseTo(-8, 6)
    expect(r.lat).toBeCloseTo(42, 6)
    // Modo verificación (un solo candidato): nunca ambiguo.
    expect(r.ambiguo).toBe(false)
    expect(r.candidatos).toHaveLength(1)
  })

  it('punto de huso 31 verificado con candidatos=[31] → zona 31', () => {
    const { x, y } = forward(41, 2, 31) // Cataluña: lon +2 ∈ bbox y ventana CM31
    const r = detectarHuso([x, y], [31])
    expect(r.zona).toBe(31)
    expect(r.srs).toBe('EPSG:25831')
    expect(r.lon).toBeCloseTo(2, 6)
    expect(r.lat).toBeCloseTo(41, 6)
  })

  it('el easting no identifica el huso: un punto de h31 resuelve prioritario a h30 PERO se declara ambiguo con h31 entre los candidatos (A1)', () => {
    const { x, y } = forward(41, 2, 31)
    const r = detectarHuso([x, y]) // candidatos por defecto [30,29,31]
    expect(r.zona).toBe(30) // prioritario = primer candidato viable ("asumir 30")
    expect(r.ambiguo).toBe(true) // ...pero el llamante SABE que hay alternativa
    expect(r.candidatos.map((c) => c.zona)).toContain(31) // la interpretación correcta está en la lista
    // La interpretación h31 recupera la posición real:
    const h31 = r.candidatos.find((c) => c.zona === 31)
    expect(h31.lon).toBeCloseTo(2, 6)
    expect(h31.lat).toBeCloseTo(41, 6)
  })

  it('punto fuera de España (París, h31) → null', () => {
    const { x, y } = forward(48.85, 2.35, 31) // lat 48.85 > 44.5 → fuera del bbox
    expect(detectarHuso([x, y])).toBeNull()
    // La latitud es idéntica para todo candidato, así que ninguno cae en el bbox.
    expect(detectarHuso([x, y], [29, 30, 31])).toBeNull()
  })

  it('rechaza coordenada no finita (sin error silencioso)', () => {
    expect(() => detectarHuso([NaN, 4e6])).toThrow(TypeError)
    expect(() => detectarHuso([500000])).toThrow(TypeError)
  })
})

describe('geo/huso — sanear', () => {
  it('X/Y invertidas → swap con corrección anotada', () => {
    const { coord, correcciones } = sanear([4479664, 439250]) // [Norte, Este]
    expect(coord).toEqual([439250, 4479664]) // [Este, Norte]
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('SWAP_XY')
    expect(correcciones[0].antes).toEqual([4479664, 439250])
    expect(correcciones[0].despues).toEqual([439250, 4479664])
    expect(correcciones[0].rangoPlausible).toBe(true) // Este/Norte en rango tras swap
  })

  it('geográficas pegadas → marca "grados" sin reproyectar', () => {
    const { coord, correcciones } = sanear([-3.7, 40.4])
    expect(coord).toEqual([-3.7, 40.4]) // intacta: NO se reproyecta aquí (regla de oro 3)
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('GRADOS')
    expect(correcciones[0].reproyectar).toBe(true)
    expect(correcciones[0].mensaje.toLowerCase()).toContain('grados')
  })

  it('coordenada UTM normal → sin correcciones', () => {
    const entrada = fixtureRing.referencePoint // [439250.35, 4479664.55]
    const { coord, correcciones } = sanear(entrada)
    expect(coord).toEqual(entrada)
    expect(correcciones).toHaveLength(0)
  })

  it('rechaza coordenada no finita', () => {
    expect(() => sanear([Infinity, 1])).toThrow(TypeError)
    expect(() => sanear([1])).toThrow(TypeError)
  })

  // Fronteras EXACTAS de los umbrales (auditoría A8): los comparadores del
  // dossier son estrictos (`<1000`, `>1_000_000`) y el borde exacto NO dispara.
  it('frontera exacta |c|=1000: NO son "grados" (umbral estricto <1000)', () => {
    const { correcciones } = sanear([1000, 1000])
    expect(correcciones).toHaveLength(0)
  })

  it('justo bajo la frontera (999.99): sí son "grados"', () => {
    const { correcciones } = sanear([999.99, 999.99])
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('GRADOS')
  })

  it('frontera exacta c0=1_000_000: NO hay swap (umbral estricto >1e6)', () => {
    const { coord, correcciones } = sanear([1_000_000, 500000])
    expect(coord).toEqual([1_000_000, 500000])
    expect(correcciones).toHaveLength(0)
  })

  it('justo sobre la frontera (1_000_001): swap, con rango NO plausible anotado', () => {
    const { coord, correcciones } = sanear([1_000_001, 500000])
    expect(coord).toEqual([500000, 1_000_001])
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('SWAP_XY')
    // Tras el swap el Norte=1.000.001 queda fuera de [3.93M, 4.93M]: se avisa.
    expect(correcciones[0].rangoPlausible).toBe(false)
  })
})

describe('geo/huso — Canarias DIFERIDO (override O13)', () => {
  it('los candidatos por defecto son [30,29,31] — sin huso 28 ni 27', () => {
    expect([...CANDIDATOS_DEFECTO]).toEqual([30, 29, 31])
    expect(CANDIDATOS_DEFECTO).not.toContain(28)
    expect(CANDIDATOS_DEFECTO).not.toContain(27)
  })

  it('el fichero conserva el gancho comentado de Canarias (28/32628)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../geo/huso.js', import.meta.url)), 'utf8')
    expect(src).toMatch(/\/\/\s*DIFERIDO:\s*Canarias\b/)
    expect(src).toMatch(/28/)
    expect(src).toMatch(/32628/)
  })
})

/* -------------------------------------------------------------------------- *
 * F19 · Situar unos grados para poder proyectarlos                            *
 *                                                                            *
 * Hasta F19 este módulo sabía decir «esto son grados» y se paraba ahí. Lo que *
 * faltaba no era la proyección —forward() está desde F00— sino el orden de    *
 * las columnas y el huso. Las dos se contestan sin heurísticas.               *
 * -------------------------------------------------------------------------- */

describe('geo/huso — zonaPorLon', () => {
  it('da el huso de una longitud: −9,5 → 29, −4 → 30, +2 → 31', () => {
    expect(zonaPorLon(-9.5)).toBe(29)
    expect(zonaPorLon(-4)).toBe(30)
    expect(zonaPorLon(2)).toBe(31)
  })

  it('⭐ el bbox de España mapea EXACTAMENTE a los tres husos soportados', () => {
    // No es una coincidencia que se pueda usar: es la razón por la que el huso
    // se puede deducir de la longitud sin desproyectar nada.
    expect(zonaPorLon(BBOX_ESPANA.lonMin)).toBe(29)
    expect(zonaPorLon(BBOX_ESPANA.lonMax)).toBe(31)
    expect([...HUSOS_VALIDOS]).toEqual([29, 30, 31])
  })

  it('contesta también donde el proyecto no proyecta: Canarias es el huso 28', () => {
    // Es a propósito (ver su JSDoc): quien pregunta necesita poder NOMBRAR lo que
    // ha visto. Filtrar aquí obligaría a contestar null y el mensaje sería mudo.
    expect(zonaPorLon(-15)).toBe(28)
    expect(HUSOS_VALIDOS).not.toContain(28)
  })

  it('una longitud fuera de [−180,180) no inventa un huso 61', () => {
    expect(zonaPorLon(185)).toBe(zonaPorLon(-175))
    expect(zonaPorLon(185)).toBeLessThanOrEqual(60)
  })

  it('una longitud no finita es error de programación, no un resultado raro', () => {
    expect(() => zonaPorLon('−4')).toThrow(TypeError)
    expect(() => zonaPorLon(NaN)).toThrow(TypeError)
  })
})

describe('geo/huso — pareceEnGrados', () => {
  it('el umbral es UNO y está exportado (eran dos copias antes de F19)', () => {
    expect(UMBRAL_GRADOS).toBe(1000)
    expect(pareceEnGrados([-4.42, 36.72])).toBe(true)
    expect(pareceEnGrados([298755, 4090054])).toBe(false)
    // Las dos componentes, no una: un par mixto no son grados (unidades mezcladas).
    expect(pareceEnGrados([-5, 4000000])).toBe(false)
  })

  it('la frontera es estricta: |v| = 1000 no son grados', () => {
    expect(pareceEnGrados([999.9, 999.9])).toBe(true)
    expect(pareceEnGrados([1000, 999])).toBe(false)
  })
})

describe('geo/huso — situarGrados', () => {
  it('⭐ los rangos de lon y lat de España son DISJUNTOS: el orden no es ambiguo', () => {
    // Este es el hecho del que cuelga la decisión de deducir el orden en vez de
    // preguntarlo. Si algún día los bbox se solapan, esta prueba lo dice ANTES de
    // que la aplicación empiece a adivinar mal.
    expect(BBOX_ESPANA.lonMax).toBeLessThan(BBOX_ESPANA.latMin)
    expect(BBOX_CANARIAS.lonMax).toBeLessThan(BBOX_CANARIAS.latMin)
  })

  it('(lon, lat) de Málaga: huso 30, sin invertir', () => {
    const s = situarGrados([-4.42143, 36.7213])
    expect(s.orden).toBe('LON_LAT')
    expect(s.invertido).toBe(false)
    expect(s.zona).toBe(30)
    expect(s.srs).toBe('EPSG:25830')
    expect(s.region).toBe('PENINSULA_BALEARES')
    expect(s.proyectable).toBe(true)
  })

  it('el MISMO punto al revés se reconoce y se deja ya en el orden bueno', () => {
    const s = situarGrados([36.7213, -4.42143])
    expect(s.orden).toBe('LAT_LON')
    expect(s.invertido).toBe(true)
    expect(s.lon).toBe(-4.42143) // lon y lat salen colocadas, no como vinieron
    expect(s.lat).toBe(36.7213)
    expect(s.zona).toBe(30)
  })

  it('Galicia cae en el 29 y Cataluña en el 31 (el huso lo da la longitud)', () => {
    expect(situarGrados([-8.5, 42.5]).zona).toBe(29)
    expect(situarGrados([2.1, 41.4]).zona).toBe(31)
  })

  it('⛔ Canarias se reconoce, se nombra y NO es proyectable (O13)', () => {
    const s = situarGrados([-15.42, 28.12])
    expect(s.region).toBe('CANARIAS')
    expect(s.zona).toBe(28)
    expect(s.srs).toBeNull() // srsPorHuso(28) no existe, y no se inventa
    expect(s.proyectable).toBe(false)
  })

  it('París no cae en ninguno de los dos, en ninguno de los dos órdenes', () => {
    const s = situarGrados([2.2945, 48.8582])
    expect(s.region).toBe('FUERA')
    expect(s.orden).toBeNull()
    expect(s.zona).toBeNull()
    expect(s.proyectable).toBe(false)
  })

  it('una coordenada no finita es error de programación', () => {
    expect(() => situarGrados([NaN, 36])).toThrow(TypeError)
    expect(() => situarGrados([-4])).toThrow(TypeError)
  })

  it('lo que sitúa se puede proyectar con forward y vuelve a caer donde decía', () => {
    // La prueba de que las dos piezas encajan: situarGrados no proyecta (regla 3),
    // pero lo que devuelve es exactamente lo que forward necesita.
    const s = situarGrados([-4.42143, 36.7213])
    const { x, y, zona } = forward(s.lat, s.lon, s.zona)
    expect(zona).toBe(30)
    expect(detectarHuso([x, y], [s.zona]).zona).toBe(30)
  })
})
