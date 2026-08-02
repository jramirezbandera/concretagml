import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPERATIVOS } from '../../config/operativos.js'
import * as comunValidacion from '../../validation/_comun.js'

// F06 · T1.2 — `config/operativos.js` es el cargador ÚNICO de las tolerancias
// operativas. Antes vivía dentro de `validation/_comun.js`, lo que obligaba a
// `edit/` (que necesita `snapMetros`) a depender de la capa de VALIDACIÓN para
// leer una constante. Este fichero vigila las dos cosas que ese movimiento tiene
// que garantizar: que sigue habiendo UNA sola definición, y que la API pública
// de F02 no ha cambiado.

const RAIZ = fileURLToPath(new URL('../..', import.meta.url))

describe('config/operativos.js · una sola definición para todo el proyecto', () => {
  it('`validation/_comun.js` RE-EXPORTA este mismo objeto, no una copia', () => {
    // Identidad de referencia (`toBe`), no igualdad de valor: dos objetos con
    // las mismas cifras pasarían un `toEqual` y seguirían pudiendo divergir el
    // día que alguien tocara uno solo. Es exactamente el criterio con el que
    // `viewer/_comun.js` re-exporta `NIVEL`.
    expect(comunValidacion.OPERATIVOS).toBe(OPERATIVOS)
  })

  it('está CONGELADO: nadie puede reescribir una tolerancia en caliente', () => {
    expect(Object.isFrozen(OPERATIVOS)).toBe(true)
    // Los módulos ES son strict mode: asignar sobre un objeto congelado LANZA
    // en vez de fallar en silencio, que es justo lo que queremos aquí.
    expect(() => {
      OPERATIVOS.snapMetros = 5
    }).toThrow(TypeError)
    expect(OPERATIVOS.snapMetros).toBe(0.2)
  })

  it('solo `config/operativos.js` lee el JSON; el resto del proyecto lee el módulo', () => {
    // Verdad-terreno sobre disco: la garantía «una sola definición» no puede
    // depender de que nadie vuelva a escribir el import del JSON en otro sitio.
    const SALTA = new Set(['node_modules', 'dist', '.git', '.gstack', '.claude'])
    // La ruta se escribe distinta según quién importe (`./operativos.json` desde
    // el propio `config/`, `../config/operativos.json` desde fuera), así que se
    // casa el NOMBRE del fichero al final de la especificación del módulo.
    const IMPORTA_JSON =
      /(?:^|\n)[ \t]*import[^\n]*['"][^'"]*operativos\.json['"]|import\([ \t]*['"][^'"]*operativos\.json['"]/
    const fuentes = []
    const pila = ['']
    while (pila.length > 0) {
      const rel = pila.pop()
      for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
        const hijo = rel === '' ? e.name : `${rel}/${e.name}`
        if (e.isDirectory()) {
          if (!SALTA.has(e.name)) pila.push(hijo)
        } else if (e.isFile() && /\.(?:js|mjs)$/.test(hijo)) {
          fuentes.push(hijo)
        }
      }
    }
    const lectores = fuentes
      .filter((f) => IMPORTA_JSON.test(readFileSync(join(RAIZ, f), 'utf8')))
      .sort()
    expect(
      lectores,
      'el JSON de tolerancias solo debe cargarlo config/operativos.js. Cualquier ' +
        'otro lector es una segunda definición esperando a divergir: importa ' +
        '`OPERATIVOS` del módulo.',
    ).toEqual(['config/operativos.js'])
    expect(fuentes.length, 'el recorrido de fuentes no ha encontrado nada que mirar')
      .toBeGreaterThan(0)
  })

  it('el módulo expone exactamente lo que hay en el JSON, sin filtrar ni renombrar', () => {
    // Se lee el JSON con `readFileSync` y no con `import`: así este test no se
    // convierte él mismo en un segundo lector y la guarda de arriba puede exigir
    // UN solo fichero, sin excepciones para sí misma.
    const crudo = JSON.parse(readFileSync(join(RAIZ, 'config/operativos.json'), 'utf8'))
    expect({ ...OPERATIVOS }).toEqual(crudo)
  })
})

