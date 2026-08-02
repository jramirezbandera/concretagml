# Smoke en navegador real — F03 · Fase 4

Runbook de la **tarea 4D**: lo que `jsdom` no puede probar de F03. La suite
(1.855 pruebas) ya cubre la lógica; aquí se comprueba lo otro: que **el servicio
responda con el tamaño pedido**, que **el canvas quede limpio**, que la
atribución sea **visible** (jsdom no calcula layout) y que el arrastre funcione
con la **maquinaria real de `L.Draggable`**.

- **4D.1** (esta carpeta) escribió los guiones y los probó en seco.
- **4D.2** es la ejecución oficial, con evidencia, siguiendo este documento.

Diez guiones, un veredicto **serializable** cada uno (`{ok: boolean, …medidas}`),
para que el resultado no dependa de interpretar prosa. Nueve son de aceptación;
`05` es de diagnóstico (§11):

| Guion | Criterio | Mide | Veredicto pasa si |
|---|---|---|---|
| `01-capas.js` | F03 · 1 | las cinco bases conmutan y pintan; la superpuesta regula opacidad | `ok:true` |
| `02-wms-encuadre.js` | F03 · 2 | 1 `GetMap` por instancia WMS visible y por encuadre, al tamaño del lienzo | `ok:true` |
| `03-arrastre.js` | F03 · 3 | arrastrar un vértice mueve tabla + dibujo + ficha | `ok:true` |
| `04-atribucion-consola.js` | F03 · 4 y 5 | atribución literal y visible; canvas limpio; el canal de avisos llega a la UI | `ok:true` |
| `05-salto-zoom.js` | — | **diagnóstico**, no aceptación: mide frame a frame la transición de la imagen WMS al hacer zoom | ver §11 |
| `06-generar-gml.js` | F04 · T7.2 | la cadena Blob → descarga: bytes UTF-8, `posList`, `areaValue` y estructura del GML que baja | `ok:true` |
| `07-catastro-vivo.js` | F05 · T5C | **contra el servicio REAL**: CORS, IndexedDB de verdad y el recorrido entero (traer parcela · 2.ª consulta sin red · deducir la referencia) | `ok:true` |
| `08-edicion.js` | F06 · 1 a 5 | la edición con `L.Draggable` real: snap a vértice y a lindero, `Alt`, cotas contra el zoom, offset, insertar/eliminar, undo/redo y su inhibición | `ok:true` |
| `09-diagnostico.js` | F07 · 1 a 4 | el diagnóstico con SVG y layout reales: la diferencia sombreada por `fill-rule: evenodd`, el cajón que flota sin quitarle NI UN PÍXEL a la caja de vértices al abrirse, la banda del margen que conserva sus metros con el zoom y el tiempo del recálculo completo | `ok:true` |
| `10-comprobar-gml.js` | F08 · 1 a 4 · **+ los tres arreglos del check visual** | **soltar un fichero de verdad** de punta a punta (bytes reales, velo con `opacity` calculada, `File.arrayBuffer()`), el cajón que no tapa ninguno de los cinco controles del mapa, los dos cajones que no coinciden, el informe que baja con BYTES, el invariante de los ~267 px, la tipografía real de los botones de los dos cajones y —desde el 2026-08-02— **el REENCUADRE** (viaja con otra parcela, no se mueve al editar), **las COLINDANTES dibujadas** y **el CAMPO de la referencia** | `ok:true` — ver §16 |

`05` es de otra clase que los cuatro primeros: no cuelga de ningún criterio del
spec. Es el REPRODUCTOR con el que se diagnosticó el defecto que reportó la
revisión humana de la Fase 5 («al hacer zoom la cartografía se mueve y luego
vuelve a su sitio»), y se conserva porque la corrección —el fundido de
`viewer/wms-catastro.js`— solo se puede comprobar midiendo frames. Ver §11.

`06` es el primero que **no es de F03**: mide la generación del GML (F04) y va en
su propia pasada, sobre página recién cargada. Ver §12.

`08` es el de F06 y el más largo: conduce la EDICIÓN entera con gestos sintéticos
—arrastrar con y sin enganche, seleccionar un lindero, desplazarlo, insertar,
eliminar, deshacer y rehacer— y mide lo que solo existe con layout: píxeles,
`getBoundingClientRect`, `L.Draggable`, hit-testing y el zoom de verdad. **No toca
ningún servicio de datos.** Ver §14 **antes** de tocarlo: su medida del enganche
depende de una decisión (teclear τ) que hay que entender para no leerla mal.

`07` es de otra clase todavía: es el único guion de esta carpeta que **llama a un
servicio de verdad**. Cubre F05 y existe porque hay tres cosas que ni Node ni
jsdom pueden dar —**CORS**, **IndexedDB real** y el recorrido completo del
Catastro en un navegador—, y la suite de aceptación de F05 las declara por escrito
como no cubiertas y remite aquí. Tiene por eso un **régimen de uso** propio: una
pasada, sin bucles, dos peticiones en total. Ver §13 **antes** de lanzarlo.

`10` es el de F08 y el único que **mete un fichero en la aplicación**. Fabrica un
`File` con los bytes reales de un fixture —traídos por `fetch` del propio
servidor, así que **exige `npm run dev`**: `vite preview` sirve `dist/`, donde
los fixtures no están— y lo suelta sobre la ventana con un `DataTransfer`. Es
también **el único de esta carpeta que ha encontrado defectos de producción**:
en su primera corrida salió `ok:false` por **dos defectos reales**, los dos se
corrigieron con guardián, y en la segunda corrida sale `ok:true`. Las dos
corridas están en §16, y la primera no se borra: encontrarlos es su mérito.
Léete §16 **antes** de citarlo, y §0 antes que nada: el arrastre sigue sin ser
un gesto de ratón.

Y desde el **2026-08-02** `10` mide tres cosas más que **no encontró ninguna
máquina: las encontró la FIRMA HUMANA de F08** (`CHECKLIST-HUMANO.md` §9). Dos de
ellas **ni siquiera son de F08 — vienen de F03/F05** —, y las tres estaban fuera
del alcance de la suite por construcción: el reencuadre del mapa cuando entra otra
parcela, las parcelas colindantes dibujadas y el campo de la referencia catastral.
Ver §16, apartado «Los TRES defectos que encontró la firma humana». **Esto es lo
que vale el gate humano, y así hay que contarlo:** el guion encontró dos defectos
que la suite no veía, y la persona encontró otros tres que no veía ni el guion.

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
  HECHO el **2026-07-28**: `03` sigue en `ok:true` con la edición montada.
- **`08-edicion.js`, cuando cambie `viewer/edicion.js`, `viewer/acotaciones.js`,
  `viewer/barra-edicion.js` o `cablearEdicion` (`app/main.js`).** ~~O el bloque
  «Edición» de `index.html`~~: ese bloque ya no existe desde el 2026-07-29 — los
  siete nodos los fabrica la barra, y G16 exige que no vuelvan al marcado. Es lo
  único que prueba F06 con `L.Draggable`, layout y proyección reales: la suite
  corre en jsdom, donde no hay píxeles y por tanto ni el filtro de las cotas ni el
  hit-testing significan nada. Hay que repetirlo también si cambian `edit/snap.js`
  (el guion deriva el desenlace del enganche de la política de `dianasDe`),
  `edit/offset.js` (mide el desplazamiento real sobre la tabla y espera la
  detección del guard de paralelismo en el panel), `OPERATIVOS.acotacionMinimaPx`
  o `snapMetros`, o `app/demo-datos.js` (de ahí salen los 15 vértices y los
  1.535,87 m² con los que comprueba que la página está recién cargada). Ver §14.
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
- **`07-catastro-vivo.js`, cuando cambie `services/catastro.js`,
  `app/cableado-catastro.js` o el marcado del bloque de F05 en `index.html`.** Es
  lo único que prueba F05 contra el servicio real y en un navegador: la suite
  corre con el `fetch` doblado y con `fake-indexeddb`, así que allí no hay ni CORS
  ni almacenamiento de verdad. Hay que repetirlo también si cambian
  `services/_red.js` (cola, plazo, backoff: el guion cuenta las peticiones y una
  petición de más es un reintento que el Catastro no debe recibir),
  `storage/bd.js` o `storage/cache-catastro.js` (el guion abre la base por su
  nombre, lee sus dos almacenes por su `keyPath` y deriva las expectativas del
  TTL), o `app/demo-datos.js` (de ahí salen la referencia que se teclea y la
  geometría contra la que se contrasta lo que llega).
  ⚠️ **Antes de repetirlo, léete el régimen de uso de §13**: llama al servicio de
  verdad y la denegación por abuso es de ~10 días.
  HECHO el **2026-07-28**: `ok:true` y `problemas:[]` en los dos recorridos sobre
  `vite preview`, con **2 peticiones en total**; cifras en §13.
