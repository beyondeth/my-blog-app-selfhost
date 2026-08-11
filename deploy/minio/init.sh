#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing "local/$MINIO_BUCKET"
if ! mc cors set "local/$MINIO_BUCKET" /opt/minio/cors.json; then
  echo "Bucket-level CORS is unavailable; using MinIO's cluster-wide CORS setting."
fi
mc anonymous set none "local/$MINIO_BUCKET"

echo "MinIO bucket initialized: $MINIO_BUCKET"
