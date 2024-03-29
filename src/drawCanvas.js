//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function drawCanvas(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
  if (arguments.length === 9) {
    return new Instruction('drawCanvasSource', {
      img: canvas.id,
      sx: sx,
      sy: sy,
      sWidth: sWidth,
      sHeight: sHeight,
      dx: dx,
      dy: dy,
      dWidth: dWidth,
      dHeight: dHeight
    });
  }
  
  if (arguments.length >= 5) {
    return new Instruction('drawCanvasSize', {
      img: canvas.id,
      dx: sx,
      dy: sy,
      dWidth: sWidth,
      dHeight: sHeight
    });
  }
  
  if (arguments.length >= 3) {
    return new Instruction('drawCanvas', {
      img: canvas.id,
      dx: sx,
      dy: sy
    });
  }  

  return new Instruction('drawCanvas', {
    img: canvas.id,
    dx: 0,
    dy: 0
  });
}

module.exports = drawCanvas;