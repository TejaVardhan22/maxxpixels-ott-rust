// Default runtime environment (overwritten by Docker entrypoint from .env)
window.__ENV__ = window.__ENV__ || {
  API_HOST: '',
  API_BASE_URL: '/api/v1',
  APP_NAME: 'MaxxPixels OTT Admin'
};
