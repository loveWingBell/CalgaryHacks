import Phaser from "phaser"
import marioUrl from "/public/assets/sprites/mario.webp"
import backgroundUrl from "/public/assets/background.webp"

class VerticalScrolling extends Phaser.Scene {
	private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
	private background!: Phaser.GameObjects.TileSprite
	private cursors!: any
	private keys!: any

	constructor() {
		super("VerticalScrolling")
	}

	preload() {
		this.load.image("mario", marioUrl)
		this.load.image("background", backgroundUrl)
	}

	create() {
		const player = { width: 32, height: 32 }

		// Create a TileSprite covering the screen
		const { width, height } = this.scale
		this.background = this.add
			.tileSprite(0, 0, width, height, "background")
			.setOrigin(0, 0)
			.setScrollFactor(0) // Keeps the object from moving with the camera

		// CREATE PLAYER
		// 1. Initialize Sprite
		this.player = this.physics.add.sprite(
			width / 2 - player.width / 2,
			100,
			"mario",
		)

		// 2. Set Visual Size
		this.player.setDisplaySize(player.width, player.height)

		// 3. Set Origin to Top-Left
		this.player.setOrigin(0, 0)

		// 4. Critical: Reset the physics body to match the top-left origin
		// Passing 'false' to the third argument prevents Phaser from
		// trying to center the body on the origin.
		this.player.body.setSize(player.width, player.height, false)

		// 5. Ensure the body offset is zeroed out
		this.player.body.setOffset(0, player.height * 4)

		// 6. Enable world bounds collision
		this.player.setCollideWorldBounds(true)

		// Define standard arrow keys + space/shift
		this.cursors = this.input.keyboard?.createCursorKeys()

		// Define specific keys (A and D)
		this.keys = this.input.keyboard?.addKeys({
			a: Phaser.Input.Keyboard.KeyCodes.A,
			d: Phaser.Input.Keyboard.KeyCodes.D,
		})

		// World height
		const worldHeight = 2000
		this.physics.world.setBounds(0, 0, 256, worldHeight)
		this.player.setCollideWorldBounds(true)

		// Keep player in vertical center of the screen
		this.cameras.main.setBounds(0, 0, 256, worldHeight)
		this.cameras.main.startFollow(this.player, true, 0, 1)
	}

	update() {
		const speed = 300
		const jumpForce = 2
		let hasLanded = true

		// Scroll the background texture based on player velocity or position
		// tilePositionY moves the texture vertically within the sprite
		this.background.tilePositionY = this.cameras.main.scrollY * 0.5

		// Reset velocity every frame
		this.player.setVelocityX(0)

		// Check for Left movement (Left Arrow OR A key)
		if (this.cursors.left.isDown || this.keys.a.isDown) {
			this.player.setVelocityX(-speed)
		}
		// Check for Right movement (Right Arrow OR D key)
		else if (this.cursors.right.isDown || this.keys.d.isDown) {
			this.player.setVelocityX(speed)
			console.log(this.player.x)
		}
		// Check for jump input

		if (this.cursors.up.isDown && this.player.body.blocked.down) {
			hasLanded = false
			this.player.setVelocityY(jumpForce * -speed)
			console.log(`hasLanded: ${hasLanded}`)
		}

		console.log(this.player.y)
	}
}

export default VerticalScrolling
