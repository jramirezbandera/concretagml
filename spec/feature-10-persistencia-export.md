# F10 · Persistencia y exportación

**Fase:** 10 · **Prioridad:** P10 · **Riesgo:** Bajo · **Depende de:** F04 · **Habilita:** F11.
~~**Ficheros:** `storage/` (expedientes), `export/dxf.js`.~~
**Ficheros (2026-08-03, al terminar):** **nueve módulos nuevos** de producción y
**ocho tocados**, repartidos en cuatro capas — `export/` es un **directorio nuevo**
con cuatro ficheros y barrel propio, `storage/` gana tres, y `app/` dos. Ver
«Ficheros que la fase creó y tocó de verdad».

## Objetivo

Guardar expedientes en IndexedDB con autoguardado y cerrar el círculo con el CAD
exportando a DXF (además del GML de F04).

**Y una cosa que la ficha original no decía y es la mitad del valor de la fase:**
hasta aquí la aplicación **no recordaba nada**. Recargar la pestaña tiraba el
trabajo entero — no había ni una línea de almacenamiento, ni un flag de sucio, ni
un `beforeunload` en todo el proyecto. F10 es también donde `crearExpediente`
—escrito en F00 y cuyo **único llamante en todo el repo era `test/contrato.test.js`**—
estrena llamante en producción.

## Alcance

### Expedientes (`storage/`, con `idb`)

- Store `expedientes` (keyPath `id`, índices `actualizado`/~~`refCatastral`~~
  **`refcat`** — ver **M1**). Guardar (`put`), listar (~~`getAllFromIndex`~~ **con
  el orden invertido a mano: ver M2**), recuperar, **duplicar** (`structuredClone` +
  nuevo id), **autoguardado** del trabajo en curso (debounce 1–3 s → **2 s**).
- Migraciones secuenciales en `upgrade` con `if(oldVersion<N)`; callbacks
  `blocked/blocking/terminated` para multipestaña.
- **Cuota:** `navigator.storage.persist()` al arrancar ~~(evita desalojo)~~
  **⛔ MEDIDO: devuelve `false` y no evita nada — ver M3** y
  `navigator.storage.estimate()` (vigilar `usage/quota`); escrituras en `try/catch`
  de `QuotaExceededError` con degradación (purgar caché de GML antiguo).

### Exportación (§13.2)

- **GML** — salida principal (ya en F04).
- **DXF** (`export/dxf.js`) — llevarse a CAD la **parcela oficial junto a la
  editada, en capas separadas**, para que el perito compare.
- **PDF** — el informe (F09). **TXT** — listado de coordenadas.
- ⭐ **Fichero de proyecto `.json` — ALCANCE NUEVO.** No estaba en esta ficha, ni en
  `SPEC.md`, ni en el dossier: entra por decisión de la entrevista de arranque. Su
  razón, en una frase: **sin backend y sin cuentas, IndexedDB es una caja fuerte sin
  puerta**. Borrar los datos del sitio se lo lleva todo, y no hay ninguna forma de
  mandarle un expediente a un compañero, de hacer una copia de seguridad ni de
  seguir el trabajo en otro equipo. Es el único de los tres ficheros de salida que
  la aplicación sabe **volver a abrir**.

## Las cuatro decisiones de la entrevista de arranque

| # | Decisión | Consecuencia |
|---|---|---|
| 1 | **Entran los TRES formatos**: DXF (criterio 3), TXT de coordenadas y **fichero de proyecto `.json`** | El `.json` es alcance nuevo (arriba). El TXT estaba en el «Alcance» de esta ficha y **en ninguno de sus criterios**: entra como **criterio 5** en vez de quedarse en tierra de nadie |
| 2 | **El autoguardado OFRECE, no impone** | La app arranca como siempre. Si hay trabajo guardado, aparece un renglón con su referencia y su antigüedad, y un botón «Recuperar». Nada se mueve bajo los pies del usuario — **medido en navegador real**: tras recargar con una edición autoguardada, la pantalla sale con la geometría de partida y la oferta en el panel |
| 3 | **Botón menudo + `<dialog>` «Expediente»** | **Quinta fase seguida a coste 0 px** en el panel, y esta vez con la holgura medida: la fila del rótulo mide **15,94 px** con los dos botones dentro, la caja de vértices sigue en **267 px**, y **quedan 21 px** antes de que la fila se parta (8 de ellos son el `gap`) ⇒ «Expediente» **no puede crecer** |
| 4 | **Las exportaciones viven en ese mismo diálogo** | Un solo sitio para todo lo que entra y sale del expediente. «Generar GML» se queda en el pie: es la salida principal, no una salida lateral |

