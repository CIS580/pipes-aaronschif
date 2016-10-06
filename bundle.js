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
        this.startTile.x = boardPos.x;
        this.startTile.y = boardPos.y + (Math.random() * (boardPos.h / 32) | 0) * 32;
        this.endTile = new _tile.ShortTile(this);
        this.endTile.x = boardPos.x + boardPos.w - 32;
        this.endTile.y = boardPos.y + (Math.random() * (boardPos.h / 32) | 0) * 32;

        this.collisions.actors = [this.startTile, this.endTile];

        this.mouseLocation = { x: 0, y: 0 };
        this.beingDragged = [];

        this.score = 0;
        this.level = 1;
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
            let posTiles = [_tile.FourTile, _tile.TeeTile, _tile.ShortTile, _tile.ShortTile, _tile.BendTile, _tile.BendTile]; // LongTile
            let tile = posTiles[Math.random() * posTiles.length | 0];
            this.collisions.actors.push(new tile(this));
        }
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
        this.oldPos = {};
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
        this.rot = (this.rot + 1) % 4;
    }

    onStartDrag() {
        this.dragging = true;
        let x = this.x - this.world.mouseLocation.x;
        let y = this.y - this.world.mouseLocation.y;

        this.oldPos = { x: this.x, y: this.y };

        this.dragHandle = { x: x, y: y };
    }

    onStopDrag() {
        this.dragging = false;
        this.x = roundTo(this.x - _game.boardPos.x, 32) + _game.boardPos.x;
        this.y = roundTo(this.y - _game.boardPos.y, 32) + _game.boardPos.y;

        if (this.world.collisions.collisionsAt(this.x, this.y).length !== 0) {
            this.x = this.oldPos.x;
            this.y = this.oldPos.y;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixFQUFDLElBQUksRUFBTCxFQUF2QixDQUFWO0FBQ0EsWUFBSSxJQUFJLEtBQUosSUFBYSxJQUFqQixFQUF1QjtBQUNuQixpQkFBSyxZQUFMLEdBQW9CLElBQUksS0FBeEI7QUFDSCxTQUZELE1BRU8sSUFBSSxJQUFJLElBQVIsRUFBYztBQUNqQixpQkFBSyxZQUFMLEdBQW9CLEtBQUssZ0JBQUwsQ0FBc0IsSUFBdEIsQ0FBMkIsSUFBM0IsR0FBcEI7QUFDSDtBQUNKOztBQUVELFdBQU8sRUFBUCxFQUFXLEdBQVgsRUFBZ0I7QUFDWixZQUFJLE1BQU0sS0FBSyxXQUFMLENBQWlCLElBQWpCLENBQXNCLEVBQUMsSUFBSSxFQUFMLEVBQVMsS0FBSyxHQUFkLEVBQXRCLENBQVY7QUFDQSxZQUFJLElBQUksS0FBSixJQUFhLElBQWpCLEVBQXVCO0FBQ25CLGlCQUFLLFdBQUwsR0FBbUIsSUFBSSxLQUF2QjtBQUNILFNBRkQsTUFFTyxJQUFJLElBQUksSUFBUixFQUFjO0FBQ2pCLGlCQUFLLFdBQUwsR0FBbUIsS0FBSyxlQUFMLENBQXFCLElBQXJCLENBQTBCLElBQTFCLEdBQW5CO0FBQ0g7QUFDSjs7QUFFRCxLQUFDLGdCQUFELEdBQXFCLENBQUU7QUFDdkIsS0FBQyxlQUFELEdBQW9CLENBQUU7QUF6Q1A7UUFBTixLLEdBQUEsSzs7O0FDTGI7Ozs7O0FBR08sTUFBTSxhQUFOLENBQW9CO0FBQ3ZCLGtCQUFjO0FBQ1YsYUFBSyxNQUFMLEdBQWMsRUFBZDtBQUNIOztBQUVELHFCQUFpQixJQUFqQixFQUF1QixJQUF2QixFQUE2QjtBQUN6QixZQUFJLFNBQVMsS0FBSyxNQUFMLENBQVksSUFBWixLQUFxQixFQUFsQztBQUNBLGFBQUssTUFBTCxDQUFZLElBQVosSUFBb0IsTUFBcEI7O0FBRUEsZUFBTyxJQUFQLENBQVksSUFBWjtBQUNIOztBQUVELFNBQUssSUFBTCxFQUFXLElBQVgsRUFBaUI7QUFDYixZQUFJLFNBQVMsS0FBSyxNQUFMLENBQVksSUFBWixLQUFxQixFQUFsQztBQUNBLGFBQUssSUFBSSxFQUFULElBQWUsTUFBZixFQUF1QjtBQUNuQixlQUFHLElBQUg7QUFDSDtBQUNKO0FBakJzQjtRQUFkLGEsR0FBQSxhOzs7QUNIYjs7Ozs7QUFFQSxNQUFNLFdBQU4sQ0FBa0I7QUFDZCxnQkFBYSxFQUFDLEdBQUQsRUFBTSxDQUFOLEVBQVMsQ0FBVCxFQUFZLENBQVosRUFBZSxDQUFmLEVBQWIsRUFBZ0M7QUFDNUIsYUFBSyxHQUFMLEdBQVcsR0FBWDtBQUNBLGFBQUssQ0FBTCxHQUFTLENBQVQ7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxLQUFMLEdBQWEsQ0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLENBQWQ7QUFDSDs7QUFFRCxTQUFNLEdBQU4sRUFBVyxDQUFYLEVBQWMsQ0FBZCxFQUFpQixLQUFHLENBQXBCLEVBQXVCLEtBQUcsQ0FBMUIsRUFBNkI7QUFDekIsWUFBSSxTQUFKLENBQ0ksS0FBSyxHQURULEVBRUksS0FBSyxDQUZULEVBRVksS0FBSyxDQUZqQixFQUVvQixLQUFLLEtBRnpCLEVBRWdDLEtBQUssTUFGckMsRUFHSSxDQUhKLEVBR08sQ0FIUCxFQUdVLEtBQUssS0FBTCxHQUFXLEVBSHJCLEVBR3lCLEtBQUssTUFBTCxHQUFZLEVBSHJDO0FBS0g7QUFmYTs7QUFrQmxCLE1BQU0sV0FBTixDQUFrQjtBQUNkLGtCQUFlLENBRWQ7QUFIYTs7QUFNWCxNQUFNLFlBQU4sQ0FBbUI7QUFDdEIsa0JBQWUsQ0FFZDs7QUFFRCxxQkFBa0IsR0FBbEIsRUFBdUIsT0FBdkIsRUFBZ0M7QUFDNUIsWUFBSSxjQUFjLElBQUksS0FBSixFQUFsQjtBQUNBLG9CQUFZLEdBQVosR0FBa0IsR0FBbEI7O0FBRUEsWUFBSSxnQkFBZ0IsRUFBcEI7QUFDQSxhQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksUUFBUSxNQUE1QixFQUFvQyxHQUFwQyxFQUF5QztBQUNyQyxnQkFBSSxTQUFTLFFBQVEsQ0FBUixDQUFiO0FBQ0EsMEJBQWMsQ0FBZCxJQUFtQixJQUFJLFdBQUosQ0FDZjtBQUNJLHFCQUFLLFdBRFQ7QUFFSSxtQkFBRyxPQUFPLENBRmQ7QUFHSSxtQkFBRyxPQUFPLENBSGQ7QUFJSSxtQkFBRyxPQUFPLENBSmQ7QUFLSSxtQkFBRyxPQUFPO0FBTGQsYUFEZSxDQUFuQjtBQVFBLGdCQUFJLE9BQU8sSUFBWCxFQUFpQjtBQUNiLDhCQUFjLE9BQU8sSUFBckIsSUFBNkIsY0FBYyxDQUFkLENBQTdCO0FBQ0g7QUFDSjtBQUNELGVBQU8sYUFBUDtBQUNIO0FBekJxQjtRQUFiLFksR0FBQSxZOzs7QUMxQmI7Ozs7Ozs7QUFFQTs7QUFFTyxNQUFNLDhCQUFXO0FBQ3BCLE9BQUcsRUFEaUI7QUFFcEIsT0FBRyxFQUZpQjtBQUdwQixPQUFHLEdBSGlCO0FBSXBCLE9BQUc7QUFKaUIsQ0FBakI7O0FBT0EsTUFBTSxJQUFOLENBQVc7QUFDZCxnQkFBWSxNQUFaLEVBQW9CLFlBQXBCLEVBQWtDO0FBQzlCLGFBQUssWUFBTCxHQUFvQixZQUFwQjs7QUFFQTtBQUNBLGFBQUssTUFBTCxHQUFjLEtBQUssV0FBTCxHQUFtQixNQUFqQztBQUNBLGFBQUssUUFBTCxHQUFnQixPQUFPLFVBQVAsQ0FBa0IsSUFBbEIsQ0FBaEI7QUFDQSxhQUFLLFVBQUwsR0FBa0IsU0FBUyxhQUFULENBQXVCLFFBQXZCLENBQWxCO0FBQ0EsYUFBSyxVQUFMLENBQWdCLEtBQWhCLEdBQXdCLE9BQU8sS0FBL0I7QUFDQSxhQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsR0FBeUIsT0FBTyxNQUFoQztBQUNBLGFBQUssT0FBTCxHQUFlLEtBQUssVUFBTCxDQUFnQixVQUFoQixDQUEyQixJQUEzQixDQUFmOztBQUVBO0FBQ0EsYUFBSyxPQUFMLEdBQWUsWUFBWSxHQUFaLEVBQWY7QUFDQSxhQUFLLE1BQUwsR0FBYyxLQUFkOztBQUVBLGFBQUssTUFBTCxDQUFZLFdBQVosR0FBMEIsS0FBSyxXQUFMLENBQWlCLElBQWpCLENBQXNCLElBQXRCLENBQTFCO0FBQ0EsYUFBSyxNQUFMLENBQVksU0FBWixHQUF3QixLQUFLLFNBQUwsQ0FBZSxJQUFmLENBQW9CLElBQXBCLENBQXhCO0FBQ0EsYUFBSyxNQUFMLENBQVksV0FBWixHQUEwQixLQUFLLFdBQUwsQ0FBaUIsSUFBakIsQ0FBc0IsSUFBdEIsQ0FBMUI7QUFDQSxhQUFLLE1BQUwsQ0FBWSxhQUFaLEdBQTZCLENBQUQsSUFBSyxFQUFFLGNBQUYsRUFBakM7QUFDQSxhQUFLLFVBQUwsR0FBa0IsSUFBSSxnQkFBSixFQUFsQjs7QUFFQSxhQUFLLFNBQUwsR0FBaUIsb0JBQWMsSUFBZCxDQUFqQjtBQUNBLGFBQUssU0FBTCxDQUFlLENBQWYsR0FBbUIsU0FBUyxDQUE1QjtBQUNBLGFBQUssU0FBTCxDQUFlLENBQWYsR0FBbUIsU0FBUyxDQUFULEdBQWEsQ0FBRSxLQUFLLE1BQUwsTUFBZSxTQUFTLENBQVQsR0FBVyxFQUExQixDQUFELEdBQWdDLENBQWpDLElBQW9DLEVBQXBFO0FBQ0EsYUFBSyxPQUFMLEdBQWUsb0JBQWMsSUFBZCxDQUFmO0FBQ0EsYUFBSyxPQUFMLENBQWEsQ0FBYixHQUFpQixTQUFTLENBQVQsR0FBYSxTQUFTLENBQXRCLEdBQXdCLEVBQXpDO0FBQ0EsYUFBSyxPQUFMLENBQWEsQ0FBYixHQUFpQixTQUFTLENBQVQsR0FBYSxDQUFFLEtBQUssTUFBTCxNQUFlLFNBQVMsQ0FBVCxHQUFXLEVBQTFCLENBQUQsR0FBZ0MsQ0FBakMsSUFBb0MsRUFBbEU7O0FBRUEsYUFBSyxVQUFMLENBQWdCLE1BQWhCLEdBQXlCLENBQUMsS0FBSyxTQUFOLEVBQWlCLEtBQUssT0FBdEIsQ0FBekI7O0FBRUEsYUFBSyxhQUFMLEdBQXFCLEVBQUMsR0FBRyxDQUFKLEVBQU8sR0FBRyxDQUFWLEVBQXJCO0FBQ0EsYUFBSyxZQUFMLEdBQW9CLEVBQXBCOztBQUVBLGFBQUssS0FBTCxHQUFhLENBQWI7QUFDQSxhQUFLLEtBQUwsR0FBYSxDQUFiO0FBQ0g7O0FBRUQsVUFBTyxJQUFQLEVBQWE7QUFDVCxhQUFLLE1BQUwsR0FBZSxRQUFRLElBQXZCO0FBQ0g7O0FBRUQsU0FBTSxPQUFOLEVBQWU7QUFDWCxZQUFJLE9BQU8sSUFBWDtBQUNBLFlBQUksY0FBYyxVQUFVLEtBQUssT0FBakM7QUFDQSxhQUFLLE9BQUwsR0FBZSxPQUFmOztBQUVBLFlBQUcsQ0FBQyxLQUFLLE1BQVQsRUFBaUIsS0FBSyxNQUFMLENBQVksV0FBWjtBQUNqQixhQUFLLE1BQUwsQ0FBWSxXQUFaLEVBQXlCLEtBQUssUUFBOUI7O0FBRUE7QUFDQSxhQUFLLFFBQUwsQ0FBYyxTQUFkLENBQXdCLEtBQUssVUFBN0IsRUFBeUMsQ0FBekMsRUFBNEMsQ0FBNUM7QUFDSDs7QUFFRCxXQUFRLFdBQVIsRUFBcUIsR0FBckIsRUFBMEI7QUFDdEIsWUFBSSxTQUFTLEtBQUssTUFBbEI7O0FBRUEsWUFBSSxTQUFKLEdBQWdCLFNBQWhCO0FBQ0EsWUFBSSxRQUFKLENBQWEsQ0FBYixFQUFnQixDQUFoQixFQUFtQixPQUFPLEtBQTFCLEVBQWlDLE9BQU8sTUFBeEM7QUFDQSxZQUFJLFNBQUo7QUFDQSxhQUFLLElBQUksSUFBRSxTQUFTLENBQXBCLEVBQXVCLEtBQUcsU0FBUyxDQUFULEdBQVcsU0FBUyxDQUE5QyxFQUFpRCxLQUFHLEVBQXBELEVBQXdEO0FBQ3BELGdCQUFJLE1BQUosQ0FBVyxDQUFYLEVBQWMsU0FBUyxDQUF2QjtBQUNBLGdCQUFJLE1BQUosQ0FBVyxDQUFYLEVBQWMsU0FBUyxDQUFULEdBQVcsU0FBUyxDQUFsQztBQUNIO0FBQ0QsYUFBSyxJQUFJLElBQUUsU0FBUyxDQUFwQixFQUF1QixLQUFHLFNBQVMsQ0FBVCxHQUFXLFNBQVMsQ0FBOUMsRUFBaUQsS0FBRyxFQUFwRCxFQUF3RDtBQUNwRCxnQkFBSSxNQUFKLENBQVcsU0FBUyxDQUFwQixFQUF1QixDQUF2QjtBQUNBLGdCQUFJLE1BQUosQ0FBVyxTQUFTLENBQVQsR0FBVyxTQUFTLENBQS9CLEVBQWtDLENBQWxDO0FBQ0g7QUFDRCxZQUFJLFdBQUosR0FBa0IsTUFBbEI7QUFDQSxZQUFJLFNBQUosR0FBZ0IsQ0FBaEI7QUFDQSxZQUFJLE1BQUo7O0FBRUEsYUFBSyxJQUFJLEtBQVQsSUFBa0IsS0FBSyxVQUFMLENBQWdCLE1BQWxDLEVBQTBDO0FBQ3RDLGtCQUFNLE1BQU4sQ0FBYSxXQUFiLEVBQTBCLEdBQTFCO0FBQ0g7O0FBRUQsWUFBSSxTQUFKLEdBQWdCLE9BQWhCO0FBQ0EsWUFBSSxJQUFKLEdBQVcsWUFBWDtBQUNBLFlBQUksUUFBSixDQUFjLFVBQVEsS0FBSyxLQUFNLEdBQWpDLEVBQW9DLEVBQXBDLEVBQXdDLEdBQXhDO0FBQ0EsWUFBSSxRQUFKLENBQWMsSUFBRSxLQUFLLEtBQU0sVUFBM0IsRUFBcUMsRUFBckMsRUFBeUMsR0FBekM7QUFDSDs7QUFFRCxXQUFRLFdBQVIsRUFBcUI7QUFDakIsYUFBSyxVQUFMLENBQWdCLE1BQWhCO0FBQ0EsYUFBSyxJQUFJLEtBQVQsSUFBa0IsS0FBSyxVQUFMLENBQWdCLE1BQWxDLEVBQTBDO0FBQ3RDLGtCQUFNLE1BQU4sQ0FBYSxXQUFiO0FBQ0g7QUFDRCxZQUFJLENBQUMsS0FBSyxVQUFOLElBQW9CLEtBQUssVUFBTCxDQUFnQixZQUFoQixDQUE2QixFQUE3QixFQUFpQyxFQUFqQyxFQUFxQyxNQUFyQyxLQUFnRCxDQUF4RSxFQUEyRTtBQUN2RSxnQkFBSSxXQUFXLGlHQUFmLENBRHVFLENBQ007QUFDN0UsZ0JBQUksT0FBTyxTQUFTLEtBQUssTUFBTCxLQUFjLFNBQVMsTUFBdkIsR0FBOEIsQ0FBdkMsQ0FBWDtBQUNBLGlCQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsQ0FBdUIsSUFBdkIsQ0FBNEIsSUFBSSxJQUFKLENBQVMsSUFBVCxDQUE1QjtBQUNIO0FBQ0o7O0FBRUQsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixnQkFBUSxHQUFSLENBQVksS0FBWjtBQUNBLFlBQUksTUFBTSxPQUFOLEdBQWdCLENBQXBCLEVBQXVCO0FBQ25CLGlCQUFLLFVBQUwsR0FBa0IsSUFBbEI7QUFDQSxnQkFBSSxTQUFTLEtBQUssVUFBTCxDQUFnQixZQUFoQixDQUE2QixLQUFLLGFBQUwsQ0FBbUIsQ0FBaEQsRUFBbUQsS0FBSyxhQUFMLENBQW1CLENBQXRFLENBQWI7QUFDQSxpQkFBSyxZQUFMLEdBQW9CLE1BQXBCO0FBQ0EsaUJBQUssSUFBSSxLQUFULElBQWtCLE1BQWxCLEVBQTBCO0FBQ3RCLHNCQUFNLFdBQU47QUFDSDtBQUNKO0FBQ0QsWUFBSSxNQUFNLE9BQU4sR0FBZ0IsQ0FBcEIsRUFBdUI7QUFDbkIsZ0JBQUksU0FBUyxLQUFLLFVBQUwsQ0FBZ0IsWUFBaEIsQ0FBNkIsS0FBSyxhQUFMLENBQW1CLENBQWhELEVBQW1ELEtBQUssYUFBTCxDQUFtQixDQUF0RSxDQUFiO0FBQ0EsaUJBQUssSUFBSSxLQUFULElBQWtCLE1BQWxCLEVBQTBCO0FBQ3RCLHNCQUFNLFlBQU47QUFDSDtBQUNKO0FBQ0o7O0FBRUQsY0FBVyxLQUFYLEVBQWtCO0FBQ2QsYUFBSyxVQUFMLEdBQWtCLEtBQWxCO0FBQ0EsYUFBSyxJQUFJLEtBQVQsSUFBa0IsS0FBSyxZQUF2QixFQUFxQztBQUNqQyxrQkFBTSxVQUFOO0FBQ0g7QUFDSjs7QUFFRCxnQkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGFBQUssYUFBTCxHQUFxQixFQUFDLEdBQUcsTUFBTSxPQUFWLEVBQW1CLEdBQUcsTUFBTSxPQUE1QixFQUFyQjtBQUNIO0FBekhhOztRQUFMLEksR0FBQSxJO0FBNEhiLE1BQU0sZ0JBQU4sQ0FBdUI7QUFDbkIsa0JBQWU7QUFDWCxhQUFLLE1BQUwsR0FBYyxFQUFkO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsYUFBSyxNQUFMLEdBQWMsRUFBZDtBQUNIOztBQUVELGlCQUFjLENBQWQsRUFBaUIsQ0FBakIsRUFBb0I7QUFDaEIsWUFBSSxPQUFPLEtBQUssT0FBTCxDQUFhLENBQWIsRUFBZ0IsQ0FBaEIsQ0FBWDtBQUNBLGVBQU8sSUFBUDtBQUNIOztBQUVELFlBQVMsQ0FBVCxFQUFZLENBQVosRUFBZTtBQUNYLFlBQUssSUFBSSxLQUFLLFFBQVYsR0FBb0IsQ0FBeEI7QUFDQSxZQUFLLElBQUksS0FBSyxRQUFWLEdBQW9CLENBQXhCO0FBQ0EsZUFBTyxLQUFLLE1BQUwsQ0FBYSxJQUFFLENBQUUsTUFBRyxDQUFFLEdBQXRCLElBQTJCLEtBQUssTUFBTCxDQUFhLElBQUUsQ0FBRSxNQUFHLENBQUUsR0FBdEIsS0FBNEIsRUFBOUQ7QUFDSDs7QUFFRCxhQUFVO0FBQ04sYUFBSyxNQUFMLENBQVksTUFBWixDQUFvQixDQUFELElBQUssQ0FBQyxFQUFFLE9BQUYsRUFBekI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkO0FBQ0EsYUFBSyxJQUFJLEtBQVQsSUFBa0IsS0FBSyxNQUF2QixFQUErQjtBQUMzQixnQkFBSSxPQUFPLEtBQUssT0FBTCxDQUFhLE1BQU0sQ0FBbkIsRUFBc0IsTUFBTSxDQUE1QixDQUFYO0FBQ0EsaUJBQUssSUFBTCxDQUFVLEtBQVY7QUFDSDtBQUNKO0FBekJrQjs7O0FDdkl2Qjs7Ozs7OztBQUVBOztBQUVBLElBQUksUUFBUSxnQ0FBWjs7QUFFTyxJQUFJLG9DQUFjLE1BQU0sZ0JBQU4sQ0FBdUIsb0JBQXZCLEVBQ3JCLENBQ0ksRUFBQyxHQUFFLENBQUgsRUFBTSxHQUFFLENBQVIsRUFBVyxHQUFFLEVBQWIsRUFBaUIsR0FBRSxFQUFuQixFQUF1QixNQUFLLFNBQTVCLEVBREosRUFFSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsQ0FBVCxFQUFZLEdBQUUsRUFBZCxFQUFrQixHQUFFLEVBQXBCLEVBQXdCLE1BQUssT0FBN0IsRUFGSixFQUdJLEVBQUMsR0FBRSxDQUFILEVBQU0sR0FBRSxFQUFSLEVBQVksR0FBRSxFQUFkLEVBQWtCLEdBQUUsRUFBcEIsRUFBd0IsTUFBSyxPQUE3QixFQUhKLEVBSUksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEVBQVQsRUFBYSxHQUFFLEVBQWYsRUFBbUIsR0FBRSxFQUFyQixFQUF5QixNQUFLLFFBQTlCLEVBSkosRUFLSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsRUFBVCxFQUFhLEdBQUUsRUFBZixFQUFtQixHQUFFLEVBQXJCLEVBQXlCLE1BQUssUUFBOUIsRUFMSixFQU1JLEVBQUMsR0FBRSxFQUFILEVBQU8sR0FBRSxFQUFULEVBQWEsR0FBRSxFQUFmLEVBQW1CLEdBQUUsRUFBckIsRUFBeUIsTUFBSyxRQUE5QixFQU5KLEVBT0ksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEVBQVQsRUFBYSxHQUFFLEVBQWYsRUFBbUIsR0FBRSxFQUFyQixFQUF5QixNQUFLLFFBQTlCLEVBUEosRUFRSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsRUFBVCxFQUFhLEdBQUUsRUFBZixFQUFtQixHQUFFLEVBQXJCLEVBQXlCLE1BQUssUUFBOUIsRUFSSixFQVNJLEVBQUMsR0FBRSxFQUFILEVBQU8sR0FBRSxFQUFULEVBQWEsR0FBRSxFQUFmLEVBQW1CLEdBQUUsRUFBckIsRUFBeUIsTUFBSyxRQUE5QixFQVRKLEVBVUksRUFBQyxHQUFFLEVBQUgsRUFBTyxHQUFFLEVBQVQsRUFBYSxHQUFFLEVBQWYsRUFBbUIsR0FBRSxFQUFyQixFQUF5QixNQUFLLE1BQTlCLEVBVkosRUFXSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsR0FBVCxFQUFjLEdBQUUsRUFBaEIsRUFBb0IsR0FBRSxFQUF0QixFQUEwQixNQUFLLE1BQS9CLEVBWEosRUFZSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsR0FBVCxFQUFjLEdBQUUsRUFBaEIsRUFBb0IsR0FBRSxFQUF0QixFQUEwQixNQUFLLE1BQS9CLEVBWkosRUFhSSxFQUFDLEdBQUUsRUFBSCxFQUFPLEdBQUUsRUFBVCxFQUFhLEdBQUUsRUFBZixFQUFtQixHQUFFLEVBQXJCLEVBQXlCLE1BQUssTUFBOUIsRUFiSixDQURxQixDQUFsQjs7O0FDTlA7Ozs7Ozs7QUFFQTs7QUFDQTs7QUFDQTs7QUFFTyxNQUFNLElBQU4sc0JBQXlCO0FBQzVCLGdCQUFhLEtBQWIsRUFBb0I7QUFDaEIsY0FBTSxLQUFOO0FBQ0EsYUFBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7QUFDQSxhQUFLLENBQUwsR0FBUyxFQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsRUFBVDtBQUNBLGFBQUssVUFBTCxHQUFrQixJQUFsQjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksSUFBYixFQUFtQixxQkFBWSxJQUEvQixFQUFxQyxxQkFBWSxJQUFqRCxFQUF1RCxxQkFBWSxJQUFuRSxDQUFmO0FBQ0EsYUFBSyxHQUFMLEdBQVcsQ0FBWDtBQUNBLGFBQUssTUFBTCxHQUFjLEVBQWQ7QUFDSDs7QUFFRCxLQUFDLGVBQUQsR0FBb0I7QUFDaEIsZUFBTyxJQUFQLEVBQWE7QUFDVCxnQkFBSSxFQUFDLEVBQUQsRUFBSyxHQUFMLEtBQVksS0FBaEI7QUFDQSxpQkFBSyxPQUFMLENBQWEsS0FBSyxHQUFsQixFQUF1QixJQUF2QixDQUE0QixHQUE1QixFQUFpQyxLQUFLLENBQXRDLEVBQXlDLEtBQUssQ0FBOUM7QUFDSDtBQUNKOztBQUVELEtBQUMsZ0JBQUQsR0FBcUI7QUFDakIsZUFBTyxJQUFQLEVBQWE7QUFDVCxpQkFBSyxRQUFMLElBQWlCLEtBQUssS0FBTCxDQUFXLFVBQTVCO0FBQ0EsZ0JBQUksS0FBSyxRQUFULEVBQW1CO0FBQ2Ysb0JBQUksRUFBQyxDQUFELEVBQUksQ0FBSixLQUFTLEtBQUssS0FBTCxDQUFXLGFBQXhCO0FBQ0EscUJBQUssQ0FBTCxHQUFTLElBQUksS0FBSyxVQUFMLENBQWdCLENBQTdCO0FBQ0EscUJBQUssQ0FBTCxHQUFTLElBQUksS0FBSyxVQUFMLENBQWdCLENBQTdCO0FBQ0g7QUFDRDtBQUNIO0FBQ0o7O0FBRUQsbUJBQWdCO0FBQ1osYUFBSyxHQUFMLEdBQVcsQ0FBQyxLQUFLLEdBQUwsR0FBVyxDQUFaLElBQWlCLENBQTVCO0FBQ0g7O0FBRUQsa0JBQWU7QUFDWCxhQUFLLFFBQUwsR0FBZ0IsSUFBaEI7QUFDQSxZQUFJLElBQUksS0FBSyxDQUFMLEdBQVMsS0FBSyxLQUFMLENBQVcsYUFBWCxDQUF5QixDQUExQztBQUNBLFlBQUksSUFBSSxLQUFLLENBQUwsR0FBUyxLQUFLLEtBQUwsQ0FBVyxhQUFYLENBQXlCLENBQTFDOztBQUVBLGFBQUssTUFBTCxHQUFjLEVBQUMsR0FBRyxLQUFLLENBQVQsRUFBWSxHQUFHLEtBQUssQ0FBcEIsRUFBZDs7QUFFQSxhQUFLLFVBQUwsR0FBa0IsRUFBQyxHQUFFLENBQUgsRUFBTSxHQUFFLENBQVIsRUFBbEI7QUFDSDs7QUFFRCxpQkFBYztBQUNWLGFBQUssUUFBTCxHQUFnQixLQUFoQjtBQUNBLGFBQUssQ0FBTCxHQUFTLFFBQVEsS0FBSyxDQUFMLEdBQVMsZUFBUyxDQUExQixFQUE2QixFQUE3QixJQUFtQyxlQUFTLENBQXJEO0FBQ0EsYUFBSyxDQUFMLEdBQVMsUUFBUSxLQUFLLENBQUwsR0FBUyxlQUFTLENBQTFCLEVBQTZCLEVBQTdCLElBQW1DLGVBQVMsQ0FBckQ7O0FBRUEsWUFBSSxLQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLFlBQXRCLENBQW1DLEtBQUssQ0FBeEMsRUFBMkMsS0FBSyxDQUFoRCxFQUFtRCxNQUFuRCxLQUE4RCxDQUFsRSxFQUFxRTtBQUNqRSxpQkFBSyxDQUFMLEdBQVMsS0FBSyxNQUFMLENBQVksQ0FBckI7QUFDQSxpQkFBSyxDQUFMLEdBQVMsS0FBSyxNQUFMLENBQVksQ0FBckI7QUFDSDtBQUNKO0FBdkQyQjs7UUFBbkIsSSxHQUFBLEk7QUEwRE4sTUFBTSxPQUFOLFNBQXNCLElBQXRCLENBQTJCOztRQUFyQixPLEdBQUEsTztBQUVOLE1BQU0sUUFBTixTQUF1QixJQUF2QixDQUE0QjtBQUMvQixnQkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGNBQU0sS0FBTjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksS0FBYixFQUFvQixxQkFBWSxLQUFoQyxFQUF1QyxxQkFBWSxLQUFuRCxFQUEwRCxxQkFBWSxLQUF0RSxDQUFmO0FBQ0g7QUFKOEI7O1FBQXRCLFEsR0FBQSxRO0FBT04sTUFBTSxRQUFOLFNBQXVCLElBQXZCLENBQTRCO0FBQy9CLGdCQUFhLEtBQWIsRUFBb0I7QUFDaEIsY0FBTSxLQUFOO0FBQ0EsYUFBSyxPQUFMLEdBQWUsQ0FBQyxxQkFBWSxNQUFiLEVBQXFCLHFCQUFZLE1BQWpDLEVBQXlDLHFCQUFZLE1BQXJELEVBQTZELHFCQUFZLE1BQXpFLENBQWY7QUFDSDtBQUo4Qjs7UUFBdEIsUSxHQUFBLFE7QUFPTixNQUFNLFFBQU4sU0FBdUIsSUFBdkIsQ0FBNEI7QUFDL0IsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixjQUFNLEtBQU47QUFDQSxhQUFLLE9BQUwsR0FBZSxDQUFDLHFCQUFZLE9BQWIsRUFBc0IscUJBQVksT0FBbEMsRUFBMkMscUJBQVksT0FBdkQsRUFBZ0UscUJBQVksT0FBNUUsQ0FBZjtBQUNIO0FBSjhCOztRQUF0QixRLEdBQUEsUTtBQVFOLE1BQU0sU0FBTixTQUF3QixJQUF4QixDQUE2QjtBQUNoQyxnQkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGNBQU0sS0FBTjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksTUFBYixFQUFxQixxQkFBWSxNQUFqQyxDQUFmO0FBQ0g7QUFKK0I7O1FBQXZCLFMsR0FBQSxTO0FBT2IsU0FBUyxPQUFULENBQWtCLEdBQWxCLEVBQXVCLEdBQXZCLEVBQTRCO0FBQ3hCLFFBQUksUUFBUyxNQUFNLEdBQW5CO0FBQ0EsUUFBSSxTQUFTLE1BQU0sQ0FBbkIsRUFBc0I7QUFDbEIsZUFBTyxNQUFNLEtBQWI7QUFDSCxLQUZELE1BRU87QUFDSCxlQUFPLE1BQU0sR0FBTixHQUFZLEtBQW5CO0FBQ0g7QUFDSiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7R2FtZX0gZnJvbSAnLi9nYW1lJztcblxudmFyIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JlZW4nKTtcbnZhciBnYW1lID0gbmV3IEdhbWUoY2FudmFzKTtcblxuXG52YXIgbWFzdGVyTG9vcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICBnYW1lLmxvb3AodGltZXN0YW1wKTtcbiAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShtYXN0ZXJMb29wKTtcbn1cbm1hc3Rlckxvb3AocGVyZm9ybWFuY2Uubm93KCkpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7RXZlbnRMaXN0ZW5lcn0gZnJvbSBcIi4vZXZlbnRzLmpzXCI7XG5cblxuZXhwb3J0IGNsYXNzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IG5ldyBFdmVudExpc3RlbmVyKCk7XG5cbiAgICAgICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgICAgICB0aGlzLnggPSAwO1xuICAgICAgICB0aGlzLnkgPSAwO1xuICAgICAgICB0aGlzLndpZHRoID0gNjQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gNjQ7XG5cbiAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSB0aGlzLmJhc2VDb250cm9sU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgIH1cblxuICAgIGdldEhpdEJveGVzKCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29sbGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5jb250cm9sU3RhdGUubmV4dCh7ZHQ6IGR0fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSBjdXIudmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihkdCwgY3R4KSB7XG4gICAgICAgIGxldCBjdXIgPSB0aGlzLnJlbmRlclN0YXRlLm5leHQoe2R0OiBkdCwgY3R4OiBjdHh9KTtcbiAgICAgICAgaWYgKGN1ci52YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge31cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHt9XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuXG5leHBvcnQgY2xhc3MgRXZlbnRMaXN0ZW5lciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBmdW5jKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSBldmVudHM7XG5cbiAgICAgICAgZXZlbnRzLnB1c2goZnVuYyk7XG4gICAgfVxuXG4gICAgZW1pdChuYW1lLCBhcmdzKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgZm9yIChsZXQgZXYgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgICBldihhcmdzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY2xhc3MgSW1hZ2VIYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICh7aW1nLCB4LCB5LCB3LCBofSkge1xuICAgICAgICB0aGlzLmltZyA9IGltZztcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgdGhpcy53aWR0aCA9IHc7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gaDtcbiAgICB9XG5cbiAgICBkcmF3IChjdHgsIHgsIHksIHN4PTEsIHN5PTEpIHtcbiAgICAgICAgY3R4LmRyYXdJbWFnZShcbiAgICAgICAgICAgIHRoaXMuaW1nLFxuICAgICAgICAgICAgdGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LFxuICAgICAgICAgICAgeCwgeSwgdGhpcy53aWR0aCpzeCwgdGhpcy5oZWlnaHQqc3lcbiAgICAgICAgKVxuICAgIH1cbn1cblxuY2xhc3MgQXVkaW9IYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lZGlhTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuXG4gICAgfVxuXG4gICAgZmV0Y2hTcHJpdGVTaGVldCAodXJsLCBzcHJpdGVzKSB7XG4gICAgICAgIGxldCBzcHJpdGVTaGVldCA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBzcHJpdGVTaGVldC5zcmMgPSB1cmw7XG5cbiAgICAgICAgbGV0IHNwcml0ZUhhbmRsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcHJpdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgc3ByaXRlID0gc3ByaXRlc1tpXTtcbiAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbaV0gPSBuZXcgSW1hZ2VIYW5kbGUoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbWc6IHNwcml0ZVNoZWV0LFxuICAgICAgICAgICAgICAgICAgICB4OiBzcHJpdGUueCxcbiAgICAgICAgICAgICAgICAgICAgeTogc3ByaXRlLnksXG4gICAgICAgICAgICAgICAgICAgIHc6IHNwcml0ZS53LFxuICAgICAgICAgICAgICAgICAgICBoOiBzcHJpdGUuaCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKHNwcml0ZS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgc3ByaXRlSGFuZGxlc1tzcHJpdGUubmFtZV0gPSBzcHJpdGVIYW5kbGVzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzcHJpdGVIYW5kbGVzO1xuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtCZW5kVGlsZSwgRm91clRpbGUsIFNob3J0VGlsZSwgVGVlVGlsZSwgTG9uZ1RpbGV9IGZyb20gJy4vdGlsZSc7XG5cbmV4cG9ydCBjb25zdCBib2FyZFBvcyA9IHtcbiAgICB4OiA5NixcbiAgICB5OiAzMixcbiAgICB3OiA4OTYsXG4gICAgaDogNTEyLFxufVxuXG5leHBvcnQgY2xhc3MgR2FtZSB7XG4gICAgY29uc3RydWN0b3Ioc2NyZWVuLCBtZWRpYU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tZWRpYU1hbmFnZXIgPSBtZWRpYU1hbmFnZXI7XG5cbiAgICAgICAgLy8gU2V0IHVwIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy5jYW52YXMgPSB0aGlzLmZyb250QnVmZmVyID0gc2NyZWVuO1xuICAgICAgICB0aGlzLmZyb250Q3R4ID0gc2NyZWVuLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIud2lkdGggPSBzY3JlZW4ud2lkdGg7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlci5oZWlnaHQgPSBzY3JlZW4uaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhY2tDdHggPSB0aGlzLmJhY2tCdWZmZXIuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgICAgICAvLyBTdGFydCB0aGUgZ2FtZSBsb29wXG4gICAgICAgIHRoaXMub2xkVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLm9ubW91c2Vkb3duID0gdGhpcy5vblN0YXJ0RHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNldXAgPSB0aGlzLm9uRW5kRHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlbW92ZSA9IHRoaXMub25Nb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25jb250ZXh0bWVudSA9IChlKT0+ZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMgPSBuZXcgQ29sbGlzaW9uTWFuYWdlcigpO1xuXG4gICAgICAgIHRoaXMuc3RhcnRUaWxlID0gbmV3IFNob3J0VGlsZSh0aGlzKVxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS54ID0gYm9hcmRQb3MueFxuICAgICAgICB0aGlzLnN0YXJ0VGlsZS55ID0gYm9hcmRQb3MueSArICgoTWF0aC5yYW5kb20oKSooYm9hcmRQb3MuaC8zMikpfDApKjMyXG4gICAgICAgIHRoaXMuZW5kVGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5lbmRUaWxlLnggPSBib2FyZFBvcy54ICsgYm9hcmRQb3Mudy0zMlxuICAgICAgICB0aGlzLmVuZFRpbGUueSA9IGJvYXJkUG9zLnkgKyAoKE1hdGgucmFuZG9tKCkqKGJvYXJkUG9zLmgvMzIpKXwwKSozMlxuXG4gICAgICAgIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMgPSBbdGhpcy5zdGFydFRpbGUsIHRoaXMuZW5kVGlsZV07XG5cbiAgICAgICAgdGhpcy5tb3VzZUxvY2F0aW9uID0ge3g6IDAsIHk6IDB9O1xuICAgICAgICB0aGlzLmJlaW5nRHJhZ2dlZCA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NvcmUgPSAwXG4gICAgICAgIHRoaXMubGV2ZWwgPSAxXG4gICAgfVxuXG4gICAgcGF1c2UgKGZsYWcpIHtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSAoZmxhZyA9PSB0cnVlKTtcbiAgICB9XG5cbiAgICBsb29wIChuZXdUaW1lKSB7XG4gICAgICAgIHZhciBnYW1lID0gdGhpcztcbiAgICAgICAgdmFyIGVsYXBzZWRUaW1lID0gbmV3VGltZSAtIHRoaXMub2xkVGltZTtcbiAgICAgICAgdGhpcy5vbGRUaW1lID0gbmV3VGltZTtcblxuICAgICAgICBpZighdGhpcy5wYXVzZWQpIHRoaXMudXBkYXRlKGVsYXBzZWRUaW1lKTtcbiAgICAgICAgdGhpcy5yZW5kZXIoZWxhcHNlZFRpbWUsIHRoaXMuZnJvbnRDdHgpO1xuXG4gICAgICAgIC8vIEZsaXAgdGhlIGJhY2sgYnVmZmVyXG4gICAgICAgIHRoaXMuZnJvbnRDdHguZHJhd0ltYWdlKHRoaXMuYmFja0J1ZmZlciwgMCwgMCk7XG4gICAgfVxuXG4gICAgcmVuZGVyIChlbGFwc2VkVGltZSwgY3R4KSB7XG4gICAgICAgIGxldCBjYW52YXMgPSB0aGlzLmNhbnZhcztcblxuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCIjNzc3Nzc3XCI7XG4gICAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGZvciAobGV0IHg9Ym9hcmRQb3MueDsgeDw9Ym9hcmRQb3MueCtib2FyZFBvcy53OyB4Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh4LCBib2FyZFBvcy55KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oeCwgYm9hcmRQb3MueStib2FyZFBvcy5oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCB5PWJvYXJkUG9zLnk7IHk8PWJvYXJkUG9zLnkrYm9hcmRQb3MuaDsgeSs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oYm9hcmRQb3MueCwgeSk7XG4gICAgICAgICAgICBjdHgubGluZVRvKGJvYXJkUG9zLngrYm9hcmRQb3MudywgeSk7XG4gICAgICAgIH1cbiAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJ2dyZXknO1xuICAgICAgICBjdHgubGluZVdpZHRoID0gMjtcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSAnd2hpdGUnXG4gICAgICAgIGN0eC5mb250ID0gXCIxMnB4IHNlcmlmXCJcbiAgICAgICAgY3R4LmZpbGxUZXh0KGBsZXZlbCAke3RoaXMubGV2ZWx9YCwgMTAsIDUwMClcbiAgICAgICAgY3R4LmZpbGxUZXh0KGAke3RoaXMuc2NvcmV9IHBvaW50c2AsIDEwLCA1MjApXG4gICAgfVxuXG4gICAgdXBkYXRlIChlbGFwc2VkVGltZSkge1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMudXBkYXRlKCk7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmlzRHJhZ2dpbmcgJiYgdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCgzMiwgNjQpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGV0IHBvc1RpbGVzID0gW0ZvdXJUaWxlLCBUZWVUaWxlLCBTaG9ydFRpbGUsIFNob3J0VGlsZSwgQmVuZFRpbGUsIEJlbmRUaWxlXSAvLyBMb25nVGlsZVxuICAgICAgICAgICAgbGV0IHRpbGUgPSBwb3NUaWxlc1tNYXRoLnJhbmRvbSgpKnBvc1RpbGVzLmxlbmd0aHwwXVxuICAgICAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycy5wdXNoKG5ldyB0aWxlKHRoaXMpKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TdGFydERyYWcgKGV2ZW50KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGV2ZW50KVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDEpIHtcbiAgICAgICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICBsZXQgYWN0b3JzID0gdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLm1vdXNlTG9jYXRpb24ueCwgdGhpcy5tb3VzZUxvY2F0aW9uLnkpO1xuICAgICAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBhY3RvcnM7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblN0YXJ0RHJhZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudC5idXR0b25zICYgMikge1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIGZvciAobGV0IGFjdG9yIG9mIGFjdG9ycykge1xuICAgICAgICAgICAgICAgIGFjdG9yLm9uUmlnaHRDbGljaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmREcmFnIChldmVudCkge1xuICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5iZWluZ0RyYWdnZWQpIHtcbiAgICAgICAgICAgIGFjdG9yLm9uU3RvcERyYWcoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTW91c2VNb3ZlIChldmVudCkge1xuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogZXZlbnQub2Zmc2V0WCwgeTogZXZlbnQub2Zmc2V0WX07XG4gICAgfVxufVxuXG5jbGFzcyBDb2xsaXNpb25NYW5hZ2VyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuYWN0b3JzID0gW107XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSAzMjtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSBbXTtcbiAgICB9XG5cbiAgICBjb2xsaXNpb25zQXQgKHgsIHkpIHtcbiAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoeCwgeSk7XG4gICAgICAgIHJldHVybiB0aWxlO1xuICAgIH1cblxuICAgIGdldFRpbGUgKHgsIHkpIHtcbiAgICAgICAgeCA9ICh4IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgeSA9ICh5IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSA9IHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSB8fCBbXTtcbiAgICB9XG5cbiAgICB1cGRhdGUgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycy5maWx0ZXIoKGEpPT4hYS5jb2xsZWN0KCkpO1xuICAgICAgICB0aGlzLl90aWxlcyA9IHt9O1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmFjdG9ycykge1xuICAgICAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoYWN0b3IueCwgYWN0b3IueSk7XG4gICAgICAgICAgICB0aWxlLnB1c2goYWN0b3IpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge01lZGlhTWFuYWdlcn0gZnJvbSAnLi9jb21tb24vbWVkaWFNYW5hZ2VyLmpzJ1xuXG5sZXQgbWVkaWEgPSBuZXcgTWVkaWFNYW5hZ2VyKCk7XG5cbmV4cG9ydCBsZXQgcGlwZVNwcml0ZXMgPSBtZWRpYS5mZXRjaFNwcml0ZVNoZWV0KCcuL2Fzc2V0cy9waXBlcy5wbmcnLFxuICAgIFtcbiAgICAgICAge3g6MCwgeTowLCB3OjMyLCBoOjMyLCBuYW1lOidmb3VyV2F5J30sXG4gICAgICAgIHt4OjMxLCB5OjAsIHc6OTYsIGg6MzIsIG5hbWU6J2hMb25nJ30sXG4gICAgICAgIHt4OjAsIHk6MzIsIHc6MzEsIGg6OTYsIG5hbWU6J3ZMb25nJ30sXG4gICAgICAgIHt4Ojk1LCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidoU2hvcnQnfSxcbiAgICAgICAge3g6OTUsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3ZTaG9ydCd9LFxuICAgICAgICB7eDozMSwgeTozMiwgdzozMiwgaDozMiwgbmFtZToncmRCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjMyLCB3OjMxLCBoOjMyLCBuYW1lOidsZEJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3J1QmVuZCd9LFxuICAgICAgICB7eDo2MywgeTo2NCwgdzozMiwgaDozMiwgbmFtZTonbHVCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidkVGVlJ30sXG4gICAgICAgIHt4OjMxLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTonclRlZSd9LFxuICAgICAgICB7eDo2MywgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3VUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2xUZWUnfSxcbiAgICBdKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtBY3Rvcn0gZnJvbSAnLi9jb21tb24vYWN0b3IuanMnO1xuaW1wb3J0IHtwaXBlU3ByaXRlc30gZnJvbSAnLi9zcHJpdGVzLmpzJztcbmltcG9ydCB7Ym9hcmRQb3N9IGZyb20gJy4vZ2FtZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUaWxlIGV4dGVuZHMgQWN0b3Ige1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZCk7XG4gICAgICAgIHRoaXMud2lkdGggPSAzMjtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAzMjtcbiAgICAgICAgdGhpcy54ID0gMzJcbiAgICAgICAgdGhpcy55ID0gNjRcbiAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmxUZWUsIHBpcGVTcHJpdGVzLnVUZWUsIHBpcGVTcHJpdGVzLnJUZWUsIHBpcGVTcHJpdGVzLmRUZWVdO1xuICAgICAgICB0aGlzLnJvdCA9IDA7XG4gICAgICAgIHRoaXMub2xkUG9zID0ge31cbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlc1t0aGlzLnJvdF0uZHJhdyhjdHgsIHRoaXMueCwgdGhpcy55KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgJj0gdGhpcy53b3JsZC5pc0RyYWdnaW5nO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBsZXQge3gsIHl9ID0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHggKyB0aGlzLmRyYWdIYW5kbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB5ICsgdGhpcy5kcmFnSGFuZGxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmlnaHRDbGljayAoKSB7XG4gICAgICAgIHRoaXMucm90ID0gKHRoaXMucm90ICsgMSkgJSA0O1xuICAgIH1cblxuICAgIG9uU3RhcnREcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGxldCB4ID0gdGhpcy54IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLng7XG4gICAgICAgIGxldCB5ID0gdGhpcy55IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLnk7XG5cbiAgICAgICAgdGhpcy5vbGRQb3MgPSB7eDogdGhpcy54LCB5OiB0aGlzLnl9XG5cbiAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0ge3g6eCwgeTp5fTtcbiAgICB9XG5cbiAgICBvblN0b3BEcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnggPSByb3VuZFRvKHRoaXMueCAtIGJvYXJkUG9zLngsIDMyKSArIGJvYXJkUG9zLng7XG4gICAgICAgIHRoaXMueSA9IHJvdW5kVG8odGhpcy55IC0gYm9hcmRQb3MueSwgMzIpICsgYm9hcmRQb3MueTtcblxuICAgICAgICBpZiAodGhpcy53b3JsZC5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLngsIHRoaXMueSkubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnggPSB0aGlzLm9sZFBvcy54XG4gICAgICAgICAgICB0aGlzLnkgPSB0aGlzLm9sZFBvcy55XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZWVUaWxlIGV4dGVuZHMgVGlsZSB7fVxuXG5leHBvcnQgY2xhc3MgTG9uZ1RpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oTG9uZywgcGlwZVNwcml0ZXMudkxvbmcsIHBpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZ11cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCZW5kVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLnJ1QmVuZCwgcGlwZVNwcml0ZXMubHVCZW5kLCBwaXBlU3ByaXRlcy5sZEJlbmQsIHBpcGVTcHJpdGVzLnJkQmVuZF1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3VyVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXldXG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTaG9ydFRpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oU2hvcnQsIHBpcGVTcHJpdGVzLnZTaG9ydF1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJvdW5kVG8gKHZhbCwgaW5jKSB7XG4gICAgbGV0IG9mZkJ5ID0gKHZhbCAlIGluYyk7XG4gICAgaWYgKG9mZkJ5IDw9IGluYyAvIDIpIHtcbiAgICAgICAgcmV0dXJuIHZhbCAtIG9mZkJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWwgKyBpbmMgLSBvZmZCeTtcbiAgICB9XG59XG4iXX0=
