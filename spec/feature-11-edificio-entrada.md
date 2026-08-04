# F11 · Edificio: entrada y modelo

**Fase:** 11 · **Prioridad:** P11 (baja, capítulo posterior) · **Riesgo:** Medio ·
**Depende de:** F10 · **Habilita:** F12 (partes y plantas), F13 (GML de edificio),
F14 (contraste e informe de edificio).

~~**Ficheros:** `model/edificio.js`, entrada de edificio.~~
**Ficheros (2026-08-04, al terminar):** **once módulos nuevos** de producción y **doce
tocados** (+ `.gitattributes`), repartidos en seis capas — `edificio/` es un **directorio
nuevo** con cuatro ficheros y barrel propio, y entran además `gml/parse-bu.js`, dos de
`services/`, uno de `viewer/` y tres de `app/`. ⛔ **Y `model/edificio.js` NO SE TOCA**: está entero desde
F00 y esa es la mejor defensa que tiene la fase. Ver «Ficheros que la fase creó y tocó
de verdad».

> ⛔ **Esta spec se REESCRIBIÓ el 2026-08-04**, al cerrar la fase, para que diga lo que
> hay y no lo que se pensaba hacer. Lo que decía antes **no se borra**: se conserva
> tachado o citado al lado de lo medido, igual que en `SPEC.md` §3.1 y en las fichas de
> F05, F06, F07, F08, F09 y F10. Manda lo medido (regla de oro 8).

> **Cambio de mentalidad respecto a parcela.** El flujo de parcela *contrasta* una
> medición contra Catastro. El de edificio **produce un GML de construcción que valide
> en la Sede** (a menudo obra nueva sin nada registrado); el contraste es un paso
> opcional al final (F14). Recorrido: Entrada → Partes y plantas → Validación → Generar
> GML, con Contraste e Informe opcionales.

## Objetivo

Elegir modelo (simplificado/completo), traer la geometría por las mismas vías que
parcela ~~con **una polilínea = una parte**~~ **repartiéndola por capa y ofreciendo el
reparto (M2, M3)**, y capturar los atributos del edificio.

**Y una segunda cosa que la ficha original no decía y es la mitad de lo que la fase ha
resultado ser:** hasta aquí la aplicación **solo sabía de parcelas**. La rama EDIFICIO
existía en el modelo desde F00 y **no la llamaba nadie**; el panel se titulaba «Origen
de la parcela», el visor encuadraba sobre `parcela.recintos` y el pie generaba un GML de
parcela. F11 es donde la aplicación **estrena su segunda rama** y donde `parsers/dxf.js`
—en verde desde F01 y **sin un solo llamante en producción durante diez fases**— entra
por fin en el recorrido del usuario.

## Alcance

### Elección de modelo — primero de todo (§14.1)

- **Simplificado (unificado)** — solo geometría de huellas (edificio + piscinas) con
  atributos mínimos. Es el válido para el **ICUC**; el caso más frecuente.
- **Completo** — añade atributos semánticos (inmuebles, viviendas, superficie
  construida, uso, fechas).

Selector *«¿Qué necesitas generar?»* con una línea por opción. Si es **simplificado**,
~~**ocultar el bloque de atributos semánticos**~~ ⭐ **no existen ni el bloque ni el
botón que lo abriría — no están ocultos, no están (M8)**: solo geometría, RC y estado.
El caso frecuente debe ser el camino corto.

### Origen de la geometría (§14.2)

Mismas vías que parcela (la huella sale del CAD, no se teclea). **Son cinco, y las cinco
se alcanzan desde la interfaz:**

- **DXF (vía principal):** ~~**cada polilínea entra como una parte independiente**
  (vivienda, porche, garaje son polilíneas distintas)~~ ⛔ **CORREGIDO AL MEDIRLO (M2,
  M3): se lee la CAPA del dibujo (código de grupo 8) y se OFRECE el reparto.** Al pasar
  a Partes, la lista aparece poblada con una parte por polilínea **de las capas
  elegidas**, con nombres genéricos para renombrar.
- **Pegar LIST** · **cargar TXT** · **cargar GML de edificio existente** (⭐ soltándolo
  sobre la ventana: **conmuta la rama y se carga**, M14) · **traer del Catastro por RC**
  ~~(partes registradas de la capa `constru`)~~ ⛔ **la capa `constru` es RÁSTER; lo
  vectorial es `wfsBU.aspx` (M4)** como punto de partida editable.
- La **parcela de contexto** se mantiene si ya venía cargada, pero deja de ser la única
  fuente de geometría. Viaja como `edificio.parcelaContexto`, **nunca** como rama
  `parcela` del expediente (desviación 9).

### RC (§14.3)

~~Deducida del centroide de la huella~~ ⛔ **del `puntoInterior` de la parte de mayor
superficie (M5)** y editable (reutiliza F05/§7.3).

### Atributos del edificio — solo modelo completo (§14.4)

Del edificio en su conjunto, **no de cada parte:** uso dominante, estado de
conservación, año de construcción (referido al 1 de enero, el más antiguo si hay varios)
+ año de reforma, nº de inmuebles, nº de viviendas, superficie construida
(`grossFloorArea`). **Las plantas NO van aquí:** se asignan por parte en F12.

⛔ **Y no van en el panel: van a un `<dialog>` (M8).** Miden 370,56 px apilados y 150,00
px en su forma más densa editable, contra un presupuesto medido de **80 px**.

## Modelo (§4.2, §4.3, §23.3)

`Edificio { refcat, modelo, partes[], parcelaContexto, construccionOficial, + atributos
si COMPLETO }`; `ParteConstruccion { nombre, tipo:'PRINCIPAL'|'OTRA', recinto|null,
plantasSobreRasante|null, plantasBajoRasante|null, origen }`. Convenios: envolvente
**derivada** (no se guarda); ~~solo partes con volumen sobre rasante~~ ⛔ **el fixture
real lo contradice y manda el dato (M9)**; **plantas por parte, nunca del edificio**;
piscinas (`OTRA`) sin plantas (`null`, no `0`); nº inmuebles/viviendas del edificio.
POJO plano, anillos sin cerrar, sin huecos en partes.

## Las seis decisiones de la entrevista de arranque

| # | Decisión | Por qué, y qué costó |
|---|---|---|
| **D1** | **Selector de rama que INTERCAMBIA el panel** | El panel de edificio **sustituye** al de parcela, no se suma: **sexta fase seguida a coste 0 px** (M17). Es el «Entrada → Partes y plantas → Validación → Generar GML» del plan §13, y deja sitio a F12–F14. El mapa y el visor se comparten |
| **D2** | **Segundo store, independiente** | Los **once** suscriptores del store de parcela no se tocan ni una línea. Y es fiel al modelo: `crearExpediente` ya prohíbe llevar las dos ramas a la vez (`model/parcela.js:284-289`), así que dos stores separados no son un atajo, son el diseño. Por dentro es `crearEstadoVista`, que es un closure: estado, suscriptores y guarda anti-reentrada son **por instancia** |
| **D3** | **Las partes SE PINTAN en el mapa** + lista de solo lectura para renombrar | El criterio 2 se verifica con los ojos y no solo en un test — la lección de F03 fase 4 y de F08. Plantas, tipo `PRINCIPAL`/`OTRA`, dibujo y envolvente derivada se quedan en F12 |
| **D4** | ~~**La entrada DXF se cablea para LAS DOS ramas**~~ ⛔ **se cablea para UNA (M27)** | `app/zona-fichero.js` es genérico a propósito y ya enruta por extensión, y `.dxf`/`.txt` entran. Pero **el destino es la rama EDIFICIO y solo ésa**: la asimetría que F10 dejó escrita —la app **escribe** un DXF que no sabe reabrir **como parcela**— queda cerrada **a medias**, y se dice al soltarlo en vez de callarse. Ver **M27** |
| **D5** | ⛔ **Se lee la CAPA del DXF y se OFRECE el reparto** | Ver **M2** y **M3**. «Una polilínea = una parte» al pie de la letra produce **25 partes** en el único plano real del repo, dieciséis de ellas mobiliario de dibujo; y **elegir la capa por su nombre falla en ese mismo plano** |
| **D6** | **La vía del Catastro entra CONDICIONADA a la medición** | Veredicto de la fase 0: **se cabla**. Ver **M4**. Precedente literal: en F05 `GetParcelsByBBox` no existía y la vía se recortó; aquí las *stored queries* existen, **y hay dos más de las que el dossier documenta** |

**Y una que hereda:** la **firma humana** se sigue acumulando. F11 añade su §12 al
checklist y la cadena pasa a ser F03→F05→F06→F07→F08→F09→F10→**F11**.

## ⛔ Lo que la implementación MIDIÓ y esta spec (o el plan de la fase) decía de otra forma (2026-08-03/04)

