import Database from 'better-sqlite3';

const db = new Database('job-agent.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    source TEXT,
    title TEXT,
    company TEXT,
    url TEXT,
    description TEXT,
    match_score INTEGER,
    match_reason TEXT,
    match_highlights TEXT,
    missing_keywords TEXT,
    fingerprint TEXT,
    status TEXT DEFAULT 'new',        -- new -> scored -> tailored -> ready_for_review -> applied -> skipped
    resume_path TEXT,
    cover_letter_path TEXT,
    screenshot_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const existingColumns = db.prepare("PRAGMA table_info(jobs)").all().map(c => c.name);
for (const col of ['match_highlights', 'missing_keywords', 'fingerprint']) {
  if (!existingColumns.includes(col)) {
    db.exec(`ALTER TABLE jobs ADD COLUMN ${col} TEXT`);
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_fingerprint ON jobs(fingerprint)');

export function jobExists(id) {
  return !!db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
}

// Same posting often shows up from multiple sources (Adzuna, JSearch's aggregated
// LinkedIn/Glassdoor/etc., the Indeed scraper) under different IDs. A normalized
// title+company fingerprint catches that cross-source/cross-day duplicate so it
// isn't scored and emailed more than once.
export function fingerprint(job) {
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${norm(job.title)}::${norm(job.company)}`;
}

export function fingerprintExists(fp) {
  return !!db.prepare('SELECT 1 FROM jobs WHERE fingerprint = ?').get(fp);
}

export function insertJob(job) {
  db.prepare(`
    INSERT INTO jobs (id, source, title, company, url, description, fingerprint)
    VALUES (@id, @source, @title, @company, @url, @description, @fingerprint)
  `).run({ ...job, fingerprint: fingerprint(job) });
}

export function updateJob(id, fields) {
  const keys = Object.keys(fields);
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE jobs SET ${setClause} WHERE id = @id`).run({ id, ...fields });
}

export function getJobsByStatus(status) {
  return db.prepare('SELECT * FROM jobs WHERE status = ?').all(status);
}

export default db;
