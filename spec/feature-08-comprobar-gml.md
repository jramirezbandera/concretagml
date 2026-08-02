# F08 · Comprobar un GML existente

**Fase:** 8 · **Prioridad:** P8 · **Riesgo:** Bajo · **Depende de:** F04, F07 · **Habilita:** F09 (informe con plano), F14 (contraste de edificio ajeno).

**Ficheros (los REALES; la spec original nombraba uno y medio — ver «Ficheros que la fase creó y tocó de verdad»):**
~~`gml/parse.js` (entrada ajena), recorrido corto en `viewer/`.~~
**Siete módulos nuevos de producción**, en **dos capas nuevas**:
`gml/decodificar.js`, `comprobacion/_comun.js`, `comprobacion/gml.js`,
`report/contraste-texto.js`, `viewer/cajon-comprobacion.js`, `app/zona-fichero.js`
y `app/cableado-comprobacion.js`; más **doce** tocados. `gml/parse.js` **no se tocó
ni una línea**: se estrenó como llamador, que era el plan.

> ⛔ **Esta spec se REESCRIBIÓ el 2026-07-30**, al cerrar la fase, para que diga lo
> que hay y no lo que se pensaba hacer. Lo que decía antes **no se borra**: se
> conserva tachado o citado al lado de lo medido, igual que en `SPEC.md` §3.1, en
> `feature-05-catastro-vivo.md`, en `feature-06-edicion-parcela.md` y en
> `feature-07-diagnostico-parcela.md`. Manda lo medido (regla de oro 8).

## Objetivo

~~Tercera vía de entrada, al mismo nivel que RC y medición:~~ **la PRIMERA vía de
entrada por fichero de toda la aplicación**: cargar un GML ya hecho (propio o
ajeno) y contrastarlo contra el parcelario, sin generar nada. Es el diagnóstico de
F07 con otra entrada; barato de añadir sobre él porque `diagnostico/` se escribió
ciego a propósito.

**Por qué «la primera» y no «la tercera».** Medido sobre el commit de cierre de F07
(`a0e2a9d`) con `git grep`: en todo el código de producción no había **ni un
`<input type="file">`, ni un `FileReader`, ni un oyente de `drop`/`dragover`**. Los
parsers de F01 (DXF/LIST/TXT) llevaban desde la fase 1 en verde y **nadie los
llamaba** desde `app/`: `parsers/_comun.js` entraba en el bundle por una sola
función que usa `viewer/celda.js` (`autodetectarSeparadorDecimal`), y
`parsers/importar.js` no lo importaba nadie. La spec de F08 daba por hecho un
mueble que no existía. **F08 lo construye**, y lo construye genérico
(`app/zona-fichero.js` no sabe qué es un GML) para que F01 se enchufe después
**sin rehacer la interfaz**.

**La pregunta comercial que responde** es la que la Sede dejó abierta el 2026-07-27
(`SPEC.md` §7): que el IVG *cargue* un fichero no significa que su informe de
validación gráfica salga limpio, porque ese informe juzga **reglas de negocio sobre
la parcela concreta** —solape con colindantes, tolerancias de superficie y
perímetro— que ningún esquema expresa. F08 es la vía para responderla **antes** de
presentar nada.

## Alcance

- **Área para soltar o elegir un `.gml`.** Cómo quedó: un botón secundario
  **«Abrir un GML…» en la fila del rótulo** de «Origen de la parcela»
  (`.gml-rotulo-fila`, el mismo patrón del bloque «Vértices»), y **la ventana
  entera** acepta que se le suelte un fichero, con superposición visible mientras
  se arrastra. El `<input type="file">` **no está en `index.html`**: lo fabrica
  `app/zona-fichero.js`, que es también quien vacía su `value` tras cada carga para
  que soltar **el mismo fichero dos veces** vuelva a disparar el evento.
- **Recorrido:** Entrada → **Comprobación** → Diagnóstico. **No** incluye Edición
  ~~ni generación~~ *(ver «Desviaciones deliberadas»: «Generar GML» se queda
  encendido, y es un desvío razonado)*.
  ~~El rastro lateral muestra solo esos pasos.~~ ⛔ **No existe ningún rastro
  lateral de pasos en esta aplicación y F08 no lo ha creado** (ver M3).
- **Paso de Comprobación** — un GML ajeno puede traer **varias parcelas**, un **SRS
  distinto** del esperado o **coordenadas fuera de huso**. Se muestra como **nota
  clara, no como error de programa**, y si hay más de una parcela se deja **elegir
  cuál** se contrasta. ✅ Tal cual, y con **cuatro comprobaciones** que `parsearGml`
  no hacía (abajo).
- En el diagnóstico llegado por esta vía:
  - ~~Identificador de cabecera: *«GML cargado · nombre.gml»*, no una RC tecleada.~~
    ⚠️ **No hay un identificador de cabecera nuevo: se reutiliza el renglón de
    procedencia que ya existía**, y dice más que lo pedido. Literal:
    *«Geometría del fichero «nombre.gml», **NO del Catastro**. Parcelario, solo para
    contrastar: …»*, con la mitad del Catastro redactada por la **misma función** que
    escribe la vía de referencia catastral (`textoProcedencia`, ahora exportada). Hay
    **un solo renglón de procedencia** en la pantalla porque hay **un solo dato del
    que hablar** —la parcela cargada— y dos vías para traerla; dos nodos serían dos
    verdades simultáneas sobre la misma parcela. Y el orden importa: **primero de
    dónde viene la geometría**, que es lo que se dibuja y lo que se va a generar, y
    después el parcelario, rotulado como lo que es: un término de comparación.
  - Acción principal: **«Descargar informe de contraste»**. ✅ Y vive **dentro del
    cajón de diagnóstico**, no en el pie (tres motivos, abajo).
- **Acepta GML de parcela y de edificio.** ⚠️ A medias, y se declara: el de
  edificio se **detiene con honradez** y dice por qué; el encaminamiento al
  contraste de construcción **no existe porque F14 no existe** (ver criterio 4).

### Lo que F08 le cuesta al panel: CERO píxeles, y está medido

Es la **tercera fase seguida** que no le quita altura al panel lateral, y las tres
por la misma puerta: F06 se llevó las herramientas de edición a una barra sobre el
mapa (la tabla de vértices pasó de 64 a 303 px), F07 el diagnóstico a un cajón (y
pagó los ~36 px del CTA del pie, 303 → 267), y **F08 no paga ninguno**.

El truco no es estético, es aritmético: el botón «Abrir un GML…» **no tiene fila
propia** —cuelga a la derecha del `<h2>`, en un `.gml-rotulo-fila` que ya existía— y
`.gml-boton--menudo` está dimensionado para caber **dentro** del alto de línea del
rótulo: **15,2 px de botón contra 15,95 px de renglón** (11 px × 1,2 más dos bordes
de 1 px, frente a 11 px × 1,45). De ahí el `padding` vertical **cero**: con el de la
base (`--space-2`, 8 px arriba y abajo) el botón mediría 31,2 px y la fila crecería
15 px, robados a la tabla de vértices por un botón secundario. Y el área de pulsación
se agranda a ~27 px con un `::after` absoluto, que **no ocupa layout**: encogerla en
silencio habría sido pagar accesibilidad con píxeles ajenos sin decirlo.

**Medido en navegador real (T3.3): la caja de vértices sigue en 267,4375 px**, los
mismos que dejó F07. Confirmado en la corrida completa de `10-comprobar-gml.js`
(T6.2, 2026-07-30): **267 px al arrancar y 267 px en el mismo tick en que el cajón se
abre** — el cajón flota y el panel no se entera. Hay que medirlo en ese tick y no
después: la primera versión del guardián de F07 acusó al cajón de 11 px que eran de
otros renglones hablando después.

⚠️ **Lo que sí cuesta píxeles, y no es el botón: contrastar.** Tras pulsar
«Contrastar con el parcelario» la caja baja a **222 px**, y los **45 px** son
exactamente lo que crece el **renglón de procedencia** al pasar de vacío a tres
líneas. Ese renglón ya existía y lo llena también la vía de referencia catastral;
F08 lo escribe más largo porque su procedencia es **doble** (geometría del fichero +
parcelario del Catastro). Es el precio de decir la verdad sobre de dónde viene cada
cosa, y se paga a sabiendas — pero es un coste real y queda escrito, no atribuido al
botón.

### El paso de Comprobación: qué AÑADE sobre `gml/parse.js`

`comprobacion/gml.js` es **puro** (proyecto Vitest `node`, sin DOM, sin red, sin
reloj) y compone piezas de las capas de abajo. Vive **por encima** de `validation/`
y **no dentro de `gml/`**: `gml/` es capa de dominio y no puede conocer a nadie por
encima suyo.

| # | Qué | Con qué, y por qué aquí |
|---|---|---|
| **C1** | `areaValue` declarado **vs** shoelace de las coordenadas del propio fichero | `geo/area.js#superficie`. `AREA_DECLARADA_DISCREPANTE` existía en el vocabulario de F04 pero **solo se emitía cuando el valor no era numérico**: la comparación real no la hacía nadie. Y **no es la misma cifra** que la tabla a tres bandas de F07 —allí `superficie.catastral` es lo que declara el **parcelario**; aquí es lo que declara **este fichero sobre sí mismo**— así que se llaman `superficieDeclarada`/`superficieMedida` y jamás «catastral» |
| **C2** | Coordenadas fuera del huso **DECLARADO** | `validation/reglas-huso.js#reglasHuso(recintos, {srs})` con el huso del `srsName` como **candidato único**: es el modo VERIFICAR de `geo/huso.js` (168/168 aciertos). La autodetección «equivale a asumir huso 30» y sería un falso positivo disfrazado de hecho — por eso `parse.js` se negó a cotejar el huso |
| **C3** | Geometría completa (F02) | `validation/parcela.js#validarParcela(recintos, {srs})`: autointersecciones (`kinks`), vértices duplicados, mínimo de puntos. **Cierra el punto que F04 §5 dejó abierto por escrito** (abajo) |
| **C4** | Orientación del exterior | **INFORMATIVA, jamás un error.** Override O1 matizado: el exterior horario es **convención, no requisito**, y la plantilla oficial del Catastro va antihoraria. Un GML ajeno antihorario no está mal |

