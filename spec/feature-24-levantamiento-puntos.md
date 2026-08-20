# F24 · El levantamiento de puntos sueltos

**Fase:** 24 · **Prioridad:** P13e (Bloque B; ver §Dónde encaja) · **Riesgo:** bajo
en lo técnico —no entra ni una dependencia, ni un byte de CSS, y `edit/snap.js` ya
admitía los puntos desde F06—; el riesgo real es de **redacción**, porque la fase
estrena tres estados de pantalla nuevos y esta casa ya ha dicho tres veces una cosa
falsa sobre la geometría que había delante ·
**Depende de:** F01 (`parsers/dxf.js`, que lee las entidades), F06 (`edit/snap.js` y
el catálogo de dianas), F12 (`edit/dibujo.js` + `viewer/dibujo.js`, la herramienta de
dibujar un recinto), F18 (la vía de medición propia y su pantalla de revisión) ·
**Habilita:** que **el fichero real de un topógrafo entre en la aplicación**. Hasta
esta fase, un DXF de campo se leía entero, se contaban sus puntos, se tiraban sus
coordenadas y se devolvía `SIN_GEOMETRIA`: la aplicación se comportaba como si el
fichero estuviera vacío, y lo hacía en verde.

**Ficheros.** Nuevos — `parsers/levantamiento.js` (317 líneas, el orden en que se
unen los puntos), `viewer/puntos-levantamiento.js` (233, la capa que los pinta),
`scripts/smoke-navegador/28-puntos-sueltos.js` (445) y sus suites
(`test/parsers/levantamiento.test.js`, `test/viewer/puntos-levantamiento.dom.test.js`),
más el fixture `test/fixtures/parsers/puntos_levantamiento.dxf`. Tocados —
`model/parcela.js` (el campo `puntosLevantamiento`), `parsers/dxf.js` (`POINT`,
`rotulos` y su detección), `parsers/importar.js` (el paso 1bis: `unirPuntos`,
`soloPuntos`, `capaPuntos`), `parsers/_comun.js` (`PUNTOS_UNIDOS`),
`app/dialogo-importacion.js` (la decisión `PUNTOS`), `app/cableado-medicion.js`,
`app/cableado-catastro.js` (`camposInvariantes`), `app/cableado-expediente.js`
(`hayPuntos`), `app/cableado-diagnostico.js` (el motivo que se retira),
`app/navegacion.js` (el hecho `puntos` y la forma de alternativa),
`viewer/_comun.js` (el pane 429 y `UMBRAL_PUNTERIA_PX`, que se muda aquí),
`viewer/edicion.js` (`fijarPuntos`, `dianasExtra`), `viewer/dibujo.js` (el cierre por
clic), `viewer/barra-edicion.js` (el quinto gesto), `viewer/leyenda.js`,
`viewer/index.js`, `edit/snap.js` (los puntos como fuente 0 del catálogo),
`app/main.js`.
⭐ **Ni una dependencia nueva, ni un byte de CSS.**

**Estado:** ✅ **código, pruebas y guion HECHOS y en verde** (2026-08-19). Suite:
**8.188 pruebas / 192 ficheros, 0 rojas**. Guion `28-puntos-sueltos.js` en
**`ok:true`** en Chrome real a 1280×720. CSS **0 B** de cambio (mismo hash);
paquete **1.245,75 kB**.
⏳ **NO CERRADA.** Falta la verdad externa y la firma humana: que el contorno
propuesto sea **el linde que el técnico caminó** es juicio sobre un plano real, y
ningún GML nacido de un levantamiento dibujado a mano ha pasado todavía por el ICUC.

---

## ⛔ Nota de procedencia: esta ficha llega TARDE — y ya van dos

Esta ficha se escribe el **2026-08-19**, con la fase entregada y en verde. Es la
**segunda** fase de este proyecto construida sin pasar por `spec/`; la primera fue
F23, y su propia ficha dejó escrito el diagnóstico:

> **Lo que no tiene ficha no tiene quién lo desactualice.**

