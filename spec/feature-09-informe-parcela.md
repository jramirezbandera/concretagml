# F09 · Informe (parcela)

**Fase:** 9 · **Prioridad:** P9 · **Riesgo:** ~~Alto (plano a 300 ppp)~~ **el riesgo
estrella murió el primer día, medido** (ver M3) · **Depende de:** F07 · **Habilita:**
F14 (informe de edificio), F16 (créditos y peso del paquete).

**Ficheros (los REALES; la spec original nombraba tres):**
~~`report/canvas.js`, `report/literal.js`, `report/pdf-parcela.js`.~~
**Trece módulos nuevos de producción**, en `report/` (siete), `app/` (dos), `geo/`
(dos), `services/` (uno) y `storage/` (uno); más **once tocados** y `.gitattributes`.
**`index.html` no se tocó ni una línea** —el `<dialog>` lo fabrica su propio módulo—,
y `report/contraste-texto.js`, el módulo de F08, sigue vivo y sigue bajando.

> ⛔ **Esta spec se REESCRIBIÓ el 2026-08-02**, al cerrar la fase, para que diga lo
> que hay y no lo que se pensaba hacer. Lo que decía antes **no se borra**: se
> conserva tachado o citado al lado de lo medido, igual que en `SPEC.md` §3.1 y en
> las fichas de F05, F06, F07 y F08. Manda lo medido (regla de oro 8).

## Objetivo

La **memoria de encaje firmable**: plano compuesto a mano a 300 ppp sobre la
cartografía del Catastro, tabla a tres bandas, **descripción literaria del lindero**
y **pie de firma colegiada**. Dos de los cuatro diferenciadores del producto viven
aquí (linderos + memoria firmable).

Y una segunda cosa que la spec original no decía y que la fase ha resultado ser:
**es el primer documento de esta aplicación que se firma**, y por tanto el primero
en el que la regla de oro 9 se examina en un soporte que puede pintar en color, en el
que la letra pequeña sobrevive a la fotocopia y en el que un nombre casi homónimo del
documento oficial del Catastro se lee por encima en la portada. Todo lo que este
documento afirma —y todo lo que se calla— está decidido con eso delante.

## Nombre (legal — §11.1)

**No** «Informe de validación gráfica» (VGA/IVG son procedimiento y documento
oficiales del Catastro, con CSV; un nombre casi homónimo hace creer al cliente que ya
se presentó). Nombre correcto: **«Informe de contraste con el parcelario catastral»**
(`report/pdf-parcela.js#NOMBRE_INFORME`), el mismo que ya usaba el informe de texto de
F08.

⚠️ **Divergencia deliberada con el informe de texto, y está razonada en el código.**
El `.txt` de F08 **nombra** los documentos oficiales por sus siglas para poder negar
ser ellos. El PDF **no los nombra**: es un papel con pie de firma, pensado para
presentarse, fotocopiarse y archivarse, y cualquiera de esas siglas impresa en él
—aunque sea dentro de una negación— acaba siendo la sigla que alguien lee por encima.
La advertencia se da entera (`AVISO_NO_OFICIAL`) diciendo lo que el documento **no es**
y quién sí emite los oficiales, sin escribir sus nombres. Hay un test que afirma que
no aparecen.

## Contenido (§11.2)

1. Encabezado: municipio, clase de finca, domicilio o paraje/polígono/parcela,
   referencia catastral, SRS, fecha e **identificador único de documento**. ✅
   ⚠️ El número de líneas **no es fijo**: 8 en urbana y 11 en rústica, porque paraje,
   polígono y parcela son el sistema de identificación de la rústica e imprimir
   «Polígono: No se ha consultado» en un piso es afirmar algo falso.
2. **Plano de situación** a escala declarada, con norte, escala gráfica y cartografía
   de fondo. ✅ Una sola `GetMap` (M3).
3. Relación de vértices con coordenadas, superficie y perímetro. ✅
4. Diagnóstico de encaje y comparación a tres bandas: las cifras, **sin valoración**. ✅
5. **Descripción literaria del lindero** (`report/literal.js`). ✅ **Editable** en el
   diálogo antes de exportar, que es lo que la spec exigía.
6. **Pie de firma:** nombre, número de colegiado, colegio y contacto. Neutral y
   configurable, **sin presuponer titulación**. ✅ Y recordado entre sesiones
   (`storage/pie-firma.js`), con las tres vías de borrado funcionando.

Numeración de páginas. ✅ «Página N de M» se compone en una sola pasada:
`report/pdf.js#irAPagina` existe justo para volver a estampar los pies cuando ya se
sabe cuántas son. El documento **no se compone dos veces** — dos pasadas pueden
divergir y dejar el pie diciendo una cosa y el cuerpo otra.

## Las cuatro decisiones de la entrevista de arranque

| # | Decisión | Por qué, y qué costó |
|---|---|---|
| **D1** | **Escritor de PDF PROPIO** (`report/pdf.js`), no jsPDF | Mismo precedente que `geo/utm.js` frente a proj4 (regla de oro 7), tomado otra vez y por el mismo motivo. **Medido: `report/pdf.js` aporta 13,49 kB al paquete**; jsPDF **no es dependencia de este repo** y su coste no se ha medido aquí — la cabecera del módulo cita ~350 kB, que es la cifra del plan, no una medición propia. Lo que sí es consecuencia comprobada: al ser puro entra en el proyecto Vitest `node` y **su salida se fija con un snapshot de BYTES**, cosa que con jsPDF no se podría. El módulo declara además su techo: «el día que alguien se vea añadiendo fuentes incrustadas, compresión o formularios, lo correcto es PARAR y volver a discutir jsPDF» |
| **D2** | **`Consulta_DNPRC` solo para la parcela PROPIA** | Los datos descriptivos del encabezado (municipio, paraje, polígono/parcela) no están en el WFS. Pedirlos también para los cuatro colindantes serían **cinco peticiones por informe**, y el override **O8** (denegación ~10 días por abuso) no lo justifica. Los colindantes se nombran por **referencia catastral y `cp:label`**, que ya vienen con la geometría. **Presupuesto de red de F09: +1 petición**, y pasa por la caché antes de tocar la red |
| **D3** | **Diálogo `<dialog>`**, rompiendo a propósito la norma «nada de modales» de F08 | El caso es otro: los cajones de F07 y F08 **anotan el mapa** y viven sobre él porque hablan de él; esto **prepara un documento**, y el mapa no aporta nada mientras se teclea un número de colegiado. Las cuatro esquinas de Leaflet están ocupadas desde F08 y los dos cajones ya suman 946 px sobre 900 de lienzo. Se paga lo que cuesta un modal: foco al abrir, `Escape` que cierra, foco devuelto, y **cerrar no borra nada** |
| **D4** | **El informe de TEXTO de F08 convive con el PDF** | Se compone **sin red** —no pide una sola tesela— y baja igual el día que el plano no se pueda armar. Los dos botones viven en la misma fila del pie del cajón de diagnóstico, el PDF primero: el orden es lo único que dice cuál de los dos es el entregable. **Degradar no es quitar** |

