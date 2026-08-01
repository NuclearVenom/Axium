import { app } from "./app.js";
import { countConfiguredKeys } from "./integrations/groqClient.js";

/**
 * Local development / traditional-hosting entry point. Not used on
 * Vercel — there, /api/index.ts at the repo root imports the same `app`
 * from app.ts directly and Vercel itself handles the listening/routing.
 */
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Axium server listening on http://localhost:${PORT}`);
  const keyCount = countConfiguredKeys();
  if (keyCount === 0) {
    console.warn(
      "No GROQ_API_KEY_1 (or _2, _3, ...) is set — Axium's knowledge engine cannot generate graphs until at least one is. The AI tutor will also be unavailable."
    );
  } else if (keyCount > 1) {
    console.log(`Found ${keyCount} Groq API keys — requests will automatically fall back across them if one is rate-limited.`);
  }
});
