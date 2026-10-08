import { MAP_HEIGHT, MAP_WIDTH } from './library-model.ts';

// Leave room around boundary stops without changing saved map coordinates.
export const MAP_PADDING = 64;
export const MAP_CANVAS_WIDTH = MAP_WIDTH + MAP_PADDING * 2;
export const MAP_CANVAS_HEIGHT = MAP_HEIGHT + MAP_PADDING * 2;