## ⛔ Lo que la implementación MIDIÓ y esta spec (o el plan de la fase) decía de otra forma (2026-08-02/03)

Todo lo de esta tabla está comprobado en el código y fijado por un test, salvo donde
se diga que la medición es de navegador real o de un oráculo externo. Manda lo
medido (regla de oro 8).

| # | Esto decía | ✅ Medido |
|---|---|---|
| **M1** | Índice **`refCatastral`** (esta ficha, y dossier §4.2) | **El campo se llama `refcat` desde F00** (`model/parcela.js`). Un índice con el otro nombre **no extraería clave ninguna** de un POJO de parcela — IndexedDB simplemente no indexa el registro, que se vuelve **invisible en la lista sin que nada falle**—, o peor: alguien lo «arreglaría» copiando el campo con otro nombre y habría **dos nombres para la misma cosa** viajando por el proyecto. Ya estaba diagnosticado por escrito en `storage/bd.js`. Hay un test que exige `refcat` y **prohíbe** `refCatastral` |
| **M2** | «listar (**`getAllFromIndex`**)» | ⛔ **Devuelve el MÁS ANTIGUO PRIMERO.** Medido en la fase 0 con 200 registros fabricados hacia atrás en el tiempo: los tres primeros salieron `EXP-199, EXP-198, EXP-197`. IndexedDB recorre un índice en orden ascendente de clave, y `actualizado` es una fecha ISO. La ficha decía «`getAllFromIndex`» a secas y **ese orden habría pasado por bueno sin que nadie lo mirase dos veces**: sale una lista plausible, solo que del revés. Se invierte a mano, con la nota al lado. **Y se cuenta el almacén además de leer el índice** (`count()`): un registro sin `actualizado` no se indexa y sería invisible; comparar los dos números convierte ese silencio en un aviso |
| **M3** | «`navigator.storage.persist()` al arrancar (**evita desalojo**)» | ⛔ **Devuelve `false`, en 0 ms y sin preguntar nada.** Medido en la fase 0 y confirmado en la corrida de cierre del guion 12: igual en `localhost:5173` que en el `https://jramirezbandera.github.io/concretagml/` publicado. Es el comportamiento esperado de Chrome —la persistencia se concede a sitios instalados, marcados o con interacción acumulada— pero **la ficha promete algo que no ocurre**. Consecuencia: se pide igual (en cuanto el usuario marque la página, la MISMA llamada empezará a devolver `true`) y **el resultado SE DICE**: en el acuse de cada guardado y en el renglón del diálogo. Que un Chrome con historial lo conceda **no está medido** → §11.1 del checklist |
| **M4** | (no previsto) | ⭐ **`structuredClone` no preserva `Object.freeze`, y está MEDIDO en navegador real, no deducido de la documentación.** `Object.isFrozen(geometriaOficial)` vale `true` antes del `put` y **`false` después del `get`**. Sin rehidratar, un expediente recuperado volvería con la geometría oficial **descongelada** y la barrera de la regla de oro 2 desaparecería **en silencio**. Por eso `recuperar()` **nunca devuelve el registro crudo**: lo pasa por `crearExpediente`, que revalida, recopia y vuelve a congelar. El guion 12 lo vuelve a comprobar en cada corrida sobre el registro crudo |
| **M5** | Criterio 4: «`QuotaExceededError` degrada sin romper» | ⛔ **No se puede provocar de verdad en tiempo razonable, y fingir que sí habría sido peor que declararlo.** Medido en la fase 0: la cuota real de este origen es **1.809,3 MB** y un expediente realista (15 vértices + geometría oficial) ocupa **1.488 B de JSON** y **0,844 kB de `usage`** —IndexedDB lo guarda más compacto que su JSON—, o sea que **caben ~1,31 millones** y llenarla son ~1,3 millones de escrituras. Se prueba con un doble que rechaza con `QuotaExceededError`, que es exactamente lo que hace el navegador (se lee lo de antes, no se escribe lo nuevo), **y queda declarado que es una simulación nuestra**. Y lo que de verdad puede llenar la cuota **no son los expedientes: es la caché de F05** — que es justo por lo que la degradación purga esa caché y no otra cosa |
| **M6** | **O12 al pie de la letra**: `0=LWPOLYLINE`, `8=capa`, `90`, `70=1`, `10/20`, con `$ACADVER AC1015` y tabla `LAYER` | ⛔ **Ese fichero NO ABRE.** Oráculo externo: **`ezdxf` 1.4.4**. Escrito exactamente como manda el override, `ezdxf` lanza `DXFStructureError: missing 'AcDbPolyline' subclass in LWPOLYLINE`. Faltan los **marcadores de subclase `100=AcDbEntity` y `100=AcDbPolyline`**, que el override no menciona y que los tres DXF reales del repo sí llevan. Ablación sobre 12 piezas: **solo TRES sostienen el peso** — los dos `100` y el **handle `5` en la cabecera de `TABLE LAYER`** (sin él el auditor «arregla» el fichero). Todo lo demás (handles de entidad, `330`, `$HANDSEED`, `$INSUNITS`, `6=CONTINUOUS`, `390`, y CRLF frente a LF) sale con 0 errores y 0 arreglos |
| **M7** | «prueba de ida y vuelta contra `parsers/dxf.js`» como red de seguridad | ⛔ **Habría salido VERDE con un DXF que no abre en ninguna parte.** Ese mismo fichero del M6 lo leyó nuestro parser tan feliz: **2 anillos, 4+4 vértices, coordenadas exactas, cero detecciones**. Tercer ejemplar de la misma familia que F03 fase 4 y F08 —un test que miente en verde porque mide contra nosotros mismos—. **El oráculo pasa a ser `ezdxf`; nuestro parser es el SEGUNDO, no el primero**, y así está escrito en su test |
| **M8** | (no previsto) | ⭐ **La trampa gorda del criterio 3: sin la sección `TABLES`, ezdxf lee el fichero, ve las dos polilíneas y el auditor da 0 errores y 0 arreglos — pero LAS CAPAS NO EXISTEN.** Las entidades dicen `PARCELA_OFICIAL` y `PARCELA_EDITADA`, y `e.dxf.layer in doc.layers` devuelve `False` para las dos. El criterio 3 entero fallaría sin que nada avisara. Por eso el test **afirma que las capas están EN LA TABLA**, no que las entidades las nombran, y el guion 12 lo vuelve a comprobar sobre los bytes que bajan |
| **M9** | Contrato E del plan: `txtDeParcela(...) => string` | ⛔ **El listado de coordenadas NO se puede volver a cargar en esta aplicación, y está MEDIDO contra nuestro propio parser.** 15 vértices entran, **18 pares salen** de `parsers/txt.js` y **ninguno es correcto**: la primera columna es el **número de vértice**, no la X, y un lector de dos columnas la toma por coordenada — se cuelan la fecha (`3, 8`), la referencia catastral (`9398516, 3799`) y las medidas del pie. Se decidió **conservar el formato humano** —un listado sin referencia ni SRS es el fichero contra el que `geo/huso.js` existe, y sin vértices numerados no sirve para replantear— y **declararlo en el propio fichero** (`AVISO_NO_REIMPORTABLE`). Lo que justifica declarar en vez de doblegar el formato es la **segunda** medición: `detectarHuso` devuelve `null` para los cuatro pares envenenados, así que el fallo sería **ruidoso, no silencioso**. La función devuelve un objeto (`{texto, detecciones, resumen, nVertices}`) y no una cadena |
| **M10** | (no previsto) | ⛔ **`metadatos.idDocumento` NO se reutiliza en el informe, contra lo que el plan de la fase prometía.** Dos motivos concretos: (a) el identificador del informe **lleva dentro el instante de emisión** (`CG-<refcat>-<AAAAMMDD>-<hhmmss>Z`, `report/firma.js`), así que reutilizar uno guardado estamparía en un PDF de hoy la hora de la semana pasada — la matrícula mentiría sobre cuándo se hizo ese papel—; y (b) **un identificador guardado dentro del expediente sobrevive a `duplicar`**, que hace `structuredClone` y cambia **solo la clave**: la copia llevaría dentro la identidad del original apuntando a otro registro, sin que nada fallara. Hay un test que fija ese segundo hecho sobre el almacén real. Lo que sí cambia, y es la mitad de la promesa que se sostiene: **`creado` y `modificado` dejan de reestamparse a «ahora»** en cada derivación, así que un `.json` exportado dice de verdad cuándo se empezó ese trabajo |
| **M11** | (no previsto) | ⭐ **El autoguardado no se puede armar al arrancar.** El borrador es **un** registro con clave reservada, y cada disparo del debounce lo pisa: con el autoguardado vivo desde el primer instante, **la primera tecla del usuario borraría el trabajo de la sesión anterior antes de que le diera tiempo a ver la oferta**, y el síntoma sería que la oferta desaparece sola. Así que mientras hay oferta pendiente el autoguardado está **en espera** —y el primer cambio en ese estado lo dice una vez por el panel—, y al recuperar o descartar **vuelca lo que hubiera cambiado durante la espera**, que es lo que convierte «no pisar» en «no perder» |
| **M12** | (no previsto) | ⛔ **El aviso de persistencia al arrancar le quitaba 52 px a la caja de vértices, en cada carga y para siempre.** Lo destapó la primera corrida del guion 12 **con un expediente ya guardado**: 267 → **215 px**, por debajo del suelo de 220 que este proyecto lleva cinco fases defendiendo. A diferencia de la oferta del borrador —que se resuelve y desaparece—, ese aviso **volvía siempre**. Corregido quitando la tercera repetición, **no callando el hecho**: se sigue diciendo en el acuse de cada guardado y en el renglón del diálogo al abrirlo. Con test que lo fija |
| **M13** | (no previsto) | **Dos mensajes de usuario llevaban Markdown crudo** (`**Sigue guardado**`, `**No se ha abierto nada**`) y el panel de avisos pinta `textContent`: en pantalla salían **los asteriscos**. Lo vio el navegador, no la suite. Corregido quitando la sintaxis y **no añadiendo un intérprete de Markdown**: enfatizar con palabras siempre funciona, y meter marcado en un canal que muestra nombres de fichero abriría una superficie de inyección. Con guardián |
| **M14** | «`export/dxf.js`» (dos ficheros en total, con `storage/`) | **Son nueve módulos nuevos y ocho tocados.** `export/` es un **directorio nuevo** con cuatro ficheros y **barrel propio**, que entra en el barrel raíz como espacio **`exportar`** — porque `export` es palabra reservada y `export * as export from …` es un `SyntaxError`. Ver «Ficheros» |
| **M15** | (no previsto) | **Un `element.click()` no mueve el foco**, y por poco cuesta una acusación falsa: el guion 12 denunciaba que el diálogo no devolvía el foco al botón al cerrarse con `Escape`. No era cierto — en un navegador de verdad un clic de ratón sí lo deja ahí, pero el guion no puede hacer gestos de ratón (GUION §0). Corregido **en el guion** (`.focus()` antes del `.click()`), no en producción. **Un guion que acusa a producción de un artefacto de su propia instrumentación es peor que no medir** |
| **M16** *(2026-08-05, POSTERIOR AL CIERRE)* | Criterio 3: «abre en CAD con las dos capas separadas», dado por bueno con M6+M8 | ⛔ **El DXF que esta aplicación exportaba dejaba ZWCAD 2023 EN BLANCO Y BLOQUEADO, y los tres guardianes daban verde.** El M6 acertó en el diagnóstico y falló en la conclusión: emitir `LWPOLYLINE` obliga a declarar R2000, **y declarar R2000 obliga a emitir todo su esqueleto** — `CLASSES`, tabla `BLOCK_RECORD`, `BLOCKS` con `*Model_Space` (quien POSEE a las entidades) y `OBJECTS` con el diccionario raíz—. No emitíamos ninguno. ⚠️ **Por qué ezdxf lo aprobaba: rellena por su cuenta las tablas que faltan al cargar**, así que preguntarle si el fichero las traía responde por su modelo, no por el fichero — la misma familia del M7, un oráculo que mide otra cosa. **Lo destapó un usuario abriendo el fichero**, no una máquina. Corregido pasando a **R12 (`AC1009`) con `POLYLINE`/`VERTEX`/`SEQEND`**, que es lo que el propio Catastro entrega (`ConsultaMasiva_.dxf`) y lo que se verificó abriendo tres candidatos en su ZWCAD. Segundo hallazgo del mismo caso: **faltaban `$EXTMIN`/`$EXTMAX`**, así que la vista abría en el 0,0 y la parcela estaba a 4,4 M de unidades — pantalla en blanco con el fichero sano. Ver `GUION.md` §24 |

