# F07 · Diagnóstico de encaje (parcela)

**Fase:** 7 · **Prioridad:** P7 · **Riesgo:** Medio · **Depende de:** F05, F06 · **Habilita:** F08, F09.

**Ficheros (los REALES; la spec original nombraba uno — ver «Ficheros que la fase creó de verdad»):**
~~`diagnostico/parcela.js`.~~ **Once módulos nuevos de producción**:
`geo/poligono.js`, `geo/centroide.js`, `diagnostico/_comun.js`, `diagnostico/topologia.js`,
`diagnostico/desviacion.js`, `diagnostico/bandas.js`, `diagnostico/margen.js`,
`diagnostico/parcela.js`, `viewer/contraste.js`, `viewer/cajon-diagnostico.js` y
`app/cableado-diagnostico.js`; más `viewer/index.js`, `viewer/_comun.js`,
`validation/_comun.js`, `config/operativos.js`/`.json`, `index.html`, `estilos/app.css`
y `app/main.js` tocados. Es el mismo desvío que F06 («eran tres y son bastantes más»).

> ⛔ **Esta spec se REESCRIBIÓ el 2026-07-29**, al cerrar la fase, para que diga lo
> que hay y no lo que se pensaba hacer. Lo que decía antes **no se borra**: se
> conserva tachado o citado al lado de lo medido, igual que en `SPEC.md` §3.1, en
> `feature-05-catastro-vivo.md` y en `feature-06-edicion-parcela.md`. Manda lo
> medido (regla de oro 8).

## Objetivo

**El diferencial comercial.** Responder la pregunta previa a presentar un IVG —*¿mi medición cuadra con Catastro?*— que ninguna herramienta contesta. Compara `recintos` (editada) con `geometriaOficial` (intacta del WFS) más colindantes. **Mide y dibuja; no valora, no puntúa, no dictamina.**

F07 es además **el primer lector de `geometriaOficial` en todo el proyecto**: desde
F00 era un campo que se guardaba y no se leía (regla de oro 2). Hay test de que
sale de `diagnosticar()` con el mismo contenido con el que entró.

## Alcance

### Métricas (10.1)

| Métrica | Cálculo |
|---|---|
| Superficie medida | fórmula del polígono sobre UTM (`geo/area.js#superficie`) |
| Superficie catastral | `cp:areaValue` del GML oficial — **y además** la shoelace de NUESTRA fórmula sobre las coordenadas del propio WFS (`superficie.oficial`): 1535,87 ≠ 1536 en la parcela real, y **que no coincidan ES el dato** |
| Diferencia | absoluta (m²) y relativa (%), CON SIGNO — es el primer cruce de la tabla a tres bandas |
| Solape | `turf.intersect()` → geometría → **área con `geo/area.js`, jamás `turf.area`** (M3) |
| % de solape | sobre la mayor de las dos |
| Desplazamiento de centroides | distancia (euclídea propia) entre centroides **ponderados por área** (`geo/centroide.js`), no promedios de vértices |
| Desviación máxima de lindero | ~~máxima entre linderos homólogos~~ **POR LADO contra el contorno oficial ENTERO: máximo de mínimos con muestreo cada `pasoDesviacionMetros`** (M2) |
| Invasión a colindantes | área de intersección con cada vecina, en piezas, con astillas descartadas **por GROSOR** (M4) |

### Comparación a tres bandas (10.2)

El problema real son **tres** superficies: registral, catastral y medida. Campo de entrada manual para la **superficie registral** y tabla que las enfrenta con diferencias cruzadas. Es el cuadro que hoy se monta a mano en cada pericial.

Cómo quedó: los **tres pares salen SIEMPRE y en orden fijo** (medida↔catastral,
medida↔registral, catastral↔registral; el porqué del orden está en la cabecera de
`diagnostico/bandas.js`), `b` es el término de referencia (sustraendo y
denominador), `relativo` es FRACCIÓN (el ×100 es de presentación) y **`null` no es
0**: un par con un término ausente da `{absoluto: null, relativo: null}` y la vista
escribe «No consta» — misma doctrina, y misma razón, que `deltaCatastral: null` en
`edit/metricas.js`.

