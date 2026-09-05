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
  the tower eye's fan over 10–60 km finds no fold where the Kansas
  forms folded at 30 km — the inferior mirage from a pier-height eye
  is a profile-form question the archive decides, and the retrieval's
  100-m fan does not yet resolve the film the archive-gated forms
  draw. (`surfacelayer-reference`: the code's forms, THE ARCHIVE;
  `observatory-reference` DAY PINS marine: fluxes)

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
  is a Kansas-form fold — on COARE's forms the calm film's mirage
  sits under the retrieval fan's 100-m resolution; since pass 136
  the water temperature is the
  INTERFACE (COARE 3.6's cool skin on the pier's bulk sensor, no
  rain term; since pass 139 the day's warm layer lifts the sub-skin
  surface above the 3.4-m sensor by what the scheme holds above it,
  under hourly satellite-derived solar) under a sky longwave that is
  MODELLED
  from the pier's air and the shore's dewpoint and cover (a
  screen-level emissivity fit made over land, held over the clear
  ocean by 323 measured ship hours to −2 ± 11 W/m² since pass 137;
  the cover term still on the land fit's printed coefficients), and
  the pier's humidity is the nearest coastal
  METAR's dewpoint, the ascent's surface row standing in only when
  no shore screen is fresh.

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
   a measurement taken over the water it draws.

---

_Register written at pass 113; the plan file carries the dated history
and the per-pass detail. When a pass adds or changes findings-level
content, extend this register in the same commit._
