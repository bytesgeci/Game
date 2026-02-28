const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const landingScreen = document.getElementById('landing-screen');
const winScreen = document.getElementById('win-screen');
const startBtn = document.getElementById('start-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const messageToast = document.getElementById('message-toast');
const timerIndicator = document.getElementById('timer-indicator');
const levelIndicator = document.getElementById('level-indicator');
const funnyMessageEl = document.getElementById('funny-message');
const funnyEmojiEl = document.getElementById('funny-emoji');
const finalTimeEl = document.getElementById('final-time');

// Game State
let gameState = 'START'; // START, PLAYING, WIN
let currentLevel = 1;
let startTime = 0;
let timerInterval = null;
let lastFrameTime = 0;

// Render State
let offsetX = 0;
let offsetY = 0;
let mazeData = null;
let walls = [];
let startRect = null;
let endRect = null;
let currentAvatarEmoji = '😎';

// Game Config
let cols = 5;
let rows = 5;
const CELL_SIZE = 180;
const WALL_THICKNESS = 10;
const AVATAR_RADIUS = 30;

// SENSITIVITY
const SENSITIVITY = 0.5;

const FUNNY_MESSAGES = [
    "You're built different! 😤",
    "Maze status: DESTROYED! 🔥",
    "Easy peasy lemon squeezy! 🍋",
    "Who needs GPS anyway? 🗺️",
    "Einstein would be proud. 🧠",
    "Absolutely ridiculous gaming skills. 🎮",
    "Speedrun strats confirmed! ⚡"
];

const FUNNY_EMOJIS = ["🤪", "😎", "🥳", "🐶", "🚀", "💥", "🦧", "🌮"];

// Resize handled
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(frequency, type, duration) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playWinSound() {
    setTimeout(() => playBeep(440, 'sine', 0.2), 0);
    setTimeout(() => playBeep(554, 'sine', 0.2), 150);
    setTimeout(() => playBeep(659, 'sine', 0.4), 300);
    setTimeout(() => playBeep(880, 'sine', 0.6), 450);
}

function playLoseSound() {
    playBeep(150, 'sawtooth', 0.3);
    setTimeout(() => playBeep(100, 'sawtooth', 0.4), 150);
}

// --- Maze Generation (Recursive Backtracker) ---
function generateMaze(c, r) {
    const grid = [];
    for (let i = 0; i < c; i++) {
        let col = [];
        for (let j = 0; j < r; j++) {
            col.push({ x: i, y: j, walls: [true, true, true, true], visited: false });
        }
        grid.push(col);
    }

    let current = grid[0][0];
    current.visited = true;
    const stack = [];

    function checkNeighbors(cell) {
        const neighbors = [];
        const top = cell.y > 0 ? grid[cell.x][cell.y - 1] : null;
        const right = cell.x < c - 1 ? grid[cell.x + 1][cell.y] : null;
        const bottom = cell.y < r - 1 ? grid[cell.x][cell.y + 1] : null;
        const left = cell.x > 0 ? grid[cell.x - 1][cell.y] : null;

        if (top && !top.visited) neighbors.push({ cell: top, dir: 0 }); // 0: Top
        if (right && !right.visited) neighbors.push({ cell: right, dir: 1 }); // 1: Right
        if (bottom && !bottom.visited) neighbors.push({ cell: bottom, dir: 2 }); // 2: Bottom
        if (left && !left.visited) neighbors.push({ cell: left, dir: 3 }); // 3: Left

        if (neighbors.length > 0) {
            let r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        } else {
            return null;
        }
    }

    function removeWalls(a, b, dir) {
        if (dir === 0) { a.walls[0] = false; b.walls[2] = false; }
        else if (dir === 1) { a.walls[1] = false; b.walls[3] = false; }
        else if (dir === 2) { a.walls[2] = false; b.walls[0] = false; }
        else if (dir === 3) { a.walls[3] = false; b.walls[1] = false; }
    }

    while (true) {
        let next = checkNeighbors(current);
        if (next) {
            next.cell.visited = true;
            stack.push(current);
            removeWalls(current, next.cell, next.dir);
            current = next.cell;
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break;
        }
    }
    return grid;
}

function buildLevel() {
    walls = [];
    mazeData = generateMaze(cols, rows);

    // Build the wall rects
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const cell = mazeData[i][j];
            const px = i * CELL_SIZE;
            const py = j * CELL_SIZE;

            // Top wall
            if (cell.walls[0]) walls.push({ x: px, y: py, w: CELL_SIZE, h: WALL_THICKNESS });
            // Right wall
            if (cell.walls[1]) walls.push({ x: px + CELL_SIZE - WALL_THICKNESS, y: py, w: WALL_THICKNESS, h: CELL_SIZE });
            // Bottom wall
            if (cell.walls[2]) walls.push({ x: px, y: py + CELL_SIZE - WALL_THICKNESS, w: CELL_SIZE, h: WALL_THICKNESS });
            // Left wall
            if (cell.walls[3]) walls.push({ x: px, y: py, w: WALL_THICKNESS, h: CELL_SIZE });
        }
    }

    // Outer boundaries to be absolutely safe
    walls.push({ x: -CELL_SIZE, y: -CELL_SIZE, w: (cols + 2) * CELL_SIZE, h: CELL_SIZE }); // Top out of bounds
    walls.push({ x: -CELL_SIZE, y: rows * CELL_SIZE, w: (cols + 2) * CELL_SIZE, h: CELL_SIZE }); // Bottom
    walls.push({ x: -CELL_SIZE, y: 0, w: CELL_SIZE, h: rows * CELL_SIZE }); // Left
    walls.push({ x: cols * CELL_SIZE, y: 0, w: CELL_SIZE, h: rows * CELL_SIZE }); // Right

    // Define Start and End zones
    startRect = {
        x: WALL_THICKNESS,
        y: WALL_THICKNESS,
        w: CELL_SIZE - WALL_THICKNESS * 2,
        h: CELL_SIZE - WALL_THICKNESS * 2,
        cx: CELL_SIZE / 2,
        cy: CELL_SIZE / 2
    };

    endRect = {
        x: (cols - 1) * CELL_SIZE + WALL_THICKNESS,
        y: (rows - 1) * CELL_SIZE + WALL_THICKNESS,
        w: CELL_SIZE - WALL_THICKNESS * 2,
        h: CELL_SIZE - WALL_THICKNESS * 2
    };

    resetPlayer();
}