### Representación (10.5)

Los dos polígonos superpuestos, la diferencia sombreada, las invasiones destacadas. Desviaciones **acotadas sobre el propio dibujo**, con el lindero de máxima desviación **resaltado**; cada acotación con su línea guía.

Cómo quedó (`viewer/contraste.js`, pane `diagnostico` zIndex 428 — encima de la
geometría que explica, debajo de los vértices que se agarran):

- **La diferencia sombreada NO usa geometría booleana** (M5): un solo
  `L.polygon([anillos medidos, anillos oficiales])` y el `fillRule:'evenodd'` por
  defecto de Leaflet rellena exactamente la diferencia simétrica, huecos incluidos.
  Su área es `|A| + |B| − 2·|A∩B|`, exacta y sin `@turf/difference`.
- **La banda del margen NO es un buffer** (M6): es el trazo del contorno oficial
  con ancho en píxeles derivado de los metros a la escala actual, repintado en
  `zoomend`, **discontinuo a propósito** (una banda continua se lee como un carril,
  y un carril como «lo que cae aquí está bien»).
- **Todo `interactive: false`**: con el diagnóstico abierto F06 sigue vivo — se
  diagnostica, se corrige el lindero y se vuelve a diagnosticar.
- El ámbar de la invasión es **la única excepción de la regla de oro 9** en todo el
  proyecto (§10.4).

### Dónde vive (decidido en la entrevista de arranque, 2026-07-29)

**En un CAJÓN FLOTANTE sobre el mapa (`bottomleft`), no en el panel lateral.** La
razón es medida, no estética: el panel reparte alto FIJO entre bloques fijos, el
bloque «Edición» de F06 dejó la tabla de vértices en 64 px y costó una barra
flotante recuperar los **303 px**; `estilos/app.css` avisaba por escrito de que «el
siguiente bloque que entre —F07 trae uno de diagnóstico— se lo vuelve a comer». El
CTA «Diagnosticar encaje» va en el pie, **debajo** de «Generar GML» (no al lado:
son dos momentos distintos del recorrido, `index.html` lo razona), **nace
`disabled`** y se enciende ⟺ `geometriaOficial !== null`; cuando está apagado, su
renglón `role="status"` **escribe el motivo** (un botón gris y mudo es un error
silencioso). De paso el cajón gana lo que el panel no podía darle: **anchura**
para la tabla a tres bandas.

Lo que F07 le cuesta al panel, MEDIDO (guion 09, 2026-07-29): **los ~36 px del
CTA y su renglón** — la caja de vértices arranca en **267 px** donde F06 dejó 303,
unas **9,7 filas** de 15 con los avisos vacíos. Y **abrir el cajón no le quita
nada**: 172 → 172 px en el mismo tick del clic. El precio es la fila del botón,
no el diagnóstico.

## Cómo se presenta — CRÍTICO (regla de oro 9)

- **Ni semáforo, ni "apta para presentar", ni umbrales** (ni siquiera uno que elija el usuario). **Sin `config/umbrales.json`.**
- Razón de fondo: una discrepancia grande a menudo significa que la geometría **catastral** está mal —y ése es el motivo del expediente—. Un umbral presupone que Catastro es la referencia buena, falso justo en los casos de uso.
- Ninguna cifra lleva color de mérito: la diferencia de superficie va en **gris de texto**, no en verde. Titular descriptivo: *"Contraste con el parcelario — Medición de X m² frente a los Y m² del parcelario vigente…"*.

**Dónde pasa la frontera:** por el TIPO DE RETORNO. `diagnosticar()` no puede
devolver un booleano de mérito, así que ninguna vista puede pintar un semáforo a
partir de él. El guardián es mecánico y de tres frentes
(`test/diagnostico/aceptacion-f07.dom.test.js` AC4): el fichero prohibido no
existe, ningún módulo de `diagnostico/` exporta una clave de veredicto, y el DOM
del cajón pintado no contiene palabra, clase CSS ni color de mérito fuera de la
sección de invasión.

