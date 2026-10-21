from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SAIU - Sistema Académico Integral Universitario"
    database_url: str = "sqlite:///./saiu.db"
    jwt_secret: str = "dev-secret-cambiar"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    cors_origins: str = "http://localhost:4200"

    @field_validator("database_url")
    @classmethod
    def _driver_postgres(cls, v: str) -> str:
        # Supabase entrega "postgresql://" o "postgres://"; SQLAlchemy necesita indicar el driver psycopg (v3)
        for prefijo in ("postgresql://", "postgres://"):
            if v.startswith(prefijo):
                return "postgresql+psycopg://" + v[len(prefijo):]
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
