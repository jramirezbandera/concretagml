# Procedencia de los fixtures GML

Estos ficheros son **verdad externa** (regla de oro 8 de `spec/SPEC.md`): mandan sobre la
documentación, sobre el dossier y sobre nuestro criterio. Ninguno se edita para que un test
pase. Si uno de ellos contradice al código, se corrige el código.

Este documento existe porque un fixture sin procedencia es una opinión con formato de dato.

## `cp_ejemplo_explicativo.gml` — LA PLANTILLA DE ENTREGA

**La fuente de verdad del fichero que el usuario SUBE a la Sede.** Es el «Ejemplo explicativo»
que la propia Dirección General del Catastro publica y que sus instrucciones oficiales mandan
usar como plantilla (paso 1 de *«¿Cómo generar un GML de parcela catastral?»*).

| | |
|---|---|
| Origen | `https://www.catastro.hacienda.gob.es/documentos/formatos_intercambio/CP%20ejemplo%20explicativo.zip` |
| Descargado | 2026-07-27 |
| Fecha del fichero dentro del zip | 2017-10-10 |
| SHA-256 del zip | `577c0fdff881913f2dd4e23adeb85b499a9492b944f911b5d37f69d9e74a62b9` |
| SHA-256 del `.gml` original | `c491191b792c4e170da9c24f0223c498b2ac9662fb37834fc6f0f260d4a57a83` (3.258 B, CRLF) |
| Aquí | 3.216 B, con los finales de línea normalizados a LF por `.gitattributes` |

Lo ÚNICO que se ha tocado son los finales de línea (CRLF → LF), que en XML son espacio en
blanco entre elementos y no cambian el infoset. El SHA-256 de arriba permite comprobar el
original byte a byte contra la descarga.

**Por qué este fixture es el importante.** Hasta el 2026-07-27 este proyecto construyó el GML
copiando `cp_parcela_9398516VK3799G.gml`, que es la **descarga** del WFS. Son dos ficheros con
sobres distintos, y la Sede rechazó el nuestro con *«El archivo no cumple el esquema Inspire
GML»*. Medido después contra los XSD oficiales:

| Fichero | vs `cp/4.0` solo | vs `cp/4.0` + `wfs/2.0` |
|---|---|---|
| `cp_ejemplo_explicativo.gml` (entrega) | **válido** | válido |
| `cp_parcela_9398516VK3799G.gml` (descarga WFS) | **inválido**: `wfs:FeatureCollection` no es raíz declarada | válido |

El validador del IVG carga el esquema de parcela, no el de WFS. De ahí el rechazo. El detalle
está en `spec/feature-04-gml-parcela.md`.

## `cp_parcela_9398516VK3799G.gml` — LA DESCARGA DEL WFS

Respuesta real del WFS del Catastro para la referencia `9398516VK3799G`. Sigue siendo la fuente
de verdad de **los números** (coordenadas, `areaValue`, orden de los hijos de
`cp:CadastralParcel`) y del perfil `WFS` del serializador, que es el que reproduce el
round-trip. **No es** la fuente de verdad del sobre de entrega.

⚠️ Declara `encoding="ISO-8859-1"` y sus bytes son UTF-8: el fichero miente sobre sí mismo. No
se corrige — es el caso real contra el que se prueba el guardián de encoding.

## `UTM_1.gml` — UN ALTA DE TERCEROS, Y UN CONTRAEJEMPLO

