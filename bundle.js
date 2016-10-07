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
    w: 896,
    h: 512
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
        this.startTile.drawWater(ctx, this.fullness, 'w');
        ctx.stroke();

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
        console.log(event);
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

class Tile extends _actor.Actor {
    constructor(world) {
        super(world);
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
                e !== this;
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
        if (nextTile) {
            nextTile.drawWater(ctx, fillAmount - 1, start);
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

        let end = 'x',
            rot = this.rot;
        if (rot === 0 && start === 'n') {
            end = 'w';
        } else if (rot === 0 && start === 'w') {
            end = 'n';
        } else if (rot === 1 && start === 'n') {
            end = 'e';
        } else if (rot === 1 && start === 'e') {
            end = 'n';
        } else if (rot === 2 && start === 'e') {
            end = 's';
        } else if (rot === 2 && start === 's') {
            end = 'e';
        } else if (rot === 3 && start === 'w') {
            end = 's';
        } else if (rot === 3 && start === 's') {
            end = 'w';
        }

        let fullness = 0;
        let startRange = 3 * Math.PI / 2;
        if (end !== 'x') {
            fullness = Math.max(Math.min(Math.PI / 2, fillAmount * Math.PI / 2), 0);
            ctx.arc(this.x, this.y + 32, 20, startRange, startRange + fullness);
        }

        console.log(start, end, rot);

        // this.drawWaterNext(ctx, fillAmount, end)
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
        if (this.rot === 0) {
            ctx.moveTo(this.x, this.y + 16);
            ctx.lineTo(this.x + fullness, this.y + 16);
        } else {
            ctx.moveTo(this.x + 16, this.y);
            ctx.lineTo(this.x + 16, this.y + fullness);
        }
        this.drawWaterNext(ctx, fillAmount, 'w');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBRUEsSUFBSSxPQUFPLENBQVg7QUFBQSxJQUNJLE9BQU8sQ0FEWDs7QUFHQSxJQUFJLGFBQWEsVUFBUyxTQUFULEVBQW9CO0FBQ2pDLFFBQUksU0FBUyxJQUFULEtBQWtCLENBQXRCLEVBQXlCO0FBQ3JCLGFBQUssSUFBTCxDQUFVLFNBQVY7QUFDSDtBQUNELFdBQU8scUJBQVAsQ0FBNkIsVUFBN0I7QUFDSCxDQUxEO0FBTUEsV0FBVyxZQUFZLEdBQVosRUFBWDs7O0FDaEJBOzs7Ozs7O0FBRUE7O0FBR08sTUFBTSxLQUFOLENBQVk7QUFDZixnQkFBWSxLQUFaLEVBQW1CO0FBQ2YsYUFBSyxNQUFMLEdBQWMsMkJBQWQ7O0FBRUEsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssQ0FBTCxHQUFTLENBQVQ7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9CLEtBQUssZ0JBQUwsQ0FBc0IsSUFBdEIsQ0FBMkIsSUFBM0IsR0FBcEI7QUFDQSxhQUFLLFdBQUwsR0FBbUIsS0FBSyxlQUFMLENBQXFCLElBQXJCLENBQTBCLElBQTFCLEdBQW5CO0FBQ0g7O0FBRUQsa0JBQWM7QUFDVixlQUFPLEVBQVA7QUFDSDs7QUFFRCxjQUFV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LE1BQU0sR0FBbkI7QUFDQSxRQUFJLFNBQVMsTUFBTSxDQUFuQixFQUFzQjtBQUNsQixlQUFPLE1BQU0sS0FBYjtBQUNILEtBRkQsTUFFTztBQUNILGVBQU8sTUFBTSxHQUFOLEdBQVksS0FBbkI7QUFDSDtBQUNKIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtHYW1lfSBmcm9tICcuL2dhbWUnO1xuXG52YXIgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmVlbicpO1xudmFyIGdhbWUgPSBuZXcgR2FtZShjYW52YXMpO1xuXG5sZXQgcmF0ZSA9IDQsXG4gICAgdGljayA9IDA7XG5cbnZhciBtYXN0ZXJMb29wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgaWYgKHRpY2srKyAlIHJhdGUgIT09IDApIHtcbiAgICAgICAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gICAgfVxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQge0V2ZW50TGlzdGVuZXJ9IGZyb20gXCIuL2V2ZW50cy5qc1wiO1xuXG5cbmV4cG9ydCBjbGFzcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgRXZlbnRMaXN0ZW5lcigpO1xuXG4gICAgICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDY0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICB9XG5cbiAgICBnZXRIaXRCb3hlcygpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbGxlY3QoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMuY29udHJvbFN0YXRlLm5leHQoe2R0OiBkdH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoZHQsIGN0eCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5yZW5kZXJTdGF0ZS5uZXh0KHtkdDogZHQsIGN0eDogY3R4fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHt9XG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxuZXhwb3J0IGNsYXNzIEV2ZW50TGlzdGVuZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZnVuYykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRzO1xuXG4gICAgICAgIGV2ZW50cy5wdXNoKGZ1bmMpO1xuICAgIH1cblxuICAgIGVtaXQobmFtZSwgYXJncykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIGZvciAobGV0IGV2IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgZXYoYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIEltYWdlSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoe2ltZywgeCwgeSwgdywgaH0pIHtcbiAgICAgICAgdGhpcy5pbWcgPSBpbWc7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMud2lkdGggPSB3O1xuICAgICAgICB0aGlzLmhlaWdodCA9IGg7XG4gICAgfVxuXG4gICAgZHJhdyAoY3R4LCB4LCB5LCBzeD0xLCBzeT0xKSB7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoXG4gICAgICAgICAgICB0aGlzLmltZyxcbiAgICAgICAgICAgIHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHgsIHksIHRoaXMud2lkdGgqc3gsIHRoaXMuaGVpZ2h0KnN5XG4gICAgICAgIClcbiAgICB9XG59XG5cbmNsYXNzIEF1ZGlvSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZWRpYU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cblxuICAgIGZldGNoU3ByaXRlU2hlZXQgKHVybCwgc3ByaXRlcykge1xuICAgICAgICBsZXQgc3ByaXRlU2hlZXQgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgc3ByaXRlU2hlZXQuc3JjID0gdXJsO1xuXG4gICAgICAgIGxldCBzcHJpdGVIYW5kbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHNwcml0ZSA9IHNwcml0ZXNbaV07XG4gICAgICAgICAgICBzcHJpdGVIYW5kbGVzW2ldID0gbmV3IEltYWdlSGFuZGxlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW1nOiBzcHJpdGVTaGVldCxcbiAgICAgICAgICAgICAgICAgICAgeDogc3ByaXRlLngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHNwcml0ZS55LFxuICAgICAgICAgICAgICAgICAgICB3OiBzcHJpdGUudyxcbiAgICAgICAgICAgICAgICAgICAgaDogc3ByaXRlLmgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChzcHJpdGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbc3ByaXRlLm5hbWVdID0gc3ByaXRlSGFuZGxlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3ByaXRlSGFuZGxlcztcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QmVuZFRpbGUsIEZvdXJUaWxlLCBTaG9ydFRpbGUsIFRlZVRpbGUsIExvbmdUaWxlfSBmcm9tICcuL3RpbGUnO1xuXG5leHBvcnQgY29uc3QgYm9hcmRQb3MgPSB7XG4gICAgeDogOTYsXG4gICAgeTogMzIsXG4gICAgdzogODk2LFxuICAgIGg6IDUxMixcbn1cblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICAgIGNvbnN0cnVjdG9yKHNjcmVlbiwgbWVkaWFNYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMubWVkaWFNYW5hZ2VyID0gbWVkaWFNYW5hZ2VyO1xuXG4gICAgICAgIC8vIFNldCB1cCBidWZmZXJzXG4gICAgICAgIHRoaXMuY2FudmFzID0gdGhpcy5mcm9udEJ1ZmZlciA9IHNjcmVlbjtcbiAgICAgICAgdGhpcy5mcm9udEN0eCA9IHNjcmVlbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLndpZHRoID0gc2NyZWVuLndpZHRoO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIuaGVpZ2h0ID0gc2NyZWVuLmhlaWdodDtcbiAgICAgICAgdGhpcy5iYWNrQ3R4ID0gdGhpcy5iYWNrQnVmZmVyLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgLy8gU3RhcnQgdGhlIGdhbWUgbG9vcFxuICAgICAgICB0aGlzLm9sZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlZG93biA9IHRoaXMub25TdGFydERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZXVwID0gdGhpcy5vbkVuZERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZW1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY2FudmFzLm9uY29udGV4dG1lbnUgPSAoZSk9PmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0gbmV3IENvbGxpc2lvbk1hbmFnZXIoKTtcblxuICAgICAgICB0aGlzLnN0YXJ0VGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5zdGFydFRpbGUubW9iaWxlID0gZmFsc2VcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueCA9IGJvYXJkUG9zLnhcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueSA9IGJvYXJkUG9zLnkgKyAoKE1hdGgucmFuZG9tKCkqKGJvYXJkUG9zLmgvMzIpKXwwKSozMlxuICAgICAgICB0aGlzLmVuZFRpbGUgPSBuZXcgU2hvcnRUaWxlKHRoaXMpXG4gICAgICAgIHRoaXMuZW5kVGlsZS5tb2JpbGUgPSBmYWxzZVxuICAgICAgICB0aGlzLmVuZFRpbGUueCA9IGJvYXJkUG9zLnggKyBib2FyZFBvcy53LTMyXG4gICAgICAgIHRoaXMuZW5kVGlsZS55ID0gYm9hcmRQb3MueSArICgoTWF0aC5yYW5kb20oKSooYm9hcmRQb3MuaC8zMikpfDApKjMyXG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycyA9IFt0aGlzLnN0YXJ0VGlsZSwgdGhpcy5lbmRUaWxlXTtcblxuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogMCwgeTogMH07XG4gICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gW107XG5cbiAgICAgICAgdGhpcy5zY29yZSA9IDBcbiAgICAgICAgdGhpcy5sZXZlbCA9IDFcbiAgICAgICAgdGhpcy5mdWxsbmVzcyA9IDBcbiAgICB9XG5cbiAgICBwYXVzZSAoZmxhZykge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IChmbGFnID09IHRydWUpO1xuICAgIH1cblxuICAgIGxvb3AgKG5ld1RpbWUpIHtcbiAgICAgICAgdmFyIGdhbWUgPSB0aGlzO1xuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXdUaW1lIC0gdGhpcy5vbGRUaW1lO1xuICAgICAgICB0aGlzLm9sZFRpbWUgPSBuZXdUaW1lO1xuXG4gICAgICAgIGlmKCF0aGlzLnBhdXNlZCkgdGhpcy51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB0aGlzLnJlbmRlcihlbGFwc2VkVGltZSwgdGhpcy5mcm9udEN0eCk7XG5cbiAgICAgICAgLy8gRmxpcCB0aGUgYmFjayBidWZmZXJcbiAgICAgICAgdGhpcy5mcm9udEN0eC5kcmF3SW1hZ2UodGhpcy5iYWNrQnVmZmVyLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZW5kZXIgKGVsYXBzZWRUaW1lLCBjdHgpIHtcbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzO1xuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBcIiM3Nzc3NzdcIjtcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgZm9yIChsZXQgeD1ib2FyZFBvcy54OyB4PD1ib2FyZFBvcy54K2JvYXJkUG9zLnc7IHgrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHgsIGJvYXJkUG9zLnkpO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh4LCBib2FyZFBvcy55K2JvYXJkUG9zLmgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IHk9Ym9hcmRQb3MueTsgeTw9Ym9hcmRQb3MueStib2FyZFBvcy5oOyB5Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyhib2FyZFBvcy54LCB5KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oYm9hcmRQb3MueCtib2FyZFBvcy53LCB5KTtcbiAgICAgICAgfVxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAnZ3JleSc7XG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAyO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdibHVlJ1xuICAgICAgICBjdHgubGluZVdpZHRoID0gNVxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS5kcmF3V2F0ZXIoY3R4LCB0aGlzLmZ1bGxuZXNzLCAndycpXG4gICAgICAgIGN0eC5zdHJva2UoKVxuXG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSAnd2hpdGUnXG4gICAgICAgIGN0eC5mb250ID0gXCIxMnB4IHNlcmlmXCJcbiAgICAgICAgY3R4LmZpbGxUZXh0KGBsZXZlbCAke3RoaXMubGV2ZWx9YCwgMTAsIDUwMClcbiAgICAgICAgY3R4LmZpbGxUZXh0KGAke3RoaXMuc2NvcmV9IHBvaW50c2AsIDEwLCA1MjApXG5cbiAgICB9XG5cbiAgICB1cGRhdGUgKGVsYXBzZWRUaW1lKSB7XG4gICAgICAgIHRoaXMuY29sbGlzaW9ucy51cGRhdGUoKTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5jb2xsaXNpb25zLmFjdG9ycykge1xuICAgICAgICAgICAgYWN0b3IudXBkYXRlKGVsYXBzZWRUaW1lKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuaXNEcmFnZ2luZyAmJiB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KDMyLCA2NCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBsZXQgcG9zVGlsZXMgPSBbU2hvcnRUaWxlLCBCZW5kVGlsZV1cbiAgICAgICAgICAgIGxldCB0aWxlID0gcG9zVGlsZXNbTWF0aC5yYW5kb20oKSpwb3NUaWxlcy5sZW5ndGh8MF1cbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMucHVzaChuZXcgdGlsZSh0aGlzKSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZ1bGxuZXNzICs9IC4wMDUgKiB0aGlzLmxldmVsXG4gICAgfVxuXG4gICAgb25TdGFydERyYWcgKGV2ZW50KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGV2ZW50KVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDEpIHtcbiAgICAgICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICBsZXQgYWN0b3JzID0gdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLm1vdXNlTG9jYXRpb24ueCwgdGhpcy5tb3VzZUxvY2F0aW9uLnkpO1xuICAgICAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBhY3RvcnM7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblN0YXJ0RHJhZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudC5idXR0b25zICYgMikge1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIGZvciAobGV0IGFjdG9yIG9mIGFjdG9ycykge1xuICAgICAgICAgICAgICAgIGFjdG9yLm9uUmlnaHRDbGljaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmREcmFnIChldmVudCkge1xuICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5iZWluZ0RyYWdnZWQpIHtcbiAgICAgICAgICAgIGFjdG9yLm9uU3RvcERyYWcoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTW91c2VNb3ZlIChldmVudCkge1xuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogZXZlbnQub2Zmc2V0WCwgeTogZXZlbnQub2Zmc2V0WX07XG4gICAgfVxufVxuXG5jbGFzcyBDb2xsaXNpb25NYW5hZ2VyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuYWN0b3JzID0gW107XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSAzMjtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSBbXTtcbiAgICB9XG5cbiAgICBjb2xsaXNpb25zQXQgKHgsIHkpIHtcbiAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoeCwgeSk7XG4gICAgICAgIHJldHVybiB0aWxlO1xuICAgIH1cblxuICAgIGdldFRpbGUgKHgsIHkpIHtcbiAgICAgICAgeCA9ICh4IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgeSA9ICh5IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSA9IHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSB8fCBbXTtcbiAgICB9XG5cbiAgICB1cGRhdGUgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycy5maWx0ZXIoKGEpPT4hYS5jb2xsZWN0KCkpO1xuICAgICAgICB0aGlzLl90aWxlcyA9IHt9O1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmFjdG9ycykge1xuICAgICAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoYWN0b3IueCwgYWN0b3IueSk7XG4gICAgICAgICAgICB0aWxlLnB1c2goYWN0b3IpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge01lZGlhTWFuYWdlcn0gZnJvbSAnLi9jb21tb24vbWVkaWFNYW5hZ2VyLmpzJ1xuXG5sZXQgbWVkaWEgPSBuZXcgTWVkaWFNYW5hZ2VyKCk7XG5cbmV4cG9ydCBsZXQgcGlwZVNwcml0ZXMgPSBtZWRpYS5mZXRjaFNwcml0ZVNoZWV0KCcuL2Fzc2V0cy9waXBlcy5wbmcnLFxuICAgIFtcbiAgICAgICAge3g6MCwgeTowLCB3OjMyLCBoOjMyLCBuYW1lOidmb3VyV2F5J30sXG4gICAgICAgIHt4OjMxLCB5OjAsIHc6OTYsIGg6MzIsIG5hbWU6J2hMb25nJ30sXG4gICAgICAgIHt4OjAsIHk6MzIsIHc6MzEsIGg6OTYsIG5hbWU6J3ZMb25nJ30sXG4gICAgICAgIHt4Ojk1LCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidoU2hvcnQnfSxcbiAgICAgICAge3g6OTUsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3ZTaG9ydCd9LFxuICAgICAgICB7eDozMSwgeTozMiwgdzozMiwgaDozMiwgbmFtZToncmRCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjMyLCB3OjMxLCBoOjMyLCBuYW1lOidsZEJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3J1QmVuZCd9LFxuICAgICAgICB7eDo2MywgeTo2NCwgdzozMiwgaDozMiwgbmFtZTonbHVCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidkVGVlJ30sXG4gICAgICAgIHt4OjMxLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTonclRlZSd9LFxuICAgICAgICB7eDo2MywgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3VUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2xUZWUnfSxcbiAgICBdKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtBY3Rvcn0gZnJvbSAnLi9jb21tb24vYWN0b3IuanMnO1xuaW1wb3J0IHtwaXBlU3ByaXRlc30gZnJvbSAnLi9zcHJpdGVzLmpzJztcbmltcG9ydCB7Ym9hcmRQb3N9IGZyb20gJy4vZ2FtZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUaWxlIGV4dGVuZHMgQWN0b3Ige1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZCk7XG4gICAgICAgIHRoaXMud2lkdGggPSAzMjtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAzMjtcbiAgICAgICAgdGhpcy54ID0gMzJcbiAgICAgICAgdGhpcy55ID0gNjRcbiAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmxUZWUsIHBpcGVTcHJpdGVzLnVUZWUsIHBpcGVTcHJpdGVzLnJUZWUsIHBpcGVTcHJpdGVzLmRUZWVdO1xuICAgICAgICB0aGlzLnJvdCA9IDA7XG4gICAgICAgIHRoaXMubW9iaWxlID0gdHJ1ZVxuICAgICAgICB0aGlzLm9sZFBvcyA9IHt4OiB0aGlzLngsIHk6IHRoaXMueX1cbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlc1t0aGlzLnJvdF0uZHJhdyhjdHgsIHRoaXMueCwgdGhpcy55KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgJj0gdGhpcy53b3JsZC5pc0RyYWdnaW5nO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBsZXQge3gsIHl9ID0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHggKyB0aGlzLmRyYWdIYW5kbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB5ICsgdGhpcy5kcmFnSGFuZGxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmlnaHRDbGljayAoKSB7XG4gICAgICAgIGlmICh0aGlzLm1vYmlsZSkge1xuICAgICAgICAgICAgdGhpcy5yb3QgPSAodGhpcy5yb3QgKyAxKSAlIHRoaXMuc3ByaXRlcy5sZW5ndGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoKSB7XG4gICAgICAgIGlmICh0aGlzLm1vYmlsZSkge1xuICAgICAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICBsZXQgeCA9IHRoaXMueCAtIHRoaXMud29ybGQubW91c2VMb2NhdGlvbi54O1xuICAgICAgICAgICAgbGV0IHkgPSB0aGlzLnkgLSB0aGlzLndvcmxkLm1vdXNlTG9jYXRpb24ueTtcblxuICAgICAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0ge3g6eCwgeTp5fTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU3RvcERyYWcgKCkge1xuICAgICAgICBpZiAodGhpcy5tb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMueCA9IHJvdW5kVG8odGhpcy54IC0gYm9hcmRQb3MueCwgMzIpICsgYm9hcmRQb3MueDtcbiAgICAgICAgICAgIHRoaXMueSA9IHJvdW5kVG8odGhpcy55IC0gYm9hcmRQb3MueSwgMzIpICsgYm9hcmRQb3MueTtcblxuICAgICAgICAgICAgaWYgKHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LCB0aGlzLnkpLmZpbHRlcigoZSk9PntlIT09dGhpc30pLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHRoaXMub2xkUG9zLnhcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB0aGlzLm9sZFBvcy55XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm9sZFBvcyA9IHt4OiB0aGlzLngsIHk6IHRoaXMueX1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRyYXdXYXRlciAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBjdHgubW92ZVRvKHRoaXMueCwgdGhpcy55KVxuICAgICAgICBjdHgubGluZVRvKHRoaXMueCwgdGhpcy55KzIwMClcbiAgICB9XG5cbiAgICBkcmF3V2F0ZXJOZXh0IChjdHgsIGZpbGxBbW91bnQsIHN0YXJ0KSB7XG4gICAgICAgIGxldCBuZXh0VGlsZVxuICAgICAgICBpZiAoc3RhcnQgPT09ICd3Jykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCszMiwgdGhpcy55KVswXVxuICAgICAgICAgICAgc3RhcnQgPSAnZSdcbiAgICAgICAgfSBlbHNlIGlmIChzdGFydCA9PT0gJ2UnKSB7XG4gICAgICAgICAgICBuZXh0VGlsZSA9IHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LTMyLCB0aGlzLnkpWzBdXG4gICAgICAgICAgICBzdGFydCA9ICd3J1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXJ0ID09PSAnbicpIHtcbiAgICAgICAgICAgIG5leHRUaWxlID0gdGhpcy53b3JsZC5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLngsIHRoaXMueS0zMilbMF1cbiAgICAgICAgICAgIHN0YXJ0ID0gJ3MnXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhcnQgPT09ICdzJykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCwgdGhpcy55KzMyKVswXVxuICAgICAgICAgICAgc3RhcnQgPSAnbidcbiAgICAgICAgfVxuICAgICAgICBpZiAobmV4dFRpbGUpIHtcbiAgICAgICAgICAgIG5leHRUaWxlLmRyYXdXYXRlcihjdHgsIGZpbGxBbW91bnQtMSwgc3RhcnQpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZWVUaWxlIGV4dGVuZHMgVGlsZSB7fVxuXG5leHBvcnQgY2xhc3MgTG9uZ1RpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oTG9uZywgcGlwZVNwcml0ZXMudkxvbmcsIHBpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZ11cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCZW5kVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLnJ1QmVuZCwgcGlwZVNwcml0ZXMubHVCZW5kLCBwaXBlU3ByaXRlcy5sZEJlbmQsIHBpcGVTcHJpdGVzLnJkQmVuZF1cbiAgICB9XG5cbiAgICBkcmF3V2F0ZXIgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHJldHVybjtcblxuICAgICAgICBsZXQgZW5kID0gJ3gnLFxuICAgICAgICAgICAgcm90ID0gdGhpcy5yb3RcbiAgICAgICAgaWYgKHJvdCA9PT0gMCAmJiBzdGFydCA9PT0gJ24nKSB7XG4gICAgICAgICAgICBlbmQgPSAndydcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDAgJiYgc3RhcnQgPT09ICd3Jykge1xuICAgICAgICAgICAgZW5kID0gJ24nXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAxICYmIHN0YXJ0ID09PSAnbicpIHtcbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMSAmJiBzdGFydCA9PT0gJ2UnKSB7XG4gICAgICAgICAgICBlbmQgPSAnbidcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDIgJiYgc3RhcnQgPT09ICdlJykge1xuICAgICAgICAgICAgZW5kID0gJ3MnXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAyICYmIHN0YXJ0ID09PSAncycpIHtcbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMyAmJiBzdGFydCA9PT0gJ3cnKSB7XG4gICAgICAgICAgICBlbmQgPSAncydcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDMgJiYgc3RhcnQgPT09ICdzJykge1xuICAgICAgICAgICAgZW5kID0gJ3cnXG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZnVsbG5lc3MgPSAwXG4gICAgICAgIGxldCBzdGFydFJhbmdlID0gMypNYXRoLlBJLzJcbiAgICAgICAgaWYgKGVuZCAhPT0gJ3gnKSB7XG4gICAgICAgICAgICBmdWxsbmVzcyA9IE1hdGgubWF4KE1hdGgubWluKE1hdGguUEkvMiwgZmlsbEFtb3VudCpNYXRoLlBJLzIpLCAwKVxuICAgICAgICAgICAgY3R4LmFyYyh0aGlzLngsIHRoaXMueSszMiwgMjAsIHN0YXJ0UmFuZ2UsIHN0YXJ0UmFuZ2UrZnVsbG5lc3MpXG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgY29uc29sZS5sb2coc3RhcnQsIGVuZCwgcm90KVxuXG4gICAgICAgIC8vIHRoaXMuZHJhd1dhdGVyTmV4dChjdHgsIGZpbGxBbW91bnQsIGVuZClcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3VyVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXldXG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTaG9ydFRpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oU2hvcnQsIHBpcGVTcHJpdGVzLnZTaG9ydF1cbiAgICB9XG5cbiAgICBkcmF3V2F0ZXIgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHJldHVybjtcbiAgICAgICAgbGV0IGZ1bGxuZXNzID0gTWF0aC5tYXgoTWF0aC5taW4oMzIsIGZpbGxBbW91bnQqMzIpLCAwKXwwXG4gICAgICAgIGlmICh0aGlzLnJvdCA9PT0gMCkge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLngsIHRoaXMueSsxNilcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy54K2Z1bGxuZXNzLCB0aGlzLnkrMTYpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCsxNiwgdGhpcy55KVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrMTYsIHRoaXMueStmdWxsbmVzcylcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRyYXdXYXRlck5leHQoY3R4LCBmaWxsQW1vdW50LCAndycpXG4gICAgfVxufVxuXG5mdW5jdGlvbiByb3VuZFRvICh2YWwsIGluYykge1xuICAgIGxldCBvZmZCeSA9ICh2YWwgJSBpbmMpO1xuICAgIGlmIChvZmZCeSA8PSBpbmMgLyAyKSB7XG4gICAgICAgIHJldHVybiB2YWwgLSBvZmZCeTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsICsgaW5jIC0gb2ZmQnk7XG4gICAgfVxufVxuIl19
