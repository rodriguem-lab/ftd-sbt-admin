"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "@/lib/contract";
import { SBT_ABI } from "@/lib/abi";

export default function GatePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const { data: owner, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SBT_ABI,
    functionName: "owner",
    chainId: SEPOLIA_CHAIN_ID,
  });

  React.useEffect(() => {
    if (!isConnected || !address || !owner) return;

    const isAdmin = address.toLowerCase() === String(owner).toLowerCase();
    router.replace(isAdmin ? "/admin" : "/student");
  }, [isConnected, address, owner, router]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-10">
      <div className="max-w-xl mx-auto rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">FTD Credential Portal</h1>
        <p className="text-gray-600 mt-2">
          Connecte ton wallet pour accéder à ton espace.
        </p>

        <div className="mt-4">
          <ConnectButton />
        </div>

        <p className="text-xs text-gray-500 mt-3">
          {isConnected
            ? isLoading
              ? "Vérification des droits…"
              : "Redirection…"
            : "Tu seras redirigé automatiquement (Admin ou Étudiant)."}
        </p>
      </div>
    </main>
  );
}