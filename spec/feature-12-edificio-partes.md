# F12 · Edificio: partes y plantas

**Fase:** 12 · **Prioridad:** P14 (baja) · **Riesgo:** Medio · **Depende de:** F11 · **Habilita:** F13.
**Ficheros:** `edit/dibujo.js` (completar), envolvente derivada en `model/edificio.js`.

## Objetivo

El corazón del flujo de edificio: gestionar una **lista de partes** (no un solo recinto), con plantas por parte, dibujo de recinto desde cero y **edificio-envolvente derivado**.

## Alcance

### Lista de partes (§15.1)

- Añadir/eliminar/seleccionar parte. Nombre **editable** (rótulo en plano e informe).
- Tipo: **Principal** vs **Otra construcción** (piscina y similares).
- Por cada parte **principal**: **plantas sobre rasante y bajo rasante**, enteras, con ayuda *"bajo rasante = sótanos; rasante es la línea del terreno"*. Rotuladas sobre cada parte en el mapa (romano: "II", "I").
- **Partes tipo Otra (piscinas): sin contadores de plantas.** No es "0 plantas", es que no aplica (campos `null`).

### Geometría de la parte activa (§15.2)

- Edición como parcela pero sobre la parte activa (arrastrar/insertar/eliminar, offset, snap — reutiliza F06).
- **Dibujar recinto desde cero** (`edit/dibujo.js`): una parte recién añadida no tiene geometría → *"pendiente de dibujar el recinto"* + herramienta de dibujo vértice a vértice con el mismo snap. Es el caso común: declarar un porche o piscina que no estaban.
- **No se permiten huecos interiores** en una parte: la herramienta de hueco no aparece.

### Edificio-envolvente (§15.3) — derivado, no dibujado

Se muestra como **resultado derivado**: una línea que rodea todas las partes **sobre rasante**, etiquetada *"envolvente calculada"*. No lleva rótulo de plantas (es un contorno, no una planta). Se calcula como unión de contornos (`turf.union`, topológico, permitido).

### Retroalimentación (§15.4)

Superficie de la parte activa y suma de huella sobre rasante, en vivo.

## 🔻 OVERRIDE (dossier)

- **O11 — BuildingPart VERIFICADO:** el modelo "una parte = una huella con sus plantas" es correcto. `GetBuildingPartByParcel` devuelve **una `BuildingPart` por volumen de altura homogénea**, cada una con huella propia + `numberOfFloorsAboveGround`/`numberOfFloorsBelowGround` independientes (fixture real: 13 partes). Las plantas van por parte; el `Building`-envolvente solo lleva el máximo de plantas sobre rasante. *(dossier S4, VERIFICADO; fixture `bu_buildingpart_9398516VK3799G.gml`).*

## Criterios de aceptación

1. Añadir/renombrar/eliminar partes y asignar plantas por parte funciona; las piscinas no muestran contadores.
2. Dibujar un recinto desde cero, vértice a vértice con snap, crea la geometría de la parte.
3. La envolvente se recalcula automáticamente al cambiar las partes sobre rasante y **no** es editable como dato.
4. Las partes no admiten huecos interiores.

## Referencias

Plan §15, §18 Fase 12, §23.3. Dossier §1.2 (BuildingPart), §0.5/§0.6 (estructura verificada), §3.6 (dibujo/snap).
