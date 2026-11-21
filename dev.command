#!/bin/bash
# Start Fitoor locally (double-click). Opens http://localhost:5173
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
npm run dev -- --open
