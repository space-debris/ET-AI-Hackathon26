import axios from 'axios';
import {
  MOCK_PORTFOLIO_ANALYTICS,
  MOCK_REBALANCING_ACTIONS,
  MOCK_FIRE_MILESTONES,
  MOCK_TAX_COMPARISON,
  MOCK_HEALTH_SCORE,
  MOCK_USER_PROFILE,
} from '../utils/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to use mock data (set to true during development)
const USE_MOCK_DATA = true;

// Simulate API delay for realistic UX
const simulateDelay = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

// Portfolio API
export const portfolioApi = {
  async uploadStatement(file) {
    if (USE_MOCK_DATA) {
      await simulateDelay(2000);
      return {
        success: true,
        message: 'Statement processed successfully',
        data: MOCK_PORTFOLIO_ANALYTICS,
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/portfolio/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getAnalytics() {
    if (USE_MOCK_DATA) {
      await simulateDelay(500);
      return MOCK_PORTFOLIO_ANALYTICS;
    }

    const response = await api.get('/portfolio/analytics');
    return response.data;
  },

  async getRebalancingPlan() {
    if (USE_MOCK_DATA) {
      await simulateDelay(800);
      return MOCK_REBALANCING_ACTIONS;
    }

    const response = await api.get('/portfolio/rebalancing');
    return response.data;
  },
};

// FIRE Planner API
export const fireApi = {
  async generatePlan(profile) {
    if (USE_MOCK_DATA) {
      await simulateDelay(1500);
      return {
        milestones: MOCK_FIRE_MILESTONES,
        summary: {
          targetCorpus: 24000000,
          yearsToFire: 14,
          monthlyTarget: 100000,
          insuranceGap: 5000000,
        },
      };
    }

    const response = await api.post('/fire/generate', profile);
    return response.data;
  },

  async updatePlan(updatedProfile) {
    if (USE_MOCK_DATA) {
      await simulateDelay(800);
      // Simulate dynamic update based on profile changes
      const adjustmentFactor = updatedProfile.targetRetirementAge === 55 ? 1.2 : 1;
      return {
        milestones: MOCK_FIRE_MILESTONES.map((m) => ({
          ...m,
          totalCorpus: Math.round(m.totalCorpus * adjustmentFactor),
        })),
        summary: {
          targetCorpus: Math.round(24000000 * adjustmentFactor),
          yearsToFire: updatedProfile.targetRetirementAge - updatedProfile.age,
          monthlyTarget: 100000,
          insuranceGap: 5000000,
        },
      };
    }

    const response = await api.put('/fire/update', updatedProfile);
    return response.data;
  },
};

// Tax Optimizer API
export const taxApi = {
  async compareRegimes(profile) {
    if (USE_MOCK_DATA) {
      await simulateDelay(1200);
      return MOCK_TAX_COMPARISON;
    }

    const response = await api.post('/tax/compare', profile);
    return response.data;
  },

  async getOptimizations(profile) {
    if (USE_MOCK_DATA) {
      await simulateDelay(800);
      return {
        suggestions: MOCK_TAX_COMPARISON.additionalInstruments,
        totalPotentialSaving: 23400,
      };
    }

    const response = await api.post('/tax/optimize', profile);
    return response.data;
  },
};

// Health Score API
export const healthApi = {
  async getScore() {
    if (USE_MOCK_DATA) {
      await simulateDelay(600);
      return {
        dimensions: MOCK_HEALTH_SCORE,
        overallScore: Math.round(
          MOCK_HEALTH_SCORE.reduce((sum, d) => sum + d.score, 0) / MOCK_HEALTH_SCORE.length
        ),
      };
    }

    const response = await api.get('/health/score');
    return response.data;
  },
};

// User Profile API
export const userApi = {
  async getProfile() {
    if (USE_MOCK_DATA) {
      await simulateDelay(300);
      return MOCK_USER_PROFILE;
    }

    const response = await api.get('/user/profile');
    return response.data;
  },

  async updateProfile(profile) {
    if (USE_MOCK_DATA) {
      await simulateDelay(500);
      return { success: true, data: profile };
    }

    const response = await api.put('/user/profile', profile);
    return response.data;
  },
};

// Run full pipeline
export const pipelineApi = {
  async runAnalysis(file, profile) {
    if (USE_MOCK_DATA) {
      await simulateDelay(3000);
      return {
        portfolio: MOCK_PORTFOLIO_ANALYTICS,
        rebalancing: MOCK_REBALANCING_ACTIONS,
        healthScore: MOCK_HEALTH_SCORE,
        fire: {
          milestones: MOCK_FIRE_MILESTONES,
          summary: {
            targetCorpus: 24000000,
            yearsToFire: 14,
            monthlyTarget: 100000,
          },
        },
        tax: MOCK_TAX_COMPARISON,
      };
    }

    const formData = new FormData();
    if (file) formData.append('file', file);
    formData.append('profile', JSON.stringify(profile));

    const response = await api.post('/pipeline/run', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default api;
