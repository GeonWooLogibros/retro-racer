export const WIDTH = 1024;
export const HEIGHT = 576;
export const STEP = 1 / 60;
export const MAX_FRAME_TIME = 0.1;

export const SEGMENT_LENGTH = 200;
export const ROAD_WIDTH = 2000;
export const RUMBLE_LENGTH = 3;
export const LANES = 3;
export const DRAW_DISTANCE = 200;
export const CAMERA_HEIGHT = 1000;
export const CAMERA_DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
export const PLAYER_DISTANCE = CAMERA_HEIGHT * CAMERA_DEPTH;
export const START_Z = SEGMENT_LENGTH * 10;

export const MAX_SPEED = SEGMENT_LENGTH * 60;
export const ACCEL = MAX_SPEED / 5;
export const BRAKE = -MAX_SPEED;
export const DECEL = -MAX_SPEED / 5;
export const OFFROAD_DECEL = -MAX_SPEED / 2;
export const OFFROAD_LIMIT = MAX_SPEED / 4;
export const STEER_RATE = 2;
export const CENTRIFUGAL = 0.25;
export const MAX_X = 2;

export const NITRO_MAX = 100;
export const NITRO_MIN = 30;
export const NITRO_DRAIN = 33;
export const NITRO_BOOST = 1.3;
export const NITRO_NEAR_GAIN = 25;
export const NITRO_PASS_GAIN = 5;

export const CAR_WIDTH = 560;
export const CAR_LENGTH = 300;
export const CAR_HIT_WIDTH = 0.3;
export const NEAR_MISS_WIDTH = 0.6;
export const CAR_COLOR_COUNT = 5;
export const TRAFFIC_SEED = 20261002;
export const TRAFFIC_ACTIVE_DISTANCE = DRAW_DISTANCE * SEGMENT_LENGTH;

export const PROP_HIT_WIDTH = 0.25;
export const PROP_CRASH_SPEED = MAX_SPEED / 20;

export const START_TIME = 60;
export const CHECKPOINT_BONUS = 30;
export const WARNING_SECONDS = 10;
export const THEME_BLEND_SECONDS = 2;

export const TOP_KMH = 240;
export const UNITS_PER_METER = 180;
