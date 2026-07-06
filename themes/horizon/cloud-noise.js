/**
 * Tileable Nubis cloud noise (Schneider & Vos fig. 4), pure JS -
 * renderer-agnostic so the WebGL and WebGPU paths share ONE definition
 * of the noise physics (WebGPU project ground rule). Each renderer
 * wraps the returned arrays in its own Data3DTexture.
 *
 *  - base 64^3 RGBA: R = Perlin-Worley (Perlin dilated by Worley fBm),
 *    GBA = Worley octaves 4/8/16 (the paper uses 128^3 - disclosed
 *    concession for CPU generation time)
 *  - detail 32^3 RGB: Worley octaves 2/4/8 for edge erosion
 */

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable 3D Perlin noise with period wrapping.
export function makePerlin(period, seed) {
  const rand = mulberry(seed);
  const perm = new Uint8Array(512);
  const grads = [];
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = perm[i & 255];
  for (let i = 0; i < 16; i++) {
    const th = rand() * Math.PI * 2;
    const z = rand() * 2 - 1;
    const r = Math.sqrt(1 - z * z);
    grads.push([r * Math.cos(th), r * Math.sin(th), z]);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const g = (ix, iy, iz, dx, dy, dz) => {
    const gi =
      grads[
        perm[
          (((ix % period) + period) % period) +
            perm[
              ((((iy % period) + period) % period) +
                perm[((iz % period) + period) % period]) &
                255
            ]
        ] & 15
      ];
    return gi[0] * dx + gi[1] * dy + gi[2] * dz;
  };
  return (x, y, z) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
      lerp(
        lerp(g(ix, iy, iz, fx, fy, fz), g(ix + 1, iy, iz, fx - 1, fy, fz), u),
        lerp(
          g(ix, iy + 1, iz, fx, fy - 1, fz),
          g(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz),
          u
        ),
        v
      ),
      lerp(
        lerp(
          g(ix, iy, iz + 1, fx, fy, fz - 1),
          g(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1),
          u
        ),
        lerp(
          g(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1),
          g(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1),
          u
        ),
        v
      ),
      w
    );
  };
}

// Tileable 3D Worley (cellular) noise, inverted: 1 at feature points.
export function makeWorley(period, seed) {
  const rand = mulberry(seed);
  const pts = {};
  for (let x = 0; x < period; x++)
    for (let y = 0; y < period; y++)
      for (let z = 0; z < period; z++)
        pts[x + ',' + y + ',' + z] = [rand(), rand(), rand()];
  return (px, py, pz) => {
    // px..pz in cell units
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    const cz = Math.floor(pz);
    let dMin = 9;
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (let oz = -1; oz <= 1; oz++) {
          const wx = (((cx + ox) % period) + period) % period;
          const wy = (((cy + oy) % period) + period) % period;
          const wz = (((cz + oz) % period) + period) % period;
          const f = pts[wx + ',' + wy + ',' + wz];
          const dx = cx + ox + f[0] - px;
          const dy = cy + oy + f[1] - py;
          const dz = cz + oz + f[2] - pz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < dMin) dMin = d;
        }
    return Math.max(0, 1 - Math.sqrt(dMin));
  };
}

const remap = (v, a, b, c, d) =>
  c + ((Math.min(Math.max(v, a), b) - a) / (b - a)) * (d - c);

export function generateCloudArrays() {
  // Base: R = Perlin-Worley, GBA = Worley fBm octaves (Schneider fig. 4).
  const N = 64;
  const perlin = makePerlin(8, 1717);
  const w4 = makeWorley(4, 41);
  const w8 = makeWorley(8, 42);
  const w16 = makeWorley(16, 43);
  const base = new Uint8Array(N * N * N * 4);
  let k = 0;
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const w = z / N;
        let p = 0;
        let amp = 1;
        let freq = 8;
        for (let o = 0; o < 4; o++) {
          p += perlin(u * freq, v * freq, w * freq) * amp;
          amp *= 0.5;
          freq *= 2;
        }
        p = p * 0.5 + 0.5;
        const c4 = w4(u * 4, v * 4, w * 4);
        const c8 = w8(u * 8, v * 8, w * 8);
        const c16 = w16(u * 16, v * 16, w * 16);
        const wf = c4 * 0.625 + c8 * 0.25 + c16 * 0.125;
        // Perlin-Worley: dilate Perlin by the Worley fBm.
        const pw = remap(p, -(1 - wf), 1, 0, 1);
        base[k++] = pw * 255;
        base[k++] = c4 * 255;
        base[k++] = c8 * 255;
        base[k++] = c16 * 255;
      }

  // Detail: RGB Worley octaves for edge erosion.
  const M = 32;
  const d2 = makeWorley(2, 51);
  const d4 = makeWorley(4, 52);
  const d8 = makeWorley(8, 53);
  const det = new Uint8Array(M * M * M * 4);
  k = 0;
  for (let z = 0; z < M; z++)
    for (let y = 0; y < M; y++)
      for (let x = 0; x < M; x++) {
        const u = x / M;
        const v = y / M;
        const w = z / M;
        det[k++] = d2(u * 2, v * 2, w * 2) * 255;
        det[k++] = d4(u * 4, v * 4, w * 4) * 255;
        det[k++] = d8(u * 8, v * 8, w * 8) * 255;
        det[k++] = 255;
      }

  return {base, N, det, M};
}
