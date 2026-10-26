#!/bin/bash
# Copy-paste this ENTIRE block into Google Cloud Shell (GCC)
set -e
echo "→ Cleaning old clone if exists..."
rm -rf ~/PhoneInfo
echo "→ Cloning..."
git clone https://github.com/sadapay404/PhoneInfo.git ~/PhoneInfo
cd ~/PhoneInfo
echo "→ Current directory: $(pwd)"
ls -lh package.json vite.config.js
echo "→ Installing..."
npm install
echo "→ Starting dev server on 0.0.0.0:3000 (Cloud Shell Preview)..."
echo "   After it starts, click: Web Preview (top-right eye icon) → Preview on port 3000 → Change port to 3000 if needed"
npm run dev
