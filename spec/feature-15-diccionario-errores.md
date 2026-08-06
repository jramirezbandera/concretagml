# F15 · Diccionario de errores del validador

**Fase:** 15 · **Prioridad:** P18 · **Riesgo:** Bajo · **Depende de:** F04 · **Habilita:** —.
**Ficheros:** `config/errores-ivg.json`.

## Objetivo

Traducir los mensajes crípticos del validador de la Sede a lenguaje accionable. **Es la única pieza cuyo valor crece con el uso** — por eso no se copia de nadie: se construye a base de rechazos acumulados.

## Alcance

Estructura desde el primer día, aunque empiece casi vacío:

```json
{
  "codigo_o_fragmento": {
    "traduccion": "...",
    "causaProbable": "...",
    "comoCorregir": "...",
    "fecha": "2026-07-22"
  }
}
```

- **Búsqueda por texto** del mensaje recibido (el usuario pega el error del IVG/ICUC y encuentra la entrada).
- Se llena con el tiempo; cada rechazo real que el usuario resuelve se documenta como una entrada nueva.
- Semillas iniciales desde el catálogo de errores conocidos (dossier §1.5): `gml:FeatureCollection` en parcela (es 3.0), srsName corto/URN equivocado, orientación, `gml:id` por dígito, anillo no cerrado/<4 puntos, `base:` en inspireId 4.0, `boundedBy`/`zoning` presentes, MultiPolygon, solapes, construcción a >100 m, "funtional".

## Criterios de aceptación

1. Buscar un fragmento de mensaje devuelve su traducción/causa/corrección.
2. El fichero valida como JSON con la estructura fijada y admite entradas nuevas sin cambio de código.
3. Las semillas de §1.5 están cargadas.

## Referencias

Plan §13.3, §18 Fase 15. Dossier §1.5 (errores que producen rechazo).
