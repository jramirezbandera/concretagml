# F23 · El colindante recortado

**Fase:** 23 · **Prioridad:** P13d (Bloque B; ver §Dónde encaja) · **Riesgo:** el
riesgo de esta fase **no es técnico, es jurídico** (¿admite la Sede que modifiquemos
la parcela de un tercero?), y por eso sigue vivo con la suite entera en verde ·
**Depende de:** F05 (`alColindantes`, el canal por el que llegan las vecinas), F06
(la geometría editada), F07 (`diagnostico/topologia.js` y el umbral de invasión),
F17 (`derivacion/` entera: la resta, el sobrante, la identidad y el sobre de N
`featureMember`) ·
**Habilita:** que un expediente que mueve un lindero **compartido** pueda salir
positivo, porque aporta también la geometría del vecino afectado.

**Ficheros.** Nuevos — `derivacion/vecino.js` (617 líneas), `app/colindantes.js`
(198), `scripts/smoke-navegador/25-colindante-recortado.js` (585) y sus dos suites
(`test/derivacion/vecino.test.js`, `test/app/colindantes.test.js`). Tocados —
`derivacion/cesion.js` (la astilla `emitible`), `derivacion/entrega.js` (los vecinos
como miembros y la diana del cierre), `derivacion/topologia.js` (`unir`),
`derivacion/_comun.js` (los tipos del colindante recortado), `comprobacion/conjunto.js`
(`oficialesExtra` y `residuoEsperadoM2`), `diagnostico/topologia.js` +
`config/operativos.js`/`.json` (el umbral recalibrado), `geo/grosor.js`,
`viewer/lista-sobrante.js` y `viewer/piezas.js` (el destino pieza a pieza y el ámbar
de lo que cae fuera), `app/cableado-derivacion.js`, `app/cableado-catastro.js`,
`app/cableado-diagnostico.js`, `app/cableado-informe.js`, `app/main.js`.
⭐ **Ni `model/`, ni `package.json`, ni un byte de CSS.**

**Estado:** ✅ **código, pruebas y guion HECHOS y en verde**, publicados el
2026-08-11 en el commit `f1a8436`. Suite del árbol commiteado: **7.521 pruebas / 176
ficheros, 0 rojas** (medido en `0909148`); guion `25-colindante-recortado.js` en
**`ok:true`** en Chrome real (`?demo=real`, 1440×900).
⏳ **NO CERRADA. Lo único que falta es la verdad externa**: `CHECKLIST-HUMANO.md`
**§21** (el IVG sobre un expediente con vecino recortado) y **§22** (la astilla del
enganche). Nada de esto se ha subido a la Sede.

## ⛔ Nota de procedencia: esta ficha llega TARDE, y eso es un hallazgo

Esta ficha se escribe el **2026-08-11**, después de que la fase esté entregada y
publicada. **Es la única fase de este proyecto que se construyó sin pasar por
`spec/`**, y conviene que quede escrito, porque el síntoma fue exacto:

> El mismo día en que `derivacion/vecino.js` y `app/colindantes.js` entraban en el
> árbol, `TODOS.md` seguía diciendo que el colindante recortado estaba **aplazado**
> y que costaba **«semanas, no días»**. El registro de trabajo aplazado describía
> como futuro lo que ya era código en verde.

La causa es que F23 no nació de una entrevista sino de **un defecto reportado con
captura** (2026-08-10), se diseñó en la conversación y se ejecutó en la misma sesión.
El plan vivió en la sesión y no en el repositorio, así que el maestro —`SPEC.md` §4 y
§5— nunca se enteró.

Lo que se corrige aquí: la ficha existe, la fila P13d existe, y `TODOS.md` deja de
prometer lo entregado. Lo que **no** se corrige y se dice: no hay tabla «tareas por
fase» reconstruida a posteriori, porque inventarla sería escribir un plan que nadie
siguió. Lo que hay debajo es **lo entregado y lo medido**, que es lo que la regla de
oro 8 pide conservar.

