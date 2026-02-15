import Phaser from "phaser"
import Player from "../classes/Player"
import Platform from "../classes/Platform"
import Enemy from "../classes/Enemy"

//NOTE: FIXED! will remove after this push

export default class VerticalScrolling extends Phaser.Scene {
	private player!: Player
	private background!: Phaser.GameObjects.TileSprite
	private platforms: Platform[] = []
	private enemies: Enemy[] = []
	private platformColliders: Map<Platform, Phaser.Physics.Arcade.Collider> = new Map()

	// Spawning
	private lastSpawnY = 0
	private spawnInterval = 150
	private initialSpawnY = 100

	// Difficulty scaling
	private distanceTraveled = 0
	private difficultyLevel = 0
	private enemySpawnChance = 0.25
	private breakablePlatformChance = 0.35

	// Score/Stats
	private scoreText!: Phaser.GameObjects.Text
	private score = 0

	// Collision tracking
	private justBounced = false
	private bounceCooldownTimer?: Phaser.Time.TimerEvent
	private lastBounceY = -1000 // Track where last bounce happened
	private minimumFallDistance = 80 // Must fall at least this far before bouncing again
	private lastSolidLandingY = -1000 // Track last solid platform landing
	private solidLandingCooldown = false

	// Debug
	private debugMode = true // TURN ON DEBUG
	private debugGraphics!: Phaser.GameObjects.Graphics
	private debugText!: Phaser.GameObjects.Text

	constructor() {
		super("VerticalScrolling")
	}

	preload() {
		// Load player sprite sheet
		this.load.spritesheet("player_spritesheet", "/AnimationSheet_Character.png", {
			frameWidth: 32,
			frameHeight: 32,
		})
		
		// Create bullet texture
		const graphics = this.make.graphics({ x: 0, y: 0 }, false)
		graphics.fillStyle(0xffff00, 1)
		graphics.fillCircle(4, 4, 4)
		graphics.generateTexture("bullet", 8, 8)
		graphics.destroy()
	}

	create() {
		this.createBackground()
		this.createPlayerAnimations()
		this.createPlayer()
		this.setupCamera()
		this.createUI()

		if (this.debugMode) {
			this.debugGraphics = this.add.graphics()
			this.debugGraphics.setDepth(1000)
			
			this.debugText = this.add
				.text(10, 80, "", {
					fontSize: "12px",
					color: "#00ff00",
					fontFamily: "Courier",
					backgroundColor: "#000000",
				})
				.setScrollFactor(0)
				.setDepth(101)
		}

		this.lastSpawnY = this.player.y

		for (let i = 0; i < 20; i++) {
			this.spawnPlatform()
		}

		console.log(`=== GAME STARTED ===`)
		console.log(`Solid: ${this.platforms.filter(p => p.platformType === 'solid').length}`)
		console.log(`Breakable: ${this.platforms.filter(p => p.platformType === 'breakable').length}`)
		console.log(`Enemies: ${this.enemies.length}`)
	}

