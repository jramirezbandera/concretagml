# Fixtures SINTÉTICOS — fabricados a mano, NO descargados de ningún sitio

**Ninguno de los cuatro `.gml` de este directorio es un fichero real.** Son mutaciones
deliberadas de los fixtures reales de [`..`](..), escritas para provocar un caso límite que
ningún fichero real cubre. **No valen como fuente de verdad de nada** —ni de coordenadas, ni de
formato, ni de cómo se comporta el Catastro— y no pueden usarse para derivar una decisión de
diseño: para eso están los de `..`, que sí son verdad externa (regla de oro 8 de
`spec/SPEC.md`). Aquí, si un fichero contradice al código, lo más probable es que el fichero
esté mal, porque lo escribimos nosotros.

Este documento existe porque un fixture sin procedencia es una opinión con formato de dato — y
uno **sintético** sin procedencia es una opinión disfrazada de medición. Este proyecto ya pagó
un rechazo del IVG por derivar del fichero real **equivocado** (`spec/SPEC.md` §3.1): la regla
de oro 8 se cumplió al pie de la letra sobre la fuente que no era, y todos los guardianes
confirmaron el error en vez de detectarlo. Un fixture inventado que se cuele entre los reales
es la misma trampa con menos excusa.

**Tres barreras para que no se confundan con los reales**, y las tres están medidas:

1. **Directorio aparte.** Los **seis** tests que barren `test/fixtures/gml/` lo hacen con
   `readdirSync(DIR_FIXTURES)` sin `recursive`, filtrando por `.gml`. La entrada `derivados` es
   un directorio y no acaba en `.gml`, así que **queda fuera de los seis**: `aceptacion-f04`,
   `comun`, `ids`, `parse`, `xml-oraculo` y `descargar.dom`. Los derivados se citan **por
   nombre** desde el test que los necesita, nunca por barrido.
2. **Aviso dentro del propio fichero.** Los cuatro llevan un comentario XML en la segunda
   línea, justo bajo el prólogo, que dice que son sintéticos y remite aquí. Quien abra el
   `.gml` sin pasar por este documento se entera igual.
3. **Esta ficha**, con la receta exacta de cada derivación: original, su SHA-256, la
   sustitución literal, y qué caso justifica el fichero.

---

## Lo que NO se ha fabricado, porque ya hay material real

**Fabricar un caso que ya tiene fichero real sería sustituir una medición por una opinión.**
Estos tres casos de F08 **no** están aquí y no deben estarlo:

| Caso | Fichero REAL que lo cubre |
|---|---|
| Parcela en CP **3.0** (la versión que la Sede ya no admite) | [`../UTM_1.gml`](../UTM_1.gml) — alta de particular de un generador de terceros |
| GML de **edificio** (otro tema, `puedeContinuar: false`) | [`../bu_building_9398516VK3799G.gml`](../bu_building_9398516VK3799G.gml) y [`../bu_buildingpart_9398516VK3799G.gml`](../bu_buildingpart_9398516VK3799G.gml) |
| **Varias parcelas en una DESCARGA del WFS** | [`../../catastro/wfs-neighbour-9398516VK3799G.xml`](../../catastro/wfs-neighbour-9398516VK3799G.xml) — 5 `<member>` de verdad, con la propia parcela incluida en segunda posición |

El único multiparcela que sí se fabrica es el del **sobre de ENTREGA**, porque ese no existe en
ningún sitio: la plantilla oficial trae una sola parcela. Ver más abajo.

---

## Cómo se derivó todo, y cómo se reproduce

Los cuatro salen de aplicar **sustituciones de texto** sobre el contenido **LF** del original
—el que está en el repositorio, no la copia del árbol de trabajo (ver «Sobre los finales de
línea»)— y de añadir el comentario de aviso tras el prólogo. Nada más: ni reformateo, ni
reordenación de elementos, ni cambio de prólogo, ni de namespaces.

