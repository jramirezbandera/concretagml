# Smoke en navegador real — F03 · Fase 4

Runbook de la **tarea 4D**: lo que `jsdom` no puede probar de F03. La suite
(1.114 pruebas) ya cubre la lógica; aquí se comprueba lo otro: que **el servicio
responda con el tamaño pedido**, que **el canvas quede limpio**, que la
atribución sea **visible** (jsdom no calcula layout) y que el arrastre funcione
con la **maquinaria real de `L.Draggable`**.

- **4D.1** (esta carpeta) escribió los guiones y los probó en seco.
- **4D.2** es la ejecución oficial, con evidencia, siguiendo este documento.

Cuatro guiones, un veredicto **serializable** cada uno (`{ok: boolean, …medidas}`),
para que el resultado no dependa de interpretar prosa:

| Guion | Criterio F03 | Mide | Veredicto pasa si |
|---|---|---|---|
| `01-capas.js` | 1 | las cinco bases conmutan y pintan; la superpuesta regula opacidad | `ok:true` |
| `02-wms-encuadre.js` | 2 | 1 `GetMap` por instancia WMS visible y por encuadre, al tamaño del lienzo | `ok:true` |
| `03-arrastre.js` | 3 | arrastrar un vértice mueve tabla + dibujo + ficha | `ok:true` |
| `04-atribucion-consola.js` | 4 y 5 | atribución literal y visible; canvas limpio; el canal de avisos llega a la UI | `ok:true` |

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
http://localhost:PUERTO/`). Si el 5173 está ocupado, Vite coge otro sin avisar
más que en esa línea.

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
$B goto http://localhost:PUERTO/
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
parte del checklist humano de la fase 5.

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

- **Fase 5**, junto al checklist humano: allí se hace el arrastre con ratón de
  verdad, que es lo único que este smoke no puede cubrir (§0).
- **F16**, cuando toque `base` para GitHub Pages: la app carga
  `/estilos/app.css` y `/app/main.js` con rutas **absolutas** desde `index.html`,
  y bajo una subruta de Pages eso se rompe. Hay que volver a pasar los cuatro
  guiones sobre la URL desplegada (y `01` sobre `vite preview` con el `base`
  nuevo).
- **F06**, cuando cambie la maquinaria de arrastre (historial y undo/redo,
  insertar/eliminar vértices, snap): `03-arrastre.js` mide justo esa maquinaria y
  hay que revalidarlo — en especial `marcador.reutilizado`, `filaReutilizada` y
  `cambios.numeroDeVertices`.
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
