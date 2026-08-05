# F01 · Entrada de datos (parcela)

**Fase:** 1 · **Prioridad:** P1 · **Riesgo:** Medio (arcos DXF) · **Depende de:** F00 · **Habilita:** F02, F04.
**Ficheros:** `parsers/list.js`, `parsers/txt.js`, `parsers/dxf.js`, integración con `geo/huso.js`.

## Objetivo

Meter geometría al modelo desde las tres vías de fichero del técnico, más las **detecciones defensivas** que separan una herramienta seria de una que produce GML válidos y equivocados.

## Alcance

### Parsers

- **`parsers/list.js`** — pegado de LIST de AutoCAD (vía principal). Parser tolerante: busca pares de decimales, ignora cabeceras y etiquetas, autodetecta el separador decimal, descarta la Z. La palabra `separador` en línea propia divide polígonos.
- **`parsers/txt.js`** — dos columnas, separador autodetectado (espacio, tab, coma, punto y coma). Misma convención de `separador`.
- **`parsers/dxf.js`** — parser propio, **sin librería**. Entidades: `LWPOLYLINE` (10/20 vértices, 70 bit de cerrado, **42 bulge**) y `POLYLINE`/`VERTEX`/`SEQEND`. Coordenadas en UTM tal cual (georreferenciadas).

### Discretización de arcos DXF (bulge, código 42) — obligatorio

El GML no admite arcos. Ignorar el 42 convierte cada arco en su cuerda (el comando CONTORNO que todos usan genera arcos). Discretizar:
- `b = tan(Δθ/4)` → `Δθ = 4·atan(b)` (signo `b>0` = CCW); `c=|P2−P1|`; `R = c(1+b²)/(4|b|)`; `M=(P1+P2)/2`; `C = M + sign(b)·apo·n̂` con `apo=R·cos(Δθ/2)`, `n̂` perpendicular unitaria.
- **Subdivisión por flecha ≤ 1 cm** (parametrizable): `δ_max = 2·acos(1−ε/R)` con ε=0.01; `n_seg = ceil(|Δθ|/δ_max)`. Por sagitta, no por nº fijo de tramos.
- **Reportar Δsuperficie:** `S_arco = ½R²(Δθ−sinΔθ)`, `S_discreto = n_seg·½R²(δ−sinδ)`, `ΔS = S_arco − S_discreto`. Informar cuántos arcos, en cuántos tramos y cuánto varió la superficie (regla de oro 1).

No soportar bloques, INSERT, xrefs ni splines. Si aparecen: decirlo e indicar qué hacer (dejar solo la polilínea en capa 0 y ejecutar LIMPIA).

### Detecciones defensivas (§5.5) — la UI de lo que F00 dejó como detectores puros

- **Huso:** nunca obligar a elegirlo en un desplegable. Desproyectar el centroide, mostrar **dónde ha caído la parcela** antes de continuar; el desplegable queda como anulación.
- **X/Y invertidas:** detectar y ofrecer intercambiar.
- **Coordenadas geográficas pegadas:** detectar y ofrecer proyectar.
- **Cierre que no cierra:** ni fallar ni cerrar en silencio; mostrar el error de cierre y ofrecer compensarlo (usa `geo/cierre.js`).

## 🔻 OVERRIDE (dossier)

- **O12 — DXF:** al *exportar* (F10) `LWPOLYLINE` exige ≥ AC1014/R14 (en la práctica AC1015/R2000). No afecta a la lectura, pero fija el mínimo del round-trip. *(dossier B2).*
  - ⛔ **CADUCADO el 2026-08-05, y por un fichero que colgó un CAD.** El razonamiento del override es correcto —`LWPOLYLINE` sí exige R14+— pero lleva a la conclusión contraria: **declarar `AC1015` obliga a emitir TODO el esqueleto de R2000** (`CLASSES`, `BLOCK_RECORD`, `BLOCKS` con `*Model_Space`, `OBJECTS`), y sin él **ZWCAD 2023 se queda en blanco y bloqueado**. La exportación es ahora **R12 (`AC1009`) con `POLYLINE`/`VERTEX`/`SEQEND`**, que es la forma en la que el propio Catastro entrega sus DXF. Medido y verificado en el CAD del usuario; ver `GUION.md` §24 y la cabecera de `export/dxf.js`. **La LECTURA no cambia**: `parsers/dxf.js` sigue leyendo las dos vías.

## Fuera de alcance

Entrada por distancia y rumbo; procedencia por vértice; splines/bloques DXF.

## Criterios de aceptación

1. LIST/TXT reales parsean a modelo con el nº correcto de vértices y polígonos (fixtures de DXF/LIST reales en `test/fixtures/`).
2. Un `LWPOLYLINE` con bulge conocido discretiza con flecha ≤ 1 cm y el `ΔS` reportado coincide con el cálculo analítico (`toBeCloseTo`).
3. Coordenadas invertidas, geográficas y polígono abierto disparan su detección; ninguna se "arregla" en silencio.
4. Una entidad no soportada (INSERT, spline) produce aviso claro, no un fallo de programa.

## Referencias

Plan §5, §18 Fase 1, §23.1. Dossier §3.5 (bulge/arco), §3.2 (saneamiento). Bulge: `lee-mac.com/bulgeconversion.html`.
