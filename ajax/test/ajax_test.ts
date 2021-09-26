// Copyright 2018-2021 the oak authors. All rights reserved. MIT license.
import {assert, assertEquals, assertThrows, describe, it, beforeEach, afterEach, mf} from "./test_deps.ts";
import {BaseAjax} from "../src/ajax.ts";
import {ajax} from "../example.ts";

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

function mock(){
  mf.install();

  mf.mock("GET@/api/", (_req) => {
    // @ts-ignore
    return new Response(`ok`, {
      status: 200
    });
  });
}

mock();

describe("ajax", () => {
  let ajax: Ajax;

  beforeEach(() => {
    ajax = new Ajax();
  });

  const request = () => ajax.get('http://localhost/api/');

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

    it('once', async () => {
      assertEquals(requestCount, 0);
      assertEquals(responseCount, 0);

      await request();
      assertEquals(requestCount, 1);
      assertEquals(responseCount, 1);
    });

    it('many', async () => {
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
    it('once', async () => {
      let count = 0;
      await request().then(() => {
        count++;
      });
      assertEquals(count, 1);
    })
  });
});