Aquí el síntoma es distinto y peor de leer, porque **no hay ningún sitio donde la
mentira sea visible**: el trabajo se etiquetó a sí mismo `F18` en los comentarios de
producción —`parsers/levantamiento.js` habla de «el paso 9 de esta fase», `app/main.js`
de «F18 · EL DIBUJO DE LA PARCELA»— y F18 es una ficha **declarada HECHA el
2026-08-06**, cuyo alcance era *cablear `.dxf` y `.txt` como medición propia*. O sea
que el trabajo se colgó de una fase cerrada, y el índice de `SPEC.md` no tiene forma
de saber que P12 creció.

Lo que se corrige aquí: la fase tiene número propio (**F24**), fila **P13e** y esta
ficha. Lo que **no** se corrige y se dice: no hay tabla «tareas por fase»
reconstruida a posteriori. Se construyó en **dos sesiones** —2026-08-18 y
2026-08-19— y lo que hay debajo es **lo entregado y lo medido**, no un plan que nadie
siguió (regla de oro 8).

---

## Objetivo

**Que el fichero real de un topógrafo entre y se pueda trabajar con él.**

Un levantamiento de campo no trae polilíneas: trae **puntos sueltos**. La aplicación
sabía leerlos —los contaba en una detección INFO— y después tiraba sus coordenadas.
El usuario veía «No ha entrado ninguna parcela de ese fichero» con las esquinas de su
parcela dentro del fichero, leídas y descartadas.

La fase da **las dos salidas**, que son las dos que un técnico usa:

1. **Unirlos por él**, cuando el orden está escrito en el fichero. Con 88 esquinas,
   pinchar una a una es media hora de trabajo que la aplicación puede ahorrar.
2. **Traerlos sin unir**, para dibujar el contorno encima enganchando a ellos. Es la
   vía del que no se fía del orden automático, y la que convierte los puntos en lo
   que son: **dianas**.

---

## ⭐ El hecho que lo motiva todo, y está medido

**Cinco levantamientos reales del autor** (`icuc-pruebas/ejemplos dxf/`), contados el
2026-08-18 y vueltos a contar al escribir esta ficha:

| Fichero | `POINT` | `LWPOLYLINE` | `POLYLINE` |
|---|---:|---:|---:|
| `casillas.dxf` | 54 | **0** | **0** |
| `culebral 2.dxf` | 178 | **0** | **0** |
| `dehesa.dxf` | 106 | **0** | **0** |
| `el puerto.dxf` | 102 | **0** | **0** |
| `martin.dxf` | 112 | **0** | **0** |

**Cinco de cinco sin una sola entidad de anillo.** El caso que la aplicación no sabía
leer no era el raro: era **el único** que este autor produce.

⚠️ **Y las cifras son el DOBLE de los puntos que hay**, que es la trampa de este
formato: el software de topografía escribe cada punto **dos veces**, en una capa 2D y
en otra 3D con su cota. `martin.dxf` son 112 entidades = 56 por capa, menos el punto
del origen que se descarta = **55 puntos**. Por eso *elegir una capa es obligatorio*
y no un capricho: unir «todos» daría un anillo con cada vértice repetido y el doble de
lados (`parsers/levantamiento.js#capaConMasPuntos`).

---

## Las decisiones del autor (2026-08-19)

| Eje | Decisión | Consecuencia |
|---|---|---|
| **Cuándo entran los puntos** | **Solo al elegir «no unirlos»** | `opts.soloPuntos` es explícito. Quien une obtiene el anillo y nada más; no se cuelan dianas que no se han pedido. |
| **Peldaño Edición sin recinto** | **Se abre**: los puntos son algo con lo que trabajar | Hecho nuevo `puntos` y `requiere` estrena la forma de **alternativa**. |
| **Dónde viven** | **En el modelo**, con el expediente | `model/parcela.js#puntosLevantamiento`. Persisten en IndexedDB y en el fichero de proyecto. |
| **Cierre del dibujo** | **Clic en la primera esquina, con radio en píxeles** | Y los vértices del propio trazo entran como dianas de enganche. |
| **Cómo se suelta la nube** | **Un botón que la BORRA del modelo**, no un interruptor de visibilidad | `viewer/barra-edicion.js` estrena su séptima herramienta. Reversible con `Ctrl+Z` porque pasa por el historial. |
| **Adónde salen los puntos** | **A ningún sitio, y está bien** | Ni al GML (no son geometría de la parcela) ni al DXF de salida ni al informe. Deja de ser deuda: es lo decidido. |

