const express = require('express');
const { authenticate } = require('../middlewares/auth');
const groomController = require('../controllers/groomController');

const router = express.Router();

router.use(authenticate);

router.get('/', groomController.getAll);
router.get('/:id', groomController.getById);
router.post('/', groomController.create);
router.put('/:id', groomController.update);
router.patch('/:id', groomController.update);
router.delete('/:id', groomController.remove);

module.exports = router;