Cada derivado se ha pasado por **`gml/parse.js#parsearGml` de verdad** (no a ojo) y por
`geo/area.js#superficie`, `validation/reglas-huso.js#reglasHuso` y
`scripts/validar-xsd.mjs`. Lo medido está en cada ficha y lo afirma
[`test/gml/fixtures-derivados.test.js`](../../../gml/fixtures-derivados.test.js), que existe
justamente para que un fixture no pueda prometer un caso que no contiene.

**SHA-256 de los originales** (contenido LF, tal como está versionado):

| Original | SHA-256 | Bytes |
|---|---|---|
| [`../cp_ejemplo_explicativo.gml`](../cp_ejemplo_explicativo.gml) | `eb5388f860bed3869fffb6f13ccc3f4889433351954f3f0d132458581d4e8ee1` | 3.216 |
| [`../cp_parcela_9398516VK3799G.gml`](../cp_parcela_9398516VK3799G.gml) | `b68803bee5109d4a5062054e6131a2a3bca4faee39e9c2038c003162a560e034` | 2.837 |

**SHA-256 de los derivados** (LF, los de este directorio):

| Derivado | SHA-256 | Bytes |
|---|---|---|
| `cp_multiparcela_entrega.gml` | `7114f23e5f4da67fe22c9ecf12781a8924a185bb221ba5b1b118a9e4e86af235` | 8.502 |
| `cp_huso_incoherente.gml` | `f2e1f58eb9732979e5b81bc3594b89996f9d76dbba713d7351b02187b2856115` | 3.167 |
| `cp_srs_no_soportado.gml` | `eae5baac1f27cc4ce1e40c9e244c77cfba4131b1818fd95cbfd89899076761d7` | 3.163 |
| `cp_area_discrepante.gml` | `ee8478ef71b976130f6213694a02556de9b914acdfba065cfb15e25fbe9baf10` | 3.147 |

Fecha de fabricación: **2026-07-30** (F08, fase 1, tarea T1.2).

> ⚠️ **La clasificación de dialecto no se hereda gratis.** `cp_ejemplo_explicativo.gml` (4.0 de
> entrega), `UTM_1.gml` (3.0) y los dos `bu_*.gml` comparten **raíz exacta**
> (`gml:FeatureCollection` en el namespace GML 3.2) y **contenedor exacto**
> (`gml:featureMember`): la raíz sola NO clasifica, y el discriminante es el `featureNs` de la
> tabla `gml/_comun.js#DIALECTOS`. Por eso ninguna derivación toca el namespace del
> `cp:CadastralParcel`, y por eso cada ficha de abajo declara el dialecto **medido**, no el
> supuesto.

---

## `cp_multiparcela_entrega.gml` — TRES PARCELAS EN UN SOBRE DE ENTREGA

| | |
|---|---|
| Deriva de | [`../cp_ejemplo_explicativo.gml`](../cp_ejemplo_explicativo.gml) (plantilla oficial de la D.G. del Catastro) |
| SHA-256 del original | `eb5388f860bed3869fffb6f13ccc3f4889433351954f3f0d132458581d4e8ee1` |
| Caso que justifica el fichero | F08, criterio 2: **«un GML con varias parcelas ofrece elegir»** en el sobre que el técnico SUBE |

**Qué se cambió, exactamente:**

1. El **único** `gml:featureMember` del original se repite **tres veces**, tal cual, sin tocar
   la cabecera ni la cola del documento. Es literalmente lo que manda el comentario que trae la
   propia plantilla oficial y que se conserva al final del fichero: *«Si se desea incluir varias
   parcelas en un mismo fichero, se pondrá un nuevo grupo featureMember para cada parcela»*.
2. En la copia 2ª y 3ª, `ES.LOCAL.CP.1A` → `ES.LOCAL.CP.2B` / `ES.LOCAL.CP.3C`. Esa sustitución
   arrastra **los tres `gml:id` del miembro** a la vez, porque los tres lo llevan como sufijo:
   el del `cp:CadastralParcel`, el de `MultiSurface_…` y el de `Surface_…`.
