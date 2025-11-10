import { z } from "zod";
import { protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { GitHubService, getGitHubAuthUrl } from "@/lib/github";
import { TRPCError } from "@trpc/server";

/**
 * Get GitHub OAuth authorization URL
 */
export const getAuthUrl = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    // Use projectId as state to identify which project to connect after OAuth
    const authUrl = getGitHubAuthUrl(input.projectId);

    return { authUrl };
  });

/**
 * Get GitHub connection status for a project
 */
export const getConnectionStatus = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
      select: {
        githubRepoUrl: true,
        githubRepoName: true,
        githubOwner: true,
        githubBranch: true,
        githubAccessToken: true,
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    return {
      isConnected: !!project.githubAccessToken,
      repoUrl: project.githubRepoUrl,
      repoName: project.githubRepoName,
      owner: project.githubOwner,
      branch: project.githubBranch || "main",
    };
  });

/**
 * List user's GitHub repositories
 */
export const listRepositories = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .query(async ({ input, ctx }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
      select: {
        githubAccessToken: true,
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (!project.githubAccessToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "GitHub not connected",
      });
    }

    const github = new GitHubService(project.githubAccessToken);
    const repos = await github.listRepositories();

    return repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      htmlUrl: repo.html_url,
      description: repo.description,
      defaultBranch: repo.default_branch,
    }));
  });

/**
 * Connect project to an existing GitHub repository
 */
export const connectRepository = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      owner: z.string(),
      repoName: z.string(),
      branch: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
      select: {
        githubAccessToken: true,
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (!project.githubAccessToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "GitHub not connected",
      });
    }

    // Verify repository exists
    const github = new GitHubService(project.githubAccessToken);
    const repoExists = await github.repositoryExists(input.owner, input.repoName);

    if (!repoExists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Repository not found or not accessible",
      });
    }

    // Update project with repository info
    await prisma.project.update({
      where: {
        id: input.projectId,
      },
      data: {
        githubOwner: input.owner,
        githubRepoName: input.repoName,
        githubRepoUrl: `https://github.com/${input.owner}/${input.repoName}`,
        githubBranch: input.branch || "main",
      },
    });

    return { success: true };
  });

/**
 * Create a new GitHub repository for the project
 */
export const createRepository = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      repoName: z.string(),
      isPrivate: z.boolean().optional(),
      description: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
      select: {
        githubAccessToken: true,
        name: true,
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (!project.githubAccessToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "GitHub not connected",
      });
    }

    const github = new GitHubService(project.githubAccessToken);

    // Get authenticated user
    const user = await github.getAuthenticatedUser();

    // Create repository
    const repo = await github.createRepository(
      input.repoName,
      input.isPrivate || false,
      input.description || `Generated by DarkPearl AI - ${project.name}`
    );

    // Update project with repository info
    await prisma.project.update({
      where: {
        id: input.projectId,
      },
      data: {
        githubOwner: user.login,
        githubRepoName: repo.name,
        githubRepoUrl: repo.html_url,
        githubBranch: repo.default_branch,
      },
    });

    return {
      success: true,
      repoUrl: repo.html_url,
      repoName: repo.name,
      owner: user.login,
    };
  });

/**
 * Push code to GitHub repository
 */
export const pushToGitHub = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      messageId: z.string().optional(), // If provided, push specific message's files
      commitMessage: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
      select: {
        githubAccessToken: true,
        githubOwner: true,
        githubRepoName: true,
        githubBranch: true,
        name: true,
        messages: {
          include: {
            fragment: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (!project.githubAccessToken || !project.githubOwner || !project.githubRepoName) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "GitHub repository not connected",
      });
    }

    // Get the files to push
    let files: Record<string, string> | null = null;

    if (input.messageId) {
      // Push specific message's files
      const message = project.messages.find((m) => m.id === input.messageId);
      if (!message || !message.fragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message or fragment not found",
        });
      }
      files = message.fragment.files as Record<string, string>;
    } else {
      // Push latest fragment's files
      const latestFragment = project.messages.find((m) => m.fragment)?.fragment;
      if (!latestFragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No code files found to push",
        });
      }
      files = latestFragment.files as Record<string, string>;
    }

    if (!files || Object.keys(files).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No files to push",
      });
    }

    // Convert files object to array format
    const githubFiles = Object.entries(files).map(([path, content]) => ({
      path,
      content,
    }));

    // Push to GitHub
    const github = new GitHubService(project.githubAccessToken);

    const commitMsg =
      input.commitMessage ||
      `Update from DarkPearl AI - ${new Date().toLocaleString()}`;

    const result = await github.pushFiles(
      project.githubOwner,
      project.githubRepoName,
      githubFiles,
      commitMsg,
      project.githubBranch || "main"
    );

    return {
      success: result.success,
      commitSha: result.commitSha,
      message: result.message,
      repoUrl: `https://github.com/${project.githubOwner}/${project.githubRepoName}`,
    };
  });

/**
 * Disconnect GitHub from project
 */
export const disconnectGitHub = protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        userId: ctx.auth.userId,
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    await prisma.project.update({
      where: {
        id: input.projectId,
      },
      data: {
        githubAccessToken: null,
        githubOwner: null,
        githubRepoName: null,
        githubRepoUrl: null,
        githubBranch: null,
      },
    });

    return { success: true };
  });
