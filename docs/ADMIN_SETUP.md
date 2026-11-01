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
   - **District key** decides which voters see the race (address → ballot,
     below). It's automatic for offices whose district type is statewide,
     U.S. House, State Senate or State House: "State Representative,
     District 61" becomes `la-house-61`. Other races need one typed in (see
     the key formats below), or voters see them as "might be on your ballot".
   - A race marked **Not saved yet** exists only because candidates are
     assigned to that office/district. Click *Save race* to make it real.
4. **Results** (Elections → *Enter results*): type vote counts per race, tick
   **Called** when a race is decided (the top vote-getters become winners), and
   tick **Published** when voters should see them. Published results update
   live on the voter Results pages within seconds of each save.

New candidates created here get IDs from 100000 up, so they never collide with
the data pipeline's IDs.

## Address → ballot (how voters see only their races)

Voters enter their address (or tap "Use my location") on the Candidates or My
Ballot page. The app asks the U.S. Census Bureau's free geocoder which
districts that address is in. In parishes that publish official district maps
(East Baton Rouge: maps.brla.gov; Ascension: gis.ascensionparishla.gov) it also
asks those for the local ones, sending only the map point, never the address. The result is saved **on the
voter's device only**. Candidates whose race is definitely not on their ballot
are hidden; races the app can't match stay visible as "might be on your ballot".
If a map service is down, its races fall back to "might be", never to hidden.

### District keys

From the Census (every Louisiana address):

| District | Key format | Example |
|---|---|---|
| Statewide | `la` | `la` |
| U.S. House (current map) | `la-cd-N` | `la-cd-6` |
| State Senate | `la-sen-N` | `la-sen-14` |
| State House | `la-house-N` | `la-house-67` |
| Parish | `parish-<name>` | `parish-east-baton-rouge` |
| City/town | `city-<name>` | `city-baton-rouge`, `city-st-george` |
| Parish council / police jury (**approximate**) | `pj-<parish>-N` | `pj-pointe-coupee-8` |
| BESE (Legislature block files) | `la-bese-N` | `la-bese-8` |
| Public Service Commission | `la-psc-N` | `la-psc-3` |
| Supreme Court | `la-supreme-N` | `la-supreme-2` |

The State Senate district uses the 2026 plan (Act 955) even where the Census
hasn't caught up yet (a few hundred blocks in Concordia, Morehouse and
Ouachita; see `services/planOverrides.ts`).

`pj-` keys come from the Census "county subdivisions", which in Louisiana are
the council/police jury districts. They matched the official maps at 38 of 39
test points in EBR and Ascension, so they're treated as approximate: a race
with the voter's `pj-` key is marked as on their ballot, but races in the
parish's other districts are never hidden (shown as "might be on your
ballot"). Use them for police jury and council races in parishes without
official maps: give the office the prefix `pj-west-feliciana`, for example.

From East Baton Rouge City-Parish maps (EBR addresses only, for now):

| District | Key format | Example |
|---|---|---|
| Metro Council | `ebr-council-N` | `ebr-council-10` |
| Baker / Central / Zachary city council | `city-baker-council-N` etc. | `city-central-council-4` |
| School board (EBR, Central, Baker, Zachary) | `ebr-school-N`, `central-school-N`, `baker-school-N`, `zachary-school-N` | `ebr-school-5` |
| 19th JDC judge, by division | `jdc-19-div-<letter>` | `jdc-19-div-d` |
| Baton Rouge City Court judge, by division | `br-city-court-div-<letter>` | `br-city-court-div-b` |
| Voting precinct | `ebr-precinct-<ward>-<precinct>` | `ebr-precinct-1-086` |

From Ascension Parish maps (Ascension addresses only):

| District | Key format | Example |
|---|---|---|
| Parish Council | `asc-council-N` | `asc-council-10` |
| School board (multi-seat districts like 7A/7B share one key) | `asc-school-N` | `asc-school-7` |
| Ward (for JP/constable once those offices are set up) | `asc-ward-<ward>` | `asc-ward-07g` |
| Voting precinct | `asc-precinct-N` | `asc-precinct-58` |

Inside EBR and Ascension the city comes from the parish's own city limits,
which are more current than the Census (EBR's already include St. George).

### Keys you don't have to type

A race's key is filled in automatically from its office:

- District type **statewide, U.S. House, State Senate, State House, BESE, PSC
  or Supreme Court**, plus the district number: "BESE Member, District 8" →
  `la-bese-8`.
- Or the office's **key prefix** (Admin → Offices) plus the district number or
  letter: Metro Council has prefix `ebr-council`, so "District 10" →
  `ebr-council-10`. A 19th JDC office with prefix `jdc-19-div` turns
  "Division D" into `jdc-19-div-d`. An office with a prefix and no district
  (e.g. Central Mayor, prefix `city-central`) uses the prefix as is.

Built-in prefixes: Metro Council `ebr-council`, School Board Member
`ebr-school`, City Court Judge `br-city-court-div`. If you add offices for
another parish, give them their own prefix or type the key on each race.

Parishwide races (sheriff, assessor, clerk) use `parish-<name>`; at-large city
races use `city-<name>`.

### BESE, PSC and Supreme Court (every parish)

These come from the Legislature's official block equivalency files (each
census block → district for the enacted plan). The Census lookup already
tells us the voter's block, so the match is exact. The tables live in
`public/data/districts/` (one small file per parish) and are rebuilt with:

```bash
npm run data:districts
```

Run it again, and commit the output, whenever the Legislature enacts a new
BESE, PSC or Supreme Court plan (update the file paths at the top of
`scripts/build-district-blocks.mts`). Until the tables exist, those races show
as "might be on your ballot".

**Not yet matchable:** school board and judicial districts in parishes
without official maps, and JP and constable districts (except Ascension wards). Those races
show to everyone in the election as "might be on your ballot".

## News comments and moderation

Signed-in users with a verified email (Google accounts are verified
automatically) can react to news articles and comment. Comments post
immediately, except these are **held** (hidden from everyone but the author)
until an admin reviews them at **Admin → Comments** (`/#/admin/comments`):

- comments containing a link or flagged language, or that look like spam;
- a sixth comment within 10 minutes from the same person;
- any comment reported by 3 different users.

Approve, Remove, or Remove & ban. A banned user (Firestore `bannedUsers/{uid}`)
can still read but can't react, comment or report. To unban, delete their
document in `bannedUsers` in the Firebase console. Users can also block a
commenter, which hides that person's comments on their own device.

Comments show a first name and last initial from the account (or "Voter
1a2b"), never an email address. Reactions are private; only totals are public.
App Store and Google Play require exactly these tools (report, block, filter,
remove) for apps with user comments.

## Testing the rules

`tests/rules.test.mjs` checks 21 cases against the local Firebase emulator. Among them:
regular users can't write election data or promote themselves, unverified emails
can't pose as admins, and admins can still do their job. Instructions for running
it are at the top of the file. Run it before every rules deploy.
