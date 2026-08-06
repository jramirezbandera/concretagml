# F18 · Entrada de parcela por fichero

**Fase:** 18 · **Prioridad:** P12 (cierra el Bloque B) · **Riesgo:** Bajo ·
**Depende de:** F01 (los parsers, escritos y en verde desde la fase 1), F05
(`geometriaOficial` y «Deducir del mapa»), F07 (el diagnóstico que esto alimenta),
F11 (el patrón del `<dialog>` de reparto por capas) ·
**Habilita:** que el técnico pueda **meter su propio levantamiento**.

**Ficheros (hecho el 2026-08-06; eran 4 previstos y son 3 nuevos + 5 tocados):**
`app/dialogo-importacion.js` y `app/cableado-medicion.js` (**el paso 17**) nuevos, más
`scripts/smoke-navegador/17-medicion-propia.js`. Tocados: `export/coordenadas.js`
(+`export/index.js`), `app/main.js`, `estilos/app.css`.
⭐ **Ni `model/`, ni `parsers/`, ni `viewer/`, ni `index.html`, ni `package.json`.**

> ⏳ **Esta ficha se abrió con el plan y se ha reescrito al cerrar.** Lo que decía
> del futuro y resultó falso **no se ha borrado**: se conserva citado al lado de lo
> medido. Manda lo medido (regla de oro 8).

## Objetivo

**Que la vía de MEDICIÓN PROPIA deje de ser un cartel sin puerta detrás.**

