# Multi-stage Dockerfile for dsa-visualizer-backend

# Stage 1: Build Phase
FROM node:22-alpine AS builder

WORKDIR /app

# Install native dependencies required for some node modules (like bcrypt, pg)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install all dependencies including devDependencies for build
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client and build typescript
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Phase
FROM node:22-alpine

WORKDIR /app

# Install native dependencies required for production running
RUN apk add --no-cache openssl

# Set environment variable to production
ENV NODE_ENV=production

# Copy built code and required files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Expose API port
EXPOSE 3000

# Set user to non-root for security
# USER node

# Start the application. Note we run DB migrations locally dynamically or via CI, 
# but starting Fastify is the command here. You may alternatively wrap this in a start script.
CMD ["node", "dist/index.js"]
