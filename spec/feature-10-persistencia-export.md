# F10 · Persistencia y exportación

**Fase:** 10 · **Prioridad:** P10 · **Riesgo:** Bajo · **Depende de:** F04 · **Habilita:** F11.
**Ficheros:** `storage/` (expedientes), `export/dxf.js`.

## Objetivo

Guardar expedientes en IndexedDB con autoguardado y cerrar el círculo con el CAD exportando a DXF (además del GML de F04).

## Alcance

### Expedientes (`storage/`, con `idb`)

- Store `expedientes` (keyPath `id`, índices `actualizado`/`refCatastral`). Guardar (`put`), listar (`getAllFromIndex`), recuperar, **duplicar** (`structuredClone` + nuevo id), **autoguardado** del trabajo en curso (debounce 1–3 s).
- Migraciones secuenciales en `upgrade` con `if(oldVersion<N)`; callbacks `blocked/blocking/terminated` para multipestaña.
- **Cuota:** `navigator.storage.persist()` al arrancar (evita desalojo) y `navigator.storage.estimate()` (vigilar `usage/quota`); escrituras en `try/catch` de `QuotaExceededError` con degradación (purgar caché de GML antiguo).

### Exportación (§13.2)

- **GML** — salida principal (ya en F04).
- **DXF** (`export/dxf.js`) — llevarse a CAD la **parcela oficial junto a la editada, en capas separadas**, para que el perito compare.
- **PDF** — el informe (F09). **TXT** — listado de coordenadas.

## 🔻 OVERRIDE (dossier)

- **O12 — DXF R2000:** `LWPOLYLINE` **no** es válido en un DXF "solo ENTITIES" (R12). Mínimo real **AC1014 (R14)**; en la práctica emitir **`AC1015` (R2000)**. Secciones: `HEADER ($ACADVER AC1015)` → `TABLES` (tabla `LAYER`: `PARCELA_OFICIAL`, `PARCELA_EDITADA`, colores por código 62) → `ENTITIES` → `EOF`. `LWPOLYLINE`: `0=LWPOLYLINE`, `8=capa`, `90=nº vértices`, `70=1` (cerrada), por vértice `10=X`/`20=Y`, coordenadas en UTM sin transformar. *(dossier B2/§4.5).*

## Criterios de aceptación

1. Guardar → listar → recuperar → duplicar un expediente conserva el modelo; el autoguardado dispara con debounce.
2. Una migración de versión antigua no pierde datos.
3. El DXF exportado abre en CAD con las dos capas separadas; snapshot del DXF (`toMatchFileSnapshot`) estable.
4. `QuotaExceededError` degrada sin romper (purga caché, avisa).

## Referencias

Plan §13.1–§13.2, §18 Fase 10. Dossier §4.2 (IndexedDB/`idb`, cuota), §4.5 (DXF a mano).