## Las tres decisiones del colegiado sobre el lindero

Son las tres del texto que alguien firma, y las tres se tomaron con el documento
delante, no con el módulo:

1. **«Presumiblemente con vía pública» solo en URBANA**, y triplemente marcada como
   no verificada. Es el único sitio de toda la aplicación donde la app **propone** en
   vez de medir, y por eso tiene tres candados: (a) la clase entra **por parámetro**,
   no se deduce, y con `null` o `'RUSTICA'` el texto es el de siempre —en rústica un
   lindero sin parcela catastral puede ser un camino, un cauce, un monte público o una
   finca no catastrada, y sugerir «vía pública» ahí sería temerario—; (b) solo si de
   verdad se ha mirado (colindantes consultadas **y** con al menos una parcela); (c)
   la advertencia se dice **tres veces en la misma frase que el lector copia**
   —«presumiblemente», «dato NO verificado», «confirme antes de firmar»— **y viaja en
   el DATO** (`tramos[].presuncionNoVerificada`), no solo en la prosa. Lo segundo es lo
   que importa: una advertencia que solo existiera en una cadena de texto se pierde en
   el primer `replace` de quien maquete, y este documento existe para que el texto se
   pueda reescribir.
2. **El preámbulo metodológico baja AL PIE**, como nota técnica. La descripción
   empieza en «Linda al Este…», que es como se lee un lindero en una escritura y como
   se copia y pega en una instancia. Lo metodológico —sentido del recorrido, vértice
   de arranque, norte de cuadrícula, reparto en tramos, qué significa que un tramo no
   lleve referencia catastral— **no se pierde ni una palabra**: se agrupa al final para
   que el PDF lo pueda poner en cuerpo menor sin trocear nada. Un preámbulo delante
   obliga a saltárselo en cada lectura y, sobre todo, **se cuela en el portapapeles de
   quien solo quería los linderos**.
3. **Grafía «Sudeste» / «Sudoeste»**, no «Sureste» / «Suroeste». La RAE admite las
   dos; lo que no admite un documento es alternarlas. Se fijan las formas con -d-
   porque son las etimológicas y las tradicionales en la prosa registral y notarial,
   que es donde va a parar este texto. En el norte la simetría no existe —«nordoeste»
   no es palabra—, así que ese par se queda en «Noreste» / «Noroeste». Cambiar de
   criterio es tocar una tabla de `geo/rumbo.js` y nada más: los **códigos** (`SE`,
   `SO`) son los mismos con una grafía y con la otra, así que la geometría no se entera.

## Composición del plano — NO html2canvas (§11.3, regla de oro 7)

Sobre el div de Leaflet, html2canvas produce el polígono flotando sobre un rectángulo
gris (una sola imagen sin CORS contamina **todo** el lienzo). Es el fallo visible del
competidor y el motivo de que `report/canvas.js` exista. **El canvas se compone a
mano.**

La Receta A se implementa tal cual, con dos añadidos que la spec no preveía y que son
consecuencia directa de lo medido (M3 y M5):

- **Después del `load` se comparan `naturalWidth`/`naturalHeight` con lo pedido, y si
  no cuadran no se dibuja.** El `load` no es la comprobación: una imagen sustituida
  carga, se decodifica y se dibuja tan campante.
- **`ctx.drawImage` se llama siempre con TRES argumentos**, nunca con los cinco que
  aceptan ancho y alto de destino: la forma de cinco escala la imagen hasta encajar, o
  sea que taparía exactamente el fallo que la comparación acaba de destapar.

Y una tercera red al otro extremo: `report/pdf.js#imagenJpeg` contrasta el
`anchoPx`/`altoPx` declarado contra el **`SOF` real del JPEG**. No es redundancia —son
tres sitios distintos por donde entra el mismo error: el servicio, el llamante y el
papel.

**El color no se hereda del visor, y está mirado.** `COLOR_USUARIO` es `#FFD600` y su
propio JSDoc dice que ese valor es para el mapa sobre ortofoto (~1,4:1 sobre fondo
claro). El plano del informe va sobre la cartografía catastral, que es casi blanca, y
además se imprime. El **trazo, los vértices y los rótulos** van en `#A16207` —el ámbar
oscuro que `estilos/app.css` ya tenía declarado como `--gml-color-usuario-sobre-claro`,
~5,0:1—; **el relleno conserva el `#FFD600`** al 18 % de alfa, que ata visualmente el
plano con lo que se ve en pantalla sin competir con las líneas rojas del parcelario.
El resto del cromo es neutro: la geometría oficial en gris. **Ni un color de mérito**
(regla de oro 9): en este plano no hay nada verde que diga «bien» ni nada rojo que
diga «mal».

## ⛔ Lo que la implementación MIDIÓ y esta spec (o el plan de la fase) decía de otra forma (2026-08-02)