---

## ⛔ Los dos callejones que esta fase cierra

### 1 · «No unirlos (no entrará ninguna parcela)»

La pantalla de revisión ofrecía tres respuestas y **la tercera no producía nada**: la
nube se descartaba entera —no salía siquiera de `parsers/importar.js`— y el usuario
leía «No ha entrado ninguna parcela de ese fichero». Se le pedía una decisión, la
tomaba, y el callejón era el mismo.

Es **literalmente la lección que F22 midió** con `ConsultaMasiva_ (90).dxf`:

> **Ofrecer una salida que no lo es es peor que no ofrecer ninguna.**

Hoy la opción dice *«No unirlos: traer los 55 puntos de «VER_P2D» y dibujar yo el
recinto»*, y eso es lo que hace.

### 2 · El recinto que solo se cerraba con doble clic

`edit/dibujo.js#anadirPunto` rechaza el punto repetido **contra el ANTERIOR**, no
contra el primero. Así que pinchar la primera esquina **añadía un vértice duplicado
encima**, y el usuario —viendo que no cerraba— seguía pinchando y acumulaba vértices
en el mismo sitio. Las únicas salidas eran el doble clic y `Enter`.

---

## ⛔ El canal escrito y sin enchufar: `fijarPuntos`

`viewer/edicion.js#fijarPuntos` llevaba desde el 2026-08-18 **escrito, documentado con
veinticinco líneas de JSDoc y con catorce pruebas**. `edit/snap.js#dianasDe` ponía los
puntos **los primeros del catálogo** —«en un empate a distancia manda lo medido sobre
lo oficial»—. Y su **único llamante en todo el repositorio era su propia prueba**.

Es la quinta aparición del patrón que `SPEC.md` §1 ya se reprocha por escrito:

> Un diferenciador probado y sin recorrido de usuario **no diferencia nada**.

Y tenía una segunda mitad que nadie había mirado: **ninguna capa los pintaba**. Aunque
el cable hubiera existido, el usuario habría tenido que adivinar dónde estaban sus 88
esquinas y deducir por el salto del cursor si había enganchado. **Un enganche que no se
ve no es una ayuda, es una lotería.**

---

## El hecho `puntos`, y por qué NO se ensanchó `geometria`

`app/navegacion.js` pasa de dos hechos a tres. La tentación era hacer que `geometria`
significara «hay algo con lo que trabajar» y contar los puntos dentro — su propio
JSDoc lo invitaba, porque eso es lo que la palabra dice.

⛔ **Habría abierto Diagnóstico sobre cero recintos**, porque su regla exige
`geometria`, y esa pantalla habría contrastado una geometría inexistente contra el
parcelario y llamado diagnóstico al resultado. **Un hecho que dos peldaños leen con el
mismo nombre tiene que querer decir lo mismo en los dos.**

Así que el hecho es nuevo y `requiere` estrena la forma de **alternativa** —un
elemento que sea array significa «cualquiera de éstos»—:

```js
[PASO.EDICION]: { ramas: RAMAS, requiere: Object.freeze([Object.freeze(['geometria', 'puntos'])]) },
```

⚠️ Y **no repite el error del hecho `diagnostico`** que se retiró el 2026-08-08 por
quedarse de solo escritura: éste tiene un lector real —la compuerta de Edición— desde
la línea en que se escribe. El motivo que se redacta es el del **primero nombrado**:
decirle al usuario «falta la parcela» describe la vía normal, mientras que nombrar la
alternativa convertiría el caso raro en la instrucción principal.

---

## El cierre por clic: por qué en píxeles y no en metros

