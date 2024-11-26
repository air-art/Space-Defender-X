// Game configuration
const CONFIG = {
    difficulties: {
        easy: {
            alienSpeed: 0.8,
            spawnRate: 2500,
            scoreMultiplier: 1,
            projectileSpeed: 8,
            healthLoss: 5,
            missedAlienPenalty: 3
        },
        normal: {
            alienSpeed: 1.2,
            spawnRate: 2000,
            scoreMultiplier: 1.5,
            projectileSpeed: 10,
            healthLoss: 10,
            missedAlienPenalty: 5
        },
        hard: {
            alienSpeed: 1.8,
            spawnRate: 1500,
            scoreMultiplier: 2,
            projectileSpeed: 12,
            healthLoss: 15,
            missedAlienPenalty: 8
        }
    },
    waveConfig: {
        normalWave: { 
            spawnMultiplier: 0.9,
            speedIncrease: 1.2,
            healthIncrease: 1
        },
        bossWave: { 
            spawnMultiplier: 0.5, 
            alienHealth: 3,
            speedIncrease: 1.5
        }
    },
    projectileSpeed: 10,
    shipSpeed: 6
};

let gameState = {
    score: 0,
    health: 100,
    level: 1,
    wave: 1,
    difficulty: 'normal',
    isPaused: false,
    isGameOver: false,
    lastShot: 0,
    shootingCooldown: 250, // Time between shots in milliseconds
    aliens: [],
    projectiles: [],
    powerUps: [],
    activePowerUps: {},
    powerUpSpawned: false,
    spawnInterval: null,
    shootingPattern: null,
    isBossWave: false,
    bossesDefeated: 0,
    difficultyLevel: 1
};

const gameArea = document.getElementById('game-area');
const ship = document.getElementById('spaceship');
let shipPosition = {
    x: gameArea.offsetWidth / 2 - 20,
    y: gameArea.offsetHeight - 80
};

// Movement patterns configuration
const MOVEMENT_PATTERNS = {
    basic: {
        zigzag: (alien, time) => {
            alien.x += Math.sin(time * 0.1) * 5;
            alien.y += 2;
        },
        sideToSide: (alien, time) => {
            alien.x += Math.sin(time * 0.05) * 8;
            alien.y += 1.5;
        },
        circular: (alien, time) => {
            alien.x += Math.cos(time * 0.05) * 6;
            alien.y += Math.sin(time * 0.05) * 3 + 1;
        }
    },
    advanced: {
        spiral: (alien, time) => {
            const radius = 50 + Math.sin(time * 0.02) * 30;
            alien.x += Math.cos(time * 0.1) * radius * 0.1;
            alien.y += Math.sin(time * 0.1) * radius * 0.1 + 2;
        },
        figure8: (alien, time) => {
            alien.x += Math.sin(time * 0.1) * 8;
            alien.y += Math.cos(time * 0.05) * 4 + 2;
        },
        bounce: (alien, time) => {
            if (alien.x <= 0 || alien.x >= window.innerWidth - 50) {
                alien.directionX *= -1;
            }
            alien.x += 5 * alien.directionX;
            alien.y += Math.sin(time * 0.1) * 3 + 2;
        }
    },
    expert: {
        swarm: (alien, time, index, totalAliens) => {
            const angle = (index / totalAliens) * Math.PI * 2 + time * 0.05;
            const radius = 100 + Math.sin(time * 0.02) * 50;
            alien.x += Math.cos(angle) * radius * 0.05;
            alien.y += Math.sin(angle) * radius * 0.05 + 1.5;
        },
        chaos: (alien, time) => {
            alien.x += Math.sin(time * 0.1) * 10 * Math.cos(time * 0.05);
            alien.y += Math.cos(time * 0.1) * 5 + Math.sin(time * 0.05) * 3 + 2;
        },
        pursuit: (alien, time, _, __, playerX) => {
            const dx = playerX - alien.x;
            alien.x += Math.sign(dx) * 3;
            alien.y += Math.sin(time * 0.1) * 4 + 2;
        }
    },
    boss: {
        multiPhase: (boss, time) => {
            switch(boss.phase) {
                case 1:
                    // Phase 1: Figure-8 pattern
                    boss.x += Math.sin(time * 0.05) * 10;
                    boss.y += Math.cos(time * 0.025) * 5 + Math.sin(time * 0.05) * 3;
                    break;
                case 2:
                    // Phase 2: Aggressive pursuit with spiral
                    const angle = time * 0.1;
                    const radius = 100 + Math.sin(time * 0.02) * 50;
                    boss.x += Math.cos(angle) * radius * 0.08;
                    boss.y += Math.sin(angle) * radius * 0.08;
                    break;
                case 3:
                    // Phase 3: Chaos pattern with random bursts
                    boss.x += Math.sin(time * 0.15) * 15 * Math.cos(time * 0.1);
                    boss.y += Math.cos(time * 0.15) * 10 + Math.sin(time * 0.1) * 5;
                    if (Math.random() < 0.02) {
                        boss.performBurstAttack();
                    }
                    break;
            }
        },
        teleport: (boss, time) => {
            if (time % 120 === 0) {
                boss.x = Math.random() * (window.innerWidth - 100);
                boss.y = Math.random() * (window.innerHeight / 2);
                boss.performAreaAttack();
            }
        }
    }
};

