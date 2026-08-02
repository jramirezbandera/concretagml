// Concreta GML — F00 · Cimientos. Superficie pública del motor numérico y el modelo.
// Se exponen como espacios de nombres para evitar colisiones (p.ej. `meridianoCentral`
// lo exportan tanto utm como huso) y para dejar clara la frontera de cada dominio.
//
// Frontera de proyección (ÚNICO lugar donde aparece lat/lon, regla de oro 3):
//   - utm  : proyección directa/inversa ETRS89/GRS80.
//   - huso : detección de huso (desproyecta el centroide) y saneamiento de coordenadas.
// El resto (area, cierre, model/*) trabaja SIEMPRE en UTM [x,y].
//
// `bbox` y `rumbo` entran en F09 (T5.2) y no antes por una razón tonta y honesta:
// no los pedía nadie desde fuera de `geo/`. Ahora sí —`report/encuadre.js` encuadra
// con el primero y `report/literal.js` nombra los cardinales con el segundo—, y
// dejarlos fuera obligaría a quien consuma el motor a bajar al fichero para una
// caja envolvente teniendo `area` y `metrica` a mano. Son puros y aritméticos, como
// el resto de `geo/`: ni DOM, ni red, ni reloj. (`geo/arco.js`, `geo/centroide.js` y
// `geo/poligono.js` siguen sin salir, y por lo mismo de siempre: nadie los ha
// pedido desde fuera. Cuando alguien los pida, entran con su motivo escrito.)

export * as utm from './geo/utm.js'
export * as area from './geo/area.js'
export * as huso from './geo/huso.js'
export * as bbox from './geo/bbox.js'
export * as rumbo from './geo/rumbo.js'
export * as cierre from './geo/cierre.js'
export * as metrica from './geo/metrica.js'
export * as segmento from './geo/segmento.js'
export * as parcela from './model/parcela.js'
export * as edificio from './model/edificio.js'
export * as historial from './edit/historial.js'
export * as vertices from './edit/vertices.js'
export * as metricas from './edit/metricas.js'
export * as snap from './edit/snap.js'
export * as offset from './edit/offset.js'
export * as validacion from './validation/parcela.js'
// gml: capa de dominio, sin Leaflet ni DOM, luego sí entra aquí. La ENTREGA del
// fichero (`gml/descargar.js`) se queda fuera —necesita Blob/URL/document—,
// igual que viewer/ y services/; el motivo, en la cabecera de `gml/index.js`.
//
// ⚠️ `decodificarGml` (F08 · T1.1) —bytes → texto, el escalón de debajo de
// `parsearGml`— entra por AQUÍ, porque ya sale por `gml/index.js`. No se
// reexporta además por su nombre en la raíz: serían dos caminos hasta la misma
// función, y el día que uno de los dos cambie de promesa el otro seguirá
// diciendo la de antes. `TextDecoder` es WHATWG Encoding, no DOM: existe igual
// en Node y en el navegador, así que el proyecto Vitest `node` lo carga sin
// problema.
export * as gml from './gml/index.js'

