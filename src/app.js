'use strict';

import {Game} from './game';

var canvas = document.getElementById('screen');
var game = new Game(canvas);

let rate = 4,
    tick = 0;

var masterLoop = function(timestamp) {
    if (tick++ % rate !== 0) {
        game.loop(timestamp);
    }
    window.requestAnimationFrame(masterLoop);
}
masterLoop(performance.now());


export let soundEffect = new Audio(encodeURI('bong.ogg'))

let audio = new Audio(encodeURI('bgm_action_2.mp3'))
audio.loop = true
audio.play()
