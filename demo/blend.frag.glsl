precision highp float;

uniform sampler2D next;
uniform sampler2D past;
uniform float fade;

varying vec2 uv;

void main() {
    vec4 to = texture2D(next, uv);

    gl_FragColor = mix(texture2D(past, uv)*fade, to, to.a);
}
