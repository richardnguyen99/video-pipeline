import { Ellipsis, UserMinus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SubscriptionRowMenuProps = {
  actressId: number;
  onUnsubscribe?: (actressId: number) => void;
};

export function SubscriptionRowMenu({ actressId, onUnsubscribe }: SubscriptionRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Subscription options"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" className="min-w-48 p-2">
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onUnsubscribe?.(actressId);
            }}
          >
            <UserMinus className="size-4" aria-hidden />
            Unsubscribe
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
