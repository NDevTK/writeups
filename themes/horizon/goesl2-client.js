/**
 * goesl2-client.js - THE PAGE READS THE BUCKET ITSELF (155th pass).
 * NOAA's L2 products reach the page through the daemon's /goesl2 -
 * the shared cache, one bucket read serving every viewer of a cell.
 * When the daemon is unreachable (the live box went dark on
 * 2026-09-05 at 22:02Z and stayed dark through the 154th pass) the
 * page reads its own windows from the open buckets: they answer
 * HTTP Range with 206 and a Content-Range total and are CORS-open
 * with it, the listing too (measured in the 151st pass). The same
 * gated code as the daemon's - goesl2-decode.js (the asks, the
 * window and vector decodes, the bodies), hdf5.js's lazy reader over
 * fetch - with the browser's own DecompressionStream for the files'
 * zlib chunks (a Promise: the reader's NeedInflate replay). The body
 * is the daemon's, so the page's unpacking, censuses, records and
 * lines run unchanged; `via` names the source on the line. Windows
 * are held by file key and cell as the daemon holds them, so a
 * refresh reads only new files; a listing stands a minute. The cost
 * a refresh moves is the daemon's own range figures - about 6 MB for
 * the eight products - so this is the fallback, never the first
 * choice (?goesl2src=direct asks for it outright). Gated by
 * goesl2-client-reference.mjs over a fetch of the vendored fixtures.
 */
import {openHdf5Lazy} from './hdf5.js';
import {
  bandKeys,
  L2_BUCKETS,
  latestByStart,
  nearestByStart,
  parseS3Keys
} from './goesl2.js';
import {
  decodeL2Vectors,
  decodeL2Window,
  L2_ASKS,
  L2_HALF_PX,
  L2_HEAD_BYTES,
  L2_LIST_MS,
  L2_RANGE_BLOCK,
  l2AodBody,
  l2Cell,
  l2DcompBody,
  l2DmwBody,
  l2DsrBody,
  l2FileUrl,
  l2HeightBody,
  l2ImageryBody,
  l2ListUrl,
  l2LstBody,
  l2MaskBody,
  l2PhaseBody,
  l2Prefixes,
  l2SstBody,
  l2VisBody
} from './goesl2-decode.js';
import {pickSatellite} from './satellites.js';

// windows held per satellite and product here: the newest file's and
// the mosaic's minute's
export const CLIENT_HELD_WINDOWS = 4;

