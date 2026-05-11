import type { Movie } from "../types/movie";
import movieCatalogJson from "../data/film_indonesia_2026.json";

const movieCatalog = movieCatalogJson as Movie[];
const DEFAULT_RELEVANT_MOVIE_LIMIT = 5;
const MAX_SYNOPSIS_CHARS = 120;

const GENRE_KEYWORDS: Record<string, string | string[]> = {
  action: "laga",
  animasi: "animasi",
  drama: "drama",
  fantasi: "fantasi",
  horor: "horor",
  komedi: "komedi",
  laga: "laga",
  olahraga: "olahraga",
  romance: "romansa",
  romansa: "romansa",
  romantis: "romansa",
  thriller: "thriller",
};

const MOOD_KEYWORDS: Record<string, string | string[]> = {
  hangat: "hangat",
  inspiratif: "inspiratif",
  keluarga: "keluarga",
  lucu: "lucu",
  mengharukan: "mengharukan",
  menegangkan: ["menegangkan", "tegang"],
  mistis: "mistis",
  ringan: "ringan",
  santai: ["ringan", "menghibur", "hangat", "lucu"],
  sedih: ["sedih", "mengharukan"],
  seram: "seram",
  tegang: ["tegang", "menegangkan"],
};

const SAD_FILM_MOODS = ["sedih", "mengharukan", "spiritual", "keluarga"];
const MOOD_LIFTING_MOODS = [
  "ringan",
  "lucu",
  "menghibur",
  "hangat",
  "keluarga",
];
const SCARY_DARK_MOODS = [
  "seram",
  "gelap",
  "menegangkan",
  "mistis",
  "suram",
];
const SAD_FILM_INTENT_PATTERNS = [
  /\bfilm\s+(?:yang\s+)?(?:sedih|mengharukan)\b/,
  /\b(?:pengen|ingin|mau)\s+nangis\b/,
  /\bbikin\s+nangis\b/,
];
const MOOD_LIFTING_INTENT_PATTERNS = [
  /\bmood\s+(?:saya|aku|ku|gue|gua)?\s*(?:lagi\s+)?(?:sedih|jelek|buruk|down|bete|capek)\b/,
  /\bsuasana\s+hati\s+(?:saya|aku|ku|gue|gua)?\s*(?:lagi\s+)?(?:sedih|jelek|buruk|down|bete|capek)\b/,
  /\bmood\s+(?:lagi\s+)?(?:jelek|buruk|down|bete|capek)\b/,
  /\blagi\s+(?:down|bete|capek)\b/,
  /\bbad\s+mood\b/,
  /\b(?:pengen|ingin|mau)\s+happy\b/,
  /\bhibur\s+(?:aku|saya|gue|gua|ku)\b/,
];
const MOOD_LANGUAGE_PATTERN =
  /\b(?:mood|suasana hati|down|bad mood|bete|capek|happy|hibur|nangis)\b/;
const EXPLICIT_SCARY_OR_TENSE_PATTERN =
  /\b(?:horor|seram|thriller|mistis|menegangkan|tegang)\b/;
const RECOMMENDATION_PATTERN =
  /\b(?:rekomendasi|rekomendasikan|sarankan|saran|pilih|pilihkan|cocok ditonton|film apa|ada film|daftar film)\b/;
const CATALOG_COUNT_PATTERN =
  /\b(?:jumlah film|berapa film|total film|ada berapa film|jumlah katalog)\b/;
const CATALOG_LIST_PATTERN =
  /\b(?:daftar film|tampilkan film|tunjukkan film|film yang tersedia|semua film|daftar lengkap|katalog film)\b/;
const CATALOG_PAGINATION_PATTERN = /^(?:lanjut|next|berikutnya)$/;
const FILTERED_BROWSE_PATTERN = /\bapa\s+(?:aja|saja)\b/;
const EXPLICIT_RECOMMENDATION_PATTERN =
  /\b(?:rekomendasi|rekomendasikan|sarankan|saran|pilih|pilihkan)\b/;
