'use strict';

import {BendTile, FourTile, TeeTile, LongTile} from './tile';

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
        this.canvas.onmousemove = this.onMouseMove.bind(this);
        this.canvas.oncontextmenu = (e)=>e.preventDefault();
        this.collisions = new CollisionManager();
        this.collisions.actors = [new BendTile(this)];

        this.mouseLocation = {x: 0, y: 0};
        this.beingDragged = [];
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

        for (let actor of this.collisions.actors) {
            actor.render(elapsedTime, ctx);
        }
    }

    update (elapsedTime) {
        this.collisions.update();
        for (let actor of this.collisions.actors) {
            actor.update(elapsedTime);
        }
    }

    onStartDrag (event) {
        console.log(event)
        if (event.buttons & 1) {
            this.isDragging = true;
            let actors = this.collisions.collisionsAt(this.mouseLocation.x, this.mouseLocation.y);
            this.beingDragged = actors;
            for (let actor of actors) {
                actor.onStartDrag();
            }
        }
        if (event.buttons & 2) {
            let actors = this.collisions.collisionsAt(this.mouseLocation.x, this.mouseLocation.y);
            for (let actor of actors) {
                actor.onRightClick();
            }
        }
    }

    onEndDrag (event) {
        this.isDragging = false;
        for (let actor of this.beingDragged) {
            actor.onStopDrag();
        }
    }

    onMouseMove (event) {
        this.mouseLocation = {x: event.offsetX, y: event.offsetY};
    }
}

class CollisionManager {
    constructor () {
        this.actors = [];
        this.tileSize = 32;
        this._tiles = [];
    }

    collisionsAt (x, y) {
        let tile = this.getTile(x, y);
        return tile;
    }

    getTile (x, y) {
        x = (x / this.tileSize)|0;
        y = (y / this.tileSize)|0;
        return this._tiles[`${x}_${y}`] = this._tiles[`${x}_${y}`] || [];
    }

    update () {
        this.actors.filter((a)=>!a.collect());
        this._tiles = {};
        for (let actor of this.actors) {
            let tile = this.getTile(actor.x, actor.y);
            tile.push(actor);
        }
    }
}
