# F21 · Edificio: la piscina en su tipo y la precisión declarable

**Fase:** 21 · **Prioridad:** P17b (Bloque C; ver §Dónde encaja) · **Riesgo:** Bajo
(el arreglo tiene **diana de oro externa**, M3) · **Depende de:** F11
(`edificio/entrada.js`, las tres fábricas), F12 (`TIPO_PARTE.OTRA` y el `<select>`
de tipo del panel), F13 (`gml/serialize-bu.js#precisionMetros`, ya escrito y
probado), F14 (`app/cableado-contraste-edificio.js#huellaDelModelo`) ·
**Habilita:** que la vía en vivo del Catastro produzca un GML de edificio
**correcto sin que el técnico tenga que corregirlo a mano**.

**Ficheros previstos:** tocados — `edificio/entrada.js` (el tipo de las «otras» y
el mensaje que se retira), `edificio/_comun.js` (el miembro del enumerado que se
va), `model/edificio.js` (el campo nuevo), `edificio/mutaciones.js` (su mutación),
`app/panel-edificio.js` (el `<dialog>` y su botón), `app/cableado-edificio-gml.js`
(pasar el dato), `estilos/app.css`. Nuevos —
`scripts/smoke-navegador/22-piscina-precision.js`.

> ⏳ **Ficha abierta con el plan.** Lo que aquí se afirme del futuro y resulte
> falso **no se borrará**: se conserva citado al lado de lo medido. Manda lo
> medido (regla de oro 8).

## Objetivo

**Cerrar los dos hallazgos que F13 dejó medidos y sin dueño**, y que su propia
ficha describe en §«La piscina: no es que se quedara fuera, es que entra MAL» y
§«Y el formulario REFUTA una decisión mía de la fase 2».

No es alcance nuevo del producto: es la deuda que el ICUC destapó al aceptar el
primer fichero de edificio del proyecto. Los dos hallazgos comparten sitio —el
documento que se sube a la Sede— y por eso comparten fase.

## Dónde encaja, y por qué no lleva un número de prioridad limpio

**Por el mismo motivo que F20 y con la misma honradez.** El Bloque C llega hasta
P17 (F14) y el Bloque D arranca en P18 (F15, el diccionario de errores, que
existe desde el índice original). Renumerar el Bloque D para colar una fase de
edificio movería referencias por un número: **entra como P17b y se dice**.

El número de FASE sí es limpio: F15 y F16 están ocupados desde el índice
original, y F17–F20 se gastaron en el Bloque B, así que la siguiente libre es
**F21**.

## Las cuatro decisiones (entrevista del 2026-08-07)

1. **Los dos hallazgos, en una fase.** El de la piscina es un defecto con
   consecuencia medida en un documento firmado; el de la precisión es un campo
   que el serializador ya sabe emitir y que nadie le pasa. Los dos viven en el
   mismo fichero de salida.
2. **El mensaje `TIPO_PARTE_FORZADO` se RETIRA**, no se reescribe. En cuanto la
   piscina entra con su tipo **no se está forzando nada**, y un aviso que
   describe un comportamiento que ya no existe es peor que ninguno: enseña al
   técnico a desconfiar de una decisión correcta. Se retira con **guardián de que
   no vuelve**, que es la forma que F13 estrenó con los dos mensajes de
   `app/rama.js`. El hecho sigue siendo comprobable donde importa: el `<select>`
   de tipo del panel lo enseña por parte, y el `.gml` lleva su
   `OtherConstruction`.
3. **La precisión se teclea en un `<dialog>` PROPIO** —«Especificaciones del
   trabajo profesional»—, no dentro del de Atributos. El motivo es medido: aquel
   diálogo **solo existe en modelo COMPLETO** (`app/panel-edificio.js`, F11), y
   la precisión del levantamiento **no es un atributo del edificio**: es del
   trabajo del técnico, y el ICUC la exige tanto si el modelo es completo como si
   no. Meterla allí la haría indeclarable justo en el recorrido más corto.
4. **Solo la precisión, no el formulario entero.** Es lo ÚNICO que cabe en el
   GML (M7). El email, la titulación, la fecha de toma de datos, la metodología
   de captura y el desplazamiento de cartografía se teclean en la Sede, y
   prometerlos aquí sería aparentar que la app cubre un trámite que no cubre.

---

# Fase 0 · lo medido antes de escribir una línea (2026-08-07)

Ocho medidas. **Dos corrigen el enunciado del propio hallazgo** que F13 dejó
escrito, y las dos mandan sobre él.

## ⛔ M1 · La vía en vivo entra con **14 partes y las 14 `PRINCIPAL`**

