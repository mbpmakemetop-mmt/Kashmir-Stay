/* ═══════════════════════════════════════════════════════════════
   AUTHENTICATION FIX — Firebase v9 modular SDK version
   ═══════════════════════════════════════════════════════════════
   Rewritten because the old version called firebase.auth() /
   firebase.firestore() (v8 compat API). This app loads Firebase v9
   modular SDK from gstatic CDN — the global `firebase` object never
   existed here, so every function in the old file silently threw
   "ReferenceError: firebase is not defined" on every page load.

   This version reuses window._auth / window._db / window._authFns /
   window._collections, which index.html's own module script already
   creates — so it adds ONLY the useful extras (token refresh +
   business-ownership sync) without a second sign-in flow or auth
   listener that could fight with the app's own googleAuth().
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sync businesses when the owner's email matches the logged-in user's
 * email but was saved under a different user_id (e.g. business added
 * before the owner ever logged in). Fixes "my business not visible
 * in dashboard" bugs.
 */
async function syncUserBusinesses(user) {
  if (!user || !user.email || !window._db || !window._collections) return;

  try {
    const { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } = window._collections;

    const businessesQuery = query(
      collection(window._db, 'businesses'),
      where('user_email', '==', user.email)
    );
    const snap = await getDocs(businessesQuery);

    const toFix = snap.docs.filter(docSnap => docSnap.data().user_id !== user.uid);
    if (toFix.length === 0) return;

    console.log(`Found ${toFix.length} business(es) to sync to this account`);
    for (const docSnap of toFix) {
      await updateDoc(doc(window._db, 'businesses', docSnap.id), {
        user_id: user.uid,
        synced_at: serverTimestamp()
      });
    }
    console.log('✓ Businesses synced to user account');
  } catch (error) {
    console.error('Business sync failed:', error);
    // Don't throw — let the user continue even if sync fails
  }
}

/**
 * Keep the ID token fresh so long sessions don't silently expire.
 */
function setupTokenRefresh() {
  setInterval(async () => {
    const user = window._auth?.currentUser;
    if (user) {
      try {
        await user.getIdToken(true);
        console.log('✓ Token auto-refreshed');
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }
  }, 50 * 60 * 1000); // every 50 minutes
}

// Hook into the SAME auth instance the app already uses. This adds a
// second, lightweight listener alongside the app's own — it does not
// replace or interfere with index.html's onAuthStateChanged UI logic.
(function initAuthFix() {
  const tryInit = () => {
    if (!window._auth || !window._authFns?.onAuthStateChanged) {
      setTimeout(tryInit, 200); // index.html's module script hasn't finished yet — retry shortly
      return;
    }
    window._authFns.onAuthStateChanged(window._auth, (user) => {
      if (user) syncUserBusinesses(user);
    });
    setupTokenRefresh();
    console.log('✓ auth-fix.js (v9) initialized');
  };
  tryInit();
})();
