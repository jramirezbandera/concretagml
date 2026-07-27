# Smoke en navegador real — F03 · Fase 4

Runbook de la **tarea 4D**: lo que `jsdom` no puede probar de F03. La suite
(1.855 pruebas) ya cubre la lógica; aquí se comprueba lo otro: que **el servicio
responda con el tamaño pedido**, que **el canvas quede limpio**, que la
atribución sea **visible** (jsdom no calcula layout) y que el arrastre funcione
con la **maquinaria real de `L.Draggable`**.

- **4D.1** (esta carpeta) escribió los guiones y los probó en seco.
- **4D.2** es la ejecución oficial, con evidencia, siguiendo este documento.

Cinco guiones de aceptación, un veredicto **serializable** cada uno
(`{ok: boolean, …medidas}`), para que el resultado no dependa de interpretar prosa:

| Guion | Criterio | Mide | Veredicto pasa si |
|---|---|---|---|
| `01-capas.js` | F03 · 1 | las cinco bases conmutan y pintan; la superpuesta regula opacidad | `ok:true` |
| `02-wms-encuadre.js` | F03 · 2 | 1 `GetMap` por instancia WMS visible y por encuadre, al tamaño del lienzo | `ok:true` |
| `03-arrastre.js` | F03 · 3 | arrastrar un vértice mueve tabla + dibujo + ficha | `ok:true` |
| `04-atribucion-consola.js` | F03 · 4 y 5 | atribución literal y visible; canvas limpio; el canal de avisos llega a la UI | `ok:true` |
| `05-salto-zoom.js` | — | **diagnóstico**, no aceptación: mide frame a frame la transición de la imagen WMS al hacer zoom | ver §11 |
| `06-generar-gml.js` | F04 · T7.2 | la cadena Blob → descarga: bytes UTF-8, `posList`, `areaValue` y estructura del GML que baja | `ok:true` |

`05` es de otra clase que los cuatro primeros: no cuelga de ningún criterio del
spec. Es el REPRODUCTOR con el que se diagnosticó el defecto que reportó la
revisión humana de la Fase 5 («al hacer zoom la cartografía se mueve y luego
vuelve a su sitio»), y se conserva porque la corrección —el fundido de
`viewer/wms-catastro.js`— solo se puede comprobar midiendo frames. Ver §11.

`06` es el primero que **no es de F03**: mide la generación del GML (F04) y va en
su propia pasada, sobre página recién cargada. Ver §12.

Cada guion lleva en su cabecera **qué mide y qué NO puede medir**. Léelas antes
de citar un resultado.

---

## 0. ⚠️ La advertencia que no se puede omitir: el arrastre NO es un gesto de ratón

`/browse` **no tiene comando `drag`**, y la vía de escape por CDP está cerrada:
su allowlist es *deny-default* y el dominio `Input` no aparece en ella, así que
`Input.dispatchMouseEvent` es inalcanzable. El único camino son **eventos
sintéticos** (`$B js` / `$B eval`), que **sí** disparan `L.Draggable` porque
Leaflet no comprueba `isTrusted`.

Por tanto `03-arrastre.js` prueba el arrastre **en un navegador real, con layout,
CSS y proyección reales** —`getBoundingClientRect` de verdad, `translate3d` de
verdad, `MarkerDrag` de verdad y la cadena completa marcador → store → tabla →
polígono → ficha—, pero **no es un gesto de ratón real**. Lo que queda fuera
(hit-testing, `pointer-events`, cursor, tamaño del área de agarre) es el
**checklist humano de la fase 5**.

**Que nadie lea este smoke como «el arrastre está probado con ratón».** El propio
veredicto de `03` lo dice en `esGestoDeRatonReal: false` y en `aviso`.

Donde un selector CSS basta, el runbook usa `$B click` (evento *trusted* de
Playwright); ver §5.

---

## 1. Antes de empezar

### 1.1 Arrancar el servidor y **leer el puerto**

```bash
npm run dev            # dejarlo corriendo en segundo plano
```

No des `5173` por hecho: **lee el puerto de la salida** (`➜ Local:
http://localhost:PUERTO/concretagml/`). Si el 5173 está ocupado, Vite coge otro
sin avisar más que en esa línea.

> ⚠️ **La app NO se sirve en la raíz**: `vite.config.js` fija
> `base: '/concretagml/'` para GitHub Pages, y ese base se aplica **igual en dev,
> build y preview** (a propósito: que dev y preview sirvieran rutas distintas es
> la clase de diferencia que esconde un fallo hasta que está publicado). Abrir
> `http://localhost:PUERTO/` **da 404**. La URL es
> `http://localhost:PUERTO/concretagml/`.

> Vite bindea **IPv6**: usa `http://localhost:PUERTO`. **`127.0.0.1` falla.**

También sirve `npx vite preview` sobre `npm run build` (más parecido a
producción, sin módulos sueltos ni HMR). Si se usa `preview`, el puerto es otro
(4173 por defecto) y desaparecen los mensajes `[vite] connecting…` de la consola.

