// goesl2-client-reference.mjs - the gate for goesl2-client.js (155th
// pass): the page's own bucket reads over a fetch that serves the
// vendored fixtures with S3's own semantics (a listing per prefix,
// 206 + Content-Range for a range, 416 past the end, 200 whole when
// asked to ignore the range, 404 for the products the fake bucket
// does not hold); the browser's DecompressionStream against node's
// zlib on a real chunk; the body the daemon would have built from the
// same bytes.
import {inflateSync, deflateSync} from 'node:zlib';
import {openHdf5} from './hdf5.js';
import {
  ACHAC_B64,
  ACHAC_NAME,
  DMWC_B64,
  DMWC_EXPECT,
  DMWC_NAME
} from './hdf5-fixture.js';
import {
  CLIENT_HELD_WINDOWS,
  createGoesL2Client,
  GLM_HEAD_BYTES,
  inflateStream,
  noBucketReason,
  rangeReader,
  readGlmLatest
} from './goesl2-client.js';
import {GLM_B64, GLM_EXPECT, GLM_NAME} from './glm-fixture.js';
import {glmFlashesNear} from './glm.js';
import {ADP_B64, ADP_EXPECT} from './adp-fixture.js';
import {adpDominant, adpFlagBytes, ADP_RADIUS_PX} from './goesl2.js';
import {L2_ADP_EXTRAS, L2_ADP_SPEC, l2AdpBody} from './goesl2-decode.js';
import {LAP_EXPECT, LVTPC_B64} from './lap-fixture.js';
import {lapColumnRows, lapPwMm, unpackArray, unscale} from './goesl2.js';
import {
  decodeL2Column,
  L2_LAP_EXTRAS,
  L2_LVT_SPEC,
  l2LvtBody
} from './goesl2-decode.js';
import {openHdf5Lazy} from './hdf5.js';
import {
  decodeL2,
  L2_ASKS,
  L2_HEIGHT_SPEC,
  l2HeightBody
} from './goesl2-decode.js';
import {pickSatellite} from './satellites.js';

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'REF' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) fail++;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const inflateNode = (u8) =>
  new Uint8Array(
    inflateSync(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength))
  );
const achac = new Uint8Array(Buffer.from(ACHAC_B64, 'base64'));
const dmwc = new Uint8Array(Buffer.from(DMWC_B64, 'base64'));

// ---- THE BROWSER'S INFLATE -----------------------------------------
{
  const plain = new Uint8Array(70000);
  for (let i = 0; i < plain.length; i++) plain[i] = (i * 7) % 251;
  const z = new Uint8Array(deflateSync(Buffer.from(plain)));
  const back = await inflateStream(z);
  const same =
    back.length === plain.length && back.every((v, i) => v === plain[i]);
  const backNode = inflateNode(z);
  check(
    "THE BROWSER'S INFLATE: DecompressionStream reads zlib's stream",
    same && backNode.length === plain.length,
    `a 70000-byte pattern deflated by zlib (${z.length} bytes) comes back exact through DecompressionStream('deflate'), as through node's inflate`
  );
}

