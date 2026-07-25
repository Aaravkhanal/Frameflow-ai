FROM node:22-bullseye-slim

# Set the working directory in the container
WORKDIR /app

# Enable corepack so pnpm is available without a separate install step.
# The version is pulled from the packageManager field in package.json.
RUN corepack enable

# Copy package manifests first so Docker can cache the install layer
COPY package.json pnpm-lock.yaml ./

# Set the environment variable to skip Puppeteer download
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies using the frozen lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Copy the current directory contents into the container at /app
COPY ./ /app/

# Expose port 5173 to access the server
EXPOSE 5173

# Command to run the application
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
