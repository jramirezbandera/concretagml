/* -------------------------------------------------------------------------- *
 * test/geo/utm-control.factory.test.js — Test de FÁBRICA del motor UTM       *
 *                                                                            *
 * proj4 se usa AQUÍ Y SOLO AQUÍ como verdad-terreno independiente (regla de  *
 * oro §2.7: prohibido proj4 en runtime; permitido en un test de fábrica de   *
 * fixtures). Contrasta `geo/utm.js` (serie de Krüger propia) contra proj4    *
 * sobre una malla densa de husos 29/30/31, y contra vectores DOCUMENTADOS.   *
 *                                                                            *
 * Ancla de "valores conocidos":                                              *
 *   - Vector de prueba de Chris Veness (docs de geodesy/utm.js):             *
 *       LatLon(48.8582, 2.2945)  →  31 N 448251.795 5411932.678             *
 *       (48°51′29.52″N, 002°17′40.20″E)                                       *
 *     Fuente: www.movable-type.co.uk/scripts/latlong-utm-mgrs.html          *
 *     (WGS84 en el original; nuestro motor es GRS80 → coincide sub-mm por    *
 *      la diferencia de elipsoide ≈ 0.1 mm, dossier §3.1).                   *
 *   - IGN (RESUELTO, auditoría A2): puntos AUTORIZADOS de la Calculadora     *
 *     Geodésica del IGN capturados el 2026-07-24 y versionados en            *
 *     test/fixtures/geo/ign-control.json (uno por huso, con K y W).          *
 *     Se asertan en test/geo/utm.test.js (ancla IGN, sin proj4).             *
 *                                                                            *
 * Emite además test/fixtures/geo/utm-control.json con la malla generada.     *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { forward, inverse, meridianoCentral } from '../../geo/utm.js';

// Defs proj4 GRS80/ETRS89 por huso. towgs84=0 → la lat/lon de entrada (que
// proj4 interpreta como WGS84) se trata como GRS80: proyección pura sin salto
// de datum. ETRS89 ≈ WGS84 (< 1 mm), así que sirve de contraste independiente.
const DEFS = {
    29: '+proj=utm +zone=29 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    30: '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    31: '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
};

const ZONAS = [29, 30, 31];
const LATS = [36, 37, 38, 39, 40, 41, 42, 43];       // 8 latitudes
const DLON = [-3, -2, -1, 0, 1, 2, 3];               // 7 longitudes (CM ± 3°)

const DEG = Math.PI / 180;
const A_GRS80 = 6378137;

/** Aproxima un error angular (grados) a metros en el punto (lat). */
function degErrorToMeters(dLonDeg, dLatDeg, latDeg) {
    const mLat = Math.abs(dLatDeg) * DEG * A_GRS80;
    const mLon = Math.abs(dLonDeg) * DEG * A_GRS80 * Math.cos(latDeg * DEG);
    return Math.hypot(mLat, mLon);
}

/** Malla densa de puntos de control. */
function malla() {
    const pts = [];
    for (const zona of ZONAS) {
        const cm = meridianoCentral(zona);
        for (const lat of LATS) {
            for (const d of DLON) {
                pts.push({ zona, lat, lon: cm + d });
            }
        }
    }
    return pts;
}

describe('geo/utm — contraste contra proj4 (verdad-terreno independiente)', () => {
    const pts = malla();

    // Tolerancia 1e-6 m (auditoría A3): lo medido es ~2e-9 m; a 1e-3 m el
    // contraste no discriminaría ni un elipsoide equivocado (GRS80↔WGS84 ≈ 1e-4 m).
    it('forward: |geo.utm − proj4| < 1e-6 m sobre la malla 29/30/31', () => {
        expect(pts.length).toBe(168); // guarda anti-malla-vacía (auditoría A3)
        let maxDiff = 0, worst = null;
        for (const p of pts) {
            const o = forward(p.lat, p.lon, p.zona);
            const [px, py] = proj4(DEFS[p.zona], [p.lon, p.lat]);
            const d = Math.max(Math.abs(o.x - px), Math.abs(o.y - py));
            if (d > maxDiff) { maxDiff = d; worst = p; }
        }
        expect(maxDiff, `peor punto: ${JSON.stringify(worst)}`).toBeLessThan(1e-6);
    });

    it('inverse: |geo.utm − proj4| < 1e-6 m sobre la malla 29/30/31', () => {
        expect(pts.length).toBe(168); // guarda anti-malla-vacía (auditoría A3)
        let maxDiff = 0, worst = null;
        for (const p of pts) {
            // punto UTM de partida vía proj4 (verdad-terreno)
            const [px, py] = proj4(DEFS[p.zona], [p.lon, p.lat]);
            const o = inverse(px, py, p.zona);
            const [plon, plat] = proj4(DEFS[p.zona]).inverse([px, py]);
            const d = degErrorToMeters(o.lon - plon, o.lat - plat, p.lat);
            if (d > maxDiff) { maxDiff = d; worst = p; }
        }
        expect(maxDiff, `peor punto: ${JSON.stringify(worst)}`).toBeLessThan(1e-6);
    });
});

