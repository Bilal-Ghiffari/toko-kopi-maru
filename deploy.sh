#!/bin/bash

# Deployment Helper Script for Toko Kopi Maru
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
if [ -z "$1" ]; then
    print_error "Environment not specified"
    echo "Usage: ./deploy.sh [development|staging|production]"
    exit 1
fi

ENV=$1

# Validate environment
if [ "$ENV" != "development" ] && [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    print_error "Invalid environment: $ENV"
    echo "Valid environments: development, staging, production"
    exit 1
fi

print_info "Starting deployment for $ENV environment..."

# Check if .env file exists
if [ ! -f ".env.$ENV" ]; then
    print_error ".env.$ENV file not found"
    print_info "Copy from .env.$ENV.example and configure it first"
    exit 1
fi

# Load environment variables
export $(cat .env.$ENV | grep -v '#' | xargs)

# Check if docker-compose file exists
if [ ! -f "docker-compose.$ENV.yml" ]; then
    print_error "docker-compose.$ENV.yml not found"
    exit 1
fi

# Pull latest code
print_info "Pulling latest code..."
git pull origin $ENV

# Install dependencies
print_info "Installing dependencies..."
npm ci

# Run code quality checks
print_info "Running code quality checks..."
npm run lint || {
    print_error "Lint failed"
    exit 1
}

print_info "Running TypeScript check..."
npx tsc --noEmit || {
    print_error "TypeScript check failed"
    exit 1
}

# Build application
print_info "Building application..."
npm run build || {
    print_error "Build failed"
    exit 1
}

# Build Docker image
print_info "Building Docker image..."
IMAGE_TAG="toko-kopi-maru:$ENV-$(date +%s)"
docker build -t $IMAGE_TAG -t "toko-kopi-maru:$ENV-latest" . || {
    print_error "Docker build failed"
    exit 1
}

# Stop existing containers
print_info "Stopping existing containers..."
docker-compose -f docker-compose.$ENV.yml down || print_warn "No existing containers to stop"

# Start new containers
print_info "Starting new containers..."
export IMAGE_TAG=$IMAGE_TAG
docker-compose -f docker-compose.$ENV.yml up -d || {
    print_error "Failed to start containers"
    exit 1
}

# Wait for application to be ready
print_info "Waiting for application to be ready..."
sleep 10

# Health check
print_info "Running health check..."
HEALTH_URL="http://localhost:3000/api/health"
if [ "$ENV" == "staging" ]; then
    HEALTH_URL="http://localhost:3001/api/health"
elif [ "$ENV" == "production" ]; then
    HEALTH_URL="http://localhost:3002/api/health"
fi

curl -f $HEALTH_URL || {
    print_error "Health check failed"
    print_info "Check logs with: docker logs toko-kopi-maru-$ENV"
    exit 1
}

# Cleanup old images
print_info "Cleaning up old images..."
docker image prune -f

print_info "✅ Deployment completed successfully!"
print_info "Application is running at: $HEALTH_URL"
print_info "View logs: docker logs -f toko-kopi-maru-$ENV"
