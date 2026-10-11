from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client
from supabase_auth.errors import AuthError, AuthRetryableError

from app.api.dependencies import (
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL,
    get_access_token,
    get_current_user,
)
from app.schemas import AuthCredentials, AuthResponse, AuthUserResponse, LogoutResponse, RefreshTokenRequest

router = APIRouter()


def _new_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)


def _auth_response(auth_result, message: str) -> AuthResponse:
    user = auth_result.user
    if user is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Supabase Auth returned no user")

    session = auth_result.session
    return AuthResponse(
        user=AuthUserResponse(id=user.id, email=user.email),
        access_token=session.access_token if session else None,
        refresh_token=session.refresh_token if session else None,
        token_type=session.token_type if session else None,
        expires_in=session.expires_in if session else None,
        expires_at=session.expires_at if session else None,
        message=message,
    )


@router.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def sign_up(body: AuthCredentials):
    client = _new_supabase_client()
    try:
        result = client.auth.sign_up({"email": body.email, "password": body.password})
    except AuthRetryableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service temporarily unavailable") from exc
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create account; check the details and try again") from exc

    message = "Account created; check your email to confirm it before logging in" if result.session is None else "Account created and signed in"
    return _auth_response(result, message)


@router.post("/auth/login", response_model=AuthResponse)
def sign_in(body: AuthCredentials):
    client = _new_supabase_client()
    try:
        result = client.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except AuthRetryableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service temporarily unavailable") from exc
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password, or email not confirmed") from exc

    if result.session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No session was returned; confirm your email and log in again")
    return _auth_response(result, "Signed in")


@router.post("/auth/refresh", response_model=AuthResponse)
def refresh_session(body: RefreshTokenRequest):
    client = _new_supabase_client()
    try:
        result = client.auth.refresh_session(body.refresh_token)
    except AuthRetryableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service temporarily unavailable") from exc
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token") from exc

    if result.session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase did not return a refreshed session")
    return _auth_response(result, "Session refreshed")


@router.post("/auth/logout", response_model=LogoutResponse)
def sign_out(body: RefreshTokenRequest, access_token: str = Depends(get_access_token)):
    client = _new_supabase_client()
    try:
        client.auth.set_session(access_token, body.refresh_token)
        client.auth.sign_out({"scope": "local"})
    except AuthRetryableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service temporarily unavailable") from exc
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not end this session; refresh the session and try again") from exc

    return LogoutResponse(message="Session ended; the current access token may remain valid until it expires")


@router.get("/auth/me")
def check_user(user_id=Depends(get_current_user)):
    return {"user_id": str(user_id)}
