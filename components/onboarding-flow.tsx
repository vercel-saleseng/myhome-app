"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Bot, Shield, Mic, Lock, ArrowRight, Check } from "lucide-react"

interface OnboardingFlowProps {
  onComplete: () => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      icon: Bot,
      title: "Welcome to Voice Assistant",
      description: "Your personal AI assistant with secure, encrypted storage capabilities.",
      features: ["Voice-to-text interaction", "Real-time transcription", "Intelligent responses"],
    },
    {
      icon: Shield,
      title: "Secure Authentication",
      description: "We use passkeys for passwordless, secure authentication with biometric verification.",
      features: ["No passwords to remember", "Biometric authentication", "Device-based security"],
    },
    {
      icon: Lock,
      title: "Encrypted Secret Storage",
      description: "Store sensitive information securely using your passkey's PRF extension for encryption.",
      features: ["End-to-end encryption", "Local storage only", "PRF-based key derivation"],
    },
    {
      icon: Mic,
      title: "Ready to Start",
      description: "You're all set! Create your passkey to begin using your voice assistant.",
      features: ["Hands-free interaction", "Smart voice commands", "Personalized responses"],
    },
  ]

  const currentStepData = steps[currentStep]
  const Icon = currentStepData.icon

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg p-8 space-y-6">
        {/* Progress indicator */}
        <div className="flex justify-center space-x-2 mb-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${index <= currentStep ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-primary-foreground" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground text-balance">{currentStepData.title}</h1>
            <p className="text-muted-foreground text-pretty">{currentStepData.description}</p>
          </div>

          <div className="space-y-2 pt-4">
            {currentStepData.features.map((feature, index) => (
              <div key={index} className="flex items-center justify-center space-x-2 text-sm">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="w-24 bg-transparent"
          >
            Previous
          </Button>

          <Button onClick={handleNext} className="w-24">
            {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="text-center">
          <button
            onClick={onComplete}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip introduction
          </button>
        </div>
      </Card>
    </div>
  )
}