- **`10-comprobar-gml.js`, cuando cambie cualquier pieza del recorrido de F08.**
  Es lo único que prueba la entrada por fichero de punta a punta en un navegador
  de verdad: la suite corre en jsdom, donde no hay `DataTransfer`, ni bytes de
  fichero, ni `opacity` calculada, ni áreas de solape entre controles de Leaflet.
  Los disparadores, por lo que cada uno rompería:
  - `app/zona-fichero.js` (el `preventDefault` del `dragover`, el contador de
    profundidad, el velo, el reseteo del `value`) y `app/cableado-comprobacion.js`
    (el recorrido entero, la procedencia doble y el cierre de los dos cajones);
  - `viewer/cajon-comprobacion.js` y `viewer/cajon-diagnostico.js` — **los dos**:
    comparten la esquina `bottomleft` y el guion mide que no coincidan y que
    ninguno tape los cinco controles del mapa. También su tipografía;
  - `gml/decodificar.js` (el rótulo «declara «ISO-8859-1», leído como «utf-8»» es
    salida suya) y `comprobacion/gml.js` (las notas, los hallazgos y
    `puedeContinuar`);
  - `report/contraste-texto.js` y `gml/descargar.js#descargarTexto` — el guion
    afirma el TÍTULO LEGAL del informe, que desmienta ser la VGA/IVG, que diga
    que es provisional, y que los bytes bajen y la URL de blob se revoque;
  - `estilos/app.css`, tramo de F08: el cromo del cajón, el velo de arrastre y la
    regla de tipografía de los botones de los dos cajones;
  - `index.html` (la fila del rótulo con `[data-accion="abrir-gml"]`: la Decisión
    5 es que ese botón cueste 0 px a la tabla de vértices) y `app/main.js` paso 9;
  - los **fixtures** `test/fixtures/gml/cp_parcela_9398516VK3799G.gml` y
    `test/fixtures/gml/derivados/cp_huso_incoherente.gml`, que el guion trae por
    `fetch` del propio servidor y de los que deriva sus expectativas (2.878 y
    3.167 bytes, 15 vértices, 1536 m² declarados, EPSG:25830 y EPSG:25829);
  - y los **selectores del contrato**, que el guion lleva copiados a propósito:
    `[data-accion="abrir-gml"]`, `[data-accion="contrastar-parcelario"]`,
    `[data-accion="descartar-comprobacion"]`, `[data-estado="cajon-comprobacion"]`
    y los `[data-comp="…"]` que EXPORTA `viewer/cajon-comprobacion.js#SELECTOR`,
    más `[data-accion="descargar-informe"]` y `[data-estado="informe-contraste"]`
    de `viewer/cajon-diagnostico.js#SELECTOR`, `.gml-soltar-superposicion` y
    `.gml-zona-fichero-input` de `app/zona-fichero.js`, y `[data-procedencia="parcela"]`.
  - **Desde el 2026-08-02 mide además los tres arreglos de la firma humana**, y
    con ellos entran cuatro disparadores más — dos de los cuales **no son de F08**:
    - **`viewer/index.js`, paso 7 (el REENCUADRE VIVO) y `claveDeParcela`.** Es lo
      único que prueba en un navegador que el mapa **viaja** cuando entra otra
      parcela y que **no se mueve al editar**. Ojo con la gemela declarada:
      `app/cableado-diagnostico.js#claveDeExpediente` usa la MISMA clave
      (`refcat ?? idLocal`) y las dos copias se nombran entre sí; si cambia una,
      cambia la otra y hay que repetir esto.
    - **`viewer/colindantes.js`, `PANE.COLINDANTES`/`PANES` de `viewer/_comun.js`
      y el tercer suscriptor de `alColindantes` en `app/main.js`.** El guion afirma
      el pane **405**, que está **por debajo** de `parcelaOficial` (410), el color y
      el grosor del contorno, el emergente y —lo que de verdad importa— que la capa
      interactiva **no le roba el clic al mapa**.
    - **`app/cableado-catastro.js#puedeDeducirDe` y `puedePedirColindantesDe`.** De
      ahí sale la coherencia campo ↔ botones que mide `campoRefcat`: si cambia
      cuándo se enciende «Deducir del mapa» o «Traer colindantes», el guion se pone
      rojo con razón.
    - **el fixture `test/fixtures/gml/UTM_1.gml`**, que el guion trae por `fetch` y
      del que deriva sus expectativas (3.450 B, 11 vértices, **sin** referencia
      catastral, otra parcela a ~414 km). Es el único fichero de la carpeta con una
      parcela **distinta** de la de arranque, y sin él el reencuadre no se puede
      medir.
  ⚠️ Antes de repetirlo, léete el régimen de uso de §13 (llama al servicio real)
  y el §16 entero.
  HECHO **dos veces el 2026-07-30**: la primera dio `ok:`**`false`** con **2
  defectos reales destapados** y todo lo demás como se esperaba; corregidos los
  dos en producción y con guardián en la suite, la **segunda** dio
  `ok:`**`true`** con `problemas: []` **y `advertencias: []`**, en pasada en
  FRÍO. Cifras de las dos y los defectos, en §16.
  HECHO **una tercera vez el 2026-08-02**, ya con las tres medidas de la firma
  humana dentro: `ok:`**`true`**, `problemas: []` y `advertencias: []`, en frío,
  con 2 peticiones y consola limpia. **Ninguna de las cifras anteriores se movió.**
  Cifras nuevas en §16.
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
  - los SEIS selectores del bloque de F05 (`data-campo="refcat"`,
    `data-accion="cargar-catastro"`, `data-accion="deducir-refcat"`,
    `data-estado="cargar-catastro"`, `data-procedencia="parcela"`,
    `data-candidatos="refcat"`) — los EXPORTA `app/cableado-catastro.js` y `07`
    lleva copia deliberada;
  - `ROTULO_DEDUCIDA` de `app/cableado-catastro.js` y el eyebrow «Parcela del
    Catastro» de `app/main.js` — `07` los compara por identidad;
  - `concreta-gml` / `catastroCache` / `revgeo` y los prefijos `parcela:` y
    `revgeo:` — `storage/bd.js` y `storage/cache-catastro.js`.

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

### Cifras de referencia (remedidas el 2026-07-28 sobre `vite preview`, puerto 4190)

> ✅ **Cifras del sobre de ENTREGA ya corregido.** Las anteriores (del 2026-07-27,
> por la mañana) eran del sobre de la *descarga* del WFS, que es el que la Sede
> rechazó. Las geométricas —anillos, vértices, `count`, `areaValue`, shoelace,
> superficie de la ficha— **no cambiaron**: la corrección tocó el envoltorio, no
> los números. Lo que sí cambió es el **tamaño**, y la medida lo confirma:
> **−388 B** en la parcela real y **−434 B** en la sintética, que es lo que pesan
> los atributos de WFS, el `endLifespanVersion` y el `referencePoint` que el
> perfil de entrega no emite.
>
> Las dos pasadas: `ok:true`, `problemas: []`, consola sin un mensaje, sobre de
> entrega confirmado (`esFeatureCollectionEntrega`, `sinNamespaceWfs`,
> `srsNamesEnUrn`) y `area.diferenciaConLaFicha: 0`.

| Medida | Parcela real | `?demo=hueco` |
|---|---|---|
| Nombre del fichero | `parcela_9398516VK3799G_<marca>.gml` | `parcela_sin-referencia_<marca>.gml` |
| Tamaño | **2.198 B** *(antes del sobre de entrega: 2.586)* | **2.272 B** *(antes: 2.706)* |
| Anillos (`exterior` + `interior`) | 1 + 0 | 1 + **1** |
| Vértices abiertos / `count` | 15 / **16** | 4 / 5 y 4 / 5 |
| `cp:areaValue` | **1536** m² | **348** m² |
| Shoelace de lo emitido | 1535,87 m² (Δ 0,13) | 348,00 m² (Δ 0) |
| Superficie de la ficha del pie | 1535,87 m² (Δ **0**) | 348,00 m² (Δ **0**) |
| Sentido del exterior | horario | horario (**invertido**) |
| Detecciones → tarjetas del panel | 0 → 0 | 2 → **+2** |
| Caracteres no ASCII | **0** | **0** |
| Consola | limpia | ídem |

---

## 13. `07-catastro-vivo.js` — el Catastro de verdad (F05 · T5C)

El único guion de esta carpeta que **habla con un servicio real**. Lee esta
sección entera antes de lanzarlo: tiene régimen de uso, y no es una formalidad.

### ⚠️ Régimen de uso — lo primero, porque manda sobre todo lo demás

La política del Catastro contempla la **denegación de servicio durante ~10 días**
ante uso automático, con detección de rotación de IP/UA (override O8 de
`spec/SPEC.md`; la cifra de «3.600 peticiones/h» que circula en el plan v4 **no
tiene fuente oficial** y no se cita).

- **Una pasada, sin bucles y sin reintentos propios.** El guion no reintenta
  nada: el transporte (`services/_red.js`) ya trae cola de 2, plazo de 15 s y
  backoff con jitter, y duplicar esa política desde arriba es exactamente cómo se
  acaba pareciendo un raspador.
- **Coste medido de una pasada completa: 2 peticiones.** Una al WFS
  (`wfsCP.aspx`, pasada de carga) y una al OVC (`Consulta_RCCOOR`, pasada de
  deducción). Las segundas pulsaciones de cada pasada valen **cero**, y ese cero
  es justamente lo que se mide.
- **Para depurar, la caché es la amiga.** Repetir el guion sin borrar la base
  cuesta **0 peticiones**: el guion lo detecta solo (`cachePartiaCaliente: true`),
  deriva `esperadasPrimeraConsulta: 0` y sigue saliendo `ok:true`. Lo único que se
  pierde es la medida de CORS, y el veredicto lo dice
  (`cors.medidoEnEstaPasada: false` + una entrada en `advertencias`). **Repite
  cuantas veces quieras en ese modo; solo vuelve a frío cuando de verdad haga
  falta.**

### Las tres cosas que solo se pueden medir aquí

1. **CORS.** Ni Node ni jsdom aplican la política de mismo origen: en los dos, un
   `fetch` cross-origin sale sin que nadie mire `Access-Control-Allow-Origin`. La
   suite de aceptación de F05 (`test/services/aceptacion-f05.test.js`) lo declara
   con todas las letras como **no cubierto por ningún test offline** y remite
   aquí.
   ⚠️ **La cabecera no se puede leer desde script** —no está entre las expuestas;
   el navegador la consume para decidir y luego la esconde—, así que el guion
   **no finge leerla** (`cors.acaoLegibleDesdeScript: false`). Lo que mide es su
   EFECTO, por dos caminos: que el CUERPO del servicio cruzó la frontera de
   origen y es legible (se lee del registro que queda en IndexedDB, que guarda el
   texto crudo), y que el desenlace en la UI es «Cargada la parcela …» y no el
   mensaje de `SIN_RED` — que es como se manifiesta un CORS roto, porque el
   navegador da el mismo `TypeError` que estando sin red.
   Para **ver** la cabecera hace falta salir del navegador:
   `npm run catastro:vivo` (`scripts/sonda-catastro.mjs`, en Node). Las dos
   medidas son complementarias: la sonda ve la cabecera pero no prueba CORS
   (Node no lo aplica), y el guion prueba CORS pero no ve la cabecera.
2. **IndexedDB de verdad.** La suite usa `fake-indexeddb`. Aquí se abre la base
   real (`concreta-gml`) **en solo lectura y solo si ya existe** —se consulta
   antes `indexedDB.databases()`, porque `indexedDB.open()` sobre una base que no
   está la CREA vacía y sin los almacenes de la escalera de `storage/bd.js`— y se
   comprueba que la parcela quedó guardada, con qué bytes y con qué antigüedad.
   La conexión se cierra siempre (`cache.conexionCerrada`).
3. **El recorrido completo**: teclear → «Traer del Catastro» → parcela dibujada,
   ficha rellena, eyebrow en «Parcela del Catastro» → segunda pulsación servida
   desde la copia local **sin una sola petición** → y, en la otra pasada,
   «Deducir del mapa» → el campo con la referencia deducida.

### Cómo se lanza

**Dos pasadas, cada una con la página recién cargada.** El guion **no lee
`?demo=`**: elige el recorrido por el ESTADO —si la parcela de arranque trae
referencia catastral no hay nada que deducir—, que es exactamente la condición
con la que `cableado-catastro.js#puedeDeducirDe` habilita el botón. Así mide la
regla, no el parámetro.

```bash
$B goto http://localhost:PUERTO/concretagml/              # recorrido «carga»
$B wait ".gml-tabla-vertices"
$B eval scripts/smoke-navegador/07-catastro-vivo.js

$B goto "http://localhost:PUERTO/concretagml/?demo=hueco" # recorrido «deducción»
$B wait ".gml-tabla-vertices"
$B eval scripts/smoke-navegador/07-catastro-vivo.js

$B console --errors                                       # → (no console errors)
$B network | grep -E "wfsCP|Consulta_RCCOOR"              # → dos líneas, las dos 200
```

Para forzar una pasada **en frío** (la única que mide CORS), borrar la base y
recargar. El `deleteDatabase` queda BLOQUEADO mientras la app tiene la conexión
abierta, así que el orden importa:

```bash
$B js "await new Promise(r=>{const p=indexedDB.deleteDatabase('concreta-gml');p.onsuccess=r;p.onerror=r;p.onblocked=r}); return 'pedido'"
$B reload && $B wait ".gml-tabla-vertices"
```

⚠️ **No lo encadenes detrás de `03-arrastre.js`** (deja la geometría movida) ni de
`01-capas.js`. Con `06` sí convive: `06` no toca la geometría, pero **ponlo
antes**, porque `07` sustituye la parcela de demostración por la que traiga el
Catastro y `06` contrasta el `areaValue` contra el dataset de arranque.

### Qué cuenta como «pasa»

`ok: true` y `problemas: []` en **las dos** pasadas, y además:

- `peticionesGastadas: 1` en cada pasada **en frío**, y **0** con la caché
  caliente (en el recorrido «carga» eso se ve además en `cachePartiaCaliente:
  true` y `esperadasPrimeraConsulta: 0`);
- `consultas[0].peticiones.length === esperadasPrimeraConsulta` y
  **`consultas[1].peticiones.length === 0`** — el cero es el criterio de
  aceptación 1 de F05 medido donde vale;
- `consultas[*].bloqueoDuranteLaConsulta: true` (los botones se apagan mientras
  hay algo en vuelo: es cortesía, no la garantía, pero su ausencia es un defecto);
