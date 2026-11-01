/* -------------------------------------------------------------------------- *
 * test/licencias/terceros.test.js — F16 · el inventario de lo empaquetado      *
 *                                                                              *
 * Lo que se vigila, por orden de lo caro que sería romperlo:                   *
 *   · que una licencia que no se puede afirmar PARE el build (no se publica    *
 *     una página de licencias con un identificador inventado);                 *
 *   · que la corrección de `splaytree-ts` siga atada a su versión y a su texto;*
 *   · que Leaflet salga BSD-2-Clause (override O9), leído del paquete real;    *
 *   · que dos versiones del mismo paquete sean dos entradas.                   *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  CORRECCIONES,
  FUENTES,
  SPDX_ADMITIDAS,
  componerAviso,
  esFuente,
  ficheroLicencia,
  inventariar,
  lineasCopyright,
  paqueteDeModulo,
} from '../../licencias/terceros.js'

const RAIZ = join(import.meta.dirname, '..', '..')

const MIT = 'The MIT License (MIT)\n\nCopyright (c) 2017 TurfJS\n\nPermission is hereby granted…'

/** Un paquete de entrada con lo mínimo. */
const paquete = (extra = {}) => ({ nombre: 'x', version: '1.0.0', licencia: 'MIT', texto: MIT, ...extra })

/** El paquete de npm de verdad, leído como lo lee el plugin. */
function paqueteReal(nombre) {
  const dir = join(RAIZ, 'node_modules', nombre)
  const datos = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const fichero = ficheroLicencia(readdirSync(dir))
  return {
    nombre,
    version: datos.version,
    licencia: datos.license,
    texto: fichero === null ? null : readFileSync(join(dir, fichero), 'utf8'),
  }
}

describe('paqueteDeModulo · de la ruta de un módulo, su paquete', () => {
  it('un paquete suelto, con barras de Windows', () => {
    expect(paqueteDeModulo('D:\\GML\\node_modules\\leaflet\\dist\\leaflet-src.js')).toEqual({
      nombre: 'leaflet',
      dir: 'D:/GML/node_modules/leaflet',
    })
  })

  it('un paquete con ámbito', () => {
    expect(paqueteDeModulo('/r/node_modules/@turf/helpers/dist/esm/index.js').nombre).toBe('@turf/helpers')
  })

  it('⭐ anidado, cuenta el ÚLTIMO node_modules: es el que aporta el código', () => {
    const p = paqueteDeModulo('/r/node_modules/@turf/union/node_modules/@turf/helpers/dist/index.js')
    expect(p).toEqual({ nombre: '@turf/helpers', dir: '/r/node_modules/@turf/union/node_modules/@turf/helpers' })
  })

  it('quita el prefijo de los módulos virtuales y la consulta', () => {
    expect(paqueteDeModulo('\0/r/node_modules/idb/build/index.js?commonjs-proxy').nombre).toBe('idb')
  })

  it('lo nuestro no es de nadie', () => {
    expect(paqueteDeModulo('D:/GML/app/main.js')).toBeNull()
    expect(paqueteDeModulo('/r/node_modules/.vite/deps/x.js')).toBeNull()
    expect(paqueteDeModulo('/r/node_modules/@turf')).toBeNull()
  })
})

describe('ficheroLicencia y esFuente', () => {
  it('encuentra LICENSE, LICENCE.md (bignumber.js) y COPYING', () => {
    expect(ficheroLicencia(['package.json', 'LICENSE', 'README.md'])).toBe('LICENSE')
    expect(ficheroLicencia(['LICENCE.md', 'bignumber.js'])).toBe('LICENCE.md')
    expect(ficheroLicencia(['COPYING'])).toBe('COPYING')
    expect(ficheroLicencia(['package.json', 'license-checker.js'])).toBeNull()
  })

  it('una tipografía es una tipografía, y una hoja no', () => {
    expect(esFuente('assets/Geist-Regular-B1wb-odA.woff2')).toBe(true)
    expect(esFuente('assets/index-4YwN1GvN.css')).toBe(false)
  })

  it('el patrón de Geist casa con los cinco ficheros que hay de verdad', () => {
    const geist = FUENTES.find((f) => f.spdx === 'OFL-1.1')
    const woff = readdirSync(join(RAIZ, 'estilos', 'fuentes')).filter(esFuente)
    expect(woff).toHaveLength(5)
    for (const f of woff) expect(geist.patron.test(`estilos/fuentes/${f}`)).toBe(true)
  })
})

