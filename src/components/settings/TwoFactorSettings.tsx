import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { authApi } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Setup flow
  const [setupOpen, setSetupOpen] = useState(false);
  const [step, setStep] = useState<'qr' | 'recovery'>('qr');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable flow
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    authApi.get2faStatus().then(r => {
      setEnabled(r.data.totp_enabled);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleStartSetup = async () => {
    setSetupOpen(true);
    setStep('qr');
    setConfirmCode('');
    setCopiedSecret(false);
    setCopiedCodes(false);
    try {
      const result = await authApi.setup2fa('generate');
      setOtpauthUri(result.data.otpauth_uri || '');
      setSecret(result.data.secret || '');
      setRecoveryCodes(result.data.recovery_codes || []);
    } catch (err: any) {
      toast.error(err.message || t('twoFactor.setupFailed'));
      setSetupOpen(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await authApi.setup2fa('confirm', confirmCode);
      setEnabled(true);
      setStep('recovery');
      toast.success(t('twoFactor.enabled'));
    } catch (err: any) {
      toast.error(err.message || t('twoFactor.invalidCode'));
    } finally {
      setConfirming(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await authApi.setup2fa('disable', disableCode);
      setEnabled(false);
      setDisableOpen(false);
      setDisableCode('');
      toast.success(t('twoFactor.disabled'));
    } catch (err: any) {
      toast.error(err.message || t('twoFactor.invalidCode'));
    } finally {
      setDisabling(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // QR code via a public API (Google Charts)
  const qrUrl = otpauthUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`
    : '';

  if (loading) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t('twoFactor.title')}
              </CardTitle>
              <CardDescription>{t('twoFactor.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {enabled && <Badge variant="default">{t('twoFactor.active')}</Badge>}
              {enabled ? (
                <Button variant="outline" size="sm" onClick={() => { setDisableOpen(true); setDisableCode(''); }}>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  {t('twoFactor.disable')}
                </Button>
              ) : (
                <Button size="sm" onClick={handleStartSetup}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {t('twoFactor.enable')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {!enabled && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('twoFactor.notEnabledHint')}</p>
          </CardContent>
        )}
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={(o) => { if (!o && step === 'recovery') { setSetupOpen(false); } else if (!o) { setSetupOpen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 'qr' ? t('twoFactor.setupTitle') : t('twoFactor.recoveryTitle')}
            </DialogTitle>
          </DialogHeader>

          {step === 'qr' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('twoFactor.scanQrDescription')}</p>

              {qrUrl && (
                <div className="flex justify-center">
                  <img src={qrUrl} alt="2FA QR Code" className="rounded-lg border" width={200} height={200} />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('twoFactor.manualEntry')}</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-2 rounded text-xs font-mono break-all">{secret}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(secret, setCopiedSecret)}>
                    {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('auth.verificationCode')}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="000000"
                  className="text-center text-lg tracking-widest"
                />
              </div>

              <Button className="w-full" disabled={confirmCode.length < 6 || confirming} onClick={handleConfirm}>
                {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('twoFactor.verifyAndEnable')}
              </Button>
            </div>
          )}

          {step === 'recovery' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('twoFactor.recoveryDescription')}</p>

              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code, i) => (
                  <code key={i} className="bg-muted p-2 rounded text-sm font-mono text-center">{code}</code>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(recoveryCodes.join('\n'), setCopiedCodes)}
              >
                {copiedCodes ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {t('twoFactor.copyCodes')}
              </Button>

              <p className="text-xs text-destructive font-medium">{t('twoFactor.recoveryWarning')}</p>

              <Button className="w-full" onClick={() => setSetupOpen(false)}>
                {t('twoFactor.done')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('twoFactor.disableTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('twoFactor.disableDescription')}</p>
            <div className="space-y-2">
              <Label>{t('auth.verificationCode')}</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="000000"
                className="text-center text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground">{t('auth.recoveryCodeHint')}</p>
            </div>
            <Button variant="destructive" className="w-full" disabled={!disableCode.trim() || disabling} onClick={handleDisable}>
              {disabling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('twoFactor.confirmDisable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
