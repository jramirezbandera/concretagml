# TODOS

Trabajo identificado y aplazado a propósito. Cada entrada lleva su motivo, su
contexto y qué la bloquea, para que retomarla no cueste rediseñarla.

---

## F17 fase 2 · El colindante recortado

**Estado:** aplazado · **Bloqueado por:** la feature «dos puertas, no una» (fondo catastral
estable) · **Anotado el:** 2026-08-07

**Qué.** Sacar las parcelas vecinas de la clausura de `app/cableado-diagnostico.js` al
modelo, para poder editarlas y emitir sus GML junto al de la parcela propia.

**Por qué.** Es lo único que un CAD no puede hacer de ninguna manera, y es lo que convierte
«he ajustado mi lindero» en «el IVG sale positivo porque el vecino también cuadra». Cuando
mueves un lindero compartido, la parcela del vecino queda recortada y la Sede necesita ver
las dos alteraciones en el mismo expediente.

**Pros.**
- `colindantes()` (`app/cableado-catastro.js:1229`) ya descarga las vecinas del WFS y ya
  tiene botón en la interfaz. Hoy solo alimenta `snap.dianas()`.
- F17 ya entrega N parcelas en un solo sobre y la Sede lo aceptó con **IVG positivo real**
  (CSV `XMWPXCN9J8DB9J89`, tipo Segregación).
- `recintosDeGeometriaTurf` (`geo/poligono.js:292`) ya devuelve una entrada por pieza
  disjunta, así que las componentes conexas tras una booleana ya están resueltas.

**Contras.**
- `model/parcela.js` «no tiene dónde guardar unas vecinas» (`cableado-catastro.js:584`).
  Exige colección de geometrías en el store, selección de geometría activa, undo por capa y
  repensar quién es «la parcela» del informe y del expediente.
- Semanas, no días.

**Contexto.** Diseñado y diferido en
`~/.gstack/projects/GML/Javier-main-design-20260802-165651.md`, sección **«FASE 2 · El
colindante recortado (diferida, no planificada aquí)»**. Aquel documento ya dice qué hace
falta: sacar `vecinas` de la clausura al modelo, la interfaz de asignación de trozos, y el
presupuesto de red conjunto.

**Pregunta abierta que hay que medir ANTES de planificarlo.** ¿Cuántos colindantes se ven
afectados en un expediente típico: uno, o varios? Decide si la interfaz necesita selección
o basta con una lista corta. Sigue sin respuesta desde el 2026-08-02.

**Por dónde empezar.** `app/cableado-diagnostico.js` — la clausura donde hoy viven
`vecinas`. Y leer antes el design doc de agosto: la mitad del trabajo de diseño está hecha.

---

## Las salidas no saben decir si se pueden

**Estado:** aplazado · **Bloqueado por:** la rebanada 3 del topbar (antes no hay menú que se
beneficie) · **Anotado el:** 2026-08-09

**Qué.** Exponer, para cada salida —DXF, listado de coordenadas, hoja de cálculo, proyecto
`.json`—, un predicado de «¿se puede ahora mismo?» con su motivo ya redactado, en vez del
comportamiento imperativo de hoy, que es decirlo al pulsar.

**Por qué.** Es lo único que separa el menú de salidas de ser coherente con el resto de la
aplicación. Los peldaños del recorrido se apagan CON MOTIVO. El botón «Generar GML» se apaga
CON MOTIVO. Las cuatro salidas no pueden, porque su disponibilidad **no existe como dato**:
solo existe como el error que sale al intentarlo.

**Pros.**
- Cierra la última incoherencia del contrato «apagado con motivo, jamás apagado y mudo».
- Ese estado serviría en cualquier otro sitio que quiera declarar qué se puede entregar, no
  solo en el menú de la barra.
- Convierte cuatro errores reactivos en cuatro avisos preventivos, que para un usuario que
  entra dos tardes al año es la diferencia entre entender y no entender.

**Contras.**
- Toca `app/cableado-expediente.js`, 2.324 líneas.
- Es **extracción de estado de dominio**, no maquetación: el coste real está lejos del que
  parece si se mira solo la interfaz.
- Hoy no molesta a nadie, porque el menú todavía no existe.

**Contexto.** Las cuatro exportaciones viven en `app/cableado-expediente.js` (sus guardas,
hacia `:1746` y `:1819`) y son imperativas. La lista de salidas vive **dentro** de
`crearDialogoExpediente` (`app/dialogo-expediente.js:589`) y no está exportada, así que
tampoco hay una tabla que reutilizar. Se descartó el 2026-08-09 en la revisión de ingeniería
del topbar (tensión cross-model X2, planteada por la voz externa): la propuesta inicial era
«el menú se fabrica desde una tabla exportada» y resultó que ni la tabla existe ni el estado
que la haría útil. Se eligió que el menú NOMBRE las salidas y que el motivo se siga diciendo
al pulsar.

**Cuándo caduca este aplazamiento.** En cuanto el menú exista y alguien pulse una entrada que
no podía pulsar. Ese es el síntoma; si aparece, esto deja de ser un TODO.

**Por dónde empezar.** `app/cableado-expediente.js`, las guardas de las cuatro `exportar*`.
La pregunta de diseño previa es dónde vive el predicado: junto a la acción, o en un módulo
neutro que ni el diálogo ni la barra posean (que es lo que evita acoplar dos superficies de
interfaz, el motivo por el que la tabla exportada se descartó).

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

## La barra de edición del mapa se solapa con el control de opacidad

**Estado.** Abierto. **Preexistente**, no de la rebanada 1 — y la rebanada 1 lo **mejora**.

**Qué.** En Edición, `.gml-barra-edicion` (esquina `bottomcenter`, 547,8 px de ancho) y el
control de opacidad de `viewer/capas.js` (esquina `bottomright`, 255,9 px) se pisan.

**Cuánto, medido a 1280×720:**

| | mapa | solape |
|---|---|---|
| Antes de la rebanada 1 | 678 px de ancho | **200,8 px** |
| Después | 888 px | **95,8 px** |

La barra se centra sobre el mapa; cuanto más estrecho es el mapa, más se mete en la esquina
derecha. Ensanchar el mapa 210 px se llevó por delante 105 px de solape sin proponérselo.

**Por qué no se arregla aquí.** Es de `viewer/barra-edicion.js` y del reparto de esquinas de
Leaflet, no de la cáscara. Arreglarlo dentro de la rebanada 1 sería ensanchar el alcance de
una rebanada que se cerró estrecha a propósito.

**Por dónde empezar.** Las dos esquinas: o el control de opacidad se va a `topright` bajo el
selector de capas, o la barra de edición deja de centrarse sobre el mapa entero y se centra
sobre el hueco que le queda libre. Lo primero es una línea; lo segundo es correcto pero pide
saber el ancho del vecino.

---

## El sistema de diseño es el de otra app, y no hay DESIGN.md

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
