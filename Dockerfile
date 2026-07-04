# Build the single deployable artifact, then run it on a slim Node image.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY scripts ./scripts
# --include=dev so devDeps (vite, esbuild) install even if the platform sets
# NODE_ENV=production during the build stage.
RUN npm ci --include=dev
RUN npm run build:deploy

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/deploy ./deploy
EXPOSE 8787
ENV PORT=8787
CMD ["node", "deploy/server.mjs"]
