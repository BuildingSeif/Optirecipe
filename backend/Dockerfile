FROM oven/bun:1.2 AS base
WORKDIR /app

# Install system dependencies for mupdf
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock* ./
COPY prisma ./prisma/

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

# Copy app source
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads /tmp/pdf-chunks

# Set Railway environment flag
ENV RAILWAY_ENVIRONMENT=production

# Expose port
EXPOSE 3000

# Start command - migrate and run
CMD ["sh", "-c", "bunx prisma migrate deploy --schema=prisma/schema.production.prisma && bun run src/index.ts"]
