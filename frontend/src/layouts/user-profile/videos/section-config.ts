export type LibrarySectionKind = "watched" | "liked" | "videos" | "playlists";

export type LibrarySection = {
  title: string;
  subtitle: string;
  kind: LibrarySectionKind;
};

export function librarySections(isOwner: boolean): Array<LibrarySection> {
  if (isOwner) {
    return [
      {
        title: "Watched videos",
        subtitle: "Your recent watch history",
        kind: "watched",
      },
      {
        title: "Liked videos",
        subtitle: "Videos you want to revisit",
        kind: "liked",
      },
      {
        title: "Private playlists",
        subtitle: "Only visible to you",
        kind: "playlists",
      },
      {
        title: "Curated playlists",
        subtitle: "Restricted playlists shared with you",
        kind: "playlists",
      },
      {
        title: "Public uploaded videos",
        subtitle: "What you have shared",
        kind: "videos",
      },
      {
        title: "Public playlists",
        subtitle: "Curated by you",
        kind: "playlists",
      },
    ];
  }

  return [
    {
      title: "Public uploaded videos",
      subtitle: "What they have shared",
      kind: "videos",
    },
    {
      title: "Public playlists",
      subtitle: "Curated lists",
      kind: "playlists",
    },
  ];
}
