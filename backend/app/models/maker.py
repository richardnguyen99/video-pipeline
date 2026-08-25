"""Maker-related SQLModel models."""

from sqlalchemy import (
    Column,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlmodel import Relationship

from app.models.base import AkaMixin, DmmCatalogMixin


class Maker(DmmCatalogMixin, table=True):
    """Represents a maker entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id"),
        UniqueConstraint("dmm_id"),
        Index(
            None,
            func.lower(Column("name")).label("name_lower"),
            postgresql_ops={"name_lower": "gin_trgm_ops"},
            postgresql_using="gin",
        ),
        Index(
            None,
            "ruby",
            postgresql_ops={"ruby": "gin_trgm_ops"},
            postgresql_using="gin",
        ),
        {"schema": "public", "extend_existing": True},
    )

    maker_aka: list["MakerAka"] = Relationship(back_populates="fk")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Maker(id={self.id!r}, name={self.name!r})"


class MakerAka(AkaMixin, table=True):
    """Represents an alternative name (aka) for a maker."""

    __tablename__ = "maker_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.maker.id"],
            ondelete="CASCADE",
        ),
        PrimaryKeyConstraint("id"),
        UniqueConstraint(
            "fk_id",
            "language",
        ),
        Index(
            None,
            func.lower(Column("translated_name")).label(
                "translated_name_lower"
            ),
            postgresql_ops={"translated_name_lower": "gin_trgm_ops"},
            postgresql_using="gin",
        ),
        Index(None, "fk_id"),
        {"schema": "public", "extend_existing": True},
    )

    fk: "Maker" = Relationship(back_populates="maker_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"MakerAka(id={self.id!r}, fk_id={self.fk_id!r})"
