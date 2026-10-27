import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type MysqlCredentials = {
  username?: string;
  password?: string;
};

export const defaultCredentialsFile = join(
  process.cwd(),
  'secrets',
  'mysql-credentials.json',
);

/**
 * Builds a connection URL without ever logging credential fields. RDS-managed
 * Secrets contain only username/password; endpoint, port and database name
 * are intentionally ordinary deployment configuration.
 */
export function databaseUrlFromSecretFile(
  credentialsFile = process.env.DATABASE_SECRET_FILE ?? defaultCredentialsFile,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!existsSync(credentialsFile)) return undefined;
  try {
    const value = JSON.parse(readFileSync(credentialsFile, 'utf8')) as MysqlCredentials;
    const host = env.DATABASE_HOST;
    const port = env.DATABASE_PORT ?? '3306';
    const database = env.DATABASE_NAME;
    if (!host || !value.username || value.password === undefined || !database) return undefined;
    return `mysql://${encodeURIComponent(value.username)}:${encodeURIComponent(value.password)}@${host}:${port}/${encodeURIComponent(database)}`;
  } catch {
    return undefined;
  }
}
