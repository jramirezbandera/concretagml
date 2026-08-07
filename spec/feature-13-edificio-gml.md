# F13 · Edificio: validación y generación de GML

**Fase:** 13 · **Prioridad:** P16 (baja) · **Riesgo:** Alto (fidelidad ICUC) · **Depende de:** F12 · **Habilita:** F14.
**Ficheros:** `validation/edificio.js`, `gml/serialize-bu.js`, `app/cableado-edificio-gml.js`, fixtures `wfsBU.aspx`.

> ✅ **CERRADA el 2026-08-07 con ICUC POSITIVO** · CSV **`E1HTN9QN6AKZB4XY`** ·
> la Sede declara **322 m²** de huella y la app **322,13**. 6.899 pruebas / 161
> ficheros, guion `20-gml-edificio.js` en `ok:true` en las dos ventanas.
>
> ⛔ **Pero antes lo RECHAZÓ**, el 2026-08-06, por faltar `xmlns:xlink` en la raíz
> — con la suite en verde y validando contra su propio esquema. Corregido y con
> guardián: ver **«El rechazo del ICUC»**.
>
> **Lee «Lo medido al hacerla» y «F13 CERRADA», al final**: entre las dos corrigen
> cinco cosas de este documento —el «Tipo de operación» **no existe en el ICUC**,
> `BuildingPart` no se emite, el resalte por parte no está entregado, el criterio 5
> se cumple contra **otro servidor** del que decía, y la precisión que decidí no
> emitir **la exige el formulario**— y dejan dos hallazgos sin dueño: esa precisión
> y ⛔ **la piscina, que entra como parte PRINCIPAL**.

## Objetivo

Validar las partes y serializar el GML de construcción **INSPIRE Buildings 2D extendido** que valida en la Sede (ICUC). Segundo innegociable de fidelidad, con un **dialecto distinto al de parcela**.

## Verdad numérica externa

Descargar GML de edificio reales del WFS `wfsBU.aspx` (`GETBUILDINGBYPARCEL`, `GETBUILDINGPARTBYPARCEL`) a `test/fixtures/gml/` (ya versionados: `bu_building_…`, `bu_buildingpart_…`). Test de ida y vuelta.

## Validación de partes (§16.1)

Reglas geométricas de siempre por cada parte (F02), más las propias:

| Regla | Nivel |
|---|---|
| Parte principal sin plantas asignadas | Error bloqueante |
| Partes que se solapan entre sí de forma incoherente | Error |
| Parte fuera de la parcela | Aviso (puede ser legítimo) |

El resalte del aviso "parte fuera de la parcela" rodea **la parte que se sale**, no otra. Errores y avisos contados por separado.

> ⛔ **El resalte NO está entregado (medido 2026-08-06).** `validation/edificio.js`
> agrupa los hallazgos por parte (`porParte`) desde su primera línea y **nadie los
> pinta**. Los recuentos separados sí están. Dueño: **F14**.

## Generación del GML (§16.2)

`Building` (envolvente derivada, multirrecinto de la envolvente sobre rasante) + `BuildingPart` por parte con sus plantas. Simplificado = geometría + mínimos; completo = todos los atributos de §14.4.

> ⛔ **`BuildingPart` NO se emite (decisión del autor, 2026-08-06).** La ayuda
> oficial del ICUC dice que **solo procesa `Building` con `footPrint` u
> `OtherConstruction`**: trece partes que el validador ignora serían trece
> afirmaciones que nadie comprueba dentro de un documento firmado. Se siguen
> **leyendo** (F11). El fichero lleva `Building` + un `OtherConstruction` por parte
> «Otra».

### 🔻 OVERRIDES (dossier) — dialecto de edificio, distinto del de parcela

