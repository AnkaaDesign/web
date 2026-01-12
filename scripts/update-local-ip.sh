#!/bin/bash
# Script to automatically update local IP address in .env files
# Run this script when your local IP changes (e.g., after DHCP reassignment)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Detecting local IP address...${NC}"

# Detect local IP (excluding localhost and docker interfaces)
LOCAL_IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | grep -v "docker" | grep -v "br-" | awk '{print $2}' | cut -d/ -f1 | head -n 1)

if [ -z "$LOCAL_IP" ]; then
    echo -e "${RED}❌ Could not detect local IP address${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Detected IP: $LOCAL_IP${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEB_ROOT="$SCRIPT_DIR/.."

# Find current IP in .env file
CURRENT_IP=$(grep -oP 'VITE_API_URL=http://\K[\d.]+' "$WEB_ROOT/.env" 2>/dev/null | head -n 1)

if [ "$CURRENT_IP" == "$LOCAL_IP" ]; then
    echo -e "${GREEN}✅ IP address is already up to date ($LOCAL_IP)${NC}"
    exit 0
fi

echo -e "${YELLOW}📝 Current IP in .env: $CURRENT_IP${NC}"
echo -e "${YELLOW}📝 Updating to: $LOCAL_IP${NC}"

# Update .env file
if [ -f "$WEB_ROOT/.env" ]; then
    sed -i.bak "s|http://[0-9.]*:3030|http://$LOCAL_IP:3030|g" "$WEB_ROOT/.env"
    echo -e "${GREEN}✅ Updated .env${NC}"
fi

# Update .env.development file
if [ -f "$WEB_ROOT/.env.development" ]; then
    sed -i.bak "s|http://[0-9.]*:3030|http://$LOCAL_IP:3030|g" "$WEB_ROOT/.env.development"
    echo -e "${GREEN}✅ Updated .env.development${NC}"
fi

echo ""
echo -e "${GREEN}✅ IP address updated successfully!${NC}"
echo -e "${YELLOW}⚠️  Note: You'll need to restart your dev server for changes to take effect${NC}"
echo ""
echo -e "${YELLOW}Backend CORS is now configured to automatically accept:${NC}"
echo -e "  • localhost:* (any port)"
echo -e "  • 192.168.0.* (any device on 192.168.0.x network)"
echo -e "  • 192.168.1.* (any device on 192.168.1.x network)"
echo -e "  • 10.*.*.* (any device on 10.x.x.x network)"
