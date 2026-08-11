# F17 · Expediente de varias parcelas

**Fase:** 17 · **Prioridad:** P11 (cierra el Bloque B) · **Riesgo:** Medio ·
**Depende de:** F06 (edición), F07 (diagnóstico), F04 (serializador) ·
**Habilita:** el 80 % del parcelario real que hoy la aplicación no cierra.

**Ficheros (previstos):** capa nueva `derivacion/` con barrel propio
(`topologia.js`, `cesion.js`, `entrega.js`, `identidad.js`, `_comun.js`),
`geo/grosor.js`, `comprobacion/conjunto.js` con barrel estrenado,
`viewer/lista-sobrante.js` + `viewer/piezas.js`, `app/cableado-derivacion.js`, y
retoques en `gml/serialize-cp.js`, `gml/descargar.js`, `report/`, `index.html`,
`estilos/app.css`. **Se actualiza al cerrar la fase**, como en F08–F11.

> ⏳ **Esta ficha se abre con la fase, no al terminarla.** Lo que aquí se dice del
> futuro está en futuro; lo medido lleva su fecha. Al cerrar se reescribe para que
> diga lo que hay y no lo que se pensaba hacer, y lo que decía antes **no se
> borra**: se conserva tachado o citado al lado de lo medido, igual que en las
> fichas de F05 a F11. Manda lo medido (regla de oro 8).

## Objetivo

**Que alterar un lindero deje de ser un expediente imposible de cerrar.**

El problema está medido, no estimado: la aplicación **no cierra más de 1 de cada 5**
expedientes de parcelario reales de su autor. Mover un lindero obliga a aportar
**todas** las geometrías afectadas —el trozo que se suelta, el colindante
recortado— o el IVG sale negativo, y hasta hoy la aplicación solo sabe emitir la
parcela que tiene delante.

⛔ **El hueco no estaba excluido: no tenía nombre.** El plan v4 recortó
«multiparcela» —que es un **formato de fichero**— y durante ocho fases se leyó
como si también recortara el «expediente de varias parcelas», que es un **flujo de
trabajo**. Son cosas distintas, y confundirlas costó construir para el caso raro.
La corrección del vocabulario es parte del entregable: ver «Deuda saldada».

**Lo que la fase 1 entrega:** a partir de una parcela del Catastro con un lindero
movido **hacia dentro**, la aplicación *deriva* el sobrante `P_of − P_new`, lo
*propone* pieza a pieza con su área y su grosor —el usuario incluye, excluye y
nombra—, demuestra el **cierre del conjunto sobre coordenadas ya redondeadas**, y
emite **un solo `.gml`** con N `gml:featureMember`. Cero peticiones de red: los dos
minuendos ya están en memoria.

## 🔻 OVERRIDES aplicables

- **O18 — Varias parcelas en un fichero.** ✅ **MEDIDO el 2026-08-03**: la Sede
  acepta un `.gml` con dos `gml:featureMember` e IVG **positivo**, CSV
  `XMWPXCN9J8DB9J89`. Lo instruía la línea 42 de la plantilla oficial desde F04.
  ⚠️ Medido con **dos**; tres o más es plausible y **no está medido**.
  **Consecuencia de diseño: el ZIP se cancela entero** — no hace falta ningún
  empaquetador, basta un bucle de `gml:featureMember`.
- **O19 — La referencia con sufijo del padre se acepta en segregación.** La cesión
  fue `7136910UF1473N.1` bajo `ES.LOCAL.CP` **con `nationalCadastralReference`
  sufijada**, no vacía. ⚠️ **Sabemos que la forma con sufijo vale, no que la vacía
  falle**: el comentario de `gml/serialize-cp.js` recibe una excepción escrita, no
  una corrección.
- **O20 — «Tipo de operación».** La Sede lo exige en un desplegable de **dos**
  opciones (Segregación · Subsanación), el IVG lo imprime, y es **el único dato del
  expediente con redundancia cero**: no viaja en el `.gml`, no lo valida nadie, y
  el informe no lo nombra. Un valor equivocado produce un IVG positivo con la
  etiqueta mal puesta, firmado y con su CSV.

## Alcance

**Entra (fase 1 · la cesión):**

- Derivar `cesion = P_of − P_new` y partirla en componentes conexas.
- **Una parcela por componente**, cada una con su `idLocal`. El invariante del
  modelo no se toca: una `Parcela` es UN exterior con huecos.
- Proponer las piezas con **área y grosor**, para incluir, excluir y nombrar. Las
  astillas se listan **con su aviso y sus cifras**; ninguna se descarta sola.
- ⛔ **La puerta `P_new ⊆ P_of`**: si la parcela CRECE, el sobrante sale vacío
  mientras hay vecinos afectados, y emitir ahí un expediente incompleto con total
  confianza sería el peor fallo de la fase. Se dice, y se remite a la fase 2.
- Comprobar el **cierre del conjunto** sobre coordenadas ya redondeadas a 2
  decimales, con **tres** afirmaciones: suma con tolerancia declarada, cero solape,
  y cobertura contra el contorno oficial.
- Emitir **un** `.gml` con N `gml:featureMember`, validando **cada pieza** por
  `validation/parcela.js` entera, y pasarlo por `validar:xsd --estricto`.
- «Tipo de operación» **propuesto, editable e impreso** en el informe — y cubre
  también el expediente de **UNA** parcela: el flujo F06→F07→F09 es una
  Subsanación que la aplicación no nombra, y ese hueco es de hoy.