- en la pasada de carga: `registroEnCache.esColeccionWfs: true` y
  `esExcepcionWfs: false`; `pantallaTrasLa1.campo` en la forma **canónica**
  (se teclea en minúsculas a propósito); `eyebrow: "Parcela del Catastro"`;
  `pantallaTrasLa2.procedencia` diciendo «copia local»; `avisos.pesoTrasLa2 >
  pesoTrasLa1`; y `botonDeducirDeshabilitado: true` (con referencia ya no hay
  nada que deducir);
- en la pasada de deducción: `punto.dentroDeLaParcela: true` (comprobado con un
  lanzamiento de rayo escrito en el propio guion sobre los anillos leídos de la
  tabla — segunda implementación de `gml/anillos.js#puntoInterior`),
  `punto.srsConsultado === srs`, y la **rama** coherente con lo que el servicio
  contestó de verdad (`respuestaDelServicio`, leído del almacén `revgeo`):
  `UNICO` ⇒ campo relleno, lista oculta y `procedencia` con el rótulo de
  deducida; `VARIOS` ⇒ campo INTACTO y lista visible con un botón por candidato;
- `cors.medidoEnEstaPasada: true` al menos en una de las dos pasadas en frío;
- `captura.fetchRestaurado: true` y `cache.conexionCerrada: true`;
- `abortadoPorTiempo: false`.

`advertencias` **no** tumba nada: recoge lo que limita la medida (caché ya
caliente, geometría que ha cambiado respecto al fixture, el OVC diciendo que ahí
no hay parcela).

### ⚠️ La trampa que este guion NO se puede saltar: el error llega con HTTP 200

Medido el 2026-07-27 en las 8 respuestas de
`test/fixtures/catastro/PROCEDENCIA.md`: **las buenas y las malas, todas
`HTTP/1.1 200 OK`.** Es el mismo hecho que §6 anota para el WMS, y aquí es
central: `$B network` mostrará `→ 200` en las dos peticiones **también el día que
el servicio conteste un `ExceptionReport`**. Por eso el guion cuenta las
peticiones **y lo que traían**:

- `responseStatus` de cada entrada de Resource Timing (es lo único que el
  navegador expone de una respuesta cross-origin sin `Timing-Allow-Origin`;
  `transferSize` y `encodedBodySize` **vienen a 0** y el veredicto lo dice para
  que nadie los lea como «respuesta vacía»);
- el **cuerpo**, leído del registro de IndexedDB: `FeatureCollection` sí,
  `ExceptionReport` no;
- y el desenlace en la UI: renglón sin la clase de error, ficha rellena, panel de
  avisos sin crecer.

### Por qué NO envuelve `fetch` (y por qué eso está MEDIDO, no afirmado)

Lo obvio, viniendo de `06`, sería envolver `URL.createObjectURL`… o aquí
`window.fetch`. **No funciona**: `app/main.js` crea el transporte al arrancar y
`services/_red.js#crearTransporte` captura `globalThis.fetch` en ese momento
(`const { fetch: fetchDe = globalThis.fetch } = opciones`), así que envolverlo
después es invisible para él. El guion pone igualmente un envoltorio-**contador**
que llama a la original y no cambia nada, y publica
`captura.llamadasVistasPorElEnvoltorio: 0` para que el siguiente no pierda la
tarde en ese callejón. Se restaura en un `finally`, como todo lo que este guion
toca (que son dos cosas: ese contador y su conexión a IndexedDB).

### Cifras de referencia (corrida del 2026-07-28, `vite preview`, puerto 4183)

Dos pasadas en frío (base borrada) y dos con la caché caliente. **Cuatro
peticiones al servicio en toda la sesión.**

| Medida | Recorrido «carga» | Recorrido «deducción» (`?demo=hueco`) |
|---|---|---|
| Peticiones a servicios de datos | **1** (WFS `GetParcel`) | **1** (OVC `Consulta_RCCOOR`) |
| Estado HTTP | 200 | 200 |
| Latencia de la petición | **49 – 2.393 ms** | **223 – 764 ms** |
| Duración del guion | 484 – 2.845 ms | 667 – 1.215 ms |
| 2.ª pulsación | **0 peticiones**, 241 ms | **0 peticiones**, 241 ms |
| Bytes guardados en IndexedDB | 2.876 (cuerpo GML crudo) | POJO `{cuantos:1, unico:true}` |
| Clave de caché | `parcela:EPSG:25830:9398516VK3799G` | `revgeo:EPSG:25830:439305:4479658` |
| Punto consultado | — | `[439304.5, 4479658]`, **dentro** |
| Respuesta del servicio | `FeatureCollection`, 15 vértices | `9398515VK3799G` · CL SAN RESTITUTO 72(A) MADRID |
| Geometría vs. el dataset de demostración | **idéntica** (desviación 0,000 m) | — |
| Con la caché caliente | 0 peticiones, `ok:true` | 0 peticiones, `ok:true` |
| Consola | limpia | limpia |

⚠️ La horquilla de latencia no es ruido de medida: **la primera petición de la
sesión pagó el saludo TLS** (2.393 ms el WFS, 764 ms el OVC) y las siguientes,
sobre la conexión ya abierta, bajaron a 49 y 223 ms. Es el mismo fenómeno que
`test/fixtures/catastro/PROCEDENCIA.md` anota para el OVC («cada llamada abre
sesión ASP.NET nueva»). Si alguien viene a apretar el `TOPE_RED_MS` del guion,
que lo haga contra los 2,4 s, no contra los 50 ms.

La fila de la geometría merece una nota: el dataset de `app/demo-datos.js` se
derivó del fixture de **esa misma parcela**, así que una desviación de 0 m
significa que lo que el Catastro está sirviendo hoy coincide vértice a vértice
con lo que sirvió el día de la captura. Si algún día difiere, el guion lo dice
como **advertencia** y no como fallo: la verdad externa puede cambiar, y quien
tiene que decidir qué hacer con eso es una persona.

Y una observación que salió de correrlo con la caché caliente, y que el guion
publica: con el punto ya cacheado no hay URL de la que leer las coordenadas
consultadas, así que la comprobación de «el punto cae dentro de la parcela» se
vuelve **circular** (el registro se localiza precisamente por caer dentro). El
guion lo marca con `punto.comprobacionVacua: true` y una advertencia, en vez de
apuntarse una comprobación que no ha hecho — mismo criterio que
`06.utf8.comprobacionVacua`.

---

## 14. `08-edicion.js` — la edición con `L.Draggable` real (F06 · T6.2)

El guion de F06, y el más largo de la carpeta: conduce las cinco operaciones de la
fase de punta a punta. Lee esta sección antes de tocarlo o de citarlo — la medida
del enganche descansa en dos decisiones que hay que entender para no leerla mal.

> ⚠️ **2026-07-29 · los controles se mudaron del panel al mapa.** Los siete nodos
> que este guion conduce (`[data-campo="snap-tolerancia"]` y compañía) ya no salen
> de `index.html`: los fabrica `viewer/barra-edicion.js`, la barra flotante que
> `crearVisor` monta cuando `edicion.barra` (cierta por defecto). **Los selectores
> NO han cambiado** —ese era el objetivo del traslado—, así que el guion sigue
> valiendo tal cual y no hace falta abrir ningún desplegable para escribir en los
> campos: existen siempre en el DOM y solo se ocultan con `hidden`. Lo que sí
> cambió son dos cifras de referencia (abajo) y lo que mide el apartado 10.

### Qué mide, y por qué NO lo mide la suite

La suite (2.894 pruebas) ya cubre la geometría: que `desplazarLado` recalcule los
contiguos, que `ajustar` priorice el vértice, que `insertarVertice` proyecte sobre
el lado. **Aquí no se vuelve a medir nada de eso.** Lo que este guion añade es lo
que solo existe con un navegador delante:

1. **El snap con `L.Draggable` de verdad.** Tres arrastres sobre el vértice 1 del
   EXTERIOR: enganche a **VÉRTICE** (la coordenada que acaba en la tabla es la del
   vértice oficial, no la del puntero, y el marcador VUELVE a su píxel de partida),
   enganche a **LINDERO** (la coordenada commiteada cae *sobre* la recta del
   lindero oficial: producto vectorial ≈ 0) y **con `Alt`** (ni engancha ni pinta
   indicador). El indicador `.gml-snap--vertice` / `.gml-snap--lindero` se cuenta
   **fotograma a fotograma**.
2. **Las cotas contra el zoom real.** El filtro de `viewer/acotaciones.js` es por
   PÍXELES (`OPERATIVOS.acotacionMinimaPx` = 44), o sea que en jsdom no significa
   nada. Se cuentan los rótulos visibles a tres escalas MEDIDAS y se exige que
   suban al acercar, bajen al alejar y **vuelvan al mismo número** al deshacer el
   zoom.
3. **El offset sobre la pantalla**: se selecciona el lindero con un clic en el
   punto medio real entre dos marcadores, se teclea la distancia, se pulsa, y se
   mide sobre las coordenadas de la tabla **cuánto se ha movido de verdad**.
4. **Insertar y eliminar** con doble clic y clic derecho, con sus dos
   `preventDefault` (ni menú del navegador ni zoom) y con la escala del mapa
   inalterada.
5. **Undo/redo y su INHIBICIÓN**, que es lo que más fácil se rompe: `Ctrl+Z` con el
   foco en el mapa deshace **y consume la tecla**; con el foco en una celda de
   coordenada **no deshace y no la consume**. `defaultPrevented` es la única señal
   observable de esa diferencia.
6. **Las métricas en vivo**: superficie y perímetro leídos de la ficha en cada
   fotograma de `drag`, **antes** del `mouseup`. Y al soltar, las dos cifras se
   contrastan contra un shoelace y una suma de lados calculados dentro de la
   página — segunda implementación independiente de `geo/area.js` y
   `geo/metrica.js`, igual que hace `06` con el `areaValue`.

Y dos **hit-tests reales** con `document.elementFromPoint`, que es lo más cerca que
se puede estar de un puntero sin tenerlo: sobre el centro de un vértice responde su
marcador (se comprueba por el `title`, y ojo: el icono es un `divIcon` y el nodo
que devuelve el navegador es el `<span>` de dentro, así que se resuelve con
`closest`), y sobre el punto medio de un lado responde el `<path>` **y no la
cota** — que va `interactive:false` justo para eso.

### ⚠️ Las dos decisiones que hay que entender antes de leer el veredicto

**1 · El enganche se mide con τ tecleada a 300 cm, no con los 20 cm de
producción.** A la escala de arranque (16,19 px/m, medida) 20 cm son **3,24 px**, y
`MouseEvent.clientX` es un entero: la resolución del gesto (1 px ≈ 6 cm) es un
tercio de la tolerancia, así que «enganchó» y «no enganchó» no se distinguirían de
un redondeo. El guion escribe 300 en `[data-campo="snap-tolerancia"]` —lo que de
paso ejercita en un navegador la conversión cm→m del campo, que es contrato de
F06— y **restaura los 20 al terminar** (`restaurado.toleranciaEsLaDeArranque`). τ
es un parámetro del MISMO camino de código: lo que aporta el navegador
—`L.Draggable`, el re-ajuste del `dragend`, el indicador, la tecla— no depende de
su valor, y el ajuste fino de τ es de `test/edit/snap.test.js`.

**2 · La diana del enganche es la `geometriaOficial` de la parcela de
demostración.** `app/demo-datos.js#parcelaDemo` carga el mismo anillo en `recintos`
y en `geometriaOficial` —que es el estado real de una parcela recién traída del
Catastro— y `edit/snap.js#dianasDe` documenta que **`excluir` no se aplica a
`geometriaOficial`**: el vértice oficial sigue siendo diana legítima aunque se esté
arrastrando su gemelo editable. La consecuencia («un desplazamiento menor que τ
vuelve al sitio») la declara el propio módulo como lo que el snap SIGNIFICA. Eso da
un desenlace binario y sin ambigüedad sin traer ni una parcela vecina — y por tanto
**sin gastar ni una petición**.

