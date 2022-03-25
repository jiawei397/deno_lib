// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.
import { assertEquals, beforeEach, describe, it, mf } from "../../test_deps.ts";
import { BaseAjax } from "../src/ajax.ts";

class Ajax extends BaseAjax {
  /**
   * 处理消息，具体实现可以覆盖此项
   */
  protected handleMessage(msg: string) {
    console.log("handleMessage", msg);
    super.handleMessage(msg);
  }

  /**
   * 处理错误请求
   */
  protected handleErrorResponse(response: Response) {
    console.error(
      `HTTP error, status = ${response.status}, statusText = ${response.statusText}`,
    );
  }
}

describe("ajax", () => {
  function mock() {
    mf.install();

    mf.mock("GET@/api/", () => {
      return new Response(`ok`, {
        status: 200,
      });
    });
  }

  mock();

  let ajax: Ajax;

  beforeEach(() => {
    ajax = new Ajax();
  });

  const request = () => ajax.get("http://localhost/api/");

  describe("request and response count", () => {
    let requestCount = 0;
    let responseCount = 0;

    beforeEach(() => {
      requestCount = 0;
      responseCount = 0;

      ajax.interceptors.request.use(function (mergedConfig) {
        requestCount++;
        return mergedConfig;
      }, function (err) {
        requestCount++;
        return Promise.reject(err);
      });

      // 响应拦截
      ajax.interceptors.response.use(function (data) {
        responseCount++;
        return data;
      }, function (err) {
        responseCount++;
        return Promise.reject(err);
      });
    });

    it("once", async () => {
      assertEquals(requestCount, 0);
      assertEquals(responseCount, 0);

      await request();
      assertEquals(requestCount, 1);
      assertEquals(responseCount, 1);
    });

    it("many", async () => {
      assertEquals(requestCount, 0);
      assertEquals(responseCount, 0);

      for (let i = 0; i < 5; i++) {
        await request();
      }
      assertEquals(requestCount, 5);
      assertEquals(responseCount, 5);
    });
  });

  describe("response count", () => {
    it("once", async () => {
      let count = 0;
      await request().then(() => {
        count++;
      });
      assertEquals(count, 1);
    });
  });
});

describe("error", () => {
  function mock() {
    mf.install();

    mf.mock("POST@/error/", () => {
      return new Response(`ok`, {
        status: 401,
      });
    });

    mf.mock("GET@/error/", () => {
      return new Response(`ok`, {
        status: 401,
      });
    });
  }

  mock();

  it("request and response", async () => {
    const ajax = new Ajax();
    const callStacks: number[] = [];
    await ajax.post("http://localhost/error/", {}).catch(() => {
      callStacks.push(1);
    });
    assertEquals(callStacks, [1]);

    await ajax.get("http://localhost/error/").catch(() => {
      callStacks.push(2);
    });
    assertEquals(callStacks, [1, 2]);
  });
});

describe("error should not cached", () => {
  const callStacks: number[] = [];
  function mock() {
    mf.install();

    mf.mock("GET@/error2/", () => {
      callStacks.push(2);
      return new Response(`ok`, {
        status: 401,
      });
    });
  }

  mock();

  it("not cached", async () => {
    const ajax = new Ajax();

    await ajax.get("http://localhost/error2/").catch(() => {
      callStacks.push(1);
    });
    assertEquals(callStacks, [2, 1]);

    await ajax.get("http://localhost/error2/").catch(() => {
      callStacks.push(3);
    });
    assertEquals(callStacks, [2, 1, 2, 3], "will not be cached");

    callStacks.length = 0;
  });

  it("not cached by set cachetimeout", async () => {
    const ajax = new Ajax();

    await ajax.get("http://localhost/error2/", null, {
      cacheTimeout: 1000,
    }).catch(() => {
      callStacks.push(1);
    });
    assertEquals(callStacks, [2, 1]);

    await ajax.get("http://localhost/error2/", null, {
      cacheTimeout: 1000,
    }).catch(() => {
      callStacks.push(3);
    });
    assertEquals(callStacks, [2, 1, 2, 3], "will not be cached");

    callStacks.length = 0;
  });
});
