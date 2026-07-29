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
npm run validar:xsd # valida el GML generado contra el XSD oficial de INSPIRE
npm run catastro:vivo # comprueba contra el servicio REAL que su contrato no ha cambiado
```

`validar:xsd` necesita **`xmllint` o Python con `lxml`** (cualquiera de los dos)
y salida a Internet la primera vez, para traerse el árbol de esquemas —lo cachea
en `esquemas/`, que está en `.gitignore`—. Sin motor disponible avisa y sale con
0; con `--estricto` (lo que usa CI) eso pasa a ser un fallo. Valida contra
`cp/4.0` **a secas**, sin `wfs/2.0`, que es lo que hace el validador del IVG.

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
  ⛔ **Corregido el 2026-07-27** tras un rechazo real del IVG: la app emitía el
  sobre de la *descarga* del WFS (`wfs:FeatureCollection`) en vez del de la
  *entrega* (`gml:FeatureCollection`), y el validador de la Sede no carga el
  esquema de WFS. La historia completa, con las mediciones, está en
  [`spec/SPEC.md` §3.1](spec/SPEC.md). Desde entonces la salida se valida contra
  el **XSD oficial de INSPIRE** en CI, antes de publicar.
- **F05** Catastro en vivo — hecho. Cliente del WFS, geocodificación inversa,
  deducción de referencia, colindantes y caché en IndexedDB, con el control de
  carga en la app. 👉 **La parcela ya no se copia a mano**: se teclea una
  referencia catastral y llega la oficial, editable. Es también lo que habilita
  el diagnóstico de encaje (F07) y la descripción de linderos (F09), que
  necesitan las colindantes.
  ⛔ **Ocho puntos de la spec resultaron falsos al medir el servicio real** antes
  de escribir código, y están corregidos con su evidencia en
  [`spec/feature-05-catastro-vivo.md`](spec/feature-05-catastro-vivo.md). Los dos
  que más cambian el diseño: **todo error del Catastro llega con HTTP 200**
  (`response.ok` no clasifica nada) y **`GetParcelsByBBox` no existe**.
- **F06** Edición de parcela — código y pruebas hechos; **pendiente de la firma
  humana** del mismo checklist que F03 (gestos de ratón y juicio visual).
  👉 **La parcela deja de ser un dato que se mira y pasa a ser un dato que se
  trabaja**: se arrastran, insertan y eliminan vértices sobre el mapa, se teclean
  coordenadas en la tabla, se desplaza un lindero en paralelo por una distancia, y
  todo engancha (*snap*) al parcelario oficial y a las colindantes con 20 cm de
  tolerancia. Con deshacer/rehacer, la longitud de cada lado acotada sobre el
  dibujo, y superficie, perímetro y diferencia con la superficie catastral
  actualizándose **durante** el arrastre.
  ⛔ **Dos correcciones a su propia spec, con su evidencia** en
  [`spec/feature-06-edicion-parcela.md`](spec/feature-06-edicion-parcela.md):
  la fórmula del offset del dossier (`nrm = (u.y, −u.x)`) **mueve el lindero al
  revés en la mitad de los casos** —el sentido depende de cómo esté girado el
  anillo, así que se mide en vez de suponerse—, y el «fallback para el ángulo
  agudo» **no es la excepción sino la regla**: sobre la parcela real
  9398516VK3799G, de sus 15 lados **solo uno** se resuelve por el camino nominal.
  ⚠️ **Deuda anotada, no escondida**: `edit/dibujo.js` (dibujar un recinto desde
  cero) **no se ha hecho** y queda entero para F12.
  ✅ **La otra deuda se cerró el 2026-07-28…29**: el bloque «Edición» del panel
  consumía **270 px** de un presupuesto de altura fijo y dejaba la tabla de
  vértices en **64 px** sobre un portátil de 1440×900 — 1,6 renglones para 15
  vértices. Las herramientas se han llevado a una **barra sobre el mapa** y los
  gestos a un panel de ayuda; la tabla pasa a **303 px**, unas **once filas**. El
  bloque ya no existe en `index.html`, y hay un guardián (`G16`) que exige que sus
  siete controles **no vuelvan** al marcado: duplicarlos dejaría la barra muerta
  con el mismo aspecto que la viva.

### El régimen de uso, que es el riesgo real de F05

El Catastro **deniega el servicio ~10 días** por abuso y detecta la rotación de
IP y de *user-agent*. La defensa no es un truco, son cuatro cosas aburridas:
**caché antes que red** (una parcela ya traída no se vuelve a pedir), **cola de
concurrencia**, **backoff con jitter** y **no pedir nunca lo que nadie ha
pedido** — de ahí que la deducción de referencia sea un botón y no algo
automático al arrancar.

Y una decisión de honestidad: **no existe ningún motivo de error «bloqueado»**.
Nadie ha medido —ni va a medir— qué contesta el servicio a un cliente denegado,
porque provocarlo cuesta esos diez días. Hay un guardián (`G13`) que exige que
**todo motivo del catálogo tenga un caso reproducible en la suite**, así que no
se puede añadir sin medirlo antes.

`npm run catastro:vivo` comprueba contra el servicio real que su contrato sigue
siendo el que congelan los fixtures. **No está en CI a propósito**: dispararía
desde las IP compartidas de GitHub, que es justo el patrón centralizado que la
política del Catastro penaliza.

### Cómo se edita una parcela (F06)

Las herramientas están en una **barra flotante sobre el mapa**, arriba a la
izquierda: deshacer, rehacer, **ajuste al parcelario** (botón partido — el imán lo
conmuta y la flecha abre la tolerancia, en centímetros), **desplazar lindero** (con
la distancia en metros) y **«?»**, que abre la ayuda. No están en el panel lateral a
propósito: ahí se comían 270 px de una altura fija y dejaban la lista de vértices en
1,6 renglones.

Los gestos del mapa, que es lo que no se descubre solo. En la app los cuenta el
panel de ayuda del «?»; aquí están todos juntos:

| Gesto | Qué hace |
|---|---|
| **Clic** en un lindero | Lo selecciona (es el que se desplaza), si cae a 12 px o menos. **Un clic nunca cambia la geometría** |
| **Doble clic** en un lindero | Inserta un vértice ahí, proyectado sobre el lado |
| **Clic derecho** sobre un vértice | Lo elimina |
| **Arrastrar** un vértice | Lo mueve, enganchando al parcelario si el ajuste está activo |
| **`Alt`** pulsada | Desactiva el enganche mientras dura el gesto |
| **Teclear** una coordenada en la tabla | Mueve el vértice a lo tecleado |
| **«Desplazar lindero»** + distancia | Desplaza en paralelo el lado seleccionado |
| **`Ctrl+Z` / `Ctrl+Y`** | Deshacer / rehacer. Dentro de un campo de texto se los queda el navegador, a propósito |

El enganche (*snap*) tira del **parcelario oficial**, de la **propia geometría** y
de las **colindantes** — estas últimas solo si se han traído con su botón: una
pulsación, una petición al Catastro, nunca a espaldas del usuario.

## ✅ Verificado en la Sede Electrónica

El 2026-07-27 se subió un GML generado por esta app a la Sede Electrónica del
Catastro y **se cargó correctamente**. Es la verificación que ninguna máquina
puede firmar, y cierra el ciclo que empezó ese mismo día con un rechazo del IVG.

Qué significa y qué no: confirma que **el formato del fichero es el que la Sede
admite**. No dice nada del *informe de validación gráfica*, que juzga además
solape con parcelas colindantes y tolerancias de superficie — reglas de negocio
que dependen de la parcela concreta, no del generador. Ver
[`spec/SPEC.md` §7](spec/SPEC.md).

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
