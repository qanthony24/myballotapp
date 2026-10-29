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
| `candidates`, `elections`, `offices`, `ballotMeasures`, `surveyQuestions` | anyone | admins |
| `config/admin` | signed-in users | admins |
| Storage `candidates/{id}/*` (photos) | anyone | admins (images < 5 MB) |
| Anything else | denied | denied |

`/admin/*` and `/debug/ballot-feed` are also hidden behind an in-app admin check,
but that's only for convenience: the rules are what actually block writes.

## Cleaning stale data out of Firestore

The app merges Firestore over the bundled JSON. Firestore wins for any candidate
ID it has, and candidates that exist only in Firestore are still shown. So if
Firestore was seeded before the October 2026 cleanup, stale records (e.g. Bill
Cassidy on the November ballot, Sharon Weston Broome, Metro Council) will keep
showing up until they're removed. Use **Admin → Candidates** to delete them in
bulk, then use **Seed All Data to Firestore** on the Setup page to rewrite the
current records.

## Testing the rules

`tests/rules.test.mjs` checks 21 cases against the local Firebase emulator. Among them:
regular users can't write election data or promote themselves, unverified emails
can't pose as admins, and admins can still do their job. Instructions for running
it are at the top of the file. Run it before every rules deploy.
