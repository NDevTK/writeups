import {AgXToneMapping, Color, SRGBColorSpace, Vector2} from 'three/webgpu';
import {
  Fn,
  atan,
  cameraPosition,
  color,
  dot,
  exp,
  min,
  mix,
  normalize,
  output,
  positionView,
  positionWorld,
  texture,
  toneMapping,
  uniform,
  vec2,
  vec4,
  workingToColorSpace
} from 'three/tsl';

/**
 * Aerial perspective + Koschmieder fog as a shared TSL output hook
 * (WebGPU project, phase 2).
 *
 * The Hillaire aerial LUT carries inscattered radiance (rgb) and mean
 * transmittance (a) over (relative azimuth x distance); every world
 * material's lit output is multiplied by the transmittance and the
 * inscatter is added in the dome's exposure, then Koschmieder fog
 * (extinction from the MEASURED visibility) applies on top.
 *
 * ORDER MATTERS and mirrors the classic chunk order exactly: three's
 * built-in materials run tonemapping_fragment + colorspace_fragment
 * BEFORE fog_fragment, and the WebGL hook replaced fog_fragment - so
 * AgX and the sRGB encode come FIRST, then aerial and fog operate on
 * the ENCODED value (as shipped and validated). The renderer runs
 * NoToneMapping + LinearSRGB output (a global identity transform);
 * raw-output materials (the atmosphere dome, sky objects, the cloud
 * composite) simply set no output hook, exactly like the classic
 * ShaderMaterials that carried no chunks.
 *
 * Fog uses the VIEW depth (-mvPosition.z), like three's fog_vertex;
 * the aerial LUT uses the euclidean distance, like the WebGL hook.
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
    uAerialOn: uniform(0),
    uToneExp: uniform(0.55)
  };

  // tonemapping_fragment + colorspace_fragment
  const encoded = Fn(() =>
    workingToColorSpace(
      toneMapping(AgXToneMapping, u.uToneExp, output.rgb),
      SRGBColorSpace
    )
  );

  const fogged = (rgb) => {
    const kf = exp(
      positionView.z.negate().mul(u.uFogDensity).pow(2).negate()
    ).oneMinus();
    return mix(rgb, u.uFogColor, kf);
  };

  // AgX -> sRGB -> aerial -> Koschmieder fog (world materials)
  const outputNode = Fn(() => {
    const dir = positionWorld.sub(cameraPosition);
    const d = dir.length();
    const aerH = normalize(dir.xz.add(vec2(1e-6, 1e-6)));
    // SIGNED relative azimuth over the full circle (the LUT carries
    // the cloud volumetric shadow, which is not azimuthally
    // symmetric): atan(cross, dot) is the counterclockwise angle
    // from the sun azimuth - the same convention the LUT fill
    // rotates by (roundtrip gated in atmo-reference.mjs). u = 0.5
    // faces the sun; the clamp seam sits at the anti-sun azimuth.
    const aerAz = atan(
      u.uSunAzV.x.mul(aerH.y).sub(u.uSunAzV.y.mul(aerH.x)),
      dot(aerH, u.uSunAzV)
    )
      .div(2.0 * 3.14159265)
      .add(0.5);
    const aer = aerialTexNode.sample(
      vec2(aerAz, min(d.div(u.uAerialMaxU), 1.0))
    );
    const lit = encoded()
      .mul(mix(1.0, aer.a, u.uAerialOn))
      .add(aer.rgb.mul(u.uAerialExp).mul(u.uAerialOn));
    return vec4(fogged(lit), output.a);
  })();

  // AgX -> sRGB only (materials with fog:false, e.g. the ISS dot)
  const outputNodeTone = Fn(() => vec4(encoded(), output.a))();

  return {
    uniforms: u,
    aerialTexNode,
    outputNode,
    // Attach to any node material: replaces its final output.
    apply(mat) {
      mat.outputNode = outputNode;
      return mat;
    },
    applyTone(mat) {
      mat.outputNode = outputNodeTone;
      return mat;
    },
    // AgX -> sRGB -> fog on a COLOUR node (near-field materials the
    // WebGL hook skipped: precipitation, flakes, constellation lines
    // - they kept three's native fog, which also ran after the output
    // transform). This variant plugs into colorNode instead of
    // outputNode: the sprite/line pipelines do not compose opacityNode
    // into `output`, so an output hook would drop their alpha.
    encodeFog(rgb) {
      return fogged(
        workingToColorSpace(
          toneMapping(AgXToneMapping, u.uToneExp, rgb),
          SRGBColorSpace
        )
      );
    },
    // Same, for materials whose colour is a plain constant.
    applyFogColor(mat, css) {
      mat.colorNode = this.encodeFog(color(css));
      return mat;
    }
  };
}
