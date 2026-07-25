# F11 · Edificio: entrada y modelo

**Fase:** 11 · **Prioridad:** P11 (baja, capítulo posterior) · **Riesgo:** Medio · **Depende de:** F10 · **Habilita:** F12.
**Ficheros:** `model/edificio.js`, entrada de edificio.

> **Cambio de mentalidad respecto a parcela.** El flujo de parcela *contrasta* una medición contra Catastro. El de edificio **produce un GML de construcción que valide en la Sede** (a menudo obra nueva sin nada registrado); el contraste es un paso opcional al final (F14). Recorrido: Entrada → Partes y plantas → Validación → Generar GML, con Contraste e Informe opcionales.

## Objetivo

Elegir modelo (simplificado/completo), traer la geometría por las mismas vías que parcela con **una polilínea = una parte**, y capturar los atributos del edificio.

## Alcance

### Elección de modelo — primero de todo (§14.1)

- **Simplificado (unificado)** — solo geometría de huellas (edificio + piscinas) con atributos mínimos. Es el válido para el **ICUC**; el caso más frecuente.
- **Completo** — añade atributos semánticos (inmuebles, viviendas, superficie construida, uso, fechas).

Selector *"¿Qué necesitas generar?"* con una línea por opción. Si es **simplificado**, **ocultar el bloque de atributos semánticos**: solo geometría, RC y estado. El caso frecuente debe ser el camino corto.

### Origen de la geometría (§14.2)

Mismas vías que parcela (la huella sale del CAD, no se teclea):
- **DXF (vía principal):** **cada polilínea entra como una parte independiente** (vivienda, porche, garaje son polilíneas distintas). Al pasar a Partes, la lista ya aparece poblada, una parte por polilínea, con nombres genéricos para renombrar. Decirlo: *"Cada polilínea del dibujo se cargará como una parte."*
- Pegar LIST · cargar TXT · cargar GML de edificio existente · **traer del Catastro por RC** (partes registradas de la capa `constru` como punto de partida editable).
- La **parcela de contexto** se mantiene si ya venía cargada, pero deja de ser la única fuente de geometría.

### RC (§14.3)

Deducida del centroide de la huella y editable (reutiliza F05/§7.3).

### Atributos del edificio — solo modelo completo (§14.4)

Del edificio en su conjunto, **no de cada parte:** uso dominante, estado de conservación, año de construcción (referido al 1 de enero, el más antiguo si hay varios) + año de reforma, nº de inmuebles, nº de viviendas, superficie construida (grossFloorArea). **Las plantas NO van aquí:** se asignan por parte en F12.

## Modelo (§4.2, §4.3, §23.3)

`Edificio { refcat, modelo, partes[], parcelaContexto, construccionOficial, + atributos si COMPLETO }`; `ParteConstruccion { nombre, tipo:'PRINCIPAL'|'OTRA', recinto|null, plantasSobreRasante|null, plantasBajoRasante|null, origen }`. Convenios: envolvente **derivada** (no se guarda); solo partes con volumen sobre rasante; **plantas por parte, nunca del edificio**; piscinas (`OTRA`) sin plantas (`null`, no `0`); nº inmuebles/viviendas del edificio. POJO plano, anillos sin cerrar, sin huecos en partes.

## Criterios de aceptación

1. El selector oculta los atributos semánticos en modo simplificado.
2. Un DXF con N polilíneas produce N partes nombradas genéricamente, pendientes de plantas/tipo.
3. La RC se deduce del centroide de la huella y es editable.
4. El modelo respeta los convenios (piscina con plantas `null`; envolvente no almacenada).

## Referencias

Plan §4.2–§4.3, §14, §18 Fase 11, §23.3. Dossier §1.2 (modelo edificio, ICUC), §1.3 (reglas ICUC).
