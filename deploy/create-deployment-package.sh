#!/bin/bash

# ============================================================================
# Deployment Package Creator for lets-todo Multi-Environment Setup
# ============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$SCRIPT_DIR/package"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="lets-todo-deployment_$TIMESTAMP.tar.gz"

echo "🚀 Creating deployment package..."
echo "Project root: $PROJECT_ROOT"
echo "Deploy dir: $DEPLOY_DIR"

# Clean and create deployment directory
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# ============================================================================
# 1. Copy application files
# ============================================================================
echo "📦 Copying application files..."

# Core application files
cp "$PROJECT_ROOT/server.js" "$DEPLOY_DIR/"
cp "$PROJECT_ROOT/package.json" "$DEPLOY_DIR/"
cp "$PROJECT_ROOT/package-lock.json" "$DEPLOY_DIR/" 2>/dev/null || echo "No package-lock.json found"

# Application directories
cp -r "$PROJECT_ROOT/config" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/middleware" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/routing" "$DEPLOY_DIR/"
cp -r "$PROJECT_ROOT/scripts" "$DEPLOY_DIR/"

# Database file
cp "$PROJECT_ROOT/db.js" "$DEPLOY_DIR/"

# ============================================================================
# 2. Copy deployment configurations
# ============================================================================
echo "🔧 Copying deployment configurations..."

# Environment files (now in config/env/)
mkdir -p "$DEPLOY_DIR/config/env"
cp "$PROJECT_ROOT/config/env/.env.production" "$DEPLOY_DIR/config/env/"
cp "$PROJECT_ROOT/config/env/.env.feature" "$DEPLOY_DIR/config/env/"
cp "$PROJECT_ROOT/config/env/.env.staging" "$DEPLOY_DIR/config/env/"

# PM2 configuration
cp "$PROJECT_ROOT/ecosystem.config.cjs" "$DEPLOY_DIR/"

# Nginx configurations
mkdir -p "$DEPLOY_DIR/nginx"
cp -r "$PROJECT_ROOT/nginx/"* "$DEPLOY_DIR/nginx/"

# Documentation
cp "$PROJECT_ROOT/DEPLOYMENT.md" "$DEPLOY_DIR/"
cp "$PROJECT_ROOT/README.md" "$DEPLOY_DIR/" 2>/dev/null || echo "No README.md found"

# ============================================================================
# 3. Create deployment scripts
# ============================================================================
echo "📝 Creating deployment scripts..."

# Create main deployment script
cat > "$DEPLOY_DIR/deploy.sh" << 'EOF'
#!/bin/bash

# ============================================================================
# Multi-Environment Deployment Script for lets-todo API
# ============================================================================

set -e

SERVER_USER="dev2k"
PROJECT_PATH="/opt/dev2k-space/home/projects/lets-todo-api"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "🚀 Starting lets-todo API deployment..."

# ============================================================================
# 1. Setup project directory
# ============================================================================
echo "📁 Setting up project directory..."
sudo mkdir -p "$PROJECT_PATH"
sudo chown -R $SERVER_USER:$SERVER_USER "$PROJECT_PATH"

# Copy application files
cp -r . "$PROJECT_PATH/"
cd "$PROJECT_PATH"

# Create logs directory
mkdir -p logs

# ============================================================================
# 2. Install dependencies
# ============================================================================
echo "📦 Installing Node.js dependencies..."
npm ci --only=production

# ============================================================================
# 3. Setup Nginx configurations
# ============================================================================
echo "🌐 Setting up Nginx configurations..."

# Copy nginx configs
sudo cp nginx/production.conf "$NGINX_SITES/lets-todo-api-prod.conf"
sudo cp nginx/feature.conf "$NGINX_SITES/lets-todo-api-feat.conf" 
sudo cp nginx/staging.conf "$NGINX_SITES/lets-todo-api-stage.conf"

