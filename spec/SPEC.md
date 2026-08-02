# SPEC — Concreta GML

**Proyecto:** Concreta GML — herramienta web de generación y diagnóstico de GML para la Sede Electrónica del Catastro.
**Naturaleza:** especificación ejecutable, descompuesta en features del tamaño de una tarea de Plan Mode.
**Deriva de:** `PLAN_MODULO_GML.md` (spec v4, especificación cerrada) + `MEJORES_PRACTICAS_GML.md` (dossier de I+D verificado).
**Fecha:** 2026-07-24.

Este documento es el **maestro**. No contiene el detalle de cada fase; contiene lo transversal (decisiones, reglas de oro, correcciones al plan) y el **índice por prioridad** que apunta a cada `feature-N.md`. Cada feature es autocontenido y dimensionado para una única sesión de Plan Mode.

---

## Cómo usar este documento

1. Lee **§1 (decisiones)**, **§2 (reglas de oro)** y **§3 (overrides)**: es lo que gobierna *todo* el código. Una sola pantalla cada uno.
2. Ve al **§4 · Índice por prioridad**, elige el primer feature no hecho y abre solo su `feature-N.md`.
3. Cada feature declara sus **dependencias**: no empieces uno sin sus predecesores en verde.
4. Cuando el plan v4 y el dossier discrepen, **manda el dossier** (§3). Cada override está marcado en el feature con `🔻 OVERRIDE`.
5. Fuente de verdad última cuando algo del Catastro no esté claro: **un GML real descargado del WFS** (fixtures en `test/fixtures/gml/`), no la documentación ni el criterio propio.

---

## 1 · Decisiones capturadas (entrevista de arranque)

| Eje | Decisión | Consecuencia en la spec |
|---|---|---|
| **Motivación** | **Producto comercial** (competir con gmlweb.com). | El foso son las funciones que la competencia no tiene: diagnóstico de encaje, descripción literaria de linderos, memoria firmable. Se protegen como features propios (F07, F09) y no se recortan. |
| **Alcance** | **Toda la app** del plan v4 (parcela + edificio + visor de comprobación). | Se generan features para las 17 fases (§18 del plan). |
| **Edificio** | **Al final, baja prioridad.** | F11–F14 cierran el índice; parcela debe ser producto publicable antes de tocar edificio. |
| **Diferenciación** | **Las cuatro:** diagnóstico 3 bandas, linderos literarios, memoria firmable, importación DXF/CAD. | Ninguna es opcional; entran en F01 (DXF), F07 (diagnóstico), F09 (linderos + memoria). |
| **Innegociables** | **Frontend puro sin backend** · **GML que pase IVG/ICUC.** | Ningún feature puede introducir servidor. La fidelidad al Catastro se blinda con test de ida y vuelta contra fixtures reales (F04, F13). |
| **Stack** | **Fijas solo las reglas de oro** (§2); el resto de librerías, abierto a Plan Mode. | Los features fijan el *qué*; Plan Mode elige el *cómo* salvo donde una regla de oro lo determine. |
| **Territorio** | **Península + Baleares ahora** (husos 29/30/31, EPSG 25829/30/31). **Canarias diferido** (32628). | F00 (huso) implementa 29/30/31; deja el gancho para 32628 marcado `DIFERIDO`. |
| **Prioridad** | **Orden del plan:** paridad en parcela primero, diagnóstico tras WFS+edición. | El índice §4 respeta el orden de fases; el corte de paridad va tras F04. |
| **Design system** | **Referencia, no obligación** (`prototipo/_ds/concreta-design-system-…`). | Los features de UI lo citan como guía de partida; las decisiones visuales finas quedan a Plan Mode. |
| **Correcciones** | **El dossier verificado manda; cada override se marca.** | §3 consolida los overrides; cada feature afectado los repite con `🔻 OVERRIDE`. |

### Fuera de alcance (no implementar "por si acaso")

Móvil/responsive · multiusuario/cuentas/cloud · País Vasco y Navarra (catastros forales: "no encontrado" es estado válido, no fallo) · y todo lo del plan §2.3: multiparcela, unión/agregación, conversión v3→v4, división/segregación, entrada por distancia y rumbo, procedencia por vértice, comparador de vuelos, backend.

---

## 2 · Reglas de oro (gobiernan todo el código)

Combinan §23 del plan y §0.3 del dossier. Todo feature las respeta sin repetirlas.

