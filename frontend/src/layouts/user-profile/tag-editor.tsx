import { useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";

type TagEditorProps = {
  label: string;
  description: string;
  initialTags: Array<string>;
};

export function TagEditor({ label, description, initialTags }: TagEditorProps) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");

  function addTag() {
    const tag = draft.trim();

    if (!tag) {
      return;
    }

    if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setDraft("");

      return;
    }

    setTags([...tags, tag]);
    setDraft("");
  }

  return (
    <SettingsCard
      title={label}
      description={description}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={tags.length === 0}
          onClick={() => {
            setTags([]);
          }}
        >
          Clear all
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder={`Add ${label.toLowerCase()}...`}
            aria-label={`Add ${label.toLowerCase()}`}
          />

          <Button type="button" disabled={!draft.trim()} onClick={addTag}>
            Add tag
          </Button>
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label={`${label} tags`}>
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}

                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${tag}`}
                  onClick={() => {
                    setTags(tags.filter((item) => item !== tag));
                  }}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </SettingsCard>
  );
}
