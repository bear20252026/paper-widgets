import type { SkinId } from "./types";
import { getLang, t } from "../i18n";

export type SkinRarity = "普通" | "稀有" | "史诗" | "传说";
export type SkinPattern = "gloss" | "stripe" | "dots" | "checker" | "aurora" | "gold";

/**
 * Body structure. "classic" = round gummy segments; every other form replaces
 * the silhouette entirely (carriages, pencil stroke, star links, lanterns …).
 * Forms are render-only: hitbox, speed and boost are identical for all skins.
 */
export type SkinForm =
  | "classic"
  | "train"
  | "pencil"
  | "starchart"
  | "lantern"
  | "pixel"
  | "helix"
  | "paperchain"
  | "comet"
  | "koi"
  | "jellyfish"
  | "cinema"
  | "kite"
  | "botanical"
  | "zipper"
  | "clockwork"
  | "orbital";

export interface Skin {
  id: SkinId;
  name: string;
  tagline: string;
  price: number;
  rarity: SkinRarity;
  form: SkinForm;
  pattern: SkinPattern;
  /** body colours, shared by the renderer art and the menu previews */
  palette: [string, string, string];
  head: string;
  belly: string;
  eye: string;
  shine: string;
  free?: boolean;
  collection?: "paper-objects" | "curious-objects";
  englishName?: string;
}

export const FORM_INFO: Record<SkinForm, { label: string; desc: string; icon: string }> = {
  botanical: { label: "分枝藤蔓", desc: "一根会转弯的藤蔓，交错的叶片轻轻摆动，小花随着前进舒展。", icon: "leaf" },
  zipper: { label: "双轨拉链", desc: "拉链头牵引两条织物布边，金属齿交错咬合，拉片随转向轻摆。", icon: "zipper" },
  clockwork: { label: "镂空齿轮", desc: "连杆串起反向转动的黄铜齿轮，加速时转得更快；连接杆也属于身体。", icon: "gear" },
  orbital: { label: "卫星轨道", desc: "小飞碟领航，卫星在轨道前后环绕；轨道之间的光带也属于身体。", icon: "orbit" },
  koi: { label: "折纸鳍片", desc: "折叠鳍片沿曲线开合，红白纸鳞层叠，扇形尾鳍随转向舒展。", icon: "koi" },
  jellyfish: { label: "流体触须", desc: "半透明伞帽缓缓呼吸，三股触须沿身体交错摆动，告别圆球节段。", icon: "wave" },
  cinema: { label: "连续胶片", desc: "双卷盘放映机牵引穿孔胶片，画格沿途变换，转弯像展开一卷电影。", icon: "film" },
  kite: { label: "连翼风筝", desc: "菱形纸鸢引领双翼风帆，织绳贯穿中央，燕尾纸带轻轻翻动。", icon: "kite" },
  classic: { label: "经典圆润", desc: "Q 弹果冻节段，双色环纹交替", icon: "●" },
  train: { label: "列车铰接", desc: "火车头领跑，车厢过弯时逐节铰接摆动，车钩相连", icon: "🚂" },
  pencil: { label: "铅笔描线", desc: "蛇头是一支铅笔，蛇身是正在画下的速写线", icon: "✏️" },
  starchart: { label: "星图连线", desc: "月亮领路，星点闪烁，由光线连成你的星座", icon: "✦" },
  lantern: { label: "灯笼舞龙", desc: "龙头开道，金绳串起一路摇摆的红灯笼与流苏", icon: "🏮" },
  pixel: { label: "像素方块", desc: "8-bit 方块永不旋转，蛇头按四个方向切换", icon: "▦" },
  helix: { label: "双链螺旋", desc: "两股链条前后交替旋转，前链放大、后链收暗", icon: "🧬" },
  paperchain: { label: "纸环链条", desc: "千纸鹤牵引彩纸环，平环与侧环一环扣一环", icon: "🕊️" },
  comet: { label: "流星焰尾", desc: "火球领头，焰尾由黄转红并在尾端收束成火星", icon: "☄️" },
};

/**
 * Visual only. A skin never changes speed, hitbox, appetite or boost.
 * "grid" is the graph-paper camouflage skin; the second block are the
 * structural skins that break away from the round-segment silhouette.
 */
