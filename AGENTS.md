# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
MyBallot is a React/TypeScript single-page application (Vite 6) for East Baton Rouge Parish voters. There is no backend server; the app uses Firebase Auth + Firestore (hardcoded config) and pipeline-generated election data imported via `constants.tsx`.

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

The `data-pipeline/` directory contains a two-stage Node.js/TypeScript CLI:

1. **Extract + normalize** (`runner.ts`): Reads seed files or Google Civic API → produces `data/contests/*.json` (ContestV1 format).
2. **Adapt** (`seed-app.ts`): Converts ContestV1 → app data model → produces `data/app/candidates.json` and `data/app/ballot-measures.json`, which `constants.tsx` imports.

```bash
# Full pipeline: seed → contests → app data (no API key needed for manual source)
npx tsx data-pipeline/src/runner.ts --source manual
npx tsx data-pipeline/src/seed-app.ts

# Google Civic (when LA data becomes available)
GOOGLE_CIVIC_API_KEY=<key> npx tsx data-pipeline/src/runner.ts \
  --source google-civic --address "..." --election-id ...
npx tsx data-pipeline/src/seed-app.ts
```

See `docs/DATA_SOURCES.md` for full details. The debug route `/#/debug/ballot-feed` shows raw pipeline output. API keys must **never** be committed or sent to the browser. The pipeline uses file-based caching in `data/.cache/` (gitignored, 24h TTL).

**To add new candidates or races**: edit JSON seed files in `data/seed/`, then re-run the two pipeline commands above. For editorial content (bios, photos, survey responses), use the admin UI or CSV import.

**Key directories:**
- `data/seed/` — manual seed files (input, checked into git)
- `data/contests/` — normalized ContestV1 records (intermediate, checked into git)
- `data/app/` — app-ready JSON (output consumed by `constants.tsx`, checked into git)
