/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT
 *  https://github.com/gzuidhof/coi-serviceworker
 *
 *  GitHub Pages can't set response headers, so it can't hand out the
 *  Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy pair that a page
 *  needs to become `crossOriginIsolated` and unlock SharedArrayBuffer. This
 *  service worker synthesises those headers on every same-origin response,
 *  which is what lets the same-origin firefox-wasm build behind the Firefox
 *  theme run Gecko's threads here.
 *
 *  The `credentialless` COEP variant is used on purpose: the site pulls a lot
 *  of public cross-origin images and tiles (GitHub avatars, map tiles, CDN
 *  assets) that don't send CORP headers. Under `credentialless` those still
 *  load — just without credentials — instead of being blocked as they would be
 *  under `require-corp`.
 */

// Flip to true so cross-origin no-cors subresources load credential-lessly
// rather than needing an explicit CORP header.
let coepCredentialless = true;

if (typeof window === 'undefined') {
  // ---- Service-worker context ----
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) =>
    event.waitUntil(self.clients.claim())
  );

  self.addEventListener('message', (ev) => {
    if (!ev.data) return;
    if (ev.data.type === 'deregister') {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) =>
          clients.forEach((client) => client.navigate(client.url))
        );
    } else if (ev.data.type === 'coepCredentialless') {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener('fetch', (event) => {
    const r = event.request;
    // Range/media requests fetched from the cache must be left untouched.
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;

    const request =
      coepCredentialless && r.mode === 'no-cors'
        ? new Request(r, {credentials: 'omit'})
        : r;

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Opaque responses (status 0) can't be rewritten; pass them through.
          if (response.status === 0) return response;

          const headers = new Headers(response.headers);
          headers.set(
            'Cross-Origin-Embedder-Policy',
            coepCredentialless ? 'credentialless' : 'require-corp'
          );
          if (!coepCredentialless) {
            headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
          }
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  // ---- Page context: register (or refresh) the worker ----
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem('coiReloadedBySelf');
    window.sessionStorage.removeItem('coiReloadedBySelf');

    const coi = {
      shouldRegister: () => !reloadedBySelf,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      coepDegrade: () => true,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi
    };

    const n = navigator;
    if (n.serviceWorker && n.serviceWorker.controller) {
      n.serviceWorker.controller.postMessage({
        type: 'coepCredentialless',
        value: coi.coepCredentialless()
      });
      if (coi.shouldDeregister()) {
        n.serviceWorker.controller.postMessage({type: 'deregister'});
      }
    }

    // Already isolated (this worker did its job, or the server set the
    // headers) — nothing to do.
    if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;

    if (!window.isSecureContext) {
      !coi.quiet &&
        console.log(
          'COOP/COEP Service Worker not registered: a secure context is required.'
        );
      return;
    }
    if (!n.serviceWorker) {
      !coi.quiet &&
        console.error(
          'COOP/COEP Service Worker not registered (unavailable, e.g. private mode).'
        );
      return;
    }

    // Trusted-Types-safe: the host page enforces `require-trusted-types-for
    // 'script'`, so wrap the worker URL in a policy when the API is present.
    const rawUrl = window.document.currentScript.src;
    const swUrl =
      window.trustedTypes && window.trustedTypes.createPolicy
        ? window.trustedTypes
            .createPolicy('coi-serviceworker', {createScriptURL: (s) => s})
            .createScriptURL(rawUrl)
        : rawUrl;

    n.serviceWorker.register(swUrl).then(
      (registration) => {
        !coi.quiet &&
          console.log(
            'COOP/COEP Service Worker registered',
            registration.scope
          );

        registration.addEventListener('updatefound', () => {
          !coi.quiet &&
            console.log('Reloading page to use the updated COOP/COEP worker.');
          window.sessionStorage.setItem('coiReloadedBySelf', 'updatefound');
          coi.doReload();
        });

        if (registration.active && !n.serviceWorker.controller) {
          !coi.quiet &&
            console.log('Reloading page to use the COOP/COEP worker.');
          window.sessionStorage.setItem('coiReloadedBySelf', 'notcontrolling');
          coi.doReload();
        }
      },
      (err) => {
        !coi.quiet &&
          console.error('COOP/COEP Service Worker failed to register:', err);
      }
    );
  })();
}
