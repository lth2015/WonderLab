# One-process test deployment (docs/deploy.md): the API serves the built web
# app from its own origin. Accounts and payments stay off unless
# DATABASE_URL is set; the canvas and 一句成境 need neither.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# .git is not in the image: pass the commit and experiment in (docs/验证路线图.md §4),
# e.g. --build-arg WW_BUILD_SHA=$(git rev-parse --short=12 HEAD) --build-arg WW_EXPERIMENT=poc-r1
ARG WW_BUILD_SHA=unknown
ARG WW_EXPERIMENT=dev
RUN WW_BUILD_SHA=$WW_BUILD_SHA WW_EXPERIMENT=$WW_EXPERIMENT npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    RUN_MODE=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    WEB_DIST_DIR=/app/dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# The server reuses the poem library and scene validation from src/.
COPY server ./server
COPY src ./src
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "--tsconfig", "server/tsconfig.json", "server/src/index.ts"]
