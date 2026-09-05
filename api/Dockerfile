FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Com o lock: npm ci instala as versoes exatas que passam localmente.
# Sem ele, cada build resolvia versoes novas do registry e um deploy que
# passava em junho quebrava em setembro sem ninguem mexer no codigo.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
EXPOSE 3333

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