Cerrar un recinto es un **gesto**, y los gestos se miden en pantalla. Con la tolerancia
del enganche (τ = `OPERATIVOS.snapMetros`, 0,2 m) acertarle a la primera esquina a
escala de finca pide **dos píxeles** de puntería. La respuesta **no** era subir τ —eso
mueve dónde caen los VÉRTICES, que es precisión del dato— sino usar el umbral que este
proyecto ya tenía escrito para exactamente esto: `UMBRAL_PUNTERIA_PX`, 12 px.

Esa constante **se muda** de `viewer/edicion.js` a `viewer/_comun.js`. Su JSDoc decía
«y solo lo usa este módulo» y dejó de ser verdad; `viewer/dibujo.js` declara en su
cabecera que **no conoce a la edición ni al revés**, así que importarlo de allí habría
creado la dependencia que ese módulo evita, y copiar el 12 son dos diales que divergen.
**Sin alias en el sitio viejo** (doctrina de `app/navegacion.js:161`).

Y por eso el radio de cierre vive en `viewer/` y no en `edit/dibujo.js`: ese módulo
declara que no quiere un segundo criterio de proximidad, y **tiene razón, en
geometría**. Un radio de pantalla no es geometría: no existe sin un mapa con un zoom.
La frontera de la casa —`edit/` sabe geometría, `viewer/` sabe gestos— cae justo ahí.

**Lo que se ve, y es la mitad que importa:** la primera esquina se agranda **solo
cuando ya se puede cerrar** (tres vértices), y se **rellena** al acercarle el puntero.
Sin esa señal el usuario se entera de que ha cerrado cuando ya ha cerrado. Todo por
opciones de Leaflet: la hoja está en su techo con **0 B de holgura**.

---

## ⛔ El enganche que solo se veía cuando ya era irreversible (2026-08-19)

La capa `viewer/puntos-levantamiento.js` puso los 88 puntos a la vista y `dianasExtra`
los hizo enganchables. Quedaba el hueco de en medio: **al pasar el puntero por encima
de uno de ellos no ocurría nada**. El indicador OSNAP existe desde F06 —el cuadradito
sobre el vértice, la cruz sobre el lindero, en `viewer/edicion.js`— pero lo enciende
`ajustar`, y dibujando **solo se llamaba a `ajustar` EN EL CLIC**. El usuario clavaba
el vértice y solo entonces veía si había enganchado; para preguntarlo tenía que
deshacer.

Es el mismo defecto que este mismo documento se reprocha dos secciones más arriba
—«un enganche que no se ve no es una ayuda, es una lotería»— sobreviviendo un paso más
allá de donde se creyó cerrado: los puntos ya se veían, y **lo que seguía sin verse era
la captura**.

**Lo que se hizo, en una línea de gesto:** `viewer/dibujo.js#alMoverPuntero` le hace al
enganche, en cada `mousemove`, **la misma pregunta que le hará el clic**. Y esa
identidad es toda la garantía: misma τ, misma tecla `Alt`, mismas `dianasExtra`, mismo
`viewer/edicion.js#ajustar`. El indicador no es una segunda opinión sobre dónde caería
el vértice — **es la primera, dicha antes**. Si a ese zoom la tolerancia no alcanza, no
se pinta nada, que también es la verdad.

⚠️ **Sobre la primera esquina armada no se previsualiza.** Ahí el clic no pone un
vértice, CIERRA, y el aro relleno ya lo está diciendo; dos marcas encima del mismo
punto contando dos cosas distintas es peor que una sola.

⛔ **Y hubo que abrir una puerta nueva: `edicion.soltarEnganche()`.** `ajustar`
enciende y apaga mientras alguien pregunta, y a un arrastre le basta: el `dragend`
viene precedido de un fotograma que ya decidió. Un dibujo **no tiene ese fotograma
final** —se termina con `Escape`, con `Enter`, con un doble clic, con el botón o
porque cambia la pantalla—, así que el cuadradito se quedaba pintado sobre un mapa en
el que ya no se dibuja. `viewer/dibujo.js#parar` la llama, y las cinco salidas pasan
por ahí. El gancho entra por el constructor (`alSoltarEnganche`) como `ajustar`: este
módulo sigue sin conocer a la edición.

