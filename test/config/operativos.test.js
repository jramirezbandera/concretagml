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

  it('no hay claves de más ni de menos: solo F02 + F06 + `_nota`', () => {
    expect(Object.keys(OPERATIVOS).sort()).toEqual(
      ['_nota', ...CLAVES_F02, ...CLAVES_F06].sort(),
    )
  })

  it('la `_nota` dice de qué fases son las tolerancias, y ya son dos', () => {
    expect(OPERATIVOS._nota).toMatch(/F02/)
    expect(OPERATIVOS._nota).toMatch(/F06/)
    expect(OPERATIVOS._nota).toMatch(/INGENIER[IÍ]A/i)
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
