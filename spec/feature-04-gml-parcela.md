# F04 · Generación del GML (parcela)

**Fase:** 4 · **Prioridad:** P4 · **Riesgo:** Alto (fidelidad IVG) · **Depende de:** F00, F01 · **Habilita:** F08, F10, F15. **Cierra el corte de paridad.**
**Ficheros:** `gml/serialize-cp.js`, `gml/parse.js`, `test/fixtures/gml/`.

## Objetivo

Serializar el modelo a **INSPIRE Cadastral Parcels 4.0** sobre GML 3.2.1 de forma que **pase el IVG**, y parsear GML entrante para el round-trip. Innegociable del proyecto: fidelidad exacta al Catastro.

## Verdad numérica externa (primero de todo)

Antes de escribir el serializador, tener en `test/fixtures/gml/` GML reales del WFS (urbana, rústica, con islas). Ya versionado: `cp_parcela_9398516VK3799G.gml` (RC `9398516VK3799G`). **Test de ida y vuelta obligatorio:** GML del Catastro → parsear → volver a serializar → equivalente en vértices, superficie y estructura.

## 🔻 OVERRIDES (dossier) — el plan v4 §9 está desactualizado en varios puntos

- **O3 — Raíz:** `<FeatureCollection xmlns="http://www.opengis.net/wfs/2.0">` + `<member>`. **NUNCA** `gml:FeatureCollection`/`gml:featureMember` (eso es el 3.0 → **rechazado** desde 2025). *(S2/C2).*
- **O2 — srsName:** **URI OGC** `http://www.opengis.net/def/crs/EPSG/0/258${huso}` (no la URN, no `EPSG:25830`). Repetido en `MultiSurface`, `Surface` y en el `gml:Point` del `referencePoint`. *(S2/C3).*
- **O4 — inspireId:** `<Identifier xmlns="http://inspire.ec.europa.eu/schemas/base/3.3">` con `localId` + `namespace`, **sin prefijo `base:`**. Namespace `ES.LOCAL.CP` válido para RGA de particular. *(DOCUMENTADO).*
- **O5 — Orden XSD de `cp:CadastralParcel`** (el validador lo exige): `areaValue → beginLifespanVersion → endLifespanVersion → geometry → inspireId → label → nationalCadastralReference → referencePoint`. *(OBSERVADO).*
- **O6 — `areaValue`:** entero, `uom="m2"` (`Math.round(area)`). Informativo. *(S1/B1).*
- **O1 — Orientación:** el plan §9 hereda "antihorario". **Falso:** forzar **exterior HORARIO, huecos antihorario** con `@turf/boolean-clockwise` (si `booleanClockwise(exterior)===false`, invertir; interiores al revés). *(S1, VERIFICADO).*
- **Desaparecen en 4.0:** `gml:boundedBy`/`Envelope`, `validFrom`/`validTo`/`zoning`. No emitirlos.

## Detalles que hay que clavar

- Geometría: `cp:geometry → gml:MultiSurface → gml:surfaceMember → gml:Surface → gml:patches → gml:PolygonPatch → gml:exterior/gml:interior → gml:LinearRing → gml:posList srsDimension="2" count="N"`. **Un único perímetro exterior por parcela** (huecos como `interior`); no MultiPolygon con varias caras.
- `posList`: pares **X Y** (Este Norte), `toFixed(2)`, punto decimal, **cerrado** (repetir el primer par al final). En 25830 **no** invertir ejes (la inversión es exclusiva de 4326).
- `gml:id` válido como XML ID: prefijar (`ES.LOCAL.CP.<ref>`, `Surface_…`, `MultiSurface_…`, `ReferencePoint_…`), nunca la RC desnuda (regla de oro 10).
- `cp:referencePoint` **dentro** del polígono: `turf.pointOnFeature()`, verificar con `turf.booleanPointInPolygon()`.
- `cp:beginLifespanVersion` = dateTime; `cp:endLifespanVersion` = `xsi:nil="true"` con `nilReason`.
- Superficie publicada calculada **desde las coordenadas ya redondeadas** a 2 decimales (regla de oro 11).
- Fichero `UTF-8` (encoding declarado == bytes reales).

La plantilla anotada de parcela 4.0 mínima válida está en el dossier §1.1 ("Plantilla anotada"). CRS admitidos: 25829/30/31 (y 32628 Canarias, diferido).

## `gml/parse.js`

Parsear GML entrante a modelo: extraer recintos, RC, SRS, `areaValue`. Centraliza el `gml:posList → GeoJSON`. Base para el round-trip y para F08 (comprobar GML ajeno).

## Criterios de aceptación