**Y es de las que la suite no puede firmar**: sin píxeles no hay hover, y en jsdom un
indicador «existe» aunque nadie lo mire. Lo mide `28-puntos-sueltos.js` en navegador
real, punto 4 — pasa el puntero sobre una diana, sin pinchar, y exige el cuadradito.

---

## El campo del modelo, y la trampa de F21 cazada antes de morder

`puntosLevantamiento` entra en `model/parcela.js` con el **mismo trato que
`geometriaOficial`**: copia independiente y **congelada**, porque nada los edita.

⛔ **La lección de F21** —`edificio/mutaciones.js#reconstruir` no arrastraba la
precisión declarada, así que cualquier mutación la borraba en silencio para reaparecer
como `xsi:nil` en un documento firmado— aquí duele el doble: los puntos son las dianas
sobre las que se está dibujando, y el DXF puede no estar ya en el disco.

Se resolvió **sin escribir nada nuevo**: `camposInvariantes(actual)` de
`app/cableado-catastro.js` es exactamente «los campos que no son de ninguno de los dos
ejes», y lo comparten **los dos compositores duales**. El campo entra ahí y en ningún
otro sitio. Traer el parcelario de fondo o rehacer la medición no puede llevárselo.

⚠️ Y una asimetría deliberada en `componerParcelaMedida`: **`null` no significa
«bórralos», significa «este fichero no traía»**. Un DXF de polilíneas no habla de
puntos, y hacer que su llegada se lleve por delante la nube sería trabajo perdido en
silencio.

---

## El guion 28, y los TRES defectos que destapó

`28-puntos-sueltos.js` anda el recorrido entero sobre `martin.dxf` (32.290 B).
⛔ **Su primera corrida encontró tres defectos que las 8.185 pruebas aprobaban en
verde**, y los tres son de la misma familia —M25, M31 y el chip de «0 errores»—: un
renglón que describe un expediente distinto del que hay en pantalla.

1. **«Todavía no hay parcela. Empieza por una de las vías de arriba.»** — con 55
   puntos pintados en el mapa y el usuario ya fuera de Entrada. Es la misma trampa que
   su gemelo vino a cerrar el 2026-08-18, **un estado más allá**: no hay parcela ≠ la
   parcela está mal, y tampoco ≠ la parcela todavía no tiene contorno. Corregido con
   `MENSAJE_SIN_CONTORNO_TODAVIA`, que nombra la herramienta por su nombre.
2. **«"Traer el parcelario de fondo" está apagado…» con el botón ENCENDIDO.** La regla
   de esa capa —escribir el motivo solo con el renglón vacío— protege el desenlace de
   la última acción, y le faltaba la vuelta: **cuando la condición desaparecía, nadie
   retiraba la frase**. Era inalcanzable hasta hoy, porque con «no hay geometría»
   puesto no había forma de fabricar geometría sin cargar otro documento — y esta fase
   abre justo ese camino: se entra en Edición sin contorno y se dibuja allí mismo.
3. **Un AVISO sobre una importación que había ido bien.** La deducción de referencia
   busca un punto INTERIOR de la geometría; sin contorno contestaba «no hay ninguna
   geometría cargada», y era **el primero que el usuario leía**. No es un fallo: es un
   paso que no aplica. **Un aviso que cuenta un paso inaplicable enseña a no leer los
   avisos.**

Los tres corregidos con guardián. Hoy el guion sale `ok:true`.

---

## El mando que suelta la nube (2026-08-19, misma jornada)

⛔ **Lo que faltaba, dicho por el autor.** Cerrada la fase, la primera lectura fue
que los puntos **no se podían quitar**: viven en el modelo, así que se guardan con
el expediente, viajan en el fichero de proyecto y se repintan cada vez que se
recupera. Con el contorno ya dibujado encima, esos 55 aros —88 en el fichero de
campo del autor— dejan de servir para nada y tapan el mapa **para siempre**. La
única forma de perderlos era no haberlos importado, y eso convierte la decisión de
la pantalla de revisión en irreversible por la puerta de atrás.

