# F14 · Edificio: contraste e informe

**Fase:** 14 · **Prioridad:** P17 (baja) · **Riesgo:** Bajo · **Depende de:** F13, F09 · **Habilita:** —.
**Ficheros:** `diagnostico/edificio.js`, `report/pdf-edificio.js`.

## Objetivo

Cerrar el flujo de edificio con un **contraste opcional** (honesto cuando no hay nada registrado) y un informe que reutiliza la estructura del de parcela añadiendo la ficha de partes.

## Contraste — paso opcional (§16.3)

Accesible desde el final, **fuera del camino principal**, con condición honesta: solo tiene sentido **si ya existe construcción registrada** para esa parcela.

- **Si es obra nueva y no hay nada registrado:** el contraste no aplica. Decirlo con claridad —*"No consta construcción registrada… el GML generado es plenamente válido sin este paso"*— en lugar de inventar una geometría de referencia. **Esta pantalla es un acierto del diseño; conservarla.**
- **Cuando sí aplica:** huella medida frente a la catastral (capa `constru`), solape, si la construcción queda dentro de la parcela, e invasión a colindantes. Mismo principio: **mide y dibuja, no dictamina**; la invasión es la única advertencia con consecuencia fija. **Reutiliza el diseño del diagnóstico de parcela** (F07).
- Acepta también la vía de comprobar un GML de edificio ajeno (F08).

## Informe (§17)

Nombre: **"Informe de construcción para la Sede Electrónica"** (o "…de contraste con la construcción catastral" si se hizo el contraste).

Reutiliza la estructura del de parcela (F09: encabezado, plano, relación de vértices, pie de firma) y añade:
- **Ficha de partes:** una fila por parte con superficie, plantas sobre/bajo rasante (o "—" para piscinas) y tipo.
- **Atributos generales del edificio** (uso, año, estado, inmuebles, viviendas) si el modelo es completo.
- Nota al pie: *"El edificio-envolvente se deriva de las partes con volumen sobre rasante; no se dibuja. Solo entran construcciones sobre rasante; se excluyen voladizos, terrazas y balcones."*
- Si hubo contraste, sus resultados; si no, informe solo declarativo, sin sección de contraste.

## Criterios de aceptación

1. Con parcela sin construcción registrada, aparece la pantalla honesta y **no** se inventa geometría de referencia.
2. Con construcción registrada, el contraste calcula solape/dentro-de-parcela/invasión reutilizando F07, sin veredicto (salvo invasión).
3. El informe incluye la ficha de partes con plantas correctas ("—" para piscinas) y la nota al pie.
4. El nombre del informe cambia según se haya hecho contraste o no.

## Referencias

Plan §16.3, §17, §18 Fase 14, §20, §23.6. Dossier §1.2 (edificio), §5.3 (medir no dictaminar), §5.6 (memoria firmable).

---

# Fase 0 · lo medido antes de escribir una línea (2026-08-07)

Siete medidas. **Tres refutan el plan de la fase**, y las tres mandan sobre él.

## ⛔ M3 · La envolvente multipieza NO se puede aplanar, y uno de los dos módulos MIENTE

El plan daba por hecho que `diagnostico/topologia.js#solape` tragaría la envolvente
entera aplanada en un solo `Recinto[]`. Medido sobre las 13 partes reales, cuya
envolvente son **dos cuerpos** (5,2003 + 316,9279 = 322,1282 m²):

| Con la envolvente APLANADA (`[EXTERIOR, EXTERIOR]`) | Qué hace |
|---|---|
| `geo/area.js#superficie` | ⛔ **LANZA**: «recintos[1] debe ser HUECO; recibido tipo='EXTERIOR'» |
| `geo/poligono.js#coordsRegion` | ⚠️ **NO lanza**: devuelve 2 anillos tomando el 2.º cuerpo por HUECO |
| `diagnostico/topologia.js#solape` | ⛔ **5,2003 m²** en vez de 322,1282 |

⭐ **Los dos módulos discrepan sobre el mismo dato: uno lanza y el otro miente.**
`superficie` mira el `tipo`; `coordsRegion` mira la **posición**. El error silencioso
es de **316,93 m² — el 98,4 % del edificio**, y es exactamente el defecto que F12 ya
pagó una vez («la huella se sumaba sobre todas las piezas juntas y con dos cuerpos el
segundo se restaba, 400 − 3.000 m²»).

