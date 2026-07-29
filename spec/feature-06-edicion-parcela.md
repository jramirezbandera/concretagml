# F06 · Edición (parcela)

**Fase:** 6 · **Prioridad:** P6 · **Riesgo:** Medio (offset/snap) · **Depende de:** F03, F05 · **Habilita:** F07.

**Ficheros (los REALES; la spec original nombraba tres — ver «Ficheros que la fase creó de verdad»):**
`edit/snap.js`, `edit/offset.js`, `edit/vertices.js`, `edit/metricas.js`, `edit/_comun.js`,
`geo/segmento.js`, `geo/metrica.js`, `config/operativos.js`,
`viewer/edicion.js`, `viewer/acotaciones.js`, `viewer/barra-edicion.js`, más
`edit/historial.js`, `viewer/index.js`,
`viewer/sincronizacion.js`, `app/main.js`, `app/cableado-catastro.js`, `index.html` y
`estilos/app.css`. **`edit/dibujo.js` NO se ha hecho** (deuda declarada más abajo).

> ⛔ **Esta spec se REESCRIBIÓ el 2026-07-28**, al terminar la fase, para que diga lo
> que hay y no lo que se pensaba hacer. Lo que decía antes **no se borra**: se
> conserva tachado o citado al lado de lo medido, igual que en `SPEC.md` §3.1 y en
> `feature-05-catastro-vivo.md`. Manda lo medido (regla de oro 8).
>
> ⛔ **Y se volvió a tocar el 2026-07-29**, al cerrar la deuda 2 (el presupuesto de
> altura del panel): las herramientas se fueron a una **barra flotante sobre el
> mapa** y la ayuda a un botón «?». El diagnóstico de la deuda **se conserva
> entero** y la corrección va al lado, con sus números — mismo criterio.

## Objetivo

Edición básica (no un CAD) que cubre el caso frecuente: **ajustar unos vértices sobre la parcela oficial**. Con retroalimentación numérica en vivo.

## Alcance

- **Arrastrar, insertar y eliminar vértice.**
- **Editar la coordenada tecleándola en la celda de la tabla** — elemental y ausente en la competencia.
- **Snap** al parcelario oficial y a las colindantes: tolerancia configurable (20 cm por defecto), indicador visual, desactivable con ~~tecla modificadora~~ **`Alt`** (M4). Proyección punto→segmento: `t = clamp(dot(P−A,AB)/dot(AB,AB), 0, 1)`; `F = A + t·AB`; si `dist < τ`, `P←F`.
  El «indicador visual» de la spec se concretó en la **convención OSNAP de AutoCAD** — ver «El indicador de enganche» más abajo (M8).
  ⚠️ Las **colindantes no llegan solas**: entran por el botón «Traer colindantes», una petición por pulsación (M5).
- **Desplazamiento de lindero en paralelo (offset perpendicular)** — la operación más usada: seleccionar un lado y desplazarlo una distancia; los vértices contiguos se recalculan por intersección con los lados adyacentes. ~~`nrm=(u.y,−u.x)`~~ **`nrm_fuera = orientacion(anillo)·(u.y,−u.x)`** (M1, y `SPEC.md` §3 override **O17**); recta desplazada; `intersectRectas`. **Guard de paralelismo:** si `|den| < ε` → fallback traslación/bevel (miter-limit; la velocidad del vértice diverge en ángulos agudos).
  ⚠️ El fallback **no es el caso raro del ángulo agudo: es el camino normal** (M2). Y son **dos** fallbacks distintos, no uno.
- **Deshacer/rehacer** (usa `edit/historial.js` de F00; snapshot en `dragstart`/`dragend`, no por `mousemove`).
  ⚠️ El historial de F00 **no servía tal cual**: había que sembrarlo y había que poder reiniciarlo (M3).

### El mapa de gestos

**No estaba escrito en ninguna spec**, y un gesto que nadie descubre no existe. Lo
define `viewer/edicion.js`.

~~En la pantalla se cuenta en tres renglones de 11 px pegados al control que usa
cada uno (`index.html`, bloque «Edición»).~~ ⛔ **Desde el 2026-07-29 se cuenta en el
PANEL DE AYUDA** del botón «?» de la barra, con esta misma tabla y una línea de
introducción. Y no es una copia escrita a mano: la tabla se genera de
`viewer/barra-edicion.js#GESTOS`, que es **la única copia**, y el umbral de puntería
se interpola de `viewer/edicion.js#UMBRAL_PUNTERIA_PX` en vez de escribirse — copiar
ese número dejaría que la ayuda mintiera el día que alguien lo ajustara, que es el
modo de fallo habitual de toda ayuda escrita a mano.

| Gesto | Dónde | Qué hace | ¿Escribe en el modelo? |
|---|---|---|---|
| **Clic** | mapa | Selecciona el lindero más cercano si cae a ≤ **12 px** (`UMBRAL_PUNTERIA_PX`, tolerancia de PUNTERÍA, en píxeles). Si no cae ninguno, deselecciona. | **No, nunca.** Cambia un resalte |
| **Doble clic** | mapa | Inserta un vértice en el lindero más cercano, **proyectado sobre el lado**, no en el punto crudo del clic. Único gesto del mapa que cambia la geometría | Sí |
| **Clic derecho** (menú contextual) | sobre un vértice | Lo elimina (con `preventDefault`: no sale además el menú del navegador) | Sí |
| **`Alt`** sostenida | cualquier gesto | Apaga el snap mientras dura | No |
| **Arrastrar** un vértice | mapa | Lo mueve, con enganche si el snap está activo. **Un `set` y un `commit`, en el `dragend`** | Sí, al soltar |
| **Teclear** una coordenada | tabla de vértices (panel) | Mueve el vértice | Sí |
| **«Desplazar lindero»** + distancia (m) | **barra**, en su desplegable | Offset del lado seleccionado | Sí |
| **`Ctrl+Z` / `Ctrl+Y`** | app | Deshacer / rehacer. **Se callan dentro de un `<input>`**: ahí ese atajo es el del navegador sobre el texto que se escribe, y las celdas de coordenada son inputs | Sí |

