(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _game = require('./game');

var canvas = document.getElementById('screen');
var game = new _game.Game(canvas);

let rate = 4,
    tick = 0;

var masterLoop = function (timestamp) {
    if (tick++ % rate !== 0) {
        game.loop(timestamp);
    }
    window.requestAnimationFrame(masterLoop);
};
masterLoop(performance.now());

},{"./game":5}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Actor = undefined;

var _events = require("./events.js");

class Actor {
    constructor(world) {
        this.events = new _events.EventListener();

        this.world = world;
        this.x = 0;
        this.y = 0;
        this.width = 64;
        this.height = 64;

        this.controlState = this.baseControlState.bind(this)();
        this.renderState = this.baseRenderState.bind(this)();
    }

    getHitBoxes() {
        return [];
    }

    collect() {
        return false;
    }

    update(dt) {
        let cur = this.controlState.next({ dt: dt });
        if (cur.value != null) {
            this.controlState = cur.value;
        } else if (cur.done) {
            this.controlState = this.baseControlState.bind(this)();
        }
    }

    render(dt, ctx) {
        let cur = this.renderState.next({ dt: dt, ctx: ctx });
        if (cur.value != null) {
            this.renderState = cur.value;
        } else if (cur.done) {
            this.renderState = this.baseRenderState.bind(this)();
        }
    }

    *baseControlState() {}
    *baseRenderState() {}
}
exports.Actor = Actor;

},{"./events.js":3}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
class EventListener {
    constructor() {
        this.events = {};
    }

    addEventListener(name, func) {
        let events = this.events[name] || [];
        this.events[name] = events;

        events.push(func);
    }

    emit(name, args) {
        let events = this.events[name] || [];
        for (let ev of events) {
            ev(args);
        }
    }
}
exports.EventListener = EventListener;

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
class ImageHandle {
    constructor({ img, x, y, w, h }) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }

    draw(ctx, x, y, sx = 1, sy = 1) {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height, x, y, this.width * sx, this.height * sy);
    }
}

class AudioHandle {
    constructor() {}
}

class MediaManager {
    constructor() {}

    fetchSpriteSheet(url, sprites) {
        let spriteSheet = new Image();
        spriteSheet.src = url;

        let spriteHandles = {};
        for (let i = 0; i < sprites.length; i++) {
            let sprite = sprites[i];
            spriteHandles[i] = new ImageHandle({
                img: spriteSheet,
                x: sprite.x,
                y: sprite.y,
                w: sprite.w,
                h: sprite.h
            });
            if (sprite.name) {
                spriteHandles[sprite.name] = spriteHandles[i];
            }
        }
        return spriteHandles;
    }
}
exports.MediaManager = MediaManager;

},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Game = exports.boardPos = undefined;

var _tile = require('./tile');

const boardPos = exports.boardPos = {
    x: 96,
    y: 32,
    // w: 896,
    // h: 512,
    w: 320,
    h: 320
};

class Game {
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
        this.canvas.oncontextmenu = e => e.preventDefault();
        this.collisions = new CollisionManager();

        this.startTile = new _tile.ShortTile(this);
        this.startTile.mobile = false;
        this.startTile.x = boardPos.x;
        this.startTile.y = boardPos.y + (Math.random() * (boardPos.h / 32) | 0) * 32;
        this.endTile = new _tile.ShortTile(this);
        this.endTile.mobile = false;
        this.endTile.x = boardPos.x + boardPos.w - 32;
        this.endTile.y = boardPos.y + (Math.random() * (boardPos.h / 32) | 0) * 32;

        this.collisions.actors = [this.startTile, this.endTile];

        this.mouseLocation = { x: 0, y: 0 };
        this.beingDragged = [];

        this.score = 0;
        this.level = 1;
        this.fullness = 0;
    }

    pause(flag) {
        this.paused = flag == true;
    }

    loop(newTime) {
        var game = this;
        var elapsedTime = newTime - this.oldTime;
        this.oldTime = newTime;

        if (!this.paused) this.update(elapsedTime);
        this.render(elapsedTime, this.frontCtx);

        // Flip the back buffer
        this.frontCtx.drawImage(this.backBuffer, 0, 0);
    }

    render(elapsedTime, ctx) {
        let canvas = this.canvas;

        ctx.fillStyle = "#777777";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        for (let x = boardPos.x; x <= boardPos.x + boardPos.w; x += 32) {
            ctx.moveTo(x, boardPos.y);
            ctx.lineTo(x, boardPos.y + boardPos.h);
        }
        for (let y = boardPos.y; y <= boardPos.y + boardPos.h; y += 32) {
            ctx.moveTo(boardPos.x, y);
            ctx.lineTo(boardPos.x + boardPos.w, y);
        }
        ctx.strokeStyle = 'grey';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 5;
        let val = this.startTile.drawWater(ctx, this.fullness, 'e');
        ctx.stroke();

        console.log(val);

        for (let actor of this.collisions.actors) {
            actor.render(elapsedTime, ctx);
        }

        ctx.fillStyle = 'white';
        ctx.font = "12px serif";
        ctx.fillText(`level ${ this.level }`, 10, 500);
        ctx.fillText(`${ this.score } points`, 10, 520);
    }

    update(elapsedTime) {
        this.collisions.update();
        for (let actor of this.collisions.actors) {
            actor.update(elapsedTime);
        }
        if (!this.isDragging && this.collisions.collisionsAt(32, 64).length === 0) {
            let posTiles = [_tile.ShortTile, _tile.BendTile];
            let tile = posTiles[Math.random() * posTiles.length | 0];
            this.collisions.actors.push(new tile(this));
        }
        this.fullness += .005 * this.level;
    }

    onStartDrag(event) {
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

    onEndDrag(event) {
        this.isDragging = false;
        for (let actor of this.beingDragged) {
            actor.onStopDrag();
        }
    }

    onMouseMove(event) {
        this.mouseLocation = { x: event.offsetX, y: event.offsetY };
    }
}

