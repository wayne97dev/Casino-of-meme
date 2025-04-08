import React, { useState, useEffect, useRef } from 'react';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token';
import bs58 from 'bs58';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, useFBX, useAnimations, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import io from 'socket.io-client';
import axios from 'axios';

// File audio
const backgroundMusic = 'crazy-time-background.mp3';
const spinSound = 'spin-sound.mp3';
const winSound = 'win-sound.mp3';

const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT;
const WALLET_PRIVATE_KEY = import.meta.env.VITE_WALLET_PRIVATE_KEY;
const MINT_ADDRESS_RAW = import.meta.env.VITE_MINT_ADDRESS;

console.log('DEBUG - RPC_ENDPOINT:', RPC_ENDPOINT);
console.log('DEBUG - WALLET_PRIVATE_KEY:', WALLET_PRIVATE_KEY ? 'Present' : 'Not defined');
console.log('DEBUG - MINT_ADDRESS_RAW:', MINT_ADDRESS_RAW);

if (!RPC_ENDPOINT || !WALLET_PRIVATE_KEY || !MINT_ADDRESS_RAW) {
  console.error('ERROR - One or more environment variables are not defined in .env');
}

const MINT_ADDRESS = MINT_ADDRESS_RAW ? new PublicKey(MINT_ADDRESS_RAW) : null;
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const WBTC_MINT = new PublicKey('3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh');
const WETH_MINT = new PublicKey('7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs');

const TOKEN_NAME = 'Casino of Meme';
const TOKEN_SYMBOL = 'COM';

const connection = RPC_ENDPOINT ? new Connection(RPC_ENDPOINT, 'confirmed') : null;
const wallet = WALLET_PRIVATE_KEY ? Keypair.fromSecretKey(bs58.decode(WALLET_PRIVATE_KEY)) : null;

const CARD_BACK_IMAGE = 'card-back.png';

const BACKEND_URL = 'https://casino-of-meme-backend.onrender.com';
const socket = io(BACKEND_URL);

// Percentuale di vittoria del computer per ogni minigioco
const COMPUTER_WIN_CHANCE = {
  cardDuel: 0.7,
  memeSlots: 0.9,
  coinFlip: 0.6,
  crazyTime: 0.8,
};

// Mazzo per Solana Card Duel
const deck = Array.from({ length: 52 }, (_, i) => {
  const cardNumber = (i % 13) + 1;
  const suit = ['spades', 'hearts', 'diamonds', 'clubs'][Math.floor(i / 13)];
  const suitChar = 'SHDC'[Math.floor(i / 13)];
  let cardName;
  if (cardNumber === 1) cardName = 'A';
  else if (cardNumber === 10) cardName = '0';
  else if (cardNumber === 11) cardName = 'J';
  else if (cardNumber === 12) cardName = 'Q';
  else if (cardNumber === 13) cardName = 'K';
  else cardName = cardNumber;
  return {
    value: Math.min(cardNumber, 10),
    suit: suit,
    image: `https://deckofcardsapi.com/static/img/${cardName}${suitChar}.png`,
  };
});

// Segmenti della ruota per Crazy Time
const crazyTimeWheelBase = [
  ...Array(23).fill().map(() => ({ type: 'number', value: 1, color: '#FFD700', colorName: 'Yellow' })),
  ...Array(15).fill().map(() => ({ type: 'number', value: 2, color: '#00FF00', colorName: 'Green' })),
  ...Array(7).fill().map(() => ({ type: 'number', value: 5, color: '#FF4500', colorName: 'Orange' })),
  ...Array(4).fill().map(() => ({ type: 'number', value: 10, color: '#1E90FF', colorName: 'Blue' })),
  ...Array(4).fill().map(() => ({ type: 'bonus', value: 'Coin Flip', color: '#FF69B4', colorName: 'Pink' })),
  ...Array(2).fill().map(() => ({ type: 'bonus', value: 'Pachinko', color: '#00CED1', colorName: 'Turquoise' })),
  ...Array(2).fill().map(() => ({ type: 'bonus', value: 'Cash Hunt', color: '#8A2BE2', colorName: 'Purple' })),
  { type: 'bonus', value: 'Crazy Time', color: '#FF0000', colorName: 'Red' },
];

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const crazyTimeWheel = shuffleArray([...crazyTimeWheelBase]);

const slotMemes = [
  { name: 'Doge', image: '/doge.png' },
  { name: 'Pepe', image: '/pepe.png' },
  { name: 'Wojak', image: '/wojak.png' },
  { name: 'Shiba', image: '/shiba.png' },
  { name: 'Moon', image: '/moon.png' },
];

// Componente per le particelle (effetto visivo per le vincite)
const Particles = ({ position }) => {
  const particlesCount = 100;
  const positions = new Float32Array(particlesCount * 3);
  const colors = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5;

    colors[i * 3] = 1; // R
    colors[i * 3 + 1] = 1; // G
    colors[i * 3 + 2] = 0; // B (giallo)
  }

  const points = useRef();

  useEffect(() => {
    points.current.geometry.attributes.position.needsUpdate = true;
  }, []);

  return (
    <points ref={points} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particlesCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        vertexColors
        transparent
        opacity={0.8}
      />
    </points>
  );
};

// Funzione per valutare le mani di poker (usata solo per debug locale, il backend la gestisce ora)
const evaluatePokerHand = (hand) => {
  const values = hand.map(card => card.value).sort((a, b) => b - a);
  const suits = hand.map(card => card.suit);
  const isFlush = suits.every(suit => suit === suits[0]);
  const isStraight = values.every((val, i) => i === 0 || val === values[i - 1] - 1);
  const valueCounts = {};
  values.forEach(val => {
    valueCounts[val] = (valueCounts[val] || 0) + 1;
  });
  const counts = Object.values(valueCounts).sort((a, b) => b - a);
  if (isFlush && isStraight) return { rank: 8, description: 'Straight Flush' };
  if (counts[0] === 4) return { rank: 7, description: 'Four of a Kind' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 6, description: 'Full House' };
  if (isFlush) return { rank: 5, description: 'Flush' };
  if (isStraight) return { rank: 4, description: 'Straight' };
  if (counts[0] === 3) return { rank: 3, description: 'Three of a Kind' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 2, description: 'Two Pair' };
  if (counts[0] === 2) return { rank: 1, description: 'One Pair' };
  return { rank: 0, description: 'High Card', highCard: values[0] };
};

// Componente per il croupier
const Croupier = ({ position, currentAnimation = 'Idle' }) => {
  const group = useRef();
  const fbx = useFBX('/models/frog-suit-idle.fbx');
  const { actions, names } = useAnimations(fbx.animations, group);

  const frogColorTexture = useLoader(THREE.TextureLoader, '/models/Frog_Color.png');
  const frogSuitColorTexture = useLoader(THREE.TextureLoader, '/models/Frog_Suit_Color.png');
  const cartoonEyeGreenTexture = useLoader(THREE.TextureLoader, '/models/Cartoon_Eye_Green.png');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        const meshName = child.name;
        let textureToApply;

        if (meshName === 'Frog_Body' || meshName === 'Frog_Jaws') {
          textureToApply = frogColorTexture;
        } else if (meshName === 'Frog_Suit') {
          textureToApply = frogSuitColorTexture;
        } else if (meshName === 'Frog_Eyes') {
          textureToApply = cartoonEyeGreenTexture;
        } else {
          textureToApply = frogColorTexture;
        }

        child.material = new THREE.MeshStandardMaterial({
          map: textureToApply,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(0x111111),
          emissiveIntensity: 0.2,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, frogColorTexture, frogSuitColorTexture, cartoonEyeGreenTexture]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      Object.values(actions).forEach(action => {
        if (action) action.stop();
      });
    }

    const animationName = names.find(name => name.toLowerCase().includes(currentAnimation.toLowerCase())) || (names.length > 0 ? names[0] : null);

    if (animationName && actions && actions[animationName]) {
      actions[animationName].reset().fadeIn(0.5).play();
    }
  }, [actions, names, currentAnimation]);

  return (
    <group ref={group} position={position}>
      <primitive object={fbx} scale={[0.01, 0.01, 0.01]} />
    </group>
  );
};

// Componente per la slot machine
const SlotMachine = ({ position, gameName, onClick }) => {
  const group = useRef();
  const fbx = useFBX('/models/slot-machine.fbx');
  const { actions, names } = useAnimations(fbx.animations, group);
  const [hovered, setHovered] = useState(false);

  const slotBaseColorTexture = useLoader(THREE.TextureLoader, '/models/textures/TX_Slot_Machine_1_1_Base_color.png');
  const slotNormalTexture = useLoader(THREE.TextureLoader, '/models/textures/TX_Slot_Machine_1_1_Normal.png');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: slotBaseColorTexture,
          normalMap: slotNormalTexture,
          side: THREE.DoubleSide,
          roughness: 0.5,
          metalness: 0.5,
          emissive: hovered ? new THREE.Color(0xff0000) : new THREE.Color(0x000000),
          emissiveIntensity: hovered ? 0.5 : 0,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, slotBaseColorTexture, slotNormalTexture, hovered]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      Object.values(actions).forEach(action => {
        if (action) action.stop();
      });
    }

    const animationName = names.find(name => name.toLowerCase().includes('spin')) || (names.length > 0 ? names[0] : null);

    if (animationName && actions && actions[animationName]) {
      actions[animationName].reset().fadeIn(0.5).play();
    }
  }, [actions, names]);

  return (
    <group
      ref={group}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={fbx} scale={[0.04, 0.04, 0.04]} />
      <Text
        position={[0, 1, 3]}
        fontSize={1.3}
        color={hovered ? "yellow" : "red"}
        anchorX="center"
        anchorY="middle"
      >
        {gameName}
      </Text>
    </group>
  );
};

// Componente per la carta da poker
const PokerCard = ({ position, gameName, onClick }) => {
  const group = useRef();
  const fbx = useFBX('/models/poker-cards-clubs-a-v1-001.fbx');
  const [hovered, setHovered] = useState(false);

  const diffuseTexture = useLoader(THREE.TextureLoader, '/models/Poker Cards_Clubs A_V1_001_Diffuse.png');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: diffuseTexture,
          side: THREE.DoubleSide,
          emissive: hovered ? new THREE.Color(0x00ff00) : new THREE.Color(0x000000),
          emissiveIntensity: hovered ? 0.3 : 0,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, diffuseTexture, hovered]);

  return (
    <group
      ref={group}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={fbx} scale={[0.1, 0.1, 0.1]} />
      <Text
        position={[0, 0.5, 0.5]}
        fontSize={0.4}
        color={hovered ? "yellow" : "red"}
        anchorX="center"
        anchorY="middle"
      >
        {gameName}
      </Text>
    </group>
  );
};

