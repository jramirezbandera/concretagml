# F22 · El DXF del Catastro: elegir la parcela y quedarse el parcelario

**Fase:** 22 · **Prioridad:** P13c (Bloque B; ver §Dónde encaja) · **Riesgo:** Medio
(el riesgo NO está en la geometría —M6 lo mata el primer día— sino en el cajón: la
pieza que la entrevista dio por reutilizable **no hace lo que se le supuso**, M7) ·
**Depende de:** F01 (`parsers/dxf.js` y `parsers/importar.js`), F05/F06
(`viewer/colindantes.js` y su pane, ya con llamante), F08 (el patrón «el fichero trae
varias parcelas → cajón» y el gancho `alPedirEleccion`), F11 (el `<dialog>` de reparto
por capas), F18 (`app/cableado-medicion.js`, la entrada de `.dxf`, y el cuarto estado
de `rotuloDelDato`) ·
**Habilita:** que el DXF que el técnico ya descarga del Catastro **entre**, y que de
paso traiga el parcelario del entorno **sin red**.

**Ficheros previstos:** nuevos — `parsers/topologia.js` **(✅ fase 1, no estaba previsto:
el plan dejaba la casa del detector sin decidir)**, `viewer/cajon-parcelas.js` **(✅ fase 3)**,
`viewer/candidatas.js` **(✅ fase 3, no estaba previsto: ver la desviación de esa fase)**
y `scripts/smoke-navegador/24-parcelario-dxf.js` **(✅ fase 5)**. Tocados —
`parsers/dxf.js` (los rótulos), `parsers/importar.js` (el bloqueo nuevo y la
asociación) **✅**, `app/cableado-medicion.js` (el desvío al cajón y el destino de las
otras siete) **✅**, `app/dialogo-importacion.js` (que deje de ofrecer una salida que no lo
es) **✅ — la fase 5 le cobró además el texto que la 1 dejó provisional (M34)**,
`viewer/index.js` (la bandera de montaje) **✅**, `app/main.js` (el sexto rótulo y la
segunda fuente de colindantes) **✅**, `estilos/app.css` **⛔ NO se ha tocado: 0 B, y no por
suerte** — los módulos del visor se estilan en línea a propósito.
⭐ **Ni `model/`, ni `package.json`** — la topología que hace falta ya está en el grafo
(M6).

**Estado:** ✅ **HECHA y en verde el 2026-08-09** (7.338 pruebas / 172 ficheros; guion
`24-parcelario-dxf.js` en `ok:true` a 1280×720). Sin commitear: el árbol lo comparte otra
sesión. ⏳ **Pendiente la firma humana** (`CHECKLIST-HUMANO.md` §20), cuyo punto 20.1 es
BLOQUEANTE: que un técnico reconozca su parcela entre las ocho sin que se lo expliquen.

> ⏳ **Ficha abierta con el plan.** Lo que aquí se afirme del futuro y resulte falso
> **no se borrará**: se conserva citado al lado de lo medido. Manda lo medido
> (regla de oro 8).

## Objetivo

**Que el DXF de «Consulta Masiva» del Catastro deje de morir en un bloqueo.**

Es la vía por la que un técnico saca el parcelario del Catastro a CAD, así que va a
llegar mucho. Hoy llega y no entra: la aplicación dice «No ha entrado ninguna parcela de
ese fichero» después de haberle pedido al usuario que elija una capa **que no arregla
nada** (M4).

Y hay un segundo objetivo que sale gratis del primero: ese fichero **es** el parcelario
del entorno. Elegida la parcela del expediente, las demás son sus colindantes, y la capa
que las dibuja existe desde F05 con la forma exacta que este fichero produce (M8). El
DXF pasa a hacer sin red el trabajo que hoy solo hace el WFS.

## ⛔ El defecto, y por qué no es un fallo del parser

`parsers/dxf.js` leyó el fichero **bien**. Lo que falla es el reparto de
`parsers/importar.js`, paso 5: *«`recintos[0]` es el EXTERIOR y todo lo demás HUECO»*.

Esa regla ya se rompió una vez —F11 la documentó en su cabecera, con los −390,45 m² de
`UTM.dxf`— y F11 le puso **dos guardas**: `ANILLOS_EN_VARIAS_CAPAS`, cuya salida es
elegir capa, y `SUPERFICIE_NO_POSITIVA`, «la prueba, no la causa». Este fichero pasa la
primera guarda y muere en la segunda, **y ahí se acaba el camino**: la salida que la
aplicación ofrece —elegir capa— ya se ha gastado.

⛔ **El problema de fondo es que `SUPERFICIE_NO_POSITIVA` confunde dos cosas que no se
parecen en nada**: unos anillos que se solapan mal (el dato está roto) y **N parcelas
disjuntas** (el dato está perfecto y lo que sobra es nuestra regla). Al usuario se le
dice «revisa qué anillos del fichero son de verdad la parcela» cuando la respuesta
honrada es «hay ocho, dime cuál es la tuya» — y la aplicación **puede demostrar** que
son ocho (M6) y **puede nombrarlas una a una** (M5).

## Las cuatro decisiones (entrevista del 2026-08-09)

1. ⭐ **Las otras siete entran como COLINDANTES.** La elegida ocupa el expediente; las
   demás se quedan como parcelario vecino, por la capa de F05. Es lo que convierte un
   arreglo en una vía nueva.
2. ⭐ **Entra como geometría OFICIAL si el fichero trae la capa `RefCatastral`**; sin
   ella, como MEDICIÓN, que es lo que decidió F18. **El criterio sale del dato, no de un
   fingerprint**: esa capa es a la vez la huella de la descarga del Catastro y la que da
   la referencia de cada finca.
3. **Se elige sobre el MAPA**, no en la ventana de revisión. Ocho fincas vecinas se
   distinguen por dónde están. ⚠️ **Esta decisión se tomó suponiendo que el cajón
   existente ya resaltaba la candidata, y eso es FALSO (M7).** La decisión se mantiene;
   lo que cambia es que el resalte hay que construirlo, y eso es de dónde sale el riesgo
   Medio de la fase.