// ---- THE RANGE READER ----------------------------------------------
{
  const calls = [];
  const bytes = new Uint8Array(1000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i & 255;
  // an S3 that honours ranges
  const s3 = async (url, opts) => {
    const m = /bytes=(\d+)-(\d+)/.exec(opts.headers.range);
    const s = +m[1];
    const e = Math.min(+m[2] + 1, bytes.length);
    calls.push([s, +m[2] + 1]);
    if (s >= bytes.length)
      return {
        status: 416,
        headers: {get: () => null},
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    return {
      status: 206,
      headers: {
        get: (h) =>
          h === 'content-range' ? `bytes ${s}-${e - 1}/${bytes.length}` : null
      },
      arrayBuffer: async () => bytes.slice(s, e).buffer
    };
  };
  let total = null;
  const rr = rangeReader('u', s3, (n) => {
    total = n;
  });
  const a = await rr(100, 200);
  const b = await rr(900, 1100); // short at the end
  const c = await rr(2000, 2100); // past the end
  // a server that ignores the range answers 200 with the whole file
  const whole = async () => ({
    status: 200,
    headers: {get: () => null},
    arrayBuffer: async () => bytes.slice().buffer
  });
  let total2 = null;
  const d = await rangeReader('u', whole, (n) => {
    total2 = n;
  })(10, 14);
  let threw = null;
  try {
    await rangeReader('u', async () => ({
      status: 500,
      headers: {get: () => null}
    }))(0, 10);
  } catch (e) {
    threw = e.message;
  }
  check(
    'THE RANGE READER: 206 with its total, a short last range, 416 past the end, 200 cut, an error named',
    a.length === 100 &&
      a[0] === 100 &&
      a[99] === 199 &&
      total === 1000 &&
      b.length === 100 &&
      b[0] === (900 & 255) &&
      c.length === 0 &&
      calls[0][0] === 100 &&
      calls[0][1] === 200 &&
      d.length === 4 &&
      d[0] === 10 &&
      total2 === 1000 &&
      threw === 'range 500',
    `bytes 100-199 come as 100 bytes with the file's total ${total} from Content-Range; 900-1099 as the ${b.length} the file holds; ` +
      `2000-2099 as nothing (416); a server answering 200 gives the cut [10,14) with total ${total2}; a 500 throws "${threw}"`
  );
}

// ---- THE CLIENT OVER A FAKE BUCKET ---------------------------------
// The fake bucket holds the vendored ACHAC and DMWC C14 files under
// their products' prefixes (any hour: the listing answers the fixture
// keys for the product asked) and 404s the rest; the client is asked
// for the home, then again (the caches), then for the ACHAC's own
// minute (the timed asks), then for a point no bucket reaches.
{
  const files = {
    [ACHAC_NAME]: achac,
    [DMWC_NAME]: dmwc
  };
  const log = {lists: [], ranges: [], other: []};
  const fetchFake = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.searchParams.has('list-type')) {
      const prefix = u.searchParams.get('prefix');
      log.lists.push(prefix);
      const product = prefix.split('/')[0];
      const keys = Object.keys(files).filter((k) =>
        k.includes(product.replace('ABI-L2-', '-'))
      );
      const body =
        '<?xml version="1.0"?><ListBucketResult>' +
        keys
          .map((k) => `<Contents><Key>${prefix}${k}</Key></Contents>`)
          .join('') +
        '</ListBucketResult>';
      return {ok: true, status: 200, text: async () => body};
    }
    const name = u.pathname.split('/').pop();
    const bytes = files[name];
    if (!bytes) {
      log.other.push(name);
      return {ok: false, status: 404, headers: {get: () => null}};
    }
    const m = /bytes=(\d+)-(\d+)/.exec(
      (opts.headers && opts.headers.range) || ''
    );
    if (!m)
      return {
        status: 200,
        headers: {get: () => null},
        arrayBuffer: async () => bytes.slice().buffer
      };
    const s = +m[1];
    const e = Math.min(+m[2] + 1, bytes.length);
    log.ranges.push([name.slice(0, 16), s, +m[2] + 1]); // as asked
    if (s >= bytes.length)
      return {
        status: 416,
        headers: {get: () => null},
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    return {
      status: 206,
      headers: {
        get: (h) =>
          h === 'content-range' ? `bytes ${s}-${e - 1}/${bytes.length}` : null
      },
      arrayBuffer: async () => bytes.slice(s, e).buffer
    };
  };
  let clock = Date.parse('2026-09-05T18:50:00Z');
  const client = createGoesL2Client({
    fetchFn: fetchFake,
    inflate: inflateStream,
    now: () => clock
  });
  const body = await client.fetchGoesL2(32.85, -117.12);
  const listsAfterFirst = client.stats.lists;
  const filesAfterFirst = client.stats.files;
  const served = L2_ASKS.filter((a) => !a.pageOnly);
  // the daemon's own build of the same bytes
  const decWhole = decodeL2(achac, L2_HEIGHT_SPEC, inflateNode);
  const heightWhole = l2HeightBody(decWhole, 'k', 32.9, -117.1);
  // again within the minute: nothing listed or read anew
  clock += 30e3;
  const again = await client.fetchGoesL2(32.85, -117.12);
  // the ACHAC's own minute: the timed asks only (no sst, no dmw)
  const timed = await client.fetchGoesL2(
    32.85,
    -117.12,
    '2026-09-05T18:46:00Z'
  );
  // a point no bucket reaches (Himawari's longitude)
  const far = await client.fetchGoesL2(35, 140);
  const farPick = pickSatellite(35, 140);
  const asked = new Set(log.other);
  check(
    'THE CLIENT OVER A FAKE BUCKET: the listing, the range reads, the daemon’s body, the caches, the timed asks',
    body !== null &&
      body.sat === 'goes-west' &&
      body.craft === 'GOES-18' &&
      body.bucket === 'noaa-goes18' &&
      body.via === 'bucket' &&
      body.cell.lat === 32.9 &&
      body.cell.lon === -117.1 &&
      body.upstream === 'partial' &&
      body.mask === null &&
      body.imagery === null &&
      body.dcomp === null &&
      body.sst === null &&
      body.dsr === null &&
      body.aod === null &&
      body.lst === null &&
      body.phase === null &&
      body.fire === null &&
      body.tpw === null &&
      body.rain === null &&
      body.height !== null &&
      body.height.product === 'ABI-L2-ACHAC' &&
      body.height.census.n === heightWhole.census.n &&
      body.height.census.medianM === heightWhole.census.medianM &&
      body.height.box.i === 424 &&
      body.height.box.j === 127 &&
      body.dmw !== null &&
      body.dmw.n === DMWC_EXPECT.within150 &&
      body.dmw.total === DMWC_EXPECT.total &&
      near(body.dmw.layers.high.spdMs, DMWC_EXPECT.layers.high.spdMs, 1e-6) &&
      body.read.length === 2 &&
      body.read.every((r) => r.kb > 0 && r.rounds >= 1) &&
      // this hour's prefix for every product the daemon serves, then
      // last hour's and the one before for the eight the fake bucket
      // lists nothing under; the pageOnly ask (159th: the 500-m
      // visible window) is not listed unless named
      listsAfterFirst === (served.length - 2) * 3 + 2 &&
      L2_ASKS.length === 18 &&
      served.length === 17 &&
      filesAfterFirst === 2 &&
      // the range reads: the heights' head then its strips, the winds
      // whole in one megabyte ask
      log.ranges.some(
        ([n, s, e]) =>
          n.startsWith('OR_ABI-L2-ACHAC') && s === 0 && e === 262144
      ) &&
      log.ranges.some(
        ([n, s, e]) =>
          n.startsWith('OR_ABI-L2-DMWC') && s === 0 && e === 1048576
      ) &&
      client.stats.errors === 0 &&
      again !== null &&
      client.stats.lists === listsAfterFirst &&
      client.stats.files === filesAfterFirst &&
      again.height.census.medianM === body.height.census.medianM &&
      timed !== null &&
      timed.at === '2026-09-05T18:46:00Z' &&
      timed.height !== null &&
      timed.height.key === body.height.key &&
      timed.dmw === null &&
      timed.sst === null &&
      timed.read.length === 1 &&
      timed.read[0].file.startsWith('OR_ABI-L2-ACHAC') &&
      client.stats.files === filesAfterFirst &&
      far.sat === null &&
      far.via === 'bucket' &&
      far.reason === noBucketReason(farPick) &&
      far.reason.includes('Himawari') &&
      client.windows.size === 2 &&
      CLIENT_HELD_WINDOWS === 4 &&
      asked.size === 0,
    `the home asks the ${served.length} products the daemon serves (of ${L2_ASKS.length} asks: the 500-m visible window is the page's own, read only when named) over ${listsAfterFirst} listings (this hour's prefix for each, two more hours back for the fifteen found empty) and reads the two the fake bucket holds ` +
      `(${body && body.read.map((r) => `${r.file.slice(0, 20)} ${r.kb} kB in ${r.ranges} range${r.ranges === 1 ? '' : 's'}`).join('; ')}): ` +
      `the heights' window at (424, 127) with ${body && body.height.census.n} tops, median ${body && body.height.census.medianM.toFixed(1)} m ` +
      `- the daemon's own body from the same bytes - and ${body && body.dmw.n} of ${body && body.dmw.total} vectors within 150 km, ` +
      `the high layer's ${body && body.dmw.layers.high.spdMs.toFixed(2)} m/s as numpy read it; the rest null, upstream partial; ` +
      `asked again within the minute nothing is listed or read anew; the ACHAC's own minute asks the timed products only ` +
      `and finds the same file; Himawari's longitude answers sat null: "${far && far.reason}"`
  );
  // THE OLDER DAEMON'S GAPS (158th pass): the page asks the bucket for
  // the products a stale daemon's body lacks and nothing else - a
  // fresh client over the same fake bucket asked for the heights, the
  // land skin and the DCOMP pair lists their prefixes alone (one for
  // the heights, three each for the three found empty), reads the one
  // file it holds, names the asks it answered, and leaves the
  // products it was not asked for null without a failure; asked for
  // the winds alone it lists once and reads once.
  {
    const sub = createGoesL2Client({
      fetchFn: fetchFake,
      inflate: inflateStream,
      now: () => clock
    });
    const before = log.lists.length;
    const part = await sub.fetchGoesL2(32.85, -117.12, null, [
      'height',
      'lst',
      'dcomp'
    ]);
    const listedPart = log.lists.slice(before);
    const filesAfterPart = sub.stats.files;
    const windsOnly = await sub.fetchGoesL2(32.85, -117.12, null, ['dmw']);
    // the daylight field (159th): named alone it lists the imagery
    // prefix (three hours, the fake bucket holds no CMIPC file) and
    // answers null - no file, nothing read
    const beforeVis = log.lists.length;
    const visOnly = await sub.fetchGoesL2(32.85, -117.12, null, ['vis']);
    const listedVis = log.lists.slice(beforeVis);
    check(
      'THE OLDER DAEMON’S GAPS: a subset of the asks lists and reads its own products alone',
      part !== null &&
        visOnly === null &&
        listedVis.length === 3 &&
        listedVis.every((p) => p.startsWith('ABI-L2-CMIPC')) &&
        L2_ASKS[10].id === 'vis' &&
        L2_ASKS[10].pageOnly === true &&
        !body.asked.includes('vis') &&
        body.vis === null &&
        part.via === 'bucket' &&
        part.asked.join(',') === 'height,cod,cps,lst' &&
        listedPart.length === 1 + 3 * 3 &&
        listedPart.filter((p) => p.startsWith('ABI-L2-ACHAC')).length === 1 &&
        listedPart.filter((p) => p.startsWith('ABI-L2-LSTC')).length === 3 &&
        !listedPart.some((p) => p.startsWith('ABI-L2-ACMC')) &&
        !listedPart.some((p) => p.startsWith('ABI-L2-DMWC')) &&
        filesAfterPart === 1 &&
        part.height !== null &&
        part.height.census.medianM === body.height.census.medianM &&
        part.lst === null &&
        part.dcomp === null &&
        part.mask === null &&
        part.dmw === null &&
        part.upstream === 'partial' &&
        part.read.length === 1 &&
        part.read[0].file.startsWith('OR_ABI-L2-ACHAC') &&
        windsOnly !== null &&
        windsOnly.asked.join(',') === 'dmw' &&
        windsOnly.dmw !== null &&
        windsOnly.dmw.n === DMWC_EXPECT.within150 &&
        windsOnly.height === null &&
        windsOnly.read.length === 1 &&
        sub.stats.files === 2 &&
        sub.stats.errors === 0 &&
        body.asked.length === L2_ASKS.filter((a) => !a.pageOnly).length,
      `asked for height, lst and dcomp the client lists ${listedPart.length} prefixes (${listedPart.filter((p) => p.startsWith('ABI-L2-ACHAC')).length} for the heights, ` +
        `three each for the land skin and the DCOMP pair the fake bucket lacks), reads ${part.read.length} file, answers asks ${part.asked.join(',')} ` +
        `with the heights' median ${part.height.census.medianM.toFixed(1)} m - the daemon's own - and the rest null, upstream partial; ` +
        `asked for the winds alone it answers ${windsOnly.dmw.n} vectors from one more read; the full ask names the ${body.asked.length} products the daemon serves ` +
        `and leaves the page-only visible window unlisted; named alone it lists ${listedVis.length} CMIPC prefixes and answers null`
    );
  }
}

// ---- THE RANGE-IGNORING PATH ---------------------------------------
// A server (or a bridge in the way - the harness's own, measured)
// that answers a range ask with the whole file at 200: the reader
// keeps the whole once and cuts every later range from it (one
// download a file, never one a range); the client marks its ranges
// ignored, and once the listings age out the next refresh leaves the
// full-disk products (32 and 40 MB files) unasked while the CONUS
// products are asked again.
{
  const bytes = new Uint8Array(5000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i & 255;
  let calls = 0;
  const whole = async () => {
    calls++;
    return {
      status: 200,
      headers: {get: () => null},
      arrayBuffer: async () => bytes.slice().buffer
    };
  };
  const rr = rangeReader('u', whole);
  const a = await rr(0, 100);
  const b = await rr(4000, 4100);
  const c = await rr(4900, 6000);
  const files = {[ACHAC_NAME]: achac, [DMWC_NAME]: dmwc};
  const lists = [];
  const fetchWhole = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.searchParams.has('list-type')) {
      const prefix = u.searchParams.get('prefix');
      lists.push(prefix);
      const product = prefix.split('/')[0];
      const keys = Object.keys(files).filter((k) =>
        k.includes(product.replace('ABI-L2-', '-'))
      );
      return {
        ok: true,
        status: 200,
        text: async () =>
          '<r>' +
          keys
            .map((k) => `<Contents><Key>${prefix}${k}</Key></Contents>`)
            .join('') +
          '</r>'
      };
    }
    const name = u.pathname.split('/').pop();
    const b = files[name];
    if (!b) return {ok: false, status: 404, headers: {get: () => null}};
    return {
      status: 200,
      headers: {get: () => null},
      arrayBuffer: async () => b.slice().buffer
    };
  };
  let clock = Date.parse('2026-09-05T18:50:00Z');
  const client = createGoesL2Client({
    fetchFn: fetchWhole,
    inflate: inflateStream,
    now: () => clock
  });
  const body = await client.fetchGoesL2(32.85, -117.12);
  const listsFirst = lists.length;
  clock += 2 * 60e3; // the listings have aged out
  const again = await client.fetchGoesL2(32.85, -117.12);
  const listedAgain = lists.slice(listsFirst);
  check(
    'THE RANGE-IGNORING PATH: the whole file once, the full-disk products left unasked',
    a.length === 100 &&
      a[5] === 5 &&
      b.length === 100 &&
      b[0] === (4000 & 255) &&
      c.length === 100 &&
      calls === 1 &&
      rr.state.ignored === true &&
      rr.state.calls === 1 &&
      body !== null &&
      body.rangesHonoured === false &&
      body.read.length === 2 &&
      body.read.every((r) => r.whole === true) &&
      body.read.find((r) => r.file.startsWith('OR_ABI-L2-DMWC')).kb ===
        Math.round(dmwc.length / 1024) &&
      body.height !== null &&
      body.dmw !== null &&
      body.dmw.n === DMWC_EXPECT.within150 &&
      client.stats.rangesIgnored === true &&
      again !== null &&
      again.rangesHonoured === false &&
      again.sst === null &&
      again.dsr === null &&
      again.aod === null &&
      again.lst === null &&
      // the CONUS products re-listed (three prefixes for the six the
      // fake bucket lacks, one for the two it holds), the full-disk
      // ones not
      // the CONUS products the fake bucket lacks: thirteen since the
      // 171st's two profile columns
      listedAgain.length === 13 * 3 + 2 &&
      !listedAgain.some(
        (p) => p.startsWith('ABI-L2-SSTF') || p.startsWith('ABI-L2-DSRF')
      ),
    `three range asks of a whole-answering server cost ${calls} download (${a.length}, ${b.length} and ${c.length} bytes cut from it, the last short at the end); ` +
      `the client over such a bucket reads its two files whole (${body && body.read.map((r) => `${r.file.slice(0, 20)} ${r.kb} kB`).join(', ')}), ` +
      `answers rangesHonoured false with the heights and ${body && body.dmw.n} vectors, and two minutes later re-lists ${listedAgain.length} prefixes for the thirteen CONUS products it lacks and the two it holds, none for the full-disk SST and DSR`
  );
}

