'use strict';

import {Actor} from './common/actor.js';
import {pipeSprites} from './sprites.js';
import {boardPos} from './game.js';

export class Tile extends Actor {
    constructor (world) {
        super(world);
        this.width = 32;
        this.height = 32;
        this.x = 32
        this.y = 64
        this.dragHandle = null;
        this.sprites = [pipeSprites.lTee, pipeSprites.uTee, pipeSprites.rTee, pipeSprites.dTee];
        this.rot = 0;
        this.mobile = true
        this.oldPos = {x: this.x, y: this.y}
    }

    *baseRenderState () {
        while (true) {
            let {dt, ctx} = yield;
            this.sprites[this.rot].draw(ctx, this.x, this.y);
        }
    }

    *baseControlState () {
        while (true) {
            this.dragging &= this.world.isDragging;
            if (this.dragging) {
                let {x, y} = this.world.mouseLocation;
                this.x = x + this.dragHandle.x;
                this.y = y + this.dragHandle.y;
            }
            yield;
        }
    }

    onRightClick () {
        if (this.mobile) {
            this.rot = (this.rot + 1) % this.sprites.length;
        }
    }

    onStartDrag () {
        if (this.mobile) {
            this.dragging = true;
            let x = this.x - this.world.mouseLocation.x;
            let y = this.y - this.world.mouseLocation.y;

            this.dragHandle = {x:x, y:y};
        }
    }

    onStopDrag () {
        if (this.mobile) {
            this.dragging = false;
            this.x = roundTo(this.x - boardPos.x, 32) + boardPos.x;
            this.y = roundTo(this.y - boardPos.y, 32) + boardPos.y;

            if (this.world.collisions.collisionsAt(this.x, this.y).length !== 0) {
                this.x = this.oldPos.x
                this.y = this.oldPos.y
            }
            this.oldPos = {x: this.x, y: this.y}
        }
    }

    drawWater (ctx, fillAmount) {
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(this.x, this.y+200)
    }
}

export class TeeTile extends Tile {}

export class LongTile extends Tile {
    constructor (world) {
        super(world)
        this.sprites = [pipeSprites.hLong, pipeSprites.vLong, pipeSprites.hLong, pipeSprites.vLong]
    }
}

export class BendTile extends Tile {
    constructor (world) {
        super(world)
        this.sprites = [pipeSprites.ruBend, pipeSprites.luBend, pipeSprites.ldBend, pipeSprites.rdBend]
    }
}

export class FourTile extends Tile {
    constructor (world) {
        super(world)
        this.sprites = [pipeSprites.fourWay, pipeSprites.fourWay, pipeSprites.fourWay, pipeSprites.fourWay]
    }
}


export class ShortTile extends Tile {
    constructor (world) {
        super(world)
        this.sprites = [pipeSprites.hShort, pipeSprites.vShort]
    }

    drawWater (ctx, fillAmount) {
        if (this.rot === 0) {
            ctx.moveTo(this.x, this.y+16)
            ctx.lineTo(this.x+32, this.y+16)
        } else {
            ctx.moveTo(this.x+16, this.y)
            ctx.lineTo(this.x+16, this.y+32)
        }
    }
}

function roundTo (val, inc) {
    let offBy = (val % inc);
    if (offBy <= inc / 2) {
        return val - offBy;
    } else {
        return val + inc - offBy;
    }
}
