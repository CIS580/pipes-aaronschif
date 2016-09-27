'use strict';

import {MediaManager} from './common/mediaManager.js'

let media = new MediaManager();

export let pipeSprites = media.fetchSpriteSheet('./assets/pipes.png',
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
