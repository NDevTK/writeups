# Findings register — the Horizon review sessions

This file makes the research content of the review passes legible in one
place. Everything below is **executable**: each claim names the reference
gate that recomputes it from primary sources, so the register never drifts
from the code. Run the whole corpus with:

```
cd themes/horizon/harness && bash validate.sh
```

At the time of writing the gate holds **148 CPU reference files printing
1183 landmark lines, plus 8 GPU-vs-reference probes** — every landmark
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
- **A 25-day gauge fit reads the 18.6-year lunar node**: the Schureman
  frame fitted to one month of the San Diego gauge, divided by NOAA's
  own long-record constants, gives M2 ×0.970 (inside Schureman's
  printed f_M2 band, below 1) and O1 ×1.20 (at the printed f_O1
  maximum) — opposite signs, exactly the nodal phase of 2026, which
  suppresses semidiurnals while inflating diurnals; the sub-Rayleigh
  lumps (P1→K1, NU2→N2, K2→S2) sit inside their printed envelopes.
  (`observatory-reference`)
- **Young's sub-duct geometry from the Snell invariant alone**: walking
  n(h)·(R+h) up Young's own Santa Ana model (a 15 K inversion at
  200–250 m) puts the optical duct's floor 69.9 m below the inversion
  base against his printed "70 m below the base … a little above
  130 m" — his number came from his refraction integrator, this one
  from a Ciddor-refractivity scan that shares nothing with it — with
  his chromatic ordering emerging unasked (floors 128.5/130.1/131.1 m
  in blue/green/red: the duct is deeper in blue, his sub-duct flash
  colours). The same transfer-curve machinery then reproduces his
  printed duration anchors: the ISA textbook flash at 0.95 s against
  his "a second or so", and the sub-duct flash at 6.8× the textbook
  second against his "about three times the duration of a normal
  flash" — stated at a moment with "still a way to go", so ≥3× is the
  printed floor — with the sub-duct minima landing "very nearly at the
  astronomical horizon" (−1.1′) exactly as his transfer plots show.
  (`refraction-reference` block 5, `observatory-reference` FLASH)
- **A real arctic day retrieved from its own image**: the mirage watch
  (pass 129) swept eight literature-anchored stations and found the
  2026-08-10 00Z Resolute ascent — Lehn & Legal 1994's own looming
  site, already hindcast by `looming-reference` — folding a
  terrestrial transfer characteristic from a 346-m eye at 130 km. The
  Morrish-strategy fit, given only that image and the eye-level
  temperature, reads a +2.0 K inversion at 107–168 m; the balloon it
  never saw above eye level carries +3.2 K over the same span, and
  the profiles agree to 0.43 K RMS all the way to the ground. Frozen
  as `lehn-fixture.js`, pinned in `lehn-reference` — the retrieval's
  first closure on a measured atmosphere. The same sweep measured the
  method's edges honestly: three stations folded WITHOUT closing (the
  1983 superior-mode iteration at 130-km ranges runs far out of its
  stated short/medium domain, retrieving +28…+43 K against +2-K
  columns), and one no-inversion column was matched by a degenerate
  ΔT≈0 fit — both now guarded (fits under 0.5 K decline; retrievals
  carry an explicit closes verdict). (`lehn-reference` THE REAL DAY)
- **The cascade closes the 130-km days** (pass 133): the 129th's
  measured edge — three stations folding without closing — split
  under diagnosis into three mechanisms: a ridge eye sitting AT its
  marine cap's base (Oakland, 309 m rel vs eye 300 — the 1983 zones'
  domain simply ends there), folds that RIDE THE SURFACE under a
  beach superadiabat (Quillayute, span floor 0 m — inferior-family
  physics, not a superior mirage), and a ladder that bet everything
  on the first detectable S (one graze ray's ground strike, moved
  metres by a humidity difference, flipped which fold the panel
  committed to). The answer is Lehn & Morrish 1986's own strategy
  carried to the pivot-above-eye geometry: a trapezoid family
  re-anchored at the eye, confined to the fold-probed span read off
  the fan, refereed by TWO closures (span RMS < 2.5 K and the
  claimed layer strength vs the balloon over the claimed interval),
  inside a cascade where every folding distance gets its attempt and
  the first CLOSING retrieval wins. Same evening, one sweep:
  Vandenberg closes (+9.9 K at 387–467 m vs balloon +7.1 K, 1.08 K
  RMS) and Oakland closes at 180 km — the cascade walking past its
  refused 130-km attempt — with the retrieved base 14 m off the
  balloon's 309 m. The archive holds three days in three geometries;
  the w-vs-ΔT compression under fixed integrated bending is measured
  in the family round trip (thickness 177-for-220 m against strength
  8.5-for-9 K) and it is exactly what the layer closure indicts on
  curved-cap days. (`lehn-reference` family round trip + THE
  ARCHIVE; `observatory-reference` superior fallback)
- **The inferior mirage joins the instrument, and San Diego closes**
  (pass 134): Fleagle 1950 printed the mirror of Lehn's inverse
  problem 33 years earlier — the apparent-minus-true height of a
  target reads the MEAN LAPSE of the skimmed layer in closed form,
  h grows as x², and objects appear lower only past the
  autoconvective rate g/R (his "34 C per km" — a third independent
  printing of the constant the repo carries as Lehn's gβ 0.03413
  and the NZ gate's 0.03418; his 0.114 humidity coefficient is
  1 − A₂ε/A₁ exactly, and his Eq. 11 meets both of the repo's
  independent integrators within 0.24 mm at Johnson & Roberts' own
  362/724-m baselines). Baum 1951 licenses the target: the
  stability excess falls as depth⁻⁴, so films of thousands of K/km
  are printed-normal near the ground. The geometry had to be
  probed, not assumed: an eye INSIDE a film cannot fold (the film
  launches every exiting ray at √(2h″Δz) regardless of entry —
  erect and compressed, never inverted), so the instrument's
  posture is an eye ABOVE the film, and the balloon-resolvable
  film class folds at 20–45 km. The cascade's film fallback reads
  any ground-hugging fold no warm family closed, under a 0.5-K
  claim floor (a film smaller than the referee's own tolerance is
  unfalsifiable and declines — measured on Utqiagvik). Same
  evening: SAN DIEGO CLOSES FOR THE FIRST TIME IN THE PROGRAM —
  the mesa's 5-pm film, −3.9 K over 134–192 m vs the balloon's
  −3.6 K at 2.19 K RMS from the 450-m ridge eye at 90 km — and
  Quillayute's surface-graze refusal becomes a reading (−1.6 K
  over 57–117 m vs −1.4 K). The archive holds five days across
  all three mirage families. The synthetic that gated it also
  found and fixed two closure holes (the zones' RMS integral now
  samples its endpoint — a top node carrying +14 K hid between
  5-m grid samples; thin probed spans no longer count) and two
  archive-contract lessons (pins are written from the packed rows
  the fixture stores; the eye list is data, stored verbatim,
  never a runner-side convention). (`fleagle-reference`;
  `lehn-reference` THE ARCHIVE; `observatory-reference` inferior
  film)
