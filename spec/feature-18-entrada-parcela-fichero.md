# F18 · Entrada de parcela por fichero

**Fase:** 18 · **Prioridad:** P12 (cierra el Bloque B) · **Riesgo:** Bajo ·
**Depende de:** F01 (los parsers, escritos y en verde desde la fase 1), F05
(`geometriaOficial` y «Deducir del mapa»), F07 (el diagnóstico que esto alimenta),
F11 (el patrón del `<dialog>` de reparto por capas) ·
**Habilita:** que el técnico pueda **meter su propio levantamiento**, que es la
mitad de la aplicación que nunca se cableó.

**Ficheros (previstos):** `app/dialogo-importacion.js` (nuevo), `app/cableado-medicion.js`
(nuevo, **paso 14** del ensamblaje), la composición medición↔oficial (fichero por
determinar: **se mide, no se supone** — ver T3), y retoques en `app/main.js`,
`app/cableado-comprobacion.js`, `parsers/importar.js` (solo si hace falta exportar algo),
`export/coordenadas.js` (exportar el detector), `estilos/app.css`.
**Se actualiza al cerrar la fase**, como en F08–F11.

> ⏳ **Esta ficha se abre con el plan, no al terminarlo.** Lo que aquí se dice del
> futuro está en futuro; lo medido lleva su fecha. Al cerrar se reescribe para que
> diga lo que hay y no lo que se pensaba hacer, y lo que decía antes **no se borra**.
> Manda lo medido (regla de oro 8).

## Objetivo

**Que la vía de MEDICIÓN PROPIA deje de ser un cartel sin puerta detrás.**

