# Procedencia de los fixtures del servicio del Catastro

Estos ficheros son **verdad externa** (regla de oro 8 de `spec/SPEC.md`): mandan sobre la
documentación, sobre el dossier y sobre nuestro criterio. Ninguno se edita para que un test
pase. Si uno de ellos contradice al código, se corrige el código.

Este documento existe porque un fixture sin procedencia es una opinión con formato de dato.

Los de `../gml/` congelan **el formato del GML**. Estos congelan **el comportamiento del
servicio**: qué contesta de verdad el WFS del Catastro y el OVC de callejero cuando la
petición sale bien, cuando sale mal, y —sobre todo— cuando sale mal de una forma que *parece*
salir bien.

## Cómo se capturaron, y por qué no se recapturan a la ligera

Todos con `curl`, el **2026-07-27**, **una sola petición cada uno**, secuenciales, sin bucles
ni reintentos. La política de uso del Catastro contempla la **denegación del servicio durante
~10 días** ante uso abusivo, y detecta patrones automáticos (override O8 de `spec/SPEC.md`;
la cifra de «3.600/h» que circula en el plan v4 **no está respaldada** por ninguna fuente
oficial y no se cita). Fueron 8 peticiones en total. Si alguien necesita rehacer una captura,
que rehaga **esa**, no la tanda.

**Segunda tanda, el 2026-08-02 (F09), 5 peticiones.** Mismo método: `curl`, secuenciales, una
sola petición por caso, sin bucles ni reintentos, con el `User-Agent` por defecto de `curl` y
sin ninguna cabecera añadida. Son las **tres** fichas `ovc-dnprc-*` de más abajo (3 peticiones:
la urbana, la rústica y la fallida que destapó la trampa del nombre del parámetro), la
`Consulta_RCCOOR` con la que se **encontró** la parcela rústica (1, no versionada: ver «Huecos
declarados») y una lectura de metadata `?singleWsdl` (1, tampoco versionada). Cinco, contadas.

> La tercera ficha `ovc-dnprc-*` —la del `cod:"17"`— **se versionó como fichero el 2026-08-02,
> en la tarea T2.3**, sin volver a pedir nada: su cuerpo entero ya estaba transcrito literal en
> este documento, y el fichero se escribió **desde esa transcripción**. Que su SHA-256 coincida
> con el publicado (`76059b09…`) es la prueba de que la transcripción era fiel byte a byte. No es
> una petición más: es la misma, guardada.

La URL exacta de cada fichero está en su sección. Reproducibles tal cual.

## Cinco hechos transversales, medidos en las 8 respuestas

**1 · El error llega con HTTP 200.** Las 8 respuestas —las buenas, la de referencia
inexistente, la de caja vacía y las dos de parámetros mal puestos— devolvieron
`HTTP/1.1 200 OK`. En ningún caso hubo 4xx ni 5xx.

> **`response.ok` no sirve para clasificar nada en este servicio.** Es `true` siempre. La
> clasificación de una respuesta del Catastro se hace **leyendo el cuerpo**, nunca mirando el
> código de estado. Un cliente que haga `if (!res.ok) throw` y dé por buena la rama contraria
> tratará un `ExceptionReport` como si fuera una parcela.

**2 · CORS abierto.** Las 8 respuestas traen `Access-Control-Allow-Origin: *`. Confirma el
override O7 de `spec/SPEC.md` (que estaba marcado «pendiente de verificar» en el plan v4).
Comprobado con `curl -D`. Matiz que conviene dejar escrito: es la **única** cabecera CORS
presente —no hay `Access-Control-Allow-Headers` ni `-Methods`—, así que solo está respaldada
por medición la petición simple. Dos consecuencias:

- No añadir cabeceras propias a estas peticiones: forzarían un *preflight* `OPTIONS` del que
  no tenemos ninguna medición.
- `credentials: 'include'` es **incompatible** con `Access-Control-Allow-Origin: *` (el
  navegador rechaza el comodín cuando la petición lleva credenciales). Y ambos servicios
  mandan cookies de sesión (`ASP.NET_SessionId` en el OVC, `TS01da3df4` en el WFS). Hay que
  dejar el `credentials` por defecto.

**3 · Latencias: NO están acotadas en décimas.** Medidas hoy (`%{time_total}` de `curl`):

| Petición | s |
|---|---|
| `DescribeStoredQueries` | 0,099 |
| BBOX vacío (mar) | 0,115 |
| `GetParcel` de RC inexistente | 0,221 |
| `GetNeighbourParcel` | 0,239 |
| BBOX `count=10` | 0,451 |
| `Consulta_RCCOOR` correcta | 0,417 |
| `Consulta_RCCOOR` cod 16 | **2,903** |
| `Consulta_RCCOOR` cod 76 | **1,464** |

⚠️ Una exploración previa había anotado un rango de **0,11–0,21 s**. Esa nota se queda corta:
es cierta para el WFS, y **falsa para el OVC**, donde una llamada llegó a **2,9 s**. Cada
llamada al `.svc/json` abre sesión ASP.NET nueva (`Set-Cookie: ASP.NET_SessionId`), que es la
explicación más probable del arranque en frío. Un `timeout` de cliente calculado sobre
«0,2 s» cortaría llamadas que iban a contestar bien.

**4 · El XML miente sobre su propio encoding.** Los cinco `.xml` declaran
`encoding="ISO-8859-1"` (o `"iso-8859-1"`) y sus bytes son **UTF-8** — la misma incoherencia
que ya documenta `../gml/PROCEDENCIA.md` para `cp_parcela_9398516VK3799G.gml`. No se corrige.
Lo que la salva en la práctica es la cabecera HTTP: `Content-Type: text/xml; charset=utf-8`,
que es la que `fetch().text()` obedece. Quien lea estos ficheros **desde disco** (los tests)
tiene que decodificarlos como UTF-8 e ignorar la declaración, no al revés.

**5 · Ninguna raíz lleva prefijo.** Ni `wfs:FeatureCollection` ni `ows:ExceptionReport`: el
servicio declara el namespace **por defecto** y escribe `<FeatureCollection …>` y
`<ExceptionReport …>` a secas. Cualquier detección por nombre de etiqueta con prefijo falla.
La discriminación tiene que ser por **namespace + localName**.

**6 · No hizo falta `User-Agent` de navegador.** `spec/feature-05-catastro-vivo.md` afirma:
*«Manda `User-Agent` de navegador (el navegador lo hace gratis); sin él el servicio da error»*.
Las 8 peticiones de esta tanda salieron con el `User-Agent` **por defecto de `curl`**
(`curl/8.15.0`, no se pasó `-A` ni `-H`) y las 8 contestaron **200 con cuerpo válido**. No se
reprodujo ese error en ninguno de los dos endpoints, hoy.

No convierte la frase de la spec en falsa —puede haber sido cierta antes, o serlo en otro
endpoint—, pero sí la deja **sin respaldo medido**, y ese es el estándar de esta carpeta. Lo
que **no** cambia es el override O8: *no rotar* `User-Agent`. Son dos cosas distintas —mandar
uno fijo y creíble frente a ir cambiándolo— y la segunda es la que el Catastro sanciona.

