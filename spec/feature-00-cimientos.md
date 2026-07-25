# F00 · Cimientos

**Fase:** 0 · **Prioridad:** P0 · **Riesgo:** Alto (motor UTM, precisión numérica) · **Depende de:** — · **Habilita:** todo.
**Ficheros:** `model/parcela.js`, `model/edificio.js`, `geo/utm.js`, `geo/area.js`, `geo/huso.js`, `geo/cierre.js`, `edit/historial.js`.

## Objetivo

El motor numérico y el modelo de datos, **sin UI**, con tests contra valores conocidos. Es la base sobre la que se apoya todo; si falla la precisión aquí, todo lo demás produce GML válidos y equivocados.

## Alcance

- **Modelo de datos** (ambas ramas: parcela §4.1 y edificio §4.2 del plan) como POJO plano. Ver reglas de oro 3, 4, 10.
- **`geo/utm.js`** — proyección directa e inversa por serie de Krüger 6.º orden (método Karney), portada de `geodesy/utm.js` de Chris Veness. **Copiar verbatim los coeficientes α/β** (los de orden alto son propensos a erratas). Elipsoide GRS80: `a=6378137`, `f=1/298.257222101`, `k0=0.9996`, `FE=500000`, `FN=0`. Exponer `forward/inverse/convergence/scale`. Sin proj4js.
- **`geo/area.js`** — shoelace sobre anillo abierto con **traslación a origen local**; `S = |A_ext| − Σ|A_hueco|`; `orientacion(ring) = sign(A_signed)`. Nunca `turf.area`.
- **`geo/huso.js`** — meridianos centrales `λ0=(z−1)·6−180+3` (29:−9°, 30:−3°, 31:+3°); bounding boxes de Península+Baleares; `detectarHuso(centroide)` por desproyección; mapeo región→srsName.
- **`geo/cierre.js`** — compensación de cierre de polígonos abiertos, devolviendo el error de cierre.
- **`edit/historial.js`** — undo/redo con `structuredClone` del estado completo; commit por operación acabada (coalescing); pila acotada (50–100).

## 🔻 OVERRIDE (dossier)

- **O1 — Orientación:** el plan §8 dirá "exterior antihorario". **Falso.** El Catastro usa **exterior HORARIO, huecos antihorario** (`A_signed < 0` para el exterior). Verificado: área firmada del exterior de una parcela real = −1536 = `areaValue`. `geo/area.js` debe exponer la orientación como signo; la normalización al serializar vive en F04, pero la convención se fija aquí. *(dossier S1/C1, tier S).*
- **O6 — areaValue entero:** la superficie declarada del Catastro es entera; el modelo guarda float64 completo y el redondeo es de salida (regla de oro 11).
- **O13 — Canarias DIFERIDO:** implementar husos **29/30/31** (EPSG 25829/30/31). Dejar en `geo/huso.js` un gancho comentado `// DIFERIDO: Canarias → forzar huso 28, srsName EPSG 0/32628` sin implementarlo.

## Detalles de precisión (críticos)

- **Trasladar a origen local antes del shoelace** (restar el primer vértice): con Norte ≈ 4·10⁶, evita cancelación catastrófica de float64. Es el punto de precisión más importante del área.
- **Modelo en float64 completo**, sin redondear entre ediciones. Anillos **sin cerrar** (el vértice de cierre se añade solo al serializar).
- El **easting no identifica el huso** (siempre ~500.000): desproyectar el centroide con cada candidato `[30,29,31]` y comprobar `lon ∈ [CM(z)±3°]` y `(lon,lat) ∈ bbox España`.
- **X/Y invertidas:** si `abs(c0) > 1e6 && abs(c1) < 1e6` → swap. **Geográficas pegadas:** si `abs(c0) < 1000 && abs(c1) < 1000` → son grados. (La UI de estas detecciones vive en F01; los detectores puros, aquí.)

## Criterios de aceptación

1. `geo/utm.js`: round-trip `inverse(forward(p)) ≈ p` a `<1e-9°` y `forward(inverse(q)) ≈ q` a `<1e-6 m` sobre malla de husos 29/30/31. Puntos de control de la **Calculadora Geodésica del IGN** como fixtures (generados en test de fábrica, no en runtime). `k=0.9996` en el CM.
2. `geo/area.js`: área de polígonos conocidos con `toBeCloseTo`; el signo distingue horario/antihorario; test de regresión: el exterior de la parcela fixture da `A_signed < 0` y `|A_signed|` redondeada = `areaValue`.
3. `geo/huso.js`: detecta el huso correcto de coordenadas de prueba de cada huso; detecta y corrige X/Y invertidas y geográficas pegadas.
4. `edit/historial.js`: `undo`/`redo` restauran estados; `structuredClone` no rompe (modelo es POJO plano, sin métodos).
5. Ninguna función de `model/`/`geometry/` acepta ni devuelve lat/lon.

## Referencias

Plan §3.1–§3.4, §4 (modelo), §18 Fase 0, §23. Dossier §3.1–§3.3 (motor), §3.2 (saneamiento), §0.3 (reglas de oro), §1.1 (áreas verificadas). Fuente UTM: `github.com/chrisveness/geodesy/blob/master/utm.js`.
