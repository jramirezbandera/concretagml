# DESIGN.md — el sistema de diseño de Concreta GML

**Escrito el 2026-08-11.** Hasta ese día este documento no existía, y su ausencia
costó lo que cuenta el apartado siguiente.

---

## 0 · Qué es este documento, y qué no

**Es el registro de las decisiones de aspecto que esta aplicación ha tomado y por
qué.** Nada de lo que hay aquí es una aspiración: todo está en el código, y lo que
lleva un número está medido.

**No es** un manual de estilo genérico, ni una guía para otro producto, ni la
documentación del sistema de diseño del que esto salió. Y sobre todo **no es la
fuente de la verdad**: la fuente son `estilos/tokens/`, `estilos/app.css` y las
constantes de `viewer/`. Si este documento y el código discrepan, el código gana y
este documento está roto — hay que arreglarlo aquí.

Lo que se escribe aquí es lo que **el código no puede decir por sí solo**: los
porqués que se reparten entre tres sitios, las decisiones que se re-tomaron, y las
que se dejaron a propósito sin tomar.

---

## 1 · La procedencia, dicha una vez

`estilos/tokens/` empezó el **2026-07-26** como copia literal de
`prototipo/_ds/concreta-design-system-bac861fa-.../tokens/`, que es el sistema de
diseño de **una calculadora de hormigón armado**. La copia estaba bien hecha y su
procedencia estaba escrita en la cabecera de cada fichero.

El problema no fue la copia. Fue que **nadie volvió a adaptarla a este producto
durante dieciséis fases**, y así llegó al 2026-08-10, cuando una revisión de diseño
lo midió:

| | cuenta |
|---|---|
| Variables declaradas en los cinco ficheros de tokens | **120** |
| Sin un solo `var()` que las llamara en todo el producto | **71** |
| — de sección de hormigón (armaduras, cercos, tensiones) | 14 |
| — de estratos geotécnicos | 13 |
| — de casos de carga (sobrecarga, viento, nieve, sismo) | 4 |
| — dimensiones de la cáscara de la calculadora y de su portada | 8 |
| — alias cortos «para el sitio de marketing» | 19 |
| — rampa tipográfica de display (`clamp()` hasta 68 px) | 3 |
| — el resto (tintes, transiciones, radios y espaciados sin uso) | 10 |
| Reglas CSS muertas (`.canvas-dot-grid`) | **1** |
| Tokens del tema oscuro, nunca cableado | **~45** |

**Podado el 2026-08-11.** Quedan **46 variables**, todas con llamante. El asiento
del presupuesto de esa fecha tiene el reparto exacto de los **4.552 B** que devolvió
la hoja construida.

⛔ **Y con la poda se rompe la copia fiel a propósito.** A partir de esa fecha
`estilos/tokens/` **no se sincroniza** con `prototipo/`. Si el sistema de la
calculadora evoluciona, traer un valor es una decisión de este producto, una a una,
y quien la tome la deja escrita. `prototipo/` sigue siendo referencia visual y no
es dependencia: la aplicación no importa nada de allí ni en build ni en ejecución.

⚠️ **La lección de método, que es lo que de verdad hay que llevarse.** Esto no se
descubrió mirando: se descubrió *contando*, y solo cuando alguien fue a contar. El
guardián que ahora lo impide (`test/estilos/cascara.test.js`) existía desde el
2026-08-10 **pero solo vigilaba las variables `--gml-*`**, las que escribe este
proyecto. Los tokens del sistema de diseño no los vigilaba nadie, y esa asimetría
es todo el agujero. Un guardián que cubre la mitad de una categoría no cubre la
mitad del riesgo: cubre la mitad que ya te preocupaba.

---

## 2 · EL REPARTO: dónde vive cada decisión de aspecto

Esto es lo primero que hay que entender de esta aplicación, y lo que sorprende a
quien llega. **El color y el tamaño de letra no viven todos en el CSS**, y no es
descuido: es una restricción medida, con tres zonas y una frontera clara.

### Zona 1 · `estilos/tokens/*.css` — el vocabulario
Los 46 valores primitivos: paleta, escala tipográfica, espaciado, radios, fuentes,
transiciones. **Nada de maqueta.** Ni un selector, con una excepción histórica que ya
no está (`.canvas-dot-grid`, retirada).

