import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Windows (auditoría F00, hallazgo A11 — RESUELTO): si el proceso invoca vitest
// con la letra de unidad del cwd en minúscula (`e:\...`), Vitest 4.1 falla en
// TODOS los ficheros con "Cannot read properties of undefined (reading 'config')"
// / "failed to find the current suite" (vitest-dev/vitest#5251, drive casing).
// Reproducido 100% determinista: cmd con `e:` falla, con `E:` pasa. Se normaliza
// el root a unidad MAYÚSCULA para que el runner sea inmune al casing del invocador.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(
  /^([a-z]):/,
  (_, d) => `${d.toUpperCase()}:`,
)

// F00 usa solo el proyecto `node` (geometría/modelo puros, sin DOM).
// El proyecto `dom` queda preconfigurado y vacío; F03+ (visor/canvas) lo activará
// con ficheros `*.dom.test.js`.
export default defineConfig({
  root,
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.test.js'],
          exclude: ['test/**/*.dom.test.js', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/**/*.dom.test.js'],
          // F00 no tiene tests dom; que el proyecto vacío no fuerce exit 1.
          passWithNoTests: true,
        },
      },
    ],
  },
})