**Corroborados el 2026-08-02** por las 5 peticiones de la tanda de F09, todas contra
`COVCCallejero.svc` (servicio hermano del ya medido, misma máquina): las 5 dieron **HTTP 200**
—incluida la que llevaba mal el nombre de un parámetro— con `Content-Type: application/json;
charset=utf-8` y `Access-Control-Allow-Origin: *`. Los hechos 1 y 2 valen, pues, también para
`Consulta_DNPRC`. Latencias: 0,136 s (la fallida), 0,357 s (`Consulta_RCCOOR` rural), 0,466 s
(`?singleWsdl`), **0,966 s** (DNPRC urbana, 18 inmuebles) y 0,339 s (DNPRC rústica). Ninguna
llegó a los 2,9 s del peor caso de julio, pero el hecho 3 sigue en pie: el rango de este
endpoint no está acotado en décimas.

⚠️ **Matiz honesto sobre el CORS, que hay que leer antes de dar F09 por seguro.** Ninguna de
estas 5 peticiones llevó cabecera `Origin` — igual que las 8 de julio. Lo que sí se puede
afirmar, y es más de lo que decía la nota anterior: el servidor emitió
`Access-Control-Allow-Origin: *` **aun sin `Origin` en la petición**, lo cual descarta que esté
*reflejando* el origen del cliente y apunta a una cabecera fija de configuración. Sigue sin
haber `Access-Control-Allow-Headers` ni `-Methods`: solo la petición **simple** está respaldada
por medición, y las dos consecuencias del hecho 2 (no añadir cabeceras propias, no usar
`credentials: 'include'`) se aplican igual a `Consulta_DNPRC`.

---

## `wfs-exceptionreport-rc-inexistente.xml` — EL ERROR QUE VIENE CON HTTP 200

| | |
|---|---|
| Origen | WFS INSPIRE de parcela catastral, D.G. del Catastro |
| URL | `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetParcel&refcat=0000000XX0000X&srsname=EPSG::25830` |
| Descargado | 2026-07-27 |
| HTTP | 200 OK · `text/xml; charset=utf-8` · `Access-Control-Allow-Origin: *` |
| SHA-256 descargado | `f6ac50d1f18b809d040a99952d4b6b0a2f2f4855de406b9119ed8fd592777288` (333 B, CRLF) |
| Aquí | 327 B, finales de línea normalizados a LF (ver «Sobre los finales de línea») |

**Qué congela.** El cuerpo exacto del fallo. Literal:

```xml
<ExceptionReport xmlns="http://www.opengis.net/ows/1.1" version="2.0.0">
<Exception exceptionCode="OperationProcessingFailed">
<ExceptionText><![CDATA[No se ha encontrado la parcela 0000000XX0000X para el huso 25830]]></ExceptionText>
</Exception>
</ExceptionReport>
```

Los cuatro detalles que importan y que ninguna documentación recoge:

1. **HTTP 200.** No 404, no 400. Ver el hecho transversal 1.
2. **`ExceptionReport` con el namespace `http://www.opengis.net/ows/1.1` por defecto, sin
   prefijo `ows:`.**
3. **`exceptionCode="OperationProcessingFailed"`** — no `InvalidParameterValue`, que es lo que
   pediría la especificación OWS para un parámetro sin resultado.
4. **El texto va en `CDATA`.** Un extractor que lea `textContent` lo obtiene igual; uno que
   busque nodos de texto hijos directos sin contemplar `CDATA_SECTION_NODE` se queda a cero.

La referencia `0000000XX0000X` es sintácticamente plausible y no existe: es el caso «el usuario
tecleó bien y la parcela no está», no «el usuario tecleó cualquier cosa».

## `wfs-neighbour-9398516VK3799G.xml` — LA VECINDAD SE INCLUYE A SÍ MISMA

| | |
|---|---|
| Origen | WFS INSPIRE, *stored query* `GetNeighbourParcel` |
| URL | `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetNeighbourParcel&refcat=9398516VK3799G&srsname=EPSG::25830` |
| Descargado | 2026-07-27 (`timeStamp` de la respuesta: `2026-07-27T23:53:03`) |
| HTTP | 200 OK · `Access-Control-Allow-Origin: *` |
| SHA-256 descargado | `1d65c86f9b425fed460c35d30f8cffabf7cadc96d8c33c7e3dacb017fbe3138e` (11.969 B, CRLF) |
| Aquí | 11.780 B, LF |

**Qué congela: `GetNeighbourParcel` DEVUELVE TAMBIÉN LA PROPIA PARCELA.** No está documentado
en ninguna fuente oficial —ni en el `Abstract` de la *stored query*, ni en la guía del
servicio—, y cambia la aritmética de cualquier código que cuente colindantes.

Medido: **5 `<member>`**, `numberMatched="5"`, `numberReturned="5"`. En este orden:

| # | `nationalCadastralReference` | |
|---|---|---|
| 1 | `9398501VK3799G` | vecina |
| 2 | **`9398516VK3799G`** | **la parcela consultada** |
| 3 | `9398518VK3799G` | vecina |
| 4 | `9398517VK3799G` | vecina |
| 5 | `9398515VK3799G` | vecina |

Es decir: **4 colindantes reales**, no 5. Y la propia parcela **no viene la primera**: está en
segunda posición. No se puede descartar por índice; hay que filtrar por referencia catastral.

Cada miembro trae la parcela completa (geometría, `areaValue`, `referencePoint`), con
`gml:id="ES.SDGC.CP.<refcat>"` y `srsName="http://www.opengis.net/def/crs/EPSG/0/25830"` —
forma URI OGC, la de la **descarga**, coherente con el override O2 de `spec/SPEC.md`. Se pidió
`EPSG::25830` y contesta con la URI: los dos extremos del canal usan formas distintas.

## `wfs-bbox-count10.xml` — EL FIXTURE QUE DEMUESTRA LA MENTIRA

| | |
|---|---|
| Origen | WFS INSPIRE, `GetFeature` estándar con `bbox` (no *stored query*) |
| URL | `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2.0.0&request=GetFeature&typenames=cp:CadastralParcel&srsname=EPSG::25830&bbox=439000,4479400,439600,4480000,EPSG::25830&count=10` |
| Descargado | 2026-07-27 (`timeStamp`: `2026-07-27T23:53:23`) |
| HTTP | 200 OK · `Access-Control-Allow-Origin: *` |
| SHA-256 descargado | `239a48a6da2625e52ee46a6c8f0191937d13e8441c6052a68cb5f185f5b0e5f4` (26.326 B, CRLF) |
| Aquí | 25.952 B, LF |

**Qué congela: `numberMatched` y `numberReturned` MIENTEN cuando hay `count`.** Medido en este
mismo fichero:

| | |
|---|---|
| `<member>` que trae el cuerpo | **10** |
| `numberMatched` declarado | **539** |
| `numberReturned` declarado | **539** |

`numberReturned` debería ser, por la especificación WFS 2.0, el número de elementos **de esta
respuesta**. Dice 539 y hay 10. El atributo no está truncado; sencillamente no se entera de
que la respuesta sí lo está.

> Un cliente que se fíe de `numberReturned` para decidir «¿hay más?», para dibujar un contador
> o para paginar, se equivoca en dos órdenes de magnitud. **Los miembros se cuentan
> contándolos.** `numberMatched`, en cambio, sí es útil: es el total real de la caja, y es la
> única forma barata de saber cuánto hay ahí antes de pedirlo.