**Y los tres sabores de «no hay» se escriben distinto** (cabecera de
`diagnostico/parcela.js`): una sección a `null` deja su entrada en `omisiones` con
el motivo en español; `invasion.consultado: false` significa «nadie ha preguntado»
(**`vecinas: null` ≠ `vecinas: []`**, y el cajón escribe «no se ha consultado»,
JAMÁS «ninguna»); y un número a `null` dentro de una sección significa «no consta»
(la registral mientras nadie la teclee).

### La excepción: invasión a colindantes (10.4)

Única comprobación de otra naturaleza: **hecho topológico binario** (hay/no hay) con consecuencia fija (el expediente se rechaza salvo que se modifique la vecina). Presentar con superficie invadida y parcela afectada, resaltada. **Aquí sí cabe el ámbar.**

## 🔻 OVERRIDE (dossier)

- **Margen de identidad como capa informativa:** existe umbral oficial (**±0,5 m urbana / ±2 m rústica, ≤5%**, BOE-A-2020-12111) pero es criterio de **identidad**, no aprobado/suspenso. Se puede mostrar como **capa informativa etiquetada "margen de identidad del Catastro"**, nunca como veredicto ni parámetro configurable. *(dossier S6/C8).*

Cómo quedó: las cifras viven en **`diagnostico/margen.js` con la cita del BOE al
lado de cada una, NO en `config/operativos.json`** — ese fichero es de tolerancias
de INGENIERÍA y una norma publicada no se «ajusta» (M7). La clase urbana/rústica la
**elige el usuario** en un `<select>`; la app **propone** una deducida de la forma
de la referencia catastral (`claseDeducidaDe`, heurística declarada: la rústica
lleva polígono/parcela, la urbana lleva hoja de plano; **sin dígito de control**,
por lo mismo que `normalizarRefcat` no lo comprueba) y la propuesta va **rotulada
como deducida** («Clase propuesta por la aplicación: …»). La propuesta **no se
vuelca en el `<select>`**: el `<select>` significa «esto lo eligió una persona», y
volcarla la convertiría en elegida al primer repintado.

## Criterios de aceptación

Suite: `test/diagnostico/aceptacion-f07.dom.test.js`, un `describe` por criterio
con su texto literal, sobre la parcela real y su vecindad real del WFS.

1. Todas las métricas se calculan sobre fixtures conocidos con el valor esperado (distancias/áreas con helpers propios, `toBeCloseTo`). ✅
   *Con oráculos propios (shoelace y centroide reescritos en el test) y el caso
   completo MEDIDO: el vértice 0 de la parcela real movido 0,40 m al Este barre un
   triángulo de 3,124 m² e invade a TRES colindantes (0,23 / 0,25 / 2,64 m²).*
2. La tabla a tres bandas acepta la superficie registral manual y muestra las diferencias cruzadas. ✅
   *Por la pantalla: se teclea en el `<input>` del cajón real. Borrarla devuelve
   sus cruces a «No consta», **no a 0**.*
3. Invasión a colindante se detecta como binaria con área y parcela afectada. ✅
   *Y la distinción «no se ha consultado» / «ninguna» tiene test propio: son
   afirmaciones opuestas y la segunda tranquiliza.*
4. **Ninguna salida contiene veredicto, semáforo ni umbral configurable** (test de que no existe `config/umbrales.json` y de que el texto es descriptivo). ✅
   *El guardián de tres frentes descrito arriba, más el recorrido recursivo sobre
   el objeto real que devuelve `diagnosticar()` en `test/diagnostico/parcela.test.js`.*

## ⛔ Lo que la implementación MIDIÓ y esta spec (o su encargo) decía de otra forma (2026-07-29)

