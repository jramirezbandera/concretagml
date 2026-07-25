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
export * as parcela from './model/parcela.js'
export * as edificio from './model/edificio.js'
export * as historial from './edit/historial.js'
export * as validacion from './validation/parcela.js'
