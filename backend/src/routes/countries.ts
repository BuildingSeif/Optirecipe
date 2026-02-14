import { Hono } from "hono";
import { prisma } from "../prisma";
import { auth } from "../auth";

const countriesRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// Get all countries (public for dropdowns)
countriesRouter.get("/", async (c) => {
  const countries = await prisma.country.findMany({
    orderBy: { order: "asc" },
    include: {
      regions: {
        orderBy: { order: "asc" },
      },
    },
  });
  return c.json({ data: countries });
});

export { countriesRouter };
