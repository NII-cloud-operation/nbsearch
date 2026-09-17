#!/usr/bin/env bash
set -euxo pipefail

SOLR_URL="${SOLR_URL:-http://localhost:8983/solr/admin/info/system}"
S3_URL="${S3_URL:-http://localhost:9000/healthz}"
MAX_RETRIES=60
SLEEP_SECONDS=5

echo "Waiting for Solr..."
for attempt in $(seq 1 "${MAX_RETRIES}"); do
  if curl -vvv --fail --show-error "${SOLR_URL}"; then
    echo "Solr is accepting connections at ${SOLR_URL}"
    break
  fi
  echo "Waiting for Solr... attempt ${attempt}/${MAX_RETRIES}" >&2
  sleep "${SLEEP_SECONDS}"
  if [ "${attempt}" -eq "${MAX_RETRIES}" ]; then
    docker compose ps >&2 || true
    >&2 echo "Timed out waiting for Solr at ${SOLR_URL}"
    exit 1
  fi
done

echo "Waiting for SeaweedFS..."
for attempt in $(seq 1 "${MAX_RETRIES}"); do
  if curl -vvv --fail --show-error "${S3_URL}"; then
    echo "SeaweedFS is accepting connections at ${S3_URL}"
    exit 0
  fi
  echo "Waiting for SeaweedFS... attempt ${attempt}/${MAX_RETRIES}" >&2
  sleep "${SLEEP_SECONDS}"
  if [ "${attempt}" -eq "${MAX_RETRIES}" ]; then
    docker compose ps >&2 || true
    >&2 echo "Timed out waiting for SeaweedFS at ${S3_URL}"
    exit 1
  fi
done
