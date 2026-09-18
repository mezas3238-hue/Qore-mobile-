from datetime import UTC, datetime

from fastapi import FastAPI
from pydantic import BaseModel

from .models import AccountSnapshot, PortfolioSnapshot, PositionSnapshot, TraderSnapshot
from .repository import ReadRepository
from .service import build_portfolio_snapshot


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

read_repository = ReadRepository()


@app.get("/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        service="qore-mobile-gateway",
        status="ok",
        mode="read-only",
        server_time=datetime.now(UTC),
    )


@app.get("/v1/portfolio", response_model=PortfolioSnapshot)
def portfolio() -> PortfolioSnapshot:
    return build_portfolio_snapshot(
        accounts=read_repository.list_accounts(),
        traders=read_repository.list_traders(),
        positions=read_repository.list_positions(),
    )


@app.get("/v1/accounts", response_model=list[AccountSnapshot])
def accounts() -> list[AccountSnapshot]:
    return read_repository.list_accounts()


@app.get("/v1/traders", response_model=list[TraderSnapshot])
def traders() -> list[TraderSnapshot]:
    return read_repository.list_traders()


@app.get("/v1/positions", response_model=list[PositionSnapshot])
def positions() -> list[PositionSnapshot]:
    return read_repository.list_positions()