// ---- THE HAZE'S KIND, READ (169th pass) ----------------------------
// The vendored Aerosol Detection crop (a Saharan dust field at sea)
// through the shared decode and the body the daemon and the page
// build, held to h5py's independent census of the same bytes: the
// central window's counts by kind and confidence, the centre pixel,
// the ATBD's circle at the centre (under cloud: no call) and the
// best-covered circle in the crop (424 valid of 529, dust on 37: a
// patchy, cloud-broken field is no dominant call by the rule).
{
  const crop = new Uint8Array(Buffer.from(ADP_B64, 'base64'));
  const X = ADP_EXPECT;
  const dec = decodeL2(crop, L2_ADP_SPEC, inflateNode, L2_ADP_EXTRAS);
  const body = dec ? l2AdpBody(dec, 'k', X.centre.lat, X.centre.lon) : null;
  const c = body && body.census;
  const e = X.census101;
  const f = openHdf5(crop, inflateNode);
  const smoke = adpFlagBytes(f.dataset('Smoke').values);
  const dust = adpFlagBytes(f.dataset('Dust').values);
  const dqf = f.dataset('DQF').values;
  const pqi2 = f.dataset('PQI2').values;
  const bc = X.bestCircle;
  const best = adpDominant(smoke, dust, dqf, pqi2, {
    cols: X.cols,
    rows: X.rows,
    ci: bc.col,
    cj: bc.row,
    radiusPx: ADP_RADIUS_PX
  });
  const whole = adpDominant(smoke, dust, dqf, pqi2, {
    cols: X.cols,
    rows: X.rows,
    ci: (X.cols - 1) / 2,
    cj: (X.rows - 1) / 2,
    radiusPx: ADP_RADIUS_PX
  });
  check(
    "THE HAZE'S KIND, READ: the vendored dust field through the decode and the body agrees with h5py to the pixel; the ATBD's circle makes no call under cloud and none on a patchy field",
    body !== null &&
      body.product === 'ABI-L2-ADPC' &&
      body.time !== null &&
      c.n === e.n &&
      c.fill === e.fill &&
      c.night === e.night &&
      c.glint === e.glint &&
      c.land === e.land &&
      c.water === e.water &&
      c.dust.retrieved === e.dust.retrieved &&
      c.dust.present === e.dust.present &&
      c.dust.high === e.dust.high &&
      c.dust.medium === e.dust.medium &&
      c.dust.low === e.dust.low &&
      c.dust.disowned === e.dust.disowned &&
      c.smoke.retrieved === e.smoke.retrieved &&
      c.smoke.present === e.smoke.present &&
      body.here.smoke.present === (X.centre.smoke === 1) &&
      body.here.dust.present === (X.centre.dust === 1) &&
      body.here.dqf === X.centre.dqf &&
      body.here.smoke.confidence === null &&
      body.here.dust.confidence === null &&
      body.matchup.inCircle === X.dominant.inCircle &&
      body.matchup.valid === X.dominant.valid &&
      body.matchup.dominant === null &&
      body.matchup.enough === false &&
      whole.valid === X.dominant.valid &&
      whole.dust.present === X.dominant.dustPresent &&
      best.inCircle === bc.inCircle &&
      best.valid === bc.valid &&
      near(best.coverage, bc.coverage, 1e-12) &&
      best.dust.present === bc.dustPresent &&
      best.smoke.present === bc.smokePresent &&
      best.enough === true &&
      best.dominant === bc.dominant &&
      body.sceneStats.dustDetected === X.scene.dustDetected &&
      body.sceneStats.smokeDetected === X.scene.smokeDetected &&
      body.sceneStats.goodDust === X.scene.goodDust &&
      body.radiusPx === ADP_RADIUS_PX,
    `${X.file.slice(0, 24)} cropped ${X.rows} x ${X.cols} around ${X.centre.lat.toFixed(2)} N ${(-X.centre.lon).toFixed(2)} W: the body's central 101 x 101 window censuses ` +
      `${c && c.dust.present} dust px (${c && c.dust.medium} medium, ${c && c.dust.low} low) of ${c && c.dust.retrieved} retrieved and ${c && c.smoke.present} smoke of ${c && c.smoke.retrieved}, ` +
      `all ${c && c.water} over water, ${c && c.night} night, ${c && c.glint} in glint - h5py's numbers to the pixel; the centre pixel's word ${body && body.here.dqf} (both tests unrun: cloud) ` +
      `and its 25-km circle ${body && body.matchup.valid} valid of ${body && body.matchup.inCircle} (${body && (100 * body.matchup.coverage).toFixed(1)}%): no call; ` +
      `the best-covered circle at (${bc.row}, ${bc.col}) ${best.valid} valid of ${best.inCircle} (${(100 * best.coverage).toFixed(1)}%), dust on ${best.dust.present}: '${best.dominant}'; ` +
      `the scene's head: ${body && body.sceneStats.dustDetected} dust and ${body && body.sceneStats.smokeDetected} smoke detections of ${body && body.sceneStats.goodDust.toLocaleString('en-US')} good dust retrievals`
  );
}

