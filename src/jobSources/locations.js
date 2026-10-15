// Per-location routing hints. Adzuna requires one supported ISO country code per
// request (no continent-wide search); JSearch accepts a country hint but resolves
// free-text location itself. indeedDomain is the country-specific Indeed site to
// scrape (in/uk work headless today; de/ae currently return a Cloudflare challenge
// so they're left wired up but will just yield 0 until that changes; omitted
// entirely where Indeed has no dedicated country site, e.g. Malta/Europe).
// Unknown/unmapped names just skip Adzuna (it would 404) and let JSearch try on
// free text alone.
const LOCATION_META = {
  bengaluru: { adzunaCountry: 'in', adzunaWhere: 'Bengaluru', jsearchCountry: 'in', indeedDomain: 'in.indeed.com' },
  india: { adzunaCountry: 'in', adzunaWhere: '', jsearchCountry: 'in', indeedDomain: 'in.indeed.com' },
  dubai: { adzunaCountry: null, jsearchCountry: 'ae', indeedDomain: 'ae.indeed.com' },
  europe: { adzunaCountry: null, jsearchCountry: null, indeedDomain: null },
  uk: { adzunaCountry: 'gb', adzunaWhere: '', jsearchCountry: 'gb', indeedDomain: 'uk.indeed.com' },
  'united kingdom': { adzunaCountry: 'gb', adzunaWhere: '', jsearchCountry: 'gb', indeedDomain: 'uk.indeed.com' },
  malta: { adzunaCountry: null, jsearchCountry: 'mt', indeedDomain: null },
  germany: { adzunaCountry: 'de', adzunaWhere: '', jsearchCountry: 'de', indeedDomain: 'de.indeed.com' }
};

export function resolveLocations(raw) {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(label => ({ label, ...(LOCATION_META[label.toLowerCase()] || { adzunaCountry: null, jsearchCountry: null }) }));
}
