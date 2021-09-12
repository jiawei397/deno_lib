import { LevelName, LogRecord } from "../deps.ts";

export type LogAppender = "console" | "dateFile";

export type FormatterFunction = (logRecord: LogRecord) => string;
export type LogMode = "a" | "w" | "x";

export interface HandlerOptions {
  formatter?: string | FormatterFunction;
}

export interface FileHandlerOptions extends HandlerOptions {
  filename: string;
  pattern?: string; // like : yyyy-MM-dd.log
  daysToKeep?: number;
  flushTimeout?: number;
  mode?: LogMode;
}

export interface DateFileLogConfig {
  appenders: {
    dateFile: FileHandlerOptions;
  };
  categories: {
    [key: string]: {
      level: LevelName;
      appenders: LogAppender[];
    };
  };
}
