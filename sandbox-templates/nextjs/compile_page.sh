#!/bin/bash

# This script runs during building the sandbox template
# and makes sure the Next.js app is (1) running and (2) the `/` page is compiled

# CRITICAL FIX: Remove pages/ directory to prevent App Router + Pages Router conflict
if [ -d "/home/user/pages" ]; then
    echo "Warning: pages/ directory detected. Removing to prevent routing conflicts..."
    rm -rf /home/user/pages
    echo "pages/ directory removed successfully"
fi

function ping_server() {
	counter=0
	response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
	while [[ ${response} -ne 200 ]]; do
	  let counter++
	  if  (( counter % 20 == 0 )); then
        echo "Waiting for server to start..."
        sleep 0.1
      fi

	  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000")
	done
}

ping_server &
cd /home/user && npx next dev --turbopack