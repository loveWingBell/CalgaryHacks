import Phaser from "phaser"
import Player from "../classes/Player"
import playerSpritePath from "/public/assets/sprites/mario.webp"
import backgroundUrl from "/public/assets/background.webp"
import platformUrl from "/public/assets/platform.jpg"

export default class VerticalScrolling extends Phaser.Scene {
	private player!: Player
	private background!: Phaser.GameObjects.TileSprite
	private platforms!: Phaser.Physics.Arcade.StaticGroup

	public worldHeight = 3000
	public playerImage = { name: "player", path: playerSpritePath }
	public backgroundImage = { name: "background", path: backgroundUrl }
	public platformImage = { name: "platform", path: platformUrl }

	constructor() {
		super("VerticalScrolling")
	}

	preload() {
		this.load.image(this.playerImage.name, this.playerImage.path)
		this.load.image(this.backgroundImage.name, backgroundUrl)
	}

	create() {
		this.createBackground()
		this.createPlatforms()
		this.createPlayer()
		this.setupCamera()
	}

	update() {
		// Delegate update logic to the player class
		this.player.update()

		// Scene-specific updates (Background parallax)
		this.background.tilePositionY = this.cameras.main.scrollY * 0.5
	}

	private createBackground() {
		const { width, height } = this.scale
		this.background = this.add
			.tileSprite(0, 0, width, height, this.backgroundImage.name)
			.setOrigin(0, 0)
			.setScrollFactor(0)
	}

	private createPlatforms() {
		const platformDimensions = { width: this.scale.width / 3, height: 32 }

		this.physics.world.setBounds(0, 0, this.scale.width, this.worldHeight)

		this.platforms = this.physics.add.staticGroup()

		const platformCount = 30
		for (let i = 0; i < platformCount; i++) {
			const x = Phaser.Math.Between(
				0,
				this.scale.width + platformDimensions.width / 10,
			)
			const y =
				this.worldHeight - 200 - i * (this.worldHeight / platformCount)

			const platform = this.platforms.create(
				x,
				y,
				this.platformImage.name,
			)
			platform.setDisplaySize(
				platformDimensions.width,
				platformDimensions.height,
			)
			platform.refreshBody()
		}
	}

	private createPlayer() {
		// Instantiate the custom Player class
		this.player = new Player(
			this,
			this.scale.width / 2 - 16,
			100,
			this.playerImage.name,
		)

		// Add collision between the new player object and platforms
		this.physics.add.collider(this.player, this.platforms)
	}

	private setupCamera() {
		this.cameras.main.setBounds(0, 0, 256, this.worldHeight)
		this.cameras.main.startFollow(this.player, true, 0, 1)
	}
}
