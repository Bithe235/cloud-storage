#!/bin/bash
set -e

# RUN THIS SCRIPT FROM THE root 'cloud-computing' DIRECTORY on your Debian Server

echo "================================================="
echo "   Pentaract Auto-Deployment Script (Debian)     "
echo "================================================="

# Allow running as root
# if [ "$EUID" -eq 0 ]; then
#   echo "Please run this script as your regular user (not root). It will prompt for sudo passwords automatically."
#   exit 1
# fi

PROJECT_DIR=$(pwd)
GO_SERVICE="pentaract-go"
RUST_SERVICE="pentaract-rust"
NGINX_CONF="/etc/nginx/sites-available/viteapp"

# Force reset to latest GitHub code to ensure server stays in sync with my fixes
if [ -d ".git" ]; then
    echo "Syncing with GitHub (Force Resetting)..."
    git fetch origin main
    git reset --hard origin/main
fi

echo "[1/5] Installing Debian System Dependencies..."
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev cmake curl nginx python3

# Force clear old Go version if it's not 1.24 to avoid GOROOT/Path issues
if [[ $(go version 2>/dev/null) != *"go1.24"* ]]; then
    echo "Modernizing Go environment (Installing 1.24.0)..."
    # Remove apt-installed old versions that cause conflicts
    sudo apt-get remove -y golang-go &>/dev/null || true
    sudo apt-get autoremove -y &>/dev/null || true
    
    curl -kLO https://go.dev/dl/go1.24.0.linux-amd64.tar.gz
    sudo rm -rf /usr/local/go 
    sudo tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz
    
    # Force system-wide priority
    sudo rm -f /usr/bin/go /usr/bin/gofmt
    sudo ln -sf /usr/local/go/bin/go /usr/bin/go
    sudo ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt
    
    export PATH=/usr/local/go/bin:$PATH
    rm go1.24.0.linux-amd64.tar.gz
    echo "Go 1.24.0 installed and symlinked as default."
fi
export PATH=/usr/local/go/bin:$PATH
export GOROOT=/usr/local/go
export GOPATH=$HOME/go

# Install Rust if missing
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source "$HOME/.cargo/env"

echo "[1.5/5] Automatically configuring .env file..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
cat << 'EOF' > "$PROJECT_DIR/.env"
PORT=8041
GO_PORT=8040
WORKERS=4
CHANNEL_CAPACITY=32
SUPERUSER_EMAIL=master@pentaract.local
SUPERUSER_PASS=pentaract
ACCESS_TOKEN_EXPIRE_IN_SECS=1800
REFRESH_TOKEN_EXPIRE_IN_DAYS=14
SECRET_KEY=8399893179:AAHplPUULPuc7G8-5sM8a-_bC35LbfuOAvk
TELEGRAM_API_BASE_URL=https://api.telegram.org

PENTARACT_API_URL=http://localhost:8041/api
DATABASE_URL='postgresql://neondb_owner:npg_4FrYfEaQ8PeX@ep-purple-bar-a4h2jbm9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# Centralized Cloud-Computing (Go Bridge) Telegram Mapping
TELEGRAM_BOT_TOKEN=8399893179:AAHplPUULPuc7G8-5sM8a-_bC35LbfuOAvk
TELEGRAM_CHAT_ID=1483501110 # Set to user's private chat ID
MASTER_UUID=17ffbf0e-c1b2-4059-a0ce-5822aa556022
RUST_MASTER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1hc3RlckBwZW50YXJhY3QubG9jYWwiLCJleHAiOjQ5MjY1ODkwOTQsInN1YiI6IjE3ZmZiZjBlLWMxYjItNDA1OS1hMGNlLTU4MjJhYTU1NjAyMiJ9.-fSBvjSzh-eaY6EaDmxPqvVxcrd1LhmQH0sLM6VDCq4
NEXT_CLIENT_URL=https://server.fahadakash.com
ADMIN_CLIENT_URL=https://server.fahadakash.com
EOF
    echo "Successfully generated .env file safely on the server!"
else
    echo ".env file already exists. Skipping auto-generation."
fi

echo "[2/5] Building Rust Engine natively..."
cd "$PROJECT_DIR/pentaract"
cargo build --release

echo "[3/5] Building Go Bridge API natively..."
cd "$PROJECT_DIR/backend"
go build -o pentaract-bridge ./cmd/server/main.go

echo "[4/5] Setting up Systemd background Services..."
# Setup Rust Service
cat <<EOF | sudo tee /etc/systemd/system/$RUST_SERVICE.service
[Unit]
Description=Pentaract Rust Storage Engine
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR/pentaract
ExecStart=$PROJECT_DIR/pentaract/target/release/pentaract
Restart=always
RestartSec=5
EnvironmentFile=$PROJECT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

# Setup Go Service
cat <<EOF | sudo tee /etc/systemd/system/$GO_SERVICE.service
[Unit]
Description=Pentaract Go Bridge API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/pentaract-bridge
Restart=always
RestartSec=5
EnvironmentFile=$PROJECT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $RUST_SERVICE
sudo systemctl enable $GO_SERVICE
sudo systemctl restart $RUST_SERVICE
sudo systemctl restart $GO_SERVICE

echo "[5/5] Injecting Nginx Configuration..."

# Safe Python injection script that finds the last server block closing brace
sudo python3 -c "
import sys

conf_file = '$NGINX_CONF'
location_block = \"\"\"
    # --- PENTARACT: GO BRIDGE API (New Project) ---
    location /penta/ {
        # Redirects to your Go backend on port 8040
        proxy_pass http://127.0.0.1:8040/; 
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \\\"keep-alive\\\";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Optimized for file storage
        client_max_body_size 100M; 
        proxy_read_timeout 300;
    }
\"\"\"
#
try:
    with open(conf_file, 'r') as f:
        content = f.read()
    
    if '/penta/' not in content:
        # Find the absolute last closing brace in the file
        last_brace_idx = content.rfind('}')
        if last_brace_idx != -1:
            new_content = content[:last_brace_idx] + location_block + content[last_brace_idx:]
            with open(conf_file, 'w') as f:
                f.write(new_content)
            print('Successfully injected /penta/ location block into NGINX.')
        else:
            print('Warning: Could not find closing brace to auto-inject Nginx block.')
            print(location_block)
    else:
        print('Nginx config already natively contains the /penta/ route. Skipping injection.')
except Exception as e:
    print('Warning: File not found or read error:', e)
    print('Please manually insert the following block into your nginx sites-available config:')
    print(location_block)
"

# Test and Restart Nginx
sudo nginx -t && sudo systemctl restart nginx

echo "================================================="
echo " 🎉 Deployment Complete! 🎉 "
echo " Services are now running continuously in the background natively."
echo ""
echo " To view live Rust logs:  sudo journalctl -u $RUST_SERVICE -f"
echo " To view live Go logs:    sudo journalctl -u $GO_SERVICE -f"
echo "================================================="