3. En la copia 2ª y 3ª, `<base:localId>1A</base:localId>` → `2B` / `3C`.
4. En la copia 2ª y 3ª, cada **Este** del `posList` se desplaza **+30 m** y **+60 m**
   respectivamente; el **Norte no se toca**. La primera copia queda con el `posList`
   **idéntico byte a byte** al de la plantilla oficial.
5. El comentario de aviso de fichero sintético, tras el prólogo.

**Por qué esos cambios y no otros:**

- **`gml:id` es `xs:ID`: único en TODO el documento.** Repetirlo invalida el fichero contra
  cualquier esquema GML 3.2 — es el defecto real de `UTM_1.gml`, documentado en
  [`../PROCEDENCIA.md`](../PROCEDENCIA.md). Un multiparcela hecho con tres copias literales del
  mismo bloque habría sido un fichero **inválido** haciéndose pasar por el caso «varias
  parcelas», y el día que fallara nadie sabría si el fallo era del lector o del fixture.
  Medido: **10 `gml:id` en el documento, cero repetidos**.
- **El desplazamiento es una traslación pura**, así que el área no cambia y `cp:areaValue`
  puede quedarse en los `236` del original sin mentir. Se desplaza solo el Este porque la
  parcela mide ~20,3 × 20,2 m: con 30 m de paso quedan ~9,7 m de aire entre parcelas
  consecutivas. **Comprobado con `@turf/intersect`: ninguno de los tres pares se solapa.**
- **No se inventa ninguna referencia catastral.** El original deja `cp:label` y
  `cp:nationalCadastralReference` **vacíos** a propósito —lo dice su propio comentario: es un
  alta, la parcela todavía no está en las bases catastrales—, y así se quedan en las tres. Una
  referencia catastral plausible-pero-falsa es exactamente el tipo de dato inventado que este
  documento existe para impedir. Lo que distingue a las tres parcelas es el `localId`
  (`1A`/`2B`/`3C`), que es identificación local y no afirma nada sobre el Catastro.

**Medido** (con `parsearGml` y `scripts/validar-xsd.mjs`):

| | |
|---|---|
| Dialecto | **`CP_4_0_ENTREGA`**, `soportado: true` |
| Raíz | `{http://www.opengis.net/gml/3.2}FeatureCollection` · `nMiembros: 3` |
| `parcelas.length` | **3** — `localId` `1A`, `2B`, `3C`; `refcat` `''` en las tres |
| Detecciones | `VARIOS_MIEMBROS` (AVISO, `datos.miembros: 3`) + 3 × `CIERRE_RETIRADO` (INFO) |
| Bloqueos | ninguno |
| `srs` | `EPSG:25830` en las tres (URN, la forma canónica de la ENTREGA: **no** salta `SRS_FORMA_INESPERADA`) |
| Superficie | declarada `236` · shoelace `236,0456` en las tres (idéntica: es una traslación) |
| Primer vértice | `[269218.83, 4805295.18]` · `[269248.83, …]` · `[269278.83, …]` |
| XSD oficial `cp/4.0` a secas (el que carga el IVG) | **VÁLIDO** |

Que valide contra `cp/4.0` **sin** el esquema de WFS es el punto: hereda del original la
propiedad que costó el rechazo de §3.1 —el sobre correcto es el de ENTREGA— y la conserva con
tres miembros dentro.

Geográficamente cae donde caía la plantilla oficial: lon −5,85° / lat 43,37° (Asturias),
huso 30. No se ha movido de provincia.

---

## `cp_huso_incoherente.gml` — COORDENADAS FUERA DEL HUSO QUE EL FICHERO DECLARA

