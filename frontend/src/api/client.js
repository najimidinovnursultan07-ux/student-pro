import axios from "axios";
import { API_BASE } from "../config/api";
import { clearAuth, getAccessToken } from "../utils/authStorage";

export const apiClient = axios.create({
  baseURL: API_BASE,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export async function loginRequest(username, password) {
  const { data } = await apiClient.post("/auth/login/", { username, password });
  return data;
}

export async function registerRequest(username, password, email = "") {
  const { data } = await apiClient.post("/auth/register/", { username, password, email });
  return data;
}

export async function solveRequest(formData) {
  const { data } = await apiClient.post("/solve/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
