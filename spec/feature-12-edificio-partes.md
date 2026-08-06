# F12 · Edificio: partes y plantas

**Fase:** 12 · **Prioridad:** P15 (baja) · **Riesgo:** Medio · **Depende de:** F11 · **Habilita:** F13.
**Ficheros:** `edit/dibujo.js` (completar), envolvente derivada en `model/edificio.js`.

## Objetivo

El corazón del flujo de edificio: gestionar una **lista de partes** (no un solo recinto), con plantas por parte, dibujo de recinto desde cero y **edificio-envolvente derivado**.

## Alcance

### Lista de partes (§15.1)

- Añadir/eliminar/seleccionar parte. Nombre **editable** (rótulo en plano e informe).
- Tipo: **Principal** vs **Otra construcción** (piscina y similares).
- Por cada parte **principal**: **plantas sobre rasante y bajo rasante**, enteras, con ayuda *"bajo rasante = sótanos; rasante es la línea del terreno"*. Rotuladas sobre cada parte en el mapa (romano: "II", "I").
- **Partes tipo Otra (piscinas): sin contadores de plantas.** No es "0 plantas", es que no aplica (campos `null`).

### Geometría de la parte activa (§15.2)

- Edición como parcela pero sobre la parte activa (arrastrar/insertar/eliminar, offset, snap — reutiliza F06).
- **Dibujar recinto desde cero** (`edit/dibujo.js`): una parte recién añadida no tiene geometría → *"pendiente de dibujar el recinto"* + herramienta de dibujo vértice a vértice con el mismo snap. Es el caso común: declarar un porche o piscina que no estaban.
- **No se permiten huecos interiores** en una parte: la herramienta de hueco no aparece.

### Edificio-envolvente (§15.3) — derivado, no dibujado

Se muestra como **resultado derivado**: una línea que rodea todas las partes **sobre rasante**, etiquetada *"envolvente calculada"*. No lleva rótulo de plantas (es un contorno, no una planta). Se calcula como unión de contornos (`turf.union`, topológico, permitido).

### Retroalimentación (§15.4)

Superficie de la parte activa y suma de huella sobre rasante, en vivo.

## 🔻 OVERRIDE (dossier)

- **O11 — BuildingPart VERIFICADO:** el modelo "una parte = una huella con sus plantas" es correcto. `GetBuildingPartByParcel` devuelve **una `BuildingPart` por volumen de altura homogénea**, cada una con huella propia + `numberOfFloorsAboveGround`/`numberOfFloorsBelowGround` independientes (fixture real: 13 partes). Las plantas van por parte; el `Building`-envolvente solo lleva el máximo de plantas sobre rasante. *(dossier S4, VERIFICADO; fixture `bu_buildingpart_9398516VK3799G.gml`).*

## Criterios de aceptación

1. Añadir/renombrar/eliminar partes y asignar plantas por parte funciona; las piscinas no muestran contadores.
2. Dibujar un recinto desde cero, vértice a vértice con snap, crea la geometría de la parte.
3. La envolvente se recalcula automáticamente al cambiar las partes sobre rasante y **no** es editable como dato.
4. Las partes no admiten huecos interiores.

## Referencias

Plan §15, §18 Fase 12, §23.3. Dossier §1.2 (BuildingPart), §0.5/§0.6 (estructura verificada), §3.6 (dibujo/snap).

---

# ✅ HECHA · 2026-08-06 · lo que se midió, y lo que refutó a este documento

**6.771 pruebas / 157 ficheros.** Guion `19-partes-plantas.js` en **`ok:true`** a
1280×720 y a 1440×900. Paquete **994,26 kB** (gzip 318,19); CSS **67,33 kB**, de
los que **+1.506 B son de F12** —medidos aparte, construyendo la hoja con y sin
esta fase, para no cargarle los 3.519 B que F18 y F19 dejaron sin asiento—.

## ⛔ M31 · F12 entera era INALCANZABLE en producción

`app/navegacion.js` tenía el peldaño **«Edición» apagado en la rama EDIFICIO**,
con este motivo escrito:

> Esta versión edita parcelas, todavía no construcciones.

Era **verdad cuando se escribió** y **F12 es la fase que lo vuelve falso**. Pero
con el peldaño cerrado nadie llamaría nunca a `edificioCableado.edicion(true)`,
«Dibujar recinto» no aparecería jamás y **las fases 1 a 4 serían código que solo
existe en los tests** — que es exactamente lo que le pasó a F11 hasta su T4.1.

Lo destapó **una prueba**, no el producto: al hacer que el ayudante `irAPaso`
fallara **en voz alta** en vez de saltarse el paso en silencio. La suite entera
seguía verde. Corolario del mismo tirón: `MOTIVO_DATO.geometria` decía «Trae antes
una parcela» **en la rama donde `geometria` significa “hay edificio”** ⇒ nuevo
`MOTIVO_DATO_EDIFICIO`.