Todo lo de esta tabla está comprobado en el código y fijado por un test, salvo donde se
diga que la medición es de servicio real, de navegador o de un oráculo externo. Manda lo
medido (regla de oro 8).

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M1** | **Ficheros: `model/edificio.js`, entrada edificio** | **Once módulos nuevos de producción y doce tocados**, en seis capas. `edificio/` es un **directorio nuevo** con barrel propio, que entra en el barrel raíz como espacio **`entradaEdificio`** —no `edificio`: ese nombre ya lo ocupa `model/edificio.js` en `index.js:28`, y renombrarlo da `SyntaxError: Duplicate export of 'edificio'` al cargar—. Y ⛔ **`model/edificio.js` NO se toca**: sus 300 líneas y sus 334 de test llevan diez fases en verde. Ver «Ficheros» |
| **M2** | *«Cada polilínea entra como una parte independiente (vivienda, porche, garaje son polilíneas distintas)»* | ⛔ **NO SE APLICA A LA LETRA, y aplicarlo rompe la regla de oro 1.** Medido sobre `test/fixtures/parsers/UTM.dxf`: **25 polilíneas en 5 capas** — `FINO` **16** (cajetín, marco y leyenda), `LINDE` 4, `PARCELA` 3, `BLANCO` 1 y la capa `0` **1**. Al pie de la letra salen **25 partes**, dieciséis de ellas mobiliario de dibujo, y el recuento saldría mal **y en silencio**. El discriminante estaba **en el fichero** —el código de grupo 8— y `parsers/dxf.js` lo tiraba desde F01. Ahora lo devuelve (`capas[]`, en paralelo a `anillos[]`, **literal y sin bajar a minúsculas**: el usuario reconoce sus nombres de capa) y la interfaz **ofrece** el reparto en un `<dialog>` en vez de adivinarlo. ⚠️ El oráculo de la medición estuvo mal hasta acotarlo a `ENTITIES`: contaba **40** polilíneas porque `BLOCKS` trae el cajetín en la capa `0` |
| **M3** | *(no previsto — el plan defendía D5 por prudencia)* | ⛔⭐ **Y hay un argumento MÁS FUERTE que la prudencia: en `UTM.dxf` la parcela de verdad está en la capa `0`, NO en la llamada `PARCELA`.** El anillo de la capa `0` (11 vértices, **61,05 m²**) comparte **12 de 12 vértices con `PARCELA.txt`**, que es la verdad externa de al lado desde F01. La capa literalmente llamada `PARCELA` contiene **otros tres** anillos (107,9 / 65,7 / 71,3 m²). **Elegir la capa por su nombre falla en el único plano real que tenemos**, así que ofrecer no es prudencia: es lo que el dato exige |
| **M4** | *«traer del Catastro por RC (partes registradas de la capa `constru`)»* | ⛔ **`constru` es una capa RÁSTER del WMS** (`viewer/wms-catastro.js:176`): de ahí salen **píxeles**, no geometría. Lo vectorial es **`wfsBU.aspx`**, que `services/_catastro-wfs.js` no conocía y cuya URL **no estaba anotada en ninguna parte del repo** —el plan decía que estaba en los `xlink:href` de los fixtures BU y **no está**: apuntan a `wfsAD.aspx` y `wfsCP.aspx`—. Sondeado el 2026-08-03 con siete peticiones en una pasada: el catálogo publica **CINCO** *stored queries* y el dossier documenta **tres**. ⭐ La que faltaba y la que importa es **`GetAllConstructionByParcel`**, que devuelve `Building` **y** `OtherConstruction` de una vez ⇒ **2 peticiones por edificio** (`GetAllConstruction` + `GetBuildingPart`), no 3. ⛔ Y la quinta, `GetFeatureById`, **no se pide por `REFCAT`**: el catálogo declara `ID` y `SRSNAME`, así que construirla con `refcat=` daría un **404 mudo indistinguible de «esa RC no existe»**. Está declarada con su porqué y **no se construye** |
| **M5** | Criterio 3: *«La RC se deduce del centroide de la huella»* | ⛔ **NO es el centroide, y no es un descuido: es una corrección medida y ya escrita en el repo.** `app/cableado-catastro.js:133-141` lleva desde F05 que **el centroide aritmético de una parcela en L cae FUERA del polígono** y que el Catastro, sin forma de saberlo, contesta con la referencia de la **vecina** — un dato mal, en silencio. Se usa `gml/anillos.js#puntoInterior` sobre **la parte de mayor superficie**, pasada como array de UN recinto (`validarRecintos` exige `recintos[0]` EXTERIOR y el resto HUECO) y **descartando sus detecciones**, cuyo texto habla de `cp:referencePoint` y aquí mentiría. El criterio se cumple **en su intención** —RC deducida de la huella y editable— y no en su letra |
| **M6** | Lección de F05, citada en el plan: *«todo error del Catastro llega con HTTP 200 y `response.ok` no clasifica nada»* | ⛔⛔ **En `wfsBU` es AL REVÉS.** Medido: una RC inexistente devuelve **`302 Found` → `/OVCError.aspx` → `404`** con HTML de ASP.NET. `fetch` sigue el redirect, así que la app recibe un 404 y **aquí `response.ok` SÍ clasifica**. Un cliente escrito con F05 en la cabeza intentaría parsear como GML una página de error. ⛔ Y **cero `ExceptionReport` en las siete respuestas**: no hay OWS 1.1, ni `exceptionCode`, ni `CDATA` — todo el aparato de `services/_catastro-wfs.js` **no aplica**. Precio, dicho y no adivinado: **el 404 es MUDO**, «RC inexistente» y «URL mal construida» no se distinguen. ⚠️ Y el `Content-Type` es `application/x-unknown`: un cliente que decidiera si parsear mirándolo no parsearía nada |
| **M7** | `_catastro-wfs.js` congela que **«no existe la colección vacía»** (override **O14**) | ⛔ **En `wfsBU` SÍ EXISTE: `200 OK` + `gml:FeatureCollection` con CERO `featureMember`.** Y **es el punto de partida de la obra nueva, no un error** — que es el caso frecuente de este flujo. ⇒ la clasificación sale de **cinco estados sin analizar ni un texto libre**, más limpio que cualquier otro endpoint que este proyecto haya medido. ⛔ **Pero la colección vacía no tiene discriminante de dialecto y el sobre de parcela es IDÉNTICO**: `gml/_comun.js#clasificarDialecto` distingue por el namespace del elemento de feature, y un documento sin miembros no tiene ninguno (medido: `DESCONOCIDO`); y el GML de parcela de **ENTREGA** tiene la misma raíz y el mismo contenedor. Un módulo que reconociera la colección BU solo por la raíz **leería una colección de parcelas vacía como «esta parcela no tiene nada construido»**. El único discriminante medido es el `gml:id` de la raíz: **`ES.SDGC.BU`**, idéntico en los cinco documentos BU del repo (dos tandas, seis días de diferencia), frente a `ES.SDGC.CP`. Exportado como `ID_COLECCION_BU`. ⚠️ **El solar sin construcción NO se midió**: dos apuestas de RC fallaron y, en vez de seguir adivinando, se midió el discriminante que hacía falta —cómo se dice el vacío— sobre una parcela conocida. Que un solar conteste igual es **inferencia razonable, no medición** |
| **M8** | Criterio 1: *«el selector OCULTA los atributos semánticos en modo simplificado»*, con el bloque en el panel | ⛔⛔ **NO CABEN EN EL PANEL, en ninguna maqueta.** Medido en navegador a 1440×900: los siete atributos miden **370,56 px** apilados y **150,00 px** en su forma más densa editable (etiqueta en línea + 2 columnas), contra un presupuesto de **80 px** con la ficha del pie recortada a 4 pares —y de **4 px** con la de hoy—. Y con la maqueta apilada **la lista de avisos también se aplasta**: `#avisos` queda en 0 px de contenido aunque tenga 12 tarjetas dentro; el desastre de F06 repetido, con dos víctimas. Salen a un `<dialog>`, con los tres precedentes de la casa (F06 llevó la edición a una barra, F07 el diagnóstico a un cajón, F09 el informe a un modal). ⭐ **El criterio 1 se cumple igual, y MEJOR: en SIMPLIFICADO no existen ni el bloque ni el botón que lo abre — no están ocultos, no están.** Y la lista de partes recupera **225,22 px** |
| **M9** | §Modelo: *«solo partes con volumen sobre rasante»* | ⛔ **El fixture real lo contradice: `part10` tiene `numberOfFloorsAboveGround = 0` y `numberOfFloorsBelowGround = 1`** — una parte **solo bajo rasante**. **Manda el dato** (regla de oro 8): entra marcada con su detección (`PARTE_BAJO_RASANTE`), no se descarta ni se calla. ⭐ Y **las trece partes traen las dos plantas, no solo `part10`** (`↑[1,7,7,6,7,6,7,6,6,0,6,6,6]` · `↓[0,0,1,0,1,0,1,1,1,1,1,1,1]`): F11 las declara `null` **por alcance declarado**, pero `gml/parse-bu.js` las devuelve crudas para que F12 no tenga que reabrir el lector. ⛔ Y **`heightBelowGround` no es exclusivo de `part10`**: lo traen **9 de 13** |
| **M10** | Los dos fixtures BU de F00 como única verdad del dialecto | ⭐⛔ **La parcela de referencia del proyecto TIENE UNA PISCINA, y no estaba en ningún fixture.** `OtherConstruction`, `constructionNature = openAirPool`, `gml:id` con sufijo `_PI.1`. Y muerde: **su geometría es `gml:Polygon` DIRECTO** (`exterior/LinearRing/posList`), **no** `Surface/patches/PolygonPatch`, y el contenedor es **`bu-ext2d:geometry`**. Un lector escrito solo contra los fixtures de julio **se pierde la piscina entera, en silencio** — y «vivienda + porche + **piscina**» es el enunciado literal de §14.2. De ahí `otras[]` en el contrato del lector. ⛔ Y **la RC no está en las partes ni en la piscina**: `bu-core2d:reference` solo existe en el `Building`; sale del `refcat=` del `xlink:href` de `cadastralParcels`, y **cortar el `localId` falla con `_PI.1`** |
| **M11** | *(no previsto)* | ⚠️⛔ **Trampa de namespace que habría roto el lector en silencio: las plantas y los atributos semánticos viven en `bu-ext2d`, NO en `bu-core2d`.** Son `numberOfFloorsAboveGround`, `numberOfFloorsBelowGround`, `heightBelowGround`, `currentUse`, `numberOfBuildingUnits`, `numberOfDwellings` y `officialArea`. En `bu-core2d` van `conditionOfConstruction`, `dateOfConstruction`, `inspireId`, `externalReference` y las lifespan. **Buscarlos donde no están devuelve `null` en las trece partes y `part10` parece normal** — o sea que M9 desaparecería sin que nada fallara |
| **M12** | Los `count` de `gml:posList` citados por el plan como número de vértices (`[5,11,16,…]`) | ⛔ **Son los anillos CERRADOS: `count` incluye el punto de cierre.** El modelo guarda el anillo **abierto** (regla de oro 4), así que el lector devuelve `[4,10,15,…]` y el `Building` da `[4,52]`. ⛔ Y **hay N `gml:PolygonPatch` por `gml:Surface`**: el `Building` del fixture trae **dos** (`count` 5 y 53) y asumir uno **pierde 53 de 58 puntos**; el otro `Building` real trae **uno**, así que «2 patches» no es constante del dialecto. ⛔ Y **`numberOfFloorsAboveGround` del `Building` es `xsi:nil`** ⇒ `null`, que el contrato admite **sin confundirlo con «ausente»** |
| **M13** | *(no previsto — no estaba en el alcance de la fase)* | ⛔⛔⭐ **F11 arregla un defecto VIVO de `parsers/importar.js`: construía parcelas de superficie NEGATIVA sin un solo bloqueo.** Medido: **nuestro propio DXF de dos capas → −100,00 m²** (la real es 1.500,00) y **`UTM.dxf` → −390,45 m²** (la real es 61,05), las dos veces con **`bloqueos: []` y `construida: true`**. La causa está en `parsers/importar.js:455-459`: `recintos[0]` es EXTERIOR y **todo lo demás HUECO**. Sin geometría oficial el mismo camino salía bien; lo rompía la segunda capa, que es justo la que **F10 estrenó al escribir DXF**. Es la regla de oro 1 en su forma más pura, y cablear la entrada DXF sin arreglarlo habría sido publicar un error silencioso. ⇒ `resumen.bloqueos` pasa de tres códigos a **CINCO**, con los dos nuevos agrupados en `BLOQUEOS_SOLO_PARCELA = ['ANILLOS_EN_VARIAS_CAPAS', 'SUPERFICIE_NO_POSITIVA']`. ⚠️ **Y hay que filtrarlos en la rama edificio**: un DXF de vivienda + porche + piscina —**el caso normal de esta fase**— viene por definición de varias capas y saldría bloqueado por el arreglo que protege a la otra rama |
| **M14** | `feature-08-comprobar-gml.md`, criterio 4: *«el GML de edificio se detiene con honradez, pero encaminarlo exige F14»* — **declarado «a medias»** | ⭐ **CERRADO, y sin esperar a F14.** Un GML de edificio soltado sobre la ventana **conmuta la rama y se carga**. El desvío es por **CONTENIDO** (`dialecto.id === DIALECTO.BU`), no por extensión —que es lo que lo distingue de `entradasExtra`, cuyo `.gml`/`.xml` ya lo reclama `cablearComprobacion` y que **lanza** si una extensión está tomada—; el cajón de parcela no se abre, y `comprobacion()` **se SUELTA**: si no, el informe de F09 citaría un edificio como procedencia de una parcela. `cablearComprobacion` **no sabe que existen las ramas**: entrega el `File` y `app/main.js` decide. ⛔ **Y el ensamblaje destapó un `ReferenceError` que la suite del propio módulo NO PODÍA VER**: el desvío se escribió con `DIALECTO` sin importar, y `test/app/comprobacion.dom.test.js` seguía **verde** porque con el desvío en `null` —el montaje de toda F08— el `&&` corta antes de evaluarlo. **Un guardián que no ejercita la rama nueva no es un guardián**: esa suite estrena seis `it` con el desvío puesto |
| **M15** | «Cómo se comprueba que está hecho», punto 3 del plan: *«Si la fase pasa de ~25 kB, algo se está reimplementando y hay que parar»* | ⛔⛔ **SE PASÓ POR 4,7×, se paró, y NO era reimplementación.** El paquete va de **736,16 kB** a **858,43 kB** de JS: **+122,27 kB**. Medido por *sourcemap*, módulo a módulo sobre la construcción del cierre de la fase 4 (857,48 kB): los diez módulos nuevos que entran en el paquete suman **89,09 kB** y el resto es el crecimiento de los tocados. **Cero dependencias nuevas** — `package.json` **no cambió en toda la fase**, verificado con `git diff`, y la atribución lo confirma por el otro lado: en `node_modules` solo aparecen Leaflet (150,02 kB), `bignumber.js` y `polyclip-ts` con sus transitivas, todas de antes. Y la tasa es **la de la casa**: **8,9 kB/módulo**, frente a los 9,8 de F08 (7 módulos, +68,38 kB). ⇒ **La cifra mal puesta era el presupuesto, no el código**: se estimó cuando nadie sabía que F11 iban a ser once módulos y ~9.000 líneas. El techo razonable para una fase de este tamaño es ~90 kB. ⚠️ **Y la consecuencia se dice sin maquillar: con 857,48 kB, la deuda de partir el paquete (F16) deja de ser teórica** |
| **M16** | Instrucción del plan al CSS: *«poner `flex-wrap: nowrap` en `.gml-chips`»* para que el conmutador no salte de línea | ⛔⭐ **`nowrap` NO arregla el problema: lo hace INVISIBLE.** Medido: con `nowrap` la fila se queda en 25,39 px y la tabla intacta, **pero el elemento se sale 102,53 px del panel** y `.gml-panel` tiene `overflow: hidden` ⇒ **se recorta en silencio**. Con `wrap` el fallo al menos se ve. Se deja `wrap` y **el guardián es de ANCHO** (`saltoDeLinea === false` **y** `holguraPx > 24`), en el guion de navegador |
| **M17** | *«una fila nueva a lo ancho del panel cuesta 36 px»* (la cifra de F07) | ⛔ **En la CABECERA son 28,31 px** para la tabla de vértices (y 4,07 px para los avisos). Los ~36 px son de una fila en el bloque «Origen de la parcela», con su margen. Sigue siendo inasumible; **la cifra buena es 28,31**. ✅ **Y por eso el conmutador NO va en una fila nueva: va DENTRO de `.gml-chips`**, dos `.gml-boton--menudo` con `gap: 4px` que miden **116,17 px de los 169,28 libres** ⇒ **46,11 px de holgura**. Cabecera 117,13 → 117,13. Caja de vértices **267,44 → 267,44**. **F11 es la sexta fase seguida a coste 0 px.** Descartados con número: fila nueva en la cabecera (**−28,31 px**), un tercer botón en `.gml-rotulo-acciones` (**−13,94 px**) y dos `.gml-chip` (holgura **0,65 px**, que no es caber: es tener suerte). ⭐ **Regalo medido y gratis:** `.gml-chips` no declara `align-items`, así que el conmutador se estira a los 25,39 px de la fila; el objetivo de pulsación pasa de 15 a ~25 px —**WCAG 2.5.8 pide 24**— sin costar un píxel |
| **M18** | *(no previsto)* | ⛔ **El intercambio de ramas tiene que ser por VISIBILIDAD, y no es una preferencia de estilo: está medido.** Con `hidden`: mismo nodo, `isConnected: true`, conserva su valor, **sus oyentes siguen disparando**, y la tabla vuelve exacta a 267,44 px. Con `replaceChildren`: la referencia queda **huérfana, escribible y muda** — `isConnected: false`, escribir en ella **no lanza**, sus oyentes **siguen disparando**, y la RC recién traída del Catastro se escribe en un nodo que no está en el documento **mientras el usuario ve el campo vacío**. Superficie del riesgo, contada: **30 nodos resueltos una sola vez con `nodo(...)` en `app/`**. ⭐ **Y el corolario que obliga al contrato de marcado: con las dos ramas en el DOM, `document.querySelector('[data-campo="refcat"]')` devuelve SIEMPRE el de parcela**, también **cuando la sección de parcela está `hidden`**, porque manda el orden del documento. **Ningún `data-*` puede repetirse entre las dos ramas** — de ahí `refcat-edificio` y no `refcat` a secas |
| **M19** | El contrato de marcado: *«se intercambian dos `<section>`»*, leído como una por rama | ⛔ **La rama PARCELA son DOS `<section>`** (`.gml-bloque--catastro` y `.gml-bloque--vertices`) **y las de EDIFICIO son otras dos**: el intercambio es de **N secciones por rama**. La cuenta de altura solo cierra si `.gml-bloque--vertices` **también** se oculta (267,44 − 42,07 = 225,37), porque `.gml-bloque--partes` **sustituye** a la caja de vértices como estirador y **dos estiradores a la vez descosen el panel**. ⛔⛔ **Y una costura que NINGÚN contrato asignó:** `app/rama.js` **descubre** las secciones de edificio por `data-rama-panel` y **marca él mismo** las de parcela —`index.html` no las trae—, pero `app/panel-edificio.js` **no escribía ese atributo**: exponía sus raíces para que las sellara quien las montara. Verificado por grep: **cero menciones de `data-rama-panel` fuera de `app/rama.js`** ⇒ **la rama edificio no se habría mostrado nunca**. La asume `app/cableado-edificio.js` al montar el panel. ⛔ Y **`rama.js` solo repartía visibilidad AL CONMUTAR**: un panel montado *después* de `cablearRama` —el orden natural en `app/main.js`— se quedaba **visible encima del panel de parcela** hasta la primera pulsación. Se fija el `hidden` al montar. ⛔ Y **los dos `<dialog>` NO se sellan**: un `<dialog open hidden>` es un diálogo que se abre y no se ve |
| **M20** | El plan prescribía el **singular**: `opts.capa` (una capa elegida) | ⛔ **El diálogo ofrece N y la entrada aceptaba UNA.** `app/panel-edificio.js` pinta **una casilla por capa** y devuelve un array; `edificio/entrada.js` y `parsers/importar.js` tomaban `opts.capa` **string** y **lanzaban** con otra cosa. Resuelto en `entradaPorCapas(texto, elegidas, comunes)`, con dos correcciones que si no serían **mentiras medibles**: el reparto de `importar` dice «se importa **SOLO** la capa A» —falso en el conjunto— y un `CAPA_DXF_DESCARTADA` de la pasada de A **anunciaría como descartada la capa B, que sí entró**. Y **las partes se renumeran**, o dos capas dan dos «Parte 1» |
| **M21** | El plan pedía que `entradaDesdeGmlBu` y `entradaDesdeWfsBu` produjeran **un `Edificio` idéntico** | ⛔ **NO lo producen, y DEBEN no producirlo.** El test los diffea campo a campo: difieren **exactamente 26 rutas** (13 partes + 13 de `construccionOficial`) y **todas son `.origen`** (`GML_EXISTENTE` frente a `WFS`), que es justo lo que el modelo existe para distinguir. Las detecciones sí son idénticas y en el mismo orden. ⛔ **Y la huella del `Building` NO entra como parte**: es la **envolvente INSPIRE** (unión de las partes), y guardarla sería guardar la envolvente con otro nombre —lo que §23.3 prohíbe— **y contar su superficie dos veces**. Consecuencia medida y aceptada: `bu_building_*.gml` **a solas** sale con **0 partes y `SIN_CONSTRUCCION`**, nombrando `GetBuildingPartByParcel`. ⭐ **Y `construccionOficial` se rellena en las vías BU**, cosa que el encargo no pedía: la geometría del Catastro **es** la oficial, `crearEdificio` la copia y la congela (regla de oro 2), y **si no se guarda aquí no la guarda nadie**. En DXF/LIST/TXT queda `null`: eso es la medición del técnico. ⛔ **Y el cotejo de referencia catastral entre los dos documentos tiene que ser «TODAS», no «alguna»** — lo cazó un test, no el programador: con `GetAllConstruction` de la parcela A y `GetBuildingPart` de la B, un «que alguna case» **pasa** y produce **un edificio inexistente: la envolvente de una parcela con las partes de otra** |
| **M22** | *(no previsto)* | ⚠️ **`services/catastro.js#destruir` ABORTA EL TRANSPORTE COMPARTIDO, y su propia cabecera ya lo había anticipado**: *«si algún día hiciera falta compartir un transporte entre dos clientes, esto habría que revisarlo»*. **Ese día es F11.** `crearClienteEdificio.destruir()` solo se apaga a sí mismo, pero **la asimetría contraria sigue viva**: `crearClienteCatastro.destruir()` **sí** aborta el transporte y a partir de ahí el cliente de edificio devuelve `CANCELADA` **sin que nadie lo haya destruido**. Las dos direcciones están ancladas en sendos `it`. **El orden de apagado importa: primero el edificio, el cliente de parcela el último.** ⚠️ Hoy no muerde porque **este arranque no desmonta nada** (no hay `destruir()` de la aplicación ni `import.meta.hot.dispose`), y se dice en vez de callarse. ⛔ **Y `STOREDQUERIE_ID` lo usan LOS DOS endpoints**: enrutar por ese parámetro manda las peticiones de parcela a la rama de edificio. ⛔ **Y el 404 llega acompañado de un aviso del transporte que dice otra cosa**: `services/_red.js#fallar` emite «el servidor dice que **esa dirección no existe**» — habla de una dirección web cuando el usuario ha escrito una referencia catastral. No se arregla sin tocar `_red.js`; **el renglón bueno es `resultado.mensaje`, no el canal de avisos** |
| **M23** | `test/report/literal.test.js`, guardián de vocabulario de F09: `/\bdeberá\b/i` | ⛔ **ENTRADA MUERTA, y al revés de como se lee.** `\b` se define sobre `\w = [A-Za-z0-9_]`, así que la frontera de la derecha cae detrás de una `á`, que **no** es `\w`: para casar, ahí tendría que venir un carácter que sí lo fuera. O sea que el patrón **rechazaba «deberán» y dejaba pasar «deberá»**, justo la forma que se quiere prohibir. Medido sobre los **72** patrones con `\b` del repo: **era el único roto** —`válido`, `semáforo`, `erróneo` y `vía pública` tienen fronteras ASCII y funcionan—. **No tapaba nada**: `report/literal.js` no emite «deberá» en ningún sitio, y **la entrada sigue verde ahora que de verdad mira** (`test/report/literal.test.js`, 74 pruebas, y la suite entera el 2026-08-04). ⚠️ La otra mitad del fichero —la anti-vacuidad que exige que cada regex cace un cebo— **solo vigila la lista `VEREDICTO`**, y ésta va en una lista suelta dentro de otro `it`. Corregido a `(?<!\p{L})deberá(?!\p{L})` con bandera `u` |
| **M24** | *(no previsto — es la lección de método de la fase)* | ⛔⛔ **Un guardián puede salir VERDE con la mutación puesta, y en esta fase pasó CUATRO veces.** (a) **`visor.edicion` frente a `visor.barraEdicion` no es observable desde el comportamiento**: el `try` que envuelve `getContainer()` se traga el `TypeError`, así que «no lanza» pasaba igual — hay que **contar accesos a la propiedad**. (b) **`destruir()` sin dar de baja los oyentes se comporta igual**, porque todos los manejadores empiezan por `if (destruido) return`: la prueba medía **la bandera, no la baja** — hace falta intervenir `addEventListener` (o llevar un **parte de altas y bajas**), y **la fuga era real: los dos CTA del pie sobrevivían al módulo**. Apareció en T2.4, en T3.2 y en T3.3. (c) La guarda de `previsualizarMedidas` —el canal EN VIVO del arrastre, que con la rama EDIFICIO escribiría la superficie de la **parcela** en la línea que enseña la del **edificio**— **no tenía ni un test**. **Mutaciones de la fase: 13/13 rojas en T3.3 · 11 rojas y 1 verde en T3.2 · 16 rojas, 1 verde y 1 equivalente declarada en T4.1 · 1 de 5.573 en T3.1.** ⛔ **Y la trampa del `<body>` mordió a los TRES ficheros de ensamblaje a la vez**: `document.body.innerHTML = <body de index.html>` copia lo de DENTRO y **nada de la etiqueta de apertura**, así que sin la clase `gml-app` **`cablearRama` LANZA**. Los tres leen ahora también la CLASE del fichero real. ⛔⭐ **Y una segunda, peor porque es genérica: los tres dobles de `viewer/index.js` eran objetos literales de UNA clave**, lo que convierte **cualquier export nuevo del visor** en un fallo de importación de esos ficheros (pasó con `encuadrarSobreRecintos`). Los tres parten ahora del módulo real con `importOriginal`. **Deuda cerrada para siempre**, no solo para F11 |

