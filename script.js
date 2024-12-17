// Game configuration
const CONFIG = {
    difficulties: {
        easy: {
            alienSpeed: 1.0,
            spawnRate: 3000,
            movementAmplitude: 30,
            bossSpawnRate: 20000,
            alienShotRate: 4000,
            projectileSpeed: 2,
            scoreMultiplier: 1.2,
            healthLoss: 3,
            missedAlienPenalty: 1
        },
        medium: {
            alienSpeed: 1.1,
            spawnRate: 1800,
            movementAmplitude: 70,
            bossSpawnRate: 13000,
            alienShotRate: 2500,
            projectileSpeed: 3.5,
            scoreMultiplier: 1.5,
            healthLoss: 10,
            missedAlienPenalty: 5
        },
        hard: {
            alienSpeed: 1.6,
            spawnRate: 1200,
            movementAmplitude: 120,
            bossSpawnRate: 11000,
            alienShotRate: 1500,
            projectileSpeed: 4.5,
            scoreMultiplier: 2,
            healthLoss: 15,
            missedAlienPenalty: 8
        }
    },
    waveConfig: {
        mediumWave: {
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
    shipSpeed: 6,
    starfield: {
        stars: 200,
        speed: 2,
        maxSize: 3
    },
    maxAliens: 4
};

let gameState = {
    score: 0,
    health: 100,
    level: 1,
    wave: 1,
    difficulty: 'medium',
    isPaused: false,
    isGameOver: false,
    lastShot: 0,
    shootingCooldown: 150,
    aliens: [],
    projectiles: [],
    powerUps: [],
    activePowerUps: {},
    powerUpSpawned: false,
    spawnInterval: null,
    shootingPattern: null,
    isBossWave: false,
    bossesDefeated: 0,
    difficultyLevel: 1,
    lastAlienSpawn: 0,
    lastBossSpawn: 0,
    alienProjectiles: [],
    healthBubble: null,
    lastHealthBubbleSpawn: 0
};

const gameArea = document.getElementById('game-area');
const ship = document.getElementById('spaceship');
let shipPosition = {
    x: gameArea.offsetWidth / 2 - 20,
    y: gameArea.offsetHeight - 80
};

// Movement patterns configuration
const movementPatterns = {
    basic: {
        sideToSide: (alien, time) => {
            const difficulty = CONFIG.difficulties[gameState.difficulty];
            const amplitude = difficulty.movementAmplitude;
            let timeScale;
            // Adjust movement timing based on difficulty
            if (gameState.difficulty === 'hard') {
                timeScale = 0.0015;
            } else if (gameState.difficulty === 'medium') {
                timeScale = 0.0018;  // Slightly faster than easy but slower than hard
            } else {
                timeScale = 0.002;
            }
            alien.x = alien.startX + Math.sin(time * timeScale * difficulty.alienSpeed) * amplitude;
            alien.y += difficulty.alienSpeed;
        },
        zigzag: (alien, time) => {
            const difficulty = CONFIG.difficulties[gameState.difficulty];
            const amplitude = difficulty.movementAmplitude;
            let timeScale;
            // Adjust zigzag pattern based on difficulty
            if (gameState.difficulty === 'hard') {
                timeScale = 0.002;
            } else if (gameState.difficulty === 'medium') {
                timeScale = 0.0025;  // More predictable than hard
            } else {
                timeScale = 0.003;
            }
            alien.x = alien.startX + Math.sin(time * timeScale * difficulty.alienSpeed) * amplitude;
            alien.y += difficulty.alienSpeed * (gameState.difficulty === 'medium' ? 1.05 : 1.1);
        },
        spiral: (alien, time) => {
            const difficulty = CONFIG.difficulties[gameState.difficulty];
            const amplitude = difficulty.movementAmplitude;
            let timeScale;
            // Adjust spiral pattern based on difficulty
            if (gameState.difficulty === 'hard') {
                timeScale = 0.003;
            } else if (gameState.difficulty === 'medium') {
                timeScale = 0.0035;  // More predictable than hard
            } else {
                timeScale = 0.004;
            }
            alien.x = alien.startX + Math.sin(time * timeScale * difficulty.alienSpeed) * amplitude;
            const verticalFactor = gameState.difficulty === 'medium' ? 0.0018 : 0.0015;
            alien.y += difficulty.alienSpeed * (1 + Math.cos(time * verticalFactor));
        }
    },
    advanced: {
        spiral: (alien, time) => {
            alien.x += Math.cos(time * 0.02) * 0.7;
            alien.y += 1;
        },
        figure8: (alien, time) => {
            alien.x += Math.sin(time * 0.02) * 0.6;
            alien.y += 1;
        },
        bounce: (alien, time) => {
            if (alien.x <= 0 || alien.x >= window.innerWidth - 50) {
                alien.directionX *= -1;
            }
            alien.x += 0.8 * alien.directionX;
            alien.y += 1;
        }
    },
    expert: {
        swarm: (alien, time, index, totalAliens) => {
            const angle = (index / totalAliens) * Math.PI * 2;
            alien.x += Math.cos(angle + time * 0.01) * 0.4;
            alien.y += 1;
        },
        chaos: (alien, time) => {
            alien.x += Math.sin(time * 0.02) * 0.5;
            alien.y += 1;
        },
        pursuit: (alien, time, _, __, playerX) => {
            const dx = playerX - alien.x;
            alien.x += Math.sign(dx) * 0.5;
            alien.y += 1;
        }
    },
    boss: {
        multiPhase: (boss, time) => {
            const difficulty = CONFIG.difficulties[gameState.difficulty];
            // Adjust boss movement amplitude based on difficulty
            let amplitudeMultiplier;
            if (gameState.difficulty === 'hard') {
                amplitudeMultiplier = 1.8;
            } else if (gameState.difficulty === 'medium') {
                amplitudeMultiplier = 1.5;  // Less extreme than hard
            } else {
                amplitudeMultiplier = 1.2;
            }
            const amplitude = difficulty.movementAmplitude * amplitudeMultiplier;
            const verticalSpeed = difficulty.alienSpeed * (gameState.difficulty === 'medium' ? 0.45 : 0.4);
            
            switch(boss.phase) {
                case 1:
                    boss.x = boss.startX + Math.sin(time * 0.002 * difficulty.alienSpeed) * amplitude;
                    boss.y += verticalSpeed;
                    break;
                case 2:
                    boss.x = boss.startX + Math.sin(time * 0.0025 * difficulty.alienSpeed) * amplitude;
                    boss.y += verticalSpeed * (gameState.difficulty === 'medium' ? 1.15 : 1.1);
                    break;
                case 3:
                    boss.x = boss.startX + Math.sin(time * 0.003 * difficulty.alienSpeed) * amplitude;
                    boss.y += verticalSpeed * (gameState.difficulty === 'medium' ? 1.25 : 1.3);
                    break;
            }
            
            boss.x = Math.max(50, Math.min(gameArea.offsetWidth - 50, boss.x));
            
            if (boss.y > gameArea.offsetHeight) {
                const currentHealth = gameState.health;
                const healthReduction = Math.ceil(currentHealth * 0.3);
                updateHealth(currentHealth - healthReduction);
                
                boss.y = -50;
                boss.startX = Math.random() * (gameArea.offsetWidth - 100) + 50;
            }
        },
        teleport: (boss, time) => {
            if (time % 180 === 0 && Math.random() < 0.3) {
                const minX = 50;
                const maxX = gameArea.offsetWidth - 50;
                boss.startX = minX + Math.random() * (maxX - minX);
                boss.y = -50;
            }
        }
    }
};

// Star class for background animation
class Star {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * CONFIG.starfield.maxSize;
        this.speed = (Math.random() + 0.5) * CONFIG.starfield.speed;
    }

    update() {
        this.y += this.speed;
        if (this.y > this.canvas.height) {
            this.reset();
            this.y = 0;
        }
    }

    draw() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// Starfield management
let stars = [];
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

function initStarfield() {
    // Set canvas size
    canvas.width = gameArea.offsetWidth;
    canvas.height = gameArea.offsetHeight;

    // Create stars
    stars = [];
    for (let i = 0; i < CONFIG.starfield.stars; i++) {
        stars.push(new Star(canvas));
    }
}

function updateStarfield() {
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw stars
    stars.forEach(star => {
        star.update();
        star.draw();
    });
}

// Update alien movement based on wave progression
function updateAlienMovement(alien, time) {
    const waveLevel = Math.floor(gameState.wave / 3);
    const patterns = getPatternsByDifficulty(waveLevel);
    
    if (alien.isBoss) {
        updateBossMovement(alien, time);
    } else {
        const pattern = patterns[alien.patternIndex % patterns.length];
        pattern(alien, time, alien.index, gameState.aliens.length, shipPosition.x);
        
        // Keep aliens within screen bounds
        if (alien.x < 0) alien.x = 0;
        if (alien.x > window.innerWidth - 50) alien.x = window.innerWidth - 50;
        
        // Remove aliens that are off screen
        if (alien.y > gameArea.offsetHeight) {
            // Calculate health reduction based on wave type (boss or normal)
            const isBossWave = Math.floor((gameState.wave - 1) / 3) === Math.floor(gameState.wave / 3);
            const healthReductionPercent = isBossWave ? 20 : 5;
            const healthReduction = Math.ceil(gameState.health * (healthReductionPercent / 100));
            
            // Remove the alien from the DOM and the game state
            alien.element.remove();
            const index = gameState.aliens.indexOf(alien);
            if (index > -1) {
                gameState.aliens.splice(index, 1);
            }
            
            // Update health
            updateHealth(Math.max(0, gameState.health - healthReduction));
            
            if (gameState.health <= 0) {
                gameOver();
            }
        }
    }
}

function getPatternsByDifficulty(waveLevel) {
    const patterns = [];
    
    // Basic patterns (always available)
    patterns.push(...Object.values(movementPatterns.basic));
    
    // Advanced patterns (after first boss)
    if (waveLevel >= 1) {
        patterns.push(...Object.values(movementPatterns.advanced));
    }
    
    // Expert patterns (after second boss)
    if (waveLevel >= 2) {
        patterns.push(...Object.values(movementPatterns.expert));
    }
    
    return patterns;
}

function updateBossMovement(boss, time) {
    // Update boss phase based on health
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent <= 0.66 && boss.phase === 1) {
        boss.phase = 2;
        boss.speed *= 1.2;
    } else if (healthPercent <= 0.33 && boss.phase === 2) {
        boss.phase = 3;
        boss.speed *= 1.3;
    }

    // Apply boss movement pattern
    movementPatterns.boss.multiPhase(boss, time);
    
    // Add teleport ability in later phases
    if (boss.phase >= 2 && boss.health > 0) {
        movementPatterns.boss.teleport(boss, time);
    }
    
    // Update boss health bar
    const healthBar = boss.element.querySelector('.boss-health-bar');
    if (healthBar) {
        const healthPercent = (boss.health / boss.maxHealth) * 100;
        healthBar.style.width = healthPercent + '%';
    }
}

// Enhanced alien creation with pattern assignment
function createAlien(isBoss = false) {
    const alien = document.createElement('div');
    alien.className = isBoss ? 'alien boss-alien' : 'alien';
    
    // Add wave-specific class
    if (!isBoss) {
        const waveClass = `alien-wave-${((gameState.wave - 1) % 3) + 1}`;
        alien.classList.add(waveClass);
    }
    
    // Set initial position
    const gameAreaRect = gameArea.getBoundingClientRect();
    let x, y;
    if (isBoss) {
        x = Math.random() * (gameAreaRect.width - 80);
        y = -80;
    } else {
        x = Math.random() * (gameAreaRect.width - 40);
        y = -40;
    }
    
    const alienObj = {
        element: alien,
        x: x,
        y: y,
        startX: x,
        health: isBoss ? 3 : 1,
        isBoss: isBoss,
        phase: 1,
        speed: isBoss ? 1.5 : CONFIG.difficulties[gameState.difficulty].alienSpeed,
        directionX: Math.random() < 0.5 ? -1 : 1,
        patternIndex: Math.floor(Math.random() * getPatternsByDifficulty(Math.floor(gameState.wave / 3)).length),
        index: gameState.aliens.length,
        lastShot: 0
    };

    if (isBoss) {
        alienObj.maxHealth = alienObj.health;
        const healthBar = document.createElement('div');
        healthBar.className = 'boss-health-bar';
        alien.appendChild(healthBar);
    }

    alien.style.position = 'absolute';
    alien.style.left = x + 'px';
    alien.style.top = y + 'px';
    alien.style.zIndex = '100';
    gameArea.appendChild(alien);
    gameState.aliens.push(alienObj);
    
    return alienObj;
}

// Update the game loop to use the new movement system
function updateAliens(time) {
    const aliens = gameState.aliens;
    const gameAreaRect = gameArea.getBoundingClientRect();
    
    for (let i = aliens.length - 1; i >= 0; i--) {
        const alien = aliens[i];
        
        // Update position
        if (alien.isBoss) {
            updateBossMovement(alien, time);
        } else {
            updateAlienMovement(alien, time);
        }
        
        // Remove aliens that are off screen
        if (alien.y > gameAreaRect.height + 50) {
            alien.element.remove();
            aliens.splice(i, 1);
            if (!gameState.isGameOver) {
                updateHealth(gameState.health - CONFIG.difficulties[gameState.difficulty].missedAlienPenalty);
            }
            continue;
        }
        
        // Update visual position
        alien.element.style.left = alien.x + 'px';
        alien.element.style.top = alien.y + 'px';
        
        // Ensure alien is visible
        alien.element.style.display = 'block';
        alien.element.style.visibility = 'visible';
    }
}

function spawnAliens() {
    if (gameState.isPaused || gameState.isGameOver) return;
    
    const difficulty = CONFIG.difficulties[gameState.difficulty];
    const currentTime = Date.now();
    const gameAreaRect = gameArea.getBoundingClientRect();
    
    // Only spawn if we have room on screen
    if (gameState.aliens.length >= CONFIG.maxAliens) return;
    
    // Regular alien spawning
    if (currentTime - gameState.lastAlienSpawn > difficulty.spawnRate) {
        createAlien(false);
        gameState.lastAlienSpawn = currentTime;
    }
    
    // Boss spawning
    if (currentTime - gameState.lastBossSpawn > difficulty.bossSpawnRate && 
        gameState.wave > 0 && gameState.wave % 5 === 0 && 
        !gameState.aliens.some(alien => alien.isBoss)) {
        createAlien(true);
        gameState.lastBossSpawn = currentTime;
    }
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
                
                // Reduce alien health
                alien.health--;
                
                // Create hit effect
                const hitEffect = document.createElement('div');
                hitEffect.className = 'hit-effect';
                hitEffect.style.left = alien.x + 'px';
                hitEffect.style.top = alien.y + 'px';
                gameArea.appendChild(hitEffect);
                
                // Remove hit effect after animation
                setTimeout(() => {
                    hitEffect.remove();
                }, 200);
                
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
                    
                    // Spawn new alien immediately if not a boss and below max limit
                    if (!alien.isBoss && gameState.aliens.filter(a => !a.isBoss).length < CONFIG.maxAliens) {
                        createAlien(false);
                    }
                    
                    // Remove explosion after animation
                    setTimeout(() => {
                        explosion.remove();
                    }, 500);
                } else if (alien.isBoss) {
                    // Update boss health bar
                    const healthPercent = (alien.health / alien.maxHealth) * 100;
                    const healthBar = alien.element.querySelector('.boss-health-bar');
                    if (healthBar) {
                        healthBar.style.width = healthPercent + '%';
                    }
                }
                
                break;
            }
        }
    }
    
    // Check health bubble collisions
    if (gameState.healthBubble) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const projectile = projectiles[i];
            if (isColliding(projectile, gameState.healthBubble)) {
                // Remove projectile
                gameArea.removeChild(projectile.element);
                projectiles.splice(i, 1);
                
                // Remove health bubble and restore health
                gameArea.removeChild(gameState.healthBubble.element);
                gameState.healthBubble = null;
                updateHealth(100);
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

// Create health bubble
function createHealthBubble() {
    if (gameState.healthBubble || gameState.health >= 40) return;
    
    const bubble = document.createElement('div');
    bubble.className = 'health-bubble';
    bubble.style.position = 'absolute';
    bubble.style.left = Math.random() * (gameArea.offsetWidth - 30) + 'px';
    bubble.style.top = '0px';
    gameArea.appendChild(bubble);
    
    gameState.healthBubble = {
        element: bubble,
        x: parseFloat(bubble.style.left),
        y: 0,
        speed: 0.8,
        width: 30,
        height: 30
    };
}

// Update health bubble movement
function updateHealthBubble() {
    if (!gameState.healthBubble) {
        if (gameState.health < 40 && Date.now() - gameState.lastHealthBubbleSpawn > 5000) {
            createHealthBubble();
            gameState.lastHealthBubbleSpawn = Date.now();
        }
        return;
    }

    gameState.healthBubble.y += gameState.healthBubble.speed;
    gameState.healthBubble.element.style.top = gameState.healthBubble.y + 'px';

    // Remove if it goes off screen
    if (gameState.healthBubble.y > gameArea.offsetHeight) {
        gameArea.removeChild(gameState.healthBubble.element);
        gameState.healthBubble = null;
    }
}

// Function to reset game state
function resetGame() {
    // Reset game state values
    gameState.score = 0;
    gameState.health = 100;
    gameState.level = 1;
    gameState.wave = 1;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    gameState.lastShot = 0;
    gameState.powerUpSpawned = false;
    gameState.isBossWave = false;
    gameState.bossesDefeated = 0;
    gameState.difficultyLevel = 1;
    gameState.lastAlienSpawn = 0;
    gameState.lastBossSpawn = 0;
    gameState.lastHealthBubbleSpawn = 0;

    // Clear all existing game elements
    gameState.aliens.forEach(alien => {
        if (alien.element && alien.element.parentNode) {
            alien.element.parentNode.removeChild(alien.element);
        }
    });
    gameState.aliens = [];

    gameState.projectiles.forEach(projectile => {
        if (projectile.element && projectile.element.parentNode) {
            projectile.element.parentNode.removeChild(projectile.element);
        }
    });
    gameState.projectiles = [];

    gameState.alienProjectiles.forEach(projectile => {
        if (projectile.element && projectile.element.parentNode) {
            projectile.element.parentNode.removeChild(projectile.element);
        }
    });
    gameState.alienProjectiles = [];

    if (gameState.healthBubble && gameState.healthBubble.element) {
        gameState.healthBubble.element.parentNode.removeChild(gameState.healthBubble.element);
        gameState.healthBubble = null;
    }

    // Reset power-ups
    gameState.powerUps = [];
    gameState.activePowerUps = {};

    // Reset ship position
    shipPosition = {
        x: gameArea.offsetWidth / 2 - 20,
        y: gameArea.offsetHeight - 80
    };
    ship.style.left = shipPosition.x + 'px';

    // Reset UI
    updateScore(0);
    updateHealth(100);
    updateLevel(1);

    // Hide game over screen
    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.classList.add('hidden');

    // Reset spawn interval
    if (gameState.spawnInterval) {
        clearInterval(gameState.spawnInterval);
    }
    startAlienSpawning();
}

// Initialize difficulty buttons
document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        if (button.id === 'restart-btn') {
            resetGame();
            return;
        }
        const difficulty = button.dataset.difficulty;
        if (difficulty) {
            initGame(difficulty);
        }
    });
});

