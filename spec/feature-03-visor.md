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

El mapa es el contenido; la interfaz, el instrumento. El cromo en neutros; la saturación se reserva para la geometría del usuario. Densidad tipo base ~13 px.

**Geometría del usuario en amarillo intenso `#FFD600`** sobre el mapa. Es el único tono libre: no puede ser azul (choca con la hidrografía catastral), ni rojo/magenta (le resta contraste a las líneas de la cartografía catastral, que son sobre las que se calca), ni verde (el relleno se camufla con la vegetación de la ortofoto). El amarillo es además el que más contrasta sobre las sombras.

> **Cambio de spec, decidido en la Fase 5 (2026-07-27)** tras comparar cuatro candidatos sobre la ortofoto real: la versión anterior fijaba violeta `#7C3AED` y **desaparecía sobre las sombras oscuras** (arbolado, cubiertas en sombra), justo donde más falta hace ver el lindero.

El amarillo es para el mapa, **sobre imagen aérea**. Sobre el blanco del panel es ilegible (~1,4:1), así que el nº de vértice de la tabla usa un ámbar oscuro de la misma familia (`#A16207`, ~5,0:1). Son dos valores a propósito: unificarlos obliga a elegir entre un lindero que no se ve y una columna que no se lee.

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

## ⛔ Un defecto de ESTA fase que destapó la firma humana de F08 (2026-08-02)

**El mapa no reencuadraba nunca.** El encuadre era el **último paso del MONTAJE** de
`crearVisor` —y esa decisión sigue siendo correcta: así la capa WMS del Catastro pide
UNA sola imagen y del encuadre bueno, que es el criterio 2— pero **no había forma de
repetirlo**, y ni esta spec ni las de F05 y F08 se preguntaron qué pasa **después**.
Consecuencia: se traía una parcela de Sevilla por referencia catastral, o se soltaba
un GML de Cádiz, y **el mapa seguía mirando la parcela de demostración**. De rebote,
«traer geometría del Catastro» **parecía no tener feedback visual**, cuando el dibujo
estaba perfectamente hecho — a cientos de kilómetros de la vista.

Ni la suite ni ningún guion de humo lo veían, y el motivo es instructivo: **todas las
pruebas del visor traen su geometría a mano y la app arranca ya encuadrada sobre
ella**, así que la única pregunta que importaba —«¿y cuando entra OTRA?»— no se hacía
en ninguna parte.

**El arreglo es el paso 7 de `viewer/index.js`**: una suscripción al store que
reencuadra **cuando entra una parcela con OTRA identidad, y solo entonces**. La
identidad es **`refcat ?? idLocal`** y nunca la del objeto —`edit/` reconstruye el
POJO en cada operación, así que comparar referencias diría «otra parcela» en cada
frame de un arrastre—, y **jamás se reencuadra al editar**: un mapa que se recentra
mientras se arrastra un vértice le escapa el vértice al puntero. Se expone además
`visor.encuadrar()` para el gesto explícito. Una parcela **anónima** (sin refcat ni
idLocal) no mueve la vista y **se avisa una vez**.

**Esta spec no se reescribe por ello**: sus cinco criterios siguen intactos y
medidos. Lo que le faltaba está contado con su medida en
[`feature-08-comprobar-gml.md`](feature-08-comprobar-gml.md) **M20**, y medido en
navegador en `scripts/smoke-navegador/GUION.md` §16 (con otra parcela la vista viaja
414,74 km; editando, un vértice que no se ha tocado se queda en el mismo píxel).

## Referencias

Plan §12, §18 Fase 3, §21. Dossier §4.3 (Leaflet), §2.1 (endpoints), §0.6 (CORS verificado), §5.5 (atribución/licencias).
