#!/bin/bash
# SAFE for GCC — run from ANY directory (even ~/PhoneInfo)
set -e
echo "→ Resetting..."
cd ~
rm -rf ~/PhoneInfo
git clone https://github.com/sadapay404/PhoneInfo.git ~/PhoneInfo
cd ~/PhoneInfo
echo "→ In: $(pwd)"
ls -lh package.json vite.config.js
npm install
echo "→ Starting on 0.0.0.0:3000 → Use Web Preview → Preview on port 3000"
npm run dev
