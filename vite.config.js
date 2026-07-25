import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Concreta GML — F03 · tooling de la app (frontend puro).
//
// Vite solo se usa como servidor de desarrollo (`npm run dev`) y empaquetador
// estático (`npm run build`). NO es un backend (regla de oro 7): el producto
// sigue siendo frontend puro; Vite es andamiaje de dev/build.
//
// Windows (mismo bug de casing que `vitest.config.js`, vitest-dev/vitest#5251):
// si el proceso invoca la herramienta con la letra de unidad del cwd en
// MINÚSCULA (`e:\...`), el runner puede tropezar. Se normaliza el `root` a
// unidad MAYÚSCULA para que dev/build sean inmunes al casing del invocador.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(
  /^([a-z]):/,
  (_, d) => `${d.toUpperCase()}:`,
)

// La entrada de la app es `index.html` en la raíz (llega en F03, Tarea 4.1).
export default defineConfig({
  root,
})
