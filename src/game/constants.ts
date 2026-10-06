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

export const DRIFT_MIN_SPEED = MAX_SPEED / 2;
export const DRIFT_STEER = 1.6;
/** 드리프트 중에 커브가 차량을 바깥으로 미는 힘의 비율. */
export const DRIFT_GRIP = 0.6;
export const DRIFT_SPEED_CAP = 0.85;
/** 드리프트를 이만큼 유지하면 터보 단계가 하나씩 오릅니다(초). */
export const TURBO_LEVEL_TIMES = [0.5, 1.1, 1.8];
/** 단계별로 드리프트를 끝낼 때 붙는 터보 시간(초). */
export const TURBO_TIMES = [0.3, 0.55, 0.8];
export const TURBO_BOOST = 1.18;
/** 드리프트를 끝낼 때 단계마다 더 채워 주는 부스터 게이지. */
export const TURBO_LEVEL_GAUGE = 8;
/** 드리프트를 끝낸 뒤 반대 방향키로 순간 부스터를 쓸 수 있는 시간(초)과, 그때 더해지는 터보 시간(초). */
export const COUNTER_WINDOW = 0.3;
export const COUNTER_TIME = 0.5;
/** 드리프트하는 동안 1초에 차는 부스터 게이지. */
export const DRIFT_GAUGE_RATE = 22;

export const GAUGE_MAX = 100;
export const BOOSTER_SLOTS = 2;
export const NITRO_DURATION = 1.6;
export const NITRO_BOOST = 1.35;
/** 부스터나 터보가 켜져 있을 때의 가속 배율. */
export const BOOST_ACCEL = 2.5;

/** 연속 보너스가 이어지는 시간(초)과, 보너스마다 더 채워 주는 게이지(연속 횟수에 곱함, 상한 있음). */
export const COMBO_WINDOW = 3;
export const COMBO_GAUGE = 3;
export const COMBO_GAUGE_MAX = 15;

/** 부딪혔을 때 남기는 속도의 비율. 길가 사물, 떨어짐 순서입니다. */
export const CRASH_KEEP = 0.5;
export const FALL_KEEP = 0.4;

export const CAR_WIDTH = 560;
export const CAR_LENGTH = 300;
export const CAR_HIT_WIDTH = 0.3;

/** 이 세기 이상인 커브는 감속하거나 드리프트해야 돌 수 있습니다. */
export const SHARP_CURVE = 5;

/** 라이벌이 급커브에서 줄이는 속도 비율과, 플레이어와 멀어졌을 때 따라잡거나 기다리는 속도 비율. */
export const RIVAL_CURVE_SLOW = 0.86;
export const RIVAL_CATCH_UP = 1.08;
export const RIVAL_WAIT = 0.9;
/** 라이벌이 플레이어보다 이만큼 뒤처지거나 앞서면 따라잡거나 기다립니다. */
export const RIVAL_BEHIND = SEGMENT_LENGTH * 30;
export const RIVAL_AHEAD = SEGMENT_LENGTH * 30;
/** 라이벌의 뒤를 들이받았을 때 남기는 속도 비율. 라이벌보다 느려지지는 않습니다. */
export const RIVAL_BUMP_KEEP = 0.92;

export const PROP_HIT_WIDTH = 0.25;
export const PROP_CRASH_SPEED = MAX_SPEED / 20;

export const START_TIME = 60;
export const CHECKPOINT_BONUS = 30;
export const WARNING_SECONDS = 10;
export const THEME_BLEND_SECONDS = 2;

export const TOP_KMH = 240;
export const UNITS_PER_METER = 180;
