# F08 · Comprobar un GML existente

**Fase:** 8 · **Prioridad:** P8 · **Riesgo:** Bajo · **Depende de:** F04, F07 · **Habilita:** F14 (comprobación de edificio ajeno).
**Ficheros:** `gml/parse.js` (entrada ajena), recorrido corto en `viewer/`.

## Objetivo

Tercera vía de entrada, al mismo nivel que RC y medición: **cargar un GML ya hecho (propio o ajeno) y contrastarlo contra el parcelario, sin generar nada.** Es el diagnóstico con otra entrada; barato de añadir sobre F07.

## Alcance

- Área para soltar o elegir un `.gml`. Apoyo: *"Contrasta un GML ya hecho contra el parcelario, sin generar uno nuevo."*
- **Recorrido:** Entrada → **Comprobación** → Diagnóstico. **No** incluye Edición ni generación. El rastro lateral muestra solo esos pasos.
- **Paso de Comprobación** (revisa el fichero antes de contrastar): un GML ajeno puede traer **varias parcelas**, un **SRS distinto** del esperado o **coordenadas fuera de huso**. Mostrarlo como **nota clara, no un error de programa**; si hay más de una parcela, dejar **elegir cuál** se contrasta.
- En el diagnóstico llegado por esta vía:
  - Identificador de cabecera: *"GML cargado · nombre.gml"*, no una RC tecleada.
  - Acción principal: **"Descargar informe de contraste"** (el GML ya existe), no "Generar GML". Como mucho, un secundario para volver a descargar el mismo fichero.
- Acepta GML de **parcela** y de **edificio**: en el segundo caso el contraste es contra la construcción registrada (F14), no contra el lindero.

## Notas

- Reutiliza `gml/parse.js` (F04) y `diagnostico/parcela.js` (F07). Debe tolerar tanto dialecto 4.0 (wfs 2.0 + member) como GML de edificio (gml:FeatureCollection). Un 3.0 antiguo se detecta y se avisa.
- Coherente con reglas de oro: la geometría cargada se conserva intacta como término de comparación.

## Criterios de aceptación

1. Un `.gml` de parcela válido se parsea y llega al diagnóstico sin pasar por edición ni generación.
2. Un GML con varias parcelas ofrece elegir; uno con SRS inesperado o coords fuera de huso lo indica como nota, no como fallo.
3. La acción principal del diagnóstico por esta vía es "Descargar informe de contraste".
4. Un GML de edificio se encamina al contraste de construcción (F14), no al de lindero.

## Referencias

Plan §7.2, §18 Fase 8. Dossier §1.1/§1.2 (dialectos parcela/edificio), §1.5 (detección de 3.0).
