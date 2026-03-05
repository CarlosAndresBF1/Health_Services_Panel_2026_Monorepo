# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/ ./packages/

# Copy api package files
COPY apps/api/package.json ./apps/api/

# Install all dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy tsconfig base
COPY tsconfig.base.json ./

# Copy api source and config files
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/

WORKDIR /app/apps/api

RUN pnpm run build

# ─── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

LABEL org.opencontainers.image.title="HealthPanel API"
LABEL org.opencontainers.image.description="HealthPanel NestJS monitoring API"

# Install chromium dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to use system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

# Copy root package files
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for workspace resolution
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Copy shared package built output (required as workspace dep)
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Install only production dependencies
RUN pnpm install --prod --filter=@healthpanel/api

# Copy compiled output from build stage
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Create screenshots directory with proper ownership
RUN mkdir -p /app/screenshots && chown -R nestjs:nestjs /app/screenshots

# Switch to non-root user
USER nestjs

WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "dist/main"]