**No entra, y se dice:**

| Se aparta | Por qué |
|---|---|
| **La fase 2 · el colindante recortado** | Necesita sacar `vecinas` de la clausura de `app/cableado-diagnostico.js` al modelo y una UI de asignación de trozos. Y `asignado_i` **no es derivable**: que un trozo liberado pase al vecino o se convierta en cesión es **jurídico**, no geométrico |
| **Una parcela con varias superficies disjuntas** (`nSurfaces > 1`) | Descartado a favor de una parcela por componente. `gml/ids.js` ya lo parametriza, así que la puerta queda abierta |
| **El informe que abarque las N parcelas** | Es F09 otra vez: encuadre para N geometrías, paginación, N literales y N tablas. Se entrega **el alcance declarado** —el papel dice cuántas parcelas hay y cuál describe— por una fracción del coste |
| **Medir 3 o más parcelas contra la Sede** | Lo medido son **dos**. Tres es plausible y no está probado; esta ficha promete lo medido |
| **El ZIP / CRC32 / `export/zip.js`** | Cancelado por medición (O18). El motivo por el que existía —el navegador **bloquea la segunda descarga automática y eso NO se puede detectar desde JavaScript**— queda satisfecho igual: una sola descarga lo evita por diseño |
| **La entrada por fichero del comprobador de conjunto** | Se recupera cuando la fase 1 esté en verde; por eso `conjunto.js` vive en `comprobacion/` y no en `derivacion/` |

## Criterios de aceptación

1. Con **un solo lindero movido** sale el conjunto completo, sin dibujar ninguna
   geometría más.
2. El comprobador enseña el residuo **con su superficie y su grosor**, y **sin
   calificarlo** (regla de oro 9).
3. Todo lo emitido es perfil `ENTREGA` y pasa el **XSD estricto**.
4. ⛔ **IVG positivo sobre un expediente real** presentado en la Sede. Es la única
   verificación que ninguna máquina de este proyecto puede firmar (regla de oro 8).
5. `@turf/difference` entra **por subpaquete** (regla de oro 6) y **con su delta de
   bundle medido**.
6. ⚠️ **SUSTITUIDO A PROPÓSITO.** Era «coste 0 px en el panel», la racha que F07 a
   F11 mantuvieron durante cinco fases. En Validación la lista del sobrante
   comparte pantalla con la tabla de vértices, así que **se rompe a propósito y con
   el número delante**: el panel no desborda en ninguno de los dos ejes, su pie
   cabe, y lo que la lista le quita a la tabla **está medido y escrito en esta
   ficha**.
7. El guion `16-derivar-cesion.js` sale `ok:true`, `problemas: []`.

## Mediciones

