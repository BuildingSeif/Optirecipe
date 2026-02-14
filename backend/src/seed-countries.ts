import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const countries = [
  { name: "France", code: "FR", order: 1 },
  { name: "Italie", code: "IT", order: 2 },
  { name: "Espagne", code: "ES", order: 3 },
  { name: "Maroc", code: "MA", order: 4 },
  { name: "Grece", code: "GR", order: 5 },
  { name: "Liban", code: "LB", order: 6 },
  { name: "Japon", code: "JP", order: 7 },
  { name: "Chine", code: "CN", order: 8 },
  { name: "Thailande", code: "TH", order: 9 },
  { name: "Inde", code: "IN", order: 10 },
  { name: "Mexique", code: "MX", order: 11 },
  { name: "Etats-Unis", code: "US", order: 12 },
  { name: "Belgique", code: "BE", order: 13 },
  { name: "Suisse", code: "CH", order: 14 },
  { name: "Allemagne", code: "DE", order: 15 },
];

const frenchRegions = [
  "Alsace", "Aquitaine", "Auvergne", "Bourgogne", "Bretagne",
  "Centre", "Champagne", "Corse", "Franche-Comte",
  "Ile-de-France", "Languedoc", "Limousin", "Lorraine",
  "Midi-Pyrenees", "Nord-Pas-de-Calais", "Normandie",
  "Pays de la Loire", "Picardie", "Poitou-Charentes",
  "Provence-Alpes-Cote d'Azur", "Rhone-Alpes",
];

async function seed() {
  console.log("Seeding countries and regions...");

  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, order: c.order },
      create: c,
    });
  }

  console.log(`Seeded ${countries.length} countries`);

  // Get France record
  const france = await prisma.country.findUnique({ where: { code: "FR" } });
  if (!france) throw new Error("France not found");

  for (let i = 0; i < frenchRegions.length; i++) {
    const regionName = frenchRegions[i]!;
    await prisma.region.upsert({
      where: { name_countryId: { name: regionName, countryId: france.id } },
      update: { order: i + 1 },
      create: { name: regionName, countryId: france.id, order: i + 1 },
    });
  }

  console.log(`Seeded ${frenchRegions.length} French regions`);
  console.log("Done!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
