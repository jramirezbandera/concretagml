# TODOS

Trabajo identificado y aplazado a propósito. Cada entrada lleva su motivo, su
contexto y qué la bloquea, para que retomarla no cueste rediseñarla.

---

## ✅ CERRADA · El presupuesto de CSS estuvo en rojo entre T4 y T7 (2026-08-20)

**Abierta y cerrada el mismo día**, y se conserva por la lección, no por el trabajo.

El rediseño de la barra movió `estilos/app.css` **+1.115 B** en T4 y T6, y el plan ponía
**un solo asiento al final** (T7) para que cubriera las dos: un asiento por hito, y el
hito era la barra entera. Cerrada con el asiento «El rework de la barra de edición» y el
techo subido a mano a 63.701 B nuestros. Holgura de nuevo 0, que es la forma declarada.

⭐ **LA LECCIÓN, que es lo único que hace falta recordar de aquí:** durante esas tres
tareas `npm test` estuvo en verde con **8.241 pruebas** y `npm run presupuesto` en rojo.
Es el único guardián del repositorio que puede quedarse rojo **sin poner ni una prueba en
rojo** — la suite mide la LÓGICA del script sobre datos sintéticos, no la hoja construida,
y no puede: haría falta un `npm run build` dentro de la suite. Quien deje trabajo de CSS
a medias tiene que anotarlo aquí, porque el CI de pruebas no lo va a recordar por él.

---

## Deshacer y rehacer no son herramientas de geometría, y siguen en la barra del mapa

**Anotada el 2026-08-19 tras `/plan-eng-review`.** Es la rebanada 2 del diseño
`javie-main-design-20260819-144225.md`, aplazada **en la propia revisión** por coste de
ficheros, no por dudas de diseño.

**Qué.** Mudar `[data-accion="deshacer"]` y `[data-accion="rehacer"]` de
`viewer/barra-edicion.js` a una zona nueva del `<nav class="gml-rail">` de `index.html`.

**Por qué.** Son acciones **de documento**, no de geometría, y comparten fila con cinco
herramientas que sí lo son. En **cuatro pantallas están apagadas** (medido, cabecera del
módulo) ocupando el sitio de más valor de la barra, y su marcha libera **~60 px** del eje
escaso.

⭐ **Lo que esta revisión desbloqueó, y es lo que hace la nota barata de retomar.**
`app/main.js#nodo()` es `document.querySelector` (`main.js:1537`) y los ocho nodos del
contrato llegan como **parámetros inyectables** con ese `nodo()` solo de valor por defecto.
O sea que **`cablearEdicion` no se toca**: el contrato ata NOMBRE y TIPO DE ELEMENTO, **no
ubicación ni módulo productor**. La cabecera de `barra-edicion.js` lo describe como si
atara también el módulo, y no es así.

Y hay un efecto secundario bueno: en el topbar los botones nacerían en **marcado estático**,
o sea que existirían **antes** de que `cablearEdicion` corra en `main.js:3821` — que es
estrictamente más seguro que hoy, donde los fabrica un control de Leaflet.

**Lo que cuesta, contado.** `index.html` (zona nueva), `estilos/app.css` (el `gml-rail` es
`grid-template-columns: auto auto minmax(0,1fr) auto auto` — **cinco columnas exactas**, hay
que abrir una sexta), un asiento en `scripts/presupuesto-css.mjs`, y los guiones de navegador
**08** y **14**.

**Lo que NO cuesta, verificado.** El topbar es `grid-template-rows: var(--gml-barra-alto)`,
**altura fija de 48 px**, y su contenido más alto es la marca, no un botón. **No empeora**
la entrada abierta de la tercera vía de Entrada. Esto se comprobó, no se supuso.

**Bloqueado por.** Nada. La rebanada 0 (mover el control de opacidad a `topright`) la vuelve
**menos urgente**, no innecesaria.

---

## De los tres dolores de la barra, «no reconozco el icono» se queda entero

**Anotada el 2026-08-19 tras `/plan-eng-review`, y señalada primero por la voz externa.**