### Por qué BORRA y no esconde

Un conmutador de visibilidad parece más suave y es peor, por tres razones medidas:

1. **Dejaría dos verdades** —lo que hay en el modelo y lo que se ve— y la que se
   queda vieja es siempre la de la UI.
2. **Obligaría a apagar el enganche por su cuenta.** Un punto invisible al que el
   ratón se sigue enganchando es peor que un punto de más: el usuario apunta a un
   sitio y el vértice cae en otro, que es exactamente el defecto que `fijarPuntos`
   existía para no tener.
3. **No sobrevive a guardar y recuperar.** La nube volvería a aparecer sola, y el
   usuario no sabría por qué.

La red que hace admisible borrar es que **pasa por el mismo camino que todo lo
demás**: clon, `estado.set`, y un `commit` DESPUÉS. `Ctrl+Z` lo deshace como
cualquier edición. Y eso se promete **antes** del clic, en el nombre del propio
botón, no después.

### Dónde vive, y por qué ahí

| Pieza | Decisión |
|---|---|
| **El botón** | Séptima herramienta de la barra del mapa, `[data-accion="quitar-puntos"]`, **pegada a «Dibujar recinto» y sin separador entre medias**: son el mismo trabajo en sus dos tiempos —se dibuja SOBRE los puntos y se quitan CUANDO ya se ha dibujado—, igual que insertar y borrar son pareja. |
| **Su presencia** | **Oculto, no apagado**, como el dibujo: sin puntos no hay nada que quitar, y un botón gris permanente con un motivo que habla de un fichero que nadie ha soltado dice menos que su ausencia. |
| **Su nombre** | Lleva **la cuenta dentro** — «Quitar los 55 puntos sueltos del levantamiento (se puede deshacer)». Es la única cifra que el usuario tiene: 55 aros de 3 px superpuestos no se cuentan mirando. |
| **Quién lo gobierna** | `app/main.js#repintarPuntosLevantamiento`, la MISMA suscripción al store que pinta la capa y fija las dianas. **Tres salidas, un solo escritor**: separarlas es cómo se llega a un botón que ofrece quitar unos puntos que ya nadie ve. |
| **Su color** | `HERRAMIENTA_DESTRUCTIVA`, el rojo de la papelera. Que se pueda deshacer no lo hace inocuo; lo hace reversible. |
| **CSS nueva** | **Ninguna.** Clase, icono y separador salen de lo que la barra ya tenía. |

### Dos cosas que esto rompió, y las dos las cazó una prueba

- ⛔ **`puntosVisible` se quedó FUERA de la fachada del control.** `crearBarraEdicion`
  no devuelve el objeto de la clase: devuelve una fachada que delega método a método,
  y añadir el método a la clase sin añadirlo a la fachada dejó el canal escrito y sin
  enchufar **por quinta vez en este proyecto**. Lo cazó su propia prueba el mismo día,
  que es la diferencia con las cuatro anteriores.
- ⛔ **El separador era propiedad de `dibujoVisible`.** Con un segundo vecino
  escondible eso deja de valer: en la rama EDIFICIO sin parte elegida el dibujo se
  esconde, y con puntos en el mapa este botón se quedaba solo detrás de un filete
  invisible, pegado a la ayuda. Ahora lo decide `_refrescarSeparadorDibujo`, que mira
  a sus dos lados.

### El icono, medido en el navegador

Seis puntos y una diagonal que los tacha. **No una papelera**, y la vecina de dos
botones más allá es por qué: aquella ARMA un modo y borra vértices de la geometría de
uno en uno; ésta se pulsa una vez y se lleva una nube que no es geometría.

