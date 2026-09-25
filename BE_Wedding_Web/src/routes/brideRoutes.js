const express = require('express');
const { authenticate } = require('../middlewares/auth');
const brideController = require('../controllers/brideController');

const router = express.Router();

router.use(authenticate);

router.get('/', brideController.getAll);
router.get('/:id', brideController.getById);
router.post('/', brideController.create);
router.put('/:id', brideController.update);
router.patch('/:id', brideController.update);
router.delete('/:id', brideController.remove);

module.exports = router;