**Qué.** El autor marcó tres dolores de la barra: no saber qué pasará al pulsar (**B**), no
reconocer el icono (**A**), y no saber en qué estado está (**D**). Las rebanadas acordadas
atacan **B** (el segmentado enseña el contrato) y **D** (el nodo de situación visible).
**A no lo toca ninguna.**

✅ **B y D entregados el 2026-08-20** (tareas T2, T4 y T6 del plan). **A sigue entero**, y
esta entrada sigue abierta por eso.

**Por qué no lo toca.** El globo de la pista enseña la frase entera —a 120 ms de ratón y
**0 ms de teclado**— pero **hay que posar**. Y la forma del segmentado enseña el CONTRATO
(«esto es un modo»), no la IDENTIDAD («cuál de los tres»). Liberar ancho solo ayuda a **A**
si luego se gasta en palabras, que es la aproximación B del diseño, la que no se eligió.

**Cuál sería el arreglo, ya pensado.** Rotular **las contextuales** y dejar en icono las
cinco del núcleo. Es la inversión de lo que hace el código hoy: **lo que se ve poco no se
aprende nunca**, y hoy las raras son justo las que desaparecen.

⛔ **Y NO es un restyle. Dos trampas, las dos localizadas:**
1. `.gml-barra-rotulo` está oculto **con estilos EN LÍNEA** (`viewer/barra-edicion.js:836-848`),
   y un estilo en línea gana a cualquier selector: desde `app.css` no se «arregla». Hay que
   tocar el DOM o crear otro texto.
2. `scripts/smoke-navegador/08-edicion.js:1744-1756` **falla a propósito** si algún rótulo se
   vuelve visible. Es un guardián deliberado, así que hay que renegociarlo, no saltárselo.

**Bloqueado por.** ✅ **DESBLOQUEADO EL 2026-08-20.** Era la rebanada 0 —«sin liberar ancho
esto no cabe»— y el ancho ya está liberado por dos vías, las dos medidas en Chrome a
1280×720:

  · **T1** mudó el control de opacidad a `topright`: el solape con la barra pasa a **0 px²**
    (y de paso se descubrió que el solape **ya existía**, no era un riesgo futuro).
  · **T4** bajó la barra de **326 a 313 px** sin quitar nada: agrupar los tres modos hizo
    innecesario un separador que llevaba filete a los dos lados del dibujo.

⚠️ **Las dos trampas de arriba siguen intactas** —el ocultado en línea y el guardián del
guion 08—: lo que se ha ido es el motivo de ancho, no el trabajo. Y la cifra de 313 px lleva
fecha a propósito: en este fichero ya caducó una sin avisar.

## ~~F17 fase 2 · El colindante recortado~~ ✅ ENTREGADO — se conserva como lección

**Estado:** ⛔ **CERRADO COMO TODO el 2026-08-11.** Se entregó el 2026-08-10 y se publicó
el 2026-08-11 en el commit `f1a8436`, como **[F23](spec/feature-23-colindante-recortado.md)**
(fila **P13d** del índice por prioridad). Entran `derivacion/vecino.js`,
`app/colindantes.js` y el guion `25-colindante-recortado.js`.

⛔ **Esta entrada estuvo diciendo «aplazado · semanas, no días» EL MISMO DÍA en que el
código entraba en el árbol**, y por eso no se borra: el fallo de registro es el aprendizaje.
F23 es la única fase de este proyecto construida **sin pasar por `spec/`** —nació de un
defecto reportado con captura, se diseñó en la conversación y se ejecutó en la misma
sesión—, así que ni `SPEC.md` §4, ni §5, ni este fichero se enteraron. **Lo que no tiene
ficha no tiene quién lo desactualice.**

⭐ **Y los «contras» que justificaban el aplazamiento eran falsos, medido.** Decían que
`model/parcela.js` «no tiene dónde guardar unas vecinas» y que había que sacarlas de la
clausura de `app/cableado-diagnostico.js` al modelo, con colección de geometrías en el
store, selección de geometría activa y undo por capa. **Las vecinas nunca estuvieron en
ninguna clausura**: su fuente es `app/cableado-catastro.js#alColindantes`, una suscripción
pública con `Set` de oyentes y baja, **de la que ya colgaban tres consumidores** (el
diagnóstico de F07, el informe de F09 y el snap de F06). `cableado-diagnostico.js` era **un
suscriptor más que se guardaba una copia**. `model/parcela.js` **no se tocó**, y el registro
nuevo cuesta **cero peticiones**.

