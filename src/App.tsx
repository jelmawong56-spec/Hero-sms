import { useState, useEffect, useCallback, useRef } from 'react';
import { HeroSMSService } from '@/services/herosms';
import { COUNTRIES } from '@/types/herosms';
import type { Country, OrderDetails } from '@/types/herosms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Wallet,
  Globe,
  DollarSign,
  MessageSquare,
  Clock,
  Phone,
  Key,
  AlertTriangle,
  Package
} from 'lucide-react';
import { toast } from 'sonner';

function App() {
  // API Key state
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  
  // Balance state
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Country and price selection
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [price, setPrice] = useState<string>('0.18');
  
  // Order state
  const [currentOrder, setCurrentOrder] = useState<OrderDetails | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isWaitingOTP, setIsWaitingOTP] = useState(false);
  const [isWaitingStock, setIsWaitingStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(600); // 10 minutes
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stockRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Load saved API key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('herosms_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      // Don't auto-verify on load, let user click save
    }
  }, []);
  
  // Set default country
  useEffect(() => {
    if (!selectedCountry && COUNTRIES.length > 0) {
      setSelectedCountry(COUNTRIES[2]); // Default to Colombia
      setPrice(COUNTRIES[2].minPrice.toFixed(2));
    }
  }, [selectedCountry]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (stockRetryRef.current) clearTimeout(stockRetryRef.current);
    };
  }, []);
  
  const fetchBalance = async (key: string): Promise<boolean> => {
    setIsLoadingBalance(true);
    setApiKeyError(null);
    try {
      const service = new HeroSMSService(key);
      const result = await service.getBalance();
      setBalance(result.balance);
      setApiKeyError(null);
      return true;
    } catch (err: any) {
      console.error('Failed to fetch balance:', err);
      if (err.message?.includes('BAD_KEY')) {
        setApiKeyError('Invalid API Key. Please check your API key and try again.');
        setApiKeySaved(false);
        setBalance(null);
        return false;
      } else {
        setApiKeyError(err.message || 'Failed to connect to HeroSMS API');
        setBalance(null);
        return false;
      }
    } finally {
      setIsLoadingBalance(false);
    }
  };
  
  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }
    
    setApiKeyError(null);
    setIsLoadingBalance(true);
    
    const isValid = await fetchBalance(apiKey);
    
    if (isValid) {
      localStorage.setItem('herosms_api_key', apiKey);
      setApiKeySaved(true);
      toast.success('API key verified and saved!');
    } else {
      toast.error('Invalid API Key');
    }
  };
  
  const clearApiKey = () => {
    localStorage.removeItem('herosms_api_key');
    setApiKey('');
    setApiKeySaved(false);
    setBalance(null);
    setApiKeyError(null);
    toast.info('API key cleared');
  };
  
  const handleCountryChange = (countryName: string) => {
    const country = COUNTRIES.find(c => c.name === countryName);
    if (country) {
      setSelectedCountry(country);
      setPrice(country.minPrice.toFixed(2));
    }
  };
  
  const startCountdown = () => {
    setCountdown(600); // Reset to 10 minutes
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
  };
  
  const startOTPPolling = useCallback((service: HeroSMSService, activationId: string) => {
    setIsWaitingOTP(true);
    setOtpCode(null);
    startCountdown();
    
    // Mark as ready to receive SMS
    service.markReady(activationId).catch(console.error);
    
    // Start polling
    pollingRef.current = setInterval(async () => {
      try {
        const status = await service.getStatus(activationId);
        
        if (status.status === 'STATUS_OK' && status.code) {
          // OTP received!
          setOtpCode(status.code);
          setIsWaitingOTP(false);
          setCurrentOrder(prev => prev ? { ...prev, status: 'completed', code: status.code } : null);
          
          if (pollingRef.current) clearInterval(pollingRef.current);
          stopCountdown();
          
          // Complete the activation
          service.complete(activationId).catch(console.error);
          
          toast.success('OTP received successfully!');
        } else if (status.status === 'STATUS_CANCEL') {
          setIsWaitingOTP(false);
          setCurrentOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
          
          if (pollingRef.current) clearInterval(pollingRef.current);
          stopCountdown();
          
          toast.error('Activation was cancelled');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Check every 3 seconds
  }, []);
  
  const attemptOrder = async (): Promise<boolean> => {
    if (!apiKeySaved || !apiKey || !selectedCountry) return false;
    
    try {
      const service = new HeroSMSService(apiKey);
      const priceValue = parseFloat(price);
      
      // Get number with max price
      const result = await service.getNumber(selectedCountry.id, priceValue);
      
      const order: OrderDetails = {
        id: result.activationId,
        phoneNumber: result.phoneNumber,
        country: selectedCountry,
        price: priceValue,
        status: 'waiting_otp',
        createdAt: new Date(),
      };
      
      setCurrentOrder(order);
      setIsWaitingStock(false);
      setRetryCount(0);
      toast.success('Number ordered successfully!');
      
      // Start polling for OTP
      startOTPPolling(service, result.activationId);
      
      // Refresh balance
      fetchBalance(apiKey);
      
      return true;
    } catch (err: any) {
      // Check if it's a stock issue
      if (err.message?.includes('No numbers available') || err.message?.includes('NO_NUMBERS')) {
        return false; // Will trigger retry
      }
      
      // Check if API key error
      if (err.message?.includes('BAD_KEY') || err.message?.includes('Invalid API key')) {
        setApiKeyError('Invalid API Key. Please check your API key and try again.');
        setApiKeySaved(false);
        localStorage.removeItem('herosms_api_key');
        setIsOrdering(false);
        setIsWaitingStock(false);
        toast.error('Invalid API Key');
        throw err;
      }
      
      // Other errors
      setError(err.message || 'Failed to order number');
      toast.error(err.message || 'Failed to order number');
      setIsOrdering(false);
      setIsWaitingStock(false);
      throw err;
    }
  };
  
  const startStockRetry = useCallback(() => {
    setIsWaitingStock(true);
    setRetryCount(0);
    
    const retry = async () => {
      try {
        setRetryCount(prev => prev + 1);
        const success = await attemptOrder();
        
        if (!success) {
          // Stock still empty, retry in 1 second
          stockRetryRef.current = setTimeout(retry, 1000);
        }
      } catch (err) {
        // Stop retrying on non-stock errors
        setIsWaitingStock(false);
        setIsOrdering(false);
      }
    };
    
    retry();
  }, [apiKey, apiKeySaved, selectedCountry, price]);
  
  const handleOrder = async () => {
    if (!apiKeySaved || !apiKey) {
      toast.error('Please save your API key first');
      return;
    }
    
    if (!selectedCountry) {
      toast.error('Please select a country');
      return;
    }
    
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    
    if (priceValue < selectedCountry.minPrice || priceValue > selectedCountry.maxPrice) {
      toast.error(`Price must be between $${selectedCountry.minPrice} and $${selectedCountry.maxPrice}`);
      return;
    }
    
    setError(null);
    setIsOrdering(true);
    setOtpCode(null);
    
    try {
      const success = await attemptOrder();
      
      if (!success) {
        // No stock, start auto-retry
        toast.info('No stock available. Bot will auto-retry every 1 second...');
        startStockRetry();
      }
    } catch (err) {
      // Error already handled in attemptOrder
    } finally {
      if (!isWaitingStock) {
        setIsOrdering(false);
      }
    }
  };
  
  const handleCancel = async () => {
    // Cancel stock retry if active
    if (stockRetryRef.current) {
      clearTimeout(stockRetryRef.current);
      stockRetryRef.current = null;
    }
    
    if (!currentOrder || !apiKey) {
      setIsWaitingStock(false);
      setIsOrdering(false);
      setRetryCount(0);
      return;
    }
    
    try {
      const service = new HeroSMSService(apiKey);
      await service.cancel(currentOrder.id);
      
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopCountdown();
      
      setCurrentOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setIsWaitingOTP(false);
      setIsWaitingStock(false);
      setIsOrdering(false);
      
      toast.info('Order cancelled');
      fetchBalance(apiKey);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order');
    }
  };
  
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const resetOrder = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (stockRetryRef.current) clearTimeout(stockRetryRef.current);
    stopCountdown();
    setCurrentOrder(null);
    setOtpCode(null);
    setIsWaitingOTP(false);
    setIsWaitingStock(false);
    setIsOrdering(false);
    setError(null);
    setRetryCount(0);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            HeroSMS Auto Order
          </h1>
          <p className="text-slate-400">WhatsApp OTP Verification Service</p>
        </div>
        
        {/* API Key Section */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Key className="w-5 h-5" />
              API Configuration
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your HeroSMS API key to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="password"
                  placeholder="Enter your HeroSMS API key"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiKeyError(null);
                  }}
                  disabled={apiKeySaved}
                  className={`bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 ${
                    apiKeyError ? 'border-red-500' : ''
                  }`}
                />
              </div>
              <div className="flex gap-2">
                {!apiKeySaved ? (
                  <Button 
                    onClick={saveApiKey} 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={isLoadingBalance}
                  >
                    {isLoadingBalance ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save API Key
                  </Button>
                ) : (
                  <Button onClick={clearApiKey} variant="destructive">
                    Clear
                  </Button>
                )}
              </div>
            </div>
            
            {apiKeyError && (
              <Alert variant="destructive" className="mt-4 bg-red-900/20 border-red-700">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{apiKeyError}</AlertDescription>
              </Alert>
            )}
            
            {apiKeySaved && !apiKeyError && (
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">API Key verified</span>
                </div>
                {balance !== null && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Balance: ${balance.toFixed(2)}</span>
                  </div>
                )}
                {isLoadingBalance && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Order Configuration */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Globe className="w-5 h-5" />
              Order Configuration
            </CardTitle>
            <CardDescription className="text-slate-400">
              Select country and set your price for WhatsApp number
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Country Selection */}
            <div>
              <Label className="text-slate-300 mb-2 block">Select Country</Label>
              <Select 
                value={selectedCountry?.name} 
                onValueChange={handleCountryChange}
                disabled={isOrdering || isWaitingOTP || isWaitingStock}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Choose a country" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {COUNTRIES.map((country) => (
                    <SelectItem 
                      key={country.id} 
                      value={country.name}
                      className="text-white hover:bg-slate-700 focus:bg-slate-700"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{country.name}</span>
                        <span className="text-slate-400 text-sm ml-4">
                          ${country.minPrice} - ${country.maxPrice}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Price Input */}
            {selectedCountry && (
              <div>
                <Label className="text-slate-300 mb-2 block flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Your Price (USD)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    step="0.01"
                    min={selectedCountry.minPrice}
                    max={selectedCountry.maxPrice}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={isOrdering || isWaitingOTP || isWaitingStock}
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder={`${selectedCountry.minPrice} - ${selectedCountry.maxPrice}`}
                  />
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 whitespace-nowrap">
                    Range: ${selectedCountry.minPrice} - ${selectedCountry.maxPrice}
                  </Badge>
                </div>
              </div>
            )}
            
            {/* Order Button */}
            <Button
              onClick={handleOrder}
              disabled={!apiKeySaved || isOrdering || isWaitingOTP || isWaitingStock || !selectedCountry}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-semibold py-6"
            >
              {isWaitingStock ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Waiting for stock... ({retryCount} retries)
                </>
              ) : isOrdering ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Ordering...
                </>
              ) : isWaitingOTP ? (
                <>
                  <Clock className="w-5 h-5 mr-2" />
                  Waiting for OTP...
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Auto Order WhatsApp Number
                </>
              )}
            </Button>
            
            {/* Waiting Stock Info */}
            {isWaitingStock && (
              <Alert className="bg-yellow-900/20 border-yellow-700">
                <Package className="w-4 h-4 text-yellow-400" />
                <AlertDescription className="text-yellow-200">
                  No stock available right now. Bot is auto-retrying every 1 second until stock is available...
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-700">
                <XCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {/* Order Details */}
        {currentOrder && (
          <Card className="bg-slate-800/50 border-slate-700 mb-6 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-purple-400">
                  <Phone className="w-5 h-5" />
                  Order Details
                </CardTitle>
                <div className="flex gap-2">
                  {isWaitingOTP && (
                    <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(countdown)}
                    </Badge>
                  )}
                  <Badge 
                    variant="secondary" 
                    className={
                      currentOrder.status === 'completed' 
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : currentOrder.status === 'cancelled'
                        ? 'bg-red-600/20 text-red-400'
                        : 'bg-yellow-600/20 text-yellow-400'
                    }
                  >
                    {currentOrder.status === 'waiting_otp' && 'Waiting OTP'}
                    {currentOrder.status === 'completed' && 'Completed'}
                    {currentOrder.status === 'cancelled' && 'Cancelled'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone Number */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <Label className="text-slate-400 text-sm mb-1 block">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xl font-mono text-white">{currentOrder.phoneNumber}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(currentOrder.phoneNumber, 'Phone number')}
                    className="text-slate-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Activation ID */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <Label className="text-slate-400 text-sm mb-1 block">Activation ID</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-slate-300">{currentOrder.id}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(currentOrder.id, 'Activation ID')}
                    className="text-slate-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <Label className="text-slate-400 text-sm mb-1 block">Country</Label>
                  <p className="text-white">{currentOrder.country.name}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <Label className="text-slate-400 text-sm mb-1 block">Price</Label>
                  <p className="text-emerald-400">${currentOrder.price.toFixed(2)}</p>
                </div>
              </div>
              
              {/* OTP Display */}
              {otpCode && (
                <>
                  <Separator className="bg-slate-700" />
                  <div className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 rounded-lg p-6 border border-emerald-500/30 otp-glow">
                    <Label className="text-emerald-400 text-sm mb-2 block flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      OTP Code Received!
                    </Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-3xl font-mono font-bold text-white tracking-wider">
                        {otpCode}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(otpCode, 'OTP code')}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {(isWaitingOTP || isWaitingStock) && (
                  <Button
                    onClick={handleCancel}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {isWaitingStock ? 'Stop Retry' : 'Cancel Order'}
                  </Button>
                )}
                {(currentOrder.status === 'completed' || currentOrder.status === 'cancelled') && (
                  <Button
                    onClick={resetOrder}
                    variant="outline"
                    className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    New Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Instructions */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-300 text-lg">How to use</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-400 text-sm space-y-2">
            <p>1. Enter and save your HeroSMS API key</p>
            <p>2. Select your preferred country (Vietnam, Philippines, or Colombia)</p>
            <p>3. Set your specific price</p>
            <p>4. Click "Auto Order" - bot will auto-retry every 1 second if stock is empty</p>
            <p>5. Once number available, bot auto-orders and waits for OTP</p>
            <p>6. OTP will appear automatically (max 10 minutes)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