Dos consecuencias que conviene tener escritas:

- Un **doble clic contiene dos clics**, y Leaflet los emite igualmente: el gesto
  completo selecciona ese lado (dos veces, idempotente) y luego inserta en él. Es
  coherente —el vértice cae en el lado que acaba de resaltarse— y no rompe la
  garantía «un clic no escribe»: lo que escribió fue el doble clic. Se descartó
  retrasar la selección con un temporizador: metería latencia en el gesto más
  frecuente para arreglar algo que no está roto.
- Mientras la edición vive, el **`doubleClickZoom` de Leaflet queda apagado** y se
  restaura al destruirla. Insertar un vértice y ampliar el mapa con el mismo gesto
  sí sería un efecto sorpresa.

### Dónde viven las herramientas (cambiado el 2026-07-29)

**Sobre el mapa, no en el panel.** `viewer/barra-edicion.js` monta un `L.Control` en
`topleft` con **cinco herramientas**: deshacer, rehacer, **ajuste al parcelario**
(botón partido: el conmutador a la izquierda, y a su derecha una flecha que abre el
desplegable con la tolerancia en cm), **desplazar lindero** (desplegable con la
distancia en m y su botón) y **ayuda «?»**. Lo monta `viewer/index.js#crearVisor`
cuando la edición está activa, por la opción `edicion.barra`, que es **cierta por
defecto**: la barra es la única superficie desde la que se puede deshacer, conmutar
el enganche o desplazar un lindero, así que un visor con edición y sin barra tiene
la mitad de la función inalcanzable. Hay que pedir `barra: false` a mano, y solo
tiene sentido para quien fabrique su propia UI.

El bloque `gml-bloque--edicion` **ya no existe en `index.html`**. El porqué, con sus
cifras, está en «Deuda declarada · 2».

Tres decisiones de ese módulo que no son de adorno:

- **El contrato con `app/main.js` no se ha tocado.** `cablearEdicion` resuelve sus
  siete nodos **por selector y en el instante de llamarla**, que ocurre después de
  `crearVisor`; la barra produce esos mismos siete `data-*` con los mismos tipos de
  elemento (`[data-campo="snap"]` sigue siendo un `<input type="checkbox">`, aunque
  se estile como botón). Consecuencia nueva y que sí hay que respetar: **el orden
  importa** — la barra antes, el cableado después.
- **Los campos de los desplegables existen SIEMPRE en el DOM**, ocultos con
  `hidden`. Si se crearan al abrir, el `nodo()` de `app/main.js` lanzaría al
  arrancar y `08-edicion.js` —que teclea en la tolerancia sin abrir nada— dejaría de
  funcionar.
- **Pinchar fuera cierra sin interceptar el clic.** El oyente va en el `document`,
  en fase de burbuja, y **nunca** llama a `preventDefault` ni a `stopPropagation`:
  así un solo clic cierra el desplegable **y además** selecciona el lindero. Con la
  intercepción habitual de un menú, el primer clic tras abrir «Desplazar lindero» se
  lo habría comido la barra y habría que pinchar dos veces sin que nada lo
  explicara.

### El indicador de enganche (M8, corregido el 2026-07-28)

La spec pedía «indicador visual» y no decía más. La primera implementación puso
**dos círculos** del mismo tamaño, uno macizo (vértice) y otro hueco (lindero). Es
una distinción que sobre el papel se entiende y en pantalla no existe: ocurre a
mitad de un arrastre, a 20 px del puntero, sobre una ortofoto de contraste
arbitrario y con el cuadradito amarillo del vértice justo debajo. **Relleno y tamaño
son justo los dos canales que esa situación destruye.**

Se adopta la **convención OSNAP de AutoCAD**, que lleva décadas resolviendo el mismo
problema con **siluetas**: la forma se reconoce de reojo, sobrevive al contraste malo
y no depende del color —que aquí, además, está ocupado (ni rojo, ni azul, ni verde:
ver `viewer/_comun.js#COLOR_USUARIO`)—.

| Enganche | Silueta | Equivalente AutoCAD | Por qué esa y no otra |
|---|---|---|---|
| **VÉRTICE** | cuadrado hueco de 18 px alrededor del vértice | *Punto final* (Endpoint) | Hace coincidir dos puntos EXACTAMENTE; el cuadrado captura un punto discreto |
| **LINDERO** | reloj de arena de 16 px sobre la línea | *Cercano* (Nearest) | La equivalencia es literal, no una analogía: el punto puede caer en **cualquier** sitio del segmento (`0 ≤ t ≤ 1`), deslizando sobre la línea |

Las dos van con **trazo doble** —halo oscuro debajo, color del usuario encima—,
que es lo que hace legible un dibujo de líneas igual sobre asfalto claro que sobre
arbolado en sombra; es el mismo problema que las acotaciones resuelven con una
píldora detrás del texto.

**Dos cosas que solo aparecieron MIRÁNDOLO en el navegador**, y que ninguna prueba
de jsdom podía dar (las dos están ahora fijadas por test):

1. **La acotación tapaba el enganche a lindero.** El indicador vivía en el pane de
   la geometría editada (420) y las cotas viven en el 425, **pintadas justo en el
   punto medio del lado** — que es donde más cae un enganche a lindero. El
   indicador dejaba de hacer su único trabajo precisamente en su caso más
   frecuente. Corregido: el indicador sube al pane de vértices (430). El criterio es
   el de AutoCAD y se sostiene solo — la marca de referencia a objetos responde al
   gesto **en curso** y se dibuja encima de todo; lo ambiental (cotas, resalte)
   cede. No tapa el vértice que rodea porque la silueta es **hueca**. El **resalte
   del lado sí se queda abajo**, y por el motivo contrario: es un trazo grueso que
   taparía los vértices sobre los que hay que seguir pinchando.
2. **El cuadrado de 11 px no se distinguía del vértice de 10 px**: salía un cuadrado
   dentro de otro casi idéntico. Subido a 18 px, o sea 4 px de aire por lado.

