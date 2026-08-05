# Smoke en navegador real — F03 · Fase 4

Runbook de la **tarea 4D**: lo que `jsdom` no puede probar de F03. La suite
(1.855 pruebas) ya cubre la lógica; aquí se comprueba lo otro: que **el servicio
responda con el tamaño pedido**, que **el canvas quede limpio**, que la
atribución sea **visible** (jsdom no calcula layout) y que el arrastre funcione
con la **maquinaria real de `L.Draggable`**.

- **4D.1** (esta carpeta) escribió los guiones y los probó en seco.
- **4D.2** es la ejecución oficial, con evidencia, siguiendo este documento.

Quince guiones, un veredicto **serializable** cada uno (`{ok: boolean, …medidas}`),
para que el resultado no dependa de interpretar prosa. Catorce son de aceptación;
`05` es de diagnóstico (§11):

> ⛔ **Esta cuenta decía «trece» y se quedó vieja el 2026-08-04**, cuando T4 del
> rework añadió `14-shell.js` y su §20 sin volver a esta tabla. Lo corrige T10, y
> se anota en vez de borrarse porque es **el mismo defecto que T10 existe para
> tapar**: una cifra escrita a mano en prosa que nadie vuelve a mirar. La de la
> hoja de estilo ya no se escribe a mano (§21); ésta sigue haciéndolo, así que
> **si añades un guion, esta tabla es parte del guion**.

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
| `10-comprobar-gml.js` | F08 · 1 a 4 · **+ los tres arreglos del check visual** | **soltar un fichero de verdad** de punta a punta (bytes reales, velo con `opacity` calculada, `File.arrayBuffer()`), el cajón que no tapa ninguno de los cinco controles del mapa, los dos cajones que no coinciden, el informe que baja con BYTES, el invariante de los ~267 px, la tipografía real de los botones de los dos cajones y —desde el 2026-08-02— **el REENCUADRE** (viaja con otra parcela, no se mueve al editar), **las COLINDANTES dibujadas** y **el CAMPO de la referencia** | ⚠️ **`ok:false` desde el 2026-08-04 y PENDIENTE DE REVISIÓN: conduce el flujo anterior al rework, no hay defecto de producto detrás** — ver §16 |
| `11-informe-pdf.js` | F09 · **1** a 5 | ⭐ **el CRITERIO 1, que solo se puede medir aquí**: `toDataURL` sobre un lienzo con una tesela REAL del WMS, **con control negativo** (sin `crossOrigin` tiene que lanzar); el PDF que baja con BYTES de verdad (`%PDF`, páginas declaradas, el plano `/DCTDecode` dentro); que componer **no cierre nada por debajo** (tercera aparición del mismo defecto); el `<dialog>` como modal DE VERDAD (capa superior, fondo inerte, `Escape`), el encaje del modal en la ventana, el invariante de la caja de vértices y la tipografía de los cuatro botones nuevos | `ok:true` — ver §17 |
| `12-expedientes.js` | F10 · 1 a 6 | ⭐ **que los bytes están en una base de VERDAD** (la suite entera de F10 corre sobre `fake-indexeddb`, que no es una base de datos): supervivencia a la recarga contrastada contra `performance.timeOrigin`, segunda conexión a IndexedDB, `persist()`/`estimate()` reales, las tres exportaciones con sus BYTES, el `<dialog>` como modal y el invariante de los 267 px | `ok:true` — ver §18 |
| `13-edificio.js` | F11 · 1 a 4 | ⭐ **el guardián de ANCHO del conmutador, que solo existe aquí** (sustituye al `flex-wrap: nowrap` que el plan pedía por error); **M10 ida y vuelta en un navegador real** —mismo nodo, mismo valor, oyentes vivos—; el invariante de los 267 px y las tres cifras de M8; que las huellas del DXF **se ven y ENCIMA de la parcela** (orden real de los panes, no solo que existan los `<path>`); soltar un `.dxf` de verdad en las DOS ramas, con su diálogo de reparto por capas; la ficha del pie que cambia de cara; y ⭐ **el reparto de altura del panel, en vacío y con datos, con el recorte a CERO EXACTO y el déficit en píxeles cuando no llega** | ✅ **`ok:true` desde el 2026-08-04**: los dos defectos de F11 cerrados, el segundo **por el rework** — ver §19 |
| `14-shell.js` | Rework · 1 a 4 | la cáscara de tres columnas y su coste en píxeles, en **las DOS pasadas de D5** (1280×720 y 1440×900): ancho del rail, desborde del panel, el invariante de `#tabla-vertices`, cuántas tarjetas de aviso caben enteras y cuánto queda escondido tras el pliegue; **se detecta solo** en cuál de los dos mundos está (`LINEA_BASE` sin rail / `SHELL` con él); y desde la rebanada 4, **si el diagnóstico sigue en pantalla después de tocar el mapa** | `ok:true` en las dos — ver §20 |
| `15-contraste.js` | Rework · T9 | ⭐ **la RUTA CRÍTICA 2 entera** (soltar el GML de otro → contrastarlo → cruzar la puerta), que hasta T9 no se podía andar; y sobre todo **que la puerta de D4 SE VE**: dentro del cajón, dentro de la ventana y con `elementFromPoint` devolviéndola —las tres patas, porque con una sola el defecto salía verde—; más la procedencia que cambia al cruzar y el invariante de la caja de vértices | ⛔ **encontró un defecto real el 2026-08-04, ya corregido; hoy `ok:true` en las dos** — ver §22 |

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

`11` es el de F09 y **el único de esta carpeta que mide un criterio de aceptación
que la suite NO puede medir en absoluto**. Los demás miden lo que jsdom hace mal
o a medias; éste mide lo que allí **no existe**: en jsdom no hay contexto 2D —el
paquete `canvas` no está instalado ni se va a instalar—, así que el criterio 1 de
F09 («el canvas compuesto exporta con `toDataURL` sin `SecurityError`») no tiene
dónde ejecutarse. El plan de F09 lo declaró por escrito como desviación 1 y lo
trasladó aquí. Y como una comprobación que solo puede salir bien no prueba nada,
lleva **control negativo**: la misma cartografía cargada sin `crossOrigin`, que
tiene que contaminar el lienzo y hacer que `toDataURL` **lance**. Ver §17.

`13` es el de F11 y **el tercero de esta carpeta que encuentra defectos de
producción** (el `10` encontró dos, el `12` uno, y éste otros dos). Mide la segunda
rama de la aplicación: el conmutador, el panel de edificio que SUSTITUYE al de
parcela, las huellas del DXF pintadas en el mapa y el reparto de altura del panel
nuevo. Lo último es lo que más caro sale de no hacer, y por eso está aquí y no en
la suite: **jsdom no calcula ni un píxel**, así que un panel que no cabe sale verde
en las 5.734 pruebas. Encontró **dos defectos** el 2026-08-04 y se corrió **tres
veces** ese día, cada una detrás de un arreglo que salía de la cifra que la
anterior había medido: 4 problemas → 3 → **1**. Hoy queda **una fila de lista:
18,33 px**. Las tres corridas están en §19 y **no se borran, igual que las del §16
y el §18**: la secuencia es lo que vale. Es también el guion que pone el **guardián
de ANCHO** que la sección de F11 de `estilos/app.css` reclama por escrito, el que
exige el **recorte del panel a cero exacto** y el que vigila que una advertencia no
se diga **dos veces**. Ver §19 **antes** de citarlo.

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
- **`11-informe-pdf.js`, cuando cambie cualquier pieza del informe de F09.** Es lo
  único que mide **el criterio de aceptación 1** —y no «lo mide mejor»: es que en
  jsdom **no hay contexto 2D** y allí no se puede medir en absoluto—, más la cadena
  entera hasta los bytes del PDF en un navegador de verdad. Los disparadores, por
  lo que cada uno rompería:
  - **`report/canvas.js`** (el orden `crossOrigin` → `src`, la comparación de
    `naturalWidth`/`naturalHeight` contra lo pedido, la caída silenciosa de
    `toDataURL` a PNG) y **`viewer/wms-catastro.js#getMapUrl`** — el guion lleva
    una **copia deliberada** de la forma de esa URL, como `04` con los literales
    legales: si divergen, el guion debe fallar. Si el WMS dejara de emitir
    `Access-Control-Allow-Origin: *`, esto es lo único que lo vería.
  - **`report/pdf.js`** y **`report/pdf-parcela.js`** — el guion afirma `%PDF-1.4`,
    `%%EOF`, el nodo `/Type /Pages /Count N` y la imagen `/DCTDecode`. Cambiar la
    versión del PDF o cómo se empotra el JPEG mueve esas afirmaciones.
  - **`app/dialogo-informe.js`** (el `<dialog>`, sus cuatro selectores de acción,
    el gate del acuse) y **`app/cableado-informe.js`** (el DNPRC, su caché por
    expediente, el cierre programático al bajar el PDF).
  - **`viewer/cajon-diagnostico.js#enDialogo`** y **`gml/descargar.js`** — las dos
    correcciones de «no cerrar nada por debajo». El guion es lo único que las ve
    volver.
  - **`report/literal.js`** y su `PRESUNCION`: de ahí sale el bloque de advertencia
    y el gate de «Componer PDF».
  - `estilos/app.css`, tramo de F09 (el modal, su `::backdrop`, su
    `overscroll-behavior` y la familia tipográfica de los botones).
  - y los **selectores del contrato**, que el guion lleva copiados a propósito:
    `[data-accion="preparar-informe"]`, `[data-estado="informe-contraste"]`,
    `[data-accion="componer-pdf"]`, `[data-accion="cancelar-informe"]`,
    `[data-accion="regenerar-lindero"]`, `[data-estado="dialogo-informe"]`,
    `[data-informe="presuncion"]`, `[data-informe="presuncion-tramos"]`,
    `[data-informe="acuse-presuncion"]`, `[data-informe="literal"]` y
    `.gml-dialogo-informe`.
  ⚠️ Antes de repetirlo, léete el régimen de uso de §13 (llama a dos servicios
  reales) y el §17 entero.
  HECHO **dos veces el 2026-08-02**: la primera dio `ok:`**`false`** por **un falso
  positivo de la MEDIDA, no un defecto de producción** —33 px que eran del renglón
  de colindantes de F05—; corregida la ventana de medida y añadida la atribución de
  la pérdida, la segunda dio `ok:`**`true`** con `problemas: []` y
  `advertencias: []`, en pasada en FRÍO, con 2 peticiones de datos y consola
  limpia. Las dos, y el porqué, en §17.
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
  desde la corrección del defecto 1**: los botones se pintan en
  `"Geist Sans", system-ui, -apple-system, sans-serif`. Desde F09 (T4.2) son
  **cuatro**: entra «Preparar informe (PDF)», que nació con el mismo reparto y se
  rompería igual de callado.
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
  `diceQueNoLlevaPieDeFirma: true`, `remiteAlInformeFirmable: true` y
  `siguePresumiendoDeQueElFirmableNoExiste: false` ← **reescritos en F09
  (T4.2)**: el desmentido decía que el documento firmable «todavía no existe» y
  ya existe, así que ahora se mide que niegue el pie de firma **y** remita a
  «Preparar informe (PDF)», `nombraElFicheroDeOrigen: true` y
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

---

## 17. `11-informe-pdf.js` — el informe firmable en PDF (F09 · T6.2)

El guion de F09, y **el único de esta carpeta que mide un criterio de aceptación
que la suite no puede medir en absoluto**. Los otros diez miden lo que jsdom hace
mal o a medias —no calcula layout, no tiene cascada, no burbujea igual, no tiene
`DataTransfer`—; aquí el problema es de otra clase: **en jsdom no hay contexto
2D**. El paquete `canvas` no está instalado ni se va a instalar (es una
dependencia nativa con toolchain de C++ para probar una línea), así que el
criterio 1 de F09 —«el canvas compuesto exporta con `toDataURL` sin
`SecurityError`»— **no tiene dónde ejecutarse**. El plan de F09 lo declaró como
desviación 1 antes de escribir una línea y lo trasladó a este fichero.

> ✅ **Sale `ok:true`, `problemas: []` y `advertencias: []`** (corrida de cierre,
> **2026-08-02**, pasada en FRÍO con la base de IndexedDB borrada).
> ⛔ **La PRIMERA corrida salió `ok:false`, y esta vez NO era un defecto de
> producción: era LA MEDIDA.** El guion acusó al diálogo de robarle 33 px a la
> caja de vértices, y esos 33 px eran de **F05**. Está contado abajo, en «El falso
> positivo de la primera corrida», y no se borra por lo mismo que no se borra la
> primera corrida de `10`: un guion que solo enseña su versión buena no enseña
> nada.

### Qué mide, y por qué NO lo mide la suite

La suite ya cubre el escritor de PDF (`test/report/pdf.test.js`, **con snapshot de
bytes** — algo que con jsPDF no se habría podido hacer), la maqueta
(`test/report/pdf-parcela.test.js`), el encuadre y el troceado
(`test/report/encuadre.test.js`), el literal (`test/report/literal.test.js`), la
firma (`test/report/firma.test.js`), el diálogo
(`test/app/dialogo-informe.dom.test.js`) y el cableado
(`test/app/informe.dom.test.js`). **Aquí no se vuelve a medir nada de eso.** Lo
que se añade es lo que solo existe con un navegador delante:

1. ⭐ **EL CRITERIO 1, con CONTROL NEGATIVO.** Se pide una tesela **real** al WMS
   del Catastro en `EPSG:25830`, se dibuja en un lienzo y se exporta:

   - **caso positivo** — `crossOrigin='anonymous'` puesto **antes** de `src`,
     `toDataURL('image/jpeg')` que **no lanza** y devuelve un JPEG de verdad (se
     comprueba el prefijo: `toDataURL` **cae a PNG sin avisar** si el tipo no está
     soportado, y es la segunda sustitución silenciosa que documenta
     `report/canvas.js`);
   - **control negativo** — la misma cartografía **sin** `crossOrigin`, que tiene
     que dejar el lienzo contaminado y hacer que `toDataURL` **LANCE**.

   ⚠️ **Si el control negativo no falla, el guion lo cuenta como PROBLEMA, no como
   éxito.** Un control que no falla significa que el navegador no está aplicando la
   política de origen (una extensión, una bandera de arranque, un proxy que
   reescribe cabeceras) y que **el caso positivo saldría verde con el código
   roto**. Es la misma doctrina que `04` con `coincidePorIdentidad`: una
   comprobación que solo puede salir bien no es una comprobación.

   ⚠️ **Y las dos cargas usan URLs DISTINTAS** (el BBOX del control va desplazado
   un metro). No es aseo: la caché HTTP del navegador guarda la respuesta y una
   segunda carga del mismo recurso puede reutilizarla, con lo que el resultado
   dependería del orden de las dos y de qué guardó el disco.

   Lo que la suite **sí** puede probar de esto, y es el fallo REAL, es que
   `crossOrigin` se asigna **antes** que `src` (`test/report/canvas.dom.test.js`,
   con un `Image` falso que registra el ORDEN). Al revés la petición ya salió sin
   cabecera `Origin`, el navegador no la reintenta, y la única señal llega al final
   del todo.

2. **Que el PDF baje y sean BYTES.** Misma cadena
   `Blob → createObjectURL → <a download> → click() → revoke` que miden `06` (el
   GML) y `10` (el informe de texto), con el mismo patrón de captura (§12) y la
   misma promesa: los tres envoltorios se restauran en un `finally` y el veredicto
   lo DECLARA (`informe.captura.restaurado`). La diferencia con `10` es que aquí la
   composición es **asíncrona** —hay una `GetMap` de 200 kB por medio—, así que los
   envoltorios siguen puestos mientras se espera. Lo que se afirma es de **nivel de
   byte**: `%PDF-1.4`, `%%EOF` al final, el nodo `/Type /Pages /Count N` del árbol
   de páginas, y **una imagen `/DCTDecode`** dentro. Esa última es, de rebote, la
   **prueba de extremo a extremo del criterio 1**: el plano solo puede entrar en el
   PDF a través de `toDataURL` sobre el lienzo compuesto, así que si está, es que
   no lanzó **dentro de la aplicación de verdad**.

3. **Que componer NO CIERRE NADA POR DEBAJO.** Es la **tercera aparición de la
   misma familia de defectos** en este proyecto, y por eso se mide en vez de
   suponerse:

   - **F08** — el `click()` del `<a download>` burbujeaba hasta `document`, el
     guardián de clic-fuera del cajón de diagnóstico lo veía como un clic FUERA y
     **cerraba el cajón**; el acuse de recibo se escribía en un `role="status"` que
     acababa de quedar en `display:none`. Corregido en `gml/descargar.js`, con
     `stopPropagation` en fase de **captura** sobre el propio anchor.
   - **F09 · T5.1** — lo mismo con los clics **dentro del `<dialog>`**, que cuelga
     del `<body>` y por tanto está FUERA del cajón: componer el PDF cerraba el
     cajón **por debajo del modal**, y el usuario no lo veía hasta cerrar el
     diálogo. Corregido en `viewer/cajon-diagnostico.js` con la guarda `enDialogo`,
     en los DOS guardianes (clic fuera **y** `Escape`).

   Se mide con las dos teclas del gesto: `Escape` sobre el diálogo y el clic de
   «Componer PDF». Tras los dos, el cajón sigue abierto **y el contraste sigue
   pintado en el mapa** (`<path>` en el pane `diagnostico`).

4. **Que el `<dialog>` sea un modal DE VERDAD.** Lo que jsdom no tiene, MEDIDO
   (jsdom 29.1.1): `HTMLDialogElement.prototype` expone **exactamente una** cosa,
   la propiedad reflejada `open`. No hay `showModal()`, ni `close()`, ni capa
   superior, ni `::backdrop`, ni atrape de foco, ni `inert`.
   `app/dialogo-informe.js` detecta la capacidad y cae al atributo `open` para
   poder probarse en la suite, así que **la mitad que de verdad se usa en
   producción solo se ejercita aquí**: `:modal` (o sea, la capa superior), el foco
   dentro al abrir, el **fondo inerte** —un `.focus()` sobre un control del panel
   no se lleva el foco— y `Escape`.

5. **Que el modal quepa en la ventana.** Tapa el mapa **a propósito** (Decisión 3
   de F09: esto no anota la cartografía, prepara un documento), así que el solape
   se publica como NÚMERO y sin juicio, igual que `09` publica el porcentaje de
   lienzo que tapa el cajón. Lo que sí se caza es que se salga de la ventana
   (formulario inalcanzable) o que la página desborde en horizontal.