### Y tres más: dos que salieron gratis y una de alcance

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M25** | La ficha del pie | ⭐ **Es la mayor palanca de altura de la fase**: 8 pares × 31,88 px = **148,50 px**, y **cinco de sus ocho rótulos hablan de la parcela**. En la rama EDIFICIO pasa de **OCHO pares a CUATRO** —se ocultan `<dt>` **y** `<dd>` de Perímetro, Superficie catastral, Δ catastral y Colindantes—, lo que **libera 75,75 px**. Y los dos que se quedan **cambian de PREGUNTA**: «Vértices» ⇢ **«Partes»** y «Superficie» ⇢ **«Superficie en planta»**. Lo segundo no es cosmética: la superficie **construida** es un atributo declarado del modelo COMPLETO (`grossFloorArea`) y en tres plantas es el triple; llamarlas igual invitaría a compararlas. Y una parte **sin contorno** se cuenta en el renglón («2 (1 sin contorno)») en vez de dejar una suma incompleta con pinta de completa |
| **M26** | El paso 13 de `app/main.js` | ⛔ **SE ENSAMBLA ANTES QUE EL 12, y es la única inversión de la lista.** `cablearExpediente` **se suscribe** al conmutador (`rama.subscribe`), así que la rama tiene que existir cuando él se monta. No se renumeró nada: el paso 12 sigue siendo **el último en ejecutarse** —que es lo que su propio apartado afirma— y F11 se cuela delante. Tiene su `it` |
| **M27** | Decisión 4: *«la entrada DXF se cablea para LAS DOS ramas»*, y con ella *«cierra la asimetría que F10 dejó escrita»* | ⛔ **SE CABLEA PARA UNA, y la asimetría queda cerrada A MEDIAS.** Verificado en `app/main.js`: `.dxf`/`.txt` entran por `entradasExtra` con **resolución tardía** por la rama activa, pero con la rama PARCELA puesta **no hay a quién dárselo** y sale `MENSAJE_DIBUJO_EN_PARCELA` —AVISO, no ERROR—, que dice que ese dibujo entra como partes de un edificio, cómo llegar ahí, y que **reabrirlo como parcela «todavía no está»**. La otra mitad —recuperar la geometría oficial de nuestro propio DXF al reabrirlo como parcela— era una pregunta explícita de la fase 0 y **la respuesta fue «no en esta fase»**. Lo que **sí** está cerrado es el LECTOR: `parsers/dxf.js` devuelve los literales de capa 1:1 y `parsers/importar.js` ya no calla una superficie negativa (**M13**). ⚠️ **Y hay un comentario de producción que se lee de más**: el bloque de `app/main.js:2618-2621` dice «Aquí deja de tenerla» hablando de la asimetría, y **cuatro líneas más abajo su propio comentario la acota bien**. El código hace lo correcto; el rótulo de arriba promete un poco más que el de abajo. **Descrito y no arreglado**, porque F11 · T5.3 no toca producción |

