export type Movie = {
  id: string;
  title: string;
  releaseYear: 2026;
  releaseStatus: "released" | "scheduled";
  genres: string[];
  moodTags: string[];
  director: string;
  actors: string[];
  rating: string;
  durationMinutes: number;
  synopsis: string;
};
