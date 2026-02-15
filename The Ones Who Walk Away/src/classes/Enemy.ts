import Phaser from "phaser"
import Platform from "./Platform"

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
	public isDestroyed = false
	private homePlatform: Platform
	private moveSpeed = 60

	constructor(scene: Phaser.Scene, x: number, y: number, platform: Platform) {
		// Simple enemy sprite (red square)
		const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
		graphics.fillStyle(0xff0000, 1)
		graphics.fillRect(0, 0, 24, 24)
		graphics.generateTexture("enemy", 24, 24)
		graphics.destroy()

		super(scene, x, y, "enemy")

		this.homePlatform = platform

		scene.add.existing(this)
		scene.physics.add.existing(this)

		const body = this.body as Phaser.Physics.Arcade.Body
		body.setAllowGravity(true) // Enemy affected by gravity
		body.setCollideWorldBounds(false) // Don't need world bounds, we have platform bounds

		// Start moving in a random direction
		const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1
		body.setVelocityX(direction * this.moveSpeed)
	}

	update() {
		// If home platform is destroyed, enemy should be too
		if (this.homePlatform.isDestroyed) {
			this.destroy()
			return
		}

		const body = this.body as Phaser.Physics.Arcade.Body
		const platformBody = this.homePlatform.body as Phaser.Physics.Arcade.StaticBody
		
		// Get platform bounds
		const platformLeft = platformBody.left
		const platformRight = platformBody.right
		
		// Get enemy position
		const enemyLeft = body.left
		const enemyRight = body.right
		
		// Reverse direction if reaching platform edge
		if (body.velocity.x < 0 && enemyLeft <= platformLeft + 5) {
			// Moving left and hit left edge
			body.setVelocityX(this.moveSpeed)
		} else if (body.velocity.x > 0 && enemyRight >= platformRight - 5) {
			// Moving right and hit right edge
			body.setVelocityX(-this.moveSpeed)
		}
	}

	destroy(fromScene?: boolean) {
		this.isDestroyed = true
		super.destroy(fromScene)
	}
}