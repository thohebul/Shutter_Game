/* =========================================
   STARFALL — GALACTIC DEFENSE
   Pure HTML + CSS + JavaScript
========================================= */

"use strict";


/* =========================================
   DOM
========================================= */

const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");


/* =========================================
   SCREENS
========================================= */

const screens = {
    home: $("homeScreen"),
    levels: $("levelsScreen"),
    game: $("gameScreen"),
    settings: $("settingsScreen"),
    howToPlay: $("howToPlayScreen")
};

let screenHistory = [];


/* =========================================
   MODALS
========================================= */

const pauseModal = $("pauseModal");
const completeModal = $("completeModal");
const gameOverModal = $("gameOverModal");


/* =========================================
   SAVE DATA
========================================= */

const SAVE_KEY = "starfall_save_v1";

const defaultSave = {
    unlockedLevel: 1,
    completedLevels: [],
    highScore: 0,

    sound: true,
    music: true,
    vibration: true,

    sensitivity: 25,
    speed: 200,
    enemyTarget: 10
};

let saveData = loadSave();


function loadSave() {

    try {

        const raw = localStorage.getItem(SAVE_KEY);

        if (!raw) {
            return {
                ...defaultSave,
                completedLevels: []
            };
        }

        const parsed = JSON.parse(raw);

        return {
            ...defaultSave,
            ...parsed,
            completedLevels:
                Array.isArray(parsed.completedLevels)
                    ? parsed.completedLevels
                    : []
        };

    } catch (error) {

        console.warn("Save data error:", error);

        return {
            ...defaultSave,
            completedLevels: []
        };
    }
}


function saveGame() {

    localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(saveData)
    );
}


/* =========================================
   GAME STATE
========================================= */

let gameRunning = false;
let gamePaused = false;

let currentLevel = 1;

let score = 0;
let enemiesDestroyed = 0;

let animationId = null;
let lastTime = 0;

let enemySpawnTimer = 0;
let powerSpawnTimer = 0;

let bossActive = false;
let bossDefeated = false;

let gameOverReason = "";


/* =========================================
   PLAYER
========================================= */

const player = {
    x: 0,
    y: 0,

    width: 34,
    height: 46,

    speed: 330,

    health: 100,
    maxHealth: 100,

    fireCooldown: 0,

    fireRate: 0.22,

    invulnerable: 0,

    shield: 0,

    power: "NORMAL",
    powerTimer: 0,

    vx: 0,
    vy: 0
};


/* =========================================
   MOBILE TOUCH CONTROL
========================================= */

let touchTargetX = null;
let touchTargetY = null;
let touchActive = false;


/* =========================================
   OBJECT ARRAYS
========================================= */

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let powerUps = [];
let stars = [];

let boss = null;


/* =========================================
   INPUT
========================================= */

const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false
};


/* =========================================
   LEVEL DATA
========================================= */

function getLevelData(level) {

    const target =
        saveData.enemyTarget + (level - 1) * 2;

    const baseSpeed =
        Math.max(
            55,
            105 + (level - 1) * 7
        );

    const spawnRate =
        Math.max(
            280,
            900 - (level - 1) * 45
        );

    const enemyHealth =
        1 + Math.floor((level - 1) / 3);

    const bossLevel =
        level % 5 === 0;

    return {
        target,
        enemySpeed: baseSpeed,
        spawnRate,
        enemyHealth,
        bossLevel
    };
}


/* =========================================
   CANVAS
========================================= */

function resizeCanvas() {

    const dpr =
        Math.min(window.devicePixelRatio || 1, 2);

    canvas.width =
        Math.floor(window.innerWidth * dpr);

    canvas.height =
        Math.floor(window.innerHeight * dpr);

    canvas.style.width =
        window.innerWidth + "px";

    canvas.style.height =
        window.innerHeight + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    createStars();

    if (gameRunning && !gamePaused) {

        player.x =
            Math.min(
                Math.max(player.x, 25),
                window.innerWidth - 25
            );

        player.y =
            Math.min(
                Math.max(player.y, 80),
                window.innerHeight - 100
            );

        if (touchTargetX !== null) {
            touchTargetX =
                Math.min(
                    Math.max(touchTargetX, 25),
                    window.innerWidth - 25
                );
        }

        if (touchTargetY !== null) {
            touchTargetY =
                Math.min(
                    Math.max(touchTargetY, 80),
                    window.innerHeight - 70
                );
        }
    }
}


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================
   STARS
========================================= */

function createStars() {

    stars = [];

    const count =
        Math.min(
            180,
            Math.floor(
                (window.innerWidth * window.innerHeight) / 8500
            )
        );

    for (let i = 0; i < count; i++) {

        stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,

            size:
                Math.random() < 0.85
                    ? Math.random() * 1.5 + .3
                    : Math.random() * 2.5 + 1,

            speed:
                Math.random() * 55 + 15,

            alpha:
                Math.random() * .7 + .2
        });
    }
}


/* =========================================
   SCREEN NAVIGATION
========================================= */

function showScreen(name, remember = true) {

    Object.values(screens).forEach(
        screen => screen.classList.remove("active")
    );

    if (!screens[name]) {
        name = "home";
    }

    screens[name].classList.add("active");

    if (remember) {
        screenHistory.push(name);
    }

    updateHomeUI();
    updateLevelsUI();
    updateSettingsUI();
}


function goHome() {

    stopGame();

    hideAllModals();

    screenHistory = [];

    showScreen("home", false);
}


function goBackScreen() {

    if (gameRunning) {
        stopGame();
    }

    hideAllModals();

    screenHistory.pop();

    const previous =
        screenHistory.pop() || "home";

    showScreen(previous, false);
}


/* =========================================
   HOME UI
========================================= */

function updateHomeUI() {

    if ($("homeHighScore")) {
        $("homeHighScore").textContent =
            formatScore(saveData.highScore);
    }

    if ($("homeLevel")) {
        $("homeLevel").textContent =
            String(saveData.unlockedLevel).padStart(2, "0");
    }
}


/* =========================================
   LEVELS UI
========================================= */

function updateLevelsUI() {

    const grid = $("levelsGrid");

    if (!grid) return;

    grid.innerHTML = "";

    const totalLevels = 20;

    const completed =
        saveData.completedLevels.length;

    if ($("levelsCompleted")) {
        $("levelsCompleted").textContent =
            completed;
    }

    if ($("levelsUnlocked")) {
        $("levelsUnlocked").textContent =
            saveData.unlockedLevel;
    }

    for (let i = 1; i <= totalLevels; i++) {

        const unlocked =
            i <= saveData.unlockedLevel;

        const completedLevel =
            saveData.completedLevels.includes(i);

        const data = getLevelData(i);

        const card =
            document.createElement("button");

        card.className =
            "level-card" +
            (!unlocked ? " locked" : "") +
            (completedLevel ? " completed" : "");

        card.innerHTML = `
            <div class="level-number">
                SECTOR ${String(i).padStart(2, "0")}
            </div>

            <h3>
                MISSION ${String(i).padStart(2, "0")}
            </h3>

            <p>
                TARGET ${data.target}
                • THREAT ${Math.min(99, 20 + i * 4)}%
            </p>

            <div class="level-status">
                ${completedLevel
                ? "✓"
                : unlocked
                    ? "▶"
                    : "🔒"
            }
            </div>
        `;

        if (unlocked) {

            card.addEventListener(
                "click",
                () => startGame(i)
            );
        }

        grid.appendChild(card);
    }
}


/* =========================================
   SETTINGS UI
========================================= */

