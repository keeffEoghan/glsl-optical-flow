/**
 * Optical flow shader. May work best if the views are pre-processed (e.g: blur).
 *
 * @see https://forum.openframeworks.cc/t/ofxflowtools-optical-flow-fluid-dynamics-and-particles-in-glsl/15470
 * @see https://github.com/moostrik/ofxFlowTools
 * @see https://github.com/diwi/PixelFlow
 * @see http://thomasdiewald.com/blog/?p=2766
 * @see https://adamferriss.com/gush/
 * @see https://github.com/princemio/ofxMIOFlowGLSL/blob/master/src/FlowShader.cpp
 */

precision highp float;

// To provide external `pixel` lookup function, set to `opticalFlowPixel_extern`.
#define opticalFlowPixel_extern 0
#define opticalFlowPixel_normal 1
#define opticalFlowPixel_luma 2
#ifndef opticalFlowPixel
    #define opticalFlowPixel opticalFlowPixel_luma
#endif

#define opticalFlowMap_none 0
#define opticalFlowMap_range 1
#ifndef opticalFlowMap
    #define opticalFlowMap opticalFlowMap_none
#endif

uniform sampler2D view;
uniform sampler2D past;
uniform float offset;
uniform float lambda;

#if opticalFlowMap == opticalFlowMap_range
    #pragma glslify: map = require('glsl-map');

    uniform vec4 inRange;
    uniform vec4 outRange;
#endif

varying vec2 uv;

const vec2 zero = vec2(0.0);

#if opticalFlowPixel == opticalFlowPixel_normal
    vec4 pixel(sampler2D texture, vec2 uv) {
        return texture2D(texture, uv);
    }
#elif opticalFlowPixel == opticalFlowPixel_luma
    #pragma glslify: luma = require('glsl-luma');

    vec4 pixel(sampler2D texture, vec2 uv) {
        vec4 color = texture2D(texture, uv);

        return vec4(vec3(luma(color)), color.a);
    }
#endif

void main() {
    vec2 offsetX = vec2(offset, 0.0);
    vec2 offsetY = vec2(0.0, offset);

    // Gradient

    vec4 gradX = (pixel(view, uv+offsetX)-pixel(view, uv-offsetX))+
        (pixel(past, uv+offsetX)-pixel(past, uv-offsetX));

    vec4 gradY = (pixel(view, uv+offsetY)-pixel(view, uv-offsetY))+
        (pixel(past, uv+offsetY)-pixel(past, uv-offsetY));

    vec4 gradMag = sqrt((gradX*gradX)+(gradY*gradY)+vec4(lambda));

    // Difference
    vec4 diff = pixel(view, uv)-pixel(past, uv);
    vec2 flow = vec2((diff*(gradX/gradMag)).x, (diff*(gradY/gradMag)).x);

    #if opticalFlowMap == opticalFlowMap_range
        flow = map(flow, inRange.xy, inRange.zw, outRange.xy, outRange.zw);
    #endif

    gl_FragColor = vec4(flow, 0.0, 1.0);
}
