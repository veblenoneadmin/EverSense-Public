# Use Node.js 20 slim for better Prisma compatibility
FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and backend prisma schema
COPY package*.json ./
COPY backend/prisma/ ./backend/prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code (frontend and backend)
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Delete stale TypeScript build cache to prevent false errors
RUN rm -f frontend/node_modules/.tmp/tsconfig.app.tsbuildinfo

# Cache bust - increment to force clean rebuild
ARG CACHE_BUST=6

# Build the application (frontend build)
RUN npm run build

# Expose the port (Railway will set PORT env var dynamically)
EXPOSE 3001

# Attempt DB sync (non-blocking) then start — prisma generate already done at build time
CMD ["sh", "-c", "cd backend && (npx prisma db push --skip-generate || echo 'DB sync failed, continuing...') && node server.js"]