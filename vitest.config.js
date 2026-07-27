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

// Dos proyectos, y el sufijo del fichero es lo que enruta: `*.dom.test.js` va a
// `dom` (jsdom: visor, mapa, canvas) y todo lo demás a `node` (geometría, modelo,
// parsers, serializadores). SPEC §6 exige AMBOS en verde para dar una feature por
// hecha, así que desde F03 el script `npm test` corre los dos; `npm run test:node`
// es el bucle rápido.
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
          exclude: ['**/node_modules/**'],
          // Se conserva para que un run FILTRADO por nombre (`npm test -- celda`,
          // que solo casa en `node`) no falle por este proyecto. Contrapartida:
          // si el `include` de arriba se rompiera, los tests dom desaparecerían
          // en verde. YA ESTÁ CERRADO por la guarda transversal de la Fase 4
          // (`test/contrato.test.js`, describe «partición de tests derivada»),
          // que corre en el proyecto `node` —si viviera en `dom`, romper el
          // `include` la desactivaría a ella también— e importa ESTE fichero
          // para afirmar sobre los `include`/`exclude` reales que la partición
          // de `test/` es exacta: sin huérfanos y sin solapes. No cuenta
          // ficheros a propósito: un `toBe(11)` sería una lista escrita a mano
          // con otro nombre. Comprobado rompiendo el `include`: sale rojo
          // NOMBRANDO los ficheros que nadie ejecutaría.
          passWithNoTests: true,
        },
      },
    ],
  },
})
