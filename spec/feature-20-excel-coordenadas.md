# F20 · Listado de coordenadas en Excel

**Fase:** 20 · **Prioridad:** P13b (Bloque B; ver §Dónde encaja) · **Riesgo:** Bajo
(el riesgo estrella murió medido el primer día, M1) ·
**Depende de:** F10 (`export/coordenadas.js`, el listado de replanteo y su maqueta;
`app/cableado-expediente.js`, las tres salidas), F09 (`gml/descargar.js#descargarBinario`,
escrito para el PDF), F00 (`geo/area.js`, `geo/metrica.js`, `gml/anillos.js`) ·
**Habilita:** que el listado de replanteo llegue a una hoja de cálculo **sin
teclearlo otra vez**.

**Ficheros previstos:** `export/xlsx.js` (nuevo — el escritor de libros),
`export/excel-coordenadas.js` (nuevo — la maqueta), `scripts/validar-xlsx.mjs` +
`scripts/validar-xlsx.py` (nuevos — el oráculo externo) y
`scripts/smoke-navegador/19-excel-coordenadas.js` (nuevo). Tocados:
`export/index.js`, `gml/descargar.js` (un MIME), `app/dialogo-expediente.js` (un
botón y dos textos que se quedan viejos), `app/cableado-expediente.js` (la cuarta
salida y `entregar` binario), `package.json` (un script), `index.js`,
`test/contrato.test.js`.

> ⏳ **Ficha abierta con el plan.** Lo que aquí se afirme del futuro y resulte
> falso **no se borrará**: se conserva citado al lado de lo medido. Manda lo
> medido (regla de oro 8).

## Objetivo

**Que el listado de coordenadas baje también como hoja de cálculo.** Hoy la
aplicación sabe entregar las coordenadas de tres formas —dentro del GML, dentro
del PDF y en el `.txt` de replanteo— y **ninguna de las tres se puede sumar,
ordenar ni pegar en una columna**. El `.txt` es texto alineado con espacios: quien
lo recibe y quiere una tabla, la teclea.

La petición vino con una imagen de la estructura esperada —título, identificador,
zona, y tres columnas `Vértice · Coordenada X · Coordenada Y`—, así que el formato
del papel no hay que inventarlo: hay que reproducirlo.

## Dónde encaja, y por qué no lleva un número de prioridad limpio

**El Bloque B se quedó sin sitio.** F17, F18 y F19 ocuparon P11, P12 y P13, que era
el hueco entre F10 (P10) y el arranque del Bloque C (P14 = F11, ya hecha).
Renumerar el Bloque C entero para colar una fase de exportación sería mover
diecisiete referencias por un número. **Entra como P13b y se dice**, en vez de
fingir que la escalera seguía teniendo peldaños.

**No es alcance nuevo del producto**, es una cuarta forma de la salida que F10 ya
declaró: su ficha llama al `.txt` «la tercera salida de esta herramienta», y la
razón por la que existe —«lo que se pega en la libreta de una estación total **o en
una hoja de cálculo**»— está escrita literalmente en la cabecera de
`export/coordenadas.js` desde el 2026-08-03. F20 es esa frase, cumplida.

## Las cuatro decisiones (entrevista del 2026-08-06)

1. **`.xlsx` de verdad, con escritor propio.** No CSV —no es una hoja de cálculo:
   no hay negritas, ni bordes, ni el recuadro de la imagen— y no SpreadsheetML
   2003, que Excel moderno abre con un aviso de *«el formato de archivo y la
   extensión no coinciden»*. **Ni una dependencia nueva**, como el PDF de F09 y
   por el mismo argumento.
2. **La estructura de la imagen, más el pie de medidas.** La tabla tal cual se
   pidió; y debajo, la superficie, el perímetro y lo que el exportador haya tenido
   que decidir — que es lo que ya cuenta el `.txt`. **Nada de lo que hoy se dice se
   queda sin decir** (regla de oro 1).
3. **Una hoja por recinto.** «Contorno exterior» en la primera pestaña y cada hueco
   en la suya. Es lo que mejor se pega a otro programa: cada tabla, limpia y sola.
4. **Se sigue el método del repo**: ficha, plan aprobado, implementación con
   pruebas y oráculo externo.

