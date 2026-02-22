import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://postgres:sVAUptpsFExVDxmRqpgkBzHkzXACEqjn@trolley.proxy.rlwy.net:47709/railway" }
  }
});

async function main() {
  // Delete all failed processing jobs
  const deleted = await prisma.processingJob.deleteMany({ where: { status: "failed" } });
  console.log("Deleted " + deleted.count + " failed processing jobs");

  // Delete cookbooks with status "failed" that have no processing jobs left
  const failedCookbooks = await prisma.cookbook.findMany({
    where: { status: "failed" },
    select: { id: true, name: true }
  });

  for (const cb of failedCookbooks) {
    const jobCount = await prisma.processingJob.count({ where: { cookbookId: cb.id } });
    if (jobCount === 0) {
      await prisma.nonRecipeContent.deleteMany({ where: { cookbookId: cb.id } });
      await prisma.recipe.deleteMany({ where: { cookbookId: cb.id } });
      await prisma.cookbook.delete({ where: { id: cb.id } });
      console.log("Deleted failed cookbook: " + cb.name + " (id: " + cb.id + ")");
    }
  }

  // Check remaining state
  const remaining = await prisma.cookbook.findMany({
    select: { id: true, name: true, status: true, totalRecipesFound: true }
  });
  console.log("\nRemaining cookbooks:");
  for (const c of remaining) {
    console.log("  " + c.name + " - status: " + c.status + " - recipes: " + c.totalRecipesFound);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
