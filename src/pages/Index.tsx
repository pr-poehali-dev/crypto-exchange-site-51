import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { toast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  full_name: string;
  telegram_wallet: string;
}

interface Wallet {
  currency: string;
  balance: string;
}

interface Transaction {
  id: number;
  type: string;
  from_currency: string;
  to_currency: string;
  from_amount: string;
  to_amount: string;
  rate: string;
  created_at: string;
  status: string;
}

interface CryptoRate {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const CRYPTO_RATES: CryptoRate[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 43250.80, change24h: 2.45 },
  { symbol: 'ETH', name: 'Ethereum', price: 2280.50, change24h: -1.23 },
  { symbol: 'USDT', name: 'Tether', price: 1.00, change24h: 0.01 },
  { symbol: 'BNB', name: 'Binance Coin', price: 315.75, change24h: 3.12 },
  { symbol: 'XRP', name: 'Ripple', price: 0.52, change24h: -0.87 },
];

const AUTH_URL = 'https://functions.poehali.dev/fe9caa61-cc19-47f2-bf26-40d22077ecac';
const WALLET_URL = 'https://functions.poehali.dev/fb44c3bf-2301-4009-a6c3-051d40df8727';

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState('exchange');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regTelegram, setRegTelegram] = useState('');

  const [fromCurrency, setFromCurrency] = useState('BTC');
  const [toCurrency, setToCurrency] = useState('USDT');
  const [exchangeAmount, setExchangeAmount] = useState('');

  const [withdrawCurrency, setWithdrawCurrency] = useState('BTC');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user && token) {
      loadWallets();
      loadTransactions();
    }
  }, [user, token]);

  const handleLogin = async () => {
    try {
      const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginEmail,
          password: loginPassword,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast({ title: 'Успешный вход!', description: `Добро пожаловать, ${data.user.full_name}` });
      } else {
        toast({ title: 'Ошибка входа', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось подключиться к серверу', variant: 'destructive' });
    }
  };

  const handleRegister = async () => {
    try {
      const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: regEmail,
          password: regPassword,
          full_name: regFullName,
          telegram_wallet: regTelegram,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast({ title: 'Регистрация успешна!', description: 'Ваш аккаунт создан' });
      } else {
        toast({ title: 'Ошибка регистрации', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось подключиться к серверу', variant: 'destructive' });
    }
  };

  const loadWallets = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${WALLET_URL}?user_id=${user.id}&action=balance`, {
        headers: { 'X-User-Token': token },
      });
      const data = await response.json();
      if (response.ok) {
        setWallets(data.wallets);
      }
    } catch (error) {
      console.error('Failed to load wallets', error);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${WALLET_URL}?user_id=${user.id}&action=history`, {
        headers: { 'X-User-Token': token },
      });
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to load transactions', error);
    }
  };

  const handleExchange = async () => {
    if (!user || !exchangeAmount) return;
    
    const fromRate = CRYPTO_RATES.find(r => r.symbol === fromCurrency);
    const toRate = CRYPTO_RATES.find(r => r.symbol === toCurrency);
    
    if (!fromRate || !toRate) return;
    
    const rate = toRate.price / fromRate.price;
    
    try {
      const response = await fetch(WALLET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': token,
        },
        body: JSON.stringify({
          action: 'exchange',
          user_id: user.id,
          from_currency: fromCurrency,
          to_currency: toCurrency,
          from_amount: parseFloat(exchangeAmount),
          rate: rate,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Обмен выполнен!', description: `Вы получили ${data.to_amount.toFixed(8)} ${toCurrency}` });
        loadWallets();
        loadTransactions();
        setExchangeAmount('');
      } else {
        toast({ title: 'Ошибка обмена', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось выполнить обмен', variant: 'destructive' });
    }
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount) return;
    
    try {
      const response = await fetch(WALLET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': token,
        },
        body: JSON.stringify({
          action: 'withdraw',
          user_id: user.id,
          currency: withdrawCurrency,
          amount: parseFloat(withdrawAmount),
          telegram_wallet: user.telegram_wallet,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Вывод инициирован', description: data.message });
        loadWallets();
        loadTransactions();
        setWithdrawAmount('');
      } else {
        toast({ title: 'Ошибка вывода', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось выполнить вывод', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast({ title: 'Выход выполнен', description: 'До скорой встречи!' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 bg-card border-border">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Icon name="Coins" className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">CryptoEx</h1>
                <p className="text-sm text-muted-foreground">Профессиональная криптобиржа</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="your@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Пароль</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleLogin} className="w-full">Войти</Button>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name">Полное имя</Label>
                <Input
                  id="reg-name"
                  placeholder="Иван Иванов"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="your@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Пароль</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-telegram">Telegram кошелек</Label>
                <Input
                  id="reg-telegram"
                  placeholder="@username"
                  value={regTelegram}
                  onChange={(e) => setRegTelegram(e.target.value)}
                />
              </div>
              <Button onClick={handleRegister} className="w-full">Создать аккаунт</Button>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Icon name="Coins" className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">CryptoEx</h1>
              <p className="text-xs text-muted-foreground">Профессиональная биржа</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <Icon name="LogOut" className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Рыночные курсы</h2>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Icon name="Activity" className="w-3 h-3 mr-1" />
                  Live
                </Badge>
              </div>
              
              <div className="space-y-3">
                {CRYPTO_RATES.map((crypto) => (
                  <div
                    key={crypto.symbol}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-bold text-primary">{crypto.symbol[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{crypto.symbol}</p>
                        <p className="text-xs text-muted-foreground">{crypto.name}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-mono font-semibold text-foreground">
                        ${crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className={`text-xs font-medium ${crypto.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="exchange">
                    <Icon name="ArrowLeftRight" className="w-4 h-4 mr-2" />
                    Обмен
                  </TabsTrigger>
                  <TabsTrigger value="withdraw">
                    <Icon name="Send" className="w-4 h-4 mr-2" />
                    Вывод
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <Icon name="History" className="w-4 h-4 mr-2" />
                    История
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="exchange" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label>Отдаете</Label>
                    <div className="flex space-x-2">
                      <Select value={fromCurrency} onValueChange={setFromCurrency}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRYPTO_RATES.map(c => (
                            <SelectItem key={c.symbol} value={c.symbol}>{c.symbol}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={exchangeAmount}
                        onChange={(e) => setExchangeAmount(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Icon name="ArrowDownUp" className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Получаете</Label>
                    <div className="flex space-x-2">
                      <Select value={toCurrency} onValueChange={setToCurrency}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRYPTO_RATES.map(c => (
                            <SelectItem key={c.symbol} value={c.symbol}>{c.symbol}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={
                          exchangeAmount && fromCurrency && toCurrency
                            ? (
                                parseFloat(exchangeAmount) *
                                (CRYPTO_RATES.find(r => r.symbol === toCurrency)?.price || 0) /
                                (CRYPTO_RATES.find(r => r.symbol === fromCurrency)?.price || 1)
                              ).toFixed(8)
                            : ''
                        }
                        disabled
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <Button onClick={handleExchange} className="w-full" size="lg">
                    <Icon name="Repeat" className="w-4 h-4 mr-2" />
                    Обменять
                  </Button>
                </TabsContent>

                <TabsContent value="withdraw" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label>Валюта</Label>
                    <Select value={withdrawCurrency} onValueChange={setWithdrawCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CRYPTO_RATES.map(c => (
                          <SelectItem key={c.symbol} value={c.symbol}>{c.symbol}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Сумма</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Вывод на Telegram кошелек:</p>
                    <p className="font-medium text-foreground">{user.telegram_wallet || 'Не указан'}</p>
                  </div>

                  <Button onClick={handleWithdraw} className="w-full" size="lg">
                    <Icon name="Send" className="w-4 h-4 mr-2" />
                    Вывести средства
                  </Button>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                  <ScrollArea className="h-96">
                    {transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Icon name="FileText" className="w-12 h-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">История транзакций пуста</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((tx) => (
                          <div key={tx.id} className="p-4 rounded-lg bg-muted/50 border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant={tx.type === 'exchange' ? 'default' : 'secondary'}>
                                {tx.type === 'exchange' ? 'Обмен' : 'Вывод'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(tx.created_at).toLocaleString('ru-RU')}
                              </span>
                            </div>
                            
                            {tx.type === 'exchange' ? (
                              <p className="text-sm text-foreground">
                                {parseFloat(tx.from_amount).toFixed(8)} {tx.from_currency} →{' '}
                                {parseFloat(tx.to_amount).toFixed(8)} {tx.to_currency}
                              </p>
                            ) : (
                              <p className="text-sm text-foreground">
                                Вывод {parseFloat(tx.from_amount).toFixed(8)} {tx.from_currency}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Мой кошелек</h3>
                <Icon name="Wallet" className="w-5 h-5 text-primary" />
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                {wallets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Загрузка...</p>
                ) : (
                  wallets.map((wallet) => (
                    <div key={wallet.currency} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{wallet.currency[0]}</span>
                        </div>
                        <span className="font-medium text-foreground">{wallet.currency}</span>
                      </div>
                      <span className="font-mono font-semibold text-foreground">
                        {parseFloat(wallet.balance).toFixed(8)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Профиль</h3>
                <Icon name="User" className="w-5 h-5 text-primary" />
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Имя</p>
                  <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium text-foreground">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Telegram кошелек</p>
                  <p className="text-sm font-medium text-foreground">{user.telegram_wallet || 'Не указан'}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Поддержка</h3>
                <Icon name="MessageCircle" className="w-5 h-5 text-primary" />
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Icon name="HelpCircle" className="w-4 h-4 mr-2" />
                  FAQ
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Icon name="Mail" className="w-4 h-4 mr-2" />
                  Написать в поддержку
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Icon name="FileText" className="w-4 h-4 mr-2" />
                  Документация
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}