## Criterios de aceptación

1. **Guardar → listar → recuperar → duplicar un expediente conserva el modelo; el
   autoguardado dispara con debounce.** ✅ `test/storage/aceptacion-f10.test.js` §1,
   con el orden de la lista (M2), la exclusión del borrador y la coalescencia
   medida: **15 cambios → 1 escritura**, y lo escrito es el último.
2. **Una migración de versión antigua no pierde datos.** ✅ §2, fabricando una base
   parada en la **versión 2** (la de F09, antes de que existieran los expedientes)
   con un registro en cada uno de los tres almacenes de entonces, y subiéndola.
   Sobreviven los tres, aparece `expedientes` **con sus dos índices**, y sobre esa
   base ascendida se guarda y se lista de verdad.
3. ⛔ **PARTIDO.** «El DXF exportado **abre en CAD** con las dos capas separadas;
   snapshot estable.»
   - **La mitad medible, aquí:** snapshot de bytes estable (`toMatchFileSnapshot`),
     las dos capas **en la TABLA** (M8), ida y vuelta contra `parsers/dxf.js`, y el
     artefacto versionado comprobado como artefacto (CRLF sin LF sueltos: el defecto
     de `.gitattributes` que F09 ya pagó). Más `ezdxf` como oráculo externo, fuera
     de la suite.
   - **La mitad que ninguna máquina de este proyecto puede firmar:** que abra en
     AutoCAD con las dos capas **seleccionables por capa** → **§11.4 del checklist
     humano, punto BLOQUEANTE**. Mismo reparto que el PDF en tres lectores de F09, y
     con un motivo medido: **nuestro propio parser aprueba ficheros que ningún CAD
     abre** (M7).
