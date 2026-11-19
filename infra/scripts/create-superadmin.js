const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const dependencies = process.env.MAXX_BACKEND_DIR || path.join(__dirname, '..', 'backend');

async function main() {
  const [email, name, phone] = process.argv.slice(2);
  const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (!email || !name || !password) throw new Error('Email, name and password are required.');
  for (const key of ['PGUSER', 'PGDATABASE']) {
    if (!process.env[key]) throw new Error(`Set ${key} for the target PostgreSQL database.`);
  }
  const bcrypt = require(require.resolve('bcryptjs', { paths: [dependencies] }));
  const { Client } = require(require.resolve('pg', { paths: [dependencies] }));
  const hash = await bcrypt.hash(password, 12);
  const db = new Client();
  await db.connect();
  try {
    await db.query('BEGIN');
    const { rows: [user] } = await db.query(
      `INSERT INTO users (uuid, email, phone_number, password_hash, full_name, status, phone_verified, auth_method, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $3 IS NOT NULL, 'PASSWORD', now(), now())
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
         phone_number = coalesce(EXCLUDED.phone_number, users.phone_number), status = 'ACTIVE',
         auth_method = 'PASSWORD', updated_at = now()
       RETURNING id`, [randomUUID(), email, phone || null, hash, name]);
    const roles = ['SUPER_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_ADMIN'];
    await db.query(`INSERT INTO roles (name, description) SELECT name, 'Administrator' FROM unnest($1::text[]) AS r(name)
      ON CONFLICT (name) DO NOTHING`, [roles]);
    await db.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2)
      ON CONFLICT DO NOTHING`, [user.id, roles]);
    await db.query(`INSERT INTO profiles (user_id, name, kids_profile, created_at, updated_at)
      SELECT $1, $2, false, now(), now() WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = $1)`, [user.id, name]);
    await db.query('COMMIT');
    console.log(`Super admin is ready: ${email}`);
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`Could not create super admin: ${error.message}`);
  process.exitCode = 1;
});