Alta de particular generada por
[`chapulincatastral/generador-gml`](https://github.com/chapulincatastral/generador-gml), en CP
**3.0** (`urn:x-inspire:specification:gmlas:CadastralParcels:3.0`). Se conserva porque documenta
el patrón del alta (namespace `ES.LOCAL.CP`, `label` y `nationalCadastralReference` vacíos).

⚠️ **No es una plantilla a copiar, y hay dos motivos medidos:**

1. Es CP 3.0, no 4.0. El namespace ni siquiera está en el esquema que la Sede valida hoy.
2. **Repite el mismo `gml:id`** en la raíz y en el `cp:CadastralParcel`
   (`ES.LOCAL.CP.8703362TF9980S0001SH`). `gml:id` es de tipo `xs:ID`, que es único en todo el
   documento: eso invalida el fichero contra cualquier esquema GML 3.2. Comprobado mutando el
   `gml:id` de la raíz de nuestra propia salida, que pasa de válida a
   *«'…' is not a valid value of the atomic type 'xs:ID'»*.

Por eso la raíz que emitimos lleva como `gml:id` el **namespace INSPIRE** (`ES.LOCAL.CP` /
`ES.SDGC.CP`), que es lo que hace la plantilla oficial y no choca con el de la parcela.

## `bu_building_9398516VK3799G.gml` y `bu_buildingpart_9398516VK3799G.gml`

GML de **edificio** (Building / BuildingPart, namespaces draft de la JRC). ~~Otro tema:
su serializador es F13. Aquí sirven para dos cosas: clasificar el dialecto y dar la mitad
anti-vacuidad del guardián de elementos proscritos (`gml:boundedBy` SÍ aparece en
ellos).~~

⭐ **Actualizado el 2026-08-04: desde F11 tienen LECTOR.** Que su **serializador** sea F13
sigue siendo cierto, pero ya no es lo único: `gml/parse-bu.js` los lee de verdad —era el
estreno que llevaban esperando desde F00— y `edificio/entrada.js` traduce su vocabulario
INSPIRE al del modelo. Sus tres usos de hoy:

1. **Clasificar el dialecto** (`gml/_comun.js#clasificarDialecto` → `DIALECTO.BU`).
2. **La mitad anti-vacuidad** del guardián de elementos proscritos: `gml:boundedBy` **sí**
   aparece en ellos.
3. **La verdad externa del lector de F11** y de las dos vías BU de `edificio/entrada.js`.

**Lo que se midió sobre ellos al escribir el lector** (F11 · T0.2 y T1.2), y que corrige
la lectura ingenua del dialecto:

| | |
|---|---|
| Partes | **13**, con **0 interiores** cada una |
| Plantas | **las trece traen las dos**, no solo `part10`: `↑[1,7,7,6,7,6,7,6,6,0,6,6,6]` · `↓[0,0,1,0,1,0,1,1,1,1,1,1,1]` |
| `conditionOfConstruction` de las partes | **`xsi:nil` en las trece** ⇒ el estado sale del `Building` |
| `heightBelowGround` | **9 de 13** (no es exclusivo de `part10`) |
| Patches del `Building` | **DOS** `gml:PolygonPatch` (`count` 5 y 53) |
| `numberOfFloorsAboveGround` del `Building` | **`xsi:nil`** ⇒ `null`, que **no es lo mismo que «ausente»** |

⛔ **Y cuatro trampas que un lector escrito «a ojo» sobre estos ficheros no ve:**

1. **Las plantas y los atributos semánticos viven en `bu-ext2d`, NO en `bu-core2d`**
   (`numberOfFloorsAboveGround`, `numberOfFloorsBelowGround`, `heightBelowGround`,
   `currentUse`, `numberOfBuildingUnits`, `numberOfDwellings`, `officialArea`). En
   `bu-core2d` van `conditionOfConstruction`, `dateOfConstruction`, `inspireId`,
   `externalReference` y las lifespan. Buscarlas donde no están devuelve **`null` en las
   trece** y **`part10` parece normal**.
2. **`count` de `gml:posList` incluye el punto de cierre.** Los `[5,11,16,…]` son anillos
   **CERRADOS**; el modelo los guarda **abiertos** (regla de oro 4), así que el lector
   devuelve `[4,10,15,…]` y el `Building` da `[4,52]`.
3. ⛔ **`part10` contradice el convenio «solo partes con volumen sobre rasante»**: tiene
   **0 plantas sobre rasante y 1 bajo**. Manda el dato (regla de oro 8): entra marcada,
   no se descarta ni se calla.
4. **La RC no está en las partes.** `bu-core2d:reference` solo existe en el `Building`;
   para las partes sale del `refcat=` del `xlink:href` de `cadastralParcels`, y **cortar
   el `localId` falla** en cuanto aparece un sufijo como `_PI.1`.

⚠️ **Y lo que ESTOS DOS FICHEROS NO TRAEN, que es lo que más costó:** la parcela de
referencia del proyecto **tiene una piscina** —`OtherConstruction`,
`constructionNature = openAirPool`, `gml:id` con sufijo `_PI.1`— y **aquí no aparece**.
Su geometría es **`gml:Polygon` DIRECTO** (`exterior/LinearRing/posList`), **no**
`Surface/patches/PolygonPatch`, y el contenedor es **`bu-ext2d:geometry`**: un lector
escrito solo contra estos dos fixtures **se la pierde entera, en silencio**. Salió al
sondear el servicio real, y por eso la verdad externa del dialecto BU **no son solo estos
dos ficheros**: son estos dos más los cinco de `../catastro/wfsbu-*`, que trae la piscina,
la colección vacía y la página de error del 404.

⚠️ **`bu_building_*.gml` a solas sale con 0 partes**, y es correcto: la huella del
`Building` es la **envolvente INSPIRE** (unión de las partes) y guardarla como parte sería
guardar la envolvente con otro nombre —lo que `SPEC.md` §23.3 prohíbe— **y contar su
superficie dos veces**. El lector lo dice nombrando `GetBuildingPartByParcel`, que es de
donde sale lo que falta.
