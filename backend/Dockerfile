## Stage 1: Build the frontend webapp
FROM oven/bun:1.2 AS frontend-builder
WORKDIR /webapp

# Copy webapp package files and install dependencies
COPY webapp/package.json webapp/bun.lock* ./
RUN bun install

# Copy webapp source
COPY webapp/ ./

# Build with the Railway backend URL as same-origin (empty = same-origin)
# The frontend's api.ts already tries same-origin first, so this just works
RUN VITE_BACKEND_URL="" bun run build


## Stage 2: Build the backend + bundle frontend
FROM oven/bun:1.2 AS base
WORKDIR /app

# Install system dependencies for mupdf and Prisma (OpenSSL)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files (paths relative to repo root since Dockerfile is referenced from root)
COPY backend/package.json backend/bun.lock* ./
COPY backend/prisma ./prisma/

# Remove Vibecode-specific packages that aren't available outside Vibecode
# and install dependencies
RUN cat package.json | \
    bun -e "const p=JSON.parse(await Bun.stdin.text()); \
    delete p.dependencies['@vibecodeapp/backend-sdk']; \
    delete p.dependencies['@vibecodeapp/cloud-studio']; \
    delete p.dependencies['@vibecodeapp/proxy']; \
    delete p.devDependencies?.['@vibecodeapp/cloud-studio']; \
    console.log(JSON.stringify(p,null,2))" > package.production.json && \
    mv package.production.json package.json && \
    bun install

# Generate Prisma client for PostgreSQL
RUN DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" bunx prisma generate --schema=prisma/schema.production.prisma

# Copy backend source
COPY backend/src ./src/
COPY backend/tsconfig.json ./

# Copy prisma seed data for data migration
COPY backend/prisma ./prisma/

# Copy built frontend from Stage 1 into /app/public
COPY --from=frontend-builder /webapp/dist /app/public

# Create uploads directory
RUN mkdir -p /app/uploads /data/uploads /tmp/pdf-chunks

# Set Railway environment flag
ENV RAILWAY_ENVIRONMENT=production

# Expose port
EXPOSE 3000

# Start command - migrate then run with full error output
CMD ["sh", "-c", "echo '[Startup] Running migrations...' && bunx prisma migrate deploy --schema=prisma/schema.production.prisma 2>&1 && echo '[Startup] Migrations complete, starting server...' && bun run src/index.ts 2>&1"]
