# Use Node.js 18 slim image
FROM node:18-slim

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