Todo lo de esta tabla está comprobado en el código y fijado por un test, salvo donde
se diga que la medición es de servicio real o de navegador. Manda lo medido (regla de
oro 8).

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M1** | **Ficheros: `report/canvas.js`, `report/literal.js`, `report/pdf-parcela.js`** | **Trece módulos nuevos de producción y once tocados**, repartidos en cinco capas. `report/` pasa de un fichero a ocho y **estrena barrel propio** (`report/index.js`), porque hasta F08 el barrel raíz decía `export * as report from './report/contraste-texto.js'`: el espacio de nombres `report` **era un fichero**. Y hay dos módulos de `geo/` que la spec no nombraba y sin los cuales no hay ni plano ni lindero: `geo/bbox.js` (la caja envolvente, que leen el `BBOX=`, el mapeo UTM→px y la escala rotulada) y `geo/rumbo.js` (el «al Norte» de la descripción, que **no existía en el proyecto**: lo más parecido era `validation/_comun.js#anguloVertice`, que mide otra cosa). **`index.html` no se tocó** |
| **M2** | **jsPDF** (sección propia en la spec, y en `SPEC.md` §4 y §5) | **No se usa, no es dependencia y sale de la spec.** El escritor es propio (`report/pdf.js`, **13,49 kB medidos por *sourcemap***) y sabe hacer cuatro cosas: texto en Helvetica, líneas y rectángulos, JPEG pegado sin recodificar, y medir texto para partirlo. `package.json` **no cambió en toda la fase**: cero dependencias nuevas. Corregido también en `SPEC.md` §4 y §5, y anotado en el **override O9**, que nombraba a jsPDF por su licencia |
| **M3** | **«Caveat MaxWidth/MaxHeight: los WMS imponen tope de píxeles (GeoServer 2048/4096 por defecto)… comprobar el tope real y, si hace falta, dividir en 2–4 `GetMap` contiguas»** | ⛔ **El techo es 4000 px POR DIMENSIÓN y no RECORTA: SUSTITUYE.** Medido contra el servicio real el 2026-08-02 (T0.1): `2126×1535` (los 180×130 mm a 300 ppp) → **HTTP 200, `image/jpeg`, `Access-Control-Allow-Origin: *`, 272.184 B y el tamaño EXACTO pedido**; `4000×100` también exacto; **`4200×100` y `5000×100` devolvieron las dos veces `4000×2000`** —ignorando *ambas* dimensiones y plantando un tamaño suyo—, con HTTP 200 y sin una palabra. Dos consecuencias: (a) **la Receta A sale con UNA SOLA `GetMap`** y el troceado de `report/encuadre.js` existe para las geometrías que no caben, no para el caso normal; (b) es el **peor modo de fallo que puede tener un plano** —la imagen llega, carga, se dibuja, y la geometría queda descolocada con la escala correctamente rotulada al pie—, así que la comparación `naturalWidth`/`naturalHeight` es el requisito número uno de `report/canvas.js` y no una cortesía. El JPEG es de **3 componentes (YCbCr)**, así que entra en el PDF como `/DeviceRGB` + `/DCTDecode`, sin recodificar una muestra |
| **M4** | `CRS=EPSG:25830` en la `GetMap` | Eso es **WMS 1.3.0**. `viewer/wms-catastro.js#getMapUrl` emite **1.1.1 con `SRS=`**, y no es una preferencia: el servidor declara `<WMT_MS_Capabilities version="1.1.1">`, con `CRS=` responde `SRS () Invalido`, y con `VERSION=1.3.0&SRS=…` **sirve igual**, o sea que ignora `VERSION`. Lo que manda es `SRS=`. **Y de rebote esquiva la trampa de orden de ejes de 1.3.0**, donde en EPSG:25830 el northing va primero. **No se cambia la versión**, y el `getMapUrl` que F03 dejó escrito agnóstico de CRS se reusa tal cual |
| **M5** | Criterio 1: «test en proyecto `dom` con tesela CORS simulada; control negativo TAINTED» | ⛔ **No se puede medir en jsdom, y fingirlo habría sido peor que declararlo.** Medido en jsdom **29.1.1**: `canvas.getContext('2d')` devuelve **`null`** (el paquete `canvas` no está instalado y no se va a instalar: compila binarios nativos) y **`toDataURL()` devuelve `null` SIN LANZAR**. O sea que un `expect(() => canvas.toDataURL()).not.toThrow()` **saldría VERDE sin haber exportado un píxel** — exactamente la clase de criterio de aceptación que no protege de nada, y este repo ya sabe lo que cuesta (`SPEC.md` §3.1). Se traslada al **guion de navegador `11`**, con el control negativo TAINTED que la propia spec exige. **En `dom` se mide el fallo REAL**, que es otro: que **`crossOrigin` se asigne ANTES que `src`**. Un lienzo contaminado casi nunca viene de olvidar `crossOrigin`, viene de ponerlo tarde, cuando la carga ya arrancó en el modo por defecto — y ese bug es invisible en cualquier otra prueba hasta que `toDataURL` lanza al final del todo. El `Image` falso registra el **orden** de asignación, con su control positivo |
| **M6** | (no previsto) | ⛔ **El parámetro de `Consulta_DNPRC` se llama `RefCat`, NO `RC`.** Con `…&RC=9398516VK3799G` el servicio contesta **HTTP 200** con `{"consulta_dnprcResult":{"control":{"cuerr":1},"lerr":[{"cod":"17","des":"LA REFERENCIA CATASTRAL ES OBLIGATORIA"}]}}` — «es obligatoria», **de una referencia que iba en la petición**. Es el TERCER caso del patrón que este repo ya conoce (`cod:16` y `cod:76` del hermano de coordenadas): **el servicio informa de un fallo NUESTRO con el vocabulario de un dato que falta**, y un lector ingenuo lo traduce a «esa referencia no existe». El nombre bueno **no se adivinó**: se leyó del `COVCCallejero.svc?singleWsdl`, donde `Consulta_DNPRC_In` declara `Municipio`, `Provincia` y `RefCat`. Fixture: `test/fixtures/catastro/ovc-dnprc-cod17.json` |
| **M7** | (no previsto) | **La raíz es `consulta_dnprcResult`, TODO EN MINÚSCULAS**, mientras el hermano usa `Consulta_RCCOORResult`. Misma casa, misma máquina, misma tanda de medición, **y no siguen la misma convención**. Cualquier código que derive la clave del nombre de la operación funciona con uno y falla con el otro. Es la **segunda** de las cuatro razones por las que `services/_catastro-dnp.js` es un fichero aparte y no un capítulo de `_catastro-ovc.js`: leídas juntas, las dos claves sugieren una regla que es falsa |
| **M8** | (no previsto) | **Hay DOS ramas y no tienen la misma forma**: `bico.bi` (un inmueble, objeto) y `lrcdnp.rcdnp[]` (varios, array). No son la misma estructura con distinta cardinalidad: traen campos distintos. **Y la parcela de referencia de este proyecto cae en la rama LISTA, con 18 inmuebles** — o sea que `bico`, que parece el caso normal, **no lo es** en la parcela que recorre toda la suite. Quien lea `…Result.bico.bi.dt.nm` para sacar el municipio obtiene `undefined` justo ahí. En `lrcdnp` **no existen `ldt` ni `cn`**: ni domicilio ya montado ni forma directa de saber si la finca es urbana o rústica, y la referencia catastral cuelga un nivel más arriba (`rcdnp.rc` frente a `bico.bi.idbi.rc`). De ahí las dos decisiones de lectura: **cada campo se lee de los 18 y solo vale si los 18 coinciden** (si no, `null` **y la discrepancia se declara**), y **`clase` se deduce del subárbol presente**, no de `cn` |
| **M9** | (no previsto) | Tres trampas más del mismo cuerpo, las tres medidas: **el subárbol rústico es `locs.lors` y contiene `lorus` Y `lourb`** —quien busque la dirección en `locs.lous.lourb`, la ruta que funciona en urbana, no la encuentra en rústica **aunque `lourb` exista**—; **los códigos vienen SIN ceros a la izquierda** (`loine.cm:"5"` para el INE 005, `cpp.cpa:"5"` mientras la referencia lleva `00005`) y hay **DOS códigos de municipio distintos**, INE (`loine.cm`) y DGC (`cmc`) — para Madrid, `"79"` y `"900"`; y **`debi.cpt` trae COMA decimal dentro de la cadena** (`"8,200000"`, o sea `NaN` con `Number()`), al revés que el hermano, que daba punto. El módulo **no expone ningún código y no lee ni un número**: los siete campos del contrato son cadenas o `null`, así que la coma decimal no le puede morder. Queda escrito para quien venga a añadir superficies |
| **M10** | El literal: *«Linda al norte, en línea recta de 12,45 m, con **la parcela 98 del polígono 8**…»* | **El literal NO dice «la parcela 98 del polígono 8» para los colindantes, y no es un recorte: es la decisión D2.** Polígono y parcela son datos **descriptivos**, y traerlos para cada vecina serían cuatro peticiones más al `Consulta_DNPRC` por informe, contra el override O8. Las colindantes se nombran por lo que **ya viene con su geometría** del WFS: la **referencia catastral** y el `cp:label`. La forma completa se reserva para la parcela propia, que es la única por la que se pregunta. Lo que sí se cumple entero es el patrón: **recorrido horario desde el vértice más al NO**, agrupando tramos consecutivos con el mismo colindante y rumbo similar, por cuadrantes, con distancia — y **«en línea recta» solo cuando lo es**: un tramo agrupado se escribe «en línea quebrada de N lados que suman X m», y su longitud es la SUMA de los lados (no la cuerda), para que la suma de los tramos sea el perímetro |