1. **Ida y vuelta:** `parse(fixture) → serialize` produce XML canonicalizado (ignorando espacios) equivalente al fixture en vértices, cierre, RC, CRS y estructura; `toMatchFileSnapshot('__snapshots__/parcela.gml')`.
2. Orientación: `booleanClockwise(exterior) === true` en la salida; los huecos, al revés.
3. `areaValue` entero == `|shoelace|` redondeada, calculada sobre coords redondeadas.
4. Raíz = wfs 2.0 + `member`; srsName = URI; inspireId base 3.3 sin prefijo; orden XSD correcto; sin `boundedBy`/`zoning`.
5. `gml:id` empieza por letra; `referencePoint` cae dentro (verificado con `booleanPointInPolygon`).
6. Validación de esquema en CI contra `CadastralParcels.xsd` (cp 4.0) con `libxmljs`/`xmllint`, sin depender de la Sede.

## Errores que producen rechazo (checklist, dossier §1.5)

`gml:FeatureCollection` en parcela · `srsName="EPSG:25830"` o URN en 4.0 · orientación antihoraria · `gml:id` por dígito · anillo no cerrado o <4 puntos · `base:` en inspireId · dejar `boundedBy`/`zoning` · MultiPolygon.

## Referencias

Plan §9, §18 Fase 4, §22, §23.5. Dossier §1.1 (esquema 4.0 + plantilla + tabla 3.0→4.0), §1.4 (`serialize-cp.js`), §1.5 (errores), §0.4 (fixtures). XSD: `inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd`.

---

# 📌 Resuelto al implementar (2026-07-27)

Lo que esta especificación dejaba abierto, decidido y **medido** durante la implementación. Manda esta sección sobre lo de arriba donde discrepen.

## 1 · Qué significa «equivalente» en el criterio 1 (y por qué el byte a byte es imposible)

El fixture del WFS **no se puede reproducir carácter a carácter**, por dos hechos comprobados sobre el fichero:

- **Declara `encoding="ISO-8859-1"` y sus bytes son UTF-8** (`0xC3 0xB3` en «precisión»). Hay que leerlo con `utf8`, no con `latin1`. Nosotros declaramos UTF-8 de verdad, así que la declaración diverge **a propósito**.
- **Recorta ceros no significativos de forma irregular**: en la misma `posList` escribe `439283.23`, `4479647.8` y `4479678`. Nosotros emitimos `toFixed(2)` siempre.

Por eso el criterio 1 se cumple por **equivalencia semántica sobre árbol canonicalizado**, con esta lista cerrada de normalizaciones — y **solo** estas:

| Se normaliza | Motivo |
|---|---|
| Texto que es solo espacio en blanco | El criterio dice «ignorando espacios» |
| Comentarios e instrucciones de proceso | El fixture trae los dos del WFS; nosotros el nuestro |
| Orden de atributos | XML no lo define |
| `xsi:schemaLocation`: runs de espacios → uno | El fixture lo trae en una línea |
| `gml:posList`/`gml:pos` → `number[]`, comparación **numérica** | Los ceros recortados. Para `xsd:double` es el mismo número |
| `<x/>` == `<x></x>` | Mismo infoset (`endLifespanVersion`) |
| Declaración XML | Fuera del árbol, comparada aparte (el fixture miente sobre su encoding) |

Las declaraciones `xmlns:*` **NO se descartan**: se comparan como conjunto, que es justo lo que vigilan O3 y O4. Todo lo demás —nombres cualificados, `gml:id`, `srsName`, `count`, `srsDimension`, `uom`, `nilReason`, `xsi:nil`, `numberMatched`, orden de hijos— se compara **exacto**.

**La comparación no comparte código con lo comparado**: el test parsea las dos partes con **jsdom**, nunca con `gml/xml.js`. Con el mismo lector en los dos lados, un bug simétrico saldría verde.

El `toMatchFileSnapshot` es la **cuarta** aserción (tras detecciones, árbol canónico y guardianes), no la primera: su función es que cualquier cambio de bytes aparezca como diff legible en la revisión. Un snapshot solo está a un `-u` de no significar nada.

**Diferencias totales del snapshot contra el fixture: cuatro**, todas deliberadas — declaración UTF-8, los 3 valores de 32 con cero restituido, `endLifespanVersion` autocerrado, y el comentario de cabecera (el nuestro en vez de los dos del WFS; además su acento es lo único no-ASCII del documento, sin lo cual el guardián de encoding no distinguiría nada).

## 2 · Criterio 6 · validación de esquema

Se cumple por **dos vías complementarias**, decidido con el usuario:

- **Guardián estructural en la suite** (`test/gml/aceptacion-f04.test.js`), que corre **siempre** y afirma punto por punto el checklist de rechazos derivándolo del GML real. Doce invariantes, cada uno con su **prueba de que dispara** (se muta la salida y se exige rojo).
- **`npm run validar:xsd`**, opcional: usa `xmllint` si está en el PATH y se salta con instrucciones si no. Cero dependencias nativas. `libxmljs` se descartó por ser módulo nativo (toolchain de compilación en Windows para validar un XML), y vendorizar el árbol de XSD por ser decenas de ficheros de terceros que no resuelven offline sin catálogo.

