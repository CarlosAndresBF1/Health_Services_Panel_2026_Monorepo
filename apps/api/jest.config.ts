import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.json",
        // Suppress TS resolution errors for external-integration files
        // that live outside the api project tree
        diagnostics: { exclude: ["**/external-integrations/**"] },
      },
    ],
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@healthpanel/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
  },
  // Resolve modules from api node_modules for external-integration tests
  moduleDirectories: ["node_modules", "<rootDir>/../node_modules"],
};

export default config;