describe('geo/utm — ancla de valores conocidos (Chris Veness, documentado)', () => {
    // LatLon(48.8582, 2.2945) → 31 N 448251.795 5411932.678
    const LAT = 48.8582, LON = 2.2945, Z = 31;
    const X_DOC = 448251.795, Y_DOC = 5411932.678;
    // 48°51′29.52″N, 002°17′40.20″E (valor recíproco documentado)
    const LAT_DMS = 48 + 51 / 60 + 29.52 / 3600;
    const LON_DMS = 2 + 17 / 60 + 40.20 / 3600;

    it('forward(48.8582, 2.2945, 31) ≈ 448251.795 / 5411932.678 (sub-mm)', () => {
        const o = forward(LAT, LON, Z);
        expect(Math.abs(o.x - X_DOC)).toBeLessThan(1e-3);
        expect(Math.abs(o.y - Y_DOC)).toBeLessThan(1e-3);
    });

    it('inverse(448251.795, 5411932.678, 31) ≈ 48°51′29.52″N 002°17′40.20″E', () => {
        const o = inverse(X_DOC, Y_DOC, Z);
        expect(Math.abs(o.lat - LAT_DMS)).toBeLessThan(1e-6); // ~0.1 m
        expect(Math.abs(o.lon - LON_DMS)).toBeLessThan(1e-6);
    });

    it('el vector de Veness también concuerda con proj4 GRS80 (sub-nm)', () => {
        const [px, py] = proj4(DEFS[Z], [LON, LAT]);
        const o = forward(LAT, LON, Z);
        expect(Math.abs(o.x - px)).toBeLessThan(1e-6);
        expect(Math.abs(o.y - py)).toBeLessThan(1e-6);
    });
});

describe('geo/utm — emisión del fixture de control', () => {
    it('genera test/fixtures/geo/utm-control.json con la malla proj4', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const outDir = resolve(here, '../fixtures/geo');
        const outFile = resolve(outDir, 'utm-control.json');

        const puntos = malla().map(({ zona, lat, lon }) => {
            const [x, y] = proj4(DEFS[zona], [lon, lat]);
            return { zona, lat, lon: Number(lon.toFixed(9)), x, y };
        });

        const fixture = {
            _comentario: 'Malla de control UTM (verdad-terreno proj4/PROJ etmerc, GRS80). '
                + 'Generada por test/geo/utm-control.factory.test.js. proj4 SOLO en fábrica, nunca en runtime.',
            _fuente: 'proj4 2.x (+proj=utm +ellps=GRS80) + vector documentado de Chris Veness geodesy/utm.js',
            _ancla_veness: { lat: 48.8582, lon: 2.2945, zona: 31, x: 448251.795, y: 5411932.678 },
            _ancla_ign: 'Puntos AUTORIZADOS del IGN en test/fixtures/geo/ign-control.json (capturados 2026-07-24; asertados en utm.test.js).',
            elipsoide: { a: 6378137, f: '1/298.257222101', k0: 0.9996, FE: 500000, FN: 0 },
            husos: ZONAS.map((z) => ({ zona: z, meridianoCentral: meridianoCentral(z), epsg: 25800 + z })),
            puntos,
        };

        mkdirSync(outDir, { recursive: true });
        writeFileSync(outFile, JSON.stringify(fixture, null, 2) + '\n', 'utf8');

        expect(puntos.length).toBe(ZONAS.length * LATS.length * DLON.length);
    });
});