**El punto que F04 §5 dejó abierto queda CERRADO y demostrado.** F04 escribió: *«un
colapso puede además crear una autointersección que solo `kinks` vería. Ese chequeo
es de F08»*. Está en `test/comprobacion/gml.test.js`, sobre el fichero real con dos
pares del `posList` intercambiados: `parsearGml` **no dice nada** y `comprobarGml`
la nombra con nivel ERROR — **con `puedeContinuar` todavía en `true`**, porque una
parcela que se cruza consigo misma es precisamente lo que hay que enseñarle al
usuario.

**`puedeContinuar` es capacidad, no mérito** (precedente: `puedeGenerar` de F02).
Vale `false` **solo** cuando no hay geometría legible: XML irrecuperable, dialecto
`BU`, colección sin parcelas, SRS no soportado. Nunca porque la parcela «esté mal».
Cuando es `false`, `motivoNoContinua` **nunca** es `null` ni cadena vacía.

## Criterios de aceptación

Suite: `test/comprobacion/aceptacion-f08.dom.test.js`, un `describe` por criterio
con su texto literal, la mitad integrada **por la pantalla** (soltando el fichero
de verdad), sobre los ficheros reales del repo y los cuatro derivados de
`test/fixtures/gml/derivados/`.

1. Un `.gml` de parcela válido se parsea y llega al diagnóstico **sin pasar por
   edición ni generación**. ✅
2. Un GML con varias parcelas ofrece elegir; uno con SRS inesperado o coords fuera
   de huso lo indica **como nota, no como fallo**. ✅
   *Y sin una sola excepción en consola. El fixture de huso incoherente declara
   **25829** y produce el hallazgo real de 15 vértices fuera de huso — ver M6.*
3. La acción principal del diagnóstico por esta vía es «Descargar informe de
   contraste». ✅ *Y produce texto de verdad, no un fichero vacío.*
4. Un GML de edificio se encamina al contraste de construcción (F14), no al de
   lindero. ⚠️ **SE CUMPLE A MEDIAS, y se declara en vez de disimularse.**
   La mitad comprobable hoy —**que NO se encamina al contraste de lindero**— está
   implementada y testeada: `parsearGml` devuelve `parcelas: []` para el dialecto
   `BU`, `comprobarGml` da `puedeContinuar: false` y el cajón escribe *«Este GML
   describe una CONSTRUCCIÓN, no una parcela: … El contraste de edificio es otro
   recorrido y todavía no existe en esta aplicación, así que aquí el camino se
   acaba. Decírtelo es más honrado que llevarte a una pantalla que no mide lo
   tuyo.»* **La otra mitad no se puede cumplir: F14 no existe** (bloque C del
   índice, no empezado). Fingir un destino sería peor que decir que no.

## ⛔ Lo que la implementación MIDIÓ y esta spec (o el plan de la fase) decía de otra forma (2026-07-30)