1. **Ningún error silencioso.** Entidad DXF descartada, arco discretizado, cierre compensado, coordenada redondeada, parte sin geometría, huso deducido: el usuario se entera. *Un GML que valida estando mal es peor que uno que falla.*
2. **La geometría oficial se conserva intacta** (`geometriaOficial`/`construccionOficial`). Es el término de comparación del diagnóstico.
3. **Modelo en UTM, siempre.** Ninguna función de `model/`/`geometry/` acepta ni devuelve lat/lon. Geográficas solo para pintar.
4. **Modelo = POJO plano.** Coords como `[x,y]`, sin métodos ni instancias de clase: `structuredClone` (undo/redo) no clona funciones ni prototipos. Anillo guardado **sin cerrar** (el vértice de cierre se añade solo al serializar).
5. **Superficie por fórmula del polígono (shoelace) sobre UTM, nunca `turf.area`** (es geodésica esférica en grados). **Trasladar a origen local** (restar el primer vértice) antes del shoelace para evitar cancelación float64 con Norte ≈ 4·10⁶.
6. **De Turf, solo lo topológico.** Seguras sobre UTM: `booleanPointInPolygon`, `booleanContains/Within/Intersects`, `kinks`, `intersect/union/difference`, `booleanClockwise`, `pointOnFeature`. **Prohibidas:** `area`, `distance`, `length`, `buffer`, `along`, `midpoint`, `bearing`, `nearestPointOnLine` → helpers euclídeos propios (`hypot`, proyección punto-segmento). Importar por subpaquete (`@turf/kinks`), no el meta-paquete.
7. **Sin backend, sin proj4js, sin html2canvas.** Llamadas externas aisladas en `src/services/` (una por proveedor, `CATASTRO_BASE` única para contingencia CORS). UTM por serie de Krüger/Karney propia. Plano del informe compuesto a mano en canvas.
8. **Verdad numérica externa.** El GML real del WFS manda sobre la documentación y sobre el criterio. Test de ida y vuelta contra fixtures reales.
9. **La aplicación mide; el colegiado interpreta y firma.** Ninguna cifra lleva juicio de valor: sin semáforos, sin "válido/no válido", sin `config/umbrales.json`. El margen ±0,5 m urbana / ±2 m rústica solo como **capa informativa** ("margen de identidad del Catastro"). Única excepción: **invasión a colindante** (hecho topológico binario, admite ámbar).
10. **`gml:id` es XML ID: empieza por letra.** Prefijar siempre (`ES.LOCAL.CP.<ref>`, `Surface_…`, `MultiSurface_…`, `ReferencePoint_…`). Nunca la RC desnuda (empieza por dígito).
11. **Precisión del modelo vs de salida.** Modelo en float64 completo, sin redondear entre ediciones; redondear a 2 decimales solo al serializar, y calcular la superficie publicada **desde las coordenadas ya redondeadas** para que cuadre con el GML.

---

## 3 · Overrides — el dossier corrige al plan v4

Donde el plan y el dossier discrepan, **manda el dossier** (capa de verificación inversa). Cada feature afectado repite el override en su sitio con `🔻`.

