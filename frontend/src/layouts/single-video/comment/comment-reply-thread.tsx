import type { ReactNode } from "react";

import type { CommentUser, VideoComment } from "@/queries/comments";
import { cn } from "@/libs/utils";

import { CommentItem } from "./comment-item";

/**
 * Tree geometry — must stay in sync with comment-item layout:
 * - Avatar column: size-9 (36px), center at 18px
 * - Thread offset under parent avatar center: 18px
 * - Row gutter (pl-4): 16px from spine to avatar left edge
 * - Sibling gap (pt-5): 20px
 */
const AVATAR_SIZE = 36;
const AVATAR_CENTER = AVATAR_SIZE / 2;
const SIBLING_GAP = 20;
const GUTTER = 16;
/** Corner radius for the elbow into the avatar. */
const ELBOW_R = 8;
const STROKE = 1;
/** Spine x in SVG space (half stroke so the 1px line is centered on the gutter edge). */
const SPINE_X = STROKE / 2;

interface CommentReplyThreadProps {
  replies: Array<VideoComment>;
  currentUser: CommentUser | null;
  depth?: number;
  localCandidates?: Array<CommentUser>;
  leading?: ReactNode;
  onReply?: (parentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  onVote?: (commentId: string, next: "like" | "dislike" | null, previous: "like" | "dislike" | null) => void;
}

/**
 * Build the branch path into the avatar.
 *
 * - `dropFromTop`: draw vertical from the top of this row down to the elbow
 *   (used for last siblings, which don't have a continuous CSS spine).
 * - Otherwise only the elbow + horizontal is drawn; the CSS spine covers the vertical.
 *
 * The path is intentionally bounded to y ∈ [0, branchY] so a clipped SVG
 * cannot paint a stub below the └── corner.
 */
function buildElbowPath(branchY: number, dropFromTop: boolean): string {
  const r = Math.min(ELBOW_R, branchY, GUTTER - STROKE);
  const elbowY = branchY;
  const arcStartY = elbowY - r;
  const arcEndX = SPINE_X + r;

  const vertical = dropFromTop ? [`M ${SPINE_X} 0`, `V ${arcStartY}`] : [`M ${SPINE_X} ${arcStartY}`];

  // Quarter-circle from southbound spine to eastbound branch.
  const elbow = [`A ${r} ${r} 0 0 0 ${arcEndX} ${elbowY}`];
  const horizontal = [`H ${GUTTER}`];

  return [...vertical, ...elbow, ...horizontal].join(" ");
}

function BranchElbow({ branchY, dropFromTop }: { branchY: number; dropFromTop: boolean }) {
  // Pad the viewBox by half a stroke so butt caps aren't clipped, but keep
  // the bottom edge exactly on branchY so nothing can render below the elbow.
  const height = branchY + STROKE / 2;

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 text-border"
      width={GUTTER}
      height={height}
      viewBox={`0 0 ${GUTTER} ${height}`}
      fill="none"
      aria-hidden
      style={{ overflow: "hidden" }}
    >
      <path
        d={buildElbowPath(branchY, dropFromTop)}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="butt"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Spine({ toElbowY }: { toElbowY?: number }) {
  // Continuous spine for non-last siblings (full row height), or a capped
  // segment when a finite end is provided.
  return (
    <span
      className="pointer-events-none absolute top-0 left-0 w-px bg-border"
      style={toElbowY == null ? { bottom: 0 } : { height: toElbowY }}
      aria-hidden
    />
  );
}

export function CommentReplyThread({
  replies,
  currentUser,
  depth = 0,
  localCandidates = [],
  leading,
  onReply,
  onDelete,
  onVote,
}: CommentReplyThreadProps) {
  const hasLeading = leading != null;
  const hasReplies = replies.length > 0;

  if (!hasLeading && !hasReplies) {
    return null;
  }

  return (
    <ul className="relative">
      {hasLeading ? (
        <li className="relative pl-4">
          {hasReplies ? <Spine /> : null}
          <div className="flex gap-2.5">
            <span className="w-9 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">{leading}</div>
          </div>
        </li>
      ) : null}

      {replies.map((reply, index) => {
        const isLast = index === replies.length - 1;
        const isFirstVisual = index === 0 && !hasLeading;
        const hasGapAbove = !isFirstVisual;
        const branchY = (hasGapAbove ? SIBLING_GAP : 0) + AVATAR_CENTER;

        // Last sibling: SVG owns the vertical drop + └── elbow (no CSS spine below).
        // Non-last: CSS spine runs the full row; SVG only paints the elbow out.
        const dropFromTop = isLast;

        return (
          <li
            key={reply.id}
            className={cn("relative pl-4", {
              "pt-5": hasGapAbove,
            })}
          >
            {!isLast ? <Spine /> : null}

            <BranchElbow branchY={branchY} dropFromTop={dropFromTop} />

            <CommentItem
              comment={reply}
              currentUser={currentUser}
              depth={depth + 1}
              localCandidates={localCandidates}
              onReply={onReply}
              onDelete={onDelete}
              onVote={onVote}
            />
          </li>
        );
      })}
    </ul>
  );
}
