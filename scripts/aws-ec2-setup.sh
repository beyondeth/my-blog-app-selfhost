#!/bin/bash

# AWS EC2 Setup Script for Blog Application
# Target: EC2 t4g.micro (ARM) with Amazon Linux 2023
# Budget: ~30,000 KRW/month

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   AWS EC2 Blog Application Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ============================================
# 1. System Update & Basic Tools
# ============================================
echo -e "${BLUE}Updating system packages...${NC}"
sudo yum update -y
sudo yum install -y git wget curl htop vim tmux

print_status "System updated"

# ============================================
# 2. Node.js Installation (v20 LTS)
# ============================================
echo -e "${BLUE}Installing Node.js v20...${NC}"

# NodeSource repository for ARM64
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install pnpm globally
sudo npm install -g pnpm pm2

print_status "Node.js $(node -v) installed"
print_status "pnpm $(pnpm -v) installed"
print_status "PM2 $(pm2 -v) installed"

# ============================================
# 3. Redis Installation
# ============================================
echo -e "${BLUE}Installing Redis...${NC}"

# Install Redis 6.2 from Amazon Linux Extras
sudo yum install -y redis6

# Configure Redis for production
sudo tee /etc/redis/redis.conf > /dev/null << 'EOF'
# Redis Configuration for Blog Application
bind 127.0.0.1
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Memory Configuration (256MB for t4g.micro)
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence disabled (memory only)
save ""
stop-writes-on-bgsave-error no
rdbcompression no
rdbchecksum no

# Logging
loglevel notice
logfile /var/log/redis/redis.log
syslog-enabled yes

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Advanced config
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
activerehashing yes
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
hz 10
dynamic-hz yes
EOF

# Start Redis
sudo systemctl enable redis6
sudo systemctl start redis6

print_status "Redis installed and configured"

# ============================================
# 4. Nginx Installation
# ============================================
echo -e "${BLUE}Installing Nginx...${NC}"

sudo yum install -y nginx

# Configure Nginx
sudo tee /etc/nginx/conf.d/myblog.conf > /dev/null << 'EOF'
# Nginx Cache Configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m use_temp_path=off;

# Upstream backend servers (PM2 cluster)
upstream backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml application/atom+xml image/svg+xml 
               text/javascript application/vnd.ms-fontobject 
               application/x-font-ttf font/opentype;
    
    # Static files (with aggressive caching)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        root /home/ec2-user/app/frontend/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API proxy with caching
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Caching for GET requests
        proxy_cache api_cache;
        proxy_cache_methods GET HEAD;
        proxy_cache_valid 200 1m;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 24 4k;
        proxy_busy_buffers_size 8k;
        proxy_max_temp_file_size 2048m;
        proxy_temp_file_write_size 32k;
    }
    
    # Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

print_status "Nginx installed and configured"

# ============================================
# 5. Application Directory Setup
# ============================================
echo -e "${BLUE}Setting up application directory...${NC}"

APP_DIR="/home/ec2-user/app"
mkdir -p $APP_DIR
cd $APP_DIR

# Create ecosystem file for PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'blog-backend',
      script: './backend/dist/main.js',
      instances: 2, // 2 workers for t4g.micro
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '400M',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
    },
    {
      name: 'blog-frontend',
      script: 'node',
      args: './frontend/.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      max_memory_restart: '300M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      time: true,
      autorestart: true,
      watch: false,
    }
  ]
};
EOF

print_status "Application directory prepared"

# ============================================
# 6. Environment Variables Template
# ============================================
echo -e "${BLUE}Creating environment configuration...${NC}"

cat > .env.production << 'EOF'
# Production Environment Variables
NODE_ENV=production

# Application
APP_NAME=MyBlog
APP_PORT=3000
FRONTEND_PORT=3002

