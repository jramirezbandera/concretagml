# F25 · Las parcelas del expediente

**Fase:** 25 · **Prioridad:** P13f (Bloque B; ver §Dónde encaja) · **Riesgo:** Medio —
no en la geometría, que ya está escrita (F17, F23), sino en la **identidad**: la fase 0
ha medido que «¿ha entrado otra parcela?» se pregunta de **seis maneras distintas** en
la aplicación, y cambiar de miembro dentro del mismo expediente responde «sí» a todas
ellas, también donde la respuesta correcta es «no» (H1) ·
**Depende de:** F06 (edición, `edit/historial.js`, `edit/snap.js`), F10 (expedientes y
fichero de proyecto), F17 (`derivacion/`, `comprobacion/conjunto.js`, el sobre de N
`featureMember`), F22 (el cajón de elegir sobre el mapa), F23 (`app/colindantes.js` y
el colindante recortado) ·
**Habilita:** segregaciones, reparcelaciones y cualquier expediente en el que el técnico
tenga que **editar a mano más de una geometría** —la suya, la de una colindante, las
fincas nuevas— y entregarlas juntas o por separado.

**Ficheros (previstos).** Nuevos — `app/conjunto.js` (el registro de miembros, puro),
`viewer/cajon-expediente.js` (la lista en el mapa) y `viewer/miembros.js` (la capa que
pinta los demás miembros), `scripts/smoke-navegador/29-parcelas-del-expediente.js`.
Tocados — `model/parcela.js` (`crearExpediente`), `edit/historial.js` (apartar y
restaurar), `export/proyecto.js` (versión 2), `storage/expedientes.js` (`NO_SE_GUARDA`),
`app/cableado-expediente.js`, `app/cableado-diagnostico.js`, `app/cableado-informe.js`,
`app/cableado-catastro.js`, `app/cableado-derivacion.js`, `app/colindantes.js`,
`viewer/index.js`, `app/rama.js` (el selector de la cabecera), `app/main.js`.
**Se actualiza al cerrar cada fase.**

**Estado:** ⏳ **ABIERTA el 2026-11-01.** Fases 0 (la auditoría), 1 (el modelo) y 2 (cambiar
de parcela) **hechas**. Un expediente de varias se abre entero, se cambia de parcela con el
selector «Parcela en edición» y se guarda con todas. Lo que todavía **no** se puede es
CREAR la segunda parcela dentro de la aplicación (fase 3) ni exportar una selección
(fase 4).

> ⏳ **Esta ficha se abre ANTES del código**, y es a propósito: F23 y F24 llegaron tarde
> a `spec/` y las dos lo anotaron como hallazgo. Lo que aquí se dice del futuro está en
> futuro; lo que resulte falso **no se borra**, se conserva citado al lado de lo medido
> (regla de oro 8).

## Objetivo

**Que un expediente pueda tener varias parcelas, editar cualquiera de ellas y entregarlas
juntas, por separado o en la selección que haga falta.**

Hoy la aplicación sabe *emitir* varias parcelas (F17, F23), pero solo **edita una**: las
demás salen derivadas por el programa —el sobrante, el vecino recortado— y no se pueden
tocar. En una segregación con varias fincas resultantes, o en una reparcelación donde
entran colindantes, el técnico tiene que **dibujar y ajustar** cada geometría, y la
aplicación no tiene dónde ponerlas.

⛔ **No es la primera vez que esto aparece.** La ficha de F17 apartó su fase 2 con un coste
estimado alto porque, decía, pedía «colección de geometrías en el store, selección activa
y undo por capa». F23 demostró que el colindante recortado **no** lo necesitaba. Lo que
pide esta fase es **exactamente esa pieza**, y esta vez sí hace falta: ya no se trata de
derivar, sino de editar a mano.

## El vocabulario

| Término | Qué es |
|---|---|
| **Parcelas del expediente** | El nombre en la interfaz. «Capas» ya está cogido (la lista de capas del mapa), y «fincas» es registral: una finca puede abarcar varias parcelas catastrales |
| **Miembro** | Cada parcela del expediente. Solo en el código y en esta ficha |
| **En edición** | El miembro que está en el store. Hay **uno y solo uno** |
| **Contexto** | Las colindantes que trae el Catastro o un DXF y que **no** son miembros: se ven, sirven de diana para el enganche, no se editan ni se exportan |

Cada miembro tiene un **papel**, y el papel decide su identidad en el GML y si cuenta para
el cierre:

| Papel | De dónde sale | `inspireId` |
|---|---|---|
| **Oficial modificada** | La parcela del expediente, o una colindante que se añade para editarla | `ES.SDGC.CP` + su referencia catastral |
| **Nueva** | Dibujada, una pieza de F17/F23 materializada, o un trozo de una división | `ES.LOCAL.CP` + referencia del padre con sufijo (O19, `derivacion/identidad.js`) |

## Las decisiones del autor (2026-11-01)