### Y tres más, que no salieron de ningún test: las destapó EJECUTAR EL GUION EN UN NAVEGADOR

Las dos primeras son defectos de producción reales, con la suite **en verde** y con
5.700 pruebas afirmando —correctamente— el comportamiento de cada pieza por separado.
El guion `13-edificio.js` salió **`ok: false` con cuatro problemas** en su primera
corrida; hicieron falta **tres corridas** (4 → 3 → **1** problema) y las tres están en
`GUION.md` §19, que no se borran.

| # | Esto pasaba | ✅ Corregido |
|---|---|---|
| **M28** | ⛔ **LA APLICACIÓN SE CONTRADECÍA A SÍ MISMA AL CARGAR UN EDIFICIO.** El panel decía «Cargadas **7 partes**… 62 vértices en total» y **a la vez** entraba una tarjeta diciendo «El contorno menos los huecos da **−13,32 m²**… **No se construye la parcela**». Las dos frases eran **ciertas por separado**, y juntas son un error silencioso al revés: el usuario no sabe cuál de las dos creerse | La causa es de reparto: `edificio/entrada.js` filtraba los **BLOQUEOS** de parcela con `BLOQUEOS_SOLO_PARCELA` (contrato B) **y reenviaba sus DETECCIONES**, que es **la mitad que el usuario LEE**. Arreglado **en el origen y no en el consumidor**: `parsers/importar.js` marca esas detecciones con **`datos.bloqueo`** —el código al que acompañan— y exporta **`sinDeteccionesDeParcela()`**, de modo que el filtro tiene ya **dos mitades con la misma lista publicada**. ⛔ **No se filtra por `tipo`**: `SEPARADOR_POLIGONO` lo comparte con el mensaje del reparto por capas, **que el edificio sí necesita**. Ni por texto, que es lo único de una detección que se puede reescribir sin avisar. ⛔ **Y la suite estaba VERDE defendiendo el defecto**: había un `it` que exigía literalmente «arrastra **TODAS** las detecciones de `importar`, **sin tocarlas**» — la contradicción no era un descuido, **estaba probada** |
| **M29** | ⛔⛔ **EL PANEL DE LA RAMA EDIFICIO NO CABÍA, y se llevó por delante el CTA.** Medido: **947,54 px de contenido en un panel de 900** ⇒ **47,54 px de sobresuscripción en vacío y 114,91 con 7 partes**, que `.gml-panel` **recortaba en silencio** con su `overflow: hidden` (48 y 115 px). Consecuencias contadas: `.gml-partes` medía **2,00 px**, `#avisos` **0,00 px con 4 tarjetas dentro**, y **«Diagnosticar encaje» y su motivo quedaban FUERA DE LA PANTALLA, sin forma de llegar a ellos**. Es el desastre de F06 repetido, con dos víctimas — y **literalmente lo que T0.3·1 avisó** (**M8**) | Arreglado en dos tandas, y ⭐ **las tres palancas eran DUPLICACIONES, no recortes de honradez** — no se calla ni un hecho: **(1) Solo se enseña el apunte del modelo ELEGIDO** (`app/panel-edificio.js#pintarModelo`): el de la opción que no has elegido describe una decisión que no has tomado. `.gml-campo` 272,03 → **174,41 px** (**−97,62**). **(2) UN solo motivo para los dos CTA** (`app/rama.js#MOTIVO_CTA_EN_EDIFICIO`), porque **los dos se apagan por la MISMA causa** y decían dos veces lo mismo: va en el renglón del primero, el del segundo queda vacío, y el segundo botón se ata con **`aria-describedby`** al renglón que lleva el texto (`ID_MOTIVO_CTA`) para **no quedar mudo**. `.gml-acciones` 207,53 → **140,16 px** (**−67,37**). ⚠️ `MOTIVO_GENERAR_GML_EN_EDIFICIO` y `MOTIVO_DIAGNOSTICAR_EN_EDIFICIO` **siguen exportados y siguen siendo verdad**: son el motivo completo de cada botón y lo que se repondrá cuando el pie tenga sitio. **(3) `MENSAJE_SIN_AUTOGUARDADO` se enseñaba DOS VECES A LA VEZ**: entero y **permanente** en el renglón de procedencia **y** entero otra vez como tarjeta de avisos. Nuevo **`MENSAJE_SIN_AUTOGUARDADO_BREVE`** (**87 caracteres frente a 289**) para el renglón permanente; **la larga sigue saliendo entera por avisos, una vez**, cuando pasa a haber algo que perder. `.gml-procedencia` (cargado) 89,06 → **59,38 px**. ⇒ **Sobresuscripción 47,54 → déficit 32,70 → 18,33 px**, y el panel **cabe exacto**: 900,00 px de 900, **recorte 0** en vacío y con datos, «Diagnosticar encaje» alcanzable, `#avisos` con sitio para una línea en los dos estados y `.gml-partes` con **3 filas en vacío** |
| **M30** | *(no previsto — y es la lección que vale para F12 en adelante)* | ⛔⛔ **TRES VECES, LA SUITE ESTABA VERDE AFIRMANDO EL COMPORTAMIENTO QUE EN PANTALLA ESTABA MAL.** No es que se le escapara: es que **lo defendía**. (a) el `it` que exigía reenviar **todas** las detecciones de `importar` «sin tocarlas» (**M28**); (b) los **dos guardianes** que afirmaban **un motivo por botón**, que es exactamente la duplicación que dejaba el CTA fuera de pantalla; (c) los **dos `it`** que afirmaban el mensaje de autoguardado **en sus dos sitios, por separado** — cada uno correcto, y nadie preguntando si aparecía dos veces **a la vez**. ⇒ **Un guardián puede estar verde y estar defendiendo el defecto.** Es la hermana mayor de **M24** (guardianes que salen verdes con la mutación puesta): allí la prueba medía la bandera en vez del hecho; **aquí la prueba medía el hecho equivocado**, y mutar el código no la habría destapado —la mutación la habría puesto roja, «correctamente»—. Lo único que las tres tenían en común es que **ninguna miraba las dos piezas a la vez, que es lo que ve el usuario**. El precedente exacto son los tres defectos de maquetación de F09 (M11–M13), que tampoco los vio un snapshot de bytes: los vio **abrir el PDF y mirarlo** |