### Y tres más, que no salieron de ningún test: los destapó **RENDERIZAR el PDF y mirarlo**

Los tres son de maquetación, los tres estaban en un documento cuya suite afirmaba
—correctamente— cabecera, `%%EOF`, árbol de páginas, tabla `xref` y hasta un snapshot
de bytes. **Ninguno lo habría visto un test de bytes**, porque en los tres casos los
bytes eran los que el código pedía: el defecto era lo que pedía el código.

| # | Esto pasaba | ✅ Corregido |
|---|---|---|
| **M11** | **El epígrafe «FIRMA» salía HUÉRFANO al pie de página**, con su contenido en la hoja siguiente | Un epígrafe mide 15 mm y por tanto **cabe casi siempre**; lo que no cabía debajo era la sección. Un rótulo sin nada debajo se lee como una sección vacía. Corregido con `altoMinimo`: lo que tiene que caber **debajo** para que valga la pena escribirlo aquí. **Medido: se daba en la sección de firma, que necesita 50 mm seguidos** |
| **M12** | **Las columnas de la tabla de tramos se tocaban**: una columna alineada a la derecha quedaba pegada al rótulo de la siguiente y **las dos se leían como un solo dato** | Corregido con `AIRE_COLUMNA = 3` mm, descontado del ancho de cada columna **por la derecha**. No es holgura estética: sin él, dos cifras contiguas forman una tercera cifra que no existe |
| **M13** | **«129.9624»**, con punto decimal inglés y cuatro decimales, en el renglón de escala del plano — en un documento que escribe las longitudes en español y con dos decimales | El alto del plano se imprimía con un `${altoMm}` crudo. Corregido pasándolo por **el mismo formateador que el resto del informe** (`es-ES`, coma decimal, dos decimales de salida, regla 11). Es el mismo criterio que ya cumplía `report/contraste-texto.js`, y por el mismo motivo: **lo que no puede pasar es que el informe de texto y el PDF del mismo expediente escriban la misma cifra distinto** |

> **La lección, y no es sobre el PDF.** Las tres son de la familia de M17 de F08 (los
> botones en `system-ui`): defectos que **existen solo cuando el resultado se
> presenta**, y que ninguna aserción sobre la estructura puede ver porque la
> estructura estaba bien. La conclusión operativa es la misma: **un formato de salida
> hay que MIRARLO**, y por eso el guion 11 abre el PDF y el checklist humano pide
> abrirlo en tres lectores y sacarlo en papel.

### Y uno de costura, que destapó el CABLEADO: la tercera aparición de la misma familia

**Los clics dentro del `<dialog>` —incluido «Componer PDF»— burbujeaban hasta el
guardián de clic-fuera del cajón de diagnóstico y CERRABAN EL CAJÓN POR DEBAJO DEL
MODAL.** El usuario no veía nada raro hasta cerrar el diálogo: para entonces el cajón
había desaparecido, el contraste del mapa estaba borrado y el acuse de recibo del PDF
se había escrito en un `role="status"` que acababa de quedar en `display:none`.

Es la **tercera aparición** de la misma familia en este proyecto, y por eso conviene
contarlas juntas:

| | Dónde | Cómo apareció |
|---|---|---|
| 1.ª | **F08** — el `click()` sintético del `<a download>` de `gml/descargar.js` | La destapó el **guion 10** en navegador real (M18 de F08). Corregida en `gml/descargar.js` con `stopPropagation` en fase de captura sobre el propio anchor |
| 2.ª | **F09** — la descarga **binaria** del PDF | **Prevista**: `descargarBinario` se extrajo de la misma mecánica y hereda el `stopPropagation` ya escrito. No costó un solo hallazgo |
| 3.ª | **F09** — el `<dialog>` | **Encontrada al cablear**, no prevista. Corregida en `viewer/cajon-diagnostico.js` con `enDialogo(evento.target)`: un gesto cuyo destino cuelga de un `<dialog>` es un gesto dirigido al diálogo, **no un gesto sobre el mapa** |

Y un detalle de esa corrección que vale la pena no perder: **se pregunta por el
ELEMENTO `dialog`, no por su atributo `open`**. En un `keydown` de `Escape` el propio
diálogo ya se ha cerrado —su oyente está más adentro y corre primero— cuando el evento
llega burbujeando hasta `document`, así que un `dialog[open]` daría `null` justo en el
caso que hay que atrapar.

> **Lo que la familia enseña.** Las tres veces el defecto es el mismo: **un detalle de
> implementación de un componente es observable desde `document` por todos los demás**.
> Y las tres veces la corrección fue al sitio del que salía el evento o al que lo
> interpretaba mal, nunca al que lo notó. Que la segunda no costara nada es la
> medida de que la primera se arregló donde tocaba.

## Criterios de aceptación

Suite: `test/report/aceptacion-f09.dom.test.js`, un `describe` por criterio con su
texto literal, sobre la parcela real `9398516VK3799G` y sus **cuatro colindantes
reales** del WFS, más los dos fixtures de `Consulta_DNPRC` medidos en vivo. Con
oráculos propios (una shoelace de cuatro líneas escrita allí, un min/max propio para
la esquina NO, y una **regla sobre el papel** —milímetros desde el borde según la
escala rotulada— para el mapeo UTM→px): preguntarle a `geo/` si está de acuerdo
consigo mismo no es un oráculo.

