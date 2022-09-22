process.env.CHROME_BIN = require("puppeteer").executablePath();

module.exports = function (config) {
  config.set({
    baseURL: "./",
    frameworks: ["jasmine", "karma-typescript"],
    files: ["tests/*.spec.ts"],
    browsers: ["ChromeHeadless"],
    preprocessors: {
      "**/*.ts": "karma-typescript",
    },
    karmaTypescriptConfig: {
      tsconfig: "tsconfig.json",
      compilerOptions: {
        module: "CommonJS",
      },
    },
  });
};
