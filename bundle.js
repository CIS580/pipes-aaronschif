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

        this.actors = [new _tile.Tile()];
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

        for (let actor of this.actors) {
            actor.render(elapsedTime, ctx);
        }
    }

    update(elapsedTime) {
        for (let actor of this.actors) {
            actor.update(elapsedTime);
        }
    }

    onStartDrag(event) {
        console.log('foo)_');
    }

    onEndDrag(event) {}
}
exports.Game = Game;

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
        console.log(this.controlState);
    }

    *baseRenderState() {
        while (true) {
            let { dt, ctx } = yield;
            _sprites.pipeSprites.lTee.draw(ctx, 0, 0);
        }
    }

    *baseControlState() {
        while (true) {
            yield;
        }
    }
}
exports.Tile = Tile;

},{"./common/actor.js":2,"./sprites.js":6}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbW1vbi9hY3Rvci5qcyIsInNyYy9jb21tb24vZXZlbnRzLmpzIiwic3JjL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMiLCJzcmMvZ2FtZS5qcyIsInNyYy9zcHJpdGVzLmpzIiwic3JjL3RpbGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUFFQTs7QUFFQSxJQUFJLFNBQVMsU0FBUyxjQUFULENBQXdCLFFBQXhCLENBQWI7QUFDQSxJQUFJLE9BQU8sZUFBUyxNQUFULENBQVg7O0FBR0EsSUFBSSxhQUFhLFVBQVMsU0FBVCxFQUFvQjtBQUNuQyxPQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0EsU0FBTyxxQkFBUCxDQUE2QixVQUE3QjtBQUNELENBSEQ7QUFJQSxXQUFXLFlBQVksR0FBWixFQUFYOzs7QUNaQTs7Ozs7OztBQUVBOztBQUdPLE1BQU0sS0FBTixDQUFZO0FBQ2YsZ0JBQVksS0FBWixFQUFtQjtBQUNmLGFBQUssTUFBTCxHQUFjLDJCQUFkOztBQUVBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLENBQUwsR0FBUyxDQUFUO0FBQ0EsYUFBSyxDQUFMLEdBQVMsQ0FBVDtBQUNBLGFBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxFQUFkOztBQUVBLGFBQUssWUFBTCxHQUFvQixLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLEdBQXBCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLEtBQUssZUFBTCxDQUFxQixJQUFyQixDQUEwQixJQUExQixHQUFuQjtBQUNIOztBQUVELGtCQUFjO0FBQ1YsZUFBTyxFQUFQO0FBQ0g7O0FBRUQsY0FBVTtBQUNOLGVBQU8sS0FBUDtBQUNIOztBQUVELFdBQU8sRUFBUCxFQUFXO0FBQ1AsWUFBSSxNQUFNLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixF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QUFELEdBQXFCO0FBQ2pCLGVBQU8sSUFBUCxFQUFhO0FBQ1Q7QUFDSDtBQUNKO0FBakIyQjtRQUFuQixJLEdBQUEsSSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7R2FtZX0gZnJvbSAnLi9nYW1lJztcblxudmFyIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY3JlZW4nKTtcbnZhciBnYW1lID0gbmV3IEdhbWUoY2FudmFzKTtcblxuXG52YXIgbWFzdGVyTG9vcCA9IGZ1bmN0aW9uKHRpbWVzdGFtcCkge1xuICBnYW1lLmxvb3AodGltZXN0YW1wKTtcbiAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShtYXN0ZXJMb29wKTtcbn1cbm1hc3Rlckxvb3AocGVyZm9ybWFuY2Uubm93KCkpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7RXZlbnRMaXN0ZW5lcn0gZnJvbSBcIi4vZXZlbnRzLmpzXCI7XG5cblxuZXhwb3J0IGNsYXNzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgICAgICB0aGlzLmV2ZW50cyA9IG5ldyBFdmVudExpc3RlbmVyKCk7XG5cbiAgICAgICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgICAgICB0aGlzLnggPSAwO1xuICAgICAgICB0aGlzLnkgPSAwO1xuICAgICAgICB0aGlzLndpZHRoID0gNjQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gNjQ7XG5cbiAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSB0aGlzLmJhc2VDb250cm9sU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgIH1cblxuICAgIGdldEhpdEJveGVzKCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29sbGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgY3VyID0gdGhpcy5jb250cm9sU3RhdGUubmV4dCh7ZHQ6IGR0fSk7XG4gICAgICAgIGlmIChjdXIudmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sU3RhdGUgPSBjdXIudmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VyLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbFN0YXRlID0gdGhpcy5iYXNlQ29udHJvbFN0YXRlLmJpbmQodGhpcykoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihkdCwgY3R4KSB7XG4gICAgICAgIGxldCBjdXIgPSB0aGlzLnJlbmRlclN0YXRlLm5leHQoe2R0OiBkdCwgY3R4OiBjdHh9KTtcbiAgICAgICAgaWYgKGN1ci52YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gY3VyLnZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5kb25lKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gdGhpcy5iYXNlUmVuZGVyU3RhdGUuYmluZCh0aGlzKSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge31cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHt9XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuXG5leHBvcnQgY2xhc3MgRXZlbnRMaXN0ZW5lciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBmdW5jKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSBldmVudHM7XG5cbiAgICAgICAgZXZlbnRzLnB1c2goZnVuYyk7XG4gICAgfVxuXG4gICAgZW1pdChuYW1lLCBhcmdzKSB7XG4gICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgZm9yIChsZXQgZXYgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgICBldihhcmdzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY2xhc3MgSW1hZ2VIYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICh7aW1nLCB4LCB5LCB3LCBofSkge1xuICAgICAgICB0aGlzLmltZyA9IGltZztcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgdGhpcy53aWR0aCA9IHc7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gaDtcbiAgICB9XG5cbiAgICBkcmF3IChjdHgsIHgsIHksIHN4PTEsIHN5PTEpIHtcbiAgICAgICAgY3R4LmRyYXdJbWFnZShcbiAgICAgICAgICAgIHRoaXMuaW1nLFxuICAgICAgICAgICAgdGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LFxuICAgICAgICAgICAgeCwgeSwgdGhpcy53aWR0aCpzeCwgdGhpcy5oZWlnaHQqc3lcbiAgICAgICAgKVxuICAgIH1cbn1cblxuY2xhc3MgQXVkaW9IYW5kbGUge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcblxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lZGlhTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuXG4gICAgfVxuXG4gICAgZmV0Y2hTcHJpdGVTaGVldCAodXJsLCBzcHJpdGVzKSB7XG4gICAgICAgIGxldCBzcHJpdGVTaGVldCA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBzcHJpdGVTaGVldC5zcmMgPSB1cmw7XG5cbiAgICAgICAgbGV0IHNwcml0ZUhhbmRsZXMgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcHJpdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgc3ByaXRlID0gc3ByaXRlc1tpXTtcbiAgICAgICAgICAgIHNwcml0ZUhhbmRsZXNbaV0gPSBuZXcgSW1hZ2VIYW5kbGUoXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpbWc6IHNwcml0ZVNoZWV0LFxuICAgICAgICAgICAgICAgICAgICB4OiBzcHJpdGUueCxcbiAgICAgICAgICAgICAgICAgICAgeTogc3ByaXRlLnksXG4gICAgICAgICAgICAgICAgICAgIHc6IHNwcml0ZS53LFxuICAgICAgICAgICAgICAgICAgICBoOiBzcHJpdGUuaCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKHNwcml0ZS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgc3ByaXRlSGFuZGxlc1tzcHJpdGUubmFtZV0gPSBzcHJpdGVIYW5kbGVzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzcHJpdGVIYW5kbGVzO1xuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHtUaWxlfSBmcm9tICcuL3RpbGUnO1xuXG5leHBvcnQgY2xhc3MgR2FtZSB7XG4gICAgY29uc3RydWN0b3Ioc2NyZWVuLCBtZWRpYU1hbmFnZXIpIHtcbiAgICAgICAgdGhpcy5tZWRpYU1hbmFnZXIgPSBtZWRpYU1hbmFnZXI7XG5cbiAgICAgICAgLy8gU2V0IHVwIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy5jYW52YXMgPSB0aGlzLmZyb250QnVmZmVyID0gc2NyZWVuO1xuICAgICAgICB0aGlzLmZyb250Q3R4ID0gc2NyZWVuLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLmJhY2tCdWZmZXIud2lkdGggPSBzY3JlZW4ud2lkdGg7XG4gICAgICAgIHRoaXMuYmFja0J1ZmZlci5oZWlnaHQgPSBzY3JlZW4uaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhY2tDdHggPSB0aGlzLmJhY2tCdWZmZXIuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgICAgICAvLyBTdGFydCB0aGUgZ2FtZSBsb29wXG4gICAgICAgIHRoaXMub2xkVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLm9ubW91c2Vkb3duID0gdGhpcy5vblN0YXJ0RHJhZy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhbnZhcy5vbm1vdXNldXAgPSB0aGlzLm9uRW5kRHJhZy5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuYWN0b3JzID0gW25ldyBUaWxlKCldO1xuICAgIH1cblxuICAgIHBhdXNlIChmbGFnKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gKGZsYWcgPT0gdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9vcCAobmV3VGltZSkge1xuICAgICAgICB2YXIgZ2FtZSA9IHRoaXM7XG4gICAgICAgIHZhciBlbGFwc2VkVGltZSA9IG5ld1RpbWUgLSB0aGlzLm9sZFRpbWU7XG4gICAgICAgIHRoaXMub2xkVGltZSA9IG5ld1RpbWU7XG5cbiAgICAgICAgaWYoIXRoaXMucGF1c2VkKSB0aGlzLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIHRoaXMucmVuZGVyKGVsYXBzZWRUaW1lLCB0aGlzLmZyb250Q3R4KTtcblxuICAgICAgICAvLyBGbGlwIHRoZSBiYWNrIGJ1ZmZlclxuICAgICAgICB0aGlzLmZyb250Q3R4LmRyYXdJbWFnZSh0aGlzLmJhY2tCdWZmZXIsIDAsIDApO1xuICAgIH1cblxuICAgIHJlbmRlciAoZWxhcHNlZFRpbWUsIGN0eCkge1xuICAgICAgICBsZXQgY2FudmFzID0gdGhpcy5jYW52YXM7XG5cbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiIzc3Nzc3N1wiO1xuICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgICBmb3IgKGxldCB4PTA7IHg8PWNhbnZhcy53aWR0aDsgeCs9MzIpIHtcbiAgICAgICAgICAgIGN0eC5tb3ZlVG8oeCwgMCk7XG4gICAgICAgICAgICBjdHgubGluZVRvKHgsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IHk9MDsgeTw9Y2FudmFzLndpZHRoOyB5Kz0zMikge1xuICAgICAgICAgICAgY3R4Lm1vdmVUbygwLCB5KTtcbiAgICAgICAgICAgIGN0eC5saW5lVG8oY2FudmFzLndpZHRoLCB5KTtcbiAgICAgICAgfVxuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAnZ3JleSc7XG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAyO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG5cbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnJlbmRlcihlbGFwc2VkVGltZSwgY3R4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoZWxhcHNlZFRpbWUpIHtcbiAgICAgICAgZm9yIChsZXQgYWN0b3Igb2YgdGhpcy5hY3RvcnMpIHtcbiAgICAgICAgICAgIGFjdG9yLnVwZGF0ZShlbGFwc2VkVGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblN0YXJ0RHJhZyAoZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2ZvbylfJylcbiAgICB9XG5cbiAgICBvbkVuZERyYWcgKGV2ZW50KSB7XG5cbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7TWVkaWFNYW5hZ2VyfSBmcm9tICcuL2NvbW1vbi9tZWRpYU1hbmFnZXIuanMnXG5cbmxldCBtZWRpYSA9IG5ldyBNZWRpYU1hbmFnZXIoKTtcblxuZXhwb3J0IGxldCBwaXBlU3ByaXRlcyA9IG1lZGlhLmZldGNoU3ByaXRlU2hlZXQoJy4vYXNzZXRzL3BpcGVzLnBuZycsXG4gICAgW1xuICAgICAgICB7eDowLCB5OjAsIHc6MzIsIGg6MzIsIG5hbWU6J2ZvdXJXYXknfSxcbiAgICAgICAge3g6MzEsIHk6MCwgdzo5NiwgaDozMiwgbmFtZTonaExvbmcnfSxcbiAgICAgICAge3g6MCwgeTozMiwgdzozMSwgaDo5NiwgbmFtZTondkxvbmcnfSxcbiAgICAgICAge3g6OTUsIHk6MzIsIHc6MzIsIGg6MzIsIG5hbWU6J2hTaG9ydCd9LFxuICAgICAgICB7eDo5NSwgeTo2NCwgdzozMiwgaDozMiwgbmFtZTondlNob3J0J30sXG4gICAgICAgIHt4OjMxLCB5OjMyLCB3OjMyLCBoOjMyLCBuYW1lOidyZEJlbmQnfSxcbiAgICAgICAge3g6NjMsIHk6MzIsIHc6MzEsIGg6MzIsIG5hbWU6J2xkQmVuZCd9LFxuICAgICAgICB7eDozMSwgeTo2NCwgdzozMiwgaDozMiwgbmFtZToncnVCZW5kJ30sXG4gICAgICAgIHt4OjYzLCB5OjY0LCB3OjMyLCBoOjMyLCBuYW1lOidsdUJlbmQnfSxcbiAgICAgICAge3g6MzEsIHk6OTYsIHc6MzIsIGg6MzIsIG5hbWU6J2RUZWUnfSxcbiAgICAgICAge3g6MzEsIHk6MTI4LCB3OjMyLCBoOjMyLCBuYW1lOidyVGVlJ30sXG4gICAgICAgIHt4OjYzLCB5OjEyOCwgdzozMiwgaDozMiwgbmFtZTondVRlZSd9LFxuICAgICAgICB7eDo2MywgeTo5NiwgdzozMiwgaDozMiwgbmFtZTonbFRlZSd9LFxuICAgIF0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0FjdG9yfSBmcm9tICcuL2NvbW1vbi9hY3Rvci5qcyc7XG5pbXBvcnQge3BpcGVTcHJpdGVzfSBmcm9tICcuL3Nwcml0ZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgVGlsZSBleHRlbmRzIEFjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAod29ybGQpIHtcbiAgICAgICAgc3VwZXIod29ybGQpO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmNvbnRyb2xTdGF0ZSlcbiAgICB9XG5cbiAgICAqYmFzZVJlbmRlclN0YXRlICgpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGxldCB7ZHQsIGN0eH0gPSB5aWVsZDtcbiAgICAgICAgICAgIHBpcGVTcHJpdGVzLmxUZWUuZHJhdyhjdHgsIDAsIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgKmJhc2VDb250cm9sU3RhdGUgKCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgeWllbGQ7XG4gICAgICAgIH1cbiAgICB9XG59XG4iXX0=
