-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "githubAccessToken" TEXT,
ADD COLUMN     "githubBranch" TEXT DEFAULT 'main',
ADD COLUMN     "githubOwner" TEXT,
ADD COLUMN     "githubRepoName" TEXT,
ADD COLUMN     "githubRepoUrl" TEXT;
