// Any rendering library, but made with `regl` in mind.
import getRegl from 'regl';
import getUserMedia from 'getusermedia';
import { positions, count } from '@epok.tech/gl-screen-triangle';
import { range, map, each, wrapGet } from '@epok.tech/array-utils';

import vert from '@epok.tech/gl-screen-triangle/uv-texture.vert.glsl';
import drawFrag from '../index.frag.glsl';
import fadeFrag from './fade.frag.glsl';
import copyFrag from './copy.frag.glsl';

const canvas = document.querySelector('canvas');
const video = document.querySelector('video');
const regl = getRegl(canvas);
const views = map(() => regl.texture({ flipY: true }), range(2), 0);
const flowFrame = regl.framebuffer();
const fadeFrames = map(() => regl.framebuffer(), range(2), 0);
const resizers = [...views, flowFrame, ...fadeFrames];

video.autoplay = false;

const props = window.opticalFlow = {
    offset: 0.1,
    lambda: 0.001,
    alpha: 100,
    inRange: [-1, -1, 1, 1],
    outRange: [0, 0, 1, 1]
};

const drawScreen = regl({ vert, attributes: { position: positions }, count });

const drawFlow = regl({
    frag: '#define opticalFlowMap opticalFlowMap_range\n\n'+drawFrag,
    uniforms: {
        view: ({ tick }) => wrapGet(tick, views).subimage(video),
        past: ({ tick }) => wrapGet(tick+1, views),
        offset: regl.prop('offset'),
        lambda: regl.prop('lambda'),
        alpha: regl.prop('alpha'),
        inRange: regl.prop('inRange'),
        outRange: regl.prop('outRange')
    }
});

const drawFlowProps = () => drawFlow(props);

const drawFade = regl({
    frag: fadeFrag,
    uniforms: {
        next: flowFrame,
        past: ({ tick }) => wrapGet(tick, fadeFrames),
        fade: 0.9
    },
    framebuffer: ({ tick }) => wrapGet(tick+1, fadeFrames)
});

const drawView = regl({
    frag: copyFrag,
    uniforms: { frame: ({ tick }) => wrapGet(tick+1, fadeFrames) }
});

const clear = { color: [0, 0, 0, 0], depth: 1, stencil: 0 };

video.addEventListener('canplay', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    each((v) => v.resize(video.videoWidth, video.videoHeight), resizers);
    video.play();

    regl.frame(({ tick }) => drawScreen(() => {
        regl.clear(clear);
        regl.clear({ ...clear, framebuffer: flowFrame });
        regl.clear({ ...clear, framebuffer: wrapGet(tick+1, fadeFrames) });
        flowFrame.use(drawFlowProps);
        drawFade();
        drawView();
    }));
});

getUserMedia({ video: true }, (e, stream) => {
    if(e) { console.warn(e); }
    else if('srcObject' in video) { video.srcObject = stream; }
    else { video.src = self.URL.createObjectURL(stream); }
});