**El otro dato: por qué el cliente necesita un tope de área.** La misma caja
(600 × 600 m = 0,36 km², un trozo de Madrid), pedida **sin `count`**, devolvió **539 parcelas
y ~1,15 MB** — medido en la exploración previa de F05, no incluido aquí como fixture por
tamaño. Las 539 quedan **corroboradas por el propio fixture**, que las declara en
`numberMatched`; y el orden de magnitud del megabyte cuadra con los ~2,5 kB por miembro que se
miden en este fichero (539 × 2,5 kB ≈ 1,3 MB). Sobre 0,36 km² ya es un megabyte: el tope de
área del cliente no es prudencia, es aritmética.

**`GetFeature` + `bbox`, no una *stored query*.** Ver el fixture siguiente.

## `wfs-describestoredqueries.xml` — LAS *STORED QUERIES* QUE DE VERDAD EXISTEN

| | |
|---|---|
| Origen | WFS INSPIRE, `DescribeStoredQueries` |
| URL | `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2.0.0&request=DescribeStoredQueries` |
| Descargado | 2026-07-27 |
| HTTP | 200 OK · `Access-Control-Allow-Origin: *` |
| SHA-256 descargado | `7110b8c61f3e27ab903a9ffa800c8ea3cb51fd6cfbbe5ccf0823742536bf797a` (6.925 B, CRLF) |
| Aquí | 6.821 B, LF |

**Qué congela: el catálogo completo, dicho por el servicio.** Son **cinco**, ni una más:

| `id` | Parámetros | Devuelve |
|---|---|---|
| `GetParcel` | `REFCAT`, `SRSNAME` | `cp:CadastralParcel` |
| `GetFeatureById` | `ID`, `SRSNAME` | `cp:CadastralParcel` |
| `GetNeighbourParcel` | `REFCAT`, `SRSNAME` | `cp:CadastralParcel` |
| `GetZoning` | `COD_ZONA`, `SRSNAME` | `cp:CadastralZoning` |
| `GetParcelByZoning` | `COD_ZONA`, `SRSNAME` | `cp:CadastralParcel` |

> ⛔ **No hay ninguna *stored query* de BBOX.** `spec/feature-05-catastro-vivo.md` lista
> `getParcelsByBBox(bbox, srs)` entre las funciones de alto nivel de `services/catastro.js`,
> en una enumeración donde las otras **sí** tienen su *stored query* uno a uno
> (`getParcelByRefcat`→`GetParcel`, `getNeighbourParcels`→`GetNeighbourParcel`,
> `getZoning`→`GetZoning`). La simetría invita a buscar un `GetParcelsByBBox` que **no existe**:
> no está en esta lista, que es la lista que da el propio servicio.
>
> **El BBOX se hace con `GetFeature` estándar**
> (`request=GetFeature&typenames=cp:CadastralParcel&bbox=…`), como demuestra
> `wfs-bbox-count10.xml`. Este fixture es la prueba de la ausencia, que es exactamente lo que
> hace falta para que nadie pierda una tarde buscando el nombre que falta.

Detalle menor pero real: todas declaran `isPrivate="true"` en su `QueryExpressionText`, así que
el servicio **no publica** la expresión interna de ninguna. Solo se puede ir por el `id`.

## `wfs-bbox-vacio-mar.xml` — «VACÍO» SE DICE IGUAL QUE «FALLO»

| | |
|---|---|
| Origen | WFS INSPIRE, `GetFeature` con `bbox` sobre mar abierto |
| URL | `https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2.0.0&request=GetFeature&typenames=cp:CadastralParcel&srsname=EPSG::25830&bbox=364000,3985000,364600,3985600,EPSG::25830&count=10` |
| Descargado | 2026-07-27 |
| HTTP | 200 OK · `Access-Control-Allow-Origin: *` |
| SHA-256 descargado | `7307c7fafe7d086135136aaa3245c266df0d3d9e012dfc242fe574569c04d1bf` (313 B, CRLF) |
| Aquí | 307 B, LF |

La caja son 600 × 600 m en el **mar de Alborán**, huso 30, a unos 50 km al sur de la costa de
Málaga (≈ 35,9 °N, 4,5 °O) y lejos de la isla de Alborán. Salió a la primera.

**Qué congela: una caja sin parcelas NO devuelve una colección vacía.** Devuelve un
`ExceptionReport`:

```xml
<ExceptionReport xmlns="http://www.opengis.net/ows/1.1" version="2.0.0">
<Exception exceptionCode="OperationProcessingFailed">
<ExceptionText><![CDATA[No records founded for BBOX and SRS provided]]></ExceptionText>
</Exception>
</ExceptionReport>
```

Y aquí está lo que hace a este fichero incómodo y necesario: **es byte por byte de la misma
forma que el error de referencia inexistente**. Mismo HTTP 200, misma raíz `ExceptionReport`,
mismo `exceptionCode="OperationProcessingFailed"`. Lo **único** que distingue «no hay nada en
esta zona» de «esa referencia no existe» es el **texto libre del `CDATA`**.

> Consecuencia para el cliente: `exceptionCode` **no es clasificable**. Este servicio usa un
> único código para todo. Si F05 quiere distinguir «cero resultados» (estado normal, se pinta
> un mapa vacío) de «fallo» (se avisa al usuario), tendrá que discriminar por el
> `ExceptionText`, sabiendo que es texto no contractual que el Catastro puede cambiar sin
> avisar. Eso hay que decirlo en la UI, no esconderlo — regla de oro 1.

**Corrige a la spec.** `spec/feature-05-catastro-vivo.md` dice: *«el WFS puede devolver
`ExceptionReport` o feature vacía»*. Medido: **la feature vacía no existe**. Las dos ramas son
la misma rama. El `kind:'empty'` de `CatastroError` no se puede derivar de la forma de la
respuesta, solo del texto de dentro.

⚠️ El texto trae una errata del propio servicio: **«No records *founded*»**, no *found*. Se
transcribe tal cual. Cualquier comparación se hace contra la errata, no contra el inglés
correcto — y por eso conviene comparar por un fragmento estable (`records` + `BBOX`) antes que
por la frase entera.

## `ovc-rccoor-ok.json` — LA RC LLEGA PARTIDA EN DOS

| | |
|---|---|
| Origen | OVC Callejero, `Consulta_RCCOOR` (endpoint WCF/JSON) |
| URL | `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_RCCOOR?SRS=EPSG:25830&CoorX=439242.88&CoorY=4479664.51` |
| Descargado | 2026-07-27 |
| HTTP | 200 OK · `application/json; charset=utf-8` · `Access-Control-Allow-Origin: *` |
| SHA-256 | `df6ec68b1f0909a9d45f4cd3e48f4e288039cc5a8da038d1757838e8ad64d570` (230 B) |
| Finales de línea | ninguno: el cuerpo viene en una sola línea, sin `\n` final |

El punto cae dentro de la parcela `9398516VK3799G`, la misma de `../gml/` (verificado
con turf).

