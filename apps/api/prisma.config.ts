import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Use Neon’s direct connection for Prisma CLI operations when configured.
// The NestJS runtime continues using DATABASE_URL, which may use Neon’s pooler.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: migrationUrl },
});
