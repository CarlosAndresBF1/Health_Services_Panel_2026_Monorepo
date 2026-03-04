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
        tsconfig: {
          paths: {
            "@/*": ["./src/*"],
            "@healthpanel/shared": ["../../packages/shared/src/index.ts"],
          },
        },
      },
    ],
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@healthpanel/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
  },
};

export default config;
