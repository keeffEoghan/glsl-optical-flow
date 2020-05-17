precision highp float;

uniform sampler2D frame;

varying vec2 uv;

void main() {
    gl_FragColor = texture2D(frame, uv);
}
