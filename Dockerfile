# Etapa 1: Construcción (Node)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Producción (Nginx Non-Root)
FROM nginx:stable-alpine

# Configuramos directorios para que el usuario nginx tenga permisos
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Copiamos los archivos estáticos
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

# Configuración de Nginx para puerto 8080 (los non-root no pueden usar el 80 internamente)
RUN echo 'server { \
    listen 8080; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Cambiamos al usuario sin privilegios
USER nginx

# Exponemos el nuevo puerto interno
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]