| # | Punto | Plan v4 dice | ✅ Verdad verificada (dossier) | Tier | Feature |
|---|---|---|---|---|---|
| O1 | **Orientación de anillos** | §8: "exterior antihorario, huecos horario ⚠️ verifica" | **Exterior HORARIO, huecos antihorario** en el GML real del WFS (área firmada = −1536 = `areaValue`). ⚠️ Matizado 2026-07-27: **no es un requisito, es una convención.** La plantilla oficial del Catastro tiene el exterior ANTIHORARIO (+236,05 m²) y es el fichero que ellos publican como válido. Se sigue emitiendo horario por fidelidad al dato del WFS, no porque lo otro se rechace. ✅ **Aplicado a la LECTURA el 2026-07-30 (F08, comprobación C4):** la orientación del exterior de un GML ajeno se rotula como **nota informativa y jamás como error**. Un fichero antihorario no está mal — la plantilla que publica el propio Catastro lo es. | S1 (VERIFICADO, alcance corregido) | F00, F04, F08 |
| O2 | **srsName parcela** | §9: `urn:ogc:def:crs:EPSG::25830` (URN) | ⛔ **CORREGIDO 2026-07-27 — ver §3.1.** Hay **una forma por perfil**: URN en la ENTREGA (lo que se sube), URI OGC en la DESCARGA del WFS. Las dos son `xsd:anyURI` y las dos validan. El plan v4 tenía razón para la entrega. | REFUTADO | F04, F13 |
| O3 | **Raíz parcela** | §9: `FeatureCollection` genérico | ⛔ **CORREGIDO 2026-07-27 — ver §3.1.** La ENTREGA es **`gml:FeatureCollection` + `gml:featureMember`**; la raíz `wfs:FeatureCollection` es la de la DESCARGA y es lo que hizo que **la Sede rechazara el fichero**. | REFUTADO | F04 |
| O4 | **inspireId parcela** | (no detallado) | ⛔ **CORREGIDO 2026-07-27 — ver §3.1.** Lo que cuenta es el **namespace** (INSPIRE base **3.3**), no el prefijo: un prefijo no es información en XML. La plantilla oficial usa `base:` sobre 3.3 y valida. | PARCIALMENTE REFUTADO | F04 |
| O5 | **Orden XSD de `cp:CadastralParcel`** | (no fijado) | `areaValue → beginLifespanVersion → endLifespanVersion → geometry → inspireId → label → nationalCadastralReference → referencePoint`. El validador lo exige. | OBSERVADO | F04 |
| O6 | **`areaValue`** | §9: "2 decimales en superficie" | **Entero** (`uom="m2"`), informativo (fixture 1535.87 → 1536). Coordenadas sí a 2 decimales. | S1/B1 | F00, F04 |
| O7 | **CORS del WMS/servicios** | §11.3, §22: "⚠️ pendiente de verificar" | **RESUELTO: SÍ.** `ACAO:*` + HTTPS en WFS/WMS/OVC/IGN; tesela WMS con `crossOrigin='anonymous'` → canvas **CLEAN**. La Receta A es viable. | S5 (VERIFICADO) | F03, F05, F09 |
| O8 | **Umbral de bloqueo** | (HALLAZGOS: "3.600/h → 4 h") | **NO existe en fuente oficial** (NO_RESPALDADO). Lo oficial: denegación **~10 días** + detección de rotación IP/UA. **No citar la cifra.** No rotar UA. ⚠️ Matizado 2026-07-28 al implementar F05: **«manda User-Agent de navegador» (plan §5.4) está REFUTADO** —200 con UA de curl, con UA de navegador y sin cabecera alguna— y además es **inaplicable**: `User-Agent` es *forbidden header name* y un navegador no puede fijarla. La app no toca ni una cabecera, y el criterio «no se rota» se cumple por construcción. | C-1 (+ medido) | F05 |
| O14 | **Errores del WFS** | (no cubierto) | ⛔ **Todo error llega con HTTP 200** y `ows:ExceptionReport` **sin prefijo**. `response.ok` no clasifica nada. Y **no existe la «colección vacía»**: un BBOX sin parcelas da el **mismo `exceptionCode`** que una RC inexistente, así que «vacío» y «no existe» **no se distinguen** salvo por texto libre bilingüe y con errata — sobre el que está **prohibido ramificar**. ✅ **Segundo consumidor, 2026-07-30 (F08):** `app/cableado-comprobacion.js` pide el parcelario desde una vía nueva y **no mira ni un `response.ok` ni una línea del `ExceptionReport`**: pregunta a `services/catastro.js`, que ya clasificó con `TIPO_RESPUESTA_WFS`. Que el override se cumpliera «gratis» en la segunda vía es la prueba de que estaba encapsulado donde tocaba. | MEDIDO 2026-07-28 · reusado 2026-07-30 | F05, F08 |
| O15 | **`GetParcelsByBBox`** | (spec F05 lo nombra) | **No existe.** El catálogo real publica `GetParcel`, `GetNeighbourParcel`, `GetZoning`, `GetParcelByZoning` y `GetFeatureById`. El BBOX se hace con `GetFeature` estándar. Y **`GetNeighbourParcel` incluye a la propia parcela**, en 2.ª posición. | MEDIDO 2026-07-28 | F05 |
| O16 | **Conteo del WFS** | (no cubierto) | **`numberMatched` y `numberReturned` MIENTEN** cuando se usa `count`: declaran el total sin truncar. Contar `<member>`, nunca leer los atributos. ✅ **Cumplido por construcción en F08 (2026-07-30):** `comprobacion/gml.js` no nombra `numberMatched` ni una vez — el «hay N parcelas en este fichero» del cajón es `parcelas.length`, es decir, miembros **leídos de verdad**. `gml/parse.js` conserva los dos atributos en `resumen.wfs` **como cadenas sin convertir**, y ese es el sitio correcto para un dato del que no hay que fiarse: presente para quien lo mire, inservible por accidente para quien lo sume. | MEDIDO 2026-07-28 · confirmado 2026-07-30 | F05, F08 |
| O17 | **Signo del offset de lindero** | Esta vez el que se corrige es **el dossier**: §3.6 (línea 569) da `nrm = (u.y, −u.x)` sin decir respecto a qué anillo, y la spec de F06 lo leyó como «en un anillo horario la derecha del recorrido apunta hacia fuera» | ⛔ **La fórmula, aplicada literalmente, mueve el lindero al REVÉS en la mitad de los casos.** `(u.y, −u.x)` es la normal a la DERECHA del recorrido: apunta afuera en un anillo ANTIHORARIO y **adentro** en uno horario. Y este proyecto se encuentra **los dos** sentidos: el WFS emite el exterior horario (O1), la plantilla oficial del Catastro lo trae antihorario y el usuario dibuja como quiere. El signo **no puede venir de una convención: se MIDE** con `geo/area.js#orientacion` → **`nrm_fuera = orientacion(anillo) · (u.y, −u.x)`**. Fijado por el test del anillo invertido: un cuadrado de 100 m² **y su `reverse()`** dan los dos **110 m²** con `d = +1`, y lo mismo sobre los 15 lados de la parcela real. | MEDIDO 2026-07-28 | F06 |
| O9 | **Licencia Leaflet** | §21: "Leaflet MIT" | **Leaflet = BSD-2-Clause.** (Turf/jsPDF/html2canvas/proj4js sí MIT.) Corregir créditos. | S7 | F03, F16 |
| O10 | **Edificio: raíz y srsName** | §16.2 (genérico) | Raíz **`gml:FeatureCollection` + `gml:featureMember`**, namespaces `inspire.jrc.ec.europa.eu` *draft* + base 3.2, **srsName URN**. Asimetría deliberada con parcela. | S3 | F13 |
| O11 | **BuildingPart** | §4.2 (modelo) | Confirmado: **una `BuildingPart` por volumen de altura homogénea**, cada una con huella propia + plantas sobre/bajo rasante independientes (fixture real: 13 partes). Valida el modelo del plan. | S4 (VERIFICADO) | F12, F13 |
| O12 | **DXF mínimo** | §13.2 (genérico) | `LWPOLYLINE` no es válido en R12; mínimo real **AC1014 (R14)**, en la práctica **AC1015 (R2000)**. | B2 | F01, F10 |
| O13 | **Canarias** | (no cubierto) | EPSG **32628** (WGS84/UTM 28N) único para todo el archipiélago; forzar huso 28. **DIFERIDO** por decisión de alcance. | S11/C5 | F00 (gancho) |

