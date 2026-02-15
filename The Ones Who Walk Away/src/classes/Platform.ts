import Phaser from "phaser"

export type PlatformType = "solid" | "breakable"

export default class Platform extends Phaser.Physics.Arcade.Sprite {
	public platformType: PlatformType
	public isDestroyed = false

	constructor(
		scene: Phaser.Scene,
		x: number,
		y: number,
		type: PlatformType = "solid",
	) {
		// Create different colored sprites based on type
		const color = type === "solid" ? 0x00ff00 : 0xffaa00 // Green for solid, Orange for breakable
		const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
		graphics.fillStyle(color, 1)
		graphics.fillRect(0, 0, 80, 16)
		const textureName = `platform_${type}`
		graphics.generateTexture(textureName, 80, 16)
		graphics.destroy()

		super(scene, x, y, textureName)

		this.platformType = type

		scene.add.existing(this)
		scene.physics.add.existing(this, true) // true = static body

		// Make the body match the visual size
		const body = this.body as Phaser.Physics.Arcade.StaticBody
		body.updateFromGameObject()
	}

	breakPlatform() {
		if (this.platformType === "breakable") {
			// Mark as destroyed IMMEDIATELY to prevent re-collision
			this.isDestroyed = true
			
			// Disable physics body immediately
			if (this.body) {
				(this.body as Phaser.Physics.Arcade.StaticBody).enable = false
			}
			
			// Visual feedback: fade out
			this.scene.tweens.add({
				targets: this,
				alpha: 0,
				duration: 200,
				onComplete: () => {
					this.destroy()
				},
			})
		}
	}

	destroy(fromScene?: boolean) {
		this.isDestroyed = true
		super.destroy(fromScene)
	}
}