4. **Las 168 huellas de «Construccion» NO entran**, pero se nombran. La rama EDIFICIO
   tiene su propia entrada y su propia regla de partes; meterla aquí sería meter F11 y
   F12 dentro de esta fase.

## Mediciones (2026-08-09, sobre `icuc-pruebas/ConsultaMasiva_ (90).dxf`)

**M1 · Qué es el fichero.** No es el plano de una parcela: es **una manzana entera**.
Sección ENTITIES: **176 POLYLINE** (1.888 VERTEX, 176 SEQEND) y **161 TEXT**. Cuatro
capas: `Construccion` ⇢ 168 polilíneas, `Parcela` ⇢ **8**, `txtConstru` ⇢ 153 textos
(rótulos de planta: `II`, `-I+I+EPT`, `POR`, `JD`…) y `RefCatastral` ⇢ **8 textos**.
Ni un INSERT, ni un HATCH, ni un SPLINE: **ninguna entidad no soportada**.

**M2 · Los 8 anillos de «Parcela» son 8 parcelas DISTINTAS**, con su referencia y su
superficie (shoelace de `geo/area.js`):

| referencia | superficie | vértices |
|---|---:|---:|
| 6346726UF8664N | 548,05 m² | 17 |
| 6346725UF8664N | 444,11 m² | 11 |
| 6346714UF8664N | 655,70 m² | 14 |
| 6346713UF8664N | 1.098,85 m² | 17 |
| 6145925UF8664N | 862,78 m² | 27 |
| 6346306UF8664N | 5.165,36 m² | 70 |
| 6247108UF8664N | 645,85 m² | 30 |
| 6145924UF8664N | 541,79 m² | 26 |

**M3 · El número del bloqueo cuadra exactamente**, y conviene tenerlo escrito porque es
lo que prueba que la causa es la regla y no el dato: `548,05 − (444,11 + 655,70 +
1.098,85 + 862,78 + 5.165,36 + 645,85 + 541,79)` = **−8.866,39 m²**, que es literalmente
lo que la aplicación enseña.

**M4 · ⛔ Elegir la capa «Parcela» NO lo arregla.** Medido: `importar(texto, {capa:
'Parcela'})` devuelve `construida: false` y `bloqueos: ['SUPERFICIE_NO_POSITIVA']`. La
ventana de revisión pide una decisión, la decisión se toma, y el resultado es el mismo
callejón. **Ofrecer una salida que no lo es es peor que no ofrecer ninguna**: el usuario
gasta su confianza y acaba donde estaba.

**M5 · ⭐ El fichero trae la respuesta dentro, y hoy la tiramos como «anotación».** Los 8
TEXT de `RefCatastral` caen **uno y solo uno** dentro de cada anillo — verificado con
punto-en-polígono: **8 coincidencias 1:1, cero ambigüedad, cero rótulos huérfanos**. Hoy
`parsers/dxf.js` los mete en `ENT_ANOTACION` y los resume en el «Se ignoraron 161
anotación(es)» que sale en pantalla.

**M6 · ⭐ La disjunción se DEMUESTRA, y cuesta cero dependencias.** 28 pares,
`intersect(featureCollection([a, b]))`: **0 lanzaron**, **0 pares con solape**, solape
máximo **0,000 m²**, **21,94 ms** el barrido entero. Y `booleanContains` dice que
**ninguno** de los anillos 1..7 está dentro del 0 (**0 de 7**) y que en **0 de 28** pares
uno contiene al otro. Los dos módulos —`@turf/intersect` y `@turf/boolean-contains`— ya
están en el grafo por `validation/reglas-topologia.js`.
⚠️ **Y una trampa medida al pasar: `@turf/area` NO está instalado** (`ERR_MODULE_NOT_FOUND`
al importarlo). Es la regla de oro 5/6 haciendo su trabajo: la superficie sale de
`geo/area.js` y de ningún otro sitio. Quien implemente esto que no lo añada.

**M7 · ⛔ CORRIGE LA ENTREVISTA: el cajón que existe no hace lo que se le supuso.**
La decisión 3 se recomendó diciendo que en el cajón de comprobación «recorres las
candidatas y cada una se resalta sobre la cartografía». **Medido: eso no pasa.**
`cajon.alElegir → pintar(indice) → cajon.pintar(comprobarFuente(indice))` **solo repinta
el cajón**; la geometría no llega al mapa hasta pulsar el botón primario, que es el que
hace `estado.set`. La lista de miembros son radios con texto (`pintarMiembros`) y nada
más.
Y hay una segunda mitad: **`cajon.pintar(c)` está acoplado a la forma de una comprobación
de GML** — lee `c.dialecto.etiqueta`, `c.dialecto.queSignifica`,
`c.fichero.{encodingDeclarado, encodingUsado}`, `c.hallazgos`, `c.notas`, `c.bloqueos` y
un `pintarGate(c)`. Un DXF **no tiene** dialecto ni codificación declarada, y fabricárselos
para encajar sería inventar datos para poder reutilizar una vista. Por eso el plan lleva
**cajón propio** (`viewer/cajon-parcelas.js`) y no «generalizar el de comprobación».

**M8 · ⭐ La capa de colindantes encaja sin tocarla.** `viewer/colindantes.js#crearCapaColindantes`
→ `pintar(vecinas)` toma **`[{refcat, recintos}]`**, que es exactamente lo que este
fichero sabe producir, y va en su propio pane, **por debajo de la parcela** («una
colindante es contexto y jamás debe tapar a la parcela propia»). La decisión 1 no
estrena ni un módulo de visor.

**M9 · El embudo del `<dialog>` ya admite una decisión más sin reescribirse.**
`decisionesDe` devuelve **una sola decisión cada vez** —con reparto de capas devuelve esa
y nada más— y cada aceptación vuelve a llamar a `importar()`. F19 metió los grados con
ese mismo patrón. La decisión nueva no vive ahí (decisión 3), pero el embudo **sí** tiene
que dejar de rematar con `SUPERFICIE_NO_POSITIVA` cuando la causa real es otra.

