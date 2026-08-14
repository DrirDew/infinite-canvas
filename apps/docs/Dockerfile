FROM oven/bun:1.3.13 AS docs-build

WORKDIR /repo
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts --cache-dir=/root/.bun/install/cache
RUN bun --cwd apps/docs postinstall
RUN bun --cwd apps/docs build

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/public ./public
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/index.md ./index.md
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/content ./content
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/.source ./.source
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/source.config.ts ./source.config.ts
COPY --from=docs-build --chown=nextjs:nodejs /repo/CHANGELOG.md /CHANGELOG.md
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/.next/standalone ./
COPY --from=docs-build --chown=nextjs:nodejs /repo/apps/docs/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
