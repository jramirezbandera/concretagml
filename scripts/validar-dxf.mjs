// scripts/validar-dxf.mjs — ¿ABRE en un CAD el DXF que exportamos?
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⛔ POR QUÉ EXISTE, Y POR QUÉ LA SUITE NO BASTA
// ═══════════════════════════════════════════════════════════════════════════════
// Medido el 2026-08-03, al escribir F10: el DXF del override O12 al pie de la
// letra —sin los marcadores de subclase `100`— **no abre** (`DXFStructureError`
// de ezdxf), y **`parsers/dxf.js` —nuestro propio lector— lo aprueba sin una
// queja**: dos anillos, coordenadas exactas, cero detecciones. La prueba de ida y
// vuelta que iba a ser la red de seguridad **habría salido verde con un fichero
// que no abre en ninguna parte**.
//
// F10 corrigió el exportador y dejó en `test/export/dxf.test.js` los hechos de
// aquella ablación escritos a mano sobre los bytes. Eso es mucho mejor que nada y
// **sigue sin ser un lector**: son 5.955 pruebas comprobando NUESTRA lectura del
// formato. El oráculo de verdad —ezdxf— corrió **una vez, a mano, fuera de la
// suite**, y desde entonces nadie ha vuelto a preguntárselo.
//
// Esto lo hace repetible, que es la diferencia entre una medición y un guardián.
// Es el gemelo exacto de `validar-xsd.mjs`, que existe por lo mismo: el GML lo
// valida el XSD oficial y no nuestro serializador.
//
// ── QUÉ HACE ────────────────────────────────────────────────────────────────
//   1. Genera DXF con el exportador de verdad (`export/dxf.js`) sobre unos casos
//      que cubren lo que el módulo sabe hacer: dos capas, una sola, y con huecos.
//      **No lee ficheros de fixtures**: lo que hay que auditar es lo que la
//      aplicación produce HOY, no lo que produjo el día que se guardó un fixture.
//   2. Busca un Python con `ezdxf` y le pasa los ficheros a `validar-dxf.py`.
//   3. Cuenta lo que salió y sale con el código que toca.
//
// ── CÓDIGOS DE SALIDA, Y EL 2 ES LA LECCIÓN DE `validar-xsd.mjs` ───────────
//   0 → todos abren (o no se pudo comprobar y no se pidió `--estricto`)
//   1 → alguno NO abre, o abre pero hay que arreglarlo, o le faltan capas
//   2 → **no se pudo ni intentar** y se pidió `--estricto`
//
// «No poder medir» no es «está bien». Sin esta distinción, una máquina sin ezdxf
// diría que todo va bien — que es justo el silencio que este script rompe.
//
// Uso:  node scripts/validar-dxf.mjs [--estricto]

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { serializarParcelaDxf } from '../export/dxf.js'

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)))

// ── Los casos que se auditan ────────────────────────────────────────────────
//
// No son «unos cuantos ejemplos»: son las TRES formas que el exportador sabe
// producir, y cada una podría romperse por su cuenta.
//
//   · dos capas  — el caso normal: parcela del Catastro editada;
//   · una capa   — parcela sin geometría oficial (no vino del Catastro). La tabla
//                  LAYER sigue declarando las dos, y eso es deliberado;
//   · con huecos — el formato no tiene la idea de hueco, así que salen como
//                  contornos propios. Son entidades de más en la misma capa.
//
// Las coordenadas son UTM de verdad (huso 30, zona de Málaga) porque
// `redondearCoord` rechaza lo que se sale del rango publicable, y un caso con
// coordenadas de juguete no probaría el camino real.

const BASE_X = 373000
const BASE_Y = 4064000

/** Un cuadrado cerrado de lado `lado`, desplazado `off`. */
const cuadrado = (lado, off = 0) => [
  [BASE_X + off, BASE_Y + off],
  [BASE_X + lado + off, BASE_Y + off],
  [BASE_X + lado + off, BASE_Y + lado + off],
  [BASE_X + off, BASE_Y + lado + off],
  [BASE_X + off, BASE_Y + off],
]

const recinto = (vertices) => ({ vertices })

export const CASOS = Object.freeze([
  Object.freeze({
    nombre: 'dos-capas',
    queEs: 'parcela del Catastro editada: la oficial y la editada en capas separadas',
    opciones: {
      recintosEditados: [recinto(cuadrado(40, 1.67))],
      recintosOficiales: [recinto(cuadrado(40))],
    },
  }),
  Object.freeze({
    nombre: 'una-capa',
    queEs: 'parcela que no vino del Catastro: no hay contorno oficial que dibujar',
    opciones: { recintosEditados: [recinto(cuadrado(40))], recintosOficiales: null },
  }),
  Object.freeze({
    nombre: 'con-huecos',
    queEs: 'recinto con dos huecos, que el formato no sabe expresar y salen como contornos',
    opciones: {
      recintosEditados: [recinto(cuadrado(60)), recinto(cuadrado(10, 8)), recinto(cuadrado(8, 30))],
      recintosOficiales: [recinto(cuadrado(60))],
    },
  }),
])