La lección no es que la estimación fallara: es **dónde se miró para hacerla**. Se estimó
sobre el sitio donde el dato se **guardaba** —una copia— en vez de sobre el sitio de donde
**venía** —un canal con tres oyentes—. Antes de fechar «semanas», localizar la FUENTE.

**Lo que sigue abierto de todo esto, y no es código:** la verdad externa. El IVG **nunca ha
visto** un expediente que recorte la parcela de otro titular —`CHECKLIST-HUMANO.md` §21 y
§22—, y ése es el riesgo real de la fase: es jurídico, no geométrico. Si la Sede no lo
admite, F23 sirve para **ver** y no para **entregar**.

**La pregunta abierta del 2026-08-02 quedó contestada de paso:** son **varios** colindantes,
no uno (en el expediente real `29050A01000144` el exceso cae sobre dos, 20,29 y 5,19 m²), y
por eso el reparto se pregunta **pieza a pieza** en vez de con una lista corta.

---

## ✅ CERRADA · Las salidas no saben decir si se pueden

**Anotada el 2026-08-09 · cerrada el 2026-08-11.** Estuvo bloqueada por «la rebanada 3 del
topbar (antes no hay menú que se beneficie)», y el aplazamiento caducó el mismo día en que el
menú de salidas subió a la barra.

**Dónde vive ahora.** `app/salidas.js` — módulo neutro y puro, con `evaluarSalida`, y el
predicado tiene DOS llamantes en `app/cableado-expediente.js`: la guarda de la acción y el
pintado del menú. La pregunta de diseño que esta nota dejaba abierta —«junto a la acción, o
en un módulo neutro»— se resolvió por lo segundo, con la anatomía de
`app/navegacion.js#evaluarPaso`: los hechos entran como booleanos, los motivos se redactan en
el módulo que decide, y hay dos formas de cada motivo (larga al `title`, breve al nombre
accesible). Guardián: `test/app/salidas.test.js`.

**Lo que se aprendió, que no estaba en la nota.** Una prueba se llamaba «⛔ el DXF y los dos
listados **se apagan con motivo**, no bajan la parcela» **desde F11, y el cuerpo comprobaba lo
contrario**: que estaban encendidas y contestaban al pulsarlas. El nombre iba por delante de
la implementación y pasaba en verde. Y había dos pruebas distintas con el mismo título en el
mismo `describe`, ninguna de las dos mirando el `.txt`. Coste en hoja: **0 B** — la forma
breve reutiliza `.gml-rotulo-oculto`, que ya existía y su propio bloque declara reutilizable.

---

## La tercera vía de Entrada cae bajo el pliegue a 1280×720

**Estado.** Abierto. Defecto **introducido** por la rebanada 1 del topbar (2026-08-10) y
**medido**, no estimado. El guion 14 lo reporta y por eso sale `ok:false`.

**Bloqueado por.** Nada técnico: es una decisión de producto sobre qué se recorta.

**Qué.** En la pantalla Entrada, a 1280×720 —el suelo declarado del proyecto— la tercera vía
(«Abrir un GML») nace por debajo del borde visible de su sección.

⭐ **ACTUALIZADO DOS VECES EL 2026-08-10. De 139 px a 35, y de 35 a 16.**

1. *Rebanada 2.* Subir el pie de Entrada a la barra le devolvió 104 px al panel, y subir los
   chips y el conmutador vaciaron parte de la cabecera. La salida 1 de las tres de abajo **ya
   se aplicó** y no bastó: quedaron 35 px.
2. *Retirada del renglón de motivo.* La barra bajó de 72 px de alto a 53, y los 19 px fueron
   enteros aquí: **quedan 16 px.** Medido con el guion 14 en `#/parcela/entrada`.

