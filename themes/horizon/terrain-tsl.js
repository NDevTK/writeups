import {Color, MeshStandardNodeMaterial, Vector2, Vector3} from 'three/webgpu';
import {
  Fn,
  attribute,
  cameraPosition,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  fract,
  max,
  mix,
  normalize,
  positionWorld,
  pow,
  sin,
  smoothstep,
  texture,
  transformNormalToView,
  uniform,
  vec2,
  vec3
} from 'three/tsl';

/**
 * TSL port of Horizon's terrain material (WebGPU project, phase 2).
 *
 * This is the SAME physics as the GLSL onBeforeCompile version in
 * Horizon.html, expressed as node code for WebGPURenderer:
 *  - per-pixel grass/rock/snow/sea from the DEM normal map and the
 *    inverted asinh elevation, noise-jittered borders
 *  - Pierson-Moskowitz sea normals from the real wind (Hs = 0.21 U^2/g,
 *    Tp = 0.7305 U, deep-water dispersion) with Blinn glitter and
 *    Schlick fresnel; Monahan & O'Muircheartaigh whitecap fraction
 *  - per-pixel GGX roughness (vegetation ~0.95, rock ~0.88, snow 0.45)
 *  - the aerial-perspective hook: inscatter + mean transmittance from
 *    the Hillaire aerial LUT, then Koschmieder fog on the MEASURED
 *    visibility
 *
 * The node graph deduplicates shared subexpressions (demNormal, snow,
 * slope) across colorNode / roughnessNode / normalNode, so splitting
 * the single GLSL terrainColor() into separate nodes loses nothing.
 */

