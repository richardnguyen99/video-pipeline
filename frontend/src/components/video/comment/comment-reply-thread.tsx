import type { CommentUser, VideoComment } from "@/mocks/comments";
import { cn } from "@/libs/utils";

import { CommentItem } from "./comment-item";

/** Vertical gap between sibling replies (matches pt-5 = 20px). */
const SIBLING_GAP = 20;
/** Avatar size-9 center — branch lands on the middle of the avatar. */
const AVATAR_CENTER = 18;
const CURVE_R = 10;
/** Matches pl-4 so the curve reaches the avatar's left edge. */
const BRANCH_W = 16;

interface CommentReplyThreadProps {
  replies: VideoComment[];
  currentUser: CommentUser;
  depth?: number;
}

export function CommentReplyThread({ replies, currentUser, depth = 0 }: CommentReplyThreadProps) {
  if (replies.length === 0) return null;

  return (
    <ul className="relative">
      {replies.map((reply, index) => {
        const isLast = index === replies.length - 1;
        const isFirst = index === 0;
        // Padding is inside the li so the stem covers the gap; branch Y
        // shifts down by that padding for non-first siblings.
        const gap = isFirst ? 0 : SIBLING_GAP;
        const branchY = gap + AVATAR_CENTER;

        const branchPath = isLast
          ? [`M 0.5 0`, `V ${branchY - CURVE_R}`, `Q 0.5 ${branchY} ${CURVE_R} ${branchY}`, `H ${BRANCH_W}`].join(" ")
          : [`M 0.5 ${branchY - CURVE_R}`, `Q 0.5 ${branchY} ${CURVE_R} ${branchY}`, `H ${BRANCH_W}`].join(" ");

        return (
          <li key={reply.id} className={cn("relative pl-4", !isFirst && "pt-5")}>
            <span
              className="pointer-events-none absolute left-0 w-px bg-border"
              style={{
                top: 0,
                ...(isLast ? { height: 0 } : { bottom: 0 }),
              }}
              aria-hidden
            />

            <svg
              className="pointer-events-none absolute top-0 left-0 text-border"
              width={BRANCH_W}
              height={branchY}
              viewBox={`0 0 ${BRANCH_W} ${branchY}`}
              fill="none"
              aria-hidden
            >
              <path d={branchPath} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>

            <CommentItem comment={reply} currentUser={currentUser} depth={depth + 1} />
          </li>
        );
      })}
    </ul>
  );
}
