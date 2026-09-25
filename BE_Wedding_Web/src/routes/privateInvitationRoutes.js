const express = require('express');
const { authenticate } = require('../middlewares/auth');
const privateInvitationController = require('../controllers/privateInvitationController');

const router = express.Router();

router.use(authenticate);

router.get('/', privateInvitationController.getAll);
router.get('/:id', privateInvitationController.getById);
router.post('/', privateInvitationController.create);
router.put('/:id', privateInvitationController.update);
router.patch('/:id', privateInvitationController.update);
router.delete('/:id', privateInvitationController.remove);

module.exports = router;