Hay que scrollear dentro del panel para ver la tercera vía. Las otras dos se ven enteras.

⚠️ **Los 16 que faltan ya NO salen de mudar nada: salen de recortar aire.** La cabecera del
panel mide 106,9 px de los que 34 son relleno (20 arriba, 14 abajo) y 72,9 contenido real
—MEDIDO—, así que dejarla en 12+12 y bajar el margen del `<h1>` a 8 px daría los 16 justos. No
se ha hecho, y el motivo es del día: el autor acababa de decir que los espaciados de la
aplicación están mal repartidos, y apretar el panel para ganar 16 px es exactamente la
decisión que hay que tomar mirando, no calculando.

**Por qué pasa, con los números.**

| | antes | después |
|---|---|---|
| Alto del panel | 720 | 648 |
| Caja de la sección de Entrada | 587,69 | 515,69 |
| Contenido de las tres vías + separadores | 575,61 | 575,61 |
| Holgura | **+12,08 px** | **−59,42 px** |

La barra se lleva 72 px de alto y la holgura que había era de 12,08. **La aplicación estaba a
doce píxeles de este acantilado antes del topbar**; el topbar no lo creó, lo cruzó. Y no hay
hueco muerto que recuperar: la sección tiene 16 px de relleno arriba y 8 de separación entre
vías, MEDIDOS. Para que las tres cupieran, el panel necesitaría 707,92 px, o sea una barra de
12 px como mucho — que no es una barra.

**Lo que ya se descartó, y por qué.**
- ~~*Encoger la barra.* Su mínimo honrado es ~61 px (peldaño de dos renglones 32,85 + renglón
  19 + filo 1 + holgura). Recupera 11 de los 60 que faltan.~~ ⛔ **Este descarte era CORRECTO
  con los datos de entonces y quedó obsoleto el mismo día:** el renglón de 19 px que entraba en
  esa cuenta se retiró, así que la barra bajó a **53 px** sin degradar nada. Se anota en vez de
  borrarse porque la lección es sobre el método: un mínimo calculado sobre una pieza que puede
  desaparecer no es un mínimo, es una foto.
- *Relajar el umbral del guion 14.* Es el guardián que se salta solo. El criterio —«una vía
  que hay que buscar no es una opción, es un secreto»— sigue siendo el correcto.

**Pros de arreglarlo.** Es el criterio 7 del rework, y la Entrada es la primera pantalla que
ve alguien que abre la aplicación por primera vez — que es literalmente el usuario que este
rework persigue.

**Contras.** Cualquier salida real toca la maqueta de Entrada o la cabecera del panel, y eso
es alcance que la revisión de ingeniería dejó fuera de la rebanada 1 a propósito.

**Las tres salidas candidatas, sin elegir.**
1. **La cabecera del panel** (132,31 px medidos: `gml-eyebrow` 15,94 + `gml-capas` 13,19 +
   `gml-titulo` 22,80 + `gml-chips` 25,39, más 34 de relleno). Parte de eso son ciudadanos
   naturales de la barra —los chips de aviso y el conmutador de rama— y subirlos es
   **exactamente la rebanada 2/3**. Es la salida que no inventa nada.
2. **Compactar las tres vías.** 190,61 / 165,50 / 142,50 px. Son tarjetas con título,
   párrafo y botones; hay grasa. Es un rediseño de Entrada, con su propio criterio de
   aceptación.
3. **Aceptarlo y decirlo.** La sección scrollea de verdad (`overflow-y: auto`), así que la
   vía es alcanzable. Lo que falla es que no se ve que haya más abajo.

**Cuándo caduca.** Si el suelo declarado sube de 1280×720, esto desaparece solo: a 1280×792
ya caben las tres (medido). No parece que vaya a subir.

**Por dónde empezar.** `estilos/app.css`, `.gml-panel-cabecera`, y la conversación de la
rebanada 2 sobre qué sube a la barra. Volver a lanzar el guion 14 a 1280×720 después.

---

## La pista del botón apagado no se puede abrir con el teclado

