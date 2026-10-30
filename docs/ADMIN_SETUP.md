# Admin Setup

Admin access is enforced by **Firestore and Storage security rules**, not just the UI.
An admin is a signed-in user whose **verified** email appears in the Firestore
document `config/admin` → field `adminEmails` (array of lowercase strings).

- Google sign-in accounts are verified automatically.
- Email/password accounts are **not** verified unless they complete email
  verification, so they can't be admins. This prevents someone from registering
  an account under an admin's email address.

## One-time bootstrap (first admin)

Nobody can grant themselves admin from inside the app anymore, so the first
admin is added by hand:

1. Open the Firebase console → **Firestore Database** for project `myballot-app`.
2. Create (or edit) collection `config`, document `admin`.
3. Add a field `adminEmails` of type **array** with your email in lowercase,
   e.g. `qanthony24@gmail.com`.
4. Sign in to the app with Google using that email and visit `/#/admin`.

After that, admins can add or remove other admins from the **Admin: Setup** page.
Saving replaces the whole list, and the page warns you before you remove yourself.

## Deploying the rules

The rules live in `firestore.rules` and `storage.rules` and are wired up in
`firebase.json`. Deploy them with:

```bash
firebase deploy --only firestore:rules,storage
```

Do the bootstrap step **before** deploying, or you'll lock yourself out of the admin tools until you do.

## What the rules allow

| Data | Read | Write |
|---|---|---|
| `users/{uid}` and `users/{uid}/appData/*` | owner | owner |
| `candidates`, `elections`, `offices`, `ballotMeasures`, `surveyQuestions`, `races`, `results` | anyone | admins |
| `config/admin` | signed-in users | admins |
| Storage `candidates/{id}/*` (photos) | anyone | admins (images < 5 MB) |
| Anything else | denied | denied |

`/admin/*` and `/debug/ballot-feed` are also hidden behind an in-app admin check,
but that's only for convenience: the rules are what actually block writes.

## How election data flows (since Oct 29, 2026)

**The database (Firestore) is the source of truth.** The app starts from a copy
of the data bundled in the code, then loads the database on top of it and stays
subscribed. Your dashboard edits reach every screen within seconds, with no app
release. The last data loaded is cached on the device, so the app keeps working
offline.

- **Editing:** use the admin dashboard. Changes are live immediately. Clearing
  a field (e.g. removing an outdated photo or bio) really clears it: an empty
  value in the database wins over the bundled copy.
- **Deleting:** the dashboard marks a record `_deleted: true` instead of
  removing it, so the bundled copy can't bring it back. To undo a deletion,
  remove that field in the Firebase console, or re-save the record.
- **Bulk changes from the data pipeline** (seed files): run the pipeline, then
  **Admin → Setup → Publish bundled data**. Publishing only fills in or updates
  the fields the bundled data has. It never erases photos, bios, survey answers
  or deletions made in the dashboard.
- **Before an App Store build:** run `npm run data:snapshot` to refresh the
  bundled copy with exactly what the app currently shows (bundled data with
  database edits merged on top, deletions removed), then commit the result. This only
  matters for a brand-new install that has never been online.

A candidate with no elections ticked is hidden from voters. That's how the
House candidates from the suspended pre-Callais primaries are kept: still in
the database, but not on any ballot.

## Entering elections, races and results by hand

Start at **Admin → Elections, Races & Results** (`/#/admin/elections`).

1. **Offices** (`/#/admin/offices`): make sure every office on the ballot
   exists, and set each one's **district type** (statewide, State House
   district, and so on). Address → ballot will use that.
2. **Elections:** create the election. Early voting is pre-filled with the
   usual 14-to-7-days window; check it against the Secretary of State's
   calendar. The optional "coverage note" appears in the voter banner (e.g.
   "Partial ballot: …").
3. **Races** (Elections → *Races* button): add races one by one, or import a
   spreadsheet with one row per race:
   `office, district, district_key, seats, ballot_order, candidates`, where
   candidates look like `Jane Doe (R); John Roe (D)`. Re-importing is safe:
   races update, and a candidate with the same name, office and district is
   reused, not duplicated (that's also how runoff candidates carry over).
   Party codes: R, D, L, G, I, NP (No Party), NPT (Nonpartisan).
   - **District key** is a machine label like `la-house-61` that address →
     ballot will match against. You can leave it blank for now.
   - A race marked **Not saved yet** exists only because candidates are
     assigned to that office/district. Click *Save race* to make it real.
4. **Results** (Elections → *Enter results*): type vote counts per race, tick
   **Called** when a race is decided (the top vote-getters become winners), and
   tick **Published** when voters should see them. Published results update
   live on the voter Results pages within seconds of each save.

New candidates created here get IDs from 100000 up, so they never collide with
the data pipeline's IDs.

## Testing the rules

`tests/rules.test.mjs` checks 21 cases against the local Firebase emulator. Among them:
regular users can't write election data or promote themselves, unverified emails
can't pose as admins, and admins can still do their job. Instructions for running
it are at the top of the file. Run it before every rules deploy.
