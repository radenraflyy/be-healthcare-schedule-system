# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --network-timeout 300000

ARG APP_NAME
COPY . .
RUN yarn prisma:generate && yarn nest build "${APP_NAME}"

# prune dev dependencies
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --production --frozen-lockfile --network-timeout 300000

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]