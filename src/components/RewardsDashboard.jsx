import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, useFBX, useAnimations, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import io from 'socket.io-client';
import {
  getMint,
  TOKEN_PROGRAM_ID,
  AccountLayout,
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';



// File audio
const backgroundMusic = '/audio.mp3';
const spinSound = '/spin-sound.mp3';
const winSound = '/audio/win-sound.mp3';

const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT;
const MINT_ADDRESS_RAW = import.meta.env.VITE_MINT_ADDRESS;

console.log('DEBUG - RPC_ENDPOINT:', RPC_ENDPOINT);
console.log('DEBUG - MINT_ADDRESS_RAW:', MINT_ADDRESS_RAW);

if (!RPC_ENDPOINT ||  !MINT_ADDRESS_RAW) {
  console.error('ERROR - One or more environment variables are not defined in .env');
}
const MINT_ADDRESS = MINT_ADDRESS_RAW || null;

const TOKEN_NAME = 'Casino of Meme';
const TOKEN_SYMBOL = 'COM';



const CARD_BACK_IMAGE = '/card-back.png';

// Minimum bet fisso in COM
const MIN_BET_POKER = 1000; // 1000 COM per Poker PvP
const MIN_BET_OTHER = 0.01; // 0.01 SOL per gli altri minigiochi

const BACKEND_URL = 'https://casino-of-meme-backend-production.up.railway.app';
const socket = io(BACKEND_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket'], // Forza l'uso di WebSocket per evitare problemi con polling
});

// Percentuale di vittoria del computer per ogni minigioco
const COMPUTER_WIN_CHANCE = {
  cardDuel: 0.92,
  memeSlots: 0.92,
  coinFlip: 0.6,
  crazyTime: 0.95,
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
  { name: 'Meme', image: '/meme.png' },       // Nuovo simbolo
  { name: 'BONUS', image: '/BONUS.png' },    // Nuovo simbolo
  { name: 'Random', image: '/random.png' },  // Nuovo simbolo
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
      <primitive object={fbx} scale={[0.02, 0.02, 0.02]} />
      <Text
        position={[0, 0.5, 0.5]}
        fontSize={0.5}
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
      <primitive object={fbx} scale={[0.05, 0.05, 0.05]} />
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


// Componente per il tappeto rosso con barriere
const RedCarpetModule = ({ position }) => {
  const group = useRef();
  const fbx = useFBX('/models/red-carpet-module.fbx'); // Percorso del file FBX
  const carpetTexture = useLoader(THREE.TextureLoader, '/models/carpet.jpg'); // Texture del tappeto
  const pillarsTexture = useLoader(THREE.TextureLoader, '/models/pillars.jpg'); // Texture dei pillar
  const ropesTexture = useLoader(THREE.TextureLoader, '/models/ropes.jpg'); // Texture delle corde

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        let textureToApply;
        // Applica la texture in base al nome dell'oggetto o del materiale
        if (child.name.toLowerCase().includes('carpet')) {
          textureToApply = carpetTexture;
        } else if (child.name.toLowerCase().includes('pillar')) {
          textureToApply = pillarsTexture;
        } else if (child.name.toLowerCase().includes('rope')) {
          textureToApply = ropesTexture;
        } else {
          textureToApply = carpetTexture; // Default al tappeto
        }

        child.material = new THREE.MeshStandardMaterial({
          map: textureToApply,
          side: THREE.DoubleSide,
          roughness: 0.8, // Aspetto morbido per il tappeto, regolabile per pillar e ropes
          metalness: child.name.toLowerCase().includes('pillar') ? 0.5 : 0.1, // Pillar più metallici
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx, carpetTexture, pillarsTexture, ropesTexture]);

  return (
    <group ref={group} position={position}>
      <primitive object={fbx} scale={[0.08, 0.1, 0.08]} /> {/* Scala da regolare */}
    </group>
  );
};


const CasinoSignWithBulb = ({ position }) => {
  const group = useRef();
  const fbx = useFBX('/models/casino-sign-with-bulb.fbx'); // Percorso del file FBX

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        // Materiale personalizzato per simulare un’insegna con lampadine
        child.material = new THREE.MeshStandardMaterial({
          color: '##ffd700', // Colore base scuro per l’insegna (blu notte)
          emissive: '##ffd700', // Arancione neon per simulare le lampadine
          emissiveIntensity: 0.6, // Intensità della luce emessa
          roughness: 0.4, // Per un aspetto leggermente lucido
          metalness: 0.7, // Per un tocco metallico
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx]);

  return (
    <group ref={group} position={position}>
      <primitive object={fbx} scale={[0.035, 0.035, 0.035]} /> {/* Scala regolabile */}
      {/* Luci per simulare le lampadine */}
      <pointLight color="#ffff00" intensity={3} distance={15} position={[0, 1, 0.5]} />
      <pointLight color="##ffff00" intensity={2} distance={10} position={[-2, 0, 0.5]} />
      <pointLight color="##ffff00" intensity={2} distance={10} position={[2, 0, 0.5]} />
    </group>
  );
};




const CasinoTwistedColumn = ({ position }) => {
  const group = useRef();

  // Carica il modello e le texture una sola volta
  const fbx = useFBX('/models/casino-twisted-column.fbx');
  const baseColorTexture = useLoader(THREE.TextureLoader, '/models/textures/Concrete_Mat_baseColor.png');
  const metallicTexture = useLoader(THREE.TextureLoader, '/models/textures/Concrete_Mat_metallic.png');
  const normalTexture = useLoader(THREE.TextureLoader, '/models/textures/Concrete_Mat_normal.png');
  const roughnessTexture = useLoader(THREE.TextureLoader, '/models/textures/Concrete_Mat_roughness.png');

  // Clona il modello per evitare problemi di riutilizzo
  const clonedFbx = useMemo(() => fbx.clone(), [fbx]);

  useEffect(() => {
    clonedFbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: baseColorTexture,
          metalnessMap: metallicTexture,
          normalMap: normalTexture,
          roughnessMap: roughnessTexture,
          metalness: 1.0,
          roughness: 1.0,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    console.log(`Rendering column at position: ${position}`); // Debug per verificare che ogni colonna venga renderizzata
  }, [clonedFbx, baseColorTexture, metallicTexture, normalTexture, roughnessTexture, position]);

  return (
    <group ref={group} position={position}>
      <primitive object={clonedFbx} scale={[0.05, 0.05, 0.05]} />
    </group>
  );
};






import { useGLTF } from '@react-three/drei';

const DonaldTrump = ({ position, currentAnimation = 'Idle' }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/donald-trump-bd0dc9dd.glb'); // Usa il file GLB
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();
        let material;

        // Applichiamo colori base come fallback
        if (meshName.includes('trump_body')) {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xffd1a3), // Tonalità di pelle chiara
            side: THREE.DoubleSide,
            metalness: 0.3,
            roughness: 0.8,
          });
        } else if (meshName.includes('hair')) {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xffa500), // Capelli arancioni
            side: THREE.DoubleSide,
            metalness: 0.2,
            roughness: 0.9,
          });
        } else if (meshName.includes('jacket') || meshName.includes('pants') || meshName.includes('shirt')) {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x0000ff), // Vestito blu
            side: THREE.DoubleSide,
            metalness: 0.6,
            roughness: 0.5,
          });
        } else if (meshName.includes('tie')) {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xff0000), // Cravatta rossa
            side: THREE.DoubleSide,
            metalness: 0.5,
            roughness: 0.5,
          });
        } else if (meshName.includes('shoes')) {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x000000), // Scarpe nere
            side: THREE.DoubleSide,
            metalness: 0.7,
            roughness: 0.4,
          });
        } else if (meshName.includes('cap')) {
          child.visible = false; // Nascondiamo il cappello per mostrare i capelli
          return;
        } else if (meshName.includes('eyes')) {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x0000ff), // Occhi blu
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.9,
            emissive: new THREE.Color(0x0000ff),
            emissiveIntensity: 0.5,
          });
        } else {
          material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x808080), // Grigio come default
            side: THREE.DoubleSide,
            metalness: 0.5,
            roughness: 0.7,
          });
        }

        // Applichiamo il materiale solo se non ci sono texture
        if (!child.material || !child.material.map) {
          child.material = material;
          child.material.needsUpdate = true;
        }

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      Object.values(actions).forEach(action => action?.stop());
    }
    const animationName = names.find(name => name.toLowerCase().includes(currentAnimation.toLowerCase())) || names[0];
    if (animationName && actions[animationName]) {
      actions[animationName].reset().fadeIn(0.5).play();
    }
  }, [actions, names, currentAnimation]);

  return (
    <group ref={group} position={position}>
      <primitive object={scene} scale={[4, 4, 4]} />
      <Text position={[0, 1.5, 0]} fontSize={0.5} color="orange" anchorX="center" anchorY="middle">
      </Text>
    </group>
  );
};





