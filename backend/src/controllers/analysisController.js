const AnalysisModel = require('../models/AnalysisModel');

class AnalysisController {
  static async getEducationSupply(req, res) {
    try {
      const data = await AnalysisModel.getEducationSupply();
      res.json({ success: true, data });
    } catch (error) {
      console.error('获取教育供需数据失败:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AnalysisController;