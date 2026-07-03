# Multi-stage build:
#   base  — dependencies (npm ci) + source
#   build — compiles the production SPA bundle (npm run build)
#   serve — Caddy image with the built SPA baked in; used by
#           docker-compose.prod.yml (Caddy serves /srv and proxies /api)
#   dev   — Vite dev server; LAST stage so it stays the default target for
#           `build: ./frontend` in docker-compose.yml (local development)
FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

FROM base AS build
RUN npm run build

FROM caddy:2-alpine AS serve
COPY --from=build /app/dist /srv

FROM base AS dev

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
