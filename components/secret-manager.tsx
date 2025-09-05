'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, Eye, EyeOff, Trash2, Lock, Unlock, AlertCircle, Copy, Check } from 'lucide-react'
import { useSecretStorage } from '@/hooks/use-secret-storage'

interface SecretManagerProps {
    prfOutput: ArrayBuffer | null
    className?: string
}

export function SecretManager({ prfOutput, className }: SecretManagerProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [secretName, setSecretName] = useState('')
    const [secretData, setSecretData] = useState('')
    const [viewingSecret, setViewingSecret] = useState<string | null>(null)
    const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, string>>({})
    const [copiedSecrets, setCopiedSecrets] = useState<Record<string, boolean>>({})

    const { secrets, isLoading, error, encryptSecret, decryptSecret, deleteSecret, canEncrypt } =
        useSecretStorage(prfOutput)

    const handleAddSecret = async () => {
        if (!secretName.trim() || !secretData.trim()) return

        try {
            await encryptSecret(secretName.trim(), secretData.trim())
            setSecretName('')
            setSecretData('')
            setIsAddDialogOpen(false)
        } catch (err) {
            // Error is handled by the hook
        }
    }

    const handleViewSecret = async (secretId: string) => {
        if (decryptedSecrets[secretId]) {
            // Hide the secret
            const updated = { ...decryptedSecrets }
            delete updated[secretId]
            setDecryptedSecrets(updated)
            setViewingSecret(null)
        } else {
            // Decrypt and show the secret
            try {
                const decrypted = await decryptSecret(secretId)
                setDecryptedSecrets((prev) => ({
                    ...prev,
                    [secretId]: decrypted.data,
                }))
                setViewingSecret(secretId)
            } catch (err) {
                // Error is handled by the hook
            }
        }
    }

    const handleCopySecret = async (secretId: string) => {
        const secretData = decryptedSecrets[secretId]
        if (secretData) {
            try {
                await navigator.clipboard.writeText(secretData)
                setCopiedSecrets((prev) => ({ ...prev, [secretId]: true }))
                setTimeout(() => {
                    setCopiedSecrets((prev) => ({ ...prev, [secretId]: false }))
                }, 2000)
            } catch (err) {
                console.error('[v0] Failed to copy to clipboard:', err)
            }
        }
    }

    const handleDeleteSecret = async (secretId: string) => {
        if (confirm('Are you sure you want to delete this secret? This action cannot be undone.')) {
            try {
                await deleteSecret(secretId)
                // Remove from decrypted secrets if it was visible
                const updated = { ...decryptedSecrets }
                delete updated[secretId]
                setDecryptedSecrets(updated)
            } catch (err) {
                // Error is handled by the hook
            }
        }
    }

    if (!canEncrypt) {
        return (
            <Card className={`p-6 ${className}`}>
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">Secret Storage Unavailable</h3>
                        <p className="text-sm text-muted-foreground text-pretty">
                            Please authenticate with your passkey to enable encrypted secret storage.
                        </p>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className={`p-6 ${className}`}>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Encrypted Secrets</h3>
                        <Badge variant="secondary" className="text-xs">
                            PRF Enabled
                        </Badge>
                    </div>

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Secret
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Encrypted Secret</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="secret-name">Secret Name</Label>
                                    <Input
                                        id="secret-name"
                                        placeholder="e.g., API Key, Password, etc."
                                        value={secretName}
                                        onChange={(e) => setSecretName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="secret-data">Secret Data</Label>
                                    <Textarea
                                        id="secret-data"
                                        placeholder="Enter your secret data here..."
                                        value={secretData}
                                        onChange={(e) => setSecretData(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                                <Button
                                    onClick={handleAddSecret}
                                    className="w-full"
                                    disabled={isLoading || !secretName.trim() || !secretData.trim()}
                                >
                                    {isLoading ? 'Encrypting...' : 'Encrypt & Store'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {secrets.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                        <Unlock className="w-8 h-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">No secrets stored yet</p>
                        <p className="text-xs text-muted-foreground">Add your first encrypted secret to get started</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {secrets.map((secret) => (
                            <div key={secret.id} className="border border-border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium text-foreground">{secret.name}</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Added {new Date(secret.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleViewSecret(secret.id)}
                                            disabled={isLoading}
                                        >
                                            {decryptedSecrets[secret.id] ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </Button>
                                        {decryptedSecrets[secret.id] && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleCopySecret(secret.id)}
                                            >
                                                {copiedSecrets[secret.id] ? (
                                                    <Check className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDeleteSecret(secret.id)}
                                            disabled={isLoading}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {decryptedSecrets[secret.id] && (
                                    <div className="bg-muted/50 rounded p-3 border border-border/50">
                                        <pre className="text-sm text-foreground whitespace-pre-wrap break-all">
                                            {decryptedSecrets[secret.id]}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
                    <p>• Secrets are encrypted using your passkey's PRF extension</p>
                    <p>• Only you can decrypt them with your authenticated passkey</p>
                    <p>• Secrets are stored locally and never leave your device</p>
                </div>
            </div>
        </Card>
    )
}
