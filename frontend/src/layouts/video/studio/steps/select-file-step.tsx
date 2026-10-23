import type { ChangeEvent, DragEvent, KeyboardEvent, RefObject } from "react";
import { CloudUpload, FileVideo, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ALLOWED_EXTENSIONS } from "@/layouts/video/studio/types";
import { cn } from "@/libs/utils";

type SelectFileStepProps = {
  file: File | null;
  fileSizeLabel: string;
  thumbnailUrl: string;
  isDragging: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onDropzoneKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export function SelectFileStep({
  file,
  fileSizeLabel,
  thumbnailUrl,
  isDragging,
  inputRef,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFileChange,
  onClearFile,
  onDropzoneKeyDown,
}: SelectFileStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragEnter();
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={() => {
          onDragLeave();
        }}
        onDrop={onDrop}
        onClick={() => {
          inputRef.current?.click();
        }}
        onKeyDown={onDropzoneKeyDown}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".mp4,.mkv,.mov,.webm,video/mp4,video/x-matroska,video/quicktime,video/webm"
          onChange={onFileChange}
        />

        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <CloudUpload className="size-6" />
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium">
            {isDragging ? "Drop your video here" : "Drag and drop your video here"}
          </h3>

          <p className="text-muted-foreground text-sm">
            or <span className="text-primary font-medium">browse your files</span> from your computer
          </p>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="font-medium">Supported formats</span>

          {ALLOWED_EXTENSIONS.map((extension) => (
            <span key={extension} className="bg-muted rounded-md px-2 py-0.5 font-mono uppercase">
              {extension}
            </span>
          ))}
        </div>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="Generated video thumbnail" className="size-14 rounded-md object-cover" />
          ) : (
            <div className="bg-muted flex size-14 items-center justify-center rounded-md">
              <FileVideo className="size-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>

            <p className="text-muted-foreground text-xs">{fileSizeLabel} · Ready to upload</p>
          </div>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove selected video" onClick={onClearFile}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