| | Qué decía | Qué se midió |
|---|---|---|
| **M1** *(2026-08-05, fase 0)* | El expediente de oro `7136910UF1473N` estaba solo en una tabla de `SPEC.md`: **ni un byte suyo en `test/`** | Versionado como fixture con procedencia y **dos** SHA-256. Medido con el código del repo: `areaValue` **466**, shoelace **466,2141** m², 12 vértices, 1 recinto, orientación horaria, `ES.SDGC.CP`. ⛔ **El parcelario SIGUE SIN LA SEGREGACIÓN** dos días después del IVG positivo, y eso es lo que lo hace útil: la geometría oficial es el **ANTES**, que es justo lo que la aplicación tiene delante al derivar |
| **M2** *(2026-08-05, fase 0)* | `SPEC.md` §7.1 publica un residuo de **0,0064 m²** | La cuenta que se puede REHACER hoy da **0,00595**. No se contradicen: aquélla salió de las superficies **sin redondear** de las dos piezas y la tabla publica las de 2 decimales. Cerrar los 4,5 cm² exigiría el `.gml` de dos miembros que se subió, y **ese fichero no está versionado**. Para lo que la cifra defiende da igual cuál sea: **las dos son mayores que cero**, y es eso lo que descarta el `==` |
| **M3** *(2026-08-05, fase 0)* | La auditoría de comentarios caducos listaba **ocho** sitios | Son **nueve**: el guardián encontró `report/pdf-parcela.js:1467`, que la lista no tenía. Y de paso destapó que **el PDF YA lista las N parcelas del fichero con su columna «En este informe»** — por el camino de COMPROBACIÓN. El informe del camino propio todavía no la tiene |
| **M4** *(2026-08-05, revisión de diseño)* | El bloque del sobrante «cabe en el panel» | **Medido en la aplicación real** a 1440×900 y 1280×720: cuesta **96,63 px vacío + 31,00 px por fila**. El invariante de **267,44 px** de la tabla de vértices se rompe con la **QUINTA pieza**. ⛔ Y el panel **no desborda: la tabla encoge en silencio**, que es la regla de oro 1 en versión maquetación |
| **M5** *(2026-08-05, fase 1)* | ⛔ **El límite conocido del grosor estaba AL REVÉS.** F07 escribió —como conjetura— que una pieza anular «se subestima y podría descartarse» | Medido al extraer la función: para un anillo de grosor **UNIFORME** `2A/P = h` **exactamente**, y no solo si es delgado (comprobado a 0,001 · 0,01 · 0,05 · 1 · 20 y 25 m, los seis con error 0 en float64) — así que **el sobrante de un encogimiento uniforme se mide bien**, que es la buena noticia que F17 necesitaba. ⛔ El riesgo real es el contrario y es peor: con un anillo **no uniforme** la cifra promedia y **SOBREestima el lado fino** (marco de 100×100 con el hueco descentrado, 1 m de grosor en un lado y 49 en el otro: declara **25 m**). No descarta de más, **admite de más**, y aquí eso es lo grave porque una astilla admitida se emite y se firma |
| **M6** *(2026-08-05, fase 1)* | Que `@turf/difference` añadiría «el envoltorio y no el álgebra», porque `polyclip-ts` ya está en `node_modules` vía `@turf/intersect`. **Inferencia 8/10, no medición** | **4.309 B = 4,21 kB** sobre el paquete construido, medidos cableando `restar` al punto de entrada real de la aplicación y comparando (883.971 → 888.280 B). La dirección de la inferencia era correcta —está muy lejos de los ~50 kB del motor booleano completo— y la cifra ya no es una apuesta. ⚠️ **Hoy el paquete NO lo lleva**: `restar` no tiene llamante en producción hasta que entre `cesion.js` (fase 2), así que el coste está medido pero aún no pagado |
| **M7** *(2026-08-05, fase 1)* | El riesgo de `xs:ID` con N miembros: «dos miembros con el mismo `refcat` repiten los cuatro ids» | **Cierto a medias, y la primera versión del test se equivocaba donde el código acertaba**: la base del id es `namespace + refcat`, así que **la misma referencia bajo namespaces distintos NO choca**. No es un tecnicismo — es exactamente la forma del expediente aceptado (matriz en `ES.SDGC.CP`, cesión en `ES.LOCAL.CP` arrastrando la referencia del padre), y un guardián de «mismo refcat ⇒ error» habría rechazado el único caso con IVG positivo que este proyecto tiene |
| **M8** *(2026-08-05, fase 1)* | El XSD estricto sobre un fichero de N miembros | **Validan** contra `cp/4.0` con lxml, en `--estricto`: **3.487 B** con dos miembros y **4.893 B** con tres. ⚠️ Lo que esto dice es que el ESCRITOR aguanta; que la Sede acepte tres o más **sigue sin medirse** |
| **M9** *(2026-08-05, fase 2)* | ⛔ Que el residuo de un expediente DERIVADO sería despreciable, «porque las piezas comparten vértices con la parcela editada y un mismo float redondeado da siempre lo mismo». Escrito en la cabecera de `comprobacion/conjunto.js`, con un umbral fijo de **0,01 m²** debajo | **Falso, y refutado media hora después** sobre la geometría del oro. El error del razonamiento: los vértices que la derivación CREA caen **dentro de un LADO** del contorno oficial, no sobre uno de sus vértices, y al redondearlos se salen de ese lado. Doce recortes de 0,2 m a 12 m dan residuos de hasta **0,1008 m²**: el umbral fijo habría dado **falso positivo en la mitad** de los casos, sobre expedientes perfectamente cerrados. Sustituido por una **COTA derivada** —`δ·P` con `δ = ½·10⁻ᴰ·√2` de `DECIMALES_COORD`, que sale de la derivada del shoelace—: no puede dar falso positivo, y sobre el oro deja **12,4×** de margen medido |
| **M10** *(2026-08-05, fase 2)* | Que el umbral de astilla de F07 (**1 mm**) se heredaba tal cual, y que si no se sostenía se abriría clave propia en `config/operativos.js` (decisión 3 del plan) | **No se sostiene**: las cuñas que mete el redondeo llegan a **2,49 mm** medidas sobre el oro. El fenómeno es OTRO —en F07 las dos fronteras vienen ya en la retícula y discrepan en décimas de milímetro; aquí una es un punto creado sobre un lado y redondeado fuera de él—. ⚠️ Y la clave **NO se abre**, contra lo que preveía el plan: `GROSOR_REDONDEO_M` = **7,07 mm** se DERIVA del formato (`½·10⁻ᴰ·√2`), y ponerlo entre los números que sí se ajustan diría que es una preferencia. Los datos sólo confirman la aritmética: 2,8× de margen sin haber ajustado nada |
| **M11** *(2026-08-05, fase 2)* | La decisión 1A: `@turf/boolean-contains` sólo comprueba vértices, así que en cóncavo diría `true` con un lado fuera | **MEDIDO y convertido en test**, no citado: sobre una parcela en U, `booleanContains` devuelve **`true`** mientras **20 m²** están por fuera. `restar()` sí lo ve, con su área y su grosor. El día que Turf lo arregle, el test se pondrá rojo y la decisión podrá revisarse con el dato delante |
| **M12** *(2026-08-05, fase 2)* | — | ⭐ **El caso que de verdad hace F17 —arrastrar un vértice existente— cierra EXACTO**: residuo `0` y cero cuñas, porque no crea ningún vértice nuevo que redondear fuera de sitio. El caso feo es el del CORTE. Saberlo importa: dice que el margen de M9 sobra en el camino normal y hace falta en el raro |
| **M13** *(2026-08-05, fase 2)* | El coste de paquete de la fase | **+264 B**, y **todos** son los siete tipos nuevos de `TIPO_COMPROBACION` (883.971 → 884.235 B, atribuido revirtiendo sólo ese fichero). Los tres módulos nuevos —`cesion.js`, `identidad.js`, `conjunto.js`— cuestan **0**: `app/` todavía no los importa, y el barrel raíz **no entra en el paquete** (nadie de `app/`, `viewer/` ni `services/` lo importa; medido) |
| **M14** *(2026-08-05, fase 3)* | El plan: «el nombre escrito llega al `localId` del fichero» (criterio del guion 16) | ⛔ **No puede, y se desvía a propósito.** El `localId` de una cesión está MEDIDO (O19, IVG positivo del 2026-08-03) y es la referencia del padre con el ordinal detrás. Meter ahí un texto libre cambiaría el único identificador de finca que este proyecto ha visto aceptar; y `cp:label` tampoco vale, porque significa el número de orden de la parcela dentro del polígono. **El nombre viaja al informe y a la pantalla**, que es donde le sirve a una persona. ⚠️ El guion 16 tiene que comprobar eso y no lo del plan |
| **M15** *(2026-08-05, fase 3)* | El plan: `entrega.js` «serializa → un solo fichero **por `descargarTexto`**» | ⛔ **No lo llama**, y por la misma frontera de siempre: `gml/descargar.js` necesita `Blob`, `URL.createObjectURL` y un `<a download>`, y meterlo aquí sacaría a `derivacion/` del barrel raíz y **rompería la suite `node` entera en el import**. Devuelve `{xml, nMiembros, refcat}` y quien descarga es la aplicación — la misma asimetría que `report/`: **el impuro es el CONSUMIDOR del puro**. Por lo mismo tampoco compone el NOMBRE del fichero |
| **M16** *(2026-08-05, fase 3)* | El XSD estricto sobre el sobre de varias parcelas: en la fase 1 se validó un fichero **construido a mano** para la ocasión | Ahora lo valida sobre un expediente **derivado del oro por el código de producción**: `test/gml/__snapshots__/expediente-entrega.gml`, 3.619 B, dos `gml:featureMember`, escrito por `prepararEntrega` y añadido a la lista por defecto de `npm run validar:xsd`. La forma que la Sede aceptó el 2026-08-03 pasa a tener guardián automático, que hasta hoy no tenía |
| **M17** *(2026-08-05, fase 3)* | El coste de paquete de la fase | **+8.657 B** (884.235 → 892.892). ⭐ Y **ni un byte es algoritmo**: comprobado por ausencia en el paquete construido de `restar`, `derivarCesion`, `prepararEntrega` y `comprobarConjunto`. Es texto —los `porQue` de la propuesta, el aviso declarativo por duplicado, la sección del informe y el grupo del diálogo— más los dos módulos puros que `app/` sí importa ya (`identidad.js` y `operacion.js`). ⚠️ El orquestador **sigue sin llamante en producción** hasta la fase 4 |
| **M18** *(2026-08-05, fase 3)* | — | **CSS: cero bytes.** El desplegable nuevo reutiliza `gml-entrada` y `gml-dialogo-informe-entrada`, que ya traían anchura, familia y `letter-spacing` normalizado para prosa. El presupuesto no se mueve y no hace falta asiento |
| **M19** *(2026-08-05, fase 4)* | El plan y la revisión de diseño daban por hecho que la lista del sobrante **costaría CSS**: la tarea 4.1 nombraba `estilos/app.css` y `scripts/presupuesto-css.mjs`, y el plan avisaba de que «cualquier byte obliga a un asiento nuevo o CI sale rojo» | **CERO BYTES**, y no por casualidad: la sección anfitriona de `index.html` **no lleva clase modificadora** —`.gml-bloque` ya da columna flex, `min-height:0` y el relleno 16/24/0, y el bloque **no se estira**, porque el estirador de Validación sigue siendo `.gml-bloque--vertices` y dos estiradores descosen el reparto— y el cromo de dentro se lo pone `viewer/lista-sobrante.js` **en línea**, como el cajón de F07, porque `viewer/*` no importa ninguna hoja. Se reutilizan seis clases que ya existían (`gml-rotulo`, `gml-rotulo-fila`, `gml-boton`, `gml-accion-estado`, `gml-entrada`, `gml-mono`). ⚠️ El asiento **se anota igual** (`F17 · fase 4`, 62.309 / 47.214 B): un hito sin fila haría que el registro dejara de contar la historia |
| **M20** *(2026-08-05, fase 4)* | ⭐ El coste de paquete de `@turf/difference`, que la fase 1 estimó en **4.309 B** cableándolo a mano y que la tarea 5.2 del plan dejaba pendiente de medir sobre el punto de entrada real | **1.859 B**, medidos sustituyendo el import por un tope en `derivacion/topologia.js` y reconstruyendo (935.021 → 933.162 B). Es **menos de la mitad** de lo estimado, y la dirección de la inferencia del plan era correcta: `polyclip-ts` ya estaba en el paquete vía `@turf/intersect` (F07), así que lo que añade es el envoltorio y no el álgebra — muy lejos de los ~50 kB del motor booleano completo |
| **M21** *(2026-08-05, fase 4)* | El coste de paquete de la fase | **+42.129 B** (892.892 → 935.021), y es el más caro de F17 con diferencia — porque es la fase donde **todo lo anterior estrena llamante**. Atribuido en dos: **+29.410 B** los cuelga el cableado (`derivacion/entrega.js`, `cesion.js`, `topologia.js`, `comprobacion/conjunto.js` y `@turf/difference`, que hasta hoy **no entraban en el paquete** aunque llevaran tres fases escritos y probados), y **+12.719 B** las dos vistas nuevas más la fontanería (`viewer/index.js` las importa siempre, monte o no la bandera). ⚠️ Y con esto la deuda de partir el paquete (**F16**) deja de ser teórica: 935 kB con un techo de aviso de 500 |
| **M22** *(2026-08-05, fase 4)* | El plan declaraba el contrato de la vista con `alDerivar` dentro | ⛔ **No está, y es la decisión D2 aplicada.** El CTA «Derivar sobrante» bajó al PIE del panel, porque el bloque aparece SOLO cuando hay sobrante y un botón dentro de él sería un botón que solo existe después de haberlo pulsado. Lo que sí vive en la lista es `alEntregar` —la acción que CONSUME lo que el bloque enseña—, con el mismo criterio con el que F08 metió «Descargar informe de contraste» dentro del cajón de F07. ⚠️ **El pie pasa a tener TRES botones** y el precio en píxeles **no se ha medido todavía**: es del guion 16 |
| **M23** *(2026-08-05, fase 4)* | Las **cuatro decisiones de diseño que la revisión dejó ABIERTAS** | Cerradas las cuatro, y las cuatro dentro del propio bloque: (1) **nombre accesible** explícito en cada casilla y cada campo —dentro de la etiqueta el texto es el NÚMERO, así que sin `aria-label` un lector de pantalla diría «casilla, 1» sin decir nunca de qué—; (2) el mensaje de **invalidación de 3C** se pinta en el bloque y no en el canal global, porque un aviso se lee donde estaba lo que ha desaparecido; (3) los **`saltados` de 5A**, igual, y con la frase que importa: «puede faltar sobrante en esta lista»; (4) una **pieza fuera del encuadre** se cuenta en un aviso propio, separado de «sin contorno» y de «sin número», porque son tres hechos con tres remedios distintos |
| **M24** *(2026-08-05, fase 4)* | — | ⚠️ **La marca de la pieza estrecha es la PALABRA «estrecha», no un símbolo.** El plan pedía «un ⚠ del vocabulario del proyecto, no un emoji suelto»; el vocabulario de aviso de esta aplicación es el rótulo **«Aviso»** de `app/avisos.js`, que es texto. Y un carácter de advertencia lo lee un lector de pantalla como «signo de exclamación», como «warning» o como nada, según la plataforma. La palabra se lee igual con los ojos y con el oído, y **no dictamina** (regla 9): dice que es estrecha, no que sobre |
| **M25** *(2026-08-05, fase 5)* | ⛔ **El guion 16 encontró un DEFECTO REAL a 1280×720**, que es el viewport MÍNIMO declarado del proyecto | Con dos piezas derivadas la tabla de vértices bajaba a **119,14 px**: la cabecera, la fila del recinto y **DOS** vértices de los quince. Y **el panel no desbordaba** —0 en los dos ejes—, así que no había síntoma: la tabla encogía en silencio. Corregido con **tres cambios, ninguno de CSS**, y cada uno con su cifra: el renglón del pie **se calla** cuando hay piezas porque el bloque ya lo dice mejor (**+22,84 px**); el porqué de la puerta sale del renglón y va al panel de avisos (cinco líneas de prosa en un `role="status"` de 343 px); y el hueco del bloque baja de 8 a **4 px** (**+8 px**), que eran exactamente la diferencia entre enseñar dos filas de vértices y enseñar tres |
| **M26** *(2026-08-05, fase 5)* | El suelo contra el que se juzga la tabla de vértices: la primera versión del guion decía **120 px** | ⛔ **Me lo inventé.** Se DERIVA de lo que miden esas filas (Chrome, 1280×720): cabecera pegajosa **24,00** + fila del recinto **26,50** + tres vértices × **24,69** = **124,57 px**. El punto de comparación que sí significa algo es F06, donde el bloque de edición dejó la tabla en **64 px** —cabecera y 1,6 renglones— y ése fue el defecto que costó mudar la edición al mapa |
| **M27** *(2026-08-05, fase 5)* | El alto por fila de la lista: la revisión de diseño publicó **31,00 px** | **26 px** medidos sobre la lista de verdad. Aquel número salía de una maqueta escrita antes que el componente. No era un defecto —ninguna pieza desaparece y el contador dice cuántas hay— pero el tope quedaba en 124 px y enseñaba **4,77 filas** en vez de 4: **20 px de panel cobrados de más** justo en la pantalla donde F17 está gastando a propósito. `ALTO_FILA_PX` pasa a 26 y el tope a **104** |
| **M28** *(2026-08-05, fase 5)* | ⭐ El precio del panel, con las tres correcciones puestas | **1440×900: la tabla queda en 283,48 px, POR ENCIMA de los 267,44** que el proyecto defiende desde F07 — la racha se rompe a propósito y no se rompe tanto como el plan temía. **1280×720: 126,14 px**, sobre el suelo de 124,57 con **1,57 px de margen**, y eso hay que decirlo: **cualquier cosa que se le añada al bloque lo revienta y el síntoma seguirá siendo mudo**. El bloque cuesta **116,55 px** y mide **117,33** con dos piezas. Desborde **0 en los dos ejes** en las dos resoluciones |
| **M29** *(2026-08-05, fase 5)* | El pie del panel con el TERCER botón: la revisión de diseño avisó de que había que comprobar que no lo empuja | **249,86 px**, o sea **+40,39** sobre los 209,47 que medía con dos, y **CABE**: `dentroDelPanel: true`, 0 px por debajo, y el botón se ve con las tres patas (dentro de la ventana, nadie lo tapa, `elementFromPoint` lo devuelve) |
| **M30** *(2026-08-05, fase 5)* | El delta de `@turf/difference` sobre el punto de entrada REAL (tarea 5.2) | **1.859 B** (935.021 → 933.162 sustituyendo el import por un tope). Ver **M20**: es menos de la mitad de lo que estimó la fase 1 cableándolo a mano, y confirma la inferencia del plan — `polyclip-ts` ya estaba en el paquete vía `@turf/intersect` desde F07, así que lo que añade es el envoltorio y no el álgebra |
| **M31** *(2026-08-05, fase 5)* | El criterio del plan «el nombre escrito llega al `localId` del fichero», que **M14** ya declaró imposible | Medido en el navegador y convertido en las dos afirmaciones que sí valen: el nombre **se queda en la pantalla** y **NO aparece en los bytes** del `.gml`, y lo que sí llega son los `localId` de O19 —`9398516VK3799G`, `…G.1`, `…G.2`— con sus dos namespaces (`ES.SDGC.CP` y `ES.LOCAL.CP`). El fichero baja con prefijo **`expediente_`** y 3 `gml:featureMember`. ⏳ La deuda de «el guion 16 cambia de criterio» queda **saldada** |