export function createTerrainNodeMaterial(normalMapTex, aerial) {
  // TextureNodes are part of the graph; rebakes swap via node.value.
  const normalTexNode = texture(normalMapTex);
  const u = {
    uWorldSize: uniform(280),
    uCenterElev: uniform(300),
    uSnowy: uniform(0),
    uSnowLine: uniform(2300),
    uTime: uniform(0),
    uWindMs: uniform(3),
    uWindVec: uniform(new Vector2(1, 0)),
    uSunDirW: uniform(new Vector3(0, 1, 0)),
    uSunCol: uniform(new Color(0, 0, 0))
  };

  const thash = Fn(([p]) =>
    fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))
  );

  const tnoise = Fn(([p]) => {
    const i = p.floor();
    const f = p.fract();
    const s = f.mul(f).mul(float(3).sub(f.mul(2)));
    return mix(
      mix(thash(i), thash(i.add(vec2(1, 0))), s.x),
      mix(thash(i.add(vec2(0, 1))), thash(i.add(vec2(1, 1))), s.x),
      s.y
    );
  });

  const tfbm = Fn(([p]) =>
    tnoise(p)
      .mul(0.6)
      .add(tnoise(p.mul(2.7).add(19)).mul(0.28))
      .add(tnoise(p.mul(6.1).add(47)).mul(0.12))
  );

  // The baked DEM normal map: every lit pixel gets the real hillside
  // orientation (the mesh only carries the silhouette).
  const demNormal = Fn(([xz]) => {
    const t = normalTexNode.sample(xz.div(u.uWorldSize).add(0.5));
    return normalize(t.xyz.mul(2).sub(1));
  });

  // Pierson-Moskowitz fully developed sea, identical constants to the
  // GLSL: two wave trains at their true deep-water dispersion speeds,
  // steepness pi*Hs/lambda tilting the normal.
  const seaNormal = Fn(([wp]) => {
    const U = max(u.uWindMs, 0.8);
    const Hs = U.mul(U).mul(0.21 / 9.81);
    const Tp = U.mul(0.7305);
    const Lp = max(Tp.mul(Tp).mul(1.5614), 4.0);
    const pm = wp.xz.mul(57.14);
    const d1 = normalize(u.uWindVec);
    const d2 = normalize(
      u.uWindVec.add(vec2(u.uWindVec.y.negate(), u.uWindVec.x).mul(0.6))
    );
    const k1 = Lp.reciprocal().mul(6.28318);
    const k2 = Lp.mul(0.45).reciprocal().mul(6.28318);
    const s1 = Hs.div(Lp).mul(3.14159);
    const a1 = cos(
      dot(pm, d1)
        .mul(k1)
        .sub(u.uTime.mul(k1.mul(9.81).sqrt()))
    );
    const a2 = cos(
      dot(pm, d2)
        .mul(k2)
        .sub(u.uTime.mul(k2.mul(9.81).sqrt()))
        .add(1.7)
    );
    const chop = tnoise(pm.mul(0.05).add(d1.mul(u.uTime.mul(0.15))))
      .sub(0.5)
      .mul(s1)
      .mul(1.2);
    const grad = d1
      .mul(s1.mul(a1))
      .add(d2.mul(s1.mul(0.6).mul(a2)))
      .add(vec2(chop, chop));
    return normalize(vec3(grad.x.negate(), 1.0, grad.y.negate()));
  });

  // Sun glitter: Blinn lobe on the wave normals with Schlick fresnel;
  // calm water gives a tight bright path, wind spreads it.
  const seaSpec = Fn(([wp]) => {
    const n = seaNormal(wp);
    const V = normalize(cameraPosition.sub(wp));
    const H = normalize(V.add(u.uSunDirW));
    const gloss = mix(700.0, 60.0, clamp(u.uWindMs.div(15.0), 0.0, 1.0));
    const f = pow(clamp(float(1).sub(dot(V, n)), 0.0, 1.0), 5.0)
      .mul(0.95)
      .add(0.05);
    return u.uSunCol
      .mul(pow(max(dot(n, H), 0.0), gloss))
      .mul(f)
      .mul(6.0);
  });

  const wet = attribute('wet', 'float');

  // Shared pieces of the material decision (deduplicated by the graph).
  const nW = demNormal(positionWorld.xz);
  const slope = float(1).sub(nW.y);
  // e = centerElev + 500*sinh(y/16), sinh via exponentials.
  const yy = positionWorld.y.div(16);
  const eM = u.uCenterElev.add(exp(yy).sub(exp(yy.negate())).mul(250));
  const n1 = tfbm(positionWorld.xz.mul(0.11));
  const n2 = tfbm(positionWorld.xz.mul(0.6));
  const rockF = smoothstep(0.2, 0.45, slope.add(n2.sub(0.5).mul(0.08)));
  const snowLine = u.uSnowLine.add(n1.sub(0.5).mul(500));
  const snow = max(
    smoothstep(snowLine, snowLine.add(700), eM).mul(
      smoothstep(0.35, 0.6, slope).oneMinus()
    ),
    u.uSnowy.mul(smoothstep(0.25, 0.45, slope).oneMinus()).mul(0.85)
  );

  const colorNode = Fn(() => {
    const n3 = tfbm(positionWorld.xz.mul(3.3));
    const grass = mix(vec3(0.09, 0.21, 0.05), vec3(0.19, 0.33, 0.08), n1).mul(
      n3.mul(0.3).add(0.85)
    );
    const rock = mix(vec3(0.28, 0.25, 0.21), vec3(0.4, 0.37, 0.32), n2).mul(
      n3.mul(0.36).add(0.82)
    );
    const col1 = mix(grass, rock, rockF);
    const col2 = mix(col1, rock, smoothstep(1600.0, 2400.0, eM).mul(0.92));
    const col3 = mix(col2, vec3(0.87, 0.9, 0.93), snow);
    // Sea: Monahan & O'Muircheartaigh (1980) whitecap fraction
    // W = 3.84e-6 * U^3.41.
    const U = max(u.uWindMs, 0.8);
    const W = clamp(pow(U, 3.41).mul(3.84e-6), 0.0, 0.6);
    const pmc = positionWorld.xz.mul(57.14 * 0.11);
    const capN = tnoise(
      pmc.add(normalize(u.uWindVec).mul(u.uTime.mul(0.25))).add(31.0)
    );
    const sea0 = mix(vec3(0.05, 0.13, 0.2), vec3(0.07, 0.17, 0.25), n1);
    const sea = mix(
      sea0,
      vec3(0.75, 0.8, 0.84),
      smoothstep(W.oneMinus(), W.oneMinus().add(0.04), capN)
    );
    return mix(col3, sea, wet);
  })();

  // Per-pixel GGX roughness: vegetation ~0.95, rock ~0.88, snow 0.45
  // (its real forward sheen); wet sea pixels keep roughness 1 so the
  // Blinn seaSpec stays the one glitter model.
  const roughnessNode = mix(mix(mix(0.95, 0.88, rockF), 0.45, snow), 1.0, wet);

  // World normal: waves on wet pixels, the DEM normal map elsewhere.
  const normalNode = transformNormalToView(
    mix(nW, seaNormal(positionWorld), wet)
  );

  // Glitter adds to the outgoing light exactly like the GLSL
  // `outgoingLight += vWet * seaSpec(vWp)`.
  const emissiveNode = seaSpec(positionWorld).mul(wet);

  const mat = new MeshStandardNodeMaterial({metalness: 0});
  mat.colorNode = colorNode;
  mat.roughnessNode = roughnessNode;
  mat.normalNode = normalNode;
  mat.emissiveNode = emissiveNode;
  // Aerial perspective + Koschmieder: the ONE shared hook from
  // aerial-tsl.js, same graph every world material uses.
  aerial.apply(mat);
  return {material: mat, uniforms: u, normalTexNode};
}
