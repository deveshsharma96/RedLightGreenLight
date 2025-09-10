document.addEventListener('DOMContentLoaded', () => {
  // UI DOM Elements
  const statusDisplay = document.getElementById('status');
  const timerDisplay = document.getElementById('timer');
  const startButton = document.getElementById('start-button');
  const restartButton = document.getElementById('restart-button');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const instructions = document.getElementById('instructions');
  const gameContainer = document.getElementById('game-container');

  // 🎨 Background color variable (change this in one place)
  const BACKGROUND_COLOR = 0x121212; // hex color for 3D scene & CSS sync

  // Game State
  let gameActive = false;
  let isMoving = false;
  let isRedLight = true;
  let timer = 30;
  let timerInterval;
  let gameLoopTimeout;

  // 3D Scene variables
  let scene, camera, renderer, player, ground, finishLine, doll, dollHead;
  let dollTargetRotationY = Math.PI;
  const SQUID_TEAL_COLOR = new THREE.Color(0x00D4D9);
  const SQUID_PINK_COLOR = new THREE.Color(0xFF007A);

  const FIELD_LENGTH = 100;
  const PLAYER_START_Z = -FIELD_LENGTH / 2 + 5;
  const FINISH_LINE_Z = FIELD_LENGTH / 2 - 5;

  // 🎵 NEW: Sounds
  let bgMusic, dollSound;

  function loadSounds() {
    bgMusic = new Audio("assets/music/background.mp3");
    bgMusic.loop = true;
    bgMusic.volume = 0.3;

    dollSound = new Audio("assets/music/doll.mp3");
    dollSound.volume = 0.7;
  }

  function initThree() {
    scene = new THREE.Scene();





    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(0xFFD550) },   // top (light blue)
    bottomColor: { value: new THREE.Color(0x1a1a2e) }, // bottom (dark)
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y * 0.5 + 0.5;
      gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
    }
  `,
  side: THREE.BackSide,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);






    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, PLAYER_START_Z - 5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    gameContainer.appendChild(renderer.domElement);

    const ambientLight = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, -20);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const groundGeo = new THREE.PlaneGeometry(30, FIELD_LENGTH);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5a70 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    for (let i = 0; i <= FIELD_LENGTH / 10; i++) {
      const lineGeo = new THREE.BoxGeometry(30, 0.1, 0.2);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0x3a4a60 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.05, -FIELD_LENGTH / 2 + i * 10);
      scene.add(line);
    }

    const wallGeo = new THREE.BoxGeometry(1, 6, FIELD_LENGTH);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x202a3b });
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-15.5, 3, 0);
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(15.5, 3, 0);
    scene.add(rightWall);

    const finishGeo = new THREE.BoxGeometry(30, 0.2, 2);
    const finishMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
    finishLine = new THREE.Mesh(finishGeo, finishMat);
    finishLine.position.set(0, 0.1, FINISH_LINE_Z);
    scene.add(finishLine);

    // 👤 Player
    player = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: SQUID_PINK_COLOR });
    const body = new THREE.Mesh(bodyGeo, playerMat);
    const headGeoPlayer = new THREE.SphereGeometry(0.4, 16, 8);
    const headMatPlayer = new THREE.MeshStandardMaterial({ color: 0xfbe0d0 });
    const headPlayer = new THREE.Mesh(headGeoPlayer, headMatPlayer);
    headPlayer.position.y = 1.25;
    player.add(body, headPlayer);
    player.position.set(0, 0.75, PLAYER_START_Z);
    scene.add(player);

    // 👧 Doll
    doll = new THREE.Group();
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(1, 32, 16);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffddc1 });
    const head = new THREE.Mesh(headGeo, skinMat);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2e2e });
    const pigtailGeo = new THREE.SphereGeometry(0.5, 16, 8);
    const pigtailMesh1 = new THREE.Mesh(pigtailGeo, hairMat);
    pigtailMesh1.position.set(-1.2, 0, 0);
    const pigtailMesh2 = new THREE.Mesh(pigtailGeo, hairMat);
    pigtailMesh2.position.set(1.2, 0, 0);
    headGroup.add(head, pigtailMesh1, pigtailMesh2);
    headGroup.position.y = 4;
    headGroup.rotation.y = Math.PI;
    dollHead = headGroup;

    const dressGeo = new THREE.CylinderGeometry(0.5, 2, 3, 8);
    const dressMat = new THREE.MeshStandardMaterial({ color: SQUID_PINK_COLOR });
    const dress = new THREE.Mesh(dressGeo, dressMat);
    dress.position.y = 2;
    doll.add(dollHead, dress);
    doll.position.set(0, 0, FINISH_LINE_Z + 10);
    scene.add(doll);

    window.addEventListener('resize', onWindowResize, false);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
      if (isMoving && !isRedLight) {
        player.position.z += 0.2;
      }
      camera.position.z = player.position.z - 5;
      camera.position.y = player.position.y + 4;
      camera.lookAt(player.position.x, player.position.y, player.position.z + 5);

      checkWinCondition();
    }

    if (dollHead) {
      dollHead.rotation.y += (dollTargetRotationY - dollHead.rotation.y) * 0.05;
    }

    renderer.render(scene, camera);
  }

  const startMoving = () => {
    if (!gameActive) return;
    isMoving = true;
    if (isRedLight && Math.abs(dollHead.rotation.y - dollTargetRotationY) < 1.5) {
      gameOver('eliminated');
    }
  };

  const stopMoving = () => { if (gameActive) isMoving = false; };

  // Controls
  document.body.addEventListener('mousedown', startMoving);
  document.body.addEventListener('mouseup', stopMoving);
  document.body.addEventListener('touchstart', (e) => { e.preventDefault(); startMoving(); }, { passive: false });
  document.body.addEventListener('touchend', (e) => { e.preventDefault(); stopMoving(); }, { passive: false });
  document.body.addEventListener('keydown', (e) => { if (e.code === 'Space' && !isMoving) startMoving(); });
  document.body.addEventListener('keyup', (e) => { if (e.code === 'Space') stopMoving(); });

  startButton.addEventListener('click', startGame);
  restartButton.addEventListener('click', startGame);

  function startGame() {
    gameActive = true;
    isMoving = false;
    isRedLight = true;
    timer = 30;
    player.position.z = PLAYER_START_Z;
    modal.classList.add('hidden');
    instructions.style.display = 'none';
    startButton.style.display = 'none';

    statusDisplay.textContent = 'Get Ready';
    statusDisplay.style.color = 'var(--squid-pink)';
    dollTargetRotationY = Math.PI;
    dollHead.rotation.y = Math.PI;

    clearInterval(timerInterval);
    clearTimeout(gameLoopTimeout);
    timerInterval = setInterval(updateTimer, 1000);
    gameLoopTimeout = setTimeout(gameLoop, 3000);

    if (!renderer) initThree();
    animate();

    loadSounds();
    bgMusic.play();
  }

  function gameLoop() {
    if (!gameActive) return;
    if (isRedLight) {
      greenLight();
      gameLoopTimeout = setTimeout(gameLoop, Math.random() * 2500 + 2000);
    } else {
      redLight();
      gameLoopTimeout = setTimeout(gameLoop, Math.random() * 2000 + 1500);
    }
  }

  function greenLight() {
    isRedLight = false;
    statusDisplay.textContent = 'Green Light';
    statusDisplay.style.color = 'var(--squid-teal)';
    doll.children[1].material.color = SQUID_TEAL_COLOR;
    dollTargetRotationY = Math.PI;
  }

  function redLight() {
    isRedLight = true;
    statusDisplay.textContent = 'Red Light';
    statusDisplay.style.color = 'var(--squid-pink)';
    doll.children[1].material.color = SQUID_PINK_COLOR;
    dollTargetRotationY = 0;

    dollSound.play();

    if (isMoving) gameOver('eliminated');
  }

  function updateTimer() {
    if (!gameActive) return;
    timer--;
    timerDisplay.textContent = `Time: ${timer}s`;
    if (timer <= 0) gameOver('time');
  }

  function checkWinCondition() {
    if (player.position.z >= finishLine.position.z) winGame();
  }

  function winGame() {
    if (!gameActive) return;
    gameActive = false;
    modalTitle.textContent = 'You Win!';
    modalText.textContent = 'Congratulations, you survived this round.';
    modalTitle.style.color = 'var(--squid-teal)';
    modal.classList.remove('hidden');
    bgMusic.pause();
  }

  function gameOver(reason) {
    if (!gameActive) return;
    gameActive = false;
    modalTitle.style.color = 'var(--squid-pink)';
    modalTitle.textContent = 'Eliminated!';
    modalText.textContent = (reason === 'time') ? 'You ran out of time.' : 'You moved during a red light.';
    modal.classList.remove('hidden');
    bgMusic.pause();
  }

  initThree();
  renderer.render(scene, camera);
});