### Zona 2 · `estilos/app.css` — la aplicación vestida
Todas las reglas de la cáscara, el panel, la barra, los diálogos y el cromo del
mapa. Aquí viven también **los tokens propios de este producto**, los `--gml-*`, que
no son del sistema de diseño porque no existen en él (ver §3 y §5).

### Zona 3 · `viewer/*.js`, `report/canvas.js`, `export/dxf.js` — el estilo EN LÍNEA
⛔ **Estos módulos no importan ninguna hoja de estilo, y no pueden.** El motivo está
escrito en varios de ellos y es el mismo: **tienen que ser legibles sobre una
ortofoto aunque la hoja no cargue**, y tienen que funcionar en jsdom y sobre un mapa
pelado, sin cascada que resolver. Un `L.divIcon` o un cajón flotante que dependa de
`app.css` se vuelve invisible el día que la hoja falle, encima de una imagen aérea.

Consecuencia, **MEDIDA el 2026-08-11**: hay **152 literales de color hexadecimal en
16 ficheros de JavaScript**, con 24 valores distintos. Y consecuencias que hay que
tener presentes al proponer cualquier cosa:

- **Un estilo en línea gana a cualquier selector.** No se «arregla» desde `app.css`.
  Cuando la escala tipográfica del cajón de diagnóstico se rediseñó, la escala tuvo
  que vivir en el módulo (`viewer/cajon-diagnostico.js#ESCALA`) y de la hoja solo
  salieron 56 B.
- **Ningún tema de color alcanza la zona 3.** Es la razón por la que esta aplicación
  no tiene tema oscuro (§4).
