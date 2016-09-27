'use strict';

import {Tile} from './tile';

export class Game {
    constructor(screen, mediaManager) {
        this.mediaManager = mediaManager;

        // Set up buffers
        this.canvas = this.frontBuffer = screen;
        this.frontCtx = screen.getContext('2d');
        this.backBuffer = document.createElement('canvas');
        this.backBuffer.width = screen.width;
        this.backBuffer.height = screen.height;
        this.backCtx = this.backBuffer.getContext('2d');

        // Start the game loop
        this.oldTime = performance.now();
        this.paused = false;

        this.canvas.onmousedown = this.onStartDrag.bind(this);
        this.canvas.onmouseup = this.onEndDrag.bind(this);

        this.actors = [new Tile()];
    }

    pause (flag) {
        this.paused = (flag == true);
    }

    loop (newTime) {
        var game = this;
        var elapsedTime = newTime - this.oldTime;
        this.oldTime = newTime;

        if(!this.paused) this.update(elapsedTime);
        this.render(elapsedTime, this.frontCtx);

        // Flip the back buffer
        this.frontCtx.drawImage(this.backBuffer, 0, 0);
    }

    render (elapsedTime, ctx) {
        let canvas = this.canvas;

        ctx.fillStyle = "#777777";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        for (let x=0; x<=canvas.width; x+=32) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        for (let y=0; y<=canvas.width; y+=32) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.strokeStyle = 'grey';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let actor of this.actors) {
            actor.render(elapsedTime, ctx);
        }
    }

    update (elapsedTime) {
        for (let actor of this.actors) {
            actor.update(elapsedTime);
        }
    }

    onStartDrag (event) {
        console.log('foo)_')
    }

    onEndDrag (event) {

    }
}
