/**
 * Encrypts your database URI and admin login into secrets.sealed (safe to commit).
 *
 *   npm run seal -- --generate-key          # prints a new APP_SECRET_KEY (save it!)
 *
 *   APP_SECRET_KEY=<key> MONGODB_URI=<uri> ADMIN_USERNAME=administer \
 *   ADMIN_PASSWORD=<password> ADMIN_PIN=off npm run seal
 *
 * Only the variables you pass are stored. Anything missing keeps its previous value.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { seal, unseal, SEALED_FILE, SEALED_KEYS } from '../server/secrets';

if (process.argv.includes('--generate-key')) {
  console.log(randomBytes(32).toString('base64url'));
  process.exit(0);
}

const key = process.env.APP_SECRET_KEY || '';
if (!key) {
  console.error('Set APP_SECRET_KEY first (use --generate-key to make one).');
  process.exit(1);
}

const previous = existsSync(SEALED_FILE) ? unseal(key, readFileSync(SEALED_FILE, 'utf8')) : {};
const values: Record<string, string> = { ...previous };
for (const k of SEALED_KEYS) if (process.env[k] !== undefined) values[k] = process.env[k]!.trim();
if (!Object.keys(values).length) {
  console.error('Nothing to seal: pass at least one of ' + SEALED_KEYS.join(', '));
  process.exit(1);
}

const text = seal(key, values);
// Check the round trip before writing anything.
if (JSON.stringify(unseal(key, text)) !== JSON.stringify(values)) throw new Error('Round-trip check failed');
writeFileSync(SEALED_FILE, text);
console.log(`Wrote secrets.sealed with: ${Object.keys(values).join(', ')}`);
