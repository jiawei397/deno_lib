import { DateFileLogConfig, getLogger, initLog } from "../mod.ts";

const config: DateFileLogConfig = {
  "appenders": {
    "dateFile": {
      "filename": "logs/deno",
      "daysToKeep": 10,
      "pattern": "yyyy-MM-dd.log",
    },
  },
  "categories": {
    "default": {
      "appenders": ["console", "dateFile"],
      "level": "DEBUG",
    },
    "task": {
      "appenders": ["console", "dateFile"],
      "level": "WARNING",
    },
  },
};

await initLog(config);

const logger = getLogger();

logger.warn("warn", "msg2", 'msg3');
logger.warning("warning");
logger.warning(1);
logger.info("info");
logger.error("error");

const logger2 = getLogger("task");
logger2.warn("warn");
logger2.warning("warning2");
logger2.warning(2);
logger2.info("info2"); // will be ignored
logger2.error("error2");

setTimeout(() => {
  logger2.error("error3");
}, 1000);
