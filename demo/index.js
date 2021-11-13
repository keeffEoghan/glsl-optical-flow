// Any rendering library, but made with `regl` in mind.
import getRegl from 'regl';
import getUserMedia from 'getusermedia';
import { positions, count } from '@epok.tech/gl-screen-triangle';
import range from '@epok.tech/fn-lists/range';
import map from '@epok.tech/fn-lists/map';
import each from '@epok.tech/fn-lists/each';
import { wrapIndex, wrapGet } from '@epok.tech/fn-lists/wrap-index';

import vert from '@epok.tech/gl-screen-triangle/uv-texture.vert.glsl';
import flowFrag from '../index.frag.glsl';
import spreadFrag from './spread.frag.glsl';
import viewFrag from './view.frag.glsl';

const demo = document.querySelector('.demo');
const video = demo.querySelector('.webcam');
const canvas = demo.querySelector('.output');

const regl = getRegl({
    canvas,
    optionalExtensions: [
        'oes_texture_half_float', 'oes_texture_float',
        'oes_texture_float_linear'
    ]
});

const float = (regl.hasExtension('oes_texture_float_linear') &&
    ((regl.hasExtension('oes_texture_float'))? 'float'
    :   (regl.hasExtension('oes_texture_half_float') && 'half float')));

// Whether to remap values between `float`/`int` in textures.
const remap = !float;
const mapProps = { type: (float || 'uint8'), min: 'linear', mag: 'linear' };
const getMap = () => regl.texture(mapProps);
const getFrame = () => regl.framebuffer({ color: getMap() });

// Each blur axis of spread.
const spreadMaps = map(getMap, range(2), 0);
const spreadFrames = map((c) => regl.framebuffer({ color: c }), spreadMaps);

// Past and next `video` frames for optical-flow.
const flowFrames = map(getFrame, range(2), 0);
const flowTo = getFrame();

// Past and next optical-flow frames to blend.
const blendFrames = map(getFrame, range(2), 0);

const resizers = [...spreadFrames, ...flowFrames, flowTo, ...blendFrames];

const inRange = [-1, -1, 1, 1];
const outRange = [0, 0, 1, 1];

const props = self.opticalFlow = {
    videoFrame: { data: video, flipY: true },
    spreadVideo: {
        /**
         * Blur the video.
         *
         * @see drawSpreadVideoProps
         */
        frag: '#define opticalFlowSpreadBlur\n'+spreadFrag,

        /**
         * The `passes` props array spreads blur one axis after the other.
         * Blurs the first axis of the first frame into the next frame, then
         * the last axis of that frame into the first frame.
         *
         * @see drawSpreadProps
         */
        passes: map((a, p) => ({ axis: a, pass: p }), [[1.4, 0], [0, 1.4]],
            0)
    },
    flow: {
        // Pixels units; will divide `offset` by the video resolution later.
        offset: 3,
        lambda: 1e-3,
        speed: Array(2).fill(1),
        alpha: 100,
        inRange, outRange
    },
    spreadFlow: {
        /**
         * Blur the past flow frames along each `axis`, shift/advect along
         * the `flow` by `speed`, `tint` to weaken the past flow, `blend` in
         * the next optical-flow frame.
         *
         * @see drawSpreadFlowProps
         */
        frag: '#define opticalFlowSpreadBlur\n'+
            '#define opticalFlowSpreadTint\n'+
            '#define opticalFlowSpreadShift opticalFlowSpreadShift_flow\n'+
            ((remap)? '#define opticalFlowSpreadMap\n' : '')+
            '#define opticalFlowSpreadBlend\n'+
            spreadFrag,

        other: flowTo, blend: 1,
        inRange, outRange,

        /**
         * Bear in mind each of the `passes` per-`axis` also apply the other
         * `spread` inputs; some may be better to control per-`pass`, others
         * across both.
         *
         * @see props.spreadVideo.passes
         */
        passes: map((o, p) => {
                o.pass = p;

                return o;
            },
            [
                {
                    axis: [3, 0], tint: Array(4).fill(1),
                    speed: Array(2).fill(0)
                },
                {
                    axis: [0, 3], tint: Array(4).fill(0.99),
                    speed: Array(2).fill(1)
                }
            ],
            0)
    },
    view: { inRange, outRange }
};

const clearView = { color: [0, 0, 0, 1], depth: 1, stencil: 0 };
const clearFlow = { ...clearView, framebuffer: flowTo };

const clearFlows = map((f) => ({ ...clearView, framebuffer: f }),
    flowFrames);

const clearSpreads = map((f) => ({ ...clearView, framebuffer: f }),
    spreadFrames);

const clearBlends = map((f) => ({ ...clearView, framebuffer: f }),
    blendFrames);

