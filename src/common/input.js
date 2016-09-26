"use strict";

export class Controller {
    constructor() {
        this.input = {
            up: false,
            down: false,
            right: false,
            left: false,
        };
        this.clear();
    }

    isAnyPressed() {
        return this.input.up |
            this.input.down |
            this.input.right |
            this.input.left;
    }

    clear() {
        this.savedInput = {
            up: false,
            down: false,
            right: false,
            left: false
        };
    }

    attach() {
        window.addEventListener('keydown', (event) => {
            let preventDefault = false
            switch (event.keyCode) {
                case 38: case 87: // Up
                    preventDefault = true
                    this.input.up = true
                    this.savedInput.up = true
                    break
                case 37: case 65: //Left
                    preventDefault = true
                    this.input.left = true
                    this.savedInput.left = true
                    break
                case 39: case 68: // Right
                    preventDefault = true
                    this.input.right = true
                    this.savedInput.right = true
                    break
                case 40: case 83: // Down
                    preventDefault = true
                    this.input.down = true
                    this.savedInput.down = true
                    break
            }
            if (preventDefault) {
                event.preventDefault()
            }
        });

        window.addEventListener('keyup', (event) => {
            switch (event.keyCode) {
                case 38: case 87: // Up
                    this.input.up = false
                    break
                case 37: case 65: //Left
                    this.input.left = false
                    break
                case 39: case 68: // Right
                    this.input.right = false
                    break
                case 40: case 83: // Down
                    this.input.down = false
                    break
            }
        });
    }
}