## Deuda declarada

- ⏳ **El `.gml` de dos `featureMember` que la Sede aceptó no está versionado.**
  Mientras siga así, la prueba de cierre contrasta contra los 466,2141 del fixture
  pero **no reproduce byte a byte** lo que obtuvo el CSV.
- ⏳ **El techo de CSS.** La hoja va **5.150 B por encima** del techo de 42.064 B, y
  la quinta rebanada del rework sigue sin cerrar. F17 **no lo resuelve y sí lo
  empeora**: cada byte suyo entra con asiento propio y `rebanada: null`.
- ⏳ **El desplegable de «Tipo de operación» no se ha explorado más allá de sus dos
  opciones**, y **no se ha medido** si el IVG se queja ante una combinación
  incoherente (Segregación con un miembro, o al revés).
- ⏳ **La cuarta afirmación del cierre —que ningún miembro se SALGA del contorno
  oficial— se DEDUCE, no se mide.** El álgebra es exacta (sin solape,
  `área(∪) = Σ áreas`; con la suma, eso es `área(oficial)`; con la cobertura,
  `oficial ⊆ ∪`, luego lo de fuera es 0), pero las tres mediciones de las que
  cuelga no lo son: vale hasta la tolerancia de la suma y hasta el umbral de
  astilla. Para el camino de F17 da igual —una pieza de `P_of − P_new` está dentro
  de `P_of` por construcción—, y **el día que `comprobarConjunto` coma un fichero
  ajeno habrá que medirlo**.