**Tolerancias oficiales de identidad** (dossier S6/C8, BOE-A-2020-12111), solo como capa informativa nunca como veredicto: perímetro **±0,50 m urbana / ±2,00 m rústica**, superficie **≤5%**, precisión de captura **<25 cm (85% ≤20 cm)**.

### 3.1 · ⛔ El error del dossier que costó un rechazo del IVG (2026-07-27)

**Qué pasó.** Se subió a la Sede Electrónica un GML generado por esta app y el
IVG lo rechazó: *«El archivo no cumple el esquema Inspire GML»*. La suite tenía
1.784 pruebas en verde, todas derivadas de ficheros reales.

**La causa, medida** con libxml2 contra los XSD oficiales de INSPIRE:

```
Element '{http://www.opengis.net/wfs/2.0}FeatureCollection':
No matching global declaration available for the validation root.
```

| Fichero | vs `cp/4.0` solo | vs `cp/4.0` + `wfs/2.0` |
|---|---|---|
| `cp_ejemplo_explicativo.gml` (plantilla oficial del Catastro) | **VÁLIDO** | válido |
| `cp_parcela_9398516VK3799G.gml` (descarga del WFS) | **INVÁLIDO** | válido |

El validador del IVG carga el esquema de **parcela**, no el de WFS. La raíz
`wfs:FeatureCollection` no está declarada ahí y el documento muere en la primera
línea, sin llegar a mirar la geometría — que era correcta.

**El error de raíz, y es de método.** Los overrides O2, O3 y O4 se derivaron de
`cp_parcela_9398516VK3799G.gml`, que es la **DESCARGA** del WFS: lo que el
servicio *devuelve*. Pero esta herramienta produce una **ENTREGA**: lo que el
técnico *sube*. Son dos direcciones del mismo formato y **el sobre es distinto**.
La regla de oro 8 («manda el fichero real») se cumplió al pie de la letra sobre
el fichero real **equivocado**, y todos los guardianes confirmaron el error en
vez de detectarlo. Un test derivado de la fuente correcta es una garantía;
derivado de la fuente equivocada es una garantía de estar mal.

**La fuente de verdad de la entrega** es
[`cp_ejemplo_explicativo.gml`](../test/fixtures/gml/cp_ejemplo_explicativo.gml),
la plantilla que publica la propia D.G. del Catastro y que sus instrucciones
mandan usar como punto de partida. Está versionada con su procedencia y su
SHA-256 en [`PROCEDENCIA.md`](../test/fixtures/gml/PROCEDENCIA.md).

**Los dos sobres, ahora explícitos** en `gml/_comun.js#PERFILES`:

| | `PERFIL.ENTREGA` (defecto, lo que se sube) | `PERFIL.WFS` (lo que se descarga) |
|---|---|---|
| Raíz | `gml:FeatureCollection` **con `gml:id`** | `wfs:FeatureCollection` |
| Miembro | `gml:featureMember` | `member` |
| `schemaLocation` | solo `cp/4.0` | `wfs/2.0` **+** `cp/4.0` |
| `srsName` | `urn:ogc:def:crs:EPSG::25830` | `http://www.opengis.net/def/crs/EPSG/0/25830` |
| `timeStamp`/`numberMatched`/`numberReturned` | no existen | sí |
| `endLifespanVersion`, `referencePoint` | no se emiten | sí |
| `beginLifespanVersion` | `xsi:nil` (opcional) | dateTime obligatorio |

**Dos trampas más que salieron al medir, y que conviene no repetir:**

1. **`gml:id` es `xs:ID`: único en TODO el documento.** `UTM_1.gml` —un alta real
   de un generador de terceros— repite el mismo valor en la raíz y en el
   `cp:CadastralParcel`, y eso **invalida el fichero entero**. No sirve de
   plantilla. Nuestra raíz lleva el **namespace INSPIRE** como `gml:id`, igual
   que la plantilla oficial.
2. **La pareja `localId` ↔ `namespace` es UNA afirmación, no dos ajustes.** La
   FAQ del Catastro: si el `localId` es la referencia catastral, el namespace
   **debe** ser `ES.SDGC.CP`; si la parcela no existe en el Catastro, va
   `ES.LOCAL.CP` con un identificador propio. La app emitía la referencia real
   bajo `ES.LOCAL.CP`, diciendo a la vez «esta es su referencia catastral» y
   «esta parcela no está en el Catastro».

