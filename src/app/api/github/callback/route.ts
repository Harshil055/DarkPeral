import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { exchangeCodeForToken } from "@/lib/github";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(
        new URL("/sign-in?error=unauthorized", request.url)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/projects?error=github_auth_failed&message=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/projects?error=missing_parameters", request.url)
      );
    }

    // State contains the projectId
    const projectId = state;

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return NextResponse.redirect(
        new URL("/projects?error=project_not_found", request.url)
      );
    }

    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);

    // Update project with GitHub access token
    await prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        githubAccessToken: accessToken,
      },
    });

    // Redirect back to the project page with success message and flag to open repo selection
    return NextResponse.redirect(
      new URL(`/projects/${projectId}?github_connected=true&select_repo=true`, request.url)
    );
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/projects?error=github_connection_failed", request.url)
    );
  }
}
