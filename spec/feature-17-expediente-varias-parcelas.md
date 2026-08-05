# F17 · Expediente de varias parcelas

**Fase:** 17 · **Prioridad:** P11 (cierra el Bloque B) · **Riesgo:** Medio ·
**Depende de:** F06 (edición), F07 (diagnóstico), F04 (serializador) ·
**Habilita:** el 80 % del parcelario real que hoy la aplicación no cierra.

**Ficheros (previstos):** capa nueva `derivacion/` con barrel propio
(`topologia.js`, `cesion.js`, `entrega.js`, `identidad.js`, `_comun.js`),
`geo/grosor.js`, `comprobacion/conjunto.js` con barrel estrenado,
`viewer/lista-sobrante.js` + `viewer/piezas.js`, `app/cableado-derivacion.js`, y
retoques en `gml/serialize-cp.js`, `gml/descargar.js`, `report/`, `index.html`,
`estilos/app.css`. **Se actualiza al cerrar la fase**, como en F08–F11.

> ⏳ **Esta ficha se abre con la fase, no al terminarla.** Lo que aquí se dice del
> futuro está en futuro; lo medido lleva su fecha. Al cerrar se reescribe para que
> diga lo que hay y no lo que se pensaba hacer, y lo que decía antes **no se
> borra**: se conserva tachado o citado al lado de lo medido, igual que en las
> fichas de F05 a F11. Manda lo medido (regla de oro 8).

## Objetivo

**Que alterar un lindero deje de ser un expediente imposible de cerrar.**

El problema está medido, no estimado: la aplicación **no cierra más de 1 de cada 5**
expedientes de parcelario reales de su autor. Mover un lindero obliga a aportar
**todas** las geometrías afectadas —el trozo que se suelta, el colindante
recortado— o el IVG sale negativo, y hasta hoy la aplicación solo sabe emitir la
parcela que tiene delante.

⛔ **El hueco no estaba excluido: no tenía nombre.** El plan v4 recortó
«multiparcela» —que es un **formato de fichero**— y durante ocho fases se leyó
como si también recortara el «expediente de varias parcelas», que es un **flujo de
trabajo**. Son cosas distintas, y confundirlas costó construir para el caso raro.
La corrección del vocabulario es parte del entregable: ver «Deuda saldada».

**Lo que la fase 1 entrega:** a partir de una parcela del Catastro con un lindero
movido **hacia dentro**, la aplicación *deriva* el sobrante `P_of − P_new`, lo
*propone* pieza a pieza con su área y su grosor —el usuario incluye, excluye y
nombra—, demuestra el **cierre del conjunto sobre coordenadas ya redondeadas**, y
emite **un solo `.gml`** con N `gml:featureMember`. Cero peticiones de red: los dos
minuendos ya están en memoria.

## 🔻 OVERRIDES aplicables

- **O18 — Varias parcelas en un fichero.** ✅ **MEDIDO el 2026-08-03**: la Sede
  acepta un `.gml` con dos `gml:featureMember` e IVG **positivo**, CSV
  `XMWPXCN9J8DB9J89`. Lo instruía la línea 42 de la plantilla oficial desde F04.
  ⚠️ Medido con **dos**; tres o más es plausible y **no está medido**.
  **Consecuencia de diseño: el ZIP se cancela entero** — no hace falta ningún
  empaquetador, basta un bucle de `gml:featureMember`.
- **O19 — La referencia con sufijo del padre se acepta en segregación.** La cesión
  fue `7136910UF1473N.1` bajo `ES.LOCAL.CP` **con `nationalCadastralReference`
  sufijada**, no vacía. ⚠️ **Sabemos que la forma con sufijo vale, no que la vacía
  falle**: el comentario de `gml/serialize-cp.js` recibe una excepción escrita, no
  una corrección.
- **O20 — «Tipo de operación».** La Sede lo exige en un desplegable de **dos**
  opciones (Segregación · Subsanación), el IVG lo imprime, y es **el único dato del
  expediente con redundancia cero**: no viaja en el `.gml`, no lo valida nadie, y
  el informe no lo nombra. Un valor equivocado produce un IVG positivo con la
  etiqueta mal puesta, firmado y con su CSV.

## Alcance

**Entra (fase 1 · la cesión):**

- Derivar `cesion = P_of − P_new` y partirla en componentes conexas.
- **Una parcela por componente**, cada una con su `idLocal`. El invariante del
  modelo no se toca: una `Parcela` es UN exterior con huecos.
- Proponer las piezas con **área y grosor**, para incluir, excluir y nombrar. Las
  astillas se listan **con su aviso y sus cifras**; ninguna se descarta sola.
- ⛔ **La puerta `P_new ⊆ P_of`**: si la parcela CRECE, el sobrante sale vacío
  mientras hay vecinos afectados, y emitir ahí un expediente incompleto con total
  confianza sería el peor fallo de la fase. Se dice, y se remite a la fase 2.