// Componente per la ruota di Crazy Time
const CrazyTimeWheel = ({ position, gameName, onClick }) => {
  const group = useRef();
  const fbx = useFBX('/models/crazytime-wheel.fbx');
  const { actions, names } = useAnimations(fbx.animations, group);
  const [hovered, setHovered] = useState(false);

  const wheelTexture = useLoader(THREE.TextureLoader, '/models/textures/crazytime-wheel-texture.jpg');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: wheelTexture,
          side: THREE.DoubleSide,
          roughness: 0.7,
          metalness: 0.1,
          emissive: hovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000),
          emissiveIntensity: hovered ? 0.5 : 0,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, wheelTexture, hovered]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      Object.values(actions).forEach(action => {
        if (action) action.stop();
      });
    }

    const animationName = names.find(name => name.toLowerCase().includes('spin')) || (names.length > 0 ? names[0] : null);

    if (animationName && actions && actions[animationName]) {
      actions[animationName].reset().fadeIn(0.5).play();
    }
  }, [actions, names]);

  return (
    <group
      ref={group}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={fbx} scale={[0.05, 0.05, 0.05]} />
      <Text
        position={[0, 1, 1]}
        fontSize={1.3}
        color={hovered ? "yellow" : "red"}
        anchorX="center"
        anchorY="middle"
      >
        {gameName}
      </Text>
    </group>
  );
};

// Componente per il Coin Flip
const CoinFlip = ({ position, gameName, onClick }) => {
  const group = useRef();
  const fbx = useFBX('/models/coinflip.fbx');
  const { actions, names } = useAnimations(fbx.animations, group);
  const [hovered, setHovered] = useState(false);

  const coinTexture = useLoader(THREE.TextureLoader, '/models/textures/coinflip-texture.jpg');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: coinTexture,
          side: THREE.DoubleSide,
          roughness: 0.5,
          metalness: 0.8,
          emissive: hovered ? new THREE.Color(0xffff00) : new THREE.Color(0x000000),
          emissiveIntensity: hovered ? 0.3 : 0,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, coinTexture, hovered]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      Object.values(actions).forEach(action => {
        if (action) action.stop();
      });
    }

    const animationName = names.find(name => name.toLowerCase().includes('flip')) || (names.length > 0 ? names[0] : null);

    if (animationName && actions && actions[animationName]) {
      actions[animationName].reset().fadeIn(0.5).play();
    }
  }, [actions, names]);

  return (
    <group
      ref={group}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={fbx} scale={[0.1, 0.1, 0.1]} />
      <Text
        position={[0, 0, 1]}
        fontSize={1.3}
        color={hovered ? "yellow" : "red"}
        anchorX="center"
        anchorY="middle"
      >
        {gameName}
      </Text>
    </group>
  );
};

// Componente per il tavolo da casinò
const CasinoTable = ({ position }) => {
  const group = useRef();
  const fbx = useFBX('/models/casino-table.fbx');
  const tableDiffuseTexture = useLoader(THREE.TextureLoader, '/models/textures/casino-table-diffuse.jpg');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: tableDiffuseTexture,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0.3,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, tableDiffuseTexture]);

  return (
    <group ref={group} position={position}>
      <primitive object={fbx} scale={[0.04, 0.04, 0.04]} />
    </group>
  );
};

// Componente per il tavolo centrale (Poker PvP)
const BlackjackTable = ({ position, onSelectGame }) => {
  const group = useRef();
  const fbx = useFBX('/models/blackjack-table.fbx');
  const tableDiffuseTexture = useLoader(THREE.TextureLoader, '/models/textures/blackjack-table-diffuse.jpg');
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: tableDiffuseTexture,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0.3,
          emissive: hovered ? new THREE.Color(0xff00ff) : new THREE.Color(0x000000),
          emissiveIntensity: hovered ? 0.5 : 0,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, tableDiffuseTexture, hovered]);

  return (
    <group
      ref={group}
      position={position}
      onClick={() => onSelectGame('Poker PvP')}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={fbx} scale={[0.04, 0.04, 0.04]} />
      <Text
        position={[0, 5, 0]}
        fontSize={1.3}
        color={hovered ? "yellow" : "red"}
        anchorX="center"
        anchorY="middle"
      >
        Poker PvP
      </Text>
    </group>
  );
};

// Sottocomponente per la logica della scena
const SceneContent = ({ onSelectGame, croupierAnimation, setCroupierAnimation, triggerWinEffect }) => {
  const { camera } = useThree();
  const [showParticles, setShowParticles] = useState(false);
  const [winLightColor, setWinLightColor] = useState(new THREE.Color('red'));

  const brickTexture = useLoader(THREE.TextureLoader, '/models/textures/red_brick_seamless.jpg');
  const brickNormalTexture = useLoader(THREE.TextureLoader, '/models/textures/111.jpg');

  useEffect(() => {
    brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
    brickTexture.repeat.set(10, 10);
    if (brickNormalTexture) {
      brickNormalTexture.wrapS = brickNormalTexture.wrapT = THREE.RepeatWrapping;
      brickNormalTexture.repeat.set(10, 10);
    }
  }, [brickTexture, brickNormalTexture]);

  useEffect(() => {
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const handleSelectGame = (game) => {
    setCroupierAnimation('Wave');
    onSelectGame(game);
  };

  useEffect(() => {
    if (triggerWinEffect) {
      setShowParticles(true);
      setWinLightColor(new THREE.Color('yellow'));
      setTimeout(() => {
        setShowParticles(false);
        setWinLightColor(new THREE.Color('red'));
      }, 3000);
    }
  }, [triggerWinEffect]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={60} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 5, 0]} color={winLightColor} intensity={2} distance={20} />
      <pointLight position={[15, 5, 15]} color="blue" intensity={2} distance={20} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial
          map={brickTexture}
          normalMap={brickNormalTexture}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      <Croupier position={[-12, -1, -5]} currentAnimation={croupierAnimation} />

      <PokerCard
        position={[-13, 2, 18]}
        gameName="Solana Card Duel"
        onClick={() => handleSelectGame('Solana Card Duel')}
      />
      <SlotMachine
        position={[15, -1, -15]}
        gameName="Meme Slots"
        onClick={() => handleSelectGame('Meme Slots')}
      />
      <CoinFlip
        position={[15, 0, 1]}
        gameName="Coin Flip"
        onClick={() => handleSelectGame('Coin Flip')}
      />
      <CrazyTimeWheel
        position={[15, -1, 15]}
        gameName="Crazy Time"
        onClick={() => handleSelectGame('Crazy Time')}
      />

      <CasinoTable position={[-13, -1, 17]} />
      <BlackjackTable position={[0, -1, 0]} onSelectGame={handleSelectGame} />

      {showParticles && <Particles position={[0, 2, 0]} />}

      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </>
  );
};

// Componente principale CasinoScene
const CasinoScene = ({ onSelectGame, triggerWinEffect }) => {
  const [croupierAnimation, setCroupierAnimation] = useState('Idle');

  return (
    <Canvas
      style={{ height: '600px', width: '100%' }}
      gl={{
        antialias: true,
        shadowMap: {
          enabled: true,
          type: THREE.PCFSoftShadowMap,
        },
      }}
      scene={{ background: new THREE.Color('#000000') }}
    >
      <SceneContent
        onSelectGame={onSelectGame}
        croupierAnimation={croupierAnimation}
        setCroupierAnimation={setCroupierAnimation}
        triggerWinEffect={triggerWinEffect}
      />
    </Canvas>
  );
};