6. **El invariante heredado, cuarta fase seguida.** Y con una vuelta de tuerca: la
   pérdida se **ATRIBUYE**. Ver «El falso positivo de la primera corrida».

7. **La tipografía de los CUATRO botones nuevos**, derivada del token
   `--font-sans` leído del `:root` y no de un literal copiado. Es la medida que
   destapó el defecto 1 de `10`: una regla escrita, puesta y muerta porque un
   `font:inherit` en línea le gana a la hoja. En jsdom no hay cascada que lo
   delate.

Y de propina, para el checklist: se publica **entero** el borrador del lindero que
redacta `report/literal.js`, y se mide el mecanismo de la **presunción de vía
pública** —el único sitio de toda la aplicación donde se PROPONE en vez de medir—:
que el bloque de advertencia salga de `tramos[].presuncionNoVerificada` y no del
texto, que «Componer PDF» nazca apagado con el motivo escrito en el mismo paso, y
que marcar el acuse lo encienda. Si esa frase **se lee** como un veredicto es el
punto BLOQUEANTE del checklist §10.5.

### Régimen de red — léete el §13 antes de lanzarlo

**Más barato que el de `09`**, y a propósito. Una pasada, sin bucles, y **el
informe se compone UNA sola vez**. Seis peticiones como mucho, de dos clases:

**DATOS del Catastro** (las que manda el override O8 — la denegación por abuso es
de ~10 días):

- **GetNeighbourParcel** — 1, al abrir el cajón de diagnóstico; **0** si otro
  gesto ya trajo las vecinas o si la caché de IndexedDB sigue dentro del TTL (y
  entonces el veredicto lo dice en `advertencias`, porque esa pasada no mide ni el
  servicio ni CORS).
- **Consulta_DNPRC** — 1, al pulsar «Preparar informe (PDF)». Es el **+1 de
  presupuesto** que F09 declaró en su plan, y va **solo para la parcela propia**:
  pedirlo también para las cuatro colindantes serían 5 peticiones por informe.
  **Reabrir el diálogo cuesta 0** y también se comprueba
  (`reapertura.peticionesDnprc`): `app/cableado-informe.js` cachea los descriptivos
  por expediente.

⚠️ **NO se pulsa «Traer del Catastro»**, a diferencia de `09`: la parcela de
demostración **ya trae `geometriaOficial`** (es el estado de una parcela recién
traída), así que el CTA nace encendido y el GetParcel no hace falta. Lo único que
se pierde es la superficie catastral **declarada** de la tabla a tres bandas, que
es de F07 y la mide `09`.

**CARTOGRAFÍA** (WMS, sin cuota conocida, pero pesa):

- **2 `GetMap` pequeñas** (512×384, ~44 kB cada una) para el experimento del
  criterio 1 — una con CORS y otra sin él, con URLs distintas.
- **1 `GetMap` grande** (2126×1535, **194.101 B**) — el plano del informe, a 300
  ppp. Una, y solo una: por eso el informe se compone una vez. Si salieran más de
  dos, el guion lo dice en `advertencias` (sería troceado, o el sondeo capa a capa
  que `componerPlano` hace cuando la petición junta falla).

### Cómo se lanza

Página recién cargada, desde la raíz del repo:

```bash
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/    # ⚠️ el base, no la raíz
$B wait ".gml-tabla-vertices"
$B console --clear
$B network --clear
$B eval scripts/smoke-navegador/11-informe-pdf.js

$B console --errors                             # → (no console errors)
$B network | grep -E "wfsCP|Consulta_DNPRC"     # → ≤ 2 peticiones de datos
$B screenshot .gstack/smoke-f09.png             # la evidencia para el §10
```

Para forzar la pasada **en frío** —la única que mide los dos servicios de datos de
verdad—, borrar la base antes de recargar; el `deleteDatabase` queda BLOQUEADO
mientras la app tiene la conexión abierta, así que el orden importa:

```bash
$B js "await new Promise(r=>{const p=indexedDB.deleteDatabase('concreta-gml');p.onsuccess=r;p.onerror=r;p.onblocked=r}); return 'pedido'"
$B reload && $B wait ".gml-tabla-vertices"
```

⚠️ **Orden y estado final.** El guion deja **el cajón de diagnóstico abierto con el
contraste pintado** y el diálogo **cerrado** —lo cierra el propio cableado al bajar
el PDF, programáticamente, así que no cuenta como que el usuario se echó atrás—, a
propósito: la captura tiene que enseñar que componer **no se llevó nada por
delante**. Lo declara en `estadoFinal`. No lo encadenes antes de `02` (le contamina
la cuenta de `GetMap` con sus tres peticiones) ni de `06` (contrasta el `areaValue`
contra el dataset de arranque). Para repetirlo:
`$B reload && $B wait ".gml-tabla-vertices"`.

### Qué cuenta como «pasa»

`ok: true` y `problemas: []`, y además:

- ⭐ `criterio1.conclusion` = **«CRITERIO 1 DEMOSTRADO: con CORS exporta, sin CORS
  lanza»**. Las dos mitades, y las dos hacen falta:
  `criterio1.conCors.exportacion.lanzo: false` con `esJpeg: true`, **y**
  `criterio1.controlNegativo.contaminaComoDebe: true` con `esSecurityError: true`.
- `criterio1.conCors.tamanoCoincideConLoPedido: true` — la comprobación que
  `report/canvas.js` hace en producción contra el techo silencioso del WMS
  (pasarse de 4000 px por eje **no recorta: SUSTITUYE**, con HTTP 200 y sin una
  palabra).
- `arranque.prepararHabilitado: false` **con el motivo escrito** (regla de oro 1) y
  `arranque.bloqueInformeEnElPanel: false` (la Decisión 3: la interfaz de F09 es un
  modal, no un bloque).
- `arranque.dialogoEnElDomAlArrancar: true` — el `<dialog>` se fabrica al
  construir, no al abrir: creado al vuelo, el `nodo()` del cableado lanzaría al
  arrancar.
- `modal.enLaCapaSuperior: true` (`:modal` casa), `focoDentroAlAbrir: true` y
  `fondoInerte: true`.
- `encaje.dentroDeLaVentana: true` y `paginaSinScrollHorizontal: true`. El
  `solapeConElMapaPx2` es un número, **no un veredicto**.
- `tipografia.todosConLaFamiliaDeLaApp: true` en los cuatro.
- `escape.dialogoCerrado: true` **y** `escape.cajonSigueAbierto: true` **y**
  `escape.contrasteSiguePintado: true`.
- `reapertura.peticionesDnprc: 0`.
- `presuncion.componerHabilitadoAntes: false` con `motivoEscrito: true`, y
  `componerHabilitadoDespues: true` al marcar el acuse.
- `informe.empiezaPorPDF: true`, `tieneEOF: true`, `paginasDeclaradas ≥ 1`,
  `llevaPlanoJpeg: true`, `tipoDelBlob: "application/pdf"`,
  `captura.restaurado: true`, `captura.blobsCapturados: 1` y
  `captura.revocaLaQueCreo: true`.
- `informe.nadaSeCerroPorDebajo`: `cajonSigueAbierto: true` y
  `contrasteSiguePintado: true`, con `dialogoCerradoPorElCableado: true` (ése SÍ se
  cierra, y es correcto).
- `invariante.abrirNoRoboAltura: true` con `perdidaImputableAlDialogoPx: 0`.
- `red.datos.total ≤ 2` y `consola.excepcionesNoCapturadas: 0`.

`advertencias` **no** tumba nada: recoge lo que limita la medida (una pasada en
caliente que no ejercita los servicios, el control negativo que no cargó, más de
dos `GetMap` para el plano).

### ⛔ El falso positivo de la primera corrida (2026-08-02) — y qué se cambió

La primera corrida salió `ok:false` con **un** problema:

> *«Abrir el diálogo le ha quitado altura a la caja de vértices (267 → 234 px en el
> tick de la apertura, con las mismas 0 tarjetas de aviso).»*

**Y era mentira, pero no del todo.** Los 33 px existen y están medidos; lo que no
es cierto es de quién son. Medido paso a paso: pulsar «Diagnosticar encaje» pide
las colindantes, y **cuando llegan —~300 ms después, incluso saliendo de
IndexedDB, porque la lectura es asíncrona igual—** el renglón
`[data-estado="cargar-catastro"]` **de F05** escribe «El Catastro ha devuelto 4
colindantes de la parcela 9398516VK3799G.», crece a dos líneas, el bloque «Origen
de la parcela» pasa de **135 a 173 px** y la caja de vértices baja de **267 a 234
px**. No es un defecto: es la regla de oro 1 funcionando, y la caja sigue muy por
encima del umbral de 220. Pero **estaba sin medir**, y el guion se lo cargó a F09
porque su ventana de medida empezaba **antes** de que ese renglón hablara.

Y hay un segundo hallazgo de la misma familia, éste de contabilidad: en la pasada
en frío el guion decía `peticionesGetNeighbour: 0` **con la base recién borrada**.
La causa es la misma: **Resource Timing solo apunta un recurso cuando TERMINA**, y
el cajón se abre en el mismo tick del clic, así que la cuenta se tomaba con la
petición todavía en vuelo. Un contador que dice cero por llegar pronto es peor que
no tenerlo: se lee como «no se pidió nada».

**Lo que se cambió, y dónde:** las dos cosas en el guion, ninguna en producción,
porque no había nada roto que arreglar.

1. **Se espera a que el panel se asiente** (`asentarPanel`: dos lecturas seguidas
   con el mismo alto) antes de tomar la referencia del invariante **y** antes de
   contar peticiones.
2. **La pérdida se ATRIBUYE.** El veredicto publica `bloqueOrigenAntesPx` /
   `bloqueOrigenDespuesPx` y solo acusa al diálogo de
   `perdidaImputableAlDialogoPx`, que es lo que no explican ni ese bloque ni una
   tarjeta de aviso nueva. Si algún día falla, dirá **quién** se llevó los píxeles.
3. Y se publica el hallazgo como cifra propia:
   `invariante.costeDeLasColindantesPx`, con el renglón que lo causó al lado.

> **La lección, y es simétrica de la que ya pagó F07.** El guardián de F07 falló
> por medir **demasiado tarde** («un rato luego») y acusó al cajón de 11 px que
> eran de otros renglones hablando después. Su cabecera dejó escrito «nada de medir
> un rato luego», y este guion pisó el error contrario: medir **demasiado pronto**,
> con algo todavía en vuelo. La regla que sale de las dos no es «mide pronto» ni
> «mide tarde»: es **espera a que se asiente y atribuye lo que pierdas**.

### Cifras de referencia (corrida de cierre, **2026-08-02**, `npm run dev`, puerto 5173, pasada en FRÍO)

`ok: true`, `problemas: []`, `advertencias: []`. Sirven para detectar una
desviación, no como valores canónicos. Viewport 1440×900, lienzo 1048×900,
duración **2,97 s**, consola **limpia** (`$B console --errors` → *(no console
errors)*, `consola.excepcionesNoCapturadas: 0`), **2 peticiones de datos**
(GetNeighbourParcel 11.969 B en 123 ms + Consulta_DNPRC 6.817 B en 769 ms, las dos
200) y **3 al WMS**.

| Medida | Valor |
|---|---|
| ⭐ **Criterio 1 · con CORS** | tesela 512×384 en **244 ms**, tamaño exacto; `toDataURL('image/jpeg')` **no lanza**, prefijo `data:image/jpeg;base64,/9j/4AA`, **77.987** caracteres |
| ⭐ **Criterio 1 · control negativo** | misma cartografía sin `crossOrigin` ⇒ **`SecurityError: Tainted canvases may not be exported`** ✅ |
| Peticiones del experimento | **2** `GetMap` de 512×384 · 44.163 B y 44.666 B, las dos 200 |
| Caja de vértices al arrancar (avisos vacíos) | **267 px** — los mismos que dejaron F07 y F08 |
| Caja tras pedir el diagnóstico | **234 px**. Los **33 px** son el renglón de colindantes **de F05** creciendo a dos líneas (bloque «Origen de la parcela»: 135 → 173 px). **No es de F09** |
| Caja en el tick en que se abre el diálogo | **234 → 234 px** ⇒ **`perdidaImputableAlDialogoPx: 0`**. La Decisión 3 se cumplió |
| El cajón de diagnóstico | 420 × 468 px en `(402, 401)`, mapa intacto, **4** `<path>` en el pane `diagnostico` |
| El diálogo abierto | **760 × 792 px** en `(340, 54)`, dentro de la ventana, sin scroll horizontal de página |
| Solape del diálogo con el mapa | **560.736 px²** = **59,5 %** del lienzo — **a propósito**: es un modal, no una anotación |
| Contenido del diálogo | `scrollHeight` 1.336 > `clientHeight` 790 ⇒ **scrollea dentro**, con `overscroll-behavior: contain` |
| `<dialog>` como modal | `:modal` **casa** · `aria-modal="true"` · velo `srgb(.059 .090 .165 / .45)` · foco dentro (`input`) · **fondo inerte** (`.focus()` sobre `[data-campo="refcat"]` no se lo lleva) |
| `Escape` | cierra el diálogo · **cajón sigue abierto** · **4 → 4** trazos de contraste ✅ |
| Reabrir el diálogo | **0** consultas al DNPRC |
| Presunción de vía pública | **1 tramo** (Noroeste, 9 lados, 47,21 m). «Componer PDF» nace **apagado** con su motivo escrito; marcar el acuse lo **enciende** |
| Borrador del lindero | **1.664 caracteres**, 4 tramos + nota técnica; perímetro 163,12 m; 3 colindantes nombradas por referencia + 1 presunción |
| Composición del PDF | **856 ms**, **1** `GetMap` de 2126×1535 → **194.101 B** en 284 ms |
| **El PDF** | **326.851 B** · `%PDF-1.4` · `%%EOF` · **4 páginas** declaradas · **1** imagen `/DCTDecode` ✅ · `application/pdf` |
| Nombre del fichero | `informe-contraste-CG-9398516VK3799G-20260802-200537Z.pdf` (lleva el `idDocumento` dentro: dos informes del mismo día no se pisan) |
| Blob | **1** creado, **1** revocado, **la misma URL**; anchor fuera del DOM; los 3 envoltorios restaurados |
| **Tras componer** | cajón **abierto**, **4 → 4** trazos de contraste, diálogo cerrado por el cableado, acuse legible en el pie ✅ |
| Tipografía de los 4 botones nuevos | `"Geist Sans", system-ui, -apple-system, sans-serif`, derivada de `--font-sans` |

⚠️ La fila del solape del diálogo es la única de esta tabla que **no** es un
veredicto: un modal centrado tapa el mapa por definición, y la cifra se publica
para que el §10.6 del checklist la tenga delante.

Evidencia: `.gstack/smoke-f09.png` — el cajón de diagnóstico abierto con el
contraste pintado y el renglón diciendo «Descargado «informe-contraste-…pdf»», que
es exactamente lo que hay que ver para creerse que componer no cerró nada.

### Lo que este guion deja al checklist humano (§10)

**Que el PDF abra**, y en tres lectores distintos: está escrito a mano, byte a
byte, sin librería. Si el **plano se lee** (escala gráfica, cotas, norte). Si sale
bien **en papel**. Y el punto BLOQUEANTE: si alguna frase del informe **se lee como
un veredicto** —sobre el encaje o sobre el trabajo de otro técnico—, con mención
expresa a la presunción de vía pública, que es el único sitio donde la aplicación
propone en vez de medir.

---

## 18. `12-expedientes.js` — persistencia y exportación (F10 · T6.2)

El guion de F10, y **el más barato de la carpeta: no toca la red ni una vez**. No
pulsa «Traer del Catastro», no abre el cajón de diagnóstico y no compone ningún
informe — todo lo que mide es local (IndexedDB y tres serializadores puros), así
que se puede repetir sin mirar el §13.

> ✅ **Sale `ok:true`, `problemas: []` y `advertencias: []`** (corrida de cierre,
> **2026-08-03**, `npm run dev`, puerto 5173, viewport 1440×900).
> ⚠️ **Hay que lanzarlo DOS VECES, con un `$B reload` en medio**, y no es opcional:
> la primera corrida no puede medir la supervivencia (no hay carga anterior de la
> que heredar) y lo DECLARA en `noCubierto`. La segunda es la que firma el
> criterio 1.
> ⛔ **La primera corrida destapó un defecto de producción**, y está contado abajo
> en «El defecto que este guion destapó»: no se borra, por lo mismo que no se
> borran los de `10` y `11`.

### Qué mide, y por qué NO lo mide la suite

**La suite de F10 corre entera sobre `fake-indexeddb`, que no es una base de
datos**: es una implementación en memoria que muere con el proceso. O sea que la
promesa entera de la fase —«el trabajo se guarda»— es, en la suite, incomprobable
por construcción. Un test que dijera «sobrevive a la recarga» sería mentira de las
tranquilizadoras. Aquí se cierra ese hueco por dos caminos complementarios:

1. **Segunda conexión.** Se guarda un expediente por la interfaz y luego se abre
   `indexedDB.open('concreta-gml')` **aparte**, sin pasar por `storage/bd.js` —que
   MEMOIZA su conexión y devolvería la misma—, y se lee el registro de ahí. Si
   aparece, los bytes están en el almacén del navegador y no en una variable de
   módulo. De paso se comprueba que el almacén `expedientes` existe **con sus dos
   índices** (`actualizado`, `refcat`), que es la migración de la versión 3.
2. ⭐ **Herencia entre cargas.** El guion deja siempre un expediente marcado
   (`HUMO F10 · dejado por 12-expedientes.js`) y, al arrancar, busca el que dejó
   una carga anterior. **Y no se conforma con encontrarlo**: compara su
   `actualizado` contra `performance.timeOrigin` —el instante en que este documento
   empezó— y solo lo da por herencia si es ANTERIOR. Sin esa comparación, lanzar el
   guion dos veces sin recargar daría el criterio por firmado encontrándose su
   propia marca; con ella, el guion lo dice: «la marca que hay en la lista la ha
   escrito ESTA misma carga, así que no cuenta».

Y otras cinco cosas que jsdom no puede dar:

3. **`navigator.storage.persist()` y `estimate()` reales.** Se publica el
   **régimen** (`persisted()`), la cuota y el uso, como NÚMEROS y nunca como
   problema: que el navegador diga que no es la respuesta normal de un sitio sin
   interacción previa (medido en la fase 0) y no un defecto de la aplicación. Lo
   que sí sería defecto —que la aplicación prometiera una durabilidad que no
   tiene— se caza mirando el ACUSE del guardado.
