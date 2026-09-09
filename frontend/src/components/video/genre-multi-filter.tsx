import { EntityMultiFilter } from "@/components/entity-multi-filter";
import { genreMultiFilterConfig } from "@/components/entity-multi-filter/configs";

interface GenreMultiFilterProps {
  selected: number[];
  onChange: (ids: number[]) => void;
  container?: HTMLElement | null;
  triggerClassName?: (active?: boolean) => string;
}

export function GenreMultiFilter(props: GenreMultiFilterProps) {
  return <EntityMultiFilter {...props} config={genreMultiFilterConfig} />;
}