> **La lección, y no es sobre el panel.** Los cuatro problemas de la primera corrida
> salieron de **medir el resultado compuesto** —la suma de los hijos contra la altura
> disponible, y el texto del panel contra el texto de los avisos **en el mismo
> instante**—, no de medir cada pieza. **Cada arreglo salió de una cifra que la corrida
> anterior había puesto encima de la mesa**, y ninguna de esas cifras la podía dar la
> suite: en jsdom no hay reparto flex, no hay `overflow: hidden` que recorte y no hay
> viewport de 900 px.

## Criterios de aceptación

Suite: `test/edificio/aceptacion-f11.test.js` y `test/edificio/aceptacion-f11.dom.test.js`,
un `describe` por criterio con **su texto literal** (los de esta lista, sin reescribirlos:
un criterio parafraseado deja de ser el criterio). El **1** y el **3** aparecen en **los
dos proyectos**, y no por duplicar: cada uno tiene una mitad pura —qué guarda el modelo en
SIMPLIFICADO, de dónde sale el punto de referencia— y una de interfaz —que el bloque no se
fabrique, que el campo sea editable—, y **medir solo una de las dos deja el criterio
cumplido a medias sin que se note**.

1. **El selector oculta los atributos semánticos en modo simplificado.** ✅ **Y se
   cumple MEJOR que a la letra: no están ocultos, no están** — en SIMPLIFICADO no
   existen ni el bloque de atributos ni el botón que lo abriría (**M8**). Un bloque
   oculto se puede volver a enseñar con una regla de CSS mal puesta; uno que no se
   fabrica, no.
2. **Un DXF con N polilíneas produce N partes nombradas genéricamente, pendientes de
   plantas/tipo.** ⚠️ **NO SE CUMPLE A LA LETRA, y a propósito** (**M2**, **M3**): un DXF
   con N polilíneas produce **una parte por polilínea de las capas ELEGIDAS**, y el
   reparto por capa se **ofrece** en un diálogo. Aplicarlo literalmente daría 25 partes
   en `UTM.dxf`, dieciséis de ellas cajetín y leyenda, y **el recuento saldría mal en
   silencio** (regla de oro 1). Se prueba contra el **DXF de edificio real** de Consulta
   Masiva —7 anillos en `Construccion` + 1 en `Parcela`—, no contra uno fabricado por
   nosotros, que sería autocomplacencia.
3. **La RC se deduce del centroide de la huella y es editable.** ⚠️ **La segunda mitad
   se cumple; la primera no a la letra** (**M5**): se deduce del **punto interior** de la
   parte de mayor superficie, porque **el centroide aritmético de una planta en L cae
   fuera del polígono** y el Catastro devuelve entonces la referencia de la vecina, en
   silencio. Se prueba **con una parte en L**, que es el caso donde el centroide falla.
4. **El modelo respeta los convenios (piscina con plantas `null`; envolvente no
   almacenada).** ✅ **Y F11 no escribe ni una línea para él: lo cumple F00.**
   `model/edificio.js:161-169` fuerza las plantas a `null` en las partes `OTRA` «aunque
   se pasen valores», no existe campo de envolvente, y las dos cosas tienen su `it` en
   `test/model/edificio.test.js:72` y `:177` desde la primera fase. Lo que F11 le debe es
   **re-atestarlo por las cuatro vías de entrada nuevas** (DXF, LIST/TXT, GML BU y WFS).

## Desviaciones deliberadas del enunciado, con su motivo

Trece, **declaradas antes de escribir una línea** para que nadie las descubriera en la
tarea 20. Las dos últimas nacieron de la fase 0 y son las que más cambiaron el diseño.

1. **El criterio 4 no genera código: lo cumple F00**, y se dice con fichero y línea.
2. **`model/edificio.js` NO se toca.** Sus 300 líneas y sus 334 de test siguen verdes
   por construcción, y esa es la mejor defensa que tiene la fase.
3. ⛔ **«Cada polilínea entra como una parte independiente» no se aplica literalmente**
   (D5): se lee la capa, se enseña el reparto y se elige. Ver **M2** y **M3**.
4. ⛔ **La geometría del Catastro no sale de `constru`**, que es ráster. Ver **M4**.
5. **En F11 `tipo` es siempre `PRINCIPAL` y las plantas siempre `null`.** Es alcance
   declarado, no un olvido: la ficha misma dice «Las plantas NO van aquí: se asignan por
   parte en F12». El dato **sí se lee** y viaja crudo en `gml/parse-bu.js` (**M9**).
6. **F11 no guarda expedientes de edificio en IndexedDB, y lo dice en pantalla.**
   `app/cableado-expediente.js:550` deriva la identidad del documento de
   `parcela.idLocal`, y **un `Edificio` no tiene `idLocal`**. Inventarle identidad obliga
   a tocar `model/edificio.js`, que es la desviación 2. **Deuda anotada para F12.**
7. **El autoguardado no se extiende a la rama edificio, y se dice.** Hoy es suscriptor
   del store de parcela; suscribirlo al de edificio sin resolver la 6 haría que el
   borrador de edificio **pisara el de parcela**, porque el borrador es un registro único
   de clave reservada (`ID_BORRADOR`).
8. **La capa nueva entra al barrel como `entradaEdificio`, no como `edificio`.** ✅ Y el
   choque **no es silencioso**: renombrarlo da `SyntaxError: Duplicate export of
   'edificio'` al cargar. El nombre bueno lo es **por reparto** (modelo frente a
   entrada), no por miedo a un fallo mudo.
9. **La parcela que hubiera en pantalla viaja como `edificio.parcelaContexto`** —un
   array de recintos, que es literalmente lo que el modelo previó en
   `model/edificio.js:194`— y **nunca** como rama `parcela` del expediente.
10. ⛔ **`part10` del fixture real contradice el convenio de la ficha.** Ver **M9**.
11. ~~**El `.txt` puede acabar no cableándose.**~~ ✅ **RESUELTO AL MEDIRLO.** La
    predicción de `export/coordenadas.js:32-36` se reproduce **exacta** (0 de 15 vértices
    buenos), **pero el listado se identifica en su línea 2** (`LISTADO DE COORDENADAS DE
    VÉRTICES`) y el filtro «exactamente 3 números» recupera **15 de 15 con 0 falsos
    positivos** en cinco de seis casos. El único falso positivo es el **nombre de
    expediente** del usuario, y lo mata exigir que el primer número sea el índice
    esperado. Se cabla con un **lector propio y estrecho**, reconocido por firma; **no se
    toca `extraerPares`**, que es el tokenizador compartido con LIST y con el TXT de dos
    columnas del técnico. Y si la firma no está, **se rechaza nombrándolo** con
    `AVISO_NO_REIMPORTABLE`, que ya existía.
12. ⛔ **NUEVA, de la fase 0: los siete atributos semánticos NO van en el panel.** Ver
    **M8**. El criterio 1 se cumple igual, y mejor.
13. ⭐ **NUEVA, de la fase 0: F11 arregla un defecto vivo de `parsers/importar.js`.** Ver
    **M13**. No estaba en el alcance, pero cablear la entrada DXF sin arreglarlo sería
    publicar un error silencioso.

**Y tres más que aparecieron al coserlo:**

- ⭐ **El DXF y el listado de coordenadas también se apagan con motivo en la rama
  EDIFICIO.** Los dos escritores son de parcela, y dejarlos correr **entregaba el
  documento de la otra rama en silencio**. El `.json` sí funciona en las dos: siendo el
  almacén incapaz de archivar un edificio, **es su única puerta**. ⭐ Antes de esto, un
  `.json` de edificio **se caía por el desagüe**: salía por el «no lleva ninguna parcela»
  y el trabajo **no aparecía en ningún sitio**.