export const SKINS: Skin[] = [
  {
    id: "koi", name: "纸间锦鲤", englishName: "Paper Koi",
    tagline: "把一张纸，折成一尾会游泳的好奇心。",
    price: 0, rarity: "稀有", form: "koi", pattern: "gloss",
    palette: ["#ee7653", "#ba4533", "#f7e5cd"], head: "#ee7653",
    belly: "#fffcf2", eye: "#243b36", shine: "#fff8e9", free: true, collection: "paper-objects",
  },
  {
    id: "jellyfish", name: "水母电台", englishName: "Jelly Radio",
    tagline: "不必有脚，也能把温柔传到很远。",
    price: 280, rarity: "史诗", form: "jellyfish", pattern: "gloss",
    palette: ["#aa9fe7", "#59588c", "#cde6e1"], head: "#b3a5e8",
    belly: "#f2edf9", eye: "#383950", shine: "#ffffff", collection: "paper-objects",
  },
  {
    id: "cinema", name: "胶片旅行", englishName: "Little Cinema",
    tagline: "每绕一个弯，故事就多一帧。",
    price: 460, rarity: "史诗", form: "cinema", pattern: "gloss",
    palette: ["#3c6661", "#263f3b", "#e8bc71"], head: "#3c6661",
    belly: "#f5e8d0", eye: "#20312e", shine: "#fff6d8", collection: "paper-objects",
  },
  {
    id: "kite", name: "风筝来信", englishName: "Air Mail",
    tagline: "借一阵风，把想象放长一点。",
    price: 580, rarity: "传说", form: "kite", pattern: "gloss",
    palette: ["#e9b84c", "#3f7870", "#f0ddd0"], head: "#e9b84c",
    belly: "#fff6de", eye: "#273f37", shine: "#fff9e9", collection: "paper-objects",
  },
  {
    id: "garden", name: "游走花园", englishName: "Wandering Garden",
    tagline: "把一小片春天，种进自己的轨迹里。",
    price: 0, rarity: "稀有", form: "botanical", pattern: "gloss",
    palette: ["#65876b", "#385944", "#d6c276"], head: "#839962",
    belly: "#f4ead2", eye: "#263d2d", shine: "#fff9e8", free: true, collection: "curious-objects",
  },
  {
    id: "zip", name: "一口拉链", englishName: "Zip Along",
    tagline: "把散落的光点，一口一口拉进故事里。",
    price: 340, rarity: "史诗", form: "zipper", pattern: "gloss",
    palette: ["#4b7770", "#2d514d", "#e5bd71"], head: "#d9b46c",
    belly: "#eee1c2", eye: "#30433b", shine: "#fff5d8", collection: "curious-objects",
  },
  {
    id: "clockwork", name: "发条游龙", englishName: "Brass Parade",
    tagline: "每一个小齿轮，都有自己的前进方向。",
    price: 620, rarity: "传说", form: "clockwork", pattern: "gloss",
    palette: ["#c39251", "#526e66", "#efcf91"], head: "#d8a65d",
    belly: "#f7ebd1", eye: "#253f37", shine: "#fff4d9", collection: "curious-objects",
  },
  {
    id: "orbit", name: "环游计划", englishName: "Tiny Orbit",
    tagline: "带上自己的小宇宙，慢慢环游。",
    price: 880, rarity: "传说", form: "orbital", pattern: "gloss",
    palette: ["#829fb1", "#485b72", "#e5bd79"], head: "#94b4bf",
    belly: "#e6eef0", eye: "#273d4a", shine: "#fffaf0", collection: "curious-objects",
  },
  {
    id: "mint",
    englishName: "Mint Soda",
    name: "薄荷苏打",
    tagline: "一出生就自带清凉感",
    price: 0,
    rarity: "普通",
    form: "classic",
    pattern: "gloss",
    palette: ["#3eccb0", "#27b494", "#8ce9d2"],
    head: "#35c3a7",
    belly: "#c9f7ea",
    eye: "#153f39",
    shine: "#ffffff",
    free: true,
  },
  {
    id: "peach",
    englishName: "Peach Fizz",
    name: "蜜桃汽水",
    tagline: "甜度超标，速度不变",
    price: 0,
    rarity: "普通",
    form: "classic",
    pattern: "stripe",
    palette: ["#ff9d7a", "#ff7d5c", "#ffd0ad"],
    head: "#ff906e",
    belly: "#ffe6ce",
    eye: "#4a241c",
    shine: "#fff7ef",
    free: true,
  },
  {
    id: "sketch",
    englishName: "Sketch Pencil",
    name: "速写铅笔",
    tagline: "边走边画，整条蛇就是一笔速写",
    price: 0,
    rarity: "普通",
    form: "pencil",
    pattern: "gloss",
    palette: ["#ffd23f", "#e0a800", "#fff1a8"],
    head: "#ffd23f",
    belly: "#fff7d6",
    eye: "#2d2a26",
    shine: "#ffffff",
    free: true,
  },
  {
    id: "grape",
    englishName: "Grape Gummy",
    name: "葡萄软糖",
    tagline: "Q 弹到会发光",
    price: 180,
    rarity: "稀有",
    form: "classic",
    pattern: "gloss",
    palette: ["#a985f5", "#8d63e8", "#d8c6ff"],
    head: "#9c74ef",
    belly: "#ece2ff",
    eye: "#2c1a51",
    shine: "#ffffff",
  },
  {
    id: "caramel",
    englishName: "Caramel Pudding",
    name: "焦糖布丁",
    tagline: "慢火熬煮的温柔",
    price: 260,
    rarity: "稀有",
    form: "classic",
    pattern: "dots",
    palette: ["#f2b65c", "#e09a35", "#ffe2a8"],
    head: "#eaa94c",
    belly: "#fff0cb",
    eye: "#4a3011",
    shine: "#fff9e8",
  },
  {
    id: "retro",
    englishName: "Pixel Retro",
    name: "像素复古",
    tagline: "8-bit 方块拼出的老派情怀",
    price: 360,
    rarity: "稀有",
    form: "pixel",
    pattern: "gloss",
    palette: ["#5ad16a", "#2f8f3e", "#a8f07a"],
    head: "#5ad16a",
    belly: "#d8ffc4",
    eye: "#102a14",
    shine: "#ffffff",
  },
  {
    id: "aurora",
    englishName: "Aurora Drift",
    name: "极光漫游",
    tagline: "把夜空披在身上",
    price: 420,
    rarity: "史诗",
    form: "classic",
    pattern: "aurora",
    palette: ["#5fd4ff", "#8f7bff", "#71ffbd"],
    head: "#75baff",
    belly: "#dbfff5",
    eye: "#132c53",
    shine: "#ffffff",
  },
  {
    id: "midnight",
    englishName: "Deep Glow",
    name: "深海夜光",
    tagline: "暗处的星星会呼吸",
    price: 560,
    rarity: "史诗",
    form: "classic",
    pattern: "dots",
    palette: ["#2f4f86", "#22355f", "#7fd6ff"],
    head: "#2c4879",
    belly: "#b9e6ff",
    eye: "#dff6ff",
    shine: "#9fe5ff",
  },
  {
    id: "express",
    englishName: "Paper Express",
    name: "纸格特快",
    tagline: "车头领跑，车厢随弯道铰接摆动",
    price: 640,
    rarity: "史诗",
    form: "train",
    pattern: "gloss",
    palette: ["#e8453c", "#2b5f8a", "#ffcf4a"],
    head: "#e8453c",
    belly: "#fff3d6",
    eye: "#1d2b33",
    shine: "#ffffff",
  },
  {
    id: "origami",
    englishName: "Crane Chain",
    name: "纸鹤彩链",
    tagline: "千纸鹤牵着一串彩纸环",
    price: 680,
    rarity: "史诗",
    form: "paperchain",
    pattern: "gloss",
    palette: ["#ff8a73", "#ffc54d", "#5fd3ae"],
    head: "#7fa8ff",
    belly: "#fffaf0",
    eye: "#2d3550",
    shine: "#ffffff",
  },
  {
    id: "grid",
    englishName: "Grid Camo",
    name: "格子伪装",
    tagline: "和草稿纸融为一体",
    price: 720,
    rarity: "传说",
    form: "classic",
    pattern: "checker",
    palette: ["#e6efe4", "#bcd6cd", "#f7faf2"],
    head: "#d9e8df",
    belly: "#ffffff",
    eye: "#40564f",
    shine: "#ffffff",
  },
  {
    id: "dna",
    englishName: "Double Helix",
    name: "基因螺旋",
    tagline: "双链缠绕旋转，越游越有生命力",
    price: 760,
    rarity: "史诗",
    form: "helix",
    pattern: "gloss",
    palette: ["#ff6fb5", "#9b7bff", "#3fd7e6"],
    head: "#ff6fb5",
    belly: "#f4ecff",
    eye: "#24163f",
    shine: "#ffffff",
  },
  {
    id: "starmap",
    englishName: "Star Chart",
    name: "星图漫游",
    tagline: "月亮领路，星星连成你的轨迹",
    price: 880,
    rarity: "传说",
    form: "starchart",
    pattern: "gloss",
    palette: ["#ffd45a", "#2d3a6e", "#9fb4ff"],
    head: "#ffd45a",
    belly: "#fff6d0",
    eye: "#2d3a6e",
    shine: "#ffffff",
  },
  {
    id: "comet",
    englishName: "Comet Tail",
    name: "流星焰尾",
    tagline: "越到尾巴越像燃烧的流星",
    price: 960,
    rarity: "传说",
    form: "comet",
    pattern: "gloss",
    palette: ["#ff8a2a", "#e0371f", "#ffe45c"],
    head: "#ffb02e",
    belly: "#fff4c2",
    eye: "#4a1a08",
    shine: "#ffffff",
  },
  {
    id: "gold",
    englishName: "Gilded Legend",
    name: "鎏金传说",
    tagline: "每一节都在闪光",
    price: 980,
    rarity: "传说",
    form: "classic",
    pattern: "gold",
    palette: ["#ffd76a", "#f0b429", "#fff3bd"],
    head: "#f7c948",
    belly: "#fff6cf",
    eye: "#523a08",
    shine: "#ffffff",
  },
  {
    id: "dragon",
    englishName: "Lantern Dragon",
    name: "灯笼舞龙",
    tagline: "金龙开道，红灯笼一路相随",
    price: 1280,
    rarity: "传说",
    form: "lantern",
    pattern: "gloss",
    palette: ["#e8392f", "#b51f1a", "#ffcf4a"],
    head: "#e8392f",
    belly: "#fff1c9",
    eye: "#2b0f0a",
    shine: "#ffffff",
  },
];

