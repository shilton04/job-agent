import fetch from "node-fetch";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt, attempt = 1) {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
      const delay =
        BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
      console.warn(
        `[gemini] ${res.status} (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms`,
      );
      await sleep(delay);
      return callGemini(prompt, attempt + 1);
    }
    throw new Error(`Gemini request failed: ${res.status} ${bodyText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

export async function scoreJob(resume, job) {
  const experienceText = resume.experience
    .map(e => `- ${e.role} @ ${e.company} (${e.start}–${e.end}): ${e.bullets.join("; ")}`)
    .join("\n");
  const projectsText = (resume.projects || [])
    .map(p => `- ${p.name} (${p.stack}): ${p.description}`)
    .join("\n");

  const prompt = `
You are an experienced technical recruiter doing the FIRST-PASS resume/ATS screen for a job posting —
your job is to predict whether this candidate would actually survive that screen, not to give a generous
"could theoretically do this" rating.

RESUME SUMMARY:
${resume.summary}
Skills: ${resume.skills.join(", ")}
Experience:
${experienceText}
Projects:
${projectsText}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

Scoring rubric (apply strictly):
- Identify the job's explicit MUST-HAVE requirements (required skills, years of experience, seniority level)
  separately from nice-to-haves. Weigh must-haves far more heavily.
- If the role's seniority (e.g. Senior/Lead/Staff, or an explicit years-of-experience minimum) clearly exceeds
  this candidate's ~2 years of experience, cap the score low (below 40) regardless of skill overlap — a resume
  screen filters on seniority/years first.
- If 2+ must-have technologies are absent from both skills and experience/projects, the score should not exceed 60.
- A score above 80 should mean: right seniority band, and nearly all must-haves are demonstrably present.
- Do not reward vague thematic similarity ("both are web dev") — score on concrete requirement overlap.

Return ONLY a JSON object with this exact shape, no markdown:
{ "score": <integer 0-100, realistic probability of passing an initial resume/ATS screen>,
  "reason": "<one sentence citing the specific must-have match or mismatch driving the score>",
  "highlights": ["<specific resume skill/experience/project to emphasize for this job>", "<up to 4 total>"],
  "missingKeywords": ["<required skill/technology explicitly in the JD but absent from the resume>", "<up to 5 total>"] }
`.trim();

  try {
    const result = await callGemini(prompt);
    return {
      score: Number(result.score) || 0,
      reason: result.reason || "",
      highlights: Array.isArray(result.highlights) ? result.highlights : [],
      missingKeywords: Array.isArray(result.missingKeywords) ? result.missingKeywords : []
    };
  } catch (e) {
    console.error("[scoreJob] error", e.message);
    return { score: 0, reason: "scoring failed", highlights: [], missingKeywords: [] };
  }
}

export async function tailorResumeAndCoverLetter(resume, job) {
  const prompt = `
You are tailoring a candidate's resume and writing a cover letter for one specific job.
Keep every fact truthful — do not invent skills, employers, or experience that isn't in the original resume.
You may reorder, re-emphasize, and rephrase existing content to better match the job.

ORIGINAL RESUME (JSON):
${JSON.stringify(resume, null, 2)}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

Return ONLY a JSON object with this exact shape, no markdown:
{
  "resume": { ...same shape as the original resume JSON, with "summary" and each experience entry's "bullets" reworded/reordered for this job... },
  "coverLetter": "<a concise 3-paragraph cover letter as plain text>"
}
`.trim();

  return callGemini(prompt);
}
