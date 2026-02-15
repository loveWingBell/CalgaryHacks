import Phaser from "phaser"

export default class Player extends Phaser.Physics.Arcade.Sprite {
	private cursors: Phaser.Types.Input.Keyboard.CursorKeys
	private keys: any

	public width = 32
	public height = this.width
	public max_velocity = { x: 500, y: 800 }
	public jump = { speed: 300, force: -500 }

	constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
		super(scene, x, y, texture)

		// 1. Add to scene and physics
		scene.add.existing(this)
		scene.physics.add.existing(this)

		// 2. Configure Physics
		this.setDisplaySize(this.width, this.height)
		this.setOrigin(0, 0)
		// Explicitly cast body to Arcade Body to access setSize/setOffset
		const body = this.body as Phaser.Physics.Arcade.Body
		body.setSize(this.width, this.height, false)
		body.setOffset(this.width / 4, this.height * 4)
		body.setCollideWorldBounds(true)
		body.setMaxVelocity(this.max_velocity.x, this.max_velocity.y) // Prevents tunneling

		// 3. Setup Inputs
		this.cursors = scene.input.keyboard!.createCursorKeys()
		this.keys = scene.input.keyboard!.addKeys({
			a: Phaser.Input.Keyboard.KeyCodes.A,
			d: Phaser.Input.Keyboard.KeyCodes.D,
		})
	}

	update() {
		const body = this.body as Phaser.Physics.Arcade.Body

		// Horizontal Movement
		body.setVelocityX(0)
		if (this.cursors.left.isDown || this.keys.a.isDown) {
			body.setVelocityX(-this.jump.speed)
		} else if (this.cursors.right.isDown || this.keys.d.isDown) {
			body.setVelocityX(this.jump.speed)
		}

		// Jump
		const isGrounded = body.blocked.down || body.touching.down
		if (this.cursors.up.isDown && isGrounded) {
			body.setVelocityY(this.jump.force)
		}
	}
}
