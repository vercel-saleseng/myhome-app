'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Settings, Wifi, WifiOff } from 'lucide-react'
import { useEffect } from 'react'

export function HomeAssistantStatus({
    connectionStatus,
    config,
    onOpenConfig,
    onTestConnection,
    className,
}: {
    connectionStatus: ConnectionStatus
    config: { url: string | null }
    onOpenConfig: () => void
    onTestConnection: () => void
    className?: string
}) {
    const { isConnected, isLoading, error, haInfo, lastChecked } = connectionStatus

    if (!config.url) {
        return (
            <div
                className={`p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 ${className}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Home Assistant not configured
                        </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={onOpenConfig}>
                        <Settings className="w-3 h-3 mr-1" />
                        Configure
                    </Button>
                </div>
            </div>
        )
    }

    if (isLoading || lastChecked === null) {
        return (
            <div
                className={`p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 ${className}`}
            >
                <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    <span className="text-sm text-blue-800 dark:text-blue-200">
                        Testing Home Assistant connection...
                    </span>
                </div>
            </div>
        )
    }

    if (isConnected && haInfo) {
        return (
            <div
                className={`p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 ${className}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                Connected to {haInfo.name}
                            </span>
                            {haInfo.version && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                    Version {haInfo.version}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 ${className}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">Connection failed</span>
                        <span className="text-xs text-red-600 dark:text-red-400">{error || 'Unknown error'}</span>
                    </div>
                </div>
                <div className="flex space-x-1">
                    <Button size="sm" variant="outline" onClick={onTestConnection}>
                        Retry
                    </Button>
                    <Button size="sm" variant="outline" onClick={onOpenConfig}>
                        <Settings className="w-3 h-3 mr-1" />
                        Fix
                    </Button>
                </div>
            </div>
        </div>
    )
}
