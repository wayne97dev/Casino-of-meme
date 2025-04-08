import React from 'react';
import RewardsDashboard from './components/RewardsDashboard';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Stile del modal wallet
import '@solana/wallet-adapter-react-ui/styles.css';


const network = clusterApiUrl('devnet'); // Usa 'mainnet-beta' per mainnet

function App() {
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={network}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen flex flex-col items-center py-10 bg-gradient-to-br from-gray-900 to-black">
            <h1 className="text-5xl font-bold text-cyan-400 mb-8 tracking-wider animate-pulse">
             
            </h1>
            <RewardsDashboard />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;