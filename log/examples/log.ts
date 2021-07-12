import { DateFileLogConfig, getLogger, init } from "../mod.ts";

const config: DateFileLogConfig = {
  "appenders": {
    "dateFile": {
      "filename": "logs/auth",
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

await init(config);

const logger = getLogger();

logger.warning("warning");
logger.warning(1);
logger.info("info");
logger.error("error");

const logger2 = getLogger("task");

logger2.warning("warning2");
logger2.warning(2);
logger2.info("info2");
logger2.error("error2");
