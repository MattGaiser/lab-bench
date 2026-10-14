FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src/domain.ts /app/src/scenario.ts ./src/
COPY --from=build --chown=node:node /app/scripts/serve.mjs /app/scripts/assistant.mjs /app/scripts/quota.mjs ./scripts/
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 8080
CMD ["node", "scripts/serve.mjs"]
