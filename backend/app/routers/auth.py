from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
def login():
    # TODO: JWT token üret
    return {"mesaj": "login gelecek"}
