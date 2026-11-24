import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './src/shared/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL || 'mysql://root@127.0.0.1:3306/sparkoff_v2' },
});
