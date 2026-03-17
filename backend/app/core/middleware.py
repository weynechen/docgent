"""Application middleware."""

from typing import ClassVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import RequestContextMiddleware as RequestIDMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware that adds security headers to all responses.

    This includes:
    - Content-Security-Policy (CSP)
    - X-Content-Type-Options
    - X-Frame-Options
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy

    Usage:
        app.add_middleware(SecurityHeadersMiddleware)

        # Or with custom CSP:
        app.add_middleware(
            SecurityHeadersMiddleware,
            csp_directives={
                "default-src": "'self'",
                "script-src": "'self' 'unsafe-inline'",
            }
        )
    """

    DEFAULT_CSP_DIRECTIVES: ClassVar[dict[str, str]] = {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",  # Allow inline styles for some UI libs
        "img-src": "'self' data: https:",
        "font-src": "'self' data:",
        "connect-src": "'self'",
        "frame-ancestors": "'none'",
        "base-uri": "'self'",
        "form-action": "'self'",
    }

    def __init__(
        self,
        app,
        csp_directives: dict | None = None,
        exclude_paths: set | None = None,
    ):
        super().__init__(app)
        self.csp_directives = csp_directives or self.DEFAULT_CSP_DIRECTIVES
        self.exclude_paths = exclude_paths or {"/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next) -> Response:
        """Add security headers to the response."""
        response = await call_next(request)

        # Skip for docs/openapi endpoints which need different CSP
        if request.url.path in self.exclude_paths:
            return response

        # Build CSP header
        csp_value = "; ".join(
            f"{directive} {value}" for directive, value in self.csp_directives.items()
        )

        # Add security headers
        response.headers["Content-Security-Policy"] = csp_value
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        return response