### 1.2 Resolver `$B` (bloque de arranque de la skill `/browse`)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/browse/dist/browse" ] && B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -z "$B" ] && B="$HOME/.claude/skills/gstack/browse/dist/browse"
[ -x "$B" ] && echo "READY: $B" || echo "NEEDS_SETUP"
```

En Windows el binario real es `browse.exe`; Git Bash resuelve `browse` →
`browse.exe`, así que el bloque funciona tal cual. Los artefactos van a
`.gstack/` (ya ignorada por git).

### 1.3 Preparar la página

```bash
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/    # ⚠️ el base, no la raíz
$B wait ".gml-tabla-vertices"
$B console --clear
$B network --clear
$B js "(()=>{const e=document.getElementById('mapa');return {ancho:e.clientWidth,alto:e.clientHeight,filas:document.querySelectorAll('#tabla-vertices tr[data-indice]').length}})()"
```

Lo que tiene que devolver ese último comando: **`{ancho: 1048, alto: 900, filas:
15}`**. El ancho sale de `1440 − 392` (el panel), y `mapa.getSize()` **ES**
`[#mapa.clientWidth, #mapa.clientHeight]` (`Map#getSize` lee el contenedor), tal
como documenta `app/main.js`: por eso no hace falta ningún `window.__gml`.

**El viewport hay que fijarlo**: `02` compara `WIDTH`/`HEIGHT` de cada `GetMap`
con el lienzo, y sin viewport fijo la medida no es reproducible entre corridas.

Tres trampas que cuestan tiempo si no se saben:

- `$B wait "#tabla-vertices tr[data-indice]"` **falla**: `wait` (y `click`)
  rechazan un selector que case con **varios** elementos («Selector matched
  multiple elements»). De ahí `.gml-tabla-vertices`, que es único.
- `$B eval` resuelve la ruta contra el **cwd del DEMONIO** de `browse` (el
  directorio desde el que se lanzó el primer comando), y rechaza lo que quede
  fuera de ese cwd o de `/tmp`. Ejecuta todo **desde la raíz del repo**; si sale
  `Path must be within: …`, haz `$B restart` **desde la raíz** y repite.
- Si en esta máquina se han importado cookies alguna vez
  (`/setup-browser-cookies`), `browse` **bloquea `js`/`eval`** en cualquier
  dominio que no sea de las cookies importadas, y `localhost` fallaría con
  «JS execution blocked». Se arregla con `$B restart` sin importar cookies.

---

## 2. Secuencia exacta

El orden **no es libre**:

1. **`02` primero**: su medida «carga inicial» cuenta los `GetMap` acumulados
   **desde la carga de la página**, así que exige página recién cargada. Lo
   comprueba él mismo (`cargaInicialContaminada`).
2. **`01` después**: conmutar capas genera más `GetMap` y contaminaría a `02`.
   `01` restaura el estado de arranque al terminar (base «Ortofoto PNOA»,
   superpuesta activa, opacidad 60 %).
3. **`03`**: deja la geometría **modificada** a propósito (para que la evidencia
   se vea en una captura). No lo pongas antes de `02`.
4. **`04` último**: el recuento de avisos e imágenes fallidas es más informativo
   cuando ya se han ejercitado capas y arrastre.

```bash
$B eval scripts/smoke-navegador/02-wms-encuadre.js
$B eval scripts/smoke-navegador/01-capas.js
$B eval scripts/smoke-navegador/03-arrastre.js
$B eval scripts/smoke-navegador/04-atribucion-consola.js
```

Para repetir un guion desde cero: `$B reload && $B wait ".gml-tabla-vertices"`
antes de volver a lanzarlo (obligatorio para `02`, recomendable para `03`).

`06` **no entra en esta secuencia**: va en su propia pasada, con la página recién
cargada. `03` deja la geometría movida a propósito, y `06` contrasta el
`areaValue` del fichero contra el del dataset de arranque — encadenarlo detrás de
`03` lo haría fallar con razón. Ver §12.

Y las lecturas transversales, al final:

```bash
$B console --errors
$B console | tail -20
$B network | grep -E "ServidorWMS|→ (4|5)[0-9][0-9]"
$B screenshot .gstack/smoke-f03.png
```

---

## 3. Qué cuenta como «pasa», guion a guion

Regla general: **`ok: true` y `problemas: []`**. Cada guion acumula en
`problemas` una frase por cada cosa que no cuadra, así que el `ok` nunca es un
booleano huérfano. Y además, a ojo:

### ⚠️ Antes de diagnosticar nada: el FALSO NEGATIVO por latencia

`01` y `02` llevan **márgenes de tiempo fijos** (2.500 ms para que una base
pinte; un margen por paso para contar los `GetMap`). Cuando el WMS del Catastro
va lento —y va lento a ratos: se ha medido **2.062 ms** en una petición que
normalmente tarda 250-300 ms, y la **primera en frío ronda los 3 s**— esos
márgenes se quedan cortos y el veredicto sale rojo **sin que la app tenga nada
mal**. La firma es inconfundible:

- `01`: *«La base 'Catastro' no ha llegado a pintar en 2500 ms»* con
  `wmsBaseCargadas: 0` — se pidió, pero no llegó a tiempo.
- `02`: una petición **desplazada al paso siguiente** (`zoom: 0 esperadas 1` y
  acto seguido `pan-nulo: 1 esperadas 0`). El total sigue cuadrando; lo que falla
  es a qué paso se le atribuye.

**Qué hacer:** recargar, esperar unos segundos a que la caché se caliente y
repetir. Si a la segunda pasa, era latencia. Solo si falla de forma
**reproducible** con el servicio respondiendo rápido hay defecto que buscar.

Y no lo arregles subiendo los márgenes sin pensarlo: son también lo que
detectaría una regresión de verdad en el número de peticiones, que es el mayor
riesgo del proyecto.

### `02-wms-encuadre.js` (criterio 2)

- `instanciasWmsVisibles` es la **expectativa derivada**, no un número mágico:
  con base PNOA + superpuesta catastral ⇒ **1** por encuadre; con base
  «Catastro» + superpuesta ⇒ **2**, y **eso es correcto** (dos imágenes
  distintas: una opaca y otra con `TRANSPARENT=TRUE`; lo que el criterio prohíbe
  es el MOSAICO — cabecera de `viewer/capas.js`).
- `pasos`: `coincide: true` en los cuatro. Peticiones esperadas
  `[1, 1, 1, 0]` con una sola instancia visible.
- `hayWidth256: false` en todos (un `WIDTH=256` sería un mosaico: el mayor riesgo
  de bloqueo del proyecto).
- `tamanoCoincideConLienzo: true` en todos.
- `bboxDistintosEnTotal: 3` (carga, pan y zoom son tres encuadres distintos; el
  «pan nulo» no aporta BBOX).
- `pasos[1].arrastreEngancho: true` y `pasos[3].arrastreEngancho: false`. **Esto
  es lo que evita el falso positivo peligroso del guion**: sin esa bandera, «0
  peticiones» podría significar «el pan no llegó a moverse» en vez de «la
  deduplicación funciona».
- `bufferQuizaDesbordado: false` (si fuera `true`, el buffer de Resource Timing
  pudo descartar entradas y la cuenta de la carga inicial no es fiable).

### `01-capas.js` (criterio 1)

- `ordenCoincide: true` — el control ofrece las cinco bases en el orden de
  `viewer/capas.js#CAPAS_BASE`. Esto es lo que legitima los selectores
  `nth-of-type` de §5.
- Por capa: `marcada: true`, `radiosMarcados: 1`, `capasBaseEnDom: 1`
  («activarBase deja UNA sola»), `pintando: true`,
  `superpuestaSigueActiva: true`.
- `opacidad`: `habilitadoConSuperpuesta: true`, `reaccionaAlDeslizador: true`
  (`0.6 → 0.2` en el `style.opacity` de la imagen superpuesta),
  `deshabilitadoSinSuperpuesta: true`, `rehabilitadoAlVolver: true`.
- `estadoFinal.base === "Ortofoto PNOA"` y `superpuestaActiva: true`.

### `03-arrastre.js` (criterio 3)

- `engancho.dragging: true` (Leaflet puso `leaflet-dragging` en el `<body>`: el
  gesto enganchó de verdad).
- `cambios.x: true` **Y** `cambios.d: true` **Y** `cambios.superficie: true`.
  **Los tres.** Si solo cambia uno, el criterio 3 está roto y hay que reportarlo:
  `x` es la tabla, `d` es el dibujo y `superficie` es la prueba de que el
  **segundo suscriptor** del store (la ficha del pie de `app/main.js`) reacciona.
- `cambios.numeroDeVertices: false` (arrastrar mueve, no añade: insertar es F06).
- `marcador.reutilizado: true` y `filaReutilizada: true` — el render es
  idempotente y no recrea lo que se está manipulando (hallazgo C8). Si esto
  fallara, un arrastre real se perdería a mitad.
- `marcador.desplazamientoMedidoPx` ≈ `desplazamientoPedidoPx` (64, −38).
- `esGestoDeRatonReal: false`: recuérdalo al redactar la evidencia (§0).

### `04-atribucion-consola.js` (criterios 4 y 5)

- `atribucion.cuatroLiteralesCubiertos: true` y `coincidePorIdentidad: true` en
  las cinco bases. La comparación es por **identidad** (`===`), no `toContain`:
  una paráfrasis («© Instituto Geográfico Nacional») pasaría un `contains` y
  sería un **incumplimiento de licencia**.
- `enlaceOsmPresente: true` con la base OpenStreetMap: la ODbL exige el **enlace**
  a la licencia, no solo el texto.
- Con la base «Blanco» el conjunto esperado es solo `CATASTRO`: su `atribucion`
  es la cadena vacía a propósito (no hay datos de terceros que citar).
- `presentacion.visible: true`, `tapada: false` y
  `controlOpacidad.solape.area === 0` (atribución y control de opacidad
  comparten la esquina `bottomright` y no deben pisarse).
- `canvas.wmsCatastro.toDataURLOk: true` y `getImageDataOk: true` → el canvas
  **no está contaminado** y la receta del plano a 300 ppp de F09 es viable
  (override O7). Ídem `canvas.teselaBase`.
- `avisos.canalLlegaALaUI: true` (ver §6).

---

## 4. Cifras de referencia (corrida en seco de 4D.1, **2026-07-26**)

Sirven para detectar una desviación, no como valores canónicos:

| Medida | Valor |
|---|---|
| `mapa.getSize()` con viewport 1440×900 | **1048 × 900** |
| Filas de vértices | 15 |
| `GetMap` por encuadre (PNOA + superpuesta) | **1** |
| `WIDTH`/`HEIGHT` de cada `GetMap` | 1048 / 900 |
| Estado HTTP del WMS | 200, `Content-Type: image/png`, `ACAO: *` |
| Latencia del WMS | 250–300 ms (primera, en frío: ~3 s) |
| Superficie antes → después del arrastre | 1535,87 m² → 1546,88 m² |
| Canvas | limpio (`toDataURL` y `getImageData` sin `SecurityError`) |
| Consola | limpia (solo `[debug] [vite] connecting…/connected.`) |

---

## 5. Comprobaciones cruzadas con eventos *trusted*

Los guiones conmutan y hacen zoom con clicks **sintéticos** (una sola llamada, un
solo veredicto). Para cerrar el hueco, el runbook repite dos de esas acciones con
eventos **de verdad** de Playwright:

**Radio de una base** (el `selectorTrusted` sale del veredicto de `01`, y su
posición está validada por `ordenCoincide`):

```bash
$B click '.leaflet-control-layers-base label:nth-of-type(4) input[type="radio"]'   # OpenStreetMap
$B js "(()=>{const l=[...document.querySelectorAll('.leaflet-control-layers-base label')].find(e=>e.querySelector('input').checked);return l?l.textContent.trim():null})()"
$B click '.leaflet-control-layers-base label:nth-of-type(2) input[type="radio"]'   # volver a Ortofoto PNOA
```

**Zoom, con la misma instrumentación que `02`** (sándwich de tres comandos; la
cuenta debe coincidir con la del paso `zoom` del guion):

```bash
$B js "(()=>{performance.clearResourceTimings();return 'limpio'})()"
$B click .leaflet-control-zoom-in
$B js "await new Promise(r=>setTimeout(r,1500)); const u=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('ServidorWMS.aspx')); return {peticiones:u.length, tamanos:u.map(x=>new URL(x).searchParams.get('WIDTH')+'x'+new URL(x).searchParams.get('HEIGHT'))}"
```

**Visibilidad de la atribución con el motor de Playwright** (independiente del
cálculo del guion):

```bash
$B is visible .leaflet-control-attribution     # → true
```

**Cabeceras HTTP y CORS** (`$B network` da `MÉTODO URL → estado (ms, bytes)`
**sin cabeceras**):

```bash
$B network --capture --filter "ServidorWMS"
$B click .leaflet-control-zoom-in
$B js "await new Promise(r=>setTimeout(r,1800)); return 'esperado'"
$B network --capture stop
$B network --export .gstack/wms-cabeceras.jsonl
node -e "const l=require('fs').readFileSync('.gstack/wms-cabeceras.jsonl','utf8').trim().split('\n');for(const s of l){const e=JSON.parse(s);console.log(e.status,e.contentType,e.headers['access-control-allow-origin'],e.size+'B')}"
```

Esperado: `200 image/png * …B`. Filtra siempre (`--filter`): la captura guarda el
**cuerpo** de cada respuesta y un PNG del lienzo completo va en base64.

---

## 6. Qué cuenta como «consola limpia»

Es el criterio más fácil de interpretar mal, así que va cerrado:

**Consola limpia =**

1. **Cero excepciones no capturadas.** `$B console --errors` devuelve
   `(no console errors)`, y `$B console` no muestra ningún `Uncaught` ni ningún
   `[error]`.
2. **Cero mensajes que contengan `CORS`, `SecurityError` o `tainted`.** Cualquiera
   de los tres tumba el smoke: los dos primeros rompen el criterio 4 y el
   tercero rompe la receta del plano de F09.
3. **No cuentan como suciedad** los `[debug] [vite] connecting… / connected.`:
   son el HMR del servidor de desarrollo, no de la app (con `vite preview` no
   aparecen).

**Un 404 de tesela suelto se REPORTA pero no tumba el smoke** — la cartografía de
fondo es `NIVEL.AVISO`, no bloquea la generación del GML. **Pero tiene que
aparecer como tarjeta en el panel de avisos.** Si no aparece, *eso* sí es un
fallo: significaría que el canal `alAvisar` no llega a la UI y **la regla de oro 1
está rota en producción**.

Cómo se comprueba, sin ambigüedad, en el veredicto de `04`:

- `avisos.imagenesFallidasEnDom` > 0 **y** `avisos.tarjetas` vacío ⇒
  `canalLlegaALaUI: false` ⇒ **FALLO** (el guion ya lo mete en `problemas`).
- Si `imagenesFallidasEnDom` es 0, no hubo nada que avisar y el panel debe estar
  en «Sin avisos.» con los dos chips a cero.

No hay forma cómoda de **provocar** el 404 desde `/browse` (no tiene
interceptación de red ni modo offline); provocarlo cortando la red un instante es
parte del checklist humano de la fase 5 (`CHECKLIST-HUMANO.md` §3).

⚠️ Y el aviso que invalida la lectura ingenua de `$B network`: el WMS del
Catastro devuelve sus errores como `ServiceExceptionReport` en `text/xml` **con
HTTP 200** (medido el 2026-07-26). **«Todos 200» NO significa «todo bien».** Lo
que delata el fallo es el `onerror` del `<img>` —por fallo de decodificación, no
por el código de estado— y, en la UI, la tarjeta del panel. Cruza siempre
`$B network` con `04.avisos` y con `02.pasos[*].detalles`.

---

## 7. Parar el servidor **por PID verificado**

⚠️ **NUNCA mates por patrón `node …vite`.** En esta máquina hay servidores Vite de
otros proyectos del usuario; un agente anterior mató por patrón y se llevó tres
por delante. El método correcto: **el puerto identifica el proceso, y la línea de
comandos lo confirma**.

```powershell
$p = Get-NetTCPConnection -LocalPort <PUERTO> -State Listen | Select-Object -ExpandProperty OwningProcess -Unique
$proc = Get-CimInstance Win32_Process -Filter "ProcessId = $p"
if ($proc.CommandLine -like '*vite*' -and $proc.CommandLine -like '*PROGRAMACION\GML*') {
  "verificado: $($proc.ProcessId) -> $($proc.CommandLine)"
  Stop-Process -Id $proc.ProcessId -Confirm:$false
} else {
  "NO coincide, no se mata nada: $($proc.CommandLine)"
}
```

Después, confirmar que el puerto queda libre:

```powershell
if ($null -eq (Get-NetTCPConnection -LocalPort <PUERTO> -State Listen -ErrorAction SilentlyContinue)) { "puerto libre" } else { "SIGUE ESCUCHANDO" }
```

Comprobado el 2026-07-26: matar así el Vite de este repo **no tocó** el Vite de
`E:\PROGRAMACION\Concreta EST\concreta-v2`, que siguió corriendo.

El demonio de `browse` puede quedarse vivo entre sesiones (es lo normal y lo
barato). Para cerrarlo: `$B stop`.

---

## 8. Cuándo hay que REPETIR este smoke

Este smoke **no es de una sola vez**:

- **Fase 5** — HECHO el 2026-07-26: los cuatro guiones se repitieron en las dos
  pasadas (`npm run dev` y `npx vite preview`), `ok:true` y `problemas:[]` en los
  ocho veredictos, **sin una sola discrepancia dev↔preview** y con las mismas
  cifras de §4. Lo que este smoke no puede cubrir (§0) quedó recogido en
  **`CHECKLIST-HUMANO.md`**, en esta misma carpeta: gestos de ratón reales,
  juicio visual y el 404 provocado cortando la red.
- **`base` para GitHub Pages — HECHO el 2026-07-27** (se adelantó de F16 a
  petición del usuario). `vite.config.js` fija `base: '/concretagml/'` y Vite
  reescribe solo las referencias del HTML **y las cinco fuentes del CSS**; se
  verificó que no queda **ninguna** ruta absoluta fuera del base (hay una guarda
  en el workflow que lo comprueba en cada despliegue). Los cuatro guiones
  pasaron sobre `vite preview` con el base nuevo. **Sigue pendiente de repetirse
  sobre la URL publicada** cada vez que cambie el despliegue.
- **F06**, cuando cambie la maquinaria de arrastre (historial y undo/redo,
  insertar/eliminar vértices, snap): `03-arrastre.js` mide justo esa maquinaria y
  hay que revalidarlo — en especial `marcador.reutilizado`, `filaReutilizada` y
  `cambios.numeroDeVertices`.
- **`06-generar-gml.js`, cuando cambie `gml/serialize-cp.js`, `gml/descargar.js` o
  el cableado de `cablearGeneracionGml` en `app/main.js`.** Es lo único que prueba
  la cadena Blob → descarga en un navegador de verdad: la suite de F04 corre en
  jsdom, donde `Blob`, `URL` y el anchor son dobles del entorno de test y solo se
  puede afirmar *qué se pidió*, no *qué bytes salieron*. También hay que repetirlo
  si cambian los datasets de `app/demo-datos.js` (el guion lleva copiadas sus
  cifras de arranque a propósito) o los dos selectores del contrato,
  `[data-accion="generar-gml"]` y `[data-estado="generar-gml"]`.
  HECHO el **2026-07-27**: `ok:true` y `problemas:[]` en los dos datasets sobre
  `npm run dev`; cifras en §12.
- Cuando cambie cualquiera de los **hooks semánticos** en los que se apoyan los
  guiones. Los guiones fallan a propósito si divergen, y ahí está su valor:
  - `title` del marcador (`'EXTERIOR · vértice 1'`) — `viewer/sincronizacion.js`;
  - `alt` de la capa WMS (`'Cartografía catastral del encuadre actual'`) —
    `viewer/wms-catastro.js`;
  - `nombre` de las cinco bases y su orden — `viewer/capas.js` + `services/ign.js`;
  - los cuatro literales legales — `viewer/atribucion.js` (`04` lleva una copia
    deliberada: si divergen, el smoke debe fallar);
  - clases del panel de avisos (`.gml-aviso`, `.gml-aviso-texto`) — `app/avisos.js`;
  - `data-recinto` / `data-indice` / `data-eje` de la tabla y `data-ficha` del pie
    — contrato de `viewer/sincronizacion.js` e `index.html`.

---

## 9. Limitaciones de `/browse` topadas (para quien venga detrás)

- **No hay `drag`**, y el dominio CDP `Input` no está en la allowlist
  (deny-default) ⇒ eventos sintéticos como única vía (§0).
- **30 s por comando**, no configurables (el CLI aborta el `fetch` al demonio a
  los 30 000 ms). Por eso cada guion lleva **presupuesto de tiempo** y lo declara
  en el veredicto (`abortadoPorTiempo`), en vez de morir a medias.
- `wait` y `click` **rechazan selectores que casen con varios elementos**.
- `js`/`eval` solo se auto-envuelven en un IIFE asíncrono **si el código contiene
  `await`**; entonces un fichero multilínea se envuelve en `(async()=>{…})()` y
  **el `return` de nivel superior es obligatorio** para que salga el veredicto.
  Un fichero multilínea **sin** `await` se pasa crudo a `page.evaluate` y su
  `return` sería un SyntaxError: los cuatro guiones llevan `await` real a
  propósito, y lo dicen en su cabecera. **No los quites.**
- `eval` valida la ruta contra el **cwd del demonio** (§1.3).
- Los `@eN` de `snapshot` **se invalidan al navegar** ⇒ selectores CSS en todo el
  runbook.
- `network` no da cabeceras; hacen falta `--capture` + `--export` (§5).
- Los buffers de consola y de red **son del demonio** y sobreviven a la
  navegación: son útiles como histórico de la sesión, pero hay que limpiarlos al
  empezar (`--clear`) para que la medida sea de esta corrida.
- El valor de retorno de `js`/`eval` tiene que ser **serializable a JSON**: nada
  de nodos del DOM. Y en un elemento SVG, `className` es un `SVGAnimatedString`
  que se serializa como `"[object SVGAnimatedString]"` — usa
  `getAttribute('class')`.

---

## 10. Trampas de Leaflet que los guiones ya resuelven

Documentadas aquí porque cualquiera que escriba otro guion sintético las va a
volver a pisar (todas verificadas leyendo
`node_modules/leaflet/dist/leaflet-src.js` 1.9.4 y comprobadas en navegador):

1. **`mousemove`/`mouseup` sobre `document.body`, no sobre `document`.** Leaflet
   los engancha en `document` (`Draggable._onDown`), así que basta con que
   burbujeen; pero en el primer movimiento efectivo hace
   `addClass(e.target, 'leaflet-drag-target')`, y con `e.target === document` eso
   **revienta** (`document.classList` es `undefined` → `getClass` lee
   `document.className.baseVal` de un `undefined` → TypeError) y se lleva por
   delante el arrastre entero.
2. **`button: 0`** en el `mousedown`: Leaflet exige `e.which === 1`, y el `which`
   de un `MouseEvent` sintético es `button + 1`.
3. **Varios `mousemove` crecientes**: el primero debe superar el
   `clickTolerance` (3 px, manhattan) o `_onMove` sale sin arrastrar.
4. **`Draggable._dragging` es GLOBAL**: impide que el mapa paneé mientras se
   arrastra un vértice (no hace falta `stopPropagation`), pero si un gesto se
   queda sin `mouseup` **ningún** arrastre posterior engancha. Los guiones lanzan
   un `mouseup` de saneamiento al empezar; si aun así `engancho.dragging` sale
   `false`, recarga la página.
5. **Inercia del pan del mapa**: `Map.Drag` sigue deslizando después del
   `mouseup`. Se apaga dejando **más de 50 ms** entre los dos últimos
   `mousemove` (`_prunePositions` descarta posiciones más viejas y con menos de
   dos `_onDragEnd` hace `fire('moveend')` en el acto).
6. **Pinchar sobre el polígono SÍ panea**: `path.leaflet-interactive` recibe el
   puntero, pero Leaflet no corta la propagación del `mousedown`. Y hace falta
   saberlo, porque con la parcela encuadrada **el polígono cubre todo el lienzo**
   y no queda ni un punto libre.
7. **El GIF 1×1 de `L.ImageOverlay` mide `naturalWidth = 1`**: «hay imagen
   cargada» no se puede deducir de `naturalWidth > 0` en una capa WMS; hay que
   exigir además que el `src` sea del servicio. Sin eso, «la base Catastro pinta»
   salía cierto **antes** de que llegara un solo píxel del Catastro (falso
   positivo real, detectado al probar `01` en navegador).
8. **El control de atribución une con `, `** y prefija el crédito de Leaflet con
   `<span aria-hidden="true">|</span>`: para comparar los literales legales por
   identidad hay que partir por ahí (lo hace `04`).

---

## 11. `05-salto-zoom.js` — el fundido de la imagen WMS

Guion de **diagnóstico**, añadido en la Fase 5. No cuelga de ningún criterio del
spec y **no tumba nada**: sirve para medir una cosa que solo se ve frame a frame.

### El defecto, y lo que resultó NO ser

La revisión humana reportó: «si haces pan y luego zoom in, la cartografía
catastral se mueve y luego vuelve a su sitio». La hipótesis obvia era que
`_alCargar` reposiciona la imagen (`setBounds`) antes de que el navegador pinte
el `src` nuevo, dejando el contenido viejo en la geometría nueva. Medido: **ese
frame existe, pero es UNO**, y no explica un fenómeno que dura 350–520 ms — tres
órdenes de magnitud más. Perseguirlo habría sido perder la tarde.

(Con el fundido puesto ese frame sale **0**: el reflow forzado de
`_fundirEntrada` lo elimina de paso. El guion lo sigue contando como regresión.)

Y el pan tampoco tenía nada que ver: **el zoom sin pan previo se comporta igual**
(524 ms frente a 349 ms; la diferencia es latencia de red).

### Lo que sí pasaba, medido

Al hacer zoom, Leaflet escala la imagen del encuadre anterior para mantenerla en
su sitio geográfico: `1048×900 → 2096×1800`, con el centro exactamente sobre el
del lienzo. Se queda así **350–520 ms** —lo que tarda el WMS— y la nueva la
sustituye **de golpe, en un frame y a opacidad plena**. Eso es lo que el ojo lee
como salto, agravado porque el WMS **re-rasteriza rótulos y grosores** a la
escala nueva: los textos de la imagen ampliada no están donde el servidor los
pone en la nueva.

La causa de fondo es la restricción central del proyecto (§ cabecera de
`viewer/wms-catastro.js`): **una imagen por encuadre, nunca teselas**. Pedir en
`zoomanim` en vez de en `moveend` quitaría el intervalo, pero pediría encuadres
intermedios al encadenar zooms — y el criterio 2 vale más que la suavidad.

### La corrección y cómo se comprueba

`viewer/wms-catastro.js` reparte la discontinuidad: `zoomstart` **atenúa** la
imagen visible al 35 % de la opacidad de la capa (es provisional, y lo parece), y
la imagen nueva **entra fundida** hasta la opacidad plena en {@link MS_FUNDIDO}
ms. **No toca ni una petición.**

Medido en `vite preview` con la superpuesta al 60 %:

| Medida | Antes | Después |
|---|---|---|
| Opacidad en el frame del cambio de escala | 0,60 (plena) | **0,21** |
| Frames hasta recuperar la opacidad plena | 0 (corte seco) | 7 |
| `GetMap` por encuadre | 1 | **1** (sin cambio) |

Lo que hay que ver en el veredicto: `anchoTrasElCambio` la mitad de
`anchoAntesDelCambio` (el cambio de escala sigue ahí, y debe seguir), pero
`opacidadEnElFrameDelCambioDeContenido` **claramente por debajo** de la opacidad
de la capa. Si ese número volviera a ser el de la capa, el fundido se habría
perdido y el salto estaría de vuelta.

⚠️ El fundido tiene **red de seguridad** en dos caminos que este guion no
ejercita y que sí cubre `test/viewer/wms-catastro.dom.test.js`: un encuadre
deduplicado y un fallo de carga, los dos casos en que se atenúa y **no llega
ninguna imagen** que devuelva la opacidad. Sin esa red, la capa se quedaría
tenue para siempre.

---

## 12. `06-generar-gml.js` — la cadena Blob → descarga (F04 · T7.2)

El primer guion de esta carpeta que **no cuelga de F03**. Cubre la tarea T7.2 de
**F04** y es lo ÚNICO que prueba de extremo a extremo la cadena
`Blob → URL.createObjectURL → anchor con download → click() → revokeObjectURL` en
un navegador de verdad: la suite de F04 corre en jsdom, donde `Blob`, `URL` y el
anchor son **dobles del entorno de test**, así que allí se puede afirmar *qué se
pidió* pero no *qué bytes salieron*.

### Cómo captura el fichero

`/browse` no recoge con comodidad una descarga de blob del disco, así que el
guion intercepta **en la página**, y solo durante el click:

- envuelve `URL.createObjectURL` para quedarse con el `Blob` (llama a la original
  y devuelve su URL: **la descarga real no se altera**) y lo lee con
  `blob.arrayBuffer()`;
- envuelve `URL.revokeObjectURL` para comprobar que `gml/descargar.js` cumple su
  promesa de **revocar siempre**, y la misma URL que creó;
- envuelve `document.createElement` para leer el `download` **real** del anchor
  (el nodo se retira del DOM en el mismo turno; el objeto sobrevive).

Las tres se restauran en un `finally` y el veredicto lo DECLARA
(`captura.restaurado: true`). Un guion que deja la página parcheada convierte en
mentira todo lo que se mida después de él.

### Qué mide

- **UTF-8 de verdad**: `TextDecoder('utf-8', {fatal:true})` sobre el
  `ArrayBuffer` (lanza si los bytes no son UTF-8 válido) y declaración XML que
  dice `UTF-8`. Ver la trampa de abajo.
- **`posList`**: todos los valores casan `/^-?\d+\.\d{2}$/` (incluidos los ceros
  no significativos: `4479678.00`), el nº de valores es par, `srsDimension="2"` y
  el `count` declarado son **PARES** (`valores/2`), que es el rechazo más fácil de
  cometer del proyecto.
- **Anillo cerrado**: el primer par se repite al final, en cada anillo.
- **`areaValue`**: entero, `uom="m2"`, y **cuadra con el shoelace de las
  coordenadas EMITIDAS** dentro de ±1 m². El guion calcula el shoelace él mismo
  —no importa nada del proyecto, corre dentro de la página—, así que es una
  **segunda implementación independiente** de `gml/anillos.js`.
- **Estructura del SOBRE DE ENTREGA** ⛔ *corregido el 2026-07-27*: raíz
  `gml:FeatureCollection` (namespace de GML 3.2) **con su `gml:id`** y
  `<gml:featureMember>`; los dos `srsName` en **URN**
  (`urn:ogc:def:crs:EPSG::25830`); **ni rastro del namespace de WFS 2.0** en todo
  el documento (se busca en el TEXTO: un prefijo mal declarado no aparecería como
  tal en el DOM y sí en el fichero que ve el validador); sin
  `timeStamp`/`numberMatched`/`numberReturned`; cero `gml:boundedBy` y cero
  `cp:zoning`.

  > Hasta esa fecha este apartado exigía **lo contrario** —raíz de WFS 2.0,
  > `<member>`, `srsName` en URI y «ni una `urn:`»— y daba `ok:true` sobre el
  > fichero que la Sede rechazó. Ver `spec/SPEC.md` §3.1. Un guion de humo
  > derivado del fichero equivocado no avisa: firma el error.

- **El nombre del fichero**: forma
  `parcela_<referencia>_<AAAA-MM-DDTHH-mm-ss>.gml`, segmento de referencia
  correcto (`sin-referencia` cuando no hay `refcat`) y marca de tiempo presente.
  ⚠️ **Ya no se contrasta contra el `cp:beginLifespanVersion`**: en el perfil de
  entrega ese elemento va con `xsi:nil` y vacío, como en la plantilla oficial, así
  que dentro del fichero no hay fecha con la que comparar. Lo que sí se comprueba
  es que va nil de verdad, y que el renglón de estado nombra exactamente el
  fichero que baja — que es la promesa que de verdad le importa a quien luego
  busca ese fichero en su carpeta de descargas.
- **El renglón de estado** (`[data-estado="generar-gml"]`) dice que se ha
  descargado y **nombra el fichero**, sin la clase de error.
- **Dos cruces que solo existen porque aquí hay app entera**: la superficie que el
  usuario LEE en la ficha del pie contra la que se deduce del GML descargado, y
  las detecciones del serializador contra las tarjetas del panel de avisos (regla
  de oro 1: si el fichero no es el dibujo, se dice).

### Cómo se lanza

**Dos pasadas, cada una con la página recién cargada** (el guion detecta él solo
sobre qué dataset está: lee `?demo=`):

```bash
$B goto http://localhost:PUERTO/concretagml/             # parcela REAL
$B wait ".gml-tabla-vertices"
$B eval scripts/smoke-navegador/06-generar-gml.js

$B goto "http://localhost:PUERTO/concretagml/?demo=hueco" # sintética con hueco
$B wait ".gml-tabla-vertices"
$B eval scripts/smoke-navegador/06-generar-gml.js

$B console --errors                                       # → (no console errors)
```

⚠️ **Página recién cargada, y NO detrás de `03-arrastre.js`**: `03` deja la
geometría movida a propósito y `06` contrasta el `areaValue` contra el del
dataset de arranque (`geometriaIntacta`). Si sale `geometriaIntacta: false` con la
página recién cargada, entonces sí hay regresión en `gml/` o en
`app/demo-datos.js`.

**Comprobación cruzada con evento *trusted***. El guion pulsa con
`boton.click()` sintético porque hay que envolver `createObjectURL` **antes** y
leer el Blob **después**, y `descargarGml` revoca en el mismo turno: partirlo en
tres comandos costaría un global de página y tres veredictos en prosa. El
selector es único, así que la versión con click real de Playwright es directa:

```bash
$B js "(()=>{const o=URL.createObjectURL;globalThis.__gmlBlob=null;URL.createObjectURL=function(b){globalThis.__gmlBlob=b;return o.call(URL,b)};globalThis.__gmlRestaurar=()=>{URL.createObjectURL=o};return 'envuelto'})()"
$B click '[data-accion="generar-gml"]'
$B js "globalThis.__gmlRestaurar(); const b=globalThis.__gmlBlob; return {bytes:(await b.arrayBuffer()).byteLength, tipo:b.type, renglon:document.querySelector('[data-estado=\"generar-gml\"]').textContent}"
```

Medido el 2026-07-27: `2586` bytes, `application/gml+xml;charset=utf-8` y el
mismo renglón que con el click sintético.

### Qué cuenta como «pasa»

`ok: true` y `problemas: []` en **las dos** pasadas, y además:

- `captura.blobsCapturados: 1`, `revocaLaQueCreo: true`, `restaurado: true`;
- `utf8.decodificaFatalSinLanzar: true` y `declaracionDiceUtf8: true`;
- en cada anillo: `countSonPares`, `dosDecimalesTodos` y `cerrado`, los tres
  `true`;
- `area.cuadra: true` y `area.diferenciaConLaFicha: 0`;
- `estructura.esFeatureCollectionEntrega: true`, `sinNamespaceWfs: true`,
  `srsNamesEnUrn: true`, `sinFormaDeDescarga: true`, `gmlIdRaiz` no vacío,
  `numberMatched`/`numberReturned`/`timeStamp` los tres `null`,
  `gmlBoundedBy: 0`, `cpZoning: 0`, y `interiores: 1` **solo** con `?demo=hueco`;
- `estructura.beginLifespanNil: 'true'` y `beginLifespanTexto: ''`;
- `avisos.crecio: true` con `?demo=hueco` (dos detecciones) y `false` con la
  parcela real (ninguna).

### ⚠️ La trampa que este guion documenta: la comprobación de UTF-8 es hoy VACUA

`TextDecoder('utf-8', {fatal:true})` solo puede fallar si hay algún byte no ASCII
que decodificar. **El GML que produce la app no tiene ninguno**: `app/main.js`
llama a `serializarParcelaCp` **sin `comentario`**, y el resto del documento
—namespaces, `gml:id`, coordenadas— es ASCII por construcción. Medido:
`caracteresNoAscii: 0` de 2.586 y de 2.706.

El guion **lo dice en el veredicto** (`utf8.comprobacionVacua: true` y una entrada
en `advertencias`) en vez de fingir que ha comprobado algo, y sostiene la
afirmación «este navegador escribe UTF-8» con un **CONTROL** explícito
(`utf8.control`): la cadena `áéñ·²` por el MISMO camino
(string → `Blob` → `ArrayBuffer`), contrastada contra `TextEncoder`. El control
**no es salida de la app** y el propio veredicto lo rotula así.

No es un defecto —un GML ASCII es perfectamente correcto—, es una **limitación de
la medida**. El día que el prólogo lleve un comentario acentuado (como los dos que
el WFS pone en su fichero, y que `serializarParcelaCp` ya sabe emitir), la
advertencia desaparece sola y la comprobación pasa a ser real.

### Cifras de referencia (corrida del 2026-07-27, `npm run dev`, puerto 5175)

> ⚠️ **Estas cifras son ANTERIORES a la corrección del sobre de entrega** (mismo
> día, más tarde). Las geométricas —anillos, vértices, `count`, `areaValue`,
> shoelace, superficie de la ficha— **no han cambiado**: la corrección tocó el
> envoltorio, no los números. Lo que sí cambia es el **tamaño** del fichero (el
> sobre de entrega es más corto: sin atributos de WFS, sin `endLifespanVersion` y
> sin `referencePoint`). Hay que volver a correr el guion y actualizar esa fila.

| Medida | Parcela real | `?demo=hueco` |
|---|---|---|
| Nombre del fichero | `parcela_9398516VK3799G_<marca>.gml` | `parcela_sin-referencia_<marca>.gml` |
| Tamaño | ~~2.586 B~~ *(pendiente de volver a medir)* | ~~2.706 B~~ *(pendiente)* |
| Anillos (`exterior` + `interior`) | 1 + 0 | 1 + **1** |
| Vértices abiertos / `count` | 15 / **16** | 4 / 5 y 4 / 5 |
| `cp:areaValue` | **1536** m² | **348** m² |
| Shoelace de lo emitido | 1535,87 m² (Δ 0,13) | 348,00 m² (Δ 0) |
| Superficie de la ficha del pie | 1535,87 m² (Δ **0**) | 348,00 m² (Δ **0**) |
| Sentido del exterior | horario | horario (**invertido**) |
| Detecciones → tarjetas del panel | 0 → 0 | 2 → **+2** |
| Caracteres no ASCII | **0** | **0** |
| Consola | limpia (solo `[vite] connecting…/connected.`) | ídem |