Reproducida la fusión de las DOS consultas tal como la hace
`services/catastro-edificio.js:808-809` (`flatMap` de `partes` y de `otras` sobre
los dos documentos reales del repo), y pasada por `entradaDesdeWfsBu`:

```
partes: 14 · tipos: {"PRINCIPAL":14}
  10 Parte 10  sobre=0 bajo=1  area=245.90   ← el sótano
  14 Parte 14  sobre=null bajo=null area=84.56  ← la piscina
```

Es la misma configuración que caminó el guion 21 de F14 («14 partes, la piscina
incluida»).

## ⛔⛔ M2 · **NINGUNA de las tres salidas que hoy tiene el técnico es correcta**

Y esto **corrige el enunciado de F13**, que decía que la piscina «se emitiría
dentro de la huella del `Building`». Es peor: hoy **ni siquiera se puede generar**
sin teclear antes un dato falso.

| lo que hace el técnico | ¿genera? | `Building` | `OtherConstruction` |
|---|---|---|---|
| nada, tal como entra | **NO** · 1 ERROR | — | — |
| le teclea **1 planta** sobre rasante | sí | **406,69 m²** · 3 piezas | **0** |
| le teclea **0 plantas** sobre rasante | sí | 322,13 m² · 2 piezas | **0** |
| **F21** · entra con tipo `OTRA` | sí | **322,13 m²** · 2 piezas | **1** |

El ERROR es de `validation/edificio.js:328` y es correcto en su marco: *«Parte 14
no tiene declaradas las plantas sobre rasante»*. Solo que **a una piscina no se
le pueden declarar**: el modelo las fuerza a `null` en las partes `OTRA`
(`model/edificio.js:167`) precisamente porque no las tiene.

Así que el defecto **obliga a mentir para desbloquear el botón**, y las dos
mentiras disponibles producen dos documentos falsos distintos:

- **«1 planta»** infla la huella declarada en **84,56 m²** —la piscina entera— y
  además **no la emite** como `OtherConstruction`: la construcción queda
  clasificada como cuerpo de edificio.
- **«0 plantas»** da la cifra buena por el motivo equivocado (`envolvente.js:147`
  la excluye como `SOLO_BAJO_RASANTE`, o sea **declarándola sótano**) y la piscina
  **desaparece del documento**: ni en la huella ni como `OtherConstruction`.

## ⭐ M3 · El arreglo tiene **diana de oro externa**, y es la del ICUC

**322,13 m² es exactamente la cifra que la Sede aceptó** el 2026-08-07 en el
informe ICUC positivo `E1HTN9QN6AKZB4XY`, donde el Catastro declara **322 m²** de
huella (F13). No es un número que elija esta fase: es el que ya tiene verdad
externa, y el que F13 midió vértice a vértice contra el `Building` publicado.

## ⚠️ M4 · Por qué la subida de F13 pasó igualmente

Porque se hizo por la vía de **FICHERO**, con
`test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml`: **13 partes y ninguna
`OtherConstruction`**. El defecto vive en la vía del **servicio** y en la del
fichero que sí trae la piscina. La fase no descubre un fallo del envío firmado;
descubre que **el mismo edificio por otra puerta habría salido mal**.

## ⛔ M5 · El caso peor no es el de 84,56 m² de más

Con el documento `GetAllConstructionByParcel` **suelto** —sin la consulta de
partes—, `entradaDesdeGmlBu` construye un edificio de **UNA sola parte**, que es
la piscina, y la envolvente que se emitiría como `Building` **ES la piscina**:
84,56 m² presentados como la huella del edificio. Es un fichero real del repo
(`wfsbu-allconstruction-9398516VK3799G.xml`) y una vía viva de la aplicación.

## ✅ M6 · El arreglo **no descuadra el contraste de F14**, y estaba en duda

`app/cableado-contraste-edificio.js#huellaDelModelo` (líneas 191-196) deriva la
huella oficial con el **mismo** `envolventeDe` sobre `edificio.construccionOficial`,
que en `edificio/entrada.js:1066` son **las mismas partes**. Marcar la piscina
`OTRA` baja las DOS caras a 322,13 m² · 2 piezas, así que el solape sigue en
100,00 % y no aparece ninguna diferencia inventada.

⚠️ Y de camino queda medido algo que conviene tener escrito: cuando el edificio
viene del Catastro, el contraste compara **nuestra envolvente contra una
envolvente derivada de las mismas partes**, así que el 100,00 % de F14 es
tautológico hasta que el técnico edita. No es defecto de esta fase y no se toca.

## ✅ M7 · El GML tiene **un solo hueco** para el formulario del ICUC

