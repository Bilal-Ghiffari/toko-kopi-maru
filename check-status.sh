#!/bin/bash

# Status Check Script for Toko Kopi Maru
# Check the status of all environments

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

check_container() {
    local container_name=$1
    local port=$2
    local env=$3
    
    echo -e "\n${YELLOW}Environment: $env${NC}"
    echo "-------------------"
    
    # Check if container exists
    if docker ps -a --format '{{.Names}}' | grep -q "^$container_name$"; then
        # Check if running
        if docker ps --format '{{.Names}}' | grep -q "^$container_name$"; then
            echo -e "Status: ${GREEN}✓ Running${NC}"
            
            # Get container info
            echo -n "Uptime: "
            docker ps --filter "name=$container_name" --format "{{.Status}}"
            
            # Check health
            echo -n "Health Check: "
            HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/api/health)
            if [ "$HEALTH" == "200" ]; then
                echo -e "${GREEN}✓ Healthy${NC}"
            else
                echo -e "${RED}✗ Unhealthy (HTTP $HEALTH)${NC}"
            fi
            
            # Show logs tail
            echo -e "\nRecent Logs:"
            docker logs --tail 5 $container_name 2>&1 | sed 's/^/  /'
            
        else
            echo -e "Status: ${RED}✗ Stopped${NC}"
        fi
    else
        echo -e "Status: ${YELLOW}! Not deployed${NC}"
    fi
}

check_database() {
    local db_name=$1
    local port=$2
    
    echo -e "\n${YELLOW}Database: $db_name${NC}"
    echo "-------------------"
    
    if docker ps -a --format '{{.Names}}' | grep -q "^$db_name$"; then
        if docker ps --format '{{.Names}}' | grep -q "^$db_name$"; then
            echo -e "Status: ${GREEN}✓ Running${NC}"
            echo "Port: $port"
        else
            echo -e "Status: ${RED}✗ Stopped${NC}"
        fi
    else
        echo -e "Status: ${YELLOW}! Not deployed${NC}"
    fi
}

# Main
print_header "Toko Kopi Maru - Deployment Status"

# Check Development
check_container "toko-kopi-maru-dev" "3000" "Development"
check_database "toko-kopi-db-dev" "5432"

# Check Staging
check_container "toko-kopi-maru-staging" "3001" "Staging"
check_database "toko-kopi-db-staging" "5433"

# Check Production
check_container "toko-kopi-maru-prod" "3002" "Production"
check_database "toko-kopi-db-prod" "5434"

# Docker resources summary
print_header "Docker Resources Summary"
echo "Running Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep toko-kopi || echo "None"

echo -e "\nImages:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep toko-kopi || echo "None"

echo -e "\nDisk Usage:"
docker system df

# Network check
print_header "Network Status"
docker network ls | grep toko-kopi || echo "No networks found"

echo ""