**La lección, y es la M28–M30 de F11 otra vez:** una frase honrada envejece, y el
día que envejece **no falla nada**. Esta fase caducó **seis** mensajes, y uno de
ellos lo tenía copiado a pelo un guion de humo.

## ⛔ M32 · Las plantas del GML nunca llegaban al modelo

`edificio/entrada.js` las ponía a `null` con su motivo escrito:

> Las plantas van a `null` por ALCANCE […] en F11 toda parte entra con las
> plantas sin asignar, **y se asignan una a una en la fase siguiente**.

**F12 es esa fase**, y llegó a la **fase 5** sin que nadie tocara esa línea. La
suite seguía verde porque **ninguna prueba pedía que el dato llegara al modelo** —
había una que exigía lo contrario, y era correcta el día que se escribió.

Lo destapó el guion 19 mirando el mapa: **cero rótulos romanos sobre trece
huellas** que sí traen sus plantas. Un síntoma exacto y mudo.

## ⭐ M33 · Con las plantas dentro, el edificio real cambia de forma

| | Medido |
|---|---|
| Envolvente **sin** plantas asignadas | **568,03 m²**, las 13 partes dentro |
| Envolvente **con las plantas reales** | **322,13 m²**, 12 partes |
| Lo que sale | `Parte 10`: **245,90 m² de 568,03**, la MAYOR, con **0 plantas sobre rasante** ⇒ es un **sótano** |
| Piezas | **DOS cuerpos**, no una línea: 5,20 m² y 316,93 m² (562,83 antes de excluir el sótano) |

⚠️ **Este documento decía «una línea que rodea todas las partes» (§15.3) y son
dos.** Quien la pinte tiene que contar con más de una pieza, y quien la mida no
puede leer `recintos[0]` y creer que ya está — un defecto que esta fase cometió y
midió: sumar las piezas juntas tomaba el exterior de la segunda por un hueco de la
primera y **restaba** (400 − 3.000 m²).

## ⛔ M34 · `[hidden]` no funcionaba en la barra de edición

`.gml-barra-herramienta` fija `display: inline-flex` con especificidad (0,2,0), y
eso **le gana al `display: none` que el navegador le da a `[hidden]`**. Medido en
Chrome: `boton.hidden === true` y `getBoundingClientRect().height === 28`.

Lo pagaba «Dibujar recinto», que **nace oculto a propósito** —en la rama PARCELA
no hay «parte» que dibujar— y se estaba viendo ahí **desde la fase 3**. Su
separador sí desaparecía (un `<span>` sin esa clase), así que el síntoma era un
botón suelto, sin separador, en una barra donde no hace nada. En jsdom no hay
cascada que resolver: la suite no podía verlo.

## ⛔ M35 · Un `max-height` no defiende de nada por abajo

T4.1 le puso a la lista de partes `max-height: 18vh` con la cuenta escrita: «129,60
px a 720 de alto, o sea 4,9 filas». **Medido: 58,48 px = 2 filas de 14 partes.**
Quien la encogía era el `flex-shrink` del bloque, que con el panel sin sitio la
aprieta **por debajo de su contenido** (la lista tiene `overflow-y: auto`, así que
no hay altura mínima automática).

Suelo de tres filas: **77 px = 3 × 25,39 medidos**. Paga el bloque de la parte
activa, cuya tabla de coordenadas ya se desplaza sola.

## ⭐ M36 · La identidad no cabía en «el autoguardado», y eso refuta al plan

La tarea T4.3 se planeó como «`ID_BORRADOR` por rama + suscribir el debounce +
retirar un mensaje». En cuanto el `Edificio` tiene `idLocal`, **el motivo con el
que F11 apagaba «Guardar» se vuelve falso**: decía «porque un edificio no tiene aún
el identificador con el que se distinguen los expedientes guardados», y mandaba a
esperar por algo que ya está.

**«Guardar» sigue apagado**, con la razón que sí sigue siendo cierta y que además
es comprobable: **la lista de guardados no distingue ramas y `recuperar()` solo
sabe abrir parcelas**, así que archivar un edificio ahí sería meterlo donde no se
puede sacar. Hay una prueba de eso.

Y con él caducaron cinco mensajes más: `MENSAJE_SIN_AUTOGUARDADO` y su `_BREVE`,
`mensajeEdificioFuera`, el aviso de `export/proyecto.js` y el acuse de abrir un
`.json` de edificio. ⚠️ **El guion 13 llevaba el literal viejo copiado a pelo**:
habría dado `ok:false` acusando al producto de un defecto que era del guion.

### Tres decisiones de diseño que salieron de chocarse con ellas

- **DOS `crearAutoguardado`, no uno que reparte.** `cambiado()` **coalesce** y se
  queda con el último: editar la parcela, conmutar y tocar el edificio dentro de
  la misma ventana de dos segundos habría tirado el cambio de la parcela **en
  silencio**, que en un autoguardado no lo nota nadie hasta el día que hace falta.
