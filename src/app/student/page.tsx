"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "@/lib/contract";
import { SBT_ABI } from "@/lib/abi";

type Ethereum = {
  request: (args: { method: string; params?: any }) => Promise<any>;
};

export default function StudentPage() {
  const { address, isConnected } = useAccount();

  const { data: tokenId, isLoading: isLoadingToken } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SBT_ABI,
    functionName: "tokenIdOf",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: !!address },
  });

  const tid = tokenId ? BigInt(tokenId as any) : 0n;
  const hasToken = isConnected && !isLoadingToken && tid > 0n;

  const { data: uri } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SBT_ABI,
    functionName: "tokenURI",
    args: hasToken ? [tid] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: hasToken },
  });

  const [meta, setMeta] = React.useState<any>(null);
  const [metaError, setMetaError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      setMeta(null);
      setMetaError(null);
      if (!uri) return;

      try {
        const uriStr = String(uri);
        // Support ipfs://... by converting to https gateway
        const url = uriStr.startsWith("ipfs://")
          ? `https://ipfs.io/ipfs/${uriStr.replace("ipfs://", "")}`
          : uriStr;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Metadata fetch failed (${res.status})`);
        const json = await res.json();
        setMeta(json);
      } catch (e: any) {
        setMetaError(e?.message ?? "Failed to load metadata");
      }
    }
    load();
  }, [uri]);

  async function addToMetaMask() {
    if (!hasToken) return;
    const eth = (window as any).ethereum as Ethereum | undefined;
    if (!eth) {
      alert("MetaMask not detected.");
      return;
    }

    await eth.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC721",
        options: {
          address: CONTRACT_ADDRESS,
          tokenId: tid.toString(),
        },
      },
    });
  }

  const imageUrl = (() => {
    if (!meta?.image) return null;
    const img = String(meta.image);
    return img.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${img.replace("ipfs://", "")}`
      : img;
  })();

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Student Portal</h1>
            <p className="text-gray-600 mt-1">
              View your FTD Soulbound credential (Sepolia).
            </p>
          </div>
          <ConnectButton />
        </header>

        <section className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
          {!isConnected && (
            <p className="text-gray-700">
              Connect your wallet to view your credential.
            </p>
          )}

          {isConnected && (
            <>
              <div className="text-sm text-gray-600">Connected wallet</div>
              <div className="font-mono text-sm break-all">{address}</div>

              <div className="mt-6">
                {isLoadingToken ? (
                  <p className="text-gray-600">Checking credential…</p>
                ) : hasToken ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm text-gray-600">Token ID</div>
                      <div className="text-lg font-semibold">{tid.toString()}</div>
                      <div className="text-sm text-gray-600 mt-2">Token URI</div>
                      <div className="font-mono text-xs break-all">{String(uri ?? "…")}</div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-black"
                          onClick={addToMetaMask}
                        >
                          Add to MetaMask
                        </button>

                        <a
                          className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${address}`}
                        >
                          View on Etherscan
                        </a>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <h2 className="font-semibold">Credential preview</h2>

                      {metaError && (
                        <p className="text-sm text-red-600 mt-2">{metaError}</p>
                      )}

                      {!meta && !metaError && (
                        <p className="text-sm text-gray-600 mt-2">Loading metadata…</p>
                      )}

                      {meta && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={meta.name ?? "Credential"}
                                className="w-full h-auto rounded-md"
                              />
                            ) : (
                              <div className="text-sm text-gray-600">
                                No image found in metadata.
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="text-lg font-semibold">
                              {meta.name ?? "FTD Credential"}
                            </div>
                            {meta.description && (
                              <p className="text-sm text-gray-700">
                                {String(meta.description)}
                              </p>
                            )}
                            {Array.isArray(meta.attributes) && (
                              <div className="mt-2">
                                <div className="text-sm font-medium">Attributes</div>
                                <ul className="mt-1 text-sm text-gray-700 list-disc pl-5">
                                  {meta.attributes.slice(0, 12).map((a: any, i: number) => (
                                    <li key={i}>
                                      {String(a.trait_type ?? "trait")}: {String(a.value ?? "")}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-red-600">
                    No active credential found for this address.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}