| # | Decisión | Por qué |
|---|---|---|
| **D0** | **El store sigue llevando UNA parcela**: la que está en edición. Las demás viven en `app/conjunto.js`, y cambiar de miembro es apartar la activa y meter la otra | Hay **18 suscriptores** del store de parcela en producción (fase 0). Con D0 casi ninguno cambia; un store de colección los tocaría todos. Es el mismo patrón con el que F11 metió la rama Edificio sin tocar el cuerpo de `crearEstadoVista` |
| **D1** | **Los linderos compartidos se editan por separado**: enganche a los demás miembros y comprobación de cierre del conjunto. Nada de vértices enlazados en la v1 | La edición topológica exige un grafo planar (qué vértices son «el mismo», insertar en un lado compartido, un deshacer que toca dos parcelas) y rompe D0. Si se echa de menos, lo barato es un «mover también el vértice coincidente» que solo actúa cuando las coordenadas son **idénticas**. Para la segregación, la herramienta buena es **«dividir por línea»** (cierre exacto por construcción, como M12 de F17), y va antes que la topología |
| **D2** | **«Descargar cada GML» es un clic por fila**, sin ZIP | La entrega a la Sede es **un** fichero con N miembros (O18). La segunda descarga automática la bloquea el navegador y **no se puede detectar** desde JavaScript (F17); un clic por fila es un gesto del usuario cada vez. El ZIP se canceló en F17 por medición y no vuelve sin un caso que lo pida |
| **D3** | **Si una colindante es miembro, manda lo editado a mano**: queda fuera del recorte automático de F23 | Añadirla al expediente para editarla ya es una decisión jurídica sobre ella. Dos fuentes definiendo la misma finca no las entiende nadie. El cierre del conjunto sigue cazando el solape, así que no se pierde control. La fila lo dice: «editada a mano, no se recorta» |
| **D4** | El nombre en la interfaz es **«Parcelas del expediente»** | Ver §El vocabulario |

## Alcance

**Entra:**

- El modelo con N parcelas y la activa, y el fichero de proyecto en versión 2 **que sigue
  leyendo la 1**.
- Cambiar de miembro **sin perder nada**: el deshacer de cada uno, las colindantes, el
  registro guardado.
- Los demás miembros **dibujados** en el mapa y como **dianas de enganche**.
- Un selector en la cabecera del panel (qué parcela estoy editando, siempre a la vista) y
  el cajón «Parcelas del expediente» sobre el mapa.
- Entradas: añadir una colindante para editarla, materializar las piezas de F17/F23,
  dibujar una parcela nueva, y que un GML o un DXF con varias fincas puedan entrar
  **todas**.
- Salidas: el GML de una fila, y **un** `.gml` con la selección o con todo, validando cada
  miembro, comprobando el cierre y proponiendo el tipo de operación.

**No entra, y se dice:**

| Se aparta | Por qué |
|---|---|
| Vértices compartidos que se mueven juntos | D1 |
| «Dividir por línea» | Es la herramienta natural de la segregación y merece su propia fase: va **después** de esta, que es la que le da dónde poner las piezas |
| El informe de N parcelas | Es F09 otra vez (encuadre, paginación, N literales). F17 ya lo apartó por lo mismo; el informe sigue siendo del miembro en edición y **declara su alcance** |
| El ZIP | D2 |
| Varios edificios | La rama Edificio sigue siendo de uno. Su referencia catastral automática sale de la parcela **principal** del expediente, no de la que esté en edición |
| Ofrecer «Reparcelación» o «Agrupación» como tipo de operación | El IVG tiene **dos** opciones medidas (O20). Inventar una tercera es afirmar lo que no sabemos (regla de oro 9) |

## ⭐ Fase 0 · la auditoría de los suscriptores (2026-11-01)

Medido sobre el árbol de `9581eab`. **18 suscriptores** del store de PARCELA en producción
(los de `estadoEdificio`, `navegacion` y `rama` se excluyen: son otros stores). La columna
que importa es la última: qué tiene que pasar cuando se cambia de miembro, que para todos
ellos **será un cambio de identidad**.

| # | Suscriptor | Qué hace hoy si cambia la identidad | Al cambiar de miembro |
|---|---|---|---|
| 1 | `viewer/index.js:1806` (reencuadre) | Reencuadra **y limpia la capa de colindantes** | ⛔ **No** puede limpiar las colindantes. Reencuadrar solo si el miembro queda fuera de vista |
| 2 | `viewer/sincronizacion.js:1866` (tabla) | Repinta y suelta la selección (`mismaRef`) | ✅ Correcto tal cual |
| 3 | `viewer/edicion.js:1724` (marcadores) | Repinta y suelta la selección | ✅ Correcto tal cual |
| 4 | `app/cableado-diagnostico.js:1405` | **Olvida las vecinas**, cierra el cajón, olvida el diagnóstico | Cerrar y olvidar el diagnóstico ✅. ⛔ Las vecinas **no** |
| 5 | `app/cableado-informe.js:1444` | **Olvida las vecinas** y los descriptivos, cierra el diálogo | Cerrar ✅. ⛔ Las vecinas **no**. Los descriptivos son de cada parcela: guardarlos por miembro ahorra una petición (O8) |
| 6 | `app/cableado-derivacion.js:1448` | Invalida la foto con «Ha entrado otra parcela… los nombres escritos se han perdido» | Invalidar ✅; el texto miente (no ha entrado nada). Fase 4 |
| 7 | `app/cableado-expediente.js:3095` | `refrescarIdentidad` por **`idLocal`**: si cambia, **suelta la identidad** y el siguiente «Guardar» crea un registro **nuevo**. El autoguardado guarda **la parcela del store** | ⛔⛔ **El más grave (H2)** |
| 8 | `app/cableado-comprobacion.js:1469` | Cierra el cajón con cualquier cambio | ✅ Correcto tal cual |
| 9 | `app/cableado-catastro.js:2194` | Refresca el CTA. El token de identidad descarta una respuesta que llegue para **otro documento** | ✅ Comportamiento correcto; el mensaje dirá «otro documento» cuando es otro miembro (H8) |
| 10 | `app/contraste.js:356` | Declara el estado | ✅ |
| 11 | `app/empezar-de-nuevo.js:321` | Refresca el botón | «Empezar de nuevo» tiene que vaciar **el conjunto entero** |
| 12 | `app/main.js:2429` (ficha del pie) | Repinta | ✅ (más el indicador «1 de N») |
| 13 | `app/main.js:2718` (puntos de levantamiento) | Repinta los puntos **de esta parcela** | ⚠️ Abierto (H9) |
| 14 | `app/main.js:3753` (botones de deshacer) | Refresca | ✅ con el historial restaurado (H5) |
| 15 | `app/main.js:5195` («Generar GML») | Valida la parcela del store | ✅ Es el GML del miembro en edición |
| 16 | `app/main.js:6156` (hechos de navegación) | Recalcula los guards | ✅ |
| 17 | `app/main.js:6622` (leyenda) | Refresca | ✅ (gana una entrada para los miembros) |
| 18 | `app/main.js:6949` (bienvenida) | Se cierra con el primer dato | ✅ |

