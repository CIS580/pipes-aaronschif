'use strict';

import {Actor} from './common/actor.js';
import {pipeSprites} from './sprites.js';

export class Tile extends Actor {
    constructor (world) {
        super(world);
        this.width = 32;
        this.height = 32;
        this.dragHandle = null;
        this.sprites = [pipeSprites.lTee, pipeSprites.uTee, pipeSprites.rTee, pipeSprites.dTee];
        this.rot = 0;
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
        this.rot = (this.rot + 1) % 4;
    }

    onStartDrag () {
        this.dragging = true;
        let x = this.x - this.world.mouseLocation.x;
        let y = this.y - this.world.mouseLocation.y;

        this.dragHandle = {x:x, y:y};
    }

    onStopDrag () {
        this.dragging = false;
        this.x = roundTo(this.x, 32);
        this.y = roundTo(this.y, 32);
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

function roundTo (val, inc) {
    let offBy = (val % inc);
    if (offBy <= inc / 2) {
        return val - offBy;
    } else {
        return val + inc - offBy;
    }
}