⚠️ **Y una quinta, decidida al aprobar el plan: los vértices se numeran DESDE 1**,
no desde 0 como la imagen de partida. El motivo es que son **dos documentos de la
misma aplicación sobre la misma parcela**: con el `.txt` numerando desde 1 y el
`.xlsx` desde 0, el mismo punto se llamaría de dos maneras y quien replantea con
los dos delante los cruza mal. La imagen manda en la estructura; **no manda en algo
que contradice a otro fichero nuestro**. Con esto el guardián cruzado del criterio 5
puede además exigir que **la fila N de los dos documentos sea el mismo vértice**.

## Mediciones (2026-08-06, ANTES de escribir una línea de código de producción)

**M1 · ⭐ EL RIESGO ESTRELLA ESTÁ MUERTO: un `.xlsx` escrito a mano, con el ZIP
ENTERO SIN COMPRIMIR, abre y conserva todo.** Prototipo desechable de ~120 líneas
(CRC-32 de tabla + ZIP en `STORE` + seis partes OOXML), leído después por
**openpyxl 3.1.5**:

| Qué se preguntó | Qué salió |
|---|---|
| ¿El ZIP es válido? | `testzip() → None`; las **6** partes con `compress_type=0` |
| ¿Los números son números? | `B5 → 372516.02`, **`float` de Python**, no texto |
| ¿Sobrevive el formato? | `number_format = '0.00'`, borde `thin`, negrita `True`, relleno `FFD9D9D9` |
| ¿Y los acentos? | `A4 == 'Vértice'` **exacto**; en los bytes crudos `V\xc3\xa9rtice` (UTF-8) y **no** `V\xe9rtice` |
| ¿Y el nombre de la pestaña? | `'Contorno exterior'` |
| ¿Cuánto ocupa sin comprimir? | **5.110 B** con 5 vértices ⇒ ~4,3 kB fijos + ~90 B por vértice |

⭐ **Que los valores lleguen como número y no como texto es la mitad del entregable**,
y resuelve sola la divergencia decimal que la imagen dejaba abierta: el fichero
guarda `372516.02` y **Excel lo pinta con la coma** en un equipo en español. No hay
que elegir separador; hay que no convertirlo a texto.

**M2 · No hay que escribir un `deflate`, y no es pereza: es el precedente.**
`report/pdf.js:90-96` renuncia a comprimir con todas las letras —*«un deflate
escrito a mano sería justo el tipo de pieza que este fichero existe para no
tener»*—. Con 4,3 kB fijos y 90 B por vértice, una parcela de 400 vértices ocupa
**~40 kB**. Comprimir ahorraría bytes que nadie va a notar a cambio de la pieza más
delicada del formato.

**M3 · ⭐ El escritor binario puro ya tiene precedente y camino de bajada.**
`report/pdf.js` es puro, acumula `Uint8Array` y **está en el barrel**; y
`gml/descargar.js#descargarBinario` existe **desde F09**, acepta `Uint8Array` y
rechaza un `string` con su motivo escrito (*«para texto está `descargarTexto`, que
codifica en UTF-8»*). **La frontera puro/impuro de F20 ya estaba construida**: solo
falta un MIME.

**M4 · Hay oráculo externo, y hace falta.** `python 3.13.2` + **openpyxl 3.1.5** en
el equipo. Es el gemelo exacto de `ezdxf` para el DXF (`scripts/validar-dxf.mjs`) y
de `xmllint`/`lxml` para el GML. ⛔ **Y con la lección de F10 puesta**: un lector
tolerante responde por su modelo, no por el fichero — openpyxl **rellena y perdona**
igual que ezdxf rellenaba las tablas de R2000. Por eso el validador hace **dos
pasadas** y la segunda **no toca openpyxl**: recalcula el CRC de cada entrada,
comprueba el EOCD y exige que las partes declaradas en `[Content_Types].xml` estén
todas. Aun así **no sustituye a abrir el fichero en Excel**, y eso va a la firma
humana.

**M5 · El guion de navegador puede medir que baja, y NO puede medir los bytes.**
Los guiones de este proyecto verifican la descarga inspeccionando el `<a download>`
(`11-informe-pdf.js:1297`), no capturando el fichero. Así que el reparto queda:
**el guion mide el gesto, la suite mide la maqueta y el oráculo externo mide el
fichero.** Escrito por delante para que nadie lea el `ok:true` del guion como «el
Excel abre».

