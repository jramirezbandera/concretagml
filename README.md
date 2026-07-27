# Concreta GML

Herramienta web **frontend puro (sin backend)** para generar y diagnosticar ficheros
**GML INSPIRE** de la Sede Electrónica del Catastro español (parcela y edificio).

**En vivo: <https://jramirezbandera.github.io/concretagml/>** — se publica sola en
cada push a `main`, y solo si la suite completa pasa (ver «Despliegue»).

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
- **F03** Visor y capas (Leaflet) — código y pruebas hechos; **pendiente de la
  firma humana** de `scripts/smoke-navegador/CHECKLIST-HUMANO.md` (gestos de
  ratón, teclado, fallo de red y juicio visual, que no puede firmar una máquina).
- **F04** Generación del GML de parcela (INSPIRE CP 4.0) — hecho. Serializador,
  parser, descarga y botón en la app; ida y vuelta contra el GML real del WFS.
  👉 **Cierra el corte de paridad**: la app ya produce el fichero que se sube a
  la Sede.

La única verificación que ninguna máquina puede firmar sigue abierta y **no
bloquea**: subir un GML generado a la Sede con certificado y comprobar que el
IVG lo acepta (`spec/SPEC.md` §7).

## Despliegue

La app se publica en **GitHub Pages** desde `.github/workflows/deploy.yml`, en
cada push a `main` y a mano con *workflow_dispatch*. El workflow tiene tres
trabajos encadenados: **suite completa → construir → publicar**. Los tests son un
**gate**, no un job informativo: si están rojos no se publica nada y se queda en
línea la versión anterior, que es lo que exige `spec/SPEC.md` §6.

⚠️ **La app NO se sirve en la raíz.** Pages de proyecto publica bajo
`/<repo>/`, así que `vite.config.js` fija `base: '/concretagml/'` — y lo aplica
**igual en dev, build y preview**, a propósito: que dev y preview sirvieran rutas
distintas es la clase de diferencia que esconde un fallo hasta que está
publicado. Consecuencias prácticas:

- `npm run dev` → `http://localhost:5173/concretagml/` (la raíz da **404**).
- `npx vite preview` → `http://localhost:4173/concretagml/`.
- `dist/index.html` no funciona por `file://`; hay que servirlo.

Si el repositorio se renombra, hay que cambiar ese `base` con él.

El workflow lleva una **guarda del artefacto** antes de publicar: comprueba que
`dist/index.html` referencia los assets bajo el base y que no queda ninguna ruta
absoluta fuera de él. Es el modo de fallo clásico de Pages —página en blanco con
404 en los assets— y falla el despliegue en vez de publicarlo roto.
