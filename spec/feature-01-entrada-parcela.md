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
- **Reportar Δsuperficie:** `δ = |Δθ|/n_seg`, `ΔS = n_seg·½R²(δ−sinδ)` — el área entre la polilínea y el arco VERDADERO, que es lo que de verdad varía la superficie al discretizar. Informar cuántos arcos, en cuántos tramos y cuánto varió la superficie (regla de oro 1).
  - ⛔ **ENMENDADA el 2026-08-15, y la enmienda la trajo una medición (hallazgo G2 de la auditoría).** La fórmula anterior de esta spec era `ΔS = S_arco − S_discreto` con `S_arco = ½R²(Δθ−sinΔθ)`: restar el área discretizada al SEGMENTO CIRCULAR ENTERO mide el área entre la polilínea y la **cuerda** P1→P2 — casi todo el segmento, no el error de discretizar. Medido: para un semicírculo de R=5 m con ε=1 cm anunciaba ΔS=39,17 m² cuando la variación real de superficie es **0,103 m²**; la cifra correcta (`S_discreto = n_seg·½R²(δ−sinδ)`) se calculaba en `geo/arco.js` y se descartaba. `geo/arco.js#deltaS` devuelve desde hoy la variación real; el mensaje de `parsers/dxf.js` («variación de superficie ΔS=…») no cambia de forma, solo pasa a ser verdad.

No soportar bloques, INSERT, xrefs ni splines. Si aparecen: decirlo e indicar qué hacer (dejar solo la polilínea en capa 0 y ejecutar LIMPIA).

### Detecciones defensivas (§5.5) — la UI de lo que F00 dejó como detectores puros

- **Huso:** nunca obligar a elegirlo en un desplegable. Desproyectar el centroide, mostrar **dónde ha caído la parcela** antes de continuar; el desplegable queda como anulación.
  - ⛔ **ENMENDADA el 2026-08-09, y la enmienda la decidió una medición.** La regla da por hecho que la deducción acierta y que solo falta decir dónde ha caído. Es falso: llevados 42 municipios reales a su huso verdadero y devueltos por `geo/huso.js#detectarHuso` con los candidatos por defecto, **42 de 42 salían ambiguos y en 22 de 42 el prioritario era el huso EQUIVOCADO** — Galicia, Extremadura, Huelva y Cádiz (huso 29) y Cataluña y Baleares (huso 31) entraban TODAS como huso 30. Errar el huso no descoloca la parcela: la coloca a **cientos de kilómetros**, con la geometría intacta y sin un solo error. Desde hoy: **la ambigüedad REAL abre la pantalla de revisión**, con el prioritario ya marcado (un Enter en el caso normal). Sigue sin haber desplegable obligatorio cuando no hay duda — y hay bastante menos duda que antes, porque el mismo día `geo/huso.js` estrenó `BBOX_POR_HUSO`: los candidatos ya no se validan contra un rectángulo único que incluía medio Mediterráneo (42 → 36 ambiguos en el mismo barrido; una parcela de Málaga se ofrecía como «huso 31» cayendo frente a la costa argelina). Ver la cabecera de `app/dialogo-importacion.js`.
- **X/Y invertidas:** detectar y ofrecer intercambiar.
- **Coordenadas geográficas pegadas:** detectar y ofrecer proyectar.
- **Cierre que no cierra:** ni fallar ni cerrar en silencio; mostrar el error de cierre y ofrecer compensarlo (usa `geo/cierre.js`).
  - ⛔ **ENMENDADA el 2026-08-15, y la enmienda la trajo un fichero.** La regla da por hecho que un error de cierre pequeño es siempre algo que *preguntar*. En un DXF no lo es: la polilínea puede venir marcada como **CERRADA** (código de grupo 70, bit 0), y entonces el tramo del último vértice al primero es una **arista dibujada**, no un vértice de cierre repetido con una errata — para eso existe el flag, para no tener que repetir V0. Medido en `test/fixtures/parsers/cierre_flag70_arco.dxf`, un levantamiento real: cuatro lados rectos de 9 a 15 m, un arco de 17 tramos de 0,11 a 0,24 m y un tramo de cierre de **0,1118 m** que caía en la banda ambigua de 0,5 m. **AutoCAD enseñaba el contorno cerrado y la aplicación abría la pantalla preguntando por un error de cierre**: dos cosas ciertas por separado que juntas se leen como una contradicción (lección M28 de F11). Y la pregunta empujaba a la respuesta equivocada — «retirar el vértice de cierre» se habría comido el último vértice bueno del arco, y Bowditch habría repartido 11 cm por todo el perímetro. Desde hoy `parsers/dxf.js` devuelve `cerrados[]` junto a `anillos[]`/`capas[]` y `resolverCierre` tiene una **cuarta banda**: con el flag a `true` la geometría se deja intacta, la detección baja de AVISO a **INFO** con el error medido publicado igual, y **se deja de preguntar**. ⚠️ Lo que NO se toca: las otras tres bandas, LIST y TXT (que no tienen forma de declarar cierre, así que preguntan como siempre) y las dos lecturas, que se siguen ofreciendo como dato y se siguen aplicando si el llamante las pide — lo único que se retira es la pregunta. ⚠️ Y queda declarado que el flag no es una garantía: rematar una polilínea con la `C` de `PLINE` sobre un último punto clicado a ojo produce un misclosure real bajo un `70=1`, y por eso el arreglo no corrige nada por su cuenta. Ver la cabecera de `parsers/dxf.js` y `parsers/importar.js#resolverCierre`.

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
