# ── Etapa 1: build del frontend ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./

# Esta etapa solo compila el frontend con Vite, así que no necesita el módulo
# nativo better-sqlite3. --ignore-scripts evita que npm intente compilarlo aquí
# (que es lo que fallaba: el toolchain solo está en la etapa de runtime).
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Etapa 2: runtime Node non-root ───────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package*.json ./

# Aquí sí hace falta compilar better-sqlite3: Alpine usa musl y no existe
# binario precompilado. El toolchain se instala como paquete virtual y se
# elimina después para no dejarlo en la imagen final.
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
# docker-compose.yml monta encima el volumen `report_data`, que sobrevive a
# las reconstrucciones de la imagen.
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
