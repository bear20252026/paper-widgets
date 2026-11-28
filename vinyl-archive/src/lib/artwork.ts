import { releases, type Release } from "../data/releases";

export type Artwork = {
  covers: HTMLCanvasElement[];
  spines: HTMLCanvasElement[];
  backs: HTMLCanvasElement[];
  images: string[];
};

function canvas(width = 1024, height = 1024) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return { element, ctx: element.getContext("2d")! };
}

function logo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  hole: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArt(
  ctx: CanvasRenderingContext2D,
  release: Release,
  index: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 222, 1024, 710);
  ctx.clip();
  ctx.fillStyle = release.accent;
  ctx.fillRect(0, 222, 1024, 710);
  if (index === 7) {
    ctx.fillStyle = "#d7d8cd";
    ctx.fillRect(0, 222, 1024, 710);
    [
      [360, 360],
      [660, 360],
      [360, 590],
      [660, 590],
      [360, 820],
      [660, 820],
    ].forEach(([x, y], n) => {
      logo(ctx, x, y, 101, n === 3 ? "#b16843" : "#343a33", "#c5c9b8");
      for (let r = 40; r < 100; r += 5) {
        ctx.strokeStyle = "#ffffff25";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  } else if (index % 4 === 0) {
    for (let n = 0; n < 27; n++) {
      ctx.beginPath();
      ctx.strokeStyle = n % 3 === 0 ? release.color : `${release.ink}90`;
      ctx.lineWidth = 2 + (n % 4);
      ctx.ellipse(
        512 + Math.sin(n * 0.3) * 170,
        580,
        70 + n * 22,
        20 + n * 13,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (index % 4 === 1) {
    ctx.fillStyle = release.color;
    for (let n = 0; n < 9; n++) {
      ctx.save();
      ctx.translate(75 + n * 120, 620);
      ctx.rotate(-0.4);
      ctx.fillRect(-40, -440, 60, 900);
      ctx.restore();
    }
    ctx.fillStyle = release.ink;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(575, 555, 230, 0, Math.PI * 2);
    ctx.fill();
  } else if (index % 4 === 2) {
    const gradient = ctx.createLinearGradient(0, 220, 1024, 930);
    gradient.addColorStop(0, release.ink);
    gradient.addColorStop(0.6, release.accent);
    gradient.addColorStop(1, release.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 222, 1024, 710);
    for (let n = 0; n < 48; n++) {
      ctx.strokeStyle = `${release.color}90`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 300 + n * 16);
      ctx.bezierCurveTo(
        250,
        180 + n * 14,
        660,
        800 - n * 6,
        1024,
        280 + n * 17,
      );
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = release.ink;
    ctx.globalAlpha = 0.8;
    for (let n = 0; n < 7; n++) {
      ctx.beginPath();
      ctx.arc(512, 580, 280 - n * 36, n * 0.65, n * 0.65 + Math.PI * 1.35);
      ctx.lineWidth = 15;
      ctx.strokeStyle = n % 2 ? release.color : release.ink;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function cover(
  release: Release,
  index: number,
  image: HTMLImageElement | null,
) {
  const { element, ctx } = canvas();
  ctx.fillStyle = release.color;
  ctx.fillRect(0, 0, 1024, 1024);
  if (index === 10 && image) ctx.drawImage(image, 0, 205, 1024, 727);
  else drawArt(ctx, release, index);
  ctx.fillStyle = release.ink;
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText(release.artist, 86, 110);
  ctx.font = `${release.title.length > 19 ? 48 : 57}px Arial, sans-serif`;
  ctx.fillText(release.title, 83, 175);
  ctx.font = "19px monospace";
  ctx.textAlign = "right";
  ctx.fillText(release.id, 941, 108);
  ctx.fillText(String(release.year), 941, 984);
  ctx.textAlign = "left";
  logo(ctx, 100, 978, 13, release.ink, release.color);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("SABLE", 123, 985);
  ctx.strokeStyle = "#ffffff24";
  ctx.strokeRect(1, 1, 1022, 1022);
  return element;
}

function spine(release: Release) {
  const { element, ctx } = canvas(144, 1024);
  ctx.fillStyle = release.color;
  ctx.fillRect(0, 0, 144, 1024);
  const gradient = ctx.createLinearGradient(0, 0, 144, 0);
  gradient.addColorStop(0, "#ffffff22");
  gradient.addColorStop(0.12, "#ffffff00");
  gradient.addColorStop(0.88, "#00000000");
  gradient.addColorStop(1, "#00000025");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 144, 1024);
  ctx.save();
  ctx.translate(76, 54);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = release.ink;
  ctx.font = "16px monospace";
  ctx.fillText(release.id, 0, 0);
  ctx.font = "bold 33px Arial, sans-serif";
  ctx.fillText(release.title, 124, 1);
  const titleWidth = ctx.measureText(release.title).width;
  ctx.font = "20px Arial, sans-serif";
  ctx.fillText(release.artist, Math.min(790, 150 + titleWidth), 0);
  ctx.restore();
  logo(ctx, 72, 952, 18, release.ink, release.color);
  ctx.fillStyle = "#ffffff18";
  ctx.fillRect(8, 0, 2, 1024);
  return element;
}

function back(release: Release) {
  const { element, ctx } = canvas();
  ctx.fillStyle = release.color;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = release.ink;
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText(release.artist, 90, 113);
  ctx.font = "52px Arial, sans-serif";
  ctx.fillText(release.title, 87, 177);
  release.tracks.forEach((track, index) => {
    ctx.font = "23px monospace";
    ctx.fillText(`0${index + 1}`, 90, 340 + index * 85);
    ctx.font = "28px Arial, sans-serif";
    ctx.fillText(track.title, 170, 340 + index * 85);
  });
  logo(ctx, 109, 909, 20, release.ink, release.color);
  ctx.font = "19px monospace";
  ctx.fillText(`${release.id}  /  SABLE RECORDS  /  ${release.year}`, 151, 915);
  for (let n = 0; n < 55; n++) {
    ctx.fillRect(735 + n * 3, 773, n % 3 === 0 ? 2 : 1, 86 - (n % 7));
  }
  return element;
}

let artworkPromise: Promise<Artwork> | undefined;

export function getArtwork(): Promise<Artwork> {
  if (!artworkPromise) {
    artworkPromise = new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = "/artwork/concentric.jpg";
    }).then((image) => {
      const covers = releases.map((release, index) =>
        cover(release, index, image),
      );
      return {
        covers,
        spines: releases.map(spine),
        backs: releases.map(back),
        images: covers.map((item) => item.toDataURL("image/jpeg", 0.9)),
      };
    });
  }
  return artworkPromise;
}

export function createDiscCanvas(release: Release) {
  const { element, ctx } = canvas();
  const gradient = ctx.createConicGradient(-0.3, 512, 512);
  [
    "#d3d7d5",
    "#a8a8bb",
    "#f0e5d1",
    "#a5c5c3",
    "#e3d2e3",
    "#777a88",
    "#eef1e8",
    "#b6bdd6",
    "#d3d7d5",
  ].forEach((color, index) => gradient.addColorStop(index / 8, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);
  for (let radius = 163; radius < 506; radius += 2) {
    ctx.strokeStyle = radius % 4 === 1 ? "#ffffff28" : "#34374112";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(512, 512, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  logo(ctx, 512, 512, 158, release.accent, "#d0d0c6");
  ctx.fillStyle = release.ink;
  ctx.textAlign = "center";
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("S A B L E", 512, 423);
  ctx.font = "23px Arial, sans-serif";
  ctx.fillText(release.title, 512, 597);
  ctx.font = "13px monospace";
  ctx.fillText(`${release.id} / ${release.year}`, 512, 625);
  return element;
}
