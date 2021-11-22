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

// Blend with past frame.
// #define opticalFlowSpreadBlend

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
        uniform vec4 toRange;

        #pragma glslify: map = require(glsl-map)
    #endif
#endif

#ifdef opticalFlowSpreadBlend
    uniform sampler2D other;
    uniform float blend;
#endif

varying vec2 uv;

#pragma glslify: blur = require(glsl-fast-gaussian-blur/5)

#if opticalFlowSpreadShift != opticalFlowSpreadShift_none
    vec2 shift(vec2 uv, sampler2D flow) {
        vec2 f = texture2D(flow, uv).xy;

        // Reverse any mapping of the flow values.
        #ifdef opticalFlowSpreadMap
            f = map(f, toRange.xy, toRange.zw, inRange.xy, inRange.zw);
        #endif

        return uv+(f*speed);
    }
#endif

void main() {
    vec2 st = uv;

    // Shift the sample lookup by a `flow` lookup.
    #if opticalFlowSpreadShift == opticalFlowSpreadShift_flow
        // Use the given `flow` input.
        st = shift(st, flow);
    #elif opticalFlowSpreadShift == opticalFlowSpreadShift_frame
        // Use the `frame` itself as `flow` input.
        st = shift(st, frame);
    #endif

    // Perform a `blur`.
    #ifdef opticalFlowSpreadBlur
        vec4 c = blur(frame, st, vec2(width, height), axis);
    #else
        vec4 c = texture2D(frame, st);
    #endif

    // Map back to any given range.
    #ifdef opticalFlowSpreadMap
        c.xy = map(c.xy, toRange.xy, toRange.zw, inRange.xy, inRange.zw);
    #endif

    // Scale values output by `tint`.
    #ifdef opticalFlowSpreadTint
        c *= tint;
    #endif

    // Reverse any mapping.
    #ifdef opticalFlowSpreadMap
        c.xy = map(c.xy, inRange.xy, inRange.zw, toRange.xy, toRange.zw);
    #endif

    #ifdef opticalFlowSpreadBlend
        vec4 o = texture2D(other, uv);

        c = mix(c, o, mix(1.0-c.a, o.a, blend));
    #endif

    gl_FragColor = c;
}
