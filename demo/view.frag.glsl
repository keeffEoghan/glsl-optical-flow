precision highp float;

uniform sampler2D frame;

// Reverse any mapping performed in the flow shader.
uniform vec4 inRange;
uniform vec4 outRange;

varying vec2 uv;

#pragma glslify: pi = require(glsl-constants/PI)
#pragma glslify: tau = require(glsl-constants/TWO_PI)
#pragma glslify: hslToRGB = require(glsl-hsl2rgb)
#pragma glslify: map = require(glsl-map)

void main() {
    vec4 data = texture2D(frame, uv);
    // Reverse any mapping performed in the flow shader.
    vec2 flow = map(data.xy, outRange.xy, outRange.zw, inRange.xy, inRange.zw);
    float a = data.a;
    // Angle to hue - red right, green up, cyan left, magenta down.
    vec3 color = hslToRGB((atan(flow.y, flow.x)/tau), 0.9*a, 0.6*a);

    gl_FragColor = vec4(color, a);
}
