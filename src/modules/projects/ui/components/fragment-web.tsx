import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Fragment } from "@prisma/client";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";
import { useState } from "react";

interface Props {
    data: Fragment;
}

export const FragmentWeb = ({ data }: Props) => {
    const [fragmentKey, setFragmentKey] = useState(0);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(false);

    const handleRefresh = () => {
        setFragmentKey((prev) => prev + 1);
        setError(false);
    }
    const handleCopy = () => {
        navigator.clipboard.writeText(data.sandboxUrl);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    }
    return (
        <div className="flex flex-col w-full h-full">
            <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
                <Hint text="Refresh" side="bottom" align="start">
                    <Button size="sm" variant="outline" onClick={handleRefresh}>
                        <RefreshCcwIcon className="size-4" />
                    </Button>
                </Hint>
                <Hint text="Click to copy" side="bottom">
                    <Button size="sm" variant="outline" onClick={handleCopy}
                    disabled={!data.sandboxUrl || copied}
                    className="flex-1 justify-start text-start font-normal"
                    >
                        <span className="truncate">
                            {data.sandboxUrl}
                        </span>
                    </Button>
                </Hint>
                <Hint text="Open in a new tab" side="bottom" align="start">
                    <Button size="sm" variant="outline" disabled={!data.sandboxUrl}
                    onClick={() => {
                        if(!data.sandboxUrl) return;
                        window.open(data.sandboxUrl, "_blank");
                    }}>
                        <ExternalLinkIcon className="size-4" />
                    </Button>
                </Hint>
            </div>
            {error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                    <div className="text-muted-foreground">
                        <p className="text-lg font-semibold">Sandbox Not Found</p>
                        <p className="text-sm mt-2">
                            This sandbox has expired or is no longer available.
                            E2B sandboxes have a limited lifetime.
                        </p>
                        <p className="text-sm mt-2 text-xs">
                            Please create a new generation to get a fresh sandbox.
                        </p>
                    </div>
                </div>
            ) : (
                <iframe
                    key={fragmentKey}
                    className="h-full w-full"
                    sandbox="allow-forms allow-scripts allow-same-origin"
                    loading="lazy"
                    src={data.sandboxUrl}
                    onError={() => setError(true)}
                />
            )}
        </div>
    )
}