**M10 · Lo que NO se ha medido todavía**, y se dice para que nadie lo lea como medido:
el coste en kB del paquete, el coste en px del panel (previsión: **0**, porque todo vive
en cajón y diálogo — pero es previsión), y el comportamiento del fichero en Chrome de
verdad. Los tres son de la fase 5.

## ⛔⛔ M11 · LO QUE LA FASE 1 DESTAPÓ, Y ES PEOR QUE EL DEFECTO QUE VENÍA A ARREGLAR

El fichero de la manzana bloqueaba **por casualidad**. `SUPERFICIE_NO_POSITIVA` salta
porque `548,05 − (los otros siete)` da negativo, y da negativo **porque la finca más
pequeña viene la primera en el fichero**.

**Reordenados esos MISMOS ocho anillos con el mayor delante, la resta da +368,22 m² y la
parcela SE CONSTRUÍA**: `bloqueos: []`, `construida: true`. Una finca que no existe, cuyos
siete «huecos» son las parcelas de los vecinos, sin un solo aviso y lista para firmarse y
subirse a la Sede.

Lo único que separaba a este proyecto de entregar geometría falsa era **el orden en que un
fichero ajeno lista sus polilíneas**. Es la regla de oro 1 en su forma más cara, y es la
razón de que la fase 1 mire el reparto **por topología y no por su resultado aritmético**,
y de que lo mire SIEMPRE que hay más de un anillo y no solo cuando la resta sale negativa.

⚠️ **Y la lección de método**: `SUPERFICIE_NO_POSITIVA` se escribió en F11 llamándose a sí
misma «la prueba, no la causa». Era verdad a medias — probaba una mitad — y llevaba cinco
fases pareciendo suficiente porque **el único fichero que la ejercitaba tenía el orden
favorable**. Un guardián que solo se ha visto pasar no está demostrado.

**M12 · ⛔ Y un segundo número que escribí por inferencia y refutó medir el mismo día.**
El umbral de solape se puso en 1 mm² «porque es el ruido de coma flotante de una booleana
sobre UTM». Correcto contra el ruido de la MÁQUINA y **falso contra el ruido del MUNDO**:
con solo ese suelo, la capa «Construccion» del fichero real salía `disjuntos: false` por
**dos solapes de 0,0012 m²** entre medianeras que comparten muro. Así se digitaliza la
cartografía de verdad. El umbral pasa a tener dos mitades —suelo absoluto y **1 % del
menor de los dos anillos**— y el error se elige **hacia el lado barato a propósito**:
pasarse de generoso hace que la aplicación PREGUNTE cuál es la parcela; quedarse corto la
devuelve al callejón que esta fase existe para quitar.

**M13 · El prefiltro por caja envolvente no es optimización prematura, es la fase.** El
coste es cuadrático y el peor caso está en el mismo fichero: «Construccion» son 168
anillos ⇒ **14.028 pares**. Medido: el prefiltro los baja a **599** (95,7 % ahorrado) y el
barrido cuesta **~215 ms**; la capa «Parcela» son **8 pares de 28** y **~18 ms**.
⚠️ El prefiltro **descarta, nunca afirma**: en este mismo fichero las cajas de dos fincas
vecinas SÍ se solapan y las fincas no.

**M14 · ⭐ El detector distingue «manzana» de «parcela con sus construcciones».** El otro
DXF de Consulta Masiva del repo (F11) trae 8 anillos igual que la manzana —1 parcela + 7
huellas— y da `disjuntos: false` **por contención**, no por solape. No cuenta anillos:
mira cómo se relacionan.

## Mediciones de la fase 2

**M15 · ⚠️ La trampa del punto de inserción, que muerde en silencio.** En un `TEXT` de
DXF el 10/20 es el «primer punto de alineación» y **solo es la posición real si el texto
está alineado a la izquierda**; con justificación (códigos 72/73 ≠ 0) manda el **11/21**.
Medido: los ocho rótulos del fichero real traen **72=1 y 73=1**, o sea que la regla
**aplica** — y ese escritor **duplica el punto**, así que 10/20 y 11/21 coinciden
exactamente. ⛔ **El fixture NO ejercita esa rama**, y se dice en vez de dejar que
parezca probada; hay un caso sintético que la separa a mano. Sin la regla, el siguiente
fichero pondría sus rótulos en (0,0) y no caerían en ningún recinto: fallo mudo.

**M16 · ⛔ Y medir destapó un error en `PROCEDENCIA.md`, que es documentación de verdad
externa.** Su tabla de F11 dice que la parte 0 del DXF de edificio lleva el rótulo `I`.
El fichero trae siete rótulos en `txtConstru` y son **`I I II II III III P`** —dos `I` y
dos `II`—, mientras que la tabla repartía **tres `I` y un `II`**: el error se ve sin
geometría, contando. Con punto-en-polígono el emparejamiento sale **1:1 y sin sobras** y
la parte 0 contiene el `II`. Corregido allí.
⚠️ **Por qué nadie lo vio**: la tabla no la usaba ningún test —era documentación— y F12
acabó haciendo teclear las plantas a mano, así que **no había consumidor al que le
cuadrara o no**. Es la misma familia que M11: un dato que nadie ejercita no está
comprobado por mucho que esté escrito.

**M17 · ⭐ Elegir la capa de rótulos MIDIENDO funciona, y elegir por el nombre habría
fallado.** Sobre los ocho recintos de «Parcela»: `txtConstru` (153 rótulos) da **7
recintos ambiguos** y `limpia: false`; `RefCatastral` da **las ocho referencias, 1:1,
sin huérfanos ni compartidos**. ⚠️ Y `txtConstru` **acierta uno por casualidad** (una
finca contiene un solo rótulo, `SUELO`): un criterio de «si alguno cuadra, vale» habría
aceptado la capa equivocada.

**M18 · ⭐ Y en la rama EDIFICIO los rótulos son la deuda que F11 declaró y F12 no
cobró.** `importar(DXF_EDIFICIO, {capa:'Construccion'}).resumen.rotulos` da
**`['II','III','III','II','I','P','I']`** — las PLANTAS por parte, que hoy el técnico
teclea a mano. F22 **no las usa** (decisión 4) pero deja de tirarlas: la clave viaja por
`edificio/entrada.js` con valor `null` en las vías que no tienen fichero, sin cambiar ni
un comportamiento.