// ---- THE COLUMN, READ BY RANGE (171st pass) ------------------------
// The vendored profile crop through the RANGE path the daemon and the
// page use - hdf5.js's lazy reader over a fake bucket honouring
// ranges, the column decode's three-dimensional window, the body the
// wire carries - held to the whole-buffer read and to h5py's pins.
{
  const crop = new Uint8Array(Buffer.from(LVTPC_B64, 'base64'));
  const X = LAP_EXPECT;
  const calls = [];
  const s3 = async (url, opts) => {
    const m = /bytes=(\d+)-(\d+)/.exec((opts.headers && opts.headers.range) || '');
    const s = +m[1];
    const e = Math.min(+m[2] + 1, crop.length);
    calls.push([s, e]);
    if (s >= crop.length)
      return {status: 416, headers: {get: () => null}, arrayBuffer: async () => new ArrayBuffer(0)};
    return {
      status: 206,
      headers: {get: (h) => (h === 'content-range' ? `bytes ${s}-${e - 1}/${crop.length}` : null)},
      arrayBuffer: async () => crop.slice(s, e).buffer
    };
  };
  // a small head so the column's chunk must come in its own range
  const rr = rangeReader('u', s3);
  const f = await openHdf5Lazy(rr, inflateStream, {blockBytes: 4096, headBytes: 8192});
  const dec = await decodeL2Column(f, L2_LVT_SPEC, X.centre.lat, X.centre.lon, 1, L2_LAP_EXTRAS);
  const body = dec ? l2LvtBody(dec, 'k', X.centre.lat, X.centre.lon) : null;
  const counts = body ? unpackArray(body.counts) : null;
  const levels = body ? unpackArray(body.levels) : null;
  const overall = body ? unpackArray(body.overall) : null;
  const q = body ? body.here.q : -1;
  const tK = counts
    ? Array.from(counts.subarray(q * 101, q * 101 + 101)).map((v) =>
        v === body.fill ? NaN : v * body.scale + body.offset
      )
    : null;
  check(
    'THE COLUMN, READ BY RANGE: the lazy reader cuts one field of regard with all its levels from the crop by range, and the body carries it',
    dec !== null &&
      body !== null &&
      body.product === 'ABI-L2-LVTPC' &&
      body.field === 'LVT' &&
      dec.box.rows === 3 &&
      dec.box.cols === 3 &&
      dec.box.i - dec.box.i0 === 1 &&
      dec.box.j - dec.box.j0 === 1 &&
      levels.length === X.levels &&
      near(levels[3], 1013.9475708007812, 1e-4) &&
      counts.length === 9 * X.levels &&
      near(body.scale, X.tScale, 1e-15) &&
      near(body.offset, X.tOffset, 1e-9) &&
      body.fill === 65535 &&
      q === 4 &&
      near(tK[3], X.tK.i3, 1e-9) &&
      near(tK[25], X.tK.i25, 1e-9) &&
      near(tK[52], X.tK.i52, 1e-9) &&
      overall.length === 9 &&
      overall.every((v) => v === 0) &&
      body.here.overall === 0 &&
      body.here.quality.usable === true &&
      body.census.good === 9 &&
      body.nearest.q === 4 &&
      body.nearest.d2 === 0 &&
      body.lzaQuantitativeDeg !== null &&
      f.stats.ranges >= 2 &&
      calls.length === f.stats.ranges,
    `the crop by range: ${f.stats.ranges} ranges in ${f.stats.rounds} rounds (${f.stats.bytes} bytes; head 8 kB, blocks 4 kB), a 3 x 3 window of fields around (${X.centre.lat.toFixed(2)}, ${X.centre.lon.toFixed(2)}) with the observer's at q ${q}; ` +
      `${counts.length} counts on the wire unscale to ${tK[3].toFixed(3)} K at 1013.9 hPa, ${tK[25].toFixed(3)} K at 500 and ${tK[52].toFixed(3)} K at 134 - h5py's values; ${body.census.good} of 9 fields good, the nearest usable the observer's own; quantitative zenith ${body.lzaQuantitativeDeg} deg`
  );
}

