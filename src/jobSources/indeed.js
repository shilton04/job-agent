import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Indeed has no public API, so this scrapes the public (no-login) search results page.
 * Only `in.indeed.com` and `uk.indeed.com` are reliably reachable headless today —
 * `de.indeed.com`/`ae.indeed.com` return a Cloudflare JS challenge instead of results,
 * and Naukri/LinkedIn block headless browsers outright (Akamai wall / login redirect),
 * so those are not scraped at all. Treat this as best-effort: Indeed can start
 * challenging this traffic too at any time, in which case it degrades to 0 results
 * rather than breaking the run.
 */
export async function fetchIndeedJobs(keywords, { indeedDomain, label }) {
  if (!indeedDomain) return [];

  const query = keywords.join(' OR ');
  const url = `https://${indeedDomain}/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(label)}&fromage=7`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!res || res.status() >= 400) {
      console.warn(`[indeed] blocked for "${label}" (status ${res?.status()})`);
      return [];
    }
    await page.waitForTimeout(1500);

    return await page.evaluate(() => {
      return [...document.querySelectorAll('.job_seen_beacon')].map(card => {
        const titleEl = card.querySelector('h2.jobTitle a, h3.jobTitle a');
        const jk = titleEl?.getAttribute('data-jk');
        if (!jk) return null;
        const companyEl = card.querySelector('[data-testid="company-name"]');
        const snippetEl = card.querySelector('[data-testid="jobsnippet_footer"], .job-snippet');
        return {
          id: `indeed_${jk}`,
          source: 'indeed',
          title: titleEl.innerText.trim(),
          company: companyEl?.innerText?.trim() || 'Unknown',
          url: `https://${location.hostname}/viewjob?jk=${jk}`,
          description: snippetEl?.innerText?.trim() || ''
        };
      }).filter(Boolean);
    });
  } catch (e) {
    console.error(`[indeed] error for "${label}"`, e.message);
    return [];
  } finally {
    await browser.close();
  }
}