Todo lo de esta tabla está comprobado en el código y fijado por un test. Manda lo
medido (regla de oro 8).

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M1** | **Ficheros: `diagnostico/parcela.js`**, un fichero | **Once módulos nuevos de producción** (lista arriba). `diagnostico/` es una capa PURA y ciega —sin Leaflet, sin store, sin red— para que F08 («cargar un GML ajeno → diagnóstico») la reutilice sin tocar una línea; `topologia.js` es el ÚNICO fichero de F07 que importa Turf |
| **M2** | **«Desviación máxima de lindero: máxima entre linderos homólogos»** | **El emparejamiento homólogo 1↔1 deja de existir en cuanto F06 toca la geometría**: insertar un vértice parte un lindero en dos y borrar uno funde dos en uno. Se redefine como la **distancia de Hausdorff DIRIGIDA de medido → oficial, desglosada POR LADO**: cada lado medido se muestrea (extremos + un punto cada `pasoDesviacionMetros` = 0,3 m), de cada muestra se toma la distancia mínima al contorno oficial COMPLETO, y la desviación del lado es el máximo de esos mínimos. Da un **lado atribuible**, que es lo que §10.5 exige resaltar (Hausdorff global daba una cifra sin culpable). La cota del muestreo está escrita: subestima ≤ paso/2 = **0,15 m** en el peor caso. Y el coste está medido: dos descartes (caja envolvente dilatada + coherencia espacial) dejan el peor caso razonado de 25,4 millones de proyecciones en **52.352** (~67 ms), con resultado idéntico al ingenuo |
| **M3** | «Solape: `turf.intersect()` → área» | La forma de llamada es `intersect(featureCollection([polA, polB]))` (la de dos argumentos LANZA); **el área NUNCA la da Turf** (`turf.area` es geodésica sobre grados: sobre esta parcela metería ~1,1 m² de error — del tamaño exacto de las discrepancias que F07 existe para medir); `MultiPolygon` es el caso NORMAL y las piezas se suman; los huecos van como anillos interiores; y los recintos no aptos **salen en `saltados` con su motivo** — un desvío DELIBERADO del contrato del plan (`{area, piezas, nPiezas}`), porque devolver `area: 0` cuando lo cierto es «no se ha podido medir» sería el error silencioso que prohíbe la regla de oro 1 |
| **M4** | El plan fijó `areaInvasionMinimaM2` (10⁻⁴ m² = 1 cm²) para descartar astillas de ruido float | **Falso positivo MEDIDO**: sobre el fixture real, la parcela oficial SIN EDITAR «invadía» a 2 de sus 4 colindantes oficiales con astillas de 1,23 y 3,77 cm² — agujas de lindero compartido (1,7 m de base, 0,14 mm de altura) cuya área crece con la LONGITUD del lindero (`≈ ½·L·δ`), así que **ningún umbral de área vale para todos los linderos**. Sustituido por un filtro de **GROSOR**, que no depende de `L`. ⛔ **Su valor se equivocó dos veces**: primero 1 mm copiado de `duplicadoMetros` —una propiedad de NUESTRO modelo, cuando lo que hay que absorber es el redondeo al centímetro del WFS—, calibrado además contra ese único fixture. Remedido el 2026-08-10 sobre **554 parcelas oficiales de diez provincias**: 34 agujas de entre 1 y 5 mm salían como invasión. `grosorInvasionMinimoM` = **0,0071 m** = `½·10⁻²·√2`, el desplazamiento máximo de un vértice al redondearlo, que es el mismo número que F17 ya había derivado en `comprobacion/conjunto.js#GROSOR_REDONDEO_M`. Lo descartado **sale en `descartadas`** con área y grosor (regla de oro 1) |
| **M5** | La «diferencia sombreada» parecía exigir `@turf/difference` (no está en `package.json`) | **No hace falta y NO entró ninguna dependencia nueva**: el `fillRule` por defecto de Leaflet es `'evenodd'` (verificado en `node_modules/leaflet/dist/leaflet-src.js:8159`; lo honran el renderizador SVG en :13347 y el Canvas en :12900), así que un solo `L.polygon` con los anillos de las DOS geometrías rellena exactamente su diferencia simétrica — y funciona con huecos, porque la paridad implementa «dentro del exterior Y NO dentro del hueco» por sí sola. El área sale de `|A| + |B| − 2·|A∩B|`, exacta y sin booleanas. *Fallback documentado si algún día la paridad fallara: `@turf/difference` (MIT, topológico, regla 6 lo permite) + nota en créditos* |
| **M6** | La banda del margen se leía como un buffer geométrico | **`turf.buffer` está PROHIBIDA (regla 6) y no hace falta**: la banda es el TRAZO del contorno oficial con ancho en píxeles = metros × escala actual, repintado en `zoomend` y con tope de 40 px. La escala se mide proyectando dos puntos UTM separados un metro con la maquinaria propia (`vertUTMaLatLng` + `latLngToLayerPoint`), **no** con `mapa.distance()` (geodésica). Y el trazo es **discontinuo a propósito**: una banda continua se lee como un carril, y un carril como «lo que cae aquí está bien» |
| **M7** | El margen oficial, como cifra de configuración | **Va en `diagnostico/margen.js` con la cita BOE-A-2020-12111 al lado de cada constante, NO en `config/operativos.json`**: ese fichero es de tolerancias de ingeniería, y presentar una norma publicada como ajustable es la mitad del camino hacia el `config/umbrales.json` prohibido. El `_nota` del JSON lo dice desde esta fase |
| **M8** | El plan fijó el renglón del cajón como `[data-estado="diagnostico"]` | **Colisión real detectada**: el pie tiene su PROPIO renglón para el CTA y la convención de la app es que lleve la cadena de su acción (`data-estado="diagnosticar"`). Dos valores que se diferencian en dos letras y un `querySelector` que se queda con el PRIMERO del documento (el `<aside>` va antes que el `<main>`) habrían dejado el renglón del cajón mudo y sin síntoma. El del cajón se llama **`data-estado="cajon-diagnostico"`**, por el componente — la misma trampa que `index.html` ya documentaba con la barra de edición |
| **M9** | El contrato del plan: `diagnosticar()` → 10 secciones, con `oficialShoelace` | **Once secciones** (entra `saltados`, ver M3), la shoelace del oficial se llama **`superficie.oficial`**, y la entrada acepta **`refcat`** (para proponer la clase de suelo). Las invasiones llevan `grosor` y `nPiezas` además de `refcat` y `area` |
| **M10** | «una petición al abrir el cajón si faltan» (colindantes) | Así es, y además: si las vecinas ya llegaron por `alColindantes` (el botón de F05 o el snap de F06) **se adoptan sin pedirlas otra vez**; si la consulta FALLA, las métricas sin red se pintan igual con `invasion.consultado: false` y el motivo en el renglón; y **una parcela DISTINTA cierra el cajón**, reinicia el expediente y tira las vecinas — dejarlo abierto obligaría a una petición que nadie ha pedido (override O8). La clave de «distinta» es la refcat, no la identidad del POJO: `edit/` reconstruye el objeto en cada operación |