**Y el guardián que no existía.** `npm run validar:xsd` estaba escrito desde F04,
pero era **opcional** y dependía de `xmllint`, que no estaba instalado: salía
`SALTADO` con código 0 y **no llegó a ejecutarse ni una vez**. Ahora acepta dos
motores (`xmllint` o Python + `lxml`), tiene modo `--estricto` donde no poder
validar es un fallo, y **corre en CI como gate previo a publicar**. Un guardián
que puede saltarse a sí mismo en silencio no protege de nada.

---

## 4 · Índice por prioridad

Orden de construcción (= orden de fases del plan §18, decisión de la entrevista). Cada fila apunta a su `feature-N.md`. **Riesgo** señala dónde se concentra la incertidumbre técnica (atención extra de Plan Mode). No empieces un feature sin sus **dependencias** en verde.

### Bloque A — Núcleo de parcela (producto publicable pronto)

| Prio | Feature | Objetivo (una línea) | Depende de | Riesgo | Estado (2026-07-28) |
|---|---|---|---|---|---|
| P0 | [F00 · Cimientos](feature-00-cimientos.md) | Modelo de datos, motor UTM, área/orientación, undo/redo. Sin UI. | — | **Alto** (motor UTM, precisión) | ✅ hecho |
| P1 | [F01 · Entrada parcela](feature-01-entrada-parcela.md) | Parsers LIST/TXT/DXF (bulge) + detecciones defensivas. | F00 | Medio (bulge DXF) | ✅ hecho |
| P2 | [F02 · Validación parcela](feature-02-validacion-parcela.md) | Reglas geométricas en vivo; errores vs avisos con vértices señalados. | F00 | Bajo | ✅ hecho |
| P3 | [F03 · Visor](feature-03-visor.md) | Leaflet, capas base + WMS por encuadre, tabla sincronizada. | F00 | Medio (WMS no teselado) | ✅ código y pruebas · ⏳ **firma humana** · ⛔ **defecto suyo corregido el 2026-08-02**: el encuadre era el último paso del **montaje** y nunca se repetía, así que el mapa no seguía a la parcela que entraba después (`viewer/index.js` paso 7; F08 M20) |
| P4 | [F04 · GML parcela](feature-04-gml-parcela.md) | Serializador CP 4.0 + test de ida y vuelta contra fixtures. | F00, F01 | **Alto** (fidelidad IVG) | ✅ hecho · **aceptado en la Sede** (§7) |

> 👉 **Corte de paridad funcional con la competencia en parcela.** A partir de aquí, el diferencial.

### Bloque B — Diferencial de parcela (el foso comercial)

| Prio | Feature | Objetivo | Depende de | Riesgo | Estado (2026-07-30) |
|---|---|---|---|---|---|
| P5 | [F05 · Catastro en vivo](feature-05-catastro-vivo.md) | Cliente WFS, carga por RC editable, geocodificación, deducción de RC, colindantes, caché. | F00, F03 | Medio (anti-bloqueo) | ✅ hecho · ⏳ arrastra la firma humana de F03 · ⛔ **deuda suya saldada el 2026-08-02**: las colindantes se traían y **no las dibujaba nadie** (`viewer/colindantes.js`, pane 405; F08 M21) |
| P6 | [F06 · Edición parcela](feature-06-edicion-parcela.md) | Arrastrar/insertar/eliminar, edición numérica, offset de lindero, snap, acotaciones en vivo. | F03, F05 | Medio (offset/snap) | ✅ código y pruebas (2.894/69) · ⏳ **firma humana** · ⚠️ `edit/dibujo.js` **diferido a F12**; el presupuesto de altura del panel **se cerró el 2026-07-29** llevando las herramientas a una barra sobre el mapa (tabla de vértices: 64 → 303 px) |
| P7 | [F07 · Diagnóstico parcela](feature-07-diagnostico-parcela.md) | Métricas de encaje, comparación a tres bandas, representación. **Sin umbrales.** | F05, F06 | Medio | ✅ código y pruebas (3.312/80) · ⏳ **firma humana** (checklist §8) · cajón flotante sobre el mapa: abrirlo no le quita ni un píxel al panel (el único coste de F07 son los ~36 px del CTA del pie, medidos); ni una dependencia nueva (la diferencia sombreada es el `fillRule:'evenodd'` de Leaflet); la desviación se redefinió POR LADO contra el contorno oficial entero (spec M2) y el filtro de astillas es de GROSOR, no de área (spec M4) |
| P8 | [F08 · Comprobar GML existente](feature-08-comprobar-gml.md) | Recorrido corto: cargar GML ajeno → validar fichero → diagnóstico. | F04, F07 | Bajo | ✅ código y pruebas (**3.925/90, 2026-08-02**) · ⏳ **firma humana** (checklist §9): **se recorrió el 2026-08-02, encontró TRES defectos reales y NO llegó a firmarse** · es la **PRIMERA vía de fichero de la app**, no la tercera: hasta esta fase no había ni un `<input type="file">`, ni un `FileReader`, ni un `drop`, y los parsers de F01 llevaban desde la fase 1 en verde sin llamante; dos capas nuevas puras (`comprobacion/`, `report/`); cierra el punto que F04 §5 dejó abierto (la autointersección que solo `kinks` ve); ⚠️ **criterio 4 a medias**: el GML de edificio se detiene con honradez, pero encaminarlo al contraste de construcción exige **F14**, que no existe; ✅ **el guion `10-comprobar-gml.js` sale `ok:true`, `problemas: []`, `advertencias: []`** — pero su PRIMERA corrida salió `ok:false` por **DOS defectos de producción reales** que él destapó y que la suite no podía ver (botones de los cajones en `system-ui` por un `font: inherit` en línea que dejaba muerta la regla CSS; y la descarga del informe **cerrando el cajón de diagnóstico**, con el acuse de recibo en un `role="status"` invisible — regla de oro 1 rota en el último gesto). Los dos **corregidos y con guardián** (M17/M18 de la ficha), ninguno donde se notó · ⛔ **y después la FIRMA HUMANA destapó TRES más que el guion tampoco veía, DOS de ellos heredados de F03 y F05** (M20/M21/M22): el mapa **no reencuadraba nunca** al entrar otra parcela, las **colindantes no se dibujaban en ninguna parte**, y la referencia del GML **no llegaba al campo**. Corregidos, con guardián, y **medidos por el guion desde el 2026-08-02** |
| P9 | [F09 · Informe parcela](feature-09-informe-parcela.md) | Canvas propio a 300 ppp (Receta A), jsPDF, descripción literaria, firma. | F07 | **Alto** (plano 300 ppp) | — |
| P10 | [F10 · Persistencia y exportación](feature-10-persistencia-export.md) | IndexedDB (expedientes), autoguardado, exportación DXF. | F04 | Bajo | — |

