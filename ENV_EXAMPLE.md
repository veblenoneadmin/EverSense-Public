# VebTask Multi-Tenant Environment Variables

## Required Environment Variables

```env
# Database
DATABASE_URL="mysql://user:password@host:port/database"

# Application URLs  
VITE_APP_URL="https://vebtask.com"
BETTER_AUTH_URL="https://vebtask.com"

# Better Auth Secret (32+ characters)
BETTER_AUTH_SECRET="your-super-secret-jwt-key-minimum-32-characters"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI API (existing)
OPENAI_API_KEY="your-openai-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Your App <noreply@domain.com>"

# Environment
NODE_ENV="production"
```

## Railway Environment Setup

In your Railway dashboard, add these environment variables with your actual values:

```env
BETTER_AUTH_SECRET="your-generated-secret-32-characters-min"
DATABASE_URL="${{MySQL.MYSQL_URL}}"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
OPENAI_API_KEY="your-openai-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"
SMTP_FROM="VebTask <your-email@domain.com>"
SMTP_HOST="smtp.gmail.com"
SMTP_PASS="your-smtp-password"
SMTP_PORT="587"
SMTP_USER="your-email@domain.com"
VITE_APP_URL="https://vebtask.com"
BETTER_AUTH_URL="https://vebtask.com"
```