- **The sea horizon gets its own measured film** (pass 135): the
  retrieval's films were an inland balloon's, but the drawn horizon's
  mirage lives over the water — and NOAA CO-OPS piers measure the
  air–sea contrast that governs it (La Jolla / Scripps Pier: air and
  water temperature, wind, pressure, each at a stated sensor height;
  keyless, CORS-open, the tide pass's own service). Monin–Obukhov
  similarity in the printed Kansas forms (Businger et al. 1971, read
  in full; Paulson 1970's closed-form integrals held as identities
  against numerical integration of Businger's φ to 6·10⁻⁹; COARE
  3.0's sea roughness, gustiness and its printed pairing of the
  Kansas forms with κ = 0.40 — a mismatch of κ's would put the drag
  coefficient 24 % under COARE's own Fig. 5) turns that contrast
  into the lowest hundred metres over the sea. The composed column
  is three tagged segments — the pier's profile, a modelled
  well-mixed marine layer up to the ascent's capping-inversion base,
  the balloon above — and the retrieval now REFUSES any closure
  whose span overlaps the modelled band: agreement with air nobody
  measured is not a closure. Two consequences on the page: the
  far-horizon fan applies at beach eye heights for the first time
  (it had declined whenever the balloon's 134-m floor sat above the
  eye), and the sun sets through the pier's film. The cross-closure
  that gates it: a calm pier 5 K warmer than its air, composed under
  a synthetic ascent, read back from the composed column's own fan
  by the Fleagle instrument at 30 km — −152 K/km over 12 m against
  the similarity film's −169, 0.152 K RMS inside the measured band
  — Fleagle reads Businger; and the mirror case, warm air over cold
  water, appears as a surface duct with a ducted flash class, the
  looming side of one measured contrast. On the frozen day the sea
  column's own retrieval does not close (its first fold sits at
  130 km and reads back 19 K RMS) while the inland ascent alone
  closes at 90 km on its launch site's superadiabatic film; the page
  prints both verdicts, the non-closure named as such.
  (`surfacelayer-reference`; `observatory-reference` DAY PINS marine
  and lehnSea)
- **The pier's skin and humidity** (pass 136): the pier thermometer
  reads the bulk water 3.4 m down, but the air touches an interface a
  few tenths cooler — the sensible, latent and net-infrared losses all
  leave through a millimetre where only molecular conduction carries
  heat. Fairall et al. 2026 (JGR Oceans, open, read in full) prints
  the COARE 3.6 skin model — the interfacial budget, Saunders' δ =
  6ν/u\*w, k ΔT/Q₀ = 0.6 δᵤ — with its Table A2, Figs. 2 and 4 and
  cruise statistics; the authors' published code supplies the
  free-convection limit on λ and the seawater constants the equations
  do not print. `coolskin.js` reproduces that code to 5·10⁻⁴ K in five
  regimes and lands the printed anchors (0.28 K at 2 m/s, 0.19 K at
  10 m/s, PISTON's 0.169 K). No pyrgeometer looks at the sea off the
  pier, so the sky's longwave is modelled — Yang et al. 2022 (ACP,
  open, read in full): Brunt's emissivity refitted on 12,368
  pyrgeometer hours, an all-sky cloud/humidity correction, the printed
  spread of other networks' coefficients the fit is held inside, and
  the RMSEs the page now quotes beside every skin. The screen is the
  pier's own measured air; the shore lends only its dewpoint and
  cover, and coastal-plain stations win over the nearer inland mesa
  whose night screen ran 5 K under the pier's air. The similarity
  profile and the skin budget are solved as one fixed point and the
  sea column stands on the interface: tonight's pier (air 19.4 °C,
  water 20.5 °C, calm) carries a 0.35-K skin under a 343 W/m² sky,
  the contrast −1.1 K becoming −0.7 K at the interface.
  (`coolskin-reference`; `observatory-reference` DAY PINS marine:
  skin, sky, loss, provenance)
- **The ship-flux archive gates the pier** (pass 137): NOAA PSL's
  hourly ship-flux database (31,914 measured hours on 44 research
  cruises, 1991–2021, served by the COAPS ERDDAP; the archive Fairall
  et al. 2026 describe) is sampled systematically into a fixture and
  put to the 136th's two modelled quantities. Fed the archive's own
  friction velocity, fluxes and measured longwave, the skin port
  returns PSL's COARE skin over 507 night hours to 6·10⁻⁵ K RMS — the
  five-case oracle became five hundred measured hours — and the
  archive's skin falls with wind from 0.30 K to 0.11 K. On 323
  daytime hours whose measured solar certified a clear sky, the
  land-fitted Brunt emissivity reads the sea's pyrgeometers with bias
  −2 W/m² and RMSE 10.6, better than its own land RMSE, the
  vapour-pressure-binned emissivity within 0.008 of the printed curve;
  on 616 nights of unlogged cover the clear formula under-reads by
  27 W/m² — the cloud term the pier's METAR supplies. The page now
  quotes the ocean-validated clear-sky uncertainty. (`shipflux-freeze`,
  `shipflux-fixture`; `coolskin-reference` ship-flux landmarks)
- **The pier's wind sets the sea's glitter and foam** (pass 138): the
  drawn sea's wind — Monahan's whitecaps, the Cox–Munk slopes behind
  the glitter, the wind sea — had been a land model's 10-m wind. The
  nearest measured wind over water now rules: the pier's anemometer,
  brought to the 10-m neutral footing those laws were fitted on
  through the similarity profile the pier already solves (COARE's
  U10N = u*/κ · ln(10/z₀)). The gate holds u* = √C_D10N · U10N
  exactly and the ordering of the actual 10-m wind against U10N by
  stability — and records that in unstable, gusty air U10N can exceed
  the measured wind aloft (3.3 m/s from a measured 3.0 with water 3 K
  warmer) while sitting far under it in stable air. (`surfacelayer-
reference`; `observatory-reference` DAY PINS marine: wind)
- **The pier's warm layer from the day's own history** (pass 139): by
  sunset on a calm, sunny day the sea's surface can be tenths warmer
  than the pier's thermometer 3.4 m down. The COARE 3.6 warm-layer
  scheme (Fairall 1996's simplified Price–Weller–Pinkel, ported from
  the authors' published code) integrates the pier's six-minute day —
  stress and fluxes from the similarity profile, the net infrared from
  the skin, the satellite-derived hourly solar — and the sub-skin
  surface stands that much above the sensor before the skin cools it.
  The gate holds the PWP closure as an identity (the layer's bulk
  Richardson number is exactly 0.65 at every uncapped step: the two
  printed coefficients are one number), the near-√t growth, the day's
  shape, and reproduces PSL's own warm-layer column over 22 frozen
  cruise-runs (1,175 hours) with bias 0.002 K and RMSE 0.08 K — every
  run that warmed past 0.3 K landing its peak. A cut starting mid-day
  misses a day's warming: runs must begin before dawn (measured:
  RMSE 0.17 before the trim, 0.08 after). (`warmlayer-reference`;
  `observatory-reference` DAY PINS marine: warm layer)