- **La oferta del arranque es una LISTA.** Con las dos ramas guardando, lo normal
  es acabar la sesión con trabajo en las dos; ofrecer una sola habría dejado la
  otra en la base sin nadie que la recuperara **ni la mencionara**.
- **`cambioEnEspera` es uno por rama.** Con una bandera única, volcar lo pendiente
  escribiría el borrador de una rama que el usuario no ha tocado, y la carga
  siguiente le ofrecería «trabajo sin terminar» de algo que **nunca empezó**.

⚠️ **`ID_BORRADOR` no cambia de valor.** Estrenar nombre habría dejado huérfano el
borrador de quien cerrara la pestaña con la versión anterior: seguiría en la base,
invisible para la lista y para la oferta, sin nadie que lo pudiera recuperar.

## Los cuatro criterios de aceptación, uno a uno

| | Dónde se comprueba |
|---|---|
| **1** · añadir/renombrar/eliminar y plantas por parte; **las piscinas no muestran contadores** | `SELECTOR_PRINCIPAL` de `app/panel-edificio.js` es la forma comprobable: en una parte «Otra» los contadores **no están** (no ocultos, no vacíos). Suite + guion 19 §6 |
| **2** · dibujar un recinto desde cero con snap | `edit/dibujo.js` (la deuda 1 de F06, once fases después) + `viewer/dibujo.js`. Guion 19 §7 lo dibuja **con clics de verdad**: 44,56 m² y 5 vértices a 1280×720 |
| **3** · la envolvente se recalcula y **no** es editable | `edificio/envolvente.js` (30 pruebas con Turf) + guion 19 §5, que pone a `0` las plantas de una parte y **mide que la línea del mapa cambia** |
| **4** · las partes no admiten huecos | Se cumple **por construcción** desde F11: ninguna herramienta crea huecos. Lo que F12 añade es el **guardián** y qué se dice si un fichero trae un anillo interior |

## Desviaciones de este documento, declaradas

- **La envolvente vive en `edificio/envolvente.js`**, no en `model/edificio.js`
  como dice la cabecera «Ficheros»: `model/` no importa Turf en ninguna de sus dos
  ramas y **la envolvente no se almacena** (lo dice el propio modelo).
- **`idLocal` admite `null` en el edificio** y en la parcela es obligatorio. La
  asimetría responde a un hecho: una parcela entra siempre con algo con que
  nombrarla; un edificio puede empezar **vacío**, con el técnico añadiendo partes
  antes de que exista ningún documento del que sacar un nombre. Exigirlo obligaría
  a **inventarlo**.
- **El historial de deshacer es UNO para las dos ramas.** `Ctrl+Z` es una tecla y
  nadie lleva la cuenta de en qué rama la pulsa.
- **Los cuatro gestos del dibujo entran en `GESTOS`** (la tabla de ayuda), que era
  la mitad de T3.5 que se había quedado sin hacer: la barra enseñaba «Dibujar
  recinto» desde la fase 3 y la ayuda no decía **ni una palabra** de qué hacer una
  vez pulsado. Eran ocho gestos; son doce.

## Lo que NO entra, con dueño

- **`GEOMETRIA_DESCARTADA` propio en el léxico** → F13 (decisión del autor).
- **El serializador BU y el «Tipo de operación»** → F13.
- **El contraste con la construcción oficial y el informe de partes** → F14.
- ⚠️ **Deuda de nombre**: el tipo de detección se sigue llamando
  `PLANTAS_DESCARTADAS` y **ya no es lo que hace** (las plantas entran). Vive en
  `edificio/_comun.js`, y renombrarlo mueve el enumerado y sus dos guardianes.
  Quien decida por CÓDIGO tiene `datos.entran === true`, que sí distingue el mundo
  nuevo del anterior sin ambigüedad.

## La verificación, y a quién pertenece cada rojo

- **Mutaciones**: T4.1 **8/8** rojas, T4.2 **10/10** (⚠️ tres salieron **verdes** a
  la primera, y las tres por lo mismo: las pruebas medían **la bandera y no el
  hecho**), T4.3 **12/12**.
- **Guion 19**: `ok:true` en las dos ventanas, sin advertencias.
- **Regresión**: `08-edicion.js` **`ok:true`** (⚠️ hay que lanzarlo sobre
  `#/parcela/edicion`). `13-edificio.js` y `14-shell.js` salen `ok:false`, y **está
  MEDIDO que ninguno de sus rojos es de F12**: se corrió el 13 con el árbol en
  `git stash` —sobre HEAD, sin una línea de esta fase— y salieron **los cinco
  iguales**. Son caducidad de F18 y del rework; el del 14 es la tercera vía que
  F19 añadió a Entrada. **Decisión pendiente del autor.**
- **Lo que F12 sí le arregló al guion 13**: dos guardianes que esta fase volvió
  falsos (el número fijo de secciones, y contar `hidden` cuando quien esconde es
  el eje PASO por CSS). Ver `GUION.md` §28.