Fuera de la lista, porque **no son suscriptores** sino ganchos que llaman las entradas de
documento: `alCambiarDocumento` y `alCambiarOficial` (`app/main.js:3526-3596`). Reinician
el historial, anuncian «parcela nueva» y **sueltan las colindantes** en sus tres sitios
(dianas, contador y registro). **Un cambio de miembro no puede llamar a ninguno de los dos.**

### Lo que la auditoría ha encontrado

- **H1 · La identidad se parte en dos, y hoy es una sola.** La aplicación pregunta «¿es otra
  parcela?» de seis maneras —`claveDeExpediente` (×3), `claveDeParcela` (`viewer/index.js`,
  `cableado-derivacion.js`), el `idLocal` de `cableado-expediente.js` y `mismaRef` de la
  selección— y todas responden lo mismo porque hasta hoy **parcela y expediente eran la
  misma cosa**. Con esta fase dejan de serlo:
  - **identidad del EXPEDIENTE** → manda en el contexto: las vecinas, el registro guardado,
    el autoguardado, el fondo;
  - **identidad del MIEMBRO** → manda en lo que se mide sobre la geometría en edición: la
    selección, la foto de la derivación, el diagnóstico abierto, el diálogo del informe.

  La regla «otra parcela ⇒ suelta las vecinas» se reescribe como **«otro expediente ⇒
  suelta las vecinas»**. Y no se adivina desde dentro de cada módulo: **se dice desde
  fuera**, que es el patrón que ya usa `viewer/index.js` para el fondo nuevo («un caso que
  este módulo no puede distinguir se dice desde fuera») y `olvidarPorFondoNuevo` en el
  diagnóstico.
- **H2 · Cambiar de miembro partiría el expediente guardado.** `cableado-expediente.js`
  ancla el registro al `idLocal` de lo que hay en el store. Al pasar a otro miembro, el
  siguiente «Guardar» crearía un registro nuevo con **solo ese miembro**, y el autoguardado
  escribiría en el borrador una parcela suelta. Es una pérdida de trabajo **silenciosa**.
  La identidad del registro pasa al conjunto.
- **H3 · Las vecinas se olvidan en cuatro sitios y se adoptan con un quinto filtro.** Capa
  del visor (1), diagnóstico (4), informe (5) y el registro de `alCambiarOficial`. Y el
  diagnóstico y el informe **adoptan** un resultado del Catastro solo si su parcela
  `propia` coincide con la del store: con una colindante en edición, las vecinas de la
  parcela principal **se rechazarían por ajenas**.

  ⛔ **CORREGIDA el mismo día, al escribir la fase 2: el hecho es cierto y la conclusión
  era FALSA.** Que esos cuatro sitios suelten las vecinas al cambiar de parcela **es lo
  correcto**, no un defecto. Las vecinas que trae el Catastro son las de UNA parcela
  (`GetNeighbourParcel` por referencia): diagnosticar la pieza contra las vecinas de la
  matriz declararía «no invade» **sin haber mirado** las suyas, y F23 repartiría su exceso
  contra fincas que no lindan con ella —que es palabra por palabra el defecto que
  `app/main.js#alCambiarOficial` documenta (2026-08-16) y lo que la cabecera de
  `app/colindantes.js` llama inaceptable—. Lo que sí es del expediente son **las demás
  parcelas del expediente**, y ésas se dibujan siempre con su propia capa. Y el filtro de
  adopción por `propia` también acierta: rechaza vecinas pedidas para otra parcela.
  **Consecuencia**: el criterio 2 se reescribe, y la «unión del contexto» de la 3.5 tendrá
  que guardar las vecinas **por parcela**, no mezclarlas.