**M19 · El coste de emparejar es despreciable.** Peor caso del fichero (168 recintos ×
153 rótulos): **3,4 ms**. El caso de la fase (8 × 8): **0,3 ms**. Lleva el mismo
prefiltro por caja que el detector de disjunción.

## Las tareas (15 tareas / 5 fases)

### Fase 1 · La verdad geométrica (`parsers/importar.js`) — ✅ **HECHA el 2026-08-09**

- **T1.1** ✅ — Detector de disjunción, con `@turf/intersect` + `@turf/boolean-contains` y
  la superficie de `geo/area.js` (M6). **Vive en `parsers/topologia.js`**, tercer
  `topologia.js` del proyecto y mismo patrón que los de `diagnostico/` y `derivacion/`.
  Las otras dos casas se descartaron midiendo: `geo/` no puede (sus vecinos tienen un
  test que exige que no importen NADA) y `validation/reglas-topologia.js` devuelve
  `Hallazgo[]`, además de que `parsers/` (F01) → `validation/` (F02) es la dependencia al
  revés. Lo común que SÍ se reutiliza es `geo/poligono.js`.
- **T1.2** ✅ — `VARIOS_RECINTOS_DISJUNTOS` en `BLOQUEOS` y en `BLOQUEOS_SOLO_PARCELA`,
  con `datos.bloqueo` en su detección.
- **T1.3** ✅ — El mensaje deja de acusar al fichero: «El fichero trae 8 recintos
  SEPARADOS, no uno con huecos…». `SUPERFICIE_NO_POSITIVA` **intacto** para su caso, y
  los dos **excluyentes**.
- **T1.4** ✅ — `datos.recintos[]` con índice, superficie, nº de vértices y capa. ⚠️ Se
  mide sobre `recintos` y no sobre `anillos` —el paso 5 puede haber retirado un vértice
  de cierre— y con `area()` y no con `superficie()`, que restaría los que vienen como
  HUECO.
- **T1.5** ✅ *(no estaba en el plan; lo pidió no dejar la app peor)* — El `<dialog>` de
  importación **tiene voz** para el bloqueo nuevo. Sin una entrada en su `SIN_CORRECCION`,
  `decisionesDe` lo habría filtrado y la pantalla se habría quedado **muda**: un fichero
  que no entra y ni una frase que lo explique, que es peor que el callejón que F22 viene a
  quitar. El texto es **provisional y lo dice**: describe el hecho y no promete la
  elección, que es la fase 3.

**Lo entregado:** `parsers/topologia.js` (nuevo) · `test/parsers/topologia.test.js` (nuevo,
17 pruebas) · `test/fixtures/parsers/manzana_consulta_masiva_6346726UF8664N.dxf` (nuevo,
descarga real, SHA-256 publicado en `PROCEDENCIA.md`) · tocados `parsers/importar.js`,
`app/dialogo-importacion.js`, `.gitattributes`, `PROCEDENCIA.md`, y los tres comentarios de
`edificio/` que decían «los dos» y ahora son tres.

**Verde:** 7.236 pruebas / 169 ficheros, los dos proyectos. `npm run presupuesto` en verde
y **0 B de CSS** — la fase no toca la hoja.

### Fase 2 · Los rótulos que hoy tiramos (`parsers/dxf.js`) — ✅ **HECHA el 2026-08-09**

- **T2.1** ✅ — `parseDXF` devuelve `rotulos[]` (`{tipo, capa, texto, x, y}`),
  estrictamente aditivo. ⚠️ **Con la trampa del punto de inserción sorteada** (M15).
- **T2.2** ✅ — El resumen deja de decir «Se ignoraron N anotación(es)»: dice cuántas
  hay, que no son geometría, y cuántas se leen como rótulos.
- **T2.3** ✅ — `rotularRecintos` en `parsers/topologia.js` empareja por
  punto-en-polígono **sin adivinar**: huérfanos, compartidos y ambiguos se cuentan
  aparte y dejan el recinto sin nombre. `importar()` expone `resumen.rotulos`.
- **T2.4** ✅ *(no estaba en el plan)* — **Qué capa nombra las fincas se decide
  MIDIENDO**, no por su nombre: se prueban todas y gana la que empareja 1:1 y sin
  sobras. Es la lección de F11 («elegir por el nombre habría fallado en el único plano
  real que tenemos»), y aquí decide de verdad: `RefCatastral` es un nombre tan
  tentador y tan frágil como lo era `PARCELA`.

**Lo entregado:** tocados `parsers/dxf.js`, `parsers/topologia.js` (+`rotularRecintos`),
`parsers/importar.js`, `edificio/entrada.js` (una clave que pasa, sin cambio de
comportamiento), `PROCEDENCIA.md` (**una corrección**, M16) y sus tests.

**Verde:** 7.255 pruebas / 169 ficheros (partida de la fase: 7.236).

### Fase 3 · Elegir sobre el mapa — ✅ **HECHA el 2026-08-09**

- **T3.1** ✅ — `viewer/cajon-parcelas.js`, cajón propio y no el de comprobación
  generalizado (M7). Nace **sin ninguna candidata marcada** y con el primario apagado
  (M20).
- **T3.2** ✅ — `viewer/candidatas.js`: la capa que dibuja las N fincas y **resalta la
  marcada**. Es lo que la decisión 3 compró y lo que M7 dijo que no existía.
- **T3.3** ✅ — La esquina compartida, y **de verdad**: las dos piezas se componen en
  `crearVisor` con la bandera `parcelas`, y hay un test que monta los TRES cajones a la
  vez en `bottomleft` y exige que convivan cerrados. Quién cierra a quién al abrir sigue
  siendo del cableado (fase 4).
- **T3.4** ✅ — Sin referencias, «Recinto 3 · 655,70 m² · 13 vértices». ⚠️ Y **no se
  inventa «Parcela 3»**: llamar parcela a un recinto del que no sabemos el nombre afirma
  algo que nadie ha dicho.

