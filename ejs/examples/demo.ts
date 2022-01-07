import { render, renderFile } from "../mod.ts";

const users = ["geddy", "neil", "alex"];
const res = render('<p>[?= users.join(" | "); ?]</p>', { users: users }, {
  delimiter: "?",
  openDelimiter: "[",
  closeDelimiter: "]",
});
// => '<p>geddy | neil | alex</p>'

console.log(res);

const str = await renderFile(
  "./template.ejs",
  {
    title: "from test2",
    name: "world",
    age: 18,
  },
  {},
);
console.log(str);
