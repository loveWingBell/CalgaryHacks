import Phaser from "phaser"
import VerticalScrolling from "./scenes/vertical"

const gameConfig = {
    type: Phaser.AUTO,
    width: 256,
    height: 224,
    backgroundColor: "black",
    parent: "container",
    scene: VerticalScrolling,
}

new Phaser.Game(gameConfig)
