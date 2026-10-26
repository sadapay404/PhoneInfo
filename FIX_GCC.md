# GCC Fix - cwd deleted
If you see: `fatal: Unable to read current working directory: No such file or directory`
You deleted the folder you were standing in!

Fix (copy these 5 lines ONE BY ONE):
```
cd ~
rm -rf ~/PhoneInfo
git clone https://github.com/sadapay404/PhoneInfo.git ~/PhoneInfo
cd ~/PhoneInfo
npm install && npm run dev
```
Then: Web Preview (top-right) → Preview on port 3000
