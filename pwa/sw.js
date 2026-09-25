// pwa/sw.js — 2026-09-25 · PLANTILLA del service worker. No se sirve tal cual:
// `vite.config.js#gmlServiceWorker` la compone con `pwa/precache.js` y la emite como
// `dist/sw.js`, con la lista de ficheros y la versión escritas en las dos marcas de
// abajo. Sin componer también es válida —precachea nada y se llama `dev`—, que es
// como la ejecutan las pruebas.
//
// ── QUÉ HACE, Y QUÉ NO ──────────────────────────────────────────────────────
// Dos cosas, y las dos para lo mismo: que la aplicación se pueda INSTALAR (y con ello
// que el navegador conserve los expedientes, ver `pwa/precache.js`) y que abra sin
// conexión con lo último que se cargó.
//
//   · **La portada, red primero.** Con conexión se sirve siempre la versión publicada:
//     un service worker que sirviera la portada de la caché dejaría a todo el mundo en
//     la versión del día en que lo instaló. Sin conexión, la última portada buena.
//   · **Lo demás del propio sitio, caché primero.** Son los ficheros del paquete, que
//     llevan el hash en el nombre: si el nombre es el mismo, el contenido también.
//   · **NADA de otros orígenes, ni se mira.** El Catastro, el IGN y OSM pasan de largo
//     sin `respondWith`. El Catastro tiene su caché en IndexedDB con su propia política
//     de antigüedad (`storage/cache-catastro.js`), y una segunda caché aquí sería una
//     segunda verdad sobre la misma parcela — además de un modo de saltarse, sin
//     saberlo, el régimen de uso que el README explica.
//
// ── ⛔ POR QUÉ NO HAY `skipWaiting()` ────────────────────────────────────────
// Una versión nueva espera a que se cierren las pestañas de la vieja, que es lo que
// hace el navegador por defecto. Forzarla borraría la caché de la versión vieja con una
// pestaña vieja todavía abierta. No se pierde nada por esperar: la portada va por red,
// así que recargar con conexión ya trae la versión nueva aunque este script siga siendo
// el anterior.

'use strict'

const PRECACHE = /* @gml-precache */ []
const VERSION = /* @gml-version */ 'dev'
const PREFIJO = 'concreta-gml-'
const CACHE = PREFIJO + VERSION

/** Una ruta relativa al alcance, como URL absoluta. */
const aUrl = (ruta) => new URL(ruta, self.registration.scope).href

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(aUrl))))
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((clave) => clave.startsWith(PREFIJO) && clave !== CACHE)
            .map((clave) => caches.delete(clave)),
        ),
      ),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  // Fuera del alcance —otro origen, u otra ruta del mismo— no se toca.
  if (!peticion.url.startsWith(self.registration.scope)) return
  evento.respondWith(peticion.mode === 'navigate' ? redPrimero(peticion) : cachePrimero(peticion))
})

/**
 * La portada: red primero y, si no hay red, la última buena. Se guarda con la clave de
 * la PORTADA y no con la de la petición, porque la misma página llega con consultas
 * distintas (`?demo=real`) y sin conexión tiene que abrir igual.
 */
async function redPrimero(peticion) {
  const portada = aUrl('./')
  try {
    const respuesta = await fetch(peticion)
    if (respuesta.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(portada, respuesta.clone())
    }
    return respuesta
  } catch (causa) {
    const guardada = await caches.match(portada)
    if (guardada) return guardada
    throw causa
  }
}

/** Lo demás: de la caché si está; si no, de la red, y se queda para la próxima. */
async function cachePrimero(peticion) {
  const guardada = await caches.match(peticion)
  if (guardada) return guardada
  const respuesta = await fetch(peticion)
  if (respuesta.ok && respuesta.type === 'basic') {
    const cache = await caches.open(CACHE)
    await cache.put(peticion, respuesta.clone())
  }
  return respuesta
}