function updateSettingsUI() {

    if ($("soundToggle")) {
        $("soundToggle").checked =
            saveData.sound;
    }

    if ($("musicToggle")) {
        $("musicToggle").checked =
            saveData.music;
    }

    if ($("vibrationToggle")) {
        $("vibrationToggle").checked =
            saveData.vibration;
    }

    if ($("sensitivitySelect")) {
        $("sensitivitySelect").value =
            String(saveData.sensitivity);
    }

    if ($("speedSelect")) {
        $("speedSelect").value =
            String(saveData.speed);
    }

    if ($("enemyTargetSelect")) {
        $("enemyTargetSelect").value =
            String(saveData.enemyTarget);
    }
}


/* =========================================
   START GAME
========================================= */

function startGame(level = 1) {

    level =
        Math.max(
            1,
            Math.min(
                level,
                saveData.unlockedLevel
            )
        );

    currentLevel = level;

    score = 0;
    enemiesDestroyed = 0;

    gameRunning = true;
    gamePaused = false;

    bossActive = false;
    bossDefeated = false;

    boss = null;

    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    powerUps = [];

    enemySpawnTimer = 0;
    powerSpawnTimer = 0;

    player.health = player.maxHealth;
    player.fireCooldown = 0;
    player.invulnerable = 1;

    player.shield = 0;

    player.power = "NORMAL";
    player.powerTimer = 0;

    player.x =
        window.innerWidth / 2;

    player.y =
        window.innerHeight - 150;

    /* Reset mobile target */
    touchTargetX = player.x;
    touchTargetY = player.y;
    touchActive = false;

    lastTime = performance.now();

    hideAllModals();

    showScreen("game", false);

    updateGameUI();

    if (animationId) {
        cancelAnimationFrame(animationId);
    }

    animationId =
        requestAnimationFrame(gameLoop);
}


/* =========================================
   GAME LOOP
========================================= */

function gameLoop(time) {

    if (!gameRunning) {
        return;
    }

    const dt =
        Math.min(
            (time - lastTime) / 1000,
            0.035
        );

    lastTime = time;

    if (!gamePaused) {

        update(dt);
        draw();

    }

    animationId =
        requestAnimationFrame(gameLoop);
}


/* =========================================
   UPDATE
========================================= */