Todo lo de esta tabla está comprobado en el código y fijado por un test, salvo donde
se diga que la medición es de navegador. Manda lo medido (regla de oro 8).

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M1** | **Ficheros: `gml/parse.js` (entrada ajena), recorrido corto en `viewer/`** | **Siete módulos nuevos de producción en dos capas nuevas** (`comprobacion/` y `report/`) y **doce tocados**. `gml/parse.js` **no se tocó**: F08 lo estrena como llamante, que era exactamente el reparto que su cabecera anunciaba (su fuente nombra a F08 **once veces**, cinco de ellas en la cabecera). Y el «recorrido corto en `viewer/`» son 13,3 kB minificados de cajón nuevo más 2,0 kB de crecimiento del de F07 |
| **M2** | «**Tercera** vía de entrada, al mismo nivel que RC y medición» | Es la **PRIMERA vía de fichero de la aplicación**. Medido con `git grep` sobre `a0e2a9d`: cero `<input type="file">`, cero `FileReader`, cero oyentes de `drop`/`dragover` en producción. Los parsers de F01 llevaban desde la fase 1 en verde **sin llamante en `app/`**. Consecuencia de diseño: el conector es **genérico** (`crearZonaFichero({extensiones, alFichero, alAviso})`, no sabe qué es un GML) para que F01 enchufe DXF/LIST/TXT **sin rehacer la UI**; F08 **no** cablea los parsers de CAD, que arrastrarían las detecciones de arcos, X/Y invertidas y cierre que no cierra |
| **M3** | «El **rastro lateral** muestra solo esos pasos» | **No existe ningún rastro lateral de pasos en esta app**, ni se ha creado: sería cromo nuevo que nadie ha pedido, y en un panel que reparte altura FIJA (la nota de `estilos/app.css`, que ya lleva tres entradas) costaría píxeles a la tabla de vértices. El «paso de Comprobación» es un **CAJÓN FLOTANTE sobre el mapa**, reutilizando el patrón que F07 midió y validó. El recorrido se lee en el propio cajón, que solo tiene dos salidas: «Contrastar con el parcelario» y «Descartar» |
| **M4** | El plan de la fase fijó el cajón en **`topright`** | **Las CUATRO esquinas del mapa ya estaban ocupadas**: `topleft` la barra de edición de F06, **`topright` el control de capas**, `bottomleft` el cajón de F07 y `bottomright` el control de opacidad más la atribución. Lo decía por escrito el JSDoc de `crearCajonDiagnostico`, que ya razonó que `bottomleft` era «la única esquina libre del visor». **Decisión: `bottomleft` COMPARTIDA con el cajón de diagnóstico, y mutuamente excluyentes por diseño** — la comprobación *precede* al diagnóstico y no coexiste con él, así que compartir esquina hace visible esa exclusión en vez de esconderla. Si algún día hicieran falta a la vez, Leaflet los apila en vertical: legible pero feo. Se prefiere que sea imposible |
| **M5** | **«`gml/parse.js` no está en el bundle»** (plan de la fase, citando `app/main.js:135`), y de ahí el riesgo «el paquete engorda de golpe» | ⛔ **FALSO, y lo era desde F05.** `services/_catastro-wfs.js:100` importa `parsearGml` desde entonces, así que **el lector ya estaba en el bundle**. Medido con atribución por *sourcemap* sobre las dos construcciones (F07 `a0e2a9d` y F08): `gml/parse.js` aporta **15,78 kB en las dos, delta 0,00**. El comentario de `app/main.js` decía la verdad sobre *la capa de aplicación* («no lo usa nadie **en la capa de aplicación**») y el plan la generalizó a «el bundle». El riesgo estrella de la fase no existía; los 68,38 kB que cuesta F08 son **código nuevo, todo él**. *(⚠️ El comentario que T5.1 escribió en `app/main.js` al borrar el viejo repite la generalización: dice «desde F08 el bundle SÍ arrastra `gml/parse.js`». La cifra que da —+30,98 kB al enchufar el paso 9— está bien medida, y la atribución por *sourcemap* la explica sin el lector: `comprobacion/gml.js` 9,19 + `comprobacion/_comun.js` 4,97 + `app/cableado-comprobacion.js` 7,94 + `app/zona-fichero.js` 4,50 + `gml/decodificar.js` 3,89 + el paso 9 de `app/main.js` ≈ **30,7 kB**. Lo demás —`report/` y el cajón— ya había entrado en las fases 4 y 3. Queda anotado aquí y en la deuda.)* |
| **M6** | El plan fijó **EPSG:25831** para el fixture de huso incoherente, «porque la parcela es de Málaga» | **Las dos cosas son falsas.** (a) **La parcela real `9398516VK3799G` es de MADRID**: su primer vértice `[439283.23, 4479671.27]` en huso 30 da **lon −3,7162° / lat 40,4655°**, y el `ldt` del OVC dice «CL SAN RESTITUTO 72(C) MADRID (MADRID)». (b) Leídas como **25831**, esas mismas coordenadas dan lon **+2,2838°**, que cae **DENTRO** del `BBOX_ESPANA` (lonMax 4,5) → **0 hallazgos**: el fixture habría prometido un caso que no contiene. Se usa **EPSG:25829**, que lleva la lon a **−9,7175°** (por debajo de lonMin −9,5) y produce el hallazgo real de **15 vértices fuera del huso 29**; hay prueba anti-vacuidad de que 25830 y 25831 **no** dispararían. La causa de fondo ya estaba escrita en `geo/huso.js` (hallazgo A1 de F00): cambiar el huso en ±1 desplaza la longitud ~±6° y casi siempre cae dentro de la ventana del vecino |
| **M7** | «Sin refcat en el fichero, se dice y el diagnóstico sale con las secciones que no la necesitan» | **`refcat` es `''`, no `null`** — el elemento `cp:nationalCadastralReference` está **presente y vacío**, tanto en `UTM_1.gml` (alta real de un particular) como en `cp_ejemplo_explicativo.gml` (la plantilla oficial del Catastro para un ALTA). Las dos formas significan cosas distintas y `comprobacion/gml.js` **las conserva tal cual**, así que la guarda del cableado **no puede ser `refcat !== null`**: normaliza con `services/catastro.js#normalizarRefcat`. Corolario que rompió el recorrido manual del plan: **el criterio 1 no se puede probar con la plantilla oficial**, porque sin referencia no hay parcelario que pedir y acaba con `geometriaOficial: null` y el CTA de F07 apagado *con su motivo* — comportamiento correcto, pero no es el criterio 1. **El único fixture con referencia catastral de verdad es la descarga del WFS** |
| **M8** | Contrato A: «se decodifica con el `encoding` declarado; si no se reconoce, `windows-1252`» | **`ISO-8859-1` no existe como decodificador en la plataforma web.** El estándar WHATWG Encoding **mapea las etiquetas `ISO-8859-1`, `iso-8859-1` y `latin1` al MISMO decodificador que `windows-1252`** (su superconjunto): `new TextDecoder('ISO-8859-1').encoding` devuelve literalmente `'windows-1252'`. Así que `encodingUsado` **nunca** puede valer `'ISO-8859-1'`, y comparar la etiqueta declarada con la usada para decidir si hubo desmentido daría un falso positivo en el caso más común de todos. `encodingUsado` reporta lo que la plataforma empleó de verdad, y el desmentido se decide por **los bytes**, no por las etiquetas |
| **M9** | El plan daba por hecho que un fallo dentro de `alFichero` se enteraría el llamante | **Una excepción lanzada dentro de un oyente del DOM NO sale por `dispatchEvent`** — ni en jsdom ni en el navegador. Se reporta como error **no capturado en `window`**: el llamante no se entera, el usuario ve que no pasa nada, y el único rastro queda en una consola que un técnico del Catastro no abre nunca. `app/zona-fichero.js` adopta el patrón de la casa (`MENSAJE_SUSCRIPTOR_ROTO` de `cableado-catastro.js`): atrapa la llamada, avisa con `NIVEL.ERROR` y vuelca el detalle. Consecuencia para el cableado: **cada fallo del recorrido se trata explícitamente ahí donde ocurre** |
| **M10** | «Guardián de la regla 9: el DOM del cajón y el texto del informe no contienen palabra de mérito» | **El guardián NO se puede aplicar al texto completo de un informe de producción ni al DOM entero de un cajón.** Sobre el recorrido real, `gml/decodificar.js` escribe «una sola secuencia **inválida**» y «El texto es **correcto**; lo que está mal es la etiqueta» (habla de **bytes**), y `validation/parcela.js` emite «El primer recinto no es un contorno EXTERIOR **válido**» (hecho **estructural**). Los dos son legítimos y se imprimen literales por la regla de oro 1. El guardián vigila **el vocabulario que cada módulo escribe**, no el que atraviesa desde capas inferiores — y hay un test que **documenta ese paso a través** y demuestra que, retirado el pasaje ajeno, lo propio queda limpio. Un guardián sobre el documento entero sería rojo permanente, y **un guardián que se apaga para no molestar no protege de nada** (`SPEC.md` §3.1) |
| **M11** | `reglasHuso(recintos, {srs})` como detector de «fuera de huso» | **Devuelve `[]` con dos significados OPUESTOS**: «todos los vértices caen donde dice el `srsName`» y «no hay `srs` con el que juzgar». Es un agujero de la regla de oro 1 dentro de `validation/`. F08 lo cierra **sin tocar esa capa**, distinguiéndolos desde arriba: `HUSO_VERIFICADO` frente a `HUSO_NO_COTEJABLE`. Y C2 se paga **dos veces a sabiendas** —la nota sale de la llamada explícita a `reglasHuso`, el hallazgo por vértice de `validarParcela`, que la hace por dentro— porque esconderle el `srs` a `validarParcela` sería apagar una regla de validación en silencio |
| **M12** | (no previsto) | **El `Buffer` de Node no es `instanceof Uint8Array` bajo jsdom.** `readFileSync` devuelve un `Buffer` del *realm* de Node y el `Uint8Array` global bajo jsdom es otro *realm*, así que la guarda de tipo de `decodificarGml` lo rechaza. Los bytes de un fixture se pasan **siempre** por `Uint8Array.from(...)` en los tests `dom`. **El test hermano del proyecto `node` no puede encontrar esto**, porque allí solo hay un *realm*: es exactamente la clase de fallo que justifica que `npm test` corra los dos proyectos |
| **M13** | Contrato B: `bloqueos` como la cara opuesta de `puedeContinuar` | **No lo es, y fundirlos habría convertido el gate en un veredicto.** Medido: `UTM_1.gml` trae `DIALECTO_RECHAZADO` de nivel **ERROR y continúa**. Un ERROR dice «esto está mal **en el fichero**»; `puedeContinuar` dice «**la app** puede o no puede». Lo que sí es invariante —y hay test sobre los nueve ficheros del repo más siete mutaciones del real— es que **todo camino a `puedeContinuar: false` trae además su ERROR**, así que `bloqueos` nunca se queda mudo cuando el recorrido se para |
| **M14** | C1, «área declarada discrepante», parecía pedir un umbral de tolerancia | **Un umbral está prohibido (regla de oro 9) y no hace falta.** La parcela real declara **1536** y mide **1535,865**: marcar eso sería acusar al Catastro de un redondeo. Como `areaValue` es **entero por override O6**, se compara **a la precisión con la que el fichero declara**. Cero parámetros libres. Cuadran la plantilla oficial, la descarga del WFS y el 3.0; solo discrepa el derivado sintético, que es para lo que se fabricó |
| **M15** | (no previsto) | **En `.gitattributes` el `*` NO cruza la barra.** `test/fixtures/gml/*.gml text eol=lf` **no alcanza** a `test/fixtures/gml/derivados/`: comprobado con `git check-attr -a`, que salía vacío sobre los derivados. Sin línea propia, git les habría reescrito los finales de línea según la máquina y el **SHA-256 publicado en su `PROCEDENCIA.md` habría dejado de reproducirse** — es decir, la receta de derivación habría dejado de comprobarse, que es lo único que separa a un fixture sintético de una opinión con formato de dato |
| **M16** | «Identificador de cabecera: *GML cargado · nombre.gml*» | **No se creó ningún identificador nuevo: se reutilizó el renglón de procedencia**, que dice más. Literal: *«Geometría del fichero «X.gml», NO del Catastro. Parcelario, solo para contrastar: …»*. Hay **un solo renglón de procedencia** en la pantalla porque hay **un solo dato del que hablar**; dos nodos serían dos verdades simultáneas sobre la misma parcela. Y la mitad que habla del Catastro la redacta la **misma función** que la vía de referencia catastral (`textoProcedencia`, exportada por esta fase), porque dos redacciones del mismo hecho divergen |

### Y tres más, que no salieron del código sino de **mirarlo en un navegador** (2026-07-30, guion 10)

Las tres primeras filas de esta tabla que **ningún test de la suite podía
producir**: dos son defectos de producción que el guion destapó en su primera
corrida y la tercera es una atribución falsa que se cayó al medir el paquete. Las
tres están **corregidas**, y las tres son de primera categoría — no erratas.

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M17** | `estilos/app.css` declaraba `font-family: var(--font-sans)` para los botones de los dos cajones, la regla estaba **escrita, puesta y revisada**, y el trabajo se daba por hecho | ⛔ **Era CÓDIGO MUERTO ENTERO, y los tres botones salían en `system-ui`.** Medido con `getComputedStyle` en navegador real: `"system-ui, sans-serif"` en «Contrastar con el parcelario», «Descartar» y «Descargar informe de contraste», frente al `"Geist Sans", …` de `--font-sans`. La causa es de cascada: los dos módulos fijaban **`font: 'inherit'` EN LÍNEA** sobre cada botón, ese atajo hereda el `font: 13px/1.45 system-ui` que el propio módulo pone **en el contenedor**, y **el estilo en línea gana a la hoja**. El comentario de la regla ya avisaba de que «el inline gana a esta regla» *para el estado apagado* y no cayó en que la familia iba por el mismo sitio. **Corregido en los MÓDULOS, no en la hoja**: los botones ya no fijan la familia (ponen `fontSize`/`lineHeight` heredados y el grosor) y la hoja se redujo a `font-family` sola, porque `font-size` y `font-weight` también eran letra muerta. Reparto escrito en los tres ficheros. **Guardianes** en `test/viewer/cajon-comprobacion.dom.test.js` y `test/viewer/cajon-diagnostico.dom.test.js` (ningún botón lleva `fontFamily` en su `style`, y sí conserva tamaño y relleno: mitad anti-vacuidad), sobre `style.fontFamily` y **no** sobre el atajo `style.font`, porque jsdom lo **serializa** desde las propiedades sueltas y nunca saldría `''`. **La lección es la de `SPEC.md` §3.1 repetida en una hoja de estilos: una protección que no llega a ejecutarse no protege** — y en jsdom no hay cascada, así que la suite estaba verde con el defecto vivo |
| **M18** | El pie del cajón de diagnóstico daba por hecho que su renglón de estado se leería: se escribe el desenlace y ya está | ⛔ **Pulsar «Descargar informe de contraste» CERRABA el cajón, y el acuse de recibo se escribía en un `role="status"` ya invisible.** Medido: `diagnosticoSigueAbierto: false` justo tras el clic. Cadena entera y verificada: `gml/descargar.js` cuelga el `<a download>` del `<body>` y lo pulsa; ese `click()` **burbujea hasta `document`**; ahí el guardián de clic-fuera de `viewer/cajon-diagnostico.js` hace `contains(evento.target)` sobre un anchor que **no** está en el cajón y lo cierra. `disableClickPropagation` no ayuda: no detiene el `click`, y su propia cabecera lo dice. **No es cosmético**: un `role="status"` en `display:none` sale del árbol de accesibilidad, así que la confirmación no llegaba a leerse **ni a anunciarse** — la **regla de oro 1 rota en el último gesto del recorrido**. **Corregido en `gml/descargar.js`, no en el cajón**: un oyente en fase de captura sobre el propio anchor que hace `stopPropagation()` (no impide la acción por defecto, así que la descarga sigue). El motivo de que vaya ahí está escrito: **este clic no es un gesto del usuario, es fontanería de la descarga**, y que un detalle de implementación sea observable por el resto de la app es el defecto; parchear a cada oyente repartiría el arreglo entre todos los que algún día escuchen en `document`. **Guardián** en `test/gml/descargar.dom.test.js`, con mitad anti-vacuidad (un botón normal SÍ se ve desde `document`) |
| **M19** | El comentario que T5.1 dejó en `app/main.js` al borrar el viejo: «**desde F08 el bundle SÍ arrastra `gml/parse.js`**» | ⛔ **Falso, y era la misma generalización de M5 escrita otra vez.** `services/_catastro-wfs.js` lo importa **desde F05**: el lector ya estaba dentro. Medido por *sourcemap* sobre las dos construcciones: `gml/parse.js` aporta **15,78 kB en F07 y 15,78 kB en F08 — delta 0,00**. La cifra que el comentario daba (+30,98 kB al enchufar el paso 9) estaba **bien medida**; lo que estaba mal era a qué se la atribuía, y se explica sin el lector: `comprobacion/gml.js` 9,19 + `comprobacion/_comun.js` 4,97 + `app/cableado-comprobacion.js` 7,94 + `app/zona-fichero.js` 4,50 + `gml/decodificar.js` 3,89 + el paso 9 ≈ **30,7 kB**. **Corregido con la medición delante.** La lección se dejó escrita: **«no lo usa nadie aquí» y «no está en el paquete» son afirmaciones distintas**, y la primera no autoriza a decir la segunda. Un comentario es documentación: si miente, miente con la autoridad del fichero en el que vive |