// Update alien movement based on wave progression
function updateAlienMovement(alien, time) {
    const waveLevel = Math.floor(gameState.wave / 3);
    const patterns = getPatternsByDifficulty(waveLevel);
    
    if (alien.isBoss) {
        updateBossMovement(alien, time);
    } else {
        const pattern = patterns[alien.patternIndex % patterns.length];
        pattern(alien, time, alien.index, gameState.aliens.length, shipPosition.x);
    }
}

function getPatternsByDifficulty(waveLevel) {
    const patterns = [];
    
    // Basic patterns (always available)
    patterns.push(...Object.values(MOVEMENT_PATTERNS.basic));
    
    // Advanced patterns (after first boss)
    if (waveLevel >= 1) {
        patterns.push(...Object.values(MOVEMENT_PATTERNS.advanced));
    }
    
    // Expert patterns (after second boss)
    if (waveLevel >= 2) {
        patterns.push(...Object.values(MOVEMENT_PATTERNS.expert));
    }
    
    return patterns;
}

function updateBossMovement(boss, time) {
    // Update boss phase based on health
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent <= 0.66 && boss.phase === 1) {
        boss.phase = 2;
        boss.speed *= 1.3;
    } else if (healthPercent <= 0.33 && boss.phase === 3) {
        boss.phase = 3;
        boss.speed *= 1.5;
    }

    // Apply boss movement pattern
    MOVEMENT_PATTERNS.boss.multiPhase(boss, time);
    
    // Add teleport ability in later phases
    if (boss.phase >= 2) {
        MOVEMENT_PATTERNS.boss.teleport(boss, time);
    }
}

// Enhanced alien creation with pattern assignment
function createAlien(isBoss = false) {
    const alien = document.createElement('div');
    alien.className = isBoss ? 'alien boss' : 'alien';
    
    const alienObj = {
        element: alien,
        x: Math.random() * (window.innerWidth - 50),
        y: -50,
        health: isBoss ? 100 : 10,
        isBoss: isBoss,
        phase: 1,
        speed: isBoss ? 2 : 3,
        directionX: Math.random() < 0.5 ? -1 : 1,
        patternIndex: Math.floor(Math.random() * getPatternsByDifficulty(Math.floor(gameState.wave / 3)).length),
        index: gameState.aliens.length,
        lastShot: 0,
        performBurstAttack: function() {
            // Implement burst attack logic
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const angle = (i / 8) * Math.PI * 2;
                    createAlienProjectile(this.x, this.y, angle);
                }, i * 100);
            }
        },
        performAreaAttack: function() {
            // Implement area attack logic
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                createAlienProjectile(this.x, this.y, angle);
            }
        }
    };

    if (isBoss) {
        alienObj.maxHealth = alienObj.health;
        alienObj.element.innerHTML = '<div class="boss-health-bar"></div>';
    }

    gameArea.appendChild(alien);
    gameState.aliens.push(alienObj);
    
    return alienObj;
}

// Update the game loop to use the new movement system
function updateAliens(time) {
    gameState.aliens.forEach((alien, index) => {
        updateAlienMovement(alien, time);
        
        // Update alien element position
        alien.element.style.left = alien.x + 'px';
        alien.element.style.top = alien.y + 'px';
        
        // Update boss health bar if applicable
        if (alien.isBoss) {
            const healthBar = alien.element.querySelector('.boss-health-bar');
            const healthPercent = (alien.health / alien.maxHealth) * 100;
            healthBar.style.width = healthPercent + '%';
        }
        
        // Remove aliens that are off screen
        if (alien.y > window.innerHeight) {
            alien.element.remove();
            gameState.aliens.splice(index, 1);
        }
    });
}