**M6 · La zona se deriva sin exportar nada nuevo.** `SRS_POR_HUSO` es privado en
`geo/huso.js:87` y lo público es `srsPorHuso(huso)`, que va en la dirección
contraria a la que hace falta. **Se invierte contra la propia función** —probar
29/30/31 y quedarse con el que casa—, en vez de publicar el mapa o escribir un
segundo: el rótulo «UTM 30 ETRS89» y el `EPSG:25830` del modelo tienen que salir
del mismo sitio o divergen.

## Alcance

### T1 · `export/xlsx.js` — el escritor de libros

El gemelo de `report/pdf.js`: **sabe de OOXML y de ZIP, y no sabe qué es una
parcela.** Recibe un POJO de hojas, filas y celdas; devuelve `Uint8Array`.

- ZIP **`STORE`** con CRC-32 propio (M1, M2). Vive **dentro** de este módulo y no
  sale del barrel, por el mismo argumento con el que `NL` no sale de `export/dxf.js`:
  publicarlo invitaría a componer libros por fuera del escritor.
- Las seis partes mínimas medidas en M1. **Cadenas en `inlineStr`**, sin
  `sharedStrings.xml`: una tabla de coordenadas casi no repite texto, y la tabla de
  cadenas compartidas es una segunda contabilidad que puede desincronizarse.
- Escapado de XML y **saneado del nombre de pestaña** (Excel prohíbe `: \ / ? * [ ]`
  y corta a 31 caracteres) — el mismo tipo de lista blanca que `nombreFicheroGml`.
- **No lanza por un dato del usuario; sí por contrato roto del programador**
  (SPEC §2.1), igual que las otras tres salidas.

### T2 · `export/excel-coordenadas.js` — la maqueta

El gemelo de `report/pdf-parcela.js`, que **no calcula ni una cifra**: pide las
medidas a donde ya están.

- La estructura de la imagen (decisión 2) y **una hoja por recinto** (decisión 3).
- ⭐ **Las medidas se toman sobre las coordenadas YA REDONDEADAS**, exactamente
  igual que el `.txt`, y hay un guardián que exige que los dos ficheros den **el
  mismo número** para la misma parcela. Dos documentos de la misma aplicación
  midiendo distinto el mismo solar es peor que cualquiera de los dos errores.
- El pie de medidas va **solo en la hoja del contorno exterior** y se dice por qué:
  la superficie es la **neta** de la parcela entera, y repetirla en la pestaña de un
  hueco afirmaría que es la del hueco.
- Las detecciones (`COLAPSO_POR_REDONDEO`, `ANILLO_DESCARTADO`, `CAPA_VACIA`) salen
  por el mismo catálogo de `export/_comun.js` y **también impresas en el libro**.
- La `fecha` **entra por parámetro**. Aquí no se lee el reloj (regla de toda la capa).

### T3 · La bajada

- `TIPO_MIME_XLSX` en `gml/descargar.js`, junto a los otros cinco.
- `app/cableado-expediente.js`: cuarta salida, `entregar` capaz de bajar bytes
  **sin duplicar** el nombre ni el acuse, y el bloqueo de la rama EDIFICIO por la
  misma puerta que el DXF y el `.txt`.
- `app/dialogo-expediente.js`: el botón, y ⚠️ **los dos textos que se quedan
  viejos** — «el único de **los tres**» y `MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO`,
  que enumera las salidas de parcela por su nombre.

### T4 · Los guardianes

- `scripts/validar-xlsx.mjs` + `.py`, **dos pasadas** (M4), con los tres códigos de
  salida de `validar-xsd.mjs`: `0` bien · `1` mal · `2` no se pudo medir y se pidió
  `--estricto`. **«No poder medir» no es «está bien».**
- `scripts/smoke-navegador/19-excel-coordenadas.js`, que mide **el gesto** (M5).

## Fuera de alcance, y se dice

- **Reimportar el `.xlsx`.** La aplicación no lo sabrá abrir, igual que el `.txt` y
  el DXF. ⚠️ **Y aquí el aviso impreso de `AVISO_NO_REIMPORTABLE` no vale tal
  cual**: habla de «la primera columna es el número de vértice», que sigue siendo
  cierto, pero la frase se escribió para un fichero de texto. Se adapta, **no se
  copia** — dos redacciones del mismo hecho divergen.
- **Fórmulas, gráficos, impresión configurada.** Una tabla, no un informe.
- **La rama EDIFICIO.** Como el DXF y el `.txt`: el escritor es de parcela.
- **Varias parcelas de un expediente F17 en un libro.** El sobrante derivado no
  entra en esta fase; si se pide, tendrá su casa escrita.

