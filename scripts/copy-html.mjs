import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const pairs = [
  ["CT1 Visualiser.html", "public/desktop.html"],
  ["CT1 Visualizer Mobile.html", "public/mobile.html"],
];

for (const [src, dst] of pairs) {
  const srcPath = join(root, src);
  const dstPath = join(root, dst);
  if (!existsSync(srcPath)) {
    console.error(`[copy-html] missing source: ${src}`);
    process.exit(1);
  }
  await mkdir(dirname(dstPath), { recursive: true });
  await copyFile(srcPath, dstPath);
  console.log(`[copy-html] ${src}  ->  ${dst}`);
}
