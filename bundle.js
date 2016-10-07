(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.soundEffect = undefined;

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

let soundEffect = exports.soundEffect = new Audio(encodeURI('bong.ogg'));

let audio = new Audio(encodeURI('bgm_action_2.mp3'));
audio.loop = true;
audio.play();

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

var _app = require('./app');

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
        this.score = 0;
        this.level = 0;

        this.canvas.onmousedown = this.onStartDrag.bind(this);
        this.canvas.onmouseup = this.onEndDrag.bind(this);
        this.canvas.onmousemove = this.onMouseMove.bind(this);
        this.canvas.oncontextmenu = e => e.preventDefault();

        this.init();
    }

    init() {
        this.level += 1;
        this.collisions = new CollisionManager();
        this.fullness = 0;

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
        if (val === _tile.WIN) {
            _app.soundEffect.play();
            this.init();
        } else if (val === _tile.LOSE) {
            _app.soundEffect.play();
            ctx.fillStyle = `rgba(0, 0, 0, 0.8)`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = `rgba(255, 0, 0, 0.8)`;
            ctx.fillText("loser", 400, 200);
            return;
        }
        ctx.stroke();

        for (let actor of this.collisions.actors) {
            actor.render(elapsedTime, ctx);
        }

        ctx.fillStyle = 'white';
        ctx.font = "12px serif";
        ctx.fillText(`level ${ this.level }`, 10, 500);
        ctx.fillText(`${ this.fullness * this.level } points`, 10, 520);
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

},{"./app":1,"./tile":7}],6:[function(require,module,exports){
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
exports.ShortTile = exports.FourTile = exports.BendTile = exports.LongTile = exports.TeeTile = exports.Tile = exports.WIN = exports.LOSE = undefined;

var _actor = require('./common/actor.js');

var _sprites = require('./sprites.js');

var _game = require('./game.js');

var _app = require('./app');

let tileNum = 0;
const LOSE = exports.LOSE = Symbol('lose');
const WIN = exports.WIN = Symbol('win');

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
            _app.soundEffect.play();
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
            _app.soundEffect.play();
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

},{"./app":1,"./common/actor.js":2,"./game.js":5,"./sprites.js":6}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7Ozs7OztBQUVBOztBQUVBLElBQUksU0FBUyxTQUFTLGNBQVQsQ0FBd0IsUUFBeEIsQ0FBYjtBQUNBLElBQUksT0FBTyxlQUFTLE1BQVQsQ0FBWDs7QUFFQSxJQUFJLE9BQU8sQ0FBWDtBQUFBLElBQ0ksT0FBTyxDQURYOztBQUdBLElBQUksYUFBYSxVQUFTLFNBQVQsRUFBb0I7QUFDakMsUUFBSSxTQUFTLElBQVQsS0FBa0IsQ0FBdEIsRUFBeUI7QUFDckIsYUFBSyxJQUFMLENBQVUsU0FBVjtBQUNIO0FBQ0QsV0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNILENBTEQ7QUFNQSxXQUFXLFlBQVksR0FBWixFQUFYOztBQUdPLElBQUksb0NBQWMsSUFBSSxLQUFKLENBQVUsVUFBVSxVQUFWLENBQVYsQ0FBbEI7O0FBRVAsSUFBSSxRQUFRLElBQUksS0FBSixDQUFVLFVBQVUsa0JBQVYsQ0FBVixDQUFaO0FBQ0EsTUFBTSxJQUFOLEdBQWEsSUFBYjtBQUNBLE1BQU0sSUFBTjs7O0FDdkJBOzs7Ozs7O0FBRUE7O0FBR08sTUFBTSxLQUFOLENBQVk7QUFDZixnQkFBWSxLQUFaLEVBQW1CO0FBQ2YsYUFBSyxNQUFMLEdBQWMsMkJBQWQ7O0FBRUEsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssQ0FBTCxHQUFTLENBQVQ7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9C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QUFLLENBQUwsR0FBTyxFQUFsQixFQUFzQixLQUFLLENBQUwsR0FBTyxFQUE3QjtBQUNBLGdCQUFJLE1BQUosQ0FBVyxLQUFLLENBQUwsR0FBTyxFQUFsQixFQUFzQixLQUFLLENBQUwsR0FBTyxFQUFQLEdBQVUsUUFBaEM7QUFDSDtBQUNELFlBQUksYUFBYSxDQUFqQixFQUFvQjtBQUNoQixpQkFBSyxNQUFMLEdBQWMsS0FBZDtBQUNIO0FBQ0QsWUFBSSxhQUFhLENBQWIsSUFBa0IsUUFBUSxHQUE5QixFQUFtQztBQUMvQixtQkFBTyxJQUFQO0FBQ0g7QUFDRCxlQUFPLEtBQUssYUFBTCxDQUFtQixHQUFuQixFQUF3QixVQUF4QixFQUFvQyxHQUFwQyxDQUFQO0FBQ0g7QUFsQytCOztRQUF2QixTLEdBQUEsUztBQXFDYixTQUFTLE9BQVQsQ0FBa0IsR0FBbEIsRUFBdUIsR0FBdkIsRUFBNEI7QUFDeEIsUUFBSSxRQUFTLE1BQU0sR0FBbkI7QUFDQSxRQUFJLFNBQVMsTUFBTSxDQUFuQixFQUFzQjtBQUNsQixlQUFPLE1BQU0sS0FBYjtBQUNILEtBRkQsTUFFTztBQUNILGVBQU8sTUFBTSxHQUFOLEdBQVksS0FBbkI7QUFDSDtBQUNKIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtHYW1lfSBmcm9tICcuL2dhbWUnO1xuXG52YXIgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjcmVlbicpO1xudmFyIGdhbWUgPSBuZXcgR2FtZShjYW52YXMpO1xuXG5sZXQgcmF0ZSA9IDQsXG4gICAgdGljayA9IDA7XG5cbnZhciBtYXN0ZXJMb29wID0gZnVuY3Rpb24odGltZXN0YW1wKSB7XG4gICAgaWYgKHRpY2srKyAlIHJhdGUgIT09IDApIHtcbiAgICAgICAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gICAgfVxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcblxuXG5leHBvcnQgbGV0IHNvdW5kRWZmZWN0ID0gbmV3IEF1ZGlvKGVuY29kZVVSSSgnYm9uZy5vZ2cnKSlcblxubGV0IGF1ZGlvID0gbmV3IEF1ZGlvKGVuY29kZVVSSSgnYmdtX2FjdGlvbl8yLm1wMycpKVxuYXVkaW8ubG9vcCA9IHRydWVcbmF1ZGlvLnBsYXkoKVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7RXZlbnRMaXN0ZW5lcn0gZnJvbSBcIi4vZXZlbnRzLmpzXCI7XG5cblxuZXhwb3J0IGNsYXNzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IG5ldyBFdmVudExpc3RlbmVyKCk7XG5cbiAgICAgICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgICAgICB0aGlzLnggPSAwO1xuICAgICAgICB0aGlzLnkgPSAwO1xuICAgICAgICB0aGlzLndpZHRoID0gNjQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gNjQ7XG5cbiAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSB0aGlzLmJhc2VDb250cm9sU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgIH1cblxuICAgIGdldEhpdEJveGVzKCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29sbGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5jb250cm9sU3RhdGUubmV4dCh7ZHQ6IGR0fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSBjdXIudmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihkdCwgY3R4KSB7XG4gICAgICAgIGxldCBjdXIgPSB0aGlzLnJlbmRlclN0YXRlLm5leHQoe2R0OiBkdCwgY3R4OiBjdHh9KTtcbiAgICAgICAgaWYgKGN1ci52YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge31cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHt9XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuXG5leHBvcnQgY2xhc3MgRXZlbnRMaXN0ZW5lciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBmdW5jKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSBldmVudHM7XG5cbiAgICAgICAgZXZlbnRzLnB1c2goZnVuYyk7XG4gICAgfVxuXG4gICAgZW1pdChuYW1lLCBhcmdzKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgZm9yIChsZXQgZXYgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgICBldihhcmdzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY2xhc3MgSW1hZ2VIYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICh7aW1nLCB4LCB5LCB3LCBofSkge1xuICAgICAgICB0aGlzLmltZyA9IGltZztcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgdGhpcy53aWR0aCA9IHc7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gaDtcbiAgICB9XG5cbiAgICBkcmF3IChjdHgsIHgsIHksIHN4PTEsIHN5PTEpIHtcbiAgICAgICAgY3R4LmRyYXdJbWFnZShcbiAgICAgICAgICAgIHRoaXMuaW1nLFxuICAgICAgICAgICAgdGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LFxuICAgICAgICAgICAgeCwgeSwgdGhpcy53aWR0aCpzeCwgdGhpcy5oZWlnaHQqc3lcbiAgICAgICAgKVxuICAgIH1cbn1cblxuY2xhc3MgQXVkaW9IYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lZGlhTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuXG4gICAgfVxuXG4gICAgZmV0Y2hTcHJpdGVTaGVldCAodXJsLCBzcHJpdGVzKSB7XG4gICAgICAgIGxldCBzcHJpdGVTaGVldCA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBzcHJpdGVTaGVldC5zcmMgPSB1cmw7XG5cbiAgICAgICAgbGV0IHNwcml0ZUhhbmRsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcHJpdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgc3ByaXRlID0gc3ByaXRlc1tpXTtcbiAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbaV0gPSBuZXcgSW1hZ2VIYW5kbGUoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbWc6IHNwcml0ZVNoZWV0LFxuICAgICAgICAgICAgICAgICAgICB4OiBzcHJpdGUueCxcbiAgICAgICAgICAgICAgICAgICAgeTogc3ByaXRlLnksXG4gICAgICAgICAgICAgICAgICAgIHc6IHNwcml0ZS53LFxuICAgICAgICAgICAgICAgICAgICBoOiBzcHJpdGUuaCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKHNwcml0ZS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgc3ByaXRlSGFuZGxlc1tzcHJpdGUubmFtZV0gPSBzcHJpdGVIYW5kbGVzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzcHJpdGVIYW5kbGVzO1xuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtCZW5kVGlsZSwgRm91clRpbGUsIFNob3J0VGlsZSwgVGVlVGlsZSwgTG9uZ1RpbGUsIFdJTiwgTE9TRX0gZnJvbSAnLi90aWxlJztcbmltcG9ydCB7c291bmRFZmZlY3R9IGZyb20gJy4vYXBwJ1xuXG5leHBvcnQgY29uc3QgYm9hcmRQb3MgPSB7XG4gICAgeDogOTYsXG4gICAgeTogMzIsXG4gICAgLy8gdzogODk2LFxuICAgIC8vIGg6IDUxMixcbiAgICB3OiAzMjAsXG4gICAgaDogMzIwLFxufVxuXG5leHBvcnQgY2xhc3MgR2FtZSB7XG4gICAgY29uc3RydWN0b3Ioc2NyZWVuLCBtZWRpYU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tZWRpYU1hbmFnZXIgPSBtZWRpYU1hbmFnZXI7XG5cbiAgICAgICAgLy8gU2V0IHVwIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy5jYW52YXMgPSB0aGlzLmZyb250QnVmZmVyID0gc2NyZWVuO1xuICAgICAgICB0aGlzLmZyb250Q3R4ID0gc2NyZWVuLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIud2lkdGggPSBzY3JlZW4ud2lkdGg7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlci5oZWlnaHQgPSBzY3JlZW4uaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhY2tDdHggPSB0aGlzLmJhY2tCdWZmZXIuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgICAgICAvLyBTdGFydCB0aGUgZ2FtZSBsb29wXG4gICAgICAgIHRoaXMub2xkVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLnNjb3JlID0gMFxuICAgICAgICB0aGlzLmxldmVsID0gMFxuXG4gICAgICAgIHRoaXMuY2FudmFzLm9ubW91c2Vkb3duID0gdGhpcy5vblN0YXJ0RHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNldXAgPSB0aGlzLm9uRW5kRHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlbW92ZSA9IHRoaXMub25Nb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25jb250ZXh0bWVudSA9IChlKT0+ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIHRoaXMuaW5pdCgpXG4gICAgfVxuXG4gICAgaW5pdCAoKSB7XG4gICAgICAgIHRoaXMubGV2ZWwgKz0gMVxuICAgICAgICB0aGlzLmNvbGxpc2lvbnMgPSBuZXcgQ29sbGlzaW9uTWFuYWdlcigpO1xuICAgICAgICB0aGlzLmZ1bGxuZXNzID0gMFxuXG4gICAgICAgIHRoaXMuc3RhcnRUaWxlID0gbmV3IFNob3J0VGlsZSh0aGlzKVxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS5tb2JpbGUgPSBmYWxzZVxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS54ID0gYm9hcmRQb3MueFxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS55ID0gYm9hcmRQb3MueSArICgoTWF0aC5yYW5kb20oKSooYm9hcmRQb3MuaC8zMikpfDApKjMyXG4gICAgICAgIHRoaXMuZW5kVGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5lbmRUaWxlLm1vYmlsZSA9IGZhbHNlXG4gICAgICAgIHRoaXMuZW5kVGlsZS54ID0gYm9hcmRQb3MueCArIGJvYXJkUG9zLnctMzJcbiAgICAgICAgdGhpcy5lbmRUaWxlLnkgPSBib2FyZFBvcy55ICsgKChNYXRoLnJhbmRvbSgpKihib2FyZFBvcy5oLzMyKSl8MCkqMzJcblxuICAgICAgICB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzID0gW3RoaXMuc3RhcnRUaWxlLCB0aGlzLmVuZFRpbGVdO1xuXG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiAwLCB5OiAwfTtcbiAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBbXTtcbiAgICB9XG5cbiAgICBwYXVzZSAoZmxhZykge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IChmbGFnID09IHRydWUpO1xuICAgIH1cblxuICAgIGxvb3AgKG5ld1RpbWUpIHtcbiAgICAgICAgdmFyIGdhbWUgPSB0aGlzO1xuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXdUaW1lIC0gdGhpcy5vbGRUaW1lO1xuICAgICAgICB0aGlzLm9sZFRpbWUgPSBuZXdUaW1lO1xuXG4gICAgICAgIGlmKCF0aGlzLnBhdXNlZCkgdGhpcy51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB0aGlzLnJlbmRlcihlbGFwc2VkVGltZSwgdGhpcy5mcm9udEN0eCk7XG5cbiAgICAgICAgLy8gRmxpcCB0aGUgYmFjayBidWZmZXJcbiAgICAgICAgdGhpcy5mcm9udEN0eC5kcmF3SW1hZ2UodGhpcy5iYWNrQnVmZmVyLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZW5kZXIgKGVsYXBzZWRUaW1lLCBjdHgpIHtcbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzO1xuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBcIiM3Nzc3NzdcIjtcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgZm9yIChsZXQgeD1ib2FyZFBvcy54OyB4PD1ib2FyZFBvcy54K2JvYXJkUG9zLnc7IHgrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHgsIGJvYXJkUG9zLnkpO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh4LCBib2FyZFBvcy55K2JvYXJkUG9zLmgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IHk9Ym9hcmRQb3MueTsgeTw9Ym9hcmRQb3MueStib2FyZFBvcy5oOyB5Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyhib2FyZFBvcy54LCB5KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oYm9hcmRQb3MueCtib2FyZFBvcy53LCB5KTtcbiAgICAgICAgfVxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAnZ3JleSc7XG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAyO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdibHVlJ1xuICAgICAgICBjdHgubGluZVdpZHRoID0gNVxuICAgICAgICBsZXQgdmFsID0gdGhpcy5zdGFydFRpbGUuZHJhd1dhdGVyKGN0eCwgdGhpcy5mdWxsbmVzcywgJ2UnKVxuICAgICAgICBpZiAodmFsID09PSBXSU4pIHtcbiAgICAgICAgICAgIHNvdW5kRWZmZWN0LnBsYXkoKVxuICAgICAgICAgICAgdGhpcy5pbml0KClcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPT09IExPU0UpIHtcbiAgICAgICAgICAgIHNvdW5kRWZmZWN0LnBsYXkoKVxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGByZ2JhKDAsIDAsIDAsIDAuOClgXG4gICAgICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgdGhpcy5jYW52YXMud2lkdGgsIHRoaXMuY2FudmFzLmhlaWdodClcbiAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSBgcmdiYSgyNTUsIDAsIDAsIDAuOClgXG4gICAgICAgICAgICBjdHguZmlsbFRleHQoXCJsb3NlclwiLCA0MDAsIDIwMClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGN0eC5zdHJva2UoKVxuXG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSAnd2hpdGUnXG4gICAgICAgIGN0eC5mb250ID0gXCIxMnB4IHNlcmlmXCJcbiAgICAgICAgY3R4LmZpbGxUZXh0KGBsZXZlbCAke3RoaXMubGV2ZWx9YCwgMTAsIDUwMClcbiAgICAgICAgY3R4LmZpbGxUZXh0KGAke3RoaXMuZnVsbG5lc3MgKiB0aGlzLmxldmVsfSBwb2ludHNgLCAxMCwgNTIwKVxuXG4gICAgfVxuXG4gICAgdXBkYXRlIChlbGFwc2VkVGltZSkge1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMudXBkYXRlKCk7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmlzRHJhZ2dpbmcgJiYgdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCgzMiwgNjQpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGV0IHBvc1RpbGVzID0gW1Nob3J0VGlsZSwgQmVuZFRpbGVdXG4gICAgICAgICAgICBsZXQgdGlsZSA9IHBvc1RpbGVzW01hdGgucmFuZG9tKCkqcG9zVGlsZXMubGVuZ3RofDBdXG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzLnB1c2gobmV3IHRpbGUodGhpcykpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mdWxsbmVzcyArPSAuMDA1ICogdGhpcy5sZXZlbFxuICAgIH1cblxuICAgIG9uU3RhcnREcmFnIChldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDEpIHtcbiAgICAgICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICBsZXQgYWN0b3JzID0gdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLm1vdXNlTG9jYXRpb24ueCwgdGhpcy5tb3VzZUxvY2F0aW9uLnkpO1xuICAgICAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBhY3RvcnM7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblN0YXJ0RHJhZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudC5idXR0b25zICYgMikge1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIGZvciAobGV0IGFjdG9yIG9mIGFjdG9ycykge1xuICAgICAgICAgICAgICAgIGFjdG9yLm9uUmlnaHRDbGljaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmREcmFnIChldmVudCkge1xuICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5iZWluZ0RyYWdnZWQpIHtcbiAgICAgICAgICAgIGFjdG9yLm9uU3RvcERyYWcoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTW91c2VNb3ZlIChldmVudCkge1xuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogZXZlbnQub2Zmc2V0WCwgeTogZXZlbnQub2Zmc2V0WX07XG4gICAgfVxufVxuXG5jbGFzcyBDb2xsaXNpb25NYW5hZ2VyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuYWN0b3JzID0gW107XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSAzMjtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSBbXTtcbiAgICB9XG5cbiAgICBjb2xsaXNpb25zQXQgKHgsIHkpIHtcbiAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoeCwgeSk7XG4gICAgICAgIHJldHVybiB0aWxlO1xuICAgIH1cblxuICAgIGdldFRpbGUgKHgsIHkpIHtcbiAgICAgICAgeCA9ICh4IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgeSA9ICh5IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSA9IHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSB8fCBbXTtcbiAgICB9XG5cbiAgICB1cGRhdGUgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycy5maWx0ZXIoKGEpPT4hYS5jb2xsZWN0KCkpO1xuICAgICAgICB0aGlzLl90aWxlcyA9IHt9O1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmFjdG9ycykge1xuICAgICAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoYWN0b3IueCwgYWN0b3IueSk7XG4gICAgICAgICAgICB0aWxlLnB1c2goYWN0b3IpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge01lZGlhTWFuYWdlcn0gZnJvbSAnLi9jb21tb24vbWVkaWFNYW5hZ2VyLmpzJ1xuXG5sZXQgbWVkaWEgPSBuZXcgTWVkaWFNYW5hZ2VyKCk7XG5cbmV4cG9ydCBsZXQgcGlwZVNwcml0ZXMgPSBtZWRpYS5mZXRjaFNwcml0ZVNoZWV0KCcuL2Fzc2V0cy9waXBlcy5wbmcnLFxuICAgIFtcbiAgICAgICAge3g6MCwgeTowLCB3OjMyLCBoOjMyLCBuYW1lOidmb3VyV2F5J30sXG4gICAgICAgIHt4OjMxLCB5OjAsIHc6OTYsIGg6MzIsIG5hbWU6J2hMb25nJ30sXG4gICAgICAgIHt4OjAsIHk6MzIsIHc6MzEsIGg6OTYsIG5hbWU6J3ZMb25nJ30sXG4gICAgICAgIHt4Ojk1LCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidoU2hvcnQnfSxcbiAgICAgICAge3g6OTUsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3ZTaG9ydCd9LFxuICAgICAgICB7eDozMSwgeTozMiwgdzozMiwgaDozMiwgbmFtZToncmRCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjMyLCB3OjMxLCBoOjMyLCBuYW1lOidsZEJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3J1QmVuZCd9LFxuICAgICAgICB7eDo2MywgeTo2NCwgdzozMiwgaDozMiwgbmFtZTonbHVCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidkVGVlJ30sXG4gICAgICAgIHt4OjMxLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTonclRlZSd9LFxuICAgICAgICB7eDo2MywgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3VUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2xUZWUnfSxcbiAgICBdKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtBY3Rvcn0gZnJvbSAnLi9jb21tb24vYWN0b3IuanMnO1xuaW1wb3J0IHtwaXBlU3ByaXRlc30gZnJvbSAnLi9zcHJpdGVzLmpzJztcbmltcG9ydCB7Ym9hcmRQb3N9IGZyb20gJy4vZ2FtZS5qcyc7XG5pbXBvcnQge3NvdW5kRWZmZWN0fSBmcm9tICcuL2FwcCdcblxubGV0IHRpbGVOdW0gPSAwXG5leHBvcnQgY29uc3QgTE9TRSA9IFN5bWJvbCgnbG9zZScpXG5leHBvcnQgY29uc3QgV0lOID0gU3ltYm9sKCd3aW4nKVxuXG5leHBvcnQgY2xhc3MgVGlsZSBleHRlbmRzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpO1xuICAgICAgICB0aGlzLnRpbGVOdW0gPSB0aWxlTnVtKytcbiAgICAgICAgdGhpcy53aWR0aCA9IDMyO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDMyO1xuICAgICAgICB0aGlzLnggPSAzMlxuICAgICAgICB0aGlzLnkgPSA2NFxuICAgICAgICB0aGlzLmRyYWdIYW5kbGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMubFRlZSwgcGlwZVNwcml0ZXMudVRlZSwgcGlwZVNwcml0ZXMuclRlZSwgcGlwZVNwcml0ZXMuZFRlZV07XG4gICAgICAgIHRoaXMucm90ID0gMDtcbiAgICAgICAgdGhpcy5tb2JpbGUgPSB0cnVlXG4gICAgICAgIHRoaXMub2xkUG9zID0ge3g6IHRoaXMueCwgeTogdGhpcy55fVxuICAgIH1cblxuICAgICpiYXNlUmVuZGVyU3RhdGUgKCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgbGV0IHtkdCwgY3R4fSA9IHlpZWxkO1xuICAgICAgICAgICAgdGhpcy5zcHJpdGVzW3RoaXMucm90XS5kcmF3KGN0eCwgdGhpcy54LCB0aGlzLnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5kcmFnZ2luZyAmPSB0aGlzLndvcmxkLmlzRHJhZ2dpbmc7XG4gICAgICAgICAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgICAgICAgICAgIGxldCB7eCwgeX0gPSB0aGlzLndvcmxkLm1vdXNlTG9jYXRpb247XG4gICAgICAgICAgICAgICAgdGhpcy54ID0geCArIHRoaXMuZHJhZ0hhbmRsZS54O1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IHkgKyB0aGlzLmRyYWdIYW5kbGUueTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHlpZWxkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SaWdodENsaWNrICgpIHtcbiAgICAgICAgaWYgKHRoaXMubW9iaWxlKSB7XG4gICAgICAgICAgICBzb3VuZEVmZmVjdC5wbGF5KClcbiAgICAgICAgICAgIHRoaXMucm90ID0gKHRoaXMucm90ICsgMSkgJSB0aGlzLnNwcml0ZXMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TdGFydERyYWcgKCkge1xuICAgICAgICBpZiAodGhpcy5tb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IHggPSB0aGlzLnggLSB0aGlzLndvcmxkLm1vdXNlTG9jYXRpb24ueDtcbiAgICAgICAgICAgIGxldCB5ID0gdGhpcy55IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLnk7XG5cbiAgICAgICAgICAgIHRoaXMuZHJhZ0hhbmRsZSA9IHt4OngsIHk6eX07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0b3BEcmFnICgpIHtcbiAgICAgICAgaWYgKHRoaXMubW9iaWxlKSB7XG4gICAgICAgICAgICBzb3VuZEVmZmVjdC5wbGF5KClcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMueCA9IHJvdW5kVG8odGhpcy54IC0gYm9hcmRQb3MueCwgMzIpICsgYm9hcmRQb3MueDtcbiAgICAgICAgICAgIHRoaXMueSA9IHJvdW5kVG8odGhpcy55IC0gYm9hcmRQb3MueSwgMzIpICsgYm9hcmRQb3MueTtcblxuICAgICAgICAgICAgaWYgKHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LCB0aGlzLnkpLmZpbHRlcigoZSk9PntcbiAgICAgICAgICAgICAgICByZXR1cm4gZS50aWxlTnVtIT09dGhpcy50aWxlTnVtfSkubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gdGhpcy5vbGRQb3MueFxuICAgICAgICAgICAgICAgIHRoaXMueSA9IHRoaXMub2xkUG9zLnlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMub2xkUG9zID0ge3g6IHRoaXMueCwgeTogdGhpcy55fVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZHJhd1dhdGVyIChjdHgsIGZpbGxBbW91bnQsIHN0YXJ0KSB7XG4gICAgICAgIGN0eC5tb3ZlVG8odGhpcy54LCB0aGlzLnkpXG4gICAgICAgIGN0eC5saW5lVG8odGhpcy54LCB0aGlzLnkrMjAwKVxuICAgIH1cblxuICAgIGRyYXdXYXRlck5leHQgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgbGV0IG5leHRUaWxlXG4gICAgICAgIGZpbGxBbW91bnQgLT0gMVxuICAgICAgICBpZiAoc3RhcnQgPT09ICd3Jykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCszMiwgdGhpcy55KVswXVxuICAgICAgICAgICAgc3RhcnQgPSAnZSdcbiAgICAgICAgfSBlbHNlIGlmIChzdGFydCA9PT0gJ2UnKSB7XG4gICAgICAgICAgICBuZXh0VGlsZSA9IHRoaXMud29ybGQuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy54LTMyLCB0aGlzLnkpWzBdXG4gICAgICAgICAgICBzdGFydCA9ICd3J1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXJ0ID09PSAnbicpIHtcbiAgICAgICAgICAgIG5leHRUaWxlID0gdGhpcy53b3JsZC5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLngsIHRoaXMueS0zMilbMF1cbiAgICAgICAgICAgIHN0YXJ0ID0gJ3MnXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhcnQgPT09ICdzJykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCwgdGhpcy55KzMyKVswXVxuICAgICAgICAgICAgc3RhcnQgPSAnbidcbiAgICAgICAgfVxuICAgICAgICBpZiAobmV4dFRpbGUgJiYgbmV4dFRpbGUudGlsZU51bSA9PT0gdGhpcy53b3JsZC5lbmRUaWxlLnRpbGVOdW0pIHtcbiAgICAgICAgICAgIHJldHVybiBXSU5cbiAgICAgICAgfVxuICAgICAgICBpZiAoIW5leHRUaWxlICYmIGZpbGxBbW91bnQgPiAwICkge1xuICAgICAgICAgICAgcmV0dXJuIExPU0VcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0VGlsZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5leHRUaWxlLmRyYXdXYXRlcihjdHgsIGZpbGxBbW91bnQsIHN0YXJ0KVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVlVGlsZSBleHRlbmRzIFRpbGUge31cblxuZXhwb3J0IGNsYXNzIExvbmdUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMuaExvbmcsIHBpcGVTcHJpdGVzLnZMb25nLCBwaXBlU3ByaXRlcy5oTG9uZywgcGlwZVNwcml0ZXMudkxvbmddXG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQmVuZFRpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5ydUJlbmQsIHBpcGVTcHJpdGVzLmx1QmVuZCwgcGlwZVNwcml0ZXMubGRCZW5kLCBwaXBlU3ByaXRlcy5yZEJlbmRdXG4gICAgfVxuXG4gICAgZHJhd1dhdGVyIChjdHgsIGZpbGxBbW91bnQsIHN0YXJ0KSB7XG4gICAgICAgIGlmICh0aGlzLmRyYWdnaW5nKSByZXR1cm47XG5cbiAgICAgICAgbGV0IGZ1bGxuZXNzID0gMFxuICAgICAgICBsZXQgc3RhcnRSYW5nZSA9IDBcbiAgICAgICAgbGV0IGVuZCA9ICd4JyxcbiAgICAgICAgICAgIHJvdCA9IHRoaXMucm90LFxuICAgICAgICAgICAgZmlsbERpciA9IDEsXG4gICAgICAgICAgICB4ID0gdGhpcy54LFxuICAgICAgICAgICAgeSA9IHRoaXMueVxuICAgICAgICBpZiAocm90ID09PSAwICYmIHN0YXJ0ID09PSAnbicpIHtcbiAgICAgICAgICAgIGVuZCA9ICd3J1xuICAgICAgICAgICAgeCArPSAzMlxuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IE1hdGguUElcbiAgICAgICAgICAgIGZpbGxEaXIgPSAtMVxuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMCAmJiBzdGFydCA9PT0gJ3cnKSB7IC8vXG4gICAgICAgICAgICBlbmQgPSAnbidcbiAgICAgICAgICAgIHggKz0gMzJcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSBNYXRoLlBJLzJcbiAgICAgICAgfSBlbHNlIGlmIChyb3QgPT09IDEgJiYgc3RhcnQgPT09ICduJykgeyAvL1xuICAgICAgICAgICAgZW5kID0gJ2UnXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAxICYmIHN0YXJ0ID09PSAnZScpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICduJ1xuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IE1hdGguUEkvMlxuICAgICAgICAgICAgZmlsbERpciA9IC0xXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAyICYmIHN0YXJ0ID09PSAnZScpIHtcbiAgICAgICAgICAgIGVuZCA9ICdzJ1xuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IDMqTWF0aC5QSS8yXG4gICAgICAgICAgICB5ICs9IDMyXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAyICYmIHN0YXJ0ID09PSAncycpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICdlJ1xuICAgICAgICAgICAgZmlsbERpciA9IC0xXG4gICAgICAgICAgICBzdGFydFJhbmdlID0gMFxuICAgICAgICAgICAgeSArPSAzMlxuICAgICAgICB9IGVsc2UgaWYgKHJvdCA9PT0gMyAmJiBzdGFydCA9PT0gJ3cnKSB7IC8vXG4gICAgICAgICAgICBlbmQgPSAncydcbiAgICAgICAgICAgIHggKz0gMzJcbiAgICAgICAgICAgIHkgKz0gMzJcbiAgICAgICAgICAgIHN0YXJ0UmFuZ2UgPSAzKk1hdGguUEkvMlxuICAgICAgICAgICAgZmlsbERpciA9IC0xXG4gICAgICAgIH0gZWxzZSBpZiAocm90ID09PSAzICYmIHN0YXJ0ID09PSAncycpIHsgLy9cbiAgICAgICAgICAgIGVuZCA9ICd3J1xuICAgICAgICAgICAgeSArPSAzMlxuICAgICAgICAgICAgeCArPSAzMlxuICAgICAgICAgICAgc3RhcnRSYW5nZSA9IE1hdGguUElcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbmQgIT09ICd4Jykge1xuICAgICAgICAgICAgZnVsbG5lc3MgPSBNYXRoLm1heChNYXRoLm1pbihNYXRoLlBJLzIsIGZpbGxBbW91bnQqTWF0aC5QSS8yKSwgMClcbiAgICAgICAgICAgIGlmIChmaWxsQW1vdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIGN0eC5hcmMoeCwgeSwgMjAsIHN0YXJ0UmFuZ2UsIHN0YXJ0UmFuZ2UrZnVsbG5lc3MqZmlsbERpciwgZmlsbERpcj09PS0xKVxuICAgICAgICAgICAgICAgIHRoaXMubW9iaWxlID0gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChmaWxsQW1vdW50ID4gMCl7XG4gICAgICAgICAgICByZXR1cm4gTE9TRVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhd1dhdGVyTmV4dChjdHgsIGZpbGxBbW91bnQsIGVuZClcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3VyVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXldXG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTaG9ydFRpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oU2hvcnQsIHBpcGVTcHJpdGVzLnZTaG9ydF1cbiAgICB9XG5cbiAgICBkcmF3V2F0ZXIgKGN0eCwgZmlsbEFtb3VudCwgc3RhcnQpIHtcbiAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHJldHVybjtcbiAgICAgICAgbGV0IGZ1bGxuZXNzID0gTWF0aC5tYXgoTWF0aC5taW4oMzIsIGZpbGxBbW91bnQqMzIpLCAwKXwwXG4gICAgICAgIGxldCBlbmQgPSAneCdcbiAgICAgICAgaWYgKHRoaXMucm90ID09PSAwICYmIHN0YXJ0ID09PSAnZScpIHtcbiAgICAgICAgICAgIGVuZCA9ICd3J1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLngsIHRoaXMueSsxNilcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy54K2Z1bGxuZXNzLCB0aGlzLnkrMTYpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5yb3QgPT09IDAgJiYgc3RhcnQgPT09ICd3Jyl7XG4gICAgICAgICAgICBlbmQgPSAnZSdcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8odGhpcy54KzMyLWZ1bGxuZXNzLCB0aGlzLnkrMTYpXG4gICAgICAgICAgICBjdHgubGluZVRvKHRoaXMueCszMiwgdGhpcy55KzE2KVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucm90ID09PSAxICYmIHN0YXJ0ID09PSAnbicpe1xuICAgICAgICAgICAgZW5kID0gJ3MnXG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCsxNiwgdGhpcy55KVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrMTYsIHRoaXMueStmdWxsbmVzcylcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJvdCA9PT0gMSAmJiBzdGFydCA9PT0gJ3MnKXtcbiAgICAgICAgICAgIGVuZCA9ICduJ1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLngrMTYsIHRoaXMueSszMilcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy54KzE2LCB0aGlzLnkrMzItZnVsbG5lc3MpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbGxBbW91bnQgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLm1vYmlsZSA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZpbGxBbW91bnQgPiAwICYmIGVuZCA9PT0gJ3gnKSB7XG4gICAgICAgICAgICByZXR1cm4gTE9TRVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmRyYXdXYXRlck5leHQoY3R4LCBmaWxsQW1vdW50LCBlbmQpXG4gICAgfVxufVxuXG5mdW5jdGlvbiByb3VuZFRvICh2YWwsIGluYykge1xuICAgIGxldCBvZmZCeSA9ICh2YWwgJSBpbmMpO1xuICAgIGlmIChvZmZCeSA8PSBpbmMgLyAyKSB7XG4gICAgICAgIHJldHVybiB2YWwgLSBvZmZCeTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsICsgaW5jIC0gb2ZmQnk7XG4gICAgfVxufVxuIl19
