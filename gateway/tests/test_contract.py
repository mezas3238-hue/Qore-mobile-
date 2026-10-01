from qore_mobile_gateway.main import app


def test_public_mobile_surface_contains_no_trading_commands() -> None:
    schema = app.openapi()
    paths = schema["paths"]

    public_paths = {
        "/v1/health",
        "/v1/portfolio",
        "/v1/accounts",
        "/v1/traders",
        "/v1/positions",
        "/v1/runtimes",
    }
    assert public_paths.issubset(paths)

    for path in public_paths:
        methods = set(paths[path])
        assert methods <= {"get", "parameters"}

    forbidden_terms = {
        "order",
        "trade/open",
        "trade/close",
        "position/close",
        "position/modify",
        "lot",
        "activate-live",
    }
    joined = "\n".join(paths).lower()
    assert all(term not in joined for term in forbidden_terms)
