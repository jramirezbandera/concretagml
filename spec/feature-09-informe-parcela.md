# F09 · Informe (parcela)

**Fase:** 9 · **Prioridad:** P9 · **Riesgo:** Alto (plano a 300 ppp) · **Depende de:** F07 · **Habilita:** F14, F16.
**Ficheros:** `report/canvas.js`, `report/literal.js`, `report/pdf-parcela.js`.

## Objetivo

La **memoria de encaje firmable**: el empaquetado de valor que sostiene la propuesta comercial. Plano compuesto a mano a 300 ppp, tabla a tres bandas, **descripción literaria del lindero** y **pie de firma colegiada**. Dos de los cuatro diferenciadores viven aquí (linderos + memoria firmable).

## Nombre (legal — §11.1)

**No** "Informe de validación gráfica" (VGA/IVG son procedimiento/documento oficiales del Catastro con CSV; un nombre casi homónimo hace creer al cliente que ya se presentó). Nombre correcto: **"Informe de contraste con el parcelario catastral"**.

## Contenido (§11.2)

1. Encabezado: municipio, paraje, polígono/parcela, RC, SRS, fecha, **identificador único de documento**.
2. **Plano de situación** a escala declarada, con norte, escala gráfica y **cartografía de fondo**.
3. Relación de vértices con coordenadas, superficie y perímetro.
4. Diagnóstico de encaje y comparación a tres bandas: las cifras, **sin valoración**.
5. **Descripción literaria del lindero** (`report/literal.js`).
6. **Pie de firma:** nombre, número de colegiado, colegio y contacto. *El punto 6 sostiene toda la propuesta de valor.* Neutral y configurable (no presuponer titulación — "técnico competente" está en disputa jurídica).

Numeración de páginas.

## Composición del plano — NO html2canvas (§11.3, regla de oro 7)

Sobre el div de Leaflet, html2canvas produce el polígono flotando sobre un rectángulo gris (teselas cross-origin contaminan el canvas — es el fallo visible del competidor). **Componer el canvas a mano.**

### Receta A (recomendada para 300 ppp) — una imagen WMS al tamaño exacto de salida

1. Tamaño físico del plano en el PDF: `W_mm × H_mm` (p.ej. 180×130).
2. Píxeles a 300 ppp: `W_px = round(W_mm/25.4*300)`.
3. Encuadre UTM (EPSG:25830) = BBOX de la parcela + margen, **ajustado al ratio `W_px/H_px`** (no deformar).
4. `GetMap` con `CRS=EPSG:25830&BBOX=…&WIDTH=W_px&HEIGHT=H_px&FORMAT=image/jpeg&LAYERS=…`, cargada con **`crossOrigin='anonymous'` ANTES de `img.src`**, dibujar en el `load`.
5. Canvas offscreen `W_px×H_px`, `ctx.drawImage(img,0,0)`.
6. Dibujar el vector encima (mismo mapeo UTM→px).
7. `canvas.toDataURL('image/jpeg',0.92)` → jsPDF.

**Mapeo UTM→px:** `sx=W_px/(bbox.maxX−bbox.minX)`, `sy=H_px/(bbox.maxY−bbox.minY)`, `toPx=([x,y])=>[(x−bbox.minX)*sx,(bbox.maxY−y)*sy]` (y invertida).
**Orden de dibujo:** (1) polígono parcela (relleno translúcido + trazo), (2) edificio, (3) acotaciones (distancia euclídea UTM, texto rotado), (4) vértices + numeración, (5) escala gráfica (`barra_px=N·sx`), (6) norte (en UTM el norte de cuadrícula es +Y → flecha vertical).

## 🔻 OVERRIDES (dossier)

- **O7 — CORS RESUELTO (VERIFICADO):** el WMS del Catastro con `crossOrigin='anonymous'` da canvas **CLEAN** (`toDataURL` OK); el control negativo sin crossOrigin sale TAINTED. La Receta A es viable — era el mayor riesgo del proyecto, **despejado**. *(S5).*
- **Caveat MaxWidth/MaxHeight:** los WMS imponen tope de píxeles (GeoServer 2048/4096 por defecto). A 300 ppp un A3/A2 lo supera → **comprobar el tope real del WMS del Catastro y, si hace falta, dividir en 2–4 `GetMap` contiguas** y unirlas en el canvas. *(dossier §4.4 B3).*
- Si una capa no sirve con CORS, deshabilitarla para el informe e **indicarlo** (regla de oro 1).

## Descripción literaria del lindero (`report/literal.js`) — diferenciador

Texto para escrituras e instancias, desde geometría + rumbos + colindantes del WFS: *"Linda al norte, en línea recta de 12,45 m, con la parcela 98 del polígono 8…"*. Patrón: **recorrido horario desde el vértice más al NO**, agrupando tramos consecutivos con el mismo colindante y rumbo similar, por cuadrantes N/E/S/O, con colindante y distancia. **Editable antes de exportar.**

## jsPDF

Documento mm/A4; `doc.addImage(canvas,'JPEG',x,y,W_mm,H_mm,'plano','FAST')` (acepta canvas directo); resolución efectiva 300 ppp. Multipágina con `addPage`; escala numérica rotulada `1:${round((bbox.maxX−bbox.minX)*1000/W_mm)}`; fuentes estándar (Helvetica/Times) cubren acentos y ñ. La escala numérica pertenece al PDF (en pantalla solo barra gráfica).

## Criterios de aceptación

1. El canvas compuesto exporta con `toDataURL` **sin `SecurityError`** (test en proyecto `dom` con tesela CORS simulada; control negativo TAINTED valida la prueba).
2. El mapeo UTM→px coloca los vértices en el píxel correcto (función pura testeada).
3. Si la salida supera el `MaxWidth` del WMS, se parte en varias `GetMap` y se recomponen sin costura.
4. La descripción literaria de una geometría fixture recorre horario desde el NO y agrupa tramos; es editable.
5. El PDF lleva pie de firma configurable y el nombre correcto; ninguna cifra del diagnóstico lleva color de mérito.

## Referencias

Plan §11, §18 Fase 9, §20, §22 (CORS). Dossier §4.4 (Receta A + caveat + CORS), §5.6 (descripción literaria, memoria de encaje), §5.5 (nomenclatura, firma neutral).
