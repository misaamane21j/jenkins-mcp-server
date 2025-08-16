# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm install --only=dev
RUN npm run build

# Development stage
FROM node:20-alpine AS development

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "run", "dev"]

# Production stage
FROM node:20-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S jenkins -u 1001

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=jenkins:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=jenkins:nodejs /app/dist ./dist
COPY --chown=jenkins:nodejs package*.json ./

# Switch to non-root user
USER jenkins

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "start"]