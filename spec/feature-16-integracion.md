# F16 · Integración Concreta y cierre

**Fase:** 16 · **Prioridad:** P19 · **Riesgo:** Bajo · **Depende de:** F09, F10 · **Habilita:** —.
**Ficheros:** integración global, página de créditos/licencias.

## Objetivo

Encajar el módulo GML en el producto Concreta (sesión compartida, entrada desde el flujo principal) y cerrar los requisitos legales de atribución y licencias.

## Alcance

- **Sesión compartida** con Concreta y **entrada desde el flujo principal** (el módulo GML se invoca desde el resto de la aplicación, no es una isla).
- **Página de software de terceros con licencias** y créditos.
- **Atribución obligatoria** en visor e informes (ya sembrada en F03/F09): Dirección General del Catastro, IGN/CNIG (CC-BY 4.0), OpenStreetMap (ODbL, con enlace).

## 🔻 OVERRIDE (dossier)

- **O9 — Leaflet = BSD-2-Clause**, no MIT (el plan §21/§3.5 dice MIT). Corregir la página de créditos. Turf, jsPDF, html2canvas y proj4js sí son MIT. **Fijar el SPDX exacto de la versión empaquetada de cada librería en el build.** *(dossier S7/C9).*

## Requisitos legales (§21) — checklist de cierre

- Atribución a DGC e IGN/CNIG en visor e informes.
- Atribución a OpenStreetMap bajo ODbL.
- Página de licencias de terceros con el SPDX correcto (Leaflet **BSD-2-Clause**, Turf/jsPDF MIT…).
- Nada de peticiones teseladas al WMS del Catastro ni descargas masivas (garantizado por F03/F05).
- Caché en IndexedDB de los GML por RC (F05).
- **RGPD/LOPDGDD:** la RC aislada + cartografía son públicas; lo protegido (titularidad, valor catastral) no se trata. El procesamiento client-side sin backend minimiza el tratamiento — argumento a favor de la arquitectura.
- Replicar la **función** de la competencia es lícito; copiar su código, diseño/look&feel, textos o marca, no.

## Criterios de aceptación

1. El módulo se abre desde el flujo principal de Concreta con la sesión compartida.
2. La página de créditos lista cada dependencia con su SPDX correcto (Leaflet BSD-2-Clause).
3. Las atribuciones obligatorias aparecen en visor e informes.

## Referencias

Plan §18 Fase 16, §21. Dossier §5.5 (licencias, atribución, RGPD, competencia lícita), §0.1 C9 (Leaflet).

## Estado (2026-11-01): créditos y licencias hechos, integración sin empezar

| Criterio | Estado |
|---|---|
| 1 · Abrirse desde Concreta con la sesión compartida | ⛔ Sin empezar. Depende de cómo esté hecho Concreta, que no está en este repositorio. |
| 2 · Créditos con el SPDX correcto de cada dependencia | ✅ Expediente › «Créditos y licencias» (`app/dialogo-creditos.js`). |
| 3 · Atribuciones en visor e informes | ✅ Ya lo estaban desde F03 y F09. El diálogo las reúne, importadas de `viewer/atribucion.js` y `services/cartociudad.js`, sin reescribirlas. |

### ⛔ La lista del override O9 había caducado antes de usarla

O9 decía «Turf, jsPDF, html2canvas y proj4js sí son MIT». Medido sobre el paquete
construido:

- **jsPDF y html2canvas no van.** El PDF lo escribe `report/` y el plano se compone
  en canvas.
- **proj4js tiene prohibido entrar** (`vite.config.js#gmlSinProj4`).
- **Van 32 paquetes, no los 10 de `package.json`.** Turf arrastra veinte
  subpaquetes, y además van `bignumber.js`, `polyclip-ts`, `rbush`,
  `robust-predicates` (Unlicense), `splaytree-ts`… `@turf/helpers` y `@turf/meta`
  van **en dos versiones a la vez** (7.3.5 y 7.4.0), así que el inventario tiene 34
  entradas.

Por eso la lista no se escribe a mano: el plugin `gmlLicencias` de `vite.config.js`
la saca del paquete construido y emite `licencias.json` (lo lee el diálogo) y
`licencias-terceros.txt` (los textos completos, que es lo que MIT, ISC, BSD y la OFL
piden que viaje con cada copia). Los dos entran en el precache del service worker.

### ⛔ El SPDX se comprueba, no se copia

`splaytree-ts@1.0.2` declara la licencia `"BDS-3-Clause"`, que no existe. Su
`LICENSE` dice BSD 3-Clause. `licencias/terceros.js` tiene una lista cerrada de
licencias admitidas (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Unlicense): **cualquier
otra para el build**. Las correcciones van atadas a `nombre@versión` y a una frase
que tiene que aparecer en el texto de la licencia, así que si el paquete sube de
versión el build vuelve a pararse a mirar.

Leaflet sale BSD-2-Clause porque lo dice su `package.json`, y una prueba lo afirma
sobre el paquete real (`test/licencias/terceros.test.js`).

### Lo que queda

- **En `npm run dev` no hay inventario**, porque lo escribe el build. El diálogo lo
  dice («el inventario lo escribe el build…») en vez de enseñar una lista vacía.
- **Firma humana:** abrir el diálogo en la URL publicada, desplegar una ficha y
  descargar el `.txt`, también sin conexión con la aplicación instalada.
