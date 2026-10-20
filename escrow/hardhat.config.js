// Test-only, in-process networks. No RPC URL, remote network or wallet keys.
export default {
  networks: {
    local: {
      type: 'edr-simulated',
      chainType: 'l1',
      chainId: 31337,
      hardfork: 'shanghai',
      throwOnTransactionFailures: false,
    },
    mainnetRefusal: {
      type: 'edr-simulated',
      chainType: 'l1',
      chainId: 1,
      hardfork: 'shanghai',
      throwOnTransactionFailures: false,
    },
  },
};
