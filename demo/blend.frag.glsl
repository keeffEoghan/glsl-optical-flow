precision highp float;

uniform sampler2D next;
uniform sampler2D past;
uniform float fade;

varying vec2 uv;

void main() {
    vec4 p = texture2D(past, uv)*fade;
    vec4 n = texture2D(next, uv);

    // @todo Work out why visual artefacts remain.
    gl_FragColor = mix(p, n, n.a);
}
