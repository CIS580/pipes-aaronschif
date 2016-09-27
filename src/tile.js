'use strict';

import {Actor} from './common/actor.js';
import {pipeSprites} from './sprites.js';

export class Tile extends Actor {
    constructor (world) {
        super(world);
        console.log(this.controlState)
    }

    *baseRenderState () {
        while (true) {
            let {dt, ctx} = yield;
            pipeSprites.lTee.draw(ctx, 0, 0);
        }
    }

    *baseControlState () {
        while (true) {
            yield;
        }
    }
}