## Objetivo

**Que mover un lindero compartido deje de producir un expediente incompleto.**

Desde F17 la aplicación sabe derivar el sobrante `P_of − P_new` y meter N parcelas en
un solo sobre. Lo que no sabía es qué hacer cuando la geometría medida **entra en la
parcela del vecino**: el exceso no se declaraba, el conjunto no cerraba, y el IVG
sale negativo si el expediente no aporta TODAS las geometrías afectadas.

Es, además, lo único de este producto que un CAD no puede hacer de ninguna manera.

## ⭐ El marco que fijó el autor (2026-08-10): la medición es la referencia

**La geometría que levanta el técnico es la buena.** El contorno que publica el
Catastro no es el árbitro: es una foto anterior y posiblemente peor. Así que donde la
medición entra en un vecino, **el que se corrige es el vecino**:

    V_i_new = V_i_oficial − P_new

⭐ **Y el cierre del expediente queda garantizado por ÁLGEBRA, no por suerte:**

    Σ nueva = (P_new + sobrante) + ΣV − exceso
            = (P_of  + exceso)   + ΣV − exceso  =  P_of + ΣV  =  Σ oficial

La identidad está **medida** sobre el expediente real `29050A01000144` y sale con
residuo `0,000000 m²`. Ésa es la razón por la que la diana del comprobador de cierre
**cambia** en esta fase: lo que el expediente tiene que cubrir ya no es «mi contorno
oficial» sino **todo lo oficial que este expediente modifica**
(`comprobacion/conjunto.js#oficialesExtra`). Sin esa línea, un vecino recortado
saldría como ~1.670 m² de superficie sobrante y **el expediente correcto se
bloquearía a sí mismo**.

## Las tres decisiones del autor (2026-08-10)

| # | Decisión | Por qué, con la medición al lado |
|---|---|---|
| **1** | **El sobrante se pregunta pieza a pieza** (vecino / finca nueva / fuera), nunca se reparte solo | `asignado_i` **no es derivable**: que un trozo pase al vecino o sea alta es **jurídico**, no geométrico. Y está medido que automatizarlo fallaría: en el expediente real el trozo linda **18,42 m** con `…145` —que **no pierde nada**— y 12,09 m con `…143`; un reparto «al que más linde» habría elegido **al que no participa** |
| **2** | **Pisar un vial vale.** Exceso que no solapa a ninguna colindante → **AVISO, no bloqueo** | Un vial mal georreferenciado se pisa para colocar bien la finca. Sale por `sobreNadie` con su superficie y quien decide es quien firma. Lo que NO puede es confundirse con «no hay exceso» |
| **3** | **Vecino partido en dos** → la pieza **MAYOR** conserva la referencia catastral; las demás con sufijo (`…145.1`) | Cae exactamente sobre el override **O19**, ya presentado y aceptado con IVG positivo (CSV `XMWPXCN9J8DB9J89`). No se inventa nada: se reutilizan las dos funciones de `derivacion/identidad.js` |

⚠️ El sufijo **no colisiona** con el de las cesiones propias aunque los dos empiecen
en 1: los padres son distintos (`…144.1` es una cesión mía y `…145.1` un trozo del
vecino), y el `gml:id` se compone sobre el `localId` entero.

## Mediciones (2026-08-10, expediente real `29050A01000144`)

Los 10 vértices de la captura reproducen el panel **exacto** (287,5910 m² /
74,9888 m), así que `P_new` se reconstruyó **sin inventar nada**. Dos peticiones al
WFS (`GetParcel` + `GetNeighbourParcel`).

```
sobrante  36,4633 m² (1 pieza, 4 vértices)   ·   exceso 25,4865 m²
exceso →  …143  20,2925 m²  +  …121  5,1941 m²   (residuo 0,0001 · CERO sobre vial)
expediente: 4 miembros · cierra:true · residuo 0,0026 m² sobre 4.518,92 m²
GML 7.197 B · valida contra cp/4.0 con `npm run validar:xsd --estricto`
```