// Componente principale
const RewardsDashboard = () => {
  const { publicKey, connected, signTransaction } = useWallet();
  const [taxWalletBalance, setTaxWalletBalance] = useState(0);
  const [rewardSol, setRewardSol] = useState(0);
  const [rewardWbtc, setRewardWbtc] = useState(0);
  const [rewardWeth, setRewardWeth] = useState(0);
  const [holders, setHolders] = useState([]);
  const [totalSupply, setTotalSupply] = useState(0);
  const [holderCount, setHolderCount] = useState(0);
  const [userTokens, setUserTokens] = useState(0);
  const [userRewards, setUserRewards] = useState({ sol: 0, wbtc: 0, weth: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHolders, setShowHolders] = useState(false);

  // Stato per Solana Card Duel
  const [playerCards, setPlayerCards] = useState([]);
  const [opponentCards, setOpponentCards] = useState([]);
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameMessage, setGameMessage] = useState('');

  // Stato per Meme Slots
  const [slotReels, setSlotReels] = useState(Array(9).fill(null));
  const [slotStatus, setSlotStatus] = useState('idle');
  const [slotMessage, setSlotMessage] = useState('');
  const [winningLines, setWinningLines] = useState([]);

  // Stato per Coin Flip
  const [flipChoice, setFlipChoice] = useState(null);
  const [flipResult, setFlipResult] = useState(null);
  const [flipStatus, setFlipStatus] = useState('idle');
  const [flipMessage, setFlipMessage] = useState('');

  // Stato per Crazy Time
  const [wheelResult, setWheelResult] = useState(null);
  const [wheelStatus, setWheelStatus] = useState('idle');
  const [wheelMessage, setWheelMessage] = useState('');
  const [bets, setBets] = useState({
    1: 0,
    2: 0,
    5: 0,
    10: 0,
    'Coin Flip': 0,
    'Pachinko': 0,
    'Cash Hunt': 0,
    'Crazy Time': 0,
  });
  const [topSlot, setTopSlot] = useState({ segment: null, multiplier: 1 });
  const [bonusResult, setBonusResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [lastResults, setLastResults] = useState([]);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const audioRef = useRef(null);
  const spinAudioRef = useRef(null); // Aggiunto
  const winAudioRef = useRef(null);  // Aggiunto
  const wheelRef = useRef(null);

  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const holdersPerPage = 50;

  // Stato per il bet
  const [betAmount, setBetAmount] = useState(0.01);
  const [betError, setBetError] = useState(null);

  // Stato per il gioco selezionato
  const [selectedGame, setSelectedGame] = useState(null);

  // Stato per le missioni e la classifica
  const [missions, setMissions] = useState([
    { id: 1, description: "Play 5 spins in Meme Slots", target: 5, current: 0, reward: 0.01, completed: false },
    { id: 2, description: "Win 1 game in Solana Card Duel", target: 1, current: 0, reward: 0.02, completed: false },
    { id: 3, description: "Spin the Crazy Time wheel 3 times", target: 3, current: 0, reward: 0.015, completed: false },
  ]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerStats, setPlayerStats] = useState({ spins: 0, wins: 0, totalWinnings: 0 });

  // Stato per gli effetti visivi
  const [triggerWinEffect, setTriggerWinEffect] = useState(false);


// Stato per Poker PvP (gestito dal backend)
const [pokerPlayers, setPokerPlayers] = useState([]);
const [pokerTableCards, setPokerTableCards] = useState([]);
const [pokerPlayerCards, setPokerPlayerCards] = useState({});
const [pokerStatus, setPokerStatus] = useState('waiting');
const [pokerMessage, setPokerMessage] = useState('Waiting for another player...');
const [currentTurn, setCurrentTurn] = useState(null);
const [pokerPot, setPokerPot] = useState(0);
const [currentBet, setCurrentBet] = useState(0);
const [playerBets, setPlayerBets] = useState({});
const [gamePhase, setGamePhase] = useState('pre-flop');
const [opponentCardsVisible, setOpponentCardsVisible] = useState(false);
const [waitingPlayersList, setWaitingPlayersList] = useState([]); // Lista dei giocatori in attesa
const [dealerMessage, setDealerMessage] = useState(''); // Messaggi del dealer
const [raiseAmount, setRaiseAmount] = useState(0.01); // Stato per l'importo del raise
const [timeLeft, setTimeLeft] = useState(30); // Stato per il tempo rimanente







// Configurazione Socket.IO per Poker PvP
useEffect(() => {
  socket.on('connect', () => console.log('Connected to backend'));
  socket.on('connect_error', (err) => console.error('Connection error:', err));
  socket.on('waiting', (data) => {
    setPokerMessage(data.message);
    setWaitingPlayersList(data.players || []);
  });
  socket.on('waitingPlayers', (data) => {
    setWaitingPlayersList(data.players || []);
  });
  socket.on('gameState', (game) => {
    console.log('Received game state:', game);
    setPokerPlayers(game.players || []);
    setPokerTableCards(game.tableCards || []);
    setPokerPlayerCards(game.playerCards || {});
    setPokerStatus(game.status || 'waiting');
    setPokerMessage(game.message || 'Waiting for another player...');
    setCurrentTurn(game.currentTurn || null);
    setPokerPot(game.pot || 0);
    setCurrentBet(game.currentBet || 0);
    setPlayerBets(game.playerBets || {});
    setGamePhase(game.gamePhase || 'pre-flop');
    setOpponentCardsVisible(game.opponentCardsVisible || false);
    setDealerMessage(game.dealerMessage || '');
    setTimeLeft(game.timeLeft || 30); // Aggiorna il tempo rimanente
    if (game.gameId) {
      localStorage.setItem('currentGameId', game.gameId);
    }
  });

  socket.on('distributeWinnings', async ({ winnerAddress, amount }) => {
    if (winnerAddress === publicKey?.toString()) {
      const winAmountInLamports = amount * LAMPORTS_PER_SOL;
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: publicKey,
          lamports: winAmountInLamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      transaction.partialSign(wallet);

      try {
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature);
        setTriggerWinEffect(true);
        playSound(winAudioRef);
        setPlayerStats(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalWinnings: prev.totalWinnings + amount,
        }));
      } catch (err) {
        console.error('Error distributing winnings:', err);
        setPokerMessage('Winnings not distributed. Contact support.');
      }
    }
  });

  return () => {
    socket.off('connect');
    socket.off('connect_error');
    socket.off('waiting');
    socket.off('waitingPlayers');
    socket.off('gameState');
    socket.off('distributeWinnings');
  };
}, [publicKey]);





// Recupera la classifica
useEffect(() => {
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
      console.log('Leaderboard updated:', data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  };

  // Carica la leaderboard all'avvio
  fetchLeaderboard();

  // Aggiorna la leaderboard ogni 30 secondi
  const interval = setInterval(fetchLeaderboard, 30000);

  return () => clearInterval(interval);
}, []);

