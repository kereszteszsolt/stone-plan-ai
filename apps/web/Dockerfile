FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci --no-fund --no-audit
COPY apps/web/angular.json apps/web/tsconfig*.json ./
COPY apps/web/src ./src
RUN npm run build

FROM nginx:stable-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web/browser /usr/share/nginx/html