### Y TRES más, que no salieron de ninguna máquina: los encontró la **FIRMA HUMANA** (2026-08-02)

Las anteriores (M17–M19) las destapó el guion 10 en su primera corrida. **Estas tres
las destapó una persona mirando la pantalla**, haciendo la §9 del
`CHECKLIST-HUMANO.md`. Y hay dos cosas que decir antes de la tabla, porque son el
argumento entero de que ese gate exista:

1. **Dos de los tres no son de F08.** Vienen de **F03** (el encuadre) y de **F05**
   (las colindantes), y llevaban ahí desde entonces. F08 solo fue la fase que los
   puso a la vista, porque es la primera que carga una parcela **que no eligió la
   app**.
2. **Ninguno lo veía la suite, y ninguno lo veía el guion** — y las razones son
   distintas en cada caso, que es lo instructivo: **el encuadre**, porque *todas* las
   pruebas traen su geometría a mano y la app arranca ya encuadrada sobre ella, así
   que la pregunta «¿y cuando entra OTRA?» no se hacía en ninguna parte; **las
   colindantes**, porque *nadie afirmaba que se dibujaran* — no es que un test
   fallara: la afirmación no existía. Un gate no encuentra lo que no se le ocurre
   preguntar, y por eso el último es una persona.

Los tres están corregidos, con guardián en la suite, y **desde el 2026-08-02 los mide
el guion 10** (`GUION.md` §16, cifras allí): la regla del checklist es que lo
automatizable baja al guion y se borra de la lista manual, y se ha aplicado.

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M20** | El encuadre era el **paso 6 y último** del montaje de `crearVisor`, y ni la spec de F03 ni las de F05/F08 se preguntaron qué pasa **después** | ⛔ **`encuadrar()` se llamaba UNA sola vez, al construir el visor, y no había forma de repetirlo.** Se traía una parcela de Sevilla por referencia catastral, o se soltaba un GML de Cádiz, y **el mapa seguía mirando la parcela de demostración**. Consecuencia de producto, que es la que dolía: «traer geometría del Catastro» **parecía no tener feedback visual**, cuando el dibujo estaba perfectamente hecho — a cientos de kilómetros de la vista. **Corregido en `viewer/index.js` con un paso 7 nuevo**: una suscripción al store que reencuadra **cuando entra una parcela con OTRA identidad, y solo entonces**. La identidad es **`refcat ?? idLocal`** y **nunca la del objeto**, porque `edit/` reconstruye el POJO en cada operación (regla de oro 4) y comparar referencias diría «otra parcela» en **cada frame de un arrastre**; es la MISMA clave que `app/cableado-diagnostico.js#claveDeExpediente`, y las dos copias se nombran entre sí porque `viewer/` no puede importar de `app/`. Se expone además **`visor.encuadrar()`** para el gesto explícito. Caso límite resuelto y dicho en voz alta: una parcela **anónima** (sin refcat ni idLocal) **no mueve el mapa** —«otra» y «esta, editada» son indistinguibles— y **se avisa una vez**. **Por qué la suite no podía verlo:** todas sus pruebas traen su geometría a mano y la app arranca ya encuadrada sobre ella. **Medido en navegador (2026-08-02):** con `UTM_1.gml` la vista viaja **414,74 km** y sus 11 vértices caben en el lienzo; con el fichero del WFS —que es la misma parcela— **0,00 km**; y arrastrando un vértice, otro vértice que no se ha tocado se queda **en el mismo píxel** |
| **M21** | F05 traía las colindantes, F06 las usaba como dianas de enganche y F07 para la invasión: el dato **estaba y se usaba**, así que el trabajo se daba por hecho | ⛔ **No las pintaba NADIE.** Pulsar «Traer colindantes» no producía **ningún** acuse de recibo visual: la ficha decía «4 parcelas colindantes» y el mapa seguía exactamente igual. Que el dato se usara por dentro no lo arregla — **es la regla de oro 1 rota en el último tramo**, que es el peor sitio, porque el trabajo ya estaba hecho. **Corregido con `viewer/colindantes.js`** (módulo nuevo) y **`PANE.COLINDANTES` en zIndex 405**: el **único** pane del visor **por debajo** de la geometría propia, y no por gusto — el caso que lo decide es el normal, no el raro: **una vecina COMPARTE lindero con la propia**, y dibujada encima pondría gris el lado compartido, así que el técnico creería estar mirando su lindero mientras mira el de al lado. Contorno gris claro **`#CBD5E1`** de 1,5 px (elegido por descarte: ni verde, ni rojo, ni **ámbar** —que en este proyecto es la INVASIÓN y solo eso—, y **claro** porque los tonos oscuros desaparecen en las sombras de la ortofoto, la misma lección que llevó el color del usuario del violeta al amarillo) y **sin relleno visible**: `fill: true` con `fillOpacity: 0`, que no pinta ni un píxel y sin embargo hace que el interior entero responda al emergente — con `fill:false` Leaflet escribe `fill="none"` y apuntar a una línea de 1,5 px no es una función, es una prueba de puntería. Lo enchufa `app/main.js` como **TERCER suscriptor** de `alColindantes` (que es un `Set` justo para esto), con las parcelas **SIN aplanar**: F06 quiere recintos aplanados y esta capa quiere parcelas, porque el emergente necesita saber de quién es cada contorno. Y **se limpian en `viewer/index.js` con el MISMO cambio de identidad que dispara el reencuadre**, no desde los cableados: hay tres vías de entrada de parcela y todas pasan por el store; una llamada por cableado sería un cable que se rompe en silencio con la cuarta. **Por qué la suite no lo veía: nadie afirmaba que se dibujaran.** **Medido:** 4 contornos, en el pane 405 (< 410), emergente `9398501VK3799G` |
| **M22** | La vía del fichero escribía la parcela en el store y se daba por terminada: el campo «Referencia catastral» era cosa de la vía del Catastro | ⛔ **La referencia del GML no llegaba al campo, y los botones derivados se quedaban encendidos contradiciéndolo.** **Corregido en `app/cableado-comprobacion.js`**: se escribe la forma **CANÓNICA** —la que ha entrado en el modelo, nunca la cadena cruda del fichero: «9398516 vk3799g» y «9398516VK3799G» son la misma parcela y dejar en pantalla una forma distinta de la del modelo invita a dudar de cuál se ha cargado— y **el campo se VACÍA** cuando el fichero no trae referencia utilizable. Esto último es la **decisión CONTRARIA a la de la vía del Catastro**, y es deliberada: allí `null` significa «el servicio no ha confirmado lo que **tecleaste**», y lo tecleado es del usuario, así que borrárselo sería quitarle de las manos lo que estaba intentando; **aquí no hay nada tecleado que respetar** — hay un fichero que afirma que esta parcela no tiene referencia (`''`, el caso de `UTM_1.gml` y el de la plantilla oficial de alta; ver **M7**). Dejar la anterior sería **peor que el hueco**: el campo hablaría de una parcela que ya no está en pantalla, y —como «Deducir del mapa» y «Traer colindantes» se encienden mirando el **MODELO** y no el campo— dejaría **«Deducir del mapa» encendido al lado de una referencia perfectamente escrita**, que es lo único que ese botón promete que no hace falta. Y escribir el campo es **PINTAR, no consultar**: no dispara ninguna petición. **Medido:** `"9398516VK3799G"` con el fichero del WFS (deducir apagado, colindantes encendido) y `""` con `UTM_1.gml` (deducir encendido, colindantes apagado) |