// ---- THE FLASHES READ BY THE PAGE (168th pass) ---------------------
// A fake bucket holding the vendored GLM file under its product's
// prefix with S3's range semantics; the page's own read at Tampa,
// the newest file already read (the listing alone), a point no bucket
// reaches, and the failures named.
{
  const glm = new Uint8Array(Buffer.from(GLM_B64, 'base64'));
  const log = {lists: [], ranges: [], other: []};
  const fetchGlm = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.searchParams.has('list-type')) {
      const prefix = u.searchParams.get('prefix');
      log.lists.push(prefix);
      const body =
        '<?xml version="1.0"?><ListBucketResult>' +
        (prefix.startsWith('GLM-L2-LCFA/')
          ? `<Contents><Key>${prefix}${GLM_NAME}</Key></Contents>`
          : '') +
        '</ListBucketResult>';
      return {ok: true, status: 200, text: async () => body};
    }
    const name = u.pathname.split('/').pop();
    if (name !== GLM_NAME) {
      log.other.push(name);
      return {ok: false, status: 404, headers: {get: () => null}};
    }
    const m = /bytes=(\d+)-(\d+)/.exec(
      (opts.headers && opts.headers.range) || ''
    );
    const s = m ? +m[1] : 0;
    const e = m ? Math.min(+m[2] + 1, glm.length) : glm.length;
    log.ranges.push([s, m ? +m[2] + 1 : null]);
    if (s >= glm.length)
      return {
        status: 416,
        headers: {get: () => null},
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    return {
      status: m ? 206 : 200,
      headers: {
        get: (h) =>
          h === 'content-range' ? `bytes ${s}-${e - 1}/${glm.length}` : null
      },
      arrayBuffer: async () => glm.slice(s, e).buffer
    };
  };
  const clock = Date.parse('2026-09-06T19:52:00Z');
  const opts = {fetchFn: fetchGlm, inflate: inflateStream, now: () => clock};
  const d = await readGlmLatest(27.9, -82.5, opts);
  const rangesAfterRead = log.ranges.length;
  const nr = glmFlashesNear(d.flashes, 27.9, -82.5, {maxKm: 200, cap: 300});
  const again = await readGlmLatest(27.9, -82.5, {...opts, skipKey: d.key});
  const nowhere = await readGlmLatest(-20, 80, opts);
  const noList = await readGlmLatest(27.9, -82.5, {
    ...opts,
    fetchFn: async () => ({ok: false, status: 403})
  });
  const noFile = await readGlmLatest(27.9, -82.5, {
    ...opts,
    fetchFn: async (url, o) =>
      new URL(url).searchParams.has('list-type')
        ? fetchGlm(url, o)
        : {ok: false, status: 404, headers: {get: () => null}}
  });
  check(
    'THE FLASHES READ BY THE PAGE: the newest 20-s file whole in one range, the listing alone when it is the file already read, the failures named',
    d.sat === 'goes-east' &&
      d.craft === 'GOES-19' &&
      d.bucket === 'noaa-goes19' &&
      d.error === null &&
      d.same === false &&
      d.key === 'GLM-L2-LCFA/2026/249/19/' + GLM_NAME &&
      d.lists === 1 &&
      log.lists[0] === 'GLM-L2-LCFA/2026/249/19/' &&
      d.n === GLM_EXPECT.n &&
      d.diskFlashes === GLM_EXPECT.flashCount &&
      d.platform === GLM_EXPECT.platform &&
      d.startMs === Date.parse(GLM_EXPECT.start) &&
      d.flashes[0].id === GLM_EXPECT.first.id &&
      Math.abs(d.flashes[0].energyJ - GLM_EXPECT.first.energyJ) < 1e-27 &&
      d.bytes === glm.length &&
      d.ranges === 1 &&
      d.rounds === 1 &&
      d.whole === false &&
      rangesAfterRead === 1 &&
      log.ranges[0][0] === 0 &&
      log.ranges[0][1] === GLM_HEAD_BYTES &&
      nr.length === GLM_EXPECT.within200 &&
      again.same === true &&
      again.key === d.key &&
      again.flashes.length === 0 &&
      log.ranges.length === rangesAfterRead &&
      // the first read, the skip, the missing-file case: three
      // listings through this fake (the 403 case has its own)
      log.lists.length === 3 &&
      nowhere.sat === null &&
      /no open L2 bucket|past the products' reach/.test(nowhere.reason) &&
      noList.sat === 'goes-east' &&
      noList.error === 'list 403' &&
      noList.flashes.length === 0 &&
      noFile.error === 'range 404' &&
      noFile.key === null,
    `Tampa reads ${d.craft}'s ${d.key.split('/').pop().slice(0, 30)} from ${d.bucket} (one listing, ${d.lists} prefix): ${d.n} flashes, ${d.bytes} bytes in ${d.ranges} range of ${d.rounds} round ` +
      `(the megabyte asked, the file's ${glm.length} answered short), ${nr.length} within 200 km; asked again with the key it read, the listing alone answers same (${log.ranges.length} ranges in all); ` +
      `20 S 80 E: "${nowhere.reason}"; a 403 listing says "${noList.error}", a missing file "${noFile.error}"`
  );
}

process.exit(fail ? 1 : 0);
