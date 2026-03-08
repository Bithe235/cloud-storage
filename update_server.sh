#!/bin/bash
set -e

# RUN THIS SCRIPT TO UPDATE THE SERVER WHEN YOU PUSH NEW CODE TO GITHUB

echo "================================================="
echo "   Pentaract Auto-Update Script (Debian)         "
echo "================================================="

PROJECT_DIR=$(pwd)
GO_SERVICE="pentaract-go"
RUST_SERVICE="pentaract-rust"

echo "[1/4] Pulling latest code from GitHub..."
git pull origin main

echo "[2/4] Rebuilding Rust Engine natively..."
cd "$PROJECT_DIR/pentaract"
cargo build --release

echo "[3/4] Rebuilding Go Bridge API natively..."
cd "$PROJECT_DIR/backend"
# Ensure dependencies are tidy before building
go mod tidy
go build -o pentaract-bridge ./cmd/server/main.go

echo "[4/4] Restarting Background Services..."
sudo systemctl restart $RUST_SERVICE
sudo systemctl restart $GO_SERVICE

echo "================================================="
echo " 🎉 Update Complete! 🎉 "
echo " Services have been rebuilt and restarted."
echo "================================================="
