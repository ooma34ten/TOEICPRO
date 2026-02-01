FROM node:20-slim AS builder
WORKDIR /app

# 1) package.json のみ先にコピー
COPY package.json package-lock.json ./
RUN npm install --production=false

# 2) next.config.js を builder に明示的にコピー（重要）
COPY next.config.js ./next.config.js

# 3) その他のすべてのファイル
COPY . .

RUN npm run build


FROM node:20-slim AS runner
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# ここで builder から next.config.js をコピー
COPY --from=builder /app/next.config.js ./next.config.js

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