⚠️ **Desviación del plan: son DOS módulos de visor, no uno.** El plan preveía solo el
cajón; se escribió antes de mirar cómo está partido el visor. **Ningún cajón de este
visor dibuja** —`cajon-diagnostico.js` y `cajon-comprobacion.js` no importan `PANE` ni
construyen una capa; lo que se pinta vive en `piezas.js`, `contraste.js` y
`colindantes.js`—, así que meter el resalte dentro del cajón habría estrenado un control
que necesita saber el huso.

**Lo entregado:** `viewer/cajon-parcelas.js` y `viewer/candidatas.js` (nuevos), con sus
dos suites (22 + 17 pruebas); tocado `viewer/index.js` (la bandera de montaje `parcelas`
y 8 pruebas de composición).

**Verde:** 7.302 pruebas / 171 ficheros (partida de la fase: 7.255). **CSS: 0 B**, y no
por suerte — los módulos del visor se estilan en línea a propósito, para ser legibles sin
ninguna hoja.

## Mediciones de la fase 3

**M20 · La decisión de producto de la fase: el cajón NACE SIN NADA MARCADO.** Marcar una
por defecto —la primera, la mayor— es elegir por el usuario en la única pantalla que
existe porque **la aplicación no puede elegir**. Un descuido y se firma la finca del
vecino. El primario nace apagado y el renglón dice por qué.

**M21 · ⛔ `bringToFront` reordena el DOM, y por eso el índice va en el NODO.** El
resalte manda la finca marcada al frente —en una manzana **todas** comparten lindero, y
sin eso el trazo grueso queda por debajo justo en el borde que hay que comparar—. La
consecuencia la destapó un test en rojo diciendo que el resalte no se aplicaba: **se
aplicaba, a otra**. Desde el primer resalte, «el tercer `<path>`» y «la tercera finca»
dejan de ser lo mismo. Cada polígono lleva `data-candidata="i"` y hay
`selectorCandidata(i)`; buscar por posición es el fallo que se descubre señalando mal
una parcela.

**M22 · ⚠️ El español NO agrupa los millares de cuatro cifras.** `Intl.NumberFormat('es-ES')`
da **`1098,85`** y no `1.098,85` (`minimumGroupingDigits` vale 2 en CLDR para es-ES);
agrupa a partir de cinco. Medido, no supuesto — la expectativa contraria puso un test en
rojo sobre código correcto. Toda la aplicación formatea igual, así que es coherente por
construcción.

**M23 · ⚠️ Y un guardián que casi acusa por la forma en vez de por la afirmación.** El
test de «el primario no lleva familia tipográfica en línea» acusaba por `style.font`, que
devuelve **`600 inherit`** en cuanto se ponen `fontSize` y `fontWeight` por separado — o
sea que habría salido rojo sobre el código correcto. Acusa por `fontFamily` y por el
atributo `style`. **Quinta vez que este proyecto paga lo mismo.**

**M24 · El coste en bytes, con su salvedad.** El paquete pasa de **1.088,26 kB** (final
de la fase 1) a **1.101,78 kB**: **+13,52 kB** por las fases 2 y 3 juntas. ⚠️ **No es un
delta aislado**: el árbol lo comparte otra sesión. Lo que sí está aislado es el CSS —
**70,11 kB, byte a byte el mismo fichero, mismo hash**.

### Fase 4 · El cableado — ✅ **HECHA el 2026-08-09**

- **T4.1** ✅ — Con `VARIOS_RECINTOS_DISJUNTOS` el recorrido **deja de morir** en «No ha
  entrado ninguna parcela»: se pintan las candidatas, se abre el cajón, se cierran los
  otros dos de la esquina y el usuario va a Entrada.
- **T4.2** ✅ — La elegida entra al store; las otras van a `colindantes.pintar`.
- **T4.3** ✅ — Sexto rótulo, `EYEBROW_DIBUJO_CATASTRO`, con guardián de comportamiento
  en `test/app/main-fincas.dom.test.js` — el fichero existe **por la lección de F18**.
- **T4.4** ✅ — La ficha dice «7 · del dibujo», no «7» a secas.
- **T4.5** ✅ — Las 168 construcciones se nombran y no entran.

**Lo entregado:** `test/app/main-fincas.dom.test.js` (nuevo, 9 pruebas que montan la app
y sueltan el fichero de verdad); tocados `app/cableado-medicion.js` (+`componerParcelaElegida`,
el desvío y las suscripciones), `app/main.js` (la bandera del visor, el sexto rótulo, el
adaptador de colindantes) y `test/app/cableado-medicion.dom.test.js` (+14 pruebas).

**Verde:** 7.325 pruebas / 172 ficheros (partida de la fase: 7.302). CSS **0 B**, mismo
hash. Paquete **1.105,74 kB** (+3,96 desde la fase 3).

## Mediciones de la fase 4

**M25 · ⛔⛔ EL CRITERIO DEL RÓTULO QUE ESCRIBÍ PRIMERO HABRÍA REINTRODUCIDO EL DEFECTO DE
F18.** La primera versión decía: «origen de fichero **y** hay `geometriaOficial` ⇒ es
cartografía del Catastro». Parece razonable y es falso: `componerParcelaMedida`
**CONSERVA** la `geometriaOficial` que hubiera —es toda la decisión de F18, la que hace
que el Diagnóstico funcione sin traer nada más—, así que el flujo normal del perito
(traigo la oficial, meto MI levantamiento) habría acabado rotulado «Cartografía del
Catastro» **sobre el dibujo del técnico**. El mismo error caro, con otro disfraz, en la
misma fase que lo tenía declarado como riesgo.

El criterio bueno es `dibujoEsLaOficial`: que lo que se dibuja **SEA** la oficial, no que
exista una. Es literalmente lo que la frase afirma. ⚠️ Y trae una consecuencia buscada:
al mover un vértice el rótulo pasa a «Tu medición», porque lo que hay en pantalla ya es
la propuesta del técnico.

