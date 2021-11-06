precision highp float;

uniform sampler2D frame;
uniform vec2 axis;
uniform float width;
uniform float height;

varying vec2 uv;

#pragma glslify: blur = require(glsl-fast-gaussian-blur/13)

void main() {
    gl_FragColor = blur(frame, uv, vec2(width, height), axis);
}