⚠️ **Corregido el 2026-07-28: el punto NO es el `cp:referencePoint` de la parcela**,
como decía antes esta ficha. Es la media aritmética de sus vértices —el centroide con
el que se pidió—, `[439242.88, 4479664.51]`, mientras que el `referencePoint` que
publica el Catastro en el GML es `[439250.35, 4479664.55]`: hay **7,5 m** entre los
dos. Los dos caen dentro del polígono, así que el fixture vale igual, pero la frase
era falsa y en este documento eso importa más que en ningún otro: es la ficha de
procedencia, y quien la lea dará por medido lo que diga.

```json
{"Consulta_RCCOORResult":{"control":{"cucoor":1},"coordenadas":{"coord":[{"pc":{"pc1":"9398516","pc2":"VK3799G"},"geo":{"xcen":"439242.88","ycen":"4479664.51","srs":"EPSG:25830"},"ldt":"CL SAN RESTITUTO 72(C) MADRID (MADRID)"}]}}}
```

**Qué congela.** Cuatro cosas que hay que saber antes de escribir el parser:

1. **La referencia catastral viene PARTIDA:** `pc1` (7 caracteres) + `pc2` (7). No hay ningún
   campo con la RC de 14 completa. Hay que concatenar: `pc1 + pc2` → `9398516VK3799G`.
2. **`ldt` trae el domicilio** (`CL SAN RESTITUTO 72(C) MADRID (MADRID)`). Es **lo único** que
   permite a una persona distinguir entre varios candidatos: `coord` es un array y un punto en
   un linde puede devolver más de uno. Sin `ldt`, una lista de referencias catastrales es
   ilegible para el usuario.
3. **Todo son cadenas**, también las coordenadas (`"439242.88"`, no `439242.88`). Hay que
   convertir, y por tanto hay que decidir qué se hace si la conversión falla.
4. **Envoltorio `Consulta_RCCOORResult`** y contador `control.cucoor` (número de coordenadas
   resueltas). En el camino de éxito hay `cucoor`; en el de error hay `cuerr`. Son claves
   **distintas**, no un mismo campo con valores distintos.

## `ovc-rccoor-cod16.json` — «AQUÍ NO HAY PARCELA»

| | |
|---|---|
| Origen | OVC Callejero, `Consulta_RCCOOR` con un SRS que no existe |
| URL | `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_RCCOOR?SRS=EPSG:9999&CoorX=439242.88&CoorY=4479664.51` |
| Descargado | 2026-07-27 |
| HTTP | **200 OK** · `Access-Control-Allow-Origin: *` |
| SHA-256 | `c111bfcfa7cad1cdffab384b6f49e3fd6ce33ed46bffd44625fdbfaf2ee3a505` (130 B) |

```json
{"Consulta_RCCOORResult":{"control":{"cuerr":1},"lerr":[{"cod":"16","des":"PARA ESAS COORDENADAS NO HAY REFERENCIA DISPONIBLE"}]}}
```

**Qué congela.** La **forma** del error del OVC: `control.cuerr` (en vez de `cucoor`) y un array
`lerr` con `cod` (cadena, no número) y `des` en mayúsculas.

Y congela algo más incómodo, que es la razón de que este fixture se pidiera con
`SRS=EPSG:9999`: **el servicio contestó `cod:16` — «para esas coordenadas no hay referencia
disponible» — a unas coordenadas que SÍ tienen parcela.** El punto es exactamente el mismo que
en `ovc-rccoor-ok.json`; lo único que cambia es que el sistema de referencia es inventado. El
OVC no dice «SRS desconocido»: dice «no hay parcela». Otro error silencioso de origen: el
mensaje culpa al punto cuando el problema está en el `SRS`.

## `ovc-rccoor-cod76.json` — LOS DOS ENDPOINTS NO COMPARTEN NOMBRES DE PARÁMETRO

| | |
|---|---|
| Origen | OVC Callejero, `Consulta_RCCOOR` con los nombres de parámetro del **otro** endpoint |
| URL | `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_RCCOOR?SRS=EPSG:25830&Coordenada_X=439242.88&Coordenada_Y=4479664.51` |
| Descargado | 2026-07-27 |
| HTTP | **200 OK** · `Access-Control-Allow-Origin: *` |
| SHA-256 | `b852cd813587fb50261a0d4e1a4109810e3f132f49a6088b96cdf50286bec454` (107 B) |

```json
{"Consulta_RCCOORResult":{"control":{"cuerr":1},"lerr":[{"cod":"76","des":"LA COORDENADA X OBLIGATORIA"}]}}
```

**Qué congela: hay dos endpoints de geocodificación y NO usan los mismos nombres de
parámetro.**

| Endpoint | Coordenadas |
|---|---|
| `…/OVCCoordenadas.asmx/Consulta_RCCOOR` (SOAP/ASMX) | `Coordenada_X` / `Coordenada_Y` |
| `…/COVCCoordenadas.svc/json/Consulta_RCCOOR` (WCF/JSON) | **`CoorX` / `CoorY`** |

*(La columna del `.asmx` viene de la documentación del OVC y de la exploración previa de F05;
**no** se ha medido aquí — habría sido una petición más. La del `.svc/json` sí: es este fixture
y el de éxito, medidos los dos.)*

Este fichero es **lo que devuelve el endpoint JSON cuando se le mandan los nombres del otro**.

**Por qué importa, y es lo único que importa de este fixture.** Un lector ingenuo hace esto:

```js
if (json.Consulta_RCCOORResult.control.cuerr) {
  return { estado: 'sin-parcela', mensaje: lerr[0].des }
}
```

…y traduce `cod:76` a **«no hay parcela en ese punto»**. La verdad es **«hemos construido mal
la URL»**. El usuario ve «aquí no hay nada», mueve el marcador, vuelve a ver «aquí no hay
nada», y concluye que el Catastro está caído — cuando el fallo es nuestro, está en cada
petición, y es reparable en una línea. **Es un error silencioso de manual**, y la regla de oro 1
dice que no puede ocurrir: un `cuerr` que el cliente no sepa interpretar tiene que salir como
fallo técnico, no como resultado negativo.

Y, otra vez: **HTTP 200**. La URL está mal construida, el servicio lo sabe, lo dice, y contesta
200 igual.

---

# `Consulta_DNPRC` — los datos alfanuméricos de la parcela (F09)

Las dos fichas siguientes son de **otro servicio**: `COVCCallejero.svc`, no `COVCCoordenadas.svc`.
Es el que da lo que el informe de F09 necesita en su encabezado —municipio, paraje,
polígono/parcela— y que la geometría del WFS **no trae**.

> ⚠️ **El envoltorio de este servicio se llama `consulta_dnprcResult`, TODO EN MINÚSCULAS.**
> El del servicio hermano se llama `Consulta_RCCOORResult`, con la caja del nombre de la
> operación. Son la misma casa, la misma máquina y la misma tanda de medición, y **no siguen la
> misma convención**. La operación se pide como `Consulta_DNPRC` (así, en la URL) y contesta en
> minúsculas. Cualquier código que derive la clave del envoltorio a partir del nombre de la
> operación —`` `${op}Result` ``— funciona con RCCOOR y falla con DNPRC. Medido en las dos
> fichas de abajo y también en la respuesta de error.

## `ovc-dnprc-urbana-9398516VK3799G.json` — LA PARCELA DE REFERENCIA NO DEVUELVE `bico`

