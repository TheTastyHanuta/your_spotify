import packageJson from "../../package.json";

export class Version {
  private constructor(
    private readonly raw: string,
    private readonly parts: number[],
  ) {}

  // Only the numbers count, so the fork release 1.20.1-fork.2 compares as
  // 1.20.1.2: newer than 1.20.1 and older than 1.21.0-fork.1.
  static from(version: string) {
    const parts = version
      .split(/[.-]/)
      .filter((part) => /^\d+$/.test(part))
      .map(Number);
    return new Version(version, parts);
  }

  static thisOne() {
    return Version.from(packageJson.version as string);
  }

  toString() {
    return this.raw;
  }

  isNewerThan(version: Version) {
    const length = Math.max(this.parts.length, version.parts.length);
    for (let i = 0; i < length; i += 1) {
      // A missing part counts as 0
      const difference = (this.parts[i] ?? 0) - (version.parts[i] ?? 0);
      if (difference !== 0) {
        return difference > 0;
      }
    }
    return false;
  }
}
