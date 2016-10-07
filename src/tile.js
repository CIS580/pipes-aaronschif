'use strict';

import {Actor} from './common/actor.js';
import {pipeSprites} from './sprites.js';
import {boardPos} from './game.js';
import {soundEffect} from './app'

let tileNum = 0
export const LOSE = Symbol('lose')
export const WIN = Symbol('win')

export class Tile extends Actor {
    constructor (world) {
        super(world);
        this.tileNum = tileNum++
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
            soundEffect.play()
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
            soundEffect.play()
            this.dragging = false;
            this.x = roundTo(this.x - boardPos.x, 32) + boardPos.x;
            this.y = roundTo(this.y - boardPos.y, 32) + boardPos.y;

            if (this.world.collisions.collisionsAt(this.x, this.y).filter((e)=>{
                return e.tileNum!==this.tileNum}).length !== 0) {
                this.x = this.oldPos.x
                this.y = this.oldPos.y
            }
            this.oldPos = {x: this.x, y: this.y}
        }
    }

    drawWater (ctx, fillAmount, start) {
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(this.x, this.y+200)
    }

    drawWaterNext (ctx, fillAmount, start) {
        let nextTile
        fillAmount -= 1
        if (start === 'w') {
            nextTile = this.world.collisions.collisionsAt(this.x+32, this.y)[0]
            start = 'e'
        } else if (start === 'e') {
            nextTile = this.world.collisions.collisionsAt(this.x-32, this.y)[0]
            start = 'w'
        } else if (start === 'n') {
            nextTile = this.world.collisions.collisionsAt(this.x, this.y-32)[0]
            start = 's'
        } else if (start === 's') {
            nextTile = this.world.collisions.collisionsAt(this.x, this.y+32)[0]
            start = 'n'
        }
        if (nextTile && nextTile.tileNum === this.world.endTile.tileNum) {
            return WIN
        }
        if (!nextTile && fillAmount > 0 ) {
            return LOSE
        }

        if (nextTile) {
            return nextTile.drawWater(ctx, fillAmount, start)
        }
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

    drawWater (ctx, fillAmount, start) {
        if (this.dragging) return;

        let fullness = 0
        let startRange = 0
        let end = 'x',
            rot = this.rot,
            fillDir = 1,
            x = this.x,
            y = this.y
        if (rot === 0 && start === 'n') {
            end = 'w'
            x += 32
            startRange = Math.PI
            fillDir = -1
        } else if (rot === 0 && start === 'w') { //
            end = 'n'
            x += 32
            startRange = Math.PI/2
        } else if (rot === 1 && start === 'n') { //
            end = 'e'
        } else if (rot === 1 && start === 'e') { //
            end = 'n'
            startRange = Math.PI/2
            fillDir = -1
        } else if (rot === 2 && start === 'e') {
            end = 's'
            startRange = 3*Math.PI/2
            y += 32
        } else if (rot === 2 && start === 's') { //
            end = 'e'
            fillDir = -1
            startRange = 0
            y += 32
        } else if (rot === 3 && start === 'w') { //
            end = 's'
            x += 32
            y += 32
            startRange = 3*Math.PI/2
            fillDir = -1
        } else if (rot === 3 && start === 's') { //
            end = 'w'
            y += 32
            x += 32
            startRange = Math.PI
        }

        if (end !== 'x') {
            fullness = Math.max(Math.min(Math.PI/2, fillAmount*Math.PI/2), 0)
            if (fillAmount > 0) {
                ctx.arc(x, y, 20, startRange, startRange+fullness*fillDir, fillDir===-1)
                this.mobile = false
            }
        } else if (fillAmount > 0){
            return LOSE
        }

        return this.drawWaterNext(ctx, fillAmount, end)
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

    drawWater (ctx, fillAmount, start) {
        if (this.dragging) return;
        let fullness = Math.max(Math.min(32, fillAmount*32), 0)|0
        let end = 'x'
        if (this.rot === 0 && start === 'e') {
            end = 'w'
            ctx.moveTo(this.x, this.y+16)
            ctx.lineTo(this.x+fullness, this.y+16)
        } else if (this.rot === 0 && start === 'w'){
            end = 'e'
            ctx.moveTo(this.x+32-fullness, this.y+16)
            ctx.lineTo(this.x+32, this.y+16)
        } else if (this.rot === 1 && start === 'n'){
            end = 's'
            ctx.moveTo(this.x+16, this.y)
            ctx.lineTo(this.x+16, this.y+fullness)
        } else if (this.rot === 1 && start === 's'){
            end = 'n'
            ctx.moveTo(this.x+16, this.y+32)
            ctx.lineTo(this.x+16, this.y+32-fullness)
        }
        if (fillAmount > 0) {
            this.mobile = false
        }
        if (fillAmount > 0 && end === 'x') {
            return LOSE
        }
        return this.drawWaterNext(ctx, fillAmount, end)
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
