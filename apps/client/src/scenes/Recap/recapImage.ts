import { Rgb, shadeOf } from "../../services/coverColor";

// Draws the recap as a 1080×1920 image, the size of a phone story, lit by the
// page's cover colour like the hero. The pictures are the only other colour.
export interface RecapImageData {
  // Like "2026 so far"
  title: string;
  // Whole hours
  hours: string;
  // Like "12% more than in 2024"
  change?: string;
  // The page's cover colour, null for neutral
  color: Rgb | null;
  topArtist?: { name: string; image?: string };
  topSong?: { name: string; artist: string; image?: string };
  topAlbum?: { name: string; artist: string; image?: string };
  // Up to four short answers, like "Night owl" over "62% at night"
  facts: { value: string; label: string }[];
}

const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN = 86;
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

function fitText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) {
    return text;
  }
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

// The picture with a soft shadow under it, like the hero's cover
function drawPicture(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  round: boolean,
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
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 28;
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
  const font = getComputedStyle(document.body).fontFamily;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported");
  }
  const [artistImage, songImage, albumImage] = await Promise.all([
    loadImage(data.topArtist?.image),
    loadImage(data.topSong?.image),
    loadImage(data.topAlbum?.image),
  ]);

  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    weight: number,
    color = WHITE,
    width = WIDTH - x - MARGIN,
  ) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.fillText(fitText(ctx, value, width), x, y);
  };

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, shadeOf(data.color, [0.42, 0.09]));
  background.addColorStop(0.46, shadeOf(data.color, [0.22, 0.05]));
  background.addColorStop(1, NIGHT);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  text(data.title, MARGIN, 150, 40, 500, GREY);
  text(data.hours, MARGIN - 6, 360, 200, 800);
  text("hours listened", MARGIN, 440, 60, 700);
  if (data.change) {
    text(data.change, MARGIN, 505, 38, 500, GREY);
  }

  let y = 590;
  if (data.topArtist) {
    drawPicture(ctx, artistImage, MARGIN, y, 260, true);
    text("Top artist", MARGIN + 300, y + 110, 40, 500, GREY);
    text(data.topArtist.name, MARGIN + 300, y + 200, 88, 800);
    y += 320;
  }

  const item = (
    label: string,
    entry: { name: string; artist: string } | undefined,
    image: HTMLImageElement | null,
  ) => {
    if (!entry) {
      return;
    }
    drawPicture(ctx, image, MARGIN, y, 220, false);
    text(label, MARGIN + 260, y + 70, 38, 500, GREY);
    text(entry.name, MARGIN + 260, y + 140, 60, 700);
    text(entry.artist, MARGIN + 260, y + 196, 40, 500, GREY);
    y += 260;
  };
  item("Top song", data.topSong, songImage);
  item("Top album", data.topAlbum, albumImage);

  // Two rows of two short answers above the name of the app
  const facts = data.facts.slice(0, 4);
  if (facts.length > 0) {
    const top = Math.max(y + 30, 1490);
    const width = (WIDTH - 2 * MARGIN) / 2;
    ctx.fillStyle = LINE;
    ctx.fillRect(MARGIN, top, WIDTH - 2 * MARGIN, 2);
    facts.forEach((fact, index) => {
      const x = MARGIN + (index % 2) * width;
      const rowY = top + 100 + Math.floor(index / 2) * 150;
      text(fact.value, x, rowY, 64, 800, WHITE, width - 40);
      text(fact.label, x, rowY + 50, 36, 500, GREY, width - 40);
    });
  }

  text("Your Spotify", MARGIN, HEIGHT - 70, 40, 700, GREY);

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
