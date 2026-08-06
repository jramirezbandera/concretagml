# F19 · Pegado de coordenadas

**Fase:** 19 · **Prioridad:** P13 (cierra el Bloque B) · **Riesgo:** Bajo ·
**Depende de:** F01 (`parsers/list.js`, escrito y en verde desde la fase 1), F18
(el bucle de revisión y el cableado de medición, que es de TEXTO), F08 (la puerta
y el `modo`), F11 (la rama activa como enrutador) ·
**Habilita:** que la vía que F01 llama **principal** exista.

**Ficheros previstos:** `app/dialogo-pegado.js` (nuevo) y
`scripts/smoke-navegador/18-pegado-coordenadas.js` (nuevo). Tocados:
`app/cableado-medicion.js` (partir `alFichero` en `alTexto`),
`app/cableado-edificio.js` (el mismo gesto en la otra rama), `parsers/importar.js`
y `geo/huso.js` (la proyección de grados), `app/main.js` (el rótulo del GML ajeno
y el enrutado), `index.html` (un botón), `estilos/app.css`.

> ⏳ **Ficha abierta con el plan.** Lo que aquí se afirme del futuro y resulte
> falso **no se borrará**: se conserva citado al lado de lo medido. Manda lo
> medido (regla de oro 8).

## Objetivo

**Saldar las dos deudas que F18 dejó con dueño escrito, y una tercera que dejó
solo dicha.** No hay alcance nuevo: las tres estaban nombradas, con fecha, en
`feature-18` §Deuda declarada.