exports.Game = Game;
class CollisionManager {
    constructor() {
        this.actors = [];
        this.tileSize = 32;
        this._tiles = [];
    }

    collisionsAt(x, y) {
        let tile = this.getTile(x, y);
        return tile;
    }

    getTile(x, y) {
        x = x / this.tileSize | 0;
        y = y / this.tileSize | 0;
        return this._tiles[`${ x }_${ y }`] = this._tiles[`${ x }_${ y }`] || [];
    }

    update() {
        this.actors.filter(a => !a.collect());
        this._tiles = {};
        for (let actor of this.actors) {
            let tile = this.getTile(actor.x, actor.y);
            tile.push(actor);
        }
    }
}

},{"./tile":7}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.pipeSprites = undefined;

var _mediaManager = require('./common/mediaManager.js');

let media = new _mediaManager.MediaManager();

let pipeSprites = exports.pipeSprites = media.fetchSpriteSheet('./assets/pipes.png', [{ x: 0, y: 0, w: 32, h: 32, name: 'fourWay' }, { x: 31, y: 0, w: 96, h: 32, name: 'hLong' }, { x: 0, y: 32, w: 31, h: 96, name: 'vLong' }, { x: 95, y: 32, w: 32, h: 32, name: 'hShort' }, { x: 95, y: 64, w: 32, h: 32, name: 'vShort' }, { x: 31, y: 32, w: 32, h: 32, name: 'rdBend' }, { x: 63, y: 32, w: 31, h: 32, name: 'ldBend' }, { x: 31, y: 64, w: 32, h: 32, name: 'ruBend' }, { x: 63, y: 64, w: 32, h: 32, name: 'luBend' }, { x: 31, y: 96, w: 32, h: 32, name: 'dTee' }, { x: 31, y: 128, w: 32, h: 32, name: 'rTee' }, { x: 63, y: 128, w: 32, h: 32, name: 'uTee' }, { x: 63, y: 96, w: 32, h: 32, name: 'lTee' }]);

},{"./common/mediaManager.js":4}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ShortTile = exports.FourTile = exports.BendTile = exports.LongTile = exports.TeeTile = exports.Tile = undefined;

var _actor = require('./common/actor.js');

var _sprites = require('./sprites.js');

var _game = require('./game.js');

let tileNum = 0;
const LOSE = Symbol('lose');
const WIN = Symbol('win');

class Tile extends _actor.Actor {
    constructor(world) {
        super(world);
        this.tileNum = tileNum++;
        this.width = 32;
        this.height = 32;
        this.x = 32;
        this.y = 64;
        this.dragHandle = null;
        this.sprites = [_sprites.pipeSprites.lTee, _sprites.pipeSprites.uTee, _sprites.pipeSprites.rTee, _sprites.pipeSprites.dTee];
        this.rot = 0;
        this.mobile = true;
        this.oldPos = { x: this.x, y: this.y };
    }

    *baseRenderState() {
        while (true) {
            let { dt, ctx } = yield;
            this.sprites[this.rot].draw(ctx, this.x, this.y);
        }
    }

    *baseControlState() {
        while (true) {
            this.dragging &= this.world.isDragging;
            if (this.dragging) {
                let { x, y } = this.world.mouseLocation;
                this.x = x + this.dragHandle.x;
                this.y = y + this.dragHandle.y;
            }
            yield;
        }
    }

    onRightClick() {
        if (this.mobile) {
            this.rot = (this.rot + 1) % this.sprites.length;
        }
    }

    onStartDrag() {
        if (this.mobile) {
            this.dragging = true;
            let x = this.x - this.world.mouseLocation.x;
            let y = this.y - this.world.mouseLocation.y;

            this.dragHandle = { x: x, y: y };
        }
    }

    onStopDrag() {
        if (this.mobile) {
            this.dragging = false;
            this.x = roundTo(this.x - _game.boardPos.x, 32) + _game.boardPos.x;
            this.y = roundTo(this.y - _game.boardPos.y, 32) + _game.boardPos.y;

            if (this.world.collisions.collisionsAt(this.x, this.y).filter(e => {
                return e.tileNum !== this.tileNum;
            }).length !== 0) {
                this.x = this.oldPos.x;
                this.y = this.oldPos.y;
            }
            this.oldPos = { x: this.x, y: this.y };
        }
    }

    drawWater(ctx, fillAmount, start) {
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + 200);
    }

    drawWaterNext(ctx, fillAmount, start) {
        let nextTile;
        fillAmount -= 1;
        if (start === 'w') {
            nextTile = this.world.collisions.collisionsAt(this.x + 32, this.y)[0];
            start = 'e';
        } else if (start === 'e') {
            nextTile = this.world.collisions.collisionsAt(this.x - 32, this.y)[0];
            start = 'w';
        } else if (start === 'n') {
            nextTile = this.world.collisions.collisionsAt(this.x, this.y - 32)[0];
            start = 's';
        } else if (start === 's') {
            nextTile = this.world.collisions.collisionsAt(this.x, this.y + 32)[0];
            start = 'n';
        }
        if (nextTile && nextTile.tileNum === this.world.endTile.tileNum) {
            return WIN;
        }
        if (!nextTile && fillAmount > 0) {
            return LOSE;
        }

        if (nextTile) {
            return nextTile.drawWater(ctx, fillAmount, start);
        }
    }
}

exports.Tile = Tile;
class TeeTile extends Tile {}

exports.TeeTile = TeeTile;
class LongTile extends Tile {
    constructor(world) {
        super(world);
        this.sprites = [_sprites.pipeSprites.hLong, _sprites.pipeSprites.vLong, _sprites.pipeSprites.hLong, _sprites.pipeSprites.vLong];
    }
}

