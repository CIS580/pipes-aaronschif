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
exports.Game = undefined;

var _tile = require('./tile');

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
        for (let x = 0; x <= canvas.width; x += 32) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y <= canvas.width; y += 32) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.strokeStyle = 'grey';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let actor of this.collisions.actors) {
            actor.render(elapsedTime, ctx);
        }
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

class Tile extends _actor.Actor {
    constructor(world) {
        super(world);
        this.width = 32;
        this.height = 32;
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
        this.x = roundTo(this.x, 32);
        this.y = roundTo(this.y, 32);
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

},{"./common/actor.js":2,"./sprites.js":6}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixF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QkFBYSxLQUFiLEVBQW9CO0FBQ2hCLGNBQU0sS0FBTjtBQUNBLGFBQUssT0FBTCxHQUFlLENBQUMscUJBQVksS0FBYixFQUFvQixxQkFBWSxLQUFoQyxFQUF1QyxxQkFBWSxLQUFuRCxFQUEwRCxxQkFBWSxLQUF0RSxDQUFmO0FBQ0g7QUFKOEI7O1FBQXRCLFEsR0FBQSxRO0FBT04sTUFBTSxRQUFOLFNBQXVCLElBQXZCLENBQTRCO0FBQy9CLGdCQUFhLEtBQWIsRUFBb0I7QUFDaEIsY0FBTSxLQUFOO0FBQ0EsYUFBSyxPQUFMLEdBQWUsQ0FBQyxxQkFBWSxNQUFiLEVBQXFCLHFCQUFZLE1BQWpDLEVBQXlDLHFCQUFZLE1BQXJELEVBQTZELHFCQUFZLE1BQXpFLENBQWY7QUFDSDtBQUo4Qjs7UUFBdEIsUSxHQUFBLFE7QUFPTixNQUFNLFFBQU4sU0FBdUIsSUFBdkIsQ0FBNEI7QUFDL0IsZ0JBQWEsS0FBYixFQUFvQjtBQUNoQixjQUFNLEtBQU47QUFDQSxhQUFLLE9BQUwsR0FBZSxDQUFDLHFCQUFZLE9BQWIsRUFBc0IscUJBQVksT0FBbEMsRUFBMkMscUJBQVksT0FBdkQsRUFBZ0UscUJBQVksT0FBNUUsQ0FBZjtBQUNIO0FBSjhCOztRQUF0QixRLEdBQUEsUTtBQU9iLFNBQVMsT0FBVCxDQUFrQixHQUFsQixFQUF1QixHQUF2QixFQUE0QjtBQUN4QixRQUFJLFFBQVMsTUFBTSxHQUFuQjtBQUNBLFFBQUksU0FBUyxNQUFNLENBQW5CLEVBQXNCO0FBQ2xCLGVBQU8sTUFBTSxLQUFiO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZUFBTyxNQUFNLEdBQU4sR0FBWSxLQUFuQjtBQUNIO0FBQ0oiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0dhbWV9IGZyb20gJy4vZ2FtZSc7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyZWVuJyk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKGNhbnZhcyk7XG5cblxudmFyIG1hc3Rlckxvb3AgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQge0V2ZW50TGlzdGVuZXJ9IGZyb20gXCIuL2V2ZW50cy5qc1wiO1xuXG5cbmV4cG9ydCBjbGFzcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgRXZlbnRMaXN0ZW5lcigpO1xuXG4gICAgICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDY0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICB9XG5cbiAgICBnZXRIaXRCb3hlcygpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbGxlY3QoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMuY29udHJvbFN0YXRlLm5leHQoe2R0OiBkdH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoZHQsIGN0eCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5yZW5kZXJTdGF0ZS5uZXh0KHtkdDogZHQsIGN0eDogY3R4fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHt9XG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxuZXhwb3J0IGNsYXNzIEV2ZW50TGlzdGVuZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZnVuYykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRzO1xuXG4gICAgICAgIGV2ZW50cy5wdXNoKGZ1bmMpO1xuICAgIH1cblxuICAgIGVtaXQobmFtZSwgYXJncykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIGZvciAobGV0IGV2IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgZXYoYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIEltYWdlSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoe2ltZywgeCwgeSwgdywgaH0pIHtcbiAgICAgICAgdGhpcy5pbWcgPSBpbWc7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMud2lkdGggPSB3O1xuICAgICAgICB0aGlzLmhlaWdodCA9IGg7XG4gICAgfVxuXG4gICAgZHJhdyAoY3R4LCB4LCB5LCBzeD0xLCBzeT0xKSB7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoXG4gICAgICAgICAgICB0aGlzLmltZyxcbiAgICAgICAgICAgIHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHgsIHksIHRoaXMud2lkdGgqc3gsIHRoaXMuaGVpZ2h0KnN5XG4gICAgICAgIClcbiAgICB9XG59XG5cbmNsYXNzIEF1ZGlvSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZWRpYU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cblxuICAgIGZldGNoU3ByaXRlU2hlZXQgKHVybCwgc3ByaXRlcykge1xuICAgICAgICBsZXQgc3ByaXRlU2hlZXQgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgc3ByaXRlU2hlZXQuc3JjID0gdXJsO1xuXG4gICAgICAgIGxldCBzcHJpdGVIYW5kbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHNwcml0ZSA9IHNwcml0ZXNbaV07XG4gICAgICAgICAgICBzcHJpdGVIYW5kbGVzW2ldID0gbmV3IEltYWdlSGFuZGxlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW1nOiBzcHJpdGVTaGVldCxcbiAgICAgICAgICAgICAgICAgICAgeDogc3ByaXRlLngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHNwcml0ZS55LFxuICAgICAgICAgICAgICAgICAgICB3OiBzcHJpdGUudyxcbiAgICAgICAgICAgICAgICAgICAgaDogc3ByaXRlLmgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChzcHJpdGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbc3ByaXRlLm5hbWVdID0gc3ByaXRlSGFuZGxlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3ByaXRlSGFuZGxlcztcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QmVuZFRpbGUsIEZvdXJUaWxlLCBUZWVUaWxlLCBMb25nVGlsZX0gZnJvbSAnLi90aWxlJztcblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICAgIGNvbnN0cnVjdG9yKHNjcmVlbiwgbWVkaWFNYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMubWVkaWFNYW5hZ2VyID0gbWVkaWFNYW5hZ2VyO1xuXG4gICAgICAgIC8vIFNldCB1cCBidWZmZXJzXG4gICAgICAgIHRoaXMuY2FudmFzID0gdGhpcy5mcm9udEJ1ZmZlciA9IHNjcmVlbjtcbiAgICAgICAgdGhpcy5mcm9udEN0eCA9IHNjcmVlbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLndpZHRoID0gc2NyZWVuLndpZHRoO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIuaGVpZ2h0ID0gc2NyZWVuLmhlaWdodDtcbiAgICAgICAgdGhpcy5iYWNrQ3R4ID0gdGhpcy5iYWNrQnVmZmVyLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgLy8gU3RhcnQgdGhlIGdhbWUgbG9vcFxuICAgICAgICB0aGlzLm9sZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlZG93biA9IHRoaXMub25TdGFydERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZXVwID0gdGhpcy5vbkVuZERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZW1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY2FudmFzLm9uY29udGV4dG1lbnUgPSAoZSk9PmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0gbmV3IENvbGxpc2lvbk1hbmFnZXIoKTtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLmFjdG9ycyA9IFtuZXcgQmVuZFRpbGUodGhpcyldO1xuXG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiAwLCB5OiAwfTtcbiAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBbXTtcbiAgICB9XG5cbiAgICBwYXVzZSAoZmxhZykge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IChmbGFnID09IHRydWUpO1xuICAgIH1cblxuICAgIGxvb3AgKG5ld1RpbWUpIHtcbiAgICAgICAgdmFyIGdhbWUgPSB0aGlzO1xuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXdUaW1lIC0gdGhpcy5vbGRUaW1lO1xuICAgICAgICB0aGlzLm9sZFRpbWUgPSBuZXdUaW1lO1xuXG4gICAgICAgIGlmKCF0aGlzLnBhdXNlZCkgdGhpcy51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB0aGlzLnJlbmRlcihlbGFwc2VkVGltZSwgdGhpcy5mcm9udEN0eCk7XG5cbiAgICAgICAgLy8gRmxpcCB0aGUgYmFjayBidWZmZXJcbiAgICAgICAgdGhpcy5mcm9udEN0eC5kcmF3SW1hZ2UodGhpcy5iYWNrQnVmZmVyLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZW5kZXIgKGVsYXBzZWRUaW1lLCBjdHgpIHtcbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzO1xuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBcIiM3Nzc3NzdcIjtcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgZm9yIChsZXQgeD0wOyB4PD1jYW52YXMud2lkdGg7IHgrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHgsIDApO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh4LCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCB5PTA7IHk8PWNhbnZhcy53aWR0aDsgeSs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICAgICAgICBjdHgubGluZVRvKGNhbnZhcy53aWR0aCwgeSk7XG4gICAgICAgIH1cbiAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJ2dyZXknO1xuICAgICAgICBjdHgubGluZVdpZHRoID0gMjtcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoZWxhcHNlZFRpbWUpIHtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLnVwZGF0ZSgpO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TdGFydERyYWcgKGV2ZW50KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGV2ZW50KVxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9ucyAmIDEpIHtcbiAgICAgICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgICAgICBsZXQgYWN0b3JzID0gdGhpcy5jb2xsaXNpb25zLmNvbGxpc2lvbnNBdCh0aGlzLm1vdXNlTG9jYXRpb24ueCwgdGhpcy5tb3VzZUxvY2F0aW9uLnkpO1xuICAgICAgICAgICAgdGhpcy5iZWluZ0RyYWdnZWQgPSBhY3RvcnM7XG4gICAgICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgICAgICBhY3Rvci5vblN0YXJ0RHJhZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudC5idXR0b25zICYgMikge1xuICAgICAgICAgICAgbGV0IGFjdG9ycyA9IHRoaXMuY29sbGlzaW9ucy5jb2xsaXNpb25zQXQodGhpcy5tb3VzZUxvY2F0aW9uLngsIHRoaXMubW91c2VMb2NhdGlvbi55KTtcbiAgICAgICAgICAgIGZvciAobGV0IGFjdG9yIG9mIGFjdG9ycykge1xuICAgICAgICAgICAgICAgIGFjdG9yLm9uUmlnaHRDbGljaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmREcmFnIChldmVudCkge1xuICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5iZWluZ0RyYWdnZWQpIHtcbiAgICAgICAgICAgIGFjdG9yLm9uU3RvcERyYWcoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTW91c2VNb3ZlIChldmVudCkge1xuICAgICAgICB0aGlzLm1vdXNlTG9jYXRpb24gPSB7eDogZXZlbnQub2Zmc2V0WCwgeTogZXZlbnQub2Zmc2V0WX07XG4gICAgfVxufVxuXG5jbGFzcyBDb2xsaXNpb25NYW5hZ2VyIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIHRoaXMuYWN0b3JzID0gW107XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSAzMjtcbiAgICAgICAgdGhpcy5fdGlsZXMgPSBbXTtcbiAgICB9XG5cbiAgICBjb2xsaXNpb25zQXQgKHgsIHkpIHtcbiAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoeCwgeSk7XG4gICAgICAgIHJldHVybiB0aWxlO1xuICAgIH1cblxuICAgIGdldFRpbGUgKHgsIHkpIHtcbiAgICAgICAgeCA9ICh4IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgeSA9ICh5IC8gdGhpcy50aWxlU2l6ZSl8MDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSA9IHRoaXMuX3RpbGVzW2Ake3h9XyR7eX1gXSB8fCBbXTtcbiAgICB9XG5cbiAgICB1cGRhdGUgKCkge1xuICAgICAgICB0aGlzLmFjdG9ycy5maWx0ZXIoKGEpPT4hYS5jb2xsZWN0KCkpO1xuICAgICAgICB0aGlzLl90aWxlcyA9IHt9O1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmFjdG9ycykge1xuICAgICAgICAgICAgbGV0IHRpbGUgPSB0aGlzLmdldFRpbGUoYWN0b3IueCwgYWN0b3IueSk7XG4gICAgICAgICAgICB0aWxlLnB1c2goYWN0b3IpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge01lZGlhTWFuYWdlcn0gZnJvbSAnLi9jb21tb24vbWVkaWFNYW5hZ2VyLmpzJ1xuXG5sZXQgbWVkaWEgPSBuZXcgTWVkaWFNYW5hZ2VyKCk7XG5cbmV4cG9ydCBsZXQgcGlwZVNwcml0ZXMgPSBtZWRpYS5mZXRjaFNwcml0ZVNoZWV0KCcuL2Fzc2V0cy9waXBlcy5wbmcnLFxuICAgIFtcbiAgICAgICAge3g6MCwgeTowLCB3OjMyLCBoOjMyLCBuYW1lOidmb3VyV2F5J30sXG4gICAgICAgIHt4OjMxLCB5OjAsIHc6OTYsIGg6MzIsIG5hbWU6J2hMb25nJ30sXG4gICAgICAgIHt4OjAsIHk6MzIsIHc6MzEsIGg6OTYsIG5hbWU6J3ZMb25nJ30sXG4gICAgICAgIHt4Ojk1LCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidoU2hvcnQnfSxcbiAgICAgICAge3g6OTUsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3ZTaG9ydCd9LFxuICAgICAgICB7eDozMSwgeTozMiwgdzozMiwgaDozMiwgbmFtZToncmRCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjMyLCB3OjMxLCBoOjMyLCBuYW1lOidsZEJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6NjQsIHc6MzIsIGg6MzIsIG5hbWU6J3J1QmVuZCd9LFxuICAgICAgICB7eDo2MywgeTo2NCwgdzozMiwgaDozMiwgbmFtZTonbHVCZW5kJ30sXG4gICAgICAgIHt4OjMxLCB5Ojk2LCB3OjMyLCBoOjMyLCBuYW1lOidkVGVlJ30sXG4gICAgICAgIHt4OjMxLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTonclRlZSd9LFxuICAgICAgICB7eDo2MywgeToxMjgsIHc6MzIsIGg6MzIsIG5hbWU6J3VUZWUnfSxcbiAgICAgICAge3g6NjMsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2xUZWUnfSxcbiAgICBdKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtBY3Rvcn0gZnJvbSAnLi9jb21tb24vYWN0b3IuanMnO1xuaW1wb3J0IHtwaXBlU3ByaXRlc30gZnJvbSAnLi9zcHJpdGVzLmpzJztcblxuZXhwb3J0IGNsYXNzIFRpbGUgZXh0ZW5kcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKTtcbiAgICAgICAgdGhpcy53aWR0aCA9IDMyO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDMyO1xuICAgICAgICB0aGlzLmRyYWdIYW5kbGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMubFRlZSwgcGlwZVNwcml0ZXMudVRlZSwgcGlwZVNwcml0ZXMuclRlZSwgcGlwZVNwcml0ZXMuZFRlZV07XG4gICAgICAgIHRoaXMucm90ID0gMDtcbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlc1t0aGlzLnJvdF0uZHJhdyhjdHgsIHRoaXMueCwgdGhpcy55KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIHRoaXMuZHJhZ2dpbmcgJj0gdGhpcy53b3JsZC5pc0RyYWdnaW5nO1xuICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICBsZXQge3gsIHl9ID0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IHggKyB0aGlzLmRyYWdIYW5kbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSB5ICsgdGhpcy5kcmFnSGFuZGxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmlnaHRDbGljayAoKSB7XG4gICAgICAgIHRoaXMucm90ID0gKHRoaXMucm90ICsgMSkgJSA0O1xuICAgIH1cblxuICAgIG9uU3RhcnREcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGxldCB4ID0gdGhpcy54IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLng7XG4gICAgICAgIGxldCB5ID0gdGhpcy55IC0gdGhpcy53b3JsZC5tb3VzZUxvY2F0aW9uLnk7XG5cbiAgICAgICAgdGhpcy5kcmFnSGFuZGxlID0ge3g6eCwgeTp5fTtcbiAgICB9XG5cbiAgICBvblN0b3BEcmFnICgpIHtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnggPSByb3VuZFRvKHRoaXMueCwgMzIpO1xuICAgICAgICB0aGlzLnkgPSByb3VuZFRvKHRoaXMueSwgMzIpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlZVRpbGUgZXh0ZW5kcyBUaWxlIHt9XG5cbmV4cG9ydCBjbGFzcyBMb25nVGlsZSBleHRlbmRzIFRpbGUge1xuICAgIGNvbnN0cnVjdG9yICh3b3JsZCkge1xuICAgICAgICBzdXBlcih3b3JsZClcbiAgICAgICAgdGhpcy5zcHJpdGVzID0gW3BpcGVTcHJpdGVzLmhMb25nLCBwaXBlU3ByaXRlcy52TG9uZywgcGlwZVNwcml0ZXMuaExvbmcsIHBpcGVTcHJpdGVzLnZMb25nXVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJlbmRUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMucnVCZW5kLCBwaXBlU3ByaXRlcy5sdUJlbmQsIHBpcGVTcHJpdGVzLmxkQmVuZCwgcGlwZVNwcml0ZXMucmRCZW5kXVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvdXJUaWxlIGV4dGVuZHMgVGlsZSB7XG4gICAgY29uc3RydWN0b3IgKHdvcmxkKSB7XG4gICAgICAgIHN1cGVyKHdvcmxkKVxuICAgICAgICB0aGlzLnNwcml0ZXMgPSBbcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheSwgcGlwZVNwcml0ZXMuZm91cldheV1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJvdW5kVG8gKHZhbCwgaW5jKSB7XG4gICAgbGV0IG9mZkJ5ID0gKHZhbCAlIGluYyk7XG4gICAgaWYgKG9mZkJ5IDw9IGluYyAvIDIpIHtcbiAgICAgICAgcmV0dXJuIHZhbCAtIG9mZkJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWwgKyBpbmMgLSBvZmZCeTtcbiAgICB9XG59XG4iXX0=