| | |
|---|---|
| Origen | OVC Callejero, `Consulta_DNPRC` (endpoint WCF/JSON) |
| URL | `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?Provincia=&Municipio=&RefCat=9398516VK3799G` |
| Descargado | 2026-08-02 |
| HTTP | 200 OK · `application/json; charset=utf-8` · `Access-Control-Allow-Origin: *` · 0,966 s |
| SHA-256 | `9dd04f1ec1a4434b787f04ba79d8d39fd24b05986f9c3d60c2d515a8008bc294` (6.817 B) |
| Finales de línea | ninguno: el cuerpo viene en una sola línea, sin `\n` final |

Es la parcela `9398516VK3799G`, la misma que recorre toda la suite y la misma de `../gml/`.

### La trampa de entrada: el parámetro se llama `RefCat`, no `RC`

**Primero se pidió con `…&RC=9398516VK3799G`.** El servicio contestó **HTTP 200** con:

```json
{"consulta_dnprcResult":{"control":{"cuerr":1},"lerr":[{"cod":"17","des":"LA REFERENCIA CATASTRAL ES OBLIGATORIA"}]}}
```

(117 B, SHA-256 `76059b090fce8a53c3c8b071a44cf477a998d0d36931b17e087e6e1463c52a3f`. **Desde el
2026-08-02 tiene fichero propio**: [`ovc-dnprc-cod17.json`](ovc-dnprc-cod17.json), con su ficha
más abajo. El cuerpo se queda aquí igualmente, literal, porque es el que explica esta trampa.)

**«ES OBLIGATORIA» — de una referencia catastral que iba en la petición.** Es el tercer caso del
mismo patrón que ya documentan `ovc-rccoor-cod16.json` y `ovc-rccoor-cod76.json`: *el servicio
informa de un fallo NUESTRO con el vocabulario de un dato que falta*. Un lector ingenuo lo
traduce a «esa referencia no existe» o «el usuario no ha escrito nada», y lo que pasa de verdad
es que **el parámetro está mal escrito y falla el 100% de las peticiones**.

El nombre bueno no se adivinó: se leyó del **esquema del propio servicio**
(`COVCCallejero.svc?singleWsdl`), donde el mensaje `Consulta_DNPRC_In` declara exactamente tres
partes:

| Parte | Tipo |
|---|---|
| `Municipio` | `xs:string` |
| `Provincia` | `xs:string` |
| **`RefCat`** | `xs:string` |

`Provincia` y `Municipio` van **vacíos** y la consulta funciona igual: con la referencia
completa de 14 caracteres el servicio no los necesita. Los tres son `minOccurs="0"`.

### Qué congela: **con varios inmuebles NO hay `bico`, hay `lrcdnp`** — y no es el caso raro

Claves de primer nivel medidas: **`control` y `lrcdnp`. No hay `bico`.** La parcela de
referencia del proyecto es un edificio con **18 inmuebles** (`control.cudnp` = 18, y el array
`lrcdnp.rcdnp` tiene 18 elementos: contados, coinciden).

> Esto invierte la intuición. `bico` («bien inmueble con construcciones») parece el caso normal
> y `lrcdnp` la lista excepcional. En la parcela que este proyecto usa **de referencia para
> todo**, el caso es `lrcdnp`. Cualquier cliente que lea `…Result.bico.bi.dt.nm` para sacar el
> municipio obtiene `undefined` justo en la parcela de la suite.

Las dos ramas son **excluyentes** y se distinguen por qué clave existe:

| Rama | Cuándo | Dónde está cada inmueble |
|---|---|---|
| `bico` | **un** inmueble | `consulta_dnprcResult.bico.bi` (objeto) |
| `lrcdnp` | **varios** inmuebles | `consulta_dnprcResult.lrcdnp.rcdnp[i]` (array) |

Y no son la misma forma con distinta cardinalidad — **traen campos distintos**:

| | `bico.bi` | `lrcdnp.rcdnp[i]` |
|---|---|---|
| Claves | `idbi`, `dt`, `ldt`, `debi` | `rc`, `dt`, `debi` |
| La RC cuelga de | `bi.idbi.rc` | `rcdnp.rc` (**un nivel menos**) |
| `cn` (`'UR'`/`'RU'`) | **sí**, en `bi.idbi.cn` | **NO EXISTE** |
| `ldt` (domicilio compuesto) | **sí** | **NO EXISTE** |
| Hermanos (`finca`, `lcons`, `lspr`) | sí, en `bico` | **NO EXISTEN** |

Dos consecuencias que hay que tener escritas antes de programar nada:

1. **En la rama `lrcdnp` no se puede saber si la parcela es urbana o rústica**: el discriminante
   `cn` solo existe en `bico`. Quien lo necesite, lo deduce de la propia referencia catastral o
   de qué subárbol de `locs` viene (`lous` vs `lors`, ver la ficha siguiente).
2. **En la rama `lrcdnp` no hay ningún domicilio ya montado.** `ldt` —el campo que
   `Consulta_RCCOOR` sí da y del que depende `services/_catastro-ovc.js` para que el usuario
   elija— **no aparece ni una vez** en este fichero de 6,8 kB. Hay que componerlo desde `dt`.

Excerpt del primer inmueble (el fichero trae 18 así):

```json
{"rc":{"pc1":"9398516","pc2":"VK3799G","car":"0001","cc1":"A","cc2":"Y"},"dt":{"loine":{"cp":"28","cm":"79"},"cmc":"900","np":"MADRID","nm":"MADRID","locs":{"lous":{"lourb":{"dir":{"cv":"8822","tv":"CL","nv":"SAN RESTITUTO","pnp":"72","plp":"C"},"loint":{"pt":"-1"},"dp":"28039","dm":"9"}}}},"debi":{"luso":"Almacen-Estacionamiento","sfc":"505","cpt":"8,200000","ant":"1997"}}
```

Lo que hay que saber de ahí:

1. **La RC de este servicio tiene CINCO trozos, no dos.** `pc1`(7) + `pc2`(7) + `car`(4) +
   `cc1`(1) + `cc2`(1) = **20 caracteres**: es la referencia del **inmueble**, no la de la
   parcela. `Consulta_RCCOOR` solo daba `pc1`+`pc2` = 14. Los 14 de parcela son idénticos en
   los 18 inmuebles (comprobado: `pc1+pc2` toma un solo valor); lo que cambia es `car`.
2. **`cc1`+`cc2` NO es un identificador único.** Son dígitos de control y se repiten dentro de
   la misma parcela: medido, `JS`, `KD` y `LF` salen **dos veces cada uno** entre los 18. El
   único discriminante es `car` (`0001`…`0018`).
3. **Hay DOS códigos de municipio y no valen lo mismo.** `dt.loine.cm` = `"79"` (código INE) y
   `dt.cmc` = `"900"` (código DGC del Catastro). Para Madrid son **79 y 900**. Confundirlos da
   un municipio que no existe.
4. **Los códigos vienen SIN CEROS A LA IZQUIERDA.** `loine.cm` es `"79"`, no `"079"`: el código
   INE de Madrid es `28079`, y para reconstruirlo hay que rellenar a 3 (`cp` a 2). En la ficha
   siguiente el mismo campo vale `"5"` para el municipio INE `005`.
5. **`debi.cpt` lleva COMA decimal dentro de la cadena**: `"8,200000"`. `Number("8,200000")` es
   `NaN`. El servicio hermano daba `"439242.88"` con **punto**. Misma familia de servicios, dos
   separadores decimales distintos, y ninguno de los dos avisa.