- **Los dos CTA del pie se apagan con el motivo escrito al lado**, nunca mudos: generar
  el GML de edificio es F13 y diagnosticarlo es F14. ⭐ Y **`disabled` no basta**:
  `cablearGeneracionGml` y `cablearDiagnostico` están suscritos al store de **parcela** y
  escriben `boton.disabled` en **cada** notificación, así que podrían reencenderlos con
  la rama EDIFICIO puesta. Hace falta además una guarda en **fase de captura** que
  cancele el clic y reescriba el motivo.
- **La barra de edición flotante se oculta en la rama EDIFICIO.** Con el edificio en
  pantalla la parcela es **contexto**, y un `Ctrl+Z` ahí deshace una edición que el
  usuario cree estar haciendo sobre el edificio. Se oculta con
  `.control.getContainer().hidden = true`, **nunca `remove()` ni `replaceChildren()`**
  (**M18**). ⚠️ Y se pregunta por `visor.barraEdicion`, **jamás por `visor.edicion`**:
  con `edicion:{barra:false}` la edición se monta y la barra no.

## Deuda declarada

- ⚠️ **El paquete queda en 858,43 kB y la deuda de partirlo (F16) deja de ser
  teórica.** El aviso de Vite por encima de 500 kB lo estrenó F08 y lo arrastran F09 y
  F10; F11 lo empeora un **16,6 %**. No hay dependencia que podar —`package.json` no
  cambió—, así que el remedio sigue siendo **partir**: a los 66,22 kB de `report/` que
  F09 ya identificó como carga bajo demanda se suman ahora los **~89 kB de la rama
  EDIFICIO**, que solo hacen falta cuando alguien pulsa «Edificio» (**M15**).
- ⛔ **LOS 18,33 px DE LA LISTA DE PARTES, entregados MEDIDOS al rework de UI.** Es la
  deuda con la que esta fase cierra, y va con su número, su causa y sus tres corridas: ver
  «Estado». **F12 se encuentra un estirador con CERO holgura.**
- ⛔ **En la rama EDIFICIO se leen cuatro textos que hablan de «la parcela».** Los
  emiten los parsers de F01, que no saben que existen las ramas, y llegan al panel del
  edificio hablando del objeto equivocado. **Cuatro sitios, acotados y medidos** (el quinto
  —`parsers/importar.js:700`, «No se construye la parcela»— **ya no llega**: es el defecto
  B, cerrado en **M28**):

  | Fichero | Severidad | Texto |
  |---|---|---|
  | `parsers/importar.js:415` | **INFO** | «**La parcela** cae en el huso 30 (EPSG:25830): lon=…, lat=…» |
  | `parsers/importar.js:402` | **AVISO** | «El centroide de **la parcela** (…) no cae en la España peninsular ni Baleares…» |
  | `parsers/dxf.js:372` | **INFO** | «Se ignoraron N anotación(es) (…): **no son geometría de parcela**.» |
  | `parsers/dxf.js:86` | *(guía que acompaña a cada aviso de entidad no soportada)* | «Deja solo la polilínea de **la parcela** en la capa 0 y ejecuta LIMPIA (PURGE)…» |

  El arreglo es el patrón **`sujeto`** que ya probó T1.5 en `encuadrarSobreRecintos`, y
  que existe **exactamente por esto**. ⚠️ **Se declara y NO se arregla, y es decisión del
  usuario del 2026-08-04**: tocarlos al cierre **reabre módulos de F01** —los más antiguos
  y más probados del repo— por textos de severidad INFO en tres de los cuatro casos. El
  sitio donde hacerlo es F12, con el `sujeto` puesto de una vez en los dos parsers.
- ⚠️ **La asimetría del DXF de F10 queda cerrada A MEDIAS** (**M27**): un `.dxf` entra
  **como partes de un edificio** y **no como parcela**. La app sigue escribiendo un DXF
  de parcela que no sabe reabrir como tal; lo que ya no hace es callarlo. Recuperar la
  geometría oficial al reabrir era una pregunta explícita de la fase 0 y **la respuesta
  fue «no en esta fase»**: con `capas[]` en la mano es ahora una tarea pequeña, y **su
  sitio natural es F12**, que ya toca la entrada de geometría.
- **No se guardan expedientes de edificio ni se autoguardan** (desviaciones 6 y 7). Un
  `Edificio` no tiene `idLocal`. ⚠️ Y `recuperar()` **no** aprendió la rama a propósito:
  F11 nunca guarda un edificio, así que esa rama sería código muerto — **si F12 le da
  `idLocal` al edificio, ése es el segundo sitio que tocar**.
- ⚠️ **Dos huecos del léxico de `edificio/_comun.js`, declarados en vez de inventados:**
  no hay código para «esta geometría no ha llegado al modelo» (se reusa
  `PATCHES_MULTIPLES` con `datos.destino`) ni para «los anillos vienen de N capas y no
  has elegido» (viaja en `resumen.capas`, 1:1 con las partes). **Deuda para F12: un
  `GEOMETRIA_DESCARTADA` propio.**
- ⚠️ **Solo se ha medido a 1440×900.** Un tope en `vh` protege del contenido largo,
  **no de la ventana corta**: `--gml-partes-alto-max: 26vh` son 234,00 px a 1440×900 pero
  **199,68 px a 768** ⇒ **7 filas, no 8**; y hacia ~910 px de alto (cifra **derivada, no
  medida**) se cruza con el reparto flex y por encima deja hueco en blanco. Le pasa igual
  a `--gml-avisos-alto-max` desde F06. ⛔ **Y quien mantiene «Generar GML» a la vista a
  1440×900 NO es el tope**: es el **reparto flex** (`flex: 1 1 auto` + `min-height: 0`);
  el tope es la red para cuando esa cadena se rompa. La conclusión (8 partes enteras de
  13) sale con las dos cifras, pero **cuál de las dos la produce** importa para quien lo
  mantenga.
- ⚠️ **`.gml-parte` es CSS joven**: las cifras de «partes enteras» se mueven si la fila
  crece. **El número robusto es el de píxeles, no el de partes.**
- ⚠️ **El solar sin construcción no se midió** (**M7**). Que conteste con la colección
  vacía es inferencia razonable, no medición.
- ⚠️ **El orden de apagado del transporte compartido no se ejerce hoy** (**M22**),
  porque este arranque no desmonta nada. El día que exista un desmontaje, el orden es
  **primero el edificio y el cliente de parcela el último**.
- **`bloqueosBu()` de `gml/parse-bu.js` sigue sin llamante fuera de sus tests**, y su
  JSDoc **ya no miente**: dice qué devuelve, por qué `edificio/entrada.js` no puede
  usarlo —`MOTIVO_ENTRADA` es un catálogo cerrado de cinco que un test-guarda ata— y
  quién es su consumidor natural (F12 o F14). **Si llegado el momento sigue sin llamante,
  se borra entonces.**
- **La cuarta copia de `describir`** que F07 declaró y F08 y F09 heredaron **sigue
  igual.** F11 no añadió una quinta ni la unificó.
- **El fixture de edificio es verificable pero NO re-obtenible**: falta la URL exacta
  del servicio de Consulta Masiva con que se descargó. Declarado como hueco en
  `test/fixtures/parsers/PROCEDENCIA.md`, no tapado.

## Ficheros que la fase creó y tocó de verdad

La ficha original nombraba **uno**, y encima es el único que **no** se toca. Son estos,
contados con `git status`.

**Módulos nuevos de producción (11):**

| Fichero | Qué es |
|---|---|
| `edificio/_comun.js` | el **cuarto léxico** del proyecto, con la misma forma `{tipo, mensaje, severidad, datos?}` que `parsers/`, `gml/` y `export/`: `TIPO_EDIFICIO`, `crearDeteccionEdificio`, `resumirDetecciones`, `MOTIVO_ENTRADA` (catálogo **cerrado de cinco**) y `nombreParteGenerico(i)` |
| `edificio/mutaciones.js` | `conModelo`, `conRefcat`, `conParteRenombrada`, `conAtributos`, **todas devolviendo un `Edificio` nuevo** vía `crearEdificio`. `conModelo` es la que tiene chicha: pasar de COMPLETO a SIMPLIFICADO **borra los siete atributos**, y eso **se dice antes de hacerlo**, con la lista de lo que se pierde |
| `edificio/entrada.js` | **el corazón de la fase**. `entradaDesdeTexto` (LIST/TXT/DXF), `entradaDesdeGmlBu` y `entradaDesdeWfsBu` — ⭐ **las dos últimas comparten la MISMA traducción**, porque el WFS devuelve el mismo dialecto que el fichero: es el ahorro grande de F11. Aquí vive el único sitio que decide `ORIGEN_PARTE`, el nombre genérico, el mapeo INSPIRE→modelo y `puntoDeReferencia` (**M5**) |
| `edificio/index.js` | el **barrel de la capa**, con superficie curada por nombre. **Aporta 0,00 kB al paquete** (se va con el *tree-shaking*), igual que `report/index.js` en F09 |
| `gml/parse-bu.js` | el lector del dialecto **BU**, hermano de `gml/parse.js` sobre `gml/xml.js`. **Devuelve valores CRUDOS sin traducir** (`functional`, `1_residential`, `grossFloorArea`), y **no lanza por contenido**: devuelve `{ok:false, motivo}` y detecciones. Es donde viven **M10**, **M11** y **M12** |
| `services/_catastro-bu.js` | **puro**, hermano de `services/_catastro-wfs.js`: construye la URL del `wfsBU.aspx` y **clasifica el cuerpo**. **Ni un `fetch`**. `CONSULTAS_BU` tiene **cuatro** construibles; la quinta se declara con su porqué (**M4**) |
| `services/catastro-edificio.js` | `crearClienteEdificio({transporte, cache, srs, ahora, alAvisar})`. **Dos peticiones por edificio** · **1** si la referencia no existe (se para en la primera) · **0** desde caché. Recibe el **MISMO transporte** que el cliente de parcela: la cola, los reintentos y el ritmo son **compartidos**, que es lo que exige el override **O8**. La caché guarda **el texto del GML, no el POJO** — `parse-bu.js` es el lector más joven del proyecto y un POJO cacheado **congelaría sus fallos durante los 7 días del TTL** |
| `viewer/partes.js` | la capa de huellas. `pane` **422** (por encima de la parcela editada, por debajo de los vértices), `fill: true` con `fillOpacity: 0.25`, tooltip con el nombre. ⛔ **Color: violeta claro `#A78BFA`** — no el amarillo del usuario (la parcela sigue en pantalla como contexto y **del mismo color no se distinguiría el edificio del solar**), ni gris (ya es el contexto), ni verde/rojo/ámbar (regla 9). ⚠️ Clases `gml-huella-*`, **no** `gml-parte-*`: eso es la fila del panel |
| `app/rama.js` | **el dueño único de la rama activa**. `RAMA`, `cablearRama`, y el conmutador **fabricado por él** dentro de `.gml-chips`. Intercambia por **visibilidad** (**M18**) |
| `app/panel-edificio.js` | el panel: selector de modelo, RC editable con **nombre propio**, lista de partes con renombrar, el diálogo de reparto por capas y el `<dialog>` de atributos (**M8**). **El módulo más caro de la fase: 18,88 kB** |
| `app/cableado-edificio.js` | el módulo que **cose** la fase: las cinco vías de entrada, el segundo store, la capa de partes, la RC deducida y editable, los atributos, el encuadre propio (`encuadrarSobreRecintos`, porque `visor.encuadrar()` ejecuta la cascada sobre el store de *parcela*) y **el sellado de `data-rama-panel`** (**M19**) |