⚠️ Los XML del WFS quedaron en el scratchpad y **no se fijaron como fixture**. Es
deuda declarada, no descuido: ver §Deuda.

## ⛔ Las cuatro creencias que la medición refutó

| # | Lo que se creía | Lo que salió al medir |
|---|---|---|
| **M1** | ⛔ **Que esta fase costaba «semanas, no días».** La ficha de F17 la apartó con este motivo escrito: «necesita sacar `vecinas` de la clausura de `app/cableado-diagnostico.js` al modelo», con colección de geometrías en el store, selección activa y undo por capa | **FALSO.** Las vecinas **no están secuestradas en ninguna clausura**: su fuente es `app/cableado-catastro.js#alColindantes`, una suscripción pública con `Set` de oyentes y baja, **de la que ya colgaban TRES consumidores** (el diagnóstico de F07, el informe de F09 y el snap de F06). `cableado-diagnostico.js` no era el dueño del dato: era **un suscriptor más que se guardaba una copia**. El registro es el **cuarto** suscriptor y cuesta **cero peticiones** |
| **M2** | Que `comprobarConjunto` necesitaría `@turf/union` para unir los contornos oficiales antes de restar | **FALSO.** Su cobertura ya era **resta encadenada** y `restos` ya era una **LISTA** de regiones —lo tenía que ser porque una resta parte el contorno en trozos—. N dianas = **cambiar la semilla**. Cero bytes |
| **M3** | Que la adyacencia entre el sobrante y un vecino se decide por **distancia** | ⛔ **INCORRECTO, y el contraejemplo es real:** `…146` está a **0,000000 m** del trozo —comparten un vértice— y **NO linda**: al unir las dos piezas salen **dos** componentes. Se pregunta **uniendo**, no midiendo. `@turf/union` ya estaba en el paquete desde `edificio/envolvente.js` ⇒ **0 B** |
| **M4** | — | ⭐ `aVecinas` estaba **duplicado** en `cableado-diagnostico.js` y `cableado-informe.js`, y **discrepaban**: uno recortaba el `refcat` antes de decidir si estaba vacío y el otro no. `app/colindantes.js` lo deja escrito **una vez** |

## ⛔ La astilla del enganche (2026-08-10) — cinco defectos encadenados

**Reportado por el autor con tres capturas** sobre `6346726UF8664N`: «no me deja
meter una geometría que invada otra parcela». La pantalla decía **«El expediente NO
cierra sobre el contorno oficial»** — ⭐ **y el conjunto CERRABA**: suma, cero solape y
cobertura, las tres. El mensaje era falso y mandó al autor a buscar un problema
inexistente.

La causa, **medida** (los 16 vértices de la captura reproducen el panel: 593,20 m² /
97,33 m): lo que rompe el expediente es **enganchar la medición a los linderos
oficiales**. Eso deja astillas de milímetros entre las dos líneas.

```
astilla cruda        : 8 vértices · 0,025149 m² · grosor 0,001146 m
tras redondear a 2 d.: superficie 1,78e-15 m²
⛔ PUNTO_REFERENCIA_RECALCULADO → xml === null → EL DOCUMENTO ENTERO no sale
```

1. ⛔ **La astilla se ofrecía como finca.** Ahora `cesion.js` mide `emitible` con
   `gml/anillos.js#puntoInterior` —**la misma función que usa el serializador**, no un
   umbral que la imite— y `entrega.js` no la hace miembro **lo pida quien lo pida**.
2. ⛔ **`MOTIVO_NO_CIERRA` se escribía ante CUALQUIER bloqueo.** Ahora el motivo sale
   de `entrega.bloqueos`.