// Sottocomponente per la logica della scena
const SceneContent = ({ onSelectGame, croupierAnimation, setCroupierAnimation, triggerWinEffect }) => {
  const { camera } = useThree();
  const [showParticles, setShowParticles] = useState(false);
  const [winLightColor, setWinLightColor] = useState(new THREE.Color('red'));
  const [trumpAnimation, setTrumpAnimation] = useState('Idle');
  const [isFloorReady, setIsFloorReady] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Parte del pavimento invariata (come nel tuo codice originale)
  const brickTexture = useLoader(THREE.TextureLoader, '/models/textures/red_brick_seamless.jpg');
  const brickNormalTexture = useLoader(THREE.TextureLoader, '/models/textures/red_brick_seamless.jpg');
  const floorMaterialRef = useRef(new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.1,
  }));

  // Aggiungi gestione di isMobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Parte del pavimento invariata (come nel tuo codice originale)
  useEffect(() => {
    if (brickTexture && brickNormalTexture) {
      brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
      brickTexture.repeat.set(10, 10);
      brickNormalTexture.wrapS = brickNormalTexture.wrapT = THREE.RepeatWrapping;
      brickNormalTexture.repeat.set(10, 10);

      floorMaterialRef.current.map = brickTexture;
      floorMaterialRef.current.normalMap = brickNormalTexture;
      floorMaterialRef.current.needsUpdate = true;

      setIsFloorReady(true);
    }
  }, [brickTexture, brickNormalTexture]);

  useEffect(() => {
    camera.position.set(0, 20, 60);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const handleSelectGame = (game) => {
    setCroupierAnimation('Wave');
    setTrumpAnimation('Wave');
    onSelectGame(game);
    setTimeout(() => {
      setTrumpAnimation('Idle');
    }, 2000);
  };

  useEffect(() => {
    if (triggerWinEffect) {
      setShowParticles(true);
      setWinLightColor(new THREE.Color('yellow'));
      setTrumpAnimation('Dance');
      setTimeout(() => {
        setShowParticles(false);
        setWinLightColor(new THREE.Color('red'));
        setTrumpAnimation('Idle');
      }, 3000);
    }
  }, [triggerWinEffect]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={isMobile ? 60 : 90} /> {/* Riduci FOV su mobile */}
      <ambientLight intensity={isMobile ? 0.4 : 0.6} /> {/* Riduci intensità su mobile */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={isMobile ? 1 : 1.5} // Riduci intensità su mobile
        castShadow={false} // Disattiva ombre su mobile
        shadow-mapSize={[isMobile ? 512 : 1024, isMobile ? 512 : 1024]} // Riduci risoluzione ombre
      />
      <pointLight
        position={[0, 5, 0]}
        color={winLightColor}
        intensity={isMobile ? 1 : 2} // Riduci intensità su mobile
        distance={20}
      />
      {isMobile ? null : ( // Disattiva seconda pointLight su mobile
        <pointLight position={[15, 5, 15]} color="blue" intensity={2} distance={20} />
      )}

      <Stars
        radius={100}
        depth={isMobile ? 30 : 50} // Riduci profondità su mobile
        count={isMobile ? 500 : 1000}
        factor={isMobile ? 2 : 4} // Riduci fattore su mobile
        saturation={0}
        fade
      />

      {/* Parte del pavimento invariata (come nel tuo codice originale) */}
      {isFloorReady && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <primitive object={floorMaterialRef.current} />
        </mesh>
      )}

      <Croupier position={[-14, -1, 10]} currentAnimation={croupierAnimation} />
      <DonaldTrump position={[10, -1, 16]} currentAnimation={trumpAnimation} />

      <PokerCard
        position={[-17, 2.5, -15]}
        gameName="BlackJack"
        onClick={() => handleSelectGame('Solana Card Duel')}
      />
      <SlotMachine
        position={[18, -1, -15]}
        gameName="Meme Slots"
        onClick={() => handleSelectGame('Meme Slots')}
      />
      <CoinFlip
        position={[-12.5, 2.5, -15]}
        gameName="Coin Flip"
        onClick={() => handleSelectGame('Coin Flip')}
      />
      <CrazyTimeWheel
        position={[2, -1, -16]}
        gameName="Crazy Wheel"
        onClick={() => handleSelectGame('Crazy Wheel')}
      />

      <CasinoTable position={[-15, -1, -15]} />
      <BlackjackTable position={[0, -1, 3]} onSelectGame={handleSelectGame} />
      <RedCarpetModule position={[0, -1, 10]} />
      <CasinoSignWithBulb position={[0, 19, 24]} />
      
      <CasinoTwistedColumn position={[-23.5, -1, -23.5]} />
      <CasinoTwistedColumn position={[-23.5, -1, 23.5]} />
      <CasinoTwistedColumn position={[23.5, -1, -23.5]} />
      <CasinoTwistedColumn position={[23.5, -1, 23.5]} />

      {showParticles && <Particles position={[0, 2, 0]} />}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={isMobile ? 20 : 15} // Limita zoom massimo su mobile
        maxDistance={isMobile ? 100 : 120} // Limita zoom minimo su mobile
        rotateSpeed={isMobile ? 0.8 : 1.3} // Riduci sensibilità rotazione su mobile
        zoomSpeed={isMobile ? 0.8 : 1.3} // Riduci sensibilità zoom su mobile
      />

      {isMobile ? null : ( // Disattiva Bloom su mobile
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={isMobile ? 50 : 100} />
        </EffectComposer>
      )}
    </>
  );
};


const CasinoScene = ({ onSelectGame, triggerWinEffect }) => {
  const [croupierAnimation, setCroupierAnimation] = useState('Idle');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Canvas
      className="w-full h-[50vh] md:h-[70vh]"
      gl={{
        antialias: !isMobile,
        powerPreference: 'low-power',
        shadowMap: { enabled: !isMobile, type: THREE.PCFSoftShadowMap },
      }}
      scene={{ background: new THREE.Color('#000000') }}
      // Aggiungi queste opzioni per migliorare le prestazioni su mobile
      dpr={isMobile ? 1 : window.devicePixelRatio} // Riduci il device pixel ratio su mobile
      performance={{
        current: 1,
        min: 0.5,
        max: 1,
        debounce: 200,
      }}
    >
      <SceneContent
        onSelectGame={onSelectGame}
        croupierAnimation={croupierAnimation}
        setCroupierAnimation={setCroupierAnimation}
        triggerWinEffect={triggerWinEffect}
        isMobile={isMobile}
      />
    </Canvas>
  );
};



// Componente principale
const RewardsDashboard = () => {
  const { publicKey, connected, signTransaction } = useWallet();
  const TAX_WALLET_ADDRESS = '2E1LhcV3pze6Q6P7MEsxUoNYK3KECm2rTS2D18eSRTn9';
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
  const [showInfo, setShowInfo] = useState(false); // Stato per mostrare/nascondere le info
  const [minBet, setMinBet] = useState(MIN_BET_OTHER); // Default a 0.01 SOL
  const [betAmount, setBetAmount] = useState(MIN_BET_OTHER); // Default a 0.01 SOL
  const [betError, setBetError] = useState(null);
  const [showWinImage, setShowWinImage] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [crazyTimeWheel, setCrazyTimeWheel] = useState([]);
  const [wheelSegmentIndex, setWheelSegmentIndex] = useState(null);
  const [betHistory, setBetHistory] = useState([]); // Cronologia delle scommesse
const [lastBets, setLastBets] = useState(null); // Ultima combinazione di scommesse valida
const [hasSeenWarning, setHasSeenWarning] = useState(false); // Stato per tracciare se l'utente ha visto l'avviso







  

  // Stato per Solana Card Duel
  const [playerCards, setPlayerCards] = useState([]);
  const [opponentCards, setOpponentCards] = useState([]);
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameMessage, setGameMessage] = useState('');