### Régimen de red: NINGUNA petición a los servicios de datos

A diferencia de `07`, este guion **no habla con el WFS ni con el OVC**. El **snap a
colindantes queda declarado como NO CUBIERTO** en el propio veredicto
(`noCubierto`), porque traerlas cuesta una petición y manda el override O8 (§13).
Lo único que sale a la red es la cartografía de fondo, que se repide sola al hacer
zoom igual que en `01`, `02` y `05`. Se comprueba así:

```bash
$B network | grep -E "wfsCP|Consulta_RCCOOR"     # → sin resultados
```

### Cómo se lanza

**Página recién cargada y sobre la parcela REAL** (sin `?demo=`). El guion lo
comprueba él mismo (`paginaRecienCargada`, contra los 15 vértices y los 1.535,87 m²
de arranque) y lo dice antes que nada si no se cumple:

```bash
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/
$B wait ".gml-tabla-vertices"
$B console --clear
$B eval scripts/smoke-navegador/08-edicion.js

$B console --errors                              # → (no console errors)
```

Con `?demo=hueco` sale `ok:false` diciendo por qué: ese dataset es sintético, no
trae `geometriaOficial` y el criterio 2 no se podría medir.

⚠️ **Orden.** El guion deja la geometría **modificada a propósito** (un lindero
desplazado 0,50 m), como `03`, para que la evidencia se vea en una captura. Lo que
sí restaura —y lo declara en `restaurado`— es la **tolerancia**, el **zoom** y la
bandera de **`Alt`**. No lo encadenes antes de `06-generar-gml.js` (contrasta el
`areaValue` contra el dataset de arranque) ni de `02-wms-encuadre.js` (el zoom le
contamina la cuenta de `GetMap`). Para repetirlo:
`$B reload && $B wait ".gml-tabla-vertices"`.

**Comprobación cruzada con eventos *trusted***. El guion navega el historial con el
atajo de teclado, que es el camino que puede romper la inhibición del foco. Los dos
botones se comprueban aparte, con clicks de verdad de Playwright:

```bash
$B is enabled '[data-accion="deshacer"]'         # → true (hay historial)
$B click '[data-accion="deshacer"]'
$B js "document.querySelector('[data-estado=\"edicion\"]').textContent"
$B click '[data-accion="rehacer"]'
```

Medido el 2026-07-28: «Deshecha la última operación.» / «Rehecha la operación
siguiente.», con la tabla pasando de 15 a 16 filas y de vuelta — o sea que los
botones navegan las mismas operaciones que los atajos.

### Qué cuenta como «pasa»

`ok: true` y `problemas: []`, y además:

- `paginaRecienCargada: true` y `arranque.escalaCoherente: true` (la escala medida
  entre dos pares de marcadores distintos coincide; sin eso ninguna medida vale).
- `hitTest.respondeElMarcador: true` con el `title` esperado, y
  `hitTest.ladoAtrapadoPorLaCota: false`.
- `acotaciones`: `bajanAlAlejar`, `subenAlAcercar`, `reversible` y `domEstable`,
  los cuatro `true`.
- `engancheVertice.desviacionDelOficialM: 0`, `marcadorVuelveAlOrigen: true`,
  `indicadorTrasSoltar: null` y `VERTICE` en los cuatro fotogramas.
- `engancheLindero.fueraDeLaRectaM: 0` con `LINDERO` en los últimos fotogramas.
- `sinEnganche.indicadoresPorFotograma` todo `null` y `desviacionM` ≈ 0 (la
  coordenada final ES la del puntero, traducida con la escala medida).
- `historial`: las tres desviaciones a 0 y `prevenido: true` en las tres teclas;
  `inhibicion.prevenido: `**`false`** (esa es al revés a propósito).
- `enVivo.superficieSeMuevePorFotograma` y `perimetroSeMuevePorFotograma` los dos
  `true`, y `cambioAntesDeSoltar: true`.
- `offset.desplazamientoMedidoM` = lo tecleado, `filasAntes === filasDespues` y
  `offset.avisos.crecio: true` (ver la nota de abajo).
- `insertar.dobleClicPrevenido`, `insertar.zoomIntacto`,
  `eliminar.menuDelNavegadorPrevenido` y `eliminar.anilloVuelveAlDeAntes`.
- `restaurado.toleranciaEsLaDeArranque` y `restaurado.zoomComoAlArrancar`.
- `panel.barra` con sus dos medidas, y `panel.altoBloqueEdicionPx: `**`null`** — ese
  `null` es el desenlace bueno: significa que el bloque «Edición» sigue fuera de
  `index.html`. Si volviera a dar un número, la barra estaría duplicada y muerta
  (G16 se pondría rojo antes, en la suite).

`advertencias` **no** tumba nada: recoge lo que limita la medida.

### Dos cosas que este guion dejó a la vista, y que no son fallos

**El renglón no anuncia insertar ni eliminar.** El comentario de quien lo fabrica
—`viewer/barra-edicion.js` desde el 2026-07-29; antes, `index.html`—
describe `[data-estado="edicion"]` como «el desenlace de deshacer, rehacer,
insertar, eliminar y desplazar», y de esos cinco solo tres lo escriben: los dos
gestos del mapa viven en `viewer/edicion.js`, que solo habla cuando la operación
**no** se aplica (nadie en `app/` llama a `insertarEn` ni a `eliminar`). La
operación sí es visible —aparece el vértice, crece la tabla, cambia el recuento de
la ficha—, así que **no es un error silencioso**; es una promesa del marcado que el
cableado no ata. El guion lo MIDE (`anuncios.anunciaLaInsercion: false`) y lo deja
en `advertencias`: decidirlo es del checklist humano (§7.5), no de un smoke.

**Desplazar el lindero 1 de este dataset SIEMPRE degrada, y eso se comprueba.**
Sus dos lados contiguos son casi su prolongación (**0,03°**, medido por el propio
`edit/offset.js`), así que no hay punto de corte donde apoyar la intersección y
salta el guard de paralelismo. La operación se aplica igual —el lindero se mueve
los 0,50 m pedidos, y el guion lo verifica sobre las coordenadas— pero
**degradada**, y el panel de avisos tiene que decirlo: por eso
`offset.avisos.crecio: true` es condición de paso. Es la regla de oro 1 aplicada al
gesto más usado de la fase. Si alguna vez ese aviso desaparece, o el offset empieza
a **añadir** un vértice (el fallback de bisel), el guion falla y explica las dos
lecturas posibles.

### Cifras de referencia (corrida en seco de T6.2, **2026-07-28**, revisada el **2026-07-29** tras el traslado a la barra, `npm run dev`)

Sirven para detectar una desviación, no como valores canónicos. Viewport 1440×900,
lienzo 1048×900, duración del guion **6,2 s**, consola limpia, **5 `GetMap`** al
WMS (1 de carga + 4 encuadres del zoom) y **cero** peticiones a servicios de datos.
Todas las cifras de abajo se han vuelto a medir el 2026-07-29 y **solo cambian las
dos últimas filas**: el traslado fue un cambio de vista, no de mecánica.

| Medida | Valor |
|---|---|
| Escala en el encuadre de arranque | **16,19 px/m** (`escalaCoherente: true`) |
| τ de producción (20 cm) a esa escala | **3,24 px** ← por eso se mide con 300 cm |
| Cotas: en el DOM / visibles a Z | 15 / **11** (umbral 44 px = 2,72 m) |
| Cotas visibles a Z−2 (4,05 px/m) | **6** (umbral = 10,87 m) |
| Cotas visibles a Z+2 (64,72 px/m) | **14** (umbral = 0,68 m) |
| Al volver a Z | **11** otra vez |
| Enganche a VÉRTICE: desviación del oficial | **0,0000 m** (con el puntero a 23 px) |
| Enganche a LINDERO: fuera de la recta / avance | **0,0000 m** / 5,013 m |
| Con `Alt`: coordenada vs. puntero previsto | **0,008 m** (y 3,33 m del oficial) |
| Undo · redo · undo: desviación | **0 · 0 · 0 m** |
| `Ctrl+Z` en el mapa / en una celda | `prevenido: true` / **`false`** |
| Superficie por fotograma (arrastre con `Alt`) | 1.539,29 → 1.547,25 → 1.557,88 → **1.564,88** m² |
| Perímetro por fotograma | 163,72 → 164,81 → 166,46 → **167,57** m |
| Ficha vs. shoelace/suma de lados propios | **coinciden** (0,00) |
| Offset de 0,50 m: superficie | 1.535,87 → **1.549,52** m², 15 → 15 vértices |
| Offset: desplazamiento medido sobre la tabla | **0,500 m**, +1 tarjeta en el panel |
| Insertar: filas / desviación de la recta | 15 → **16** / 0,0001 m |
| Eliminar: filas / anillo | 16 → **15** / **idéntico al de antes** |
| Zoom tras el doble clic | 16,177 → 16,184 px/m (**+0,04 %**) |
| Caja de vértices al terminar el guion (1 aviso) | ~~69 px ≈ 2,8 filas~~ → **237 px** ≈ **9,6 filas** de 15 |
| La barra sobre el mapa | **285 × 55 px** (36 px de alto con el renglón de estado vacío) |

Y la caja de vértices **con la lista de avisos vacía**, o sea con la página recién
cargada y antes de que el guion desplace nada: ~~64 px ≈ 1,6 renglones~~ →
**303 px ≈ 11,3 renglones** bajo la cabecera fija. Medido en dev y en el build, que
dan lo mismo (302,73 px).

Esas filas no son cosméticas y por eso están medidas. Antes decían lo que el bloque
«Edición» le quitaba a la tabla: 270 px fijos de un panel que reparte alto fijo.
Desde el 2026-07-29 ese bloque no existe —las herramientas están en la barra— y lo
que se vigila es lo contrario: que la caja siga grande cuando entre el próximo
bloque. ~~(F07 mete el suyo)~~ **F07 decidió NO meterlo** (su diagnóstico vive en
un cajón flotante sobre el mapa, ver §15), y `09-diagnostico.js` HEREDA esta medida
y la repite con ese cajón abierto. El guion las publica en `panel` **sin juzgarlas**
(regla de oro 9); quien decide si once filas bastan, y si la barra estorba sobre la
ortofoto, es el checklist humano (§7.6 y §7.6 bis).

⚠️ El alto de la barra **crece con el renglón de estado**: vacío no ocupa
(`:empty{display:none}`), así que 36 px al arrancar y 55 px en cuanto hay algo que
anunciar. Es por diseño; si el guion la mide en 36 px al final, es que el renglón se
quedó mudo donde debería haber hablado.

---

## 15. `09-diagnostico.js` — el diagnóstico de encaje (F07 · T6.2)

El guion de F07: abre el contraste con el parcelario sobre la parcela REAL y mide
lo que la suite —2.900 y pico pruebas, incluida la aceptación de los cuatro
criterios— no puede tocar porque exige un motor de layout, un renderizador SVG y
una proyección de verdad.

### Qué mide, y por qué NO lo mide la suite

1. **Que la diferencia simétrica SE VEA.** Es lo primero que hay que confirmar
   fuera de jsdom: toda la representación de §10.5 descansa en que el
   `fillRule: 'evenodd'` por defecto de Leaflet rellene la diferencia al pintar UN
   solo polígono con los anillos de las dos geometrías. El guion lo comprueba
   sobre el SVG real (el `<path>` existe, lleva `fill-rule="evenodd"` aplicado,
   contiene DOS subtrazados y tiene relleno) y deja la pantalla lista para la
   captura. **No muestrea píxeles** — es SVG y las capas van `interactive: false`
   a propósito—, así que «se entiende sin leyenda» queda para el checklist §8.