## Criterios de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | El `.xlsx` que produce la aplicación **abre en openpyxl** con `testzip()` limpio y las partes completas | ✅ `validar:xlsx`, 5 casos · y en navegador real: 6 partes, firma `PK` y EOCD |
| 2 | Las coordenadas llegan como **número**, no como texto, con formato de 2 decimales | ✅ `float` con `number_format='0.00'` · en Chrome, `celdaNumerica:true` y `comaDentroDelValor:false` |
| 3 | La estructura es la de la imagen: título, identificador, zona y `Vértice · Coordenada X · Coordenada Y` | ✅ con `A1:C1` combinada y el recuadro cerrado |
| 4 | **Una pestaña por recinto**, rotulada, y el pie de medidas solo en la del exterior | ✅ y la hoja del hueco **dice dónde están las medidas** en vez de callarse |
| 5 | La superficie y el perímetro del `.xlsx` son **idénticos** a los del `.txt` para la misma parcela | ✅ **por construcción, no por comparación**: comparten `prepararListado` |
| 6 | Lo que el exportador tuvo que decidir **está impreso en el libro** y sale por el panel | ✅ bloque «Al preparar esta hoja» + `publicarDetecciones` |
| 7 | Con la rama EDIFICIO **no baja nada** y se dice por qué | ✅ y el aviso se comprueba **contra el catálogo `FICHERO`**, no contra una cadena |
| 8 | `npm run validar:xlsx --estricto` en verde, con la **segunda pasada sin openpyxl** | ✅ código 0 · ⭐ **y NO es vacuo: medido con 4 ficheros averiados, los 4 en rojo** |
| 9 | ~~Guion `19-excel-coordenadas.js`~~ **`12-expedientes.js`** en `ok:true` | ✅ **desviación declarada**: entra en el guion que YA cubre este diálogo — ver abajo |
| 10 | Se **mide y se declara** lo que cuesta (píxeles del diálogo y kB del paquete) | ✅ **+16,64 kB** de JS · **0 B** de CSS · **0 px** de panel · pie del diálogo **72,78 px sin desbordar** |

## Lo que NO va a cubrir ningún test de la suite, dicho por escrito

- **Que Excel de verdad lo abra sin una queja.** openpyxl es un lector tolerante y
  el precedente de ZWCAD está escrito en el override O12: el validador daba verde a
  un fichero que colgaba el CAD. → firma humana, **BLOQUEANTE**.
- **Que la tabla se entienda al pegarla en el trabajo de quien firma** — que las
  columnas tengan el ancho que hace falta y que el número de vértice no se confunda
  con una coordenada. Eso lo dice una persona con el fichero delante.

## Estado

✅ **HECHA el 2026-08-06.** Código y pruebas: **6.794 pruebas / 158 ficheros, verde**
(partida: 6.554/155 tras el commit de F12). `npm run validar:xlsx` en verde con sus
dos pasadas, y guion `12-expedientes.js` en **`ok:true`, `problemas: []`**.

⏳ **Firma humana**: `CHECKLIST-HUMANO.md` §17, con **dos puntos BLOQUEANTES** — que
Excel de verdad lo abra sin una queja, y que la tabla **se pueda sumar**, que es lo
que el `.txt` no permitía y por lo que existe la fase.

**Coste medido**: JS **1.010,72 kB** (+16,64; +4,91 en gzip) · CSS **0 B** · panel
**0 px** · **ni una dependencia nueva**.

✅ **Fase 1 · El escritor (T1.1 y T1.2), hecha y en verde.** `export/xlsx.js` (~700
líneas con su documentación) y `test/export/xlsx.test.js` con **61 pruebas**. Suite
completa en **6.615 / 156**, sin tocar nada de lo anterior. **Ni una dependencia
nueva.**

Lo que la fase deja medido, con el escritor **de verdad** y no con el prototipo:

- **openpyxl abre el libro**: `testzip() → None`, **7 partes todas en `STORE`**, dos
  pestañas rotuladas, `A1:C1` combinada, anchos de columna aplicados.
- **Los valores llegan como valores**: `1` es `int`, `372516.02` es `float`,
  `1535.87` sale con el formato `0.00" m²"` y `164.24` con `0.00" m"` — la unidad
  está en el FORMATO, así que la celda se sigue pudiendo sumar.
