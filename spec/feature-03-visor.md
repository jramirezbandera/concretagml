# F03 · Visor y capas

**Fase:** 3 · **Prioridad:** P3 · **Riesgo:** Medio (WMS no teselado) · **Depende de:** F00 · **Habilita:** F05, F06.
**Ficheros:** `viewer/`, `services/ign.js`.

## Objetivo

El mapa Leaflet con cartografía de fondo y la **tabla de vértices sincronizada** con el dibujo. Común a todos los flujos (parcela y edificio).

## Alcance

### Capas

- **Base:** Catastro · Ortofoto PNOA (IGN) · Topográfico IGN · OpenStreetMap · Blanco.
- **Superpuesta:** cartografía catastral en transparencia con opacidad regulable.
- Todas con **`crossOrigin: 'anonymous'`**.
- IGN teselado (WMTS, admite mosaico): `pnoa-ma`, `ign-base`, `mapa-raster` con `GoogleMapsCompatible`/EPSG:3857. Aislar en `services/ign.js`.

### WMS del Catastro — por encuadre, NO teselado

`https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx`. Capas: `catastro`, `constru`, `masa`, `subparce`, `textos`, `limites`.
- **Una imagen por encuadre**, no teselas (penalizan el mosaico; es el mayor riesgo de bloqueo del proyecto). En `moveend/zoomend` recalcular `getBounds()` → `setUrl(getMapUrl(bbox,size))`. Mantener la imagen previa hasta cargar la nueva.

### Interacción

- **Panes** con zIndex creciente (`parcelaOficial` < `parcelaEditada` < `vertices`): los vértices siempre encima, la editada sobre la oficial.
- **Zoom sin tope artificial:** `zoomSnap: 0` + `maxZoom > maxNativeZoom` (para calcar sobre ortofoto aunque pixele).
- **Tabla ↔ mapa bidireccional:** un `L.Marker draggable` por vértice; `drag`→UTM→`store.set`→re-render polígono + fila. Ambos son **vistas del mismo estado** (sin feedback loop). La edición de operaciones (arrastrar/offset/snap) llega en F06; aquí, el render y la sincronización básica.
- **Escala en pantalla: solo barra gráfica** (`L.control.scale`, metric). La escala numérica pertenece al PDF.

### Color (design system como referencia, no obligación)

El mapa es el contenido; la interfaz, el instrumento. El cromo en neutros; la saturación se reserva para la geometría del usuario. **Geometría del usuario en violeta `#7C3AED`** (el azul colisiona con la hidrografía catastral). Densidad tipo base ~13 px.

## 🔻 OVERRIDE (dossier)

- **O7 — CORS RESUELTO:** el WMS del Catastro y los servicios IGN **sí** emiten `ACAO:*` + HTTPS; la tesela con `crossOrigin='anonymous'` no contamina el canvas. Ya no es una incógnita: construir con `crossOrigin` desde el principio. *(dossier S5, VERIFICADO).*
- **O9 — Leaflet = BSD-2-Clause** (no MIT). Anotarlo para la página de créditos (F16).

## Atribución obligatoria (legal)

PNOA: *"PNOA cedido por © Instituto Geográfico Nacional de España"*; base/MTN: *"© Instituto Geográfico Nacional de España"*; cartografía catastral: *"© Dirección General del Catastro"*; OSM: *"© OpenStreetMap contributors"* (ODbL, con enlace).

## Criterios de aceptación

1. Las cinco capas base conmutan; la superpuesta regula opacidad.
2. El WMS del Catastro se pide **una vez por encuadre**, nunca en mosaico (verificable en el nº de peticiones al mover el mapa).
3. Arrastrar un marcador actualiza la fila de la tabla y viceversa, sin bucle.
4. Todas las capas cargan con `crossOrigin='anonymous'`.
5. La atribución aparece en el visor.

## Referencias

Plan §12, §18 Fase 3, §21. Dossier §4.3 (Leaflet), §2.1 (endpoints), §0.6 (CORS verificado), §5.5 (atribución/licencias).
