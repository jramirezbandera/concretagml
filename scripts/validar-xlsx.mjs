// scripts/validar-xlsx.mjs — ¿ABRE en Excel el libro que exportamos?
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⛔ POR QUÉ EXISTE, Y POR QUÉ LA SUITE NO BASTA
// ═══════════════════════════════════════════════════════════════════════════════
// `test/export/xlsx.test.js` comprueba los bytes con mucho detalle, y una parte de
// eso lo hace contra un oráculo ajeno (`node:zlib.crc32`). Aun así **es nuestro
// lector leyendo nuestro fichero**, y este proyecto ya sabe adónde lleva eso: el DXF
// de F10 **no abría en ningún CAD** y `parsers/dxf.js` lo aprobaba sin una queja —dos
// anillos, coordenadas exactas, cero detecciones—, así que la prueba de ida y vuelta
// que iba a ser la red de seguridad habría salido VERDE con un fichero inservible.
//
// Esto es el gemelo de `validar-dxf.mjs` y de `validar-xsd.mjs`: le da los ficheros a
// un lector que no hemos escrito nosotros.
//
// ⚠️ **Y con la segunda lección puesta**: el **2026-08-05** aquel validador dio verde
// a un DXF que colgaba ZWCAD, porque `ezdxf` **rellena por su cuenta lo que falta al
// cargar**. openpyxl hace lo mismo. Por eso `validar-xlsx.py` hace **dos pasadas** y
// la segunda no lo toca: mira el paquete con la biblioteca estándar y comprueba lo que
// un lector tolerante perdona y Excel no —partes sin declarar, relaciones que no
// apuntan a nada, índices de estilo fuera de rango—.
//
// ⚠️ **Nada de esto sustituye a abrir el fichero en Excel.** Eso está en la firma
// humana, y es BLOQUEANTE: lo del DXF lo destapó una persona.
//
// ── QUÉ HACE ────────────────────────────────────────────────────────────────
//   1. Genera libros con el exportador de verdad (`export/excel-coordenadas.js`)
//      sobre los casos que cubren lo que la maqueta sabe hacer. **No lee fixtures**:
//      lo que hay que auditar es lo que la aplicación produce HOY.
//   2. Escribe un manifiesto con lo que CADA caso debería contener —las pestañas, el
//      primer vértice— para que el validador compare contra la intención y no solo
//      consigo mismo.
//   3. Busca un Python y le pasa el manifiesto.
//   4. Cuenta lo que salió y sale con el código que toca.
//
// ── CÓDIGOS DE SALIDA, Y EL 2 ES LA LECCIÓN DE `validar-xsd.mjs` ───────────
//   0 → todo bien (o no se pudo comprobar y no se pidió `--estricto`)
//   1 → algún libro está mal
//   2 → **no se pudo ni intentar** y se pidió `--estricto`
//
// «No poder medir» no es «está bien». Sin esta distinción, una máquina sin openpyxl
// diría que todo va bien — que es justo el silencio que este script rompe.
//
// Uso:  node scripts/validar-xlsx.mjs [--estricto]

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { serializarCoordenadasExcel } from '../export/excel-coordenadas.js'

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)))

// ── Los casos que se auditan ────────────────────────────────────────────────
//
// Son las formas que la maqueta sabe producir, y cada una podría romperse por su
// cuenta:
//
//   · una-hoja      — el caso normal: una parcela sin huecos;
//   · con-huecos    — tres pestañas, y el pie de medidas SOLO en la primera;
//   · sin-geometria — el caso que NO puede devolver un libro vacío, porque Excel no
//                     abre un libro sin hojas;
//   · con-avisos    — vértices que se funden al redondear: el bloque de detecciones
//                     se imprime DENTRO del libro;
//   · sin-datos     — sin referencia catastral y sin huso: dos «No consta».
//
// Las coordenadas son UTM de verdad (huso 30, zona de Málaga) porque `redondearCoord`
// rechaza lo que se sale del rango publicable, y un caso con coordenadas de juguete no
// probaría el camino real.

const BASE_X = 373000
const BASE_Y = 4064000

/** Un cuadrado ABIERTO de lado `lado`, desplazado `off`. */
const cuadrado = (lado, off = 0) => [
  [BASE_X + off, BASE_Y + off],
  [BASE_X + lado + off, BASE_Y + off],
  [BASE_X + lado + off, BASE_Y + lado + off],
  [BASE_X + off, BASE_Y + lado + off],
]

const recinto = (vertices, tipo = 'EXTERIOR') => ({ vertices, tipo })