- **O10 — Raíz y namespaces:** `<gml:FeatureCollection>` + `gml:featureMember` (GML clásico, **no** wfs 2.0), con namespaces INSPIRE *draft*: `bu-core2d`/`bu-ext2d` en `http://inspire.jrc.ec.europa.eu/schemas/...`, `base` en `urn:x-inspire:specification:gmlas:BaseTypes:3.2`, `schemaLocation` a `BuildingExtended2D.xsd`. *(dossier S3, OBSERVADO).*
- **O2 — srsName = URN** `urn:ogc:def:crs:EPSG::25830` (distinto de la parcela, que es URI). *(S3/C3).*
- **Geometría = un solo `gml:Surface` con N `PolygonPatch`** (un patch por construcción disjunta), **no** MultiSurface.
- **`horizontalGeometryReference="footPrint"` obligatorio** para ICUC; `referenceGeometry=true`.
- `conditionOfConstruction` (codelist): `declined, demolished, functional, projected, ruin, underConstruction`. **El PDF oficial escribe mal "funtional"; usar `functional`.** *(A1).*
- **Piscinas:** `bu-ext2d:OtherConstruction` con `constructionNature=openAirPool` y geometría en **`gml:Polygon` directo** (no `Surface`/`patches`); `conditionOfConstruction` va `xsi:nil` `nilReason="other:unpopulated"`.
- **Orientación:** exterior horario, huecos antihorario (igual que parcela, O1), sin autointersecciones.
- `base:namespace` = `ES` + productor (`SDGC`/`LOCAL`) + `BU`. `gml:id` = `ES.SDGC.BU.<ref>` o con sufijo `_Edificio_1`, `_Piscina_1`.
- **Solo huella con volumen sobre rasante;** excluir voladizos/terrazas/balcones (regla de negocio antes de serializar). INSPIRE no representa divisiones horizontales: solo huella + `numberOfFloorsAboveGround`.

## Reglas de rechazo ICUC (dossier §1.3)

Geometría **cerrada**, **≥4 puntos** por recinto, 2 coordenadas por punto, sin solapes entre construcciones, ninguna a **>100 m** de la parcela, sin BICE, máx **60 GML**, identificadores únicos.

## Criterios de aceptación

1. **Ida y vuelta** contra `bu_building_…` y `bu_buildingpart_…`: equivalente en partes, plantas, huella y estructura; `toMatchFileSnapshot`.
2. Raíz `gml:FeatureCollection` + `gml:featureMember`, srsName **URN**, un `gml:Surface` con N `PolygonPatch`, `horizontalGeometryReference=footPrint`.
3. Piscina serializa como `OtherConstruction`/`openAirPool`/`gml:Polygon` con `conditionOfConstruction` nil.
4. `functional` bien escrito; orientación horaria; solo partes sobre rasante.
5. Validación de esquema contra `BuildingExtended2D.xsd` en CI. ✅ **HECHO** (`npm run validar:xsd`, seis ficheros, dos dialectos) — ⚠️ pero **no donde lo declaran los ficheros**: esa URL contesta 200 OK con 376.809 bytes de HTML. El esquema vivo es **el espejo del propio Catastro**, el que usa el ICUC. Y ⛔ **no basta**: el fichero que la Sede rechazó el 2026-08-06 **validaba contra él**. Detalle abajo.
6. Parte principal sin plantas bloquea la generación.

## Referencias

Plan §16.1–§16.2, §18 Fase 13, §23. Dossier §1.2 (esquema edificio + plantilla), §1.3 (ICUC), §1.4 (`serialize-bu.js`), §1.5 (errores), §0.4 (fixtures). XSD: `inspire.ec.europa.eu/draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd`.

---

# Lo medido al hacerla (2026-08-06)

**6.899 pruebas / 161 ficheros** en verde. Paquete **1.026,29 kB** (gzip 328,01),
**+15,57 kB** sobre la línea base de 1.010,72 y **sin una dependencia nueva**. CSS
**67,33 kB, sin mover un byte**: F13 no escribe ni una regla (asiento anotado).
Guion `20-gml-edificio.js` en **`ok:true`** a 1280×720 y 1440×900.

✅ **Y CERRADA el 2026-08-07** con el ICUC real: **POSITIVO**, CSV `E1HTN9QN6AKZB4XY`. Ver «F13 CERRADA» al final.

## ⭐ La diana de oro: la envolvente derivada ES el `Building` del Catastro

Medido **antes** de escribir una línea, y reorientó el plan entero:

| | Derivado por `edificio/envolvente.js` | `bu_building_9398516VK3799G.gml` |
|---|---|---|
| Piezas | **2** | **2** `gml:PolygonPatch` |
| Pieza 1 | 4 vértices · **5,20 m²** | 4 vértices · **5,20 m²** |
| Pieza 2 | 52 vértices · **316,93 m²** | 52 vértices · **316,93 m²** |
| Total | **322,13 m²** | **322,13 m²** |
| `Parte 10` (el sótano, la MAYOR con 245,90 m²) | excluida | excluida |
| Coincidencia de vértices | **exacta en las dos piezas** | — |

Dice tres cosas: el criterio «solo lo que tiene volumen sobre rasante» **es suyo,
no nuestro**; la geometría que hay que emitir **ya estaba calculada** desde F12; y
el round-trip tiene **verdad externa** en vez de compararse con un snapshot propio.

## ⛔ Lo que refuta a esta ficha, y hay que corregir en ella

### 1 · El XSD existe, pero NO donde lo declaran los ficheros

`inspire.ec.europa.eu/draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd` —la URL
que declara el `xsi:schemaLocation` de **todo** fichero BU del Catastro, incluidos
los dos fixtures reales de este repo— contesta **`200 OK` con 376.809 bytes de
`text/html`**: la página «*Inspire Registry - Page not found*». Todo
`/draft-schemas/` contesta igual, y en `/schemas/` no existe `bu-ext2d` en ninguna
versión (404).

⛔ **Y de eso concluí que no había oráculo externo para este dialecto. ERA
FALSO.** El esquema lo sirve **el propio Catastro**: es la copia que la ayuda del
ICUC llama «*un esquema ligeramente modificado que se mantiene en local*»
—modificado para admitir `openAirPool`, que el draft público no tiene— y está
enlazada desde la propia página de ayuda. 76.443 bytes de `text/xml`, con todo el
árbol de imports en el mismo espejo:

```
https://www.catastro.hacienda.gob.es/ws/esquemas/GML/inspire.ec.europa.eu/draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd
```

Es **mejor** oráculo que el de la Comisión aunque estuviera vivo: es contra el que
valida el ICUC de verdad. `npm run validar:xsd` lo usa desde el 2026-08-06 y
valida los **dos** dialectos — seis ficheros, todos OK.

⚠️ **Y de rebote destapó un fallo vivo:** `scripts/validar-xsd.py` cacheaba por URL
**sin mirar los bytes**, así que habría guardado esos 376 kB de HTML como `.xsd` y
después habría informado de que **el fichero** no valida — acusando al GML de un
defecto del servidor del esquema. Corregido, con la guarda verificada contra las
dos cargas reales.

### 2 · El «Tipo de operación» (O20) NO es de esta fase

Esta ficha —y la fila P16 de `SPEC.md`— se lo atribuían. **Lo entregó F17**
(`derivacion/operacion.js`, T12), y sus dos opciones —Segregación y Subsanación—
son del formulario del **IVG**, que es el de **parcela**. El de edificio es el
**ICUC**, otro servicio, y **su formulario no se ha medido nunca**. Inventarle un
desplegable sería afirmar algo del servicio que no sabemos (regla de oro 9). Queda
como **lo primero que hay que mirar en la subida real** → `CHECKLIST-HUMANO.md`
§18.2.

### 3 · `BuildingPart` NO se emite (decisión del autor, 2026-08-06)

§16.2 mandaba emitir «`Building` + `BuildingPart` por parte con sus plantas». La
ayuda oficial del ICUC dice que **solo procesa `Building` con `footPrint` u
`OtherConstruction`**, así que trece `BuildingPart` serían trece afirmaciones que
nadie comprueba dentro de un documento que se firma. El fichero de entrega lleva
`Building` + un `OtherConstruction` por cada parte «Otra». **Se siguen leyendo**:
el lector de F11 no se toca.

### 4 · Y una cuarta que descubrió el guion: el resalte por parte NO EXISTE

§16.1 dice «*el resalte del aviso "parte fuera de la parcela" rodea la parte que se
sale, no otra*». La fase 1 construyó `porParte` justamente para eso —el plan lo
escribió así: «`porParte` es lo que consume el mapa»—. **Medido: `porParte` no
tiene ni un llamante fuera de su propio módulo y sus pruebas.** No está entregado.
Es la tercera vez que aparece la misma lección (F11, F12) y **el dueño es F14**,
que trae el diagnóstico a esta rama y necesita el mismo canal.

