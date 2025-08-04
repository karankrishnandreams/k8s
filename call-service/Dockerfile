# Use latest Node 23 Alpine image
FROM node:23-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy only the package.json and package-lock.json to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project files
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the app port
EXPOSE 5008

# Start the application
CMD ["npm", "start"]
