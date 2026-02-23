export const SBT_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "student", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "mintBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "students", type: "address[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
] as const;