La pantalla de Entrada anuncia tres formas de empezar un expediente. Dos funcionan.
La tercera —«Medición propia · Tu levantamiento en `.dxf` o un volcado de
coordenadas en `.txt`», [`index.html:418-431`](../index.html#L418-L431), con su botón
«Elegir un fichero de medición…»— **rechaza el fichero con un aviso**.

## ⛔ Cómo se abrió esta grieta, porque el mecanismo importa más que el hueco

Esto **no es alcance nuevo**: es el requisito de F01, que la spec da por hecho.
[`feature-01-entrada-parcela.md:8`](feature-01-entrada-parcela.md#L8) dice «meter
geometría al modelo desde **las tres vías de fichero del técnico**», y F01 figura
«✅ hecho» en el índice. Y lo está — **para la capa de parsers**. La grieta es que
en F01 **todavía no había aplicación**: nace en F03, y los parsers se escribieron
como módulos puros sin llamante.

Después, nadie volvió:

| Fase | Qué hizo con la entrada por fichero |
|---|---|
| **F08** | Estrenó **la primera vía de fichero de toda la app** —«hasta esta fase no había ni un `<input type="file">`, ni un `FileReader`, ni un `drop`»— y cableó **solo `.gml`** |
| **F10** | La declinó por escrito: «**No se cablea la ENTRADA de DXF**» ([`feature-10:167`](feature-10-persistencia-export.md#L167)) |
| **F11** | Cableó `.dxf`/`.txt` **solo a la rama Edificio**, y declaró la asimetría «cerrada a medias» |

⛔ **Y el resultado es que el requisito quedó sin dueño en el índice.** El único
sitio del proyecto que le asigna casa es un **comentario de código**
([`app/main.js:2689`](../app/main.js#L2689): «su sitio es F12»), y la ficha de F12
no lo recoge: sus cuatro deudas heredadas son todas de la rama edificio. Una fase
marcada ✅ puede estar ocultando la mitad que no se entregó; el aprendizaje de
método es que **«hecho» debe significar «el usuario puede usarlo»**, no «el módulo
está en verde».

## Lo medido el 2026-08-05, al planear

Todo esto es lectura del árbol de hoy, no recuerdo:

1. **`importar()` no tiene llamante en producción** salvo `edificio/entrada.js:416`.
   Once fases en verde sin usuario.
2. **No hay ni un manejador de `paste`/`clipboardData` en todo el código de
   producción** (grep: cero resultados). LIST —la vía que F01 llama **principal**—
   no tiene ni el principio de una entrada.
3. **`importar()` ya ofrece todas las correcciones que la UI necesita**
   ([`parsers/importar.js:577-595`](../parsers/importar.js#L577-L595)): `capa`,
   `compensarCierre`, `retirarCierre`, `intercambiarXY`, `huso`, `formato`,
   `separadorDecimal`, `flechaMax`. **No hay que escribir ni un detector**: están
   escritos desde F01 y la fase es de cableado y de UI.
4. **Los bloqueos son cinco** ([`:133-139`](../parsers/importar.js#L133-L139)) y
   **dos de ellos hablan del reparto y no del fichero**
   ([`:142-145`](../parsers/importar.js#L142-L145)).
5. **`crearParcela` ya guarda las dos geometrías por separado**: `recintos` (lo
   trabajado) y `geometriaOficial` (la del WFS), como copia independiente y
   congelada ([`model/parcela.js:224-242`](../model/parcela.js#L224-L242)). La
   decisión 2 de esta fase **no obliga a tocar el modelo**.

## Las cuatro decisiones (entrevista del 2026-08-05)

### 1 · Entran `.dxf` y `.txt`. **LIST pegado NO entra, y se dice**

Se cablean los dos formatos de fichero que la zona de arrastre y el botón **ya
anuncian hoy**. Es lo que quita el aviso.

⚠️ **Y eso deja fuera la vía que F01 llama «principal».** El pegado de LIST de
AutoCAD sigue sin existir y —esta vez— **sale de aquí con dueño escrito**, para no
repetir el mecanismo del epígrafe anterior: ver «Deuda declarada».

### 2 · Un dibujo entra como MEDICIÓN; la geometría oficial se conserva

⭐ **Es la decisión que le da valor a la fase, y sale gratis.**

- **Con parcela ya cargada** (traída del Catastro): el dibujo ocupa `recintos` y
  `geometriaOficial` **no se toca**. La referencia catastral tampoco. ⇒ el
  **Diagnóstico de encaje de F07 funciona inmediatamente**, que es el flujo real del
  perito: *traigo la oficial, meto mi levantamiento, contrasto*.
- **Con el lienzo vacío**: entra como parcela nueva, `geometriaOficial: null` y sin
  referencia. Es el caso de la pantalla de Entrada.

⚠️ **Sin referencia catastral no hay GML publicable.** Una medición propia no la
trae, y `app/main.js` ya tiene el último recurso `SIN-REFERENCIA`
([`:820`](../app/main.js#L820)). **No se bloquea la importación por eso** —el
técnico puede querer solo mirar—, pero se **dice** y se señalan las dos vías que ya
existen: teclear la RC en su campo, o «Deducir del mapa» (F05). Regla de oro 1.

### 3 · Las detecciones se resuelven en un `<dialog>` de revisión, **antes** de entrar

Mismo patrón que el reparto por capas que F11 ya montó
([`app/panel-edificio.js`](../app/panel-edificio.js), `CLASE.DIALOGO_CAPAS`), y
mismo reparto que `app/dialogo-informe.js` (F09) y `app/dialogo-expediente.js`
(F10): **el módulo fabrica su propio DOM e `index.html` no se toca**.

El mecanismo es llamar a `importar()` **dos veces**: la primera para *inspeccionar*
(sin opciones), enseñar lo que ha encontrado y dejar elegir; la segunda ya con las
`opts` que el usuario ha decidido. Es exactamente lo que hace `edificio/entrada.js`
con el reparto por capas, y es barato porque `importar()` es puro.

⚠️ **«Barato» es inferencia (9/10), no medición**: la doble pasada sobre `UTM.dxf`
—25 polilíneas— se mide en T2 y se escribe la cifra.

**Coste en el panel: 0 px.** Un `<dialog>` no le quita altura a la columna
izquierda. Lo que sí cuesta es el renglón de procedencia y los avisos que queden en
el panel — se mide en T8.

### 4 · La rama activa decide el destino, sin preguntar

Con **Parcela** puesta, un `.dxf` entra como parcela; con **Edificio**, como partes.
Es el mecanismo de resolución tardía que F11 ya montó
([`app/main.js:2691-2716`](../app/main.js#L2691-L2716)), y **`MENSAJE_DIBUJO_EN_PARCELA`
se borra**: deja de existir una rama que rechaza lo que la otra acepta.

## 🔻 OVERRIDES aplicables

- **O12 — DXF, ya caducado y corregido el 2026-08-05.** Afecta a la *escritura*
  (R12/`AC1009`), no a la lectura: `parsers/dxf.js` **sigue leyendo las dos vías** y
  esta fase no lo toca. Se anota aquí porque la simetría escribir/leer es
  precisamente lo que F18 cierra, y conviene que no se lea como pendiente.

## Alcance

**Entra:**

- `.dxf` y `.txt` como **parcela**, por arrastre sobre la ventana y por el botón
  «Elegir un fichero de medición…» — las dos entradas que ya existen y hoy caen en
  el mismo rechazo.
- El `<dialog>` de revisión: detecciones agrupadas, los cinco bloqueos, y las
  correcciones **ofrecidas y nunca aplicadas en silencio** (elegir capa, intercambiar
  X/Y, proyectar geográficas, compensar o retirar el cierre).
- La composición medición↔oficial de la decisión 2, con reinicio del historial de
  edición y disparo del autoguardado de F10.
- El renglón de procedencia diciendo la verdad nueva («de tu medición · `UTM.dxf`»),
  con `textoProcedencia` —ya exportada desde F08— y sin una segunda redacción.
- El aterrizaje en el rail: con geometría oficial delante → **Diagnóstico**; sin
  ella → **Validación**, con el motivo dicho. Mismo criterio y misma función que
  `aterrizarTrasContrastar` ([`app/main.js:3638`](../app/main.js#L3638)).
- ⛔ **La defensa contra nuestro propio `.txt`** — ver el epígrafe siguiente.

**No entra, y se dice:**

- **LIST pegado.** Sin superficie de pegado, sin `paste`. Ver «Deuda declarada».
- Entrada por distancia y rumbo, splines, bloques e `INSERT` del DXF (fuera desde
  F01, [`feature-01:41`](feature-01-entrada-parcela.md#L41)).
- Reabrir como parcela un `.gml` de edificio, o al revés. La rama manda (decisión 4).

## ⛔ El fichero que esta aplicación escribe y su propio lector malinterpreta

**Medido en F10 y sigue siendo cierto:** el listado de replanteo que exporta
`export/coordenadas.js` **no se puede volver a cargar**, y el modo de fallo es el
peor posible — no revienta, **miente**:

> «la primera columna es el **número de vértice**, no una coordenada, y un lector de
> dos columnas la tomaría por la X»
> — [`export/coordenadas.js:144-148`](../export/coordenadas.js#L144-L148)

F10 lo midió: **15 vértices entran y 18 pares salen del parser, ninguno correcto**.
Hasta hoy daba igual, porque el `.txt` no entraba por ningún sitio. **F18 abre esa
puerta**, y sin defensa el usuario más natural del mundo —el que exporta su listado
y lo vuelve a soltar— se lleva una parcela silenciosamente falsa con la que puede
generar un GML.

**Se detecta por la constante y se rechaza por su nombre**, no por heurística: el
listado lleva `AVISO_NO_REIMPORTABLE` en su cabecera y una tabla `Nº | X (m) | Y (m)`.
El detector lee la constante que ya existe —**no una segunda copia del literal**, que
es como divergen— y el mensaje remite al fichero de proyecto, que es la vía correcta
y ya funciona desde F10.

⭐ Es el reverso exacto de la lección de F10: allí *nuestro parser aprobaba ficheros
que ningún CAD abre*; aquí *nuestro parser aprobaría un fichero nuestro leyéndolo al
revés*.

## Criterios de aceptación

1. Un `.dxf` real (`UTM.dxf`) soltado con la rama **Parcela** puesta **entra como
   parcela** y se ve en el mapa. El aviso `MENSAJE_DIBUJO_EN_PARCELA` **ya no existe
   en el código**.
2. Con una parcela del Catastro cargada, importar un dibujo **conserva
   `geometriaOficial` y la referencia**, y el **Diagnóstico de encaje se puede abrir
   sin traer nada más**.
3. ⛔ **El diálogo de capas no es un adorno**: con `UTM.dxf` —**25 polilíneas en 5
   capas**, y la parcela de verdad en la capa **`0`, no en la llamada `PARCELA`**
   (medido en F11)— la importación **para y pregunta**. Elegir por nombre falla en el
   único plano real que tiene el proyecto.
4. Ninguna corrección se aplica sola: X/Y invertidas, coordenadas geográficas y
   cierre abierto **se ofrecen** y el fichero entra como el usuario decida.
5. Soltar el `.txt` de replanteo que exporta la propia aplicación **se rechaza
   nombrando el motivo** y remite al fichero de proyecto. **No entra una parcela de 18
   pares.**
6. La superficie de la parcela importada es **positiva** y coincide con la del mismo
   contorno por la otra vía (guardián contra la regresión de los **−390,45 m²** que
   F11 arregló).
7. Guion de humo **`17-medicion-propia.js`** en `ok:true`.
8. Se **mide y se declara** lo que la fase le quita al panel de vértices (F17 ya
   rompió la racha de «coste 0 px»; aquí se mide, no se promete).

## Plan de ejecución — 8 tareas / 5 fases

Tareas de una misma fase tocan **ficheros disjuntos** y van en paralelo.

| Fase | Tareas ∥ | Qué entra |
|---|---|---|
| **0** | 1 | **T1** esta ficha + la fila en el índice + el mapa §5 · *(se entrega el 2026-08-05)* |
| **1** | 2 | **T2** `app/dialogo-importacion.js` — el `<dialog>`, con la doble pasada de `importar()` medida · **T3** la composición medición↔oficial |
| **2** | 2 | **T4** `app/cableado-medicion.js` — el **paso 14**: leer, importar, dialogar, guardar, procedencia · **T5** la defensa contra el `.txt` propio (detector + `AVISO_NO_REIMPORTABLE` exportado) |
| **3** | 1 | **T6** la costura en `app/main.js` — la rama decide, `MENSAJE_DIBUJO_EN_PARCELA` se borra, y el aterrizaje en el rail |
| **4** | 2 | **T7** guion `17-medicion-propia.js` · **T8** delta de bundle + §14 del checklist humano |

**Contratos declarados por adelantado**, para que las tareas de la fase 1 vayan a la
vez sin esperarse:

```
crearDialogoImportacion({doc, alAvisar}) → { abrir(inspeccion) → Promise<opts|null>, destruir }
conMedicionImportada(parcelaActual|null, recintos, {origen}) → Parcela
```

### Lo que hay que verificar antes de escribir (no se supone)

- ⛔ **T3 no tiene fichero asignado a propósito.** Hay que medir si `model/parcela.js`
  ya trae una mutación tipo `conRecintos` reutilizable, o si toca escribirla. Elegir el
  sitio por lectura del árbol, no por analogía.
- **El historial de edición** (`edit/historial.js#reiniciar`, de F06) debe reiniciarse
  al importar, igual que hace `alCargarParcela`. Verificar el punto exacto.
- **El autoguardado de F10** debe dispararse. Verificar que la ruta nueva pasa por el
  mismo sitio que las que ya lo hacen.
- **Que `importar()` con `capa: '0'` sobre `UTM.dxf` da superficie positiva** tras el
  arreglo de F11. Es un guardián, no un supuesto.

## Deuda declarada

- ⛔ **LIST pegado sigue sin construirse, y esta vez sale con dueño.** Es la vía que
  [`feature-01:14`](feature-01-entrada-parcela.md#L14) llama **principal** (pegado de
  LIST de AutoCAD) y hoy no tiene ni un manejador de `paste`. **Fuera del alcance de
  F18 por decisión explícita del 2026-08-05.** Para que no repita el mecanismo que
  abrió esta grieta, queda anotada aquí **con nombre y con casa propuesta: una F19 de
  una sola tarea**, no un renglón en la ficha de otra fase. Una deuda sin dueño en el
  índice es una deuda que nadie paga: es literalmente lo que le pasó a esta.
- ⚠️ **El cotejo de superficie (`resumen.superficie`) solo lo trae LIST**, porque es
  el único formato con superficie declarada en su meta. Con `.dxf`/`.txt` ese renglón
  del diálogo **no aparece** — no se enseña vacío ni con un cero, que afirmaría algo
  falso.

## Referencias

Plan §5, §18 Fase 1, §23.1 · [`feature-01-entrada-parcela.md`](feature-01-entrada-parcela.md)
(el requisito y las detecciones defensivas) ·
[`feature-10-persistencia-export.md`](feature-10-persistencia-export.md) (el `.txt` no
reimportable, y la declinación explícita de la entrada DXF) ·
[`feature-11-edificio-entrada.md`](feature-11-edificio-entrada.md) (el patrón del
`<dialog>` de capas y la asimetría «cerrada a medias») · Dossier §3.5 (bulge/arco),
§3.2 (saneamiento).