4. **`QuotaExceededError` degrada sin romper (purga caché, avisa).** ✅ §4, con la
   simulación declarada (M5), el reconocimiento por `name`/`code` **y jamás por el
   texto del mensaje**, y ⭐ la comprobación de que **la purga no alcanza ni los
   expedientes ni el pie de firma**: viven en la misma base y no son caché.
5. ⭐ **NUEVO — el listado de coordenadas para replanteo.** ✅ §5: cabecera con
   referencia, huso, fecha y número de vértices; **coma decimal española** (el
   defecto de F09 fue justo el contrario); y el aviso, medido, de que no se puede
   volver a cargar aquí (M9).
6. ⭐ **NUEVO — el fichero de proyecto `.json`.** ✅ §6: ida y vuelta completa, lo
   leído vuelve **congelado**, el sobre se declara dentro del fichero, una batería
   de ocho ficheros rotos que **nunca lanzan**, una versión posterior que se lee con
   aviso, y el recorrido de verdad: almacén A → proyecto → texto → **almacén B**.

## Desviaciones deliberadas del enunciado, con su motivo

Ocho se declararon **antes** de escribir una línea; las tres últimas salieron al
medir.

1. **El índice se llama `refcat`.** → M1.
2. **El fichero de proyecto `.json` es alcance NUEVO.** Añadido a esta ficha, a
   `SPEC.md` §1 y §5, y al §13.2 anotado.
