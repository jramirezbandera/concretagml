# F14 · Edificio: contraste e informe

**Fase:** 14 · **Prioridad:** P17 (baja) · **Riesgo:** Bajo · **Depende de:** F13, F09 · **Habilita:** —.
**Ficheros:** `diagnostico/edificio.js`, `report/pdf-edificio.js`.

## Objetivo

Cerrar el flujo de edificio con un **contraste opcional** (honesto cuando no hay nada registrado) y un informe que reutiliza la estructura del de parcela añadiendo la ficha de partes.

## Contraste — paso opcional (§16.3)

Accesible desde el final, **fuera del camino principal**, con condición honesta: solo tiene sentido **si ya existe construcción registrada** para esa parcela.

- **Si es obra nueva y no hay nada registrado:** el contraste no aplica. Decirlo con claridad —*"No consta construcción registrada… el GML generado es plenamente válido sin este paso"*— en lugar de inventar una geometría de referencia. **Esta pantalla es un acierto del diseño; conservarla.**
- **Cuando sí aplica:** huella medida frente a la catastral (capa `constru`), solape, si la construcción queda dentro de la parcela, e invasión a colindantes. Mismo principio: **mide y dibuja, no dictamina**; la invasión es la única advertencia con consecuencia fija. **Reutiliza el diseño del diagnóstico de parcela** (F07).
- Acepta también la vía de comprobar un GML de edificio ajeno (F08).

## Informe (§17)

Nombre: **"Informe de construcción para la Sede Electrónica"** (o "…de contraste con la construcción catastral" si se hizo el contraste).

Reutiliza la estructura del de parcela (F09: encabezado, plano, relación de vértices, pie de firma) y añade:
- **Ficha de partes:** una fila por parte con superficie, plantas sobre/bajo rasante (o "—" para piscinas) y tipo.
- **Atributos generales del edificio** (uso, año, estado, inmuebles, viviendas) si el modelo es completo.
- Nota al pie: *"El edificio-envolvente se deriva de las partes con volumen sobre rasante; no se dibuja. Solo entran construcciones sobre rasante; se excluyen voladizos, terrazas y balcones."*
- Si hubo contraste, sus resultados; si no, informe solo declarativo, sin sección de contraste.

## Criterios de aceptación

1. Con parcela sin construcción registrada, aparece la pantalla honesta y **no** se inventa geometría de referencia.
2. Con construcción registrada, el contraste calcula solape/dentro-de-parcela/invasión reutilizando F07, sin veredicto (salvo invasión).
3. El informe incluye la ficha de partes con plantas correctas ("—" para piscinas) y la nota al pie.
4. El nombre del informe cambia según se haya hecho contraste o no.

## Referencias

Plan §16.3, §17, §18 Fase 14, §20, §23.6. Dossier §1.2 (edificio), §5.3 (medir no dictaminar), §5.6 (memoria firmable).
