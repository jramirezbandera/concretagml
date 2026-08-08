# TODOS

Trabajo identificado y aplazado a propósito. Cada entrada lleva su motivo, su
contexto y qué la bloquea, para que retomarla no cueste rediseñarla.

---

## F17 fase 2 · El colindante recortado

**Estado:** aplazado · **Bloqueado por:** la feature «dos puertas, no una» (fondo catastral
estable) · **Anotado el:** 2026-08-07

**Qué.** Sacar las parcelas vecinas de la clausura de `app/cableado-diagnostico.js` al
modelo, para poder editarlas y emitir sus GML junto al de la parcela propia.

**Por qué.** Es lo único que un CAD no puede hacer de ninguna manera, y es lo que convierte
«he ajustado mi lindero» en «el IVG sale positivo porque el vecino también cuadra». Cuando
mueves un lindero compartido, la parcela del vecino queda recortada y la Sede necesita ver
las dos alteraciones en el mismo expediente.

**Pros.**
- `colindantes()` (`app/cableado-catastro.js:1229`) ya descarga las vecinas del WFS y ya
  tiene botón en la interfaz. Hoy solo alimenta `snap.dianas()`.
- F17 ya entrega N parcelas en un solo sobre y la Sede lo aceptó con **IVG positivo real**
  (CSV `XMWPXCN9J8DB9J89`, tipo Segregación).
- `recintosDeGeometriaTurf` (`geo/poligono.js:292`) ya devuelve una entrada por pieza
  disjunta, así que las componentes conexas tras una booleana ya están resueltas.

**Contras.**
- `model/parcela.js` «no tiene dónde guardar unas vecinas» (`cableado-catastro.js:584`).
  Exige colección de geometrías en el store, selección de geometría activa, undo por capa y
  repensar quién es «la parcela» del informe y del expediente.
- Semanas, no días.

**Contexto.** Diseñado y diferido en
`~/.gstack/projects/GML/Javier-main-design-20260802-165651.md`, sección **«FASE 2 · El
colindante recortado (diferida, no planificada aquí)»**. Aquel documento ya dice qué hace
falta: sacar `vecinas` de la clausura al modelo, la interfaz de asignación de trozos, y el
presupuesto de red conjunto.

**Pregunta abierta que hay que medir ANTES de planificarlo.** ¿Cuántos colindantes se ven
afectados en un expediente típico: uno, o varios? Decide si la interfaz necesita selección
o basta con una lista corta. Sigue sin respuesta desde el 2026-08-02.

**Por dónde empezar.** `app/cableado-diagnostico.js` — la clausura donde hoy viven
`vecinas`. Y leer antes el design doc de agosto: la mitad del trabajo de diseño está hecha.
