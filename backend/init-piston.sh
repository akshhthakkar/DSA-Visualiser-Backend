#!/bin/bash
# Piston API endpoint (internal to the docker-compose network)
PISTON_URL="http://piston:2000"

echo "Waiting for Piston API to start..."
until curl -s "$PISTON_URL/api/v2/runtimes" > /dev/null; do
  sleep 2
done

echo "Piston API is up. Installing runtimes..."

# Install runtimes required for DSA Visualizer
curl -X POST "$PISTON_URL/api/v2/packages" -H "Content-Type: application/json" -d '{"language":"java","version":"15.0.2"}'
curl -X POST "$PISTON_URL/api/v2/packages" -H "Content-Type: application/json" -d '{"language":"node","version":"18.15.0"}'
curl -X POST "$PISTON_URL/api/v2/packages" -H "Content-Type: application/json" -d '{"language":"python","version":"3.10.0"}'
curl -X POST "$PISTON_URL/api/v2/packages" -H "Content-Type: application/json" -d '{"language":"gcc","version":"10.2.0"}'

echo "All runtimes installed. Setting up C++ (g++) compilation patch..."

# Patch the compile script inside the gcc package to support C++ (.cpp) files
cat << 'EOF' > /tmp/piston_compile_patch
#!/usr/bin/env bash
HAS_CPP=false
for f in "$@"; do
    if [[ "$f" == *.cpp ]]; then
        HAS_CPP=true
        break
    fi
done

if [ "$HAS_CPP" = true ]; then
    g++ -o a.out "$@" -lm
else
    gcc -o a.out "$@" -lm
fi
chmod +x a.out
EOF

# Use docker exec to copy the patch into the running Piston container
docker cp /tmp/piston_compile_patch dsavisualizer-piston:/piston/packages/gcc/10.2.0/compile
docker exec dsavisualizer-piston chmod +x /piston/packages/gcc/10.2.0/compile

echo "Piston initialization complete!"
