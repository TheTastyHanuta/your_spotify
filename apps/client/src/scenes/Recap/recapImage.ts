import { Rgb, shadeOf } from "../../services/coverColor";
import { fitLines } from "./fitLines";

// Draws the recap as a 1080×1920 image, the size of a phone story, lit by the
// page's cover colour like the hero. The pictures are the only other colour.
export interface RecapImageData {
  // Like "2026 so far"
  title: string;
  // The page's cover colour, null for neutral
  color: Rgb | null;
  // Up to five each; the picture of the first one heads the column
  artists: { name: string; image?: string }[];
  songs: { name: string; image?: string }[];
  // Up to six short answers, like "Night owl" over "62% at night"; a fact
  // with an image (the top album) shows it as a small cover
  facts: { value: string; label: string; image?: string }[];
}

const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN = 86;
const COLUMN_GAP = 48;
const COLUMN = (WIDTH - 2 * MARGIN - COLUMN_GAP) / 2;
const PICTURE = 372;
const RANK = 56;
const COVER = 114;
const WHITE = "#ffffff";
const GREY = "rgba(255, 255, 255, 0.72)";
const LINE = "rgba(255, 255, 255, 0.2)";
// The page background of the dark theme
const NIGHT = "#0b0b0d";

// Spotify's image server allows cross origin reads, so the canvas can still
// be exported. A picture that does not load is left out.
function loadImage(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

// The picture, with a soft shadow under it like the hero's cover when lifted
function drawPicture(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  round: boolean,
  lifted: boolean,
) {
  const shape = () => {
    ctx.beginPath();
    if (round) {
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(x, y, size, size, 12);
    }
  };
  ctx.save();
  if (lifted) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 28;
  }
  shape();
  ctx.fillStyle = LINE;
  ctx.fill();
  ctx.restore();
  if (image) {
    ctx.save();
    shape();
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
  }
}

export async function renderRecapImage(data: RecapImageData): Promise<Blob> {
  await document.fonts.ready;
  const style = getComputedStyle(document.body);
  const font = style.fontFamily;
  const mono = style.getPropertyValue("--font-num") || "monospace";
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported");
  }
  const artists = data.artists.slice(0, 5);
  const songs = data.songs.slice(0, 5);
  const facts = data.facts.slice(0, 6);
  const [artistImage, songImage, ...factImages] = await Promise.all([
    loadImage(artists[0]?.image),
    loadImage(songs[0]?.image),
    ...facts.map((fact) => loadImage(fact.image)),
  ]);

  ctx.textBaseline = "top";
  const measure = (weight: number) => (value: string, size: number) => {
    ctx.font = `${weight} ${size}px ${font}`;
    return ctx.measureText(value).width;
  };
  // Lines of a fitted name from y down; returns the height used
  const lines = (
    fit: { size: number; lines: string[] },
    x: number,
    y: number,
    weight: number,
    color: string,
    lineHeight: number,
  ) => {
    ctx.font = `${weight} ${fit.size}px ${font}`;
    ctx.fillStyle = color;
    fit.lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * fit.size * lineHeight);
    });
    return fit.lines.length * fit.size * lineHeight;
  };
  const text = (value: string, x: number, y: number, size: number) => {
    ctx.font = `500 ${size}px ${font}`;
    ctx.fillStyle = GREY;
    ctx.fillText(value, x, y);
  };

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, shadeOf(data.color, [0.42, 0.09]));
  background.addColorStop(0.46, shadeOf(data.color, [0.22, 0.05]));
  background.addColorStop(1, NIGHT);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  text(data.title, MARGIN, 112, 40);
  const footerY = HEIGHT - 110;
  text("Your Spotify", MARGIN, footerY, 40);

  // The facts sit on the footer, two per row, each row as tall as its
  // taller cell; measured first so the lists know how far they can go
  const cells = facts.map((fact, index) => {
    const textWidth = COLUMN - (fact.image ? COVER + 28 : 0);
    const value = fitLines(fact.value, textWidth, 2, [54, 46], measure(800));
    const label = fitLines(fact.label, textWidth, 2, [34], measure(500));
    const height = Math.max(
      value.lines.length * value.size * 1.08 + 10 + label.lines.length * 42,
      fact.image ? COVER : 0,
    );
    return { fact, value, label, height, image: factImages[index] ?? null };
  });
  const rows: (typeof cells)[] = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(cells.slice(index, index + 2));
  }
  const rowGap = 40;
  const rowHeights = rows.map((row) => Math.max(...row.map((c) => c.height)));
  const factsHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) +
    rowGap * Math.max(rows.length - 1, 0);
  const factsTop = footerY - 90 - factsHeight;
  let y = factsTop;
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, column) => {
      const x = MARGIN + column * (COLUMN + COLUMN_GAP);
      let textX = x;
      if (cell.fact.image) {
        drawPicture(ctx, cell.image, x, y, COVER, false, false);
        textX += COVER + 28;
      }
      const used = lines(cell.value, textX, y, 800, WHITE, 1.08);
      lines(cell.label, textX, y + used + 10, 500, GREY, 42 / 34);
    });
    y += rowHeights[rowIndex]! + rowGap;
  });
  const ruleY = factsTop - 50;
  if (facts.length > 0) {
    ctx.fillStyle = LINE;
    ctx.fillRect(MARGIN, ruleY, WIDTH - 2 * MARGIN, 2);
  }

  // Two columns, each headed by its number one's picture, then the ranked
  // names; a name that no longer fits above the rule is left out with the
  // ones after it
  const column = (
    title: string,
    items: { name: string }[],
    image: HTMLImageElement | null,
    x: number,
    round: boolean,
  ) => {
    if (items.length === 0) {
      return;
    }
    const top = 196;
    drawPicture(ctx, image, x, top, PICTURE, round, true);
    text(title, x, top + PICTURE + 52, 38);
    let rowY = top + PICTURE + 116;
    for (const [index, item] of items.entries()) {
      const fit = fitLines(item.name, COLUMN - RANK, 2, [44, 38], measure(700));
      const height = fit.lines.length * fit.size * 1.12;
      if (rowY + height > ruleY - 50) {
        break;
      }
      ctx.font = `400 34px ${mono}`;
      ctx.fillStyle = GREY;
      ctx.fillText(String(index + 1), x, rowY + (fit.size - 34) / 2 + 2);
      lines(fit, x + RANK, rowY, 700, WHITE, 1.12);
      rowY += height + 16;
    }
  };
  column("Top artists", artists, artistImage, MARGIN, true);
  column("Top songs", songs, songImage, MARGIN + COLUMN + COLUMN_GAP, false);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/png",
    );
  });
}

// The share sheet on phones, a download elsewhere. Closing the share sheet
// is not an error.
export async function shareRecapImage(blob: Blob, year: number) {
  const file = new File([blob], `your-spotify-${year}.png`, {
    type: "image/png",
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${year} in music` });
      return;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return;
      }
      // Safari refuses to share when making the image took too long after
      // the click, the download still works
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
