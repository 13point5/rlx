import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ADJECTIVES = [
  "brave",
  "fuzzy",
  "stellar",
  "crimson",
  "silent",
  "curious",
  "swift",
  "gentle",
  "clever",
  "mighty",
];

const NOUNS = [
  "otter",
  "nebula",
  "lion",
  "pipeline",
  "phoenix",
  "comet",
  "tiger",
  "forest",
  "algorithm",
  "dragon",
];

type GenerateNameOptions = {
  /**
   * Existing names in the project (for collision handling)
   */
  existingNames?: Set<string>;

  /**
   * Optional RNG for determinism (e.g. seeded RNG)
   */
  random?: () => number;
};

export function generateRunName(options: GenerateNameOptions = {}): string {
  const { existingNames = new Set<string>(), random = Math.random } = options;

  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(random() * NOUNS.length)];

  const name = `${adjective}-${noun}`;

  if (!existingNames.has(name)) {
    return name;
  }

  // Handle collisions: adjective-noun-2, -3, ...
  let suffix = 2;
  while (existingNames.has(`${name}-${suffix}`)) {
    suffix++;
  }

  return `${name}-${suffix}`;
}
