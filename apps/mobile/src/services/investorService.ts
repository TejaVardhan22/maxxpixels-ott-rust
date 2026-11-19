import { ApiClient } from './apiClient';
import { AuthService } from './authService';

export interface InvestorDashboardData {
  totalInvestment: number;
  expectedReturns: number;
  activeProjects: number;
  totalInvestors: number;
  projects: Array<{
    id: number;
    title: string;
    targetAmount: number;
    collectedAmount: number;
    progressPercentage: number;
    roi: string;
    posterUrl: string;
  }>;
}

export class InvestorService {
  public static async getDashboard(): Promise<InvestorDashboardData> {
    try {
      const result = await ApiClient.postApi(
        'investor/dashboard',
        { user_id: AuthService.user?.id || 0 },
        { userToken: AuthService.authToken || undefined }
      );

      if (result && typeof result === 'object') {
        return {
          totalInvestment: result.total_investment || 0,
          expectedReturns: result.expected_returns || 0,
          activeProjects: result.active_projects || 0,
          totalInvestors: result.total_investors || 0,
          projects: Array.isArray(result.projects)
            ? result.projects.map((p: any) => ({
                id: p.id || 0,
                title: p.title || '',
                targetAmount: p.target_amount || 0,
                collectedAmount: p.collected_amount || 0,
                progressPercentage: p.progress_percentage || 0,
                roi: p.roi || 'Not provided',
                posterUrl: p.poster_url || '',
              }))
            : [],
        };
      }
    } catch {}

    throw new Error('Investor information is unavailable. Please try again later.');
  }
}
