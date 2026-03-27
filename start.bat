@echo off
set NODE_OPTIONS=--max-old-space-size=8192
set UV_THREADPOOL_SIZE=2
npx expo start --lan --clear --no-dev