### Retroalimentación en vivo

Siempre visibles mientras se edita: **acotación de cada lado sobre el dibujo**, **superficie y perímetro** actualizándose con el arrastre, y **diferencia respecto a la superficie catastral** en vivo si hay parcela oficial cargada. Todas las métricas por **helpers euclídeos propios** (regla de oro 6), nunca `turf.distance`/`turf.length`.

Cómo se cumplió sin romper la cadencia del store: por un **canal aparte**
(`alPrevisualizar`), que recibe los anillos en vuelo y **no escribe ni commitea**
(M6). Las cotas se filtran **por píxeles** (`OPERATIVOS.acotacionMinimaPx` = 44 px),
no por metros: lo que hace ilegible una cota es que el número no quepa entre sus
extremos, y eso depende del zoom, no del terreno.

## Notas

- El snap escribe al mismo `store` que la tabla y el mapa (F03); todo son vistas del mismo estado.
- Tolerancias operativas en `config/operativos.json` (snap 20 cm), no `umbrales.json`.
  F06 añadió cuatro claves: `snapMetros` (0,2), `senoMinimoOffset` (0,01 ≈ 0,57°),
  `miterLimiteFactor` (4, el `stroke-miterlimit` por defecto de SVG) y
  `acotacionMinimaPx` (44 px, la única clave del fichero que no va en unidades SI,
  y se documenta como tal).
- ~~`edit/dibujo.js` (dibujar recinto desde cero) se estrena aquí en su base y se completa en F12 para edificio.~~
  ⛔ **NO se ha hecho. Diferido entero a F12** — ver «Deuda declarada · 1».

## Criterios de aceptación

1. Arrastrar/insertar/eliminar y teclear coordenada modifican el modelo y se reflejan en mapa y tabla a la vez. ✅
2. Snap engancha al vértice/lindero más cercano dentro de τ y se desactiva con la tecla modificadora. ✅
   *La tecla es `Alt` (M4), y «desactivar» se implementa pasando `τ ≤ 0`: no hay un booleano paralelo que pueda contradecir a la tolerancia.*
3. Offset de un lado recalcula los vértices contiguos por intersección; ~~en ángulo agudo~~ **casi siempre** aplica el fallback sin explotar. ✅
   ⚠️ **El enunciado engañaba** y por eso se corrige aquí: el fallback es la regla, no la excepción (M2), y son **dos** (traslación y bisel), cada uno para un caso distinto.
4. Superficie/perímetro/Δcatastral se actualizan durante el arrastre. ✅
   *Por `alPrevisualizar`, sin tocar el store (M6). Y `Δ` sale `null` —«No hay con qué comparar»— cuando no hay superficie declarada: `null` no es `0`.*
5. Undo/redo revierten operaciones completas, no fotogramas del arrastre. ✅
   ⚠️ *No salía gratis: hubo que **sembrar** el historial en el arranque y añadirle `reiniciar()` (M3).*

## ⛔ Lo que la implementación MIDIÓ y esta spec (o su encargo) decía de otra forma (2026-07-28)

Todo lo de esta tabla está comprobado en el código y fijado por un test. Manda lo
medido (regla de oro 8).

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M1** | **El signo del offset.** El dossier §3.6 (línea 569) da `nrm = (u.y, −u.x)` a secas, y el encargo de la fase lo leyó como «en un anillo horario la derecha del recorrido apunta hacia fuera» | **Falso, y al revés en la mitad de los casos.** `(u.y, −u.x)` es la normal a la DERECHA del recorrido: apunta afuera en un anillo ANTIHORARIO y adentro en uno HORARIO. Este proyecto se encuentra los dos sentidos (el WFS emite el exterior horario, la plantilla oficial del Catastro lo trae antihorario, y el usuario dibuja como quiere), así que el signo **se mide**: `nrm_fuera = orientacion(anillo)·(u.y, −u.x)`, con `geo/area.js#orientacion`. Fijado por el test del anillo invertido: un cuadrado de 100 m² y su `reverse()` dan **los dos 110 m²** con `d = +1`, y lo mismo sobre los 15 lados de la parcela real. Es el override **O17** de `SPEC.md` §3 |
| **M2** | **El fallback del offset**, presentado como el caso raro del ángulo agudo («si `\|den\| < ε` → fallback») | **Es el caso NORMAL.** Medido sobre la parcela real **9398516VK3799G** (15 vértices, EPSG:25830) con `d = 0,10 m`: **1 de los 15 lados** resuelve en MITER puro (el lado 12), **7 caen a TRASLACIÓN** y **7 biselan**. Idéntico reparto con `d = −0,10 m`. Ver el apartado propio de abajo |
| **M3** | **«Deshacer/rehacer (usa `edit/historial.js` de F00)»**, dando por hecho que el historial de F00 servía tal cual | **Arrancaba inutilizable.** `crearHistorial()` nace con `pila:[]` e `indice:-1`, y `puedeDeshacer` exige `indice > 0`: sin **sembrarlo** con un `commit` del estado inicial, **la primera edición de cada sesión habría sido irreversible**, con el botón «Deshacer» apagado y sin nada que lo explicara. Y faltaba la operación «documento nuevo»: se añadió **`reiniciar()`** a `edit/historial.js`, que se llama al entrar una parcela del Catastro. Sin ella, un `Ctrl+Z` devolvería *la parcela anterior* — cambiando la referencia catastral en pantalla y con ella el GML que se generaría |
| **M4** | «desactivable con **tecla modificadora**», sin fijar cuál | **`Alt`.** `Ctrl` colisiona con el zoom por rueda y con el pan de Leaflet; `Shift`, con su `boxZoom`. `Alt` es la única de las tres que Leaflet no usa. Se lee por **dos** caminos —el `altKey` del evento real, que manda, y un seguimiento propio de `keydown`/`keyup` para los gestos simulados por API— con una guarda en el `blur` de la ventana: soltar `Alt` fuera de la pestaña no emite `keyup`, y sin esa guarda el snap se quedaría apagado **para siempre y en silencio** |
| **M5** | «Snap al parcelario oficial **y a las colindantes**», como si las colindantes estuvieran ahí | **F05 dejó `colindantes()` sin ningún llamante** (su propia cabecera lo decía). F06 lo cablea, y **bajo acción explícita**: botón «Traer colindantes», **una petición por pulsación**. No se piden solas al cargar la parcela porque sería una segunda petición que nadie ha pedido —lo que castiga la política de uso del servicio (override **O8**)— y porque el store no distingue «parcela recién traída» de «parcela editada»: un disparo automático desde el suscriptor acabaría consultando al Catastro **al mover un vértice** |
| **M6** | `app/main.js` anunciaba un **debounce** «cuando el arrastre de un vértice dispare un `set` por movimiento del ratón» | **No hizo falta, y ya no va a hacer falta con este diseño.** El arrastre **nunca** ha tocado el store por fotograma (se mueve el marcador, el punto del polígono y su fila en vivo, y se hace **un** `set` y **un** `commit` en el `dragend`), y F06 mantuvo la propiedad al añadir las vistas en vivo: superficie, perímetro, Δ y acotaciones se alimentan de **`alPrevisualizar`**, que no escribe en el estado. La nota se cierra. Lo que sigue vigente: si algún día alguien enchufa al store algo que escriba por fotograma (dibujo continuo, un lazo de selección), **el debounce va en `app/`, no en `validation/`** |
| **M7** | **`edit/dibujo.js` (base)** entre los ficheros de la fase | **No se ha hecho.** Ningún criterio de aceptación lo mide y hoy toda parcela entra por Catastro, DXF, TXT o LIST. **Decisión explícita: diferido entero a F12** — ver «Deuda declarada · 1» |

