/**
 * gvp-fixture.js - REAL items from the Weekly Volcanic Activity
 * Report of 30 July-5 August 2026 (fetched 2026-08-08, verbatim
 * RSS fragments incl. entities) and the SAME volcanoes' rows from
 * the GVP Holocene list WFS (Volcano_Name, Latitude, Longitude,
 * Elevation - fetched the same day). The gate parses these
 * exactly as the daemon parses the live feed.
 */

export const GVP_FIXTURE_ITEMS = [
  {
    title:
      'Etna (Italy) - Report for 30 July-5 August 2026 - New Eruptive Activity',
    point: '37.7480 14.9990',
    desc: '\n&lt;p&gt;The Sezione di Catania - Osservatorio Etneo (INGV) reported eruptive activity at Etna?s summit craters during 27 July-2 August characterized by sporadic explosive activity and ash emissions at Northeast Crater (NEC) and Bocca Nuova Crater (BN), Strombolian activity and lava effusion at Voragine Crater (VOR), and gas emissions at Southeast Crater. Strombolian activity began at VOR at 0330 on 30 July. The explosive activity gradually intensified during the morning, which produced ash plumes that drifted NW, and transitioned to lava fountaining. The Aviation Color Code (ACC) was raised to Yellow (the second lowest color on a four-color scale) at 0407 and to Orange at 0424. Ash plumes rose to 7 km (23,000 ft) a.s.l.; the ACC was raised to Red at 0533. Lava flows from Strombolian activity at VOR advanced into the Northeast Crater (NEC), and ash emissions drifted SW. At around 0959 a small pyroclastic flow traveled from VOR towards the upper part of the Valle del Bove, and at around the same time ash emissions became less intense. Minor ashfall was reported in Bronte (15 km WNW). Strombolian activity at VOR began to decrease at 1030 and ceased at 1300, though intense ash emissions persisted. By 1743 ash emissions had declined and were characterized as diffuse; the ACC was lowered to Orange. \n  \nStrombolian activity at VOR resumed at 1850 and gradually intensified. By 1932 Strombolian activity was strong and ash plumes were again rising to 7 km a.s.l.; the ACC was raised t'
  },
  {
    title:
      'Fuego (Guatemala) - Report for 30 July-5 August 2026 - New Eruptive Activity',
    point: '14.4748 -90.8806',
    desc: '\n&lt;p&gt;The Instituto Nacional de Sismología, Vulcanologia, Meteorologia e Hidrología (INSIVUMEH) reported that eruptive activity at Fuego continued during 29 July-5 August with an escalation of activity beginning on 2 August. During 29 July-2 August daily Strombolian and Vulcanian explosions recorded by the seismic network, at rates of 6-11 per hour, generated gas-and-ash plumes that rose as high as 1.1 km above the summit and drifted as far as 40 km SW, W, and NW. Rumbling sounds, shock waves, and/or sounds associated with explosions were reported daily. Explosions occasionally ejected incandescent material as high as 300 m above the summit and onto the flanks, causing incandescent block avalanches to descend the flanks; notably avalanches descended the Seca (W), Taniluyá (SSW), Ceniza (SSW), Las Lajas (SE), and Honda drainages, sometimes reaching vegetated areas. Ashfall was reported in areas downwind during 1-2 August, including Panimaché, Morelia, Santa Sofía, El Porvenir, San Pedro Yepocapa, and Sangre de Cristo. \n  \nNormally the seismic network records 250-350 explosions per day, though at around 1430 on 2 August the eruptive pattern changed. Explosions became nearly continuous, emissions and crater incandescence were observed[EV2.1], and acoustic tremor signals had characteristics not recorded since 5 June 2025. Incandescent lava fragments and blocks were ejected 100-200 m above the summit, with large amounts of the ejecta falling into the Ceniza and Seca-Santa Tere'
  },
  {
    title:
      'Krakatau (Indonesia) - Report for 30 July-5 August 2026 - New Eruptive Activity',
    point: '-6.1009 105.4233',
    desc: '\n&lt;p&gt;The Pusat Vulkanologi dan Mitigasi Bencana Geologi (PVMBG) reported ongoing eruptive activity at Krakatau during 30 July-5 August. White plumes were visible on most days rising 100 m above the summit; weather conditions prevented views during 31 July-1 August. According to the Darwin Volcanic Ash Advisory Centre (VAAC) a dense steam plume with possible ash was visible in satellite images rising 1.5 km (5,000 ft) a.s.l. and drifting SW. The Alert Level remained at 2 (on a scale of 1-4) and the public was warned to stay 2 km away from the summit.&lt;/p&gt;\n&lt;p&gt;Sources: Darwin Volcanic Ash Advisory Centre (VAAC),Pusat Vulkanologi dan Mitigasi Bencana Geologi (PVMBG, also known as CVGHM)&lt;/p&gt;\n'
  },
  {
    title:
      'Aira (Japan) - Report for 30 July-5 August 2026 - Continuing Eruptive Activity',
    point: '31.5772 130.6589',
    desc: '\n&lt;p&gt;The Japan Meteorological Agency (JMA) reported ongoing eruptive activity at Minamidake Crater (Aira Caldera?s Sakurajima volcano) during 27 July-3 August. The monitoring networks recorded a total of 36 eruptive events and three explosions. Multiple eruptive events per day during 27-29 July and 31 July-2 August generated ash plumes that rose 1-3 km above the summit and sometimes drifted E, SE, and S. Emissions were sometimes continuous, notably during 0351-0430 on 28 July and from 2334 on 2 August to 0030 on 3 August. Large blocks were occasionally ejected as far as 1.1 km from the vent. An explosion at 2059 on 29 July generated an ash plume that rose 1.6 km above the summit and drifted S. At 0002 on 2 August an explosion produced an ash plume that rose 2.2 km above the summit and ejected large blocks 500-700 m from the vent. An ash plume from an explosion at 2334 on 2 August rose 3 km above the summit and drifted S. Crater incandescence was visible in nighttime webcam images during 31 July-3 August. The Alert Level remained at 3 (on a 5-level scale), and the public was warned to be cautious within 2 km of both the Minimadake and Showa craters.&lt;/p&gt;\n&lt;p&gt;Source: Japan Meteorological Agency (JMA) &lt;/p&gt;\n'
  },
  {
    title:
      'Reventador (Ecuador) - Report for 30 July-5 August 2026 - Continuing Eruptive Activity',
    point: '-0.0770 -77.6560',
    desc: '\n&lt;p&gt;The Instituto Geofísico-Escuela Politécnica Nacional (IG-EPN) reported that eruptive activity at Reventador continued at a high level during 29 July-5 August. Seismicity included 55-91 daily explosions, long-period earthquakes, harmonic tremor, and tremor associated with emissions. Daily ash-and-gas plumes were visible rising 300-1,600 m above the crater rim and drifting mainly NW, W, and SW. Incandescent blocks were also visible during dark hours each day rolling as far as 2.1 km down the flanks. Weather clouds sometimes obscured webcam and satellite views. Secretaría de Gestión de Riesgos (SGR) maintained the Alert Level at Orange (the second highest level on a four-color scale).&lt;/p&gt;\n&lt;p&gt;Sources: Instituto Geofísico-Escuela Politécnica Nacional (IG-EPN) ,Secretaría de Gestión de Riesgos (SGR)&lt;/p&gt;\n'
  },
  {
    title:
      'Sabancaya (Peru) - Report for 30 July-5 August 2026 - Continuing Eruptive Activity',
    point: '-15.7870 -71.8570',
    desc: '\n&lt;p&gt;The Instituto Geofísico del Perú?s (IGP) Centro Vulcanológico Nacional (CENVUL) reported continuing eruptive activity at Sabancaya during 27 July-2 August. The seismic network detected 47 seismic events related to the movement of magmatic fluids, along with additional earthquakes indicating rock fracturing. No explosions were recorded. Gas, steam, and ash plumes periodically rose as high as 2.5 km above the crater rim and drifted less than 10 km E and SE. Thermal anomalies on the crater floor were identified in satellite images and moderate sulfur dioxide emissions averaged 870 tons per day. The Alert Level remained at Orange (the third level on a four-color scale) and the public was warned to stay outside of a 12 km radius from the summit.&lt;/p&gt;\n&lt;p&gt;Source: Instituto Geofísico del Perú (IGP)&lt;/p&gt;\n'
  }
];

// name -> [Latitude, Longitude, Elevation] (WFS verbatim)
export const GVP_FIXTURE_ELEV = {
  Etna: [37.748, 14.999, 3357],
  Fuego: [14.4748, -90.8806, 3799],
  Krakatau: [-6.1009, 105.4233, 285],
  Aira: [31.5772, 130.6589, 1117],
  Reventador: [-0.077, -77.656, 3562],
  Sabancaya: [-15.787, -71.857, 5960]
};
