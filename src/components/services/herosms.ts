import { COUNTRIES, SERVICE_CODE } from '@/types/herosms';
import type { BalanceResponse, NumberResponse, StatusResponse } from '@/types/herosms';

// Use proxy to avoid CORS issues
const PROXY_URL = '/api/herosms';

export class HeroSMSService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(params: Record<string, string>): Promise<string> {
    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      ...params,
    });
    
    // Always use proxy to avoid CORS issues
    const url = `${PROXY_URL}?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('HeroSMS API Error:', error);
      throw error;
    }
  }

  async getBalance(): Promise<BalanceResponse> {
    const response = await this.makeRequest({ action: 'getBalance' });
    
    if (response.startsWith('ACCESS_BALANCE:')) {
      const balance = parseFloat(response.split(':')[1]);
      return { balance };
    }
    
    // Handle specific error responses
    if (response === 'BAD_KEY') {
      throw new Error('BAD_KEY: Invalid API key. Please check your API key and try again.');
    }
    
    throw new Error(`Failed to get balance: ${response}`);
  }

  async getNumber(countryId: number, maxPrice?: number): Promise<NumberResponse> {
    const params: Record<string, string> = {
      action: 'getNumberV2',
      service: SERVICE_CODE,
      country: countryId.toString(),
    };
    
    if (maxPrice) {
      params.maxPrice = maxPrice.toString();
    }
    
    const response = await this.makeRequest(params);
    
    // Response format: ACCESS_NUMBER:activationId:phoneNumber
    if (response.startsWith('ACCESS_NUMBER:')) {
      const parts = response.split(':');
      return {
        activationId: parts[1],
        phoneNumber: parts[2],
      };
    }
    
    // Handle errors
    if (response === 'NO_NUMBERS') {
      throw new Error('No numbers available for this country');
    }
    if (response === 'NO_BALANCE') {
      throw new Error('Insufficient balance');
    }
    if (response === 'BAD_KEY') {
      throw new Error('Invalid API key');
    }
    if (response === 'BAD_SERVICE') {
      throw new Error('Invalid service code');
    }
    if (response === 'BAD_COUNTRY') {
      throw new Error('Invalid country code');
    }
    if (response === 'BAD_MAX_PRICE') {
      throw new Error('Invalid max price');
    }
    if (response === 'ERROR_SQL') {
      throw new Error('Database error, please try again');
    }
    
    throw new Error(`Failed to get number: ${response}`);
  }

  async getStatus(activationId: string): Promise<StatusResponse> {
    const response = await this.makeRequest({
      action: 'getStatus',
      id: activationId,
    });
    
    // Response format: STATUS_OK:code or STATUS_WAIT_CODE or STATUS_CANCEL
    if (response.startsWith('STATUS_OK:')) {
      const code = response.split(':')[1];
      return { status: 'STATUS_OK', code };
    }
    
    if (response === 'STATUS_WAIT_CODE') {
      return { status: 'STATUS_WAIT_CODE' };
    }
    
    if (response === 'STATUS_WAIT_RETRY') {
      return { status: 'STATUS_WAIT_RETRY' };
    }
    
    if (response === 'STATUS_CANCEL') {
      return { status: 'STATUS_CANCEL' };
    }
    
    if (response === 'BAD_KEY') {
      throw new Error('Invalid API key');
    }
    
    if (response === 'NO_ACTIVATION') {
      throw new Error('Activation not found');
    }
    
    throw new Error(`Failed to get status: ${response}`);
  }

  async setStatus(activationId: string, status: number): Promise<string> {
    const response = await this.makeRequest({
      action: 'setStatus',
      id: activationId,
      status: status.toString(),
    });
    
    // Status 1 = Ready to receive SMS
    // Status 6 = Complete activation
    // Status 8 = Cancel activation
    
    if (response === 'ACCESS_READY') {
      return 'ready';
    }
    if (response === 'ACCESS_RETRY_GET') {
      return 'retry';
    }
    if (response === 'ACCESS_ACTIVATION') {
      return 'activation';
    }
    if (response === 'ACCESS_CANCEL') {
      return 'cancelled';
    }
    
    throw new Error(`Failed to set status: ${response}`);
  }

  async markReady(activationId: string): Promise<void> {
    await this.setStatus(activationId, 1);
  }

  async complete(activationId: string): Promise<void> {
    await this.setStatus(activationId, 6);
  }

  async cancel(activationId: string): Promise<void> {
    await this.setStatus(activationId, 8);
  }

  // Poll for OTP with timeout
  async pollForOTP(
    activationId: string,
    timeoutMs: number = 600000, // 10 minutes default
    intervalMs: number = 5000   // Check every 5 seconds
  ): Promise<string> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const elapsed = Date.now() - startTime;
          
          if (elapsed >= timeoutMs) {
            reject(new Error('Timeout waiting for OTP'));
            return;
          }
          
          const status = await this.getStatus(activationId);
          
          if (status.status === 'STATUS_OK' && status.code) {
            resolve(status.code);
            return;
          }
          
          if (status.status === 'STATUS_CANCEL') {
            reject(new Error('Activation was cancelled'));
            return;
          }
          
          // Continue polling
          setTimeout(checkStatus, intervalMs);
        } catch (error) {
          reject(error);
        }
      };
      
      checkStatus();
    });
  }
}

export const getCountries = () => COUNTRIES;