**Estado.** Abierto y **declarado el mismo día en que se introdujo** (2026-08-19), que es la
única forma honrada de meter una regresión conocida.

**Qué pasa.** Los cuatro CTA del pie de Edición —«Traer el parcelario de fondo», «Traer
colindantes», «Diagnosticar encaje», «Rehacer el parcelario»— escriben al lado por qué están
apagados (regla de oro 1). Desde hoy ese texto ya no ocupa alto: sale como un globo al pasar
el ratón por encima (`.gml-accion:hover`, en `estilos/app.css`). El motivo del cambio está
medido: con los cuatro apagados —el arranque de la aplicación— esos párrafos valían **307,28
px** y dejaban la tabla de vértices en **8,36 px, cero filas visibles**, a 1280×720.

**Qué se pierde.** Un `<button disabled>` **no es enfocable**, así que quien ve la pantalla y
no usa ratón no tiene ningún gesto con el que abrir la pista. No es un fallo silencioso —el
renglón sigue siendo un `role="status"` con su texto dentro, escondido con `opacity` y no con
`display`, así que el lector de pantalla lo anuncia igual que ayer—, pero sí es un hueco real
para el teclado sin lector.

**Qué lo arreglaría, y por qué no se ha hecho hoy.** Cambiar `disabled` por
`aria-disabled="true"` en los cuatro: el botón seguiría enfocable —y la pista abriría con
`:focus-within`, una línea de CSS— a cambio de volverse **pulsable**, o sea de tener que
explicarse al pulsarlo en vez de solo al señalarlo. Eso es una decisión de producto y toca
los cuatro cableados (`cableado-diagnostico.js`, `cableado-catastro.js`,
`cableado-derivacion.js`) y las pruebas que afirman `.disabled`. No cabía dentro de un encargo
que era de altura de columna.

**Por dónde empezar.** `estilos/app.css`, el bloque «EL MOTIVO DEL BOTÓN APAGADO SE VUELVE
PISTA», y el comentario gemelo en `index.html` sobre `.gml-accion`.

---

## El chip dice «0 errores» mientras el panel dice «14 errores»

**Estado.** Abierto. **Medido** el 2026-08-11 en Chrome, en las DOS ramas. Lo destapó
rehabilitar el guion 13; no es de F11 ni de F21.

**Qué.** La aplicación cuenta los errores que bloquean la generación **en dos sitios con
dos fuentes distintas**, y en pantalla se contradicen:

| | qué dice | de dónde sale |
|---|---|---|
| El renglón del panel | «14 errores bloquean la generación del GML: Parte 1 no tiene…» | la validación, **en vivo**, en cuanto entra el dato |
| El chip de la barra | «0 errores» | el canal de avisos, que solo se puebla **al pulsar** «Generar GML» |
| El filtro del diálogo | «Errores 0» | el mismo canal |

Está en la captura que el autor mandó el 2026-08-11 con la app **vacía**: chip «0 errores»
y caja roja diciendo «1 error bloquea la generación del GML: La parcela no tiene ningún
recinto». Y con un edificio de 7 partes sin plantas: chip «0 errores», panel «14 errores».

**Por qué importa más de lo que parece.** No es un contador desalineado: es que **los
motivos que bloquean no llegan al diálogo de avisos**, que desde el 2026-08-07 es el sitio
donde vive la lista larga. El renglón enumera dos de catorce y remata con «(…y 12 motivo(s)
más.)» — y esos doce **no se pueden leer en ninguna parte**. Se comprobó antes de proponer
nada: el diálogo tenía 6 tarjetas y ninguna era de los 14.

**Lo que ya se hizo, y por qué no basta.** El renglón se acotó a `max-height: 96px` con
scroll propio, porque a 1280×720 con 14 errores medía 136,75 px y el panel **recortaba
13 px** — o sea que el texto que dice por qué no puedes generar caía por debajo del borde.
Eso arregla el recorte y **no arregla la contradicción**.