	update() {
		this.player.update()

		// Check if player is somehow stuck (shouldn't happen with world bounds disabled)
		const playerBody = this.player.body as Phaser.Physics.Arcade.Body
		if (playerBody.blocked.down || playerBody.blocked.up) {
			console.log(`⚠️ WARNING: Player blocked! down=${playerBody.blocked.down}, up=${playerBody.blocked.up}, Y=${this.player.y.toFixed(0)}`)
			console.log(`   Velocity: ${playerBody.velocity.y.toFixed(1)}, World bounds disabled: ${!playerBody.collideWorldBounds}`)
		}

		const newDistance = Math.floor((this.player.y - this.initialSpawnY) / 100)
		if (newDistance > this.distanceTraveled) {
			this.distanceTraveled = newDistance
			this.updateDifficulty()
		}

		this.enemies.forEach((enemy) => {
			if (!enemy.isDestroyed) {
				enemy.update()
			}
		})

		// Spawn platforms ahead of player - handle multiple spawns per frame if falling fast
		// Always maintain platforms at least 300px ahead of player
		const playerAheadMargin = 300
		const spawnAheadTarget = this.player.y + playerAheadMargin
		
		let spawnsThisFrame = 0
		const maxSpawnsPerFrame = 10 // Safety limit
		
		while (this.lastSpawnY < spawnAheadTarget && spawnsThisFrame < maxSpawnsPerFrame) {
			this.spawnPlatform()
			spawnsThisFrame++
		}
		
		if (spawnsThisFrame > 3 && this.debugMode) {
			console.log(`⚡ Fast falling! Spawned ${spawnsThisFrame} platforms to catch up`)
		}

		this.cleanupOffscreenObjects()

		// EMERGENCY DEBUG: Log everything when hovering (low but positive velocity)
		if (playerBody.velocity.y > 0 && playerBody.velocity.y < 200 && this.debugMode) {
			const nearbyPlatforms = this.platforms
				.filter(p => !p.isDestroyed && Math.abs(p.y - this.player.y) < 100)
				.map(p => ({ 
					y: p.y.toFixed(0), 
					type: p.platformType, 
					dist: (p.y - this.player.y).toFixed(0),
					top: ((p.body as any).top).toFixed(0),
					playerBottom: playerBody.bottom.toFixed(0)
				}))
			const nearbyEnemies = this.enemies
				.filter(e => !e.isDestroyed && Math.abs(e.y - this.player.y) < 100)
				.map(e => ({ y: e.y.toFixed(0), dist: (e.y - this.player.y).toFixed(0) }))
			
			console.log(`🐌 HOVERING! Y=${this.player.y.toFixed(0)}, VelY=${playerBody.velocity.y.toFixed(1)}, Bottom=${playerBody.bottom.toFixed(0)}`)
			console.log(`  Platforms:`, nearbyPlatforms)
			console.log(`  Enemies:`, nearbyEnemies)
			console.log(`  Last bounce Y: ${this.lastBounceY.toFixed(0)}, Dist since: ${Math.abs(this.player.y - this.lastBounceY).toFixed(0)}`)
		}

		// ONLY check bounce collisions if not in cooldown
		if (!this.justBounced) {
			try {
				this.checkBounceCollisions()
			} catch (error) {
				console.error('❌ Error in checkBounceCollisions:', error)
				// Reset bounce state to prevent softlock
				this.justBounced = false
			}
		}

		if (this.debugMode) {
			this.drawDebug()
			this.updateDebugText()
		}

		this.background.tilePositionY = this.cameras.main.scrollY * 0.5
		
		const activeColliders = this.physics.world.colliders.getActive().length
		this.scoreText.setText(
			`Score: ${this.score}\n` +
			`Depth: ${this.distanceTraveled}m\n` +
			`Platforms: ${this.platforms.length}\n` +
			`Colliders: ${activeColliders}`
		)

		if (this.player.isDead()) {
			this.gameOver()
		}
	}

	private createBackground() {
		const { width, height } = this.scale
		
		const bgGraphics = this.make.graphics({ x: 0, y: 0 }, false)
		bgGraphics.fillStyle(0x0a0a1a, 1)
		bgGraphics.fillRect(0, 0, width, height)
		for (let i = 0; i < 50; i++) {
			const x = Math.random() * width
			const y = Math.random() * height
			const size = Math.random() * 2
			bgGraphics.fillStyle(0xffffff, Math.random() * 0.8 + 0.2)
			bgGraphics.fillCircle(x, y, size)
		}
		bgGraphics.generateTexture("background", width, height)
		bgGraphics.destroy()

		this.background = this.add
			.tileSprite(0, 0, width, height, "background")
			.setOrigin(0, 0)
			.setScrollFactor(0)
	}

	private createPlayerAnimations() {
		// Row 1 (frames 0-1): Neutral/Idle animation (first TWO sprites only)
		this.anims.create({
			key: "player_idle",
			frames: this.anims.generateFrameNumbers("player_spritesheet", { start: 0, end: 1 }),
			frameRate: 6,
			repeat: -1, // Loop forever
		})

		// Row 4 (frames 24-31): Move Right animation
		this.anims.create({
			key: "player_move_right",
			frames: this.anims.generateFrameNumbers("player_spritesheet", { start: 24, end: 31 }),
			frameRate: 12,
			repeat: -1,
		})

		// Row 4 (frames 24-31): Move Left animation (will be flipped in code)
		this.anims.create({
			key: "player_move_left",
			frames: this.anims.generateFrameNumbers("player_spritesheet", { start: 24, end: 31 }),
			frameRate: 12,
			repeat: -1,
		})

		// Row 5, sprite 6 (frame 37): Fall animation (single frame)
		// Row 5 starts at frame 32 (4 rows * 8 frames = 32), so sprite 6 is at index 32 + 5 = 37
		this.anims.create({
			key: "player_fall",
			frames: [{ key: "player_spritesheet", frame: 37 }],
			frameRate: 1,
		})

		console.log("✅ Player animations created")
	}

