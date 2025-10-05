# Use official Node.js Alpine base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (system + yt-dlp + ffmpeg)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    make \
    g++ && \
    python3 -m venv /venv && \
    . /venv/bin/activate && \
    pip install --no-cache-dir yt-dlp && \
    ln -s /venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Copy dependency files first (for better build caching)
COPY package*.json ./

# Install Node dependencies
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy app source
COPY . ./

# Create directory for audio downloads
RUN mkdir -p /tmp/audio && chmod 755 /tmp/audio

# Expose port
EXPOSE 5000

# Health check for Render/Deployment
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Run as non-root user
USER node

# Set PATH to include yt-dlp from virtual environment
ENV PATH="/venv/bin:$PATH"

# Start your bot
CMD ["npm", "run", "start"]
