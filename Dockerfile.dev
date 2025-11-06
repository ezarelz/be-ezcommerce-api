# -------- BUILD STAGE --------
FROM node:20-slim AS build
WORKDIR /app

# deps runtime prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development
ENV PRISMA_CLIENT_ENGINE_TYPE=library
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=library

COPY package*.json ./
RUN npm ci --quiet

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# generate prisma client (tidak butuh konek DB)
RUN npx prisma generate

# build TS
RUN npm run build

# -------- RUNTIME STAGE --------
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=library
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=library
ENV PORT=4000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# opsional: tidak wajib membawa prisma/
COPY --from=build /app/prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/index.js"]