export const DEFAULT_SKIN: SkinId = "koi";
export const FREE_SKINS: SkinId[] = SKINS.filter((s) => s.price === 0).map((s) => s.id);
export const STRUCTURAL_SKINS: SkinId[] = SKINS.filter((s) => s.form !== "classic").map((s) => s.id);
export const NEW_SKINS = SKINS.filter((s) => s.collection === "paper-objects");
export const CURIOUS_SKINS = SKINS.filter((s) => s.collection === "curious-objects");
export const FEATURED_SKINS = [...NEW_SKINS, ...CURIOUS_SKINS];

export function skinCollectionLabel(skin: Skin): string {
  return skin.collection === "curious-objects" ? "CURIOUS OBJECTS" : skin.collection === "paper-objects" ? "PAPER OBJECTS" : "ORIGINAL COLLECTION";
}

export function getSkin(id: SkinId): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function isSkinId(value: string): value is SkinId {
  return SKINS.some((s) => s.id === value);
}

/** Localised display name: English uses the curated englishName. */
export function skinName(skin: Skin): string {
  return getLang() === "en" ? skin.englishName ?? skin.name : skin.name;
}

export function skinTagline(skin: Skin): string {
  return t(skin.tagline);
}

export function formLabel(form: SkinForm): string {
  return t(FORM_INFO[form].label);
}

export function formDesc(form: SkinForm): string {
  return t(FORM_INFO[form].desc);
}

export function rarityLabel(rarity: SkinRarity): string {
  return t(rarity);
}
