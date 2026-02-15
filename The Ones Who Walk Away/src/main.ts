import Phaser, { Physics } from "phaser";
import VerticalScrolling from "./scenes/vertical";

const gameConfig = {
	type: Phaser.AUTO,
	width: 176,
	height: 350,
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
};

new Phaser.Game(gameConfig);