describe('lineasCopyright', () => {
  it('saca los avisos, sin repetir', () => {
    const bsd = 'BSD 2-Clause License\n\nCopyright (c) 2010-2023, Volodymyr Agafonkin\nCopyright (c) 2010-2011, CloudMade\n'
    expect(lineasCopyright(bsd)).toEqual([
      'Copyright (c) 2010-2023, Volodymyr Agafonkin',
      'Copyright (c) 2010-2011, CloudMade',
    ])
  })

  it('⛔ «Copyright Holder» y «COPYRIGHT HOLDERS» no son avisos (la OFL y la BSD los parten así)', () => {
    const texto =
      'Copyright (c) 2023 Vercel\n' +
      'Copyright Holder. This restriction only applies to the primary font name as\n' +
      'Copyright Holder(s) and the Author(s) or with their explicit written\n' +
      'COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,\n'
    expect(lineasCopyright(texto)).toEqual(['Copyright (c) 2023 Vercel'])
  })

  it('el de bignumber.js viene en Markdown y sale sin las comillas invertidas', () => {
    expect(lineasCopyright('Copyright © `<2025>` `Michael Mclaughlin`')).toEqual([
      'Copyright © <2025> Michael Mclaughlin',
    ])
  })

  it('la Unlicense no tiene aviso, y no se inventa', () => {
    expect(lineasCopyright('This is free and unencumbered software released into the public domain.')).toEqual([])
  })
})

describe('inventariar · lo que se dice de cada paquete', () => {
  it('nombre, versión, SPDX, avisos, enlace a npm y texto', () => {
    const { paquetes } = inventariar({ paquetes: [paquete({ nombre: '@turf/bbox', version: '7.3.5' })] })
    expect(paquetes).toEqual([
      {
        nombre: '@turf/bbox',
        version: '7.3.5',
        spdx: 'MIT',
        copyright: ['Copyright (c) 2017 TurfJS'],
        url: 'https://www.npmjs.com/package/@turf/bbox/v/7.3.5',
        texto: MIT,
      },
    ])
  })

  it('⛔ una licencia fuera de la lista cerrada PARA el build, y dice qué paquete', () => {
    expect(() => inventariar({ paquetes: [paquete({ nombre: 'gpl-cosa', licencia: 'GPL-3.0-only' })] })).toThrow(
      /gpl-cosa@1\.0\.0.*GPL-3\.0-only/,
    )
    expect(() => inventariar({ paquetes: [paquete({ licencia: '(MIT OR Apache-2.0)' })] })).toThrow(/admitidas/)
    expect(() => inventariar({ paquetes: [paquete({ licencia: [{ type: 'MIT' }] })] })).toThrow(/admitidas/)
  })

  it('⛔ un paquete sin fichero de licencia también lo para', () => {
    expect(() => inventariar({ paquetes: [paquete({ texto: null })] })).toThrow(/no trae fichero de licencia/)
  })

  it('⭐ splaytree-ts 1.0.2 sale BSD-3-Clause, y se dice qué declaraba', () => {
    const real = paqueteReal('splaytree-ts')
    expect(real.licencia).toBe('BDS-3-Clause') // la errata sigue ahí; si no, revisar CORRECCIONES
    const [obra] = inventariar({ paquetes: [real] }).paquetes
    expect(obra.spdx).toBe('BSD-3-Clause')
    expect(obra.declarada).toBe('BDS-3-Clause')
  })

  it('⛔ la corrección está atada a la versión: con otra, el build se para a mirar', () => {
    const real = paqueteReal('splaytree-ts')
    expect(() => inventariar({ paquetes: [{ ...real, version: '1.0.3' }] })).toThrow(/BDS-3-Clause/)
  })

  it('⛔ y a su prueba: si el texto ya no dice BSD 3-Clause, no se corrige a ciegas', () => {
    const real = paqueteReal('splaytree-ts')
    expect(() => inventariar({ paquetes: [{ ...real, texto: MIT }] })).toThrow(/ya no casa/)
    expect(() => inventariar({ paquetes: [{ ...real, licencia: 'MIT' }] })).toThrow(/ya no casa/)
  })

  it('ninguna corrección corrige a algo que no esté admitido', () => {
    for (const c of Object.values(CORRECCIONES)) expect(SPDX_ADMITIDAS).toContain(c.spdx)
  })

  it('⭐ O9 · Leaflet es BSD-2-Clause, leído del paquete que se empaqueta', () => {
    const [obra] = inventariar({ paquetes: [paqueteReal('leaflet')] }).paquetes
    expect(obra.spdx).toBe('BSD-2-Clause')
    expect(obra.copyright).toContain('Copyright (c) 2010-2023, Volodymyr Agafonkin')
  })

  it('⭐ dos versiones son dos entradas; la misma versión en dos carpetas, una', () => {
    const { paquetes } = inventariar({
      paquetes: [
        paquete({ nombre: '@turf/helpers', version: '7.4.0' }),
        paquete({ nombre: '@turf/helpers', version: '7.3.5' }),
        paquete({ nombre: '@turf/helpers', version: '7.4.0' }),
        paquete({ nombre: 'idb', version: '8.0.3', licencia: 'ISC' }),
      ],
    })
    expect(paquetes.map((p) => `${p.nombre}@${p.version}`)).toEqual([
      '@turf/helpers@7.3.5',
      '@turf/helpers@7.4.0',
      'idb@8.0.3',
    ])
  })
})