4. **Las tres exportaciones, con sus bytes.** Misma cadena
   `Blob → createObjectURL → <a download> → click() → revoke` y mismo patrón de
   captura que `06`, `10` y `11` (§12). Lo que se afirma es de nivel de byte: que
   el DXF **cumple la versión que declara** (⛔ ver §24: hasta el 2026-08-05 aquí se
   comprobaba `$ACADVER === 'AC1015'`, y el fichero cumplía eso y nada más — colgaba
   ZWCAD) y trae **las dos capas en su TABLA LAYER** —no basta con que
   las entidades las nombren: sin la sección `TABLES` el auditor de `ezdxf` da 0
   errores y las capas NO EXISTEN—, que el listado lleva **coma decimal española**
   y ni un punto inglés, y que el `.json` se vuelve a leer con su sobre
   `concreta-gml/proyecto` y sus 15 vértices intactos.
5. **Que abrir el diálogo y exportar no cierren nada por debajo.** CUARTA aparición
   de la misma familia (F08: el `click()` del `<a download>`; F09: los clics dentro
   del `<dialog>`; F10: otro diálogo y tres botones que descargan).
6. **El invariante heredado de los 267 px** —quinta fase seguida—, con
   `asentarPanel()` y con ATRIBUCIÓN de la pérdida, que son las dos lecciones ya
   pagadas (F07 midió demasiado tarde, F09 demasiado pronto). Y una medida que solo
   tiene sentido aquí: **la fila del rótulo con DOS botones dentro**, su alto y la
   **holgura** que queda antes de que se parta.
7. **El `<dialog>` como modal de verdad** (`:modal`, foco dentro, fondo inerte,
   `Escape`, `display:none` al cerrar) y **la tipografía** de los botones nuevos,
   derivada del token `--font-sans` del `:root` y no de un literal copiado.

### Régimen de red

**Cero peticiones.** El único guion de la carpeta del que se puede decir esto.

### ⚠️ Este guion necesita `npm run dev`, NO `vite preview`

Lo mismo que el §16 y el §17: las cifras de referencia están medidas sobre
`npm run dev` bajo el `base` de Pages (`/concretagml/`).

### Cómo se lanza

```
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/     # ⚠️ el base, no la raíz
$B wait ".gml-tabla-vertices"
$B console --clear
$B eval scripts/smoke-navegador/12-expedientes.js
$B reload && $B wait ".gml-tabla-vertices"        # ⭐ y AHORA la segunda vez:
$B eval scripts/smoke-navegador/12-expedientes.js #    mide la SUPERVIVENCIA
$B console --errors                               # → (no console errors)
$B screenshot .gstack/smoke-f10.png               # la evidencia para el §11
```

**Estado final.** El guion deja **un** expediente marcado en IndexedDB a propósito
—es lo que la corrida siguiente hereda— y borra los sobrantes que haya creado él.
Para dejar el perfil limpio del todo, el propio veredicto trae la orden en
`estadoFinal.comoDejarLoLimpio` (un `$B js` que llama a
`indexedDB.deleteDatabase("concreta-gml")` y espera a que resuelva).

⚠️ Esa orden **borra también la caché del Catastro y el pie de firma**: la base es
una sola. Después de borrarla, `07`, `09` y `11` volverán a pedir por red lo que
tenían guardado.

### Qué cuenta como «pasa»

- `ok: true`, `problemas: []`.
- `herencia.medido: true` **en la segunda corrida** (con `marcasDeOtraCarga ≥ 1` y
  `masAntigua` anterior a `timeOrigin`). Si sale `false`, no es un fallo: es que
  falta el `$B reload`.
- `enDisco.tieneExpedientes: true`, `enDisco.indices: ["actualizado","refcat"]`,
  `enDisco.version: 3`.
- `exportaciones.blobsCapturados: 3`, `restaurado: true`, `revocaLasQueCrea: true`,
  `dxf.acadver: "AC1009"` (R12), `dxf.secciones: ["HEADER","TABLES","ENTITIES"]` y
  `dxf.capasEnLaTabla` con las dos capas.

⛔ **`arranque.altoCajaVerticesPx` ya NO se puede leer así, y da `0` (medido el
2026-08-05).** No es un defecto de producto ni tiene que ver con el DXF: tras el
rework de UI la tabla de vértices vive en
`<section data-pantalla="validacion edicion informe">`, y al arrancar el paso es
`entrada`, así que esa sección está en `display:none` **por diseño**. El guion mide
el invariante de los 267 px en el sitio donde ya no está. **Este guion queda
pendiente de revisión igual que el `10`**: lo que hay que decidir no es un selector,
sino en qué pantalla se defiende ese invariante ahora que hay cinco.
- `arranque.altoCajaVerticesPx: 267` **con `tarjetasDeAvisos: 0`**.
- `arranque.filaDelRotulo.mismaLinea: true`.
- `modal.esModal: true`, `cierre.displayTrasCerrar: "none"`.
- `$B console --errors` limpio.

### ⛔ El defecto que este guion destapó (2026-08-03, primera corrida tras recargar) — CORREGIDO

La primera vez que se lanzó **con un expediente ya guardado**, la caja de vértices
arrancó en **215 px** en vez de 267 — por debajo del suelo de 220 que este proyecto
lleva **cinco fases** defendiendo.

La causa no era del diálogo ni del botón: era un **aviso** que el cableado de F10
sacaba por el panel al arrancar, diciendo que el navegador no garantiza conservar
los datos. Una tarjeta de aviso cuesta ~52 px, y **ese aviso no se resuelve nunca**:
a diferencia de la oferta del borrador —que desaparece en cuanto el usuario la
recupera o la descarta—, ese volvía en **cada carga y para siempre** en cuanto el
usuario tuviera un expediente guardado. O sea: 52 px permanentes del sitio más caro
del panel, a cambio de repetir por tercera vez algo que ya se dice donde importa.

**Arreglado quitando la tercera repetición, no callando el hecho.** El régimen de
almacenamiento se sigue diciendo en los dos sitios donde el usuario puede actuar:
en el **acuse de cada guardado** («…El navegador no garantiza conservarlo…») y en el
**renglón del diálogo al abrirlo**, junto al texto de durabilidad que ya vivía ahí.
Lo que se quitó fue la tarjeta del arranque. Hay un test que lo fija
(`test/app/expediente.dom.test.js`, «el régimen de almacenamiento NO gasta una
tarjeta del panel al arrancar»), con el número medido escrito al lado.

Es la misma lección de siempre y van tres: **el guion no confirmó lo que ya se
sabía, midió lo que nadie había mirado**.

### Y el falso positivo que el guion se corrigió a sí mismo

Antes de la corrida buena, el guion acusaba al diálogo de no devolver el foco al
botón «Expediente» al cerrarse con `Escape`. No era cierto: en un navegador de
verdad un clic de ratón deja el foco en el botón, pero **`element.click()` no lo
mueve**, así que el `focoPrevio` que el diálogo guarda al abrirse era el `<body>`.
El guion no puede hacer gestos de ratón (§0), así que ahora hace `.focus()` antes
del `.click()` y la medida vuelve a significar lo que dice. **Un guion que acusa a
producción de un artefacto de su propia instrumentación es peor que no medir.**

### Cifras de referencia (corrida de cierre, **2026-08-03**, `npm run dev`, puerto 5173)

| Medida | Valor |
|---|---|
| Duración del guion | **1.947 ms** — sin una sola petición de red |
| Caja de vértices al arrancar | **267 px**, con `tarjetasDeAvisos: 0` ✅ (quinta fase seguida) |
| Fila «Origen de la parcela» | **15,94 px** de alto, **2 botones** dentro, **misma línea** ✅ |
| Holgura antes de que la fila se parta | **21 px**, de los cuales **8 son el `gap`** ⇒ «Expediente» **no puede crecer** |
| `navigator.storage` | `persisted()` **false** · cuota **1.809,3 MB** · uso **5,9 kB** antes de guardar |
| Base en disco | versión **3** · almacenes `catastroCache`, `expedientes`, `pieFirma`, `revgeo` · índices `actualizado`, `refcat` |
| ⭐ **Supervivencia a la recarga** | marca escrita a las **14:58:14,647Z**, página cargada a las **14:58:16,159Z** ⇒ **anterior** ✅ · **15 vértices** intactos |
| `geometriaOficial` en el registro CRUDO | **descongelada** (`Object.isFrozen === false`) — el hecho de la fase 0 que obliga a rehidratar por `crearExpediente` |
| Acuse del guardado | «Guardado «…» en este navegador. **El navegador no garantiza conservarlo**: si se queda sin espacio puede borrarlo por su cuenta.» ✅ |
| `<dialog>` como modal | `:modal` **casa** · 620×721 en 1440×900 · **cabe** · foco en el campo `nombre` · **fondo inerte** ✅ |
| Caja de vértices con el diálogo abierto | **267 px** — un modal cuelga del `<body>` y no le quita altura al panel |
| **DXF** *(hasta 2026-08-05)* | ⛔ **1.733 B** · `$ACADVER` **AC1015** — **este es el fichero que colgó ZWCAD 2023** (§24). Se deja escrito porque el guion lo daba por bueno |
| **DXF** *(remedido 2026-08-05, 1440×900, `localhost:5180`)* | **2.567 B** · `image/vnd.dxf` · `$ACADVER` **AC1009** (R12) · secciones `HEADER`, `TABLES`, `ENTITIES` ✅ · capas en la TABLA: `0`, `PARCELA_OFICIAL`, `PARCELA_EDITADA` ✅ · CRLF, **0 LF sueltos** |
| **Listado** | **2.639 B** · `text/plain;charset=utf-8` · **coma decimal** ✅ · **0** puntos ingleses |
| **Proyecto** | **3.193 B** · `application/json` · `concreta-gml/proyecto` v1 · `EPSG:25830` · **15 vértices** ✅ |
| Nombres | `parcela_9398516VK3799G_….dxf` · `coordenadas_….txt` · `proyecto_….json` — los tres derivados de `nombreFicheroGml` |
| Blobs | **3** creados, **3** revocados, **las mismas URLs**; los 3 envoltorios restaurados ✅ |
| **Tras exportar** | diálogo **abierto**, `:modal` **true**, foco **dentro** ✅ (cuarta aparición de la familia: no se llevó nada por delante) |
| `Escape` | cierra · `display:none` computado · **foco de vuelta** en «Expediente» ✅ |
| Tipografía de los 4 botones | `"Geist Sans", …`, derivada de `--font-sans`, **0 estilos en línea** |
| Limpieza | 2 marcas encontradas → **1** tras limpiar (borrado en dos tiempos, como en la interfaz) |

Evidencia: `.gstack/smoke-f10.png`.

### Lo que este guion deja al checklist humano (§11)

**Cerrar el NAVEGADOR entero** (no la pestaña) y volver — que es donde de verdad se
ve si el perfil conserva o desaloja. **Abrir el DXF en un CAD** con las dos capas
seleccionables **por capa**, que es el punto BLOQUEANTE heredado del reparto que ya
hizo F09 con el PDF: un DXF que valida contra nuestro propio parser y no abre en
AutoCAD no está exportado, está de suerte. **Dos pestañas a la vez** y el
`versionchange` de verdad. **Abrir un `.json` desde el disco**, y abrirlo en **otro
perfil o en otra máquina**. Y el punto BLOQUEANTE que hereda del 8.1, el 9.4 y el
10.5: si alguna frase de la lista de expedientes **se lee como un veredicto**.

---

## 19. `13-edificio.js` — la segunda rama (F11 · T5.2)

El guion de F11, y **el TERCERO de esta carpeta que encuentra defectos de
producción** (después del `10`, que encontró dos, y del `12`, que encontró uno).

> **TRES corridas, y hay que leerlas en orden: la secuencia es lo que vale.**
> Todas el **2026-08-04**, `npm run dev`, 1440×900, consola limpia y **cero
> peticiones a los servicios de datos del Catastro**.
>
> | # | Veredicto | Qué pasó |
> |---|---|---|
> | **1.ª** | `ok:false` · 4 problemas | **Encontró DOS defectos reales de producción** que la suite no ve. |
> | **2.ª** | `ok:false` · 3 problemas | **Defecto B cerrado.** Del A se ganaron **164,99 px**: el panel ya CABE (recorte 48/115 → **0/0**) pero sus dos cajas encogibles siguen sin sitio. Faltaban **32,70 px**. |
> | **3.ª** | `ok:false` · **1 problema** | Se atacó la causa que la 2.ª señaló —la advertencia del autoguardado se decía **dos veces a la vez**—. **`#avisos` cerrado** en los dos estados. Falta **una fila de la lista: 18,33 px**. |
>
> **Ninguna se borra.** Encontrar los defectos es el mérito de este guion (igual
> que en el §16 y el §18); saber **cuánto ganó cada arreglo** es lo que impide
> volver a pagarlo, y cada arreglo salió de una cifra que la corrida anterior
> había puesto encima de la mesa.
>
> Corrida vigente (3.ª): puerto 5173, **1.965 ms**. Todo lo demás que mide sale en
> verde y con las cifras clavadas.

### Qué mide, y por qué NO lo mide la suite

La suite de F11 cubre el modelo, el lector de GML BU, la entrada, las mutaciones,
el cliente del `wfsBU`, el conmutador en jsdom, el panel y el cableado. **Lo que
no puede cubrir es el layout**: jsdom no calcula ni un píxel, así que un panel que
no cabe sale VERDE en las 5.697 pruebas. Aquí se miden ocho cosas:

1. ⭐ **EL GUARDIÁN DE ANCHO DEL CONMUTADOR, QUE SOLO EXISTE AQUÍ.** La sección de
   F11 de `estilos/app.css` lo dice con estas palabras: «el guardián no es de
   altura, es de ANCHO, y lo pone el guion de humo 13». Es lo que **SUSTITUYE** al
   `flex-wrap: nowrap` que el plan le pedía a T1.6 y que **estaba mal**: medido, con
   `nowrap` el elemento que no cabe **se sale 102,53 px** y `.gml-panel`
   —`overflow: hidden`— **lo recorta en silencio**; con `wrap` el fallo al menos se
   ve, pero cuesta **20,28–29,19 px** de la caja de vértices sin que nada avise.
   El guardián es, sobre `.gml-chips`: **`saltoDeLinea === false`** y
   **`holguraPx > 24`**.
2. ⭐ **M10 en un navegador de verdad, ida y vuelta.** La regla dura de
   `app/rama.js` —el intercambio es `seccion.hidden`, JAMÁS `replaceChildren`— se
   midió en la fase 0; aquí se vuelve a medir **con la aplicación entera montada**,
   que es donde de verdad hay **30 nodos de `app/` resueltos una sola vez** en el
   montaje. Se comprueba sobre `[data-campo="refcat"]` de parcela: mismo nodo
   (identidad `===`), `isConnected`, su valor intacto y **sus oyentes disparando**.
   ⚠️ **La sonda del oyente es del guion, y está dicho por qué**:
   `app/cableado-catastro.js` **no engancha ningún `input`** a ese campo (lo lee al
   pulsar «Traer del Catastro»), y pulsar ese botón sería una petición al Catastro
   que este guion no hace. Un guion que finge medir un oyente ajeno es peor que uno
   que declara el suyo.
3. **El invariante de los 267,44 px y las TRES cifras de M8 después del cambio.**
   ⚠️ **El invariante vale SOLO en la rama PARCELA**, y no es una excepción: en
   EDIFICIO la caja que se estira es `.gml-partes`. Son dos cifras, no una.
4. **Que las huellas SE VEN y ENCIMA de la parcela.** Se lee **el orden real de los
   panes en el DOM**, no solo que existan los `<path>`: un pane con el zIndex bien
   puesto y el `<path>` colgando de otro sitio se vería igual de mal. Y el
   emergente se abre **de verdad** (`bindTooltip` no fabrica el nodo hasta que se
   abre, así que preguntar por `aria-describedby` cerrado siempre diría que no).
5. **Soltar un `.dxf` de verdad, en las DOS ramas.** El destino se resuelve por la
   rama activa, así que el mismo fichero son dos documentos distintos. Dos fixtures
   reales: `poly_clasica.dxf` (una capa ⇒ vía directa) y
   `edificio_consulta_masiva_3515508VF0831N.dxf` (**7 anillos en `Construccion` +
   1 en `Parcela`** ⇒ diálogo de reparto).
   ⚠️ **Marcar una casilla asignando `.checked` NO dispara `change`** y el guion lo
   mide a propósito, para dejar escrito que el gate lo gobierna un suceso y no un
   sondeo: `aplicarTrasAsignarChecked: true` (sigue apagado) →
   `aplicarTrasDespacharChange: false` (encendido).
6. **La ficha del pie cambia de cara**: cuatro pares ocultos (`<dt>` **y** `<dd>`) y
   dos rótulos que cambian de pregunta.
7. **El panel nuevo: tipografía, reglas que LLEGAN y el tope de 26vh.** La sección
   de F11 del CSS se escribió **en paralelo con los módulos del marcado y sin
   verlos**, citando el contrato K. El único fallo silencioso que ese reparto puede
   producir es una regla escrita contra un nombre que nadie pone, y el propio
   fichero dice que «el guion de humo 13 es quien lo caza»: por eso no basta con que
   las clases existan, se comprueba que la regla **computa**.
8. **Consola limpia y régimen de red.**
9. ⭐ **EL REPARTO DE ALTURA DEL PANEL, EN VACÍO Y CON DATOS** — y es la medida
   que más caro sale de no hacer. El panel mide lo que la ventana; cabecera,
   bloque de origen y pie son `flex: 0 0 auto` y **no ceden**; lo que sobra se lo
   reparten los **dos únicos encogibles**, `#avisos` (`0 1 auto`) y la lista de
   partes (`1 1 auto`). Si los fijos se pasan, esos dos se aplastan **a la vez** y
   `.gml-panel` —`overflow: hidden`— recorta el resto **por abajo y en silencio**.
   Tres guardianes, y los tres nacieron de la primera corrida:
   - **el recorte del panel a CERO EXACTO**, medido **dos veces** (en vacío y con
     las 7 partes). `scrollHeight` y `clientHeight` son enteros: no hay redondeo
     que tolerar, y cualquier píxel por encima de 0 es contenido del pie que el
     usuario **no puede alcanzar**. Es el guardián que habría cazado el defecto A
     en su primer minuto;
   - **la lista tiene que enseñar al menos una fila** y **`#avisos` al menos una
     línea**, en los dos estados;
   - y cuando no llegan, el guion **no dice «no cabe»: dice cuántos píxeles
     faltan** (`topeConPartes.deficit`, con dos umbrales declarados —el mínimo
     decente y el todo—) y **de dónde salen** (`hijos`, `origenDesglose`,
     `pieDesglose`). «Cabe» es un booleano y no es accionable.
