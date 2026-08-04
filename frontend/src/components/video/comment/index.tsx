import { countComments, mockCurrentUser } from "@/mocks/comments";
import type { VideoComment } from "@/mocks/comments";

import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

interface VideoCommentsProps {
  comments: VideoComment[];
  videoId: string;
}

export function VideoComments({ comments }: VideoCommentsProps) {
  const total = countComments(comments);
  const currentUser = mockCurrentUser;

  return (
    <section className="mt-10" aria-label="Comments">
      <h3 className="mb-4 text-lg font-semibold">
        {total} {total === 1 ? "Comment" : "Comments"}
      </h3>

      <CommentComposer currentUser={currentUser} className="mb-8" />

      <div className="space-y-8">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} currentUser={currentUser} />
        ))}
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts.</p>
      ) : null}
    </section>
  );
}
