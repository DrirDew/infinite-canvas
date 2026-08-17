# 构建 Vite 前端产物。
FROM oven/bun:1.3.13 AS web-build

WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
RUN bun run build

# 公司渠道签名代理：密钥只存在这个容器的环境变量里。
FROM oven/bun:1.3.13 AS api
WORKDIR /app
COPY server ./
EXPOSE 8787
ENV PORT=8787
CMD ["bun", "src/index.ts"]

# 运行镜像：静态前端 + 反代公司渠道 API。默认构建这个阶段。
FROM nginx:1.27-alpine AS app

COPY --from=web-build /app/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN apk add --no-cache openssl \
    && sed -i 's/\r$//' /docker-entrypoint.d/40-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/40-runtime-config.sh \
    && printf 'auth_basic off;\n' > /etc/nginx/auth.inc

EXPOSE 3000