Los puntos son `h.01` con remate redondo, o sea **2 px de los 24 del `viewBox`**: a
los 18 px reales del botón, punto y medio. La primera versión llevaba **cuatro** y en
pantalla se leía como una raya diagonal con dos motas al lado. Con **seis**, tres a
cada lado y ninguno a menos de 4,9 px de la línea `x + y = 24`, el campo de puntos se
lee. La raya mide 2 px de grueso y **se traga** cualquier punto que la pise: uno mal
colocado no se ve mal, desaparece.

---

## Mediciones (2026-08-19, Chrome a 1280×720, `martin.dxf`)

| Qué | Medido |
|---|---|
| Puntos que entran | **55** (de 112 entidades `POINT`, dos capas y el origen fuera) |
| Puntos **pintados y dentro de la ventana** | **55 de 55** — o sea, el mapa encuadra sobre ellos |
| Aterrizaje | `#/parcela/edicion`, con «Dibujar recinto» visible |
| Cierre por clic | acierta a **6 px** del centro de la primera esquina (umbral 12) |
| Recinto resultante | 3 vértices · **1.715,68 m²** |
| Puntos tras cerrar | **55** — la nube no se va con el contorno |
| `Ctrl+Z` / `Ctrl+Y` | quita y devuelve el recinto **conservando los 55 puntos** |
| Guardar → recargar → Recuperar | vuelven los 55 puntos y el anillo, en IndexedDB **real** |
| «Quitar los puntos» con la nube puesta | visible, y su nombre dice **55** |
| Un clic | **0 aros** en el mapa, el botón se esconde solo, y el recinto sigue en **3 vértices · 1.715,68 m²** |
| Lo que dice al hacerlo | «Quitados los 55 puntos sueltos del levantamiento. «Deshacer» (Ctrl+Z) los devuelve.» |
| `Ctrl+Z` tras quitarlos | **vuelven los 55**, vuelve el botón, y el recinto no se mueve |
| Peticiones a servicios de datos | **0** |
| CSS | **0 B**, mismo hash |

---

## Criterios de aceptación

1. ✅ Un DXF sin ninguna polilínea y con ≥ 3 puntos **abre la pantalla de revisión**
   en vez de rechazarse, y `SIN_GEOMETRIA` **no se enseña** junto a la oferta.
2. ✅ Se ofrece **una opción por capa de puntos**, con su recuento, y una tercera que
   **trae los puntos sin unir**. Ninguna nace marcada y el botón se apaga **con su
   motivo escrito al lado**.
3. ✅ Unir por la **numeración** del topógrafo se cuenta en INFO; unir por el **orden
   del volcado** es una conjetura y se cuenta en **AVISO**, pidiendo revisión.
4. ✅ Traer los puntos sin unir produce una parcela con `recintos: []`, la nube
   pintada, el mapa **encuadrado sobre ella** y la pantalla en **Edición**.
5. ✅ Los puntos son **dianas de enganche** y **se ven**: las dos cosas comen del
   mismo array, así que no pueden divergir.
6. ✅ El recinto se cierra **pinchando su primera esquina**, que se agranda cuando ya
   se puede cerrar y se rellena al acercarle el puntero. Doble clic y `Enter` siguen
   valiendo, y el doble clic **sigue sin descontar un vértice bueno**.
7. ✅ Los puntos **sobreviven** a `Ctrl+Z`, a traer el parcelario, a guardar y
   recuperar, y al fichero de proyecto.
8. ✅ **Diagnóstico NO se abre** con solo puntos: no hay contorno que contrastar.
9. ✅ Ningún renglón dice lo contrario de su botón.
10. ✅ La nube **se puede quitar** con un mando de la barra que dice cuántos se lleva,
    se esconde solo cuando ya no hay ninguno, **no toca el recinto** y deja la vuelta
    escrita: `Ctrl+Z` devuelve los 55.
11. ✅ **0 B de CSS** y ninguna dependencia nueva.

---

## Riesgos

- ⛔ **La redacción, no la geometría.** La fase estrena tres estados de pantalla
  —parcela sin contorno, primera esquina armada, motivo que se retira— y los tres
  defectos que encontró el navegador fueron **de texto**, no de cálculo. El próximo
  estado nuevo es donde hay que mirar.
