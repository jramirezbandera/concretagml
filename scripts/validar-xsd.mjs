#!/usr/bin/env node
// scripts/validar-xsd.mjs — F04 · validación contra el XSD oficial de INSPIRE.
//
// Valida uno o varios GML de parcela contra `CadastralParcels.xsd` 4.0 SIN subir
// nada a la Sede Electrónica.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ POR QUÉ ESTE SCRIPT SE REESCRIBIÓ EL 2026-07-27
// ═════════════════════════════════════════════════════════════════════════════
// La primera versión solo sabía usar `xmllint`. En la máquina donde se desarrolla
// F04 `xmllint` no está instalado, así que el script salía SALTADO con código 0
// —tal como estaba diseñado— y **nunca llegó a ejecutarse ni una vez**. Mientras
// tanto la suite daba 1.784 pruebas en verde y el fichero que producía la app era
// rechazado por el IVG: raíz `wfs:FeatureCollection`, que el validador de la Sede
// no conoce porque solo carga el esquema de parcela.
//
// Un guardián que se salta solo no es un guardián: es una intención. De ahí tres
// cambios:
//
//   1. DOS MOTORES. Si no hay `xmllint`, se usa Python con `lxml` (que trae
//      libxml2, el mismo motor). Basta con que haya UNO de los dos.
//   2. `--estricto`. Con esa bandera, no poder validar es un FALLO (código 2) en
//      vez de un salto benigno. Es lo que usa CI, donde sí hay herramientas y
//      donde saltarse la comprobación en silencio es justo lo que pasó.
//   3. SE VALIDA CONTRA `cp/4.0` A SECAS. Sin `wfs/2.0`. Es lo que hace el IVG, y
//      es la única forma de que el fallo real aparezca aquí: con los dos esquemas
//      cargados, el fichero que la Sede rechazó valida perfectamente.
//
// LO QUE EL XSD **NO** DETECTA (por eso los guardianes de la suite no sobran)
// -------------------------------------------------------------------------
// Comprobado leyendo `CadastralParcelType` en el XSD oficial: `validFrom`,
// `validTo` y `zoning` siguen en la secuencia con `minOccurs="0"`, y
// `gml:boundedBy` se hereda de `gml:AbstractFeatureType`. Un GML con cualquiera
// de ellos —que están en el checklist de rechazos del IVG— pasa esta validación
// en verde. El esquema tampoco dice nada de la orientación de los anillos, ni de
// si el `srsName` va en URN o en URI (las dos son `xsd:anyURI` y las dos valen),
// ni de que `areaValue` cuadre con las coordenadas.
//
// Traducción: que esto diga OK no garantiza que la Sede lo acepte; que falle sí
// garantiza que hay un problema. Es una red asimétrica y así hay que leerla.
//
// CÓDIGOS DE SALIDA
//   0 → todo validó (o se saltó sin `--estricto`)
//   1 → algún fichero NO valida, o error de uso
//   2 → no se pudo validar y se pidió `--estricto`

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '..')

/**
 * Los GML que se validan si no se pasa ninguno: los dos snapshots del round-trip.
 * El de ENTREGA es el que importa —es la forma que produce la app— y el de WFS
 * está a propósito para que se vea que SE COMPORTAN DISTINTO: contra `cp/4.0` a
 * secas, el de entrega valida y el de WFS no. Esa asimetría es el hallazgo.
 */
const GML_POR_DEFECTO = [
  join(RAIZ, 'test', 'gml', '__snapshots__', 'parcela-entrega.gml'),
  join(RAIZ, 'test', 'fixtures', 'gml', 'cp_ejemplo_explicativo.gml'),
]

/** Caché de los XSD descargados. Va en `.gitignore`: son de terceros. */
const CACHE = join(RAIZ, 'esquemas', 'cache')

/** El esquema en su sitio oficial. Es de la Comisión Europea, NO del Catastro. */
const XSD_REMOTO = 'https://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd'

const AYUDA_INSTALACION = [
  'Hace falta UNA de estas dos cosas:',
  '',
  '  · xmllint (libxml2)',
  '      Windows  →  winget install --id Gnome.Libxml2',
  '      macOS    →  brew install libxml2   (y añade su bin al PATH)',
  '      Debian   →  sudo apt install libxml2-utils',
  '',
  '  · Python con lxml  (lleva libxml2 dentro: el mismo motor)',
  '      pip install lxml',
]

// ── Presentación ──────────────────────────────────────────────────────────────

const linea = (s = '') => process.stdout.write(`${s}\n`)

