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

Los tres `.json` **no tienen ni un salto de línea** —ni siquiera final—, así que la regla es
inocua para ellos y su SHA-256 es uno solo.

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
