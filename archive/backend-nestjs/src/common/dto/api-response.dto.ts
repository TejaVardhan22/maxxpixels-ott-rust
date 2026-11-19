export class ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
  result?: T;
  code?: string;
  errors?: any;
  timestamp: string;

  constructor(partial: Partial<ApiResponse<T>>) {
    Object.assign(this, partial);
    this.timestamp = partial.timestamp || new Date().toISOString();
  }

  static success<T>(data: T, message = 'Success', status = 200): ApiResponse<T> {
    return new ApiResponse<T>({
      success: true,
      status,
      message,
      data,
      result: data, // Dual-key compatibility for Web, Mobile & Smart TV apps
      timestamp: new Date().toISOString(),
    });
  }

  static ok<T>(data: T, message = 'Success', status = 200): ApiResponse<T> {
    return ApiResponse.success(data, message, status);
  }

  static error<T = any>(
    status: number,
    message: string,
    code?: string,
    errors?: any,
  ): ApiResponse<T> {
    return new ApiResponse<T>({
      success: false,
      status,
      message,
      code,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}
