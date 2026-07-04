import {Color, Vector2} from 'three/webgpu';
import {
  Fn,
  cameraPosition,
  dot,
  exp,
  min,
  mix,
  normalize,
  output,
  positionWorld,
  texture,
  uniform,
  vec2,
  vec4
} from 'three/tsl';

/**
 * Aerial perspective + Koschmieder fog as a shared TSL output hook
 * (WebGPU project, phase 2).
 *
 * The Hillaire aerial LUT carries inscattered radiance (rgb) and mean
 * transmittance (a) over (relative azimuth x distance); every world
 * material's lit output is multiplied by the transmittance and the
 * inscatter is added in the dome's exposure, then Koschmieder fog
 * (extinction from the MEASURED visibility) applies on top - the same
 * order as the WebGL fog hook this replaces.
 *
 * ONE instance of this node graph is shared by every material (the
 * uniforms object too), so the physics has exactly one definition.
 */

export function createAerialFog(aerialLutTex) {
  const aerialTexNode = texture(aerialLutTex);
  const u = {
    uAerialMaxU: uniform(450),
    uSunAzV: uniform(new Vector2(1, 0)),
    uAerialExp: uniform(0),
    uFogColor: uniform(new Color(0.86, 0.93, 0.97)),
    uFogDensity: uniform(0.004),
    uAerialOn: uniform(0)
  };

  const outputNode = Fn(() => {
    const dir = positionWorld.sub(cameraPosition);
    const d = dir.length();
    const aerH = normalize(dir.xz.add(vec2(1e-6, 1e-6)));
    const aerAz = dot(aerH, u.uSunAzV).clamp(-1, 1).acos().div(3.14159265);
    const aer = aerialTexNode.sample(
      vec2(aerAz, min(d.div(u.uAerialMaxU), 1.0))
    );
    const lit = output.rgb
      .mul(mix(1.0, aer.a, u.uAerialOn))
      .add(aer.rgb.mul(u.uAerialExp).mul(u.uAerialOn));
    const kf = exp(d.mul(u.uFogDensity).pow(2).negate()).oneMinus();
    return vec4(mix(lit, u.uFogColor, kf), output.a);
  })();

  return {
    uniforms: u,
    aerialTexNode,
    outputNode,
    // Attach to any node material: replaces its final output.
    apply(mat) {
      mat.outputNode = outputNode;
      return mat;
    }
  };
}
