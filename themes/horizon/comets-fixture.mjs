// Live fixtures for comets.js, captured 2026-07-10:
//  - three VERBATIM lines from the MPC Soft00Cmt export
//    (minorplanetcenter.net, CORS-open) whose element sets
//    osculate at 2026-07-09: Hale-Bopp (the near-parabolic
//    giant, e = 0.9949), 3I/ATLAS (the interstellar visitor,
//    e = 6.14 - genuinely hyperbolic) and P/1996 R2
//    Lagerkvist (short-period elliptic, e = 0.31)
//  - JPL Horizons heliocentric J2000-ecliptic vectors (km,
//    TDB 2461231.5 = 2026-Jul-10 00:00) for the same three,
//    fetched from ssd.jpl.nasa.gov the same day - the
//    independent ephemeris the gate holds propagation against.
export const MPC_LINES = [
  '    CJ95O010  1997 03 29.0354  0.923247  0.994902  130.7081  281.7808   89.7478  20260709  -2.0  4.0  C/1995 O1 (Hale-Bopp)                                    MPC194091',
  '0003I         2025 10 29.4825  1.356507  6.139884  128.0055  322.1535  175.1129  20251121  11.8  4.0  3I/ATLAS                                                 MPEC 2026-G41',
  '    PJ96R020  2026 06 16.1070  2.586992  0.313918  333.5636   39.9881    2.5997  20260709  11.5  4.0  P/1996 R2 (Lagerkvist)                                   MPC194092'
];

export const HORIZONS_JD = 2461231.5;
export const KM_PER_AU = 149597870.7;
export const HORIZONS_KM = {
  halebopp: [660596717.0633512, -3314390054.809178, -6823189904.35742],
  atlas3i: [-347703204.3344409, 1300551342.306023, -69100414.2234993],
  lagerkvist: [364244713.2040098, 132312392.8897645, -6025126.178723752]
};