6. **Todo son cadenas menos los contadores de `control`**, que son números (`cudnp: 18`, sin
   comillas). El resto —superficies, años, códigos— es texto.

## `ovc-dnprc-rustica-13005A10900005.json` — DONDE VIVEN EL POLÍGONO, LA PARCELA Y EL PARAJE

| | |
|---|---|
| Origen | OVC Callejero, `Consulta_DNPRC` sobre una parcela **rústica** |
| URL | `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?Provincia=&Municipio=&RefCat=13005A10900005` |
| Descargado | 2026-08-02 |
| HTTP | 200 OK · `application/json; charset=utf-8` · `Access-Control-Allow-Origin: *` · 0,339 s |
| SHA-256 | `6632d9d816b4f3796b6cd7e5c061291aceaba3457454d41a47979bc6da6ba716` (1.399 B) |
| Finales de línea | ninguno: el cuerpo viene en una sola línea, sin `\n` final |

**De dónde sale esta parcela, que no se eligió de una lista.** No hay ninguna rústica de
referencia en el proyecto, así que se buscó **midiendo**, no adivinando: se tomó un punto en
mitad de La Mancha —`[474132.51, 4350111.66]` en `EPSG:25830`, o sea lon −3,30 / lat 39,30,
labrantío entre Herencia y Alcázar de San Juan— y se le preguntó a `Consulta_RCCOOR` qué parcela
lo contiene. Contestó a la primera (0,357 s, `control.cucoor` = 1):

```json
{"Consulta_RCCOORResult":{"control":{"cucoor":1},"coordenadas":{"coord":[{"pc":{"pc1":"13005A1","pc2":"0900005"},"geo":{"xcen":"474132.51","ycen":"4350111.66","srs":"EPSG:25830"},"ldt":"ER EXTRARRADIO  Polígono 109 Parcela 5 C.BOLSA. ALCAZAR DE SAN JUAN (CIUDAD REAL)"}]}}}
```

`pc1`+`pc2` = **`13005A10900005`**, que es la referencia con la que se pidió el DNPRC. Esa
respuesta intermedia **no se versiona** (ver «Huecos declarados»); va aquí entera porque es la
procedencia del fixture y sin ella la elección de la parcela sería un dedo en el mapa.

De paso deja medido algo útil: **`Consulta_RCCOOR` funciona igual en rústica**, y su `ldt` ya
trae el polígono y la parcela **en texto libre castellano** («Polígono 109 Parcela 5»). Es texto
para leer, no para parsear: los números de verdad están donde dice la tabla de abajo.

### Qué congela: el subárbol rústico es `locs.lors`, y **no** `locs.lous`

Esta es la diferencia estructural que la ficha existe para dejar por escrito:

| | urbana | rústica |
|---|---|---|
| Subárbol de `dt.locs` | **`lous`** | **`lors`** |
| Dentro | `lous.lourb` | `lors.lorus` **y `lors.lourb`** |

Es decir: **`lors` contiene los dos**. Una parcela rústica trae su bloque rústico (`lorus`:
polígono, parcela, paraje) *y además* un bloque de dirección con forma urbana (`lourb`:
`ER EXTRARRADIO`, código postal `13600`). Quien busque la dirección en
`locs.lous.lourb` —la ruta que funciona en la urbana— no la encuentra en la rústica, aunque
`lourb` exista: **cuelga de `lors`, no de `lous`**.

Rutas completas medidas de lo que F09 necesita:

| Dato | Ruta completa | Valor medido |
|---|---|---|
| Urbana o rústica | `consulta_dnprcResult.bico.bi.idbi.cn` | `"RU"` (la urbana da `"UR"`, pero ver el aviso de la ficha anterior: en la rama `lrcdnp` **no existe**) |
| Provincia (nombre) | `consulta_dnprcResult.bico.bi.dt.np` | `"CIUDAD REAL"` |
| Municipio (nombre) | `consulta_dnprcResult.bico.bi.dt.nm` | `"ALCAZAR DE SAN JUAN"` |
| Provincia (cód. INE) | `consulta_dnprcResult.bico.bi.dt.loine.cp` | `"13"` |
| Municipio (cód. INE) | `consulta_dnprcResult.bico.bi.dt.loine.cm` | `"5"` (¡no `"005"`!) |
| Municipio (cód. DGC) | `consulta_dnprcResult.bico.bi.dt.cmc` | `"5"` |
| **Polígono** | `consulta_dnprcResult.bico.bi.dt.locs.lors.lorus.cpp.cpo` | `"109"` |
| **Parcela** | `consulta_dnprcResult.bico.bi.dt.locs.lors.lorus.cpp.cpa` | `"5"` (¡no `"00005"`!) |
| **Paraje (nombre)** | `consulta_dnprcResult.bico.bi.dt.locs.lors.lorus.npa` | `"C.BOLSA"` |
| Paraje (código) | `consulta_dnprcResult.bico.bi.dt.locs.lors.lorus.cpaj` | `"96"` |
| Zona de concentración | `consulta_dnprcResult.bico.bi.dt.locs.lors.lorus.czc` | `"0"` |
| Código postal | `consulta_dnprcResult.bico.bi.dt.locs.lors.lourb.dp` | `"13600"` |
| Superficie de la finca | `consulta_dnprcResult.bico.finca.dff.ss` | `"395764"` (m²) |
| Tipo de finca | `consulta_dnprcResult.bico.finca.ltp` | `"Parcela construida sin división horizontal"` |
| Uso | `consulta_dnprcResult.bico.bi.debi.luso` | `"Agrario"` |
| Superficie construida | `consulta_dnprcResult.bico.bi.debi.sfc` | `"25"` (m²) |
| Antigüedad | `consulta_dnprcResult.bico.bi.debi.ant` | `"1997"` |
| Subparcelas (cultivos) | `consulta_dnprcResult.bico.lspr[i].dspr.{ccc,dcc,ip,ssp}` | 4 elementos; `[0]` = `CR` / `"LABOR O LABRADÍO REGADÍO"` / `"02"` / `"358255"` |

Y siete detalles más que muerden:

1. **`npa` es el paraje y NO tiene por qué ser un topónimo legible.** Aquí vale `"C.BOLSA"`
   —abreviado, con punto, sin espacio—. En el informe se imprime tal cual o no se imprime; no
   se «arregla».
2. **`cpa` («parcela») viene sin ceros: `"5"`, no `"00005"`.** La referencia catastral
   `13005A109`**`00005`** sí los lleva. Si alguien compone el texto «Polígono 109 Parcela 5» a
   partir de la RC y otro lo compone desde `cpp`, salen dos cadenas distintas para el mismo
   dato. Lo mismo con `cpo` (`"109"`), que en la RC ocupa 3 y coincide por casualidad.
3. **Hay DOS `ldt` y son distintos.** `bico.bi.ldt` lleva el código postal y un espacio;
   `bico.finca.ldt` no lleva código postal y tiene **dos** espacios antes de `C.BOLSA`:
   - `bi.ldt` → `ER EXTRARRADIO  Polígono 109 Parcela 5 C.BOLSA. 13600 ALCAZAR DE SAN JUAN (CIUDAD REAL)`
   - `finca.ldt` → `ER EXTRARRADIO  Polígono 109 Parcela 5  C.BOLSA. ALCAZAR DE SAN JUAN (CIUDAD REAL)`

   No son el mismo campo repetido: hay que elegir uno **a sabiendas**. (Los dos traen además
   doble espacio tras `EXTRARRADIO`.)
