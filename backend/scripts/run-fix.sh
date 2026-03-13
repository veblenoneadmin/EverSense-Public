#!/bin/bash
# Script to run the membership fix via Railway CLI

echo "🚀 Running Tony's membership fix via Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Login to Railway (if not already logged in)
echo "🔐 Logging into Railway..."
railway login

# Connect to your project
echo "📡 Connecting to Railway project..."
railway link

# Run the membership fix script
echo "🔧 Running membership fix script..."
railway run node scripts/railway-fix-membership.js

echo "✅ Done! Check the output above for results."