# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json* ./
COPY packages/ ./packages/

# Copy api package files
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN npm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy installed node_modules and source from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy tsconfig base
COPY tsconfig.base.json ./

# Copy api source and config files
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/

WORKDIR /app/apps/api

RUN npm run build

# ─── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy root package files
COPY package.json ./

# Copy api package.json
COPY apps/api/package.json ./apps/api/

# Install only production dependencies
RUN npm install --omit=dev --workspace=apps/api

# Copy compiled output from build stage
COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main"]
