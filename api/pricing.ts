import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Allow forcing a country via ?country=TN for development testing
  const forceCountry = req.query.country as string;
  const country = forceCountry || (req.headers['x-vercel-ip-country'] as string) || 'US';
  
  const isTunisia = country.toUpperCase() === 'TN';

  res.status(200).json({
    country,
    currency: isTunisia ? 'DT' : 'USD',
    isLocalPricing: isTunisia
  });
}
