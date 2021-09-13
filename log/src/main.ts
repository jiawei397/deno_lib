import {
  dateToString,
  handlers as Handlers,
  LevelName,
  LogRecord,
  setup,
} from "../deps.ts";
import { DateFileHandler } from "./date_file.ts";
import { DateFileLogConfig, LogHandlers, LogLoggers } from "./types.ts";

export function initLog(config: DateFileLogConfig) {
  const formatter = (logRecord: LogRecord) => {
    const t1 = dateToString("yyyy-MM-dd hh:mm:ss", new Date());
    // console.log('---', t1);
    let msg = `[${t1}] [${logRecord.levelName}] - ${logRecord.msg}`;
    logRecord.args.forEach((arg, index) => {
      msg += `, arg${index}: ${arg}`;
    });
    return msg;
  };

  const loggers: LogLoggers = {};
  const handlers: LogHandlers = {};
  Object.keys(config.categories).forEach((key: string) => {
    const level = config.categories[key].level.toUpperCase() as LevelName;
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