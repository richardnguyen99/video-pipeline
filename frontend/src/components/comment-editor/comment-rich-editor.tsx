import { useEffect, useMemo, useState } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

import { Link, RichTextEditor } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import { FileCode2 } from "lucide-react";

export type CommentEditorMode = "rich" | "markdown";

interface CommentRichEditorProps {
  initialValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (payload: { html: string; markdown: string; text: string; isEmpty: boolean }) => void;
  onSubmitKey?: () => void;
}

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  return serializeNode(doc.body).trim();
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(serializeNode).join("");

  switch (tag) {
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "u":
      return `<u>${children}</u>`;
    case "s":
    case "del":
    case "strike":
      return `~~${children}~~`;
    case "code":
      return `\`${children}\``;
    case "a": {
      const href = el.getAttribute("href") ?? "";

      return `[${children}](${href})`;
    }
    case "blockquote":
      return (
        children
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n"
      );
    case "ul":
      return (
        Array.from(el.children)
          .map((li) => `- ${serializeNode(li).trim()}`)
          .join("\n") + "\n\n"
      );
    case "ol":
      return (
        Array.from(el.children)
          .map((li, index) => `${index + 1}. ${serializeNode(li).trim()}`)
          .join("\n") + "\n\n"
      );
    case "li":
      return children;
    case "p":
      return `${children}\n\n`;
    case "br":
      return "\n";
    default:
      return children;
  }
}

function markdownToHtml(markdown: string): string {
  const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const withCode = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const withStrike = withItalic.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  const withLinks = withStrike.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer nofollow" target="_blank">$1</a>',
  );

  const blocks = withLinks.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");

    if (lines.every((line) => line.startsWith("> "))) {
      const body = lines.map((line) => line.slice(2)).join("<br />");

      return `<blockquote><p>${body}</p></blockquote>`;
    }

    if (lines.every((line) => /^[-*] /.test(line))) {
      const items = lines.map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`).join("");

      return `<ul>${items}</ul>`;
    }

    if (lines.every((line) => /^\d+\. /.test(line))) {
      const items = lines.map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`).join("");

      return `<ol>${items}</ol>`;
    }

    return `<p>${lines.join("<br />")}</p>`;
  });

  return blocks.join("");
}

export function CommentRichEditor({
  initialValue = "",
  placeholder = "Add a comment…",
  autoFocus,
  disabled,
  className,
  onChange,
  onSubmitKey,
}: CommentRichEditorProps) {
  const [mode, setMode] = useState<CommentEditorMode>("rich");
  const [markdown, setMarkdown] = useState(() =>
    initialValue.trim().startsWith("<") ? htmlToMarkdown(initialValue) : initialValue,
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link,
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialValue.trim().startsWith("<") ? initialValue : initialValue ? markdownToHtml(initialValue) : "",
    editable: !disabled && mode === "rich",
    editorProps: {
      attributes: {
        class: "min-h-[72px] max-h-60 overflow-y-auto text-sm",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmitKey?.();

          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      const text = current.getText();
      const md = htmlToMarkdown(html);
      setMarkdown(md);
      onChange?.({
        html,
        markdown: md,
        text,
        isEmpty: current.isEmpty,
      });
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled && mode === "rich");
  }, [disabled, editor, mode]);

  useEffect(() => {
    if (!editor || !autoFocus || mode !== "rich") {
      return;
    }

    editor.commands.focus("end");
  }, [autoFocus, editor, mode]);

  function emitFromMarkdown(next: string) {
    onChange?.({
      html: markdownToHtml(next),
      markdown: next,
      text: next.replace(/[#>*_`~\-[\]()]/g, " "),
      isEmpty: next.trim() === "",
    });
  }

  function switchMode(next: CommentEditorMode) {
    if (next === mode) {
      return;
    }

    if (next === "markdown" && editor) {
      setMarkdown(htmlToMarkdown(editor.getHTML()));
    }

    if (next === "rich" && editor) {
      editor.commands.setContent(markdownToHtml(markdown), {
        emitUpdate: true,
      });
    }

    setMode(next);
  }

  return (
    <div className={cn("space-y-0", className)}>
      {mode === "rich" ? (
        <RichTextEditor
          editor={editor}
          variant="compact"
          editable={!disabled}
          className="overflow-hidden rounded-lg border border-border"
        >
          <RichTextEditor.Toolbar className="border-b border-border">
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.Strikethrough />
              <RichTextEditor.Code />
              <RichTextEditor.ClearFormatting />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
              <RichTextEditor.Blockquote />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Markdown mode"
                className="size-7 cursor-pointer"
                onClick={() => switchMode("markdown")}
              >
                <FileCode2 className="size-3.5" />
              </Button>
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content />
        </RichTextEditor>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-1.5 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Rich text mode"
              aria-pressed
              className="size-7 cursor-pointer bg-accent text-accent-foreground"
              onClick={() => switchMode("rich")}
            >
              <FileCode2 className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">Markdown</span>
          </div>

          <textarea
            value={markdown}
            disabled={disabled}
            autoFocus={autoFocus}
            placeholder={placeholder}
            rows={4}
            className="min-h-18 max-h-60 w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
            onChange={(event) => {
              const next = event.target.value;
              setMarkdown(next);
              emitFromMarkdown(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onSubmitKey?.();
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