`ORDEN_BUILDING_GEOMETRY` (`gml/serialize-bu.js:282-287`) admite `geometry`,
`horizontalGeometryEstimatedAccuracy`, `horizontalGeometryReference` y
`referenceGeometry`. **La metodología de captura y el desplazamiento de
cartografía no tienen elemento**: viven en el formulario de la Sede y en el XML
que ella adjunta al informe, no en nuestro fichero. La decisión 4 sale de aquí.

## ✅ M8 · Marcar la piscina `OTRA` no mueve nada más

- **Las plantas ya entran a `null`** (`sobre=null bajo=null`, M1), así que
  `crearParteConstruccion` no cambia de comportamiento: el forzado a `null` de las
  partes `OTRA` es idempotente sobre este dato.
- **`plantasDelEdificio`** (`app/cableado-edificio-gml.js:157`) ya filtra por
  `PRINCIPAL`: el `numberOfFloorsAboveGround` del `Building` no se mueve.
- **El panel ya sabe enseñarlo**: el `<select>` de tipo existe desde F12
  (`ACCION.CAMBIAR_TIPO_PARTE`) y en una parte `OTRA` los contadores de plantas
  **no están ocultos: no están**.
- **`otrasDe`** (`app/cableado-edificio-gml.js:166`) ya recoge las `OTRA` con
  contorno: la mitad `otras` del serializador **estrena llamante por la vía de
  entrada**, que es lo que F13 dejó dicho que le faltaba.

---

## Criterios de aceptación

1. Un GML del Catastro que traiga una `OtherConstruction` entra con esa parte de
   tipo **`OTRA`**, por las dos vías (fichero y servicio), **sin que el técnico
   toque nada**.
2. Con el edificio real de `9398516VK3799G` por la vía en vivo, el `Building`
   emitido declara **322,13 m² en 2 piezas** y el fichero lleva **una
   `OtherConstruction`** con su `openAirPool`. Comparado contra la diana de M3.
3. `puedeGenerar` es **`true`** con ese edificio recién cargado: no hace falta
   declarar plantas de una piscina para desbloquear el botón.
4. El mensaje `TIPO_PARTE_FORZADO` **no existe**, ni su miembro del enumerado, y
   hay un guardián que se pone rojo si vuelve.
5. La precisión del trabajo se puede declarar **en los dos modelos**
   (SIMPLIFICADO y COMPLETO) y sale en el GML como
   `horizontalGeometryEstimatedAccuracy uom="m"`; **sin declararla sigue saliendo
   `xsi:nil`**, que es lo que hoy hace y es verdad.
6. El campo **rechaza lo que la Sede rechaza**: fuera de `0,000–9,999` no entra, y
   se dice por qué en vez de recortar en silencio.
7. `npm test` en verde, `npm run validar:xsd` OK en los seis ficheros, y el guion
   `22-piscina-precision.js` en `ok:true` en las dos ventanas.

## Plan · 3 fases, 7 tareas

### Fase 1 · La piscina entra en su tipo

- **T1.1** · `partesDeFeature` recibe el tipo y las partes de `otrasBu` nacen
  `TIPO_PARTE.OTRA`. Es el cambio de una línea que F11 difirió y F12 no recogió.
- **T1.2** · Retirar el aviso `TIPO_PARTE_FORZADO` y su miembro de
  `edificio/_comun.js#TIPO_EDIFICIO`, con guardián de que ninguno vuelve.
- **T1.3** · Las pruebas que **afirmaban el defecto** se dan la vuelta: dicen
  ahora lo que tiene que pasar, y traen su mitad anti-vacuidad (el oráculo del
  XML crudo, que ya existe).

### Fase 2 · La precisión declarable

- **T2.1** · `model/edificio.js`: campo `precisionMetros`, validado
  (`null` o número finito en `[0, 9.999]`), con su mutación en
  `edificio/mutaciones.js`.
- **T2.2** · El `<dialog>` «Especificaciones del trabajo profesional» en
  `app/panel-edificio.js`, disponible en los DOS modelos, con su renglón
  `role="status"` y su CSS anotado en el presupuesto.
- **T2.3** · `app/cableado-edificio-gml.js` pasa `precisionMetros` al
  serializador.

### Fase 3 · Verificación

- **T3.1** · Guion de humo `22-piscina-precision.js`, mutaciones sobre las dos
  fases, `validar:xsd`, pasada de regresión y cierre de la ficha con lo medido.

---

# Lo medido al hacerla (2026-08-07)

Estado: **fases 1 y 2 hechas y en verde. ⏳ La fase 3 NO está hecha y la ficha no
se cierra.** Suite **7.092 / 166**; `npm run validar:xsd` OK en los seis ficheros;
presupuesto anotado (+70 B); paquete **1.075,38 kB**.

## ✅ Los criterios, uno a uno

