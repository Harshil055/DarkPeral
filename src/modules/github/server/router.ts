import { createTRPCRouter } from "@/trpc/init";
import * as procedures from "./procedures";

export const githubRouter = createTRPCRouter({
  getAuthUrl: procedures.getAuthUrl,
  getConnectionStatus: procedures.getConnectionStatus,
  listRepositories: procedures.listRepositories,
  connectRepository: procedures.connectRepository,
  createRepository: procedures.createRepository,
  pushToGitHub: procedures.pushToGitHub,
  disconnectGitHub: procedures.disconnectGitHub,
});
