# SPEC — Concreta GML

**Proyecto:** Concreta GML — herramienta web de generación y diagnóstico de GML para la Sede Electrónica del Catastro.
**Naturaleza:** especificación ejecutable, descompuesta en features del tamaño de una tarea de Plan Mode.
**Deriva de:** `PLAN_MODULO_GML.md` (spec v4, especificación cerrada) + `MEJORES_PRACTICAS_GML.md` (dossier de I+D verificado).
**Fecha:** 2026-07-24.

Este documento es el **maestro**. No contiene el detalle de cada fase; contiene lo transversal (decisiones, reglas de oro, correcciones al plan) y el **índice por prioridad** que apunta a cada `feature-N.md`. Cada feature es autocontenido y dimensionado para una única sesión de Plan Mode.

---

## Cómo usar este documento

1. Lee **§1 (decisiones)**, **§2 (reglas de oro)** y **§3 (overrides)**: es lo que gobierna *todo* el código. Una sola pantalla cada uno.
2. Ve al **§4 · Índice por prioridad**, elige el primer feature no hecho y abre solo su `feature-N.md`.
3. Cada feature declara sus **dependencias**: no empieces uno sin sus predecesores en verde.
4. Cuando el plan v4 y el dossier discrepen, **manda el dossier** (§3). Cada override está marcado en el feature con `🔻 OVERRIDE`.
5. Fuente de verdad última cuando algo del Catastro no esté claro: **un GML real descargado del WFS** (fixtures en `test/fixtures/gml/`), no la documentación ni el criterio propio.

---

## 1 · Decisiones capturadas (entrevista de arranque)

| Eje | Decisión | Consecuencia en la spec |
|---|---|---|
| **Motivación** | **Producto comercial** (competir con gmlweb.com). | El foso son las funciones que la competencia no tiene: diagnóstico de encaje, descripción literaria de linderos, memoria firmable. Se protegen como features propios (F07, F09) y no se recortan. |
| **Alcance** | **Toda la app** del plan v4 (parcela + edificio + visor de comprobación). | Se generan features para las 17 fases (§18 del plan). |
| **Edificio** | **Al final, baja prioridad.** | F11–F14 cierran el índice; parcela debe ser producto publicable antes de tocar edificio. |
| **Diferenciación** | **Las cuatro:** diagnóstico 3 bandas, linderos literarios, memoria firmable, importación DXF/CAD. | Ninguna es opcional; entran en F01 (DXF), F07 (diagnóstico), F09 (linderos + memoria). |
| **Innegociables** | **Frontend puro sin backend** · **GML que pase IVG/ICUC.** | Ningún feature puede introducir servidor. La fidelidad al Catastro se blinda con test de ida y vuelta contra fixtures reales (F04, F13). |
| **Stack** | **Fijas solo las reglas de oro** (§2); el resto de librerías, abierto a Plan Mode. | Los features fijan el *qué*; Plan Mode elige el *cómo* salvo donde una regla de oro lo determine. |
| **Territorio** | **Península + Baleares ahora** (husos 29/30/31, EPSG 25829/30/31). **Canarias diferido** (32628). | F00 (huso) implementa 29/30/31; deja el gancho para 32628 marcado `DIFERIDO`. |
| **Prioridad** | **Orden del plan:** paridad en parcela primero, diagnóstico tras WFS+edición. | El índice §4 respeta el orden de fases; el corte de paridad va tras F04. |
| **Design system** | **Referencia, no obligación** (`prototipo/_ds/concreta-design-system-…`). | Los features de UI lo citan como guía de partida; las decisiones visuales finas quedan a Plan Mode. |
| **Correcciones** | **El dossier verificado manda; cada override se marca.** | §3 consolida los overrides; cada feature afectado los repite con `🔻 OVERRIDE`. |

### Fuera de alcance (no implementar "por si acaso")

Móvil/responsive · multiusuario/cuentas/cloud · País Vasco y Navarra (catastros forales: "no encontrado" es estado válido, no fallo) · y todo lo del plan §2.3: multiparcela, unión/agregación, conversión v3→v4, división/segregación, entrada por distancia y rumbo, procedencia por vértice, comparador de vuelos, backend.

---

## 2 · Reglas de oro (gobiernan todo el código)

Combinan §23 del plan y §0.3 del dossier. Todo feature las respeta sin repetirlas.

