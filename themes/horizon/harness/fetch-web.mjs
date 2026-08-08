// Research fetcher: drive the harness Chromium through the session's
// agent proxy to read pages and open-access PDFs that plain curl
// cannot (JS challenges, cookie flows, SPAs).
//
//   node fetch-web.mjs URL                 -> page title + text to stdout
//   node fetch-web.mjs URL out.pdf         -> capture application/pdf
//        (direct PDF response, or the first bitstream/.pdf link on the
//        page fetched with the page's own session)
//
// Environment prerequisites (one-time per container, discovered by the
// Aug 8 proxy-debug session - the full story is in WEBGPU-PLAN.md):
//  1. The MITM CA must be a real NSS trust anchor - the proxy README's
//     promised browser store was EMPTY:
//       apt-get install -y libnss3-tools
//       certutil -d sql:$HOME/.pki/nssdb -A -t "C,," \
//         -n ccr-agent-proxy -i /root/.ccr/agent-proxy-ca.crt
//  2. TLS must be capped at 1.2 (below): the proxy's TLS stack RESETS
//     Chrome's TLS 1.3 ClientHello mid-handshake (curl's classical
//     hello passes). The capped hop is browser->localhost proxy only;
//     verification stays ON against the NSS anchor.
// Known walls that stay closed (do not grind): web.archive.org
// (proxy grants CONNECT, upstream leg resets - use the archive.org
// host: /wayback/available API + item downloads), interactive bot
// managers (Radware/IOP, Cloudflare/Wiley), and hosts the upstream
// URL filter serves "Web Page Blocked!" for (digital.csic.es).
import pw from 'playwright-core';
import {writeFileSync} from 'node:fs';
import {ensureChrome} from './setup-chrome.mjs';

const [url, out] = process.argv.slice(2);
const {chromium} = pw;
const browser = await chromium.launch({
  executablePath: await ensureChrome(),
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-background-networking',
    '--ssl-version-max=tls1.2'
  ],
  proxy: {server: process.env.HTTPS_PROXY || 'http://127.0.0.1:45059'}
});
const page = await browser.newPage();
let pdfBuf = null;
page.on('response', async (r) => {
  try {
    if (
      out &&
      !pdfBuf &&
      (r.headers()['content-type'] || '').includes('application/pdf')
    ) {
      pdfBuf = await r.body();
    }
  } catch {}
});
try {
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000});
} catch (e) {
  console.log('NAVERR', e.message.split('\n')[0]);
}
// let auto-clearing challenges (Anubis-class) solve and redirect
for (let i = 0; i < 30; i++) {
  const t = (await page.title().catch(() => '')) || '';
  if (t && !/not a bot|making sure|just a moment/i.test(t)) break;
  await page.waitForTimeout(2000);
}
console.log('TITLE', await page.title().catch(() => '?'));
if (!out) {
  const txt = await page
    .evaluate(() => document.body.innerText)
    .catch(() => '');
  console.log(txt.slice(0, 4000));
} else if (pdfBuf) {
  writeFileSync(out, pdfBuf);
  console.log('SAVED', out, pdfBuf.length);
} else {
  const links = await page
    .$$eval('a[href]', (as) =>
      as
        .map((a) => a.href)
        .filter((h) => /bitstream|\.pdf($|\?)/i.test(h))
        .slice(0, 5)
    )
    .catch(() => []);
  console.log('PDF LINKS', JSON.stringify(links));
  if (links.length) {
    const r = await page.context().request.get(links[0], {timeout: 90000});
    const body = await r.body();
    if (
      (r.headers()['content-type'] || '').includes('pdf') ||
      body.slice(0, 4).toString() === '%PDF'
    ) {
      writeFileSync(out, body);
      console.log('SAVED', out, body.length);
    } else {
      console.log('NOTPDF', r.headers()['content-type'], body.length);
    }
  } else {
    console.log('NOPDF');
  }
}
await browser.close();