// Initialize game
function initGame(difficulty) {
    // Clear existing aliens and projectiles
    gameState.aliens.forEach(alien => alien.element.remove());
    gameState.projectiles.forEach(projectile => projectile.element.remove());
    
    gameState.difficulty = difficulty;
    gameState.score = 0;
    gameState.health = 100;
    gameState.level = 1;
    gameState.wave = 1;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    gameState.aliens = [];
    gameState.projectiles = [];
    gameState.powerUps = [];
    gameState.activePowerUps = {};
    gameState.powerUpSpawned = false;
    gameState.difficultyLevel = 1;

    // Update UI
    updateScore(0);
    updateHealth(100);
    updateLevel(1);

    // Hide screens
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // Position ship
    shipPosition = {
        x: gameArea.offsetWidth / 2 - 20,
        y: gameArea.offsetHeight - 80
    };
    ship.style.left = shipPosition.x + 'px';
    ship.style.bottom = '20px';

    // Show initial wave notification
    const notification = document.createElement('div');
    notification.className = 'wave-notification';
    notification.textContent = "WAVE 1";
    gameArea.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);

    // Start game loop and alien spawning
    gameLoop();
    startAlienSpawning();
    
    gameState.shootingPattern = getShootingPattern(1);
    gameState.lastShot = 0;
    
    // Initialize ship with wave 1 appearance
    ship.className = 'player-ship ship-wave-1';
}

// Shooting mechanism
function shoot() {
    const now = Date.now();
    const pattern = gameState.shootingPattern;
    
    if (now - gameState.lastShot >= pattern.cooldown) {
        const shipRect = ship.getBoundingClientRect();
        const baseX = shipPosition.x + ship.offsetWidth / 2 - 2;
        const baseY = shipRect.top;
        
        pattern.projectiles.forEach(offset => {
            createProjectile(baseX, baseY, offset);
        });
        
        gameState.lastShot = now;
    }
}

// Move projectiles
function moveProjectiles() {
    gameState.projectiles.forEach((projectile, index) => {
        projectile.position.y -= CONFIG.projectileSpeed;
        projectile.element.style.top = projectile.position.y + 'px';
        
        // Remove projectiles that are off screen
        if (projectile.position.y < 0) {
            projectile.element.remove();
            gameState.projectiles.splice(index, 1);
        }
    });
}

// Move aliens
function moveAliens() {
    updateAliens(Date.now());
}

// Ship movement
function moveShip(direction) {
    const speed = CONFIG.shipSpeed * (gameState.activePowerUps.speedBoost ? 1.5 : 1);
    
    // Remove previous movement classes
    ship.classList.remove('moving-left', 'moving-right');
    
    if (direction === 'left') {
        shipPosition.x = Math.max(0, shipPosition.x - speed);
        ship.classList.add('moving-left');
    } else if (direction === 'right') {
        shipPosition.x = Math.min(gameArea.offsetWidth - 50, shipPosition.x + speed);
        ship.classList.add('moving-right');
    }
    
    ship.style.left = shipPosition.x + 'px';
}

// Track pressed keys
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// Event listeners for controls
document.addEventListener('keydown', (e) => {
    if (gameState.isGameOver) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            keys.ArrowLeft = true;
            break;
        case 'ArrowRight':
            keys.ArrowRight = true;
            break;
        case ' ':
            shoot();
            e.preventDefault(); // Prevent page scrolling
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.ArrowLeft = false;
            break;
        case 'ArrowRight':
            keys.ArrowRight = false;
            break;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        ship.classList.remove('moving-left', 'moving-right');
    }
});

// Game loop
function gameLoop() {
    if (!gameState.isPaused && !gameState.isGameOver) {
        // Handle continuous movement
        if (keys.ArrowLeft) moveShip('left');
        if (keys.ArrowRight) moveShip('right');
        
        moveProjectiles();
        moveAliens();
        checkCollisions();
        checkPowerUpCollisions();
        checkLaserCollisions();
        
        // Update laser position if active
        if (gameState.activePowerUps.laser) {
            gameState.activePowerUps.laser.element.style.left = (shipPosition.x + 23) + 'px';
        }
        
        // Update difficulty level
        gameState.difficultyLevel = 1 + (Math.floor(gameState.wave / 3) * 0.5) + (gameState.bossesDefeated * 0.3);
    }
    requestAnimationFrame(gameLoop);
}

