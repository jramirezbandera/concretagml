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

> Los nombres de función de abajo son los del dossier, en inglés. La
> implementación usa los del proyecto, en español (`parcelaPorRefcat`,
> `parcelaYColindantes`, `parcelasEnBbox`, `refcatPorCoordenada`), y `CatastroError`
> no existe — ver «Desviaciones deliberadas».

1. `getParcelByRefcat` de la RC fixture devuelve el modelo con geometría, RC y SRS; segunda llamada sale de caché (sin red). ✅
2. Un RC inexistente devuelve ~~`CatastroError{kind:'not_found'}`~~ **`MOTIVO_CATASTRO.NO_ENCONTRADO` en el resultado**, no una excepción. ✅
3. La cola limita a ≤4 peticiones simultáneas; el backoff reintenta con jitter. ✅ *(el tope es 2, el extremo prudente del «2–4» del dossier)*
4. Deducción de RC desde ~~un centroide~~ **un punto interior** de fixture rellena el campo editable; punto ambiguo lo indica sin rellenar. ✅
   ⚠️ **Cambio con motivo medido**: el centroide aritmético de una parcela en L cae **fuera** del polígono, y ahí el Catastro devolvería tan tranquilo la referencia de la parcela **vecina** — un dato mal, en silencio. Se usa `gml/anillos.js#puntoInterior`, que garantiza interioridad.
5. ~~El User-Agent no se rota entre peticiones.~~ **REFORMULADO (M7): la app no toca ninguna cabecera.** Lo vigila el guardián **G9**; el enunciado original es incomprobable e irrelevante.

## ⛔ Lo que la implementación MIDIÓ y esta spec decía de otra forma (2026-07-28)

Antes de escribir una línea se midió el servicio real con `curl`, y ocho puntos de
arriba resultaron ser falsos o inexactos. Todos están capturados como fixtures con su
procedencia en [`test/fixtures/catastro/PROCEDENCIA.md`](../test/fixtures/catastro/PROCEDENCIA.md)
y todos tienen un guardián. Manda lo medido (regla de oro 8).

| # | Esta spec decía | ✅ Medido |
|---|---|---|
| M1 | (implícito) que un error se distingue por el código HTTP | **Todo error llega con HTTP 200.** `response.ok` no clasifica nada: hay que oler el cuerpo |
| M2 | `getParcelsByBBox(bbox, srs)`, como si `GetParcelsByBBox` fuera del servicio | **No existe.** `DescribeStoredQueries` publica cinco y esa no está. El BBOX se hace con `GetFeature` estándar + `typenames` |
| M3 | «el WFS puede devolver `ExceptionReport` **o feature vacía**» → `kind:'empty'` | **No existe la colección vacía.** Un BBOX sin parcelas devuelve `ExceptionReport` con **el mismo `exceptionCode`** que una RC inexistente; solo cambia el texto libre del CDATA (bilingüe y con errata del servicio: «No records *founded*»). `kind:'empty'` **no es derivable de la respuesta** |
| M4 | (nada) | **`GetNeighbourParcel` incluye a la propia parcela**, y no la primera: viene en 2.ª posición de 5. Por eso la función se llama `parcelaYColindantes` y separa por referencia, nunca por índice |
| M5 | (nada) | **Los atributos de conteo mienten los dos.** Con `count=10` el cuerpo trae 10 miembros y `numberMatched` **y** `numberReturned` declaran 539. Se cuentan `<member>` |
| M6 | «`Consulta_RCCOOR` REST/JSON» sin más | **Hay dos endpoints con nombres de parámetro DISTINTOS**: el `.asmx` usa `Coordenada_X/Y`, el `.svc/json` usa `CoorX/CoorY`. Cruzarlos da `cuerr:1 cod:76` con HTTP 200 — que un lector ingenuo traduciría como «no hay parcela aquí» cuando la verdad es «hemos construido mal la URL» |
| M7 | «Manda `User-Agent` de navegador; sin él el servicio da error» (plan §5.4) | **Refutado**: 200 con UA de curl, con UA de navegador y **sin cabecera alguna**. Y es inaplicable: `User-Agent` es *forbidden header name*, un navegador no puede fijarla. La app no toca ni una cabecera |
| M8 | latencia no cuantificada | WFS 0,099–0,451 s, pero **`Consulta_RCCOOR` llega a 2,903 s** (abre sesión ASP.NET en cada llamada). Un timeout dimensionado sobre el WFS cortaría llamadas buenas de geocodificación |

### Desviaciones deliberadas del enunciado, con su motivo

- **No hay clase `CatastroError`.** El proyecto no tiene ni una clase de error, y su
  frontera está escrita: dato malo del usuario → objeto de estado; contrato roto por el
  programador → `throw`. Se sigue el precedente de `gml/descargar.js`:
  `MOTIVO_CATASTRO` congelado + `ResultadoCatastro` con **todas las claves siempre
  presentes**.
