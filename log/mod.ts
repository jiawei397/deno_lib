import {
  dateToString,
  handlers as Handlers,
  LevelName,
  LogRecord,
  setup,
} from "./deps.ts";
import { DateFileHandler } from "./date_file.ts";
export { getLogger } from "./deps.ts";

export * from "./date_file.ts";

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

export function init(config: DateFileLogConfig) {
  const formatter = (logRecord: LogRecord) => {
    const t1 = dateToString("yyyy-MM-dd hh:mm:ss", new Date());
    // console.log('---', t1);
    let msg = `[${t1}] [${logRecord.levelName}] - ${logRecord.msg}`;
    logRecord.args.forEach((arg, index) => {
      msg += `, arg${index}: ${arg}`;
    });
    return msg;
  };

  const loggers: any = {};
  const handlers: any = {};
  Object.keys(config.categories).forEach((key: string) => {
    let level: LevelName = config.categories[key].level;
    if (/[a-z]+/.test(level)) {
      level = level.toUpperCase() as LevelName;
    }
    const appenders = config.categories[key].appenders;

    if (appenders.includes("console")) {
      if (!handlers.console) {
        handlers.console = new Handlers.ConsoleHandler(level, {
          formatter,
        });
      }
    }
    if (appenders.includes("dateFile")) {
      if (!handlers.dateFile) {
        handlers.dateFile = new DateFileHandler(level, {
          ...config.appenders.dateFile,
          // you can change format of output message using any keys in `LogRecord`.
          // formatter: "${datetime} {levelName} {msg}",
          formatter,
        });
      }
    }

    loggers[key] = {
      level,
      handlers: appenders,
    };
  });
  return setup({
    handlers,
    loggers,
  });
}