/**
 * Escribe los casos en un directorio y devuelve lo escrito.
 *
 * ⚠️ **`latin1` y no `utf8`**, y no es indiferente: un DXF R2000 no declara
 * codificación y los CAD lo leen como ANSI. Es la misma decisión que toma
 * `gml/descargar.js` al entregarlo.
 *
 * @param {string} directorio
 * @param {readonly object[]} [casos=CASOS]
 * @returns {Array<{nombre: string, ruta: string, bytes: number, capas: object[]}>}
 */
export function escribirCasos(directorio, casos = CASOS) {
  return casos.map((caso) => {
    const { dxf, capas } = serializarParcelaDxf(caso.opciones)
    const ruta = join(directorio, `${caso.nombre}.dxf`)
    writeFileSync(ruta, dxf, 'latin1')
    return { nombre: caso.nombre, queEs: caso.queEs, ruta, bytes: dxf.length, capas }
  })
}

/**
 * ¿Responde este ejecutable a estos argumentos?
 *
 * ⚠️ SIN `shell: true`, por la misma razón medida que documenta
 * `validar-xsd.mjs`: en Windows el shell pega los argumentos sin entrecomillar y
 * `['-c', 'import ezdxf']` le llega a Python partido en dos, que responde con un
 * error de sintaxis. El síntoma sería «esta máquina no tiene ezdxf» en una
 * máquina que sí lo tiene, y saltarse la comprobación saliendo con 0.
 */
function disponible(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'ignore' })
  return r.error === undefined && r.status === 0
}

/** El primer intérprete de Python que además tenga `ezdxf`. @returns {string|null} */
export function pythonConEzdxf() {
  for (const cmd of ['python', 'python3', 'py']) {
    if (disponible(cmd, ['-c', 'import ezdxf'])) return cmd
  }
  return null
}

// ── El informe ──────────────────────────────────────────────────────────────

const linea = (texto = '') => console.log(texto)

/** Punto de entrada. Exportado para que el test lo llame sin lanzar procesos. */
export function principal(argv = []) {
  const estricto = argv.includes('--estricto')

  linea()
  linea('─ ¿Abre en un CAD el DXF que exportamos? ────────────────────────────────')

  const python = pythonConEzdxf()
  if (python === null) {
    linea('  No hay ningún Python con `ezdxf` en esta máquina, así que NO SE PUEDE')
    linea('  COMPROBAR. Se instala con:  python -m pip install ezdxf')
    linea()
    if (estricto) {
      linea('  Se pidió --estricto, así que esto es un FALLO.')
      linea('  ⚠️ «No poder medir» NO es «está bien»: el exportador ya produjo una vez')
      linea('     un fichero que no abría y que nuestro propio parser aprobaba.')
      return 2
    }
    linea('  Sin --estricto esto no rompe nada, pero que conste: la última vez que')
    linea('  nadie miró, el DXF no abría en ninguna parte.')
    return 0
  }

  const dir = mkdtempSync(join(tmpdir(), 'concreta-dxf-'))
  try {
    const escritos = escribirCasos(dir)
    linea(`  Motor      ${python} + ezdxf`)
    linea(`  Casos      ${escritos.length}, generados con export/dxf.js (no son fixtures)`)
    linea()
    for (const e of escritos) {
      const capas = e.capas.map((c) => `${c.nombre}:${c.entidades}`).join(' · ')
      linea(`  · ${e.nombre.padEnd(12)} ${String(e.bytes).padStart(6)} B  [${capas}]`)
      linea(`    ${e.queEs}`)
    }
    linea()

    const r = spawnSync(python, [join(RAIZ, 'scripts', 'validar-dxf.py'), ...escritos.map((e) => e.ruta)], {
      stdio: 'inherit',
    })
    linea()
    if (r.error !== undefined || r.status === 2) {
      linea('  El validador no ha podido correr.')
      return estricto ? 2 : 0
    }
    if (r.status !== 0) {
      linea('⛔ Algún DXF NO abriría limpio en un CAD. Arriba está cuál y por qué.')
      return 1
    }
    linea('✅ Todos abren con `readfile`, sin un solo arreglo del auditor, y sus capas')
    linea('   están en la tabla LAYER.')
    return 0
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ⚠️ Comparación de rutas SIN distinguir mayúsculas: en Windows `process.argv[1]`
// llega con la unidad en minúscula (`e:\…`) y `import.meta.url` en mayúscula
// (`E:/…`), así que la comparación estricta daba `false` y el script no corría
// nunca al invocarlo. Es el mismo caso que documenta `vitest.config.js`.
const invocadoDirectamente =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()

if (invocadoDirectamente) process.exit(principal(process.argv.slice(2)))