**Módulos tocados (12 + `.gitattributes`):** `parsers/dxf.js` (el código de grupo 8, en
un cambio **estrictamente aditivo**) · `parsers/importar.js` (**M13** y `capas[]`) ·
`viewer/_comun.js` (`PANE.PARTES` y el JSDoc de `crearEstadoVista`, que decía «el POJO
de parcela» y ahora es «el POJO del documento de la rama») · `viewer/index.js`
(`encuadrarSobreRecintos` exportado —hasta hoy privado—, con `sujeto` para que el aviso
no le cuente a la rama EDIFICIO un fallo real **sobre el objeto equivocado**; y
`barraEdicion` en el objeto devuelto) · `app/main.js` (**el paso 13**, y `.dxf`/`.txt`
en el `entradasExtra` del paso 9, con **resolución tardía** por la rama activa) ·
`app/cableado-comprobacion.js` (**M14**) · `app/cableado-expediente.js` y
`export/proyecto.js` (la rama en `expedienteActual()`, `abrirProyecto` que **conmuta**,
y el aviso de `export/proyecto.js:457-467` —«esta versión solo sabe enseñar la rama de
parcela»— que **deja de ser cierto** y se reescribe) · `gml/index.js` e `index.js` (los
dos barrels) · `estilos/app.css` (**+4,35 kB**) · `index.html` (**solo un comentario**: el
marcado de F11 lo fabrican sus módulos; cuesta +2,79 kB de HTML, ver «Coste») ·
`.gitattributes` (línea propia para el DXF de edificio, porque **en `.gitattributes` el
`*` no cruza la barra** y sin ella el SHA-256 publicado en su `PROCEDENCIA.md` dejaría de
reproducirse — el mismo motivo que en F08 y F09).

⚠️ **Y uno que NO se toca y sin embargo es la mitad de la fase:** `model/edificio.js`.
Está entero desde F00 —`crearEdificio`, `crearParteConstruccion`, `MODELO_EDIFICIO`,
`TIPO_PARTE`, `ESTADO_CONSERVACION` y un `ORIGEN_PARTE` que **ya listaba las cinco vías
de esta fase**— y F11 lo estrena como llamante. Es el reverso exacto de lo que le pasó a
`viewer/atribucion.js` en F09: código escrito por adelantado que deja de estar muerto.

**Material de prueba nuevo:** `test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf`
(descarga real de Consulta Masiva, **el primer fixture REAL con `POLYLINE`/`VERTEX`/`SEQEND`**)
con su `PROCEDENCIA.md` —que **estrena la carpeta**, pagando la deuda de F10·T0.2·8— y
cinco fixtures del `wfsBU` en `test/fixtures/catastro/`, incluido el **`.html` del 404**
(**M6**) y la **colección vacía** (**M7**).

**Tests nuevos (13 ficheros):** `test/edificio/comun.test.js` ·
`test/edificio/mutaciones.test.js` · `test/edificio/entrada.test.js` ·
`test/gml/parse-bu.test.js` · `test/services/catastro-bu.test.js` ·
`test/services/catastro-edificio.test.js` · `test/viewer/partes.dom.test.js` ·
`test/app/rama.dom.test.js` · `test/app/panel-edificio.dom.test.js` ·
`test/app/edificio.dom.test.js` · `test/app/main-edificio.dom.test.js` ·
`test/edificio/aceptacion-f11.test.js` y `test/edificio/aceptacion-f11.dom.test.js` (los
cuatro criterios, un `describe` por criterio con su texto literal).

**Tests ampliados (11 ficheros):** `test/contrato.test.js` (el bloque «contrato F11», con
el guardián por nombres del barrel de capa y su mitad anti-vacuidad) ·
`test/parsers/dxf.test.js` y `test/parsers/importar.test.js` (**M2**, **M13**) ·
`test/viewer/comun.dom.test.js` y `test/viewer/index.dom.test.js` ·
`test/app/comprobacion.dom.test.js` (**seis `it` nuevos con el desvío puesto**, ver
**M14**) · `test/app/expediente.dom.test.js` · `test/export/proyecto.test.js` ·
`test/app/main-gml.dom.test.js`, `main-edicion.dom.test.js` y
`main-comprobacion.dom.test.js` (la trampa del `<body>` y los dobles del visor, **M24**).

## Coste, medido

### La suite

| | F10 (`c2df2c7`) | F11 | Δ |
|---|---|---|---|
| Pruebas | 5.056 | **5.734** | **+678** |
| Ficheros de test | 112 | **125** | **+13** |

Por fases: 112/5.056 (partida, medida **en frío**) → **116/5.286** (fase 1) →
**121/5.568** (fase 2) → **122/5.668** (fase 3) → **123/5.697** (fase 4) →
**125/5.734** (fase 5: la suite de aceptación **y los guardianes de los dos defectos que
destapó el guion**, M28 y M29). Corrida del 2026-08-04, **0 fallos** en los dos proyectos.

### El paquete

`npm run build` del 2026-08-04, contra la línea de partida medida **en frío** en la fase
0 (736,16 kB · 236,35 gzip · 52,80 CSS · 27,87 HTML · 130 módulos · 276 ms).

| | F10 | F11 | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 736,16 kB | **858,43 kB** | **+122,27 kB** (+16,6 %) |
| *(gzip del JS)* | 236,35 kB | **276,28 kB** | +39,93 kB |
| `dist/assets/index-*.css` | 52,80 kB | **57,15 kB** | **+4,35 kB** |
| `dist/index.html` | 27,87 kB | **30,66 kB** | **+2,79 kB** — ver abajo |
| Módulos transformados | 130 | **147** | +17 |

⛔ **Y el HTML no queda intacto, contra lo que las cuatro fases anteriores acostumbraron:
el comentario de esta tarea cuesta +2,79 kB medidos** (gzip +1,02). El marcado de F11 **no
está en `index.html`** —lo fabrican `app/rama.js` y `app/panel-edificio.js`, como ya hacían
`app/zona-fichero.js` y los tres `<dialog>` anteriores—, así que el único cambio en el
fichero es el **bloque de comentario** que documenta qué dos `<section>` pueden quedar
`hidden` y quién las gobierna. **Vite no elimina los comentarios de HTML**, así que viajan
al usuario: los 27,87 kB de partida ya eran en su mayor parte comentario, y esto es la
misma decisión que este fichero lleva tomando desde F03 —**el comentario se paga**—, solo
que hasta hoy nadie le había puesto la cifra. Se dice por si algún día se decide lo
contrario.

⚠️ **El JS casi no se movió hasta la fase 4** (736,16 → 736,61 en la fase 1, → 740,54 en
la 3), porque `edificio/`, `gml/parse-bu.js` y `services/_catastro-bu.js` **todavía no
los importaba nadie** desde `app/main.js`: su coste real aterrizó en el ensamblaje. Un
paquete que no crece mientras se escriben módulos **no es una buena noticia: es un
módulo sin llamante**.

Atribución por *sourcemap*, módulo a módulo. Los diez módulos nuevos que **entran** en
el paquete suman **89,09 kB**:

| Fichero | Δ | |
|---|---|---|
| `app/panel-edificio.js` | **+18,88 kB** | nuevo. El más caro de la fase: dos `<dialog>`, el selector, la lista de partes y **el texto en español de todo eso** |
| `gml/parse-bu.js` | **+15,68 kB** | nuevo |
| `app/cableado-edificio.js` | **+13,70 kB** | nuevo |
| `edificio/entrada.js` | **+12,40 kB** | nuevo |
| `services/catastro-edificio.js` | **+7,83 kB** | nuevo |
| `app/rama.js` | **+6,71 kB** | nuevo |
| `services/_catastro-bu.js` | **+6,54 kB** | nuevo |
| `edificio/mutaciones.js` | **+3,58 kB** | nuevo |
| `viewer/partes.js` | **+2,12 kB** | nuevo |
| `edificio/_comun.js` | **+1,65 kB** | nuevo |
| **`edificio/index.js`** | **0,00 kB** | el barrel de la capa **no entra en el paquete**: `app/main.js` importa los módulos directamente y las reexportaciones se van con el *tree-shaking*. Igual que `report/index.js` en F09 |
| *el resto (32,23 kB)* | | el crecimiento de los ficheros tocados que entran en el paquete — por tamaño total: `app/cableado-expediente.js`, `app/main.js`, `app/cableado-comprobacion.js`, `viewer/index.js`, `parsers/importar.js`, `export/proyecto.js`, `parsers/dxf.js` y `viewer/_comun.js`. ⭐ **Importar `app/rama.js` desde el expediente cuesta 0 kB**: el cuerpo de `cablearRama` se va por tree-shaking (verificado por grep sobre `dist/`) |

⚠️ **La atribución por *sourcemap* es aproximada por construcción** y depende de cómo se
repartan los tramos generados: una segunda pasada con otro reparto da **91,81 kB** para
esos mismos diez módulos, con **el mismo orden exacto**. Lo que no depende del método es
lo que importa: **cero dependencias nuevas** (`git diff package.json` vacío; en
`node_modules` solo Leaflet —**150,02 kB, y sigue siendo el módulo más caro del
paquete**—, `bignumber.js` y `polyclip-ts` con sus transitivas) y **8,9 kB/módulo**,
frente a los 9,8 de F08. Ver **M15**.

