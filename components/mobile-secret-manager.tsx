'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Shield } from 'lucide-react'
import { SecretManager } from '@/components/secret-manager'

interface MobileSecretManagerProps {
    prfOutput: ArrayBuffer | null
}

export function MobileSecretManager({ prfOutput }: MobileSecretManagerProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="sm:hidden">
                    <Shield className="w-4 h-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                    <SheetTitle>Encrypted Secrets</SheetTitle>
                </SheetHeader>
                <div className="mt-4 overflow-y-auto h-full pb-4">
                    <SecretManager prfOutput={prfOutput} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
