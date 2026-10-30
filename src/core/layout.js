// 全厂布局（单位：米）。主线沿 +X 方向流动。
// 为便于观察，时间做了压缩：屏幕上的 1 秒约相当于真实产线的数秒到数十秒。

export const V_RIBBON = 1.2; // 玻璃带演示速度 m/s
export const TIN_Y = 1.0; // 锡液面高度
export const LEHR_Y = 1.16; // 退火窑/冷端辊道顶面
export const RIBBON_W = 3.8; // 玻璃带毛宽
export const PLATE_W = 3.3; // 切边后板宽
export const PLATE_L = 3.0; // 横切板长
export const CUT_PERIOD = PLATE_L / V_RIBBON; // 横切周期

export const X = {
  batch0: -102,
  mixer: -79,
  furnaceBack: -66,
  melterEnd: -42,
  waistEnd: -38,
  workEnd: -32,
  canalEnd: -30.5,
  bath0: -30,
  bath1: 2,
  lehr0: 4,
  lehr1: 40,
  inspect: 44,
  cut: 48,
  longCut: 50.5,
  snap: 53,
  trim: 57,
  pick: 66,
  end: 72,
};

export const Z_TEMPER = 28; // 深加工（磨边-清洗-钢化）线
export const Z_BOTTLE = -30; // 瓶罐成型线

export const HALL = { x0: -106, x1: 80, rows: [-42, -19, 15, 40], span: 12, height: 13 };