// Mobile Controls
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let touchControls = {
    left: false,
    right: false,
    shoot: false
};

if (isMobile) {
    const shootBtn = document.querySelector('.shoot-btn');
    const leftBtn = document.querySelector('#left-btn');
    const rightBtn = document.querySelector('#right-btn');

    // Touch events for shoot button
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchControls.shoot = true;
    });
    shootBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchControls.shoot = false;
    });

    // Touch events for left button
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchControls.left = true;
    });
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchControls.left = false;
    });

    // Touch events for right button
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchControls.right = true;
    });
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchControls.right = false;
    });
}

// Track pressed keys
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    " ": false,
    "p": false,
    "Escape": false
};

// Function to return to main menu
function returnToMainMenu() {
    // Reset game state
    gameState.isGameOver = true;
    gameState.isPaused = false;
    
    // Clear all aliens and projectiles
    gameState.aliens.forEach(alien => {
        if (alien.element && alien.element.parentNode) {
            alien.element.parentNode.removeChild(alien.element);
        }
    });
    gameState.aliens = [];

    gameState.projectiles.forEach(projectile => {
        if (projectile.element && projectile.element.parentNode) {
            projectile.element.parentNode.removeChild(projectile.element);
        }
    });
    gameState.projectiles = [];

    // Clear health bubble if exists
    if (gameState.healthBubble && gameState.healthBubble.element) {
        gameState.healthBubble.element.parentNode.removeChild(gameState.healthBubble.element);
        gameState.healthBubble = null;
    }

    // Hide game over screen if visible
    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.classList.add('hidden');

    // Show start screen
    const startScreen = document.getElementById('start-screen');
    startScreen.classList.remove('hidden');

    // Reset score and health
    updateScore(0);
    updateHealth(100);
    updateLevel(1);
}