3. **El TXT pasa de «Alcance» a criterio 5.**
4. **El criterio 3 se parte en dos**, con la mitad no medible trasladada al §11.4 del
   checklist **y escrito por qué**.
5. **La rehidratación pasa por `crearExpediente`, nunca devuelve el registro crudo.**
   → M4.
6. **`storage/expedientes.js`, `storage/cuota.js`, `storage/autoguardado.js`,
   `app/dialogo-expediente.js` y `app/cableado-expediente.js` NO salen por el barrel
   raíz.** ⚠️ Y la prohibición está **escrita entera** porque **el guardián no se
   autoprotege**: `storage/*` se importa sin lanzar bajo Vitest `node` (`indexedDB`
   se lee **al llamar**, no al cargar), así que meterlo en el barrel **dejaría la
   suite en verde para siempre**. Sí sale `export/`, que es puro.
7. **El expediente guarda la parcela y el `srs`, y NADA MÁS — y lo dice.** El
   historial de undo/redo está declarado no serializable (`edit/historial.js`), las
   colindantes son caché del Catastro, y el diagnóstico y el informe se recalculan.
   El diálogo **enumera** lo que no se guarda (`NO_SE_GUARDA`), no lo omite.
8. **Recuperar un expediente de otro huso se rechaza honradamente.** El visor no sabe
   cambiar de huso en caliente. Si el `srs` del registro no coincide, **se dice y no
   se recupera**; el botón de esa fila nace apagado **con el motivo enlazado por
   `aria-describedby` en el mismo paso**, y el cableado tiene su propia guarda (un
   `disabled` es cortesía, no garantía). Deuda declarada.