**⚠️ Corrección al checklist de rechazos, comprobada contra el XSD oficial (`CadastralParcelType`):** `validFrom`, `validTo` y `zoning` **siguen en la secuencia** con `minOccurs="0"`, y `gml:boundedBy` se hereda de `gml:AbstractFeatureType`. **El esquema los admite**: un GML con cualquiera de ellos valida en verde. Quien los rechaza es el **IVG por regla de negocio**, no el XSD. La distinción importa para F15 (que necesita saber quién rechaza cada cosa) y para que nadie concluya que el guardián está roto al verlos pasar `validar:xsd`.

Del mismo XSD: `ORDEN_CADASTRAL_PARCEL` es un **prefijo** de la secuencia real de **13** elementos. Como orden de emisión nuestros 8 son correctos y completos, pero F08 no debe deducir que un GML ajeno con `validFrom` está mal ordenado.

## 3 · El caso «alta nueva» (parcela no inscrita)

- `namespaceInspire` = **`ES.LOCAL.CP`** por defecto. `ES.SDGC.CP` es del round-trip (leer el dato oficial y reescribirlo), no de lo que genera el usuario: su fichero es **su declaración de alta**, no el dato de la Sede.
- **`localId` e `identidad` van separados de la referencia catastral.** La app resuelve `refcat ?? idLocal` y lo pasa como identidad; `nationalCadastralReference` se deja **vacío**. Rellenarlo con la referencia convertiría un alta en una **declaración falsa de inscripción**, en silencio. `UTM_1.gml` lo confirma: `localId` lleno, `nationalCadastralReference` vacío.
- **`cp:label` y `cp:nationalCadastralReference` son obligatorios** en el XSD (no llevan `minOccurs`) pero su tipo es `string` **sin `minLength`**: se emiten **vacíos** (`<cp:label/>`) y eso valida. El riesgo de producto que se temía **no existe**.

## 4 · Desviaciones conscientes del enunciado

- **`@turf/boolean-clockwise` va en `devDependencies`, no en producción.** El signo lo da `orientacion()` de `geo/area.js`, que traslada a origen local (regla de oro 5) mientras turf opera sobre coordenadas crudas. Dos fuentes para el mismo signo es la divergencia silenciosa que este proyecto persigue. Turf entra **como oráculo del test** para satisfacer el criterio 2 al pie de la letra sobre la salida real. ⚠️ **Exige el anillo CERRADO**: sobre el abierto responde lo contrario.
- **Se emiten `numberMatched`/`numberReturned`** aunque la plantilla del dossier los omita: van `use="required"` en `wfs.xsd` y el WFS real los trae. Regla de oro 8.
- **El orden de operaciones del serializador es contrato**, no detalle: `redondear → detectar colapsos → orientar → medir área → cerrar`. El redondeo es `Number(v.toFixed(2))` y **nunca** `Math.round(v*100)/100` (divergen en magnitudes UTM reales: `439283.235` → `.23` vs `.24`). La inversión preserva el pivote (`[a[0], ...a.slice(1).reverse()]`), que da `|área|` bit-idéntica y conserva el vértice inicial del técnico.

## 5 · Punto ciego que F04 cierra, y uno que deja abierto

**Cierra:** F02 valida **sin redondear**. Dos vértices a 4 mm son válidos para `duplicadoMetros: 0.001` y **se funden en el mismo punto** al hacer `toFixed(2)`; ningún test de F02 puede verlo porque el redondeo ocurre después. De ahí `COLAPSO_POR_REDONDEO`, que es ERROR si el anillo cerrado baja de 4 puntos.

**Deja abierto:** un colapso puede además crear una autointersección que solo `kinks` vería. Ese chequeo es de **F08**.

## 6 · Lo que `gml/parse.js` ya soporta (adelantado para F08)

Dialecto 4.0 canónico, **3.0 con su parcela dentro** (`soportado:false` pero `parcelas` relleno: el valor de F08 es «tu GML es de 2015, aquí está tu parcela»), edificio BU como *otro tema*, varios `member`, y SRS inesperado como nota. 4326 es **error explícito** (sus ejes van invertidos; tomar su `posList` como `[x,y]` metería lat/lon en el modelo violando la regla de oro 3).

**Hallazgo sobre los ficheros reales:** la raíz **no basta** para clasificar. `UTM_1.gml` (3.0) y los dos `bu_*.gml` (edificio) comparten raíz exacta `gml:FeatureCollection` en GML 3.2 y el mismo `gml:featureMember`; lo único que los separa es el namespace del elemento de feature.

## 7 · Estado

Hecho y en verde: **47 ficheros de test, 1.779 pruebas**. `gml/` = `_comun.js`, `xml.js`, `anillos.js`, `ids.js`, `parse.js`, `serialize-cp.js`, `descargar.js`, `index.js`. Cableado en la app con el gate `puedeGenerar` de F02.

Pendiente y **no bloqueante** (SPEC §7): subir un GML generado a la Sede con certificado y confirmar que el IVG lo acepta. Eso cerraría de paso las dos verificaciones abiertas — orientación antihoraria y URI vs URN.
