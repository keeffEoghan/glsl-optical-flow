precision highp float;

uniform sampler2D next;
uniform sampler2D past;
uniform float fade;

varying vec2 uv;

void main() {
    gl_FragColor = max(texture2D(next, uv), texture2D(past, uv)*fade);
}
