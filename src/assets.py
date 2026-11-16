"""Platform-independent media types for strict browser module loading."""

from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class FrontendFiles(StaticFiles):
    """Serve local scripts/styles with web media types, regardless of Windows registry."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        """Preserve static handling while ensuring valid module and stylesheet types.

        Args:
            path: Validated relative static asset path.
            scope: ASGI request scope.

        Returns:
            Normal static response with a deterministic Content-Type for JS/CSS.
        """
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            if path.endswith(".js"):
                response.headers["content-type"] = "text/javascript; charset=utf-8"
            elif path.endswith(".css"):
                response.headers["content-type"] = "text/css; charset=utf-8"
        return response