- ⏳ **A 1280×720 el margen sobre el suelo es de 1,57 px** (**M28**), y el síntoma
  de pasarse **es mudo**: el panel no desborda, la tabla de vértices encoge en
  silencio. Cualquier cosa que se le añada al bloque del sobrante hay que medirla
  con el guion 16 en esa resolución, no solo mirarla a 1440×900.
- ⏳ **El paquete pasa de 935 kB** (**M21**) con un techo de aviso de 500, así que
  la deuda de partirlo (**F16**) deja de ser teórica. F17 no la resuelve.
- ⏳ **La cesión con `nationalCadastralReference` VACÍA no está medida.** O19 dice
  que la forma con sufijo vale; que la otra falle sigue sin comprobarse, y ese
  camino es el que toma `identidadDeCesion` cuando la matriz tampoco tiene
  referencia (un alta que se segrega).

## Deuda saldada

- ✅ **El criterio del guion 16.** El plan le mandaba comprobar que el nombre llega
  al `localId`; comprueba lo contrario y las dos mitades (**M31**), que es lo que
  protege el único identificador de finca que la Sede ha aceptado.
- ✅ **Las cuatro decisiones de accesibilidad que la revisión de diseño dejó
  abiertas**, cerradas en la fase 4 y las cuatro dentro del propio bloque
  (**M23**). La que más costaba era la primera y no era la más difícil: sin
  `aria-label` explícito, un lector de pantalla lee «casilla, 1», «casilla, 2»…
  porque el texto que la etiqueta envuelve es el NÚMERO.

