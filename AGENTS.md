# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
MyBallot is a React/TypeScript single-page application (Vite 6) and Louisiana voter guide (2027 launch target: statewide races + East Baton Rouge Parish). There is no backend server; the app uses Firebase Auth + Firestore (hardcoded config). Election data is read through `services/electionDataStore.ts`: it starts from the pipeline-generated snapshot bundled via `constants.tsx`, then applies live Firestore data (the source of truth) on top, with an offline cache. Screens re-render via `useElectionData()`. See `docs/ADMIN_SETUP.md` → "How election data flows".

### Dev server
```
npm run dev -- --host 0.0.0.0 --port 5173
```
The app is served at `http://localhost:5173/`. See `package.json` for standard scripts (`dev`, `build`, `preview`).

### Key gotchas

- **Vite config filename**: The config file is `vite.config.ts` (not `.tsx`). Vite 6 does not discover `.tsx` config files.
- **Env vars**: client code reads `import.meta.env.VITE_*` only (e.g. `VITE_UI_REFRESH`). Anything `VITE_*` is bundled publicly — never put secrets there.
- **Static files** (icons, `manifest.json`, `data/news/feed.json`, `data/results/elections.json`) live in `public/` so they exist in production builds.
- **TypeScript strict errors**: `npx tsc --noEmit` reports pre-existing errors (unused imports, implicit `any` types). These do not affect the Vite dev server or build, which use esbuild for transpilation.
- **Tests**: `npm run test:data` (data-merge rules) and `tests/rules.test.mjs` (security rules, needs the Firebase emulator; see `docs/ADMIN_SETUP.md`). No UI tests yet.
- **No ESLint**: The project does not have ESLint configured.
- **Firebase Auth**: Login/signup features require the Firebase project (`myballot-app`) to be active and accept requests from `localhost`. Auth-gated pages (`/my-ballot`, `/profile`, `/onboarding`) redirect to `/auth` when not logged in.
- **No AI Q&A**: earlier docs mentioned Gemini Q&A; it was never implemented and the dependency was removed. If added later, it must call a server-side function (never ship an API key) and answer only from vetted data.

### Data pipeline

The `data-pipeline/` directory contains a two-stage Node.js/TypeScript CLI:

1. **Extract + normalize** (`runner.ts`): Reads seed files or Google Civic API → produces `data/contests/*.json` (ContestV1 format).
2. **Adapt** (`seed-app.ts`): Converts ContestV1 → app data model → produces `data/app/candidates.json` and `data/app/ballot-measures.json` (the bundled snapshot that `constants.tsx` imports).
3. **Publish**: Admin → Setup → "Publish bundled data" pushes the snapshot into Firestore (merge; never erases dashboard edits). `npm run data:snapshot` goes the other way (Firestore → snapshot) before release builds.

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
