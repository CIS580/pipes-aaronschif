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
        this.collisions = new CollisionManager();
        this.collisions.actors = [new _tile.Tile(this)];

        this.mouseLocation = { x: 0, y: 0 };
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
        this.isDragging = true;
        let actors = this.collisions.collisionsAt(this.mouseLocation.x, this.mouseLocation.y);
        this.beingDragged = actors;
        for (let actor of actors) {
            actor.onStartDrag();
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
exports.Tile = undefined;

var _actor = require('./common/actor.js');

var _sprites = require('./sprites.js');

class Tile extends _actor.Actor {
    constructor(world) {
        super(world);
        this.width = 32;
        this.height = 32;
        this.dragHandle = null;
    }

    *baseRenderState() {
        while (true) {
            let { dt, ctx } = yield;
            _sprites.pipeSprites.lTee.draw(ctx, this.x, this.y);
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

    onStartDrag() {
        this.dragging = true;
        let x = this.x - this.world.mouseLocation.x;
        let y = this.y - this.world.mouseLocation.y;

        this.dragHandle = { x: x, y: y };
    }

    onStopDrag() {
        this.dragging = false;
        this.x -= this.x % 32;
        this.y -= this.y % 32;
    }
}
exports.Tile = Tile;

},{"./common/actor.js":2,"./sprites.js":6}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixF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Qzs7QUFFQSxhQUFLLFVBQUwsR0FBa0IsRUFBQyxHQUFFLENBQUgsRUFBTSxHQUFFLENBQVIsRUFBbEI7QUFDSDs7QUFFRCxpQkFBYztBQUNWLGFBQUssUUFBTCxHQUFnQixLQUFoQjtBQUNBLGFBQUssQ0FBTCxJQUFXLEtBQUssQ0FBTCxHQUFTLEVBQXBCO0FBQ0EsYUFBSyxDQUFMLElBQVcsS0FBSyxDQUFMLEdBQVMsRUFBcEI7QUFDSDtBQXZDMkI7UUFBbkIsSSxHQUFBLEkiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0dhbWV9IGZyb20gJy4vZ2FtZSc7XG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NyZWVuJyk7XG52YXIgZ2FtZSA9IG5ldyBHYW1lKGNhbnZhcyk7XG5cblxudmFyIG1hc3Rlckxvb3AgPSBmdW5jdGlvbih0aW1lc3RhbXApIHtcbiAgZ2FtZS5sb29wKHRpbWVzdGFtcCk7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFzdGVyTG9vcCk7XG59XG5tYXN0ZXJMb29wKHBlcmZvcm1hbmNlLm5vdygpKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQge0V2ZW50TGlzdGVuZXJ9IGZyb20gXCIuL2V2ZW50cy5qc1wiO1xuXG5cbmV4cG9ydCBjbGFzcyBBY3RvciB7XG4gICAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBuZXcgRXZlbnRMaXN0ZW5lcigpO1xuXG4gICAgICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDY0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICB9XG5cbiAgICBnZXRIaXRCb3hlcygpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbGxlY3QoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGN1ciA9IHRoaXMuY29udHJvbFN0YXRlLm5leHQoe2R0OiBkdH0pO1xuICAgICAgICBpZiAoY3VyLnZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xTdGF0ZSA9IHRoaXMuYmFzZUNvbnRyb2xTdGF0ZS5iaW5kKHRoaXMpKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoZHQsIGN0eCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5yZW5kZXJTdGF0ZS5uZXh0KHtkdDogZHQsIGN0eDogY3R4fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IGN1ci52YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXIuZG9uZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IHRoaXMuYmFzZVJlbmRlclN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICpiYXNlQ29udHJvbFN0YXRlICgpIHt9XG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cblxuZXhwb3J0IGNsYXNzIEV2ZW50TGlzdGVuZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IHt9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZnVuYykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRzO1xuXG4gICAgICAgIGV2ZW50cy5wdXNoKGZ1bmMpO1xuICAgIH1cblxuICAgIGVtaXQobmFtZSwgYXJncykge1xuICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgIGZvciAobGV0IGV2IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgZXYoYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNsYXNzIEltYWdlSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoe2ltZywgeCwgeSwgdywgaH0pIHtcbiAgICAgICAgdGhpcy5pbWcgPSBpbWc7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMud2lkdGggPSB3O1xuICAgICAgICB0aGlzLmhlaWdodCA9IGg7XG4gICAgfVxuXG4gICAgZHJhdyAoY3R4LCB4LCB5LCBzeD0xLCBzeT0xKSB7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoXG4gICAgICAgICAgICB0aGlzLmltZyxcbiAgICAgICAgICAgIHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHgsIHksIHRoaXMud2lkdGgqc3gsIHRoaXMuaGVpZ2h0KnN5XG4gICAgICAgIClcbiAgICB9XG59XG5cbmNsYXNzIEF1ZGlvSGFuZGxlIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNZWRpYU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cblxuICAgIGZldGNoU3ByaXRlU2hlZXQgKHVybCwgc3ByaXRlcykge1xuICAgICAgICBsZXQgc3ByaXRlU2hlZXQgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgc3ByaXRlU2hlZXQuc3JjID0gdXJsO1xuXG4gICAgICAgIGxldCBzcHJpdGVIYW5kbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IHNwcml0ZSA9IHNwcml0ZXNbaV07XG4gICAgICAgICAgICBzcHJpdGVIYW5kbGVzW2ldID0gbmV3IEltYWdlSGFuZGxlKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaW1nOiBzcHJpdGVTaGVldCxcbiAgICAgICAgICAgICAgICAgICAgeDogc3ByaXRlLngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHNwcml0ZS55LFxuICAgICAgICAgICAgICAgICAgICB3OiBzcHJpdGUudyxcbiAgICAgICAgICAgICAgICAgICAgaDogc3ByaXRlLmgsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChzcHJpdGUubmFtZSkge1xuICAgICAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbc3ByaXRlLm5hbWVdID0gc3ByaXRlSGFuZGxlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3ByaXRlSGFuZGxlcztcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7VGlsZX0gZnJvbSAnLi90aWxlJztcblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICAgIGNvbnN0cnVjdG9yKHNjcmVlbiwgbWVkaWFNYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMubWVkaWFNYW5hZ2VyID0gbWVkaWFNYW5hZ2VyO1xuXG4gICAgICAgIC8vIFNldCB1cCBidWZmZXJzXG4gICAgICAgIHRoaXMuY2FudmFzID0gdGhpcy5mcm9udEJ1ZmZlciA9IHNjcmVlbjtcbiAgICAgICAgdGhpcy5mcm9udEN0eCA9IHNjcmVlbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWNrQnVmZmVyLndpZHRoID0gc2NyZWVuLndpZHRoO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIuaGVpZ2h0ID0gc2NyZWVuLmhlaWdodDtcbiAgICAgICAgdGhpcy5iYWNrQ3R4ID0gdGhpcy5iYWNrQnVmZmVyLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgLy8gU3RhcnQgdGhlIGdhbWUgbG9vcFxuICAgICAgICB0aGlzLm9sZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNlZG93biA9IHRoaXMub25TdGFydERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZXVwID0gdGhpcy5vbkVuZERyYWcuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5jYW52YXMub25tb3VzZW1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY29sbGlzaW9ucyA9IG5ldyBDb2xsaXNpb25NYW5hZ2VyKCk7XG4gICAgICAgIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMgPSBbbmV3IFRpbGUodGhpcyldO1xuXG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiAwLCB5OiAwfTtcbiAgICB9XG5cbiAgICBwYXVzZSAoZmxhZykge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IChmbGFnID09IHRydWUpO1xuICAgIH1cblxuICAgIGxvb3AgKG5ld1RpbWUpIHtcbiAgICAgICAgdmFyIGdhbWUgPSB0aGlzO1xuICAgICAgICB2YXIgZWxhcHNlZFRpbWUgPSBuZXdUaW1lIC0gdGhpcy5vbGRUaW1lO1xuICAgICAgICB0aGlzLm9sZFRpbWUgPSBuZXdUaW1lO1xuXG4gICAgICAgIGlmKCF0aGlzLnBhdXNlZCkgdGhpcy51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB0aGlzLnJlbmRlcihlbGFwc2VkVGltZSwgdGhpcy5mcm9udEN0eCk7XG5cbiAgICAgICAgLy8gRmxpcCB0aGUgYmFjayBidWZmZXJcbiAgICAgICAgdGhpcy5mcm9udEN0eC5kcmF3SW1hZ2UodGhpcy5iYWNrQnVmZmVyLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZW5kZXIgKGVsYXBzZWRUaW1lLCBjdHgpIHtcbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMuY2FudmFzO1xuXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBcIiM3Nzc3NzdcIjtcbiAgICAgICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgZm9yIChsZXQgeD0wOyB4PD1jYW52YXMud2lkdGg7IHgrPTMyKSB7XG4gICAgICAgICAgICBjdHgubW92ZVRvKHgsIDApO1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh4LCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCB5PTA7IHk8PWNhbnZhcy53aWR0aDsgeSs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICAgICAgICBjdHgubGluZVRvKGNhbnZhcy53aWR0aCwgeSk7XG4gICAgICAgIH1cbiAgICAgICAgY3R4LnN0cm9rZVN0eWxlID0gJ2dyZXknO1xuICAgICAgICBjdHgubGluZVdpZHRoID0gMjtcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xuXG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuY29sbGlzaW9ucy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoZWxhcHNlZFRpbWUpIHtcbiAgICAgICAgdGhpcy5jb2xsaXNpb25zLnVwZGF0ZSgpO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmNvbGxpc2lvbnMuYWN0b3JzKSB7XG4gICAgICAgICAgICBhY3Rvci51cGRhdGUoZWxhcHNlZFRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TdGFydERyYWcgKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGxldCBhY3RvcnMgPSB0aGlzLmNvbGxpc2lvbnMuY29sbGlzaW9uc0F0KHRoaXMubW91c2VMb2NhdGlvbi54LCB0aGlzLm1vdXNlTG9jYXRpb24ueSk7XG4gICAgICAgIHRoaXMuYmVpbmdEcmFnZ2VkID0gYWN0b3JzO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiBhY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLm9uU3RhcnREcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuZERyYWcgKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuaXNEcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICBmb3IgKGxldCBhY3RvciBvZiB0aGlzLmJlaW5nRHJhZ2dlZCkge1xuICAgICAgICAgICAgYWN0b3Iub25TdG9wRHJhZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25Nb3VzZU1vdmUgKGV2ZW50KSB7XG4gICAgICAgIHRoaXMubW91c2VMb2NhdGlvbiA9IHt4OiBldmVudC5vZmZzZXRYLCB5OiBldmVudC5vZmZzZXRZfTtcbiAgICB9XG59XG5cbmNsYXNzIENvbGxpc2lvbk1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgdGhpcy5hY3RvcnMgPSBbXTtcbiAgICAgICAgdGhpcy50aWxlU2l6ZSA9IDMyO1xuICAgICAgICB0aGlzLl90aWxlcyA9IFtdO1xuICAgIH1cblxuICAgIGNvbGxpc2lvbnNBdCAoeCwgeSkge1xuICAgICAgICBsZXQgdGlsZSA9IHRoaXMuZ2V0VGlsZSh4LCB5KTtcbiAgICAgICAgcmV0dXJuIHRpbGU7XG4gICAgfVxuXG4gICAgZ2V0VGlsZSAoeCwgeSkge1xuICAgICAgICB4ID0gKHggLyB0aGlzLnRpbGVTaXplKXwwO1xuICAgICAgICB5ID0gKHkgLyB0aGlzLnRpbGVTaXplKXwwO1xuICAgICAgICByZXR1cm4gdGhpcy5fdGlsZXNbYCR7eH1fJHt5fWBdID0gdGhpcy5fdGlsZXNbYCR7eH1fJHt5fWBdIHx8IFtdO1xuICAgIH1cblxuICAgIHVwZGF0ZSAoKSB7XG4gICAgICAgIHRoaXMuYWN0b3JzLmZpbHRlcigoYSk9PiFhLmNvbGxlY3QoKSk7XG4gICAgICAgIHRoaXMuX3RpbGVzID0ge307XG4gICAgICAgIGZvciAobGV0IGFjdG9yIG9mIHRoaXMuYWN0b3JzKSB7XG4gICAgICAgICAgICBsZXQgdGlsZSA9IHRoaXMuZ2V0VGlsZShhY3Rvci54LCBhY3Rvci55KTtcbiAgICAgICAgICAgIHRpbGUucHVzaChhY3Rvcik7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7TWVkaWFNYW5hZ2VyfSBmcm9tICcuL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMnXG5cbmxldCBtZWRpYSA9IG5ldyBNZWRpYU1hbmFnZXIoKTtcblxuZXhwb3J0IGxldCBwaXBlU3ByaXRlcyA9IG1lZGlhLmZldGNoU3ByaXRlU2hlZXQoJy4vYXNzZXRzL3BpcGVzLnBuZycsXG4gICAgW1xuICAgICAgICB7eDowLCB5OjAsIHc6MzIsIGg6MzIsIG5hbWU6J2ZvdXJXYXknfSxcbiAgICAgICAge3g6MzEsIHk6MCwgdzo5NiwgaDozMiwgbmFtZTonaExvbmcnfSxcbiAgICAgICAge3g6MCwgeTozMiwgdzozMSwgaDo5NiwgbmFtZTondkxvbmcnfSxcbiAgICAgICAge3g6OTUsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J2hTaG9ydCd9LFxuICAgICAgICB7eDo5NSwgeTo2NCwgdzozMiwgaDozMiwgbmFtZTondlNob3J0J30sXG4gICAgICAgIHt4OjMxLCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidyZEJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6MzIsIHc6MzEsIGg6MzIsIG5hbWU6J2xkQmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo2NCwgdzozMiwgaDozMiwgbmFtZToncnVCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidsdUJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2RUZWUnfSxcbiAgICAgICAge3g6MzEsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOidyVGVlJ30sXG4gICAgICAgIHt4OjYzLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTondVRlZSd9LFxuICAgICAgICB7eDo2MywgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonbFRlZSd9LFxuICAgIF0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0FjdG9yfSBmcm9tICcuL2NvbW1vbi9hY3Rvci5qcyc7XG5pbXBvcnQge3BpcGVTcHJpdGVzfSBmcm9tICcuL3Nwcml0ZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgVGlsZSBleHRlbmRzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpO1xuICAgICAgICB0aGlzLndpZHRoID0gMzI7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gMzI7XG4gICAgICAgIHRoaXMuZHJhZ0hhbmRsZSA9IG51bGw7XG4gICAgfVxuXG4gICAgKmJhc2VSZW5kZXJTdGF0ZSAoKSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBsZXQge2R0LCBjdHh9ID0geWllbGQ7XG4gICAgICAgICAgICBwaXBlU3ByaXRlcy5sVGVlLmRyYXcoY3R4LCB0aGlzLngsIHRoaXMueSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAqYmFzZUNvbnRyb2xTdGF0ZSAoKSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICB0aGlzLmRyYWdnaW5nICY9IHRoaXMud29ybGQuaXNEcmFnZ2luZztcbiAgICAgICAgICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICAgICAgICAgICAgbGV0IHt4LCB5fSA9IHRoaXMud29ybGQubW91c2VMb2NhdGlvbjtcbiAgICAgICAgICAgICAgICB0aGlzLnggPSB4ICsgdGhpcy5kcmFnSGFuZGxlLng7XG4gICAgICAgICAgICAgICAgdGhpcy55ID0geSArIHRoaXMuZHJhZ0hhbmRsZS55O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeWllbGQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoKSB7XG4gICAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICBsZXQgeCA9IHRoaXMueCAtIHRoaXMud29ybGQubW91c2VMb2NhdGlvbi54O1xuICAgICAgICBsZXQgeSA9IHRoaXMueSAtIHRoaXMud29ybGQubW91c2VMb2NhdGlvbi55O1xuXG4gICAgICAgIHRoaXMuZHJhZ0hhbmRsZSA9IHt4OngsIHk6eX07XG4gICAgfVxuXG4gICAgb25TdG9wRHJhZyAoKSB7XG4gICAgICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy54IC09ICh0aGlzLnggJSAzMik7XG4gICAgICAgIHRoaXMueSAtPSAodGhpcy55ICUgMzIpO1xuICAgIH1cbn1cbiJdfQ==