### M2 con detalle · **El fallback del offset es el caso normal** (el hallazgo de la fase)

Es lo más importante que ha aprendido F06, así que va con sus números. Sobre el
anillo exterior de la parcela real **9398516VK3799G** (fixture
`test/fixtures/geo/parcela-ring.json`, 15 vértices, horario, 1535,865 m²),
desplazando cada uno de sus 15 lados `d = 0,10 m`:

| Modo | Lados | Cuáles |
|---|---|---|
| `MITER` (nominal, sin fallback) | **1** | 12 |
| `TRASLACION` (no hay esquina: el lindero vecino es prolongación del desplazado) | **7** | 0, 1, 2, 5, 6, 7, 8 |
| `BEVEL` (la esquina es demasiado aguda: miter-limit) | **7** | 3, 4, 9, 10, 11, 13, 14 |

La causa de las siete traslaciones está en el dato, no en el algoritmo: **cinco de
los quince vértices son puntos de paso, no esquinas**. Sus senos, medidos:

| Vértice | `\|sin θ\|` | Ángulo | `1/\|sin θ\|` |
|---|---|---|---|
| v1 | 5,23·10⁻⁴ | 0,030° | 1.914 |
| v2 | 4,46·10⁻⁴ | 0,026° | 2.240 |
| v6 | 6,40·10⁻³ | 0,367° | 156 |
| v7 | 3,07·10⁻³ | 0,176° | 325 |
| v8 | 6,62·10⁻⁴ | 0,038° | 1.510 |

Los cinco caen por debajo de `senoMinimoOffset` (0,01), y como cada vértice sostiene
**dos** lados, esos cinco vértices contaminan **siete** lados. Un anillo del Catastro
no es un polígono de libro: trae vértices que no aportan forma —los mismos que
`validation/reglas-geometria.js` ya avisa como colineales— y sobre ellos **no hay
esquina que cortar**.

Consecuencias de diseño, y por eso el hallazgo importa:

1. **La calidad del fallback no es un detalle, es la experiencia normal del
   usuario.** De ahí que haya **dos** y que la elección esté razonada:
   *paralelismo → TRASLACIÓN* (no hay recta sobre la que deslizar el vértice, así
   que se traslada `d·nrm` como el propio lado) y *miter-limit → BISEL* (sí hay
   esquina; el bisel **conserva el lindero vecino entero** y añade un chaflán de
   longitud `|d|`, mientras que la traslación es la única de las tres que **gira**
   el lindero contiguo — y girar el límite con un colindante es exactamente lo que
   no se puede hacer a espaldas de nadie).
2. **`modo` es uno por operación** aunque cada extremo se resuelva por separado, y
   gana el más degradado: `TRASLACION > BEVEL > MITER`, de más a menos invasivo
   sobre lo que el usuario ya había dibujado. El desglose por extremo va en
   `detecciones`, una por extremo, con el índice del vértice dentro del texto.
3. **Ninguna caída es silenciosa** (regla de oro 1): cada una sale con un mensaje
   en español presentable tal cual, con las cifras dentro. «La esquina es demasiado
   aguda» no dice nada; «la esquina del vértice 7 mide 1,00° y el vértice se iría a
   28,66 m, 57 veces el desplazamiento pedido» sí.

**Y el ángulo agudo, con números.** Sobre el fixture `PICO_AGUDO`
(`[[0,0],[100,0],[2,1.71],[0,10]]`, esquina de **1,00°** en `v1`), con un offset de
**0,50 m**:

- con el miter-limit por defecto (4) → modo `BEVEL`, y **ningún vértice se aleja más
  de 0,50 m** del original;
- con `miterLimite: Infinity` → modo `MITER`, y ese mismo vértice se va a **28,66 m**,
  **57,3 veces** el desplazamiento pedido. Eso es `1/|sin 1°|`.

Los dos casos tienen test **gemelo**, a propósito: el primero afirma que la guarda
funciona y el segundo **explica por qué importaba**. Quien quite la guarda ve el
primero en rojo y el segundo le cuenta la razón. Un guardián que no se puede
desactivar tampoco se puede demostrar — por eso `miterLimite` admite `Infinity` y
está documentado.

## Desviaciones deliberadas del enunciado, con su motivo

