const express = require('express');

const createOnlyRouter = (controller) => {
  const router = express.Router();

  router.post('/', controller.create);

  return router;
};

module.exports = createOnlyRouter;