3. ⛔ **`vecino.js` comparaba m² contra METROS** (`pierde <= umbralGrosorM`). Efecto
   medido: dos colindantes entraban **recortadas** por franjas de **1,5 y 0,9 mm** —o
   sea, **modificando la finca de un tercero por el ruido del redondeo**—. El
   diagnóstico de encaje ya las descartaba por grosor: **había dos respuestas a la
   misma pregunta en el mismo programa**.
4. ⛔ **«Cero piezas propias» apagaba la entrega** aunque hubiera vecinos recortados.
5. ⛔ La nota no concordaba en número. Lo cazó **mirar Chrome**, no la suite.

⭐ **Y lo que refutó medir fue en la dirección contraria a la esperada.** Se buscó el
par «estrecha pero emitible» para demostrar que los dos campos no son sinónimos. **No
existe** para una franja recta; lo que existe es peor (barrido de 0,5 mm a 3 cm):

```
0,5 … 7 mm    estrecha       no emitible
8 … 14 mm     NO estrecha    no emitible   ← el hueco que nadie vigilaba
15 mm →       no estrecha    emitible
```

El corte cae entre 14 y 15 mm porque el `cp:referencePoint` **también** se escribe con
2 decimales. O sea que entre 8 y 14 mm había piezas **sin ni siquiera la marca de
estrechas** que tumbaban el fichero igual.

## ⛔ El Catastro no es topológicamente limpio, y el umbral estaba 7× fino

Medido el 2026-08-10 sobre **554 parcelas oficiales de diez provincias (15.501 pares,
sin editar un vértice)**: 64 piezas de solape, 41 de ellas agujas de redondeo de entre
**0,071 mm y 5 mm** de grosor.

**Por qué, y es aritmética:** el WFS publica con 2 decimales (celda de 1 cm). Cuando la
vecina **subdivide el lindero compartido con un vértice que la propia no tiene** —los
dos extremos del tramo vienen idénticos, comprobado—, ese vértice intermedio
redondeado cae fuera de la recta que los extremos definen. Techo: media diagonal de la
celda (**√2/2 cm = 7,07 mm**) por parcela.

⛔ **Consecuencia: `OPERATIVOS.grosorInvasionMinimoM` valía 1 mm y 34 de esas agujas
salían anunciadas como «Invasión a colindantes» sobre parcelas oficiales que nadie
había tocado.** Corregido a **0,0071 m**, que es el `GROSOR_REDONDEO_M` que F17 ya
había derivado en `comprobacion/conjunto.js` — **y cuya cabecera declaraba por escrito,
sin medirlo, que a F07 no le aplicaba. Sí aplicaba.**

Tres lecciones de método, que es lo que hay que recordar:
- Un umbral calibrado contra **un** fixture es una muestra de uno. 7.400 pruebas en
  verde y ninguna veía esto.
- Dos constantes que coinciden **por casualidad** ocultan el error: nadie mira un
  número que «ya está justificado». Aquel 1 mm se copió de `duplicadoMetros`, que
  describe **nuestro modelo**, cuando lo que hay que absorber lo fija la **rejilla de
  publicación** de otro.
- Cuando la cabecera de un módulo dice «esto aquí no aplica» **sin una medición
  detrás**, es un sitio donde mirar.

⚠️ **Y hay que decírselo al usuario:** una invasión REAL más estrecha que ~1,4 cm **no
se puede distinguir con este dato**. No es tolerancia nuestra, es la resolución de la
fuente.

## ⛔ `null` y `[]` no significan lo mismo, y es la mitad de `app/colindantes.js`

```
null → NO SE HA CONSULTADO.  No se sabe si hay colindantes.
[]   → SE HA CONSULTADO y no hay ninguna. La parcela está aislada.
```

Son afirmaciones **opuestas y la segunda tranquiliza**, que es el patrón de error que
este proyecto persigue. Quien las colapse hará que `derivacion/vecino.js` declare
**sobre un vial** un exceso que en realidad cae sobre la finca de un vecino: un
expediente incompleto emitido con confianza.

