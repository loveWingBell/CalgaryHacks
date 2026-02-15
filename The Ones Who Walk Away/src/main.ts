import Phaser from "phaser"
import VerticalScrolling from "./scenes/vertical"

const gameConfig = {
	type: Phaser.AUTO,
	width: 300,
	height: window.innerHeight,
	backgroundColor: "black",
	parent: "container",
	scene: VerticalScrolling,
	physics: {
		default: "arcade",
		arcade: {
			gravity: { y: 1000 },
			debug: false,
		},
	},
}

new Phaser.Game(gameConfig)