| | |
|---|---|
| Deriva de | [`../cp_parcela_9398516VK3799G.gml`](../cp_parcela_9398516VK3799G.gml) (descarga real del WFS) |
| SHA-256 del original | `b68803bee5109d4a5062054e6131a2a3bca4faee39e9c2038c003162a560e034` |
| Caso que justifica el fichero | F08, comprobación **C2**: coordenadas fuera del huso DECLARADO. **Ningún fichero real lo cubre** — los reales están todos en su huso. |

**Qué se cambió, exactamente:** `EPSG/0/25830` → `EPSG/0/25829`, en las **tres** apariciones del
`srsName` (`gml:MultiSurface`, `gml:Surface` y el `gml:Point` del `cp:referencePoint`), más el
comentario de aviso. **Ni una sola coordenada tocada**, ni el `areaValue`, ni nada más. El
fichero declara un huso en el que sus propios números no pueden estar.

### ⛔ Por qué 25829 y no 25831, que es lo que pedía el encargo

El encargo de esta tarea pedía **EPSG:25831** dando por hecho dos cosas; **las dos son falsas y
se han medido**:

1. *«las coordenadas son de Málaga»* — **no lo son**. El primer vértice de la parcela real,
   `[439283.23, 4479671.27]`, desproyectado en huso 30 con `geo/huso.js#detectarHuso` da
   **lon −3,7162° / lat 40,4655°**: es **MADRID**. Coincide con el `ldt` que devuelve el OVC
   para esa misma parcela —*«CL SAN RESTITUTO 72(C) MADRID (MADRID)»*, en
   [`../../catastro/PROCEDENCIA.md`](../../catastro/PROCEDENCIA.md)—, así que la referencia real
   confirma la medición.
2. *«con 25831 caen fuera del huso declarado»* — **tampoco**. Medido con la definición que usa
   el proyecto (`validation/reglas-huso.js`: un vértice está fuera si
   `detectarHuso([x,y], [huso]) === null`, es decir, si su desproyección sale de la ventana
   CM ± 3° **o** del `BBOX_ESPANA` de `geo/huso.js`):

   | `srsName` declarado | Desproyección del primer vértice | `reglasHuso` |
   |---|---|---|
   | `EPSG:25830` (el real) | lon **−3,7162°** / lat 40,4655° — Madrid | 0 hallazgos |
   | `EPSG:25831` | lon **+2,2838°** / lat 40,4655° — mar frente a Tarragona | **0 hallazgos** |
   | `EPSG:25829` | lon **−9,7175°** / lat 40,4655° — Atlántico, al oeste de Portugal | **1 hallazgo: «15 vértices caen fuera del huso 29»** |

   Con 25831 el punto cae en lon 2,28°, **dentro** del `BBOX_ESPANA`
   (`lonMin −9,5 … lonMax 4,5`), así que la regla no dispara: el fichero habría sido
   **decorativo**, un fixture que promete un caso y no lo contiene. Con 25829 la lon se va a
   −9,72°, **por debajo** de `lonMin`, y la regla dispara sobre los 15 vértices.

   La causa de fondo es el hallazgo A1 de la auditoría de F00, ya escrito en `geo/huso.js`:
   *«el easting NO identifica el huso y desproyectar con el vecino desplaza la lon ~±6°, que
   suele caer dentro de la ventana del vecino»*. Cambiar el huso declarado en **±1** casi nunca
   basta para salirse de España; hacía falta el salto que empuja la longitud fuera del bbox.

**Medido:**

