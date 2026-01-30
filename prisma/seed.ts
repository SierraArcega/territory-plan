import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const services = [
  { name: "Homebound", slug: "homebound", color: "#6EA3BE", sortOrder: 1 },
  { name: "Whole Class Virtual Instruction", slug: "wcvi", color: "#8AA891", sortOrder: 2 },
  { name: "Credit Recovery", slug: "credit-recovery", color: "#D4A84B", sortOrder: 3 },
  { name: "Suspension Alternatives", slug: "suspension-alt", color: "#F37167", sortOrder: 4 },
  { name: "Tutoring", slug: "tutoring", color: "#403770", sortOrder: 5 },
  { name: "Resource Rooms", slug: "resource-rooms", color: "#7C6FA0", sortOrder: 6 },
  { name: "Test Prep", slug: "test-prep", color: "#5EADB0", sortOrder: 7 },
  { name: "Homework Help", slug: "homework-help", color: "#E8926B", sortOrder: 8 },
  { name: "Hybrid Staffing", slug: "hybrid-staffing", color: "#9B7EDE", sortOrder: 9 },
];

async function main() {
  console.log("Seeding services...");

  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        color: service.color,
        sortOrder: service.sortOrder,
      },
      create: service,
    });
  }

  console.log(`Seeded ${services.length} services`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
