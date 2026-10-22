FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/text-diff/package.json packages/text-diff/package.json
RUN npm ci
COPY packages/contracts/ packages/contracts/
COPY packages/text-diff/ packages/text-diff/
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/
RUN npm run build -w @gramota/text-diff \
  && npm run build:ts -w apps/server \
  && npm run build -w apps/web
RUN npm prune --omit=dev --workspace=server --workspace=@gramota/contracts --workspace=@gramota/text-diff

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist/ packages/contracts/dist/
COPY --from=build /app/packages/text-diff/package.json packages/text-diff/package.json
COPY --from=build /app/packages/text-diff/dist/ packages/text-diff/dist/
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/apps/server/dist/ apps/server/dist/
COPY --from=build /app/apps/server/drizzle/ apps/server/drizzle/
COPY --from=build /app/apps/web/dist/ apps/web/dist/
RUN mkdir /app/apps/server/data && chown node:node /app/apps/server/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
WORKDIR /app/apps/server
CMD ["node", "/app/node_modules/fastify-cli/cli.js", "start", "--options", "-l", "info", "--address", "0.0.0.0", "--port", "3000", "dist/app.js"]