**Un riesgo que se midió y quedó despejado** (no es una fila de la tabla porque no
contradice a nadie: era una duda razonable de M21). El emergente obliga a
`interactive: true`, y **una capa interactiva puede robarle el clic al mapa** — que
es «Deducir del mapa» de F05. No pasa: `L.Path` trae `bubblingMouseEvents: true` por
defecto, y `Map#_fireDOMEvent` solo se detiene ante un `false` explícito o un
`stop()`. Está medido **dos veces**: en la suite con un `MouseEvent` real sobre el
`<path>` de una vecina y un oyente en `mapa.on('click')` que se dispara **con su
`latlng`** (`test/viewer/colindantes.dom.test.js`, con un test aparte de que
`bubblingMouseEvents` sigue en `true`), y en navegador con la app entera viva
(`colindantes.clicAlMapa`: pinchando sobre una vecina a 3–9 px de un lindero propio
el mapa **selecciona ese lindero**; a más de 40 px, **deselecciona**). **La salida
está decidida de antemano** por si esa prueba cae algún día: la capa se queda **sin
emergente y con `interactive: false`** — el clic de F05 manda sobre el adorno.

> ⚠️ **Y un hecho estructural que solo se ve con la app entera delante**, anotado
> aquí porque ahorra una investigación: **la deducción por clic y unas colindantes
> dibujadas no pueden coexistir en esta aplicación**. La deducción se arma solo con
> una parcela **sin** referencia catastral (`puedeDeducirDe`), y las vecinas se piden
> **por** referencia y se sueltan en cuanto entra otra parcela. No es un defecto —es
> coherente: sin referencia no hay a quién pedirle vecinas—, pero significa que «el
> clic de deducción sobre una vecina» **no es un estado alcanzable**, y por eso el
> guion mide el burbujeo con la selección de lindero de F06 en vez de con una
> geocodificación inversa.

## Desviaciones deliberadas del enunciado, con su motivo

- **«Generar GML» se queda ENCENDIDO en esta vía.** La spec dice «no incluye
  Edición ni generación», y esto es un desvío del enunciado tomado a propósito: el
  valor que `gml/parse.js` declara por escrito para un fichero 3.0 es literalmente
  *«tu GML es de 2015, aquí está tu parcela»* — y el recorrido natural de ahí es
  **«te la reescribo en 4.0»**. Apagar el botón mataría el caso de uso más
  rentable de la fase. Lo que sí cambia es cuál es la acción **principal**.
- **«Descargar informe de contraste» vive DENTRO del cajón de diagnóstico, no en
  el pie.** Tres motivos: (1) es la acción que **consume** el diagnóstico, y el
  cajón es donde éste se lee; (2) el cajón tiene anchura y el pie no —un tercer
  CTA a lo ancho vuelve a costar los ~36 px que F07 ya pagó, y salen siempre de la
  tabla de vértices—; (3) sirve **igual de bien a las dos vías**: quien llegó por
  referencia catastral también quiere su informe, así que no hay que ramificar la
  interfaz por procedencia. El criterio 3 se cumple, y mejor.
- **El informe es de TEXTO hasta F09.** `report/contraste-texto.js` produce una
  cadena: cabecera con el nombre legal, qué se leyó del fichero, el contraste con
  las métricas de `diagnosticar()` —**con sus omisiones y el motivo de cada una**,
  y «No consta» donde haya `null`, jamás 0—, relación de vértices y un pie que dice
  que **no lleva plano, ni descripción del lindero, ni pie de firma**. Sin plano,
  sin PDF. Así el recorrido queda **cerrado y entregable desde el primer día** y
  F09 reutiliza los mismos datos en vez de reinventar el índice. El nombre es
  **«Informe de contraste con el parcelario catastral»**, nunca «Informe de
  validación gráfica»: VGA e IVG son documentos oficiales con CSV, y un nombre casi
  homónimo haría creer al cliente que ya se presentó.
  > **Al día en F09 (2026-08-02).** El desmentido decía además que el documento
  > firmable «es el de la fase F09 de esta herramienta y **todavía no existe**».
  > Ya existe, así que la frase se reescribió: sigue diciendo lo que este documento
  > no lleva, y ahora **remite** al que sí lo lleva por el nombre de su botón,
  > «Preparar informe (PDF)» (en el pie del cajón de diagnóstico, junto al de
  > texto). El de texto no se jubila: se compone **sin red** y baja igual el día
  > que el plano no se pueda armar.
- **El módulo del informe no lee el reloj.** La `fecha` se **inyecta**, misma regla
  que `gml/` y por el mismo motivo: un *snapshot* tiene que valer lo mismo dentro
  de un año.
- **El parcelario oficial se pide solo al aceptar la comprobación**, disparado por
  una **pulsación del usuario** («Contrastar con el parcelario»), que es el régimen
  del override O8 — el mismo que F07 fijó para las colindantes. Y **no se llama a
  `cablearCatastro().cargar()`**: ese camino hace `estado.set` con la geometría del
  WFS y **borraría la del fichero**, que es justo lo que hay que contrastar. F08
  llama a `cliente.parcelaPorRefcat(refcat)` y **compone**: `crearParcela({recintos:
  <del fichero>, geometriaOficial: <del WFS>, origen: ORIGEN_PARCELA.GML_EXISTENTE})`
  en **un solo `estado.set`**. `ORIGEN_PARCELA.GML_EXISTENTE` existía desde F00 y
  **nadie lo había usado nunca**.
- **Si la red falla, el recorrido no se cae.** La parcela entra igual con
  `geometriaOficial: null`, se dice, y el CTA de F07 se queda apagado **con su
  motivo escrito** (`MOTIVO_SIN_OFICIAL`, ya implementado). Y el error del WFS
  **llega con HTTP 200** (override **O14**): no se habla con la red a pelo ni se
  ramifica sobre el texto libre del `ExceptionReport` — se usa
  `services/catastro.js`, que ya clasifica con `TIPO_RESPUESTA_WFS`. Del mismo modo,
  la multiparcela del WFS se cuenta por `<member>` y **no** por `numberMatched`
  (override **O16**), que miente cuando se usa `count`.
- **Multiparcela sigue fuera de alcance** (`SPEC.md` §1). Se **elige una** con
  radios —una elección, no varias—, nunca se unen, y el cajón lo dice: las demás
  quedan en el fichero, no en el expediente.
- **La mecánica de descarga se EXTRAJO, no se copió.** `gml/descargar.js#descargarTexto`
  se queda con el `Blob → URL → <a download> → revoke` y `descargarGml` pasa a ser
  un llamante que solo aporta el MIME y el nombre; sus tests siguen en verde **sin
  tocarlos**, que es la señal de que la extracción fue una extracción. Este repo ya
  arrastra la deuda declarada de la cuarta copia de `describir` y no le hacía falta
  una segunda familia.
- **Catálogo propio `TIPO_COMPROBACION` (11 tipos)**, con la misma forma que
  `TIPO_GML` para que la vista pinte las tres familias sin adaptador. Hizo falta
  porque `TIPO_GML` se declara **cerrado** y ninguno de sus 25 tipos significa
  «fuera del huso declarado» ni «la superficie no cuadra». Los tres que sí faltaban
  a nivel de bytes (`BOM_PRESENTE`, `ENCODING_DESMENTIDO`, `ENCODING_SUPUESTO`) sí
  entraron en `TIPO_GML`, porque son del mismo escalón que el resto.
- **El choque de `ENCODING_DECLARADO` se resuelve por «manda quien MIDIÓ el
  hecho».** Si las detecciones del decodificador ya lo traen, se descarta el de
  `parsearGml` (que avisa de un riesgo ya resuelto, dirigido a un llamante que
  decodificó a ciegas) — **y el descarte se cuenta**, con una nota
  `DETECCION_SOLAPADA`. La regla alcanza solo a ese tipo: los tres `CIERRE_RETIRADO`
  de la multiparcela siguen siendo tres.
- **El renglón del cajón se llama `[data-estado="cajon-comprobacion"]`**, por el
  **componente** y no por la acción. Es la lección M8 de F07 aplicada antes de
  tropezar: dos valores que se diferencian en dos letras y un `querySelector` que se
  queda con el primero del documento dejan un renglón mudo y sin síntoma. Lo mismo
  con el del informe: `informe-contraste`, no `descargar-informe`.
- **`textoProcedencia` se EXPORTA desde `app/cableado-catastro.js`** en vez de
  redactarse otra vez: la mitad de la procedencia que habla del Catastro tiene que
  decir exactamente lo mismo —incluida la edad de la copia local—, y dos redacciones
  del mismo hecho divergen; la que se queda vieja siempre es la nueva.
- **El cajón de comprobación se monta con `comprobacion: false` por defecto** en
  `crearVisor`, para que el visor de F03/F06/F07 quede **idéntico** y sus pruebas
  intactas.

## Deuda declarada

### Los DOS defectos que el guion 10 destapó en navegador real (2026-07-30) — ✅ CORREGIDOS

