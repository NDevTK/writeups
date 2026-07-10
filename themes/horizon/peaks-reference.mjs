// Reference gate for peaks.js (node peaks-reference.mjs):
//  - parse forms: the ele tag's wild variants, nameless dropped,
//    elevation-less kept name-only
//  - the declutter rule: elevation-ranked, minimum separation -
//    the fixture's own Jungfrau / "Wengen Jungfrau" pair decides
//  - the LIVE fixture: the 4000ers by name at their surveyed
//    elevations
//  - the label text: name + surveyed metres, tag precision
import {labelText, parsePeaks, selectPeaks} from './peaks.js';
import {PEAKS_FIXTURE} from './peaks-fixture.mjs';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};

{
  // Parse forms.
  const p = parsePeaks({
    elements: [
      {
        type: 'node',
        id: 1,
        lat: 46.5,
        lon: 8,
        tags: {name: 'A', ele: '4048.8'}
      },
      {
        type: 'node',
        id: 2,
        lat: 46.51,
        lon: 8,
        tags: {name: 'B', ele: '3 970'}
      },
      {
        type: 'node',
        id: 3,
        lat: 46.52,
        lon: 8,
        tags: {name: 'C', ele: '2500,5'}
      },
      {type: 'node', id: 4, lat: 46.53, lon: 8, tags: {ele: '3000'}},
      {type: 'node', id: 5, lat: 46.54, lon: 8, tags: {name: 'E'}}
    ]
  });
  const ok =
    p.length === 4 &&
    p[0].ele === 4048.8 &&
    p[1].ele === 3970 &&
    p[2].ele === 2500.5 &&
    p[3].name === 'E' &&
    p[3].ele === null;
  check(
    'parse forms',
    ok,
    "'4048.8', '3 970' and '2500,5' all parse; a nameless peak is dropped, an elevation-less one keeps a name-only label"
  );
}

const peaks = parsePeaks(PEAKS_FIXTURE);

{
  // The LIVE fixture: the region's 4000ers at their surveyed
  // elevations.
  const by = new Map(peaks.map((p) => [p.name, p]));
  const ok =
    peaks.length === 400 &&
    by.get('Finsteraarhorn').ele === 4274 &&
    by.get('Jungfrau').ele === 4158 &&
    by.get('Mönch').ele === 4107 &&
    by.get('Schreckhorn').ele === 4078 &&
    peaks.filter((p) => p.ele != null).length >= 380;
  check(
    'live Jungfrau fixture',
    ok,
    `${peaks.length} named peaks, ${peaks.filter((p) => p.ele != null).length} with surveyed elevations - Finsteraarhorn 4274, Jungfrau 4158, Mönch 4107`
  );
}

{
  // The declutter rule on the real data: the Jungfrau is labelled,
  // "Wengen Jungfrau" (4085 m, ~300 m away) is not; everything
  // kept stands >= 1800 m from everything else; the cap holds;
  // the list is elevation-ranked.
  const sel = selectPeaks(peaks, 14, 1800);
  const names = new Set(sel.map((p) => p.name));
  let sepOk = true;
  const mLat = 111320;
  for (let i = 0; i < sel.length; i++)
    for (let k = i + 1; k < sel.length; k++) {
      const dx =
        (sel[k].lon - sel[i].lon) *
        mLat *
        Math.cos((sel[i].lat * Math.PI) / 180);
      const dy = (sel[k].lat - sel[i].lat) * mLat;
      if (Math.hypot(dx, dy) < 1800) sepOk = false;
    }
  const ranked = sel.every(
    (p, i) => i === 0 || (sel[i - 1].ele ?? -1e9) >= (p.ele ?? -1e9)
  );
  check(
    'declutter selection',
    sel.length === 14 &&
      names.has('Jungfrau') &&
      !names.has('Wengen Jungfrau') &&
      names.has('Finsteraarhorn') &&
      sepOk &&
      ranked,
    `14 labels: the Jungfrau in, its 300 m neighbour "Wengen Jungfrau" out, every pair >= 1.8 km apart, elevation-ranked`
  );
}

{
  // The label text: surveyed metres at tag precision.
  const ok =
    labelText({name: 'Jungfrau', ele: 4158}) === 'Jungfrau · 4158 m' &&
    labelText({name: 'Grosses Fiescherhorn', ele: 4048.8}) ===
      'Grosses Fiescherhorn · 4049 m' &&
    labelText({name: 'Harder', ele: null}) === 'Harder';
  check(
    'label text',
    ok,
    "'Jungfrau · 4158 m'; 4048.8 rounds to the metre; no elevation, no number"
  );
}

process.exit(fail ? 1 : 0);