exports.LongTile = LongTile;
class BendTile extends Tile {
    constructor(world) {
        super(world);
        this.sprites = [_sprites.pipeSprites.ruBend, _sprites.pipeSprites.luBend, _sprites.pipeSprites.ldBend, _sprites.pipeSprites.rdBend];
    }

    drawWater(ctx, fillAmount, start) {
        if (this.dragging) return;

        let fullness = 0;
        let startRange = 0;
        let end = 'x',
            rot = this.rot,
            fillDir = 1,
            x = this.x,
            y = this.y;
        if (rot === 0 && start === 'n') {
            end = 'w';
            x += 32;
            startRange = Math.PI;
            fillDir = -1;
        } else if (rot === 0 && start === 'w') {
            //
            end = 'n';
            x += 32;
            startRange = Math.PI / 2;
        } else if (rot === 1 && start === 'n') {
            //
            end = 'e';
        } else if (rot === 1 && start === 'e') {
            //
            end = 'n';
            startRange = Math.PI / 2;
            fillDir = -1;
        } else if (rot === 2 && start === 'e') {
            end = 's';
            startRange = 3 * Math.PI / 2;
            y += 32;
        } else if (rot === 2 && start === 's') {
            //
            end = 'e';
            fillDir = -1;
            startRange = 0;
            y += 32;
        } else if (rot === 3 && start === 'w') {
            //
            end = 's';
            x += 32;
            y += 32;
            startRange = 3 * Math.PI / 2;
            fillDir = -1;
        } else if (rot === 3 && start === 's') {
            //
            end = 'w';
            y += 32;
            x += 32;
            startRange = Math.PI;
        }

        if (end !== 'x') {
            fullness = Math.max(Math.min(Math.PI / 2, fillAmount * Math.PI / 2), 0);
            if (fillAmount > 0) {
                ctx.arc(x, y, 20, startRange, startRange + fullness * fillDir, fillDir === -1);
                this.mobile = false;
            }
        } else if (fillAmount > 0) {
            return LOSE;
        }

        return this.drawWaterNext(ctx, fillAmount, end);
    }
}

exports.BendTile = BendTile;
class FourTile extends Tile {
    constructor(world) {
        super(world);
        this.sprites = [_sprites.pipeSprites.fourWay, _sprites.pipeSprites.fourWay, _sprites.pipeSprites.fourWay, _sprites.pipeSprites.fourWay];
    }
}

exports.FourTile = FourTile;
class ShortTile extends Tile {
    constructor(world) {
        super(world);
        this.sprites = [_sprites.pipeSprites.hShort, _sprites.pipeSprites.vShort];
    }

    drawWater(ctx, fillAmount, start) {
        if (this.dragging) return;
        let fullness = Math.max(Math.min(32, fillAmount * 32), 0) | 0;
        let end = 'x';
        if (this.rot === 0 && start === 'e') {
            end = 'w';
            ctx.moveTo(this.x, this.y + 16);
            ctx.lineTo(this.x + fullness, this.y + 16);
        } else if (this.rot === 0 && start === 'w') {
            end = 'e';
            ctx.moveTo(this.x + 32 - fullness, this.y + 16);
            ctx.lineTo(this.x + 32, this.y + 16);
        } else if (this.rot === 1 && start === 'n') {
            end = 's';
            ctx.moveTo(this.x + 16, this.y);
            ctx.lineTo(this.x + 16, this.y + fullness);
        } else if (this.rot === 1 && start === 's') {
            end = 'n';
            ctx.moveTo(this.x + 16, this.y + 32);
            ctx.lineTo(this.x + 16, this.y + 32 - fullness);
        }
        if (fillAmount > 0) {
            this.mobile = false;
        }
        if (fillAmount > 0 && end === 'x') {
            return LOSE;
        }
        return this.drawWaterNext(ctx, fillAmount, end);
    }
}