1. **Ningún error silencioso.** Entidad DXF descartada, arco discretizado, cierre compensado, coordenada redondeada, parte sin geometría, huso deducido: el usuario se entera. *Un GML que valida estando mal es peor que uno que falla.*
2. **La geometría oficial se conserva intacta** (`geometriaOficial`/`construccionOficial`). Es el término de comparación del diagnóstico.
3. **Modelo en UTM, siempre.** Ninguna función de `model/`/`geometry/` acepta ni devuelve lat/lon. Geográficas solo para pintar.
4. **Modelo = POJO plano.** Coords como `[x,y]`, sin métodos ni instancias de clase: `structuredClone` (undo/redo) no clona funciones ni prototipos. Anillo guardado **sin cerrar** (el vértice de cierre se añade solo al serializar).
5. **Superficie por fórmula del polígono (shoelace) sobre UTM, nunca `turf.area`** (es geodésica esférica en grados). **Trasladar a origen local** (restar el primer vértice) antes del shoelace para evitar cancelación float64 con Norte ≈ 4·10⁶.
6. **De Turf, solo lo topológico.** Seguras sobre UTM: `booleanPointInPolygon`, `booleanContains/Within/Intersects`, `kinks`, `intersect/union/difference`, `booleanClockwise`, `pointOnFeature`. **Prohibidas:** `area`, `distance`, `length`, `buffer`, `along`, `midpoint`, `bearing`, `nearestPointOnLine` → helpers euclídeos propios (`hypot`, proyección punto-segmento). Importar por subpaquete (`@turf/kinks`), no el meta-paquete.
7. **Sin backend, sin proj4js, sin html2canvas.** Llamadas externas aisladas en `src/services/` (una por proveedor, `CATASTRO_BASE` única para contingencia CORS). UTM por serie de Krüger/Karney propia. Plano del informe compuesto a mano en canvas.
8. **Verdad numérica externa.** El GML real del WFS manda sobre la documentación y sobre el criterio. Test de ida y vuelta contra fixtures reales.
9. **La aplicación mide; el colegiado interpreta y firma.** Ninguna cifra lleva juicio de valor: sin semáforos, sin "válido/no válido", sin `config/umbrales.json`. El margen ±0,5 m urbana / ±2 m rústica solo como **capa informativa** ("margen de identidad del Catastro"). Única excepción: **invasión a colindante** (hecho topológico binario, admite ámbar).
10. **`gml:id` es XML ID: empieza por letra.** Prefijar siempre (`ES.LOCAL.CP.<ref>`, `Surface_…`, `MultiSurface_…`, `ReferencePoint_…`). Nunca la RC desnuda (empieza por dígito).
11. **Precisión del modelo vs de salida.** Modelo en float64 completo, sin redondear entre ediciones; redondear a 2 decimales solo al serializar, y calcular la superficie publicada **desde las coordenadas ya redondeadas** para que cuadre con el GML.

---

## 3 · Overrides — el dossier corrige al plan v4

Donde el plan y el dossier discrepan, **manda el dossier** (capa de verificación inversa). Cada feature afectado repite el override en su sitio con `🔻`.

| # | Punto | Plan v4 dice | ✅ Verdad verificada (dossier) | Tier | Feature |
|---|---|---|---|---|---|
| O1 | **Orientación de anillos** | §8: "exterior antihorario, huecos horario ⚠️ verifica" | **Exterior HORARIO, huecos antihorario** (inverso a OGC/GeoJSON). Área firmada del GML real = −1536 = `areaValue`. | S1 (VERIFICADO) | F00, F04 |
| O2 | **srsName parcela** | §9: `urn:ogc:def:crs:EPSG::25830` (URN) | Parcela 4.0 = **URI OGC** `http://www.opengis.net/def/crs/EPSG/0/25830`. La URN es del 3.0 (rechazado). **Edificio sí usa URN.** | S2/S3 | F04, F13 |
| O3 | **Raíz parcela** | §9: `FeatureCollection` genérico | **wfs 2.0** `FeatureCollection` + `<member>` (ns `http://www.opengis.net/wfs/2.0`). **NO** `gml:FeatureCollection`/`gml:featureMember` (eso es 3.0 → rechazo). | S2, C2 | F04 |
| O4 | **inspireId parcela** | (no detallado) | `Identifier` en `xmlns="http://inspire.ec.europa.eu/schemas/base/3.3"` **sin prefijo `base:`**. El `base:` (3.2) es del 3.0. | DOCUMENTADO | F04 |
| O5 | **Orden XSD de `cp:CadastralParcel`** | (no fijado) | `areaValue → beginLifespanVersion → endLifespanVersion → geometry → inspireId → label → nationalCadastralReference → referencePoint`. El validador lo exige. | OBSERVADO | F04 |
| O6 | **`areaValue`** | §9: "2 decimales en superficie" | **Entero** (`uom="m2"`), informativo (fixture 1535.87 → 1536). Coordenadas sí a 2 decimales. | S1/B1 | F00, F04 |
| O7 | **CORS del WMS/servicios** | §11.3, §22: "⚠️ pendiente de verificar" | **RESUELTO: SÍ.** `ACAO:*` + HTTPS en WFS/WMS/OVC/IGN; tesela WMS con `crossOrigin='anonymous'` → canvas **CLEAN**. La Receta A es viable. | S5 (VERIFICADO) | F03, F05, F09 |
| O8 | **Umbral de bloqueo** | (HALLAZGOS: "3.600/h → 4 h") | **NO existe en fuente oficial** (NO_RESPALDADO). Lo oficial: denegación **~10 días** + detección de rotación IP/UA. **No citar la cifra.** No rotar UA. | C-1 | F05 |
| O9 | **Licencia Leaflet** | §21: "Leaflet MIT" | **Leaflet = BSD-2-Clause.** (Turf/jsPDF/html2canvas/proj4js sí MIT.) Corregir créditos. | S7 | F03, F16 |
| O10 | **Edificio: raíz y srsName** | §16.2 (genérico) | Raíz **`gml:FeatureCollection` + `gml:featureMember`**, namespaces `inspire.jrc.ec.europa.eu` *draft* + base 3.2, **srsName URN**. Asimetría deliberada con parcela. | S3 | F13 |
| O11 | **BuildingPart** | §4.2 (modelo) | Confirmado: **una `BuildingPart` por volumen de altura homogénea**, cada una con huella propia + plantas sobre/bajo rasante independientes (fixture real: 13 partes). Valida el modelo del plan. | S4 (VERIFICADO) | F12, F13 |
| O12 | **DXF mínimo** | §13.2 (genérico) | `LWPOLYLINE` no es válido en R12; mínimo real **AC1014 (R14)**, en la práctica **AC1015 (R2000)**. | B2 | F01, F10 |
| O13 | **Canarias** | (no cubierto) | EPSG **32628** (WGS84/UTM 28N) único para todo el archipiélago; forzar huso 28. **DIFERIDO** por decisión de alcance. | S11/C5 | F00 (gancho) |