- **El escapado va y vuelve**: `Nota al pie con "comillas" & <signos>` se recupera
  carácter por carácter.
- **Determinista**: mismo libro y misma fecha ⇒ mismos bytes. El ZIP guarda fecha por
  entrada y **no se lee el reloj para ponerla**; hay guardián por `grep` sobre el
  texto fuente, como en `report/pdf.js`.

⛔ **Y dos defectos propios cazados durante la fase, los dos antes de que existiera
un llamante:**

1. **`dimension` contaba los renglones en blanco del final.** Usaba `filas.length` en
   vez de la última fila con contenido, así que una maqueta que termine con un hueco
   —la de F20 lo hace— declaraba un rango mayor que su última celda. Corregido y con
   prueba de regresión.
2. ⚠️ **Los caracteres de control escritos como literales convertían el fichero
   fuente en BINARIO.** `grep` contestaba «Binary file export/xlsx.js matches» y
   dejaba de poder citar una línea de un módulo de este repo. Reescritos con escapes
   `\u`, con el porqué al lado — y le pasaba lo mismo a su test.

✅ **Fase 2 · La maqueta (T2.1 y T2.2), hecha y en verde.**
`export/excel-coordenadas.js` y `test/export/excel-coordenadas.test.js` con **43
pruebas**, más `test/export/_leer-xlsx.js` (lector auxiliar, solo para las pruebas).
Proyecto `node` completo en **4.057 / 103**.

⭐ **DESVIACIÓN DEL PLAN, y es la decisión buena de la fase: el criterio 5 no se
cumple con una prueba, se cumple compartiendo el cálculo.** El plan decía que la
maqueta «pediría las medidas a donde ya están»; al escribirla se vio que eso admitía
dos lecturas, y la floja era hacer que cada salida calculara lo suyo y poner un test
que las comparase. Un guardián puede estar verde y estar defendiendo el defecto (F11 ·
M28–M30). Así que `export/coordenadas.js` **se ha refactorizado**: la preparación
—redondeo, vértices fundidos, medidas y detecciones— sale a `prepararListado`, y las
DOS salidas la llaman. La coincidencia ya no se puede romper, en vez de notarse cuando
se rompa. El `.txt` no ha movido un byte: sus **38 pruebas**, snapshot incluido, pasan
sin tocarlas.

Con él salen también `rotuloRecinto` (con el que se rotula la PESTAÑA: sin
compartirlo, el `.txt` podría decir «Hueco 1» y el `.xlsx` «Hueco 2» del mismo
anillo), `fechaLarga` y `NO_CONSTA`.

Medido con openpyxl sobre la maqueta real (parcela del WFS + un hueco):
**2 pestañas, 19 vértices, 13.716 B**, el recuadro `A1:C1` combinado, y la tabla de la
imagen con `Vértice · Coordenada X · Coordenada Y`.

⛔ **Y tres cosas que encontró escribirla:**

1. **El escritor descartaba las celdas vacías, y así el recuadro del título salía
   abierto por la derecha.** Una celda combinada solo dibuja el borde de las celdas
   que existen de verdad, así que `A1:C1` necesita B1 y C1 **con estilo y sin
   contenido**. `export/xlsx.js` aprende a emitirlas, con la regla escrita: pedir un
   formato para una celda es afirmar que esa celda existe.
2. **Faltaba un estilo** para reproducir el recuadro de la imagen —etiqueta en negrita
   **con** borde—. El catálogo pasa de diez a once, con nombre (`ETIQUETA`), que es
   como el módulo dijo que crecería.
3. ⚠️ **Un falso rojo del guardián cruzado que era del test, no de los módulos:**
   `useGrouping: true` **no es el defecto**. El defecto es `"auto"`, y en español
   `"auto"` no separa los millares hasta las cinco cifras (`minimumGroupingDigits` es
   2), así que 9.900 salía «9900,00» en el test y «9.900,00» en el `.txt`. Los dos
   documentos no divergían: divergía la prueba.

⚠️ **La celda de la superficie guarda el valor COMPLETO (`1510.865149996761`) y enseña
`1.510,87`**: el redondeo es del formato y no del valor. Es lo mismo que hace el `.txt`
—allí también existe la cifra entera y `Intl` la rinde a dos decimales al imprimir— y
es lo que hace cierta la frase del pie. Queda declarado por si algún día alguien
ensancha los decimales y se sorprende.

