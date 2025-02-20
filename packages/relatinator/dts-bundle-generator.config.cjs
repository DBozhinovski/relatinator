const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

const getPackageName = () => {
  return packageJson.name;
};

const config = {
  entries: [
    {
      filePath: "./src/index.ts",
      outFile: `./dist/${getPackageName()}.d.ts`,
      noCheck: true,
    },
  ],
};

module.exports = config;