// Add event listener for keydown
document.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
        if (e.key === "Escape" && !gameState.isPaused) {
            returnToMainMenu();
        }
    }
});

// Event listeners for controls
document.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.ArrowLeft = false;
            break;
        case 'ArrowRight':
            keys.ArrowRight = false;
            break;
        case ' ':
            keys[" "] = false;
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        ship.classList.remove('moving-left', 'moving-right');
    }
});

function alienShoot(alien) {
    if (gameState.isPaused || gameState.isGameOver) return;
    
    const difficulty = CONFIG.difficulties[gameState.difficulty];
    const currentTime = Date.now();
    
    // Check if enough time has passed since last shot
    if (currentTime - alien.lastShot > difficulty.alienShotRate) {
        const projectile = document.createElement('div');
        projectile.className = 'alien-projectile';
        
        const projectileObj = {
            element: projectile,
            x: alien.x + 25,  // Center of alien
            y: alien.y + 50,  // Bottom of alien
            speed: difficulty.projectileSpeed
        };
        
        projectile.style.left = projectileObj.x + 'px';
        projectile.style.top = projectileObj.y + 'px';
        
        gameArea.appendChild(projectile);
        gameState.alienProjectiles.push(projectileObj);
        
        alien.lastShot = currentTime;
    }
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
    
    projectile.style.transform = `translate(${x}px, ${y}px)`;
    
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
    const waveConfig = isBossWave ? CONFIG.waveConfig.bossWave : CONFIG.waveConfig.mediumWave;
    const baseSpawnRate = CONFIG.difficulties[gameState.difficulty].spawnRate;
    const spawnRate = baseSpawnRate * waveConfig.spawnMultiplier;
    
    gameState.spawnInterval = setInterval(() => {
        if (!gameState.isPaused && !gameState.isGameOver) {
            spawnAliens();
        }
    }, spawnRate);
}

