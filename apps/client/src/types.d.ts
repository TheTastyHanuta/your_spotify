declare module "*.css" {
  const classes: any;
  export default classes;
}

// A file's text, as Vitest reads it (a test reads index.css this way)
declare module "*?raw" {
  const content: string;
  export default content;
}
