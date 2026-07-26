# Concreta GML

Herramienta web **frontend puro (sin backend)** para generar y diagnosticar ficheros
**GML INSPIRE** de la Sede Electrónica del Catastro español (parcela y edificio).

## Stack

- JavaScript ESM puro (sin TypeScript), tipado por JSDoc.
- Motor UTM (serie de Krüger/Karney) propio — sin `proj4js`.
- [Leaflet](https://leafletjs.com/) (BSD-2-Clause) para el visor.
- [Turf](https://turfjs.org/) (solo operaciones topológicas) para validación.
- [Vite](https://vitejs.dev/) como servidor de desarrollo y empaquetador.
- [Vitest](https://vitest.dev/) (proyectos `node` y `dom`) para los tests.

## Scripts

```bash
npm install        # dependencias
npm run dev        # servidor de desarrollo (Vite)
npm run build      # empaquetado estático
npm test           # tests: AMBOS proyectos (node + dom) — el gate de "hecho"
npm run test:node  # solo el proyecto node (bucle rápido: sin jsdom)
npm run test:dom   # solo el proyecto dom (jsdom: visor, mapa, canvas)
npm run test:all   # alias de `npm test` (node + dom)
npm run test:watch # modo watch del proyecto node
```

`npm test` corre los **dos** proyectos porque la definición de "hecho"
(`spec/SPEC.md` §6) exige ambos: geometría y serializadores en `node`, canvas y
mapa en `dom`. Cuando el proyecto `dom` estaba vacío (F00) bastaba con `node`;
desde F03 no.

## Estado

- **F00** Cimientos (modelo, motor UTM, área/orientación, undo/redo) — hecho.
- **F01** Entrada de parcela (parsers LIST/TXT/DXF) — hecho.
- **F02** Validación geométrica — hecho.
- **F03** Visor y capas (Leaflet) — en curso.
