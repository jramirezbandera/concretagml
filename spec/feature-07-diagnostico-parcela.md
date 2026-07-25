# F07 · Diagnóstico de encaje (parcela)

**Fase:** 7 · **Prioridad:** P7 · **Riesgo:** Medio · **Depende de:** F05, F06 · **Habilita:** F08, F09.
**Ficheros:** `diagnostico/parcela.js`.

## Objetivo

**El diferencial comercial.** Responder la pregunta previa a presentar un IVG —*¿mi medición cuadra con Catastro?*— que ninguna herramienta contesta. Compara `recintos` (editada) con `geometriaOficial` (intacta del WFS) más colindantes. **Mide y dibuja; no valora, no puntúa, no dictamina.**

## Alcance

### Métricas (10.1)

| Métrica | Cálculo |
|---|---|
| Superficie medida | fórmula del polígono sobre UTM |
| Superficie catastral | `cp:areaValue` del GML oficial |
| Diferencia | absoluta (m²) y relativa (%) |
| Solape | `turf.intersect()` → área |
| % de solape | sobre la mayor de las dos |
| Desplazamiento de centroides | distancia (euclídea propia) |
| Desviación máxima de lindero | máxima entre linderos homólogos |
| Invasión a colindantes | área de intersección con cada vecina |

### Comparación a tres bandas (10.2)

El problema real son **tres** superficies: registral, catastral y medida. Campo de entrada manual para la **superficie registral** y tabla que las enfrenta con diferencias cruzadas. Es el cuadro que hoy se monta a mano en cada pericial.

### Representación (10.5)

Los dos polígonos superpuestos, la diferencia sombreada, las invasiones destacadas. Desviaciones **acotadas sobre el propio dibujo**, con el lindero de máxima desviación **resaltado**; cada acotación con su línea guía.

## Cómo se presenta — CRÍTICO (regla de oro 9)

- **Ni semáforo, ni "apta para presentar", ni umbrales** (ni siquiera uno que elija el usuario). **Sin `config/umbrales.json`.**
- Razón de fondo: una discrepancia grande a menudo significa que la geometría **catastral** está mal —y ése es el motivo del expediente—. Un umbral presupone que Catastro es la referencia buena, falso justo en los casos de uso.
- Ninguna cifra lleva color de mérito: la diferencia de superficie va en **gris de texto**, no en verde. Titular descriptivo: *"Contraste con el parcelario — Medición de X m² frente a los Y m² del parcelario vigente…"*.

### La excepción: invasión a colindantes (10.4)

Única comprobación de otra naturaleza: **hecho topológico binario** (hay/no hay) con consecuencia fija (el expediente se rechaza salvo que se modifique la vecina). Presentar con superficie invadida y parcela afectada, resaltada. **Aquí sí cabe el ámbar.**

## 🔻 OVERRIDE (dossier)

- **Margen de identidad como capa informativa:** existe umbral oficial (**±0,5 m urbana / ±2 m rústica, ≤5%**, BOE-A-2020-12111) pero es criterio de **identidad**, no aprobado/suspenso. Se puede mostrar como **capa informativa etiquetada "margen de identidad del Catastro"**, nunca como veredicto ni parámetro configurable. *(dossier S6/C8).*

## Criterios de aceptación

1. Todas las métricas se calculan sobre fixtures conocidos con el valor esperado (distancias/áreas con helpers propios, `toBeCloseTo`).
2. La tabla a tres bandas acepta la superficie registral manual y muestra las diferencias cruzadas.
3. Invasión a colindante se detecta como binaria con área y parcela afectada.
4. **Ninguna salida contiene veredicto, semáforo ni umbral configurable** (test de que no existe `config/umbrales.json` y de que el texto es descriptivo).

## Referencias

Plan §10, §18 Fase 7, §23.6. Dossier §5.3 (tolerancia/tres bandas), §0.3 (medir no dictaminar), §3.4 (Turf).