/**
 * Instante FIJO. No se lee el reloj ni aquí ni en el exportador: así dos corridas del
 * mismo día producen los mismos bytes y una diferencia siempre significa algo.
 */
const FECHA = new Date(Date.UTC(2026, 7, 6, 12, 0, 0))

export const CASOS = Object.freeze([
  Object.freeze({
    nombre: 'una-hoja',
    queEs: 'parcela sin huecos: una pestaña con su tabla y su pie de medidas',
    opciones: {
      recintos: [recinto(cuadrado(40))],
      refcat: '9398516VK3799G',
      srs: 'EPSG:25830',
      nombre: 'Subsanación de discrepancias',
    },
    hojas: ['Contorno exterior'],
  }),
  Object.freeze({
    nombre: 'con-huecos',
    queEs: 'exterior y dos huecos: tres pestañas, y el pie solo en la primera',
    opciones: {
      recintos: [
        recinto(cuadrado(60)),
        recinto(cuadrado(10, 8), 'HUECO'),
        recinto(cuadrado(8, 30), 'HUECO'),
      ],
      refcat: '9398516VK3799G',
      srs: 'EPSG:25830',
    },
    hojas: ['Contorno exterior', 'Hueco 1', 'Hueco 2'],
  }),
  Object.freeze({
    nombre: 'sin-geometria',
    queEs: 'parcela sin un solo vértice: NO puede salir un libro sin hojas',
    opciones: { recintos: [], refcat: '9398516VK3799G', srs: 'EPSG:25830' },
    hojas: ['Parcela sin geometría'],
  }),
  Object.freeze({
    nombre: 'con-avisos',
    queEs: 'dos vértices que se funden al redondear: el aviso va impreso en la hoja',
    opciones: {
      recintos: [
        recinto([
          [BASE_X, BASE_Y],
          [BASE_X + 0.001, BASE_Y + 0.002],
          [BASE_X + 40, BASE_Y],
          [BASE_X + 40, BASE_Y + 40],
          [BASE_X, BASE_Y + 40],
        ]),
      ],
      refcat: '9398516VK3799G',
      srs: 'EPSG:25830',
    },
    hojas: ['Contorno exterior'],
  }),
  Object.freeze({
    nombre: 'sin-datos',
    queEs: 'parcela dibujada: sin referencia catastral y sin huso, y se dice',
    opciones: { recintos: [recinto(cuadrado(25))] },
    hojas: ['Contorno exterior'],
  }),
])

/**
 * Escribe los casos en un directorio y devuelve el manifiesto que lee el validador.
 *
 * ⚠️ **Sin codificación**: `writeFileSync` con un `Uint8Array` escribe los bytes tal
 * cual. Pasarle una codificación —o convertir a cadena antes— corrompería el ZIP en
 * silencio, que es exactamente el fallo contra el que existe `descargarBinario`.
 *
 * El manifiesto lleva **lo que cada libro DEBERÍA contener** para que la comprobación
 * no sea solo de coherencia interna: un fichero puede estar perfectamente bien formado
 * y decir otra cosa de la que se pidió.
 *
 * @param {string} directorio
 * @param {readonly object[]} [casos=CASOS]
 * @returns {Array<object>}
 */
export function escribirCasos(directorio, casos = CASOS) {
  return casos.map((caso) => {
    const { bytes, nHojas, nVertices, detecciones } = serializarCoordenadasExcel({
      ...caso.opciones,
      fecha: FECHA,
    })
    const ruta = join(directorio, `${caso.nombre}.xlsx`)
    writeFileSync(ruta, bytes)

    // La fila del primer vértice depende de si hay expediente en la cabecera: se
    // calcula aquí en vez de fijarla, para que este script no se quede viejo al
    // cambiar una fila de la maqueta.
    const filasCabecera = caso.opciones.nombre === undefined ? 6 : 7
    const filaPrimerVertice = filasCabecera + 3 // + blanco + cabecera de columnas
    const primeros = caso.opciones.recintos?.[0]?.vertices?.[0]

    return {
      nombre: caso.nombre,
      queEs: caso.queEs,
      ruta,
      bytes: bytes.length,
      hojas: caso.hojas,
      nHojas,
      nVertices,
      detecciones: detecciones.length,
      primerVertice:
        primeros === undefined || caso.nombre === 'con-avisos'
          ? null
          : { fila: filaPrimerVertice, n: 1, x: primeros[0], y: primeros[1] },
    }
  })
}