**Las dos salidas, sin elegir.**
1. **Que los errores de validación entren en el canal de avisos** en cuanto se conocen. El
   diálogo ya tiene filtro de errores y el chip ya sabe contarlos: los dos existen y están
   vacíos. ⚠️ El riesgo a medir antes es la frecuencia — la validación corre a cada cambio,
   y publicar catorce tarjetas por tecleo es peor que el problema.
2. **Que el chip no cuente lo que no puede contar.** Si el canal solo se puebla al pulsar,
   el rótulo «0 errores» está mintiendo por omisión y debería decir otra cosa.

**Por dónde empezar.** `app/main.js#recorrido` (publica los errores **solo** al pulsar, con
su comentario ya escrito), `app/avisos.js` (el chip y su recuento) y el gemelo de edificio
en `app/cableado-edificio-gml.js#motivoDeBloqueo`.

---

## ✅ CERRADA (de verdad) · La barra de edición del mapa se solapa con el control de opacidad

⛔ **ESTA ENTRADA SE CERRÓ MAL EL 2026-08-18, Y SE VUELVE A CERRAR EL 2026-08-19, ESTA VEZ
ARREGLÁNDOLA.** El cierre del 18 decía «el solape es 0 px², llevaba abierta describiendo un
defecto que ya no existía». **Era falso**, y el motivo es exactamente el que esta misma
entrada predicaba: la remedición se tomó **con «Quitar puntos» escondido**, o sea sin la
pantalla donde más botones se ven a la vez — la del levantamiento importado.

**Lo medido el 2026-08-19** en Chromium, `?demo=real`, 1280×720, con las **diez**
herramientas visibles e intersección de rectángulos de verdad:

| | cruce X | cruce Y | área |
|---|---|---|---|
| Opacidad en `bottomright` (como estaba) | 7,9 px | 38 px | **299,3 px²** |
| Opacidad en `topright` (tras el arreglo) | 7,9 px | **0 px** | **0 px²** |

**El arreglo.** `viewer/capas.js#ControlOpacidad` se muda a `topright`, apilado bajo el
control de capas (Leaflet apila por orden de alta y el de capas se da de alta antes, así que
el orden sale solo). `bottomright` se queda solo con la atribución, que cruza la barra en
horizontal pero **0 en vertical**. Entra con la tarea **T1** de la revisión de ingeniería del
2026-08-19.

⭐ **La lección, que es la de esta entrada aplicada a sí misma.** El apunte del 18 escribió
«una cifra de maquetación sin fecha de remedición es una cifra que caduca sin avisar» — y
acto seguido tomó una cifra nueva **sin anotar en qué configuración**. Remedir no basta:
hay que decir **con qué visible** se remidió. Un número de maquetación sin su configuración
es media medida.

---

## Registro histórico del cierre equivocado (2026-08-18)

Se conserva entero porque el fallo de método es el aprendizaje.

**Lo que decía, y de cuándo era.** Que `.gml-barra-edicion` (esquina `bottomcenter`) medía
**547,8 px** y se comía **95,8 px** del control de opacidad a 1280×720. Esa cifra se tomó
cuando la barra llevaba **palabras**. El rediseño a solo iconos la dejó en menos de la mitad
y **nadie volvió aquí a remedirla**.

**Lo medido hoy**, en Chrome real, `?demo=real`, 1280×720, mapa de 888 px:

| | ancho de la barra | solape con el control de opacidad | holgura |
|---|---|---|---|
| Cifra vieja de este apunte | 547,8 px | **95,8 px** | — |
| Medido antes del botón nuevo | **255 px** | **0 px²** | 42,6 px |
| Medido con «Insertar vértices» | **285 px** | **0 px²** | **27,6 px** |

Intersección de rectángulos de verdad, no solo el eje X: con el control de opacidad la
intersección vertical es de 38 px pero la horizontal es **0**; con la atribución pasa lo
contrario (196,1 px de cruce horizontal y **0** vertical). Área 0 en los dos casos.

**Lo que sí cuesta el botón nuevo, medido escondiéndolo y volviéndolo a enseñar:** la barra
pasa de 255 a **285 px**, o sea **30 px** (28 de botón + 2 de `gap`, sin separador propio
porque se pega a la papelera). Como la barra va **centrada**, el borde derecho solo avanza
**15 px**: la holgura baja de 42,6 a 27,6.