// ── Argumentos ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const estricto = argv.includes('--estricto')
const rutas = argv.filter((a) => !a.startsWith('-'))
const ficheros = rutas.length > 0 ? rutas.map((r) => resolve(r)) : GML_POR_DEFECTO

const faltan = ficheros.filter((f) => !existsSync(f))
if (faltan.length > 0) {
  linea('')
  linea('  ERROR · no existe(n) el/los fichero(s) a validar:')
  for (const f of faltan) linea(`    ${f}`)
  if (rutas.length === 0) {
    linea('')
    linea('  Son los snapshots del round-trip de F04 y los genera la suite.')
    linea('  Ejecuta primero `npm test` y vuelve a intentarlo.')
  }
  linea('')
  process.exit(1)
}

// ── Elección del motor ────────────────────────────────────────────────────────

/**
 * ¿Responde este ejecutable a los argumentos dados?
 *
 * ⚠️ SIN `shell: true`, y no es indiferente. Con shell en Windows, `spawnSync`
 * pega los argumentos en una línea de `cmd.exe` sin entrecomillarlos, así que
 * `['-c', 'import lxml.etree']` le llega a Python partido en dos y responde con
 * un error de sintaxis. El síntoma es de los peores posibles: el script concluye
 * «Python no tiene lxml» en una máquina donde sí lo tiene, se salta la validación
 * y sale con 0. O sea, la misma clase de silencio que este script existe para
 * romper. Sin shell, el array de argumentos se respeta y los rutas con espacios
 * tampoco necesitan comillas.
 */
function disponible(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'ignore' })
  return r.error === undefined && r.status === 0
}

/** Primer intérprete de Python que además tenga `lxml`. */
function pythonConLxml() {
  for (const cmd of ['python', 'python3', 'py']) {
    if (disponible(cmd, ['-c', 'import lxml.etree'])) return cmd
  }
  return null
}

const hayXmllint = disponible('xmllint', ['--version'])
const python = hayXmllint ? null : pythonConLxml()

if (!hayXmllint && python === null) {
  linea('')
  linea('  NO SE PUDO VALIDAR · no hay ningún motor de esquema disponible')
  linea('  ─────────────────────────────────────────────────────────────────────')
  for (const l of AYUDA_INSTALACION) linea(`  ${l}`)
  linea('')
  if (estricto) {
    linea('  Se pidió --estricto, así que esto es un FALLO.')
    linea('')
    process.exit(2)
  }
  linea('  Sin --estricto esto no rompe nada, pero que conste: la última vez que')
  linea('  esta comprobación se saltó en silencio, la Sede rechazó el fichero.')
  linea('')
  process.exit(0)
}

// ── Validación ────────────────────────────────────────────────────────────────

linea('')
linea(`  Motor      ${hayXmllint ? 'xmllint' : `${python} + lxml`}`)
linea(`  Esquema    ${XSD_REMOTO}  (SOLO cp/4.0, como el IVG)`)
linea('')

let codigo
if (hayXmllint) {
  // `xmllint` resuelve los imports por red él solo. No se le pasa `wfs.xsd` a
  // propósito: ver la cabecera.
  const r = spawnSync('xmllint', ['--noout', '--schema', XSD_REMOTO, ...ficheros], {
    stdio: 'inherit',
  })
  codigo = r.status === 0 ? 0 : 1
} else {
  const r = spawnSync(python, [join(RAIZ, 'scripts', 'validar-xsd.py'), CACHE, ...ficheros], {
    stdio: 'inherit',
  })
  if (r.status === 2) {
    linea('')
    linea('  NO SE PUDO CONSTRUIR EL ESQUEMA (¿sin red y sin caché?).')
    linea('')
    process.exit(estricto ? 2 : 0)
  }
  codigo = r.status === 0 ? 0 : 1
}

linea('')
if (codigo === 0) {
  linea('  OK · valida(n) contra el esquema oficial de parcela 4.0.')
  linea('')
  linea('  Recordatorio: el XSD NO comprueba la orientación de los anillos, ni que')
  linea('  areaValue cuadre con las coordenadas, ni la ausencia de boundedBy /')
  linea('  validFrom / zoning (que el esquema ADMITE y el IVG rechaza). Eso lo')
  linea('  cubre la suite.')
} else {
  linea('  FALLO · NO valida contra el esquema (el detalle está arriba).')
  linea('')
  linea('  Si el error es «No matching global declaration available for the')
  linea('  validation root», el fichero trae la raíz de la DESCARGA del WFS')
  linea('  (`wfs:FeatureCollection`) y no la de ENTREGA (`gml:FeatureCollection`).')
  linea('  Es el fallo del 2026-07-27: mira el `perfil` con que se serializó.')
}
linea('')
process.exit(codigo)