| # | Cómo se comprueba |
|---|---|
| 1 | `test/edificio/entrada.test.js` (vía GML) y `test/edificio/aceptacion-f11.test.js` (vía WFS), los dos con su mitad anti-vacuidad: el tipo sale de la LISTA del documento, no del `constructionNature` |
| 2 | `test/edificio/entrada.test.js` — **322,13 m² en 2 piezas**, contra la diana externa de M3, y la piscina con sus **84,56 m²** intacta como `OTRA` |
| 3 | La misma prueba mide `puedeGenerar === true`, y demuestra que la regla que bloqueaba **sigue viva** cambiando el tipo a mano |
| 4 | `test/edificio/comun.test.js` — el miembro no existe y el léxico sigue lleno |
| 5 | `test/app/panel-edificio.dom.test.js` (el diálogo en SIMPLIFICADO) + `test/app/edificio-gml.dom.test.js` (que el número **llega al XML**, y que sin declarar sigue saliendo `xsi:nil`) |
| 6 | `test/app/panel-edificio.dom.test.js` — fuera de rango se rechaza **diciendo que el rango es del ICUC**, y el máximo exacto sí entra |
| 7 | ⏳ suite y `validar:xsd` ✅; **el guion 22 no está escrito** |

## ⛔⛔ M2 se quedó corta, y el enunciado bueno es el de la tabla

Lo que la fase 0 midió como «tres salidas» resultó ser, además, **una trampa
cerrada**: la primera no genera y las otras dos exigen teclear un dato falso. Eso
convierte el hallazgo de F13 —«se emitiría dentro de la huella»— en algo distinto
de lo que decía: **no es que saliera mal, es que no había forma de que saliera
bien**.

## ⛔ El defecto que la fase se encontró de camino: `reconstruir` no arrastraba el campo

`edificio/mutaciones.js#reconstruir` re-crea el edificio entero con
`crearEdificio` y enumera a mano lo que conserva. Sin añadir ahí
`precisionMetros`, el valor por defecto (`null`) habría ganado en **cualquier**
mutación —renombrar una parte, teclear la referencia, cambiar de modelo—, y la
precisión declarada habría reaparecido como `xsi:nil` en un documento firmado.

Es literalmente el mismo agujero que F12 tapó con `idLocal`, con su comentario ya
escrito tres líneas más arriba. **Lo destapó el guardián del *shape*** de
`test/model/edificio.test.js` al ponerse rojo por la clave nueva; el VALOR no lo
miraba nadie, así que ahora lo mira `test/edificio/mutaciones.test.js` sobre las
tres mutaciones.

## ⛔ Cinco guardianes en verde defendiendo el defecto

Quinta aparición de la lección F11 · M28–M30, y la más cara hasta ahora porque el
comportamiento defendido llegaba a un documento que se firma:

- `test/edificio/entrada.test.js` — «⛔ la piscina se lee, **entra como PRINCIPAL**
  y se DICE que es un tipo forzado»
- `test/edificio/entrada.test.js` — el caso completo de las dos consultas exigía
  el aviso de forzado
- `test/edificio/aceptacion-f11.test.js` — «⭐ la PISCINA real entra por el WFS…
  **y se dice que su tipo es forzado**»
- `test/edificio/comun.test.js` — el léxico exigía el miembro
- Y los cuatro del *shape* del `Edificio`, que hicieron su trabajo: se pusieron
  rojos por la clave nueva

## ⚠️ Una medida de rebote sobre F14, que no se toca

Cuando el edificio viene del Catastro, `app/cableado-contraste-edificio.js#huellaDelModelo`
deriva la huella oficial con el **mismo** `envolventeDe` sobre
`edificio.construccionOficial`, que son **las mismas partes** que las nuestras. O
sea que el **100,00 % de solape** que F14 midió es tautológico hasta que el técnico
edita algo. No es defecto de esta fase —y el arreglo de la piscina lo deja igual de
consistente, con las dos caras en 322,13—, pero conviene que esté escrito antes de
que alguien lea ese 100 % como una verificación.

## Lo que queda, dicho

- **El guion de humo `22` no está escrito.** Sin él no hay medida en navegador de
  que el botón «Trabajo» quepa en la fila del rótulo ni de que el diálogo se lea a
  1280×720. La fase **no se cierra**.
- **Ninguna de las dos mitades ha pasado por el ICUC.** El fichero que la Sede
  aceptó es el de F13, por la vía de fichero y sin piscina; que un GML **con**
  `OtherConstruction` y **con** precisión declarada cargue allí está sin medir.
- **Las mutaciones de las dos fases** (el gate de calidad que F11–F14 sí pasaron)
  están sin hacer.