// Aggiorna la leaderboard quando il giocatore vince
useEffect(() => {
  if (connected && publicKey) {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/leaderboard`);
        const data = await response.json();
        setLeaderboard(data);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      }
    };
    fetchLeaderboard();
  }
}, [playerStats, connected, publicKey]);

  // Funzioni utili
  const playSound = (audioRef) => {
    if (audioRef && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Audio playback failed:', err));
    } else {
      console.warn('Audio ref is not defined or not initialized:', audioRef);
    }
  };

  const validateBet = (amount) => {
    if (isNaN(amount) || amount <= 0) return 'Bet must be a positive number.';
    if (amount < 0.01) return 'Bet must be at least 0.01 SOL.';
    if (amount > 1) return 'Bet cannot exceed 1 SOL.';
    return null;
  };

  const handleBetChange = (e) => {
    const value = parseFloat(e.target.value);
    setBetAmount(value);
    setBetError(validateBet(value));
  };

  const toggleMusic = () => {
    if (isMusicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  const updateMissionProgress = (missionId, increment = 1) => {
    setMissions(prev => {
      const updatedMissions = prev.map(mission => {
        if (mission.id === missionId && !mission.completed) {
          const newCurrent = mission.current + increment;
          if (newCurrent >= mission.target) {
            const rewardInLamports = mission.reward * LAMPORTS_PER_SOL;
            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: publicKey,
                lamports: rewardInLamports,
              })
            );

            (async () => {
              try {
                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = wallet.publicKey;
                transaction.partialSign(wallet);
                const signature = await connection.sendRawTransaction(transaction.serialize());
                await connection.confirmTransaction(signature);

                const message = `Mission completed! You earned ${mission.reward} SOL!`;
                if (missionId === 1) setSlotMessage(prev => `${prev}\n${message}`);
                else if (missionId === 2) setGameMessage(prev => `${prev}\n${message}`);
                else if (missionId === 3) addChatMessage(message);
              } catch (err) {
                console.error('Mission reward distribution failed:', err);
                const errorMessage = 'Mission completed, but reward distribution failed. Contact support.';
                if (missionId === 1) setSlotMessage(prev => `${prev}\n${errorMessage}`);
                else if (missionId === 2) setGameMessage(prev => `${prev}\n${errorMessage}`);
                else if (missionId === 3) addChatMessage(errorMessage);
              }
            })();

            return { ...mission, current: newCurrent, completed: true };
          }
          return { ...mission, current: newCurrent };
        }
        return mission;
      });
      return updatedMissions;
    });
  };


  const joinPokerGame = async () => {
    if (!connected || !publicKey) {
      setPokerMessage('Connect your wallet to play!');
      return;
    }
  
    const betError = validateBet(betAmount);
    if (betError) {
      setPokerMessage(betError);
      return;
    }
  
    const betInLamports = betAmount * LAMPORTS_PER_SOL;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: wallet.publicKey,
        lamports: betInLamports,
      })
    );
  
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;
  
    try {
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);
  
      socket.emit('joinGame', {
        playerAddress: publicKey.toString(),
        betAmount,
      });
      setPokerMessage('You have joined the game! Waiting for another player...');
    } catch (err) {
      console.error('Bet error:', err);
      setPokerMessage('Bet failed. Please try again.');
    }
  };


  const makePokerMove = async (move, amount = 0) => {
    if (!connected || !publicKey || pokerStatus !== 'playing') {
      setPokerMessage('Game not in progress or wallet not connected!');
      return;
    }
  
    const gameId = localStorage.getItem('currentGameId');
    if (!gameId) {
      setPokerMessage('No active game found!');
      return;
    }
  
    if (currentTurn !== socket.id) {
      setPokerMessage("It's not your turn!");
      return;
    }
  
    if ((move === 'bet' || move === 'raise') && validateBet(amount)) {
      setPokerMessage(validateBet(amount));
      return;
    }
  
    if (move === 'bet' || move === 'raise') {
      const additionalBet = amount - (playerBets[publicKey.toString()] || 0);
      const betInLamports = additionalBet * LAMPORTS_PER_SOL;
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: wallet.publicKey,
          lamports: betInLamports,
        })
      );
  
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
  
      try {
        const signed = await signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature);
      } catch (err) {
        console.error('Bet error:', err);
        setPokerMessage('Bet failed. Please try again.');
        return;
      }
    }
  
    socket.emit('makeMove', { gameId, move, amount });
  };
  

   
  // Fetch dei dati di reward
  useEffect(() => {
    if (connection && wallet && MINT_ADDRESS) {
      fetchRewardsData();
    } else {
      setError('Incomplete configuration: check the .env file');
      setLoading(false);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      setLeaderboard(prev => {
        const updatedLeaderboard = [
          ...prev.filter(player => player.address !== publicKey.toString()),
          { address: publicKey.toString(), totalWinnings: playerStats.totalWinnings },
        ];
        return updatedLeaderboard.sort((a, b) => b.totalWinnings - a.totalWinnings).slice(0, 5);
      });
    }
  }, [playerStats, connected, publicKey]);

  const fetchRewardsData = async () => {
    try {
      setLoading(true);

      const balance = await connection.getBalance(wallet.publicKey);
      const usableBalance = balance * 0.5;
      setTaxWalletBalance(balance / 1e9);

      const solPerToken = Math.floor(usableBalance * 0.95);
      const solPerPortion = Math.floor(solPerToken / 3);
      setRewardSol(solPerPortion / 1e9);

      const wbtcATA = await getAssociatedTokenAddress(WBTC_MINT, wallet.publicKey);
      const wethATA = await getAssociatedTokenAddress(WETH_MINT, wallet.publicKey);

      const wbtcBalance = await connection.getTokenAccountBalance(wbtcATA).catch(() => ({ value: { amount: '0' } }));
      const wethBalance = await connection.getTokenAccountBalance(wethATA).catch(() => ({ value: { amount: '0' } }));

      setRewardWbtc(Number(wbtcBalance.value.amount) / 1e8);
      setRewardWeth(Number(wethBalance.value.amount) / 1e8);

      const holderList = await getHolders(MINT_ADDRESS);
      const mintInfo = await getMint(connection, MINT_ADDRESS);
      const supply = Number(mintInfo.supply) / 1e6;
      setTotalSupply(supply);

      const updatedHolders = holderList.map(holder => ({
        ...holder,
        solReward: (holder.amount / supply) * rewardSol,
        wbtcReward: (holder.amount / supply) * rewardWbtc,
        wethReward: (holder.amount / supply) * rewardWeth,
      }));
      setHolders(updatedHolders);
      setHolderCount(updatedHolders.length);

      if (connected && publicKey) {
        const userATA = await getAssociatedTokenAddress(MINT_ADDRESS, publicKey);
        const userBalance = await connection.getTokenAccountBalance(userATA).catch(() => ({ value: { uiAmount: 0 } }));
        const userAmount = userBalance.value.uiAmount || 0;
        setUserTokens(userAmount);
        setUserRewards({
          sol: (userAmount / supply) * rewardSol,
          wbtc: (userAmount / supply) * rewardWbtc,
          weth: (userAmount / supply) * rewardWeth,
        });
      }
    } catch (error) {
      console.error('DEBUG - Error in fetchRewardsData:', error);
      setError('Error fetching data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getHolders = async (mintAddress) => {
    const holders = [];
    const filters = [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mintAddress.toBase58() } },
    ];
    const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, { filters });

    const sortedAccounts = accounts
      .map(account => {
        const accountData = AccountLayout.decode(account.account.data);
        const amount = Number(accountData.amount) / 1e6;
        if (amount > 0) {
          return { address: accountData.owner.toString(), amount };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.amount - a.amount);

    const filteredHolders = sortedAccounts.slice(1);
    console.log('DEBUG - Tutti gli holders filtrati (esclusa pool):', filteredHolders);
    return filteredHolders;
  };

  const toggleHolders = () => {
    setShowHolders(!showHolders);
    setCurrentPage(1);
  };

  const drawCard = (isComputer = false) => {
    if (isComputer && Math.random() < COMPUTER_WIN_CHANCE.cardDuel) {
      const highValueCards = deck.filter(card => card.value === 10 || card.value === 1);
      const card = highValueCards[Math.floor(Math.random() * highValueCards.length)];
      if (!card || !card.value || !card.image) {
        console.error('DEBUG - Invalid high-value card drawn for computer:', card);
        return {
          value: 10,
          suit: 'spades',
          image: 'https://deckofcardsapi.com/static/img/0S.png',
        };
      }
      return card;
    }
    const card = deck[Math.floor(Math.random() * deck.length)];
    if (!card || !card.value || !card.image) {
      console.error('DEBUG - Invalid card drawn:', card);
      return {
        value: 2,
        suit: 'spades',
        image: 'https://deckofcardsapi.com/static/img/2S.png',
      };
    }
    return card;
  };

  const calculateScore = (cards) => {
    console.log('DEBUG - Cards for score calculation:', cards);
    let score = cards.reduce((sum, card) => sum + (card.value || 0), 0);
    console.log('DEBUG - Base score:', score);
    const aces = cards.filter(card => card.value === 1).length;
    console.log('DEBUG - Number of aces:', aces);
    for (let i = 0; i < aces && score + 10 <= 21; i++) {
      score += 10;
      console.log('DEBUG - Score after ace adjustment:', score);
    }
    console.log('DEBUG - Final score:', score);
    return score;
  };

  const startDuel = async () => {
    if (!connected || !publicKey) {
      setGameMessage('Please connect your wallet to play!');
      return;
    }

    const betError = validateBet(betAmount);
    if (betError) {
      setGameMessage(betError);
      return;
    }

    setGameStatus('betting');
    const playerInitial = [drawCard(), drawCard(), drawCard()];
    const opponentInitial = [drawCard(true), drawCard(true), drawCard(true)];

    const arePlayerCardsValid = playerInitial.every(card => card && card.value && card.image);
    const areOpponentCardsValid = opponentInitial.every(card => card && card.value && card.image);

    if (!arePlayerCardsValid || !areOpponentCardsValid) {
      console.error('DEBUG - Invalid cards assigned:', { playerInitial, opponentInitial });
      setGameMessage('Error: Invalid cards. Please try again.');
      setGameStatus('idle');
      return;
    }

    console.log('DEBUG - Player cards:', playerInitial);
    console.log('DEBUG - Opponent cards:', opponentInitial);
    setPlayerCards(playerInitial);
    setOpponentCards(opponentInitial);

    const betInLamports = betAmount * LAMPORTS_PER_SOL;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: wallet.publicKey,
        lamports: betInLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    try {
      console.log('DEBUG - Sending bet transaction...');
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      console.log('DEBUG - Bet transaction signature:', signature);
      await connection.confirmTransaction(signature);
      setGameStatus('playing');
      setGameMessage('Bet placed! Cards dealt.');
    } catch (err) {
      console.error('DEBUG - Bet failed:', err);
      setGameMessage('Bet failed. Try again.');
      setGameStatus('idle');
    }
  };

  const endDuel = async () => {
    const playerScore = calculateScore(playerCards);
    const opponentScore = calculateScore(opponentCards);
    console.log('DEBUG - Player score:', playerScore);
    console.log('DEBUG - Opponent score:', opponentScore);

    const winAmount = betAmount * 2;
    const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;

    if (playerScore > 21 && opponentScore > 21) {
      setGameStatus('finished');
      setGameMessage('Both busted! Try again.');
    } else if (playerScore > 21) {
      setGameStatus('finished');
      setGameMessage('You busted! The computer wins.');
    } else if (opponentScore > 21) {
      setGameStatus('finished');
      setGameMessage(`Computer busted! You won ${winAmount.toFixed(2)} SOL!`);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: publicKey,
          lamports: winAmountInLamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      transaction.partialSign(wallet);

      try {
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature);
        console.log('DEBUG - Prize distributed:', signature);
        setTriggerWinEffect(true);
        playSound(winAudioRef);
      } catch (err) {
        console.error('DEBUG - Prize distribution failed:', err);
        setGameMessage('You won, but prize distribution failed. Contact support.');
      }

      updateMissionProgress(2);
      setPlayerStats(prev => ({
        ...prev,
        wins: prev.wins + 1,
        totalWinnings: prev.totalWinnings + winAmount,
      }));
    } else {
      if (playerScore > opponentScore) {
        setGameStatus('finished');
        setGameMessage(`You won ${winAmount.toFixed(2)} SOL!`);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: publicKey,
            lamports: winAmountInLamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        transaction.partialSign(wallet);

        try {
          const signature = await connection.sendRawTransaction(transaction.serialize());
          await connection.confirmTransaction(signature);
          console.log('DEBUG - Prize distributed:', signature);
          setTriggerWinEffect(true);
          playSound(winAudioRef);
        } catch (err) {
          console.error('DEBUG - Prize distribution failed:', err);
          setGameMessage('You won, but prize distribution failed. Contact support.');
        }

        updateMissionProgress(2);
        setPlayerStats(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalWinnings: prev.totalWinnings + winAmount,
        }));
      } else if (playerScore === opponentScore) {
        setGameStatus('finished');
        setGameMessage("It's a tie! Try again.");
      } else {
        setGameStatus('finished');
        setGameMessage('The computer wins! Try again.');
      }
    }
  };

  const spinSlots = async () => {
    if (!connected || !publicKey) {
      setSlotMessage('Please connect your wallet to play!');
      return;
    }

    const betError = validateBet(betAmount);
    if (betError) {
      setSlotMessage(betError);
      return;
    }

    setSlotStatus('spinning');
    playSound(spinAudioRef);

    const betInLamports = betAmount * LAMPORTS_PER_SOL;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: wallet.publicKey,
        lamports: betInLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    try {
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      setTimeout(async () => {
        let result;
        if (Math.random() < COMPUTER_WIN_CHANCE.memeSlots) {
          result = Array(9).fill().map(() => slotMemes[Math.floor(Math.random() * slotMemes.length)]);
          let attempts = 0;
          while (attempts < 10) {
            let hasWin = false;
            const winLines = [
              [0, 1, 2],
              [3, 4, 5],
              [6, 7, 8],
            ];
            for (const line of winLines) {
              const symbolsInLine = line.map(index => result[index].name);
              if (symbolsInLine.every(symbol => symbol === symbolsInLine[0])) {
                hasWin = true;
                break;
              }
            }
            if (!hasWin) break;
            result = Array(9).fill().map(() => slotMemes[Math.floor(Math.random() * slotMemes.length)]);
            attempts++;
          }
        } else {
          result = Array(9).fill().map(() => slotMemes[Math.floor(Math.random() * slotMemes.length)]);
          const winningSymbol = slotMemes[Math.floor(Math.random() * slotMemes.length)];
          const winLines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
          ];
          const winningLine = winLines[Math.floor(Math.random() * winLines.length)];
          winningLine.forEach(index => {
            result[index] = winningSymbol;
          });
        }

        setSlotReels(result);

        const winLines = [
          [0, 1, 2],
          [3, 4, 5],
          [6, 7, 8],
        ];
        const winningLinesFound = [];
        let totalWin = 0;
        for (let i = 0; i < winLines.length; i++) {
          const line = winLines[i];
          const symbolsInLine = line.map(index => result[index].name);
          if (symbolsInLine.every(symbol => symbol === symbolsInLine[0])) {
            winningLinesFound.push(i);
            const winAmount = betAmount * 5;
            totalWin += winAmount;
          }
        }

        setWinningLines(winningLinesFound);

        if (winningLinesFound.length > 0) {
          setSlotStatus('won');
          const winAmountInLamports = totalWin * LAMPORTS_PER_SOL;
          setSlotMessage(`Jackpot! You won ${totalWin.toFixed(2)} SOL!`);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: publicKey,
              lamports: winAmountInLamports,
            })
          );

          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;
          transaction.partialSign(wallet);

          try {
            const signature = await connection.sendRawTransaction(transaction.serialize());
            await connection.confirmTransaction(signature);
            console.log('Prize distributed:', signature);
            setTriggerWinEffect(true);
            playSound(winAudioRef);
          } catch (err) {
            console.error('Prize distribution failed:', err);
            setSlotMessage('You won, but prize distribution failed. Contact support.');
          }

          setPlayerStats(prev => ({
            ...prev,
            totalWinnings: prev.totalWinnings + totalWin,
          }));
        } else {
          setSlotStatus('lost');
          setSlotMessage('No luck this time. Spin again!');
        }

        updateMissionProgress(1);
        setPlayerStats(prev => ({
          ...prev,
          spins: prev.spins + 1,
        }));
      }, 2000);
    } catch (err) {
      console.error('Spin failed:', err);
      setSlotMessage('Spin failed. Try again.');
      setSlotStatus('idle');
    }
  };

  const flipCoin = async (choice) => {
    if (!connected || !publicKey) {
      setFlipMessage('Please connect your wallet to play!');
      return;
    }

    const betError = validateBet(betAmount);
    if (betError) {
      setFlipMessage(betError);
      return;
    }

    setFlipStatus('flipping');
    setFlipChoice(choice);
    const betInLamports = betAmount * LAMPORTS_PER_SOL;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: wallet.publicKey,
        lamports: betInLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    try {
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      let result;
      if (Math.random() < COMPUTER_WIN_CHANCE.coinFlip) {
        result = choice === 'blue' ? 'red' : 'blue';
      } else {
        result = choice;
      }
      setFlipResult(result);

      if (choice === result) {
        setFlipStatus('won');
        const winAmount = betAmount * 2;
        const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;
        setFlipMessage(`You won ${winAmount.toFixed(2)} SOL!`);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: publicKey,
            lamports: winAmountInLamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        transaction.partialSign(wallet);

        try {
          const signature = await connection.sendRawTransaction(transaction.serialize());
          await connection.confirmTransaction(signature);
          console.log('Prize distributed:', signature);
          setTriggerWinEffect(true);
          playSound(winAudioRef);
        } catch (err) {
          console.error('Prize distribution failed:', err);
          setFlipMessage('You won, but prize distribution failed. Contact support.');
        }

        setPlayerStats(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalWinnings: prev.totalWinnings + winAmount,
        }));
      } else {
        setFlipStatus('lost');
        setFlipMessage('The computer wins! Try again.');
      }
    } catch (err) {
      console.error('Flip failed:', err);
      setFlipMessage('Flip failed. Try again.');
      setFlipStatus('idle');
    }
  };

  const presenterMessages = [
    "Welcome to Crazy Time! Place your bets!",
    "Come on, bet on Pachinko, it might be your lucky day!",
    "The wheel is about to spin! Are you ready?",
    "Great! You've triggered a bonus round!",
    "Don't give up, the next spin could be the one!",
  ];

  const addChatMessage = (message) => {
    setChatMessages(prev => [...prev, message].slice(-5));
  };

  const handleBetSelection = (segment) => {
    setBets(prevBets => {
      const currentBet = prevBets[segment] || 0;
      const newBet = currentBet > 0 ? 0 : betAmount;
      addChatMessage(
        newBet > 0
          ? `You placed a bet of ${newBet.toFixed(2)} SOL on ${segment}!`
          : `You removed your bet from ${segment}!`
      );
      return {
        ...prevBets,
        [segment]: newBet,
      };
    });
  };

  const spinWheel = async () => {
    if (!connected || !publicKey) {
      setWheelMessage('Please connect your wallet to play!');
      addChatMessage('Please connect your wallet to play!');
      return;
    }

    const totalBet = Object.values(bets).reduce((sum, bet) => sum + bet, 0);
    if (totalBet === 0) {
      setWheelMessage('Please place a bet on at least one segment!');
      addChatMessage('Please place a bet on at least one segment!');
      return;
    }

    const betError = validateBet(totalBet);
    if (betError) {
      setWheelMessage(betError);
      addChatMessage(betError);
      return;
    }

    setWheelStatus('spinning');
    addChatMessage('The wheel is spinning... Are you ready?');
    playSound(spinAudioRef);

    const betInLamports = totalBet * LAMPORTS_PER_SOL;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: wallet.publicKey,
        lamports: betInLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    try {
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      const topSlotSegment = crazyTimeWheel[Math.floor(Math.random() * crazyTimeWheel.length)].value;
      const topSlotMultiplier = [1, 2, 3, 5][Math.floor(Math.random() * 4)];
      setTopSlot({ segment: topSlotSegment, multiplier: topSlotMultiplier });
      addChatMessage(`Top Slot: ${topSlotSegment} with multiplier ${topSlotMultiplier}x!`);

      const spins = 5;
      const segmentAngle = 360 / crazyTimeWheel.length;

      const betSegments = Object.keys(bets).filter(segment => bets[segment] > 0);
      const betIndices = crazyTimeWheel
        .map((segment, index) => (betSegments.includes(String(segment.value)) ? index : -1))
        .filter(index => index !== -1);

      let resultIndex;
      if (Math.random() < COMPUTER_WIN_CHANCE.crazyTime) {
        const nonBetIndices = crazyTimeWheel
          .map((segment, index) => (betIndices.includes(index) ? -1 : index))
          .filter(index => index !== -1);
        if (nonBetIndices.length > 0) {
          resultIndex = nonBetIndices[Math.floor(Math.random() * nonBetIndices.length)];
        } else {
          resultIndex = Math.floor(Math.random() * crazyTimeWheel.length);
        }
      } else {
        if (betIndices.length > 0) {
          resultIndex = betIndices[Math.floor(Math.random() * betIndices.length)];
        } else {
          resultIndex = Math.floor(Math.random() * crazyTimeWheel.length);
        }
      }

      const targetAngle = resultIndex * segmentAngle;
      const finalAngle = (spins * 360) + targetAngle + (Math.random() * segmentAngle);
      setRotationAngle(finalAngle);
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const normalizedAngle = finalAngle % 360;
      const adjustedAngle = (normalizedAngle - 90 + 360) % 360;
      const winningIndex = (crazyTimeWheel.length - Math.floor(adjustedAngle / segmentAngle) - 1) % crazyTimeWheel.length;
      const result = crazyTimeWheel[winningIndex];

      console.log('Segment Angle:', segmentAngle);
      console.log('Final Angle:', finalAngle);
      console.log('Normalized Angle:', normalizedAngle);
      console.log('Adjusted Angle:', adjustedAngle);
      console.log('Winning Index:', winningIndex);
      console.log('Result:', result.value);
      console.log('Result Color:', result.color, result.colorName);
      console.log('Crazy Time Wheel:', crazyTimeWheel);

      setWheelResult(result);
      setLastResults((prev) => [...prev, result.value].slice(-10));
      addChatMessage(`The wheel stopped on ${result.value}!`);

      if (result.type === 'number') {
        const betOnResult = bets[result.value] || 0;
        if (betOnResult > 0) {
          let multiplier = parseInt(result.value);
          if (topSlot.segment === result.value) {
            multiplier *= topSlot.multiplier;
          }
          const winAmount = betOnResult * multiplier;
          const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;
          setWheelMessage(`You won ${winAmount.toFixed(2)} SOL!`);
          addChatMessage(`Great! You won ${winAmount.toFixed(2)} SOL!`);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: publicKey,
              lamports: winAmountInLamports,
            })
          );

          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;
          transaction.partialSign(wallet);

          try {
            const signature = await connection.sendRawTransaction(transaction.serialize());
            await connection.confirmTransaction(signature);
            console.log('Prize distributed:', signature);
            setTriggerWinEffect(true);
            playSound(winAudioRef);
          } catch (err) {
            console.error('Prize distribution failed:', err);
            setWheelMessage('You won, but prize distribution failed. Contact support.');
            addChatMessage('You won, but prize distribution failed. Contact support.');
          }

          setPlayerStats(prev => ({
            ...prev,
            totalWinnings: prev.totalWinnings + winAmount,
          }));
        } else {
          setWheelMessage('No win this time. Try again!');
          addChatMessage('No win this time. Try again!');
        }
        setWheelStatus('finished');
      } else {
        setWheelStatus('bonus');
        addChatMessage(`You triggered the ${result.value} bonus round!`);

        if (result.value === 'Coin Flip') {
          const redMultiplier = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
          const blueMultiplier = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
          const side = Math.random() < 0.5 ? 'red' : 'blue';
          let multiplier = side === 'red' ? redMultiplier : blueMultiplier;
          if (topSlot.segment === 'Coin Flip') {
            multiplier *= topSlot.multiplier;
          }
          setBonusResult({ type: 'Coin Flip', side, redMultiplier, blueMultiplier, multiplier });

          const betOnBonus = bets['Coin Flip'] || 0;
          if (betOnBonus > 0) {
            const winAmount = betOnBonus * multiplier;
            const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;
            setWheelMessage(`Coin Flip: ${side} wins! You won ${winAmount.toFixed(2)} SOL!`);
            addChatMessage(`Coin Flip: ${side} wins! You won ${winAmount.toFixed(2)} SOL!`);

            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: publicKey,
                lamports: winAmountInLamports,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;
            transaction.partialSign(wallet);

            try {
              const signature = await connection.sendRawTransaction(transaction.serialize());
              await connection.confirmTransaction(signature);
              console.log('Prize distributed:', signature);
              setTriggerWinEffect(true);
              playSound(winAudioRef);
            } catch (err) {
              console.error('Prize distribution failed:', err);
              setWheelMessage('You won, but prize distribution failed. Contact support.');
              addChatMessage('You won, but prize distribution failed. Contact support.');
            }

            setPlayerStats(prev => ({
              ...prev,
              totalWinnings: prev.totalWinnings + winAmount,
            }));
          } else {
            setWheelMessage('You accessed Coin Flip, but did not bet on it.');
            addChatMessage('You accessed Coin Flip, but did not bet on it.');
          }
        } else if (result.value === 'Pachinko') {
          const multipliers = [2, 3, 5, 10, 20];
          const slotIndex = Math.floor(Math.random() * multipliers.length);
          let multiplier = multipliers[slotIndex];
          if (topSlot.segment === 'Pachinko') {
            multiplier *= topSlot.multiplier;
          }
          setBonusResult({ type: 'Pachinko', slotIndex, multiplier });

          const betOnBonus = bets['Pachinko'] || 0;
          if (betOnBonus > 0) {
            const winAmount = betOnBonus * multiplier;
            const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;
            setWheelMessage(`Pachinko: You won ${winAmount.toFixed(2)} SOL!`);
            addChatMessage(`Pachinko: You won ${winAmount.toFixed(2)} SOL!`);

            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: publicKey,
                lamports: winAmountInLamports,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;
            transaction.partialSign(wallet);

            try {
              const signature = await connection.sendRawTransaction(transaction.serialize());
              await connection.confirmTransaction(signature);
              console.log('Prize distributed:', signature);
              setTriggerWinEffect(true);
              playSound(winAudioRef);
            } catch (err) {
              console.error('Prize distribution failed:', err);
              setWheelMessage('You won, but prize distribution failed. Contact support.');
              addChatMessage('You won, but prize distribution failed. Contact support.');
            }

            setPlayerStats(prev => ({
              ...prev,
              totalWinnings: prev.totalWinnings + winAmount,
            }));
          } else {
            setWheelMessage('You accessed Pachinko, but did not bet on it.');
            addChatMessage('You accessed Pachinko, but did not bet on it.');
          }
        } else if (result.value === 'Cash Hunt') {
          const multipliers = Array(10).fill().map(() => Math.floor(Math.random() * 50) + 1);
          const chosenMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
          let multiplier = chosenMultiplier;
          if (topSlot.segment === 'Cash Hunt') {
            multiplier *= topSlot.multiplier;
          }
          setBonusResult({ type: 'Cash Hunt', multipliers, chosenMultiplier, multiplier });

          const betOnBonus = bets['Cash Hunt'] || 0;
          if (betOnBonus > 0) {
            const winAmount = betOnBonus * multiplier;
            const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;
            setWheelMessage(`Cash Hunt: You won ${winAmount.toFixed(2)} SOL!`);
            addChatMessage(`Cash Hunt: You won ${winAmount.toFixed(2)} SOL!`);

            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: publicKey,
                lamports: winAmountInLamports,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;
            transaction.partialSign(wallet);

            try {
              const signature = await connection.sendRawTransaction(transaction.serialize());
              await connection.confirmTransaction(signature);
              console.log('Prize distributed:', signature);
              setTriggerWinEffect(true);
              playSound(winAudioRef);
            } catch (err) {
              console.error('Prize distribution failed:', err);
              setWheelMessage('You won, but prize distribution failed. Contact support.');
              addChatMessage('You won, but prize distribution failed. Contact support.');
            }

            setPlayerStats(prev => ({
              ...prev,
              totalWinnings: prev.totalWinnings + winAmount,
            }));
          } else {
            setWheelMessage('You accessed Cash Hunt, but did not bet on it.');
            addChatMessage('You accessed Cash Hunt, but did not bet on it.');
          }
        } else if (result.value === 'Crazy Time') {
          const multipliers = [10, 20, 50, 100, 200];
          const chosenMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
          let multiplier = chosenMultiplier;
          if (topSlot.segment === 'Crazy Time') {
            multiplier *= topSlot.multiplier;
          }
          setBonusResult({ type: 'Crazy Time', multiplier });

          const betOnBonus = bets['Crazy Time'] || 0;
          if (betOnBonus > 0) {
            const winAmount = betOnBonus * multiplier;
            const winAmountInLamports = winAmount * LAMPORTS_PER_SOL;
            setWheelMessage(`Crazy Time: You won ${winAmount.toFixed(2)} SOL!`);
            addChatMessage(`Crazy Time: You won ${winAmount.toFixed(2)} SOL!`);

            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: publicKey,
                lamports: winAmountInLamports,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;
            transaction.partialSign(wallet);

            try {
              const signature = await connection.sendRawTransaction(transaction.serialize());
              await connection.confirmTransaction(signature);
              console.log('Prize distributed:', signature);
              setTriggerWinEffect(true);
              playSound(winAudioRef);
            } catch (err) {
              console.error('Prize distribution failed:', err);
              setWheelMessage('You won, but prize distribution failed. Contact support.');
              addChatMessage('You won, but prize distribution failed. Contact support.');
            }

            setPlayerStats(prev => ({
              ...prev,
              totalWinnings: prev.totalWinnings + winAmount,
            }));
          } else {
            setWheelMessage('You accessed Crazy Time, but did not bet on it.');
            addChatMessage('You accessed Crazy Time, but did not bet on it.');
          }
        }
      }

      updateMissionProgress(3);
      setPlayerStats(prev => ({
        ...prev,
        spins: prev.spins + 1,
      }));
    } catch (err) {
      console.error('Spin failed:', err);
      setWheelMessage('Spin failed. Try again.');
      addChatMessage('Spin failed. Try again!');
      setWheelStatus('idle');
    }
  };

  const indexOfLastHolder = currentPage * holdersPerPage;
  const indexOfFirstHolder = indexOfLastHolder - holdersPerPage;
  const currentHolders = holders.slice(indexOfFirstHolder, indexOfLastHolder);

  const totalPages = Math.ceil(holders.length / holdersPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="w-full max-w-6xl bg-gray-900 bg-opacity-80 rounded-xl p-8 shadow-lg animate-neon-glow">
      <audio ref={audioRef} src={backgroundMusic} loop />
      <audio ref={spinAudioRef} src={spinSound} />
      <audio ref={winAudioRef} src={winSound} />

      {loading ? (
        <p className="text-center text-orange-700 animate-pulse text-2xl">Initializing...</p>
      ) : error ? (
        <p className="text-center text-red-500 text-2xl">{error}</p>
      ) : (
        <>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-5xl font-bold text-orange-700 tracking-wide header-box">{TOKEN_NAME}</h2>
            <WalletMultiButton className="casino-button" />
          </div>

          {connected && publicKey && (
            <div className="game-box p-6 mb-8">
              <p className="text-lg text-orange-700">
                Your Wallet: <span className="text-orange-700">{publicKey.toString()}</span>
              </p>
              <p className="text-lg text-orange-700">
                Your {TOKEN_SYMBOL} Balance: <span className="text-orange-700">{userTokens.toFixed(6)}</span>
              </p>
              <p className="text-lg text-orange-700">SOL Reward: {userRewards.sol.toFixed(6)}</p>
              <p className="text-lg text-orange-700">WBTC Reward: {userRewards.wbtc.toFixed(8)}</p>
              <p className="text-lg text-orange-700">WETH Reward: {userRewards.weth.toFixed(8)}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="game-box p-6">
              <p className="text-lg text-orange-700">Tax Wallet Balance</p>
              <p className="text-2xl font-bold text-orange-700">{taxWalletBalance.toFixed(4)} SOL</p>
            </div>
            <div className="game-box p-6">
              <p className="text-lg text-orange-700">SOL Rewards</p>
              <p className="text-2xl font-bold text-orange-700">{rewardSol.toFixed(4)} SOL</p>
            </div>
            <div className="game-box p-6">
              <p className="text-lg text-orange-700">WBTC Rewards</p>
              <p className="text-2xl font-bold text-orange-700">{rewardWbtc.toFixed(8)} WBTC</p>
            </div>
            <div className="game-box p-6">
              <p className="text-lg text-orange-700">WETH Rewards</p>
              <p className="text-2xl font-bold text-orange-700">{rewardWeth.toFixed(8)} WETH</p>
            </div>
          </div>

          <button onClick={fetchRewardsData} className="w-full casino-button">
            Sync Data
          </button>

          <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
            {TOKEN_SYMBOL} Holder Network
          </h2>
          <div className="game-box p-6 mb-6">
            <p className="text-lg text-orange-700">
              Total Supply: <span className="text-orange-700">{totalSupply.toFixed(6)} {TOKEN_SYMBOL}</span>
            </p>
            <p className="text-lg text-orange-700">
              Number of Holders (excluding pool): <span className="text-orange-700">{holderCount}</span>
            </p>
          </div>
          <button onClick={toggleHolders} className="w-full casino-button mb-6">
            {showHolders ? 'Hide Holders' : 'Show Holders'}
          </button>
          {showHolders && holders.length > 0 ? (
            <div className="game-box p-6 mb-10">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-700 text-cyan-400">
                      <th className="p-4 text-lg">Holder Address</th>
                      <th className="p-4 text-lg">Amount ({TOKEN_SYMBOL})</th>
                      <th className="p-4 text-lg">SOL Reward</th>
                      <th className="p-4 text-lg">WBTC Reward</th>
                      <th className="p-4 text-lg">WETH Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentHolders.map((holder, index) => (
                      <tr key={index} className="border-t border-gray-600 hover:bg-gray-600 transition-all">
                        <td className="p-4 text-gray-200 font-mono">{holder.address}</td>
                        <td className="p-4 text-gray-200">{holder.amount.toFixed(6)}</td>
                        <td className="p-4 text-green-400">{holder.solReward.toFixed(6)}</td>
                        <td className="p-4 text-yellow-400">{holder.wbtcReward.toFixed(8)}</td>
                        <td className="p-4 text-purple-400">{holder.wethReward.toFixed(8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <button onClick={prevPage} disabled={currentPage === 1} className="casino-button">
                  Previous
                </button>
                <p className="text-orange-700">Page {currentPage} of {totalPages}</p>
                <button onClick={nextPage} disabled={currentPage === totalPages} className="casino-button">
                  Next
                </button>
              </div>
            </div>
          ) : showHolders ? (
            <p className="text-center text-orange-700 mb-10 text-lg">
              No holders detected in the network (excluding pool).
            </p>
          ) : null}

          <div className="mb-10">
            <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
              Missions & Leaderboard
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="game-box p-6">
                <h3 className="text-2xl font-bold text-orange-700 mb-4">Daily Missions</h3>
                {missions.map(mission => (
                  <div key={mission.id} className="mb-4">
                    <p className="text-lg text-orange-700">{mission.description}</p>
                    <p className="text-orange-700">Progress: {mission.current}/{mission.target}</p>
                    <p className="text-orange-700">Reward: {mission.reward} SOL</p>
                    {mission.completed && <p className="text-green-400">Completed!</p>}
                  </div>
                ))}
              </div>
              <div className="game-box p-6">
                <h3 className="text-2xl font-bold text-orange-700 mb-4">Leaderboard (Top 5)</h3>
                {leaderboard.length > 0 ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-700 text-cyan-400">
                        <th className="p-4 text-lg">Rank</th>
                        <th className="p-4 text-lg">Address</th>
                        <th className="p-4 text-lg">Total Winnings (SOL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((player, index) => (
                        <tr key={index} className="border-t border-gray-600 hover:bg-gray-600 transition-all">
                          <td className="p-4 text-gray-200">{index + 1}</td>
                          <td className="p-4 text-gray-200 font-mono">{player.address.slice(0, 8)}...</td>
                          <td className="p-4 text-green-400">{player.totalWinnings.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-orange-700">Play some games to appear on the leaderboard!</p>
                )}
              </div>
            </div>
          </div>

          {!selectedGame ? (
            <>
              <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
                Casino Floor
              </h2>
              <CasinoScene
                onSelectGame={setSelectedGame}
                triggerWinEffect={triggerWinEffect}
              />
            </>
          ) : (
            <>
              {selectedGame === 'Solana Card Duel' && (
                <div>
                  <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
                    Solana Card Duel
                  </h2>
                  <div className="mb-6 text-center">
                    <label className="text-lg text-orange-700 mr-2">Bet Amount (SOL):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={betAmount}
                      onChange={handleBetChange}
                      className="bet-input"
                      placeholder="Enter bet (0.01 - 1 SOL)"
                    />
                    {betError && <p className="bet-error">{betError}</p>}
                  </div>
                  <div className="game-box p-6 mb-10">
                    <div className="mb-6">
                      <p className="text-lg text-orange-700 mb-2 text-center">Your Cards:</p>
                      <div className="flex gap-4 justify-center">
                        {playerCards.map((card, index) => (
                          <div
                            key={index}
                            className="card"
                            style={{
                              backgroundImage: card.image ? `url(${card.image})` : 'none',
                              backgroundColor: card.image ? 'transparent' : 'red',
                              backgroundSize: 'cover',
                              width: '100px',
                              height: '140px',
                            }}
                          />
                        ))}
                      </div>
                      {gameStatus !== 'idle' && (
                        <p className="text-lg text-orange-700 mt-2 text-center">
                          Score: {calculateScore(playerCards)}
                        </p>
                      )}
                    </div>
                    <div className="mb-6">
                      <p className="text-lg text-orange-700 mb-2 text-center">Computer Cards:</p>
                      <div className="flex gap-4 justify-center">
                        {opponentCards.map((card, index) => {
                          const isVisible = gameStatus === 'finished' || index < 2;
                          console.log(
                            `DEBUG - Rendering computer card ${index}: gameStatus=${gameStatus}, isVisible=${isVisible}`
                          );
                          return (
                            <div
                              key={index}
                              className="card"
                              style={{
                                backgroundImage: isVisible ? `url(${card.image})` : 'none',
                                backgroundColor: isVisible ? 'transparent' : 'gray',
                                backgroundSize: 'cover',
                                width: '100px',
                                height: '140px',
                              }}
                            />
                          );
                        })}
                      </div>
                      {gameStatus === 'finished' && (
                        <p className="text-lg text-orange-700 mt-2 text-center">
                          Score: {calculateScore(opponentCards)}
                        </p>
                      )}
                    </div>
                    <p className="text-center text-orange-700 mb-4 text-lg">{gameMessage}</p>
                    {gameStatus === 'idle' ? (
                      <button
                        onClick={startDuel}
                        className="w-full casino-button"
                        disabled={!!betError}
                      >
                        Start Duel (Bet {betAmount.toFixed(2)} SOL)
                      </button>
                    ) : gameStatus === 'playing' ? (
                      <button onClick={endDuel} className="w-full casino-button">
                        Reveal Winner
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setGameStatus('idle');
                          setPlayerCards([]);
                          setOpponentCards([]);
                          setGameMessage('');
                        }}
                        className="w-full casino-button"
                        disabled={!!betError}
                      >
                        Play Again (Bet {betAmount.toFixed(2)} SOL)
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedGame(null)}
                      className="w-full casino-button mt-4"
                    >
                      Back to Casino Floor
                    </button>
                  </div>
                </div>
              )}
              {selectedGame === 'Meme Slots' && (
                <div>
                  <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
                    Meme Slots
                  </h2>
                  <div className="mb-6 text-center">
                    <label className="text-lg text-orange-700 mr-2">Bet Amount (SOL):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={betAmount}
                      onChange={handleBetChange}
                      className="bet-input"
                      placeholder="Enter bet (0.01 - 1 SOL)"
                    />
                    {betError && <p className="bet-error">{betError}</p>}
                  </div>
                  <div className="game-box p-6 mb-10">
                    <div className={`slot-machine ${slotStatus === 'won' ? 'winning' : ''}`}>
                      <div className="grid grid-cols-3 gap-1">
                        {slotReels.map((meme, index) => (
                          <div
                            key={index}
                            className={`slot-reel ${slotStatus === 'spinning' ? 'spinning' : ''}`}
                            style={{ backgroundImage: meme ? `url(${meme.image})` : 'none' }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-center text-orange-700 mb-4 text-lg">{slotMessage}</p>
                    <button
                      onClick={spinSlots}
                      className="w-full casino-button"
                      disabled={slotStatus === 'spinning' || !!betError}
                    >
                      {slotStatus === 'spinning'
                        ? 'Spinning...'
                        : `Spin (Bet ${betAmount.toFixed(2)} SOL)`}
                    </button>
                    <button
                      onClick={() => setSelectedGame(null)}
                      className="w-full casino-button mt-4"
                    >
                      Back to Casino Floor
                    </button>
                  </div>
                </div>
              )}
              {selectedGame === 'Coin Flip' && (
                <div>
                  <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
                    Coin Flip
                  </h2>
                  <div className="mb-6 text-center">
                    <label className="text-lg text-orange-700 mr-2">Bet Amount (SOL):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={betAmount}
                      onChange={handleBetChange}
                      className="bet-input"
                      placeholder="Enter bet (0.01 - 1 SOL)"
                    />
                    {betError && <p className="bet-error">{betError}</p>}
                  </div>
                  <div className="game-box p-6">
                    <div className="mb-6 text-center">
                      <p className="text-lg text-orange-700 mb-2">
                        Your Choice: {flipChoice || 'None'}
                      </p>
                      <div className={`coin ${flipStatus === 'flipping' ? 'flipping' : ''} ${flipResult}`}></div>
                      {flipResult && <p className="text-lg text-orange-700 mt-2">Result: {flipResult}</p>}
                    </div>
                    <p className="text-center text-orange-700 mb-4 text-lg">{flipMessage}</p>
                    {flipStatus === 'idle' ? (
                      <div className="flex gap-4">
                        <button
                          onClick={() => flipCoin('blue')}
                          className="flex-1 casino-button"
                          disabled={!!betError}
                        >
                          Blue (Bet {betAmount.toFixed(2)} SOL)
                        </button>
                        <button
                          onClick={() => flipCoin('red')}
                          className="flex-1 casino-button"
                          disabled={!!betError}
                        >
                          Red (Bet {betAmount.toFixed(2)} SOL)
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFlipStatus('idle')}
                        className="w-full casino-button"
                        disabled={flipStatus === 'flipping' || !!betError}
                      >
                        {flipStatus === 'flipping' ? 'Flipping...' : 'Play Again'}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedGame(null)}
                      className="w-full casino-button mt-4"
                    >
                      Back to Casino Floor
                    </button>
                  </div>
                </div>
              )}
              



              {selectedGame === 'Poker PvP' && (
  <div>
    <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
      Poker PvP
    </h2>
    <div className="mb-6 text-center">
      <label className="text-lg text-orange-700 mr-2">Bet Amount (SOL):</label>
      <input
        type="number"
        step="0.01"
        value={betAmount}
        onChange={handleBetChange}
        className="bet-input"
        placeholder="Enter bet (0.01 - 1 SOL)"
      />
      {betError && <p className="bet-error">{betError}</p>}
    </div>
    <div className="game-box p-6 mb-10">
      {waitingPlayersList.length > 0 && pokerStatus === 'waiting' && (
        <div className="mb-6">
          <p className="text-lg text-orange-700 mb-2 text-center">Players Waiting:</p>
          <ul className="text-center">
            {waitingPlayersList.map((player, index) => (
              <li key={index} className="text-orange-700">
                {player.address.slice(0, 8)}... (Bet: {player.bet.toFixed(2)} SOL)
              </li>
            ))}
          </ul>
        </div>
      )}
      {pokerPlayers.length > 0 && (
        <div className="mb-6">
          <p className="text-lg text-orange-700 mb-2 text-center">Players at Table:</p>
          <ul className="text-center">
            {pokerPlayers.map((player, index) => (
              <li key={index} className="text-orange-700">
                {player.address.slice(0, 8)}... (Bet: {player.bet.toFixed(2)} SOL)
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-lg text-orange-700 mb-2 text-center">Pot: {pokerPot.toFixed(2)} SOL</p>
      <p className="text-lg text-orange-700 mb-2 text-center">Current Bet: {currentBet.toFixed(2)} SOL</p>
      <p className="text-lg text-orange-700 mb-2 text-center">Community Cards:</p>
      <div className="flex gap-4 justify-center">
        {pokerTableCards.map((card, index) => (
          <div
            key={index}
            className="card"
            style={{
              backgroundImage: `url(${card.image})`,
              backgroundSize: 'cover',
              width: '100px',
              height: '140px',
            }}
          />
        ))}
      </div>
      <p className="text-lg text-orange-700 mb-2 text-center">Your Cards:</p>
      <div className="flex gap-4 justify-center">
        {pokerPlayerCards[publicKey?.toString()]?.map((card, index) => (
          <div
            key={index}
            className="card"
            style={{
              backgroundImage: `url(${card.image})`,
              backgroundSize: 'cover',
              width: '100px',
              height: '140px',
            }}
          />
        ))}
      </div>
      <p className="text-lg text-orange-700 mb-2 text-center">Opponent's Cards:</p>
      <div className="flex gap-4 justify-center">
        {pokerPlayerCards[pokerPlayers.find(p => p.address !== publicKey?.toString())?.address]?.map((card, index) => (
          <div
            key={index}
            className="card"
            style={{
              backgroundImage: opponentCardsVisible ? `url(${card.image})` : `url(${CARD_BACK_IMAGE})`,
              backgroundSize: 'cover',
              width: '100px',
              height: '140px',
            }}
          />
        ))}
      </div>
      <p className="text-center text-orange-700 mb-4 text-lg">{pokerMessage}</p>
      {dealerMessage && (
        <p className="text-center text-orange-700 mb-4 text-lg font-bold">{dealerMessage}</p>
      )}
      {pokerStatus === 'playing' && currentTurn === socket.id && (
        <p className="text-center text-orange-700 mb-4 text-lg font-bold">
          Time Left: {timeLeft} seconds
        </p>
      )}
      {pokerStatus === 'waiting' ? (
        <button onClick={joinPokerGame} className="w-full casino-button" disabled={!!betError}>
          Join Game (Bet {betAmount.toFixed(2)} SOL)
        </button>
      ) : pokerStatus === 'playing' && currentTurn === socket.id ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <button onClick={() => makePokerMove('call')} className="flex-1 casino-button">
              Call ({(currentBet - (playerBets[publicKey?.toString()] || 0)).toFixed(2)} SOL)
            </button>
            <button onClick={() => makePokerMove('fold')} className="flex-1 casino-button">
              Fold
            </button>
            <button onClick={() => makePokerMove('check')} className="flex-1 casino-button">
              Check
            </button>
          </div>
          <div className="flex gap-4">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="1"
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(parseFloat(e.target.value))}
              className="bet-input flex-1"
              placeholder="Bet/Raise Amount"
            />
            <button onClick={() => makePokerMove('bet', raiseAmount)} className="flex-1 casino-button">
              Bet
            </button>
            <button onClick={() => makePokerMove('raise', raiseAmount)} className="flex-1 casino-button">
              Raise
            </button>
          </div>
        </div>
      ) : pokerStatus === 'finished' ? (
        <button
          onClick={() => {
            setPokerStatus('waiting');
            setPokerPlayers([]);
            setPokerTableCards([]);
            setPokerPlayerCards({});
            setPokerMessage('Waiting for another player...');
            setPokerPot(0);
            setCurrentBet(0);
            setPlayerBets({});
            setGamePhase('pre-flop');
            setOpponentCardsVisible(false);
            setDealerMessage('');
            setTimeLeft(30);
            localStorage.removeItem('currentGameId');
          }}
          className="w-full casino-button"
          disabled={!!betError}
        >
          Play Again (Bet {betAmount.toFixed(2)} SOL)
        </button>
      ) : (
        <p className="text-center text-orange-700">Opponent's turn... (Time Left: {timeLeft} seconds)</p>
      )}
      <button
        onClick={() => setSelectedGame(null)}
        className="w-full casino-button mt-4"
      >
        Back to Casino Floor
      </button>
    </div>
  </div>
)}




              {selectedGame === 'Crazy Time' && (
                <div>
                  <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
                    Crazy Time
                  </h2>
                  <div className="mb-6 text-center">
                    <label className="text-lg text-orange-700 mr-2">Bet Amount (SOL):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={betAmount}
                      onChange={handleBetChange}
                      className="bet-input"
                      placeholder="Enter bet (0.01 - 1 SOL)"
                    />
                    {betError && <p className="bet-error">{betError}</p>}
                  </div>
                  <div className="game-box p-6 mb-10">
                    <div className="mb-6 text-center">
                      <button onClick={toggleMusic} className="casino-button">
                        {isMusicPlaying ? 'Mute Music' : 'Play Music'}
                      </button>
                    </div>

                    <div className="mb-6 text-center">
                      <div className="presenter">
                        <img
                          src="/assets/images/presenter.png"
                          alt="Presenter"
                          className="presenter-image"
                        />
                      </div>
                    </div>

                    <div className="mb-6 text-center">
                      <p className="text-lg text-orange-700 mb-2">Top Slot:</p>
                      <div className="flex justify-center gap-4">
                        <div className="bg-gray-700 text-cyan-400 p-2 rounded">
                          Segment: {topSlot.segment || 'N/A'}
                        </div>
                        <div className="bg-gray-700 text-cyan-400 p-2 rounded">
                          Multiplier: {topSlot.multiplier}x
                        </div>
                      </div>
                    </div>

                    <div className="mb-6 text-center">
                      <p className="text-lg text-orange-700 mb-2">Wheel Result:</p>
                      <div className="wheel-wrapper">
                        <div className="wheel-container">
                          <svg
                            ref={wheelRef}
                            className="wheel"
                            style={{
                              transform: `rotate(${rotationAngle}deg)`,
                              transition: wheelStatus === 'spinning' ? 'transform 5s ease-out' : 'none',
                            }}
                            width="500"
                            height="500"
                            viewBox="0 0 500 500"
                          >
                            <g transform="translate(250, 250)">
                              <circle cx="0" cy="0" r="100" fill="#ff3333" stroke="#d4af37" strokeWidth="5" />
                              <text
                                x="0"
                                y="-10"
                                textAnchor="middle"
                                fill="#fff"
                                fontSize="40"
                                fontWeight="bold"
                                fontFamily="'Arial', sans-serif"
                              >
                                CRAZY
                              </text>
                              <text
                                x="0"
                                y="20"
                                textAnchor="middle"
                                fill="#fff"
                                fontSize="40"
                                fontWeight="bold"
                                fontFamily="'Arial', sans-serif"
                              >
                                TIME
                              </text>

                              {crazyTimeWheel.map((segment, index) => {
                                const angle = (index * 360) / crazyTimeWheel.length;
                                const rad = (angle * Math.PI) / 180;
                                const nextAngle = ((index + 1) * 360) / crazyTimeWheel.length;
                                const nextRad = (nextAngle * Math.PI) / 180;
                                const r = 225;
                                const innerR = 100;
                                const x1 = innerR * Math.cos(rad);
                                const y1 = innerR * Math.sin(rad);
                                const x2 = r * Math.cos(rad);
                                const y2 = r * Math.sin(rad);
                                const x3 = r * Math.cos(nextRad);
                                const y3 = r * Math.sin(nextRad);
                                const x4 = innerR * Math.cos(nextRad);
                                const y4 = innerR * Math.sin(nextRad);
                                const textAngle = angle + (360 / crazyTimeWheel.length) / 2;
                                const textRad = (textAngle * Math.PI) / 180;
                                const textX = (innerR + (r - innerR) / 2) * Math.cos(textRad);
                                const textY = (innerR + (r - innerR) / 2) * Math.sin(textRad);
                                return (
                                  <g key={index}>
                                    <path
                                      d={`M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 0 0 ${x1} ${y1} Z`}
                                      fill={segment.color}
                                      stroke="#d4af37"
                                      strokeWidth="3"
                                    />
                                    <text
                                      x={textX}
                                      y={textY}
                                      fill="#fff"
                                      fontSize="14"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                      transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                                    >
                                      {segment.value}
                                    </text>
                                  </g>
                                );
                              })}
                            </g>
                            <circle cx="250" cy="250" r="235" fill="none" stroke="#d4af37" strokeWidth="10" />
                          </svg>
                          <div className="wheel-indicator">
                            <svg width="60" height="40" viewBox="0 0 60 40">
                              <polygon points="30,0 60,40 0,40" fill="#ff3333" stroke="#d4af37" strokeWidth="2" />
                            </svg>
                          </div>
                        </div>
                        {wheelResult && (
                          <div className="wheel-result" style={{ color: wheelResult.color }}>
                            Result: {wheelResult.value} ({wheelResult.colorName})
                          </div>
                        )}
                      </div>
                    </div>

                    {wheelStatus === 'bonus' && bonusResult && (
                      <div className="mb-6 text-center">
                        <p className="text-lg text-orange-700 mb-2">Bonus Round: {bonusResult.type}</p>
                        {bonusResult.type === 'Coin Flip' ? (
                          <div className="coin-flip">
                            <div className={`coin ${bonusResult.side === 'red' ? 'red flipping' : ''}`}>
                              Red: {bonusResult.redMultiplier}x
                            </div>
                            <div className={`coin ${bonusResult.side === 'blue' ? 'blue flipping' : ''}`}>
                              Blue: {bonusResult.blueMultiplier}x
                            </div>
                          </div>
                        ) : bonusResult.type === 'Pachinko' ? (
                          <div className="pachinko-board">
                            <div className="disc"></div>
                            <div className="slots">
                              {[2, 3, 5, 10, 20].map((multiplier, index) => (
                                <div
                                  key={index}
                                  className={`slot ${bonusResult.slotIndex === index ? 'highlight' : ''}`}
                                  style={{
                                    background: bonusResult.slotIndex === index ? '#ffcc00' : '#333',
                                    color: bonusResult.slotIndex === index ? '#1a1a2e' : '#fff',
                                  }}
                                >
                                  {multiplier}x
                                </div>
                              ))}
                            </div>
                            <p>Multiplier: {bonusResult.multiplier}x</p>
                          </div>
                        ) : bonusResult.type === 'Cash Hunt' ? (
                          <div className="cash-hunt-board">
                            <p>Multipliers: {bonusResult.multipliers.join(', ')}</p>
                            <p>Chosen: {bonusResult.chosenMultiplier}x</p>
                            <p>Final Multiplier: {bonusResult.multiplier}x</p>
                          </div>
                        ) : bonusResult.type === 'Crazy Time' ? (
                          <div className="crazy-time-board">
                            <p>Multiplier: {bonusResult.multiplier}x</p>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="mb-6">
                      <p className="text-lg text-orange-700 mb-2 text-center">Place Your Bets:</p>
                      <div className="flex gap-4 justify-center flex-wrap">
                        {['1', '2', '5', '10', 'Coin Flip', 'Pachinko', 'Cash Hunt', 'Crazy Time'].map(segment => (
                          <button
                            key={segment}
                            onClick={() => handleBetSelection(segment)}
                            className="casino-button"
                            style={{
                              background: bets[segment] > 0 ? 'linear-gradient(135deg, #00ff00, #008000)' : '',
                            }}
                          >
                            {segment} (Bet: {bets[segment].toFixed(2)} SOL)
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6 text-center">
                      <p className="text-lg text-orange-700 mb-2">Last Results:</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {lastResults.map((result, index) => (
                          <div key={index} className="bg-gray-700 text-cyan-400 p-1 rounded">
                            {result}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="chat-box">
                      {chatMessages.map((message, index) => (
                        <p key={index} className="chat-message">
                          Presenter: {message}
                        </p>
                      ))}
                    </div>

                    <p className="text-center text-orange-700 mb-4 text-lg">{wheelMessage}</p>
                    {wheelStatus === 'idle' ? (
                      <button
                        onClick={spinWheel}
                        className="w-full casino-button"
                        disabled={!!betError}
                      >
                        Spin Wheel (Total Bet:{' '}
                        {Object.values(bets)
                          .reduce((sum, bet) => sum + bet, 0)
                          .toFixed(2)}{' '}
                        SOL)
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setWheelStatus('idle');
                          setWheelResult(null);
                          setBonusResult(null);
                          setTopSlot({ segment: null, multiplier: 1 });
                          setBets({
                            1: 0,
                            2: 0,
                            5: 0,
                            10: 0,
                            'Coin Flip': 0,
                            'Pachinko': 0,
                            'Cash Hunt': 0,
                            'Crazy Time': 0,
                          });
                          setWheelMessage('');
                          setChatMessages([]);
                          setRotationAngle(0);
                        }}
                        className="w-full casino-button"
                        disabled={!!betError}
                      >
                        Play Again (Total Bet:{' '}
                        {Object.values(bets)
                          .reduce((sum, bet) => sum + bet, 0)
                          .toFixed(2)}{' '}
                        SOL)
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedGame(null)}
                      className="w-full casino-button mt-4"
                    >
                      Back to Casino Floor
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RewardsDashboard; 