✅ **Fase 3 · La bajada (T3.1, T3.2 y T3.3), hecha y en verde.** Suite completa en
**6.777 / 157**. El botón «Exportar coordenadas (.xlsx)» está en el diálogo
«Expediente», junto al del `.txt` y con la extensión a la vista: son el mismo
documento en dos envases, y lo único que distingue a uno de otro es para qué se va a
usar.

- `TIPO_MIME_XLSX` en `gml/descargar.js`, **el registrado y no la abreviatura**:
  `application/vnd.ms-excel` es de OTRO formato —el `.xls` binario de antes de 2007— y
  declararlo sería el mismo fallo que el DXF que decía `AC1015` sin serlo.
- `entregar()` **admite bytes además de texto**, y elige el primitivo **por el tipo de
  lo que llega, no por una bandera**: una bandera se olvida, y olvidarla aquí
  significa pasar un ZIP por `descargarTexto` —que codifica en UTF-8— y corromperlo en
  silencio, con la firma `PK` intacta y el destrozo invisible hasta que Excel dijera
  que el fichero está dañado. Su prueba comprueba `PK` al principio **y el EOCD al
  final**, que es lo que no sobreviviría a una recodificación.
- ⭐ **`serializarLibroXlsx` NO sale del barrel**, ni `crc32` ni `ESTILO`. Es la misma
  decisión que `report/index.js` tomó con `crearDocumentoPdf`: lo que la aplicación
  necesita es EL DOCUMENTO, no un motor de hojas de cálculo.
- **El `.xlsx` comparte el prefijo `coordenadas` con el `.txt`**, a propósito: bajados
  los dos aparecen juntos en la carpeta y **con la misma marca de tiempo**, que es la
  forma de saber que dicen lo mismo.

⛔ **Y una prueba ajena se puso roja, con razón y por el motivo equivocado.** La de
«los tres nombres no colisionan» derivaba los nombres de `FICHERO` —bien— pero tenía
la CUENTA escrita a mano (`toBe(4)`). Ahora se deriva también: lo que ahí importa es
que todos sean distintos, no cuántos hay. Y lo que de verdad vigila es el `.xlsx`, al
que solo lo distingue del `.txt` la extensión.

⚠️ **Dos textos que enumeraban se habían quedado viejos y se han corregido**: el
apunte del diálogo («el único de **los tres**») y `MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO`,
que nombra las salidas de parcela una por una. El segundo tiene ahora una prueba que lo
comprueba **contra el catálogo `FICHERO`** y no contra una cadena escrita a mano,
porque un mensaje que enumera caduca cada vez que se añade una salida.

### Coste, MEDIDO (criterio 10)

Medido sobre un `git worktree` de HEAD, sin tocar el árbol de trabajo, comparando la
misma construcción con y sin F20:

| | Sin F20 (HEAD `cc6ac46`) | Con F20 | Cuesta |
|---|---|---|---|
| JS | 994,08 kB | 1.010,72 kB | **+16,64 kB** |
| JS en gzip | 318,15 kB | 323,06 kB | **+4,91 kB** |
| CSS | 67,33 kB | 67,33 kB | **0 B** |
| Dependencias | — | — | **ninguna nueva** |

⭐ **El CSS sale a CERO y no por suerte**: el botón reutiliza
`gml-boton gml-boton--secundario`, así que el fichero construido es **el mismo hasta en
el hash** (`index-ClK4bC18.css` las dos veces). **0 px en el panel**, además, porque
todo esto vive dentro de un `<dialog>`.

⏳ **Lo que la fase 3 NO puede medir y pasa a la 4**: que los **cinco** botones del pie
del diálogo quepan sin desbordar. jsdom no maqueta —no hay `getBoundingClientRect` de
verdad—, así que eso lo tiene que medir el guion en un navegador.

✅ **Fase 4 · Los guardianes (T4.1, T4.2 y T4.3), hecha.** Suite completa en
**6.794 / 158**.

**`npm run validar:xlsx`** — gemelo de `validar:dxf` y de `validar:xsd`. Genera 5
libros con el exportador de verdad y se los da a Python. **Dos pasadas, y la segunda
no toca openpyxl**, por la lección de ZWCAD: un lector tolerante rellena lo que falta
y responde por su modelo. La pasada estructural comprueba el CRC de cada entrada, que
todas vayan sin comprimir, que cada parte esté declarada en `[Content_Types].xml`, que
cada `r:id` apunte a algo y que cada `s="N"` caiga dentro de `cellXfs`.