10. **La contradicción, vigilada por su nombre**: tras cargar el DXF por capas,
    ninguna tarjeta de `#avisos` puede decir «No se construye la parcela»
    mientras el panel dice que hay partes. Se mide con el literal exacto y no con
    un `/parcela/i`, que daría falsos positivos sobre mensajes legítimos (el del
    autoguardado nombra la rama Parcela a propósito, y está bien).
11. ⭐ **QUE LA ADVERTENCIA DEL AUTOGUARDADO SE DIGA UNA VEZ, Y QUE SE DIGA.** Es
    el guardián que impide que vuelvan 89 px. La misma advertencia se estaba
    enseñando **dos veces a la vez**: entera y permanente concatenada en
    `[data-procedencia="edificio"]` —donde medía **89,06 px**— y entera otra vez
    como tarjeta del panel de avisos en cuanto había algo que perder. Decir dos
    veces lo mismo no es el doble de honrado. El reparto que se decidió tiene DOS
    mitades y **las dos se exigen**:
    - en el renglón, **una línea** (el literal breve), permanente, porque no
      guardar es una PROPIEDAD de esta versión y no un suceso;
    - en el panel de avisos, **la tarjeta entera y UNA vez**, cuando pasa a haber
      algo que perder, que es cuando la advertencia se puede accionar.
    ⛔ Un guardián que solo mirara la primera mitad aprobaría el peor desenlace:
    que el ahorro **se llevara la advertencia por delante**. Por eso la tarjeta se
    exige, no se supone.
    ⚠️ **El texto largo no se copia en el guion: se DERIVA de la tarjeta de la
    propia aplicación**, y la repetición se comprueba contra él. Copiarlo
    obligaría a mantener 271 caracteres en dos sitios, que es exactamente la clase
    de duplicado que este bloque existe para cazar. Lo único que se cita es el
    literal breve, que es el contrato del renglón.
12. **Que el segundo CTA no quede mudo.** Desde el arreglo del defecto A los dos
    botones comparten **un solo motivo**, escrito en el renglón del primero; el
    del segundo queda **vacío a propósito**. Lo que sostiene entonces la regla de
    la casa —botón apagado CON MOTIVO, jamás botón muerto— es la cadena
    `aria-describedby` → nodo → **texto**, y se comprueba **por sus tres
    eslabones**: un `aria-describedby` que apunta a un `id` inexistente, o a un
    renglón vacío, es peor que no ponerlo (el marcado afirma que hay explicación y
    el lector de pantalla no lee nada). Y al volver a PARCELA **no puede quedar ni
    el atributo ni el `id`**: ahí apuntaría al renglón de OTRO botón.

### ⚠️ Cómo se clasifica la red, y por qué NO por `STOREDQUERIE_ID`

**`STOREDQUERIE_ID` lo usan LOS DOS endpoints** del Catastro (medido en la fase 0
de F11): clasificar por ese parámetro manda las peticiones de parcela a la rama de
edificio y deja la cuenta **mintiendo en verde**. Aquí se distingue por
**`wfsCP.aspx` / `wfsBU.aspx`**, que es lo único que las separa.

Y **«soltar un fichero no dispara ni una petición» es cierto del DIBUJO y falso de
la CARTOGRAFÍA**, así que se publican dos cifras y no una: cargar un edificio
**encuadra el mapa sobre sus huellas** y mover el mapa pide teselas. Eso no es leer
el dibujo. La cifra que tiene que ser **0** es `red.datosCatastroDuranteElGuion`.

### Régimen de red

**Cero peticiones a los servicios de datos.** El `wfsBU` **no se toca a propósito**:
F11 se mide entera con ficheros locales y el override O8 pide una pasada sin
bucles. La vía en vivo es del checklist §12. Cartografía medida en la corrida de
cierre: **10 peticiones**, todas por el reencuadre del mapa sobre las huellas.

### ⚠️ Este guion necesita `npm run dev`, NO `vite preview`

Fabrica `File`s con los BYTES REALES de dos fixtures traídos por `fetch` del propio
servidor (`test/fixtures/parsers/…`): `vite preview` sirve `dist/`, donde no están.

### Cómo se lanza

```
$B viewport 1440x900
$B goto http://localhost:PUERTO/concretagml/#/parcela/validacion   # ⚠️ ver abajo
$B wait ".gml-tabla-vertices"
$B console --clear
$B eval scripts/smoke-navegador/13-edificio.js
$B console --errors                              # → (no console errors)
$B screenshot .gstack/smoke-f11.png              # la evidencia para el §12
```

⛔ **DESDE EL REWORK DE UI (T6) HAY QUE LANZARLO SOBRE `#/parcela/validacion`, Y
NO SOBRE LA RAÍZ.** La aplicación arranca en la pantalla de **Entrada**, donde la
caja de vértices y el pie del panel **no se ven** —el pie mide 266,28 px y sin
esconderlo las tres vías de Entrada no cabían—. Este guion mide el invariante de
los 267 px y el reparto de altura del panel: lanzado en Entrada leería ceros y los
llamaría regresión. El hash lleva directamente a la pantalla que mide, sin
pulsaciones.

⚠️ **Página recién cargada, y no es formalismo**: el invariante de los 267 px se
mide con la lista de avisos VACÍA, y una tarjeta cuesta ~52 px del sitio más caro
del panel. Si arranca con avisos, el guion lo dice y **ATRIBUYE** la pérdida en vez
de acusar a F11 — las dos lecciones que ya pagaron `09` (midió demasiado tarde) y
`11` (demasiado pronto).

**Estado final.** Deja la aplicación en la rama **PARCELA**, con un edificio de 7
partes en el segundo store, sus huellas en el mapa, el mapa encuadrado sobre ellas
y **4 tarjetas de aviso** que el propio guion provoca. Para volver al punto de
partida: `$B reload`.

### ⚠️ Segunda pasada opcional: el tope a 768 px de alto

Un tope en `vh` protege del contenido largo, **no de la ventana corta**. El guion
mide en el viewport en el que se lance y **DERIVA** la otra cifra, diciendo que es
derivada (`topeConPartes.derivadoA768`). Para medirla:

```
$B viewport 1440x768 && $B goto http://localhost:PUERTO/concretagml/
$B wait ".gml-tabla-vertices" && $B eval scripts/smoke-navegador/13-edificio.js
```

Medido el **2026-08-04**: a 1440×768 el tope vale **199,68 px** (contra 234,00 a
900), el panel necesita **947,53 px** para 768 disponibles y **recorta 180 px**.

### Qué cuenta como «pasa»

- `ok: true`, `problemas: []`. **Hoy NO pasa**: ver abajo.
- `arranque.altoCajaVerticesPx: 267` **con `tarjetasDeAvisos: 0`**.
- `conmutadorAncho.saltoDeLinea: false` y `holguraPx > 24`.
- `invariante.cabeceraClavada: true` (117,13 en las dos ramas).
- `idaYVuelta.mismoNodo: true`, `valorAhora` intacto, `sondaSigueDisparando: true`.
- `capaHuellas.zPartes: 422`, entre 420 y 430, y los `<path>` colgando del pane.
- `reparto.partesTrasAplicar: 7` y `huellasTrasAplicar: 7`.
- `contratoK1.colisiones: []`.
- `red.datosCatastroDuranteElGuion: 0`.
- `enEdificio.motivoGenerar` nombra **los dos** botones · `motivoDiagnosticar: ""`
  · `describedbyDelSegundoCta === idDelRenglonPrincipal` y ese nodo **lleva texto**.
- `idaYVuelta.describedbyDelSegundoCta: null` y `idDelRenglonPrincipal: null`.
- `reparto.avisoQueNiegaLaCarga: null`. ✅ **desde el arreglo del defecto B.**
- ⭐ `repartoDeAltura.recorteDelPanelPx: 0` **y** `topeConPartes.recorteDelPanelPx: 0`.
  ✅ **desde el 1.er arreglo del defecto A.**
- ⭐ `advertenciaSinAutoguardado.renglonLlevaLaBreve: true` ·
  `elRenglonRepiteLaTarjeta: false` · `tarjetasConLaAdvertencia: 1`.
  ✅ **desde el 2.º arreglo del defecto A.** Las tres a la vez: la primera es la
  advertencia permanente, la segunda es la repetición y la tercera es la
  advertencia entera. Quitar cualquiera de las tres es un desenlace distinto y
  ninguno bueno.
- `repartoDeAltura.listaDePartes.altoPx ≥ 26` (**hoy 90,03** ✅, 3 filas) y
  `avisos.altoPx ≥ 16` (**hoy 24,09** ✅).
- `topeConPartes.filasEnterasQueCaben ≥ 1` (**hoy 0** ⛔, faltan 18,33 px) y
  `avisos.altoPx ≥ 16` con tarjetas dentro (**hoy 24,84** ✅).
- `$B console --errors` limpio.

### ⛔ Los DOS defectos que este guion destapó (2026-08-04)

Los dos son **de producción** y los dos son **invisibles para la suite**: jsdom no
calcula un solo píxel, y las detecciones se afirman como lista y no como lo que
acaba en el panel. Los dos se corrigieron el mismo día. Lo que sigue es la
primera corrida —la que los encontró— y, al final de cada uno, **qué se ganó
medido con los arreglos puestos**.

#### Defecto A — el panel de la rama EDIFICIO **no cabía** ⟶ ✅ ARREGLADO A MEDIAS

El presupuesto, medido a 1440×900 con la rama recién conmutada y **nada cargado**:

| Hijo de `.gml-panel` | `flex` | Alto medido |
|---|---|---|
| `.gml-panel-cabecera` | `0 0 auto` | 117,13 px |
| `.gml-bloque--edificio` | `0 0 auto` | **457,13 px** |
| `.gml-bloque--avisos` | `0 1 auto` | **16,00 px** ⟵ víctima |
| `.gml-bloque--partes` | `1 1 auto` | **32,00 px** ⟵ víctima |
| `.gml-panel-pie` | `0 0 auto` | **325,28 px** |
| **Suma** | | **947,54 px** para un panel de **900** |

⇒ **47,54 px de sobresuscripción** con el panel vacío, y **114,91 px** con las 7
partes cargadas y sus avisos. Las consecuencias, medidas:

- **`.gml-partes` mide 2 px** y su contenido 124 px vacío / 184 px con 7 partes:
  **no cabe ni una fila** (una fila mide 25,39 px medidos). El usuario carga 7
  partes y **no ve ninguna**.
- **`#avisos` mide 0 px de contenido** con 4 tarjetas dentro. Es la **segunda
  víctima**, exactamente la que T0.3·1 avisó que tendría esta rama: «el desastre de
  F06 repetido, con dos víctimas en vez de una».
- **`.gml-panel` recorta 48 px** por abajo (115 px con datos), y es
  `overflow: hidden`: el motivo del CTA «Diagnosticar encaje» **no se ve y no hay
  forma de llegar a él**.
- El tope `--gml-partes-alto-max: 26vh` (234,00 px) **no muerde ni una vez**: el
  problema no está ahí, y T1.6 ya lo había corregido al medirlo.

**Las dos causas, separadas y con su cifra:**

1. **`.gml-bloque--edificio` mide 457,13 px y T1.6 lo midió en 177,34** (+279,79).
   El desglose: rótulo 15,94 · **`.gml-campo` del selector de modelo 272,03 px**
   (los dos `APUNTE_MODELO` son párrafos de varias líneas a 11 px) · refcat 54,94 ·
   **`.gml-procedencia` 74,22 px** (porque `MENSAJE_SIN_AUTOGUARDADO` se
   **concatena** al texto de procedencia y son tres líneas). Con datos cargados
   sube a **524,50 px**.
2. **El pie CRECE en esta rama, no encoge.** La ficha libera los **75,75 px**
   prometidos (148,50 → 72,75 ✅, la cifra de T0.3·8 clavada), pero
   `.gml-acciones` pasa de **72,78 a 207,53 px** (**+134,75**) porque los dos
   renglones `role="status"` llevan los motivos de los CTA apagados, que son
   párrafos enteros. Neto del pie: **+58,99 px**.

**Lo que NO es**: no es el conmutador (cuesta 0 px medidos: cabecera 117,13 en las
dos ramas), no es el tope en `vh`, y no son los siete atributos semánticos (que
salieron al `<dialog>` en la desviación 12 y ahí siguen). Es que **el presupuesto
de 80 px que T0.3·1 calculó se gastó tres veces**: en los apuntes del selector, en
el renglón de procedencia concatenado y en los dos motivos del pie.

Evidencia: `.gstack/f11-panel-aplastado.png` — «AVISOS» y «PARTES · 7 partes» son
dos rótulos con nada debajo.

##### ✅ Lo que se arregló, y lo que se ganó MEDIDO

Dos ahorros, uno por cada causa, sin tocar ni un texto de los que ya estaban
escritos —los dos motivos siguen exportados y siguen siendo verdad; lo que cambió
es **cuál se enseña**—:

1. **`app/panel-edificio.js#pintarModelo`: solo se enseña el apunte del modelo
   ELEGIDO** (el otro va con `hidden`, no se retira del DOM). El apunte visible
   mide **79,69 px**; `.gml-campo` del selector baja de **272,03 → 174,41 px**
   (**−97,62**).
2. **`app/rama.js`: UN solo motivo para los dos CTA** (`MOTIVO_CTA_EN_EDIFICIO`),
   escrito en el renglón del primero y con el segundo apuntándole por
   `aria-describedby` al `id` `gml-motivo-cta-edificio`. `.gml-acciones` baja de
   **207,53 → 140,16 px** (**−67,37**).

**Total ganado: −164,99 px.** Y con eso:

| | Antes | Después |
|---|---|---|
| `.gml-bloque--edificio` (vacío) | 457,13 px | **359,50 px** |
| `.gml-bloque--edificio` (7 partes) | 524,50 px | **426,88 px** |
| `.gml-acciones` | 207,53 px | **140,16 px** |
| Suma de los hijos (vacío) | 947,54 px | **900,01 px** |
| Sobresuscripción (vacío / cargado) | 47,54 / 114,91 px | **0,01 / 0,00 px** |
| ⭐ **Recorte del panel** (vacío / cargado) | **48 / 115 px** | **0 / 0 px** ✅ |
| Lista de partes (vacío) | 2,00 px | **58,70 px** (2 filas) ✅ |
| «Diagnosticar encaje» y su motivo | **fuera de la pantalla** | **a la vista** ✅ |

##### ⛔ Lo que quedó tras el primer arreglo (2.ª corrida), y la causa que señaló

**El panel ya cabía. Lo que no cabía era lo que va dentro de sus dos cajas
encogibles en cuanto entran datos**, y eso es otra cosa —y hay que decirlo
distinto, porque «cabe» es un booleano que no es accionable—:

| Hijo de `.gml-panel` | `flex` | Vacío | Con 7 partes |
|---|---|---|---|
| `.gml-panel-cabecera` | `0 0 auto` | 117,13 | 117,13 |
| `.gml-bloque--edificio` | `0 0 auto` | 359,50 | **426,88** |
| `.gml-bloque--avisos` | `0 1 auto` | 50,83 | 46,63 |
| `.gml-bloque--partes` | `1 1 auto` | 114,64 | 51,47 |
| `.gml-panel-pie` | `0 0 auto` | 257,91 | 257,91 |
| **Suma / recorte** | | 900,01 / **0** | 900,00 / **0** |
| ⛔ `.gml-partes` (contenido) | | 58,70 (de 124) | **2,00** (de 184) |
| ⛔ `#avisos` (contenido) | | 10,89 (de 39) | **6,69** (de 394, 3 tarjetas) |

Déficit medido entonces: **23,39 px** para una fila de la lista, **9,31 px** para
una línea de avisos ⇒ **32,70 px de mínimo decente**, **569,31 px** para verlo
todo. Y de los tres fijos, que sumaban **801,92 px** de 900, la partida que saltaba
a la vista era `.gml-procedencia` con **89,06 px**, porque
`MENSAJE_SIN_AUTOGUARDADO` **se concatenaba ahí, además de ir al panel de avisos**.

#### El 2.º arreglo del defecto A: la advertencia se decía DOS VECES (3.ª corrida)

Esa cifra era la punta de un defecto de redacción, no de maquetación: **la misma
advertencia se estaba enseñando dos veces a la vez** —entera y permanente en el
renglón, y entera otra vez como tarjeta en cuanto había algo que perder—. Decir dos
veces lo mismo no es el doble de honrado, y aquí además costaba 89 px del sitio más
disputado del panel.

`app/cableado-edificio.js` estrena **`MENSAJE_SIN_AUTOGUARDADO_BREVE`** (87
caracteres frente a 289) para el renglón; **la versión larga no se toca y sigue
saliendo entera** por el panel de avisos, una sola vez. Cada mitad hace lo suyo: la
línea del renglón es permanente porque **no guardar es una propiedad de esta
versión y no un suceso** —que es el argumento con el que se puso ahí y sigue siendo
bueno—, y la tarjeta dice las tres cosas (qué no pasa, por qué, y qué hacer) donde
caben sin quitarle sitio a nada.

Medido:

| | 2.ª corrida | 3.ª corrida |
|---|---|---|
| `.gml-procedencia` (vacío) | 74,22 px | **29,69 px** (−44,53) |
| `.gml-procedencia` (7 partes) | 89,06 px | **59,38 px** (−29,68) |
| `.gml-bloque--edificio` (vacío) | 359,50 px | **314,97 px** |
| `.gml-bloque--edificio` (7 partes) | 426,88 px | **397,19 px** |
| `#avisos` contenido (vacío) | 10,89 px ⛔ | **24,09 px** ✅ |
| `#avisos` contenido (7 partes) | 6,69 px ⛔ | **24,84 px** ✅ |
| `.gml-partes` (vacío) | 58,70 px (2 filas) | **90,03 px (3 filas)** ✅ |
| `.gml-partes` (7 partes) | 2,00 px ⛔ | **7,06 px** ⛔ |
| **Déficit del mínimo decente** | **32,70 px** | **18,33 px** |
| Tarjeta larga en `#avisos` | 1 | **1** ✅ (271 caracteres, entera) |
| El renglón repite la tarjeta | **sí** | **no** ✅ |