> ⏳ **La «firma humana» es un gate de verdad, no un trámite.**
> `scripts/smoke-navegador/CHECKLIST-HUMANO.md` recoge lo que **ninguna máquina de
> este proyecto puede firmar**: gestos con un ratón de verdad, teclado, el fallo de
> red provocado a mano y el juicio visual. Bloquea el cierre formal de **F03 → F05 →
> F06 → F07 → F08** en cadena (la §8, de F07, añade el punto BLOQUEANTE de si alguna
> cifra o color se lee como un veredicto; la §9, de F08, hereda ese carácter y
> pregunta si alguna nota de la comprobación se lee como un **juicio sobre el trabajo
> de otro técnico**). Que la suite esté verde y el build limpio **no cierra una fase**
> por sí solo (§6.2 y §6.3 son necesarios, no suficientes).
>
> ⛔ **Y esto ya no es una afirmación de principios: está demostrado.** La primera
> pasada de la §9 (2026-08-02) encontró **tres defectos reales**, y **dos no eran de
> F08: venían de F03 y de F05** — el mapa que no reencuadraba nunca y las parcelas
> colindantes que no se dibujaban en ninguna parte. **Ninguno lo veía la suite
> (3.845 pruebas entonces) ni el guion de humo**, y por un motivo que conviene tener
> escrito: no fallaban una afirmación, **es que la afirmación no existía** —las
> pruebas del visor traen su geometría a mano y la app arranca ya encuadrada sobre
> ella; y de las vecinas nadie decía que se pintaran—. **Un gate no encuentra lo que
> no se le ocurre preguntar**, y por eso el último es una persona. Detalle en
> `feature-08-comprobar-gml.md` M20–M22.

### Bloque C — Edificio (baja prioridad, capítulo posterior)

*No empezado, ninguno. Sin columna de estado por eso.*

| Prio | Feature | Objetivo | Depende de | Riesgo |
|---|---|---|---|---|
| P11 | [F11 · Edificio: entrada y modelo](feature-11-edificio-entrada.md) | Selector simplificado/completo, vías de entrada, una polilínea = una parte, atributos. | F10 | Medio |
| P12 | [F12 · Edificio: partes y plantas](feature-12-edificio-partes.md) | Lista de partes, plantas por parte, dibujar recinto, envolvente derivada. | F11 | Medio |
| P13 | [F13 · Edificio: validación y GML](feature-13-edificio-gml.md) | Reglas propias, serializador BU (URN, draft ns), fixtures `wfsBU.aspx`. | F12 | **Alto** (fidelidad ICUC) |
| P14 | [F14 · Edificio: contraste e informe](feature-14-edificio-contraste-informe.md) | Contraste opcional + pantalla "sin construcción registrada", informe con ficha de partes. | F13, F09 | Bajo |

### Bloque D — Cierre

*No empezado, ninguno.*

| Prio | Feature | Objetivo | Depende de | Riesgo |
|---|---|---|---|---|
| P15 | [F15 · Diccionario de errores](feature-15-diccionario-errores.md) | `errores-ivg.json` con estructura desde el día 1; se llena con el uso. | F04 | Bajo |
| P16 | [F16 · Integración Concreta](feature-16-integracion.md) | Sesión compartida, entrada desde el flujo principal, créditos/licencias. | F09, F10 | Bajo |

---

## 5 · Mapa feature → ficheros (§19 del plan)

