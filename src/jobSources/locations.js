// Per-location routing hints. Adzuna requires one supported ISO country code per
// request (no continent-wide search); JSearch accepts a country hint but resolves
// free-text location itself. Unknown/unmapped names just skip Adzuna (it would 404)
// and let JSearch try on free text alone.
const LOCATION_META = {
  bengaluru: { adzunaCountry: 'in', adzunaWhere: 'Bengaluru', jsearchCountry: 'in' },
  india: { adzunaCountry: 'in', adzunaWhere: '', jsearchCountry: 'in' },
  dubai: { adzunaCountry: null, jsearchCountry: 'ae' },
  europe: { adzunaCountry: null, jsearchCountry: null },
  uk: { adzunaCountry: 'gb', adzunaWhere: '', jsearchCountry: 'gb' },
  'united kingdom': { adzunaCountry: 'gb', adzunaWhere: '', jsearchCountry: 'gb' },
  malta: { adzunaCountry: null, jsearchCountry: 'mt' },
  germany: { adzunaCountry: 'de', adzunaWhere: '', jsearchCountry: 'de' }
};

export function resolveLocations(raw) {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(label => ({ label, ...(LOCATION_META[label.toLowerCase()] || { adzunaCountry: null, jsearchCountry: null }) }));
}