- **H4 · Las tres copias de `claveDeExpediente` ya no son iguales.** La de
  `cableado-catastro.js:692` **no** pasa la referencia a mayúsculas y las de diagnóstico e
  informe sí. **Hoy no es un defecto vivo**: cada módulo compara solo consigo mismo. Pero
  es la divergencia que las tres cabeceras aceptaban a cambio de no crear una dependencia,
  y esta fase les da un dueño común: la identidad del expediente vive en `app/conjunto.js`.
- **H5 · El deshacer por miembro sale casi gratis.** El historial es un POJO
  `{limite, pila, indice}` que se modifica **en sitio** (`edit/historial.js:54`), y
  `app/main.js` lo usa **53 veces** a través de una sola constante. Al salir de un miembro
  se aparta `{pila, indice}`; al entrar se restaura **en sitio**, igual que `reiniciar` ya
  vacía la pila con `length = 0` para no dejar referencias viejas. Los 53 usos no se tocan.
- **H6 · `fijarColindantes` ya recibe recintos sueltos** (`viewer/edicion.js:1874`), así que
  los demás miembros entran como dianas de enganche con una línea:
  `[...vecinasDeContexto, ...otrosMiembros].flatMap((p) => p.recintos)`.
- **H7 · «Traer colindantes» sustituye, no acumula** (`app/colindantes.js:183`). Con una
  colindante en edición, pulsarlo traería las vecinas **de ésa** y borraría las de la
  principal. En un expediente de varias parcelas el contexto tiene que ser la **unión**,
  sin repetir referencia y sin incluir a ningún miembro.
- **H8 · El token de identidad de `cableado-catastro.js` hace lo correcto.** Una respuesta
  pedida para el miembro A que llega con B en edición se descarta y se dice. Solo cambia
  el texto: hoy diría «otro documento».
- **H9 · Los puntos de levantamiento están DENTRO de la parcela** (F24,
  `puntosLevantamiento`). Al cambiar de miembro desaparecerían del mapa, y son justo las
  dianas con las que se dibuja la parcela nueva de al lado. ⚠️ **Abierto**: lo natural es
  que sean del expediente, pero el modelo de F24 los puso en la parcela con motivo, y se
  decide en la fase 1 con eso delante.

## El diseño

### El modelo y la persistencia

`crearExpediente` cambia `parcela` por **`parcelas: Parcela[]` + `activa: idLocal`**, con
un `parcelaActiva(expediente)` para las lecturas que hoy hacen `expediente.parcela`.
~~⚠️ **16 ficheros de producción** nombran `.parcela`, pero no todos se refieren al
expediente: la cifra real se cuenta en la tarea 1.1.~~ **Contada en la 1.1: 3 ficheros y
10 sitios** (`app/cableado-expediente.js`, `storage/expedientes.js`, `export/proyecto.js`);
los otros trece eran resultados del Catastro, de un parser o un namespace. Invariantes nuevos, y los dos lanzan:

- `idLocal` es **único** entre miembros. El `gml:id` es `xs:ID` en todo el documento
  (O18), y la identidad del miembro sale de ahí.
- `activa` existe en `parcelas`, o es `null` solo si `parcelas` está vacío.

`export/proyecto.js` pasa a la **versión 2** y lee la 1 convirtiendo `parcela` en una lista
de un elemento; sigue sin lanzar nunca con un fichero ajeno (lección de F08).
`storage/expedientes.js` no cambia sus `CAMPOS_REGISTRO` (cambia la forma de `expediente`,
no el registro), pero `NO_SE_GUARDA` sí: las colindantes **de contexto** siguen sin
guardarse; **las que se han añadido al expediente son miembros y se guardan**.

### `app/conjunto.js`

Módulo sin DOM, sin Leaflet y sin red, molde de `app/colindantes.js`. Lleva los miembros en
orden, cada uno con `{parcela, papel, nombre, historialApartado}`, y la **identidad del
expediente**. API prevista: `miembros()`, `activa()`, `activar(idLocal)`, `añadir`,
`quitar`, `subscribe`. Se suscribe al store para que la copia del miembro en edición esté
siempre al día: los demás la necesitan para dibujarla y para engancharse a ella.

### Cambiar de miembro

Un gancho nuevo, `alActivarMiembro`, que **no** es ni `alCambiarDocumento` ni
`alCambiarOficial`:

1. aparta el historial de la que sale y restaura el de la que entra (H5);
2. avisa a los módulos de H1/H3 de que **el expediente es el mismo**, antes del `set`;
3. `estado.set(otra)`;
4. vuelve a fijar las dianas: contexto más los demás miembros (H6);
5. **no** suelta colindantes, **no** anuncia «parcela nueva» y **no** reencuadra a la fuerza.

### La interfaz

⛔ **Ni un píxel nuevo en el panel.** F17 dejó **1,57 px** de margen a 1280×720 (M28), y
pasarse no tiene síntoma: la tabla de vértices encoge sin avisar.

- **El selector en la cabecera del panel**, junto al conmutador Parcela/Edificio:
  `7136910UF1473N ▾ · 1 de 4`. Siempre a la vista, porque editar la parcela equivocada sin
  saberlo es el peor fallo que puede tener esta fase.
- **El cajón «Parcelas del expediente» sobre el mapa**, con el estilo en línea de la zona 3
  (`DESIGN.md` §2), como `viewer/cajon-parcelas.js` de F22: **0 B de CSS**. Una fila por
  miembro con su color, nombre o referencia, papel, superficie y diferencia con la oficial,
  estado (válida / N errores), casilla para la selección y acciones (editar, descargar,
  quitar). Debajo, el contexto, con «Añadir para editar».
