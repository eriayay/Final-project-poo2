# ─── Frontend React/Vite - Dockerfile (multi-stage) ────────────────────────

# ── Etapa 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos primero (cache layer)
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# El frontend llama a /api/ (relativo), nginx hace el proxy al backend.
# Si tu .env.production tiene VITE_API_URL=http://localhost:8000,
# debes cambiarlo a VITE_API_URL=/api  (o eliminar esa variable y usar rutas relativas)
RUN npm run build

# ── Etapa 2: Servir con Nginx ────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Copiar el build de React
COPY --from=builder /app/build /usr/share/nginx/html

# Copiar configuración de nginx (con proxy a /api/)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