⇒ **Cerrados 14,37 px de los 32,70**, y con ellos **las dos advertencias de
`#avisos`, en los dos estados**. La advertencia larga **sigue apareciendo**: el
ahorro no se la ha llevado por delante, y hay un guardián que lo exige.

##### ⛔ Lo que QUEDA hoy: 18,33 px, y de dónde salen

Una sola cosa: **con 7 partes cargadas la lista mide 7,06 px y una fila mide
25,39**, así que no se ve ni una entera. El estado vacío ya está resuelto (90,03 px,
tres filas).

| Hijo de `.gml-panel` | `flex` | Vacío | Con 7 partes |
|---|---|---|---|
| `.gml-panel-cabecera` | `0 0 auto` | 117,13 | 117,13 |
| `.gml-bloque--edificio` | `0 0 auto` | **314,97** | **397,19** |
| `.gml-bloque--avisos` | `0 1 auto` | 64,03 | 64,78 |
| `.gml-bloque--partes` | `1 1 auto` | 145,97 | 63,00 |
| `.gml-panel-pie` | `0 0 auto` | 257,91 | 257,91 |
| **Suma / recorte** | | 900,01 / **0** | 900,00 / **0** |
| `.gml-partes` (contenido) | | **90,03** (de 124) ✅ | ⛔ **7,06** (de 184) |
| `#avisos` (contenido) | | **24,09** (de 39) ✅ | **24,84** (de 394) ✅ |

**Cuántos píxeles faltan:** **18,33 px** para UNA fila · **176,94 px** para las
siete · **546,10 px** para verlo todo (las 7 filas y las 3 tarjetas enteras).

**De dónde pueden salir, en orden de cercanía:**

1. **8,84 px están AL LADO**: es el margen que `#avisos` tiene hoy por encima de su
   propio mínimo (24,84 contra los 16 de una línea). Son los únicos que no hay que
   quitarle a nadie — pero dejan a los avisos justo en el hueso.
2. Los **9,49 px restantes** tienen que salir de los tres bloques fijos, que con
   datos suman **772,23 px** de 900:
   - `.gml-bloque--edificio` **397,19** = rótulo 15,94 + **selector de modelo
     174,41** + refcat 54,94 + renglón de estado **44,53** + procedencia **59,38**.
     ⚠️ Los dos últimos **solo existen con datos cargados** (0 y 29,69 en vacío):
     son **+74,22 px** que llegan justo cuando la lista tiene algo que enseñar, y
     por eso el panel vacío cabe con tres filas y el cargado no cabe con una.
   - `.gml-panel-pie` **257,91** = ficha 72,75 + acciones **140,16**.
   - `.gml-panel-cabecera` **117,13** (el conmutador sigue costando 0 px).

**Margen para F12**, que es la otra cara de la misma cuenta: hoy sobran **8,84 px**
en `#avisos` y **0** en la lista. F12 añade las plantas por parte —o sea, más texto
por fila y una fila más alta—: **entra en un panel sin holgura**, y esta tabla es el
sitio donde mirarlo antes de escribir nada.

**Lo que sigue sin ser la causa**: el tope `--gml-partes-alto-max` (234,00 px) no
muerde ni una vez, en ninguna de las tres corridas.

Evidencia: `.gstack/f11-panel-edificio-tras-arreglo.png` — «Diagnosticar encaje» y
su motivo se ven, «AVISOS» enseña ya la cabecera de una tarjeta («AVISO ×2»), y
«PARTES · 7 partes» sigue siendo un rótulo con una tira de píxeles debajo.

#### Defecto B — la aplicación se contradecía a sí misma al cargar un edificio ⟶ ✅ ARREGLADO

Al soltar `edificio_consulta_masiva_3515508VF0831N.dxf` y aplicar la capa
`Construccion`, el renglón del panel dice:

> «Cargadas 7 partes de «edificio_consulta_masiva…dxf»: 62 vértices en total.»

y **a la vez** entra en el panel de avisos una tarjeta que dice:

> «El contorno menos los huecos da **-13.32 m²** con 7 anillo(s): el reparto «el
> primero es el contorno y los demás son huecos» NO se sostiene. **No se construye
> la parcela**; revisa qué anillos del fichero son de verdad la parcela.»

Las dos frases no pueden ser ciertas a la vez, y quien tiene que decidir cuál se
cree es el usuario. El aviso viene de `parsers/importar.js:669-678`
(`SUPERFICIE_NO_POSITIVA`, la detección que T1.1 añadió para tapar el −390,45 m²
silencioso) y **habla del reparto «un exterior + N huecos», que es DE PARCELA**: en
la rama EDIFICIO **cada anillo es su propio exterior**, así que ni el número
negativo ni la palabra «parcela» significan nada aquí.

Lo llamativo es que **la mitad del arreglo ya está hecha y documentada**:
`edificio/entrada.js:422` filtra esos dos códigos de `resumen.bloqueos` con
`BLOQUEOS_SOLO_PARCELA` —y su cabecera explica por qué, con este mismo fixture
como ejemplo—. Lo que **no** se filtra es su **DETECCIÓN**, que es justamente la
mitad que el usuario LEE. La suite está verde porque `entradaDesdeTexto` reenvía
las detecciones de aguas arriba «tal cual» a propósito, y eso está probado.

Evidencia: `.gstack/f11-aviso-contradictorio.png`.

##### ✅ Lo que se arregló, y por qué está bien arreglado

**En su origen, y con la lista que ya existía**, no con un parche en la interfaz:

- `parsers/importar.js` marca la detección de superficie ≤ 0 con
  `datos.bloqueo = 'SUPERFICIE_NO_POSITIVA'` y publica
  **`sinDeteccionesDeParcela(detecciones)`**;
- `edificio/entrada.js:430-431` filtra ahora **las dos mitades con la MISMA lista
  publicada** (`BLOQUEOS_SOLO_PARCELA`): los bloqueos y sus detecciones. **No se
  filtra por tipo ni por texto**, que es lo que habría vuelto a divergir el día que
  alguien añadiera un sexto bloqueo de parcela.

**Medido en la corrida de comprobación**: cargar el DXF real por la capa
`Construccion` da **7 partes** y `reparto.avisoQueNiegaLaCarga: null`. Los avisos
que quedan son los tres legítimos —huso ambiguo, «esta rama no se guarda sola» y
el del dibujo soltado en la rama Parcela— y ninguno contradice al panel. El
guardián se queda puesto: es el que impide que vuelva.

### Y una cosa que NO es un defecto, para que nadie la denuncie dos veces

`.gml-conmutador-rama` declara `display: inline-flex` en la hoja y **computa
`flex`**. No es una regla muerta: **los ítems flex se bloquifican** (CSS Display 3,
§2.7), y el conmutador es hijo de `.gml-chips`, que es `display: flex`. El efecto es
idéntico; lo único que queda es que la palabra `inline-` de la hoja es inerte por
construcción. El guion lo publica (`conmutadorAncho.display` /
`displayDeclaradoEnLaHoja`) y **exige solo que sea flex de alguna forma**.

### Cifras de referencia (**3.ª corrida**, 2026-08-04, con los tres arreglos puestos)

