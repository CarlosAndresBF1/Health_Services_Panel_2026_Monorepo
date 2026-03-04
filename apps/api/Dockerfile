# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/ ./packages/

# Copy api package files
COPY apps/api/package.json ./apps/api/

# Install all dependencies
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

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy root package files
COPY package.json pnpm-workspace.yaml ./

# Copy api package.json
COPY apps/api/package.json ./apps/api/

# Install only production dependencies
RUN pnpm install --prod --filter=@healthpanel/api

# Copy compiled output from build stage
COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main"]
