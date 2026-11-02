# Stage 1 builds the static Astro site. Stage 2 serves it with nginx.
# The final image has no Node.js.

FROM node:24-alpine AS build
WORKDIR /app

# Copy the manifests first so the dependency install stays cached.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .
COPY packages/relatinator/package.json packages/relatinator/package.json
COPY packages/astro-relatinator/package.json packages/astro-relatinator/package.json
COPY packages/playground/package.json packages/playground/package.json
COPY packages/site/package.json packages/site/package.json

RUN npm install -g pnpm@11.24.0

RUN pnpm install --frozen-lockfile

COPY . .

ENV CI=true

RUN pnpm --filter relatinator build && pnpm --filter site build

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY packages/site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/site/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