## Los seis criterios de aceptación, uno a uno

| | Dónde se comprueba |
|---|---|
| **1** · ida y vuelta + `toMatchFileSnapshot` | ✅ `test/gml/serialize-bu.test.js`, y **contra el `Building` del Catastro**, no solo contra un snapshot propio. Más `__snapshots__/edificio-entrega.gml`, el fichero que la app produce, byte a byte |
| **2** · raíz, srsName URN, `Surface` con N `PolygonPatch`, `footPrint` | ✅ suite (6 pruebas de dialecto) + guion 20, que lo comprueba sobre los **bytes que baja el navegador** |
| **3** · piscina como `OtherConstruction`/`openAirPool`/`gml:Polygon` con nil | ✅ suite (5 pruebas), con la piscina **real** de la parcela |
| **4** · `functional` bien escrito; orientación; solo sobre rasante | ✅ suite; la orientación la impone `prepararRecintos` (mismo O1 que parcela) y las detecciones se cuentan |
| **5** · validación contra `BuildingExtended2D.xsd` en CI | ✅ `npm run validar:xsd`, los DOS dialectos y seis ficheros — contra el **espejo del Catastro**, que es el que usa el ICUC. ⚠️ Y **no basta**: el fichero que la Sede rechazó validaba contra él |
| **6** · parte principal sin plantas bloquea la generación | ✅ `validation/edificio.js` + guion 20, que lo mide **en el renglón que el usuario lee** |

## Lo que el round-trip NO promete (medido antes de escribirlo)

De cada parte del fichero se pierden **siete** claves que el modelo no tiene dónde
poner: `gmlId`, `localId`, `refcat`, `nils`, `heightBelowGround` (**la traen las
trece**, nueve con valor ≠ 0), `heightBelowGroundUom` y `conditionOfConstruction`.
Del `Building`: `dateOfConstruction` (**`beginning` y `end`**) y el `officialArea`
con su `uom`.

⚠️ **No es un defecto que se pierdan**: el modelo es lo que el TÉCNICO declara
(regla de oro 4), y el `gml:id` del Catastro o la altura bajo rasante de cada parte
son hechos del fichero de ORIGEN — copiarlos a un alta nuestra sería firmar con la
matrícula de otro. Lo que sí sería un defecto es perderlos **en silencio**, y por
eso están escritos como pruebas.

## Decisiones propias, y por qué

- **`horizontalGeometryEstimatedAccuracy` sale NULA.** El fichero del Catastro pone
  `0.1 m`; copiarlo sería afirmar una precisión de levantamiento que nadie ha
  medido (regla de oro 9).
- **`base:localId` va DESNUDO**, sin sanear. ⛔ Defecto real cazado al mirar la
  salida: salía `_9398516VK3799G` porque lo pasaba por el saneador de `xs:ID`, y
  **no es un `xs:ID`** — es la identidad del edificio, y el fichero real la trae
  desnuda. Sanearla le cambia la identidad al objeto declarado, en silencio para
  quien no compare carácter a carácter. Tiene guardián de regresión.
- **No hay eje `perfil`** como en parcela, y no es un olvido: el `wfsBU` responde
  ya con `gml:FeatureCollection`, así que la raíz es la misma en las dos
  direcciones. Lo que cambia es qué atributos van dentro, y ese eje ya existe y se
  llama `MODELO_EDIFICIO` (SIMPLIFICADO / COMPLETO).
- **`numberOfFloorsAboveGround` emite el MÁXIMO** de las partes sobre rasante. El
  fixture del WFS lo trae `xsi:nil` y las trece partes dan 7: son dos ficheros
  oficiales porque son dos modelos distintos.
- **Un solape produce UN hallazgo** que se ve desde **las dos** partes. Uno por
  parte inflaría el recuento; uno solo dejaría muda a la segunda.
- **Lo que no se ha podido comprobar se dice.** Sin parcela con la que comparar,
  «dentro de la parcela» y «a más de 100 m» **no se pueden evaluar**, y el panel lo
  dice en vez de pasar en verde (`noComprobado`). ⚠️ En la aplicación viva **sí hay
  parcela** (la de demostración), así que el caso normal es que la comprobación se
  haga; el aviso es para cuando de verdad no hay con qué comparar.