const SYNOPSIS_REQUEST_PATTERN =
  /\b(?:sinopsis|cerita|tentang apa|plot)\b/;
const GREETING_IDENTITY_PATTERN =
  /^(?:halo|hai|hi|hello|selamat\s+(?:pagi|siang|sore|malam)|pagi|siang|sore|malam|kamu siapa|siapa kamu|ai apa|moviebot itu apa|apa itu moviebot|perkenalkan diri|kenalkan diri|halo kamu siapa|hai kamu siapa)$/;
const GENRE_SUMMARY_PATTERNS = [
  /\bgenre(?:\s+nya|nya)?\s+apa\s+(?:aja|saja)\b/,
  /\bgenre(?:\s+nya|nya)?\s+(?:yang\s+ada|film\s+yang\s+tersedia)\b/,
  /\bfilm\s+yang\s+tersedia\s+genre(?:\s+nya|nya)?\s+apa\s+(?:aja|saja)\b/,
  /\bkategori\s+(?:film|apa\s+(?:aja|saja))\b/,
  /\bfilm\s+berdasarkan\s+genre\b/,
];
const MOVIE_CONTEXT_TERMS = [
  "film",
  "movie",
  "judul",
  "aktor",
  "sutradara",
  "genre",
  "rating",
  "durasi",
  "katalog",
  "sinopsis",
  "horor",
  "komedi",
  "drama",
  "romansa",
  "thriller",
  "laga",
  "animasi",
  "keluarga",
];
const OUT_OF_SCOPE_PATTERNS = [
  /\b(?:coding|koding|kodingan|program|script|source code|html|css|javascript|python)\b/,
  /\bbuat\s+(?:website|aplikasi)\b/,
  /\b(?:cv|resume|daftar riwayat hidup|surat lamaran)\b/,
  /\b(?:matematika|hitung|soal|jawab soal|rumus|kalkulasi)\b/,
  /\b(?:presiden|sejarah|berita|kesehatan|hukum|keuangan|politik|cuaca)\b/,
];
const ARITHMETIC_EXPRESSION_PATTERN =
  /(?:^|[\s(])\d+(?:\s*(?:[+*x/]|:|-)\s*\d+)+(?:[\s).?!,]|$)/;
const TITLE_CAST_REQUEST_PATTERN =
  /\b(?:siapa|apa)\s+(?:aja|saja)?\s*(?:aktor|aktris|pemain|pemeran|cast)(?:nya)?\b|\b(?:aktor|aktris|pemain|pemeran|cast)(?:nya)?\s+film\b|\bdibintangi\s+siapa\b/;
const ACTOR_FILMOGRAPHY_REQUEST_PATTERN =
  /\b(?:aktor|aktris|pemain)\s+.+?\s+(?:main\s+)?di\s+film\s+(?:apa|mana)\b|\b.+?\s+main\s+(?:di\s+)?film\s+(?:apa|mana)\b/;
const ACTOR_QUERY_STOP_WORDS = new Set([
  "ada",
  "aja",
  "aktris",
  "aktor",
  "apa",
  "cast",
  "dengan",
  "di",
  "dibintangi",
  "film",
  "indonesia",
  "katalog",
  "main",
  "mana",
  "moviebot",
  "pemain",
  "pemeran",
  "saja",
  "siapa",
  "tahun",
  "yang",
]);
const TITLE_QUERY_STOP_WORDS = new Set([
  ...ACTOR_QUERY_STOP_WORDS,
  "judul",
  "oleh",
]);

type ScoredMovie = {
  movie: Movie;
  score: number;
};

type ScoredTitleMatch = {
  movie: Movie;
  cleanTitle: string;
  coverage: number;
  matchedTokenCount: number;
  score: number;
};

export type ActorMovieMatch = {
  actorName: string;
  movies: Movie[];
};

