#!/bin/bash
# Kill whatever's on port 3005 and restart the dev server

echo "Killing processes on port 3005..."
lsof -ti:3005 | xargs kill -9 2>/dev/null

if [ $? -eq 0 ]; then
  echo "Killed existing process."
else
  echo "Nothing was running on 3005."
fi

echo "Starting dev server on port 3005..."
cd "$(dirname "$0")/.." && npm run dev