1. El canvas compuesto exporta con `toDataURL` **sin `SecurityError`** (test en
   proyecto `dom` con tesela CORS simulada; control negativo TAINTED valida la prueba).
   ⚠️ **NO SE MIDE EN `dom`, y se declara en vez de fingirse** — ver **M5**. Se mide en
   `scripts/smoke-navegador/11-informe-pdf.js`, contra el WMS real: ✅ tesela 512×384
   en 244 ms, `toDataURL('image/jpeg')` **no lanza**, prefijo `data:image/jpeg;base64,`
   y 77.987 caracteres; **control negativo** sin `crossOrigin` ⇒
   `SecurityError: Tainted canvases may not be exported`. Y de rebote, de extremo a
   extremo: el PDF de la aplicación real lleva **una imagen `/DCTDecode`** dentro, que
   solo puede haber entrado por `toDataURL` sobre el lienzo compuesto.
2. El mapeo UTM→px coloca los vértices en el píxel correcto (función pura testeada). ✅
3. Si la salida supera el `MaxWidth` del WMS, se parte en varias `GetMap` y se
   recomponen sin costura. ✅ *Y la costura es exacta **por construcción**: los cortes
   de la rejilla se calculan una vez como coordenadas UTM compartidas, así que el
   `maxX` de una tesela y el `minX` de su vecina son literalmente el mismo `number`.
   El test lo afirma con igualdad exacta de coma flotante.* ⚠️ Con el papel de la
   aplicación **este camino no se recorre**: 2126×1535 cabe de sobra bajo el techo
   medido (M3).
4. La descripción literaria de una geometría fixture recorre horario desde el NO y
   agrupa tramos; **es editable**. ✅ *Editable en el diálogo, en un `<textarea>`, y lo
   que se exporta es lo que quede ahí.*
5. El PDF lleva pie de firma configurable y el nombre correcto; ninguna cifra del
   diagnóstico lleva color de mérito. ✅ *Y la segunda mitad se comprueba en las dos
   prohibiciones que un PDF tiene y un `.txt` no tenía: la de **vocabulario** (el
   guardián de `report/contraste-texto.js` se copia entero sobre el texto que produce
   la maqueta) y la de **TINTA** — el escritor solo sabe grises, y el gris se usa para
   jerarquía, jamás para puntuar una cifra. Ni una marca ✓ ni ⚠ sobre ningún número.*

## Desviaciones deliberadas del enunciado, con su motivo

- **El plano NO se reescala para que quepa: se lanza.** La escala rotulada (`1:N`)
  sale del encuadre, que la calculó para un tamaño de papel concreto. Encogerlo un 3 %
  para que entre dejaría un plano con **escala rotulada falsa**, que es el error
  silencioso más caro que este documento puede cometer. `RangeError`, diciendo cuánto
  sobra.
- **`sx` y `sy` no se promedian, y se devuelven los dos.** En float64 difieren
  —medido sobre la parcela real: 3,9·10⁻¹³ relativo, 8·10⁻¹⁰ px sobre los 2126 del
  plano—, y el motivo de no forzarlos iguales no es la precisión sino el **registro
  con el ráster**: el WMS estira el BBOX con una escala independiente por eje, y
  dibujar el vector con una escala única distinta de una de esas dos lo separaría de
  la imagen sobre la que se dibuja. El residuo que sí llega al papel se declara en vez
  de absorberse (regla de oro 1): `2126 px/180 mm` son 300,002 ppp y `1535 px/130 mm`
  son 299,915, así que la escala vale 1:537,85 a lo ancho y 1:537,69 a lo alto —un
  0,029 %—, y `sx`, `sy`, `pppReal` y `escalaExacta` viajan en el resultado.
- **`toDataURL` y no `toBlob`**, y no por comodidad: con el lienzo contaminado
  `toDataURL` **lanza `SecurityError`** —un fallo que se ve y se puede explicar—
  mientras `toBlob` entrega `null` al callback, mudo. Entre una excepción con nombre y
  un `null`, la regla de oro 1 no deja elegir. El peaje es el 33 % del base64 en una
  cadena intermedia (~360 kB para el JPEG de 272 kB medido), que vive lo que tarda un
  bucle.
- **Y `toDataURL` tiene su propia sustitución silenciosa:** **cae a PNG sin avisar**
  si el tipo pedido no está soportado (lo manda la especificación HTML). Devolvería un
  data URL válido cuyos bytes no son un JPEG, y `imagenJpeg` los pegaría tras un filtro
  `/DCTDecode` que no sabe descomprimir PNG. Se comprueba el prefijo
  `data:image/jpeg;base64,` antes de decodificar.
- **El diagnóstico ENTRA y no se recalcula.** Es una función inyectada, atada en
  `app/main.js` al `ultimoDiagnostico()` del cajón: **el mismo objeto que el usuario
  está mirando**. Recalcularlo costaría ~67 ms de bloqueo y, sobre todo, abriría una
  segunda verdad sobre el mismo expediente. La invariante de F08 sigue en pie: **el
  informe dice exactamente lo que dice el cajón del que salió**.
- **Sin plano, el informe se compone IGUAL y se dice por TRES canales.** El plano es
  la única pieza que va a la red. Si no se puede componer, no se cancela nada:
  `report/pdf-parcela.js` admite `plano: null` **por contrato** y emite la sección
  diciendo que no se pudo; las otras seis secciones no dependen de la red. Se dice en
  el renglón del diálogo, en el panel de avisos con el motivo técnico, y **en el propio
  PDF** — el tercero es el que importa, porque es el único que sobrevive a que alguien
  reenvíe el fichero. **Y una capa caída no es lo mismo que un plano caído**: si el WMS
  sirve la ortofoto pero no el parcelario, la capa se apaga y **se dice DEBAJO DEL
  PLANO**, no en una nota final —un plano al que le falta la capa de construcciones no
  es el mismo plano, y el motivo leído tres páginas después ya no significa nada.
- **El acuse de la presunción no BLOQUEA la exportación.** «Componer PDF» nace apagado
  mientras haya una presunción de vía pública sin repasar, con su motivo escrito en el
  `role="status"`, y se enciende al marcar la casilla. Pero el acuse dice «lo he
  repasado», no «lo he verificado», y no se pide ninguna prueba: la aplicación mide y
  el colegiado firma; obligar a jurar algo sería invertir esa frase.
- **`crearDocumentoPdf` no sale por el barrel: es el `gml/xml.js` de esta capa.**
  Publicar el escritor invita a componer informes a mano por fuera de
  `informePdfParcela`, que es justo lo que ese módulo existe para impedir —el nombre
  legal, la ausencia de siglas, la numeración de páginas, la atribución de la
  cartografía y la regla de oro 9 viven todos dentro de él, no en el escritor—.
- **`report/canvas.js` y `app/dialogo-informe.js` tampoco salen** por el barrel raíz:
  tocan `document`, `Image` y `<canvas>`, y el barrel lo carga el proyecto Vitest
  `node`. Los dos están **nombrados** en el guardián de `test/contrato.test.js`, no
  solo omitidos: un módulo que nombra `document` **dentro** de una función se
  importaría sin lanzar y dejaría el barrel roto en producción y verde en la suite.