- Comprobar el **cierre del conjunto** sobre coordenadas ya redondeadas a 2
  decimales, con **tres** afirmaciones: suma con tolerancia declarada, cero solape,
  y cobertura contra el contorno oficial.
- Emitir **un** `.gml` con N `gml:featureMember`, validando **cada pieza** por
  `validation/parcela.js` entera, y pasarlo por `validar:xsd --estricto`.
- «Tipo de operación» **propuesto, editable e impreso** en el informe — y cubre
  también el expediente de **UNA** parcela: el flujo F06→F07→F09 es una
  Subsanación que la aplicación no nombra, y ese hueco es de hoy.

**No entra, y se dice:**

| Se aparta | Por qué |
|---|---|
| **La fase 2 · el colindante recortado** | Necesita sacar `vecinas` de la clausura de `app/cableado-diagnostico.js` al modelo y una UI de asignación de trozos. Y `asignado_i` **no es derivable**: que un trozo liberado pase al vecino o se convierta en cesión es **jurídico**, no geométrico |
| **Una parcela con varias superficies disjuntas** (`nSurfaces > 1`) | Descartado a favor de una parcela por componente. `gml/ids.js` ya lo parametriza, así que la puerta queda abierta |
| **El informe que abarque las N parcelas** | Es F09 otra vez: encuadre para N geometrías, paginación, N literales y N tablas. Se entrega **el alcance declarado** —el papel dice cuántas parcelas hay y cuál describe— por una fracción del coste |
| **Medir 3 o más parcelas contra la Sede** | Lo medido son **dos**. Tres es plausible y no está probado; esta ficha promete lo medido |
| **El ZIP / CRC32 / `export/zip.js`** | Cancelado por medición (O18). El motivo por el que existía —el navegador **bloquea la segunda descarga automática y eso NO se puede detectar desde JavaScript**— queda satisfecho igual: una sola descarga lo evita por diseño |
| **La entrada por fichero del comprobador de conjunto** | Se recupera cuando la fase 1 esté en verde; por eso `conjunto.js` vive en `comprobacion/` y no en `derivacion/` |

## Criterios de aceptación

1. Con **un solo lindero movido** sale el conjunto completo, sin dibujar ninguna
   geometría más.
2. El comprobador enseña el residuo **con su superficie y su grosor**, y **sin
   calificarlo** (regla de oro 9).
3. Todo lo emitido es perfil `ENTREGA` y pasa el **XSD estricto**.
4. ⛔ **IVG positivo sobre un expediente real** presentado en la Sede. Es la única
   verificación que ninguna máquina de este proyecto puede firmar (regla de oro 8).
5. `@turf/difference` entra **por subpaquete** (regla de oro 6) y **con su delta de
   bundle medido**.
6. ⚠️ **SUSTITUIDO A PROPÓSITO.** Era «coste 0 px en el panel», la racha que F07 a
   F11 mantuvieron durante cinco fases. En Validación la lista del sobrante
   comparte pantalla con la tabla de vértices, así que **se rompe a propósito y con
   el número delante**: el panel no desborda en ninguno de los dos ejes, su pie
   cabe, y lo que la lista le quita a la tabla **está medido y escrito en esta
   ficha**.
7. El guion `16-derivar-cesion.js` sale `ok:true`, `problemas: []`.

## Mediciones

| | Qué decía | Qué se midió |
|---|---|---|
| **M1** *(2026-08-05, fase 0)* | El expediente de oro `7136910UF1473N` estaba solo en una tabla de `SPEC.md`: **ni un byte suyo en `test/`** | Versionado como fixture con procedencia y **dos** SHA-256. Medido con el código del repo: `areaValue` **466**, shoelace **466,2141** m², 12 vértices, 1 recinto, orientación horaria, `ES.SDGC.CP`. ⛔ **El parcelario SIGUE SIN LA SEGREGACIÓN** dos días después del IVG positivo, y eso es lo que lo hace útil: la geometría oficial es el **ANTES**, que es justo lo que la aplicación tiene delante al derivar |
| **M2** *(2026-08-05, fase 0)* | `SPEC.md` §7.1 publica un residuo de **0,0064 m²** | La cuenta que se puede REHACER hoy da **0,00595**. No se contradicen: aquélla salió de las superficies **sin redondear** de las dos piezas y la tabla publica las de 2 decimales. Cerrar los 4,5 cm² exigiría el `.gml` de dos miembros que se subió, y **ese fichero no está versionado**. Para lo que la cifra defiende da igual cuál sea: **las dos son mayores que cero**, y es eso lo que descarta el `==` |
| **M3** *(2026-08-05, fase 0)* | La auditoría de comentarios caducos listaba **ocho** sitios | Son **nueve**: el guardián encontró `report/pdf-parcela.js:1467`, que la lista no tenía. Y de paso destapó que **el PDF YA lista las N parcelas del fichero con su columna «En este informe»** — por el camino de COMPROBACIÓN. El informe del camino propio todavía no la tiene |
| **M4** *(2026-08-05, revisión de diseño)* | El bloque del sobrante «cabe en el panel» | **Medido en la aplicación real** a 1440×900 y 1280×720: cuesta **96,63 px vacío + 31,00 px por fila**. El invariante de **267,44 px** de la tabla de vértices se rompe con la **QUINTA pieza**. ⛔ Y el panel **no desborda: la tabla encoge en silencio**, que es la regla de oro 1 en versión maquetación |