- **Clic sobre una parcela del mapa** → «Editar ésta». Se distinguen por dónde están, que es
  la decisión 3 de F22.

### Las salidas

- **Una fila** → el GML de ese miembro. Un clic cada vez (D2).
- **La selección o todo** → **un** `.gml` con N `featureMember` por
  `serializarExpedienteCp`, que ya bloquea el fichero si cae cualquier miembro. Antes de
  escribir:
  - cada miembro pasa `validation/parcela.js` entera;
  - si la selección toca alguna oficial, `comprobarConjunto` con `oficialesExtra` = las
    oficiales de los miembros seleccionados (es exactamente la diana de F23: todo lo
    oficial que el expediente modifica);
  - el tipo de operación se **propone** con `derivacion/operacion.js`, y si la forma no es
    ninguna de las dos medidas sale `null` y el diálogo no deja seguir sin elegir.
- F23 sigue recortando colindantes **que no son miembros** (D3).

## Lo que NO está medido en la Sede, y la fase lo necesita

- **Tres o más miembros.** F17 se cerró con «la Sede cargó todas las parcelas» sin anotar
  cuántas ni el CSV (sigue pendiente en `SPEC.md` §7.1).
- **Fincas de titulares distintos en el mismo envío** (`SPEC.md` §7.1).
- **Una reparcelación o una agrupación (N→1).** El IVG solo ofrece Segregación y
  Subsanación (O20). Si una reparcelación encaja en alguna de las dos es una pregunta para
  la Sede, no para este código.

## Criterios de aceptación

1. Cambiar de miembro y volver **conserva el deshacer** de cada uno, y Ctrl+Z nunca toca un
   miembro que no está en edición.
2. ~~Cambiar de miembro **no suelta** las colindantes en ninguno de sus cuatro sitios
   (H3).~~ **Reescrito en la fase 2 (ver H3 corregida)**: cambiar de parcela **suelta** las
   colindantes del Catastro, que son de la parcela que se deja, y **las demás parcelas del
   expediente siguen dibujadas y como dianas de enganche**.
3. «Guardar», el autoguardado y el fichero de proyecto llevan **el conjunto entero**, y
   cambiar de miembro **no** crea un registro nuevo (H2).
4. Un proyecto de la versión 1 abre como un expediente de un miembro, sin aviso de error.
5. El `.gml` de una selección pasa el **XSD estricto**, y si el conjunto no cierra **no se
   escribe**.
6. **0 px** de coste en el panel a 1280×720 y **0 B** de CSS, medidos con el guion 29.
7. ⛔ **IVG positivo** sobre un expediente real con **tres o más** miembros editados a mano.

## Fases

**Fase 0 · abrir la fase y auditar — hecha el 2026-11-01.** Esta ficha, la fila P13f de
`SPEC.md` y la auditoría de los 18 suscriptores (H1–H9).

**Fase 1 · el modelo, sin interfaz — hecha el 2026-11-01** (suite **8.685 pruebas / 206
ficheros, 0 rojas**, medida sobre un árbol que también lleva cambios sin commitear de otra
sesión; ni una dependencia, ni un byte de CSS; `npm run build` en verde, paquete
**1.307,30 kB** con esos cambios ajenos dentro, así que el delta de esta fase **no está
medido**):

- **1.1** `crearExpediente` devuelve `{tipo, srs, metadatos, parcelas, activa, edificio}`,
  con sus dos invariantes (`idLocal` único, `activa` de una de ellas) y **una sola forma de
  salida**. La forma corta `{parcela}` se admite **solo de entrada**, porque es la de los
  ficheros v1, los registros de IndexedDB y los compositores de `app/`, que **no se han
  tocado**. Con dos o más parcelas `activa` es obligatoria: rellenarla sería elegir por el
  usuario. Nuevos `parcelaActiva`, `parcelaPrincipal` (la primera: la que rotula e indexa
  el registro guardado, aunque se esté editando otra) y `normalizarExpediente`.
  - ⭐ **`normalizarExpediente` sustituye CINCO copias** de la misma llamada campo a campo
    (`storage/expedientes.js` ×3, `export/proyecto.js` ×2). F25 tenía que cambiar las
    cinco a la vez, y la que se quedara atrás **perdería parcelas al guardar**. Tiene
    guardián de que no vuelven.
  - Las **54 lecturas** de `expediente.parcela` de la suite (6 ficheros) pasan a
    `parcelaActiva(…)`. Fueron exactamente las 42 rojas del primer pase, y ninguna más.
