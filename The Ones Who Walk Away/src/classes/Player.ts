import Phaser from "phaser"

//NOTE: CURRENTLY IN debug mode bc i'm trying to figure out why the bounce loop was happening.

export default class Player extends Phaser.Physics.Arcade.Sprite {
	private cursors: Phaser.Types.Input.Keyboard.CursorKeys
	private keys: any
	private canShoot = true
	private shootCooldown = 200

	public width = 24
	public height = 24
	public max_velocity = { x: 300, y: 1000 }
	public moveSpeed = 200
	public bounceForce = -450 // Bounce velocity when landing on enemy/breakable platform

	constructor(scene: Phaser.Scene, x: number, y: number) {
		// Simple player sprite (white square)
		const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
		graphics.fillStyle(0xffffff, 1)
		graphics.fillRect(0, 0, 24, 24)
		graphics.generateTexture("player_sprite", 24, 24)
		graphics.destroy()

		super(scene, x, y, "player_sprite")

		// Add to scene and physics
		scene.add.existing(this)
		scene.physics.add.existing(this)

		// Configure Physics
		const body = this.body as Phaser.Physics.Arcade.Body
		body.setSize(this.width, this.height)
		body.setCollideWorldBounds(true, 0, 1, false) // Don't bounce on world bounds
		body.setMaxVelocity(this.max_velocity.x, this.max_velocity.y)
		
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

		// Shooting (downward) - only works while in air
		if (this.keys.space.isDown && this.canShoot && !body.blocked.down) {
			this.shoot()
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
		console.log(`🎈 Player.bounce() called - velocity set to ${this.bounceForce}`)
	}

	// Check if player fell off the bottom of the screen
	isDead(): boolean {
		return this.y > this.scene.cameras.main.scrollY + this.scene.scale.height + 100
	}
}