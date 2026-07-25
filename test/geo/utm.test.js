/* -------------------------------------------------------------------------- *
 * test/geo/utm.test.js — Round-trip y propiedades del motor UTM              *
 *                                                                            *
 * Verifica (criterio de aceptación 1 de F00):                                *
 *   - inverse(forward(lat,lon,z)) recupera lat/lon con error < 1e-9°         *
 *   - forward(inverse(x,y,z))     recupera x/y con error   < 1e-6 m          *
 *     sobre una malla de husos 29/30/31 (lat 36-43, lon = CM(z) ± 3°).       *
 *   - En el meridiano central: escala ≈ 0.9996 (tol 1e-9),                    *
 *     convergencia ≈ 0 (tol 1e-9).                                            *
 *                                                                            *
 * Sin proj4 aquí: son propiedades internas del motor (round-trip). El        *
 * contraste con verdad-terreno independiente vive en utm-control.factory.    *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { forward, inverse, meridianoCentral, convergencia, escala } from '../../geo/utm.js';

const ZONAS = [29, 30, 31];
const LATS = [36, 37, 38, 39, 40, 41, 42, 43];
// desplazamientos de longitud respecto al meridiano central (± 3°)
const DLON = [-3, -2, -1, 0, 1, 2, 3];

/** Genera la malla de puntos (lat, lon, zona) de prueba. */
function malla() {
    const pts = [];
    for (const zona of ZONAS) {
        const cm = meridianoCentral(zona);
        for (const lat of LATS) {
            for (const d of DLON) {
                pts.push({ lat, lon: cm + d, zona, dlon: d });
            }
        }
    }
    return pts;
}

describe('geo/utm — meridianos centrales', () => {
    it('λ0 = (zona-1)·6 − 180 + 3 → 29:−9°, 30:−3°, 31:+3°', () => {
        expect(meridianoCentral(29)).toBe(-9);
        expect(meridianoCentral(30)).toBe(-3);
        expect(meridianoCentral(31)).toBe(3);
    });
});

describe('geo/utm — round-trip inverse(forward) < 1e-9°', () => {
    const pts = malla();
    let maxErrLat = 0, maxErrLon = 0;

    for (const p of pts) {
        it(`z${p.zona} lat=${p.lat} lon=${p.lon.toFixed(0)}`, () => {
            const utm = forward(p.lat, p.lon, p.zona);
            const geo = inverse(utm.x, utm.y, p.zona);
            const eLat = Math.abs(geo.lat - p.lat);
            const eLon = Math.abs(geo.lon - p.lon);
            maxErrLat = Math.max(maxErrLat, eLat);
            maxErrLon = Math.max(maxErrLon, eLon);
            expect(eLat).toBeLessThan(1e-9);
            expect(eLon).toBeLessThan(1e-9);
        });
    }

    it('resumen: error máx lat/lon en la malla', () => {
        // Guarda anti-malla-vacía (auditoría A3): sin esto, una malla de 0
        // puntos dejaría maxErr=0 y el resumen pasaría VACÍAMENTE.
        expect(pts.length).toBe(168); // 3 husos × 8 lat × 7 dlon
        // Debe quedar holgadamente por debajo de 1e-9° (típicamente ~1e-12°).
        expect(maxErrLat).toBeLessThan(1e-9);
        expect(maxErrLon).toBeLessThan(1e-9);
    });
});

describe('geo/utm — round-trip forward(inverse) < 1e-6 m', () => {
    const pts = malla();
    let maxErrX = 0, maxErrY = 0;

    for (const p of pts) {
        it(`z${p.zona} lat=${p.lat} lon=${p.lon.toFixed(0)}`, () => {
            // Punto UTM de partida (proyectamos la geográfica una vez).
            const utm0 = forward(p.lat, p.lon, p.zona);
            const geo = inverse(utm0.x, utm0.y, p.zona);
            const utm1 = forward(geo.lat, geo.lon, p.zona);
            const eX = Math.abs(utm1.x - utm0.x);
            const eY = Math.abs(utm1.y - utm0.y);
            maxErrX = Math.max(maxErrX, eX);
            maxErrY = Math.max(maxErrY, eY);
            expect(eX).toBeLessThan(1e-6);
            expect(eY).toBeLessThan(1e-6);
        });
    }

    it('resumen: error máx x/y en la malla', () => {
        expect(pts.length).toBe(168); // guarda anti-malla-vacía (auditoría A3)
        expect(maxErrX).toBeLessThan(1e-6);
        expect(maxErrY).toBeLessThan(1e-6);
    });
});

describe('geo/utm — oráculo bloqueado: fixture utm-control.json (auditoría A3)', () => {
    // El fixture lo emite el test de fábrica (verdad-terreno proj4) y está
    // VERSIONADO: aquí se lee como oráculo independiente del run. Un cambio de
    // comportamiento del motor (p. ej. elipsoide equivocado) rompe ESTE test
    // aunque los round-trips (auto-consistentes) siguieran en verde.
    it('forward reproduce los 168 puntos del fixture a < 1e-6 m', async () => {
        const { default: control } = await import('../fixtures/geo/utm-control.json', { with: { type: 'json' } });
        expect(control.puntos.length).toBe(168); // guarda anti-fixture-vacío
        let maxDiff = 0;
        for (const p of control.puntos) {
            const o = forward(p.lat, p.lon, p.zona);
            maxDiff = Math.max(maxDiff, Math.abs(o.x - p.x), Math.abs(o.y - p.y));
        }
        expect(maxDiff).toBeLessThan(1e-6); // µm: discrimina elipsoide (Δ GRS80/WGS84 ≈ 1e-4 m)
    });

    it('inverse reproduce las geográficas del fixture a < 1e-11°', async () => {
        const { default: control } = await import('../fixtures/geo/utm-control.json', { with: { type: 'json' } });
        expect(control.puntos.length).toBe(168);
        let maxDiff = 0;
        for (const p of control.puntos) {
            const o = inverse(p.x, p.y, p.zona);
            maxDiff = Math.max(maxDiff, Math.abs(o.lat - p.lat), Math.abs(o.lon - p.lon));
        }
        expect(maxDiff).toBeLessThan(1e-11); // grados; ~1 µm en el terreno
    });
});

