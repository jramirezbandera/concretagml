/* -------------------------------------------------------------------------- *
 * geo/utm.js — Motor UTM (ETRS89 / GRS80) sin proj4js                        *
 *                                                                            *
 * Proyección Transversa de Mercator por serie de Krüger de 6.º orden,        *
 * método de Karney (2011) «Transverse Mercator with an accuracy of a few     *
 * nanometers», sobre Krüger (1912).                                          *
 *                                                                            *
 * Coeficientes α/β y fórmulas de convergencia/escala PORTADOS VERBATIM de    *
 * `geodesy/utm.js` de Chris Veness (MIT):                                    *
 *   https://github.com/chrisveness/geodesy/blob/master/utm.js               *
 *   (c) Chris Veness 2014-2022, MIT Licence.                                  *
 *                                                                            *
 * Adaptaciones para Concreta GML (reglas de oro §2.3, §2.7):                 *
 *   - Elipsoide GRS80 (ETRS89) en lugar de WGS84.                            *
 *   - Hemisferio SIEMPRE Norte (España): FN = 0, sin falso Norte.            *
 *   - API por huso explícito (zona), sin autodetección ni excepciones        *
 *     Noruega/Svalbard (fuera de alcance).                                   *
 *   - Sin dependencias externas: NO importa proj4/proj4js.                    *
 *                                                                            *
 * Este es el ÚNICO punto del proyecto donde aparece lat/lon (regla de oro 3).*
 * -------------------------------------------------------------------------- */

// ---- Elipsoide GRS80 (ETRS89) y constantes UTM ----
const a  = 6378137;              // semieje mayor GRS80 (m)
const f  = 1 / 298.257222101;    // achatamiento GRS80
const k0 = 0.9996;               // factor de escala en el meridiano central
const FE = 500000;               // falso Este (m)
const FN = 0;                    // falso Norte, hemisferio Norte (m)

const DEG = Math.PI / 180;       // grados → radianes
const RAD = 180 / Math.PI;       // radianes → grados

// ---- Cantidades derivadas del elipsoide (constantes) ----
const e  = Math.sqrt(f * (2 - f)); // primera excentricidad
const n  = f / (2 - f);            // 3.er achatamiento
const n2 = n * n, n3 = n * n2, n4 = n * n3, n5 = n * n4, n6 = n * n5;

// 2πA es la circunferencia de un meridiano
const A = a / (1 + n) * (1 + 1 / 4 * n2 + 1 / 64 * n4 + 1 / 256 * n6);

// Serie de Krüger de 6.º orden — coeficientes α (directa lat/lon → UTM).
// VERBATIM de Chris Veness (array base-1: el índice 0 es null).
const α = [null,
    1 / 2 * n - 2 / 3 * n2 + 5 / 16 * n3 + 41 / 180 * n4 - 127 / 288 * n5 + 7891 / 37800 * n6,
    13 / 48 * n2 - 3 / 5 * n3 + 557 / 1440 * n4 + 281 / 630 * n5 - 1983433 / 1935360 * n6,
    61 / 240 * n3 - 103 / 140 * n4 + 15061 / 26880 * n5 + 167603 / 181440 * n6,
    49561 / 161280 * n4 - 179 / 168 * n5 + 6601661 / 7257600 * n6,
    34729 / 80640 * n5 - 3418889 / 1995840 * n6,
    212378941 / 319334400 * n6];

// Serie de Krüger de 6.º orden — coeficientes β (inversa UTM → lat/lon).
// VERBATIM de Chris Veness (array base-1: el índice 0 es null).
const β = [null,
    1 / 2 * n - 2 / 3 * n2 + 37 / 96 * n3 - 1 / 360 * n4 - 81 / 512 * n5 + 96199 / 604800 * n6,
    1 / 48 * n2 + 1 / 15 * n3 - 437 / 1440 * n4 + 46 / 105 * n5 - 1118711 / 3870720 * n6,
    17 / 480 * n3 - 37 / 840 * n4 - 209 / 4480 * n5 + 5569 / 90720 * n6,
    4397 / 161280 * n4 - 11 / 504 * n5 - 830251 / 7257600 * n6,
    4583 / 161280 * n5 - 108847 / 3991680 * n6,
    20648693 / 638668800 * n6];

