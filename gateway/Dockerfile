FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
COPY qore_mobile_gateway ./qore_mobile_gateway

RUN python -m pip install --upgrade pip \
    && python -m pip install .

RUN useradd --create-home --uid 10001 qore \
    && mkdir -p /data \
    && chown -R qore:qore /app /data

USER qore

EXPOSE 8080

CMD ["sh", "-c", "uvicorn qore_mobile_gateway.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
