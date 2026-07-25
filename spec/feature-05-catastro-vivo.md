# F05 · Catastro en vivo

**Fase:** 5 · **Prioridad:** P5 · **Riesgo:** Medio (anti-bloqueo) · **Depende de:** F00, F03 · **Habilita:** F06, F07.
**Ficheros:** `services/catastro.js` (único contacto con el Catastro), `storage/cache-catastro.js`.

## Objetivo

Traer la parcela oficial y sus colindantes del WFS como **punto de partida editable**, deducir la RC desde la geometría y cachear en IndexedDB. Aislar todo el contacto con el Catastro en un solo módulo (contingencia CORS en un sitio).

## Alcance

### `services/catastro.js` — punto único de contacto

Funciones de alto nivel: `getParcelByRefcat(refcat, srs='EPSG::25830')`, `getNeighbourParcels(refcat)`, `getBuildingByParcel(refcat)`, `getParcelsByBBox(bbox, srs)`, `getRefcatByCoord(x,y,srs)`, `getZoning(codZona)`.
- Constante `CATASTRO_BASE` única: si retiran CORS, se apunta a un proxy tocando un fichero. **No rotar User-Agent.**
- `SRS_DEFAULT = 'EPSG::25830'` (25829/25831 según huso). Trabajar en proyectado; reproyectar a 4326/3857 solo para pintar.
- Parser `gml:posList → GeoJSON` centralizado (reutiliza `gml/parse.js`). En 25830 el posList viene **X Y** (sin invertir); en 4326 viene lat,lon (INSPIRE) → invertir a `[lon,lat]`.
- Capa de red única: `fetch` + `AbortController` (timeout), **cola de concurrencia (máx 2–4)** + debounce, backoff exponencial con jitter. **Errores normalizados** `CatastroError{kind:'not_found'|'rate_limited'|'cors'|'network'|'empty'}`: el WFS puede devolver `ExceptionReport` o feature vacía → **estados, no excepciones fatales**.
- Manda `User-Agent` de navegador (el navegador lo hace gratis); sin él el servicio da error.

### Carga por RC (§5.4) — editable, no solo consulta

```
https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2
  &request=getfeature&STOREDQUERIE_ID=GetParcel&refcat=<REFCAT>&srsname=EPSG::25830
```
Es el flujo más frecuente: coger la parcela oficial y modificar un lindero. Descargar también colindantes (`GetNeighbourParcel`): hacen falta para snap, invasión y descripción literaria. También por punto: clic en mapa → geocodificación inversa (`Consulta_RCCOOR` REST/JSON) → RC.

### Deducción automática de RC (§7.3)

Cuando la geometría entra por DXF/LIST/TXT sin parcela previa: centroide → consulta al Catastro → rellenar RC con la parcela que lo contiene, **campo editable** ("Parcela deducida de la ubicación · puedes corregirla"), resaltada en el mapa. Si el centroide no cae en parcela única, no rellenar a ciegas: indicarlo y dejar elegir.

### Caché IndexedDB (`cache-catastro.js`)

Store `catastroCache` (keyPath `refCatastral`, TTL largo, geometría estable) y `revgeo` (`round(x),round(y),srs → refcat`). **Consultar la caché antes de cada `getParcelByRefcat`: es el mayor factor anti-bloqueo del cliente.** No cachear teselas IGN aquí (ya lo hace HTTP).

## 🔻 OVERRIDES (dossier)

- **O8 — Umbral de bloqueo:** la cifra "**3.600 peticiones/h → 4 h**" **NO existe en fuente oficial** — no citarla ni diseñar contra ella. Lo oficial: denegación **~10 días**, y la SEC **detecta la rotación de IP/UA** → **no rotar UA**. El frontend puro ya reparte por IP. Anti-bloqueo real = caché + cola + backoff + WMS por encuadre. *(dossier C-1, §2.3).*
- **O7 — CORS + HTTPS RESUELTO** en WFS/OVC: `fetch` cross-origin directo, sin proxy. *(S5).*
- **Cobertura:** "no encontrado" (País Vasco, Navarra, suelo sin parcela) = **estado válido**, no fallo. *(C6).*

## Fuera de alcance

País Vasco y Navarra (catastros forales). Descargas masivas (eso sería ATOM, fuera de v1).

## Criterios de aceptación

1. `getParcelByRefcat` de la RC fixture devuelve el modelo con geometría, RC y SRS; segunda llamada sale de caché (sin red).
2. Un RC inexistente devuelve `CatastroError{kind:'not_found'}`, no una excepción.
3. La cola limita a ≤4 peticiones simultáneas; el backoff reintenta con jitter.
4. Deducción de RC desde un centroide de fixture rellena el campo editable; centroide ambiguo lo indica sin rellenar.
5. El User-Agent no se rota entre peticiones.

## Referencias

Plan §5.4, §7.3, §18 Fase 5, §21. Dossier §2.1–§2.5 (endpoints, régimen de acceso, trampas), §2.4 (`services/catastro.js`), §4.2 (IndexedDB/`idb`), §0.6 (CORS).
