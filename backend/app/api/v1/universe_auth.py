"""
API endpoints для авторизации Universe
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

from app.core.database import get_db
from app.core.universe_auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user,
)
from app.models.universe_user import UniverseUser
from app.schemas.universe_user import (
    UserRegister,
    UserLogin,
    UserResponse,
    UserUpdate,
    PasswordChange,
    TokenResponse,
)
from datetime import timedelta

# Настройка логирования
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["universe-auth"])


# Явные обработчики OPTIONS для всех auth endpoints
@router.options("/register")
@router.options("/register/")  # Добавляем обработчик для trailing slash
@router.options("/signup")  # Альтернативный endpoint
@router.options("/signup/")  # Альтернативный endpoint с trailing slash
@router.options("/login")
@router.options("/me")
@router.options("/change-password")
async def options_auth():
    """
    Обработчик OPTIONS для auth endpoints (CORS preflight)
    Возвращает 204 No Content с необходимыми CORS заголовками
    """
    logger.info("OPTIONS request received for auth endpoint")
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
            "Access-Control-Max-Age": "3600",
        }
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@router.post("/register/", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)  # Добавляем endpoint с trailing slash
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)  # Альтернативный endpoint без проблем с trailing slash
@router.post("/signup/", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)  # Альтернативный endpoint с trailing slash
async def register(
    user_data: UserRegister,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Регистрация нового пользователя
    
    Создает нового пользователя в системе с валидацией:
    - Проверка уникальности email
    - Хеширование пароля
    - Создание JWT токена для автоматического входа
    
    Args:
        user_data: Данные для регистрации (email, password, name, company_name)
        request: FastAPI Request объект для логирования
        db: Сессия базы данных
        
    Returns:
        TokenResponse с JWT токеном и данными пользователя
        
    Raises:
        HTTPException 400: Если пользователь с таким email уже существует
        HTTPException 500: При ошибке создания пользователя в БД
    """
    # Нормализуем email (приводим к нижнему регистру)
    normalized_email = user_data.email.lower().strip()
    
    logger.info(f"Registration attempt for email: {normalized_email}")
    
    # Проверяем, существует ли пользователь с таким email
    existing_user = db.query(UniverseUser).filter(
        UniverseUser.email == normalized_email
    ).first()
    
    if existing_user:
        logger.warning(f"Registration failed: email {normalized_email} already exists")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )
    
    # Валидация пароля (дополнительная проверка на стороне сервера)
    if len(user_data.password) < 8:
        logger.warning(f"Registration failed: password too short for {normalized_email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен содержать минимум 8 символов"
        )
    
    # Валидация имени
    if not user_data.name or len(user_data.name.strip()) < 2:
        logger.warning(f"Registration failed: invalid name for {normalized_email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя должно содержать минимум 2 символа"
        )
    
    # Хешируем пароль
    try:
        hashed_password = get_password_hash(user_data.password)
    except Exception as e:
        logger.error(f"Password hashing failed for {normalized_email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при обработке пароля"
        )
    
    # Создаем нового пользователя
    new_user = UniverseUser(
        email=normalized_email,
        password_hash=hashed_password,
        name=user_data.name.strip(),
        company_name=user_data.company_name.strip() if user_data.company_name else None,
        is_active=True,
        is_verified=False,  # Можно добавить верификацию по email позже
    )
    
    # Сохраняем пользователя в БД
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"User successfully created: {new_user.id} ({normalized_email})")
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error during registration for {normalized_email}: {e}")
        # Проверяем, не появился ли пользователь между проверкой и вставкой
        existing_user = db.query(UniverseUser).filter(
            UniverseUser.email == normalized_email
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании пользователя. Попробуйте позже."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during registration for {normalized_email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера. Попробуйте позже."
        )
    
    # Создаем JWT токен для автоматического входа
    try:
        access_token_expires = timedelta(minutes=60 * 24 * 7)  # 7 дней
        access_token = create_access_token(
            data={"sub": str(new_user.id)},
            expires_delta=access_token_expires
        )
        logger.info(f"Access token created for user: {new_user.id}")
    except Exception as e:
        logger.error(f"Token creation failed for user {new_user.id}: {e}")
        # Пользователь уже создан, но токен не создан - это критическая ошибка
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании токена доступа"
        )
    
    # Формируем ответ
    try:
        user_response = UserResponse.model_validate(new_user)
        response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        logger.info(f"Registration successful for user: {new_user.id} ({normalized_email})")
        return response
    except Exception as e:
        logger.error(f"Response creation failed for user {new_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при формировании ответа"
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Вход пользователя"""
    logger.info(f"🔐 Попытка входа: email={credentials.email}")
    # Находим пользователя по email
    user = db.query(UniverseUser).filter(UniverseUser.email == credentials.email).first()
    
    if not user:
        logger.warning(f"❌ Пользователь не найден: email={credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(credentials.password, user.password_hash):
        logger.warning(f"❌ Неверный пароль для пользователя: email={credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        logger.warning(f"❌ Пользователь неактивен: email={credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь неактивен"
        )
    
    # Создаем токен
    access_token_expires = timedelta(minutes=60 * 24 * 7)  # 7 дней
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    logger.info(f"✅ Успешный вход: email={credentials.email}, user_id={user.id}")
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: UniverseUser = Depends(get_current_active_user)
):
    """Получить информацию о текущем пользователе"""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: UniverseUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить информацию о текущем пользователе"""
    # Обновляем поля, если они переданы
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.company_name is not None:
        current_user.company_name = user_update.company_name
    if user_update.email is not None:
        # Проверяем, не занят ли email другим пользователем
        existing_user = db.query(UniverseUser).filter(
            UniverseUser.email == user_update.email,
            UniverseUser.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        current_user.email = user_update.email
    
    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ошибка при обновлении пользователя"
        )
    
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: UniverseUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Сменить пароль"""
    # Проверяем текущий пароль
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    # Устанавливаем новый пароль
    current_user.password_hash = get_password_hash(password_data.new_password)
    
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при смене пароля"
        )
    
    return {"message": "Пароль успешно изменен"}

