/**
 * Multi-domain routing helpers.
 *
 * Production:
 *   - masjidlab.com / www.masjidlab.com  → Vitrine (landing)
 *   - app.masjidlab.com                  → Application (dashboard)
 *
 * Development / Preview:
 *   - /vitrine route still works as fallback
 *   - All other routes serve the app
 */

const VITRINE_HOSTS = ["masjidlab.com", "www.masjidlab.com"];
const APP_HOST = "app.masjidlab.com";

export function isVitrineDomain(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.includes("masjidlab.com") || hostname === "localhost";
}

export function isAppDomain(): boolean {
  const host = window.location.hostname;
  // app.masjidlab.com OR any dev/preview domain
  return host === APP_HOST || !VITRINE_HOSTS.includes(host);
}

export function getVitrineUrl(path = "/"): string {
  return `https://masjidlab.com${path}`;
}

export function getAppUrl(path = "/"): string {
  return `https://app.masjidlab.com${path}`;
}
