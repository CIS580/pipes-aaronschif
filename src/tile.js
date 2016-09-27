'use strict';

import {Actor} from './common/actor.js';
import {pipeSprites} from './sprites.js';

export class Tile extends Actor {
    constructor (world) {
        super(world);
        this.width = 32;
        this.height = 32;
        this.dragHandle = null;
    }

    *baseRenderState () {
        while (true) {
            let {dt, ctx} = yield;
            pipeSprites.lTee.draw(ctx, this.x, this.y);
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

    onStartDrag () {
        this.dragging = true;
        let x = this.x - this.world.mouseLocation.x;
        let y = this.y - this.world.mouseLocation.y;

        this.dragHandle = {x:x, y:y};
    }

    onStopDrag () {
        this.dragging = false;
        this.x -= (this.x % 32);
        this.y -= (this.y % 32);
    }
}