- **`distancia > 0` es «hacia fuera del ANILLO», no «más superficie neta».** En un
  hueco las dos cosas se separan: el hueco se agranda y la superficie neta
  **disminuye**. Es lo que ve el usuario —el gesto es «aleja este lindero del
  recinto al que pertenece», y el recinto al que pertenece el lado de un hueco es
  el hueco—. La alternativa haría que el MISMO gesto sobre dos anillos dibujados
  igual moviera el lindero en direcciones opuestas según una etiqueta (`tipo:
  'HUECO'`) que no se ve en el mapa. `edit/offset.js` **no mira `tipo` en absoluto**.
- **`edit/snap.js` no sabe que existe un teclado.** La tecla modificadora es un
  evento del navegador y se resuelve donde viven los eventos (`viewer/edicion.js`),
  pasando `tolerancia: 0`. Apagar el snap **no** es un booleano paralelo que pueda
  contradecir a la tolerancia.
- **El snap prioriza VÉRTICE sobre LINDERO dentro de τ, aunque el lindero esté más
  cerca.** Quien acerca un vértice a otro casi siempre quiere que **coincidan**
  exactamente, no caer sobre el lado a tres centímetros de su extremo — y el pie de
  la perpendicular sobre un lado que sale del vértice está SIEMPRE más cerca que el
  vértice mismo, así que ordenar por distancia pura haría lo segundo casi siempre.
- **`excluir` quita el vértice arrastrado Y SUS DOS LADOS.** Sin lo primero el
  vértice se engancha a sí mismo (distancia 0, gana siempre) y queda clavado. Sin lo
  segundo se pega a la posición ANTERIOR de sus propios linderos. El caso que más
  fácil se rompe es `indice === 0`, cuyos dos lados son el de CIERRE (el último del
  array) y el PRIMERO.
- **`excluir` NO se aplica a `geometriaOficial`.** Aunque una parcela recién
  descargada tenga `recintos` y `geometriaOficial` con las mismas coordenadas, son
  dos geometrías distintas y el vértice oficial sigue siendo diana legítima:
  engancharse a él es, literalmente, «ajustar el vértice sobre la parcela oficial».
  Que un desplazamiento menor que τ vuelva al sitio no es un fallo del snap: es lo
  que el snap significa, y para eso está `Alt`.
- **El catálogo de dianas se construye una vez por gesto y se cachea**, con tres
  invalidaciones (estado, colindantes, vértice excluido) y **dos** mecanismos para
  la primera —identidad del POJO y suscriptor del store—, porque cada uno tapa el
  agujero del otro. Cambiar τ **no** invalida el catálogo: tirarlo por eso obligaría
  a reconstruirlo al soltar `Alt`, en mitad del arrastre.
- **`edit/metricas.js` no calcula nada por su cuenta**: la superficie sale de
  `geo/area.js#superficie` y los perímetros de `geo/metrica.js#perimetro`. Una
  segunda implementación del shoelace sería una segunda verdad, y la que se pinta
  en vivo no puede discrepar de la que se serializa en el GML.
- **`perimetro` devuelve tres números** (exterior, huecos, total) y no uno: la
  tolerancia oficial de identidad se refiere al EXTERIOR (`SPEC.md` §3), y elegir en
  silencio cuál es «el perímetro» sería acertar la mitad de las veces. Nótese que
  `total` **suma** los huecos mientras la superficie neta los **resta**: un patio
  quita superficie y **pone** lindero.
- **Ni una cifra de F06 lleva color de mérito** (regla de oro 9). El `Δ catastral`
  del pie va en el mismo gris que el resto de la ficha. Un Δ en verde cuando es
  pequeño y en rojo cuando es grande estaría dictaminando si la discrepancia es
  tolerable, que es justo la decisión que le toca al colegiado que firma.

## Deuda declarada

Lo que esta fase **no** ha hecho y sabe que no ha hecho. Va escrito porque una deuda
que no está escrita no es deuda: es una sorpresa.

### 1 · `edit/dibujo.js` — DIFERIDO a F12

La spec original lo listaba entre los ficheros de la fase y decía que «se estrena
aquí en su base y se completa en F12 para edificio». **No se ha escrito ni una
línea**, y la decisión es explícita:

- **ningún criterio de aceptación de F06 lo mide** — los cinco hablan de vértices
  que ya existen, de snap, de offset, de métricas y de undo/redo;
- **hoy toda parcela entra por otra vía**: Catastro (F05), DXF, TXT o LIST (F01).
  Dibujar un recinto desde cero no desbloquea ningún recorrido de parcela;
- su **caso de uso real es de edificio** (F12: «una parte recién añadida no tiene
  geometría → herramienta de dibujo vértice a vértice con el mismo snap»), y ahí es
  donde hay alguien que lo necesita.

Cuando se haga, el snap ya está listo para él: `edit/snap.js` es puro y no depende
de que el anillo esté cerrado ni de que exista una parcela.

### 2 · El presupuesto de altura del panel — ✅ **CERRADA el 2026-07-29**

> ⛔ Lo que sigue **es el diagnóstico original, tal cual se escribió el 2026-07-28**,
> cuando esta deuda decía «medido, NO arreglado». Se conserva porque explica por qué
> el problema existía y por qué el arreglo local se descartó. **La corrección va
> después, con sus números.**

#### El diagnóstico (2026-07-28)

El bloque «Edición» y las dos filas nuevas de la ficha consumen altura de un panel
que la reparte entre bloques de alto fijo. Medido en el navegador sobre el **build
de producción**, viewport **1440×900**, con la lista de avisos vacía:

| | |
|---|---|
| Alto del bloque «Edición» | **270,34 px** |
| Lo que ese bloque le quita a la tabla de vértices | **237 px** |
| Lo que le quitan las dos filas nuevas de ficha (`perimetro`, `delta-catastral`) | **33 px** |
| **Coste total de F06 en el presupuesto** | **270 px** |
| Alto de la caja de vértices **sin** F06 | 334 px |
| Alto de la caja de vértices **con** F06 | **64 px** |

