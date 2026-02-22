import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://postgres:sVAUptpsFExVDxmRqpgkBzHkzXACEqjn@trolley.proxy.rlwy.net:47709/railway" }
  }
});

async function main() {
  const jobs = await prisma.processingJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      totalPages: true,
      recipesExtracted: true,
      failedPages: true,
      currentPage: true,
      errorLog: true,
      createdAt: true,
      completedAt: true,
      cookbook: { select: { name: true, fileUrl: true, filePath: true, status: true, errorMessage: true } },
    }
  });

  for (const job of jobs) {
    console.log("=== JOB ===");
    console.log("ID: " + job.id);
    console.log("Status: " + job.status);
    console.log("Pages: " + job.currentPage + "/" + job.totalPages);
    console.log("Recipes: " + job.recipesExtracted + ", Failed: " + job.failedPages);
    console.log("Created: " + String(job.createdAt));
    console.log("Completed: " + String(job.completedAt));
    const cbk = job.cookbook;
    if (cbk) {
      console.log("Cookbook: " + cbk.name + " (status: " + cbk.status + ")");
      console.log("File URL: " + cbk.fileUrl);
      console.log("File Path: " + cbk.filePath);
      console.log("Cookbook Error: " + cbk.errorMessage);
    }

    try {
      const errors: string[] = JSON.parse(job.errorLog || "[]");
      if (errors.length > 0) {
        console.log("Errors (" + errors.length + "):");
        for (let i = 0; i < Math.min(errors.length, 10); i++) {
          console.log("  - " + errors[i]);
        }
      }
    } catch {
      console.log("Error log (raw): " + (job.errorLog || "").substring(0, 500));
    }
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
