// Concreta GML — F00 · Cimientos. Superficie pública del motor numérico y el modelo.
// Se exponen como espacios de nombres para evitar colisiones (p.ej. `meridianoCentral`
// lo exportan tanto utm como huso) y para dejar clara la frontera de cada dominio.
//
// Frontera de proyección (ÚNICO lugar donde aparece lat/lon, regla de oro 3):
//   - utm  : proyección directa/inversa ETRS89/GRS80.
//   - huso : detección de huso (desproyecta el centroide) y saneamiento de coordenadas.
// El resto (area, cierre, model/*) trabaja SIEMPRE en UTM [x,y].

export * as utm from './geo/utm.js'
export * as area from './geo/area.js'
export * as huso from './geo/huso.js'
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
export * as gml from './gml/index.js'
