@echo off
echo 🚀 VebTask Multi-Tenant Deployment Script
echo ========================================

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo Step 2: Generating Prisma client...
call npm run db:generate
if %errorlevel% neq 0 (
    echo ❌ Failed to generate Prisma client
    pause
    exit /b 1
)
echo ✅ Prisma client generated successfully

echo Step 3: Running database migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo ❌ Database migrations failed
    pause
    exit /b 1
)
echo ✅ Database migrations completed

echo Step 4: Running data backfill...
call npm run db:seed
if %errorlevel% neq 0 (
    echo ⚠️  Data backfill had issues, but deployment can continue
) else (
    echo ✅ Data backfill completed
)

echo Step 5: Building application...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✅ Application built successfully

echo.
echo 🎉 Deployment preparation complete!
echo You can now push to GitHub and Railway will auto-deploy.
echo.
echo Next steps:
echo 1. Push your code to GitHub
echo 2. Railway will automatically deploy
echo 3. Test your application at https://vebtask.com
echo.
echo If you need to run commands on production:
echo   railway run npm run db:seed    # Run backfill on production
echo   railway logs                   # Check deployment logs
echo.
pause