// Game loop
function gameLoop() {
    if (!gameState.isPaused && !gameState.isGameOver) {
        updateStarfield();
        // Handle continuous movement and shooting
        if (keys.ArrowLeft || touchControls.left) moveShip('left');
        if (keys.ArrowRight || touchControls.right) moveShip('right');
        if (keys[" "] || touchControls.shoot) shoot();
        
        moveProjectiles();
        updateAliens(Date.now());
        spawnAliens();
        checkCollisions();
        checkPowerUpCollisions();
        checkLaserCollisions();
        updateHealthBubble();
        
        // Update laser position if active
        if (gameState.activePowerUps.laser) {
            gameState.activePowerUps.laser.element.style.left = (shipPosition.x + 23) + 'px';
        }
        
        // Update difficulty level
        gameState.difficultyLevel = 1 + (Math.floor(gameState.wave / 3) * 0.5) + (gameState.bossesDefeated * 0.3);
        
        // Update alien shooting
        for (let i = gameState.aliens.length - 1; i >= 0; i--) {
            const alien = gameState.aliens[i];
            alienShoot(alien);
        }
    }
    requestAnimationFrame(gameLoop);
}

// Shooting mechanism
function shoot() {
    const now = Date.now();
    const pattern = gameState.shootingPattern;
    
    // Check if enough time has passed since last shot
    if (now - gameState.lastShot >= gameState.shootingCooldown) {
        gameState.lastShot = now;
        
        // Create projectile based on current shooting pattern
        if (pattern && pattern.type === 'spread') {
            for (let i = 0; i < pattern.count; i++) {
                const angle = (pattern.count === 1) ? 0 : 
                    (-pattern.spread / 2) + (i * (pattern.spread / (pattern.count - 1)));
                const offset = {
                    x: Math.sin(angle * Math.PI / 180) * 20,
                    y: -Math.cos(angle * Math.PI / 180) * 20
                };
                createProjectile(shipPosition.x + 20, shipPosition.y, offset);
            }
        } else {
            // Default single shot
            createProjectile(shipPosition.x + 20, shipPosition.y);
        }
    }
}

