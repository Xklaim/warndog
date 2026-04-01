'use strict';

const { Engine }        = require('./engine');
const { loadConfig }    = require('./config');
const { loadPlugins, createPlugin, createRule } = require('./plugins');
const { getAllRules }   = require('./rules');

module.exports = {
  Engine,
  loadConfig,
  loadPlugins,
  createPlugin,
  createRule,
  getAllRules,
};