Con 64 px, la caja muestra su **cabecera fija (24 px) y 1,6 renglones** de 24,69 px
— y el primero de esos renglones es el separador «EXTERIOR»: **se ve un vértice de
los 15, y a medias.** Bajando el viewport: a **860 px** de alto quedan 29 px de
tabla; a **820 px**, la tabla ya mide **0**; y por debajo de **~781 px** el botón
«Generar GML» empieza a recortarse por abajo. Todo eso con la **lista de avisos
vacía**: con avisos, esos umbrales suben (la lista tiene su propio tope de 34vh y
`flex: 0 1 auto`, el apaño que F05 introdujo al medir el mismo problema).

**No se ha «arreglado», y es una decisión.** El apaño de F05 —dejar que el bloque de
avisos ceda altura— ya está aplicado y no da más de sí; la solución de verdad es que
**la región de bloques del panel entera ceda o scrollee**, y eso es una decisión de
arquitectura del panel que afecta a F03, F05, F06 y a todo lo que venga después
(F07 mete su propio bloque de diagnóstico). Hacerla dentro de F06, en caliente y
solo para que quepa un bloque más, sería el arreglo local que garantiza el problema
en la fase siguiente.

Lo que sí se hizo con lo que se midió: el interruptor del snap y su tolerancia
comparten **fila**. Según la medición que quedó anotada en `index.html`, en dos filas
el bloque salía a **262 px** y dejaba la tabla en dos renglones.

#### Cómo se cerró (2026-07-29), y con qué números

El diagnóstico daba dos salidas y las dos eran malas: dejar la tabla en 1,6
renglones, o rehacer la arquitectura del panel en caliente y solo para que cupiera
un bloque más. **Había una tercera, y es la que se ha hecho: sacar las herramientas
del panel.** No son datos ni resultados —son acciones sobre el mapa—, así que el
sitio donde estorban menos es el mapa: una barra flotante, los números en
desplegables que se abren desde su herramienta, y los gestos en un panel de ayuda
detrás de un botón «?». Lo que consumía 270 px fijos pasa a ocupar **una fila de
36 px sobre la ortofoto**, y el resto se abre solo cuando se pide.

Medido en navegador con la lista de avisos vacía, viewport **1440×900**, y en
**dev y en el build** (los dos dan lo mismo, 302,73 px):

| Caja `#tabla-vertices` | Antes | Ahora |
|---|---|---|
| Alto | **64 px** | **303 px** |
| Renglones bajo la cabecera fija (24 px), de 24,69 px | **1,6** | **11,3** |
| Alto total de la tabla (`scrollHeight`) | 414 px | 414 px |
| Alto del bloque «Edición» | 270,34 px | **no existe** |

De ver **un vértice de los 15, y a medias**, a ver **unos once**. Con una tarjeta en
el panel de avisos —el estado en que `08-edicion.js` deja la pantalla tras el
offset— la caja baja a **237 px**, o sea **9,6 filas**; antes, en esas mismas
condiciones, eran **69 px y 2,8 filas**. La barra mide **285 × 36 px** y el panel de
ayuda abierto, **460 × 558 px**, que es el **27 %** del lienzo del mapa (1048 × 900):
tapa mientras está abierto y se cierra con `Escape`, con «Cerrar» o pinchando fuera.

**Lo que NO hubo que tocar, y era el objetivo de diseño:** `app/main.js#cablearEdicion`
resuelve sus siete nodos **por selector y en el instante de llamarla** —que ocurre
después de `crearVisor`—, así que los siete `data-*` del contrato son los mismos y el
traslado del panel al mapa es un cambio de **vista puro**. Ni el cableado, ni sus
pruebas, ni los selectores de `08-edicion.js` han cambiado.

**El guardián se partió en dos, y hubo que partirlo.** El contrato ya no tiene una
sola fuente: `test/services/contrato-catastro.test.js` (**G16**) exige que esos siete
selectores **NO** aparezcan en `index.html`, y `test/viewer/barra-edicion.dom.test.js`
exige que la barra produzca **exactamente uno de cada**. La partición se comprueba
exhaustiva y sin solapes, y se DERIVA de la tabla del segundo fichero en vez de
escribirse a mano en el primero: un selector nuevo cae por defecto del lado de la
cáscara, y pasarlo al lado de la barra **es** someterlo a la prueba de que la barra
lo fabrica. Si esa lectura se rompiera, el guardián se vuelve **más** estricto, no
menos.

Y no es un guardián hipotético: **el estado intermedio con los nodos duplicados
existió de verdad y lo cazó G16.** Mientras la barra ya estaba montada y el bloque
seguía en `index.html`, `querySelector` se quedaba con el del panel y **la barra
quedaba muerta** — con el mismo aspecto que la viva. Dos nodos es peor que cero.

#### La lección: el mismo texto significa cosas distintas en un panel y sobre un lienzo

`app/main.js` escribía en el arranque, en `[data-estado="edicion"]`, un párrafo que
explicaba por qué los tres botones nacen apagados. En el panel era **una nota de
11 px al pie de su bloque**: ambiental e inofensiva, y la regla de oro 1 cumplida.
Sobre el mapa, el mismo texto es **un cartel de tres líneas plantado sobre la
ortofoto** que no se va hasta la primera edición, y tapa justo la parcela que el
usuario ha venido a mirar (visto en navegador el 2026-07-29).

Ahora el renglón **arranca vacío** —`:empty{display:none}`, así que no ocupa nada— y
el motivo se reparte donde cada control lo puede contar:

- **«Desplazar lindero»** → el `[data-motivo="offset"]` de su propio desplegable, que
  el CSS enseña mientras el botón está apagado con
  `[data-accion="offset"]:disabled ~ .gml-barra-motivo`. Nadie observa ese
  `disabled`: lo dice el DOM, y el orden de hermanos es un invariante con test.
- **deshacer / rehacer** → la primera línea del panel de ayuda, y los mensajes «No
  hay ninguna edición que deshacer/rehacer» en cuanto alguien lo intenta por atajo,
  que es el momento en que la pregunta se hace de verdad.

**La regla de oro 1 se sigue cumpliendo; lo que cambió es dónde cae el texto.** Es un
ejemplo de manual: mover un control cambia lo que significa su texto, y eso no lo
avisa ningún test — solo se ve mirando la pantalla.