function update(dt) {

    updateStars(dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemyBullets(dt);
    updateEnemies(dt);
    updatePowerUps(dt);
    updateParticles(dt);

    spawnEnemies(dt);
    spawnPowerUps(dt);

    checkCollisions();

    if (player.invulnerable > 0) {
        player.invulnerable -= dt;
    }

    if (player.fireCooldown > 0) {
        player.fireCooldown -= dt;

        if (player.fireCooldown < 0) {
            player.fireCooldown = 0;
        }
    }

    if (player.powerTimer > 0) {

        player.powerTimer -= dt;

        if (player.powerTimer <= 0) {
            player.power = "NORMAL";
        }
    }

    const levelData =
        getLevelData(currentLevel);

    if (
        !bossActive &&
        enemiesDestroyed >= levelData.target
    ) {

        if (levelData.bossLevel) {
            spawnBoss();
        } else {
            completeLevel();
        }
    }
}


/* =========================================
   STARS UPDATE
========================================= */

function updateStars(dt) {

    for (const star of stars) {

        star.y += star.speed * dt;

        if (star.y > window.innerHeight + 5) {

            star.y = -5;

            star.x =
                Math.random() * window.innerWidth;
        }
    }
}


/* =========================================
   PLAYER UPDATE
   SMOOTH MOBILE MOVEMENT
========================================= */

function updatePlayer(dt) {

    let dx = 0;
    let dy = 0;

    if (keys.left) dx--;
    if (keys.right) dx++;
    if (keys.up) dy--;
    if (keys.down) dy++;

    if (dx !== 0 || dy !== 0) {

        const length =
            Math.hypot(dx, dy);

        dx /= length;
        dy /= length;

        player.x +=
            dx *
            player.speed *
            dt *
            (saveData.sensitivity / 25);

        player.y +=
            dy *
            player.speed *
            dt *
            (saveData.sensitivity / 25);
    }


    /* =====================================
       SMOOTH TOUCH FOLLOW
    ===================================== */

    if (
        touchActive &&
        touchTargetX !== null &&
        touchTargetY !== null
    ) {

        /*
            Exponential smoothing.

            Higher number = faster response.
            This keeps movement smooth without
            noticeable input delay.
        */

        const smooth =
            1 - Math.exp(-40 * dt);

        player.x +=
            (touchTargetX - player.x) *
            smooth;

        player.y +=
            (touchTargetY - player.y) *
            smooth;
    }


    /* =====================================
       SCREEN LIMIT
    ===================================== */

    player.x =
        Math.max(
            player.width,
            Math.min(
                window.innerWidth - player.width,
                player.x
            )
        );

    player.y =
        Math.max(
            70,
            Math.min(
                window.innerHeight - 70,
                player.y
            )
        );


    /* =====================================
       KEEP TARGET INSIDE SCREEN
    ===================================== */

    if (touchTargetX !== null) {

        touchTargetX =
            Math.max(
                player.width,
                Math.min(
                    window.innerWidth - player.width,
                    touchTargetX
                )
            );
    }

    if (touchTargetY !== null) {

        touchTargetY =
            Math.max(
                70,
                Math.min(
                    window.innerHeight - 70,
                    touchTargetY
                )
            );
    }


    /* =====================================
       NORMAL FIRE BUTTON / KEYBOARD
    ===================================== */

    if (keys.fire) {
        shoot();
    }
}


/* =========================================
   SHOOT
========================================= */

function shoot(force = false) {

    /*
        Normal shooting respects cooldown.

        Double-tap passes force=true,
        allowing an immediate shot.
    */

    if (
        !force &&
        player.fireCooldown > 0
    ) {
        return false;
    }

    player.fireCooldown =
        player.power === "RAPID"
            ? player.fireRate * .35
            : player.fireRate;

    const shots =
        player.power === "TRIPLE"
            ? [-12, 0, 12]
            : [0];

    for (const offset of shots) {

        bullets.push({
            x: player.x + offset,
            y: player.y - 24,

            vx:
                player.power === "TRIPLE"
                    ? offset * .5
                    : 0,

            vy: -650,

            radius: 3,

            damage:
                player.power === "POWER"
                    ? 2
                    : 1
        });
    }

    playSound("shoot");

    return true;
}


/* =========================================
   BULLETS
========================================= */

function updateBullets(dt) {

    for (let i = bullets.length - 1; i >= 0; i--) {

        const b = bullets[i];

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (
            b.y < -30 ||
            b.x < -30 ||
            b.x > window.innerWidth + 30
        ) {
            bullets.splice(i, 1);
        }
    }
}


function updateEnemyBullets(dt) {

    for (
        let i = enemyBullets.length - 1;
        i >= 0;
        i--
    ) {

        const b = enemyBullets[i];

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (
            b.y > window.innerHeight + 40 ||
            b.x < -40 ||
            b.x > window.innerWidth + 40
        ) {
            enemyBullets.splice(i, 1);
        }
    }
}


/* =========================================
   ENEMIES
========================================= */

function spawnEnemies(dt) {

    if (bossActive) return;

    const data =
        getLevelData(currentLevel);

    enemySpawnTimer -= dt * 1000;

    if (enemySpawnTimer > 0) {
        return;
    }

    enemySpawnTimer =
        data.spawnRate *
        (0.85 + Math.random() * .35);

    if (
        enemiesDestroyed >= data.target
    ) {
        return;
    }

    const typeRoll =
        Math.random();

    let type = "fighter";

    if (typeRoll > .82) {
        type = "zigzag";
    } else if (typeRoll > .62) {
        type = "tank";
    }

    let enemy;

    if (type === "tank") {

        enemy = {
            type,

            x:
                40 +
                Math.random() *
                (window.innerWidth - 80),

            y: -60,

            width: 42,
            height: 42,

            speed: data.enemySpeed * .55,

            health:
                data.enemyHealth + 2,

            maxHealth:
                data.enemyHealth + 2,

            shootTimer:
                700 + Math.random() * 900,

            phase:
                Math.random() * Math.PI * 2
        };

    } else {

        enemy = {
            type,

            x:
                30 +
                Math.random() *
                (window.innerWidth - 60),

            y: -50,

            width:
                type === "zigzag"
                    ? 34
                    : 31,

            height:
                type === "zigzag"
                    ? 34
                    : 31,

            speed:
                type === "zigzag"
                    ? data.enemySpeed * 1.15
                    : data.enemySpeed,

            health:
                data.enemyHealth,

            maxHealth:
                data.enemyHealth,

            shootTimer:
                500 + Math.random() * 1200,

            phase:
                Math.random() * Math.PI * 2
        };
    }

    enemies.push(enemy);
}


function updateEnemies(dt) {

    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {

        const enemy = enemies[i];

        enemy.y +=
            enemy.speed * dt;

        enemy.phase += dt * 3;

        if (enemy.type === "zigzag") {

            enemy.x +=
                Math.sin(enemy.phase) *
                100 *
                dt;
        }

        if (enemy.type === "fighter") {

            enemy.x +=
                Math.sin(enemy.phase) *
                22 *
                dt;
        }

        if (enemy.type === "tank") {

            enemy.x +=
                Math.sin(enemy.phase) *
                35 *
                dt;
        }

        enemy.shootTimer -=
            dt * 1000;

        if (enemy.shootTimer <= 0) {

            enemyShoot(enemy);

            enemy.shootTimer =
                800 +
                Math.random() * 1000;
        }

        if (
            enemy.y >
            window.innerHeight + 80
        ) {

            damagePlayer(8);

            enemies.splice(i, 1);
        }
    }
}


/* =========================================
   ENEMY SHOOT
========================================= */

function enemyShoot(enemy) {

    const dx =
        player.x - enemy.x;

    const dy =
        player.y - enemy.y;

    const distance =
        Math.hypot(dx, dy) || 1;

    const speed =
        220 +
        currentLevel * 8;

    enemyBullets.push({

        x: enemy.x,
        y: enemy.y + enemy.height / 2,

        vx: dx / distance * speed,
        vy: dy / distance * speed,

        radius: 4
    });

    playSound("enemyShoot");
}


/* =========================================
   COLLISIONS
========================================= */

function checkCollisions() {

    // Player bullets -> enemies
    for (
        let i = bullets.length - 1;
        i >= 0;
        i--
    ) {

        const bullet = bullets[i];

        let hit = false;

        for (
            let j = enemies.length - 1;
            j >= 0;
            j--
        ) {

            const enemy = enemies[j];

            if (
                circleRectCollision(
                    bullet.x,
                    bullet.y,
                    bullet.radius,
                    enemy.x - enemy.width / 2,
                    enemy.y - enemy.height / 2,
                    enemy.width,
                    enemy.height
                )
            ) {

                enemy.health -=
                    bullet.damage;

                createExplosion(
                    bullet.x,
                    bullet.y,
                    5
                );

                bullets.splice(i, 1);

                hit = true;

                if (enemy.health <= 0) {

                    destroyEnemy(
                        enemy,
                        j
                    );
                }

                break;
            }
        }

        if (hit) continue;

        // Player bullets -> boss
        if (bossActive && boss) {

            if (
                circleRectCollision(
                    bullet.x,
                    bullet.y,
                    bullet.radius,
                    boss.x - boss.width / 2,
                    boss.y - boss.height / 2,
                    boss.width,
                    boss.height
                )
            ) {

                boss.health -=
                    bullet.damage;

                bullets.splice(i, 1);

                createExplosion(
                    bullet.x,
                    bullet.y,
                    7
                );

                if (boss.health <= 0) {
                    defeatBoss();
                }
            }
        }
    }


    // Enemy bullets -> player
    for (
        let i = enemyBullets.length - 1;
        i >= 0;
        i--
    ) {

        const bullet =
            enemyBullets[i];

        if (
            circleRectCollision(
                bullet.x,
                bullet.y,
                bullet.radius,
                player.x - player.width / 2,
                player.y - player.height / 2,
                player.width,
                player.height
            )
        ) {

            enemyBullets.splice(i, 1);

            damagePlayer(10);

            createExplosion(
                bullet.x,
                bullet.y,
                8
            );
        }
    }


    // Enemies -> player
    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {

        const enemy = enemies[i];

        if (
            rectCollision(
                player.x - player.width / 2,
                player.y - player.height / 2,
                player.width,
                player.height,

                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            )
        ) {

            createExplosion(
                enemy.x,
                enemy.y,
                20
            );

            enemies.splice(i, 1);

            damagePlayer(25);
        }
    }


    // Power-ups
    for (
        let i = powerUps.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            powerUps[i];

        if (
            distance(
                p.x,
                p.y,
                player.x,
                player.y
            ) < 32
        ) {

            activatePowerUp(p.type);

            powerUps.splice(i, 1);
        }
    }
}


/* =========================================
   ENEMY DESTROY
========================================= */

function destroyEnemy(enemy, index) {

    enemies.splice(index, 1);

    enemiesDestroyed++;

    score +=
        enemy.type === "tank"
            ? 250
            : enemy.type === "zigzag"
                ? 180
                : 100;

    createExplosion(
        enemy.x,
        enemy.y,
        enemy.type === "tank"
            ? 28
            : 18
    );

    if (Math.random() < .12) {

        createPowerUp(
            enemy.x,
            enemy.y
        );
    }

    updateGameUI();

    playSound("explosion");
}


/* =========================================
   PLAYER DAMAGE
========================================= */

function damagePlayer(amount) {

    if (!gameRunning) return;

    if (player.invulnerable > 0) {
        return;
    }

    if (player.shield > 0) {

        player.shield -= amount;

        if (player.shield < 0) {
            player.shield = 0;
        }

        player.invulnerable = .35;

        playSound("shield");

        return;
    }

    player.health -= amount;

    player.invulnerable = .8;

    vibrate(80);

    playSound("damage");

    createExplosion(
        player.x,
        player.y,
        12
    );

    updateGameUI();

    if (player.health <= 0) {

        player.health = 0;

        endGame("destroyed");
    }
}


/* =========================================
   POWER-UPS
========================================= */

function spawnPowerUps(dt) {

    powerSpawnTimer -=
        dt * 1000;

    if (powerSpawnTimer > 0) {
        return;
    }

    powerSpawnTimer =
        7000 +
        Math.random() * 9000;

    if (Math.random() > .35) {
        return;
    }

    createPowerUp(
        30 +
        Math.random() *
        (window.innerWidth - 60),

        -30
    );
}


function createPowerUp(x, y) {

    const types = [
        "HEALTH",
        "SHIELD",
        "RAPID",
        "TRIPLE",
        "POWER"
    ];

    const type =
        types[
        Math.floor(
            Math.random() * types.length
        )
        ];

    powerUps.push({

        x,
        y,

        type,

        radius: 13,

        speed: 100,

        angle: 0
    });
}


function updatePowerUps(dt) {

    for (
        let i = powerUps.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            powerUps[i];

        p.y +=
            p.speed * dt;

        p.angle +=
            dt * 3;

        if (
            p.y >
            window.innerHeight + 40
        ) {
            powerUps.splice(i, 1);
        }
    }
}


function activatePowerUp(type) {

    if (type === "HEALTH") {

        player.health =
            Math.min(
                player.maxHealth,
                player.health + 30
            );

    } else if (type === "SHIELD") {

        player.shield = 60;

    } else {

        player.power = type;
        player.powerTimer = 8;
    }

    score += 50;

    vibrate(35);

    playSound("power");

    updateGameUI();
}


/* =========================================
   BOSS
========================================= */

function spawnBoss() {

    bossActive = true;

    bossDefeated = false;

    const levelData =
        getLevelData(currentLevel);

    boss = {

        x: window.innerWidth / 2,
        y: -100,

        width: 130,
        height: 95,

        health:
            80 +
            currentLevel * 20,

        maxHealth:
            80 +
            currentLevel * 20,

        speed: 80,

        direction: 1,

        shootTimer: 1000,

        phase: 0
    };

    if ($("bossHud")) {
        $("bossHud").classList.add("active");
    }

    if ($("bossName")) {
        $("bossName").textContent =
            "OVERLORD " +
            String(currentLevel / 5 | 0).padStart(2, "0");
    }

    playSound("boss");
}


function updateBoss(dt) {

    if (!bossActive || !boss) {
        return;
    }

    boss.phase += dt;

    if (boss.y < 130) {

        boss.y +=
            boss.speed * dt;

    } else {

        boss.x +=
            boss.direction *
            (90 + currentLevel * 4) *
            dt;

        if (
            boss.x >
            window.innerWidth - 80
        ) {
            boss.direction = -1;
        }

        if (boss.x < 80) {
            boss.direction = 1;
        }
    }

    boss.shootTimer -=
        dt * 1000;

    if (boss.shootTimer <= 0) {

        bossShoot();

        boss.shootTimer =
            Math.max(
                380,
                900 - currentLevel * 20
            );
    }

    updateBossUI();
}


function bossShoot() {

    if (!boss) return;

    const angles = [
        -0.35,
        -0.18,
        0,
        0.18,
        0.35
    ];

    const speed =
        230 +
        currentLevel * 7;

    for (const angle of angles) {

        enemyBullets.push({

            x: boss.x,
            y: boss.y + 30,

            vx: Math.sin(angle) * speed,

            vy: Math.cos(angle) * speed,

            radius: 5
        });
    }

    playSound("enemyShoot");
}


function defeatBoss() {

    if (!boss) return;

    bossDefeated = true;

    score +=
        2000 +
        currentLevel * 300;

    createExplosion(
        boss.x,
        boss.y,
        100
    );

    boss = null;

    bossActive = false;

    if ($("bossHud")) {
        $("bossHud").classList.remove("active");
    }

    vibrate(200);

    playSound("bossDeath");

    completeLevel();
}


/* =========================================
   BOSS UI
========================================= */

function updateBossUI() {

    if (!boss) return;

    const percent =
        Math.max(
            0,
            boss.health /
            boss.maxHealth *
            100
        );

    if ($("bossHealthBar")) {
        $("bossHealthBar").style.width =
            percent + "%";
    }
}


/* =========================================
   PARTICLES
========================================= */

function createExplosion(x, y, count = 15) {

    for (let i = 0; i < count; i++) {

        const angle =
            Math.random() *
            Math.PI * 2;

        const speed =
            Math.random() *
            220 +
            40;

        particles.push({

            x,
            y,

            vx:
                Math.cos(angle) *
                speed,

            vy:
                Math.sin(angle) *
                speed,

            life:
                Math.random() * .7 +
                .35,

            maxLife:
                1,

            size:
                Math.random() * 3 +
                1
        });
    }
}


function updateParticles(dt) {

    for (
        let i = particles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            particles[i];

        p.x +=
            p.vx * dt;

        p.y +=
            p.vy * dt;

        p.vx *=
            Math.pow(.01, dt);

        p.vy *=
            Math.pow(.01, dt);

        p.life -= dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}


/* =========================================
   DRAW
========================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );

    drawBackground();
    drawStars();

    drawPowerUps();

    drawEnemies();

    drawBoss();

    drawBullets();
    drawEnemyBullets();

    drawPlayer();

    drawParticles();
}


/* =========================================
   BACKGROUND
========================================= */

function drawBackground() {

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            window.innerHeight
        );

    gradient.addColorStop(
        0,
        "#020712"
    );

    gradient.addColorStop(
        .55,
        "#050c1b"
    );

    gradient.addColorStop(
        1,
        "#02040a"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );

    ctx.strokeStyle =
        "rgba(77,234,255,.035)";

    ctx.lineWidth = 1;

    const gridSize = 70;

    for (
        let x = 0;
        x < window.innerWidth;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(x, 0);
        ctx.lineTo(x, window.innerHeight);

        ctx.stroke();
    }

    for (
        let y = 0;
        y < window.innerHeight;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(0, y);
        ctx.lineTo(window.innerWidth, y);

        ctx.stroke();
    }
}


function drawStars() {

    for (const star of stars) {

        ctx.globalAlpha =
            star.alpha;

        ctx.fillStyle =
            "#dff8ff";

        ctx.beginPath();

        ctx.arc(
            star.x,
            star.y,
            star.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


/* =========================================
   DRAW PLAYER
========================================= */

function drawPlayer() {

    if (
        player.invulnerable > 0 &&
        Math.floor(
            player.invulnerable * 14
        ) % 2 === 0
    ) {
        return;
    }

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    const flame =
        ctx.createRadialGradient(
            0,
            24,
            0,
            0,
            24,
            35
        );

    flame.addColorStop(
        0,
        "rgba(77,234,255,.8)"
    );

    flame.addColorStop(
        1,
        "rgba(77,234,255,0)"
    );

    ctx.fillStyle = flame;

    ctx.beginPath();

    ctx.arc(
        0,
        25,
        32,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.beginPath();

    ctx.moveTo(0, -27);

    ctx.lineTo(18, 20);

    ctx.lineTo(8, 17);

    ctx.lineTo(0, 28);

    ctx.lineTo(-8, 17);

    ctx.lineTo(-18, 20);

    ctx.closePath();

    const shipGradient =
        ctx.createLinearGradient(
            -20,
            0,
            20,
            0
        );

    shipGradient.addColorStop(
        0,
        "#4b75ff"
    );

    shipGradient.addColorStop(
        .5,
        "#e9fbff"
    );

    shipGradient.addColorStop(
        1,
        "#49dff5"
    );

    ctx.fillStyle =
        shipGradient;

    ctx.shadowColor =
        "rgba(77,234,255,.8)";

    ctx.shadowBlur = 15;

    ctx.fill();

    ctx.shadowBlur = 0;


    ctx.beginPath();

    ctx.ellipse(
        0,
        -6,
        6,
        11,
        0,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#08162a";

    ctx.fill();

    ctx.strokeStyle =
        "#8ef4ff";

    ctx.lineWidth = 1.5;

    ctx.stroke();


    if (player.shield > 0) {

        ctx.strokeStyle =
            "rgba(84,240,255,.75)";

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            31,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    ctx.restore();
}


/* =========================================
   DRAW BULLETS
========================================= */

function drawBullets() {

    for (const b of bullets) {

        ctx.save();

        ctx.shadowColor =
            "#4deaff";

        ctx.shadowBlur = 12;

        ctx.strokeStyle =
            "#bdfaff";

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(
            b.x,
            b.y + 8
        );

        ctx.lineTo(
            b.x,
            b.y - 8
        );

        ctx.stroke();

        ctx.restore();
    }
}


function drawEnemyBullets() {

    for (const b of enemyBullets) {

        ctx.save();

        ctx.shadowColor =
            "#ff5470";

        ctx.shadowBlur = 10;

        ctx.fillStyle =
            "#ff7185";

        ctx.beginPath();

        ctx.arc(
            b.x,
            b.y,
            b.radius,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}


/* =========================================
   DRAW ENEMIES
========================================= */

function drawEnemies() {

    for (const enemy of enemies) {

        ctx.save();

        ctx.translate(
            enemy.x,
            enemy.y
        );

        if (enemy.type === "tank") {

            drawTankEnemy(enemy);

        } else if (
            enemy.type === "zigzag"
        ) {

            drawZigzagEnemy(enemy);

        } else {

            drawFighterEnemy(enemy);
        }

        ctx.restore();
    }
}


function drawFighterEnemy(enemy) {

    ctx.shadowColor =
        "#ff5470";

    ctx.shadowBlur = 14;

    ctx.fillStyle =
        "#ff4e6d";

    ctx.beginPath();

    ctx.moveTo(
        0,
        22
    );

    ctx.lineTo(
        17,
        -15
    );

    ctx.lineTo(
        6,
        -10
    );

    ctx.lineTo(
        0,
        -23
    );

    ctx.lineTo(
        -6,
        -10
    );

    ctx.lineTo(
        -17,
        -15
    );

    ctx.closePath();

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle =
        "#250a16";

    ctx.beginPath();

    ctx.arc(
        0,
        -7,
        5,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


function drawZigzagEnemy(enemy) {

    ctx.rotate(
        Math.sin(enemy.phase) * .25
    );

    ctx.fillStyle =
        "#b55cff";

    ctx.shadowColor =
        "#b55cff";

    ctx.shadowBlur = 16;

    ctx.beginPath();

    ctx.moveTo(
        0,
        22
    );

    ctx.lineTo(
        19,
        -14
    );

    ctx.lineTo(
        6,
        -7
    );

    ctx.lineTo(
        0,
        -22
    );

    ctx.lineTo(
        -6,
        -7
    );

    ctx.lineTo(
        -19,
        -14
    );

    ctx.closePath();

    ctx.fill();

    ctx.shadowBlur = 0;
}


function drawTankEnemy(enemy) {

    ctx.fillStyle =
        "#ff9b52";

    ctx.shadowColor =
        "#ff7748";

    ctx.shadowBlur = 18;

    ctx.beginPath();

    ctx.roundRect(
        -21,
        -21,
        42,
        42,
        8
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle =
        "#35150c";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        9,
        0,
        Math.PI * 2
    );

    ctx.fill();

    const percent =
        enemy.health /
        enemy.maxHealth;

    ctx.fillStyle =
        "rgba(255,255,255,.15)";

    ctx.fillRect(
        -20,
        27,
        40,
        3
    );

    ctx.fillStyle =
        "#ff9b52";

    ctx.fillRect(
        -20,
        27,
        40 * percent,
        3
    );
}


/* =========================================
   DRAW BOSS
========================================= */

function drawBoss() {

    if (!boss) return;

    ctx.save();

    ctx.translate(
        boss.x,
        boss.y
    );

    ctx.rotate(
        Math.sin(boss.phase) * .03
    );

    ctx.shadowColor =
        "#ff3d67";

    ctx.shadowBlur = 30;

    const gradient =
        ctx.createLinearGradient(
            -70,
            0,
            70,
            0
        );

    gradient.addColorStop(
        0,
        "#7d1839"
    );

    gradient.addColorStop(
        .5,
        "#ff526f"
    );

    gradient.addColorStop(
        1,
        "#7d1839"
    );

    ctx.fillStyle =
        gradient;

    ctx.beginPath();

    ctx.moveTo(
        0,
        -48
    );

    ctx.lineTo(
        60,
        -15
    );

    ctx.lineTo(
        72,
        35
    );

    ctx.lineTo(
        28,
        47
    );

    ctx.lineTo(
        0,
        28
    );

    ctx.lineTo(
        -28,
        47
    );

    ctx.lineTo(
        -72,
        35
    );

    ctx.lineTo(
        -60,
        -15
    );

    ctx.closePath();

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle =
        "#260914";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        22,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
        "#ffbdc8";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        7,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}


/* =========================================
   DRAW POWERUPS
========================================= */

function drawPowerUps() {

    for (const p of powerUps) {

        ctx.save();

        ctx.translate(
            p.x,
            p.y
        );

        ctx.rotate(
            p.angle
        );

        let symbol = "?";
        let glow = "#ffd85c";

        if (p.type === "HEALTH") {
            symbol = "+";
            glow = "#54f0b0";
        }

        if (p.type === "SHIELD") {
            symbol = "◆";
            glow = "#4deaff";
        }

        if (p.type === "RAPID") {
            symbol = "»";
            glow = "#ffd85c";
        }

        if (p.type === "TRIPLE") {
            symbol = "≡";
            glow = "#b55cff";
        }

        if (p.type === "POWER") {
            symbol = "P";
            glow = "#ff7f55";
        }

        ctx.shadowColor =
            glow;

        ctx.shadowBlur = 18;

        ctx.strokeStyle =
            glow;

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            p.radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.fillStyle =
            glow;

        ctx.font =
            "bold 12px system-ui";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            symbol,
            0,
            1
        );

        ctx.restore();
    }
}


/* =========================================
   PARTICLES DRAW
========================================= */

function drawParticles() {

    for (const p of particles) {

        ctx.globalAlpha =
            Math.max(
                0,
                p.life /
                p.maxLife
            );

        ctx.fillStyle =
            "#8ff6ff";

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            p.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


/* =========================================
   LEVEL COMPLETE
========================================= */

function completeLevel() {

    if (!gameRunning) return;

    gameRunning = false;

    touchActive = false;

    if (
        !saveData.completedLevels.includes(
            currentLevel
        )
    ) {

        saveData.completedLevels.push(
            currentLevel
        );
    }

    if (
        currentLevel >=
        saveData.unlockedLevel
    ) {

        saveData.unlockedLevel =
            Math.min(
                20,
                currentLevel + 1
            );
    }

    if (
        score >
        saveData.highScore
    ) {

        saveData.highScore =
            score;
    }

    saveGame();

    $("completedLevel").textContent =
        String(currentLevel).padStart(2, "0");

    $("completedEnemy").textContent =
        enemiesDestroyed;

    $("completedScore").textContent =
        formatScore(score);

    const next =
        Math.min(
            20,
            currentLevel + 1
        );

    $("nextLevelNumber").textContent =
        "MISSION " +
        String(next).padStart(2, "0");

    $("nextLevelDifficulty").textContent =
        "THREAT LEVEL: +" +
        Math.min(
            99,
            next * 4
        ) +
        "%";

    showModal(completeModal);

    playSound("complete");

    vibrate(120);
}


/* =========================================
   GAME OVER
========================================= */

function endGame(reason = "destroyed") {

    gameRunning = false;

    gamePaused = false;

    touchActive = false;

    gameOverReason = reason;

    if (
        score >
        saveData.highScore
    ) {

        saveData.highScore =
            score;

        saveGame();
    }

    $("deadLevel").textContent =
        String(currentLevel).padStart(2, "0");

    $("deadEnemy").textContent =
        enemiesDestroyed;

    $("deadScore").textContent =
        formatScore(score);

    $("deadHighScore").textContent =
        formatScore(
            saveData.highScore
        );

    showModal(gameOverModal);

    playSound("gameover");

    vibrate(180);
}


/* =========================================
   STOP GAME
========================================= */

function stopGame() {

    gameRunning = false;
    gamePaused = false;

    touchActive = false;

    touchTargetX = null;
    touchTargetY = null;

    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.fire = false;

    if (animationId) {

        cancelAnimationFrame(
            animationId
        );

        animationId = null;
    }
}


/* =========================================
   EXIT GAME
========================================= */

function exitGame() {

    stopGame();

    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.fire = false;

    hideAllModals();

    if (
        document.fullscreenElement &&
        document.exitFullscreen
    ) {
        document.exitFullscreen().catch(() => { });
    }

    try {
        window.close();
    } catch (error) { }

    setTimeout(() => {

        if (window.history.length > 1) {
            window.history.back();
        }

    }, 150);
}


/* =========================================
   PAUSE
========================================= */

function togglePause() {

    if (!gameRunning) {
        return;
    }

    if (gamePaused) {

        resumeGame();

    } else {

        pauseGame();
    }
}


function pauseGame() {

    if (!gameRunning) return;

    gamePaused = true;

    touchActive = false;

    showModal(pauseModal);
}


function resumeGame() {

    if (!gameRunning) return;

    gamePaused = false;

    hideAllModals();

    lastTime =
        performance.now();
}


/* =========================================
   UI
========================================= */

function updateGameUI() {

    if ($("gameLevel")) {

        $("gameLevel").textContent =
            String(currentLevel)
                .padStart(2, "0");
    }

    if ($("gameScore")) {

        $("gameScore").textContent =
            formatScore(score);
    }

    const data =
        getLevelData(currentLevel);

    if ($("enemyCurrent")) {
        $("enemyCurrent").textContent =
            enemiesDestroyed;
    }

    if ($("enemyTarget")) {
        $("enemyTarget").textContent =
            data.target;
    }

    if ($("healthValue")) {
        $("healthValue").textContent =
            Math.ceil(player.health);
    }

    if ($("healthBar")) {

        $("healthBar").style.width =
            Math.max(
                0,
                player.health
            ) + "%";
    }

    if ($("powerValue")) {

        $("powerValue").textContent =
            player.power;
    }

    if ($("speedValue")) {

        $("speedValue").textContent =
            Math.round(
                100 *
                (
                    200 /
                    Number(saveData.speed)
                )
            ) + "%";
    }

    updateBossUI();
}


/* =========================================
   MODALS
========================================= */

function showModal(modal) {

    hideAllModals();

    modal.classList.add("active");
}


function hideAllModals() {

    [
        pauseModal,
        completeModal,
        gameOverModal
    ].forEach(
        modal => {
            if (modal) {
                modal.classList.remove(
                    "active"
                );
            }
        }
    );
}


/* =========================================
   COLLISION HELPERS
========================================= */

function distance(
    x1,
    y1,
    x2,
    y2
) {

    return Math.hypot(
        x2 - x1,
        y2 - y1
    );
}


function circleRectCollision(
    cx,
    cy,
    radius,
    rx,
    ry,
    rw,
    rh
) {

    const closestX =
        Math.max(
            rx,
            Math.min(
                cx,
                rx + rw
            )
        );

    const closestY =
        Math.max(
            ry,
            Math.min(
                cy,
                ry + rh
            )
        );

    const dx =
        cx - closestX;

    const dy =
        cy - closestY;

    return (
        dx * dx +
        dy * dy
    ) <= radius * radius;
}


function rectCollision(
    x1,
    y1,
    w1,
    h1,
    x2,
    y2,
    w2,
    h2
) {

    return (
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2
    );
}


/* =========================================
   FORMAT SCORE
========================================= */

function formatScore(value) {

    return String(
        Math.max(
            0,
            Math.floor(value)
        )
    ).padStart(6, "0");
}


/* =========================================
   KEYBOARD
========================================= */

function setupKeyboard() {

    window.addEventListener(
        "keydown",
        event => {

            const key =
                event.key.toLowerCase();

            if (
                [
                    "arrowup",
                    "arrowdown",
                    "arrowleft",
                    "arrowright",
                    " ",
                    "w",
                    "a",
                    "s",
                    "d"
                ].includes(key)
            ) {

                event.preventDefault();
            }

            if (
                key === "arrowup" ||
                key === "w"
            ) {
                keys.up = true;
            }

            if (
                key === "arrowdown" ||
                key === "s"
            ) {
                keys.down = true;
            }

            if (
                key === "arrowleft" ||
                key === "a"
            ) {
                keys.left = true;
            }

            if (
                key === "arrowright" ||
                key === "d"
            ) {
                keys.right = true;
            }

            if (
                key === " " ||
                key === "f"
            ) {
                keys.fire = true;
            }

            if (key === "escape") {

                if (gameRunning) {
                    togglePause();
                }
            }
        }
    );


    window.addEventListener(
        "keyup",
        event => {

            const key =
                event.key.toLowerCase();

            if (
                key === "arrowup" ||
                key === "w"
            ) {
                keys.up = false;
            }

            if (
                key === "arrowdown" ||
                key === "s"
            ) {
                keys.down = false;
            }

            if (
                key === "arrowleft" ||
                key === "a"
            ) {
                keys.left = false;
            }

            if (
                key === "arrowright" ||
                key === "d"
            ) {
                keys.right = false;
            }

            if (
                key === " " ||
                key === "f"
            ) {
                keys.fire = false;
            }
        }
    );
}


/* =========================================
   DIRECTION BUTTONS
========================================= */

function setupDirectionButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-direction]"
        );

    buttons.forEach(button => {

        const direction =
            button.dataset.direction;

        const start = event => {

            event.preventDefault();

            if (!gameRunning || gamePaused) {
                return;
            }

            if (
                button.setPointerCapture &&
                event.pointerId !== undefined
            ) {

                try {
                    button.setPointerCapture(
                        event.pointerId
                    );
                } catch (error) { }
            }

            keys[direction] = true;
        };


        const end = event => {

            event.preventDefault();

            keys[direction] = false;
        };


        button.addEventListener(
            "pointerdown",
            start,
            {
                passive: false
            }
        );

        button.addEventListener(
            "pointerup",
            end,
            {
                passive: false
            }
        );

        button.addEventListener(
            "pointercancel",
            end,
            {
                passive: false
            }
        );

        button.addEventListener(
            "lostpointercapture",
            end,
            {
                passive: false
            }
        );
    });


    const fire =
        $("fireBtn");

    if (fire) {

        fire.addEventListener(
            "pointerdown",
            event => {

                event.preventDefault();

                if (!gameRunning || gamePaused) {
                    return;
                }

                keys.fire = true;
            },
            {
                passive: false
            }
        );


        [
            "pointerup",
            "pointercancel",
            "pointerleave"
        ].forEach(
            type => {

                fire.addEventListener(
                    type,
                    event => {

                        event.preventDefault();

                        keys.fire = false;
                    },
                    {
                        passive: false
                    }
                );
            }
        );
    }
}


/* =========================================
   SWIPE + DOUBLE TAP FIRE
========================================= */

function setupSwipe() {

    /*
        Prevent browser scrolling / zooming
        while touching the game canvas.
    */

    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.webkitUserSelect = "none";


    let touchId = null;

    let lastX = 0;
    let lastY = 0;

    let touchStartX = 0;
    let touchStartY = 0;

    let touchMoved = false;

    let tapStartedOnRocket = false;

    let lastTapTime = 0;

    let lastTapX = 0;
    let lastTapY = 0;


    /* =========================================
       TOUCH START
    ========================================= */

    canvas.addEventListener(
        "touchstart",
        event => {

            if (
                !gameRunning ||
                gamePaused
            ) {
                return;
            }

            /*
                Only use the first finger.

                This prevents multi-touch from
                confusing the movement system.
            */

            if (touchId !== null) {
                return;
            }

            const touch =
                event.changedTouches[0];

            if (!touch) {
                return;
            }

            touchId =
                touch.identifier;

            lastX =
                touch.clientX;

            lastY =
                touch.clientY;

            touchStartX =
                touch.clientX;

            touchStartY =
                touch.clientY;

            touchMoved = false;


            /* =================================
               CHECK TAP STARTED ON ROCKET
            ================================= */

            const rocketTouchRadius =
                Math.max(
                    55,
                    player.width + 20
                );

            tapStartedOnRocket =
                Math.hypot(
                    touch.clientX - player.x,
                    touch.clientY - player.y
                ) <= rocketTouchRadius;


            /* =================================
               INITIALIZE SMOOTH TARGET
            ================================= */

            touchTargetX =
                player.x;

            touchTargetY =
                player.y;

            touchActive = true;


            /*
                Stop keyboard/direction movement
                while using touch.
            */

            keys.up = false;
            keys.down = false;
            keys.left = false;
            keys.right = false;


            event.preventDefault();
        },
        {
            passive: false
        }
    );


    /* =========================================
       TOUCH MOVE
    ========================================= */

    canvas.addEventListener(
        "touchmove",
        event => {

            if (
                !gameRunning ||
                gamePaused ||
                touchId === null
            ) {
                return;
            }

            let touch = null;

            for (
                const t of event.changedTouches
            ) {

                if (
                    t.identifier === touchId
                ) {

                    touch = t;

                    break;
                }
            }

            if (!touch) {
                return;
            }


            const dx =
                touch.clientX - lastX;

            const dy =
                touch.clientY - lastY;


            /* =================================
               DETECT REAL SWIPE
            ================================= */

            const totalMove =
                Math.hypot(
                    touch.clientX - touchStartX,
                    touch.clientY - touchStartY
                );

            if (totalMove > 8) {

                touchMoved = true;

                /*
                    A swipe must never become
                    a double tap.
                */

                lastTapTime = 0;
                lastTapX = 0;
                lastTapY = 0;
            }


            /* =================================
               SMOOTH TARGET MOVEMENT
            ================================= */

            const sensitivity =
                Math.max(
                    0.5,
                    Number(
                        saveData.sensitivity
                    ) / 25
                );


            if (
                touchTargetX === null ||
                touchTargetY === null
            ) {

                touchTargetX =
                    player.x;

                touchTargetY =
                    player.y;
            }


            /*
                IMPORTANT:

                Do NOT directly move player here.

                We move the target instead.
                updatePlayer() smoothly follows it.
            */

            touchTargetX +=
                dx * sensitivity;

            touchTargetY +=
                dy * sensitivity;


            /* =================================
               LIMIT TARGET
            ================================= */

            touchTargetX =
                Math.max(
                    player.width,
                    Math.min(
                        window.innerWidth -
                        player.width,
                        touchTargetX
                    )
                );

            touchTargetY =
                Math.max(
                    70,
                    Math.min(
                        window.innerHeight -
                        70,
                        touchTargetY
                    )
                );


            lastX =
                touch.clientX;

            lastY =
                touch.clientY;


            event.preventDefault();
        },
        {
            passive: false
        }
    );


    /* =========================================
       TOUCH END / CANCEL
    ========================================= */

    const endTouch = event => {

        if (touchId === null) {
            return;
        }


        let endedTouch = null;

        for (
            const touch of event.changedTouches
        ) {

            if (
                touch.identifier ===
                touchId
            ) {

                endedTouch = touch;

                break;
            }
        }

        if (!endedTouch) {
            return;
        }


        /* =====================================
           FINAL MOVEMENT
        ===================================== */

        const finalMove =
            Math.hypot(
                endedTouch.clientX -
                touchStartX,

                endedTouch.clientY -
                touchStartY
            );


        const isTap =
            !touchMoved &&
            finalMove <= 10;


        /* =====================================
           TAP / DOUBLE TAP
        ===================================== */

        if (
            isTap &&
            tapStartedOnRocket
        ) {

            const now =
                performance.now();

            const timeSinceLastTap =
                now - lastTapTime;

            const tapDistance =
                lastTapTime > 0
                    ? Math.hypot(
                        endedTouch.clientX -
                        lastTapX,

                        endedTouch.clientY -
                        lastTapY
                    )
                    : Infinity;


            /*
                DOUBLE TAP

                Maximum gap: 450ms
                Maximum distance: 100px
            */

            if (
                lastTapTime > 0 &&
                timeSinceLastTap <= 450 &&
                tapDistance <= 100
            ) {

                if (
                    gameRunning &&
                    !gamePaused
                ) {

                    /*
                        THIS IS THE IMPORTANT FIX.

                        Instead of simply calling:

                            shoot();

                        we force the shot.

                        This guarantees that an old
                        fireCooldown cannot block
                        the double-tap shot.
                    */

                    player.fireCooldown = 0;

                    shoot(true);

                    vibrate(25);
                }


                /*
                    Reset double-tap state.
                */

                lastTapTime = 0;
                lastTapX = 0;
                lastTapY = 0;

            } else {

                /*
                    First tap.

                    Save it and wait for second tap.
                */

                lastTapTime =
                    now;

                lastTapX =
                    endedTouch.clientX;

                lastTapY =
                    endedTouch.clientY;
            }

        } else if (touchMoved) {

            /*
                Swipe is NOT a tap.
            */

            lastTapTime = 0;
            lastTapX = 0;
            lastTapY = 0;
        }


        /* =====================================
           RESET TOUCH STATE
        ===================================== */

        touchId = null;

        touchMoved = false;

        tapStartedOnRocket = false;

        touchActive = false;

        /*
            Keep target synchronized with the
            rocket after finger release.
        */

        touchTargetX =
            player.x;

        touchTargetY =
            player.y;


        keys.up = false;
        keys.down = false;
        keys.left = false;
        keys.right = false;


        event.preventDefault();
    };


    canvas.addEventListener(
        "touchend",
        endTouch,
        {
            passive: false
        }
    );


    canvas.addEventListener(
        "touchcancel",
        endTouch,
        {
            passive: false
        }
    );
}


/* =========================================
   SETTINGS EVENTS
========================================= */

function setupSettings() {

    if ($("soundToggle")) {

        $("soundToggle")
            .addEventListener(
                "change",
                event => {

                    saveData.sound =
                        event.target.checked;

                    saveGame();
                }
            );
    }


    if ($("musicToggle")) {

        $("musicToggle")
            .addEventListener(
                "change",
                event => {

                    saveData.music =
                        event.target.checked;

                    saveGame();
                }
            );
    }


    if ($("vibrationToggle")) {

        $("vibrationToggle")
            .addEventListener(
                "change",
                event => {

                    saveData.vibration =
                        event.target.checked;

                    saveGame();
                }
            );
    }


    if ($("sensitivitySelect")) {

        $("sensitivitySelect")
            .addEventListener(
                "change",
                event => {

                    saveData.sensitivity =
                        Number(event.target.value);

                    saveGame();
                }
            );
    }


    if ($("speedSelect")) {

        $("speedSelect")
            .addEventListener(
                "change",
                event => {

                    saveData.speed =
                        Number(event.target.value);

                    saveGame();
                }
            );
    }


    if ($("enemyTargetSelect")) {

        $("enemyTargetSelect")
            .addEventListener(
                "change",
                event => {

                    saveData.enemyTarget =
                        Number(event.target.value);

                    saveGame();
                }
            );
    }


    if ($("resetProgressBtn")) {

        $("resetProgressBtn")
            .addEventListener(
                "click",
                () => {

                    const confirmed =
                        confirm(
                            "Reset all STARFALL progress?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    localStorage.removeItem(
                        SAVE_KEY
                    );

                    saveData =
                        loadSave();

                    updateHomeUI();
                    updateLevelsUI();
                    updateSettingsUI();
                }
            );
    }
}


/* =========================================
   MAIN EVENTS
========================================= */

function setupEvents() {

    setupDirectionButtons();

    setupKeyboard();

    setupSwipe();

    setupSettings();


    /* HOME */

    if ($("exitGameBtn")) {

        $("exitGameBtn")
            .addEventListener(
                "click",
                exitGame
            );
    }


    if ($("startGameBtn")) {

        $("startGameBtn")
            .addEventListener(
                "click",
                () => {

                    startGame(
                        saveData.unlockedLevel
                    );
                }
            );
    }


    if ($("levelsBtn")) {

        $("levelsBtn")
            .addEventListener(
                "click",
                () => {

                    updateLevelsUI();

                    showScreen(
                        "levels"
                    );
                }
            );
    }


    if ($("settingsBtn")) {

        $("settingsBtn")
            .addEventListener(
                "click",
                () => {

                    updateSettingsUI();

                    showScreen(
                        "settings"
                    );
                }
            );
    }


    if ($("howToPlayBtn")) {

        $("howToPlayBtn")
            .addEventListener(
                "click",
                () => {

                    showScreen(
                        "howToPlay"
                    );
                }
            );
    }


    /* LEVELS X BUTTON */

    if ($("levelsCloseBtn")) {

        $("levelsCloseBtn")
            .addEventListener(
                "click",
                () => {

                    stopGame();
                    hideAllModals();

                    screenHistory = [];

                    showScreen(
                        "home",
                        false
                    );
                }
            );
    }


    /* PAUSE */

    if ($("pauseBtn")) {

        $("pauseBtn")
            .addEventListener(
                "click",
                togglePause
            );
    }


    if ($("resumeBtn")) {

        $("resumeBtn")
            .addEventListener(
                "click",
                resumeGame
            );
    }


    /* PAUSE RESTART */

    if ($("pauseRestartBtn")) {

        $("pauseRestartBtn")
            .addEventListener(
                "click",
                () => {

                    hideAllModals();

                    startGame(
                        currentLevel
                    );
                }
            );
    }


    /* PAUSE CANCEL = HOME */

    if ($("pauseCancelBtn")) {

        $("pauseCancelBtn")
            .addEventListener(
                "click",
                () => {

                    stopGame();
                    hideAllModals();

                    screenHistory = [];

                    showScreen(
                        "home",
                        false
                    );
                }
            );
    }


    /* COMPLETE NEXT */

    if ($("nextLevelBtn")) {

        $("nextLevelBtn")
            .addEventListener(
                "click",
                () => {

                    hideAllModals();

                    startGame(
                        Math.min(
                            20,
                            currentLevel + 1
                        )
                    );
                }
            );
    }


    /* COMPLETE LEVELS */

    if ($("completeLevelsBtn")) {

        $("completeLevelsBtn")
            .addEventListener(
                "click",
                () => {

                    stopGame();
                    hideAllModals();

                    updateLevelsUI();

                    screenHistory = [];

                    showScreen(
                        "levels",
                        false
                    );
                }
            );
    }


    /* COMPLETE HOME */

    if ($("completeHomeBtn")) {

        $("completeHomeBtn")
            .addEventListener(
                "click",
                goHome
            );
    }


    /* GAME OVER RETRY */

    if ($("retryBtn")) {

        $("retryBtn")
            .addEventListener(
                "click",
                () => {

                    hideAllModals();

                    startGame(
                        currentLevel
                    );
                }
            );
    }


    /* GAME OVER LEVELS */

    if ($("gameOverLevelsBtn")) {

        $("gameOverLevelsBtn")
            .addEventListener(
                "click",
                () => {

                    stopGame();
                    hideAllModals();

                    updateLevelsUI();

                    screenHistory = [];

                    showScreen(
                        "levels",
                        false
                    );
                }
            );
    }


    /* GAME OVER HOME */

    if ($("gameOverHomeBtn")) {

        $("gameOverHomeBtn")
            .addEventListener(
                "click",
                goHome
            );
    }


    /* GENERIC BACK */

    document
        .querySelectorAll(
            "[data-back]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            button.dataset.back;

                        if (
                            target === "home"
                        ) {

                            goHome();

                        } else {

                            goBackScreen();
                        }
                    }
                );
            }
        );
}


/* =========================================
   SOUND
========================================= */

let audioContext = null;


function getAudioContext() {

    if (!audioContext) {

        const AudioCtx =
            window.AudioContext ||
            window.webkitAudioContext;

        if (AudioCtx) {
            audioContext =
                new AudioCtx();
        }
    }

    return audioContext;
}


function playSound(type) {

    if (!saveData.sound) {
        return;
    }

    try {

        const audio =
            getAudioContext();

        if (!audio) return;

        if (
            audio.state ===
            "suspended"
        ) {
            audio.resume();
        }

        const oscillator =
            audio.createOscillator();

        const gain =
            audio.createGain();

        oscillator.connect(gain);

        gain.connect(
            audio.destination
        );

        let frequency = 440;
        let duration = .08;
        let wave = "sine";

        switch (type) {

            case "shoot":
                frequency = 650;
                duration = .045;
                wave = "square";
                break;

            case "enemyShoot":
                frequency = 180;
                duration = .07;
                wave = "sawtooth";
                break;

            case "explosion":
                frequency = 80;
                duration = .16;
                wave = "sawtooth";
                break;

            case "damage":
                frequency = 100;
                duration = .22;
                wave = "square";
                break;

            case "shield":
                frequency = 520;
                duration = .13;
                wave = "sine";
                break;

            case "power":
                frequency = 780;
                duration = .18;
                wave = "triangle";
                break;

            case "complete":
                frequency = 900;
                duration = .3;
                wave = "triangle";
                break;

            case "boss":
                frequency = 70;
                duration = .45;
                wave = "sawtooth";
                break;

            case "bossDeath":
                frequency = 45;
                duration = .6;
                wave = "sawtooth";
                break;

            case "gameover":
                frequency = 90;
                duration = .45;
                wave = "sawtooth";
                break;
        }

        oscillator.type = wave;

        oscillator.frequency.setValueAtTime(
            frequency,
            audio.currentTime
        );

        gain.gain.setValueAtTime(
            .0001,
            audio.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            .07,
            audio.currentTime + .01
        );

        gain.gain.exponentialRampToValueAtTime(
            .0001,
            audio.currentTime + duration
        );

        oscillator.start();

        oscillator.stop(
            audio.currentTime +
            duration
        );

    } catch (error) {
        // Audio is optional.
    }
}


/* =========================================
   VIBRATION
========================================= */

function vibrate(duration) {

    if (
        saveData.vibration &&
        navigator.vibrate
    ) {

        navigator.vibrate(
            duration
        );
    }
}


/* =========================================
   VISIBILITY
========================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden &&
            gameRunning &&
            !gamePaused
        ) {

            pauseGame();
        }
    }
);


/* =========================================
   PREVENT MOBILE ZOOM
========================================= */

document.addEventListener(
    "gesturestart",
    event => {
        event.preventDefault();
    }
);

document.addEventListener(
    "dblclick",
    event => {
        event.preventDefault();
    },
    {
        passive: false
    }
);


/* =========================================
   INITIALIZE
========================================= */

function init() {

    resizeCanvas();

    setupEvents();

    updateHomeUI();
    updateLevelsUI();
    updateSettingsUI();

    showScreen(
        "home",
        false
    );
}


init();