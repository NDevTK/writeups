# Findings register — the Horizon review sessions

This file makes the research content of the review passes legible in one
place. Everything below is **executable**: each claim names the reference
gate that recomputes it from primary sources, so the register never drifts
from the code. Run the whole corpus with:

```
cd themes/horizon/harness && bash validate.sh
```

At the time of writing the gate holds **133 CPU reference files printing
993 landmark lines, plus 7 GPU-vs-reference probes** — every landmark
either a printed number from a primary read in full, an internal identity,
a cross-module closure, or a recorded observation reproduced. The narrative
history lives in `WEBGPU-PLAN.md` (one dated entry per pass); this register
is the curated index of what all of that established.

Conventions used below: _printed_ means a number typeset in the primary
source; _landed_ means the repo's independent machinery reproduced it;
each item ends with the gate that holds it.

---

## 1. Candidate novel findings

Results the machinery produced that the primary sources do **not** print.
These are the strongest candidates for genuinely new content; each is
stated with its evidence and its gate.

**F1 — Van der Werf's two duct-release laws are not equivalent.**
Van der Werf et al. 2003 (Appl. Opt. 42, 379) state that letting a duct's
temperature jump dT decay with distance, or letting its width parameter
`a` grow, are "nearly equivalent" ways to release trapped rays. For
forward rays from an eye under the duct they are not: widening `a` at
fixed dT grows the well's **action capacity** (depth falls, width grows
faster), so adiabatic invariance holds every trapped ray until the duct
dies as a whole — an all-at-once collapse into a narrow deep band —
while shrinking dT at fixed `a` shrinks the capacity monotonically and
releases rays progressively, producing the continuous transformation
curve their Fig. 3B actually shows. The repo ships the dT release; the
distinction was found because the a-release could not reproduce de
Veer's two days. Gate: `nz-reference.mjs` (the two-day landmark);
argument documented in `nz.js`.

**F2 — Symmetric-layer doubling hides its mirror-symmetry bug at m = 0.**
In vector (Stokes) doubling for a symmetric layer, upward-incident
operators must be D-conjugated (R↑ = DRD, T↑ = DTD, D = diag(1,1,−1)).
At the m = 0 Fourier mode the conjugated elements vanish in the azimuth
average, so **any scalar-looking check passes with the conjugation
missing** while U and the oblique modes sit wrong at the 5e-3 level.
Found by the IPRT case A1 benchmark comparison itself; a warning for
vector RT implementations that validate only azimuth-averaged fields.
Gate: `rayleighpol-reference.mjs` (benchmark landmark, worst |dI|,|dQ|
1.8e-6 after the fix).

