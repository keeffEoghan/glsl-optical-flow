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

// Each axis of blur.
const blurMaps = map(() => regl.texture(), range(2), 0);
const blurFrames = map((c) => regl.framebuffer({ color: c }), blurMaps);

// Past and present frames for optical flow.
const flowMaps = map(() => regl.texture(), range(2), 0);
const flowFrames = map((c) => regl.framebuffer({ color: c }), flowMaps);
const flowTo = regl.framebuffer();

// Past and present frames to blend.
const blendFrames = map(() => regl.framebuffer(), range(2), 0);

const resizers = [...blurFrames, ...flowFrames, flowTo, ...blendFrames];

video.autoplay = false;

const inRange = [-1, -1, 1, 1];
const outRange = [0, 0, 1, 1];

const props = self.opticalFlow = {
    videoSample: { data: video, flipY: true },
    blurVideo: {
        axes: [[1, 0], [0, 1]],
        /**
         * The `passes` props array will blur in both axes one after the other.
         * Blurs the first axis of the first blur frame into the next frame,
         * then the last axis of that frame into the flow input.
         *
         * @see drawBlurVideo
         */
        passes: map((v, a) => ({ axis: a }), blurFrames)
    },
    flow: {
        // Pixels units; will divide `offset` by the video resolution later.
        offset: 3,
        lambda: 1e-2, alpha: 50, inRange, outRange
    },
    blurPast: {
        axes: [[1, 0], [0, 1]],
        /**
         * The `passes` props array will blur in both axes one after the other.
         * Blurs the first axis of the first blur frame into the next frame,
         * then the last axis of that frame into the past blend frame.
         *
         * @see drawBlurPast
         */
        passes: map((v, a) => ({ axis: a }), blurFrames)
    },
    blend: { fade: 0.99 },
    view: { inRange, outRange }
};

const clearView = { color: [0, 0, 0, 0], depth: 1, stencil: 0 };
const clearBlurs = map((f) => ({ ...clearView, framebuffer: f }), blurFrames);
const clearFlows = map((f) => ({ ...clearView, framebuffer: f }), flowFrames);
const clearFlow = { ...clearView, framebuffer: flowTo };
const clearBlends = map((f) => ({ ...clearView, framebuffer: f }), blendFrames);

function clear(tick){
    regl.clear(clearView);
    regl.clear(wrapGet(tick, clearFlows));
    regl.clear(clearFlow);
    regl.clear(wrapGet(tick, clearBlends));
}

const drawScreen = regl({ vert, attributes: { position: positions }, count });

// Draw the current video frame and blur it across both axes.
const drawBlur = regl({
    frag: blurFrag,
    uniforms: {
        // Swap by `axis`; allow `frame` to override if given.
        frame: (c, { frame: f, axis: a }) => (f || wrapGet(a+1, blurFrames)),
        // Pass `axis` of declared `axes`; easier blur direction/scale control.
        axis: (c, { axes, axis: a }) => axes[a],
        radius: regl.prop('radius'),
        width: regl.context('drawingBufferWidth'),
        height: regl.context('drawingBufferHeight')
    },
    // Swap by `axis`; allow `to` to  override `framebuffer` if given.
    framebuffer: (c, { to, axis: a }) => (to || wrapGet(a, blurFrames))
});

// Draws the 2 `passes` of `blur` across both axes one after the other.
function drawBlurProps(blur) {
    // Pass any common `props` from `blur` to each of `passes`.
    return drawBlur(map((a) => Object.assign(a, blur, a), blur.passes, 0));
}

// Blur the input video's current frame, into the next flow frame.
function drawBlurVideo(tick) {
    const { videoSample: s, blurVideo: b } = props;

    each(regl.clear, clearBlurs);
    blurMaps[1](s);
    b.passes[1].to = wrapGet(tick, flowFrames);

    return drawBlurProps(b);
}

// The main function of concern - get the optical flow from the last 2 frames.

const drawFlow = regl({
    frag: '#define opticalFlowMap opticalFlowMap_range\n'+flowFrag,
    uniforms: {
        next: ({ tick: t }) => wrapGet(t, flowMaps),
        past: ({ tick: t }) => wrapGet(t+1, flowMaps),
        offset: regl.prop('offset'),
        lambda: regl.prop('lambda'),
        alpha: regl.prop('alpha'),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    },
    framebuffer: flowTo
});

const drawFlowProps = () => drawFlow(props.flow);

// Blur the past blend frame.
function drawBlurPast(tick) {
    const b = props.blurPast;
    const ps = b.passes;

    each(regl.clear, clearBlurs);
    ps[0].frame = wrapGet(tick+1, blendFrames);

    return drawBlurProps(b);
}

// Blend the `past` and `next` optical-flow frames.
const drawBlend = regl({
    frag: blendFrag,
    uniforms: {
        next: flowTo,
        // This will have the blurred result of the past frame.
        past: wrapGet(-1, blurFrames),
        fade: regl.prop('fade')
    },
    framebuffer: ({ tick: t }) => wrapGet(t, blendFrames)
});

const drawBlendProps = () => drawBlend(props.blend);

const drawView = regl({
    frag: viewFrag,
    uniforms: {
        frame: ({ tick: t }) => wrapGet(t, blendFrames),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    }
});

const drawViewProps = () => drawView(props.view);

function drawScene(tick){
    // Blur the input video's current frame.
    drawBlurVideo(tick);
    // Get the optical flow from the last 2 frames.
    drawFlowProps();
    // Blur the past frame.
    drawBlurPast(tick);
    // Blend the last 2 frames with some amount of `fade`.
    drawBlendProps();
    // Draw to the screen.
    drawViewProps();
}

function draw({ tick: t }) {
    clear(t);
    drawScene(t);
}

video.addEventListener('canplay', () => {
    const { videoWidth: w, videoHeight: h } = video;

    canvas.width = w;
    canvas.height = h;
    each((v) => v.resize(w, video.videoHeight), resizers);
    // Pixels units; divide `offset` by the video resolution.
    props.flow.offset /= Math.max(w, h, 1e3);
    video.play();

    regl.frame(() => drawScreen(draw));
});

getUserMedia({ video: true }, (e, stream) => {
    if(e) { console.warn(e); }
    else if('srcObject' in video) { video.srcObject = stream; }
    else { video.src = self.URL.createObjectURL(stream); }
});
