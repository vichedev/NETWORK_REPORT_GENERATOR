# ── Etapa 1: build del frontend ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Etapa 2: runtime Node non-root ───────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package*.json ./

# better-sqlite3 se compila de forma nativa: Alpine usa musl y no tiene binario
# precompilado, así que instalamos el toolchain y lo retiramos después.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && apk del .build-deps \
 && npm cache clean --force

# Solo lo que el servidor necesita en runtime
COPY --from=build /app/dist ./dist
COPY server ./server

# El volumen de datos (BD, imágenes y clave de cifrado) pertenece al usuario node
RUN mkdir -p /app/data/uploads && chown -R node:node /app

USER node
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# La BD SQLite, las imágenes archivadas y data/.secret viven aquí.
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
