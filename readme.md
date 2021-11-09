# `glsl-optical-flow`

[![Optical flow advection demo](./snap/demo.png)](https://epok.tech/glsl-optical-flow "Optical flow advection demo")

Optical flow shader for WebGL - BYORenderer.

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

[Check out the demo](http://epok.tech/glsl-optical-flow/), and its [source code](https://github.com/keeffEoghan/glsl-optical-flow/blob/master/demo/), a comprehensive example of blurring input, blending across frames, and advecting by the flow to get smooth optical-flow over time:

You may also use this in your shader...
```glsl
precision highp float;

uniform sampler2D next;
uniform sampler2D past;
uniform float offset;
uniform float lambda;

varying vec2 uv;

#pragma glslify: opticalFlow = require(@epok.tech/glsl-optical-flow)

void main() {
    gl_FragColor = vec4(opticalFlow(uv, next, past, offset, lambda), 0.0, 1.0);
}
```

... or [the provided fragment shader](https://github.com/keeffEoghan/glsl-optical-flow/blob/master/index.frag.glsl), for example, or for direct usage (with `glslify`).

## See Also

Based on:
- Original use in [`tendrils`](https://github.com/keeffEoghan/tendrils).
- `ofxFlowTools` [article](https://forum.openframeworks.cc/t/ofxflowtools-optical-flow-fluid-dynamics-and-particles-in-glsl/15470) and [code](https://github.com/moostrik/ofxFlowTools).
- [`PixelFlow`](https://github.com/diwi/PixelFlow).
- [Thomas DieWald](http://thomasdiewald.com/blog/?p=2766).
- [Adam Ferriss](https://adamferriss.com/gush/).
- [`ofxMIOFlowGLSL`, based on work by Andrew Benson](https://github.com/princemio/ofxMIOFlowGLSL/blob/master/src/FlowShader.cpp).
- [`glslify`](https://github.com/glslify/glslify).