describe('config/operativos.json · contenido y regla de oro 9', () => {
  const CLAVES_F02 = [
    'duplicadoMetros',
    'segmentoCortoMetros',
    'colinealidadGrados',
    'superficieMinimaM2',
    'areaNulaM2',
    'maxVertices',
  ]
  const CLAVES_F06 = ['snapMetros', 'senoMinimoOffset', 'miterLimiteFactor', 'acotacionMinimaPx']
  const CLAVES_F07 = [
    'pasoDesviacionMetros',
    'grosorInvasionMinimoM',
    'cotaDiagnosticoMinimaPx',
  ]
  const CLAVES_F09 = ['epsilonColindanteMetros', 'rumboSimilarGrados']

  it('conserva intactas las tolerancias de F02 (la extracción no cambió ninguna cifra)', () => {
    expect(OPERATIVOS.duplicadoMetros).toBe(0.001)
    expect(OPERATIVOS.segmentoCortoMetros).toBe(0.05)
    expect(OPERATIVOS.colinealidadGrados).toBe(179.9)
    expect(OPERATIVOS.superficieMinimaM2).toBe(1)
    expect(OPERATIVOS.areaNulaM2).toBe(0.000001)
    expect(OPERATIVOS.maxVertices).toBe(500)
  })

  it('añade las cuatro tolerancias de F06 con sus valores especificados', () => {
    expect(OPERATIVOS.snapMetros).toBe(0.2)
    expect(OPERATIVOS.senoMinimoOffset).toBe(0.01)
    expect(OPERATIVOS.miterLimiteFactor).toBe(4)
    expect(OPERATIVOS.acotacionMinimaPx).toBe(44)
  })

  it('`snapMetros` está por debajo de la precisión de captura del Catastro (<25 cm, SPEC §3)', () => {
    // El porqué de la cifra, hecho test: enganchar por encima del error del
    // parcelario de referencia sería fingir una precisión que el dato no tiene.
    expect(OPERATIVOS.snapMetros).toBeLessThanOrEqual(0.25)
    expect(OPERATIVOS.snapMetros).toBeGreaterThan(OPERATIVOS.segmentoCortoMetros)
  })

  it('`senoMinimoOffset` es un seno (∈ (0,1]) y vale ≈ 0,57°', () => {
    expect(OPERATIVOS.senoMinimoOffset).toBeGreaterThan(0)
    expect(OPERATIVOS.senoMinimoOffset).toBeLessThanOrEqual(1)
    expect((Math.asin(OPERATIVOS.senoMinimoOffset) * 180) / Math.PI).toBeCloseTo(0.573, 2)
  })

  it('`miterLimiteFactor` es el de SVG (4 ⇒ bisel por debajo de θ ≈ 29°)', () => {
    // miterlimit = 1/sin(θ/2) ⇒ θ = 2·asin(1/limit).
    const theta = (2 * Math.asin(1 / OPERATIVOS.miterLimiteFactor) * 180) / Math.PI
    expect(theta).toBeCloseTo(28.96, 1)
  })

  it('añade las tres tolerancias de F07 con sus valores especificados', () => {
    expect(OPERATIVOS.pasoDesviacionMetros).toBe(0.3)
    expect(OPERATIVOS.grosorInvasionMinimoM).toBe(0.001)
    expect(OPERATIVOS.cotaDiagnosticoMinimaPx).toBe(12)
  })

  it('`pasoDesviacionMetros` da del orden de 100 muestras en un lado de ~30 m', () => {
    // El criterio explícito de la tarea: ni 3 muestras (se saltaría el punto de
    // desviación máxima) ni un paso tan fino que dispare el coste del muestreo
    // sobre ≤500 vértices contra el contorno oficial completo.
    const muestrasLado30m = 30 / OPERATIVOS.pasoDesviacionMetros
    expect(muestrasLado30m).toBeGreaterThanOrEqual(50)
    expect(muestrasLado30m).toBeLessThanOrEqual(200)
  })

  it('añade las dos tolerancias de F09 con sus valores especificados', () => {
    expect(OPERATIVOS.epsilonColindanteMetros).toBe(0.3)
    expect(OPERATIVOS.rumboSimilarGrados).toBe(22.5)
  })

  it('`epsilonColindanteMetros` supera la precisión de captura del Catastro (<25 cm)', () => {
    // La sonda con la que `report/literal.js` pregunta «¿quién hay al otro lado de
    // este lindero?» se planta a esta distancia, PERPENDICULARMENTE y hacia fuera.
    // Dos parcelas vecinas declaran cada una por su lado la MISMA línea de lindero,
    // y esas dos versiones no coinciden al milímetro: las separan el paso de
    // cuantización del WFS (0,01 m) y la precisión de captura del propio Catastro
    // (<25 cm, 85 % ≤20 cm — SPEC §3, la misma cifra que sostiene `snapMetros`).
    // Una sonda más corta que eso puede caer en la tierra de nadie que queda entre
    // las dos y volver «sin colindante» teniéndolo pegado.
    expect(OPERATIVOS.epsilonColindanteMetros).toBeGreaterThan(0.25)
    // Y por arriba, muy por debajo del fondo de cualquier parcela real: la sonda
    // tiene que ENTRAR en la vecina, no atravesarla.
    expect(OPERATIVOS.epsilonColindanteMetros).toBeLessThan(1)
  })

  it('`rumboSimilarGrados` es el SEMISECTOR cardinal de `geo/rumbo.js` (45°/2)', () => {
    // Los ocho cuadrantes miden 45° y están CENTRADOS en el rumbo que nombran, así
    // que 22,5° es la distancia del centro de un sector a su borde: dos lados que
    // se separen menos caen, como mucho, en sectores contiguos y el tramo agrupado
    // puede llevar un cardinal que describa a los dos. No se lee de `geo/rumbo.js`
    // —que no lo exporta— porque son dos decisiones distintas: allí define dónde
    // parte un sector, aquí cuándo dos lados se cuentan como un solo tramo.
    expect(OPERATIVOS.rumboSimilarGrados).toBe(45 / 2)
    expect(OPERATIVOS.rumboSimilarGrados).toBeLessThan(45)
  })

  it('el patrón `duplicadoMetros² = areaNulaM2` sigue en pie (era casualidad implícita)', () => {
    // `duplicadoMetros` (10⁻³ m, «dos puntos más juntos que esto son el mismo
    // punto») elevado al cuadrado da EXACTAMENTE `areaNulaM2`, el suelo de ruido de
    // float64. Estaba así desde F02 sin que nada lo dijera; este test lo convierte
    // en patrón vigilado, para que nadie cambie una cifra sin la otra.
    expect(OPERATIVOS.duplicadoMetros ** 2).toBeCloseTo(OPERATIVOS.areaNulaM2, 12)
  })

  it('`grosorInvasionMinimoM` ES `duplicadoMetros`, y no por casualidad', () => {
    // ⛔ ESTA CLAVE SUSTITUYE A `areaInvasionMinimaM2` (10⁻⁴ m²), que vivió medio
    // día y la medición refutó (2026-07-29). Aquella se calibró elevando al cuadrado
    // el paso de cuantización del WFS —(10⁻² m)² = 10⁻⁴ m²—, lo que supone la
    // astilla CUADRADA. Medida sobre el fixture real, la astilla es una AGUJA: área
    // ≈ ½·L·δ, que crece con la LONGITUD del lindero compartido. Resultado: las dos
    // astillas reales (1,23 y 3,77 cm²) SUPERABAN el umbral y la parcela oficial
    // «invadía» a dos colindantes oficiales sin que nadie tocara un vértice.
    //
    // El grosor no depende de L, y su valor no se inventa: una pieza más delgada que
    // la distancia a la que consideramos dos puntos el mismo punto está entre dos
    // linderos que consideramos el mismo lindero.
    expect(OPERATIVOS.grosorInvasionMinimoM).toBe(OPERATIVOS.duplicadoMetros)

    // Y queda muy por debajo de cualquier invasión que un técnico revisaría: una
    // franja de 5 cm de fondo tiene mil veces este grosor.
    expect(OPERATIVOS.grosorInvasionMinimoM).toBeLessThan(0.05)
  })

  it('no queda ni rastro de `areaInvasionMinimaM2`: una cifra refutada no se deja de adorno', () => {
    // Config muerta es peor que config ausente: quien la encuentre supondrá que
    // alguien la usa. Su historia está escrita en el JSDoc de la clave que la
    // sustituyó, que es donde sirve de algo.
    expect(OPERATIVOS.areaInvasionMinimaM2).toBeUndefined()
    expect(Object.keys(OPERATIVOS)).not.toContain('areaInvasionMinimaM2')
  })

  it('`cotaDiagnosticoMinimaPx` es MENOR que `acotacionMinimaPx`: no necesita que quepa el texto', () => {
    // La cota de diagnóstico lleva línea guía (SPEC feature-07, «Representación»):
    // el rótulo puede ir donde haya hueco, así que el suelo de 44 px —pensado
    // para que el NÚMERO quepa EN LÍNEA entre los extremos del lado— no aplica.
    // Lo que queda es un suelo puramente perceptivo: que el segmento señalado
    // sea un hueco real, no un punto.
    expect(OPERATIVOS.cotaDiagnosticoMinimaPx).toBeLessThan(OPERATIVOS.acotacionMinimaPx)
    expect(OPERATIVOS.cotaDiagnosticoMinimaPx).toBeGreaterThan(0)
  })

  it('todas las claves son números finitos y positivos (salvo `_nota`)', () => {
    for (const [k, v] of Object.entries(OPERATIVOS)) {
      if (k === '_nota') {
        expect(typeof v).toBe('string')
        continue
      }
      expect(Number.isFinite(v), `${k} debe ser un número finito`).toBe(true)
      expect(v, `${k} debe ser > 0`).toBeGreaterThan(0)
    }
  })

  it('no hay claves de más ni de menos: solo F02 + F06 + F07 + F09 + `_nota`', () => {
    expect(Object.keys(OPERATIVOS).sort()).toEqual(
      ['_nota', ...CLAVES_F02, ...CLAVES_F06, ...CLAVES_F07, ...CLAVES_F09].sort(),
    )
  })

  it('la `_nota` dice de qué fases son las tolerancias, y ya son cuatro', () => {
    expect(OPERATIVOS._nota).toMatch(/F02/)
    expect(OPERATIVOS._nota).toMatch(/F06/)
    expect(OPERATIVOS._nota).toMatch(/F07/)
    expect(OPERATIVOS._nota).toMatch(/F09/)
    expect(OPERATIVOS._nota).toMatch(/INGENIER[IÍ]A/i)
  })

  it('la `_nota` deja escrito que el margen oficial de identidad NO vive aquí', () => {
    // Regla de oro 9 + el override de F07: el margen ±0,5 m urbana / ±2 m
    // rústica (BOE-A-2020-12111) es una cifra de una norma publicada, no una
    // tolerancia de ingeniería de este proyecto. Que quede escrito en la
    // `_nota` es lo que evita que alguien la añada aquí «para tenerlas todas
    // juntas» y la convierta, sin querer, en un umbral configurable.
    expect(OPERATIVOS._nota).toMatch(/margen/i)
    expect(OPERATIVOS._nota).toMatch(/diagnostico\/margen\.js/)
  })

  it('`config/umbrales.json` NO existe y sigue PROHIBIDO (regla de oro 9)', () => {
    // La app mide y señala; el colegiado interpreta y firma. Estas cifras dicen
    // cómo se calcula o cómo se dibuja, nunca si algo es «válido».
    expect(
      existsSync(join(RAIZ, 'config/umbrales.json')),
      'config/umbrales.json está prohibido por la regla de oro 9: ninguna cifra lleva veredicto',
    ).toBe(false)
  })
})