- **1.2** El proyecto pasa a la **versión 2** y la 1 se sigue abriendo **sin avisar de
  nada**: `parcela` entra en `CLAVES_EXPEDIENTE_HEREDADAS`, una lista que crece y no se
  limpia (como las rutas retiradas de `app/navegacion.js`). Ida y vuelta medida con tres
  parcelas: orden, activa y oficial congelada.
  - ⛔ **`NO_SE_GUARDA` NO se ha tocado, y se desvía del plan a propósito.** La frase nueva
    —«las colindantes que se añaden al expediente sí se guardan»— describiría algo que hoy
    no se puede hacer, y esa lista existe para decir lo que hace ESTE código. Pasa a la
    tarea **3.1**, que es la que crea «Añadir para editar».
  - ⛔ **Y una guarda temporal que el plan no tenía**: `app/cableado-expediente.js`
    **rechaza** un expediente de varias parcelas en sus tres puertas (recuperar, borrador
    y fichero de proyecto) con `mensajeVariasParcelas(n)`. Abrir solo la que estaba en
    edición era lo cómodo, y el siguiente «Guardar» o el autoguardado habrían escrito el
    expediente con UNA y **perdido las demás sin decirlo**. La aplicación está publicada
    desde `main`, así que esto no es teórico en cuanto exista un fichero v2 con dos. Sus
    dos pruebas **se ponen rojas con la guarda quitada** (medido). Desaparece en la fase 2.
- **1.3** `edit/historial.js#apartar` y `#restaurar`: clonan **en las dos fronteras**, como
  el resto del módulo; `restaurar` es **en sitio** y **atómico**, y respeta el `limite`
  del historial que recibe. La `geometriaOficial` que un reencuadre comparte entre N
  snapshots **sigue siendo una** en la copia (medido: `structuredClone` de la pila entera,
  no snapshot a snapshot).
- **1.4** `app/conjunto.js` con su suite (`test/app/conjunto.test.js`), que incluye **el
  recorrido de la fase 2 con el historial de verdad**: editar A, pasar a B, editar B,
  volver a A, y Ctrl+Z **nunca llega a B**. Decisiones de contrato:
  - **No toca el store ni el historial, y no se suscribe a nada.** Quien cambia de parcela
    aparta, activa, restaura y hace el `set`. Así se prueba en Node, y no ata el orden de
    los suscriptores del store, que ya decide cosas (el reencuadre de `viewer/index.js`).
  - `actualizarActiva` **devuelve `false` y no lanza** si lo que llega no es la activa:
    se llamará desde un suscriptor del store, y `crearEstadoVista` **no aísla** a sus
    suscriptores, así que un `throw` dejaría sin notificar a los que vienen detrás.
  - **La que está en edición no se puede quitar**: hay que activar otra antes.
  - ⚠️ **Sin llamante en producción hasta la fase 2**, como `derivacion/` en las fases 1–3
    de F17: hoy no entra en el paquete.
- **1.5 · H9, decidido: los puntos de levantamiento SIGUEN en la parcela.** F24 los metió
  ahí porque el modelo solo tenía un documento, no por una razón contra el expediente.
  Moverlos rompería los caminos que F24 cerró (`camposInvariantes`, el hecho `puntos`,
  `componerParcelaMedida`) a cambio de nada que la fase 2 no resuelva más barato: **la capa
  y las dianas pintan la UNIÓN de los puntos de todos los miembros**, y una parcela nueva
  dibujada al lado los ve aunque no sean suyos.

**Fase 2 · cambiar de parcela — hecha el 2026-11-01** (suite **8.709 pruebas / 208
ficheros, 0 rojas**; ni una dependencia, ni un byte de CSS; probado en Chromium a
1280×720 con un proyecto de dos parcelas metido por la zona de fichero, consola limpia):

~~2.1 La identidad del expediente en `conjunto.js` y el aviso «mismo expediente» a los
módulos de H1/H3. Las tres copias de `claveDeExpediente` dejan de decidir sobre las
vecinas (H4).~~ ⛔ **Se hizo MENOS de lo planeado, y lo planeado estaba mal.** Ver H3
corregida, abajo: la mayoría de los módulos de H1 tienen que seguir tomando el cambio de
parcela **por lo que es para ellos**, una parcela distinta. El único que no puede es el
expediente guardado, y a ése se le dice desde fuera:

- **La marca `cambiandoDeParcela`** (`app/main.js`, paso 2 bis), levantada solo alrededor
  del `set` del cambio. Es el patrón «se dice desde fuera» que `viewer/index.js` ya usa
  para el fondo nuevo, y **sustituye al reordenamiento de suscriptores** que se pensó
  primero: con la marca, el orden en que se notifican deja de decidir nada.
- **El conjunto sigue al store** (paso 2 bis): un `idLocal` que el expediente no tiene es
  un documento nuevo y abre un expediente de una. Así las seis puertas de entrada de hoy
  —y la que se añada— abren su expediente sin acordarse. Las dos que abren uno de varias
  (recuperar y proyecto) llaman a `conjunto.abrir` ANTES del `set`.
- **2.2 · `app/cambio-de-parcela.js`** (nuevo, fuera del plan): el corazón de
  `activarParcela`, sacado de `main.js` para poder probar el ORDEN sin montar la
  aplicación —apartar, activar, restaurar, y el `set` con la marca—. Su prueba mira lo
  que ve cada suscriptor EN el instante de la notificación.
  - ⛔ **Hallazgo al escribirlo: la pila de deshacer es UNA para las dos ramas**
    (`main.js`, paso 13: «Ctrl+Z es UNA tecla»). Repartirla por parcelas con instantáneas
    del edificio dentro haría que, al volver, un Ctrl+Z devolviera **un edificio de otro
    momento al otro store** sin que se viera. Si la pila lleva alguna, el cambio empieza
    de cero y lo dice (`MENSAJE_DESHACER_COMPARTIDO`).
