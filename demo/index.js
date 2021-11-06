// Any rendering library, but made with `regl` in mind.
import getRegl from 'regl';
import getUserMedia from 'getusermedia';
import { positions, count } from '@epok.tech/gl-screen-triangle';
import range from '@epok.tech/fn-lists/range';
import map from '@epok.tech/fn-lists/map';
import each from '@epok.tech/fn-lists/each';
import { wrapGet } from '@epok.tech/fn-lists/wrap-index';

import vert from '@epok.tech/gl-screen-triangle/uv-texture.vert.glsl';
import flowFrag from '../index.frag.glsl';
import blurFrag from './blur.frag.glsl';
import blendFrag from './blend.frag.glsl';
import viewFrag from './view.frag.glsl';

const canvas = document.querySelector('canvas');
const video = document.querySelector('video');

const regl = getRegl(canvas);

const blurMaps = map(() => regl.texture({ flipY: true }), range(2), 0);
const blurFrames = map((color) => regl.framebuffer({ color }), blurMaps);

const flowMaps = map(() => regl.texture(), range(2), 0);
const flowFrame = regl.framebuffer();

const blendFrames = map(() => regl.framebuffer(), range(2), 0);

const resizers = [...blurFrames, ...flowMaps, flowFrame, ...blendFrames];

video.autoplay = false;

const props = self.opticalFlow = {
    // The `blur` props array will blur in both axes one after the other.
    blur: {
        radius: 3,
        passes: map((v, i) => ({ axis: i }), blurFrames)
    },
    flow: {
        // Pixels units; will divide `offset` by the video resolution later.
        offset: 2,
        lambda: 0.1,
        alpha: 50,
        inRange: [-1, -1, 1, 1],
        outRange: [0, 0, 1, 1]
    },
    blend: { fade: 0.9 },
    view: {}
};

props.view.inRange = props.flow.inRange;
props.view.outRange = props.flow.outRange;

const drawScreen = regl({ vert, attributes: { position: positions }, count });

// Draw the current video frame and blur it in both axes.
const drawBlur = regl({
    frag: blurFrag,
    uniforms: {
        frame: (c, { axis, radius }) => {
            // 2-axis blur; only get `video` on the first `axis` of this `tick`.
            (axis || blurMaps[0].subimage(video));

            return blurFrames[axis];
        },
        axis: regl.prop('axis'),
        radius: regl.prop('radius'),
        width: regl.context('drawingBufferWidth'),
        height: regl.context('drawingBufferHeight')
    },
    framebuffer: (c, { axis }) => wrapGet(axis+1, blurFrames)
});

// Draws the 2 `passes` of `blur` across both axes one after the other.
function drawBlurProps() {
    const { blur } = props;

    // Pass any common `props` from `blur` to each of `passes`.
    return drawBlur(map((a) => Object.assign(a, blur, a), blur.passes, 0));
}

// Copy the contents of the last `blur` frame.
const copyBlurToFlow = (tick) =>
    blurFrames[0].use(() => wrapGet(tick, flowMaps)({ copy: true }));

// The main function of concern - get the optical flow from the last 2 frames.
const drawFlow = regl({
    frag: '#define opticalFlowMap opticalFlowMap_range\n'+flowFrag,
    uniforms: {
        view: ({ tick }) => wrapGet(tick, flowMaps),
        past: ({ tick }) => wrapGet(tick+1, flowMaps),
        offset: regl.prop('offset'),
        lambda: regl.prop('lambda'),
        alpha: regl.prop('alpha'),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    },
    framebuffer: flowFrame
});

const drawFlowProps = () => drawFlow(props.flow);

// Blend the `past` and `next` optical-flow frames.
const drawBlend = regl({
    frag: blendFrag,
    uniforms: {
        next: flowFrame,
        past: ({ tick }) => wrapGet(tick, blendFrames),
        fade: regl.prop('fade')
    },
    framebuffer: ({ tick }) => wrapGet(tick+1, blendFrames)
});

const drawBlendProps = () => drawBlend(props.blend);

const drawView = regl({
    frag: viewFrag,
    uniforms: {
        frame: ({ tick }) => wrapGet(tick+1, blendFrames),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    }
});

const drawViewProps = () => drawView(props.view);

const clear = { color: [0, 0, 0, 0], depth: 1, stencil: 0 };
const clearBlurs = map((f) => ({ ...clear, framebuffer: f }), blurFrames);
const clearFlow = { ...clear, framebuffer: flowFrame };
const clearBlends = map((f) => ({ ...clear, framebuffer: f }), blendFrames);

function drawScene({ tick }) {
    regl.clear(clear);
    regl.clear(wrapGet(tick+1, clearBlurs));
    regl.clear(clearFlow);
    regl.clear(wrapGet(tick+1, clearBlends));

    drawBlurProps();
    copyBlurToFlow(tick);
    drawFlowProps();
    drawBlendProps();
    drawViewProps();
}

video.addEventListener('canplay', () => {
    const { videoWidth: w, videoHeight: h } = video;

    canvas.width = w;
    canvas.height = h;
    each((v) => v.resize(w, video.videoHeight), resizers);
    props.offset /= Math.max(w, h, 1e3);
    video.play();

    regl.frame(() => drawScreen(drawScene));
});

getUserMedia({ video: true }, (e, stream) => {
    if(e) { console.warn(e); }
    else if('srcObject' in video) { video.srcObject = stream; }
    else { video.src = self.URL.createObjectURL(stream); }
});
