# F13 · Edificio: validación y generación de GML

**Fase:** 13 · **Prioridad:** P13 (baja) · **Riesgo:** Alto (fidelidad ICUC) · **Depende de:** F12 · **Habilita:** F14.
**Ficheros:** `validation/edificio.js`, `gml/serialize-bu.js`, fixtures `wfsBU.aspx`.

## Objetivo

Validar las partes y serializar el GML de construcción **INSPIRE Buildings 2D extendido** que valida en la Sede (ICUC). Segundo innegociable de fidelidad, con un **dialecto distinto al de parcela**.

## Verdad numérica externa

Descargar GML de edificio reales del WFS `wfsBU.aspx` (`GETBUILDINGBYPARCEL`, `GETBUILDINGPARTBYPARCEL`) a `test/fixtures/gml/` (ya versionados: `bu_building_…`, `bu_buildingpart_…`). Test de ida y vuelta.

## Validación de partes (§16.1)

Reglas geométricas de siempre por cada parte (F02), más las propias:

| Regla | Nivel |
|---|---|
| Parte principal sin plantas asignadas | Error bloqueante |
| Partes que se solapan entre sí de forma incoherente | Error |
| Parte fuera de la parcela | Aviso (puede ser legítimo) |

El resalte del aviso "parte fuera de la parcela" rodea **la parte que se sale**, no otra. Errores y avisos contados por separado.

## Generación del GML (§16.2)

`Building` (envolvente derivada, multirrecinto de la envolvente sobre rasante) + `BuildingPart` por parte con sus plantas. Simplificado = geometría + mínimos; completo = todos los atributos de §14.4.

### 🔻 OVERRIDES (dossier) — dialecto de edificio, distinto del de parcela

- **O10 — Raíz y namespaces:** `<gml:FeatureCollection>` + `gml:featureMember` (GML clásico, **no** wfs 2.0), con namespaces INSPIRE *draft*: `bu-core2d`/`bu-ext2d` en `http://inspire.jrc.ec.europa.eu/schemas/...`, `base` en `urn:x-inspire:specification:gmlas:BaseTypes:3.2`, `schemaLocation` a `BuildingExtended2D.xsd`. *(dossier S3, OBSERVADO).*
- **O2 — srsName = URN** `urn:ogc:def:crs:EPSG::25830` (distinto de la parcela, que es URI). *(S3/C3).*
- **Geometría = un solo `gml:Surface` con N `PolygonPatch`** (un patch por construcción disjunta), **no** MultiSurface.
- **`horizontalGeometryReference="footPrint"` obligatorio** para ICUC; `referenceGeometry=true`.
- `conditionOfConstruction` (codelist): `declined, demolished, functional, projected, ruin, underConstruction`. **El PDF oficial escribe mal "funtional"; usar `functional`.** *(A1).*
- **Piscinas:** `bu-ext2d:OtherConstruction` con `constructionNature=openAirPool` y geometría en **`gml:Polygon` directo** (no `Surface`/`patches`); `conditionOfConstruction` va `xsi:nil` `nilReason="other:unpopulated"`.
- **Orientación:** exterior horario, huecos antihorario (igual que parcela, O1), sin autointersecciones.
- `base:namespace` = `ES` + productor (`SDGC`/`LOCAL`) + `BU`. `gml:id` = `ES.SDGC.BU.<ref>` o con sufijo `_Edificio_1`, `_Piscina_1`.
- **Solo huella con volumen sobre rasante;** excluir voladizos/terrazas/balcones (regla de negocio antes de serializar). INSPIRE no representa divisiones horizontales: solo huella + `numberOfFloorsAboveGround`.

## Reglas de rechazo ICUC (dossier §1.3)

Geometría **cerrada**, **≥4 puntos** por recinto, 2 coordenadas por punto, sin solapes entre construcciones, ninguna a **>100 m** de la parcela, sin BICE, máx **60 GML**, identificadores únicos.

## Criterios de aceptación

1. **Ida y vuelta** contra `bu_building_…` y `bu_buildingpart_…`: equivalente en partes, plantas, huella y estructura; `toMatchFileSnapshot`.
2. Raíz `gml:FeatureCollection` + `gml:featureMember`, srsName **URN**, un `gml:Surface` con N `PolygonPatch`, `horizontalGeometryReference=footPrint`.
3. Piscina serializa como `OtherConstruction`/`openAirPool`/`gml:Polygon` con `conditionOfConstruction` nil.
4. `functional` bien escrito; orientación horaria; solo partes sobre rasante.
5. Validación de esquema contra `BuildingExtended2D.xsd` en CI.
6. Parte principal sin plantas bloquea la generación.

## Referencias

Plan §16.1–§16.2, §18 Fase 13, §23. Dossier §1.2 (esquema edificio + plantilla), §1.3 (ICUC), §1.4 (`serialize-bu.js`), §1.5 (errores), §0.4 (fixtures). XSD: `inspire.ec.europa.eu/draft-schemas/bu-ext2d/2.0/BuildingExtended2D.xsd`.
