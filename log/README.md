# date_file_log

everyday will generate a new log file.

## examples

``` ts
import { DateFileLogConfig, getLogger, initLog } from "../mod.ts";

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
  },
};

await initLog(config);

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

```

then will generate a log named like `auth.2021-07-12.log` in logs
