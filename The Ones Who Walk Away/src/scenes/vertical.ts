import Phaser from "phaser";

class VerticalScrolling extends Phaser.Scene {

    constructor () {
        super("VerticalScrolling")
    }

    preload() {
        this.load.image('tauri', "/assets/tauri.svg")
    }

    create () {
        console.log("VerticalScrolling scee created")

        this.add.image(100,100,'tauri')
        // const player = this.physics.add.existing(new Player(this, 100, 200))
    }

}

export default VerticalScrolling
