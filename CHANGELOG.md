# Changelog

## [0.9.1](https://github.com/hesedcasa/conni/compare/v0.9.0...v0.9.1) (2026-06-15)


### 🛠️ Fixes

* pass conni-config.json filename to createProfileManager in all commands ([c54af41](https://github.com/hesedcasa/conni/commit/c54af415730fc3ad06199ebceb97982c05242665))

## [0.9.0](https://github.com/hesedcasa/conni/compare/v0.8.0...v0.9.0) (2026-06-04)


### 🎉 Features

* upgrade @hesed/plugin-lib to 0.9.0 and pass configFile to auth commands ([f7d3e7f](https://github.com/hesedcasa/conni/commit/f7d3e7f6cc3f73e4b0fe6eb63abd94f1cceb329b))

## [0.8.0](https://github.com/hesedcasa/conni/compare/v0.7.2...v0.8.0) (2026-05-27)


### 🎉 Features

* add auth delete command ([#67](https://github.com/hesedcasa/conni/issues/67)) ([775a4e0](https://github.com/hesedcasa/conni/commit/775a4e07081ddbecf0d21fcdd2e37b3d7deaa457))


### ♻️ Chores

* migrate auth commands and format to @hesed/plugin-lib ([#66](https://github.com/hesedcasa/conni/issues/66)) ([89e5841](https://github.com/hesedcasa/conni/commit/89e5841a5504b76ebb7635d1f8c7c03be43d87c7))

## [0.7.2](https://github.com/hesedcasa/conni/compare/v0.7.1...v0.7.2) (2026-05-14)


### 🛠️ Fixes

* use outputJSON instead of writeJSON to ensure parent directories exist ([#59](https://github.com/hesedcasa/conni/issues/59)) ([41fa41e](https://github.com/hesedcasa/conni/commit/41fa41e6cee9d4bb8d88d6f19c81c0387f2740ff))

## [0.7.1](https://github.com/hesedcasa/conni/compare/v0.7.0...v0.7.1) (2026-05-10)


### 🛠️ Fixes

* improve auth commands validation and config handling ([#53](https://github.com/hesedcasa/conni/issues/53)) ([17a2e70](https://github.com/hesedcasa/conni/commit/17a2e7059d31fc83a07f9a3074d939f62386f0ef))
* improve auth commands validation and config handling ([#55](https://github.com/hesedcasa/conni/issues/55)) ([f62f2d0](https://github.com/hesedcasa/conni/commit/f62f2d08ef48dfd4f72cd40558dbdf483b7dab86))

## [0.7.0](https://github.com/hesedcasa/conni/compare/v0.6.1...v0.7.0) (2026-05-10)


### 🎉 Features

* support OAuth2 access token authentication ([#51](https://github.com/hesedcasa/conni/issues/51)) ([2441f67](https://github.com/hesedcasa/conni/commit/2441f6795fb418df48928be6ce2a23794b34857c))

## [0.6.1](https://github.com/hesedcasa/conni/compare/v0.6.0...v0.6.1) (2026-05-10)


### 🛠️ Fixes

* apply --full-width flag in content update command ([#49](https://github.com/hesedcasa/conni/issues/49)) ([55c50e1](https://github.com/hesedcasa/conni/commit/55c50e1b1826eb9661203af2f6523c0dc2767ac4))

## [0.6.0](https://github.com/hesedcasa/conni/compare/v0.5.0...v0.6.0) (2026-05-09)


### 🎉 Features

* add multi-profile authentication support ([#47](https://github.com/hesedcasa/conni/issues/47)) ([bccf088](https://github.com/hesedcasa/conni/commit/bccf088ce55bb9d4219745a093e600a0be07eb5c))

## [0.5.0](https://github.com/hesedcasa/conni/compare/v0.4.0...v0.5.0) (2026-05-09)


### 🎉 Features

* add full-width, storage representation, and [@file](https://github.com/file) syntax to content create ([#45](https://github.com/hesedcasa/conni/issues/45)) ([585cd29](https://github.com/hesedcasa/conni/commit/585cd2983aa508ea3e30bbdf7ed58a42e30777e6))

## [0.4.0](https://github.com/hesedcasa/conni/compare/v0.3.1...v0.4.0) (2026-04-07)


### 🎉 Features

* add --attach flag for inline media upload on page create ([#27](https://github.com/hesedcasa/conni/issues/27)) ([ec3e3b3](https://github.com/hesedcasa/conni/commit/ec3e3b31ffaeb30ce07b8203de4dba38e049502c))

## [0.3.1](https://github.com/hesedcasa/conni/compare/v0.3.0...v0.3.1) (2026-04-07)


### 📄 Documentation

* update README with optional auth flags and platform info ([#25](https://github.com/hesedcasa/conni/issues/25)) ([4c744f4](https://github.com/hesedcasa/conni/commit/4c744f4d8db75fe7b247e3a6040fb2d7e415c94f))

## [0.3.0](https://github.com/hesedcasa/conni/compare/v0.2.1...v0.3.0) (2026-04-06)


### 🎉 Features

* add parentId example and fix ancestors field in create command ([#23](https://github.com/hesedcasa/conni/issues/23)) ([6042f3a](https://github.com/hesedcasa/conni/commit/6042f3a7587040b00ce000303a51a5ffab783b2f))

## [0.2.1](https://github.com/hesedcasa/conni/compare/v0.2.0...v0.2.1) (2026-03-04)


### 🛠️ Fixes

* remove unused oclif plugin ([69dbf6d](https://github.com/hesedcasa/conni/commit/69dbf6d55a639c6f81a2dff715913e54d8cd1541))

## [0.2.0](https://github.com/hesedcasa/conni/compare/v0.1.0...v0.2.0) (2026-03-02)


### 🎉 Features

* initial commit ([195f896](https://github.com/hesedcasa/conni/commit/195f8961c2885d4141f72cad94ae9dea9b44db77))


### 📄 Documentation

* update CLAUDE.md and add Apache LICENSE ([#2](https://github.com/hesedcasa/conni/issues/2)) ([b261483](https://github.com/hesedcasa/conni/commit/b261483da95b858a4068f0a574ff7fa1e58de74d))

## Changelog


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
