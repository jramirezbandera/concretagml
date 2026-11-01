/* -------------------------------------------------------------------------- *
 * app/apagado.js — UN BOTÓN APAGADO QUE SIGUE SIENDO ENFOCABLE                *
 * -------------------------------------------------------------------------- */
//
// Los cuatro CTA del pie de Edición —«Traer el parcelario de fondo», «Traer
// colindantes», «Diagnosticar encaje» y «Rehacer el parcelario»— dicen por qué
// están apagados en un globo que sale al señalarlos (`estilos/app.css`, «EL MOTIVO
// DEL BOTÓN APAGADO SE VUELVE PISTA»). Con `disabled` ese globo era solo de ratón:
// un `<button disabled>` no es enfocable, así que con el teclado no había gesto
// con el que abrirlo (TODOS.md, cerrada el 2026-11-01).
//
// Por eso estos cuatro se apagan con `aria-disabled="true"`: el lector de pantalla
// lo anuncia igual («atenuado»), el tabulador llega, y el globo abre con
// `:focus-within`. El precio es que el botón sigue siendo PULSABLE, así que cada
// manejador pregunta {@link estaApagado} antes de hacer nada. Pulsarlo apagado no
// hace nada más que lo que ya hace enfocarlo: enseñar el motivo.
//
// ⚠️ Solo para esos cuatro. El resto de la aplicación sigue con `disabled`, que es
// lo correcto donde no hay pista que abrir.

/**
 * Apaga o enciende un botón sin sacarlo del orden de tabulación.
 *
 * Se QUITA el atributo al encender, en vez de dejarlo a `"false"`: así el selector
 * `[aria-disabled='true']` es el único estado que la hoja tiene que conocer.
 *
 * @param {HTMLElement} boton
 * @param {boolean} apagado
 */
export function apagar(boton, apagado) {
  if (apagado) boton.setAttribute('aria-disabled', 'true')
  else boton.removeAttribute('aria-disabled')
}

/**
 * ¿Está apagado? Lo que cada manejador mira antes de actuar.
 *
 * @param {HTMLElement} boton
 * @returns {boolean}
 */
export const estaApagado = (boton) => boton.getAttribute('aria-disabled') === 'true'