⚠️ **El registro no pide nada.** No conoce la red y no llama a `catastro.colindantes()`:
se suscribe y espera. Pedir es una decisión de política —el override **O8** habla de
denegación de servicio por uso abusivo—, y esa decisión es de quien tiene una pantalla
delante, no de un registro.

## Dos defectos que solo aparecieron ejecutando

- ⛔ **Repartí «qué bloquea» en tres sitios y me dejé el tercero.** La puerta se abría,
  los miembros se componían, y un `if` previo al cierre miraba `severidad === ERROR` en
  crudo ⇒ **`puedeEntregarse: true` con `xml: null`**. Unificado en `esBloqueo`.
- ⛔ **Un doble de prueba que ignoraba sus argumentos.** `cesion.test.js` stubeaba
  `@turf/difference` devolviendo lo mismo a las **dos** restas, así que la puerta
  afirmaba que una parcela de 1 m² se salía 200 m². **Pasaba en verde porque nadie
  miraba la puerta.**

## El guion 25, y los tres defectos que destapó

`scripts/smoke-navegador/25-colindante-recortado.js`, corrido en Chrome real
(`?demo=real`, 1440×900): **`ok:true`, cero problemas**. Gasta **una** petición al
Catastro («Traer colindantes»), así que **no va en CI ni se corre en bucle** (O8).

⭐ **Destapó TRES defectos que la suite aprobaba en verde**, dos de texto y uno de
método:

1. «sobre 56,37 m² **sobre** ninguna parcela» — «sobre» duplicado.
2. La nota decía «el expediente NO se puede descargar mientras haya alguno» **con el
   botón encendido**: se escribió cuando el bloque siempre significaba bloqueado. ⚠️ **Lo
   vio la CAPTURA, no el guion.**
3. ⛔ **El guion mentía en la segunda corrida.** Las colindantes se quedan en el
   registro mientras viva la página, así que la mitad «sin consultar» medía un estado
   **ya calentado** y acusaba dos defectos inexistentes. Ahora lo detecta y lo dice.

Medido en vivo: exceso **sobre ninguna parcela** (vial) con la entrega **abierta
igual** —la decisión 2 del autor ejercitada de verdad—; y con la astilla, pieza de
0,01 m² · 0,0002 m, contador «Se emitirán 2 de 3 piezas», entrega **encendida**, tabla
de vértices **413,81 px**, desborde **0**.

## Criterios de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | La geometría medida que invade a un colindante **le resta a él**, y el expediente lo declara como miembro con su referencia real | ✅ medido (`29050A01000144`: 4 miembros, `cierra:true`) |
| 2 | El conjunto **cierra sobre todo lo oficial que el expediente modifica**, no solo sobre la parcela propia | ✅ residuo `0,0026 m²` sobre 4.518,92 |
| 3 | El sobrante se asigna **pieza a pieza**, y la adyacencia se decide **uniendo** | ✅ (M3) |
| 4 | Un exceso que no cae sobre nadie **avisa y no bloquea** | ✅ ejercitado por el guion 25 |
| 5 | Una pieza que no se puede escribir **no tumba el fichero** y sale marcada | ✅ (§astilla) |
| 6 | Ni una dependencia nueva, ni un byte de CSS | ✅ `package.json` sin tocar; CSS **0 B** |
| 7 | Guion de navegador en `ok:true` | ✅ |
| 8 | **IVG positivo sobre un expediente con vecino recortado** | ⛔ **NO. Es lo único que falta y no lo puede firmar ninguna máquina de este repositorio** |

## Riesgos