- **Cuatro de las seis reglas de rechazo del ICUC ya estaban cubiertas** por F02 o
  por el modelo, y se dice cuáles en vez de escribir guardianes que no pueden
  disparar.

## Lo que se cazó al escribirla

- ⛔ **`descargarGml` compone el nombre por su cuenta**, así que el `nombre` que el
  cableado calculaba se perdía **en silencio** y el fichero del ICUC habría bajado
  como `parcela_…`. Se baja un escalón a `descargarTexto`. Medido en el navegador:
  hoy baja `edificio_9398516VK3799G_….gml` (3.672 B con el `xlink` de abajo; 3.629 antes).
- ⭐ **El botón tiene DOS dueños vivos.** La condición se escribe **una sola vez**
  en `app/main.js` (`mando()`) y los dos cableados se repintan en cada conmutación:
  repintar solo al que entra dejaría el botón como lo dejó la rama abandonada.
  Verificado en un navegador real con el edificio roto a propósito.
- ⚠️ **Un botón `disabled` no emite `click`**, así que con errores el usuario nunca
  llega al panel de avisos por esa vía. Lo único que lee es el renglón — y por eso
  el renglón lleva el recuento delante y dos motivos.
- ⚠️ **Dos mensajes honrados retirados** de `app/rama.js` con guardián de que no
  vuelven (suite y guion 20), más dos cabeceras caducadas reescritas. F13
  **deshace** el problema de los +134,75 px de dos motivos en el pie en vez de
  administrarlo: con un solo CTA apagado, su motivo cabe entero.
- ⚠️ **La primera corrida del guion 20 no midió nada**: medía el CTA en la pantalla
  de **Entrada**, donde `.gml-acciones` va en `display: none`. Todas las cajas
  salían a cero y en verde. El pie **solo existe en Validación**.
- ⚠️ **Y con la rama EDIFICIO vacía no se puede llegar a Validación** (todos los
  peldaños posteriores a Entrada están apagados), así que `MOTIVO_SIN_EDIFICIO`
  está escrito, probado y **no hay forma de leerlo**. La puerta la cierra el eje
  PASO del rework, no F13; queda anotado con dueño en `GUION.md` §30.

## La verificación, y a quién pertenece cada rojo

- **Mutaciones**: fase 1 **9/9** rojas, fase 2 **11 mutaciones, 10 rojas y 1 verde
  PREDICHA por escrito** (la guarda de `xs:ID` es hoy inalcanzable por
  construcción; se dejó, con la propiedad que la hace innecesaria escrita como
  test, y quitar la numeración por índice **sí** pone rojo). Fase 3: cubierta por
  las 25 pruebas de `test/app/edificio-gml.dom.test.js`.
- **Guion 20**: `ok:true` en las dos ventanas, consola limpia, **0 peticiones a
  servicios de datos**.
- **Regresión**: `19-partes-plantas.js` **`ok:true`**. `14-shell.js` sale
  `ok:false` con **1** problema, que es de **F19** (la tercera vía de Entrada
  detrás del scroll). `13-edificio.js` sale `ok:false` con **5**, que son **los
  mismos cinco documentados en `GUION.md` §28** y ninguno de F13 — ⚠️ pero su
  primera corrida dio **ocho**, y los tres de más eran **guardianes que F13 volvió
  falsos**: se corrigieron aquí, que es donde está la causa (mismo criterio que
  aplicó F12 con otros dos). Detalle en §30.

## ✅ Lo que faltaba para cerrar: el ICUC real (hecho el 2026-08-07)

Decisión del autor (2026-08-06): **F13 no se cierra hasta que se suba un fichero
con certificado y el resultado quede anotado**, con la fecha, el fichero y lo que
contestó la Sede — como se escribió el de F04 y no como «pendiente».

⛔ **Y se subió el mismo día: la Sede lo RECHAZÓ.** El precedente se cumplió
exactamente —el 2026-07-27 la suite daba verde con 1.784 pruebas y el IVG rechazó
el GML de parcela—. El defecto está encontrado y corregido; el relato entero, con
las cuatro rondas de bisección, está en **«El rechazo del ICUC»**.