2. **Que el cajón FLOTA**: `getBoundingClientRect` del cajón dentro del lienzo del
   mapa, el mapa con el MISMO tamaño antes y después de abrir, y el porcentaje de
   lienzo tapado como número sin juicio.
3. **La banda del margen conserva su anchura en METROS al cambiar el zoom**: el
   `stroke-width` a dos escalas MEDIDAS (Z y UN nivel alejando: al acercar actúa
   el tope de 40 px de la capa y la linealidad se corta a propósito; y un segundo
   clic de zoom durante la animación del primero se pierde sin síntoma — medido)
   dividido por la escala tiene que dar los mismos metros.
4. **El tiempo del recálculo completo por operación** (intersección contra el
   oficial y contra cada vecina + el muestreo de la desviación): el suscriptor del
   store corre síncrono dentro del `set`, así que se mide alrededor del gesto que
   lo dispara. Se publica en `contraste.recalculoCompletoMs`, sin umbral.
5. **El presupuesto de altura, HEREDADO de `08` §10**, en DOS medidas. La caja de
   vértices arranca en **~267 px** con los avisos vacíos: los ~36 px que faltan
   hasta los 303 de F06 son el **CTA del pie** —el único coste de F07 en el panel,
   deliberado y razonado en `index.html`—, y el guardián solo salta por debajo de
   220 px (un BLOQUE de los de verdad). Y **abrir el cajón no quita nada**: la
   caja se mide en el mismo tick del clic, descontando lo que crezca el renglón
   de estado del CTA si habla (regla de oro 1). Medido: 172 → 172 px. Si
   `.gml-bloque--diagnostico` apareciera en el panel, el guion falla por eso,
   con ese nombre.

Y dos comprobaciones de la regla de oro 9 sobre lo que el navegador realmente
muestra: ni una palabra de veredicto en el texto del cajón, y el ámbar
(`#92400E`) SOLO dentro de la sección de invasión.

### Régimen de red — léete el §13 antes de lanzarlo

Como `07`, toca el servicio REAL: una pasada, sin bucles, **como mucho dos
peticiones de datos**. «Traer del Catastro» (GetParcel: 0 si la caché de
IndexedDB sigue dentro del TTL, 1 si no) y la apertura del cajón (GetNeighbourParcel:
una pulsación, una petición — override O8; 0 si otro gesto ya las trajo). Las dos
se cuentan por Resource Timing y salen en `red`. Si el servicio no contesta, el
guion lo dice (`red.servicioRespondio: false`), no reintenta, y mide igual todo lo
que no depende de la red — con la sección de invasión diciendo «no se ha
consultado», que es lo que tiene que decir (nunca «ninguna»).

### Cómo se lanza

Página recién cargada, desde la raíz del repo:

```bash
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/
$B wait ".gml-tabla-vertices"
$B console --clear
$B eval scripts/smoke-navegador/09-diagnostico.js

$B console --errors                              # → (no console errors)
$B network | grep -E "wfsCP"                     # → ≤ 2 peticiones de datos
$B screenshot .gstack/smoke-f07.png              # la evidencia para el §8
```

⚠️ **Orden.** Deja la geometría **modificada** (el vértice 1 del exterior, 0,40 m
al Este — el caso medido de la suite, que barre un triángulo de 3,124 m² e invade
a tres colindantes), la registral tecleada (1.500) y el **cajón abierto**, todo a
propósito: la captura tiene que enseñar la sombra, el ámbar y la cota. No lo
encadenes antes de `02` (le contamina la cuenta de `GetMap` con el zoom de la
banda) ni de `06` (contrasta el `areaValue` contra el dataset de arranque). Para
repetirlo: `$B reload && $B wait ".gml-tabla-vertices"`.

### Qué cuenta como «pasa»

`ok: true` y `problemas: []`, y además:

- `arranque.ctaHabilitado: true` con el renglón vacío (la parcela de demostración
  trae contorno oficial) y `cajonCerrado: true`.
- `red.peticionesGetNeighbour ≤ 1`, y en la reapertura final **cero** peticiones
  nuevas (las vecinas se adoptan, no se repiden).
- `cajon.dentroDelMapa: true`, `mapaIntacto: true` y el titular descriptivo
  (`Contraste con el parcelario — …`).
- `bandas.filas: 3` con signo en los dos sentidos, y al borrar la registral los
  dos pares que la usan vuelven a «No consta», no a 0.
- `contraste.desviacionAtribuida: true` — «0,40 m · lindero 1»: la cifra Y el
  culpable, que es lo que §10.5 resalta.
- `invasion.parcelas` con ≥ 1 entrada `refcat: X m²` y
  `ambarSoloEnLaInvasion: true`.
- `diferencia.encontrada: true` con `fillRule: "evenodd"`, `subtrazados ≥ 2`,
  `conRelleno: true` e `interactivas: 0`.
- `banda.anchuraConstanteEnMetros: true`.
- `panel.bloqueDiagnosticoEnElPanel: false`, `panel.abrirNoRoboAltura: true`
  (`altoAntesDeAbrirPx` = `altoTrasAbrirPx`, con el renglón del CTA descontado si
  habló) y `arranque.altoCajaVerticesPx` ≥ 220 con los avisos vacíos (referencia
  medida: ~267 px; el guardián caza un BLOQUE, no el CTA).
- `cierre.cajonOculto: true` y `paneLimpio: true` (cerrar limpia el mapa).
- `regla9.palabraDeVeredicto: false`.

### Cifras de referencia (corrida de T6.2, **2026-07-29**, `npm run dev`)

Sirven para detectar una desviación, no como valores canónicos. Viewport
1440×900, lienzo 1048×900, duración **1,3 s**, consola limpia, **2 peticiones de
datos EN TODA LA SESIÓN** (GetParcel 2,9 kB + GetNeighbourParcel 12,0 kB, ambas
200; las corridas siguientes salieron de la caché de IndexedDB: 0 peticiones).

| Medida | Valor |
|---|---|
| Escala en el encuadre de arranque | **16,18 px/m** (la misma que midió `08`) |
| Caja de vértices al arrancar (avisos vacíos) | **267 px** (F06 dejó 303; los ~36 px son el CTA del pie) |
| Caja al abrir el cajón (mismo tick, mismos avisos) | **172 → 172 px** (el cajón no roba nada) |
| El cajón abierto | **420 × 468 px**, el **20,8 %** del lienzo, dentro del mapa, mapa intacto |
| Titular | «Contraste con el parcelario — Medición de 1535,87 m² frente a los 1536 m² …» |
| Cruces con la registral en 1.500 | −0,13 m² / +35,87 m² / +36,00 m², con signo |
| Recálculo completo por operación (con 4 vecinas) | **7–8 ms** |
| Invasiones tras +0,40 m al Este | 0,23 / 0,25 / 2,64 m² — las mismas que la suite sobre fixtures |
| La diferencia sombreada | 1 `<path>` con `fill-rule="evenodd"`, **2 subtrazados**, con relleno, 0 interactivos |
| La banda del margen (urbana, ±0,50 m) | 16 px a 16,17 px/m → 9 px a 8,10 px/m: **0,99 → 1,11 m** (constante en metros) |

`advertencias` **no** tumba nada: recoge lo que limita la medida (sin red, sin
banda que medir, plazo agotado).

### Lo que este guion deja al checklist humano (§8)

Si el cajón **estorba** sobre la ortofoto aunque quepa; si la sombra de la
diferencia **se entiende** sin leyenda; si la banda discontinua se lee como
referencia y no como «carril bueno»; y el punto BLOQUEANTE: si alguna cifra o
algún color **se lee como un veredicto** sin que el texto lo diga.

---

## 16. `10-comprobar-gml.js` — comprobar un GML existente (F08 · T6.2)

El guion de F08, y el **único de esta carpeta que mete un fichero en la
aplicación**. Recorre lo que la fase estrena —la primera entrada por fichero que
esta app ha tenido nunca— hasta el final: velo de arrastre → cajón de
comprobación → «Contrastar» → parcela en el mapa con procedencia doble → el CTA
de F07 encendiéndose solo → informe de contraste descargado.

> ✅ **HOY SALE `ok:true`, `problemas: []` y `advertencias: []`** (tercera
> corrida, **2026-08-02**, pasada en frío, con las tres medidas nuevas dentro).
> ⛔ **La PRIMERA corrida salió `ok:false`, y no era la medida: eran DOS DEFECTOS
> REALES DE PRODUCCIÓN** que este guion destapó y que ningún test de la suite
> podía ver. Los dos están **corregidos y con guardián**; su causa medida, la
> corrección y el guardián están abajo, en «Los dos defectos que este guion
> destapó». **No se arreglaron desde el guion**: arreglarlos ahí habría escondido
> el hallazgo. Encontrarlos es el mérito del guion y por eso la primera corrida no
> se borra.
>
> ⛔ **Y después vinieron TRES MÁS, que este guion tampoco veía: los encontró una
> PERSONA** haciendo la firma humana del §9 del checklist (2026-07-31/08-01). **Dos
> de los tres no son de F08: vienen de F03 y de F05.** Están corregidos, con
> guardián en la suite, y **desde el 2026-08-02 los mide este guion** — que es
> justo la regla del checklist: lo que se vuelve automatizable baja aquí. Ver «Los
> TRES defectos que encontró la firma humana».

### Qué mide, y por qué NO lo mide la suite

La suite (**3.925 pruebas en 90 ficheros**) ya cubre la comprobación pura
(`test/comprobacion/`), el decodificador, el informe, el cajón, la zona de
fichero, el cableado y los cuatro criterios de aceptación. **Aquí no se vuelve a
medir nada de eso.** Lo que se añade es lo que solo existe con un navegador
delante:

1. **Que soltar un fichero funcione DE VERDAD.** En jsdom no hay `DataTransfer`
   real, ni `File.arrayBuffer()` sobre bytes de verdad, ni una `opacity`
   calculada. Aquí el `File` se fabrica con los **bytes reales** del fixture
   —`arrayBuffer()` y no `text()`, porque la mitad de F08 que importa es de
   nivel de byte: el fichero del WFS **declara `ISO-8859-1` y sus bytes son
   UTF-8**, y el cajón lo dice— y el recorrido va entero.
2. **Que el cajón no tape NADA.** Comparte `bottomleft` con el de diagnóstico y
   las otras tres esquinas estaban ocupadas desde F03/F06. Se mide el **área de
   solape en px²** contra los cinco controles del mapa (barra de edición,
   control de capas, atribución, control de opacidad y el zoom), más que la
   atribución siga **visible**, que es obligación de licencia.
3. **Que los dos cajones nunca coincidan.** Dos de los tres caminos están
   blindados por `app/cableado-comprobacion.js` y se comprueban sobre controles
   de Leaflet reales; **el tercero se MIDE y no se juzga** (ver `terceraVia`),
   porque T4.1 lo dejó declarado y sin resolver.
4. **Que el informe produzca BYTES.** Misma cadena
   `Blob → createObjectURL → <a download> → click() → revoke` que mide `06` para
   el GML, con el mismo patrón de captura (§12) y la misma promesa: los tres
   envoltorios se restauran en un `finally` y el veredicto lo DECLARA
   (`informe.restaurado`).
5. **El invariante heredado de `08` §10 y `09` §5: la caja de vértices.** Se
   mide tres veces —al arrancar, **en el tick en que el cajón se abre** y tras
   contrastar— y cada pérdida se **atribuye**. La lección es de la primera
   corrida del guardián de F07, que acusó al cajón de 11 px que eran de otros
   renglones hablando después.
6. **La tipografía real de los botones de los dos cajones.** Que una regla CSS
   exista no significa que se aplique, y eso solo lo dice `getComputedStyle` con
   la hoja cargada. La expectativa se **deriva** del token `--font-sans` leído
   del `:root`, no de un literal copiado: si el token cambia, el guion sigue
   midiendo lo que hay que medir. **Esta medida es la que destapó el defecto 1**
   —una regla escrita, puesta y muerta— y sigue siendo la única que lo vería
   volver: en jsdom no hay cascada que resolver.