- **El primer dato PERSONAL que esta aplicación guarda**, y por eso
  `storage/pie-firma.js` declara en su cabecera qué guarda, dónde y cómo se borra.
  Cuatro campos y una marca de tiempo, **ni uno más**: no se guarda el encabezado
  —sería construir, sin que nadie lo pida, un registro de qué fincas ha consultado esta
  persona y cuándo—, no hay historial (**un solo registro**, cada `recordar` pisa al
  anterior) y no se lleva registro de los informes emitidos. Desmarcar «Recordar»
  **borra**; no marca como inactivo. Y no sale del navegador: esta aplicación no tiene
  backend, y éste es uno de los motivos por los que no lo tiene.
- **`geo/bbox.js` y `geo/rumbo.js` entran en el barrel raíz**, y no antes por una
  razón que se escribe: no los pedía nadie desde fuera de `geo/`. `geo/arco.js`,
  `geo/centroide.js` y `geo/poligono.js` **siguen sin salir**, por lo mismo.

## Deuda declarada

- ⚠️ **El paquete queda en 675,52 kB y Vite avisa por encima de 500.** El aviso **no
  lo estrena F09**: la construcción de F08 (554,64 kB) ya lo imprimía, comprobado
  reconstruyéndola. Lo que hace F09 es **empeorarlo un 21,8 %**. No hay dependencia
  nueva que quitar —`package.json` no cambió— así que el remedio no es podar sino
  **partir**: `report/canvas.js` + `report/pdf.js` + `report/pdf-parcela.js` +
  `app/dialogo-informe.js` son **66,22 kB** que **solo hacen falta cuando alguien pulsa
  «Preparar informe»**. Es materia de **F16**, que ya tenía «créditos/licencias» y se
  lleva además esto. *(Para dimensionarlo: el módulo más caro del paquete no es de
  F09 ni de ninguna fase de este proyecto — es **Leaflet, con 148,98 kB**, atribuidos
  por el mismo sourcemap.)*
- **F01 sigue sin llamante.** F08 construyó el mueble genérico (`app/zona-fichero.js`)
  y F09 no lo ha usado: la zona de fichero sigue aceptando `.gml`/`.xml` y **nadie
  llama a `parsers/importar.js`** desde `app/`. Comprobado con `git grep` sobre el
  árbol de trabajo. Enchufar DXF/LIST/TXT arrastra arcos, X/Y invertidas y cierre que
  no cierra: es una tarea propia, no un efecto colateral.
- **Hueco declarado en el `Consulta_DNPRC`: nadie ha medido la diagonal «rama lista +
  rústica»**, o sea si en una finca rústica con varios inmuebles aparece `lors`. Las
  dos capturas dan `lrcdnp`+urbana y `bico`+rústica: **las dos diagonales contrarias**.
  Y **nadie ha medido qué contesta el servicio a una referencia inexistente**, así que
  `services/_catastro-dnp.js` **no tiene tabla de códigos que signifiquen «no hay
  datos»** y su ausencia es la decisión: escribirla «para tenerla» sería un detector de
  una señal que nadie ha visto — o código muerto que tranquiliza, o un disparo en falso.
- **El atrape de foco del `<dialog>` no se reimplementa**, y es lo único de la lista
  de carencias de jsdom que se queda sin sustituto. En el navegador lo da la capa
  superior gratis (medido en el guion: `:modal` casa, `aria-modal="true"`, velo, y el
  fondo **inerte** — un `.focus()` sobre un campo del panel no se lleva el foco), y
  escribir a mano un ciclo de tabulación sería código que solo correría donde no hace
  falta. Se declara para que nadie lo descubra como un olvido.
- **La cuarta copia de `describir`** que F07 declaró y F08 heredó **sigue igual**. F09
  no añadió una quinta ni la unificó.
- **La deuda del presupuesto de altura del panel sigue siendo estructural.** F09 es la
  **cuarta fase seguida que no le quita píxeles al panel** —el segundo botón del pie
  del cajón va en la MISMA fila que el primero, y el diálogo flota—, pero la región de
  bloques **sigue repartiendo alto fijo**. Y hay una cifra nueva que lo ilustra, y que
  no es de F09: pedir el diagnóstico le cuesta **33 px** a la tabla de vértices, porque
  el renglón de colindantes **de F05** crece a dos líneas al llegar la respuesta (ver
  «El falso positivo» en `GUION.md` §17). No es un defecto —es la regla de oro 1
  funcionando— pero **estaba sin medir**.

## Ficheros que la fase creó y tocó de verdad

La spec original nombraba **tres**. Son estos, contados con `git status` y
`git diff --stat`.

**Módulos nuevos de producción (13):**

| Fichero | Qué es |
|---|---|
| `geo/bbox.js` | caja envolvente en UTM, margen y **ajuste al ratio del papel**. Puro y **hoja** del grafo. Existe porque tres cosas leen la misma caja —el `BBOX=`, el mapeo UTM→px y la escala rotulada— y con un metro de discrepancia el vector sale desplazado sobre una cartografía impecable |
| `geo/rumbo.js` | azimut, cuadrante y **el nombre con el que se escribe en un lindero**. Puro y hoja, sin un solo `import`. **No existía nada parecido** en el proyecto |
| `report/encuadre.js` | **contrato A**: de unos recintos y un tamaño de papel, a la caja de mundo, la escala, el mapeo y las peticiones de cartografía. Puro. El troceado **es obligatorio, no una optimización** (M3) |
| `report/canvas.js` | **contrato B**: la Receta A. El único módulo de `report/` que toca el DOM y el único que habla por la red — por eso **no sale del barrel** |
| `report/literal.js` | **contrato C**: la descripción literaria del lindero. Uno de los cuatro diferenciadores, y el único sitio del proyecto donde la app **propone** |
| `report/firma.js` | **contrato D**: encabezado, identificador de documento y pie de firma. Cero imports. Aquí viven los **tres sabores de «no hay»** («No consta», «No se ha consultado», «No se ha podido consultar») que el proyecto distingue desde F07 |
| `report/pdf.js` | **contrato F**: el escritor de PDF, propio. API en **milímetros**, origen arriba-izquierda. Cero imports |
| `report/pdf-parcela.js` | **la maqueta**. Junta lo anterior y lo coloca; **no calcula ni una cifra** — una segunda aritmética sería una segunda verdad |
| `report/index.js` | el **barrel de la capa**, con superficie curada (por nombre, nunca `export *`) y las tres decisiones escritas |
| `services/_catastro-dnp.js` | el lector de `Consulta_DNPRC`. **No toca la red**: recibe texto y devuelve estructura (M6–M9) |
| `storage/pie-firma.js` | el pie de firma recordado entre sesiones. **El primer dato del expediente que esta app guarda** |
| `app/dialogo-informe.js` | el `<dialog>` «Preparar informe». Una **vista** y nada más: fabrica nodos, los rellena, los abre y los cierra |
| `app/cableado-informe.js` | el recorrido de punta a punta (preparar → editar → componer → entregar) y **el paso 11 y último** del ensamblaje — va el último porque es el que más dependencias tiene, y las tiene todas de pasos anteriores |

