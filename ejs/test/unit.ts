// deno run --unstable --allow-read  unit.ts
import { assert } from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { render, renderFile } from "../mod.ts";

Deno.test("test render", () => {
  const users = ["geddy", "neil", "alex"];
  let res = render('<p>[?= users.join(" | "); ?]</p>', { users: users }, {
    delimiter: "?",
    openDelimiter: "[",
    closeDelimiter: "]",
  });
  assert(res, "<p>geddy | neil | alex</p>");
});

Deno.test("test renderFile", () => {
  renderFile( // 需要在根目录执行
    Deno.cwd() + "/examples/template.ejs",
    {
      title: "from test2",
      name: "world",
      age: 18,
    },
    {},
    function (err: Error, str: any) {
      if (err) {
        console.error(err);
      } else {
        assert(
          str,
          `<body>
<h1>from test2!</h1>
<h1>18</h1>


    <h1>hello, world!</h1>

</body>`,
        );
      }
    },
  );
});