	private createPlayer() {
		this.player = new Player(this, this.scale.width / 2, this.initialSpawnY)
	}

	private setupCamera() {
		// Camera bounds for infinite falling
		const worldHeight = 100000
		this.cameras.main.setBounds(0, -1000, this.scale.width, worldHeight)
		// No physics world bounds needed - player has world bounds disabled
		
		console.log(`📷 Camera bounds: Y from -1000 to ${worldHeight - 1000}`)
		console.log(`   Player world bounds: DISABLED (infinite falling)`)
		
		this.cameras.main.startFollow(this.player, true, 0, 0.1)
	}

	private createUI() {
		this.scoreText = this.add
			.text(10, 10, "Score: 0\nDepth: 0m", {
				fontSize: "16px",
				color: "#ffffff",
				fontFamily: "Arial",
			})
			.setScrollFactor(0)
			.setDepth(100)
	}

	private spawnPlatform() {
		const platformWidth = 80
		const minX = 20
		const maxX = this.scale.width - platformWidth - 20

		const x = Phaser.Math.Between(minX, maxX)
		const y = this.lastSpawnY + this.spawnInterval

		const rand = Math.random()
		const platformType = rand < this.breakablePlatformChance ? "breakable" : "solid"

		const platform = new Platform(this, x, y, platformType)
		this.platforms.push(platform)

		// Add collision for solid platforms and store the collider reference
		if (platformType === "solid") {
			const collider = this.physics.add.collider(
				this.player, 
				platform,
				() => {
					// Collision callback - log first few times for debugging
					if (this.debugMode && this.platforms.length < 30) {
						console.log(`💥 Player collided with SOLID platform at Y=${platform.y.toFixed(0)}`)
					}
				},
				(player, plat) => {
					// Process callback - ensure the collision is valid
					// This runs before collision resolution
					const playerBody = (player as Player).body as Phaser.Physics.Arcade.Body
					const platformBody = (plat as Platform).body as Phaser.Physics.Arcade.StaticBody
					
					// Only collide if player is falling onto platform from above
					return playerBody.velocity.y > 0 && playerBody.bottom <= platformBody.top + 20
				},
				this
			)
			this.platformColliders.set(platform, collider)
			
			if (this.debugMode && this.platforms.length < 25) {
				console.log(`✅ Created SOLID platform at Y=${y.toFixed(0)} with collider`)
			}
		} else if (this.debugMode && this.platforms.length < 25) {
			console.log(`🟧 Created BREAKABLE platform at Y=${y.toFixed(0)} (no collider, manual bounce)`)
		}

		const enemyRand = Math.random()
		if (enemyRand < this.enemySpawnChance) {
			const enemyX = x + platformWidth / 2
			const enemyY = y - 24
			this.spawnEnemy(enemyX, enemyY, platform)
		}

		this.lastSpawnY = y
	}

	private spawnEnemy(x: number, y: number, platform: Platform) {
		const enemy = new Enemy(this, x, y, platform)
		this.enemies.push(enemy)
		
		// Add collision with the home platform immediately
		this.physics.add.collider(enemy, platform)
	}

