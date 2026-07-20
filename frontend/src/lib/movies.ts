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
    image: "https://pics.dmm.co.jp/digital/video/mird00150/mird00150pl.jpg",
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
    image: "https://pics.dmm.co.jp/digital/video/team00058/team00058pl.jpg",
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
    image: "https://pics.dmm.co.jp/digital/video/migd00734/migd00734pl.jpg",
  },
];

export const genres: Genre[] = [
  {
    id: "action",
    name: "Action",
    count: "240+ titles",
    // image: "/movies/genre-action.png",
    image: "https://pics.dmm.co.jp/digital/video/pppd00451/pppd00451ps.jpg",
  },
  {
    id: "scifi",
    name: "Sci-Fi",
    count: "180+ titles",
    // image: "/movies/genre-scifi.png",
    image: "https://pics.dmm.co.jp/digital/video/172real00598/172real00598ps.jpg",
  },
  {
    id: "romance",
    name: "Romance",
    count: "210+ titles",
    // image: "/movies/genre-romance.png",
    image: "https://pics.dmm.co.jp/digital/video/84mkmp00131/84mkmp00131ps.jpg",
  },
  {
    id: "horror",
    name: "Horror",
    count: "160+ titles",
    // image: "/movies/genre-horror.png",
    image: "https://pics.dmm.co.jp/digital/video/tppn00030/tppn00030ps.jpg",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    count: "145+ titles",
    // image: "/movies/genre-fantasy.png",
    image: "https://pics.dmm.co.jp/digital/video/mide00115/mide00115ps.jpg",
  },
  {
    id: "thriller",
    name: "Thriller",
    count: "190+ titles",
    // image: "/movies/genre-thriller.png",
    image: "https://pics.dmm.co.jp/digital/video/mird00150/mird00150ps.jpg",
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
    id: "action",
    name: "Action & Adventure",
    blurb: "High-octane chases, last stands, and impossible odds.",
    movies: [
      {
        id: "iron-requiem",
        title: "Iron Requiem",
        year: 2025,
        rating: "PG-13",
        image: "https://pics.dmm.co.jp/digital/video/pppd00451/pppd00451ps.jpg",
      },
      {
        id: "last-stand",
        title: "Last Stand",
        year: 2024,
        rating: "R",
        image: "https://pics.dmm.co.jp/digital/video/172real00598/172real00598ps.jpg",
      },
      {
        id: "velocity",
        title: "Velocity",
        year: 2025,
        rating: "PG-13",
        image: "https://pics.dmm.co.jp/digital/video/84mkmp00131/84mkmp00131ps.jpg",
      },
      {
        id: "crossfire",
        title: "Crossfire",
        year: 2023,
        rating: "R",
        image: "https://pics.dmm.co.jp/digital/video/mide00179/mide00179ps.jpg",
      },
      {
        id: "nightfall-protocol",
        title: "Nightfall Protocol",
        year: 2025,
        rating: "PG-13",
        image: "https://pics.dmm.co.jp/digital/video/mide00115/mide00115ps.jpg",
      },
    ],
  },
  {
    id: "scifi",
    name: "Sci-Fi Worlds",
    blurb: "Distant futures, rogue machines, and the edge of the unknown.",
    movies: [
      {
        id: "event-horizon-zero",
        title: "Event Horizon Zero",
        year: 2025,
        rating: "PG-13",
        image: "/movies/scifi/event-horizon-zero.png",
      },
      { id: "starfall", title: "Starfall", year: 2024, rating: "PG-13", image: "/movies/scifi/starfall.png" },
      {
        id: "the-ninth-signal",
        title: "The Ninth Signal",
        year: 2025,
        rating: "R",
        image: "/movies/scifi/the-ninth-signal.png",
      },
      { id: "orbital", title: "Orbital", year: 2023, rating: "PG", image: "/movies/scifi/orbital.png" },
      {
        id: "chrome-skies",
        title: "Chrome Skies",
        year: 2025,
        rating: "PG-13",
        image: "/movies/scifi/chrome-skies.png",
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
        image: "/movies/romance/paper-hearts.png",
      },
      {
        id: "one-last-summer",
        title: "One Last Summer",
        year: 2024,
        rating: "PG",
        image: "/movies/romance/one-last-summer.png",
      },
      {
        id: "in-your-orbit",
        title: "In Your Orbit",
        year: 2025,
        rating: "PG-13",
        image: "/movies/romance/in-your-orbit.png",
      },
      { id: "slow-dance", title: "Slow Dance", year: 2023, rating: "PG-13", image: "/movies/romance/slow-dance.png" },
      {
        id: "letters-to-vera",
        title: "Letters to Vera",
        year: 2024,
        rating: "PG",
        image: "/movies/romance/letters-to-vera.png",
      },
    ],
  },
  {
    id: "horror",
    name: "Horror & Chills",
    blurb: "Turn the lights off. Something is already inside.",
    movies: [
      { id: "the-hollow", title: "The Hollow", year: 2025, rating: "R", image: "/movies/horror/the-hollow.png" },
      { id: "whispered", title: "Whispered", year: 2024, rating: "R", image: "/movies/horror/whispered.png" },
      { id: "cabin-thirteen", title: "Cabin 13", year: 2023, rating: "R", image: "/movies/horror/cabin-thirteen.png" },
      {
        id: "the-descent-below",
        title: "The Descent Below",
        year: 2025,
        rating: "R",
        image: "/movies/horror/the-descent-below.png",
      },
      { id: "static", title: "Static", year: 2024, rating: "PG-13", image: "/movies/horror/static.png" },
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
        image: "/movies/fantasy/emberthrone.png",
      },
      {
        id: "the-last-enchanter",
        title: "The Last Enchanter",
        year: 2024,
        rating: "PG",
        image: "/movies/fantasy/the-last-enchanter.png",
      },
      { id: "moonspire", title: "Moonspire", year: 2025, rating: "PG-13", image: "/movies/fantasy/moonspire.png" },
      { id: "wyrmwood", title: "Wyrmwood", year: 2023, rating: "PG-13", image: "/movies/fantasy/wyrmwood.png" },
      { id: "court-of-ash", title: "Court of Ash", year: 2025, rating: "R", image: "/movies/fantasy/court-of-ash.png" },
    ],
  },
  {
    id: "thriller",
    name: "Thrillers",
    blurb: "Every reflection hides a lie. Trust no one.",
    movies: [
      { id: "blindside", title: "Blindside", year: 2025, rating: "R", image: "/movies/thriller/blindside.png" },
      {
        id: "the-informant",
        title: "The Informant",
        year: 2024,
        rating: "R",
        image: "/movies/thriller/the-informant.png",
      },
      {
        id: "vanishing-point",
        title: "Vanishing Point",
        year: 2025,
        rating: "PG-13",
        image: "/movies/thriller/vanishing-point.png",
      },
      {
        id: "cold-pursuit",
        title: "Cold Pursuit",
        year: 2023,
        rating: "R",
        image: "/movies/thriller/cold-pursuit.png",
      },
      {
        id: "the-quiet-room",
        title: "The Quiet Room",
        year: 2024,
        rating: "R",
        image: "/movies/thriller/the-quiet-room.png",
      },
    ],
  },
];