describe('geo/utm — meridiano central: escala 0.9996 y convergencia 0', () => {
    for (const zona of ZONAS) {
        const cm = meridianoCentral(zona);
        for (const lat of LATS) {
            it(`z${zona} lat=${lat} lon=CM: k≈0.9996, γ≈0`, () => {
                const r = forward(lat, cm, zona);
                expect(Math.abs(r.escala - 0.9996)).toBeLessThan(1e-9);
                expect(Math.abs(r.convergencia)).toBeLessThan(1e-9);
                // helpers sueltos coinciden con el objeto de resultado
                expect(escala(lat, cm, zona)).toBe(r.escala);
                expect(convergencia(lat, cm, zona)).toBe(r.convergencia);
            });
        }
    }
});

describe('geo/utm — coherencia convergencia/escala directa vs inversa', () => {
    // La convergencia y escala calculadas en directa e inversa deben coincidir
    // (mismo punto físico). Fuera del CM la convergencia crece con la latitud.
    for (const zona of ZONAS) {
        const cm = meridianoCentral(zona);
        it(`z${zona}: fwd vs inv convergencia y escala coinciden (tol 1e-7)`, () => {
            for (const lat of [36, 39.5, 43]) {
                for (const d of [-3, -1.5, 1.5, 3]) {
                    const f = forward(lat, cm + d, zona);
                    const i = inverse(f.x, f.y, zona);
                    expect(Math.abs(f.convergencia - i.convergencia)).toBeLessThan(1e-7);
                    expect(Math.abs(f.escala - i.escala)).toBeLessThan(1e-9);
                    // convergencia con signo: hemisferio Norte, al Este del CM → γ>0
                    if (d > 0) expect(f.convergencia).toBeGreaterThan(0);
                    if (d < 0) expect(f.convergencia).toBeLessThan(0);
                }
            }
        });
    }
});

describe('geo/utm — ancla IGN: puntos AUTORIZADOS de la Calculadora Geodésica (criterio 1)', () => {
    // Verdad-terreno oficial (test/fixtures/geo/ign-control.json, capturados de
    // ign.es/web/calculadora-geodesica el 2026-07-24). Un punto por huso.
    // Tolerancias = resolución de la salida del IGN: X/Y ±1 mm (publica mm),
    // K ±2e-8 (publica 8 decimales), W ±1″ (publica segundos enteros).
    it('forward reproduce los 3 puntos IGN (X/Y a ±1 mm, K a ±2e-8, W a ±1″)', async () => {
        const { default: ign } = await import('../fixtures/geo/ign-control.json', { with: { type: 'json' } });
        expect(ign.puntos.length).toBe(3); // guarda anti-fixture-vacío
        for (const p of ign.puntos) {
            const o = forward(p.lat, p.lon, p.zona);
            expect(Math.abs(o.x - p.xUtm), `X huso ${p.zona}`).toBeLessThan(1e-3);
            expect(Math.abs(o.y - p.yUtm), `Y huso ${p.zona}`).toBeLessThan(1e-3);
            expect(Math.abs(o.escala - p.k), `K huso ${p.zona}`).toBeLessThan(2e-8);
            expect(Math.abs(o.convergencia - p.wGrados), `W huso ${p.zona}`).toBeLessThan(1 / 3600);
        }
    });

    it('inverse recupera las geográficas desde los UTM del IGN (±1 mm ≈ ±1.2e-8°)', async () => {
        const { default: ign } = await import('../fixtures/geo/ign-control.json', { with: { type: 'json' } });
        for (const p of ign.puntos) {
            const o = inverse(p.xUtm, p.yUtm, p.zona);
            // 1 mm en el terreno ≈ 9e-9° lat; margen 2e-8°.
            expect(Math.abs(o.lat - p.lat), `lat huso ${p.zona}`).toBeLessThan(2e-8);
            expect(Math.abs(o.lon - p.lon), `lon huso ${p.zona}`).toBeLessThan(2e-8);
        }
    });
});

describe('geo/utm — validación de entradas', () => {
    it('forward rechaza lat/lon no finitos', () => {
        expect(() => forward(NaN, 0, 30)).toThrow(TypeError);
        expect(() => forward(40, Infinity, 30)).toThrow(TypeError);
    });
    it('inverse rechaza x/y no finitos', () => {
        expect(() => inverse(NaN, 4e6, 30)).toThrow(TypeError);
    });
    it('rechaza huso no entero', () => {
        expect(() => forward(40, -3, 30.5)).toThrow(RangeError);
        expect(() => inverse(5e5, 4e6, 30.5)).toThrow(RangeError);
    });
    it('rechaza huso fuera de rango [1,60] — antes producía basura en silencio (auditoría A7)', () => {
        expect(() => forward(40, -3, 0)).toThrow(RangeError);
        expect(() => forward(40, -3, 61)).toThrow(RangeError);
        expect(() => forward(40, -3, 999)).toThrow(RangeError);
        expect(() => forward(40, -3, -5)).toThrow(RangeError);
        expect(() => inverse(5e5, 4e6, 0)).toThrow(RangeError);
        expect(() => inverse(5e5, 4e6, 999)).toThrow(RangeError);
    });
});
