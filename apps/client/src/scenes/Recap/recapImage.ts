// Draws the recap as a 1080×1920 image, the size of a phone story. Black and
// white like the app: the pictures are the only colour.
export interface RecapImageData {
  year: number;
  // Whole hours
  hours: string;
  // Like "12% more than in 2024"
  change?: string;
  topArtist?: { name: string; image?: string };
  topSongs: { name: string; artist: string; image?: string }[];
  musicalAge?: number;
  topGenre?: string;
}

const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN = 90;
const WHITE = "#ffffff";
const GREY = "rgba(255, 255, 255, 0.6)";
const LINE = "rgba(255, 255, 255, 0.2)";
const SONG_ROW = 120;

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

function drawPicture(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  round: boolean,
) {
  ctx.save();
  ctx.beginPath();
  if (round) {
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(x, y, size, size, 8);
  }
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = LINE;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
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
  const [artistImage, ...songImages] = await Promise.all([
    loadImage(data.topArtist?.image),
    ...data.topSongs.map((song) => loadImage(song.image)),
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
  const label = (value: string, x: number, y: number) =>
    text(value.toUpperCase(), x, y, 32, 600, GREY);

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  label(`${data.year} in music`, MARGIN, 150);
  text(data.hours, MARGIN - 6, 360, 200, 800);
  text("hours listened", MARGIN, 450, 52, 600);
  if (data.change) {
    text(data.change, MARGIN, 515, 36, 500, GREY);
  }

  let y = 590;
  if (data.topArtist) {
    drawPicture(ctx, artistImage, MARGIN, y, 240, true);
    label("Top artist", MARGIN + 290, y + 100);
    text(data.topArtist.name, MARGIN + 290, y + 180, 72, 800);
    y += 300;
  }

  label("Top songs", MARGIN, y + 30);
  y += 70;
  data.topSongs.slice(0, 5).forEach((song, index) => {
    const rowY = y + index * SONG_ROW;
    text(`${index + 1}`, MARGIN, rowY + 66, 48, 800, GREY, 50);
    drawPicture(ctx, songImages[index] ?? null, MARGIN + 60, rowY, 100, false);
    text(song.name, MARGIN + 190, rowY + 44, 42, 700);
    text(song.artist, MARGIN + 190, rowY + 90, 34, 500, GREY);
  });
  y += 5 * SONG_ROW + 30;

  const facts = [
    data.musicalAge !== undefined && {
      title: "Musical age",
      value: `${data.musicalAge}`,
    },
    data.topGenre && { title: "Top genre", value: data.topGenre },
  ].filter((fact): fact is { title: string; value: string } => !!fact);
  const factWidth = (WIDTH - 2 * MARGIN) / Math.max(1, facts.length);
  ctx.fillStyle = LINE;
  ctx.fillRect(MARGIN, y, WIDTH - 2 * MARGIN, 2);
  facts.forEach((fact, index) => {
    const x = MARGIN + index * factWidth;
    label(fact.title, x, y + 80);
    text(fact.value, x, y + 160, 64, 800, WHITE, factWidth - 40);
  });

  text("Your Spotify", MARGIN, HEIGHT - 70, 36, 700, GREY);

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