**Tolerancias oficiales de identidad** (dossier S6/C8, BOE-A-2020-12111), solo como capa informativa nunca como veredicto: perímetro **±0,50 m urbana / ±2,00 m rústica**, superficie **≤5%**, precisión de captura **<25 cm (85% ≤20 cm)**.

---

## 4 · Índice por prioridad

Orden de construcción (= orden de fases del plan §18, decisión de la entrevista). Cada fila apunta a su `feature-N.md`. **Riesgo** señala dónde se concentra la incertidumbre técnica (atención extra de Plan Mode). No empieces un feature sin sus **dependencias** en verde.

### Bloque A — Núcleo de parcela (producto publicable pronto)

| Prio | Feature | Objetivo (una línea) | Depende de | Riesgo |
|---|---|---|---|---|
| P0 | [F00 · Cimientos](feature-00-cimientos.md) | Modelo de datos, motor UTM, área/orientación, undo/redo. Sin UI. | — | **Alto** (motor UTM, precisión) |
| P1 | [F01 · Entrada parcela](feature-01-entrada-parcela.md) | Parsers LIST/TXT/DXF (bulge) + detecciones defensivas. | F00 | Medio (bulge DXF) |
| P2 | [F02 · Validación parcela](feature-02-validacion-parcela.md) | Reglas geométricas en vivo; errores vs avisos con vértices señalados. | F00 | Bajo |
| P3 | [F03 · Visor](feature-03-visor.md) | Leaflet, capas base + WMS por encuadre, tabla sincronizada. | F00 | Medio (WMS no teselado) |
| P4 | [F04 · GML parcela](feature-04-gml-parcela.md) | Serializador CP 4.0 + test de ida y vuelta contra fixtures. | F00, F01 | **Alto** (fidelidad IVG) |

> 👉 **Corte de paridad funcional con la competencia en parcela.** A partir de aquí, el diferencial.

### Bloque B — Diferencial de parcela (el foso comercial)

| Prio | Feature | Objetivo | Depende de | Riesgo |
|---|---|---|---|---|
| P5 | [F05 · Catastro en vivo](feature-05-catastro-vivo.md) | Cliente WFS, carga por RC editable, geocodificación, deducción de RC, colindantes, caché. | F00, F03 | Medio (anti-bloqueo) |
| P6 | [F06 · Edición parcela](feature-06-edicion-parcela.md) | Arrastrar/insertar/eliminar, edición numérica, offset de lindero, snap, acotaciones en vivo. | F03, F05 | Medio (offset/snap) |
| P7 | [F07 · Diagnóstico parcela](feature-07-diagnostico-parcela.md) | Métricas de encaje, comparación a tres bandas, representación. **Sin umbrales.** | F05, F06 | Medio |
| P8 | [F08 · Comprobar GML existente](feature-08-comprobar-gml.md) | Recorrido corto: cargar GML ajeno → validar fichero → diagnóstico. | F04, F07 | Bajo |
| P9 | [F09 · Informe parcela](feature-09-informe-parcela.md) | Canvas propio a 300 ppp (Receta A), jsPDF, descripción literaria, firma. | F07 | **Alto** (plano 300 ppp) |
| P10 | [F10 · Persistencia y exportación](feature-10-persistencia-export.md) | IndexedDB (expedientes), autoguardado, exportación DXF. | F04 | Bajo |