/**
 * Valida el huso: entero en [1, 60] (auditoría A7, regla de oro 1: un huso
 * imposible producía coordenadas basura SIN error). El flujo del proyecto usa
 * 29/30/31 (+28 diferido, O13), pero el motor es válido para cualquier huso UTM.
 * @param {number} zona - huso UTM.
 * @param {string} fn - nombre de la función llamante (para el mensaje).
 */
function validarZona(zona, fn) {
    if (!Number.isInteger(zona) || zona < 1 || zona > 60) {
        throw new RangeError(`${fn}: huso inválido ‘${zona}’ (entero en [1, 60])`);
    }
}

/**
 * Meridiano central del huso, en grados: λ0 = (zona-1)·6 − 180 + 3.
 * Huso 29 → −9°, huso 30 → −3°, huso 31 → +3°.
 * @param {number} zona - huso UTM (p. ej. 29, 30, 31).
 * @returns {number} longitud del meridiano central en grados.
 */
export function meridianoCentral(zona) {
    return (zona - 1) * 6 - 180 + 3;
}

/**
 * Proyección directa: geográficas (grados) → UTM (metros).
 * Implementa el método de Karney/Krüger de 6.º orden (Veness `toUtm`).
 *
 * @param {number} lat  - latitud en grados (hemisferio Norte).
 * @param {number} lon  - longitud en grados.
 * @param {number} zona - huso UTM (29/30/31 en España peninsular + Baleares).
 * @returns {{x:number, y:number, zona:number, convergencia:number, escala:number}}
 *          x = Este (m), y = Norte (m); convergencia en grados; escala adimensional.
 */
