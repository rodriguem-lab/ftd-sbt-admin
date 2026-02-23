"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "@/lib/contract";
import { SBT_ABI } from "@/lib/abi";

type TxLog = {
  at: string;
  action: string;
  hash?: `0x${string}`;
  status: "pending" | "success" | "error";
  note?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseAddressesFromText(text: string): string[] {
  const raw = text
    .replace(/\r/g, "\n")
    .split(/[\n,;\t ]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (isAddress(v)) {
      const lower = v.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        out.push(v);
      }
    }
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SBT_ABI,
    functionName: "owner",
    chainId: SEPOLIA_CHAIN_ID,
  });

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;
  const isOwner =
    !!address && !!owner && address.toLowerCase() === String(owner).toLowerCase();

  const { writeContract, data: txHash, error: writeError, isPending } =
    useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
      chainId: SEPOLIA_CHAIN_ID,
    });

  const [mintTo, setMintTo] = React.useState("");
  const [revokeId, setRevokeId] = React.useState("");
  const [batchText, setBatchText] = React.useState("");
  const [batchChunkSize, setBatchChunkSize] = React.useState(40);
  const [logs, setLogs] = React.useState<TxLog[]>([]);
  const [sessionMinted, setSessionMinted] = React.useState(0);

  const canAdmin = isConnected && isSepolia && isOwner;

  const addLog = React.useCallback((entry: TxLog) => {
    setLogs((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  React.useEffect(() => {
    if (writeError) {
      addLog({
        at: nowIso(),
        action: "tx-error",
        status: "error",
        note: writeError.message,
      });
    }
  }, [writeError, addLog]);

  React.useEffect(() => {
    if (txHash && isConfirmed) {
      addLog({
        at: nowIso(),
        action: "tx-confirmed",
        hash: txHash,
        status: "success",
      });
    }
  }, [txHash, isConfirmed, addLog]);

  function requireReady(): string | null {
    if (!isConnected) return "Connecte ton wallet.";
    if (!isSepolia) return "Passe sur Sepolia.";
    if (!isOwner) return "Not authorized: ce wallet n’est pas owner du contrat.";
    return null;
  }

  function onSwitchToSepolia() {
    switchChain({ chainId: sepolia.id });
  }

  function onMint() {
    const msg = requireReady();
    if (msg) {
      addLog({ at: nowIso(), action: "mint", status: "error", note: msg });
      return;
    }
    if (!isAddress(mintTo)) {
      addLog({
        at: nowIso(),
        action: "mint",
        status: "error",
        note: "Adresse invalide.",
      });
      return;
    }

    addLog({ at: nowIso(), action: `mint(${mintTo})`, status: "pending" });

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: SBT_ABI,
      functionName: "mint",
      args: [mintTo as `0x${string}`],
      chainId: SEPOLIA_CHAIN_ID,
    });

    setSessionMinted((x) => x + 1);
    setMintTo("");
  }

  async function onBatchFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const addresses = parseAddressesFromText(text);

    setBatchText(addresses.join("\n"));
    addLog({
      at: nowIso(),
      action: "batch-import",
      status: "success",
      note: `Import: ${addresses.length} adresses valides`,
    });
  }

  async function onBatchMint() {
    const msg = requireReady();
    if (msg) {
      addLog({ at: nowIso(), action: "mintBatch", status: "error", note: msg });
      return;
    }

    const addresses = parseAddressesFromText(batchText);
    if (addresses.length === 0) {
      addLog({
        at: nowIso(),
        action: "mintBatch",
        status: "error",
        note: "Aucune adresse valide.",
      });
      return;
    }

    const size = Math.max(1, Math.min(200, Number(batchChunkSize) || 40));
    const parts = chunk(addresses, size);

    addLog({
      at: nowIso(),
      action: "mintBatch",
      status: "pending",
      note: `Envoi en ${parts.length} lot(s) de ${size}`,
    });

    for (let i = 0; i < parts.length; i++) {
      const lot = parts[i] as `0x${string}`[];

      addLog({
        at: nowIso(),
        action: `mintBatch lot ${i + 1}/${parts.length} (${lot.length})`,
        status: "pending",
      });

      // Send sequentially to avoid nonce issues
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        writeContract(
          {
            address: CONTRACT_ADDRESS,
            abi: SBT_ABI,
            functionName: "mintBatch",
            args: [lot],
            chainId: SEPOLIA_CHAIN_ID,
          },
          { onSettled: () => resolve() }
        );
      });

      setSessionMinted((x) => x + lot.length);
    }
  }

  function onRevoke() {
    const msg = requireReady();
    if (msg) {
      addLog({ at: nowIso(), action: "revoke", status: "error", note: msg });
      return;
    }

    const tid = BigInt(revokeId || "0");
    if (tid <= BigInt(0)) {
      addLog({
        at: nowIso(),
        action: "revoke",
        status: "error",
        note: "TokenId invalide (doit être > 0).",
      });
      return;
    }

    addLog({
      at: nowIso(),
      action: `revoke(${tid.toString()})`,
      status: "pending",
    });

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: SBT_ABI,
      functionName: "revoke",
      args: [tid],
      chainId: SEPOLIA_CHAIN_ID,
    });

    setRevokeId("");
  }

  function exportLogsCsv() {
    const header = "at,action,status,hash,note\n";
    const rows = logs
      .slice()
      .reverse()
      .map((l) => {
        const safe = (v?: string) =>
          `"${String(v ?? "").replaceAll('"', '""')}"`;
        return [
          safe(l.at),
          safe(l.action),
          safe(l.status),
          safe(l.hash ?? ""),
          safe(l.note ?? ""),
        ].join(",");
      })
      .join("\n");

    downloadText(`ftd-sbt-logs-${Date.now()}.csv`, header + rows + "\n");
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">FTD Soulbound Admin Panel</h1>
            <p className="text-neutral-400 mt-2">
              Interface d’émission/révocation (Sepolia)
            </p>
          </div>
          <ConnectButton />
        </header>

        <section className="rounded-xl bg-white shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold">Contract status</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-neutral-800 p-4">
              <div className="text-neutral-400">Contract (Sepolia)</div>
              <div className="mt-1 font-mono break-all">{CONTRACT_ADDRESS}</div>
            </div>

            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6">
              <div className="text-neutral-400">Réseau connecté</div>
              <div className="mt-1">
                {isConnected ? (
                  isSepolia ? (
                    <span className="text-emerald-300">Sepolia ✅</span>
                  ) : (
                    <span className="text-amber-300">
                      Mauvais réseau ❌ (chainId {chainId})
                    </span>
                  )
                ) : (
                  <span className="text-neutral-300">Non connecté</span>
                )}
              </div>

              {!isSepolia && isConnected && (
                <button
                  className="mt-3 px-3 py-2 rounded-lg bg-white text-black text-sm disabled:opacity-60"
                  onClick={onSwitchToSepolia}
                  disabled={isSwitching}
                >
                  Switch network → Sepolia
                </button>
              )}
            </div>

            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6">
              <div className="text-neutral-400">Owner (owner())</div>
              <div className="mt-1 font-mono break-all">
                {owner ? String(owner) : "…"}
              </div>
            </div>

            <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6">
              <div className="text-neutral-400">Wallet connecté = owner ?</div>
              <div className="mt-1">
                {!isConnected ? (
                  <span className="text-neutral-300">—</span>
                ) : isOwner ? (
                  <span className="text-emerald-300">Oui ✅</span>
                ) : (
                  <span className="text-red-300">Non ❌</span>
                )}
              </div>
              {!isOwner && isConnected && (
                <div className="mt-2 text-xs text-neutral-400">
                  Les actions admin sont désactivées si tu n’es pas owner.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-neutral-800 p-5 bg-neutral-900/40">
            <h3 className="font-semibold text-lg">Mint 1 étudiant</h3>
            <p className="text-sm text-neutral-400 mt-1">
              Émet un SBT à une adresse.
            </p>
            <input
              className="mt-4 w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm font-mono"
              placeholder="0x..."
              value={mintTo}
              onChange={(e) => setMintTo(e.target.value)}
            />
            <button
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white text-black text-sm disabled:opacity-50"
              onClick={onMint}
              disabled={!canAdmin || isPending || isConfirming}
            >
              Mint
            </button>
            <div className="mt-2 text-xs text-neutral-400">
              {canAdmin ? "Autorisé ✅" : "Non autorisé / mauvais réseau ❌"}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5 bg-neutral-900/40">
            <h3 className="font-semibold text-lg">Batch Mint</h3>
            <p className="text-sm text-neutral-400 mt-1">
              Upload CSV/JSON ou colle une liste d’adresses.
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="text-sm text-neutral-300">
                Chunk size
                <input
                  type="number"
                  className="ml-2 w-20 rounded-lg bg-neutral-950 border border-neutral-800 px-2 py-1 text-sm"
                  value={batchChunkSize}
                  onChange={(e) => setBatchChunkSize(Number(e.target.value))}
                  min={1}
                  max={200}
                />
              </label>

              <input
                type="file"
                accept=".csv,.txt,.json"
                onChange={onBatchFile}
                className="text-sm text-neutral-300"
              />
            </div>

            <textarea
              className="mt-3 w-full h-28 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs font-mono"
              placeholder="0xabc...\n0xdef...\n..."
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />

            <button
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white text-black text-sm disabled:opacity-50"
              onClick={onBatchMint}
              disabled={!canAdmin || isPending || isConfirming}
            >
              Batch mint
            </button>

            <div className="mt-2 text-xs text-neutral-400">
              Tip : commence avec 20–50 adresses/tx sur Sepolia.
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-5 bg-neutral-900/40">
            <h3 className="font-semibold text-lg">Revoke</h3>
            <p className="text-sm text-neutral-400 mt-1">
              Brûle un token via son tokenId.
            </p>
            <input
              className="mt-4 w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm font-mono"
              placeholder="tokenId (ex: 1)"
              value={revokeId}
              onChange={(e) => setRevokeId(e.target.value)}
            />
            <button
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white text-black text-sm disabled:opacity-50"
              onClick={onRevoke}
              disabled={!canAdmin || isPending || isConfirming}
            >
              Revoke
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 p-5 bg-neutral-900/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Logs / preuves</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Historique local des actions envoyées depuis cette session.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-neutral-700 text-sm hover:bg-neutral-900"
                onClick={() =>
                  downloadText(
                    `batch-template-${Date.now()}.txt`,
                    "0x...\n0x...\n"
                  )
                }
              >
                Template
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-white text-black text-sm disabled:opacity-50"
                onClick={exportLogsCsv}
                disabled={logs.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-neutral-800 p-4">
              <div className="text-neutral-400">Tx state</div>
              <div className="mt-1">
                {isPending ? "Signature en cours…" : "—"}
                {isConfirming ? " Confirmation…" : ""}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 p-4">
              <div className="text-neutral-400">Dernière tx hash</div>
              <div className="mt-1 font-mono break-all">{txHash ?? "—"}</div>
            </div>

            <div className="rounded-xl border border-neutral-800 p-4">
              <div className="text-neutral-400">Minted (session)</div>
              <div className="mt-1 text-lg font-semibold">{sessionMinted}</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {logs.length === 0 ? (
              <div className="text-sm text-neutral-500">
                Aucun log pour le moment.
              </div>
            ) : (
              logs.map((l, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-800 p-3 bg-neutral-950/40"
                >
                  <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs text-neutral-400">
                    <span className="font-mono">{l.at}</span>
                    <span>•</span>
                    <span>{l.action}</span>
                    <span>•</span>
                    <span
                      className={
                        l.status === "success"
                          ? "text-emerald-300"
                          : l.status === "error"
                          ? "text-red-300"
                          : "text-amber-300"
                      }
                    >
                      {l.status}
                    </span>
                  </div>

                  {l.hash && (
                    <div className="mt-1 text-xs font-mono break-all">
                      {l.hash}
                    </div>
                  )}
                  {l.note && (
                    <div className="mt-1 text-xs text-neutral-300">{l.note}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}