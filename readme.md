# `glsl-optical-flow`

Optical flow for WebGL - BYORenderer.

No drawing dependencies - for easier compatibility with any renderer which may rely on tracking the WebGL state (e.g: [`regl`](https://github.com/regl-project/regl/)).

[Check out the demo](http://epok.tech/glsl-optical-flow/).

## Installation

Install from [`npm`](https://www.npmjs.com/package/@epok.tech/glsl-optical-flow) using:
```bash
npm install @epok.tech/glsl-optical-flow
```
or:
```bash
yarn add @epok.tech/glsl-optical-flow
```

## Usage

[Check out the demo](http://epok.tech/glsl-optical-flow/), and its [source code](./example/):

```javascript
// Any rendering library, but made with `regl` in mind.
import getRegl from 'regl';
import getUserMedia from 'getusermedia';
import { positions, count } from '@epok.tech/gl-screen-triangle';
import { range, map, each, wrapGet } from '@epok.tech/array-utils';

import vert from '@epok.tech/gl-screen-triangle/uv-texture.vert.glsl';
import frag from '../index.frag.glsl';

const canvas = document.querySelector('canvas');
const video = document.querySelector('video');
const regl = getRegl(canvas);
const views = map(() => regl.texture({ flipY: true }), range(2), 0);

video.autoplay = false;

const props = window.opticalFlow = {
    offset: 0.1,
    lambda: 0.001,
    inRange: [-1, -1, 1, 1],
    outRange: [0, 0, 1, 1]
};

const drawFlow = regl({
    vert,
    frag: '#define opticalFlowMap opticalFlowMap_range\n\n'+frag,
    attributes: { position: positions },
    uniforms: {
        view: ({ tick }) => wrapGet(tick, views).subimage(video),
        past: ({ tick }) => wrapGet(tick+1, views),
        offset: regl.prop('offset'),
        lambda: regl.prop('lambda'),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    },
    count
});

const clear = { color: [0, 0, 0, 1], depth: 1, stencil: 0 };

video.addEventListener('canplay', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    each((view) => view.resize(video.videoWidth, video.videoHeight), views);
    video.play();

    regl.frame((c) => {
        regl.clear(clear);
        drawFlow(props);
    });
});

getUserMedia({ video: true }, (e, stream) => {
    if(e) {
        console.warn(e);
    }
    else if('srcObject' in video) {
        video.srcObject = stream;
    }
    else {
        video.src = self.URL.createObjectURL(stream);
    }
});
```

## See Also

Based on:
- Original use in [`tendrils`](https://github.com/keeffEoghan/tendrils).
- `ofxFlowTools` [article](https://forum.openframeworks.cc/t/ofxflowtools-optical-flow-fluid-dynamics-and-particles-in-glsl/15470) and [code](https://github.com/moostrik/ofxFlowTools).
- [`PixelFlow`](https://github.com/diwi/PixelFlow).
- [Thomas DieWald](http://thomasdiewald.com/blog/?p=2766).
- [Adam Ferriss](https://adamferriss.com/gush/).
- [`ofxMIOFlowGLSL`, based on work by Andrew Benson](https://github.com/princemio/ofxMIOFlowGLSL/blob/master/src/FlowShader.cpp).