- ✅ **Los comentarios caducos de `gml/serialize-cp.js`**, que la fase 0 dejó
  exentos y vigilados. La tarea 1.3 los reescribió y **la lista de excepciones se
  vació**, que era lo que su guardián exigía. ⛔ Y al vaciarla, el guardián dio
  verde sin mirar nada: la frase había quedado partida en dos renglones al
  reajustar el comentario, y el detector escaneaba línea a línea. Ahora aplana el
  texto y devuelve la línea donde empieza. **Un detector que solo ve lo que cabe en
  100 columnas no protege de nada.**

- ✅ **El vocabulario.** «Multiparcela está fuera de alcance» dejó de ser cierto el
  2026-08-03 y seguía sosteniendo invariantes en nueve sitios. Corregido **el
  motivo, jamás el invariante**, con guardián que deja retractar la frase y no deja
  afirmarla.
- ✅ **El nombre del fichero.** `PREFIJO_NOMBRE` decía «parcela» en singular para un
  fichero que puede llevar varias. Con `miembros > 1` pasa a `expediente`, y el
  camino de una sola parcela **da exactamente el mismo nombre que antes**, con
  guardián de regresión: tres exportaciones más derivan su nombre cortando esa
  cadena por la longitud del prefijo.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que la Sede acepte el expediente.** Ningún XSD expresa las reglas de negocio del
  IVG. Criterio 4, y es la única verificación que cierra la fase.
