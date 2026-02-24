"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function StudentPage() {
  const { address, isConnected } = useAccount();

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-10">
      <div className="max-w-xl mx-auto rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Espace Étudiant</h1>
        <p className="text-gray-600 mt-2">
          Ici, tu pourras voir ton SBT et l’ajouter à ton wallet.
        </p>

        <div className="mt-4">
          <ConnectButton />
        </div>

        {isConnected && (
          <div className="mt-6 text-sm">
            <div className="text-gray-600">Wallet :</div>
            <div className="font-mono break-all">{address}</div>
          </div>
        )}
      </div>
    </main>
  );
}