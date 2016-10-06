(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _game = require('./game');

var canvas = document.getElementById('screen');
var game = new _game.Game(canvas);

var masterLoop = function (timestamp) {
  game.loop(timestamp);
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
        ctx.lineWidth = 10;
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
                console.log('asdf');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixFQUFDLElBQUksRUFBTCxFQUF2QixDQUFWO0FBQ0EsWUFBSSxJQUFJLEtBQUosSUFBYSxJQUFqQixFQUF1QjtBQUNuQixpQkFBSyxZQUFMLEdBQW9CLElBQUksS0FBeEI7QUFDSCxTQUZELE1BRU8sSUFBSSxJQUFJLElBQVIsRUFBYztBQUNqQixpQkFBSyxZQUFMLEdBQW9CLEtBQUssZ0JBQUwsQ0FBc0IsSUFBdEIsQ0FBMkIsSUFBM0IsR0FBcEI7QUFDSDtBQUNKOztBQUVELFdBQU8sRUFBUCxFQUFXLEdBQVgsRUFBZ0I7QUFDWixZQUFJLE1BQU0sS0FBSyxXQUFMLENBQWlCLElBQWpCLENBQXNCLEVBQUMsSUFBSSxFQUFMLEVBQVMsS0FBSyxHQUFkLEVBQXRCLENBQVY7QUFDQSxZQUFJLElBQUksS0FBSixJQUFhLElBQWpCLEVBQXVCO0FBQ25CLGlCQUFLLFdBQUwsR0FBbUIsSUFBSSxLQUF2QjtBQUNILFNBRkQsTUFFTyxJQUFJLElBQUksSUFBUixFQUFjO0FBQ2pCLGlCQUFLLFdBQUwsR0FBbUIsS0FBSyxlQUFMLENBQXFCLElBQXJCLENBQTBCLElBQTFCLEdBQW5CO0FBQ0g7QUFDSjs7QUFFRCxLQUFDLGdCQUFELEdBQXFCLENBQUU7QUFDdkIsS0FBQyxlQUFELEdBQW9CLENBQUU7QUF6Q1A7UUFBTixLLEdBQUEsSzs7O0FDTGI7Ozs7O0FBR08sTUFBTSxhQUFOLENBQW9CO0FBQ3ZCLGtCQUFjO0FBQ1YsYUFBSyxNQUFMLEdBQWMsRUFBZDtBQUNIOztBQUVELHFCQUFpQixJQUFqQixFQUF1QixJQUF2QixFQUE2QjtBQUN6QixZQUFJLFNBQVMsS0FBSyxNQUFMLENBQVksSUFBWixLQUFxQixFQUFsQztBQUNBLGFBQUssTUFBTCxDQUFZLElBQVosSUFBb0IsTUFBcEI7O0FBRUEsZUFBTyxJQUFQLENBQVksSUFBWjtBQUNIOztBQUVELFNBQUssSUFBTCxFQUFXLElBQVgsRUFBaUI7QUFDYixZQUFJLFNBQVMsS0FBSyxNQUFMLENBQVksSUFBWixLQUFxQixFQUFsQztBQUNBLGFBQUssSUFBSSxFQUFULElBQWUsTUFBZixFQUF1QjtBQUNuQixlQUFHLElBQUg7QUFDSDtBQUNKO0FBakJzQjtRQUFkLGEsR0FBQSxhOzs7QUNIYjs7Ozs7QUFFQSxNQUFNLFdBQU4sQ0FBa0I7QUFDZCxnQkFBYSxFQUFDLEdBQUQsRUFBTSxDQUFOLEVBQVMsQ0FBVCxFQUFZLENBQVosRUFBZSxDQUFmLEVBQWIsRUFBZ0M7QUFDNUIsYUFBSyxHQUFMLEdBQVcsR0FBWDtBQUNBLGFBQUssQ0FBTCxHQUFTLENBQVQ7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxLQUFMLEdBQWEsQ0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLENBQWQ7QUFDSDs7QUFFRCxTQUFNLEdBQU4sRUFBVyxDQUFYLEVBQWMsQ0FBZCxFQUFpQixLQUFHLENBQXBCLEVBQXVCLEtBQUcsQ0FBMUIsRUFBNkI7QUFDekIsWUFBSSxTQUFKLENBQ0ksS0FBSyxHQURULEVBRUksS0FBSyxDQUZULEVBRVksS0FBSyxDQUZqQixFQUVvQixLQUFLLEtBRnpCLEVBRWdDLEtBQUssTUFGckMsRUFHSSxDQUhKLEVBR08sQ0FIUCxFQUdVLEtBQUssS0FBTCxHQUFXLEVBSHJCLEVBR3lCLEtBQUssTUFBTCxHQUFZLEVBSHJDO0FBS0g7QUFmYTs7QUFrQmxCLE1BQU0sV0FBTixDQUFrQjtBQUNkLGtCQUFlLENBRWQ7QUFIYTs7QUFNWCxNQUFNLFlBQU4sQ0FBbUI7QUFDdEIsa0JBQWUsQ0FFZDs7QUFFRCxxQkFBa0IsR0FBbEIsRUFBdUIsT0FBdkIsRUFBZ0M7QUFDNUIsWUFBSSxjQUFjLElBQUksS0FBSixFQUFsQjtBQUNBLG9CQUFZLEdBQVosR0FBa0IsR0FBbEI7O0FBRUEsWUFBSSxnQkFBZ0IsRUFBcEI7QUFDQSxhQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksUUFBUSxNQUE1QixFQUFvQyxHQUFwQyxFQUF5QztBQUNyQyxnQkFBSSxTQUFTLFFBQVEsQ0FBUixDQUFiO0FBQ0EsMEJBQWMsQ0FBZCxJQUFtQixJQUFJLFdBQUosQ0FDZjtBQUNJLHFCQUFLLFdBRFQ7QUFFSSxtQkFBRyxPQUFPLENBRmQ7QUFHSSxtQkFBRyxPQUFPLENBSGQ7QUFJSSxtQkFBRyxPQUFPLENBSmQ7QUFLSSxtQkFBRyxPQUFPO0FBTGQsYUFEZSxDQUFuQjtBQVFBLGdCQUFJLE9BQU8sSUFBWCxFQUFpQjtBQUNiLDhCQUFjLE9BQU8sSUFBckIsSUFBNkIsY0FBYyxDQUFkLENBQTdCO0FBQ0g7QUFDSjtBQUNELGVBQU8sYUFBUDtBQUNIO0FBekJxQjtRQUFiLFksR0FBQSxZOzs7QUMxQmI7Ozs7Ozs7QUFFQTs7QUFFTyxNQUFNLDhCQUFXO0FBQ3BCLE9BQUcsRUFEaUI7QUFFcEIsT0FBRyxFQUZpQjtBQUdwQixPQUFHLEdBSGlCO0FBSXBCLE9BQUc7QUFKaUIsQ0FBakI7O0FBT0EsTUFBTSxJQUFOLENBQVc7QUFDZCxnQkFBWSxNQUFaLEVBQW9CLFlBQXBCLEVBQWtDO0FBQzlCLGFBQUssWUFBTCxHQUFvQixZQUFwQjs7QUFFQTtBQUNBLGFBQUssTUFBTCxHQUFjLEtBQUssV0FBTCxHQUFtQixNQUFqQztBQUNBLGFBQUssUUFBTCxHQUFnQixPQUFPLFVBQVAsQ0FBa0IsSUFBbEIsQ0FBaEI7QUFDQSxhQUFLLFVBQUwsR0FBa0IsU0FBUyxhQUFULENBQXVCLFFBQXZCLENBQWxCO0FBQ0EsYUFBSyxVQUFMLENBQWdCLEtBQWhCLEdBQXdCLE9BQU8sS0FBL0I7QUFDQSxhQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsR0FBeUIsT0FBTyxNQUFoQztBQUNBLGFBQUssT0FBTCxHQUFlLEtBQUssVUFBTCxDQUFnQixVQUFoQixDQUEyQixJQUEzQixDQUFmOztBQUVBO0FBQ0EsYUFBSyxPQUFMLEdBQWUsWUFBWSxHQUFaLEVBQWY7QUFDQSxhQUFLLE1BQUwsR0FBYyxLQUFkOztBQUVBLGFBQUssTUFBTCxDQUFZLFdBQVosR0FBMEIsS0FBSyxXQUFMLENBQWlCLElBQWpCLENBQXNCLElBQXRCLENBQTFCO0FBQ0EsYUFBSyxNQUFMLENBQVksU0FBWixHQUF3QixLQUFLLFNBQUwsQ0FBZSxJQUFmLENBQW9CLElBQXBCLENBQXhCO0FBQ0EsYUFBSyxNQUFMLENBQVksV0FBWixHQUEwQixLQUFLLFdBQUwsQ0FBaUIsSUFBakIsQ0FBc0IsSUFBdEIsQ0FBMUI7QUFDQSxhQUFLLE1BQUwsQ0FBWSxhQUFaLEdBQTZCLENBQUQsSUFBSyxFQUFFLGNBQUYsRUFBakM7QUFDQSxhQUFLLFVBQUwsR0FBa0IsSUFBSSxnQkFBSixFQUFsQjs7QUFFQSxhQUFLLFNBQUwsR0FBaUIsb0JBQWMsSUFBZCxDQUFqQjtBQUNBLGFBQUssU0FBTCxDQUFlLE1BQWYsR0FBd0IsS0FBeEI7QUFDQSxhQUFLLFNBQUwsQ0FBZSxDQUFmLEdBQW1CLFNBQVMsQ0FBNUI7QUFDQSxhQUFLLFNBQUwsQ0FBZSxDQUFmLEdBQW1CLFNBQVMsQ0FBVCxHQUFhLENBQUUsS0FBSyxNQUFMLE1BQWUsU0FBUyxDQUFULEdBQVcsRUFBMUIsQ0FBRCxHQUFnQyxDQUFqQyxJQUFvQyxFQUFwRTtBQUNBLGFBQUssT0FBTCxHQUFlLG9CQUFjLElBQWQsQ0FBZjtBQUNBLGFBQUssT0FBTCxDQUFhLE1BQWIsR0FBc0IsS0FBdEI7QUFDQSxhQUFLLE9BQUwsQ0FBYSxDQUFiLEdBQWlCLFNBQVMsQ0FBVCxHQUFhLFNBQVMsQ0FBdEIsR0FBd0IsRUFBekM7QUFDQSxhQUFLLE9BQUwsQ0FBYSxDQUFiLEdBQWlCLFNBQVMsQ0FBVCxHQUFhLENBQUUsS0FBSyxNQUFMLE1BQWUsU0FBUyxDQUFULEdBQVcsRUFBMUIsQ0FBRCxHQUFnQyxDQUFqQyxJQUFvQyxFQUFsRTs7QUFFQSxhQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsR0FBeUIsQ0FBQyxLQUFLLFNBQU4sRUFBaUIsS0FBSyxPQUF0QixDQUF6Qjs7QUFFQSxhQUFLLGFBQUwsR0FBcUIsRUFBQyxHQUFHLENBQUosRUFBTyxHQUFHLENBQVYsRUFBckI7QUFDQSxhQUFLLFlBQUwsR0FBb0IsRUFBcEI7O0FBRUEsYUFBSyxLQUFMLEdBQWEsQ0FBYjtBQUNBLGFBQUssS0FBTCxHQUFhLENBQWI7QUFDQSxhQUFLLFFBQUwsR0FBZ0IsQ0FBaEI7QUFDSDs7QUFFRCxVQUFPLElBQVAsRUFBYTtBQUNULGFBQUssTUFBTCxHQUFlLFFBQVEsSUFBdkI7QUFDSDs7QUFFRCxTQUFNLE9BQU4sRUFBZTtBQUNYLFlBQUksT0FBTyxJQUFYO0FBQ0EsWUFBSSxjQUFjLFVBQVUsS0FBSyxPQUFqQztBQUNBLGFBQUssT0FBTCxHQUFlLE9BQWY7O0FBRUEsWUFBRyxDQUFDLEtBQUssTUFBVCxFQUFpQixLQUFLLE1BQUwsQ0FBWSxXQUFaO0FBQ2pCLGFBQUssTUFBTCxDQUFZLFdBQVosRUFBeUIsS0FBSyxRQUE5Qjs7QUFFQTtBQUNBLGFBQUssUUFBTCxDQUFjLFNBQWQsQ0FBd0IsS0FBSyxVQUE3QixFQUF5QyxDQUF6QyxFQUE0QyxDQUE1QztBQUNIOztBQUVELFdBQVEsV0FBUixFQUFxQixHQUFyQixFQUEwQjtBQUN0QixZQUFJLFNBQVMsS0FBSyxNQUFsQjs7QUFFQSxZQUFJLFNBQUosR0FBZ0IsU0FBaEI7QUFDQSxZQUFJLFFBQUosQ0FBYSxDQUFiLEVBQWdCLENBQWhCLEVBQW1CLE9BQU8sS0FBMUIsRUFBaUMsT0FBTyxNQUF4QztBQUNBLFlBQUksU0FBSjtBQUNBLGFBQUssSUFBSSxJQUFFLFNBQVMsQ0FBcEIsRUFBdUIsS0FBRyxTQUFTLENBQVQsR0FBVyxTQUFTLENBQTlDLEVBQWlELEtBQUcsRUFBcEQsRUFBd0Q7QUFDcEQsZ0JBQUksTUFBSixDQUFXLENBQVgsRUFBYyxTQUFTLENBQXZCO0FBQ0EsZ0JBQUksTUFBSixDQUFXLENBQVgsRUFBYyxTQUFTLENBQVQsR0FBVyxTQUFTLENBQWxDO0FBQ0g7QUFDRCxhQUFLLElBQUksSUFBRSxTQUFTLENBQXBCLEVBQXVCLEtBQUcsU0FBUyxDQUFULEdBQVcsU0FBUyxDQUE5QyxFQUFpRCxLQUFHLEVBQXBELEVBQXdEO0FBQ3BELGdCQUFJLE1BQUosQ0FBVyxTQUFTLENBQXBCLEVBQXVCLENBQXZCO0FBQ0EsZ0JBQUksTUFBSixDQUFXLFNBQVMsQ0FBVCxHQUFXLFNBQVMsQ0FBL0IsRUFBa0MsQ0FBbEM7QUFDSDtBQUNELFlBQUksV0FBSixHQUFrQixNQUFsQjtBQUNBLFlBQUksU0FBSixHQUFnQixDQUFoQjtBQUNBLFlBQUksTUFBSjs7QUFFQSxZQUFJLFNBQUo7QUFDQSxZQUFJLFdBQUosR0FBa0IsTUFBbEI7QUFDQSxZQUFJLFNBQUosR0FBZ0IsRUFBaEI7QUFDQSxhQUFLLFNBQUwsQ0FBZSxTQUFmLENBQXlCLEdBQXpCLEVBQThCLEtBQUssUUFBbkMsRUFBNkMsR0FBN0M7QUFDQSxZQUFJLE1BQUo7O0FBRUEsYUFBSyxJQUFJLEtBQVQsSUFBa0IsS0FBSyxVQUFMLENBQWdCLE1BQWxDLEVBQTBDO0FBQ3RDLGtCQUFNLE1BQU4sQ0FBYSxXQUFiLEVBQTBCLEdBQTFCO0FBQ0g7O0FBRUQsWUFBSSxTQUFKLEdBQWdCLE9BQWhCO0FBQ0EsWUFBSSxJQUFKLEdBQVcsWUFBWDtBQUNBLFlBQUksUUFBSixDQUFjLFVBQVEsS0FBSyxLQUFNLEdBQWpDLEVBQW9DLEVBQXBDLEVBQXdDLEdBQXhDO0FBQ0EsWUFBSSxRQUFKLENBQWMsSUFBRSxLQUFLLEtBQU0sVUFBM0IsRUFBcUMsRUFBckMsRUFBeUMsR0FBekM7QUFFSDs7QUFFRCxXQUFRLFdBQVIsRUFBcUI7QUFDakIsYUFBSyxVQUFMLENBQWdCLE1BQWhCO0FBQ0EsYUFBSyxJQUFJLEtBQVQsSUFBa0IsS0FBSyxVQUFMLENBQWdCLE1BQWxDLEVBQTBDO0FBQ3RDLGtCQUFNLE1BQU4sQ0FBYSxXQUFiO0FBQ0g7QUFDRCxZQUFJLENBQUMsS0FBSyxVQUFOLElBQW9CLEtBQUssVUFBTCxDQUFnQixZQUFoQixDQUE2QixFQUE3QixFQUFpQyxFQUFqQyxFQUFxQyxNQUFyQyxLQUFnRCxDQUF4RSxFQUEyRTtBQUN2RSxnQkFBSSxXQUFXLGlDQUFmO0FBQ0EsZ0JBQUksT0FBTyxTQUFTLEtBQUssTUFBTCxLQUFjLFNBQVMsTUFBdkIsR0FBOEIsQ0FBdkMsQ0FBWDtBQUNBLGlCQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsQ0FBdUIsSUFBdkIsQ0FBNEIsSUFBSSxJQUFKLENBQVMsSUFBVCxDQUE1QjtBQUNIO0FBQ0QsYUFBSyxRQUFMLElBQWlCLE9BQU8sS0FBSyxLQUE3QjtBQUNIOztBQUVELGdCQUFhLEtBQWIsRUFBb0I7QUFDaEIsZ0JBQVEsR0FBUixDQUFZLEtBQVo7QUFDQSxZQUFJLE1BQU0sT0FBTixHQUFnQixDQUFwQixFQUF1QjtBQUNuQixpQkFBSyxVQUFMLEdBQWtCLElBQWxCO0FBQ0EsZ0JBQUksU0FBUyxLQUFLLFVBQUwsQ0FBZ0IsWUFBaEIsQ0FBNkIsS0FBSyxhQUFMLENBQW1CLENBQWhELEVBQW1ELEtBQUssYUFBTCxDQUFtQixDQUF0RSxDQUFiO0FBQ0EsaUJBQUssWUFBTCxHQUFvQixNQUFwQjtBQUNBLGlCQUFLLElBQUksS0FBVCxJQUFrQixNQUFsQixFQUEwQjtBQUN0QixzQkFBTSxXQUFOO0FBQ0g7QUFDSjtBQUNELFlBQUksTUFBTSxPQUFOLEdBQWdCLENBQXBCLEVBQXVCO0FBQ25CLGdCQUFJLFNBQVMsS0FBSyxVQUFMLENBQWdCLFlBQWhCLENBQTZCLEtBQUssYUFBTCxDQUFtQixDQUFoRCxFQUFtRCxLQUFLLGFBQUwsQ0FBbUIsQ0FBdEUsQ0FBYjtBQUNBLGlCQUFLLElBQUksS0FBVCxJQUFrQixNQUFsQixFQUEwQjtBQUN0QixzQkFBTSxZQUFOO0FBQ0g7QUFDSjtBQUNKOztBQUVELGNBQVcsS0FBWCxFQUFrQjtBQUNkLGFBQUssVUFBTCxHQUFrQixLQUFsQjtBQUNBLGFBQUssSUFBSSxLQUFULElBQWtCLEtBQUssWUFBdkIsRUFBcUM7QUFDakMsa0JBQU0sVUFBTjtBQUNIO0FBQ0o7O0FBRUQsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixhQUFLLGFBQUwsR0FBcUIsRUFBQyxHQUFHLE1BQU0sT0FBVixFQUFtQixHQUFHLE1BQU0sT0FBNUIsRUFBckI7QUFDSDtBQXBJYTs7UUFBTCxJLEdBQUEsSTtBQXVJYixNQUFNLGdCQUFOLENBQXVCO0FBQ25CLGtCQUFlO0FBQ1gsYUFBSyxNQUFMLEdBQWMsRUFBZDtBQUNBLGFBQUssUUFBTCxHQUFnQixFQUFoQjtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7QUFDSDs7QUFFRCxpQkFBYyxDQUFkLEVBQWlCLENBQWpCLEVBQW9CO0FBQ2hCLFlBQUksT0FBTyxLQUFLLE9BQUwsQ0FBYSxDQUFiLEVBQWdCLENBQWhCLENBQVg7QUFDQSxlQUFPLElBQVA7QUFDSDs7QUFFRCxZQUFTLENBQVQsRUFBWSxDQUFaLEVBQWU7QUFDWCxZQUFLLElBQUksS0FBSyxRQUFWLEdBQW9CLENBQXhCO0FBQ0EsWUFBSyxJQUFJLEtBQUssUUFBVixHQUFvQixDQUF4QjtBQUNBLGVBQU8sS0FBSyxNQUFMLENBQWEsSUFBRSxDQUFFLE1BQUcsQ0FBRSxHQUF0QixJQUEyQixLQUFLLE1BQUwsQ0FBYSxJQUFFLENBQUUsTUFBRyxDQUFFLEdBQXRCLEtBQTRCLEVBQTlEO0FBQ0g7O0FBRUQsYUFBVTtBQUNOLGFBQUssTUFBTCxDQUFZLE1BQVosQ0FBb0IsQ0FBRCxJQUFLLENBQUMsRUFBRSxPQUFGLEVBQXpCO0FBQ0EsYUFBSyxNQUFMLEdBQWMsRUFBZDtBQUNBLGFBQUssSUFBSSxLQUFULElBQWtCLEtBQUssTUFBdkIsRUFBK0I7QUFDM0IsZ0JBQUksT0FBTyxLQUFLLE9BQUwsQ0FBYSxNQUFNLENBQW5CLEVBQXNCLE1BQU0sQ0FBNUIsQ0FBWDtBQUNBLGlCQUFLLElBQUwsQ0FBVSxLQUFWO0FBQ0g7QUFDSjtBQXpCa0I7OztBQ2xKdkI7Ozs7Ozs7QUFFQTs7QUFFQSxJQUFJLFFBQVEsZ0NBQVo7O0FBRU8sSUFBSSxvQ0FBYyxNQUFNLGdCQUFOLENBQXVCLG9CQUF2QixFQUNyQixDQUNJLEVBQUMsR0FBRSxDQUFILEVBQU0sR0FBRSxDQUFSLEVBQVcsR0FBRSxFQUFiLEVBQWlCLEdBQUUsRUFBbkIsRUFBdUIsTUFBSyxTQUE1QixFQURKLEVBRUksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLENBQVQsRUFBWSxHQUFFLEVBQWQsRUFBa0IsR0FBRSxFQUFwQixFQUF3QixNQUFLLE9BQTdCLEVBRkosRUFHSSxFQUFDLEdBQUUsQ0FBSCxFQUFNLEdBQUUsRUFBUixFQUFZLEdBQUUsRUFBZCxFQUFrQixHQUFFLEVBQXBCLEVBQXdCLE1BQUssT0FBN0IsRUFISixFQUlJLEVBQUMsR0FBRSxFQUFILEVBQU8sR0FBRSxFQUFULEVBQWEsR0FBRSxFQUFmLEVBQW1CLEdBQUUsRUFBckIsRUFBeUIsTUFBSyxRQUE5QixFQUpKLEVBS0ksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEVBQVQsRUFBYSxHQUFFLEVBQWYsRUFBbUIsR0FBRSxFQUFyQixFQUF5QixNQUFLLFFBQTlCLEVBTEosRUFNSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsRUFBVCxFQUFhLEdBQUUsRUFBZixFQUFtQixHQUFFLEVBQXJCLEVBQXlCLE1BQUssUUFBOUIsRUFOSixFQU9JLEVBQUMsR0FBRSxFQUFILEVBQU8sR0FBRSxFQUFULEVBQWEsR0FBRSxFQUFmLEVBQW1CLEdBQUUsRUFBckIsRUFBeUIsTUFBSyxRQUE5QixFQVBKLEVBUUksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEVBQVQsRUFBYSxHQUFFLEVBQWYsRUFBbUIsR0FBRSxFQUFyQixFQUF5QixNQUFLLFFBQTlCLEVBUkosRUFTSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsRUFBVCxFQUFhLEdBQUUsRUFBZixFQUFtQixHQUFFLEVBQXJCLEVBQXlCLE1BQUssUUFBOUIsRUFUSixFQVVJLEVBQUMsR0FBRSxFQUFILEVBQU8sR0FBRSxFQUFULEVBQWEsR0FBRSxFQUFmLEVBQW1CLEdBQUUsRUFBckIsRUFBeUIsTUFBSyxNQUE5QixFQVZKLEVBV0ksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEdBQVQsRUFBYyxHQUFFLEVBQWhCLEVBQW9CLEdBQUUsRUFBdEIsRUFBMEIsTUFBSyxNQUEvQixFQVhKLEVBWUksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEdBQVQsRUFBYyxHQUFFLEVBQWhCLEVBQW9CLEdBQUUsRUFBdEIsRUFBMEIsTUFBSyxNQUEvQixFQVpKLEVBYUksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEVBQVQsRUFBYSxHQUFFLEVBQWYsRUFBbUIsR0FBRSxFQUFyQixFQUF5QixNQUFLLE1BQTlCLEVBYkosQ0FEcUIsQ0FBbEI7OztBQ05QOzs7Ozs7O0FBRUE7O0FBQ0E7O0FBQ0E7O0FBRU8sTUFBTSxJQUFOLHNCQUF5QjtBQUM1QixnQkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGNBQU0sS0FBTjtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkO0FBQ0EsYUFBSyxDQUFMLEdBQVMsRUFBVDtBQUNBLGFBQUssQ0FBTCxHQUFTLEVBQVQ7QUFDQSxhQUFLLFVBQUwsR0FBa0IsSUFBbEI7QUFDQSxhQUFLLE9BQUwsR0FBZSxDQUFDLHFCQUFZLElBQWIsRUFBbUIscUJBQVksSUFBL0IsRUFBcUMscUJBQVksSUFBakQsRUFBdUQscUJBQVksSUFBbkUsQ0FBZjtBQUNBLGFBQUssR0FBTCxHQUFXLENBQVg7QUFDQSxhQUFLLE1BQUwsR0FBYyxJQUFkO0FBQ0EsYUFBSyxNQUFMLEdBQWMsRUFBQyxHQUFHLEtBQUssQ0FBVCxFQUFZLEdBQUcsS0FBSyxDQUFwQixFQUFkO0FBQ0g7O0FBRUQsS0FBQyxlQUFELEdBQW9CO0FBQ2hCLGVBQU8sSUFBUCxFQUFhO0FBQ1QsZ0JBQUksRUFBQyxFQUFELEVBQUssR0FBTCxLQUFZLEtBQWhCO0FBQ0EsaUJBQUssT0FBTCxDQUFhLEtBQUssR0FBbEIsRUFBdUIsSUFBdkIsQ0FBNEIsR0FBNUIsRUFBaUMsS0FBSyxDQUF0QyxFQUF5QyxLQUFLLENBQTlDO0FBQ0g7QUFDSjs7QUFFRCxLQUFDLGdCQUFELEdBQXFCO0FBQ2pCLGVBQU8sSUFBUCxFQUFhO0FBQ1QsaUJBQUssUUFBTCxJQUFpQixLQUFLLEtBQUwsQ0FBVyxVQUE1QjtBQUNBLGdCQUFJLEtBQUssUUFBVCxFQUFtQjtBQUNmLG9CQUFJLEVBQUMsQ0FBRCxFQUFJLENBQUosS0FBUyxLQUFLLEtBQUwsQ0FBVyxhQUF4QjtBQUNBLHFCQUFLLENBQUwsR0FBUyxJQUFJLEtBQUssVUFBTCxDQUFnQixDQUE3QjtBQUNBLHFCQUFLLENBQUwsR0FBUyxJQUFJLEtBQUssVUFBTCxDQUFnQixDQUE3QjtBQUNIO0FBQ0Q7QUFDSDtBQUNKOztBQUVELG1CQUFnQjtBQUNaLFlBQUksS0FBSyxNQUFULEVBQWlCO0FBQ2IsaUJBQUssR0FBTCxHQUFXLENBQUMsS0FBSyxHQUFMLEdBQVcsQ0FBWixJQUFpQixLQUFLLE9BQUwsQ0FBYSxNQUF6QztBQUNIO0FBQ0o7O0FBRUQsa0JBQWU7QUFDWCxZQUFJLEtBQUssTUFBVCxFQUFpQjtBQUNiLGlCQUFLLFFBQUwsR0FBZ0IsSUFBaEI7QUFDQSxnQkFBSSxJQUFJLEtBQUssQ0FBTCxHQUFTLEtBQUssS0FBTCxDQUFXLGFBQVgsQ0FBeUIsQ0FBMUM7QUFDQSxnQkFBSSxJQUFJLEtBQUssQ0FBTCxHQUFTLEtBQUssS0FBTCxDQUFXLGFBQVgsQ0FBeUIsQ0FBMUM7O0FBRUEsaUJBQUssVUFBTCxHQUFrQixFQUFDLEdBQUUsQ0FBSCxFQUFNLEdBQUUsQ0FBUixFQUFsQjtBQUNIO0FBQ0o7O0FBRUQsaUJBQWM7QUFDVixZQUFJLEtBQUssTUFBVCxFQUFpQjtBQUNiLGlCQUFLLFFBQUwsR0FBZ0IsS0FBaEI7QUFDQSxpQkFBSyxDQUFMLEdBQVMsUUFBUSxLQUFLLENBQUwsR0FBUyxlQUFTLENBQTFCLEVBQTZCLEVBQTdCLElBQW1DLGVBQVMsQ0FBckQ7QUFDQSxpQkFBSyxDQUFMLEdBQVMsUUFBUSxLQUFLLENBQUwsR0FBUyxlQUFTLENBQTFCLEVBQTZCLEVBQTdCLElBQW1DLGVBQVMsQ0FBckQ7O0FBRUEsZ0JBQUksS0FBSyxLQUFMLENBQVcsVUFBWCxDQUFzQixZQUF0QixDQUFtQyxLQUFLLENBQXhDLEVBQTJDLEtBQUssQ0FBaEQsRUFBbUQsTUFBbkQsQ0FBMkQsQ0FBRCxJQUFLO0FBQUMsc0JBQUksSUFBSjtBQUFTLGFBQXpFLEVBQTJFLE1BQTNFLEtBQXNGLENBQTFGLEVBQTZGO0FBQ3pGLHdCQUFRLEdBQVIsQ0FBWSxNQUFaO0FBQ0EscUJBQUssQ0FBTCxHQUFTLEtBQUssTUFBTCxDQUFZLENBQXJCO0FBQ0EscUJBQUssQ0FBTCxHQUFTLEtBQUssTUFBTCxDQUFZLENBQXJCO0FBQ0g7QUFDRCxpQkFBSyxNQUFMLEdBQWMsRUFBQyxHQUFHLEtBQUssQ0FBVCxFQUFZLEdBQUcsS0FBSyxDQUFwQixFQUFkO0FBQ0g7QUFDSjs7QUFFRCxjQUFXLEdBQVgsRUFBZ0IsVUFBaEIsRUFBNEIsS0FBNUIsRUFBbUM7QUFDL0IsWUFBSSxNQUFKLENBQVcsS0FBSyxDQUFoQixFQUFtQixLQUFLLENBQXhCO0FBQ0EsWUFBSSxNQUFKLENBQVcsS0FBSyxDQUFoQixFQUFtQixLQUFLLENBQUwsR0FBTyxHQUExQjtBQUNIOztBQUVELGtCQUFlLEdBQWYsRUFBb0IsVUFBcEIsRUFBZ0MsS0FBaEMsRUFBdUM7QUFDbkMsWUFBSSxRQUFKO0FBQ0EsWUFBSSxVQUFVLEdBQWQsRUFBbUI7QUFDZix1QkFBVyxLQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLFlBQXRCLENBQW1DLEtBQUssQ0FBTCxHQUFPLEVBQTFDLEVBQThDLEtBQUssQ0FBbkQsRUFBc0QsQ0FBdEQsQ0FBWDtBQUNIO0FBQ0QsWUFBSSxRQUFKLEVBQWM7QUFDVixxQkFBUyxTQUFULENBQW1CLEdBQW5CLEVBQXdCLGFBQVcsQ0FBbkMsRUFBc0MsS0FBdEM7QUFDSDtBQUNKO0FBN0UyQjs7UUFBbkIsSSxHQUFBLEk7QUFnRk4sTUFBTSxPQUFOLFNBQXNCLElBQXRCLENBQTJCOztRQUFyQixPLEdBQUEsTztBQUVOLE1BQU0sUUFBTixTQUF1QixJQUF2QixDQUE0QjtBQUMvQixnQkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGNBQU0sS0FBTjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksS0FBYixFQUFvQixxQkFBWSxLQUFoQyxFQUF1QyxxQkFBWSxLQUFuRCxFQUEwRCxxQkFBWSxLQUF0RSxDQUFmO0FBQ0g7QUFKOEI7O1FBQXRCLFEsR0FBQSxRO0FBT04sTUFBTSxRQUFOLFNBQXVCLElBQXZCLENBQTRCO0FBQy9CLGdCQUFhLEtBQWIsRUFBb0I7QUFDaEIsY0FBTSxLQUFOO0FBQ0EsYUFBSyxPQUFMLEdBQWUsQ0FBQyxxQkFBWSxNQUFiLEVBQXFCLHFCQUFZLE1BQWpDLEVBQXlDLHFCQUFZLE1BQXJELEVBQTZELHFCQUFZLE1BQXpFLENBQWY7QUFDSDtBQUo4Qjs7UUFBdEIsUSxHQUFBLFE7QUFPTixNQUFNLFFBQU4sU0FBdUIsSUFBdkIsQ0FBNEI7QUFDL0IsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixjQUFNLEtBQU47QUFDQSxhQUFLLE9BQUwsR0FBZSxDQUFDLHFCQUFZLE9BQWIsRUFBc0IscUJBQVksT0FBbEMsRUFBMkMscUJBQVksT0FBdkQsRUFBZ0UscUJBQVksT0FBNUUsQ0FBZjtBQUNIO0FBSjhCOztRQUF0QixRLEdBQUEsUTtBQVFOLE1BQU0sU0FBTixTQUF3QixJQUF4QixDQUE2QjtBQUNoQyxnQkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGNBQU0sS0FBTjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksTUFBYixFQUFxQixxQkFBWSxNQUFqQyxDQUFmO0FBQ0g7O0FBRUQsY0FBVyxHQUFYLEVBQWdCLFVBQWhCLEVBQTRCLEtBQTVCLEVBQW1DO0FBQy9CLFlBQUksS0FBSyxRQUFULEVBQW1CO0FBQ25CLFlBQUksV0FBVyxLQUFLLEdBQUwsQ0FBUyxLQUFLLEdBQUwsQ0FBUyxFQUFULEVBQWEsYUFBVyxFQUF4QixDQUFULEVBQXNDLENBQXRDLElBQXlDLENBQXhEO0FBQ0EsWUFBSSxLQUFLLEdBQUwsS0FBYSxDQUFqQixFQUFvQjtBQUNoQixnQkFBSSxNQUFKLENBQVcsS0FBSyxDQUFoQixFQUFtQixLQUFLLENBQUwsR0FBTyxFQUExQjtBQUNBLGdCQUFJLE1BQUosQ0FBVyxLQUFLLENBQUwsR0FBTyxRQUFsQixFQUE0QixLQUFLLENBQUwsR0FBTyxFQUFuQztBQUNILFNBSEQsTUFHTztBQUNILGdCQUFJLE1BQUosQ0FBVyxLQUFLLENBQUwsR0FBTyxFQUFsQixFQUFzQixLQUFLLENBQTNCO0FBQ0EsZ0JBQUksTUFBSixDQUFXLEtBQUssQ0FBTCxHQUFPLEVBQWxCLEVBQXNCLEtBQUssQ0FBTCxHQUFPLFFBQTdCO0FBQ0g7QUFDRCxhQUFLLGFBQUwsQ0FBbUIsR0FBbkIsRUFBd0IsVUFBeEIsRUFBb0MsR0FBcEM7QUFDSDtBQWpCK0I7O1FBQXZCLFMsR0FBQSxTO0FBb0JiLFNBQVMsT0FBVCxDQUFrQixHQUFsQixFQUF1QixHQUF2QixFQUE0QjtBQUN4QixRQUFJLFFBQVMsTUFBTSxHQUFuQjtBQUNBLFFBQUksU0FBUyxNQUFNLENBQW5CLEVBQXNCO0FBQ2xCLGVBQU8sTUFBTSxLQUFiO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZUFBTyxNQUFNLEdBQU4sR0FBWSxLQUFuQjtBQUNIO0FBQ0oiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0dhbWV9IGZyb20gJy4vZ2FtZSc7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyZWVuJyk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKGNhbnZhcyk7XG5cblxudmFyIG1hc3Rlckxvb3AgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQge0V2ZW50TGlzdGVuZXJ9IGZyb20gXCIuL2V2ZW50cy5qc1wiO1xuXG5cbmV4cG9ydCBjbGFzcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgRXZlbnRMaXN0ZW5lcigpO1xuXG4gICAgICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDY0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICB9XG5cbiAgICBnZXRIaXRCb3hlcygpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbGxlY3QoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMuY29udHJvbFN0YXRlLm5leHQoe2R0OiBkdH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoZHQsIGN0eCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5yZW5kZXJTdGF0ZS5uZXh0KHtkdDogZHQsIGN0eDogY3R4fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHt9XG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxuZXhwb3J0IGNsYXNzIEV2ZW50TGlzdGVuZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZnVuYykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRzO1xuXG4gICAgICAgIGV2ZW50cy5wdXNoKGZ1bmMpO1xuICAgIH1cblxuICAgIGVtaXQobmFtZSwgYXJncykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIGZvciAobGV0IGV2IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgZXYoYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIEltYWdlSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoe2ltZywgeCwgeSwgdywgaH0pIHtcbiAgICAgICAgdGhpcy5pbWcgPSBpbWc7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMud2lkdGggPSB3O1xuICAgICAgICB0aGlzLmhlaWdodCA9IGg7XG4gICAgfVxuXG4gICAgZHJhdyAoY3R4LCB4LCB5LCBzeD0xLCBzeT0xKSB7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoXG4gICAgICAgICAgICB0aGlzLmltZyxcbiAgICAgICAgICAgIHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHgsIHksIHRoaXMud2lkdGgqc3gsIHRoaXMuaGVpZ2h0KnN5XG4gICAgICAgIClcbiAgICB9XG59XG5cbmNsYXNzIEF1ZGlvSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZWRpYU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cblxuICAgIGZldGNoU3ByaXRlU2hlZXQgKHVybCwgc3ByaXRlcykge1xuICAgICAgICBsZXQgc3ByaXRlU2hlZXQgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgc3ByaXRlU2hlZXQuc3JjID0gdXJsO1xuXG4gICAgICAgIGxldCBzcHJpdGVIYW5kbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHNwcml0ZSA9IHNwcml0ZXNbaV07XG4gICAgICAgICAgICBzcHJpdGVIYW5kbGVzW2ldID0gbmV3IEltYWdlSGFuZGxlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW1nOiBzcHJpdGVTaGVldCxcbiAgICAgICAgICAgICAgICAgICAgeDogc3ByaXRlLngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHNwcml0ZS55LFxuICAgICAgICAgICAgICAgICAgICB3OiBzcHJpdGUudyxcbiAgICAgICAgICAgICAgICAgICAgaDogc3ByaXRlLmgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChzcHJpdGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbc3ByaXRlLm5hbWVdID0gc3ByaXRlSGFuZGxlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3ByaXRlSGFuZGxlcztcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QmVuZFRpbGUsIEZvdXJUaWxlLCBTaG9ydFRpbGUsIFRlZVRpbGUsIExvbmdUaWxlfSBmcm9tICcuL3RpbGUnO1xuXG5leHBvcnQgY29uc3QgYm9hcmRQb3MgPSB7XG4gICAgeDogOTYsXG4gICAgeTogMzIsXG4gICAgdzogODk2LFxuICAgIGg6IDUxMixcbn1cblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICAgIGNvbnN0cnVjdG9yKHNjcmVlbiwgbWVkaWFNYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMubWVkaWFNYW5hZ2VyID0gbWVkaWFNYW5hZ2VyO1xuXG4gICAgICAgIC8vIFNldCB1cCBidWZmZXJzXG4gICAgICAgIHRoaXMuY2FudmFzID0gdGhpcy5mcm9udEJ1ZmZlciA9IHNjcmVlbjtcbiAgICAgICAgdGhpcy5mcm9udEN0eCA9IHNjcmVlbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLndpZHRoID0gc2NyZWVuLndpZHRoO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIuaGVpZ2h0ID0gc2NyZWVuLmhlaWdodDtcbiAgICAgICAgdGhpcy5iYWNrQ3R4ID0gdGhpcy5iYWNrQnVmZmVyLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgLy8gU3RhcnQgdGhlIGdhbWUgbG9vcFxuICAgICAgICB0aGlzLm9sZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlZG93biA9IHRoaXMub25TdGFydERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZXVwID0gdGhpcy5vbkVuZERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZW1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY2FudmFzLm9uY29udGV4dG1lbnUgPSAoZSk9PmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0gbmV3IENvbGxpc2lvbk1hbmFnZXIoKTtcblxuICAgICAgICB0aGlzLnN0YXJ0VGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5zdGFydFRpbGUubW9iaWxlID0gZmFsc2VcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueCA9IGJvYXJkUG9zLnhcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueSA9IGJvYXJkUG9zLnkgKyAoKE1hdGgucmFuZG9tKCkqKGJvYXJkUG9zLmgvMzIpKXwwKSozMlxuICAgICAgICB0aGlzLmVuZFRpbGUgPSBuZXcgU2hvcnRUaWxlKHRoaXMpXG4gICAgICAgIHRoaXMuZW5kVGlsZS5tb2JpbGUgPSBmYWxzZVxuICAgICAgICB0aGlzLmVuZFRpbGUueCA9IGJvYXJkUG9zLnggKyBib2FyZFBvcy53LTMyXG4gICAgICAgIHRoaXMuZW5kVGlsZS55ID0gYm9hcmRQb3MueSArICgoTWF0aC5yYW5kb20oKSooYm9hcmRQb3MuaC8zMikpfDApKjMyXG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycyA9IFt0aGlzLnN0YXJ0VGlsZSwgdGhpcy5lbmRUaWxlXTtcblxuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogMCwgeTogMH07XG4gICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gW107XG5cbiAgICAgICAgdGhpcy5zY29yZSA9IDBcbiAgICAgICAgdGhpcy5sZXZlbCA9IDFcbiAgICAgICAgdGhpcy5mdWxsbmVzcyA9IDBcbiAgICB9XG5cbiAgICBwYXVzZSAoZmxhZykge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IChmbGFnID09IHRydWUpO1xuICAgIH1cblxuICAgIGxvb3AgKG5ld1RpbWUpIHtcbiAgICAgICAgdmFyIGdhbWUgPSB0aGlzO1xuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXdUaW1lIC0gdGhpcy5vbGRUaW1lO1xuICAgICAgICB0aGlzLm9sZFRpbWUgPSBuZXdUaW1lO1xuXG4gICAgICAgIGlmKCF0aGlzLnBhdXNlZCkgdGhpcy51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB0aGlzLnJlbmRlcihlbGFwc2VkVGltZSwgdGhpcy5mcm9udEN0eCk7XG5cbiAgICAgICAgLy8gRmxpcCB0aGUgYmFjayBidWZmZXJcbiAgICAgICAgdGhpcy5mcm9udEN0eC5kcmF3SW1hZ2UodGhpcy5iYWNrQnVmZmVyLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZW5kZXIgKGVsYXBzZWRUaW1lLCBjdHgpIHtcbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzO1xuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBcIiM3Nzc3NzdcIjtcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgZm9yIChsZXQgeD1ib2FyZFBvcy54OyB4PD1ib2FyZFBvcy54K2JvYXJkUG9zLnc7IHgrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHgsIGJvYXJkUG9zLnkpO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh4LCBib2FyZFBvcy55K2JvYXJkUG9zLmgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IHk9Ym9hcmRQb3MueTsgeTw9Ym9hcmRQb3MueStib2FyZFBvcy5oOyB5Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyhib2FyZFBvcy54LCB5KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oYm9hcmRQb3MueCtib2FyZFBvcy53LCB5KTtcbiAgICAgICAgfVxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAnZ3JleSc7XG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAyO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpXG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdibHVlJ1xuICAgICAgICBjdHgubGluZVdpZHRoID0gMTBcbiAgICAgICAgdGhpcy5zdGFydFRpbGUuZHJhd1dhdGVyKGN0eCwgdGhpcy5mdWxsbmVzcywgJ3cnKVxuICAgICAgICBjdHguc3Ryb2tlKClcblxuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci5yZW5kZXIoZWxhcHNlZFRpbWUsIGN0eCk7XG4gICAgICAgIH1cblxuICAgICAgICBjdHguZmlsbFN0eWxlID0gJ3doaXRlJ1xuICAgICAgICBjdHguZm9udCA9IFwiMTJweCBzZXJpZlwiXG4gICAgICAgIGN0eC5maWxsVGV4dChgbGV2ZWwgJHt0aGlzLmxldmVsfWAsIDEwLCA1MDApXG4gICAgICAgIGN0eC5maWxsVGV4dChgJHt0aGlzLnNjb3JlfSBwb2ludHNgLCAxMCwgNTIwKVxuXG4gICAgfVxuXG4gICAgdXBkYXRlIChlbGFwc2VkVGltZSkge1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMudXBkYXRlKCk7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmlzRHJhZ2dpbmcgJiYgdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCgzMiwgNjQpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGV0IHBvc1RpbGVzID0gW1Nob3J0VGlsZSwgQmVuZFRpbGVdXG4gICAgICAgICAgICBsZXQgdGlsZSA9IHBvc1RpbGVzW01hdGgucmFuZG9tKCkqcG9zVGlsZXMubGVuZ3RofDBdXG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzLnB1c2gobmV3IHRpbGUodGhpcykpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mdWxsbmVzcyArPSAuMDA1ICogdGhpcy5sZXZlbFxuICAgIH1cblxuICAgIG9uU3RhcnREcmFnIChldmVudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhldmVudClcbiAgICAgICAgaWYgKGV2ZW50LmJ1dHRvbnMgJiAxKSB7XG4gICAgICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gYWN0b3JzO1xuICAgICAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgYWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgYWN0b3Iub25TdGFydERyYWcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDIpIHtcbiAgICAgICAgICAgIGxldCBhY3RvcnMgPSB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMubW91c2VMb2NhdGlvbi54LCB0aGlzLm1vdXNlTG9jYXRpb24ueSk7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblJpZ2h0Q2xpY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5kRHJhZyAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuYmVpbmdEcmFnZ2VkKSB7XG4gICAgICAgICAgICBhY3Rvci5vblN0b3BEcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbk1vdXNlTW92ZSAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5tb3VzZUxvY2F0aW9uID0ge3g6IGV2ZW50Lm9mZnNldFgsIHk6IGV2ZW50Lm9mZnNldFl9O1xuICAgIH1cbn1cblxuY2xhc3MgQ29sbGlzaW9uTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLnRpbGVTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX3RpbGVzID0gW107XG4gICAgfVxuXG4gICAgY29sbGlzaW9uc0F0ICh4LCB5KSB7XG4gICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKHgsIHkpO1xuICAgICAgICByZXR1cm4gdGlsZTtcbiAgICB9XG5cbiAgICBnZXRUaWxlICh4LCB5KSB7XG4gICAgICAgIHggPSAoeCAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHkgPSAoeSAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHJldHVybiB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gPSB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gfHwgW107XG4gICAgfVxuXG4gICAgdXBkYXRlICgpIHtcbiAgICAgICAgdGhpcy5hY3RvcnMuZmlsdGVyKChhKT0+IWEuY29sbGVjdCgpKTtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKGFjdG9yLngsIGFjdG9yLnkpO1xuICAgICAgICAgICAgdGlsZS5wdXNoKGFjdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtNZWRpYU1hbmFnZXJ9IGZyb20gJy4vY29tbW9uL21lZGlhTWFuYWdlci5qcydcblxubGV0IG1lZGlhID0gbmV3IE1lZGlhTWFuYWdlcigpO1xuXG5leHBvcnQgbGV0IHBpcGVTcHJpdGVzID0gbWVkaWEuZmV0Y2hTcHJpdGVTaGVldCgnLi9hc3NldHMvcGlwZXMucG5nJyxcbiAgICBbXG4gICAgICAgIHt4OjAsIHk6MCwgdzozMiwgaDozMiwgbmFtZTonZm91cldheSd9LFxuICAgICAgICB7eDozMSwgeTowLCB3Ojk2LCBoOjMyLCBuYW1lOidoTG9uZyd9LFxuICAgICAgICB7eDowLCB5OjMyLCB3OjMxLCBoOjk2LCBuYW1lOid2TG9uZyd9LFxuICAgICAgICB7eDo5NSwgeTozMiwgdzozMiwgaDozMiwgbmFtZTonaFNob3J0J30sXG4gICAgICAgIHt4Ojk1LCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOid2U2hvcnQnfSxcbiAgICAgICAge3g6MzEsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J3JkQmVuZCd9LFxuICAgICAgICB7eDo2MywgeTozMiwgdzozMSwgaDozMiwgbmFtZTonbGRCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidydUJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J2x1QmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonZFRlZSd9LFxuICAgICAgICB7eDozMSwgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3JUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOid1VGVlJ30sXG4gICAgICAgIHt4OjYzLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidsVGVlJ30sXG4gICAgXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QWN0b3J9IGZyb20gJy4vY29tbW9uL2FjdG9yLmpzJztcbmltcG9ydCB7cGlwZVNwcml0ZXN9IGZyb20gJy4vc3ByaXRlcy5qcyc7XG5pbXBvcnQge2JvYXJkUG9zfSBmcm9tICcuL2dhbWUuanMnO1xuXG5leHBvcnQgY2xhc3MgVGlsZSBleHRlbmRzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpO1xuICAgICAgICB0aGlzLndpZHRoID0gMzI7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gMzI7XG4gICAgICAgIHRoaXMueCA9IDMyXG4gICAgICAgIHRoaXMueSA9IDY0XG4gICAgICAgIHRoaXMuZHJhZ0hhbmRsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5sVGVlLCBwaXBlU3ByaXRlcy51VGVlLCBwaXBlU3ByaXRlcy5yVGVlLCBwaXBlU3ByaXRlcy5kVGVlXTtcbiAgICAgICAgdGhpcy5yb3QgPSAwO1xuICAgICAgICB0aGlzLm1vYmlsZSA9IHRydWVcbiAgICAgICAgdGhpcy5vbGRQb3MgPSB7eDogdGhpcy54LCB5OiB0aGlzLnl9XG4gICAgfVxuXG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBsZXQge2R0LCBjdHh9ID0geWllbGQ7XG4gICAgICAgICAgICB0aGlzLnNwcml0ZXNbdGhpcy5yb3RdLmRyYXcoY3R4LCB0aGlzLngsIHRoaXMueSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAqYmFzZUNvbnRyb2xTdGF0ZSAoKSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICB0aGlzLmRyYWdnaW5nICY9IHRoaXMud29ybGQuaXNEcmFnZ2luZztcbiAgICAgICAgICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICAgICAgICAgICAgbGV0IHt4LCB5fSA9IHRoaXMud29ybGQubW91c2VMb2NhdGlvbjtcbiAgICAgICAgICAgICAgICB0aGlzLnggPSB4ICsgdGhpcy5kcmFnSGFuZGxlLng7XG4gICAgICAgICAgICAgICAgdGhpcy55ID0geSArIHRoaXMuZHJhZ0hhbmRsZS55O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeWllbGQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblJpZ2h0Q2xpY2sgKCkge1xuICAgICAgICBpZiAodGhpcy5tb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMucm90ID0gKHRoaXMucm90ICsgMSkgJSB0aGlzLnNwcml0ZXMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TdGFydERyYWcgKCkge1xuICAgICAgICBpZiAodGhpcy5tb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IHggPSB0aGlzLnggLSB0aGlzLndvcmxkLm1vdXNlTG9jYXRpb24ueDtcbiAgICAgICAgICAgIGxldCB5ID0gdGhpcy55IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLnk7XG5cbiAgICAgICAgICAgIHRoaXMuZHJhZ0hhbmRsZSA9IHt4OngsIHk6eX07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0b3BEcmFnICgpIHtcbiAgICAgICAgaWYgKHRoaXMubW9iaWxlKSB7XG4gICAgICAgICAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnggPSByb3VuZFRvKHRoaXMueCAtIGJvYXJkUG9zLngsIDMyKSArIGJvYXJkUG9zLng7XG4gICAgICAgICAgICB0aGlzLnkgPSByb3VuZFRvKHRoaXMueSAtIGJvYXJkUG9zLnksIDMyKSArIGJvYXJkUG9zLnk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCwgdGhpcy55KS5maWx0ZXIoKGUpPT57ZSE9PXRoaXN9KS5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnYXNkZicpO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHRoaXMub2xkUG9zLnhcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB0aGlzLm9sZFBvcy55XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm9sZFBvcyA9IHt4OiB0aGlzLngsIHk6IHRoaXMueX1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRyYXdXYXRlciAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBjdHgubW92ZVRvKHRoaXMueCwgdGhpcy55KVxuICAgICAgICBjdHgubGluZVRvKHRoaXMueCwgdGhpcy55KzIwMClcbiAgICB9XG5cbiAgICBkcmF3V2F0ZXJOZXh0IChjdHgsIGZpbGxBbW91bnQsIHN0YXJ0KSB7XG4gICAgICAgIGxldCBuZXh0VGlsZVxuICAgICAgICBpZiAoc3RhcnQgPT09ICd3Jykge1xuICAgICAgICAgICAgbmV4dFRpbGUgPSB0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCszMiwgdGhpcy55KVswXVxuICAgICAgICB9XG4gICAgICAgIGlmIChuZXh0VGlsZSkge1xuICAgICAgICAgICAgbmV4dFRpbGUuZHJhd1dhdGVyKGN0eCwgZmlsbEFtb3VudC0xLCBzdGFydClcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlZVRpbGUgZXh0ZW5kcyBUaWxlIHt9XG5cbmV4cG9ydCBjbGFzcyBMb25nVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZywgcGlwZVNwcml0ZXMuaExvbmcsIHBpcGVTcHJpdGVzLnZMb25nXVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJlbmRUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMucnVCZW5kLCBwaXBlU3ByaXRlcy5sdUJlbmQsIHBpcGVTcHJpdGVzLmxkQmVuZCwgcGlwZVNwcml0ZXMucmRCZW5kXVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvdXJUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheV1cbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFNob3J0VGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmhTaG9ydCwgcGlwZVNwcml0ZXMudlNob3J0XVxuICAgIH1cblxuICAgIGRyYXdXYXRlciAoY3R4LCBmaWxsQW1vdW50LCBzdGFydCkge1xuICAgICAgICBpZiAodGhpcy5kcmFnZ2luZykgcmV0dXJuO1xuICAgICAgICBsZXQgZnVsbG5lc3MgPSBNYXRoLm1heChNYXRoLm1pbigzMiwgZmlsbEFtb3VudCozMiksIDApfDBcbiAgICAgICAgaWYgKHRoaXMucm90ID09PSAwKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHRoaXMueCwgdGhpcy55KzE2KVxuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLngrZnVsbG5lc3MsIHRoaXMueSsxNilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8odGhpcy54KzE2LCB0aGlzLnkpXG4gICAgICAgICAgICBjdHgubGluZVRvKHRoaXMueCsxNiwgdGhpcy55K2Z1bGxuZXNzKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZHJhd1dhdGVyTmV4dChjdHgsIGZpbGxBbW91bnQsICd3JylcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJvdW5kVG8gKHZhbCwgaW5jKSB7XG4gICAgbGV0IG9mZkJ5ID0gKHZhbCAlIGluYyk7XG4gICAgaWYgKG9mZkJ5IDw9IGluYyAvIDIpIHtcbiAgICAgICAgcmV0dXJuIHZhbCAtIG9mZkJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWwgKyBpbmMgLSBvZmZCeTtcbiAgICB9XG59XG4iXX0=