- **Promover un color de la zona 3 a token NO es automáticamente mejor.** Ya se
  decidió no hacerlo con `COLOR_OFICIAL` (#6B7280) y el motivo se sostiene:
  obligaría a mantener el mismo valor en dos sitios sin nadie que los atara. Lo que
  sí ata es que el comentario de la regla nombre su origen. **La excepción es
  `--gml-color-usuario`**, que sí está en las dos zonas — y tiene un guardián que lo
  justifica (§3).

---

## 3 · Color

### 3.1 · La paleta del sistema (22 tokens, `estilos/tokens/colors.css`)

| grupo | tokens |
|---|---|
| Superficies | `--color-bg-primary` #ffffff · `--color-bg-surface` #f8fafc · `--color-bg-elevated` #f1f5f9 |
| Filos | `--color-border-main` #cbd5e1 · `--color-border-sub` #e2e8f0 |
| Texto | `--color-text-primary` #0f172a · `--color-text-secondary` #475569 · `--color-text-disabled` #64748b |
| Acento | `--color-accent` #0284c7 · `--color-accent-hover` #0369a1 |
| Botón primario | `--color-btn-primary-bg` #0369a1 · `-hover` #075985 · `-fg` #ffffff |
| Estados | `--color-state-ok` #15803d · `-warn` #b45309 · `-fail` #dc2626 · `-neutral` #64748b |
| Scroll | `--color-scrollbar` #94a3b8 · `-hover` #64748b |
| Tintes | `--color-tint-accent` · `-warn` · `-fail` (`color-mix` al 8–10 %) |

La superficie del botón primario va **desacoplada del acento de enlace** a propósito:
blanco sobre #0369a1 da ≈ 5,7:1, que es AA; sobre el #0284c7 del acento no llegaría.

### 3.2 · Los colores propios de este producto

No están en el sistema de diseño porque no existen en él. Viven en `estilos/app.css`:

- **`--gml-color-usuario` = #ffd600.** La geometría del usuario, la que se edita y se
  serializa. Es amarillo desde la Fase 5 de F03, y el valor anterior era el violeta
  del sistema (`--color-chart-envelope`, #7c3aed): **la revisión visual sobre la
  ortofoto real demostró que el violeta desaparece sobre las sombras oscuras.** El
  token del sistema ya no existe; el histórico está en la cabecera de `colors.css`.
- **`--gml-color-usuario-sobre-claro` = #a16207.** El mismo color, para fondo claro.
  ⚠️ **No es cosmética: es contraste medido.** #ffd600 sobre el blanco del panel da
  ≈ 1,4:1 y no se lee. Esta variante da ≈ 5,0:1. **En el panel se usa siempre ésta**,
  y hay cuatro sitios de `app.css` donde el comentario lo repite porque es el error
  fácil.
- **`COLOR_USUARIO` = '#FFD600'** en `viewer/_comun.js` — el mismo valor en la zona 3,
  porque el visor no puede leer la hoja. **Es la única duplicación deliberada de un
  color, y tiene guardián**: `test/estilos/cascara.test.js` la declara en su lista
  `LEIDAS_DESDE_JS`, y `test/viewer/comun.dom.test.js` afirma el literal.
- **`COLOR_OFICIAL` = '#6B7280'** en `viewer/sincronizacion.js` — el parcelario del
  Catastro, el que solo sirve para contrastar. Neutro a propósito: no es el trabajo,
  es el fondo contra el que se compara.

### 3.3 · La regla que gobierna todo uso de color: la de oro nº 9

> **La aplicación mide; el colegiado interpreta y firma.** Ninguna cifra lleva juicio
> de valor: sin semáforos, sin «válido/no válido».

Esto **no es una preferencia estética, es el contrato del producto**, y tiene 76
aserciones en 10 ficheros de test. Se ha re-decidido al menos tres veces. Lo que
implica, en concreto:

- ⛔ **Ningún color de mérito sobre una cifra medida.** Una superficie, una
  desviación o un solape se pintan en el color del texto, nunca en verde ni en rojo.
  Un veredicto de encaje en el cajón de diagnóstico se propuso el 2026-08-10 y **se
  descartó por esto**.
- ✅ **Sí color sobre el estado de la propia aplicación.** «Esta acción se completó»
  (verde), «esta acción falló» (rojo), «esto está apagado y aquí está el motivo»
  (gris). Eso no juzga el trabajo del usuario: es la máquina de estados diciendo si
  te deja seguir, que es lo que el rojo lleva haciendo desde F04.
- ✅ **Única excepción sobre un dato: la invasión a colindante.** Es un hecho
  topológico binario, y admite ámbar.
- **El color nunca es el único canal.** Los dos indicadores de geometría cargada
  cambian el TEXTO además del color («Sin levantamiento»), y por eso no hace falta
  una utilidad de texto solo para lectores.

### 3.4 · El verde llegó tarde, y merece quedar escrito

`--color-state-ok` estaba definido desde la copia del 2026-07-26 y **tuvo CERO usos
hasta el 2026-08-10**: ni #15803d ni #22c55e aparecían fuera del fichero de tokens.
La aplicación contaba errores en rojo y avisos en ámbar, y cuando la acción salía
bien lo decía en el mismo gris que «no hay parcela». Se podían recorrer las tres
pantallas, generar un GML válido y **no ver un solo verde** — en un producto que
existe entera para que la Sede te acepte un fichero.

Lo usa `.gml-accion-estado--exito`, en el único desenlace en el que la acción pedida
se completa (`entrega.descargado`). **54 B de hoja.** Se cuenta aquí porque la
lección no es sobre el verde: es que **un token definido no es un token usado**, y
nada lo decía.

---

## 4 · El tema: esta aplicación es de tema CLARO, y está decidido

**Decisión del 2026-08-11.** El bloque `html[data-theme="dark"]` que venía en la
copia —~45 tokens, completo y coherente— **se ha retirado**.

No se retiró por gusto ni por bytes (591 B). Se retiró porque estaba **muerto y era
irrecuperable a bajo coste**, y las dos mitades de esa frase se midieron:

- **Muerto:** `data-theme` no aparecía en ningún `.js`, ningún `.html` ni en
  `app.css`. Solo en el selector que lo declaraba. Nadie lo encendía y nada podía.
- **Irrecuperable a bajo coste:** por el reparto de §2. Un tema de CSS no alcanza los
  152 literales de color de la zona 3, así que cablearlo habría dado una aplicación
  con el panel oscuro y **el mapa, los cuatro cajones, el PDF del informe y el DXF en
  claro**. Y la paleta oscura que había se diseñó para leerse sobre un lienzo blanco
  de cálculo, no sobre una ortofoto.

`color-scheme: light` **se queda**, y no es un resto: es lo que le dice al navegador
con qué esquema pintar los controles de formulario y las barras de scroll nativas.
Sin él, un sistema en modo oscuro pinta los `<input>` oscuros dentro de un panel
blanco.

⚠️ **Qué haría falta para cambiar esta decisión**, si algún día se quiere: subir a
token los 24 valores distintos de la zona 3 **con un guardián que ate cada par**
(como el que ya tiene `--gml-color-usuario`), y rediseñar la paleta oscura contra una
ortofoto real, no contra un lienzo. No es imposible; es que no es gratis, y hoy no lo
pide nadie. El bloque retirado sigue en el historial de git.

---

## 5 · Tipografía

**Geist Sans** (400/500/600) para rótulos, títulos e interfaz. **Geist Mono**
(400/500) para **todo** valor numérico, unidad y referencia catastral, siempre con
`tabular-nums`. Las cinco fuentes son locales (`estilos/fuentes/`, SIL OFL 1.1), con
`font-display: swap`. No hay `system-ui` como primaria.

`--font-features: "ss01", "cv11"` en todo el producto.

### 5.1 · La escala, que es literal en píxeles

Esto es **un instrumento de mesa denso, no una rampa tipográfica de portada**, y por
eso la escala son valores exactos y no una progresión:

| token | valor | papel |
|---|---|---|
| `--text-10` | 10px | cabeceras de sección en VERSALES (`--tracking-caps: 0.07em`), rótulos de grupo |
| `--text-11` | 11px | apuntes, valores de fila, versión |
| `--text-12` | 12px | valores de campo (mono), nombres de fila, opciones de menú |
| `--text-13` | 13px | rótulos de campo, peldaños del recorrido |
| `--text-14` | 14px | título de módulo |
| `--text-15` | 15px | marca de la barra |
| `--gml-titulo-tam` | 19px | el `<h1>` del panel. **Propio: el sistema no llegaba** |

### 5.2 · La segunda escala, la del cajón (zona 3)

`viewer/cajon-diagnostico.js#ESCALA`, en línea y por el motivo de §2:

`DATO_XL` 30px (la superficie medida, y nada más) · `DATO` 15px (toda cifra) ·
`CUERPO` 13px (prosa) · `APUNTE` 12px (procedencia, notas) · `ROTULO` 10px (grupo).

Existe porque **antes de rediseñarla se midió que 92 de las 105 declaraciones de
tamaño de la aplicación valían 10, 11 o 12 px**: el dato y su nombre se leían igual de
fuerte. Y peor: varias filas del cajón no declaraban tamaño, así que heredaban los
12 px de Leaflet sobre el mapa y otro valor dentro del panel — **el mismo cajón se
veía de dos tamaños según dónde estuviera**.

⚠️ Tiene un guardián anti-deriva: `test/viewer/cajon-diagnostico.dom.test.js` recorre
el DOM y exige que **todo** `fontSize` en línea salga de `ESCALA`. Cazó un `11px`
suelto nada más escribirse.

⚠️ Y una regla de contenido: `DATO_XL` se aplica **solo cuando hay cifra**. «No
consta» a 30 px grita una ausencia.

---

## 6 · Espaciado, radios y dimensiones

**Base 8 px.** `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16
(relleno del panel) · `--space-6` 24.

8 px es el `gap` de `.gml-campo-fila` y `.gml-bloque`, y es también
la separación de columna que se eligió para las vías de Entrada: **la columna respira
igual que la fila**.

**Radios: tope duro en 6 px.** `--radius` 4 (campos, chips, botones) · `--radius-md`
6 (diálogos, cajones, marcos) · `--gml-radio` 6 (el propio del cromo del mapa). Nada
más redondeado que 6 px aparece en la aplicación.

**Dimensiones propias** (`--gml-*` en `app.css`, porque son de esta cáscara y no del
sistema): `--gml-panel-ancho` 392px · `--gml-barra-alto` 48px ·
`--gml-cabecera-alto` = barra + 1px de filo · `--gml-alto-control` 32px ·
`--dot-grid-size` 22px (el paso de la retícula de puntos que se ve de telón mientras
cargan las teselas).

⚠️ **Por qué el control mide 32 px y no 34**, que es la clase de decisión que este
documento existe para no volver a discutir: **34 no está en la rejilla de 8 y 32 sí**
(4 × 8), y además se midió el precio — con 34, la columna de Entrada crecía 10 px y
«Abrir un GML» pasaba de caer ~2 px bajo el pliegue a caer 12. Con 32 el conjunto de
aquella revisión salió a −0,56 px, o sea neutro. El encargo del autor lo prohíbe
expresamente: **«no añadas aire decorativo que reduzca lo que cabe en pantalla; el
objetivo es orden, no vacío»**.

⚠️ **Los cuatro topes de alto van en `vh`**: `--gml-avisos-alto-max` 56vh,
`--gml-partes-alto-max` 26vh, `--gml-cajon-lista-alto-max` 22vh,
`--gml-candidatos-alto-max` 20vh. Existen porque **el suelo declarado del proyecto es
1280×720** y una lista sin tope se come la columna del panel entera.

---

## 7 · Elevación

Tres sombras, y las tres son de este producto (`--gml-sombra-*`):

- `--gml-sombra-panel` `8px 0 20px -6px rgb(15 23 42 / 24%)`
- `--gml-sombra-barra` `0 6px 16px -6px rgb(15 23 42 / 20%)`
- `--gml-sombra-dialogo` `0 8px 30px rgb(15 23 42 / 28%)`

Y dos planos: `--gml-z-barra` 1020 sobre `--gml-z-panel` 1010, los dos por encima del
mapa. **El cromo se despega del mapa** — decisión de la revisión de diseño del
2026-08-10: el cromo flotante sobre la ortofoto necesita separarse de ella, no
fundirse.

---

## 8 · Estados: el contrato de esta aplicación

> **Un control que no se puede usar se APAGA y dice por qué. Jamás apagado y mudo, y
> jamás retirado de la pantalla.**

Es la regla de oro 1 aplicada a la interfaz, y es lo más parecido que este producto
tiene a una firma de diseño. Lo cumplen los tres peldaños del recorrido
(`app/navegacion.js#evaluarPaso`), «Generar GML», «Guardar», y **desde el 2026-08-11
las cuatro salidas** (`app/salidas.js#evaluarSalida`) — que fueron las últimas, y
estuvieron dos días siendo la única incoherencia declarada.

### 8.1 · Por qué se apaga y no se esconde
Una opción que desaparece deja al usuario preguntándose si la recordaba mal, y un
menú que cambia de tamaño según el estado no se aprende nunca. Este producto tiene un
usuario que entra **dos tardes al año**; lo que no se aprende, no se usa.

### 8.2 · Dos redacciones del mismo motivo, y no son la misma frase
- **LARGA** — dice qué no se puede, por qué, **y qué hacer en su lugar**. Va en el
  `title` del control y en el renglón de acuse.
- **BREVE** — dice qué falta. Va pegada al control, hoy como texto visualmente oculto
  (`.gml-rotulo-oculto`), para que el nombre accesible no sea solo «Edición».

⚠️ **Quien decide redacta; quien pinta no escribe ni una palabra en español.**
`app/barra.js` no tiene un solo literal de usuario y hay un test que lo afirma. Los
motivos viven al lado de la regla que los produce, donde no pueden divergir de ella
sin que se vea en el mismo diff.

⚠️ **Lo que se pierde con el texto oculto, dicho sin maquillar:** quien ve la pantalla
y no usa lector solo tiene la forma larga en el `title`, o sea **a un segundo de
haber dudado**. Se aceptó el 2026-08-11 porque hay un tercer canal —el aviso del pie
del panel, y la pantalla de Entrada, que es literalmente la lista de maneras de
traer lo que falta— y porque el renglón visible costaba 19 px de barra a lo ancho de
toda la aplicación.

### 8.3 · El aspecto sale de un `data-*`, no de ARIA
`aria-current`, `disabled` y `aria-expanded` son **contratos de accesibilidad**, y
colgar el aspecto de ellos hace que arreglar lo uno rompa lo otro. Los tres estados
de la barra se pintan desde `data-rail-estado` y hay un guardián que lo exige.

⚠️ Con una excepción razonada: la fila del vértice seleccionado sí cuelga de
`[aria-current='true']`, porque el módulo ya tiene que ponerlo para el lector y ahí
ahorra un atributo `class` por `<tr>`. La prohibición es **de la barra**, no de la
hoja — afirmarla sobre la hoja entera puso rojo un uso legítimo.

---

## 9 · Las reglas duras de la hoja

1. ⛔ **Cero `!important`.** Cuando hace falta ganar una cascada **se sube la
   especificidad**, nunca se fuerza el peso. Llevaba doce fases cumpliéndose sin que
   nada lo vigilara; desde el 2026-08-10 hay un test.
2. **`estilos/app.css` importa los cinco ficheros de tokens y ninguna hoja de fuera.**
   `leaflet.css` lo importa `app/main.js`, que es la entrada, y cambiarlo alteraría
   el orden de la cascada.
3. **Ningún selector puede citar un paso que no existe.** El eje `PASO` del CSS es
   exactamente `PASOS` de `app/navegacion.js`, con un guardián. Nació de un defecto
   vivo: una regla que colgaba de un paso retirado dejó el diálogo del informe
   saliendo como tarjeta durante meses **con 7.374 pruebas en verde**.
4. **Toda variable declarada tiene llamante, y toda `var()` usada está declarada.**
   Las dos direcciones, para `--gml-*` y para los tokens. Es el guardián de §1.
5. **La hoja es también el registro de diseño.** `estilos/app.css` son ~300 kB de los
   que la mayoría son comentarios que explican el porqué de cada regla. **Eso es
   deliberado y el presupuesto lo protege** (§10): se mide la hoja *construida*, donde
   el minificador ya se comió los comentarios, para no castigar nunca el escribir por
   qué.

---

## 10 · El presupuesto de la hoja (criterio 10)

`scripts/presupuesto-css.mjs` es a la vez **el registro y el medidor**: una lista de
asientos, uno por hito, con la hoja construida medida de verdad, y sale rojo si lo
construido no coincide con el último asiento. La única forma de ponerlo en verde tras
tocar CSS es **añadir el asiento con su causa escrita en una línea**.

**Estado al 2026-08-11:**

| | bytes |
|---|---|
| Hoja construida entera | 73.001 B |
| · de este proyecto | **57.906 B** ← la cifra presupuestada |
| · de Leaflet (vendor, invariante en 12 builds) | 15.095 B |
| Techo del criterio 10 | **57.906 B** — clavado, 0 de holgura |
| Rebanadas del rework cerradas | **5/5** |

⭐ **El techo se rebasó ese día y cambió de forma.** Era la medición de F11 (42.064 B),
o sea la línea de salida de una migración, y el criterio pedía «acabar por debajo».
Entre el 2026-08-03 —cuando la quinta rebanada se dejó abierta a propósito para no
hacer exigible un techo al que la hoja no llegaba— y el 2026-08-11 entraron **once
features y una cáscara nueva** contra ese número. Se midió si el hueco se cerraba
limpiando (no: la poda entera devolvió 4.552 de los 20.394 B) y se decidió: **el techo
pasa a ser la medición de hoy, y la regla pasa de «menos de» a «no más de»**.

**La consecuencia práctica, que es la buscada:** con las cinco rebanadas cerradas y
0 B de holgura, **cualquier asiento que suba la cifra pone el script rojo.** Subir el
techo sigue siendo posible —es un presupuesto, no una prohibición— pero pasa a ser
una línea que alguien escribe a mano con su motivo al lado, y no un byte que se cuela
mientras nadie mira.

⚠️ **Y esto tiene una consecuencia de diseño, no solo de tooling:** a partir de aquí,
la forma barata de vestir algo es **reutilizar una clase que ya existe**. No es una
regla nueva —F14, F17 y F21 estrenaron pantallas enteras a 0–70 B haciendo
exactamente eso— pero desde hoy es la única que sale en verde por defecto.

---

## 11 · Lo que este documento NO decide

Se anota aquí para que no parezca resuelto:

- **La tercera vía de Entrada cae 16 px bajo el pliegue a 1280×720.** Medido, y el
  arreglo que queda es recortar aire de la cabecera del panel. Es una decisión que hay
  que tomar **mirando, no calculando**. Ver `TODOS.md`.
- **La barra de edición del mapa se solapa 95,8 px con el control de opacidad** a
  1280×720. Preexistente, medido, y el arreglo pide decidir el reparto de esquinas de
  Leaflet. Ver `TODOS.md`.
- **Los espaciados de la aplicación están mal repartidos** — dicho por el autor el
  2026-08-10, sin medir todavía. Es lo que hace que apretar el panel para ganar 16 px
  sea prematuro: primero hay que saber qué se está apretando.

---

## Apéndice · dónde mirar

| qué | dónde |
|---|---|
| Los 46 tokens | `estilos/tokens/{colors,fonts,motion,spacing,typography}.css` |
| La aplicación vestida y los `--gml-*` | `estilos/app.css` |
| El color y la escala del visor | `viewer/_comun.js`, `viewer/sincronizacion.js`, `viewer/cajon-diagnostico.js#ESCALA` |
| Los guardianes de la hoja | `test/estilos/cascara.test.js` |
| El presupuesto y su registro | `scripts/presupuesto-css.mjs` · `npm run build && npm run presupuesto` |
| Apagado con motivo | `app/navegacion.js#evaluarPaso` · `app/salidas.js#evaluarSalida` |
| Lo que solo se ve en un navegador | `scripts/smoke-navegador/GUION.md` |