export function forward(lat, lon, zona) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new TypeError(`forward: lat/lon no finitos (lat=${lat}, lon=${lon})`);
    }
    validarZona(zona, 'forward');

    const λ0 = meridianoCentral(zona) * DEG; // meridiano central en radianes

    const φ = lat * DEG;         // latitud respecto al ecuador
    const λ = lon * DEG - λ0;    // longitud respecto al meridiano central

    const cosλ = Math.cos(λ), sinλ = Math.sin(λ), tanλ = Math.tan(λ);

    // τ ≡ tanφ ; τʹ ≡ tanφʹ (prima ʹ = ángulos en la esfera conforme)
    const τ = Math.tan(φ);
    const σ = Math.sinh(e * Math.atanh(e * τ / Math.sqrt(1 + τ * τ)));

    const τʹ = τ * Math.sqrt(1 + σ * σ) - σ * Math.sqrt(1 + τ * τ);

    const ξʹ = Math.atan2(τʹ, cosλ);
    const ηʹ = Math.asinh(sinλ / Math.sqrt(τʹ * τʹ + cosλ * cosλ));

    let ξ = ξʹ;
    for (let j = 1; j <= 6; j++) ξ += α[j] * Math.sin(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);

    let η = ηʹ;
    for (let j = 1; j <= 6; j++) η += α[j] * Math.cos(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

    let x = k0 * A * η;
    let y = k0 * A * ξ;

    // ---- convergencia: Karney 2011 Eq 23, 24
    let pʹ = 1;
    for (let j = 1; j <= 6; j++) pʹ += 2 * j * α[j] * Math.cos(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);
    let qʹ = 0;
    for (let j = 1; j <= 6; j++) qʹ += 2 * j * α[j] * Math.sin(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

    const γʹ = Math.atan(τʹ / Math.sqrt(1 + τʹ * τʹ) * tanλ);
    const γʺ = Math.atan2(qʹ, pʹ);
    const γ = γʹ + γʺ;

    // ---- escala: Karney 2011 Eq 25
    const sinφ = Math.sin(φ);
    const kʹ = Math.sqrt(1 - e * e * sinφ * sinφ) * Math.sqrt(1 + τ * τ) / Math.sqrt(τʹ * τʹ + cosλ * cosλ);
    const kʺ = A / a * Math.sqrt(pʹ * pʹ + qʹ * qʹ);
    const k = k0 * kʹ * kʺ;

    // ---- desplazar a orígenes falsos (hemisferio Norte: FN = 0)
    x = x + FE;
    y = y + FN;

    return {
        x,
        y,
        zona,
        convergencia: γ * RAD, // grados
        escala: k,             // adimensional
    };
}

/**
 * Proyección inversa: UTM (metros) → geográficas (grados).
 * Implementa el método de Karney/Krüger de 6.º orden (Veness `toLatLon`).
 *
 * @param {number} x    - Este (m).
 * @param {number} y    - Norte (m).
 * @param {number} zona - huso UTM.
 * @returns {{lat:number, lon:number, convergencia:number, escala:number}}
 *          lat/lon en grados; convergencia en grados; escala adimensional.
 */
export function inverse(x, y, zona) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new TypeError(`inverse: x/y no finitos (x=${x}, y=${y})`);
    }
    validarZona(zona, 'inverse');

    const xr = x - FE; // x ± relativo al meridiano central
    const yr = y - FN; // y ± relativo al ecuador (hemisferio Norte: FN = 0)

    const η = xr / (k0 * A);
    const ξ = yr / (k0 * A);

    let ξʹ = ξ;
    for (let j = 1; j <= 6; j++) ξʹ -= β[j] * Math.sin(2 * j * ξ) * Math.cosh(2 * j * η);

    let ηʹ = η;
    for (let j = 1; j <= 6; j++) ηʹ -= β[j] * Math.cos(2 * j * ξ) * Math.sinh(2 * j * η);

    const sinhηʹ = Math.sinh(ηʹ);
    const sinξʹ = Math.sin(ξʹ), cosξʹ = Math.cos(ξʹ);

    const τʹ = sinξʹ / Math.sqrt(sinhηʹ * sinhηʹ + cosξʹ * cosξʹ);

    // Newton-Raphson para recuperar τ ≡ tanφ desde τʹ (Karney Eq 19-21)
    let δτi = null;
    let τi = τʹ;
    do {
        const σi = Math.sinh(e * Math.atanh(e * τi / Math.sqrt(1 + τi * τi)));
        const τiʹ = τi * Math.sqrt(1 + σi * σi) - σi * Math.sqrt(1 + τi * τi);
        δτi = (τʹ - τiʹ) / Math.sqrt(1 + τiʹ * τiʹ)
            * (1 + (1 - e * e) * τi * τi) / ((1 - e * e) * Math.sqrt(1 + τi * τi));
        τi += δτi;
    } while (Math.abs(δτi) > 1e-12); // δτi → 0 en 2-3 iteraciones (IEEE 754)
    const τ = τi;

    const φ = Math.atan(τ);
    let λ = Math.atan2(sinhηʹ, cosξʹ);

    // ---- convergencia: Karney 2011 Eq 26, 27
    let p = 1;
    for (let j = 1; j <= 6; j++) p -= 2 * j * β[j] * Math.cos(2 * j * ξ) * Math.cosh(2 * j * η);
    let q = 0;
    for (let j = 1; j <= 6; j++) q += 2 * j * β[j] * Math.sin(2 * j * ξ) * Math.sinh(2 * j * η);

    const γʹ = Math.atan(Math.tan(ξʹ) * Math.tanh(ηʹ));
    const γʺ = Math.atan2(q, p);
    const γ = γʹ + γʺ;

    // ---- escala: Karney 2011 Eq 28
    const sinφ = Math.sin(φ);
    const kʹ = Math.sqrt(1 - e * e * sinφ * sinφ) * Math.sqrt(1 + τ * τ) * Math.sqrt(sinhηʹ * sinhηʹ + cosξʹ * cosξʹ);
    const kʺ = A / a / Math.sqrt(p * p + q * q);
    const k = k0 * kʹ * kʺ;

    const λ0 = meridianoCentral(zona) * DEG;
    λ += λ0; // de coordenadas zonales a globales

    return {
        lat: φ * RAD,
        lon: λ * RAD,
        convergencia: γ * RAD, // grados
        escala: k,             // adimensional
    };
}

/**
 * Convergencia de meridianos (bearing del Norte de cuadrícula respecto al
 * Norte geográfico, horario), en grados, para una geográfica dada.
 * @param {number} lat  - latitud en grados.
 * @param {number} lon  - longitud en grados.
 * @param {number} zona - huso UTM.
 * @returns {number} convergencia en grados.
 */
export function convergencia(lat, lon, zona) {
    return forward(lat, lon, zona).convergencia;
}

/**
 * Factor de escala de la proyección (adimensional) para una geográfica dada.
 * @param {number} lat  - latitud en grados.
 * @param {number} lon  - longitud en grados.
 * @param {number} zona - huso UTM.
 * @returns {number} factor de escala.
 */
export function escala(lat, lon, zona) {
    return forward(lat, lon, zona).escala;
}