9. **`metadatos.idDocumento` no se reutiliza.** → M10. Es la única promesa del plan
   de la fase que no se cumple, y los dos motivos son concretos y comprobables.
10. **El borrador NO se borra al recuperarlo.** La cabecera de `storage/expedientes.js`
    lo sugería, razonando para un mundo sin autoguardado vivo. Con el debounce
    corriendo, borrarlo dejaría el trabajo sin red durante dos segundos y el propio
    debounce lo reescribiría igual. Lo que se acaba es la **oferta**, que es de una
    sola vez por sesión.
11. **«Borrar» va en dos tiempos.** El diálogo no tiene pantalla de confirmación y su
    tarea estaba cerrada, así que la confirmación la pone el cableado sin tocar un
    nodo ajeno: el primer clic **arma** y lo escribe en el renglón `role="status"`,
    el segundo (dentro de 5 s, y en la misma fila) borra, y un clic en otra fila
    desarma. ⚠️ **Limitación declarada**: el rótulo del botón sigue diciendo
    «Borrar» mientras está armado → §11.3 del checklist.

## Deuda declarada

- **El paquete pasa de 675,52 a 736,16 kB** y el aviso de Vite por encima de 500 kB
  —que ya estaba en F08 y que F09 empeoró— sigue creciendo. Es materia de **F16**.
- **No se cablea la ENTRADA de DXF.** F10 estrena la escritura; `parsers/dxf.js`
  sigue sin llamante desde F01, aunque la prueba de ida y vuelta lo ejercite por fin
  desde fuera. **Que la app escriba un formato que todavía no sabe abrir desde la
  interfaz es una asimetría real** y queda escrita, no tapada.
- **No hay canal entre pestañas.** Dos pestañas abiertas no se enteran de lo que
  guarda la otra hasta reabrir el diálogo, y el borrador es un registro único: la
  última que escriba gana. No es un defecto (nada se pisa **en silencio**: el §11.2
  del checklist lo pone delante de una persona), es alcance que esta fase no abrió.
- **El volcado del borrador al cerrar la pestaña llega hasta donde llega.** Se
  engancha a `visibilitychange` → `hidden`, que es el último momento en que una
  escritura de IndexedDB se completa con garantías; **en `beforeunload`/`unload` ya
  no**. Lo expuesto es la ventana del debounce (2 s) y queda declarado.
- **`app/zona-fichero.js` gana un método (`elegir`) y `cablearComprobacion` una
  opción (`entradasExtra`)**, los dos de F08. Es la primera vez que F10 toca código
  de otra fase, y el motivo es duro: **`crearZonaFichero` engancha el arrastre en la
  VENTANA ENTERA**, así que instanciar una segunda zona haría que las dos cancelaran
  el mismo `drop` y entregaran el mismo fichero a dos destinos.
- **La derivación y el expediente de varias parcelas siguen aparcados.** Un
  expediente porta **una** parcela; una **lista** de expedientes no es multiparcela.

## Ficheros que la fase creó y tocó de verdad

**Nuevos (9 de producción):**

