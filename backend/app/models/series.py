"""Series-related SQLModel models."""

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlmodel import Relationship

from app.models.base import AkaMixin, DmmCatalogMixin


class Series(DmmCatalogMixin, table=True):
    """Represents a series entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id", name="series_pkey"),
        UniqueConstraint("dmm_id", name="series_dmm_id_key"),
        {"schema": "public"},
    )

    series_aka: list["SeriesAka"] = Relationship(back_populates="fk")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Series(id={self.id!r}, name={self.name!r})"


class SeriesAka(AkaMixin, table=True):
    """Represents an alternative name (aka) for a series."""

    __tablename__ = "series_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.series.id"],
            ondelete="CASCADE",
            name="series_aka_fk_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="series_aka_pkey"),
        UniqueConstraint(
            "fk_id",
            "language",
            name="uq_series_aka_fk_id_language",
        ),
        Index("series_aka_fk_id_idx", "fk_id"),
        {"schema": "public"},
    )

    fk: "Series" = Relationship(back_populates="series_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"SeriesAka(id={self.id!r}, fk_id={self.fk_id!r})"
