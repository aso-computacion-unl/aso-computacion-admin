import { installIntegrationPrismaClient } from "./prisma-integration-pool";

// Imports run in order and are hoisted above any other statement, so the
// install has to live in a module of its own that the setup imports first.
installIntegrationPrismaClient(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
