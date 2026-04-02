#!/bin/bash
# Generate RS256 Keypair for JWT

# Create keys directory
mkdir -p keys

# Generate private key
openssl genrsa -out keys/private.pem 2048

# Generate public key
openssl rsa -in keys/private.pem -outform PEM -pubout -out keys/public.pem

echo "Keys generated successfully in ./keys directory."
echo ""
echo "For .env file, you can base64 encode them:"
echo "JWT_PRIVATE_KEY=\$(cat keys/private.pem | base64 -w 0)"
echo "JWT_PUBLIC_KEY=\$(cat keys/public.pem | base64 -w 0)"