// Stato per Meme Slots
const [slotStatus, setSlotStatus] = useState('idle');
const [slotMessage, setSlotMessage] = useState('');
const [winningLines, setWinningLines] = useState([]);
const [winningIndices, setWinningIndices] = useState([]); // Aggiunto
const [isStopping, setIsStopping] = useState(false);
const [slotReelsDisplay, setSlotReelsDisplay] = useState(Array(25).fill(null));

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



  // Aggiungi il messaggio di avviso per Phantom
  useEffect(() => {
    if (connected && publicKey && !hasSeenWarning) {
      alert(
        "Note: Phantom may display a security warning. Casino of Meme is safe: we use HTTPS and do not store your private keys. For any concerns, contact us at casinofmeme@gmail.com."
      );
      setHasSeenWarning(true);
    }
  }, [connected, publicKey]);



  // Avvia la musica automaticamente al caricamento della dApp
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsMusicPlaying(true);
      }).catch((err) => {
        console.error("Autoplay bloccato:", err);
        // Fallback: l'utente dovrà avviare manualmente la musica
        setIsMusicPlaying(false);
      });
    }
  }, []);

  // Funzione per controllare la musica
  const toggleMusic = () => {
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => console.error("Errore durante la riproduzione:", err));
      }
      setIsMusicPlaying(!isMusicPlaying);
    }
  };




  

  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const holdersPerPage = 50;

  
  

  // Stato per il gioco selezionato
  const [selectedGame, setSelectedGame] = useState(null);


    // Aggiungi lo stato comBalance
    const [comBalance, setComBalance] = useState(0); // Valore iniziale di fallback



    const fetchComBalance = async () => {
      if (!connected || !publicKey) {
        setComBalance(0);
        return;
      }
    
      try {
        const response = await fetch(`${BACKEND_URL}/com-balance/${publicKey.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const result = await response.json();
        if (result.success) {
          setComBalance(result.balance);
          console.log(`Fetched COM balance: ${result.balance} COM`);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error('Error fetching COM balance:', err);
        setComBalance(0);
      }
    };


// Aggiorna betAmount al minBet iniziale
useEffect(() => {
  if (selectedGame === 'Poker PvP') {
    setMinBet(MIN_BET_POKER);
    setBetAmount(MIN_BET_POKER);
    setBetError(validateBet(MIN_BET_POKER, 'Poker PvP'));
  } else {
    setMinBet(MIN_BET_OTHER);
    setBetAmount(MIN_BET_OTHER);
    setBetError(validateBet(MIN_BET_OTHER));
  }
}, [selectedGame]);

// useEffect per recuperare il saldo COM quando il wallet cambia
useEffect(() => {
  fetchComBalance();
}, [connected, publicKey]);

const validateBet = (amount, game = selectedGame) => {
  if (isNaN(amount) || amount <= 0) return 'Bet must be a positive number.';
  if (game === 'Poker PvP') {
    if (amount < MIN_BET_POKER) return `Bet must be at least ${MIN_BET_POKER.toFixed(2)} COM.`;
  } else {
    if (amount < MIN_BET_OTHER) return `Bet must be at least ${MIN_BET_OTHER.toFixed(2)} SOL.`;
  }
  return null;
};




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










useEffect(() => {
  const handleGameState = (game) => {
    console.log('Game state received:', game);
    console.log('My socket.id:', socket.id || 'undefined');
    console.log('New currentTurn:', game.currentTurn);
    console.log('Updated pot:', game.pot);
    console.log('Updated timeLeft:', game.timeLeft);
    console.log('Game phase:', game.gamePhase);
    setPokerPlayers(game.players || []);
    setPokerTableCards(game.tableCards || []);
    setPokerPlayerCards(game.playerCards || {});
    setPokerStatus(game.status || 'waiting');
    setPokerMessage(game.message || 'Waiting for another player...');
    setCurrentTurn(game.currentTurn || null);
    setPokerPot(game.pot !== undefined ? game.pot : 0);
    setCurrentBet(game.currentBet || 0);
    setPlayerBets(game.playerBets || {});
    setGamePhase(game.gamePhase || 'pre-flop');
    setOpponentCardsVisible(game.opponentCardsVisible || false);
    setDealerMessage(game.dealerMessage || '');
    setTimeLeft(game.timeLeft !== undefined ? game.timeLeft : 30);
    if (game.gameId) {
      localStorage.setItem('currentGameId', game.gameId);
    }
    // Controllo per stato bloccato
    if (game.status === 'playing' && game.timeLeft <= 0 && game.currentTurn === socket.id) {
      setPokerMessage('Your turn timed out. Please reconnect or start a new game.');
      socket.emit('leaveGame', { playerAddress: publicKey?.toString(), gameId });
    }
  };

  const handleDistributeWinnings = async ({ winnerAddress, amount, isRefund }) => {
    console.log('Distribute winnings:', { winnerAddress, amount, isRefund });
    if (winnerAddress === publicKey?.toString()) {
      try {
        console.log('Sending request to /distribute-winnings:', { winnerAddress, amount });
        const response = await fetch(`${BACKEND_URL}/distribute-winnings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ winnerAddress, amount }),
        });
        const result = await response.json();
        console.log('Response from /distribute-winnings:', result);
        if (response.ok && result.success) {
          setTriggerWinEffect(true);
          playSound(winAudioRef);
          if (!isRefund) {
            setPlayerStats(prev => ({
              ...prev,
              wins: prev.wins + 1,
              totalWinnings: prev.totalWinnings + amount,
            }));
          }
          setPokerMessage(`You ${isRefund ? 'received a refund of' : 'won'} ${amount.toFixed(2)} COM!`);
          fetchComBalance();
        } else {
          console.error('Failed to distribute winnings:', result.error || 'Unknown error');
          const errorMessage = result.error || 'Unknown error';
          const transactionSignature = result.transactionSignature || 'N/A';
          setPokerMessage(
            `Failed to receive ${amount.toFixed(2)} COM: ${errorMessage}. Transaction Signature: ${transactionSignature}. Please contact support with these details.`
          );
        }
      } catch (err) {
        console.error('Error distributing winnings:', err.message, err.stack);
        setPokerMessage(
          `Error receiving ${amount.toFixed(2)} COM: ${err.message}. Please contact support with error details.`
        );
      }
    } else {
      setPokerMessage(`${winnerAddress.slice(0, 8)}... has ${isRefund ? 'received a refund of' : 'won'} ${amount.toFixed(2)} COM!`);
    }
  };

  const handleRefund = async ({ message, amount, isRefund }) => {
    console.log('Refund received:', { message, amount, isRefund });
    setPokerMessage(message);
  
    if (connected && publicKey && amount > 0) {
      try {
        const response = await fetch(`${BACKEND_URL}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ playerAddress: publicKey.toString(), amount }),
        });
        const result = await response.json();
        if (result.success) {
          setPokerMessage(`Refund of ${amount.toFixed(2)} COM received!`);
          fetchComBalance();
          // Non aggiorniamo la leaderboard per i rimborsi
          if (!isRefund) {
            setPlayerStats(prev => ({
              ...prev,
              totalWinnings: prev.totalWinnings + amount,
            }));
          }
        } else {
          setPokerMessage('Refund failed: Error processing refund. Contact support.');
        }
      } catch (err) {
        console.error('Error processing refund:', err);
        setPokerMessage('Refund failed: Transaction error. Contact support.');
      }
    } else {
      setPokerMessage('Refund failed: Wallet not connected or invalid amount.');
    }
  
    setWaitingPlayersList(prev => prev.filter(p => p.address !== publicKey?.toString()));
  };

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id || 'undefined');
    setPokerMessage('Connected to server');
    const gameId = localStorage.getItem('currentGameId');
    if (gameId && publicKey) {
      console.log('Emitting reconnectPlayer:', { playerAddress: publicKey.toString(), gameId });
      socket.emit('reconnectPlayer', { playerAddress: publicKey.toString(), gameId });
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    setPokerMessage('Failed to connect to server. Retrying...');
  });

  socket.on('waiting', (data) => {
    console.log('Received waiting event:', data);
    setPokerMessage(data.message);
    setWaitingPlayersList(data.players || []);
  });

  socket.on('waitingPlayers', (data) => {
    console.log('Received waitingPlayers event:', data);
    setWaitingPlayersList(data.players || []);
  });

  socket.on('refund', handleRefund);

  socket.on('leftWaitingList', ({ message }) => {
    console.log('Left waiting list:', message);
    setPokerMessage(message);
    setWaitingPlayersList(prev => prev.filter(p => p.address !== publicKey?.toString()));
    setBetAmount(minBet);
  });

  socket.on('gameState', handleGameState);
  socket.on('distributeWinnings', handleDistributeWinnings);
  socket.on('error', (data) => {
    console.error('Error from server:', data);
    setPokerMessage(data.message);
  });

  console.log('Connecting socket...');
  socket.connect();

  return () => {
    socket.off('connect');
    socket.off('connect_error');
    socket.off('waiting');
    socket.off('waitingPlayers');
    socket.off('refund', handleRefund);
    socket.off('leftWaitingList');
    socket.off('gameState', handleGameState);
    socket.off('distributeWinnings', handleDistributeWinnings);
    socket.off('error');
  };
}, [publicKey, minBet]);

// Determina se è il turno del giocatore corrente
const isMyTurn = currentTurn === socket.id;

// Aggiungi un useEffect per monitorare i cambiamenti di isMyTurn
useEffect(() => {
  console.log('DEBUG - isMyTurn updated:', isMyTurn, 'currentTurn:', currentTurn, 'socket.id:', socket.id);
}, [isMyTurn, currentTurn, socket.id]);



useEffect(() => {
  if (triggerWinEffect) {
    setShowWinImage(true);
    const timer = setTimeout(() => {
      setShowWinImage(false);
      setTriggerWinEffect(false); // Resetta triggerWinEffect
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [triggerWinEffect]);





// Recupera la classifica
useEffect(() => {
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('https://casino-of-meme-backend-production.up.railway.app/leaderboard');
      const data = await response.json();
      setLeaderboard(data);
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

 
  // Modifica createAndSignTransaction

  const { signMessage } = useWallet();

  let authToken = null;
  
  const authenticateUser = async () => {
    if (!connected || !publicKey || !signMessage) {
      throw new Error('Please connect your wallet to authenticate!');
    }
  
    try {
      const message = `Authenticate with Casino of Meme at ${new Date().toISOString()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
  
      const authResponse = await fetch(`${BACKEND_URL}/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: publicKey.toString(),
          message,
          signature: Buffer.from(signature).toString('base64'),
        }),
      });
  
      const authResult = await authResponse.json();
      if (!authResult.success) {
        throw new Error(authResult.error);
      }
  
      authToken = authResult.token;
      console.log('User authenticated, token:', authToken);
    } catch (err) {
      console.error('Authentication failed:', err);
      throw err;
    }
  };

  const createAndSignTransaction = async (betAmount, gameType, additionalData = {}) => {
    if (!connected || !publicKey || !signTransaction) {
      throw new Error('Please connect your wallet to play!');
    }
  
    if (!authToken) {
      await authenticateUser();
    }
  
    const validGameTypes = ['memeSlots', 'coinFlip', 'crazyWheel', 'solanaCardDuel'];
    if (!validGameTypes.includes(gameType)) {
      throw new Error(`Invalid gameType: ${gameType}`);
    }
  
    const roundedBetAmount = Math.round(betAmount * 1000000000) / 1000000000;
  
    try {
      // Crea la transazione per trasferire SOL al tax wallet
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('2E1LhcV3pze6Q6P7MEsxUoNYK3KECm2rTS2D18eSRTn9'), // Tax wallet address
          lamports: Math.round(roundedBetAmount * LAMPORTS_PER_SOL),
        })
      );
  
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
  
      const signedTransaction = await signTransaction(transaction);
  
      const endpointMap = {
        memeSlots: '/play-meme-slots',
        coinFlip: '/play-coin-flip',
        crazyWheel: '/play-crazy-wheel',
        solanaCardDuel: '/play-solana-card-duel',
      };
  
      const response = await fetch(`${BACKEND_URL}${endpointMap[gameType]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          playerAddress: publicKey.toString(),
          betAmount: roundedBetAmount,
          signedTransaction: signedTransaction.serialize().toString('base64'),
          ...additionalData,
        }),
      });
  
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
  
      return result;
    } catch (err) {
      console.error(`Failed to process transaction for ${gameType}:`, err);
      throw err;
    }
  };

 


  const handleBetChange = (e) => {
    const value = parseFloat(e.target.value);
    setBetAmount(value);
    setBetError(validateBet(value));
  };


  const updateMissionProgress = (missionId, increment = 1) => {
    setMissions(prev => {
      const updatedMissions = prev.map(mission => {
        if (mission.id === missionId && !mission.completed) {
          const newCurrent = mission.current + increment;
          if (newCurrent >= mission.target) {
            (async () => {
              try {
                const response = await fetch(`${BACKEND_URL}/distribute-winnings-sol`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    playerAddress: publicKey.toString(),
                    amount: mission.reward,
                  }),
                });
                const result = await response.json();
                if (result.success) {
                  const message = `Mission completed! You earned ${mission.reward} SOL!`;
                  if (missionId === 1) setSlotMessage(prev => `${prev}\n${message}`);
                  else if (missionId === 2) setGameMessage(prev => `${prev}\n${message}`);
                  else if (missionId === 3) addChatMessage(message);
                } else {
                  const errorMessage = 'Mission completed, but reward distribution failed. Contact support.';
                  if (missionId === 1) setSlotMessage(prev => `${prev}\n${errorMessage}`);
                  else if (missionId === 2) setGameMessage(prev => `${prev}\n${errorMessage}`);
                  else if (missionId === 3) addChatMessage(errorMessage);
                }
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


  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setPokerMessage('Connected to server');
    });
  
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setPokerMessage('Failed to connect to server. Retrying...');
    });
  
    socket.connect();
  
    return () => {
      socket.off('connect');
      socket.off('connect_error');
    };
  }, []);
  

  const joinPokerGame = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setPokerMessage('Connetti il tuo portafoglio per giocare!');
      console.log('Join failed: Wallet not connected', { connected, publicKey });
      return;
    }
  
    const betError = validateBet(betAmount, 'Poker PvP');
    if (betError) {
      setPokerMessage(betError);
      console.log('Join failed: Bet validation error', { betAmount, betError });
      return;
    }
  
    if (comBalance < betAmount) {
      setPokerMessage('Saldo COM insufficiente.');
      console.log('Join failed: Insufficient COM balance', { comBalance, betAmount });
      return;
    }
  
    try {
      console.log('Creating transaction for joining poker game...');
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const userATA = await getAssociatedTokenAddress(
        new PublicKey(MINT_ADDRESS),
        publicKey
      );
      const casinoPublicKey = new PublicKey('2E1LhcV3pze6Q6P7MEsxUoNYK3KECm2rTS2D18eSRTn9');
      const casinoATA = await getAssociatedTokenAddress(
        new PublicKey(MINT_ADDRESS),
        casinoPublicKey
      );
  
      const transaction = new Transaction();
      
      // Verifica se l'ATA dell'utente esiste, altrimenti creala
      let userAccountExists = false;
      try {
        await getAccount(connection, userATA);
        userAccountExists = true;
      } catch (err) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userATA,
            publicKey,
            new PublicKey(MINT_ADDRESS)
          )
        );
      }
  
      // Aggiungi l'istruzione di trasferimento
      transaction.add(
        createTransferInstruction(
          userATA,
          casinoATA,
          publicKey,
          betAmount * 1e6 // Converti in token base
        )
      );
  
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
  
      console.log('Signing transaction...');
      const signedTransaction = await signTransaction(transaction);
  
      console.log('Sending joinGame request:', { playerAddress: publicKey.toString(), betAmount });
      const response = await fetch(`${BACKEND_URL}/join-poker-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerAddress: publicKey.toString(),
          betAmount,
          signedTransaction: signedTransaction.serialize().toString('base64'),
        }),
      });
      const result = await response.json();
      if (result.success) {
        console.log('Transaction successful, emitting joinGame event...');
        socket.emit('joinGame', {
          playerAddress: publicKey.toString(),
          betAmount,
        }, (ack) => {
          if (ack) {
            console.log('joinGame event acknowledged by server:', ack);
            setPokerMessage('Ti sei unito al gioco! In attesa di un altro giocatore...');
            fetchComBalance(); // Aggiorna il saldo dopo la transazione
          } else {
            console.error('No acknowledgment received for joinGame event');
            setPokerMessage('Errore: evento joinGame non confermato dal server.');
          }
        });
      } else {
        setPokerMessage(`Impossibile unirsi al gioco: ${result.error}`);
        console.log('Join failed:', result.error);
      }
    } catch (err) {
      console.error('Errore in joinPokerGame:', err);
      setPokerMessage('Impossibile unirsi al gioco: ' + err.message);
    }
  };
  
  const makePokerMove = async (move, amount = 0) => {
    if (!connected || !publicKey || pokerStatus !== 'playing' || !signTransaction) {
      setPokerMessage('Gioco non in corso o portafoglio non connesso!');
      return;
    }
  
    const gameId = localStorage.getItem('currentGameId');
    if (!gameId) {
      setPokerMessage('Nessun gioco attivo trovato!');
      return;
    }
  
    if (currentTurn !== socket.id) {
      setPokerMessage("Non è il tuo turno!");
      return;
    }
  
    if (move === 'raise' && validateBet(amount, 'Poker PvP')) {
      setPokerMessage(validateBet(amount, 'Poker PvP'));
      return;
    }
  
    let additionalBet = 0;
    if (move === 'call') {
      additionalBet = currentBet - (playerBets[publicKey.toString()] || 0);
    } else if (move === 'bet' || move === 'raise') {
      additionalBet = amount - (playerBets[publicKey.toString()] || 0);
    }
  
    if (additionalBet > 0) {
      if (comBalance < additionalBet) {
        setPokerMessage('Saldo COM insufficiente. Aggiungi fondi e riprova.');
        return;
      }
  
      try {
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        const userATA = await getAssociatedTokenAddress(
          new PublicKey(MINT_ADDRESS),
          publicKey
        );
        const casinoPublicKey = new PublicKey('2E1LhcV3pze6Q6P7MEsxUoNYK3KECm2rTS2D18eSRTn9');
        const casinoATA = await getAssociatedTokenAddress(
          new PublicKey(MINT_ADDRESS),
          casinoPublicKey
        );
  
        const transaction = new Transaction();
  
        // Verifica se l'ATA dell'utente esiste, altrimenti creala
        let userAccountExists = false;
        try {
          await getAccount(connection, userATA);
          userAccountExists = true;
        } catch (err) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              userATA,
              publicKey,
              new PublicKey(MINT_ADDRESS)
            )
          );
        }
  
        // Aggiungi l'istruzione di trasferimento
        transaction.add(
          createTransferInstruction(
            userATA,
            casinoATA,
            publicKey,
            additionalBet * 1e6 // Converti in token base
          )
        );
  
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
  
        console.log('Signing transaction for move:', move);
        const signedTransaction = await signTransaction(transaction);
  
        console.log('Sending make-poker-move request:', { playerAddress: publicKey.toString(), gameId, move, amount: additionalBet });
        const response = await fetch(`${BACKEND_URL}/make-poker-move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerAddress: publicKey.toString(),
            gameId,
            move,
            amount: additionalBet,
            signedTransaction: signedTransaction.serialize().toString('base64'),
          }),
        });
        const result = await response.json();
        if (!result.success) {
          setPokerMessage(`Scommessa fallita: ${result.error}`);
          return;
        }
        fetchComBalance();
      } catch (err) {
        console.error('Errore nella scommessa:', err);
        setPokerMessage(`Scommessa fallita: ${err.message}`);
        return;
      }
    }
  
    console.log(`Emissione evento makeMove: gameId=${gameId}, move=${move}, amount=${amount}`);
    socket.emit('makeMove', { gameId, move, amount });
  };
  

  const [accumulatedRewards, setAccumulatedRewards] = useState({
    sol: 0,
    wbtc: 0,
    weth: 0,
  });
  
  // Funzione per caricare le ricompense accumulate da localStorage
  const loadAccumulatedRewards = () => {
    const saved = localStorage.getItem('accumulatedRewards');
    if (saved) {
      return JSON.parse(saved);
    }
    return { sol: 0, wbtc: 0, weth: 0 }; // Valori iniziali se non ci sono dati salvati
  };
  
  // Carica i dati salvati all'avvio
  useEffect(() => {
    const saved = loadAccumulatedRewards();
    setAccumulatedRewards(saved);
  }, []);


   
  // Fetch dei dati di reward
  useEffect(() => {
    if (MINT_ADDRESS && RPC_ENDPOINT) {
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



  const [lastBalance, setLastBalance] = useState(null);

  const fetchRewardsData = async (retries = 3, delay = 1000) => {
    setLoading(true);
    setError(null);
  
    let newAccumulated = { sol: 0, wbtc: 0, weth: 0 }; // Valore predefinito
  
    for (let i = 0; i < retries; i++) {
      try {
        // Recupera il saldo del tax wallet dal backend
        const balanceResponse = await fetch(`${BACKEND_URL}/tax-wallet-balance`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!balanceResponse.ok) {
          throw new Error(`HTTP error! status: ${balanceResponse.status}`);
        }
        const balanceResult = await balanceResponse.json();
        if (balanceResult.success) {
          setTaxWalletBalance(balanceResult.balance);
          console.log('DEBUG - Tax wallet balance fetched:', balanceResult.balance);
        } else {
          throw new Error(balanceResult.error);
        }
  
        // Recupera le ricompense dal backend
        const rewardsResponse = await fetch(`${BACKEND_URL}/rewards`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!rewardsResponse.ok) {
          throw new Error(`HTTP error! status: ${rewardsResponse.status}`);
        }
        const rewardsResult = await rewardsResponse.json();
        if (rewardsResult.success) {
          setRewardSol(rewardsResult.rewards.sol);
          setRewardWbtc(rewardsResult.rewards.wbtc);
          setRewardWeth(rewardsResult.rewards.weth);
  
          const prevAccumulated = loadAccumulatedRewards();
          newAccumulated = {
            sol: prevAccumulated.sol + rewardsResult.rewards.sol,
            wbtc: prevAccumulated.wbtc + rewardsResult.rewards.wbtc,
            weth: prevAccumulated.weth + rewardsResult.rewards.weth,
          };
          setAccumulatedRewards(newAccumulated);
          localStorage.setItem('accumulatedRewards', JSON.stringify(newAccumulated));
        } else {
          throw new Error(rewardsResult.error);
        }
  
        // Ricerca degli holders nel frontend
        if (connected && publicKey && MINT_ADDRESS && RPC_ENDPOINT) {
          const connection = new Connection(RPC_ENDPOINT, 'confirmed');
          const holderList = await getHolders(MINT_ADDRESS, connection);
          const mintInfo = await getMint(connection, new PublicKey(MINT_ADDRESS));
          const supply = Number(mintInfo.supply) / 1e6;
          setTotalSupply(supply);
  
          const updatedHolders = holderList.map(holder => ({
            ...holder,
            solReward: (holder.amount / supply) * rewardsResult.rewards.sol,
            wbtcReward: (holder.amount / supply) * rewardsResult.rewards.wbtc,
            wethReward: (holder.amount / supply) * rewardsResult.rewards.weth,
          }));
          setHolders(updatedHolders);
          setHolderCount(updatedHolders.length);
  
          const userBalance = await fetch(`${BACKEND_URL}/com-balance/${publicKey.toString()}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }).then(res => res.json());
          const userAmount = userBalance.success ? userBalance.balance : 0;
          setUserTokens(userAmount);
          setUserRewards({
            sol: (userAmount / supply) * newAccumulated.sol,
            wbtc: (userAmount / supply) * newAccumulated.wbtc,
            weth: (userAmount / supply) * newAccumulated.weth,
          });
        } else {
          setHolders([]);
          setHolderCount(0);
          setTotalSupply(0);
          setUserTokens(0);
          setUserRewards({ sol: 0, wbtc: 0, weth: 0 });
        }
        return;
      } catch (error) {
        console.error(`Error in fetchRewardsData (attempt ${i + 1}/${retries}):`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          setError('Error fetching data: ' + error.message);
          setHolders([]);
          setHolderCount(0);
          setTotalSupply(0);
          setUserTokens(0);
          setUserRewards({ sol: 0, wbtc: 0, weth: 0 });
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const getHolders = async (mintAddress, connection) => {
    const holders = [];
    const filters = [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mintAddress } },
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

  // Modifica Solana Card Duel
// Funzione per iniziare la partita
const startBlackjack = async () => {
  if (!connected || !publicKey) {
    setGameMessage('Please connect your wallet to play!');
    return;
  }

  const betError = validateBet(betAmount, 'Solana Card Duel');
  if (betError) {
    setGameMessage(betError);
    return;
  }

  setGameStatus('betting');
  // Resettiamo le carte subito per non mostrarle durante la transazione
  setPlayerCards([]);
  setOpponentCards([]);
  setGameMessage('Placing bet...');

  try {
    console.log('DEBUG - Sending bet transaction...');
    // Usa createAndSignTransaction per inviare la scommessa al backend
    await createAndSignTransaction(betAmount, 'solanaCardDuel', { action: 'start' });

    // Pesca le carte solo dopo che la transazione è confermata
    const playerInitial = [drawCard(), drawCard()];
    const dealerInitial = [drawCard(), drawCard()]; // Banco con 2 carte

    const arePlayerCardsValid = playerInitial.every(card => card && card.value && card.image);
    const areDealerCardsValid = dealerInitial.every(card => card && card.value && card.image);

    if (!arePlayerCardsValid || !areDealerCardsValid) {
      console.error('DEBUG - Invalid cards assigned:', { playerInitial, dealerInitial });
      setGameMessage('Error: Invalid cards. Please try again.');
      setGameStatus('idle');
      setPlayerCards([]);
      setOpponentCards([]);
      return;
    }

    console.log('DEBUG - Player cards:', playerInitial);
    console.log('DEBUG - Dealer cards:', dealerInitial);
    setPlayerCards(playerInitial);
    setOpponentCards(dealerInitial); // "opponentCards" ora rappresenta le carte del banco

    setGameStatus('playing');
    setGameMessage('Bet placed! Your turn: Hit or Stand.');
  } catch (err) {
    console.error('DEBUG - Bet failed:', err);
    setGameMessage(`Bet failed: ${err.message}`);
    setGameStatus('idle');
    setPlayerCards([]);
    setOpponentCards([]);
  }
};

const hit = () => {
  if (gameStatus !== 'playing') return;

  const newCard = drawCard();
  if (!newCard || !newCard.value || !newCard.image) {
    console.error('DEBUG - Invalid card drawn:', newCard);
    setGameMessage('Error: Invalid card. Please try again.');
    return;
  }

  setPlayerCards(prev => [...prev, newCard]);
  const newScore = calculateScore([...playerCards, newCard]);

  if (newScore > 21) {
    setGameStatus('finished');
    setGameMessage('You busted! Dealer wins.');
  } else {
    setGameMessage(`Your score: ${newScore}. Hit or Stand?`);
  }
};

const stand = async () => {
  if (gameStatus !== 'playing') return;

  const playerScore = calculateScore(playerCards);
  let dealerCards = [...opponentCards];
  let dealerScore = calculateScore(dealerCards);

  // Il banco pesca carte finché il punteggio è inferiore a 17
  while (dealerScore < 17) {
    const newCard = drawCard();
    if (!newCard || !newCard.value || !newCard.image) {
      console.error('DEBUG - Invalid card drawn for dealer:', newCard);
      setGameMessage('Error: Invalid dealer card. Please try again.');
      return;
    }
    dealerCards = [...dealerCards, newCard];
    dealerScore = calculateScore(dealerCards);
    setOpponentCards(dealerCards); // Aggiorna le carte del banco visibili
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa per simulare il gioco
  }

  console.log('DEBUG - Final player score:', playerScore);
  console.log('DEBUG - Final dealer score:', dealerScore);

  const winAmount = betAmount * 2; // Vincita doppia per la vittoria
  const tieAmount = betAmount; // Rimborso della scommessa in caso di pareggio

  // Logica di vincita
  if (dealerScore > 21) {
    setGameStatus('finished');
    setGameMessage(`Dealer busted! You won ${winAmount.toFixed(2)} SOL!`);

    try {
      // Distribuisci la vincita tramite il backend
      const response = await fetch(`${BACKEND_URL}/distribute-winnings-sol`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerAddress: publicKey.toString(),
          amount: winAmount,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setTriggerWinEffect(true);
        playSound(winAudioRef);
        updateMissionProgress(2);
        setPlayerStats(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalWinnings: prev.totalWinnings + winAmount,
        }));
      } else {
        setGameMessage(`You won ${winAmount.toFixed(2)} SOL, but prize distribution failed: ${result.error}. Contact support.`);
      }
    } catch (err) {
      console.error('DEBUG - Prize distribution failed:', err);
      setGameMessage('You won, but prize distribution failed. Contact support.');
    }
  } else if (playerScore > dealerScore) {
    setGameStatus('finished');
    setGameMessage(`You won ${winAmount.toFixed(2)} SOL!`);

    try {
      // Distribuisci la vincita tramite il backend
      const response = await fetch(`${BACKEND_URL}/distribute-winnings-sol`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerAddress: publicKey.toString(),
          amount: winAmount,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setTriggerWinEffect(true);
        playSound(winAudioRef);
        updateMissionProgress(2);
        setPlayerStats(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalWinnings: prev.totalWinnings + winAmount,
        }));
      } else {
        setGameMessage(`You won ${winAmount.toFixed(2)} SOL, but prize distribution failed: ${result.error}. Contact support.`);
      }
    } catch (err) {
      console.error('DEBUG - Prize distribution failed:', err);
      setGameMessage('You won, but prize distribution failed. Contact support.');
    }
  } else if (playerScore === dealerScore) {
    setGameStatus('finished');
    setGameMessage("It's a tie! Your bet is returned.");

    try {
      // Rimborso della scommessa tramite il backend
      const response = await fetch(`${BACKEND_URL}/distribute-winnings-sol`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerAddress: publicKey.toString(),
          amount: tieAmount,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setGameMessage(`Tie, but bet return failed: ${result.error}. Contact support.`);
      }
    } catch (err) {
      console.error('DEBUG - Bet return failed:', err);
      setGameMessage('Tie, but bet return failed. Contact support.');
    }
  } else {
    setGameStatus('finished');
    setGameMessage('Dealer wins! Try again.');
  }
};

  

  
  const generateSlotResult = () => {
    let result;
    if (Math.random() < COMPUTER_WIN_CHANCE.memeSlots) {
      // Computer vince: genera un risultato senza linee vincenti (nemmeno 3 simboli consecutivi)
      result = Array(25).fill().map(() => slotMemes[Math.floor(Math.random() * slotMemes.length)]);
      let attempts = 0;
      while (attempts < 20) {
        let hasWin = false;
        const winLines = [
          [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
          [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
          [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
        ];
  
        for (const line of winLines) {
          const symbolsInLine = line.map(index => result[index].name);
          let currentSymbol = symbolsInLine[0];
          let streak = 1;
          for (let j = 1; j < symbolsInLine.length; j++) {
            if (symbolsInLine[j].toLowerCase() === currentSymbol.toLowerCase()) {
              streak++;
              if (streak >= 3) {
                hasWin = true;
                break;
              }
            } else {
              currentSymbol = symbolsInLine[j];
              streak = 1;
            }
          }
          if (hasWin) break;
        }
  
        if (!hasWin) break;
        result = Array(25).fill().map(() => slotMemes[Math.floor(Math.random() * slotMemes.length)]);
        attempts++;
      }
  
      if (attempts >= 20) {
        console.log('DEBUG - Forcing a losing result after max attempts');
        result = Array(25).fill().map((_, index) => slotMemes[index % slotMemes.length]);
      }
    } else {
      // Giocatore vince: genera un risultato con una linea vincente
      result = Array(25).fill().map(() => slotMemes[Math.floor(Math.random() * slotMemes.length)]);
      const winningSymbol = slotMemes[Math.floor(Math.random() * slotMemes.length)];
      const winLines = [
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // Righe
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // Colonne
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20], // Diagonali
      ];
      const winningLine = winLines[Math.floor(Math.random() * winLines.length)];
  
      // Scegli il numero di simboli consecutivi (favorendo 3 simboli)
      const streakOptions = [
        { streak: 3, probability: 0.9 }, // 90% di probabilità per 3 simboli
        { streak: 4, probability: 0.09 }, // 9% di probabilità per 4 simboli
        { streak: 5, probability: 0.01 }, // 1% di probabilità per 5 simboli
      ];
      const totalProbability = streakOptions.reduce((sum, option) => sum + option.probability, 0);
      let random = Math.random() * totalProbability;
      let selectedStreak = 3;
      for (const option of streakOptions) {
        if (random < option.probability) {
          selectedStreak = option.streak;
          break;
        }
        random -= option.probability;
      }
  
      // Applica la combinazione vincente
      for (let i = 0; i < selectedStreak; i++) {
        result[winningLine[i]] = winningSymbol;
      }
    }
  
    // Assicurati che ogni elemento sia valido
    result = result.map((item, index) => {
      if (!item || !item.name || !item.image) {
        console.warn(`DEBUG - Invalid slot item detected at index ${index}, replacing with default:`, item);
        return slotMemes[0]; // Usa il primo simbolo come fallback
      }
      return item;
    });
  
    console.log('DEBUG - Generated Slot Result:', result.map((item, index) => `${index}: ${item.name}`));
    return result;
  };



  
  // Aggiorna animateReels per sincronizzare correttamente
  const animateReels = (result, callback) => {
    const spinDuration = 3000; // Ridotto da 5000 ms a 3000 ms
    const intervalTime = 100; // Ridotto da 150 ms a 100 ms per maggiore fluidità
    let elapsedTime = 0;
  
    console.log('DEBUG - animateReels started with result:', result.map(item => item ? item.name : 'null'));
  
    const spinInterval = setInterval(() => {
      elapsedTime += intervalTime;
  
      if (elapsedTime >= spinDuration - 300) { // Ridotto da 500 ms a 300 ms
        clearInterval(spinInterval);
        setIsStopping(true);
  
        console.log('DEBUG - Result before animation:', result.map(item => item ? item.name : 'null'));
        setTimeout(() => {
          console.log('DEBUG - Setting first column:', result.slice(0, 5).map(item => item ? item.name : 'null'));
          setSlotReelsDisplay([...result.slice(0, 5), ...Array(20).fill(null)]);
        }, 120); // Ridotto da 200 ms a 120 ms
        setTimeout(() => {
          console.log('DEBUG - Setting second column:', result.slice(0, 10).map(item => item ? item.name : 'null'));
          setSlotReelsDisplay([...result.slice(0, 10), ...Array(15).fill(null)]);
        }, 240); // Ridotto da 400 ms a 240 ms
        setTimeout(() => {
          console.log('DEBUG - Setting third column:', result.slice(0, 15).map(item => item ? item.name : 'null'));
          setSlotReelsDisplay([...result.slice(0, 15), ...Array(10).fill(null)]);
          console.log('DEBUG - Symbols at [10, 11, 12] after third column:', [
            result[10]?.name || 'null',
            result[11]?.name || 'null',
            result[12]?.name || 'null'
          ]);
        }, 360); // Ridotto da 600 ms a 360 ms
        setTimeout(() => {
          console.log('DEBUG - Setting fourth column:', result.slice(0, 20).map(item => item ? item.name : 'null'));
          setSlotReelsDisplay([...result.slice(0, 20), ...Array(5).fill(null)]);
        }, 480); // Ridotto da 800 ms a 480 ms
        setTimeout(() => {
          console.log('DEBUG - Final result set:', result.map(item => item ? item.name : 'null'));
          console.log('DEBUG - Symbols at [10, 11, 12] final:', [
            result[10]?.name || 'null',
            result[11]?.name || 'null',
            result[12]?.name || 'null'
          ]);
          setSlotReelsDisplay([...result]); // Usa una copia per forzare l'aggiornamento
          setIsStopping(false);
          setTimeout(() => {
            console.log('DEBUG - Calling evaluateResult with:', result.map(item => item ? item.name : 'null'));
            callback();
          }, 120); // Ridotto da 200 ms a 120 ms
        }, 720); // Ridotto da 1200 ms a 720 ms
      }
    }, intervalTime);
  };

// Modifica spinSlots
const spinSlots = async () => {
  if (!connected || !publicKey || !signTransaction) {
    setSlotMessage('Please connect your wallet to play!');
    return;
  }

  const betError = validateBet(betAmount);
  if (betError) {
    setSlotMessage(betError);
    return;
  }

  setSlotStatus('spinning');
  setIsStopping(false);
  playSound(spinAudioRef);

  try {
    const result = await createAndSignTransaction(betAmount, 'memeSlots');
    animateReels(result.result, () => {
      setWinningLines(result.winningLines);
      setWinningIndices(result.winningIndices);
      if (result.totalWin > 0) {
        setSlotStatus('won');
        setSlotMessage(`Jackpot! You won ${result.totalWin.toFixed(3)} SOL!`);
        setTriggerWinEffect(true);
        playSound(winAudioRef);
        setPlayerStats(prev => ({
          ...prev,
          totalWinnings: prev.totalWinnings + result.totalWin,
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
    });
  } catch (err) {
    setSlotMessage(`Spin failed: ${err.message}`);
    setSlotStatus('idle');
  }
};


  // Aggiorna evaluateResult per un confronto più robusto e log dettagliati
  const evaluateResult = async (result) => {
    const winLines = [
      [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
      [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
      [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
    ];
  
    const winningLinesFound = [];
    const winningIndices = new Set();
    let totalWin = 0;
    const winDetails = [];
  
    for (let i = 0; i < winLines.length; i++) {
      const line = winLines[i];
      const symbolsInLine = line.map(index => result[index]?.name);
  
      if (symbolsInLine.some(symbol => !symbol)) {
        console.warn(`DEBUG - Skipping line ${i} due to null symbols:`, symbolsInLine);
        continue;
      }
  
      let currentSymbol = symbolsInLine[0];
      let streak = 1;
      let streakStart = 0;
  
      for (let j = 1; j < symbolsInLine.length; j++) {
        if (symbolsInLine[j] === currentSymbol) {
          streak++;
        } else {
          if (streak >= 3) {
            winningLinesFound.push(i);
            for (let k = streakStart; k < streakStart + streak; k++) {
              winningIndices.add(line[k]);
            }
            let winAmount;
            if (streak === 3) winAmount = betAmount * 0.5;
            else if (streak === 4) winAmount = betAmount * 3;
            else if (streak === 5) winAmount = betAmount * 10;
            if (currentSymbol.toLowerCase() === 'bonus') winAmount *= 2;
            totalWin += winAmount;
            winDetails.push(`${streak} ${currentSymbol} = ${winAmount.toFixed(3)} SOL`);
          }
          currentSymbol = symbolsInLine[j];
          streak = 1;
          streakStart = j;
        }
      }
  
      if (streak >= 3) {
        winningLinesFound.push(i);
        for (let k = streakStart; k < streakStart + streak; k++) {
          winningIndices.add(line[k]);
        }
        let winAmount;
        if (streak === 3) winAmount = betAmount * 0.5;
        else if (streak === 4) winAmount = betAmount * 3;
        else if (streak === 5) winAmount = betAmount * 10;
        if (currentSymbol.toLowerCase() === 'bonus') winAmount *= 2;
        totalWin += winAmount;
        winDetails.push(`${streak} ${currentSymbol} = ${winAmount.toFixed(3)} SOL`);
      }
    }
  
    setWinningLines(winningLinesFound);
    setWinningIndices(Array.from(winningIndices));
  
    if (winningLinesFound.length > 0) {
      setSlotStatus('won');
      let message = `Jackpot! You won ${totalWin.toFixed(3)} SOL!`;
      if (winDetails.length > 1) {
        message += ` (Details: ${winDetails.join(' + ')})`;
      } else if (winDetails.length === 1) {
        message += ` (Details: ${winDetails[0]})`;
      }
      setSlotMessage(message);
  
      try {
        const response = await fetch(`${BACKEND_URL}/distribute-winnings-sol`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerAddress: publicKey.toString(),
            amount: totalWin,
          }),
        });
        const result = await response.json();
        if (result.success) {
          setTriggerWinEffect(true);
          playSound(winAudioRef);
          setPlayerStats(prev => ({
            ...prev,
            totalWinnings: prev.totalWinnings + totalWin,
          }));
        } else {
          setSlotMessage(`You won ${totalWin.toFixed(3)} SOL, but prize distribution failed: ${result.error}. Contact support.`);
        }
      } catch (err) {
        console.error('Prize distribution failed:', err);
        setSlotMessage(`You won ${totalWin.toFixed(3)} SOL, but prize distribution failed. Contact support.`);
      }
    } else {
      setSlotStatus('lost');
      setSlotMessage('No luck this time. Spin again!');
    }
  
    updateMissionProgress(1);
    setPlayerStats(prev => ({
      ...prev,
      spins: prev.spins + 1,
    }));
  };



  // Modifica flipCoin
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

  try {
    const result = await createAndSignTransaction(betAmount, 'coinFlip', { choice });
    setFlipResult(result.flipResult);

    if (choice === result.flipResult) {
      setFlipStatus('won');
      setFlipMessage(`You won ${result.totalWin.toFixed(2)} SOL!`);
      setTriggerWinEffect(true);
      playSound(winAudioRef);
      setPlayerStats(prev => ({
        ...prev,
        wins: prev.wins + 1,
        totalWinnings: prev.totalWinnings + result.totalWin,
      }));
    } else {
      setFlipStatus('lost');
      setFlipMessage('The computer wins! Try again.');
    }
  } catch (err) {
    setFlipMessage(`Flip failed: ${err.message}`);
    setFlipStatus('idle');
  }
};





const WheelComponent = ({ crazyTimeWheel, wheelStatus, wheelResult, rotationAngle }) => {
  const wheelRef = useRef(null);

  useEffect(() => {
    const wheelElement = wheelRef.current;
    if (!wheelElement) return;

    if (wheelStatus === 'spinning') {
      wheelElement.style.transition = 'transform 5s ease-out';
      wheelElement.style.transform = `rotate(${rotationAngle}deg)`;
      console.log('DEBUG - Wheel animation started: spinning', { rotationAngle });
    } else {
      wheelElement.style.transition = 'none';
      wheelElement.style.transform = `rotate(${rotationAngle}deg)`;
      console.log('DEBUG - Wheel animation stopped:', { rotationAngle, wheelStatus });
    }
  }, [wheelStatus, rotationAngle]);

  if (!crazyTimeWheel.length) {
    return <div>Loading wheel...</div>;
  }

  return (
    <div className="wheel-container">
      <svg
        className="wheel"
        ref={wheelRef}
        viewBox="0 0 500 500"
        style={{ transform: `rotate(${rotationAngle}deg)` }}
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
                  dominantBaseline="middle"
                  transform={`rotate(${textAngle}, ${textX}, ${textY})`}
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
      {wheelResult && (
        <div className="wheel-result" style={{ color: wheelResult.color }}>
          Result: {wheelResult.value} ({wheelResult.colorName})
        </div>
      )}
    </div>
  );
};








// Carica crazyTimeWheel all'avvio
useEffect(() => {
  const fetchWheel = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/get-crazy-wheel`);
      if (!response.ok) {
        throw new Error(`Failed to fetch crazyTimeWheel: ${response.status}`);
      }
      const backendResponse = await response.json();
      if (backendResponse.success && backendResponse.wheel?.length) {
        setCrazyTimeWheel(backendResponse.wheel);
        console.log('DEBUG - Loaded crazyTimeWheel:', backendResponse.wheel.slice(0, 5));
      } else {
        throw new Error('Invalid wheel data');
      }
    } catch (err) {
      console.error('Error fetching crazyTimeWheel:', err);
      setWheelMessage('Errore nel caricamento della ruota. Riprova.');
    }
  };
  fetchWheel();
}, []);

// Funzione spinWheel
const spinWheel = async (event) => {
  event.preventDefault();
  if (!connected || !publicKey || !signTransaction) {
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

  // Salva le scommesse attuali come lastBets
  console.log('DEBUG - Saving lastBets:', bets);
  setLastBets({ ...bets });
  // Resetta la cronologia delle scommesse per la nuova rotazione
  console.log('DEBUG - Resetting betHistory');
  setBetHistory([]);

  const betError = validateBet(totalBet);
  if (betError) {
    setWheelMessage(betError);
    addChatMessage(betError);
    return;
  }

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const betInLamports = Math.round(totalBet * LAMPORTS_PER_SOL);
    const userBalance = await connection.getBalance(publicKey);
    if (userBalance < betInLamports) {
      setWheelMessage('Insufficient SOL balance. Add funds and try again.');
      addChatMessage('Insufficient SOL balance. Add funds and try again.');
      return;
    }
  } catch (err) {
    console.error('Error checking SOL balance:', err);
    setWheelMessage('Error checking SOL balance. Try again.');
    addChatMessage('Error checking SOL balance. Try again.');
    return;
  }

  if (!crazyTimeWheel.length) {
    setWheelMessage('Wheel data not loaded. Please try again.');
    addChatMessage('Wheel data not loaded. Please try again.');
    return;
  }

  setWheelStatus('preparing');
  setWheelMessage('Preparing transaction...');
  playSound(spinAudioRef);

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const betInLamports = Math.round(totalBet * LAMPORTS_PER_SOL);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(TAX_WALLET_ADDRESS),
        lamports: betInLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    setWheelMessage('Awaiting wallet approval...');
    const signedTransaction = await signTransaction(transaction);

    setWheelMessage('Sending transaction...');
    const response = await fetch(`${BACKEND_URL}/play-crazy-wheel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress: publicKey.toString(),
        bets,
        signedTransaction: signedTransaction.serialize().toString('base64'),
      }),
    });

    const backendResponse = await response.json();
    console.log('DEBUG - Backend response:', backendResponse);
    if (!backendResponse.success) {
      throw new Error(backendResponse.error || 'Transaction failed');
    }

    setWheelStatus('spinning');
    setWheelMessage('The wheel is spinning... Are you ready?');
    addChatMessage('The wheel is spinning... Are you ready?');

    const betSegments = Object.keys(bets).filter(segment => bets[segment] > 0);
    const topSlotSegment = betSegments[Math.floor(Math.random() * betSegments.length)] || '1';
    const topSlotMultiplier = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
    setTopSlot({ segment: topSlotSegment, multiplier: topSlotMultiplier });
    addChatMessage(`Top Slot: ${topSlotSegment} with multiplier ${topSlotMultiplier}x!`);

    const spins = 5;
    const segmentAngle = 360 / crazyTimeWheel.length;
    const betIndices = crazyTimeWheel
      .map((segment, index) => (betSegments.includes(String(segment.value)) ? index : -1))
      .filter(index => index !== -1);

    let resultIndex;
    if (Math.random() < COMPUTER_WIN_CHANCE.crazyTime) {
      const nonBetIndices = crazyTimeWheel
        .map((segment, index) => (betIndices.includes(index) ? -1 : index))
        .filter(index => index !== -1);
      resultIndex = nonBetIndices.length > 0
        ? nonBetIndices[Math.floor(Math.random() * nonBetIndices.length)]
        : Math.floor(Math.random() * crazyTimeWheel.length);
    } else {
      resultIndex = betIndices.length > 0
        ? betIndices[Math.floor(Math.random() * betIndices.length)]
        : Math.floor(Math.random() * crazyTimeWheel.length);
    }

    const targetAngle = resultIndex * segmentAngle;
    const finalAngle = (spins * 360) + targetAngle + (Math.random() * segmentAngle);
    setRotationAngle(finalAngle);

    await new Promise(resolve => setTimeout(resolve, 5000));

    const normalizedAngle = finalAngle % 360;
    const adjustedAngle = (normalizedAngle - 90 + 360) % 360;
    const winningIndex = (crazyTimeWheel.length - Math.floor(adjustedAngle / segmentAngle) - 1) % crazyTimeWheel.length;
    const wheelResult = crazyTimeWheel[winningIndex];

    if (!wheelResult || !wheelResult.value || !wheelResult.type || !wheelResult.colorName) {
      console.error('DEBUG - Invalid wheel result:', wheelResult, { winningIndex, crazyTimeWheel });
      throw new Error('Invalid wheel result');
    }

    console.log('DEBUG - Wheel result:', {
      segmentAngle,
      finalAngle,
      normalizedAngle,
      adjustedAngle,
      winningIndex,
      result: wheelResult.value,
      color: wheelResult.color,
      colorName: wheelResult.colorName,
    });

    setWheelSegmentIndex(winningIndex);
    setWheelResult(wheelResult);
    setLastResults(prev => [...prev, wheelResult.value].slice(-10));
    addChatMessage(`The wheel stopped on ${wheelResult.value}!`);

    let totalWin = 0;
    let bonusResult = null;
    let bonusMessage = '';

    if (wheelResult.type === 'number') {
      const betOnResult = bets[wheelResult.value] || 0;
      if (betOnResult > 0) {
        let multiplier = parseInt(wheelResult.value);
        let topSlotApplied = String(topSlotSegment) === String(wheelResult.value);
        if (topSlotApplied) {
          multiplier *= topSlotMultiplier;
        }
        totalWin = betOnResult * multiplier;
        setWheelMessage(
          topSlotApplied
            ? `You won ${totalWin.toFixed(2)} SOL with Top Slot ${topSlotMultiplier}x multiplier!`
            : `You won ${totalWin.toFixed(2)} SOL!`
        );
        addChatMessage(
          topSlotApplied
            ? `Great! You won ${totalWin.toFixed(2)} SOL with Top Slot ${topSlotMultiplier}x multiplier!`
            : `Great! You won ${totalWin.toFixed(2)} SOL!`
        );
      } else {
        setWheelMessage('No win this time. Try again!');
        addChatMessage('No win this time. Try again!');
      }
      setWheelStatus('finished');
    } else {
      setWheelStatus('bonus');
      addChatMessage(`You triggered the ${wheelResult.value} bonus round!`);

      if (wheelResult.value === 'Coin Flip') {
        const redMultiplier = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
        const blueMultiplier = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
        const side = Math.random() < 0.5 ? 'red' : 'blue';
        let multiplier = side === 'red' ? redMultiplier : blueMultiplier;
        let topSlotApplied = String(topSlotSegment) === 'Coin Flip';
        if (topSlotApplied) multiplier *= topSlotMultiplier;
        bonusResult = { type: 'Coin Flip', side, redMultiplier, blueMultiplier, multiplier };
        const betOnBonus = bets['Coin Flip'] || 0;
        if (betOnBonus > 0) {
          totalWin = betOnBonus * multiplier;
          bonusMessage = topSlotApplied
            ? `Coin Flip: ${side} wins! You won ${totalWin.toFixed(2)} SOL with Top Slot ${topSlotMultiplier}x multiplier!`
            : `Coin Flip: ${side} wins! You won ${totalWin.toFixed(2)} SOL!`;
        } else {
          bonusMessage = 'You accessed Coin Flip, but did not bet on it.';
        }
      } else if (wheelResult.value === 'Pachinko') {
        const multipliers = [2, 3, 5, 10, 20];
        const slotIndex = Math.floor(Math.random() * multipliers.length);
        let multiplier = multipliers[slotIndex];
        let topSlotApplied = String(topSlotSegment) === 'Pachinko';
        if (topSlotApplied) multiplier *= topSlotMultiplier;
        bonusResult = { type: 'Pachinko', slotIndex, multiplier };
        const betOnBonus = bets['Pachinko'] || 0;
        if (betOnBonus > 0) {
          totalWin = betOnBonus * multiplier;
          bonusMessage = topSlotApplied
            ? `Pachinko: You won ${totalWin.toFixed(2)} SOL with Top Slot ${topSlotMultiplier}x multiplier!`
            : `Pachinko: You won ${totalWin.toFixed(2)} SOL!`;
        } else {
          bonusMessage = 'You accessed Pachinko, but did not bet on it.';
        }
      } else if (wheelResult.value === 'Cash Hunt') {
        const multipliers = Array(10).fill().map(() => Math.floor(Math.random() * 50) + 1);
        const chosenMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
        let multiplier = chosenMultiplier;
        let topSlotApplied = String(topSlotSegment) === 'Cash Hunt';
        if (topSlotApplied) multiplier *= topSlotMultiplier;
        bonusResult = { type: 'Cash Hunt', multipliers, chosenMultiplier, multiplier };
        const betOnBonus = bets['Cash Hunt'] || 0;
        if (betOnBonus > 0) {
          totalWin = betOnBonus * multiplier;
          bonusMessage = topSlotApplied
            ? `Cash Hunt: You won ${totalWin.toFixed(2)} SOL with Top Slot ${topSlotMultiplier}x multiplier!`
            : `Cash Hunt: You won ${totalWin.toFixed(2)} SOL!`;
        } else {
          bonusMessage = 'You accessed Cash Hunt, but did not bet on it.';
        }
      } else if (wheelResult.value === 'Crazy Time') {
        const multipliers = [10, 20, 50, 100, 200];
        const chosenMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
        let multiplier = chosenMultiplier;
        let topSlotApplied = String(topSlotSegment) === 'Crazy Time';
        if (topSlotApplied) multiplier *= topSlotMultiplier;
        bonusResult = { type: 'Crazy Time', multiplier };
        const betOnBonus = bets['Crazy Time'] || 0;
        if (betOnBonus > 0) {
          totalWin = betOnBonus * multiplier;
          bonusMessage = topSlotApplied
            ? `Crazy Time: You won ${totalWin.toFixed(2)} SOL with Top Slot ${topSlotMultiplier}x multiplier!`
            : `Crazy Time: You won ${totalWin.toFixed(2)} SOL!`;
        } else {
          bonusMessage = 'You accessed Crazy Time, but did not bet on it.';
        }
      }

      setBonusResult(bonusResult);
      setWheelMessage(bonusMessage);
      addChatMessage(bonusMessage);
    }

    if (totalWin > 0) {
      try {
        const response = await fetch(`${BACKEND_URL}/distribute-winnings-sol`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress: publicKey.toString(),
            amount: totalWin,
          }),
        });
        const winResponse = await response.json();
        if (winResponse.success) {
          setTriggerWinEffect(true);
          playSound(winAudioRef);
          setPlayerStats(prev => ({
            ...prev,
            totalWinnings: prev.totalWinnings + totalWin,
          }));
        } else {
          setWheelMessage(`You won ${totalWin.toFixed(2)} SOL, but prize distribution failed: ${winResponse.error}. Contact support.`);
          addChatMessage('Prize distribution failed. Contact support.');
        }
      } catch (err) {
        console.error('Prize distribution failed:', err);
        setWheelMessage(`You won ${totalWin.toFixed(2)} SOL, but prize distribution failed. Contact support.`);
        addChatMessage('Prize distribution failed. Contact support.');
      }
    }

    updateMissionProgress(3);
    setPlayerStats(prev => ({
      ...prev,
      spins: prev.spins + 1,
    }));
  } catch (err) {
    console.error('Spin failed:', err);
    setWheelMessage(`Spin failed: ${err.message}. Try again.`);
    addChatMessage('Spin failed. Try again!');
    setWheelStatus('idle');
  }
};
 


  const addChatMessage = (message) => {
    setChatMessages(prev => [...prev, message].slice(-10));
  };
  
  const handleBetSelection = (segment, event) => {
    event.preventDefault();
    setBets(prev => {
      const newBets = {
        ...prev,
        [segment]: prev[segment] + betAmount,
      };
      // Aggiungi la scommessa alla cronologia
      setBetHistory(prevHistory => [...prevHistory, { segment, amount: betAmount }]);
      return newBets;
    });
  };

  
  const cancelLastBet = () => {
    console.log('DEBUG - cancelLastBet called, betHistory:', betHistory);
    if (betHistory.length === 0) {
      setWheelMessage('No bets to cancel!');
      addChatMessage('No bets to cancel!');
      return;
    }
    const lastBet = betHistory[betHistory.length - 1];
    setBets(prev => {
      const newBets = {
        ...prev,
        [lastBet.segment]: Math.max(prev[lastBet.segment] - lastBet.amount, 0),
      };
      console.log('DEBUG - New bets after cancel:', newBets);
      return newBets;
    });
    setBetHistory(prev => prev.slice(0, -1));
    setWheelMessage(`Cancelled last bet on ${lastBet.segment} (${lastBet.amount.toFixed(2)} SOL)`);
    addChatMessage(`Cancelled last bet on ${lastBet.segment} (${lastBet.amount.toFixed(2)} SOL)`);
  };
  
  const repeatLastBet = async () => {
    console.log('DEBUG - repeatLastBet called, lastBets:', lastBets, 'wheelStatus:', wheelStatus);
    if (!lastBets) {
      setWheelMessage('No previous bets to repeat!');
      addChatMessage('No previous bets to repeat!');
      return;
    }
  
    const totalRepeatBet = Object.values(lastBets).reduce((sum, bet) => sum + bet, 0);
    console.log('DEBUG - Total repeat bet:', totalRepeatBet);
    if (totalRepeatBet <= 0) {
      setWheelMessage('Previous bet was invalid!');
      addChatMessage('Previous bet was invalid!');
      return;
    }
  
    // Verifica il saldo SOL
    try {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const betInLamports = Math.round(totalRepeatBet * LAMPORTS_PER_SOL);
      const userBalance = await connection.getBalance(publicKey);
      console.log('DEBUG - User balance:', userBalance, 'Required:', betInLamports);
      if (userBalance < betInLamports) {
        setWheelMessage('Insufficient SOL balance to repeat bet. Add funds and try again.');
        addChatMessage('Insufficient SOL balance to repeat bet. Add funds and try again.');
        return;
      }
    } catch (err) {
      console.error('Error checking SOL balance:', err);
      setWheelMessage('Error checking SOL balance. Try again.');
      addChatMessage('Error checking SOL balance. Try again.');
      return;
    }
  
    // Applica le scommesse precedenti
    setBets({ ...lastBets });
    setBetHistory(prev => {
      const newHistory = [
        ...prev,
        ...Object.entries(lastBets)
          .filter(([_, amount]) => amount > 0)
          .map(([segment, amount]) => ({ segment, amount })),
      ];
      console.log('DEBUG - New betHistory:', newHistory);
      return newHistory;
    });
  
    setWheelMessage('Repeating last bet and spinning...');
    addChatMessage('Repeating last bet and spinning...');
  
    // Avvia immediatamente la rotazione
    await spinWheel({ preventDefault: () => {} }); // Simula un evento per spinWheel
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

      {showWinImage && (
  <div className="win-image-container">
    {console.log('DEBUG - Rendering win image')}
    <img
      src="/assets/win-image.png"
      alt="You Win!"
      className="win-image"
      onError={(e) => console.error('DEBUG - Win image failed to load:', e)}
      onLoad={() => console.log('DEBUG - Win image loaded successfully')}
    />
  </div>
)}

      {/* Header fisso in alto con solo la GIF */}
      <header className="flex justify-center items-center m-0 p-0">
        <img
          src="/assets/footer-gif.gif"
          alt="Header Animation"
          className="object-contain m-0 p-0 -ml-4" // Manteniamo lo spostamento a sinistra
          style={{ height: '64px', width: 'auto', marginLeft: '-20px' }} // Sposta di 20px a sinistra
        />
      </header>

         {/* Pulsante per controllare la musica (più piccolo) */}
         <div className="flex justify-end mt-4 mb-4">
  <button
    onClick={toggleMusic}
    className="casino-button text-xs py-0.5 px-1"
  >
    {isMusicPlaying ? 'Mute Music' : 'Play Music'}
  </button>
</div>

      {/* Aggiungiamo un margine superiore al contenuto per evitare sovrapposizioni */}
        {loading ? (
          <p className="text-center text-orange-700 animate-pulse text-2xl">.</p>
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

            {/* Pulsanti Show Info e Sync Data separati */}
            <div className="flex justify-center gap-6 mb-6">
  <button
    onClick={() => setShowInfo(!showInfo)}
    className="w-32 casino-button"
  >
    {showInfo ? 'Hide Info' : 'Show Info'}
  </button>
  <button
    onClick={async () => {
      await fetchRewardsData();
      // Forza un aggiornamento dello stato invece di ricaricare la pagina
      setTaxWalletBalance(prev => prev);
      setRewardSol(prev => prev);
      setRewardWbtc(prev => prev);
      setRewardWeth(prev => prev);
      setHolders(prev => [...prev]);
      setUserRewards(prev => ({ ...prev }));
      console.log('DEBUG - Data synced without reload');
    }}
    className="w-32 casino-button"
  >
    Sync Data
  </button>
</div>

          {/* Tabelle collassabili */}
          {showInfo && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
    <div className="game-box p-6">
      <p className="text-lg text-orange-700">Tax Wallet Balance</p>
      <p className="text-2xl font-bold text-orange-700">{taxWalletBalance.toFixed(4)} SOL</p>
    </div>
    <div className="game-box p-6">
      <p className="text-lg text-orange-700">SOL Rewards (Latest)</p>
      <p className="text-2xl font-bold text-orange-700">{rewardSol.toFixed(4)} SOL</p>
      <p className="text-lg text-orange-700">Total Accumulated: {accumulatedRewards.sol.toFixed(4)} SOL</p>
    </div>
    <div className="game-box p-6">
      <p className="text-lg text-orange-700">WBTC Rewards (Latest)</p>
      <p className="text-2xl font-bold text-orange-700">{rewardWbtc.toFixed(8)} WBTC</p>
      <p className="text-lg text-orange-700">Total Accumulated: {accumulatedRewards.wbtc.toFixed(8)} WBTC</p>
    </div>
    <div className="game-box p-6">
      <p className="text-lg text-orange-700">WETH Rewards (Latest)</p>
      <p className="text-2xl font-bold text-orange-700">{rewardWeth.toFixed(8)} WETH</p>
      <p className="text-lg text-orange-700">Total Accumulated: {accumulatedRewards.weth.toFixed(8)} WETH</p>
    </div>
  </div>
)}
      
  
        {/* Pulsante Holders accorciato e centrato */}
        <div className="flex justify-center mb-6">
          <button onClick={toggleHolders} className="w-32 casino-button">
            {showHolders ? 'Hide Holders' : 'Show Holders'}
          </button>
        </div>
  
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
                        <th className="p-4 text-lg">Total Winnings (COM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((player, index) => (
                        <tr key={index} className="border-t border-gray-600 hover:bg-gray-600 transition-all">
                          <td className="p-4 text-gray-200">{index + 1}</td>
                          <td className="p-4 text-gray-200 font-mono">{player.address.slice(0, 8)}...</td>
                          <td className="p-4 text-green-400">{player.totalWinnings.toFixed(2)} COM </td>
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
                className="mb-20" // Aggiunto margine inferiore
/>
              

{/* Nuova sezione per Contract e Social Links con più spazio sopra */}
<div className="game-box p-6 mt-30 mb-10 max-w-lg mx-auto"> {/* Aumentato da mt-10 a mt-20 */}
      <div className="flex justify-center mb-4">
        <p className="text-lg text-orange-700">
          Contract: <span className="text-cyan-400">TBA (To Be Announced)</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-20 justify-center">
        <a
          href="https://t.me/Casinofmeme" // Sostituisci con il tuo link
          target="_blank"
          rel="noopener noreferrer"
          className="casino-button w-24 mx-6 text-center"
        >
          Telegram
        </a>
        <a
          href="https://x.com/CasinofmemeSOL" // Sostituisci con il tuo link
          target="_blank"
          rel="noopener noreferrer"
          className="casino-button w-24 mx-6 text-center"
        >
          Twitter
        </a>
        <a
          href="https://www.dextools.io/app/your-pair" // Sostituisci con il tuo link
          target="_blank"
          rel="noopener noreferrer"
          className="casino-button w-24 mx-6 text-center"
        >
          Dextools
        </a>
        <a
          href="https://casinoofmemes-organization.gitbook.io/thesolanacasino" // Sostituisci con il tuo link
          target="_blank"
          rel="noopener noreferrer"
          className="casino-button w-24 mx-6 text-center"
        >
          Gitbook
        </a>
      </div>
    </div>
  </>
) : (

          
            <>
          {selectedGame === 'Solana Card Duel' && (
  <div>
    <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
      Blackjack
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
        <p className="text-lg text-orange-700 mb-2 text-center">Dealer Cards:</p>
        <div className="flex gap-4 justify-center">
          {opponentCards.map((card, index) => {
            const isVisible = gameStatus === 'finished' || index === 0; // Solo la prima carta è visibile inizialmente
            return (
              <div
                key={index}
                className="card"
                style={{
                  backgroundImage: isVisible ? `url(${card.image})` : `url(${CARD_BACK_IMAGE})`,
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
            Dealer Score: {calculateScore(opponentCards)}
          </p>
        )}
      </div>
      <p className="text-center text-orange-700 mb-4 text-lg">{gameMessage}</p>
      {gameStatus === 'idle' ? (
        <button
          onClick={startBlackjack}
          className="w-full casino-button"
          disabled={!!betError}
        >
          Start Blackjack (Bet {betAmount.toFixed(2)} SOL)
        </button>
      ) : gameStatus === 'playing' ? (
        <div className="flex gap-4">
          <button onClick={hit} className="flex-1 casino-button">
            Hit
          </button>
          <button onClick={stand} className="flex-1 casino-button">
            Stand
          </button>
        </div>
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
    <div className="game-box p-6 mb-10 flex flex-row gap-6">
      {/* Griglia della slot machine */}
      <div className={`slot-machine ${slotStatus === 'won' ? 'winning' : ''}`}>
        <div className="grid grid-cols-5 gap-1">
          {slotReelsDisplay.map((meme, index) => {
            console.log(`DEBUG - Rendering slotReelsDisplay[${index}]: ${meme ? meme.name : 'null'}`);
            return (
              <div
                key={index}
                className={`slot-reel ${slotStatus === 'spinning' ? 'spinning' : ''} ${isStopping && slotReelsDisplay[index] === slotReelsDisplay[index] ? 'stopping' : ''} ${winningIndices.includes(index) ? 'winning' : ''}`}
                style={{
                  backgroundImage: meme && meme.image ? `url(${meme.image})` : 'none',
                  backgroundColor: !meme ? '#333' : 'transparent',
                }}
              >
                {!meme && <span className="text-white">?</span>}
              </div>
            );
          })}
        </div>
      </div>
      {/* Tabella dei pagamenti */}
      <div className="payout-table bg-gray-800 rounded-lg p-4 text-orange-700">
        <h3 className="text-xl font-bold mb-4">Payouts</h3>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-700 text-cyan-400">
              <th className="p-2">Symbols</th>
              <th className="p-2">Payout</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-600">
              <td className="p-2">3 Symbols</td>
              <td className="p-2">0.5x Bet</td>
            </tr>
            <tr className="border-t border-gray-600">
              <td className="p-2">4 Symbols</td>
              <td className="p-2">3x Bet</td>
            </tr>
            <tr className="border-t border-gray-600">
              <td className="p-2">5 Symbols</td>
              <td className="p-2">10x Bet</td>
            </tr>
            <tr className="border-t border-gray-600">
              <td className="p-2">BONUS</td>
              <td className="p-2">Doubles the Win</td>
            </tr>
          </tbody>
        </table>
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
    <div className="game-box p-6 mb-10">
      {/* Log per debug */}
      {console.log({
        waitingPlayersList,
        pokerStatus,
        pokerPlayers,
        publicKey: publicKey?.toString(),
        socketId: socket.id,
        minBet,
      })}

        {/* Pulsante Leave Table */}
        {pokerStatus === 'waiting' && waitingPlayersList.some(p => p.address === publicKey?.toString()) && (
        <button
          onClick={() => socket.emit('leaveWaitingList', { playerAddress: publicKey.toString() })}
          className="w-full casino-button mb-2"
        >
          Leave Table
        </button>
      )}

      {/* Input per la puntata (visibile sempre in stato 'waiting') */}
      {pokerStatus === 'waiting' && (
  <div className="text-center mb-6">
    <label className="text-lg text-orange-700 mr-2">Bet Amount (COM):</label>
    <input
      type="number"
      step="1000"
      value={betAmount}
      onChange={handleBetChange}
      className="bet-input"
      placeholder={`Enter bet (min ${minBet.toFixed(2)} COM)`}
      min={minBet} // Imposta il valore minimo dell'input
      disabled={pokerStatus !== 'waiting'}
    />
    <p className="text-sm text-orange-700 mt-2">
      Minimum Bet: {minBet.toFixed(2)} COM
    </p>
    {betError && <p className="bet-error">{betError}</p>}
    <p className="text-sm text-orange-700 mt-2">
      Your COM Balance: {comBalance.toFixed(2)} COM {console.log(`COM Balance: ${comBalance} COM`)}
    </p>
  </div>
)}

      {/* Lista dei giocatori in attesa */}
      {waitingPlayersList.length > 0 && pokerStatus === 'waiting' ? (
        <div className="mb-6">
          <p className="text-lg text-orange-700 mb-2 text-center">Players Waiting:</p>
          <ul className="text-center">
            {waitingPlayersList.map((player, index) => (
              <li key={index} className="text-orange-700">
                {player.address.slice(0, 8)}... (Bet: {player.bet.toFixed(2)} COM)
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-center text-orange-700 mb-4">
          {pokerStatus === 'waiting' ? 'No players waiting yet...' : 'Game status: ' + pokerStatus}
        </p>
      )}

      {/* Dettagli del gioco (visibile solo quando ci sono giocatori al tavolo) */}
      {pokerPlayers.length > 0 && publicKey ? (
        <>
          {/* Informazioni sui giocatori al tavolo */}
          <div className="mb-6">
            <p className="text-lg text-orange-700 mb-2 text-center">Players at Table:</p>
            <ul className="text-center">
              {pokerPlayers.map((player, index) => (
                <li key={index} className="text-orange-700">
                  {player.address.slice(0, 8)}... (Bet: {player.bet.toFixed(2)} COM)
                </li>
              ))}
            </ul>
          </div>

          {/* Pot e puntata corrente */}
          <p className="text-lg text-orange-700 mb-2 text-center">
            Pot: {pokerPot ? pokerPot.toFixed(2) : '0.00'} COM
          </p>
          <p className="text-lg text-orange-700 mb-2 text-center">
            Current Bet: {currentBet ? currentBet.toFixed(2) : '0.00'} COM
          </p>

          {/* Carte comuni */}
          <p className="text-lg text-orange-700 mb-2 text-center">Community Cards:</p>
          <div className="flex gap-4 justify-center">
            {pokerTableCards && pokerTableCards.length > 0 ? (
              pokerTableCards.map((card, index) => (
                <div
                  key={index}
                  className="card"
                  style={{
                    backgroundImage: card.image ? `url(${card.image})` : 'none',
                    backgroundSize: 'cover',
                    width: '100px',
                    height: '140px',
                    backgroundColor: !card.image ? '#333' : 'transparent',
                  }}
                />
              ))
            ) : (
              <p className="text-orange-700">No community cards yet</p>
            )}
          </div>

          {/* Carte del giocatore */}
          <p className="text-lg text-orange-700 mb-2 text-center">Your Cards:</p>
          <div className="flex gap-4 justify-center">
            {pokerPlayerCards[publicKey.toString()] &&
            pokerPlayerCards[publicKey.toString()].length > 0 ? (
              pokerPlayerCards[publicKey.toString()].map((card, index) => (
                <div
                  key={index}
                  className="card"
                  style={{
                    backgroundImage: card.image ? `url(${card.image})` : 'none',
                    backgroundSize: 'cover',
                    width: '100px',
                    height: '140px',
                    backgroundColor: !card.image ? '#333' : 'transparent',
                  }}
                />
              ))
            ) : (
              <p className="text-orange-700">No cards assigned yet</p>
            )}
          </div>

          {/* Carte dell'avversario */}
          <p className="text-lg text-orange-700 mb-2 text-center">Opponent's Cards:</p>
          <div className="flex gap-4 justify-center">
            {(() => {
              const opponent = pokerPlayers.find(p => p.address !== publicKey.toString());
              if (!opponent || !pokerPlayerCards[opponent?.address]) {
                return <p className="text-orange-700">No opponent cards available</p>;
              }
              return pokerPlayerCards[opponent.address].map((card, index) => (
                <div
                  key={index}
                  className="card"
                  style={{
                    backgroundImage: opponentCardsVisible && card.image
                      ? `url(${card.image})`
                      : `url(${CARD_BACK_IMAGE})`,
                    backgroundSize: 'cover',
                    width: '100px',
                    height: '140px',
                  }}
                />
              ));
            })()}
          </div>

          {/* Messaggi di stato */}
          <p className="text-center text-orange-700 mb-4 text-lg">
            {pokerMessage || 'Waiting for game state...'}
          </p>
          {dealerMessage && (
            <p className="text-center text-orange-700 mb-4 text-lg font-bold">{dealerMessage}</p>
          )}
          {pokerStatus === 'playing' && (
            <p className="text-center text-orange-700 mb-4 text-lg font-bold">
              Time Left: {timeLeft} seconds
            </p>
          )}

          {/* Controlli di gioco */}
          {pokerStatus === 'playing' && currentTurn === socket.id && (
            <div className="flex flex-col gap-4">
              {currentBet > (playerBets[publicKey.toString()] || 0) && (
                <p className="text-center text-orange-700 mb-4 text-lg font-bold">
                  You placed a bet. Click "Check" to pass the turn to your opponent.
                </p>
              )}
              <div className="flex gap-4">
                {currentBet > (playerBets[publicKey.toString()] || 0) ? (
                  <button
                    onClick={() => makePokerMove('call')}
                    className="flex-1 casino-button"
                    disabled={comBalance < currentBet - (playerBets[publicKey.toString()] || 0)}
                  >
                    Call ({(currentBet - (playerBets[publicKey.toString()] || 0)).toFixed(2)} COM)
                  </button>
                ) : (
                  <button
                    onClick={() => makePokerMove('check')}
                    className="flex-1 casino-button"
                  >
                    Check
                  </button>
                )}
                <button
                  onClick={() => makePokerMove('fold')}
                  className="flex-1 casino-button"
                >
                  Fold
                </button>
              </div>
              <div className="flex gap-4">
                <input
                  type="number"
                  step="0.01"
                  min={minBet}
                  max="1000"
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(parseFloat(e.target.value) || 0)}
                  className="bet-input flex-1"
                  placeholder="Bet/Raise Amount (COM)"
                />
                <button
                  onClick={() => makePokerMove('bet', raiseAmount)}
                  className="flex-1 casino-button"
                  disabled={raiseAmount < minBet || comBalance < raiseAmount}
                >
                  Bet
                </button>
                <button
                  onClick={() => makePokerMove('raise', raiseAmount)}
                  className="flex-1 casino-button"
                  disabled={raiseAmount < minBet || comBalance < raiseAmount}
                >
                  Raise
                </button>
              </div>
            </div>
          )}
          {pokerStatus === 'playing' && currentTurn !== socket.id && (
            <p className="text-center text-orange-700">
              Opponent's turn... (Time Left: {timeLeft} seconds)
            </p>
          )}
          {pokerStatus === 'finished' && (
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
              Play Again (Bet {betAmount.toFixed(2)} COM)
            </button>
          )}
        </>
      ) : (
        <p className="text-center text-orange-700 mb-4">
          {publicKey ? 'No players in game yet...' : 'Please connect your wallet to play!'}
        </p>
      )}

      {/* Pulsante "Join Game" visibile in stato 'waiting' */}
      {pokerStatus === 'waiting' && (
        <button
          onClick={joinPokerGame}
          className="w-full casino-button mb-4"
          disabled={!!betError || !publicKey || comBalance < betAmount}
        >
          Join Game (Bet {betAmount.toFixed(2)} COM)
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
         

             
{selectedGame === 'Crazy Wheel' && (
                <div>
                  <h2 className="text-5xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
                    Crazy Wheel
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
    className="wheel"
    style={{
      transform: `rotate(${rotationAngle}deg)`,
      transition: wheelStatus === 'spinning' ? 'transform 5s ease-out' : 'none',
    }}
    viewBox="0 0 500 500" // Mantieni il viewBox per proporzioni
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
                                      dominantBaseline="middle"
                                      transform={`rotate(${textAngle}, ${textX}, ${textY})`} // Ruota il testo per allinearlo radialmente
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
        type="button"
        onClick={(e) => handleBetSelection(segment, e)}
        onTouchStart={(e) => e.preventDefault()}
        className="casino-button"
        style={{
          background: bets[segment] > 0 ? 'linear-gradient(135deg, #00ff00, #008000)' : '',
        }}
      >
        {segment} (Bet: {bets[segment].toFixed(2)} SOL)
      </button>
    ))}
  </div>
  {/* Nuovi pulsanti */}
  <div className="flex gap-4 justify-center mt-4">
    <button
      onClick={cancelLastBet}
      className="casino-button"
      disabled={wheelStatus !== 'idle' || betHistory.length === 0}
    >
      Cancel Last Bet
    </button>
    <button
      onClick={repeatLastBet}
      className="casino-button"
      disabled={wheelStatus !== 'idle' || !lastBets || Object.values(lastBets).every(bet => bet === 0)}
    >
      Repeat Last Spin
    </button>
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
    setBetHistory([]); // Resetta la cronologia
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