// ── F08 · las dos capas puras que estrena «Comprobar un GML existente» ───────
// Las dos son ESPEJO de `diagnostico/`: componen piezas puras de las capas de
// abajo, no tocan el DOM, no consultan la red y no leen el reloj. Por eso —y
// solo por eso— entran en el barrel, que lo carga el proyecto Vitest `node` sin
// `window`. Lo vigila `test/contrato.test.js`.
//
//   · comprobacion — `comprobarGml(...)`: cruza lo que lee `gml/parse.js` con
//     `validation/parcela.js` (autointersecciones, duplicados),
//     `validation/reglas-huso.js` (fuera del huso DECLARADO) y `geo/area.js`
//     (superficie declarada frente a medida). Vive POR ENCIMA de `validation/`
//     y no dentro de `gml/` justamente por eso: `gml/` es capa de dominio y no
//     conoce a nadie por encima suyo.
//   · report — la capa del INFORME. En F08 era `informeContrasteTexto(...)`:
//     comprobación + diagnóstico → el texto del informe de contraste. En F09 son
//     seis módulos y la capa tiene barrel propio (ver más abajo). **No lee el
//     reloj**: la fecha se INYECTA, misma regla que `gml/` y por lo mismo (un
//     snapshot tiene que valer igual dentro de un año).
//
// Lo que NO entra, y hay que dejarlo escrito porque es la frontera que este
// fichero existe para defender: nada de `viewer/` (Leaflet exige `window`),
// nada de `app/` (`document`, `File`, oyentes de la ventana) y **tampoco
// `gml/descargar.js`** (`Blob`, `URL.createObjectURL`, `<a download>`), aunque
// sea de `gml/` y aunque `report/` produzca justo el texto que ese módulo
// entrega. Cualquiera de los tres rompería la suite `node` entera en el import,
// no en el uso. El mismo razonamiento está escrito en `gml/index.js`
// (decisión 1) y en la cabecera de `app/main.js`.
export * as comprobacion from './comprobacion/gml.js'

// ── F09 · `report` deja de ser UN FICHERO y pasa a ser LA CAPA ───────────────
// Hasta aquí la línea decía `export * as report from './report/contraste-texto.js'`:
// el espacio de nombres `report` ERA un módulo, porque la capa tenía uno solo. F09
// le añade cinco módulos puros —`encuadre.js`, `literal.js`, `firma.js`, `pdf.js` y
// `pdf-parcela.js`— y ese atajo deja de sostenerse: o se abría un espacio nuevo en
// la raíz por cada fichero (la capa desparramada) o `report` seguía nombrando a uno
// solo de los seis sin que nada lo dijera. Se hace lo que ya hizo `gml/`: la capa
// tiene su propio barrel, curado y con las decisiones escritas, y aquí entra ese.
//
// ⚠️ `report/canvas.js` SE QUEDA FUERA, y es el `gml/descargar.js` de esta capa:
// crea un `<canvas>` con `document.createElement`, descarga las teselas del WMS con
// `Image` y saca el JPEG con `toBlob`. Es el único módulo de `report/` que toca el
// DOM y el único que habla por la red. `app/dialogo-informe.js` tampoco entra, por
// lo mismo que el resto de `app/`. Los dos están nombrados —no solo omitidos— en el
// guardián estático de `test/contrato.test.js`, porque un módulo que solo nombra
// `document` DENTRO de una función se importaría sin lanzar y dejaría el barrel roto
// en producción y verde en la suite.
export * as report from './report/index.js'

// ── `storage/` NO entra, EN BLOQUE, y no es por el DOM ───────────────────────
// F09 estrena `storage/pie-firma.js`, que guarda el pie de firma entre sesiones, y
// conviene decir por qué no sale aunque su vecino `report/firma.js` sí. `storage/`
// es un ADAPTADOR DE ENTORNO: depende de IndexedDB, una capacidad del navegador.
// La decisión estaba ya escrita —cabecera de `storage/bd.js`, «QUÉ NO ENTRA EN EL
// BARREL RAÍZ»— y este barrel se limita a cumplirla; el guardián de
// `test/contrato.test.js` la vuelve comprobable, que es lo que faltaba.
//
// Y se prohíbe EN BLOQUE, como `viewer/`, `services/` y `app/`, precisamente porque
// aquí la protección técnica NO existe: `storage/*` se importa sin lanzar bajo el
// proyecto `node` (`globalThis.indexedDB` se lee al LLAMAR, como valor por defecto
// de un parámetro, no al cargar; lo dice esa misma cabecera y lo demuestra
// `test/storage/bd.test.js`, que corre sin jsdom). O sea: meter `storage/` aquí no
// pondría nada en rojo. Sería un error de CAPAS que se quedaría en verde para
// siempre — y una regla que solo se sostiene sola cuando romperla revienta no es una
// regla, es una casualidad. Por eso la prohibición se escribe entera y no se deja en
// «basta con no exportarlo».

