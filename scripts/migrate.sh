#!/bin/bash
# Database migration script for production

echo "Running Prisma database push..."
npx prisma db push --accept-data-loss

echo "Migration complete!"