describe('inventariar · las tipografías', () => {
  const geist = FUENTES[0]
  const nota = readFileSync(join(RAIZ, geist.licencia), 'utf8')

  it('⭐ el texto empieza en la línea «Copyright» de la nota: lo de antes es nuestro', () => {
    const [obra] = inventariar({ paquetes: [], fuentes: [{ fuente: geist, texto: nota }] }).fuentes
    expect(obra.texto.startsWith('Copyright (c) 2023 Vercel, in collaboration with basement.studio')).toBe(true)
    expect(obra.texto).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(obra.texto).not.toContain('Procedencia de los ficheros')
    expect(obra.copyright).toEqual(['Copyright (c) 2023 Vercel, in collaboration with basement.studio'])
    expect(obra).toMatchObject({ nombre: 'Geist y Geist Mono', spdx: 'OFL-1.1' })
  })

  it('⛔ una nota sin línea «Copyright» para el build', () => {
    expect(() => inventariar({ paquetes: [], fuentes: [{ fuente: geist, texto: 'nada' }] })).toThrow(/Copyright/)
  })
})

describe('componerAviso · el .txt que viaja con la aplicación', () => {
  const inventario = inventariar({
    paquetes: [paqueteReal('leaflet'), paqueteReal('splaytree-ts'), paqueteReal('robust-predicates')],
    fuentes: [{ fuente: FUENTES[0], texto: readFileSync(join(RAIZ, FUENTES[0].licencia), 'utf8') }],
  })
  const aviso = componerAviso(inventario)

  it('lleva cada obra con su versión, su SPDX y su texto completo', () => {
    expect(aviso).toContain('leaflet 1.9.4 — BSD-2-Clause')
    expect(aviso).toContain('robust-predicates 3.0.3 — Unlicense')
    expect(aviso).toContain('Geist y Geist Mono — OFL-1.1')
    for (const o of [...inventario.paquetes, ...inventario.fuentes]) expect(aviso).toContain(o.texto)
    expect(aviso).toContain('3 paquetes de software (contando cada versión) y 1 tipografía.')
  })

  it('dice lo que se corrigió', () => {
    expect(aviso).toContain('(su package.json dice «BDS-3-Clause»; el texto de abajo es BSD-3-Clause)')
  })

  it('⛔ es determinista: una fecha cambiaría la versión del service worker en cada build', () => {
    expect(componerAviso(inventario)).toBe(aviso)
    expect(aviso).not.toMatch(/\b20\d\d-\d\d-\d\d\b/)
  })
})

describe('vite.config.js · el plugin, en su sitio', () => {
  it('⭐ el inventario se emite ANTES de que el service worker haga su lista', async () => {
    const { default: config } = await import('../../vite.config.js')
    const nombres = config.plugins.map((p) => p.name)
    expect(nombres.indexOf('gml-licencias')).toBeGreaterThan(-1)
    expect(nombres.indexOf('gml-licencias')).toBeLessThan(nombres.indexOf('gml-service-worker'))
    const plugin = config.plugins.find((p) => p.name === 'gml-licencias')
    expect(plugin.apply).toBe('build')
    expect(plugin.enforce).toBeUndefined()
  })
})