**Lo que queda, y es otra cosa.** La holgura son 27,6 px a 1280×720. **Caben dos botones más
de esta barra, y el tercero vuelve a abrir esto.** Cuando eso pase —y la rebanada 2 del
diseño del 2026-08-18 trae «Dibujar recinto» a la rama PARCELA, que es exactamente un botón
más— la salida ya está escrita: o el control de opacidad se va a `topright` bajo el selector
de capas (una línea), o la barra deja de centrarse sobre el mapa entero y se centra sobre el
hueco libre (correcto, pero pide saber el ancho del vecino).

⭐ **La lección, que es la misma que dejó el asiento «El pliegue de la tercera vía»:** una
cifra de maquetación sin fecha de remedición es una cifra que caduca sin avisar. Ésta llevaba
un rediseño entero mintiendo, y el coste no fue el defecto —no lo había— sino que estuvo a
punto de bloquear un botón que sí cabía.

---

## ✅ CERRADA · El sistema de diseño es el de otra app, y no hay DESIGN.md

**Anotada el 2026-08-10 tras `/plan-design-review` · cerrada el 2026-08-11.** Se hicieron los
tres pasos que esta nota dejaba escritos, y las dos decisiones que reservaba al autor están
tomadas y escritas.

**Qué se hizo.**
1. **Poda.** No eran 37 tokens de 58: eran **71 de 120**, porque esta nota solo contó los
   `--color-*` de `colors.css` y el barrido de los cinco ficheros encontró 10 más en
   `spacing.css` (ocho de ellos **las dimensiones de la cáscara de la calculadora**), 5 en
   `typography.css` (la rampa de display con `clamp()` hasta 68 px) y 4 en `motion.css`. Más
   **una regla CSS muerta**, `.canvas-dot-grid`, que la nota no vio: sin un solo nodo con esa
   clase y construyéndose igual, porque el minificador se come los comentarios y no las reglas.
   Devolvió **4.552 B medidos** de hoja construida.
2. **El tema oscuro: RETIRADO**, y el motivo se midió antes de decidir. La app tiene **152
   literales de color hexadecimal en 16 ficheros de JavaScript** (`viewer/*` no puede importar
   CSS por contrato: tiene que leerse sobre una ortofoto aunque la hoja no cargue), así que un
   tema no habría llegado al mapa, ni a los cuatro cajones, ni al PDF, ni al DXF. `DESIGN.md`
   declara la aplicación como de tema CLARO y escribe qué haría falta para cambiarlo.
3. **`DESIGN.md` escrito.** Once apartados, con el reparto de las tres zonas donde vive el
   aspecto —tokens / `app.css` / estilo en línea— que es lo que esta nota no llegó a nombrar y
   es la clave de todo lo demás.

**Y la decisión del techo, que llevaba desde el 2026-08-03 esperando.** Resuelta el mismo día:
el techo del criterio 10 se rebasó de los 42.064 B de F11 a la medición de hoy y cambió de
forma («no más de» en vez de «menos de»), y **se cerró la quinta rebanada**, así que ahora
muerde. El razonamiento está en `scripts/presupuesto-css.mjs#TECHO`. Lo que decidió fue medir
que la poda entera devolvía 4.552 de los 20.394 B que sobraban: **el techo de F11 solo se
cumplía quitando pantallas**, porque contra aquel número se habían medido después once
features y una cáscara nueva.

**Dos correcciones a esta nota, para que no se citen sus cifras.**
- ⛔ **«`--color-state-ok` tiene CERO usos» ya no era verdad al retomarla**: el verde se
  estrenó el 2026-08-10, el día siguiente a anotar esto, en `.gml-accion-estado--exito`. El
  hallazgo que la nota llamaba «el que más pesa» estaba resuelto.
- ⛔ **«`#FFD600` y el ámbar subidos a token» ya estaba hecho**: los dos son
  `--gml-color-usuario*` en `estilos/app.css` desde antes, y `--gml-color-usuario` tiene
  guardián que lo ata a su gemelo de JavaScript. Lo que faltaba no era promoverlos, era
  escribir dónde viven y por qué están en dos sitios.