✅ **Y al día siguiente contestó que SÍ**: informe **POSITIVO**, CSV
`E1HTN9QN6AKZB4XY`, con la superficie de huella que declara el Catastro
coincidiendo con la nuestra. Ver **«F13 CERRADA»**, al final.

## Lo que NO entra, con dueño

- **El «Tipo de operación» del ICUC** → fuera, y se dice por qué (arriba, punto 2).
- **`BuildingPart` en el fichero de entrega** → fuera, por decisión del autor.
- **El resalte por parte en el mapa** → **F14** (arriba, punto 4).
- **«Diagnosticar encaje» en la rama Edificio** → F14. Aquí solo se le ha escrito
  su motivo propio, que antes compartía con «Generar GML».
- **`GEOMETRIA_DESCARTADA` propio en el léxico** → seguía asignado a F13 desde F12
  y **no ha hecho falta**: la capa de validación nombra lo que descarta con los
  hallazgos que ya existen. Se difiere sin dueño nuevo; que vuelva a aparecer
  cuando algo lo necesite de verdad.

---

# ⛔ El rechazo del ICUC (2026-08-06) — el defecto, y cómo se acotó

**La Sede rechazó el fichero.** Es el segundo innegociable de fidelidad
cumpliendo su pronóstico: F04 lo vivió con el IVG el 2026-07-27 y F13 lo ha
vivido con el ICUC el mismo día en que se dio por hecha.

> «*Los siguientes ficheros no se han cargado al no ser válidos: -
> edificio_9398516VK3799G_2026-08-06T21-19-34.gml*»

Sin más detalle. Según la ayuda oficial, ese punto del flujo es la **«validación
sintáctica del fichero gml frente al esquema `BuildingExtended2D.xsd`»** — y
⭐ **nuestro fichero validaba contra ese esquema**. Comprobado con libxml2 contra
el espejo del Catastro, junto con los dos ficheros reales.

## La causa: falta `xmlns:xlink` en la raíz

```xml
xmlns:xlink="http://www.w3.org/1999/xlink"
```

**Ningún elemento del documento lo usa.** El XSD no lo exige. La ayuda oficial no
lo menciona. Y sin él, el ICUC rechaza el fichero — **incluido el suyo propio**.

## Cómo se acotó: cuatro rondas de subida, bisecando

El servicio **nombra los ficheros que fallan**, y admite hasta 60 por envío. Eso
convierte cada subida en un experimento con varias variables a la vez.

| Ronda | Qué se subió | Qué descartó |
|---|---|---|
| **1** | el fichero del Catastro tal cual · el nuestro con nombre corto · el nuestro sin ningún `xsi:nil` · el nuestro en ISO-8859-1 | **el nombre del fichero, los nulos y la codificación**. Y el suyo cargaba: el flujo y la parcela estaban bien |
| **2** | el suyo **sin** `boundedBy` · **sin** los semánticos de `bu-ext2d` · **sin** `dateOfConstruction`/`externalReference`/`addresses`/`cadastralParcels` · con `ES.LOCAL.BU` · el nuestro **con** `boundedBy` | **los cuatro primeros cargan**: ninguno de esos elementos es obligatorio. Y el nuestro seguía cayendo con `boundedBy` |
| **3** | el suyo **recortado a nuestro contenido** · ese mismo con nuestros nulos · ese mismo con **solo nuestros 5 `xmlns`** · **el nuestro con sus 21 `xmlns`** · ese mismo con las plantas con valor | ⭐ **el suyo con nuestros `xmlns` CAE y el nuestro con los suyos ENTRA.** La causa está en las declaraciones de namespace |
| **4** | el nuestro con 8 de los 16 que faltan · con los otros 8 · **con solo `xlink`** · con los 5 de ISO 19139 | ⭐⭐ **`xlink` y nada más basta.** Los dos lotes sin `xlink` caen; los dos con él entran |

Las seis medidas cuadran sin una sola excepción:

| Fichero | ¿declara `xlink`? | ICUC |
|---|---|---|
| el del Catastro, tal cual | sí | ✅ |
| el del Catastro con solo nuestros 5 prefijos | **no** | ⛔ |
| el nuestro + 8 prefijos (sin `xlink`) | **no** | ⛔ |
| el nuestro + los 5 de ISO 19139 | **no** | ⛔ |
| el nuestro + otros 8 (con `xlink`) | sí | ✅ |
| ⭐ **el nuestro + `xlink` y nada más** | sí | ✅ |

