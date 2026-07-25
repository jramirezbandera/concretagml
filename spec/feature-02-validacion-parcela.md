# F02 · Validación geométrica (parcela)

**Fase:** 2 · **Prioridad:** P2 · **Riesgo:** Bajo · **Depende de:** F00 · **Habilita:** F04 (bloquea generación con errores).
**Ficheros:** `validation/parcela.js`.

## Objetivo

Validación geométrica en vivo durante la edición que **bloquea la generación** si hay errores. Corrige el defecto del validador oficial: mensajes que no dicen *dónde* está el problema.

## Alcance

Cada regla devuelve `{ nivel, mensaje, verticesAfectados[] }` y la interfaz resalta los vértices implicados. **Errores y avisos son categorías distintas y no se cuentan juntas** — nunca "2 avisos" cuando uno es bloqueante.

### Errores (bloquean)

| Regla | Comprobación |
|---|---|
| Vértices insuficientes | < 3 distintos |
| Vértices duplicados | consecutivos a < 1 mm |
| Autointersección | `turf.kinks()` |
| Hueco fuera del exterior | `turf.booleanContains()` |
| Huecos solapados | `turf.intersect()` entre pares |
| Superficie nula | área ≈ 0 |
| Coordenadas fuera de rango | fuera del huso |

### Avisos (no bloquean)

| Regla | Comprobación |
|---|---|
| Casi colineales | ángulo > 179,9° |
| Segmento muy corto | < 5 cm |
| Superficie muy pequeña | < 1 m² |
| Muchos vértices | > 500 |

Cada error ofrece su corrección **con el verbo de lo que hace**: "Eliminar vértice duplicado", no "Corregir".

### Orientación de anillos

Se normaliza antes de serializar (en F04) con el signo del área.

## 🔻 OVERRIDE (dossier)

- **O1 — Orientación:** el plan §8 dice "exterior antihorario, huecos horario". **Es al revés:** exterior **HORARIO** (`A_signed<0`), huecos antihorario. La validación no falla por orientación (se normaliza en F04), pero cualquier comprobación o mensaje sobre orientación debe usar la convención correcta. *(dossier S1/C1, tier S).*

## Notas

- Solo funciones **topológicas** de Turf (regla de oro 6). Las métricas de longitud/distancia usan helpers euclídeos propios.
- Las tolerancias operativas (1 mm duplicados, 5 cm segmento) viven en `config/operativos.json` — son decisiones de ingeniería, **no** `config/umbrales.json` (que está prohibido, regla de oro 9).

## Criterios de aceptación

1. Cada regla dispara sobre su caso y devuelve los `verticesAfectados` correctos (tests con polígonos construidos).
2. Un polígono con error bloqueante impide la generación de GML; uno con solo avisos, no.
3. El recuento separa errores y avisos.

## Referencias

Plan §8, §18 Fase 2, §23.1. Dossier §1.5 (errores que producen "valida pero mal"), §3.4 (Turf sobre UTM).
