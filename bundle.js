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
        this.rot = (this.rot + 1) % this.sprites.length;
    }

    onStartDrag() {
        this.dragging = true;
        let x = this.x - this.world.mouseLocation.x;
        let y = this.y - this.world.mouseLocation.y;

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
        this.oldPos = { x: this.x, y: this.y };
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixF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QU0sS0FBTjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksTUFBYixFQUFxQixxQkFBWSxNQUFqQyxFQUF5QyxxQkFBWSxNQUFyRCxFQUE2RCxxQkFBWSxNQUF6RSxDQUFmO0FBQ0g7QUFKOEI7O1FBQXRCLFEsR0FBQSxRO0FBT04sTUFBTSxRQUFOLFNBQXVCLElBQXZCLENBQTRCO0FBQy9CLGdCQUFhLEtBQWIsRUFBb0I7QUFDaEIsY0FBTSxLQUFOO0FBQ0EsYUFBSyxPQUFMLEdBQWUsQ0FBQyxxQkFBWSxPQUFiLEVBQXNCLHFCQUFZLE9BQWxDLEVBQTJDLHFCQUFZLE9BQXZELEVBQWdFLHFCQUFZLE9BQTVFLENBQWY7QUFDSDtBQUo4Qjs7UUFBdEIsUSxHQUFBLFE7QUFRTixNQUFNLFNBQU4sU0FBd0IsSUFBeEIsQ0FBNkI7QUFDaEMsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixjQUFNLEtBQU47QUFDQSxhQUFLLE9BQUwsR0FBZSxDQUFDLHFCQUFZLE1BQWIsRUFBcUIscUJBQVksTUFBakMsQ0FBZjtBQUNIO0FBSitCOztRQUF2QixTLEdBQUEsUztBQU9iLFNBQVMsT0FBVCxDQUFrQixHQUFsQixFQUF1QixHQUF2QixFQUE0QjtBQUN4QixRQUFJLFFBQVMsTUFBTSxHQUFuQjtBQUNBLFFBQUksU0FBUyxNQUFNLENBQW5CLEVBQXNCO0FBQ2xCLGVBQU8sTUFBTSxLQUFiO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZUFBTyxNQUFNLEdBQU4sR0FBWSxLQUFuQjtBQUNIO0FBQ0oiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0dhbWV9IGZyb20gJy4vZ2FtZSc7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyZWVuJyk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKGNhbnZhcyk7XG5cblxudmFyIG1hc3Rlckxvb3AgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQge0V2ZW50TGlzdGVuZXJ9IGZyb20gXCIuL2V2ZW50cy5qc1wiO1xuXG5cbmV4cG9ydCBjbGFzcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgRXZlbnRMaXN0ZW5lcigpO1xuXG4gICAgICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDY0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICB9XG5cbiAgICBnZXRIaXRCb3hlcygpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbGxlY3QoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMuY29udHJvbFN0YXRlLm5leHQoe2R0OiBkdH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoZHQsIGN0eCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5yZW5kZXJTdGF0ZS5uZXh0KHtkdDogZHQsIGN0eDogY3R4fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHt9XG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxuZXhwb3J0IGNsYXNzIEV2ZW50TGlzdGVuZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZnVuYykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRzO1xuXG4gICAgICAgIGV2ZW50cy5wdXNoKGZ1bmMpO1xuICAgIH1cblxuICAgIGVtaXQobmFtZSwgYXJncykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIGZvciAobGV0IGV2IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgZXYoYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIEltYWdlSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoe2ltZywgeCwgeSwgdywgaH0pIHtcbiAgICAgICAgdGhpcy5pbWcgPSBpbWc7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMud2lkdGggPSB3O1xuICAgICAgICB0aGlzLmhlaWdodCA9IGg7XG4gICAgfVxuXG4gICAgZHJhdyAoY3R4LCB4LCB5LCBzeD0xLCBzeT0xKSB7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoXG4gICAgICAgICAgICB0aGlzLmltZyxcbiAgICAgICAgICAgIHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHgsIHksIHRoaXMud2lkdGgqc3gsIHRoaXMuaGVpZ2h0KnN5XG4gICAgICAgIClcbiAgICB9XG59XG5cbmNsYXNzIEF1ZGlvSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZWRpYU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cblxuICAgIGZldGNoU3ByaXRlU2hlZXQgKHVybCwgc3ByaXRlcykge1xuICAgICAgICBsZXQgc3ByaXRlU2hlZXQgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgc3ByaXRlU2hlZXQuc3JjID0gdXJsO1xuXG4gICAgICAgIGxldCBzcHJpdGVIYW5kbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHNwcml0ZSA9IHNwcml0ZXNbaV07XG4gICAgICAgICAgICBzcHJpdGVIYW5kbGVzW2ldID0gbmV3IEltYWdlSGFuZGxlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW1nOiBzcHJpdGVTaGVldCxcbiAgICAgICAgICAgICAgICAgICAgeDogc3ByaXRlLngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHNwcml0ZS55LFxuICAgICAgICAgICAgICAgICAgICB3OiBzcHJpdGUudyxcbiAgICAgICAgICAgICAgICAgICAgaDogc3ByaXRlLmgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChzcHJpdGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbc3ByaXRlLm5hbWVdID0gc3ByaXRlSGFuZGxlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3ByaXRlSGFuZGxlcztcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QmVuZFRpbGUsIEZvdXJUaWxlLCBTaG9ydFRpbGUsIFRlZVRpbGUsIExvbmdUaWxlfSBmcm9tICcuL3RpbGUnO1xuXG5leHBvcnQgY29uc3QgYm9hcmRQb3MgPSB7XG4gICAgeDogOTYsXG4gICAgeTogMzIsXG4gICAgdzogODk2LFxuICAgIGg6IDUxMixcbn1cblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICAgIGNvbnN0cnVjdG9yKHNjcmVlbiwgbWVkaWFNYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMubWVkaWFNYW5hZ2VyID0gbWVkaWFNYW5hZ2VyO1xuXG4gICAgICAgIC8vIFNldCB1cCBidWZmZXJzXG4gICAgICAgIHRoaXMuY2FudmFzID0gdGhpcy5mcm9udEJ1ZmZlciA9IHNjcmVlbjtcbiAgICAgICAgdGhpcy5mcm9udEN0eCA9IHNjcmVlbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLndpZHRoID0gc2NyZWVuLndpZHRoO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIuaGVpZ2h0ID0gc2NyZWVuLmhlaWdodDtcbiAgICAgICAgdGhpcy5iYWNrQ3R4ID0gdGhpcy5iYWNrQnVmZmVyLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgLy8gU3RhcnQgdGhlIGdhbWUgbG9vcFxuICAgICAgICB0aGlzLm9sZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlZG93biA9IHRoaXMub25TdGFydERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZXVwID0gdGhpcy5vbkVuZERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZW1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY2FudmFzLm9uY29udGV4dG1lbnUgPSAoZSk9PmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0gbmV3IENvbGxpc2lvbk1hbmFnZXIoKTtcblxuICAgICAgICB0aGlzLnN0YXJ0VGlsZSA9IG5ldyBTaG9ydFRpbGUodGhpcylcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueCA9IGJvYXJkUG9zLnhcbiAgICAgICAgdGhpcy5zdGFydFRpbGUueSA9IGJvYXJkUG9zLnkgKyAoKE1hdGgucmFuZG9tKCkqKGJvYXJkUG9zLmgvMzIpKXwwKSozMlxuICAgICAgICB0aGlzLmVuZFRpbGUgPSBuZXcgU2hvcnRUaWxlKHRoaXMpXG4gICAgICAgIHRoaXMuZW5kVGlsZS54ID0gYm9hcmRQb3MueCArIGJvYXJkUG9zLnctMzJcbiAgICAgICAgdGhpcy5lbmRUaWxlLnkgPSBib2FyZFBvcy55ICsgKChNYXRoLnJhbmRvbSgpKihib2FyZFBvcy5oLzMyKSl8MCkqMzJcblxuICAgICAgICB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzID0gW3RoaXMuc3RhcnRUaWxlLCB0aGlzLmVuZFRpbGVdO1xuXG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiAwLCB5OiAwfTtcbiAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBbXTtcblxuICAgICAgICB0aGlzLnNjb3JlID0gMFxuICAgICAgICB0aGlzLmxldmVsID0gMVxuICAgIH1cblxuICAgIHBhdXNlIChmbGFnKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gKGZsYWcgPT0gdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9vcCAobmV3VGltZSkge1xuICAgICAgICB2YXIgZ2FtZSA9IHRoaXM7XG4gICAgICAgIHZhciBlbGFwc2VkVGltZSA9IG5ld1RpbWUgLSB0aGlzLm9sZFRpbWU7XG4gICAgICAgIHRoaXMub2xkVGltZSA9IG5ld1RpbWU7XG5cbiAgICAgICAgaWYoIXRoaXMucGF1c2VkKSB0aGlzLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIHRoaXMucmVuZGVyKGVsYXBzZWRUaW1lLCB0aGlzLmZyb250Q3R4KTtcblxuICAgICAgICAvLyBGbGlwIHRoZSBiYWNrIGJ1ZmZlclxuICAgICAgICB0aGlzLmZyb250Q3R4LmRyYXdJbWFnZSh0aGlzLmJhY2tCdWZmZXIsIDAsIDApO1xuICAgIH1cblxuICAgIHJlbmRlciAoZWxhcHNlZFRpbWUsIGN0eCkge1xuICAgICAgICBsZXQgY2FudmFzID0gdGhpcy5jYW52YXM7XG5cbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiIzc3Nzc3N1wiO1xuICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBmb3IgKGxldCB4PWJvYXJkUG9zLng7IHg8PWJvYXJkUG9zLngrYm9hcmRQb3MudzsgeCs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oeCwgYm9hcmRQb3MueSk7XG4gICAgICAgICAgICBjdHgubGluZVRvKHgsIGJvYXJkUG9zLnkrYm9hcmRQb3MuaCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgeT1ib2FyZFBvcy55OyB5PD1ib2FyZFBvcy55K2JvYXJkUG9zLmg7IHkrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKGJvYXJkUG9zLngsIHkpO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyhib2FyZFBvcy54K2JvYXJkUG9zLncsIHkpO1xuICAgICAgICB9XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdncmV5JztcbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDI7XG4gICAgICAgIGN0eC5zdHJva2UoKTtcblxuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci5yZW5kZXIoZWxhcHNlZFRpbWUsIGN0eCk7XG4gICAgICAgIH1cblxuICAgICAgICBjdHguZmlsbFN0eWxlID0gJ3doaXRlJ1xuICAgICAgICBjdHguZm9udCA9IFwiMTJweCBzZXJpZlwiXG4gICAgICAgIGN0eC5maWxsVGV4dChgbGV2ZWwgJHt0aGlzLmxldmVsfWAsIDEwLCA1MDApXG4gICAgICAgIGN0eC5maWxsVGV4dChgJHt0aGlzLnNjb3JlfSBwb2ludHNgLCAxMCwgNTIwKVxuICAgIH1cblxuICAgIHVwZGF0ZSAoZWxhcHNlZFRpbWUpIHtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLnVwZGF0ZSgpO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5pc0RyYWdnaW5nICYmIHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQoMzIsIDY0KS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxldCBwb3NUaWxlcyA9IFtGb3VyVGlsZSwgVGVlVGlsZSwgU2hvcnRUaWxlLCBTaG9ydFRpbGUsIEJlbmRUaWxlLCBCZW5kVGlsZV0gLy8gTG9uZ1RpbGVcbiAgICAgICAgICAgIGxldCB0aWxlID0gcG9zVGlsZXNbTWF0aC5yYW5kb20oKSpwb3NUaWxlcy5sZW5ndGh8MF1cbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMucHVzaChuZXcgdGlsZSh0aGlzKSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU3RhcnREcmFnIChldmVudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhldmVudClcbiAgICAgICAgaWYgKGV2ZW50LmJ1dHRvbnMgJiAxKSB7XG4gICAgICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gYWN0b3JzO1xuICAgICAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgYWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgYWN0b3Iub25TdGFydERyYWcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDIpIHtcbiAgICAgICAgICAgIGxldCBhY3RvcnMgPSB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMubW91c2VMb2NhdGlvbi54LCB0aGlzLm1vdXNlTG9jYXRpb24ueSk7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblJpZ2h0Q2xpY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5kRHJhZyAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuYmVpbmdEcmFnZ2VkKSB7XG4gICAgICAgICAgICBhY3Rvci5vblN0b3BEcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbk1vdXNlTW92ZSAoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5tb3VzZUxvY2F0aW9uID0ge3g6IGV2ZW50Lm9mZnNldFgsIHk6IGV2ZW50Lm9mZnNldFl9O1xuICAgIH1cbn1cblxuY2xhc3MgQ29sbGlzaW9uTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLnRpbGVTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX3RpbGVzID0gW107XG4gICAgfVxuXG4gICAgY29sbGlzaW9uc0F0ICh4LCB5KSB7XG4gICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKHgsIHkpO1xuICAgICAgICByZXR1cm4gdGlsZTtcbiAgICB9XG5cbiAgICBnZXRUaWxlICh4LCB5KSB7XG4gICAgICAgIHggPSAoeCAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHkgPSAoeSAvIHRoaXMudGlsZVNpemUpfDA7XG4gICAgICAgIHJldHVybiB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gPSB0aGlzLl90aWxlc1tgJHt4fV8ke3l9YF0gfHwgW107XG4gICAgfVxuXG4gICAgdXBkYXRlICgpIHtcbiAgICAgICAgdGhpcy5hY3RvcnMuZmlsdGVyKChhKT0+IWEuY29sbGVjdCgpKTtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGxldCB0aWxlID0gdGhpcy5nZXRUaWxlKGFjdG9yLngsIGFjdG9yLnkpO1xuICAgICAgICAgICAgdGlsZS5wdXNoKGFjdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtNZWRpYU1hbmFnZXJ9IGZyb20gJy4vY29tbW9uL21lZGlhTWFuYWdlci5qcydcblxubGV0IG1lZGlhID0gbmV3IE1lZGlhTWFuYWdlcigpO1xuXG5leHBvcnQgbGV0IHBpcGVTcHJpdGVzID0gbWVkaWEuZmV0Y2hTcHJpdGVTaGVldCgnLi9hc3NldHMvcGlwZXMucG5nJyxcbiAgICBbXG4gICAgICAgIHt4OjAsIHk6MCwgdzozMiwgaDozMiwgbmFtZTonZm91cldheSd9LFxuICAgICAgICB7eDozMSwgeTowLCB3Ojk2LCBoOjMyLCBuYW1lOidoTG9uZyd9LFxuICAgICAgICB7eDowLCB5OjMyLCB3OjMxLCBoOjk2LCBuYW1lOid2TG9uZyd9LFxuICAgICAgICB7eDo5NSwgeTozMiwgdzozMiwgaDozMiwgbmFtZTonaFNob3J0J30sXG4gICAgICAgIHt4Ojk1LCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOid2U2hvcnQnfSxcbiAgICAgICAge3g6MzEsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J3JkQmVuZCd9LFxuICAgICAgICB7eDo2MywgeTozMiwgdzozMSwgaDozMiwgbmFtZTonbGRCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidydUJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J2x1QmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonZFRlZSd9LFxuICAgICAgICB7eDozMSwgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3JUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOid1VGVlJ30sXG4gICAgICAgIHt4OjYzLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidsVGVlJ30sXG4gICAgXSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QWN0b3J9IGZyb20gJy4vY29tbW9uL2FjdG9yLmpzJztcbmltcG9ydCB7cGlwZVNwcml0ZXN9IGZyb20gJy4vc3ByaXRlcy5qcyc7XG5pbXBvcnQge2JvYXJkUG9zfSBmcm9tICcuL2dhbWUuanMnO1xuXG5leHBvcnQgY2xhc3MgVGlsZSBleHRlbmRzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpO1xuICAgICAgICB0aGlzLndpZHRoID0gMzI7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gMzI7XG4gICAgICAgIHRoaXMueCA9IDMyXG4gICAgICAgIHRoaXMueSA9IDY0XG4gICAgICAgIHRoaXMuZHJhZ0hhbmRsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5sVGVlLCBwaXBlU3ByaXRlcy51VGVlLCBwaXBlU3ByaXRlcy5yVGVlLCBwaXBlU3ByaXRlcy5kVGVlXTtcbiAgICAgICAgdGhpcy5yb3QgPSAwO1xuICAgICAgICB0aGlzLm9sZFBvcyA9IHt4OiB0aGlzLngsIHk6IHRoaXMueX1cbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlc1t0aGlzLnJvdF0uZHJhdyhjdHgsIHRoaXMueCwgdGhpcy55KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgJj0gdGhpcy53b3JsZC5pc0RyYWdnaW5nO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBsZXQge3gsIHl9ID0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHggKyB0aGlzLmRyYWdIYW5kbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB5ICsgdGhpcy5kcmFnSGFuZGxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmlnaHRDbGljayAoKSB7XG4gICAgICAgIHRoaXMucm90ID0gKHRoaXMucm90ICsgMSkgJSB0aGlzLnNwcml0ZXMubGVuZ3RoO1xuICAgIH1cblxuICAgIG9uU3RhcnREcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGxldCB4ID0gdGhpcy54IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLng7XG4gICAgICAgIGxldCB5ID0gdGhpcy55IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLnk7XG5cblxuICAgICAgICB0aGlzLmRyYWdIYW5kbGUgPSB7eDp4LCB5Onl9O1xuICAgIH1cblxuICAgIG9uU3RvcERyYWcgKCkge1xuICAgICAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMueCA9IHJvdW5kVG8odGhpcy54IC0gYm9hcmRQb3MueCwgMzIpICsgYm9hcmRQb3MueDtcbiAgICAgICAgdGhpcy55ID0gcm91bmRUbyh0aGlzLnkgLSBib2FyZFBvcy55LCAzMikgKyBib2FyZFBvcy55O1xuXG4gICAgICAgIGlmICh0aGlzLndvcmxkLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMueCwgdGhpcy55KS5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHRoaXMub2xkUG9zLnhcbiAgICAgICAgICAgIHRoaXMueSA9IHRoaXMub2xkUG9zLnlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9sZFBvcyA9IHt4OiB0aGlzLngsIHk6IHRoaXMueX1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZWVUaWxlIGV4dGVuZHMgVGlsZSB7fVxuXG5leHBvcnQgY2xhc3MgTG9uZ1RpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oTG9uZywgcGlwZVNwcml0ZXMudkxvbmcsIHBpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZ11cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCZW5kVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLnJ1QmVuZCwgcGlwZVNwcml0ZXMubHVCZW5kLCBwaXBlU3ByaXRlcy5sZEJlbmQsIHBpcGVTcHJpdGVzLnJkQmVuZF1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3VyVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXldXG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTaG9ydFRpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oU2hvcnQsIHBpcGVTcHJpdGVzLnZTaG9ydF1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJvdW5kVG8gKHZhbCwgaW5jKSB7XG4gICAgbGV0IG9mZkJ5ID0gKHZhbCAlIGluYyk7XG4gICAgaWYgKG9mZkJ5IDw9IGluYyAvIDIpIHtcbiAgICAgICAgcmV0dXJuIHZhbCAtIG9mZkJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWwgKyBpbmMgLSBvZmZCeTtcbiAgICB9XG59XG4iXX0=
