"""
Health check endpoint для API
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"], redirect_slashes=False)


@router.get("/health")
@router.get("/health/")  # Поддержка обоих вариантов (с слэшем и без)
async def health_check():
    """Health check endpoint - не требует авторизации"""
    return JSONResponse(
        status_code=200,
        content={"status": "healthy", "message": "Backend is running"}
    )