**M26 · ⛔ Y un defecto de ORDEN que encontró un test en rojo, no el razonamiento.** Las
vecinas se pintaban justo detrás del `estado.set`, que es donde parecía que tocaban, y
**la ficha seguía diciendo «Sin consultar» con siete vecinas dibujadas en el mapa**.
Causa: `alCargarParcela` significa «documento nuevo» y `cablearEdicion#alCambiarOficial`
resetea el recuento —unas vecinas traídas para OTRA parcela ya no valen, y para la vía
del Catastro eso es correcto—. Aquí vienen del MISMO fichero que la parcela, así que no
caducan con ella: se pintan las últimas, cuando ya nadie las va a borrar.
⚠️ Es exactamente el tipo de fallo que la suite no ve si el test se escribe sobre las
piezas en vez de sobre el recorrido: los dobles no resetean nada.

**M27 · ⚠️ `document.querySelector('dialog')` NO devuelve el diálogo de importación.** La
aplicación monta **siete** `<dialog>` y el primero del documento es el de avisos. Es la
misma trampa del `querySelector` que la lección M8 de F07 dejó escrita para los
`data-estado`, un elemento más arriba. Se busca por su clase.

### Fase 5 · El guion y el cierre — ✅ **HECHA el 2026-08-09**

- **T5.1** ✅ — `scripts/smoke-navegador/24-parcelario-dxf.js`, **con el fichero real**.
  Encontró **cuatro defectos** (M28 a M31) y **dos suyos propios** (M32).
- **T5.2** ✅ — Presupuesto medido: **0 px** del panel, **0 B** de CSS (mismo hash),
  **+2,26 kB** de paquete (M33).
- **T5.3** ✅ — `CHECKLIST-HUMANO.md` §20, con 20.1 **BLOQUEANTE**.
- **T5.4** ✅ *(no estaba en el plan)* — El texto que la fase 1 **declaró provisional**
  seguía negando la elección que las fases 3 y 4 construyeron (M34).
- **T5.5** ✅ *(no estaba en el plan)* — `CLASE_RESALTADA` estaba **exportada y muerta**.

**Lo entregado:** `scripts/smoke-navegador/24-parcelario-dxf.js` (nuevo); tocados
`viewer/candidatas.js` (+`encuadrar`, +la clase que faltaba), `viewer/cajon-parcelas.js`
(+`caja`), `app/cableado-medicion.js` (+`textoProcedenciaFincaElegida`, el encuadre),
`app/main.js` (el aterrizaje y el aviso de sustitución), `app/dialogo-importacion.js` (el
texto caduco), `GUION.md` (§34, la fila y la cuenta), `CHECKLIST-HUMANO.md` (§20) y cuatro
suites (+13 pruebas).

**Verde:** 7.338 pruebas / 172 ficheros (partida de la fase: 7.325).

## Mediciones de la fase 5

**M28 · ⛔⛔ LAS OCHO FINCAS SALÍAN A 0 × 0 PX, O SEA LA FASE ENTERA.** La aplicación
arranca vacía y con el mapa mirando a España entera; las candidatas **no pasan por el
store**, que es quien reencuadra, así que una manzana de cien metros ocupaba **menos de un
píxel**. El cajón decía «marca la tuya —se resalta en el mapa al marcarla—» y en el mapa no
había nada que mirar: la decisión 3 de esta fase, la que costó el riesgo Medio y dos
módulos de visor, no se podía ejercer.

⚠️ **Y las 7.325 pruebas lo aprobaban**, incluida la que monta la aplicación entera y
suelta el fichero de verdad: en jsdom `getBoundingClientRect()` devuelve **ceros**, así que
«se ve» y «no se ve» son literalmente indistinguibles. Es la tercera vez que este proyecto
paga la misma frontera —F17 con la tabla que encoge, F13 con el CTA medido en una pantalla
oculta— y la primera en la que lo que no se veía era **el objeto de la decisión**.

Se añade `viewer/candidatas.js#encuadrar()`, y **no se llama desde `pintar`**: mover el mapa
es una decisión del recorrido —quién pregunta y cuándo—, y esconderla dentro del pintado la
haría inevitable también para quien solo quiera dibujar sin secuestrar la vista.

**M29 · ⛔ Y arreglado eso, el cajón tapaba CINCO de las ocho al 100 %.** Medido: el cajón
ocupa **420 × 371 px** de un mapa de **678 × 720** —el 62 % del ancho—, así que meter las
ocho «dentro del mapa» las metía debajo del panel que hace la pregunta. La primera versión
del guion ya lo habría dado por bueno: `dentroDelMapa: 8`.

El cajón estrena `caja()` —es el único que sabe cuánto ocupa **y en qué esquina**— y
`encuadrar({evitar})` reparte el margen por el lado del estorbo. ⚠️ **Con tope del 45 % por
eje, y el tope es la mitad del hallazgo**: sin él, un cajón de 420 px sobre un mapa de 678
dejaría el encuadre tan apretado que las fincas volverían a no verse — el defecto de M28
con otra causa.

**M30 · ⛔⛔ ATERRIZAR EN DIAGNÓSTICO SE COMÍA EL PARCELARIO DEL DIBUJO.** Una finca de este
fichero entra con `recintos === geometriaOficial` (decisión 2), así que
`aterrizarTrasContrastar()` llevaba a Diagnóstico. Dos cosas mal:

1. **El encaje vale CERO por construcción.** Lo dice esta misma ficha desde la fase 4 —«que
   nadie lea ese cero como una verificación»— y aun así la aplicación aterrizaba ahí y lo
   enseñaba como si fuera un resultado.
2. **Y abrir esa pantalla dispara `pedirVecinas()`**, que sustituía las **siete** fincas del
   dibujo por las que devuelve el WFS: medido **7 → 3 en 50 ms**, y el renglón de la ficha
   perdía además el «· del dibujo». Es el patrón de «traer el Catastro machaca la medición»
   (2026-08-08) un piso más abajo, con las vecinas en vez de con la parcela.

El criterio del arreglo es `dibujoEsLaOficial`, **el mismo que M25 midió para la cabecera**:
que lo dibujado SEA la oficial, no que exista una. Se aterriza en Edición.
⚠️ La sustitución sigue siendo posible pulsando «Diagnosticar encaje» a mano —y es legítima:
son dos parcelarios distintos y el del servicio es el que manda para medir invasión—, pero
**ya no es muda**.

