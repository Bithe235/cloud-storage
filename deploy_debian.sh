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
    
    # Try different sources for reliability (Forcing IPv4 as your server has IPv6 issues)
    rm -f go_dist.tar.gz
    echo "Downloading Go 1.24.0 from Google CDN (Forcing IPv4)..."
    
    # Official Google CDN usually works best
    if ! curl -4 -kL -o go_dist.tar.gz https://dl.google.com/go/go1.24.0.linux-amd64.tar.gz; then
        echo "Primary download failed. Trying alternative mirror..."
        curl -4 -kL -o go_dist.tar.gz https://go.dev/dl/go1.24.0.linux-amd64.tar.gz
    fi
    
    # Final check before extraction
    if [[ ! $(file go_dist.tar.gz) == *"gzip compressed data"* ]]; then
        echo "Alternative download method (using wget -4)..."
        wget -4 --no-check-certificate -O go_dist.tar.gz https://dl.google.com/go/go1.24.0.linux-amd64.tar.gz
    fi

    if [[ ! $(file go_dist.tar.gz) == *"gzip compressed data"* ]]; then
        echo "CRITICAL ERROR: Failed to download a valid Go binary. Your server's internet or firewall is blocking the download."
        exit 1
    fi

    sudo rm -rf /usr/local/go 
    sudo tar -C /usr/local -xzf go_dist.tar.gz
    
    # Force system-wide priority
    sudo rm -f /usr/bin/go /usr/bin/gofmt
    sudo ln -sf /usr/local/go/bin/go /usr/bin/go
    sudo ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt
    
    export PATH=/usr/local/go/bin:$PATH
    rm -f go_dist.tar.gz
    echo "Go 1.24.0 installed and symlinked successfully."
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

echo "[1.5/5] Checking and Updating .env file..."
DOTENV="$PROJECT_DIR/.env"

if [ ! -f "$DOTENV" ]; then
    echo "Creating new .env file..."
    cat << 'EOF' > "$DOTENV"
PORT=8041
GO_PORT=8040
WORKERS=4
CHANNEL_CAPACITY=32
SUPERUSER_EMAIL=master@pentaract.local
SUPERUSER_PASS=pentaract
SECRET_KEY=8399893179:AAHplPUULPuc7G8-5sM8a-_bC35LbfuOAvk
DATABASE_URL='postgresql://neondb_owner:npg_4FrYfEaQ8PeX@ep-purple-bar-a4h2jbm9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
NEXT_CLIENT_URL=https://server.fahadakash.com
ADMIN_CLIENT_URL=https://server.fahadakash.com
EOF
fi

# Ensure SMTP settings are present (Update or Append)
update_env() {
    local key=$1
    local value=$2
    if grep -q "^$key=" "$DOTENV"; then
        sudo sed -i "s|^$key=.*|$key=$value|" "$DOTENV"
    else
        echo "$key=$value" >> "$DOTENV"
    fi
}

echo "Injecting SMTP credentials into .env..."
update_env "SMTP_HOST" "smtp.stackmail.com"
update_env "SMTP_PORT" "465"
update_env "SMTP_USER" "storage@fahadakash.com"
update_env "SMTP_PASS" "Ba91374b7"

echo ".env file is now correctly configured."

echo "[2/5] Building Rust Engine natively..."
cd "$PROJECT_DIR/pentaract"
cargo build --release

echo "[3/5] Building Go Bridge API natively..."
cd "$PROJECT_DIR/backend"
go mod tidy
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

# Safe Python injection script using BEGIN/END markers for idempotency
sudo python3 -c "
import sys
import re

conf_file = '$NGINX_CONF'
location_block = \"\"\"
    # --- PENTARACT: BEGIN GO BRIDGE API ---
    location /penta/ {
        proxy_pass http://127.0.0.1:8040/; 
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \\\"keep-alive\\\";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 5G; 
        proxy_read_timeout 300;

        # CORS Preflight for Nginx protection
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, DELETE, PUT' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
    # --- PENTARACT: END GO BRIDGE API ---
\"\"\"

try:
    with open(conf_file, 'r') as f:
        content = f.read()
    
    pattern = re.compile(r'# --- PENTARACT: BEGIN GO BRIDGE API ---.*?# --- PENTARACT: END GO BRIDGE API ---', re.DOTALL)
    legacy_pattern = re.compile(r'location /penta/ \{.*?\}', re.DOTALL)
    
    if pattern.search(content):
        # Update existing block
        new_content = pattern.sub(location_block.strip() + '\n', content)
        with open(conf_file, 'w') as f:
            f.write(new_content)
        print('Successfully UPDATED /penta/ location block in NGINX.')
    elif legacy_pattern.search(content):
        # Update legacy block (without markers)
        new_content = legacy_pattern.sub(location_block.strip() + '\n', content)
        with open(conf_file, 'w') as f:
            f.write(new_content)
        print('Successfully REPLACED legacy /penta/ location block in NGINX.')
    elif '/penta/' not in content:
        # First time injection: Insert before the last closing brace
        last_brace_idx = content.rfind('}')
        if last_brace_idx != -1:
            new_content = content[:last_brace_idx] + location_block + content[last_brace_idx:]
            with open(conf_file, 'w') as f:
                f.write(new_content)
            print('Successfully INJECTED /penta/ location block into NGINX.')
        else:
            print('CRITICAL: No server block found in Nginx config.')
    else:
        print('Warning: /penta/ detected but could not pinpoint the block. Manual update of client_max_body_size to 5G recommended.')

except Exception as e:
    print('Warning: Nginx configuration error:', e)
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
