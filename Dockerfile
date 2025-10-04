FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install ffmpeg and build dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Bundle app source
COPY . ./

# Create download directory for audio files with proper permissions
RUN mkdir -p /tmp/audio && chmod 755 /tmp/audio

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Run as non-root user
USER node

# Start the bot
CMD ["npm", "run", "start"]
