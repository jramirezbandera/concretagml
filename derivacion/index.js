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
// `_comun.js` tampoco sale: es el vocabulario interno. Lo que la aplicación
// necesita saber de él —los tipos de detección— viaja DENTRO de las detecciones.
//
// Este barrel entra en el barrel raíz (`index.js`) como espacio `derivacion`.

export {
  SEVERIDAD,
  TIPO_DERIVACION,
  MOTIVO_RESTA,
  crearDeteccionDerivacion,
  resumirDetecciones,
} from './_comun.js'
