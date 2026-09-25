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
  const prompt = `
You are screening a job posting against a candidate's resume.

RESUME SUMMARY:
${resume.summary}
Skills: ${resume.skills.join(", ")}
Recent experience: ${resume.experience[0]?.bullets.join("; ")}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

Return ONLY a JSON object with this exact shape, no markdown:
{ "score": <integer 0-100, how well the candidate fits this job>,
  "reason": "<one sentence explaining the score>" }
`.trim();

  try {
    const result = await callGemini(prompt);
    return { score: Number(result.score) || 0, reason: result.reason || "" };
  } catch (e) {
    console.error("[scoreJob] error", e.message);
    return { score: 0, reason: "scoring failed" };
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
