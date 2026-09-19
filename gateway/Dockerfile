FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY qore_mobile_gateway ./qore_mobile_gateway

RUN python -m pip install --upgrade pip \
    && python -m pip install .

RUN useradd --create-home --uid 10001 qore \
    && mkdir -p /data \
    && chown -R qore:qore /app /data

COPY docker-entrypoint.sh /usr/local/bin/qore-mobile-entrypoint
RUN chmod 0755 /usr/local/bin/qore-mobile-entrypoint

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/qore-mobile-entrypoint"]
