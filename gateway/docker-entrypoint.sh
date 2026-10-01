#!/bin/sh
set -eu

mkdir -p /data
chown qore:qore /data

exec gosu qore uvicorn qore_mobile_gateway.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8080}"
