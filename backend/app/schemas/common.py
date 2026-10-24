from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict

# La base guarda las marcas de tiempo en UTC sin zona; se marcan como UTC para que el navegador las convierta a su hora local.
FechaHora = Annotated[datetime, AfterValidator(lambda d: d.replace(tzinfo=UTC) if d.tzinfo is None else d)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Mensaje(BaseModel):
    detail: str
