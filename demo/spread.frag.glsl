// Perform a `blur`.
// #define opticalFlowSpreadBlur

// Scale values output by a `tint`.
// #define opticalFlowSpreadTint

// Shift the sample lookup by a `flow` lookup.
#define opticalFlowSpreadShift_none 0
#define opticalFlowSpreadShift_frame 1
#define opticalFlowSpreadShift_flow 2
#ifndef opticalFlowSpreadShift
    #define opticalFlowSpreadShift opticalFlowSpreadShift_none
#endif

// Map any flow values.
// #define opticalFlowSpreadMap

precision highp float;

uniform sampler2D frame;

// Perform a `blur`.
#ifdef opticalFlowSpreadBlur
    uniform vec2 axis;
    uniform float width;
    uniform float height;
#endif

// Alter the values output, scaling by a `tint`.
#ifdef opticalFlowSpreadTint
    uniform vec4 tint;
#endif

#if opticalFlowSpreadShift != opticalFlowSpreadShift_none
    // Shift the sample lookup by a `flow` lookup.
    uniform vec2 speed;

    // Use a separate `flow` input.
    #if opticalFlowSpreadShift == opticalFlowSpreadShift_flow
        uniform sampler2D flow;
    #endif

    // Map any flow values.
    #ifdef opticalFlowSpreadMap
        uniform vec4 inRange;
        uniform vec4 outRange;

        #pragma glslify: map = require(glsl-map)
    #endif
#endif

varying vec2 uv;

#pragma glslify: blur = require(glsl-fast-gaussian-blur)

#if opticalFlowSpreadShift != opticalFlowSpreadShift_none
    vec2 shift(vec2 uv, sampler2D flow) {
        vec2 f = texture2D(flow, uv).xy;

        // Reverse any mapping of the flow values.
        #ifdef opticalFlowSpreadMap
            f = map(f, outRange.xy, outRange.zw, inRange.xy, inRange.zw);
        #endif

        // Follow any `blur` axis.
        #ifdef opticalFlowSpreadBlur
            f *= axis;
        #endif
        // #ifdef opticalFlowSpreadBlur
        //     f *= dot(axis, speed);
        // #else
        //     f *= speed;
        // #endif

        // return uv+(f*speed);
        return uv+f;
    }
#endif

void main() {
    // Shift the sample lookup by a `flow` lookup.
    #if opticalFlowSpreadShift == opticalFlowSpreadShift_flow
        // Use the given `flow` input.
        vec2 st = shift(uv, flow);
    #elif opticalFlowSpreadShift == opticalFlowSpreadShift_frame
        // Use the `frame` itself as `flow` input.
        vec2 st = shift(uv, frame);
    #else
        vec2 st = uv;
    #endif

    // Perform a `blur`.
    #ifdef opticalFlowSpreadBlur
        vec4 color = blur(frame, st, vec2(width, height), axis);
    #else
        vec4 color = texture2D(frame, st);
    #endif

    // Scale values output by `tint`.
    #ifdef opticalFlowSpreadTint
        color *= tint;
    #endif

    gl_FragColor = color;
}
