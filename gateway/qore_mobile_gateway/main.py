from datetime import UTC, datetime

from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    service: str
    status: str
    mode: str
    server_time: datetime


app = FastAPI(
    title="QORE Mobile Gateway",
    version="0.1.0",
    description=(
        "Read-only supervision gateway. This service does not expose "
        "trading execution endpoints."
    ),
)


@app.get("/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        service="qore-mobile-gateway",
        status="ok",
        mode="read-only",
        server_time=datetime.now(UTC),
    )