- **The bulk fluxes meet the archive** (pass 140): the marine surface
  layer had run the printed Kansas forms with COARE 3.0's roughness —
  gated as identities, never against a measured flux. Measured on the
  same NOAA PSL ship hours that gate the skin, that pairing returns
  the latent flux 32 W/m² high (RMSE 38; sensible +2.3, RMSE 4.8 W/m²)
  — Businger's 0.74 Prandtl factor on the scalar profile, where the
  COARE code runs 1.0 with its own scalar roughness. The module now
  ports COARE 3.6's loop as the authors' published code runs it (read
  in full: ψ_u26/ψ_t26/ψ_u40 with their written constants, Buck's
  saturation, the wind-dependent Charnock, the 0.2-m/s gustiness
  floor, the first-pass rule for ζ > 50, the latitude gravity) and
  returns PSL's own u* to 6·10⁻⁵ m/s, t* to 3·10⁻⁵ K, the sensible
  flux to 0.004 W/m² and the latent flux to 1.1 W/m² RMS over 275
  frozen hours — the archive prints humidity to 0.1 g/kg, which
  bounds the latent closure. Two things the code carries that the
  papers do not print: its scalar form's rounded constants leave
  ψ_t(0) = −0.0045, and both profile forms change slope across
  neutral (−3.75 vs −5.20 for velocity, −7.5 vs −5.0 for scalars).
  And a measured consequence for the drawn horizon: on COARE's forms
  the calm warm-water film lives in the lowest metre (4.7 K there
  against Kansas's 3.9, but −51 K/km over 0.5–10 m against −169), and
  the tower eye's fan over 10–60 km finds no fold the detector will
  take where the Kansas forms folded at 30 km — the S the
  archive-gated forms draw there spans 0.4 m against the Kansas
  column's 6.3 m, under the detector's 6-m prominence, and the fan
  step (100 to 10 m) changes nothing: the inferior mirage from a
  pier-height eye is a profile-form question the archive decides, and
  on COARE's forms it is a tenth the size. (`surfacelayer-reference`:
  the code's forms, THE ARCHIVE; `observatory-reference` DAY PINS
  marine: fluxes)
- **The measured stress** (pass 141): PSL's archive holds directly
  measured fluxes beside its bulk ones — the eddy-covariance stress
  on 18,642 good-flag hours, the sonic sensible and gas-analyser
  latent fluxes on 12,724, and the ship's laser-altimeter waves on
  3,629. On 1,530 frozen hours the bulk the pier reports sits at
  0.93–0.99 of the measured stress from 3 m/s up (RMSE 0.03–0.15
  N/m²) and at 0.70 below 3 m/s — the covariance's noise floor, kept
  with its sign (keeping only positive stresses inflated the calm
  mean by half); the latent flux at 1.01 / 0.96 / 0.92 on the three
  well-filled classes (RMSE 23–41 W/m²), the sensible at 0.73–1.02
  (RMSE 8–24). Fairall 2003's printed "within 5% for 0–10 m/s and
  10% for 10–20" holds on the hourly archive inside the covariance's
  own 10% flow-distortion caveat. The table is pinned into the module
  and the marine line states the bulk's measured scatter at the
  pier's wind class. The code's wave-state Charnock, tried with the
  archive's measured wave height and period on 762 hours, returns
  the stress at 1.09 against the wind-speed form's 0.95 — over-
  predicting young seas by half (cp/u\* < 20, n 46) and buying nothing
  on old swell — so the buoy's swell-dominated period stays out of
  the pier's roughness, measured and stated. (`surfacelayer-