4. **`nm` viene SIN TILDE: `"ALCAZAR DE SAN JUAN"`**, cuando el municipio se escribe *Alcázar*.
   Y **no es un problema de codificación**: en el mismo fichero, y en UTF-8 correcto, hay
   `Polígono` (U+00ED), `división` (U+00F3) y `LABRADÍO REGADÍO` (U+00CD). Los nombres de
   municipio y provincia van en mayúsculas y sin acentuar **por decisión del dato**, no por el
   transporte. Un informe que imprima `nm` tal cual escribirá «ALCAZAR».
5. **`loint` puede ser un objeto VACÍO `{}`**, no ausente y no `null`
   (`…lors.lourb.loint` aquí). Un `if (loint)` da `true` sobre nada.
6. **Los contadores de `control` sí cuadran, esta vez.** `cudnp`=1, `cucons`=1 (`lcons` tiene 1)
   y `cucul`=4 (`lspr` tiene 4): contados, coinciden los tres. No es excusa para fiarse —el WFS
   miente en `numberReturned` y está documentado arriba—, pero queda medido que aquí no mintió.
7. **La aritmética de superficies cierra, y conviene saberlo:** la suma de los cuatro `ssp` es
   **395.739** m² y `finca.dff.ss` declara **395.764** m². La diferencia es **25** m², que es
   exactamente `debi.sfc`, la superficie construida. O sea: `ss` incluye lo construido y las
   subparcelas de cultivo no.

Un apunte de bytes: `bico.finca.infgraf.igraf` trae una URL a la Sede con las **barras
escapadas** en el JSON crudo (`https:\/\/www1.sedecatastro.gob.es\/…`). `JSON.parse` lo
deshace solo; cualquier búsqueda por texto sobre el fichero en bruto, no. Y su cadena de
consulta usa otra vez los códigos sin rellenar: `?del=13&mun=5&refcat=13005A10900005`.

## `ovc-dnprc-cod17.json` — EL FALLO NUESTRO CONTADO COMO DATO QUE FALTA

| | |
|---|---|
| Origen | OVC Callejero, `Consulta_DNPRC` con el nombre de parámetro que **no** es |
| URL | `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?Provincia=&Municipio=&RC=9398516VK3799G` |
| Descargado | 2026-08-02 · **versionado como fichero el 2026-08-02 (T2.3), sin repetir la petición** |
| HTTP | **200 OK** · `application/json; charset=utf-8` · `Access-Control-Allow-Origin: *` · 0,136 s |
| SHA-256 | `76059b090fce8a53c3c8b071a44cf477a998d0d36931b17e087e6e1463c52a3f` (117 B) |
| Finales de línea | ninguno: el cuerpo viene en una sola línea, sin `\n` final |

```json
{"consulta_dnprcResult":{"control":{"cuerr":1},"lerr":[{"cod":"17","des":"LA REFERENCIA CATASTRAL ES OBLIGATORIA"}]}}
```

**Qué congela: el TERCER caso del patrón «fallo nuestro con vocabulario de dato ausente».** Es el
hermano exacto de [`ovc-rccoor-cod76.json`](ovc-rccoor-cod76.json) —de ahí que se versione, por
simetría— y de [`ovc-rccoor-cod16.json`](ovc-rccoor-cod16.json). La diferencia entre lo que el
servicio dice y lo que pasa de verdad:

| | |
|---|---|
| El servicio dice | «LA REFERENCIA CATASTRAL ES OBLIGATORIA» |
| La petición llevaba | `…&RC=9398516VK3799G`, o sea **la referencia catastral, delante** |
| Lo que pasa de verdad | el parámetro se llama **`RefCat`**, y con `RC` **falla el 100 % de las peticiones** |

Un lector ingenuo lo traduce a «esa referencia no existe» o «el usuario no ha escrito nada»; las
dos lecturas son falsas y las dos mandan a arreglar lo que no es. Y, otra vez, **HTTP 200**: la
petición está mal construida, el servicio lo sabe, lo dice, y contesta 200 igual.

**Sobre su procedencia, que aquí importa más que en ninguna otra ficha.** Este fichero **no se
descargó dos veces**. La petición se hizo el 2026-08-02, en la tanda de T0.2, y su cuerpo quedó
transcrito literal en la ficha de la urbana con su tamaño y su SHA-256. El 2026-08-02, en T2.3,
se escribió el fichero **a partir de esa transcripción** y se comprobó que da **117 bytes** y el
**mismo SHA-256 publicado**. Esa coincidencia es lo que convierte la transcripción en verdad
externa: si un solo byte se hubiera perdido al copiarla, el hash no cuadraría. No hay una
petición más en la cuenta del override O8, y no la habrá: recapturarlo «para estar seguros»
gastaría una llamada para obtener un fichero que ya está comprobado.

**Consecuencia para el cliente**, escrita aquí porque es donde se busca: `'17'` **no entra en
ninguna tabla de «no hay datos»**. `services/_catastro-dnp.js` no tiene ninguna —ver «Huecos
declarados»— y este código sale como `RESPUESTA_ILEGIBLE`, o sea como problema técnico con el
`cod` y el `des` literales delante. Meterlo en un camino de «no encontrado» convertiría un bug
reproducible en el 100 % de las peticiones en un mensaje tranquilizador y falso.

---

## El `GetParcel` bueno no se duplica aquí

El camino de éxito de la *stored query* `GetParcel` ya está versionado, y **no se copia a esta
carpeta**: es [`../gml/cp_parcela_9398516VK3799G.gml`](../gml/cp_parcela_9398516VK3799G.gml),
con su procedencia en [`../gml/PROCEDENCIA.md`](../gml/PROCEDENCIA.md). Es la respuesta real del
WFS para la referencia `9398516VK3799G` y sigue siendo la fuente de verdad de los números y del
perfil `WFS` del serializador.

Un fixture duplicado es dos fixtures que se pueden desincronizar. Hay uno.

## Sobre los finales de línea

Los cinco `.xml` se descargaron con **CRLF** y aquí están con **LF**, normalizados por
`.gitattributes` (`test/fixtures/catastro/*.xml text eol=lf`). Se dan arriba los dos tamaños y
los dos SHA-256 para poder comprobar la descarga byte a byte:

| Fichero | Descargado (CRLF) | Aquí (LF) |
|---|---|---|
| `wfs-exceptionreport-rc-inexistente.xml` | 333 B | 327 B |
| `wfs-neighbour-9398516VK3799G.xml` | 11.969 B | 11.780 B |
| `wfs-bbox-count10.xml` | 26.326 B | 25.952 B |
| `wfs-describestoredqueries.xml` | 6.925 B | 6.821 B |
| `wfs-bbox-vacio-mar.xml` | 313 B | 307 B |

SHA-256 de la versión LF, que es la que está en el repo:

