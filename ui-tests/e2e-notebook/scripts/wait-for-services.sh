#!/usr/bin/env bash
set -euxo pipefail

SOLR_URL="${SOLR_URL:-http://localhost:8983/solr/admin/info/system}"
GARAGE_URL="${GARAGE_URL:-http://localhost:3903/health}"
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

echo "Waiting for Garage..."
for attempt in $(seq 1 "${MAX_RETRIES}"); do
  if curl -vvv --fail --show-error "${GARAGE_URL}"; then
    echo "Garage is accepting connections at ${GARAGE_URL}"
    exit 0
  fi
  echo "Waiting for Garage... attempt ${attempt}/${MAX_RETRIES}" >&2
  sleep "${SLEEP_SECONDS}"
  if [ "${attempt}" -eq "${MAX_RETRIES}" ]; then
    docker compose ps >&2 || true
    >&2 echo "Timed out waiting for Garage at ${GARAGE_URL}"
    exit 1
  fi
done