**M31 · ⛔ La cabecera y el renglón de debajo decían lo contrario.** Arriba «Cartografía del
Catastro · del dibujo» —correcto, y es lo que costó M25— y **dos centímetros más abajo**
«Geometría **medida por ti** … **NO del Catastro**», porque el renglón reutilizaba
`textoProcedenciaMedicion` tal cual. Una cabecera correcta con un pie que la desmiente no es
media verdad: es la misma mentira, **y la que se lee al firmar es la de abajo**.
⚠️ Y la suite no lo veía porque comprobaba cada renglón **por su lado**, y por su lado los
dos pasaban: el defecto solo existe al leerlos juntos.

**M32 · ⛔ Y DOS defectos del propio guion, que son de método.**
1. **Un contador de red instalado tarde no cuenta la red.** Envolver `window.fetch` al
   arrancar el guion es hacerlo **después** de que los módulos de la aplicación hayan
   capturado su referencia: contaba **1** petición mientras el navegador hacía **200**. Mide
   su propio envoltorio. Se pasa a `performance.getEntriesByType('resource')`, como el §33.
2. **Y su primer filtro acusó a un `import`**: `services/_catastro-wfs.js` es un módulo de
   la propia aplicación servido por Vite, y casaba con el patrón `wfs`.

⚠️ **Y la caché puede tapar la red, así que el guion se lo advierte a sí mismo.** F05 guarda
las respuestas en IndexedDB y una consulta servida desde la caché **no deja entrada de
red**: la primera corrida salió con `aServiciosDeDatos: 0` mientras la aplicación pedía las
colindantes y machacaba las del dibujo. Un contador de red no distingue «no se ha
preguntado» de «ya lo teníamos apuntado».

**M33 · El presupuesto, medido (criterio 11).** **0 px** del panel: la caja de
`#tabla-vertices` no encoge ni un píxel al abrir el cajón (0 → 0 con la app vacía, y 225,08
px cuando entra la finca, que es lo que gana). **CSS: 0 B**, `index-Bcjw4I2m.css` byte a
byte el mismo fichero que en las fases 3 y 4. **Paquete: 1.108,00 kB**, +2,26 kB desde la
fase 4. ⚠️ Como en M24, el delta del paquete **no está aislado**: el árbol lo comparte otra
sesión.

**M34 · ⚠️ Un texto DECLARADO provisional que se quedó caduco, y nadie volvió.** La fase 1
escribió en `SIN_CORRECCION` un mensaje para que la pantalla no se quedara muda antes de que
la elección existiera, y lo declaró provisional en su propio comentario. Decía:
«…Un expediente lleva una sola, y **todavía no se puede elegir cuál desde aquí**». Las fases
3 y 4 construyeron exactamente eso y **el texto siguió negándolo**. Se corrige y se le pone
guardián que acusa por la AFIRMACIÓN («no se puede elegir», en cualquiera de sus formas), no
por la palabra. Es la tercera vez que el proyecto paga un texto con fecha de caducidad
declarada y sin nadie que volviera: las otras dos son el §11 del `GUION.md` —tres meses
acusando a la aplicación de hacer lo que se le pidió— y el rótulo del guion 17.

**M35 · Y una constante exportada y MUERTA.** `viewer/candidatas.js` exportaba
`CLASE_RESALTADA = 'gml-candidata--resaltada'` y **no la ponía nadie**: `resaltar` solo
cambiaba el estilo en línea. Un nombre exportado es un CONTRATO —quien lo lea escribirá una
regla en la hoja o buscará por él— y esa regla no habría pintado nunca. Lo destapó escribir
el guion, buscando cómo afirmar el resalte desde fuera del módulo.

## Criterios de aceptación

| # | Criterio |
|---|---|
| 1 | ✅ `ConsultaMasiva_ (90).dxf` **entra**: se eligen las 8, se elige una y hay parcela en el store — medido en Chrome, guion 24 |
| 2 | ✅ El bloqueo que sale es `VARIOS_RECINTOS_DISJUNTOS` y **no** `SUPERFICIE_NO_POSITIVA`; el mensaje dice cuántas hay |
| 3 | ✅ Las 8 candidatas se ofrecen **con su referencia catastral**, sacada del fichero (M5). Fase 2 el dato, fase 3 la lista, fase 5 medido: **8 de 8** con referencia |
| 4 | ✅ Al recorrer la lista, la candidata **se resalta en el mapa** (lo que M7 dice que no existía). Medido en Chrome: trazo `rgb(37,99,235)`/3 px contra `rgb(203,213,225)`/1,5 px, y al frente. ⛔ **Y hubo que arreglar dos veces lo que había debajo**: las ocho salían a 0×0 px (M28) y el cajón tapaba cinco (M29) |
| 5 | ✅ Elegida una, las otras **se dibujan como colindantes** (7) y la ficha dice «7 · del dibujo». ⛔ Costó M30: el aterrizaje en Diagnóstico las sustituía por 3 en 50 ms |
| 6 | ✅ La cabecera **no dice «Tu medición»** sobre geometría del Catastro, ni «del Catastro» sobre un levantamiento propio. ⛔ **Y el criterio se amplía al renglón de procedencia**, que decía lo contrario dos centímetros más abajo (M31) |
| 7 | ✅ Un DXF **sin** capa `RefCatastral` sigue entrando, rotulado por superficie y como MEDICIÓN (suite; el fichero real siempre la trae) |
| 8 | `SUPERFICIE_NO_POSITIVA` **sigue disparando** en su caso (anillos que se solapan de verdad): la guarda de F11 no se pierde — ✅ **fase 1** |
| 9 | La rama EDIFICIO **no hereda** el bloqueo nuevo (`BLOQUEOS_SOLO_PARCELA`), ni su detección — ✅ **fase 1** |
| 10 | ✅ Guion `24-parcelario-dxf.js` en **`ok:true`** a 1280×720, 1.898 ms, consola limpia |
| 11 | ✅ Se mide y se declara: **0 px** del panel, **0 B** de CSS (mismo hash), **+2,26 kB** de paquete (M33) |
| 12 | 🆕 **Un fichero de N fincas no construye parcela SEA CUAL SEA el orden de sus anillos** (M11) — ✅ **fase 1**, con guardián que reordena de verdad |

