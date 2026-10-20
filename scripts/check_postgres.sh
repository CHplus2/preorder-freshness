#!/usr/bin/env bash
# Disposable TLS-enabled PostgreSQL only. Never reads the application's DB URL.
set -euo pipefail
cd "$(dirname "$0")/.."
fixture_dir=$(mktemp -d)
container="freshcast-ci-postgres-${RANDOM}-$$"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$fixture_dir"
}
trap cleanup EXIT
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$fixture_dir/server.key" -out "$fixture_dir/server.crt" \
  -subj '/CN=localhost' >/dev/null 2>&1
chmod 600 "$fixture_dir/server.key"
docker run --rm -d --name "$container" \
  -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data \
  --mount "type=bind,src=$fixture_dir,dst=/run/fixture-tls,readonly" \
  -e POSTGRES_PASSWORD=isolated-fixture-password -e POSTGRES_DB=freshcast_ci \
  postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea \
  sh -c 'cp /run/fixture-tls/server.crt /tmp/server.crt && cp /run/fixture-tls/server.key /tmp/server.key && chown postgres:postgres /tmp/server.crt /tmp/server.key && chmod 600 /tmp/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key' >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d freshcast_ci >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo 'Isolated PostgreSQL did not become ready.' >&2
  exit 1
fi
port=$(docker port "$container" 5432/tcp)
export DATABASE_URL="postgresql://postgres:isolated-fixture-password@127.0.0.1:${port##*:}/freshcast_ci"
export DATABASE_SCHEMA=public PYTHON_DOTENV_DISABLED=1 VERCEL=0 DEBUG=False
export SECRET_KEY=isolated-concurrency-check-only
"${FRESHCAST_TEST_PYTHON:-python}" backend/manage.py test \
  myapp.test_postgres_commitments myapp.test_postgres_operations --noinput
