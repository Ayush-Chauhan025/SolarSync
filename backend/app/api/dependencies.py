import os
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client
from supabase_auth.errors import AuthError, AuthRetryableError

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in the environment")

supabase_client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
bearer = HTTPBearer(auto_error=False)


def get_access_token( credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


def get_current_user(token: str = Depends(get_access_token)) -> UUID:
    try:
        response = supabase_client.auth.get_claims(token)
    except AuthRetryableError as exc:
        raise HTTPException( status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service temporarily unavailable") from exc
    except AuthError as exc:
        raise HTTPException( status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token", headers={"WWW-Authenticate": "Bearer"}) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not reach the authentication service") from exc

    # Supabase Python client versions have returned both a ClaimsResponse
    # object and a plain dictionary here. Normalize either shape before reading
    # the verified JWT subject.
    if isinstance(response, dict):
        claims = response.get("claims", response)
    else:
        claims = getattr(response, "claims", None)

    if isinstance(claims, dict):
        subject = claims.get("sub")
    else:
        subject = getattr(claims, "sub", None)
    try:
        return UUID(subject)
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException( status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has no valid user ID", headers={"WWW-Authenticate": "Bearer"}) from exc