| Fichero | Qué es |
|---|---|
| `export/_comun.js` | El vocabulario de la capa: `SEVERIDAD`, `TIPO_EXPORT`, la fábrica de detecciones y el recuento. **Tercer léxico propio del proyecto** (tras `parsers/` y `gml/`), con la misma FORMA `{tipo, mensaje, severidad, datos?}` para que un solo componente pinte las tres |
| `export/dxf.js` | Contrato D + override O12 **corregido al medirlo** (M6, M8) |
| `export/coordenadas.js` | Contrato E, con el aviso medido de M9 |
| `export/proyecto.js` | Contrato F — el alcance nuevo |
| `export/index.js` | El barrel de la capa. Entra en la raíz como espacio **`exportar`** |
| `storage/expedientes.js` | Contratos A y B. **Escribe geometría de fincas concretas**, así que su cabecera dice qué guarda, dónde y cómo se borra |
| `storage/cuota.js` | Contrato C. `esCuotaExcedida` reconoce el error **por `name`/`code`, jamás por el texto** |
| `storage/autoguardado.js` | El debounce. **Cero imports**: reloj, temporizadores y destino se inyectan |
| `app/dialogo-expediente.js` | El `<dialog>` «Expediente». `index.html` **solo aporta un botón** |
| `app/cableado-expediente.js` | El **paso 12 y último** del ensamblaje: donde se cose la fase entera |

**Tocados (8):** `storage/bd.js` (peldaño 3 de la escalera, **el primer almacén con
índices** del proyecto, y `ESQUEMA_ALMACENES` aprende a declararlos),
`storage/cache-catastro.js` (`purgarCaducados`, el gancho que su propia cabecera
llevaba anotado desde F05), `gml/descargar.js` (`TIPO_MIME_DXF`, `TIPO_MIME_JSON`),
`app/main.js` (paso 12), `app/zona-fichero.js` (`elegir`),
`app/cableado-comprobacion.js` (`entradasExtra` y `elegirFichero`),
`app/cableado-catastro.js` (`describirEdad` pasa a exportada, por lo mismo que
`textoProcedencia` en F08), `index.js` (barrel raíz), `index.html` (un botón y su
envoltorio), `estilos/app.css`, `.gitattributes`.

## Coste, medido

### La suite

| | F09 (`21366ac`) | F10 | Δ |
|---|---|---|---|
| Pruebas | 4.712 | **5.056** | **+344** |
| Ficheros de test | 103 | **112** | **+9** |

### El paquete

`npm run build` del 2026-08-03, contra la **línea de partida medida en la fase 0**
(675,52 kB JS · 218,24 gzip · 49,24 CSS · 25,44 html).

| | F09 | F10 | Δ |
|---|---|---|---|
| `dist/assets/index-*.js` | 675,52 kB | **736,16 kB** | **+60,64 kB** (+9,0 %) |
| *(gzip del JS)* | 218,24 kB | **236,34 kB** | +18,10 kB |
| `dist/assets/index-*.css` | 49,24 kB | **52,80 kB** | +3,56 kB |
| `dist/index.html` | 25,44 kB | **27,87 kB** | +2,43 kB |

**Ni una dependencia nueva**: `package.json` no cambió en toda la fase, y la
atribución por *sourcemap* lo confirma —el reparto de `node_modules/*` es el mismo—.
`idb` ya estaba desde F05.

Atribución por *sourcemap* de los nueve módulos nuevos (bytes minificados):

| Fichero | Δ |
|---|---|
| `app/cableado-expediente.js` | **+13,10 kB** |
| `app/dialogo-expediente.js` | **+11,13 kB** |
| `storage/expedientes.js` | **+8,66 kB** |
| `export/coordenadas.js` | **+6,05 kB** |
| `export/proyecto.js` | **+5,09 kB** |
| `export/dxf.js` | **+3,85 kB** |
| `storage/cuota.js` | **+2,51 kB** |
| `storage/autoguardado.js` | **+2,13 kB** |
| `export/_comun.js` | **+1,04 kB** |
| **suma** | **53,58 kB** |

Los ~7 kB restantes son el crecimiento de los ocho módulos que ya existían (el
peldaño 3 de `storage/bd.js`, la purga de `cache-catastro.js`, los dos MIME, el paso
12 de `main.js`, el enrutado de `cableado-comprobacion.js`) más ruido de
minificación.

**El presupuesto del plan, comprobado.** Decía: «si la capa `export/` pasa de ~15 kB,
algo se está reimplementando y hay que parar». Medido aparte con `rolldown`,
empaquetando `export/index.js` y restando **exactamente los mismos símbolos** de sus
dependencias compartidas (`DECIMALES_COORD`, `redondearAnillo`, `superficie`,
`perimetro`, `crearExpediente`): **16.213 B = 15,8 kB marginales**. Justo en el
borde, y **sin nada reimplementado** — lo que pesa es el texto en castellano de las
detecciones, los avisos y las cabeceras de los tres ficheros que se escriben.

