export interface Team {
  slug: string; // also the Sportune page slug
  name: string;
  aliases: string[]; // names Sportune uses for this team
}

export const TEAMS: Team[] = [
  { slug: "flamengo", name: "Flamengo", aliases: ["Flamengo"] },
  { slug: "vasco", name: "Vasco", aliases: ["Vasco", "Vasco da Gama"] },
  { slug: "sao-paulo", name: "São Paulo", aliases: ["São Paulo"] },
];

export function findTeam(slug: string): Team | undefined {
  return TEAMS.find((t) => t.slug === slug);
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function teamSlug(name: string): string {
  return TEAMS.find((t) => t.aliases.includes(name))?.slug ?? slugify(name);
}
