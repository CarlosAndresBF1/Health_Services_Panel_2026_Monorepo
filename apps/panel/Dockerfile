# ─── Stage 1: Install Dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/panel/package.json ./apps/panel/
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/panel/node_modules ./apps/panel/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter=@healthpanel/panel run build

# ─── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="HealthPanel Panel"
LABEL org.opencontainers.image.description="HealthPanel Next.js monitoring dashboard"

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (monorepo preserves directory structure)
COPY --from=builder --chown=nextjs:nodejs /app/apps/panel/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/panel/.next/static ./apps/panel/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/panel/public ./apps/panel/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/panel/server.js"]
