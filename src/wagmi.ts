import { http, createConfig, createStorage } from '@wagmi/vue'
import {  walletConnect ,injected} from '@wagmi/vue/connectors'
import { defineChain } from 'viem'

const dolphinet = defineChain({
  id: 1520,
  name: 'Dolphinet',
  nativeCurrency: {
    name: 'Dolphinet',
    symbol: 'DOL',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.dolphinode.world'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Dolphinet Explorer',
      url: 'https://explorer.dolphinode.world',
    },
  },
})
export const config = createConfig({
  // chains: [mainnet, sepolia, optimism],
  chains:[dolphinet],
  connectors: [
   injected({shimDisconnect: true}),
    walletConnect({
      projectId: 'f87cf4373910e1766c873dc5df019573',
      qrModalOptions: {
        explorerRecommendedWalletIds: 'NONE',
        enableExplorer: false,
      },
    }),
    // coinbaseWallet({ appName: 'Vite Vue Playground', darkMode: true }),
  ],
  storage: createStorage({ storage: localStorage, key: 'vite-vue' }),
  transports: {
     [dolphinet.id]: http('https://rpc.dolphinode.world'),
    // [mainnet.id]: http(),
    // [sepolia.id]: http(),
    // [optimism.id]: http(),
  },
})

declare module '@wagmi/vue' {
  interface Register {
    config: typeof config
  }
}
