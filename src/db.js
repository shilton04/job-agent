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
    status TEXT DEFAULT 'new',        -- new -> scored -> tailored -> ready_for_review -> applied -> skipped
    resume_path TEXT,
    cover_letter_path TEXT,
    screenshot_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export function jobExists(id) {
  return !!db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
}

export function insertJob(job) {
  db.prepare(`
    INSERT INTO jobs (id, source, title, company, url, description)
    VALUES (@id, @source, @title, @company, @url, @description)
  `).run(job);
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