reference`: THE MEASURED STRESS, THE WAVE BRANCH TRIED;
  `observatory-reference` DAY PINS marine: residual class)
- **The chain closes on itself** (pass 142): the warm layer now feeds
  its own fluxes as the authors' code runs it — each step integrates
  with the previous step's bulk on the warm-corrected surface under
  the cool skin (the synthetic calm day damps from 2.47 to 1.96 K at
  the surface; the archive closure is untouched, it integrates PSL's
  own fluxes); the water sensor's depth comes from the station's
  published datums under the gauge's measured tide (La Jolla: 4.26 m
  below MSL, 4.3–5.4 m below the surface across the tide — the 139th
  read 3.4 m off the MLLW listing); the calm film's fold on COARE's
  forms subtends 0.05′ at 30 km against the Kansas fold's 0.72′ —
  under the eye's own minute of arc, so the tower eye sees no
  inferior mirage from a +5 K calm sea on the archive-gated forms;
  and the daemon warms its home area on start (a cold sounding walk
  measured failing once at the 25-s budget, then answering in 16 s),
  so a deploy no longer costs the first visitor the ascent.
  (`warmlayer-reference` COMPOSITION; `surfacelayer-reference`
  landmark 8; `server-reference` warm-up; `observatory-reference`
  DAY PINS marine: sensor depth)
- **The satellite's warmest sea meets the pier's chain** (pass 143):
  the cloud field is now measured from GOES-West Band 13 through NASA
  GIBS's colour-mapped tiles, read back to brightness temperature
  (the published colormap vendored verbatim; the two grey ramps that
  share levels resolved per connected region by the colour border
  that encloses it), and tested for cloud by the GOES-R cloud mask's
  own ETROP (0.10 over the ocean) against a clear-sky reference the
  theme builds without a tile: the pier's COARE skin seen at the
  satellite's slant through the sea column with the MT_CKD continuum
  as LBLRTM ships it, off a sea whose emissivity is Fresnel on Hale &
  Querry's index. On the frozen morning the 95th-percentile sea pixel
  within 100 km reads 19.15 °C against the chain's 19.66 °C — −0.51 K
  under a 74% clear sea, inside the test's own 5.5-K margin — and the
  pre-dawn field (26% of the sea under low cloud with 855-m opaque
  tops on ACHA's inversion rule, 19% within 30 km) sits under KSAN's
  CLR. The decks now carve their cover from the measured texels
  where the sea was measured and keep the ceilometer's and the
  model's cover where it was not. (`goesir-reference`: THE WARM
  PIXELS, THE CEILOMETER; DAY PINS)

---

## 4. The verified corpus

- **148 reference files, 1183 landmark lines, 8 GPU probes** (live gate
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
  render is checked against ground truth, never against itself. The
  eighth (pass 154) pins a lifecycle, not a value: a measured field
  arriving after the first frame must read on the GPU exactly as the
  same field present before it.

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
- **The Lehn retrieval covers both printed geometries since pass 128**
  (shore eye/1983 zones for superior mirages; ridge eye/Morrish-1986
  parametric strategy for mock mirages, licensed by Eq. (2) holding at
  traced perigees to 0.32 K), holds real-day closures in three
  geometries since pass 133 (Resolute elevated; Vandenberg and
  Oakland through the superior-mode parametric fallback, §3), and
  the 1983 iteration's graceless ~130-km degradation is now handled
  rather than merely reported: the cascade attempts every folding
  distance and the span-confined fit replaces the zones only when
  its claim survives both closures. Since pass 134 the third
  family closes the surface-graze class (Fleagle's film read from
  its own mirage — Quillayute and San Diego are archive days), and
  the home station's "yet to fold" era is over. Remaining limits:
  the film family reads the MEAN lapse of the lowest balloon rows
  (Fleagle's own design — his instrument reports mean lapse, and
  the balloon cannot resolve the decimetre hot-road films Baum's
  laminar limit allows), so a fitted film can smear a steeper
  shallower reality into a balloon-consistent mean; claims under
  the 0.5-K referee floor decline as unfalsifiable
  (Utqiagvik-class days stay honest non-closures); all families
  are single-layer; the w-vs-ΔT compression under fixed
  integrated bending is a measured identifiability limit (family
  round trips: 177-for-220 m, 58×67-for-28×125 under row
  packing), so fitted layer shapes carry closure bands, not
  metrological precision; the retrieval reaches only as far as
  the fold rays fly (probed span reported with every closure);
  and since pass 135 the drawn SEA horizon rides its own measured
  film (the pier's air–sea contrast through similarity theory)
  while the marine layer between the pier's hundred metres and the
  capping inversion remains MODELLED (θ and q constant, the
  inversion's height a proxy from the inland ascent) — tagged, and
  barred from every closure. Further stated limits of the marine
  layer: since pass 140 the profile forms are COARE 3.6's as its
  published code runs them (gated on PSL's measured hours; the
  Kansas forms kept as the printed anchor), with no ice branch and
  no wave-age Charnock (the pier measures no phase speed); the
  archive's humidity is printed to 0.1 g/kg, which bounds the
  latent-flux closure near 1 W/m²; the Fleagle cross-closure's fold
  is a Kansas-form fold — on COARE's forms the calm film's mirage at
  the tower eye is a half-metre S, under the detector's 6-m
  prominence, and whether it shows on the drawn horizon is not
  settled; the bulk's
  stated scatter (pass 141) is the archive's — at low winds as much
  the covariance measurement's as the algorithm's, its calm and gale
  classes thin, its wave hours one altimeter's on mostly old swell;
  since pass 136 the water temperature is the
  INTERFACE (COARE 3.6's cool skin on the pier's bulk sensor, no
  rain term; since pass 139 the day's warm layer lifts the sub-skin
  surface above the sensor by what the scheme holds above it, under
  hourly satellite-derived solar — since pass 142 with the code's
  own feedback of the warming into the fluxes, a step's fluxes
  lagging one six-minute reading, and the sensor at its datum-listed
  depth under the measured tide, 3.4 m standing in only where a
  station publishes no datums) under a sky longwave that is
  MODELLED
  from the pier's air and the shore's dewpoint and cover (a
  screen-level emissivity fit made over land, held over the clear
  ocean by 323 measured ship hours to −2 ± 11 W/m² since pass 137;
  the cover term still on the land fit's printed coefficients), and
  the pier's humidity is the nearest coastal
  METAR's dewpoint, the ascent's surface row standing in only when
  no shore screen is fresh.
- **The measured cloud field is a lower bound** (pass 143): one
  infrared window, colour-mapped and resampled by the server, read at
  the band centre alone (no spectral response; line absorption, ozone
  and CO₂ neglected in the clean window) against a clear sky built
  from ONE sea-temperature point (the pier's skin, else the CO-OPS
  sensor, else a buoy within 50 km — the offshore gradient shows up
  as the warm-pixel closure and is reported, not corrected) off a
  flat-Fresnel sea. Over the sea the test misses cloud filling under
  about a third of a 2-km pixel and thin cirrus under the threshold
  (so the field lifts the cirrus scalar and never clears it); over
  land the reference is free air at the pixel's elevation for a skin
  the theme does not measure, so the mask finds mid and high cloud
  only and a land "clear" carves nothing away; no local radiative
  centre, no snow or desert classes. Heights are ACHA's opaque
  lookups with its inversion rule, whose known bias reads thin mid
  cloud low — the theme's own split rule hands such pixels to the mid
  deck on a fresh ceilometer's word (no low layer under a mid or high
  one), a 60-km-old point report speaking for the whole window. The
  sea column that references the field is the observatory day's, so
  the fixture and the observatory refreeze together while GIBS still
  serves the day.

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
7. **The research view** (Horizon.html's data panel, passes 114–126):
   the gated modules run on the LIVE feeds and report their diagnostics
   inside the theme's own page — the
   current ascent's fold count and horizon refraction, the measured
   wind's whitecap fraction, six cities on the wet-albedo ladder, the
   day's aerosol-diluted polarization map, the active-region count's
   corona, the printed Perseid calendar against the live Global Meteor
   Network count, the measured auroral hemispheric power, and the 91st
   pass's radiative closure re-run on the current measured irradiance
   at every load, and the Schmidt–Appleman criterion scanned over the
   whole ascent — formation zone, ice-supersaturated sheets, and their
   overlap, the per-level lee-wave ladder with its resonant ridge-width windows, the Schureman frame predicting the unseen tide gauge with the surge read off the residual and the lunar node in the fitted-vs-published ratios, and the visual satellite fleet propagated across the coming night with every culmination graded by the measured magnitude catalogue. Since pass 124 these diagnoses render as the RESEARCH section of the theme's own data panel (✦ / ?debug=1 / D), computed from the page's live state — the drawn world, diagnosed in place; a standalone harness page was tried and retired. Since pass 125 the loop closes back into the pixels: the full-ascent contrail scan gates the drawn trails per aircraft altitude (one computation, two consumers), and the mirage diagnosis runs at the camera's own eye height.
   One real day (2026-08-09, San Diego: a +8.7 °C marine
   inversion that folds the fan at eye 450 m and not at 15 m; 1842
   measured Perseids 2.7 days before peak; the drawn dome landing 97.4 %
   of the measured 890 W/m²) is frozen as `observatory-fixture.js`, and
   `observatory-reference.mjs` pins the compositions in the gate — so
   the instrument itself is validated, and a claim like "today the sun
   sets 5.2′ late and 30 % squashed" is a reproducible artifact, not a
   screenshot. The landmarks split (pass 123) into day-invariant code
   (identities, printed envelopes, form checks — they survive any
   refreeze) and generated day pins (`observatory-pins.js`, written by
   `observatory-freeze.mjs` beside the fixture, guarded by a stamp
   match): re-anchoring the instrument to a new real day costs one
   command plus reading the diff, which is where run-then-pin's
   deliberateness now lives — the affordable frozen-day archive.
   Since pass 126 the panel also issues a falsifiable nightly forecast:
   the ascent's wavelength-split transfer curves are classified through
   Young's taxonomy (textbook / inferior-mirage / mock-mirage /
   ducted-mock-mirage / in-duct / sub-duct) and timed by his principle
   that the flash runs from the red curve's minimum to the green's at
   the engine's own sunset rate — the frozen day pins "450 m eye:
   mock-mirage, 1.65 s, ×4.0 the rim, at −21.9′ apparent" as a
   checkable prediction of that evening's sunset. Pass 127 adds the
   inverse problem (Lehn 1983, JOSA 73, 1622, read in full): the
   theme's own Ciddor ray fan photographs the measured column at a
   known object plane and `lehn.js` retrieves the temperature profile
   from the image alone — his parabolic-arc layers, zone I direct from
   the tangent closed form, the inverted image iterated on his
   vertex-locus equation — gated end to end on a Whitefish-class day
   (fold at his own 20 km; profile back at 0.87 K RMS against the
   balloon that never entered the retrieval above eye level) while the
   frozen sub-critical day is pinned DECLINING: the instrument refuses
   to invent an inversion the fan cannot fold, and that refusal is
   itself the day's checkable statement. Pass 128 adds the elevated
   eye by the corpus's own methods (Lehn & Morrish 1986's parametric
   strategy, read in full): the 450-m ridge reads a marine cap below
   it — an SD-like synthetic closes at 0.183 K RMS through the
   panel's own path — and the frozen day's decline is now measured
   from both eyes. Pass 131 closes the loop in time: every ascent's
   forecast at the fixed 450-m eye is stored under its local evening
   (the 12Z morning forecast paired with its 00Z evening verifier by
   `eveningKey`), and scored evenings render held/revised verdicts —
   the prediction sheet keeps its own record. Passes 129/132/133 give
   the retrieval its field campaign: `mirage-watch.mjs` sweeps eight
   literature-anchored stations each session and `--freeze` appends
   every closing day to `lehn-fixture.js` with bands written at freeze
   time, `lehn-reference`'s archive runner holds each frozen day to
   its own pins, and the retrieval cascade (every folding distance
   attempted, first CLOSING fold wins, two closures refereeing any
   fitted claim) is what turned the watch's measured edges into
   archive days. Pass 134 completes the mirage-family triptych
   (Fleagle 1950's surface film joins Lehn's zones and the
   Morrish-strategy families), and the archive's growth taught
   two contract rules now in force: freeze pins are computed from
   the PACKED rows the fixture stores, and the eye list rides in
   the fixture as data — the runner reproduces the watch's
   geometry verbatim rather than assuming it. Pass 135 adds the
   fourth kind of instrument to the column: a measured boundary
   condition (the pier's air–sea contrast) turned into profile by
   printed similarity theory, composed with the balloon under a
   contract that tags what is modelled and forbids closures across
   it — the first time the drawn horizon's lowest metres come from
   a measurement taken over the water it draws. Pass 143 adds the
   first per-pixel measurement of the sky itself (GOES-West's
   window channel through the marine chain's own clear-sky
   reference), and pass 145 closes the loop the other way: the
   drawn world answers a click. A ray from the camera names what it
   meets — the sky's bodies and the IAU-named stars by angle, the
   feeds' ships and aircraft, the terrain, the sea, the far ring,
   and the satellite texel where the ray crosses a deck, with the
   field pixel's temperature, emissivity and class behind it — and
   every research line carries a "look" link that turns the camera
   to what it diagnoses (the cloudiest sea sector, the open sea by
   the DEM walk, the setting sun, the nearest cruise aircraft); the
   satellite field itself can be drawn on the sea as the mosaic the
   decks carve from. The geometry is a gated module
   (`pick-reference`): the compass convention round-trips against
   the camera's own vector, the texel index inverts the deck field's
   mapping, and the sea walk is held on synthetic coasts. Pass 146
   gives the satellite field its reach: GOES-West, GOES-East and
   Himawari share one GIBS colormap (Worldview's own layer
   configuration says so), the operators' printed sub-longitudes and
   band centres fill a table, and the pick is the satellite at the
   smallest view zenith within the 70° the operational L2 files
   print as their own qualified range — every other longitude
   answers unmeasured by name (`goesir-reference` THE REACH). Pass
   147 puts a sea under every pixel: JPL's MUR foundation analysis,
   through the daemon's own `/sst` box, gives each sea pixel its own
   clear-sky reference (the analysis's offshore gradient on the
   pier's measured skin, the composition stated) and stands in as
   the sea temperature where no pier or buoy is within reach; the
   frozen day pins the result honestly — the closure did not
   tighten (−1.01 K per pixel against −0.51 K for the point
   reference), so the analysis's offshore warmth is recorded as
   absent from the satellite's warmest pixels that morning rather
   than assumed (`goesir-reference` THE FOUNDATION SST, the
   foundation-SST pins; `server-reference` foundation SST box). Pass
   148 puts the operator's own answer beside the theme's: NOAA's
   clear-sky mask and cloud-top height files are read in node by a
   pure HDF5 reader held to what h5py reads from the same bytes (a
   real GOES-18 file vendored verbatim and two files h5py wrote at
   its earliest and latest library bounds; a layout the reader
   cannot read is named, never guessed), navigated by the PUG's own
   fixed-grid equations held to the PUG's printed example in both
   directions, and cut to the theme's window by the daemon; the page
   states the agreement between its ETROP field and NOAA's mask at
   the same sea pixels and minute (the daemon serves the mask of the
   mosaic's own stamp, because GIBS's tiles trail the bucket by tens
   of minutes to hours) and prints NOAA's class under a clicked texel
   — the decks keep the theme's field, so the comparison is a
   closure, never a substitution. Measured at 20:20Z on 2026-09-05:
   88% of 4083 sea pixels agree at the mosaic's own minute (both
   cloud 2321, both clear 1288, theme only 330, NOAA only 144) — the
   first pixel-for-pixel score of the re-implemented ETROP field
   against the operator's product. Its first run also earned its
   keep another way: a field reading 100% cloud against NOAA's 62% exposed GIBS's opaque
   white placeholder tiles (200 OK, one colour over the whole tile)
   that the grey rule had read as −18.9 °C, so a one-colour tile is
   now no measurement and the mosaic walk follows the domain's own
   stamps across its gaps (`goesir-reference` THE PLACEHOLDER TILE,
   THE DOMAIN'S OWN STAMPS). Pass 149 puts NOAA's brightness
   temperature itself under the theme's palette decoder — 9678
   pixels at the mosaic's minute read a median +0.34 K (clear +0.36,
   cloud +0.30), the decode's bias a third of a kelvin under the
   map's own bin width, the tails (rms 6.9 K) the Web-Mercator
   resampling at cloud edges — and reports DCOMP's daytime optical
   depth and effective radius per pixel beside the theme's VIIRS
   radius, after measuring the product's flag word against the mask
   of the same minute (three of its bits contradict their names in
   v02r03 and are named, not read). Pass 150 lets that radius ring
   the corona while it is fresh — the theme's standing rule that the
   newer measurement outranks the older one, applied to the droplet
   size: DCOMP's water r_eff over the theme's own sea, minutes old,
   sizes the corona, the overcast veil and the lee-wave deck, and
   VIIRS's day-old radius stands again when DCOMP retrieves nothing
   (night, or a clear window); one function, `dropletSource`, is the
   only place the drawing asks. Pass 151 reads the files in place:
   the buckets answer HTTP Range (and are CORS-open with it,
   measured) and NOAA chunks every field in full-width row strips,
   so the pure reader gained a sparse mode — the first 256 kB, then
   only the strips a window touches, the chunk index pruned by its
   own keys, every parse replayed over the bytes fetched so far —
   and a ±100 km window of the 32 MB full-disk sea-surface
   temperature file costs about 1 MB in six round trips, the 4 MB
   mask about 0.9 MB in four, every window pixel equal to the
   whole-file decode's (zero mismatches on seven products; the
   daemon's six products cold in 1.2 s where five took 6 s and 51 MB,
   the worker thread and memory guard retired with the whole files).
   That affords the hour's skin SST as the sixth product, set beside
   the day-old MUR analysis at the same pixels with the warm-layer
   caveat stated (ABI is skin, MUR foundation), never blended. Pass
   152 corrects a premise and measures the daylight: the hourly
   irradiance series the page had called "the geostationary
   constellations' actual observed GHI" since pass 91 is, over the
   Americas, a model — Open-Meteo's own documentation says GOES is
   not yet integrated, its seamless satellite endpoint answers NaN
   for the home, and the default series carries hours not yet come;
   the headers and the record now say so. NOAA's own downward
   shortwave radiation at the surface (the Enterprise SRB algorithm's
   ATBD, Laszlo, Kim & Liu 2020, read in full: a Fu-Liou lookup-table
   forward path driven by ABI's own cloud and aerosol retrievals with
   the STAR/UMD inversion as fallback, 2 km, every 10 minutes,
   validated from ABI at about 2% accuracy and 17% precision in 50-km
   squares) becomes the seventh product through the range reader,
   and the clearness index is now taken from it at its own moment's
   sun — the point's pixel or the ATBD's spatial mean over the good
   pixels within 5 pixels — while it is fresh, the hourly series
   standing otherwise, the source named on the record; at 21:50Z the
   two read 673 and 672 W/m² for the same hour, the ratio printed
   beside the ATBD's precision. Pass 153 gives the decks their own
   measured drift: NOAA's derived motion winds (the DMW ATBD v4.4,
   Daniels, Bailey & Bresky 2025, read in full — cloud features
   tracked through three images 5 minutes apart by nested tracking
   and clustering, the dominant cluster's median cloud-top pressure
   the height; GOES-17's band-14 vectors within 3.5–3.7 m/s of
   radiosondes at low level, 4.9–5.3 aloft, Table 16) are a point
   list every 15 minutes, read whole in one range as the eighth
   product; the vectors within 150 km are grouped by the ATBD's
   three layers, each layer's vector mean taken over the tightest of
   50/100/150 km holding three vectors, and while the file is under
   45 minutes old the low, mid and high decks drift with that
   motion instead of the surface wind and the balloon's or model's
   700 and 250 hPa levels — the ranking stated (the tracked features
   are the clouds drawn, minutes old), the balloon keeping every
   other use of the level winds; at 22:32Z all three decks rode the
   measured south-westerly (9.2, 14.2 and 21.5 m/s at 834, 479 and
   328 hPa) beside the model's 11.1 at 700 and 30.5 at 250 hPa
   (`goesl2-reference` THE MEASURED MOTION; `server-reference` THE
   VECTORS READ WHOLE, on a real-file cut written by h5py with a
   python/numpy oracle). Pass 154 is a correction of the drawn side:
   the measured satellite field of pass 143 and the radar field
   before it never reached the decks on the WebGPU build — a data
   texture that starts 1×1 and grows to the field's size is only
   COPIED into by the backend after its first creation, so the copy
   fell outside the texture (a validation error the page probes had
   logged every run) and the shader kept the noise cover while the
   JS-side censuses, comparisons and pick readouts reported the field;
   the texture is now disposed and re-created on a size change, and
   the eighth GPU probe sets a field after a first frame and reads it
   through the cloud shadow's tau map to the last bit as a field
   present before the first frame (`tsl-goesfield-probe.html`: west
   half tau 5.99, east 0, max diff 0, zero device errors; the unfixed
   module reads 0 with two errors). Pass 155 makes the NOAA products
   independent of the daemon: the decode block became the pure
   `goesl2-decode.js` shared by the daemon and the page, and
   `goesl2-client.js` reads the CORS-open buckets from the browser by
   HTTP range with the browser's own DecompressionStream, answering
   the daemon's body with the source named — the fallback (about 6 MB
   a refresh) when the daemon is unreachable, as it was from 22:02Z;
   the pass also found the hourly SST file landing 63 minutes after
   its hour (the lookback now spans three) and the harness's request
   bridge dropping the page's Range header (repaired; the client is
   hardened for a range-ignoring path regardless). Pass 156 puts
   NOAA's aerosol optical depth on the aerosol channel: the AOD ATBD
   (v4.2, read in full — a look-up-table retrieval at 550 nm over
   dark land and glint-free water, four quality levels, the F&PS
   requirement by AOD range, and GOES-16's high-quality product
   validated against AERONET at a land bias of 0.04 and precision
   0.12, water 0.01 and 0.04, through a 50 × 50 km collocation box
   whose lowest 20% and highest 50% are screened before averaging)
   becomes the ninth product, its window read in five ranges (0.9 MB
   of an 8.3 MB file), and the page computes the ATBD's own
   estimator over that box; the ranking on the channel is stated —
   a fresh AERONET triplet outranks the satellite, the satellite
   outranks the model and re-scales the channel set to its 550 nm
   value with the spectral shape kept — and the first live read
   (23:42Z, a 69%-cloudy window) is the pass's own finding: six
   high-quality pixels between clouds read 0.10–0.15 while the ±100
   km window's 834 read a median 0.039 and AERONET La Jolla 0.036,
   so the estimator drives the channel only from ten high-quality
   pixels in the box, the thin sample stated otherwise
   (`goesl2-reference` THE MEASURED HAZE; `server-reference` THE
   MEASURED HAZE — the body dressed on the fixture, recomputed from
   the wire, the extras read without a further range;
   `goesl2-client-reference` nine asks over 23 listings). Pass 157
   puts NOAA's land surface temperature under the land horizon: the
   Enterprise LST ATBD (v4, read in full — the split-window
   retrieval with its emissivity pair, the 2.5 K accuracy / 2.3 K
   precision requirement over 213–330 K, the PQI word's bits, and
   the SURFRAD validation of both satellites: GOES-16 at biases of
   −2.63 to +1.80 K and precisions of 1.59–2.26 K over 21,621
   matchups, GOES-17 — the West slot's own craft — −2.41 to +1.78
   and 1.28–2.41 K over 5,713) becomes the tenth product (hourly,
   2 km, day and night; five ranges, 0.63 MB of a 1.4 MB file), and
   a measured LAND surface layer stands beside the pier's marine
   one: the nearest high-quality skin pixel against the screen air
   and the 10-m wind on the footprint's roughness (the WMO CIMO
   Guide's Davenport classes ln-averaged over the painted cover,
   Stull's drag column shown to be the log law's own print; Rigden's
   AmeriFlux kB⁻¹ by cover, the Kanda/Brutsaert bluff-body law over
   built and bare ground — a constant kB⁻¹ over a suburb returned
   975 W/m² where the law returns 90, the pass's own finding)
   through the Kansas profile forms, Fleagle's autoconvective test
   and Hirt's k over the eye's own metres; the far ring's drop takes
   the land k on the spokes whose inner ring is land, and a land ray
   fan re-solves them. The pass also found that the far ring's
   mirage fan had never run in the page since pass 99: the ring
   handed the fan a typed array of launch angles, the fan's row map
   coerced every row to NaN, and the first write threw inside a
   silent catch on every probe with a measured column — so the
   drawn ring now moves with the balloon for the first time (probe:
   7,454 of 22,528 vertices re-solved, all 512 spokes land at the
   inland home), and the fan's band reaches +3° so the mean-k base
   serves only the hidden and the steep (measured: the base and the
   fan part by 55–127 m at 100–194 km for targets 0.2–0.8° up)
   (`landlayer-reference`; `goesl2-reference` THE LAND'S SKIN;
   `server-reference` THE LAND'S SKIN; `far-terrain-reference` the
   per-spoke k and the typed-array march; `observatory-reference`
   THE LAND SURFACE LAYER; `goesl2-client-reference` ten asks over
   26 listings). Pass 158 repairs the deploy: the box at api.ndev.tk
   was found running a build from before pass 151 while main
   carried the 157th — the installer's ship list had never gained
   `goesl2-decode.js` (pass 155), so its own drift guard refused
   every revision since, correctly and silently; the module is
   shipped, the installer writes a VERSION file the daemon reports
   in `/health`, `/probe` and every `/goesl2` body, the updater
   retries a failed gate after a cooldown instead of pinning the box
   to the old build until the next commit, the gate's cost was
   measured for the e2-micro (peak 198 MB, 153 s of CPU here for
   all 145 references), and the page reads from the bucket itself
   any product an older daemon's body lacks outright and says so in
   its record (`goesl2-client-reference` THE OLDER DAEMON'S GAPS;
   `server-reference` THE DEPLOYED REVISION). Pass 159 gives the
   cloud decks a daylight texture measured, not drawn: by day the
   ABI's band 2 (0.64 µm, the one 500-m band, every five minutes
   over CONUS) is read by the page itself from the open bucket (a
   401 × 401 window, 2.6 MB a file, an ask the daemon never serves),
   its reflectance factor turned into reflectance at each pixel's
   own sun by the CMIP ATBD's Eq. 3-3 (the file's own κ = πd²/E_sun
   recomputed to 5 × 10⁻⁹ of the attribute it carries), the scene's
   clear and cloudy references measured under NOAA's mask at the
   same scan angles (the clear median, the cloudy 90th percentile),
   and the 2-km deck field split four ways with each fine texel's
   cover the coarse cover times its position between them — the
   mask decides where cloud is, the visible band shapes it inside,
   and where no reflectance stands the 2-km cover is kept. The sun
   series (USNO's low-precision coordinates) was held to an
   independent Meeus computation at eight points (within 0.005°; the
   NOAA calculator's Spencer series is 0.1–0.4° off both). Measured
   live over Montauk Point's water on GOES-East: the 11:27Z window
   read by the page itself in 5.4 s (3,609 kB in six ranges), the
   references under NOAA's mask at clear ρ 0.091 and cloud ρ 0.670,
   171,986 of 172,400 fine texels under the mask's cloud shaped in
   335 ms, mean fraction 0.60
   (`goesl2-reference` THE DAYLIGHT FIELD; `daylight-reference` the
   words at a pixel and the field composed on synthetic windows on
   the real fixed grid; `goesir-reference` THE DAYLIGHT FIELD splits
   the deck field; `goesl2-client-reference` and `server-reference`
   the page-only eleventh ask). Pass 160 makes the fraction a
   coverage in law: the fine pixels under a cloudy 2-km pixel are two
   populations, the cloud and the clear sub-pixels in its gaps, and
   Otsu's threshold (1979) parts them when his effectiveness measure
   η reaches 0.8 (a normal sample gives 2/π, a uniform one 0.75, two
   normals 4σ apart 0.81 — pinned); above the threshold a fine pixel
   is covered whole, below it the gaps and edges read partial; a
   one-mode population (a solid deck, a veil) takes its own dim tenth
   as the edge, so a stratus sheet stays whole instead of reading as
   0.6 coverage (`goesl2-reference` THE DAYLIGHT FIELD, the coverage
   edge and Otsu's pins; `daylight-reference` repinned). Pass 161
   adds NOAA's cloud top phase (ABI-L2-ACTPC, every five minutes,
   day and night) as the eleventh served product and lets the
   measured top overhead gate the optics: an ice top closes the
   droplet corona, a liquid or supercooled top closes the halo family
   and the cirrus corona, a mixed, clear or undetermined top leaves
   the model's gates standing — the Enterprise Cloud Type and Phase
   ATBD v3 read in full, its categories, quality bits, requirement
   (80% correct over optical depth > 1) and CALIOP validation tables
   (93.05% agreed over 52,043 thick clouds; 87.78% over all 95,249)
   pinned and recomputed (`goesl2-reference` THE CLOUD'S PHASE;
   `server-reference` and `goesl2-client-reference` the twelfth ask;
   `server-reference` THE DAEMON'S BINDINGS, a source-level guard that
   every body builder the daemon calls is bound from the decode block
   — the pass's own first build had missed one and crashed the daemon
   on its first request while every gate stayed green). Pass 162
   adds NOAA's fire / hot spot characterization (ABI-L2-FDCC, every
   five minutes, day and night) as the twelfth served product and
   makes the measured hot spots the scene's fires: each fire pixel is
   navigated to its place with the ATBD's mask class and, where
   characterised, its radiative power, and glows by that heat (1 MW
   faint, 1000 MW full, a saturated pixel full); NASA EONET's
   day-old event points remain only where no pixel burns within
   10 km — the Enterprise Fire ATBD v2.7 read in full, its detection
   thresholds, block-out zones, saturation ceilings, the Dozier
   characterisation and the middle-infrared power law pinned
   (`goesl2-reference` THE FIRE'S HEAT; `wildfire-reference` THE
   MEASURED HOT SPOTS; `server-reference` and `goesl2-client-reference`
   the thirteenth ask). Pass 163 adds NOAA's total precipitable water
   (ABI-L2-TPWC, 10 km, a 5 × 5 field of regard retrieved where a
   fifth of it is clear) as the thirteenth served product and lets the
   measured column set the clear-sky reference's water: the balloon's
   ascent column is scaled, layer by layer, to the satellite's total
   over the sea source (a ratio past 0.25–4 is clamped and stated),
   so the sea's cloud threshold rides the air mass the satellite sees
   rather than the morning's launch — the Enterprise Legacy Soundings
   ATBD v3.1 read in full, its requirement (18% / 20% moisture, 67°
   quantitative zenith), its RAOB, AMSR-E (r 0.96 over 2,822,939
   matches) and ECMWF validation pinned; the gate finds the depression
   NOT monotone in the water and states why (the fixture's 26.4 °C
   surface air over a 20 °C skin: the first doubling warms the
   reference, only an opaque column cools it, and a 15 °C skin is seen
   warm through twice its water) (`goesl2-reference` THE COLUMN'S
   WATER; `goesir-reference` THE COLUMN'S WATER; `server-reference` and
   `goesl2-client-reference` the fourteenth ask); the pass's live probe
   also caught a fault of the 159th's daylight line — with the sun 84°
   from the zenith no lit fine texel took a fraction and the null mean
   fraction threw on every panel render — now worded as "none took a
   fraction". Pass 164 restores the radar and adds the rain: measured
   on the day, RainViewer's public tiles stop at zoom 7 ("Maximum zoom
   level is 7") and the page's zoom-8 tile was a "Zoom Level Not
   Supported" placeholder, and every colour index returns the
   Universal Blue palette, which the grey dBZ rule read as no echo
   (a 24-dBZ blue) or as snow at 95 dBZ (the placeholder's white); the
   palette is now vendored verbatim from RainViewer's own table and
   decoded by colour (163 colours, the floor −10 dBZ, a resampled
   pixel to its nearest colour with the distance stated), the tile's
   scheme told from its pixels, RainViewer's coverage mask
   (`/v2/coverage/0`, black = no radar) bounding the ground the radar
   sees, the statistics areal over that ground with the observer's own
   pixel, and the scene's rain taking that pixel where the radar sees
   it. Where no radar sees it, NOAA's rainfall rate (ABI-L2-RRQPEF,
   full disk every 10 min, 2 km) becomes the fourteenth served
   product and the scene's rain — the Enterprise Rainfall Rate ATBD
   v3 read in full (SCaMPR's 330 classes on microwave rain, the
   discriminant detection, the two-predictor rate with power
   transforms and the distribution-matching lookup, Eq. 35–36's
   evaporation term pinned by hand, the 6 / 9 mm/h requirement at
   10 mm/h, the MRMS and DPR validation with GOES-17 past the
   precision spec) (`radar-reference` THE PALETTE, THE SCHEME AND THE
   MASK, THE GREY WINDOW; `goesl2-reference` THE RAIN; `server-reference`
   and `goesl2-client-reference` the fifteenth ask). Pass 165 draws
   that rain where it falls: the raining pixels within 100 km become
   curtains hung from the cloud base at their true bearings and
   distances, each as opaque as the rain itself — Atlas's (1953)
   optical extinction from the Marshall–Palmer spectrum, σ = 0.25
   R^0.63 per km for Bergeron rain (orographic an order of magnitude
   denser, a 1.25–2.6), over the pixel's own 2-km path: 1 mm/h hides
   39% of what stands behind it, 10 mm/h 88%, drizzle at 0.2 mm/h
   17%, with Koschmieder's 3/σ naming the visibility inside the rain
   (12 km at 1 mm/h, 2.8 km at 10) (`rainshafts-reference` THE
   CURTAIN'S OPACITY, THE SHAFTS). Pass 166 closes the daylight
   field's inverted case, found by the home's scheduled A/B under a
   high deck: NOAA's mask left 1,056 "clear" pixels at cloud edges
   whose median reflectance (0.765) stood above the cloud's dim tenth
   (0.480), so a fraction between them would have run backwards; a
   clear reference at or above the coverage edge is now no reference
   at all — the cut withdraws whole, the 2-km cover stands, and the
   research line says why in the mask's own numbers
   (`goesl2-reference` THE DAYLIGHT FIELD's inverted pair;
   `daylight-reference` THE INVERTED PAIR). Pass 167 gives the decks'
   measured cover to the satellite's rain where no radar sees: the
   radar's 64 × 64 field over the 16-km world box said nothing under
   RainViewer's black (the sea, the gaps between radars); now each
   raining satellite pixel paints the texels its 2-km footprint
   touches with the same rate-to-cover rule (0.95 × smoothstep of the
   rate from 0.05 to 1 mm/h, the stronger keeping a texel, a zero
   border ring), and one merge feeds the decks the radar's texel
   wherever the mask says the radar sees and the satellite's
   elsewhere, the records counting the texels each gave
   (`rainshafts-reference` THE RAIN'S COVER). Pass 168 puts the
   satellite's lightning where the ground network is thin: GOES's
   Geostationary Lightning Mapper stares at the disk through a
   777.4-nm filter and writes every optical flash to a 20-s file every
   20 s (GLM-L2-LCFA; the Lightning Cluster-Filter Algorithm ATBD v3.0
   read in full — events of 2-ms frames, groups, flashes within 330 ms
   and 16.5 km, the amplitude-weighted centroid, 8–14 km pixels, ≥ 70%
   detection, 5-km location, 20-s latency; intracloud and
   cloud-to-ground alike, indistinguishable optically). The daemon's
   `/glm` holds a minute of files per craft and answers the flashes
   within 200 km with bearings, distances and a display strength from
   the logarithm of each flash's optical energy on the day's measured
   population (2,876 flashes a minute on GOES-19's disk, energies
   3.3e-15 to 4.4e-12 J, median 4.2e-14); the page asks every 20 s,
   reads one 20-s file a minute itself from the open bucket when the
   daemon cannot answer, and replays each flash the ground network did
   not report (a strike within 20 km and 30 s claims it) at its true
   bearing in the file's own order and spacing. A real 20-s file is
   vendored and the gated reader and parser are held to h5py's
   independent read of the same bytes — 1,026 flashes, every field of
   the first, the quality census, the energy population, the 24 within
   200 km of Tampa with the nearest (97.75 km at 28.34°) and the
   brightest (1.72e-12 J at 160.9 km) to a millionth of a kilometre
   (`glm-reference` THE FILE'S FLASHES, THE FLASH'S STRENGTH, THE
   FLASHES, THE FILE, READ; `goesl2-client-reference` THE FLASHES READ
   BY THE PAGE; `server-reference` THE FLASHES' ROUTE)
   (`goesl2-client-reference`: the browser's inflate, the range
   reader, the client over a fake S3 of the vendored fixtures, the
   range-ignoring path; `goesl2-reference` THE DAYLIGHT, MEASURED; `server-reference` the
   imagery and DCOMP windows, DSR pins; `hdf5-reference` THE WINDOW
   READ, THE RANGE READ;
   `server-reference` THE WINDOW READ IN PLACE; `goesl2-reference`
   THE HOUR'S SKIN; and from passes 148-150: `goesl2-reference` THE
   IMAGERY AND DCOMP; `server-reference` the imagery and DCOMP
   windows; `hdf5-reference` THE PRODUCT FILE, H5PY'S
   EARLIEST/LATEST FILES; `goesl2-reference` THE FIXED GRID, THE
   WINDOW, THE CENSUSES, THE WIRE; `server-reference` NOAA
   cloud-product windows).

---

_Register written at pass 113; the plan file carries the dated history
and the per-pass detail. When a pass adds or changes findings-level
content, extend this register in the same commit._