function resetPlayer() {
    // We want the player at startRect center.
    // The player is always fixed at canvas.width/2, canvas.height/2.
    // So: canvas.width/2 - offsetX = startRect.cx => offsetX = canvas.width/2 - startRect.cx
    offsetX = canvas.width / 2 - startRect.cx;
    offsetY = canvas.height / 2 - startRect.cy;
}

function spawnOofEmoji(x, y) {
    const emojis = ["😵", "💥", "🤕", "🤦", "🚫", "💢", "💀"];
    const el = document.createElement("div");
    el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    el.className = "floating-emoji";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function trigger3DHit(emoji) {
    const el = document.createElement("div");
    el.innerText = emoji;
    el.className = "hit-screen-emoji";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function spawnJoyousEmojis() {
    const emojis = ["🎉", "🥳", "🎊", "⭐", "🚀", "🏆", "🍕", "🎈", "✨", "🔥", "🤩"];
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const el = document.createElement("div");
            el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
            el.className = "joyous-emoji-3d";

            // Start from somewhat near the center
            const startX = (Math.random() - 0.5) * 50; // -25vw to 25vw
            const startY = (Math.random() - 0.5) * 50; // -25vh to 25vh

            // Explode outwards far beyond the screen
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 100; // 100vw to 200vw
            const endX = Math.cos(angle) * distance;
            const endY = Math.sin(angle) * distance;

            el.style.setProperty('--start-x', `${startX}vw`);
            el.style.setProperty('--start-y', `${startY}vh`);
            el.style.setProperty('--end-x', `${endX}vw`);
            el.style.setProperty('--end-y', `${endY}vh`);
            el.style.setProperty('--end-rot', `${(Math.random() - 0.5) * 1080}deg`);

            const duration = 1.5 + Math.random() * 2; // 1.5s to 3.5s
            el.style.animationDuration = `${duration}s`;

            document.body.appendChild(el);
            setTimeout(() => el.remove(), duration * 1000);
        }, Math.random() * 1000); // Stagger spawn times within 1 second
    }
}

// --- Collision Math ---
// Returns true if circle intersects rectangle (AABB)
function rectIntersectCircle(rx, ry, rw, rh, cx, cy, cr) {
    let testX = cx;
    let testY = cy;

    if (cx < rx) testX = rx;      // test left edge
    else if (cx > rx + rw) testX = rx + rw;   // right edge

    if (cy < ry) testY = ry;      // top edge
    else if (cy > ry + rh) testY = ry + rh;   // bottom edge

    let distX = cx - testX;
    let distY = cy - testY;
    let distance = Math.sqrt((distX * distX) + (distY * distY));

    return distance <= cr;
}

// --- Gameloop ---

function showToast(msg) {
    messageToast.innerText = msg;
    messageToast.classList.remove('hidden');
    messageToast.style.opacity = '1';

    setTimeout(() => {
        messageToast.style.opacity = '0';
        setTimeout(() => messageToast.classList.add('hidden'), 500);
    }, 1500);
}

