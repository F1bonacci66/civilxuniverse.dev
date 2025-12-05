"""
API v1 роутеры
"""
from fastapi import APIRouter
from app.api.v1 import upload, conversion, export_settings, data, projects, pivot, health, universe_auth

router = APIRouter(redirect_slashes=False)

# Подключаем роутеры
router.include_router(health.router, tags=["health"])
router.include_router(universe_auth.router, tags=["universe-auth"])
router.include_router(upload.router, prefix="/upload", tags=["upload"])
router.include_router(conversion.router, prefix="/conversion", tags=["conversion"])
router.include_router(export_settings.router, prefix="/export-settings", tags=["export-settings"])
router.include_router(data.router, tags=["data"])
router.include_router(projects.router, tags=["projects"])
router.include_router(pivot.router, tags=["pivot"])

