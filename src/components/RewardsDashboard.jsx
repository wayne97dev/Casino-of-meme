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


const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');




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
  transports: ['websocket'],
  forceNew: false,
});

// Aggiungi log per WebSocket
socket.on('connect', () => {
  console.log('DEBUG - Socket connected:', socket.id);
});
socket.on('connect_error', (err) => {
  console.error('DEBUG - Socket connection error:', err.message);
});

// Percentuale di vittoria del computer per ogni minigioco
const COMPUTER_WIN_CHANCE = {
  cardDuel: 0.97,
  memeSlots: 0.90,
  coinFlip: 0.6,
  crazyTime: 0.93,
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



const SlotMachine = ({ position, gameName, onClick }) => {
  const group = useRef();
  const { scene, animations } = useGLTF('/models/slot-machine.glb'); // Sostituisci con il percorso del tuo file GLB
  const { actions, names } = useAnimations(animations, group);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        // Clona il materiale esistente per evitare modifiche condivise
        child.material = child.material.clone();
        // Applica proprietà aggiuntive per l'effetto hover
        child.material.side = THREE.DoubleSide;
        child.material.roughness = 0.5;
        child.material.metalness = 0.5;
        child.material.emissive = hovered ? new THREE.Color(0xff0000) : new THREE.Color(0x000000);
        child.material.emissiveIntensity = hovered ? 0.5 : 0;
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene, hovered]);

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
      <primitive object={scene} scale={[3.5, 3.5, 3.5]} />
      <Text
        position={[0, 1.5, 3]}
        fontSize={1.3}
        color={hovered ? 'yellow' : 'red'}
        anchorX='center'
        anchorY='middle'
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
  const { scene, animations } = useGLTF('/models/crazytime-wheel.glb'); // Sostituisci con il percorso del tuo file GLB
  const { actions, names } = useAnimations(animations, group);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        // Clona il materiale esistente per evitare modifiche condivise
        child.material = child.material.clone();
        // Applica proprietà aggiuntive per l'effetto hover
        child.material.side = THREE.DoubleSide;
        child.material.roughness = 0.7;
        child.material.metalness = 0.1;
        child.material.emissive = hovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000);
        child.material.emissiveIntensity = hovered ? 0.5 : 0;
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene, hovered]);

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
      <primitive object={scene} scale={[2.5, 2.5, 2.5]} />
      <Text
        position={[0, 1, 1]}
        fontSize={1.3}
        color={hovered ? 'yellow' : 'red'}
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
  const { scene } = useGLTF('/models/tavolo_poker.glb'); // Carica il file GLB
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        // Mantieni la texture incorporata nel GLB, modifica solo emissive per l'effetto hover
        child.material = child.material.clone(); // Clona il materiale per evitare modifiche condivise
        child.material.emissive = hovered ? new THREE.Color(0xff00ff) : new THREE.Color(0x000000);
        child.material.emissiveIntensity = hovered ? 0.5 : 0;
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene, hovered]);



  return (
    <group
      ref={group}
      position={position}
      onClick={() => onSelectGame('Poker PvP')}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={scene} scale={[0.35, 0.35, 0.35]} />
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
  const fbx = useFBX('/models/casino-sign-with-bulb.fbx');

  useEffect(() => {
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#ffd700', // Corretto da ##ffd700
          emissive: '#ffd700', // Corretto da ##ffd700
          emissiveIntensity: 0.6,
          roughness: 0.4,
          metalness: 0.7,
        });
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [fbx]);

  return (
    <group ref={group} position={position}>
      <primitive object={fbx} scale={[0.035, 0.035, 0.035]} />
      <pointLight color="#ffd700" intensity={3} distance={15} position={[0, 1, 0.5]} /> {/* Corretto */}
      <pointLight color="#ffd700" intensity={2} distance={10} position={[-2, 0, 0.5]} /> {/* Corretto */}
      <pointLight color="#ffd700" intensity={2} distance={10} position={[2, 0, 0.5]} /> {/* Corretto */}
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



// Sottocomponente per la logica della scena
const SceneContent = ({ onSelectGame, croupierAnimation, setCroupierAnimation, triggerWinEffect, isMobile, isFullscreen }) => {
  const { camera, gl, invalidate, scene, raycaster, mouse } = useThree();
  const [showParticles, setShowParticles] = useState(false);
  const [winLightColor, setWinLightColor] = useState(new THREE.Color('red'));
  const [trumpAnimation, setTrumpAnimation] = useState('Idle');
  const [isFloorReady, setIsFloorReady] = useState(false);
  const containerRef = useRef(null);
  const orbitControlsRef = useRef(null);

  // Funzione di debouncing per limitare gli aggiornamenti
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Aggiorna il renderer quando cambia la dimensione del canvas
  useEffect(() => {
    const handleResize = debounce(() => {
      if (!isFullscreen && (!containerRef.current || !containerRef.current.clientWidth)) {
        console.warn('DEBUG - containerRef.current non disponibile per il calcolo delle dimensioni');
        return;
      }
  
      const width = isFullscreen ? window.innerWidth : containerRef.current.clientWidth;
      const height = isFullscreen ? window.innerHeight : containerRef.current.clientHeight;
      console.log('DEBUG - Resizing renderer:', { width, height, isFullscreen });
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      gl.setSize(width, height);
      invalidate();
    }, 100);
  
    // Esegui il resize solo dopo che containerRef è pronto
    if (containerRef.current) {
      handleResize();
      window.addEventListener('resize', handleResize);
      document.addEventListener('fullscreenchange', handleResize);
    }
  
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [isMobile, isFullscreen, camera, gl, invalidate, containerRef.current]);

  // Parte del pavimento invariata
  const brickTexture = useLoader(THREE.TextureLoader, '/models/textures/red_brick_seamless.jpg');
  const brickNormalTexture = useLoader(THREE.TextureLoader, '/models/textures/red_brick_seamless.jpg');
  const floorMaterialRef = useRef(new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.1,
  }));

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
    console.log('DEBUG - Game selected:', game, 'Timestamp:', Date.now());
    setCroupierAnimation('Wave');
    setTrumpAnimation('Wave');
    onSelectGame(game);
    setTimeout(() => {
      setTrumpAnimation('Idle');
    }, 2000);
  };

  // Gestione del raycasting per i clic sugli oggetti 3D
  const interactiveObjects = useRef([]);
  const raycasterRef = useRef(raycaster);
  const mouseRef = useRef(mouse);

  // Registra gli oggetti interattivi
  const registerInteractiveObject = (ref, game) => {
    if (ref.current && !interactiveObjects.current.some(obj => obj.ref === ref.current)) {
      const objects = [];
      ref.current.traverse((child) => {
        if (child.isMesh) {
          objects.push(child);
        }
      });
      interactiveObjects.current.push({ ref: ref.current, game, meshes: objects });
      console.log('DEBUG - Registered interactive object:', game, objects.length, 'meshes', objects.map(m => m.name));
    }
  };

  // Gestore degli eventi touch e click
  useEffect(() => {
    let touchStartTime = 0;
    let touchMoved = false;
      const handleClick = (event) => {
        // Rimuovi event.preventDefault() se non strettamente necessario
        console.log('DEBUG - Canvas clicked', Date.now(), 'Event type:', event.type, 'Coordinates:', {
          clientX: event.clientX,
          clientY: event.clientY,
        });
    
        const rect = gl.domElement.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        console.log('DEBUG - Normalized mouse coordinates:', {
          x: mouseRef.current.x,
          y: mouseRef.current.y,
          rect
        });
    
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(
          interactiveObjects.current.flatMap(obj => obj.meshes),
          true
        );
        console.log('DEBUG - Click raycast intersects:', intersects.length, intersects.map(i => i.object.name));
    
        if (intersects.length > 0) {
          const intersectedObject = intersects[0].object;
          const target = interactiveObjects.current.find(obj =>
            obj.meshes.includes(intersectedObject)
          );
          if (target) {
            console.log('DEBUG - Click intersected object:', target.game, Date.now());
            handleSelectGame(target.game);
            if (!isMobile && orbitControlsRef.current) {
              orbitControlsRef.current.enabled = false;
              setTimeout(() => {
                orbitControlsRef.current.enabled = true;
              }, 100);
            }
          }
        }
      };
    
      // Configura come non passivo se preventDefault è necessario
      gl.domElement.addEventListener('click', handleClick, { passive: false });

  
    const handleTouchStart = (event) => {
      console.log('DEBUG - Canvas touch started', Date.now(), 'Touches:', event.touches.length, 'Target:', event.target.tagName);
      touchStartTime = Date.now();
      touchMoved = false;
  
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        const rect = gl.domElement.getBoundingClientRect();
        mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        console.log('DEBUG - Normalized touch coordinates:', {
          x: mouseRef.current.x,
          y: mouseRef.current.y,
          clientX: touch.clientX,
          clientY: touch.clientY,
          rect
        });
      } else if (event.touches.length === 2) {
        console.log('DEBUG - Pinch-to-zoom detected', Date.now());
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true;
        }
      }
    };
  
    const handleTouchMove = (event) => {
      touchMoved = true;
      // Non chiamare preventDefault per consentire lo scroll
      console.log('DEBUG - Touch move detected, allowing scroll', Date.now());
    };
  
    const handleTouchEnd = (event) => {
      console.log('DEBUG - Canvas touch ended', Date.now());
      const touchDuration = Date.now() - touchStartTime;
  
      if (event.changedTouches.length === 1 && !touchMoved && touchDuration < 300) {
        console.log('DEBUG - Short single touch, performing raycast', Date.now());
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(
          interactiveObjects.current.flatMap(obj => obj.meshes),
          true
        );
        console.log('DEBUG - Touch raycast intersects:', intersects.length, intersects.map(i => i.object.name));
  
        if (intersects.length > 0) {
          const intersectedObject = intersects[0].object;
          const target = interactiveObjects.current.find(obj =>
            obj.meshes.includes(intersectedObject)
          );
          if (target) {
            console.log('DEBUG - Touch intersected object:', target.game, Date.now());
            handleSelectGame(target.game);
          }
        }
      }
  
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = true;
      }
    };
  
    gl.domElement.addEventListener('click', handleClick, { passive: true });
    gl.domElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    gl.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    gl.domElement.addEventListener('touchend', handleTouchEnd, { passive: true });
  
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      gl.domElement.removeEventListener('touchmove', handleTouchMove);
      gl.domElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl, camera, handleSelectGame, isMobile]);


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

  // Riferimenti per gli oggetti interattivi
  const pokerCardRef = useRef();
  const slotMachineRef = useRef();
  const coinFlipRef = useRef();
  const crazyTimeWheelRef = useRef();
  const blackjackTableRef = useRef();

  useEffect(() => {
    console.log('DEBUG - Registering interactive objects');
    const registerIfReady = (ref, game) => {
      if (ref.current) {
        registerInteractiveObject(ref, game);
      } else {
        console.warn(`DEBUG - Ref for ${game} not ready yet`);
      }
    };
  
    registerIfReady(pokerCardRef, 'Solana Card Duel');
    registerIfReady(slotMachineRef, 'Meme Slots');
    registerIfReady(coinFlipRef, 'Coin Flip');
    registerIfReady(crazyTimeWheelRef, 'Crazy Wheel');
    registerIfReady(blackjackTableRef, 'Poker PvP');
  
    console.log('DEBUG - Interactive objects registered:', interactiveObjects.current.map(obj => ({
      game: obj.game,
      meshCount: obj.meshes.length,
      meshNames: obj.meshes.map(m => m.name)
    })));
  }, [pokerCardRef.current, slotMachineRef.current, coinFlipRef.current, crazyTimeWheelRef.current, blackjackTableRef.current]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={isMobile ? 60 : 90} />
      <ambientLight intensity={isMobile ? 0.4 : 0.6} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={isMobile ? 1 : 1.5}
        castShadow={false}
        shadow-mapSize={[isMobile ? 512 : 1024, isMobile ? 512 : 1024]}
      />
      <pointLight
        position={[0, 5, 0]}
        color={winLightColor}
        intensity={isMobile ? 1 : 2}
        distance={20}
      />
      {isMobile ? null : (
        <pointLight position={[15, 5, 15]} color="blue" intensity={2} distance={20} />
      )}

      <Stars
        radius={100}
        depth={isMobile ? 30 : 50}
        count={isMobile ? 300 : 1000}
        factor={isMobile ? 2 : 4}
        saturation={0}
        fade
      />

      {isFloorReady && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <primitive object={floorMaterialRef.current} />
        </mesh>
      )}

      <Croupier position={[-14, -1, 10]} currentAnimation={croupierAnimation} />
      <DonaldTrump position={[10, -1, 16]} currentAnimation={trumpAnimation} />

      <PokerCard
        ref={pokerCardRef}
        position={[-17, 2.5, -15]}
        gameName="BlackJack"
        onClick={() => {
          console.log('DEBUG - PokerCard clicked (BlackJack)', Date.now());
          handleSelectGame('Solana Card Duel');
        }}
      />
      <SlotMachine
        ref={slotMachineRef}
        position={[18, -1, -15]}
        gameName="Meme Slots"
        onClick={() => {
          console.log('DEBUG - SlotMachine clicked (Meme Slots)', Date.now());
          handleSelectGame('Meme Slots');
        }}
      />
      <CoinFlip
        ref={coinFlipRef}
        position={[-12.5, 2.5, -15]}
        gameName="Coin Flip"
        onClick={() => {
          console.log('DEBUG - CoinFlip clicked (Coin Flip)', Date.now());
          handleSelectGame('Coin Flip');
        }}
      />
      <CrazyTimeWheel
        ref={crazyTimeWheelRef}
        position={[2, -1, -15]}
        gameName="Crazy Wheel"
        onClick={() => {
          console.log('DEBUG - CrazyTimeWheel clicked (Crazy Wheel)', Date.now());
          handleSelectGame('Crazy Wheel');
        }}
      />

      <CasinoTable position={[-15, -1, -15]} />
      <BlackjackTable
        ref={blackjackTableRef}
        position={[0, -1, 3]}
        onSelectGame={handleSelectGame}
      />
      <RedCarpetModule position={[0, -1, 10]} />
      <CasinoSignWithBulb position={[0, 19, 24]} />
      
      <CasinoTwistedColumn position={[-23.5, -1, -23.5]} />
      <CasinoTwistedColumn position={[-23.5, -1, 23.5]} />
      <CasinoTwistedColumn position={[23.5, -1, -23.5]} />
      <CasinoTwistedColumn position={[23.5, -1, 23.5]} />

      {showParticles && <Particles position={[0, 2, 0]} />}

      <OrbitControls
        ref={orbitControlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={isMobile ? 20 : 15}
        maxDistance={isMobile ? 100 : 120}
        rotateSpeed={isMobile ? 0.8 : 1.3}
        zoomSpeed={isMobile ? 1.5 : 1.3}
        enableDamping={true}
        dampingFactor={0.1}
        autoRotate={false}
        onStart={() => console.log('DEBUG - OrbitControls interaction started', Date.now())}
        onEnd={() => console.log('DEBUG - OrbitControls interaction ended', Date.now())}
      />

      {isMobile ? null : (
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      console.log('Window resized, isMobile:', newIsMobile);
      if (canvasRef.current && !isFullscreen) {
        canvasRef.current.style.width = '100%';
        canvasRef.current.style.height = newIsMobile ? '50vh' : '70vh';
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      console.log('Fullscreen changed:', isNowFullscreen, 'Canvas:', canvasRef.current);
      if (isNowFullscreen) {
        document.body.classList.add('fullscreen-active');
        if (canvasRef.current) {
          canvasRef.current.style.width = '100vw';
          canvasRef.current.style.height = '100vh';
        }
      } else {
        document.body.classList.remove('fullscreen-active');
        if (canvasRef.current) {
          canvasRef.current.style.width = '100%';
          canvasRef.current.style.height = isMobile ? '50vh' : '70vh';
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.addEventListener('fullscreenchange', handleFullscreenChange);
  }, [isMobile]);

  const enterFullscreen = () => {
    if (!canvasRef.current) {
      console.error('Canvas ref non disponibile');
      return;
    }
    console.log('Attempting to enter fullscreen...');
    if (document.fullscreenEnabled) {
      canvasRef.current.requestFullscreen()
        .then(() => {
          console.log('Entered fullscreen successfully');
          setIsFullscreen(true);
        })
        .catch((err) => {
          console.error('Errore durante l\'attivazione del fullscreen:', err);
          canvasRef.current.style.width = '100vw';
          canvasRef.current.style.height = '100vh';
          document.body.classList.add('fullscreen-active');
          setIsFullscreen(true);
        });
    } else {
      console.warn('Fullscreen non supportato, applico fallback...');
      canvasRef.current.style.width = '100vw';
      canvasRef.current.style.height = '100vh';
      document.body.classList.add('fullscreen-active');
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = () => {
    console.log('Attempting to exit fullscreen...');
    if (document.fullscreenElement) {
      document.exitFullscreen()
        .then(() => {
          console.log('Exited fullscreen successfully');
          setIsFullscreen(false);
          if (canvasRef.current) {
            canvasRef.current.style.width = '100%';
            canvasRef.current.style.height = isMobile ? '50vh' : '70vh';
          }
          document.body.classList.remove('fullscreen-active');
        })
        .catch((err) => {
          console.error('Errore durante l\'uscita dal fullscreen:', err);
          if (canvasRef.current) {
            canvasRef.current.style.width = '100%';
            canvasRef.current.style.height = isMobile ? '50vh' : '70vh';
          }
          document.body.classList.remove('fullscreen-active');
          setIsFullscreen(false);
        });
    } else if (isFullscreen) {
      if (canvasRef.current) {
        canvasRef.current.style.width = '100%';
        canvasRef.current.style.height = isMobile ? '50vh' : '70vh';
      }
      document.body.classList.remove('fullscreen-active');
      setIsFullscreen(false);
      console.log('Exited fullscreen (fallback)');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full casino-scene-container">
      {isMobile ? (
         // Mostra solo la lista dei giochi su mobile con immagini
  <div className="game-buttons-container flex flex-col gap-4 items-center justify-center h-full">
  {[
    { name: 'Solana Card Duel', label: 'Blackjack', icon: '/assets/images/BJ.png' },
    { name: 'Meme Slots', label: 'Meme Slots', icon: '/assets/images/slot.png' },
    { name: 'Coin Flip', label: 'Coin Flip', icon: '/assets/images/coin.png' },
    { name: 'Crazy Wheel', label: 'Crazy Wheel', icon: '/assets/images/Wheel.png' },
    { name: 'Poker PvP', label: 'Poker PvP', icon: '/assets/images/Poker.png' },
  ].map((game) => (
    <button
      key={game.name}
      onClick={() => onSelectGame(game.name)}
      className="casino-button w-48 flex items-center justify-start"
    >
      <img
        src={game.icon}
        alt={`${game.label} Icon`}
        className="w-8 h-8 mr-3"
        onError={(e) => console.error(`Failed to load icon for ${game.label}:`, e)}
      />
      <span>{game.label}</span>
    </button>
  ))}
</div>
) : (
        // Mostra la scena 3D su desktop con opzione di fullscreen
        <>
          <Canvas
            ref={canvasRef}
            className="w-full h-full casino-canvas"
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              shadowMap: { enabled: !isMobile, type: THREE.PCFSoftShadowMap },
            }}
            scene={{ background: new THREE.Color('#000000') }}
            dpr={Math.min(window.devicePixelRatio, 2)}
            performance={{
              current: 1,
              min: 0.5,
              max: 1,
              debounce: 200,
            }}
            style={{ pointerEvents: 'auto' }}
          >
            <SceneContent
              onSelectGame={(game) => {
                console.log('DEBUG - CasinoScene onSelectGame called:', game, Date.now());
                if (isFullscreen) {
                  console.log('DEBUG - Exiting fullscreen before selecting game');
                  exitFullscreen();
                }
                onSelectGame(game);
                console.log('DEBUG - Selected game set in CasinoScene:', game);
              }}
              croupierAnimation={croupierAnimation}
              setCroupierAnimation={setCroupierAnimation}
              triggerWinEffect={triggerWinEffect}
              isMobile={isMobile}
              isFullscreen={isFullscreen}
            />
          </Canvas>
          <div className="fullscreen-button-container z-[1001]">
            {isFullscreen ? (
              <button
                onClick={exitFullscreen}
                className="casino-button text-sm py-2 px-4"
                style={{ pointerEvents: 'auto', zIndex: 1002 }}
              >
                Exit Fullscreen
              </button>
            ) : (
              <button
                onClick={enterFullscreen}
                className="casino-button text-sm py-2 px-4 animate-pulse-slow"
                style={{ pointerEvents: 'auto', zIndex: 1002 }}
              >
                Fullscreen
              </button>
            )}
          </div>
        </>
      )}
    </div>
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
const [showLeaderboard, setShowLeaderboard] = useState(false);
const [visitorCount, setVisitorCount] = useState(0); // Stato per il conteggio dei visitatori





  

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

 

  // Definisci toggleHolders
  const toggleHolders = () => {
    setShowHolders((prev) => !prev);
    console.log('DEBUG - Toggled holders visibility:', !showHolders);
  };

  // Aggiungi il messaggio di avviso per Phantom
  useEffect(() => {
    if (connected && publicKey && !hasSeenWarning) {
      alert(
        "Note: Phantom may display a security warning. Casino of Meme is safe: we use HTTPS and do not store your private keys. For any concerns, contact us at casinofmeme@gmail.com."
      );
      setHasSeenWarning(true);
    }
  }, [connected, publicKey]);



// Gestione WebSocket per il conteggio dei visitatori
useEffect(() => {
  socket.on('visitorCount', (count) => {
    console.log('DEBUG - Received visitor count:', count);
    setVisitorCount(count);
  });

  return () => {
    socket.off('visitorCount');
  };
}, []);




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



  const toggleLeaderboard = () => {
    setShowLeaderboard(!showLeaderboard);
  };
  

  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const holdersPerPage = 50;

  
  

  // Stato per il gioco selezionato
  const [selectedGame, setSelectedGame] = useState(null);


    // Aggiungi lo stato comBalance
    const [comBalance, setComBalance] = useState(0); // Valore iniziale di fallback



    const fetchComBalance = async (retries = 3, delay = 1000) => {
      if (!connected || !publicKey) {
        setComBalance(0);
        console.log('DEBUG - No wallet connected, setting COM balance to 0');
        return;
      }
    
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`DEBUG - Attempt ${i + 1}/${retries} to fetch COM balance for:`, publicKey.toString());
          const connection = new Connection(RPC_ENDPOINT, 'confirmed');
          const userATA = await getAssociatedTokenAddress(
            new PublicKey(MINT_ADDRESS),
            publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
          );
          console.log('DEBUG - User ATA:', userATA.toBase58());
          try {
            const account = await getAccount(connection, userATA, TOKEN_2022_PROGRAM_ID);
            const balanceInfo = await connection.getTokenAccountBalance(userATA);
            const balance = balanceInfo.value.uiAmount || 0;
            setComBalance(balance);
            console.log(`DEBUG - Fetched COM balance: ${balance} COM`);
            setError(null);
            return;
          } catch (err) {
            if (err.name === 'TokenAccountNotFoundError' || err.name === 'TokenInvalidAccountOwnerError') {
              console.log('DEBUG - ATA not found, setting balance to 0');
              setComBalance(0);
              setError('No COM tokens found for this address. Acquire some to play.');
              return;
            } else {
              throw err;
            }
          }
        } catch (err) {
          console.warn('DEBUG - Error fetching COM balance:', {
            attempt: i + 1,
            error: err.message,
            stack: err.stack,
          });
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            setComBalance(0);
            setError('Failed to fetch COM balance. The server or network may be experiencing issues.');
          }
        }
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
    console.log('DEBUG - Received waitingPlayers event:', data);
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
const createAndSignTransaction = async (betAmount, gameType, additionalData = {}) => {
  if (!connected || !publicKey || !signTransaction) {
    throw new Error('Please connect your wallet to play!');
  }

  const validGameTypes = ['memeSlots', 'coinFlip', 'crazyWheel', 'solanaCardDuel'];
  if (!validGameTypes.includes(gameType)) {
    throw new Error(`Invalid gameType: ${gameType}`);
  }

  const roundedBetAmount = Math.round(betAmount * 1000000000) / 1000000000;

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const betInLamports = Math.round(roundedBetAmount * LAMPORTS_PER_SOL);
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

   
        const signedTransaction = await signTransaction(transaction);

    const endpointMap = {
      memeSlots: '/play-meme-slots',
      coinFlip: '/play-coin-flip',
      crazyWheel: '/play-crazy-wheel',
      solanaCardDuel: '/play-solana-card-duel',
    };

    const response = await fetch(`${BACKEND_URL}${endpointMap[gameType]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      console.log('DEBUG - Join failed: Wallet not connected', { connected, publicKey });
      return;
    }
    
    const betError = validateBet(betAmount, 'Poker PvP');
    if (betError) {
      setPokerMessage(betError);
      console.log('DEBUG - Join failed: Bet validation error', { betAmount, betError });
      return;
    }
    
    if (comBalance < betAmount) {
      setPokerMessage('Saldo COM insufficiente.');
      console.log('DEBUG - Join failed: Insufficient COM balance', { comBalance, betAmount });
      return;
    }
    
    try {
      console.log('DEBUG - Creating transaction for joining poker game...');
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      console.log('DEBUG - Getting user ATA...');
      const userATA = await getAssociatedTokenAddress(
        new PublicKey(MINT_ADDRESS),
        publicKey
      );
      console.log('DEBUG - Getting casino ATA...');
      const casinoPublicKey = new PublicKey('2E1LhcV3pze6Q6P7MEsxUoNYK3KECm2rTS2D18eSRTn9');
      const casinoATA = await getAssociatedTokenAddress(
        new PublicKey(MINT_ADDRESS),
        casinoPublicKey
      );
    
      const transaction = new Transaction();
      
      console.log('DEBUG - Checking user ATA existence...');
      let userAccountExists = false;
      try {
        await getAccount(connection, userATA);
        userAccountExists = true;
        console.log('DEBUG - User ATA exists:', userATA.toBase58());
      } catch (err) {
        console.log('DEBUG - Creating user ATA:', err.message);
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userATA,
            publicKey,
            new PublicKey(MINT_ADDRESS)
          )
        );
      }
    
      console.log('DEBUG - Adding transfer instruction...');
      transaction.add(
        createTransferInstruction(
          userATA,
          casinoATA,
          publicKey,
          betAmount * 1e6
        )
      );
    
      console.log('DEBUG - Getting latest blockhash...');
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
    
      console.log('DEBUG - Signing transaction...');
      const signedTransaction = await signTransaction(transaction);
    
      console.log('DEBUG - Sending joinGame request:', { playerAddress: publicKey.toString(), betAmount });
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
        credentials: 'include', // Aggiunto per CORS
      });
      const result = await response.json();
      if (result.success) {
        console.log('DEBUG - Transaction successful, emitting joinGame event...');
        socket.emit('joinGame', {
          playerAddress: publicKey.toString(),
          betAmount,
        }, (ack) => {
          if (ack) {
            console.log('DEBUG - joinGame event acknowledged by server:', ack);
            setPokerMessage('Ti sei unito al gioco! In attesa di un altro giocatore...');
            fetchComBalance();
          } else {
            console.error('DEBUG - No acknowledgment received for joinGame event');
            setPokerMessage('Errore: evento joinGame non confermato dal server.');
          }
        });
      } else {
        console.error('DEBUG - Join failed:', result.error);
        setPokerMessage(`Impossibile unirsi al gioco: ${result.error}`);
      }
    } catch (err) {
      console.error('DEBUG - Error in joinPokerGame:', err.message, err.stack);
      setPokerMessage('Impossibile unirsi al gioco: ' + err.message);
    }
  };






  const makePokerMove = async (move, amount = 0) => {
    if (!connected || !publicKey || pokerStatus !== 'playing' || !signTransaction) {
      setPokerMessage('Gioco non in corso o portafoglio non connesso!');
      console.log('DEBUG - makePokerMove failed: Game not active or wallet not connected', { connected, publicKey, pokerStatus });
      return;
    }
    
    const gameId = localStorage.getItem('currentGameId');
    if (!gameId) {
      setPokerMessage('Nessun gioco attivo trovato!');
      console.log('DEBUG - makePokerMove failed: No active game found');
      return;
    }
    
    if (currentTurn !== socket.id) {
      setPokerMessage("Non è il tuo turno!");
      console.log('DEBUG - makePokerMove failed: Not your turn', { currentTurn, socketId: socket.id });
      return;
    }
    
    if (move === 'raise' && validateBet(amount, 'Poker PvP')) {
      setPokerMessage(validateBet(amount, 'Poker PvP'));
      console.log('DEBUG - makePokerMove failed: Invalid raise amount', { amount });
      return;
    }
    
    let additionalBet = 0;
    if (move === 'call') {
      additionalBet = currentBet - (playerBets[publicKey.toString()] || 0);
    } else if (move === 'bet' || move === 'raise') {
      additionalBet = amount - (playerBets[publicKey.toString()] || 0);
    }
    
    console.log('DEBUG - Calculated additionalBet:', { move, additionalBet, currentBet, playerBet: playerBets[publicKey.toString()] });
    
    if (additionalBet > 0) {
      if (comBalance < additionalBet) {
        setPokerMessage('Saldo COM insufficiente. Aggiungi fondi e riprova.');
        console.log('DEBUG - makePokerMove failed: Insufficient COM balance', { comBalance, additionalBet });
        return;
      }
    
      try {
        console.log('DEBUG - Creating transaction for move:', move);
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        console.log('DEBUG - Getting user ATA...');
        const userATA = await getAssociatedTokenAddress(
          new PublicKey(MINT_ADDRESS),
          publicKey
        );
        console.log('DEBUG - Getting casino ATA...');
        const casinoPublicKey = new PublicKey('2E1LhcV3pze6Q6P7MEsxUoNYK3KECm2rTS2D18eSRTn9');
        const casinoATA = await getAssociatedTokenAddress(
          new PublicKey(MINT_ADDRESS),
          casinoPublicKey
        );
    
        const transaction = new Transaction();
    
        console.log('DEBUG - Checking user ATA existence...');
        let userAccountExists = false;
        try {
          await getAccount(connection, userATA);
          userAccountExists = true;
          console.log('DEBUG - User ATA exists:', userATA.toBase58());
        } catch (err) {
          console.log('DEBUG - Creating user ATA:', err.message);
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              userATA,
              publicKey,
              new PublicKey(MINT_ADDRESS)
            )
          );
        }
    
        console.log('DEBUG - Adding transfer instruction...');
        transaction.add(
          createTransferInstruction(
            userATA,
            casinoATA,
            publicKey,
            additionalBet * 1e6
          )
        );
    
        console.log('DEBUG - Getting latest blockhash...');
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
    
        console.log('DEBUG - Signing transaction for move:', move);
        const signedTransaction = await signTransaction(transaction);
    
        console.log('DEBUG - Sending make-poker-move request:', { playerAddress: publicKey.toString(), gameId, move, amount: additionalBet });
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
          credentials: 'include', // Aggiunto per CORS
        });
        const result = await response.json();
        if (!result.success) {
          console.error('DEBUG - make-poker-move failed:', result.error);
          setPokerMessage(`Scommessa fallita: ${result.error}`);
          return;
        }
        console.log('DEBUG - make-poker-move successful, updating balance...');
        fetchComBalance();
      } catch (err) {
        console.error('DEBUG - Error in makePokerMove:', err.message, err.stack);
        setPokerMessage(`Scommessa fallita: ${err.message}`);
        return;
      }
    }
    
    console.log(`DEBUG - Emitting makeMove event: gameId=${gameId}, move=${move}, amount=${amount}`);
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
  
    let newAccumulated = { sol: 0, wbtc: 0, weth: 0 };
  
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`DEBUG - Attempt ${i + 1}/${retries} to fetch rewards data`);
        // Fetch tax wallet balance
        console.log('DEBUG - Fetching tax wallet balance...');
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
          throw new Error(balanceResult.error || 'Failed to fetch tax wallet balance');
        }
  
        // Fetch rewards
        console.log('DEBUG - Fetching rewards...');
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
          console.log('DEBUG - Rewards fetched:', rewardsResult.rewards);
        } else {
          throw new Error(rewardsResult.error || 'Failed to fetch rewards');
        }
  
        // Fetch holders and user balance
        if (connected && publicKey && MINT_ADDRESS && RPC_ENDPOINT) {
          const connection = new Connection(RPC_ENDPOINT, 'confirmed');
          let holderList = [];
          let supply = 0;
          try {
            console.log('DEBUG - Fetching mint info for:', MINT_ADDRESS);
            const mintInfo = await getMint(connection, new PublicKey(MINT_ADDRESS), TOKEN_2022_PROGRAM_ID);
            supply = Number(mintInfo.supply) / 1e6;
            setTotalSupply(supply);
            console.log('DEBUG - Mint supply:', supply);
  
            console.log('DEBUG - Fetching holders for MINT_ADDRESS:', MINT_ADDRESS);
            holderList = await getHolders(MINT_ADDRESS, connection);
            console.log('DEBUG - Holders fetched:', holderList.length);
          } catch (err) {
            if (err.name === 'TokenInvalidAccountOwnerError' || err.name === 'TokenAccountNotFoundError') {
              console.warn('DEBUG - Invalid mint or token account, skipping holders:', err.message);
              holderList = [];
              supply = 0;
              setError('Impossibile recuperare i dati del mint o gli holder. Potrebbe essere un problema con l\'RPC o il mint non è sincronizzato.');
            } else {
              console.error('DEBUG - Unexpected error fetching mint or holders:', err.message, err.stack);
              throw err;
            }
          }
  
          const updatedHolders = holderList.map(holder => ({
            ...holder,
            solReward: supply > 0 ? (holder.amount / supply) * rewardsResult.rewards.sol : 0,
            wbtcReward: supply > 0 ? (holder.amount / supply) * rewardsResult.rewards.wbtc : 0,
            wethReward: supply > 0 ? (holder.amount / supply) * rewardsResult.rewards.weth : 0,
          }));
          setHolders(updatedHolders);
          setHolderCount(updatedHolders.length);
          console.log('DEBUG - Updated holders:', updatedHolders.length);
  
          let userAmount = 0;
          try {
            console.log('DEBUG - Fetching mint info for:', MINT_ADDRESS);
            const mintInfo = await getMint(connection, new PublicKey(MINT_ADDRESS), TOKEN_2022_PROGRAM_ID);
            supply = Number(mintInfo.supply) / 1e6;
            setTotalSupply(supply);
            console.log('DEBUG - Mint supply:', supply);
            holderList = await getHolders(MINT_ADDRESS, connection);
          } catch (err) {
            console.error('DEBUG - Error fetching mint:', {
              message: err.message,
              name: err.name,
              stack: err.stack,
              mintAddress: MINT_ADDRESS,
              tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
            });
            if (err.name === 'TokenInvalidAccountOwnerError' || err.name === 'TokenAccountNotFoundError') {
              console.warn('DEBUG - Invalid mint or token account, skipping holders:', err.message);
              holderList = [];
              supply = 0;
              setError(`Impossibile recuperare i dati del mint (${MINT_ADDRESS}). Errore: ${err.message}. Verifica il mint address e l'RPC.`);
            } else {
              console.error('DEBUG - Unexpected error fetching mint or holders:', err.message, err.stack);
              setError(`Errore imprevisto durante il recupero dei dati del mint: ${err.message}`);
              throw err;
            }
          }
          
          setUserTokens(userAmount);
          setComBalance(userAmount);
          setUserRewards({
            sol: supply > 0 ? (userAmount / supply) * newAccumulated.sol : 0,
            wbtc: supply > 0 ? (userAmount / supply) * newAccumulated.wbtc : 0,
            weth: supply > 0 ? (userAmount / supply) * newAccumulated.weth : 0,
          });
        } else {
          setHolders([]);
          setHolderCount(0);
          setTotalSupply(0);
          setUserTokens(0);
          setComBalance(0);
          setUserRewards({ sol: 0, wbtc: 0, weth: 0 });
          console.log('DEBUG - No wallet connected, resetting holders and rewards');
        }
        return;
      } catch (error) {
        console.error(`Error in fetchRewardsData (attempt ${i + 1}/${retries}):`, {
          message: error.message,
          name: error.name,
          stack: error.stack,
          MINT_ADDRESS,
          RPC_ENDPOINT,
        });
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          setError('Errore nel recupero dei dati: ' + error.message);
          setHolders([]);
          setHolderCount(0);
          setTotalSupply(0);
          setUserTokens(0);
          setComBalance(0);
          setUserRewards({ sol: 0, wbtc: 0, weth: 0 });
        }
      } finally {
        setLoading(false);
      }
    }
  };

  async function getHolders(mintAddress, connection) {
    const holders = [];
    const filters = [
      { dataSize: 165 }, // Dimensione di un account di token
      { memcmp: { offset: 0, bytes: mintAddress } }, // Filtra per mint
    ];
    try {
      console.log('DEBUG - Fetching token accounts for mint:', mintAddress);
      const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, { filters });
      console.log('DEBUG - Total accounts found:', accounts.length);
      if (accounts.length === 0) {
        console.log('DEBUG - No token accounts found for mint:', mintAddress, 'Possible reasons: token not distributed, mint not initialized, or RPC issue.');
      }
      for (const account of accounts) {
        try {
          if (account.account.owner.toString() !== TOKEN_2022_PROGRAM_ID.toString()) {
            console.warn('DEBUG - Skipping invalid token account:', {
              account: account.pubkey.toString(),
              owner: account.account.owner.toString(),
              expectedOwner: TOKEN_2022_PROGRAM_ID.toString(),
            });
            continue;
          }
          const accountData = AccountLayout.decode(account.account.data);
          const amount = Number(accountData.amount) / 1e6;
          console.log('DEBUG - Found account:', {
            address: accountData.owner.toString(),
            amount,
            accountPubkey: account.pubkey.toString(),
          });
          holders.push({ address: accountData.owner.toString(), amount });
        } catch (err) {
          console.warn('DEBUG - Failed to decode account:', {
            accountPubkey: account.pubkey.toString(),
            error: err.message,
          });
        }
      }
      const sortedHolders = holders.sort((a, b) => b.amount - a.amount);
      console.log('DEBUG - Sorted holders:', sortedHolders.map(h => ({
        address: h.address,
        amount: h.amount,
      })));
      return sortedHolders;
    } catch (err) {
      console.error('DEBUG - Error in getHolders:', {
        mintAddress,
        error: err.message,
        stack: err.stack,
      });
      return [];
    }
  }

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
    setBets(prev => {
      const newBets = {
        ...prev,
        [segment]: prev[segment] + betAmount,
      };
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
    <div className="w-full bg-gray-900 bg-opacity-80 rounded-xl shadow-lg animate-neon-glow">
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


<div className="nav-bar w-[98%] max-w-[800px] mx-auto bg-[#1c1c1c] rounded-[45px] py-2 px-4 flex justify-between items-center mb-12">
  <div className="flex items-center gap-3">
    <img
      src="/assets/C_Small.png"
      alt="Header Animation"
      className="object-contain"
      style={{ height: '45px', width: 'auto' }}
    />
    <button
      onClick={toggleMusic}
      className="casino-button text-sm py-2 px-4"
      style={{ padding: '2px 4px', fontSize: '10px', lineHeight: '1.2', minHeight: 'auto' }}
    >
      {isMusicPlaying ? 'Mute Music' : 'Play Music'}
    </button>
    <div
      className="visitor-count bg-gray-700 text-orange-700 rounded-full py-1 px-3 flex items-center"
      style={{ fontSize: '12px', lineHeight: '1.2' }}
    >
      <span className="mr-1">👥</span> {visitorCount} Live
    </div>
  </div>
  <WalletMultiButton
    className="text-[8px] py-0.5 px-2 rounded-full"
    style={{
      padding: '1px 4px',
      fontSize: '10px',
      lineHeight: '1.2',
      minHeight: 'auto',
      height: '25px',
      background: '#6B21A8',
      color: '#FFFFFF',
      border: '15px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '10px',
      zIndex: 1000,
    }}
  />
</div>


  {/* Spacer */}
  <div className="spacer h-12"></div>

      {loading ? (
        <p className="text-center text-orange-700 animate-pulse text-2xl">.</p>
      ) : error ? (
        <p className="text-center text-red-500 text-2xl">{error}</p>
      ) : (
        <>
          {/* Mostra solo il gioco selezionato o la pagina principale */}
          {selectedGame ? (
            <>
              {/* Schermata del gioco selezionato */}
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
                          const isVisible = gameStatus === 'finished' || index === 0;
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
                    <div className={`slot-machine ${slotStatus === 'won' ? 'winning' : ''}`}>
                      <div className="grid grid-cols-5 gap-1">
                        {slotReelsDisplay.map((meme, index) => (
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
                        ))}
                      </div>
                    </div>
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
                    {console.log({
                      waitingPlayersList,
                      pokerStatus,
                      pokerPlayers,
                      publicKey: publicKey?.toString(),
                      socketId: socket.id,
                      minBet,
                    })}

                    {pokerStatus === 'waiting' && waitingPlayersList.some(p => p.address === publicKey?.toString()) && (
                      <button
                        onClick={() => socket.emit('leaveWaitingList', { playerAddress: publicKey.toString() })}
                        className="w-full casino-button mb-2"
                      >
                        Leave Table
                      </button>
                    )}

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
                          min={minBet}
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

                    {pokerPlayers.length > 0 && publicKey ? (
                      <>
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

                        <p className="text-lg text-orange-700 mb-2 text-center">
                          Pot: {pokerPot ? pokerPot.toFixed(2) : '0.00'} COM
                        </p>
                        <p className="text-lg text-orange-700 mb-2 text-center">
                          Current Bet: {currentBet ? currentBet.toFixed(2) : '0.00'} COM
                        </p>

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
        className="casino-button"
        style={{
          background: bets[segment] > 0 ? 'linear-gradient(135deg, #00ff00, #008000)' : '',
          touchAction: 'auto', // Consenti scroll
        }}
      >
        {segment} (Bet: {bets[segment].toFixed(2)} SOL)
      </button>
    ))}
  </div>
  <div className="flex gap-4 justify-center mt-4">
    <button
      onClick={cancelLastBet}
      className="casino-button"
      disabled={wheelStatus !== 'idle' || betHistory.length === 0}
      style={{ touchAction: 'auto' }}
    >
      Cancel Last Bet
    </button>
    <button
      onClick={repeatLastBet}
      className="casino-button"
      disabled={wheelStatus !== 'idle' || !lastBets || Object.values(lastBets).every(bet => bet === 0)}
      style={{ touchAction: 'auto' }}
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
                          setBetHistory([]);
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
          ) : (
            <>
              {/* Pagina principale (mostrata solo se nessun gioco è selezionato) */}
              {connected && publicKey && (
        <div className="wallet-info-box">
          <p className="text-orange-700">
            Your COM Balance: {TOKEN_SYMBOL} {userTokens.toFixed(6)}
          </p>
        </div>
      )}



              <CasinoScene
                onSelectGame={(game) => {
                  console.log('DEBUG - RewardsDashboard setSelectedGame:', game, Date.now());
                  setSelectedGame(game);
                }}
                triggerWinEffect={triggerWinEffect}
                className="mb-32"
                style={{ zIndex: 1 }}
              />


<div className="content-wrapper">
                
               
{/* Missions & Leaderboard */}
<div className="mb-12 missions-leaderboard" style={{ marginTop: '96px' }}>
    <div className="title-container">
      <h2 className="text-3xl font-bold text-orange-700 mt-10 mb-6 tracking-wide header-box">
        Missions & Leaderboard
      </h2>
    </div>
    <div className="grid grid-cols-1 gap-8">
      <div className="p-4">
        <div className="title-container">
          <h3 className="text-xl font-bold text-orange-700 mb-3">Daily Missions</h3>
        </div>
        {missions.map(mission => (
          <div key={mission.id} className="mb-3 text-center">
            <p className="text-base text-orange-700">{mission.description}</p>
            <p className="text-sm text-orange-700">Progress: {mission.current}/{mission.target}</p>
            <p className="text-sm text-orange-700">Reward: {mission.reward} SOL</p>
            {mission.completed && <p className="text-green-400 text-sm">Completed!</p>}
          </div>
        ))}
      </div>
    </div>
    <div className="flex justify-center mt-6 mb-6 gap-4">
      <button onClick={toggleLeaderboard} className="casino-button text-sm py-2 px-4">
        {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
      </button>
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="casino-button text-sm py-2 px-4"
      >
        {showInfo ? 'Hide Info' : 'Show Info'}
      </button>
      <button
        onClick={toggleHolders}
        className="casino-button text-sm py-2 px-4"
      >
        {showHolders ? 'Hide Holders' : 'Show Holders'}
      </button>
    </div>
    {showLeaderboard && (
  <div className="p-6">
    <div className="title-container">
      <h3 className="text-xl font-bold text-orange-700 mb-3">Leaderboard</h3>
    </div>
    {leaderboard.length > 0 ? (
      <div className="overflow-x-auto leaderboard-box">
        <table className="w-full text-center leaderboard-table">
          <thead>
            <tr className="text-cyan-400">
              <th className="p-4 text-lg">Rank</th>
              <th className="p-4 text-lg">Address</th>
              <th className="p-4 text-lg">Total Winnings (COM)</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, index) => (
              <tr key={index} className="border-t border-gray-600 hover:bg-opacity-10 transition-all">
                <td className="p-4 text-gray-200">{index + 1}</td>
                <td className="p-4 text-gray-200 font-mono">{player.address.slice(0, 8)}...</td>
                <td className="p-4 text-green-400">{player.totalWinnings.toFixed(2)} COM</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-orange-700 text-lg text-center">Play some games to appear on the leaderboard!</p>
    )}
  </div>
)}
  
  </div>

  {showInfo && (
  <div className="show-info-section">
    <div className="info-block">
      <p className="text-lg text-orange-700">Tax Wallet Balance</p>
      <p className="text-2xl font-bold text-orange-700">{taxWalletBalance.toFixed(4)} SOL</p>
    </div>
    <div className="info-block">
      <p className="text-lg text-orange-700">SOL Rewards (Latest)</p>
      <p className="text-2xl font-bold text-orange-700">{rewardSol.toFixed(4)} SOL</p>
      <p className="text-lg text-orange-700">Total Accumulated: {accumulatedRewards.sol.toFixed(4)} SOL</p>
    </div>
    <div className="info-block">
      <p className="text-lg text-orange-700">WBTC Rewards (Latest)</p>
      <p className="text-2xl font-bold text-orange-700">{rewardWbtc.toFixed(8)} WBTC</p>
      <p className="text-lg text-orange-700">Total Accumulated: {accumulatedRewards.wbtc.toFixed(8)} WBTC</p>
    </div>
    <div className="info-block">
      <p className="text-lg text-orange-700">WETH Rewards (Latest)</p>
      <p className="text-2xl font-bold text-orange-700">{rewardWeth.toFixed(8)} WETH</p>
      <p className="text-lg text-orange-700">Total Accumulated: {accumulatedRewards.weth.toFixed(8)} WETH</p>
    </div>
  </div>
)}

                {/* Sezione Holders */}
                {showHolders && holders.length > 0 ? (
  <div className="p-6 mb-12 holders-table">
    <div className="overflow-x-auto">
      <table className="w-full text-center">
        <thead>
          <tr className="text-cyan-400">
            <th className="p-4 text-lg">Holder Address</th>
            <th className="p-4 text-lg">Amount ({TOKEN_SYMBOL})</th>
            <th className="p-4 text-lg">SOL Reward</th>
            <th className="p-4 text-lg">WBTC Reward</th>
            <th className="p-4 text-lg">WETH Reward</th>
          </tr>
        </thead>
        <tbody>
          {currentHolders.map((holder, index) => (
            <tr key={index} className="border-t border-gray-600 hover:bg-opacity-10 transition-all">
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
  <p className="text-center text-orange-700 mb-12 text-lg">
    No holders detected in the network (excluding pool).
  </p>
) : null}
             

{/* Footer Section */}
<div className="footer-section flex justify-center items-center w-full px-5 py-10 mt-16">
  <div className="footer-box bg-black bg-opacity-70 rounded-2xl p-8 max-w-[600px] w-full shadow-xl flex justify-center items-center text-center border-2 border-[#ffcc00]">
    <div className="footer-content flex flex-col items-center gap-8">
      {/* Logo */}
      <img src="/assets/casino.gif" alt="Casino of Meme" className="footer-logo w-24 mb-6" />

  {/* Social Links */}
<div className="footer-social-links flex gap-8">
  <a
    href="https://t.me/Casinofmeme"
    target="_blank"
    rel="noopener noreferrer"
    className="social-icon-wrapper hover:scale-110 transition-transform"
  >
    <img
      src="/assets/social/TG.svg"
      alt="Telegram"
      className="social-icon w-12 h-12"
    />
  </a>
  <a
    href="https://www.dextools.io/app/your-pair"
    target="_blank"
    rel="noopener noreferrer"
    className="social-icon-wrapper hover:scale-110 transition-transform"
  >
    <img
      src="/assets/social/DEXT.svg"
      alt="Dextools"
      className="social-icon w-12 h-12"
    />
  </a>
  <a
    href="https://casinoofmemes-organization.gitbook.io/thesolanacasino"
    target="_blank"
    rel="noopener noreferrer"
    className="social-icon-wrapper hover:scale-110 transition-transform"
  >
    <img
      src="/assets/social/GITB.svg"
      alt="Gitbook"
      className="social-icon w-12 h-12"
    />
  </a>
  <a
    href="https://x.com/CasinofmemeSOL"
    target="_blank"
    rel="noopener noreferrer"
    className="social-icon-wrapper hover:scale-110 transition-transform"
  >
    <img
      src="/assets/social/x.svg"
      alt="Twitter"
      className="social-icon w-12 h-12"
    />
  </a>
</div>


      {/* Contract Info */}
      <div className="footer-contract text-white text-lg">
        Contract: <span className="font-mono">TBD</span> {/* Sostituisci TBD con l'indirizzo del contratto o un link */}
      </div>

      {/* Contact Info */}
      <div className="footer-info flex flex-col gap-4 text-white text-lg">
        <div className="footer-info-item flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="7" fill="#FF0000" />
          </svg>
          casinofmeme@gmail.com
        </div>
        <div className="footer-info-item flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="7" fill="#FF0000" />
          </svg>
          Solana Ecosystem
        </div>
      </div>

      {/* Copyright */}
      <div className="footer-copyright text-gray-400 text-base mt-6">
        ©COM All Rights Reserved
      </div>
    </div>
  </div>
</div>
</div>
             
              
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RewardsDashboard;