# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Stage 2: Serve
FROM caddy:2-alpine

# Copy built assets to Caddy
COPY --from=build /app/dist /usr/share/caddy

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Start Caddy (handled automatically by the base image if given a Caddyfile)
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
