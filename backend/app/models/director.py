"""Director-related SQLModel models."""

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlmodel import Relationship

from app.models.base import AkaMixin, DmmCatalogMixin


class Director(DmmCatalogMixin, table=True):
    """Represents a director entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id"),
        UniqueConstraint("dmm_id"),
        {"schema": "public", "extend_existing": True},
    )

    director_aka: list["DirectorAka"] = Relationship(back_populates="fk")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Director(id={self.id!r}, name={self.name!r})"


class DirectorAka(AkaMixin, table=True):
    """Represents an alternative name (aka) for a director."""

    __tablename__ = "director_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.director.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        UniqueConstraint(
            "fk_id",
            "language",
        ),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    fk: "Director" = Relationship(back_populates="director_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"DirectorAka(id={self.id!r}, fk_id={self.fk_id!r})"
