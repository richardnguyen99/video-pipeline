"""Label-related SQLModel models."""

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlmodel import Relationship

from app.models.base import AkaMixin, DmmCatalogMixin


class Label(DmmCatalogMixin, table=True):
    """Represents a label entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id", name="label_pkey"),
        UniqueConstraint("dmm_id", name="label_dmm_id_key"),
        {"schema": "public"},
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
            name="label_aka_fk_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="label_aka_pkey"),
        UniqueConstraint(
            "fk_id",
            "language",
            name="uq_label_aka_fk_id_language",
        ),
        Index("label_aka_fk_id_idx", "fk_id"),
        {"schema": "public"},
    )

    fk: "Label" = Relationship(back_populates="label_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"LabelAka(id={self.id!r}, fk_id={self.fk_id!r})"