⇒ **`contrastarEdificio` trabaja PIEZA A PIEZA y suma.** Medido así: 5,2003 +
316,9279 = **322,1282**, correcto. No es una preferencia de estilo: es la única forma
que no miente.

## ⛔ M1 · El término oficial NO se puede leer por donde el plan decía

`edificio/entrada.js#entradaDesdeGmlBu` sobre `bu_building_9398516VK3799G.gml`
devuelve **`edificio: null`**, y lo dice: detección `PATCHES_MULTIPLES` — «*el
`Building` trae su propia huella (2 caras, 4 + 52 vértices) y NO entra como parte*».
**Es correcto y deliberado** (la envolvente es derivada, no se guarda), pero significa
que ese módulo no sirve para traer el término de comparación.

⭐ **La vía que sí sirve es `gml/parse-bu.js#parsearGmlBu(...).edificio`**, y trae de
más justo lo que el informe §17 pide:

```
anillos: 2 caras (4 vért · 5,2003 m² | 52 vért · 316,9279 m²)   huecos: 0
currentUse '1_residential' · numberOfBuildingUnits 18 · numberOfDwellings 17
conditionOfConstruction 'functional' · dateOfConstruction {beginning, end} · officialArea
```

**La comparación de oro cuadra**: publicada **322,1282** = derivada **322,1282**,
solape cruzado **322,1282 (100 %)**. Es la diana de F13 confirmada desde el otro lado.

**Y el caso CON diferencia ya existe en los fixtures**:
`parsers/edificio_consulta_masiva_3515508VF0831N.dxf` → **8 partes**, envolvente de
**1 pieza, 165,9914 m²**. ⚠️ Ojo: son 7 polilíneas en la capa `Construccion` **y una
en la capa `Parcela`**, y las ocho entran como `incluidasPorDefecto` porque nadie ha
declarado plantas.

## ⛔ M7 · La deuda del cotejo de superficie es MAYOR de lo que estaba escrito

F19 la dejó anotada como «`edificio/entrada.js` no lo propaga». Medido: el `resumen`
de `entradaDesdeTexto` **no tiene clave `superficie`** —
`{via, formatoAutodetectado, origen, nPartes, nVertices, capas, huso, bloqueos,
construido, detecciones}`—. **No es que no se propague: es que no se calcula.**
Y con 8 y 25 partes **no hay UNA superficie declarada** contra la que cotejar, así
que el cotejo de F19 (una polilínea ↔ un número) no se traslada tal cual.

## ✅ M2 · La pantalla honesta tiene su dato, y el servicio ya lo nombra

`wfsbu-coleccion-vacia-13005A10900001.xml` → `ok=true · nMiembros=0 · edificio=null ·
partes=0 · otras=0`, y `services/catastro-edificio.js` lo publica como
**`EdificioCatastro.sinConstrucciones`**. No hay que inventar nada.

⭐ Y un tercer caso que no estaba previsto: `wfsbu-allconstruction-13005A10900001.xml`
(una rústica) trae **`edificio=SI` con 1 anillo y 0 partes** — huella oficial publicada
**sin** partes. El contraste tiene que saber decirlo.

## ✅ M4 · El presupuesto de altura es HOLGADO, y hay una trampa nueva para el guion

Medido en Chrome a 1280×720, sobre la aplicación real:

| Pantalla | `<aside>` | ¿desborda? | Ocupado | `.gml-acciones` |
|---|---|---|---|---|
| `#/parcela/diagnostico` | 392 × 720 | **no** | 602,88 (⇒ **117 libres**) | ⚠️ **`display:none`, 0 × 0** |
| `#/edificio/entrada` (vacío) | 392 × 720 | **no** | 394,30 | — |
| `#/edificio/validacion` (13 partes) | 392 × 720 | **no** | 304,58 | `flex`, 343 × 180,55 |

⇒ **F14 no hereda los 18,33 px de deuda de F11**: esa deuda es de la pantalla donde
vive la lista de partes, y la de Diagnóstico está prácticamente vacía.