⭐ **Y no es vacuo, que es lo que hay que demostrar de un guardián.** Se le pasaron
cuatro ficheros averiados con el control intacto al lado: un byte cambiado sin tocar
su CRC, basura pegada tras el EOCD, una pestaña renombrada y un vértice movido.
**Control en verde (0) y las cuatro averías en rojo (1)**, cada una con su motivo.
⚠️ A diferencia del de DXF, **no exige openpyxl para elegir intérprete**: la pasada
estructural corre con la biblioteca estándar, así que un Python pelado ya mide la
mitad más valiosa. Código de salida **3** para «el paquete está bien pero no se ha
podido comprobar que se LEA», que es media medición y se dice.

**⭐ DESVIACIÓN DEL PLAN (criterio 9): no hay guion nuevo.** El plan pedía
`19-excel-coordenadas.js`; la cuarta salida entra en **`12-expedientes.js`**, que ya
cubre este mismo diálogo con el mismo arnés de captura
(`Blob → createObjectURL → <a download> → click() → revoke`). Un guion propio habría
duplicado cien líneas de envoltorios para medir un botón más y —peor— habría dejado a
ÉSTE midiendo tres de cuatro salidas y diciendo «✅». Medido en Chrome, `ok:true`,
`problemas: []`:

| Qué | Medido |
|---|---|
| El `.xlsx` baja | **10.586 B**, MIME registrado, firma `PK` **y EOCD** |
| Las 6 partes de OOXML | presentes, por su nombre dentro del ZIP |
| Sin comprimir | el XML aparece en claro: la decisión `STORE` se cumple |
| ⭐ Celda numérica | `celdaNumerica: true` · `comaDentroDelValor: false` |
| ⭐ Los CINCO botones caben | `desborda: false` · `todosDentro: true` · **72,78 px** |

Esa última fila es la medida que la fase 3 dejó pendiente por escrito: jsdom no
maqueta, así que un pie de diálogo que desborda sale verde en las 6.794 pruebas.

⛔ **Y el guion salió `ok:false` en su primera corrida, por un defecto DEL GUION.**
Acusaba: *«la caja de vértices arranca en 0 px … algo del tamaño de un BLOQUE ha
entrado en el panel»*. **No había entrado nada.** El guion se escribió cuando la
aplicación arrancaba con el panel entero delante; el rework de UI la partió en pasos y
el arranque pasó a ser **Entrada**, donde la tabla de vértices ni siquiera está
montada. Medido: **0 px en Entrada** contra **455,97 px en Validación** a 1440×900.
Es la misma caducidad post-rework que GUION.md ya tenía declarada del guion `10`, y se
arregló yendo a la pantalla de la que habla la medida —declarando en el veredicto
desde dónde se midió— **sin tocar el umbral**: bajarlo a 0 habría sido apagar el
guardián para que dejara de avisar.

**Documentación cerrada**: `GUION.md` §18.1 (la cuarta exportación) y §29 (el
validador, con la tabla de vacuidad); `CHECKLIST-HUMANO.md` **§17**, con **dos**
puntos bloqueantes; `SPEC.md` §4 (fila P13b) y §5 (mapa de ficheros).

---

⚠️ **Nota sobre el árbol compartido, que se resolvió sola.** Durante las fases 2 y 3 la
otra sesión trabajaba en **F12** sobre el mismo árbol, y la suite completa llegó a salir
**6.658 / 157 con 1 roja** en `test/app/panel-edificio.dom.test.js` — comprobado
entonces que ese test **no importaba nada de `export/`** y que la roja no era de F20. La
otra sesión ha **commiteado F12** (`cc6ac46`) y el árbol de trabajo queda con **F20 y
nada más**, que es además lo que permite medir el coste de arriba con exactitud.

## Referencias

[`feature-10-persistencia-export.md`](feature-10-persistencia-export.md) (el `.txt`
de replanteo, y la frase que anunciaba esta fase) ·
[`feature-09-informe-parcela.md`](feature-09-informe-parcela.md) (el escritor
binario propio y `descargarBinario`) · `SPEC.md` §3 override **O12** (por qué un
oráculo tolerante no basta) · regla de oro **1** (ningún error silencioso) y **9**
(la aplicación mide; el colegiado interpreta y firma).
