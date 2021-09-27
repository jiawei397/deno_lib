export { getLogger } from "./deps.ts";
export * from "./src/date_file.ts";
export * from "./src/main.ts";

import type { DateFileLogConfig, LogAppender } from "./src/types.ts";

export type { DateFileLogConfig, LogAppender };

export const version = "0.1.5";