## Desviaciones deliberadas del enunciado, con su motivo

- **El recálculo va por `estado.subscribe` (una vez por operación acabada), NUNCA
  por `alPrevisualizar`.** Detrás de `diagnosticar()` hay intersecciones
  topológicas contra el oficial y contra cada vecina más ~50.000 proyecciones de
  muestreo (~67 ms medidos): colgarlo del frame de un arrastre convertiría el gesto
  en diapositivas, y para nada — el diagnóstico se lee al soltar, no mientras se
  mueve. La ficha del pie sigue con `edit/metricas.js` por el canal en vivo; son
  dos consumidores del mismo modelo y ninguno recalcula lo del otro. **Que las dos
  cifras de superficie coincidan al último bit es invariante con test.**
- **Con el cajón CERRADO no se calcula nada.** Medir para no enseñarlo no es gratis.
- **La superficie registral NO entra en el modelo.** Es dato del EXPEDIENTE (de una
  escritura), no de la geometría: vive en el cableado, **sobrevive a las
  ediciones** (mover un vértice no cambia lo que dice el Registro) y **se reinicia
  con cada parcela distinta**. Persistirla es de F10.
- **`diagnostico/` no filtra la propia parcela de las vecinas.** Ya lo hace
  `services/catastro.js#parcelaYColindantes` (override O15: `GetNeighbourParcel`
  devuelve la propia en 2.ª posición); repetir el filtro sería una segunda verdad
  sobre el servicio. El módulo puro tiene un test que DOCUMENTA el síntoma del
  olvido (una «invasión» del 100 % con la propia refcat al lado) para que el rojo
  caiga en el cableado.