- **No existe `kind:'rate_limited'`.** Nadie ha medido —ni va a medir— qué contesta el
  servicio a un cliente denegado, porque provocarlo cuesta ~10 días de servicio. Un
  detector de una señal que nadie ha visto o es código muerto que tranquiliza, o
  dispara en falso. **El guardián G13** exige que todo motivo del catálogo tenga un
  caso reproducible en la suite, así que nadie podrá añadirlo sin medirlo antes.
- **No existe `kind:'cors'`.** Un fallo de CORS rechaza el `fetch` con el mismo
  `TypeError` que estar sin red, sin DNS o sin TLS; el motivo real solo está en la
  consola de devtools. Cae en `SIN_RED`, cuyo mensaje nombra las cuatro posibilidades.
- **El criterio de aceptación 5 se reformula.** «El User-Agent no se rota» es
  incomprobable e irrelevante (M7). Lo único comprobable es que **no lo intentamos**, y
  de eso se ocupa el guardián **G9**.
- **Fuera por ahora, con el transporte preparado:** `getBuildingByParcel` (otro
  endpoint, `wfsBU.aspx`; solo lo usan F11–F14, diferidas) y `getZoning` (sin
  consumidor). Decisión de alcance del usuario.
- **La caché guarda el CUERPO CRUDO del GML, no el POJO parseado.** Así una corrección
  futura en `gml/parse.js` arregla retroactivamente todo lo cacheado. Guardar el objeto
  lo congelaría con los fallos del parser del día que se guardó y los serviría durante
  el TTL entero — que no es hipotético: el 2026-07-27 la Sede rechazó un GML por un
  fallo de esa capa (SPEC §3.1) y se corrigió el mismo día.
- **`superficieCatastral` se añadió a `model/parcela.js`**, hermano de
  `superficieRegistral`. Es el `cp:areaValue` **declarado** (entero), no una superficie
  medida: en la parcela real el Catastro declara 1536 m² y la shoelace de sus propias
  coordenadas da 1535,87. Esa diferencia es el dato de F07.

### Lo que NO cubre ningún test de la suite, dicho por escrito

**CORS.** Ni Node ni jsdom aplican la política de mismo origen. Se cubre en el guion de
humo `07-catastro-vivo.js` (navegador real) y en `npm run catastro:vivo` (servicio
real). Un test que dijera «CORS comprobado» sería mentira. Los demás huecos están
declarados en `PROCEDENCIA.md` y en las cabeceras de los tests de aceptación.

## ⛔ Un defecto de ESTA fase que destapó la firma humana de F08 (2026-08-02)

**Las parcelas colindantes no se dibujaban en ningún sitio.** Se traían del servicio
(`parcelaYColindantes`), se publicaban por `alColindantes` y las consumían el **snap**
de F06 y la **invasión** de F07 — pero **no había ni una capa que las pintara**.
Pulsar «Traer colindantes» no daba **ningún** acuse de recibo visual: el usuario leía
«4 parcelas colindantes» en la ficha y el mapa seguía exactamente igual. Que el dato
se usara por dentro no lo arregla; **que no se vea es la regla de oro 1 rota en el
último tramo**, que es el peor sitio, porque el trabajo ya estaba hecho.

Ni la suite ni ningún guion de humo lo veían, y por un motivo que conviene tener
escrito: **nadie afirmaba que se dibujaran**. No es que un test fallara — la
afirmación no existía.

**El arreglo vive en `viewer/colindantes.js`** (contorno gris `#CBD5E1` de 1,5 px sin
relleno visible, emergente con la referencia catastral) sobre `PANE.COLINDANTES` en
zIndex **405**, el único pane del visor **por debajo** de la geometría propia — una
vecina **comparte lindero** con ella y dibujada encima pondría gris el lado
compartido—, y lo enchufa `app/main.js` como **tercer suscriptor** de
`alColindantes`. Las vecinas se **sueltan solas** cuando entra en el store una parcela
con otra identidad (`viewer/index.js`, paso 7).

**Esta spec no se reescribe por ello**: lo que decía sigue siendo verdad, y lo que le
faltaba —dónde se ven— está contado con su medida en
[`feature-08-comprobar-gml.md`](feature-08-comprobar-gml.md) **M21**, y medido en
navegador en `scripts/smoke-navegador/GUION.md` §16.

## Referencias

Plan §5.4, §7.3, §18 Fase 5, §21. Dossier §2.1–§2.5 (endpoints, régimen de acceso, trampas), §2.4 (`services/catastro.js`), §4.2 (IndexedDB/`idb`), §0.6 (CORS).
**Y por encima de todos ellos donde discrepen: [`test/fixtures/catastro/PROCEDENCIA.md`](../test/fixtures/catastro/PROCEDENCIA.md)**, que es lo medido.
