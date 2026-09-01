FROM node:22-alpine

# Install build dependencies for better-sqlite3 and native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install package dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

EXPOSE 5001

CMD ["node", "server.js"]
