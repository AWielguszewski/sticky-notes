FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    STATIC_DIR=/app/dist
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