### Bloque C — Edificio (baja prioridad, capítulo posterior)

| Prio | Feature | Objetivo | Depende de | Riesgo |
|---|---|---|---|---|
| P11 | [F11 · Edificio: entrada y modelo](feature-11-edificio-entrada.md) | Selector simplificado/completo, vías de entrada, una polilínea = una parte, atributos. | F10 | Medio |
| P12 | [F12 · Edificio: partes y plantas](feature-12-edificio-partes.md) | Lista de partes, plantas por parte, dibujar recinto, envolvente derivada. | F11 | Medio |
| P13 | [F13 · Edificio: validación y GML](feature-13-edificio-gml.md) | Reglas propias, serializador BU (URN, draft ns), fixtures `wfsBU.aspx`. | F12 | **Alto** (fidelidad ICUC) |
| P14 | [F14 · Edificio: contraste e informe](feature-14-edificio-contraste-informe.md) | Contraste opcional + pantalla "sin construcción registrada", informe con ficha de partes. | F13, F09 | Bajo |

### Bloque D — Cierre

| Prio | Feature | Objetivo | Depende de | Riesgo |
|---|---|---|---|---|
| P15 | [F15 · Diccionario de errores](feature-15-diccionario-errores.md) | `errores-ivg.json` con estructura desde el día 1; se llena con el uso. | F04 | Bajo |
| P16 | [F16 · Integración Concreta](feature-16-integracion.md) | Sesión compartida, entrada desde el flujo principal, créditos/licencias. | F09, F10 | Bajo |

---

## 5 · Mapa feature → ficheros (§19 del plan)

| Feature | Ficheros principales |
|---|---|
| F00 | `model/parcela.js`, `model/edificio.js`, `geo/utm.js`, `geo/area.js`, `geo/huso.js`, `geo/cierre.js`, `edit/historial.js` |
| F01 | `parsers/list.js`, `parsers/txt.js`, `parsers/dxf.js`, `parsers/_comun.js` (contrato `ResultadoParse`/`Deteccion` + tokenizador), `geo/arco.js` (discretización bulge + ΔS), `parsers/importar.js` (orquestador + detecciones defensivas), `geo/huso.js`·`geo/cierre.js` (detectores de F00) |
| F02 | `validation/parcela.js` |
| F03 | `viewer/`, `services/ign.js` |
| F04 | `gml/serialize-cp.js`, `gml/parse.js`, `test/fixtures/gml/` |
| F05 | `services/catastro.js`, `storage/cache-catastro.js` |
| F06 | `edit/snap.js`, `edit/offset.js`, `edit/dibujo.js` (base) |
| F07 | `diagnostico/parcela.js` |
| F08 | `gml/parse.js` (entrada ajena), recorrido corto en `viewer/` |
| F09 | `report/canvas.js`, `report/literal.js`, `report/pdf-parcela.js` |
| F10 | `storage/` (expedientes), `export/dxf.js` |
| F11 | `model/edificio.js`, entrada edificio |
| F12 | `edit/dibujo.js`, envolvente derivada en `model/edificio.js` |
| F13 | `validation/edificio.js`, `gml/serialize-bu.js` |
| F14 | `diagnostico/edificio.js`, `report/pdf-edificio.js` |
| F15 | `config/errores-ivg.json` |
| F16 | integración global, página de créditos |

---

## 6 · Definición de "hecho" (común a todo feature)

Un feature está **hecho** cuando:

1. Cumple su especificación y respeta las **reglas de oro** (§2) y los **overrides** aplicables (§3).
2. Sus **criterios de aceptación** (sección propia del feature) pasan.
3. **Tests en verde** — sin ellos no se pasa al siguiente feature (regla del plan §18). Geometría/serializadores en proyecto Vitest `node`; canvas/mapa en proyecto `dom`.
4. Ningún error silencioso nuevo; ninguna cifra con juicio de valor incorporado.
5. No introduce backend, proj4js ni html2canvas.

---

## 7 · Verificaciones que siguen pendientes de certificado (no bloquean)

Del dossier §0.7 (Tier D, ya mitigado): (1) si el IVG rechaza o autocorrige un exterior antihorario → emitir **siempre horario**; (2) si la subida acepta srsName URI y URN → emitir la **forma canónica de cada tipo** (parcela=URI, edificio=URN). Ambas requieren subir un GML a la Sede con certificado/Cl@ve; se cierran cuando el usuario quiera, no antes de codificar.
