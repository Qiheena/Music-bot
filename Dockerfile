FROM node:20-slim

# Create app/working/bot directory
RUN mkdir -p /app
WORKDIR /app

# Install ffmpeg for audio processing
RUN apt-get update && apt-get install 'ffmpeg' -y --no-install-recommends \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install app production dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY . ./

# Optional API/Backend port (updated to 5000)
EXPOSE 5000

# Run the start command
CMD [ "npm", "run", "start" ]