// Move projectiles
function moveProjectiles() {
    gameState.projectiles.forEach((projectile, index) => {
        projectile.position.y -= CONFIG.projectileSpeed;
        projectile.element.style.transform = `translate(${projectile.position.x}px, ${projectile.position.y}px)`;
        
        // Remove projectiles that are off screen
        if (projectile.position.y < 0) {
            projectile.element.remove();
            gameState.projectiles.splice(index, 1);
        }
    });
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

// Prevent default touch behaviors
document.addEventListener('touchstart', function(e) {
    if (e.target.closest('#mobile-controls')) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', function(e) {
    e.preventDefault();
}, { passive: false });

// Update canvas size on resize
function resizeCanvas() {
    const canvas = document.getElementById('starfield');
    const gameArea = document.getElementById('game-area');
    if (canvas && gameArea) {
        canvas.width = gameArea.clientWidth;
        canvas.height = gameArea.clientHeight;
    }
}

// Add resize listener
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', function() {
    setTimeout(resizeCanvas, 100);
});

// Initial resize
document.addEventListener('DOMContentLoaded', resizeCanvas);

// Initialize game
function initGame(difficulty) {
    // Set the difficulty
    gameState.difficulty = difficulty;
    
    // Reset all game state and clear elements
    resetGame();
    
    // Hide start screen
    document.getElementById('start-screen').classList.add('hidden');
    
    // Show initial wave notification
    const notification = document.createElement('div');
    notification.className = 'wave-notification';
    notification.textContent = "WAVE 1";
    gameArea.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
    
    // Initialize game components
    gameState.shootingPattern = getShootingPattern(1);
    ship.className = 'player-ship ship-wave-1';
    initStarfield();
    
    // Start game loop
    gameLoop();
}

// Mobile Controls
const mobileLeft = document.getElementById('mobile-left');
const mobileRight = document.getElementById('mobile-right');
const mobileShoot = document.getElementById('mobile-shoot');

// Add mobile control event listeners
if (mobileLeft && mobileRight && mobileShoot) {
    mobileLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.ArrowLeft = true;
    });
    mobileLeft.addEventListener('touchend', () => {
        keys.ArrowLeft = false;
    });

    mobileRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.ArrowRight = true;
    });
    mobileRight.addEventListener('touchend', () => {
        keys.ArrowRight = false;
    });

    mobileShoot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.Space = true;
    });
    mobileShoot.addEventListener('touchend', () => {
        keys.Space = false;
    });
}

// Prevent scrolling when touching the mobile controls
document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#mobile-controls')) {
        e.preventDefault();
    }
}, { passive: false });

gameLoop();