Y desde el **2026-08-02**, tres más. No salieron de este guion ni de la suite:
**salieron de la firma humana del §9 del checklist**, y dos de ellas ni siquiera
son de F08.

7. **EL REENCUADRE** (`reencuadre`; defecto heredado de F03/F05). `encuadrar()`
   se llamaba **una sola vez, al construir el visor**: se soltaba un GML de otra
   provincia y el mapa seguía mirando la parcela de demostración. **La suite no
   podía verlo por construcción** — todas sus pruebas traen su geometría a mano y
   la app arranca ya encuadrada sobre ella, así que la pregunta «¿y cuando entra
   OTRA?» no se hacía en ninguna parte. Aquí se sueltan **tres** ficheros y dos de
   ellos son la misma parcela que la de arranque, así que se miden **las dos
   mitades**: con `UTM_1.gml` (otra parcela, a 414,74 km medidos) la vista
   **viaja** y sus once vértices caben en el lienzo; con el fichero del WFS y con
   un **arrastre de vértice** el mapa **no se mueve ni un píxel**. Esa segunda
   mitad es la que importa: un mapa que se recentra mientras se arrastra le escapa
   el vértice al puntero.
8. **LAS PARCELAS VECINAS, DIBUJADAS** (`colindantes`; deuda de F05). Se traían,
   se publicaban por `alColindantes` y las usaban el snap de F06 y la invasión de
   F07 — **y no las pintaba nadie**: pulsar «Traer colindantes» dejaba el mapa
   exactamente igual mientras la ficha decía el número. **La suite no lo veía
   porque nadie afirmaba que se dibujaran.** Se miden los contornos, que estén en
   el pane **405** y **por debajo** de la parcela propia (405 < 410: una vecina
   comparte lindero con la propia y encima pondría gris el lado compartido), que
   el emergente traiga la referencia catastral, y **el riesgo que el emergente
   abría** — que la capa interactiva le robe el clic al mapa.
9. **EL CAMPO DE LA REFERENCIA** (`campoRefcat`; éste sí es defecto propio de
   F08). Con un fichero que trae referencia, el campo la enseña en forma
   **canónica**; con `UTM_1.gml`, que no la trae, el campo se **vacía** — decisión
   contraria a la de la vía del Catastro y razonada: allí el campo es lo que el
   usuario **tecleó** y no se le quita; aquí manda el fichero. Y en los dos casos
   se comprueba que **ningún botón derivado se queda encendido contradiciéndolo**,
   porque «Deducir del mapa» y «Traer colindantes» se encienden mirando el
   **MODELO** y no el campo.

Y de propina: un **GML ajeno con una tanda larga de notas** (el riesgo que el
plan de F08 mandó expresamente aquí: *«hay que mirarlo con un fichero malo de
verdad: va al guion 10»*) y un contador de **excepciones no capturadas** durante
el recorrido, que es más de lo que hace `09`.

### Cómo lee el encuadre un guion que no tiene el `L.Map`

Merece una nota porque es la parte no obvia de la medida 7. `crearVisor` **no
publica el mapa en ningún global** (a propósito: `app/main.js` razona que
`mapa.getSize()` **ES** `#mapa.clientWidth/clientHeight` y que por eso no hace
falta ningún `window.__gml`). Así que el encuadre se lee de donde **sí** es
observable: **el `src` de la imagen del WMS del Catastro**, que lleva su `BBOX` en
`EPSG:3857` y que `viewer/wms-catastro.js` reescribe **una vez por encuadre**
(criterio 2 de F03). El `src` se fija al **pedir** la imagen, así que está
disponible en cuanto hay `moveend`, sin esperar a que el servicio conteste. El
guion lo convierte a `[lon, lat]` con la fórmula cerrada de Mercator y calcula la
distancia con haversine. La segunda medida, la de píxeles, no necesita nada de
eso: es la posición en pantalla de un vértice **que no se ha tocado**.

### ⚠️ Este guion necesita `npm run dev`, NO `vite preview`

Los ficheros de prueba se traen con `fetch` del propio servidor
(`test/fixtures/gml/…`), y eso **solo funciona en dev**: `vite preview` sirve
`dist/`, donde los fixtures no están. Se hace así a propósito, y no empotrando
una copia del GML dentro del guion, porque **un fixture copiado es un fixture
que diverge** y este proyecto ya pagó un rechazo del IVG por derivar del fichero
equivocado (`spec/SPEC.md` §3.1). Si el `fetch` falla, el guion **para y lo
dice**; no inventa un GML de repuesto.

### Régimen de red — léete el §13 antes de lanzarlo

Como `07` y `09`: una pasada, sin bucles, **como mucho dos peticiones de datos**
(override O8).

- «Contrastar con el parcelario» → **GetParcel** con la referencia leída **del
  fichero**: 1 en frío, **0** si la caché de IndexedDB sigue dentro del TTL (y
  entonces el veredicto lo dice en `advertencias`, porque esa pasada no mide ni
  el servicio ni CORS).
- Abrir el cajón de diagnóstico → **GetNeighbourParcel**: una pulsación, una
  petición; 0 si ya las trajo otro gesto en esta página.
- **El segundo fichero no gasta nada.** `cp_huso_incoherente.gml` declara
  EPSG:25829 y el cableado se niega a pedir el parcelario en un huso distinto
  del expediente (`motivoSrsAjeno`), que es justo lo que hay que ver. El guion
  lo comprueba (`ficheroLargo.peticionesGastadas: 0`).
- **El tercero tampoco.** `UTM_1.gml` **no trae referencia catastral** (el
  elemento está y viene vacío), así que no hay parcelario que pedir y el cableado
  lo dice sin salir a la red. El guion lo comprueba
  (`reencuadre.otraParcela.peticionesGastadas: 0`), y de paso **es lo que hace
  medible el reencuadre**: es el único fichero de la carpeta que trae una parcela
  DISTINTA de la de arranque.
- **Reabrir el cajón de diagnóstico no gasta nada**, y también se comprueba
  (`colindantes.peticionesAlReabrir: 0`): las vecinas ya están adoptadas.

### Cómo se lanza

Página recién cargada, desde la raíz del repo:

```bash
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/
$B wait ".gml-tabla-vertices"
$B console --clear
$B network --clear
$B eval scripts/smoke-navegador/10-comprobar-gml.js

$B console --errors                              # → (no console errors)
$B network | grep -E "wfsCP"                     # → ≤ 2 peticiones de datos
$B screenshot .gstack/smoke-f08.png              # la evidencia para el §9
```

Para forzar la pasada **en frío** (la única que mide el servicio de verdad),
borrar la base antes de recargar — el `deleteDatabase` queda BLOQUEADO mientras
la app tiene la conexión abierta, así que el orden importa:

```bash
$B js "await new Promise(r=>{const p=indexedDB.deleteDatabase('concreta-gml');p.onsuccess=r;p.onerror=r;p.onblocked=r}); return 'pedido'"
$B reload && $B wait ".gml-tabla-vertices"
```

⚠️ **Orden.** El guion deja **el cajón de comprobación abierto con el fichero
del huso incoherente**, a propósito: la captura tiene que enseñar la tanda larga
de notas sobre un GML ajeno, que es lo que el §9 del checklist manda leer en voz
alta. Lo restaura el paso 17.4 y lo **declara** en `estadoFinal`. No lo encadenes
antes de `02` (le contamina la cuenta de `GetMap`) ni de `06` (contrasta el
`areaValue` contra el dataset de arranque, y este guion lo sustituye por la
parcela del fichero). Para repetirlo:
`$B reload && $B wait ".gml-tabla-vertices"`.

> ⛔ **Lo que cambió el 2026-08-02**: ~~«y la parcela del primer fichero
> cargada»~~. La parcela que queda en pantalla es la de **`UTM_1.gml`** —a 414 km
> de la anterior— y con **un vértice movido**: es el precio de medir el
> reencuadre y el arrastre, y se paga a sabiendas, porque el §9 del checklist mira
> **el cajón**, no el dataset. El guion lo dice en
> `estadoFinal.parcelaEnPantalla`.

### Qué cuenta como «pasa»

`ok: true` y `problemas: []` —✅ **se cumple desde la segunda corrida del
2026-07-30**; ~~«hoy no se cumple, ver el aviso de arriba»~~— y además:

- `arranque.altoCajaVerticesPx` ≥ 220 con los avisos vacíos (referencia medida:
  **267 px**, los mismos que dejó F07: el botón del rótulo costó 0 px) y
  `arranque.boton.enLaFilaDelRotulo: true`.
- `arranque.input.seRenderiza: true` — el `<input type="file">` va con el patrón
  «visually hidden», **nunca** `display:none` ni `hidden`: hay navegadores que se
  niegan a abrir el selector de un input que no se renderiza.
- `arrastre.sobrevueloCancelado: true` — es la línea más cara del módulo: sin ese
  `preventDefault` el navegador abre el fichero en la pestaña y la aplicación
  entera desaparece.
- `arrastre.veloDurante`: `opacidad > 0`, `visibilidad: "visible"`,
  `punteroAtraviesa: true` y `cubreLaVentana: true`; y `veloDespues` con la marca
  del `<body>` retirada.
- `cajon.dentroDelMapa: true`, `mapaIntacto: true` y el rótulo del fichero
  **nombrando el fichero soltado**.
- `solapes.*.areaPx2: 0` en los CINCO, y `atribucionVisible: true`.
- `tipografia.todosConLaFamiliaDeLaApp: true` ← ~~hoy `false`~~ ✅ **`true`
  desde la corrección del defecto 1**: los tres botones se pintan en
  `"Geist Sans", system-ui, -apple-system, sans-serif`.
- `contraste.cerroSolo: true`, `nombraElFichero`, `diceQueNoEsDelCatastro` y
  `nombraElParcelario` los tres `true` (la procedencia es DOBLE: decir solo «Del
  Catastro» convertiría el fichero de un tercero en un dato oficial, y ése es EL
  error de producto de la fase), y `ctaDiagnosticoHabilitado: true` — F07 se
  enciende **sola**, sin una línea de código nuevo.
- `red.peticionesGetParcel` ≤ 1 y `red.peticionesGetNeighbour` ≤ 1.
- `panel.soltarNoRoboAltura: true` y
  `panel.contrastarNoRoboMasQueLaProcedencia: true`.
- `informe`: `blobsCapturados: 1`, `bytes > 0`, `revocaLaQueCreo: true`,
  `restaurado: true`, `titulaComoTocaLegalmente: true`,
  `desmienteSerLaValidacionGrafica: true`,
  `seLlamaValidacionGraficaEnElTitulo: false`,
  `diceQueEsProvisionalYSinFirma: true`, `nombraElFicheroDeOrigen: true` y
  `diagnosticoSigueAbierto: true` ← ~~hoy `false`~~ ✅ **`true` desde la
  corrección del defecto 2**.
- `ficheroLargo`: `diagnosticoSeCerroAlAbrirLaComprobacion: true`,
  `dentroDelMapa: true`, `botonesAlcanzables: true`,
  `contrastarSigueHabilitado: true` (fuera de huso es NOTA, no fallo) y
  `peticionesGastadas: 0`.
- `consola.excepcionesNoCapturadas: 0`.

Y desde el **2026-08-02**, las tres medidas de la firma humana:

- `campoRefcat.arranqueVacio: true` (el campo nace sin `value`: si no lo
  estuviera, medir que la referencia «llega» no afirmaría nada),
  `campoRefcat.conReferencia.canonica: true` con valor `"9398516VK3799G"`, y
  `campoRefcat.sinReferencia.vacio: true` con `UTM_1.gml`.