## Lo que NO cubre ningún test de la suite, dicho por escrito

⛔ **`fake-indexeddb` NO ES UNA BASE DE DATOS.** Toda la suite de F10 corre sobre una
implementación en memoria que muere con el proceso, así que **la promesa entera de la
fase —«el trabajo se guarda»— es, en la suite, incomprobable por construcción**. Un
test que dijera «sobrevive a la recarga» sería mentira de las tranquilizadoras.

Se cierra en el guion `12-expedientes.js`, por dos caminos: una **segunda conexión** a
IndexedDB (sin pasar por `storage/bd.js`, que memoiza la suya) y la **herencia entre
cargas**, comparando la marca de tiempo del registro contra `performance.timeOrigin`
para que lanzarlo dos veces sin recargar no dé un falso positivo. Lo que ni así se
mide —cerrar el navegador entero, dos pestañas, abrir un `.json` del disco, y abrir
el DXF en un CAD— es del **§11 del checklist humano**, con dos puntos BLOQUEANTES.

Además: **`persist()`/`estimate()` no existen en Node ni en jsdom**; la cuota agotada
se **dobla** (M5); y el juicio sobre si alguna frase de la lista **se lee como un
veredicto** no lo mide ninguna máquina (§11.6, BLOQUEANTE).

## Estado

**F10 NO está cerrada: falta la firma humana**, igual que F03, F05, F06, F07, F08 y
F09. La cadena pasa a ser **F03 → F05 → F06 → F07 → F08 → F09 → F10** y se firma toda
junta; la §11 del `CHECKLIST-HUMANO.md` trae esta fase con **dos** puntos
bloqueantes: el DXF en un CAD de verdad (§11.4) y cómo se lee la lista (§11.6).

Código y pruebas en verde (**5.056 pruebas en 112 ficheros**, 2026-08-03),
`npm run build` construye limpio (**736,16 kB JS · 52,80 kB CSS · 27,87 kB html**;
gzip del JS **236,34 kB**) **con el aviso de Vite por encima de 500 kB**, y
`npm run validar:xsd -- --estricto` sigue verde: F10 no toca el serializador.

✅ **El guion `12-expedientes.js` se ha ejecutado en navegador real y sale
`ok: true`, `problemas: []`, `advertencias: []`** (corrida de cierre del 2026-08-03,
1440×900, dos pasadas con `$B reload` en medio): consola limpia, **cero peticiones de
red**, caja de vértices en **267 px**, y ⭐ **la supervivencia a la recarga firmada
con el dato exacto** — marca escrita a las 14:58:14,647Z, página cargada a las
14:58:16,159Z, 15 vértices intactos. Los tres ficheros bajan con sus bytes: DXF
1.733 B con `$ACADVER AC1015` y las dos capas en la TABLA, listado 2.639 B con coma
decimal, proyecto 3.193 B que se vuelve a leer.

⛔ **Las cifras del DXF de ese párrafo están CADUCADAS y se dejan escritas a
propósito**: aquel fichero de 1.733 B con `AC1015` es exactamente el que el
**2026-08-05** dejó ZWCAD 2023 en blanco y bloqueado (M16). El guion daba `ok:true`
porque comprobaba que el fichero supiera decir su versión, no que la cumpliera.

⛔ **Y la primera corrida del guion destapó un defecto de producción que la suite no
podía ver** (M12): un aviso del arranque que le quitaba **52 px** a la caja de
vértices en cada carga y para siempre. Es la tercera vez seguida que pasa —F08 con
la tipografía y la descarga, F09 con los tres de maquetación, y ahora esto— y la
lección es siempre la misma: **el guion no confirma lo que ya se sabía; mide lo que
nadie había mirado**.

**Que la suite esté verde y el build limpio no cierra la fase**: son necesarios, no
suficientes (`SPEC.md` §6).

## Referencias

Plan §13.1–§13.2, §18 Fase 10. Dossier §4.2 (IndexedDB/`idb`, cuota), §4.5 (DXF a
mano). Override **O12** (corregido al medirlo: M6, M8).
`scripts/smoke-navegador/GUION.md` §18 · `CHECKLIST-HUMANO.md` §11.