- **`diagnosticar()` no redondea, no ordena las invasiones por área y no cachea.**
  Redondear es de salida (regla 11), ordenar es de quien presenta, y un caché sería
  estado — el estado es de quien llama.
- **`geo/poligono.js#recintosDeGeometriaTurf` devuelve una LISTA de `recintos`** y
  no un `recintos`: la intersección puede salir en varias piezas disjuntas y el
  invariante del modelo admite un solo exterior; elegir una pieza en silencio sería
  presentar 12 m² como 7 m². `anilloCerrado`/`coordsPoligono` **bajaron** de
  `validation/_comun.js` a `geo/` (que las re-exporta) — el mismo movimiento, con
  el mismo motivo, que F06 hizo con `distancia`.
- **El centroide degenerado devuelve `null`, no el promedio de vértices**: el
  promedio es otra cifra y se parece lo bastante como para que nadie la revise.
- **La orientación de los anillos no se toca ni al ir ni al volver de Turf**
  (lección del O17: el sentido se mide, no se supone). MEDIDO: el motor de las
  booleanas de Turf 7.3.5 trata los anillos 2.º+ como huecos sea cual sea su giro.

## Deuda declarada

- **La CUARTA copia de `describir`** (`diagnostico/_comun.js`, tras `validation/`,
  `edit/` y `viewer/`) **y además una TERCERA copia dentro de `viewer/`**
  (`viewer/contraste.js`, junto a las de `acotaciones.js` y `edicion.js` — en esa
  capa no hay `_comun.js` que la tenga). Es lo que el repo ya decidió
  (`edit/_comun.js:42-46`: «unificar ENTRE capas no es el alcance»); subir las tres
  de `viewer/` a su `_comun` es una tarea propia, no un efecto colateral de F07.
  Se declara, no se disimula.
- **La deuda del presupuesto de altura del panel sigue siendo estructural.** F07
  pagó los ~36 px de su CTA (303 → 267 px, medido y deliberado) y el cajón no roba
  nada al abrirse (172 → 172 px, guion 09) — pero la región de bloques sigue
  repartiendo alto fijo y el siguiente elemento que entre en el panel volverá a
  pagar de la tabla de vértices.

## Ficheros que la fase creó y tocó de verdad

La spec original nombraba uno. Son estos.

**Módulos nuevos de producción (11):**
`geo/poligono.js` · `geo/centroide.js` · `diagnostico/_comun.js` ·
`diagnostico/topologia.js` · `diagnostico/desviacion.js` · `diagnostico/bandas.js` ·
`diagnostico/margen.js` · `diagnostico/parcela.js` · `viewer/contraste.js` ·
`viewer/cajon-diagnostico.js` · `app/cableado-diagnostico.js`.

**Módulos tocados (8):** `viewer/index.js` (opción `diagnostico` —booleano u objeto
`{posicion, minimoPx}`, `false` por defecto: visor idéntico al de F06—, montaje
después de las capas y desmontaje atómico) · `viewer/_comun.js` (`PANE.DIAGNOSTICO`
zIndex **428**: encima de `parcelaEditada` 420 y `acotaciones` 425 —todo lo que F07
dibuja es una anotación que explica esas dos geometrías—, debajo de `vertices` 430
—el vértice es lo que se agarra y F06 sigue activo—) · `validation/_comun.js` (pasa
a re-exportar `anilloCerrado`/`coordsPoligono`) · `config/operativos.json`/`.js`
(tres claves nuevas: `pasoDesviacionMetros` 0,3 m · `grosorInvasionMinimoM` 0,0071 m
· `cotaDiagnosticoMinimaPx` 12 px, argumentadas como tolerancias de INGENIERÍA en
el JSDoc) · `index.html` (CTA «Diagnosticar encaje» + renglón
`data-estado="diagnosticar"` en el pie; **ningún bloque nuevo en el panel**) ·
`estilos/app.css` (el cromo del cajón y de la capa; muere la nota que anunciaba el
bloque de F07) · `app/main.js` (paso 8 del ensamblaje: `cablearDiagnostico` después
del visor y del Catastro; muere el comentario «POR QUÉ NO HAY BOTÓN DIAGNOSTICAR»,
que era una promesa con fecha).