function createAlienProjectile(x, y, angle) {
    const projectile = document.createElement('div');
    projectile.className = 'alien-projectile';
    projectile.style.left = x + 'px';
    projectile.style.top = y + 'px';
    gameArea.appendChild(projectile);
    
    const velocityX = Math.cos(angle) * 5;
    const velocityY = Math.sin(angle) * 5;
    
    function updateProjectile() {
        projectile.style.left = (x += velocityX) + 'px';
        projectile.style.top = (y += velocityY) + 'px';
        
        if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
            projectile.remove();
        } else {
            requestAnimationFrame(updateProjectile);
        }
    }
    
    updateProjectile();
}

function createProjectile(baseX, baseY, offset = { x: 0, y: 0 }) {
    const projectile = document.createElement('div');
    projectile.className = 'projectile';
    
    // Add wave-specific projectile styling
    projectile.classList.add('projectile-wave-' + ((gameState.wave - 1) % 4 + 1));
    
    const x = baseX + offset.x;
    const y = baseY + offset.y;
    
    projectile.style.left = x + 'px';
    projectile.style.top = y + 'px';
    
    gameArea.appendChild(projectile);
    
    gameState.projectiles.push({
        element: projectile,
        position: { x, y }
    });
}

function startAlienSpawning() {
    // Clear any existing spawn interval
    if (gameState.spawnInterval) {
        clearInterval(gameState.spawnInterval);
    }
    
    const isBossWave = gameState.wave > 0 && gameState.wave % 3 === 0;
    const waveConfig = isBossWave ? CONFIG.waveConfig.bossWave : CONFIG.waveConfig.normalWave;
    const baseSpawnRate = CONFIG.difficulties[gameState.difficulty].spawnRate;
    const spawnRate = baseSpawnRate * waveConfig.spawnMultiplier;
    
    gameState.spawnInterval = setInterval(() => {
        if (!gameState.isPaused && !gameState.isGameOver) {
            if (isBossWave) {
                createAlien(true);
            } else {
                createAlien();
            }
        }
    }, spawnRate);
}

function checkCollisions() {
    const projectiles = gameState.projectiles;
    const aliens = gameState.aliens;
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        for (let j = aliens.length - 1; j >= 0; j--) {
            const alien = aliens[j];
            
            if (isColliding(projectile, alien)) {
                // Remove projectile
                projectile.element.remove();
                projectiles.splice(i, 1);
                
                // Reduce alien health or remove if dead
                alien.health--;
                
                if (alien.health <= 0) {
                    // Create explosion effect
                    const explosion = document.createElement('div');
                    explosion.className = 'explosion';
                    if (alien.isBoss) {
                        explosion.classList.add('boss-explosion');
                    }
                    explosion.style.left = alien.x + 'px';
                    explosion.style.top = alien.y + 'px';
                    gameArea.appendChild(explosion);
                    
                    // Remove alien
                    alien.element.remove();
                    aliens.splice(j, 1);
                    
                    // Update score
                    const scoreIncrease = alien.isBoss ? 50 : 10;
                    updateScore(gameState.score + scoreIncrease);
                    
                    // Remove explosion after animation
                    setTimeout(() => {
                        explosion.remove();
                    }, 500);
                    
                    if (alien.isBoss) {
                        gameState.bossesDefeated++;
                    }
                } else {
                    // Show hit effect
                    alien.element.classList.add('hit');
                    setTimeout(() => {
                        if (alien.element) {
                            alien.element.classList.remove('hit');
                        }
                    }, 100);
                }
                
                break;
            }
        }
    }
}

function isColliding(projectile, alien) {
    const projectileRect = projectile.element.getBoundingClientRect();
    const alienRect = alien.element.getBoundingClientRect();
    
    return !(projectileRect.right < alienRect.left || 
             projectileRect.left > alienRect.right || 
             projectileRect.bottom < alienRect.top || 
             projectileRect.top > alienRect.bottom);
}

function updateScore(newScore) {
    gameState.score = newScore;
    document.getElementById('score').textContent = newScore;
    
    // Check for wave changes every 200 points
    const newWave = Math.floor(newScore / 200) + 1;
    if (newWave !== gameState.wave) {
        changeWave(newWave);
    }
}

