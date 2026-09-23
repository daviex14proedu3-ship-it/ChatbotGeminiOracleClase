# Multi-stage Dockerfile for WhatsApp SaaS Bot Monolith (Node.js + Baileys + Vite)
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package descriptors
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies required for vite build & tsc)
RUN pnpm install --frozen-lockfile

# Copy project files
COPY . .

# Build Vite frontend and server TypeScript
RUN pnpm build

# ----------------------------------------------------------------------
# Production Runner Image
# ----------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy package descriptors
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy compiled frontend and backend from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/data ./data
COPY --from=builder /app/package.json ./package.json

# Expose single monolith port
EXPOSE 3000

# Define volume for persistent Baileys auth tokens, knowledge base, and uploads
VOLUME ["/app/data"]

# Run the production monolith server
CMD ["node", "dist-server/index.js"]
