# 语法：docker/docker-buildx 多阶段构建
FROM node:20-alpine AS builder
WORKDIR /app

# 仅复制依赖清单，利用层缓存
COPY package*.json ./
RUN npm ci

# 复制源码并构建 Nitro 产物到 .output/
COPY . .
RUN npm run build

# ---------- 运行阶段 ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# 只带运行所需文件，减小镜像体积
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# 健康检查：命中 /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", ".output/server/index.mjs"]
