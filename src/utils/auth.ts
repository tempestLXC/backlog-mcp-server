export interface AuthConfig {
  apiKey: string;
}

export interface AuthHeaders {
  [header: string]: string;
}

export const createAuthHeaders = (config: AuthConfig): AuthHeaders => {
  if (!config.apiKey) {
    throw new Error('Backlog API key is required to authenticate requests.');
  }

  return {
    'X-API-Key': config.apiKey,
  };
};
