#!/bin/bash
# scripts/restore-db.sh

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.sql>"
  exit 1
fi

backup_file=$1

if [ ! -f "$backup_file" ]; then
  echo "Backup file not found: $backup_file"
  exit 1
fi

DB_NAME="dsa_db"
DB_USER="dsa_user"

echo "Restoring database from ${backup_file}..."
cat ${backup_file} | docker exec -i dsa-postgres psql -U ${DB_USER} -d ${DB_NAME}

if [ $? -eq 0 ]; then
  echo "Restore successful!"
else
  echo "Restore failed!"
  exit 1
fi
