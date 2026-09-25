const { randomUUID } = require('crypto');

class CrudService {
  constructor(model, resourceName) {
    this.model = model;
    this.resourceName = resourceName;
  }

  async getAll(query = {}) {
    const page = Number.parseInt(query.page, 10) || 1;
    const limit = Number.parseInt(query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const filters = { ...query };
    delete filters.page;
    delete filters.limit;

    const orderField = this.model.rawAttributes.created_at
      ? 'created_at'
      : (this.model.rawAttributes.create_at ? 'create_at' : null);

    const findOptions = {
      where: filters,
      limit,
      offset
    };

    if (orderField) {
      findOptions.order = [[orderField, 'DESC']];
    }

    const { count, rows } = await this.model.findAndCountAll(findOptions);

    return {
      items: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async getById(id) {
    const item = await this.model.findByPk(id);
    if (!item) {
      const error = new Error(`${this.resourceName} not found`);
      error.status = 404;
      throw error;
    }
    return item;
  }

  async create(payload, options = {}) {
    const data = { ...payload };
    const now = new Date();

    const getNowValue = (fieldName) => {
      const attribute = this.model.rawAttributes[fieldName];
      if (!attribute) {
        return undefined;
      }

      const typeKey = attribute.type?.key;
      return typeKey === 'STRING' || typeKey === 'TEXT'
        ? now.toISOString()
        : now;
    };

    if (this.model.rawAttributes.id) {
      delete data.id;
      data.id = randomUUID();
    }

    if (this.model.rawAttributes.users_id) {
      if (!options.userId) {
        const error = new Error('Thiếu thông tin user từ token');
        error.status = 401;
        throw error;
      }
      data.users_id = options.userId;
    }

    if (this.model.rawAttributes.created_at) {
      data.created_at = getNowValue('created_at');
    }

    if (this.model.rawAttributes.create_at) {
      data.create_at = getNowValue('create_at');
    }

    if (this.model.rawAttributes.updated_at) {
      data.updated_at = getNowValue('updated_at');
    }

    return this.model.create(data);
  }

  async update(id, payload, options = {}) {
    const item = await this.getById(id);

    const data = { ...payload };
    delete data.id;

    if (this.model.rawAttributes.users_id) {
      if (!options.userId) {
        const error = new Error('Thiếu thông tin user từ token');
        error.status = 401;
        throw error;
      }
      data.users_id = options.userId;
    }

    if (this.model.rawAttributes.updated_at) {
      const typeKey = this.model.rawAttributes.updated_at.type?.key;
      data.updated_at = (typeKey === 'STRING' || typeKey === 'TEXT')
        ? new Date().toISOString()
        : new Date();
    }

    await item.update(data);
    return item;
  }

  async delete(id) {
    const item = await this.getById(id);
    await item.destroy();
    return true;
  }
}

module.exports = CrudService;