- `campoRefcat.*.coherente: true` en las DOS: con referencia, «Deducir del mapa»
  **apagado** y «Traer colindantes» **encendido**; sin referencia, al revés. Los
  botones miran el MODELO, así que una referencia huérfana en el campo los deja
  contradiciéndolo — que es exactamente el defecto que se arregló.
- `colindantes.contornos > 0` y **cuadrando con la ficha**,
  `colindantes.enSuPane === colindantes.contornos`,
  `colindantes.porDebajoDeLaParcela: true` (405 < 410),
  `colindantes.emergente.traeReferencia: true` y
  `colindantes.clicAlMapa.elClicLlegaAlMapa: true`.
- `reencuadre.mismaParcela.desplazamientoKm: 0` (la misma parcela **no** mueve la
  vista), `reencuadre.editar.elMapaSeQuedoQuieto: true` con
  `laGeometriaCambio: true` (la mitad anti-vacuidad: sin edición efectiva, «no se
  movió» no afirma nada) y `reencuadre.otraParcela` con `laVistaViajoKm` de
  cientos de km, `marcadores.todos: true` y `contornosDeVecinasDespues: 0`.
- `estadoFinal.restaurado: true` — el guion deja la pantalla como el §9 del
  checklist la necesita, y lo dice en vez de darlo por hecho.

`advertencias` **no** tumba nada: recoge lo que limita la medida (la caché ya
caliente, un fixture que no se ha podido traer, un control que no está en el
mapa, un arrastre sintético que no enganchó).

### ✅ Los DOS defectos que este guion destapó (2026-07-30, primera corrida) — CORREGIDOS

Los dos eran de PRODUCCIÓN, y **ninguno se tocó desde el guion**: el guion existe
para encontrarlos, no para taparlos. Se corrigieron **en producción**, cada uno en
el módulo que era su dueño, y cada uno con un **guardián nuevo en la suite
verificado por reintroducción del defecto** (se vuelve a meter, el test se pone
rojo con su mensaje, se quita). La descripción de abajo se conserva **en presente**
tal como se midió el día del hallazgo; debajo de cada una va la corrección.

> Esto es lo que este guion vale. Los dos defectos estaban **fuera del alcance de
> jsdom por construcción**: el primero necesita una cascada de CSS resuelta con la
> hoja cargada, y el segundo, un `click()` que burbujee por un árbol con
> `display` calculado. La suite estaba verde con los dos vivos, y lo habría
> seguido estando.

**1 · Los tres botones de los dos cajones siguen en `system-ui`, y la regla que
lo arreglaba es código muerto.** Medido:
`getComputedStyle(boton).fontFamily === "system-ui, sans-serif"` en
«Contrastar con el parcelario», «Descartar» y «Descargar informe de contraste»,
frente al `"Geist Sans", system-ui, -apple-system, sans-serif` de `--font-sans`.
La causa está medida y es de cascada: `estilos/app.css` (regla
`.gml-app .gml-cajon-diagnostico button, .gml-app .gml-cajon-comprobacion button`)
declara `font-family: var(--font-sans)`, pero los dos módulos fijan
**`font: inherit` EN LÍNEA** sobre cada botón, y **el estilo en línea gana a la
hoja**. Así que el botón hereda el `font: 13px/1.45 system-ui,sans-serif` que el
propio módulo pone en el contenedor. El comentario de esa regla ya avisaba de
que «el inline gana a esta regla» **para el estado apagado**, y no cayó en que
la propia `font-family` también va en línea. Se corrige en
`viewer/cajon-comprobacion.js` y `viewer/cajon-diagnostico.js` (quitando
`font: 'inherit'` de los botones o dejando solo lo que no sea la familia), **no
en la hoja**: mientras el inline esté, cualquier regla que se escriba allí es
decorativa.

> ✅ **CORREGIDO (2026-07-30).** Los tres botones de los DOS módulos ya **no
> fijan la familia**: ponen `fontSize: 'inherit'`, `lineHeight: 'inherit'` y su
> grosor, y **la familia la pone la hoja**. El reparto está escrito en los tres
> ficheros: *el módulo pone lo que hace el botón legible sin ninguna hoja —tamaño,
> grosor, espaciado—; la hoja pone la familia, que es lo único que el módulo no
> puede saber.* La regla de `estilos/app.css` se **redujo a `font-family` sola**,
> porque `font-size` y `font-weight` también eran código muerto (los pone el
> inline) y declararlos era volver a escribir algo que no se aplica.
> **Guardianes nuevos** en `test/viewer/cajon-comprobacion.dom.test.js` y
> `test/viewer/cajon-diagnostico.dom.test.js`: ningún botón lleva `fontFamily` en
> su atributo `style`, y sí conserva tamaño y relleno —la mitad anti-vacuidad,
> para que el guardián no se pueda cumplir borrándolo todo—. Se mira la propiedad
> suelta `style.fontFamily` y **no** el atajo `style.font`, y eso está medido:
> jsdom **serializa** el atajo desde las propiedades sueltas, así que `style.font`
> nunca sale `''` y el guardián sería vacuo.
> **Medido en la segunda corrida:**
> `tipografia.todosConLaFamiliaDeLaApp: true`, con
> `"Geist Sans", system-ui, -apple-system, sans-serif` en los tres.
> **La lección, que es la de `SPEC.md` §3.1 repetida en una hoja de estilos:** una
> protección que no llega a ejecutarse no protege, y esta *parecía* escrita, puesta
> y revisada. Su propio comentario ya avisaba de que «el inline gana a esta regla»
> —para el estado apagado— y no cayó en que la familia iba por el mismo sitio.

**2 · Pulsar «Descargar informe de contraste» CIERRA el cajón de diagnóstico, y
el desenlace se escribe donde nadie lo lee.** Medido: `diagnosticoSigueAbierto:
false` justo después del click, con el renglón
`[data-estado="informe-contraste"]` diciendo «Descargado «contraste_….txt».» en
un cajón que ya está en `display:none`. La cadena, entera y verificada:
`gml/descargar.js` cuelga el `<a download>` del `<body>` (línea 713) y lo pulsa
(línea 716); ese `click()` sintético **burbujea hasta `document`**; ahí está el
guardián de clic-fuera de `viewer/cajon-diagnostico.js`, que hace
`if (this._contenedor.contains(evento.target)) return` — y el `target` es el
anchor, que cuelga del `<body>` y **no** del cajón. `disableClickPropagation` no
ayuda: no detiene el `click`, y su propia cabecera lo dice.
Consecuencia real, no cosmética: el usuario pulsa, el cajón desaparece y **la
confirmación de que su fichero ha bajado —o el motivo de que no— no llega a
leerse ni a anunciarse** (un `role="status"` en `display:none` sale del árbol de
accesibilidad). Es la regla de oro 1 rota en el último gesto del recorrido de
F08. Se corrige en `viewer/cajon-diagnostico.js` (el guardián tiene que ignorar
un clic cuyo `target` no esté en el documento visible, o el anchor tiene que
dejar de burbujear) o en `gml/descargar.js` (que el anchor no cuelgue del
`<body>`); **no en el guion**.

> ✅ **CORREGIDO (2026-07-30), y en `gml/descargar.js`, no en el cajón.** Un
> oyente **en fase de captura sobre el propio anchor** que hace
> `evento.stopPropagation()`. `stopPropagation` **no** impide la acción por
> defecto, así que **la descarga se dispara igual**; y va en captura y sobre el
> nodo para que ni un oyente puesto antes en el mismo elemento pueda reenviarlo.
> **El razonamiento de por qué ahí y no en el cajón está escrito en el fichero**,
> y es de fondo: *este clic no es un gesto del usuario, es fontanería de la
> descarga.* Que un detalle de implementación de `descargarTexto` sea observable
> por el resto de la aplicación **es el defecto**; parchear a cada oyente para que
> aprenda a ignorarlo habría repartido el arreglo entre todos los que algún día
> escuchen en `document` — y el siguiente no se acordaría.
> **Guardián nuevo** en `test/gml/descargar.dom.test.js`, con su mitad
> anti-vacuidad: un oyente en `document` **no** ve el clic del anchor de la
> descarga, y **sí** ve el de un botón normal (sin esa segunda mitad, el guardián
> pasaría también con un DOM en el que nadie oye nada).
> **Medido en la segunda corrida:** `informe.diagnosticoSigueAbierto: true`, con
> el renglón `[data-estado="informe-contraste"]` diciendo
> «Descargado «contraste_9398516VK3799G_2026-07-30T11-09-02.txt».» **en un cajón
> que sigue visible**, y los **12.869 B** bajando igual.

### ✅ Los TRES defectos que encontró la FIRMA HUMANA (2026-07-31/08-01) — CORREGIDOS

Este apartado es el argumento de que el gate humano existe. **Ninguno de los tres
lo veía la suite. Ninguno lo veía este guion. Y dos de los tres ni siquiera son de
F08: vienen de F03 y de F05**, y llevaban ahí desde entonces sin que nadie los
notara, porque cada uno estaba justo en el punto ciego de su gate.

**1 · El mapa no reencuadraba NUNCA.** ⟨heredado de F03 · encuadre⟩
`encuadrar()` se llamaba una sola vez, al construir el visor, y el visor no
exponía ninguna forma de repetirlo. Se traía una parcela de Sevilla por referencia
catastral, o se soltaba un GML de Cádiz, y **el mapa seguía mirando la parcela de
demostración**. Y de rebote: «traer geometría del Catastro» **parecía no tener
feedback visual**, cuando el dibujo estaba hecho — a cientos de kilómetros de la
vista.

> ✅ **CORREGIDO en `viewer/index.js` (paso 7 del montaje).** Una suscripción al
> store y una regla de una línea: **se reencuadra cuando entra una parcela con
> OTRA identidad, y solo entonces**. La identidad es **`refcat ?? idLocal`**, la
> misma clave y por el mismo motivo que `app/cableado-diagnostico.js` —`edit/`
> reconstruye el POJO en cada operación (regla de oro 4), así que comparar
> referencias de objeto diría «otra parcela» en CADA frame de un arrastre—. Se
> expone además `visor.encuadrar()` para el gesto explícito. Una parcela **anónima**
> (sin refcat ni idLocal) no mueve el mapa —«otra» y «esta, editada» son
> indistinguibles— y **se avisa una vez**.
> **Por qué la suite no podía verlo:** todas sus pruebas **traen su geometría a
> mano y la app arranca ya encuadrada sobre ella**, así que la única pregunta que
> importaba —«¿y cuando entra otra?»— no se hacía en ninguna parte.
> **Medido el 2026-08-02:** con `UTM_1.gml` la vista viaja **414,74 km** y sus 11
> vértices caben en el lienzo; con el fichero del WFS (la misma parcela) **0 km**;
> y arrastrando un vértice, un vértice que no se ha tocado se queda en **el mismo
> píxel** (`desplazamientoPx: 0`, `transform` del `map-pane` idéntico).

**2 · Las colindantes no se dibujaban en ningún sitio.** ⟨deuda de F05⟩
Se traían del Catastro, se publicaban por `alColindantes` y las consumían el
**snap** de F06 y la **invasión** de F07 — pero no había ni una capa que las
pintara. Pulsar «Traer colindantes» no daba **ningún** acuse de recibo visual: el
usuario leía «4 parcelas colindantes» en la ficha y el mapa seguía exactamente
igual. Que el dato se usara por dentro no lo arregla: **es la regla de oro 1 rota
en el último tramo**, que es el peor sitio, porque el trabajo estaba hecho.