**Tests nuevos (11 ficheros):** `test/geo/poligono.test.js` ·
`test/geo/centroide.test.js` · `test/diagnostico/topologia.test.js` ·
`test/diagnostico/desviacion.test.js` · `test/diagnostico/bandas.test.js` ·
`test/diagnostico/margen.test.js` · `test/diagnostico/parcela.test.js` ·
`test/viewer/contraste.dom.test.js` · `test/viewer/cajon-diagnostico.dom.test.js` ·
`test/app/diagnostico.dom.test.js` ·
`test/diagnostico/aceptacion-f07.dom.test.js` (los cuatro criterios, uno a uno,
sobre la parcela real, la mitad integrada por la pantalla, y el guardián de la
regla 9 en tres frentes).

Suite completa al cierre (2026-07-29): **3.312 pruebas en 80 ficheros** — F06 dejó
2.894 en 69, así que F07 añade **+418 pruebas y +11 ficheros**, uno por módulo
nuevo de producción.

### Coste en el paquete

Medido con `npm run build` el 2026-07-29:

| | F06 | F07 | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 447,69 kB | **481,93 kB** | **+34,24 kB** |
| `dist/assets/index-*.css` | 42,22 kB | **43,64 kB** | +1,42 kB |
| `dist/index.html` | 19,91 kB | **22,90 kB** | +2,99 kB |

**Ni una dependencia nueva en el grafo** — la diferencia sombreada la hace el
`fillRule` de Leaflet (M5) y la banda no es un buffer (M6)—: los 34 kB son código
propio, los once módulos de la fase con sus cabeceras de razones y sus textos en
español presentables tal cual (el precio de la regla de oro 1, pagado a sabiendas,
igual que en F06). El CSS es el cromo del cajón y de la capa; el html, el CTA del
pie con sus comentarios de contrato.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que la diferencia simétrica SE VEA.** El truco del `evenodd` está verificado en
  el fuente de Leaflet y comprobado en jsdom a nivel de opciones, pero que la
  paridad rellene lo que tiene que rellenar solo lo confirman píxeles de verdad.
- **El ancho de la banda del margen en METROS al cambiar el zoom** (sin proyección
  real no hay escala real) y **el presupuesto de altura**: que abrir el cajón no
  le quite altura a la tabla de vértices.
- **Cuánto tarda el recálculo completo** sobre la parcela real con sus vecinas.
- **Si alguna cifra o color SE LEE como un veredicto** aunque el texto no lo diga.
  Eso no lo firma ninguna máquina.

Los tres primeros van al guion `scripts/smoke-navegador/09-diagnostico.js`; el
último es el punto **BLOQUEANTE** de la sección 8 del
`scripts/smoke-navegador/CHECKLIST-HUMANO.md`.

## Estado

**F07 NO está cerrada.** Código y pruebas están hechos y en verde (**3.312 en 80
ficheros**, 2026-07-29), `npm run build` construye limpio, y el guion
`scripts/smoke-navegador/09-diagnostico.js` se ha ejecutado en navegador real con
veredicto **`ok: true`** y `problemas: []` (consola limpia, 2 peticiones de datos
en total —GetParcel + GetNeighbourParcel— y el resto servido por la caché de
IndexedDB; captura en `.gstack/smoke-f07.png`).

Lo que falta es la **firma humana** del `CHECKLIST-HUMANO.md`, cuya sección 8
trae esta fase con su punto BLOQUEANTE (si alguna cifra o color se lee como un
veredicto): la cadena de firmas es **F03 → F05 → F06 → F07** y se firma toda
junta. **Que la suite esté verde y el build limpio no cierra la fase**: son
necesarios, no suficientes (`SPEC.md` §6).

## Referencias

Plan §10, §18 Fase 7, §23.6. Dossier §5.3 (tolerancia/tres bandas), §0.3 (medir no dictaminar), §3.4 (Turf).
Plan de ejecución de la fase: `~/.claude/plans/vamos-con-f07-diagnostico-measured-lantern.md`
(los contratos congelados de allí se corrigen aquí donde la implementación midió
otra cosa: M3, M4, M8, M9).