## Deuda de coherencia cerrada de paso

Tres duplicaciones que F06 encontró al necesitarlas y cerró, porque las tres eran
del tipo que ya se ha materializado en este proyecto (`viewer/_comun.js#validarVistaInicial`
llegó a aceptar con `typeof === 'number'` en un módulo y rechazar con `Number.isFinite`
en otro):

- **`config/operativos.js`** — el cargador de `config/operativos.json` vivía dentro
  de `validation/_comun.js`, porque F02 fue quien primero lo necesitó. Con la
  edición pidiendo `snapMetros`, la única forma de leerlo habría sido que `edit/`
  importara de `validation/`: una dependencia al revés y sin contrapartida. El
  cargador baja a un módulo neutro (su único import es el propio JSON) y
  `validation/_comun.js` lo **re-exporta**. Hoy es el **único lector del JSON en
  todo el proyecto**, comprobado.
- **`geo/metrica.js`** — `distancia` estaba definida **dos veces**: en
  `validation/_comun.js` y en `geo/cierre.js`. Ahora hay **una sola definición**;
  `geo/cierre.js` la importa y `validation/_comun.js` la re-exporta.
- **`edit/_comun.js`** — `describir` estaba duplicada en los **cuatro** módulos de
  `edit/` y `exigirRecintos`/`exigirRef` en **dos** (`vertices.js` y `offset.js`).
  Se duplicaron a propósito, porque las tareas corrían en paralelo sobre esos mismos
  ficheros, con la nota de deuda escrita en la cabecera de `edit/offset.js`.
  `describir` y `exigirRecintos` habían sobrevivido **byte a byte idénticas**;
  **`exigirRef` ya había divergido** en su redacción (una hablaba de «la referencia
  de lado» y nombraba el lado de cierre en su `RangeError`, la otra de «la
  referencia de vértice» y no lo mencionaba). La versión unificada usa una redacción
  neutra y **conserva la nota más informativa** para las dos procedencias.
  Regla del refactor: **un helper con un solo llamante no es reutilización, es
  indirección** — por eso `exigirDistancia`, `exigirOpciones` (solo `offset.js`) y
  `exigirPunto` (solo `vertices.js`) se quedaron donde estaban.

## Ficheros que la fase creó y tocó de verdad

La spec original nombraba tres. Son estos.

**Módulos nuevos de producción (11):**
`config/operativos.js` · `geo/segmento.js` · `geo/metrica.js` · `edit/_comun.js` ·
`edit/vertices.js` · `edit/snap.js` · `edit/offset.js` · `edit/metricas.js` ·
`viewer/acotaciones.js` · `viewer/edicion.js` · **`viewer/barra-edicion.js`** (la
barra flotante, 2026-07-29: cinco herramientas, dos desplegables, el panel de ayuda
y el renglón `role="status"`; es una VISTA y no conoce el modelo ni el store).

**Módulos tocados (12):** `edit/historial.js` (`reiniciar`) · `viewer/index.js`
(opción `edicion` —con `barra`, cierta por defecto—, pane `acotaciones` en zIndex
425, montaje y desmontaje en orden) ·
`viewer/sincronizacion.js` (los tres ganchos: `ajustar`, `alCrearMarcador`,
`alPrevisualizar`) · `viewer/_comun.js` · `app/main.js` (`cablearEdicion`, la ficha,
la siembra del historial) · `app/cableado-catastro.js` (`alCargarParcela` y
`alColindantes`, y el botón «Traer colindantes») · `validation/_comun.js` (pasa a
re-exportar) · `geo/cierre.js` · `config/operativos.json` (cuatro claves nuevas) ·
`index.html` (⚠️ el 2026-07-29 **PIERDE** el bloque «Edición» entero) ·
`estilos/app.css` · `index.js` (barrel: los módulos puros de `edit/`
y `geo/` entran; `viewer/edicion.js`, `viewer/acotaciones.js` y
`viewer/barra-edicion.js` **jamás**, importan Leaflet y el barrel lo carga la suite
`node`).

**Tests nuevos (13 ficheros):** `test/config/operativos.test.js` ·
`test/geo/segmento.test.js` · `test/geo/metrica.test.js` · `test/edit/comun.test.js` ·
`test/edit/vertices.test.js` · `test/edit/snap.test.js` · `test/edit/offset.test.js` ·
`test/edit/metricas.test.js` · `test/viewer/acotaciones.dom.test.js` ·
`test/viewer/edicion.dom.test.js` · `test/viewer/barra-edicion.dom.test.js` ·
`test/app/main-edicion.dom.test.js` ·
`test/edit/aceptacion-f06.dom.test.js` (los cinco criterios, uno a uno, sobre la
parcela real y accionando gestos, no funciones internas).
Suite completa el 2026-07-28: **2.846 pruebas en 68 ficheros** (F05 cerró en 2.270).
Con la barra, el 2026-07-29: **2.894 en 69** — +48 pruebas y +1 fichero, de las que
**41 son de `test/viewer/barra-edicion.dom.test.js`** y las 7 restantes, la mitad de
**G16** que vigila que esos siete selectores hayan salido de `index.html`.

### Coste en el paquete

Medido construyendo el commit de cierre de F05 y el árbol de F06 con el mismo Vite,
y atribuyendo bytes por sourcemap:

| | F05 | F06 | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 391,69 kB | **434,72 kB** | **+43,03 kB** |
| `dist/assets/index-*.css` | 34,93 kB | **36,40 kB** | +1,47 kB |
| `dist/index.html` | 15,05 kB | 26,17 kB | +11,12 kB |

**No entró ni una dependencia nueva en el grafo**: Leaflet, Turf, `polyclip-ts`,
`idb` y `rbush` pesan exactamente lo mismo que en F05. Los 43 kB son **código
propio**, y así se reparten:

