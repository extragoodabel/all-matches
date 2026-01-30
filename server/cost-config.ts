// ============================================================
// COST-SAFE MODE CONFIGURATION
// ============================================================
// This file controls AI usage to prevent runaway costs.
// 
// HOW TO USE:
// - Set COST_SAFE_MODE=true in environment to disable all AI generation
// - Set ENABLE_CHAT_AI=true to allow chat responses (with rate limits)
// - Set ENABLE_IMAGE_AI=true to allow image generation (NOT RECOMMENDED)
//
// DEFAULTS: Everything disabled for safety
// ============================================================

export const COST_CONFIG = {
  // Master switch - when true, ALL AI calls are blocked
  COST_SAFE_MODE: process.env.COST_SAFE_MODE !== "false", // Default: true
  
  // Individual AI feature toggles (only work if COST_SAFE_MODE is false)
  ENABLE_CHAT_AI: process.env.ENABLE_CHAT_AI === "true",   // Default: false
  ENABLE_IMAGE_AI: process.env.ENABLE_IMAGE_AI === "true", // Default: false
  ENABLE_BIO_AI: process.env.ENABLE_BIO_AI === "true",     // Default: false
  
  // Rate limiting for chat AI
  MAX_CHAT_CALLS_PER_HOUR: parseInt(process.env.MAX_CHAT_CALLS_PER_HOUR || "10"),
  
  // Logging
  LOG_AI_CALLS: true,
};

// ============================================================
// USAGE TRACKING (in-memory for this session)
// ============================================================

interface UsageStats {
  chatCalls: number;
  imageCalls: number;
  bioCalls: number;
  chatCallsThisHour: number;
  hourStartTime: number;
}

const usageStats: UsageStats = {
  chatCalls: 0,
  imageCalls: 0,
  bioCalls: 0,
  chatCallsThisHour: 0,
  hourStartTime: Date.now(),
};

export function getUsageStats(): UsageStats {
  return { ...usageStats };
}

export function resetHourlyLimitIfNeeded(): void {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  if (now - usageStats.hourStartTime > oneHour) {
    usageStats.chatCallsThisHour = 0;
    usageStats.hourStartTime = now;
  }
}

// ============================================================
// AI CALL GUARDS
// ============================================================

export function canMakeChatAICall(): { allowed: boolean; reason: string } {
  if (COST_CONFIG.COST_SAFE_MODE) {
    return { allowed: false, reason: "COST_SAFE_MODE is enabled" };
  }
  
  if (!COST_CONFIG.ENABLE_CHAT_AI) {
    return { allowed: false, reason: "ENABLE_CHAT_AI is disabled" };
  }
  
  resetHourlyLimitIfNeeded();
  
  if (usageStats.chatCallsThisHour >= COST_CONFIG.MAX_CHAT_CALLS_PER_HOUR) {
    return { 
      allowed: false, 
      reason: `Rate limit exceeded (${usageStats.chatCallsThisHour}/${COST_CONFIG.MAX_CHAT_CALLS_PER_HOUR} per hour)` 
    };
  }
  
  return { allowed: true, reason: "OK" };
}

export function canMakeImageAICall(): { allowed: boolean; reason: string } {
  if (COST_CONFIG.COST_SAFE_MODE) {
    return { allowed: false, reason: "COST_SAFE_MODE is enabled" };
  }
  
  if (!COST_CONFIG.ENABLE_IMAGE_AI) {
    return { allowed: false, reason: "ENABLE_IMAGE_AI is disabled" };
  }
  
  return { allowed: true, reason: "OK" };
}

export function canMakeBioAICall(): { allowed: boolean; reason: string } {
  if (COST_CONFIG.COST_SAFE_MODE) {
    return { allowed: false, reason: "COST_SAFE_MODE is enabled" };
  }
  
  if (!COST_CONFIG.ENABLE_BIO_AI) {
    return { allowed: false, reason: "ENABLE_BIO_AI is disabled" };
  }
  
  return { allowed: true, reason: "OK" };
}

// ============================================================
// USAGE LOGGING
// ============================================================

export function logAICall(endpoint: string, model: string, reason: string): void {
  if (!COST_CONFIG.LOG_AI_CALLS) return;
  
  const timestamp = new Date().toISOString();
  console.log(`[AI USAGE] ${timestamp} | ${endpoint} | model=${model} | reason=${reason}`);
}

export function recordChatCall(): void {
  usageStats.chatCalls++;
  usageStats.chatCallsThisHour++;
  logAICall("/api/messages", "gpt-4o-mini", "chat response");
}

export function recordImageCall(): void {
  usageStats.imageCalls++;
  logAICall("image-gen", "n/a", "image generation");
}

export function recordBioCall(): void {
  usageStats.bioCalls++;
  logAICall("bio-gen", "gpt-4o-mini", "bio generation");
}

// ============================================================
// STARTUP LOG
// ============================================================

console.log("=".repeat(60));
console.log("COST CONTROL CONFIGURATION");
console.log("=".repeat(60));
console.log(`COST_SAFE_MODE:    ${COST_CONFIG.COST_SAFE_MODE ? "ON (all AI blocked)" : "OFF"}`);
console.log(`ENABLE_CHAT_AI:    ${COST_CONFIG.ENABLE_CHAT_AI ? "ON" : "OFF"}`);
console.log(`ENABLE_IMAGE_AI:   ${COST_CONFIG.ENABLE_IMAGE_AI ? "ON" : "OFF"}`);
console.log(`ENABLE_BIO_AI:     ${COST_CONFIG.ENABLE_BIO_AI ? "ON" : "OFF"}`);
console.log(`MAX_CHAT/HOUR:     ${COST_CONFIG.MAX_CHAT_CALLS_PER_HOUR}`);
console.log("=".repeat(60));
