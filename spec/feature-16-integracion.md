# F16 · Integración Concreta y cierre

**Fase:** 16 · **Prioridad:** P16 · **Riesgo:** Bajo · **Depende de:** F09, F10 · **Habilita:** —.
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
