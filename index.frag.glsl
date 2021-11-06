/**
 * Optical flow fragment shader, for convenience.
 *
 * @see ./index.frag
 */

#define opticalFlowMap_none 0
#define opticalFlowMap_range 1
#ifndef opticalFlowMap
    #define opticalFlowMap opticalFlowMap_none
#endif

precision highp float;

uniform sampler2D view;
uniform sampler2D past;
uniform float offset;
uniform float lambda;
uniform float alpha;

// Optionally map the flow ([-1, 1]) to a different range (e.g: [0, 255]).
#if opticalFlowMap == opticalFlowMap_range
    uniform vec4 inRange;
    uniform vec4 outRange;

    #pragma glslify: map = require(glsl-map)
#endif

varying vec2 uv;

#pragma glslify: opticalFlow = require('./index');

void main() {
    vec2 flow = opticalFlow(uv, view, past, offset, lambda);
    float strength = 1.0;

    // Optionally map the flow ([-1, 1]) to a different range (e.g: [0, 255]).
    #if opticalFlowMap == opticalFlowMap_range
        strength = dot(flow, flow);
        flow = map(flow, inRange.xy, inRange.zw, outRange.xy, outRange.zw);
    #endif

    gl_FragColor = vec4(flow, 0.0, clamp(strength*alpha, 0.0, 1.0));
}