## ⛔ Y F04 ya lo sabía. Estaba escrito, en este repo, desde julio

`gml/_comun.js`, sobre la parcela:

> «*`gmd`, `ogc` y `xlink` van declarados aunque ningún elemento los use: se
> emiten igual, por fidelidad a los ficheros reales (regla de oro 8 — el GML real
> manda, también en lo que a nosotros nos parezca superfluo).*»

Al escribir `serialize-bu.js` declaré **solo los prefijos que mis elementos
usan**. Lo limpié. Ahí nació el defecto, y la frase que lo impedía llevaba tres
semanas escrita cinco ficheros más allá. **La regla de oro 8 vale también para lo
que a uno le parece superfluo, y sobre todo para eso.**

## Lo que esto enseña sobre los guardianes

⚠️ **`npm run validar:xsd` daba VERDE a un fichero que la Sede rechaza.** No es un
fallo del script: es la asimetría de F04 escrita otra vez y ahora medida en los
dos sentidos —

> **que el esquema diga OK no garantiza que la Sede lo acepte; que falle sí
> garantiza que hay un problema.**

El guardián que sí lo habría cazado es el que compara con **el fichero real del
Catastro**, y hasta hoy solo comparaba la geometría. Ahora también la raíz:
`test/gml/serialize-bu.test.js` exige `xmlns:xlink`, comprueba que **nadie lo
usa** (si algún día un elemento emitiera un `xlink:href`, la prueba dejaría de
proteger lo que dice proteger y lo avisa) y lo contrasta con el fixture. El guion
20 lo mide sobre los bytes que baja el navegador. Verificado por mutación: quitar
el prefijo pone **2 pruebas en rojo**.

## Lo que sigue abierto

⏳ **F13 sigue sin cerrar**: el fichero corregido **carga** en el ICUC —medido: es
el que se subió como `N-nuestro-xmlns-completos.gml`— pero **el informe no se ha
emitido todavía**. Falta llegar al paso 5 y anotar el resultado con su **CSV**.
Y con él, lo que pide `CHECKLIST-HUMANO.md` §18.2: **si el formulario del ICUC
exige un «Tipo de operación»**, y con qué opciones.

---

# ✅ F13 CERRADA — el ICUC contestó (2026-08-07)

| | |
|---|---|
| **Resultado** | ⭐ **POSITIVO** |
| **CSV** | `E1HTN9QN6AKZB4XY` |
| **Fecha de firma** | 07/08/2026 |
| **Parcela** | `9398516VK3799G` — CL SAN RESTITUTO 72 (C), Madrid |
| **Fichero subido** | `edificio_9398516VK3799G_2026-08-07T08-14-11.gml`, 3.672 B, generado por la app |
| **Veredicto literal** | «*Las coordenadas de referenciación geográfica de la porción de suelo ocupada por la edificación o instalación, se encuentran efectivamente ubicadas en su integridad dentro de la parcela catastral consignada, no extralimitándola.*» |

## ⭐ La verificación externa que no se podía obtener de ninguna otra forma

| | La app dice | El informe del Catastro dice |
|---|---|---|
| Superficie ocupada por las construcciones | **322,13 m²** | **322 m²** |

La Sede redondea a entero; la coincidencia es exacta. Es la **cuarta** confirmación
independiente de la misma geometría —la diana de oro contra su `Building`, la
envolvente calculada para el `boundedBy`, el round-trip y ahora el informe
firmado— y la única que viene de fuera del proyecto.

Y es el segundo envío de esta aplicación con verdad externa: el primero fue el
**IVG positivo** de parcela del 2026-08-03 (`XMWPXCN9J8DB9J89`). Uno por dialecto.

## ✅ §18.2 contestado: el ICUC NO tiene «Tipo de operación»

La decisión 4 del plan era no inventarle un desplegable al ICUC porque **su
formulario no se había medido nunca**. Medido ya: **no existe tal campo**. El de
Segregación / Subsanación es del **IVG**, que es el de parcela, y F17 hizo bien en
dejarlo ahí. O20 queda cerrado: **no se propaga a edificio**.

