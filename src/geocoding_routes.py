"""Address navigation API, separate from all acoustic requests and saved scenarios."""

from fastapi import APIRouter, HTTPException

from .geocoding import GeocodingBusy, GeocodingUnavailable, PhotonClient, Place, SearchQuery

router = APIRouter(prefix="/api")
client = PhotonClient()


@router.post("/geocode", response_model=list[Place])
def geocode(query: SearchQuery) -> list[Place]:
    """Find address suggestions without logging search text in local request URLs.

    Args:
        query: Only search text and camera bias, never acoustic inputs.

    Returns:
        At most five labelled locations.

    Raises:
        HTTPException: Busy or unavailable external search service.
    """
    try:
        return client.search(query)
    except GeocodingBusy as error:
        raise HTTPException(
            429, "Address search is busy. Try again shortly.", headers={"Retry-After": str(error.retry_after)}
        ) from error
    except GeocodingUnavailable as error:
        raise HTTPException(503, "Address search is unavailable. Try again or use coordinates.") from error