| Riesgo | Estado |
|---|---|
| ⛔ **Que el IVG no admita modificar la parcela de un tercero sin su consentimiento** | **VIVO, y es el riesgo de la fase entera.** Es jurídico, no geométrico. Si la respuesta es no, F23 sirve para **VER** y no para **ENTREGAR** |
| ⛔ **«Tipo de operación» con una forma que O20 no midió** | **VIVO.** Las dos formas medidas eran «1 miembro `ES.SDGC.CP`» → Subsanación y «N miembros con alta» → Segregación. Ésta es una **tercera**: 2 miembros ajenos + 1 alta. La app propone SEGREGACIÓN **por inferencia** |
| ⚠️ **Que el IVG devuelva negativo por el exceso sobre vial** | **VIVO.** Si lo devuelve, la decisión 2 hay que revisarla y `FUERA_SOBRE_NADIE` vuelve a ser ERROR |
| ⚠️ **Que la Sede exija cobertura exacta al milímetro** y eche en falta los 0,01 m² de la astilla | **VIVO.** Nuestro descarte por grosor es la misma tolerancia que F17 viene aplicando |
| ~~Que sacar las vecinas al modelo costara semanas~~ | ⛔ **MUERTO al medir** (M1) |

## Deuda declarada

- ⏳ **El expediente real `29050A01000144` no está fijado como fixture.** Sus dos XML
  del WFS quedaron en el scratchpad. Todo lo que esta ficha publica de él es
  reproducible **hoy** pidiéndolo otra vez, y **no** dentro de un año: es exactamente
  la distinción que F17 fase 0 resolvió trayendo el expediente de oro al repositorio.
- ⚠️ **Una invasión más estrecha que ~1,4 cm no se puede distinguir**, y eso no está
  dicho en ninguna pantalla: vive en el JSDoc de `config/operativos.js`.
- ⚠️ **El guion 25 no va en CI** por el override O8 (una petición real al Catastro).
  Es la misma condición que el 24, y significa que su cobertura **solo existe cuando
  alguien lo corre a mano**.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Si «Finca nueva (alta)» vs «Pasa a 9398515VK3799G» se entiende sin explicación.**
  Todo el reparto pieza a pieza se apoya en que esa elección sea obvia.
- **Si el ámbar de lo que cae fuera se distingue del cian sobre una ortofoto real.** El
  guion comprueba el hex; que se lean como dos cosas distintas sobre un borde arbolado,
  no.
- **Cómo computa el IVG la superficie AFECTADAS** con dos vecinos dentro. Debería ser
  la suma de los contornos oficiales tocados (4.518,92 m² en el caso medido) y no solo
  la de la finca propia. Es el número que delataría si la diana del cierre está bien
  elegida.

## Dónde encaja

Bloque B, **P13d**, detrás de F22. Lleva `d` por lo mismo que F20 lleva `b`, F21 lleva
`b` y F22 lleva `c`: el Bloque B se quedó sin peldaños en P13 y renumerar por un número
no compensa — se dice en vez de fingir la escalera.

Es **la fase 2 que F17 apartó**, entregada. Aquella ficha la describió como cara y con
un motivo escrito que resultó falso al medirlo (M1); el motivo se conserva citado allí
y aquí, porque la lección no es que la estimación fallara, sino **por qué**: se estimó
leyendo el sitio donde el dato se guardaba (una copia) en vez del sitio de donde venía
(un canal público con tres suscriptores).

## Referencias

[`feature-17-expediente-varias-parcelas.md`](feature-17-expediente-varias-parcelas.md)
(la capa `derivacion/` entera, el sobre de N `featureMember`, O18 y O19) ·
[`feature-07-diagnostico-parcela.md`](feature-07-diagnostico-parcela.md) (el umbral de
invasión y el filtro de grosor) ·
[`feature-05-catastro-vivo.md`](feature-05-catastro-vivo.md) (`colindantes()` y el
canal `alColindantes`) ·
`derivacion/vecino.js` · `app/colindantes.js` · `config/operativos.js`
(`grosorInvasionMinimoM`) · `comprobacion/conjunto.js` ·
`CHECKLIST-HUMANO.md` **§21** y **§22** · `GUION.md` (guion 25).