## ⚠️ Pero el paso 1 SÍ es un formulario, y la app no sabe nada de él

El ICUC pide, **antes** del GML y con certificado, datos que este proyecto no
produce ni guarda:

**Datos del técnico** — NIF y nombre (los saca del certificado), **email** y
**teléfono** obligatorios, **identificación profesional** (titulación, de una
lista cerrada) y **fecha de toma de datos del trabajo profesional**.

**Especificaciones del trabajo profesional** — ⭐ **precisión del trabajo** en
metros (obligatoria, entre 0,000 y 9,999), **metodología de captura** (lista:
GNSS…) y **¿existe desplazamiento de la cartografía?** con sus seis parámetros
(`AX BX CX AY BY CY`) si se declara.

Todo eso se teclea a mano y **viaja en el XML adjunto al informe**, no en el GML.
Nada de esto es un defecto de F13 —el GML no es el sitio de esos datos—, pero
conviene tenerlo escrito: **el ICUC no es «subir un fichero»**, es un trámite con
un formulario delante, y la app hoy solo cubre la mitad del recorrido.

## ⛔ Y el formulario REFUTA una decisión mía de la fase 2

`horizontalGeometryEstimatedAccuracy` sale **`xsi:nil`** en nuestro GML, y lo
justifiqué así: «*no se afirma una precisión que no se ha medido*». El fichero del
Catastro pone `0.1 m` y yo no quise copiarlo.

**El razonamiento era correcto y la conclusión, incompleta.** La Sede **exige** esa
precisión como campo obligatorio del formulario, así que **el técnico sí la tiene**
—en esta subida declaró **0,010 m con metodología GNSS**— y el informe la imprime.
Nuestro GML tira un dato que su autor está obligado a declarar tres pantallas
antes.

`serializarEdificioBu` **ya acepta `precisionMetros`** y lo emite con su `uom="m"`
cuando se lo dan: lo que falta es que la app lo pida y lo pase (hoy
`app/cableado-edificio-gml.js` no lo pasa nunca). Junto con la metodología de
captura, es un alcance pequeño y bien delimitado. **Queda anotado, sin dueño
asignado**: es decisión del autor si merece fase propia.

## ⛔ La piscina: no es que se quedara fuera, es que entra MAL

En esta subida no había piscina, y es correcto: el fixture que se cargó
(`bu_buildingpart_…`) trae **13 partes y ninguna `OtherConstruction`**. En el plano
del informe la piscina se ve en rojo —cartografía catastral— y no en verde, porque
no se declaró. Hasta ahí, todo bien.

⛔ **Pero con el fichero del Catastro que SÍ la trae
(`wfsbu-allconstruction-9398516VK3799G.xml`), la piscina entra en el modelo como
parte `PRINCIPAL`.** Medido el 2026-08-07: `parse-bu.js` la lee bien
(`openAirPool`, `9398516VK3799G_PI.1`), y `edificio/entrada.js` la convierte en un
cuerpo de edificio con este aviso:

> «*Una construcción del documento no es un cuerpo de edificio («openAirPool») y
> entra como parte PRINCIPAL. Esta versión solo maneja ese tipo; el que le
> corresponde («otra construcción», sin plantas) **se asigna en la fase
> siguiente**.*»

**Esa «fase siguiente» era F12** —la que estrenó `TIPO_PARTE.OTRA`— y pasó sin
tocar esta línea. **Es el mismo defecto que F12 encontró en este mismo fichero con
las plantas**, en el mismo párrafo de alcance diferido, por segunda vez.

**Consecuencia para el ICUC, que es lo que lo hace grave:** una piscina leída de un
GML del Catastro se emitiría **dentro de la huella del `Building`** en vez de como
`OtherConstruction`, inflando la superficie declarada y clasificando mal una
construcción en un documento firmado. La mitad `otras` del serializador —probada,
con su `openAirPool` y su `gml:Polygon` directo— **solo tiene llamante vivo si el
usuario añade la parte y le dibuja el recinto a mano** (F12).

No entra en F13 y no se ha tocado. Queda medido, con su consecuencia escrita y sin
dueño asignado.