La pantalla de Entrada anuncia tres formas de empezar un expediente. Dos
funcionaban. La tercera —«Medición propia · tu levantamiento en `.dxf` o un volcado
de coordenadas en `.txt`», [`index.html:418-431`](../index.html#L418-L431), con su
botón «Elegir un fichero de medición…»— **rechazaba el fichero con un aviso**.

## ⛔ Cómo se abrió esta grieta, porque el mecanismo importa más que el hueco

Esto **no era alcance nuevo**: era el requisito de F01, que la spec da por hecho.
[`feature-01-entrada-parcela.md:8`](feature-01-entrada-parcela.md#L8) pide «meter
geometría al modelo desde **las tres vías de fichero del técnico**», y F01 figura
«✅ hecho». Y lo está — **para la capa de parsers**. La grieta es que en F01
**todavía no había aplicación**: nace en F03, y los parsers se escribieron como
módulos puros sin llamante.

| Fase | Qué hizo con la entrada por fichero |
|---|---|
| **F08** | Estrenó **la primera vía de fichero de toda la app** y cableó **solo `.gml`** |
| **F10** | La declinó por escrito: «**No se cablea la ENTRADA de DXF**» |
| **F11** | Cableó `.dxf`/`.txt` **solo a la rama Edificio**, y declaró la asimetría «cerrada a medias» |

⛔ **El requisito quedó sin dueño en el índice.** El único sitio del proyecto que le
asignaba casa era un **comentario de código** (`app/main.js`, «su sitio es F12»), y
la ficha de F12 no lo recogía. El aprendizaje de método es que **«hecho» debe
significar «el usuario puede usarlo»**, no «el módulo está en verde».

## Las cuatro decisiones (entrevista del 2026-08-05)

1. **Entran `.dxf` y `.txt`. LIST pegado NO** — ver «Deuda declarada».
2. ⭐ **Un dibujo entra como MEDICIÓN; la geometría oficial se conserva.** Ocupa
   `recintos` y `geometriaOficial` **no se toca** ⇒ el Diagnóstico de F07 funciona
   sin traer nada más. **Salvo sobre la parcela de DEMOSTRACIÓN, que sustituye.**
3. **Las detecciones se resuelven en un `<dialog>` de revisión**, y **solo cuando
   hay algo que decidir**.
4. **La rama activa decide el destino, sin preguntar** ⇒ `MENSAJE_DIBUJO_EN_PARCELA`
   **se ha borrado**.

## Mediciones

**M1 · ⭐ `ORIGEN_PARCELA` ya listaba `LIST`, `TXT` y `DXF`** desde F00
(`model/parcela.js:33-39`), sin un solo llamante. Igual que `ORIGEN_PARTE` en F11:
el modelo llevaba once fases esperando esta fase. **`model/` no se ha tocado.**

**M2 · ⭐ F08 ya componía exactamente esta parcela.** `cablearComprobacion#contrastar`
mete `recintos` del fichero y `geometriaOficial` del parcelario en un solo
`estado.set`. F18 hace lo mismo **sin red**: los dos minuendos están en memoria.

**M3 · ⛔ La parcela de DEMOSTRACIÓN no es geometría de mentira.** Es la parcela
**real** 9398516VK3799G con su geometría oficial de verdad (`app/demo-datos.js:94-98`),
y la app arranca con ella. Componer un levantamiento de otra provincia contra ella
habría producido un diagnóstico con cifras **enormes, ciertas y sin ningún sentido**.
El detector no se inventó: **`ID_LOCAL_DEMO` ya existía** para responder justo esa
pregunta, y su JSDoc razona por qué `refcat`, `origen` y la identidad del POJO no
sirven. *(El plan no contemplaba este caso: lo destapó la exploración.)*

**M4 · ⛔ El aviso del listado de replanteo NO viaja literal en el fichero.** Medido:
`texto.includes(AVISO_NO_REIMPORTABLE)` devuelve **`false`** sobre un listado real,
porque `parrafo()` lo envuelve a 70 columnas. **Un detector escrito contra la
constante habría salido verde en su test —comparándose consigo mismo— y no habría
reconocido ni uno solo de los ficheros de verdad.** Se colapsan los blancos, y la
ventana de cabecera son 4000 caracteres (el aviso acaba en el **1195** con 400
vértices y un expediente de 150 caracteres).

**M5 · ⭐ Y lo que ese fichero provoca hoy NO era lo que la ficha suponía.** La ficha
escribió, por inferencia, que el usuario «se lleva una parcela silenciosamente
falsa». **Medir lo refutó el mismo día.** Un listado de 15 vértices entra por
`importar()` y salen **18 pares** —la cifra de F10, reproducida— pero
`construida: false` y `bloqueos: ['HUSO_NO_RESUELTO']` en las tres variantes
probadas (con y sin `refcat`/`srs`, y con `huso: 30` forzado). Los números parásitos
de la cabecera envenenan la comprobación del huso.

⛔ **Así que el defecto no era una parcela falsa: era un DIAGNÓSTICO falso.** El
usuario recibía «no se ha podido resolver el huso» — plausible, del catálogo, y
mentira: no hay ningún huso que arreglar. Y la protección era **incidental**, no
diseñada. Ahora hay un detector con nombre propio y seis pruebas.

**M6 · ⭐ La capa `0` de `UTM.dxf` y `PARCELA.txt` son la misma parcela**: 11
vértices, **61,0450 m²**, idénticas a 4 decimales. Con `capa: '0'` la superficie es
**positiva** (el guardián de la regresión de los −390,45 m² de F11). Y `BLANCO`
**también construye** (15,00 m²), que es la prueba de que «construye» no basta para
identificar la capa buena: por eso se **ofrece** y no se adivina.

**M7 · El diálogo con reparto de capas pregunta ESO Y NADA MÁS.** Medido sobre
`UTM.dxf`: **27 detecciones** sin elegir capa (8 de ellas avisos de cierre ambiguo),
**9** con la capa `0` puesta y ni un cierre ambiguo. Los 8 avisos hablaban de anillos
del cajetín y de la leyenda que el usuario está a punto de descartar.

**M8 · El coste en píxeles es CERO**, medido en Chrome a 1440×900: el `<dialog>`
flota (`z-index 1200`, `620×792`) y la tabla de vértices pasa de 0 px (vacía, en
Entrada) a **162,16 px** con los 12 vértices dentro. No encoge nada.

**M9 · El paquete crece 16,24 kB** (JS 935,20 → **949,64 kB**; CSS 62,30 →
**64,20 kB**), **+5,03 kB en gzip**. **Ni una dependencia nueva**: `package.json` no
cambió. La deuda de partirlo sigue siendo F16.

**M10 · ⛔ Y una corrección al propio plan: `importar()` NO sabe proyectar grados.**
La detección existe y trae `datos.reproyectar: true`, pero **no hay ninguna opción
para aplicarla**: `geo/huso.js#sanear` declara que no proyecta (regla de oro 3) y la
proyección vive en `geo/utm.js#forward`, sin nadie que las una. El plan aprobado
listaba «proyectar geográficas» entre las correcciones del diálogo. Ver «Deuda».

## ⛔ El defecto que encontró el guion, y que 6.339 pruebas no veían

**La cabecera decía «Parcela del Catastro» después de importar el levantamiento del
propio técnico.** Es el error caro de esta aplicación —hacer pasar por oficial una
geometría que ha dibujado el usuario—, y a partir de ahí se firma sobre ella.

**No lo vio ninguna prueba, y el motivo hay que tenerlo escrito: la afirmación no
existía.** `rotuloDelDato` tenía tres estados, y hasta F18 «no es la demostración»
implicaba «la trajo el Catastro» porque el Catastro era la única puerta al store.
F18 estrena la cuarta y nadie fue a mirar ese rótulo. Es la misma familia que M20 y
M21 de F08: *un gate no encuentra lo que no se le ocurre preguntar.*

Corregido: `EYEBROW_MEDICION` («Tu medición · no del Catastro») y el criterio pasa a
ser el **origen** —derivado de `ORIGEN_PARCELA`, no escrito a mano— en vez del
`idLocal`. Con guardián de comportamiento en `main-edificio.dom.test.js`.

⚠️ **Y una lección sobre el guardián mismo.** El primero acusaba con `/catastro/i`, y
salió rojo sobre el rótulo **ya corregido** —«Tu medición · **no** del Catastro»—
porque la palabra estaba ahí, negada. Hoy acusa por la **afirmación**. Tercera vez
que este proyecto paga lo mismo (ver F17 · fase 1).

## Criterios de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | Un `.dxf` real con la rama Parcela **entra como parcela**; `MENSAJE_DIBUJO_EN_PARCELA` no existe | ✅ guion 17 + guardián de fuente |
| 2 | Sobre una parcela traída, **conserva `geometriaOficial` y la referencia**; el Diagnóstico se abre | ✅ suite (22 pruebas) · ⏳ con red, §14.2 |
| 3 | Con `UTM.dxf` la importación **para y pregunta** la capa | ✅ 5 capas, medido en Chrome |
| 4 | Ninguna corrección se aplica sola | ✅ 25 pruebas del diálogo |
| 5 | El `.txt` de replanteo propio **se rechaza nombrando el motivo** | ✅ y **sin** el diagnóstico falso del huso |
| 6 | La superficie de la parcela importada es **positiva** y coincide con la otra vía | ✅ 61,0450 m², vértice a vértice |
| 7 | Guion `17-medicion-propia.js` en `ok:true` | ✅ tras una primera corrida en rojo con **un defecto real** |
| 8 | Se **mide y se declara** lo que la fase le quita al panel | ✅ **0 px** (M8) |

## Deuda declarada

> ✅ **Las tres se han cobrado: [F19](feature-19-pegado-list.md) se abrió el
> **2026-08-06**, dos días después de esta ficha, y se lleva las tres —el pegado,
> los grados y el rótulo de `GML_EXISTENTE`—. La entrevista de F19 la amplió de
> **una tarea a tres**: lo que aquí se llamó «una tarea» era solo la primera.
> **Que se abriera en dos días y no en once fases es lo que esta ficha pedía.**

- ⛔ **LIST pegado sigue sin construirse, y sale con dueño: F19, una tarea.** Es la
  vía que [`feature-01:14`](feature-01-entrada-parcela.md#L14) llama **principal** y
  no tiene ni un manejador de `paste` en producción (medido: grep, cero). Fuera por
  decisión explícita del 2026-08-05. **Una deuda sin dueño en el índice es
  exactamente lo que le pasó a esta.**
- ⛔ **Coordenadas en grados: se detectan y NO se proyectan** (M10). El plan aprobado
  sí lo listaba; enchufar `geo/utm.js#forward` exige un `zonaPorLon` en `geo/huso.js`
  y una opción nueva en `parsers/importar.js` — dos módulos de geometría con sus
  suites, y F18 se acotó a cableado y UI. **No entra nada malo**: `importar()` ya
  bloquea, y la pantalla dice qué hacer (reexportar en UTM desde el CAD). **Casa
  propuesta: F19, junto al pegado de LIST.**
- ⚠️ **`GML_EXISTENTE` sigue rotulado «Parcela del Catastro».** Medido al pasar: un
  GML de otro técnico también es geometría de un fichero. No se toca aquí porque ese
  rótulo es parte del recorrido de F08 —que cruza a Contraste y reescribe
  `data-procedencia`— y cambiarlo de refilón en la última tarea de otra fase es como
  se rompe lo que nadie está mirando.
- ⚠️ **El cotejo de superficie solo lo trae LIST** (es el único formato con
  superficie declarada). Con `.dxf`/`.txt` ese renglón **no aparece**: no se enseña
  vacío ni con un cero, que afirmaría algo falso.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que el `<dialog>` sea un modal de verdad.** En jsdom su prototipo tiene
  exactamente `constructor` y `open`: las 6.339 pruebas ejercitan el **camino
  degradado**. Lo mide el guion 17 (`showModal`, capa superior, backdrop, encaje).
- **Que el reparto por capas se entienda sin explicación** → `CHECKLIST-HUMANO.md` §14.1,
  **BLOQUEANTE**, y con un plano real de trabajo.
- **El recorrido medición-contra-parcelario con red** → §14.2.
- **Que ninguna frase se lea como un juicio sobre el levantamiento ajeno** → §14.3.

## Estado

✅ **Código y pruebas: 6.339 pruebas / 150 ficheros, verde** (partida: 6.278/149).
✅ **Guion `17-medicion-propia.js` en `ok:true`, `problemas: []`, `advertencias: []`.**
⏳ **Firma humana**: `CHECKLIST-HUMANO.md` §14, con un punto **BLOQUEANTE**.

## Referencias

Plan §5, §18 Fase 1, §23.1 · [`feature-01-entrada-parcela.md`](feature-01-entrada-parcela.md)
(el requisito y las detecciones defensivas) ·
[`feature-10-persistencia-export.md`](feature-10-persistencia-export.md) (el `.txt` no
reimportable) · [`feature-11-edificio-entrada.md`](feature-11-edificio-entrada.md)
(el patrón del `<dialog>` de capas) · `GUION.md` §26 · `CHECKLIST-HUMANO.md` §14.
