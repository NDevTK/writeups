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
  inflateStream,
  noBucketReason,
  rangeReader
} from './goesl2-client.js';
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
      L2_ASKS.length === 14 &&
      served.length === 13 &&
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
    `the home asks the ${served.length} products the daemon serves (of ${L2_ASKS.length} asks: the 500-m visible window is the page's own, read only when named) over ${listsAfterFirst} listings (this hour's prefix for each, two more hours back for the eleven found empty) and reads the two the fake bucket holds ` +
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
      // the CONUS products the fake bucket lacks: seven since the
      // 161st's cloud top phase
      listedAgain.length === 9 * 3 + 2 &&
      !listedAgain.some(
        (p) => p.startsWith('ABI-L2-SSTF') || p.startsWith('ABI-L2-DSRF')
      ),
    `three range asks of a whole-answering server cost ${calls} download (${a.length}, ${b.length} and ${c.length} bytes cut from it, the last short at the end); ` +
      `the client over such a bucket reads its two files whole (${body && body.read.map((r) => `${r.file.slice(0, 20)} ${r.kb} kB`).join(', ')}), ` +
      `answers rangesHonoured false with the heights and ${body && body.dmw.n} vectors, and two minutes later re-lists ${listedAgain.length} prefixes for the nine CONUS products it lacks and the two it holds, none for the full-disk SST and DSR`
  );
}

process.exit(fail ? 1 : 0);