- **2.3 · H2 resuelto**: `cableado-expediente.js` recibe `conjunto` y `esCambioDeParcela`.
  Guardar, el borrador y el fichero del disco llevan **todas** las parcelas (con la del
  store en su sitio, la más reciente); la identidad del registro y el vínculo con el
  fichero del disco **sobreviven** al cambio; el nombre de los ficheros sale de la
  **principal**. La guarda de la fase 1 solo actúa sin conjunto. Prueba central: guardar,
  cambiar, editar y guardar → **UN registro con las dos**; y su contraprueba, el mismo
  recorrido sin la marca → dos registros.
- **2.4 · `viewer/parcelas-expediente.js`** (se iba a llamar `viewer/miembros.js`, pero
  `viewer/senal-miembro.js` ya usa «miembro» para las parcelas de un GML comprobado):
  la capa de las que no están en edición y el selector «Parcela en edición».
  - ⛔ **El selector va SOBRE EL MAPA, no en la cabecera del panel** (desviación de
    §La interfaz): allí gastaría un renglón en un panel que F17 dejó a 1,57 px de su
    suelo a 1280×720, con síntoma mudo, y ese margen no se ha remedido desde el rework.
    Sobre el mapa: 0 px de panel, 0 B de CSS. **Solo aparece con dos o más** y se oculta
    en la rama Edificio. Medido en Chromium: se apila bajo el zoom (402,180 · 306×34 px)
    y no pisa nada.
  - ⛔ **Las otras parcelas NO se eligen con un clic en el mapa**: ese clic es, a menudo,
    el de dibujar la pieza nueva o el de insertar un vértice en el lindero compartido.
    Llevan su emergente y el clic sigue llegando al mapa (`bubblingMouseEvents`,
    medido como en `viewer/colindantes.js`).
  - Color: `COLOR_USUARIO` discontinuo. Ningún color nuevo.
  - **Elegir otra REENCUADRA el mapa sobre ella** (lo hace el visor, como con cualquier
    parcela distinta). Se dejó así a propósito: desde un selector, «llévame a ella» es lo
    útil. ⚠️ Puede molestar a quien esté ajustando un lindero compartido muy de cerca:
    es pregunta para el checklist humano, no para el código.
- **2.5 → fase 3** (la unión de los puntos de levantamiento): en esta fase no hay forma
  de crear la segunda parcela que los necesitaría. **El cajón con casillas → fase 4**: su
  razón de ser es la exportación por selección.
- ⚠️ **Visto en el navegador y apuntado para la fase 3**: el rótulo de procedencia de la
  cabecera (`rotuloDelDato`) dice «Parcela del Catastro» de cualquier parcela con
  `origen: WFS` que entre después del arranque, y una pieza clonada de la matriz lo
  hereda. Con piezas de verdad (dibujadas o derivadas) el origen será otro, pero el
  rótulo tiene que contemplar el cambio de parcela.

**Fase 3 · las entradas.** Partida en dos tandas con su commit cada una.

**Tanda 3a — hecha el 2026-11-01** (suite **8.720 pruebas / 208 ficheros, 0 rojas**; ni
una dependencia, ni un byte de CSS; recorrida en Chromium a 1280×720 con una petición
real al Catastro, consola limpia):

- **3.0 · dos orígenes nuevos en el modelo**, `DIBUJO` y `DERIVACION`, con su texto de
  procedencia (`app/contraste.js#PROCEDENCIA`, cuyo guardián recorre el catálogo) y su
  rótulo de cabecera: «Parcela nueva · dibujada aquí» y «Parcela nueva · sobrante del
  lindero». Eso cierra lo visto en la fase 2: la cabecera ya no dice «del Catastro» de
  una pieza. ~~La unión de los puntos de levantamiento~~ → **pasa a la tanda 3b**.
- **3.1 · «Añadir parcela» → una colindante.** El control del mapa gana «Añadir parcela
  ▾» —un menú de BOTONES, no opciones del `<select>`: con el teclado, las flechas en un
  `<select>` cerrado disparan `change` en Chrome y cada flecha añadiría una parcela— y
  «Quitar esta parcela». Se ofrece **lo que se ve**: `viewer/colindantes.js#vecinas()`
  devuelve lo pintado, y solo las que tienen referencia catastral (una finca oficial sin
  referencia no se puede identificar ante la Sede). Entra con su contorno como trabajo Y
  como oficial, `origen: WFS`, y se pone en edición. **Medido con datos reales**: el
  Catastro devolvió 4 colindantes de 9398516VK3799G, el menú las ofreció, y
  9398501VK3799G entró con sus 31 vértices y su parcelario encendido.
  - ⚠️ Su «Superficie catastral» sale «No consta»: `GetNeighbourParcel` no trae el
    `areaValue` y la vecina traducida no lo guarda. **Deuda**, no defecto: lo que se
    afirma es que no consta, y es verdad.
  - `NO_SE_GUARDA` dice ya lo que hace el código: las colindantes que solo se ven no se
    guardan; las añadidas sí.
  - ⚠️ **El control aparece ya con UNA parcela** (solo «Añadir parcela»), y es un cambio
    deliberado sobre la fase 2: sin una puerta visible, la función no existe para quien
    no sabe que está.
