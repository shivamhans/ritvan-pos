# Automatic database migrations

Create one JavaScript migration per schema change, named with a monotonically increasing prefix, for example \`001-add-product-source.js\`.

Each migration must export an asynchronous \`up({ connection, pool })\` function. Use parameterized SQL for values and make schema changes additive wherever possible. Never edit a migration after it has been applied; add a new migration instead.

The desktop app records migration names and SHA-256 checksums in \`ritvan_schema_migrations\`. Before each pending migration, it creates a complete \`mysqldump\` backup in the app's private user-data backup folder. If the backup command fails, the migration is not run. If a migration fails, startup stops rather than continuing against a partially updated schema.

Set \`MYSQLDUMP_PATH\` in the private \`.env\` file if \`mysqldump\` is not available on PATH. MySQL DDL may auto-commit, so backups are recovery points rather than transactional rollbacks. Test migrations against a copy of real data before publishing a release.
