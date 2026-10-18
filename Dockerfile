FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Set the CLI entrypoint
ENTRYPOINT ["node", "src/cli.js"]