export type ActorLookupResult = {
  searchTerms: string[];
  matches: ActorMovieMatch[];
};

export type TitleLookupResult = {
  movie: Movie | null;
  alternatives: Movie[];
};

export type CatalogGenreCount = {
  genre: string;
  count: number;
};

function normalizeSearchText(content: string) {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesNormalizedPhrase(content: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`).test(
    content,
  );
}

function getMeaningfulTitleTokens(content: string) {
  return normalizeSearchText(content)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 &&
        !TITLE_QUERY_STOP_WORDS.has(token),
    );
}

function titleTokenMatchesQuery(titleToken: string, queryToken: string) {
  return (
    titleToken === queryToken ||
    (queryToken.length >= 4 && titleToken.startsWith(queryToken))
  );
}

function getTitleTokenMatchCount(titleTokens: string[], queryTokens: string[]) {
  const matchedTitleTokens = new Set<string>();

  titleTokens.forEach((titleToken) => {
    if (
      queryTokens.some((queryToken) =>
        titleTokenMatchesQuery(titleToken, queryToken),
      )
    ) {
      matchedTitleTokens.add(titleToken);
    }
  });

  return matchedTitleTokens.size;
}

function compareTitleMatches(
  firstMatch: ScoredTitleMatch,
  secondMatch: ScoredTitleMatch,
) {
  return (
    secondMatch.score - firstMatch.score ||
    secondMatch.coverage - firstMatch.coverage ||
    secondMatch.matchedTokenCount - firstMatch.matchedTokenCount ||
    secondMatch.cleanTitle.length - firstMatch.cleanTitle.length
  );
}

function getActorQueryTokens(query: string) {
  return normalizeSearchText(query)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !ACTOR_QUERY_STOP_WORDS.has(token),
    );
}

function actorTokenMatchesQuery(actorToken: string, queryToken: string) {
  return (
    actorToken === queryToken ||
    (queryToken.length >= 4 && actorToken.startsWith(queryToken))
  );
}

export function actorMatchesQuery(actorName: string, query: string) {
  const actorTokens = getActorQueryTokens(actorName);
  const queryTokens = getActorQueryTokens(query);

  if (actorTokens.length === 0 || queryTokens.length === 0) {
    return false;
  }

  return queryTokens.every((queryToken) =>
    actorTokens.some((actorToken) =>
      actorTokenMatchesQuery(actorToken, queryToken),
    ),
  );
}

export function findMovieTitleLookupResult(message: string): TitleLookupResult {
  const cleanContent = normalizeSearchText(message);

  if (!cleanContent) {
    return {
      movie: null,
      alternatives: [],
    };
  }

  const titleIndex = movieCatalog
    .map((movie) => ({
      movie,
      cleanTitle: normalizeSearchText(movie.title),
      titleTokens: getMeaningfulTitleTokens(movie.title),
    }));

  const [exactMatch] = titleIndex
    .filter(({ cleanTitle }) =>
      Boolean(cleanTitle && includesNormalizedPhrase(cleanContent, cleanTitle)),
    )
    .sort(
      (firstMatch, secondMatch) =>
        secondMatch.cleanTitle.length - firstMatch.cleanTitle.length,
    );

  if (exactMatch) {
    return {
      movie: exactMatch.movie,
      alternatives: [],
    };
  }

  const queryTokens = getMeaningfulTitleTokens(cleanContent);

  if (queryTokens.length === 0) {
    return {
      movie: null,
      alternatives: [],
    };
  }

  const scoredMatches = titleIndex
    .map(({ movie, cleanTitle, titleTokens }): ScoredTitleMatch => {
      const matchedTokenCount = getTitleTokenMatchCount(titleTokens, queryTokens);
      const coverage =
        titleTokens.length > 0 ? matchedTokenCount / titleTokens.length : 0;

      return {
        movie,
        cleanTitle,
        coverage,
        matchedTokenCount,
        score: matchedTokenCount * 10 + coverage * 4 + titleTokens.length / 100,
      };
    })
    .filter(({ matchedTokenCount }) => matchedTokenCount > 0)
    .sort(compareTitleMatches);

  const confidentMatches = scoredMatches.filter(
    ({ matchedTokenCount }) => matchedTokenCount >= 2,
  );

  if (confidentMatches.length === 0) {
    return {
      movie: null,
      alternatives: scoredMatches.slice(0, 5).map(({ movie }) => movie),
    };
  }

  const [bestMatch, secondBestMatch] = confidentMatches;

  if (
    secondBestMatch &&
    bestMatch.matchedTokenCount === secondBestMatch.matchedTokenCount &&
    Math.abs(bestMatch.coverage - secondBestMatch.coverage) < 0.15
  ) {
    return {
      movie: null,
      alternatives: confidentMatches.slice(0, 5).map(({ movie }) => movie),
    };
  }

  return {
    movie: bestMatch.movie,
    alternatives: [],
  };
}

export function findMovieByTitleQuery(message: string) {
  return findMovieTitleLookupResult(message).movie;
}

export function isTitleCastIntent(message: string) {
  const cleanContent = normalizeSearchText(message);

  if (!cleanContent) {
    return false;
  }

  const hasCastTerm =
    TITLE_CAST_REQUEST_PATTERN.test(cleanContent) ||
    /\b(?:aktor|aktris|pemain|pemeran|cast)\b/.test(cleanContent);
  const hasTitleMatch = findMovieTitleLookupResult(cleanContent).movie !== null;

  if (hasCastTerm && hasTitleMatch) {
    return true;
  }

  if (ACTOR_FILMOGRAPHY_REQUEST_PATTERN.test(cleanContent)) {
    return false;
  }

  return TITLE_CAST_REQUEST_PATTERN.test(cleanContent);
}

function getGenreMoodLookupTerms() {
  return new Set(
    [
      ...Object.entries(GENRE_KEYWORDS).flatMap(([keyword, value]) => [
        keyword,
        ...(Array.isArray(value) ? value : [value]),
      ]),
      ...Object.entries(MOOD_KEYWORDS).flatMap(([keyword, value]) => [
        keyword,
        ...(Array.isArray(value) ? value : [value]),
      ]),
      "rekomendasi",
      "semua",
    ].map(normalizeSearchText),
  );
}

const NON_ACTOR_LOOKUP_TERMS = getGenreMoodLookupTerms();

function isLikelyNonActorCandidate(candidate: string) {
  const tokens = getActorQueryTokens(candidate);

  return (
    tokens.length === 0 ||
    tokens.every((token) => NON_ACTOR_LOOKUP_TERMS.has(token))
  );
}

function cleanActorCandidate(candidate: string) {
  return normalizeSearchText(candidate)
    .replace(/\b(?:dong|ya|sih|nih|please|tolong)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addActorSearchTerm(
  terms: string[],
  candidate: string | undefined,
  allowGenericCandidate = true,
) {
  if (!candidate) {
    return;
  }

  const cleanCandidate = cleanActorCandidate(candidate);

  if (
    !cleanCandidate ||
    (!allowGenericCandidate && isLikelyNonActorCandidate(cleanCandidate))
  ) {
    return;
  }

  terms.push(cleanCandidate);
}

export function extractActorSearchTerms(message: string) {
  const cleanContent = normalizeSearchText(message);
  const terms: string[] = [];

  if (!cleanContent || isTitleCastIntent(cleanContent)) {
    return terms;
  }

  addActorSearchTerm(
    terms,
    cleanContent.match(
      /\b(?:aktor|aktris|pemain)\s+(.+?)\s+(?:main\s+)?di\s+film\s+(?:apa|mana)\b/,
    )?.[1],
  );
  addActorSearchTerm(
    terms,
    cleanContent.match(/\b(.+?)\s+main\s+(?:di\s+)?film\s+(?:apa|mana)\b/)?.[1],
  );
  addActorSearchTerm(
    terms,
    cleanContent.match(/\bfilm\s+yang\s+dibintangi\s+(.+)$/)?.[1],
  );
  addActorSearchTerm(
    terms,
    cleanContent.match(/\bdibintangi\s+(.+)$/)?.[1],
  );
  addActorSearchTerm(
    terms,
    cleanContent.match(/\bfilm\s+dengan\s+(?:aktor|aktris|pemain)\s+(.+)$/)
      ?.[1],
  );
  addActorSearchTerm(
    terms,
    cleanContent.match(/\bada\s+film\s+(.+?)(?:\s+di\s+katalog)?$/)?.[1],
    false,
  );

  return [...new Set(terms)];
}

export function isActorLookupIntent(message: string) {
  return extractActorSearchTerms(message).length > 0;
}

function getRequestedValues(
  cleanContent: string,
  keywordMap: Record<string, string | string[]>,
) {
  return new Set(
    Object.entries(keywordMap)
      .filter(([keyword]) => includesNormalizedPhrase(cleanContent, keyword))
      .flatMap(([, value]) => (Array.isArray(value) ? value : [value])),
  );
}

function dedupeMovies(movies: Movie[]) {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  return movies.filter((movie) => {
    const cleanTitle = normalizeSearchText(movie.title);

    if (seenIds.has(movie.id) || seenTitles.has(cleanTitle)) {
      return false;
    }

    seenIds.add(movie.id);
    seenTitles.add(cleanTitle);
    return true;
  });
}

function getMoodIntent(cleanContent: string) {
  if (SAD_FILM_INTENT_PATTERNS.some((pattern) => pattern.test(cleanContent))) {
    return "sad-film";
  }

  if (MOOD_LIFTING_INTENT_PATTERNS.some((pattern) => pattern.test(cleanContent))) {
    return "mood-lifting";
  }

  return null;
}

function hasMoodLanguage(cleanContent: string) {
  return (
    MOOD_LANGUAGE_PATTERN.test(cleanContent) ||
    getRequestedValues(cleanContent, MOOD_KEYWORDS).size > 0 ||
    getMoodIntent(cleanContent) !== null
  );
}

function getRequestedMoods(cleanContent: string) {
  const moodIntent = getMoodIntent(cleanContent);

  if (moodIntent === "sad-film") {
    return new Set(SAD_FILM_MOODS);
  }

  if (moodIntent === "mood-lifting") {
    return new Set(MOOD_LIFTING_MOODS);
  }

  if (hasMoodLanguage(cleanContent)) {
    const requestedMoods = getRequestedValues(cleanContent, MOOD_KEYWORDS);

    return requestedMoods.size > 0
      ? requestedMoods
      : new Set(MOOD_LIFTING_MOODS);
  }

  return getRequestedValues(cleanContent, MOOD_KEYWORDS);
}

function explicitlyRequestsScaryOrTense(cleanContent: string) {
  return EXPLICIT_SCARY_OR_TENSE_PATTERN.test(cleanContent);
}

function hasOnlyScaryDarkMoods(movie: Movie) {
  const moods = movie.moodTags.map(normalizeSearchText);

  return (
    moods.length > 0 &&
    moods.every((mood) => SCARY_DARK_MOODS.includes(mood))
  );
}

function isMoodLiftingExcludedMovie(movie: Movie) {
  const genres = movie.genres.map(normalizeSearchText);

  return genres.includes("horor") || hasOnlyScaryDarkMoods(movie);
}

function getMoodIntentMatches(cleanContent: string) {
  const moodIntent = getMoodIntent(cleanContent);

  if (
    moodIntent !== "mood-lifting" ||
    explicitlyRequestsScaryOrTense(cleanContent)
  ) {
    return [];
  }

  return getGenreMoodMatches(cleanContent).filter(
    ({ movie }) => !isMoodLiftingExcludedMovie(movie),
  );
}

function getStrongMatches(cleanContent: string) {
  return movieCatalog
    .map((movie): ScoredMovie => {
      const title = normalizeSearchText(movie.title);
      const director = normalizeSearchText(movie.director);
      const actors = movie.actors.map(normalizeSearchText);
      let score = 0;

      if (includesNormalizedPhrase(cleanContent, title)) {
        score += 10;
      }

      if (director && includesNormalizedPhrase(cleanContent, director)) {
        score += 7;
      }

      actors.forEach((actor) => {
        if (
          actor &&
          (includesNormalizedPhrase(cleanContent, actor) ||
            actorMatchesQuery(actor, cleanContent))
        ) {
          score += 5;
        }
      });

      return { movie, score };
    })
    .filter(({ score }) => score > 0)
    .sort((firstMovie, secondMovie) => secondMovie.score - firstMovie.score);
}

function getGenreMoodMatches(cleanContent: string) {
  const requestedGenres = getRequestedValues(cleanContent, GENRE_KEYWORDS);
  const requestedMoods = getRequestedMoods(cleanContent);

  if (requestedGenres.size === 0 && requestedMoods.size === 0) {
    return [];
  }

  return movieCatalog
    .map((movie): ScoredMovie => {
      const genres = movie.genres.map(normalizeSearchText);
      const moods = movie.moodTags.map(normalizeSearchText);
      const genreScore = [...requestedGenres].filter((genre) =>
        genres.includes(genre),
      ).length;
      const moodScore = [...requestedMoods].filter((mood) =>
        moods.includes(mood),
      ).length;

      return {
        movie,
        score: genreScore * 3 + moodScore * 2,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((firstMovie, secondMovie) => secondMovie.score - firstMovie.score);
}

export function isMoodLiftingMoviePrompt(userMessage: string) {
  return getMoodIntent(normalizeSearchText(userMessage)) === "mood-lifting";
}

export function isSadFilmMoviePrompt(userMessage: string) {
  return getMoodIntent(normalizeSearchText(userMessage)) === "sad-film";
}

function getRequestedGenreMoodKeywords(cleanContent: string) {
  const keywords = [
    ...Object.keys(GENRE_KEYWORDS),
    ...Object.keys(MOOD_KEYWORDS),
  ];

  return keywords.filter((keyword) => includesNormalizedPhrase(cleanContent, keyword));
}

function hasMovieContext(cleanContent: string) {
  return (
    MOVIE_CONTEXT_TERMS.some((term) =>
      includesNormalizedPhrase(cleanContent, term),
    ) || getStrongMatches(cleanContent).length > 0
  );
}

export function isGreetingOrIdentityPrompt(userMessage: string) {
  const cleanContent = normalizeSearchText(userMessage);

  if (!cleanContent) {
    return true;
  }

  if (!GREETING_IDENTITY_PATTERN.test(cleanContent)) {
    return false;
  }

  return getStrongMatches(cleanContent).length === 0;
}

export function asksForMovieRecommendation(userMessage: string) {
  const cleanContent = normalizeSearchText(userMessage);

  return (
    RECOMMENDATION_PATTERN.test(cleanContent) &&
    !isCatalogCountIntent(userMessage) &&
    !isGenreSummaryIntent(userMessage) &&
    !isCatalogListIntent(userMessage) &&
    !isFilteredCatalogBrowseIntent(userMessage)
  );
}

export function asksForSynopsis(userMessage: string) {
  return SYNOPSIS_REQUEST_PATTERN.test(normalizeSearchText(userMessage));
}

export function isOutOfScopeMovieBotIntent(userMessage: string) {
  const cleanContent = normalizeSearchText(userMessage);

  if (!cleanContent || hasMovieContext(cleanContent)) {
    return false;
  }

  return (
    OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(cleanContent)) ||
    ARITHMETIC_EXPRESSION_PATTERN.test(userMessage.toLowerCase())
  );
}

export function isCatalogCountIntent(userMessage: string) {
  return CATALOG_COUNT_PATTERN.test(normalizeSearchText(userMessage));
}

export function isGenreSummaryIntent(userMessage: string) {
  const cleanContent = normalizeSearchText(userMessage);

  return GENRE_SUMMARY_PATTERNS.some((pattern) => pattern.test(cleanContent));
}

export function isCatalogListIntent(userMessage: string) {
  return (
    CATALOG_LIST_PATTERN.test(normalizeSearchText(userMessage)) &&
    !isGenreSummaryIntent(userMessage)
  );
}

export function isCatalogPaginationIntent(userMessage: string) {
  return CATALOG_PAGINATION_PATTERN.test(normalizeSearchText(userMessage));
}

export function isFilteredCatalogBrowseIntent(userMessage: string) {
  const cleanContent = normalizeSearchText(userMessage);

  return (
    FILTERED_BROWSE_PATTERN.test(cleanContent) &&
    !EXPLICIT_RECOMMENDATION_PATTERN.test(cleanContent) &&
    !isGenreSummaryIntent(userMessage) &&
    getGenreMoodMatches(cleanContent).length > 0
  );
}

export function getFilteredCatalogBrowseLabel(userMessage: string) {
  const keywords = getRequestedGenreMoodKeywords(normalizeSearchText(userMessage));

  return keywords.length > 0 ? keywords.join(", ") : "filter";
}

export function getFilteredCatalogBrowseMovies(userMessage: string) {
  const cleanContent = normalizeSearchText(userMessage);
  const shouldUseMoodLiftingExclusions =
    getMoodIntent(cleanContent) === "mood-lifting" &&
    !explicitlyRequestsScaryOrTense(cleanContent);
  const matches = getGenreMoodMatches(cleanContent).filter(
    ({ movie }) =>
      !shouldUseMoodLiftingExclusions || !isMoodLiftingExcludedMovie(movie),
  );

  return dedupeMovies(matches.map(({ movie }) => movie));
}

export function getMovieCatalogCount() {
  return movieCatalog.length;
}

export function findMoviesByActorQuery(message: string): ActorLookupResult | null {
  const searchTerms = extractActorSearchTerms(message);

  if (searchTerms.length === 0) {
    return null;
  }

  const matchesByActor = new Map<string, Movie[]>();

  movieCatalog.forEach((movie) => {
    movie.actors.forEach((actorName) => {
      if (
        !searchTerms.some((searchTerm) =>
          actorMatchesQuery(actorName, searchTerm),
        )
      ) {
        return;
      }

      const movies = matchesByActor.get(actorName) ?? [];
      movies.push(movie);
      matchesByActor.set(actorName, movies);
    });
  });

  return {
    searchTerms,
    matches: Array.from(matchesByActor, ([actorName, movies]) => ({
      actorName,
      movies: dedupeMovies(movies),
    })).sort((firstMatch, secondMatch) =>
      firstMatch.actorName.localeCompare(secondMatch.actorName, "id"),
    ),
  };
}

export function getCatalogGenreCounts(): CatalogGenreCount[] {
  const counts = new Map<string, number>();

  movieCatalog.forEach((movie) => {
    movie.genres.forEach((genre) => {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    });
  });

  return Array.from(counts, ([genre, count]) => ({ genre, count })).sort(
    (firstGenre, secondGenre) =>
      secondGenre.count - firstGenre.count ||
      firstGenre.genre.localeCompare(secondGenre.genre, "id"),
  );
}

export function getGenreSummaryMessage() {
  const rows = getCatalogGenreCounts().map(
    ({ genre, count }) => `| ${genre} | ${count} |`,
  );

  return [
    "Genre yang tersedia di katalog MovieBot Indonesia 2026:",
    "",
    "| Genre | Jumlah Film |",
    "|---|---:|",
    ...rows,
    "",
    'Ketik nama genre, misalnya "film horor apa aja", untuk melihat daftar filmnya.',
  ].join("\n");
}

export function getCatalogMoviesPage(pageIndex: number, pageSize = 10) {
  const startIndex = Math.max(pageIndex, 0) * pageSize;

  return {
    movies: movieCatalog.slice(startIndex, startIndex + pageSize),
    startIndex,
    endIndex: Math.min(startIndex + pageSize, movieCatalog.length),
    totalCount: movieCatalog.length,
  };
}

export function getRelevantMovies(
  userMessage: string,
  limit = DEFAULT_RELEVANT_MOVIE_LIMIT,
) {
  const cleanContent = normalizeSearchText(userMessage);

  if (
    !cleanContent ||
    isGreetingOrIdentityPrompt(userMessage) ||
    isCatalogCountIntent(userMessage) ||
    isGenreSummaryIntent(userMessage) ||
    isCatalogListIntent(userMessage) ||
    isCatalogPaginationIntent(userMessage) ||
    isFilteredCatalogBrowseIntent(userMessage)
  ) {
    return [];
  }

  const strongMatches = getStrongMatches(cleanContent);

  if (strongMatches.length > 0) {
    return dedupeMovies(strongMatches.map(({ movie }) => movie)).slice(0, limit);
  }

  const shouldUseMoodLiftingExclusions =
    getMoodIntent(cleanContent) === "mood-lifting" &&
    !explicitlyRequestsScaryOrTense(cleanContent);
  const moodIntentMatches = shouldUseMoodLiftingExclusions
    ? getMoodIntentMatches(cleanContent)
    : [];

  if (moodIntentMatches.length > 0) {
    return dedupeMovies(moodIntentMatches.map(({ movie }) => movie)).slice(
      0,
      limit,
    );
  }

  if (shouldUseMoodLiftingExclusions) {
    const fallbackMovies = getGenreMoodMatches("ringan lucu menghibur hangat")
      .filter(({ movie }) => !isMoodLiftingExcludedMovie(movie));

    return dedupeMovies(fallbackMovies.map(({ movie }) => movie)).slice(0, limit);
  }

  const genreMoodMatches = getGenreMoodMatches(cleanContent);

  if (genreMoodMatches.length > 0) {
    return dedupeMovies(genreMoodMatches.map(({ movie }) => movie)).slice(
      0,
      limit,
    );
  }

  if (hasMoodLanguage(cleanContent)) {
    const fallbackMovies = getGenreMoodMatches("ringan lucu menghibur hangat")
      .filter(({ movie }) => !isMoodLiftingExcludedMovie(movie));

    return dedupeMovies(fallbackMovies.map(({ movie }) => movie)).slice(0, limit);
  }

  if (isActorLookupIntent(userMessage)) {
    return [];
  }

  if (asksForMovieRecommendation(userMessage)) {
    return dedupeMovies(movieCatalog).slice(0, limit);
  }

  return [];
}

function truncateSynopsis(synopsis: string) {
  if (synopsis.length <= MAX_SYNOPSIS_CHARS) {
    return synopsis;
  }

  return `${synopsis.slice(0, MAX_SYNOPSIS_CHARS).trim()}...`;
}

export function buildCompactMovieContext(
  movies: Movie[],
  includeSynopsis = false,
) {
  return movies
    .map((movie) => {
      const fields = [
        `Judul: ${movie.title}`,
        `Status: ${movie.releaseStatus}`,
        `Genre: ${movie.genres.join(", ")}`,
        `Mood: ${movie.moodTags.join(", ")}`,
        `Rating: ${movie.rating}`,
        `Durasi: ${movie.durationMinutes}m`,
        `Sutradara: ${movie.director}`,
        `Aktor utama: ${movie.actors.slice(0, 3).join(", ")}`,
      ];

      if (includeSynopsis) {
        fields.push(`sinopsis: ${truncateSynopsis(movie.synopsis)}`);
      }

      return fields.join(" | ");
    })
    .join("\n");
}
