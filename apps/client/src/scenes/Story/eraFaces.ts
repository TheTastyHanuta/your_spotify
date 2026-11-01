// Where the faces of the artist eras go on the Your story strip. No imports,
// so scripts/eraFaces.check.mjs can run it directly.
//
// Each era has a face on one of two rows, above or below the line, as close
// as it can to where the era starts. Eras go left to right to the row where
// they move least; then right to left, so the last ones fit at the right
// edge instead of piling up there. A name shows to the right of a face when
// it fits before the next face on its row (or to its left, at the right
// edge), the newest eras first, so the current era is always named when
// there is any room.

export interface FaceInput {
  // Where the era starts on the line, in pixels
  x: number;
  // Width of the name and months next to the face, in pixels
  labelWidth: number;
}

export interface Face {
  row: 0 | 1;
  // Left edge of the face
  left: number;
  // Where its name goes, null without room
  label: "right" | "left" | null;
}

export const FACE = 32;
const GAP = 6;
const LABEL_GAP = 8;

// eras: in time order
export function placeFaces(eras: FaceInput[], width: number): Face[] {
  const ends = [-Infinity, -Infinity];
  const faces = eras.map((era, i): Face => {
    const want = Math.max(0, era.x - FACE / 2);
    const at = ends.map((end) => Math.max(want, end + GAP));
    const row = at[0] === at[1] ? ((i % 2) as 0 | 1) : at[0]! < at[1]! ? 0 : 1;
    ends[row] = at[row]! + FACE;
    return { row, left: at[row]!, label: null };
  });
  const forward = faces.map((face) => face.left);
  const newest = faces.length - 1;

  // Right to left: no face past the right edge. reserve: room left of the
  // newest face for its name, when the right edge leaves none there.
  const pullLeft = (reserve: boolean) => {
    faces.forEach((face, i) => (face.left = forward[i]!));
    for (const row of [0, 1]) {
      let limit = width;
      for (let i = newest; i >= 0; i -= 1) {
        const face = faces[i]!;
        if (face.row !== row) continue;
        face.left = Math.min(face.left, limit - FACE);
        limit = face.left - GAP;
        const w = eras[i]!.labelWidth;
        if (
          reserve &&
          i === newest &&
          face.left + FACE + LABEL_GAP + w > width
        ) {
          limit -= LABEL_GAP + w;
        }
      }
    }
    return faces.every((face) => face.left >= 0);
  };
  // The reservation only when every face still fits
  if (!pullLeft(true)) {
    pullLeft(false);
  }
  // Too many faces for the width: keep them apart, past the right edge if
  // need be (the strip scrolls)
  const rowEnds = [-Infinity, -Infinity];
  for (const face of faces) {
    face.left = Math.max(face.left, 0, rowEnds[face.row]! + GAP);
    rowEnds[face.row] = face.left + FACE;
  }

  // Labels: newest first, each needs the room up to the next face or label
  // on its row
  const taken: [number, number][][] = [[], []];
  faces.forEach((face) => taken[face.row]!.push([face.left, face.left + FACE]));
  for (let i = faces.length - 1; i >= 0; i -= 1) {
    const face = faces[i]!;
    const w = eras[i]!.labelWidth;
    const right = face.left + FACE + LABEL_GAP;
    const left = face.left - LABEL_GAP - w;
    const fits = (from: number, to: number) =>
      from >= 0 &&
      to <= width &&
      taken[face.row]!.every(([a, b]) => to + GAP <= a || from >= b + GAP);
    if (fits(right, right + w)) {
      face.label = "right";
      taken[face.row]!.push([right, right + w]);
    } else if (fits(left, left + w)) {
      face.label = "left";
      taken[face.row]!.push([left, left + w]);
    }
  }
  return faces;
}