> ✅ **CORREGIDO con `viewer/colindantes.js`** y `PANE.COLINDANTES` en zIndex
> **405** — el único pane del visor **por debajo** de la geometría propia, y no por
> gusto: **una vecina COMPARTE lindero con la propia**, y dibujada encima pondría
> gris el lado compartido; el técnico creería estar mirando su lindero mientras
> mira el de al lado. Contorno gris claro `#CBD5E1` de 1,5 px **sin relleno
> visible** (`fillOpacity: 0`, que no pinta un píxel y sin embargo hace que el
> interior entero responda al emergente), y la referencia catastral en un
> emergente. Lo enchufa `app/main.js` como **tercer suscriptor** de
> `alColindantes`, y se **limpian** en `viewer/index.js` con el **mismo cambio de
> identidad** que dispara el reencuadre — unas vecinas junto a otra parcela son
> una mentira sobre el mapa.
> **Por qué la suite no podía verlo: nadie afirmaba que se dibujaran.** No es que
> un test fallara: es que la afirmación no existía.
> **El riesgo que esto abría, medido y despejado:** el emergente exige
> `interactive: true`, y una capa interactiva puede **robarle el clic al mapa** —
> que es «Deducir del mapa» de F05. No pasa: `L.Path` trae
> `bubblingMouseEvents: true`, y aquí se comprueba **con la app viva y con el motor
> de layout eligiendo el destinatario** (`elementFromPoint` devuelve el `<path>` de
> la vecina): pinchando sobre una vecina a menos de 12 px de un lindero propio, el
> mapa **selecciona ese lindero**; pinchando lejos, **deselecciona**. O sea que el
> clic llega **con la coordenada del puntero**.
> ⚠️ **Y una cosa que solo se ve con la app entera delante:** la deducción por
> clic y unas colindantes dibujadas **no pueden coexistir en esta aplicación**. La
> deducción se arma solo con una parcela **sin** referencia catastral
> (`puedeDeducirDe`), y las vecinas se piden **por** referencia y se sueltan en
> cuanto entra otra parcela. No es un defecto —es coherente: sin referencia no hay
> a quién pedir vecinas— pero conviene saberlo antes de intentar medirlo a la vez.

**3 · La referencia del GML no llegaba al campo del panel.** ⟨defecto propio de
F08⟩ Y los botones derivados se quedaban encendidos contradiciéndolo.

> ✅ **CORREGIDO en `app/cableado-comprobacion.js`**: se escribe la forma
> **canónica** —la que ha entrado en el modelo, nunca la cadena cruda del fichero—
> y **se VACÍA el campo** cuando el fichero no trae referencia utilizable. Esto
> último es la **decisión contraria** a la de la vía del Catastro, y es deliberada:
> allí `null` significa «el servicio no ha confirmado lo que TECLEASTE», y lo
> tecleado es del usuario; **aquí manda el fichero**, que afirma que esta parcela no
> tiene referencia. Dejar la anterior sería peor que el hueco: el campo hablaría de
> una parcela que ya no está en pantalla, y **«Deducir del mapa» —que mira el
> MODELO— se encendería al lado de una referencia perfectamente escrita**, que es
> lo único que ese botón promete que no hace falta.
> **Medido el 2026-08-02:** `"9398516VK3799G"` con el fichero del WFS (deducir
> apagado, colindantes encendido) y `""` con `UTM_1.gml` (deducir encendido,
> colindantes apagado). Coherente en los dos.

> **La lección, y es de las que no se pueden automatizar:** este guion encontró dos
> defectos que la suite no veía **porque jsdom no tiene cascada ni burbujeo real**.
> La firma humana encontró otros tres que el guion no veía **porque nadie había
> escrito la pregunta**. Un gate no encuentra lo que no se le ocurre preguntar, y
> por eso el último es una persona mirando la pantalla.

### Cifras de referencia (corrida de cierre, **2026-07-30**, `npm run dev`, puerto 5175, pasada en FRÍO)

⛔ **Son las de la SEGUNDA corrida, la de después de las dos correcciones**:
`ok: true`, `problemas: []` y `advertencias: []`. Sirven para detectar una
desviación, no como valores canónicos. Viewport 1440×900, lienzo 1048×900,
duración **1,18 s**, consola **limpia** (`$B console --errors` →
*(no console errors)*, y `consola.excepcionesNoCapturadas: 0`), **2 peticiones de
datos** (GetParcel 2.878 B en 71 ms + GetNeighbourParcel 11.969 B en 127 ms, las
dos 200). Suite en ese commit: **3.845 pruebas en 89 ficheros**.

| Medida | Valor |
|---|---|
| Caja de vértices al arrancar (avisos vacíos) | **267 px** — los mismos que dejó F07: «Abrir un GML…» costó **0 px** |
| Caja al abrirse el cajón (mismo tick del `drop`) | **267 → 267 px** (el cajón flota y el panel no se entera) |
| Caja tras «Contrastar» | 267 → **222 px**, y los **45 px** son exactamente lo que crece el renglón de procedencia al pasar de vacío a 3 líneas |
| Alto de la fila del rótulo con el botón dentro | **16 px** |
| Fichero soltado | `cp_parcela_9398516VK3799G.gml`, **2.878 bytes** |
| Rótulo del cajón | «… · 2,8 kB · declara «ISO-8859-1», leído como «utf-8»» |
| El cajón abierto | **420 × 468 px**, el **20,8 %** del lienzo, dentro del mapa, mapa intacto |
| Solape con los 5 controles del mapa | **0 px²** en los cinco; atribución visible |
| Superficie declarada / medida en el cajón | 1536 m² / 1535,87 m² · 15 vértices · EPSG:25830 |
| Notas del fichero limpio (el del WFS) | **8** · 0 bloqueos |
| Peticiones: GetParcel · GetNeighbourParcel | **1 · 1** (en caliente: 0 y 0, con su advertencia) |
| Informe descargado | **12.869 B**, 275 líneas, `text/plain;charset=utf-8`, `contraste_9398516VK3799G_<marca>.txt` |
| GML ajeno (`cp_huso_incoherente.gml`, 3.167 B) | **8 notas · 4 hallazgos · 0 bloqueos**, EPSG:25829, el recorrido CONTINÚA |
| El cajón con ese fichero | mismos 420 × 468 px, hace scroll propio, los dos botones **alcanzables**, **0 peticiones** |
| La tercera vía (los dos cajones apilados) | **946 px** de alto; el de comprobación sube a `y = −77` y **se sale del mapa por arriba**; solape entre ellos: 0 px² |
| Tipografía de los 3 botones | ~~`system-ui, sans-serif` ← defecto 1~~ → ✅ **`"Geist Sans", system-ui, -apple-system, sans-serif`**, derivada de `--font-sans` |
| Cajón de diagnóstico tras pulsar «Descargar informe» | ~~cerrado ← defecto 2~~ → ✅ **sigue abierto**, con el acuse de recibo legible |

⚠️ La fila de la tercera vía es la única de esta tabla que **no** es un
veredicto: está declarada y no resuelta (T4.1), y se publica para que el
checklist §9.5 tenga la cifra delante. Que los 946 px no quepan en los 900 del
lienzo es exactamente lo que el plan preveía al decir «legible, pero feo».

**Lo que cambió entre las dos corridas, y lo que NO.** Solo las dos filas
tachadas. Todas las demás medidas —los 267 px, el 20,8 % del lienzo, los 0 px² de
solape en los cinco controles, los 12.869 B del informe, las 8 notas, los 946 px
de la tercera vía— salieron **idénticas** en las dos pasadas, las dos en frío y
con 2 peticiones. Eso es lo que permite afirmar que las correcciones arreglaron
**lo que se dijo y nada más**: si hubieran movido algo por el camino, esta tabla
lo diría.

### Cifras de las TRES medidas nuevas (corrida del **2026-08-02**, `npm run dev`, puerto 5173, pasada en FRÍO)

`ok: true`, `problemas: []`, `advertencias: []`. Duración **2,20 s** (eran 1,18 s:
las tres medidas nuevas cuestan ~1 s, casi todo el arrastre y la espera del
encuadre nuevo). Consola **limpia** (`$B console --errors` → *(no console
errors)*, `consola.excepcionesNoCapturadas: 0`) y **2 peticiones de datos**
(GetParcel 2.878 B en 44 ms + GetNeighbourParcel 11.969 B en 129 ms, las dos 200).
Suite en ese commit: **3.925 pruebas en 90 ficheros**.

⚠️ **Toda la tabla anterior salió IGUAL**: 267 px de caja de vértices, 267 → 267
al abrirse el cajón, 222 tras contrastar con los mismos 45 px de procedencia, 420
× 468 px de cajón (20,8 % del lienzo), 0 px² de solape en los cinco controles,
12.869 B y 275 líneas de informe, 8 notas, 946 px de la tercera vía. **Los tres
arreglos no movieron nada de lo que ya estaba medido**, y eso es la mitad del
valor de tener la tabla.

| Medida nueva | Valor |
|---|---|
| **Campo con el fichero del WFS** | `"9398516VK3799G"` — forma canónica, la misma que la ficha. «Deducir del mapa» **apagado**, «Traer colindantes» **encendido** |
| **Campo con `UTM_1.gml`** (3.450 B, sin referencia) | `""` — **vaciado**. «Deducir del mapa» **encendido**, «Traer colindantes» **apagado**. Ficha: «Sin referencia» |
| **Colindantes dibujadas** | **4** contornos, y la ficha dice **4**. Las 4 en el pane `colindantes` |
| Pane de las colindantes · pane de la parcela oficial | **405** · **410** ⇒ por debajo, como manda el lindero compartido |
| Estilo del contorno | `stroke #CBD5E1`, `stroke-width 1.5`, `fill-opacity 0`, `leaflet-interactive` |
| Emergente de una vecina | **`9398501VK3799G`** (la referencia catastral, no un rótulo) |
| El clic sobre una vecina | `elementFromPoint` → `gml-colindante leaflet-interactive`; a 3–9 px de un lindero **selecciona** ese lindero, a > 40 px **deselecciona** ⇒ **el clic llega al mapa con la coordenada del puntero** |
| Reabrir el cajón de diagnóstico tras esos clics | **0 peticiones** |
| **Reencuadre con la MISMA parcela** (fichero del WFS) | centro `−3,716547 / 40,465415` antes y después ⇒ **0,00 km** |
| **Reencuadre al EDITAR** (arrastre sintético de 40 × −28 px) | vértice de referencia en `(528, 392)` antes y después ⇒ **0 px**; `transform` del `map-pane` y BBOX del WMS **idénticos**; y la geometría **sí** cambió (mitad anti-vacuidad) |
| **Reencuadre con OTRA parcela** (`UTM_1.gml`) | `−3,716547 / 40,465415` → `−5,259671 / 36,935108` ⇒ **414,74 km**. Los **11 de 11** vértices dentro del lienzo. Vecinas: **4 → 0** |
| Peticiones que gasta `UTM_1.gml` | **0** (sin referencia no hay parcelario que pedir) |
| Estado en que queda la pantalla | cajón abierto con `cp_huso_incoherente.gml` (8 notas) sobre la parcela de `UTM_1.gml`, **con un vértice movido** — `estadoFinal.restaurado: true` |

Evidencia: `.gstack/smoke-f08.png` (el estado final) y
`.gstack/smoke-f08-colindantes.png` / `.gstack/smoke-f08-colindantes-alejado.png`
—**la vía de F05, la que destapó el defecto**: «Traer del Catastro» +  «Traer
colindantes» con la caché caliente (**0 peticiones**) dejan el renglón diciendo
«El Catastro ha devuelto 4 colindantes…» **y cuatro contornos grises en el mapa**.
Al encuadre de arranque solo se ven fragmentos (las vecinas son grandes y el lado
que comparten con la propia queda debajo del amarillo, que es la decisión del
pane); alejando dos niveles se leen enteras. Que eso **baste como acuse de
recibo** es juicio, y es del checklist §7.7 — la mecánica ya está medida aquí.