> ✅ **CERRADO EL 2026-07-30, EL MISMO DÍA.** Lo que sigue se conserva **tal como se
> escribió** —con su «se corrige en…» en futuro— porque el hallazgo es el mérito del
> guion y borrarlo dejaría la fase pareciendo más limpia de lo que fue. Los dos
> defectos están arreglados, con guardián, y **verificados en una segunda corrida en
> frío que sale `ok: true`, `problemas: []`, `advertencias: []`**. El detalle de cada
> corrección está en **M17 y M18** de la tabla de arriba y en `GUION.md` §16.
>
> Dos cosas que conviene no perder de vista:
> 1. **Ninguno se arregló donde lo notó el guion**, y las dos veces la corrección fue
>    a un sitio distinto del que este texto suponía: la tipografía **a los módulos**
>    (la hoja no podía ganarle al estilo en línea) y el clic **a `gml/descargar.js`**
>    (no al cajón: el clic sintético del `<a download>` es fontanería de la descarga y
>    no debe ser observable por nadie más).
> 2. **La suite estaba VERDE con los dos defectos vivos**, y seguiría estándolo: uno
>    es de cascada CSS —que en jsdom no existe— y el otro es de burbujeo real hasta
>    `document`. Es la justificación entera de que este guion exista.

`scripts/smoke-navegador/10-comprobar-gml.js` se ejecutó y **salió `ok: false`.
No era la medida: eran dos defectos de PRODUCCIÓN**, y no se arreglaron desde el
guion a propósito —arreglarlos ahí habría escondido el hallazgo—. Los dos están
descritos con su causa medida y su fichero en `GUION.md` §16.

1. **Los tres botones de los dos cajones se pintan en `system-ui`, y la regla CSS que
   lo arreglaba es código muerto.** Medido:
   `getComputedStyle(boton).fontFamily === 'system-ui, sans-serif'` en «Contrastar con
   el parcelario», «Descartar» y «Descargar informe de contraste», frente al
   `"Geist Sans", …` de `--font-sans`. La causa es de cascada: `estilos/app.css`
   declara `font-family: var(--font-sans)` para esos botones, pero los dos módulos
   fijan **`font: inherit` EN LÍNEA** sobre cada uno, y **el estilo en línea gana a la
   hoja**. El comentario de esa regla ya avisaba de que «el inline gana» para el
   estado apagado, y no cayó en que la propia familia también va en línea. Se corrige
   en `viewer/cajon-comprobacion.js` y `viewer/cajon-diagnostico.js`, **no en la
   hoja**: mientras el inline esté, cualquier regla que se escriba allí es decorativa.
2. **Pulsar «Descargar informe de contraste» CIERRA el cajón de diagnóstico, y el
   desenlace se escribe donde nadie lo lee.** Medido: `diagnosticoSigueAbierto: false`
   justo después del clic, con el renglón `[data-estado="informe-contraste"]` diciendo
   «Descargado «contraste_….txt».» en un cajón que ya está en `display:none`. La
   cadena está verificada entera: `gml/descargar.js` cuelga el `<a download>` del
   `<body>` y lo pulsa; ese `click()` sintético **burbujea hasta `document`**, donde
   está el guardián de clic-fuera de `viewer/cajon-diagnostico.js`, que solo perdona
   los clics cuyo `target` cuelgue del cajón — y el anchor cuelga del `<body>`.
   `disableClickPropagation` no ayuda: no detiene el `click`, y su propia cabecera lo
   dice. **La consecuencia no es cosmética**: un `role="status"` en `display:none`
   sale del árbol de accesibilidad, así que la confirmación de que el fichero bajó —o
   el motivo de que no— no llega a leerse **ni a anunciarse**. Es la **regla de oro 1
   rota en el último gesto del recorrido de F08**. Se corrige en
   `viewer/cajon-diagnostico.js` o en `gml/descargar.js`, no en el guion.

### Los TRES defectos que destapó la FIRMA HUMANA (2026-08-02) — ✅ CORREGIDOS

> No se repiten aquí: están contados con su causa medida y su corrección en **M20,
> M21 y M22**, y sus cifras de navegador en `GUION.md` §16. Lo que sí se anota en la
> deuda es lo que dejan detrás:
>
> - **Dos de los tres eran de F03 y de F05**, no de F08, y llevaban ahí desde
>   entonces. La deuda que revelan no es de código: es que **una fase se cierra sin
>   preguntarse qué pasa cuando llega la SIGUIENTE**. F03 encuadró al montar y nadie
>   escribió «¿y cuando entre otra?»; F05 trajo las vecinas y nadie escribió «¿y
>   dónde se ven?». Las notas correspondientes están en
>   `spec/feature-03-visor.md` y `spec/feature-05-catastro-vivo.md`.
> - **La firma humana de la §9 no llegó a completarse**: encontró estos tres y se
>   paró. Hay que recorrerla entera otra vez, con las correcciones puestas.
> - **La deducción por clic y las colindantes dibujadas no coexisten** en esta app
>   (ver el aviso bajo M22). No es deuda, pero está anotado para que nadie pierda una
>   tarde intentando reproducir un estado que no es alcanzable.

### El resto de la deuda

- **El TERCER camino de la exclusión mutua de cajones queda sin resolver, y se
  dice.** Comparten `bottomleft`. T4.1 cubrió dos: cualquier `estado.set` cierra el
  de comprobación, y abrir el de comprobación cierra el de diagnóstico. El tercero
  —**pulsar «Diagnosticar encaje» en el pie con el cajón de comprobación abierto**—
  no se resuelve porque la única forma sería escuchar el clic del CTA de otra
  *feature*, y **ese cable se rompe en silencio**. Va al recorrido manual; si molesta
  de verdad, la solución limpia es que el cajón de F07 **pregunte** al de F08 al
  abrirse, no un oyente cruzado. **Y ya está medido lo que pasa cuando ocurre**
  (guion 10): los dos cajones apilados suman **946 px** de alto, el de comprobación
  sube a `y = −77` y **se sale del mapa por arriba** en un lienzo de 900. Solape entre
  ellos, 0 px². Es exactamente el «legible, pero feo» que el plan preveía — con la
  cifra delante.
- ~~**El comentario de `app/main.js` que sustituyó al viejo repite la generalización
  de M5.**~~ ✅ **CORREGIDO el 2026-07-30** (ver **M19**). Decía «desde F08 el bundle
  SÍ arrastra `gml/parse.js`» y el bundle lo arrastraba **desde F05** por
  `services/_catastro-wfs.js`. La cifra que daba estaba bien medida; lo que estaba mal
  era a qué se la atribuía. Reescrito con la medición por *sourcemap* delante
  (**15,78 kB en F07 y en F08, delta 0,00**) y con la lección al lado: «no lo usa nadie
  **aquí**» y «no está en el paquete» son dos afirmaciones distintas, y la primera no
  autoriza a decir la segunda. *Se anotó aquí como deuda porque la tarea que lo
  descubrió tenía prohibido tocar producción; corregirlo fue un paso aparte, y esa
  separación es la que hizo que el hallazgo no se perdiera.*
- **F01 sigue sin llamante.** F08 construye el mueble genérico y **no lo usa para
  DXF/LIST/TXT**: la zona de fichero acepta `.gml`/`.xml`. Enchufar los parsers de
  CAD es una tarea propia (arrastra arcos, X/Y invertidas y cierre que no cierra),
  no un efecto colateral de esta fase.
- **La deuda del presupuesto de altura del panel sigue siendo estructural.** F08 es
  la **tercera fase seguida que no toca el panel** (F06 se llevó las herramientas a
  una barra, F07 el diagnóstico a un cajón, F08 la comprobación a otro cajón y el
  botón al hueco de una fila que ya existía), pero la región de bloques **sigue
  repartiendo alto fijo** y el siguiente elemento que entre volverá a pagar de la
  tabla de vértices. La nota de `estilos/app.css` conserva a propósito las dos
  predicciones que no se cumplieron.
- **La cuarta copia de `describir`** que F07 declaró **sigue igual**: F08 no añadió
  una quinta (`comprobacion/_comun.js` tiene vocabulario propio, no un `describir`
  duplicado) ni la unificó. Se hereda la deuda tal cual.

## Ficheros que la fase creó y tocó de verdad

La spec original nombraba **uno y medio**. Son estos, contados con `git status` y
`git diff --stat`.

**Módulos nuevos de producción (7), en dos capas nuevas:**

| Fichero | Qué es |
|---|---|
| `gml/decodificar.js` | bytes → texto. BOM manda sobre el prólogo; sin BOM, UTF-8 en modo `fatal` como **prueba**; si pasa, es UTF-8 aunque el fichero diga otra cosa (`ENCODING_DESMENTIDO`); si falla, el declarado y si no `windows-1252` (`ENCODING_SUPUESTO`). **Nunca se decodifica en silencio** |
| `comprobacion/_comun.js` | `TIPO_COMPROBACION` (11 tipos) y el vocabulario en español de la capa |
| `comprobacion/gml.js` | **el corazón de la fase**: `comprobarGml(...) → Comprobacion`. Puro. Cruza `parsearGml` con `validation/parcela.js`, `validation/reglas-huso.js` y `geo/area.js` |
| `report/contraste-texto.js` | `informeContrasteTexto(...) → string`. Puro, no lee el reloj. **Estrena el directorio que `SPEC.md` §5 reservaba para F09** |
| `viewer/cajon-comprobacion.js` | el cajón (`bottomleft`, compartido con el de F07). Elegir parcela con radios, notas, bloqueos, «Contrastar» / «Descartar» |
| `app/zona-fichero.js` | DOM puro y **genérico**: botón + `<input type="file">` fabricado + arrastre sobre la ventana entera. No sabe qué es un GML |
| `app/cableado-comprobacion.js` | el recorrido de punta a punta, y el paso 9 del ensamblaje |