- **Que el navegador no bloquee la descarga.** No hay callback ni excepción: desde
  JavaScript **no se puede ver**. Se evita por diseño (un solo fichero) y se mira en
  el guion de navegador.
- **Que «se propone, no se crea» se entienda sin explicación.** Toda la decisión de
  proponer las piezas en vez de crearlas se apoya en eso, y **eso no lo puede firmar
  un test**: es el punto bloqueante del checklist humano §13.
- **El reparto de píxeles del panel.** jsdom no maqueta. Lo mide el guion 16 en un
  navegador de verdad.

## Estado

✅ **CERRADA el 2026-08-11 con IVG POSITIVO** sobre un fichero de varias parcelas
generado por la app. El detalle —y la diferencia con la aceptación del 2026-08-03,
que no es la misma cosa— está al final de esta ficha. Lo anterior a esa línea es el
registro de las seis fases, y se lee como historia.

*(Estuvo ⏳ EN CURSO desde el 2026-08-05.)*

**Fase 0 · abrir la fase — hecha el 2026-08-05** (6.011 / 133): el expediente de
oro entra como fixture con guardián, las justificaciones caducadas dejan de
sostener invariantes, el fichero de varias parcelas estrena nombre, y esta ficha
existe.

**Fase 1 · los tres cimientos puros — hecha el 2026-08-05** (6.073 / 137):

- **1.1** `geo/grosor.js` y `geo/poligono.js#coordsRegion` salen de donde estaban
  presos (privados en `diagnostico/topologia.js`), y `esRecintoApto` deja de estar
  escrita tres veces. `coordsRegion` devuelve **coordenadas y no un `Feature`**:
  `geo/` sigue sin importar Turf, que es lo que impide que pueda arrastrarlo.
  Corrige el límite conocido del grosor (**M5**).
- **1.2** la capa `derivacion/` con su barrel, su léxico —quinta copia del contrato
  **D**— y `restar()` devolviendo **`{piezas, saltados, detecciones}`**, para que
  `[]` no pueda significar «no hay sobrante» y «no se pudo medir» a la vez. Entra
  `@turf/difference` por subpaquete, **con su delta medido** (**M6**). Y el
  guardián que ata las CINCO fábricas de detección, que hasta hoy nadie comparaba.
- **1.3** `serializarExpedienteCp`: el sobre deja de ser de una parcela.
  `MIEMBROS = 1` era constante desde F04 y su JSDoc anticipaba este día. La
  regresión de una sola parcela tiene prueba **de cadena completa** (**M7**, **M8**).

**Fase 2 · la derivación y el cierre — hecha el 2026-08-05** (6.137 / 140):

- **2.1** `derivacion/cesion.js`: `derivarCesion` mide el sobrante pieza a pieza,
  lo numera con un orden **total y determinista** —norte→sur, oeste→este, área, y
  una firma canónica que lo hace independiente del orden en que Turf devuelva las
  piezas— y resuelve la puerta `P_new ⊆ P_of` **restando al revés** (**M11**). Las
  astillas se **listan** con sus cifras, al revés que en F07: aquí no son ruido de
  un aviso, son trozos de finca. La puerta tiene **tres** estados y el tercero es
  `null`.
- **2.3** `derivacion/identidad.js`: los tres campos del `inspireId` como **una
  sola afirmación**, con la cesión implementando **lo medido** (O19: referencia del
  padre sufijada, no vacía) y no lo deducido.
- **2.2** `comprobacion/conjunto.js` con el barrel que la capa estrena: el cierre
  sobre coordenadas **ya redondeadas**, con las **tres** afirmaciones. Los dos
  números que las gobiernan dejaron de ser constantes elegidas y pasaron a
  derivarse del formato, porque la medición refutó los dos (**M9**, **M10**).

**Fase 3 · la entrega y el acto jurídico — hecha el 2026-08-05** (6.197 / 144):

- **3.1** `derivacion/entrega.js`: el orquestador. Deriva, valida **cada pieza** por
  `validation/parcela.js` entera —también las que calcula el programa, que son las
  que nadie ha mirado—, comprueba que el conjunto CIERRE **antes de escribir nada**,
  y emite un `.gml` con N `gml:featureMember`. ⛔ Una pieza excluida se dice con su
  superficie, y si lo excluido rompe el cierre **la entrega se bloquea**: un
  expediente que no cierra vuelve con IVG negativo. Dos desviaciones del plan
  escritas y razonadas (**M14**, **M15**), y el snapshot que estrena guardián de
  esquema para el sobre de varias parcelas (**M16**).
- **3.x** `derivacion/operacion.js`: el «Tipo de operación», deducido de la FORMA
  del fichero y **propuesto, nunca decidido**. ⛔ Cuando la forma no se corresponde
  con ninguna de las dos que la Sede ha aceptado, `tipo` sale `null` en vez de una
  suposición, y el diálogo **no deja componer** hasta que alguien elija.
- **3.2** El informe DECLARA SU ALCANCE: lista las N parcelas marcando la que
  describe —el `<-- ELEGIDA` de F08 trasladado al papel firmable— e imprime el tipo
  de operación con los tres candados de F09 dentro de la frase. En el PDF y en el
  informe de texto. Y el desplegable entra en «Preparar informe», con **cero bytes
  de CSS** (**M18**).