**F3 — The meridian noise floor of `sqrt(1 − cos²i)` rotations.**
Computing the phase-matrix rotation sines as √(1−ci²) has a √ε ≈ 1e-8
noise floor exactly at the meridian plane (ci → ±1), which a Fourier
trapezoid smears into every azimuth mode at ~5e-9 — an error that looks
like physics until its C₃ = C₄ delta signature is noticed. The
spherical-triangle **law of sines** (sin i₁ = sinθ sinΔφ / sinΘ) carries
the sign automatically and removes the floor exactly; the band-limit
landmark then holds at 5.8e-15. A numerical-methods note for vector RT
codes. Gate: `rayleighpol-reference.mjs` ("Rayleigh has nothing above
m = 2").

**F4 — A naked-eye eclipse timing measures the circumsolar aureole.**
Quaglia et al. 2021 report the full corona visible ≥ 35–40 s before
second contact from the 2017 umbral edge. That onset time, pushed
through van de Hulst's outer-corona brightness and the limb-darkening
residual of the exposed photosphere, **demands** a circumsolar sky
33–79× the mean at 0.8° from the sun. The repo's aerosol aureole
(OPAC/Chin diffraction spike) independently draws 21–82× over clean-day
dust columns. The bands overlap: an observation never intended as
photometry constrains the circumsolar enhancement. Gate:
`kcorona-reference.mjs` (THE CORONALITY LOOP; window 77 s around 15.4 s
of totality).

**F5 — The 443 km record photograph sits at its atmosphere's limit.**
Marching the archived Nîmes 2016-07-16 00Z radiosonde column, the
farthest-visible distance for the recorded Pic de Finestrelles →
Pic Gaspard sight line lands at 442 km against the photographed 443 km —
the record shot was taken essentially **at** the visibility limit its own
atmosphere allowed. Gate: `hindcast-reference.mjs` (THE EDGE landmark).

**F6 — Lehn & Legal's printed tangency survives a razor-thin discriminant.**
For their Bathurst geometry the sea-tangency of the −14.2′ ray depends on
a discriminant of 1.7057e-5 vs 1.7037e-5 — parts-per-thousand changes in
the refraction constant flip tangent to no-tangent. The repo's Ciddor
kappa chain, built with no knowledge of their ray tracer, grazes to
0.2 m at 32.0 km against their printed 32.4 km. Gate:
`looming-reference.mjs` (standard-air anchors).

**F7 — The wet-darkening model changes sign near black (wet coal glints).**
Lekner & Dorf's ladder, assembled exactly as printed, brightens surfaces
darker than dry albedo ≈ 0.03: the water film's ~2% entry reflection
outshines a near-black substrate. The paper does not print the
crossover; it emerged when an "always darker" assertion failed
correctly. Gate: `wetground-reference.mjs` (gloss-floor landmark).

**F8 — The duct-edge wall, quantified.**
Under the 1597 duct parameters a band of target heights at 60 km carries
two images with opposite parity, and the upper image compresses 8 m of
terrain into 0.1 arcsec — a 486× vertical flattening at the duct edge.
This is the mechanism that turns coasts into walls in superior-mirage
photographs and squeezed de Veer's sun, here as a measured number of the
fold structure. Gate: `looming-reference.mjs` (THE SECOND IMAGE).

**F9 — What ignoring polarization costs this specific sky.**
Scalar radiative transfer at the drawn dome's own molecular column errs
the transmitted sky by up to −2.7 / −4.8 / −8.1 % per RGB channel, every
worst case at low sun near the zenith toward azimuth 180° — the
90°-scattering geometry of Mishchenko, Lacis & Travis's mechanism. The
literature gives generic Rayleigh bounds; these are the numbers for the
shipped Hillaire column, and the bias is documented beside the constants
it affects (`atmosphere-tsl.js`). Gate: `rayleighpol-reference.mjs`
(THE DOME NUMBER).

**F10 — Two solar illuminance chains close at 0.962.**
The theme's illuminance constant E0_LUX = 128.1 klx descends from the
astronomical magnitude bridge (SUN_VMAG); integrating the ASTM G173-03
reference spectrum against the photopic curve gives 133.1 klx. Two
constants with unrelated pedigrees agree to 3.8%, and the ratio is
carried, not hidden. Gate: `closure-reference.mjs`.

**F11 — "Inconspicuous" Baily's beads, made literal.**
In the final ten seconds before second contact 2017, the exposed
photosphere is one 0.13–0.21″ bead attended by 0.01–0.09″ glints that
flicker in and out — the paper's word "inconspicuous" corresponds to a
measurable sub-0.05″ prominence class, and the last bead's fade is
continuous to zero. Gate: `beads-reference.mjs` (bead-sequence
landmark).

---

## 2. Hindcasts — recorded reality reproduced

Each row is a documented historical observation reproduced by the repo's
machinery from measured or printed inputs, with the residual stated.

| Observation                                                                                            | Record                     | Landing                                                                                                                                                                  | Gate                      |
| ------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 24 Jan 1597, Novaya Zemlya (de Veer): "a glimpse of the sun" at −5°26′                                 | partial disc               | transformation-curve floor −5.40° falls **inside** the disc: upper limb ducted, centre not                                                                               | `nz-reference.mjs`        |
| 27 Jan 1597 (de Veer): sun "in its full roundness" at −4°41′                                           | full disc                  | whole 32′ disc connects through the same duct                                                                                                                            | `nz-reference.mjs`        |
| 1925, Ångström's pyranometer pairs: sand 0.182→0.091, black mold 0.141→0.084                           | wet albedo                 | model from the shipped Fresnel lands 0.115 / 0.092 (the paper's own Fig. 3 scatter)                                                                                      | `wetground-reference.mjs` |
| 1951, Liljequist's −4°18′ depression                                                                   | reachable                  | inside the same 1597-duct curve                                                                                                                                          | `nz-reference.mjs`        |
| 3–4 Jun 1994, Resolute Bay (Lehn & Legal): 351 m peak at 105 km looms into a theodolite-measured image | −12.1′..−9.8′, 37 m, 2.33× | invisible at dT 0; looms from dT ≈ 2 °C; at dT\* = 3.9 spans −12.5′..−9.8′, 41 m, 1.96× (residual = unprinted inversion shape, stated)                                   | `looming-reference.mjs`   |
| 16 Jul 2016, Finestrelles→Gaspard 443 km photograph                                                    | farthest land photo        | archived 00Z Nîmes column puts the limit at 442 km; bare-earth −517 m; the fan returns the photograph at −1.54°                                                          | `hindcast-reference.mjs`  |
| 21 Aug 2017, umbral-edge flash spectrum (Quaglia et al.): video extinction 9–17 s                      | duration discriminates S☉  | Auwers 959.63″ → 32.3 s (their model prints 32.6; four codes 32.6–36.1) — excluded; measured 959.95″ → 15.4 s — inside; 960.00″ contacts at T0−6.2/+6.65 vs printed ∓6.6 | `beads-reference.mjs`     |
| same, contact position angles                                                                          | C2/C3 valleys ~171/186°    | independent LDEM_16 limb finds the same two valleys at 171.4/185.4°                                                                                                      | `beads-reference.mjs`     |
| same, coronality: full corona ≥35–40 s before C2, ~50–60 s in all                                      | corona vs sky              | predicted window 77 s (39 s lead, 23 s tail) around 15.4 s totality via the drawn aureole                                                                                | `kcorona-reference.mjs`   |
| 8 Apr 2024 Dallas, 12 Aug 2026 Galicia eclipse circumstances                                           | almanac record             | obscuration/contact brackets held (certified pins, unchanged under the measured eclipse radius)                                                                          | `eclipses-reference.mjs`  |

