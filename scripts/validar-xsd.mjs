#!/usr/bin/env node
// scripts/validar-xsd.mjs — F04 · criterio de aceptación 6, la mitad OPCIONAL.
//
// Valida un GML de parcela contra el XSD oficial de INSPIRE Cadastral Parcels
// 4.0 usando `xmllint`, SIN subir nada a la Sede Electrónica del Catastro.
//
// POR QUÉ ESTE SCRIPT ESTÁ FUERA DE `npm test`
// --------------------------------------------
// El criterio 6 de F04 pedía «validación de esquema en CI con libxmljs/xmllint».
// Cumplirlo dentro de la suite exigía una de dos cosas, y las dos son peores que
// el problema que resuelven:
//   · `libxmljs` — módulo NATIVO. En Windows arrastra toolchain de compilación y
//     convierte `npm install` en una lotería. Este proyecto es frontend puro y su
//     única dependencia de build es Vite: meter node-gyp para validar un XML es
//     desproporcionado.
//   · Vendorizar el árbol de XSD — `CadastralParcels.xsd` importa GML 3.2.1, que
//     importa ISO 19139, que importa media docena más. Son decenas de ficheros de
//     terceros, y sin un catálogo XML no resuelven offline.
// La decisión (tomada con el usuario al planificar F04) fue partir el criterio en
// dos: la parte que SIEMPRE corre es el guardián estructural de
// `test/gml/aceptacion-f04.test.js`, que afirma punto por punto el checklist de
// rechazos del IVG derivándolo del GML real del WFS; y la parte de esquema es
// este script, opcional, que quien tenga `xmllint` puede ejecutar cuando quiera.
//
// LO QUE EL XSD **NO** DETECTA (por eso el guardián estructural no es redundante)
// -----------------------------------------------------------------------------
// Comprobado leyendo `CadastralParcelType` en el XSD oficial: `validFrom`,
// `validTo` y `zoning` siguen en la secuencia con `minOccurs="0"`, y
// `gml:boundedBy` se hereda de `gml:AbstractFeatureType`. Es decir: un GML con
// cualquiera de esos elementos —que están en el checklist de rechazos del IVG—
// **pasa esta validación en verde**. El esquema tampoco dice nada de la
// orientación de los anillos (override O1), ni de que el `srsName` deba ser la
// URI y no la URN (O2), ni de que `areaValue` cuadre con las coordenadas.
// Traducción: que este script diga OK no significa que la Sede lo acepte, y que
// falle sí significa que hay un problema. Es una red de seguridad asimétrica, y
// así hay que leerla.
//
// CÓDIGOS DE SALIDA
//   0 → validó correctamente, O se saltó por falta de herramienta/esquema
//   1 → el fichero NO valida contra el esquema, o hubo un error de uso
// El «saltado» sale con 0 A PROPÓSITO: este script no está en la ruta de nadie
// que no lo haya invocado, y romper por no tener instalado un binario opcional
// sería justo el tipo de fricción que se quería evitar.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '..')

/** GML que se valida si no se pasa ninguno: el snapshot del round-trip de F04. */
const GML_POR_DEFECTO = join(RAIZ, 'test', 'gml', '__snapshots__', 'parcela.gml')

/** Árbol de esquemas local (opcional). Está en `.gitignore`: es de terceros. */
const XSD_LOCAL = join(RAIZ, 'esquemas', 'cp', '4.0', 'CadastralParcels.xsd')

/** El mismo esquema en su sitio oficial. Es de la Comisión Europea, NO del Catastro. */
const XSD_REMOTO = 'https://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd'

// ── Presentación ──────────────────────────────────────────────────────────────

const linea = (s = '') => process.stdout.write(`${s}\n`)