| | |
|---|---|
| Dialecto | `CP_4_0_WFS`, `soportado: true` (intacto: no se tocó el sobre) |
| `parcelas.length` | 1 · `refcat` `9398516VK3799G` · `areaValue` 1536 |
| `srs` leído | **`EPSG:25829`** |
| Coordenadas | **intactas**: primer vértice `[439283.23, 4479671.27]`, 15 vértices |
| Detecciones de `parsearGml` | `ENCODING_DECLARADO` (AVISO) + `CIERRE_RETIRADO` (INFO). **Ninguna de huso**: `gml/parse.js` se niega a propósito a cotejar el huso, eso es del llamante (F08, C2) |
| `reglasHuso(recintos, {srs})` | **1 hallazgo, nivel ERROR**: «15 vértices caen fuera del huso 29 (EPSG:25829): la desproyección queda fuera de España.» |
| Bloqueos | ninguno — el recorrido **continúa**, que es el punto: es una nota, no un veredicto |

---

## `cp_srs_no_soportado.gml` — EL SRS QUE `parse.js` RECHAZA CON MOTIVO PROPIO

| | |
|---|---|
| Deriva de | [`../cp_parcela_9398516VK3799G.gml`](../cp_parcela_9398516VK3799G.gml) |
| SHA-256 del original | `b68803bee5109d4a5062054e6131a2a3bca4faee39e9c2038c003162a560e034` |
| Caso que justifica el fichero | F08: `puedeContinuar: false` por **SRS no soportado**, con el mensaje razonado de ejes invertidos que `gml/parse.js#MOTIVOS_SRS_NO_SOPORTADO` tiene escrito para el 4326 |

**Qué se cambió, exactamente:** `EPSG/0/25830` → `EPSG/0/4326`, en las **tres** apariciones del
`srsName`, más el comentario de aviso. Nada más.

Se elige 4326 y no 32628 (el otro que `parse.js` rechaza con motivo propio, Canarias/O13)
porque el 4326 es el error **que un usuario comete de verdad**: exportar en «WGS84» desde
cualquier SIG. Y porque su motivo es el más instructivo de los dos —los ejes van en orden
LATITUD, LONGITUD y este proyecto lee el `posList` como `[Este, Norte]`, así que tomarlo tal
cual metería la latitud donde va el Este.

Nótese que el fichero es **deliberadamente contradictorio**: las coordenadas siguen siendo UTM
de siete y de siete cifras, que en 4326 no significan nada. Es lo correcto para este caso: lo
que se prueba es que la aplicación **para** al leer el `srsName`, antes de mirar los números.

**Medido:**

| | |
|---|---|
| Dialecto | `CP_4_0_WFS`, `soportado: true` |
| `parcelas.length` | 1 (la parcela se lee: lo que no se acepta es su sistema de referencia) |
| `srs` leído | **`null`** |
| Detección | **`SRS_NO_SOPORTADO`, severidad `ERROR`**, `datos: {miembro: 0, codigo: 4326, srsName: 'http://www.opengis.net/def/crs/EPSG/0/4326', soportados: ['EPSG:25829','EPSG:25830','EPSG:25831']}` |
| `resumen.bloqueos` | **`['SRS_NO_SOPORTADO']`** |

---

## `cp_area_discrepante.gml` — EL FICHERO DECLARA UNA SUPERFICIE QUE SUS COORDENADAS NO DAN

| | |
|---|---|
| Deriva de | [`../cp_parcela_9398516VK3799G.gml`](../cp_parcela_9398516VK3799G.gml) |
| SHA-256 del original | `b68803bee5109d4a5062054e6131a2a3bca4faee39e9c2038c003162a560e034` |
| Caso que justifica el fichero | F08, comprobación **C1**: `cp:areaValue` declarado **vs** shoelace de las coordenadas del propio fichero |

**Qué se cambió, exactamente:** `<cp:areaValue uom="m2">1536</cp:areaValue>` →
`<cp:areaValue uom="m2">1576</cp:areaValue>`, más el comentario de aviso. **Ni una coordenada
tocada.**

