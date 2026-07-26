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

/**
 * Guardián de la regla de oro 7: **`proj4` JAMÁS entra en el bundle**.
 *
 * `proj4` es `devDependency` y su ÚNICO uso legítimo es la fábrica de fixtures de
 * test (`test/geo/utm-control.factory.test.js`), que genera coordenadas de control
 * contra las que se contrasta el motor UTM PROPIO del proyecto (serie de
 * Krüger/Karney en `geo/utm.js`). El producto no lleva proj4: si acabara en el
 * bundle, tendríamos dos motores de proyección en producción —el propio y el de
 * la librería— y ninguna garantía de que coincidan, que es justo lo que la
 * arquitectura evita teniendo motor propio y contrastándolo en test.
 *
 * Hasta ahora eso era una convención escrita. Esto lo convierte en una barrera:
 * cualquier `import 'proj4'` alcanzable desde la entrada REVIENTA el build.
 *
 * `apply: 'build'` a propósito: en `dev` no se empaqueta nada (y los tests corren
 * con `vitest.config.js`, que no funde este fichero), así que el guardián solo
 * tiene sentido —y solo actúa— cuando se produce el artefacto de producción.
 *
 * @returns {import('vite').Plugin}
 */
function gmlSinProj4() {
  return {
    name: 'gml-sin-proj4',
    apply: 'build',
    // `enforce: 'pre'` NO es decorativo: sin él el guardián NO DISPARA, y se
    // comprobó empíricamente (build con `import proj4` que pasó en verde y subió
    // el bundle de 188 kB a 318 kB). Vite ordena los plugins alias → usuario
    // `pre` → NÚCLEO DE VITE → usuario normal → post, así que un `resolveId` de
    // usuario en orden normal llega cuando `vite:resolve` YA ha resuelto 'proj4'
    // a `node_modules` y devuelto un resultado: los hooks `resolveId` paran en el
    // primero que no devuelve null, luego el nuestro no se llegaba a llamar.
    enforce: 'pre',
    resolveId(id) {
      if (id !== 'proj4' && !id.startsWith('proj4/')) return null
      throw new Error(
        `gml-sin-proj4: se ha intentado empaquetar '${id}' y eso rompe la REGLA DE ORO 7: ` +
          `proj4 es devDependency y NUNCA entra en el bundle de producción. El motor UTM de ` +
          `este proyecto es PROPIO (serie de Krüger/Karney, 'geo/utm.js'); usa 'forward'/'inverse' ` +
          `de ahí, o 'geo/huso.js' para el huso. El único uso legítimo de proj4 es la fábrica de ` +
          `fixtures de test 'test/geo/utm-control.factory.test.js', que genera las coordenadas de ` +
          `control contra las que se contrasta ese motor propio — y esa fábrica no es código de ` +
          `la app, no cuelga de la entrada y por tanto no pasa por aquí.`,
      )
    },
  }
}

// La entrada de la app es `index.html` en la raíz (F03, Fase 4).
//
// NO se configura `base`: el despliegue (y el `base` que un subdirectorio de
// GitHub Pages necesitaría) es materia de F16, decisión ya tomada. Consecuencia
// asumida y esperada: `dist/index.html` NO funciona abierto por `file://`; para
// verlo hay que servirlo (`npx vite preview`).
export default defineConfig({
  root,
  plugins: [gmlSinProj4()],
})