⚠️ **Y una nota de método, para que la cifra no se lea con más precisión de la que
tiene:** las **857,48 kB** y la atribución de arriba son la construcción del **cierre de
la fase 4**, que es cuando se midió módulo a módulo. **La construcción de cierre, del
2026-08-04, da 858,43 kB** (gzip 276,28): **+0,95 kB** sobre aquélla, que son los
arreglos de la fase 5 —`sinDeteccionesDeParcela` en `parsers/importar.js` (**M28**) y las
tres palancas de altura en `app/panel-edificio.js`, `app/rama.js` y
`app/cableado-edificio.js` (**M29**)—. **La atribución no se rehace por 0,95 kB**, pero la
diferencia se declara en vez de redondearla: un número copiado de una medición anterior
sin decir de cuándo es acaba siendo un número que nadie puede reproducir. ⭐ Y el signo
importa: **arreglar el panel que no cabía COSTÓ kilobytes, no los ahorró** — las tres
palancas quitaron **texto duplicado de la pantalla**, no código.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que el reparto por capas se ENTIENDA sin explicación.** Un test afirma que el
  diálogo lista `FINO 16 · LINDE 4 · PARCELA 3 · BLANCO 1 · 0 ⇢ 1`; ninguno dice si un
  técnico sabe cuál elegir mirándolo. Es el punto de la firma humana que más vale de esta
  fase, porque **la decisión 5 entera se apoya en que ofrecer sea mejor que adivinar**.
- **Que un DXF de un plano REAL de trabajo —no el fixture— produzca las partes que el
  técnico esperaba.** El fixture es real y del Catastro, pero es *un* fichero.
- **Que conmutar de rama y volver deje el panel de parcela FUNCIONANDO de verdad**, no
  solo con el mismo aspecto. La suite mide que el nodo es el mismo y que sus oyentes
  siguen atados (**M18**); que la parcela se siga editando después de tres idas y vueltas
  lo firma una persona.
- **Que las huellas se VEAN sobre la cartografía**, encima de la parcela y por debajo de
  los vértices, y que el violeta claro se distinga de verdad sobre una cubierta. El pane
  y el color están medidos; que se lean, no.
- **Si alguna frase del panel de edificio se lee como un VEREDICTO.** Es el punto
  **BLOQUEANTE** heredado de la §8, la §9, la §10 y la §11 del `CHECKLIST-HUMANO.md`.
- **El comportamiento por debajo de 1440×900.** Ver «Deuda declarada».
- **Qué contesta el `wfsBU` a un solar sin construcción** (**M7**).

## Estado

⛔ **F11 CIERRA CON EL GUION DE NAVEGADOR EN `ok: false`, sobre UN punto medido, y es
una decisión tomada con el número delante — no un olvido ni un «pendiente».** Eso
**incumple el criterio de cierre 6 del plan** («el guion 13 en navegador real con
`ok:true`»). Se escribe así, con el número, porque un criterio que se declara cumplido
«en lo esencial» deja de ser un criterio.

### Los ocho criterios de cierre del plan, uno a uno

| # | Criterio | |
|---|---|---|
| **1** | `npm test`, los dos proyectos en verde | ✅ **125 ficheros / 5.734 pruebas, 0 fallos** (2026-08-04) |
| **2** | `test/model/edificio.test.js` y `test/parsers/dxf.test.js` **siguen exactamente igual de verdes** | ✅ **54 pruebas verdes** entre los dos, y `model/edificio.js` **sin una sola línea tocada** en toda la fase (`git diff` vacío). Era el guardián de que la fase no toca ni la geometría ni el modelo |
| **3** | `npm run build` limpio, con el delta **medido por sourcemap**; *«si la fase pasa de ~25 kB, hay que parar»* | ⚠️ **Construye limpio: 858,43 kB JS · 57,15 CSS · 30,66 HTML · 147 módulos** (gzip 276,28). Pero **el presupuesto se rompió por 4,7×**: se paró, se midió módulo a módulo y salió **cero dependencias nuevas** y **8,9 kB/módulo**, la tasa de la casa. **La cifra mal puesta era el presupuesto, no el código** (**M15**) |
| **4** | `npm run validar:xsd -- --estricto` sigue verde | ✅ **OK.** F11 no toca `gml/serialize-cp.js` ni el sobre de ENTREGA que la Sede aceptó en firme el 2026-07-27 |
| **5** | `node --check` sobre el guion 13 **falla** con «Illegal return statement», y eso es normal | ✅ Falla exactamente así (`13-edificio.js:369`): `browse` envuelve el guion él mismo |
| **6** | **El guion 13 en navegador real con `ok:true`**, consola limpia y los 267,44 px intactos | ⛔ **NO SE CUMPLE. Cierra con `ok: false` y 1 problema.** Tres corridas: **4 → 3 → 1**. Lo que sí se cumple de este criterio: los **267 px** de la caja de vértices intactos, el conmutador a **0 px** de coste, consola limpia, **0 peticiones de datos**, y el **guardián de ANCHO** que sustituye al `nowrap` erróneo del plan (116,17 px de 169,29 libres ⇒ **45,12 px de holgura**, sin salto de línea). Lo que no: **con 7 partes la lista de partes mide 7,06 px y una fila necesita 25,39 ⇒ faltan 18,33 px** |
| **7** | El veredicto de T0.1 escrito y **es SÍ** | ✅ La vía del Catastro se cabla, con las cuatro correcciones de la lección de F05 incorporadas (**M4**, **M6**, **M7**) |
| **8** | **Firma humana del §12** | ⏳ **Abierta**, como F03, F05, F06, F07, F08, F09 y F10. La cadena pasa a ser **F03 → F05 → F06 → F07 → F08 → F09 → F10 → F11** y se firma toda junta |

### Los 18,33 px se ENTREGAN MEDIDOS al rework de UI

**Decisión del usuario, tomada el 2026-08-04 con las tres corridas delante.** Los
motivos, sin suavizar:

1. **La pérdida funcional ya está arreglada.** El defecto que importaba era el CTA
   inalcanzable —«Diagnosticar encaje» y su motivo fuera de la pantalla, sin forma de
   llegar a ellos—, y eso está cerrado: el panel **cabe exacto** (900,00 px de 900,
   **recorte 0** en vacío y con datos). Lo que queda es que la lista de partes se lee en
   **0 filas** cuando hay 7 partes, con las partes **pintadas en el mapa** y la ficha del
   pie diciendo «7».
2. **Toda palanca que queda es recortar redacción o tocar la maqueta del panel
   compartido**, que es exactamente lo que el rework de UI existe para hacer. Las tres
   palancas que sí se aplicaron eran **duplicaciones** —lo mismo dicho dos veces— y no
   costaron ni un hecho; a partir de aquí ya no hay duplicaciones que quitar.
3. **F12 añade las plantas por parte sobre un estirador con CERO holgura** —más texto por
   fila y una fila más alta—, así que **recortar texto ahora se deshace en dos fases**.

⛔ **La causa de fondo, medida, y es lo que hay que leer antes de tocar nada:** el
**renglón de estado (44,53 px)** y el de **procedencia (29,69 px de crecimiento)** *solo
existen cuando hay datos cargados* — **+74,22 px que llegan justo cuando la lista tiene
algo que enseñar**. Por eso el panel **vacío** entra con **tres filas** (`.gml-partes`
90,03 px) y el **cargado** no entra con una (7,06 px). No es que falte espacio: es que el
espacio se lo llevan dos renglones que aparecen a la vez que el contenido. De los 18,33
px, **8,84 están al lado** —el margen que `#avisos` tiene hoy por encima de su mínimo—;
los **9,49 restantes** salen de los tres bloques fijos, que con datos suman 772,23 px de
900.

### Lo demás

⭐ **Lo que hay que recordar de esta fase son tres cosas, y ninguna estaba en el
enunciado.** La primera: **la aplicación llevaba diez fases produciendo superficies
negativas en silencio** por un camino que nadie recorría, y solo apareció al ir a
recorrerlo (**M13**). La segunda: **cuatro guardianes salieron verdes con la mutación
puesta** (**M24**), midiendo la bandera en vez del hecho. Y la tercera, que es la que
vale para F12 en adelante: **tres veces la suite estuvo verde afirmando el comportamiento
que en pantalla estaba mal** (**M30**) — no se le escapó, **lo defendía**. Las tres dicen
lo mismo que F03 fase 4, F08, F09 y F10 ya habían dicho, cada vez con una cara distinta:
**una prueba que solo mira una pieza no ve lo que ve el usuario**, y por eso el último
gate es un navegador y, después, una persona.

**Que la suite esté verde y el build limpio no cierra la fase**: son necesarios, no
suficientes (`SPEC.md` §6). Aquí, además, **ni siquiera está verde el gate del navegador**,
y se cierra igual **con el motivo escrito y el número medido**.

## Referencias

Plan §4.2–§4.3, §13, §14, §18 Fase 11, §23.3. Dossier §1.2 (modelo edificio, ICUC),
§1.3 (reglas ICUC), §2.3–§2.4 (`wfsBU` — **corregido en M4**).
`SPEC.md` §2 reglas de oro **1**, **2**, **4**, **8** y **9**; §3 overrides **O8**
(régimen de uso: el presupuesto de red de esta fase son **2 peticiones por edificio**),
**O10** (raíz y `srsName` del edificio, materia de F13), **O11** (una `BuildingPart` por
volumen de altura homogénea, **confirmado sobre las 13 partes reales**), **O12** (el DXF
que no abría, de F10 — **la ida y vuelta del lector se cierra aquí; la de la rama parcela
no, M27**), **O14** (la colección vacía del `wfsCP` — **en `wfsBU` es al revés, y por eso
el override queda ACOTADO a ese endpoint**) y ⭐ **O21**, que es **nuevo y de esta fase**:
la vía vectorial del edificio (`wfsBU.aspx`), con sus siete mediciones.
`spec/feature-08-comprobar-gml.md` §criterio 4 (**cerrado aquí, M14**).
`spec/feature-01-entrada-parcela.md` y `spec/feature-10-persistencia-export.md` **M9**
(la asimetría del DXF y del `.txt`, cerrada aquí **a medias** — ver **M27**).
`scripts/smoke-navegador/GUION.md` §19 y `CHECKLIST-HUMANO.md` §12.
Plan de ejecución de la fase:
`~/.claude/plans/vamos-a-planificar-f11-el-groovy-bumblebee.md`.
