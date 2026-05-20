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

  static async getRecommendedSites(req, res) {
    try {
      const { type = '幼儿园', radius = 300 } = req.query;
      const sites = await AnalysisModel.getRecommendedSites(type, radius);
      res.json({ success: true, data: sites });
    } catch (error) {
      console.error('获取推荐选址失败:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AnalysisController;