**Módulos tocados (11 + `.gitattributes`):** `app/main.js` (paso 11) ·
`app/cableado-diagnostico.js` · `viewer/cajon-diagnostico.js` (el segundo botón del
pie, en la misma fila, y `enDialogo`) · `gml/descargar.js` (`descargarBinario` y
`TIPO_MIME_PDF`) · `services/catastro.js` (la operación descriptiva, por la caché
antes que por la red) · `storage/bd.js` (el almacén del pie de firma) ·
`report/contraste-texto.js` (el desmentido de F08 decía que el documento firmable
«todavía no existe»: ya existe, y ahora **remite** a él por el nombre de su botón) ·
`index.js` (el barrel raíz: `report` pasa de un fichero a la capa; entran `bbox` y
`rumbo`) · `config/operativos.js` + `config/operativos.json` (dos claves:
`epsilonColindanteMetros` 0,3 y `rumboSimilarGrados` 22,5) · `estilos/app.css` (el
cromo del diálogo) · `.gitattributes` (línea propia para
`test/fixtures/catastro/derivados/`, por lo mismo que en F08: **en `.gitattributes` el
`*` no cruza la barra**, y sin línea propia el SHA-256 publicado en su `PROCEDENCIA.md`
dejaría de reproducirse).

⚠️ **Y uno que NO se tocó y sin embargo entra en el paquete:**
`viewer/atribucion.js#atribucionCombinada` lleva **sin modificarse desde F03** —su
último commit es `5d68f14`— y existía, escrito por adelantado, **solo** para el pie del
PDF de F09; hasta hoy su único consumidor era su propio test. Al estrenarlo, el
*sourcemap* le atribuye **+0,41 kB**: no es código nuevo, es código muerto que dejó de
serlo. Es el reverso exacto de M5 de F08 (`gml/parse.js`, que ya estaba dentro y por
eso costó 0,00).

**Material de prueba nuevo:** los tres fixtures reales de `Consulta_DNPRC`
(`ovc-dnprc-urbana-9398516VK3799G.json` con sus 18 inmuebles,
`ovc-dnprc-rustica-13005A10900005.json` y `ovc-dnprc-cod17.json`, la captura del error
de M6), `test/fixtures/catastro/derivados/` con su `PROCEDENCIA.md` y su SHA-256 —para
el camino de la discrepancia entre inmuebles, que no tiene material real— y
`test/fixtures/report/`.

**Tests nuevos (13 ficheros):** `test/geo/bbox.test.js` · `test/geo/rumbo.test.js` ·
`test/report/encuadre.test.js` · `test/report/canvas.dom.test.js` ·
`test/report/literal.test.js` · `test/report/firma.test.js` ·
`test/report/pdf.test.js` (**con snapshot de bytes**) ·
`test/report/pdf-parcela.test.js` (idem) · `test/services/catastro-dnp.test.js` ·
`test/storage/pie-firma.test.js` · `test/app/dialogo-informe.dom.test.js` ·
`test/app/informe.dom.test.js` · `test/report/aceptacion-f09.dom.test.js`.

**Tests ampliados (8 ficheros):** `test/contrato.test.js` (el contrato F09, y el
guardián que nombra los dos módulos que **no** salen del barrel) ·
`test/viewer/cajon-diagnostico.dom.test.js` · `test/report/contraste-texto.test.js` ·
`test/services/catastro.test.js` · `test/storage/bd.test.js` ·
`test/config/operativos.test.js` · `test/app/main-edicion.dom.test.js` ·
`test/comprobacion/aceptacion-f08.dom.test.js`.

## Coste, medido

### La suite

| | F08 (`3ea5d49`) | F09 | Δ |
|---|---|---|---|
| Pruebas | 3.925 | **4.712** | **+787** |
| Ficheros de test | 90 | **103** | **+13** |

Los 13 ficheros son exactamente los 13 nuevos de la lista de arriba; las 787 pruebas
incluyen además las ampliaciones de los 8 ficheros que ya existían.

### El paquete

`npm run build` del 2026-08-02, contrastado contra la construcción de F08
reconstruida desde `3ea5d49` en un *worktree* aparte, **que reprodujo sus cifras al
kilobyte** (554,64 kB JS · 179,19 gzip · 45,90 CSS · 25,44 html).

| | F08 | F09 | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 554,64 kB | **675,52 kB** | **+120,88 kB** (+21,8 %) |
| *(gzip del JS)* | 179,19 kB | **218,24 kB** | +39,05 kB (+21,8 %) |
| `dist/assets/index-*.css` | 45,90 kB | **49,24 kB** | +3,34 kB |
| `dist/index.html` | 25,44 kB | **25,44 kB** | **0,00** — `index.html` no se tocó |

**Ni una dependencia nueva en el grafo**, y esta vez se puede afirmar sin matices:
`package.json` **no cambió en toda la fase**. La atribución por *sourcemap* lo
confirma por el otro lado — el único `node_modules/*` con delta distinto de cero es
Leaflet, con **+0,01 kB**, que es ruido de minificación:

| Fichero | Δ | |
|---|---|---|
| `report/pdf-parcela.js` | **+28,98 kB** | nuevo. El más caro de la fase, y la mayor parte es **maqueta y texto en español**: los rótulos de las siete secciones, los dos avisos de portada y los formateadores |
| `report/pdf.js` | **+13,49 kB** | nuevo. El escritor entero, tablas AFM de Helvetica incluidas |
| `app/dialogo-informe.js` | **+12,16 kB** | nuevo |
| `report/canvas.js` | **+11,59 kB** | nuevo |
| `app/cableado-informe.js` | **+10,66 kB** | nuevo |
| `report/literal.js` | **+9,47 kB** | nuevo |
| `services/_catastro-dnp.js` | **+8,30 kB** | nuevo |
| `report/firma.js` | **+6,55 kB** | nuevo |
| `storage/pie-firma.js` | **+4,66 kB** | nuevo |
| `geo/bbox.js` | **+4,19 kB** | nuevo |
| `report/encuadre.js` | **+2,66 kB** | nuevo |
| `services/catastro.js` | +2,22 kB | la operación descriptiva |
| `gml/descargar.js` | +2,00 kB | `descargarBinario` |
| `viewer/cajon-diagnostico.js` | +1,44 kB | el segundo botón del pie y `enDialogo` |
| `geo/rumbo.js` | **+1,37 kB** | nuevo |
| `viewer/atribucion.js` | +0,41 kB | **no se tocó**: es código de F03 que hasta hoy no tenía consumidor |
| `app/main.js` | +0,28 kB | el paso 11 |
| `report/contraste-texto.js` | +0,21 kB | el desmentido, al día |
| `storage/bd.js` · `config/operativos.js` · `app/cableado-diagnostico.js` · el resto | +0,32 kB | |
| **`report/index.js`** | **0,00 kB** | el barrel de la capa **no entra en el paquete**: `app/main.js` importa los módulos directamente, y las reexportaciones se van con el *tree-shaking*. Existe para el consumidor del motor y para la suite |