⚠️ El criterio 12 **no estaba en el plan aprobado**: lo abrió M11 al medir. Se añade en vez
de arreglarlo callando, porque es el defecto más caro que ha tocado esta fase y sin criterio
propio quedaría defendido solo por un test suelto.

## Riesgos

- ⛔ **El resalte sobre el mapa es la pieza no escrita** (M7). Es de donde sale el riesgo
  Medio. Si se complica, la salida acotada es entregar la fase con la lista rotulada por
  referencia —que M5 dice que identifica sin ambigüedad— y el resalte con dueño; pero
  entonces **hay que decirlo**, no dejar que la decisión 3 se lea como cumplida.
  > ✅ **Cerrado, y el riesgo se cumplió por donde no se esperaba.** El resalte se escribió
  > sin problema en la fase 3 y en la 4 se cableó. Lo que casi tumba la decisión 3 fue lo
  > que había **debajo**: las ocho fincas salían a 0 × 0 px (M28) y el cajón tapaba cinco
  > (M29). O sea que el riesgo no estaba en la pieza que se dio por difícil, sino en dar
  > por hecho que una capa dibujada es una capa vista — y eso **ningún test de jsdom lo
  > puede desmentir**.
- ⚠️ **El árbol de trabajo tiene ahora mismo 27 ficheros modificados sin commitear** de
  otra sesión (`app/pantalla.js`, `app/navegacion.js`, `app/main.js`, nueve guiones de
  humo…). `app/main.js` está **en las dos listas**. Antes de empezar, esa sesión tiene
  que cerrar, o esta fase se planta encima de un cambio a medias.
- ⚠️ **`core.autocrlf=true` corrompe el árbol** (F17 · fase 0). Sigue vigente.

## Deuda declarada

- **Las 168 huellas de «Construccion» no entran** (decisión 4). El fichero trae parcela y
  edificio de una vez y la rama EDIFICIO sabe leer un DXF desde F11: filtrarlas por
  contención en la parcela elegida es una fase corta y **con casa** — no se queda sin
  dueño, que es exactamente lo que le pasó a la entrada por fichero hasta F18.
- **Los rótulos de planta de `txtConstru`** (`II`, `-I+I+EPT`, `POR`, `TZA+I`, `JD`…) son
  el número de plantas que F12 pide teclear a mano. ⭐ **Ya NO se tiran** (M18): desde la
  fase 2 llegan a `resumen.rotulos` en la rama EDIFICIO, medidos y 1:1 con las partes.
  Lo que falta es que alguien los USE, y eso sigue teniendo la misma casa que el punto
  anterior. La deuda pasa de «hay que leerlos» a «hay que enchufarlos», que es mucho
  menos trabajo del que era.
- ⚠️ **El huso sale ambiguo (30/31) y no debería.** El centroide cae en 386.115 /
  4.064.386, que es huso 30 sin discusión; `detectarHuso` ofrece dos candidatos porque
  el Este vale ~500.000 en todos los husos. **No es de esta fase** y no entra: es
  cosmético y toca `geo/huso.js`, con su suite. Pero sale en pantalla cada vez que se
  abre uno de estos ficheros, y conviene que esté anotado.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que las ocho candidatas se distingan de un vistazo.** Ocho referencias catastrales
  que comparten los once primeros caracteres (`6346726UF8664N` / `6346725UF8664N`) no se
  distinguen leyendo: se distinguen viendo. Es el punto BLOQUEANTE del checklist y es lo
  que el criterio 4 existe para resolver.
- **Que el `<dialog>` y el cajón no se pisen.** En jsdom el prototipo de `<dialog>` tiene
  exactamente `constructor` y `open`: la suite ejercita el camino degradado. Lo mide el
  guion (§34, `ok:true`).
- ⛔ **Que las fincas SE VEAN, y que el cajón no se ponga encima.** En jsdom
  `getBoundingClientRect()` devuelve **ceros**, así que «se ve» y «no se ve» son
  indistinguibles: las 7.325 pruebas de la fase 4 aprobaban ocho manchas de cero píxeles.
  De la suite solo se puede exigir que se PIDA el encuadre y la aritmética del reparto del
  margen; el resto es del guion y del §20 del checklist.
- ⚠️ **El aviso de que una consulta SUSTITUYE el parcelario del dibujo** (M30) no tiene
  guardián automático: llegar a él exige un cliente del Catastro que conteste, y el arnés
  que monta la aplicación entera no lo tiene. Se dice en vez de dejarlo por probado.
- **Que el fichero real de otro técnico se parezca a éste.** Un solo fichero de «Consulta
  Masiva» no es la especificación del formato. Lo que la fase promete es lo que este
  fichero demuestra; el segundo fichero real que llegue puede añadir casos.

## Dónde encaja

Bloque B, **P13c**, detrás de F20. Lleva `c` por lo mismo que F20 lleva `b` y F21 lleva
`b`: el Bloque B se quedó sin peldaños en P13 y renumerar diecisiete referencias por un
número no compensa — se dice en vez de fingir la escalera.

Es la cuarta fase seguida de la familia «entrada de parcela» (F18 fichero, F19 pegado,
F20 salida a Excel, F22 el DXF del Catastro), y sale del mismo sitio que las tres: **un
caso real que se probó y no entró**.

## Referencias

[`feature-01-entrada-parcela.md`](feature-01-entrada-parcela.md) (los parsers y las
detecciones defensivas) · [`feature-11-edificio-entrada.md`](feature-11-edificio-entrada.md)
(el reparto por capas, los dos bloqueos y la lección del `datos.bloqueo`) ·
[`feature-08-comprobar-gml.md`](feature-08-comprobar-gml.md) (el patrón «varias parcelas
→ cajón» y `alPedirEleccion`) ·
[`feature-18-entrada-parcela-fichero.md`](feature-18-entrada-parcela-fichero.md) (la
entrada de `.dxf` y el rótulo que mintió) ·
`parsers/importar.js` (cabecera §F11) · `viewer/colindantes.js` ·
`GUION.md` · `CHECKLIST-HUMANO.md`.
