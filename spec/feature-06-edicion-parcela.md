# F06 · Edición (parcela)

**Fase:** 6 · **Prioridad:** P6 · **Riesgo:** Medio (offset/snap) · **Depende de:** F03, F05 · **Habilita:** F07.
**Ficheros:** `edit/snap.js`, `edit/offset.js`, `edit/dibujo.js` (base).

## Objetivo

Edición básica (no un CAD) que cubre el caso frecuente: **ajustar unos vértices sobre la parcela oficial**. Con retroalimentación numérica en vivo.

## Alcance

- **Arrastrar, insertar y eliminar vértice.**
- **Editar la coordenada tecleándola en la celda de la tabla** — elemental y ausente en la competencia.
- **Snap** al parcelario oficial y a las colindantes: tolerancia configurable (20 cm por defecto), indicador visual, desactivable con tecla modificadora. Proyección punto→segmento: `t = clamp(dot(P−A,AB)/dot(AB,AB), 0, 1)`; `F = A + t·AB`; si `dist < τ`, `P←F`.
- **Desplazamiento de lindero en paralelo (offset perpendicular)** — la operación más usada: seleccionar un lado y desplazarlo una distancia; los vértices contiguos se recalculan por intersección con los lados adyacentes. `nrm=(u.y,−u.x)`; recta desplazada; `intersectRectas`. **Guard de paralelismo:** si `|den| < ε` → fallback traslación/bevel (miter-limit; la velocidad del vértice diverge en ángulos agudos).
- **Deshacer/rehacer** (usa `edit/historial.js` de F00; snapshot en `dragstart`/`dragend`, no por `mousemove`).

### Retroalimentación en vivo

Siempre visibles mientras se edita: **acotación de cada lado sobre el dibujo**, **superficie y perímetro** actualizándose con el arrastre, y **diferencia respecto a la superficie catastral** en vivo si hay parcela oficial cargada. Todas las métricas por **helpers euclídeos propios** (regla de oro 6), nunca `turf.distance`/`turf.length`.

## Notas

- El snap escribe al mismo `store` que la tabla y el mapa (F03); todo son vistas del mismo estado.
- Tolerancias operativas en `config/operativos.json` (snap 20 cm), no `umbrales.json`.
- `edit/dibujo.js` (dibujar recinto desde cero) se estrena aquí en su base y se completa en F12 para edificio.

## Criterios de aceptación

1. Arrastrar/insertar/eliminar y teclear coordenada modifican el modelo y se reflejan en mapa y tabla a la vez.
2. Snap engancha al vértice/lindero más cercano dentro de τ y se desactiva con la tecla modificadora.
3. Offset de un lado recalcula los vértices contiguos por intersección; en ángulo agudo aplica el fallback sin explotar.
4. Superficie/perímetro/Δcatastral se actualizan durante el arrastre.
5. Undo/redo revierten operaciones completas, no fotogramas del arrastre.

## Referencias

Plan §6, §18 Fase 6. Dossier §3.6 (snap, offset, proyección punto-segmento), §3.4 (Turf prohibido sobre UTM).