| Fichero | SHA-256 (LF, en repo) |
|---|---|
| `wfs-exceptionreport-rc-inexistente.xml` | `8dd3fd17919a355b3cd0dd04ff160ba56540ec86b963347dc3d07c1eb42e9a7d` |
| `wfs-neighbour-9398516VK3799G.xml` | `8d9833a9364e452d9c17f0c85f9fcc7dfb6799c1a1fdb56d987b61a4b907eb54` |
| `wfs-bbox-count10.xml` | `5d065369419d245681bf7e0654c2b12b698d18dd0ab04f002fcd807f907e75bd` |
| `wfs-describestoredqueries.xml` | `5606b19b6b221ed428c67a258dd15735d569590c89f4299daea9832b30142049` |
| `wfs-bbox-vacio-mar.xml` | `cb83cbd6b9af9970c83c496c95f1f76a0fdb3544c7129dc1b04adaa7888dc6d4` |

Es lícito y no cambia nada del contenido: **XML 1.0 §2.11 obliga a todo procesador a normalizar
`\r\n` a `\n` antes de entregar el documento**, incluso dentro de `CDATA`. El infoset es
idéntico. Comprobado además que no había ningún `\r` suelto (CR = CRLF en los cinco ficheros),
así que la sustitución `\r\n → \n` es reversible sin pérdida.

Los **seis** `.json` **no tienen ni un salto de línea** —ni siquiera final—, así que la regla es
inocua para ellos y su SHA-256 es uno solo. Comprobado también en los tres de F09
(`ovc-dnprc-*`): cero `\r` y cero `\n` en los 6.817, 1.399 y 117 bytes, y los tres decodifican
como UTF-8 válido. Los dos `ovc-dnprc-*` de datos **sí llevan caracteres no ASCII** (`í`, `ó`,
`Í`), al contrario que los tres `ovc-rccoor-*` y que `ovc-dnprc-cod17.json`, que son ASCII puro;
y a diferencia de los `.xml` de esta carpeta, aquí no hay ninguna declaración de encoding que
pueda mentir: el JSON es UTF-8 por definición (RFC 8259 §8.1) y la cabecera HTTP lo confirma.

## Huecos declarados

Ninguno de estos casos se ha fabricado a mano, y ninguno se fabricará. Lo que falta, falta:

- **El `.asmx` de geocodificación no se ha medido.** La tabla de nombres de parámetro de
  `ovc-rccoor-cod76.json` da la columna del `.svc/json` como medida y la del `.asmx` como
  documental. Si F05 llega a usar el `.asmx` (hoy no está previsto), necesita su propia captura.
- **La caja BBOX sin `count` (539 parcelas, ~1,15 MB) no está versionada**, por tamaño. Su cifra
  clave —las 539— queda corroborada por el `numberMatched` de `wfs-bbox-count10.xml`.
- **No hay fixture de servicio caído** (5xx, timeout, DNS). No es capturable a voluntad sin
  provocarlo, y provocarlo es exactamente lo que la política de uso del Catastro sanciona con
  ~10 días de denegación. El camino de fallo de red se prueba con el `fetch` doblado, y eso
  queda dicho aquí para que nadie lo confunda con verdad externa: **no lo es**.
- **No hay fixture de bloqueo por abuso.** Mismo motivo, con más razón.

Y los que deja abiertos la tanda de F09 (2026-08-02):

- ~~La respuesta `cod:"17"` de `Consulta_DNPRC` no está versionada como fixture.~~ **CERRADO el
  2026-08-02 (T2.3)**, y sin gastar una petición: ver la ficha de
  [`ovc-dnprc-cod17.json`](#ovc-dnprc-cod17json--el-fallo-nuestro-contado-como-dato-que-falta). El
  fichero se escribió desde la transcripción literal que ya había en este documento y su SHA-256
  coincide con el publicado, que es la prueba de que la copia era fiel.
- **La `Consulta_RCCOOR` con la que se encontró la parcela rústica no está versionada.** Fue un
  medio para elegir el caso, no un caso; su cuerpo va literal en la ficha de la rústica.
- **No se ha medido `Consulta_DNPRC` sobre una rústica con VARIOS inmuebles**, o sea la
  combinación `lrcdnp` + rústica. Las dos capturas dan `lrcdnp`+urbana y `bico`+rústica, que son
  las dos diagonales: **queda sin comprobar si en la rama `lrcdnp` de una rústica aparece el
  subárbol `lors`**, que es la única vía que quedaría para saber que es rústica sin el `cn`.
  Habría sido otra petición y el override O8 manda.

  > **Lo que el cliente hace con este hueco**, escrito aquí porque es donde se busca:
  > `services/_catastro-dnp.js` deduce `datos.clase` **del subárbol presente** (`lors` → rústica,
  > `lous` → urbana) y, cuando no es concluyente, la deja en **`null`** — que el informe imprime
  > como “No consta”. No se adivina por la referencia catastral, no se hereda del `cn` (que en la
  > rama lista **no existe**) y no se rellena «porque casi siempre es urbana». El día que alguien
  > mida esta diagonal, se recaptura, se anota aquí y **entonces** se toca el código.
- **No se ha medido `Consulta_DNPRC` con una referencia inexistente**, ni con `Provincia`/
  `Municipio` rellenos, ni la variante `Consulta_DNPRC_Codigos`. Tampoco `Consulta_DNPPP`
  (consulta por polígono/parcela), que el WSDL declara y que sería el camino inverso al de la
  ficha rústica.

  > **Consecuencia MEDIBLE en el código, y es la más importante de esta lista:**
  > `services/_catastro-dnp.js` **no tiene ninguna tabla de códigos que signifiquen «no hay
  > datos»**, al contrario que su hermano `_catastro-ovc.js`, que sí tiene `COD_OVC_SIN_REFERENCIA`
  > porque midió el `cod:16`. Aquí no hay nada que medir todavía, así que no hay tabla, no hay un
  > tipo `SIN_DATOS`, y **`services/catastro.js#descriptivosPorRefcat` no puede devolver
  > `NO_ENCONTRADO`**: cualquier `cod` de error sale como `RESPUESTA_ILEGIBLE`, con el código y la
  > descripción literales del servicio dentro del mensaje. Escribir la tabla vacía «para tenerla»
  > sería un detector de una señal que nadie ha visto: o código muerto que tranquiliza, o un
  > disparo en falso. Hay tests que afirman las dos mitades.
- **No hay ninguna captura de `Consulta_DNPRC` con inmuebles que discrepen entre sí** (dos
  municipios en la misma parcela). No es provocable: depende de que exista una parcela así y de
  encontrarla. El caso se cubre con un fixture **sintético**, en
  [`derivados/`](derivados/PROCEDENCIA.md), que es un directorio aparte precisamente para que
  nadie lo confunda con esto y para que su URL —que no existe— no entre en el mapa de URL medidas
  que lee `scripts/sonda-catastro.mjs`.
- **Ninguna petición de esta carpeta ha llevado nunca cabecera `Origin`.** Ver el matiz sobre el
  CORS en los hechos transversales: lo medido respalda la petición **simple**, no un
  *preflight*.
- **La metadata `?singleWsdl` no se versiona.** Se leyó para averiguar el nombre real del
  parámetro (`RefCat`) y para nada más; son ~100 kB de WSDL que no describen ningún
  comportamiento que estos fixtures no congelen ya. Reproducible en
  `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc?singleWsdl`.
