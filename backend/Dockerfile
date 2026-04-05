# Multi-stage production Dockerfile for dsa-visualizer-backend

FROM node:22-alpine AS build

WORKDIR /app

# Native dependencies for bcrypt/prisma builds
RUN apk add --no-cache openssl python3 make g++

COPY package.json ./
RUN npm install --include=dev

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
COPY --from=build /app/dist ./dist

# Ensure Prisma client is generated for runtime node_modules
RUN npx prisma generate

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5000

CMD ["node", "dist/index.js"]
