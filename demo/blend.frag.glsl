// @todo Merge this with the `spread` pass?

precision highp float;

uniform sampler2D next;
uniform sampler2D past;
uniform float fade;

varying vec2 uv;

void main() {
    vec4 p = texture2D(past, uv)*fade;
    vec4 n = texture2D(next, uv);

    gl_FragColor = mix(p, n, n.a);
}
