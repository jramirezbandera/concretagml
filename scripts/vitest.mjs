#!/usr/bin/env node
// Envoltorio de Vitest — auditoría F00, hallazgo A11 (RESUELTO).
//
// En Windows, si el proceso que invoca vitest tiene el cwd con la letra de
// unidad en MINÚSCULA (`e:\...`), Vitest 4.1 falla en TODOS los ficheros con
//   "TypeError: Cannot read properties of undefined (reading 'config')"
//   "Vitest failed to find the current suite"
// (vitest-dev/vitest#5251: desajuste de casing entre el registro del runner y
// las rutas de los módulos). Reproducido 100% determinista en este repo:
// `cmd /d e:\... && npx vitest run` falla; con `E:\...` pasa. No hay versión
// estable posterior a 4.1.10 que lo corrija (comprobado 2026-07-24).
//
// Este envoltorio re-lanza el CLI de vitest con el cwd (y el propio binario)
// en su forma CANÓNICA de Windows (realpathSync.native → `E:\...`), de modo
// que `npm test` es inmune al casing heredado del shell/invocador.
// ⚠️ Invocar `npx vitest` a pelo desde un cwd en minúscula seguirá fallando:
// usa siempre los scripts de npm.
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const pkg = require('vitest/package.json')
const pkgDir = dirname(require.resolve('vitest/package.json'))
const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vitest
const bin = realpathSync.native(resolve(pkgDir, binRel))
const cwd = realpathSync.native(process.cwd())

const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
