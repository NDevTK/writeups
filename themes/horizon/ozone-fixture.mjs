// Captured live 2026-08-06: ONE GFS TOZNE message from the NOMADS
// grib filter (gfs.20260806/12/atmos, f006, 0.5-deg subregion over
// Grindelwald 8-8.5E 46.5-47N). 187 bytes; the filter's subregion
// extraction re-packs to simple packing (template 5.0), which is
// exactly why the gated grib2.js decodes the operational GFS
// without a complex-packing decoder. Decoded ground truth pinned
// in ozone-reference.mjs: 297.753 DU at (46.62, 8.04).
const B64 =
  'R1JJQgAAAAIAAAAAAAAAuwAAABUBAAcAAAIBAQfqCAYMAAAAAQAAAEgDAAAAAAkAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAMAAAADAAAAAP////8CxYigAHoSADACzSnAAIGzIAAD0JAAA9CQQAAAACIEAAAAAA4AAgBgAAAAAQAAAAbIAAAAAAD/AAAAAAAAAAAVBQAAAAkAAEU5CH4AAAABBwAAAAAGBv8AAAANByIsBHZF7diKNzc3Nw==';
export const OZONE_FIXTURE = Uint8Array.from(atob(B64), (c) => c.charCodeAt(0));
