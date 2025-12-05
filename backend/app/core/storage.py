"""
Сервис для работы с файловым хранилищем (MinIO/S3)
"""
from typing import BinaryIO, Optional
import os
from pathlib import Path
from minio import Minio
from minio.error import S3Error
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings


class StorageService:
    """Сервис для работы с файловым хранилищем"""
    
    def __init__(self):
        self._client = None
        self._bucket = None
        self._storage_type = None
        self._initialized = False
        self._use_local_storage = False
        self._local_storage_path = None
    
    def _initialize(self):
        """Ленивая инициализация - только при первом использовании"""
        if self._initialized:
            return
        
        if settings.STORAGE_TYPE == "s3":
            self._client = boto3.client(
                "s3",
                aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
                region_name=settings.S3_REGION,
            )
            self._bucket = settings.S3_BUCKET
            self._storage_type = "s3"
        else:
            # MinIO
            try:
                # Создаем клиент MinIO (это может не падать, если MinIO недоступен)
                self._client = Minio(
                    settings.MINIO_ENDPOINT,
                    access_key=settings.MINIO_ACCESS_KEY,
                    secret_key=settings.MINIO_SECRET_KEY,
                    secure=settings.MINIO_USE_SSL,
                )
                self._bucket = settings.MINIO_BUCKET
                self._storage_type = "minio"
                
                # Проверяем доступность MinIO, пытаясь проверить/создать bucket
                # Это может упасть с ошибкой подключения, если MinIO недоступен
                try:
                    if not self._client.bucket_exists(self._bucket):
                        self._client.make_bucket(self._bucket)
                except Exception as bucket_error:
                    # Если не удалось создать/проверить bucket, значит MinIO недоступен
                    raise Exception(f"MinIO недоступен при проверке bucket: {bucket_error}")
            except Exception as e:
                print(f"ВНИМАНИЕ: Не удалось подключиться к MinIO: {e}")
                print("Используем локальное файловое хранилище для разработки.")
                # Используем локальное хранилище как fallback
                self._use_local_storage = True
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                self._local_storage_path = os.path.join(backend_dir, "storage")
                os.makedirs(self._local_storage_path, exist_ok=True)
                self._client = None
                self._bucket = None
                self._storage_type = "local"
        
        self._initialized = True
    
    @property
    def client(self):
        """Получить клиент хранилища (с ленивой инициализацией)"""
        if not self._initialized:
            try:
                self._initialize()
            except Exception as e:
                # Если инициализация не удалась, переключаемся на локальное хранилище
                print(f"Ошибка инициализации при получении client: {e}")
                print("Переключаемся на локальное хранилище.")
                self._use_local_storage = True
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                self._local_storage_path = os.path.join(backend_dir, "storage")
                os.makedirs(self._local_storage_path, exist_ok=True)
                self._client = None
                self._bucket = None
                self._storage_type = "local"
                self._initialized = True
        return self._client
    
    @property
    def bucket(self):
        """Получить имя bucket (с ленивой инициализацией)"""
        if not self._initialized:
            self._initialize()
        if self._use_local_storage:
            return "local"
        return self._bucket or "local"
    
    @property
    def storage_type(self):
        """Получить тип хранилища (с ленивой инициализацией)"""
        if not self._initialized:
            self._initialize()
        return self._storage_type
    
    def _ensure_bucket_exists(self):
        """Убедиться, что bucket существует (только для MinIO)"""
        if self._storage_type == "minio" and self._client:
            try:
                if not self._client.bucket_exists(self._bucket):
                    self._client.make_bucket(self._bucket)
            except Exception as e:
                # Если не удалось проверить/создать bucket, значит MinIO недоступен
                print(f"Ошибка при создании/проверке bucket: {e}")
                raise Exception(f"MinIO bucket недоступен: {e}")
    
    def upload_file(
        self,
        file_path: str,
        object_name: str,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Загрузить файл в хранилище
        
        Args:
            file_path: Локальный путь к файлу
            object_name: Имя объекта в хранилище
            content_type: MIME тип файла
            
        Returns:
            Путь к файлу в хранилище
        """
        # Инициализируем, если еще не инициализировано
        if not self._initialized:
            try:
                self._initialize()
            except Exception as init_error:
                # Если инициализация не удалась, переключаемся на локальное хранилище
                print(f"Ошибка инициализации хранилища: {init_error}")
                print("Переключаемся на локальное хранилище.")
                self._use_local_storage = True
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                self._local_storage_path = os.path.join(backend_dir, "storage")
                os.makedirs(self._local_storage_path, exist_ok=True)
                self._initialized = True
        
        # Если MinIO/S3 недоступен, используем локальное хранилище
        if self._use_local_storage:
            if not self._local_storage_path:
                raise Exception("Локальное хранилище не инициализировано")
            local_file_path = os.path.join(self._local_storage_path, object_name)
            # Создаем директорию, если её нет
            dir_path = os.path.dirname(local_file_path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            import shutil
            print(f"📁 Сохраняем файл в локальное хранилище: {file_path} -> {local_file_path}")
            print(f"   Директория: {dir_path}")
            print(f"   Исходный размер: {os.path.getsize(file_path) if os.path.exists(file_path) else 'N/A'} байт")
            shutil.copy2(file_path, local_file_path)
            # Проверяем, что файл действительно скопировался
            if not os.path.exists(local_file_path):
                raise Exception(f"Файл не был скопирован: {local_file_path}")
            copied_size = os.path.getsize(local_file_path)
            source_size = os.path.getsize(file_path)
            if copied_size != source_size:
                raise Exception(
                    f"Размер скопированного файла не совпадает: "
                    f"исходный={source_size}, скопированный={copied_size}"
                )
            print(f"✅ Файл успешно сохранен: {local_file_path} ({copied_size} байт)")
            return f"local://{object_name}"
        
        # Если дошли до сюда, значит пытаемся использовать MinIO/S3
        # Проверяем, что клиент настроен
        if not self.client:
            # Если клиент не настроен, переключаемся на локальное хранилище
            print("ВНИМАНИЕ: Хранилище не настроено, переключаемся на локальное хранилище.")
            self._use_local_storage = True
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            self._local_storage_path = os.path.join(backend_dir, "storage")
            os.makedirs(self._local_storage_path, exist_ok=True)
            local_file_path = os.path.join(self._local_storage_path, object_name)
            dir_path = os.path.dirname(local_file_path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            import shutil
            shutil.copy2(file_path, local_file_path)
            return f"local://{object_name}"
        
        if self.storage_type == "s3":
            try:
                self.client.upload_file(
                    file_path,
                    self.bucket,
                    object_name,
                    ExtraArgs={"ContentType": content_type} if content_type else None,
                )
                return f"s3://{self.bucket}/{object_name}"
            except ClientError as e:
                raise Exception(f"Ошибка загрузки файла в S3: {e}")
        elif self.storage_type == "minio":
            # MinIO
            try:
                self.client.fput_object(
                    self.bucket,
                    object_name,
                    file_path,
                    content_type=content_type,
                )
                return f"minio://{self.bucket}/{object_name}"
            except (S3Error, Exception) as e:
                # Если MinIO недоступен, переключаемся на локальное хранилище
                error_msg = str(e)
                # Проверяем различные типы ошибок подключения
                connection_errors = [
                    "connection", "refused", "10061", "timeout", 
                    "connect", "unreachable", "failed to establish"
                ]
                if any(err in error_msg.lower() for err in connection_errors):
                    print(f"ВНИМАНИЕ: MinIO недоступен при загрузке файла: {e}")
                    print("Переключаемся на локальное хранилище для этого файла.")
                    # Переключаемся на локальное хранилище
                    self._use_local_storage = True
                    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                    self._local_storage_path = os.path.join(backend_dir, "storage")
                    os.makedirs(self._local_storage_path, exist_ok=True)
                    local_file_path = os.path.join(self._local_storage_path, object_name)
                    dir_path = os.path.dirname(local_file_path)
                    if dir_path:
                        os.makedirs(dir_path, exist_ok=True)
                    import shutil
                    shutil.copy2(file_path, local_file_path)
                    return f"local://{object_name}"
                else:
                    raise Exception(f"Ошибка загрузки файла в MinIO: {e}")
        else:
            # Неизвестный тип хранилища, переключаемся на локальное
            print(f"ВНИМАНИЕ: Неизвестный тип хранилища: {self.storage_type}, переключаемся на локальное.")
            self._use_local_storage = True
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            self._local_storage_path = os.path.join(backend_dir, "storage")
            os.makedirs(self._local_storage_path, exist_ok=True)
            local_file_path = os.path.join(self._local_storage_path, object_name)
            dir_path = os.path.dirname(local_file_path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            import shutil
            shutil.copy2(file_path, local_file_path)
            return f"local://{object_name}"
    
    def upload_fileobj(
        self,
        file_obj: BinaryIO,
        object_name: str,
        length: int,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Загрузить файл из объекта в хранилище
        
        Args:
            file_obj: Файловый объект
            object_name: Имя объекта в хранилище
            length: Размер файла
            content_type: MIME тип файла
            
        Returns:
            Путь к файлу в хранилище
        """
        if not self.client:
            raise Exception("Хранилище не настроено. Проверьте подключение к MinIO/S3.")
        
        if self.storage_type == "s3":
            try:
                self.client.upload_fileobj(
                    file_obj,
                    self.bucket,
                    object_name,
                    ExtraArgs={"ContentType": content_type} if content_type else None,
                )
                return f"s3://{self.bucket}/{object_name}"
            except ClientError as e:
                raise Exception(f"Ошибка загрузки файла в S3: {e}")
        else:
            # MinIO
            try:
                self.client.put_object(
                    self.bucket,
                    object_name,
                    file_obj,
                    length,
                    content_type=content_type,
                )
                return f"minio://{self.bucket}/{object_name}"
            except S3Error as e:
                raise Exception(f"Ошибка загрузки файла в MinIO: {e}")
    
    def download_file(self, object_name: str, file_path: str):
        """
        Скачать файл из хранилища
        
        Args:
            object_name: Имя объекта в хранилище
            file_path: Локальный путь для сохранения
        """
        # Если используем локальное хранилище
        if self._use_local_storage:
            if object_name.startswith("local://"):
                object_name = object_name[8:]
            local_file_path = os.path.join(self._local_storage_path, object_name)
            if not os.path.exists(local_file_path):
                raise Exception(f"Файл не найден: {local_file_path}")
            import shutil
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            shutil.copy2(local_file_path, file_path)
            return
        
        if not self.client:
            raise Exception("Хранилище не настроено. Проверьте подключение к MinIO/S3.")
        
        # Создаем директорию, если её нет
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        if self.storage_type == "s3":
            try:
                self.client.download_file(self.bucket, object_name, file_path)
            except ClientError as e:
                raise Exception(f"Ошибка скачивания файла из S3: {e}")
        else:
            # MinIO
            try:
                self.client.fget_object(self.bucket, object_name, file_path)
            except S3Error as e:
                raise Exception(f"Ошибка скачивания файла из MinIO: {e}")
    
    def get_file(self, object_name: str) -> bytes:
        """
        Получить файл из хранилища как bytes
        
        Args:
            object_name: Имя объекта в хранилище
            
        Returns:
            Содержимое файла
        """
        # Если используем локальное хранилище
        if self._use_local_storage:
            # Извлекаем путь из object_name (может быть local://path или просто path)
            if object_name.startswith("local://"):
                object_name = object_name[8:]
            local_file_path = os.path.join(self._local_storage_path, object_name)
            if not os.path.exists(local_file_path):
                raise Exception(f"Файл не найден: {local_file_path}")
            with open(local_file_path, "rb") as f:
                return f.read()
        
        if not self.client:
            raise Exception("Хранилище не настроено. Проверьте подключение к MinIO/S3.")
        
        if self.storage_type == "s3":
            try:
                response = self.client.get_object(self.bucket, object_name)
                return response["Body"].read()
            except ClientError as e:
                raise Exception(f"Ошибка получения файла из S3: {e}")
        else:
            # MinIO
            try:
                response = self.client.get_object(self.bucket, object_name)
                return response.read()
            except S3Error as e:
                raise Exception(f"Ошибка получения файла из MinIO: {e}")
    
    def get_file_stream(self, object_name: str):
        """
        Получить файл из хранилища как поток (для StreamingResponse)
        
        Args:
            object_name: Имя объекта в хранилище
            
        Returns:
            Файловый поток
        """
        # Если используем локальное хранилище
        if self._use_local_storage:
            if object_name.startswith("local://"):
                object_name = object_name[8:]
            local_file_path = os.path.join(self._local_storage_path, object_name)
            if not os.path.exists(local_file_path):
                raise Exception(f"Файл не найден: {local_file_path}")
            return open(local_file_path, "rb")
        
        if not self.client:
            raise Exception("Хранилище не настроено. Проверьте подключение к MinIO/S3.")
        
        if self.storage_type == "s3":
            try:
                response = self.client.get_object(self.bucket, object_name)
                return response["Body"]
            except ClientError as e:
                raise Exception(f"Ошибка получения файла из S3: {e}")
        else:
            # MinIO
            try:
                response = self.client.get_object(self.bucket, object_name)
                return response
            except S3Error as e:
                raise Exception(f"Ошибка получения файла из MinIO: {e}")
    
    def delete_file(self, object_name: str):
        """
        Удалить файл из хранилища
        
        Args:
            object_name: Имя объекта в хранилище
        """
        # Если используем локальное хранилище
        if self._use_local_storage:
            # Извлекаем путь из object_name
            if object_name.startswith("local://"):
                object_name = object_name[8:]
            local_file_path = os.path.join(self._local_storage_path, object_name)
            if os.path.exists(local_file_path):
                os.remove(local_file_path)
            return
        
        if not self.client:
            raise Exception("Хранилище не настроено. Проверьте подключение к MinIO/S3.")
        
        if self.storage_type == "s3":
            try:
                self.client.delete_object(self.bucket, object_name)
            except ClientError as e:
                raise Exception(f"Ошибка удаления файла из S3: {e}")
        else:
            # MinIO
            try:
                self.client.remove_object(self.bucket, object_name)
            except S3Error as e:
                raise Exception(f"Ошибка удаления файла из MinIO: {e}")
    
    def get_file_url(self, object_name: str, expires_in: int = 3600) -> str:
        """
        Получить временную ссылку на файл
        
        Args:
            object_name: Имя объекта в хранилище
            expires_in: Время жизни ссылки в секундах
            
        Returns:
            URL для скачивания файла
        """
        if not self.client:
            raise Exception("Хранилище не настроено. Проверьте подключение к MinIO/S3.")
        
        if self.storage_type == "s3":
            try:
                return self.client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": object_name},
                    ExpiresIn=expires_in,
                )
            except ClientError as e:
                raise Exception(f"Ошибка генерации URL для S3: {e}")
        else:
            # MinIO
            try:
                return self.client.presigned_get_object(
                    self.bucket, object_name, expires=expires_in
                )
            except S3Error as e:
                raise Exception(f"Ошибка генерации URL для MinIO: {e}")


# Глобальный экземпляр сервиса
storage_service = StorageService()