const drawScreen = regl({
    vert, attributes: { position: positions }, count,
    depth: { enable: false }
});

// Spread a frame `pass`; blur along an `axis`, shift by a `flow`, `blend`
// with an `other` map; if given.
const drawSpread = regl({
    frag: (c, { frag: f = spreadFrag }) => f,
    uniforms: {
        // Swap by `pass`; allow `frame` to override if given.
        frame: (c, { pass: p = 0, frame: f }) =>
            (f ?? wrapGet(p+1, spreadFrames)),

        axis: regl.prop('axis'),
        tint: regl.prop('tint'),
        speed: regl.prop('speed'),
        flow: regl.prop('flow'),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange'),
        other: regl.prop('other'),
        blend: regl.prop('blend'),
        width: regl.context('drawingBufferWidth'),
        height: regl.context('drawingBufferHeight')
    },
    // Swap by `pass`; allow `to` to  override `framebuffer` if given.
    framebuffer: (c, { pass: p = 0, to = wrapGet(p, spreadFrames) }) => to
});

// Draws the 2 spread blur `passes` across both axes one after the other.
function drawSpreadProps(props) {
    // Merge any common `props` into each of `props.passes`.
    return drawSpread(map((pass) => Object.assign(pass, props, pass),
        props.passes, 0));
}

// Blur the input video's current frame, into the next flow input frame.
function drawSpreadVideoProps(tick) {
    const { videoFrame, spreadVideo } = props;
    const f = wrapIndex(tick, flowFrames.length);

    each(regl.clear, clearSpreads);
    spreadMaps[1](videoFrame);

    regl.clear(clearFlows[f]);
    spreadVideo.passes[1].to = flowFrames[f];

    return drawSpreadProps(spreadVideo);
}

// The main function of concern - optical flow of the last 2 `video` frames.
const drawFlow = regl({
    frag: ((remap)? '#define opticalFlowMap\n' : '')+flowFrag,
    uniforms: {
        next: ({ tick: t }) => wrapGet(t, flowFrames),
        past: ({ tick: t }) => wrapGet(t+1, flowFrames),
        offset: regl.prop('offset'),
        lambda: regl.prop('lambda'),
        speed: regl.prop('speed'),
        alpha: regl.prop('alpha'),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    },
    framebuffer: flowTo
});

function drawFlowProps() {
    regl.clear(clearFlow);

    return drawFlow(props.flow);
}

/**
 * Blur the past flow frames along each `axis`, shift/advect along the
 * `flow` by `speed`, `tint` to weaken the past flow, `blend` in the next
 * optical-flow frame.
 *
 * @see props.spreadFlow
 */
function drawSpreadFlowProps(tick) {
    const { spreadFlow } = props;
    const { passes } = spreadFlow;

    each(regl.clear, clearSpreads);
    spreadFlow.flow = passes[0].frame = wrapGet(tick+1, blendFrames);

    const b = wrapIndex(tick, blendFrames.length);

    regl.clear(clearBlends[b]);
    passes[1].to = blendFrames[b];

    return drawSpreadProps(spreadFlow);
}

// Draw to the screen.
const drawView = regl({
    frag: ((remap)? '#define opticalFlowViewMap\n' : '')+viewFrag,
    uniforms: {
        frame: ({ tick: t }) => wrapGet(t, blendFrames),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    }
});

function drawViewProps() {
    regl.clear(clearView);

    return drawView(props.view);
}

// All together now.
function draw({ tick: t }) {
    // Blur the input video's current frame.
    drawSpreadVideoProps(t);
    // Get the optical flow from the last 2 `video` frames.
    drawFlowProps();
    // Spread the past flow frame and blend with the next one.
    drawSpreadFlowProps(t);
    // Draw to the screen.
    drawViewProps();
}

video.addEventListener('canplay', () => {
    const { videoWidth: w, videoHeight: h } = video;

    video.width = canvas.width = w;
    video.height = canvas.height = h;
    each((v) => v.resize(w, video.videoHeight), resizers);
    // Pixels units; divide `offset` by the video resolution.
    props.flow.offset /= Math.max(w, h, 1e3);
    video.play();

    // Fill the flow frames with the first frame.
    drawScreen(() => {
        drawSpreadVideoProps(0);
        drawSpreadVideoProps(1);
    });

    // Start the main loop.
    regl.frame(() => drawScreen(draw));
});

demo.addEventListener('click', () => {
    const c = demo.classList;

    c[(c.contains('overlay'))? 'remove' : 'add']('overlay');
});

getUserMedia({ video: true }, (e, stream) => {
    if(e) { console.warn(e); }
    else if('srcObject' in video) { video.srcObject = stream; }
    else { video.src = self.URL.createObjectURL(stream); }
});
