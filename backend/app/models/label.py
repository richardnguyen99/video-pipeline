"""Label-related SQLModel models."""

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


class Label(DmmCatalogMixin, table=True):
    """Represents a label entity."""

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

    label_aka: list["LabelAka"] = Relationship(back_populates="fk")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Label(id={self.id!r}, name={self.name!r})"


class LabelAka(AkaMixin, table=True):
    """Represents an alternative name (aka) for a label."""

    __tablename__ = "label_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.label.id"],
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

    fk: "Label" = Relationship(back_populates="label_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"LabelAka(id={self.id!r}, fk_id={self.fk_id!r})"
