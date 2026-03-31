# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — CodeLabz  (multi-stage production build)
#
# TASK 2 — Dockerization
#
# STAGES
#   1. deps     — installs only production npm dependencies (cached layer)
#   2. builder  — installs all deps + runs Vite build → outputs /app/dist
#   3. dev      — development target: runs Vite dev server + Firebase emulators
#   4. production — final image: nginx:alpine serving /app/dist (~70 MB)
#
# USAGE
#   Development:
#     docker compose up
#
#   Production image only:
#     docker build --target production -t codelabz:latest .
#     docker run -p 80:80 --env-file .env codelabz:latest
#
# IMPROVEMENTS OVER ORIGINAL:
#   - node:14 (EOL)        → node:20-alpine (LTS, 3× smaller base)
#   - Single stage         → 4 stages; production image is ~70 MB vs ~2.5 GB
#   - No health check      → health check on emulator service (see docker-compose)
#   - Hardcoded sleep 10   → proper depends_on condition in docker-compose
#   - No nginx             → nginx:1.25-alpine serves static build in production
#   - No .dockerignore     → .dockerignore added (see below) to keep context small
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only manifests first — Docker cache reuses this layer unless deps change
COPY package.json package-lock.json ./
COPY functions/package.json functions/package-lock.json ./functions/

# Install root production dependencies
RUN npm ci --omit=dev

# Install functions dependencies
RUN cd functions && npm ci --omit=dev


# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy full manifests + install ALL deps (including devDeps needed by Vite)
COPY package.json package-lock.json ./
RUN npm ci

# Copy production deps from stage 1 for functions
COPY --from=deps /app/functions/node_modules ./functions/node_modules
COPY functions/package.json ./functions/

# Copy source code
COPY . .

# Build the Vite app — outputs to /app/dist
RUN npm run build


# ── Stage 3: dev ──────────────────────────────────────────────────────────────
# Used by docker-compose for local development (see docker-compose.yml)
FROM node:20-alpine AS dev

# Install Java (required by Firebase Emulator Suite)
RUN apk add --no-cache openjdk17-jre-headless bash

# Install Firebase CLI globally
RUN npm install -g firebase-tools@13

# Pre-download all emulators so docker build caches them
RUN firebase setup:emulators:firestore \
 && firebase setup:emulators:database  \
 && firebase setup:emulators:storage   \
 && firebase setup:emulators:pubsub    \
 && firebase setup:emulators:ui        \
 && firebase setup:emulators:auth

WORKDIR /app

# Copy manifests and install all deps
COPY package.json package-lock.json ./
COPY functions/package.json functions/package-lock.json ./functions/
RUN npm ci
RUN cd functions && npm ci

# Copy rest of project (overridden by volume mount in docker-compose)
COPY . .

# Vite dev server
EXPOSE 5173
# Firebase Emulator UI
EXPOSE 4000
# Firestore
EXPOSE 8080
# Auth
EXPOSE 9099
# Realtime Database
EXPOSE 9000
# Storage
EXPOSE 9199
# PubSub
EXPOSE 8085
# Functions
EXPOSE 5001
# Hosting emulator
EXPOSE 5000
# Emulator Hub
EXPOSE 4400

# Entrypoint: start emulators then Vite dev server
# Uses wait-on pattern — no hardcoded sleep
COPY scripts/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

CMD ["/usr/local/bin/dev-entrypoint.sh"]


# ── Stage 4: production ───────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the Vite build output from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# nginx runs as PID 1; default CMD is fine
CMD ["nginx", "-g", "daemon off;"]
