/**
 * Migration CLI: `pnpm db:migrate` / `pnpm db:reset`.
 * Uses the mounted RDS credentials in the cluster, or DATABASE_URL for local
 * development and CI.
 */
import { databaseUrlFromSecretFile, defaultCredentialsFile } from './credentials.js';
import { closeDb, initDb } from './pool.js';
import { migrate, reset } from './migrate.js';

const credentialsFile =
  process.env.DATABASE_SECRET_FILE ?? defaultCredentialsFile;

const url = process.env.DATABASE_SECRET_FILE
  ? databaseUrlFromSecretFile(credentialsFile)
  : process.env.DATABASE_URL ?? databaseUrlFromSecretFile(credentialsFile);
if (!url) {
  console.error(
    `MySQL connection settings are incomplete. Expected mounted username/password plus DATABASE_HOST, DATABASE_PORT, and DATABASE_NAME: ${credentialsFile}`,
  );
  process.exit(1);
}

const command = process.argv[2] ?? 'migrate';
// The migration image includes the Amazon RDS CA bundle. In QA and production
// DATABASE_SSL=true makes mysql2 verify the RDS server certificate.
initDb({ connectionString: url, ssl: process.env.DATABASE_SSL === 'true' });

try {
  if (command === 'migrate') {
    const res = await migrate();
    console.log(
      res.applied.length ? `applied: ${res.applied.join(', ')}` : 'no pending migrations',
    );
  } else if (command === 'reset') {
    await reset();
    const res = await migrate();
    console.log(`reset complete; applied: ${res.applied.join(', ')}`);
  } else {
    console.error(`unknown command: ${command}`);
    process.exit(1);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
