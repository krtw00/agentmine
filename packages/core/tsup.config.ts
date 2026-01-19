import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/db/index.ts', 'src/db/schema.ts', 'src/services/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