function changeWave(newWave) {
    gameState.wave = newWave;
    const isBossWave = newWave > 0 && newWave % 3 === 0;
    
    // Create and show wave notification
    const notification = document.createElement('div');
    notification.className = 'wave-notification' + (isBossWave ? ' boss-wave' : '');
    notification.textContent = isBossWave ? "BOSS WAVE" : "WAVE " + newWave;
    gameArea.appendChild(notification);
    
    // Upgrade player ship
    upgradePlayerShip(newWave);
    
    // Update spawn rate and alien properties
    if (gameState.spawnInterval) {
        clearInterval(gameState.spawnInterval);
    }
    startAlienSpawning();
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function upgradePlayerShip(wave) {
    // Remove previous wave classes
    ship.className = 'player-ship';
    
    // Add new wave class
    ship.classList.add('ship-wave-' + ((wave - 1) % 4 + 1));
    
    // Update shooting pattern based on wave
    gameState.shootingPattern = getShootingPattern(wave);
}

function getShootingPattern(wave) {
    const patterns = {
        1: { // Single shot
            projectiles: [{ x: 0, y: 0 }],
            cooldown: 250
        },
        2: { // Double shot
            projectiles: [
                { x: -10, y: 0 },
                { x: 10, y: 0 }
            ],
            cooldown: 300
        },
        3: { // Triple shot
            projectiles: [
                { x: 0, y: 0 },
                { x: -15, y: 5 },
                { x: 15, y: 5 }
            ],
            cooldown: 350
        },
        4: { // Quad shot + center
            projectiles: [
                { x: 0, y: 0 },
                { x: -20, y: 5 },
                { x: 20, y: 5 },
                { x: -10, y: 0 },
                { x: 10, y: 0 }
            ],
            cooldown: 400
        }
    };
    
    const patternIndex = (wave - 1) % 4 + 1;
    return patterns[patternIndex];
}

function checkPowerUpCollisions() {
    const projectiles = gameState.projectiles;
    const powerUps = gameState.powerUps;
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        const projectileRect = projectile.element.getBoundingClientRect();
        
        for (let j = powerUps.length - 1; j >= 0; j--) {
            const powerUp = powerUps[j];
            const powerUpRect = powerUp.element.getBoundingClientRect();
            
            if (isColliding(projectileRect, powerUpRect)) {
                // Remove power-up and projectile
                powerUp.element.remove();
                projectile.element.remove();
                powerUps.splice(j, 1);
                projectiles.splice(i, 1);
                
                // Activate laser
                activateLaser();
                break;
            }
        }
    }
}

function checkLaserCollisions() {
    if (!gameState.activePowerUps.laser) return;
    
    const laser = gameState.activePowerUps.laser.element;
    const laserRect = laser.getBoundingClientRect();
    const middleY = gameArea.offsetHeight / 2;
    
    for (let i = gameState.aliens.length - 1; i >= 0; i--) {
        const alien = gameState.aliens[i];
        const alienRect = alien.element.getBoundingClientRect();
        
        // Check if alien has reached middle of screen
        if (alienRect.top + alienRect.height / 2 >= middleY) {
            // Check if alien is in line with laser
            if (alienRect.left < laserRect.right && alienRect.right > laserRect.left) {
                // Remove alien
                alien.element.remove();
                gameState.aliens.splice(i, 1);
                
                // Update score
                updateScore(gameState.score + 10);
            }
        }
    }
}

function updateHealth(newHealth) {
    gameState.health = newHealth;
    document.getElementById('health').textContent = newHealth;
    
    if (newHealth <= 0) {
        gameOver();
    }
}

function updateLevel(newLevel) {
    gameState.level = newLevel;
    document.getElementById('level').textContent = newLevel;
}

function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').textContent = Math.floor(gameState.score);
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('pause-screen').classList.toggle('hidden', !gameState.isPaused);
}

function activateLaser() {
    const laser = document.createElement('div');
    laser.className = 'laser-beam';
    laser.style.left = (shipPosition.x + 23) + 'px';  // Center on ship
    laser.style.top = '0';
    
    gameArea.appendChild(laser);
    gameState.activePowerUps.laser = {
        element: laser,
        duration: 10000  // 10 seconds
    };
    
    // Remove laser after duration
    setTimeout(() => {
        if (gameState.activePowerUps.laser) {
            gameState.activePowerUps.laser.element.remove();
            delete gameState.activePowerUps.laser;
        }
    }, 10000);
}

// Initialize difficulty buttons
document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        if (button.id === 'restart-btn') {
            document.getElementById('game-over-screen').classList.add('hidden');
            initGame(gameState.difficulty);
        } else {
            const difficulty = button.getAttribute('data-difficulty');
            initGame(difficulty);
        }
    });
});

gameLoop();
