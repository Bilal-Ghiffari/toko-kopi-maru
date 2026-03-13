#!/bin/bash

# Docker Cleanup Script for Toko Kopi Maru
# This script helps manage Docker resources and prevent disk space issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Show Docker disk usage
print_header "Current Docker Disk Usage"
docker system df

# Function to clean dangling images
clean_dangling() {
    print_header "Cleaning Dangling Images"
    docker image prune -f
    print_info "Dangling images removed"
}

# Function to clean stopped containers
clean_containers() {
    print_header "Cleaning Stopped Containers"
    docker container prune -f
    print_info "Stopped containers removed"
}

# Function to clean unused volumes
clean_volumes() {
    print_header "Cleaning Unused Volumes"
    print_warn "This will remove all unused volumes including database data!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
        docker volume prune -f
        print_info "Unused volumes removed"
    else
        print_info "Skipped volume cleanup"
    fi
}

# Function to clean old images
clean_old_images() {
    print_header "Cleaning Old Images (24h+)"
    docker image prune -a -f --filter "until=24h"
    print_info "Old images removed"
}

# Function to clean build cache
clean_build_cache() {
    print_header "Cleaning Build Cache"
    docker builder prune -f
    print_info "Build cache cleaned"
}

# Function to full cleanup
full_cleanup() {
    print_header "Full Cleanup (Aggressive)"
    print_warn "This will remove ALL unused Docker resources!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
        docker system prune -a -f --volumes
        print_info "Full cleanup completed"
    else
        print_info "Skipped full cleanup"
    fi
}

# Main menu
while true; do
    echo ""
    echo "Docker Cleanup Menu"
    echo "==================="
    echo "1. Clean dangling images"
    echo "2. Clean stopped containers"
    echo "3. Clean unused volumes (⚠️  includes DB data)"
    echo "4. Clean old images (24h+)"
    echo "5. Clean build cache"
    echo "6. Full cleanup (⚠️  aggressive)"
    echo "7. Show disk usage"
    echo "8. Exit"
    echo ""
    read -p "Select option (1-8): " option
    
    case $option in
        1) clean_dangling ;;
        2) clean_containers ;;
        3) clean_volumes ;;
        4) clean_old_images ;;
        5) clean_build_cache ;;
        6) full_cleanup ;;
        7) docker system df ;;
        8) 
            print_info "Goodbye!"
            exit 0
            ;;
        *)
            print_warn "Invalid option"
            ;;
    esac
done
