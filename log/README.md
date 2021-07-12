# dateFile logs

## examples

``` ts
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
  },
};

await init(config);

const logger = getLogger();

logger.warning("warning");
logger.warning(1);
logger.info("info");
logger.error("error");

```

then will generate a log named like `auth.2021-07-12.log` in logs
