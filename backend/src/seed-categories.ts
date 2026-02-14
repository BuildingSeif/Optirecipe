import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    name: "Entr\u00e9e",
    order: 1,
    subCategories: ["Salades", "Soupes", "Crudit\u00e9s", "Terrines", "Feuillet\u00e9s", "Tartes sal\u00e9es", "Verrines"],
  },
  {
    name: "Plat protidique",
    order: 2,
    subCategories: ["B\u0153ufs", "Volailles", "Poissons", "Porcs", "Agneaux", "Veaux", "\u0152ufs", "Gibiers", "Crustac\u00e9s", "Plats v\u00e9g\u00e9tariens"],
  },
  {
    name: "Accompagnement",
    order: 3,
    subCategories: ["L\u00e9gumes", "F\u00e9culents", "Riz", "P\u00e2tes", "Gratins", "Pur\u00e9es", "Po\u00eal\u00e9es"],
  },
  {
    name: "Produit laitier",
    order: 4,
    subCategories: ["Fromages", "Yaourts", "Faisselles", "Fromages blancs"],
  },
  {
    name: "Dessert",
    order: 5,
    subCategories: ["G\u00e2teaux", "Tartes", "Cr\u00e8mes", "Mousses", "Fruits", "Glaces", "Entremets", "Biscuits", "Verrines sucr\u00e9es"],
  },
  {
    name: "Petit-d\u00e9jeuner / Brunch",
    order: 6,
    subCategories: ["Viennoiseries", "Pains", "C\u00e9r\u00e9ales", "\u0152ufs", "Pancakes", "Gaufres"],
  },
  {
    name: "Go\u00fbter",
    order: 7,
    subCategories: ["Biscuits", "G\u00e2teaux", "Fruits", "Laitages"],
  },
  {
    name: "Sauce",
    order: 8,
    subCategories: ["Sauces chaudes", "Sauces froides", "Vinaigrettes", "Marinades"],
  },
  {
    name: "Base",
    order: 9,
    subCategories: ["P\u00e2tes de base", "Fonds", "Bouillons", "Cr\u00e8mes de base"],
  },
];

async function seed() {
  console.log("Seeding categories...");

  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: { order: cat.order },
      create: { name: cat.name, order: cat.order },
    });

    for (let i = 0; i < cat.subCategories.length; i++) {
      const subName = cat.subCategories[i]!;
      await prisma.subCategory.upsert({
        where: { name_categoryId: { name: subName, categoryId: category.id } },
        update: { order: i + 1 },
        create: { name: subName, categoryId: category.id, order: i + 1 },
      });
    }

    console.log(`  Done: ${cat.name} (${cat.subCategories.length} sous-categories)`);
  }

  console.log("Done! Categories seeded successfully.");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