// The files' zlib-wrapped deflate chunks (HDF5's deflate filter)
// through DecompressionStream - the browser's own inflate, node 18+
// too. A Promise: hdf5.js replays the parse once it resolves.
export async function inflateStream(raw) {
  const ds = new DecompressionStream('deflate');
  const w = ds.writable.getWriter();
  w.write(raw);
  w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// One HTTP range of a bucket file, the daemon's own rules: 206 with
// the bytes (the Content-Range total is the file's size - not
// exposed to a page by the buckets' CORS policy, so null here), 416
// past the end (nothing), 200 from a server (or a proxy in the way)
// that ignored the range: the whole file, kept ONCE and every later
// range cut from it - a range-ignoring path costs one whole download
// a file, never one per range (measured in the 155th pass: the
// harness's own request bridge answered every range with the whole
// file, and a window of the 40 MB full-disk irradiance took two
// minutes); read.state.ignored says so. Anything else an error.
export function rangeReader(url, fetchFn = fetch, onTotal = null) {
  let whole = null;
  const state = {ignored: false, calls: 0};
  const read = async (s, e) => {
    if (whole) return whole.subarray(s, e);
    state.calls++;
    const r = await fetchFn(url, {
      headers: {range: `bytes=${s}-${e - 1}`},
      credentials: 'omit'
    });
    if (r.status === 206) {
      const m = /\/(\d+)$/.exec(r.headers.get('content-range') ?? '');
      if (m && onTotal) onTotal(+m[1]);
      return new Uint8Array(await r.arrayBuffer());
    }
    if (r.status === 416) return new Uint8Array(0);
    if (r.status === 200) {
      whole = new Uint8Array(await r.arrayBuffer());
      state.ignored = true;
      if (onTotal) onTotal(whole.length);
      return whole.subarray(s, e);
    }
    throw new Error('range ' + r.status);
  };
  read.state = state;
  return read;
}

// The daemon's answer for a point where no bucket reaches (a real
// answer, not a failure) - the same words, so the page's line reads
// the same either way.
export function noBucketReason(pick) {
  return pick.sat
    ? `${pick.sat.name} (${pick.sat.craft}) has no open L2 bucket`
    : pick.nearest
      ? `${pick.nearest.name} sees this point at ${pick.viewZenithDeg.toFixed(0)} deg zenith, past the products' reach`
      : 'no satellite table';
}

/**
 * A client: fetchGoesL2(lat, lon, at) answers the daemon's /goesl2
 * body (via 'bucket'), null when every product failed, {sat: null,
 * reason} where no bucket reaches. fetchFn, inflate and now are
 * injectable for the gate.
 */
export function createGoesL2Client({
  fetchFn = (...a) => fetch(...a),
  inflate = inflateStream,
  now = () => Date.now()
} = {}) {
  const listings = new Map(); // bucket/prefix -> {until, keys}
  const windows = new Map(); // bucket/product[-band]/key/cell -> row
  const stats = {
    lists: 0,
    files: 0,
    ranges: 0,
    bytes: 0,
    errors: 0,
    lastError: '',
    // set once a file came back whole to a range ask: from then on
    // the full-disk products (32 and 40 MB files) are not asked for
    // - a page cannot move those every ten minutes
    rangesIgnored: false
  };
  async function listing(bucket, prefix) {
    const k = bucket + '/' + prefix;
    const hit = listings.get(k);
    if (hit && now() < hit.until) return hit.keys;
    stats.lists++;
    const r = await fetchFn(l2ListUrl(bucket, prefix), {credentials: 'omit'});
    if (!r.ok) throw new Error('list ' + r.status);
    const keys = parseS3Keys(await r.text());
    listings.set(k, {until: now() + L2_LIST_MS, keys});
    return keys;
  }
  // the key for a moment: this hour's prefix, then the previous
  // hour's (the daemon's l2KeyFor)
  async function keyFor(bucket, product, at, band) {
    const when = new Date(at ? Date.parse(at) : now());
    for (const prefix of l2Prefixes(product, when)) {
      const listed = await listing(bucket, prefix);
      const keys = band ? bandKeys(listed, band) : listed;
      const pick = at ? nearestByStart(keys, at) : latestByStart(keys);
      if (pick) return pick;
    }
    return null;
  }
  async function file(bucket, ask, at, cell) {
    const pk = bucket + '/' + ask.product + (ask.band ? '-' + ask.band : '');
    const ck = cell.lat + '/' + cell.lon;
    if (stats.rangesIgnored && ask.fullDisk) return null;
    try {
      const pick = await keyFor(bucket, ask.product, at, ask.band ?? null);
      if (!pick) return null;
      const dk = pk + '/' + pick.key + '/' + ck;
      const have = windows.get(dk);
      if (have) {
        have.t = now();
        return have;
      }
      stats.files++;
      let total = null;
      const t0 = now();
      const reader = rangeReader(l2FileUrl(bucket, pick.key), fetchFn, (n) => {
        total = n;
      });
      const f = await openHdf5Lazy(reader, inflate, {
        blockBytes: L2_RANGE_BLOCK,
        headBytes: ask.headBytes ?? L2_HEAD_BYTES
      });
      if (reader.state.ignored) stats.rangesIgnored = true;
      const dec =
        ask.kind === 'vectors'
          ? await decodeL2Vectors(f, cell.lat, cell.lon, ask.radiusKm)
          : await decodeL2Window(
              f,
              ask.spec,
              cell.lat,
              cell.lon,
              ask.halfPx,
              ask.extras ?? null
            );
      if (!dec) throw new Error(ask.product + ': not readable');
      stats.ranges += f.stats.ranges;
      stats.bytes += f.stats.bytes;
      const row = {
        t: now(),
        key: pick.key,
        stamp: pick.stamp,
        cell: ck,
        dec,
        bytes: reader.state.ignored ? total : f.stats.bytes,
        ranges: f.stats.ranges,
        rounds: f.stats.rounds,
        whole: reader.state.ignored,
        total,
        ms: now() - t0
      };
      windows.set(dk, row);
      const mine = [...windows]
        .filter(([k]) => k.startsWith(pk + '/'))
        .sort((a, b) => a[1].t - b[1].t);
      while (mine.length > CLIENT_HELD_WINDOWS) windows.delete(mine.shift()[0]);
      return row;
    } catch (e) {
      stats.errors++;
      stats.lastError = ask.product + ': ' + e.message;
      return null;
    }
  }
  // `only` (158th pass): the ask ids to fetch - the products an OLDER
  // daemon's body lacks (a deploy that lags the page), read from the
  // bucket beside the daemon's own; null = every ask. The DCOMP pair
  // travels together: 'dcomp' names both files.
  async function fetchGoesL2(lat, lon, at = null, only = null) {
    const pick = pickSatellite(lat, lon);
    const bucket = pick.sat ? L2_BUCKETS[pick.sat.id] : null;
    if (!bucket)
      return {sat: null, via: 'bucket', reason: noBucketReason(pick)};
    const cell = l2Cell(lat, lon);
    const wanted = only
      ? new Set(only.flatMap((id) => (id === 'dcomp' ? ['cod', 'cps'] : [id])))
      : null;
    // a pageOnly ask (159th: the 500-m visible window) is read only
    // when named - the default body stays the daemon's own
    const asks = L2_ASKS.filter(
      (a) =>
        (!at || a.timed !== false) && (wanted ? wanted.has(a.id) : !a.pageOnly)
    );
    const got = await Promise.all(asks.map((a) => file(bucket, a, at, cell)));
    const F = Object.fromEntries(asks.map((a, i) => [a.id, got[i]]));
    if (!got.some((f) => f)) return null;
    return {
      sat: pick.sat.id,
      name: pick.sat.name,
      craft: pick.sat.craft,
      bucket,
      viewZenithDeg: +pick.viewZenithDeg.toFixed(2),
      cell,
      at,
      halfPx: L2_HALF_PX,
      via: 'bucket',
      mask: F.mask
        ? l2MaskBody(F.mask.dec, F.mask.key, cell.lat, cell.lon)
        : null,
      height: F.height
        ? l2HeightBody(F.height.dec, F.height.key, cell.lat, cell.lon)
        : null,
      imagery: F.imagery
        ? l2ImageryBody(F.imagery.dec, F.imagery.key, cell.lat, cell.lon)
        : null,
      dcomp: F.cod
        ? l2DcompBody(
            F.cod.dec,
            F.cps ? F.cps.dec : null,
            F.cod.key,
            F.cps ? F.cps.key : null,
            cell.lat,
            cell.lon
          )
        : null,
      sst: F.sst ? l2SstBody(F.sst.dec, F.sst.key, cell.lat, cell.lon) : null,
      dsr: F.dsr ? l2DsrBody(F.dsr.dec, F.dsr.key, cell.lat, cell.lon) : null,
      dmw: F.dmw ? l2DmwBody(F.dmw.dec, F.dmw.key) : null,
      aod: F.aod ? l2AodBody(F.aod.dec, F.aod.key, cell.lat, cell.lon) : null,
      lst: F.lst ? l2LstBody(F.lst.dec, F.lst.key, cell.lat, cell.lon) : null,
      // the cloud top phase (161st)
      phase: F.phase
        ? l2PhaseBody(F.phase.dec, F.phase.key, cell.lat, cell.lon)
        : null,
      // the daylight field (159th): the page's own read, only when asked
      vis: F.vis ? l2VisBody(F.vis.dec, F.vis.key, cell.lat, cell.lon) : null,
      upstream: got.every((f) => f) ? 'ok' : 'partial',
      rangesHonoured: !stats.rangesIgnored,
      // the ask ids this body answered (a subset under `only`): a
      // product not asked is null here without having failed
      asked: asks.map((a) => a.id),
      // what this refresh moved
      read: got
        .filter((f) => f)
        .map((f) => ({
          file: f.key.split('/').pop(),
          kb: Math.round(f.bytes / 1024),
          ranges: f.ranges,
          rounds: f.rounds,
          whole: f.whole,
          ms: f.ms
        }))
    };
  }
  return {fetchGoesL2, stats, windows, listings};
}
