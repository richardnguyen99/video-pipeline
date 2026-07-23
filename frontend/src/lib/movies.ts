export type FeaturedMovie = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  year: number;
  rating: string;
  duration: string;
  match: number;
  genres: string[];
  image: string;
};

export type Genre = {
  id: string;
  name: string;
  count: string;
  image: string;
};

export const featuredMovies: FeaturedMovie[] = [
  {
    id: "crimson-veil",
    title: "MIRD-150",
    tagline: "Some secrets bleed through",
    description:
      "A detective haunted by her past hunts a phantom killer through a rain-drenched city where every neon reflection hides a lie.",
    year: 2025,
    rating: "R",
    duration: "2h 08m",
    match: 98,
    genres: ["Thriller", "Mystery", "Crime"],
    image: "https://placehold.co/1280x720",
  },
  {
    id: "neon-dynasty",
    title: "TEAM-058",
    tagline: "The future has a price",
    description:
      "In a towering megacity ruled by data, one rogue courier holds the key to toppling an empire — if the night does not swallow her first.",
    year: 2025,
    rating: "PG-13",
    duration: "2h 22m",
    match: 96,
    genres: ["Sci-Fi", "Action", "Adventure"],
    image: "https://placehold.co/1280x720",
  },
  {
    id: "velvet-requiem",
    title: "MIGD-734",
    tagline: "Every love song ends",
    description:
      "Two performers fall for each other under the lights of a fading opera house, chasing one last encore before the curtain falls forever.",
    year: 2024,
    rating: "PG-13",
    duration: "1h 58m",
    match: 94,
    genres: ["Drama", "Romance", "Music"],
    image: "https://placehold.co/1280x720",
  },
];

export const genres: Genre[] = [
  {
    id: "action",
    name: "Action",
    count: "240+ titles",
    // image: "/movies/genre-action.png",
    image: "https://placehold.co/1280x720",
  },
  {
    id: "scifi",
    name: "Sci-Fi",
    count: "180+ titles",
    // image: "/movies/genre-scifi.png",
    image: "https://placehold.co/1280x720",
  },
  {
    id: "romance",
    name: "Romance",
    count: "210+ titles",
    // image: "/movies/genre-romance.png",
    image: "https://placehold.co/1280x720",
  },
  {
    id: "horror",
    name: "Horror",
    count: "160+ titles",
    // image: "/movies/genre-horror.png",
    image: "https://placehold.co/1280x720",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    count: "145+ titles",
    // image: "/movies/genre-fantasy.png",
    image: "https://placehold.co/1280x720",
  },
  {
    id: "thriller",
    name: "Thriller",
    count: "190+ titles",
    // image: "/movies/genre-thriller.png",
    image: "https://placehold.co/1280x720",
  },
];

export type GenreMovie = {
  id: string;
  title: string;
  year: number;
  rating: string;
  image: string;
};

export type GenreCollection = {
  id: string;
  name: string;
  blurb: string;
  movies: GenreMovie[];
};

export const genreCollections: GenreCollection[] = [
  {
    id: "trending",
    name: "Trending",
    blurb: "High-octane chases, last stands, and impossible odds.",
    movies: [
      {
        id: "iron-requiem",
        title: "Iron Requiem",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "last-stand",
        title: "Last Stand",
        year: 2024,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "velocity",
        title: "Velocity",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "crossfire",
        title: "Crossfire",
        year: 2023,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "nightfall-protocol",
        title: "Nightfall Protocol",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "nightfall-protocol2",
        title: "Nightfall Protocol",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
    ],
  },
  {
    id: "for-you",
    name: "For you",
    blurb: "Distant futures, rogue machines, and the edge of the unknown.",
    movies: [
      {
        id: "event-horizon-zero",
        title: "Event Horizon Zero",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "starfall",
        title: "Starfall",
        year: 2024,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "the-ninth-signal",
        title: "The Ninth Signal",
        year: 2025,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "orbital",
        title: "Orbital",
        year: 2023,
        rating: "PG",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "chrome-skies",
        title: "Chrome Skies",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
    ],
  },
  {
    id: "romance",
    name: "Romance",
    blurb: "Slow dances, second chances, and one last encore.",
    movies: [
      {
        id: "paper-hearts",
        title: "Paper Hearts",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "one-last-summer",
        title: "One Last Summer",
        year: 2024,
        rating: "PG",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "in-your-orbit",
        title: "In Your Orbit",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      { id: "slow-dance", title: "Slow Dance", year: 2023, rating: "PG-13", image: "https://placehold.co/1280x720" },
      {
        id: "letters-to-vera",
        title: "Letters to Vera",
        year: 2024,
        rating: "PG",
        image: "https://placehold.co/1280x720",
      },
    ],
  },
  {
    id: "horror",
    name: "Horror & Chills",
    blurb: "Turn the lights off. Something is already inside.",
    movies: [
      { id: "the-hollow", title: "The Hollow", year: 2025, rating: "R", image: "https://placehold.co/1280x720" },
      { id: "whispered", title: "Whispered", year: 2024, rating: "R", image: "https://placehold.co/1280x720" },
      { id: "cabin-thirteen", title: "Cabin 13", year: 2023, rating: "R", image: "https://placehold.co/1280x720" },
      {
        id: "the-descent-below",
        title: "The Descent Below",
        year: 2025,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
      { id: "static", title: "Static", year: 2024, rating: "PG-13", image: "https://placehold.co/1280x720" },
    ],
  },
  {
    id: "fantasy",
    name: "Fantasy Epics",
    blurb: "Ancient thrones, wild magic, and worlds beyond the veil.",
    movies: [
      {
        id: "emberthrone",
        title: "Emberthrone",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "the-last-enchanter",
        title: "The Last Enchanter",
        year: 2024,
        rating: "PG",
        image: "https://placehold.co/1280x720",
      },
      { id: "moonspire", title: "Moonspire", year: 2025, rating: "PG-13", image: "https://placehold.co/1280x720" },
      { id: "wyrmwood", title: "Wyrmwood", year: 2023, rating: "PG-13", image: "https://placehold.co/1280x720" },
      { id: "court-of-ash", title: "Court of Ash", year: 2025, rating: "R", image: "https://placehold.co/1280x720" },
    ],
  },
  {
    id: "thriller",
    name: "Thrillers",
    blurb: "Every reflection hides a lie. Trust no one.",
    movies: [
      { id: "blindside", title: "Blindside", year: 2025, rating: "R", image: "https://placehold.co/1280x720" },
      {
        id: "the-informant",
        title: "The Informant",
        year: 2024,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "vanishing-point",
        title: "Vanishing Point",
        year: 2025,
        rating: "PG-13",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "cold-pursuit",
        title: "Cold Pursuit",
        year: 2023,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
      {
        id: "the-quiet-room",
        title: "The Quiet Room",
        year: 2024,
        rating: "R",
        image: "https://placehold.co/1280x720",
      },
    ],
  },
];

export const placeholderCollections = genreCollections.map((collection) => ({
  ...collection,
  movies: collection.movies.map((movie) => ({
    ...movie,
    image: "https://placehold.co/1280x720",
  })),
}));