⚠️ **TRAMPA PARA EL GUION 21, hermana de la que costó una corrida entera al guion 20:**
el pie `.gml-acciones` está en **`display:none` en la pantalla Diagnóstico**. Medir
ahí el CTA daría **0 × 0 y en verde**. El pie solo existe en Validación.

⭐ **La línea base de F14, medida en pantalla y no leída del código.** Con 13 partes
cargadas en la rama EDIFICIO, el rail dice:

```
entrada activo · validacion libre · edicion libre
diagnostico BLOQUEADO  «El diagnóstico contrasta parcelas; aún no sabe con un edificio.»
informe     BLOQUEADO  «El informe firma un diagnóstico, y el diagnóstico es de parcela.»
```

**Esos son los dos motivos que esta fase vuelve falsos.**

✅ Y se comprobó de paso que **el puente chip → navegación funciona**: un solo clic en
«Edificio» lleva el hash a `#/edificio/entrada` y repinta el rail. (La primera medida
sugirió lo contrario, y era estado arrastrado entre evaluaciones: `goto` con solo
cambio de hash **no recarga la página**.)

## ⛔ M6 · Las cuatro líneas de «la parcela» se habían movido ~74 líneas

La nota de F11 daba `importar.js:415` y `:402`, `dxf.js:372` y `:86`. Las reales:

| Fichero:línea | Qué dice |
|---|---|
| `parsers/importar.js:476` | AVISO · «El centroide de **la parcela** (x, y) no cae en la…» |
| `parsers/importar.js:489` | INFO · «**La parcela** cae en el huso N (srs): …» |
| `parsers/dxf.js:86` | guía · «Deja solo la polilínea de **la parcela** en la capa 0…» |
| `parsers/dxf.js:372` | INFO · «…no son geometría de **parcela**.» |

Cuarta vez que este proyecto paga citar por número de línea en vez de por contenido.

## ✅ M5 · Línea base

Paquete **1.026,29 kB** (gzip 328,01) · CSS **67,33 kB** (52.239 B nuestros) · HTML
**55,25 kB** · `test/report/__snapshots__/pdf-parcela.test.js.snap` **25.053 B**,
md5 **`6aff47acc668a2ee9fbf4c930a61f3ab`** — es la red de la extracción del maquetador.

---

# Lo medido al hacerla (2026-08-07)

Estado: **hecha y en verde**, commit `dccc6aa`. Suite **7.076 / 166**; guion 21
`ok:true` a 1280×720 y a 1440×900; **14/14 mutaciones rojas**; `validar:xsd` OK en
los seis ficheros; presupuesto anotado (+261 B).

## ⭐ Lo que ahora se puede hacer y antes no

Caminado en Chrome con el edificio real de `9398516VK3799G` traído del Catastro en
vivo (14 partes, la piscina incluida):

| | |
|---|---|
| `#/edificio/diagnostico` | El cajón de edificio, **367 × 328,78 px**. Huella medida **406,69 m² · 3 piezas**, oficial 406,69 · 3 caras, solape **100,00 %**, dentro de parcela **100,00 %** |
| Invasión | «no se ha consultado» — nunca «ninguna» |
| «Consultar el Catastro» | Dice que la huella ya vino con el edificio y **no lanza ninguna petición** |
| «Preparar informe (PDF)» | Baja `informe-construccion-CG-9398516VK3799G-….pdf`, **5–6 páginas**, titulado «Informe de contraste con la construcción catastral» |
| Con un DXF (sin nada oficial) | Huella medida 244,95 m² · 1 pieza; huella oficial **«Sin consultar»** y el registro explicando que «no es lo mismo que no haber nada» |
| Resalte por parte | 13 huellas, **3 señaladas**, `stroke-dasharray: "6 4"`, **mismo `stroke`** que las demás |

## ⛔ Tres defectos REALES que la fase destapó, corregidos en la causa

1. **El plano no se componía NUNCA en un edificio de más de un cuerpo.**
   `report/encuadre.js#encuadrar` impone el invariante EXTERIOR/HUECO sobre su
   `recintos`, y se le pasaba la envolvente APLANADA:
   `TypeError: bbox: recintos[1] debe ser HUECO; recibido tipo='EXTERIOR'`. Y era
   **mudo**: el `catch` del plano lo degradaba y el informe lo declaraba como si
   fuera cosa de la red. Es la tercera cara de M3 — aplanar piezas está BIEN para
   dibujar y MAL para todo lo demás.