| Feature | Ficheros principales |
|---|---|
| F00 | `model/parcela.js`, `model/edificio.js`, `geo/utm.js`, `geo/area.js`, `geo/huso.js`, `geo/cierre.js`, `edit/historial.js` |
| F01 | `parsers/list.js`, `parsers/txt.js`, `parsers/dxf.js`, `parsers/_comun.js` (contrato `ResultadoParse`/`Deteccion` + tokenizador), `geo/arco.js` (discretización bulge + ΔS), `parsers/importar.js` (orquestador + detecciones defensivas), `geo/huso.js`·`geo/cierre.js` (detectores de F00) |
| F02 | `validation/parcela.js` |
| F03 | `viewer/`, `services/ign.js`. ⛔ *Nota del 2026-08-02:* la **firma humana de F08** destapó un defecto de esta fase — `encuadrar()` se llamaba **una sola vez, al construir el visor**, así que el mapa nunca seguía a la parcela que entraba después. El arreglo es el **paso 7 de `viewer/index.js`** (reencuadre por cambio de identidad `refcat ?? idLocal`, nunca al editar) más `visor.encuadrar()`. Ver `feature-08-comprobar-gml.md` **M20** |
| F04 | `gml/serialize-cp.js`, `gml/parse.js`, `test/fixtures/gml/` |
| F05 | `services/catastro.js`, `storage/cache-catastro.js`, **`viewer/colindantes.js`**. ⛔ *Nota del 2026-08-02:* ese módulo es **deuda de esta fase**, encontrada por la **firma humana de F08**: las colindantes se traían, se publicaban por `alColindantes` y las usaban el snap de F06 y la invasión de F07, pero **no las pintaba nadie** — pulsar «Traer colindantes» dejaba el mapa igual. Se dibujan en `PANE.COLINDANTES` (zIndex **405**, el único pane **por debajo** de la parcela propia: comparten lindero) y las enchufa `app/main.js` como tercer suscriptor. Ver `feature-08-comprobar-gml.md` **M21** |
| F06 | ⛔ *Actualizado 2026-07-28 al terminar la fase, y 2026-07-29 al cerrar la deuda del panel; eran tres y son bastantes más.* `edit/snap.js`, `edit/offset.js`, `edit/vertices.js`, `edit/metricas.js`, `edit/_comun.js`, `geo/segmento.js`, `geo/metrica.js`, `config/operativos.js`, `viewer/edicion.js`, `viewer/acotaciones.js`, `viewer/barra-edicion.js` (+ `edit/historial.js#reiniciar`, `viewer/index.js`, `viewer/sincronizacion.js`, `app/main.js#cablearEdicion`, `app/cableado-catastro.js`). ~~`edit/dibujo.js` (base)~~ **NO se hizo: diferido entero a F12** |
| F07 | ⛔ *Actualizado 2026-07-29 al terminar la fase; era uno y son once.* `diagnostico/parcela.js` (orquestador), `diagnostico/topologia.js` (único con Turf), `diagnostico/desviacion.js`, `diagnostico/bandas.js`, `diagnostico/margen.js` (BOE, enuncia y no compara), `diagnostico/_comun.js`, `geo/poligono.js`, `geo/centroide.js`, `viewer/contraste.js`, `viewer/cajon-diagnostico.js`, `app/cableado-diagnostico.js` (+ `viewer/index.js#diagnostico`, `viewer/_comun.js#PANE.DIAGNOSTICO`, `validation/_comun.js` re-exporta, `config/operativos.*` 3 claves, `index.html` CTA, `app/main.js` paso 8) |
| F08 | ⛔ *Actualizado 2026-07-30 al terminar la fase; eran uno y medio y son siete nuevos más doce tocados — y **`gml/parse.js` no se tocó**: F08 lo estrena como llamante, que era el reparto que su cabecera anunciaba.* **Dos capas nuevas, las dos puras** (proyecto Vitest `node`, sin DOM ni red ni reloj): `comprobacion/_comun.js` (`TIPO_COMPROBACION`, 11 tipos), `comprobacion/gml.js` (el paso de Comprobación: cruza `parsearGml` con `validation/parcela.js`, `validation/reglas-huso.js` y `geo/area.js` — vive **por encima** de `validation/` y **no dentro** de `gml/`, porque `gml/` es capa de dominio y no conoce a nadie por encima suyo) y `report/contraste-texto.js` (**estrena el directorio que este mapa reservaba para F09**). Más `gml/decodificar.js` (bytes → texto, y la mentira del `encoding`), `viewer/cajon-comprobacion.js` (comparte la esquina `bottomleft` con el de F07, mutuamente excluyentes), `app/zona-fichero.js` (**genérico a propósito**: no sabe qué es un GML, para que F01 se enchufe sin rehacer la UI) y `app/cableado-comprobacion.js` (+ `app/main.js` paso 9, `app/cableado-catastro.js#textoProcedencia` exportada, `app/cableado-diagnostico.js`, `viewer/index.js#comprobacion`, `viewer/cajon-diagnostico.js` pie del informe, `gml/descargar.js#descargarTexto`, `gml/_comun.js` 3 tipos, `gml/index.js`, `index.js` barrel, `index.html`, `estilos/app.css`, `.gitattributes`). ⛔ *Y actualizado otra vez el **2026-08-02**, tras la firma humana:* **`viewer/colindantes.js`** (módulo nuevo, pero **la deuda es de F05**: ver su fila) y **`viewer/_comun.js#PANE.COLINDANTES`** en zIndex **405** — el único pane del visor por DEBAJO de la geometría propia, porque una vecina comparte lindero con ella—; el **paso 7 de `viewer/index.js`** (reencuadre vivo + limpieza de vecinas, la deuda es de **F03**) con `claveDeParcela`, la opción `colindantes` y `visor.encuadrar()`; el tercer suscriptor de `alColindantes` en `app/main.js`; y el campo de la referencia en `app/cableado-comprobacion.js` (forma canónica, y **vaciado** cuando el fichero no la trae). Los tres son **M20/M21/M22** de la ficha |
| F09 | `report/canvas.js`, `report/literal.js`, `report/pdf-parcela.js` |
| F10 | `storage/` (expedientes), `export/dxf.js` |
| F11 | `model/edificio.js`, entrada edificio |
| F12 | `edit/dibujo.js` (**entero**: F06 no llegó a estrenarlo), envolvente derivada en `model/edificio.js` |
| F13 | `validation/edificio.js`, `gml/serialize-bu.js` |
| F14 | `diagnostico/edificio.js`, `report/pdf-edificio.js` |
| F15 | `config/errores-ivg.json` |
| F16 | integración global, página de créditos |