- **3.3 · «Dibujar una parcela nueva».** El dibujo de F18 en un modo `'nueva'`: el
  recinto cerrado NO toca la parcela en edición; crea otra (`DIBUJO`, `parcela-nueva-N`)
  y la pone en edición. Con el mismo enganche (a la parcela en edición, a las otras, a
  las colindantes y a los puntos). Cancelar con Escape no deja el modo colgado: el dibujo
  avisa «ya no dibujo» ANTES de entregar el recinto (medido en `viewer/dibujo.js`), así
  que el destino se recoge en ese aviso y se consume al cerrar.
  - ⛔⛔ **DEFECTO REAL destapado en el navegador, y ninguna prueba lo habría visto**: la
    primera esquina de cada parcela dibujada caía ~100 m al noroeste, **encima del
    menú**. Leaflet 1.9 **no detiene el `click`** de un control: el mapa sube por
    `parentNode` buscando la marca de `disableClickPropagation` (`Map#_isClickDisabled`).
    Al elegir la opción, su oyente vaciaba el menú (despegando el botón del DOM) y
    empezaba el dibujo, todo dentro del mismo clic; cuando el evento llegaba al mapa, el
    botón ya no tenía padre, la marca no aparecía, y el dibujo recién empezado recibía
    esa pulsación como su primer vértice. Corregido cerrando el menú **sin vaciarlo**, y
    con prueba que se pone roja con el defecto reintroducido (medido).
  - ⛔ **Y el reencuadre, que la fase 2 dejó para el checklist, aquí se decidió con la
    prueba delante**: poner en edición un triángulo de 11 m recién dibujado llevaba el
    mapa a escala de 1 m. `viewer/index.js#sinReencuadrar(fn)` suspende el reencuadre
    durante el cambio (las colindantes se sueltan igual). Restaurar la vista DESPUÉS se
    probó primero y **no funciona**: `fitBounds` anima el zoom y termina más tarde que
    cualquier `setView`. Para elegir otra parcela en el selector el reencuadre se queda.
- **Quitar esta parcela** (no estaba en el plan y sin él un error al añadir no tenía
  vuelta): dos pulsaciones, porque **no se deshace con Ctrl+Z**; primero pone otra en
  edición (el conjunto no deja quitar la activa) y lo dice. Un armado que sobrevive a un
  cambio de parcela se desarma: no se quita la que no es.

**Pendiente, tanda 3b:**
- 3.0 bis · La unión de los puntos de levantamiento en la capa y en las dianas (H9).
- 3.2 Materializar las piezas de F17 y los vecinos de F23 como miembros.
- 3.4 Un GML con varios miembros (hoy el cajón de F08 obliga a elegir uno) y un DXF de F22
  pueden entrar enteros.
- 3.5 El contexto acumula (H7).

**Fase 4 · las salidas.**
- 4.1 Descargar una fila.
- 4.2 La selección → un `.gml`, con validación, cierre y tipo de operación.
- 4.3 D3 en `derivacion/vecino.js`: los miembros quedan fuera del recorte automático.
- 4.4 Los textos de H8 y de la foto de la derivación (suscriptor 6).

**Fase 5 · los gates.** Guion `29-parcelas-del-expediente.js` a 1280×720 y 1440×900,
`CHECKLIST-HUMANO.md` con su punto bloqueante (que un técnico sepa **qué parcela está
editando** sin que se lo expliquen) y la verdad externa del criterio 7.

## Riesgos

- **Que un suscriptor nuevo nazca sin saber que hay dos identidades.** Hoy son 18; la
  auditoría de esta ficha caduca con el siguiente. El guardián que lo cubra se decide en
  la fase 2.
- **El presupuesto del panel.** El selector entra en la cabecera del panel, junto al
  conmutador. ⚠️ **La holgura de ahí NO está medida**: los 46,11 px que cita
  `app/rama.js` son de `.gml-chips`, en la barra, y la propia cabecera de ese módulo dice
  que desde el 2026-10-25 «ya no gobiernan nada». Se mide en la fase 2 antes de poner el
  selector; lo que no quepa va al cajón, no al panel.
- **Un expediente que se descarga a medias.** Si la selección deja fuera un miembro sin el
  que el conjunto no cierra, el fichero no se escribe y se dice cuál falta, con su
  superficie (la doctrina de la pieza excluida de F17).

## Deuda declarada

- ⏳ El CSV del IVG que cerró F17 sigue sin anotar en `SPEC.md` §7.1, y esta fase depende de
  ese mismo hueco (tres o más miembros).

## Dónde encaja

**P13f, Bloque B**, detrás de F24. Es la última pieza del grupo de F17 y F23: aquéllas
enseñaron a la aplicación a **emitir** varias parcelas derivadas, y ésta le enseña a
**editarlas**. Va antes que «dividir por línea», que necesita un sitio donde poner las
piezas.

## Referencias

- `spec/feature-17-expediente-varias-parcelas.md` — el sobre de N miembros, el cierre, la
  identidad de las altas y el tipo de operación.
- `spec/feature-23-colindante-recortado.md` — `app/colindantes.js`, `oficialesExtra` y el
  marco «la medición es la referencia».
- `spec/feature-22-parcelario-dxf.md` — el cajón de elegir sobre el mapa.
- `spec/SPEC.md` §3 (O18, O19, O20), §7.1 y §7.2.
- `app/rama.js` — el precedente de cambiar el documento activo sin tocar el store.