## Deuda declarada

- ⏳ **Los tres comentarios caducos de `gml/serialize-cp.js`** siguen afirmando que
  «multiparcela está fuera de alcance». Los reescribe la tarea que convierte
  `MIEMBROS = 1` en un bucle, porque toca esa misma zona. La excepción está
  **declarada y vigilada** en `test/contrato.test.js`: cuando esa tarea entre, la
  lista tiene que vaciarse o la suite se pone roja.
- ⏳ **El `.gml` de dos `featureMember` que la Sede aceptó no está versionado.**
  Mientras siga así, la prueba de cierre contrasta contra los 466,2141 del fixture
  pero **no reproduce byte a byte** lo que obtuvo el CSV.
- ⏳ **El techo de CSS.** La hoja va **5.150 B por encima** del techo de 42.064 B, y
  la quinta rebanada del rework sigue sin cerrar. F17 **no lo resuelve y sí lo
  empeora**: cada byte suyo entra con asiento propio y `rebanada: null`.
- ⏳ **Cuatro decisiones de accesibilidad abiertas** (revisión de diseño): nombre
  accesible de las casillas y los campos, dónde se pinta la invalidación de la
  lista, dónde se pintan los `saltados` de una resta que no se pudo medir, y qué se
  enseña cuando una pieza cae fuera del encuadre del mapa.
- ⏳ **El desplegable de «Tipo de operación» no se ha explorado más allá de sus dos
  opciones**, y **no se ha medido** si el IVG se queja ante una combinación
  incoherente (Segregación con un miembro, o al revés).

## Deuda saldada

- ✅ **El vocabulario.** «Multiparcela está fuera de alcance» dejó de ser cierto el
  2026-08-03 y seguía sosteniendo invariantes en nueve sitios. Corregido **el
  motivo, jamás el invariante**, con guardián que deja retractar la frase y no deja
  afirmarla.
- ✅ **El nombre del fichero.** `PREFIJO_NOMBRE` decía «parcela» en singular para un
  fichero que puede llevar varias. Con `miembros > 1` pasa a `expediente`, y el
  camino de una sola parcela **da exactamente el mismo nombre que antes**, con
  guardián de regresión: tres exportaciones más derivan su nombre cortando esa
  cadena por la longitud del prefijo.

## Lo que NO cubre ningún test de la suite, dicho por escrito

- **Que la Sede acepte el expediente.** Ningún XSD expresa las reglas de negocio del
  IVG. Criterio 4, y es la única verificación que cierra la fase.
- **Que el navegador no bloquee la descarga.** No hay callback ni excepción: desde
  JavaScript **no se puede ver**. Se evita por diseño (un solo fichero) y se mira en
  el guion de navegador.
- **Que «se propone, no se crea» se entienda sin explicación.** Toda la decisión de
  proponer las piezas en vez de crearlas se apoya en eso, y **eso no lo puede firmar
  un test**: es el punto bloqueante del checklist humano §13.
- **El reparto de píxeles del panel.** jsdom no maqueta. Lo mide el guion 16 en un
  navegador de verdad.

## Estado

⏳ **EN CURSO.** Fase 0 (abrir la fase) **hecha el 2026-08-05**: el expediente de
oro entra como fixture con guardián, las justificaciones caducadas dejan de
sostener invariantes, el fichero de varias parcelas estrena nombre, y esta ficha
existe. Suite en **6.011 pruebas / 133 ficheros**.

Quedan las fases 1 a 5: los tres cimientos puros, la derivación y el cierre, la
entrega y el acto jurídico, la pantalla del sobrante, y los gates.

## Referencias

- `SPEC.md` §3 (overrides **O18**, **O19**, **O20**), §4 (fila P11), §7.1 (la
  segunda verificación con certificado) y §7.2 («Tipo de operación»).
- `test/fixtures/gml/PROCEDENCIA.md` — la ficha del expediente de oro.
- `test/gml/fixture-oro-f17.test.js` — la que ejecuta esa procedencia.
- `spec/feature-07-diagnostico-parcela.md` — de donde salen `medirPieza`, el umbral
  de astilla y el patrón de «no se pudo medir».
- `spec/feature-04-gml-parcela.md` — el sobre de ENTREGA y los dos perfiles.
