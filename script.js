// Game configuration
const CONFIG = {
    difficulties: {
        easy: {
            alienSpeed: 0.8,
            spawnRate: 2500,
            scoreMultiplier: 1,
            projectileSpeed: 8,
            healthLoss: 5,
            missedAlienPenalty: 3,
            aliensPerWave: 25,
            pointsPerWave: 150
        },
        normal: {
            alienSpeed: 1.2,
            spawnRate: 2000,
            scoreMultiplier: 1.5,
            projectileSpeed: 10,
            healthLoss: 10,
            missedAlienPenalty: 5,
            aliensPerWave: 27,
            pointsPerWave: 150
        },
        hard: {
            alienSpeed: 1.8,
            spawnRate: 1500,
            scoreMultiplier: 2,
            projectileSpeed: 12,
            healthLoss: 15,
            missedAlienPenalty: 8,
            aliensPerWave: 30,
            pointsPerWave: 150
        }
    },
    projectileSpeed: 10,
    shipSpeed: 6,
    bossWaveInterval: 5, // Boss wave every 5 waves
    upgradeTypes: ['sideLasers', 'tripleShot', 'rapidFire', 'wideBeam'],
    alienUpgrades: ['faster', 'armored', 'zigzag', 'shooter']
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
    shootingCooldown: 250,
    aliens: [],
    projectiles: [],
    powerUps: [],
    activePowerUps: {},
    powerUpSpawned: false,
    spawnInterval: null,
    aliensInWave: 0,
    upgrades: [],
    isBossWave: false,
    currentWaveClass: '',
    tripleShot: false,
    wideBeam: false,
    alienProjectiles: [],
    isTransitioningWave: false,
    currentProjectileClass: ''
};

let shipPosition = {
    x: 0,
    y: 0
};

// Get DOM elements
const gameArea = document.getElementById('game-area');
const ship = document.getElementById('spaceship');

// Initialize game
function initGame(difficulty) {
    // Clear existing elements
    gameState.aliens.forEach(alien => alien.element.remove());
    gameState.projectiles.forEach(projectile => projectile.element.remove());
    gameState.powerUps.forEach(powerUp => powerUp.element.remove());
    
    if (gameState.activePowerUps.laser) {
        gameState.activePowerUps.laser.element.remove();
    }
    
    // Reset ship
    ship.className = 'ship';
    ship.style.display = 'block';
    
    // Center the ship
    const gameAreaRect = gameArea.getBoundingClientRect();
    shipPosition.x = (gameAreaRect.width - ship.offsetWidth) / 2;
    shipPosition.y = gameAreaRect.height - ship.offsetHeight - 20;
    ship.style.left = shipPosition.x + 'px';
    ship.style.bottom = '20px';
    
    // Reset game state
    gameState = {
        score: 0,
        health: 100,
        level: 1,
        wave: 1,
        difficulty: difficulty,
        isPaused: false,
        isGameOver: false,
        lastShot: 0,
        shootingCooldown: 250,
        aliens: [],
        projectiles: [],
        powerUps: [],
        activePowerUps: {},
        powerUpSpawned: false,
        spawnInterval: null,
        aliensInWave: 0,
        upgrades: [],
        isBossWave: false,
        currentWaveClass: '',
        tripleShot: false,
        wideBeam: false,
        alienProjectiles: [],
        isTransitioningWave: false,
        currentProjectileClass: ''
    };
    
    // Update UI
    updateScore(0);
    updateHealth(100);
    updateLevel(1);
    
    // Start the game
    startWave();
}

// Shooting mechanism
function shoot() {
    const now = Date.now();
    if (now - gameState.lastShot >= gameState.shootingCooldown && !gameState.isPaused && !gameState.isGameOver) {
        const ship = document.querySelector('.ship');
        const shipRect = ship.getBoundingClientRect();
        
        // Create center projectile
        createProjectile(shipRect.left + shipRect.width / 2, shipRect.top);
        
        // Triple shot
        if (gameState.tripleShot) {
            createProjectile(shipRect.left + shipRect.width / 2 - 20, shipRect.top);
            createProjectile(shipRect.left + shipRect.width / 2 + 20, shipRect.top);
        }
        
        // Wide beam effect
        if (gameState.wideBeam) {
            setTimeout(() => {
                createProjectile(shipRect.left + shipRect.width / 2 - 10, shipRect.top);
                createProjectile(shipRect.left + shipRect.width / 2 + 10, shipRect.top);
            }, 50);
        }
        
        gameState.lastShot = now;
    }
}

function createProjectile(x, y) {
    const projectile = document.createElement('div');
    projectile.className = `projectile ${gameState.currentProjectileClass || ''}`;
    projectile.style.left = `${x}px`;
    projectile.style.top = `${y}px`;
    document.getElementById('game-area').appendChild(projectile);
    
    gameState.projectiles.push({
        element: projectile,
        x: x,
        y: y
    });
}

