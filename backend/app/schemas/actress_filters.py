"""Actress list query filters."""

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class ActressListFilters(BaseModel):
    """Normalized filters for actress discovery.

    Different fields are combined with AND. Repeated values for the same
    field (e.g. multiple genres) are combined with OR.
    """

    cups: list[str] = Field(default_factory=list)
    bust_min: Optional[int] = Field(default=None, ge=0)
    bust_max: Optional[int] = Field(default=None, ge=0)
    waist_min: Optional[int] = Field(default=None, ge=0)
    waist_max: Optional[int] = Field(default=None, ge=0)
    hip_min: Optional[int] = Field(default=None, ge=0)
    hip_max: Optional[int] = Field(default=None, ge=0)
    height_min: Optional[int] = Field(default=None, ge=0)
    height_max: Optional[int] = Field(default=None, ge=0)
    age_min: Optional[int] = Field(default=None, ge=18, le=99)
    age_max: Optional[int] = Field(default=None, ge=18, le=99)
    genres: list[int] = Field(default_factory=list)
    makers: list[int] = Field(default_factory=list)
    series: list[int] = Field(default_factory=list)
    labels: list[int] = Field(default_factory=list)
    directors: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_ranges(self) -> "ActressListFilters":
        """Ensure each min/max pair is ordered."""

        pairs = (
            ("bust_min", "bust_max"),
            ("waist_min", "waist_max"),
            ("hip_min", "hip_max"),
            ("height_min", "height_max"),
            ("age_min", "age_max"),
        )

        for lo_name, hi_name in pairs:
            lo = getattr(self, lo_name)
            hi = getattr(self, hi_name)

            if lo is not None and hi is not None and lo > hi:
                raise ValueError(f"{lo_name} must be <= {hi_name}")

        return self