1. ⛔ **El pegado de LIST** — la vía que
   [`feature-01:14`](feature-01-entrada-parcela.md#L14) llama **principal** y que
   **no tiene ni un manejador de `paste` en producción**.
2. ⛔ **Coordenadas en grados**: se detectan y **no se proyectan**.
3. ⚠️ **`GML_EXISTENTE` rotulado «Parcela del Catastro»** en la cabecera.

## Cómo llega esta ficha aquí, porque el mecanismo ya costó once fases una vez

F18 se abrió porque un requisito marcado ✅ **no tenía dueño en el índice**: el
único sitio del proyecto que le asignaba casa era un comentario de código. Al
cerrarla se sacaron tres cosas fuera **por decisión explícita** y —esta es la
diferencia— **con casa escrita en el índice y en la ficha**. F19 es esa casa.
Que se abra dos días después de F18, y no once fases más tarde, es el entregable
de método.

## Las ocho decisiones (entrevista del 2026-08-06)

1. **Entran las tres deudas**: pegado, grados y el rótulo del GML ajeno. *(La
   petición de partida decía «una tarea»; la entrevista la amplió a tres.)*
2. **El pegado vive en un `<dialog>` con un `<textarea>`**, tras un segundo botón
   en la vía «Medición propia». No es un manejador global de `Ctrl+V`: competiría
   con el campo de referencia catastral, donde F06 ya midió un fallo silencioso.
3. **Acepta cualquier texto, autodetectado.** `importar()` ya distingue
   LIST/TXT/DXF sobre el texto pegado; el diálogo **dice qué formato ha creído
   leer**, porque aceptar de más sin decirlo es meter algo distinto de lo que
   crees.
4. **El cotejo de superficie se enseña SIEMPRE, con las dos cifras**, y **antes de
   aceptar** — es el único sitio donde todavía se puede cancelar.
5. **Pero solo en el pegado.** Por fichero el cotejo sale por el panel, después:
   la decisión 3 de F18 (la revisión se abre **solo cuando hay algo que decidir**)
   **no se toca**.
6. **Si el texto pegado no produce parcela, el diálogo se queda abierto con el
   motivo** — el texto sigue ahí y se corrige sin volver al CAD.
7. **La rama activa decide el destino, igual que el fichero de F18**: con PARCELA
   entra como medición; con EDIFICIO, como partes.
8. **Los grados se deducen y se enseña dónde ha caído la parcela** antes de
   aplicar nada — el patrón que F01 §Detecciones ya exige para el huso. **Ninguna
   corrección se aplica sola** (decisión 4 de F18, intacta).

## Mediciones (2026-08-06, ANTES de escribir una línea de código)

**M1 · ⭐ El bucle de F18 ya es de texto.** `alFichero`
(`app/cableado-medicion.js:410-470`) solo aporta el tramo `File → arrayBuffer →
decodificarGml`; de ahí abajo —listado propio, rondas de decisión, `aplicar`— todo
opera sobre un `string`. **La tarea del pegado es partir esa función, no escribir
otra.**

**M2 · Cero manejadores de `paste` en producción**, confirmado hoy: la única
aparición de la palabra en todo el repositorio es **la deuda escrita en la ficha
de F18**.

**M3 · ⛔ Y el primer número que iba a escribir por inferencia lo refutó medir el
mismo día.** Iba a decir «`resultado.superficie` existe y no lo consume nadie». El
campo **no está ahí**: vive en **`resultado.resumen.superficie`**
(`parsers/importar.js:763`), y `resultado.superficie` es `undefined`. La primera
parte sí se sostiene, medida por su ruta buena: **ningún módulo de `app/`,
`viewer/` o `report/` lo lee**. F19 es su primer consumidor.

**M4 · ⭐ El cotejo, sobre el listado real, sale exacto.** `test/fixtures/parsers/LIST.txt`
(11 vértices) declara **Área: 61.0450** y la app calcula **61,04503326536568**:
diferencia **0,0000333 m²**, relativa **5,45·10⁻⁷** contra un umbral de 0,01,
`coincide: true`. Y es **la misma parcela** que F18 midió por las otras dos vías
(`UTM.dxf` capa `0` y `PARCELA.txt`, 61,0450 m²): **las tres vías de F01 son el
mismo solar**, así que el guion puede exigir el mismo número por las tres puertas.

**M5 · ⭐ El listado real TRAE una decisión, así que el recorrido no es el trivial.**
`importar()` sobre él da `HUSO_AMBIGUO` (**2 interpretaciones viables, 30 y 31**;
se ofrece la 30) además de `SEPARADOR_DECIMAL`, `Z_DESCARTADA` y `CIERRE`. Con
`{huso: 30}` quedan **4 detecciones, todas INFO**, y `construida: true`.

**M6 · ⛔ La LISTA declara «Marcas de polilínea: Cerrado» y NADIE lo lee.**
`parsers/list.js` captura `meta.cerrado` desde F01 y **no tiene un solo
consumidor** (medido: grep, cero fuera de su propio JSDoc). Sobre el fichero real
esto produce dos afirmaciones simultáneas: el fichero dice «Cerrado» y la app
avisa «anillo tratado como ABIERTO: primer y último vértice distan **3,5207 m**».
Las dos son ciertas —AutoCAD no repite el vértice de cierre— pero **puestas una al
lado de la otra se leen como una contradicción**, que es exactamente lo que el
guion 13 destapó en F11. LIST es el único formato que declara **superficie Y
cierre**; F19 contrasta los dos o ninguno.

**M7 · ⭐ El orden lon/lat NO es ambiguo dentro de España, y es un hecho de rangos,
no una heurística.** `BBOX_ESPANA` es `lon ∈ [−9,5 · 4,5]` y `lat ∈ [35,5 · 44,5]`:
**disjuntos** (medido: `lonMax >= latMin` → `false`). Ninguna pareja puede leerse
como válida en los dos órdenes ⇒ **como mucho una lectura cae en España**, y por
eso «deducir y enseñar dónde ha caído» (decisión 8) es seguro sin preguntar el
orden.

**M8 · ⭐ Y el huso sale de la longitud sin desproyectar nada.**
`floor((lon+180)/6)+1` en los extremos del bbox da **29 … 31**, que es exactamente
`HUSOS_VALIDOS`. La deducción del huso en grados **no necesita `detectarHuso`**
—que existe para el problema inverso— ni sus candidatos.

**M9 · ⛔ Lo que hoy se le dice al usuario en grados es FALSO.** Medido con un
pegado de Málaga en grados: los dos órdenes salen `construida: false` con
`bloqueos: ['COORDENADAS_EN_GRADOS','HUSO_NO_RESUELTO']` —correcto— **pero el
motivo que se enseña es «El centroide de la parcela (−4.42, 36.72) no cae en la
España peninsular ni Baleares»**, y ese punto **es** Málaga: está dentro de
`BBOX_ESPANA` leído como lon/lat. `detectarHuso` lo trata como metros UTM y
desproyecta un disparate. **No entra nada malo, pero el motivo miente**, que es la
misma familia del diagnóstico falso que F18 midió en el `.txt` propio.

**M10 · ⛔ Canarias no se puede proyectar, y hay que decirlo con su nombre.** El
huso 28 está **diferido por el override O13**: no está en `HUSOS_VALIDOS`, ni en
`SRS_POR_HUSO`, ni en el bbox (`geo/huso.js:36-80`). Un pegado en grados del
archipiélago **no puede caer en «fuera de España»**: hay que nombrar Canarias y
decir que esta versión no la proyecta.

**M11 · `forward(lat, lon, zona)` existe y sus únicos llamantes son tests**
(medido: 10 apariciones, todas en `test/`). Confirma la M10 de F18. La proyección
de una parcela de Málaga da `x 373.062,91 · y 4.064.897,58` en el huso 30.

**M12 · ⛔ La trampa del rótulo: `navegacion` no existe todavía cuando se pinta la
ficha.** `rotuloDelDato` necesita el `modo` para decir «tomada como tuya», pero
`repintarFicha()` se llama **a mano en el paso 4** (`app/main.js:1658`) y
`crearNavegacion` es **el paso 14** (`app/main.js:3602`): leer `navegacion` desde
ahí es un **`ReferenceError` de zona muerta al cargar la aplicación entera**. El
precedente ya está escrito y es el camino: **`ramaEnPantalla`**, una variable de
módulo que el suscriptor mantiene al día.

**M13 · El renglón de procedencia ya sabe hacerlo.** `app/contraste.js` distingue
origen y modo desde F08, tiene `COLA_TOMADA` («lo has tomado como tuyo…») y
`PROCEDENCIA[ORIGEN_PARCELA.LIST]` **escrito y sin estrenar**. El rótulo de la
cabecera es el que se quedó atrás, no el modelo.

## Alcance

### T1 · El pegado (rama PARCELA y rama EDIFICIO)

- `app/dialogo-pegado.js`: `<dialog>` propio con `<textarea>`, que **fabrica su
  propio DOM** como los de F09/F10/F11/F18. `index.html` aporta **solo el botón**.
- Vista previa antes de aceptar: **formato deducido, nº de vértices y anillos, y
  el cotejo de superficie con las dos cifras** (decisiones 3 y 4).
- `app/cableado-medicion.js`: `alFichero` se parte en `alTexto(texto, nombre)`
  (M1). El nombre del origen deja de ser un fichero: «pegado» o similar, y llega
  al renglón de procedencia y al `idLocal` por el camino que ya existe.
- Sin parcela no hay cambio de reglas: la parcela de DEMOSTRACIÓN **sustituye**,
  una traída del Catastro **conserva su `geometriaOficial`** (decisión 2 de F18).
- El listado de replanteo propio se rechaza **por el mismo detector**
  (`esListadoDeReplanteo`), no por una segunda copia.

### T2 · Proyectar grados

- `geo/huso.js`: la deducción de huso **por longitud** (M8) y el veredicto de
  orden lon/lat **por bbox** (M7), con Canarias nombrada (M10).
- `parsers/importar.js`: la **opción** que aplica la proyección con
  `geo/utm.js#forward` — hoy la detección existe y no hay forma de atenderla.
- El diálogo la **ofrece**: se enseña dónde ha caído la parcela y no se aplica
  sola (decisión 8).
- Se corrige el motivo falso de M9.

### T3 · El rótulo del GML ajeno

- Un cuarto rótulo propio para `GML_EXISTENTE` («de otro técnico · no del
  Catastro») que **cambia al cruzar la puerta** de F08 a «tomada como tuya».
- `rotuloDelDato` pasa a mirar **origen Y modo**, con el modo llegando por una
  variable de módulo al estilo de `ramaEnPantalla` (M12), **no** leyendo
  `navegacion` desde el paso 4.

## Fuera de alcance, y se dice

- **`Ctrl+V` global.** Descartado con su motivo (decisión 2), no olvidado.
- **Canarias (huso 28).** Sigue diferida por O13; F19 solo la **nombra** cuando
  aparece, que es lo que hoy no hace (M10).
- **El cotejo de cierre declarado (M6)** entra o no según lo que cueste T1: si no
  entra, **sale de esta ficha con dueño escrito**, no como una nota al pie.

## ⛔ Lo que encontró el guion, y por qué la suite no lo veía

**El renglón de procedencia decía «Geometría medida por ti, del fichero
«coordenadas pegadas»».** Llamar *fichero* a lo que el usuario acaba de pegar es
una afirmación falsa sobre el origen del dato, **escrita justo en la línea que
existe para decir de dónde salió**.

**Y la prueba de la suite lo aprobaba.** Exigía que la frase contuviera «pegad», y
lo contenía — dentro de la frase que afirmaba lo contrario. **Cuarta vez que este
proyecto paga casar por la FORMA del texto en vez de por la afirmación** (F17 fase
1, F18, el guardián de `/catastro/i`). Corregido con `deFichero`, en las dos ramas,
y el guardián ahora exige que **NO** diga «del fichero».

⚠️ **Y tres fallos más eran del guion, no de la aplicación**, que también conviene
tener escritos porque son de método:

- **Dos acuses en falso por medir la tabla de vértices con el selector de manual**:
  el `<tbody>` lleva una fila de cabecera por recinto (11 vértices ⇒ **12 filas**), y
  las coordenadas viven en **`<input value>`** porque la tabla es editable desde
  F06 (`td.textContent` devolvía `""`). El guion denunció que la proyección no había
  entrado teniendo **373062.907** delante.
- **Un guardián anti-vacuidad que era él mismo vacuo**: `Boolean(puerta)` es cierto
  aunque la puerta esté oculta —el nodo vive en `index.html` desde el arranque—, así
  que el centinela que existía para detectar «no ha cargado nada» decía que sí.
  ⛔ Y detrás había un hecho que el plan no sabía: **soltar un GML no escribe el
  store**; la parcela ajena no entra hasta pulsar «Contrastar con el parcelario»
  (diseño de F08). Sin ese clic, el bloque entero pasaba en verde sin medir nada.

## Criterios de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | El pegado del `LIST.txt` real entra con **11 vértices y 61,0450 m²**, el mismo número que las otras dos vías | ✅ guion 18 (`298755.589 / 4090054.379`) + suite |
| 2 | El diálogo enseña **las dos cifras de superficie antes de aceptar** | ✅ «declara 61,0450 · aquí sale 61,0450 (coinciden)», medido visible |
| 3 | Un texto que no sirve **deja el diálogo abierto con el motivo** | ✅ 20 pruebas del diálogo |
| 4 | Con la rama EDIFICIO el mismo gesto carga **partes** | ✅ suite (la rama decide, como el fichero de F18) |
| 5 | Un pegado en grados **se proyecta tras confirmarlo**, y el motivo falso no existe | ✅ `373062.907 / 4064897.582` en el navegador |
| 6 | Canarias **se nombra** y no cae en «fuera de España» | ✅ 3 pruebas · ⏳ sin fixture real, se dice |
| 7 | La cabecera **no dice «Parcela del Catastro»** sobre un GML ajeno, y cambia al cruzar | ✅ «de otro técnico» → «tomado como tuyo», medido en Chrome |
| 8 | Guion `18-pegado-coordenadas.js` en `ok:true` | ✅ tras una primera corrida en rojo con **un defecto real** |
| 9 | Se **mide y se declara** lo que cuesta | ✅ **0 px** en el panel · **+12,32 kB** de JS, **+1,62** de CSS |

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **El `Ctrl+V` de verdad.** ⚠️ Medido: **Chromium no aplica el pegado por defecto
  de un `ClipboardEvent` sintético**, así que ni la suite ni el guion tocan el gesto
  real. → `CHECKLIST-HUMANO.md` §15.1, **BLOQUEANTE**.
- **Que el `<dialog>` sea un modal de verdad**: en jsdom su prototipo tiene
  exactamente `constructor` y `open`. Lo mide el guion 18.
- **Que la parcela proyectada caiga DONDE TENÍA QUE CAER** sobre la cartografía real.
  Los números cuadran en un test; la superposición solo la ve una persona → §15.2.
- **Canarias con un fichero de verdad**: no hay fixture y no se inventa uno.

## Estado

✅ **Código y pruebas: 6.393 pruebas / 151 ficheros, verde** (partida: 6.339/150).
✅ **Guion `18-pegado-coordenadas.js` en `ok:true`, `problemas: []`.**
⏳ **Firma humana**: `CHECKLIST-HUMANO.md` §15, con un punto **BLOQUEANTE**.

**Coste medido**: **0 px** en el panel (el `<dialog>` flota) · JS **961,96 kB**
(+12,32) · CSS **65,82 kB** (+1,62) · **ni una dependencia nueva**.

## Referencias

[`feature-18-entrada-parcela-fichero.md`](feature-18-entrada-parcela-fichero.md)
(§Deuda declarada: las tres deudas, con fecha) ·
[`feature-01-entrada-parcela.md`](feature-01-entrada-parcela.md) (el requisito y
las detecciones defensivas) ·
[`feature-08-comprobar-gml.md`](feature-08-comprobar-gml.md) (la puerta y el modo)
· `SPEC.md` §3 override **O13** (Canarias diferida).