function updateFrame(timestamp) {
    if (gameState !== 'PLAYING') return;

    // Draw
    ctx.fillStyle = '#0d0e15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Start Zone
    ctx.fillStyle = 'rgba(52, 199, 89, 0.3)'; // accent green
    ctx.shadowColor = '#34c759';
    ctx.shadowBlur = 10;
    ctx.fillRect(startRect.x, startRect.y, startRect.w, startRect.h);

    // Draw End Zone
    ctx.fillStyle = 'rgba(255, 59, 48, 0.4)'; // accent red
    ctx.shadowColor = '#ff3b30';
    ctx.shadowBlur = 15;
    ctx.fillRect(endRect.x, endRect.y, endRect.w, endRect.h);

    // Draw walls
    ctx.fillStyle = '#00f0ff'; // neon blue walls
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 5;

    ctx.beginPath();
    for (const w of walls) {
        ctx.rect(w.x, w.y, w.w, w.h);
    }
    ctx.fill();

    ctx.restore();

    // Draw Avatar -> fixed in screen center
    const avatarX = canvas.width / 2;
    const avatarY = canvas.height / 2;

    ctx.font = `${AVATAR_RADIUS * 2.5}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(currentAvatarEmoji, avatarX, avatarY);

    // Game Logic
    const mazeAvatarX = avatarX - offsetX;
    const mazeAvatarY = avatarY - offsetY;

    // Check collision
    let collided = false;
    for (const w of walls) {
        if (rectIntersectCircle(w.x, w.y, w.w, w.h, mazeAvatarX, mazeAvatarY, AVATAR_RADIUS * 0.8)) {
            collided = true;
            break;
        }
    }

    if (collided) {
        currentAvatarEmoji = '😵'; // change emotion on hit
        trigger3DHit('😵'); // throw emotion at screen
        spawnOofEmoji(canvas.width / 2, canvas.height / 2); // original oof
        playLoseSound();
        resetPlayer();
        const insults = ["BONK!", "Try not touching the wall.", "Oops!", "A glowing wall... brilliant!", "Resetting!"];
        showToast(insults[Math.floor(Math.random() * insults.length)]);

        // Return to normal face after short duration
        setTimeout(() => {
            currentAvatarEmoji = '😎';
        }, 1000);
    }

    // Check Win
    if (rectIntersectCircle(endRect.x + 10, endRect.y + 10, endRect.w - 20, endRect.h - 20, mazeAvatarX, mazeAvatarY, AVATAR_RADIUS)) {
        winGame();
    }

    // Timer update
    const t = (Date.now() - startTime) / 1000;
    timerIndicator.innerText = `Time: ${t.toFixed(1)}s`;

    requestAnimationFrame(updateFrame);
}

// --- Controls ---
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas && gameState === 'PLAYING') {
        offsetX -= e.movementX * SENSITIVITY;
        offsetY -= e.movementY * SENSITIVITY;
    }
});

function lockPointer() {
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && gameState === 'PLAYING') {
        // Paused essentially, or lost focus
        messageToast.innerText = "Mouse Unlocked (ESC). Click canvas to resume.";
        messageToast.classList.remove('hidden');
        messageToast.style.opacity = '1';
    } else {
        messageToast.style.opacity = '0';
    }
});

canvas.addEventListener('click', () => {
    if (gameState === 'PLAYING' && document.pointerLockElement !== canvas) {
        lockPointer();
    }
});


// --- State Management ---
function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    landingScreen.classList.remove('active');
    winScreen.classList.add('hidden');

    buildLevel();
    levelIndicator.innerText = `Level: ${currentLevel}`;
    startTime = Date.now();
    gameState = 'PLAYING';

    lockPointer();
    requestAnimationFrame(updateFrame);
}

function winGame() {
    gameState = 'WIN';
    document.exitPointerLock();
    playWinSound();

    const finalT = ((Date.now() - startTime) / 1000).toFixed(1);
    finalTimeEl.innerText = finalT;

    funnyMessageEl.innerText = FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];
    funnyEmojiEl.innerText = FUNNY_EMOJIS[Math.floor(Math.random() * FUNNY_EMOJIS.length)];

    winScreen.classList.remove('hidden');
    winScreen.classList.add('active');

    spawnJoyousEmojis();

    // Confetti!
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ff00ff', '#00ffff', '#48ff00']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ff00ff', '#00ffff', '#ff3b30']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

startBtn.addEventListener('click', startGame);

nextLevelBtn.addEventListener('click', () => {
    // Keep it easy as default
    currentLevel++;
    startGame();
});
