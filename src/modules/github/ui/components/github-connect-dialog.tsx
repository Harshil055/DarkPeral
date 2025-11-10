"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Github, ExternalLink } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";

interface GitHubConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

export function GitHubConnectDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: GitHubConnectDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Check if GitHub is already connected
  const { data: connectionStatus } = useQuery(
    trpc.github.getConnectionStatus.queryOptions({ projectId })
  );

  // Set initial step based on connection status
  const getInitialStep = () => {
    if (connectionStatus?.isConnected && !connectionStatus?.repoName) {
      return "choose"; // GitHub connected but no repo selected
    }
    return "connect"; // Not connected yet
  };

  const [step, setStep] = useState<"connect" | "choose" | "create" | "select">(getInitialStep());
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  // Update step when dialog opens and connection status changes
  useEffect(() => {
    if (open) {
      setStep(getInitialStep());
    }
  }, [open, connectionStatus]);

  // Get auth URL mutation
  const getAuthUrlMutation = useMutation(
    trpc.github.getAuthUrl.mutationOptions({
      onSuccess: (data) => {
        // Redirect to GitHub OAuth
        window.location.href = data.authUrl;
      },
      onError: (error) => {
        toast.error("Failed to connect to GitHub", {
          description: error.message,
        });
      },
    })
  );

  // List repositories query
  const { data: repositories, isLoading: isLoadingRepos } = useQuery({
    ...trpc.github.listRepositories.queryOptions({ projectId }),
    enabled: step === "select",
  });

  // Create repository mutation
  const createRepoMutation = useMutation(
    trpc.github.createRepository.mutationOptions({
      onSuccess: (data) => {
        toast.success("Repository created successfully!", {
          description: `Created ${data.repoName}`,
        });
        queryClient.invalidateQueries(
          trpc.github.getConnectionStatus.queryOptions({ projectId })
        );
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error) => {
        toast.error("Failed to create repository", {
          description: error.message,
        });
      },
    })
  );

  // Connect repository mutation
  const connectRepoMutation = useMutation(
    trpc.github.connectRepository.mutationOptions({
      onSuccess: () => {
        toast.success("Repository connected successfully!");
        queryClient.invalidateQueries(
          trpc.github.getConnectionStatus.queryOptions({ projectId })
        );
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error) => {
        toast.error("Failed to connect repository", {
          description: error.message,
        });
      },
    })
  );

  const handleConnectGitHub = () => {
    getAuthUrlMutation.mutateAsync({ projectId }).catch((error) => {
      console.error("Failed to get auth URL:", error);
    });
  };

  const handleCreateRepo = () => {
    if (!repoName) {
      toast.error("Please enter a repository name");
      return;
    }

    createRepoMutation.mutateAsync({
      projectId,
      repoName,
      description: repoDescription,
      isPrivate,
    });
  };

  const handleSelectRepo = () => {
    if (!selectedRepo) {
      toast.error("Please select a repository");
      return;
    }

    const repo = repositories?.find((r) => r.fullName === selectedRepo);
    if (!repo) return;

    connectRepoMutation.mutateAsync({
      projectId,
      owner: repo.owner,
      repoName: repo.name,
      branch: repo.defaultBranch,
    });
  };

  const renderContent = () => {
    switch (step) {
      case "connect":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Connect to GitHub</DialogTitle>
              <DialogDescription>
                Connect your GitHub account to push your generated code to a repository.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Github className="w-16 h-16 text-muted-foreground" />
              <p className="text-sm text-center text-muted-foreground">
                You'll be redirected to GitHub to authorize DarkPearl AI.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConnectGitHub}
                disabled={getAuthUrlMutation.isPending}
              >
                {getAuthUrlMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Connect GitHub
              </Button>
            </DialogFooter>
          </>
        );

      case "choose":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Choose Repository</DialogTitle>
              <DialogDescription>
                Create a new repository or select an existing one.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col space-y-4 py-4">
              <Button
                variant="outline"
                className="justify-start h-auto py-4"
                onClick={() => setStep("create")}
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold">Create New Repository</span>
                  <span className="text-sm text-muted-foreground">
                    Create a new GitHub repository for this project
                  </span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-4"
                onClick={() => setStep("select")}
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold">Use Existing Repository</span>
                  <span className="text-sm text-muted-foreground">
                    Connect to an existing GitHub repository
                  </span>
                </div>
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("connect")}>
                Back
              </Button>
            </DialogFooter>
          </>
        );

      case "create":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Create New Repository</DialogTitle>
              <DialogDescription>
                Enter details for your new GitHub repository.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="repo-name">Repository Name</Label>
                <Input
                  id="repo-name"
                  placeholder="my-awesome-project"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo-description">Description (Optional)</Label>
                <Input
                  id="repo-description"
                  placeholder="A brief description of your project"
                  value={repoDescription}
                  onChange={(e) => setRepoDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <RadioGroup
                  value={isPrivate ? "private" : "public"}
                  onValueChange={(value) => setIsPrivate(value === "private")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="public" id="public" />
                    <Label htmlFor="public" className="font-normal">
                      Public - Anyone can see this repository
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="private" id="private" />
                    <Label htmlFor="private" className="font-normal">
                      Private - Only you can see this repository
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button
                onClick={handleCreateRepo}
                disabled={createRepoMutation.isPending || !repoName}
              >
                {createRepoMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Repository
              </Button>
            </DialogFooter>
          </>
        );

      case "select":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Select Repository</DialogTitle>
              <DialogDescription>
                Choose an existing repository to connect.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : repositories && repositories.length > 0 ? (
                <RadioGroup value={selectedRepo || ""} onValueChange={setSelectedRepo}>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {repositories.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      >
                        <RadioGroupItem value={repo.fullName} id={repo.fullName} />
                        <Label
                          htmlFor={repo.fullName}
                          className="flex-1 cursor-pointer font-normal"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold">{repo.name}</span>
                              {repo.description && (
                                <p className="text-sm text-muted-foreground">
                                  {repo.description}
                                </p>
                              )}
                            </div>
                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No repositories found.</p>
                  <Button
                    variant="link"
                    onClick={() => setStep("create")}
                    className="mt-2"
                  >
                    Create a new repository instead
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button
                onClick={handleSelectRepo}
                disabled={connectRepoMutation.isPending || !selectedRepo}
              >
                {connectRepoMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Connect Repository
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