	private checkBounceCollisions() {
		const playerBody = this.player.body as Phaser.Physics.Arcade.Body
		
		// MUST be moving downward with significant velocity to bounce
		if (playerBody.velocity.y < 100) {
			return
		}

		// MUST have fallen far enough since last bounce
		const distanceSinceLastBounce = Math.abs(this.player.y - this.lastBounceY)
		if (distanceSinceLastBounce < this.minimumFallDistance) {
			console.log(`⏸️ Too soon to bounce (only ${distanceSinceLastBounce.toFixed(0)}px, need ${this.minimumFallDistance})`)
			return
		}

		const playerBottom = playerBody.bottom
		const playerCenterX = playerBody.center.x
		const playerLeft = playerBody.left
		const playerRight = playerBody.right

		// Debug: log all breakable platforms being checked
		const breakablePlatforms = this.platforms.filter(p => 
			!p.isDestroyed && p.active && p.platformType === "breakable"
		)
		
		if (this.debugMode && breakablePlatforms.length > 0) {
			console.log(`🔍 Checking ${breakablePlatforms.length} breakable platforms. Player at Y=${this.player.y.toFixed(0)}, bottom=${playerBottom.toFixed(0)}`)
		}

		// Check breakable platforms - ONLY platforms BELOW the player
		let nearestBreakable: Platform | null = null
		let nearestBreakableDist = Infinity

		for (const platform of this.platforms) {
			if (platform.isDestroyed || !platform.active || platform.platformType !== "breakable") {
				continue
			}

			// Safety check - ensure body exists
			if (!platform.body) {
				console.warn('⚠️ Platform has no body:', platform)
				continue
			}

			const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody
			const platformTop = platformBody.top
			const platformLeft = platformBody.left
			const platformRight = platformBody.right

			// Only check platforms BELOW the player
			if (platformTop < playerBottom) {
				if (this.debugMode) {
					console.log(`  ⬆️ Skipping platform at Y=${platform.y.toFixed(0)} (above player, top=${platformTop.toFixed(0)})`)
				}
				continue
			}

			// Calculate vertical distance (platform is below player)
			const vertDist = platformTop - playerBottom
			
			// Check horizontal overlap
			const hasHorizontalOverlap = 
				(playerCenterX >= platformLeft && playerCenterX <= platformRight) ||
				(playerLeft < platformRight && playerRight > platformLeft)

			if (this.debugMode && vertDist < 50) {
				console.log(`  📍 Platform at Y=${platform.y.toFixed(0)}, vertDist=${vertDist.toFixed(1)}, overlap=${hasHorizontalOverlap}`)
			}

			if (hasHorizontalOverlap && vertDist < nearestBreakableDist) {
				nearestBreakableDist = vertDist
				nearestBreakable = platform
			}
		}

		// If we found a nearby breakable within collision range
		if (nearestBreakable && nearestBreakableDist <= 12) {
			console.log(`⚡ BOUNCE on BREAKABLE at Y=${nearestBreakable.y.toFixed(0)} (dist=${nearestBreakableDist.toFixed(1)}px)`)
			this.triggerBounce()
			nearestBreakable.breakPlatform()
			this.score += 15
			return
		}

		// Check enemies BELOW the player
		let nearestEnemy: Enemy | null = null
		let nearestEnemyDist = Infinity

		for (const enemy of this.enemies) {
			if (enemy.isDestroyed || !enemy.active) {
				continue
			}

			// Safety check - ensure body exists
			if (!enemy.body) {
				console.warn('⚠️ Enemy has no body:', enemy)
				continue
			}

			const enemyBody = enemy.body as Phaser.Physics.Arcade.Body
			const enemyTop = enemyBody.top
			const enemyLeft = enemyBody.left
			const enemyRight = enemyBody.right

			if (enemyTop < playerBottom) {
				continue
			}

			const vertDist = enemyTop - playerBottom
			
			const hasHorizontalOverlap = 
				(playerCenterX >= enemyLeft && playerCenterX <= enemyRight) ||
				(playerLeft < enemyRight && playerRight > enemyLeft)

			if (hasHorizontalOverlap && vertDist < nearestEnemyDist) {
				nearestEnemyDist = vertDist
				nearestEnemy = enemy
			}
		}

		if (nearestEnemy && nearestEnemyDist <= 12) {
			console.log(`⚡ BOUNCE on ENEMY at Y=${nearestEnemy.y.toFixed(0)} (dist=${nearestEnemyDist.toFixed(1)}px)`)
			this.triggerBounce()
			nearestEnemy.destroy()
			this.score += 50
			return
		}

		// Check bullets hitting enemies
		this.children.each((child) => {
			if (
				child instanceof Phaser.Physics.Arcade.Sprite &&
				child.texture.key === "bullet" &&
				child.active
			) {
				const bulletBody = child.body as Phaser.Physics.Arcade.Body
				
				for (const enemy of this.enemies) {
					if (enemy.isDestroyed || !enemy.active) {
						continue
					}
					
					const enemyBody = enemy.body as Phaser.Physics.Arcade.Body
					
					if (Phaser.Geom.Intersects.RectangleToRectangle(bulletBody, enemyBody)) {
						child.destroy()
						enemy.destroy()
						this.score += 25
						console.log(" Shot enemy!")
						return
					}
				}
			}
		})
	}