| Módulo | Δ | |
|---|---|---|
| `viewer/edicion.js` | +11,35 kB | nuevo |
| `app/main.js` | +5,96 kB | `cablearEdicion`, ficha, siembra |
| `edit/offset.js` | +5,56 kB | nuevo |
| `viewer/acotaciones.js` | +4,83 kB | nuevo |
| `edit/snap.js` | +3,42 kB | nuevo |
| `viewer/sincronizacion.js` | +1,94 kB | los tres ganchos |
| `app/cableado-catastro.js` | +1,90 kB | `alCargarParcela`, `alColindantes` |
| `viewer/index.js` | +1,53 kB | opción `edicion` |
| `edit/_comun.js` | +1,40 kB | nuevo |
| `geo/segmento.js` | +1,30 kB | nuevo |
| `edit/vertices.js` | +1,20 kB | nuevo |
| `edit/metricas.js` | +0,87 kB | nuevo |
| `geo/metrica.js` | +0,69 kB | nuevo |
| `config/operativos.js` | +0,67 kB | nuevo |
| `edit/historial.js` | +0,43 kB | `reiniciar` |
| `validation/_comun.js` | **−0,43 kB** | adelgaza al re-exportar |
| resto | +0,19 kB | |

El grueso de lo que no comprime son los **textos en español presentables tal cual**
(`MENSAJE_OFFSET`, `MENSAJE_POR_MOTIVO`, las guardas de contrato con el argumento y
el valor recibido dentro): un minificador no toca una cadena. Es el precio de la
regla de oro 1, y está pagado a sabiendas. El `+11,12 kB` de `index.html` es casi
todo **comentarios**: Vite no los quita, y ahí están escritas las decisiones del
marcado.

#### Lo que costó la barra (2026-07-29)

Medido con `npm run build` sobre el mismo árbol, antes y después del traslado:

| | Panel | Barra | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 434,72 kB | **447,69 kB** | **+12,97 kB** |
| `dist/assets/index-*.css` | 36,40 kB | **42,22 kB** | **+5,82 kB** |
| `dist/index.html` | 26,17 kB | **19,91 kB** | **−6,26 kB** |

**Tampoco entró ninguna dependencia nueva**: los iconos son SVG en línea, y por el
mismo motivo que `viewer/sincronizacion.js` usa `L.divIcon` (hallazgo C8) — ni una
fuente de iconos ni un PNG, porque los assets con URL se rompen entre dev, build y
jsdom, y una descarga que puede fallar no es forma de dibujar una flecha.

Los 13 kB de JS son el módulo nuevo (fábricas de DOM, los SVG, la tabla de gestos y
media cabecera de razones); los 6 kB de CSS son la barra, sus desplegables y el panel
de ayuda. **Y `index.html` ADELGAZA 6,26 kB**, que es el bloque «Edición» con sus
comentarios yéndose del marcado. El saldo neto sobre lo que se descarga es de
**+12,5 kB**, y compra 239 px de tabla de vértices.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **El gesto con un ratón de verdad.** Los tests de `viewer/edicion.dom.test.js`
  disparan eventos sintéticos bajo jsdom, que no tiene layout: el doble clic, el
  menú contextual sobre un vértice y el arrastre con `Alt` pulsada están
  ejercitados, pero **que la mano acierte** —el radio de 12 px, si el indicador de
  enganche se ve, si la cota tapa al vértice— no lo firma una máquina.
- **La altura del panel.** Las cifras de arriba se midieron en un navegador real,
  en dev y con el build de producción; **no hay ningún test que las vigile**, así
  que un bloque nuevo puede volver a comerse la tabla sin que nada se ponga rojo.
  Lo que sí está vigilado desde el 2026-07-29 es que las herramientas **no
  vuelvan** al panel: G16 exige a CERO sus siete selectores en `index.html`. Es un
  guardián de la causa, no de los píxeles.
- **Que la barra no estorbe.** Flota sobre el mapa y el panel de ayuda tapa el 27 %
  del lienzo mientras está abierto. Que 285 × 36 px arriba a la izquierda sea un
  sitio donde no molesta, que el conmutador del ajuste **se lea encendido de un
  vistazo** y que los desplegables **se descubran** no lo mide jsdom ni lo mide
  `08-edicion.js`: es juicio.
- **El juicio visual** de las acotaciones sobre ortofoto (contraste de la píldora,
  solape entre cotas de lados cortos).

Los cuatro van al guion de humo y al **checklist humano**.

## Estado

**F06 NO está cerrada.** Código y pruebas están hechos y en verde (**2.894 en 69
ficheros**, 2026-07-29), `npm run build` construye limpio, y el guion
`scripts/smoke-navegador/08-edicion.js` se ha vuelto a ejecutar en navegador real
tras el traslado a la barra, con veredicto **`ok: true`** y `problemas: []` (consola
limpia, cero peticiones a los servicios de datos del Catastro).

De las dos deudas declaradas, la **2 está CERRADA**; la **1 (`edit/dibujo.js`) sigue
abierta y diferida a F12**, que es donde tiene un usuario que la necesite.

Lo que falta es la **firma humana** de `scripts/smoke-navegador/CHECKLIST-HUMANO.md`,
que ya bloquea formalmente F03 y F05 y bloquea también a F06 —la cadena es
**F03 → F05 → F06**—. Ese checklist trae la **sección 7** de esta fase (gestos de
ratón de verdad, `Alt`, el clic derecho, el juicio visual de las acotaciones sobre
ortofoto y, desde el 2026-07-29, el de la barra: si estorba sobre la parcela, si el
conmutador se lee, si los desplegables se descubren y si alguien abre la ayuda),
escrita y **SIN FIRMAR**; se firma junto con la 6. **Que la suite esté verde y el
build limpio no cierra la fase**: son necesarios, no suficientes (`SPEC.md` §6).

## Referencias

Plan §6, §18 Fase 6. Dossier §3.6 (snap, offset, proyección punto-segmento), §3.4 (Turf prohibido sobre UTM).
**Y por encima del dossier donde discrepen: el signo del offset medido sobre el anillo real** (`SPEC.md` §3, override **O17**) y `test/fixtures/geo/parcela-ring.json`, que es lo medido.