**Módulos tocados (12):** `app/main.js` (paso 9, fuera del `try` del Catastro y sin
`try` propio: si el cliente no se pudo montar, se comprueba el fichero igual y lo
único que se pierde es el parcelario; muere el comentario del bundle) ·
`app/cableado-catastro.js` (`textoProcedencia` pasa a exportarse; **ni una línea de
comportamiento**) · `app/cableado-diagnostico.js` (el gancho de la descarga del
informe) · `viewer/index.js` (opción `comprobacion` —booleano u objeto `{posicion}`,
`false` por defecto—, montaje y desmontaje atómico) · `viewer/cajon-diagnostico.js`
(pie nuevo con «Descargar informe de contraste», que **nace `disabled`** y escribe
su motivo cuando lo está) · `gml/descargar.js` (`descargarTexto` extraído;
`descargarGml` pasa a llamante) · `gml/_comun.js` (tres tipos nuevos en `TIPO_GML`) ·
`gml/index.js` (publica `decodificarGml`) · `index.js` (el barrel raíz: entran
`comprobacion` y `report`, **puras las dos**; no entra nada de `viewer/`, `app/` ni
`gml/descargar.js`) · `index.html` (el botón en la fila del rótulo, con su
razonamiento) · `estilos/app.css` (`.gml-boton--menudo`, el cromo del cajón, la
superposición de arrastre y la tercera entrada de la nota del presupuesto de altura) ·
`.gitattributes` (línea propia para `derivados/`, ver M15).

**Material de prueba nuevo:** `test/fixtures/gml/derivados/` con su `PROCEDENCIA.md`
propio, que dice **en la primera línea que son sintéticos**, de qué fichero real
salen, qué se les cambió y con qué SHA-256 tiene que reproducirse la receta. Los
cuatro: `cp_multiparcela_entrega.gml` (tres `gml:featureMember` en el sobre ENTREGA),
`cp_huso_incoherente.gml` (**25829**, ver M6), `cp_srs_no_soportado.gml` (4326) y
`cp_area_discrepante.gml` (`areaValue` alterado 40 m²). **Los casos que ya tenían
material REAL no se fabricaron**: el 3.0 es `UTM_1.gml`, el edificio son los dos
`bu_*.gml`, y la multiparcela de descarga es `wfs-neighbour-9398516VK3799G.xml` con
sus cinco `<member>` de verdad. Un fixture sin procedencia es una opinión con
formato de dato, y este proyecto ya pagó un rechazo del IVG por derivar del fichero
real equivocado (`SPEC.md` §3.1).

**Tests nuevos (9 ficheros):** `test/gml/decodificar.test.js` ·
`test/gml/fixtures-derivados.test.js` · `test/comprobacion/gml.test.js` ·
`test/report/contraste-texto.test.js` · `test/viewer/cajon-comprobacion.dom.test.js` ·
`test/app/zona-fichero.dom.test.js` · `test/app/comprobacion.dom.test.js` ·
`test/app/main-comprobacion.dom.test.js` ·
`test/comprobacion/aceptacion-f08.dom.test.js` (los cuatro criterios con su texto
literal, la mitad por la pantalla, más el **guardián de la regla 9** en tres frentes).

**Tests ampliados (7 ficheros):** `test/contrato.test.js` (contrato F08: las tres
funciones puras salen por el barrel y funcionan **encadenadas sin DOM** sobre el
fichero real; la ENTREGA no sale por ningún sitio) · `test/gml/descargar.dom.test.js` ·
`test/viewer/index.dom.test.js` · `test/viewer/cajon-diagnostico.dom.test.js` ·
`test/app/diagnostico.dom.test.js` · `test/app/main-gml.dom.test.js` ·
`test/app/main-edicion.dom.test.js`.

**El guardián de la regla 9 se afinó**: el patrón
`/^(puede|ok|valido|apto|aprobado|dentro|cumple|semaforo|umbral)/i` **lleva `puede`
desde esta fase**. Sin él, la «única excepción» (`puedeContinuar`) era decorativa
—el patrón original no la cazaba— y tampoco habría cazado un `puedeGenerar` o un
`puedeSubir` colándose por la puerta de atrás.

Suite completa al cierre (2026-07-30): **3.845 pruebas en 89 ficheros** — F07 dejó
3.312 en 80, así que F08 añade **+533 pruebas y +9 ficheros** — exactamente los nueve
ficheros de test nuevos de la lista de arriba. *(Las cinco últimas son los guardianes
de M17 y M18, que entraron después de que el guion 10 destapara los dos defectos: van
en ficheros que ya existían, y por eso suman pruebas y no ficheros.)*

### Y lo que añadió la FIRMA HUMANA, después (2026-08-02)

Los tres arreglos de **M20, M21 y M22**. Se listan aparte a propósito: **dos de ellos
no son código de F08**, y meterlos en la lista de arriba haría parecer que la fase
tocó `viewer/` más de lo que lo tocó.

| Fichero | Qué es |
|---|---|
| `viewer/colindantes.js` | **nuevo (módulo 8 de producción)**. La capa de parcelas vecinas: un contorno gris fino por colindante, con su referencia catastral en un emergente. SOLO-NAVEGADOR (importa Leaflet), así que **jamás entra en el barrel raíz** — lo vigila `test/contrato.test.js` |
| `test/viewer/colindantes.dom.test.js` | **nuevo (fichero de test 10)**. Incluye el guardián del riesgo: un `MouseEvent` real sobre el `<path>` de una vecina y el `mapa.on('click')` disparándose **con su `latlng`**, más un test aparte de que `bubblingMouseEvents` sigue en `true` |
| `viewer/_comun.js` | `PANE.COLINDANTES` y su entrada en `PANES` con **zIndex 405**, con el razonamiento de los tres porqués. `crearMapa` **itera** esa lista, así que añadir la entrada es todo lo que hace falta |
| `viewer/index.js` | el **paso 7** (reencuadre vivo + limpieza de vecinas), `claveDeParcela`, la opción `colindantes` (booleana, **sin** forma de objeto: la capa no tiene ninguna opción de montaje) y `visor.encuadrar()`. `encuadrar` se partió en `encuadrarGeometria` (la rama 1 aislada) + la cascada |
| `app/main.js` | `colindantes: true` en el paso 5 y el **tercer suscriptor** de `alColindantes` en el paso 7 (`pintarColindantes`), con las parcelas **sin aplanar** |
| `app/cableado-comprobacion.js` | el campo de la referencia: forma canónica, y **vaciado** cuando el fichero no trae referencia utilizable |
| `scripts/smoke-navegador/10-comprobar-gml.js` | las tres medidas nuevas (§17 del guion), el tercer fixture (`UTM_1.gml`) y el arrastre sintético de vértice |

Suite tras la firma humana (**2026-08-02**): **3.925 pruebas en 90 ficheros** —
**+80 pruebas y +1 fichero** sobre el cierre del 30 de julio; el fichero es
`test/viewer/colindantes.dom.test.js`. Las ampliaciones van a
`test/viewer/index.dom.test.js` (el reencuadre y su mitad importante: **editar no
mueve el mapa**, más la parcela anónima que avisa una vez),
`test/app/main-edicion.dom.test.js` (que los suscriptores de `alColindantes` siguen
siendo **TRES**: si algún día bajan, alguien ha desenchufado a uno) y
`test/app/comprobacion.dom.test.js` (el campo canónico y el campo **vaciado**). Que
`viewer/colindantes.js` no se cuele en el barrel raíz lo cubre el guardián genérico
que `test/contrato.test.js` ya tenía.

### Coste en el paquete

Medido con `npm run build` el 2026-07-30, y **atribuido fichero a fichero** con las
dos construcciones y sus *sourcemaps* (F07 se reconstruyó desde `a0e2a9d` en un
*worktree* aparte y reprodujo sus cifras al kilobyte):

| | F07 | F08 | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 481,93 kB | **550,31 kB** | **+68,38 kB** (+14,2 %) |
| `dist/assets/index-*.css` | 43,64 kB | **45,95 kB** | +2,31 kB |
| `dist/index.html` | 22,90 kB | **25,44 kB** | +2,54 kB |
| *(gzip del JS)* | 157,01 kB | **177,93 kB** | +20,92 kB |

**Ni una dependencia nueva en el grafo.** Los 68,38 kB son código propio, y así se
reparten (bytes minificados, atribuidos por *sourcemap*; suman 67,88 de los 68,38 —
el resto es andamiaje de módulos):

| Fichero | Δ | |
|---|---|---|
| `report/contraste-texto.js` | **+17,54 kB** | nuevo. El más caro de la fase, y buena parte es **texto**: quitados los comentarios quedan 27,6 kB de fuente, de los que **10,1 kB (37 %) son literales de cadena** — los rótulos de las once secciones del informe, en español presentable tal cual |
| `viewer/cajon-comprobacion.js` | **+13,29 kB** | nuevo |
| `comprobacion/gml.js` | **+9,19 kB** | nuevo |
| `app/cableado-comprobacion.js` | **+7,94 kB** | nuevo |
| `comprobacion/_comun.js` | **+4,97 kB** | nuevo |
| `app/zona-fichero.js` | **+4,50 kB** | nuevo |
| `gml/decodificar.js` | **+3,89 kB** | nuevo |
| `viewer/cajon-diagnostico.js` | +2,00 kB | el pie del informe |
| `app/cableado-diagnostico.js` | +1,94 kB | el gancho de la descarga |
| `gml/descargar.js` | +1,31 kB | `descargarTexto` |
| `viewer/index.js` | +0,88 kB | la opción `comprobacion` |
| `app/main.js` + `gml/_comun.js` + otros | +0,45 kB | el paso 9 y los tres tipos nuevos |
| **`gml/parse.js`** | **0,00 kB** | **⛔ ya estaba en el bundle desde F05** (ver M5) |

