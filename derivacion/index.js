// derivacion/index.js — Barrel de la capa que DERIVA geometría (F17).
//
// Qué es esta capa: a partir de la geometría OFICIAL de una parcela y de la que el
// usuario ha editado, produce las parcelas que faltan para que el expediente
// CIERRE — el trozo que se suelta, con su superficie y su grosor— y las prepara
// para la entrega. Es la mitad que le faltaba a la aplicación para cerrar un
// expediente de parcelario real (`spec/feature-17-*.md`).
//
// ── ⛔ QUÉ **NO** SALE POR AQUÍ, Y POR QUÉ ───────────────────────────────────
// `derivacion/topologia.js` NO se exporta, igual que `diagnostico/topologia.js` no
// sale del suyo y por el mismo motivo: es la primitiva que llama a Turf, y quien
// sabe qué SIGNIFICA su resultado es `cesion.js`. Exportar `restar` invitaría a
// llamarla desde la interfaz y a repartir por ahí la interpretación —qué es una
// astilla, qué orden llevan las piezas, qué pasa cuando la parcela crece—, que es
// justamente lo que esta capa existe para concentrar.
//
// De `_comun.js` sale el VOCABULARIO —los tipos, la escala de severidad y la
// fábrica— y nada más: sus guardas de contrato (`exigirRecintos`, `describir`…) y
// su formateador de números son herramientas internas de la capa, y sacarlas daría
// dos caminos hasta la misma comprobación.
//
// Este barrel entra en el barrel raíz (`index.js`) como espacio `derivacion`.

export {
  SEVERIDAD,
  TIPO_DERIVACION,
  MOTIVO_RESTA,
  crearDeteccionDerivacion,
  resumirDetecciones,
} from './_comun.js'

// La entrada de la capa: `restar()` da geometría, `derivarCesion()` da el SOBRANTE
// —medido, ordenado y con la puerta `P_new ⊆ P_of` resuelta—, que es lo único que
// la aplicación puede usar sin volver a interpretar nada.
export { derivarCesion } from './cesion.js'

// Quién es cada parcela del expediente. Sale porque lo necesitan tres sitios que no
// se ven entre sí —la matriz en `app/`, la cesión en `derivacion/entrega.js` y el
// informe— y porque tenerlo escrito una vez es lo que impide que la pareja
// `localId`↔`namespace` se combine mal (SPEC §3.1, trampa 2).
export {
  NAMESPACE_CATASTRO,
  NAMESPACE_LOCAL,
  SEPARADOR_SEGREGADA,
  identidadDeCesion,
  identidadDeParcela,
} from './identidad.js'
