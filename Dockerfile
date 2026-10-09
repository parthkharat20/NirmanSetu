# Stage 1: Build the React Dashboard
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server code
COPY server ./server
# Copy built frontend
COPY --from=builder /app/dist ./dist

# Add environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Volume for SQLite database
VOLUME ["/app/data"]

EXPOSE 3001

CMD ["node", "server/index.js"]
