// Historically this mirrored a changed super-admin password back into the .env
// file so the boot-time seeder would not revert it. The seeder
// (ensureDefaultAdminAccount) only sets a password when CREATING the default
// admin and never overwrites an existing admin's password, so that mirroring is
// unnecessary. Persisting a live, user-chosen password in plaintext on disk is a
// security risk (CWE-256/312), so this is now a deliberate no-op kept only for
// call-site compatibility. The bcrypt hash in the DB is the single source of truth.
const syncDefaultAdminPassword = async () => false;

module.exports = { syncDefaultAdminPassword };
