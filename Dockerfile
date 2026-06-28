# Stage 1 : Build frontend
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 : Runtime Bun
FROM oven/bun:alpine
WORKDIR /app

# Copier les artefacts du build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copier les fichiers serveur
COPY server.ts telemetry.ts config.ts package.json bun.lock ./

# Installer uniquement les dépendances de production
RUN bun install --production --frozen-lockfile

# Créer le fichier valid-words.json vide si absent
RUN mkdir -p public/data && \
    [ -f public/data/valid-words.json ] || echo '{"words":[]}' > public/data/valid-words.json

EXPOSE 25000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:25000").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

CMD ["bun", "run", "server.ts"]
