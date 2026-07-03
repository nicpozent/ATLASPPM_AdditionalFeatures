# ============================================================================
#  Atlas PPM frontend — multi-stage build.
#  Stage 1 builds the Vite app; stage 2 serves the static output via nginx and
#  reverse-proxies /api to the backend service (same-origin, as in production).
#
#  Vite bakes VITE_* env at build time, so the auth/API config is passed as
#  build args (these values are public — client/tenant IDs, not secrets).
# ============================================================================
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build-time config (override via docker-compose build args).
ARG VITE_AUTH_ENABLED=false
ARG VITE_AUTH_TENANT_ID=
ARG VITE_AUTH_CLIENT_ID=
ARG VITE_API_AUDIENCE=api://atlas-ppm
ARG VITE_API_BASE=/api/v1
ENV VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED \
    VITE_AUTH_TENANT_ID=$VITE_AUTH_TENANT_ID \
    VITE_AUTH_CLIENT_ID=$VITE_AUTH_CLIENT_ID \
    VITE_API_AUDIENCE=$VITE_API_AUDIENCE \
    VITE_API_BASE=$VITE_API_BASE

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
