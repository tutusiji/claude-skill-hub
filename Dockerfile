# ============ 阶段 1: 构建 ============
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷 web 的依赖文件，利用 Docker 层缓存
COPY web/package.json web/package-lock.json* ./web/
RUN cd web && npm ci

# 拷贝整个项目（plugins、scripts、web 等）
COPY . .

# 生成 registry.json（读取 plugins 和 marketplace.json，输出到 web/src/lib/）
RUN node scripts/generate-registry.mjs

# 构建 Next.js
RUN cd web && npm run build

# ============ 阶段 2: 运行 ============
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone 输出：server.js 在根目录，static 需要放到 .next/static
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static

EXPOSE ${PORT}
CMD ["node", "server.js"]