- ⭐ Con esto **el flujo F06→F07→F09 deja de ser una Subsanación sin nombre**: la
  aplicación lo nombra hoy, en el caso de uso más frecuente, que era el hueco que
  `SPEC.md` §7.2 dejaba escrito.

**Fase 4 · la pantalla del sobrante — hecha el 2026-08-05** (6.278 / 147):

- **4.1** `viewer/piezas.js` y `viewer/lista-sobrante.js`. Las manchas llevan un
  **número permanente** y el resaltado es **recíproco**: sin eso, «las piezas se
  proponen, no se crean solas» cumple la letra y no el propósito — revisar sin
  poder decir qué mancha estás nombrando es teatro. La lista tope **4 filas con
  scroll y no recorte**, y el contador dice cuántas hay aunque solo se vean
  cuatro. ⛔ El panel **no desborda** cuando esto crece: la tabla de vértices
  encoge en silencio, así que aquí no hay síntoma visible y el guardián tiene que
  ser el guion 16. **Cero bytes de CSS** (**M19**), y las cuatro decisiones
  abiertas de diseño, cerradas (**M23**, **M24**).
- **4.2** `app/cableado-derivacion.js` y el **paso 16** de `app/main.js`.
  `derivacion/entrega.js` estrena llamante en producción, y con él toda la cadena
  de las fases 1 a 3 (**M21**). El predicado del CTA es **barato y estructural** y
  **no mira la superficie** —«área menor» no implica «estar dentro»—; la puerta
  corre al pulsar y explica con cifras. ⛔ **No basta `xml !== null`**: se mira
  `puedeEntregarse`, porque el fichero de una sola parcela sería un GML impecable
  y válido contra el XSD mientras el EXPEDIENTE está mal. ⛔ La foto **caduca con
  cualquier cambio del store**, no solo cuando entra otra parcela: mover un
  vértice es exactamente lo que la invalida, y la identidad no cambia al moverlo.
- ⚠️ **«Generar GML» no se toca**: sigue significando el GML de UNA parcela.
  Cambiarle el comportamiento por debajo cuando hay sobrante sería que el mismo
  botón entregara dos cosas distintas según un estado que no se ve. El pie estrena
  un tercer CTA y su precio en píxeles queda **pendiente de medir** (**M22**).

**Fase 5 · los gates — hecha el 2026-08-05** (6.279 / 147):

- **5.1** `scripts/smoke-navegador/16-derivar-cesion.js`, `ok:true` en **las dos**
  resoluciones y consola limpia. ⛔ **Encontró un defecto real a 1280×720** —la
  tabla de vértices en 119,14 px, sin desborde y por tanto sin síntoma— y se
  corrigió con tres cambios, ninguno de CSS (**M25**). Corrigió además dos números
  que este proyecto estaba usando sin haberlos medido: el suelo de la tabla
  (**M26**) y el alto de fila (**M27**). Es el **cuarto** guion de la carpeta que
  destapa un defecto de producción, y el único que conduce una feature entera
  **sin tocar la red**.
- **5.2** El delta de `@turf/difference` sobre el punto de entrada real: **1.859 B**
  (**M30**), menos de la mitad de lo estimado en la fase 1.
- **5.3** `CHECKLIST-HUMANO.md` §13, con sus **dos** puntos y los dos BLOQUEANTES:
  que «se propone, no se crea» se entienda sin explicación, y la **verdad externa**
  —un expediente REAL derivado por la app, presentado en la Sede, con IVG positivo
  y su CSV anotado en `SPEC.md` §7.1—.

⏳ **F17 NO se cierra aquí.** Queda el criterio 4, que es el único que la máquina no
puede firmar: **el IVG positivo sobre un expediente real**. Hasta entonces lo que
hay es una aplicación que hace el recorrido entero y un guion que lo demuestra.

### ✅ CERRADA EL 2026-08-11 — el criterio 4 se cumplió

El autor subió al IVG un `.gml` de **varias parcelas generado por esta
aplicación**, la Sede **cargó todas las parcelas** y **emitió informe POSITIVO**.

⭐ **Por qué esto no es lo mismo que la aceptación del 2026-08-03**, y conviene que
quede escrito porque las dos se parecen y solo una cierra la fase: aquella (CSV
`XMWPXCN9J8DB9J89`) demostró que **la Sede admite el formato** de N
`gml:featureMember`. Ésta demuestra que **nuestro serializador lo produce bien** —
que es lo que el criterio 4 pedía y lo que ninguna prueba de este repositorio
podía firmar. Entre las dos hay ocho miembros de spec, un rechazo por
`xmlns:xlink` en F13 y toda la fase 3.

⏳ **Falta anotar el CSV de ESTE informe** en `SPEC.md` §7.1, junto a los otros
dos. Sin él la verificación es un testimonio y no una comprobación repetible, que
es exactamente la distinción que §7 existe para sostener. Es lo único que le queda
a esta ficha.

## Referencias

- `SPEC.md` §3 (overrides **O18**, **O19**, **O20**), §4 (fila P11), §7.1 (la
  segunda verificación con certificado) y §7.2 («Tipo de operación»).
- `test/fixtures/gml/PROCEDENCIA.md` — la ficha del expediente de oro.
- `test/gml/fixture-oro-f17.test.js` — la que ejecuta esa procedencia.
- `spec/feature-07-diagnostico-parcela.md` — de donde salen `medirPieza`, el umbral
  de astilla y el patrón de «no se pudo medir».
- `spec/feature-04-gml-parcela.md` — el sobre de ENTREGA y los dos perfiles.