	private handleSolidPlatformCollisions() {
		const playerBody = this.player.body as Phaser.Physics.Arcade.Body
		const playerBottom = playerBody.bottom
		const playerLeft = playerBody.left
		const playerRight = playerBody.right
		
		// Only check for solid platform collisions if falling with decent velocity
		if (playerBody.velocity.y < 50) {
			return
		}

		// Don't re-land on same platform immediately
		if (this.solidLandingCooldown) {
			return
		}

		for (const platform of this.platforms) {
			if (platform.isDestroyed || !platform.active || platform.platformType !== "solid") {
				continue
			}

			const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody
			const platformTop = platformBody.top
			const platformLeft = platformBody.left
			const platformRight = platformBody.right

			// Check if player is landing on this platform from above
			const vertDist = platformTop - playerBottom
			
			// CRITICAL FIX: Only trigger when platformTop is BELOW playerBottom (vertDist >= 0)
			// and within landing range. Don't trigger if we're already past the platform (vertDist < 0)
			if (vertDist >= 0 && vertDist <= 15) {
				// Check horizontal overlap
				const hasOverlap = playerRight > platformLeft && playerLeft < platformRight
				
				if (hasOverlap) {
					// Land on platform - NO BOUNCE, just stop
					this.player.y = platformTop - playerBody.height / 2
					playerBody.setVelocityY(0)
					this.lastSolidLandingY = this.player.y
					this.solidLandingCooldown = true
					
					console.log(`🟢 Landed on SOLID platform at Y=${platform.y.toFixed(0)}, vertDist=${vertDist.toFixed(1)}`)
					
					// Release cooldown after a short delay
					this.time.delayedCall(300, () => {
						this.solidLandingCooldown = false
					})
					
					return
				} else if (this.debugMode && vertDist <= 20) {
					console.log(`  ⬜ Near solid platform at Y=${platform.y.toFixed(0)}, vertDist=${vertDist.toFixed(1)}, but no overlap`)
				}
			}
		}
	}

	private triggerBounce() {
		this.player.bounce()
		this.justBounced = true
		this.lastBounceY = this.player.y // Remember where we bounced
		
		if (this.bounceCooldownTimer) {
			this.bounceCooldownTimer.destroy()
		}
		
		console.log(`Bounce locked for 600ms at Y=${this.player.y.toFixed(0)}`)
		
		this.bounceCooldownTimer = this.time.delayedCall(600, () => {
			this.justBounced = false
			console.log(`Bounce unlocked`)
		})
	}

	private drawDebug() {
		this.debugGraphics.clear()
		
		const playerBody = this.player.body as Phaser.Physics.Arcade.Body
		
		// Player hitbox - color based on bounce state
		const playerColor = this.justBounced ? 0xff0000 : 0x00ff00
		this.debugGraphics.lineStyle(3, playerColor)
		this.debugGraphics.strokeRect(playerBody.x, playerBody.y, playerBody.width, playerBody.height)
		
		// Player center point
		this.debugGraphics.fillStyle(playerColor, 1)
		this.debugGraphics.fillCircle(playerBody.center.x, playerBody.center.y, 3)
		
		// Platforms
		this.platforms.forEach((platform) => {
			if (!platform.isDestroyed) {
				const color = platform.platformType === "breakable" ? 0xff00ff : 0x00ffff
				const body = platform.body as Phaser.Physics.Arcade.StaticBody
				this.debugGraphics.lineStyle(2, color, 0.5)
				this.debugGraphics.strokeRect(body.x, body.y, body.width, body.height)
			}
		})
		
		// Enemies
		this.enemies.forEach((enemy) => {
			if (!enemy.isDestroyed) {
				const body = enemy.body as Phaser.Physics.Arcade.Body
				this.debugGraphics.lineStyle(2, 0xff0000, 0.7)
				this.debugGraphics.strokeRect(body.x, body.y, body.width, body.height)
			}
		})
	}

	private updateDebugText() {
		const playerBody = this.player.body as Phaser.Physics.Arcade.Body
		const velY = playerBody.velocity.y.toFixed(1)
		const posY = this.player.y.toFixed(1)
		const bounceState = this.justBounced ? "LOCKED 🔒" : "READY ✓"
		const distSinceBounce = Math.abs(this.player.y - this.lastBounceY).toFixed(1)
		
		// Find nearest bounceable object
		let nearestInfo = "None"
		let minDist = Infinity
		
		for (const platform of this.platforms) {
			if (platform.platformType === "breakable" && !platform.isDestroyed) {
				const dist = Math.abs(playerBody.bottom - (platform.body as any).top)
				if (dist < minDist) {
					minDist = dist
					nearestInfo = `Breakable ${dist.toFixed(0)}px below`
				}
			}
		}
		
		for (const enemy of this.enemies) {
			if (!enemy.isDestroyed) {
				const dist = Math.abs(playerBody.bottom - (enemy.body as any).top)
				if (dist < minDist) {
					minDist = dist
					nearestInfo = `Enemy ${dist.toFixed(0)}px below`
				}
			}
		}
		
		this.debugText.setText(
			`VelY: ${velY}\n` +
			`PosY: ${posY}\n` +
			`Bounce: ${bounceState}\n` +
			`Dist since bounce: ${distSinceBounce}px\n` +
			`Nearest: ${nearestInfo}`
		)
	}