**Por qué 40 m² y no 400.** La parcela real declara 1.536 m² y sus coordenadas dan 1.535,87:
una diferencia de 0,13 m² (0,009 %), que es el redondeo normal del Catastro. Con +40 m² la
discrepancia sube al **2,6 %** — suficiente para que cualquier comparación razonable la vea,
y a la vez **por debajo del 5 %** de la tolerancia oficial de superficie (`spec/SPEC.md` §3,
BOE-A-2020-12111). Eso es a propósito: el caso interesante para F08 no es el disparate, es la
discrepancia **real y discutible**, la que obliga a decir un número en vez de dar un veredicto.

**Medido:**

| | |
|---|---|
| Dialecto | `CP_4_0_WFS`, `soportado: true` · 1 parcela · `refcat` `9398516VK3799G` |
| `areaValue` leído | **1576** |
| `geo/area.js#superficie(recintos)` | **1535,865149996761** |
| Diferencia | +40,13 m² · +2,61 % |
| Detecciones | `ENCODING_DECLARADO` (AVISO) + `CIERRE_RETIRADO` (INFO) |
| Bloqueos | ninguno |

> ⚠️ **`parsearGml` NO emite `AREA_DECLARADA_DISCREPANTE` sobre este fichero, y está bien.**
> Ese tipo existe en el vocabulario de `gml/_comun.js#TIPO_GML` pero hoy solo se emite cuando el
> valor **no es numérico**: la comparación con la shoelace no la hace nadie todavía. Es
> exactamente el hueco que F08 llena (comprobación C1), y este fixture es la prueba de que el
> hueco existe. Si algún día `parsearGml` empieza a emitirla, esta línea deja de ser cierta y
> hay que reescribirla — no borrarla.

---

## Lo que estos ficheros heredan del original y NO es un defecto suyo

- **Los tres derivados de la descarga del WFS traen la raíz `wfs:FeatureCollection`**, así que
  —igual que el original— **NO validan** contra el esquema `cp/4.0` a secas: `linea 5: Element
  '{http://www.opengis.net/wfs/2.0}FeatureCollection': No matching global declaration available
  for the validation root`. Es el fallo de §3.1, heredado, no introducido. Verificado también
  sobre el original, que da el mismo error en su línea 4 (la 5 en los derivados: el comentario
  de aviso corre las líneas una posición).
- **Los tres declaran `encoding="ISO-8859-1"` y sus bytes son UTF-8.** El original miente sobre
  sí mismo y no se corrige — es el caso real contra el que se prueba el guardián de encoding.
  El comentario de aviso que se les añade también lleva sus acentos en UTF-8, igual que ya los
  llevaba «precisión» en el original.
- **`cp_multiparcela_entrega.gml` declara `encoding="utf-8"` y es verdad**, como en su
  plantilla de origen.

## Sobre los finales de línea

Los cuatro están en **LF**, y hay una línea propia para ellos en
[`.gitattributes`](../../../../.gitattributes) (`test/fixtures/gml/derivados/*.gml text eol=lf`).
**Hacía falta**: en `.gitattributes` el `*` no cruza la barra, así que la regla
`test/fixtures/gml/*.gml` **no** alcanza a este subdirectorio — comprobado con
`git check-attr -a`, que salía vacío antes de añadirla. Sin ella, un clon en Windows con
`core.autocrlf=true` recibiría CRLF y los SHA-256 publicados arriba dejarían de comprobarse.

⚠️ Detalle que conviene dejar escrito porque despista: en el árbol de trabajo de la máquina
donde se fabricaron estos ficheros, `../cp_parcela_9398516VK3799G.gml` está **con CRLF**
(2.878 B, SHA-256 `4f2469898d91d026d478b5b11cd3a0b90cab23837c4c842377bea8f58e78a3d8`) porque se
sacó del repositorio **antes** de que existiera `.gitattributes`, y `eol=lf` no reescribe lo ya
extraído. Lo versionado sí es LF (2.837 B, `b68803be…`). **La derivación se hizo sobre el
contenido LF**, que es el que se cita arriba, y se ha comprobado que el resultado coincide byte
a byte con derivar directamente del blob (`git show HEAD:…`).
