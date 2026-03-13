#!/bin/bash

echo "🚀 VebTask Multi-Tenant Deployment Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}Step 2: Generating Prisma client...${NC}"
npm run db:generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Prisma client generated successfully${NC}"
else
    echo -e "${RED}❌ Failed to generate Prisma client${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 3: Running database migrations...${NC}"
npm run db:migrate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${RED}❌ Database migrations failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 4: Running data backfill...${NC}"
npm run db:seed

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Data backfill completed${NC}"
else
    echo -e "${YELLOW}⚠️  Data backfill had issues, but deployment can continue${NC}"
fi

echo -e "${YELLOW}Step 5: Building application...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Application built successfully${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Deployment preparation complete!${NC}"
echo -e "${GREEN}You can now push to GitHub and Railway will auto-deploy.${NC}"
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub"
echo "2. Railway will automatically deploy"
echo "3. Test your application at https://vebtask.com"
echo ""
echo "If you need to run commands on production:"
echo "  railway run npm run db:seed    # Run backfill on production"
echo "  railway logs                   # Check deployment logs"