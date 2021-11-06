precision highp float;

uniform sampler2D frame;
uniform float axis;
uniform float radius;
uniform float width;
uniform float height;

varying vec2 uv;

#pragma glslify: blur = require(glsl-fast-gaussian-blur/13)

vec2 x = vec2(0.0, 1.0);
vec2 y = vec2(1.0, 0.0);

void main() {
    gl_FragColor = blur(frame, uv, vec2(width, height), mix(x, y, axis)*radius);
}
