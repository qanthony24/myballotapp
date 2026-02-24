# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
MyBallot is a React/TypeScript single-page application (Vite 6) for East Baton Rouge Parish voters. There is no backend server; the app uses Firebase Auth + Firestore (hardcoded config) and static mock data in `constants.tsx`.

### Dev server
```
npm run dev -- --host 0.0.0.0 --port 5173
```
The app is served at `http://localhost:5173/`. See `package.json` for standard scripts (`dev`, `build`, `preview`).

### Key gotchas

- **Vite config filename**: The config file is `vite.config.ts` (not `.tsx`). Vite 6 does not discover `.tsx` config files.
- **`process.env` in dev mode**: Vite 6's built-in `vite:define` plugin skips client-side code in dev mode. A custom `processEnvPlugin` in `vite.config.ts` handles `process.env.*` replacement in dev mode. Do not remove it.
- **Tailwind CDN load order**: In `index.html`, the Tailwind CDN script must load **before** `tailwind.config.js` so the `tailwind` global exists when the config file runs.
- **TypeScript strict errors**: `npx tsc --noEmit` reports pre-existing errors (unused imports, implicit `any` types). These do not affect the Vite dev server or build, which use esbuild for transpilation.
- **No test suite**: The project has no test framework or test files configured.
- **No ESLint**: The project does not have ESLint configured.
- **Firebase Auth**: Login/signup features require the Firebase project (`myballot-app`) to be active and accept requests from `localhost`. Auth-gated pages (`/my-ballot`, `/profile`, `/onboarding`) redirect to `/auth` when not logged in.
- **Gemini AI Q&A**: Optional. Requires a `GEMINI_API_KEY` in a `.env` file. Without it, the rest of the app works normally.

### Data pipeline

The `data-pipeline/` directory contains a Node.js/TypeScript CLI for fetching ballot data from the Google Civic Information API. See `docs/DATA_SOURCES.md` for full details.

```bash
# List available elections
GOOGLE_CIVIC_API_KEY=<key> npx tsx data-pipeline/src/runner.ts --list-elections

# Fetch and normalize contest data
GOOGLE_CIVIC_API_KEY=<key> npx tsx data-pipeline/src/runner.ts \
  --address "600 E Trade St Charlotte NC" --election-id 9505
```

Output goes to `data/contests/`. The debug route at `/#/debug/ballot-feed` reads these JSON files. The API key must **never** be committed or sent to the browser. The pipeline uses file-based caching in `data/.cache/` (gitignored, 24h TTL).
