#!/bin/bash
# scripts/backup-db.sh

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_NAME="dsa_db"
DB_USER="dsa_user"
backup_date=$(date +%Y-%m-%d_%H-%M-%S)
backup_file="backups/${DB_NAME}_${backup_date}.sql"

mkdir -p backups

echo "Starting database backup..."
docker exec dsa-postgres pg_dump -U ${DB_USER} ${DB_NAME} > ${backup_file}

if [ $? -eq 0 ]; then
  echo "Backup successful: ${backup_file}"
else
  echo "Backup failed!"
  exit 1
fi