/**
 * ¿Responde este ejecutable a estos argumentos?
 *
 * ⚠️ SIN `shell: true`, por la misma razón medida que documentan `validar-xsd.mjs` y
 * `validar-dxf.mjs`: en Windows el shell pega los argumentos sin entrecomillar y
 * `['-c', 'import openpyxl']` le llega a Python partido en dos, que responde con un
 * error de sintaxis. El síntoma sería «esta máquina no tiene openpyxl» en una máquina
 * que sí lo tiene, y saltarse la comprobación saliendo con 0.
 */
function disponible(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'ignore' })
  return r.error === undefined && r.status === 0
}

/**
 * El primer intérprete de Python que haya.
 *
 * ⚠️ **No se exige `openpyxl` para elegirlo**, al contrario que en `validar-dxf.mjs`,
 * y es a propósito: aquí la pasada estructural —que es la que atrapa los fallos que un
 * lector tolerante perdona— corre **con la biblioteca estándar**. Un Python pelado ya
 * mide la mitad más valiosa, así que descartarlo por no traer openpyxl sería tirar la
 * medición buena por no tener la cómoda.
 *
 * @returns {{cmd: string, conOpenpyxl: boolean}|null}
 */
export function buscarPython() {
  for (const cmd of ['python', 'python3', 'py']) {
    if (!disponible(cmd, ['-c', 'import sys'])) continue
    return { cmd, conOpenpyxl: disponible(cmd, ['-c', 'import openpyxl']) }
  }
  return null
}

// ── El informe ──────────────────────────────────────────────────────────────

const linea = (texto = '') => console.log(texto)

/** Punto de entrada. Exportado para que el test lo llame sin lanzar procesos. */
export function principal(argv = []) {
  const estricto = argv.includes('--estricto')

  linea()
  linea('─ ¿Abre en Excel el libro que exportamos? ────────────────────────────────')

  const python = buscarPython()
  if (python === null) {
    linea('  No hay ningún Python en esta máquina, así que NO SE PUEDE COMPROBAR.')
    linea()
    if (estricto) {
      linea('  Se pidió --estricto, así que esto es un FALLO.')
      linea('  ⚠️ «No poder medir» NO es «está bien»: este proyecto ya publicó una vez')
      linea('     un fichero que no abría y que su propio lector aprobaba.')
      return 2
    }
    return 0
  }

  const dir = mkdtempSync(join(tmpdir(), 'concreta-xlsx-'))
  try {
    const escritos = escribirCasos(dir)
    const manifiesto = join(dir, 'manifiesto.json')
    writeFileSync(manifiesto, JSON.stringify(escritos), 'utf8')

    linea(`  Motor      ${python.cmd}${python.conOpenpyxl ? ' + openpyxl' : ' (sin openpyxl)'}`)
    linea(`  Casos      ${escritos.length}, generados con export/excel-coordenadas.js`)
    linea()
    for (const e of escritos) {
      const hojas = e.hojas.join(' · ')
      linea(
        `  · ${e.nombre.padEnd(14)} ${String(e.bytes).padStart(6)} B  ` +
          `${e.nVertices} vért · ${e.detecciones} avisos  [${hojas}]`,
      )
      linea(`    ${e.queEs}`)
    }
    linea()

    const r = spawnSync(python.cmd, [join(RAIZ, 'scripts', 'validar-xlsx.py'), manifiesto], {
      stdio: 'inherit',
    })
    linea()
    if (r.error !== undefined || r.status === 2) {
      linea('  El validador no ha podido correr.')
      return estricto ? 2 : 0
    }
    if (r.status === 1) {
      linea('⛔ Algún libro NO abriría limpio en Excel. Arriba está cuál y por qué.')
      return 1
    }
    if (r.status === 3) {
      linea('⚠️ El PAQUETE está bien formado, pero sin openpyxl no se ha comprobado que')
      linea('   se pueda LEER: los números podrían haber salido como texto y no se vería.')
      linea('   Se instala con:  python -m pip install openpyxl')
      return estricto ? 2 : 0
    }
    linea('✅ Los libros abren con openpyxl y el paquete está bien formado: partes')
    linea('   declaradas, relaciones que apuntan a algo y estilos dentro de rango.')
    linea('⚠️ Y aun así, esto NO es Excel. Esa comprobación es de la firma humana.')
    return 0
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ⚠️ Comparación de rutas SIN distinguir mayúsculas: en Windows `process.argv[1]` llega
// con la unidad en minúscula (`e:\…`) y `import.meta.url` en mayúscula (`E:/…`), así
// que la comparación estricta daba `false` y el script no corría nunca al invocarlo.
// Es el mismo caso que documenta `vitest.config.js`.
const invocadoDirectamente =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()

if (invocadoDirectamente) process.exit(principal(process.argv.slice(2)))