| Medida | Valor |
|---|---|
| Duración del guion | **1.965 ms** · **0** peticiones a los datos del Catastro · 8 de cartografía |
| Caja de vértices al arrancar | **267 px** con `tarjetasDeAvisos: 0` ✅ (sexta fase seguida) |
| Cabecera del panel | **117,13 px** en PARCELA · **117,13 px** en EDIFICIO ⇒ el conmutador cuesta **0 px** ✅ |
| ⭐ **Guardián de ancho** | conmutador **116,17 px** de **169,29** libres ⇒ **holgura 45,12 px** · **sin salto de línea** ✅ (fase 0: 116,17 / 169,28 / 46,11) |
| Desborde del panel (ancho) | **0 px** — con `nowrap` habrían sido 102,53, recortados en silencio |
| Objetivo de pulsación del conmutador | **25,39 px** (WCAG 2.5.8 pide 24) — regalo del `align-items: stretch` contra el chip |
| ⭐ **M10 ida y vuelta** | **mismo nodo** ✅ · `isConnected` ✅ · valor `9398516VK3799G` intacto ✅ · **oyentes disparando** (1 → 2) ✅ |
| Los dos CTA del pie | apagados en EDIFICIO con **UN** motivo que **nombra los dos** ✅ · el segundo con `aria-describedby="gml-motivo-cta-edificio"` → nodo que existe y **lleva texto** ✅ · **restaurados exactos** al volver, **sin `aria-describedby` ni `id` residuales** ✅ |
| Barra de edición | oculta en EDIFICIO ✅ · vuelve al volver ✅ |
| Ficha del pie | 8 pares → **4** · **libera 75,75 px** (148,50 → 72,75) — la cifra de T0.3·8, clavada ✅ |
| Rótulos que cambian | «Vértices» ⇢ **«Partes»** · «Superficie» ⇢ **«Superficie en planta»** ✅ (y vuelven) |
| Contrato K.1 | **0 colisiones** de `data-*` entre ramas, con la app entera montada ✅ |
| Panes | `parcelaEditada:420` → **`partes:422`** → `acotaciones:425` → `diagnostico:428` → `vertices:430` ✅ |
| Huella | `<path class="gml-huella">` en `leaflet-partes-pane` · `rgb(167,139,250)` (#A78BFA) · `fill-opacity 0.25` · trazo 2 px · **dentro del lienzo** ✅ |
| Emergente | abre en `mouseover` · clase `gml-huella-emergente` · texto «Parte 1» · **el ratón sigue burbujeando al mapa** ✅ |
| `.dxf` con rama **PARCELA** | **0** partes, **0** huellas, tabla intacta en 15 filas, **1 aviso** que dice por dónde sí entra ✅ |
| `.dxf` con rama **EDIFICIO** | `poly_clasica.dxf` → **1 parte / 4 vértices / 1 huella** · ficha «1» y «100,00 m²» ✅ |
| Diálogo de reparto | **2 capas**: `Construccion` **7 polilíneas** · `Parcela` **1 polilínea** · **ninguna marcada** · «Cargar las partes» **nace apagado con motivo** ✅ · `:modal` ✅ |
| ⚠️ La trampa del `change` | `.checked = true` ⇒ el botón **sigue apagado**; con el `change` despachado ⇒ **se enciende** |
| Tras aplicar `Construccion` | **7 partes / 7 huellas / 62 vértices** · ficha «7» y «165,99 m²» ✅ |
| Tipografía | 8 dianas, todas derivadas de `--font-sans`/`--font-mono` · **0 estilos en línea** ✅ |
| Selector de modelo | **1 apunte visible** de 2 (el elegido, 79,69 px; el otro `hidden`) ✅ |
| Tope `--gml-partes-alto-max` | **234,00 px** a 900 de alto · **no muerde nunca** · manda el reparto flex ✅ |
| ⭐ **Recorte del panel** | **0 px** en vacío **y** **0 px** con 7 partes ✅ (1.ª corrida: 48 y 115) |
| ⭐ **Aviso contradictorio** | **no aparece** (`avisoQueNiegaLaCarga: null`) ✅ (defecto B cerrado) |
| ⭐ **Advertencia del autoguardado** | renglón con la **breve** (192 car. con la procedencia delante) · **no repite** la tarjeta ✅ · **1** tarjeta con la larga **entera** (271 car.) ✅ |
| Suma de los hijos del panel | **900,01 px** vacío · **900,00 px** con 7 partes, para 900 disponibles |
| **Caja de avisos** | **24,09 px** vacío ✅ · **24,84 px** con 3 tarjetas ✅ (1.ª: 0 · 2.ª: 10,89 / 6,69) |
| **Lista de partes (vacío)** | **90,03 px** ⇒ **3 filas** ✅ (1.ª: 2,00 · 2.ª: 58,70) |
| ⛔ **Lista de partes (7 partes)** | **7,06 px** para 184 de contenido ⇒ **0 filas** ⟵ lo único que queda |
| ⛔ **Déficit medido** | **18,33 px** para una fila (era 32,70) · **546,10 px** para verlo todo |
| Margen que queda | **8,84 px** en `#avisos` · **0** en la lista ⟵ con esto se encuentra F12 |

Evidencia: `.gstack/smoke-f11.png`,
`.gstack/f11-panel-edificio-tras-arreglo.png` (estado de hoy) ·
`.gstack/f11-panel-aplastado.png` y `.gstack/f11-aviso-contradictorio.png`
(la primera corrida, que no se borran).

### El resumen de las tres corridas, en una tabla

Se deja aquí porque es la lección, y no es sobre F11: **cada arreglo salió de una
cifra que la corrida anterior había puesto encima de la mesa**, y ninguna de las
tres cifras la podía dar la suite.

| | 1.ª | 2.ª | 3.ª |
|---|---|---|---|
| Problemas | 4 | 3 | **1** |
| Recorte del panel (vacío / cargado) | 48 / 115 px | **0 / 0** | **0 / 0** |
| Aviso que contradice la carga | **sí** | no | no |
| `.gml-bloque--edificio` (vacío / cargado) | 457,13 / 524,50 | 359,50 / 426,88 | **314,97 / 397,19** |
| `.gml-acciones` | 207,53 | **140,16** | **140,16** |
| `.gml-procedencia` (vacío / cargado) | 74,22 / 89,06 | 74,22 / 89,06 | **29,69 / 59,38** |
| `#avisos` (vacío / cargado) | 0 / 0 | 10,89 / 6,69 | **24,09 / 24,84** |
| `.gml-partes` (vacío / cargado) | 2,00 / 2,00 | 58,70 / 2,00 | **90,03 / 7,06** |
| Déficit del mínimo decente | — (no cabía) | 32,70 px | **18,33 px** |

### Lo que este guion deja al checklist humano (§12)

**Que la huella caiga DONDE ESTÁ EL EDIFICIO** — comparar la mancha violeta con el
tejado de la ortofoto es la comprobación entera que justifica pintarlas, y pide
ojos. **La vía en vivo del `wfsBU`**, con su régimen de una pasada. **El tope a
otras alturas de ventana** y el juicio sobre el panel aplastado del defecto A.
**Un gesto de ratón de verdad** sobre el conmutador y sobre la casilla del diálogo.
**Abrir en un CAD** el DXF del que salen estas huellas y cotejar sus capas contra
las que el diálogo ofrece. Y el punto BLOQUEANTE que hereda del 8.1, el 9.4, el
10.5 y el 11.6: si algún texto de la rama **se lee como un veredicto**.

---

## 20. `14-shell.js` — la cáscara y su línea base (Rework de UI · T4)

Este guion es **distinto de los diecinueve anteriores en una cosa**: no mide una
funcionalidad recién terminada, mide **la maquetación**, y se escribió **antes**
que la cáscara de tres columnas que va a juzgar. Ese orden es deliberado y es la
mitad de su valor: *una medición hecha después del cambio no distingue lo que
mejoró de lo que ya estaba bien*.

La suite tiene 5.802 pruebas y **ninguna** puede sustituirlo: corren en `node` y
en jsdom, y **jsdom no calcula maquetación**. `getBoundingClientRect()` devuelve
ceros, `getComputedStyle` no resuelve `flex`, y un panel que se sale de la
pantalla por abajo sale VERDE.

### Se lanza DOS veces, y la primera es la que manda (decisión D5)

**Viewport mínimo declarado: 1280×720.** Todas las mediciones históricas de este
repositorio —267,44 px de la caja de vértices, 12 px de holgura del pie, 947 px
del panel de Edificio— están hechas a 1440×900, que es una pantalla cómoda. Un
colegiado con un portátil de 14" no la tiene. **Un defecto a 1280×720 es un
defecto.**

```bash
npm run dev                                        # ⚠️ dev, no `vite preview`

$B viewport 1280x720                               # el SUELO declarado
$B goto http://localhost:PUERTO/concretagml/       # ⚠️ el base, no la raíz
$B wait ".gml-tabla-vertices"
$B console --clear
$B eval scripts/smoke-navegador/14-shell.js

$B viewport 1440x900                               # y la pasada cómoda
$B reload
$B wait ".gml-tabla-vertices"
$B eval scripts/smoke-navegador/14-shell.js
$B console --errors                                # → (no console errors)
```

⚠️ **Página recién cargada entre pasadas, y no es formalismo:** el guion PROVOCA
cinco avisos para medir el bloque, y una tarjeta cuesta 79,28 px del sitio más
caro del panel. Si arranca con avisos puestos lo dice y ATRIBUYE la pérdida, en
vez de acusar a la cáscara — la lección que ya pagaron el guion 09 (midió
demasiado tarde) y el 11 (midió demasiado pronto).

### `modo`: el guion sabe en cuál de los dos mundos está

| `modo` | Cuándo | Qué publica |
|---|---|---|
| `LINEA_BASE` | No hay rail (hoy) | El reparto de dos columnas de hoy |
| `SHELL` | Hay rail (desde T5) | El reparto nuevo **y el coste del rail en px** (cifra de T10) |

**Los umbrales son los mismos en los dos mundos**: el suelo no cambia porque
cambie la cáscara.

### Cifras de la LÍNEA BASE (2026-08-04, Chrome, `npm run dev`, rama PARCELA)

| Medida | **1280×720** (suelo) | 1440×900 |
|---|---|---|
| Veredicto | **`ok: false`** | `ok: true` |
| Panel: ancho / desborde | 392 px / **0** | 392 px / **0** |
| Panel: % del ancho | 30,6 % | 27,2 % |
| Mapa | 888 × 720 | 1048 × 900 |
| `#tabla-vertices` (sin avisos) | **110,09 px** | **267,44 px** |
| `#tabla-vertices` (con 5 avisos) | **71,23 px** | 166,50 px |
| Coste de 5 avisos en la caja | **−38,86 px** | **−100,94 px** |
| Bloque `#avisos` con 5 avisos | **34,22 px** | 118,95 px |
| Alto de UNA tarjeta de aviso | 79,28 px | 79,28 px |
| **Tarjetas que caben en pantalla** | **0,43** | 1,50 |
| Escondido detrás del scroll | **394 px** | 309 px |
| Cosas flotando sobre el mapa | 10 | 10 |

### Las cuatro cosas que estas cifras corrigen o destapan

**1 · ⭐ EL DEFECTO DE LOS AVISOS, POR FIN CON NÚMERO.** El autor abrió el rework
diciendo «los avisos se recortan y pelean con las coordenadas». Aquí está medido:
a 1280×720 con cinco avisos, **el bloque que los contiene mide 34,22 px y una
tarjeta mide 79,28** ⇒ **no cabe NI UNA entera (0,43)**, y quedan **394 px detrás
de un scroll**. Y la pelea con las coordenadas es literal: los mismos cinco avisos
le quitan **38,86 px** a la caja de vértices, que baja a **71,23 px** — unas tres
filas.

⚠️ **Este umbral lo obligó a añadir la propia primera pasada.** La versión inicial
del guion solo miraba si el TEXTO de cada tarjeta estaba recortado, y salía en
verde: los textos salen enteros **dentro de su tarjeta**. Lo que estaba cortado
era la LISTA. Medir el elemento equivocado da un verde que miente, que es
exactamente el defecto que este proyecto lleva once fases persiguiendo.

**2 · EL PANEL NO SE SOBRESUSCRIBE, y eso corrige una suposición del plan.** El
design doc del rework cita «el panel actual se sobresuscribe 47,54 px a 1440×900».
Medido hoy: **desborde 0 px en los dos viewports**. Aquella cifra era de la rama
EDIFICIO **con los dos motivos largos de los CTA**, y F11 la arregló fundiéndolos
en `MOTIVO_CTA_EN_EDIFICIO`. El defecto que queda de F11 es el otro: las dos cajas
encogibles **18,33 px cortas** (§19), no el desbordamiento.

**3 · EL INVARIANTE DE F07 SIGUE EN PIE, Y HAY QUE MIRAR EL NODO BUENO.**
`#tabla-vertices` mide **267,44 px clavados** a 1440×900: siete fases seguidas sin
moverlo. La primera pasada de este guion leyó 323,38 y pareció una regresión de
56 px — estaba midiendo `.gml-bloque--vertices`, que **le suma el `<h2>`**. El
guion publica ahora los tres nodos por separado (`bloque`, `tabla`,
`contenedorConScroll`) y dice cuál es el comparable. **La cifra que vale es
`contenedorConScroll`.**

**4 · A 1280×720 LA CAJA DE VÉRTICES PIERDE 157,35 px.** De 267,44 a **110,09**.
Nadie lo había medido: todas las cifras históricas son a 1440×900. Con cinco
avisos encima se queda en **71,23 px**. El suelo declarado no es una pantalla
cómoda, y ésa es justamente la razón de declararlo.

### Qué cuenta como «pasa»

`ok: true` con `problemas: []` **en las dos pasadas**. Hoy la de 1280×720 sale en
rojo con un problema, y **eso es lo correcto**: el guion está midiendo el defecto
que el rework existe para arreglar. **La primera vez que dé `ok:true` con
`modo:'SHELL'` en las dos pasadas es el día que la rebanada esté bien de verdad.**

Umbrales, con su motivo:

| Umbral | Valor | Por qué |
|---|---|---|
| `SUELO_ALTO_MAPA` | 200 px | A 0, `viewer/wms-catastro.js` corta el encuadre **sin petición, sin aviso y sin error**. Pero a 80 px la cartografía tampoco sirve: el suelo es el alto por debajo del cual la parcela y su entorno no caben juntos. |
| `SUELO_ANCHO_MAPA` | 400 px | La maqueta medida del shell le dejaba **680 px** a 1280×720. |
| `DESBORDE_TOLERADO` | 1 px | `.gml-panel` es `overflow: hidden`: cada píxel de más es contenido **inalcanzable, ni con la rueda**. El píxel es de redondeo subpíxel. |
| Tarjetas que caben | ≥ 1 | Un aviso del que no se ve ni una tarjeta entera es un aviso mudo. |

### Lo que este guion **NO** puede medir

**Si la pantalla es BONITA.** Publica anchos, altos y desbordes. Que el reparto se
lea como un producto y no como un formulario de 2010 no tiene número, y es lo
único que el autor dio como motivo del rework («solo mi incomodidad»).

**Que un colegiado sepa por dónde empezar.** Nadie que no escribiera este código
ha abierto nunca la aplicación. La asignación sigue abierta: sentarle delante con
una referencia catastral en un papel y **callarse cinco minutos**.

**Que el rail se pueda pulsar con el dedo** (§0: los sucesos van despachados a
mano). **Que la cartografía se vea** — aquí se miden CAJAS, no píxeles pintados:
un mapa de 700 px con el WMS caído da las mismas cifras que uno bueno; eso es del
guion 02. **El eje PASO**, mientras `modo` siga siendo `LINEA_BASE`.

### Estado que deja

Las cinco tarjetas de aviso que él mismo ha provocado y **nada más**: no carga
ficheros, no consulta al Catastro, no conmuta de rama y no edita. `$B reload` para
volver al punto de partida.

### Ampliación T6: la pantalla de Entrada y sus tres vías (criterio 7)

Desde T6 el guion mide también la **pantalla de Entrada**, y solo cuando la
aplicación está en ella (`data-paso === 'entrada'`); en cualquier otra publica una
advertencia diciendo que ese criterio no se ha comprobado, porque contar cero vías
donde no las hay sería un falso verde.

El criterio 7 —«las tres vías, nombradas y separadas»— se convierte en tres
mediciones: que haya **tres**, que las **tres se vean ENTERAS sin scrollear**, y
que la de medición propia **tenga un control visible**. Esa última no es teórica:
hasta T6 la única forma de meter un DXF era arrastrarlo sobre la ventana, y un
camino que solo conoce quien escribió el código no es un camino.

```
$B viewport 1280x720
$B goto http://localhost:PUERTO/concretagml/#/parcela/entrada
$B reload                                        # ⚠️ OBLIGATORIO — ver abajo
$B eval scripts/smoke-navegador/14-shell.js
```

⛔ **`$B goto` CON UN CAMBIO DE SOLO EL HASH NO RECARGA EL DOCUMENTO**, y esto
costó dos mediciones falsas el 2026-08-04. Es navegación dentro del mismo
documento: el estado anterior sigue vivo. En concreto, **las cinco tarjetas de
aviso que este mismo guion provoca al final seguían en pantalla en la pasada
siguiente**, robaban ~170 px al bloque de Entrada, y el guion informó de que la
tercera vía no cabía cuando sí cabe. Con `$B reload` detrás, las cifras salieron
limpias. La regla general: **si el guion deja estado, la pasada siguiente lleva
`reload`.**

### Cifras de la pantalla de Entrada (2026-08-04, tras T6)

| | **1280×720** (suelo) | 1440×900 |
|---|---|---|
| Veredicto | **`ok: true`** | **`ok: true`** |
| Vías completas | **3 / 3** | **3 / 3** |
| Alto de la sección | 526,97 px | 556,22 px |
| Escondido tras el scroll | 33 px | 4 px |
| Cuarta vía (expediente) visible | no | sí |
| Botón de medición propia | **sí** | **sí** |

La cuarta vía —abrir un expediente guardado— queda 33 px por debajo del pliegue en
el suelo declarado, y se alcanza scrolleando. Va ahí a propósito: recuperar
trabajo **no es empezar**, y quien la necesita ya sabe que existe.

### ⭐ El defecto que este guion cazó y a ojo no se veía

La primera versión de T6 puso `flex: 1 1 auto` en la sección de Entrada y creó un
**segundo estirador** en el panel, junto al de avisos. `app/rama.js` ya lo tenía
escrito desde F11 —«dos estiradores a la vez descosen el reparto de altura»— y
pasó exactamente eso, con un síntoma que parece imposible:

> **a 1440×900 la sección de Entrada salía MÁS CORTA que a 1280×720**
> (482,17 px contra 526,97), así que la tercera vía no cabía en la ventana GRANDE
> y sí en la pequeña.

El hueco sobrante se repartía entre los dos estiradores y la lista de avisos
—vacía— se llevaba su parte. **A ojo no se ve**, porque quien mira una pantalla
cómoda no sospecha de ella; y la suite tampoco, porque jsdom no calcula
maquetación. Con `flex: 0 1 auto` el estirador vuelve a ser uno y el orden se
restablece: 526,97 px a 1280 y 556,22 a 1440, que es como tiene que ser.

### Lo que T6 le devuelve a la caja de vértices

Sacar el bloque de Entrada de la pantalla de Validación —donde no pinta nada, y
donde llevaba desde F05 quitándole sitio a lo que se está validando— tiene precio
en píxeles, y es el mejor argumento de que este rework hace algo:

| `#tabla-vertices` | Antes de T6 | Después de T6 | Ganancia |
|---|---|---|---|
| 1280×720 | 110,09 px | **228,33 px** | **+118,24 px** |
| 1440×900 | 267,44 px | **385,67 px** | **+118,23 px** |

Los 267,44 px de 1440×900 son el invariante que **siete fases seguidas** se
esforzaron en no mover (F06 lo dejó en 303 sacando la edición al mapa, F07 en 267,
y F08–F11 en 267 a coste cero). T6 no lo protege: lo **sube un 44 %**, y no
optimizando nada — solo dejando de enseñar a la vez dos cosas que nunca se usan a
la vez.

### Ampliación rebanada 2: el marcado y los píxeles dicen lo mismo

Desde el 2026-08-04 el guion mide también **el eje PASO**, y es la única cosa que
puede medirlo. La verificación está partida en dos mitades y ninguna cubre sola:

| Mitad | Quién | Qué afirma | Qué NO puede |
|---|---|---|---|
| Marcado | `test/app/pantalla.dom.test.js` | que cada `data-pantalla` sea un paso que existe, que `<dt>` y `<dd>` se oculten juntos, que las acciones sean de Validación | **jsdom no aplica `estilos/app.css`**: todo sería verde aunque las cinco reglas no existieran |
| Píxeles | `14-shell.js` (esto) | que lo que se VE es exactamente lo que el marcado declara para el paso activo | si el marcado es coherente consigo mismo |

**No hay lista escrita a mano** de qué va en cada pantalla: se leen los
`data-pantalla` del documento y se contrasta con la caja real de cada nodo. Una
segunda lista divergiría, que es la enfermedad que este repositorio ya se ha
encontrado tres veces.

⚠️ El guardián solo denuncia **lo que se ve sin tocarle**, no lo contrario: un
nodo que toca en este paso puede estar oculto legítimamente por un ancestro
marcado o por el eje RAMA. Verse sin declararlo, en cambio, no tiene excusa.

**Verificado por mutación, y las dos mitades dispararon por su lado:** quitando
del CSS la regla de Validación, la prueba de jsdom sale roja (lee el fichero) y
el guion sale rojo **nombrando los 7 nodos** que aparecen donde no deben —el
bloque de Entrada y los tres pares de la ficha de diagnóstico—. De propina saltó
también el criterio 4: con el bloque de Entrada de vuelta, no cabe **ni una**
tarjeta de aviso entera. Mutación revertida.

### Lo que la rebanada 2 le devuelve al panel

El pie del panel valía **266,28 px fijos en cuatro pantallas**: ocho campos de
ficha y dos acciones, en la pantalla que los necesita y en las tres que no. A
1280×720 eso era el **37 % del panel**, y el trabajo de Validación —los avisos y
la tabla de vértices— era el **46,75 % de su propia pantalla**.

Medido a 1280×720, antes y después:

| | Pie: antes → ahora | `#tabla-vertices`: antes → ahora | Campos de ficha |
|---|---|---|---|
| **Validación** | 266,28 → **209,47** | 228,33 → **277,98** (+49,65) | 5 de 8 |
| **Edición** | 266,28 → **122,69** | 228,33 → **353,84** (**+125,51**) | 5 de 8 |
| **Diagnóstico** | 266,28 → **179,50** | 228,33 → **304,19** (+75,86) | 8 de 8 |

A 1440×900 la caja de vértices de Validación pasa de 385,67 a **438,14 px**.

**Edición es la que más gana**, y es donde más falta hace: es la pantalla en la
que se arrastran vértices y se leen coordenadas. Las filas visibles de la tabla
pasan de **9,25 a 11,26** en el suelo declarado.

⭐ **Y cuesta CERO bytes de hoja de estilo** (§21): repartir el pie es marcado
—`data-pantalla`— y las cinco reglas del CSS ya estaban escritas desde T5.

Tres decisiones que salieron de la medición y no del gusto:

- **Los tres campos de diagnóstico** —«Superficie catastral», «Δ catastral» y
  «Colindantes»— decían en Validación «No consta», «No hay con qué comparar» y
  «Sin consultar». La regla de oro 1 exige no callar; no exige reservar sitio
  para un silencio.
- **«Generar GML» se queda en Validación**, por decisión del autor: el camino
  corto de una Subsanación no pasa por el diagnóstico, y mandarlo a Informe
  —que hoy exige diagnóstico previo— alargaría el caso más frecuente.
- **«Diagnosticar encaje» se queda también**, y la primera lectura decía que
  sobra porque el peldaño del rail hace lo mismo. Se midió lo que costaba
  quitarlo: el nodo lo resuelve `app/cableado-diagnostico.js` al montar y lo
  conduce el guion 09, y los 32,39 px que devolvería solo se devolverían en la
  pantalla donde el bloque vive de todos modos.

### Ampliación rebanada 3: ¿se puede EDITAR desde esta pantalla?

Lo que se ve es una cosa y lo que se puede hacer es otra. El guion mide desde el
2026-08-04 la segunda, y es lo único que puede medirla.

⛔ **EL DEFECTO QUE DESTAPÓ.** Los **cuatro** gestos de edición del mapa
—arrastrar un vértice, borrarlo con el botón derecho, insertar otro con doble
clic y seleccionar un lindero— estaban vivos en las **cuatro pantallas**:

| | Validación | Edición |
|---|---|---|
| Marcadores arrastrables | **15 de 15** | 15 de 15 |
| Barra de edición sobre el mapa | **sí** | sí |
| Botón derecho borra un vértice | **sí** | sí |

O sea: **el peldaño «Edición» del rail no cambiaba nada de lo que se podía
hacer.** Era decorativo, que es exactamente el síntoma que este rework existe
para curar — un recorrido prometido que las pantallas no cumplen.

**Se mide por la clase que pone y quita Leaflet** (`leaflet-marker-draggable`,
que sigue a `marker.dragging.enable()/disable()`), **no por nuestro propio
estado**: preguntarle a la aplicación si cree que ha apagado el arrastre no
prueba que lo haya apagado.

Y se comprueban **los dos ejes a la vez**, porque separarlos es el medio arreglo
que se quiso evitar:

1. no se puede editar fuera de Edición;
2. la barra se ve exactamente donde se puede editar;
3. **los dos dicen lo mismo** — esconder el «deshacer» dejando vivo el gesto que
   lo necesita sería peor que no esconder nada.

**Verificado por mutación**: dejando el aplicador de `app/main.js` en
`activa(true)`, el guion sale rojo con **dos** problemas —«se puede editar la
geometría desde validacion: 15 de 30 marcadores arrastrables» y «la barra y los
gestos no dicen lo mismo»—, que son los dos ejes hablando por separado.

⚠️ **Consecuencia para el guion `08-edicion.js`, y ya está resuelta.** Ese guion
conduce la edición, así que fuera de Edición no tenía nada que medir: salía con
**cuatro problemas que describían síntomas** —«no ha aparecido ni un indicador de
enganche», «el vértice se dibuja donde está el ratón»— y ninguno decía la causa.
Ahora lo comprueba él mismo al arrancar y lo dice **en una línea**, con la ruta a
la que hay que relanzarlo. La guarda va dentro del guion y no en una nota de este
documento a propósito: **las notas no se leen cuando el guion ya está corriendo**
(lección de T10).

### Ampliación rebanada 4: ¿el DIAGNÓSTICO es una pantalla o un cajón que se cierra solo?

⛔ **EL DEFECTO QUE DESTAPÓ, y es el que más se parece a la frase que abrió
este rework** («hay flujos diferentes viviendo en la misma pantalla»). Medido en
Chrome el 2026-08-05, a 1280×720, por los tres caminos que llevan a Diagnóstico:

| Cómo se llega | ¿queda el diagnóstico en pantalla? |
|---|---|
| por hash (`#/parcela/diagnostico`) | sí |
| por el CTA del pie («Diagnosticar encaje») | sí |
| **por el peldaño «Diagnóstico» del rail** | **NO** |

O sea: **el único camino que no funcionaba era justo el que el rework promete.**
El cajón se abría y su propio guardián de clic-fuera lo cerraba en el mismo
gesto, porque el clic del rail no es el evento de apertura —y no puede serlo: la
navegación no lleva eventos de DOM, criterio 1—. Sin error, sin aviso y sin nada
en pantalla: el rail seguía marcando «Diagnóstico», el `<h1>` seguía diciendo
«Diagnóstico de encaje» y no había diagnóstico en ninguna parte.

Y había más, del mismo tronco:

- **UN clic en el mapa lo cerraba**, y mirar el mapa es lo que se hace en esa
  pantalla. `Escape` también.
- **Una vez cerrado, el peldaño del rail NO lo devolvía**: navegar al paso en el
  que ya estás no publica nada. El único camino de vuelta era el CTA del pie.
- Y con el cajón abierto, **278 px de 650 (42,77 %) nacían bajo el pliegue**:
  «Preparar informe (PDF)» a 207,53 px por debajo del borde, «Descargar informe
  de contraste» a 248,38 px, el renglón de estado (`role="status"`, o sea el
  canal por el que el cajón cumple la regla de oro 1) a 164,69 px y la invasión
  a colindantes cortada a 15,73 px.

**Lo que mide el guion ahora, y por qué solo se puede medir aquí:**

1. **El cajón está abierto exactamente en su pantalla.** jsdom no puede: hace
   falta el guardián del `document` corriendo de verdad.
2. **Un clic en el mapa no lo cierra** — y el punto se elige a la derecha del
   cajón y se comprueba con `elementFromPoint` que cae FUERA de él, porque con
   el cajón más alto un punto cualquiera del mapa ya no lo está. Si no se
   encuentra ese punto, el guion lo dice en `noCubierto` en vez de dar por
   hecha una comprobación que no ha hecho.
3. **`Escape` tampoco.**
4. **Lo accionable y lo que habla se ven** con el cajón recién abierto: las tres
   patas (dentro del cajón, dentro de la ventana y `elementFromPoint` devolviendo
   el nodo), igual que la puerta en §22.

**Verificado por mutación, DOS veces, y las dos hacían falta** porque la
corrección tiene dos mitades independientes:

- Dejando el aplicador de `app/main.js` mudo (`fijarDiagnosticoComoPantalla: () => {}`):
  el guion saca **2 problemas** —el clic en el mapa y el `Escape`— y el cajón
  vuelve a medir 374,39 px con **287 px (43,55 %) escondidos**.
- Quitándole el `sticky` al bloque anclado: el guion saca **1 problema** —
  «Descargar informe de contraste» cae 23,77 px por debajo del borde—. O sea:
  **el anclaje es lo que salva los botones y el alto es lo que salva lo
  descriptivo**, y al suelo declarado de D5 hacen falta los dos.

**Lo que devuelve, medido después:**

| | 1280×720 | 1440×900 |
|---|---|---|
| Cajón | 420 × **608** px (era 374,39) | 420 × **660,77** |
| Escondido | **53 px (8,04 %)** (eran 278 / 42,77 %) | **0 px** |
| Los dos CTA del informe y el renglón de estado | se ven, 0 px por debajo | ídem |

⚠️ **Los 112 px de `ALTO_COMO_PANTALLA` son una MEDIDA, no un gusto**: el cajón
vive en `bottomleft` con el borde inferior a 31 px del suelo, así que el techo
queda en 81 px — **9 px por debajo del control de zoom, que acaba en 72**. Con
más alto se pisarían y el mapa se quedaría sin manejar. Medido en Chrome: el
cajón sale exactamente a `y: 81`.

⚠️ **Y UNA CONTAMINACIÓN QUE COSTÓ UN FALSO ROJO, otra vez.** La pasada de
Entrada salió con «solo 2 de las 3 vías se ven enteras» y no era un defecto: era
el autoguardado en IndexedDB de las sondas anteriores, que añade una tarjeta de
aviso y le come 60 px al panel. **`reload` NO limpia IndexedDB**; hay que borrar
las bases. Con la base limpia, `ok:true`. Es la misma lección que ya pagó la
rebanada 3 y conviene que esté escrita dos veces.

### Ampliación rebanada 5: ¿el paso «Informe» produce el informe?

⛔ **EL DEFECTO QUE DESTAPÓ, medido el 2026-08-05 a 1280×720.** La pantalla
«Informe» **no tenía nada del informe**:

- el panel enseñaba **exactamente lo mismo que Validación** —cabecera 117 +
  avisos 63 + vértices 360 + pie 179 = 720 px— y **ni un bloque propio**;
- de las tres acciones del informe («Preparar informe (PDF)», «Descargar informe
  de contraste» y «Componer PDF») **no se veía NINGUNA**: las dos primeras viven
  dentro del cajón de diagnóstico, que en Informe está cerrado, y la tercera
  dentro del `<dialog>`;
- o sea que **el PDF se sacaba desde Diagnóstico, con el rail marcando otra
  cosa**: el peldaño «Informe» no participaba en producir el informe.

Y el formulario, una vez abierto, escondía **704 px de 1.336 (52,7 %)** bajo el
pliegue, con **«Componer PDF» y «Cancelar» a 379,53 px por debajo del borde** y
el renglón de estado a 412,92.

**Lo que mide el guion ahora:**

1. **El informe se enseña exactamente en su pantalla** y en ninguna otra.
2. ⭐ **Y no es un modal.** Un `<dialog>` abierto con `showModal()` deja inerte
   todo lo de detrás, y desde el rework detrás está **el rail**. Se comprueba por
   los dos lados: `aria-modal` y **`elementFromPoint` sobre el peldaño
   «Validación»** — porque preguntarle al atributo no prueba que se pueda pulsar.
3. **«Componer PDF» y el renglón de estado se ven** con el informe recién
   abierto, con las tres patas de siempre.

**Verificado por mutación:** dejando el aplicador en `comoPantalla(false)`, el
guion saca **2 problemas** y el segundo es el que decide: **«con el informe
delante, el rail no se puede pulsar»**. La caja sigue midiendo lo mismo
(1070×720), así que la mutación aísla exactamente lo que hace el interruptor.

**Lo que devuelve, medido:**

| | antes | después |
|---|---|---|
| Caja del informe | 760 × 633,59, centrada | **1070 × 720**, a página completa |
| Escondido | 704 px de 1.336 (**52,7 %**) | 442 px de 1.162 (**38,0 %**) |
| «Componer PDF» | 379,53 px por debajo del borde | **se ve**, 0 px por debajo |
| Renglón de estado | 412,92 px por debajo | **se ve**, 0 px por debajo |
| Rail con el informe delante | inerte (modal) | **pulsable** |

⚠️ **«Regenerar el borrador» sigue scrolleando**, y es correcto: vive dentro del
grupo del lindero, junto al texto que regenera. Lo que se ancla es lo que produce
el entregable y lo que habla, no todo lo que sea un botón.

⚠️ **UNA MEDICIÓN QUE SALIÓ MAL Y HAY QUE NO REPETIR:** al llevar el diálogo a
página completa con `top:0; bottom:0` la caja salió de **1.148,92 px sobre una
ventana de 720** —428,92 px fuera de la pantalla y **sin scroll**—. La causa es
que la hoja del navegador le da a `<dialog>` un `height: fit-content`, con el que
`top` y `bottom` **no estiran** el elemento. Hace falta `height: auto` explícito.
Sin medirlo, el arreglo habría sido peor que el defecto.

⚠️ **Y la contaminación de IndexedDB, por tercera vez.** La pasada de Entrada
salió roja («solo 2 de las 3 vías, 114 px tras el scroll») y no era un defecto:
era el autoguardado de las corridas anteriores. Con la base borrada, `ok:true`.
**`reload` NO limpia IndexedDB**; hay que borrar las bases entre corridas.

---

## 21. El presupuesto de la hoja de estilo (Rework de UI · T10)

La única medición de este runbook que **no necesita navegador**. Vive aquí porque
éste es el sitio donde el repositorio guarda lo que se mide, y porque el número
que vigila es de la misma familia que los píxeles del §20: los dos existen para
que la pelea por el sitio deje rastro.

```
npm run build && npm run presupuesto
```

Medidor y registro son el mismo fichero: `scripts/presupuesto-css.mjs`.

### Por qué esto es un script y no un párrafo

El criterio 10 del rework dice que la hoja **acaba pesando menos de 57.159 B al
cerrar la quinta rebanada**, que durante la migración puede subir, y que **cada
rebanada anota cuánto**. La premisa que lo justificaba decía que la hoja había
crecido «un 24 % en una fase y nadie lo vio».

Nadie lo vio porque no había nada que mirar. Escribir ese número a mano en un
markdown reproduce el mismo modo de fallo con más letra: el día que alguien
engorde la hoja no se va a acordar de venir a actualizarlo — exactamente como
nadie volvió a por el rail durante ocho fases (`estilos/app.css:11-21`), y
exactamente como la tabla de guiones de la cabecera de este documento se quedó
diciendo «trece» cuando ya eran catorce.

Así que el registro es código y el medidor lo contrasta. **La regla no es «no
crezcas»** —sería mentira durante una migración—: es **«crece si hace falta, pero
queda anotado»**. La única forma de volver a ponerlo en verde después de tocar
CSS es añadir el asiento.

### ⛔ Qué número es éste, y cuál NO (léelo antes de citar el techo)

**No es `estilos/app.css` en disco.** Ese fichero mide hoy ~182.000 B y casi todo
son comentarios: aquí la hoja es también el registro de diseño, y presupuestar la
fuente castigaría escribir el porqué de cada regla. El minificador se los come
enteros; lo que sobrevive son REGLAS, que es lo que el criterio 10 quiere vigilar
(«si de verdad se quitaron los apaños de la pelea por píxeles o solo se taparon»).
Quien mire el fichero fuente creerá que el presupuesto ha reventado 3×.

Es `dist/assets/index-*.css`: la hoja que se descarga. Contiene, en este orden,
`estilos/app.css` con sus cinco `@import` de tokens fundidos, y detrás
`leaflet/dist/leaflet.css`, que importa `app/main.js`.

**Y ahí está la corrección que trae T10:** de los 57.159 B de la línea base,
**15.095 son de Leaflet**. Medido en las doce builds del barrido histórico:
15.095 B clavados en las doce, porque `leaflet@^1.9.4` no se ha movido desde F05.
Dicho en bytes que este proyecto escribe, el techo del criterio 10 es de
**42.064 B**, no de 57.159. El medidor publica los dos para que nadie tenga que
acordarse de la resta.

### La serie completa, medida (2026-08-04)

Los doce primeros asientos **no se copiaron de ningún sitio**: se midieron
reconstruyendo el artefacto en cada commit. Repetible en ~30 s:

```bash
# por cada hito: se sustituye SOLO estilos/, se construye y se lee dist/assets/*.css
git checkout <commit> -- estilos/ && rm -rf dist && npm run build
node -e "…"   # el corte por '.leaflet-pane,' que hace partirHoja()
git checkout HEAD -- estilos/
```

| Hito | commit | Hoja entera | De este proyecto | Leaflet | Δ nuestro |
|---|---|---:|---:|---:|---:|
| F03 | `5d68f14` | 31.779 B | 16.684 B | 15.095 B | — |
| F04 | `a1c1138` | 32.743 B | 17.648 B | 15.095 B | +964 |
| F05 | `ba00138` | 34.938 B | 19.843 B | 15.095 B | +2.195 |
| **F06** | `3dd7f99` | 42.221 B | **27.126 B** | 15.095 B | ⭐ **+7.283 (+36,7 %)** |
| F07 | `a0e2a9d` | 43.641 B | 28.546 B | 15.095 B | +1.420 |
| F08 | `3ea5d49` | 45.905 B | 30.810 B | 15.095 B | +2.264 |
| F09 | `21366ac` | 49.244 B | 34.149 B | 15.095 B | +3.339 |
| F10 | `c2df2c7` | 52.801 B | 37.706 B | 15.095 B | +3.557 |
| **F11** | `960bb7a` | **57.159 B** | **42.064 B** | 15.095 B | +4.358 |
| Rework T1–T4 | `cdaae52` | 57.159 B | 42.064 B | 15.095 B | ⭐ **0** |
| Rework T5–T6 | `c2e0544` | 61.108 B | 46.013 B | 15.095 B | +3.949 |
| Rework T7–T8 | `848934f` | 61.108 B | 46.013 B | 15.095 B | 0 |
| Rework T9–T10 | (esta rebanada) | 61.108 B | 46.013 B | 15.095 B | 0 |

**F11 es la línea base y el techo a la vez**: el criterio pide acabar por debajo
de donde se empezó.

### Tres cosas que la serie deja a la vista

**1. El «24 % en una fase» de la premisa no reproduce en ninguna unidad** —ni en
la hoja entera, ni en la parte nuestra, ni en el fichero fuente— y el salto real
es **peor**: F06 engordó lo nuestro un **36,7 % de una vez** (+7.283 B), sacando
la barra de edición al mapa. La premisa acertaba en el fondo y erraba en la
cifra, que es exactamente lo que pasa cuando un número se escribe de memoria: la
persona que redactó «nadie lo vio» tampoco lo había mirado.

**2. T1–T4 costaron CERO bytes.** La autoridad de navegación, sus tres guardianes
y el guion del shell son JS puro. Toda la subida del rework —**+3.949 B**— es de
T5–T6: la cáscara de tres columnas (+2.370) y la pantalla de Entrada (+1.579).

**3. Cuatro de los trece hitos costaron cero o casi.** F04 (+964 B), T1–T4 (0),
T7–T8 (0) y T9 (0). Los cajones sobre el mapa se visten con **estilos en línea**
desde `viewer/`, así que crecen sin tocar la hoja: el presupuesto **no ve** esa
clase de crecimiento, y conviene saberlo antes de leer un 0 como una virtud.

### Cómo se añade un asiento

1. `npm run build`
2. `npm run presupuesto` → sale ROJO y te da el par exacto (total, nuestro)
3. lo copias en `ASIENTOS` con su hito, su commit y **una nota de una línea
   diciendo qué subió o bajó**. La nota es la mitad del valor: un número sin causa
   no se puede revisar después, y hay una prueba que la exige.

El techo **no se exige** hasta que las cinco rebanadas —las cinco pantallas del
rail— estén anotadas. Lo dice el criterio 10 y lo implementa `comparar()`.

### Qué cuenta como «pasa»

| Código | Significado |
|---|---|
| `0` | La hoja construida coincide con el último asiento. |
| `1` | La hoja se movió y nadie lo anotó; o las cinco rebanadas están cerradas y no ha bajado del techo. |
| `2` | **No se ha podido medir.** |

El `2` es deliberado y viene de la lección más cara del repositorio
(`scripts/validar-xsd.mjs`): **no poder medir es un fallo, nunca un salto
benigno**. Un guardián que se salta solo no es un guardián, es una intención.

### Los cuatro caminos rojos, verificados por mutación (2026-08-04)

Las piezas puras las cubre `test/scripts/presupuesto-css.test.js` (15 pruebas).
Los cuatro caminos de E/S no se pueden probar ahí, así que se dispararon a mano
sobre el artefacto real:

| Mutación | Resultado |
|---|---|
| Se añade una regla `.gml-` **dentro** de la parte nuestra de `dist/…css` | `1` — «la hoja se ha movido y NADIE lo ha anotado… +28 B» |
| Se añade una regla `.gml-` **detrás** del bloque de Leaflet | `2` — «el vendor ha dejado de ser el final de la hoja» |
| Se toca `estilos/app.css` sin reconstruir | `2` — «la hoja construida es MÁS VIEJA que estilos\app.css» |
| Se borra `dist/` | `2` — «corre `npm run build` y vuelve» |

El tercero no es hipotético: pasó a mano mientras se escribía T10. Un `dist/` de
las 16:18 y un `estilos/app.css` de las 14:53 parecían coherentes y no lo eran.

### Lo que este medidor **NO** puede ver

- **Los estilos en línea de `viewer/`.** Los cinco cajones sobre el mapa se
  visten desde JS; su coste va al bundle, no a la hoja.
- **Si los bytes son buenos o malos.** Mide bytes, no apaños. Una hoja que
  adelgaza reventando la especificidad pasaría en verde.
- **El coste de transferencia.** Se presupuestan bytes en claro; la red mueve
  ~14 kB comprimidos. Un solo número presupuestado, a propósito: dos invitan a
  citar el que convenga.

---

## 22. `15-contraste.js` — la ruta crítica 2 (Rework de UI · T9)

El cuarto guion de esta carpeta que **encuentra un defecto de producción** (el
`10` encontró dos, el `12` uno, el `13` otros dos), y el primero que encuentra
uno que **la suite defendía en verde con siete pruebas escritas a propósito para
cubrirlo**.

Mide la ruta crítica 2 andada de una vez sobre la aplicación real:

```
soltar el GML de otro  →  contrastarlo con el parcelario  →  cruzar la puerta
```

Hasta T9 ese recorrido **no se podía andar**: nada navegaba solo, y «Contrastar
con el parcelario» te dejaba en Entrada mirando las tres vías.

### ⛔ El defecto que lo obligó a existir

La puerta de D4 —«Tomar esta geometría y editarla», el botón que es toda la razón
de ser del modo comprobación— nacía **dentro del `<footer>` del cajón**, al final.
Medido en Chrome:

| | El cajón enseña | La puerta cae | Scroll al llegar |
|---|---|---|---|
| **1280×720** | 372 px de 686 | **314 px por debajo** | `0` |
| **1440×900** | 466 px de 744 | **267 px por debajo** | `0` |

O sea: **el botón nacía fuera de la vista**, al final de un scroll interno que
arranca arriba del todo, y nada decía que estuviera ahí. Peor: el renglón de
procedencia llegaba a **nombrarlo** («pulsa «Tomar esta geometría y editarla»»),
señalando a algo invisible. Un botón que no se ve es menos que ningún botón,
porque además promete.

**Las siete pruebas de la ruta 2 lo daban por bueno** porque jsdom no calcula
maquetación: `getBoundingClientRect()` devuelve ceros y no hay `overflow`. Un
`display` distinto de `none` les basta para decir «se ve».

### ⚠️ La trampa que este guion documenta: «tiene caja» NO es «se ve»

La primera sonda cayó en ella. Daba la puerta por visible —ancho 394, alto
30,84— mientras estaba 280 px por debajo del borde de la ventana. La
comprobación que vale tiene **tres patas**, y hacen falta las tres:

1. **dentro del contenedor** que scrollea (`rect` contra `rect`),
2. **dentro de la ventana** (`top >= 0 && bottom <= innerHeight`),
3. **`elementFromPoint` sobre su centro devuelve LA PUERTA** — que además prueba
   que nadie la está tapando.

Medir el elemento equivocado da un verde que miente: es la misma lección que ya
pagaron el guion 14 (midió el texto de la tarjeta en vez de la lista) y el 09.

### El arreglo, y por qué es donde es

`position: sticky; bottom: 0`, y la puerta pasa a ser **hija directa del
contenedor**, no del pie. `sticky` se pega dentro del bloque contenedor del
elemento: metida en el `<footer>` —que vive al final del contenido— solo se
pegaría cuando el pie ya estuviera a la vista, o sea nunca.

Dos cosas más que salieron de medir y no de suponer:

- **`display: block` explícito.** Un `<button>` sin `display` vuelve a
  `inline-block`, y `sticky` no se pega sobre un elemento en línea. Con la cadena
  vacía el arreglo se deshace sin que nada lo diga.
- **`width: calc(100% + 24px)` y `box-sizing: border-box`.** `width: auto` no
  vale: un `<button>` con `display: block` **sigue dimensionándose por su
  contenido**, así que la barra salía de **220,83 px en un cajón de 420** y el
  texto que scrollea por detrás asomaba por la derecha. Medido después: 418 px de
  puerta en 420 de cajón, 1 px a cada lado, que es el borde.

El arreglo **cuesta 0 bytes de presupuesto** (§21): el cajón se viste con estilos
en línea.

### Régimen de red — léete el §13 antes de lanzarlo

Toca el servicio REAL: una pasada, sin bucles, **como mucho dos peticiones de
datos**. Si el servicio no contesta, el guion lo dice y no reintenta; el problema
que reporta distingue explícitamente «no se abre el cajón» de «el servicio no ha
contestado», para que nadie acuse a la aplicación de lo que es de la red.

⚠️ **Necesita `npm run dev`, no `vite preview`**: el fixture se trae por `fetch`
de `test/fixtures/gml/`, y `preview` sirve `dist/`, donde no está.

### ⚠️ Este guion deja estado en INDEXEDDB, y `reload` NO lo limpia

Al terminar la ruta hay un **expediente autoguardado**. La corrida siguiente
arranca con una tarjeta de aviso más —«hay trabajo autoguardado de una sesión
anterior sin recuperar»— que le come **73,14 px** a la caja de vértices.

Costó una falsa regresión el 2026-08-04: la caja pasó de 228,33 a 155,19 px justo
después de arreglar la puerta, y pareció culpa del arreglo. No lo era. El guion lo
detecta y lo dice en `advertencias` en vez de dejarte comparar peras con manzanas,
pero **la limpieza hay que hacerla a mano**, con un `js` que recorra
`indexedDB.databases()` y llame a `deleteDatabase` en cada una, y un `reload`
detrás.

Es la regla del §20 llevada un paso más allá: **si el guion deja estado en disco,
la pasada siguiente lleva borrado, no `reload`.**

### Cómo se lanza

```bash
npm run dev                                        # ⚠️ dev, no `vite preview`

$B viewport 1280x720                               # el SUELO declarado (D5)
# … borrar IndexedDB (arriba) …
$B goto http://localhost:PUERTO/concretagml/#/parcela/entrada
$B reload
$B wait ".gml-rail"
$B console --clear
$B eval scripts/smoke-navegador/15-contraste.js

$B viewport 1440x900                               # y la pasada cómoda
# … borrar IndexedDB otra vez …
$B reload && $B wait ".gml-rail"
$B eval scripts/smoke-navegador/15-contraste.js
$B console --errors                                # → (no console errors)
```

### Qué cuenta como «pasa»

`ok: true` y `problemas: []` en **las dos** pasadas, y además:

- `puerta.seVe: true`, con `loQueHayEnSuCentro` devolviendo el propio botón.
- Tras soltar: `paso === 'entrada'` (traer un fichero es empezar otro
  expediente), cajón de comprobación puesto y el de diagnóstico no.
- Tras contrastar: `paso === 'diagnostico'`, los cajones intercambiados, la
  procedencia visible diciendo «otro técnico» y nombrando la puerta, y **Edición
  apagada** (la comprobación es de solo lectura).
- Tras cruzar: la puerta desaparece, Edición se enciende y la procedencia pasa a
  «Lo has tomado como tuyo… el fichero del que salió no se modifica».

### Cifras de referencia (corrida de cierre, 2026-08-04, `npm run dev`, puerto 5176)

| | **1280×720** | 1440×900 |
|---|---|---|
| Veredicto | **`ok: true`** | **`ok: true`** |
| Puerta: se ve | **sí** | **sí** |
| Puerta: caja | 418 × 39,84 px | 418 × 39,84 px |
| Cajón: enseña / contenido | 372 / 727 px | 466 / 727 px |
| Puerta por debajo del cajón | **−11 px** (dentro) | **−11 px** (dentro) |
| `#tabla-vertices` tras contrastar | **228,33 px** | **385,67 px** |
| Consola | limpia | limpia |

Los 228,33 y 385,67 px son **exactamente** los que T6 dejó (§20): abrir el cajón
de diagnóstico sobre el mapa no le quita ni un píxel al panel, que es la razón
por la que el cajón flota y no baja al panel (F07).

### La verificación del propio guion

Un guion que solo ha visto la versión arreglada no prueba nada. Éste se lanzó
**contra el defecto original** —puerta devuelta al `<footer>`, `sticky` quitado—
y salió:

```
ok: false
"LA PUERTA NO SE VE, y la procedencia la está nombrando. Dentro del cajón: false;
 dentro de la ventana: false; en su centro hay «FUERA DE LA VENTANA». Se sale
 259.75 px por debajo del cajón, que enseña 466 px de 727."
```

Un solo problema, el correcto, con la cifra: el resto de la ruta siguió verde. Eso
es lo que distingue un guardián de una alarma.

### Lo que este guion deja al checklist humano

- **Que alguien ENCUENTRE la puerta sin que se la señalen.** Este guion mide que
  se ve; que se lea como el siguiente paso del recorrido no tiene número.
- **Que el texto de procedencia se entienda.** Se comprueba que dice de quién es
  la geometría y que cambia al cruzar; que un colegiado lo lea sin releerlo, no.
- **Si el diagnóstico es correcto.** Eso es del guion 09 y de la suite.

---

## 23. La pasada de regresión del rework de UI (2026-08-04)

Los cuatro guiones que ya existían se relanzaron después del rework, para ver qué
había roto. El resultado, y **la conclusión importante: ningún defecto de
producto**.

| Guion | Veredicto | Qué pasa |
|---|---|---|
| `09-diagnostico.js` | ✅ `ok:true` | Sin tocar. Red dentro del régimen (1 GetParcel + 1 GetNeighbour). |
| `10-comprobar-gml.js` | ⚠️ **`ok:false`** | **Conduce el flujo anterior a T9.** Pendiente de revisión — abajo. |
| `12-expedientes.js` | ✅ `ok:true` | Sin tocar. Queda su advertencia de foco, que es anterior al rework. |
| `13-edificio.js` | ✅ `ok:true` | Rojo por dos cosas suyas, las dos corregidas — abajo. |
| `14-shell.js` | ✅ `ok:true` ×2 | Las dos pasadas de D5, cifras clavadas al registro de T5–T6. |
| `15-contraste.js` | ✅ `ok:true` ×2 | Nuevo. Encontró y cerró el defecto de la puerta (§22). |

⚠️ **Y una consecuencia práctica del rework que afecta a TODOS los runbooks de
arriba:** la aplicación arranca en **Entrada**, donde `#tabla-vertices` está
oculta, así que el `$B wait ".gml-tabla-vertices"` de las recetas **se queda
colgado 15 s y falla**. Lánzalos sobre `#/parcela/validacion`, o espera a
`.gml-rail`, que existe siempre.

### `13-edificio.js` — dos cosas suyas, las dos corregidas

**1. La referencia de la caja de vértices pasó de 267 a 386 px.** Valía 267 desde
F07, y F08, F09, F10 y F11 se esforzaron en no moverla: cada una metió su interfaz
en otro sitio precisamente para no tocarla. **T6 la subió a 385,67 px (+44 %)**
sacando el bloque de Entrada de la pantalla de Validación. Se sube la referencia,
no se baja el listón: lo que se vigila sigue siendo que nadie se la coma otra vez.

**2. Leía «la última tarjeta de aviso» y el rework introdujo una segunda clase de
mensaje.** Ahora hay avisos **de dominio** («ese dibujo entra como partes de un
edificio… cambia a la rama Edificio») y avisos **de la autoridad de navegación**
(«ya no se puede seguir en Validación… te dejo en Entrada»), y el segundo puede
llegar detrás del primero. `slice(-1)[0]` devolvía el de navegación y el guion
acusaba al de dominio de no decir por dónde sí entra —cuando lo dice—. Comprobado
soltando el mismo fichero en una página limpia: el mensaje de dominio está intacto
y nombra la rama Edificio. Ahora se busca la tarjeta **que habla del dibujo**, no
la que llegó al final.

### ⭐ Y de paso: el defecto A de F11 está CERRADO, y lo cerró el rework

El §19 dejaba abierto el defecto A —«las dos cajas encogibles del panel de
Edificio, **18,33 px cortas**: con 7 partes cargadas no se ve ninguna fila
entera»—. Medido hoy con las mismas 7 partes:

| | F11 (2026-08-04, antes del rework) | Hoy |
|---|---|---|
| Alto de la lista de partes | **18,33 px cortos** | **107,28 px** |
| Filas que se ven enteras | **0** | **4** |

El **criterio 9** del plan del rework decía: «el defecto A de F11 llega a 0 por
construcción **tras la rebanada de Edificio**». Se cumple **antes**, y sin haberla
hecho: se lo llevaron por delante los +118 px que T6 le devolvió al panel al dejar
de enseñar a la vez dos cosas que nunca se usan a la vez.

### ⚠️ `10-comprobar-gml.js` — PENDIENTE DE REVISIÓN, y por qué no se ha parcheado

Sale `ok:false` con tres problemas y dos plazos agotados. **Los cinco tienen una
sola causa raíz**: T9 cambió dónde te deja soltar un fichero. Antes te quedabas en
la pantalla única; ahora **traer un fichero es empezar otro expediente**, así que
la aplicación vuelve a **Entrada** — y este guion, escrito para lo anterior, sigue
midiendo el panel de Validación y pulsando un CTA que en Entrada no está.

Lo que reporta, y lo que se midió para saber si había defecto detrás:

| Lo que dice el guion | Lo que se midió | Veredicto |
|---|---|---|
| «"Abrir un GML…" no está en `.gml-rotulo-fila`» | La fila del rótulo **murió en T6**; el botón vive en la tercera vía de Entrada, y el guion 14 lo mide entero y visible | **superado, no roto** |
| «Soltar le ha quitado altura a la caja de vértices (386 → 0)» | En Entrada la caja **no se enseña**: es otra pantalla, no una pérdida | **superado** |
| «Los botones derivados no cuadran (colindantes apagado)» | Medido en los cuatro instantes del recorrido: **«Traer colindantes» está ENCENDIDO siempre** | **artefacto**: el guion llega ahí con la app en un estado que no pretendía |
| Plazos agotados (cajón de diagnóstico, colindantes) | El CTA «Diagnosticar» del pie **sí abre el cajón** (guion 09, `ok:true`), y la ruta de comprobación entera funciona (guion 15, `ok:true` ×2) | **artefacto de la misma causa** |

**No se ha parcheado a propósito.** Son 1.990 líneas escritas alrededor de un
recorrido que ya no existe, y media docena de sus invariantes ya no se pueden
medir porque **el cajón de comprobación y la caja de vértices ya no coexisten**:
viven en pantallas distintas. Un parche que lo pusiera en verde lo pondría verde
**por el motivo equivocado**, que en este repositorio es el peor resultado
posible. Necesita una revisión propia, y lo que hay que replantear es esto:

1. La **Decisión 5 de F08** («el botón en la fila del rótulo, para que cueste
   0 px») está **disuelta**, no incumplida: ya no hay fila del rótulo y el botón
   no compite por la altura de nada.
2. El invariante «abrir el cajón no le quita altura a la caja de vértices» es hoy
   **inmedible**, por la misma razón.
3. Todo lo que el guion mide **después de soltar** —el reencuadre, las
   colindantes dibujadas, el campo de la referencia, los bytes del informe— sigue
   siendo válido y valioso; lo único que hay que rehacer es **cómo llega hasta
   ahí**: por «Contrastar con el parcelario» del cajón, como hace el `15`.

Mientras tanto, la cobertura no se ha perdido: el `09` cubre el cajón de
diagnóstico y su red, el `15` cubre la ruta de comprobación entera con la puerta,
y el `12` cubre la persistencia.
---

## 24. ¿Abre el DXF en un CAD? (`npm run validar:dxf`)

La segunda medición de este runbook que **no necesita navegador**, y la gemela del
§21: las dos existen porque una cifra que nadie vuelve a mirar deja de ser una
medición.

```
npm run validar:dxf              # informa
npm run validar:dxf -- --estricto  # y NO poder medir es un fallo (código 2)
```

Motor y oráculo: **`ezdxf`**, que no es nuestro. `scripts/validar-dxf.mjs` genera
los casos con `export/dxf.js` —no lee fixtures: audita lo que la aplicación
produce **hoy**— y `scripts/validar-dxf.py` los abre.

**⛔ POR QUÉ HACE FALTA, Y NO ES CELO.** Medido el 2026-08-03, al escribir F10: el
DXF del override O12 al pie de la letra **no abre** (`DXFStructureError`), y
**`parsers/dxf.js` —nuestro propio lector— lo aprobaba sin una queja**: dos
anillos, coordenadas exactas, cero detecciones. La prueba de ida y vuelta que iba
a ser la red de seguridad **habría salido verde con un fichero que no abre en
ninguna parte**.

F10 corrigió el exportador y dejó los hechos de aquella ablación escritos a mano
sobre los bytes en `test/export/dxf.test.js`. Eso es mucho, y **sigue sin ser un
lector**: son pruebas que comprueban NUESTRA lectura del formato. El oráculo de
verdad corrió **una vez, a mano, fuera de la suite**. Esto lo hace repetible, que
es la diferencia entre una medición y un guardián.

### ⛔ 2026-08-05 · ESTE VALIDADOR DIO VERDE A UN FICHERO QUE COLGABA UN CAD

Un usuario abrió en **ZWCAD 2023 Professional** el DXF que la aplicación acababa
de exportar (parcela 9398516VK3799G). **El programa se quedó en blanco y
bloqueado, reteniendo el fichero.** Y este validador, la suite (5.964 pruebas) y
el guion 12 daban los tres verde.

La causa, medida comparando estructuras crudas:

| fichero | secciones | tablas | versión |
|---|---|---|---|
| el nuestro | HEADER → TABLES → ENTITIES | LAYER | **`AC1015`** |
| los 3 DXF reales de AutoCAD del repo | HEADER → **CLASSES** → TABLES → **BLOCKS** → ENTITIES → **OBJECTS** | 9 tablas | `AC1015` |
| los del **Catastro** (`ConsultaMasiva_.dxf`) | HEADER → TABLES → ENTITIES | LTYPE, LAYER | **ninguna** (R12) |

**Declarábamos R2000 sin emitir nada de lo que R2000 exige**: ni `CLASSES`, ni la
tabla `BLOCK_RECORD`, ni `BLOCKS` con `*Model_Space` —quien POSEE a las
entidades—, ni `OBJECTS` con el diccionario raíz. Un lector estricto lee la
versión, aplica sus reglas y se queda sin suelo.

⚠️ **Por qué ezdxf no lo veía, que es la lección de verdad:** *ezdxf rellena por
su cuenta las tablas y secciones que faltan al cargar*. Su documento siempre las
tiene. Preguntarle «¿traía este fichero la tabla BLOCK_RECORD?» **responde por su
modelo, nunca por el fichero**. No es un fallo de ezdxf: es que un lector
tolerante no sirve para juzgar si algo está completo.

**Qué se hizo.** Se probaron tres candidatos en el ZWCAD del usuario: **R12
abre**, **R2000 completo abre**, y **el nuestro con extents añadidas NO** —lo que
descarta que fuera un problema de vista—. La salida pasó a **R12**, que es la
versión que el módulo puede cumplir entera y la que el Catastro le entrega a este
mismo público. Ver la cabecera de `export/dxf.js` para las tres razones.

**Las cinco cosas que comprueba ahora, y en qué pasada:**

*Pasada de los BYTES (sin ezdxf, porque para cuando él tiene un documento ya ha
rellenado los huecos):*

1. ⭐ **La versión declarada se CUMPLE.** Si el fichero dice R13 o superior, tiene
   que traer `CLASSES`, `BLOCK_RECORD`, `BLOCKS` con `*Model_Space` y `OBJECTS`.
   Es el defecto de ZWCAD, y el único de los cinco que ezdxf no puede ver.
2. **Ningún tipo de línea nombrado por una capa se queda sin declarar** (ezdxf se
   inventa la tabla `LTYPE` si falta, así que también hay que mirarlo aquí).

*Pasada de ezdxf, el lector independiente:*

3. **Abre con `readfile`, no con `recover`.** `recover` está para rescatar
   ficheros rotos: usarlo aquí sería preguntar «¿se puede salvar?» en vez de
   «¿está bien?».
4. **El auditor no encuentra NADA que arreglar: 0 errores y 0 arreglos.** Un
   arreglo no es un aprobado, es el lector tapando un defecto en silencio.
5. ⭐ **Las capas que las entidades NOMBRAN están en la tabla LAYER.** Es la
   trampa gorda de F10: sin la sección `TABLES`, ezdxf abre el fichero, ve las
   polilíneas y el auditor da 0 y 0 — pero las capas **no existen**, y el
   criterio «abre en CAD con las dos capas separadas» fallaría entero sin que
   nada avisara.

**Estado (2026-08-05):** los tres casos ✓ con ezdxf 1.4.4 — dos capas, una sola y
con huecos—, `readfile` sin recuperación y auditor a 0/0, salida R12.

⭐ **El veredicto del validador coincide con el de ZWCAD en los CINCO ficheros de
los que hay veredicto humano**, que es la única calibración que tiene sentido:

| fichero | ZWCAD 2023 | el validador |
|---|---|---|
| el que exportábamos (`AC1015` pelado) | ⛔ blanco y bloqueado | ✗ «declara AC1015 y NO trae: …» |
| ese mismo + extents | ⛔ blanco y bloqueado | ✗ lo mismo |
| R12 | ✅ abre | ✓ |
| R2000 completo (escrito por ezdxf) | ✅ abre | ✓ |
| `ConsultaMasiva_.dxf` del Catastro | ✅ (se abre a diario) | ✓ «sin declarar (R12)» |

**Verificado POR MUTACIÓN, tres veces** (las dos primeras, del día que nació el
script, cuando la salida era R2000):

| Mutación en `export/dxf.js` | La suite | El validador |
|---|---|---|
| quitar `100=AcDbPolyline` | 2 rojas | **`NO ABRE: DXFStructureError: missing 'AcDbPolyline' subclass`** en los 3 casos |
| todas las entidades con el MISMO handle | 2 rojas | **«Removed entity LWPOLYLINE(#30) with a conflicting handle»** — o sea, el lector **borra una polilínea** para poder abrirlo |
| ⭐ volver a declarar `AC1015` sin el esqueleto | 1 roja | **«declara "AC1015" y NO trae: sección CLASSES, sección BLOCKS, sección OBJECTS, tabla BLOCK_RECORD, bloque \*Model_Space»** |

⚠️ **Y la suite no estaba ciega a ninguna de las tres**, conviene decirlo. Lo que
añade el validador es **quién juzga** — y se ve en la segunda mutación: la suite
dice «un snapshot no cuadra», el validador dice **qué entidad se pierde al abrir
el fichero**.

⛔ **Lo que NINGUNA de las dos pasadas sustituye: abrir el fichero en un CAD.**
Este defecto lo destapó una persona con ZWCAD, no una máquina, después de que
tres guardianes distintos lo dieran por bueno. El punto BLOQUEANTE del checklist
§11.4 no es una formalidad.

⚠️ **Un defecto de este propio script, cazado por su primera mutación:** `ezdxf`
no le define `__str__` a `ErrorEntry`, así que el informe imprimía
`<ezdxf.audit.ErrorEntry object at 0x…>`. Cazaba el defecto y **no sabía decir
cuál era**, que es media regla de oro 1 sin cumplir. Ahora imprime código,
mensaje y entidad.

⚠️ **En Windows hay que reconfigurar la salida a UTF-8**: la consola sale en
`cp1252` y el primer `✓` reventaba el script con `UnicodeEncodeError`, o sea que
el validador «fallaba» por un carácter y no por el fichero.

**Es gate en CI** (`deploy.yml`, job `esquema`, junto al del XSD y con
`pip install ezdxf`).
