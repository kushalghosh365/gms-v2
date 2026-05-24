# Use Node.js 18 slim image
FROM node:18-slim

# Install Chrome & dependencies required by Puppeteer/whatsapp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium, not download its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Install dependencies first (for Docker cache optimization)
COPY package*.json ./
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]
