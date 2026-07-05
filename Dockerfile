# ============ 阶段 1: 构建 ============
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷 web 的依赖文件，利用 Docker 层缓存
COPY web/package.json web/package-lock.json* ./web/
RUN cd web && npm ci

# 拷贝整个项目（plugins、scripts、web 等）
COPY . .

# 生成 registry.json
RUN node scripts/generate-registry.mjs

# 构建 Next.js
RUN cd web && npm run build

# ============ 阶段 2: 运行 ============
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/app/data
ENV UPLOAD_DIR=/app/uploads

# standalone 输出
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
# 静态插件文件(download-zip / filetree 路由按 STATIC_PLUGINS_DIR=/app/plugins 读取)
COPY --from=builder /app/plugins ./plugins

# 创建数据目录
RUN mkdir -p /app/data /app/uploads

EXPOSE ${PORT}
CMD ["node", "server.js"]