---

## 3. Cross-closures — independent chains, one number

Places where two machineries that share nothing land on the same value.
These are the register's strongest correctness evidence, because neither
side was fitted to the other.

- **g/Rd vs. van der Werf's printed hydrostatic exponent**: the repo's
  gas constants give 3.4177e-2 K/m to 0.6 parts in 10⁴. (`nz-reference`)
- **E0_LUX vs. ASTM G173**: magnitude-bridge illuminance vs. spectrum
  integral, ratio 0.962 — and the AM1.5 direct beam lands within 2.9% of
  the standard's own airmass-1.5 transmittance. (`closure-reference`)
- **van de Hulst 1950 vs. Skylab 1977**: the eclipse-photometry model
  corona meets the coronagraph's streamer-free B(K+F) at every printed
  radius, equator and pole, worst 21% — inside the instrument's stated
  accuracy, 23 years apart. (`kcorona-reference`)
- **The corona in full moons**: model totals 0.33–0.59 of the theme's
  own E_FULL_RATIO, the maximum inside Dyson & Woolley's photoelectric
  record as van de Hulst quotes it. (`kcorona-reference`)
- **fresnelRsRp → Stern's R̄ → Lekner & Dorf's p**: integrating the
  shipped Fresnel split lands both printed return probabilities (0.4375
  exact; 0.475) — the sea-polarization machinery sets the wet-ground
  darkening. (`wetground-reference`)
- **The coronality loop**: recorded onset time ⇒ implied aureole 33–79×;
  drawn OPAC-diffraction aureole 21–82×. (`kcorona-reference`)
- **Van der Werf Eq. (1) vs. the shipped sunset**: printed disc
  flattening 0.830 at the standard lapse; `sunRefraction` gives 0.827
  with no shared machinery. (`nz-reference`)
- **IPOL vs. PSTAR** (at vendor time): the two intercomparison models
  agree in I, Q to 4e-7; the engine then lands on the vendored rows at
  1.8e-6 — the intercomparison's own cross-model level.
  (`rayleighpol-reference`)
- **Quaglia Table 2 closes on itself**: the lunar semidiameter
  polynomial _is_ the printed datum radius at the printed distance to
  0.5 mas. (`beads-reference`)
- **Baily-march durations vs. the four-code spread**: an independent
  limb dataset lands 32.3 s against 32.6–36.1 s from four eclipse codes
  at the same radius. (`beads-reference`)

---

## 4. The verified corpus

- **133 reference files, 993 landmark lines, 7 GPU probes** (live gate
  count at the time of writing; `validate.sh` prints the current totals).
- Every module header carries its provenance: the primary (with the
  access route when non-obvious), what was vendored verbatim, and what
  is stated approximation. The vendored-data files
  (`*-data.js`) each document dataset, version, frame, and derivation.
- Primaries are **read in full** before their numbers are vendored
  (standing rule). Recent examples with non-trivial access routes:
  Lekner & Dorf 1988 via Fermat's Library's complete annotated
  rendering; van de Hulst 1950 via the open ADS scan (brightness
  sections; the remainder sits behind a retired login CGI — stated);
  Mishchenko et al. 1994 via the NASA GISS reprint server; Lehn's
  papers from his UManitoba archive; IPRT tables from the open LMU
  pages; LOLA LDEM_16 from PDS Geosciences; ASTM G173 via pvlib's
  vendored CSV (NREL refuses the proxy).