exports.ShortTile = ShortTile;
function roundTo(val, inc) {
    let offBy = val % inc;
    if (offBy <= inc / 2) {
        return val - offBy;
    } else {
        return val + inc - offBy;
    }
}

},{"./common/actor.js":2,"./game.js":5,"./sprites.js":6}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBRUEsSUFBSSxPQUFPLENBQVg7QUFBQSxJQUNJLE9BQU8sQ0FEWDs7QUFHQSxJQUFJLGFBQWEsVUFBUyxTQUFULEVBQW9CO0FBQ2pDLFFBQUksU0FBUyxJQUFULEtBQWtCLENBQXRCLEVBQXlCO0FBQ3JCLGFBQUssSUFBTCxDQUFVLFNBQVY7QUFDSDtBQUNELFdBQU8scUJBQVAsQ0FBNkIsVUFBN0I7QUFDSCxDQUxEO0FBTUEsV0FBVyxZQUFZLEdBQVosRUFBWDs7O0FDaEJBOzs7Ozs7O0FBRUE7O0FBR08sTUFBTSxLQUFOLENBQVk7QUFDZixnQkFBWSxLQUFaLEVBQW1CO0FBQ2YsYUFBSyxNQUFMLEdBQWMsMkJBQWQ7O0FBRUEsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssQ0FBTCxHQUFTLENBQVQ7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9CLEtBQUssZ0JBQUwsQ0FBc0IsSUFBdEIsQ0FBMkIsSUFBM0IsR0FBcEI7QUFDQSxhQUFLLFdBQUwsR0FBbUIsS0FBSyxlQUFMLENBQXFCLElBQXJCLENBQTBCLElBQTFCLEdBQW5CO0FBQ0g7O0FBRUQsa0JBQWM7QUFDVixlQUFPLEVBQVA7QUFDSDs7QUFFRCxjQUFV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Y2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7R2FtZX0gZnJvbSAnLi9nYW1lJztcblxudmFyIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JlZW4nKTtcbnZhciBnYW1lID0gbmV3IEdhbWUoY2FudmFzKTtcblxubGV0IHJhdGUgPSA0LFxuICAgIHRpY2sgPSAwO1xuXG52YXIgbWFzdGVyTG9vcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICAgIGlmICh0aWNrKysgJSByYXRlICE9PSAwKSB7XG4gICAgICAgIGdhbWUubG9vcCh0aW1lc3RhbXApO1xuICAgIH1cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKG1hc3Rlckxvb3ApO1xufVxubWFzdGVyTG9vcChwZXJmb3JtYW5jZS5ub3coKSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHtFdmVudExpc3RlbmVyfSBmcm9tIFwiLi9ldmVudHMuanNcIjtcblxuXG5leHBvcnQgY2xhc3MgQWN0b3Ige1xuICAgIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzID0gbmV3IEV2ZW50TGlzdGVuZXIoKTtcblxuICAgICAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgICAgIHRoaXMueCA9IDA7XG4gICAgICAgIHRoaXMueSA9IDA7XG4gICAgICAgIHRoaXMud2lkdGggPSA2NDtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSA2NDtcblxuICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIHRoaXMucmVuZGVyU3RhdGUgPSB0aGlzLmJhc2VSZW5kZXJTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgfVxuXG4gICAgZ2V0SGl0Qm94ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb2xsZWN0KCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIGxldCBjdXIgPSB0aGlzLmNvbnRyb2xTdGF0ZS5uZXh0KHtkdDogZHR9KTtcbiAgICAgICAgaWYgKGN1ci52YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSB0aGlzLmJhc2VDb250cm9sU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGR0LCBjdHgpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMucmVuZGVyU3RhdGUubmV4dCh7ZHQ6IGR0LCBjdHg6IGN0eH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyU3RhdGUgPSBjdXIudmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyU3RhdGUgPSB0aGlzLmJhc2VSZW5kZXJTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAqYmFzZUNvbnRyb2xTdGF0ZSAoKSB7fVxuICAgICpiYXNlUmVuZGVyU3RhdGUgKCkge31cbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5cbmV4cG9ydCBjbGFzcyBFdmVudExpc3RlbmVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSB7fTtcbiAgICB9XG5cbiAgICBhZGRFdmVudExpc3RlbmVyKG5hbWUsIGZ1bmMpIHtcbiAgICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuZXZlbnRzW25hbWVdIHx8IFtdO1xuICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXSA9IGV2ZW50cztcblxuICAgICAgICBldmVudHMucHVzaChmdW5jKTtcbiAgICB9XG5cbiAgICBlbWl0KG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuZXZlbnRzW25hbWVdIHx8IFtdO1xuICAgICAgICBmb3IgKGxldCBldiBvZiBldmVudHMpIHtcbiAgICAgICAgICAgIGV2KGFyZ3MpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jbGFzcyBJbWFnZUhhbmRsZSB7XG4gICAgY29uc3RydWN0b3IgKHtpbWcsIHgsIHksIHcsIGh9KSB7XG4gICAgICAgIHRoaXMuaW1nID0gaW1nO1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICB0aGlzLndpZHRoID0gdztcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBoO1xuICAgIH1cblxuICAgIGRyYXcgKGN0eCwgeCwgeSwgc3g9MSwgc3k9MSkge1xuICAgICAgICBjdHguZHJhd0ltYWdlKFxuICAgICAgICAgICAgdGhpcy5pbWcsXG4gICAgICAgICAgICB0aGlzLngsIHRoaXMueSwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsXG4gICAgICAgICAgICB4LCB5LCB0aGlzLndpZHRoKnN4LCB0aGlzLmhlaWdodCpzeVxuICAgICAgICApXG4gICAgfVxufVxuXG5jbGFzcyBBdWRpb0hhbmRsZSB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuXG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWVkaWFNYW5hZ2VyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG5cbiAgICBmZXRjaFNwcml0ZVNoZWV0ICh1cmwsIHNwcml0ZXMpIHtcbiAgICAgICAgbGV0IHNwcml0ZVNoZWV0ID0gbmV3IEltYWdlKCk7XG4gICAgICAgIHNwcml0ZVNoZWV0LnNyYyA9IHVybDtcblxuICAgICAgICBsZXQgc3ByaXRlSGFuZGxlcyA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwcml0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBzcHJpdGUgPSBzcHJpdGVzW2ldO1xuICAgICAgICAgICAgc3ByaXRlSGFuZGxlc1tpXSA9IG5ldyBJbWFnZUhhbmRsZShcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGltZzogc3ByaXRlU2hlZXQsXG4gICAgICAgICAgICAgICAgICAgIHg6IHNwcml0ZS54LFxuICAgICAgICAgICAgICAgICAgICB5OiBzcHJpdGUueSxcbiAgICAgICAgICAgICAgICAgICAgdzogc3ByaXRlLncsXG4gICAgICAgICAgICAgICAgICAgIGg6IHNwcml0ZS5oLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBpZiAoc3ByaXRlLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBzcHJpdGVIYW5kbGVzW3Nwcml0ZS5uYW1lXSA9IHNwcml0ZUhhbmRsZXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNwcml0ZUhhbmRsZXM7XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0JlbmRUaWxlLCBGb3VyVGlsZSwgU2hvcnRUaWxlLCBUZWVUaWxlLCBMb25nVGlsZX0gZnJvbSAnLi90aWxlJztcblxuZXhwb3J0IGNvbnN0IGJvYXJkUG9zID0ge1xuICAgIHg6IDk2LFxuICAgIHk6IDMyLFxuICAgIC8vIHc6IDg5NixcbiAgICAvLyBoOiA1MTIsXG4gICAgdzogMzIwLFxuICAgIGg6IDMyMCxcbn1cblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICAgIGNvbnN0cnVjdG9yKHNjcmVlbiwgbWVkaWFNYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMubWVkaWFNYW5hZ2VyID0gbWVkaWFNYW5hZ2VyO1xuXG4gICAgICAgIC8vIFNldCB1cCBidWZmZXJzXG4gICAgICAgIHRoaXMuY2FudmFzID0gdGhpcy5mcm9udEJ1ZmZlciA9IHNjcmVlbjtcbiAgICAgICAgdGhpcy5mcm9udEN0eCA9IHNjcmVlbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLndpZHRoID0gc2NyZWVuLndpZHRoO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIuaGVpZ2h0ID0gc2NyZWVuLmhlaWdodDtcbiAgICAgICAgdGhpcy5iYWNrQ3R4ID0gdGhpcy5iYWNrQnVmZmVyLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgLy8gU3RhcnQgdGhlIGdhbWUgbG9vcFxuICAgICAgICB0aGlzLm9sZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlZG93biA9IHRoaXMub25TdGFydERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZXVwID0gdGhpcy5vbkVuZERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZW1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY2FudmFzLm9uY29udGV4dG1lbnUgPSAoZSk9PmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0gbmV3IENvbGxpc2lvbk1hbmFnZXIoKTtcblxuICAgICAgICB0aGlzLnN0YXJ0VGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5zdGFydFRpbGUubW9iaWxlID0gZmFsc2VcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueCA9IGJvYXJkUG9zLnhcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueSA9IGJvYXJkUG9zLnkgKyAoKE1hdGgucmFuZG9tKCkqKGJvYXJkUG9zLmgvMzIpKXwwKSozMlxuICAgICAgICB0aGlzLmVuZFRpbGUgPSBuZXcgU2hvcnRUaWxlKHRoaXMpXG4gICAgICAgIHRoaXMuZW5kVGlsZS5tb2JpbGUgPSBmYWxzZVxuICAgICAgICB0aGlzLmVuZFRpbGUueCA9IGJvYXJkUG9zLnggKyBib2FyZFBvcy53LTMyXG4gICAgICAgIHRoaXMuZW5kVGlsZS55ID0gYm9hcmRQb3MueSArICgoTWF0aC5yYW5kb20oKSooYm9hcmRQb3MuaC8zMikpfDApKjMyXG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycyA9IFt0aGlzLnN0YXJ0VGlsZSwgdGhpcy5lbmRUaWxlXTtcblxuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogMCwgeTogMH07XG4gICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gW107XG5cbiAgICAgICAgdGhpcy5zY29yZSA9IDBcbiAgICAgICAgdGhpcy5sZXZlbCA9IDFcbiAgICAgICAgdGhpcy5mdWxsbmVzcyA9IDBcbiAgICB9XG5cbiAgICBwYXVzZSAoZmxhZykge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IChmbGFnID09IHRydWUpO1xuICAgIH1cblxuICAgIGxvb3AgKG5ld1RpbWUpIHtcbiAgICAgICAgdmFyIGdhbWUgPSB0aGlzO1xuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXdUaW1lIC0gdGhpcy5vbGRUaW1lO1xuICAgICAgICB0aGlzLm9sZFRpbWUgPSBuZXdUaW1lO1xuXG4gICAgICAgIGlmKCF0aGlzLnBhdXNlZCkgdGhpcy51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB0aGlzLnJlbmRlcihlbGFwc2VkVGltZSwgdGhpcy5mcm9udEN0eCk7XG5cbiAgICAgICAgLy8gRmxpcCB0aGUgYmFjayBidWZmZXJcbiAgICAgICAgdGhpcy5mcm9udEN0eC5kcmF3SW1hZ2UodGhpcy5iYWNrQnVmZmVyLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZW5kZXIgKGVsYXBzZWRUaW1lLCBjdHgpIHtcbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzO1xuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBcIiM3Nzc3NzdcIjtcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgZm9yIChsZXQgeD1ib2FyZFBvcy54OyB4PD1ib2FyZFBvcy54K2JvYXJkUG9zLnc7IHgrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHgsIGJvYXJkUG9zLnkpO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh4LCBib2FyZFBvcy55K2JvYXJkUG9zLmgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IHk9Ym9hcmRQb3MueTsgeTw9Ym9hcmRQb3MueStib2FyZFBvcy5oOyB5Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyhib2FyZFBvcy54LCB5KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oYm9hcmRQb3MueCtib2FyZFBvcy53LCB5KTtcbiAgICAgICAgfVxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAnZ3JleSc7XG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAyO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdibHVlJ1xuICAgICAgICBjdHgubGluZVdpZHRoID0gNVxuICAgICAgICBsZXQgdmFsID0gdGhpcy5zdGFydFRpbGUuZHJhd1dhdGVyKGN0eCwgdGhpcy5mdWxsbmVzcywgJ2UnKVxuICAgICAgICBjdHguc3Ryb2tlKClcblxuICAgICAgICBjb25zb2xlLmxvZyh2YWwpXG5cbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5jb2xsaXNpb25zLmFjdG9ycykge1xuICAgICAgICAgICAgYWN0b3IucmVuZGVyKGVsYXBzZWRUaW1lLCBjdHgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICd3aGl0ZSdcbiAgICAgICAgY3R4LmZvbnQgPSBcIjEycHggc2VyaWZcIlxuICAgICAgICBjdHguZmlsbFRleHQoYGxldmVsICR7dGhpcy5sZXZlbH1gLCAxMCwgNTAwKVxuICAgICAgICBjdHguZmlsbFRleHQoYCR7dGhpcy5zY29yZX0gcG9pbnRzYCwgMTAsIDUyMClcblxuICAgIH1cblxuICAgIHVwZGF0ZSAoZWxhcHNlZFRpbWUpIHtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLnVwZGF0ZSgpO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5pc0RyYWdnaW5nICYmIHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQoMzIsIDY0KS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxldCBwb3NUaWxlcyA9IFtTaG9ydFRpbGUsIEJlbmRUaWxlXVxuICAgICAgICAgICAgbGV0IHRpbGUgPSBwb3NUaWxlc1tNYXRoLnJhbmRvbSgpKnBvc1RpbGVzLmxlbmd0aHwwXVxuICAgICAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycy5wdXNoKG5ldyB0aWxlKHRoaXMpKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnVsbG5lc3MgKz0gLjAwNSAqIHRoaXMubGV2ZWxcbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50LmJ1dHRvbnMgJiAxKSB7XG4gICAgICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gYWN0b3JzO1xuICAgICAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgYWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgYWN0b3Iub25TdGFydERyYWcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDIpIHtcbiAgICAgICAgICAgIGxldCBhY3RvcnMgPSB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMubW91c2VMb2NhdGlvbi54LCB0aGlzLm1vdXNlTG9jYXRpb24ueSk7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblJpZ2h0Q2xpY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5kRHJhZyAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuYmVpbmdEcmFnZ2VkKSB7XG4gICAgICAgICAgICBhY3Rvci5vblN0b3BEcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbk1vdXNlTW92ZSAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5tb3VzZUxvY2F0aW9uID0ge3g6IGV2ZW50Lm9mZnNldFgsIHk6IGV2ZW50Lm9mZnNldFl9O1xuICAgIH1cbn1cblxuY2xhc3MgQ29sbGlzaW9uTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLnRpbGVTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX3RpbGVzID0gW107XG4gICAgfVxuXG4gICAgY29sbGlzaW9uc0F0ICh4LCB5KSB7XG4gICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKHgsIHkpO1xuICAgICAgICByZXR1cm4gdGlsZTtcbiAgICB9XG5cbiAgICBnZXRUaWxlICh4LCB5KSB7XG4gICAgICAgIHggPSAoeCAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHkgPSAoeSAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHJldHVybiB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gPSB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gfHwgW107XG4gICAgfVxuXG4gICAgdXBkYXRlICgpIHtcbiAgICAgICAgdGhpcy5hY3RvcnMuZmlsdGVyKChhKT0+IWEuY29sbGVjdCgpKTtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKGFjdG9yLngsIGFjdG9yLnkpO1xuICAgICAgICAgICAgdGlsZS5wdXNoKGFjdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtNZWRpYU1hbmFnZXJ9IGZyb20gJy4vY29tbW9uL21lZGlhTWFuYWdlci5qcydcblxubGV0IG1lZGlhID0gbmV3IE1lZGlhTWFuYWdlcigpO1xuXG5leHBvcnQgbGV0IHBpcGVTcHJpdGVzID0gbWVkaWEuZmV0Y2hTcHJpdGVTaGVldCgnLi9hc3NldHMvcGlwZXMucG5nJyxcbiAgICBbXG4gICAgICAgIHt4OjAsIHk6MCwgdzozMiwgaDozMiwgbmFtZTonZm91cldheSd9LFxuICAgICAgICB7eDozMSwgeTowLCB3Ojk2LCBoOjMyLCBuYW1lOidoTG9uZyd9LFxuICAgICAgICB7eDowLCB5OjMyLCB3OjMxLCBoOjk2LCBuYW1lOid2TG9uZyd9LFxuICAgICAgICB7eDo5NSwgeTozMiwgdzozMiwgaDozMiwgbmFtZTonaFNob3J0J30sXG4gICAgICAgIHt4Ojk1LCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOid2U2hvcnQnfSxcbiAgICAgICAge3g6MzEsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J3JkQmVuZCd9LFxuICAgICAgICB7eDo2MywgeTozMiwgdzozMSwgaDozMiwgbmFtZTonbGRCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidydUJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J2x1QmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonZFRlZSd9LFxuICAgICAgICB7eDozMSwgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3JUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOid1VGVlJ30sXG4gICAgICAgIHt4OjYzLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidsVGVlJ30sXG4gICAgXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QWN0b3J9IGZyb20gJy4vY29tbW9uL2FjdG9yLmpzJztcbmltcG9ydCB7cGlwZVNwcml0ZXN9IGZyb20gJy4vc3ByaXRlcy5qcyc7XG5pbXBvcnQge2JvYXJkUG9zfSBmcm9tICcuL2dhbWUuanMnO1xuXG5sZXQgdGlsZU51bSA9IDBcbmNvbnN0IExPU0UgPSBTeW1ib2woJ2xvc2UnKVxuY29uc3QgV0lOID0gU3ltYm9sKCd3aW4nKVxuXG5leHBvcnQgY2xhc3MgVGlsZSBleHRlbmRzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpO1xuICAgICAgICB0aGlzLnRpbGVOdW0gPSB0aWxlTnVtKytcbiAgICAgICAgdGhpcy53aWR0aCA9IDMyO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDMyO1xuICAgICAgICB0aGlzLnggPSAzMlxuICAgICAgICB0aGlzLnkgPSA2NFxuICAgICAgICB0aGlzLmRyYWdIYW5kbGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMubFRlZSwgcGlwZVNwcml0ZXMudVRlZSwgcGlwZVNwcml0ZXMuclRlZSwgcGlwZVNwcml0ZXMuZFRlZV07XG4gICAgICAgIHRoaXMucm90ID0gMDtcbiAgICAgICAgdGhpcy5tb2JpbGUgPSB0cnVlXG4gICAgICAgIHRoaXMub2xkUG9zID0ge3g6IHRoaXMueCwgeTogdGhpcy55fVxuICAgIH1cblxuICAgICpiYXNlUmVuZGVyU3RhdGUgKCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgbGV0IHtkdCwgY3R4fSA9IHlpZWxkO1xuICAgICAgICAgICAgdGhpcy5zcHJpdGVzW3RoaXMucm90XS5kcmF3KGN0eCwgdGhpcy54LCB0aGlzLnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5kcmFnZ2luZyAmPSB0aGlzLndvcmxkLmlzRHJhZ2dpbmc7XG4gICAgICAgICAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgICAgICAgICAgIGxldCB7eCwgeX0gPSB0aGlzLndvcmxkLm1vdXNlTG9jYXRpb247XG4gICAgICAgICAgICAgICAgdGhpcy54ID0geCArIHRoaXMuZHJhZ0hhbmRsZS54O1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IHkgKyB0aGlzLmRyYWdIYW5kbGUueTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHlpZWxkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SaWdodENsaWNrICgpIHtcbiAgICAgICAgaWYgKHRoaXMubW9iaWxlKSB7XG4gICAgICAgICAgICB0aGlzLnJvdCA9ICh0aGlzLnJvdCArIDEpICUgdGhpcy5zcHJpdGVzLmxlbmd0aDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU3RhcnREcmFnICgpIHtcbiAgICAgICAgaWYgKHRoaXMubW9iaWxlKSB7XG4gICAgICAgICAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIGxldCB4ID0gdGhpcy54IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLng7XG4gICAgICAgICAgICBsZXQgeSA9IHRoaXMueSAtIHRoaXMud29ybGQubW91c2VMb2NhdGlvbi55O1xuXG4gICAgICAgICAgICB0aGlzLmRyYWdIYW5kbGUgPSB7eDp4LCB5Onl9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TdG9wRHJhZyAoKSB7XG4gICAgICAgIGlmICh0aGlzLm1vYmlsZSkge1xuICAgICAgICAgICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy54ID0gcm91bmRUbyh0aGlzLnggLSBib2FyZFBvcy54LCAzMikgKyBib2FyZFBvcy54O1xuICAgICAgICAgICAgdGhpcy55ID0gcm91bmRUbyh0aGlzLnkgLSBib2FyZFBvcy55LCAzMikgKyBib2FyZFBvcy55O1xuXG4gICAgICAgICAgICBpZiAodGhpcy53b3JsZC5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLngsIHRoaXMueSkuZmlsdGVyKChlKT0+e1xuICAgICAgICAgICAgICAgIHJldHVybiBlLnRpbGVOdW0hPT10aGlzLnRpbGVOdW19KS5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnggPSB0aGlzLm9sZFBvcy54XG4gICAgICAgICAgICAgICAgdGhpcy55ID0gdGhpcy5vbGRQb3MueVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5vbGRQb3MgPSB7eDogdGhpcy54LCB5OiB0aGlzLnl9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkcmF3V2F0ZXIgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLngsIHRoaXMueSlcbiAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngsIHRoaXMueSsyMDApXG4gICAgfVxuXG4gICAgZHJhd1dhdGVyTmV4dCAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBsZXQgbmV4dFRpbGVcbiAgICAgICAgZmlsbEFtb3VudCAtPSAxXG4gICAgICAgIGlmIChzdGFydCA9PT0gJ3cnKSB7XG4gICAgICAgICAgICBuZXh0VGlsZSA9IHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54KzMyLCB0aGlzLnkpWzBdXG4gICAgICAgICAgICBzdGFydCA9ICdlJ1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXJ0ID09PSAnZScpIHtcbiAgICAgICAgICAgIG5leHRUaWxlID0gdGhpcy53b3JsZC5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLngtMzIsIHRoaXMueSlbMF1cbiAgICAgICAgICAgIHN0YXJ0ID0gJ3cnXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhcnQgPT09ICduJykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCwgdGhpcy55LTMyKVswXVxuICAgICAgICAgICAgc3RhcnQgPSAncydcbiAgICAgICAgfSBlbHNlIGlmIChzdGFydCA9PT0gJ3MnKSB7XG4gICAgICAgICAgICBuZXh0VGlsZSA9IHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LCB0aGlzLnkrMzIpWzBdXG4gICAgICAgICAgICBzdGFydCA9ICduJ1xuICAgICAgICB9XG4gICAgICAgIGlmIChuZXh0VGlsZSAmJiBuZXh0VGlsZS50aWxlTnVtID09PSB0aGlzLndvcmxkLmVuZFRpbGUudGlsZU51bSkge1xuICAgICAgICAgICAgcmV0dXJuIFdJTlxuICAgICAgICB9XG4gICAgICAgIGlmICghbmV4dFRpbGUgJiYgZmlsbEFtb3VudCA+IDAgKSB7XG4gICAgICAgICAgICByZXR1cm4gTE9TRVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRUaWxlKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dFRpbGUuZHJhd1dhdGVyKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZWVUaWxlIGV4dGVuZHMgVGlsZSB7fVxuXG5leHBvcnQgY2xhc3MgTG9uZ1RpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oTG9uZywgcGlwZVNwcml0ZXMudkxvbmcsIHBpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZ11cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCZW5kVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLnJ1QmVuZCwgcGlwZVNwcml0ZXMubHVCZW5kLCBwaXBlU3ByaXRlcy5sZEJlbmQsIHBpcGVTcHJpdGVzLnJkQmVuZF1cbiAgICB9XG5cbiAgICBkcmF3V2F0ZXIgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHJldHVybjtcblxuICAgICAgICBsZXQgZnVsbG5lc3MgPSAwXG4gICAgICAgIGxldCBzdGFydFJhbmdlID0gMFxuICAgICAgICBsZXQgZW5kID0gJ3gnLFxuICAgICAgICAgICAgcm90ID0gdGhpcy5yb3QsXG4gICAgICAgICAgICBmaWxsRGlyID0gMSxcbiAgICAgICAgICAgIHggPSB0aGlzLngsXG4gICAgICAgICAgICB5ID0gdGhpcy55XG4gICAgICAgIGlmIChyb3QgPT09IDAgJiYgc3RhcnQgPT09ICduJykge1xuICAgICAgICAgICAgZW5kID0gJ3cnXG4gICAgICAgICAgICB4ICs9IDMyXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gTWF0aC5QSVxuICAgICAgICAgICAgZmlsbERpciA9IC0xXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAwICYmIHN0YXJ0ID09PSAndycpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICduJ1xuICAgICAgICAgICAgeCArPSAzMlxuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IE1hdGguUEkvMlxuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMSAmJiBzdGFydCA9PT0gJ24nKSB7IC8vXG4gICAgICAgICAgICBlbmQgPSAnZSdcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDEgJiYgc3RhcnQgPT09ICdlJykgeyAvL1xuICAgICAgICAgICAgZW5kID0gJ24nXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gTWF0aC5QSS8yXG4gICAgICAgICAgICBmaWxsRGlyID0gLTFcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDIgJiYgc3RhcnQgPT09ICdlJykge1xuICAgICAgICAgICAgZW5kID0gJ3MnXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gMypNYXRoLlBJLzJcbiAgICAgICAgICAgIHkgKz0gMzJcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDIgJiYgc3RhcnQgPT09ICdzJykgeyAvL1xuICAgICAgICAgICAgZW5kID0gJ2UnXG4gICAgICAgICAgICBmaWxsRGlyID0gLTFcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSAwXG4gICAgICAgICAgICB5ICs9IDMyXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAzICYmIHN0YXJ0ID09PSAndycpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICdzJ1xuICAgICAgICAgICAgeCArPSAzMlxuICAgICAgICAgICAgeSArPSAzMlxuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IDMqTWF0aC5QSS8yXG4gICAgICAgICAgICBmaWxsRGlyID0gLTFcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDMgJiYgc3RhcnQgPT09ICdzJykgeyAvL1xuICAgICAgICAgICAgZW5kID0gJ3cnXG4gICAgICAgICAgICB5ICs9IDMyXG4gICAgICAgICAgICB4ICs9IDMyXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gTWF0aC5QSVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuZCAhPT0gJ3gnKSB7XG4gICAgICAgICAgICBmdWxsbmVzcyA9IE1hdGgubWF4KE1hdGgubWluKE1hdGguUEkvMiwgZmlsbEFtb3VudCpNYXRoLlBJLzIpLCAwKVxuICAgICAgICAgICAgaWYgKGZpbGxBbW91bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgY3R4LmFyYyh4LCB5LCAyMCwgc3RhcnRSYW5nZSwgc3RhcnRSYW5nZStmdWxsbmVzcypmaWxsRGlyLCBmaWxsRGlyPT09LTEpXG4gICAgICAgICAgICAgICAgdGhpcy5tb2JpbGUgPSBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGZpbGxBbW91bnQgPiAwKXtcbiAgICAgICAgICAgIHJldHVybiBMT1NFXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5kcmF3V2F0ZXJOZXh0KGN0eCwgZmlsbEFtb3VudCwgZW5kKVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvdXJUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheV1cbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFNob3J0VGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmhTaG9ydCwgcGlwZVNwcml0ZXMudlNob3J0XVxuICAgIH1cblxuICAgIGRyYXdXYXRlciAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBpZiAodGhpcy5kcmFnZ2luZykgcmV0dXJuO1xuICAgICAgICBsZXQgZnVsbG5lc3MgPSBNYXRoLm1heChNYXRoLm1pbigzMiwgZmlsbEFtb3VudCozMiksIDApfDBcbiAgICAgICAgbGV0IGVuZCA9ICd4J1xuICAgICAgICBpZiAodGhpcy5yb3QgPT09IDAgJiYgc3RhcnQgPT09ICdlJykge1xuICAgICAgICAgICAgZW5kID0gJ3cnXG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCwgdGhpcy55KzE2KVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrZnVsbG5lc3MsIHRoaXMueSsxNilcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJvdCA9PT0gMCAmJiBzdGFydCA9PT0gJ3cnKXtcbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLngrMzItZnVsbG5lc3MsIHRoaXMueSsxNilcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy54KzMyLCB0aGlzLnkrMTYpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5yb3QgPT09IDEgJiYgc3RhcnQgPT09ICduJyl7XG4gICAgICAgICAgICBlbmQgPSAncydcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8odGhpcy54KzE2LCB0aGlzLnkpXG4gICAgICAgICAgICBjdHgubGluZVRvKHRoaXMueCsxNiwgdGhpcy55K2Z1bGxuZXNzKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucm90ID09PSAxICYmIHN0YXJ0ID09PSAncycpe1xuICAgICAgICAgICAgZW5kID0gJ24nXG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCsxNiwgdGhpcy55KzMyKVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrMTYsIHRoaXMueSszMi1mdWxsbmVzcylcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmlsbEFtb3VudCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMubW9iaWxlID0gZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmlsbEFtb3VudCA+IDAgJiYgZW5kID09PSAneCcpIHtcbiAgICAgICAgICAgIHJldHVybiBMT1NFXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhd1dhdGVyTmV4dChjdHgsIGZpbGxBbW91bnQsIGVuZClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJvdW5kVG8gKHZhbCwgaW5jKSB7XG4gICAgbGV0IG9mZkJ5ID0gKHZhbCAlIGluYyk7XG4gICAgaWYgKG9mZkJ5IDw9IGluYyAvIDIpIHtcbiAgICAgICAgcmV0dXJuIHZhbCAtIG9mZkJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWwgKyBpbmMgLSBvZmZCeTtcbiAgICB9XG59XG4iXX0=
