"use strict";

import {Game} from './game';
import {MediaManager} from './common/mediaManager.js'

var canvas = document.getElementById('screen');
var game = new Game(canvas, update, render);
let media = new MediaManager();
let pipeSprites = media.fetchSpriteSheet('./assets/pipes.png',
    [
        {x:0, y:0, w:32, h:32, name:'fourWay'},
        {x:31, y:0, w:96, h:32, name:'hLong'},
        {x:0, y:32, w:31, h:96, name:'vLong'},
        {x:95, y:32, w:32, h:32, name:'hShort'},
        {x:95, y:64, w:32, h:32, name:'vShort'},
        {x:31, y:32, w:32, h:32, name:'rdBend'},
        {x:63, y:32, w:31, h:32, name:'ldBend'},
        {x:31, y:64, w:32, h:32, name:'ruBend'},
        {x:63, y:64, w:32, h:32, name:'luBend'},
        {x:31, y:96, w:32, h:32, name:'dTee'},
        {x:31, y:128, w:32, h:32, name:'rTee'},
        {x:63, y:128, w:32, h:32, name:'uTee'},
        {x:63, y:96, w:32, h:32, name:'lTee'},
    ]);

var masterLoop = function(timestamp) {
  game.loop(timestamp);
  window.requestAnimationFrame(masterLoop);
}
masterLoop(performance.now());

function update(elapsedTime) {

  // TODO: Advance the fluid
}

function render(elapsedTime, ctx) {
    ctx.fillStyle = "#777777";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let x=0; x<=canvas.width; x+=32) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y=0; y<=canvas.width; y+=32) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.strokeStyle = 'grey';
    ctx.lineWidth = 2;
    ctx.stroke();
    pipeSprites.luBend.draw(ctx, 32, 32);
    pipeSprites.hLong.draw(ctx, 0, 0);
  // TODO: Render the board

}
