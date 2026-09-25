const invitationTemplateService = require('../services/invitationTemplateService');

const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);
const templateUploadService = require('../services/templateUploadService');

const getAll = async (req, res) => {
	try {
		const data = await invitationTemplateService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get invitation_template list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get invitation_template list' });
	}
};

const getById = async (req, res) => {
	try {
		const data = await invitationTemplateService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get invitation_template successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get invitation_template' });
	}
};

const create = async (req, res) => {
	try {
		const data = await invitationTemplateService.create(req.body);
		return res.status(201).json({ success: true, message: 'Create invitation_template successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create invitation_template' });
	}
};

const update = async (req, res) => {
	try {
		const data = await invitationTemplateService.update(req.params.id, req.body);
		return res.status(200).json({ success: true, message: 'Update invitation_template successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to update invitation_template' });
	}
};

const remove = async (req, res) => {
	try {
		await invitationTemplateService.remove(req.params.id);
		return res.status(200).json({ success: true, message: 'Delete invitation_template successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete invitation_template' });
	}
};

// Upload 1 gói mẫu thiệp (.zip) và đăng ký luôn vào invitation_templates trong 1 lần gọi.
// multipart/form-data: package=<file.zip>, template_code, template_name, [entry_file], [status], [schema]
const uploadPackage = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Vui lòng gửi file zip qua field "package"' });
		}

		const { code, htmlPath } = templateUploadService.extractPackage({
			buffer: req.file.buffer,
			templateCode: req.body.template_code,
			entryFile: req.body.entry_file
		});

		let schema = null;
		if (req.body.schema) {
			try {
				schema = JSON.parse(req.body.schema);
			} catch (_err) {
				return res.status(400).json({ success: false, message: 'Trường schema phải là JSON hợp lệ' });
			}
		}

		const data = await invitationTemplateService.create({
			template_code: code,
			template_name: req.body.template_name || code,
			html_path: htmlPath,
			status: req.body.status || 'draft',
			schema
		});

		return res.status(201).json({ success: true, message: 'Upload mẫu thiệp thành công', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Upload mẫu thiệp thất bại' });
	}
};

module.exports = { getAll, getById, create, update, remove, uploadPackage };