---

## 6 · Definición de "hecho" (común a todo feature)

Un feature está **hecho** cuando:

1. Cumple su especificación y respeta las **reglas de oro** (§2) y los **overrides** aplicables (§3).
2. Sus **criterios de aceptación** (sección propia del feature) pasan.
3. **Tests en verde** — sin ellos no se pasa al siguiente feature (regla del plan §18). Geometría/serializadores en proyecto Vitest `node`; canvas/mapa en proyecto `dom`.
4. Ningún error silencioso nuevo; ninguna cifra con juicio de valor incorporado.
5. No introduce backend, proj4js ni html2canvas.

---

## 7 · Verificaciones con certificado — ✅ HECHAS (2026-07-27)

**Se subió un GML generado por la app a la Sede Electrónica y se cargó
correctamente.** Es la única verificación que ninguna máquina podía firmar, y
cerró de golpe el ciclo que empezó ese mismo día con el rechazo del IVG (§3.1).

Qué queda confirmado, y qué no:

| | |
|---|---|
| ✅ **El sobre de ENTREGA es el correcto** | La Sede acepta `gml:FeatureCollection` + `gml:featureMember` + `srsName` en URN + `schemaLocation` solo de cp/4.0. Confirmado **contra el sistema real**, no contra un XSD. |
| ✅ **La lectura del rechazo era la buena** | El mismo día, el mismo fichero salvo el envoltorio, pasó de rechazado a admitido. La causa aislada en §3.1 era la causa. |
| ✅ **`beginLifespanVersion` con `xsi:nil` vale** | Se temía que la Sede exigiera una fecha. No la exige, igual que su plantilla. |
| ✅ **`cp:label` vacío vale** | El riesgo de producto que se temía (`minLength`) no existía, y ahora está confirmado también en producción. |
| ⚠️ **La orientación sigue SIN discriminar** | Se subió con el exterior horario, así que esto no dice nada de qué pasa con el antihorario. La medición sobre la plantilla oficial (que es antihoraria) sigue siendo la mejor evidencia de que da igual. |
| ⚠️ **URI vs URN: resuelto por la vía práctica** | La URN funciona. Que la URI también funcionara en la subida no se ha probado ni hace falta: la forma canónica de la entrega ya está fijada. |

Las dos verificaciones del dossier §0.7 (Tier D) quedan cerradas en lo que
importaba: **emitir horario y emitir URN en la parcela son formas que la Sede
admite de hecho.** Lo que no se ha explorado es si las contrarias también, y ya
no es una pregunta que este proyecto necesite responder.

**Lo que sigue abierto no es de formato, es de contenido.** El IVG, además de
leer el fichero, emite un informe de validación gráfica que juzga reglas de
negocio —solape con parcelas colindantes, tolerancias de superficie y perímetro
(§3, tolerancias oficiales)— que ningún esquema expresa y que dependen de la
parcela concreta que se suba, no del generador. Eso es materia de F08 y F09.

✅ **Primera mitad respondida el 2026-07-30 (F08).** Ya se puede soltar un `.gml`
—propio, de otro despacho o de hace dos años— sobre la aplicación, ver qué es y qué
le pasa, y contrastarlo contra el parcelario **antes** de presentar nada, con el
informe de contraste descargable. Lo que queda para F09 es el documento con plano
y pie de firma; el de F08 es de **texto** y lo dice de sí mismo. Y sigue en pie la
advertencia de fondo: la aplicación **mide** las mismas magnitudes que el IVG juzga,
pero **no dictamina** ninguna (regla de oro 9), así que su informe no anticipa un
resultado — enseña los números con los que discutirlo.
