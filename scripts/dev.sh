echo "Prepare for development"
npm uninstall -g pr-desc-cli
npm run build
npm install -g .
echo "Done"