- GPU probes assert texel values **at** the CPU reference values
  (bit-exact hashes for glints; band/column/corona/bow probes) — the
  render is checked against ground truth, never against itself.

## 5. Stated limits and open residuals

Honesty ledger — what the corpus does _not_ establish, and what stands
between it and the next tier.

- **The scalar dome bias is bounded, not corrected**: up to ~8% (blue,
  low sun, azimuth 180°). The benchmarked vector engine is the named
  correction path. (`atmosphere-tsl.js` header)
- **Bathurst magnification** lands 1.96× vs the printed 2.33× — the
  paper's inversion profile is a figure, not a formula; the repo uses
  the NZ Fermi form. The span and depth land; the shape residual is
  stated.
- **LDEM_16 limb resolution** (1.9 km/px) is coarser than the paper's
  SLDEM-256; bead counts use a prominence floor for that reason. An
  LDEM_32 southern-band upgrade is the stated path if bead-level timing
  is ever gated.
- **The aureole band** in the coronality loop spans dust optical depths
  0.02–0.08 (clean-day class); the loop closes as bands, not points.
- **Wet world stage 1**: albedo darkening only. Wet-road specular
  sheen, puddles, and wet snow are stated next stages; the 0.35 m³/m³
  saturation scale is a stated display normalization.
- **Walled primaries** (chains recorded in `WEBGPU-PLAN.md`, not acted
  on): the Danjon lunar-eclipse luminosity series (Keen's table behind
  Science 1983), dewbow amplitude, elve photometry.
- **Coverage caveat**: reference gates hold landmarks — they prove the
  law is implemented as printed at the gated points, not that every
  drawn pixel is right. The GPU probes close part of that gap; the
  sweep-pin visual matrix is a separate, weaker instrument.

## 6. Method — reference-first validation

The practice the corpus demonstrates, stated so it can be reused:

1. **The law lives once**: each physical law is a pure-function module
   the client imports; the reference imports the same module. No
   mirrored constants.
2. **Landmark classes**: printed-pin (a number typeset in the primary),
   internal identity (the form's own mathematics), limit recovery
   (parameters that must collapse to a known case), cross-closure
   (independent chains, §3), and hindcast (recorded reality, §2).
3. **Run-then-pin**: bands are set from measured runs and then
   asserted — never invented, never silently widened. A failed
   assertion is investigated before it is loosened; twice in this
   corpus the _assertion_ was wrong because the physics was more
   interesting (F7's sign change; the plural "inconspicuous beads").
4. **Full-read rule**: primaries are read completely before their
   numbers are used; partial-serving archives are quoted with their
   served scope stated.
5. **Vendored slices carry provenance**: dataset id, version, frame,
   fetch route, and derivation algorithm live in the data file header,
   so a future session can re-derive the slice.
6. **Convention pins are asserted constant**: benchmark-frame constants
   (a normalization, a sign) are pinned once, documented as conventions,
   and the gate asserts they are global — a convention that varies
   per-row would be a fit, and fails.
7. **The instrument** (`harness/observatory.html`, passes 114–118): the
   gated modules run on the LIVE feeds and draw their diagnostics — the
   current ascent's fold count and horizon refraction, the measured
   wind's whitecap fraction, six cities on the wet-albedo ladder, the
   day's aerosol-diluted polarization map, the active-region count's
   corona, the printed Perseid calendar against the live Global Meteor
   Network count, the measured auroral hemispheric power, and the 91st
   pass's radiative closure re-run on the current measured irradiance
   at every load, and the Schmidt–Appleman criterion scanned over the
   whole ascent — formation zone, ice-supersaturated sheets, and their
   overlap — with live ADS-B aircraft marked on the temperature curve — the per-level lee-wave ladder with its resonant ridge-width windows, and the Schureman frame predicting the unseen tide gauge with the surge read off the residual.
   One real day (2026-08-09, San Diego: a +8.7 °C marine
   inversion that folds the fan at eye 450 m and not at 15 m; 1842
   measured Perseids 2.7 days before peak; the drawn dome landing 97.4 %
   of the measured 890 W/m²) is frozen as `observatory-fixture.js`, and
   `observatory-reference.mjs` pins the compositions in the gate — so
   the instrument itself is validated, and a claim like "today the sun
   sets 5.2′ late and 30 % squashed" is a reproducible artifact, not a
   screenshot.

---

_Register written at pass 113; the plan file carries the dated history
and the per-pass detail. When a pass adds or changes findings-level
content, extend this register in the same commit._
