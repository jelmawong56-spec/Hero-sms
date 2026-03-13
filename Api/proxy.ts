import type { VercelRequest, VercelResponse } from '@vercel/node';

const HERO_SMS_API = 'https://api.herosms.com/stubs/handler_api.php';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, api_key, ...params } = req.query;

    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Build query string for HeroSMS
    const queryParams = new URLSearchParams({
      action: action as string,
      api_key: api_key as string,
      ...Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value as string;
        return acc;
      }, {} as Record<string, string>),
    });

    const url = `${HERO_SMS_API}?${queryParams.toString()}`;
    
    console.log('Proxying request to HeroSMS:', url.replace(api_key as string, '***'));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'HeroSMS-AutoOrder/1.0',
      },
    });

    const text = await response.text();
    console.log('HeroSMS response:', text);

    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(text);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
