# Development Dockerfile for Turborepo monorepo
FROM node:22-alpine

# Install pnpm and netcat for health checks
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
    && apk add --no-cache netcat-openbsd

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package directories (for workspace resolution)
COPY packages/cli/package.json packages/cli/
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build core package (needed for db-init script)
RUN pnpm build --filter @agentmine/core

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose web port
EXPOSE 3000

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Development command
CMD ["pnpm", "dev", "--filter", "@agentmine/web"]
