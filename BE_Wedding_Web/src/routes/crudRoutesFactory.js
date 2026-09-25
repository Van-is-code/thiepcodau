const express = require('express');
const { authenticate } = require('../middlewares/auth');

const createCrudRouter = (controller) => {
  const router = express.Router();

  router.use(authenticate);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
};

module.exports = createCrudRouter;
