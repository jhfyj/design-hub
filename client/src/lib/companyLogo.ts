// Greenhouse/Ashby give no logo image — simpleicons.org's slug convention
// usually matches a company's own name closely enough to work without a
// lookup table. Callers should always pair this with an <img onError>
// fallback (e.g. a plain letter avatar) for misses. Prefer domainLogoUrl
// below whenever an actual domain is known (e.g. from company-search) —
// it's a real lookup, not a guess.
export function companyLogoUrl(company: string): string {
  return `https://cdn.simpleicons.org/${company.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

// Google's favicon service, keyed by a company's real domain (e.g. from the
// company-search autocomplete) — far more reliable than guessing a slug from
// the display name, since it works for any registered domain.
export function domainLogoUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