	private cleanupOffscreenObjects() {
		const cameraTop = this.cameras.main.scrollY - 200
		const maxPlatforms = 30 // Reduced limit to prevent memory issues
		const maxEnemies = 15 // Limit enemies too

		const beforeCount = this.platforms.length
		this.platforms = this.platforms.filter((platform) => {
			if (platform.y < cameraTop || platform.isDestroyed) {
				// Destroy the collider if it exists
				const collider = this.platformColliders.get(platform)
				if (collider) {
					collider.destroy()
					this.platformColliders.delete(platform)
				}
				
				if (!platform.isDestroyed) {
					platform.destroy()
				}
				return false
			}
			return true
		})
		
		// Emergency cleanup if we have too many platforms
		if (this.platforms.length > maxPlatforms) {
			const oldestPlatforms = this.platforms
				.sort((a, b) => a.y - b.y) // Sort by Y position (oldest = lowest Y)
				.slice(0, this.platforms.length - maxPlatforms)
			
			oldestPlatforms.forEach(p => {
				// Destroy the collider
				const collider = this.platformColliders.get(p)
				if (collider) {
					collider.destroy()
					this.platformColliders.delete(p)
				}
				
				if (!p.isDestroyed) {
					p.destroy()
				}
			})
			
			this.platforms = this.platforms.filter(p => !p.isDestroyed)
			console.log(`🧹 Emergency cleanup! Removed ${oldestPlatforms.length} old platforms`)
		}

		this.enemies = this.enemies.filter((enemy) => {
			if (enemy.y < cameraTop || enemy.isDestroyed) {
				if (!enemy.isDestroyed) {
					enemy.destroy()
				}
				return false
			}
			return true
		})
		
		// Emergency enemy cleanup if too many
		if (this.enemies.length > maxEnemies) {
			const oldestEnemies = this.enemies
				.sort((a, b) => a.y - b.y)
				.slice(0, this.enemies.length - maxEnemies)
			
			oldestEnemies.forEach(e => {
				if (!e.isDestroyed) {
					e.destroy()
				}
			})
			
			this.enemies = this.enemies.filter(e => !e.isDestroyed)
			console.log(`🧹 Emergency enemy cleanup! Removed ${oldestEnemies.length} old enemies`)
		}
		
		// Log if we cleaned up a lot
		if (this.debugMode && beforeCount - this.platforms.length > 5) {
			console.log(`🗑️ Cleaned up ${beforeCount - this.platforms.length} platforms (now ${this.platforms.length} active)`)
		}
	}

	private updateDifficulty() {
		this.difficultyLevel = Math.floor(this.distanceTraveled / 10)
		this.enemySpawnChance = Math.min(0.25 + this.difficultyLevel * 0.04, 0.6)
		this.breakablePlatformChance = Math.min(0.35 + this.difficultyLevel * 0.04, 0.7)
		this.spawnInterval = Math.max(110, 150 - this.difficultyLevel * 3)

		console.log(`📊 Difficulty ${this.difficultyLevel}`)
	}

	private gameOver() {
		console.log(`💀 GAME OVER - Score: ${this.score}, Depth: ${this.distanceTraveled}m`)
		
		const gameOverText = this.add
			.text(
				this.scale.width / 2,
				this.cameras.main.scrollY + this.scale.height / 2,
				`GAME OVER\n\nFinal Score: ${this.score}\nDepth: ${this.distanceTraveled}m\n\nPress SPACE to restart`,
				{
					fontSize: "20px",
					color: "#ffffff",
					fontFamily: "Arial",
					align: "center",
				},
			)
			.setOrigin(0.5)
			.setScrollFactor(0)
			.setDepth(200)

		this.physics.pause()

		const restartKey = this.input.keyboard!.addKey(
			Phaser.Input.Keyboard.KeyCodes.SPACE,
		)
		restartKey.once("down", () => {
			this.scene.restart()
		})
	}
}