**Y el guardián, que es lo que impide que vuelva.** `test/estilos/cascara.test.js` exige ahora
que **toda** variable de `estilos/tokens/` tenga llamante, y que `data-theme` no reaparezca sin
cablearse. Antes vigilaba solo las `--gml-*`, y esa asimetría era el agujero entero: un
guardián que cubre media categoría no cubre medio riesgo, cubre la mitad que ya te preocupaba.
Se comprobó por mutación (`--space-99`) que caza.

<details>
<summary>La nota original, como se anotó el 2026-08-10</summary>

**Estado.** Abierto. Preexistente desde la copia del 2026-07-26. Anotado el 2026-08-10 tras
`/plan-design-review`.

**Qué.** `estilos/tokens/` es copia literal de
`prototipo/_ds/concreta-design-system-.../tokens/`, que es el sistema de una **calculadora de
hormigón**. Los ficheros lo dicen ellos mismos en su cabecera de procedencia, y se copiaron
bien: el problema no es la copia, es que nadie volvió a adaptarla a ESTE producto.

**Cuánto, medido sobre `estilos/tokens/colors.css` y todo `app/` + `viewer/`:**

| | cuenta |
|---|---|
| Tokens `--color-*` definidos | 58 |
| **Sin un solo uso en el producto** | **37** |
| — de sección de hormigón (`--color-chart-*`: armadura, cercos, tensiones) | 14 |
| — de estratos geotécnicos (`--color-geo-*`) | 13 |
| — de casos de carga (`--color-fem-q/w/s/e`: sobrecarga, viento, nieve, sismo) | 4 |
| — varios (`bg-canvas`, `dot-grid`, tintes sueltos) | 6 |
| Tokens del tema oscuro `html[data-theme="dark"]`, **nunca cableados** | ~45 |

`data-theme` **no aparece en ningún `.js`, `.html` ni en `app.css`**: el tema oscuro está
completo y muerto. Y al revés, los colores que esta app SÍ usa no están en la paleta:
`#FFD600` vive en `viewer/_comun.js` y el ámbar del panel en `app.css` (`--gml-color-usuario*`).

**El hallazgo que más pesa no es el sobrante, es la ausencia.** `--color-state-ok` (#15803d)
está definido y tiene **CERO usos**; ni `#15803d` ni `#22c55e` aparecen fuera del fichero de
tokens. La app cuenta errores en rojo, avisos en ámbar y, cuando no hay ninguno, apaga el punto
a gris. Se puede recorrer las tres pantallas, generar un GML válido y no ver un solo verde. El
producto entero existe para que la Sede te acepte un fichero y nunca dice que algo esté bien.

**Por qué no se arregló en la revisión.** Se propuso y se aplazó a propósito: el primer frente
elegido fue la jerarquía del panel, que es lo que se ve. Esto no mueve un píxel.

**Cuándo caduca.** No caduca solo. Es el patrón que este mismo repo documenta en la cabecera de
`estilos/app.css`: el rail se quitó en F03 por un motivo que dejó de ser cierto en F04 y nadie
volvió hasta agosto. Una decisión de alcance necesita fecha de revisión, no solo motivo.

**Por dónde empezar.** Tres pasos, en orden y separables:
1. Borrar los 37 tokens sin uso de `estilos/tokens/colors.css` (riesgo nulo, y baja el peso
   construido contra el presupuesto del criterio 10).
2. Decidir por escrito el tema oscuro: cablearlo o retirar sus ~45 tokens. Hoy no es ni una
   cosa ni la otra.
3. Escribir `DESIGN.md` con lo que ES de esta app: la escala tipográfica propia, la paleta
   podada, `#FFD600` y el ámbar subidos a token, y el verde estrenado.

**Depende de.** Nada. El paso 1 se puede hacer hoy. El paso 3 gana si se hace DESPUÉS del
rediseño del panel, porque entonces el documento registra decisiones ya probadas en pantalla.

</details>