- ⚠️ **El orden por numeración es una heurística con una guarda dura**: los rótulos
  tienen que casar **1:1 y por orden** con los puntos de una capa, ser enteros sin
  signo y sin repetidos. Si no, se declina y se une por el orden del fichero
  diciéndolo. No hay emparejamiento por proximidad, a propósito: es el tipo de
  heurística que falla en el fichero número seis y no se puede depurar.
- ⚠️ **Un anillo que se cruza consigo mismo está PERMITIDO** al unir: un levantamiento
  con un punto mal numerado lo produce. Es un hallazgo de `validation/`, no un fallo
  de la herramienta. Corregirlo en silencio sería inventarse un linde.

---

## Deuda declarada

- ✅ ~~**No hay forma de soltar la nube.**~~ **SALDADA el mismo día**: «Quitar los
  puntos» es la séptima herramienta de la barra del mapa. Ver la sección de arriba.
- ✅ ~~**Los puntos no salen por ninguna parte.**~~ **DECIDIDO por el autor el
  2026-08-19: está bien así.** No van al GML (no son geometría de la parcela) ni al
  DXF de salida ni al informe. Deja de ser una pregunta abierta y pasa a la tabla de
  decisiones.
- ⚠️ **La rama EDIFICIO hereda el cierre por clic y el auto-enganche del trazo** —
  comparte `crearDibujo` y `edicion.ajustar`—. La suite pasa entera y el gesto es
  coherente, pero **no se ha mirado en navegador**.
- ⚠️ **`componerParcelaElegida` (F22) compone sin nube**, y está dicho en el código: un
  parcelario de «Consulta Masiva» es todo polilíneas. El día que uno traiga puntos, esa
  línea es donde hay que decidirlo.
- ⚠️ **Las cotas (Z) se leen y se tiran.** `parsers/dxf.js` las conserva en `puntos[].z`
  y ni el modelo ni el visor las conocen. Misma deuda que las 168 huellas de
  `Construccion` de F22.

---

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que el contorno propuesto sea el linde que el técnico caminó.** Es juicio humano
  sobre un plano real. Va al `CHECKLIST-HUMANO.md`.
- **Que un GML nacido de un levantamiento dibujado a mano pase el ICUC.** Verdad
  externa; no la da ninguna máquina de esta casa.
- **Que sin contorno no se pida la deducción de referencia.** La guarda es una línea
  con su porqué escrito y está medida en el guion 28, **no en la suite**: expresarla en
  jsdom pedía conducir la pantalla de revisión desde un fichero de test que no tiene
  ese arnés.
- **El arrastre como gesto de ratón** (§0 del `GUION.md`): los clics del dibujo son
  `MouseEvent` sintéticos.

---

## Dónde encaja

**P13e, Bloque B**, detrás de F23 y en el mismo grupo que F18 (del que nació), F19,
F20 y F22: las fases que hacen que **los ficheros que el técnico ya tiene** entren en
la aplicación. Cierra el hueco que F01 abrió y que F18 solo cerró a medias — aquella
cableó `.dxf` y `.txt` como medición propia, y **el `.dxf` que este autor produce
seguía sin entrar**.

## Referencias

- `parsers/levantamiento.js` — las dos autoridades del orden (numeración y fichero) y
  por qué no valen lo mismo.
- `edit/snap.js#dianasDe` — los puntos como fuente 0 del catálogo.
- `viewer/_comun.js#UMBRAL_PUNTERIA_PX` — por qué la puntería va en píxeles y τ en
  metros, y por qué son dos umbrales.
- `app/navegacion.js#CLAVES_HECHOS` — por qué el hecho es nuevo y no un `geometria`
  ensanchado.
- `scripts/smoke-navegador/28-puntos-sueltos.js` y `GUION.md` — el recorrido medido y
  los tres defectos de su primera corrida.
- `spec/feature-18-entrada-parcela-fichero.md` — la fase de la que ésta nació, y de la
  que se colgó sin ficha durante dos sesiones.
