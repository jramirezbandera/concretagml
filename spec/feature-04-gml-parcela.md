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
