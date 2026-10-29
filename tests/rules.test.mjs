/**
 * Security rules tests for firestore.rules and storage.rules.
 *
 * Run from the repo root (needs Java installed for the Firebase emulator):
 *
 *   npm i --no-save @firebase/rules-unit-testing@3 firebase@10
 *   npx firebase-tools emulators:exec --only firestore,storage --project demo-myballot "node tests/rules.test.mjs"
 *
 * Exits non-zero if any check fails.
 */
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
const env = await initializeTestEnvironment({
  projectId: 'demo-myballot',
  firestore: { rules: readFileSync('firestore.rules','utf8'), host:'127.0.0.1', port:8080 },
  storage: { rules: readFileSync('storage.rules','utf8'), host:'127.0.0.1', port:9199 },
});
await env.withSecurityRulesDisabled(async ctx => {
  await ctx.firestore().doc('config/admin').set({ adminEmails: ['admin@example.com'] });
  await ctx.firestore().doc('candidates/1').set({ id: 1, firstName: 'A' });
});
const anon = env.unauthenticatedContext().firestore();
const user = env.authenticatedContext('u1', { email: 'joe@example.com', email_verified: true }).firestore();
const spoof = env.authenticatedContext('u2', { email: 'admin@example.com', email_verified: false }).firestore();
const admin = env.authenticatedContext('u3', { email: 'Admin@Example.com', email_verified: true }).firestore();
let pass=0, fail=0;
async function t(name, p){ try { await p; console.log('PASS', name); pass++; } catch(e){ console.log('FAIL', name, e.message); fail++; } }
await t('anon reads candidates', assertSucceeds(anon.doc('candidates/1').get()));
await t('anon cannot write candidates', assertFails(anon.doc('candidates/2').set({x:1})));
await t('user cannot write candidates', assertFails(user.doc('candidates/1').set({x:1})));
await t('user cannot delete candidates', assertFails(user.doc('candidates/1').delete()));
await t('user cannot make self admin', assertFails(user.doc('config/admin').set({adminEmails:['joe@example.com']})));
await t('unverified email spoof cannot write', assertFails(spoof.doc('candidates/1').set({x:1})));
await t('unverified spoof cannot edit config', assertFails(spoof.doc('config/admin').set({adminEmails:['x']})));
await t('admin (case-insensitive) writes candidates', assertSucceeds(admin.doc('candidates/1').set({id:1, firstName:'B'})));
await t('admin writes ballotMeasures', assertSucceeds(admin.doc('ballotMeasures/9').set({id:9})));
await t('admin writes elections/offices/surveyQuestions', assertSucceeds(Promise.all([admin.doc('elections/1').set({a:1}),admin.doc('offices/1').set({a:1}),admin.doc('surveyQuestions/q').set({a:1})])));
await t('admin edits config', assertSucceeds(admin.doc('config/admin').set({adminEmails:['admin@example.com','b@example.com']})));
await t('anon cannot read config', assertFails(anon.doc('config/admin').get()));
await t('user reads config', assertSucceeds(user.doc('config/admin').get()));
await t('user own profile rw', assertSucceeds(user.doc('users/u1').set({a:1})));
await t('user own appData rw', assertSucceeds(user.doc('users/u1/appData/ballot').set({a:1})));
await t('user cannot read other profile', assertFails(user.doc('users/u3').get()));
await t('unknown collection denied', assertFails(admin.doc('random/x').set({a:1})));
// storage
const sUser = env.authenticatedContext('u1', { email: 'joe@example.com', email_verified: true }).storage();
const sAdmin = env.authenticatedContext('u3', { email: 'admin@example.com', email_verified: true }).storage();
const img = new Uint8Array([1,2,3]);
await t('user cannot upload photo', assertFails(sUser.ref('candidates/1/photo.jpg').put(img, {contentType:'image/jpeg'})));
await t('admin uploads photo', assertSucceeds(sAdmin.ref('candidates/1/photo.jpg').put(img, {contentType:'image/jpeg'})));
await t('admin cannot upload non-image', assertFails(sAdmin.ref('candidates/1/x.txt').put(img, {contentType:'text/plain'})));
await t('anon reads photo', assertSucceeds(env.unauthenticatedContext().storage().ref('candidates/1/photo.jpg').getDownloadURL()));
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail?1:0);