# Enable sites
sudo ln -sf "$NGINX_SITES/lets-todo-api-prod.conf" "$NGINX_ENABLED/"
sudo ln -sf "$NGINX_SITES/lets-todo-api-feat.conf" "$NGINX_ENABLED/"
sudo ln -sf "$NGINX_SITES/lets-todo-api-stage.conf" "$NGINX_ENABLED/"

# Test nginx configuration
sudo nginx -t

# ============================================================================
# 4. Setup SSL certificates
# ============================================================================
echo "🔒 Setting up SSL certificates..."

# Create webroot directory for certbot
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge/
sudo chown -R www-data:www-data /var/www/certbot

echo "📋 SSL Certificate commands (run manually after deployment):"
echo "sudo certbot certonly --webroot -w /var/www/certbot -d lets-todo-api.dev2k.org --agree-tos --no-eff-email -m konstantin.aksenov@dev2k.org"
echo "sudo certbot certonly --webroot -w /var/www/certbot -d lets-todo-api-feat.dev2k.org --agree-tos --no-eff-email -m konstantin.aksenov@dev2k.org"
echo "sudo certbot certonly --webroot -w /var/www/certbot -d lets-todo-api-stage.dev2k.org --agree-tos --no-eff-email -m konstantin.aksenov@dev2k.org"

# ============================================================================
# 5. Setup PM2 applications
# ============================================================================
echo "⚙️  Setting up PM2 applications..."

# Stop existing PM2 processes (if any)
pm2 delete lets-todo-api-prod 2>/dev/null || true
pm2 delete lets-todo-api-feat 2>/dev/null || true
pm2 delete lets-todo-api-stage 2>/dev/null || true

# Start PM2 applications
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save
pm2 startup

# ============================================================================
# 6. Reload Nginx
# ============================================================================
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Run the SSL certificate commands shown above"
echo "2. Check PM2 status: pm2 status"
echo "3. Check Nginx status: sudo systemctl status nginx"
echo "4. Monitor logs: pm2 logs"
echo ""
echo "🌐 Your APIs will be available at:"
echo "  - Production: https://lets-todo-api.dev2k.org"
echo "  - Feature: https://lets-todo-api-feat.dev2k.org" 
echo "  - Staging: https://lets-todo-api-stage.dev2k.org"

EOF

# Make deployment script executable
chmod +x "$DEPLOY_DIR/deploy.sh"

# Create SSL setup script
cat > "$DEPLOY_DIR/setup-ssl.sh" << 'EOF'
#!/bin/bash

# ============================================================================
# SSL Certificate Setup Script
# ============================================================================

set -e

echo "🔒 Setting up SSL certificates for all environments..."

# Setup webroot directory
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge/
sudo chown -R www-data:www-data /var/www/certbot

# Get certificates for all domains
domains=(
    "lets-todo-api.dev2k.org"
    "lets-todo-api-feat.dev2k.org"
    "lets-todo-api-stage.dev2k.org"
)

for domain in "${domains[@]}"; do
    echo "📜 Requesting certificate for $domain..."
    sudo certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$domain" \
        --agree-tos --no-eff-email \
        -m konstantin.aksenov@dev2k.org \
        --keep-until-expiring --non-interactive
done

echo "✅ All SSL certificates have been set up!"
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "🎉 SSL setup completed!"

EOF

chmod +x "$DEPLOY_DIR/setup-ssl.sh"

# ============================================================================
# 4. Create package
# ============================================================================
echo "📦 Creating deployment package..."

cd "$SCRIPT_DIR"
tar -czf "$PACKAGE_NAME" -C package .

echo "✅ Deployment package created: $SCRIPT_DIR/$PACKAGE_NAME"
echo ""
echo "🚀 To deploy:"
echo "1. Copy $PACKAGE_NAME to your server"
echo "2. Extract: tar -xzf $PACKAGE_NAME"
echo "3. Run: chmod +x deploy.sh && ./deploy.sh"
echo "4. Setup SSL: ./setup-ssl.sh"
echo ""
echo "📊 Package contents:"
tar -tzf "$PACKAGE_NAME" | head -20
echo "..."
echo "Total files: $(tar -tzf "$PACKAGE_NAME" | wc -l)"