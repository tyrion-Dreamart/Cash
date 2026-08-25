from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
import bcrypt
import jwt
import datetime
import os
from dotenv import load_dotenv
load_dotenv()

SECRET = os.environ.get("JWT_SECRET")
if not SECRET:
    raise RuntimeError("JWT_SECRET no esta configurada (revisa backend/.env)")

router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer()

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    role: str
    username: str

@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    from sqlalchemy import text
    result = db.execute(text("SELECT username, password_hash, role FROM users WHERE username = :u"), {"u": data.username}).fetchone()
    if not result:
        raise HTTPException(401, "Credenciales incorrectas")
    if not bcrypt.checkpw(data.password.encode(), result.password_hash.encode()):
        raise HTTPException(401, "Credenciales incorrectas")
    token = jwt.encode({
        "sub": result.username,
        "role": result.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }, SECRET, algorithm="HS256")
    return LoginResponse(token=token, role=result.role, username=result.username)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token invalido o expirado")
    return {"username": payload.get("sub"), "role": payload.get("role")}


def require_editor(user: dict = Depends(get_current_user)) -> dict:
    """Blocks the 'viewer' role from write operations."""
    if user.get("role") == "viewer":
        raise HTTPException(403, "Tu rol (viewer) no tiene permiso para modificar datos")
    return user


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user