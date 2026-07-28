"""Genre-related SQLModel models."""

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    UniqueConstraint,
)
from sqlmodel import Relationship

from app.models.base import AkaMixin, DmmCatalogMixin


class Genre(DmmCatalogMixin, table=True):
    """Represents a genre entity."""

    __table_args__ = (
        PrimaryKeyConstraint("id", name="genre_pkey"),
        UniqueConstraint("dmm_id", name="genre_dmm_id_key"),
        {"schema": "public"},
    )

    genre_aka: list["GenreAka"] = Relationship(back_populates="fk")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"Genre(id={self.id!r}, name={self.name!r})"


class GenreAka(AkaMixin, table=True):
    """Represents an alternative name (aka) for a genre."""

    __tablename__ = "genre_aka"
    __table_args__ = (
        ForeignKeyConstraint(
            columns=["fk_id"],
            refcolumns=["public.genre.id"],
            ondelete="CASCADE",
            name="genre_aka_fk_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="genre_aka_pkey"),
        UniqueConstraint(
            "fk_id",
            "language",
            name="uq_genre_aka_fk_id_language",
        ),
        Index("genre_aka_fk_id_idx", "fk_id"),
        {"schema": "public"},
    )

    fk: "Genre" = Relationship(back_populates="genre_aka")

    def __repr__(self) -> str:
        """Return a string representation."""

        return f"GenreAka(id={self.id!r}, fk_id={self.fk_id!r})"
