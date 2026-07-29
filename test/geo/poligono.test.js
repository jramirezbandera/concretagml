import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { polygon, multiPolygon } from '@turf/helpers'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import {
  anilloCerrado,
  coordsPoligono,
  recintosDeGeometriaTurf,
} from '../../geo/poligono.js'
import * as comunValidacion from '../../validation/_comun.js'
import { TIPO_RECINTO, crearRecinto } from '../../model/parcela.js'
import { area, orientacion } from '../../geo/area.js'

// F07 · T1.1 — `geo/poligono.js` es el puente modelo ↔ Turf en los DOS sentidos.
// El sentido de ida (`anilloCerrado`/`coordsPoligono`) es el que F02 tenía en
// `validation/_comun.js` y que ahora baja a `geo/`; el de vuelta
// (`recintosDeGeometriaTurf`) es lo nuevo, y es lo que permite que F07 mida el
// solape y la invasión con `@turf/intersect` sin salirse del modelo.
//
// Este fichero se apoya en `polygon()` y `multiPolygon()` de @turf/helpers de
// VERDAD, no en GeoJSON escrito a ojo: la pregunta que responde `coordsPoligono`
// es «¿acepta Turf esta forma?» y eso solo lo contesta Turf. `polygon()` valida el
// cierre y el mínimo de 4 posiciones, así que una llamada que no lanza YA es la
// aserción; aun así se comprueba también la estructura resultante.

// Rectángulo 6×4 ANTIHORARIO (área firmada +24), a propósito no cuadrado: así el
// orden de los vértices es verificable y no da lo mismo equivocarse.
const RECT = [
  [0, 0],
  [6, 0],
  [6, 4],
  [0, 4],
]

