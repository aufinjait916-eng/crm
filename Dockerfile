# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifests first to leverage Docker's caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the client assets and compile the Express server into dist/
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled production code and manifests from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install ONLY production dependencies to keep the image footprint small
RUN npm ci --only=production

# Expose port 3000 (Field Dynamics default port)
EXPOSE 3000

# Start the bundled server
CMD ["npm", "start"]