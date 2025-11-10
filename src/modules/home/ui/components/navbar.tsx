"use client";

import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { CrownIcon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import { useScroll } from "@/hooks/use-scroll";
import { cn } from "@/lib/utils";

export const Navbar = () => {
    const { has } = useAuth();
    const hasProAccess = has?.({ plan: "pro" });
    const isScrolled = useScroll(10);

    return (
        <nav
            className={cn(
                "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent",
                isScrolled && "bg-black"
            )}
        >
            <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
                {/* Left side: Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.jpg" alt="DarkPearl" width={80} height={80} />
                    <span className="text-lg font-semibold">DarkPearl AI</span>
                </Link>

                {/* Right side: Auth buttons / user control */}
                <SignedOut>
                    <div className="flex gap-2">
                        <SignUpButton>
                          <Button variant="outline" size="sm" className="bg-white text-black hover:bg-neutral-800 hover:text-white transition-colors">
                            Sign Up
                          </Button>
                        </SignUpButton>
                        <SignInButton>
                            <Button size="sm" className="text-white">Sign In</Button>
                        </SignInButton>
                    </div>
                </SignedOut>

                <SignedIn>
                    <div className="flex items-center gap-2">
                        <UserControl showName />
                        {!hasProAccess && (
                            <Button asChild size="sm" variant="tertiary">
                                <Link href="/pricing" className="flex items-center gap-1">
                                    <CrownIcon className="h-4 w-4" /> Upgrade
                                </Link>
                            </Button>
                        )}
                    </div>
                </SignedIn>
            </div>
        </nav>
    );
};