// Move projectiles
function moveProjectiles() {
    gameState.projectiles.forEach((projectile, index) => {
        projectile.y -= CONFIG.projectileSpeed;
        projectile.element.style.top = projectile.y + 'px';
        
        // Remove projectiles that are off screen
        if (projectile.y < 0) {
            projectile.element.remove();
            gameState.projectiles.splice(index, 1);
        }
    });
}

// Move aliens
function moveAliens() {
    for (let i = gameState.aliens.length - 1; i >= 0; i--) {
        const alien = gameState.aliens[i];
        
        // Apply movement pattern
        if (alien.movePattern === 'zigzag') {
            alien.zigzagOffset += 0.05;
            alien.position.x += Math.sin(alien.zigzagOffset) * 2;
            alien.element.style.left = alien.position.x + 'px';
        }
        
        alien.position.y += alien.speed;
        alien.element.style.top = alien.position.y + 'px';
        
        if (alien.position.y > gameArea.offsetHeight) {
            alien.element.remove();
            gameState.aliens.splice(i, 1);
            updateHealth(gameState.health - CONFIG.difficulties[gameState.difficulty].missedAlienPenalty);
        }
    }
}

function createAlien(isBoss = false) {
    const alien = document.createElement('div');
    alien.className = 'alien' + (isBoss ? ' boss' : '');
    
    // Random position at the top
    const gameAreaRect = gameArea.getBoundingClientRect();
    const alienWidth = isBoss ? 80 : 40;
    const x = Math.random() * (gameAreaRect.width - alienWidth);
    
    alien.style.left = x + 'px';
    alien.style.top = '0px';
    gameArea.appendChild(alien);
    
    const alienObj = {
        element: alien,
        x: x,
        y: 0,
        health: isBoss ? 5 : 1,
        isBoss: isBoss,
        speed: CONFIG.difficulties[gameState.difficulty].alienSpeed * (isBoss ? 0.5 : 1),
        width: alienWidth,
        height: isBoss ? 80 : 40
    };
    
    gameState.aliens.push(alienObj);
    
    if (isBoss || (Math.random() < 0.2 && gameState.wave > 2)) {
        startAlienShooting(alienObj);
    }
    
    return alienObj;
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
        moveAlienProjectiles();
        checkCollisions();
        checkPowerUpCollisions();
        checkLaserCollisions();
        
        // Update laser position if active
        if (gameState.activePowerUps.laser) {
            gameState.activePowerUps.laser.element.style.left = (shipPosition.x + 23) + 'px';
        }
    }
    requestAnimationFrame(gameLoop);
}

function announceWave() {
    const announcement = document.createElement('div');
    announcement.className = 'wave-announcement' + (gameState.isBossWave ? ' boss-wave' : '');
    announcement.textContent = gameState.isBossWave ? 'BOSS WAVE!' : 'Wave ' + gameState.wave;
    gameArea.appendChild(announcement);
    
    // Remove announcement after animation
    setTimeout(() => announcement.remove(), 2000);
}

function startWave() {
    gameState.aliensInWave = 0;
    gameState.isBossWave = gameState.wave % CONFIG.bossWaveInterval === 0;
    
    announceWave();
    
    // Clear existing spawn interval
    if (gameState.spawnInterval) {
        clearInterval(gameState.spawnInterval);
    }
    
    const aliensInThisWave = CONFIG.difficulties[gameState.difficulty].aliensPerWave;
    const spawnRate = CONFIG.difficulties[gameState.difficulty].spawnRate;
    
    gameState.spawnInterval = setInterval(() => {
        if (!gameState.isPaused && !gameState.isGameOver && gameState.aliensInWave < aliensInThisWave) {
            createAlien(gameState.isBossWave);
            gameState.aliensInWave++;
            
            if (gameState.aliensInWave >= aliensInThisWave) {
                clearInterval(gameState.spawnInterval);
            }
        }
    }, spawnRate);
}

function startAlienShooting(alien) {
    const shootInterval = setInterval(() => {
        if (!gameState.isPaused && !gameState.isGameOver && !alien.element.isConnected) {
            clearInterval(shootInterval);
            return;
        }
        
        if (!gameState.isPaused && !gameState.isGameOver) {
            createAlienProjectile(alien);
        }
    }, 2000 + Math.random() * 1000);
}

function createAlienProjectile(alien) {
    const projectile = document.createElement('div');
    projectile.className = 'alien-projectile';
    projectile.style.left = (alien.x + alien.width / 2) + 'px';
    projectile.style.top = (alien.y + alien.height) + 'px';
    
    gameArea.appendChild(projectile);
    gameState.alienProjectiles.push({
        element: projectile,
        position: {
            x: parseFloat(projectile.style.left),
            y: parseFloat(projectile.style.top)
        },
        speed: 5
    });
}

function updateScore(newScore) {
    gameState.score = newScore;
    document.getElementById('score').textContent = newScore;
    
    // Check if we should advance to next wave
    const pointsPerWave = CONFIG.difficulties[gameState.difficulty].pointsPerWave;
    const shouldStartNewWave = Math.floor(newScore / pointsPerWave) + 1 > gameState.wave;
    
    if (shouldStartNewWave && !gameState.isTransitioningWave) {
        gameState.isTransitioningWave = true;
        gameState.wave = Math.floor(newScore / pointsPerWave) + 1;
        startNewWave();
    }
    
    // Spawn power-up at score 100
    if (newScore >= 100 && !gameState.powerUpSpawned) {
        spawnPowerUp();
        gameState.powerUpSpawned = true;
    }
}