Las **doce** entradas nuevas de esa tabla suman **114,08 kB** de los 120,88; el resto
son los módulos tocados y el andamiaje. El decimotercer módulo nuevo, `report/index.js`,
aporta 0,00. El CSS es el cromo del diálogo, que es el único elemento visual nuevo de
la fase.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **El criterio de aceptación 1.** No es que se haya escapado: **no se puede** (M5).
  Lo mide el guion 11, con control negativo.
- **Que el PDF ABRA.** La suite afirma cabecera, `%%EOF`, árbol de páginas y tabla
  `xref` byte a byte, y hay snapshots. Nada de eso demuestra que un lector lo abra:
  el fichero está escrito a mano, sin librería, y **la tabla `xref` es la parte que se
  rompe** —sus entradas son desplazamientos de byte absolutos, y un solo byte de más
  desplaza todo lo que viene detrás—. Va al checklist humano, **en tres lectores
  distintos**.
- **Que el plano SE LEA**: escala gráfica, cotas, norte, y que el lindero caiga donde
  tiene que caer sobre la cartografía. Una cosa es que los píxeles estén donde el
  oráculo dice y otra que el plano sirva.
- **Que salga bien EN PAPEL.** El color se eligió pensando en una impresora; nadie ha
  impreso nada.
- **Si alguna frase del informe SE LEE como un veredicto** —sobre el encaje o sobre el
  trabajo de otro técnico—, con mención expresa a la presunción de vía pública. Es el
  punto **BLOQUEANTE** de la §10 del `CHECKLIST-HUMANO.md`, y hereda el carácter de la
  §8 y la §9.
- **Que el `<dialog>` se comporte como modal de verdad.** jsdom **no implementa nada**
  de `HTMLDialogElement` salvo la propiedad `open`: medido con
  `Object.getOwnPropertyNames`, su prototipo tiene exactamente `['constructor',
  'open']`. No hay `showModal`, ni `close`, ni los eventos `cancel`/`close`, ni capa
  superior, ni `::backdrop`, ni `inert`. Lo mide el guion 11, y sale.
- **Que la firma guardada sobreviva a cerrar el navegador**, y que las tres vías de
  borrado se vean funcionando desde la interfaz.

> **La lección de esta lista es la misma que dejó F08:** que algo esté aquí escrito es
> lo que hace que se mida en alguna parte. Los tres defectos de maquetación (M11–M13)
> **no estaban en ninguna lista**, y por eso solo aparecieron cuando alguien abrió el
> fichero.

## Estado

**F09 NO está cerrada: falta la firma humana**, igual que F03, F05, F06, F07 y F08.
La cadena pasa a ser **F03 → F05 → F06 → F07 → F08 → F09** y se firma toda junta; la
§10 del `CHECKLIST-HUMANO.md` trae esta fase con su punto bloqueante.

Código y pruebas en verde (**4.712 pruebas en 103 ficheros**, 2026-08-02),
`npm run build` construye limpio (**675,52 kB JS · 49,24 kB CSS · 25,44 kB html**;
gzip del JS **218,24 kB**) **con el aviso de Vite por encima de 500 kB**, que ya
estaba en F08 y que F09 empeora (ver «Deuda declarada»).

✅ **El guion `11-informe-pdf.js` se ha ejecutado en navegador real y sale
`ok: true`, `problemas: []`, `advertencias: []`** (corrida de cierre del 2026-08-02,
en frío con IndexedDB borrada): consola limpia, 0 excepciones no capturadas, **2
peticiones de datos** (GetNeighbourParcel 11.969 B / 123 ms + `Consulta_DNPRC`
6.817 B / 769 ms, las dos 200) y 3 al WMS, **2,97 s**. El PDF sale de **326.851 B**,
4 páginas, con su imagen `/DCTDecode` dentro; componer tarda **856 ms** con **una**
`GetMap` de 2126×1535 → 194.101 B en 284 ms; y **componer no cierra nada**: el cajón
sigue abierto, los 4 trazos de contraste siguen ahí y el acuse se lee en el pie.

⛔ **La PRIMERA corrida salió `ok: false`, y esta vez NO era un defecto de producción:
era LA MEDIDA.** El guion acusó al diálogo de robarle **33 px** a la caja de vértices,
y esos 33 px eran del renglón de colindantes **de F05** creciendo a dos líneas cuando
llega la respuesta. Se arregló en el guion —esperar a que el panel se asiente y
**atribuir** la pérdida— y no en producción, porque no había nada roto. La lección es
simétrica de la que ya pagó F07: aquel guardián falló por medir **demasiado tarde**;
éste, por medir **demasiado pronto**, con algo todavía en vuelo. La regla que sale de
las dos no es «mide pronto» ni «mide tarde»: **espera a que se asiente y atribuye lo
que pierdas**.

⛔ **Y lo que hay que recordar de esta fase son los tres defectos de M11–M13**, que no
los vio la suite, ni el guion, ni el snapshot de bytes: los vio **abrir el PDF y
mirarlo**. Un formato de salida no está terminado cuando sus bytes son los que el
código pide; está terminado cuando alguien lo ha leído.

**Que la suite esté verde y el build limpio no cierra la fase**: son necesarios, no
suficientes (`SPEC.md` §6).

## Referencias

Plan §11, §18 Fase 9, §20, §22 (CORS). Dossier §4.4 (Receta A + caveat + CORS —
el caveat **corregido en M3**), §5.6 (descripción literaria, memoria de encaje), §5.5
(nomenclatura, firma neutral), §5.2 (neutralidad jurídica del pie).
`SPEC.md` §2 reglas de oro **1**, **6**, **7**, **9** y **11**; §3 overrides **O7**
(CORS del WMS, verificado y ahora consumido), **O8** (régimen de uso: el presupuesto de
red de esta fase es +1 petición), **O9** (jsPDF: **ya no aplica**).
`spec/feature-08-comprobar-gml.md` §Desviaciones (el informe de texto, que convive) y
**M17/M18** (la familia del clic, primera aparición).
`scripts/smoke-navegador/GUION.md` §17 y `CHECKLIST-HUMANO.md` §10.
Plan de ejecución de la fase:
`~/.claude/plans/quiero-que-vayamos-planificando-calm-sunbeam.md`.