function saltado(motivo, comoArreglarlo) {
  linea('')
  linea('  SALTADO · validación de esquema XSD')
  linea('  ─────────────────────────────────────────────────────────────────────')
  linea(`  ${motivo}`)
  linea('')
  for (const paso of comoArreglarlo) linea(`  ${paso}`)
  linea('')
  linea('  Esto NO es un fallo: el guardián estructural de F04 corre siempre en')
  linea('  `npm test` y cubre el checklist de rechazos del IVG. Esta validación')
  linea('  de esquema es una comprobación adicional y opcional.')
  linea('')
  process.exit(0)
}

// ── Comprobaciones ────────────────────────────────────────────────────────────

const argumentos = process.argv.slice(2).filter((a) => !a.startsWith('-'))
if (argumentos.length > 1) {
  linea('')
  linea('  Uso: npm run validar:xsd [-- ruta/al/fichero.gml]')
  linea('')
  linea(`  Sin argumento valida ${GML_POR_DEFECTO}`)
  linea('')
  process.exit(1)
}

const gml = argumentos.length === 1 ? resolve(argumentos[0]) : GML_POR_DEFECTO

if (!existsSync(gml)) {
  // Que falte el fichero A VALIDAR sí es un error de uso: lo has pedido tú.
  // (Salvo el caso benigno de que aún no exista el snapshot, que se explica.)
  const esElPorDefecto = gml === GML_POR_DEFECTO
  linea('')
  linea(`  ERROR · no existe el fichero a validar:\n    ${gml}`)
  if (esElPorDefecto) {
    linea('')
    linea('  Es el snapshot del round-trip de F04, y lo genera la suite de tests.')
    linea('  Ejecuta primero `npm test` y vuelve a intentarlo.')
  }
  linea('')
  process.exit(1)
}

const xmllint = spawnSync('xmllint', ['--version'], { stdio: 'ignore', shell: true })
if (xmllint.error !== undefined || xmllint.status !== 0) {
  saltado('`xmllint` no está disponible en el PATH.', [
    'Para instalarlo:',
    '  · Windows  →  winget install --id Gnome.Libxml2',
    '                (o `choco install xsltproc`, que trae xmllint)',
    '  · macOS    →  brew install libxml2  (y añade su bin al PATH)',
    '  · Debian   →  sudo apt install libxml2-utils',
  ])
}

// ── Validación ────────────────────────────────────────────────────────────────

const hayEsquemaLocal = existsSync(XSD_LOCAL)
const esquema = hayEsquemaLocal ? XSD_LOCAL : XSD_REMOTO

if (!hayEsquemaLocal) {
  linea('')
  linea('  AVISO · no hay árbol de esquemas local, se usará el remoto.')
  linea(`         ${XSD_REMOTO}`)
  linea('         Requiere red, y xmllint tendrá que descargar también los XSD')
  linea('         importados (GML 3.2.1, base 3.3, ISO 19139): puede tardar.')
  linea('')
  linea('  Para validar OFFLINE y de forma reproducible, coloca el árbol en')
  linea(`         ${join(RAIZ, 'esquemas', 'cp', '4.0')}`)
  linea('  (está en .gitignore: son ficheros de terceros, no código del proyecto).')
}

linea('')
linea(`  Validando  ${gml}`)
linea(`  Contra     ${esquema}`)
linea('')

const r = spawnSync('xmllint', ['--noout', '--schema', esquema, gml], {
  stdio: 'inherit',
  shell: true,
})

if (r.status === 0) {
  linea('')
  linea('  OK · el fichero valida contra el esquema.')
  linea('')
  linea('  Recordatorio: el XSD NO comprueba la orientación de los anillos (O1),')
  linea('  ni que el srsName sea la URI y no la URN (O2), ni que areaValue cuadre')
  linea('  con las coordenadas, ni la ausencia de boundedBy/validFrom/zoning (que')
  linea('  el esquema ADMITE y el IVG rechaza). Eso lo cubre la suite de tests.')
  linea('')
  process.exit(0)
}

linea('')
linea('  FALLO · el fichero NO valida contra el esquema (ver el detalle arriba).')
linea('')
process.exit(1)
