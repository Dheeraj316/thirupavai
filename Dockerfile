# Thirupavai: storefront + API in one small image. Build context = this folder (the one holding app/ and site/).
#   docker build -t thirupavai .
#   docker run -p 8080:8080 --env-file app/.env thirupavai
FROM node:22-slim AS build
WORKDIR /srv
# dependencies first, so a code-only change does not reinstall them
COPY app/package.json app/package-lock.json app/
RUN cd app && npm ci --omit=dev
COPY app app
COPY site site
# copies the storefront into app/public and pre-compresses the text files (brotli + gzip)
RUN cd app && node scripts/build-public.js

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /srv/app
COPY --from=build /srv/app /srv/app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
