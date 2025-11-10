"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Github, Check, AlertCircle } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GitHubConnectDialog } from "./github-connect-dialog";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

interface GitHubPushButtonProps {
  projectId: string;
  messageId?: string;
}

export function GitHubPushButton({ projectId, messageId }: GitHubPushButtonProps) {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const searchParams = useSearchParams();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Auto-open dialog after GitHub OAuth callback
  useEffect(() => {
    if (searchParams.get("select_repo") === "true") {
      setShowConnectDialog(true);
      // Remove the query param
      const url = new URL(window.location.href);
      url.searchParams.delete("select_repo");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams]);

  // Get connection status
  const { data: status, isLoading } = useQuery(
    trpc.github.getConnectionStatus.queryOptions({ projectId })
  );

  // Push to GitHub mutation
  const pushMutation = useMutation(
    trpc.github.pushToGitHub.mutationOptions({
      onSuccess: (data) => {
        toast.success("Code pushed to GitHub successfully!", {
          description: `Commit: ${data.commitSha.substring(0, 7)}`,
          action: {
            label: "View",
            onClick: () => window.open(data.repoUrl, "_blank"),
          },
        });
      },
      onError: (error) => {
        toast.error("Failed to push to GitHub", {
          description: error.message,
        });
      },
    })
  );

  // Disconnect mutation
  const disconnectMutation = useMutation(
    trpc.github.disconnectGitHub.mutationOptions({
      onSuccess: () => {
        toast.success("Disconnected from GitHub");
        queryClient.invalidateQueries(
          trpc.github.getConnectionStatus.queryOptions({ projectId })
        );
      },
      onError: (error) => {
        toast.error("Failed to disconnect", {
          description: error.message,
        });
      },
    })
  );

  const handlePush = () => {
    pushMutation.mutateAsync({
      projectId,
      messageId,
      commitMessage: commitMessage || undefined,
    });
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect from GitHub?")) {
      disconnectMutation.mutateAsync({ projectId });
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  // If GitHub is connected but no repository is selected
  if (status?.isConnected && !status?.repoName) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConnectDialog(true)}
        >
          <Github className="w-4 h-4 mr-2" />
          Select Repository
        </Button>
        <GitHubConnectDialog
          open={showConnectDialog}
          onOpenChange={setShowConnectDialog}
          projectId={projectId}
          onSuccess={() => {
            queryClient.invalidateQueries(
              trpc.github.getConnectionStatus.queryOptions({ projectId })
            );
          }}
        />
      </>
    );
  }

  // If GitHub is not connected at all
  if (!status?.isConnected) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConnectDialog(true)}
        >
          <Github className="w-4 h-4 mr-2" />
          Connect GitHub
        </Button>
        <GitHubConnectDialog
          open={showConnectDialog}
          onOpenChange={setShowConnectDialog}
          projectId={projectId}
          onSuccess={() => {
            queryClient.invalidateQueries(
              trpc.github.getConnectionStatus.queryOptions({ projectId })
            );
          }}
        />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {pushMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Github className="w-4 h-4 mr-2" />
          )}
          {status.repoName || "GitHub"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <div className="px-2 py-1.5 text-sm font-semibold">
          {status.repoName}
        </div>
        {status.repoUrl && (
          <div className="px-2 pb-2">
            <a
              href={status.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              {status.owner}/{status.repoName}
            </a>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePush} disabled={pushMutation.isPending}>
          {pushMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Push to {status.branch || "main"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => status.repoUrl && window.open(status.repoUrl, "_blank")}
        >
          <Github className="w-4 h-4 mr-2" />
          View Repository
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnect}
          disabled={disconnectMutation.isPending}
          className="text-destructive"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