# Database (RDS)
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=blog-db
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis (Local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_production_jwt_secret_here
JWT_EXPIRES_IN=7d

# AWS Services
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=myblog-uploads

# Frontend
NEXT_PUBLIC_API_URL=http://your-domain.com/api/v1
NEXT_PUBLIC_FRONTEND_URL=http://your-domain.com

# Session
SESSION_SECRET=your_session_secret_here

# CORS
CORS_ORIGIN=http://your-domain.com
CORS_CREDENTIALS=true
EOF

print_warning "Update .env.production with your actual values!"

# ============================================
# 7. Deployment Script
# ============================================
echo -e "${BLUE}Creating deployment script...${NC}"

cat > deploy.sh << 'EOF'
#!/bin/bash

# Blog Application Deployment Script

set -e

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Backend deployment
echo "Building backend..."
cd backend
pnpm install --frozen-lockfile
pnpm run build
cd ..

# Frontend deployment
echo "Building frontend..."
cd frontend
pnpm install --frozen-lockfile
pnpm run build
cd ..

# Database migrations
echo "Running migrations..."
cd backend
pnpm run migration:run
cd ..

# Restart services
echo "Restarting services..."
pm2 reload ecosystem.config.js --env production

# Clear Redis cache
echo "Clearing cache..."
redis-cli FLUSHDB

# Nginx reload
sudo nginx -s reload

echo "Deployment completed!"
pm2 status
EOF

chmod +x deploy.sh

print_status "Deployment script created"

# ============================================
# 8. System Tuning
# ============================================
echo -e "${BLUE}Optimizing system settings...${NC}"

# Increase file descriptors
sudo tee -a /etc/security/limits.conf > /dev/null << EOF
ec2-user soft nofile 65536
ec2-user hard nofile 65536
EOF

# Network optimization
sudo tee -a /etc/sysctl.conf > /dev/null << EOF
# Network optimizations for web server
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.ip_local_port_range = 1024 65535
EOF

sudo sysctl -p

print_status "System optimized"

# ============================================
# 9. Monitoring Setup
# ============================================
echo -e "${BLUE}Setting up monitoring...${NC}"

# CloudWatch agent installation (optional)
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/arm64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm
rm amazon-cloudwatch-agent.rpm

# Create CloudWatch config
cat > cloudwatch-config.json << 'EOF'
{
  "metrics": {
    "namespace": "MyBlog",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {
            "name": "cpu_usage_idle",
            "rename": "CPU_IDLE",
            "unit": "Percent"
          }
        ],
        "totalcpu": false,
        "metrics_collection_interval": 60
      },
      "mem": {
        "measurement": [
          {
            "name": "mem_used_percent",
            "rename": "MEM_USED",
            "unit": "Percent"
          }
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

print_status "Monitoring configured"

# ============================================
# 10. Logrotate Configuration
# ============================================
echo -e "${BLUE}Setting up log rotation...${NC}"

sudo tee /etc/logrotate.d/myblog > /dev/null << EOF
/home/ec2-user/app/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ec2-user ec2-user
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

print_status "Log rotation configured"

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository to $APP_DIR"
echo "2. Update .env.production with actual values"
echo "3. Run the deployment script: ./deploy.sh"
echo "4. Configure your domain and SSL certificate"
echo ""
echo "Useful commands:"
echo "  pm2 status         - Check application status"
echo "  pm2 logs           - View application logs"
echo "  pm2 monit          - Real-time monitoring"
echo "  redis-cli          - Access Redis CLI"
echo "  sudo nginx -t      - Test Nginx config"
echo "  sudo systemctl status nginx|redis6"
echo ""
echo -e "${YELLOW}Remember to:${NC}"
echo "- Set up RDS PostgreSQL instance"
echo "- Configure security groups (ports 80, 443, 22)"
echo "- Set up CloudFront CDN for static assets"
echo "- Configure Route 53 for domain"
echo "- Set up SSL certificate with Let's Encrypt"
echo ""
echo -e "${GREEN}Happy deploying! 🚀${NC}"