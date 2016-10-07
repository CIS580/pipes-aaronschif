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
        this.startTile.drawWater(ctx, this.fullness, 'e');
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
            // fillDir = -1
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
        console.log(start, end, fillAmount);

        if (end !== 'x') {
            fullness = Math.max(Math.min(Math.PI / 2, fillAmount * Math.PI / 2), 0);
            if (fillAmount > 0) {
                ctx.arc(x, y, 20, startRange, startRange + fullness * fillDir, fillDir === -1);
            }
        }

        this.drawWaterNext(ctx, fillAmount, end);
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
        this.drawWaterNext(ctx, fillAmount, end);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBRUEsSUFBSSxPQUFPLENBQVg7QUFBQSxJQUNJLE9BQU8sQ0FEWDs7QUFHQSxJQUFJLGFBQWEsVUFBUyxTQUFULEVBQW9CO0FBQ2pDLFFBQUksU0FBUyxJQUFULEtBQWtCLENBQXRCLEVBQXlCO0FBQ3JCLGFBQUssSUFBTCxDQUFVLFNBQVY7QUFDSDtBQUNELFdBQU8scUJBQVAsQ0FBNkIsVUFBN0I7QUFDSCxDQUxEO0FBTUEsV0FBVyxZQUFZLEdBQVosRUFBWDs7O0FDaEJBOzs7Ozs7O0FBRUE7O0FBR08sTUFBTSxLQUFOLENBQVk7QUFDZixnQkFBWSxLQUFaLEVBQW1CO0FBQ2YsYUFBSyxNQUFMLEdBQWMsMkJBQWQ7O0FBRUEsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssQ0FBTCxHQUFTLENBQVQ7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9CLEtBQUssZ0JBQUwsQ0FBc0IsSUFBdEIsQ0FBMkIsSUFBM0IsR0FBcEI7QUFDQSxhQUFLLFdBQUwsR0FBbUIsS0FBSyxlQUFMLENBQXFCLElBQXJCLENBQTBCLElBQTFCLEdBQW5CO0FBQ0g7O0FBRUQsa0JBQWM7QUFDVixlQUFPLEVBQVA7QUFDSDs7QUFFRCxjQUFV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QUFDQSxnQkFBSSxNQUFKLENBQVcsS0FBSyxDQUFMLEdBQU8sRUFBbEIsRUFBc0IsS0FBSyxDQUFMLEdBQU8sRUFBN0I7QUFDQSxnQkFBSSxNQUFKLENBQVcsS0FBSyxDQUFMLEdBQU8sRUFBbEIsRUFBc0IsS0FBSyxDQUFMLEdBQU8sRUFBUCxHQUFVLFFBQWhDO0FBQ0g7QUFDRCxhQUFLLGFBQUwsQ0FBbUIsR0FBbkIsRUFBd0IsVUFBeEIsRUFBb0MsR0FBcEM7QUFDSDtBQTVCK0I7O1FBQXZCLFMsR0FBQSxTO0FBK0JiLFNBQVMsT0FBVCxDQUFrQixHQUFsQixFQUF1QixHQUF2QixFQUE0QjtBQUN4QixRQUFJLFFBQVMsTUFBTSxHQUFuQjtBQUNBLFFBQUksU0FBUyxNQUFNLENBQW5CLEVBQXNCO0FBQ2xCLGVBQU8sTUFBTSxLQUFiO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZUFBTyxNQUFNLEdBQU4sR0FBWSxLQUFuQjtBQUNIO0FBQ0oiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0dhbWV9IGZyb20gJy4vZ2FtZSc7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyZWVuJyk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKGNhbnZhcyk7XG5cbmxldCByYXRlID0gNCxcbiAgICB0aWNrID0gMDtcblxudmFyIG1hc3Rlckxvb3AgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgICBpZiAodGljaysrICUgcmF0ZSAhPT0gMCkge1xuICAgICAgICBnYW1lLmxvb3AodGltZXN0YW1wKTtcbiAgICB9XG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShtYXN0ZXJMb29wKTtcbn1cbm1hc3Rlckxvb3AocGVyZm9ybWFuY2Uubm93KCkpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7RXZlbnRMaXN0ZW5lcn0gZnJvbSBcIi4vZXZlbnRzLmpzXCI7XG5cblxuZXhwb3J0IGNsYXNzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IG5ldyBFdmVudExpc3RlbmVyKCk7XG5cbiAgICAgICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgICAgICB0aGlzLnggPSAwO1xuICAgICAgICB0aGlzLnkgPSAwO1xuICAgICAgICB0aGlzLndpZHRoID0gNjQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gNjQ7XG5cbiAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSB0aGlzLmJhc2VDb250cm9sU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgIH1cblxuICAgIGdldEhpdEJveGVzKCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29sbGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5jb250cm9sU3RhdGUubmV4dCh7ZHQ6IGR0fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSBjdXIudmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihkdCwgY3R4KSB7XG4gICAgICAgIGxldCBjdXIgPSB0aGlzLnJlbmRlclN0YXRlLm5leHQoe2R0OiBkdCwgY3R4OiBjdHh9KTtcbiAgICAgICAgaWYgKGN1ci52YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge31cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHt9XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuXG5leHBvcnQgY2xhc3MgRXZlbnRMaXN0ZW5lciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBmdW5jKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSBldmVudHM7XG5cbiAgICAgICAgZXZlbnRzLnB1c2goZnVuYyk7XG4gICAgfVxuXG4gICAgZW1pdChuYW1lLCBhcmdzKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgZm9yIChsZXQgZXYgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgICBldihhcmdzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY2xhc3MgSW1hZ2VIYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICh7aW1nLCB4LCB5LCB3LCBofSkge1xuICAgICAgICB0aGlzLmltZyA9IGltZztcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgdGhpcy53aWR0aCA9IHc7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gaDtcbiAgICB9XG5cbiAgICBkcmF3IChjdHgsIHgsIHksIHN4PTEsIHN5PTEpIHtcbiAgICAgICAgY3R4LmRyYXdJbWFnZShcbiAgICAgICAgICAgIHRoaXMuaW1nLFxuICAgICAgICAgICAgdGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LFxuICAgICAgICAgICAgeCwgeSwgdGhpcy53aWR0aCpzeCwgdGhpcy5oZWlnaHQqc3lcbiAgICAgICAgKVxuICAgIH1cbn1cblxuY2xhc3MgQXVkaW9IYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lZGlhTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuXG4gICAgfVxuXG4gICAgZmV0Y2hTcHJpdGVTaGVldCAodXJsLCBzcHJpdGVzKSB7XG4gICAgICAgIGxldCBzcHJpdGVTaGVldCA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBzcHJpdGVTaGVldC5zcmMgPSB1cmw7XG5cbiAgICAgICAgbGV0IHNwcml0ZUhhbmRsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcHJpdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgc3ByaXRlID0gc3ByaXRlc1tpXTtcbiAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbaV0gPSBuZXcgSW1hZ2VIYW5kbGUoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbWc6IHNwcml0ZVNoZWV0LFxuICAgICAgICAgICAgICAgICAgICB4OiBzcHJpdGUueCxcbiAgICAgICAgICAgICAgICAgICAgeTogc3ByaXRlLnksXG4gICAgICAgICAgICAgICAgICAgIHc6IHNwcml0ZS53LFxuICAgICAgICAgICAgICAgICAgICBoOiBzcHJpdGUuaCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKHNwcml0ZS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgc3ByaXRlSGFuZGxlc1tzcHJpdGUubmFtZV0gPSBzcHJpdGVIYW5kbGVzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzcHJpdGVIYW5kbGVzO1xuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtCZW5kVGlsZSwgRm91clRpbGUsIFNob3J0VGlsZSwgVGVlVGlsZSwgTG9uZ1RpbGV9IGZyb20gJy4vdGlsZSc7XG5cbmV4cG9ydCBjb25zdCBib2FyZFBvcyA9IHtcbiAgICB4OiA5NixcbiAgICB5OiAzMixcbiAgICB3OiA4OTYsXG4gICAgaDogNTEyLFxufVxuXG5leHBvcnQgY2xhc3MgR2FtZSB7XG4gICAgY29uc3RydWN0b3Ioc2NyZWVuLCBtZWRpYU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tZWRpYU1hbmFnZXIgPSBtZWRpYU1hbmFnZXI7XG5cbiAgICAgICAgLy8gU2V0IHVwIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy5jYW52YXMgPSB0aGlzLmZyb250QnVmZmVyID0gc2NyZWVuO1xuICAgICAgICB0aGlzLmZyb250Q3R4ID0gc2NyZWVuLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIud2lkdGggPSBzY3JlZW4ud2lkdGg7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlci5oZWlnaHQgPSBzY3JlZW4uaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhY2tDdHggPSB0aGlzLmJhY2tCdWZmZXIuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgICAgICAvLyBTdGFydCB0aGUgZ2FtZSBsb29wXG4gICAgICAgIHRoaXMub2xkVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLm9ubW91c2Vkb3duID0gdGhpcy5vblN0YXJ0RHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNldXAgPSB0aGlzLm9uRW5kRHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlbW92ZSA9IHRoaXMub25Nb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25jb250ZXh0bWVudSA9IChlKT0+ZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMgPSBuZXcgQ29sbGlzaW9uTWFuYWdlcigpO1xuXG4gICAgICAgIHRoaXMuc3RhcnRUaWxlID0gbmV3IFNob3J0VGlsZSh0aGlzKVxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS5tb2JpbGUgPSBmYWxzZVxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS54ID0gYm9hcmRQb3MueFxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS55ID0gYm9hcmRQb3MueSArICgoTWF0aC5yYW5kb20oKSooYm9hcmRQb3MuaC8zMikpfDApKjMyXG4gICAgICAgIHRoaXMuZW5kVGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5lbmRUaWxlLm1vYmlsZSA9IGZhbHNlXG4gICAgICAgIHRoaXMuZW5kVGlsZS54ID0gYm9hcmRQb3MueCArIGJvYXJkUG9zLnctMzJcbiAgICAgICAgdGhpcy5lbmRUaWxlLnkgPSBib2FyZFBvcy55ICsgKChNYXRoLnJhbmRvbSgpKihib2FyZFBvcy5oLzMyKSl8MCkqMzJcblxuICAgICAgICB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzID0gW3RoaXMuc3RhcnRUaWxlLCB0aGlzLmVuZFRpbGVdO1xuXG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiAwLCB5OiAwfTtcbiAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBbXTtcblxuICAgICAgICB0aGlzLnNjb3JlID0gMFxuICAgICAgICB0aGlzLmxldmVsID0gMVxuICAgICAgICB0aGlzLmZ1bGxuZXNzID0gMFxuICAgIH1cblxuICAgIHBhdXNlIChmbGFnKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gKGZsYWcgPT0gdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9vcCAobmV3VGltZSkge1xuICAgICAgICB2YXIgZ2FtZSA9IHRoaXM7XG4gICAgICAgIHZhciBlbGFwc2VkVGltZSA9IG5ld1RpbWUgLSB0aGlzLm9sZFRpbWU7XG4gICAgICAgIHRoaXMub2xkVGltZSA9IG5ld1RpbWU7XG5cbiAgICAgICAgaWYoIXRoaXMucGF1c2VkKSB0aGlzLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIHRoaXMucmVuZGVyKGVsYXBzZWRUaW1lLCB0aGlzLmZyb250Q3R4KTtcblxuICAgICAgICAvLyBGbGlwIHRoZSBiYWNrIGJ1ZmZlclxuICAgICAgICB0aGlzLmZyb250Q3R4LmRyYXdJbWFnZSh0aGlzLmJhY2tCdWZmZXIsIDAsIDApO1xuICAgIH1cblxuICAgIHJlbmRlciAoZWxhcHNlZFRpbWUsIGN0eCkge1xuICAgICAgICBsZXQgY2FudmFzID0gdGhpcy5jYW52YXM7XG5cbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiIzc3Nzc3N1wiO1xuICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBmb3IgKGxldCB4PWJvYXJkUG9zLng7IHg8PWJvYXJkUG9zLngrYm9hcmRQb3MudzsgeCs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oeCwgYm9hcmRQb3MueSk7XG4gICAgICAgICAgICBjdHgubGluZVRvKHgsIGJvYXJkUG9zLnkrYm9hcmRQb3MuaCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgeT1ib2FyZFBvcy55OyB5PD1ib2FyZFBvcy55K2JvYXJkUG9zLmg7IHkrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKGJvYXJkUG9zLngsIHkpO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyhib2FyZFBvcy54K2JvYXJkUG9zLncsIHkpO1xuICAgICAgICB9XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdncmV5JztcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDI7XG4gICAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgICBjdHguYmVnaW5QYXRoKClcbiAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJ2JsdWUnXG4gICAgICAgIGN0eC5saW5lV2lkdGggPSA1XG4gICAgICAgIHRoaXMuc3RhcnRUaWxlLmRyYXdXYXRlcihjdHgsIHRoaXMuZnVsbG5lc3MsICdlJylcbiAgICAgICAgY3R4LnN0cm9rZSgpXG5cbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5jb2xsaXNpb25zLmFjdG9ycykge1xuICAgICAgICAgICAgYWN0b3IucmVuZGVyKGVsYXBzZWRUaW1lLCBjdHgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9ICd3aGl0ZSdcbiAgICAgICAgY3R4LmZvbnQgPSBcIjEycHggc2VyaWZcIlxuICAgICAgICBjdHguZmlsbFRleHQoYGxldmVsICR7dGhpcy5sZXZlbH1gLCAxMCwgNTAwKVxuICAgICAgICBjdHguZmlsbFRleHQoYCR7dGhpcy5zY29yZX0gcG9pbnRzYCwgMTAsIDUyMClcblxuICAgIH1cblxuICAgIHVwZGF0ZSAoZWxhcHNlZFRpbWUpIHtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLnVwZGF0ZSgpO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5pc0RyYWdnaW5nICYmIHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQoMzIsIDY0KS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxldCBwb3NUaWxlcyA9IFtTaG9ydFRpbGUsIEJlbmRUaWxlXVxuICAgICAgICAgICAgbGV0IHRpbGUgPSBwb3NUaWxlc1tNYXRoLnJhbmRvbSgpKnBvc1RpbGVzLmxlbmd0aHwwXVxuICAgICAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycy5wdXNoKG5ldyB0aWxlKHRoaXMpKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnVsbG5lc3MgKz0gLjAwNSAqIHRoaXMubGV2ZWxcbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50LmJ1dHRvbnMgJiAxKSB7XG4gICAgICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gYWN0b3JzO1xuICAgICAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgYWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgYWN0b3Iub25TdGFydERyYWcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDIpIHtcbiAgICAgICAgICAgIGxldCBhY3RvcnMgPSB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMubW91c2VMb2NhdGlvbi54LCB0aGlzLm1vdXNlTG9jYXRpb24ueSk7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblJpZ2h0Q2xpY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5kRHJhZyAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuYmVpbmdEcmFnZ2VkKSB7XG4gICAgICAgICAgICBhY3Rvci5vblN0b3BEcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbk1vdXNlTW92ZSAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5tb3VzZUxvY2F0aW9uID0ge3g6IGV2ZW50Lm9mZnNldFgsIHk6IGV2ZW50Lm9mZnNldFl9O1xuICAgIH1cbn1cblxuY2xhc3MgQ29sbGlzaW9uTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLnRpbGVTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX3RpbGVzID0gW107XG4gICAgfVxuXG4gICAgY29sbGlzaW9uc0F0ICh4LCB5KSB7XG4gICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKHgsIHkpO1xuICAgICAgICByZXR1cm4gdGlsZTtcbiAgICB9XG5cbiAgICBnZXRUaWxlICh4LCB5KSB7XG4gICAgICAgIHggPSAoeCAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHkgPSAoeSAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHJldHVybiB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gPSB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gfHwgW107XG4gICAgfVxuXG4gICAgdXBkYXRlICgpIHtcbiAgICAgICAgdGhpcy5hY3RvcnMuZmlsdGVyKChhKT0+IWEuY29sbGVjdCgpKTtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKGFjdG9yLngsIGFjdG9yLnkpO1xuICAgICAgICAgICAgdGlsZS5wdXNoKGFjdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtNZWRpYU1hbmFnZXJ9IGZyb20gJy4vY29tbW9uL21lZGlhTWFuYWdlci5qcydcblxubGV0IG1lZGlhID0gbmV3IE1lZGlhTWFuYWdlcigpO1xuXG5leHBvcnQgbGV0IHBpcGVTcHJpdGVzID0gbWVkaWEuZmV0Y2hTcHJpdGVTaGVldCgnLi9hc3NldHMvcGlwZXMucG5nJyxcbiAgICBbXG4gICAgICAgIHt4OjAsIHk6MCwgdzozMiwgaDozMiwgbmFtZTonZm91cldheSd9LFxuICAgICAgICB7eDozMSwgeTowLCB3Ojk2LCBoOjMyLCBuYW1lOidoTG9uZyd9LFxuICAgICAgICB7eDowLCB5OjMyLCB3OjMxLCBoOjk2LCBuYW1lOid2TG9uZyd9LFxuICAgICAgICB7eDo5NSwgeTozMiwgdzozMiwgaDozMiwgbmFtZTonaFNob3J0J30sXG4gICAgICAgIHt4Ojk1LCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOid2U2hvcnQnfSxcbiAgICAgICAge3g6MzEsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J3JkQmVuZCd9LFxuICAgICAgICB7eDo2MywgeTozMiwgdzozMSwgaDozMiwgbmFtZTonbGRCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidydUJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J2x1QmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonZFRlZSd9LFxuICAgICAgICB7eDozMSwgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3JUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOid1VGVlJ30sXG4gICAgICAgIHt4OjYzLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidsVGVlJ30sXG4gICAgXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QWN0b3J9IGZyb20gJy4vY29tbW9uL2FjdG9yLmpzJztcbmltcG9ydCB7cGlwZVNwcml0ZXN9IGZyb20gJy4vc3ByaXRlcy5qcyc7XG5pbXBvcnQge2JvYXJkUG9zfSBmcm9tICcuL2dhbWUuanMnO1xuXG5sZXQgdGlsZU51bSA9IDBcblxuZXhwb3J0IGNsYXNzIFRpbGUgZXh0ZW5kcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKTtcbiAgICAgICAgdGhpcy50aWxlTnVtID0gdGlsZU51bSsrXG4gICAgICAgIHRoaXMud2lkdGggPSAzMjtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAzMjtcbiAgICAgICAgdGhpcy54ID0gMzJcbiAgICAgICAgdGhpcy55ID0gNjRcbiAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmxUZWUsIHBpcGVTcHJpdGVzLnVUZWUsIHBpcGVTcHJpdGVzLnJUZWUsIHBpcGVTcHJpdGVzLmRUZWVdO1xuICAgICAgICB0aGlzLnJvdCA9IDA7XG4gICAgICAgIHRoaXMubW9iaWxlID0gdHJ1ZVxuICAgICAgICB0aGlzLm9sZFBvcyA9IHt4OiB0aGlzLngsIHk6IHRoaXMueX1cbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlc1t0aGlzLnJvdF0uZHJhdyhjdHgsIHRoaXMueCwgdGhpcy55KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgJj0gdGhpcy53b3JsZC5pc0RyYWdnaW5nO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBsZXQge3gsIHl9ID0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHggKyB0aGlzLmRyYWdIYW5kbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB5ICsgdGhpcy5kcmFnSGFuZGxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmlnaHRDbGljayAoKSB7XG4gICAgICAgIGlmICh0aGlzLm1vYmlsZSkge1xuICAgICAgICAgICAgdGhpcy5yb3QgPSAodGhpcy5yb3QgKyAxKSAlIHRoaXMuc3ByaXRlcy5sZW5ndGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoKSB7XG4gICAgICAgIGlmICh0aGlzLm1vYmlsZSkge1xuICAgICAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICBsZXQgeCA9IHRoaXMueCAtIHRoaXMud29ybGQubW91c2VMb2NhdGlvbi54O1xuICAgICAgICAgICAgbGV0IHkgPSB0aGlzLnkgLSB0aGlzLndvcmxkLm1vdXNlTG9jYXRpb24ueTtcblxuICAgICAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0ge3g6eCwgeTp5fTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU3RvcERyYWcgKCkge1xuICAgICAgICBpZiAodGhpcy5tb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMueCA9IHJvdW5kVG8odGhpcy54IC0gYm9hcmRQb3MueCwgMzIpICsgYm9hcmRQb3MueDtcbiAgICAgICAgICAgIHRoaXMueSA9IHJvdW5kVG8odGhpcy55IC0gYm9hcmRQb3MueSwgMzIpICsgYm9hcmRQb3MueTtcblxuICAgICAgICAgICAgaWYgKHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LCB0aGlzLnkpLmZpbHRlcigoZSk9PntcbiAgICAgICAgICAgICAgICByZXR1cm4gZS50aWxlTnVtIT09dGhpcy50aWxlTnVtfSkubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gdGhpcy5vbGRQb3MueFxuICAgICAgICAgICAgICAgIHRoaXMueSA9IHRoaXMub2xkUG9zLnlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMub2xkUG9zID0ge3g6IHRoaXMueCwgeTogdGhpcy55fVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZHJhd1dhdGVyIChjdHgsIGZpbGxBbW91bnQsIHN0YXJ0KSB7XG4gICAgICAgIGN0eC5tb3ZlVG8odGhpcy54LCB0aGlzLnkpXG4gICAgICAgIGN0eC5saW5lVG8odGhpcy54LCB0aGlzLnkrMjAwKVxuICAgIH1cblxuICAgIGRyYXdXYXRlck5leHQgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgbGV0IG5leHRUaWxlXG4gICAgICAgIGlmIChzdGFydCA9PT0gJ3cnKSB7XG4gICAgICAgICAgICBuZXh0VGlsZSA9IHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54KzMyLCB0aGlzLnkpWzBdXG4gICAgICAgICAgICBzdGFydCA9ICdlJ1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXJ0ID09PSAnZScpIHtcbiAgICAgICAgICAgIG5leHRUaWxlID0gdGhpcy53b3JsZC5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLngtMzIsIHRoaXMueSlbMF1cbiAgICAgICAgICAgIHN0YXJ0ID0gJ3cnXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhcnQgPT09ICduJykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCwgdGhpcy55LTMyKVswXVxuICAgICAgICAgICAgc3RhcnQgPSAncydcbiAgICAgICAgfSBlbHNlIGlmIChzdGFydCA9PT0gJ3MnKSB7XG4gICAgICAgICAgICBuZXh0VGlsZSA9IHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LCB0aGlzLnkrMzIpWzBdXG4gICAgICAgICAgICBzdGFydCA9ICduJ1xuICAgICAgICB9XG4gICAgICAgIGlmIChuZXh0VGlsZSkge1xuICAgICAgICAgICAgbmV4dFRpbGUuZHJhd1dhdGVyKGN0eCwgZmlsbEFtb3VudC0xLCBzdGFydClcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlZVRpbGUgZXh0ZW5kcyBUaWxlIHt9XG5cbmV4cG9ydCBjbGFzcyBMb25nVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZywgcGlwZVNwcml0ZXMuaExvbmcsIHBpcGVTcHJpdGVzLnZMb25nXVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJlbmRUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMucnVCZW5kLCBwaXBlU3ByaXRlcy5sdUJlbmQsIHBpcGVTcHJpdGVzLmxkQmVuZCwgcGlwZVNwcml0ZXMucmRCZW5kXVxuICAgIH1cblxuICAgIGRyYXdXYXRlciAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBpZiAodGhpcy5kcmFnZ2luZykgcmV0dXJuO1xuXG4gICAgICAgIGxldCBmdWxsbmVzcyA9IDBcbiAgICAgICAgbGV0IHN0YXJ0UmFuZ2UgPSAwXG4gICAgICAgIGxldCBlbmQgPSAneCcsXG4gICAgICAgICAgICByb3QgPSB0aGlzLnJvdCxcbiAgICAgICAgICAgIGZpbGxEaXIgPSAxLFxuICAgICAgICAgICAgeCA9IHRoaXMueCxcbiAgICAgICAgICAgIHkgPSB0aGlzLnlcbiAgICAgICAgaWYgKHJvdCA9PT0gMCAmJiBzdGFydCA9PT0gJ24nKSB7XG4gICAgICAgICAgICBlbmQgPSAndydcbiAgICAgICAgICAgIHggKz0gMzJcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSBNYXRoLlBJXG4gICAgICAgICAgICBmaWxsRGlyID0gLTFcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDAgJiYgc3RhcnQgPT09ICd3JykgeyAvL1xuICAgICAgICAgICAgZW5kID0gJ24nXG4gICAgICAgICAgICB4ICs9IDMyXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gTWF0aC5QSS8yXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAxICYmIHN0YXJ0ID09PSAnbicpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMSAmJiBzdGFydCA9PT0gJ2UnKSB7IC8vXG4gICAgICAgICAgICBlbmQgPSAnbidcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSBNYXRoLlBJLzJcbiAgICAgICAgICAgIGZpbGxEaXIgPSAtMVxuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMiAmJiBzdGFydCA9PT0gJ2UnKSB7XG4gICAgICAgICAgICBlbmQgPSAncydcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSAzKk1hdGguUEkvMlxuICAgICAgICAgICAgLy8gZmlsbERpciA9IC0xXG4gICAgICAgICAgICB5ICs9IDMyXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAyICYmIHN0YXJ0ID09PSAncycpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICAgICAgZmlsbERpciA9IC0xXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gMFxuICAgICAgICAgICAgeSArPSAzMlxuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMyAmJiBzdGFydCA9PT0gJ3cnKSB7IC8vXG4gICAgICAgICAgICBlbmQgPSAncydcbiAgICAgICAgICAgIHggKz0gMzJcbiAgICAgICAgICAgIHkgKz0gMzJcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSAzKk1hdGguUEkvMlxuICAgICAgICAgICAgZmlsbERpciA9IC0xXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAzICYmIHN0YXJ0ID09PSAncycpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICd3J1xuICAgICAgICAgICAgeSArPSAzMlxuICAgICAgICAgICAgeCArPSAzMlxuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IE1hdGguUElcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZyhzdGFydCwgZW5kLCBmaWxsQW1vdW50KVxuXG4gICAgICAgIGlmIChlbmQgIT09ICd4Jykge1xuICAgICAgICAgICAgZnVsbG5lc3MgPSBNYXRoLm1heChNYXRoLm1pbihNYXRoLlBJLzIsIGZpbGxBbW91bnQqTWF0aC5QSS8yKSwgMClcbiAgICAgICAgICAgIGlmIChmaWxsQW1vdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIGN0eC5hcmMoeCwgeSwgMjAsIHN0YXJ0UmFuZ2UsIHN0YXJ0UmFuZ2UrZnVsbG5lc3MqZmlsbERpciwgZmlsbERpcj09PS0xKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kcmF3V2F0ZXJOZXh0KGN0eCwgZmlsbEFtb3VudCwgZW5kKVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvdXJUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheV1cbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFNob3J0VGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmhTaG9ydCwgcGlwZVNwcml0ZXMudlNob3J0XVxuICAgIH1cblxuICAgIGRyYXdXYXRlciAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBpZiAodGhpcy5kcmFnZ2luZykgcmV0dXJuO1xuICAgICAgICBsZXQgZnVsbG5lc3MgPSBNYXRoLm1heChNYXRoLm1pbigzMiwgZmlsbEFtb3VudCozMiksIDApfDBcbiAgICAgICAgbGV0IGVuZCA9ICd4J1xuICAgICAgICBpZiAodGhpcy5yb3QgPT09IDAgJiYgc3RhcnQgPT09ICdlJykge1xuICAgICAgICAgICAgZW5kID0gJ3cnXG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCwgdGhpcy55KzE2KVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrZnVsbG5lc3MsIHRoaXMueSsxNilcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJvdCA9PT0gMCAmJiBzdGFydCA9PT0gJ3cnKXtcbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLngrMzItZnVsbG5lc3MsIHRoaXMueSsxNilcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy54KzMyLCB0aGlzLnkrMTYpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5yb3QgPT09IDEgJiYgc3RhcnQgPT09ICduJyl7XG4gICAgICAgICAgICBlbmQgPSAncydcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8odGhpcy54KzE2LCB0aGlzLnkpXG4gICAgICAgICAgICBjdHgubGluZVRvKHRoaXMueCsxNiwgdGhpcy55K2Z1bGxuZXNzKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucm90ID09PSAxICYmIHN0YXJ0ID09PSAncycpe1xuICAgICAgICAgICAgZW5kID0gJ24nXG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCsxNiwgdGhpcy55KzMyKVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrMTYsIHRoaXMueSszMi1mdWxsbmVzcylcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRyYXdXYXRlck5leHQoY3R4LCBmaWxsQW1vdW50LCBlbmQpXG4gICAgfVxufVxuXG5mdW5jdGlvbiByb3VuZFRvICh2YWwsIGluYykge1xuICAgIGxldCBvZmZCeSA9ICh2YWwgJSBpbmMpO1xuICAgIGlmIChvZmZCeSA8PSBpbmMgLyAyKSB7XG4gICAgICAgIHJldHVybiB2YWwgLSBvZmZCeTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsICsgaW5jIC0gb2ZmQnk7XG4gICAgfVxufVxuIl19
