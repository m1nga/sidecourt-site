/* First-party preference only; Cloudflare does not receive an account or device ID. */
(() => {
  'use strict';
  const key = 'sidecourt.analytics.exclude.v1';
  const status = document.querySelector('[data-traffic-status]');
  const excluded = () => { try { return localStorage.getItem(key) === '1'; } catch { return true; } };
  function show() {
    if (status) status.textContent = excluded()
      ? 'This browser is excluded from SideCourt visitor analytics.'
      : 'This browser is included in SideCourt visitor analytics.';
  }
  for (const button of document.querySelectorAll('[data-traffic-choice]')) {
    button.addEventListener('click', () => {
      try {
        if (button.dataset.trafficChoice === 'exclude') localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
        show();
      } catch {
        if (status) status.textContent = 'This browser could not save the preference. Analytics stays off while browser storage is unavailable.';
      }
    });
  }
  show();
  if (document.documentElement.hasAttribute('data-traffic-settings')) return;
  if (location.hostname !== 'sidecourt.space' || excluded()) return;
  // Separate owner, consent and authentication entry points are never instrumented.
  if (/^\/(?:admin|secret|connect-ai|sign-in)(?:\/|$)|^\/connect\.html$/.test(location.pathname)) return;
  if (/[#?&](?:access_token|refresh_token|token_hash|code|receipt)=/i.test(location.search + location.hash)) return;
  if (document.querySelector('script[data-cf-beacon]')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({token: 'ecd15df6bdeb4f06b2eb0917061ed493'});
  document.head.append(script);
})();