describe('geo/poligono.js · anilloCerrado (modelo ABIERTO → GeoJSON CERRADO)', () => {
  it('caso normal: añade el primer vértice al final y no toca nada más', () => {
    const cerrado = anilloCerrado(RECT)
    expect(cerrado).toEqual([...RECT, [0, 0]])
    expect(cerrado).toHaveLength(RECT.length + 1)
  })

  it('devuelve una COPIA profunda: no muta la entrada ni comparte los pares', () => {
    const original = RECT.map((v) => [...v])
    const cerrado = anilloCerrado(RECT)
    expect(RECT).toEqual(original) // la entrada sigue ABIERTA
    expect(cerrado[0]).not.toBe(RECT[0]) // ni el par se comparte
    cerrado[0][0] = 999
    expect(RECT[0][0]).toBe(0)
  })

  it('un anillo que YA venía cerrado se copia TAL CUAL: es idempotente', () => {
    // La decisión, documentada en el JSDoc: cerrar dos veces crearía un lado de
    // longitud 0 que `polygon()` acepta sin rechistar y que luego aparece como
    // «vértice duplicado» en la validación, lejos de su causa.
    const yaCerrado = [...RECT, [0, 0]]
    expect(anilloCerrado(yaCerrado)).toEqual(yaCerrado)
    expect(anilloCerrado(yaCerrado)).toHaveLength(RECT.length + 1)
    expect(anilloCerrado(anilloCerrado(RECT))).toEqual(anilloCerrado(RECT))
  })

  it('el cierre se compara por VALOR, no por identidad del par', () => {
    // El último vértice es otro array con las mismas cifras: sigue estando cerrado.
    const cerradoConOtroPar = [...RECT.map((v) => [...v]), [0, 0]]
    expect(anilloCerrado(cerradoConOtroPar)).toHaveLength(RECT.length + 1)
  })

  it('anillos de MENOS de 3 vértices: se cierran igual, sin juzgar la degeneración', () => {
    // Decisión documentada: esta función CIERRA, no valida. El resultado tendrá
    // menos de 4 posiciones y `polygon()` lo rechazará — ver el test de abajo.
    expect(anilloCerrado([])).toEqual([]) // nada que cerrar
    expect(anilloCerrado([[10, 10]])).toEqual([[10, 10]]) // ya cumple primero===último
    expect(anilloCerrado([[0, 0], [3, 4]])).toEqual([[0, 0], [3, 4], [0, 0]])
  })

  it('el mínimo real es n ≥ 3: con n = 2 el cierre da 3 posiciones y `polygon()` LANZA', () => {
    // Esta es la frontera que `reglas-topologia.js#esRecintoApto` protege, medida
    // contra Turf de verdad y no supuesta.
    expect(() => polygon([anilloCerrado([[0, 0], [3, 4]])])).toThrow(/4 or more Positions/)
    const triangulo = [[0, 0], [3, 0], [3, 4]]
    expect(() => polygon([anilloCerrado(triangulo)])).not.toThrow()
  })

  it('LANZA nombrando el argumento si no recibe un array (bug del llamante)', () => {
    expect(() => anilloCerrado(null)).toThrow(TypeError)
    expect(() => anilloCerrado(null)).toThrow(/'anillo' debe ser un array de pares UTM/)
    expect(() => anilloCerrado(undefined)).toThrow(/recibido undefined/)
    expect(() => anilloCerrado({ vertices: RECT })).toThrow(/recibido \{"vertices"/)
  })

  it('NO reorienta: el anillo sale en el sentido en que entró (override O1/O17)', () => {
    // La orientación es de quien serializa (F04) y el signo lo mide
    // `geo/area.js#orientacion`. Aquí se comprueba con el anillo real del WFS,
    // que viene HORARIO, y con su reverse().
    const horario = ring.anilloExterior
    const antihorario = [...horario].slice().reverse()
    expect(orientacion(horario)).toBe(-1)
    expect(orientacion(antihorario)).toBe(1)
    // El cerrado conserva el orden: quitando el vértice de cierre se recupera el
    // anillo idéntico, sin rebobinar.
    expect(anilloCerrado(horario).slice(0, -1)).toEqual(horario)
    expect(anilloCerrado(antihorario).slice(0, -1)).toEqual(antihorario)
  })
})

describe('geo/poligono.js · coordsPoligono (la forma EXACTA que acepta `polygon()`)', () => {
  it('`polygon(coordsPoligono(recinto))` no lanza y da un Feature<Polygon> de UN anillo', () => {
    const recinto = { vertices: RECT, tipo: TIPO_RECINTO.EXTERIOR }
    const coords = coordsPoligono(recinto)
    // La aserción de fondo es que Turf ACEPTA esto (valida cierre y ≥4 posiciones).
    const pol = polygon(coords)
    expect(pol.type).toBe('Feature')
    expect(pol.geometry.type).toBe('Polygon')
    expect(pol.geometry.coordinates).toHaveLength(1) // un recinto ES un anillo
    expect(pol.geometry.coordinates[0]).toEqual([...RECT, [0, 0]])
  })

  it('funciona con el anillo REAL del WFS (15 vértices, Norte ≈ 4,48·10⁶)', () => {
    const pol = polygon(coordsPoligono({ vertices: ring.anilloExterior, tipo: 'EXTERIOR' }))
    expect(pol.geometry.coordinates[0]).toHaveLength(ring.anilloExterior.length + 1)
    expect(pol.geometry.coordinates[0][0]).toEqual(
      pol.geometry.coordinates[0][pol.geometry.coordinates[0].length - 1],
    )
  })

  it('acepta un recinto de `crearRecinto` tal cual (el POJO del modelo)', () => {
    const recinto = crearRecinto(RECT, 'EXTERIOR')
    expect(() => polygon(coordsPoligono(recinto))).not.toThrow()
  })

  it('LANZA nombrando el argumento si no recibe {vertices:[…]}', () => {
    expect(() => coordsPoligono(null)).toThrow(TypeError)
    expect(() => coordsPoligono(null)).toThrow(/'recinto' debe ser un objeto \{vertices/)
    expect(() => coordsPoligono(RECT)).toThrow(/'recinto' debe ser un objeto/) // el anillo pelado no vale
    expect(() => coordsPoligono({ tipo: 'EXTERIOR' })).toThrow(/recibido \{"tipo":"EXTERIOR"\}/)
  })
})

describe('geo/poligono.js · recintosDeGeometriaTurf (GeoJSON → modelo)', () => {
  const CERRADO = [...RECT, [0, 0]]
  const HUECO_CERRADO = [
    [1, 1],
    [2, 1],
    [2, 2],
    [1, 2],
    [1, 1],
  ]

  it('`Polygon` simple → UNA entrada, un solo recinto EXTERIOR con anillo ABIERTO', () => {
    const lista = recintosDeGeometriaTurf({ type: 'Polygon', coordinates: [CERRADO] })
    expect(lista).toHaveLength(1)
    expect(lista[0]).toHaveLength(1)
    expect(lista[0][0].tipo).toBe('EXTERIOR')
    expect(lista[0][0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    // ABIERTO: el vértice de cierre se ha QUITADO (regla de oro 4).
    expect(lista[0][0].vertices).toEqual(RECT)
    expect(lista[0][0].vertices).toHaveLength(CERRADO.length - 1)
  })

  it('`Polygon` con hueco → un `recintos` de 2: [0] EXTERIOR y [1] HUECO', () => {
    const lista = recintosDeGeometriaTurf({
      type: 'Polygon',
      coordinates: [CERRADO, HUECO_CERRADO],
    })
    expect(lista).toHaveLength(1)
    const recintos = lista[0]
    expect(recintos).toHaveLength(2)
    expect(recintos.map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO'])
    expect(recintos[1].vertices).toEqual([[1, 1], [2, 1], [2, 2], [1, 2]])
    // Y el `recintos` resultante es VÁLIDO para el resto del motor: la superficie
    // neta (exterior − huecos) no lanza y da 24 − 1.
    expect(area(recintos[0].vertices)).toBeCloseTo(24, 12)
    expect(area(recintos[1].vertices)).toBeCloseTo(1, 12)
  })

  it('`MultiPolygon` de DOS piezas → DOS entradas, una por pieza (la razón de la firma)', () => {
    // Dos cuadrados disjuntos: es lo que devuelve `intersect` cuando un lindero
    // cruza al vecino, se sale y vuelve a entrar. Un solo `recintos` obligaría a
    // tirar una de las dos en silencio.
    const pieza1 = [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]
    const pieza2 = [[[10, 10], [13, 10], [13, 14], [10, 14], [10, 10]]]
    const lista = recintosDeGeometriaTurf({
      type: 'MultiPolygon',
      coordinates: [pieza1, pieza2],
    })
    expect(lista).toHaveLength(2)
    // Cada entrada es un `recintos` válido por su cuenta: las dos empiezan por un
    // EXTERIOR (el invariante del modelo admite UN solo exterior por recintos).
    expect(lista.map((r) => r[0].tipo)).toEqual(['EXTERIOR', 'EXTERIOR'])
    expect(lista[0][0].vertices).toEqual([[0, 0], [2, 0], [2, 2], [0, 2]])
    expect(lista[1][0].vertices).toEqual([[10, 10], [13, 10], [13, 14], [10, 14]])
    // El área total del solape es la SUMA de las piezas: 4 + 12. Ninguna se pierde.
    const total = lista.reduce((s, recintos) => s + area(recintos[0].vertices), 0)
    expect(total).toBeCloseTo(16, 12)
  })

  it('`MultiPolygon` con hueco en una pieza: cada pieza lleva su propio EXTERIOR + HUECOS', () => {
    const lista = recintosDeGeometriaTurf({
      type: 'MultiPolygon',
      coordinates: [[CERRADO, HUECO_CERRADO], [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]]],
    })
    expect(lista).toHaveLength(2)
    expect(lista[0].map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO'])
    expect(lista[1].map((r) => r.tipo)).toEqual(['EXTERIOR'])
  })

  it('un `Feature` envolvente se desenvuelve, con Polygon y con MultiPolygon', () => {
    // Es la forma que devuelve `@turf/intersect`, así que este caso es el normal.
    const feature = polygon([CERRADO]) // Feature<Polygon> de VERDAD
    expect(recintosDeGeometriaTurf(feature)).toEqual(
      recintosDeGeometriaTurf(feature.geometry),
    )
    const featureMulti = multiPolygon([[CERRADO], [HUECO_CERRADO]])
    expect(recintosDeGeometriaTurf(featureMulti)).toHaveLength(2)
    expect(recintosDeGeometriaTurf(featureMulti)).toEqual(
      recintosDeGeometriaTurf(featureMulti.geometry),
    )
  })

  it('`null` → [] (es la respuesta NORMAL de `intersect` cuando no hay solape)', () => {
    expect(recintosDeGeometriaTurf(null)).toEqual([])
    // `undefined` cuenta lo mismo: el llamante típico escribe `res?.geometry`.
    expect(recintosDeGeometriaTurf(undefined)).toEqual([])
    // Y un Feature sin geometría es GeoJSON legítimo (RFC 7946 §3.2).
    expect(recintosDeGeometriaTurf({ type: 'Feature', properties: {}, geometry: null })).toEqual([])
  })

  it('geometría VACÍA → [] , sin colar un `recintos` vacío que rompa el invariante', () => {
    expect(recintosDeGeometriaTurf({ type: 'Polygon', coordinates: [] })).toEqual([])
    expect(recintosDeGeometriaTurf({ type: 'MultiPolygon', coordinates: [] })).toEqual([])
    // Una pieza vacía dentro de un MultiPolygon no genera entrada: la otra sí.
    const lista = recintosDeGeometriaTurf({
      type: 'MultiPolygon',
      coordinates: [[], [CERRADO]],
    })
    expect(lista).toHaveLength(1)
    expect(lista[0][0].tipo).toBe('EXTERIOR')
  })

  it('devuelve POJO planos y copias INDEPENDIENTES de la geometría de entrada', () => {
    const geom = { type: 'Polygon', coordinates: [CERRADO.map((p) => [...p])] }
    const lista = recintosDeGeometriaTurf(geom)
    // POJO plano (regla de oro 4: structuredClone no clona prototipos).
    expect(Object.keys(lista[0][0]).sort()).toEqual(['tipo', 'vertices'])
    expect(structuredClone(lista)).toEqual(lista)
    // Copia: mutar el resultado no toca la geometría original ni al contrario.
    lista[0][0].vertices[0][0] = 999
    expect(geom.coordinates[0][0][0]).toBe(0)
  })

  it('NO reorienta: el anillo sale con el sentido y el vértice inicial que traía', () => {
    // Turf/GeoJSON *recomienda* exterior antihorario, pero aquí llegan los dos
    // sentidos (WFS horario, plantilla oficial antihoraria, usuario a su gusto).
    const horario = [...RECT].slice().reverse() // área firmada −24
    const listaCCW = recintosDeGeometriaTurf({ type: 'Polygon', coordinates: [CERRADO] })
    const listaCW = recintosDeGeometriaTurf({
      type: 'Polygon',
      coordinates: [[...horario, horario[0]]],
    })
    expect(orientacion(listaCCW[0][0].vertices)).toBe(1)
    expect(orientacion(listaCW[0][0].vertices)).toBe(-1)
    expect(listaCW[0][0].vertices).toEqual(horario) // ni rebobinado ni rotado
  })

  it('LANZA con un anillo de menos de 4 posiciones, diciendo DÓNDE (regla de oro 1)', () => {
    // Esta geometría la produce el PROGRAMA (@turf/intersect), no el usuario: un
    // anillo así es un contrato roto, no un dato que reportar como Hallazgo.
    const malo = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] }
    expect(() => recintosDeGeometriaTurf(malo)).toThrow(TypeError)
    expect(() => recintosDeGeometriaTurf(malo)).toThrow(
      /Polygon\.anillo\[0\] tiene 3 posiciones y un anillo GeoJSON cerrado necesita al menos 4/,
    )
    // Y en un MultiPolygon dice la pieza y el anillo, no «algo salió mal».
    const maloMulti = {
      type: 'MultiPolygon',
      coordinates: [[[...RECT, [0, 0]]], [[[0, 0], [1, 0], [0, 0]]]],
    }
    expect(() => recintosDeGeometriaTurf(maloMulti)).toThrow(
      /MultiPolygon\.pieza\[1\]\.anillo\[0\] tiene 3 posiciones/,
    )
  })

  it('LANZA con un anillo SIN CERRAR: quitarle la última posición perdería un vértice', () => {
    const abierto = { type: 'Polygon', coordinates: [[[0, 0], [6, 0], [6, 4], [0, 4]]] }
    expect(() => recintosDeGeometriaTurf(abierto)).toThrow(TypeError)
    expect(() => recintosDeGeometriaTurf(abierto)).toThrow(/NO está cerrado/)
    // Sin esta guarda, el resultado sería un rectángulo de 3 vértices con 18 m²
    // en vez de 24: una cifra plausible y falsa.
  })

  it('LANZA con una coordenada no finita, nombrando la posición y el valor', () => {
    const conNaN = {
      type: 'Polygon',
      coordinates: [[[0, 0], [6, 0], [6, Number.NaN], [0, 4], [0, 0]]],
    }
    expect(() => recintosDeGeometriaTurf(conNaN)).toThrow(TypeError)
    expect(() => recintosDeGeometriaTurf(conNaN)).toThrow(
      /Polygon\.anillo\[0\]\[2\] no es una posición UTM \[x,y\] de números finitos/,
    )
  })

  it('LANZA con un tipo de geometría no admitido, y una FeatureCollection NO se aplana', () => {
    expect(() => recintosDeGeometriaTurf({ type: 'LineString', coordinates: [] })).toThrow(
      /tipo de geometría no admitido: "LineString"/,
    )
    expect(() =>
      recintosDeGeometriaTurf({ type: 'FeatureCollection', features: [polygon([CERRADO])] }),
    ).toThrow(/Una 'FeatureCollection' no/)
    expect(() => recintosDeGeometriaTurf(42)).toThrow(/'geometria' debe ser una geometría GeoJSON/)
    expect(() => recintosDeGeometriaTurf('Polygon')).toThrow(/recibido "Polygon"/)
  })

  it('la tercera componente (altitud) se descarta: el modelo es 2D en UTM (regla 3)', () => {
    const con3D = {
      type: 'Polygon',
      coordinates: [[[0, 0, 100], [6, 0, 101], [6, 4, 102], [0, 4, 103], [0, 0, 100]]],
    }
    const lista = recintosDeGeometriaTurf(con3D)
    expect(lista[0][0].vertices).toEqual(RECT)
    expect(lista[0][0].vertices.every((v) => v.length === 2)).toBe(true)
  })
})

describe('geo/poligono.js · IDA Y VUELTA por Turf: recintos → polygon → recintos', () => {
  it('el rectángulo vuelve con los MISMOS vértices, en el mismo orden', () => {
    const recintos = [{ vertices: RECT, tipo: 'EXTERIOR' }]
    const pol = polygon(coordsPoligono(recintos[0]))
    const vuelta = recintosDeGeometriaTurf(pol)
    expect(vuelta).toHaveLength(1)
    expect(vuelta[0]).toEqual(recintos)
  })

  it('el anillo REAL del WFS sobrevive el viaje bit a bit, orientación incluida', () => {
    // 15 vértices con Norte ≈ 4,48·10⁶: si el puente redondeara, reordenara o
    // rebobinara algo, aquí se vería. `toEqual` sobre floats es igualdad EXACTA.
    const recinto = { vertices: ring.anilloExterior, tipo: 'EXTERIOR' }
    const vuelta = recintosDeGeometriaTurf(polygon(coordsPoligono(recinto)))
    expect(vuelta[0][0].vertices).toEqual(ring.anilloExterior)
    expect(vuelta[0][0].tipo).toBe('EXTERIOR')
    // Y las magnitudes derivadas no se mueven ni un dígito.
    expect(area(vuelta[0][0].vertices)).toBe(area(ring.anilloExterior))
    expect(orientacion(vuelta[0][0].vertices)).toBe(ring._verificado.orientacion)
  })

  it('un `MultiPolygon` armado con dos recintos vuelve como dos entradas', () => {
    const a = { vertices: RECT, tipo: 'EXTERIOR' }
    const b = { vertices: [[10, 10], [13, 10], [13, 14], [10, 14]], tipo: 'EXTERIOR' }
    const multi = multiPolygon([coordsPoligono(a), coordsPoligono(b)])
    expect(recintosDeGeometriaTurf(multi)).toEqual([[a], [b]])
  })

  it('el viaje NO normaliza la orientación (queda para F04, se mide con geo/area.js)', () => {
    const horario = { vertices: [...RECT].slice().reverse(), tipo: 'EXTERIOR' }
    const vuelta = recintosDeGeometriaTurf(polygon(coordsPoligono(horario)))
    expect(vuelta[0][0].vertices).toEqual(horario.vertices)
    expect(orientacion(vuelta[0][0].vertices)).toBe(-1)
  })
})

describe('geo/poligono.js · una sola definición en todo el proyecto (F07, T1.1)', () => {
  it('`validation/_comun.js` RE-EXPORTA estas mismas funciones, no otras iguales', () => {
    // Identidad de referencia (`toBe`), no igualdad de valor: dos copias del mismo
    // cuerpo pasarían un test de comportamiento y seguirían siendo dos
    // definiciones que pueden divergir. Es el criterio con el que `distancia`
    // (F06, T1.2) y `OPERATIVOS` se re-exportan desde ahí.
    expect(comunValidacion.anilloCerrado).toBe(anilloCerrado)
    expect(comunValidacion.coordsPoligono).toBe(coordsPoligono)
  })

  it('la API de F02 no cambió: `reglas-topologia.js` sigue sirviéndose de _comun.js', () => {
    expect(typeof comunValidacion.anilloCerrado).toBe('function')
    expect(typeof comunValidacion.coordsPoligono).toBe('function')
    // `recintosDeGeometriaTurf` NO se re-exporta: F02 no la necesita y
    // `validation/_comun.js` es el contrato de la validación, no un barrel.
    expect(comunValidacion.recintosDeGeometriaTurf).toBeUndefined()
  })

  it('los literales de `tipo` son los de `model/parcela.js#TIPO_RECINTO`', () => {
    // `geo/` no importa `model/` (dependencia al revés: ver la cabecera), así que
    // los literales están escritos a mano allí. Esta es la costura que impide que
    // un renombrado en el modelo deje el puente produciendo `tipo` inválidos.
    const lista = recintosDeGeometriaTurf({
      type: 'Polygon',
      coordinates: [[...RECT, [0, 0]], [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
    })
    expect(lista[0][0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(lista[0][1].tipo).toBe(TIPO_RECINTO.HUECO)
    expect(Object.values(TIPO_RECINTO)).toEqual(['EXTERIOR', 'HUECO'])
  })

  it('geo/poligono.js no importa NADA: es hoja del grafo, y no importa turf ni model', () => {
    // Tres afirmaciones de la cabecera, hechas test de una vez: (1) `geo/` no
    // depende de `model/` —esa es la dependencia al revés que este fichero viene a
    // evitar, y meterla aquí sería cambiarla de sitio, no arreglarla—; (2) este
    // módulo no importa turf, así que no puede arrastrarlo a `diagnostico/` ni a
    // nadie (regla de oro 6 por la vía fuerte); (3) sigue el precedente de
    // `geo/metrica.js`, que se vigila con este mismo detector.
    const FUENTE = readFileSync(
      fileURLToPath(new URL('../../geo/poligono.js', import.meta.url)),
      'utf8',
    )
    const IMPORTA =
      /(?:^|\n)[ \t]*(?:import|export)[^\n]*['"]|(?:import|require)\([ \t]*['"]/
    expect(IMPORTA.test(FUENTE), 'geo/poligono.js debe seguir sin dependencias').toBe(false)
    // El detector no es vacuo: dispara sobre un módulo que sí importa.
    const conImports = readFileSync(
      fileURLToPath(new URL('../../validation/_comun.js', import.meta.url)),
      'utf8',
    )
    expect(IMPORTA.test(conImports)).toBe(true)
  })

  it('lo que sale de aquí lo acepta `crearRecinto` SIN avisar de anillo cerrado', () => {
    // La comprobación de que el anillo sale de verdad ABIERTO, hecha con el
    // guardián del propio modelo: `crearRecinto` llama a `console.warn` cuando
    // recibe un anillo cerrado, y aquí no debe sonar ni una vez.
    const avisos = []
    const original = console.warn
    console.warn = (...args) => avisos.push(args.join(' '))
    try {
      const lista = recintosDeGeometriaTurf(polygon([[...RECT, [0, 0]]]))
      const recinto = crearRecinto(lista[0][0].vertices, lista[0][0].tipo)
      expect(recinto.vertices).toEqual(RECT)
      expect(recinto.tipo).toBe('EXTERIOR')
    } finally {
      console.warn = original
    }
    expect(avisos, 'el anillo debe salir ABIERTO: crearRecinto no debe normalizar nada').toEqual([])
  })
})