**Atribuirle el salto al lector sería falso**, y era la explicación que el plan tenía
preparada. Lo que cuesta la fase son sus **siete módulos nuevos** —con sus cabeceras
de razones y sus textos en español, el precio de la regla de oro 1, pagado a
sabiendas igual que en F06 y F07—. El CSS es el cromo del cajón, la variante menuda
del botón y la superposición de arrastre; el html, el botón de la fila del rótulo
con sus comentarios de contrato.

**Y lo que costaron los tres arreglos de la firma humana** (`npm run build` del
2026-08-02): el JS pasa de **550,31 kB a 554,64 kB** (**+4,33 kB**; gzip 177,93 →
**179,19 kB**), y son `viewer/colindantes.js` más el paso 7 de `viewer/index.js` y
el suscriptor de `app/main.js`. El html se queda igual (**25,44 kB**) y el CSS
prácticamente igual (45,95 → **45,90 kB**): **la capa de vecinas no lleva ni una
regla de hoja** —comprobado, `estilos/app.css` no menciona `gml-colindante`—,
porque todo lo que la hace visible va en las opciones de Leaflet: `viewer/*` no
carga CSS, y las clases que exporta son solo un asidero estable por si algún día
hace falta afinar el cursor o la impresión. **Ni una dependencia nueva**, otra vez.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que soltar un fichero de verdad funcione.** jsdom (29.1) **no implementa
  `DataTransfer` ni `DragEvent`**: en la suite el `drop` se fabrica con un `Event` y
  un doble de `dataTransfer`. El arrastre real, con un fichero real, solo lo firma un
  navegador.
- **Que la descarga del informe produzca BYTES.** En jsdom el `<a download>` no
  descarga nada; lo que se comprueba es que se llama, con qué texto y que la URL se
  revoca.
- **Que los dos cajones no se tapen entre sí** ni tapen la barra de edición de F06,
  y **que la caja de vértices siga en 267 px** — el invariante que demuestra que la
  Decisión del botón en la fila del rótulo se cumplió, y que hay que medir **en el
  mismo tick del clic** (la primera versión del guardián de F07 acusó al cajón de
  11 px que eran de otros renglones hablando después).
- **El tercer camino de la exclusión mutua** (pulsar «Diagnosticar encaje» con el
  cajón de comprobación abierto): declarado, no resuelto, y hay que mirarlo a mano.
- **Que `validarParcela` sobre un GML ajeno malo no empuje el panel.** La lista de
  avisos tiene tope (`34vh`) y scroll propio desde F05 y el bloque cede altura, pero
  con una tanda larga de hallazgos hay que **verlo**.
- **Si alguna nota de la comprobación se LEE como un juicio sobre el trabajo de otro
  técnico** aunque el texto no lo diga. Es el riesgo de producto de esta fase —no el
  técnico— y no lo firma ninguna máquina.
- **Que el mapa VIAJE a la parcela que entra** y que **no se mueva al editar**
  (M20), y **que las parcelas vecinas se DIBUJEN** (M21). Se añaden a esta lista
  *después* de que la firma humana los encontrara, y con el motivo escrito, porque es
  la parte instructiva: la suite **no podía** verlos —todas sus pruebas traen su
  geometría a mano y la app arranca ya encuadrada sobre ella; y de las colindantes
  **nadie afirmaba que se dibujaran**—. **Ahora sí hay guardián en la suite** para las
  dos cosas, y además las mide el guion 10 desde el 2026-08-02.

Los cinco primeros los mide **`scripts/smoke-navegador/10-comprobar-gml.js`**, que ya
se ha ejecutado (§16 del `GUION.md`, cifras de referencia allí); los dos últimos
también, desde el 2026-08-02. El de la lectura es el punto **BLOQUEANTE** de la
sección 9 del `scripts/smoke-navegador/CHECKLIST-HUMANO.md`, que hereda el carácter
bloqueante de la §8. Y hay uno que **tampoco firma el guion**: que el arrastre
funcione **con una mano de verdad** — `/browse` no tiene comando `drag` y su lista
blanca de CDP no incluye el dominio `Input`, así que el `drop` del guion también es
sintético, aunque con un `File` de bytes reales.

> **La lección de esta lista, y es la de la fase entera:** que algo esté aquí
> escrito es lo que hace que se mida en alguna parte. Los dos últimos puntos **no
> estaban**, y por eso nadie los midió durante cinco fases. La escribió una persona
> mirando la pantalla, no un test.

## Estado

**F08 NO está cerrada: falta la firma humana.** Y ya no es una formalidad pendiente:
**se recorrió una vez el 2026-08-02, encontró TRES defectos reales y no llegó a
firmarse** (M20, M21, M22). Los tres están corregidos y medidos; hay que volver a
recorrer la lista con las correcciones puestas.

Código y pruebas en verde (**3.925 pruebas en 90 ficheros**, 2026-08-02),
`npm run build` construye limpio (**554,64 kB JS · 45,90 kB CSS · 25,44 kB html**;
gzip del JS **179,19 kB**) y `npm run validar:xsd -- --estricto` pasa con
`python + lxml` sobre `cp/4.0` a secas, que es lo que carga el validador del IVG —
`parcela-entrega.gml` y `cp_ejemplo_explicativo.gml`, los dos OK.

✅ **El guion `10-comprobar-gml.js` se ha ejecutado en navegador real y sale
`ok: true`, `problemas: []`, `advertencias: []`** — tres veces ya: las dos del
2026-07-30 (§16 del `GUION.md`) y la del **2026-08-02**, esta última con **las tres
medidas nuevas dentro**, en frío, puerto 5173: consola limpia, 0 excepciones no
capturadas, **2 peticiones de datos** (GetParcel 2.878 B / 44 ms + GetNeighbourParcel
11.969 B / 129 ms, las dos 200), **2,20 s**, la caja de vértices en sus **267 px** y
el cajón sin solapar ninguno de los cinco controles del mapa. **Ninguna de las cifras
anteriores se movió con los tres arreglos**, y eso es lo que permite decir que
arreglaron lo que se dijo y nada más.

⛔ **Y lo que hay que recordar de esta fase son las DOS tandas de defectos, no una.**
El guion destapó dos que la suite no podía ver (M17, M18). **La firma humana destapó
otros tres que el guion tampoco veía** (M20, M21, M22), **dos de ellos heredados de
F03 y de F05**, y los tres eran la misma cosa: **la aplicación hacía el trabajo y no
lo enseñaba** —la regla de oro 1 rota en el último tramo, tres veces—. La diferencia
entre las dos tandas es la que importa: los del guion fallaban una afirmación que
existía; los de la firma humana **no fallaban nada, porque la afirmación no estaba
escrita**. Un gate no encuentra lo que no se le ocurre preguntar.

⛔ **Pero la PRIMERA corrida salió `ok: false`, y eso es lo que hay que recordar de
esta fase.** No era la medida: eran **dos defectos de producción** que ningún test de
la suite podía ver —uno de cascada CSS, que en jsdom no existe, y otro de burbujeo
real hasta `document`—, y uno de ellos era **la regla de oro 1 rota en el último gesto
del recorrido**: la confirmación de que el informe había bajado se escribía en un
`role="status"` que el propio clic acababa de dejar invisible. **La suite estaba verde
con los dos vivos y lo habría seguido estando.** Están corregidos, con guardián y con
prueba de que el guardián dispara (M17, M18); la descripción original se conserva sin
retocar en «Deuda declarada», porque encontrarlos fue el mérito del guion y no un
borrón que disimular. Ninguno se arregló donde se notó, y las dos veces la corrección
fue a un sitio distinto del que se suponía.

Falta la **firma humana** del `CHECKLIST-HUMANO.md`, cuya sección 9 trae esta fase
con su punto BLOQUEANTE (si alguna nota se lee como un veredicto sobre el trabajo de
otro técnico): la cadena de firmas pasa a ser **F03 → F05 → F06 → F07 → F08** y se
firma toda junta. **Que la suite esté verde y el build limpio no cierra la fase**: son
necesarios, no suficientes (`SPEC.md` §6).

Y queda **el criterio 4 cumplido a medias por dependencia externa**: el
encaminamiento del GML de edificio al contraste de construcción no puede hacerse
hasta que exista **F14**. No es deuda de esta fase; es alcance de otra.

## Referencias

Plan §7.2, §18 Fase 8. Dossier §1.1/§1.2 (dialectos parcela/edificio), §1.5
(detección de 3.0). `SPEC.md` §7 (la pregunta que la Sede dejó abierta), §3
overrides **O1**, **O6**, **O8**, **O14**, **O16**.
`spec/feature-04-gml-parcela.md` §5 (el punto que esta fase cierra) ·
`spec/feature-09-informe-parcela.md` §Nombre y §Contenido (F08 escribe la versión
de texto de ese índice).
Plan de ejecución de la fase:
`~/.claude/plans/vamos-con-f08-el-plan-wondrous-candle.md` (sus contratos congelados
se corrigen aquí donde la implementación midió otra cosa: M4, M5, M6, M7, M13).
