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
    w: 1088,
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
        this.collisions.actors = [new _tile.BendTile(this)];

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
exports.FourTile = exports.BendTile = exports.LongTile = exports.TeeTile = exports.Tile = undefined;

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

        this.dragHandle = { x: x, y: y };
    }

    onStopDrag() {
        this.dragging = false;
        this.x = roundTo(this.x - _game.boardPos.x, 32) + _game.boardPos.x;
        this.y = roundTo(this.y - _game.boardPos.y, 32) + _game.boardPos.y;
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
function roundTo(val, inc) {
    let offBy = val % inc;
    if (offBy <= inc / 2) {
        return val - offBy;
    } else {
        return val + inc - offBy;
    }
}

},{"./common/actor.js":2,"./game.js":5,"./sprites.js":6}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixF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Q0FBNEI7QUFDL0IsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixjQUFNLEtBQU47QUFDQSxhQUFLLE9BQUwsR0FBZSxDQUFDLHFCQUFZLE9BQWIsRUFBc0IscUJBQVksT0FBbEMsRUFBMkMscUJBQVksT0FBdkQsRUFBZ0UscUJBQVksT0FBNUUsQ0FBZjtBQUNIO0FBSjhCOztRQUF0QixRLEdBQUEsUTtBQU9iLFNBQVMsT0FBVCxDQUFrQixHQUFsQixFQUF1QixHQUF2QixFQUE0QjtBQUN4QixRQUFJLFFBQVMsTUFBTSxHQUFuQjtBQUNBLFFBQUksU0FBUyxNQUFNLENBQW5CLEVBQXNCO0FBQ2xCLGVBQU8sTUFBTSxLQUFiO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZUFBTyxNQUFNLEdBQU4sR0FBWSxLQUFuQjtBQUNIO0FBQ0oiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0dhbWV9IGZyb20gJy4vZ2FtZSc7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyZWVuJyk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKGNhbnZhcyk7XG5cblxudmFyIG1hc3Rlckxvb3AgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQge0V2ZW50TGlzdGVuZXJ9IGZyb20gXCIuL2V2ZW50cy5qc1wiO1xuXG5cbmV4cG9ydCBjbGFzcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgRXZlbnRMaXN0ZW5lcigpO1xuXG4gICAgICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDY0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICB9XG5cbiAgICBnZXRIaXRCb3hlcygpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbGxlY3QoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMuY29udHJvbFN0YXRlLm5leHQoe2R0OiBkdH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoZHQsIGN0eCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5yZW5kZXJTdGF0ZS5uZXh0KHtkdDogZHQsIGN0eDogY3R4fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHt9XG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxuZXhwb3J0IGNsYXNzIEV2ZW50TGlzdGVuZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZnVuYykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRzO1xuXG4gICAgICAgIGV2ZW50cy5wdXNoKGZ1bmMpO1xuICAgIH1cblxuICAgIGVtaXQobmFtZSwgYXJncykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIGZvciAobGV0IGV2IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgZXYoYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIEltYWdlSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoe2ltZywgeCwgeSwgdywgaH0pIHtcbiAgICAgICAgdGhpcy5pbWcgPSBpbWc7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMud2lkdGggPSB3O1xuICAgICAgICB0aGlzLmhlaWdodCA9IGg7XG4gICAgfVxuXG4gICAgZHJhdyAoY3R4LCB4LCB5LCBzeD0xLCBzeT0xKSB7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoXG4gICAgICAgICAgICB0aGlzLmltZyxcbiAgICAgICAgICAgIHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHgsIHksIHRoaXMud2lkdGgqc3gsIHRoaXMuaGVpZ2h0KnN5XG4gICAgICAgIClcbiAgICB9XG59XG5cbmNsYXNzIEF1ZGlvSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZWRpYU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cblxuICAgIGZldGNoU3ByaXRlU2hlZXQgKHVybCwgc3ByaXRlcykge1xuICAgICAgICBsZXQgc3ByaXRlU2hlZXQgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgc3ByaXRlU2hlZXQuc3JjID0gdXJsO1xuXG4gICAgICAgIGxldCBzcHJpdGVIYW5kbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHNwcml0ZSA9IHNwcml0ZXNbaV07XG4gICAgICAgICAgICBzcHJpdGVIYW5kbGVzW2ldID0gbmV3IEltYWdlSGFuZGxlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW1nOiBzcHJpdGVTaGVldCxcbiAgICAgICAgICAgICAgICAgICAgeDogc3ByaXRlLngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHNwcml0ZS55LFxuICAgICAgICAgICAgICAgICAgICB3OiBzcHJpdGUudyxcbiAgICAgICAgICAgICAgICAgICAgaDogc3ByaXRlLmgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChzcHJpdGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbc3ByaXRlLm5hbWVdID0gc3ByaXRlSGFuZGxlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3ByaXRlSGFuZGxlcztcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QmVuZFRpbGUsIEZvdXJUaWxlLCBUZWVUaWxlLCBMb25nVGlsZX0gZnJvbSAnLi90aWxlJztcblxuZXhwb3J0IGNvbnN0IGJvYXJkUG9zID0ge1xuICAgIHg6IDk2LFxuICAgIHk6IDMyLFxuICAgIHc6IDEwODgsXG4gICAgaDogNTEyLFxufVxuXG5leHBvcnQgY2xhc3MgR2FtZSB7XG4gICAgY29uc3RydWN0b3Ioc2NyZWVuLCBtZWRpYU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tZWRpYU1hbmFnZXIgPSBtZWRpYU1hbmFnZXI7XG5cbiAgICAgICAgLy8gU2V0IHVwIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy5jYW52YXMgPSB0aGlzLmZyb250QnVmZmVyID0gc2NyZWVuO1xuICAgICAgICB0aGlzLmZyb250Q3R4ID0gc2NyZWVuLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIud2lkdGggPSBzY3JlZW4ud2lkdGg7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlci5oZWlnaHQgPSBzY3JlZW4uaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhY2tDdHggPSB0aGlzLmJhY2tCdWZmZXIuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgICAgICAvLyBTdGFydCB0aGUgZ2FtZSBsb29wXG4gICAgICAgIHRoaXMub2xkVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLm9ubW91c2Vkb3duID0gdGhpcy5vblN0YXJ0RHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNldXAgPSB0aGlzLm9uRW5kRHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlbW92ZSA9IHRoaXMub25Nb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25jb250ZXh0bWVudSA9IChlKT0+ZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMgPSBuZXcgQ29sbGlzaW9uTWFuYWdlcigpO1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzID0gW25ldyBCZW5kVGlsZSh0aGlzKV07XG5cbiAgICAgICAgdGhpcy5tb3VzZUxvY2F0aW9uID0ge3g6IDAsIHk6IDB9O1xuICAgICAgICB0aGlzLmJlaW5nRHJhZ2dlZCA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NvcmUgPSAwXG4gICAgICAgIHRoaXMubGV2ZWwgPSAxXG4gICAgfVxuXG4gICAgcGF1c2UgKGZsYWcpIHtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSAoZmxhZyA9PSB0cnVlKTtcbiAgICB9XG5cbiAgICBsb29wIChuZXdUaW1lKSB7XG4gICAgICAgIHZhciBnYW1lID0gdGhpcztcbiAgICAgICAgdmFyIGVsYXBzZWRUaW1lID0gbmV3VGltZSAtIHRoaXMub2xkVGltZTtcbiAgICAgICAgdGhpcy5vbGRUaW1lID0gbmV3VGltZTtcblxuICAgICAgICBpZighdGhpcy5wYXVzZWQpIHRoaXMudXBkYXRlKGVsYXBzZWRUaW1lKTtcbiAgICAgICAgdGhpcy5yZW5kZXIoZWxhcHNlZFRpbWUsIHRoaXMuZnJvbnRDdHgpO1xuXG4gICAgICAgIC8vIEZsaXAgdGhlIGJhY2sgYnVmZmVyXG4gICAgICAgIHRoaXMuZnJvbnRDdHguZHJhd0ltYWdlKHRoaXMuYmFja0J1ZmZlciwgMCwgMCk7XG4gICAgfVxuXG4gICAgcmVuZGVyIChlbGFwc2VkVGltZSwgY3R4KSB7XG4gICAgICAgIGxldCBjYW52YXMgPSB0aGlzLmNhbnZhcztcblxuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCIjNzc3Nzc3XCI7XG4gICAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGZvciAobGV0IHg9Ym9hcmRQb3MueDsgeDw9Ym9hcmRQb3MueCtib2FyZFBvcy53OyB4Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbyh4LCBib2FyZFBvcy55KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oeCwgYm9hcmRQb3MueStib2FyZFBvcy5oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCB5PWJvYXJkUG9zLnk7IHk8PWJvYXJkUG9zLnkrYm9hcmRQb3MuaDsgeSs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oYm9hcmRQb3MueCwgeSk7XG4gICAgICAgICAgICBjdHgubGluZVRvKGJvYXJkUG9zLngrYm9hcmRQb3MudywgeSk7XG4gICAgICAgIH1cbiAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJ2dyZXknO1xuICAgICAgICBjdHgubGluZVdpZHRoID0gMjtcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSAnd2hpdGUnXG4gICAgICAgIGN0eC5mb250ID0gXCIxMnB4IHNlcmlmXCJcbiAgICAgICAgY3R4LmZpbGxUZXh0KGBsZXZlbCAke3RoaXMubGV2ZWx9YCwgMTAsIDUwMClcbiAgICAgICAgY3R4LmZpbGxUZXh0KGAke3RoaXMuc2NvcmV9IHBvaW50c2AsIDEwLCA1MjApXG4gICAgfVxuXG4gICAgdXBkYXRlIChlbGFwc2VkVGltZSkge1xuICAgICAgICB0aGlzLmNvbGxpc2lvbnMudXBkYXRlKCk7XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS5sb2coZXZlbnQpXG4gICAgICAgIGlmIChldmVudC5idXR0b25zICYgMSkge1xuICAgICAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIGxldCBhY3RvcnMgPSB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMubW91c2VMb2NhdGlvbi54LCB0aGlzLm1vdXNlTG9jYXRpb24ueSk7XG4gICAgICAgICAgICB0aGlzLmJlaW5nRHJhZ2dlZCA9IGFjdG9ycztcbiAgICAgICAgICAgIGZvciAobGV0IGFjdG9yIG9mIGFjdG9ycykge1xuICAgICAgICAgICAgICAgIGFjdG9yLm9uU3RhcnREcmFnKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2ZW50LmJ1dHRvbnMgJiAyKSB7XG4gICAgICAgICAgICBsZXQgYWN0b3JzID0gdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLm1vdXNlTG9jYXRpb24ueCwgdGhpcy5tb3VzZUxvY2F0aW9uLnkpO1xuICAgICAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgYWN0b3JzKSB7XG4gICAgICAgICAgICAgICAgYWN0b3Iub25SaWdodENsaWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuZERyYWcgKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmJlaW5nRHJhZ2dlZCkge1xuICAgICAgICAgICAgYWN0b3Iub25TdG9wRHJhZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25Nb3VzZU1vdmUgKGV2ZW50KSB7XG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiBldmVudC5vZmZzZXRYLCB5OiBldmVudC5vZmZzZXRZfTtcbiAgICB9XG59XG5cbmNsYXNzIENvbGxpc2lvbk1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5hY3RvcnMgPSBbXTtcbiAgICAgICAgdGhpcy50aWxlU2l6ZSA9IDMyO1xuICAgICAgICB0aGlzLl90aWxlcyA9IFtdO1xuICAgIH1cblxuICAgIGNvbGxpc2lvbnNBdCAoeCwgeSkge1xuICAgICAgICBsZXQgdGlsZSA9IHRoaXMuZ2V0VGlsZSh4LCB5KTtcbiAgICAgICAgcmV0dXJuIHRpbGU7XG4gICAgfVxuXG4gICAgZ2V0VGlsZSAoeCwgeSkge1xuICAgICAgICB4ID0gKHggLyB0aGlzLnRpbGVTaXplKXwwO1xuICAgICAgICB5ID0gKHkgLyB0aGlzLnRpbGVTaXplKXwwO1xuICAgICAgICByZXR1cm4gdGhpcy5fdGlsZXNbYCR7eH1fJHt5fWBdID0gdGhpcy5fdGlsZXNbYCR7eH1fJHt5fWBdIHx8IFtdO1xuICAgIH1cblxuICAgIHVwZGF0ZSAoKSB7XG4gICAgICAgIHRoaXMuYWN0b3JzLmZpbHRlcigoYSk9PiFhLmNvbGxlY3QoKSk7XG4gICAgICAgIHRoaXMuX3RpbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuYWN0b3JzKSB7XG4gICAgICAgICAgICBsZXQgdGlsZSA9IHRoaXMuZ2V0VGlsZShhY3Rvci54LCBhY3Rvci55KTtcbiAgICAgICAgICAgIHRpbGUucHVzaChhY3Rvcik7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7TWVkaWFNYW5hZ2VyfSBmcm9tICcuL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMnXG5cbmxldCBtZWRpYSA9IG5ldyBNZWRpYU1hbmFnZXIoKTtcblxuZXhwb3J0IGxldCBwaXBlU3ByaXRlcyA9IG1lZGlhLmZldGNoU3ByaXRlU2hlZXQoJy4vYXNzZXRzL3BpcGVzLnBuZycsXG4gICAgW1xuICAgICAgICB7eDowLCB5OjAsIHc6MzIsIGg6MzIsIG5hbWU6J2ZvdXJXYXknfSxcbiAgICAgICAge3g6MzEsIHk6MCwgdzo5NiwgaDozMiwgbmFtZTonaExvbmcnfSxcbiAgICAgICAge3g6MCwgeTozMiwgdzozMSwgaDo5NiwgbmFtZTondkxvbmcnfSxcbiAgICAgICAge3g6OTUsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J2hTaG9ydCd9LFxuICAgICAgICB7eDo5NSwgeTo2NCwgdzozMiwgaDozMiwgbmFtZTondlNob3J0J30sXG4gICAgICAgIHt4OjMxLCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidyZEJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6MzIsIHc6MzEsIGg6MzIsIG5hbWU6J2xkQmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo2NCwgdzozMiwgaDozMiwgbmFtZToncnVCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidsdUJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2RUZWUnfSxcbiAgICAgICAge3g6MzEsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOidyVGVlJ30sXG4gICAgICAgIHt4OjYzLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTondVRlZSd9LFxuICAgICAgICB7eDo2MywgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonbFRlZSd9LFxuICAgIF0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0FjdG9yfSBmcm9tICcuL2NvbW1vbi9hY3Rvci5qcyc7XG5pbXBvcnQge3BpcGVTcHJpdGVzfSBmcm9tICcuL3Nwcml0ZXMuanMnO1xuaW1wb3J0IHtib2FyZFBvc30gZnJvbSAnLi9nYW1lLmpzJztcblxuZXhwb3J0IGNsYXNzIFRpbGUgZXh0ZW5kcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKTtcbiAgICAgICAgdGhpcy53aWR0aCA9IDMyO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDMyO1xuICAgICAgICB0aGlzLnggPSAzMlxuICAgICAgICB0aGlzLnkgPSA2NFxuICAgICAgICB0aGlzLmRyYWdIYW5kbGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMubFRlZSwgcGlwZVNwcml0ZXMudVRlZSwgcGlwZVNwcml0ZXMuclRlZSwgcGlwZVNwcml0ZXMuZFRlZV07XG4gICAgICAgIHRoaXMucm90ID0gMDtcbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlc1t0aGlzLnJvdF0uZHJhdyhjdHgsIHRoaXMueCwgdGhpcy55KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgJj0gdGhpcy53b3JsZC5pc0RyYWdnaW5nO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBsZXQge3gsIHl9ID0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHggKyB0aGlzLmRyYWdIYW5kbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB5ICsgdGhpcy5kcmFnSGFuZGxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmlnaHRDbGljayAoKSB7XG4gICAgICAgIHRoaXMucm90ID0gKHRoaXMucm90ICsgMSkgJSA0O1xuICAgIH1cblxuICAgIG9uU3RhcnREcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGxldCB4ID0gdGhpcy54IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLng7XG4gICAgICAgIGxldCB5ID0gdGhpcy55IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLnk7XG5cbiAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0ge3g6eCwgeTp5fTtcbiAgICB9XG5cbiAgICBvblN0b3BEcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnggPSByb3VuZFRvKHRoaXMueCAtIGJvYXJkUG9zLngsIDMyKSArIGJvYXJkUG9zLng7XG4gICAgICAgIHRoaXMueSA9IHJvdW5kVG8odGhpcy55IC0gYm9hcmRQb3MueSwgMzIpICsgYm9hcmRQb3MueTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZWVUaWxlIGV4dGVuZHMgVGlsZSB7fVxuXG5leHBvcnQgY2xhc3MgTG9uZ1RpbGUgZXh0ZW5kcyBUaWxlIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpXG4gICAgICAgIHRoaXMuc3ByaXRlcyA9IFtwaXBlU3ByaXRlcy5oTG9uZywgcGlwZVNwcml0ZXMudkxvbmcsIHBpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZ11cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCZW5kVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLnJ1QmVuZCwgcGlwZVNwcml0ZXMubHVCZW5kLCBwaXBlU3ByaXRlcy5sZEJlbmQsIHBpcGVTcHJpdGVzLnJkQmVuZF1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3VyVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXksIHBpcGVTcHJpdGVzLmZvdXJXYXldXG4gICAgfVxufVxuXG5mdW5jdGlvbiByb3VuZFRvICh2YWwsIGluYykge1xuICAgIGxldCBvZmZCeSA9ICh2YWwgJSBpbmMpO1xuICAgIGlmIChvZmZCeSA8PSBpbmMgLyAyKSB7XG4gICAgICAgIHJldHVybiB2YWwgLSBvZmZCeTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsICsgaW5jIC0gb2ZmQnk7XG4gICAgfVxufVxuIl19
