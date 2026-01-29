import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/db/index.ts',
    'src/db/schema.ts',
    'src/db/pg-schema.ts',
    'src/db/postgres.ts',
  ],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
