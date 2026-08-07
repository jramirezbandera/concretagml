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
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '..')

/**
 * Los GML que se validan si no se pasa ninguno: los snapshots del round-trip.
 * El de ENTREGA es el que importa —es la forma que produce la app— y el de WFS
 * está a propósito para que se vea que SE COMPORTAN DISTINTO: contra `cp/4.0` a
 * secas, el de entrega valida y el de WFS no. Esa asimetría es el hallazgo.
 *
 * ⭐ F17 añade el TERCERO: un expediente REAL de dos `gml:featureMember`, derivado
 * por `derivacion/entrega.js` sobre la geometría oficial de `7136910UF1473N` —el
 * único envío de este proyecto con IVG positivo— y escrito por la suite
 * (`test/derivacion/entrega.test.js`). No es una variante de laboratorio: es la
 * forma de fichero que la Sede aceptó el 2026-08-03, y hasta hoy ninguna
 * comprobación automática la miraba. Que el esquema no exprese las reglas de
 * negocio del IVG no lo hace menos necesario: **que esto falle sí garantiza un
 * problema**, y esa es la red que faltaba para el sobre de varias parcelas.
 */
const GML_POR_DEFECTO = [
  join(RAIZ, 'test', 'gml', '__snapshots__', 'parcela-entrega.gml'),
  join(RAIZ, 'test', 'gml', '__snapshots__', 'expediente-entrega.gml'),
  join(RAIZ, 'test', 'fixtures', 'gml', 'cp_ejemplo_explicativo.gml'),
]

/** Caché de los XSD descargados. Va en `.gitignore`: son de terceros. */
const CACHE = join(RAIZ, 'esquemas', 'cache')

/** El esquema en su sitio oficial. Es de la Comisión Europea, NO del Catastro. */
const XSD_REMOTO = 'https://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd'
const NS_CP40 = 'http://inspire.ec.europa.eu/schemas/cp/4.0'

// ═════════════════════════════════════════════════════════════════════════════
// ⛔ EL ESQUEMA DE EDIFICIO NO ESTÁ DONDE LO DECLARAN LOS FICHEROS
// ═════════════════════════════════════════════════════════════════════════════
// F13 emite GML de EDIFICIO (`bu-ext2d:Building` + `bu-ext2d:OtherConstruction`)
// y hay que validarlo igual que el de parcela. La trampa es dónde buscarlo:
//
//   · `https://inspire.ec.europa.eu/draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd`
//     —la URL que declara el `xsi:schemaLocation` de TODO fichero BU del
//     Catastro, incluidos los dos fixtures reales de este repo— contesta
//     **200 OK con 376.809 bytes de `text/html`**: la página «Inspire Registry -
//     Page not found» (medido el 2026-08-06). Todo `/draft-schemas/` igual, y en
//     `/schemas/` no existe `bu-ext2d` en ninguna versión (404).
//   · ⭐ **Pero el esquema SÍ existe: lo sirve el propio Catastro.** Es la copia
//     que la ayuda del ICUC llama «*un esquema ligeramente modificado que se
//     mantiene en local*» —modificado para admitir `openAirPool`, el valor con el
//     que la D.G.C. califica las piscinas y que el draft público no tiene—, y
//     está enlazada desde `catastro.hacienda.gob.es/ayuda/vga/ayuda_ICUC.htm`.
//     76.443 bytes de `text/xml`, con todo el árbol de imports en el mismo
//     espejo. Es el esquema contra el que valida el ICUC de verdad, así que es
//     **mejor** oráculo que el de la Comisión aunque estuviera vivo.
//
// ⚠️ Un `200` no dice nada (la lección del WFS del Catastro, F05). Sin la guarda
// de bytes que lleva `validar-xsd.py`, esos 376 kB de HTML se guardarían en la
// caché con extensión `.xsd` y el script informaría de que **el fichero** no
// valida: acusaría al GML de un defecto del servidor del esquema.
//
// ⛔ **Y AUN ASÍ, ESTO NO BASTA — medido contra el ICUC real el 2026-08-06.** El
// fichero que producía la app **validaba contra este mismo esquema** y el
// servicio lo rechazaba: le faltaba `xmlns:xlink` en la raíz, que ningún elemento
// usa, que el XSD no exige y que la ayuda oficial no menciona. Se acotó bisecando
// en cuatro rondas de subida. La red es asimétrica y así hay que leerla: **que
// esto diga OK no garantiza que la Sede lo acepte; que falle sí garantiza que hay
// un problema.** Lo que cubre ese hueco es el guardián de
// `test/gml/serialize-bu.test.js`, que compara contra el fichero real del
// Catastro — también en la raíz, no solo en la geometría.
const XSD_BU_DECLARADO =
  'https://inspire.ec.europa.eu/draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd'

/** El espejo del Catastro: el que sí responde, y contra el que valida el ICUC. */
const XSD_BU_REMOTO =
  'https://www.catastro.hacienda.gob.es/ws/esquemas/GML/inspire.ec.europa.eu/' +
  'draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd'

/** El namespace por el que se reconoce un GML de edificio, lo declare quien lo declare. */
const NS_BU_EXT2D = 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0'

/**
 * Los GML de EDIFICIO que se validan si no se pasa ninguno: el fichero de entrega
 * que produce la app —el que se sube al ICUC— y los dos ficheros reales del
 * Catastro, que son el contrato de verdad de este dialecto.
 */
