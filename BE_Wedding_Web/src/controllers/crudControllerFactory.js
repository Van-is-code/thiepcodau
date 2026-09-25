const createCrudController = (service, resourceLabel) => {
  const getAll = async (req, res) => {
    try {
      const data = await service.getAll(req.query);
      return res.status(200).json({
        success: true,
        message: `Get ${resourceLabel} list successfully`,
        data
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || `Failed to get ${resourceLabel} list`
      });
    }
  };

  const getById = async (req, res) => {
    try {
      const data = await service.getById(req.params.id);
      return res.status(200).json({
        success: true,
        message: `Get ${resourceLabel} successfully`,
        data
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || `Failed to get ${resourceLabel}`
      });
    }
  };

  const create = async (req, res) => {
    try {
      const data = await service.create(req.body, {
        userId: req.user?.id
      });
      return res.status(201).json({
        success: true,
        message: `Create ${resourceLabel} successfully`,
        data
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || `Failed to create ${resourceLabel}`
      });
    }
  };

  const update = async (req, res) => {
    try {
      const data = await service.update(req.params.id, req.body, {
        userId: req.user?.id
      });
      return res.status(200).json({
        success: true,
        message: `Update ${resourceLabel} successfully`,
        data
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || `Failed to update ${resourceLabel}`
      });
    }
  };

  const remove = async (req, res) => {
    try {
      await service.delete(req.params.id);
      return res.status(200).json({
        success: true,
        message: `Delete ${resourceLabel} successfully`
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || `Failed to delete ${resourceLabel}`
      });
    }
  };

  return {
    getAll,
    getById,
    create,
    update,
    remove
  };
};

module.exports = createCrudController;