2. **`componerIdDocumento` lanza con un timestamp.** El reloj inyectado devolvía
   `Date.now()` y `report/firma.js` quiere un `Date`. Lo tumbó la primera corrida.
3. **Un guardián mío acusaba en falso.** El reconocedor de «lo fabrica el panel»
   de G16 buscaba las dos cadenas por separado y casaba
   `[data-anfitrion="diagnostico"]`, que sí viene de `index.html`. Ahora exige el
   `setAttribute` con el par entero.

## ⚠️ Dos desviaciones del plan, con su motivo

- **El informe de edificio NO abre diálogo.** El de F09 exige un lindero
  (`exigirLindero` lanza con `null`), ofrece «Tipo de operación» que el ICUC no
  pide —medido en F13— y una segunda instancia pondría un segundo
  `[data-accion="componer-pdf"]` y cuatro `[data-firma]` en el documento, que los
  guiones 11 y 14 resuelven de forma global (trampa M8).
  **Coste declarado:** el pie de firma se toma del que F09 recuerda; sin ninguno
  guardado el informe sale con «No consta» en los cuatro campos **y lo dice** por
  los dos canales. Capturar la firma desde esta rama es alcance de otra fase.
- **El cajón lleva clase propia** (`gml-cajon-contraste-edificio`) en vez de
  reutilizar la del de parcela. Cuesta **+261 B** de CSS y evita poner dos nodos
  con la misma clase en un documento donde cinco guiones la resuelven con
  `document.querySelector`.

## ⛔ Y una lección de método que costó dos medidas equivocadas

**Los guiones de humo no se pueden encadenar en una sola tanda.** Medidos en
batch, el 09 salía con 1 problema y el 14 con «63 px»; medidos **uno por carga de
página**, el 09 sale limpio y el 14 da 128 px en los DOS árboles. El estado de la
página anterior contamina al siguiente, y las dos veces me llevó a atribuirle a
F14 algo que no era suyo. La atribución de esta fase está hecha con un **árbol de
F13 en paralelo** (`git worktree` + un segundo Vite en el 5199), comparando guion
a guion:

| guion | F13 (HEAD `1a97b60`) | F14 |
|---|---|---|
| `09-diagnostico` | ok:true | **ok:true** |
| `11-informe-pdf` | ok:false · 3 | ok:false · **los mismos 3** |
| `13-edificio` | ok:false · 4 | ok:false · **los mismos 4** |
| `14-shell` | ok:false · 1 (128 px) | ok:false · **1 (128 px)** |
| `19-partes-plantas` | ok:true | **ok:true** |
| `20-gml-edificio` | ok:true | **ok:true** |
| `21-contraste-edificio` | — | **ok:true** en las dos ventanas |

**F14 no introduce ni un problema nuevo.** Sí volvió falso un guardián del guion
13 —«Diagnosticar encaje» tenía que quedar apagado en esta rama «y eso NO cambia
hasta F14»—, corregido en el guion con la misma forma con la que F13 corrigió el
gemelo de «Generar GML»: no se exige que esté apagado, se exige que **si lo está,
el motivo sea de esta rama**.

## Las 14 mutaciones

Todas ROJAS. Las que más valen: aplanar las piezas para el encuadre (12), repartir
los huecos ambiguos a ojo (5), que una consulta fallida pase por
`SIN_CONSTRUCCIONES` (6), cruzar las PARTES oficiales en vez de su envolvente (7),
que «no consultado» se lea «no consta ninguna» (14), que el resalte se distinga
por COLOR (2) y que `partesSenaladas` se olvide de los avisos (8).

## Lo que queda fuera, dicho

- **El ICUC no ha visto este informe.** El GML sí (CSV `E1HTN9QN6AKZB4XY`, F13);
  el informe es papel del colegiado y no pasa por la Sede.
- **La pantalla honesta de verdad** (`SIN_CONSTRUCCIONES`) la cubre la suite con
  el fixture de colección vacía; en el navegador haría falta consultar el `wfsBU`,
  y el guion 21 no toca servicios de datos. Que la frase **tranquilice** es juicio
  humano → `CHECKLIST-HUMANO.md` §19.
- **La captura del pie de firma en la rama EDIFICIO** (ver arriba).
