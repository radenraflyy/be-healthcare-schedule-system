import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const email = 'admin@rata.test';
const password = 'RataDemo!2026';
const databaseUrl =
  process.env.AUTH_DATABASE_URL_LOCAL ?? process.env.AUTH_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'AUTH_DATABASE_URL_LOCAL atau AUTH_DATABASE_URL wajib diatur di .env.',
  );
}

const databaseHost = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
  throw new Error(
    `Seed akun demo hanya boleh dijalankan ke database lokal; host yang dipilih: ${databaseHost}. Atur AUTH_DATABASE_URL_LOCAL di .env.`,
  );
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const passwordHash = await hash(password, 12);
  await pool.query(
    `INSERT INTO "User" ("id", "email", "password", "name", "role", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'ADMIN', NOW(), NOW())
     ON CONFLICT ("email") DO UPDATE
       SET "password" = EXCLUDED."password",
           "name" = EXCLUDED."name",
           "role" = 'ADMIN',
           "updatedAt" = NOW()`,
    [randomUUID(), email, passwordHash, 'Rata Demo Admin'],
  );

  console.log('Akun demo admin siap digunakan:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
} finally {
  await pool.end();
}
