'use strict';

module.exports = {
  up: async () => {
    // No-op: schema now defined directly by initial migrations.
    return Promise.resolve();
  },

  down: async () => {
    return Promise.resolve();
  }
};
