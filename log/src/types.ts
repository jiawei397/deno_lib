import { LevelName } from "../deps.ts";

export type LogAppender = "console" | "dateFile";

export interface DateFileLogConfig {
  appenders: {
    dateFile: {
      filename: string;
      daysToKeep: number;
      pattern: string;
    };
  };
  categories: {
    [key: string]: { level: LevelName; appenders: LogAppender[] };
  };
}