const GML_BU_POR_DEFECTO = [
  join(RAIZ, 'test', 'gml', '__snapshots__', 'edificio-entrega.gml'),
  join(RAIZ, 'test', 'fixtures', 'gml', 'bu_building_9398516VK3799G.gml'),
  join(RAIZ, 'test', 'fixtures', 'gml', 'bu_buildingpart_9398516VK3799G.gml'),
]

/**
 * ¿Es este fichero del dialecto de EDIFICIO?
 *
 * Se mira el namespace y no el nombre: un GML de edificio renombrado sigue siendo
 * invalidable contra `cp/4.0`, y lo que hay que evitar es el FALLO que suena a
 * defecto del fichero. Basta con la cabecera: el `xmlns` va en la raíz.
 */
function esDeEdificio(ruta) {
  try {
    return readFileSync(ruta, 'utf8').slice(0, 4000).includes(NS_BU_EXT2D)
  } catch {
    return false
  }
}

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
const pedidos =
  rutas.length > 0 ? rutas.map((r) => resolve(r)) : [...GML_POR_DEFECTO, ...GML_BU_POR_DEFECTO]

const faltan = pedidos.filter((f) => !existsSync(f))
if (faltan.length > 0) {
  linea('')
  linea('  ERROR · no existe(n) el/los fichero(s) a validar:')
  for (const f of faltan) linea(`    ${f}`)
  if (rutas.length === 0) {
    linea('')
    linea('  Son los snapshots del round-trip (F04 y F13) y los genera la suite.')
    linea('  Ejecuta primero `npm test` y vuelve a intentarlo.')
  }
  linea('')
  process.exit(1)
}

// ── Cada dialecto con SU esquema (F13) ──────────────────────────────────
//
// Se separan por el NAMESPACE del propio fichero, no por su nombre ni por la
// carpeta: validar un GML de edificio contra `cp/4.0` da un FALLO que suena a
// defecto del fichero cuando lo único que pasa es que se le ha dado el esquema
// equivocado — y ese ruido es justo lo que hace que un guardián deje de leerse.

const grupos = [
  {
    nombre: 'PARCELA',
    ns: NS_CP40,
    xsd: XSD_REMOTO,
    nota: '(SOLO cp/4.0, como el IVG)',
    ficheros: pedidos.filter((f) => !esDeEdificio(f)),
  },
  {
    nombre: 'EDIFICIO',
    ns: NS_BU_EXT2D,
    xsd: XSD_BU_REMOTO,
    nota: '(el espejo del Catastro: el declarado da 200 + HTML)',
    ficheros: pedidos.filter(esDeEdificio),
  },
].filter((g) => g.ficheros.length > 0)

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

// ── Validación ────────────────────────────────────────────────

linea('')
linea(`  Motor      ${hayXmllint ? 'xmllint' : `${python} + lxml`}`)

let codigo = 0
for (const grupo of grupos) {
  linea('')
  linea(`  ${grupo.nombre}`)
  linea(`  Esquema    ${grupo.xsd}`)
  linea(`             ${grupo.nota}`)
  linea('')

  let r
  if (hayXmllint) {
    // `xmllint` resuelve los imports por red él solo. A parcela no se le pasa
    // `wfs.xsd` a propósito: ver la cabecera.
    r = spawnSync('xmllint', ['--noout', '--schema', grupo.xsd, ...grupo.ficheros], {
      stdio: 'inherit',
    })
  } else {
    r = spawnSync(
      python,
      [join(RAIZ, 'scripts', 'validar-xsd.py'), CACHE, grupo.ns, grupo.xsd, ...grupo.ficheros],
      { stdio: 'inherit' },
    )
    if (r.status === 2) {
      linea('')
      linea(`  NO SE PUDO CONSTRUIR EL ESQUEMA de ${grupo.nombre} (¿sin red y sin caché?).`)
      linea('')
      process.exit(estricto ? 2 : 0)
    }
  }
  if (r.status !== 0) codigo = 1
}

linea('')
if (codigo === 0) {
  linea('  OK · valida(n) contra su esquema oficial.')
  linea('')
  linea('  ⚠️  Y ESTO NO GARANTIZA QUE LA SEDE LO ACEPTE. La red es asimétrica: que')
  linea('  falle SÍ garantiza que hay un problema; que pase, no garantiza nada.')
  linea('')
  linea('  De PARCELA el XSD no comprueba la orientación de los anillos, ni que')
  linea('  areaValue cuadre con las coordenadas, ni la ausencia de boundedBy /')
  linea('  validFrom / zoning (que el esquema ADMITE y el IVG rechaza).')
  linea('')
  linea('  De EDIFICIO hay un caso MEDIDO el 2026-08-06: el fichero validaba aquí y')
  linea('  el ICUC lo rechazaba por no declarar `xmlns:xlink` en la raíz — que ningún')
  linea('  elemento usa, que el XSD no exige y que la ayuda oficial no menciona.')
  linea('')
  linea('  Eso lo cubre la suite, comparando contra los ficheros REALES del Catastro.')
} else {
  linea('  FALLO · algún fichero NO valida contra su esquema (el detalle está arriba).')
  linea('')
  linea('  Si el error es «No matching global declaration available for the')
  linea('  validation root» en un GML de PARCELA, el fichero trae la raíz de la')
  linea('  DESCARGA del WFS (`wfs:FeatureCollection`) y no la de ENTREGA')
  linea('  (`gml:FeatureCollection`). Es el fallo del 2026-07-27: mira el `perfil`.')
}
linea('')
process.exit(codigo)
