import axios, { AxiosInstance } from 'axios';
import { config } from './config.js';

export const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
    ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
  },
});
