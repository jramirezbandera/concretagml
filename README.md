# Concreta GML

Herramienta web **frontend puro (sin backend)** para generar y diagnosticar ficheros
**GML INSPIRE** de la Sede Electrónica del Catastro español (parcela y edificio), y
para producir con ellos el **informe de contraste firmable**: plano a 300 ppp,
descripción literaria del lindero y pie de firma colegiada.

**En vivo: <https://jramirezbandera.github.io/concretagml/>** — se publica sola en
cada push a `main`, y solo si la suite completa pasa (ver «Despliegue»).

## Stack

- JavaScript ESM puro (sin TypeScript), tipado por JSDoc.
- Motor UTM (serie de Krüger/Karney) propio — sin `proj4js`.
- [Leaflet](https://leafletjs.com/) (BSD-2-Clause) para el visor.
- [Turf](https://turfjs.org/) (solo operaciones topológicas) para validación.
- Escritor de **PDF propio** — sin jsPDF. Sabe texto en Helvetica, líneas,
  rectángulos y un JPEG pegado sin recodificar, que es lo que el informe necesita.
- Plano compuesto **a mano en canvas** — sin html2canvas, que sobre el div de
  Leaflet produce el polígono flotando en un rectángulo gris.
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
  ⛔ **Corregido el 2026-08-02, y lo encontró esa misma firma humana** (haciendo la
  de F08): **el mapa no reencuadraba nunca.** El encuadre era el último paso del
  *montaje* del visor y no se repetía, así que se traía una parcela de Sevilla o se
  soltaba un GML de Cádiz y **el mapa seguía mirando la de demostración** — el
  dibujo estaba hecho, a cientos de kilómetros de la vista. Ahora el visor se
  reencuadra solo cuando entra una parcela **distinta**, y **nunca al editar**.
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
  ⛔ **Y una deuda suya saldada el 2026-08-02, también por la firma humana de F08:
  las colindantes se traían y no las dibujaba nadie.** Se usaban por dentro —para
  el enganche de F06 y la invasión de F07— pero pulsar «Traer colindantes» dejaba
  el mapa exactamente igual mientras la ficha decía el número. Ahora se pintan como
  contornos grises finos con su referencia catastral al pasar por encima, **por
  debajo** de la parcela propia: una vecina comparte lindero con ella, y dibujada
  encima pondría gris el lado compartido.
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
- **F07** Diagnóstico de encaje — código y pruebas hechos; **pendiente de la firma
  humana** del mismo checklist (su sección 8 trae el punto bloqueante: que ninguna
  cifra ni color se lea como un veredicto).
  👉 **La pregunta por la que se hace todo lo anterior**: *¿mi medición cuadra con
  Catastro?* Un botón «Diagnosticar encaje» abre un cajón sobre el mapa con el
  contraste completo — superficies a tres bandas (medida / catastral / registral,
  con las tres diferencias cruzadas), solape, desplazamiento de centroides,
  desviación por lindero con el peor resaltado y acotado sobre el dibujo, invasión
  a colindantes con la parcela afectada en ámbar, y la diferencia entre contornos
  sombreada. **Sin una sola cifra con juicio de valor**: la app mide, el colegiado
  interpreta y firma (regla de oro 9); la única excepción es la invasión, que es un
  hecho binario. El margen oficial de identidad (±0,50 m urbana / ±2,00 m rústica,
  ≤5 %; BOE-A-2020-12111) se dibuja como **capa informativa etiquetada**, jamás
  como semáforo.
  ⛔ **Correcciones a su propia spec, con su evidencia** en
  [`spec/feature-07-diagnostico-parcela.md`](spec/feature-07-diagnostico-parcela.md):
  la «desviación entre linderos homólogos» se redefinió **por lado contra el
  contorno oficial entero** (el emparejamiento 1 a 1 muere en cuanto F06 inserta o
  borra un vértice), y el filtro de astillas de invasión pasó de **área a grosor**
  — con el umbral de área, la parcela oficial «invadía» a dos de sus colindantes
  sin que nadie hubiera tocado un vértice.
  ⚙️ **Ni una dependencia nueva**: la diferencia sombreada sale del
  `fillRule: 'evenodd'` que Leaflet trae por defecto (un solo polígono con los
  anillos de las dos geometrías rellena exactamente la diferencia simétrica), y la
  banda del margen es un trazo con el ancho recalculado por zoom, no un buffer.
- **F08** Comprobar un GML existente — código y pruebas hechos, guion de navegador en
  `ok: true`; **pendiente solo de la firma humana** del mismo checklist (su sección 9
  trae el punto bloqueante: que ninguna nota se lea como un juicio sobre el trabajo de
  otro técnico).
  🔎 **La primera corrida del guion salió `ok: false`, y encontró dos defectos reales
  que la suite no podía ver** (`scripts/smoke-navegador/GUION.md` §16): los botones de
  los cajones se pintaban en `system-ui` porque un `font: inherit` en línea dejaba
  muerta la regla CSS, y pulsar «Descargar informe de contraste» **cerraba el cajón de
  diagnóstico**, así que el acuse de recibo acababa en un renglón invisible — la regla
  de oro 1 rota en el último gesto del recorrido. Los dos están corregidos y con
  guardián. Uno es de cascada CSS, que en jsdom no existe; el otro, de burbujeo real
  hasta `document`: **3.845 pruebas en verde no los veían, y es la justificación
  entera de que este guion exista.**
  🔎 **Y después la firma humana encontró TRES defectos más que el guion tampoco
  veía — y dos ni siquiera eran de F08** (2026-08-02): el mapa que no reencuadraba
  (F03), las colindantes que no se dibujaban (F05) y la referencia del GML que no
  llegaba al campo del panel (ésta sí, de F08). Los tres son la misma cosa: **la
  aplicación hacía el trabajo y no lo enseñaba.** Están corregidos, con guardián en
  la suite, y **medidos por el guion desde entonces**. La diferencia con los dos de
  arriba es la que importa: aquéllos fallaban una afirmación que existía; **éstos no
  fallaban nada, porque la afirmación no estaba escrita.** Un gate no encuentra lo
  que no se le ocurre preguntar, y por eso el último es una persona mirando la
  pantalla. Detalle en
  [`spec/feature-08-comprobar-gml.md`](spec/feature-08-comprobar-gml.md) M20–M22.
  👉 **Se suelta un `.gml` en la ventana y la app dice qué es y qué le pasa**: el
  que le pasó otro despacho, el que generó con otro programa, el que subió hace dos
  años y le rechazaron. Y lo contrasta contra el parcelario oficial **antes** de
  presentar nada, que es la pregunta que la Sede dejó abierta (`spec/SPEC.md` §7).
  ⛔ **La spec la llamaba «la tercera vía de entrada» y es la PRIMERA**: hasta esta
  fase la aplicación **no tenía ninguna entrada por fichero** —ni un
  `<input type="file">`, ni un `FileReader`, ni un `drop`— y los parsers de F01
  llevaban desde la fase 1 en verde **sin que nadie los llamara**. Por eso la zona
  de fichero se hizo **genérica**: F01 se enchufa después sin rehacer la interfaz.
  ~~⚠️ **Y el criterio 4 se cumple a medias, dicho por escrito**: un GML de edificio
  se detiene con honradez y explica por qué, pero encaminarlo al contraste de
  construcción exige **F14**, que no existe. Fingir un destino sería peor que decir
  que no.~~ ✅ **Media deuda cerrada el 2026-08-04 por F11, y sin esperar a F14**: un
  GML de edificio soltado en la ventana **conmuta la rama y se carga**. El desvío es
  por el CONTENIDO del fichero, no por su extensión. Lo que sigue faltando es
  contrastarlo contra lo registrado, que es F14. Las demás correcciones, con su
  evidencia, en
  [`spec/feature-08-comprobar-gml.md`](spec/feature-08-comprobar-gml.md).
  ⚙️ **Ni una dependencia nueva, y el riesgo estrella de la fase no existía**: se
  temía que meter el lector de GML en el paquete lo engordara de golpe, y medido con
  atribución por *sourcemap* resulta que **`gml/parse.js` ya estaba dentro desde
  F05**, porque el cliente del WFS lo importa. Los 68 kB que crece el paquete son
  código nuevo de la fase, todo él.
- **F09** Informe de contraste firmable — código y pruebas hechos, guion de navegador
  en `ok: true`; **pendiente solo de la firma humana** del mismo checklist (su sección
  10 hereda el punto bloqueante sobre un papel que se firma, y añade lo que solo se
  comprueba con el fichero delante: que el PDF **abra en tres lectores distintos**,
  que el plano se lea y que salga bien **en papel**).
  👉 **El documento que se entrega y se firma**: plano de situación a **300 ppp**
  sobre la cartografía del Catastro, con norte, escala gráfica y numérica; relación
  de vértices; el diagnóstico de F07 a tres bandas; la **descripción literaria del
  lindero**, editable antes de exportar; y el **pie de firma**, neutral y recordado
  entre sesiones. Sin una sola conclusión, y con la frase que lo explica impresa en la
  portada antes de la primera cifra.
  ⚙️ **Ni una dependencia nueva, otra vez** — `package.json` no cambió en toda la
  fase. El PDF lo escribe un módulo propio de 13,5 kB en vez de jsPDF, por el mismo
  motivo por el que el motor UTM es propio en vez de proj4; y como es puro, **su
  salida se fija con un snapshot de bytes**.
  ⛔ **El riesgo estrella del proyecto murió medido el primer día**: el WMS del
  Catastro sirve `EPSG:25830` a `2126×1535` px con el tamaño exacto pedido, así que
  el plano sale con **una sola petición**. Lo que sí apareció al medir es peor y no
  estaba previsto: **pasarse de 4000 px no recorta, SUSTITUYE** — pedidos `4200×100`
  y `5000×100`, devolvió las dos veces `4000×2000`, con HTTP 200 y sin aviso. La
  imagen carga, se dibuja, y la geometría queda descolocada **con la escala
  correctamente rotulada al pie**. Por eso el plano se niega a dibujarse si lo servido
  no coincide con lo pedido.
  🔎 **Y los tres defectos que hay que recordar no los vio ningún test: los vio abrir
  el PDF y mirarlo.** Un epígrafe «FIRMA» huérfano al pie de página, las columnas de
  la tabla de tramos tocándose —dos cifras contiguas se leían como una tercera que no
  existe— y un `129.9624` con punto inglés en un documento que escribe el resto en
  español. La suite afirmaba cabecera, `%%EOF`, árbol de páginas, tabla `xref` y hasta
  un snapshot de bytes, y **los bytes eran los que el código pedía**: el defecto era lo
  que pedía el código. Detalle en
  [`spec/feature-09-informe-parcela.md`](spec/feature-09-informe-parcela.md) M11–M13.
  ⚠️ **El único sitio de toda la aplicación donde propone en vez de medir**, y está
  acotado con tres candados: en parcela **urbana**, con colindantes consultadas, un
  frente que ninguna parcela alcanza se describe «presumiblemente con vía pública …
  **dato NO verificado**, confirme antes de firmar». La marca viaja **en el dato**, no
  solo en el texto, precisamente porque el texto se puede reescribir.
  ⚠️ **Deuda anotada**: el paquete queda en **675,5 kB** y Vite avisa por encima de
  500 — el aviso ya estaba en F08 y F09 lo empeora un 21,8 %. No hay dependencia que
  podar; el remedio es partir el paquete, y es materia de F16.
- **F10** Persistencia y exportación — código y pruebas hechos, guion de navegador en
  `ok: true`; **pendiente solo de la firma humana** del mismo checklist (su sección 11
  es la que más depende del entorno de toda la lista, y trae **dos** puntos
  bloqueantes).
  👉 **Es la fase en la que la aplicación empieza a recordar.** Hasta aquí, recargar la
  pestaña tiraba el trabajo entero: no había ni una línea de almacenamiento en todo el
  proyecto. Ahora los expedientes se guardan en el navegador (IndexedDB), el trabajo en
  curso **se autoguarda solo**, y lo guardado **se OFRECE al volver, no se impone** — la
  pantalla arranca como siempre y aparece un renglón con lo que había, para recuperarlo
  o descartarlo.
  👉 **Y la geometría por fin sale hacia el CAD**: DXF con la **parcela oficial junto a
  la editada, en capas separadas**, un listado de coordenadas para replanteo, y un
  **fichero de proyecto `.json`** con el que llevarse el expediente a otro equipo.
  ⚙️ **Ni una dependencia nueva, otra vez** — `idb` ya estaba desde F05.
  ⛔ **El override del DXF, aplicado al pie de la letra, produce un fichero que no
  abre.** Medido con `ezdxf`: faltaban los dos marcadores de subclase que el documento
  no mencionaba. Y lo que hace que esto importe: **nuestro propio lector de DXF aprobó
  ese fichero sin una queja** —2 anillos, coordenadas exactas, cero detecciones—, así
  que la prueba de ida y vuelta habría salido **verde con un fichero que ningún CAD
  abre**. Por eso el oráculo de esta fase es externo, y por eso abrirlo en un CAD de
  verdad es un punto bloqueante del checklist.
  ⛔ **`navigator.storage.persist()` devuelve `false`.** La ficha prometía que «evita el
  desalojo» y no lo evita: Chrome solo concede persistencia a sitios instalados,
  marcados o con interacción acumulada. Se pide igual —el día que el usuario marque la
  página, la misma llamada empezará a decir que sí— y **el resultado se dice**, en el
  acuse de cada guardado y en el diálogo. La aplicación no promete una durabilidad que
  no tiene.
  🔎 **Y el defecto que hay que recordar lo destapó el guion, no la suite**: un aviso
  del arranque que le quitaba **52 px** a la tabla de vértices en cada carga y para
  siempre. Se arregló quitando la tercera repetición del mensaje, no callándolo. Detalle
  en [`spec/feature-10-persistencia-export.md`](spec/feature-10-persistencia-export.md)
  M12.
  ⚠️ **Lo que la suite no puede probar, dicho por escrito**: corre sobre
  `fake-indexeddb`, que **no es una base de datos**, así que «el trabajo se guarda» es
  ahí incomprobable por construcción. Lo mide el guion `12-expedientes.js` en un
  navegador real, comparando la marca de tiempo del registro contra el instante en que
  la página se cargó.
  ⚠️ **Deuda anotada**: el paquete pasa a **736,2 kB**. Sigue siendo materia de F16.
- **F11** Edificio: entrada y modelo — código y pruebas hechos; ⛔ **el guion de
  navegador cierra en `ok: false` sobre un punto medido, por decisión tomada con el
  número delante** (abajo); **pendiente de la firma humana** del mismo checklist (su
  sección 12 hereda el punto bloqueante de los veredictos y añade uno propio, que no es
  de gestos sino de comprensión: **que el reparto por capas del DXF se entienda sin
  explicación**).
  👉 **Es la fase en la que la aplicación deja de ser solo de parcelas.** Hasta aquí
  todo —el panel, el visor, el pie, el almacén— hablaba de una parcela; la rama de
  edificio existía en el modelo desde la primera fase y **no la llamaba nadie**. Ahora
  hay un conmutador de dos posiciones en la cabecera del panel: se pulsa «Edificio» y
  **el panel se cambia entero**, con el mismo mapa y el mismo visor debajo. Se elige
  qué se necesita generar (simplificado, que es el del ICUC y el caso frecuente, o
  completo), entra la geometría por **cinco vías** —DXF, pegar LIST, cargar TXT, soltar
  un GML de edificio y traerla del Catastro por referencia— y las huellas **se pintan
  en el mapa**, encima de la parcela, con su nombre al pasar por encima.
  👉 **Y el DXF por fin entra.** Los lectores de CAD llevaban desde F01 en verde **sin
  que nadie los llamara**: la app escribía DXF (F10) y no sabía reabrirlo. Ahora se
  suelta un `.dxf` o un `.txt` en la ventana y entra **como partes de un edificio**.
  ⚠️ **Media asimetría, no toda, y se dice**: reabrir un dibujo **como parcela** sigue
  sin estar. Con la rama Parcela puesta, soltar un `.dxf` no hace nada callado: avisa de
  que ese dibujo entra como partes de un edificio y de cómo llegar ahí.
  ⛔ **«Cada polilínea es una parte» no se aplica a la letra, y el plano real del repo
  es el motivo.** `UTM.dxf` —un plano de trabajo de verdad— trae **25 polilíneas en 5
  capas**, y dieciséis de ellas son el cajetín, el marco y la leyenda: al pie de la
  letra saldrían 25 partes y **el recuento estaría mal sin que nada avisara**. Así que
  se lee la capa del dibujo y **se ofrece el reparto**, con el nombre literal de cada
  capa y cuántos contornos trae. Y hay una segunda medición que lo cierra: **en ese
  mismo fichero la parcela de verdad está en la capa `0`, no en la que se llama
  `PARCELA`** —comparte los 12 vértices con el listado de coordenadas de al lado—, así
  que **elegir la capa por su nombre falla en el único plano real que tenemos**.
  Ofrecer no es prudencia: es lo que el dato exige.
  ⛔ **La ficha mandaba traer las construcciones de la capa `constru` del Catastro, y
  esa capa son PÍXELES.** Es una capa de imagen del servicio de cartografía; la
  geometría vive en otro servicio (`wfsBU`), que **no estaba anotado en ninguna parte
  del proyecto**. Sondeado antes de escribir código: tiene **cinco** consultas
  preparadas y el dossier documentaba **tres**, y con la que faltaba un edificio cuesta
  **dos peticiones en vez de tres**. Y su forma de fallar es **la contraria** a la del
  servicio de parcelas —donde todo error llega con un `200 OK` engañoso—: aquí una
  referencia inexistente acaba en un `404`, y **una parcela sin nada construido
  contesta con una lista vacía perfectamente correcta**, que es el punto de partida de
  una obra nueva y no un error.
  ⭐ **Arregló un defecto vivo que no estaba en su alcance**: al enchufar la entrada de
  DXF apareció que la aplicación construía parcelas de **superficie negativa** —−390,45
  m² donde la real mide 61,05— **sin una sola advertencia**. Llevaba ahí desde que F10
  estrenó los DXF de dos capas, por un camino que nadie recorría. Un diferenciador
  probado y sin recorrido de usuario no diferencia nada, y esto es lo que cuesta
  descubrirlo tarde.
  ⭐ **Y cerró media deuda de F08**: un GML de edificio soltado en la ventana ya no se
  detiene con una explicación, **conmuta la rama y se carga**.
  ⚠️ **Lo que la rama de edificio todavía NO hace, dicho por escrito**: no asigna
  plantas ni distingue vivienda de piscina (F12), no genera el GML de construcción
  (F13) y no lo contrasta (F14) — los dos botones del pie se apagan **con el motivo
  escrito al lado**, nunca grises y mudos. Y **no se guarda en el navegador ni se
  autoguarda**: para llevarse el trabajo está el fichero de proyecto `.json`, que sí
  funciona en las dos ramas.
  🔎 **El guion de navegador salió `ok: false` y encontró dos defectos reales que las
  5.700 pruebas no veían** — y lo que importa no es que los encontrara, sino que **la
  suite estaba verde defendiéndolos**:
  · **La aplicación se contradecía a sí misma al cargar un edificio.** El panel decía
  «Cargadas 7 partes… 62 vértices» y a la vez entraba una tarjeta diciendo «da
  **−13,32 m²**… **No se construye la parcela**». Las dos frases eran ciertas por
  separado; juntas, el usuario no sabe cuál creerse. La rama de edificio filtraba los
  *bloqueos* de parcela pero **reenviaba sus avisos, que es la mitad que se lee**. Y
  había un test que exigía literalmente reenviarlos «todos, sin tocarlos».
  · **El panel de la rama de edificio no cabía**: 947,54 px en 900, así que se recortaba
  en silencio y **«Diagnosticar encaje» quedaba fuera de la pantalla, sin forma de llegar
  a él**. Se arregló quitando **tres duplicaciones** —el apunte del modelo que no has
  elegido, un motivo repetido para dos botones que se apagan por la misma causa, y el
  aviso de autoguardado que se enseñaba entero **dos veces a la vez**—. **Ni un hecho
  callado**: lo que se quitó era lo mismo dicho dos veces.
  ⛔ **Lo que queda, y por qué F11 cierra igual.** Con 7 partes cargadas la lista mide
  **7,06 px** y una fila necesita 25,39: **faltan 18,33 px**. La pérdida funcional ya está
  arreglada (el panel cabe exacto y el botón se alcanza); toda palanca que queda es
  recortar redacción o tocar la maqueta del panel, que es lo que el rework de interfaz
  existe para hacer; y **F12 añade las plantas por parte sobre un panel sin holgura**, así
  que recortar texto ahora se deshace en dos fases. Los 18,33 px **se entregan medidos**,
  no se dan por resueltos.
  ⚠️ **Deuda anotada**: el paquete pasa a **858,4 kB** — ni una dependencia nueva
  (`package.json` no cambió), son once módulos de código propio. Con esta cifra,
  **partir el paquete deja de ser una deuda teórica**: los ~89 kB de la rama de
  edificio solo hacen falta cuando alguien pulsa «Edificio». Materia de F16.
  ⚠️ **Y otra, declarada y no tapada**: en la rama de edificio se leen **cuatro textos que
  hablan de «la parcela»** —«La parcela cae en el huso 30…», «no son geometría de
  parcela»— porque los escriben los lectores de CAD, que son de la primera fase y no saben
  que existen dos ramas. Tres de los cuatro son informativos. Se arreglan en F12, con el
  mismo patrón que ya se usó para el encuadre: tocarlos ahora reabre los módulos más
  antiguos del proyecto por un texto.

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
pulsación, una petición al Catastro, nunca a espaldas del usuario. Y desde el
2026-08-02 **se ven**: las vecinas se dibujan como contornos grises finos, con su
referencia catastral al pasar por encima, así que se sabe **contra qué** se está
enganchando.

### Cómo se comprueba un GML que ya existe (F08)

Dos gestos, y ninguno tecleado:

1. **Suelta el `.gml` en cualquier sitio de la ventana** —o pulsa «Abrir un GML…»,
   a la derecha del rótulo «Origen de la parcela»—. Se abre un **cajón sobre el
   mapa** que dice qué es ese fichero: qué dialecto (CP 4.0 de entrega, la descarga
   del WFS, un 3.0 que la Sede ya no admite, un GML de edificio), cuántas parcelas
   trae, qué superficie **declara** y cuál **mide** de verdad, y las notas de lo que
   no cuadra: coordenadas fuera del huso que el propio fichero declara, vértices
   duplicados, un contorno que se cruza consigo mismo, un `encoding` que el fichero
   dice mal sobre sí mismo. Si trae varias parcelas, se elige una.
2. **«Contrastar con el parcelario»**. La geometría del fichero entra en el mapa,
   la app pide al Catastro la parcela oficial con la referencia leída **del propio
   fichero**, y el botón «Diagnosticar encaje» de F07 se enciende solo. Desde el
   cajón de diagnóstico se descarga el **informe de contraste** en texto.

Al contrastar, **el mapa viaja a la parcela del fichero** —si el GML es de otra
provincia, la vista se muda— y **el campo «Referencia catastral» pasa a decir lo
mismo que el modelo**. Las dos cosas parecen obvias, y **las dos faltaban** hasta el
2026-08-02: ver «Estado», F03 y F08.

Cuatro cosas que conviene saber, porque son decisiones y no accidentes:

- **El campo se vacía si el fichero no trae referencia**, al revés que en la vía del
  Catastro, donde lo tecleado no se toca. Aquí no hay nada tecleado que respetar:
  manda el fichero. Dejar la referencia anterior sería peor que el hueco — el campo
  estaría hablando de una parcela que ya no está en pantalla, y dejaría «Deducir del
  mapa» encendido al lado de una referencia perfectamente escrita.
- **Las notas no son un suspenso.** Un GML ajeno con el exterior antihorario, o con
  un SRS distinto del esperado, o con una superficie declarada que no cuadra con sus
  propias coordenadas, **sigue adelante**: la app lo dice y te deja contrastarlo. Solo
  se para cuando no hay geometría legible (no es XML, es un edificio, no trae ninguna
  parcela, o el sistema de coordenadas no está soportado) — y entonces escribe el
  motivo, nunca un botón gris y mudo.
- **La procedencia dice las dos cosas**: la geometría es del fichero, el parcelario
  es del Catastro. Decir «del Catastro» a secas convertiría el fichero de un tercero
  en un dato oficial.
- **El informe de texto lo dice de sí mismo.** Se llama «Informe de contraste con el
  parcelario catastral» y **nunca** «informe de validación gráfica»: VGA e IVG son
  documentos oficiales con CSV, y un nombre casi homónimo haría creer que ya se
  presentó algo. Del mismo cajón baja también el documento con plano y pie de firma
  («Preparar informe (PDF)», abajo).

Y **«Generar GML» sigue encendido** por esta vía, contra la letra de la spec y a
propósito: si el fichero que has soltado es un 3.0 antiguo, el recorrido natural es
que la app te lo reescriba en 4.0.

### Cómo se saca el informe firmable (F09)

En el pie del cajón de diagnóstico hay **dos** botones, y el orden dice cuál es el
entregable:

| | **«Preparar informe (PDF)»** | «Descargar informe de contraste» |
|---|---|---|
| Qué lleva | Plano de situación a **300 ppp**, relación de vértices, diagnóstico a tres bandas, **descripción del lindero** y **pie de firma** | Las mismas cifras, en texto plano |
| Red | Una petición de cartografía | **Ninguna** |
| Para qué | Se firma, se presenta, se archiva | Se pega en un correo o en una instancia |

El PDF abre un diálogo antes de componerse. Ahí es donde se corrige lo que la
aplicación no puede saber: **el texto del lindero se edita** —es un borrador, no un
resultado— y **el pie de firma se teclea una vez y se recuerda**. Después, «Componer
PDF».

Cinco cosas que conviene saber, porque son decisiones:

- **El texto del lindero se recorre en sentido horario desde el vértice más al
  noroeste**, agrupando lados consecutivos con el mismo colindante y rumbo parecido.
  Un tramo de un solo lado se escribe «en línea recta de X m»; uno agrupado, «en línea
  quebrada de N lados que suman X m» — llamar «línea recta» de 47 m a una quebrada de
  nueve lados sería una medida que no se puede replantear sobre el terreno. Lo
  metodológico (sentido, arranque, norte de cuadrícula, qué significa un tramo sin
  referencia) **va al pie como nota técnica**: delante, se colaría en el portapapeles
  de quien solo quería los linderos.
- **En urbana, un frente que ninguna parcela alcanza se propone como vía pública** —y
  es lo único que esta aplicación propone en vez de medir—. Va marcado tres veces en
  la misma frase («presumiblemente», «dato NO verificado», «confirme antes de firmar»),
  aparece en un bloque propio encima del cuadro de edición y **«Componer PDF» nace
  apagado** hasta que se marca el acuse. En rústica no se propone nada: un lindero sin
  parcela catastral puede ser un camino, un cauce o un monte público.
- **El pie de firma no presupone titulación.** Ningún desplegable de profesiones,
  ninguno; «colegio» es texto libre. Quién puede firmar qué está en disputa, y esa
  decisión no le toca a un programa.
- **Lo que se guarda son cuatro campos y nada más** —nombre, número de colegiado,
  colegio y contacto—, en el navegador y en el equipo de quien los escribe. **No se
  guarda qué fincas has consultado ni qué informes has emitido**, y desmarcar
  «Recordar» **borra** el registro, no lo desactiva.
- **Si el plano no se puede componer, el informe baja igual y lo dice en el propio
  papel.** Las otras secciones no dependen de la red, y negarlas porque un servicio
  externo no contesta sería castigar al usuario por algo que no ha hecho. Lo único
  inaceptable sería componerlo mudo.

El documento **no lleva ninguna conclusión**, y lo dice de sí mismo en la portada:
«la aplicación mide; el colegiado interpreta y firma». No hay semáforos, no hay
colores de mérito —el escritor solo sabe grises, y el gris se usa para jerarquía, no
para puntuar una cifra— y **no aparece ni una sigla de los documentos oficiales del
Catastro**, ni siquiera para negar ser uno: en un papel que se firma, la sigla se lee
y la negación no.

### Cómo se guarda y cómo se saca el trabajo (F10)

En la fila «Origen de la parcela» hay un botón **«Expediente»**. Ahí está todo lo que
entra y sale del trabajo guardado — y **«Generar GML» sigue en el pie**, porque es la
salida principal y no una salida lateral.

| | Qué es | Se puede volver a abrir aquí |
|---|---|---|
| **Guardar en este navegador** | El expediente entero, en IndexedDB | Sí, desde la lista |
| **Proyecto (`.json`)** | El expediente entero, en un fichero | **Sí** — es el único |
| **DXF** | La parcela **oficial y la editada, en capas separadas** | **No como parcela** — ⚠️ *matizado en F11: desde el 2026-08-04 un `.dxf` sí entra, pero **como partes de un edificio**; reabrirlo como parcela sigue sin estar, y al soltarlo con la rama Parcela puesta la app lo dice y señala la vía que sí existe* |
| **Coordenadas (`.txt`)** | El listado de vértices para replantear | **No como parcela, y el propio fichero lo dice.** ⚠️ *Igual que el DXF: desde F11 entra por la rama de edificio, con un lector propio que lo reconoce por su firma* |

Cinco cosas que conviene saber, porque son decisiones:

- **El autoguardado ofrece, no impone.** El trabajo en curso se guarda solo cada dos
  segundos, pero al volver **la pantalla arranca como siempre**: aparece un renglón
  diciendo qué había y desde cuándo, y se recupera o se descarta. Nada se mueve bajo
  los pies de nadie. Y mientras esa oferta esté sin resolver, **el autoguardado
  espera**: escribir encima borraría justo lo que se está ofreciendo.
- **Se guarda la parcela y el sistema de referencia, y nada más — y el diálogo lo
  enumera.** No viajan el historial de deshacer (empiezas una sesión de edición
  nueva), ni las colindantes (se vuelven a pedir), ni el diagnóstico ni el informe
  (se recalculan), ni el pie de firma (se guarda aparte y se borra aparte).
- **Esto vive en tu navegador y en tu equipo, no en ningún servidor**, y el navegador
  puede borrarlo si se queda sin espacio. Se le pide que no lo haga
  (`navigator.storage.persist()`), **está medido que dice que no**, y la aplicación lo
  dice en vez de prometer lo contrario. Para conservar un trabajo con seguridad:
  exportarlo a fichero de proyecto.
- **El listado de coordenadas no se puede volver a cargar aquí, y lo lleva escrito
  dentro.** No es letra pequeña: se intentó, y lo que sale del parser son 18 pares de
  coordenadas donde había 15 vértices, ninguno correcto — la primera columna es el
  número de vértice, no la X. Para volver a abrir el trabajo está el `.json`.
- **Borrar es en dos tiempos.** El primer clic avisa, el segundo borra. No hay
  papelera: lo que se borra, se va.

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
