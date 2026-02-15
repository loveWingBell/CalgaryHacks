import Phaser from "phaser"

//NOTE: FIXED! will remove debug

export default class Player extends Phaser.Physics.Arcade.Sprite {
	private cursors: Phaser.Types.Input.Keyboard.CursorKeys
	private keys: any
	private canShoot = true
	private shootCooldown = 200 // milliseconds

	public width = 32
	public height = 32
	public max_velocity = { x: 300, y: 1000 }
	public moveSpeed = 200
	public bounceForce = -450 // Bounce velocity when landing on enemy/breakable platform

	constructor(scene: Phaser.Scene, x: number, y: number) {
		// Spritesheet sourced from https://penzilla.itch.io/hooded-protagonist
		super(scene, x, y, "player_spritesheet", 0)

		// Add to scene and physics
		scene.add.existing(this)
		scene.physics.add.existing(this)

		// Configure Physics
		const body = this.body as Phaser.Physics.Arcade.Body
		body.setSize(this.width, this.height)
		// NO world bounds collision for infinite falling game!
		body.setCollideWorldBounds(false)
		body.setMaxVelocity(this.max_velocity.x, this.max_velocity.y)
		
		// CRITICAL: Set bounce to 0 so Phaser doesn't auto-bounce on collisions
		body.setBounce(0, 0)

		// Setup Inputs
		this.cursors = scene.input.keyboard!.createCursorKeys()
		this.keys = scene.input.keyboard!.addKeys({
			a: Phaser.Input.Keyboard.KeyCodes.A,
			d: Phaser.Input.Keyboard.KeyCodes.D,
			space: Phaser.Input.Keyboard.KeyCodes.SPACE,
		})
	}

	update() {
		const body = this.body as Phaser.Physics.Arcade.Body

		// Horizontal Movement - only while falling
		const horizontalInput =
			(this.cursors.left.isDown || this.keys.a.isDown ? -1 : 0) +
			(this.cursors.right.isDown || this.keys.d.isDown ? 1 : 0)

		body.setVelocityX(horizontalInput * this.moveSpeed)

		// Keep player on screen horizontally (manual boundary check since world bounds disabled)
		const gameWidth = this.scene.scale.width
		if (this.x < this.width / 2) {
			this.x = this.width / 2
			body.setVelocityX(0)
		} else if (this.x > gameWidth - this.width / 2) {
			this.x = gameWidth - this.width / 2
			body.setVelocityX(0)
		}

		// Shooting (downward) - only works while in air
		if (this.keys.space.isDown && this.canShoot && !body.blocked.down) {
			this.shoot()
		}

		// Animation logic
		const isFalling = body.velocity.y > 150 // Falling threshold
		
		if (isFalling) {
			// Play fall animation when falling fast
			if (this.anims.currentAnim?.key !== "player_fall") {
				this.play("player_fall")
			}
		} else if (horizontalInput < 0) {
			// Moving left - flip the sprite
			this.setFlipX(true)
			if (this.anims.currentAnim?.key !== "player_move_left") {
				this.play("player_move_left")
			}
		} else if (horizontalInput > 0) {
			// Moving right - don't flip
			this.setFlipX(false)
			if (this.anims.currentAnim?.key !== "player_move_right") {
				this.play("player_move_right")
			}
		} else {
			// Idle - no horizontal movement
			this.setFlipX(false)
			if (this.anims.currentAnim?.key !== "player_idle") {
				this.play("player_idle")
			}
		}
	}

	shoot() {
		this.canShoot = false

		// Create bullet
		const bullet = this.scene.physics.add.sprite(this.x, this.y + 12, "bullet")
		const bulletBody = bullet.body as Phaser.Physics.Arcade.Body
		bulletBody.setVelocityY(400)
		bulletBody.setAllowGravity(false)

		// Recoil - slight upward push
		const body = this.body as Phaser.Physics.Arcade.Body
		body.setVelocityY(body.velocity.y - 50)

		// Cleanup bullet after it goes off-screen
		this.scene.time.delayedCall(2000, () => {
			bullet.destroy()
		})

		// Reset shoot cooldown
		this.scene.time.delayedCall(this.shootCooldown, () => {
			this.canShoot = true
		})
	}

	bounce() {
		// Called ONLY by the game when landing on enemy or breakable platform
		const body = this.body as Phaser.Physics.Arcade.Body
		body.setVelocityY(this.bounceForce)
		
		// Play bounce animation
		this.play("player_bounce")
		
		console.log(`Player.bounce() called - velocity set to ${this.bounceForce}`)
	}

	// Check if player fell off the bottom of the screen
	isDead(): boolean {
		return this.y > this.scene.cameras.main.scrollY + this.scene.scale.height + 100
	}
}