function startNewWave() {
    // Clear existing aliens
    gameState.aliens.forEach(alien => alien.element.remove());
    gameState.aliens = [];
    gameState.aliensInWave = 0;
    
    // Determine if it's a boss wave
    gameState.isBossWave = gameState.wave % CONFIG.bossWaveInterval === 0;
    
    // Announce new wave
    announceWave();
    
    // Upgrade ship
    upgradeShip();
    
    // Start spawning new aliens after announcement
    setTimeout(() => {
        gameState.isTransitioningWave = false;
        startWave();
    }, 2000);
}

function upgradeShip() {
    const ship = document.querySelector('.ship');
    const wave = gameState.wave;
    
    // Remove previous wave classes
    ship.classList.remove('ship-wave-2', 'ship-wave-3', 'ship-wave-4', 'ship-wave-5');
    
    // Apply new wave class based on current wave
    if (wave >= 2) {
        ship.classList.add(`ship-wave-${Math.min(wave, 5)}`);
        
        // Update projectile class for new shots
        gameState.currentProjectileClass = `projectile-wave-${Math.min(wave, 5)}`;
        
        // Update shooting properties based on wave
        switch(wave) {
            case 2:
                gameState.shootingCooldown = 200; // Faster shooting
                break;
            case 3:
                gameState.shootingCooldown = 150; // Even faster
                gameState.tripleShot = true;
                break;
            case 4:
                gameState.shootingCooldown = 100; // Very fast
                gameState.tripleShot = true;
                gameState.wideBeam = true;
                break;
            case 5:
                gameState.shootingCooldown = 50; // Ultimate rapid fire
                gameState.tripleShot = true;
                gameState.wideBeam = true;
                break;
        }
        
        // Announce upgrade
        announceUpgrade(wave);
    }
}

function announceUpgrade(wave) {
    const messages = {
        2: "Ship Upgraded: Energy Core Enhanced!",
        3: "Ship Upgraded: Golden Warrior Activated!",
        4: "Ship Upgraded: Plasma Technology Unlocked!",
        5: "Ship Upgraded: Ultimate Form Achieved!"
    };
    
    const announcement = document.createElement('div');
    announcement.className = 'wave-announcement upgrade-announcement';
    announcement.textContent = messages[wave] || "Ship Upgraded!";
    document.getElementById('game-area').appendChild(announcement);
    
    setTimeout(() => {
        announcement.remove();
    }, 2000);
}

function checkCollisions() {
    const projectiles = gameState.projectiles;
    const aliens = gameState.aliens;
    const shipRect = ship.getBoundingClientRect();
    
    // Check projectile-alien collisions
    projectiles.forEach((projectile, index) => {
        const projectileRect = projectile.element.getBoundingClientRect();
        
        aliens.forEach((alien, alienIndex) => {
            const alienRect = alien.element.getBoundingClientRect();
            
            if (isColliding(projectileRect, alienRect)) {
                // Create explosion effect
                const explosion = document.createElement('div');
                explosion.className = 'explosion';
                explosion.style.left = alienRect.left + 'px';
                explosion.style.top = alienRect.top + 'px';
                gameArea.appendChild(explosion);
                setTimeout(() => explosion.remove(), 500);
                
                alien.element.remove();
                projectile.element.remove();
                gameState.aliens.splice(alienIndex, 1);
                gameState.projectiles.splice(index, 1);
                
                const baseScore = 10 * CONFIG.difficulties[gameState.difficulty].scoreMultiplier;
                updateScore(gameState.score + baseScore);
            }
        });
    });
    
    // Check ship-alien collisions
    aliens.forEach((alien, index) => {
        const alienRect = alien.element.getBoundingClientRect();
        if (isColliding(shipRect, alienRect)) {
            alien.element.remove();
            gameState.aliens.splice(index, 1);
            updateHealth(gameState.health - CONFIG.difficulties[gameState.difficulty].healthLoss);
        }
    });
}

function isColliding(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
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

function moveAlienProjectiles() {
    for (let i = gameState.alienProjectiles.length - 1; i >= 0; i--) {
        const projectile = gameState.alienProjectiles[i];
        projectile.position.y += projectile.speed;
        projectile.element.style.top = projectile.position.y + 'px';
        
        // Remove if off screen
        if (projectile.position.y > gameArea.offsetHeight) {
            projectile.element.remove();
            gameState.alienProjectiles.splice(i, 1);
        }
        
        // Check collision with player
        const projectileRect = projectile.element.getBoundingClientRect();
        const shipRect = ship.getBoundingClientRect();
        
        if (isColliding(projectileRect, shipRect)) {
            projectile.element.remove();
            gameState.alienProjectiles.splice(i, 1);
            updateHealth(gameState.health - 10);
        }
    }
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
